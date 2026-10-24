# Proactive Advisor

Reusable, UI-independent detection and planning logic for synthetic financial activity. No new dependencies are required.

Run checks from `frontend`:

```sh
node --test tests/advisor.test.mjs
npx tsc --noEmit
```

## Integration

```ts
import { detect, plan } from '@/lib/advisor/engine';
import demo from '@/lib/advisor/demo.json';

const nudges = detect(demo.transactions, demo.snapshots, demo.asOf);
const firstPaycheckPlan = plan('new-job', 4800, 3580, 5100, 4);
```

`detect(transactions, snapshots, asOf)` returns signals with stable IDs, a life-moment kind, notification copy, supporting evidence, and an amount. Positive transaction amounts are income; negative amounts are outflows. The explicit as-of date makes the bundled demo reproducible. All five signals fire on the fixture:

- New employer payroll larger than the previous paycheck.
- First payment to a housing merchant of at least $1,500.
- Current-month spending at least 40% above the average of three previous active months, excluding transfers.
- First observed student loan payment.
- Four increasing monthly balance snapshots.

Housing uses an explicitly assigned category; merchant categorization is outside this module. “First” means first in the supplied history. Snapshots are separate inputs, not a reconciled transaction ledger. Sparse history can affect inference; the receiving flow should confirm the moment with the user.

`plan(kind, income, expenses, cash, rate)` validates non-negative finite numbers and a rate from 0 to 100, then returns monthly surplus, an illustrative three-month emergency cushion gap, a proposed monthly savings amount, simple annual interest, moment-specific educational guidance, and action copy. The illustrative savings amount uses half of available surplus, capped at half of the cushion gap when one exists. These are editable planning assumptions, not financial optimization or a transfer instruction.

Call detection when activity arrives, persist signal IDs per authenticated user to prevent duplicate notifications, and pass the selected kind and evidence into the conversation engine. The presentation layer can link emergency-fund guidance to https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/ and loan guidance to https://studentaid.gov/manage-loans/repayment/repaying-101.

This module does not include a UI, scheduler, bank connection, push delivery, notification persistence, conversation service, or action execution. It does not move money or modify authentication. The temporary demo UIs have been removed.
