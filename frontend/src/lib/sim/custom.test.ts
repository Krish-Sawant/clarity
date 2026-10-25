import assert from "node:assert/strict";
import { test } from "node:test";
import { runTool } from "../chat/tools.ts";
import { customScenario, lookupScenario, parseCustomSpec } from "./custom.ts";
import { compare } from "./project.ts";
import { budgetRows } from "./summary.ts";

const leaseVsBuy = {
  title: "Lease vs buy used",
  years: 3,
  options: [
    { label: "Lease", starting_cash: 20000, income: [{ name: "Pay", amount: 3800, basis: "monthly_take_home" }], costs: [{ name: "Living", monthly: 2000 }, { name: "Lease", monthly: 350 }] },
    { label: "Buy used", starting_cash: 20000, income: [{ name: "Pay", amount: 3800, basis: "monthly_take_home" }], costs: [{ name: "Living", monthly: 2000 }],
      one_time: [{ name: "Car", amount: 15000, month: 0 }], assets: [{ name: "Car", value: 15000, annual_depreciation_pct: 15 }] },
  ],
  assumptions: ["Living costs of $2,000/mo are an estimate."],
};

test("custom spec parses into an editable scenario that compare() can run", () => {
  const parsed = parseCustomSpec(leaseVsBuy);
  assert.ok("spec" in parsed);
  const scenario = customScenario(parsed.spec);
  assert.deepEqual(scenario.groupLabels, { a: "Lease", b: "Buy used" });
  assert.equal(scenario.defaults.b_once0, 15000);
  const [a, b] = scenario.build(scenario.defaults);
  const result = compare(a, b, 36);
  // Lease: (3800 - 2350) * 36 saved on top of 20k; no assets.
  assert.equal(Math.round(result.a.points[36].netWorth), 20000 + 1450 * 36);
  assert.equal(result.b.upfrontCosts, 15000);
});

test("month-1 budget breakdown adds up to what's left to save", () => {
  const parsed = parseCustomSpec(leaseVsBuy);
  assert.ok("spec" in parsed);
  const options = customScenario(parsed.spec).build(customScenario(parsed.spec).defaults);
  const rows = budgetRows(options, compare(...options, 36));
  assert.deepEqual(rows.map((r) => r.label), ["Take-home pay", "Living", "Lease", "Left to save"]);
  const lease = Object.fromEntries(rows.map((r) => [r.label, r.a]));
  assert.equal(lease["Take-home pay"] - lease.Living - lease.Lease, lease["Left to save"]);
  assert.equal(rows.find((r) => r.label === "Lease")!.b, 0, "a cost only one option has shows as 0 for the other");
});

test("editing a field changes the rebuilt option", () => {
  const parsed = parseCustomSpec(leaseVsBuy);
  assert.ok("spec" in parsed);
  const scenario = customScenario(parsed.spec);
  const [a] = scenario.build({ ...scenario.defaults, a_cost1: 500 });
  assert.equal(a.recurring[1].monthly, 500);
});

test("bad specs are rejected and out-of-range amounts are clamped", () => {
  assert.deepEqual(parseCustomSpec({ options: [leaseVsBuy.options[0]] }), { error: "Provide exactly two options to compare." });
  assert.ok("error" in parseCustomSpec({ options: [{ label: "Empty" }, leaseVsBuy.options[1]] }));
  assert.ok("error" in parseCustomSpec({ options: [{ label: "x", costs: [{ name: "c" }] }, leaseVsBuy.options[1]] }), "missing amount");
  const parsed = parseCustomSpec({ ...leaseVsBuy, years: 40, options: [{ ...leaseVsBuy.options[0], starting_cash: -5 }, leaseVsBuy.options[1]] });
  assert.ok("spec" in parsed);
  assert.equal(parsed.spec.years, 10);
  assert.equal(parsed.spec.a.startingCash, 0);
});

test("gross salaries go through the tax model", () => {
  const parsed = parseCustomSpec({ ...leaseVsBuy, options: [
    { label: "Austin", income: [{ name: "Salary", amount: 80000, basis: "annual_gross", tax_city: "austin" }], costs: [{ name: "Rent", monthly: 1500 }] },
    { label: "Elsewhere", income: [{ name: "Salary", amount: 80000, basis: "annual_gross", state_local_tax_pct: 5 }], costs: [{ name: "Rent", monthly: 1500 }] },
  ] });
  assert.ok("spec" in parsed);
  const [a, b] = customScenario(parsed.spec).build(customScenario(parsed.spec).defaults);
  const monthly = (o: typeof a) => o.income[0].schedule![0];
  assert.ok(monthly(a) < 80000 / 12, "federal tax applied");
  assert.ok(Math.abs(monthly(a) - monthly(b) - (80000 * 0.05) / 12) < 0.01, "flat 5% state/local on the second");
});

test("define_comparison tool registers the scenario and starts a session", () => {
  const out = runTool({ id: "1", name: "define_comparison", args: leaseVsBuy }, { scenarioId: null, values: {}, years: 5 });
  assert.ok(out.session.scenarioId?.startsWith("custom-"));
  assert.equal(out.session.years, 3);
  assert.ok(lookupScenario(out.session.scenarioId));
  const sim = runTool({ id: "2", name: "run_simulation", args: {} }, out.session);
  assert.equal((sim.result as { options: unknown[] }).options.length, 2);
});
