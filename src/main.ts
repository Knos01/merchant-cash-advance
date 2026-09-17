import { BILLING_API_URL, BillingApi } from "./apis/billing-api.class.ts";
import { Biller } from "./biller.class.ts";
import { formatBillingSummary } from "./report.ts";
import { END_DATE, runSimulation, START_DATE } from "./simulation.ts";

console.log(
    `Billing ${START_DATE} to ${END_DATE} against ${BILLING_API_URL} (this sends real charges)`,
);

const biller = new Biller();
await runSimulation(biller, (today) => new BillingApi(today));

console.log(`\n${formatBillingSummary(biller.getBillings())}`);
