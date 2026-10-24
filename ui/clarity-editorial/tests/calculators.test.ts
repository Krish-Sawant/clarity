import test from "node:test";
import assert from "node:assert/strict";
import { calculateDebt, calculateSavings, compareExtraPayment } from "../../../finance.ts";
import { calculateDebtPlan, calculateSavingsPlan, dollarsToCents, type DebtPlanInputs, type SavingsPlanInputs } from "../src/api/calculators";
import { debtPayoff } from "../src/lib/finance";

const debt: DebtPlanInputs = { balance: 5000, apr: 24, payment: 150, extraPayment: 100, maxMonths: 1200 };
const savings: SavingsPlanInputs = { current: 200, target: 1000, monthlyContribution: 100, apy: 0, maxMonths: 120 };

test("calculator dollar boundary preserves exact cents without coercion or extra precision", () => {
  assert.equal(dollarsToCents(0), 0);
  assert.equal(dollarsToCents(0.29), 29);
  assert.equal(dollarsToCents(1500.25), 150025);
  assert.equal(dollarsToCents(10_000_000_000), 1_000_000_000_000);
  for (const invalid of ["100", null, undefined, NaN, Infinity, -1, 0.001, 0.000000001, 1.005, 10_000_000_000.01]) {
    assert.throws(() => dollarsToCents(invalid), RangeError);
  }
});

test("debt adapter consumes the actual merged comparison outputs and full schedules", () => {
  const expected = compareExtraPayment({ balanceCents: 500000, aprPercent: 24, monthlyPaymentCents: 15000, maxMonths: 1200 }, 10000);
  const actual = calculateDebtPlan(debt);
  assert.deepEqual(actual, expected);
  assert.equal(actual.baseline.monthsToPayoff, 56);
  assert.equal(actual.accelerated.monthsToPayoff, 26);
  assert.equal(actual.interestSavedCents, 187280);
  for (const result of [actual.baseline, actual.accelerated]) {
    assert.equal(result.totalPaymentsCents, 500000 + result.totalInterestCents);
    assert.equal(result.schedule.at(-1)?.closingCents, result.remainingCents);
  }
});

test("zero-rate, zero-balance and capped final-payment semantics survive the adapter", () => {
  const result = calculateDebtPlan({ balance: 1000, apr: 0, payment: 100, extraPayment: 100, maxMonths: 1200 });
  assert.equal(result.baseline.monthsToPayoff, 10);
  assert.equal(result.accelerated.monthsToPayoff, 5);
  assert.equal(result.monthsSaved, 5);
  assert.equal(result.interestSavedCents, 0);
  const capped = calculateDebtPlan({ balance: 100, apr: 0, payment: 30, extraPayment: 0, maxMonths: 1200 });
  assert.equal(capped.baseline.schedule.at(-1)?.paymentCents, 1000);
  const empty = calculateDebtPlan({ balance: 0, apr: 24, payment: 0, extraPayment: 0, maxMonths: 1 });
  assert.equal(empty.baseline.monthsToPayoff, 0);
  assert.equal(empty.monthsSaved, 0);
  assert.deepEqual(empty.baseline.schedule, []);
});

test("insufficient payments and partial horizons preserve null payoff and comparison values", () => {
  const low = calculateDebtPlan({ balance: 1000, apr: 12, payment: 10, extraPayment: 100, maxMonths: 1200 });
  assert.equal(low.baseline.status, "payment_too_low");
  assert.equal(low.baseline.monthsToPayoff, null);
  assert.equal(low.interestSavedCents, null);
  assert.equal(low.monthsSaved, null);
  assert.equal(low.baseline.remainingCents, 100000);
  const partial = calculateDebtPlan({ ...debt, maxMonths: 1 });
  assert.equal(partial.baseline.status, "horizon_exceeded");
  assert.equal(partial.baseline.monthsToPayoff, null);
  assert.equal(partial.interestSavedCents, null);
  assert.equal(partial.baseline.schedule.length, 1);
});

test("savings adapter preserves the original month-end contribution and APY calculations", () => {
  assert.deepEqual(calculateSavingsPlan(savings), calculateSavings({ currentCents: 20000, targetCents: 100000, monthlyContributionCents: 10000, apyPercent: 0, maxMonths: 120 }));
  assert.equal(calculateSavingsPlan(savings).monthsToGoal, 8);
  const growth = calculateSavingsPlan({ current: 1000, target: 1010, monthlyContribution: 0, apy: 12.68250301319698, maxMonths: 12 });
  assert.equal(growth.monthsToGoal, 1);
  assert.equal(growth.totalInterestCents, 1000);
  const firstDeposit = calculateSavingsPlan({ current: 0, target: 100, monthlyContribution: 100, apy: 5, maxMonths: 12 });
  assert.equal(firstDeposit.totalInterestCents, 0);
});

test("savings distinguishes a met goal, no progress and an unfinished projection", () => {
  assert.equal(calculateSavingsPlan({ ...savings, current: 1000 }).monthsToGoal, 0);
  const stalled = calculateSavingsPlan({ ...savings, current: 0, monthlyContribution: 0, apy: 5 });
  assert.equal(stalled.status, "no_progress");
  assert.equal(stalled.monthsToGoal, null);
  const partial = calculateSavingsPlan({ ...savings, monthlyContribution: 1, maxMonths: 2 });
  assert.equal(partial.status, "horizon_exceeded");
  assert.equal(partial.monthsToGoal, null);
  assert.equal(partial.finalBalanceCents, 20200);
});

test("rate, horizon, shape and amount validation reject invalid inputs before source execution", () => {
  for (const patch of [{ apr: 1001 }, { apr: "24" }, { payment: 0.001 }, { extraPayment: -1 }, { maxMonths: 0 }, { maxMonths: 1201 }, { maxMonths: 1.5 }, { balance: Infinity }]) {
    assert.throws(() => calculateDebtPlan({ ...debt, ...patch } as DebtPlanInputs), RangeError);
  }
  for (const patch of [{ apy: -1 }, { apy: NaN }, { current: null }, { monthlyContribution: "100" }, { target: 0.001 }]) {
    assert.throws(() => calculateSavingsPlan({ ...savings, ...patch } as SavingsPlanInputs), RangeError);
  }
  assert.throws(() => calculateDebtPlan(null as unknown as DebtPlanInputs), RangeError);
  assert.throws(() => calculateSavingsPlan(null as unknown as SavingsPlanInputs), RangeError);
});

test("existing lesson debt helper now delegates shared engine without changing its USD contract", () => {
  const original = calculateDebt({ balanceCents: 150000, aprPercent: 22, monthlyPaymentCents: 4000 });
  assert.deepEqual(debtPayoff(1500, 22, 40), { months: original.monthsToPayoff, interest: original.totalInterestCents / 100, payoff: original.status === "paid_off" });
  assert.deepEqual(debtPayoff(1500, 22, 20), { months: null, interest: 0, payoff: false });
});
