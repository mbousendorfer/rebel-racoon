// ---- Insights — the read stack the mob_ lectures share -------------------------
//
// Both `mob_` readings (Index / Side) render THE SAME objective fiche; what
// differs is how they arrange its blocks — Index stacks them behind a crumb,
// Side deports three of them into a right-hand column. So the blocks live here,
// one function each, and the hosts compose them. (Band was the third host until
// it was deleted on 2026-09-11.) Same idea as `pieces.js`, one rung up: pieces owns the
// vocabulary (a verdict is a DS status pill, everywhere), this owns the SECTIONS
// that vocabulary is assembled into.
//
// ⚠️ Cockpit is deliberately NOT re-pointed at this module. It is the reference
// the mob_ lectures are being compared against,
// and rewriting them would invalidate the comparison — so their own copies of
// this stack stay exactly as they are. The duplication is the price of an
// intact baseline, and it ends the day one reading wins: the losers and this
// module are deleted together.
//
// THE FICHE IS THE PLATFORM'S REPORT CARD. Its shape is not invented here: it
// is Figma `Analytics - Shared components` → `Card / Report card (to detach)`
// (node 1070:7477), the component prod uses to show a metric with the measures
// behind it — a grey band (title · description · a white synthesis box) over a
// white body (sub-title · graph · table). `readReport` is that composition;
// `readHead` / `readReading` / `readSynthesis` / `readMeasures` are its four
// pieces, still exported one by one because Side arranges them differently.
//
// Pure render helpers — strings in, strings out, no listeners. Every action is
// a `data-ins-*` hook the shell dispatches (shell.js § Actions).

import { readingFor } from "./model.js?v=1121";
import { trendSpec } from "./charts.js?v=1121";
import {
  statusPill,
  measurePill,
  originMark,
  windowLine,
  trendGlyph,
  scoreFigure,
  postCard,
  postsEmpty,
  proxyNote,
  objectiveActions,
  tierCounts,
  esc,
} from "./pieces.js?v=1121";

/** Which measure is on screen: the reader's tab if they picked one, else the weakest. */
export function shownMeasure(entry, local) {
  const tabId = local.measureTab[entry.key];
  return entry.measures.find((m) => m.id === tabId) || entry.headline || entry.measures[0];
}

// ── Head ──────────────────────────────────────────────────────────────────
//
// The objective at the DS h1 rung with its verdict beside it, and the two doors
// on the right. It is the `Title` row of the platform's own report card
// (Figma Analytics · `Card / Title+synthesis`, node 1069:7931): the name at the
// H1 rung, the action held at the far right where prod keeps `Download chart`.
//
// TWO things left this line, and both moved rather than vanished:
//   • the measure COUNT — the Measures sub-title says it twelve pixels lower;
//   • the PROVENANCE and the WINDOW — they are facts about the objective, and
//     in the report card facts live in the synthesis box under the title
//     (prod's is `Total engagement 1,709` | `+2.5% · Compared to <dates>`).
//     A head carries what IDENTIFIES the objective; the box carries what is
//     true of it right now.

export function readHead(entry, { actions = true } = {}) {
  return `<header class="ins-read__head">
    <div class="ins-read__titles">
      <div class="ins-read__title"><h2>${esc(entry.label)}</h2>${statusPill(entry)}</div>
    </div>
    ${actions ? objectiveActions(entry) : ""}
  </header>`;
}

/**
 * The one-line reading, and the missing-connection note when there is one.
 *
 * ⚠️ The prose is now the FALLBACK, not a permanent line. "Reach is at 74% of
 * target, down 8% over the window" was the THIRD statement of that fact on one
 * page — the figure row says it in numerals, the table row says it in columns,
 * and the status pill says the verdict a second time. When every fact is
 * repeated four times nothing on the page is emphasised, which is what made
 * this page read as flat.
 *
 * It comes back for the states that have no figure to show — a collecting
 * objective, or one with no measure yet — where a sentence is all there is.
 * When it does, it lands in the report card's DESCRIPTION slot, under the
 * title — prod's own two-line paragraph in grey-80 (`Card / Title+synthesis`).
 *
 * The proxy note is NOT here any more: it is a warning banner, and `readReport`
 * puts it at the top of the white body rather than on the band's grey, where an
 * `.ap-infobox` on a tint reads as muddy. It stays unconditional.
 */
export function readReading(entry) {
  const noFigure = entry.collecting || !entry.headline;
  return noFigure ? `<p class="ins-read__reading">${esc(readingFor(entry))}</p>` : "";
}

