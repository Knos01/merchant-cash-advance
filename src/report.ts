import { formatAmount, subtractCents } from "./money.ts";
import type { AdvanceBilling } from "./types/index.ts";

export function formatBillingSummary(billings: readonly AdvanceBilling[]): string {
    const header = ["advance", "customer", "mandate", "total", "collected", "remaining", "status"];
    const rows = [...billings]
        .sort((a, b) => a.advance.id - b.advance.id)
        .map((billing) => [
            String(billing.advance.id),
            String(billing.advance.customer_id),
            String(billing.advance.mandate_id),
            formatAmount(billing.total),
            formatAmount(billing.collected),
            formatAmount(subtractCents(billing.total, billing.collected)),
            billing.completed ? "completed" : "in progress",
        ]);

    const widths = header.map((title, column) =>
        Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
    );
    const formatRow = (cells: string[]) =>
        cells.map((cell, column) => cell.padStart(widths[column] ?? 0)).join("  ");

    return [formatRow(header), ...rows.map(formatRow)].join("\n");
}
