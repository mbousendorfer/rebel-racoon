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
// Pure render helpers — strings in, strings out, no listeners. Every action is
// a `data-ins-*` hook the shell dispatches (shell.js § Actions).

import { readingFor } from "./model.js?v=1118";
import { trendSpec, progressBar } from "./charts.js?v=1118";
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
} from "./pieces.js?v=1118";

/** Which measure is on screen: the reader's tab if they picked one, else the weakest. */
export function shownMeasure(entry, local) {
  const tabId = local.measureTab[entry.key];
  return entry.measures.find((m) => m.id === tabId) || entry.headline || entry.measures[0];
}

// ── Head ──────────────────────────────────────────────────────────────────
//
// The objective at the DS h1 rung with its verdict beside it, the provenance and
// the window under it, and the two doors on the right. Same lines as Cockpit's
// pane head — an objective introduces itself the same way whichever reading
// opened it.
//
// The measure COUNT left this line: the Measures card's own counter says it
// twelve pixels lower, and a page head should carry what identifies the
// objective, not an inventory of the card below it.

export function readHead(entry, { actions = true } = {}) {
  return `<header class="ins-read__head">
    <div class="ins-read__titles">
      <div class="ins-read__title"><h2>${esc(entry.label)}</h2>${statusPill(entry)}</div>
      <p class="ins-read__meta">${originMark(entry)} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(entry))}</p>
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
 * The proxy note is unconditional: it is the only thing on the page that says
 * WHY a number is standing in for another, and no figure carries that.
 */
export function readReading(entry) {
  const noFigure = entry.collecting || !entry.headline;
  return `${noFigure ? `<p class="ins-read__reading">${esc(readingFor(entry))}</p>` : ""}
    ${entry.parked ? proxyNote(entry) : ""}`;
}

// ── The hero: ONE figure ──────────────────────────────────────────────────
//
// How far along, and the measure it is of. That is the objective's answer, and
// it is the only thing on this page allowed to be 56px tall.
//
// ⚠️ NOT a card. It was `.ap-card`, which made it the fourth white box of
// identical weight — same border, same radius, same 24px padding — on a page
// that had no hero at all. On the page's own ground, directly under the title,
// it IS the hero.
//
// ⚠️ And it is no longer THREE figures. `14,800 current` and `20,000 target`
// stood beside the score — and forty pixels below, the Measures table's first
// row printed the same two numbers in its own columns, because the headline
// measure is a measure like the others and always has a row. The operands
// belong to the measure, so they are stated where a measure is stated: in its
// row, as `14,800 / 20,000`, which is also the division the score IS.
//
// That split is what every goal page in the market does once it has a list of
// measures under the hero — ClickUp, TheyDo, Literal and Quicken all put ONE
// figure at the top and let the list below carry the per-item numbers. Asana's
// three-tile hero is the exception that proves it: Asana has no measures list
// at all, so its hero is the only place those numbers could go.
//
// Cockpit keeps the three-figure readout on purpose: it is the baseline the
// mob_ lectures are compared against and it has its own copy (cockpit.js).

export function readout(entry) {
  return `<div class="ins-read__readout">
    ${scoreFigure(entry, { size: "xl" })}
  </div>`;
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

export function readMeasures(entry, shown, specs, { idPrefix = "read", chartId, height = 300 } = {}) {
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
      return `<tr class="ins-read__mrow${on ? " selected" : ""}" data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}">
        <th scope="row">
          <button type="button" class="ins-read__mname" data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}" aria-pressed="${on}">${esc(m.metricLabel)}</button>${m.proxy ? ` <span class="ap-badge blue">proxy</span>` : ""}
          <span class="ins-muted">${esc(m.scopeLabel || "All networks")}</span>
        </th>
        <td class="right ins-read__pair"><span class="ins-num">${esc(m.currentLabel)}</span><span class="ins-read__of" aria-hidden="true"> / </span><span class="ins-num ins-read__target">${esc(m.targetLabel)}</span></td>
        <td class="ins-read__bar">
          ${progressBar(m.progress, m.tier, { pending: m.progress == null })}
          <span class="ins-num">${m.progress == null ? "—" : `${m.progress}%`}</span>
        </td>
        <td>${trendGlyph(m)}</td>
        <td>${measurePill(m)}</td>
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
  // wide, and screen readers get it for free.
  //
  // No per-th/td rules beyond the two that hold a drawn shape or absorb the
  // slack: the component sets its own width, aligns its headers and ships
  // `.right` and `tbody tr.selected`.
  return `<section class="ap-card ins-section ins-read__card ins-read__measures">
    <h3 class="ins-section-title">Measures <span class="ap-counter normal grey">${entry.measures.length}</span></h3>
    <table class="ap-table small ins-read__table">
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col" class="right">Current / target</th>
          <th scope="col">Progress</th>
          <th scope="col">Trend</th>
          <th scope="col">State</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ins-read__curve">
      <p class="ins-chart__name">${esc(shown?.metricLabel || "Trend")}${shown?.scopeLabel ? ` <span class="ins-muted">· ${esc(shown.scopeLabel)}</span>` : ""}</p>
      <div class="ins-chart ins-chart--read">
        ${shown?.series ? `<div class="ins-chart__node" data-ins-chart="${esc(id)}" style="height:${height}px"></div>` : `<p class="ins-posts-empty">No series for this measure.</p>`}
        ${overlay}
      </div>
    </div>
  </section>`;
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
