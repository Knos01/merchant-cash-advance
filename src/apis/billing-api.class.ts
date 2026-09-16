import type { Advance } from "../types/index.ts";

interface IBillingApiInterface {
    getAdvancesForDate(): Promise<Advance[]>;
    getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<number>;
    chargeMandate(mandateId: number, amount: string): Promise<boolean>;
    setBillingComplete(advanceId: string): Promise<void>;
}

export class BillingApi implements IBillingApiInterface {
    private readonly today: string;
    private readonly baseUrl: string;

    constructor(today: string, baseUrl = "https://billing.eng-test.wayflyer.com/v2") {
        this.today = today;
        this.baseUrl = baseUrl;
    }

    async getAdvancesForDate() {
        console.log("here")
        const response = await fetch(`${this.baseUrl}/advances`,
            {
                headers: {
                    "Today": this.today
                }
            }
        );
        const body = await response.json();

        console.log(body);
        return body as any;
    }

    async getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<number> {
        const response = await fetch(`${this.baseUrl}/customers/${customerId}/revenues/${forDate}`, {
            headers: {
                "Today": this.today
            }
        });

        const body = await response.json();
        console.log(body);
        return body as any;
    }

    async chargeMandate(mandateId: number, amount: string): Promise<boolean> {
        const response = await fetch(`${this.baseUrl}/mandates/${mandateId}/charge`, {
            method: "POST",
            body: JSON.stringify({ amount }),
            headers: {
                "Content-Type": "application/json",
                "Today": this.today
            }
        });

        const body = await response.json();
        console.log(body);
        return body as any;
    }

    async setBillingComplete(advanceId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/advances/${advanceId}/billing_complete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Today": this.today
            }
        });

        const body = await response.json();
        console.log(body);

    }
}