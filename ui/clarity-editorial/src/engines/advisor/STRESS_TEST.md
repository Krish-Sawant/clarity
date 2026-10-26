# Stress test

Used by the stress test on `/future-lab` through `src/api/stress.ts`.

Import `stressTest` and `STRESS_LABELS` from this directory. The function wraps the existing `sim/project.ts` engine. Inputs are USD dollars, with at most two decimals: available savings, monthly take-home income, total monthly expenses, and monthly rent already included in expenses. The optional horizon is 1–120 months (default 24).

Events are mutually exclusive: `baseline`, `job-loss` (all entered income stops for the horizon), `car-repair` ($2,000 cash cost immediately), and `rent-rise` (10% of rent added to monthly expenses). No borrowing, interest, benefit payments, reemployment or automatic actions are assumed.

Render baseline and stressed timelines on the same axes with an explicit zero line. Negative values mean unmet funding needs. `firstZeroMonth` means cash is exhausted, while `firstShortfallMonth` is the first monthly balance below zero. Null means not observed within the horizon, never “safe forever.” Month 0 is now. Exact-zero balances are not shortfalls. Monthly netting cannot establish exact days of runway or intramonth overdrafts.

`minimumExtraSavings` is the additional starting cash needed to avoid negative cash during this particular horizon; it is not an optimal emergency fund or financial recommendation. Render preparation text, assumptions, input labels, accessible scenario buttons, and an exact-values table alongside the chart. Do not describe these deterministic scenarios as probabilities or AI predictions.

The page uses editable synthetic inputs. Production adapters must confirm account coverage and avoid double-counting rent, card repayments and underlying purchases. Preserve user inputs when switching scenarios; reset is explicit. No API key or live AI/RAG is needed.

Tests: `stress.test.ts`, run by `npm test` in `ui/clarity-editorial`.

## Custom scenarios

The /my-plan page supports a label, signed monthly income and expense changes, a one-time cost, start month and duration. Month 1 is next month. Changes stop after the duration; the cost occurs once in the start month. Resulting income and expenses cannot be negative. The description is a label, not AI interpretation. Custom inputs are temporary exploration state, not changes to the saved plan. Presets remain shortcuts.
