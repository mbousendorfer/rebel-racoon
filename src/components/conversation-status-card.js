// Floating status card — sits at the top-right of the conversation column.
// Surfaces what's "happening / available" in the active session at a glance,
// without forcing the user to crack open each panel:
//   • In progress  — Archie generating / thinking (any thread message
//                    flagged status:"loading").
//   • Sources (N)  — list of attached source filenames.
//   • Drafts  (N)  — latest draft-batch count.
//   • Outputs (N)  — extracted-ideas count.
//
// Each row is clickable and opens the matching right-panel mode. Visibility
// is owned by the user's preference (toggled via the topbar info button) —
// the card coexists with any right-panel mode so the toggle works in every
// state. It still hides itself off /session/:id routes.
//
// Pattern: inject markup once into <body>, then re-render reactively as
// the underlying stores mutate (assistant thread, sources-stream, library,
// right-panel mode, sessions).

import { html, raw, escapeHtml, escapeAttr } from "../utils.js?v=2388";
import { getPath } from "../router.js?v=2388";
import {
  openDrafts as openDraftsPanel,
  openIdeas as openIdeasPanel,
  openClips as openClipsPanel,
  openSources as openSourcesPanel,
  getMode as getRightPanelMode,
  subscribe as subscribeRightPanel,
} from "./right-panel.js?v=2388";
import { getThread, subscribe as subscribeThread } from "../assistant.js?v=2388";
import { getSources as getSessionSources, subscribeSources } from "../sources-stream.js?v=2388";
import { getIdeas, subscribe as subscribeLibrary } from "../library.js?v=2388";
import { getPosts, subscribe as subscribePosts } from "../posts-store.js?v=2388";
import { subscribe as subscribeSessions } from "../sessions-store.js?v=2388";
import { addMention } from "../composer-mentions.js?v=2388";
import { isFlagOn } from "../feature-flags.js?v=2388";

// Two-level structure:
//   .conversation-status-column   — fills grid column 3 with white bg
//                                    (no grey reveal between chat + card).
//   .conversation-status-card     — the floating-card chrome (border +
//                                    shadow + radius) sitting inside.
const HTML = `
<aside class="conversation-status-column" id="conversationStatusCard" hidden aria-label="Chat status">
  <div class="conversation-status-card">
    <div class="conversation-status-card__inner" data-status-card-root></div>
  </div>
</aside>
`;

// User preference — the topbar info-button toggles the card visibility.
// Default ON; stored as "0" in localStorage when explicitly hidden so a
// missing key still resolves to "show".
const STORAGE_KEY = "archie-status-card-visible";
const visibilityListeners = new Set();

export function isEnabled() {
  return localStorage.getItem(STORAGE_KEY) !== "0";
}

function setEnabled(on) {
  if (on) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, "0");
  visibilityListeners.forEach((fn) => {
    try {
      fn(on);
    } catch {}
  });
  render();
}

export function toggle() {
  setEnabled(!isEnabled());
}

// Subscribe to visibility-pref changes so the topbar can repaint its
// info button's pressed state. Returns an unsubscribe fn.
export function subscribeVisibility(fn) {
  visibilityListeners.add(fn);
  return () => visibilityListeners.delete(fn);
}

let rootEl = null;
let innerEl = null;
let initialized = false;

// Re-attach thread/sources/library subscriptions when the active session
// changes (route → /session/:other-id).
let lastSessionId = null;
let unsubscribeThread = null;
let unsubscribeSources = null;
let unsubscribeLibrary = null;
let unsubscribePosts = null;

export function init() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  // Append to .app-shell (not <body>) so the card can be grid-positioned
  // as a real third column rather than overlaying the chat — the shell's
  // grid template adds a column when `.is-status-card-visible` is set.
  const shell = document.getElementById("appShell") || document.body;
  shell.appendChild(wrapper.firstElementChild);
  rootEl = document.getElementById("conversationStatusCard");
  innerEl = rootEl.querySelector("[data-status-card-root]");

  // Click delegate — one handler for all the action rows.
  rootEl.addEventListener("click", (event) => {
    // Source row → push the filename as a mention pill into the composer.
    // The composer renders the pills inline at the top of its card (cf.
    // session.js + composer-mentions.js). More visible than an inline
    // `@filename` token.
    const sourceMention = event.target.closest("[data-status-source-mention]");
    if (sourceMention) {
      event.preventDefault();
      const sid = currentSessionId();
      if (sid) addMention(sid, sourceMention.dataset.statusSourceMention);
      return;
    }
    if (event.target.closest("[data-status-drafts]")) {
      event.preventDefault();
      openDraftsPanel(null);
      return;
    }
    if (event.target.closest("[data-status-ideas]")) {
      event.preventDefault();
      openIdeasPanel();
      return;
    }
    if (event.target.closest("[data-status-clips]")) {
      event.preventDefault();
      openClipsPanel();
      return;
    }
  });

  // Global state subscriptions that don't depend on a session id.
  subscribeRightPanel(() => render());
  subscribeSessions(() => render());
  window.addEventListener("hashchange", () => {
    syncSessionSubscriptions();
    render();
  });

  syncSessionSubscriptions();
  initialized = true;
}

