export type Transaction = { id: string; date: string; amount: number; merchant: string; category: string };
export type Snapshot = { date: string; balance: number };
export type Moment = 'new-job' | 'moving' | 'overspending' | 'student-loan' | 'idle-cash' | 'higher-housing' | 'moving-costs' | 'income-increase';
export type Nudge = { id: string; kind: Moment; title: string; message: string; evidence: string; amount: number };
const month = (date: string) => date.slice(0, 7);
const money = (n: number) => n.toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0});
/** Positive amounts are income; negative amounts are outflows. Current month is compared with full prior monthly totals, so an early alert requires already crossing the threshold. */
export function detect(transactions: Transaction[], snapshots: Snapshot[], asOf: string): Nudge[] {
  const rows = transactions.filter(t => t.date <= asOf).sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const current = month(asOf);
  const recent = rows.filter(t => month(t.date) === current);
  const before = rows.filter(t => month(t.date) < current);
  const results: Nudge[] = [];
  const add = (kind: Moment, t: Transaction, title: string, message: string, evidence: string) => results.push({id:`${kind}:${t.id}`, kind,title,message,evidence,amount:Math.abs(t.amount)});
  const pay = before.filter(t => t.category === 'payroll' && t.amount > 0);
  const lastPay = pay.at(-1);
  const newPay = recent.find(t => t.category === 'payroll' && t.amount > (lastPay?.amount ?? Infinity) && !pay.some(p => p.merchant.toLowerCase() === t.merchant.toLowerCase()));
  if (newPay && lastPay) add('new-job',newPay,'A new chapter?','Looks like you may have started a new job. Want to plan your first paycheck? Takes 3 minutes.',`${newPay.merchant} paid ${money(newPay.amount)}, compared with ${money(lastPay.amount)} from ${lastPay.merchant}.`);
  const rent = recent.find(t => t.category === 'housing' && t.amount <= -1500 && !before.some(p => p.category === 'housing' && p.merchant === t.merchant));
  if(rent) add('moving',rent,'Making a move?','A new housing payment showed up. Let’s check your moving costs and monthly budget.',`${money(-rent.amount)} paid to ${rent.merchant}; no earlier payments to this housing merchant.`);
  const totals = new Map<string, number>();
  for(const t of before) if(t.amount < 0 && t.category !== 'transfer') totals.set(month(t.date),(totals.get(month(t.date)) ?? 0)-t.amount);
  const baseline = [...totals.entries()].sort().slice(-3);
  const avg = baseline.reduce((sum,[,n]) => sum+n,0)/baseline.length;
  const spent = recent.filter(t => t.amount < 0 && t.category !== 'transfer').reduce((s,t) => s-t.amount,0);
  if(baseline.length === 3 && spent >= avg*1.4 && avg > 0) results.push({id:`overspending:${current}`,kind:'overspending',title:'Your spending shifted',message:'Spending is above your usual level. See what changed and make a quick reset.',evidence:`${money(spent)} so far versus a ${money(avg)} average across the previous 3 active months (${Math.round((spent/avg-1)*100)}% higher).`,amount:Math.round(spent-avg)});
  const loan = recent.find(t => t.category === 'student_loan' && t.amount < 0);
  if(loan && !before.some(t => t.category === 'student_loan' && t.amount < 0)) add('student-loan',loan,'Repayment looks underway','Your first student loan payment appeared. Let’s weigh loan payments against saving.',`${money(-loan.amount)} paid to ${loan.merchant}; no earlier student loan payments in this history.`);
  const balances = [...new Map(snapshots.filter(s=>s.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)).map(s=>[month(s.date),s])).values()].slice(-4);
  if(balances.length === 4 && balances.every((s,i)=>!i || s.balance > balances[i-1].balance)) results.push({id:`idle-cash:${balances.at(-1)!.date}`,kind:'idle-cash',title:'Your cushion is growing',message:'Your balance has grown for several months. Explore an interest-earning savings account.',evidence:`Four monthly balances rose from ${money(balances[0].balance)} to ${money(balances[3].balance)}. Confirm upcoming bills before moving cash.`,amount:balances[3].balance});
  return results;
}
/** Additional review prompts from the same history; they can overlap a life event. */
export function detectAdditionalMoments(transactions: Transaction[], asOf: string): Nudge[] {
  const rows = transactions.filter(t => t.date <= asOf).sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const recent = rows.filter(t => month(t.date) === month(asOf));
  const before = rows.filter(t => month(t.date) < month(asOf));
  const results: Nudge[] = [];
  const oldHousing = before.filter(t => t.category === 'housing' && t.amount < 0).at(-1);
  const housing = recent.find(t => t.category === 'housing' && t.amount < 0 && oldHousing && t.amount < oldHousing.amount);
  if (housing && oldHousing) results.push({ id: `higher-housing:${housing.id}`, kind: 'higher-housing', title: 'More room for housing?', message: 'A housing payment is higher than the last observed one. Check whether it includes a deposit before adjusting your monthly budget.', evidence: `${money(-housing.amount)} paid to ${housing.merchant}, compared with ${money(-oldHousing.amount)} for the last housing payment. This may include one-time costs.`, amount: oldHousing.amount - housing.amount });
  const moving = recent.filter(t => t.category === 'moving' && t.amount < 0);
  if (moving.length) {
    const total = moving.reduce((sum,t) => sum - t.amount, 0);
    results.push({ id: `moving-costs:${month(asOf)}`, kind: 'moving-costs', title: 'The costs around a move', message: 'Moving-category outflows appeared. Review these alongside deposits, utility setup, and any overlapping rent.', evidence: `${money(total)} across ${moving.length} moving-category payment(s) this month, including ${moving[0].merchant}. Categories do not confirm a move.`, amount: total });
  }
  const oldPay = before.filter(t => t.category === 'payroll' && t.amount > 0).at(-1);
  const pay = recent.find(t => t.category === 'payroll' && oldPay && t.amount > oldPay.amount);
  if (pay && oldPay) results.push({ id: `income-increase:${pay.id}`, kind: 'income-increase', title: 'A larger paycheck to plan', message: 'A payroll deposit increased. Confirm the pay period and whether it is recurring before changing your saving or spending.', evidence: `${money(pay.amount)} from ${pay.merchant}, versus the last observed payroll deposit of ${money(oldPay.amount)}. A bonus or different pay period could explain the difference.`, amount: pay.amount - oldPay.amount });
  return results;
}

