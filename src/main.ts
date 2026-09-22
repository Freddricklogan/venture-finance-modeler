/** Entry point: working model, wiring, Executive Shell. */

import './shell/exec-shell.css';
import './app.css';
import { mountExecShell } from './shell/exec-shell.js';
import { applyPricedRound, totalShares, type CapTable, type PricedRound } from './captable.ts';
import { addConversions, convertNotes, convertSafes, type Conversion, type Note, type Safe } from './convertibles.ts';
import { waterfall } from './waterfall.ts';
import { simulateRunway, validateRunway, type RunwayInputs, type RunwayResult } from './runway.ts';
import { sample } from './model.ts';
import { importCapTable, toCsv } from './csv.ts';
import { fmtPct, fmtUsd, renderCapTable, renderConversions, renderRunway, renderWaterfall } from './ui.ts';

const REPO = 'https://github.com/Freddricklogan/venture-finance-modeler';
const PAGES = 'https://freddricklogan.github.io/venture-finance-modeler/';
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => { const n = document.getElementById(id); if (!n) throw new Error(`Missing #${id}`); return n as T; };

interface State { table: CapTable; safes: Safe[]; notes: Note[]; round: PricedRound; runway: RunwayInputs; exitValue: number; post: CapTable; conversions: Conversion[]; roundPrice: number; runwayResult: RunwayResult | null }
const s0 = sample();
const state: State = { ...s0, exitValue: 40_000_000, post: s0.table, conversions: [], roundPrice: 0, runwayResult: null };

function setStatus(text: string, tone: 'ok' | 'warn' | 'danger' | 'muted' = 'muted'): void { const s = $('status'); s.textContent = text; s.dataset['tone'] = tone; }

/** SAFEs and notes convert first against the pre-round fully diluted count, then the priced round applies to the enlarged table. */
function recompute(): void {
  const preShares = totalShares(state.table);
  // Round price is set by the priced round on the post-conversion table; iterate once: price the round on the table
  // as it stands, convert, then re-price on the converted table (the standard "SAFEs convert before the round" order).
  const provisional = applyPricedRound(state.table, state.round).pricePerShare;
  const conv = [...convertSafes(state.safes, provisional, preShares), ...convertNotes(state.notes, provisional, preShares)];
  const converted = addConversions(state.table, conv);
  const result = applyPricedRound(converted, state.round);
  state.conversions = conv;
  state.roundPrice = result.pricePerShare;
  state.post = result.table;
  $('round-price').textContent = `$${result.pricePerShare.toFixed(4)} per share · ${result.newShares.toLocaleString('en-US')} new shares · post-money ${fmtUsd(result.postMoney)} · lead owns ${fmtPct(result.investorFraction)}`;
}

function render(): void {
  recompute();
  renderCapTable($('captable'), state.table, state.post, (id, shares) => {
    state.table.holders = state.table.holders.map((h) => (h.id === id ? { ...h, shares: Math.max(0, Math.round(shares)) } : h));
    setStatus('Shares updated; conversions, round and waterfall recomputed.', 'ok');
    render();
  });
  renderConversions($('conversions'), state.conversions, state.roundPrice);
  renderWaterfall($('waterfall'), waterfall(state.post, state.exitValue));
  if (state.runwayResult) renderRunway($('runway'), $('runway-chart'), state.runwayResult, state.runway.horizonMonths);
  shell.refreshKpis();
}

function runRunway(): void {
  const problems = validateRunway(state.runway);
  if (problems.length) { setStatus(`Runway inputs: ${problems[0]}.`, 'danger'); return; }
  state.runwayResult = simulateRunway(state.runway);
  renderRunway($('runway'), $('runway-chart'), state.runwayResult, state.runway.horizonMonths);
  shell.refreshKpis();
}

/* ------------------------------------------------------------- inputs */

