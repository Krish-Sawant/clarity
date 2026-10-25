/** UI validation boundary around the merged stress-test simulator. */
import { customStressTest, stressTest, STRESS_LABELS, type CustomShock, type StressEvent, type StressInput } from "../../../../frontend/src/lib/advisor/stress";
import { dollarAmount, record } from "./purchase";

export { STRESS_LABELS };
export type { StressEvent, CustomShock };
export type StressResult = ReturnType<typeof stressTest>;

export const stressDefaults: Required<StressInput> = { savings: 12000, monthlyIncome: 4000, monthlyExpenses: 3000, monthlyRent: 1500, horizonMonths: 24 };
export const shockDefaults: CustomShock = { label: "Reduced hours", incomeChange: -800, expenseChange: 0, oneTimeCost: 0, startMonth: 1, durationMonths: 3 };

function startingPoint(input: Record<string, unknown>): StressInput {
  const keys = ["savings", "monthlyIncome", "monthlyExpenses", "monthlyRent"] as const;
  if (!keys.every((key) => dollarAmount(input[key]))) throw new RangeError("Use non-negative USD amounts up to $1 billion with at most two decimal places.");
  const horizonMonths = input.horizonMonths === undefined ? 24 : input.horizonMonths;
  if (typeof horizonMonths !== "number" || !Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 120) throw new RangeError("Choose a whole-number projection length from 1 to 120 months.");
  return { savings: Number(input.savings), monthlyIncome: Number(input.monthlyIncome), monthlyExpenses: Number(input.monthlyExpenses), monthlyRent: Number(input.monthlyRent), horizonMonths };
}

/** One preset shock, or one custom shock with signed recurring changes. */
export function createStressTest(input: unknown): StressResult {
  if (!record(input)) throw new RangeError("Provide a starting point and one scenario.");
  const start = startingPoint(input);
  if (input.shock === undefined) {
    if (typeof input.event !== "string" || !Object.hasOwn(STRESS_LABELS, input.event)) throw new RangeError("Choose one of the listed scenarios.");
    return stressTest(start, input.event as StressEvent);
  }
  const shock = input.shock;
  if (!record(shock) || typeof shock.label !== "string" || !dollarAmount(shock.incomeChange, true) || !dollarAmount(shock.expenseChange, true) || !dollarAmount(shock.oneTimeCost)) throw new RangeError("Name your scenario and use USD amounts with at most two decimal places.");
  if (typeof shock.startMonth !== "number" || typeof shock.durationMonths !== "number") throw new RangeError("Use whole months for the start and duration.");
  return customStressTest(start, { label: shock.label.trim(), incomeChange: shock.incomeChange, expenseChange: shock.expenseChange, oneTimeCost: shock.oneTimeCost, startMonth: shock.startMonth, durationMonths: shock.durationMonths });
}
