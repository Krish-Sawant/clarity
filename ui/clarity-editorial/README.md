# Clarity Editorial

An isolated React + TypeScript + Next.js app with Clarity's graphite/citron editorial identity. It implements Discover → Learn → Reassess → Future Lab, an Advisor experience, and inspectable demo action decisions. UI application code, dependencies, tests and integration proposals live in this directory. The Advisor adapter imports the team's merged engine and synthetic fixture from `frontend/src/lib/advisor/` without copying or modifying them.

The app is visibly in **local demo mode**. Quiz banks, five lessons and nine reading sources come from the current repository fixtures. Tutor text is a labeled local sample; simulation uses deterministic math. Auth0, live Gemini, backend scoring and external action execution are not connected. The current backend checkout has no executable HTTP app or verified routes. Advisor detection and planning use the actual TypeScript engine merged into `main`, operating locally on synthetic data; this is separate from a live backend connection.

## Run from the repository root

Prerequisite: Node.js 22 or newer with npm available in your terminal.

```sh
cd ui/clarity-editorial
npm ci
npm run dev
```

Open <http://127.0.0.1:3001>. You do not need to start or install dependencies in the existing `frontend/` app. Keep the repository layout intact: this UI directly imports `../../frontend/src/lib/advisor/engine.ts` and `demo.json` through its adapter. Copying only `ui/clarity-editorial/` out of this repository will omit those source dependencies. Next.js build/development configuration must include the repository root for that read-only import.

For a production build, from the same directory:

```sh
npm run build
npm run start
```

The production server also uses port 3001. Stop a running development server before starting the production server on that port.

On the implementation machine, Node/npm was initially missing. Verification used the temporary Node 22 runtime at `/tmp/node-v22.23.4-darwin-arm64/bin`. If it is still present, the current terminal can use it with:

```sh
export PATH="/tmp/node-v22.23.4-darwin-arm64/bin:$PATH"
```

That temporary path is not a persistent project prerequisite. Keep a normal Node.js 22+ installation available for ongoing development.

## Environment and backend

No `.env.local` file is needed for the complete local demo. `.env.example` contains only optional **public connection diagnostics**:

```dotenv
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_API_HEALTH_PATH=
```

Leave both blank unless the backend owner supplies a confirmed public health URL/path. Neither a health route nor product endpoints are guessed. If configuring them, copy `.env.example` to `.env.local` inside this app, set both values, and restart development or rebuild production. Next.js freezes `NEXT_PUBLIC_*` values into the production browser build. Use HTTPS for remote origins, or HTTP on localhost; do not embed credentials, queries or secrets.

The health check omits credentials, times out and reports actual failures. A successful check establishes public reachability only; it does not enable Auth0 or live product capabilities. Unavailable live operations reject explicitly without substituting fixture success.

There is **no valid backend launch command in the current checkout**. `BackEnd/api/app/` contains configuration, auth dependencies, repositories and fixtures, but lacks an ASGI application/routers and dependency manifest. Backend additions are described in the integration proposals below; no unrelated backend file was changed to make the demo run.

## Try the journey

1. Start at Overview. Begin Discover, or deliberately choose the labeled synthetic sample journey.
2. Answer or skip eight knowledge questions; move back to revise answers. Optional habit choices and your stated goal do not alter the objective knowledge score.
3. Open the learning plan. Missed topics come first, with your stated goal breaking ties. Explore four core lessons and the additional advanced resilience lesson, change a numerical exercise, and request a clearly labeled sample tutor explanation.
4. Reassess with eight different questions matched to the same concepts. Compare correct counts and topic counts; unchanged scores are valid. A quiz comparison does not establish changed financial behavior.
5. In Future Lab, edit synthetic income/cost/cash inputs, switch 6/12/24 months and apply an income interruption, repair or rent increase. Inspect exact balances and assumptions beneath the chart.
6. Open Advisor at `/advisor`. Review the five possible moments detected from the bundled synthetic history as of October 24, 2026. Inspect evidence, confirm a sample moment, edit the planning assumptions, and review the resulting local calculation. An optional savings proposal enters the same consent flow as other local goals.
7. Propose a sample goal or reminder. Inspect its details; explicitly approve or deny it. Approval records a local decision only and sends no notification, transfer or external instruction.
8. Open the design controls to change Citron, Tidal, Iris or Coral, edge radius and elevation. Try a mobile viewport and keyboard navigation.

## Persistence

