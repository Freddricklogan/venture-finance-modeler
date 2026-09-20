/**
 * Monte Carlo runway. Monthly cash = cash + revenue − burn, with revenue
 * growing at a rate drawn each month from a normal distribution and burn
 * drawn likewise. Seeded so runs are reproducible; the seed is on screen.
 */

/** mulberry32 — small, seedable, adequate for a simulation demo. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normal from a uniform source. */
export function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface RunwayInputs {
  cash: number;
  monthlyBurn: number;
  /** Standard deviation of burn as a fraction of burn (0.1 = ±10%). */
  burnVolatility: number;
  monthlyRevenue: number;
  /** Mean monthly revenue growth as a fraction. */
  revenueGrowth: number;
  /** Standard deviation of the monthly growth rate. */
  growthVolatility: number;
  horizonMonths: number;
  trials: number;
  seed: number;
}

export interface RunwayResult {
  /** Months until cash < 0 per trial; horizonMonths + 1 means survived the horizon. */
  runwayMonths: number[];
  p10: number;
  p50: number;
  p90: number;
  /** Fraction of trials still solvent at the horizon. */
  survival: number;
  /** Survival probability by month, index 0 = month 1. */
  survivalCurve: number[];
  /** Deterministic runway with no volatility, for comparison. */
  deterministic: number;
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (idx - lo);
}

export function validateRunway(i: RunwayInputs): string[] {
  const p: string[] = [];
  if (!(i.cash >= 0)) p.push('cash must be non-negative');
  if (!(i.monthlyBurn >= 0)) p.push('burn must be non-negative');
  if (!(i.monthlyRevenue >= 0)) p.push('revenue must be non-negative');
  if (!(i.burnVolatility >= 0 && i.burnVolatility <= 1)) p.push('burn volatility must be 0–1');
  if (!(i.growthVolatility >= 0 && i.growthVolatility <= 1)) p.push('growth volatility must be 0–1');
  if (!Number.isInteger(i.horizonMonths) || i.horizonMonths < 1 || i.horizonMonths > 120) p.push('horizon must be 1–120 months');
  if (!Number.isInteger(i.trials) || i.trials < 1 || i.trials > 20000) p.push('trials must be 1–20000');
  return p;
}

/** Deterministic runway: months until cash goes negative with mean inputs; horizon + 1 if it never does. */
export function deterministicRunway(i: RunwayInputs): number {
  let cash = i.cash;
  let revenue = i.monthlyRevenue;
  for (let m = 1; m <= i.horizonMonths; m += 1) {
    cash += revenue - i.monthlyBurn;
    if (cash < 0) return m;
    revenue *= 1 + i.revenueGrowth;
  }
  return i.horizonMonths + 1;
}

export function simulateRunway(i: RunwayInputs): RunwayResult {
  const problems = validateRunway(i);
  if (problems.length) throw new Error(problems.join('; '));
  const rng = mulberry32(i.seed);
  const runwayMonths: number[] = [];
  const aliveAt = new Array<number>(i.horizonMonths).fill(0);
  for (let t = 0; t < i.trials; t += 1) {
    let cash = i.cash;
    let revenue = i.monthlyRevenue;
    let dead = i.horizonMonths + 1;
    for (let m = 1; m <= i.horizonMonths; m += 1) {
      const burn = Math.max(0, i.monthlyBurn * (1 + i.burnVolatility * normal(rng)));
      cash += revenue - burn;
      if (cash < 0) { dead = m; break; }
      aliveAt[m - 1] = (aliveAt[m - 1] ?? 0) + 1;
      revenue = Math.max(0, revenue * (1 + i.revenueGrowth + i.growthVolatility * normal(rng)));
    }
    runwayMonths.push(dead);
  }
  const sorted = runwayMonths.slice().sort((a, b) => a - b);
  return {
    runwayMonths,
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    survival: runwayMonths.filter((m) => m > i.horizonMonths).length / i.trials,
    survivalCurve: aliveAt.map((n) => n / i.trials),
    deterministic: deterministicRunway(i)
  };
}