// ── The synthesis box: the hero, as the platform frames it ────────────────
//
// The white inset that sits INSIDE the card's grey band — the `Synthesis` frame
// of Figma Analytics · `Card / Title+synthesis` (node 1069:7931), measured off
// the file: white on the band's grey, radius, 16px padding, cells of
// label-over-value, and a 1px × 40 rule between two cells with 24px on either
// side. Prod fills it with `Total engagement / 1,709 interactions` | `+2.5%` and
// `Compared to Nov 1 – Nov 30`.
//
// Ours holds the same two kinds of thing: where the objective STANDS, then the
// facts the reading is true OF.
//   • the lead cell is `scoreFigure` at `xl` — 38px, the platform's `.main-data`
//     size. That is a borrow from the OTHER Analytics component, `Card / Key
//     metrics` (node 432:6310), whose `Value` is a big bold figure; prod's
//     synthesis value is 14px bold. Deliberate: the objective's percentage is
//     this page's one headline number, and its meta line already carries the
//     measure's name and the move — prod's variation cell, folded into the same
//     cell.
//   • then `Window` and `Origin`, one fact each. They are the two lines the head
//     used to carry under the title.
//
// ⚠️ NOT current + target. They stood here as two more figures and the Measures
// table's first row printed the same two numbers in its own columns, because the
// headline measure is a measure like the others and always has a row. The
// operands belong to the measure, so they are stated where a measure is stated —
// `14,800 / 20,000` in its row, which is also the division the score IS. That
// is what every goal page does once it has a measures list under the hero
// (ClickUp, TheyDo, Literal, Quicken); Asana's three-tile hero is the exception
// that proves it, having no measures list at all.
//
// `facts: false` is for a host that already shows them elsewhere — Mob · Side
// has a whole right-hand column of facts, and the box would repeat two of its
// five rows.
//
// Cockpit keeps its own three-figure readout: it is the untouched baseline.

function synthCell(label, valueHtml) {
  return `<div class="ins-read__cell">
    <span class="ins-read__celllabel">${esc(label)}</span>
    <span class="ins-read__cellvalue">${valueHtml}</span>
  </div>`;
}

const SYNTH_SEP = `<span class="ins-read__cellsep" aria-hidden="true"></span>`;

export function readSynthesis(entry, { facts = true } = {}) {
  const cells = [`<div class="ins-read__cell ins-read__cell--lead">${scoreFigure(entry, { size: "xl" })}</div>`];
  if (facts) {
    cells.push(synthCell("Window", esc(windowLine(entry))));
    cells.push(synthCell("Origin", originMark(entry, { short: true })));
  }
  return `<div class="ins-read__synth">${cells.join(SYNTH_SEP)}</div>`;
}

// ── The report card: band over body, one card ─────────────────────────────
//
// The whole fiche is the platform's `Card / Report card (to detach)` (node
// 1070:7477), which is Analytics' answer to "show a metric and the measures
// behind it": a grey BAND carrying the title, its description and the white
// synthesis box, then a white BODY carrying the graph's sub-title, the graph,
// and the table under it.
//
// Two deliberate divergences from prod, both written here so they are not
// "fixed" later:
//
//   1. **Table above the curve, not under it.** Prod's table is a BREAKDOWN of
//      the one metric it charts (Organic | Paid | Total per interaction type),
//      so it reads after the picture. Ours CHOOSES what the curve draws, and a
//      control sits above what it changes — the arrangement with the rows under
//      the chart was built and rejected (§ Measures). Charting every measure at
//      once, prod-style, is not the way out either: `Reach` (14,800) and `Brand
//      mentions` (48), a volume and a rate, share no axis.
//   2. **No total row.** Prod closes its table with a bold `Total engagement`.
//      Two measures in different units do not add up, and an objective's
//      progress is not the sum of its measures' progress.
//
// `head: false` is for a host whose own chrome already names the objective —
// Mob · Side puts the name in a page band as a picker, so a title inside the
// card would say it twice.

export function readReport(entry, shown, specs, { head = true, facts = true, ...opts } = {}) {
  return `<section class="ap-card ins-read__report">
    <header class="ins-read__reportband">
      ${head ? readHead(entry) : ""}
      ${readReading(entry)}
      ${readSynthesis(entry, { facts })}
    </header>
    <div class="ins-read__reportbody">
      ${entry.parked ? proxyNote(entry) : ""}
      ${readMeasures(entry, shown, specs, { ...opts, framed: false })}
    </div>
  </section>`;
}

