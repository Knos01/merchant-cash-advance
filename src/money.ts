export type Cents = number & { readonly __brand: "Cents" };

const AMOUNT_PATTERN = /^(\d+)\.(\d{2})$/;

export const ZERO: Cents = cents(0);

export function parseAmount(amount: string): Cents {
    const match = AMOUNT_PATTERN.exec(amount);
    if (!match) {
        throw new Error(`Invalid amount: "${amount}"`);
    }
    const [, units = "", hundredths = ""] = match;
    return cents(Number(units) * 100 + Number(hundredths));
}

export function formatAmount(amount: Cents): string {
    const hundredths = amount % 100;
    return `${(amount - hundredths) / 100}.${String(hundredths).padStart(2, "0")}`;
}

export function percentageOf(amount: Cents, percentage: number): Cents {
    const scaled = amount * basisPointsOf(percentage);
    if (!Number.isSafeInteger(scaled)) {
        throw new Error(`Amount too large to take a percentage of: ${amount}`);
    }
    return cents(Math.floor(scaled / 10_000));
}

export function sumCents(amounts: readonly Cents[]): Cents {
    return cents(amounts.reduce((total, amount) => total + amount, 0));
}

export function subtractCents(from: Cents, amount: Cents): Cents {
    return cents(from - amount);
}

export function minCents(...amounts: readonly Cents[]): Cents {
    return cents(Math.min(...amounts));
}

function basisPointsOf(percentage: number): number {
    const basisPoints = Math.round(percentage * 100);
    if (basisPoints / 100 !== percentage || basisPoints <= 0 || basisPoints > 10_000) {
        throw new Error(`Unsupported percentage: ${percentage}`);
    }
    return basisPoints;
}

function cents(value: number): Cents {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Not a non-negative whole number of cents: ${value}`);
    }
    return value as Cents;
}
