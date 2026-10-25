# AI scenario integration contract

`scenario-ai.ts` is the boundary between untrusted AI output and the existing deterministic engines. It is provider-independent and contains no API credentials or model calls. The current What if UI still uses its forms; a live conversation is not wired yet.

## Wiring the conversation

1. Send the user's description to a server-only model endpoint using `SCENARIO_AI_INSTRUCTIONS`. Limit input/output size, handle provider errors and rate limits, and never send API keys to the browser.
2. Parse JSON and call `prepareScenario`. Malformed output is an error, not a reason to guess missing numbers. `needs_information.missing` identifies fields for follow-up questions. `unsupported` must be explained instead of mapped to a misleading calculation.
3. Render `ready_for_review.proposal` as editable assumptions. Resolve month numbers relative to the profile's planning date explicitly. Ask whether a purchase has already posted: current savings must already include posted purchases.
4. Take confirmation from a user click. Any change to the proposal OR customer context invalidates it. Never read a confirmation flag from model JSON.
5. Build `ScenarioContext` from app-owned validated data, then call `runConfirmedScenario`. For production APIs, read authenticated account context server-side; this demo's confirmation flag is workflow gating, not a security or authorization mechanism.
6. Render only the returned result kind: stress timeline, purchase goal delay, or loan comparison. Preserve `dataSource`, assumptions, and missing-data states. The model can explain returned results but must not substitute its own calculated numbers.

An AI response cannot overwrite balances, transactions or plan inputs through this contract. No transfer, application, or saved-plan change is performed. RAG guidance is separate from calculation outputs and should carry its own source attribution.

## Limits

Stress: one signed recurring-change interval within 24 months, one cost at its start. Purchase: cash-funded savings impact only. Loan: illustrative borrowing limits based on supplied history, not underwriting or comparison to a specific requested loan. Multiple events or unsupported financing require another engine capability, not an improvised AI answer.

## Example model proposal

```json
{"kind":"stress","label":"Three months off work","incomeChange":-3400,"expenseChange":0,"oneTimeCost":1500,"startMonth":2,"durationMonths":3}
```

Zero expense change must be confirmed or stated by the user; missing amounts should remain null during clarification. All money in the proposal is USD dollars. Loan cents conversion occurs only inside the adapter.

Tests: `node --experimental-strip-types --test src/lib/advisor/scenario-ai.test.ts` from frontend.
