/** UI validation boundary around the merged raise and monthly check-in calculations. */
import { checkIn, saveTheRaise, type MonthlyPlan } from "../engines/advisor/checkins";
import { dollarAmount, record } from "./purchase";

export type { MonthlyPlan };
export type CheckInMonth = { saved: number; dining: number };
export type CheckInResult = ReturnType<typeof checkIn>;
export type RaiseResult = ReturnType<typeof saveTheRaise>;

export const raiseDemo = { previousMonthlyPay: 3000, currentMonthlyPay: 3400 };
export const planDemo: MonthlyPlan = { startingSavings: 1000, goal: 5000, monthlySaving: 200, diningBudget: 300 };

export function createRaisePreview(input: unknown): RaiseResult {
  if (!record(input) || !dollarAmount(input.previousMonthlyPay) || !dollarAmount(input.currentMonthlyPay) || typeof input.confirmedRecurring !== "boolean") throw new RangeError("Provide both monthly take-home totals and whether the increase is recurring.");
  const savePercent = input.savePercent === undefined ? 50 : input.savePercent;
  if (!dollarAmount(savePercent) || savePercent > 100) throw new RangeError("Choose a savings share from 0 to 100 percent.");
  return saveTheRaise(input.previousMonthlyPay, input.currentMonthlyPay, input.confirmedRecurring, savePercent);
}

/** Entered months are the user's own complete months, not bank imports. */
export function createCheckIn(input: unknown): CheckInResult {
  if (!record(input) || !record(input.plan) || !Array.isArray(input.months)) throw new RangeError("Provide a savings plan and the recorded months.");
  const plan = input.plan;
  const keys = ["startingSavings", "goal", "monthlySaving", "diningBudget"] as const;
  if (!keys.every((key) => dollarAmount(plan[key]))) throw new RangeError("Use non-negative USD plan amounts with at most two decimal places.");
  const months = input.months.map((month): CheckInMonth => {
    if (!record(month) || !dollarAmount(month.saved, true) || !dollarAmount(month.dining)) throw new RangeError("Each month needs net savings (negative for withdrawals) and non-negative dining spending.");
    return { saved: month.saved, dining: month.dining };
  });
  const result = checkIn({ startingSavings: Number(plan.startingSavings), goal: Number(plan.goal), monthlySaving: Number(plan.monthlySaving), diningBudget: Number(plan.diningBudget) }, months);
  if (result.actualSavings < 0) throw new RangeError("Recorded withdrawals exceed the available savings.");
  return result;
}
