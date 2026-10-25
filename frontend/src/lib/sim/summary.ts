import { monthLabel, usd } from "./message.ts";
import type { Comparison, Option, Projection } from "./types.ts";

const first = (p: Projection) => p.points[1];
const leftover = (p: Projection) => first(p).income - first(p).costs - first(p).debtPayments;
const within = (m: number | null, months: number) => (m === null ? `Not within ${months / 12} yr` : monthLabel(m));

export type TableRow = {
  label: (months: number) => string;
  value: (p: Projection, months: number) => string;
  bad?: (p: Projection) => boolean;
  minMonths?: number;
};

// The fixed menu of table rows. The AI picks rows by key; it never supplies values.
export const TABLE_ROWS = {
  takeHome: { label: () => "Take-home / mo (now)", value: (p) => usd(first(p).income) },
  costs: { label: () => "Living costs / mo (now)", value: (p) => usd(first(p).costs) },
  debtPayments: { label: () => "Debt payments / mo (now)", value: (p) => usd(first(p).debtPayments) },
  leftover: { label: () => "Left to save / mo (now)", value: (p) => usd(leftover(p)), bad: (p) => leftover(p) < 0 },
  upfront: { label: () => "Upfront costs", value: (p) => usd(p.upfrontCosts) },
  netWorth1y: { label: () => "Net worth after 1 year", value: (p) => usd(p.points[12].netWorth) },
  netWorth3y: { label: () => "Net worth after 3 years", value: (p) => usd(p.points[36].netWorth), minMonths: 36 },
  netWorthEnd: { label: (m) => `Net worth after ${m / 12} years`, value: (p, m) => usd(p.points[m].netWorth) },
  debtFree: {
    label: () => "Debt paid off",
    value: (p, m) => (p.debtFreeMonth === 0 ? "No debt" : within(p.debtFreeMonth, m)),
  },
  emergencyFund: { label: () => "Emergency fund (3 mo of costs)", value: (p, m) => within(p.emergencyFundMonth, m) },
  lowestCash: { label: () => "Lowest savings point", value: (p) => usd(p.lowestCash), bad: (p) => p.lowestCash < 0 },
  interest: { label: () => "Total interest paid", value: (p) => usd(p.interestPaid) },
} satisfies Record<string, TableRow>;

export type TableRowKey = keyof typeof TABLE_ROWS;
export const TABLE_ROW_KEYS = Object.keys(TABLE_ROWS) as TableRowKey[];

export type BudgetRow = { label: string; kind: "income" | "cost" | "debt" | "leftover"; a: number; b: number };

// Where each option's money goes in month 1: pay, each recurring cost, debt payments,
// and what's left. Matches the "Left to save / mo (now)" table row.
export function budgetRows(options: [Option, Option], c: Comparison): BudgetRow[] {
  const [pa, pb] = [first(c.a), first(c.b)];
  const costs = new Map<string, { a: number; b: number }>();
  options.forEach((o, i) => {
    for (const cost of o.recurring) {
      if ((cost.startMonth ?? 1) > 1 || (cost.endMonth ?? Infinity) < 1) continue;
      const row = costs.get(cost.name) ?? { a: 0, b: 0 };
      row[i === 0 ? "a" : "b"] += cost.monthly;
      costs.set(cost.name, row);
    }
  });
  const r = Math.round;
  return [
    { label: "Take-home pay", kind: "income" as const, a: r(pa.income), b: r(pb.income) },
    ...[...costs].sort(([, x], [, y]) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
      .map(([label, v]) => ({ label, kind: "cost" as const, a: r(v.a), b: r(v.b) })),
    ...(pa.debtPayments || pb.debtPayments ? [{ label: "Debt payments", kind: "debt" as const, a: r(pa.debtPayments), b: r(pb.debtPayments) }] : []),
    { label: "Left to save", kind: "leftover" as const, a: r(leftover(c.a)), b: r(leftover(c.b)) },
  ];
}

// Compact, rounded results: what the AI receives from run_simulation and the
// only numbers it is allowed to repeat.
export function summarize(c: Comparison, months: number) {
  const r = Math.round;
  const option = (p: Projection) => ({
    label: p.label,
    take_home_now: r(first(p).income),
    living_costs_now: r(first(p).costs),
    debt_payments_now: r(first(p).debtPayments),
    left_to_save_now: r(leftover(p)),
    upfront_costs: r(p.upfrontCosts),
    net_worth_year_1: r(p.points[12].netWorth),
    ...(months >= 36 ? { net_worth_year_3: r(p.points[36].netWorth) } : {}),
    net_worth_end: r(p.points[months].netWorth),
    savings_end: r(p.points[months].cash),
    debt_end: r(p.points[months].debt),
    debt_free_month: p.debtFreeMonth,
    emergency_fund_month: p.emergencyFundMonth,
    savings_run_out_month: p.shortfallMonth,
    lowest_savings: r(p.lowestCash),
    interest_paid: r(p.interestPaid),
  });
  return {
    horizon_years: months / 12,
    options: [option(c.a), option(c.b)],
    lead_change_months: c.crossovers,
    leader_at_end: c.leaderAtEnd === "tie" ? "tie" : (c.leaderAtEnd === "a" ? c.a : c.b).label,
  };
}
