# Reviewed integration proposal (not applied)

The new app is self-contained React + TypeScript + Next.js. Existing `frontend/`, `BackEnd/`, root configuration, CI and teammate branches remain untouched. Keep it independently runnable until a reviewed migration is agreed.

## Proposed sequence

1. Review this branch and its isolated build, accessibility, journey tests and integration map. Open a PR against the current default branch. Do not merge a teammate's active feature branch into it unilaterally.
2. Let the backend team expose and test an app entrypoint, health/capabilities, official assessment/scoring and existing ownership-protected persistence. Record real routes and payloads in `CONTRACT_EXAMPLES.md`.
3. Implement the team's existing Auth0 server session/BFF approach in a separate reviewed change. Keep access tokens server-held; protect user-specific requests; verify audience/issuer in the API. This UI has no fake login path.
4. Add route mappings only to `src/api/services.ts`, runtime DTO validation at the adapter boundary, and contract tests for success, expiry, unauthorized, ownership, timeout and server errors.
5. Enable live mode per capability only after an actual authenticated end-to-end check. A public health response establishes reachability only; it does not enable product endpoints or Auth0.
6. When desired, port this app's views/components into the existing `frontend/src/app/` on a separate PR. Review styling tokens, dependencies and Next configuration first. This document does not authorize that migration now.
7. After reviewed merges of calculation/advisor work, re-audit those exact modules and update only UI adapters/tests on this branch. Preserve their units, status outcomes and known limitations.

## Proposed backend additions

The API team should choose route names. Needed handlers wrap the existing assessment, learning, habits, scenario, actions and audit repositories; apply current principal/ownership dependencies; validate DTOs; keep answer keys and official scoring server-side; and install structured error handlers. Gemini tutor needs an actual server service with key handling, bounded prompts, attribution and explicit error metadata. No client-side Gemini key or direct provider request is proposed.

If a separate UI development origin requires CORS or cookies, review an exact allowed-origin/credentials/CSRF policy in the backend PR. No wildcard policy, bypass header or auth relaxation is included here.

## Local configuration boundary

`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_HEALTH_PATH` are optional **public** values for a deliberately configured health check only. Leave both blank for the isolated demo. No path is guessed; do not use sensitive credentials in either value. The transport permits HTTPS or localhost HTTP, omits credentials and refuses redirects. A successful health request never switches the product to live mode.

## Financial model to retain or replace explicitly

All local cash-path calculations use integer cents internally. For each month:

`closingCash = openingCash + income − rent − transportation − spending − shockCosts`.

The intention path subtracts up to $200 from spending; the housing path subtracts up to $300 from rent, never below zero. A job-loss preset removes exactly one full monthly income in month two; repair subtracts $1,500 once in month two; rent rise subtracts $150 each month from month two onward. Month zero is included. Deficits are shown as negative balances, not clipped away. There is no interest, investment return, tax, inflation, moving cost or behavior prediction in these illustrations.

The lesson debt example rounds monthly interest to cents using opening balance × APR / 100 / 12, applies a fixed payment, caps the last balance at zero and stops after 1,200 months. A payment at or below interest returns no payoff date. This is separate demo math, not adoption of the unmerged finance module.
