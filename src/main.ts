import { BillingApi } from "./apis/billing-api.class.ts";

export async function main() {
    const billingApi = new BillingApi();

    await billingApi.getAdvances();
}