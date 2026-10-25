import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCardSpending, compareCardReadiness, detectCreditMoment, CARD_PROFILES, CREDIT_SOURCES } from './credit.ts';
import { CREDIT_DEMO_TRANSACTIONS as rows } from './credit-demo.ts';
const ready = { repayment: 'full', missedPayments: 'no', historyConfirmed: 'yes' } as const;
const run = (data = rows) => compareCardReadiness(data, '2026-10-24', '2026-07-01', ready);
test('observed spending yields exact transparent annual rewards and fees', () => {
  const r = run(); assert.equal(r.status, 'compare');
  assert.deepEqual(r.estimates.map(e => [e.id, e.netCents]), [['dining', 19200], ['flat', 15600], ['annual-fee', 15700]].sort((a,b) => Number(b[1])-Number(a[1])));
  assert.equal(r.analysis.spending[0].monthlyCents, 40000);
  assert.equal(r.estimates.find(e => e.id === 'annual-fee')!.feeCents, 9500);
});
test('carried balances and missed payments gate every recommendation', () => {
  for (const q of [{ ...ready, repayment: 'carry' as const }, { ...ready, missedPayments: 'yes' as const }]) {
    const r = compareCardReadiness(rows, '2026-10-24', '2026-07-01', q);
    assert.equal(r.status, 'not_yet'); assert.equal(r.estimates.length, 0); assert.deepEqual(r.leadingProfileIds, []);
  }
});
test('unknown answers, sparse coverage and unknown spending do not become ready', () => {
  assert.equal(compareCardReadiness(rows, '2026-10-24', '2026-08-01', ready).status, 'needs_information');
  assert.equal(compareCardReadiness(rows, '2026-10-24', '2026-07-01', { ...ready, repayment: 'unknown' }).status, 'needs_information');
  assert.equal(run([...rows, { id: 'unknown', date: '2026-09-01', amount: -50, merchant: 'X', category: 'unclassified' }]).status, 'needs_information');
  assert.equal(run([]).status, 'needs_information');
});
test('current month purchases excluded; current interest is a readiness signal', () => {
  const t = { id: 'x', date: '2026-10-24', amount: -200, merchant: 'X', category: 'dining' };
  assert.deepEqual(run([...rows, t]).estimates, run().estimates);
  assert.equal(run([...rows, { ...t, category: 'credit_card_interest' }]).status, 'not_yet');
});
test('refunds reduce eligible spending; excluded transfers and future activity do not earn', () => {
  const t = { id: 'refund', date: '2026-09-01', amount: 100, merchant: 'X', category: 'dining' };
  assert.equal(run([...rows, t]).analysis.spending[0].annualCents, 440000);
  assert.deepEqual(run([...rows, { ...t, date: '2026-11-01' }]).estimates, run().estimates);
  assert.deepEqual(run([...rows, { ...t, category: 'transfer', amount: -10000 }]).estimates, run().estimates);
});
test('annual category caps apply base rate to excess', () => {
  const data = rows.map(t => t.category === 'dining' ? { ...t, amount: -2000 } : t);
  const dining = run(data).estimates.find(e => e.id === 'dining')!;
  assert.equal(dining.breakdown[0].bonusSpendCents, 1200000);
  assert.equal(dining.breakdown[0].rewardCents, 48000);
});
test('bad dates, fractional cents and duplicate IDs rejected; input not mutated', () => {
  const before = JSON.stringify(rows); run(); assert.equal(JSON.stringify(rows), before);
  assert.throws(() => run([...rows, rows[0]]), RangeError);
  assert.throws(() => analyzeCardSpending(rows, '2026-02-30', '2026-01-01'), RangeError);
  assert.throws(() => run([{ ...rows[0], amount: -1.001 }]), RangeError);
});
test('first observed payroll invites confirmation and does not imply readiness', () => {
  assert.ok(detectCreditMoment(rows, '2026-10-24')?.requiresConfirmation);
  assert.equal(detectCreditMoment(rows, '2026-09-24'), null);
  const prior = { id: 'old', date: '2026-09-01', amount: 3200, merchant: 'Demo employer', category: 'payroll' };
  assert.equal(detectCreditMoment([...rows, prior], '2026-10-24'), null);
});

