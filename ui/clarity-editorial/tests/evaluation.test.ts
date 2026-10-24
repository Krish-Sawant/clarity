import test from "node:test";
import assert from "node:assert/strict";
import { factBreakdown, getRecordedPilot } from "../src/lib/evaluation";

test("recorded pilot preserves exact score denominators and missing-versus-wrong distinctions", () => {
  const pilot = getRecordedPilot();
  assert.deepEqual(pilot.conditions.map(({ passed, checks, incorrect, missing }) => ({ passed, checks, incorrect, missing })), [{ passed: 11, checks: 22, incorrect: 3, missing: 8 }, { passed: 21, checks: 22, incorrect: 0, missing: 1 }]);
  assert.equal(pilot.example.expectedInterestCents, 1410);
  assert.ok(pilot.example.answers.find((answer) => answer.condition === "A")?.answer.includes("694 cents"));
  assert.deepEqual(factBreakdown([{ passed: false }, { passed: false, actual: null }, { passed: false, actual: 0 }, { passed: true }]), { missing: 1, incorrect: 2 });
});

test("curated pilot data preserves review coverage and unequal applicability without raw traces", () => {
  const pilot = getRecordedPilot();
  assert.equal(pilot.review.pairs, 9);
  assert.equal(pilot.review.totalPairs, 12);
  assert.equal(pilot.review.excluded.length, 3);
  assert.equal(pilot.review.sameModelJudge, true);
  const cause = pilot.review.criteria.find((row) => row.key === "causeAndEffect")!;
  assert.equal(cause.a.count, 6);
  assert.equal(cause.b.count, 7);
  assert.ok(!JSON.stringify(pilot).includes('"traceFile"'));
  assert.ok(!JSON.stringify(pilot).includes('"protocolHash"'));
});
