// /topics — the Topic Feed: a queue you triage, with the article beside it.
//
// ── Scope ──────────────────────────────────────────────────────────────────
// One Playbook at a time, carried in `?pb=`. NOT a global active-Playbook: the
// version this was ported from had a module that owned the app's scope, persisted
// it, and was written to by a select sitting in this page's filter bar — so a
// control that promised a page filter silently re-scoped the sidebar, the next
// new chat and the composer's picker. `?pb=` says the same thing, survives a
// link, and stops at this screen. The settings page reads the same param, so the
// scope survives the round trip in both directions.
//
// ── The layout ─────────────────────────────────────────────────────────────
// Master–detail, and the split is measured with a @container query on the row
// itself rather than a media query: the sidebar collapses and the right panel
// overlays, so viewport width never tells you content width.
//
// The list SHRINKS when the article opens. That is the fix for the port's worst
// bug: with the list pinned at a fixed 666px the article had nowhere to go under
// ~1180px of content width, so at 1440px of viewport — a 14" laptop — clicking a
// card rendered the article 1900px below the fold and nothing appeared to happen.
//
// ── Paging ─────────────────────────────────────────────────────────────────
// Ten at a time, and the last page's sentinel loads the next when it scrolls into
// view. There is an explicit Load more too, and both do exactly the same thing —
// an infinite list with no button is unusable by keyboard.

import { html, raw, escapeAttr } from "../utils.js?v=22";
import { navigate, getPath } from "../router.js?v=31";
import { isFlagOn } from "../feature-flags.js?v=21";
import { parseHashParams, setHashQuery } from "../url-state.js?v=6";
import { renderTopbar } from "../components/topbar.js?v=317";
import { showToast } from "../components/toast.js?v=21";
import { renderEmptyState } from "../components/empty-state.js?v=3";
import { getContexts, getContextById, getDefaultContext } from "../contexts-store.js?v=54";
import { getFeedForPlaybook, subscribe as subscribeFeeds } from "../topic-feeds-store.js?v=1";
import {
  getTopicsForFeed,
  groupTopicsByAge,
  getTopicById,
  topicTitle,
  defaultFilters,
  narrowedGroupCount,
  ignoreTopic,
  unignoreTopic,
  subscribe as subscribeTopics,
} from "../topics-store.js?v=1";
import {
  TOPIC_SOURCES,
  TOPIC_KINDS,
  REVIEW_STATUSES,
  findTopicSource,
  findCadence,
  isLiveSource,
} from "../topics-catalog.js?v=1";
import { renderTopicCard } from "../components/topic-card.js?v=1";
import { renderTopicArticle, renderTopicActions } from "../topic-article.js?v=1";
import { openIgnoreReason } from "../components/topic-ignore-modal.js?v=1";
import { useTopicInChat } from "../topic-flow.js?v=1";

const PAGE = 10;
// Long enough to read the scanning line, short enough that nobody waits for it
// in a demo. Same number the magazine used.
const SCAN_MS = 1600;

let view = null;
let unsubscribe = null;
let unsubscribeFeeds = null;
let boundRoot = null;
let observer = null;

function freshView() {
  return {
    segment: "ready",
    filters: defaultFilters(),
    page: 1,
    openTopicId: null,
    // The first Topic's article opens by itself ONCE. After the reader closes
    // it, it must not reopen on its own — this is the latch that guarantees it.
    autoOpened: false,
    menuTopicId: null,
    filtersOpen: false,
    scanning: true,
    loadingMore: false,
    // Set for exactly one paint, by the click that opened an article. When the
    // split has collapsed to a column the pane renders BELOW the list, which on
    // a long list is below the fold — so the click would look like it did
    // nothing, which is the whole bug this port had to fix. Scrolling it into
    // view is the honest answer for the stacked case; side by side the pane is
    // already visible and `block: "nearest"` then does nothing.
    revealPane: false,
  };
}

// ── Scope resolution ───────────────────────────────────────────────────────
// A `?pb=` naming a Playbook that no longer exists falls back to the default
// rather than emptying the screen with no explanation.
function scopedPlaybook() {
  const wanted = parseHashParams().get("pb");
  return (wanted && getContextById(wanted)) || getDefaultContext() || getContexts()[0] || null;
}

