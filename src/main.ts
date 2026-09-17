import { BillingApi } from "./apis/billing-api.class.ts";
import { Biller } from "./billing.ts";
import { dateRange } from "./dates.ts";

const START_DATE = "2022-01-01";
const END_DATE = "2022-02-01";

export async function main() {
    const biller = new Biller();
    for (const today of dateRange(START_DATE, END_DATE)) {
        await biller.runForDay(new BillingApi(today), today);
    }
    // TODO: print one line per advance from biller.getBillings(): id, total, collected, completed
}

await main();
