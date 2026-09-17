import assert from "node:assert/strict";
import { test } from "node:test";
import { runBillingForDay } from "../src/billing.ts";
import { dateRange } from "../src/dates.ts";
import type { AdvanceBilling } from "../src/types/index.ts";
import { FakeBillingApi } from "./support/fake-billing-api.ts";

async function simulate(fake: FakeBillingApi, first: string, last: string): Promise<Map<number, AdvanceBilling>> {
    const billings = new Map<number, AdvanceBilling>();
    for (const today of dateRange(first, last)) {
        await runBillingForDay(fake.forDay(today), today, billings);
    }
    return billings;
}

test.todo("charges nothing before repayment_start_date and bills the previous day's revenue on it", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, repayment_start_date: "2022-01-05", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-10", "1000.00");

    await simulate(fake, "2022-01-01", "2022-01-06");

    assert.deepEqual(fake.chargeAttempts, [
        { today: "2022-01-05", mandateId: 101, amount: 10000, result: true },
        { today: "2022-01-06", mandateId: 101, amount: 10000, result: true },
    ]);
});

test.todo("truncates the final charge to reach exactly total_advanced + fee and completes billing once", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "1000.00", fee: "100.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-31", "3000.00");

    await simulate(fake, "2022-01-01", "2022-01-08");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 30000],
            ["2022-01-03", 30000],
            ["2022-01-04", 30000],
            ["2022-01-05", 20000],
        ],
    );
    assert.deepEqual(fake.completions, [{ today: "2022-01-05", advanceId: 1 }]);
});

test.todo("bills late revenue on the day it becomes available");
test.todo("splits a charge above 10000.00 across the following days");
test.todo("applies the 10000.00 limit to the day's total, including recovered late revenue");
test.todo("retries a rejected charge the next day with everything owed so far");
test.todo("does not complete billing when the final charge is rejected");
test.todo("stops billing a fully repaid advance, even if late revenue arrives afterwards");
test.todo("starts billing an advance created mid-period from its own repayment_start_date");
test.todo("bills two advances of one customer that share a mandate, each at its own percentage");
