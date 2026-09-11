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

import { readingFor } from "./model.js?v=1108";
import { trendSpec, sparklineSpec, progressBar } from "./charts.js?v=1108";
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
} from "./pieces.js?v=1108";

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

// ── Chart ─────────────────────────────────────────────────────────────────
//
// Every measure is reachable in full, not just the one deciding the verdict —
// the same switcher Cockpit's chart card and Report's chapter carry. With a
// single measure the chart is named in prose: a one-tab tab bar cannot be used.

function measureTabs(entry, shown) {
  if (entry.measures.length < 2) {
    return `<p class="ins-chart__name">${esc(shown?.metricLabel || "Trend")}${shown?.scopeLabel ? ` <span class="ins-muted">· ${esc(shown.scopeLabel)}</span>` : ""}</p>`;
  }
  const tabs = entry.measures
    .map(
      (
        m,
      ) => `<button type="button" class="ap-tabs-tab ${m === shown ? "active" : ""}" role="tab" id="ins-mtab-${esc(m.id)}"
        aria-controls="ins-mpanel" aria-selected="${m === shown}" tabindex="${m === shown ? 0 : -1}"
        data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}"><span>${esc(m.metricLabel)}</span></button>`,
    )
    .join("");
  return `<div class="ap-tabs ins-read__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="Measure" data-ins-tablist>${tabs}</div></div>`;
}

/**
 * The curve, in its own card. `specs` is the map the host hands to
 * `mountCharts` after the innerHTML lands — the chart node is a placeholder
 * until then, which is what keeps these functions free of DOM.
 */
export function readChart(entry, shown, specs, { id, height = 300, card = true } = {}) {
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
  const body = `${measureTabs(entry, shown)}
    <div class="ins-chart ins-chart--read" id="ins-mpanel" role="tabpanel" aria-labelledby="ins-mtab-${esc(shown?.id || "")}">
      ${shown?.series ? `<div class="ins-chart__node" data-ins-chart="${esc(id)}" style="height:${height}px"></div>` : `<p class="ins-posts-empty">No series for this measure.</p>`}
      ${overlay}
    </div>`;
  return card ? `<section class="ap-card ins-section ins-read__card">${body}</section>` : body;
}

// ── Measures ──────────────────────────────────────────────────────────────
//
// The DS table, seven columns. No per-th/td rules: the component sets its own
// width, aligns its headers and ships `.right` and `tbody tr.selected`.

export function readMeasures(entry, shown, specs, { idPrefix = "read" } = {}) {
  const rows = entry.measures
    .map((m, i) => {
      const sparkId = `${idPrefix}-mspark-${i}`;
      if (m.series) specs.set(sparkId, sparklineSpec(m.series, { tier: m.tier, height: 30 }));
      return `<tr${m === shown ? ' class="selected"' : ""}>
        <th scope="row">
          <span class="ins-read__metric">${esc(m.metricLabel)}${m.proxy ? ` <span class="ap-badge blue">proxy</span>` : ""}</span>
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

  return `<section class="ap-card ins-section ins-read__card">
    <h3 class="ins-section-title">Measures</h3>
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
