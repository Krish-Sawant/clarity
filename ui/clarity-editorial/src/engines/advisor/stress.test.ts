import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stressTest } from './stress.ts';
const input = { savings: 12000, monthlyIncome: 4000, monthlyExpenses: 3000, monthlyRent: 1500, horizonMonths: 12 };
test('job loss exhausts savings at month 4 and creates a shortfall in month 5', () => {
  const r = stressTest(input, 'job-loss');
  assert.equal(r.firstZeroMonth, 4); assert.equal(r.firstShortfallMonth, 5);
  assert.equal(r.stressed[12].cash, -24000); assert.equal(r.baseline[12].cash, 24000);
  assert.equal(r.minimumExtraSavings, 24000);
});
test('repair is charged once immediately and can cause an immediate shortfall', () => {
  const r = stressTest(input, 'car-repair');
  assert.equal(r.stressed[0].cash, 10000); assert.equal(r.stressed[12].cash, 22000);
  assert.equal(stressTest({ ...input, savings: 1000 }, 'car-repair').firstShortfallMonth, 0);
});
test('rent rises by 10 percent without charging existing rent twice', () => {
  const r = stressTest(input, 'rent-rise');
  assert.equal(r.extraRent, 150); assert.equal(r.monthlyNet, 850);
  assert.equal(r.stressed[12].cash, 22200);
});
test('baseline can already be in deficit and no shock preserves the path', () => {
  const r = stressTest({ ...input, monthlyIncome: 1000 }, 'baseline');
  assert.deepEqual(r.baseline, r.stressed); assert.equal(r.firstShortfallMonth, 7);
});
test('zero expenses and exact zero cash do not imply a shortfall or infinity', () => {
  const r = stressTest({ ...input, savings: 0, monthlyExpenses: 0, monthlyRent: 0 }, 'job-loss');
  assert.equal(r.firstZeroMonth, 0); assert.equal(r.firstShortfallMonth, null);
  assert.equal(r.minimumExtraSavings, 0);
});
test('invalid money, rent, event and horizons are rejected without mutating inputs', () => {
  const before = JSON.stringify(input);
  stressTest(input, 'rent-rise'); assert.equal(JSON.stringify(input), before);
  for (const savings of [-1, NaN, Infinity, 0.001]) assert.throws(() => stressTest({ ...input, savings }, 'baseline'), RangeError);
  assert.throws(() => stressTest({ ...input, monthlyRent: 4000 }, 'baseline'), RangeError);
  for (const horizonMonths of [0, 121, 1.5]) assert.throws(() => stressTest({ ...input, horizonMonths }, 'baseline'), RangeError);
  assert.throws(() => stressTest(input, 'toString' as 'baseline'), RangeError);
});
test('decimal currency rounds to cents and shortfall beyond the horizon stays unknown', () => {
  const r = stressTest({ savings: 1, monthlyIncome: 0, monthlyExpenses: 0.1, monthlyRent: 0, horizonMonths: 10 }, 'job-loss');
  assert.equal(r.stressed[10].cash, 0); assert.equal(r.firstShortfallMonth, null);
});
