/**
 * SAFE and convertible-note conversion at a priced round.
 *
 *   Post-money SAFE (the 2018+ Y Combinator form): the investor's ownership
 *   immediately after the SAFE round is investment ÷ post-money valuation cap,
 *   diluted afterwards by the priced round like everyone else; a discount, if
 *   present, applies against the round price and the investor takes whichever
 *   is better.
 *   Convertible note: principal plus simple interest converts at the lower of
 *   the cap price and the discounted round price.
 */

import type { CapTable } from './captable.ts';
import { totalShares } from './captable.ts';

export interface Safe {
  id: string;
  investor: string;
  amount: number;
  /** Post-money valuation cap; 0 means uncapped. */
  cap: number;
  /** Discount as a fraction of the round price (0.2 = 20% discount); 0 for none. */
  discount: number;
}

export interface Note {
  id: string;
  investor: string;
  principal: number;
  /** Annual simple interest rate as a fraction. */
  interestRate: number;
  /** Months outstanding at conversion. */
  months: number;
  cap: number;
  discount: number;
}

export interface Conversion {
  id: string;
  investor: string;
  amount: number;
  /** The price per share the instrument converted at. */
  conversionPrice: number;
  shares: number;
  /** Which term set the price. */
  basis: 'cap' | 'discount' | 'round';
}

/** Price per share implied by a post-money cap: cap ÷ fully diluted shares before the priced round (SAFEs included). */
function capPrice(cap: number, preRoundShares: number): number {
  return cap / preRoundShares;
}

/**
 * Convert SAFEs at a priced round. `roundPrice` is the price per share of the
 * new round; `preRoundShares` is the fully diluted count the cap is measured
 * against. Returns conversions with shares rounded down.
 */
export function convertSafes(safes: Safe[], roundPrice: number, preRoundShares: number): Conversion[] {
  if (roundPrice <= 0 || preRoundShares <= 0) throw new Error('round price and share count must be positive');
  return safes.map((s) => {
    const candidates: Array<[number, Conversion['basis']]> = [[roundPrice, 'round']];
    if (s.cap > 0) candidates.push([capPrice(s.cap, preRoundShares), 'cap']);
    if (s.discount > 0) candidates.push([roundPrice * (1 - s.discount), 'discount']);
    const [price, basis] = candidates.reduce((best, c) => (c[0] < best[0] ? c : best));
    return { id: s.id, investor: s.investor, amount: s.amount, conversionPrice: price, shares: Math.floor(s.amount / price), basis };
  });
}

export function noteBalance(n: Note): number {
  return n.principal * (1 + n.interestRate * (n.months / 12));
}

export function convertNotes(notes: Note[], roundPrice: number, preRoundShares: number): Conversion[] {
  if (roundPrice <= 0 || preRoundShares <= 0) throw new Error('round price and share count must be positive');
  return notes.map((n) => {
    const amount = noteBalance(n);
    const candidates: Array<[number, Conversion['basis']]> = [[roundPrice, 'round']];
    if (n.cap > 0) candidates.push([capPrice(n.cap, preRoundShares), 'cap']);
    if (n.discount > 0) candidates.push([roundPrice * (1 - n.discount), 'discount']);
    const [price, basis] = candidates.reduce((best, c) => (c[0] < best[0] ? c : best));
    return { id: n.id, investor: n.investor, amount, conversionPrice: price, shares: Math.floor(amount / price), basis };
  });
}

/** Add converted instruments to a cap table as preferred holders with a 1× non-participating preference on the cash they put in. */
export function addConversions(table: CapTable, conversions: Conversion[]): CapTable {
  const holders = table.holders.map((h) => ({ ...h }));
  for (const c of conversions) {
    if (c.shares <= 0) continue;
    holders.push({ id: `conv-${c.id}`, name: c.investor, kind: 'investor', shares: c.shares, preferred: true, invested: c.amount, preferenceMultiple: 1, participating: false });
  }
  return { holders };
}

/** Effective post-round ownership of a converted instrument. */
export function conversionFraction(table: CapTable, c: Conversion): number {
  const t = totalShares(table);
  return t > 0 ? c.shares / t : 0;
}
