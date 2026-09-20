# Case Study — Venture Finance Modeler

**Repository:** [venture-finance-modeler](https://github.com/Freddricklogan/venture-finance-modeler) · **Live demo:** [freddricklogan.github.io/venture-finance-modeler](https://freddricklogan.github.io/venture-finance-modeler/) · **Author:** Freddrick Logan

---

## 1. Who has this problem

A first-time founder raising on SAFEs — a researcher spinning a lab project out of a university, a graduate of a programme like Elevate, the education-technology founder I advise — and the people meant to help: the university venture office, the accelerator mentor, the business-school board member. All talk about caps, pools and preferences; few have run the arithmetic on the term sheet in front of them.

## 2. The problem, as a scenario

A founder has taken $500,000 on a SAFE with a $5 million cap, $250,000 on a second with an $8 million cap and a 20% discount, and a $100,000 family note. A seed lead offers $3 million at $12 million pre-money with a 10% option pool "in the pre-money" and a 1× non-participating preference. The founder hears "$12 million" and "10%". Not heard: the first SAFE converts at $0.50 against a $0.91 round price — a 45% discount; the pool is paid for entirely by existing holders; the two founders will own under half the company; at an $8 million exit the lead takes its money back first and 37% of the proceeds. Every one of those numbers was knowable before signing.

## 3. What it costs to leave it alone

Ownership given away rather than negotiated; a preference stack that turns a modest exit into nothing for the people who built the company; a pool the founder thought the investor paid for. I cannot cite a figure honestly — it is specific to each term sheet — but it is measured in percentage points of a company, decided in the week the founder has least time to learn the arithmetic. Runway has the same shape: one burn number becomes a plan, when the honest answer is a distribution.

## 4. The approach, and the alternative I rejected

I built the chain as tested functions: today's cap table; SAFEs and notes converting at the lower of cap price and discounted round price, basis reported; a priced round with a pre-money pool top-up sized to a post-money target; an exit waterfall paying preferences pro rata on a shortfall and letting non-participating preferred convert when that pays more; and a seeded Monte Carlo runway reporting P10, P50, P90 and a survival curve beside the deterministic answer. Every panel states its rule; every input is editable.

The alternative I rejected was a spreadsheet template — what most founders are handed, and where the errors live: an unconverted SAFE, a pool sized on the wrong base, a preference applied after conversion instead of before. Tested functions pin each rule to a hand-checked case, and the same functions drive the tour.

## 5. What the code does today

Real: cap-table ownership, the priced round with the option-pool shuffle, post-money SAFE and note conversion with cap and discount, the exit waterfall with participating and non-participating preferences and pro-rata shortfalls, the seeded Monte Carlo runway with percentiles and a survival curve, and cap-table CSV import and export with validation. All of it is strict-mode TypeScript with unit tests, separated from a rendering layer that builds the page through `textContent` only.

Simulated: the company. Founders, pool, SAFEs, note, round and burn are illustrative; the page says so.

Worth knowing: the SAFE convention is the post-money form, converting against the pre-round fully diluted count; pre-money SAFEs and some note conventions differ, and the screen says which this is. The round is priced on the converted table, matching the standard "SAFEs convert immediately before the financing" order. The runway model draws burn and growth from normal distributions; it teaches uncertainty rather than forecasting.

## 6. Evidence

Measured in continuous integration and a headless-browser smoke test of the built site: 31 unit tests passing across five files, 100% statement coverage over the pure modules, type-checked ESLint and `tsc --noEmit` clean, HTML validation clean, CodeQL and dependency scanning enabled. The tests pin hand arithmetic — $12 million pre-money on 10 million shares prices at $1.20 with no pool; the $5 million cap converts at $0.50; a 1× preference at a $1.5 million exit takes $1 million and converts at $10 million — and that zero volatility collapses every runway trial to the deterministic answer. In the browser: zero console errors; on the sample the round prices at $0.9135, founders hold 48.7% post-round, the first SAFE's effective discount is 45.3%, a zero pool raises the price to $1.044, and the runway reports a P10 of 22 months and 56.7% survival at 36 months on seed 42. No horizontal scroll at 400 pixels.

## 7. What it would take to run this in production

For one founder the static page is the product: enter the term sheet, read the table. For a venture office or accelerator it would need saved companies behind sign-in, a term-sheet library with each instrument's real conventions — pre- and post-money SAFEs, MFN clauses, pro-rata rights — sequential rounds, and a waterfall honouring option strike prices rather than treating the pool as exercised. That is weeks of modelling with a lawyer reviewing conventions, plus a small service.

## 8. Limits and next steps

One round; one currency; the pool treated as exercised at exit; no pro-rata rights, MFN or side letters; no pre-money SAFE variant; no seniority between series. Next: sequential rounds, pre-money SAFE and seniority options, a strike-price-aware waterfall, and side-by-side term sheets.

## 9. Who should look at this

**Hiring manager:** evidence that I turn finance concepts into tested code and state every convention rather than hide it.
**Consulting client:** a working way to read a term sheet before signing — bring the cap and discount and we will see what they mean.
**Engineer:** read `src/convertibles.ts` and `src/waterfall.ts` for the conventions and the conversion fixed point; `tests/` holds the hand-checked cases.
