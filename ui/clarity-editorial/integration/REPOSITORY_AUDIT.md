# Repository inventory and upstream re-audit

## Re-audit after the user-requested main pull — October 24, 2026

The initial inventory below is historical. After the first UI commit `8020167`, the user explicitly requested another `main` pull and verification that the UI works with it. That authorization superseded the original document's restriction against an unsolicited merge for this step.

| Item | Observed current state |
|---|---|
| Repository | `/Users/ramgundapwar/Documents/GitHub/clarity` |
| UI branch | `feat/clarity-editorial-ui` |
| Main/default branch | `main` / `origin/main` at `673608e`; `origin/HEAD → origin/main` |
| Authorized merge | `4554534`, clean merge of `main` into the UI branch |
| Imported upstream files | Root `README.md`; `frontend/src/lib/advisor/{engine.ts,demo.json,README.md}`; `frontend/tests/advisor.test.mjs` |
| Newly usable feature | Actual merged advisor detector and planner; five possible moments on synthetic activity |
| Still unmerged | `origin/deterministic-calculations` debt/savings engine |
| Backend status | No new HTTP app, routes, Auth0 session/BFF or Gemini service; no valid backend launch command |
| UI adaptation | Read-only direct import in `src/api/advisor.ts`, `/advisor` view, evidence/confirmation/editable plan/pending local goal |
| Source dependency | The build needs sibling `frontend/src/lib/advisor/engine.ts` and `demo.json`; a UI-folder-only copy is insufficient |

The merged advisor fixture uses the fixed `asOf: "2026-10-24"`. It is synthetic data, with no bank feed or background scan. The detector/planner are working local source modules, not verified backend endpoints. UI code adds input validation and the user-facing evidence/confirmation/consent steps; it does not modify the original engine or copy its data. All five planner kinds use the same calculation with different explanations.

The merge brought changes outside `ui/` from `main`; subsequent implementation edits are restricted to `ui/clarity-editorial/`. These two scopes must be reviewed separately. Current post-merge verification is recorded in `INTEGRATION_STATUS.md` and `HANDOFF.md`.

## Historical initial inventory — before UI implementation

Audit date: October 24, 2026. This inventory was completed read-only before the first implementation and describes that earlier snapshot.

- Root: `/Users/ramgundapwar/Documents/GitHub/clarity`.
- Original branch: `FrontEnd`, commit `cca3f96`, tracking `origin/FrontEnd` at `dfd9945`, ahead two commits. `git status --short` was empty.
- Default branch: `origin/HEAD → origin/main`, visible ref `bcd75ff`. The original branch contains the earlier main merge; newer README commits are visible on main. No merge was performed during this initial inventory/implementation phase; the later user-authorized merge is recorded above.
- Dedicated new branch: `feat/clarity-editorial-ui`. All implementation files are confined to `ui/clarity-editorial/`.
- Existing top-level application directories are exactly **`frontend/`** and **`BackEnd/`**, with case preserved. There is no established `ui/` app.
- No editorial source ZIP, `Clarity_Edition_02/`, `foundation.css`, or prototype `app.js` was found in the permitted checkout. The supplied Markdown visual specification is the design source. No claim is made to have inspected the absent reference.
- The root README contains only `# clarity` at the starting commit; branch READMEs are not treated as implemented current functionality.

## Existing frontend

`frontend/package.json` declares Next.js `16.4.3`, React/React DOM `19.3.0`, TypeScript, ESLint 9, Tailwind 4, Auth0 SDK, Lucide, Motion, and Recharts. Declared dependencies do not establish working integration. At the initial audit, the page was the Next starter screen. The later `main` merge added the separate advisor library described above.

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, from `frontend/`. Entry points: `src/app/{page.tsx,layout.tsx,globals.css}`. No product journeys, Auth0 BFF/session/login, or backend calls were found. There is no test script. `frontend/AGENTS.md` instructs developers to read installed Next.js docs for its declared version. It was preserved; this new app has its own dependencies and configuration.

## Existing backend

The checkout contains 12 Python modules and five fixture files under `BackEnd/api/app/`. FastAPI is referenced by helper imports, but there is no application entrypoint, router, requirements/pyproject, start script, or OpenAPI document. No HTTP endpoint—including health—can be verified from this tree. No backend start command is available.

