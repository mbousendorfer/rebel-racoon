// ---- Insights · Mob · Index — the index, then the fiche ------------------------
//
// TWO LEVELS, no selector at all: a full-width index of every objective, and the
// one you click read at the page's full width behind a crumb. It is the shape
// every analytics product with goals in it ships — Asana, Monarch, Customer.io,
// Deel, HubSpot, Charma, TheyDo — and the only one of the six lectures here that
// still works at ten objectives with history behind them.
//
// WHY it exists: Cockpit spends a 340px column of full viewport height on a list
// of two or three, next to the app's own rail. This one asks whether the
// selector has to be on screen AT ALL while you read. Nothing else on the page competes with the objective once it
// is open, and the index gets the whole width to be a table instead of a gutter.
//
// ⚠️ THE INDEX IS A GRID OF CARDS. It was a TABLE, twice, and this file said in
// as many words that it had to stay one — "not a mosaic of tiles", because a
// board of tiles was built here once (Bento) and cut: "at a glance is not how
// anyone reads an objective, and the board turned every measure into a number
// without its curve" (shell.js).
//
// The user overruled that on 2026-09-11, twice, the second time flatly: "le
// tableau n'est définitivement pas la bonne représentation". A table of eight
// 14px columns is a database read — it hierarchises nothing, the objective's
// name weighs exactly what the six figures beside it weigh, and no amount of
// row rhythm or column merging fixes that (both were tried in the commit
// before this one).
//
// WHAT MAKES THIS NOT BENTO — the one thing that has to survive from the cut:
// **every card carries its CURVE**, `trendSpec` at 104px with `compact`, which
// keeps the dashed target line and the post markers and drops only the axis
// labels. That was the whole indictment of the tile board — "a number without
// its curve" — and it is answered, not ignored. Each card also carries the
// objective's one-line READING ("Reach is at 74% of target, down 8% over the
// window"), so the page answers *why* before anything is clicked. What Bento
// had and this doesn't: tiles of equal weight fighting each other, and no
// trajectory anywhere.
//
// No KPI strip above the grid, Deel-style: `tierCounts` in the head already
// says On track / At risk / Off track, and a band restating those three numbers
// is exactly the fault that got Report's ring row cut. The head carries WEIGHT
// instead (brand + counts on one line, the shared "N posts drafted" sentence)
// and not one new figure.
//
// No outer card around the grid either — a card inside a card is nested
// elevation, and the section title does that job for free.
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
} from "../pieces.js?v=1115";
import { progressBar, trendSpec, mountCharts } from "../charts.js?v=1115";
import { shownMeasure, readHead, readReading, readout, readMeasures, readPosts } from "../read.js?v=1115";

export const id = "mob_index";
export const label = "Mob · Index";
export const title = "Mob · Index — an index of objectives, one opened at full width";
export const icon = "ap-icon-view-table";

