import { getSessions } from "../sessions-store.js?v=17";
import { getContexts, getContextById, subscribe as subscribeContexts } from "../contexts-store.js?v=49";
import { isNewUser } from "../user-mode.js?v=24";
import { html, raw } from "../utils.js?v=22";
import { navigate } from "../router.js?v=31";
import { isFlagOn } from "../feature-flags.js?v=20";
import { renderTopbar } from "../components/topbar.js?v=308";
import { showToast } from "../components/toast.js?v=21";
import { renderEmptyState } from "../components/empty-state.js?v=3";
import { open as openTopicModal } from "../components/topic-modal.js?v=10";
import { renderMagazine, renderSourceChips } from "../topics-feed.js?v=3";
import { TOPIC_SOURCES, findTopicSource } from "../topics-catalog.js?v=3";
import { openTopicInChat } from "../topic-flow.js?v=9";
import {
  getTopics,
  getUnseenCount,
  dismissTopic,
  restoreTopic,
  refreshTopics,
  hasMoreToScan,
  subscribe as subscribeTopics,
} from "../topics-store.js?v=6";

// The `/` route — a redirect, or Archie's front page.
//
// It has always been a pure redirect: first-time users to onboarding, everyone
// else straight into their most recent chat. That is the right default for a
// tool you come to with a task already in mind, and it stays the default.
//
// Behind the `frontPage` flag it becomes something else: the page Archie fills
// while you're away. A lead story, a short grid, sections across the top — you
// arrive and there is already something worth posting about, which is the whole
// point of the listening. The flag is a genuine either/or with the hero rail in
// the new-chat screen (see renderTopicRail in screens/session.js): both places
// showing the same three headlines would make neither of them mean anything.
//
// This is NOT a second /topics. That route is the section — everything, filtered
// by Playbook, grouped into an archive. This is the front page: a selection of
// the fresh, capped, with a way through to the section. Both render through the
// one engine in topics-feed.js.

// How many cards sit under the lead. Six keeps the page to about one screen, so
// the front page ends rather than trailing off into an archive — that's the job
// of "See all topics".
const GRID_SIZE = 6;

// Same as /topics: long enough to read the scanning line, short enough that
// nobody waits for it in a demo.
const SCAN_MS = 2000;

let view = { source: "all", scanning: false };
let scanTimer = null;
let unsubscribe = null;
let unsubscribeContexts = null;
let boundTarget = null;
let boundClick = null;

export function renderDashboard(_params, target) {
  // Branch 1 — first-time user without a Playbook → onboarding. Ahead of
  // everything, including the flag: there is nothing to put on a front page
  // before a Playbook exists.
  if (isNewUser() && getContexts().length === 0) {
    window.location.replace(window.location.href.split("#")[0] + "#/welcome-alt");
    return;
  }

  // Branch 2 — the front page, when both flags are on. `topics` gates the whole
  // feature, so with it off this route redirects exactly as it always has.
  if (isFlagOn("frontPage") && isFlagOn("topics")) {
    renderTopbar();
    teardown();
    view = { source: "all", scanning: false };
    paint(target);
    bind(target);
    unsubscribe = subscribeTopics(() => paint(target));
    // Playbook names ride on the cards, and Topics settings writes straight into
    // contexts-store.
    unsubscribeContexts = subscribeContexts(() => paint(target));
    return teardown;
  }

  // Branch 3 — the original redirect.
  const recent = getSessions()[0];
  const targetPath = isNewUser() || !recent ? "/session/new" : `/session/${recent.id}`;
  window.location.replace(window.location.href.split("#")[0] + "#" + targetPath);
}

function teardown() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribeContexts) {
    unsubscribeContexts();
    unsubscribeContexts = null;
  }
  if (scanTimer) {
    window.clearTimeout(scanTimer);
    scanTimer = null;
  }
  view.scanning = false;
  if (boundTarget && boundClick) boundTarget.removeEventListener("click", boundClick);
  boundTarget = null;
  boundClick = null;
}