const ROUND: Array<[string, keyof PricedRound, (v: string) => number | string]> = [
  ['r-pre', 'preMoney', Number], ['r-inv', 'investment', Number], ['r-pool', 'poolTopUp', (v) => Number(v) / 100], ['r-mult', 'preferenceMultiple', Number]
];
for (const [id, key, conv] of ROUND) {
  $(id).addEventListener('change', (e) => { (state.round as unknown as Record<string, number | string>)[key] = conv((e.target as HTMLInputElement).value); try { render(); setStatus('Round updated.', 'ok'); } catch (err) { setStatus(`Round rejected: ${(err as Error).message}.`, 'danger'); } });
}
$<HTMLInputElement>('r-part').addEventListener('change', (e) => { state.round.participating = (e.target as HTMLInputElement).checked; render(); });
$('exit').addEventListener('input', (e) => { state.exitValue = Number((e.target as HTMLInputElement).value); $('exit-val').textContent = fmtUsd(state.exitValue); renderWaterfall($('waterfall'), waterfall(state.post, state.exitValue)); });
const RUNWAY: Array<[string, keyof RunwayInputs, (v: string) => number]> = [
  ['w-cash', 'cash', Number], ['w-burn', 'monthlyBurn', Number], ['w-burnvol', 'burnVolatility', (v) => Number(v) / 100], ['w-rev', 'monthlyRevenue', Number],
  ['w-growth', 'revenueGrowth', (v) => Number(v) / 100], ['w-growthvol', 'growthVolatility', (v) => Number(v) / 100], ['w-horizon', 'horizonMonths', Number], ['w-trials', 'trials', Number], ['w-seed', 'seed', Number]
];
for (const [id, key, conv] of RUNWAY) $(id).addEventListener('change', (e) => { (state.runway as unknown as Record<string, number>)[key] = conv((e.target as HTMLInputElement).value); });
$('run-runway').addEventListener('click', runRunway);

function syncInputs(): void {
  $<HTMLInputElement>('r-pre').value = String(state.round.preMoney); $<HTMLInputElement>('r-inv').value = String(state.round.investment);
  $<HTMLInputElement>('r-pool').value = String(Math.round(state.round.poolTopUp * 100)); $<HTMLInputElement>('r-mult').value = String(state.round.preferenceMultiple);
  $<HTMLInputElement>('r-part').checked = state.round.participating;
  $<HTMLInputElement>('exit').value = String(state.exitValue); $('exit-val').textContent = fmtUsd(state.exitValue);
  const w = state.runway;
  $<HTMLInputElement>('w-cash').value = String(w.cash); $<HTMLInputElement>('w-burn').value = String(w.monthlyBurn); $<HTMLInputElement>('w-burnvol').value = String(Math.round(w.burnVolatility * 100));
  $<HTMLInputElement>('w-rev').value = String(w.monthlyRevenue); $<HTMLInputElement>('w-growth').value = String(Math.round(w.revenueGrowth * 100)); $<HTMLInputElement>('w-growthvol').value = String(Math.round(w.growthVolatility * 100));
  $<HTMLInputElement>('w-horizon').value = String(w.horizonMonths); $<HTMLInputElement>('w-trials').value = String(w.trials); $<HTMLInputElement>('w-seed').value = String(w.seed);
}

/* ---------------------------------------------------------------- CSV */
function download(filename: string, body: string): void { const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
$('export-csv').addEventListener('click', () => download('cap-table-post-round.csv', toCsv(state.post)));
$('import-csv').addEventListener('click', () => $<HTMLInputElement>('file-csv').click());
$<HTMLInputElement>('file-csv').addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
  if (!file) return;
  file.text().then((text) => {
    const { table, warnings } = importCapTable(text);
    if (!table.holders.length) { setStatus(`Import failed: ${warnings[0] ?? 'no valid rows.'}`, 'danger'); return; }
    state.table = table;
    setStatus(warnings.length ? `Imported ${table.holders.length} holders with ${warnings.length} warning(s): ${warnings[0]}` : `Imported ${table.holders.length} holders.`, warnings.length ? 'warn' : 'ok');
    try { render(); } catch (err) { setStatus(`Imported, but the round cannot be applied: ${(err as Error).message}.`, 'danger'); }
  }).catch(() => setStatus('Import failed: could not read the file.', 'danger'));
});
$('reset').addEventListener('click', () => { Object.assign(state, sample(), { exitValue: 40_000_000, runwayResult: null }); syncInputs(); render(); runRunway(); setStatus('Sample company restored.', 'ok'); });

