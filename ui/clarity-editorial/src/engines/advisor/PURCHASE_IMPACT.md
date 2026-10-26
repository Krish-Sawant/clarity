# Purchase Impact Preview

Used by the Purchase preview tab on `/before-you-commit` through `src/api/purchase.ts`.
It supports manual before-purchase exploration and a detected posted-purchase
example. The customer sees the tradeoff without a buy/don't-buy recommendation.

## Engine connection

- `engine.ts`: `detectLargePurchases(transactions, asOf, threshold?, categories?)`
  produces stable `purchase:<transactionId>` signals for current-month purchases.
  Default threshold is $500; default categories are shopping, electronics,
  retail, entertainment and travel. Transfers, positive refunds, future/older
  transactions and duplicate IDs are excluded. Existing `detect` behavior is
  preserved; call both functions when building an activity feed.
- `purchase.ts`: `previewPurchase(input)` runs the existing `sim/project.ts`
  twice with identical contributions and a single month-0 purchase difference.
  It returns both full schedules, goal months, nullable delay, shortfall,
  explanatory copy and assumptions.

All amounts here use **USD dollars**, matching the advisor and generic simulator,
not the integer-cent contract of the separate root `finance.ts` module.

```ts
import { detectLargePurchases } from './engine';
import { previewPurchase } from './purchase';

const result = previewPurchase({
  label: 'TV', purchaseAmount: 1200,
  currentSavings: 3000, targetSavings: 6000,
  monthlyContribution: 600, timing: 'planned', horizonMonths: 120,
});
// baselineMonths=5, purchaseMonths=7, delayMonths=2
```

For a detected transaction, ask the customer to confirm that it was paid from
this goal's savings and whether their supplied balance already includes it.
Use `timing: 'posted'` only when it does. With currentSavings=1800 after a $1200
purchase, the with-purchase path begins at 1800, and the without-purchase
counterfactual begins at 3000. Do not deduct it twice. A card-funded or financed
purchase requires a different debt scenario and is outside this preview.

## Result contract

| Field | Display behavior |
| --- | --- |
| `baselineMonths`, `purchaseMonths` | Goal month including month zero; null means not reached within the horizon. |
| `delayMonths` | Difference when both reach the goal; never convert null to zero. |
| `status` | `delayed`, `unchanged`, `baseline_unreached`, or `purchase_unreached`. |
| `shortfallAmount` | Amount by which purchase exceeds selected savings; display the funding gap. |
| `baseline.points`, `purchased.points` | Full monthly schedules for chart/table; do not invent additional forecasts. |
| `message`, `assumptions` | Neutral explanation with projection assumptions. |

This first version models one immediate purchase, fixed month-end goal
contributions and zero interest. The target is explicit; callers may suggest
three months of expenses, consistent with `plan`, but must confirm it with the
customer. Months are the simulator's resolution: do not claim a precise
six-week delay. Insufficient cash is visible as a negative projected starting
balance and explicit shortfall; borrowing and its costs are not simulated.
Zero contributions, already-met goals and horizon failures are handled.

The demo uses local state only. Production transaction ingestion, account
selection, notification persistence, authentication and payment execution are
separate integration work. Stable signal IDs support deduplication by the caller.

## Verification

From `ui/clarity-editorial`, `npm test` runs every engine test with the app's tests.

Tests cover the $1200 example, posted balances, goal timing, zero/invalid amounts,
shortfalls, horizon exhaustion, detector exclusions and threshold boundaries.
