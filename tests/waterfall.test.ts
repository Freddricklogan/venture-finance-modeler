import { describe, it, expect } from 'vitest';
import { waterfall } from '../src/waterfall.ts';
import type { CapTable } from '../src/captable.ts';

const common: CapTable = { holders: [{ id: 'a', name: 'A', kind: 'founder', shares: 600 }, { id: 'b', name: 'B', kind: 'founder', shares: 400 }] };

describe('waterfall', () => {
  it('splits an all-common table pro rata', () => {
    const p = waterfall(common, 1_000_000);
    expect(p.map((x) => x.amount)).toEqual([600_000, 400_000]);
    expect(p.every((x) => x.route === 'common')).toBe(true);
  });
  it('non-participating preferred takes its preference at a low exit and converts at a high one', () => {
    const t: CapTable = { holders: [...common.holders, { id: 'v', name: 'VC', kind: 'investor', shares: 1000, preferred: true, invested: 1_000_000, preferenceMultiple: 1 }] };
    const low = waterfall(t, 1_500_000);
    expect(low.find((x) => x.id === 'v')!.route).toBe('preference');
    expect(low.find((x) => x.id === 'v')!.amount).toBe(1_000_000);     // 1× on 1M, better than 50% of 1.5M
    expect(low.find((x) => x.id === 'a')!.amount).toBe(300_000);
    const high = waterfall(t, 10_000_000);
    expect(high.find((x) => x.id === 'v')!.route).toBe('converted');
    expect(high.find((x) => x.id === 'v')!.amount).toBe(5_000_000);    // 50% as-converted beats 1M
  });
  it('participating preferred takes both', () => {
    const t: CapTable = { holders: [...common.holders, { id: 'v', name: 'VC', kind: 'investor', shares: 1000, preferred: true, invested: 1_000_000, preferenceMultiple: 1, participating: true }] };
    const p = waterfall(t, 3_000_000);
    const v = p.find((x) => x.id === 'v')!;
    expect(v.route).toBe('participating');
    expect(v.amount).toBe(1_000_000 + 0.5 * 2_000_000);
  });
  it('shares a preference shortfall pro rata and pays common nothing', () => {
    const t: CapTable = { holders: [...common.holders,
      { id: 'v1', name: 'V1', kind: 'investor', shares: 100, preferred: true, invested: 3_000_000, preferenceMultiple: 1 },
      { id: 'v2', name: 'V2', kind: 'investor', shares: 100, preferred: true, invested: 1_000_000, preferenceMultiple: 1 }] };
    const p = waterfall(t, 2_000_000);
    expect(p.find((x) => x.id === 'v1')!.amount).toBe(1_500_000);
    expect(p.find((x) => x.id === 'v2')!.amount).toBe(500_000);
    expect(p.find((x) => x.id === 'a')!.amount).toBe(0);
  });
  it('a 2× multiple is honoured', () => {
    const t: CapTable = { holders: [...common.holders, { id: 'v', name: 'VC', kind: 'investor', shares: 100, preferred: true, invested: 1_000_000, preferenceMultiple: 2 }] };
    expect(waterfall(t, 5_000_000).find((x) => x.id === 'v')!.amount).toBe(2_000_000);
  });
  it('fractions sum to one and edge cases are handled', () => {
    const t: CapTable = { holders: [...common.holders, { id: 'v', name: 'VC', kind: 'investor', shares: 1000, preferred: true, invested: 1_000_000 }] };
    for (const exit of [0, 500_000, 2_000_000, 50_000_000]) {
      const p = waterfall(t, exit);
      expect(p.reduce((a, x) => a + x.amount, 0)).toBeCloseTo(exit, 6);
      if (exit > 0) expect(p.reduce((a, x) => a + x.fraction, 0)).toBeCloseTo(1, 10);
    }
    expect(waterfall({ holders: [] }, 100)).toEqual([]);
    expect(() => waterfall(t, -1)).toThrow();
  });
});
