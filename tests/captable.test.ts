import { describe, it, expect } from 'vitest';
import { applyPricedRound, ownership, totalShares, validateHolder, type CapTable } from '../src/captable.ts';
import { sample } from '../src/model.ts';

const { table, round } = sample();

describe('ownership', () => {
  it('sums to one over fully diluted shares', () => {
    expect(totalShares(table)).toBe(10_000_000);
    const o = ownership(table);
    expect(o.reduce((a, x) => a + x.fraction, 0)).toBeCloseTo(1, 10);
    expect(o.find((x) => x.id === 'f1')!.fraction).toBe(0.45);
  });
  it('handles an empty table', () => {
    expect(ownership({ holders: [] })).toEqual([]);
  });
});

describe('applyPricedRound', () => {
  it('prices the round off pre-money and existing shares when there is no pool top-up', () => {
    const r = applyPricedRound(table, { ...round, poolTopUp: 0 });
    expect(r.poolShares).toBe(0);
    expect(r.pricePerShare).toBeCloseTo(1.2, 10);            // 12M / 10M
    expect(r.newShares).toBe(2_500_000);                      // 3M / 1.2
    expect(r.investorFraction).toBeCloseTo(3 / 15, 6);        // 3M of 15M post
    expect(r.postMoney).toBe(15_000_000);
  });
  it('sizes a pre-money pool top-up so it equals the target fraction post-money', () => {
    const r = applyPricedRound(table, round); // 10% post-money pool top-up
    const post = totalShares(r.table);
    const poolTotal = r.table.holders.find((h) => h.kind === 'pool')!.shares;
    const topUp = poolTotal - 1_000_000;
    expect(topUp / post).toBeCloseTo(0.1, 3);
    expect(r.investorFraction).toBeCloseTo(0.2, 3);           // investment / post-money holds regardless of the pool
    expect(r.pricePerShare).toBeLessThan(1.2);                // pool shuffle lowers the price
  });
  it('creates a pool holder when none exists and records the investor as preferred', () => {
    const noPool: CapTable = { holders: table.holders.filter((h) => h.kind !== 'pool') };
    const r = applyPricedRound(noPool, round);
    expect(r.table.holders.some((h) => h.kind === 'pool')).toBe(true);
    const inv = r.table.holders.find((h) => h.name === 'Seed lead')!;
    expect(inv.preferred).toBe(true);
    expect(inv.invested).toBe(3_000_000);
  });
  it('rejects bad inputs', () => {
    expect(() => applyPricedRound(table, { ...round, preMoney: 0 })).toThrow();
    expect(() => applyPricedRound({ holders: [] }, round)).toThrow();
    expect(() => applyPricedRound(table, { ...round, poolTopUp: 0.9 })).toThrow(/too large/);
  });
  it('does not mutate the input table', () => {
    applyPricedRound(table, round);
    expect(totalShares(table)).toBe(10_000_000);
  });
});

describe('validateHolder', () => {
  it('reports every problem', () => {
    expect(validateHolder({ id: 'x', name: ' ', kind: 'alien' as never, shares: 1.5, invested: -1, preferenceMultiple: -2 })).toHaveLength(5);
    expect(validateHolder(table.holders[0]!)).toEqual([]);
  });
});
