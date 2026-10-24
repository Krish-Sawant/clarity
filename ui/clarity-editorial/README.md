# Clarity Editorial

An isolated React + TypeScript + Next.js app with Clarity's graphite/citron editorial identity. It implements Discover → Learn → Reassess → Future Lab and inspectable demo action decisions. All application code, dependencies, tests and integration proposals live in this directory. Existing `frontend/` and `BackEnd/` files are preserved.

The app is visibly in **local demo mode**. Quiz banks, five lessons and nine reading sources come from the current repository fixtures. Tutor text is a labeled local sample; simulation uses deterministic math. Auth0, live Gemini, backend scoring and external action execution are not connected. The current backend checkout has no executable HTTP app or verified routes.

## Run from the repository root

Prerequisite: Node.js 22 or newer with npm available in your terminal.

```sh
cd ui/clarity-editorial
npm ci
npm run dev
```

Open <http://127.0.0.1:3001>. The existing `frontend/` uses its own independent setup; you do not need to start it for this demo.

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
6. Propose a sample goal or reminder. Inspect its details; explicitly approve or deny it. Approval records a local decision only and sends no notification, transfer or external instruction.
7. Open the design controls to change Citron, Tidal, Iris or Coral, edge radius and elevation. Try a mobile viewport and keyboard navigation.

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

`npm test` runs 15 unit tests covering matched bank integrity, grading/skips/habits, recommendations, source references, cash-path conservation/shocks/horizons, precision, debt outcomes and API failures. **15 passed, 0 failed** in the implementation run.

Browser tests use Playwright at 1440px desktop and 390px mobile. The checked-in configuration uses an installed Google Chrome by default and starts the local development server automatically, or reuses an app already running at port 3001. Set `PLAYWRIGHT_CHROME_EXECUTABLE` to a local Chrome/Chromium executable if the default channel is unavailable. Browser tests use synthetic session records and do not touch a shared backend database. Final verification against the production build passed **10 browser tests, 0 failures**, including clean direct-load hydration, validation, consent, keyboard focus and persistence. Typecheck, lint and production build also passed. See [the handoff](integration/HANDOFF.md); passing mock-transport tests does not establish live backend integration.

The baseline backend checks parsed all 12 Python modules and five fixtures and exercised SQLite repositories only in memory. The existing frontend could not be linted/built before implementation because Node/npm was unavailable; its files and lockfile were preserved.

## Financial assumptions

Future Lab carries integer USD cents month by month: `cash = previous cash + income − rent − transportation − spending − shock costs`. Intention reduces spending by up to $200/month; flexible housing reduces rent by up to $300/month, never below zero. Shocks apply equally to all paths: one lost income month in month 2; a $1,500 repair once in month 2; or $150 higher rent each month from month 2 onward. Negative cash is a funding gap. Interest, fees, taxes, moving costs, inflation and investment returns are excluded.

The debt lesson illustrates fixed APR/12 monthly interest rounded to cents, followed by a fixed payment, with a 1,200-month limit. It reports no payoff date when payment cannot reduce principal. This limited demo is separate from the unmerged teammate finance engine.

## Integration and PR handoff

- [Integration matrix and verified scope](INTEGRATION_STATUS.md)
- [Read-only repository inventory](integration/REPOSITORY_AUDIT.md)
- [API gaps and branch review contracts](integration/API_GAPS.md)
- [Actual fixture and Python contracts](integration/CONTRACT_EXAMPLES.md)
- [Unapplied migration proposal](integration/FRONTEND_MIGRATION.md)
- [PR handoff and exact file manifest](integration/HANDOFF.md)

Work is isolated on `feat/clarity-editorial-ui`. Review `git status --short`, `git diff --name-status` and the new directory before committing. Stage only `ui/clarity-editorial/`; its `.gitignore` excludes dependencies, build/test artifacts, caches and environment files. Open a reviewed PR against the team's current default branch after verification. No merge, force-push or teammate-branch cherry-pick is needed to run or review this app. After teammates merge new APIs, re-audit the affected routes and update this app's adapter/tests through review.