export function renderTopics(_params, target) {
  // Gated here rather than at the route table, so a stale deep link bounces to
  // the app's own landing rather than rendering a dead screen.
  if (!isFlagOn("topicFeed")) {
    navigate("/");
    return;
  }
  renderTopbar();
  const pb = scopedPlaybook();

  // Arriving on a link to one Topic: the article opens with the list, and the
  // status filter widens to EVERY state for that visit. An ignored Topic is not
  // in the default view, so without this the article would open onto a card the
  // list does not show.
  const deepTopicId = parseHashParams().get("topic");
  const deepTopic = deepTopicId ? getTopicById(deepTopicId) : null;

  teardown();
  view = freshView();
  if (deepTopic) {
    view.openTopicId = deepTopic.id;
    view.autoOpened = true;
    view.segment = deepTopic.kind;
    view.filters = { ...view.filters, statuses: REVIEW_STATUSES.map((s) => s.id) };
    // No scanning state on a Topic link: the reader came for one thing and a
    // working state would be theatre between them and it.
    view.scanning = false;
  }

  paint(target, pb);
  bind(target);

  if (view.scanning) {
    window.setTimeout(() => {
      if (!view) return;
      view.scanning = false;
      paint(target, scopedPlaybook());
    }, SCAN_MS);
  }

  unsubscribe = subscribeTopics(() => paint(target, scopedPlaybook()));
  unsubscribeFeeds = subscribeFeeds(() => paint(target, scopedPlaybook()));
  return teardown;
}

function teardown() {
  if (unsubscribe) (unsubscribe(), (unsubscribe = null));
  if (unsubscribeFeeds) (unsubscribeFeeds(), (unsubscribeFeeds = null));
  if (observer) (observer.disconnect(), (observer = null));
  boundRoot = null;
  view = null;
}

// ── Render ─────────────────────────────────────────────────────────────────

function paint(target, pb) {
  if (!view) return;
  // Scroll position survives every action: using or ignoring a Topic halfway
  // down the list must not throw the reader back to the top. The screen root is
  // the scroller, so its offset is what has to be restored across the repaint.
  const scroller = target.querySelector(".topics-view");
  const scrollTop = scroller ? scroller.scrollTop : 0;

  target.innerHTML = html`<section class="screen topics-view">${raw(renderPage(pb))}</section>`;

  const next = target.querySelector(".topics-view");
  if (next && scrollTop) next.scrollTop = scrollTop;

  if (view.revealPane) {
    view.revealPane = false;
    revealPane(next, target.querySelector(".topics-view__pane"));
  }

  watchSentinel(target, pb);
}

// Bring the article into view, but only when it is actually out of it.
//
// Deliberately arithmetic rather than scrollIntoView(): "nearest" declined to
// move a pane 1700px down the page (the element is nearly as tall as the
// scrollport, so the browser reads it as already nearest), and "smooth" raced
// the next repaint — a store notification lands within the animation and the
// scroll was silently abandoned. Setting scrollTop is deterministic.
//
// Side by side the pane is already on screen and this returns without touching
// anything, which is why the check is on visibility rather than on the layout
// mode: one rule, and it cannot disagree with what the container query decided.
function revealPane(scroller, pane) {
  if (!scroller || !pane) return;
  const scRect = scroller.getBoundingClientRect();
  const paneRect = pane.getBoundingClientRect();
  const hidden = paneRect.top >= scRect.bottom - 40 || paneRect.bottom <= scRect.top + 40;
  if (!hidden) return;
  // Its top edge just under the head, not flush against it — a pane starting at
  // the exact top of the scrollport reads as a new screen rather than as
  // something that opened below the list.
  scroller.scrollTop += paneRect.top - scRect.top - 16;
}

