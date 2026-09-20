/**
 * Cap table arithmetic. Shares are integers; prices and valuations are
 * numbers in the same currency unit throughout. Every function is pure.
 */

export type HolderKind = 'founder' | 'investor' | 'pool' | 'employee';

export interface Holder {
  id: string;
  name: string;
  kind: HolderKind;
  shares: number;
  /** Preferred stock carries a liquidation preference; common does not. */
  preferred?: boolean;
  /** Amount invested, for preference calculations. */
  invested?: number;
  /** Liquidation preference multiple (1 = 1×). */
  preferenceMultiple?: number;
  /** Participating preferred takes its preference and then shares in the remainder. */
  participating?: boolean;
}

export interface CapTable {
  holders: Holder[];
}

export function totalShares(table: CapTable): number {
  return table.holders.reduce((a, h) => a + h.shares, 0);
}

/** Fully diluted ownership per holder, as fractions summing to 1. */
export function ownership(table: CapTable): Array<{ id: string; name: string; shares: number; fraction: number }> {
  const total = totalShares(table);
  return table.holders.map((h) => ({ id: h.id, name: h.name, shares: h.shares, fraction: total > 0 ? h.shares / total : 0 }));
}

export interface PricedRound {
  name: string;
  preMoney: number;
  investment: number;
  /** Option-pool top-up as a fraction of post-money fully diluted shares (0 for none). Created pre-money, so it dilutes existing holders only. */
  poolTopUp: number;
  investorName: string;
  preferenceMultiple: number;
  participating: boolean;
}

export interface RoundResult {
  table: CapTable;
  pricePerShare: number;
  newShares: number;
  poolShares: number;
  postMoney: number;
  investorFraction: number;
}

/**
 * Apply a priced round. The option pool top-up is sized so that after the
 * round it equals `poolTopUp` of the post-money fully diluted shares, and it
 * is created before pricing (the "pre-money option pool shuffle"), so the
 * price per share is pre-money ÷ (existing shares + new pool shares).
 */
export function applyPricedRound(table: CapTable, round: PricedRound): RoundResult {
  if (round.preMoney <= 0 || round.investment < 0) throw new Error('pre-money must be positive and investment non-negative');
  const existing = totalShares(table);
  if (existing <= 0) throw new Error('cap table has no shares');
  const postMoney = round.preMoney + round.investment;
  // Solve: pool / (existing + pool + newShares) = topUp, with newShares = investment / price and price = preMoney / (existing + pool).
  // Post-money shares = (existing + pool) × postMoney / preMoney, so pool = topUp × postMoney/preMoney × (existing + pool)
  // → pool = existing × k / (1 − k) where k = topUp × postMoney / preMoney.
  const k = round.poolTopUp * (postMoney / round.preMoney);
  if (k >= 1) throw new Error('pool top-up too large for this round');
  const poolShares = Math.round((existing * k) / (1 - k));
  const preRoundShares = existing + poolShares;
  const pricePerShare = round.preMoney / preRoundShares;
  const newShares = Math.round(round.investment / pricePerShare);
  const holders = table.holders.map((h) => ({ ...h }));
  if (poolShares > 0) {
    const pool = holders.find((h) => h.kind === 'pool');
    if (pool) pool.shares += poolShares;
    else holders.push({ id: `pool-${round.name}`, name: 'Option pool', kind: 'pool', shares: poolShares });
  }
  if (newShares > 0) {
    holders.push({
      id: `inv-${round.name}`, name: round.investorName, kind: 'investor', shares: newShares, preferred: true,
      invested: round.investment, preferenceMultiple: round.preferenceMultiple, participating: round.participating
    });
  }
  const post = { holders };
  return { table: post, pricePerShare, newShares, poolShares, postMoney, investorFraction: newShares / totalShares(post) };
}

export function validateHolder(h: Holder): string[] {
  const p: string[] = [];
  if (!h.name.trim()) p.push('name is required');
  if (!Number.isInteger(h.shares) || h.shares < 0) p.push('shares must be a non-negative integer');
  if (!['founder', 'investor', 'pool', 'employee'].includes(h.kind)) p.push('kind must be founder, investor, pool or employee');
  if (h.invested !== undefined && (!Number.isFinite(h.invested) || h.invested < 0)) p.push('invested must be non-negative');
  if (h.preferenceMultiple !== undefined && (!Number.isFinite(h.preferenceMultiple) || h.preferenceMultiple < 0)) p.push('preference multiple must be non-negative');
  return p;
}
