// ---- Insights · Cockpit bis — the objectives as a band, one read at full width ---
//
// The same master–detail as Cockpit, turned 90°: every objective is a TILE in a
// band across the top, and the selected one is read underneath at the page's
// full width. The band is pinned, the read scrolls — so switching objective
// never means scrolling back up, which is the promise the rail was making.
//
// WHY it exists: a Playbook carries two or three objectives. Cockpit spends a
// 340px column of full viewport height on them — two rows of content and the
// rest white — and pays for it twice, because the pane it starves is the half
// with a 7-column table and a 300px curve in it. Rotating the selector spends
// width instead of height, and width is what a short list has to spare.
//
// The row is built for FOUR tiles. That is the number the band is calibrated
// on: four objectives read side by side without wrapping, and a Playbook with
// two or three shows the slot it has left as a placeholder rather than
// stretching its tiles across the page. Past four it wraps and scrolls, and
// Cockpit's rail is the better answer again.
//
// What the tile carries is the sentence and nothing else: the name, the
// verdict, and "74% of target on Reach, down 8%". No ring, no bar, no
// sparkline. The shapes all said what the numeral beside them already said —
// Report cut its ring row for exactly that — and at a quarter of the row a
// curve is back to being a smudge. Comparing four tiles is comparing four
// numbers, which is what they are for; the curve is the pane's job, at the size
// it needs.

import { readingFor } from "../model.js?v=1056";
import { trendSpec, sparklineSpec, progressBar, mountCharts } from "../charts.js?v=1056";
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
  figure,
  esc,
} from "../pieces.js?v=1056";

export const id = "cockpit-bis";
export const label = "Cockpit bis";
export const title = "Cockpit bis — the objectives as a band, one read at full width";
export const icon = "ap-icon-view-cards";

const CHART_HEIGHT = 280;

/** The row is calibrated on four tiles; below that the band offers its free slot. */
const ROW = 4;

export function render(host, vm) {
  const { entries, selectedKey, local, firstPaint } = vm;
  const selected = entries.find((e) => e.key === selectedKey) || entries[0];
  const specs = new Map();

  host.innerHTML = `<div class="ins-cockpitb">
    ${renderStrip(entries, selected)}
    ${renderPane(selected, local, specs, firstPaint)}
  </div>`;

  mountCharts(host, specs);
  return () => {};
}

// ── The band ──────────────────────────────────────────────────────────────
//
// One tile per objective in a four-up row, so the scores line up and can be
// read against each other — which a stacked rail of 34px sparklines could not
// do. Under four, the next cell is a placeholder: the band knows how many
// objectives fit, so the free slot is the invitation, and it costs nothing that
// an empty cell was not already costing.
//
// It is titled and it is a TRAY — grey ground, a grey-20 line under it — not a
// white band on a near-white page: the tiles are white, so a white band made
// the selector and the read below it read as one continuous surface. The title
// is what says where the band stops being page chrome and starts being the list
// of objectives.
//
// No counts line, though, and no roll-up: with the tiles themselves on screen,
// "On track 1 · At risk 1 · Off track 0" is a recount of what the reader is
// already looking at.

function renderStrip(entries, selected) {
  const tiles = entries
    .map((e) => {
      const on = e === selected;
      return `<li>
        <button type="button" class="ins-cockpitb-tile${on ? " is-selected" : ""}" data-ins-select="${esc(e.key)}" data-ins-objective="${esc(e.key)}"${on ? ' aria-current="true"' : ""}>
          <span class="ins-cockpitb-tile__head">
            <span class="ins-cockpitb-tile__name">${esc(e.label)}</span>
            ${statusPill(e)}
          </span>
          ${scoreFigure(e, { size: "sm" })}
        </button>
      </li>`;
    })
    .join("");

  // A card-shaped door, quiet on purpose: it is an empty slot the reader may
  // fill, not a call to action competing with the page bar's primary. Full-cell
  // because it IS a cell — the tiles beside it are buttons of the same size.
  const slot =
    entries.length < ROW
      ? `<li class="ins-cockpitb-strip__slot">
          <button type="button" class="ins-cockpitb-add" data-ins-new>
            <i class="ap-icon-plus" aria-hidden="true"></i><span>New objective</span>
          </button>
        </li>`
      : "";

  return `<nav class="ins-cockpitb-strip" aria-label="Objectives">
    <div class="ins-cockpitb-strip__inner">
      <h1 class="ins-cockpitb-strip__title">Objectives</h1>
      <ul class="ins-cockpitb-strip__list">${tiles}${slot}</ul>
    </div>
  </nav>`;
}

// ── The read ──────────────────────────────────────────────────────────────

