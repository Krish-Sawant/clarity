<div align="center">

<img src="public/branding/clarity-logo.png" alt="Clarity logo" width="96" />

# Clarity

### A little knowledge. A different future.

Financial learning, proactive guidance, and interactive simulations to help people understand their next money decision.

**HackPSU Fall 2026 · October 24–25 · Penn State · Fictional financial data**

[Features](#what-you-can-do) · [Run it](#run-locally) · [How it works](#how-it-works) · [Authentication](authentication/README.md) · [AI chat](docs/FUTURE_DECISIONS.md) · [Tests](#verification) · [Team](#team)

</div>

## Why Clarity?

A banking app can show a balance. Knowing what to do next takes understanding. A new job, a move, a loan payment, or a major purchase can change someone's finances before they have a plan.

Clarity connects financial education to those decisions. Users assess what they know, work through lessons aimed at their gaps, and compare possible outcomes with calculations whose assumptions they can inspect. For banking audiences, it shows how financial activity can become a starting point for education and informed customer conversations.

Built for the FNB financial-confidence challenge, with Auth0 for sign-in. Clarity does not connect to First National Bank systems or live bank accounts.

## What you can do

| Page | What it does |
| --- | --- |
| **Discover** (`/discover`) | An eight-question knowledge check plus optional habit questions. The **Reassess** tab asks eight new questions on the same concepts and compares the two. |
| **Learn** (`/learn`) | Lessons ordered by the concepts you missed, each with a numeric exercise and cited sources. |
| **Future Lab** (`/future-lab`) | Three cash-flow paths over 6, 12, or 24 months, plus a stress test: a job loss, repair, rent increase, or your own scenario. |
| **Future Decisions** (`/decisions`) | Describe any two-option money decision. A Gemini guide asks follow-up questions, sets up the comparison, and explains it with cited CFPB sources; the live chart, budget breakdown, and table update as you edit inputs. See the [Future Decisions guide](docs/FUTURE_DECISIONS.md). |
| **Debt & savings** (`/calculators`) | Payoff schedules, extra payments, savings growth, and goal timelines, with monthly plan check-ins below. |
| **Advisor** (`/advisor`) | Possible life moments detected from fictional transactions, shown five at a time. Inspect the evidence and confirm the context before any planning. |
| **Before you commit** (`/before-you-commit`) | Three tabs: **Purchase preview** (savings with and without a purchase), **Loan comfort** (what a lender approves vs. what your month allows), and **Card readiness** (habits to check before comparing rewards). |
| **Our approach** (`/approach`) | Methods, sources, proposals awaiting your approval, and a recorded evaluation of the AI with and without calculation tools. |
| **Account** (`/account`) | Sign up, log in, log out, and check the connection to the backend. |

The advisor flags a larger paycheck from a new employer, a large payment to a new housing merchant, a spending increase, a first student loan payment, and a growing cash cushion, plus review prompts for a higher housing payment, moving costs, and an increased payroll deposit. These are clues for the user to confirm, not facts about their life.

Nothing moves money. Approvals are recorded in the browser, and journey progress lives in the tab's session storage; it is not yet saved to the backend user account.

## How it works

```text
Auth0 Universal Login
        ↓ authenticated session
Next.js app — ui/clarity-editorial
        ├── src/engines           → deterministic calculations, detection rules, chat tools
        ├── /api/decisions/chat   → Gemini guide + retrieval over CFPB sources (server-side)
        ├── browser session storage → learning journey progress
        └── /api/account          → server-side Auth0 access token
                                        ↓
                           FastAPI /api/me — BackEnd/api
                                        ↓ verified identity
                           SQLite user record keyed by Auth0 subject
```

- **Numbers come from code, not the AI.** Every projection is calculated by the TypeScript engines in `ui/clarity-editorial/src/engines` and the shared `finance.ts`. Gemini picks which tools to run and explains the results.
- **The AI is checked.** The server rejects any figure in a reply that doesn't appear in the user's words, tool results, or sources, and rejects inputs the user never gave; the guide has to ask instead of assuming.
- **Guidance is grounded.** For each message, the server finds the closest passages in a pre-built index of CFPB and other U.S. government consumer-finance pages (`gemini-embedding-001`) and has Gemini cite them. If nothing is relevant, it says so.
- **Secrets stay on the server.** The Gemini key and Auth0 tokens never reach the browser. The UI checks the session on the server, and the Python API independently verifies token signature, issuer, audience, expiry, and subject.
- **There's a fallback.** If Gemini is unavailable, a scripted guide answers so the page never dead-ends.

## Run locally

Clarity runs on your own computer. Internet access is needed for Auth0 sign-in and Gemini.

### Prerequisites

- Node.js **22 or newer** and npm.
- Python **3.10 or newer**, with `venv` and pip.
- An Auth0 Regular Web Application and API, or the team's development configuration shared privately.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com) for the Future Decisions chat (optional; without it, the scripted guide answers).

Run the commands below from the repository root. The Python paths are for macOS/Linux.

### 1. Configure environment files

Copy the templates if you don't already have local environment files:

```sh
cp ui/clarity-editorial/.env.example ui/clarity-editorial/.env.local
cp BackEnd/api/.env.example BackEnd/api/.env
```

Fill in `ui/clarity-editorial/.env.local`:

| Variable | Value |
| --- | --- |
| `AUTH0_DOMAIN` | Your Auth0 tenant domain, such as `your-tenant.us.auth0.com`. |
| `AUTH0_CLIENT_ID` | Client ID of the Clarity Regular Web Application. |
| `AUTH0_CLIENT_SECRET` | Client secret of that application, shared privately. |
| `AUTH0_SECRET` | Your own session secret; generate with `openssl rand -hex 32`. |
| `APP_BASE_URL` | `http://127.0.0.1:3001` |
| `AUTH0_AUDIENCE` | `https://clarity-api` |
| `API_BASE_URL` | `http://127.0.0.1:8001` |
| `GEMINI_API_KEY` | Your Gemini API key. |
| `GEMINI_MODEL` | Gemini chat model, such as `gemini-3.5-flash-lite`. |

In `BackEnd/api/.env`, use the same `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`, with `DEMO_MODE_ENABLED=false`.

In the same Auth0 tenant:

1. Create a **Regular Web Application** named Clarity, or use the team's existing one.
2. Set **Allowed Callback URLs** to `http://127.0.0.1:3001/auth/callback`.
3. Set **Allowed Logout URLs** and **Allowed Web Origins** to `http://127.0.0.1:3001`.
4. Create a custom API with identifier **`https://clarity-api`** and signing algorithm **RS256**, or use the existing API.
5. Under the API's **Application Access**, authorize Clarity for **User-delegated Access** if per-application authorization is required.

Use `127.0.0.1` consistently; it is a different origin from `localhost`. Keep secrets, environment files, and saved browser sessions out of Git. See the [authentication guide](authentication/README.md) for details.

### 2. Start the Python backend

```sh
python3 -m venv BackEnd/api/.venv
BackEnd/api/.venv/bin/pip install -r BackEnd/api/requirements.txt
BackEnd/api/.venv/bin/uvicorn app.main:app --app-dir BackEnd/api --reload --host 127.0.0.1 --port 8001
```

Port **8001** keeps Clarity requests away from any other backend on 8000.

### 3. Start the app in a second terminal

```sh
npm run setup
npm run dev
```

Open **http://127.0.0.1:3001**. Choose **Create an account** on your first visit, or **Log in with Auth0**. A Clarity user account is separate from an Auth0 dashboard administrator account.

### 4. Check the connection

1. Sign in and open **Account** in the top bar, or visit `/account`.
2. Click **Check backend connection**. A successful result says the identity was verified with Auth0.
3. Go back to Clarity and start **Discover**, or open **Future Decisions** and describe a decision.
4. Log out and revisit the homepage to confirm it returns to `/login`.

| Endpoint | Purpose |
| --- | --- |
| UI `/login` | Public entry point for Auth0 login and signup. |
| UI `/account` | Protected account page and backend connection check. |
| UI `/api/account` | Session-protected adapter; keeps the access token server-side. |
| UI `/api/decisions/chat` | Session-protected Gemini guide for Future Decisions. |
| API `http://127.0.0.1:8001/health` | Backend health and Auth0 configuration status. |
| API `http://127.0.0.1:8001/api/me` | Protected identity endpoint; also ensures a user record exists. |

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Login page says setup is required | Fill in the Auth0 values in `.env.local`, then restart `npm run dev`. |
| Auth0 reports “Service not found” | The API identifier must match `AUTH0_AUDIENCE` exactly, in the same tenant. |
| Auth0 rejects application access | Authorize Clarity for User-delegated Access under the API's Application Access tab. |
| Callback URL mismatch | Match the callback URL above exactly, including hostname, port, and path. |
| Backend check fails | Start this repository's API on 8001; check `API_BASE_URL` and the matching Auth0 domain and audience. Restart the affected server after changing its environment. |
| Chat replies are labeled “Scripted guide” | Gemini failed: check `GEMINI_API_KEY`, or try another `GEMINI_MODEL` if the model reports high demand (503) or a rate limit (429). Restart `npm run dev` after changes. |

## Technology

| Area | Technologies |
| --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript, CSS, SVG charts |
| Financial engines | TypeScript integer-cent calculations, rule-based detection, simulation and chat tools |
| AI | Gemini (chat with tool calling, `gemini-embedding-001` retrieval), server-side grounding checks |
| Authentication | Auth0 Next.js SDK, server-side sessions, RS256 JWT verification |
| Backend | Python, FastAPI, Uvicorn, PyJWT, SQLite |
| Testing | Node.js test runner, Playwright, pytest, TypeScript, ESLint |
| Evaluation | Separate Gemini experiment runner, AI judge, and saved results ([evaluation/](evaluation/README.md)) |

## Verification

Install the app and Python dependencies first, then run from the repository root:

```sh
# App and engines: typecheck, lint, unit tests, production build
npm --prefix ui/clarity-editorial run typecheck
npm --prefix ui/clarity-editorial run lint
npm --prefix ui/clarity-editorial test
npm run build

# Shared finance engine and evaluation tools
node --test finance.test.mjs evaluation/*.test.mjs

# Backend authentication and ownership checks
BackEnd/api/.venv/bin/pip install pytest httpx
PYTHONPATH=BackEnd/api BackEnd/api/.venv/bin/pytest BackEnd/api/tests -q

# Signed-out access checks; needs Chrome or a configured Playwright executable
npm --prefix ui/clarity-editorial run test:browser -- auth.spec.ts
```

Full browser journey tests need a saved, signed-in Auth0 browser session. Follow the [browser test instructions](authentication/README.md#verification); there is no login bypass.

To rebuild the AI's source index after changing the source list, run `npm --prefix ui/clarity-editorial run rag:index` (needs `GEMINI_API_KEY`).

## Repository layout

```text
clarity/
├── ui/clarity-editorial/        # The Next.js app
│   ├── src/app/                # Routes, including /api/account and /api/decisions/chat
│   ├── src/views/              # One component per page
│   ├── src/engines/            # Advisor, simulation, and chat engines with their tests
│   ├── src/api/                # Adapters that validate input before calling the engines
│   ├── src/server/             # Gemini client, AI guide, retrieval index
│   └── tests/                  # Unit and Playwright browser tests
├── BackEnd/api/
│   ├── app/main.py             # FastAPI server
│   ├── app/auth/               # Token verification and ownership checks
│   ├── app/repositories/       # SQLite persistence foundations
│   ├── app/fixtures/           # Educational content and fictional user data
│   └── tests/                  # Backend authentication tests
├── authentication/             # Shared Auth0 configuration and setup guide
├── evaluation/                 # Experiment runners, scoring, and recorded results
├── docs/                       # Feature guides and evaluation write-ups
├── finance.ts                  # Shared debt and savings calculations
├── public/branding/            # Clarity logo
└── package.json                # Root setup, dev, build, and start commands
```

## What's next

- Save assessments, lesson progress, and approved actions to the authenticated backend account.
- Add background scanning and notifications for confirmed life moments.
- Test usability and comprehension with real participants.
- Explore consent-based bank connections and the security work real financial data requires.

## Team

| Team member | Role | Feature ownership |
| --- | --- | --- |
| **Abhijay Madanagopal** | Backend / Data Engineer | Proactive Advisor and Auth0 integration |
| **Ram Gundapwar** | UI/UX Engineer | UI and interaction design |
| **Krish Sawant** | Backend Engineer | Future You Decision Simulator |
| **Aayush Sandesh** | QA Engineer | Testing and quality assurance |
| **Neil Barbara** | Backend Engineer | Backend development |

## Scope

Clarity is an educational hackathon prototype built on fictional financial activity. It does not connect live accounts, move money, or execute banking actions. Projections depend on the assumptions entered and are illustrations, not guarantees or personalized financial advice. The backend stores verified user records; the learning journey itself stays in the browser session.
