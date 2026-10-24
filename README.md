<div align="center">

# Clarity

### A clearer path to your next money decision.

Clarity helps people understand their finances and make smarter money decisions with personalized, proactive guidance.

**HackPSU Fall 2026 · October 24–25 · Penn State · Synthetic financial data**

[Our idea](#why-clarity) · [Core features](#core-features) · [Learning journey](#personalized-learning-journey) · [Roadmap](#roadmap) · [Getting started](#getting-started) · [Team](#team)

</div>

---

## Why Clarity?

A bigger salary does not always mean more money left over. A new job, a move, or a first loan payment can change your finances before you have a plan.

We’re building Clarity to make those trade-offs easier to understand. It combines personalized financial learning, side-by-side decision simulations, and timely guidance when financial activity suggests something has changed.

Our goal is financial confidence: give users information they understand, help them see their options, and make their next step actionable.

Our approach: calculate the numbers in code, show the assumptions, explain the trade-offs, and help the user choose a practical next step.

## Core features

### 1. “Future You” Decision Simulator

**Led by Krish · In development**

Compare possible financial futures side by side. For example: _Should I take a $95,000 offer in New York City or a $78,000 offer in Pittsburgh?_

The planned simulator compares estimated take-home pay, living expenses, moving costs, savings growth, and debt payoff timelines. Adjustable assumptions—such as rent and expected raises—let users see when the answer changes.

The intended flow:

1. Enter two options and their assumptions.
2. Compare projected outcomes across time.
3. Adjust sliders to explore the trade-offs.
4. Read a future-self explanation grounded in computed results.
5. Turn a chosen path into a budget, savings target, and debt payoff plan.

These projections are intended as illustrations, not guarantees. Tax estimates, cost data, charts, and AI explanations require implementation and integration.

### 2. Proactive Advisor

**Led by Abhijay · Detection and planning engine implemented**

Notice possible life moments in financial activity and offer a useful starting point.

| Signal                                          | Possible moment           | Intended guided experience                                        |
| ----------------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| A larger paycheck from a new employer           | Starting a new job        | First-paycheck budget, retirement benefits, and emergency savings |
| A large payment to a new housing merchant       | Moving or signing a lease | Moving costs and a new monthly budget                             |
| Spending at least 40% above the recent baseline | A spending shift          | Understand what changed and reset the budget                      |
| First observed student loan payment             | Repayment beginning       | Explore required payments, saving, and extra repayment            |
| Four increasing monthly balance snapshots       | A growing cash cushion    | Explore accessible, interest-earning savings                      |

An example nudge:

> “Looks like you may have started a new job. Want to plan your first paycheck? Takes 3 minutes.”

The current engine returns stable signal IDs, nudge copy, supporting evidence, and amounts. Its planner calculates monthly surplus, an illustrative emergency savings gap, and a possible savings action from editable inputs. Signals are clues for the user to confirm, not established facts about their life.

**Still to integrate:** the production UI, shared conversation flow, background scanning, notification delivery, and persistent user actions. The temporary preview UI has been removed. No real transfers occur.

The advisor implementation currently lives on [`feature/proactive-advisor`](https://github.com/Krish-Sawant/clarity/tree/feature/proactive-advisor). [Read its integration guide](https://github.com/Krish-Sawant/clarity/blob/feature/proactive-advisor/frontend/src/lib/advisor/README.md).

## Personalized learning journey

**Planned experience · Assessment, lesson, and progress-tracking foundations in the backend**

Financial guidance should meet people at their current level of understanding. Our intended learning loop is:

1. **Assess** — Start with a short quiz and financial-habits screening to understand what the user knows and where they need support.
2. **Learn** — Offer relevant explanations and exercises based on that starting point.
3. **Apply** — Connect learning to a financial decision or a detected life moment.
4. **Check progress** — Reassess understanding and habits against the initial screening, then adjust the learning plan.

We plan to tailor guidance across savings, budgeting, retirement, investing, and taxes, with topic-specific advisor styles and explanations suited to the user’s financial literacy. These broader topic experiences are planned; the repository currently includes assessment and educational-content fixtures and persistence foundations, rather than a complete learning UI.

## How we’re building it

```text
Synthetic transactions + balance snapshots
                    ↓
          Rule-based detection
                    ↓
       Nudge + supporting evidence
                    ↓
     Confirm the moment with the user
                    ↓
   Calculations + explained assumptions
                    ↓
       User-reviewed next step
```

This is the intended end-to-end experience. Detection and planning are reusable modules; the connected experience is still under development.

The repository also contains backend foundations for authenticated user records, financial assessments, learning plans, educational lessons, and demo action proposals.

## Roadmap

These are planned extensions, not completed features:

| Feature                     | What we want it to help users do                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Stress tests**            | Explore job loss, an unexpected repair, or a rent increase and see how long their cash could last.                  |
| **Save the Raise**          | Consider directing part of a pay increase toward savings.                                                           |
| **Purchase Impact Preview** | See how a large purchase could change a savings goal’s timeline.                                                    |
| **Plan Check-Ins**          | Compare activity with a chosen plan and make small adjustments.                                                     |
| **Credit Card Readiness**   | Compare estimated rewards using spending patterns while allowing an honest “not yet” outcome.                       |
| **Loan Affordability**      | Explore a comfortable payment alongside savings and stress scenarios, starting with car and student loan decisions. |

## Technology

| Area                 | Current foundation                                                       |
| -------------------- | ------------------------------------------------------------------------ |
| Frontend             | Next.js, React, TypeScript, Tailwind CSS                                 |
| Advisor engine       | TypeScript rules and deterministic planning calculations                 |
| Backend foundations  | Python, FastAPI dependencies, SQLite repositories                        |
| Identity foundations | Auth0 token verification and separate development demo identities        |
| Demo data            | Synthetic JSON transactions, balance snapshots, and educational fixtures |
| Advisor tests        | Node.js test runner                                                      |

## Getting started

### Frontend

With Node.js and npm installed:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000**. The frontend currently contains the starter page; this command does not launch a complete advisor experience.

### Verify the advisor engine

Until the advisor feature is merged, use its branch to run the implementation. From the repository root:

```sh
git switch feature/proactive-advisor
cd frontend
node --test tests/advisor.test.mjs
```

The six tests cover all five demo signals, repeat scans and input order, incomplete histories, repeat employers and loan payments, the spending threshold, balance dips, and planning input validation.

The engine and fixture can be imported independently:

```ts
import { detect, plan } from "@/lib/advisor/engine";
import demo from "@/lib/advisor/demo.json";

const nudges = detect(demo.transactions, demo.snapshots, demo.asOf);
const paycheckPlan = plan("new-job", 4800, 3580, 5100, 4);
```

### Repository layout

The advisor library and tests shown below are currently on the feature branch.

```text
clarity/
├── BackEnd/api/app/
│   ├── auth/                    # Identity and access foundations
│   ├── fixtures/                # Synthetic persona and learning content
│   └── repositories/            # User-owned application records
├── frontend/
│   ├── src/app/                 # Next.js app
│   ├── src/lib/advisor/         # Detection, planner, demo data, integration guide
│   └── tests/advisor.test.mjs   # Advisor engine tests
└── README.md
```

The backend is scaffolded; this checkout does not yet include a runnable API entry point or a backend installation manifest.

## Team

| Team member        | Role                    | Feature ownership               |
| ------------------ | ----------------------- | ------------------------------- |
| **Abhijay**        | Backend / Data Engineer | Proactive Advisor               |
| **Ram**            | UI/UX Engineer          | UI and interaction design       |
| **Krish Sawant**   | Backend Engineer        | “Future You” Decision Simulator |
| **Aayush Sandesh** | QA Engineer             | Testing and quality assurance   |
| **Neil Barbara**   | Backend Engineer        | Backend development             |

## HackPSU focus

Built for HackPSU Fall 2026 with a focus on understandable, trustworthy financial decisions—the problem highlighted in the FNB Financial Confidence challenge. Our demo priorities are transparent calculations, user-reviewed choices, and a reproducible synthetic dataset. Competition entries and additional sponsor integrations are team decisions still to be confirmed.

## Prototype scope

Clarity is an educational hackathon prototype. Demo activity is synthetic. Live account connections, real transfers, and a complete integrated advisory experience are outside the current implementation. Outputs depend on the supplied history and assumptions.

> > > > > > > origin
