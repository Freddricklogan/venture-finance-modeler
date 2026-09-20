import { describe, it, expect } from 'vitest';
import { addConversions, conversionFraction, convertNotes, convertSafes, noteBalance } from '../src/convertibles.ts';
import { sample } from '../src/model.ts';

const { table, safes, notes } = sample();
const preRoundShares = 10_000_000;

describe('convertSafes', () => {
  it('a post-money SAFE converts at cap ÷ pre-round shares when the cap is lower than the round', () => {
    const [angel] = convertSafes([safes[0]!], 1.2, preRoundShares);
    expect(angel!.basis).toBe('cap');
    expect(angel!.conversionPrice).toBeCloseTo(0.5, 10);     // 5M cap / 10M shares
    expect(angel!.shares).toBe(1_000_000);                   // 500k / 0.5
  });
  it('takes the better of cap and discount', () => {
    const [uvf] = convertSafes([safes[1]!], 1.2, preRoundShares);
    // cap price 0.8, discount price 0.96 → cap wins
    expect(uvf!.basis).toBe('cap');
    expect(uvf!.conversionPrice).toBeCloseTo(0.8, 10);
    const [d] = convertSafes([{ ...safes[1]!, cap: 20_000_000 }], 1.2, preRoundShares);
    expect(d!.basis).toBe('discount');
    expect(d!.conversionPrice).toBeCloseTo(0.96, 10);
  });
  it('an uncapped, undiscounted SAFE converts at the round price', () => {
    const [c] = convertSafes([{ id: 'x', investor: 'x', amount: 120_000, cap: 0, discount: 0 }], 1.2, preRoundShares);
    expect(c!.basis).toBe('round');
    expect(c!.shares).toBe(100_000);
  });
  it('rejects bad inputs', () => {
    expect(() => convertSafes(safes, 0, preRoundShares)).toThrow();
  });
});

describe('convertNotes', () => {
  it('accrues simple interest and converts at the lower of cap and discount', () => {
    expect(noteBalance(notes[0]!)).toBeCloseTo(109_000, 6);      // 100k × (1 + 0.06 × 1.5)
    const [n] = convertNotes(notes, 1.2, preRoundShares);
    // cap price 0.6, discount price 1.02 → cap
    expect(n!.basis).toBe('cap');
    expect(n!.shares).toBe(Math.floor(109_000 / 0.6));
    expect(() => convertNotes(notes, 1.2, 0)).toThrow();
  });
});

describe('addConversions', () => {
  it('adds preferred holders and reports their fraction', () => {
    const conv = convertSafes(safes, 1.2, preRoundShares);
    const t = addConversions(table, conv);
    expect(t.holders).toHaveLength(table.holders.length + 2);
    expect(t.holders.at(-1)!.preferred).toBe(true);
    expect(conversionFraction(t, conv[0]!)).toBeCloseTo(1_000_000 / (10_000_000 + 1_000_000 + 312_500), 6);
    expect(addConversions(table, [{ ...conv[0]!, shares: 0 }]).holders).toHaveLength(table.holders.length);
    expect(conversionFraction({ holders: [] }, conv[0]!)).toBe(0);
  });
});
