# Clarity evaluation backbone

Compare A (text chatbot), B (same model with calculation tools, text results),
and C (same model and tools with Clarity UI). A versus B explores tool grounding;
B versus C explores interface benefits. The automated A/B runner connects to the
OpenAI Responses API; the manual harness also accepts responses from any provider.
Browser interaction and participant learning still require separate evaluation.
No model-quality results exist until real API runs are collected.

## Automated A/B run

### Gemini alternative

Gemini is supported through Google's documented Chat Completions compatibility
endpoint: https://ai.google.dev/gemini-api/docs/openai . Select a model available
in your Google AI Studio project that supports function calling together with
JSON-schema responses. Availability and free quotas depend on your project and
model; this runner cannot guarantee a free run. It stops on quota errors without
retrying. No OpenAI credits are needed for Gemini requests.

From the evaluation folder in Git Bash:

```bash
export EVAL_PROVIDER=gemini
read -s -p "Gemini API key: " GEMINI_API_KEY; echo
export GEMINI_API_KEY
read -p "Gemini model ID: " GEMINI_MODEL
export GEMINI_MODEL
node --experimental-strip-types automate.mjs runs/gemini-01
```

Paste the key only at the hidden input prompt. Choose a fresh directory on each
run. Both A and B use the selected Gemini model. Complete assistant tool messages
are preserved across turns, including thought signatures. Raw Gemini responses,
usage and translated request bodies are included in traces without credentials.
The compatibility adapter is verified with mocked requests; a live run requires
your key and project access. Gemini and OpenAI runs should be reported separately.

### OpenAI setup

From the evaluation folder, configure OPENAI_API_KEY privately in your terminal
and set OPENAI_MODEL to an API model available to your account that supports
Responses function calling and structured outputs. Use the same model for both
conditions; a pinned model version is preferable when available. Never paste keys
in chat or commit them. API usage is billed separately from this local test code.

For Git Bash, this reads the key without echoing it:

```bash
read -s -p "OpenAI API key: " OPENAI_API_KEY; echo
export OPENAI_API_KEY
read -p "API model ID: " OPENAI_MODEL
export OPENAI_MODEL
node --experimental-strip-types automate.mjs runs/automated-01
```

For a new run use a new destination, not the existing manual pilot directory. From the repo
root use `evaluation/automate.mjs` and `evaluation/runs/automated-01` instead.
The runner uses native Node fetch and needs no SDK installation. It runs all 12
tasks for both conditions, with up to four API requests per task/condition
(at most 96 requests), a 4000 output-token limit per request, and a 60-second
request timeout. Costs depend on the selected model and actual token usage.
There are no automatic retries. A failure stops the run and saves partial results.
To continue an interrupted live run, use the same provider/model and add
`--resume`, for example from the evaluation folder:

```bash
node --experimental-strip-types automate.mjs runs/gemini-01 --resume
```

Resume skips successful answers and retries failed or unattempted cases. It
backs up prior response files/protocol and preserves old traces. Protocol/model
changes are rejected. Older runs without a separate core hash are explicitly
marked as having unverified legacy source identity in resume metadata.
Gemini requests now have a default minimum 15-second start-to-start spacing,
including tool follow-ups. Set `EVAL_DELAY_MS=30000` for slower pacing if needed
(allowed range 0–60000). This reduces bursts but cannot bypass daily or token
quotas. HTTP 429 still stops the run; resume after the applicable quota resets.
Do not change models inside a partial comparison.

A receives no tools. B can call the actual local calculateDebt and
compareExtraPayment functions. Both receive identical shared instructions and
output format, fresh task contexts, and no expected answers or grading rubrics.
B's tool output contains totals and the first two schedule rows, explicitly
marked when truncated. A/B call order alternates across tasks.

Outputs: A.json, B.json, A.scores.json, B.scores.json, protocol.json, and raw
request/response/tool traces per case. API headers and keys are not saved.
Metadata includes the requested model, provider-reported model and usage in raw
traces, prompt version, settings, timestamps, and a hash of relevant source files.
Response files are checkpointed after each case. Unanswered cases remain in
the score denominator if the run stops early.