// ── Measures: the curve and the list it belongs to, in ONE card ───────────
//
// ⚠️ This was TWO cards, and the same measures were named in BOTH: a DS tab
// strip over the chart ("Video views | Completion rate") and then, ~600px
// below, a Measures table whose first column is those same two names. Two
// lists of the same items, one of which happened to also be the selector.
//
// Now there is one list, and it IS the selector — the table is the master, the
// curve under it is the detail of the row you picked. That is the shape every
// analytics product uses for "a list of series, one charted" (GA, Amplitude:
// click the row, its trend renders below), and the order is what makes it
// learnable: a control sits ABOVE what it changes.
//
// ⚠️ It shipped for one commit the other way up — curve first, table under it
// as the chart's "legend", on the argument that Highcharts' own legend sits
// below the plot and switches series on click. Rejected, and rightly: a legend
// TOGGLES series that are already drawn, it does not swap the subject of the
// chart above it, and nothing tells a reader that clicking a row underneath a
// curve will replace that curve. Don't put the selector back below.
//
// The selected measure is still NAMED above its curve — a metric has to be
// named in text, an unlabelled 300px area chart says nothing — and it is what
// makes the causality visible: click "Brand mentions", the caption under the
// table says Brand mentions. It is the line the single-measure case already
// used, now used always: with one measure there was never a strip, so that
// case loses nothing.
//
// `specs` is the map the host hands to `mountCharts` after the innerHTML
// lands; the chart nodes are placeholders until then, which is what keeps
// these functions free of DOM.

export function readMeasures(entry, shown, specs, { idPrefix = "read", chartId, height = 300, framed = true } = {}) {
  const id = chartId || `${idPrefix}-trend`;
  if (shown?.series) {
    specs.set(
      id,
      trendSpec(shown.series, {
        tier: entry.collecting ? "collecting" : shown.tier,
        metricLabel: shown.metricLabel,
        height,
      }),
    );
  }
  const overlay = entry.collecting
    ? `<div class="ins-chart-overlay">
        <span class="ap-status grey">Collecting</span>
        <span class="ins-muted">day ${entry.grace?.day ?? 1} of ${entry.grace?.of ?? 7}</span>
      </div>`
    : "";

  const rows = entry.measures
    .map((m) => {
      const on = m === shown;
      // The row carries the same two data attributes the tab carried, so the
      // shell's existing dispatch switches the curve with no change to it. The
      // name is a real BUTTON — what the keyboard and AT reach — the same
      // arrangement the objective cards use for their own titles.
      // ⚠️ Those two wrappers are SPANS, not divs, and that is load-bearing: the
      // DS styles `.ap-table th > div` as the header cell's own flex row
      // (label + sort glyph, `align-items: center`), so a `div` here inherited
      // a centring meant for a row and pushed the measure's name to the middle
      // of the column. The DS's cell classes only set display and flex, so they
      // work on any element — and a span dodges the implicit child selector
      // instead of overriding a `.ap-*` rule, which this repo does nowhere
      // outside ds-patches.css.
      //
      // The name cell is the DS table's OWN two-line cell —
      // `.ap-table-cell-text-container` + `.ap-table-cell-description` — not a
      // hand-rolled stack with `.ins-muted` on the second line. The component
      // ships that anatomy (ds/css-ui: `-text`, `-text.bold`, `-description`,
      // `-content` for a row of glyph + text), and prod's own tables use it.
      // The button keeps `.ins-read__mname` for its ink and its blue hover: it
      // is the selector, and only the interactive thing may be blue.
      return `<tr class="ins-read__mrow${on ? " selected" : ""}" data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}">
        <th scope="row">
          <span class="ap-table-cell-text-container">
            <span class="ap-table-cell-content">
              <button type="button" class="ins-read__mname" data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}" aria-pressed="${on}">${esc(m.metricLabel)}</button>${m.proxy ? `<span class="ap-badge blue">proxy</span>` : ""}
            </span>
            <span class="ap-table-cell-description">${esc(m.scopeLabel || "All networks")}</span>
          </span>
        </th>
        <td class="right ins-read__pair"><span class="ins-num">${esc(m.currentLabel)}</span><span class="ins-read__of" aria-hidden="true"> / </span><span class="ins-num ins-read__target">${esc(m.targetLabel)}</span></td>
        <td class="right ins-num ins-read__pct">${m.progress == null ? "—" : `${m.progress}%`}</td>
        <td class="right">${trendGlyph(m)}</td>
        <td class="right">${measurePill(m)}</td>
      </tr>`;
    })
    .join("");

  // The DS table, FIVE columns, and the rule they answer to: one column, one
  // fact. It carried seven, and four of them were two facts drawn four ways —
  // where the measure stands (a bar, a `%`, and `Current` ÷ `Target`) and where
  // it is going (a `−8%`, a 120px sparkline, and a verdict pill derived from
  // both). Two went:
  //
  //   • `Trajectory` — the sparkline of the very series the 300px chart draws
  //     forty pixels below for the selected row, and for the others a second
  //     drawing of the `Trend` number beside it. Uniswap, Pinterest Trends and
  //     PlanetScale all carry a sparkline INSTEAD of a numeric delta, never
  //     both; and at 120 × 30px on a series that moves 10% over a month, these
  //     two rendered as flat lines — a smudge standing in for a reading.
  //   • `Target` as a column of its own — folded into `Current` as
  //     `14,800 / 20,000`, which is how 15Five ("Start: 0 Target: 10"),
  //     Employment Hero ("Start: 0% Goal: 100%") and Charma all write a
  //     measure's target: beside its value, not as a second column. It also
  //     puts the division on screen next to the `74%` that IS that division.
  //
  // `Trend` survives over the sparkline because it is exact, it is one word
  // wide, and screen readers get it for free. It is now titled `Variation`,
  // which is the word prod's own report table uses for that column.
  //
  // ⚠️ The `Progress` cell lost its BAR. Figma Analytics · `Table / Simple`
  // (node 1070:6792) is built as `.left cols` + n × `.right cols` of equal
  // width, and every one of those cells holds a FIGURE — there is not a drawn
  // shape anywhere in a platform table. So all four figure columns are `.right`
  // now and the percentage stands alone in bold; the tier's colour is still on
  // screen, carried by the `State` pill, which is where a colour may carry
  // meaning because a word sits in it.
  //
  // No per-th/td rules beyond the one that absorbs the slack: the component
  // sets its own width, aligns its headers and ships `.right` and
  // `tbody tr.selected`.
  const body = `<h3 class="ins-section-title">Measures <span class="ap-counter normal grey">${entry.measures.length}</span></h3>
    <div class="ins-read__tablewrap">
    <table class="ap-table small ins-read__table">
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col" class="right">Current / target</th>
          <th scope="col" class="right">Progress</th>
          <th scope="col" class="right">Variation</th>
          <th scope="col" class="right">State</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
    <div class="ins-read__curve">
      <p class="ins-chart__name">${esc(shown?.metricLabel || "Trend")}${shown?.scopeLabel ? ` <span class="ins-muted">· ${esc(shown.scopeLabel)}</span>` : ""}</p>
      <div class="ins-chart ins-chart--read">
        ${shown?.series ? `<div class="ins-chart__node" data-ins-chart="${esc(id)}" style="height:${height}px"></div>` : `<p class="ins-posts-empty">No series for this measure.</p>`}
        ${overlay}
      </div>
    </div>`;

  // `framed: false` hands the blocks back bare, for a host that already has a
  // card around them — which is what `readReport` is. The standalone card stays
  // the default so nothing outside this module has to know.
  return framed ? `<section class="ap-card ins-section ins-read__card ins-read__measures">${body}</section>` : body;
}