function renderPage(pb) {
  const feed = pb ? getFeedForPlaybook(pb.id) : null;
  const all = feed ? getTopicsForFeed(feed.id, view.filters) : [];
  const inSegment = all.filter((t) => t.kind === view.segment);

  // The first Topic's article opens by itself, ONCE per visit: the reader lands
  // on a master–detail screen and an empty right-hand half is a screen that
  // looks unfinished. The latch is what makes it once — closing it must not be
  // undone by the next repaint, and there are many (a filter change, a triage,
  // a store notification).
  if (!view.scanning && !view.autoOpened && inSegment.length) {
    view.autoOpened = true;
    view.openTopicId = inSegment[0].id;
  }

  const counts = {
    ready: all.filter((t) => t.kind === "ready").length,
    later: all.filter((t) => t.kind === "later").length,
  };
  // Unfiltered, so "the filter is hiding everything" can be told apart from
  // "this feed has not found anything yet". Two different states, two different
  // ways out.
  const total = feed ? getTopicsForFeed(feed.id).length : 0;

  const shown = inSegment.slice(0, view.page * PAGE);
  const more = inSegment.length - shown.length;

  const open = view.openTopicId ? getTopicById(view.openTopicId) : null;
  // The pane only renders for a Topic still in the list. Ignoring the one you
  // are reading takes it out of the default view, and an article hanging beside
  // a list that no longer contains its card is the pane contradicting the list.
  const openInList = open && shown.some((t) => t.id === open.id) ? open : null;

  return html`
    ${raw(renderHead(pb, feed, counts))}
    <div class="topics-view__body">
      <div class="topics-view__split${raw(openInList ? " is-split" : "")}">
        <div class="topics-view__list">${raw(renderList(shown, more, total, view.scanning, feed))}</div>
        ${raw(openInList ? renderPane(openInList) : "")}
      </div>
    </div>
  `;
}

// ── The head ───────────────────────────────────────────────────────────────
// Title, the two segments, then the scope and the two controls. The segments go
// LEFT beside the title because they say WHICH list you are looking at; the
// Playbook select, Filters and Settings go right because they narrow it.
function renderHead(pb, feed, counts) {
  const badge = narrowedGroupCount(view.filters);
  // The real DS Select — a <details>/<summary> dropdown, never a bare native
  // <select>. Same component playbook-view uses for the audience picker.
  const pbOptions = getContexts()
    .map((c) => {
      const on = !!pb && c.id === pb.id;
      return html`<div
        class="ap-select-option${raw(on ? " selected" : "")}"
        data-topic-scope-pick="${escapeAttr(c.id)}"
        role="option"
        aria-selected="${on ? "true" : "false"}"
      >
        <span class="ap-select-option-text">${c.name}</span>
        ${raw(on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : "")}
      </div>`;
    })
    .join("");

  return html`<header class="topics-view__head">
    <div class="topics-view__head-lead">
      <h1 class="topics-view__title">Topic Feed</h1>
      <div class="ap-segmented-control" role="group" aria-label="Which topics to show">
        ${raw(
          TOPIC_KINDS.map(
            (k) =>
              html`<button
                type="button"
                class="ap-segmented-control__segment${raw(
                  view.segment === k.id ? " ap-segmented-control__segment--selected" : "",
                )}"
                data-topic-segment="${escapeAttr(k.id)}"
                aria-pressed="${view.segment === k.id ? "true" : "false"}"
              >
                <span class="ap-segmented-control__label">${k.label}</span>
                <span class="ap-counter normal ${raw(view.segment === k.id ? "blue" : "grey")}">${counts[k.id]}</span>
              </button>`,
          ).join(""),
        )}
      </div>
    </div>

    <div class="topics-view__head-actions">
      <!-- The scope. It writes ?pb= and nothing else — see the note at the top
           of this file for why it is not a global scope. Labelled, because a
           bare brand name in a filter bar does not say what it is scoping. -->
      <div class="ap-form-field topics-view__scope">
        <label for="topicScope">Playbook</label>
        <details class="ap-select" id="topicScope" data-topic-scope>
          <summary class="ap-select-trigger">
            <span class="ap-select-value">${raw(pb ? escapeAttr(pb.name) : "Choose a Playbook")}</span>
            <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
          </summary>
          <div class="ap-select-dropdown" role="listbox" aria-label="Playbook">
            <div class="ap-select-options">${raw(pbOptions)}</div>
          </div>
        </details>
      </div>

      <div class="topics-view__filters">
        <button
          type="button"
          class="ap-button stroked grey"
          data-topic-filters-toggle
          aria-haspopup="true"
          aria-expanded="${view.filtersOpen ? "true" : "false"}"
        >
          <i class="ap-icon-filter"></i><span>Filters</span>
          ${raw(badge ? html`<span class="ap-counter normal blue">${badge}</span>` : "")}
        </button>
        ${raw(view.filtersOpen ? renderFilters() : "")}
      </div>

      <a
        class="ap-button ghost grey"
        href="#/topics/settings${raw(pb ? `?pb=${encodeURIComponent(pb.id)}` : "")}"
        title="${raw(
          feed ? `Refreshed ${escapeAttr(findCadence(feed.cadence)?.adverb || "weekly")}` : "Feed settings",
        )}"
      >
        <i class="ap-icon-cog"></i><span>Settings</span>
      </a>
    </div>
  </header>`;
}

