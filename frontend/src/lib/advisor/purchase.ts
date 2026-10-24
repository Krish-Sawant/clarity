import { project } from '../sim/project.ts';
import type { Option } from '../sim/types.ts';

export type PurchaseImpactInput = {
  label: string;
  purchaseAmount: number;
  currentSavings: number;
  targetSavings: number;
  monthlyContribution: number;
  timing: 'planned' | 'posted';
  horizonMonths?: number;
};

/** USD dollars, not cents. Fixed contributions, zero interest, immediate cash
 * purchase. Posted means currentSavings ALREADY includes this purchase. */
export function previewPurchase(input: PurchaseImpactInput) {
  const { purchaseAmount, currentSavings, targetSavings, monthlyContribution, timing } = input;
  const horizonMonths = input.horizonMonths ?? 120;
  for (const value of [purchaseAmount, currentSavings, targetSavings, monthlyContribution]) {
    if (!Number.isFinite(value) || value < 0 || value > 1e9 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new RangeError('Amounts must be non-negative dollar values with at most two decimal places, up to $1 billion.');
  }
  if (targetSavings <= 0 || !input.label.trim() || !['planned', 'posted'].includes(timing) || !Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 1200) throw new RangeError('Provide a purchase label, positive goal, valid timing, and 1–1200 month horizon.');
  const dollars = (n: number) => Math.round(n * 100) / 100;
  const baselineCash = dollars(currentSavings + (timing === 'posted' ? purchaseAmount : 0));
  const base: Option = { label: 'Without purchase', startingCash: baselineCash,
    income: [{ name: 'Goal contribution', monthly: monthlyContribution }], recurring: [], oneTime: [], debts: [], assets: [] };
  const baseline = project(base, horizonMonths);
  const purchased = project({ ...base, label: 'With purchase', oneTime: [{ name: input.label.trim(), amount: purchaseAmount, month: 0 }] }, horizonMonths);
  // Use the caller's actual goal and include month zero. The generic simulator's
  // emergency target is 3x recurring costs, which is not this dedicated account.
  const reaches = (points: typeof baseline.points) => points.find(p => dollars(p.cash) >= targetSavings)?.month ?? null;
  const baselineMonths = reaches(baseline.points);
  const purchaseMonths = reaches(purchased.points);
  const delayMonths = baselineMonths !== null && purchaseMonths !== null ? purchaseMonths - baselineMonths : null;
  const status = baselineMonths === null ? 'baseline_unreached' : purchaseMonths === null ? 'purchase_unreached' : delayMonths! > 0 ? 'delayed' : 'unchanged';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(purchaseAmount);
  const description = `${amount} ${input.label.trim()}`;
  const message = status === 'delayed'
    ? `${description} ${timing === 'posted' ? 'moves' : 'would move'} your savings goal ${delayMonths} month${delayMonths === 1 ? '' : 's'} later in this projection.`
    : status === 'unchanged' ? `${description} does not change the month your goal is reached in this projection.`
    : status === 'purchase_unreached' ? `With ${description}, your goal is not reached within ${horizonMonths} months; without it, the goal is reached in month ${baselineMonths}.`
    : `Your goal is not reached within ${horizonMonths} months in either scenario. A goal delay is unavailable.`;
  return { status, message, baselineMonths, purchaseMonths, delayMonths,
    targetSavings, horizonMonths, baseline, purchased,
    shortfallAmount: dollars(Math.max(0, -purchased.points[0].cash)),
    remainingAfterPurchase: dollars(purchased.points[0].cash),
    assumptions: ['One immediate purchase funded from this savings account; no credit, fees, or borrowing modeled.',
      'Fixed month-end savings contributions, zero interest, and no other withdrawals.',
      'Goal timing uses monthly steps; no exact week or day forecast.',
      timing === 'posted' ? 'Current savings already includes the purchase. The without-purchase comparison adds it back once.' : 'Current savings is before the purchase. The purchase is subtracted once.'] };
}
