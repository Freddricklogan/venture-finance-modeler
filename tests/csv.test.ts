import { describe, it, expect } from 'vitest';
import { importCapTable, toCsv } from '../src/csv.ts';
import { sample } from '../src/model.ts';
import { applyPricedRound } from '../src/captable.ts';

describe('cap-table CSV', () => {
  it('round-trips a table with preferred holders', () => {
    const { table, round } = sample();
    const post = applyPricedRound(table, round).table;
    const back = importCapTable(toCsv(post));
    expect(back.warnings).toEqual([]);
    expect(back.table).toEqual(post);
  });
  it('requires name, kind and shares; validates rows; rejects duplicates', () => {
    expect(importCapTable('id,name\n1,x\n').warnings[0]).toMatch(/Missing required/);
    const r = importCapTable('id,name,kind,shares,preferred,invested\na,Good,founder,100,,\na,Dup,founder,100,,\nb,Bad,alien,1.5,yes,-5\n');
    expect(r.table.holders.map((h) => h.id)).toEqual(['a']);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[1]).toMatch(/kind must be/);
  });
});

import { csvField, parseCsv } from '../src/csv-core.ts';

describe('csv-core', () => {
  it('parses quotes, doubled quotes, newlines, CRLF, BOM; reports ragged/empty/unterminated', () => {
    expect(parseCsv('﻿A,B\r\n"x, ""y""","l1\nl2"\r\n').rows).toEqual([{ a: 'x, "y"', b: 'l1\nl2' }]);
    expect(parseCsv('a,b\n1\n').warnings[0]).toMatch(/Row 2/);
    expect(parseCsv('').warnings).toEqual(['File is empty.']);
    expect(parseCsv('a\n"x').warnings[0]).toMatch(/Unterminated/);
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField(null)).toBe('');
  });
});
