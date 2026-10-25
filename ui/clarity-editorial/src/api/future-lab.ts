import { simulatePaths, type SimulationPath } from '../lib/finance';
import type { Horizon, Shock, SimulationInputs } from '../lib/types';
import { createStressTest, type CustomShock, type StressResult } from './stress';

export type FuturePath = SimulationPath & { stress: StressResult };
/** Apply the same event to each path's own expenses, using the shared simulator. */
export function simulateFuturePaths(inputs: SimulationInputs, shock: Shock, horizon: Horizon, custom?: CustomShock): FuturePath[] {
  const paths = simulatePaths(inputs, 'none', horizon);
  const events = { none: 'baseline', 'job-loss': 'job-loss', repair: 'car-repair', 'rent-rise': 'rent-rise' } as const;
  return paths.map(path => {
    const rent = path.id === 'flexible' ? Math.max(0, inputs.rent - 300) : inputs.rent;
    const spending = path.id === 'intentional' ? Math.max(0, inputs.spending - 200) : inputs.spending;
    const start = { savings: inputs.cash, monthlyIncome: inputs.income, monthlyRent: rent,
      monthlyExpenses: Math.round((rent + inputs.transportation + spending) * 100) / 100, horizonMonths: horizon };
    const stress = createStressTest(custom ? { ...start, shock: custom } : { ...start, event: events[shock] });
    return { ...path, points: stress.stressed, finalCash: stress.stressed.at(-1)!.cash,
      minCash: Math.min(...stress.stressed.map(p => p.cash)), stress };
  });
}
