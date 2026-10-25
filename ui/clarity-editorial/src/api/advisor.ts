/**
 * UI boundary for the actual advisor engine merged into main. The calculation
 * and detection algorithms remain owned by frontend/src/lib/advisor/engine.ts.
 * This adapter adds runtime validation and uses synthetic activity, not a bank.
 */
import { detect, detectAdditionalMoments, plan, type Snapshot, type Transaction } from "../../../../frontend/src/lib/advisor/engine";
import mergedDemo from "../../../../frontend/src/lib/advisor/demo.json";
import type { AdvisorMoment, AdvisorPlan, AdvisorPlanInputs, AdvisorSignal } from "./contracts";

export type { AdvisorMoment, AdvisorPlan, AdvisorPlanInputs } from "./contracts";
export type AdvisorDataset = { label: string; asOf: string; transactions: Transaction[]; snapshots: Snapshot[] };

const moments: AdvisorMoment[] = ["new-job", "moving", "overspending", "student-loan", "idle-cash", "higher-housing", "moving-costs", "income-increase"];
const maxAmount = 1_000_000_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function amount(value: unknown, nonNegative = false): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maxAmount && (!nonNegative || value >= 0);
}

function validateDataset(input: unknown): AdvisorDataset {
  if (!record(input) || !validDate(input.asOf) || !Array.isArray(input.transactions) || !Array.isArray(input.snapshots)) {
    throw new Error("Advisor activity needs a valid YYYY-MM-DD as-of date, transactions, and balance snapshots.");
  }
  if (input.label !== undefined && !text(input.label, 200)) throw new Error("The activity label must be a nonempty string of at most 200 characters.");
  const ids = new Set<string>();
  const transactions = input.transactions.map((entry): Transaction => {
    if (!record(entry) || !text(entry.id, 200) || !validDate(entry.date) || !amount(entry.amount) || !text(entry.merchant, 200) || typeof entry.category !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(entry.category)) {
      throw new Error("Each transaction needs an ID, valid calendar date, finite USD amount, merchant, and lowercase category.");
    }
    if (ids.has(entry.id)) throw new Error("Transaction IDs must be unique within the supplied history.");
    ids.add(entry.id);
    return { id: entry.id, date: entry.date, amount: entry.amount, merchant: entry.merchant, category: entry.category };
  });
  const snapshotDates = new Set<string>();
  const snapshots = input.snapshots.map((entry): Snapshot => {
    if (!record(entry) || !validDate(entry.date) || !amount(entry.balance)) throw new Error("Each balance snapshot needs a valid calendar date and finite USD balance.");
    if (snapshotDates.has(entry.date)) throw new Error("Snapshot dates must be unique so the latest balance is unambiguous.");
    snapshotDates.add(entry.date);
    return { date: entry.date, balance: entry.balance };
  });
  return { label: typeof input.label === "string" ? input.label : "Supplied activity", asOf: input.asOf, transactions, snapshots };
}

/** Source fixture kept in frontend; no duplicate algorithm or fixture is copied. */
export const advisorDemo: AdvisorDataset = validateDataset(mergedDemo);

export function detectAdvisorSignals(input: unknown): AdvisorSignal[] {
  const activity = validateDataset(input);
  return detect(activity.transactions, activity.snapshots, activity.asOf);
}

export function getAdvisorSignals(): AdvisorSignal[] { return detectAdvisorSignals(advisorDemo); }

/** Keep the original five first; additional prompts use the same inspectable data. */
export function getAdvisorCarouselSignals(): AdvisorSignal[] {
  return [...getAdvisorSignals(), ...detectAdditionalMoments(advisorDemo.transactions, advisorDemo.asOf)];
}

export function createAdvisorPlan(kind: AdvisorMoment, inputs: AdvisorPlanInputs): AdvisorPlan {
  if (typeof kind !== "string" || !moments.includes(kind)) throw new Error("Choose a supported advisor moment before planning.");
  if (!record(inputs) || ![inputs.income, inputs.expenses, inputs.cash].every((value) => amount(value, true)) || typeof inputs.annualRate !== "number" || !Number.isFinite(inputs.annualRate) || inputs.annualRate < 0 || inputs.annualRate > 100) {
    throw new Error("Use non-negative USD income, expenses and cash up to $1,000,000,000, and an annual rate between 0 and 100 percent.");
  }
  return plan(kind, inputs.income, inputs.expenses, inputs.cash, inputs.annualRate);
}
