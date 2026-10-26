import { detect } from './engine.ts';
import type { Transaction } from './engine.ts';

export const CREDIT_SOURCES = [
  { id: 'cfpb-grace', title: 'CFPB: Credit card grace periods', url: 'https://www.consumerfinance.gov/ask-cfpb/what-is-a-grace-period-for-a-credit-card-en-47/', reviewed: '2026-10-24', note: 'Paying in full by the due date can avoid purchase interest when the card provides a grace period and its conditions are met.' },
  { id: 'cfpb-cards', title: 'CFPB: Credit card resources', url: 'https://www.consumerfinance.gov/consumer-tools/credit-cards/', reviewed: '2026-10-24', note: 'Resources for comparing terms and managing existing cards.' },
] as const;
export type Category = 'dining' | 'gas' | 'groceries' | 'other';
export type Readiness = { repayment: 'full' | 'carry' | 'first-card' | 'unknown'; missedPayments: 'yes' | 'no' | 'unknown'; historyConfirmed: 'yes' | 'no' | 'unknown' };
type CardProfile = { id: string; name: string; feeCents: number; baseBps: number; bonuses: Partial<Record<Category, { bps: number; capCents: number }>> };
// Illustrative profiles, not issuer products, eligibility claims or live offers.
export const CARD_PROFILES: readonly CardProfile[] = [
  { id: 'dining', name: 'Dining-focused example', feeCents: 0, baseBps: 100, bonuses: { dining: { bps: 300, capCents: 1200000 }, gas: { bps: 200, capCents: 600000 } } },
  { id: 'flat', name: 'Flat 2% example', feeCents: 0, baseBps: 200, bonuses: {} },
  { id: 'annual-fee', name: 'Annual-fee dining example', feeCents: 9500, baseBps: 200, bonuses: { dining: { bps: 400, capCents: 600000 } } },
];
const categories: Category[] = ['dining', 'gas', 'groceries', 'other'];
const aliases: Record<string, Category> = { dining: 'dining', restaurants: 'dining', gas: 'gas', fuel: 'gas', groceries: 'groceries', shopping: 'other', retail: 'other', electronics: 'other', travel: 'other', entertainment: 'other', subscriptions: 'other', transit: 'other', other_purchase: 'other' };
const excluded = new Set(['payroll', 'transfer', 'housing', 'student_loan', 'loan_payment', 'credit_card_payment', 'cash_withdrawal', 'interest', 'credit_card_interest', 'late_fee']);
function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
function cents(n: number) {
  if (!Number.isFinite(n) || Math.abs(n) > 1e9 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new RangeError('Transaction amounts must be finite USD dollars with at most two decimal places.');
  return Math.round(n * 100);
}
export function analyzeCardSpending(transactions: Transaction[], asOf: string, coveredFrom: string) {
  if (!validDate(asOf) || !validDate(coveredFrom) || coveredFrom > asOf) throw new RangeError('Provide valid as-of and coverage dates.');
  const end = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 3);
  const startDate = start.toISOString().slice(0, 10), endExclusive = end.toISOString().slice(0, 10);
  const totals: Record<Category, number> = { dining: 0, gas: 0, groceries: 0, other: 0 };
  const ids = new Set<string>(); const includedIds: string[] = []; const riskIds: string[] = [];
  let unknownOutflowCents = 0, excludedOutflowCents = 0;
  for (const t of transactions) {
    if (!t.id || ids.has(t.id) || !validDate(t.date)) throw new RangeError('Transactions need unique IDs and valid dates.');
    ids.add(t.id); const amount = cents(t.amount);
    if (t.date < startDate || t.date > asOf) continue;
    if (amount < 0 && ['interest', 'credit_card_interest', 'late_fee'].includes(t.category)) riskIds.push(t.id);
    if (t.date >= endExclusive) continue; // Do not annualize an incomplete month.
    const category = Object.hasOwn(aliases, t.category) ? aliases[t.category] : undefined;
    if (category) { totals[category] -= amount; includedIds.push(t.id); }
    else if (amount < 0) {
      if (excluded.has(t.category)) excludedOutflowCents -= amount;
      else unknownOutflowCents -= amount;
    }
  }
  const refundExcessCents = categories.reduce((s, c) => s + Math.max(0, -totals[c]), 0);
  const spending = categories.map(category => {
    const observedCents = Math.max(0, totals[category]);
    return { category, observedCents, monthlyCents: Math.round(observedCents / 3), annualCents: observedCents * 4 };
  });
  return { startDate, endExclusive, months: 3, completeCoverage: coveredFrom <= startDate,
    spending, includedIds, riskIds, unknownOutflowCents, excludedOutflowCents, refundExcessCents,
    eligibleAnnualCents: spending.reduce((s, r) => s + r.annualCents, 0) };
}

