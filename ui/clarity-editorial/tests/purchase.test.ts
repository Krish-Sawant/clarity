import test from "node:test";
import assert from "node:assert/strict";
import { detectLargePurchases } from "../../../frontend/src/lib/advisor/engine";
import { previewPurchase } from "../../../frontend/src/lib/advisor/purchase";
import { createPurchasePreview, detectPurchaseSignals, getPurchaseSignals, purchaseDemo } from "../src/api/purchase";

const input = { label: "TV", purchaseAmount: 1200, currentSavings: 3000, targetSavings: 6000, monthlyContribution: 600, timing: "planned" as const, horizonMonths: 120 };

test("purchase adapters return the actual merged detector and simulator outputs", () => {
  assert.deepEqual(getPurchaseSignals(), detectLargePurchases(purchaseDemo.transactions, purchaseDemo.asOf));
  assert.equal(getPurchaseSignals()[0].transactionId, "demo-tv");
  assert.deepEqual(createPurchasePreview(input), previewPurchase(input));
  assert.deepEqual([createPurchasePreview(input).baselineMonths, createPurchasePreview(input).purchaseMonths, createPurchasePreview(input).delayMonths], [5, 7, 2]);
  const before = structuredClone(input);
  createPurchasePreview(input);
  assert.deepEqual(input, before);
});

test("posted balances are added back once for the counterfactual and never deducted twice", () => {
  const planned = createPurchasePreview(input);
  const posted = createPurchasePreview({ ...input, timing: "posted", currentSavings: 1800 });
  assert.equal(posted.remainingAfterPurchase, 1800);
  assert.equal(posted.baseline.points[0].cash, 3000);
  assert.deepEqual(posted.purchased.points, planned.purchased.points);
  assert.deepEqual(posted.baseline.points, planned.baseline.points);
  assert.equal(posted.delayMonths, 2);
});

test("unreached milestones remain null and cash shortfalls survive the adapter", () => {
  const stalled = createPurchasePreview({ ...input, monthlyContribution: 0 });
  assert.equal(stalled.status, "baseline_unreached");
  assert.equal(stalled.baselineMonths, null);
  assert.equal(stalled.purchaseMonths, null);
  assert.equal(stalled.delayMonths, null);
  const limited = createPurchasePreview({ ...input, horizonMonths: 5 });
  assert.equal(limited.status, "purchase_unreached");
  assert.equal(limited.baselineMonths, 5);
  assert.equal(limited.purchaseMonths, null);
  assert.equal(limited.delayMonths, null);
  const shortfall = createPurchasePreview({ ...input, currentSavings: 500 });
  assert.equal(shortfall.shortfallAmount, 700);
  assert.equal(shortfall.remainingAfterPurchase, -700);
  assert.equal(createPurchasePreview({ ...input, currentSavings: 8000 }).purchaseMonths, 0);
  assert.equal(createPurchasePreview({ ...input, purchaseAmount: 0 }).delayMonths, 0);
});

test("preview boundary rejects malformed types, precision, goals, timing and horizons", () => {
  for (const invalid of [null, [], { ...input, label: ["TV"] }, { ...input, label: " " }, { ...input, label: "x".repeat(81) }]) assert.throws(() => createPurchasePreview(invalid), RangeError);
  for (const key of ["purchaseAmount", "currentSavings", "targetSavings", "monthlyContribution"]) {
    for (const value of [-1, NaN, Infinity, "1200", [1200], 0.001, 1_000_000_001]) assert.throws(() => createPurchasePreview({ ...input, [key]: value }), RangeError);
  }
  for (const patch of [{ targetSavings: 0 }, { timing: "unknown" }, { timing: ["planned"] }, { horizonMonths: "120" }, { horizonMonths: 0 }, { horizonMonths: 1201 }, { horizonMonths: 1.5 }]) assert.throws(() => createPurchasePreview({ ...input, ...patch }), RangeError);
  assert.equal(createPurchasePreview({ ...input, purchaseAmount: 12.34 }).remainingAfterPurchase, 2987.66);
});

test("detector boundary validates supplied activity and preserves source exclusions", () => {
  const transaction = purchaseDemo.transactions[0];
  const activity = { ...purchaseDemo, transactions: [
    transaction,
    { ...transaction, id: "transfer", category: "transfer" },
    { ...transaction, id: "refund", amount: 1200 },
    { ...transaction, id: "old", date: "2026-09-24" },
    { ...transaction, id: "future", date: "2026-10-25" },
    { ...transaction, id: "small", amount: -499.99 },
    { ...transaction, id: "edge", amount: -500 },
  ] };
  assert.deepEqual(detectPurchaseSignals(activity).map((signal) => signal.transactionId), ["demo-tv", "edge"]);
  for (const invalid of [null, { ...purchaseDemo, asOf: "2026-02-30" }, { ...purchaseDemo, threshold: "500" }, { ...purchaseDemo, threshold: 0 }, { ...purchaseDemo, transactions: [transaction, transaction] }, { ...purchaseDemo, transactions: [{ ...transaction, amount: -0.001 }] }, { ...purchaseDemo, transactions: [{ ...transaction, merchant: [] }] }]) assert.throws(() => detectPurchaseSignals(invalid), RangeError);
});
