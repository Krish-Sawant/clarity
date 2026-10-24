'use client';

import { useState } from 'react';
import { detectLargePurchases } from '@/lib/advisor/engine';
import { previewPurchase } from '@/lib/advisor/purchase';
import styles from './preview.module.css';

const initial = { label: 'TV', purchaseAmount: '1200', currentSavings: '3000', targetSavings: '6000', monthlyContribution: '600' };
const labels = { purchaseAmount: 'Purchase price', currentSavings: 'Current goal savings', targetSavings: 'Emergency fund goal', monthlyContribution: 'Monthly contribution' };
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const detected = detectLargePurchases([{ id: 'demo-tv', date: '2026-10-24', amount: -1200, merchant: 'Demo Electronics', category: 'electronics' }], '2026-10-24')[0];
const duration = (months: number | null) => months === null ? 'Beyond projection' : months === 0 ? 'Goal met now' : `Month ${months}`;

export default function PurchaseImpactPreview() {
  const [fields, setFields] = useState(initial);
  const [timing, setTiming] = useState<'planned' | 'posted'>('planned');
  const [source, setSource] = useState(false);
  let result: ReturnType<typeof previewPurchase> | null = null;
  let error = '';
  try {
    if (Object.values(fields).some(value => !value.trim())) throw new Error('Complete all fields to see the preview.');
    result = previewPurchase({ label: fields.label, timing, purchaseAmount: Number(fields.purchaseAmount), currentSavings: Number(fields.currentSavings), targetSavings: Number(fields.targetSavings), monthlyContribution: Number(fields.monthlyContribution) });
  } catch (e) { error = e instanceof Error ? e.message : 'Check the entered amounts.'; }
  const end = result ? Math.min(120, Math.max(12, result.purchaseMonths ?? 120, result.baselineMonths ?? 120)) : 12;
  const rows = result?.baseline.points.slice(0, end + 1).map((p, i) => ({ month: p.month, without: p.cash, with: result!.purchased.points[i].cash })) ?? [];
  const high = Math.max(1, result?.targetSavings ?? 1, ...rows.map(r => r.without));
  const low = Math.min(0, ...rows.map(r => r.with));
  const y = (value: number) => 205 - (value - low) / (high - low) * 180;
  const line = (key: 'without' | 'with') => rows.map(r => `${55 + r.month / end * 600},${y(r[key])}`).join(' ');
  const reset = () => { setFields(initial); setTiming('planned'); setSource(false); };

  return <main className={styles.page}>
    <header className={styles.header}><a href="/">Clarity</a><span>Synthetic demo · No money moves</span></header>
    <section className={styles.intro}><p className={styles.eyebrow}>PURCHASE IMPACT PREVIEW</p><h1>See the tradeoff.<br />Make it your choice.</h1><p>A purchase changes your plan. Explore how much, before deciding what works for you.</p></section>
    <aside className={styles.nudge}><div><strong>A purchase worth a closer look</strong><p>{detected.message}</p></div><button type="button" onClick={() => { setFields({ ...initial, currentSavings: '1800', label: 'purchase at Demo Electronics' }); setTiming('posted'); setSource(true); }}>Preview detected purchase</button></aside>
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="purchase-inputs"><h2 id="purchase-inputs">Your purchase, your goal</h2>
        <label>What are you considering?<input value={fields.label} maxLength={80} onChange={e => { setFields({ ...fields, label: e.target.value }); setSource(false); }} /></label>
        <label>Balance timing<select value={timing} onChange={e => { setTiming(e.target.value as 'planned' | 'posted'); setSource(false); }}><option value="planned">Before purchase — preview a plan</option><option value="posted">After purchase — already deducted</option></select></label>
        <p className={styles.hint}>{timing === 'posted' ? 'Enter savings after this purchase was deducted. Confirm it came from this goal account.' : 'Enter savings before this purchase. This assumes you pay from the goal account.'}</p>
        {(Object.keys(labels) as (keyof typeof labels)[]).map(key => <label key={key}>{labels[key]} (USD)<input type="number" min={key === 'targetSavings' ? '0.01' : '0'} max="1000000000" step="0.01" value={fields[key]} aria-describedby={error ? 'preview-error' : undefined} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setSource(false); }} /></label>)}
        <button type="button" onClick={reset}>Reset example</button>
      </section>
      <section className={styles.card} aria-labelledby="preview-title"><h2 id="preview-title">Your future, side by side</h2>
        {error ? <p id="preview-error" role="alert" className={styles.warning}>{error}</p> : result && <>
          <div aria-live="polite" aria-atomic="true"><p className={styles.result}>{result.message}</p><p className={styles.hint}>A planning estimate, not a recommendation to buy or avoid the purchase.</p></div>
          <div className={styles.stats}><div><span>Without purchase</span><strong>{duration(result.baselineMonths)}</strong></div><div><span>With purchase</span><strong>{duration(result.purchaseMonths)}</strong></div><div><span>Cash after purchase</span><strong>{usd(result.remainingAfterPurchase)}</strong></div></div>
          {result.shortfallAmount > 0 && <p className={styles.warning}>This exceeds the selected savings by {usd(result.shortfallAmount)}. The negative path shows a cash shortfall; it does not model borrowing or its costs.</p>}
          <svg className={styles.chart} viewBox="0 0 690 250" role="img" aria-label={`Savings over ${end} months. Without purchase: ${duration(result.baselineMonths)}. With purchase: ${duration(result.purchaseMonths)}. Exact monthly values are in the table below.`}>
            <line x1="55" x2="655" y1={y(result.targetSavings)} y2={y(result.targetSavings)} stroke="#998b62" strokeDasharray="3 5" /><text x="60" y={y(result.targetSavings) - 7} fontSize="11" fill="#675a36">Goal {usd(result.targetSavings)}</text>
            <polyline points={line('without')} fill="none" stroke="#85978e" strokeWidth="3" strokeDasharray="7 5" />
            <polyline points={line('with')} fill="none" stroke="#167d72" strokeWidth="3" />
            <text x="55" y="235" fontSize="12">Now</text><text x="600" y="235" fontSize="12">Month {end}</text>
          </svg>
          <p className={styles.hint}>Dashed gray: without purchase · Solid teal: with purchase · Dotted: goal</p>
          <button type="button" onClick={() => {
            setFields({ ...fields, currentSavings: result!.baseline.points[0].cash.toFixed(2), purchaseAmount: (Math.round(Number(fields.purchaseAmount) * 50) / 100).toFixed(2) });
            setTiming('planned'); setSource(false);
          }}>Explore half the price</button>
          <details><summary>Why you can trust this estimate</summary>{source && <p>{detected.evidence} Synthetic activity; funding account must be confirmed.</p>}<p>Calculated locally by the existing monthly simulator with and without one immediate cash purchase.</p><ul>{result.assumptions.map(a => <li key={a}>{a}</li>)}</ul></details>
          <details><summary>See monthly values</summary><div className={styles.table}><table><caption>Projected goal savings in USD</caption><thead><tr><th>Month</th><th>Without purchase</th><th>With purchase</th></tr></thead><tbody>{rows.map(r => <tr key={r.month}><th>{r.month}</th><td>{usd(r.without)}</td><td>{usd(r.with)}</td></tr>)}</tbody></table></div></details>
        </>}
      </section>
    </div>
  </main>;
}
