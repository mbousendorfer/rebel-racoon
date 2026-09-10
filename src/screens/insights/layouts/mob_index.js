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

import { playbookTitle, tierCounts, statusPill, originMark, windowLine, trendGlyph, esc } from "../pieces.js?v=1093";
import { progressBar, mountCharts } from "../charts.js?v=1093";
import { shownMeasure, readHead, readReading, readout, readChart, readMeasures, readPosts } from "../read.js?v=1093";

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
    .map((e) => {
      const m = e.headline;
      return `<tr class="ins-mob_index__row" data-ins-select="${esc(e.key)}" data-ins-objective="${esc(e.key)}">
        <th scope="row">
          <button type="button" class="ins-mob_index__name" data-ins-select="${esc(e.key)}">${esc(e.label)}</button>
          <span class="ins-mob_index__sub">${originMark(e, { short: true })} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(e))}</span>
          ${e.parked && e.soon ? `<span class="ins-mob_index__soon"><i class="ap-icon-warning_fill ap-icon-sm" aria-hidden="true"></i>${esc(e.soon)}</span>` : ""}
        </th>
        <td class="ins-mob_index__bar">
          ${progressBar(e.progress, e.tier, { pending: e.collecting })}
          <span class="ins-num">${e.collecting ? "—" : `${e.progress}%`}</span>
        </td>
        <td class="right ins-num">${esc(m?.currentLabel || "—")}</td>
        <td class="right ins-num">${esc(m?.targetLabel || "—")}</td>
        <td>${m ? trendGlyph(m) : ""}</td>
        <td class="ins-num">${e.counts.measures}</td>
        <td>${statusPill(e)}</td>
        <td class="ins-mob_index__go"><i class="ap-icon-chevron-right" aria-hidden="true"></i></td>
      </tr>`;
    })
    .join("");

  return `<header class="insights__band">
      <div class="insights__band-inner">
        ${playbookTitle(ctx)}
        ${tierCounts(rollup)}
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
                <th scope="col" class="right">Current</th>
                <th scope="col" class="right">Target</th>
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