// ── The Filters panel ──────────────────────────────────────────────────────
// The DS Filter Dropdown: two groups, both multi-select, committed on change.
// Words only — no glyph beside an option. The status glyphs mean something on a
// card, where they stand in for a sentence; in a list of labelled checkboxes they
// are a second reading of a word that is already there.
function renderFilters() {
  const statusRows = REVIEW_STATUSES.map((s) =>
    filterOption("status", s.id, s.label, view.filters.statuses.includes(s.id)),
  );
  const sourceRows = TOPIC_SOURCES.map((s) =>
    filterOption("source", s.id, s.name, view.filters.sources.includes(s.id), !isLiveSource(s.id)),
  );

  return html`<div class="ap-filter-dropdown topics-view__filter-panel" role="menu" aria-label="Filter topics">
    <div class="ap-filter-dropdown__content">
      <div class="ap-filter-leaf with-border-bottom">
        <div class="ap-filter-leaf__header ap-filter-leaf__expanded">
          <span class="ap-filter-leaf__title">Topic status</span>
        </div>
        <div class="ap-filter-leaf__content">${raw(statusRows.join(""))}</div>
      </div>
      <div class="ap-filter-leaf">
        <div class="ap-filter-leaf__header ap-filter-leaf__expanded">
          <span class="ap-filter-leaf__title">Sources</span>
        </div>
        <div class="ap-filter-leaf__content">${raw(sourceRows.join(""))}</div>
      </div>
    </div>
    <div class="ap-filter-dropdown__footer">
      <div class="ap-filter-dropdown__footer--apply">
        <button type="button" class="ap-button ghost blue" data-topic-filters-reset>Reset filters</button>
      </div>
    </div>
  </div>`;
}

function filterOption(group, id, label, checked, disabled = false) {
  return html`<div class="ap-filter-leaf__option">
    <label class="ap-checkbox-container">
      <input
        type="checkbox"
        data-topic-filter="${escapeAttr(group)}"
        value="${escapeAttr(id)}"
        ${raw(checked ? "checked" : "")}
        ${raw(disabled ? "disabled" : "")}
      />
      <i class="ap-icon-check" aria-hidden="true"></i>
      <span class="ap-filter-leaf__label${raw(disabled ? " disabled" : "")}">${label}</span>
    </label>
    <!-- Not-yet-built sources say so in a grey tag, never in electric blue.
         Blue is the colour of the interactive in this app, and a disabled row is
         the one thing on the panel that cannot be interacted with. -->
    ${raw(disabled ? html`<span class="ap-tag grey mini">Coming soon</span>` : "")}
  </div>`;
}

// ── The list ───────────────────────────────────────────────────────────────

