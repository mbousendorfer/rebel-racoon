// ---- Insights · Mob · Band — the figures beside the curve ----------------------
//
// One page, and the answer to the grief that opened this whole series taken at
// its narrowest: the numbers do NOT need a column of their own down the side of
// the page, they need to sit next to the thing that explains them. Front is the
// one reference that puts metrics in a narrow column and refuses to give it the
// full height — a "Key metrics" card at a third, the curve at two thirds, one
// band, and the table underneath. Adaline does the same with its header row.
//
// So this lecture changes the ARRANGEMENT and nothing else: no rail, no band of
// tiles, no right-hand column. The objectives are a tab strip — the same
// primitive Report uses, because a strip of 3 to 5 names is what `.ap-tabs` is
// the DS component for — and everything under it is one objective, read with
// "where it stands" and "how it got there" side by side on the first screen.
//
// What is new here is the band, not the selector. Said plainly because the two
// are easy to confuse when comparing six lectures: Report's tabs pick a chapter
// that then runs top to bottom with the figures in an aside; these tabs pick an
// objective whose figures and curve share one row at the top.

import { playbookTitle, tierCounts, objectiveActions, esc } from "../pieces.js?v=1102";
import { mountCharts } from "../charts.js?v=1102";
import { shownMeasure, readReading, readFigures, readChart, readMeasures, readPosts } from "../read.js?v=1102";

export const id = "mob_band";
export const label = "Mob · Band";
export const title = "Mob · Band — the figures beside the curve, one objective at a time";
export const icon = "ap-icon-line-graph";

const CHART_HEIGHT = 280;

// The verdict as an icon in the DS tab's own icon slot — a strip of names alone
// would make the reader open every objective to find the one in trouble. Same
// four glyphs Report's strip carries (its own copy is in report.js; the two are
// separate on purpose, so a lecture can be deleted without touching another).
const TAB_GLYPH = {
  "on-track": "ap-icon-rounded-check_fill",
  "at-risk": "ap-icon-warning_fill",
  "off-track": "ap-icon-error_fill",
  collecting: "ap-icon-info_fill",
};

export function render(host, vm) {
  const { entries, rollup, ctx, selectedKey, local, firstPaint } = vm;
  const selected = entries.find((e) => e.key === selectedKey) || entries[0];
  const shown = shownMeasure(selected, local);
  const specs = new Map();

  host.innerHTML = `${renderHead(entries, rollup, ctx, selected)}
    <div class="ins-mob_band">
      <div class="ins-mob_band__inner${firstPaint ? " ins-reveal" : ""}" id="ins-oread" role="tabpanel"
        aria-labelledby="ins-otab-${esc(selected.key)}" data-ins-objective="${esc(selected.key)}">
        ${readReading(selected)}
        <section class="ins-mob_band__band">
          <div class="ap-card ins-mob_band__figures">
            <h3 class="ins-section-title">Key figures</h3>
            ${readFigures(selected)}
          </div>
          ${readChart(selected, shown, specs, { id: "mobband-trend", height: CHART_HEIGHT })}
        </section>
        ${readMeasures(selected, shown, specs, { idPrefix: "mobband" })}
        ${readPosts(selected)}
      </div>
    </div>`;

  mountCharts(host, specs);
  return () => {};
}

// ── Head ──────────────────────────────────────────────────────────────────
//
// The Playbook's name (which IS the scope switcher), the counts, the objective's
// two verbs, then the strip. The counts stay here — unlike Cockpit bis, whose
// tiles put every verdict on screen and made a counts line a recount, a tab
// strip shows one objective's verdict as a glyph and none of the others' totals.
//
// "New objective" sits flush after the last tab and OUTSIDE the tablist: a
// role="tablist" owns tabs, and a button among them is invalid ARIA that also
// breaks the arrow-key traversal.

function renderHead(entries, rollup, ctx, selected) {
  const tabs = entries
    .map(
      (e) => `<button type="button" class="ap-tabs-tab ins-mob_band__tab ${e === selected ? "active" : ""}"
        role="tab" id="ins-otab-${esc(e.key)}" aria-controls="ins-oread"
        aria-selected="${e === selected}" tabindex="${e === selected ? 0 : -1}" data-ins-select="${esc(e.key)}">
        <i class="${TAB_GLYPH[e.tier] || TAB_GLYPH.collecting}" aria-hidden="true"></i>
        <span>${esc(e.label)}</span>
        <span class="ins-visually-hidden"> — ${esc(e.tierLabel)}</span>
      </button>`,
    )
    .join("");

  return `<header class="insights__band">
    <div class="insights__band-inner ins-mob_band__head">
      <div class="ins-mob_band__headrow">
        <div class="ins-mob_band__titles">
          ${playbookTitle(ctx)}
          ${tierCounts(rollup)}
        </div>
        ${objectiveActions(selected)}
      </div>
      <div class="ins-mob_band__tabsrow">
        <div class="ap-tabs ins-mob_band__tabs">
          <div class="ap-tabs-nav" role="tablist" aria-label="Objectives" data-ins-tablist>${tabs}</div>
        </div>
        <button type="button" class="ap-tabs-tab ins-mob_band__addtab" data-ins-new>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>New objective</span>
        </button>
      </div>
    </div>
  </header>`;
}
