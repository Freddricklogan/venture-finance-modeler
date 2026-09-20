/** Sample company — illustrative, labelled as such on screen. */

import type { CapTable } from './captable.ts';
import type { Note, Safe } from './convertibles.ts';
import type { RunwayInputs } from './runway.ts';
import type { PricedRound } from './captable.ts';

export const SAMPLE_TABLE: CapTable = {
  holders: [
    { id: 'f1', name: 'Founder A', kind: 'founder', shares: 4_500_000 },
    { id: 'f2', name: 'Founder B', kind: 'founder', shares: 3_500_000 },
    { id: 'pool', name: 'Option pool', kind: 'pool', shares: 1_000_000 },
    { id: 'e1', name: 'Early employees', kind: 'employee', shares: 1_000_000 }
  ]
};

export const SAMPLE_SAFES: Safe[] = [
  { id: 's1', investor: 'Angel syndicate', amount: 500_000, cap: 5_000_000, discount: 0 },
  { id: 's2', investor: 'University venture fund', amount: 250_000, cap: 8_000_000, discount: 0.2 }
];

export const SAMPLE_NOTES: Note[] = [
  { id: 'n1', investor: 'Founder loan', principal: 100_000, interestRate: 0.06, months: 18, cap: 6_000_000, discount: 0.15 }
];

export const SAMPLE_ROUND: PricedRound = {
  name: 'Seed', preMoney: 12_000_000, investment: 3_000_000, poolTopUp: 0.1, investorName: 'Seed lead', preferenceMultiple: 1, participating: false
};

export const SAMPLE_RUNWAY: RunwayInputs = {
  cash: 3_000_000, monthlyBurn: 180_000, burnVolatility: 0.12, monthlyRevenue: 25_000, revenueGrowth: 0.08, growthVolatility: 0.1, horizonMonths: 36, trials: 2000, seed: 42
};

export function sample(): { table: CapTable; safes: Safe[]; notes: Note[]; round: PricedRound; runway: RunwayInputs } {
  return structuredClone({ table: SAMPLE_TABLE, safes: SAMPLE_SAFES, notes: SAMPLE_NOTES, round: SAMPLE_ROUND, runway: SAMPLE_RUNWAY });
}
