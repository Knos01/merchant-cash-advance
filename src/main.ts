import { BillingApi } from "./apis/billing-api.class.ts";
import { dateRange } from "./dates.ts";

export async function main() {

    const dates = dateRange("2022-01-01", "2022-02-01");
    for (const today of dates) {
        const billingApi = new BillingApi(today);
        const advances = await billingApi.getAdvancesForDate();
    }
}

await main();