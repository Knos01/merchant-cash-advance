# Merchant cash advance billing

A command-line simulation of Wayflyer's daily billing for merchant cash advances.
It goes day by day from 2022-01-01 to 2022-02-01, charges each advance a percentage of the customer's previous day's revenue through the billing API, and marks an advance as complete once `total_advanced + fee` has been collected.

## Requirements

- Node.js **22.18 or later** (Node runs the TypeScript files directly, no build step). With nvm: `nvm use`.
- No runtime dependencies. `npm ci` installs only TypeScript, Prettier and Node's type definitions.

## Run

```bash
npm ci
npm test         # type-check + all tests, offline
npm start        # runs the simulation against the real test API
```

> **`npm start` sends real charges to the shared test API.** State is kept in memory, so every run starts again from 2022-01-01 and charges again. Run it once. On my Mac, it took about 15 seconds.

Other scripts: `npm run test:coverage`, `npm run typecheck`, `npm run format` / `format:check`.

## Output

`npm start` prints a summary per advance at the end of the run. Output of the submitted run:

```
Billing 2022-01-01 to 2022-02-01 against https://billing.eng-test.wayflyer.com/v2 (this sends real charges)

advance  customer  mandate      total  collected  remaining       status
      1         1        2   62500.00   62500.00       0.00    completed
      2         1        2  104000.00   32217.73   71782.27  in progress
      3         2        1  314000.00  111568.81  202431.19  in progress
      4         3        4  740000.00    8556.45  731443.55  in progress
      5         4        3   37000.00    6211.21   30788.79  in progress
```

"in progress" at the end is expected since the simulated period is only 32 days.

Advance 4 is the interesting row: it collected 8556.45 of the 54714.33 its revenue implied, because the API rejected the later charges on its mandate. They would have been retried on the following days, but the period ended first.

The API also answered 530 to revenue requests during the run. Those days are asked for again every day and billed once they arrive, as intended.

## How it works

Reading order: `src/main.ts` → `src/simulation.ts` → `src/biller.class.ts` → `test/billing.test.ts`.

Every simulated day, `Biller.runForDay`:

1. Fetches the advances visible on that day and creates the in-memory billing state for any advance it hasn't seen yet.
2. For each advance that has reached its `repayment_start_date` and isn't complete:
    - requests revenue for every day from the day before `repayment_start_date` up to yesterday that hasn't been counted yet, and adds the agreed percentage of each available day to `due`;
    - charges `min(due − collected, total − collected, 10000.00)` once, and adds it to `collected` only if the charge succeeds;
    - calls the `/billing_complete` endpoint when `collected` reaches `total_advanced + fee`.

Late revenue, the daily limit and rejected charges don't need special cases. Late revenue is added to `due` on the day it arrives, while the daily limit and rejected charges leave `due − collected` above zero, so the rest is charged on a later day.
This way, we exactly know how much we collected and what is missing.
It is true that we do not have an history of different charges, but this could be implemented in a later version.

Project layout:

| Path                                     | Responsibility                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `src/main.ts`                            | Runs the simulation againts the real API and prints the summary           |
| `src/simulation.ts`                      | Billing period and the day-by-day loop                                    |
| `src/biller.class.ts`                    | Billing rules and advance state                                           |
| `src/apis/billing-api.class.ts`          | HTTP client: `Today` header, status mapping, errors that name the request |
| `src/money.ts`                           | Integer cents and all the arithmetic on them                              |
| `src/types/index.ts`                     | `Advance` (API shape) and `AdvanceBilling` (per-advance billing state)    |
| `src/dates.ts`                           | `yyyy-mm-dd` dates, UTC only                                              |
| `src/report.ts`                          | End-of-run summary                                                        |
| `test/support/fake-billing-api.class.ts` | In-memory API used by the tests, so we don't need to update/use real data |

## Assumptions

1. **The period includes both 2022-01-01 and 2022-02-01** (32 billing days). Revenue for 2022-02-01 itself is therefore never billed.
2. **The first charge happens on `repayment_start_date` and bills the previous day's revenue.** Revenue for earlier days is not billed. A revenue day that isn't available yet (530) is requested again every day until it arrives. If `repayment_start_date` were before the period, the backlog would be billed from the first day, within the daily limit, assuming nothing had been collected before.
3. **Each day's share is rounded down to the cent**, so a charge never exceeds the agreed percentage. The final charge is capped at the remaining balance, so a completed advance collects exactly `total_advanced + fee`. Percentages may have up to two decimals.
4. **At most one charge per advance per day**, covering everything due so far: recovered late revenue and previously rejected amounts included. **The 10000.00 limit applies per advance**, as the spec says ("against any advance"), so two advances sharing a mandate can be charged up to 20000.00 on that mandate on the same day.
5. **`/billing_complete` is called once**, on the day the balance reaches zero after a successful charge. If the final charge is rejected, it's called on the day the retry succeeds.
6. **Revenue that arrives after an advance is fully repaid is ignored.**
7. **Anything unexpected stops the run:** an HTTP status other than 2xx (or 530 on revenue and charges), no response within 30 seconds, or a malformed amount.
8. **API responses are trusted to match the documented shape**; the `GET /advances` payload isn't validated at runtime.

## Design decisions

- **Integer cents rather than floating-point amounts**, because equality checks like `collected === total` must be exact. `Cents` is a branded type that is only created through `money.ts`, which checks every result.
- **530 returned as a value (`null` / `false`) rather than thrown**, because "revenue not available yet" and "charge rejected" are expected outcomes, not errors.
- **Running totals per advance rather than a log of every revenue share and charge**, because the simulation only needs the balance. In production I'd store charges and revenue shares as rows and derive the balances from them.
- **The billing rules depend on an `IBillingApi` interface**, not on the HTTP client, so the tests can run them against a fake. The simulation creates one client per day, with that day as the `Today` header.
- **Sequential requests**, because the run is short and the order of calls stays predictable.
- **Native TypeScript on Node with `node:test`**, so there's no build step and no test framework.

## Tests

`npm test` runs 31 tests, offline, with 100% line coverage of the billing rules, the API client, money and dates:

- **Billing scenarios** (`test/billing.test.ts`) run against a fake API and assert the exact charges made (day, amount and, where it matters, whether they were rejected) and the completions where relevant: start date, final charge truncation, late revenue, the daily limit (including with late revenue, rejections and a final payment above the limit), retries, completion only after a successful final payment, early full repayment, advances created mid-period and shared mandates. The fake also fails a test if the code asks for today's revenue, charges zero or more than 10000.00, or completes an advance twice.
- **Full period** (`test/simulation.test.ts`) bills the five advances returned by the real API with synthetic revenue, late revenue and rejections, and checks the totals and completions.
- **HTTP client** (`test/billing-api.test.ts`) runs against a local HTTP server: headers, JSON body, 530 handling, other statuses and no response.
- **Money** (`test/money.test.ts`): parsing, formatting, rounding and rejected inputs.

The live API is only exercised by `npm start`.

## What I'd do next

- Send an idempotency key with each charge and persist the billing state, so an interrupted run could resume without charging twice.
- Validate API responses at runtime (Zod or similar).
- Confirm with the business whether the daily limit should apply per mandate rather than per advance (my assumption may be wrong).
- Alert when a revenue day stays unavailable for too long, instead of retrying silently.