| Feature | Current implementation | API / source file | Status | UI integration approach |
|---|---|---|---|---|
| Health / HTTP app | No app factory, ASGI object, or router | None | Missing | Disabled live integration; optional explicitly configured public health probe |
| Assessment | Session, answer and finalization repositories | `BackEnd/api/app/repositories/assessment_repo.py` | Partial | Labeled local grading; future server-authoritative adapter |
| Question banks | Eight baseline and eight distinct matched checkpoint items | `BackEnd/api/app/fixtures/*questions.json` | Fixture data present | Copied demo content with provenance; habits excluded |
| Learning | Five lesson fixtures and plan/progress repositories | `fixtures/lessons.json`, `repositories/learning_repo.py` | Partial | Four core modules plus advanced module; local progress |
| Habits | Ungraded optional self-reports | `repositories/habits_repo.py` | Partial | Separate local habit state; no effect on objective grade |
| Gemini | Environment configuration only | `config.py` | Missing | Local sample tutor labeled as simulated |
| Simulation | Numeric scenario persistence only | `repositories/scenarios_repo.py` | Partial | Local deterministic cash paths and documented shocks |
| Proposals / reminders | Persistence, status and idempotency helpers | `repositories/actions_repo.py` | Partial | Explicit approve/deny of local demo records |
| Activity / privacy | Audit append/list and user cascade-delete helper | `repositories/audit_repo.py` | Partial | Local activity history; no server deletion claim |
| Auth0 | JWKS/RS256 verifier, principal and ownership dependencies | `auth/*.py` | Partial | No fake login; live mode unavailable |
| Sources | Nine curated source fixtures | `fixtures/sources_fallback.json` | Fixture data present | Attributed reading links |
| Public warehouse | Intended DuckDB path in config | `config.py` | Missing | No UI copy of ETL or warehouse |
| Debt / savings engine | Pure TypeScript in remote feature ref | `origin/deterministic-calculations:finance.ts` | Branch-only | Typed unavailable adapter and contract checklist |
| Proactive advisor | Detector/planner in remote feature ref | `origin/feature/proactive-advisor:frontend/src/lib/advisor/` | Branch-only | Disabled entry with honest integration state |

## Data and auth contract findings

SQLite stores private per-user records keyed by a verified `auth0_sub`; foreign-key cascades protect lifecycle integrity. Public DuckDB content is intended to be separate, but its pipeline is absent. Question answer keys are present in server fixtures; future public question responses must omit them.

Auth0 dependencies require a Bearer access token checked for RS256 signature, JWKS key, issuer, audience, expiry, issued-at and subject. A distinct dev-only `X-Fork-Demo-Session` path is enabled only by `DEMO_MODE_ENABLED=true`, accepts 16–64 opaque characters and namespaces synthetic identities under `demo|…`. This app does not invoke that unfinished path. No access token is stored by the UI.

## Historical visible branch work

Refs were inspected with `git branch -avv`, `git log`, `git show`, `git ls-tree` and ancestry checks. No fetch, checkout of teammate branches, cherry-pick, rebase, merge or reset was used in that inventory. The subsequent explicitly requested `main` merge is documented separately above.

- `origin/deterministic-calculations` (`3b5a3fb`) is unmerged. Contains `finance.ts`, `FinanceDemo.tsx`, `finance.test.mjs`, and integration README. Money is integer USD cents; debt uses monthly APR interest, savings uses equivalent monthly APY. Status/null handling must survive future adoption. No endpoint exists.
- At the initial audit, `origin/feature/proactive-advisor` (`95732ad`) was unmerged. Contains five event detectors, illustrative planner, synthetic data and tests. It has no bank feed, scheduler, notification delivery, database or HTTP endpoint. Detector output must be confirmed by the user.

## Baseline verification before implementation

- All 12 Python modules passed `ast.parse` in memory.
- All five JSON fixture files parsed.
- In-memory SQLite smoke passed schema installation, synthetic user/session creation, ownership exclusion, answer upsert/read, habit save, scenario save/list and audit append/list.
- Used `PYTHONDONTWRITEBYTECODE=1`; no private database or Python cache was written.
- Existing frontend lint/build could not run in the initial environment because Node/npm was unavailable. No existing frontend dependency installation or lockfile was changed to work around this.
- There was no existing backend test suite, backend test command, or executable backend server to run. Branch-only tests were inspected, not represented as tests of that snapshot. The advisor module and its test file are now merged, as recorded in the re-audit.
