'use client';
import { useState } from 'react';
import Link from 'next/link';
import { checkIn, saveTheRaise } from '@/lib/advisor/checkins';
import '../stress-test/preview.css';
export default function Page() {
  const [approved, setApproved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [months, setMonths] = useState<{ saved: number; dining: number }[]>([]);
  const raise = saveTheRaise(3000, 3400, confirmed);
  const result = checkIn({ startingSavings: 1000, goal: 5000, monthlySaving: 200, diningBudget: 300 }, months);
  return <main className="stress-page"><Link href="/">Clarity</Link><h1>Save the raise. Keep the plan.</h1><p>Synthetic demo only. No bank connection or real transfers.</p><div className="stress-grid"><section className="stress-card"><h2>Save the raise</h2><p>Previous monthly take-home: $3,000. New monthly take-home: $3,400.</p><label><input type="checkbox" checked={confirmed} disabled={approved} onChange={e => setConfirmed(e.target.checked)} />I confirm this $400 increase is recurring.</label><p>{raise.message}</p><p>Demo proposal: add $200 a month to savings. Goal: $5,000 from $1,000, with a $300 dining budget.</p><button disabled={!confirmed || approved} onClick={() => setApproved(true)}>{approved ? 'Demo plan selected' : 'Approve demo plan'}</button><p>{raise.assumption}</p></section><section className="stress-card"><h2>Plan check-ins</h2><p>Each click adds one labeled synthetic month, not real spending. Alternate months simulate $400 saved with $420 dining, then $100 saved with $300 dining.</p><button disabled={!approved || months.length >= 24} onClick={() => setMonths([...months, months.length % 2 === 0 ? { saved: 400, dining: 420 } : { saved: 100, dining: 300 }])}>Simulate next month</button><div aria-live="polite"><p>Completed months: {months.length}</p><p>{result.message}</p><p>{result.adjustment}</p><p>{result.monthsAhead === null ? 'Goal timing unavailable.' : `${Math.abs(result.monthsAhead)} monthly steps ${result.monthsAhead >= 0 ? 'ahead of' : 'behind'} the original forecast.`}</p></div><p>{result.assumption}</p><button onClick={() => { setMonths([]); setApproved(false); setConfirmed(false); }}>Reset demo</button></section></div></main>;
}
