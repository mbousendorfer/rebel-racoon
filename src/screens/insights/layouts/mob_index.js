// ---- Insights · Mob · Index — the index, then the fiche ------------------------
//
// TWO LEVELS, no selector at all: a full-width index of every objective, and the
// one you click read at the page's full width behind a crumb. It is the shape
// every analytics product with goals in it ships — Asana, Monarch, Customer.io,
// Deel, HubSpot, Charma, TheyDo — and the only one of the six lectures here that
// still works at ten objectives with history behind them.
//
// WHY it exists: Cockpit spends a 340px column of full viewport height on a list
// of two or three, next to the app's own rail. Cockpit bis rotated that selector
// into a band; this one asks whether the selector has to be on screen AT ALL
// while you read. Nothing else on the page competes with the objective once it
// is open, and the index gets the whole width to be a table instead of a gutter.
//
// ⚠️ The index is a TABLE, not a mosaic of tiles. A board of tiles was built
// here once — Bento — and cut: "at a glance is not how anyone reads an
// objective, and the board turned every measure into a number without its
// curve" (shell.js). The defence of a table is that it is not the reading
// surface: it is the door, and every measure keeps its full-size curve one click
// behind it. A row compares, the fiche explains.
//
// No KPI strip above the table either, Deel-style: `tierCounts` in the head
// already says On track / At risk / Off track, and a band of tiles restating
// those three numbers is exactly the fault that got Report's ring row cut.
// That rule still holds after the legibility pass below: the head gained WEIGHT
// (brand + counts on one line, the shared "N posts drafted" sentence under it)
// and not a single new figure.
//
// What the row gained instead is its TRAJECTORY — the headline measure's
// sparkline, 120px, tier-coloured, the same helper the fiche's Measures table
// uses. It is the answer to the objection that killed Bento ("it turned every
// measure into a number without its curve") in the one place a table can take
// it: two objectives at 84% are not the same objective if one climbs and the
// other sags, and no figure in the row carries that. Current and Target became
// ONE cell for the same reason — they only mean anything as a pair, and two
// right-aligned columns made the eye bridge white space to read it.
//
// The two states key off `?objective=` — which `shell.js` hands over as
// `selectedKey`, already nullable. So "nothing selected" is a state this layout
// gets for free, and a link still lands straight on a fiche.
//
// The brand switcher lives on the INDEX only, deliberately. `playbookTitle` is
// the app's only door to the scope outside workspace mode (pieces.js), and the
// fiche is one permanently visible crumb away from it — the same escape Asana
// and Monarch give their goal pages. A second switcher on the fiche would be two
// controls that can disagree, which is the failure that note warns about.

import {
  playbookTitle,
  tierCounts,
  statusPill,
  originMark,
  windowLine,
  trendGlyph,
  postsMovedLine,
  esc,
} from "../pieces.js?v=1102";
import { progressBar, sparklineSpec, mountCharts } from "../charts.js?v=1102";
import { shownMeasure, readHead, readReading, readout, readChart, readMeasures, readPosts } from "../read.js?v=1102";

export const id = "mob_index";
export const label = "Mob · Index";
export const title = "Mob · Index — an index of objectives, one opened at full width";
export const icon = "ap-icon-view-table";

const CHART_HEIGHT = 300;

export function render(host, vm) {
  const { entries, rollup, ctx, selectedKey, local, firstPaint } = vm;
  const selected = selectedKey ? entries.find((e) => e.key === selectedKey) : null;
  const specs = new Map();

  host.innerHTML = selected
    ? renderFiche(selected, local, specs, firstPaint)
    : renderIndex(entries, rollup, ctx, specs, firstPaint);

  mountCharts(host, specs);
  return () => {};
}

// ── The index ─────────────────────────────────────────────────────────────

