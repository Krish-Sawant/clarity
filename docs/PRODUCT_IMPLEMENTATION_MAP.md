# Clarity: what is connected today

Source inspection on October 24, 2026. This map describes the checked-out code,
not capabilities on unmerged teammate branches.

| Layer | Current implementation | What still needs integration |
| --- | --- | --- |
| Polished experience | `ui/clarity-editorial`, with local lessons, quizzes and simulation screens | Verified authenticated services and live model tutor |
| Reusable feature logic | `frontend/src/lib/advisor`, `frontend/src/lib/sim`, plus root `finance.ts` | Editorial adapters for each newly added feature |
| Feature demo pages | `frontend/src/app`, including purchase preview and credit-card readiness | Navigation and components in the editorial site |
| Simulator conversation | `frontend/src/lib/chat/mockAgent.ts`, a scripted tool-calling stand-in | Server-side model connection using the same validated tools |
| Editorial tutor | `ui/clarity-editorial/src/api/services.ts` explicitly marks live tutor unavailable | Reviewed Gemini service, endpoint and error handling |
| Educational sources | Bundled source/lesson fixtures and per-feature links | Retrieval over reviewed material, passage citations and grounding checks |
| Evaluation | Gemini A/B calls and a separate AI judge | These experiments are not a live product chat integration |

## Working convention

Keep pure calculations and business rules in `frontend/src/lib`. Put standalone
feature demos in `frontend/src/app`. Later, the editorial UI imports those modules
through adapters and builds its own presentation; do not copy and diverge the math.
The two directories are independent Next.js apps, so adding a frontend route does
not automatically add a route or sidebar entry to the editorial site.

## The intended AI advisor

The product needs three connected pieces: customer context, deterministic tools,
and a source-grounded conversational explanation. Sliders demonstrate tools;
quizzes measure question performance. Neither is by itself a live AI/RAG flow.

RAG means retrieving relevant reviewed source passages for a question and using
those passages in an answer with citations. A static source list alone is not RAG.
Calculation tools remain authoritative for numbers; retrieved passages explain
concepts and terms. Live card offers require a separate verified product catalog.

The new [credit-card feature](../frontend/src/lib/advisor/CREDIT_CARDS.md) implements
transaction analysis, readiness gates, illustrative reward math and a demo page.
Its live model/RAG connection and editorial integration are explicitly pending.
