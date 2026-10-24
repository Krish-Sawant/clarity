import { calculateSavings, compareExtraPayment } from "../../../../finance.ts";

export type DebtPlanInputs = {
  balance: number;
  apr: number;
  payment: number;
  extraPayment: number;
  maxMonths: number;
};
export type SavingsPlanInputs = {
  current: number;
  target: number;
  monthlyContribution: number;
  apy: number;
  maxMonths: number;
};
export type DebtComparison = ReturnType<typeof compareExtraPayment>;
export type SavingsProjection = ReturnType<typeof calculateSavings>;

/** UI values are USD dollars; the shared engine requires integer USD cents. */
export function dollarsToCents(value: unknown, label = "Amount"): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10_000_000_000) {
    throw new RangeError(`${label} must be a non-negative USD number no greater than $10,000,000,000.`);
  }
  const converted = Math.round(value * 100);
  if (!Number.isSafeInteger(converted) || converted / 100 !== value) {
    throw new RangeError(`${label} must have at most two decimal places.`);
  }
  return converted;
}

function checkedRate(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1000) {
    throw new RangeError(`${label} must be a number from 0 to 1000 percent.`);
  }
  return value;
}

function checkedHorizon(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1200) {
    throw new RangeError("Projection horizon must be an integer from 1 to 1200 months.");
  }
  return value;
}

/** Results and nullable statuses come directly from the merged root engine. */
export function calculateDebtPlan(inputs: DebtPlanInputs): DebtComparison {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new RangeError("Provide debt assumptions before calculating.");
  return compareExtraPayment({
    balanceCents: dollarsToCents(inputs.balance, "Debt balance"),
    aprPercent: checkedRate(inputs.apr, "APR"),
    monthlyPaymentCents: dollarsToCents(inputs.payment, "Monthly payment"),
    maxMonths: checkedHorizon(inputs.maxMonths),
  }, dollarsToCents(inputs.extraPayment, "Extra payment"));
}

export function calculateSavingsPlan(inputs: SavingsPlanInputs): SavingsProjection {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new RangeError("Provide savings assumptions before calculating.");
  return calculateSavings({
    currentCents: dollarsToCents(inputs.current, "Current savings"),
    targetCents: dollarsToCents(inputs.target, "Savings target"),
    monthlyContributionCents: dollarsToCents(inputs.monthlyContribution, "Monthly contribution"),
    apyPercent: checkedRate(inputs.apy, "APY"),
    maxMonths: checkedHorizon(inputs.maxMonths),
  });
}
