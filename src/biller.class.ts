import type { IBillingApi } from "./apis/billing-api.class.ts";
import { addDays, dateRange } from "./dates.ts";
import {
    minCents,
    parseAmount,
    percentageOf,
    subtractCents,
    sumCents,
    ZERO,
    type Cents,
} from "./money.ts";
import type { Advance, AdvanceBilling } from "./types/index.ts";

export const DAILY_CHARGE_LIMIT: Cents = parseAmount("10000.00");

export interface IBiller {
    runForDay(api: IBillingApi, today: string): Promise<void>;
    getBillings(): AdvanceBilling[];
}

export class Biller implements IBiller {
    private readonly billings = new Map<number, AdvanceBilling>();

    async runForDay(api: IBillingApi, today: string): Promise<void> {
        const advances = await api.getAdvances();
        for (const advance of advances) {
            let billing = this.billings.get(advance.id);
            if (!billing) {
                billing = this.createBilling(advance);
                this.billings.set(advance.id, billing);
            }

            await this.billAdvance(api, today, billing);
        }
    }

    getBillings(): AdvanceBilling[] {
        return [...this.billings.values()];
    }

    private createBilling(advance: Advance): AdvanceBilling {
        return {
            advance,
            total: sumCents([parseAmount(advance.total_advanced), parseAmount(advance.fee)]),
            due: ZERO,
            collected: ZERO,
            revenueDates: new Set(),
            completed: false,
        };
    }

    private async billAdvance(
        api: IBillingApi,
        today: string,
        billing: AdvanceBilling,
    ): Promise<void> {
        const { advance } = billing;
        if (billing.completed || today < advance.repayment_start_date) {
            return;
        }

        // README assumption 2: on repayment_start_date we bill the previous day's revenue,
        // and every day not yet available is retried until it arrives.
        const revenueDates = dateRange(
            addDays(advance.repayment_start_date, -1),
            addDays(today, -1),
        );
        for (const date of revenueDates) {
            if (billing.revenueDates.has(date)) {
                continue;
            }

            const revenue = await api.getRevenue(advance.customer_id, date);
            if (revenue === null) {
                continue;
            }

            billing.revenueDates.add(date);
            billing.due = sumCents([
                billing.due,
                percentageOf(revenue, advance.repayment_percentage),
            ]);
        }

        // README assumption 4: one charge per advance per day; the limit applies per advance, not per mandate.
        const outstanding = subtractCents(billing.due, billing.collected);
        const remaining = subtractCents(billing.total, billing.collected);
        const chargeAmount = minCents(outstanding, remaining, DAILY_CHARGE_LIMIT);

        if (chargeAmount > ZERO) {
            // TODO: send an idempotency key (advance id + today) so a timed-out charge could be retried safely.
            const charged = await api.chargeMandate(advance.mandate_id, chargeAmount);
            if (charged) {
                billing.collected = sumCents([billing.collected, chargeAmount]);

                if (billing.collected === billing.total) {
                    await api.setBillingComplete(advance.id);
                    billing.completed = true;
                }
            }
        }
    }
}
