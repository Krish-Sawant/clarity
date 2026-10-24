# Integration gaps and review owners

No live product HTTP route is present in this checkout. The names below describe **needed capabilities**, not existing URLs. `src/api/contracts.ts` specifies the UI boundary; `src/api/services.ts` rejects unavailable operations without making requests or returning fixture success.

| Capability needed | Required input / output | Suggested reviewer | Current UI state |
|---|---|---|---|
| Public health/capabilities | JSON health status plus server capabilities and version | API team | Only probes an explicitly configured, confirmed health path |
| Auth0 session / BFF | Server-held session and access token; verified API audience; protected user routes | Auth/frontend team | Live integration unavailable; no login impersonation |
| Assessment start/resume | Stage and baseline link → owned session, versioned public questions without answer keys | Assessment/API team | Local demo banks |
| Answer / finalize | Session + question + selected option/null → authoritative finalized count, domain/concept counts | Assessment/API team | Local demo grading, never called official |
| Habits | Optional self-reports stored independently from assessment | Assessment/API team | Optional ungraded local choices |
| Learning plan / completion | Owned baseline → ordered lessons; validated exercise/reflection → saved progress | Learning/API team | Local recommendation from missed domains and stated goal |
| Gemini tutor | Lesson ID + bounded intent → attributed explanation, source/model metadata, usage/error states | Gemini/API team | Explicit local sample explanations |
| Progress comparison | Owned baseline/checkpoint → matched concepts, counts, caveats | Assessment/API team | Local matched eight-concept comparison |
| Simulation | Validated numeric assumptions + shock/horizon → authoritative schedule and assumptions | Simulation/API team | Deterministic local USD-cents cash paths |
| Action proposal / decision | Inspectable payload + idempotency; separate explicit authorized approval/denial | Actions/auth team | Local proposal records only |
| Activity history | Authenticated owner → bounded events without secrets/raw answers | API team | Session-only demo events |
| Source registry | Curated source IDs, URLs, provenance/content versions | Content/data team | Bundled current fixture registry |

## Merged proactive advisor: local integration and remaining gaps

Source: `frontend/src/lib/advisor/engine.ts` and `demo.json`, merged into `main` at `673608e` and this UI branch at `4554534` on October 24, 2026, following the user's explicit pull request. Owner noted in source documentation: Abhijay / advisor team.

The UI now imports the original engine and fixture directly through `src/api/advisor.ts` and exposes `/advisor`. No duplicate algorithm or fixture was copied. `AdvisorAdapter` in `src/api/contracts.ts` represents this working local capability; it is separate from `ClarityBackend` HTTP capabilities, which remain false.

The adapter validates actual calendar dates, finite bounded USD amounts, nonempty text, category shape and unique transaction IDs. The fixture scan uses its fixed October 24, 2026 as-of date. The view presents all five possible moments, evidence and explicit sample-moment confirmation before an editable plan. A proposed goal remains pending until approved or denied in the existing local consent workflow.

Remaining production work:

1. Provide an authenticated activity source and ownership checks. Synthetic fixture support does not establish a bank connection.
2. Agree on snapshot freshness, categorization, notification policy and per-user delivered-signal deduplication. Stable detector IDs are not a delivery service.
3. Retain event confirmation and disclose sparse-history, exact merchant matching and month-to-date comparison limits.
4. Keep the same heuristic planning contract explicit: all five moments share one savings calculation, with different educational explanations. Rates are assumptions, and the interest field is simple annual interest before taxes.
5. Route any future external effect through a verified authenticated action API. The engine has no scheduler, database, notification delivery or transfer execution.
6. Preserve the repository source dependency. Deployments must build with the sibling `frontend/src/lib/advisor/` files; a UI-folder-only archive is insufficient.

Post-merge verification of the adapter and page is recorded separately in `INTEGRATION_STATUS.md` and the handoff; historical pass counts do not prove this integration.

## Deterministic finance branch checklist

Source: `origin/deterministic-calculations`, not integrated. Reviewer: calculation owner / frontend team.

1. Adopt only after review and updated ancestry audit. The branch was not copied into this UI.
2. Preserve integer-cent money contract and percentage APR/APY inputs.
3. Cover `paid_off`, `payment_too_low`, `horizon_exceeded`, `goal_reached`, `no_progress`; null durations remain unavailable, never zero.
4. Use returned schedules for all charts and show calculation assumptions.
5. Confirm payment-affordability and API ownership requirements separately; this pure engine executes no transfers.

Local lesson debt examples are a distinct limited demo calculation. Their label and documentation must remain explicit until the reviewed engine replaces that adapter.

## Auth, CORS and production changes requiring separate review

Configure the existing API's Auth0 domain/audience and the team's Next server session flow. If browser origins or CSRF policy need changes, submit a separate backend PR; this UI does not broaden CORS, disable auth or send demo identity headers. The public health probe omits credentials and rejects redirects. Production quiz scoring and answer keys stay server-side. No secrets belong in `NEXT_PUBLIC_*` values.
