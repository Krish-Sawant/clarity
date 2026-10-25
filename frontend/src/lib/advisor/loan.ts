import type { Transaction } from './engine.ts';


export const LOAN_SOURCES = [
  // Verify this URL opens before the demo, then keep the reviewed date current.
  { id: 'cfpb-auto', title: 'CFPB: Auto loans', url: 'https://www.consumerfinance.gov/consumer-tools/auto-loans/', reviewed: '2026-10-24', note: 'Consumer guidance on comparing loan terms, total cost and shopping for financing.' },
] as const;

export type LoanInputs = {
  aprPercent: number;        // offered rate, 0-100
  termMonths: number;        // 12-96
  cashCents: number;         // liquid savings
  grossMonthlyCents?: number; // if omitted, estimated from take-home
};
export type LoanAssumptions = { lenderDtiPct: number; comfortableShare: number; rateShockPoints: number; estTakeHomeRatio: number };
export const DEFAULTS: LoanAssumptions = { lenderDtiPct: 30, comfortableShare: 0.4, rateShockPoints: 2, estTakeHomeRatio: 0.8 };

const excluded = new Set(['payroll', 'transfer', 'credit_card_payment', 'cash_withdrawal']);
const debtCats = new Set(['student_loan', 'loan_payment']);

function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
function cents(n: number) {
  if (!Number.isFinite(n) || Math.abs(n) > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new RangeError('Transaction amounts must be finite USD dollars with at most two decimal places.');
  return Math.round(n * 100);
}
export function paymentCents(principalCents: number, aprPercent: number, n: number) {
  const r = aprPercent / 1200;
  return r === 0 ? Math.round(principalCents / n) : Math.round(principalCents * r / (1 - Math.pow(1 + r, -n)));
}
// Largest loan (rounded down to $100) whose monthly payment fits under maxPaymentCents.
export function maxPrincipalCents(maxPaymentCents: number, aprPercent: number, n: number) {
  if (maxPaymentCents <= 0) return 0;
  const r = aprPercent / 1200;
  const raw = r === 0 ? maxPaymentCents * n : maxPaymentCents * (1 - Math.pow(1 + r, -n)) / r;
  return Math.floor(raw / 10000) * 10000;
}

export function analyzeCashFlow(transactions: Transaction[], asOf: string, coveredFrom: string) {
  if (!validDate(asOf) || !validDate(coveredFrom) || coveredFrom > asOf) throw new RangeError('Provide valid as-of and coverage dates.');
  const end = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 3);
  const startDate = start.toISOString().slice(0, 10), endExclusive = end.toISOString().slice(0, 10);
  const ids = new Set<string>();
  let incomeCents = 0, spendingCents = 0, debtPaymentCents = 0;
  for (const t of transactions) {
    if (!t.id || ids.has(t.id) || !validDate(t.date)) throw new RangeError('Transactions need unique IDs and valid dates.');
    ids.add(t.id); const amount = cents(t.amount);
    if (t.date < startDate || t.date >= endExclusive) continue; // three complete months only
    if (t.category === 'payroll' && amount > 0) { incomeCents += amount; continue; }
    if (excluded.has(t.category)) continue;
    if (amount < 0 || t.category) spendingCents -= amount; // refunds reduce spending
    if (amount < 0 && debtCats.has(t.category)) debtPaymentCents -= amount;
  }
  return {
    startDate, endExclusive, completeCoverage: coveredFrom <= startDate,
    monthlyTakeHomeCents: Math.round(incomeCents / 3),
    monthlySpendingCents: Math.max(0, Math.round(spendingCents / 3)),
    monthlyDebtPaymentCents: Math.round(debtPaymentCents / 3),
  };
}

const runway = (cash: number, monthlyOut: number) => monthlyOut <= 0 ? null : Math.round((cash / monthlyOut) * 10) / 10;

