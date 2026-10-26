// Generic shape for any "option A vs option B" money decision. Months are
// 1-based; month 0 is the starting point (only one-time costs apply there).

export type IncomeStream = {
  name: string;
  monthly: number;
  annualRaisePct?: number;
  // Monthly amount per year (index 0 = first year). Overrides monthly/annualRaisePct,
  // e.g. take-home recomputed from a raised gross salary each year.
  schedule?: number[];
  startMonth?: number;
  endMonth?: number;
};

export type RecurringCost = {
  name: string;
  monthly: number;
  annualGrowthPct?: number;
  startMonth?: number;
  endMonth?: number;
};

export type OneTimeCost = { name: string; amount: number; month: number };

export type Debt = {
  name: string;
  balance: number;
  aprPct: number;
  minPayment: number;
  // Interest accrues from month 1, but payments start here (e.g. student-loan grace period).
  paymentsStartMonth?: number;
};

export type Asset = { name: string; value: number; annualDepreciationPct: number };

export type Option = {
  label: string;
  startingCash: number;
  income: IncomeStream[];
  recurring: RecurringCost[];
  oneTime: OneTimeCost[];
  debts: Debt[];
  assets: Asset[];
  cashApyPct?: number;
  // Leftover money goes to savings until cash reaches this floor, then to extra
  // debt payments (highest APR first). 0 = pay debt down as fast as possible.
  cashFloorBeforeExtraDebt?: number;
};

export type MonthPoint = {
  month: number;
  income: number;
  costs: number;
  debtPayments: number;
  cash: number;
  debt: number;
  assets: number;
  netWorth: number;
};

export type Projection = {
  label: string;
  points: MonthPoint[];
  upfrontCosts: number;
  debtFreeMonth: number | null;
  emergencyFundMonth: number | null;
  shortfallMonth: number | null;
  lowestCash: number;
  interestPaid: number;
};

export type Comparison = {
  a: Projection;
  b: Projection;
  // Months where the net-worth leader changes.
  crossovers: number[];
  leaderAtEnd: "a" | "b" | "tie";
};
