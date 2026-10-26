import test from "node:test";
import assert from "node:assert/strict";
import { compareLoanAffordability } from "../src/engines/advisor/loan";
import { compareCardReadiness } from "../src/engines/advisor/credit";
import { customStressTest, stressTest } from "../src/engines/advisor/stress";
import { checkIn, saveTheRaise } from "../src/engines/advisor/checkins";
import { createLoanComparison, loanDefaults, loanDemo, modeledLoanActivity } from "../src/api/loan";
import { cardActivity, cardDemo, createCardReadiness, unansweredReadiness } from "../src/api/credit";
import { createStressTest, shockDefaults, stressDefaults } from "../src/api/stress";
import { createCheckIn, createRaisePreview, planDemo } from "../src/api/checkins";

test("loan adapter returns the merged comparison for modeled months", () => {
  const result = createLoanComparison(loanDefaults);
  const expected = compareLoanAffordability(modeledLoanActivity(loanDefaults), loanDemo.asOf, loanDemo.coveredFrom, { aprPercent: 7, termMonths: 60, cashCents: 1_200_000 });
  assert.deepEqual({ ...result, headline: undefined }, { ...expected, headline: undefined });
  assert.equal(result.status, "compare");
  assert.equal(result.cashFlow.monthlySpendingCents, 285_000);
  assert.equal(result.cashFlow.monthlyDebtPaymentCents, 20_000);
  assert.ok(result.scenarios && result.scenarios.lender.principalCents > result.scenarios.comfortable.principalCents);
  assert.match(result.headline, /A lender might approve/);
  assert.equal(createLoanComparison({ ...loanDefaults, savings: 1000 }).status, "not_yet");
  assert.equal(createLoanComparison({ ...loanDefaults, monthlySpending: 3500 }).status, "not_yet");
});

test("loan adapter rejects malformed amounts, rates and terms", () => {
  for (const patch of [{ monthlyTakeHome: 0 }, { savings: -1 }, { savings: "12000" }, { monthlySpending: 0.001 }, { aprPercent: 101 }, { aprPercent: "7" }, { termMonths: 11 }, { termMonths: 60.5 }, { grossMonthly: 0 }]) {
    assert.throws(() => createLoanComparison({ ...loanDefaults, ...patch }), RangeError);
  }
  assert.throws(() => createLoanComparison(null), RangeError);
});

test("card adapter gates the merged comparison on readiness answers", () => {
  const unanswered = createCardReadiness({ readiness: unansweredReadiness, includeInterestExample: false });
  assert.deepEqual(unanswered.result, compareCardReadiness(cardDemo.transactions, cardDemo.asOf, cardDemo.coveredFrom, unansweredReadiness));
  assert.equal(unanswered.result.status, "needs_information");
  assert.ok(unanswered.moment);
  const ready = { repayment: "full", missedPayments: "no", historyConfirmed: "yes" };
  const compared = createCardReadiness({ readiness: ready, includeInterestExample: false }).result;
  assert.equal(compared.status, "compare");
  assert.equal(compared.estimates.length, 3);
  const flagged = createCardReadiness({ readiness: ready, includeInterestExample: true });
  assert.equal(flagged.result.status, "not_yet");
  assert.equal(flagged.activity.length, cardActivity(false).length + 1);
  for (const invalid of [null, { readiness: ready }, { readiness: { ...ready, repayment: "sometimes" }, includeInterestExample: false }]) assert.throws(() => createCardReadiness(invalid), RangeError);
});

test("stress adapter returns merged preset and custom projections", () => {
  assert.deepEqual(createStressTest({ ...stressDefaults, event: "job-loss" }), stressTest(stressDefaults, "job-loss"));
  assert.equal(createStressTest({ ...stressDefaults, event: "job-loss" }).firstShortfallMonth, 5);
  assert.deepEqual(createStressTest({ ...stressDefaults, shock: shockDefaults }), customStressTest(stressDefaults, shockDefaults));
  for (const invalid of [{ ...stressDefaults, event: "meteor" }, { ...stressDefaults, savings: -1, event: "baseline" }, { ...stressDefaults, horizonMonths: 121, event: "baseline" }, { ...stressDefaults, shock: { ...shockDefaults, startMonth: "1" } }, { ...stressDefaults, shock: { ...shockDefaults, oneTimeCost: -5 } }]) {
    assert.throws(() => createStressTest(invalid), RangeError);
  }
});

test("check-in adapters return merged raise and progress results", () => {
  assert.deepEqual(createRaisePreview({ previousMonthlyPay: 3000, currentMonthlyPay: 3400, confirmedRecurring: true }), saveTheRaise(3000, 3400, true));
  assert.equal(createRaisePreview({ previousMonthlyPay: 3000, currentMonthlyPay: 3400, confirmedRecurring: false }).suggestedSaving, 0);
  const months = [{ saved: 400, dining: 420 }, { saved: 100, dining: 300 }];
  assert.deepEqual(createCheckIn({ plan: planDemo, months }), checkIn(planDemo, months));
  assert.throws(() => createCheckIn({ plan: planDemo, months: [{ saved: -5000, dining: 0 }] }), RangeError);
  assert.throws(() => createCheckIn({ plan: planDemo, months: [{ saved: "100", dining: 0 }] }), RangeError);
  assert.throws(() => createRaisePreview({ previousMonthlyPay: 3000, currentMonthlyPay: 3400, confirmedRecurring: "yes" }), RangeError);
});