// 1. The winner must change with the data (guards against a hardcoded ranking)
test('flat card wins when spending is spread out', () => {
  // 'shopping' maps to 'other', which earns only each card's base rate
  const spread = rows.map(t => t.category === 'dining' ? { ...t, category: 'shopping' } : t);
  const r = run(spread);
  assert.equal(r.status, 'compare');
  assert.deepEqual(r.leadingProfileIds, ['flat']);
  // the annual-fee card earns the same gross as flat here, so the fee must be what makes it lose
  const flat = r.estimates.find(e => e.id === 'flat')!;
  const fee = r.estimates.find(e => e.id === 'annual-fee')!;
  assert.equal(fee.grossCents, flat.grossCents);
  assert.equal(flat.netCents - fee.netCents, 9500);
});

// 2. Trust metadata: sources are real-looking, dated, and cards are labeled illustrative
test('sources are cited and card profiles are labeled illustrative', () => {
  assert.ok(CREDIT_SOURCES.length > 0);
  for (const s of CREDIT_SOURCES) {
    assert.match(s.url, /^https:\/\/www\.consumerfinance\.gov\//);
    assert.match(s.reviewed, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(s.title.length > 0 && s.note.length > 0);
  }
  for (const p of CARD_PROFILES) assert.match(p.name, /example/i);
  const r = run();
  assert.equal(r.sources, CREDIT_SOURCES);
  assert.ok(r.assumptions.some(a => /illustrative/i.test(a)));
  assert.ok(r.assumptions.some(a => /no .*approval predictions/i.test(a)));
});

// 3. Risk beats missing data: don't ask a user for more info if the answer is already "not yet"
test('risk signals take precedence over needs_information', () => {
  const sparse = '2026-08-01'; // incomplete coverage on its own would be needs_information
  assert.equal(compareCardReadiness(rows, '2026-10-24', sparse, ready).status, 'needs_information');
  for (const q of [{ ...ready, repayment: 'carry' as const }, { ...ready, missedPayments: 'yes' as const }]) {
    const r = compareCardReadiness(rows, '2026-10-24', sparse, q);
    assert.equal(r.status, 'not_yet');
    assert.equal(r.estimates.length, 0);
  }
  // unknown repayment plus a reported missed payment is still not_yet
  const mixed = compareCardReadiness(rows, '2026-10-24', '2026-07-01', { ...ready, repayment: 'unknown', missedPayments: 'yes' });
  assert.equal(mixed.status, 'not_yet');
});

// 4. No answer path defaults to "ready"
test('every unconfirmed or unknown answer withholds a comparison', () => {
  const cases = [
    { ...ready, missedPayments: 'unknown' as const },
    { ...ready, historyConfirmed: 'no' as const },
    { ...ready, historyConfirmed: 'unknown' as const },
    { ...ready, repayment: 'unknown' as const },
  ];
  for (const q of cases) {
    const r = compareCardReadiness(rows, '2026-10-24', '2026-07-01', q);
    assert.equal(r.status, 'needs_information', JSON.stringify(q));
    assert.equal(r.estimates.length, 0);
    assert.deepEqual(r.leadingProfileIds, []);
  }
  // 'first-card' is not a risk signal, so it can compare (documents current behavior)
  assert.equal(compareCardReadiness(rows, '2026-10-24', '2026-07-01', { ...ready, repayment: 'first-card' }).status, 'compare');
  // malformed answers throw instead of silently passing
  assert.throws(() => compareCardReadiness(rows, '2026-10-24', '2026-07-01', { ...ready, repayment: 'maybe' as never }), RangeError);
});