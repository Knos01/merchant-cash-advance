import type { IBillingApi } from "./apis/billing-api.class.ts";
import { addDays, dateRange } from "./dates.ts";
import { minCents, parseAmount, percentageOf, subtractCents, sumCents, ZERO, type Cents } from "./money.ts";
import type { Advance, AdvanceBilling } from "./types/index.ts";

export const DAILY_CHARGE_LIMIT: Cents = parseAmount("10000.00");

export interface IBiller {
    runForDay(api: IBillingApi, today: string): Promise<void>;
    getBillings(): AdvanceBilling[];
}

export class Biller implements IBiller {
    private readonly billings = new Map<number, AdvanceBilling>();

    async runForDay(api: IBillingApi, today: string): Promise<void> {
        const advances = await api.getAdvancesForDate();
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

    private async billAdvance(api: IBillingApi, today: string, billing: AdvanceBilling): Promise<void> {
        const repaymentStartDate = billing.advance.repayment_start_date;
        if (billing.completed || today < repaymentStartDate) return;

        for (const date of dateRange(addDays(repaymentStartDate, -1), addDays(today, -1))) {
            if (billing.revenueDates.has(date)) {
                continue;
            }

            const revenue: Cents | null = await api.getCustomerRevenuesForDate(billing.advance.customer_id, date);

            if (revenue === null) {
                continue;
            }
            
            billing.revenueDates.add(date);

            const share: Cents = percentageOf(revenue, billing.advance.repayment_percentage);
            billing.due = sumCents([billing.due, share]);
        }

        const chargeAmount = minCents(subtractCents(billing.due, billing.collected), subtractCents(billing.total, billing.collected), DAILY_CHARGE_LIMIT);

        if (chargeAmount === ZERO) {
            return;
        }

        const success = await api.chargeMandate(billing.advance.mandate_id, chargeAmount);

        if (success) {
            billing.collected = sumCents([billing.collected, chargeAmount]);

            if (billing.collected === billing.total) {
                await api.setBillingComplete(billing.advance.id);
                billing.completed = true;
            }
        }
    }
}
