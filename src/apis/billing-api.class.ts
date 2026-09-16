import type { Advance } from "../types/index.ts";
import { formatAmount, parseAmount, type Cents } from "../money.ts";

const NOT_POSSIBLE_RIGHT_NOW = 530;
const REQUEST_TIMEOUT_MS = 30_000;

export interface IBillingApiInterface {
    getAdvancesForDate(): Promise<Advance[]>;
    getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<Cents | null>;
    chargeMandate(mandateId: number, amount: Cents): Promise<boolean>;
    setBillingComplete(advanceId: number): Promise<void>;
}

export class BillingApi implements IBillingApiInterface {
    private readonly today: string;
    private readonly baseUrl: string;

    constructor(today: string, baseUrl = "https://billing.eng-test.wayflyer.com/v2") {
        this.today = today;
        this.baseUrl = baseUrl;
    }

    async getAdvancesForDate(): Promise<Advance[]> {
        const path = "/advances";
        const response = await this.send("GET", path);
        await this.expectOk(response, "GET", path);
        const body = (await response.json()) as { advances: Advance[] };
        return body.advances;
    }

    async getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<Cents | null> {
        const path = `/customers/${customerId}/revenues/${forDate}`;
        const response = await this.send("GET", path);
        if (response.status === NOT_POSSIBLE_RIGHT_NOW) {
            await response.body?.cancel();
            return null;
        }
        await this.expectOk(response, "GET", path);
        const body = (await response.json()) as { amount: string };
        return parseAmount(body.amount);
    }

    async chargeMandate(mandateId: number, amount: Cents): Promise<boolean> {
        const path = `/mandates/${mandateId}/charge`;
        const response = await this.send("POST", path, { amount: formatAmount(amount) });
        if (response.status === NOT_POSSIBLE_RIGHT_NOW) {
            await response.body?.cancel();
            return false;
        }
        await this.expectOk(response, "POST", path);
        await response.body?.cancel();
        return true;
    }

    async setBillingComplete(advanceId: number): Promise<void> {
        const path = `/advances/${advanceId}/billing_complete`;
        const response = await this.send("POST", path);
        await this.expectOk(response, "POST", path);
        await response.body?.cancel();
    }

    private async send(method: "GET" | "POST", path: string, body?: object): Promise<Response> {
        try {
            return await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: { Today: this.today, "Content-Type": "application/json" },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (error) {
            throw new Error(`${method} ${path} (Today: ${this.today}) got no response`, { cause: error });
        }
    }

    private async expectOk(response: Response, method: string, path: string): Promise<void> {
        if (response.ok) {
            return;
        }
        const text = (await response.text()).slice(0, 200);
        throw new Error(`${method} ${path} (Today: ${this.today}) -> HTTP ${response.status} ${text}`);
    }
}
