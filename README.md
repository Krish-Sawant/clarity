# Clarity deterministic calculations and frontend requirements

Pure TypeScript calculations plus a React component for an existing Next.js app.
No LLM, external API, credentials, or extra runtime dependencies.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `finance.ts` | Shared calculation functions, validation, schedules, and assumptions. |
| `finance.test.mjs` | Automated calculation tests. |
| `FinanceDemo.tsx` | Example React extra-payment slider using synthetic inputs. |
| `README.md` | Frontend integration contract and required result handling. |

## Calculations provided

### Debt payoff: `calculateDebt(input)`

For each month, calculate `Math.round(openingCents * aprPercent / 100 / 12)`
interest, then subtract the fixed payment. Cap the final payment at the balance
plus interest. Return the payoff time, interest, payments, remaining balance,
monthly schedule, status, and assumptions.

### Extra-payment comparison: `compareExtraPayment(input, extraPaymentCents)`

Run debt payoff for the regular payment and for the regular payment plus the
extra monthly amount. Return `baseline`, `accelerated`, `monthsSaved`, and
`interestSavedCents`. Both savings fields are null unless both scenarios pay off.

### Savings goal: `calculateSavings(input)`

Convert APY to an equivalent monthly rate: `(1 + apyPercent / 100) ** (1 / 12) - 1`.
The implementation uses `expm1` and `log1p` for numerical precision. Each month,
round interest on the opening balance to cents, then add the monthly contribution.
The final contribution is not capped at the target, so the final balance may exceed it.

## Frontend input requirements

Call the exported functions for results; keep calculation logic in `finance.ts`.
Label every amount in USD and distinguish annual APR from annual APY.

| Screen | UI field | Function argument | Required/default |
| --- | --- | --- | --- |
| Debt/comparison | Current debt balance | `balanceCents` | Required |
| Debt/comparison | Annual APR (%) | `aprPercent` | Required |
| Debt/comparison | Regular monthly payment | `monthlyPaymentCents` | Required |
| Comparison | Extra monthly payment | Second argument `extraPaymentCents` | Required; UI may initialize to 0 |
| Savings | Current savings | `currentCents` | Required |
| Savings | Savings target | `targetCents` | Required |
| Savings | Monthly contribution | `monthlyContributionCents` | Required |
| Savings | Annual APY (%) | `apyPercent` | Optional; defaults to 0 |
| Both | Projection limit in months | `maxMonths` | Optional; defaults to 1200 |

- Accept dollar amounts with at most two decimal places; validate them before
  converting to integer cents. For a validated numeric amount use
  `Math.round(dollars * 100)`. For example, $150.25 becomes `15025`.
- Pass percentage values directly: 24% APR is `24`, not `0.24`.
- Do not convert a blank required input to zero. Show a field error for blank,
  nonnumeric, nonfinite, negative, or over-limit input.
- Money arguments must be safe integers from 0 through `1_000_000_000_000` cents.
  For comparison, regular plus extra payment must also stay within this limit.
- Rates must be finite numbers from 0 through 1000; `maxMonths` must be an integer
  from 1 through 1200. These are engine limits, not suggested financial values.
- Catch `RangeError` and show a readable validation/calculation error. Clear or
  mark stale results when inputs are invalid so old results do not look current.

## Frontend output requirements

Format money using `Intl.NumberFormat` with USD after dividing cents by 100.
Show durations in months, and check status before displaying payoff or goal claims.

| Result | Fields to display |
| --- | --- |
| Debt | `monthsToPayoff`, `totalInterestCents`, `totalPaymentsCents`, `remainingCents` |
| Comparison | Baseline and accelerated debt results side by side, then `monthsSaved` and `interestSavedCents` when available |
| Savings | `monthsToGoal`, `finalBalanceCents`, `totalContributionsCents`, `totalInterestCents` |

| Function/status | Required UI behavior |
| --- | --- |
| Debt: `paid_off` | Show payoff duration and full projected totals. Zero months means already paid off. |
| Debt: `payment_too_low` | Explain that the payment does not reduce the balance and needs increasing. Do not claim a payoff date. |
| Debt: `horizon_exceeded` | Explain that payoff was not reached within `maxMonths`; label totals as partial projections. |
| Savings: `goal_reached` | Show duration and totals. Zero months means the goal is already met. |
| Savings: `no_progress` | Explain that contributions and rounded interest do not increase the balance. |
| Savings: `horizon_exceeded` | Explain that the goal was not reached within `maxMonths`; label totals as partial projections. |

