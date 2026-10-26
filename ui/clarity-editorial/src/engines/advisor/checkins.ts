export type MonthlyPlan = { startingSavings: number; goal: number; monthlySaving: number; diningBudget: number };
const valid = (...values: number[]) => {
  if (values.some(n => !Number.isFinite(n) || n < 0 || n > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001)) throw new RangeError('Use non-negative dollar amounts with at most two decimals.');
};
const round = (n: number) => Math.round(n * 100) / 100;

/** Compare complete, consecutive months only. Savings changes must exclude
 * investment gains and transfers between accounts already counted as savings. */
export function checkIn(plan: MonthlyPlan, months: { saved: number; dining: number }[]) {
  valid(plan.startingSavings, plan.goal, plan.monthlySaving, plan.diningBudget);
  if (plan.goal <= 0 || months.length > 120) throw new RangeError('Provide a positive goal and at most 120 months.');
  for (const m of months) {
    valid(Math.abs(m.saved), m.dining);
  }
  const actualSavings = round(plan.startingSavings + months.reduce((sum, m) => sum + m.saved, 0));
  const plannedSavings = round(plan.startingSavings + plan.monthlySaving * months.length);
  const aheadDollars = round(actualSavings - plannedSavings);
  const diningOver = months.length ? round(Math.max(0, months.at(-1)!.dining - plan.diningBudget)) : 0;
  const remainingMonths = (balance: number) => balance >= plan.goal ? 0 : plan.monthlySaving > 0 ? Math.ceil(round(plan.goal - balance) / plan.monthlySaving) : null;
  const actualRemaining = remainingMonths(actualSavings), plannedRemaining = remainingMonths(plannedSavings);
  return { actualSavings, plannedSavings, aheadDollars, diningOver, actualRemaining,
    monthsAhead: actualRemaining === null || plannedRemaining === null ? null : plannedRemaining - actualRemaining,
    message: actualSavings >= plan.goal ? 'Your savings goal is funded.' : `You are $${Math.abs(aheadDollars)} ${aheadDollars >= 0 ? 'ahead of' : 'behind'} your planned savings balance.`,
    adjustment: diningOver > 0 ? `Dining was $${diningOver} over budget this month. Review whether reducing next month’s dining spending is realistic; no budget change has been made.` : 'Dining is within the supplied budget.',
    assumption: 'Forecast assumes future saving returns to the original monthly plan. Monthly steps cannot establish exact weeks ahead. Dining variance is not automatically the cause of a savings shortfall.' };
}

/** Compare confirmed monthly take-home totals, not individual payroll deposits. */
export function saveTheRaise(previousMonthlyPay: number, currentMonthlyPay: number, confirmedRecurring: boolean, savePercent = 50) {
  valid(previousMonthlyPay, currentMonthlyPay, savePercent);
  if (savePercent > 100) throw new RangeError('Savings percentage must be 0–100.');
  const raise = round(Math.max(0, currentMonthlyPay - previousMonthlyPay));
  const suggestedSaving = confirmedRecurring ? round(raise * savePercent / 100) : 0;
  return { raise, suggestedSaving, annualSaving: round(suggestedSaving * 12),
    status: raise === 0 ? 'no_raise' : confirmedRecurring ? 'review' : 'confirm',
    message: raise === 0 ? 'No increase in monthly take-home pay was supplied.' : !confirmedRecurring ? 'Your monthly pay increased. Confirm this is recurring, not a bonus or an extra payday.' : `Your monthly take-home pay increased by $${raise}. Consider saving $${suggestedSaving} of it, if your updated budget allows.`,
    requiresApproval: true,
    assumption: 'Illustration only; no transfer is created. Check new expenses and required payments before approving a savings commitment.' };
}
