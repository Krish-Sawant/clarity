'use client';

import { useState } from 'react';
import Link from 'next/link';
import { compareCardReadiness, detectCreditMoment } from '@/lib/advisor/credit';
import type { Readiness } from '@/lib/advisor/credit';
import type { Transaction } from '@/lib/advisor/engine';
import { CREDIT_DEMO_TRANSACTIONS, CREDIT_DEMO_AS_OF, CREDIT_DEMO_COVERAGE } from '@/lib/advisor/credit-demo';
import styles from '../purchase-impact/preview.module.css';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const initial: Readiness = { repayment: 'unknown', missedPayments: 'unknown', historyConfirmed: 'unknown' };

/** Pass validated activity and its coverage dates when integrating into the UI.
 * Default data is synthetic; the current screen remains explicitly a demo. */
export default function CreditCardPreview({ transactions = CREDIT_DEMO_TRANSACTIONS, asOf = CREDIT_DEMO_AS_OF, coveredFrom = CREDIT_DEMO_COVERAGE }: { transactions?: Transaction[]; asOf?: string; coveredFrom?: string }) {
  const [answers, setAnswers] = useState<Readiness>(initial);
  const [feeExample, setFeeExample] = useState(false);
  const [confirmedMoment, setConfirmedMoment] = useState(false);
  const activity = feeExample ? [...transactions, { id: 'demo-interest-fee', date: asOf, amount: -35, merchant: 'Demo card interest', category: 'credit_card_interest' }] : transactions;
  let result: ReturnType<typeof compareCardReadiness> | null = null;
  let moment: ReturnType<typeof detectCreditMoment> = null;
  let error = '';
  try {
    result = compareCardReadiness(activity, asOf, coveredFrom, answers);
    moment = detectCreditMoment(activity, asOf);
  } catch (e) { error = e instanceof Error ? e.message : 'Please check the supplied activity.'; }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">Clarity</Link><span>Synthetic demo · Illustrative card profiles</span></header>
    <section className={styles.intro}><p className={styles.eyebrow}>CREDIT CARD READINESS</p><h1>A card that fits?<br />Start with your habits.</h1><p>Your existing spending supplies the numbers. Three answers help decide whether comparing rewards makes sense at all.</p></section>
    {moment && <aside className={styles.nudge}><div><strong>{moment.title}</strong><p>{moment.message}</p><details><summary>Why this appeared</summary>{moment.evidence}</details></div><button type="button" onClick={() => { setConfirmedMoment(true); document.getElementById('repayment')?.focus(); }}>{confirmedMoment ? 'Continue readiness check' : 'Yes, explore readiness'}</button></aside>}
    {error ? <p role="alert" className={styles.warning}>{error}</p> : result && <div className={styles.grid}>
      <section className={styles.card}><h2>What transactions tell us</h2>
        <p className={styles.hint}>Three complete months: {result.analysis.startDate} through the day before {result.analysis.endExclusive}. Current-month purchases are excluded.</p>
        <div className={styles.table}><table><caption>Average monthly eligible spending</caption><thead><tr><th>Category</th><th>USD / month</th></tr></thead><tbody>{result.analysis.spending.map(row => <tr key={row.category}><th>{row.category}</th><td>{usd(row.monthlyCents)}</td></tr>)}</tbody></table></div>
        <p className={styles.hint}>{usd(result.analysis.excludedOutflowCents)} of outflows excluded across the period, including rent, transfers and debt payments.</p>
        {result.analysis.unknownOutflowCents > 0 && <p className={styles.warning}>{usd(result.analysis.unknownOutflowCents)} needs categorization before a comparison.</p>}
        {result.analysis.refundExcessCents > 0 && <p className={styles.hint}>Refunds exceeded purchases in a category; that category is floored at zero for this estimate.</p>}
        <details><summary>See the transaction evidence</summary><ul>{activity.map(t => <li key={t.id}>{t.date} · {t.merchant} · {usd(Math.round(t.amount * 100))} · {t.category}</li>)}</ul></details>
        <label><input type="checkbox" checked={feeExample} onChange={e => setFeeExample(e.target.checked)} style={{ display: 'inline', width: 'auto', marginRight: 8 }} />Try a detected interest-charge example</label>
      </section>
      <section className={styles.card}><h2>What transactions cannot tell us</h2>
        <label htmlFor="repayment">1. How do you handle card balances?<select id="repayment" value={answers.repayment} onChange={e => setAnswers({ ...answers, repayment: e.target.value as Readiness['repayment'] })}>
          <option value="unknown">Choose / not sure</option><option value="full">I pay the full statement balance by its due date</option><option value="carry">I carry a balance between months</option><option value="first-card">First card: I plan and can afford to pay in full</option>
        </select></label>
        <label>2. Have you missed a required payment in the last 6 months?<select value={answers.missedPayments} onChange={e => setAnswers({ ...answers, missedPayments: e.target.value as Readiness['missedPayments'] })}><option value="unknown">Choose / not sure</option><option value="no">No</option><option value="yes">Yes</option></select></label>
        <label>3. Does this activity cover your full, typical purchase spending for these three months?<select value={answers.historyConfirmed} onChange={e => setAnswers({ ...answers, historyConfirmed: e.target.value as Readiness['historyConfirmed'] })}><option value="unknown">Choose / not sure</option><option value="yes">Yes, the history is complete and representative</option><option value="no">No, spending or accounts are missing</option></select></label>
        <button type="button" onClick={() => { setAnswers(initial); setFeeExample(false); setConfirmedMoment(false); }}>Reset answers</button>
        <div aria-live="polite" aria-atomic="true" style={{ marginTop: 24 }}><p className={styles.result}>{result.message}</p><ul>{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
        {result.status === 'not_yet' && <p className={styles.warning}>No rewards-card recommendation for now. This is a conservative demo rule, not a credit decision or a diagnosis of your finances.</p>}
        {result.status === 'compare' && <>
          <p className={styles.hint}>Estimated annual rewards after the annual fee, before interest or other costs. These are fictional profiles, not FNB or other issuer offers. No application or approval is implied.</p>
          {result.estimates.map(card => <article key={card.id} style={{ borderTop: '1px solid #dde5dc', padding: '22px 0' }}><h3 style={{ fontWeight: 700 }}>{card.name}</h3>
            <p style={{ fontSize: 28, margin: '10px 0' }}>{usd(card.netCents)} <span style={{ fontSize: 13 }}>estimated / year after annual fee</span></p>
            <p>{usd(card.grossCents)} rewards − {usd(card.feeCents)} annual fee</p>
            {result.leadingProfileIds.includes(card.id) && <p className={styles.hint}>Highest modeled net rewards among these examples—not an eligibility recommendation.</p>}
            <details><summary>Show the math and category caps</summary><ul>{card.breakdown.map(row => <li key={row.category}><strong>{row.category}:</strong> {usd(row.annualCents)} annualized spend; {row.bonusSpendCents > 0 ? `${usd(row.bonusSpendCents)} × ${row.bonusBps / 100}% + ` : ''}{usd(row.baseSpendCents)} × {row.baseBps / 100}% = {usd(row.rewardCents)}. {row.baseSpendCents > 0 && row.bonusSpendCents > 0 ? 'Above-cap spending earns the base rate.' : ''}</li>)}</ul><p className={styles.hint}>Annual spend = observed three-month net purchases × 4. Monthly averages are rounded for display only.</p></details>
          </article>)}
        </>}
        <h3 style={{ marginTop: 24, fontWeight: 700 }}>A useful next step</h3><ul>{result.nextSteps.map(step => <li key={step}>{step}</li>)}</ul>
        <details><summary>Why you can trust this comparison</summary><p>Spending and rewards are calculated locally. Readiness answers are yours; they are not inferred from a paycheck or credit score. Educational sources support explanations, not the fictional card rates.</p><ul>{result.assumptions.map(a => <li key={a}>{a}</li>)}</ul>{result.sources.map(s => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{s.title}</a> — {s.note}</p>)}<p className={styles.hint}>Source review date: 2026-10-24. This page uses sourced text and deterministic calculations; no live AI or RAG is connected.</p></details>
      </section>
    </div>}
  </main>;
}
