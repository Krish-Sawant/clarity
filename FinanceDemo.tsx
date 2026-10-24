'use client';

import { useState } from 'react';
import { compareExtraPayment } from './finance';

const usd = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(cents / 100);

export default function FinanceDemo() {
  const [extraDollars, setExtraDollars] = useState(100);
  const result = compareExtraPayment({
    balanceCents: 500_000, aprPercent: 24, monthlyPaymentCents: 15_000,
  }, extraDollars * 100);
  return (
    <section style={{ maxWidth: 640, margin: '3rem auto', padding: '1.5rem', fontFamily: 'system-ui' }}>
      <h1>See what an extra payment changes</h1>
      <p>Synthetic example: $5,000 balance, 24% APR, $150 monthly payment.</p>
      <label htmlFor="extra">Extra monthly payment: {usd(extraDollars * 100)}</label>
      <input id="extra" type="range" min="0" max="500" step="10"
        value={extraDollars} onChange={e => setExtraDollars(Number(e.target.value))}
        style={{ width: '100%' }} />
      <div aria-live="polite" aria-atomic="true">
        <p>Current plan: {result.baseline.monthsToPayoff} months,
          {' '}{usd(result.baseline.totalInterestCents)} interest.</p>
        <p>With {usd((150 + extraDollars) * 100)} each month:
          {' '}{result.accelerated.monthsToPayoff} months,
          {' '}{usd(result.accelerated.totalInterestCents)} interest.</p>
        <p><strong>Estimated savings: {result.monthsSaved} months and
          {' '}{usd(result.interestSavedCents ?? 0)} in interest.</strong></p>
      </div>
      <details>
        <summary>How this estimate was calculated</summary>
        <ul>{result.baseline.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
        <p>This comparison assumes the extra payment is affordable; it does not assess your budget.</p>
      </details>
    </section>
  );
}