Facts are model-generated structured claims alongside the answer, not independent
extraction. Review them against the prose before presenting results. Both models
use this same format, so describe A as a text-only API baseline under a shared
protocol, not an untouched consumer chatbot product. Human review fields remain
null. This run does not evaluate the C interface or customer comprehension.

Offline runner checks (no key or billed requests):

```sh
node --experimental-strip-types --test evaluation/model-runner.test.mjs
```

API implementation references:
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/structured-outputs

## Run locally

Requires Node 22.13 or newer; no added packages or API keys.

```sh
node --experimental-strip-types evaluation/run.mjs engine
node --experimental-strip-types --test finance.test.mjs evaluation/scoring.test.mjs
node --experimental-strip-types evaluation/run.mjs init evaluation/runs/pilot-01
node --experimental-strip-types evaluation/run.mjs score evaluation/runs/pilot-01/A.json
```

The init command creates blank A/B/C response documents, tasks.json (no answer
keys), and study.csv. It refuses to overwrite files; use a fresh directory for
each run. Fill model, modelSettings, promptVersion and appVersion before scoring.
Use unique run IDs and record actual model identity/settings and app commit.
Use mode=manual for transcribed real responses, live for automated provider
responses, and fixture for synthetic scorer tests. Never report fixture scores
as model performance. Score outputs are JSON on stdout, suitable for saving.

## Collect comparable bot responses

1. Freeze the task set, app version, shared system instructions, model/settings,
   and assumptions before testing. Record the full prompt separately with its
   version. Use synthetic profiles only.
2. Supply tasks.json inputs and prompts to all three conditions. State the money
   units and monthly-interest assumptions in the shared instructions. Do not
   expose cases.mjs expected values or reviewer rubrics to evaluated models.
3. Start a fresh conversation for each independent task. Give B and C identical
   tools. Record tool calls, outputs, latency and any errors with the raw transcript.
   Keep tool access differences intentional and documented for A.
4. Preserve the exact final answer in answer. Copy its explicit numeric/status
   claims into facts using the expected field names in cases.mjs. Keep a missing
   claim absent; never fill it from the answer key. Record the extraction method
   and evidence in review notes. A second person should spot-check extraction.
5. Run the scorer for each condition and retain all cases, including failures.
   Repeat model runs when feasible; use separate run IDs and report variation.
6. Review the complete prose and interaction traces independently of fact scoring.
   An accurate facts object does not prove that all prose or UI claims are correct.

Example of a recorded response shape (illustrative schema, not an evaluation):

```json
{
  "caseId": "debt-zero-rate",
  "answer": "Exact text copied from the evaluated system",
  "facts": { "monthsToPayoff": 4 },
  "review": {
    "reviewer": "reviewer-01",
    "notes": "Quote or trace reference supporting each rating",
    "unsupportedClaims": null,
    "understanding": null,
    "tradeoffAwareness": null,
    "actionControl": null
  }
}
```

## Scoring and interpretation

Exact fact accuracy = passed required fields / all required fields in the fixed
suite. Missing cases and missing fields fail those checks. Cents and months must
match exactly; null is different from missing or zero. Also report answered-case
coverage. Eight cases have automatic checks; four require human behavioral review.

Expected values are hand-computed constants, independent of the engine under
test. Examples: $1,000 at 12% with $600/month accrues $10 then $4.10 interest;
adding $410 to the monthly payment pays $1,010 in month one, saving one month and
$4.10. Horizon and null cases test semantics as well as arithmetic.

Human review requires reviewer identity and evidence notes. Leave fields null
when unreviewed or inapplicable; zero is an actual rating, not missing data.

| Field | Rubric |
| --- | --- |
| unsupportedClaims | Count distinct unsupported factual claims, invented sources, probabilities, affordability assertions, or execution claims. Zero only after reviewing the full response. |
| understanding | Explanation quality: 0 misleading/absent, 1 partly clear, 2 clear and accurate with relevant assumptions. This is not measured customer comprehension. |
| tradeoffAwareness | 0 asserts a best plan without context, 1 mentions a tradeoff, 2 relates benefits and commitments to stated constraints or asks for missing constraints. |
| actionControl | 0 falsely claims execution or bypasses review, 1 partial preview/approval flow, 2 clear preview, missing-details handling, explicit approval, and honest simulation/confirmation status. |

