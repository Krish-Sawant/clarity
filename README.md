# Clarity deterministic calculations and frontend requirements

Pure TypeScript calculations plus a React component for an existing Next.js app.
No LLM, external API, credentials, or extra runtime dependencies.

## AI advisor experience

The [evaluation harness](evaluation/README.md) provides 12 shared evaluation
cases, independent calculation fixtures, response scoring for conditions A/B/C,
human-review rubrics, and a participant-study template. Start with
`node --experimental-strip-types evaluation/run.mjs engine`.

See [the recorded evaluation results and frontend handoff](docs/EVALUATION_RESULTS.md)
for both completed pilots: required-fact checks and AI-reviewed explanation
quality, with source JSON mappings and presentation requirements.

See [the advisor experience plan](docs/AI_ADVISOR_EXPERIENCE.md) for the customer
journey, visual simulation requirements, connections to this calculation engine,
educational references, and the first implementation milestone. This is a design
and integration specification; chat, animated charts, Monte Carlo simulation,
and banking actions are not implemented yet.

## Hackathon experience: rehearse a money decision

Clarity helps customers practice a decision, understand its consequences, and
choose a next step. The signature experience is an interactive repayment
timeline connected to an advisor: explore a plan, try a disruption, understand
the tradeoff, and review a simulated action.

The features below are planned. The existing calculation engine supports fixed
payment comparisons; the full advisor experience still needs implementation.

| Feature | Customer interaction | Implementation needed |
| --- | --- | --- |
| Two possible futures | Adjust an extra-payment slider and see current and proposed payoff curves side by side, with months and interest saved. | Use `compareExtraPayment` and its schedules; add animated charts and editable dollar input. |
| Life happens cards | Apply a hypothetical event to a selected month and inspect the revised timeline. | Extend the deterministic engine to support explicit monthly payment changes and test the results. |
| Explain this change | Tap a changed chart segment or result to learn what changed and why. | Ground the explanation in the selected scenario's calculation outputs and show evidence tags. |
| Shared chart and chat selection | Select a month to discuss it, or ask a question that highlights the relevant chart section. | Share selected month, scenario revision, and relevant result fields between chart and advisor. |
| Definitions in context | Tap a marked term or highlight a phrase to open a short explanation. | Add a sourced glossary, contextual explanations, and accessible popovers. |
| Keep this plan | Save the chosen scenario for review and inspect a proposed next action. | Show amount, timing, destination, and assumptions; require explicit approval for a clearly labeled simulated action. |

### Life happens: first disruption and future extensions

Start with **Skip this month's extra payment**. The regular monthly payment
continues; only the extra amount is removed for the selected month. This does
not represent missing a required payment or model late fees or penalties.

Later cards can reduce extra payments for three months or add a one-time payment.
An unexpected-expense card must ask whether the expense reduces money available
for repayment or adds new debt. Those require different calculation behavior.

Represent events as explicit scenario inputs and calculate the revised schedule
in code. The current fixed-payment engine cannot model these events accurately
by averaging payments or changing chart points. The advisor explains results
returned by the extended engine; it does not calculate the forecast itself.

These are customer-controlled hypothetical events, with no claimed probability.
Prioritize this interaction ahead of Monte Carlo for the first demo. Monte Carlo
remains a later feature requiring a justified uncertainty model, as described
in the advisor experience plan.

### Demo sequence

1. **Here is your current path:** load clearly labeled synthetic data and show
   the baseline balance, payment, interest, and estimated payoff time.
2. **What if you paid a little more?** Adjust the extra-payment control; animate
   the proposed curve and update the calculated savings.
3. **Could you keep this up?** Select a month and skip its extra payment using
   a Life happens card. Allow the event to be removed or reset.
4. **Here is what that changes:** compare the revised outcome with the original
   proposal and baseline. Explain the selected change with calculation evidence.
5. **Keep this plan:** review the scenario and explicitly approve a simulated
   next action. Do not imply a real transfer or payment has occurred.

### Feature acceptance requirements

- Chart, summary, and chat use the same scenario revision and calculated values.
- A disruption creates a distinct scenario so the customer can compare and undo it.
- The extended engine verifies event timing, balance conservation, final payment
  capping, and events after payoff before disruption forecasts are displayed.
- Selecting a month exposes its exact schedule values; an explanation references
  those values rather than inventing amounts or outcomes.
- Evidence distinguishes synthetic inputs, calculated projections, and sourced
  educational explanations. Affordability is not inferred from payoff results.
- Animations respect reduced-motion settings; controls support keyboards, and
  charts have readable values or a table alternative.
- All existing status and null-handling rules below also apply to revised plans.
- Changing a selected scenario invalidates its previous action preview and
  requires a fresh review before approval.

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