function syncSessionSubscriptions() {
  const sid = currentSessionId();
  if (sid === lastSessionId) return;
  if (unsubscribeThread) {
    unsubscribeThread();
    unsubscribeThread = null;
  }
  if (unsubscribeSources) {
    unsubscribeSources();
    unsubscribeSources = null;
  }
  if (unsubscribeLibrary) {
    unsubscribeLibrary();
    unsubscribeLibrary = null;
  }
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }
  lastSessionId = sid;
  if (sid) {
    unsubscribeThread = subscribeThread(sid, () => render());
    unsubscribeSources = subscribeSources(sid, () => render());
    unsubscribeLibrary = subscribeLibrary(sid, () => render());
    unsubscribePosts = subscribePosts(sid, () => render());
  }
}

export function render() {
  if (!initialized) return;
  // Feature-switched off entirely — never reserve the column or render the
  // card (the topbar toggle is hidden in lockstep, cf. topbar.js).
  // Under contentPanel too: the card and the panel's Overview tab are one or
  // the other — this flag ON keeps the card and drops the tab (right-panel.js
  // hasOverview).
  if (!isFlagOn("conversationStatusCard")) {
    hideCard();
    return;
  }
  const sid = currentSessionId();
  if (!sid) {
    hideCard();
    return;
  }
  // ALT first-time-user flow runs inside /session/welcome-alt-* with the
  // full-bleed onboarding chrome (no sidebar, no topbar). The shell uses
  // a single-column grid there, so reserving a 3rd column for the status
  // card would collapse the chat (cf. styles/layout.css body.onboarding).
  if (sid.startsWith("welcome-alt-")) {
    hideCard();
    return;
  }
  // Clip Studio runs as a focused full-page flow (its own headers + sticky
  // bars) — never reserve the status-card column there, or the studio content
  // gets squeezed.
  if (sid.startsWith("clip-studio-")) {
    hideCard();
    return;
  }
  // User has dismissed the card via the topbar info button (which contentPanel
  // drops: there the card simply shows while the panel is closed).
  if (!isEnabled() && !isFlagOn("contentPanel")) {
    hideCard();
    return;
  }
  // A right-panel (Sources / Ideas / Drafts) is open — yield the column
  // to the panel. The user's pref is left untouched: when the panel
  // closes, the subscribeRightPanel listener re-renders and the card
  // reappears if it was enabled.
  const rpMode = getRightPanelMode();
  if (rpMode) {
    hideCard();
    return;
  }
  const thread = getThread(sid);
  const sources = getSessionSources(sid);
  const ideas = getIdeas(sid);
  const draftCount = sessionDraftCount(sid, thread);
  const pending = pendingProcesses(thread);
  // Aggregate clips across all sources in the session. Mirrors
  // right-panel.collectAllClips but expressed inline since the math is
  // trivial and we want to avoid the cross-module activeSessionId
  // dependency. Re-runs on every render because subscribeSources
  // notifies the status card on any source mutation (including the
  // attachVideoClips call inside sources-stream.transitionToDone).
  const clipCount = sources.reduce((sum, s) => sum + (Array.isArray(s.clips) ? s.clips.length : 0), 0);

  // Brand-new / empty chat — nothing to summarise yet (no sources, ideas,
  // clips, drafts, or in-flight work). The card would be an all-"None yet"
  // shell, so hide it entirely (and the topbar info toggle is hidden in
  // lockstep — see topbar.renderStatusCardToggle) until there's content.
  const isEmptyChat =
    sources.length === 0 && ideas.length === 0 && clipCount === 0 && draftCount === 0 && pending.length === 0;
  if (isEmptyChat) {
    hideCard();
    return;
  }

  // The card is always shown on /session/:id when no right-panel is open —
  // empty sections render an "—" placeholder so the user has a reliable
  // status anchor (and discovers the affordance to access Drafts/Outputs
  // panels even on a brand-new chat).

  // Work in progress shows ON the row it feeds (Archie's mark turning in the
  // icon slot, the row saying what it's doing); only work no row owns stays
  // in the In progress section.
  const work = workByRow(thread, sources);
  innerEl.innerHTML = html`
    ${raw(renderPendingSection(work.rest))} ${raw(renderSourcesSection(sources))}
    ${raw(renderOutputsRow(ideas.length, work.ideas))} ${raw(renderClipsRow(clipCount, work.clips))}
    ${raw(renderDraftsRow(draftCount, work.drafts))}
  `;
  rootEl.hidden = false;
  setShellLayout(true);
}

