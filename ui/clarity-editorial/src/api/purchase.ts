/** UI validation boundary around the merged purchase detector and simulator. */
import { detectLargePurchases, type PurchaseSignal, type Transaction } from "../../../../frontend/src/lib/advisor/engine";
import { previewPurchase, type PurchaseImpactInput } from "../../../../frontend/src/lib/advisor/purchase";

export type PurchasePreviewInput = PurchaseImpactInput;
export type PurchasePreviewResult = ReturnType<typeof previewPurchase>;

/** Same synthetic electronics transaction used by the merged frontend preview. */
export const purchaseDemo = {
  label: "Electronics purchase",
  asOf: "2026-10-24",
  transactions: [{ id: "demo-tv", date: "2026-10-24", amount: -1200, merchant: "Electronics Store", category: "electronics" }],
};

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function dollarAmount(value: unknown, signed = false): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e9 && (signed || value >= 0) && Math.abs(value * 100 - Math.round(value * 100)) <= 0.00001;
}

export function detectPurchaseSignals(input: unknown): PurchaseSignal[] {
  if (!record(input) || !validDate(input.asOf) || !Array.isArray(input.transactions)) throw new RangeError("Provide a valid as-of date and transaction list.");
  const threshold = input.threshold === undefined ? 500 : input.threshold;
  if (!dollarAmount(threshold) || threshold <= 0) throw new RangeError("Use a positive purchase threshold in USD, with at most two decimal places.");
  const ids = new Set<string>();
  const transactions = input.transactions.map((item): Transaction => {
    if (!record(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > 200 || !validDate(item.date) || !dollarAmount(item.amount, true) || typeof item.merchant !== "string" || !item.merchant.trim() || item.merchant.length > 200 || typeof item.category !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(item.category)) throw new RangeError("Each transaction needs an ID, valid date, cent-precision USD amount, merchant, and category.");
    if (ids.has(item.id)) throw new RangeError("Transaction IDs must be unique in the supplied activity.");
    ids.add(item.id);
    return { id: item.id, date: item.date, amount: item.amount, merchant: item.merchant, category: item.category };
  });
  return detectLargePurchases(transactions, input.asOf, threshold);
}

export function getPurchaseSignals(): PurchaseSignal[] { return detectPurchaseSignals(purchaseDemo); }

export function createPurchasePreview(input: unknown): PurchasePreviewResult {
  if (!record(input) || typeof input.label !== "string" || !input.label.trim() || input.label.trim().length > 80) throw new RangeError("Give the purchase a label between 1 and 80 characters.");
  const keys = ["purchaseAmount", "currentSavings", "targetSavings", "monthlyContribution"] as const;
  if (!keys.every((key) => dollarAmount(input[key]))) throw new RangeError("Use non-negative USD amounts up to $1 billion with at most two decimal places.");
  if (Number(input.targetSavings) <= 0) throw new RangeError("The savings goal must be greater than zero.");
  if (input.timing !== "planned" && input.timing !== "posted") throw new RangeError("Confirm whether the savings balance is before or after the purchase.");
  const horizonMonths = input.horizonMonths === undefined ? 120 : input.horizonMonths;
  if (typeof horizonMonths !== "number" || !Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 1200) throw new RangeError("Choose a whole-number projection horizon from 1 to 1,200 months.");
  return previewPurchase({
    label: input.label.trim(), purchaseAmount: Number(input.purchaseAmount), currentSavings: Number(input.currentSavings),
    targetSavings: Number(input.targetSavings), monthlyContribution: Number(input.monthlyContribution), timing: input.timing, horizonMonths,
  });
}