export function compareCardReadiness(transactions: Transaction[], asOf: string, coveredFrom: string, readiness: Readiness) {
  if (!['full', 'carry', 'first-card', 'unknown'].includes(readiness.repayment) || !['yes', 'no', 'unknown'].includes(readiness.missedPayments) || !['yes', 'no', 'unknown'].includes(readiness.historyConfirmed)) throw new RangeError('Invalid readiness answers.');
  const analysis = analyzeCardSpending(transactions, asOf, coveredFrom);
  const reasons: string[] = [];
  const risk = readiness.repayment === 'carry' || readiness.missedPayments === 'yes' || analysis.riskIds.length > 0;
  if (readiness.repayment === 'carry') reasons.push('You said you carry a card balance. Prioritize a manageable repayment plan before pursuing rewards.');
  if (readiness.missedPayments === 'yes') reasons.push('You reported a missed payment. Focus on getting payments back on track before considering another rewards card.');
  if (analysis.riskIds.length) reasons.push('An interest or late-fee entry needs clarification. It is a signal to review, not proof of your current repayment situation.');
  const missing = readiness.repayment === 'unknown' || readiness.missedPayments === 'unknown' || readiness.historyConfirmed !== 'yes' || !analysis.completeCoverage || analysis.unknownOutflowCents > 0 || analysis.eligibleAnnualCents === 0;
  if (missing) reasons.push('Confirm repayment and history, and supply three complete months of categorized purchase data before comparing profiles.');
  const status = risk ? 'not_yet' : missing ? 'needs_information' : 'compare';
  const estimates = status !== 'compare' ? [] : CARD_PROFILES.map(profile => {
    const breakdown = analysis.spending.map(row => {
      const bonus = profile.bonuses[row.category];
      const bonusSpendCents = bonus ? Math.min(row.annualCents, bonus.capCents) : 0;
      const baseSpendCents = row.annualCents - bonusSpendCents;
      const rewardCents = Math.round((bonusSpendCents * (bonus?.bps ?? 0) + baseSpendCents * profile.baseBps) / 10000);
      return { ...row, bonusSpendCents, baseSpendCents, bonusBps: bonus?.bps ?? 0, baseBps: profile.baseBps, rewardCents };
    });
    const grossCents = breakdown.reduce((s, r) => s + r.rewardCents, 0);
    return { id: profile.id, name: profile.name, grossCents, feeCents: profile.feeCents, netCents: grossCents - profile.feeCents, breakdown };
  }).sort((a, b) => b.netCents - a.netCents || a.id.localeCompare(b.id));
  const best = estimates[0]?.netCents ?? 0;
  return { status, analysis, reasons, estimates, leadingProfileIds: best > 0 ? estimates.filter(e => e.netCents === best).map(e => e.id) : [],
    message: status === 'not_yet' ? 'Not yet: focus on payment stability before shopping for rewards.' : status === 'needs_information' ? 'A little more context before we compare.' : 'Compare the math, then decide whether a card belongs in your plan.',
    nextSteps: status === 'not_yet' ? ['Review balances, interest and due dates.', 'Choose reminders or payment arrangements you can maintain; contact your issuer if payments are difficult.', 'Revisit this comparison after confirming your repayment situation.'] : ['Check real issuer terms, fees, grace periods and eligibility before any application.', 'Keep spending at its existing level; rewards do not justify spending more.'],
    assumptions: ['Illustrative card profiles only; no issuer offers, approval predictions or applications.', 'Three complete calendar months annualized at the same spending level; seasonal changes are not modeled.', 'Purchases net of same-category refunds; transfers, rent and loan/card payments excluded. Unknown purchase categories require review.', 'Net estimate = rewards minus annual fee. No interest, other fees, welcome bonuses, redemption restrictions or merchant-code differences modeled.', 'Category caps reset annually in these examples. Repayment answers are self-reported, not verified credit history.'],
    sources: CREDIT_SOURCES };
}

export function detectCreditMoment(transactions: Transaction[], asOf: string) {
  // Validate dates and amounts before delegating to the existing life-moment engine.
  analyzeCardSpending(transactions, asOf, asOf);
  const job = detect(transactions, [], asOf).find(n => n.kind === 'new-job');
  const pay = transactions.filter(t => t.date <= asOf && t.category === 'payroll' && t.amount > 0).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const first = pay[0];
  if (!job && (!first || first.date.slice(0, 7) !== asOf.slice(0, 7))) return null;
  return { id: `credit-readiness:${job?.id ?? first.id}`, title: 'A paycheck milestone?', message: 'Want to explore whether a first or different credit card makes sense? Start with repayment readiness.', evidence: job?.evidence ?? `First payroll observed in this supplied history: ${first.merchant} on ${first.date}. This may not be your first paycheck.`, requiresConfirmation: true };
}