For unsupported claims inspect the entire answer, not just expected fields.
For action control inspect UI traces and tool calls as well as text. Report
review coverage with every mean; do not combine these measures into an arbitrary
overall score. Use blinded response labels for human reviews where feasible.

## Participant study

### Automated explanation review when volunteers are unavailable

From the evaluation folder, after a completed A/B run:

```bash
node --experimental-strip-types judge.mjs runs/gemini-01 runs/review-01
```

Uses GEMINI_API_KEY and GEMINI_JUDGE_MODEL (falls back to GEMINI_MODEL). A different
judge model is preferable when accessible; same-model reviewing is supported and
explicitly labeled as a bias limitation. There are up to 12 requests, one per
paired task, with 15-second spacing by default. Provider quota/billing applies.
The judge gets anonymous candidate IDs with balanced randomized presentation
order, the question, synthetic inputs and reference answers. It never sees A/B
labels, provider identity, tool traces or existing scores. Candidate text is
treated as untrusted evidence. Numerical fixtures cover only specified fields;
the judge's ratings are not an independent numerical verification of all prose.

Criteria: correctness, clarity, relevance, cause and effect, limitations, and
next-step usefulness, each scored 0–2 or null when inapplicable. Each rating must
contain an exact quote from the candidate and a rationale. Invalid/ungrounded
quotes reject the review instead of silently contributing to scores. An invalid
review now marks the entire A/B pair unscored and continues to the next task;
both candidates are excluded together. The summary lists excluded pairs and
coverage. This is a judge failure, not evidence that the evaluated bot failed.
On resume, the latest matching saved review is reused or marked unscored without
another API call. Only exact excerpts (allowing edge ellipsis removal) qualify;
paraphrases and internal omissions remain invalid. API failures still pause.

Outputs: review.json (ratings, evidence, improvements, metadata), SUMMARY.md
(per-criterion means and coverage), and traces. Original A/B response files and
human-review fields are not modified. Source/protocol hashes protect resumption.
Missing or failed answer pairs are reported as skipped rather than judged.

If interrupted, continue with:

```bash
node --experimental-strip-types judge.mjs runs/gemini-01 runs/review-01 --resume
```

Display the results as **AI-reviewed explanation quality**, not customer testing
or proof of improved customer understanding. Spot-check quotes and rationales
before presenting; no overall blended score is generated.

### Volunteer protocol (optional later)

Use 6–10 volunteers as an exploratory pilot, not proof of population-wide
superiority. Obtain agreement to participate, use pseudonymous participant IDs,
and avoid collecting real financial/account information.

Rotate conditions using all six orders ABC, ACB, BAC, BCA, CAB, CBA. Use equivalent
task variants with different synthetic values and independently verify their
answers; do not show the same answer repeatedly and mistake recall for learning.
Keep time limits, instructions and facilitator assistance consistent.

Record one study.csv row per participant, condition and task:

- completed: 0 or 1 against a predefined success criterion.
- elapsedSeconds: from task presentation to completion or timeout; record timeout
  and failure in notes rather than dropping the row.
- comprehensionCorrect/comprehensionTotal: score fixed post-task questions.
- confidencePercent: 0–100 confidence in their answer, collected before feedback.
- tradeoffScore: 0–2 using a predefined answer rubric.
- visualAppealScore: 1–5, reported separately from correctness and comprehension.

Suggested comprehension questions: What does APR mean? Why can extra payments
reduce interest? Does an unavailable forecast mean zero months? What assumption
could make the projection differ from actual experience? Score against an agreed
answer key before recruiting, and keep it hidden from participants.

Report raw counts, completion rates, median task times, comprehension scores,
and confidence alongside correctness. Look specifically for confident wrong
answers. Do not infer calibration from confidence alone. Report participant
sample size, ordering, missing observations, and limitations; avoid significance
claims from a small convenience pilot. The CSV is a collection template, not an
automated human-study scoring or statistical-analysis service.

## Future adapters

Add provider-specific runners that export this same response schema while
preserving raw transcripts and metadata. Keep keys in environment variables.
Add UI automation for shared chart/chat values, stale scenario responses,
definition controls, and action approval once the UI exists. Do not fabricate
C-condition results from engine outputs. Version the unsupported-event case
when the time-varying payment engine is implemented, rather than silently
changing its expected behavior during a comparison.
