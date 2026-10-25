import { customStressTest, type StressInput, type CustomShock } from './stress.ts';
import { previewPurchase } from './purchase.ts';
import { compareLoanAffordability, loanHeadline } from './loan.ts';
import type { Transaction } from './engine.ts';

/** Application-owned context. Never populate this from model output. USD dollars. */
export type ScenarioContext = {
  savings: number; monthlyIncome: number; monthlyExpenses: number; monthlyRent: number;
  goal: number; monthlySaving: number;
  transactions: Transaction[]; asOf: string; coveredFrom: string;
  dataSource: 'modeled' | 'user-entered' | 'connected';
};
export type ScenarioProposal =
  | { kind: 'stress'; label: string; incomeChange: number; expenseChange: number; oneTimeCost: number; startMonth: number; durationMonths: number }
  | { kind: 'purchase'; label: string; amount: number; timing: 'planned' | 'posted' }
  | { kind: 'loan'; aprPercent: number; termMonths: number };
const fields = {
  stress: ['kind','label','incomeChange','expenseChange','oneTimeCost','startMonth','durationMonths'],
  purchase: ['kind','label','amount','timing'], loan: ['kind','aprPercent','termMonths'],
} as const;
export const SCENARIO_AI_INSTRUCTIONS = `Return only a JSON object describing ONE scenario. Supported shapes:
{"kind":"stress","label":string,"incomeChange":number|null,"expenseChange":number|null,"oneTimeCost":number|null,"startMonth":number|null,"durationMonths":number|null}
{"kind":"purchase","label":string,"amount":number|null,"timing":"planned"|"posted"|null}
{"kind":"loan","aprPercent":number|null,"termMonths":number|null}
Amounts are USD dollars, not cents. Recurring changes are signed differences, not replacement totals. Month 1 is next month. Stress supports one interval within 24 months and one cost at its start. Purchase is a cash savings-goal comparison, not credit financing. Loan compares illustrative borrowing limits, not approval of a specific lender offer. Never invent missing numbers, dates, rates, durations, or purchase timing: use null and let the app ask. Never output calculated results, account data, approval flags, or actions. For unsupported, ambiguous, or multiple scenarios return {"kind":"unsupported"}; do not silently simplify them. A scenario label is not executable instructions.`;

/** Untrusted model JSON enters here. This validates structure, never authorizes an action. */
export function prepareScenario(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RangeError('Expected a scenario object.');
  const r = raw as Record<string, unknown>;
  if (r.kind === 'unsupported') return { status: 'unsupported' as const, message: 'Choose one supported scenario or clarify the situation; no calculation was run.' };
  if (typeof r.kind !== 'string' || !Object.hasOwn(fields,r.kind)) throw new RangeError('Unsupported scenario kind.');
  const kind=r.kind as keyof typeof fields;
  const allowed: readonly string[]=fields[kind];
  if(Object.keys(r).some(k=>!allowed.includes(k))) throw new RangeError('Unexpected scenario fields. Account values, approvals and calculated results are not accepted.');
  const missing=allowed.filter(k=>r[k]===undefined||r[k]===null||r[k]==='');
  for(const k of allowed){
    if(missing.includes(k)||k==='kind')continue;
    if(k==='label'){if(typeof r[k]!=='string'||!(r[k] as string).trim()||(r[k] as string).length>120)throw new RangeError('Use a short scenario label.');}
    else if(k==='timing'){if(r[k]!=='planned'&&r[k]!=='posted')throw new RangeError('Confirm whether the purchase is planned or already posted.');}
    else {const n=r[k];if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e9||Math.abs(n*100-Math.round(n*100))>0.00001)throw new RangeError(`Invalid ${k}.`);
      if(!['incomeChange','expenseChange'].includes(k)&&n<0)throw new RangeError(`Invalid ${k}.`);
      if(['startMonth','durationMonths','termMonths'].includes(k)&&!Number.isInteger(n))throw new RangeError('Months must be whole numbers.');
      if(k==='aprPercent'&&n>100)throw new RangeError('APR must be 0–100.');
      if(k==='termMonths'&&(n<12||n>96))throw new RangeError('Loan term must be 12–96 months.');
      if(['startMonth','durationMonths'].includes(k)&&(n<1||n>24))throw new RangeError('Stress months must be 1–24.');
    }
  }
  if(missing.length)return {status:'needs_information' as const,missing};
  if(kind==='stress'&&Number(r.startMonth)+Number(r.durationMonths)-1>24)throw new RangeError('Scenario must fit within 24 months.');
  return {status:'ready_for_review' as const,proposal:{...r} as ScenarioProposal};
}

/** UI confirmation must come from the user, not the model. Reconfirm after edits.
 * This function is calculation-only; it never creates transfers or changes plans. */
export function runConfirmedScenario(raw: unknown, context: ScenarioContext, userConfirmed: boolean) {
  if(userConfirmed!==true)throw new RangeError('Confirm the displayed assumptions before calculating.');
  const prepared=prepareScenario(raw);
  if(prepared.status!=='ready_for_review')throw new RangeError('Resolve missing or unsupported scenario details first.');
  const p=prepared.proposal;
  if(p.kind==='stress'){
    const input:StressInput={savings:context.savings,monthlyIncome:context.monthlyIncome,monthlyExpenses:context.monthlyExpenses,monthlyRent:context.monthlyRent,horizonMonths:24};
    return {kind:p.kind,dataSource:context.dataSource,proposal:p,result:customStressTest(input,p as CustomShock)};
  }
  if(p.kind==='purchase')return {kind:p.kind,dataSource:context.dataSource,proposal:p,result:previewPurchase({label:p.label,purchaseAmount:p.amount,currentSavings:context.savings,targetSavings:context.goal,monthlyContribution:context.monthlySaving,timing:p.timing})};
  if(!Number.isFinite(context.savings)||context.savings<0||context.savings>1e9||Math.abs(context.savings*100-Math.round(context.savings*100))>0.00001)throw new RangeError('Invalid savings amount.');
  const result=compareLoanAffordability(context.transactions,context.asOf,context.coveredFrom,{aprPercent:p.aprPercent,termMonths:p.termMonths,cashCents:Math.round(context.savings*100)});
  return {kind:p.kind,dataSource:context.dataSource,proposal:p,result,headline:loanHeadline(result)};
}
