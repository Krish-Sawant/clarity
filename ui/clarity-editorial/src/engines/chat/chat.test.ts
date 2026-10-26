import assert from "node:assert/strict";
import { test } from "node:test";
import { runAgentLoop, type LoopEvent } from "./loop.ts";
import { decide, parseAmounts, routeQuestion } from "./mockAgent.ts";
import { EMPTY_SESSION, runTool } from "./tools.ts";
import type { Agent, Block, ChatItem, Session } from "./types.ts";

const agent: Agent = async (history, session) => decide(history, session);

// Drives a conversation the way the UI does and returns the blocks shown per message.
async function converse(messages: string[]) {
  let history: ChatItem[] = [];
  let session: Session = EMPTY_SESSION;
  const shown: Block[][] = [];
  for (const text of messages) {
    const blocks: Block[] = [];
    const onEvent = (e: LoopEvent) => e.kind === "block" && blocks.push(e.block);
    ({ history, session } = await runAgentLoop(agent, [...history, { role: "user", text }], session, onEvent));
    shown.push(blocks);
  }
  return { session, shown };
}

const types = (blocks: Block[]) => blocks.map((b) => b.type);

test("routes the demo questions to the right scenario", () => {
  assert.equal(routeQuestion("Should I take the NYC offer at $95k or the Pittsburgh offer at $78k?"), "job-offer");
  assert.equal(routeQuestion("Should I finance a newer car or keep driving my old one?"), "car");
  assert.equal(routeQuestion("Is a master's degree worth it?"), "grad-school");
  assert.equal(routeQuestion("Should I move out or keep living with my parents?"), "move-out");
  assert.equal(routeQuestion("Should I pay off my credit card or build an emergency fund?"), "debt-vs-save");
  assert.equal(routeQuestion("Should I buy a boat?"), null);
});

test("parses money, percents and durations", () => {
  assert.deepEqual(parseAmounts("about $8k saved, $3,000 on a card"), [
    { value: 8000, unit: "money" },
    { value: 3000, unit: "money" },
  ]);
  assert.deepEqual(parseAmounts("maybe 10% raises over 2 years"), [
    { value: 10, unit: "pct" },
    { value: 2, unit: "years" },
  ]);
});

test("Maya's demo flow: question → 2 follow-ups → results → what-if", async () => {
  const { session, shown } = await converse([
    "Should I take the NYC offer at $95k or the Pittsburgh offer at $78k?",
    "About $8k saved, $3k on a card",
    "New York City, $95k grows faster (~12% a year)",
    "What if I get a roommate in NYC?",
  ]);
  assert.deepEqual(types(shown[0]), ["question"]);
  assert.deepEqual(types(shown[1]), ["question"]);
  const q2 = shown[1][0] as Extract<Block, { type: "question" }>;
  assert.ok(q2.choices.includes("New York City, $95k grows faster (~12% a year)"), "choices use the option labels");
  assert.deepEqual(types(shown[2]), ["playground", "chart", "breakdown", "table", "message"]);
  assert.deepEqual(types(shown[3]), ["chart", "table", "message"]);
  assert.equal(session.values.cityA, "nyc");
  assert.equal(session.values.salaryB, 78_000);
  assert.equal(session.values.rentB, 1300);
  assert.equal(session.values.raiseA, 12);
  assert.equal(session.values.roommateA, true);
});

test("free-text answers land on the right fields", async () => {
  const { session } = await converse([
    "NYC at $95k or Pittsburgh at $78k?",
    "I have $3k saved and no debt",
    "Pittsburgh grows faster, maybe 10%",
  ]);
  assert.equal(session.values.startingCash, 3000);
  assert.equal(session.values.cardBalance, 0);
  assert.equal(session.values.raiseB, 10);
  assert.equal(session.values.raiseA, 3);
});

test("durations in years become months", async () => {
  const { session } = await converse(["Is grad school worth it?", "$3,500 now and $6,000 after", "1.5 years and $40k a year"]);
  assert.equal(session.values.schoolMonths, 18);
  assert.equal(session.values.tuitionPerYear, 40_000);
});

test("unknown questions get a plain-text reply, and the next supported question starts", async () => {
  const { session, shown } = await converse(["Should I buy a boat?", "Should I finance a newer car or keep driving my old one?"]);
  assert.deepEqual(shown[0], []);
  assert.equal(session.scenarioId, "car");
});

test("set_inputs clamps to field ranges and rejects unknown fields", () => {
  const picked = runTool({ id: "1", name: "pick_scenario", args: { scenario_id: "debt-vs-save" } }, EMPTY_SESSION).session;
  const out = runTool({ id: "2", name: "set_inputs", args: { values: { cardApr: 500, bogus: 1, years: 4 } } }, picked);
  assert.equal(out.session.values.cardApr, 36);
  assert.equal(out.session.years, 4);
  assert.deepEqual((out.result as { rejected: string[] }).rejected, ["bogus"]);
});

test("tools refuse to run before a scenario is picked", () => {
  const out = runTool({ id: "1", name: "run_simulation", args: {} }, EMPTY_SESSION);
  assert.ok((out.result as { error?: string }).error);
});
