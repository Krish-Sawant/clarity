# PR handoff

Suggested title: **Add isolated Clarity editorial learning experience in React and Next.js**

The existing frontend is a framework starter and the current backend has no runnable HTTP application. This adds an independent React 19.3.1 / Next.js 16.4.3 / TypeScript app in `ui/clarity-editorial/`. Judges can complete Discover → Learn → Reassess → Future Lab, inspect calculations and educational sources, and explicitly approve or deny local proposals. The graphite/citron editorial system supports four palettes, sharpness/elevation controls and mobile layouts.

Every product interaction is visibly a local demonstration. The questions, five lessons and nine sources come from the repository fixtures. No Auth0 session, Gemini connection, backend score or external action is claimed. A separately configured public health check cannot enable live mode. API and branch integration proposals are documented without modifying the existing application.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm test`: 15 passed, zero failed.
- `npm run build`: passed; six app pages and icon generated.
- `npm run test:browser`: 10 passed, zero failed against the production build, 1440px desktop and 390px mobile.
- Tested full journey, matched scoring/skips/habits, interactive exercises, tutor failure/retry, exact simulator balances/shocks, consent, reset, persistence, keyboard focus, no horizontal overflow, clean direct-load hydration and no browser errors in the full/regression journeys.
- Baseline backend verification: 12 Python modules parsed, five fixtures parsed and in-memory SQLite repository smoke passed. No existing frontend test suite exists; existing lint/build were blocked at baseline by missing Node/dependencies. Existing dependency files were preserved.
- Final tracked diff under `frontend/` and `BackEnd/` is empty. All new reviewable files are under this app. No secrets, dependencies, build output or browser artifacts are included.

## Run

With Node 22+ and npm, from the repository root:

```sh
cd ui/clarity-editorial
npm ci
npm run dev
```

Visit `http://127.0.0.1:3001`. Stop any production preview using that port before launching development. To serve the production build instead, run `npm run build` then `npm run start`. No environment values are required. `.env.example` describes the two optional public health-diagnostic values. No backend startup command exists in this checkout; do not guess one.

## Review and submit safely

UI branch: `feat/clarity-editorial-ui`, created from the original clean `FrontEnd` checkout at `cca3f96`. This handoff describes that audited source snapshot. Teammates may advance `main` independently; no newer upstream work is merged as part of the UI commit. The UI source, tests and documentation are scoped entirely to `ui/clarity-editorial/`.

1. Review the new files listed below and the integration gap documents.
2. Run `git status --short --untracked-files=all`, `git diff --name-status` and `git diff -- frontend BackEnd`. Confirm only the UI app is new and the preserved paths have no changes.
3. If ready to submit, stage only `git add ui/clarity-editorial/`, then inspect `git diff --cached --name-status` and `git diff --cached --check`.
4. Make a scoped commit, push this feature branch normally, and open a PR against the team's current default branch (`main` at audit time). Have teammates review API/auth proposals separately. Do not merge or force-push as part of this task.
5. After teammate API work is reviewed and merged, re-audit the affected current contracts and update only the UI adapter and relevant UI tests. No dependency on an unfinished teammate branch is required.

## Exact added-file manifest

All paths below are relative to the repository root. No existing tracked file was modified.

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
ui/clarity-editorial/src/views/approach.tsx
ui/clarity-editorial/src/views/assessment.tsx
ui/clarity-editorial/src/views/future-lab.tsx
ui/clarity-editorial/src/views/learning.tsx
ui/clarity-editorial/src/views/overview.tsx
ui/clarity-editorial/tests/core.test.ts
ui/clarity-editorial/tests/journey.spec.ts
ui/clarity-editorial/tsconfig.json
```

`AGENTS.md` in this new app was generated by Next.js and retained. The original `frontend/AGENTS.md` was preserved. `next-env.d.ts`, `.next/`, `node_modules/`, TypeScript cache and `test-results/` are ignored tooling output.
