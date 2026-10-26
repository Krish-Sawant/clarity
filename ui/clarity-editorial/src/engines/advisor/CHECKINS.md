# Save the Raise and Plan Check-Ins

Used by plan check-ins on `/calculators` through `src/api/checkins.ts`.

`saveTheRaise` compares monthly take-home totals and requires recurring-income confirmation. The default savings share is 50%, configurable from 0–100%. It never initiates transfers. The demo asks for approval before selecting a plan.

`checkIn` accepts a fixed original plan and consecutive complete months of actual net savings changes and dining spending, all in dollars. Negative savings changes are withdrawals. Never double-count transfers between included accounts or infer net savings solely from income minus categorized spending. Production adapters must verify coverage and avoid duplicate months. The original plan remains fixed; adjustments are suggestions, not automatic changes.

The demo uses explicit synthetic monthly records and resets on reload. It does not persist a plan or load real account activity. Production integration needs authenticated plan storage, monthly reconciliation, and user approval for changes.

Goal timing is monthly, assuming future saving returns to the original planned rate. Do not convert this to claims about exact weeks. Dining overspending does not prove why savings diverged.

The implementation does not claim research validation or reproduce the original Save More Tomorrow intervention. Verify the original Thaler/Benartzi paper and its scope before adding research claims to the pitch.