function renderPane(entry, local, specs, firstPaint) {
  if (!entry) return `<main class="ins-cockpitb-pane"></main>`;

  const measures = entry.measures;
  const tabId = local.measureTab[entry.key];
  const shown = measures.find((m) => m.id === tabId) || entry.headline || measures[0];
  const chartId = "cockpitb-trend";
  if (shown?.series) {
    specs.set(
      chartId,
      trendSpec(shown.series, {
        tier: entry.collecting ? "collecting" : shown.tier,
        metricLabel: shown.metricLabel,
        height: CHART_HEIGHT,
      }),
    );
  }

  // Same switcher as Cockpit's chart card and Report's chapter — every measure
  // is reachable in full, not just the one deciding the verdict. With a single
  // measure the chart is named in prose: a one-tab tab bar cannot be used.
  const chartHead =
    measures.length > 1
      ? `<div class="ap-tabs ins-cockpitb-read__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="Measure" data-ins-tablist>${measures
          .map(
            (
              m,
            ) => `<button type="button" class="ap-tabs-tab ${m === shown ? "active" : ""}" role="tab" id="ins-mtab-${esc(m.id)}"
              aria-controls="ins-mpanel" aria-selected="${m === shown}" tabindex="${m === shown ? 0 : -1}"
              data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}"><span>${esc(m.metricLabel)}</span></button>`,
          )
          .join("")}</div></div>`
      : `<p class="ins-chart__name">${esc(shown?.metricLabel || "Trend")}${shown?.scopeLabel ? ` <span class="ins-muted">· ${esc(shown.scopeLabel)}</span>` : ""}</p>`;

  const overlay = entry.collecting
    ? `<div class="ins-chart-overlay">
        <span class="ap-status grey">Collecting</span>
        <span class="ins-muted">day ${entry.grace?.day ?? 1} of ${entry.grace?.of ?? 7}</span>
      </div>`
    : "";
  const parkedNote = entry.parked ? proxyNote(entry) : "";

  const head = entry.headline;
  const targetName = head?.isRate ? "hold above" : "target";

  const rows = measures
    .map((m, i) => {
      const sparkId = `cockpitb-mspark-${i}`;
      if (m.series) specs.set(sparkId, sparklineSpec(m.series, { tier: m.tier, height: 30 }));
      return `<tr${m === shown ? ' class="selected"' : ""}>
        <th scope="row">
          <span class="ins-cockpitb-table__metric">${esc(m.metricLabel)}${m.proxy ? ` <span class="ap-badge blue">proxy</span>` : ""}</span>
          <span class="ins-muted">${esc(m.scopeLabel || "All networks")}</span>
        </th>
        <td class="right ins-num">${esc(m.currentLabel)}</td>
        <td class="right ins-num">${esc(m.targetLabel)}</td>
        <td class="ins-cockpitb-table__bar">
          ${progressBar(m.progress, m.tier, { pending: m.progress == null })}
          <span class="ins-num">${m.progress == null ? "—" : `${m.progress}%`}</span>
        </td>
        <td>${trendGlyph(m)}</td>
        <td class="ins-cockpitb-table__spark">${m.series ? `<span class="ins-chart__node" data-ins-chart="${sparkId}" style="height:30px"></span>` : ""}</td>
        <td>${measurePill(m)}</td>
      </tr>`;
    })
    .join("");

  // The figures and the curve share ONE card here, side by side. Cockpit stacks
  // them because its pane is half a page wide; at full width a row of three
  // numerals across 1240px is a band of air, and putting the score beside the
  // chart is what keeps "where it stands" and "how it got there" on the first
  // screen now that the band takes the top of it.
  // ONE wrapper holds the column, instead of every child capping and centring
  // itself: with the cap on each child, the reading paragraph — the only one
  // with a measure of its own — resolved its auto margins against the pane and
  // landed 34px left of the cards. The column is a box now, and everything in
  // it starts where the box starts.
  return `<main class="ins-cockpitb-pane">
    <div class="ins-cockpitb-pane__inner${firstPaint ? " ins-reveal" : ""}">
    <header class="ins-cockpitb-pane__head">
      <div class="ins-cockpitb-pane__titles">
        <div class="ins-cockpitb-pane__title"><h2>${esc(entry.label)}</h2>${statusPill(entry)}</div>
        <p class="ins-cockpitb-pane__meta">${originMark(entry)} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(entry))} <span class="ins-dot" aria-hidden="true">·</span> ${measures.length} measure${measures.length === 1 ? "" : "s"}</p>
      </div>
      ${objectiveActions(entry)}
    </header>
    <p class="ins-cockpitb-pane__reading">${esc(readingFor(entry))}</p>
    ${parkedNote}

    <section class="ap-card ins-cockpitb-read">
      <div class="ins-cockpitb-read__figures">
        ${scoreFigure(entry, { size: "xl" })}
        <div class="ins-cockpitb-read__pair">
          ${figure(esc(head?.currentLabel || "—"), "current")}
          ${figure(esc(head?.targetLabel || "—"), targetName)}
        </div>
      </div>
      <div class="ins-cockpitb-read__chart">
        ${chartHead}
        <div class="ins-chart ins-chart--cockpitb" id="ins-mpanel" role="tabpanel" aria-labelledby="ins-mtab-${esc(shown?.id || "")}">
          ${shown?.series ? `<div class="ins-chart__node" data-ins-chart="${chartId}" style="height:${CHART_HEIGHT}px"></div>` : `<p class="ins-posts-empty">No series for this measure.</p>`}
          ${overlay}
        </div>
      </div>
    </section>

    <section class="ap-card ins-cockpitb-card">
      <h3 class="ins-section-title">Measures</h3>
      <table class="ap-table small ins-cockpitb-table">
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
    </section>

    <section class="ap-card ins-cockpitb-card">
      <h3 class="ins-section-title">Posts drafted with Archie <span class="ap-counter normal grey">${entry.posts.length}</span></h3>
      ${entry.posts.length ? `<div class="ins-postlist">${entry.posts.map((p) => postCard(p, entry)).join("")}</div>` : postsEmpty()}
    </section>
    </div>
  </main>`;
}