function hideCard() {
  if (rootEl) rootEl.hidden = true;
  setShellLayout(false);
}

// Toggle the .is-status-card-visible class on .app-shell — this is what
// activates the grid 3rd-column reservation so the chat content gets
// pushed instead of being overlaid.
function setShellLayout(visible) {
  const shell = document.getElementById("appShell");
  if (!shell) return;
  shell.classList.toggle("is-status-card-visible", !!visible);
}

// In progress — list any thread messages currently flagged loading.
// Each pending row is non-clickable text (the user can't navigate
// "into" a generating process); just shows what's happening.
function renderPendingSection(pending) {
  if (pending.length === 0) return "";
  const rows = pending
    .map(
      (p) => `
    <div class="conversation-status-card__pending">
      ${WORKING_MARK}
      <span class="conversation-status-card__pending-label">${escapeHtml(p)}</span>
    </div>
  `,
    )
    .join("");
  return `
    <section class="conversation-status-card__section">
      <h3 class="conversation-status-card__heading">In progress</h3>
      ${rows}
    </section>
  `;
}

function renderSourcesSection(sources) {
  const heading = `
    <h3 class="conversation-status-card__heading">
      Sources <span class="conversation-status-card__heading-count">${sources.length}</span>
    </h3>
  `;
  if (sources.length === 0) {
    return `
      <section class="conversation-status-card__section">
        ${heading}
        <div class="conversation-status-card__empty conversation-status-card__empty--block">
          None yet — attach a file or link to get started.
        </div>
      </section>
    `;
  }
  const items = sources
    .map((s) => {
      const name = s.title || s.name || s.filename || "Untitled";
      // Two stacked icons in the leading slot — file at rest, copy on
      // hover. The CSS swap-on-hover lives in
      // styles/components/conversation-status-card.css.
      if (s.status && s.status !== "Processed") {
        return `
      <div class="conversation-status-card__row conversation-status-card__row--static is-working" role="status">
        ${WORKING_MARK}
        <span class="conversation-status-card__row-label">${escapeHtml(name)}</span>
        <span class="conversation-status-card__working">Reading…</span>
      </div>
    `;
      }
      return `
      <button
        type="button"
        class="conversation-status-card__row conversation-status-card__source"
        data-status-source-mention="${escapeAttr(name)}"
        title="Mention it in your message"
      >
        <span class="conversation-status-card__row-icons" aria-hidden="true">
          <i class="ap-icon-file conversation-status-card__row-icon-rest"></i>
          <i class="ap-icon-copy conversation-status-card__row-icon-hover"></i>
        </span>
        <span class="conversation-status-card__row-label">${escapeHtml(name)}</span>
      </button>
    `;
    })
    .join("");
  return `
    <section class="conversation-status-card__section">
      ${heading}
      ${items}
    </section>
  `;
}

// One row per output — Ideas, Clips, Drafts. Three states:
//   working  — Archie's mark turns in the icon slot and the row says what
//              it's doing ("Extracting ideas…"); still opens the panel when
//              there's already something to see.
//   none yet — static, "None yet".
//   ready    — a button to its panel, with the count.
function renderOutputRow({ icon, label, count, counterColor, attr, title, working }) {
  const lead = working ? WORKING_MARK : `<i class="${icon}" aria-hidden="true"></i>`;
  const text = working ? escapeHtml(working) : label;
  const cls = `conversation-status-card__row${working ? " is-working" : ""}`;
  if (count === 0) {
    return `
      <section class="conversation-status-card__section">
        <div class="${cls} conversation-status-card__row--static"${working ? ' role="status"' : ""}>
          ${lead}
          <span class="conversation-status-card__row-label">${text}</span>
          ${working ? "" : `<span class="conversation-status-card__empty">None yet</span>`}
        </div>
      </section>
    `;
  }
  return `
    <section class="conversation-status-card__section">
      <button type="button" class="${cls}" ${attr} title="${title}">
        ${lead}
        <span class="conversation-status-card__row-label">${text}</span>
        <span class="ap-counter normal ${counterColor}">${count}</span>
      </button>
    </section>
  `;
}

