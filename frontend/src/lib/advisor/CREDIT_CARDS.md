# Credit card readiness and rewards comparison

Demo route in the **frontend app**: `/credit-cards`. This is not automatically
installed in `ui/clarity-editorial`; import the reusable module there through an
adapter when integrating. The frontend homepage links to the demo.

## Product behavior

1. Analyze three complete calendar months of supplied purchase activity.
2. Ask only three questions: full repayment/first-card plan, recent missed
   payments, and whether the history is complete and representative.
3. Return `not_yet`, `needs_information`, or `compare`. No ranking is returned
   for the first two states, including when a transaction indicates interest or
   a late fee that needs clarification. This is a conservative prototype rule,
   not underwriting or an automatic assertion about a customer's finances.
4. Compare fictional card profiles using annualized net eligible spending,
   category caps, base rewards and annual fees. Show every calculation.
5. A first observed paycheck or existing new-job signal invites confirmation
   and a readiness check. It does not infer a first-ever paycheck or approval.

## Files and integration

| File/export | Purpose |
| --- | --- |
| `credit.ts` / `analyzeCardSpending` | Validated activity window, categorized net spending, coverage and risk evidence |
| `credit.ts` / `compareCardReadiness` | Readiness gate, reward comparison, explanation and source records |
| `credit.ts` / `detectCreditMoment` | Reuses `engine.ts` new-job detection and supports first payroll observed in supplied history |
| `credit-demo.ts` | Fictional fixture, as-of date and coverage start |
| `credit.test.ts` | Arithmetic, gating, history, refund, cap and moment tests |
| `app/credit-cards/preview.tsx` | Interactive demo; accepts transactions, asOf and coveredFrom props |

```ts
import { compareCardReadiness, detectCreditMoment } from '@/lib/advisor/credit';
const result = compareCardReadiness(transactions, '2026-10-24', '2026-07-01', {
  repayment: 'full', // full | carry | first-card | unknown
  missedPayments: 'no', // yes | no | unknown
  historyConfirmed: 'yes', // yes | no | unknown
});
const moment = detectCreditMoment(transactions, '2026-10-24');
```

Transaction inputs follow `engine.ts`: USD dollars, negative purchases and
positive income/refunds, unique IDs, valid ISO calendar dates. Outputs describing
money use integer **cents**; reward rates use basis points (200 = 2%).

Provide the actual data-coverage start, not just the earliest purchase date.
Covered zero-spend months count in the three-month denominator. Unconfirmed or
short history cannot produce a ranking. Explicitly supported purchase category
aliases are in `credit.ts`; unrecognized outflow categories block comparison.
Rent, transfers, payroll, cash withdrawals and debt/card payments do not earn
rewards in this model. Validate and normalize merchant categories upstream.

Positive entries in eligible purchase categories are treated as refunds and
offset that category's spending within the window. Excess refunds floor net
spending at zero and are disclosed. Current-month purchases are not annualized;
current-month interest/late fees still flag readiness. Earlier risk entries in
the three-month window also trigger review; future transactions are ignored.
The six-month missed-payment question covers history the activity window cannot.

## Transparent example

For July–September 2026, the demo has $400/month dining, $150 gas and $100 groceries:

| Fictional profile | Annual rewards | Annual fee | Net before interest/other costs |
| --- | ---: | ---: | ---: |
| Dining-focused: 3% dining, 2% gas, 1% other | $192 | $0 | $192 |
| Flat 2% | $156 | $0 | $156 |
| Annual-fee dining: 4% dining, 2% other | $252 | $95 | $157 |

Dining-focused caps: $12,000/year dining and $6,000/year gas, then 1%.
Annual-fee dining cap: $6,000/year dining, then 2%.
Annual spend is the observed three-month net amount × 4, not a rounded monthly
average × 12. Rewards round to cents once per category; annual fees subtract
after summing. Tied positive net estimates return all tied profile IDs; an
estimate at/below zero is not promoted as a winning profile.

These are not FNB cards, current offers, approval predictions, or comprehensive
market recommendations. No welcome bonuses, interest costs, redemption rules,
merchant coding exceptions or changing future behavior are modeled. Do not
encourage more spending to chase rewards. No application or transfer occurs.

## Sources, AI and RAG status

`CREDIT_SOURCES` provides reviewed educational links and short explanations:

- [CFPB: Grace periods](https://www.consumerfinance.gov/ask-cfpb/what-is-a-grace-period-for-a-credit-card-en-47/)
- [CFPB: Credit cards](https://www.consumerfinance.gov/consumer-tools/credit-cards/)

Sources explain card concepts; they do not verify fictional profile rates.
This feature currently uses deterministic math and static sourced copy. It does
not pretend to call Gemini or a retrieval system. To add live AI later, expose
the returned facts/status/reasons as a server-side tool result; retrieve reviewed
educational passages for explanations and cite their IDs. Keep model keys on
the server. The model must not override `not_yet` or invent live card offers.
New products require verified issuer terms and a separate approved catalog.

## Frontend handoff

- Import the module instead of copying its formulas into the editorial app.
- Show the period, categorized averages, excluded/unknown amounts and evidence.
- Start readiness answers as unknown; never infer repayment from income.
- Show no rewards cards for `not_yet`/`needs_information`.
- In comparison mode show gross rewards, fee, net amount and category breakdown.
- Label educational sources separately from transaction and calculation evidence.
- Preserve limitations and first-card/credit-history uncertainty near results.
- Integration requires a reviewed transaction source and account ownership checks.
  The demo checkbox simulates an interest transaction, not a live feed.

## Run

From `frontend`:

```sh
node --experimental-strip-types --test src/lib/advisor/credit.test.ts
npm run dev
```

Open `/credit-cards` on the printed port. Choose full repayment, no missed
payments, and representative history to compare. Choose carried balance or
toggle the interest-charge example to demonstrate “not yet.”
