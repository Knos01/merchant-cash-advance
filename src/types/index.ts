import type { Cents } from "../money.ts";

export type Advance = {
    id: number;
    customer_id: number;
    created: string;
    total_advanced: string;
    fee: string;
    mandate_id: number;
    repayment_start_date: string;
    repayment_percentage: number;
}

export type AdvanceBilling = {
    advance: Advance;
    total: Cents;
    owed: Cents;
    collected: Cents;
    revenueDates: Set<string>;
    completed: boolean;
}
