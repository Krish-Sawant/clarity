# Integration status

This app is an isolated **React + TypeScript + Next.js demo**. Its source data is copied from the current backend fixtures with attribution. No current product feature is labeled live, and no user identity, Gemini result or external action is fabricated.

## Functional feature matrix

| Feature | Real backend / Local demo / Waiting on branch | Verification | Remaining work |
|---|---|---|---|
| Overview and current journey | Local demo | Build and browser checks recorded in final handoff | Wire authenticated saved progress after route review |
| Eight-question baseline | Local demo from published fixture | Core tests cover scoring, skips, counts and option validation | Official server question/session/scoring APIs |
| Optional habits | Local demo, ungraded | Core tests show habit keys cannot affect score | Protected habit API |
| Learning recommendations | Local demo, missed-domain priority then stated goal | Core tests cover order and advanced-last rule | Adopt returned official plan |
| Four core lessons + advanced lesson | Local demo from all five repository fixtures | Core tests check all lesson/source references | Protected progress/reflection routes |
| Interactive numeric examples | Local deterministic demo | Unit math checks plus browser journey | Reviewed calculation adapter where applicable |
| Tutor explanations | Local sample text, explicitly simulated | Browser loading/response checks recorded in handoff | Gemini server service and verified endpoint |
| Reassessment | Local demo, eight new matched questions | Core tests cover distinct banks, matched concepts, increase, decrease, unchanged | Official comparison endpoint |
| Three Future Lab paths | Local deterministic demo | Core tests check cash conservation, shocks, horizons, cents and deficits | Real simulation endpoint and assumptions |
| Proposals, approval/denial and history | Local demo only | Browser consent journey recorded in handoff | Authenticated action API; no money movement |
| Auth0 | Not connected | Audited dependencies only; no login/session integration | Existing frontend/backend team's reviewed auth flow |
| Public health probe | Optional configured network request only | Mock-transport tests cover HTTP errors/offline/timeout; no real server verified | Provide confirmed URL/path; health does not imply product integration |
| Source library | Bundled actual fixture registry | Core source-reference tests | Source registry endpoint/warehouse integration |
| Debt/savings engine | Waiting on `origin/deterministic-calculations` | Branch inspected read-only | Review merge and cents/status contract |
| Proactive advisor | Waiting on `origin/feature/proactive-advisor` | Branch inspected read-only | Review merge, validate data and confirmed event flow |
| Design preferences | Local browser preferences | Browser theme/mobile checks recorded in handoff | None required for independent demo |

## Verified endpoints

**None.** The current checkout has FastAPI helper imports and repositories but no ASGI application, routers, endpoint schemas, dependency manifest or backend start command. No `/health`, quiz, lesson, progress, tutor, simulation or action path was invented. Unavailable live service methods reject explicitly and cannot silently return demo fixtures.

An operator may configure a separately verified public health URL using the two public environment values in `.env.example`. Any such probe is reachability only. Authenticated product capabilities remain disabled until their contracts and end-to-end behavior are verified.

## Data provenance and storage

- Baseline bank `2026.10.24-b1`, checkpoint bank `2026.10.24-c1`, lesson content `2026.10.24-l1` copied from `BackEnd/api/app/fixtures/` without changing the originals.
- Nine reading sources are copied from `sources_fallback.json`; current demo answers and sample tutor text are transparent local educational records.
- Design preferences may persist locally. Demo journey state is synthetic and stored separately from design preferences; see the app README for persistence controls. There is no production session or local access-token store.
- Knowledge counts measure question performance only. Optional habits and goals are self-reports, not graded behavior change.

## Verification record

Before implementation: 12 Python files passed in-memory syntax parsing, five JSON files parsed, SQLite repository smoke passed in an in-memory database. Existing frontend lint/build initially could not run because Node/npm was unavailable. No committed backend test suite or executable server exists. No existing app files were altered to resolve that baseline environment limitation.

Final verification used Node 22.23.4, Next.js 16.4.3, React 19.3.1 and Google Chrome through Playwright 1.64.1:

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | 15 tests passed, zero failures |
| `npm run build` | Pass; all six experience pages and the app icon generated |
| `npm run test:browser` | 10 tests passed, zero failures, against the production build |

Browser coverage runs at 1440×1000 desktop and 390×844 mobile: the complete 4/8 baseline → lesson → 8/8 reassessment journey, optional habits/skips, tutor loading/error/retry, exact projection values, shocks, proposal denial, explicit approval consent, keyboard/dialog focus, theme persistence, missing-backend errors, corrupted session recovery, invalid financial-input drafts, consent after refresh, and clearing demo data while preserving design preferences. The full journey and direct-load regression assert no page errors or console errors. Tested views fit the viewport without horizontal scrolling. Desktop/mobile overview captures were visually inspected; browser artifacts are ignored under `test-results/`.

HTTP transport tests use synthetic mocked responses, not a shared/live database. Browser journeys use local synthetic records. Mock transport checks do not establish real backend integration. See [the PR handoff and exact file manifest](integration/HANDOFF.md).

## Integration handoff

- [Repository inventory](integration/REPOSITORY_AUDIT.md)
- [Missing capabilities and branch review checklist](integration/API_GAPS.md)
- [Observed fixture/Python contracts](integration/CONTRACT_EXAMPLES.md)
- [Unapplied frontend/backend migration proposal](integration/FRONTEND_MIGRATION.md)

Review only `ui/clarity-editorial/` on `feat/clarity-editorial-ui`. Verify `git status --short` and `git diff --name-status` before a scoped commit. Open a PR against the team's current default branch; do not merge or force-push. Re-audit affected routes after teammate changes, then update this app's adapters and tests through review.
