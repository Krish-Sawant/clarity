# Observed repository contracts

These are actual fixture shapes and Python function contracts, **not HTTP request/response examples**. There is no current route mapping to show. Future URLs must be confirmed from an executable backend/OpenAPI before enabling the live adapter.

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
