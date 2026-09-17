import { BillingApi } from "./apis/billing-api.class.ts";
import { Biller } from "./biller.class.ts";
import { dateRange } from "./dates.ts";

const START_DATE = "2022-01-01";
const END_DATE = "2022-02-01";

export async function main() {
    const biller = new Biller();
    for (const today of dateRange(START_DATE, END_DATE)) {
        await biller.runForDay(new BillingApi(today), today);
    }

    const billings = biller.getBillings();
    console.log(billings)
}

await main();