export function compareLoanAffordability(transactions: Transaction[], asOf: string, coveredFrom: string, loan: LoanInputs, overrides: Partial<LoanAssumptions> = {}) {
  const a = { ...DEFAULTS, ...overrides };
  if (!Number.isFinite(loan.aprPercent) || loan.aprPercent < 0 || loan.aprPercent > 100) throw new RangeError('APR must be 0-100.');
  if (!Number.isInteger(loan.termMonths) || loan.termMonths < 12 || loan.termMonths > 96) throw new RangeError('Term must be 12-96 whole months.');
  if (!Number.isInteger(loan.cashCents) || loan.cashCents < 0) throw new RangeError('Cash must be a non-negative whole number of cents.');

  const cf = analyzeCashFlow(transactions, asOf, coveredFrom);
  const surplusCents = cf.monthlyTakeHomeCents - cf.monthlySpendingCents;
  const currentRunway = runway(loan.cashCents, cf.monthlySpendingCents);

  const reasons: string[] = [];
  let status: 'not_yet' | 'needs_information' | 'compare';
  if (!cf.completeCoverage || cf.monthlyTakeHomeCents <= 0) {
    status = 'needs_information';
    reasons.push('We need three complete months of transactions that include your paychecks before estimating what is comfortable.');
  } else if (surplusCents <= 0) {
    status = 'not_yet';
    reasons.push('Your spending is at or above your take-home pay, so a new payment would have to come out of savings.');
  } else if (currentRunway !== null && currentRunway < 3) {
    status = 'not_yet';
    reasons.push(`Your savings cover about ${currentRunway} months of current spending. Building a three-month cushion first makes a new payment safer.`);
  } else status = 'compare';

  const base = { status, reasons, cashFlow: { ...cf, surplusCents, currentRunwayMonths: currentRunway }, loan, assumptions: [] as string[], sources: LOAN_SOURCES };
  if (status !== 'compare') {
    return { ...base, scenarios: null, gapCents: 0, message: status === 'not_yet' ? 'Not yet: strengthen your cushion before taking on a payment.' : 'A little more context before we compare.' };
  }

  const grossMonthly = loan.grossMonthlyCents ?? Math.round(cf.monthlyTakeHomeCents / a.estTakeHomeRatio);
  const lenderMaxPayment = Math.max(0, Math.round(grossMonthly * a.lenderDtiPct / 100) - cf.monthlyDebtPaymentCents);
  const comfortablePayment = Math.min(Math.round(surplusCents * a.comfortableShare), lenderMaxPayment);

  const build = (label: string, maxPayment: number) => {
    const principalCents = maxPrincipalCents(maxPayment, loan.aprPercent, loan.termMonths);
    const pay = paymentCents(principalCents, loan.aprPercent, loan.termMonths);
    const shockPay = paymentCents(principalCents, loan.aprPercent + a.rateShockPoints, loan.termMonths);
    return {
      label, principalCents, paymentCents: pay,
      totalInterestCents: pay * loan.termMonths - principalCents,
      paymentShareOfTakeHome: Math.round((pay / cf.monthlyTakeHomeCents) * 1000) / 10,
      monthlySurplusAfterPaymentCents: surplusCents - pay,
      jobLossRunwayMonths: runway(loan.cashCents, cf.monthlySpendingCents + pay), // no income, spending continues
      rateUp: { points: a.rateShockPoints, paymentCents: shockPay, extraPerMonthCents: shockPay - pay },
    };
  };
  const lender = build('What a lender might approve', lenderMaxPayment);
  const comfortable = build('What fits your actual spending', comfortablePayment);

  return {
    ...base,
    scenarios: { lender, comfortable },
    gapCents: lender.principalCents - comfortable.principalCents,
    message: 'Compare approval with comfort, then decide.',
    assumptions: [
      'Illustrative rule, not a lender decision: a lender ceiling of ' + a.lenderDtiPct + '% of gross income for all debt payments, minus existing loan payments.',
      `Comfortable means the payment uses at most ${Math.round(a.comfortableShare * 100)}% of your average monthly surplus, so savings keep growing.`,
      `Income and spending are three-month averages from your transactions; gross income is ${loan.grossMonthlyCents ? 'as entered' : `estimated as take-home / ${a.estTakeHomeRatio}`}.`,
      'Job loss assumes zero income and unchanged spending, drawing only on cash savings (no unemployment benefits, severance or credit).',
      `Rate-up shows the payment if the offered APR were ${a.rateShockPoints} points higher; a fixed-rate loan does not change after signing.`,
      'Excludes taxes, fees, insurance, down payment, trade-in, fuel and maintenance, which raise the real monthly cost of a car.',
      'No approval predictions. Check real lender offers; applying may involve a hard credit inquiry.',
    ],
  };
}