function paint(target) {
  target.innerHTML = html`<section class="screen topics-view home-view">${raw(renderPage())}</section>`;
}

// ─── Render ────────────────────────────────────────────────────────────────

function renderPage() {
  const all = getTopics();
  const visible = all.filter((t) => view.source === "all" || t.sourceId === view.source);
  const unseen = getUnseenCount();
  const represented = new Set(all.map((t) => t.contextId)).size;

  // First person, because this page is Archie reporting back rather than a
  // dashboard labelling itself. "N new since yesterday" is honest about the
  // auto-scan that ran on load — a dossier really did arrive between visits.
  const sub = [
    unseen ? `${unseen} new since yesterday` : null,
    `${all.length} ${all.length === 1 ? "topic" : "topics"}`,
    represented ? `from ${represented} ${represented === 1 ? "Playbook" : "Playbooks"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return html`
    <div class="topics-view__page">
      <header class="topics-view__head">
        <div class="topics-view__head-text">
          <h1 class="topics-view__title">Here's what I found</h1>
          <p class="topics-view__sub">${sub}</p>
        </div>
        <div class="topics-view__head-actions">
          ${raw(renderRefresh())}
          <!-- Secondary, not primary: the page already has exactly one filled
               button and it's the lead story's "Start a chat". Two primaries on
               one screen is a DS violation and it reads as one too — the header
               would be competing with the story it's sitting above. Orange rather
               than blue because starting a chat is the AI move; Refresh beside it
               stays blue because re-reading a list is routine page plumbing. -->
          <button type="button" class="ap-button secondary orange" data-home-new-chat>
            <i class="ap-icon-single-chat-bubble" aria-hidden="true"></i>
            <span>New chat</span>
          </button>
        </div>
      </header>

      ${raw(all.length ? renderSections(all) : "")}
      <div class="topics-view__body">
        ${raw(view.scanning ? renderScanning() : visible.length ? renderFeed(visible) : renderEmpty(all.length))}
      </div>
      ${raw(!view.scanning && visible.length ? renderSeeAll(all.length) : "")}
    </div>
  `;
}

// Sections only — no Playbook select. A front page isn't a filtered view of
// everything; narrowing by brand is what the section page is for, and putting
// the same two-facet toolbar here would make the two routes look identical when
// their jobs aren't.
function renderSections(all) {
  const counts = new Map();
  for (const t of all) counts.set(t.sourceId, (counts.get(t.sourceId) || 0) + 1);
  return html`<div class="topics-view__filters">
    ${raw(
      renderSourceChips(TOPIC_SOURCES, {
        active: view.source,
        counts: Object.fromEntries(counts),
        total: all.length,
      }),
    )}
  </div>`;
}

// Ungrouped: the front page only shows the freshest handful, so date headings
// over six cards would be furniture. The archive lives one click away.
function renderFeed(topics) {
  return renderMagazine(topics, {
    resolveSource: (t) => findTopicSource(t.sourceId),
    resolvePlaybook: (t) => getContextById(t.contextId)?.name || "",
    grouped: false,
    limit: GRID_SIZE,
  });
}

// The way out to the section page. A front page has to end somewhere and say so,
// otherwise a capped grid just looks like the whole feed.
function renderSeeAll(total) {
  if (total <= GRID_SIZE + 1) return "";
  return html`<div class="home-view__more">
    <button type="button" class="ap-button stroked grey" data-home-all-topics>
      <span>See all ${total} topics</span>
      <i class="ap-icon-arrow-right" aria-hidden="true"></i>
    </button>
  </div>`;
}

function renderScanning() {
  const rows = [0, 1, 2]
    .map(
      () =>
        html`<div class="topics-skel">
          <span class="topics-skel__line topics-skel__line--eyebrow"></span>
          <span class="topics-skel__line topics-skel__line--title"></span>
          <span class="topics-skel__line"></span>
          <span class="topics-skel__line topics-skel__line--short"></span>
        </div>`,
    )
    .join("");
  return html`<p class="topics-view__scanning" role="status">
      <span class="archie-loader" aria-hidden="true"></span>
      <span>Reading what your sources published…</span>
    </p>
    ${raw(rows)}`;
}

// Two dead ends here, not the section page's three: there's no Playbook facet to
// blame, so an empty section is always the source chips' doing.
function renderEmpty(total) {
  if (total > 0 && view.source !== "all") {
    return renderEmptyState({
      icon: "ap-icon-search",
      title: "Nothing in that section",
      body: `I haven't brought you anything from ${findTopicSource(view.source)?.name || "that source"} yet.`,
      actionHtml: `<button type="button" class="ap-button stroked grey" data-home-sections-clear><span>Show everything</span></button>`,
      wrapperClass: "topics-view__empty",
    });
  }
  return renderEmptyState({
    icon: "ap-icon-antenna",
    title: "Tell me what to watch",
    body: "Turn a listening source on and I'll have something for you here next time you open Archie.",
    actionHtml: `<button type="button" class="ap-button primary blue" data-home-settings>
           <i class="ap-icon-cog"></i><span>Choose what I watch</span>
         </button>`,
    wrapperClass: "topics-view__empty",
  });
}

