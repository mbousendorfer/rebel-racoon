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
// width instead of height, and width is what a two-item list has to spare: each
// tile gets the room for its own reading (the percentage, what it is a
// percentage of, and a curve wide enough to read) instead of a 34px smudge.
//
// Best for: two or three objectives — which is every Playbook in the app. Past
// four the band wraps and starts scrolling, and Cockpit's rail is the better
// answer again; that is the comparison this layout exists to settle.
//
// What the tile deliberately does NOT carry: a progress ring or a bar beside
// the percentage. Report cut its ring row for encoding "how far along" as a
// shape nobody can compare with the real work done by the numeral printed
// inside it — a bar next to the same numeral is that critique again. The
// sparkline stays because it says something the numeral cannot (which way, and
// against the dashed target line), and the band is what finally makes it big
// enough to say it.

import { readingFor } from "../model.js?v=1052";
import { trendSpec, sparklineSpec, progressBar, mountCharts } from "../charts.js?v=1052";
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
} from "../pieces.js?v=1052";

export const id = "cockpit-bis";
export const label = "Cockpit bis";
export const title = "Cockpit bis — the objectives as a band, one read at full width";
export const icon = "ap-icon-view-cards";

const CHART_HEIGHT = 280;
const SPARK_HEIGHT = 44;

export function render(host, vm) {
  const { entries, selectedKey, local, firstPaint } = vm;
  const selected = entries.find((e) => e.key === selectedKey) || entries[0];
  const specs = new Map();

  host.innerHTML = `<div class="ins-cockpitb">
    ${renderStrip(entries, selected, specs)}
    ${renderPane(selected, local, specs, firstPaint)}
  </div>`;

  mountCharts(host, specs);
  return () => {};
}

// ── The band ──────────────────────────────────────────────────────────────
//
// One tile per objective, equal columns, so the percentages and the curves line
// up and can be read against each other — which is the one thing a stacked rail
// of 34px sparklines could not do.
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

function renderStrip(entries, selected, specs) {
  const tiles = entries
    .map((e, i) => {
      const weak = e.headline;
      const sparkId = `cockpitb-spark-${i}`;
      if (weak?.series) {
        specs.set(
          sparkId,
          sparklineSpec(weak.series, {
            tier: e.collecting ? "collecting" : weak.tier,
            height: SPARK_HEIGHT,
          }),
        );
      }
      const on = e === selected;
      // The identity and the curve sit SIDE BY SIDE inside the tile, and wrap to
      // two rows only when the tile is too narrow for both (four objectives and
      // up). That is what keeps the band ~150px tall instead of 200: the width
      // the rotation buys is spent on the sparkline, not on a third row.
      return `<li>
        <button type="button" class="ins-cockpitb-tile${on ? " is-selected" : ""}" data-ins-select="${esc(e.key)}" data-ins-objective="${esc(e.key)}"${on ? ' aria-current="true"' : ""}>
          <span class="ins-cockpitb-tile__main">
            <span class="ins-cockpitb-tile__head">
              <span class="ins-cockpitb-tile__name">${esc(e.label)}</span>
              ${statusPill(e)}
            </span>
            ${scoreFigure(e, { size: "sm" })}
          </span>
          <span class="ins-cockpitb-tile__spark">
            ${weak?.series ? `<span class="ins-chart__node" data-ins-chart="${sparkId}" style="height:${SPARK_HEIGHT}px"></span>` : ""}
          </span>
        </button>
      </li>`;
    })
    .join("");

  return `<nav class="ins-cockpitb-strip" aria-label="Objectives">
    <div class="ins-cockpitb-strip__inner">
      <h1 class="ins-cockpitb-strip__title">Objectives</h1>
      <ul class="ins-cockpitb-strip__list">${tiles}</ul>
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
  return `<main class="ins-cockpitb-pane${firstPaint ? " ins-reveal" : ""}">
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
  </main>`;
}
