import test from "node:test";
import assert from "node:assert/strict";
import { detect, plan } from "../../../frontend/src/lib/advisor/engine";
import mergedDemo from "../../../frontend/src/lib/advisor/demo.json";
import { advisorDemo, createAdvisorPlan, detectAdvisorSignals, getAdvisorSignals, type AdvisorMoment, type AdvisorPlanInputs } from "../src/api/advisor";
import { advisorAdapter, backendService, branchIntegrationStatus } from "../src/api/services";

const planInputs = { income: 4800, expenses: 3580, cash: 5100, annualRate: 4 };
const cloneDemo = () => structuredClone(advisorDemo);

test("advisor adapter uses the actual merged fixture and engine for all five sample moments", () => {
  assert.deepEqual(advisorDemo, mergedDemo);
  assert.deepEqual(getAdvisorSignals(), detect(mergedDemo.transactions, mergedDemo.snapshots, mergedDemo.asOf));
  assert.deepEqual(getAdvisorSignals().map((signal) => signal.kind), ["new-job", "moving", "overspending", "student-loan", "idle-cash"]);
  assert.ok(getAdvisorSignals().every((signal) => signal.evidence.length > 0));
});

test("adapter preserves stable signals when activity is reordered and does not mutate inputs", () => {
  const input = cloneDemo();
  const before = structuredClone(input);
  assert.deepEqual(detectAdvisorSignals({ ...input, transactions: [...input.transactions].reverse(), snapshots: [...input.snapshots].reverse() }), getAdvisorSignals());
  detectAdvisorSignals(input);
  assert.deepEqual(input, before);
});

test("adapter preserves upstream planner outputs and the 610-dollar sample result", () => {
  const actual = createAdvisorPlan("new-job", planInputs);
  assert.deepEqual(actual, plan("new-job", 4800, 3580, 5100, 4));
  assert.equal(actual.monthly, 610);
  assert.equal(actual.surplus, 1220);
  assert.equal(actual.gap, 5640);
  assert.equal(actual.interest, 204);
  for (const kind of ["new-job", "moving", "overspending", "student-loan", "idle-cash"] as AdvisorMoment[]) {
    assert.deepEqual(createAdvisorPlan(kind, { income: 100, expenses: 200, cash: 0, annualRate: 0 }), plan(kind, 100, 200, 0, 0));
    assert.equal(createAdvisorPlan(kind, { income: 100, expenses: 200, cash: 0, annualRate: 0 }).monthly, 0);
  }
});

test("planner discloses the actual engine heuristic even when the illustrative cushion is filled", () => {
  const result = createAdvisorPlan("idle-cash", { income: 500, expenses: 100, cash: 1000, annualRate: 4 });
  assert.equal(result.gap, 0);
  assert.equal(result.monthly, 200);
  assert.equal(result.interest, 40);
});

test("valid empty, historic, and future-filtered datasets preserve the source engine behavior", () => {
  assert.deepEqual(detectAdvisorSignals({ asOf: "2026-10-24", transactions: [], snapshots: [] }), []);
  assert.deepEqual(detectAdvisorSignals({ ...advisorDemo, asOf: "2026-06-30" }), []);
  const future = cloneDemo();
  future.transactions.push({ id: "future-income", date: "2027-01-01", amount: 50000, merchant: "Future employer", category: "payroll" });
  future.snapshots.push({ date: "2027-01-01", balance: 50000 });
  assert.deepEqual(detectAdvisorSignals(future), getAdvisorSignals());
});

test("activity boundary rejects invalid calendar dates instead of lexical-date false signals", () => {
  for (const asOf of ["2026-02-30", "2026-13-01", "2026-00-01", "2026-1-1", "October 24, 2026", ["2026-10-24"]]) {
    assert.throws(() => detectAdvisorSignals({ ...advisorDemo, asOf }), /valid.*date/i);
  }
  const invalid = cloneDemo();
  invalid.transactions[0].date = "2026-02-29";
  assert.throws(() => detectAdvisorSignals(invalid), /calendar date/i);
  const validLeap = { asOf: "2024-02-29", transactions: [], snapshots: [{ date: "2024-02-29", balance: 100 }] };
  assert.deepEqual(detectAdvisorSignals(validLeap), []);
});

test("activity boundary rejects duplicate IDs or snapshot dates, blank identity fields and malformed categories", () => {
  const duplicate = cloneDemo();
  duplicate.transactions.push({ ...duplicate.transactions[0] });
  assert.throws(() => detectAdvisorSignals(duplicate), /unique/i);
  const duplicateSnapshot = cloneDemo();
  duplicateSnapshot.snapshots.push({ ...duplicateSnapshot.snapshots[0], balance: 100 });
  assert.throws(() => detectAdvisorSignals(duplicateSnapshot), /snapshot dates must be unique/i);
  for (const update of [{ id: "" }, { merchant: "   " }, { category: "Payroll" }, { category: ["payroll"] }, { id: 7 }]) {
    const invalid = cloneDemo();
    Object.assign(invalid.transactions[0], update);
    assert.throws(() => detectAdvisorSignals(invalid), /transaction/i);
  }
});

test("activity boundary rejects non-finite and coerced transaction or snapshot amounts", () => {
  for (const value of [NaN, Infinity, -Infinity, "3600", null, 1_000_000_001]) {
    const invalidTransaction = cloneDemo();
    Object.assign(invalidTransaction.transactions[0], { amount: value });
    assert.throws(() => detectAdvisorSignals(invalidTransaction), /transaction/i);
    const invalidSnapshot = cloneDemo();
    Object.assign(invalidSnapshot.snapshots[0], { balance: value });
    assert.throws(() => detectAdvisorSignals(invalidSnapshot), /snapshot/i);
  }
});

test("planner boundary rejects invalid moment types and numeric input before source invocation", () => {
  for (const kind of ["unknown", ["new-job"], null, 1]) assert.throws(() => createAdvisorPlan(kind as AdvisorMoment, planInputs), /supported advisor moment/i);
  for (const update of [{ income: -1 }, { expenses: NaN }, { cash: Infinity }, { annualRate: 101 }, { annualRate: -1 }, { income: "4800" }, { annualRate: "4" }]) {
    assert.throws(() => createAdvisorPlan("new-job", { ...planInputs, ...update } as AdvisorPlanInputs), /non-negative USD/i);
  }
  assert.throws(() => createAdvisorPlan("new-job", null as unknown as AdvisorPlanInputs), /non-negative USD/i);
});

test("merged local status and async adapter do not enable unavailable HTTP capabilities", async () => {
  const status = branchIntegrationStatus.find((item) => item.id === "proactive-advisor");
  assert.equal(status?.status, "available-local");
  assert.equal(status?.branch, "main");
  assert.equal(branchIntegrationStatus.find((item) => item.id === "deterministic-calculations")?.status, "waiting-on-branch");
  assert.deepEqual(await advisorAdapter.getSignals(), getAdvisorSignals());
  assert.deepEqual(await advisorAdapter.getPlan("new-job", planInputs), createAdvisorPlan("new-job", planInputs));
  assert.ok(Object.values(backendService.capabilities).every((capability) => capability === false));
});