function renderList(shown, more, total, scanning, feed) {
  if (scanning) {
    return html`<div class="topics-view__scanning">
      <div class="ap-loader"></div>
      <p class="topics-view__scanning-text">Reading what your competitors published…</p>
    </div>`;
  }

  if (!shown.length) {
    return renderEmpty(total, feed);
  }

  const groups = groupTopicsByAge(shown);
  const body = groups
    .map(
      (g) =>
        html`<section class="topics-view__group">
          <h2 class="topics-view__group-label">${g.group.label}</h2>
          <div class="topics-view__group-cards">
            ${raw(
              g.topics
                .map((t) =>
                  renderTopicCard(t, {
                    source: findTopicSource(t.sourceId),
                    menuOpen: view.menuTopicId === t.id,
                    articleOpen: view.openTopicId === t.id,
                  }),
                )
                .join(""),
            )}
          </div>
        </section>`,
    )
    .join("");

  return html`${raw(body)}
  ${raw(
    more
      ? html`<div class="topics-view__more" data-topic-sentinel>
          <button
            type="button"
            class="ap-button stroked grey"
            data-topic-more-page
            ${raw(view.loadingMore ? "disabled" : "")}
          >
            ${raw(view.loadingMore ? html`<span class="ap-loader small"></span>` : "")}
            <span>Load ${more > PAGE ? PAGE : more} more</span>
          </button>
        </div>`
      : "",
  )}`;
}

// Two states, and they are NOT the same sentence. A feed that has found nothing
// yet is listening and has to read that way; a filter that excludes everything is
// the reader's own doing and needs the way back, not reassurance.
function renderEmpty(total, feed) {
  if (!feed) {
    return renderEmptyState({
      icon: "ap-icon-antenna",
      title: "No Playbook to listen for",
      body: "Create a Playbook and I'll start watching its competitors.",
      wrapperClass: "topics-view__empty",
    });
  }
  if (total === 0) {
    return renderEmptyState({
      icon: "ap-icon-antenna",
      title: "Nothing has landed yet",
      body: `I'm listening to this Playbook's competitors and I refresh ${findCadence(feed.cadence)?.adverb || "weekly"}. Switch on more sources and there'll be more to read.`,
      actionHtml:
        '<button type="button" class="ap-button stroked grey" data-topic-settings><i class="ap-icon-cog"></i><span>Feed settings</span></button>',
      wrapperClass: "topics-view__empty",
    });
  }
  return renderEmptyState({
    icon: "ap-icon-filter",
    title: "Nothing matches these filters",
    body: "Widen the filters, try the other segment, or switch Playbook.",
    actionHtml: '<button type="button" class="ap-button stroked grey" data-topic-filters-reset>Reset filters</button>',
    wrapperClass: "topics-view__empty",
  });
}

// ── The article, beside the list ───────────────────────────────────────────
// Sticky, so its actions stay in view as the page scrolls: the verbs are what the
// reading is FOR, and a reader who has scrolled to the evidence should not have
// to scroll back up to act.
function renderPane(topic) {
  return html`<aside class="topics-view__pane" aria-label="Topic article">
    <div class="topics-view__pane-body">
      ${raw(renderTopicArticle(topic, { source: findTopicSource(topic.sourceId) }))}
    </div>
    <footer class="topics-view__pane-foot">${raw(renderTopicActions(topic))}</footer>
  </aside>`;
}

// ── Paging on scroll ───────────────────────────────────────────────────────
// One observer, re-created per paint because the sentinel is replaced with the
// list. `loadingMore` is what stops a second load starting while one is in
// flight — reaching the end again mid-load must not queue a second page.
function watchSentinel(target, pb) {
  if (observer) observer.disconnect();
  const sentinel = target.querySelector("[data-topic-sentinel]");
  if (!sentinel) return;
  observer = new IntersectionObserver((entries) => {
    if (!view || view.loadingMore) return;
    if (entries.some((e) => e.isIntersecting)) loadMore(target, pb);
  });
  observer.observe(sentinel);
}

function loadMore(target, pb) {
  if (!view || view.loadingMore) return;
  view.loadingMore = true;
  paint(target, pb);
  // A beat, so the button's loading state is visible rather than flickering.
  window.setTimeout(() => {
    if (!view) return;
    view.page += 1;
    view.loadingMore = false;
    paint(target, scopedPlaybook());
  }, 250);
}

// ── Events ─────────────────────────────────────────────────────────────────

