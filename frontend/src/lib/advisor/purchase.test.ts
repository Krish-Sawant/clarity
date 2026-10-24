import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewPurchase } from './purchase.ts';
import { detectLargePurchases } from './engine.ts';
const input = { label: 'TV', purchaseAmount: 1200, currentSavings: 3000, targetSavings: 6000, monthlyContribution: 600, timing: 'planned' as const };
test('TV moves goal from month 5 to 7 using unchanged contributions', () => {
  const r = previewPurchase(input);
  assert.equal(r.baselineMonths, 5); assert.equal(r.purchaseMonths, 7); assert.equal(r.delayMonths, 2);
  assert.equal(r.purchased.points[0].cash, 1800);
  for (let i = 0; i <= r.horizonMonths; i++) assert.equal(r.baseline.points[i].cash - r.purchased.points[i].cash, 1200);
});
test('posted purchase is not subtracted twice', () => {
  const r = previewPurchase({ ...input, timing: 'posted', currentSavings: 1800 });
  assert.equal(r.purchased.points[0].cash, 1800); assert.equal(r.baseline.points[0].cash, 3000); assert.equal(r.delayMonths, 2);
});
test('already achieved goal, unchanged month, zero purchase and no progress', () => {
  assert.equal(previewPurchase({ ...input, currentSavings: 8000 }).purchaseMonths, 0);
  assert.equal(previewPurchase({ ...input, purchaseAmount: 0 }).delayMonths, 0);
  assert.equal(previewPurchase({ ...input, currentSavings: 3100, purchaseAmount: 10 }).status, 'unchanged');
  const r = previewPurchase({ ...input, monthlyContribution: 0 });
  assert.equal(r.status, 'baseline_unreached'); assert.equal(r.delayMonths, null);
});
test('purchase-only horizon failure and insufficient cash are visible', () => {
  const r = previewPurchase({ ...input, horizonMonths: 5 });
  assert.equal(r.status, 'purchase_unreached'); assert.equal(r.delayMonths, null);
  assert.equal(previewPurchase({ ...input, currentSavings: 500 }).shortfallAmount, 700);
});
test('validates amounts, precision, horizon and labels', () => {
  for (const patch of [{ purchaseAmount: -1 }, { currentSavings: NaN }, { purchaseAmount: 0.001 }, { targetSavings: 0 }, { horizonMonths: 0 }, { label: ' ' }]) assert.throws(() => previewPurchase({ ...input, ...patch }), RangeError);
  assert.equal(previewPurchase({ ...input, purchaseAmount: 12.34 }).remainingAfterPurchase, 2987.66);
});
test('detection excludes transfers, refunds, old/future and duplicate purchases', () => {
  const t = { id: 'tv', date: '2026-10-24', amount: -1200, merchant: 'TV Store', category: 'electronics' };
  const rows = [t, t, { ...t, id: 'refund', amount: 1200 }, { ...t, id: 'old', date: '2026-09-24' }, { ...t, id: 'future', date: '2026-10-25' }, { ...t, id: 'transfer', category: 'transfer' }, { ...t, id: 'small', amount: -499 }];
  assert.deepEqual(detectLargePurchases(rows, '2026-10-24').map(x => x.id), ['purchase:tv']);
  assert.equal(detectLargePurchases([{ ...t, amount: -500 }], '2026-10-24').length, 1);
  assert.throws(() => detectLargePurchases([], 'invalid'), RangeError);
});
