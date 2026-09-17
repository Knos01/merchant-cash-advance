import type { IBillingApiInterface } from "./apis/billing-api.class.ts";
import { addDays, dateRange } from "./dates.ts";
import { minCents, parseAmount, percentageOf, subtractCents, sumCents, ZERO, type Cents } from "./money.ts";
import type { Advance, AdvanceBilling } from "./types/index.ts";

export const DAILY_CHARGE_LIMIT: Cents = parseAmount("10000.00");

export async function runBillingForDay(
    api: IBillingApiInterface,
    today: string,
    billings: Map<number, AdvanceBilling>,
): Promise<void> {
    const advances = await api.getAdvancesForDate();
    for (const advance of advances) {
        let billing = billings.get(advance.id)
        if (!billing) {
            billing = startBilling(advance)
            billings.set(advance.id, billing)
        }

        await billAdvance(api, today, billing);

    }
}

function startBilling(advance: Advance): AdvanceBilling {
    return {
        advance,
        total: sumCents([parseAmount(advance.total_advanced), parseAmount(advance.fee)]),
        owed: ZERO,
        collected: ZERO,
        revenueDates: new Set(),
        completed: false,
    };
}

async function billAdvance(api: IBillingApiInterface, today: string, billing: AdvanceBilling): Promise<void> {
    // TODO 1. Skip if billing.completed, or if today < repayment_start_date.
    // TODO 2. For each date in dateRange(repayment_start_date - 1 day, today - 1 day) not in billing.revenueDates:
    //         revenue = await api.getCustomerRevenuesForDate(customer_id, date)
    //         if revenue !== null: owed += percentageOf(revenue, repayment_percentage), add date to revenueDates
    // TODO 3. amount = min(owed - collected, total - collected, DAILY_CHARGE_LIMIT)
    //         if amount > 0: charged = await api.chargeMandate(mandate_id, amount)
    //         add amount to collected ONLY if charged is true
    // TODO 4. If collected === total: await api.setBillingComplete(advance.id), then completed = true
    throw new Error("TODO: billAdvance");
}
