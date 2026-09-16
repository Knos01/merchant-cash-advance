interface IBillingApiInterface {
    getAdvances(): Advance[];
    getCustomerRevenuesForDate(customerId: number, forDate: string): number;
    chargeMandate(mandateId: number, amount: string): boolean; 
    setBillingComplete(advanceId: string): void;
}