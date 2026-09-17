import { BillingApi } from "./apis/billing-api.class.ts";
import { runBillingForDay } from "./billing.ts";
import { dateRange } from "./dates.ts";
import type { AdvanceBilling } from "./types/index.ts";

const START_DATE = "2022-01-01";
const END_DATE = "2022-02-01";

export async function main() {
    const billings = new Map<number, AdvanceBilling>();
    for (const today of dateRange(START_DATE, END_DATE)) {
        await runBillingForDay(new BillingApi(today), today, billings);
    }
    // TODO: print one line per advance: id, total, collected, completed
}

await main();
