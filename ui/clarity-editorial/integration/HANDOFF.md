# PR handoff

Suggested title: **Add Clarity editorial learning UI and connect the merged Advisor engine**

The existing frontend includes a framework starter and the now-merged advisor detector/planner; the backend still has no runnable HTTP application. This adds an independent React 19.3.1 / Next.js 16.4.3 / TypeScript app in `ui/clarity-editorial/`. Judges can complete Discover → Learn → Reassess → Future Lab, explore Advisor evidence and confirmed sample-moment plans, inspect calculations and educational sources, and explicitly approve or deny local proposals. The graphite/citron editorial system supports four palettes, sharpness/elevation controls and mobile layouts.

Every product interaction is visibly a local demonstration. The questions, five lessons and nine sources come from the repository fixtures. No Auth0 session, Gemini connection, backend score or external action is claimed. A separately configured public health check cannot enable live mode. The Advisor adapter directly imports the actual merged engine and original synthetic fixture from `frontend/src/lib/advisor/`. No duplicate detector/planner is introduced. API integration proposals remain documented; no existing engine or backend implementation was edited.

## Current validation after the main merge

The earlier UI commit `8020167` passed typecheck, lint, 15 unit tests, a production build and 10 desktop/mobile browser tests. Those historical counts are not the result for this post-merge change.

| Command | Current result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm test` | 25 tests passed, zero failures; includes merged Advisor adapter coverage |
| `npm run build` | Pass; seven experience pages and the app icon generated |
| `npm run test:browser` | 14 tests passed, zero failures, against the combined production build |

Verification covers the original merged engine through a validated adapter: five distinct fixture moments, stable ordering/IDs, known detection limits, planner defaults and invalid-input errors. Browser integration passed evidence → sample-moment confirmation → editable plan → pending goal → the existing consent workflow, together with all original journey cases. The 14 browser cases run at 1440px desktop and 390px mobile against the production build; the full/regression journeys assert clean hydration and no browser errors. Advisor desktop/mobile captures were visually inspected and have no horizontal document overflow. Six unchanged upstream advisor tests also passed without altering frontend dependencies. No authenticated API or live bank source exists to verify.

Original backend baseline: 12 Python modules and five fixtures parsed; in-memory SQLite repository smoke passed. No backend server/test command exists. Frontend lint/build were initially blocked by missing Node/dependencies; original dependency files were preserved. The user-requested `main` merge now also provides the advisor engine's original test file.

## Run

With Node 22+ and npm, from the repository root:

```sh
cd ui/clarity-editorial
npm ci
npm run dev
```

Visit `http://127.0.0.1:3001`. Stop any production preview using that port before launching development. To serve the production build instead, run `npm run build` then `npm run start`. Keep the full repository checkout: the UI build directly imports the sibling merged advisor source/fixture and uses the repository as its build root. The existing frontend app needs no dependency install or running server. No environment values are required. `.env.example` describes the two optional public health-diagnostic values. No backend startup command exists in this checkout; do not guess one.

## Review and submit safely

UI branch: `feat/clarity-editorial-ui`. The first UI implementation is commit `8020167`. On October 24, 2026, the user explicitly requested another `main` pull; `main` at `673608e` merged cleanly as `4554534`. This brought the root README and original advisor engine, fixture, README and tests into the branch. The follow-up UI implementation consumes that merged source and remains scoped to `ui/clarity-editorial/`.

1. Review imported upstream changes separately: `git diff --name-status 8020167 4554534`. They are root `README.md` and the four original advisor files under `frontend/`.
2. Review follow-up UI edits with `git status --short --untracked-files=all`, `git diff --name-status` and `git diff 4554534 --name-status`. New implementation changes must stay under `ui/clarity-editorial/`.
3. Confirm the original application matches the merged upstream: `git diff origin/main -- frontend BackEnd README.md` should be empty. The UI did not author the imported main changes.
4. Run current verification, then stage only `git add ui/clarity-editorial/`. Inspect `git diff --cached --name-status` and `git diff --cached --check` before a scoped commit.
5. Push the feature branch normally and open a PR against the team's current default branch. No force-push, teammate-branch cherry-pick or direct merge to main is required.
6. Re-audit future merged APIs before enabling live services. The debt/savings feature branch remains unmerged; its placeholder stays disabled.

The current `/advisor` demo requires the original sibling source directory in the build context. A standalone archive containing only the UI folder cannot build the direct import; either retain repository layout or propose a reviewed shared-package extraction later.

## UI source manifest

All paths below are relative to the repository root. This lists the UI app, including its original files and new Advisor additions. The separate upstream file scope is described above; original advisor/backend files receive no UI-authored edits.

```text
ui/clarity-editorial/.env.example
ui/clarity-editorial/.gitignore
ui/clarity-editorial/AGENTS.md
ui/clarity-editorial/INTEGRATION_STATUS.md
ui/clarity-editorial/README.md
ui/clarity-editorial/eslint.config.mjs
ui/clarity-editorial/integration/API_GAPS.md
ui/clarity-editorial/integration/CONTRACT_EXAMPLES.md
ui/clarity-editorial/integration/FRONTEND_MIGRATION.md
ui/clarity-editorial/integration/HANDOFF.md
ui/clarity-editorial/integration/REPOSITORY_AUDIT.md
ui/clarity-editorial/next.config.ts
ui/clarity-editorial/package-lock.json
ui/clarity-editorial/package.json
ui/clarity-editorial/playwright.config.ts
ui/clarity-editorial/src/api/advisor.ts
ui/clarity-editorial/src/api/client.ts
ui/clarity-editorial/src/api/contracts.ts
ui/clarity-editorial/src/api/services.ts
ui/clarity-editorial/src/app/[section]/page.tsx
ui/clarity-editorial/src/app/globals.css
ui/clarity-editorial/src/app/icon.svg
ui/clarity-editorial/src/app/layout.tsx
ui/clarity-editorial/src/app/not-found.tsx
ui/clarity-editorial/src/app/page.tsx
ui/clarity-editorial/src/components/clarity-app.tsx
ui/clarity-editorial/src/components/design-controls.tsx
ui/clarity-editorial/src/components/icon.tsx
ui/clarity-editorial/src/data/baseline_questions.json
ui/clarity-editorial/src/data/checkpoint_questions.json
ui/clarity-editorial/src/data/content.ts
ui/clarity-editorial/src/data/lessons.json
ui/clarity-editorial/src/data/sources_fallback.json
ui/clarity-editorial/src/lib/assessment.ts
ui/clarity-editorial/src/lib/finance.ts
ui/clarity-editorial/src/lib/types.ts
ui/clarity-editorial/src/state/demo-store.tsx
ui/clarity-editorial/src/state/design-store.ts
ui/clarity-editorial/src/views/advisor.tsx
ui/clarity-editorial/src/views/approach.tsx
ui/clarity-editorial/src/views/assessment.tsx
ui/clarity-editorial/src/views/future-lab.tsx
ui/clarity-editorial/src/views/learning.tsx
ui/clarity-editorial/src/views/overview.tsx
ui/clarity-editorial/tests/advisor.test.ts
ui/clarity-editorial/tests/advisor.spec.ts
ui/clarity-editorial/tests/core.test.ts
ui/clarity-editorial/tests/journey.spec.ts
ui/clarity-editorial/tsconfig.json
```

`AGENTS.md` in this new app was generated by Next.js and retained. The original `frontend/AGENTS.md` was preserved. `next-env.d.ts`, `.next/`, `node_modules/`, TypeScript cache and `test-results/` are ignored tooling output.
