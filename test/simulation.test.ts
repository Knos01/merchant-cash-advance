import assert from "node:assert/strict";
import { test } from "node:test";
import type { Advance } from "../src/types/index.ts";
import { Biller } from "../src/biller.class.ts";
import { addDays } from "../src/dates.ts";
import { sumCents } from "../src/money.ts";
import { END_DATE, runSimulation, START_DATE } from "../src/simulation.ts";
import { FakeBillingApi } from "./support/fake-billing-api.class.ts";

test("bills every day from 2022-01-01 to 2022-02-01, both included", async () => {
    const days: string[] = [];

    await runSimulation(
        { runForDay: async (_api, today) => void days.push(today), getBillings: () => [] },
        () => new FakeBillingApi().forDay(START_DATE),
    );

    assert.equal(days.length, 32);
    assert.equal(days[0], START_DATE);
    assert.equal(days.at(-1), END_DATE);
});

test("bills the advances returned by the real API for the whole period without breaking any billing rule", async () => {
    const advances: Advance[] = [
        {
            id: 1,
            customer_id: 1,
            mandate_id: 2,
            created: "2022-01-02",
            total_advanced: "60000.00",
            fee: "2500.00",
            repayment_start_date: "2022-01-05",
            repayment_percentage: 60,
        },
        {
            id: 2,
            customer_id: 1,
            mandate_id: 2,
            created: "2022-01-07",
            total_advanced: "100000.00",
            fee: "4000.00",
            repayment_start_date: "2022-01-09",
            repayment_percentage: 16,
        },
        {
            id: 3,
            customer_id: 2,
            mandate_id: 1,
            created: "2022-01-10",
            total_advanced: "300000.00",
            fee: "14000.00",
            repayment_start_date: "2022-01-10",
            repayment_percentage: 17,
        },
        {
            id: 4,
            customer_id: 3,
            mandate_id: 4,
            created: "2022-01-18",
            total_advanced: "700000.00",
            fee: "40000.00",
            repayment_start_date: "2022-01-24",
            repayment_percentage: 11,
        },
        {
            id: 5,
            customer_id: 4,
            mandate_id: 3,
            created: "2022-01-14",
            total_advanced: "35000.00",
            fee: "2000.00",
            repayment_start_date: "2022-01-16",
            repayment_percentage: 8,
        },
    ];
    const dailyRevenueByCustomer: Record<number, string> = {
        1: "5000.00",
        2: "50000.00",
        3: "200000.00",
        4: "50000.00",
    };

    const fake = new FakeBillingApi();
    for (const advance of advances) {
        fake.withAdvance(advance);
    }
    for (const [customerId, amount] of Object.entries(dailyRevenueByCustomer)) {
        fake.withDailyRevenue(
            Number(customerId),
            addDays(START_DATE, -1),
            addDays(END_DATE, -1),
            amount,
        );
    }
    fake.withRevenue(1, "2022-01-12", "5000.00", "2022-01-16")
        .rejectingChargesOn(2, "2022-01-10")
        .rejectingChargesOn(3, "2022-01-20");

    const biller = new Biller();
    await runSimulation(biller, (today) => fake.forDay(today));
    const billings = biller.getBillings();

    assert.equal(billings.length, advances.length);
    for (const mandateId of new Set(advances.map((advance) => advance.mandate_id))) {
        const charged = fake.chargeAttempts.filter(
            (charge) => charge.mandateId === mandateId && charge.result,
        );
        const collected = billings.filter((billing) => billing.advance.mandate_id === mandateId);
        assert.equal(
            sumCents(charged.map((charge) => charge.amount)),
            sumCents(collected.map((billing) => billing.collected)),
            `mandate ${mandateId}`,
        );
    }
    for (const billing of billings) {
        assert.ok(
            billing.collected <= billing.total,
            `advance ${billing.advance.id} over-collected`,
        );
        assert.equal(
            billing.completed,
            billing.collected === billing.total,
            `advance ${billing.advance.id}`,
        );
    }
    assert.deepEqual(fake.completions, [
        { today: "2022-01-25", advanceId: 1 },
        { today: "2022-01-25", advanceId: 5 },
    ]);
});