- A null duration or savings value means unavailable. Display an explanatory
  message or dash; do not substitute zero. A real numeric zero is a valid result.
- If only the accelerated scenario pays off, show that scenario's payoff result,
  but leave comparison savings unavailable.
- Debt `schedule` rows contain `month`, `openingCents`, `interestCents`,
  `paymentCents`, and `closingCents`. Savings rows contain `month`,
  `interestCents`, `contributionCents`, and `closingCents`.
- Use returned schedules for charts or tables. Rows begin at month 1; add an
  explicit month-0 opening balance if a chart needs one. Empty schedules are valid.
- Display returned `assumptions` with results, for example in an expandable panel.
  Label projections as estimates and distinguish synthetic examples from user data.
- Associate labels and field errors with inputs. Make sliders keyboard accessible
  and announce updated summaries with an appropriate live region.

## Frontend acceptance checklist

- [ ] Debt and savings forms pass validated inputs using the units above.
- [ ] Editing a valid input recalculates the relevant result.
- [ ] Debt and extra-payment results show the required totals and durations.
- [ ] Savings results show goal time, balance, contributions, and interest.
- [ ] Every status above has a visible state; null values never become zero.
- [ ] Already paid debt and already met goals display zero months correctly.
- [ ] Invalid inputs show errors without crashing or leaving misleading results.
- [ ] Assumptions and estimate wording are visible with the results.
- [ ] Any chart uses the returned schedule rather than a separate formula.

The current demo only implements the extra-payment slider. Its balance ($5,000),
APR (24%), and regular payment ($150) are hardcoded; its extra payment starts at
$100. Replace those constants with validated form inputs for the full interface.
The demo's null-to-zero savings fallback is safe only for its fixed payable
profile; use the status and null handling above when generalizing it.
Debt input forms, savings UI, and charts still need to be implemented by the
frontend team. Multi-debt allocation, avalanche/snowball comparisons, budget
affordability checks, and payment execution are outside the current engine.

## Connect to Next.js

Copy `finance.ts` and `FinanceDemo.tsx` into the same directory, for example
`src/components/finance/`. Import the demo in your App Router page:

```tsx
import FinanceDemo from '@/components/finance/FinanceDemo';
export default function Page() { return <FinanceDemo />; }
```

Adapt the alias/path to your app. The calculation module can also be imported
by a server route. Validation throws RangeError; catch it in an API route and
return a 400 response instead of exposing a server error.

## Run the calculation tests

Node 22.13 or newer:

```sh
node --experimental-strip-types --test finance.test.mjs
```

The demo component requires your existing React/Next.js project. Its slider uses
synthetic data and only calculates estimates; it does not initiate payments.

## Contract for teammates

- All money is integer USD cents: $5,000 = 500000.
- Rates are percentages: 24 means 24%, not 0.24.
- Debt uses APR/12 monthly interest with cent rounding, then a month-end payment.
- Savings converts APY to an equivalent monthly rate; deposits occur at month end.
- Default horizon is 1200 months. A null payoff/goal time means no completed
  projection, not zero months. Check status before displaying a result.
- Interest/months saved are null unless both debt scenarios reach payoff.
- Show assumptions with results. These are planning estimates, not issuer statements.
- Money inputs are capped at 1e12 cents, rates at 1000%, horizons at 1200 months;
  these are technical limits, not product terms or suitability judgments.
- A too-low payment returns immediately; totals/schedule only cover simulated months.

## Verification basis and limits

Hand-computed test cases verify monthly interest, partial final payments,
cash conservation, zero rates, APY conversion, unreachable outcomes, and invalid inputs.
Credit cards often use daily/average daily balances, so matching a real card
requires issuer terms, statement dates, transactions, payment timing, and APR buckets.
Savings uses monthly rounding rather than any specific bank's daily accrual method.
Rates are fixed inputs, not current FNB rates. No fees, taxes, changing minimum
payments, rate changes, promotional APRs, or new borrowing are modeled.

CFPB references:
- https://www.consumerfinance.gov/ask-cfpb/how-does-my-credit-card-company-calculate-the-amount-of-interest-i-owe-en-51/
- https://www.consumerfinance.gov/ask-cfpb/what-is-a-daily-periodic-rate-on-a-credit-card-en-46/

Next extension: multiple debts with fixed total payment budget, explicit minimum
payment rules, and rollover when a debt is paid. Agree that input contract with
your team before adding avalanche/snowball comparison.
