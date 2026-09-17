import assert from "node:assert/strict";
import { test } from "node:test";
import { Biller } from "../src/biller.class.ts";
import { dateRange } from "../src/dates.ts";
import { FakeBillingApi } from "./support/fake-billing-api.ts";

async function simulate(fake: FakeBillingApi, first: string, last: string): Promise<Biller> {
    const biller = new Biller();
    for (const today of dateRange(first, last)) {
        await biller.runForDay(fake.forDay(today), today);
    }
    return biller;
}

test("charges nothing before repayment_start_date and bills the previous day's revenue on it", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, repayment_start_date: "2022-01-05", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-10", "1000.00");

    await simulate(fake, "2022-01-01", "2022-01-06");

    assert.deepEqual(fake.chargeAttempts, [
        { today: "2022-01-05", mandateId: 101, amount: 10_000, result: true },
        { today: "2022-01-06", mandateId: 101, amount: 10_000, result: true },
    ]);
});

test("truncates the final charge to reach exactly total_advanced + fee and completes billing once", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "1000.00", fee: "100.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-31", "3000.00");

    await simulate(fake, "2022-01-01", "2022-01-08");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 30_000],
            ["2022-01-03", 30_000],
            ["2022-01-04", 30_000],
            ["2022-01-05", 20_000],
        ],
    );
    assert.deepEqual(fake.completions, [{ today: "2022-01-05", advanceId: 1 }]);
});

test("bills late revenue on the day it becomes available", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "10000.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-05", "1000.00")
        .withRevenue(1, "2022-01-02", "1000.00", "2022-01-05");

    await simulate(fake, "2022-01-01", "2022-01-06");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 10_000],
            ["2022-01-04", 10_000],
            ["2022-01-05", 20_000],
            ["2022-01-06", 10_000],
        ],
    );
});

test("splits a charge above 10000.00 across the following days", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "100000.00", repayment_percentage: 10 })
        .withRevenue(1, "2022-01-01", "250000.00")
        .withDailyRevenue(1, "2022-01-02", "2022-01-04", "0.00");

    await simulate(fake, "2022-01-01", "2022-01-05");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 1_000_000],
            ["2022-01-03", 1_000_000],
            ["2022-01-04", 500_000],
        ],
    );
});

test("applies the 10000.00 limit to the day's total, including recovered late revenue", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "100000.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-04", "60000.00")
        .withRevenue(1, "2022-01-02", "60000.00", "2022-01-04");

    await simulate(fake, "2022-01-01", "2022-01-05");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 600_000],
            ["2022-01-04", 1_000_000],
            ["2022-01-05", 800_000],
        ],
    );
});

test("retries a rejected charge the next day with everything due so far", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "10000.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-03", "1000.00")
        .rejectingChargesOn(101, "2022-01-03");

    await simulate(fake, "2022-01-01", "2022-01-04");

    assert.deepEqual(fake.chargeAttempts, [
        { today: "2022-01-02", mandateId: 101, amount: 10_000, result: true },
        { today: "2022-01-03", mandateId: 101, amount: 10_000, result: false },
        { today: "2022-01-04", mandateId: 101, amount: 20_000, result: true },
    ]);
});

test("does not complete billing when the final charge is rejected", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "1000.00", fee: "100.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-06", "3000.00")
        .rejectingChargesOn(101, "2022-01-05");

    await simulate(fake, "2022-01-01", "2022-01-07");

    assert.deepEqual(
        fake.chargeAttempts.slice(-2).map((charge) => [charge.today, charge.amount, charge.result]),
        [
            ["2022-01-05", 20_000, false],
            ["2022-01-06", 20_000, true],
        ],
    );
    assert.deepEqual(fake.completions, [{ today: "2022-01-06", advanceId: 1 }]);
});

test("stops billing a fully repaid advance, even if late revenue arrives afterwards", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, total_advanced: "1000.00", fee: "100.00", repayment_percentage: 10 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-09", "3000.00")
        .withRevenue(1, "2022-01-02", "3000.00", "2022-01-08");

    await simulate(fake, "2022-01-01", "2022-01-10");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-02", 30_000],
            ["2022-01-04", 30_000],
            ["2022-01-05", 30_000],
            ["2022-01-06", 20_000],
        ],
    );
    assert.deepEqual(fake.completions, [{ today: "2022-01-06", advanceId: 1 }]);
});

test("starts billing an advance created mid-period from its own repayment_start_date", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, created: "2022-01-10", repayment_start_date: "2022-01-12", total_advanced: "10000.00" })
        .withDailyRevenue(1, "2022-01-01", "2022-01-12", "1000.00");

    await simulate(fake, "2022-01-01", "2022-01-13");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.amount]),
        [
            ["2022-01-12", 10_000],
            ["2022-01-13", 10_000],
        ],
    );
});

test("bills two advances of one customer that share a mandate, each at its own percentage", async () => {
    const fake = new FakeBillingApi()
        .withAdvance({ id: 1, mandate_id: 7, total_advanced: "10000.00", repayment_percentage: 10 })
        .withAdvance({ id: 2, mandate_id: 7, total_advanced: "10000.00", repayment_percentage: 20 })
        .withDailyRevenue(1, "2022-01-01", "2022-01-02", "1000.00");

    await simulate(fake, "2022-01-01", "2022-01-03");

    assert.deepEqual(
        fake.chargeAttempts.map((charge) => [charge.today, charge.mandateId, charge.amount]),
        [
            ["2022-01-02", 7, 10_000],
            ["2022-01-02", 7, 20_000],
            ["2022-01-03", 7, 10_000],
            ["2022-01-03", 7, 20_000],
        ],
    );
});
