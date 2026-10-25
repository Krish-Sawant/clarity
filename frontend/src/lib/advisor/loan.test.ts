import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCashFlow, compareLoanAffordability, paymentCents, maxPrincipalCents, LOAN_SOURCES, loanHeadline } from './loan.ts';
import type { Transaction } from './engine.ts';

const months = ['2026-07', '2026-08', '2026-09'];
const rows: Transaction[] = months.flatMap((m, i) => [
  { id: `p${i}`, date: `${m}-01`, amount: 4000, merchant: 'Employer', category: 'payroll' },
  { id: `r${i}`, date: `${m}-02`, amount: -1500, merchant: 'Landlord', category: 'housing' },
  { id: `g${i}`, date: `${m}-05`, amount: -700, merchant: 'Market', category: 'groceries' },
  { id: `s${i}`, date: `${m}-10`, amount: -300, merchant: 'Servicer', category: 'student_loan' },
  { id: `t${i}`, date: `${m}-12`, amount: -500, merchant: 'Savings', category: 'transfer' },
]);
const loan = { aprPercent: 7, termMonths: 60, cashCents: 1_200_000 };
const run = (data = rows, l = loan, from = '2026-07-01') => compareLoanAffordability(data, '2026-10-24', from, l);

test('payment math is exact at 0% and round-trips at 7%', () => {
  assert.equal(paymentCents(1_000_000, 0, 10), 100_000);
  const principal = maxPrincipalCents(50_000, 7, 60);
  assert.ok(paymentCents(principal, 7, 60) <= 50_000);
  assert.ok(paymentCents(principal + 10_000, 7, 60) > 50_000 - 1);
});

test('cash flow averages three complete months and excludes transfers', () => {
  const cf = analyzeCashFlow(rows, '2026-10-24', '2026-07-01');
  assert.equal(cf.monthlyTakeHomeCents, 400_000);
  assert.equal(cf.monthlySpendingCents, 250_000); // rent + groceries + student loan
  assert.equal(cf.monthlyDebtPaymentCents, 30_000);
});

test('comfortable amount is below what a lender might approve', () => {
  const r = run();
  assert.equal(r.status, 'compare');
  assert.ok(r.scenarios!.comfortable.principalCents < r.scenarios!.lender.principalCents);
  assert.equal(r.gapCents, r.scenarios!.lender.principalCents - r.scenarios!.comfortable.principalCents);
});

test('job-loss runway is shorter with the bigger loan', () => {
  const s = run().scenarios!;
  assert.ok(s.lender.jobLossRunwayMonths! < s.comfortable.jobLossRunwayMonths!);
  assert.ok(s.comfortable.jobLossRunwayMonths! < 1_200_000 / 250_000); // new payment always shortens it
});

test('rate-up raises the payment', () => {
  const s = run().scenarios!;
  assert.ok(s.comfortable.rateUp.extraPerMonthCents > 0);
});

test('spending above income is not_yet with no scenarios', () => {
  const heavy = rows.map(t => t.category === 'groceries' ? { ...t, amount: -2500 } : t);
  const r = run(heavy);
  assert.equal(r.status, 'not_yet');
  assert.equal(r.scenarios, null);
});

test('thin savings is not_yet', () => {
  const r = run(rows, { ...loan, cashCents: 300_000 });
  assert.equal(r.status, 'not_yet');
  assert.equal(r.scenarios, null);
});

test('incomplete coverage or no paychecks needs information', () => {
  assert.equal(run(rows, loan, '2026-08-15').status, 'needs_information');
  assert.equal(run([]).status, 'needs_information');
});

test('current-month activity does not change the result', () => {
  const extra: Transaction = { id: 'x', date: '2026-10-05', amount: -900, merchant: 'X', category: 'groceries' };
  assert.deepEqual(run([...rows, extra]).scenarios, run().scenarios);
});

test('invalid inputs and duplicate IDs are rejected; input not mutated', () => {
  const before = JSON.stringify(rows); run();
  assert.equal(JSON.stringify(rows), before);
  assert.throws(() => run(rows, { ...loan, aprPercent: 150 }), RangeError);
  assert.throws(() => run(rows, { ...loan, termMonths: 5 }), RangeError);
  assert.throws(() => run(rows, { ...loan, cashCents: -1 }), RangeError);
  assert.throws(() => run([...rows, rows[0]]), RangeError);
});

test('sources and assumptions are present, with no approval promises', () => {
  const r = run();
  assert.ok(LOAN_SOURCES.every(s => /^https:\/\//.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.reviewed)));
  assert.ok(r.assumptions.some(x => /no approval predictions/i.test(x)));
  assert.ok(r.assumptions.some(x => /not a lender decision/i.test(x)));
});

test('comfortable never exceeds what a lender might approve', () => {
  const r = compareLoanAffordability(rows, '2026-10-24', '2026-07-01', loan, { lenderDtiPct: 10 });
  const s = r.scenarios!;
  assert.ok(s.comfortable.principalCents <= s.lender.principalCents);
  assert.ok(r.gapCents >= 0);
});

test('headline uses the engine numbers and makes no approval promise', () => {
  const r = run();
  const s = r.scenarios!;
  const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const h = loanHeadline(r);
  assert.ok(h.includes(usd(s.lender.principalCents)));
  assert.ok(h.includes(usd(s.comfortable.principalCents)));
  assert.ok(h.includes(String(s.comfortable.jobLossRunwayMonths)));
  assert.match(h, /might approve/);
  assert.doesNotMatch(h, /you (are|will be) approved/i);
});

test('headline explains not_yet instead of showing amounts', () => {
  const h = loanHeadline(run(rows, { ...loan, cashCents: 300_000 }));
  assert.match(h, /Not yet/);
  assert.doesNotMatch(h, /\$\d/);
});

test('headline explains missing history without inventing a loan amount', () => {
  const r = run([]);
  assert.equal(loanHeadline(r), [r.message, ...r.reasons].join(' '));
  assert.doesNotMatch(loanHeadline(r), /might approve/);
});

test('headline describes equal loan amounts without suggesting a gap', () => {
  const r = compareLoanAffordability(rows, '2026-10-24', '2026-07-01', loan, { lenderDtiPct: 10 });
  assert.equal(r.gapCents, 0);
  assert.match(loanHeadline(r), /which is also what fits your spending/);
  assert.doesNotMatch(loanHeadline(r), /keeps your savings growing/);
});

test('headline omits runway when no monthly outflow can be modeled', () => {
  const r = run();
  assert.ok(r.scenarios);
  const withoutRunway = { ...r, scenarios: { ...r.scenarios, comfortable: { ...r.scenarios.comfortable, jobLossRunwayMonths: null } } };
  assert.doesNotMatch(loanHeadline(withoutRunway), /lost your job|null months/);
});
