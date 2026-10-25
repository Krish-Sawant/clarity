import test from "node:test";
import assert from "node:assert/strict";
import { allowedNumbers, keepKnownCitations, toProviderMessages, toToolCall, unverifiedAmounts } from "../src/server/decision-agent";
import type { ChatItem } from "../../../frontend/src/lib/chat/types";

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