- Demo quiz answers, lesson/exercise progress, sample simulation inputs and local consent/history records use this tab's `sessionStorage` key `clarity-editorial:demo:v1`. They survive refresh in the tab and are distinct from any production data/session.
- Design preferences use `localStorage` key `clarity-editorial:design:v1` so palette/radius/elevation can survive future visits.
- The reset control clears the demo journey while preserving design preferences. If browser storage is unavailable, the UI keeps working in memory and explains the persistence limit.
- No access token, Gemini key, Auth0 secret, bank connection or production user record is stored by this app.

## Verification

From `ui/clarity-editorial/`:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

`npm test` covers matched banks, grading/skips/habits, recommendations, source references, cash-path conservation/shocks/horizons, precision, debt outcomes, API errors, and the merged Advisor adapter. Browser tests use Playwright at 1440px desktop and 390px mobile, with synthetic session records and no shared backend database.

The checked-in Playwright configuration uses installed Google Chrome by default and starts a local development server, or reuses the app on port 3001. Set `PLAYWRIGHT_CHROME_EXECUTABLE` to a local Chrome/Chromium executable if the default channel is unavailable. Stop any older preview before testing changed source against a production build.

**Post-merge verification passed:** 25 unit tests and 14 desktop/mobile browser tests, zero failures. Typecheck, lint and the production build also passed. Browser checks cover the combined production build, including direct Advisor hydration, evidence and confirmation, the original planner's calculations, invalid input handling, deficits and the existing explicit proposal-consent workflow. Desktop/mobile layouts were visually inspected. See [the handoff](integration/HANDOFF.md) for the verification record. Mock transport checks do not establish live backend integration.

The baseline backend checks parsed all 12 Python modules and five fixtures and exercised SQLite repositories only in memory. The original frontend had no committed tests at the initial audit; the latest `main` merge now includes the advisor engine's own test file. Original frontend lint/build were blocked at baseline by missing Node/npm and dependencies; the UI did not change its dependency files.

## Financial assumptions

Future Lab carries integer USD cents month by month: `cash = previous cash + income − rent − transportation − spending − shock costs`. Intention reduces spending by up to $200/month; flexible housing reduces rent by up to $300/month, never below zero. Shocks apply equally to all paths: one lost income month in month 2; a $1,500 repair once in month 2; or $150 higher rent each month from month 2 onward. Negative cash is a funding gap. Interest, fees, taxes, moving costs, inflation and investment returns are excluded.

The debt lesson illustrates fixed APR/12 monthly interest rounded to cents, followed by a fixed payment, with a 1,200-month limit. It reports no payoff date when payment cannot reduce principal. This limited demo is separate from the unmerged teammate finance engine.

## Advisor assumptions and source dependency

The user-authorized `main` pull integrated `673608e` into this branch at merge commit `4554534` on October 24, 2026. It supplied the original advisor engine, its README, synthetic fixture and tests, plus the root project README. The new UI adapter and view consume that merged work; they do not recreate its detector/planner or copy its fixture.

`detect` returns possible `new-job`, `moving`, `overspending`, `student-loan` and `idle-cash` signals. They require user confirmation and can reflect sparse history, merchant matching, unusual payments or month-to-date comparisons rather than real life events. The demo always scans the fixture's `asOf: "2026-10-24"`; it does not pretend to monitor today's bank activity.

All five moment kinds use the same planning arithmetic with different educational copy. With sample defaults of $4,800 monthly take-home income, $3,580 expenses, $5,100 cash and an assumed 4% annual rate, the engine returns $1,220 surplus, a $5,640 gap to its illustrative three-month cushion, a $610 monthly suggestion, and $204 simple annual interest before taxes. The rate is an assumption, not an account offer or an APY compounding calculation. No transfer, notification, bank connection or background scan occurs.

## Integration and PR handoff

- [Integration matrix and verified scope](INTEGRATION_STATUS.md)
- [Read-only repository inventory](integration/REPOSITORY_AUDIT.md)
- [API gaps and branch review contracts](integration/API_GAPS.md)
- [Actual fixture and Python contracts](integration/CONTRACT_EXAMPLES.md)
- [Unapplied migration proposal](integration/FRONTEND_MIGRATION.md)
- [PR handoff and exact file manifest](integration/HANDOFF.md)

Work is isolated on `feat/clarity-editorial-ui`. Review `git status --short`, `git diff --name-status` and the new directory before committing. Stage only `ui/clarity-editorial/`; its `.gitignore` excludes dependencies, build/test artifacts, caches and environment files. Open a reviewed PR against the team's current default branch after verification. The latest `main` merge was explicitly requested by the user and is recorded above. Remaining UI implementation edits stay inside this directory; imported changes to `README.md` and `frontend/src/lib/advisor/` came from `main`. Push normally and open a reviewed PR when ready; do not force-push. Re-audit newly merged APIs before enabling live capabilities.
