import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIn, saveTheRaise } from './checkins.ts';
const plan = { startingSavings: 1000, goal: 3000, monthlySaving: 200, diningBudget: 300 };
test('raise requires confirmation and computes the chosen share', () => {
  assert.equal(saveTheRaise(3000, 3400, false).suggestedSaving, 0);
  assert.equal(saveTheRaise(3000, 3400, true).annualSaving, 2400);
  assert.equal(saveTheRaise(3400, 3000, true).status, 'no_raise');
  assert.throws(() => saveTheRaise(3000, 3400, true, 101));
});
test('check-in separates savings progress and dining variance', () => {
  const r = checkIn(plan, [{ saved: 400, dining: 420 }]);
  assert.equal(r.monthsAhead, 1); assert.equal(r.diningOver, 120);
  assert.equal(r.aheadDollars, 200);
});
test('withdrawals, zero saving and reached goals are explicit', () => {
  assert.equal(checkIn(plan, [{ saved: -200, dining: 0 }]).aheadDollars, -400);
  assert.equal(checkIn({ ...plan, monthlySaving: 0 }, []).actualRemaining, null);
  assert.equal(checkIn(plan, [{ saved: 2000, dining: 0 }]).actualRemaining, 0);
  assert.throws(() => checkIn(plan, [{ saved: NaN, dining: 0 }]));
});
