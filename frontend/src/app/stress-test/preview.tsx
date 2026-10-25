'use client';
import { useState } from 'react';
import Link from 'next/link';
import { stressTest, STRESS_LABELS } from '@/lib/advisor/stress';
import type { StressEvent, StressInput } from '@/lib/advisor/stress';
import './preview.css';
const styles = { page: 'stress-page', buttons: 'stress-buttons', grid: 'stress-grid', card: 'stress-card', headline: 'stress-headline', table: 'stress-table' };

const demo = { savings: '12000', monthlyIncome: '4000', monthlyExpenses: '3000', monthlyRent: '1500', horizonMonths: '24' };
const fields = { savings: 'Available cash savings ($)', monthlyIncome: 'Monthly take-home income ($)', monthlyExpenses: 'Total monthly expenses ($)', monthlyRent: 'Rent already included in expenses ($)', horizonMonths: 'Projection length (months)' };
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
export default function StressPreview() {
  const [values, setValues] = useState(demo);
  const [event, setEvent] = useState<StressEvent>('baseline');
  let result: ReturnType<typeof stressTest> | null = null, error = '';
  try {
    if (Object.values(values).some(v => !v.trim())) throw new Error('Complete every field to see a projection.');
    result = stressTest(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as StressInput, event);
  } catch (e) { error = e instanceof Error ? e.message : 'Check your inputs.'; }
  const all = result ? [...result.baseline, ...result.stressed].map(p => p.cash) : [0];
  const low = Math.min(0, ...all), high = Math.max(1, ...all);
  const y = (cash: number) => 220 - (cash - low) / (high - low) * 190;
  const line = (points: { month: number; cash: number }[]) => points.map(p => `${75 + p.month / (result?.horizon ?? 24) * 540},${y(p.cash)}`).join(' ');
  return <main className={styles.page}>
    <header><Link href="/">Clarity</Link><span>Synthetic demo · deterministic simulation</span></header>
    <h1>What if something goes wrong?</h1><p>Explore a setback before it happens. Compare your current plan with one shock at a time.</p>
    <div className={styles.buttons} role="group" aria-label="Choose a stress scenario">{(Object.keys(STRESS_LABELS) as StressEvent[]).map(key => <button key={key} aria-pressed={event === key} onClick={() => setEvent(key)}>{STRESS_LABELS[key]}</button>)}</div>
    <div className={styles.grid}>
      <section className={styles.card}><h2>Your starting point</h2>{(Object.keys(fields) as (keyof typeof demo)[]).map(key => <label key={key}>{fields[key]}<input type="number" min={key === 'horizonMonths' ? 1 : 0} max={key === 'horizonMonths' ? 120 : 1e9} step={key === 'horizonMonths' ? 1 : '0.01'} value={values[key]} onChange={e => setValues({ ...values, [key]: e.target.value })} /></label>)}<p>Include rent and required debt payments once in total expenses. Use cash available before the shock.</p><button onClick={() => { setValues(demo); setEvent('baseline'); }}>Reset demo</button></section>
      <section className={styles.card}><h2>{STRESS_LABELS[event]}</h2>{error && <p role="alert">{error}</p>}{result && <>
        <div aria-live="polite" aria-atomic="true"><p className={styles.headline}>{result.message}</p><p>Monthly income minus expenses: <strong>{usd(result.monthlyNet)}</strong></p><p>End of month {result.horizon}: <strong>{usd(result.stressed.at(-1)!.cash)}</strong> versus {usd(result.baseline.at(-1)!.cash)} without the shock.</p></div>
        <figure><svg viewBox="0 0 640 260" role="img" aria-labelledby="stress-chart-title stress-chart-desc"><title id="stress-chart-title">{`Projected cash over ${result.horizon} months`}</title><desc id="stress-chart-desc">{result.message} The dashed line shows no shock. The solid line shows {STRESS_LABELS[event]}. Exact amounts are in the table below.</desc><line x1="75" x2="615" y1={y(0)} y2={y(0)} stroke="#9aa9a2" /><text x="0" y="20">{usd(high)}</text><text x="0" y="238">{usd(low)}</text><polyline points={line(result.baseline)} fill="none" stroke="#64748b" strokeWidth="3" strokeDasharray="7 5" /><polyline points={line(result.stressed)} fill="none" stroke="#0f766e" strokeWidth="3" /><text x="75" y="255">Now</text><text x="550" y="255">Month {result.horizon}</text></svg><figcaption>Dashed: no shock · Solid: selected scenario. Below zero means a funding gap, not spendable savings.</figcaption></figure>
        <h3>Prepare now</h3><ul>{result.preparation.map(p => <li key={p}>{p}</li>)}</ul>
        <details><summary>Exact monthly values</summary><div className={styles.table}><table><caption>Projected cash in USD</caption><thead><tr><th>Month</th><th>No shock</th><th>Selected scenario</th></tr></thead><tbody>{result.stressed.map((p, i) => <tr key={p.month}><th>{p.month}</th><td>{usd(result!.baseline[i].cash)}</td><td>{usd(p.cash)}</td></tr>)}</tbody></table></div></details>
        <details><summary>Why you can trust these numbers</summary><p>Both timelines use Clarity’s shared simulation engine and the inputs shown here. No AI generates these numbers.</p><ul>{result.assumptions.map(a => <li key={a}>{a}</li>)}</ul></details>
      </>}</section>
    </div>
  </main>;
}
