import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import { BillingApi } from "../src/apis/billing-api.class.ts";
import { parseAmount } from "../src/money.ts";

type RecordedRequest = { method: string; url: string; today: string | undefined; body: string };
type Reply = { status: number; body?: string };

const TODAY = "2022-01-10";

let server: Server;
let baseUrl: string;
let requests: RecordedRequest[] = [];
let replies = new Map<string, Reply>();

function reply(method: string, path: string, status: number, body?: string): void {
    replies.set(`${method} ${path}`, body === undefined ? { status } : { status, body });
}

function todayHeader(request: IncomingMessage): string | undefined {
    const value = request.headers["today"];
    return Array.isArray(value) ? value[0] : value;
}

before(async () => {
    server = createServer((request, response) => {
        let body = "";
        request.on("data", (chunk) => (body += chunk));
        request.on("end", () => {
            const method = request.method ?? "";
            const url = request.url ?? "";
            requests.push({ method, url, today: todayHeader(request), body });
            const { status, body: responseBody = "" } = replies.get(`${method} ${url}`) ?? { status: 404 };
            response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
            response.end(responseBody);
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
    server.close();
});

beforeEach(() => {
    requests = [];
    replies = new Map();
});

test("sends the Today header and reads advances even though the server says text/html", async () => {
    reply("GET", "/advances", 200, JSON.stringify({ advances: [{ id: 1, mandate_id: 2 }] }));

    const advances = await new BillingApi(TODAY, baseUrl).getAdvancesForDate();

    assert.deepEqual(advances, [{ id: 1, mandate_id: 2 }]);
    assert.deepEqual(requests, [{ method: "GET", url: "/advances", today: TODAY, body: "" }]);
});

test("returns revenue in cents, or null when the API answers 530", async () => {
    reply("GET", "/customers/1/revenues/2022-01-09", 200, '{"amount": "5363.16"}');
    reply("GET", "/customers/1/revenues/2022-01-08", 530, "Revenue not yet available");
    const api = new BillingApi(TODAY, baseUrl);

    assert.equal(await api.getCustomerRevenuesForDate(1, "2022-01-09"), 536316);
    assert.equal(await api.getCustomerRevenuesForDate(1, "2022-01-08"), null);
});

test("sends the charge amount as a two-decimal string and maps 530 to a rejected charge", async () => {
    reply("POST", "/mandates/2/charge", 200);
    reply("POST", "/mandates/3/charge", 530, "Charging not possible at this time");
    const api = new BillingApi(TODAY, baseUrl);

    assert.equal(await api.chargeMandate(2, parseAmount("3217.05")), true);
    assert.equal(await api.chargeMandate(3, parseAmount("10.00")), false);
    assert.deepEqual(requests[0], {
        method: "POST",
        url: "/mandates/2/charge",
        today: TODAY,
        body: '{"amount":"3217.05"}',
    });
});

test("marks billing complete with the Today header", async () => {
    reply("POST", "/advances/1/billing_complete", 200);

    await new BillingApi(TODAY, baseUrl).setBillingComplete(1);

    assert.deepEqual(requests, [{ method: "POST", url: "/advances/1/billing_complete", today: TODAY, body: "" }]);
});

test("throws on any other status, naming the request, including 530 where it is not a domain outcome", async () => {
    reply("POST", "/mandates/2/charge", 500, "boom");
    reply("GET", "/customers/1/revenues/2022-01-09", 404);
    reply("GET", "/advances", 530);
    reply("POST", "/advances/1/billing_complete", 530);
    const api = new BillingApi(TODAY, baseUrl);

    await assert.rejects(api.chargeMandate(2, parseAmount("1.00")), {
        message: "POST /mandates/2/charge (Today: 2022-01-10) -> HTTP 500",
    });
    await assert.rejects(api.getCustomerRevenuesForDate(1, "2022-01-09"), /HTTP 404/);
    await assert.rejects(api.getAdvancesForDate(), /GET \/advances .* HTTP 530/);
    await assert.rejects(api.setBillingComplete(1), /billing_complete .* HTTP 530/);
});

test("names the request in flight when no response arrives", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const unreachableUrl = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    await assert.rejects(new BillingApi(TODAY, unreachableUrl).chargeMandate(2, parseAmount("1.00")), {
        message: "POST /mandates/2/charge (Today: 2022-01-10) got no response",
    });
});
