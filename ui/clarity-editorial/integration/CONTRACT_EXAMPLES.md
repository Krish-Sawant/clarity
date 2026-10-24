# Observed repository contracts

These are actual fixture shapes, Python repository contracts and the merged TypeScript advisor contract, **not HTTP request/response examples**. There is no current route mapping to show. Future URLs must be confirmed from an executable backend/OpenAPI before enabling the live adapter.

## Published assessment content

Source: `BackEnd/api/app/fixtures/baseline_questions.json`, bank `2026.10.24-b1`.

```json
{
  "id": "bq-budget-surplus",
  "version": "1",
  "domain": "budget",
  "concept_id": "cash_flow_surplus",
  "difficulty": 1,
  "points": 1,
  "prompt": "Your monthly take-home pay is $3,600 and your total monthly expenses are $2,850. How much remains before any new savings or spending?",
  "options": [{"id":"a","text":"$650"},{"id":"b","text":"$750"},{"id":"c","text":"$850"},{"id":"d","text":"$6,450"}],
  "source_ids": ["cfpb-budgeting-blog", "fdic-money-smart"]
}
```

The fixture also has an answer key, explanation and mathematical check. They are deliberately omitted from this public-shape example. Bundled demo content contains the key for transparent local scoring; a future live public-question response must omit it.

The checkpoint fixture uses `pairs_with: "bq-budget-surplus"`, `concept_id: "cash_flow_surplus"`, same difficulty/points, and a new $4,200 − $3,350 scenario. All eight current concepts have one-to-one matches.

## Assessment persistence

Observed Python calls, from `repositories/assessment_repo.py`:

```python
create_session(conn, owner_sub=verified_sub, stage="baseline", mode="full",
               bank_version="2026.10.24-b1", question_ids=[...])
upsert_answer(conn, session_id=sid, question_id=qid, question_version="1",
              concept_id=concept, selected_option_id="b", elapsed_ms=12000)
get_session(conn, sid, verified_sub)
finalize_session(conn, session_id=sid, owner_sub=verified_sub,
                 result=server_computed_result, correctness=server_computed_flags)
```

`create_session` generates `as_<uuid>` and returns stored fields with decoded `question_ids` and `result`. Ownership filters are already used in reads. Finalization is atomic and allowed only once. These helpers do not validate public request bodies or calculate official scores; those services/routes are missing.

## Learning fixture

`lessons.json` content version is `2026.10.24-l1`. Five lesson records contain ID/version/domain/concept IDs/title/minutes/hook, sourced definition/facts, worked example, exercise, reflection, simulator preset and offline tutor. Example exercise:

```json
{
  "type": "budget_allocator",
  "prompt": "Move the sliders. Can you free up $300 more for goals by changing only VARIABLE spending?",
  "params": {"income":3600,"fixed":1650,"variable":900,"other":300,"goals":0,"variable_min":300,"variable_max":1500,"goals_max":1200}
}
```

Learning repository methods `get_plan`, `save_plan`, `record_reflection`, `mark_complete` and `completed_lesson_ids` accept a verified owner; no HTTP transport or official recommendation algorithm exists.

## Errors and identity

`errors.py` intends responses shaped as:

```json
{"error":{"code":"not_authenticated","message":"Authentication required.","details":null}}
```

This requires installing its handlers into a real FastAPI app, which is absent. `get_principal` intends either verified Auth0 Bearer credentials or an explicitly enabled dev-only opaque demo header. A raw browser-provided user ID is never a valid substitute.

## Proposal persistence

Observed `actions_repo.create` arguments: owner, kind, title, summary, payload, idempotency key, summary source and expiry. It creates status `pending`. `set_status_if_pending` provides atomic decisions; `create_reminder` writes a **demo reminder** row. No bank or external messaging action is implemented. Routes still need ownership, expiry, payload validation and consent enforcement.

## Merged advisor detection and planning

Source: `frontend/src/lib/advisor/engine.ts` and original `demo.json`, now present through `main` at `673608e`, merged into the UI branch by `4554534`. The UI imports those files directly; the algorithm and fixture remain owned by the original module.

```ts
type Transaction = {
  id: string;
  date: string;       // YYYY-MM-DD
  amount: number;     // USD: positive income, negative outflow
  merchant: string;
  category: string;
};
type Snapshot = { date: string; balance: number };
type Moment = "new-job" | "moving" | "overspending" | "student-loan" | "idle-cash";

detect(transactions: Transaction[], snapshots: Snapshot[], asOf: string): Nudge[];
plan(kind: Moment, income: number, expenses: number, cash: number, apr: number);
```

A nudge has `{ id, kind, title, message, evidence, amount }`. Its amount describes the triggering transaction, excess spending or latest cash snapshot; it is not a transfer instruction. `detect` returns possible moments and performs no runtime input schema validation. The UI's `src/api/advisor.ts` adds calendar-date, finite-amount, category/text and duplicate-ID validation before invoking it. Future authenticated ownership must be enforced by an actual data service.

The original synthetic fixture has `asOf: "2026-10-24"`. Running it through the detector yields all five kinds. Its scan date remains fixed so the demonstration is reproducible; it is not live monitoring. The UI displays evidence and requires confirmation of a sample moment before planning.

Actual planner example:

```ts
plan("new-job", 4800, 3580, 5100, 4);
// Numeric fields:
// { surplus: 1220, gap: 5640, monthly: 610, interest: 204, ... }
```

| Field | Observed implementation |
|---|---|
| `surplus` | `max(0, income - expenses)` |
| `gap` | `max(0, expenses * 3 - cash)` |
| `monthly` | `round(min(surplus, gap || surplus) * 0.5)` |
| `interest` | `round(cash * apr / 100)`; simple annual interest before taxes |
| `explanation`, `action` | Educational copy and a proposed action string |

All five moment kinds share this arithmetic and vary the explanatory text. The annual percentage is an assumed rate, not a live account quote or compounded APY. The UI adapter uses the field name `annualRate` and maps it to the engine's `apr` positional argument. Plan inputs are non-negative USD amounts; rates must be finite and within 0–100. The adapter additionally validates the moment and bounds USD amounts to $1,000,000,000.

`AdvisorAdapter.getSignals()` and `getPlan()` expose this local module to the UI. They are not HTTP calls and do not enable any `ClarityBackend` capability. Proposal creation remains a separate local state operation; the existing Approach consent flow records approval or denial without transfers, bank activity, notification delivery or background scheduling.
