import type { IBillingApi } from "../../src/apis/billing-api.class.ts";
import { addDays, dateRange } from "../../src/dates.ts";
import { parseAmount, type Cents } from "../../src/money.ts";
import type { Advance } from "../../src/types/index.ts";

export type ChargeAttempt = { today: string; mandateId: number; amount: Cents; result: boolean };
export type Completion = { today: string; advanceId: number };

type Revenue = { amount: Cents; availableFrom: string };

const DAILY_CHARGE_LIMIT = parseAmount("10000.00");

export interface IFakeBillingApi {
    readonly chargeAttempts: ChargeAttempt[];
    readonly completions: Completion[];
    withAdvance(advance: Partial<Advance> & { id: number }): this;
    withRevenue(customerId: number, date: string, amount: string, availableFrom?: string): this;
    withDailyRevenue(customerId: number, first: string, last: string, amount: string): this;
    rejectingChargesOn(mandateId: number, today: string): this;
    forDay(today: string): IBillingApi;
}

export class FakeBillingApi implements IFakeBillingApi {
    readonly chargeAttempts: ChargeAttempt[] = [];
    readonly completions: Completion[] = [];
    private readonly advances: Advance[] = [];
    private readonly revenues = new Map<string, Revenue>();
    private readonly rejectedCharges = new Set<string>();

    withAdvance(advance: Partial<Advance> & { id: number }): this {
        this.advances.push({
            customer_id: 1,
            mandate_id: advance.id + 100,
            created: "2022-01-01",
            total_advanced: "1000.00",
            fee: "100.00",
            repayment_start_date: "2022-01-02",
            repayment_percentage: 10,
            ...advance,
        });
        return this;
    }

    withRevenue(customerId: number, date: string, amount: string, availableFrom = addDays(date, 1)): this {
        this.revenues.set(revenueKey(customerId, date), { amount: parseAmount(amount), availableFrom });
        return this;
    }

    withDailyRevenue(customerId: number, first: string, last: string, amount: string): this {
        for (const date of dateRange(first, last)) {
            this.withRevenue(customerId, date, amount);
        }
        return this;
    }

    rejectingChargesOn(mandateId: number, today: string): this {
        this.rejectedCharges.add(`${mandateId}|${today}`);
        return this;
    }

    forDay(today: string): IBillingApi {
        return {
            getAdvancesForDate: async () => this.advances.filter((advance) => advance.created <= today),

            getCustomerRevenuesForDate: async (customerId, forDate) => {
                if (forDate >= today) {
                    throw new Error(`Revenue for ${forDate} requested on ${today}`);
                }
                const revenue = this.revenues.get(revenueKey(customerId, forDate));
                if (revenue === undefined) {
                    throw new Error(`No revenue set up for customer ${customerId} on ${forDate}`);
                }
                return today >= revenue.availableFrom ? revenue.amount : null;
            },

            chargeMandate: async (mandateId, amount) => {
                if (amount <= 0 || amount > DAILY_CHARGE_LIMIT) {
                    throw new Error(`Invalid charge of ${amount} cents on mandate ${mandateId} on ${today}`);
                }
                const result = !this.rejectedCharges.has(`${mandateId}|${today}`);
                this.chargeAttempts.push({ today, mandateId, amount, result });
                return result;
            },

            setBillingComplete: async (advanceId) => {
                if (this.completions.some((completion) => completion.advanceId === advanceId)) {
                    throw new Error(`Billing completed twice for advance ${advanceId}`);
                }
                this.completions.push({ today, advanceId });
            },
        };
    }
}

function revenueKey(customerId: number, date: string): string {
    return `${customerId}|${date}`;
}
