import type { Advance } from "../types/index.ts";
import { formatAmount, parseAmount, type Cents } from "../money.ts";

export const BILLING_API_URL = "https://billing.eng-test.wayflyer.com/v2";

const NOT_POSSIBLE_RIGHT_NOW = 530;
const REQUEST_TIMEOUT_MS = 30_000;

export interface IBillingApi {
    getAdvances(): Promise<Advance[]>;
    getRevenue(customerId: number, forDate: string): Promise<Cents | null>;
    chargeMandate(mandateId: number, amount: Cents): Promise<boolean>;
    setBillingComplete(advanceId: number): Promise<void>;
}

export type BillingApiForDay = (today: string) => IBillingApi;

export class BillingApi implements IBillingApi {
    private readonly today: string;
    private readonly baseUrl: string;

    constructor(today: string, baseUrl = BILLING_API_URL) {
        this.today = today;
        this.baseUrl = baseUrl;
    }

    async getAdvances(): Promise<Advance[]> {
        const path = "/advances";
        const response = await this.send("GET", path);
        this.expectOk(response, "GET", path);
        // TODO: validate the payload at runtime (ids, dates, amounts) instead of trusting its shape.
        const body = (await response.json()) as { advances: Advance[] };
        return body.advances;
    }

    async getRevenue(customerId: number, forDate: string): Promise<Cents | null> {
        const path = `/customers/${customerId}/revenues/${forDate}`;
        const response = await this.send("GET", path);
        if (response.status === NOT_POSSIBLE_RIGHT_NOW) {
            return null;
        }

        this.expectOk(response, "GET", path);
        const body = (await response.json()) as { amount: string };
        return parseAmount(body.amount);
    }

    async chargeMandate(mandateId: number, amount: Cents): Promise<boolean> {
        const path = `/mandates/${mandateId}/charge`;
        const response = await this.send("POST", path, { amount: formatAmount(amount) });
        if (response.status === NOT_POSSIBLE_RIGHT_NOW) {
            return false;
        }

        this.expectOk(response, "POST", path);
        return true;
    }

    async setBillingComplete(advanceId: number): Promise<void> {
        const path = `/advances/${advanceId}/billing_complete`;
        const response = await this.send("POST", path);
        this.expectOk(response, "POST", path);
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
            throw new Error(`${method} ${path} (Today: ${this.today}) got no response`, {
                cause: error,
            });
        }
    }

    private expectOk(response: Response, method: string, path: string): void {
        if (response.ok) {
            return;
        }

        throw new Error(`${method} ${path} (Today: ${this.today}) -> HTTP ${response.status}`);
    }
}