const renderOutputsRow = (count, working) =>
  renderOutputRow({
    icon: "ap-icon-archie-official",
    label: "Ideas",
    count,
    counterColor: "blue",
    attr: "data-status-ideas",
    title: "Open Ideas panel",
    working,
  });

const renderClipsRow = (count, working) =>
  renderOutputRow({
    icon: "ap-icon-video",
    label: "Clips",
    count,
    counterColor: "blue",
    attr: "data-status-clips",
    title: "Open Clips panel",
    working,
  });

const renderDraftsRow = (count, working) =>
  renderOutputRow({
    icon: "ap-icon-pen",
    label: "Drafts",
    count,
    counterColor: "orange",
    attr: "data-status-drafts",
    title: "Open Drafts panel",
    working,
  });

// Archie's animated mark (archie-loader.js injects it into any .ap-loader).
const WORKING_MARK = `<span class="ap-loader size-16 conversation-status-card__mark" aria-hidden="true"></span>`;

// Which row each piece of running work belongs to, from its thread marker
// (the startPending labels: "Extracting ideas from content…", "Generating
// post drafts…") and the sources' own state (clips being cut). The row says it
// in its own short words — the card is narrow. Work no row owns ("Thinking…",
// "Finding your top posts…") stays in `rest`, in full.
const WORKING_LABEL = { ideas: "Extracting ideas…", clips: "Cutting clips…", drafts: "Writing drafts…" };
function workByRow(thread, sources) {
  const work = { ideas: null, clips: null, drafts: null, rest: [] };
  for (const m of thread) {
    if (m.status !== "loading" || m.hidden || m.role === "source-intake") continue;
    const label = humanizePendingMessage(m);
    if (m.role === "idea-extraction" || /\bideas?\b/i.test(label)) work.ideas = WORKING_LABEL.ideas;
    else if (m.role === "clip-extraction" || /\bclips?\b/i.test(label)) work.clips = WORKING_LABEL.clips;
    // Drafts are being written — not "Finding your top posts…", which reads posts.
    else if (/\bdrafts?\b|\b(generat|writ|rewrit)\w*\b.*\bposts?\b/i.test(label)) work.drafts = WORKING_LABEL.drafts;
    else if (label) work.rest.push(label);
  }
  const cutting = sources.find((s) => s.clipExtractionStatus === "extracting");
  if (cutting) work.clips = WORKING_LABEL.clips;
  return work;
}

// Draft count for the active session — same precedence as the topbar
// pill: posts-store is the canonical source (includes seeded mock
// drafts), falling back to the latest assistant `variant:"draft"` turn
// when the store is empty (covers flows that post the turn before any
// post lands in the store).
function sessionDraftCount(sessionId, thread) {
  const storeCount = getPosts(sessionId).length;
  if (storeCount > 0) return storeCount;
  const latestDraft = [...thread].reverse().find((m) => m.variant === "draft");
  if (!latestDraft) return 0;
  return latestDraft.count ?? latestDraft.drafts?.length ?? 0;
}

// Collect human-readable labels for in-progress work. We only flag
// loading messages that have a meta label (e.g. "Generating drafts…",
// "Extracting ideas…") — source-intake uploading bubbles are excluded
// because they're already surfaced inline as the source row.
export function pendingProcesses(thread) {
  const labels = [];
  for (const m of thread) {
    if (m.status !== "loading") continue;
    if (m.hidden) continue; // the reply placeholder — its reasoning turn already says what's going on
    if (m.role === "source-intake") continue; // surfaced via Sources row
    const label = humanizePendingMessage(m);
    if (label) labels.push(label);
  }
  return labels;
}

function humanizePendingMessage(m) {
  // startPending's marker carries its own label ("Generating post drafts…").
  if (m.role === "pending") return m.meta || "Working…";
  if (m.variant === "idea-extraction" || m.variant === "extraction") return "Extracting ideas…";
  if (m.variant === "clip-extraction") return "Cutting your clips…";
  if (m.role === "assistant") {
    return m.meta || "Thinking…";
  }
  if (m.role === "system" || m.role === "system-notice") {
    return m.meta || m.text || "Thinking…";
  }
  if (m.role === "idea-extraction") {
    return `Extracting ideas from ${m.filename || "source"}…`;
  }
  if (m.role === "clip-extraction") {
    return `Extracting clips from ${m.filename || "source"}…`;
  }
  return "Thinking…";
}

function currentSessionId() {
  const m = /^\/session\/([^/?]+)/.exec(getPath());
  return m ? m[1] : null;
}