function bind(target) {
  if (boundRoot === target) return;
  boundRoot = target;

  target.addEventListener("change", (event) => {
    if (!view) return;
    const filter = event.target.closest("[data-topic-filter]");
    if (filter) {
      const group = filter.dataset.topicFilter === "status" ? "statuses" : "sources";
      const list = new Set(view.filters[group]);
      if (filter.checked) list.add(filter.value);
      else list.delete(filter.value);
      view.filters = { ...view.filters, [group]: [...list] };
      // Any filter change returns to page one. Narrowing must never leave the
      // reader three pages deep in a list that is now shorter than that.
      view.page = 1;
      paint(target, scopedPlaybook());
    }
  });

  target.addEventListener("click", (event) => {
    if (!view) return;

    // One card menu open at a time, and an outside click closes it. Checked
    // first so a click on another card's kebab closes this one on the way.
    const moreBtn = event.target.closest("[data-topic-more]");
    const insideMenu = event.target.closest(".topic-card__menu");
    if (!moreBtn && !insideMenu && view.menuTopicId) {
      view.menuTopicId = null;
      paint(target, scopedPlaybook());
    }
    const insidePanel = event.target.closest(".topics-view__filter-panel");
    const filtersBtn = event.target.closest("[data-topic-filters-toggle]");
    if (!filtersBtn && !insidePanel && view.filtersOpen) {
      view.filtersOpen = false;
      paint(target, scopedPlaybook());
    }

    if (moreBtn) {
      view.menuTopicId = view.menuTopicId === moreBtn.dataset.topicMore ? null : moreBtn.dataset.topicMore;
      paint(target, scopedPlaybook());
      return;
    }

    if (filtersBtn) {
      view.filtersOpen = !view.filtersOpen;
      paint(target, scopedPlaybook());
      return;
    }

    if (event.target.closest("[data-topic-filters-reset]")) {
      view.filters = defaultFilters();
      view.page = 1;
      paint(target, scopedPlaybook());
      return;
    }

    if (event.target.closest("[data-topic-settings]")) {
      const pb = scopedPlaybook();
      navigate(pb ? `/topics/settings?pb=${encodeURIComponent(pb.id)}` : "/topics/settings");
      return;
    }

    const scopePick = event.target.closest("[data-topic-scope-pick]");
    if (scopePick) {
      // The scope is URL state, so switching Playbook is a navigation — the
      // router re-runs this screen and every bit of view state resets with it,
      // which is what "swaps the feed under the reader" has to mean.
      setHashQuery(getPath(), { pb: scopePick.dataset.topicScopePick });
      return;
    }

    const segment = event.target.closest("[data-topic-segment]");
    if (segment) {
      const id = segment.dataset.topicSegment;
      if (id === view.segment) return;
      // Switching segment closes the article and goes back to page one. It does
      // NOT auto-open the new segment's first Topic: the reader asked to see a
      // list, and opening something for them is an answer to a question they
      // did not ask twice.
      view.segment = id;
      view.page = 1;
      view.openTopicId = null;
      paint(target, scopedPlaybook());
      return;
    }

    const read = event.target.closest("[data-topic-read]");
    if (read) {
      const id = read.dataset.topicRead;
      const opening = view.openTopicId !== id;
      view.openTopicId = opening ? id : null;
      view.revealPane = opening;
      paint(target, scopedPlaybook());
      return;
    }

    if (event.target.closest("[data-topic-close]")) {
      view.openTopicId = null;
      paint(target, scopedPlaybook());
      return;
    }

    if (event.target.closest("[data-topic-more-page]")) {
      loadMore(target, scopedPlaybook());
      return;
    }

    const use = event.target.closest("[data-topic-use]");
    if (use) {
      // The mark lands before the chat opens — see topic-flow.
      useTopicInChat(use.dataset.topicUse);
      return;
    }

    const ignore = event.target.closest("[data-topic-ignore]");
    if (ignore) {
      const id = ignore.dataset.topicIgnore;
      view.menuTopicId = null;
      openIgnoreReason(id, (reason) => {
        ignoreTopic(id, reason);
        const t = getTopicById(id);
        showToast(`Ignored — I'll keep "${topicTitle(t)}" off this list`, {
          action: { label: "Undo", onClick: () => unignoreTopic(id) },
        });
      });
      return;
    }

    const unignore = event.target.closest("[data-topic-unignore]");
    if (unignore) {
      const id = unignore.dataset.topicUnignore;
      view.menuTopicId = null;
      unignoreTopic(id);
      showToast("Back on the list to review");
      return;
    }
  });
}
