/** UI validation boundary around the merged loan-affordability comparison. */
import type { Transaction } from "../../../../frontend/src/lib/advisor/engine";
import { compareLoanAffordability, loanHeadline } from "../../../../frontend/src/lib/advisor/loan";
import { dollarAmount, record } from "./purchase";

export type LoanComfortInput = { monthlyTakeHome: number; monthlySpending: number; monthlyLoanPayments: number; savings: number; aprPercent: number; termMonths: number; grossMonthly?: number };
export type LoanComfortResult = ReturnType<typeof compareLoanAffordability> & { headline: string };

/** Fixed planning date; the comparison reads the three complete months before it. */
export const loanDemo = { asOf: "2026-10-25", coveredFrom: "2026-07-01" };
export const loanDefaults: LoanComfortInput = { monthlyTakeHome: 3400, monthlySpending: 2650, monthlyLoanPayments: 200, savings: 12000, aprPercent: 7, termMonths: 60 };

/** Three identical modeled months, labeled as such, in place of imported bank history. */
export function modeledLoanActivity(input: Pick<LoanComfortInput, "monthlyTakeHome" | "monthlySpending" | "monthlyLoanPayments">): Transaction[] {
  return ["07", "08", "09"].flatMap((month) => [
    { id: `${month}-payroll`, date: `2026-${month}-15`, amount: input.monthlyTakeHome, merchant: "Modeled monthly take-home", category: "payroll" },
    { id: `${month}-spending`, date: `2026-${month}-15`, amount: -input.monthlySpending, merchant: "Modeled monthly spending", category: "other_purchase" },
    { id: `${month}-loans`, date: `2026-${month}-15`, amount: -input.monthlyLoanPayments, merchant: "Modeled loan payments", category: "loan_payment" },
  ]);
}

export function createLoanComparison(input: unknown): LoanComfortResult {
  if (!record(input)) throw new RangeError("Provide income, spending, savings and loan terms.");
  const keys = ["monthlyTakeHome", "monthlySpending", "monthlyLoanPayments", "savings"] as const;
  if (!keys.every((key) => dollarAmount(input[key]))) throw new RangeError("Use non-negative USD amounts up to $1 billion with at most two decimal places.");
  if (Number(input.monthlyTakeHome) <= 0) throw new RangeError("Monthly take-home pay must be greater than zero.");
  if (typeof input.aprPercent !== "number" || !Number.isFinite(input.aprPercent) || input.aprPercent < 0 || input.aprPercent > 100) throw new RangeError("Use an APR from 0 to 100 percent.");
  if (typeof input.termMonths !== "number" || !Number.isInteger(input.termMonths) || input.termMonths < 12 || input.termMonths > 96) throw new RangeError("Choose a whole-number loan term from 12 to 96 months.");
  if (input.grossMonthly !== undefined && (!dollarAmount(input.grossMonthly) || input.grossMonthly <= 0)) throw new RangeError("Gross monthly income must be a positive USD amount, or left blank.");
  const values = { monthlyTakeHome: Number(input.monthlyTakeHome), monthlySpending: Number(input.monthlySpending), monthlyLoanPayments: Number(input.monthlyLoanPayments) };
  const result = compareLoanAffordability(modeledLoanActivity(values), loanDemo.asOf, loanDemo.coveredFrom, {
    aprPercent: input.aprPercent, termMonths: input.termMonths, cashCents: Math.round(Number(input.savings) * 100),
    ...(input.grossMonthly === undefined ? {} : { grossMonthlyCents: Math.round(Number(input.grossMonthly) * 100) }),
  });
  return { ...result, headline: loanHeadline(result) };
}