// ─── Interaction ───────────────────────────────────────────────────────────

function bind(target) {
  boundTarget = target;
  boundClick = (event) => {
    if (event.target.closest("[data-home-new-chat]")) {
      // A unique id, like the sidebar's New chat — `/` resolves to the most
      // recent session, which is the one thing this button must not do.
      navigate(`/session/new-${Date.now().toString(36)}`);
      return;
    }
    if (event.target.closest("[data-home-all-topics]")) {
      navigate("/topics");
      return;
    }
    if (event.target.closest("[data-home-settings]")) {
      navigate("/topics/settings");
      return;
    }
    if (event.target.closest("[data-home-sections-clear]")) {
      view.source = "all";
      paint(target);
      return;
    }
    const srcPick = event.target.closest("[data-topics-source]");
    if (srcPick) {
      view.source = srcPick.dataset.topicsSource;
      paint(target);
      return;
    }
    if (event.target.closest("[data-topics-refresh]")) {
      startScan(target);
      return;
    }
    // The card's own three hooks, identical to /topics — one card, one
    // behaviour, wherever it's rendered.
    const openBtn = event.target.closest("[data-topic-open]");
    if (openBtn) {
      openTopicModal({ topicId: openBtn.dataset.topicOpen, onDismiss: announceDismissal });
      return;
    }
    const chatBtn = event.target.closest("[data-topic-chat]");
    if (chatBtn) {
      openTopicInChat(chatBtn.dataset.topicChat);
      return;
    }
    const dismissBtn = event.target.closest("[data-topic-dismiss]");
    if (dismissBtn) {
      const id = dismissBtn.dataset.topicDismiss;
      dismissTopic(id);
      announceDismissal(id);
    }
  };
  target.addEventListener("click", boundClick);
}

function renderRefresh() {
  if (view.scanning) {
    return html`<button type="button" class="ap-button secondary blue" disabled>
      <span class="archie-loader" aria-hidden="true"></span>
      <span>Scanning…</span>
    </button>`;
  }
  const dry = !hasMoreToScan();
  return html`<button
    type="button"
    class="ap-button secondary blue"
    data-topics-refresh
    ${raw(dry ? "disabled" : "")}
    title="${dry ? "Nothing new to find right now" : "Scan my sources again"}"
  >
    <i class="ap-icon-refresh" aria-hidden="true"></i>
    <span>Refresh now</span>
  </button>`;
}

function announceDismissal(id) {
  showToast("Dismissed — I won't bring it up again", {
    action: { label: "Undo", onClick: () => restoreTopic(id) },
  });
}

function startScan(target) {
  if (view.scanning) return;
  view.scanning = true;
  paint(target);
  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    view.scanning = false;
    const batch = refreshTopics();
    paint(target);
    showToast(
      batch.length
        ? `${batch.length} new ${batch.length === 1 ? "topic" : "topics"}`
        : "Nothing new since the last scan",
    );
  }, SCAN_MS);
}
