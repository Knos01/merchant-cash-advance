import assert from "node:assert/strict";
import { test } from "node:test";
import {
    formatAmount,
    minCents,
    parseAmount,
    percentageOf,
    subtractCents,
    sumCents,
    ZERO,
} from "../src/money.ts";

test("parses two-decimal amount strings into whole cents without float error", () => {
    assert.equal(parseAmount("0.00"), 0);
    assert.equal(parseAmount("0.29"), 29);
    assert.equal(parseAmount("19.99"), 1999);
    assert.equal(parseAmount("5363.16"), 536316);
    assert.equal(parseAmount("10000.00"), 1_000_000);
});

test("round-trips amounts through format", () => {
    for (const amount of ["0.00", "0.05", "0.29", "10.50", "5363.16", "740000.00"]) {
        assert.equal(formatAmount(parseAmount(amount)), amount);
    }
});

test("rejects amounts that are negative or not exactly two decimals", () => {
    for (const amount of ["-1.00", "-0.00", "1", "1.5", "1.234", "1,00", " 1.00", "", "abc"]) {
        assert.throws(() => parseAmount(amount), /Invalid amount/, amount);
    }
});

test("rounds a percentage share down to the cent", () => {
    assert.equal(percentageOf(parseAmount("5363.16"), 60), 321789);
    assert.equal(percentageOf(parseAmount("0.09"), 11), 0);
    assert.equal(percentageOf(parseAmount("100.00"), 100), 10000);
});

test("refuses a percentage of an amount too large to compute exactly", () => {
    const tooLarge = parseAmount("90071992547409.91");
    assert.throws(() => percentageOf(tooLarge, 60), /too large/);
});

test("computes percentages with up to two decimals exactly", () => {
    assert.equal(percentageOf(parseAmount("100.00"), 25.5), 2550);
    assert.equal(percentageOf(parseAmount("30.00"), 2.3), 69);
    assert.equal(percentageOf(parseAmount("60.00"), 1.15), 69);
});

test("rejects percentages that are zero, above 100 or have more than two decimals", () => {
    for (const percentage of [0, -5, 100.01, 2.345, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
            () => percentageOf(parseAmount("100.00"), percentage),
            /Unsupported percentage/,
        );
    }
});

test("sums, subtracts and takes the minimum in cents", () => {
    const a = parseAmount("10.10");
    const b = parseAmount("0.20");
    assert.equal(sumCents([]), ZERO);
    assert.equal(formatAmount(sumCents([a, b, b])), "10.50");
    assert.equal(formatAmount(subtractCents(a, b)), "9.90");
    assert.equal(minCents(a, b, parseAmount("10000.00")), b);
});

test("refuses to produce a negative amount", () => {
    assert.throws(() => subtractCents(parseAmount("1.00"), parseAmount("1.01")), /non-negative/);
});
