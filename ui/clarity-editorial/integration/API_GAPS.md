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

## Proactive advisor branch checklist

Source: `origin/feature/proactive-advisor`, not integrated. Owner noted in branch documentation: Abhijay / advisor team.

1. Merge through the team's reviewed process; then re-audit actual files.
2. Validate dates, finite amounts, categories, unique transaction IDs and authenticated ownership before calling `detect`.
3. Agree on transaction source, snapshot freshness, notification policy and delivered-signal deduplication.
4. Present the detector's evidence and ask the user to confirm the inferred event.
5. Preserve known sparse-history, merchant-matching and month-to-date comparison limits.
6. Route any external next step through the authenticated consent workflow. The branch engine itself cannot execute one.

The disabled UI entry and `FutureAdvisorAdapter` do not imply live monitoring.

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
