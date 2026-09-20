/** DOM rendering — textContent and createElement only; holder names can come from an imported CSV. */

import { ownership, type CapTable } from './captable.ts';
import type { Conversion } from './convertibles.ts';
import type { RunwayResult } from './runway.ts';
import type { Payout } from './waterfall.ts';

type Props = Record<string, string | number | boolean | null | undefined>;
export function el(tag: string, props: Props = {}, kids: Array<Node | string | null | undefined> = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}
export function clear(node: Element): void { while (node.firstChild) node.removeChild(node.firstChild); }

export const fmtUsd = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`;
export const fmtPct = (v: number, dp = 1): string => `${(v * 100).toFixed(dp)}%`;
const fmtShares = (v: number): string => Math.round(v).toLocaleString('en-US');
const fmtPrice = (v: number): string => `$${v.toFixed(4)}`;

export function renderCapTable(host: HTMLElement, before: CapTable, after: CapTable, onEditShares: (id: string, shares: number) => void): void {
  clear(host);
  host.append(el('thead', {}, [el('tr', {}, ['Holder', 'Kind', 'Shares (today)', 'Ownership (today)', 'Shares (post-round)', 'Ownership (post-round)'].map((h) => el('th', { scope: 'col', text: h })))]));
  const body = el('tbody');
  const ownBefore = new Map(ownership(before).map((o) => [o.id, o]));
  const ownAfter = new Map(ownership(after).map((o) => [o.id, o]));
  for (const h of after.holders) {
    const b = ownBefore.get(h.id);
    const a = ownAfter.get(h.id)!;
    let sharesCell: HTMLElement;
    if (b) {
      const input = el('input', { type: 'number', class: 'vfm-input', value: String(b.shares), min: '0', step: '1000', 'aria-label': `${h.name} shares` }) as HTMLInputElement;
      input.addEventListener('change', () => { const v = Number(input.value); if (Number.isFinite(v)) onEditShares(h.id, v); });
      sharesCell = el('td', {}, [input]);
    } else sharesCell = el('td', { class: 'vfm-muted', text: '—' });
    body.append(el('tr', { class: b ? '' : 'is-new' }, [
      el('th', { scope: 'row', text: h.name }),
      el('td', { text: h.kind + (h.preferred ? ' · preferred' : '') }),
      sharesCell,
      el('td', { text: b ? fmtPct(b.fraction) : '—' }),
      el('td', { text: fmtShares(a.shares) }),
      el('td', { text: fmtPct(a.fraction), 'data-tone': b && a.fraction < b.fraction ? 'danger' : b ? 'muted' : 'ok' })
    ]));
  }
  host.append(body);
}

export function renderConversions(host: HTMLElement, conversions: Conversion[], roundPrice: number): void {
  clear(host);
  host.append(el('thead', {}, [el('tr', {}, ['Instrument', 'Investor', 'Converts', 'Price', 'Basis', 'Shares', 'Effective discount to round'].map((h) => el('th', { scope: 'col', text: h })))]));
  const body = el('tbody');
  for (const c of conversions) {
    body.append(el('tr', {}, [
      el('td', { text: c.id }), el('td', { text: c.investor }), el('td', { text: fmtUsd(c.amount) }),
      el('td', { text: fmtPrice(c.conversionPrice) }), el('td', {}, [el('span', { class: 'vfm-chip', 'data-basis': c.basis, text: c.basis })]),
      el('td', { text: fmtShares(c.shares) }), el('td', { text: fmtPct(1 - c.conversionPrice / roundPrice) })
    ]));
  }
  host.append(body);
}

export function renderWaterfall(host: HTMLElement, payouts: Payout[]): void {
  clear(host);
  host.append(el('thead', {}, [el('tr', {}, ['Holder', 'Route', 'Proceeds', 'Share of exit'].map((h) => el('th', { scope: 'col', text: h })))]));
  const body = el('tbody');
  for (const p of payouts) {
    body.append(el('tr', {}, [
      el('th', { scope: 'row', text: p.name }),
      el('td', {}, [el('span', { class: 'vfm-chip', 'data-route': p.route, text: p.route })]),
      el('td', { text: fmtUsd(p.amount) }),
      el('td', {}, [el('span', { class: 'vfm-bar' }, [(() => { const f = el('span', { class: 'vfm-bar__fill' }); f.style.setProperty('--w', `${Math.min(100, p.fraction * 100)}%`); return f; })()]), ` ${fmtPct(p.fraction)}`])
    ]));
  }
  host.append(body);
}

export function renderRunway(host: HTMLElement, chart: HTMLElement, r: RunwayResult, horizon: number): void {
  clear(host);
  clear(chart);
  const rows: Array<[string, string, string?]> = [
    ['Deterministic runway', r.deterministic > horizon ? `> ${horizon} months` : `${r.deterministic} months`, 'mean inputs, no volatility'],
    ['P10 (pessimistic)', r.p10 > horizon ? `> ${horizon} months` : `${r.p10.toFixed(1)} months`],
    ['P50 (median)', r.p50 > horizon ? `> ${horizon} months` : `${r.p50.toFixed(1)} months`],
    ['P90 (optimistic)', r.p90 > horizon ? `> ${horizon} months` : `${r.p90.toFixed(1)} months`],
    ['Survive the horizon', fmtPct(r.survival), `${r.runwayMonths.length.toLocaleString('en-US')} trials`]
  ];
  for (const [k, v, note] of rows) host.append(el('div', { class: 'vfm-kv' }, [el('dt', {}, [el('span', { text: k }), note ? el('span', { class: 'vfm-note', text: note }) : null]), el('dd', { text: v })]));
  const ns = 'http://www.w3.org/2000/svg';
  const W = 520; const H = 180; const pad = 28;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'vfm-chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Survival curve: probability of still having cash by month, ${fmtPct(r.survival)} at month ${horizon}`);
  const pts = r.survivalCurve.map((s, i) => `${pad + (i / Math.max(1, horizon - 1)) * (W - 2 * pad)},${H - pad - s * (H - 2 * pad)}`).join(' ');
  const axis = document.createElementNS(ns, 'path'); axis.setAttribute('d', `M${pad},${pad} L${pad},${H - pad} L${W - pad},${H - pad}`); axis.setAttribute('class', 'vfm-axis'); svg.append(axis);
  const line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', pts); line.setAttribute('class', 'vfm-line'); svg.append(line);
  const lab = (x: number, y: number, t: string, cls: string): void => { const e = document.createElementNS(ns, 'text'); e.setAttribute('x', String(x)); e.setAttribute('y', String(y)); e.setAttribute('class', cls); e.textContent = t; svg.append(e); };
  lab(pad - 4, pad + 4, '100%', 'vfm-tick vfm-tick--r'); lab(pad - 4, H - pad + 4, '0%', 'vfm-tick vfm-tick--r'); lab(W - pad, H - pad + 14, `month ${horizon}`, 'vfm-tick vfm-tick--r'); lab(pad, H - pad + 14, 'month 1', 'vfm-tick');
  chart.append(svg);
}
