import assert from "node:assert/strict";
import { test } from "node:test";
import { amortizedPayment, compare, project } from "./project.ts";
import { SCENARIOS } from "./scenarios.ts";
import { annualTakeHome } from "./tax.ts";
import type { Option } from "./types.ts";

const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;

const simple = (over: Partial<Option> = {}): Option => ({
  label: "x",
  startingCash: 0,
  income: [{ name: "pay", monthly: 3000 }],
  recurring: [{ name: "rent", monthly: 2000 }],
  oneTime: [],
  debts: [],
  assets: [],
  ...over,
});

test("take-home matches the spec's ballpark for NYC $95k and Pittsburgh $78k", () => {
  const nyc = annualTakeHome(95_000, "nyc") / 12;
  const pgh = annualTakeHome(78_000, "pittsburgh") / 12;
  assert.ok(nyc > 5500 && nyc < 5800, `NYC monthly ${nyc}`);
  assert.ok(pgh > 4800 && pgh < 5000, `Pittsburgh monthly ${pgh}`);
  assert.ok(annualTakeHome(78_000, "austin") > annualTakeHome(78_000, "pittsburgh"), "no-income-tax city keeps more");
});

test("surplus accumulates and one-time costs hit month 0", () => {
  const p = project(simple({ startingCash: 5000, oneTime: [{ name: "move", amount: 3000, month: 0 }] }), 12);
  assert.equal(p.points[0].cash, 2000);
  assert.equal(p.points[12].cash, 2000 + 12 * 1000);
  assert.equal(p.upfrontCosts, 3000);
});

test("amortized payment pays a loan off exactly on schedule", () => {
  const pay = amortizedPayment(10_000, 6, 36);
  assert.ok(Math.abs(pay - 304.22) < 0.01, `payment ${pay}`);
  const p = project(simple({ income: [{ name: "pay", monthly: 2000 + pay }], debts: [{ name: "loan", balance: 10_000, aprPct: 6, minPayment: pay }] }), 40);
  assert.equal(p.debtFreeMonth, 36);
});

test("debt is paid from surplus before savings grow", () => {
  const p = project(simple({ debts: [{ name: "card", balance: 2000, aprPct: 0, minPayment: 50 }] }), 6);
  assert.equal(p.debtFreeMonth, 2);
  assert.equal(p.points[2].cash, 0);
  assert.equal(p.points[3].cash, 1000);
});

test("crossover is detected when one option overtakes the other", () => {
  const slowStart = simple({ startingCash: -5000, income: [{ name: "pay", monthly: 3000, annualRaisePct: 40 }] });
  const steady = simple({ income: [{ name: "pay", monthly: 3200 }] });
  const c = compare(slowStart, steady, 60);
  assert.equal(c.leaderAtEnd, "a");
  assert.equal(c.crossovers.length, 1);
});

test("job offer: cheaper city wins at equal raises, NYC can pull ahead with a fast raise track", () => {
  const s = scenario("job-offer");
  const equal = compare(...s.build(s.defaults), 60);
  assert.equal(equal.leaderAtEnd, "b");
  const fast = compare(...s.build({ ...s.defaults, raiseA: 15 }), 60);
  assert.equal(fast.leaderAtEnd, "a");
  assert.ok(fast.crossovers.length >= 1);
});

test("debt vs save: debt first ends richer, savings first reaches the emergency fund sooner", () => {
  const s = scenario("debt-vs-save");
  const c = compare(...s.build(s.defaults), 36);
  assert.ok(c.a.points[36].netWorth > c.b.points[36].netWorth);
  assert.ok((c.a.debtFreeMonth ?? 99) < (c.b.debtFreeMonth ?? 99));
});

test("every scenario builds and projects without NaN", () => {
  for (const s of SCENARIOS) {
    const c = compare(...s.build(s.defaults), s.defaultYears * 12);
    for (const p of [c.a, c.b]) {
      for (const pt of p.points) assert.ok(Number.isFinite(pt.netWorth), `${s.id} ${p.label} month ${pt.month}`);
    }
  }
});