export function plan(kind: Moment, income: number, expenses: number, cash: number, apr: number) {
  if (![income,expenses,cash,apr].every(Number.isFinite) || Math.min(income,expenses,cash,apr)<0 || apr>100) throw new Error('Enter valid non-negative numbers; rate must be 0–100.');
  const surplus = Math.max(0,income-expenses);
  const gap = Math.max(0,expenses*3-cash);
  const monthly = Math.round(Math.min(surplus, gap || surplus)*0.5);
  const details: Record<Moment,string> = {
    'higher-housing': 'Check whether the higher payment includes a deposit, arrears, or utilities. Use confirmed recurring housing costs in monthly expenses and keep one-time costs separate.',
    'moving-costs': 'List movers, deposits, setup fees, and overlapping rent. Account for these costs before reviewing any savings proposal; do not treat them as permanent monthly expenses unless they recur.',
    'income-increase': 'Confirm the deposit covers the same pay period and excludes a one-time bonus. Once recurring take-home pay is clear, review how much of the increase could support your goals.',
    'new-job':"Confirm whether this deposit is a recurring paycheck or a one-time bonus. Review your employer's 401(k) match and eligibility before choosing contributions; this estimate uses take-home pay.",
    moving:'Include deposits, movers, utilities and overlapping rent in expenses. Keep money for upcoming bills accessible before starting a transfer.',
    overspending:"Separate one-time costs from recurring spending. Pick one flexible category to reduce and review your next month's actual spending.",
    'student-loan':'Include the required loan payment in expenses. Compare your actual loan APR, repayment benefits and savings yield before making extra payments; this estimate does not rank investing against debt.',
    'idle-cash':'Keep upcoming expenses and an emergency cushion accessible. Compare APY, fees, withdrawal access and deposit insurance before choosing savings.',
  };
  return {surplus, gap, monthly, interest:Math.round(cash*apr/100), explanation:details[kind], action:monthly>0?`Review a ${money(monthly)} monthly savings transfer`:'Review expenses before scheduling a savings transfer'};
}

export type PurchaseSignal = {
  id: string;
  transactionId: string;
  merchant: string;
  amount: number;
  date: string;
  message: string;
  evidence: string;
};

/** Dollar amounts, like Transaction. Signals invite review; they do not infer
 * which account paid or whether a savings balance already includes the outflow. */
export function detectLargePurchases(
  transactions: Transaction[], asOf: string, threshold = 500,
  categories = ['shopping', 'electronics', 'retail', 'entertainment', 'travel'],
): PurchaseSignal[] {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(asOf) || !Number.isFinite(threshold) || threshold <= 0) throw new RangeError('Provide a valid as-of date and positive purchase threshold.');
  const seen = new Set<string>();
  return [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .filter(t => {
      if (seen.has(t.id) || !validDate(t.date) || t.date > asOf || month(t.date) !== month(asOf) || !Number.isFinite(t.amount) || t.amount > -threshold || !categories.includes(t.category) || t.category === 'transfer') return false;
      seen.add(t.id);
      return true;
    }).map(t => ({ id: `purchase:${t.id}`, transactionId: t.id, merchant: t.merchant,
      amount: -t.amount, date: t.date,
      message: `See how this purchase at ${t.merchant} could affect your savings goal.`,
      evidence: `${money(-t.amount)} outflow on ${t.date}, categorized as ${t.category}; meets your ${money(threshold)} preview threshold.` }));
}
