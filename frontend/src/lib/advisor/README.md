# Proactive Advisor

## Credit card readiness

See [Credit Card Readiness](CREDIT_CARDS.md) for transaction-based reward
comparisons, repayment checks, paycheck nudges, and the `/credit-cards` demo.
The profiles are illustrative; live issuer recommendations and AI/RAG are not connected.

## Purchase Impact Preview

See [Purchase Impact Preview](PURCHASE_IMPACT.md) for the large-purchase detector,
shared-simulator calculation contract, and interactive `/purchase-impact` demo.

**Clarity · Core Feature 2 · Built by Abhijay**

A reusable engine that detects possible life moments in financial activity and produces timely nudges with transparent planning calculations.

[Clarity project overview](../../../../README.md)

## What this feature does

Instead of waiting for a user to ask a financial question, the detector scans supplied transactions and balance snapshots for changes worth discussing. Each signal includes notification copy and the evidence behind it, so a future guided flow can ask the user to confirm what happened.

For example, a larger paycheck from a new employer can produce:

> “Looks like you may have started a new job. Want to plan your first paycheck? Takes 3 minutes.”

This implementation contains the detection and planning logic. Production UI, conversation integration, background monitoring, and notification delivery remain separate work.

## Detection rules

| Signal kind | Implemented rule | Intended next conversation |
| --- | --- | --- |
| `new-job` | A positive `payroll` transaction in the current month comes from an employer not seen in earlier months and exceeds the latest earlier payroll amount. Employer matching ignores case. Requires earlier payroll history. | Confirm a job change; discuss the first paycheck, budget, employer benefits, and emergency savings. |
| `moving` | A current-month `housing` outflow of at least $1,500 goes to a merchant with no housing payments in earlier months. Merchant matching is exact. | Confirm a move and review deposits, moving costs, and the ongoing budget. |
| `overspending` | Current-month outflows are at least 40% above the average of the three most recent earlier months with spending. Excludes the `transfer` category and requires three baseline months. | Separate one-time costs from recurring spending and consider a budget reset. |
| `student-loan` | A negative `student_loan` transaction appears in the current month with no earlier-month payment in that category. | Confirm repayment has begun and review required payments, savings, and extra repayment options. |
| `idle-cash` | The latest four distinct monthly balance snapshots strictly increase. Uses the latest snapshot within each month. These months need not be consecutive. | Confirm upcoming bills and explore an accessible, interest-earning savings account. |

Transaction-based signals are limited to the month of the supplied `asOf` date. Future-dated transactions and snapshots are ignored. The idle-cash rule uses the latest eligible snapshots and does not require one in the current month.

## Files

| File | Purpose |
| --- | --- |
| [engine.ts](engine.ts) | Exported types, detection rules, and planning calculations |
| [demo.json](demo.json) | Synthetic transaction history, balance snapshots, and a fixed as-of date |
| [advisor.test.mjs](../../../tests/advisor.test.mjs) | Six automated tests for signals, boundaries, and planner validation |

No additional dependencies are required beyond the existing frontend development dependencies.

## Run the tests

From the repository root:

```sh
cd frontend
npm ci
node --test tests/advisor.test.mjs
```

The bundled demo produces all five signal kinds as of October 24, 2026. Tests cover repeat scans, input ordering, empty and pre-event histories, repeat employers and loan payments, the spending threshold, transfer exclusion, balance dips, and planner validation.

## Use the engine

Inside the frontend TypeScript application:

```ts
import { detect, plan } from '@/lib/advisor/engine';
import demo from '@/lib/advisor/demo.json';

const nudges = detect(demo.transactions, demo.snapshots, demo.asOf);

const paycheckPlan = plan(
  'new-job', // Moment the user has confirmed
  4800,      // Monthly take-home pay
  3580,      // Monthly expenses, including required debt payments
  5100,      // Accessible cash
  4,         // Illustrative annual savings rate, in percent
);
```

### Inputs

```ts
type Transaction = {
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;     // Positive income, negative outflow
  merchant: string;
  category: string;  // e.g. payroll, housing, student_loan, transfer
};

type Snapshot = {
  date: string;      // YYYY-MM-DD
  balance: number;
};
```

Callers must provide valid dates, finite transaction amounts, consistent categories, and unique transaction IDs. The detector does not perform runtime schema validation or merchant categorization. Balance snapshots are supplied separately; they are not calculated from the transaction fixture.

### Nudge output

`detect(transactions, snapshots, asOf)` returns an array of:

```ts
type Nudge = {
  id: string;
  kind: 'new-job' | 'moving' | 'overspending' | 'student-loan' | 'idle-cash';
  title: string;
  message: string;
  evidence: string;
  amount: number;
};
```

IDs are derived from the signal kind plus a transaction ID, month, or snapshot date. They remain stable across identical scans; callers can persist them to suppress duplicate notifications. Each rule emits at most one signal per scan.

`amount` means the triggering transaction’s absolute amount for job, moving, and loan signals; spending above baseline for overspending; and the latest balance for idle cash. It is not a proposed transfer amount.

## Planning calculations

`plan(kind, income, expenses, cash, rate)` returns:

| Field | Calculation or meaning |
| --- | --- |
| `surplus` | `max(0, income - expenses)` |
| `gap` | `max(0, expenses × 3 - cash)`; an illustrative three-month emergency cushion gap |
| `monthly` | Half of surplus, capped at half of the gap when the gap is positive; rounded to whole dollars |
| `interest` | `round(cash × rate / 100)`; simple annual interest before taxes |
| `explanation` | Moment-specific educational guidance |
| `action` | Suggested action copy for the user to review |

For the example inputs, the result is **$1,220 monthly surplus**, a **$5,640 cushion gap**, and an illustrative **$610 monthly savings action**. The interest illustration is **$204 per year**. The entered rate is an assumption, not a live account offer.

The planner rejects negative or non-finite numeric inputs and rates outside 0–100. All moment kinds use the same savings calculation with different educational explanations. It does not optimize retirement contributions, rank debt versus investing, estimate taxes, or execute transfers.

## Connect it to the app

1. Load activity for the authenticated user and validate its input schema.
2. Call `detect` when new activity is available.
3. Store previously delivered signal IDs per user and apply a notification policy.
4. Display a nudge with its evidence and ask the user to confirm the inferred moment.
5. Collect current financial inputs, call `plan`, and explain its assumptions.
6. Present a next step for review and route any execution through an authenticated action workflow.

The module itself has no database, scheduler, delivery service, or conversation service. It does not store user decisions. Temporary demo UIs used to exercise the flow were removed from the branch.

Educational links for the presentation layer:

- [CFPB: Building an emergency fund](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/)
- [Federal Student Aid: Repayment basics](https://studentaid.gov/manage-loans/repayment/repaying-101)

## Demo limitations

“First” and “new” mean first observed within the supplied history. Sparse history, changing merchant names, payroll bonuses, irregular expenses, or stale balance snapshots can produce misleading signals. Spending compares month-to-date activity with full earlier monthly totals, rather than an elapsed-day adjustment.

Use signals as prompts for confirmation. Planning outputs are educational illustrations based on caller-supplied assumptions. This feature does not connect to a bank or move money.
