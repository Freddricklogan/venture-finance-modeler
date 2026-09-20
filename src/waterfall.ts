/**
 * Exit waterfall. Preferred holders take their liquidation preference first
 * (pari passu, pro rata to preference amount if the exit cannot cover it);
 * non-participating preferred converts to common when conversion pays more;
 * participating preferred keeps its preference and shares in the remainder.
 * Common and the option pool (treated as exercised) share what is left.
 */

import type { CapTable, Holder } from './captable.ts';

export interface Payout { id: string; name: string; amount: number; fraction: number; route: 'preference' | 'participating' | 'converted' | 'common' }

const preferenceOf = (h: Holder): number => (h.preferred ? (h.invested ?? 0) * (h.preferenceMultiple ?? 1) : 0);

/** Payout to every holder given a set of non-participating preferred holders that convert. */
function payoutsGiven(holders: Holder[], exitValue: number, converting: Set<string>): Map<string, number> {
  const takesPref = (h: Holder): boolean => Boolean(h.preferred) && !converting.has(h.id);
  const shares = (h: Holder): boolean => !h.preferred || converting.has(h.id) || Boolean(h.participating);
  const prefTotal = holders.filter(takesPref).reduce((a, h) => a + preferenceOf(h), 0);
  const paidPref = Math.min(exitValue, prefTotal);
  const remainder = exitValue - paidPref;
  const sharingShares = holders.filter(shares).reduce((a, h) => a + h.shares, 0);
  const out = new Map<string, number>();
  for (const h of holders) {
    let amount = 0;
    if (takesPref(h) && prefTotal > 0) amount += (preferenceOf(h) / prefTotal) * paidPref;
    if (shares(h) && sharingShares > 0) amount += (h.shares / sharingShares) * remainder;
    out.set(h.id, amount);
  }
  return out;
}

export function waterfall(table: CapTable, exitValue: number): Payout[] {
  if (exitValue < 0) throw new Error('exit value must be non-negative');
  const holders = table.holders;
  if (holders.reduce((a, h) => a + h.shares, 0) <= 0) return [];
  const candidates = holders.filter((h) => h.preferred && !h.participating);

  // Fixed point: each non-participating preferred holder converts iff, given
  // everyone else's current choice, converting pays more than its preference.
  let converting = new Set<string>();
  for (let iter = 0; iter < 20; iter += 1) {
    const next = new Set<string>();
    for (const h of candidates) {
      const withH = new Set(converting); withH.add(h.id);
      const withoutH = new Set(converting); withoutH.delete(h.id);
      const ifConvert = payoutsGiven(holders, exitValue, withH).get(h.id) ?? 0;
      const ifPref = payoutsGiven(holders, exitValue, withoutH).get(h.id) ?? 0;
      if (ifConvert > ifPref) next.add(h.id);
    }
    const same = next.size === converting.size && [...next].every((id) => converting.has(id));
    converting = next;
    if (same) break;
  }

  const amounts = payoutsGiven(holders, exitValue, converting);
  return holders.map((h) => {
    const amount = amounts.get(h.id) ?? 0;
    const route: Payout['route'] = !h.preferred ? 'common' : h.participating ? 'participating' : converting.has(h.id) ? 'converted' : 'preference';
    return { id: h.id, name: h.name, amount, fraction: exitValue > 0 ? amount / exitValue : 0, route };
  });
}
