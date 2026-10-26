<div align="center">

<img src="public/branding/clarity-logo.png" alt="Clarity logo" width="96" />

# Clarity

### A little knowledge. A different future.

Financial learning, proactive guidance, and interactive simulations to help people understand their next money decision.

**HackPSU Fall 2026 · October 24–25 · Penn State · Synthetic financial data**

[Features](#what-you-can-do) · [Local setup](#run-locally) · [Authentication](authentication/README.md) · [Future Decisions & AI Chat Setup](docs/FUTURE_DECISIONS.md#run-it-locally) · [Tests](#verification) · [Team](#team)

</div>

## Why Clarity?

A banking app can show a balance. Knowing what to do next takes understanding. A new job, a move, a loan payment, or a major purchase can change someone's finances before they have a plan.

Clarity connects financial education to those decisions. Users can assess their knowledge, work through relevant lessons, and compare possible outcomes with calculations whose assumptions they can inspect. For banking audiences, the prototype demonstrates how financial activity can become a starting point for education and informed customer conversations.

Built around financial confidence for the FNB challenge, with Auth0 providing user authentication. The prototype does not connect to First National Bank systems or live bank accounts.

## What you can do

| Experience | Current implementation |
| --- | --- |
| **Discover, Learn, Reassess** | Baseline knowledge and habits screening, recommended learning, lesson exercises, and checkpoint assessments. |
| **Future Lab** | Compare cash paths and explore an income interruption, unexpected repair, or rent increase. |
| **Future Decisions** | Describe any two-option money decision to a Gemini guide that asks follow-ups, runs the projection in code, shows charts, budget breakdowns and tables, and cites CFPB sources. See the [Future Decisions guide](docs/FUTURE_DECISIONS.md). |
| **Debt & savings calculators** | Explore payoff schedules, extra payments, savings growth, and goal timelines. |
| **Proactive Advisor** | Explore eight possible moments from synthetic activity, with five cards at a time and arrows to cycle through them. Inspect evidence and confirm context before planning. |
| **Purchase Impact Preview** | Compare savings with and without a purchase, including goal delays and cash shortfalls. |
| **Our approach & Evidence** | Inspect methods, limitations, sources, and a recorded synthetic evaluation pilot. |
| **Auth0 account** | Sign up, log in, log out, access protected pages, and verify the backend connection from `/account`. |

The advisor detects a larger paycheck from a new employer, a large payment to a new housing merchant, a spending increase, a first observed student loan payment, and an increasing cash cushion. Additional review prompts highlight a higher housing payment, moving-category costs, and an increased payroll deposit. Related prompts can overlap the same activity. These are clues for the user to confirm, not established facts about their life.

The financial experience runs locally in the browser using synthetic fixtures and reusable TypeScript engines. Journey progress uses browser session storage; it is not yet persisted to a backend user account. Logging in protects access but does not turn the demo into a live banking service.

## How the pieces connect

```text
Auth0 Universal Login
        ↓ authenticated session
Next.js UI — ui/clarity-editorial
        ├── src/engines → financial calculations and conversation guide
        ├── browser session storage → synthetic learning journey
        └── /api/account → server-side Auth0 access token
                                  ↓
                     FastAPI /api/me — BackEnd/api
                                  ↓ verified identity
                     SQLite user record keyed by Auth0 subject
```

The UI checks the session on the server. The Python API independently checks token signature, issuer, audience, expiry, and subject. Ownership helpers reject access to another user's records.

## Run locally

The supported demo runs on your computer. A localhost link is accessible on that computer; teammates need their own local setup. Internet access is required for Auth0 login and signing-key retrieval.

### Prerequisites

- Node.js **22 or newer** and npm.
- Python **3.10 or newer**, with `venv` and pip.
- Access to an Auth0 Regular Web Application and API, or the team's development configuration shared privately.

Run the following commands from the repository root. The Python environment commands below use macOS/Linux paths.

### 1. Configure authentication

Copy the templates only if you do not already have local environment files:

```sh
cp ui/clarity-editorial/.env.example ui/clarity-editorial/.env.local
cp BackEnd/api/.env.example BackEnd/api/.env
```

Fill in these values in `ui/clarity-editorial/.env.local`:

| Variable | Value |
| --- | --- |
| `AUTH0_DOMAIN` | Your Auth0 tenant domain, such as `your-tenant.us.auth0.com`. |
| `AUTH0_CLIENT_ID` | Client ID of the Clarity Regular Web Application. |
| `AUTH0_CLIENT_SECRET` | Client secret of that application, shared privately. |
| `AUTH0_SECRET` | Your own session secret; generate with `openssl rand -hex 32`. |
| `APP_BASE_URL` | `http://127.0.0.1:3001` |
| `AUTH0_AUDIENCE` | `https://clarity-api` |
| `API_BASE_URL` | `http://127.0.0.1:8001` |

In `BackEnd/api/.env`, use the same `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`, with `DEMO_MODE_ENABLED=false`.

In the same Auth0 tenant:

1. Create a **Regular Web Application** named Clarity, or use the existing team application.
2. Set **Allowed Callback URLs** to `http://127.0.0.1:3001/auth/callback`.
3. Set **Allowed Logout URLs** and **Allowed Web Origins** to `http://127.0.0.1:3001`.
4. Create a custom API with identifier **`https://clarity-api`** and signing algorithm **RS256**, or use the existing API.
5. Under the API's **Application Access**, authorize Clarity for **User-delegated Access** if per-application authorization is required.

Use `127.0.0.1` consistently; it is a different origin from `localhost`. Keep client secrets, session secrets, environment files, and saved browser sessions out of Git. The committed examples contain placeholders. See the [authentication guide](authentication/README.md) for details.

### 2. Start the Python backend

```sh
python3 -m venv BackEnd/api/.venv
BackEnd/api/.venv/bin/pip install -r BackEnd/api/requirements.txt
BackEnd/api/.venv/bin/uvicorn app.main:app --app-dir BackEnd/api --reload --host 127.0.0.1 --port 8001
```

Use **8001** so another backend on port 8000 does not accidentally receive Clarity requests.

### 3. Start the UI in a second terminal

```sh
npm run setup
npm run dev
```

Open **http://127.0.0.1:3001**. Choose **Create an account** for your first visit, or **Log in with Auth0** for an existing Clarity account. A Clarity user account is separate from an Auth0 dashboard administrator account.

The root commands start the application in `ui/clarity-editorial/`.

### 4. Verify the connection

1. Sign in and open **Account** in the top bar, or visit `/account`.
2. Click **Check backend connection**. A successful result says the identity was verified with Auth0.
3. Return to Clarity and begin **Discover**, or explore the financial tools.
4. Log out and revisit the homepage to confirm it returns to `/login`.

| Endpoint | Purpose |
| --- | --- |
| UI `/login` | Public entry point for Auth0 login and signup. |
| UI `/account` | Protected account page and backend connection check. |
| UI `/api/account` | Session-protected adapter; keeps the access token server-side. |
| API `http://127.0.0.1:8001/health` | Backend health and Auth0 configuration status. |
| API `http://127.0.0.1:8001/api/me` | Protected identity endpoint; also ensures a user record exists. |

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Login page says setup is required | Fill in the required UI environment values, then restart `npm run dev`. |
| Auth0 reports “Service not found” | The API identifier must match `AUTH0_AUDIENCE` exactly in the same tenant. |
| Auth0 rejects application access | Authorize Clarity for User-delegated Access under the API's Application Access tab. |
| Callback URL mismatch | Match the exact callback URL above, including hostname, port, and path. |
| Backend check fails | Start this repository's API on 8001; check `API_BASE_URL` and matching Auth0 domain/audience. Restart the affected server after changing its environment. |

## Technology

| Area | Technologies |
| --- | --- |
| Active UI | Next.js App Router, React, TypeScript, CSS, SVG charts |
| Financial engines | TypeScript calculations, rule-based detection, local conversation tools |
| Authentication | Official Auth0 Next.js SDK, server-side sessions, RS256 JWT verification |
| Backend | Python, FastAPI, Uvicorn, PyJWT, SQLite |
| Testing | Node.js test runner, Playwright, pytest, TypeScript, ESLint |
| Evaluation | Separate Gemini/OpenAI-compatible experiment tooling and saved synthetic results |

Live model access is not required for the demo. The current decision conversation uses a local mock agent. Evaluation scripts are separate from the interactive app; their saved results do not establish real customer learning or financial outcomes. See [evaluation documentation](evaluation/README.md).

## Verification

Install the UI and Python dependencies first, then run from the repository root:

```sh
npm --prefix ui/clarity-editorial run typecheck
npm --prefix ui/clarity-editorial run lint
npm --prefix ui/clarity-editorial test
npm run build

# Shared finance engine and evaluation tools
node --test finance.test.mjs evaluation/*.test.mjs

# Backend authentication and ownership checks
BackEnd/api/.venv/bin/pip install pytest httpx
PYTHONPATH=BackEnd/api BackEnd/api/.venv/bin/pytest BackEnd/api/tests -q

# Signed-out access checks; requires Chrome or a configured Playwright executable
npm --prefix ui/clarity-editorial run test:browser -- auth.spec.ts
```

Full browser journey tests require a saved, authenticated Auth0 browser session. Follow the [browser test instructions](authentication/README.md#verification); no login bypass is enabled.

## Repository layout

```text
clarity/
├── authentication/             # Shared Auth0 configuration and setup guide
├── BackEnd/api/
│   ├── app/main.py             # Runnable FastAPI server
│   ├── app/auth/               # Token verification and ownership checks
│   ├── app/repositories/       # SQLite persistence foundations
│   ├── app/fixtures/           # Synthetic financial and educational data
│   └── tests/                  # Backend authentication tests
├── ui/clarity-editorial/        # Next.js app: views, adapters, engines (src/engines), and tests
├── evaluation/                 # Experiment runners, scoring, and recorded results
├── public/branding/            # Clarity logo PNG
├── finance.ts                  # Shared debt and savings calculations
└── package.json                # Root UI setup, dev, build, and start commands
```

## What's next

- Persist assessments, lesson progress, and user-reviewed actions to authenticated backend accounts.
- Add background scanning and notification delivery for confirmed life moments.
- Explore additional guidance such as plan check-ins, credit readiness, and loan affordability.
- Evaluate usability and comprehension with participants beyond synthetic test cases.
- Investigate consent-based banking integrations and the security work needed for real financial data.

## Team

| Team member | Role | Feature ownership |
| --- | --- | --- |
| **Abhijay Madanagopal** | Backend / Data Engineer | Proactive Advisor and Auth0 integration |
| **Ram Gundapwar** | UI/UX Engineer | UI and interaction design |
| **Krish Sawant** | Backend Engineer | Future You Decision Simulator |
| **Aayush Sandesh** | QA Engineer | Testing and quality assurance |
| **Neil Barbara** | Backend Engineer | Backend development |

## Prototype scope

Clarity is an educational hackathon prototype using synthetic financial activity. It does not connect live accounts, transfer money, or execute banking actions. Projections depend on entered assumptions and are illustrations, not guarantees or personalized financial advice. SQLite currently supports verified user records and repository foundations; the learning journey remains a browser-session demo.
