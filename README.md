<div align="center">

# Clarity

### A clearer path to your next money decision.

Clarity helps people understand their finances and make smarter money decisions with personalized, proactive guidance.

**Built for HackPSU · Hackathon prototype · Synthetic financial data**

[Our idea](#why-clarity) · [Core features](#core-features) · [Roadmap](#roadmap) · [Getting started](#getting-started) · [Team](#team)

</div>

---

## Why Clarity?

A bigger salary does not always mean more money left over. A new job, a move, or a first loan payment can change your finances before you have a plan.

We’re building Clarity to make those trade-offs easier to understand. It brings together two experiences: explore how a decision could shape your future, and get timely guidance when your financial activity suggests something has changed.

Our approach: calculate the numbers in code, show the assumptions, explain the trade-offs, and help the user choose a practical next step.

## Core features

### 1. “Future You” Decision Simulator

**Led by Krish · In development**

Compare possible financial futures side by side. For example: *Should I take a $95,000 offer in New York City or a $78,000 offer in Pittsburgh?*

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

| Signal | Possible moment | Intended guided experience |
| --- | --- | --- |
| A larger paycheck from a new employer | Starting a new job | First-paycheck budget, retirement benefits, and emergency savings |
| A large payment to a new housing merchant | Moving or signing a lease | Moving costs and a new monthly budget |
| Spending at least 40% above the recent baseline | A spending shift | Understand what changed and reset the budget |
| First observed student loan payment | Repayment beginning | Explore required payments, saving, and extra repayment |
| Four increasing monthly balance snapshots | A growing cash cushion | Explore accessible, interest-earning savings |

An example nudge:

> “Looks like you may have started a new job. Want to plan your first paycheck? Takes 3 minutes.”

The current engine returns stable signal IDs, nudge copy, supporting evidence, and amounts. Its planner calculates monthly surplus, an illustrative emergency savings gap, and a possible savings action from editable inputs. Signals are clues for the user to confirm, not established facts about their life.

**Still to integrate:** the production UI, shared conversation flow, background scanning, notification delivery, and persistent user actions. The temporary preview UI has been removed. No real transfers occur.

[Read the advisor integration guide](frontend/src/lib/advisor/README.md).

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

| Feature | What we want it to help users do |
| --- | --- |
| **Stress tests** | Explore job loss, an unexpected repair, or a rent increase and see how long their cash could last. |
| **Save the Raise** | Consider directing part of a pay increase toward savings. |
| **Purchase Impact Preview** | See how a large purchase could change a savings goal’s timeline. |
| **Plan Check-Ins** | Compare activity with a chosen plan and make small adjustments. |
| **Credit Card Readiness** | Compare estimated rewards using spending patterns while allowing an honest “not yet” outcome. |
| **Loan Affordability** | Explore a comfortable payment alongside savings and stress scenarios, starting with car and student loan decisions. |

## Technology

| Area | Current foundation |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Advisor engine | TypeScript rules and deterministic planning calculations |
| Backend foundations | Python, FastAPI dependencies, SQLite repositories |
| Identity foundations | Auth0 token verification and separate development demo identities |
| Demo data | Synthetic JSON transactions, balance snapshots, and educational fixtures |
| Advisor tests | Node.js test runner |

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

From `frontend`:

```sh
node --test tests/advisor.test.mjs
```

The six tests cover all five demo signals, repeat scans and input order, incomplete histories, repeat employers and loan payments, the spending threshold, balance dips, and planning input validation.

The engine and fixture can be imported independently:

```ts
import { detect, plan } from '@/lib/advisor/engine';
import demo from '@/lib/advisor/demo.json';

const nudges = detect(demo.transactions, demo.snapshots, demo.asOf);
const paycheckPlan = plan('new-job', 4800, 3580, 5100, 4);
```

### Repository layout

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

- **Krish** — “Future You” Decision Simulator
- **Abhijay** — Proactive Advisor

## Prototype scope

Clarity is an educational hackathon prototype. Demo activity is synthetic. Live account connections, real transfers, and a complete integrated advisory experience are outside the current implementation. Outputs depend on the supplied history and assumptions.
