import { describe, it, expect } from 'vitest';
import { deterministicRunway, mulberry32, normal, percentile, simulateRunway, validateRunway } from '../src/runway.ts';
import { sample } from '../src/model.ts';

const base = sample().runway;

describe('random sources', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(7); const b = mulberry32(7);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('normal has roughly zero mean and unit variance', () => {
    const rng = mulberry32(1);
    const xs = Array.from({ length: 20000 }, () => normal(rng));
    const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
    const varr = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(varr - 1)).toBeLessThan(0.05);
  });
  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe('runway', () => {
  it('deterministic runway matches hand arithmetic', () => {
    expect(deterministicRunway({ ...base, cash: 1_000_000, monthlyBurn: 300_000, monthlyRevenue: 0, revenueGrowth: 0 })).toBe(4);
    expect(deterministicRunway({ ...base, cash: 1_000_000, monthlyBurn: 10_000, monthlyRevenue: 20_000 })).toBe(base.horizonMonths + 1);
  });
  it('is reproducible for a seed and different across seeds', () => {
    const a = simulateRunway({ ...base, trials: 300 });
    const b = simulateRunway({ ...base, trials: 300 });
    expect(a.runwayMonths).toEqual(b.runwayMonths);
    expect(simulateRunway({ ...base, trials: 300, seed: 43 }).p50).not.toBe(a.p50 - 100);
  });
  it('with zero volatility every trial equals the deterministic runway', () => {
    const r = simulateRunway({ ...base, burnVolatility: 0, growthVolatility: 0, trials: 50 });
    expect(new Set(r.runwayMonths).size).toBe(1);
    expect(r.p50).toBe(r.deterministic);
  });
  it('percentiles are ordered and the survival curve is monotone', () => {
    const r = simulateRunway({ ...base, trials: 500 });
    expect(r.p10).toBeLessThanOrEqual(r.p50);
    expect(r.p50).toBeLessThanOrEqual(r.p90);
    for (let i = 1; i < r.survivalCurve.length; i += 1) expect(r.survivalCurve[i]!).toBeLessThanOrEqual(r.survivalCurve[i - 1]!);
    expect(r.survival).toBeCloseTo(r.survivalCurve.at(-1)!, 10);
  });
  it('validates inputs', () => {
    expect(validateRunway(base)).toEqual([]);
    expect(validateRunway({ ...base, cash: -1, burnVolatility: 2, horizonMonths: 0, trials: 0 })).toHaveLength(4);
    expect(() => simulateRunway({ ...base, trials: 0 })).toThrow();
  });
});