/* -------------------------------------------------------------- shell */
const shell = mountExecShell({
  theme: 'midnight',
  title: 'Venture Finance Modeler',
  tagline: 'Cap table, SAFE and convertible-note conversion, priced-round dilution with a pre-money option pool, exit waterfall with liquidation preferences, and a seeded Monte Carlo runway — tested finance arithmetic, in the browser. Sample company; illustrative.',
  repo: REPO, pagesUrl: PAGES,
  badges: [{ label: 'Tested finance math', tone: 'accent' }, { label: 'Seeded Monte Carlo', dot: true }, { label: 'Client-side only', dot: true }],
  kpis: [
    { label: 'Post-round shares', compute: () => totalShares(state.post).toLocaleString('en-US'), tone: 'accent' },
    { label: 'Round price', compute: () => `$${state.roundPrice.toFixed(3)}` },
    { label: 'Founders post-round', compute: () => { const t = totalShares(state.post); const f = state.post.holders.filter((h) => h.kind === 'founder').reduce((a, h) => a + h.shares, 0); return t ? fmtPct(f / t) : '—'; }, tone: 'warn' },
    { label: 'Median runway', compute: () => (state.runwayResult ? (state.runwayResult.p50 > state.runway.horizonMonths ? `> ${state.runway.horizonMonths} mo` : `${state.runwayResult.p50.toFixed(0)} mo`) : '—'), tone: 'ok' },
    { label: 'Survive horizon', compute: () => (state.runwayResult ? fmtPct(state.runwayResult.survival, 0) : '—'), tone: 'danger' }
  ],
  tour: [
    { selector: '#captable', title: 'Today and after the round', body: 'The cap table as it stands, and after the SAFEs and note convert and the seed round closes. Edit any share count and everything downstream recomputes.', action: () => { $('reset').click(); } },
    { selector: '#conversions', title: 'What the SAFEs really cost', body: 'Each instrument converts at the lower of its cap price and its discounted round price; the basis column says which term won and the last column is the effective discount to the round. On the sample the $5M cap converts at $0.50 against a $0.91 round price — a 45% discount.', action: () => {} },
    { selector: '#round', title: 'The option-pool shuffle', body: 'A 10% post-money pool created pre-money is priced into the round: the price per share falls and only existing holders pay for it. Set the top-up to 0 and watch the price move.', action: () => {} },
    { selector: '#waterfall', title: 'Who gets what at exit', body: 'Non-participating preferred takes its preference or converts, whichever pays more; participating takes both. This drags the exit to $8M, where the preferences bite.', action: () => { state.exitValue = 8_000_000; $<HTMLInputElement>('exit').value = '8000000'; $('exit-val').textContent = fmtUsd(state.exitValue); renderWaterfall($('waterfall'), waterfall(state.post, state.exitValue)); } },
    { selector: '#runway-panel', title: 'Runway as a distribution', body: 'Two thousand seeded trials of burn and revenue growth with volatility. The answer is a P10/P50/P90 and a survival curve, not one number — and the seed is on screen so the run is reproducible.', action: () => { state.exitValue = 40_000_000; syncInputs(); render(); runRunway(); } }
  ]
});

syncInputs();
render();
runRunway();
setStatus('Sample company loaded: two founders, a pool, two SAFEs, one note, a seed round. Every figure is computed.');
