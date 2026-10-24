import type { Horizon, Shock, SimulationInputs } from "./types";

const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const currency = (value: number): string => formatter.format(value);

export type SimulationPath = {
  id: "baseline" | "intentional" | "flexible";
  label: string;
  description: string;
  monthlySurplus: number;
  points: { month: number; cash: number }[];
  finalCash: number;
  minCash: number;
};

function cents(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) throw new RangeError(`${name} must be between 0 and 10,000,000 USD.`);
  return Math.round(value * 100);
}

/** Local deterministic illustration; this is not the teammate's unmerged engine. */
export function simulatePaths(inputs: SimulationInputs, shock: Shock, horizon: Horizon): SimulationPath[] {
  if (![6, 12, 24].includes(horizon)) throw new RangeError("Choose a 6, 12, or 24 month horizon.");
  if (!["none", "job-loss", "repair", "rent-rise"].includes(shock)) throw new RangeError("Unknown shock preset.");
  const income = cents(inputs.income, "Income");
  const rent = cents(inputs.rent, "Rent");
  const transportation = cents(inputs.transportation, "Transportation");
  const spending = cents(inputs.spending, "Spending");
  const startingCash = cents(inputs.cash, "Cash");
  const paths: { id: SimulationPath["id"]; label: string; description: string; rent: number; spending: number }[] = [
    { id: "baseline", label: "Current rhythm", description: "Keep your current monthly assumptions.", rent, spending },
    { id: "intentional", label: "Spend with intention", description: "Reduce flexible spending by up to $200 per month.", rent, spending: Math.max(0, spending - 20_000) },
    { id: "flexible", label: "Rethink your space", description: "Reduce rent by up to $300 per month; moving costs excluded.", rent: Math.max(0, rent - 30_000), spending },
  ];
  return paths.map((path) => {
    const surplus = income - path.rent - transportation - path.spending;
    let balance = startingCash;
    const points = [{ month: 0, cash: balance / 100 }];
    for (let month = 1; month <= horizon; month += 1) {
      const incomeLoss = shock === "job-loss" && month === 2 ? income : 0;
      const repair = shock === "repair" && month === 2 ? 150_000 : 0;
      const rentIncrease = shock === "rent-rise" && month >= 2 ? 15_000 : 0;
      balance += surplus - incomeLoss - repair - rentIncrease;
      points.push({ month, cash: balance / 100 });
    }
    return { ...path, monthlySurplus: surplus / 100, points, finalCash: balance / 100, minCash: Math.min(...points.map((point) => point.cash)) };
  });
}

export type DebtPayoffResult = { months: number | null; interest: number; payoff: boolean };

/** Fixed APR, monthly interest rounded to cents, then a month-end payment. */
export function debtPayoff(balance: number, apr: number, payment: number): DebtPayoffResult {
  let remaining = cents(balance, "Balance");
  const monthlyPayment = cents(payment, "Payment");
  if (!Number.isFinite(apr) || apr < 0 || apr > 100) throw new RangeError("APR must be between 0 and 100 percent.");
  if (remaining === 0) return { months: 0, interest: 0, payoff: true };
  let interest = 0;
  for (let month = 1; month <= 1200; month += 1) {
    const monthInterest = Math.round(remaining * apr / 100 / 12);
    if (monthlyPayment <= monthInterest) return { months: null, interest: interest / 100, payoff: false };
    remaining = Math.max(0, remaining + monthInterest - monthlyPayment);
    interest += monthInterest;
    if (remaining === 0) return { months: month, interest: interest / 100, payoff: true };
  }
  return { months: null, interest: interest / 100, payoff: false };
}
