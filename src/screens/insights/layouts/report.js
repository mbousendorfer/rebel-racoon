// ---- Insights · Report — the monthly read -------------------------------------
//
// ONE objective at a time, chosen from a tab strip, read top to bottom the way
// an editorial page is: a headline (the objective and its verdict), a
// standfirst (the one-line reading), then the evidence — the number and its
// measures on the left, the curve on the right — the posts that moved it, and
// Archie's recommendation beside the two doors.
//
// Best for: understanding one objective. The reader who wants to know what
// happened and why, without a page that grows a screenful per objective.
//
// It used to stack every objective as a chapter down one page. Three objectives
// made it four screens tall, and the reader scrolled past two of them to reach
// the third — so the objectives became TABS. The tab strip doubles as the index
// the hero was reaching for, which is why the hero has no summary of its own
// beyond the counts.
//
// The hero says things ONCE, in the order they are asked: what page is this
// (the title), for which brand (the scope select), how do things stand (the
// counts), which objective am I reading (the tabs).
//
// It has been through two wrong versions. First an average-progress gauge, which
// averaged a clicks percentage with a mentions percentage and so measured
// nothing. Then a row of progress RINGS, one per objective — repeating each
// chapter's own verdict 60px above it, and encoding "how far along" as an arc
// nobody can compare, with the real work done by the number printed inside.

import { rollupSentence, readingFor } from "../model.js?v=1054";
import { trendSpec, mountCharts } from "../charts.js?v=1054";
import {
  tierCounts,
  statusPill,
  originMark,
  windowLine,
  scoreFigure,
  measureRow,
  postCard,
  postsEmpty,
  proxyNote,
  objectiveActions,
  esc,
} from "../pieces.js?v=1054";

export const id = "report";
export const label = "Report";
export const title = "Report — one chapter per objective, read top to bottom";
export const icon = "ap-icon-file--text";

const CHART_HEIGHT = 280;

export function render(host, vm) {
  const { entries, rollup, local, selectedKey, firstPaint } = vm;
  const specs = new Map();
  // Worst-first ordering means the default tab is the objective asking for
  // attention, not the first one declared.
  const shown = entries.find((e) => e.key === selectedKey) || entries[0];

  host.innerHTML = `<div class="ins-report${firstPaint ? " ins-reveal" : ""}">
    ${renderHero(entries, rollup, shown)}
    ${renderChapter(shown, local, specs)}
  </div>`;

  mountCharts(host, specs);
  return () => {};
}

// ── Hero ──────────────────────────────────────────────────────────────────

function renderHero(entries, rollup, shown) {
  const posts = rollup.posts;
  return `<header class="ap-card ins-report-hero">
    <div class="ins-report-hero__titles">
      <h1 class="ins-report-hero__title">Objectives</h1>
      ${tierCounts(rollup)}
    </div>
    ${
      posts
        ? `<p class="ins-report-hero__note">${posts} post${posts === 1 ? "" : "s"} drafted with Archie moved them over the window.</p>`
        : ""
    }
    ${renderTabs(entries, shown)}
  </header>`;
}

// The tab strip — the page's index AND its navigation. Each tab carries its
// objective's verdict, because a strip of names alone would make the reader open
// all of them to find the one in trouble.
//
// It carries it as an ICON, in the DS tab's own icon slot (`.ap-tabs-tab > i`),
// not as a coloured dot: the dot was a re-implementation of the Status pill's
// ::before, and a third adornment on a component whose API is a label, an
// optional counter and an optional icon.
//
// The strip ends with "New objective", flush against the last tab and reading as
// one of them, because the strip is the list of objectives and the way you add
// to a list is at its end. It is NOT inside the tablist: a role="tablist" owns
// tabs, and a button among them is invalid ARIA that also broke the arrow-key
// traversal — so it is a sibling of the nav, wearing the tab's own class and
// sitting on the same track line. Blue, because it is a control and not a tab
// that can be selected; the page bar's primary stays where it is.
const TAB_GLYPH = {
  "on-track": "ap-icon-rounded-check_fill",
  "at-risk": "ap-icon-warning_fill",
  "off-track": "ap-icon-error_fill",
  collecting: "ap-icon-info_fill",
};

function renderTabs(entries, shown) {
  const tabs = entries
    .map(
      (e) => `<button type="button" class="ap-tabs-tab ins-report-tab ${e === shown ? "active" : ""}"
        role="tab" id="ins-tab-${esc(e.key)}" aria-controls="ins-panel-${esc(e.key)}"
        aria-selected="${e === shown}" tabindex="${e === shown ? 0 : -1}" data-ins-select="${esc(e.key)}">
        <i class="${TAB_GLYPH[e.tier] || TAB_GLYPH.collecting}" aria-hidden="true"></i>
        <span>${esc(e.label)}</span>
        <span class="ins-visually-hidden"> — ${esc(e.tierLabel)}</span>
      </button>`,
    )
    .join("");
  return `<div class="ins-report-tabsrow">
    <div class="ap-tabs ins-report-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Objectives" data-ins-tablist>${tabs}</div>
    </div>
    <button type="button" class="ap-tabs-tab ins-report-addtab" data-ins-new>
      <i class="ap-icon-plus" aria-hidden="true"></i><span>New objective</span>
    </button>
  </div>`;
}

