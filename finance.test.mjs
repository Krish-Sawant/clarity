import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDebt, compareExtraPayment, calculateSavings } from './finance.ts';

test('zero APR and partial final payment', () => {
  const r = calculateDebt({ balanceCents: 100_00, aprPercent: 0, monthlyPaymentCents: 30_00 });
  assert.equal(r.monthsToPayoff, 4);
  assert.equal(r.schedule.at(-1).paymentCents, 10_00);
  assert.equal(r.totalInterestCents, 0);
});
test('hand-computed monthly interest and conservation of money', () => {
  const r = calculateDebt({ balanceCents: 1000_00, aprPercent: 12, monthlyPaymentCents: 600_00 });
  assert.equal(r.schedule[0].interestCents, 10_00);
  assert.equal(r.schedule[1].interestCents, 4_10);
  assert.equal(r.totalPaymentsCents, 1014_10);
  assert.equal(r.totalPaymentsCents, 1000_00 + r.totalInterestCents);
  for (const row of r.schedule)
    assert.equal(row.openingCents + row.interestCents - row.paymentCents, row.closingCents);
});
test('unpayable and truncated results do not invent payoff or savings', () => {
  const input = { balanceCents: 1000_00, aprPercent: 12, monthlyPaymentCents: 10_00 };
  assert.equal(calculateDebt(input).status, 'payment_too_low');
  assert.equal(compareExtraPayment(input, 100_00).interestSavedCents, null);
  const r = calculateDebt({ ...input, monthlyPaymentCents: 100_00, maxMonths: 1 });
  assert.equal(r.status, 'horizon_exceeded');
  assert.equal(r.monthsToPayoff, null);
});
test('extra payments shorten payoff and lower interest for demo profile', () => {
  const r = compareExtraPayment({ balanceCents: 5000_00, aprPercent: 24, monthlyPaymentCents: 150_00 }, 100_00);
  assert.ok(r.monthsSaved > 0);
  assert.ok(r.interestSavedCents > 0);
  console.log('Demo:', JSON.stringify({ baselineMonths: r.baseline.monthsToPayoff,
    acceleratedMonths: r.accelerated.monthsToPayoff, interestSavedCents: r.interestSavedCents }));
});
test('already paid debt and already met savings goal take zero months', () => {
  assert.equal(calculateDebt({ balanceCents: 0, aprPercent: 24, monthlyPaymentCents: 0 }).monthsToPayoff, 0);
  assert.equal(calculateSavings({ currentCents: 100, targetCents: 100, monthlyContributionCents: 0 }).monthsToGoal, 0);
});
test('savings deposits are month-end and no-growth goal is exact', () => {
  const r = calculateSavings({ currentCents: 200_00, targetCents: 1000_00, monthlyContributionCents: 100_00 });
  assert.equal(r.monthsToGoal, 8);
  assert.equal(r.finalBalanceCents, 1000_00);
  const first = calculateSavings({ currentCents: 0, targetCents: 100_00, monthlyContributionCents: 100_00, apyPercent: 5 });
  assert.equal(first.totalInterestCents, 0);
});
test('12.68250301319698% APY implies 1% monthly growth', () => {
  const r = calculateSavings({ currentCents: 1000_00, targetCents: 1010_00,
    monthlyContributionCents: 0, apyPercent: 12.68250301319698 });
  assert.equal(r.monthsToGoal, 1);
  assert.equal(r.totalInterestCents, 10_00);
});
test('savings distinguishes no progress from a horizon limit', () => {
  assert.equal(calculateSavings({ currentCents: 0, targetCents: 100, monthlyContributionCents: 0, apyPercent: 5 }).status, 'no_progress');
  assert.equal(calculateSavings({ currentCents: 0, targetCents: 100, monthlyContributionCents: 1, maxMonths: 2 }).status, 'horizon_exceeded');
});
test('invalid amounts, rates and horizons are rejected', () => {
  const valid = { balanceCents: 10000, aprPercent: 10, monthlyPaymentCents: 1000 };
  for (const change of [{balanceCents: -1}, {balanceCents: 0.5}, {aprPercent: NaN},
    {aprPercent: Infinity}, {monthlyPaymentCents: -1}, {maxMonths: 0}])
    assert.throws(() => calculateDebt({ ...valid, ...change }), RangeError);
  assert.throws(() => calculateSavings({ currentCents: 0, targetCents: 100, monthlyContributionCents: 1, apyPercent: -1 }), RangeError);
});
