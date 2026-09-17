import type { BillingApiForDay } from "./apis/billing-api.class.ts";
import type { IBiller } from "./biller.class.ts";
import { dateRange } from "./dates.ts";

export const START_DATE = "2022-01-01";
export const END_DATE = "2022-02-01";

// README assumption 1: both START_DATE and END_DATE are billing days.
export async function runSimulation(
    biller: IBiller,
    apiForDay: BillingApiForDay,
    firstDay = START_DATE,
    lastDay = END_DATE,
): Promise<void> {
    for (const today of dateRange(firstDay, lastDay)) {
        await biller.runForDay(apiForDay(today), today);
    }
}
