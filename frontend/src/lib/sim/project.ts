import type { Comparison, IncomeStream, MonthPoint, Option, Projection } from "./types.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const isActive = (m: number, start = 1, end = Infinity) => m >= start && m <= end;
const yearIndex = (m: number, start = 1) => Math.floor((m - start) / 12);

export function amortizedPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = aprPct / 1200;
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
}

function incomeAt(s: IncomeStream, m: number): number {
  const y = yearIndex(m, s.startMonth);
  if (s.schedule?.length) return s.schedule[Math.min(y, s.schedule.length - 1)];
  return s.monthly * (1 + (s.annualRaisePct ?? 0) / 100) ** y;
}

export function project(option: Option, months: number): Projection {
  const debts = option.debts.map((d) => ({ ...d }));
  const assets = option.assets.map((a) => ({ ...a }));
  const floor = option.cashFloorBeforeExtraDebt ?? 0;
  const totalDebt = () => sum(debts.map((d) => d.balance));
  const totalAssets = () => sum(assets.map((a) => a.value));

  const upfrontCosts = sum(option.oneTime.filter((c) => c.month === 0).map((c) => c.amount));
  let cash = option.startingCash - upfrontCosts;
  let interestPaid = 0;
  let debtFreeMonth: number | null = totalDebt() > 0 ? null : 0;
  let emergencyFundMonth: number | null = null;
  let shortfallMonth: number | null = cash < 0 ? 0 : null;
  let lowestCash = cash;
  let emergencyTarget = 0;

  const points: MonthPoint[] = [
    {
      month: 0, income: 0, costs: 0, debtPayments: 0, cash, debt: totalDebt(), assets: totalAssets(),
      netWorth: cash + totalAssets() - totalDebt(),
    },
  ];

  for (let m = 1; m <= months; m++) {
    const income = sum(option.income.filter((s) => isActive(m, s.startMonth, s.endMonth)).map((s) => incomeAt(s, m)));
    const costs = sum(
      option.recurring
        .filter((c) => isActive(m, c.startMonth, c.endMonth))
        .map((c) => c.monthly * (1 + (c.annualGrowthPct ?? 0) / 100) ** yearIndex(m, c.startMonth)),
    );
    const oneTime = sum(option.oneTime.filter((c) => c.month === m).map((c) => c.amount));
    if (m === 1) emergencyTarget = 3 * costs;

    if (cash > 0) cash += (cash * (option.cashApyPct ?? 0)) / 1200;
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const interest = (d.balance * d.aprPct) / 1200;
      d.balance += interest;
      interestPaid += interest;
    }

    const surplus = income - costs - oneTime;
    cash += surplus;

    const paying = debts.filter((d) => m >= (d.paymentsStartMonth ?? 1));
    let paid = 0;
    for (const d of paying) {
      const p = Math.min(d.minPayment, d.balance);
      d.balance -= p;
      paid += p;
    }
    cash -= paid;

    // Extra payments come only from this month's new money, and never push cash below the floor.
    let extra = Math.min(surplus - paid, cash - floor);
    for (const d of [...paying].sort((x, y) => y.aprPct - x.aprPct)) {
      if (extra <= 0) break;
      const p = Math.min(extra, d.balance);
      d.balance -= p;
      cash -= p;
      paid += p;
      extra -= p;
    }

    for (const d of debts) if (d.balance < 0.01) d.balance = 0;
    for (const a of assets) a.value *= (1 - a.annualDepreciationPct / 100) ** (1 / 12);

    const debt = totalDebt();
    if (debtFreeMonth === null && debt === 0) debtFreeMonth = m;
    if (emergencyFundMonth === null && emergencyTarget > 0 && cash >= emergencyTarget) emergencyFundMonth = m;
    if (shortfallMonth === null && cash < 0) shortfallMonth = m;
    lowestCash = Math.min(lowestCash, cash);

    points.push({
      month: m, income, costs, debtPayments: paid, cash, debt, assets: totalAssets(),
      netWorth: cash + totalAssets() - debt,
    });
  }

  return {
    label: option.label, points, upfrontCosts, debtFreeMonth, emergencyFundMonth, shortfallMonth, lowestCash,
    interestPaid,
  };
}

export function compare(a: Option, b: Option, months: number): Comparison {
  const pa = project(a, months);
  const pb = project(b, months);
  const crossovers: number[] = [];
  let prev = 0;
  for (let m = 0; m <= months; m++) {
    const diff = pa.points[m].netWorth - pb.points[m].netWorth;
    const sign = diff > 0.5 ? 1 : diff < -0.5 ? -1 : 0;
    if (sign === 0) continue;
    if (prev !== 0 && sign !== prev) crossovers.push(m);
    prev = sign;
  }
  const end = pa.points[months].netWorth - pb.points[months].netWorth;
  return { a: pa, b: pb, crossovers, leaderAtEnd: end > 0.5 ? "a" : end < -0.5 ? "b" : "tie" };
}