// ── Chapter ───────────────────────────────────────────────────────────────

// The chapter is the tab's panel — role="tabpanel", wired to its tab — but NOT
// `.ap-tabs-panel`: that class is `display:none` until `.active`, because the DS
// renders every panel and toggles them. Only the selected objective is rendered
// here, so the class would hide the only panel there is (it did) and `.active`
// on a permanently-visible element says nothing.
function renderChapter(entry, local, specs) {
  const measures = entry.measures;
  const tabId = local.measureTab[entry.key];
  const shown = measures.find((m) => m.id === tabId) || entry.headline || measures[0];
  const chartId = `report-${shown?.id || "none"}`;
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

  // The measure switcher only exists when there is something to switch to. With
  // one measure the chart is named in prose instead — a one-tab tab bar is a
  // control that cannot be used.
  const chartHead =
    measures.length > 1
      ? `<div class="ap-tabs ins-report-chapter__tabs"><div class="ap-tabs-nav" role="tablist">${measures
          .map(
            (
              m,
            ) => `<button type="button" class="ap-tabs-tab ${m === shown ? "active" : ""}" role="tab" aria-selected="${m === shown}"
              data-ins-measure-tab="${esc(entry.key)}" data-ins-measure="${esc(m.id)}"><span>${esc(m.metricLabel)}</span></button>`,
          )
          .join("")}</div></div>`
      : `<p class="ins-chart__name">${esc(shown?.metricLabel || "")}${shown?.scopeLabel ? ` <span class="ins-muted">· ${esc(shown.scopeLabel)}</span>` : ""}</p>`;

  // The pill says the state in a word; the day count is prose beside it. A
  // sentence inside .ap-status is the component's own documented Don't.
  const overlay = entry.collecting
    ? `<div class="ins-chart-overlay">
        <span class="ap-status grey">Collecting</span>
        <span class="ins-muted">day ${entry.grace?.day ?? 1} of ${entry.grace?.of ?? 7}</span>
      </div>`
    : "";
  // A state that needs a sentence of context, scoped to THIS objective and not
  // dismissible: that is the Status card, not a Tag (whose colours name an
  // object type, never a state, and whose tagOrange already means Listening
  // keywords), and not an Infobox (page-level and dismissible).
  const parkedNote = entry.parked ? proxyNote(entry) : "";

  const n = measures.length;
  return `<article class="ap-card ins-report-chapter" role="tabpanel" id="ins-panel-${esc(entry.key)}"
    aria-labelledby="ins-tab-${esc(entry.key)}" tabindex="0" data-ins-objective="${esc(entry.key)}">
    <header class="ins-report-chapter__head">
      <div class="ins-report-chapter__headline">
        <h2 class="ins-report-chapter__title">${esc(entry.label)}</h2>
        ${statusPill(entry)}
        <p class="ins-report-chapter__meta">${originMark(entry)} <span class="ins-dot" aria-hidden="true">·</span> ${esc(windowLine(entry))} <span class="ins-dot" aria-hidden="true">·</span> ${n} measure${n === 1 ? "" : "s"}</p>
      </div>
      <p class="ins-report-chapter__reading">${esc(readingFor(entry))}</p>
    </header>
    <div class="ins-report-chapter__grid">
      <div class="ins-report-chapter__aside">
        ${scoreFigure(entry, { size: "xl" })}
        <div class="ins-report-chapter__measures">
          <h3 class="ins-report-chapter__measureslabel">${n === 1 ? "Its measure" : "Its measures"}</h3>
          ${measures.map((m) => measureRow(m)).join("")}
        </div>
      </div>
      <div class="ins-report-chapter__chart">
        ${chartHead}
        <div class="ins-chart ins-chart--report">
          ${shown?.series ? `<div class="ins-chart__node" data-ins-chart="${chartId}" style="height:${CHART_HEIGHT}px"></div>` : `<p class="ins-posts-empty">No series for this measure.</p>`}
          ${overlay}
        </div>
        ${parkedNote}
      </div>
    </div>
    <div class="ap-divider" role="presentation"></div>
    <section class="ins-report-chapter__posts">
      <h3 class="ins-section-title">Posts drafted with Archie <span class="ap-counter normal grey">${entry.posts.length}</span></h3>
      ${entry.posts.length ? `<div class="ins-postlist">${entry.posts.map((p) => postCard(p, entry)).join("")}</div>` : postsEmpty()}
    </section>
    <div class="ap-divider" role="presentation"></div>
    <footer class="ins-report-chapter__foot">
      <p class="ins-report-chapter__pitch">
        <i class="ap-icon-archie-official ap-icon-mini-sm" aria-hidden="true"></i>
        <span>${esc(entry.nextMove?.pitch || "")}</span>
      </p>
      ${objectiveActions(entry)}
    </footer>
  </article>`;
}
