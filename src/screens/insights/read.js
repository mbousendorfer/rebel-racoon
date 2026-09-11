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

import { readingFor } from "./model.js?v=1110";
import { trendSpec, sparklineSpec, progressBar } from "./charts.js?v=1110";
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
  figure,
  esc,
} from "./pieces.js?v=1110";

/** Which measure is on screen: the reader's tab if they picked one, else the weakest. */
export function shownMeasure(entry, local) {
  const tabId = local.measureTab[entry.key];
  return entry.measures.find((m) => m.id === tabId) || entry.headline || entry.measures[0];
}

// ── Head ──────────────────────────────────────────────────────────────────
//
// The objective at the DS h1 rung with its verdict beside it, the provenance /
// window / measure count under it, and the two doors on the right. Same three
// lines as Cockpit's pane head — an objective introduces itself the same way
// whichever reading opened it.

export function readHead(entry, { actions = true } = {}) {
  const n = entry.measures.length;
  return `<header class="ins-read__head">
    <div class="ins-read__titles">
      <div class="ins-read__title"><h2>${esc(entry.label)}</h2>${statusPill(entry)}</div>
      <p class="ins-read__meta">${originMark(entry)} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(entry))} <span class="ins-dot" aria-hidden="true">·</span> ${n} measure${n === 1 ? "" : "s"}</p>
    </div>
    ${actions ? objectiveActions(entry) : ""}
  </header>`;
}

/** The one-line reading, and the missing-connection note when there is one. */
export function readReading(entry) {
  return `<p class="ins-read__reading">${esc(readingFor(entry))}</p>
    ${entry.parked ? proxyNote(entry) : ""}`;
}

// ── Readout ───────────────────────────────────────────────────────────────
//
// Three cells, not four of equal weight: how far along dominates (it is the
// answer), current and target are what it is made of.

export function readout(entry) {
  const head = entry.headline;
  return `<div class="ap-card ins-section ins-read__readout">
    ${scoreFigure(entry, { size: "xl" })}
    ${figure(esc(head?.currentLabel || "—"), "current")}
    ${figure(esc(head?.targetLabel || "—"), head?.isRate ? "hold above" : "target")}
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
    .map((m, i) => {
      const sparkId = `${idPrefix}-mspark-${i}`;
      if (m.series) specs.set(sparkId, sparklineSpec(m.series, { tier: m.tier, height: 30 }));
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
        <td class="right ins-num">${esc(m.currentLabel)}</td>
        <td class="right ins-num">${esc(m.targetLabel)}</td>
        <td class="ins-read__bar">
          ${progressBar(m.progress, m.tier, { pending: m.progress == null })}
          <span class="ins-num">${m.progress == null ? "—" : `${m.progress}%`}</span>
        </td>
        <td>${trendGlyph(m)}</td>
        <td class="ins-read__spark">${m.series ? `<span class="ins-chart__node" data-ins-chart="${sparkId}" style="height:30px"></span>` : ""}</td>
        <td>${measurePill(m)}</td>
      </tr>`;
    })
    .join("");

  // The DS table, seven columns. No per-th/td rules beyond the two cells that
  // hold a drawn shape: the component sets its own width, aligns its headers
  // and ships `.right` and `tbody tr.selected`.
  return `<section class="ap-card ins-section ins-read__card ins-read__measures">
    <h3 class="ins-section-title">Measures <span class="ap-counter normal grey">${entry.measures.length}</span></h3>
    <table class="ap-table small ins-read__table">
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th scope="col" class="right">Current</th>
          <th scope="col" class="right">Target</th>
          <th scope="col">Progress</th>
          <th scope="col">Trend</th>
          <th scope="col">Trajectory</th>
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