const CHART_HEIGHT = 300;
// The row's curve. Tall enough to read a trajectory off — a 28px sparkline is
// a smudge — and short enough that four rows and the head still fit one
// screen. 72 was tried first: the rows came out at ~110px, which made the page
// compact AND left two thirds of it empty, which is the complaint this screen
// started from. A row that breathes is also a curve you can read.
const ROW_CHART_HEIGHT = 96;

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
      // The curve, at row scale: `compact` drops the axis labels and the
      // gridlines but KEEPS the dashed target line and the post markers — the
      // two things that make it a reading and not a decoration.
      const chartId = `mobindex-row-${i}`;
      if (m?.series) {
        specs.set(
          chartId,
          trendSpec(m.series, {
            tier: e.tier,
            metricLabel: m.metricLabel,
            height: ROW_CHART_HEIGHT,
            compact: true,
          }),
        );
      }

      // ── The figure zone: the comparator ─────────────────────────────────
      // The percentage, and a bar as its underline. NO RING: in a single
      // column the figures line up under each other, so the numeral IS the
      // comparator — 74 / 82 / 84 / 84 read down the page — and four 88px
      // rings in a column is weight spent on what the alignment already does.
      // Dropping it also ends the last duplication on this surface: the ring
      // printed the same percentage the text beside it printed.
      const figure = e.collecting
        ? `<span class="ins-mob_index__pending">${e.grace?.day ?? 1}<span class="ins-mob_index__unit">/${e.grace?.of ?? 7}</span></span>
           <span class="ins-mob_index__figlabel">days collected</span>`
        : `<span class="ins-mob_index__pct">${e.progress}<span class="ins-mob_index__unit">%</span></span>
           ${progressBar(e.progress, e.tier)}
           <span class="ins-mob_index__figlabel">of target</span>`;

      // ── The measure zone: what the figure is OF ──────────────────────────
      // The metric named in text — a figure without its metric named is
      // unreadable — then its two operands and the move.
      const measure = e.collecting
        ? `<span class="ins-mob_index__metric">${esc(m?.metricLabel || "No measure yet")}</span>
           <span class="ins-muted">${esc(e.soon || "Filling its first window")}</span>`
        : `<span class="ins-mob_index__metric">${esc(m?.metricLabel || "—")}</span>
           <span class="ins-mob_index__figs">
             <span class="ins-mob_index__pair"><span class="ins-num">${esc(m?.currentLabel || "—")}</span><span class="ins-mob_index__to" aria-hidden="true">→</span><span class="ins-num ins-mob_index__target">${esc(m?.targetLabel || "—")}</span></span>
             ${m ? trendGlyph(m) : ""}
           </span>`;

      return `<article class="ap-card ins-mob_index__row" data-ins-select="${esc(e.key)}" data-ins-objective="${esc(e.key)}">
        <div class="ins-mob_index__ident">
          <button type="button" class="ins-mob_index__name" data-ins-select="${esc(e.key)}">${esc(e.label)}</button>
          <span class="ins-mob_index__sub">${originMark(e, { short: true })} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(e))}</span>
        </div>

        <div class="ins-mob_index__figure">${figure}</div>

        <div class="ins-mob_index__measure">${measure}</div>

        <div class="ins-mob_index__curve">
          ${m?.series ? `<span class="ins-chart__node" data-ins-chart="${chartId}" style="height:${ROW_CHART_HEIGHT}px"></span>` : ""}
        </div>

        <div class="ins-mob_index__verdict">
          ${statusPill(e)}
          ${
            e.parked && e.soon
              ? `<span class="ins-mob_index__soon" title="${esc(e.soon)}"><i class="ap-icon-warning_fill ap-icon-sm" aria-hidden="true"></i></span>`
              : ""
          }
        </div>

        <i class="ap-icon-chevron-right ins-mob_index__go" aria-hidden="true"></i>
      </article>`;
    })
    .join("");

  // The verdict counts sit with the LIST, not in the page header: they count the
  // rows below them, so they belong to the row that names those rows
  // ("Objectives 4") rather than to the row that names the brand.
  //
  // What stays in the band is the brand and the one line saying the objectives
  // are being worked. Still NOT a KPI strip — no tile, no new figure, nothing
  // restated. See the note at the top.
  return `<header class="insights__band">
      <div class="insights__band-inner">
        ${playbookTitle(ctx)}
        ${postsMovedLine(rollup)}
      </div>
    </header>
    <div class="ins-mob_index">
      <div class="ins-mob_index__inner${firstPaint ? " ins-reveal" : ""}">
        <div class="ins-mob_index__listhead">
          <h3 class="ins-section-title">Objectives <span class="ap-counter normal grey">${entries.length}</span></h3>
          ${tierCounts(rollup)}
        </div>
        <div class="ins-mob_index__list">${rows}</div>
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
      ${readMeasures(entry, shown, specs, { idPrefix: "mobindex", chartId: "mobindex-trend", height: CHART_HEIGHT })}
      ${readPosts(entry)}
    </div>
  </div>`;
}
