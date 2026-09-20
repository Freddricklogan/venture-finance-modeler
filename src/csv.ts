/** Cap-table CSV import/export with row-level validation. */

import { csvField, parseCsv } from './csv-core.ts';
import { validateHolder, type CapTable, type Holder, type HolderKind } from './captable.ts';

export const COLUMNS = ['id', 'name', 'kind', 'shares', 'preferred', 'invested', 'preference_multiple', 'participating'] as const;

export function toCsv(table: CapTable): string {
  const lines = [COLUMNS.join(',')];
  for (const h of table.holders) {
    lines.push([h.id, h.name, h.kind, h.shares, h.preferred ? 'yes' : 'no', h.invested ?? '', h.preferenceMultiple ?? '', h.participating ? 'yes' : 'no'].map(csvField).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

const yes = (s: string | undefined): boolean => /^(yes|true|1)$/i.test((s ?? '').trim());

export function importCapTable(text: string): { table: CapTable; warnings: string[] } {
  const { headers, rows, warnings } = parseCsv(text);
  const required = ['name', 'kind', 'shares'];
  const missing = required.filter((c) => !headers.includes(c));
  if (headers.length && missing.length) return { table: { holders: [] }, warnings: [`Missing required column(s): ${missing.join(', ')}.`] };
  const holders: Holder[] = [];
  const seen = new Set<string>();
  rows.forEach((r, idx) => {
    const h: Holder = {
      id: (r['id'] ?? '').trim().slice(0, 40) || `row-${idx + 1}`,
      name: (r['name'] ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      kind: (r['kind'] ?? '').trim().toLowerCase() as HolderKind,
      shares: Number(r['shares'])
    };
    if (yes(r['preferred'])) h.preferred = true;
    if ((r['invested'] ?? '') !== '') h.invested = Number(r['invested']);
    if ((r['preference_multiple'] ?? '') !== '') h.preferenceMultiple = Number(r['preference_multiple']);
    if (h.preferred) h.participating = yes(r['participating']);
    const problems = validateHolder(h);
    if (seen.has(h.id)) problems.push(`duplicate id "${h.id}"`);
    if (problems.length) { warnings.push(`Row ${idx + 2}: ${problems.join('; ')}; skipped.`); return; }
    seen.add(h.id);
    holders.push(h);
  });
  return { table: { holders }, warnings };
}