// ── Posts ─────────────────────────────────────────────────────────────────

export function readPosts(entry) {
  return `<section class="ap-card ins-section ins-read__card">
    <h3 class="ins-section-title">Posts drafted with Archie <span class="ap-counter normal grey">${entry.posts.length}</span></h3>
    ${entry.posts.length ? `<div class="ins-postlist">${entry.posts.map((p) => postCard(p, entry)).join("")}</div>` : postsEmpty()}
  </section>`;
}

// ── Facts ─────────────────────────────────────────────────────────────────
//
// The objective's quick facts as label/value rows — what Monarch and Plane put
// in their right-hand column. It carries no button: the verbs stay in the head,
// where a reader of any of the three lectures finds them, which also keeps a
// 300px column from growing a full-width CTA.

export function readFacts(entry, rollup) {
  const c = entry.counts;
  const row = (name, value) =>
    `<div class="ins-read__fact"><span class="ins-read__factname">${esc(name)}</span><span class="ins-read__factvalue">${value}</span></div>`;
  const breakdown = [c.on ? `${c.on} on` : "", c.soft ? `${c.soft} at risk` : "", c.off ? `${c.off} off` : ""]
    .filter(Boolean)
    .join(" · ");
  return `<aside class="ap-card ins-section ins-read__facts" aria-label="Objective facts">
    ${row("Verdict", statusPill(entry))}
    ${row("Window", `<span class="ins-read__facttext">${esc(windowLine(entry))}</span>`)}
    ${row("Origin", originMark(entry, { short: true }))}
    ${row("Measures", `<span class="ins-read__facttext">${c.measures}${breakdown ? ` <span class="ins-muted">· ${esc(breakdown)}</span>` : ""}</span>`)}
    ${row("Posts", `<span class="ins-read__facttext">${c.posts}</span>`)}
    ${entry.parked ? proxyNote(entry) : ""}
    <div class="ins-read__factsfoot">
      <span class="ins-read__factname">This Playbook</span>
      ${tierCounts(rollup)}
    </div>
  </aside>`;
}
