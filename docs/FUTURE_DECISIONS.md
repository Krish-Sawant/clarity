# Future Decisions: the AI decision guide

**Branch:** `future-decisions` · **Page:** http://127.0.0.1:3001/decisions · **Owner:** Krish

Describe any money decision between two options in your own words — *"lease a car for
$350 a month or buy a used one for $15,000?"* — and the guide asks a few follow-up
questions, builds a side-by-side projection, shows charts and tables, explains the
result, and answers what-ifs. General money questions are answered from CFPB and other
U.S. government sources, with citations.

Two rules shape everything here:

1. **Code does the math.** Gemini chooses which tools to call and writes the
   explanation. Every projected number comes from the simulator (`compare()`), and the
   server removes figures the model can't back up.
2. **Advice comes from sources.** Guidance and consumer rights are grounded in 71
   curated government pages retrieved per message (RAG). If nothing relevant matches,
   the guide says it has no trusted source.

## What the user sees

1. A chat box: *"What decision are you weighing?"* No preset cards.
2. The guide recognizes the decision. If it fits a preset (job offer in two cities,
   buying a car, grad school, moving out, paying off debt vs. saving), it uses that
   model, which includes taxes and city rents. Otherwise it builds a **custom
   comparison** from what the user said.
3. Up to three short follow-up questions, each with clickable answer choices.
4. Once the numbers are run, the reply shows:
   - summary cards for both options,
   - a **net worth chart**, plus a **debt** or **savings** chart when relevant,
   - a **monthly budget breakdown** (pay, each cost, debt payments, what's left),
   - a **results table**,
   - a 3–5 sentence explanation with numbered source links.
5. The full comparison workspace appears below the chat: editable inputs (values the
   user didn't give are labeled as estimates), the same charts, a monthly schedule,
   and a "note from future you".
6. What-ifs (*"what if I get a roommate?"*) update the inputs and rerun the projection.

Line charts have a hover crosshair and are keyboard-readable (focus, then arrow keys).
Option B is dashed or striped everywhere, so options never differ by color alone.

## How it works

```text
Browser — /decisions                       Next.js server — /api/decisions/chat
┌─────────────────────────────┐            ┌──────────────────────────────────────┐
│ runAgentLoop()              │  history,  │ requires an Auth0 session            │
│  ├─ geminiTurn() ───────────┼─ session ─▶│ retrieve(): embed question, rank     │
│  │                          │            │   246 chunks of 71 sources (RAG)     │
│  ├─ runTool() — runs the    │◀── text, ──│ Gemini (OpenAI-compatible endpoint)  │
│  │   simulator in-browser   │ tool calls │   with tool schemas + sources        │
│  └─ mockAgent() — scripted  │            │ checks: numbers, percentages,        │
│      backup if Gemini fails │            │   citations; one retry if needed     │
└─────────────────────────────┘            └──────────────────────────────────────┘
```

One user message usually takes **2–4 Gemini calls**: Gemini calls tools, the browser
runs them and sends the results back, and Gemini continues until it asks a question or
answers. The Gemini key never reaches the browser.

### Tools Gemini can call

Defined in `ui/clarity-editorial/src/server/decision-agent.ts`, run by
`ui/clarity-editorial/src/engines/chat/tools.ts`.

| Tool | What it does |
| --- | --- |
| `pick_scenario` | Starts a preset comparison; returns its fields and suggested follow-ups. |
| `define_comparison` | Starts a custom comparison from two structured options (income, costs, one-time costs, debts, assets) and a list of assumptions. Validated and clamped in `ui/clarity-editorial/src/engines/sim/custom.ts`. |
| `set_inputs` | Changes inputs by field key (for answers and what-ifs). |
| `ask_user` | Shows one question with answer choices and waits for the user. |
| `run_simulation` | Runs the projection; returns the only projected numbers Gemini may quote. |
| `show_playground` | Summary cards with an "edit this comparison" button. |
| `show_chart` | Line chart of net worth, cash, or debt over time, with a title. |
| `show_breakdown` | Month-1 budget bar chart for both options. |
| `show_table` | Selected result rows (take-home, net worth, payoff month, interest…). |

### Grounding and safety checks

- **Dollar amounts** in Gemini's text must match (within 1%, for rounding) a number the
  user said, a tool input or result, a source passage, or the gap between the two options.
- **Percentages** must come from a rate-shaped place: the user's text or a source
  ("24%"), or a rate input such as an APR, raise, or APY. This stops invented market
  rates like "savings pay 4–5%".
- If a check fails, Gemini gets one retry with the problem spelled out; after that, any
  sentence still carrying an unverified figure is dropped.
- **Citations** must reference a source retrieved for that message; others are
  removed. `[a, b]` is split into separate links.
- **Retrieval cutoff:** passages below 0.60 similarity aren't sent (clear matches score
  0.66–0.79; off-topic questions top out near 0.55, measured on this index).
- **Fallback:** if Gemini fails *before* doing anything for a message, the scripted
  guide answers (presets only). If it fails partway through, or the comparison is
  custom, the user sees "send your message again" instead of a half-finished answer.
- **Access:** the chat route requires an Auth0 session and allows 150 calls per IP per
  10 minutes (in memory, per server process).
- The chat tells users their messages go to Google's Gemini API and not to include
  account numbers or other identifiers.

## Run it locally

Follow the root [README](../README.md#run-locally) for Auth0 and the backend, then add
the Gemini settings to the **same** file the UI uses, `ui/clarity-editorial/.env.local`
(git-ignored; see `ui/clarity-editorial/.env.example`):

```sh
GEMINI_API_KEY=your-key-from-aistudio.google.com
GEMINI_MODEL=gemini-3.5-flash-lite
```

Then `npm run dev`, sign in, and open http://127.0.0.1:3001/decisions.

- The chat route lives in the Next.js app. The `GEMINI_*` values in
  `BackEnd/api/.env` configure the Python API and are **not** used by this feature.
- Without Auth0 configured, `/decisions` redirects to `/login` and the chat route
  returns 503, so the scripted guide answers instead of Gemini.
- After pulling, run `npm run setup` (or `npm --prefix ui/clarity-editorial install`)
  if `@auth0/nextjs-auth0` or other new packages are missing.

### Check the key works

```sh
cd ui/clarity-editorial
node --env-file=.env.local --input-type=module -e '
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + process.env.GEMINI_MODEL + ":generateContent",
  { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }) });
console.log(r.status, r.ok ? "working" : (await r.json()).error.message.slice(0, 200));'
```

- `403 … has not been used in project … or it is disabled`: enable the Generative
  Language API for the key's Google Cloud project and wait a few minutes.
- `429 … GenerateRequestsPerDayPerProjectPerModel-FreeTier`: the model's free daily
  quota is used up (see Limits).
- Python `CERTIFICATE_VERIFY_FAILED` on macOS: run
  `open "/Applications/Python 3.13/Install Certificates.command"`.

## Try it

| Kind | Example |
| --- | --- |
| Preset | "I got two offers: $95k in New York City or $78k in Pittsburgh. Which is better?" |
| Custom | "Should I lease a car for $350 a month or buy a used one for $15,000 cash? I take home $3,800 and have $20k saved." |
| Custom | "Should I freelance making about $6,000 a month or take a salaried job at $70k?" |
| What-if | "What if I get a roommate?" · "What if I only spend $2,300 a month?" |
| Rights | "Can my credit card company raise my interest rate on my existing balance?" |
| Edge case | "Should I buy Bitcoin?" (no advice, no invented returns) |

## Sources and the search index

| File | Role |
| --- | --- |
| `BackEnd/api/app/fixtures/rag_sources.json` | 71 sources: CFPB (65), IRS (2), Investor.gov (3), FDIC (1). Each has a scenario tag and a `guidance` or `rights` kind. |
| `BackEnd/api/scripts/build_rag_sources.py` | Rebuilds that list: every URL must return 200 and have 150+ words of text; titles come from each page's `<h1>`. |
| `ui/clarity-editorial/scripts/build-rag-index.mjs` | Fetches each page's `<main>` text, splits it into ~220-word chunks, embeds them with `gemini-embedding-001` (768 dimensions), and writes the index. |
| `ui/clarity-editorial/src/server/rag-index.json` | The committed index: 246 chunks, about 1.9 MB. |

To add or refresh sources:

```sh
python3 BackEnd/api/scripts/build_rag_sources.py   # edit CURATED first to add pages
npm --prefix ui/clarity-editorial run rag:index    # ~3 minutes; waits out free-tier rate limits
```

The existing nine lesson sources (`sources_fallback.json`) keep their ids, so lessons
and the guide cite the same pages. The Approach page still lists only those nine.

## Files

| Area | Files |
| --- | --- |
| Page | `ui/clarity-editorial/src/views/decisions.tsx`, `decision-blocks.tsx` (charts, breakdown, tables) |
| Browser agent and fallback | `ui/clarity-editorial/src/api/decisions.ts` |
| API route | `ui/clarity-editorial/src/app/api/decisions/chat/route.ts` |
| Gemini client, retrieval, agent | `ui/clarity-editorial/src/server/gemini.ts`, `rag.ts`, `decision-agent.ts` |
| Custom comparisons | `ui/clarity-editorial/src/engines/sim/custom.ts` |
| Simulator, tools, scripted guide | `ui/clarity-editorial/src/engines/sim/`, `ui/clarity-editorial/src/engines/chat/` |

## Tests

```sh
npm --prefix ui/clarity-editorial run typecheck
npm --prefix ui/clarity-editorial run lint
npm --prefix ui/clarity-editorial test     # includes tests/decision-agent.test.ts
npm --prefix ui/clarity-editorial test     # includes src/engines/sim/custom.test.ts
```

The unit tests cover the number, percentage and citation checks, thought-signature
replay, custom-comparison parsing and limits, taxes, and that the budget breakdown adds
up. A live conversation with Gemini isn't part of the automated suite, since it needs a
key and spends quota.

## Limits and known issues

- **Free-tier quota is the main risk.** `gemini-3.6-flash` and `gemini-3.5-flash` allow
  only 20 requests per day per project on the free tier, which is about 5–8 messages.
  The branch uses `gemini-3.1-flash-lite`, whose daily limit is unknown. For a demo,
  enable billing on the Google Cloud project.
- `gemini-3.1-flash-lite` is a smaller model. It handles the flows above well, but may
  occasionally pick a weaker set of visuals or need a follow-up nudge.
- Gemini rejects tool-call history without its *thought signatures*, so raw replies are
  kept in the chat history (`providerMessage`) and replayed as-is.
- Custom comparisons live in browser memory; reloading the page starts over (so does the
  conversation itself).
- The rate limit is in-memory per server process, not shared across instances.
- Taxes use the simplified 2026 single-filer model; salaries outside the six modeled
  cities use federal tax plus a flat state/local rate (4% unless the user says otherwise).
- The two option colors fail the dataviz validator's lightness and chroma checks
  because option A is the brand's near-black ink. Color-blind separation and contrast
  pass, and B always has a dash or stripe pattern.
- Projections are educational illustrations, not financial advice.
