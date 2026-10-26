import { project } from '../sim/project.ts';
import type { Option } from '../sim/types.ts';

export type StressEvent = 'baseline' | 'job-loss' | 'car-repair' | 'rent-rise';
export type StressInput = {
  savings: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyRent: number; // Already included in monthlyExpenses, not additional.
  horizonMonths?: number;
};
export const STRESS_LABELS: Record<StressEvent, string> = {
  baseline: 'No shock', 'job-loss': 'Lose my job', 'car-repair': '$2,000 car repair', 'rent-rise': 'Rent goes up 10%',
};
const money = (n: number) => Math.round(n * 100) / 100;

/** USD dollars. Month 0 is now; recurring cash flows settle at month end.
 * Negative projected cash represents an unmet funding need, not available credit. */
export function stressTest(input: StressInput, event: StressEvent) {
  for (const n of [input.savings, input.monthlyIncome, input.monthlyExpenses, input.monthlyRent]) {
    if (!Number.isFinite(n) || n < 0 || n > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new RangeError('Enter non-negative USD amounts with at most two decimal places, up to $1 billion.');
  }
  const horizon = input.horizonMonths ?? 24;
  if (!Object.hasOwn(STRESS_LABELS, event) || !Number.isInteger(horizon) || horizon < 1 || horizon > 120) throw new RangeError('Choose a valid event and a 1–120 month horizon.');
  if (input.monthlyRent > input.monthlyExpenses) throw new RangeError('Rent must already be included in total monthly expenses and cannot exceed them.');
  const base: Option = { label: 'No shock', startingCash: input.savings, income: [{ name: 'Take-home pay', monthly: input.monthlyIncome }], recurring: [{ name: 'All expenses, including rent and required debt payments', monthly: input.monthlyExpenses }], oneTime: [], debts: [], assets: [] };
  const extraRent = event === 'rent-rise' ? money(input.monthlyRent * 0.1) : 0;
  const income = event === 'job-loss' ? 0 : input.monthlyIncome;
  const expenses = money(input.monthlyExpenses + extraRent);
  const shocked: Option = { ...base, label: STRESS_LABELS[event], income: [{ name: 'Remaining take-home pay', monthly: income }], recurring: [{ name: 'Expenses after shock', monthly: expenses }], oneTime: event === 'car-repair' ? [{ name: 'Car repair', amount: 2000, month: 0 }] : [] };
  // Shared simulator supplies both paths; normalize display and threshold checks to cents.
  const normalize = (option: Option) => project(option, horizon).points.map(p => ({ month: p.month, cash: money(p.cash) }));
  const baseline = normalize(base), stressed = normalize(shocked);
  const firstShortfallMonth = stressed.find(p => p.cash < 0)?.month ?? null;
  const firstZeroMonth = stressed.find(p => p.cash <= 0)?.month ?? null;
  const minimumExtraSavings = money(Math.max(0, -Math.min(...stressed.map(p => p.cash))));
  const monthlyNet = money(income - expenses);
  const message = firstShortfallMonth === 0
    ? 'This shock exceeds your available savings immediately.'
    : firstShortfallMonth !== null ? `Savings cannot cover all modeled spending in month ${firstShortfallMonth}.`
    : firstZeroMonth !== null ? `Savings reach zero in month ${firstZeroMonth}, with no modeled shortfall within ${horizon} months.`
    : `Savings stay above zero throughout this ${horizon}-month projection.`;
  const preparation = [
    minimumExtraSavings > 0 ? `An additional $${minimumExtraSavings.toLocaleString('en-US')} upfront would cover the modeled shortfall across ${horizon} months, ending with at least zero cash. This is a break-even amount, not a recommended cushion.` : 'This scenario stays funded over the chosen horizon. Review costs missing from your inputs before relying on it.',
    event === 'job-loss' ? 'Review essential expenses and check any severance or unemployment benefits separately; neither is included here.' : event === 'car-repair' ? 'Set aside a repair reserve and compare repair estimates before committing.' : event === 'rent-rise' ? 'Review your next lease amount and identify recurring costs you could adjust before renewal.' : 'Choose a shock to see how your plan changes.',
  ];
  return { event, horizon, baseline, stressed, firstShortfallMonth, firstZeroMonth, minimumExtraSavings, monthlyNet, extraRent, message, preparation,
    assumptions: ['One shock at a time, beginning now. The repair is paid once from savings at month 0; job income stops from month 1 for the entire horizon; the rent increase repeats from month 1.',
      'Rent and required debt payments are already included in total expenses. No debt balances or new borrowing are simulated.',
      'Fixed income and expenses, zero savings interest, no inflation, benefits, severance or replacement job. These are scenarios, not probabilities or predictions.',
      'Monthly netting cannot detect an overdraft between paydays. Negative chart values represent unmet funding needs after savings are exhausted. No money is moved.'] };
}

export type CustomShock = { label: string; incomeChange: number; expenseChange: number; oneTimeCost: number; startMonth: number; durationMonths: number };
/** Signed recurring changes; month 1 is the next complete month. */
export function customStressTest(input: StressInput, shock: CustomShock) {
  const base = stressTest(input, 'baseline');
  for (const n of [shock.incomeChange, shock.expenseChange, shock.oneTimeCost]) {
    if (!Number.isFinite(n) || Math.abs(n) > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new RangeError('Use dollar amounts with at most two decimals.');
  }
  if (!shock.label.trim() || shock.label.length > 120 || shock.oneTimeCost < 0 || input.monthlyIncome + shock.incomeChange < 0 || input.monthlyExpenses + shock.expenseChange < 0) throw new RangeError('Name your scenario and keep resulting income, expenses and one-time cost non-negative.');
  if (!Number.isInteger(shock.startMonth) || !Number.isInteger(shock.durationMonths) || shock.startMonth < 1 || shock.durationMonths < 1 || shock.startMonth + shock.durationMonths - 1 > base.horizon) throw new RangeError(`Choose whole months within the ${base.horizon}-month timeline.`);
  const startMonth = shock.startMonth, endMonth = startMonth + shock.durationMonths - 1;
  const option: Option = { label: shock.label, startingCash: input.savings,
    income: [{name:'Baseline pay',monthly:input.monthlyIncome},{name:'Income change',monthly:shock.incomeChange,startMonth,endMonth}],
    recurring: [{name:'Baseline expenses',monthly:input.monthlyExpenses},{name:'Expense change',monthly:shock.expenseChange,startMonth,endMonth}],
    oneTime:[{name:shock.label,amount:shock.oneTimeCost,month:startMonth}],debts:[],assets:[] };
  const stressed = project(option,base.horizon).points.map(p=>({month:p.month,cash:money(p.cash)}));
  const firstShortfallMonth=stressed.find(p=>p.cash<0)?.month??null;
  const firstZeroMonth=stressed.find(p=>p.cash<=0)?.month??null;
  return {...base, stressed, firstShortfallMonth, firstZeroMonth,
    minimumExtraSavings:money(Math.max(0,-Math.min(...stressed.map(p=>p.cash)))),
    monthlyNet:money(input.monthlyIncome+shock.incomeChange-input.monthlyExpenses-shock.expenseChange),
    message:firstShortfallMonth!==null?`Savings cannot cover all modeled spending in month ${firstShortfallMonth}.`:firstZeroMonth!==null?`Savings reach zero in month ${firstZeroMonth}; no shortfall occurs within ${base.horizon} months.`:`Savings stay above zero throughout this ${base.horizon}-month projection.`,
    preparation:[],
    assumptions:[`Your recurring changes apply in months ${startMonth}–${endMonth}, then return to baseline. The one-time cost is charged once in month ${startMonth}.`, 'Signed changes are added to your existing income and expenses, not substituted for them. No automatic actions or AI interpretation.', 'Zero interest and fixed baseline amounts. Monthly netting can hide intramonth shortfalls. Negative cash represents an unmet funding need, not credit.']};
}
