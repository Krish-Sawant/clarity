# Clarity AI advisor experience

## Purpose and implementation status

Help a customer move from information to understanding, understanding to
confidence, and confidence to an explicitly approved action. A clean visual
interface is central: customers can inspect their situation, ask questions,
learn unfamiliar terms, and adjust a scenario without losing their place.

This document connects that experience to the existing Clarity code. It is a
build specification, not a claim that the advisor has been implemented.

| Available now | Planned |
| --- | --- |
| Single-debt payoff, extra-payment comparison, savings projections | Advisor chat and grounded explanations |
| Input validation, result statuses, schedules, assumptions | Animated charts and contextual definitions |
| Synthetic React extra-payment slider | Scenario selection and simulated action review |
| Calculation tests | Monte Carlo engine and authorized banking integrations |

## Existing code to reuse

| File/function | Advisor connection |
| --- | --- |
| [`finance.ts`](../finance.ts): `calculateDebt(input)` | Baseline debt summary and monthly balance chart. |
| [`finance.ts`](../finance.ts): `compareExtraPayment(input, extraPaymentCents)` | Current versus proposed payment, payoff curves, months saved, and interest saved. |
| [`finance.ts`](../finance.ts): `calculateSavings(input)` | Later savings-goal experience with contributions, interest, and goal time. |
| [`finance.test.mjs`](../finance.test.mjs) | Regression checks for the shared calculations. |
| [`README.md`](../README.md) | Authoritative input units, validation, status handling, and frontend contract. |

All money is integer USD cents; rates are percentage numbers. The visual layer
and advisor must consume the same engine output. Do not duplicate formulas in
the chat prompt or chart components. Keep calculation code independent of the
LLM provider and UI framework.

## Customer journey

| Stage | Customer experience | Application behavior |
| --- | --- | --- |
| 1. Establish the situation | Enter balances, rates, payments, and a goal, or load a synthetic example. | Validate inputs and identify their origin. Ask for missing required information. |
| 2. Calculate the baseline | See a few readable cards and a balance-over-time chart. | Run `calculateDebt`; show status, totals, assumptions, and calculation evidence. |
| 3. Understand | Ask questions such as why repayment takes so long. | Explain supplied facts and results; use a relevant chart or breakdown. |
| 4. Learn terms | Tap a marked term or highlight a phrase and choose Explain. | Open a contextual definition near the selection, with source information. |
| 5. Explore a change | Adjust extra monthly payment and inspect the changing curve. | Run `compareExtraPayment`; update the chart immediately and explain after the user pauses. |
| 6. Explore uncertainty, later | Ask what happens when specified future inputs vary. | Use a separately specified Monte Carlo tool; show conditional ranges and model assumptions. |
| 7. Compare plans | Keep a scenario and compare its outcome and commitment with another. | Explain tradeoffs against the customer's stated goal and constraints. |
| 8. Review an action | Inspect amount, timing, destination, and intended effect. | Prepare an action preview tied to the selected scenario. |
| 9. Approve and confirm | Approve, edit, or cancel. | For the demo, clearly simulate completion. For future integrations, report success only after provider confirmation. |

Chat is available throughout. Customers can explore the simulator directly
without first completing a conversation.

## First visual experience

Build one debt-advisor screen before adding more products:

- A visible Synthetic example label and three primary summary values: balance,
  regular payment, and estimated payoff duration.
- A chart showing remaining debt against months from now. Keep the baseline
  muted and the proposed plan in one accent color. Label both without relying
  on color alone.
- An extra-payment slider paired with an editable dollar amount. A decorative
  tuning knob is optional; keyboard and precise numeric entry must work.
- Smooth transitions between chart states, respecting reduced-motion settings.
  Readouts update from calculated values, not interpolated animation values.
- Prominent months-saved and interest-saved readouts when available. For
  unavailable results, show a status explanation instead of substituting zero.
- A timeline inspection control showing the exact values for a selected month.
  Include a readable table alternative to the chart.
- A concise advisor explanation after the customer pauses. Do not send a new
  model request for every slider movement.
- Contextual definitions and expandable evidence tags beside relevant claims.
- A Review this plan button opening a clearly labeled simulated action preview.

Use generous spacing, short text, restrained animation, and a consistent accent
color for the proposed scenario. Maintain visible labels, keyboard focus,
associated field errors, and appropriate result announcements.

## State and calculation flow

1. Validate form values and convert dollars to integer cents.
2. Store validated inputs, extra payment, source identifiers, and a scenario
   revision. Keep profile inputs distinct from calculated outputs.
3. Call the engine and create one result snapshot for that revision.
4. Feed that snapshot to cards, charts, comparison readouts, and advisor context.
5. After input settles, request an explanation for that revision. Discard late
   responses for older revisions so chat never describes an obsolete chart.
6. If inputs become invalid, clear or visibly mark previous results as stale.
7. Tie the action preview to the reviewed revision. Changing the amount or
   scenario invalidates the preview and requires a fresh review before approval.

Debt schedule rows start at month 1. Add the supplied initial balance as month 0
for charting. With different payoff durations, end each curve at its own payoff
marker; there is no need to invent additional engine rows. Handle empty
schedules, partial projections, and all statuses documented in the README.

## Advisor behavior and evidence

- Explain what supplied facts and engine outputs mean in plain language.
- Use engine outputs for numeric forecasts and comparisons. If a needed metric
  does not exist, add and validate a tool calculation before presenting it.
- Ask for missing data instead of inventing balances, rates, affordability, or
  customer preferences. Distinguish absent values from explicit zero values.
- Explain a tradeoff before suggesting an action. Extra payment suitability
  requires customer context; the existing engine does not assess affordability.
- Do not present a subjective model confidence score as a financial probability.
  Show forecast assumptions and data limitations instead.
