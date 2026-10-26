# Clarity Editorial

The Clarity web app: a Next.js + React + TypeScript site that takes a signed-in user through Discover → Learn → Future Lab, an Advisor, and a Future Decisions chat. Financial activity is fictional; no bank is connected and no money moves.

For Auth0 and backend setup, see the [root README](../../README.md#run-locally) and [authentication/README.md](../../authentication/README.md). For the AI chat, see [docs/FUTURE_DECISIONS.md](../../docs/FUTURE_DECISIONS.md).

## Run

Requires Node.js 22+. From this directory:

```sh
cp .env.example .env.local   # then fill in Auth0 and Gemini values
npm ci
npm run dev                  # http://127.0.0.1:3001
```

Keep the repository layout intact: the app imports the root `finance.ts`, so `next.config.ts` sets the Turbopack root to the repository root. Calculation engines live in `src/engines`.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Overview and the next step in your journey |
| `/discover` | Eight-question knowledge check; the **Reassess** tab compares a second, matched set |
| `/learn` | Lessons ordered by missed concepts, with numeric exercises |
| `/future-lab` | Three cash-flow paths plus a stress test of one shock at a time |
| `/decisions` | Future Decisions: a Gemini guide sets up a two-option comparison, then you edit it live |
| `/calculators` | Debt payoff and savings calculators, with plan check-ins below |
| `/advisor` | Possible life moments detected from fictional transactions |
| `/before-you-commit` | Purchase preview, loan comfort, and card readiness tabs |
| `/approach` | Methods, proposals awaiting approval, and the recorded evaluation |

Older routes (`/reassess`, `/stress-test`, `/plan-checkins`, `/purchase-impact`, `/loan-comfort`, `/card-readiness`, `/evidence`) redirect to their new location.

## How the AI chat works

`/api/decisions/chat` runs server-side ([src/server](src/server)), so the Gemini key never reaches the browser.

- **Gemini** chooses tools (pick a scenario, ask a follow-up, set inputs, run the simulation) and writes the explanation. All projected numbers come from the deterministic simulator.
- **Checks** reject reply figures that aren't in the user's words, tool results, or sources, and reject inputs the user never gave.
- **Retrieval** embeds the message and picks the closest passages from `src/server/rag-index.json` (CFPB and other U.S. government sources) for Gemini to cite. Rebuild the index with `npm run rag:index`.
- If Gemini is unavailable, a scripted guide answers instead.

## Storage

- Journey progress uses this tab's `sessionStorage` key `clarity-editorial:demo:v1`; the reset control on `/approach` clears it.
- Design preferences use the `localStorage` key `clarity-editorial:design:v1`.
- No tokens, keys, or bank data are stored in the browser.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

Browser tests use Playwright at 1440px and 390px with installed Google Chrome; set `PLAYWRIGHT_CHROME_EXECUTABLE` to use another Chrome/Chromium. Journeys behind sign-in need a saved Auth0 session in `PLAYWRIGHT_AUTH_STATE` (see [authentication/README.md](../../authentication/README.md#verification)).
