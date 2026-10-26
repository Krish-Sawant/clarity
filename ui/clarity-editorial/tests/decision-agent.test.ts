import test from "node:test";
import assert from "node:assert/strict";
import { allowedNumbers, inputProblems, keepKnownCitations, toProviderMessages, toToolCall, unverifiedAmounts } from "../src/server/decision-agent";
import type { ChatItem, Session, ToolCall } from "../src/engines/chat/types";

const history: ChatItem[] = [
  { role: "user", text: "Lease at $350/mo or buy used for $15,000?" },
  { role: "assistant", toolCalls: [{ id: "c1", name: "run_simulation", args: {} }], providerMessage: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "run_simulation", arguments: "{}" }, extra_content: { google: { thought_signature: "sig" } } }] } },
  { role: "tool", callId: "c1", name: "run_simulation", result: { options: [{ net_worth_end: 66800 }, { net_worth_end: 73612 }] } },
];

test("figures from the user, tool results, and gaps between options are allowed", () => {
  const allowed = allowedNumbers(history, []);
  assert.deepEqual(unverifiedAmounts("Buying ends at $73,612 vs $66.8k, a $6,812 gap; leasing is $350 a month.", allowed), []);
  assert.deepEqual(unverifiedAmounts("You'd save $90,000 and earn 7% returns.", allowed), ["$90,000", "7%"]);
});

test("percentages need a rate-shaped source, not just any matching number", () => {
  const withRates: ChatItem[] = [
    { role: "user", text: "My card is at 24% and I have 5 months of savings." },
    { role: "tool", callId: "t", name: "set_inputs", result: { applied: { cardApr: 24, years: 5 } } },
  ];
  const allowed = allowedNumbers(withRates, []);
  assert.deepEqual(unverifiedAmounts("Your card charges 24%.", allowed), []);
  assert.deepEqual(unverifiedAmounts("Savings accounts pay around 4-5%.", allowed), ["4-5%"], "5 appears, but never as a rate");
});

test("Gemini's raw replies are replayed with their thought signatures", () => {
  const messages = toProviderMessages(history);
  assert.equal(messages.length, 3);
  assert.match(JSON.stringify(messages[1]), /thought_signature/);
  assert.equal(messages[2].role, "tool");
});

test("scripted-guide tool calls are replayed as text, since they have no signatures", () => {
  const scripted: ChatItem[] = [
    { role: "user", text: "Job in NYC?" },
    { role: "assistant", text: "Let's compare.", toolCalls: [{ id: "m1", name: "pick_scenario", args: { scenario_id: "job-offer" } }] },
    { role: "tool", callId: "m1", name: "pick_scenario", result: { scenario_id: "job-offer" } },
  ];
  const messages = toProviderMessages(scripted);
  assert.equal(messages.length, 2);
  assert.match(String((messages[1] as { content: string }).content), /pick_scenario/);
});

test("citations are split per source and unknown ids are dropped", () => {
  const passages = [{ source_id: "cfpb-rate-increase-69" }, { source_id: "cfpb-change-terms-70" }];
  assert.equal(keepKnownCitations("Rates can't rise [cfpb-rate-increase-69, cfpb-change-terms-70].", passages), "Rates can't rise [cfpb-rate-increase-69] [cfpb-change-terms-70].");
  assert.equal(keepKnownCitations("Made up [cfpb-fake-1] and [cfpb-change-terms-70#2].", passages), "Made up and [cfpb-change-terms-70].");
});

test("set_inputs arrays become typed values", () => {
  const call = toToolCall({ id: "x", type: "function", function: { name: "set_inputs", arguments: JSON.stringify({ inputs: [{ key: "rentA", value: "$2,000" }, { key: "roommateA", value: "true" }, { key: "cityA", value: "austin" }] }) } });
  assert.deepEqual(call.args, { values: { rentA: 2000, roommateA: true, cityA: "austin" } });
});

const empty: Session = { scenarioId: null, values: {}, years: 5 };
const moveOut: ChatItem[] = [{ role: "user", text: "Should I move out to a $1,400 apartment or keep living with my parents and pay them $300?" }];
const call = (id: string, name: string, args: Record<string, unknown> = {}): ToolCall => ({ id, name, args });

test("inputs the user gave pass; made-up inputs are rejected", () => {
  assert.equal(inputProblems(moveOut, empty, [call("p", "pick_scenario", { scenario_id: "move-out" }), call("s", "set_inputs", { values: { rent: 1400, familyRent: 300 } })]), null);
  const made = inputProblems(moveOut, empty, [call("s", "set_inputs", { values: { rent: 1400, utilities: 180 } })]);
  assert.ok(made?.rejected.has("s"));
  assert.match(made!.message, /180/);
});

test("$6k, yearly figures, and picked answers count as the user's numbers", () => {
  const said: ChatItem[] = [{ role: "user", text: "I have $6k saved and insurance is $1,200 a year" }, { role: "user", text: "$3,600/mo, $6k saved" }];
  assert.equal(inputProblems(said, empty, [call("s", "set_inputs", { values: { startingCash: 6000, insurance: 100, takeHome: 3600 } })]), null);
});

test("a simulation can't run on preset defaults the user never gave", () => {
  const early = inputProblems(moveOut, empty, [call("p", "pick_scenario", { scenario_id: "move-out" }), call("s", "set_inputs", { values: { rent: 1400, familyRent: 300 } }), call("r", "run_simulation")]);
  assert.ok(early?.missing.includes("Utilities + internet / mo"));
  assert.ok(!early?.missing.includes("Rent / mo"));
});

test("custom comparisons may not invent amounts, but timing is the model's to set", () => {
  const options = [{ label: "Lease", costs: [{ name: "Lease", monthly: 350, start_month: 1 }] }, { label: "Buy", one_time: [{ name: "Car", amount: 15000, month: 0 }], costs: [{ name: "Insurance", monthly: 140 }] }];
  const custom = inputProblems(history, empty, [call("d", "define_comparison", { title: "Lease vs buy", years: 5, options, assumptions: ["Insurance $140/mo"] })]);
  assert.match(custom!.message, /140/);
  assert.doesNotMatch(custom!.message, /\b(350|15000|5)\b,/);
});
