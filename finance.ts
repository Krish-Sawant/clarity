/** Pure TypeScript: safe to import from a Next.js client component or server route.
 * Money inputs/outputs are integer USD cents. APR/APY are percentages: 24 = 24%.
 * Estimates assume constant rates, month-end payments/deposits, and no fees,
 * taxes, withdrawals, new borrowing, or missed payments.
 */
export type DebtInput = {
  balanceCents: number;
  aprPercent: number;
  monthlyPaymentCents: number;
  maxMonths?: number;
};
export type DebtMonth = {
  month: number;
  openingCents: number;
  interestCents: number;
  paymentCents: number;
  closingCents: number;
};
export type DebtResult = {
  status: 'paid_off' | 'payment_too_low' | 'horizon_exceeded';
  monthsToPayoff: number | null;
  totalInterestCents: number;
  totalPaymentsCents: number;
  remainingCents: number;
  schedule: DebtMonth[];
  assumptions: string[];
};
const MAX_MONEY = 1_000_000_000_000;
function money(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY)
    throw new RangeError(`${name} must be integer cents between 0 and ${MAX_MONEY}`);
  return value;
}
function rate(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1000)
    throw new RangeError(`${name} must be between 0 and 1000 percent`);
  return value;
}
function horizon(value = 1200) {
  if (!Number.isInteger(value) || value < 1 || value > 1200)
    throw new RangeError('maxMonths must be an integer between 1 and 1200');
  return value;
}
function safe(value: number) {
  if (!Number.isSafeInteger(value)) throw new RangeError('Calculation exceeds safe integer range');
  return value;
}

export function calculateDebt(input: DebtInput): DebtResult {
  let balance = money(input.balanceCents, 'balanceCents');
  const payment = money(input.monthlyPaymentCents, 'monthlyPaymentCents');
  const monthlyRate = rate(input.aprPercent, 'aprPercent') / 100 / 12;
  const limit = horizon(input.maxMonths);
  const schedule: DebtMonth[] = [];
  let totalInterestCents = 0;
  let totalPaymentsCents = 0;
  const result = (status: DebtResult['status']): DebtResult => ({
    status,
    monthsToPayoff: status === 'paid_off' ? schedule.length : null,
    totalInterestCents, totalPaymentsCents, remainingCents: balance, schedule,
    assumptions: [
      'Monthly estimate: interest = opening balance × APR / 12, rounded to the nearest cent.',
      'Fixed APR and payment; payment occurs after monthly interest; final payment is capped at amount owed.',
      'No new charges, fees, promotional periods, or missed payments. Actual issuer daily-interest methods can differ.',
    ],
  });
  if (balance === 0) return result('paid_off');
  for (let month = 1; month <= limit; month++) {
    const interest = Math.round(balance * monthlyRate);
    // Under these fixed assumptions a payment at/below interest never reduces principal.
    if (payment <= interest) return result('payment_too_low');
    const actualPayment = Math.min(payment, safe(balance + interest));
    const closing = safe(balance + interest - actualPayment);
    schedule.push({ month, openingCents: balance, interestCents: interest,
      paymentCents: actualPayment, closingCents: closing });
    totalInterestCents = safe(totalInterestCents + interest);
    totalPaymentsCents = safe(totalPaymentsCents + actualPayment);
    balance = closing;
    if (balance === 0) return result('paid_off');
  }
  return result('horizon_exceeded');
}

export function compareExtraPayment(input: DebtInput, extraPaymentCents: number) {
  money(extraPaymentCents, 'extraPaymentCents');
  const baseline = calculateDebt(input);
  const accelerated = calculateDebt({ ...input,
    monthlyPaymentCents: safe(input.monthlyPaymentCents + extraPaymentCents) });
  const comparable = baseline.status === 'paid_off' && accelerated.status === 'paid_off';
  return {
    baseline, accelerated,
    // Never compare partial-horizon interest as though it were lifetime interest.
    monthsSaved: comparable ? baseline.monthsToPayoff! - accelerated.monthsToPayoff! : null,
    interestSavedCents: comparable ? baseline.totalInterestCents - accelerated.totalInterestCents : null,
  };
}

export type SavingsInput = {
  currentCents: number;
  targetCents: number;
  monthlyContributionCents: number;
  apyPercent?: number;
  maxMonths?: number;
};
export function calculateSavings(input: SavingsInput) {
  let balance = money(input.currentCents, 'currentCents');
  const target = money(input.targetCents, 'targetCents');
  const contribution = money(input.monthlyContributionCents, 'monthlyContributionCents');
  // APY already includes compounding; dividing APY by 12 would overstate growth.
  const monthlyRate = Math.expm1(Math.log1p(rate(input.apyPercent ?? 0, 'apyPercent') / 100) / 12);
  const limit = horizon(input.maxMonths);
  const schedule: { month: number; interestCents: number; contributionCents: number; closingCents: number }[] = [];
  let totalInterestCents = 0;
  let totalContributionsCents = 0;
  const result = (status: 'goal_reached' | 'no_progress' | 'horizon_exceeded') => ({
    status, monthsToGoal: status === 'goal_reached' ? schedule.length : null,
    finalBalanceCents: balance, totalInterestCents, totalContributionsCents, schedule,
    assumptions: [
      'Fixed APY converted to an equivalent monthly rate; monthly interest rounded to cents.',
      'Fixed month-end contributions; no withdrawals, fees, or taxes. Actual account accrual can differ.',
    ],
  });
  if (balance >= target) return result('goal_reached');
  for (let month = 1; month <= limit; month++) {
    const interest = Math.round(balance * monthlyRate);
    if (interest === 0 && contribution === 0) return result('no_progress');
    balance = safe(balance + interest + contribution);
    totalInterestCents = safe(totalInterestCents + interest);
    totalContributionsCents = safe(totalContributionsCents + contribution);
    schedule.push({ month, interestCents: interest, contributionCents: contribution, closingCents: balance });
    if (balance >= target) return result('goal_reached');
  }
  return result('horizon_exceeded');
}