function renderIndex(entries, rollup, ctx, specs, firstPaint) {
  // Worst first — the order `model.js` already returns, so the objective asking
  // for attention is the first row and not the first one declared.
  const rows = entries
    .map((e, i) => {
      const m = e.headline;
      // The curve, IN the index. This is the answer to the objection that
      // killed the Bento board — "it turned every measure into a number without
      // its curve" — and it is why a table can be the door: a row compares, and
      // a 120px trajectory is the one part of the comparison a number can't
      // carry. Same helper, same tier colour as the fiche's Measures table.
      const sparkId = `mobindex-row-spark-${i}`;
      if (m?.series) specs.set(sparkId, sparklineSpec(m.series, { tier: e.tier, height: 28 }));
      // Current and Target were two right-aligned columns with a gap of white
      // between them, so the eye had to bridge them to read the one fact they
      // make together. One cell, one arrow, the sentence the fiche's measure
      // rows already write: 14,800 → 20,000.
      const pair =
        m && (m.currentLabel || m.targetLabel)
          ? `<span class="ins-num">${esc(m.currentLabel || "—")}</span>
             <span class="ins-mob_index__to" aria-hidden="true">→</span>
             <span class="ins-num ins-mob_index__target">${esc(m.targetLabel || "—")}</span>`
          : `<span class="ins-num">—</span>`;
      return `<tr class="ins-mob_index__row" data-ins-select="${esc(e.key)}" data-ins-objective="${esc(e.key)}">
        <th scope="row">
          <button type="button" class="ins-mob_index__name" data-ins-select="${esc(e.key)}">${esc(e.label)}</button>
          <span class="ins-mob_index__sub">${originMark(e, { short: true })} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(e))}</span>
          ${e.parked && e.soon ? `<span class="ins-mob_index__soon"><i class="ap-icon-warning_fill ap-icon-sm" aria-hidden="true"></i>${esc(e.soon)}</span>` : ""}
        </th>
        <td class="ins-mob_index__bar">
          <span class="ins-mob_index__barrow">
            ${progressBar(e.progress, e.tier, { pending: e.collecting })}
            <span class="ins-num">${e.collecting ? "—" : `${e.progress}%`}</span>
          </span>
        </td>
        <td class="ins-mob_index__pair">${pair}</td>
        <td class="ins-mob_index__spark">${m?.series ? `<span class="ins-chart__node" data-ins-chart="${sparkId}" style="height:28px"></span>` : ""}</td>
        <td>${m ? trendGlyph(m) : ""}</td>
        <td class="ins-num">${e.counts.measures}</td>
        <td>${statusPill(e)}</td>
        <td class="ins-mob_index__go"><i class="ap-icon-chevron-right" aria-hidden="true"></i></td>
      </tr>`;
    })
    .join("");

  // The head is the page's header, so it is built like one: the brand and its
  // verdict counts on ONE line (they answer "where am I" and "how is it going",
  // which is one question asked twice when they are stacked), and under it the
  // one line that says the objectives are being worked. NOT a KPI strip — no
  // tile, no new figure, nothing restated. See the note at the top of this file.
  return `<header class="insights__band">
      <div class="insights__band-inner">
        <div class="ins-mob_index__titles">
          ${playbookTitle(ctx)}
          ${tierCounts(rollup)}
        </div>
        ${postsMovedLine(rollup)}
      </div>
    </header>
    <div class="ins-mob_index">
      <div class="ins-mob_index__inner${firstPaint ? " ins-reveal" : ""}">
        <section class="ap-card ins-mob_index__card">
          <h3 class="ins-section-title">Objectives <span class="ap-counter normal grey">${entries.length}</span></h3>
          <table class="ap-table ins-mob_index__table">
            <thead>
              <tr>
                <th scope="col">Objective</th>
                <th scope="col">Progress</th>
                <th scope="col">Current → target</th>
                <th scope="col">Trajectory</th>
                <th scope="col">Trend</th>
                <th scope="col">Measures</th>
                <th scope="col">State</th>
                <th scope="col"><span class="ins-visually-hidden">Open</span></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      </div>
    </div>`;
}

// ── The fiche ─────────────────────────────────────────────────────────────
//
// The crumb is the whole point of the level above: it is the only way back, the
// topbar carrying none. Ghost grey, so it reads as navigation and not as one of
// the objective's own verbs sitting two rows below it.

function renderFiche(entry, local, specs, firstPaint) {
  const shown = shownMeasure(entry, local);
  return `<div class="ins-mob_index">
    <div class="ins-mob_index__inner${firstPaint ? " ins-reveal" : ""}" data-ins-objective="${esc(entry.key)}">
      <div class="ins-mob_index__crumb">
        <button type="button" class="ap-button ghost grey" data-ins-unselect>
          <i class="ap-icon-chevron-left" aria-hidden="true"></i><span>Objectives</span>
        </button>
      </div>
      ${readHead(entry)}
      ${readReading(entry)}
      ${readout(entry)}
      ${readChart(entry, shown, specs, { id: "mobindex-trend", height: CHART_HEIGHT })}
      ${readMeasures(entry, shown, specs, { idPrefix: "mobindex" })}
      ${readPosts(entry)}
    </div>
  </div>`;
}