- Do not infer annual interest by multiplying one month's interest by 12 when
  the projected balance changes. Use the appropriate schedule period.
- Actions require a preview and explicit customer approval. An LLM response
  cannot itself establish authorization or successful execution.

| Claim type | Evidence tag contents |
| --- | --- |
| Profile fact | Source record or input field, scenario revision, and date when available; mark synthetic data. |
| Calculated forecast | Function name, inputs, result field or schedule period, calculation version, and assumptions. |
| Educational explanation | Approved reference ID, publisher, URL, and review date. |
| Modeled uncertainty | Model version, varied inputs, distributions and rationale, seed, run count, and interpretation of reported ranges. |

Use a common claim-to-evidence mapping for text and visuals. A general
educational link does not verify a customer-specific balance or payoff forecast.

## Definitions and selected text

Start with a curated glossary covering APR, APY, interest, principal, payoff
time, and monthly contribution. Each entry needs a short definition, contextual
example, source ID, and review date. Longer explanations can be generated from
approved material, but retain the source and distinguish explanation from data.

Tap-to-explain must work without highlighting. Highlight-to-explain is an
additional path for unfamiliar phrases. Keep the explanation near the selection,
preserve reading position, and allow keyboard dismissal and navigation.

## Synthetic demo fixture

Reuse the existing demo profile first:

```ts
const debtInput = {
  balanceCents: 500_000,
  aprPercent: 24,
  monthlyPaymentCents: 15_000,
};
const extraPaymentCents = 10_000;
// compareExtraPayment(debtInput, extraPaymentCents)
```

These are fictional demonstration inputs, not customer records or current bank
product terms. Read payoff and savings figures from the engine instead of
hardcoding them in advisor messages. Ask the customer what extra payment they
can maintain rather than treating this example as an affordability assessment.

Also exercise a payment-too-low scenario, a short projection horizon, an already
paid balance, and invalid form inputs. Existing tests include these behaviors.

## First conversation acceptance cases

| Customer question/action | Required behavior |
| --- | --- |
| Why does this take so long? | Explain interest and principal with a supplied schedule example and evidence tag. |
| What is APR? | Show a concise sourced definition explaining how the engine uses it. |
| What if I pay more? | Expose the control; show engine-derived curves and comparison values. |
| What if I cannot afford the extra amount? | Let the customer reduce it; ask about constraints without assuming affordability. |
| What if I miss an extra payment? | State that the current fixed-payment model does not model this; do not fabricate a forecast. |
| Which plan is best? | Clarify the objective and constraints; explain conditional tradeoffs. |
| Make this payment. | Open a labeled demo action preview; require approval and do not claim a real payment occurred. |

## Reference pack

These are starting references, not a fully reviewed knowledge base. Select
relevant passages and review them before using them as advisor evidence.
The current demo uses USD; confirm jurisdiction and product context before
expanding the educational material or adding institution-specific information.

| Resource | Intended use |
| --- | --- |
| [CFPB: Your Money, Your Goals toolkit](https://www.consumerfinance.gov/consumer-tools/educator-tool/your-money-your-goals/toolkit/) | Educational material for debt, savings, and explaining money decisions. |
| [CFPB: Consumer tools](https://www.consumerfinance.gov/consumer-tools/) | Find relevant consumer explanations; attach specific pages to glossary claims. |
| [CFPB: Credit-card interest calculation](https://www.consumerfinance.gov/ask-cfpb/how-does-my-credit-card-company-calculate-the-amount-of-interest-i-owe-en-51/) | Explain why an issuer's calculation can differ from the monthly planning estimate. |
| [W3C: Forms tutorial](https://www.w3.org/WAI/tutorials/forms/) | Labels, input structure, validation, and feedback. |
| [W3C: Reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) | Respect motion preferences in charts and transitions. |
| [NIST: Monte Carlo tool overview](https://www.nist.gov/services-resources/software/monte-carlo-tool) | Background on input distributions and repeated simulation; not a validated personal-finance model. |

For UI direction, add three to five reference screenshots with notes about
spacing, chart behavior, definitions, and animation. No visual references have
been selected yet. For future bank-specific actions, add verified product terms
and API documentation for the actual institution and jurisdiction.

## Monte Carlo: separate future specification

The existing engine has fixed inputs and no Monte Carlo capability. Before
implementing uncertainty simulation, define:

- The customer question and which inputs vary, such as extra-payment availability.
- Distributions, bounds, dependencies, and evidence or explicit synthetic
  assumptions supporting them. Do not invent real-world likelihoods.
- A model that supports time-varying inputs; wrapping the current engine with
  one randomly chosen fixed payment does not model missed monthly payments.
- Reproducible sampling, run count, convergence checks, and tested aggregation.
- Outcome bands, payoff rates within the horizon, and treatment of unfinished
  paths. Never silently drop unpaid paths from summaries.
- Plain-language descriptions of percentiles and probabilities, conditional on
  the model assumptions. Avoid calling an outcome band guaranteed.
- A separate comparison rule based on the customer's objective and constraints.
  Monte Carlo results do not independently identify a universally best action.

## First milestone: definition of done

- [ ] One debt-advisor screen uses the existing engine and synthetic fixture.
- [ ] Summary, chart, and advisor claims agree on the same scenario revision.
- [ ] Extra-payment adjustments update results and accessible chart details.
- [ ] Glossary definitions and evidence tags are available in context.
- [ ] Invalid, unavailable, zero-month, and partial results have clear states.
- [ ] Assumptions are visible and affordability is not inferred.
- [ ] Scenario review and explicit approval work for a clearly simulated action.
- [ ] No real action, Monte Carlo probability, or bank connection is implied.
- [ ] Existing calculation tests pass; new behavior is verified appropriately
  when implemented.
