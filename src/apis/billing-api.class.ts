import type { Advance } from "../types/index.ts";

interface IBillingApiInterface {
    getAdvances(): Promise<Advance[]>;
    getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<number>;
    chargeMandate(mandateId: number, amount: string): Promise<boolean>; 
    setBillingComplete(advanceId: string): Promise<void>;
}

export class BillingApi implements IBillingApiInterface {
   private baseUrl = "https://billing.eng-test.wayflyer.com/v2";
   
   async getAdvances () {
     console.log("here")
     const response = await fetch(`${this.baseUrl}/advances`);
     const body = response.json();

     console.log(body);
     return body as any;
   }

   async getCustomerRevenuesForDate(customerId: number, forDate: string): Promise<number> {
     const response = await fetch(`${this.baseUrl}/customers/${customerId}/revenues/${forDate}`);

     const body = response.json();
     console.log(body);
     return body as any;
   }

   async chargeMandate(mandateId: number, amount: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/mandates/${mandateId}`, {
        method: "POST",
        body: JSON.stringify(amount)
    });

     const body = response.json();
     console.log(body);
     return body as any;
   }

   async setBillingComplete(advanceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/advances/${advanceId}/billing_complete`, {
        method: "POST",
    });

     const body = response.json();
     console.log(body);
     
   }
}