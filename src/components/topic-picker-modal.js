// The Topic dialog — one dialog, two views.
//
//   openTopicPicker({ playbookId })  the composer's "Pick from the Topic Feed"
//   openTopicArticle(topicId)        a row in the in-chat "Fresh topics" list
//
// Both land in the same <aside>. The picker opens on the LIST and a card's body
// opens the article INSIDE it, with a back action that names where it returns;
// the in-chat list opens straight on the article and has no back, because there
// is no list in here to go back to.
//
// ── One article, not two ───────────────────────────────────────────────────
// The body and the verbs come from topic-article.js — the same functions the feed
// renders beside its list. A second copy of the article for the dialog is exactly
// how a card and the thing it opens end up saying different sentences about the
// same Topic.
//
// On the article view the dialog prints NO header of its own: the article already
// carries the Topic's title as its h2, and a header above it would be the same
// sentence twice. It is still NAMED for screen readers — paint() writes the
// Topic's title into the dialog's aria-label — and the close control sits
// top-right in both views.
//
// ── Scope ──────────────────────────────────────────────────────────────────
// The picker lists ONE Playbook's Topics — the chat's own. A chat keeps the brand
// it was created in, so the picker never asks which Playbook first: that question
// was answered when the chat was made.

import { html, raw, escapeHtml } from "../utils.js?v=22";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=22";
import { renderEmptyState } from "./empty-state.js?v=3";
import { renderTopicCard } from "./topic-card.js?v=9";
import { renderTopicArticle, renderTopicActions } from "../topic-article.js?v=9";
import { getFeedForPlaybook } from "../topic-feeds-store.js?v=3";
import { getTopicsForFeed, groupTopicsByAge, getTopicById } from "../topics-store.js?v=4";
import { findTopicSource } from "../topics-catalog.js?v=2";
import { getContextById } from "../contexts-store.js?v=56";
import { useTopicInChat } from "../topic-flow.js?v=3";

const MODAL_ID = "topic-picker";

let backdrop, modal, bodyEl, footEl;
let initialized = false;
// { view: "list" | "article", playbookId, topicId, canGoBack }
let state = null;

const HTML = `
<div class="app-modal-backdrop topic-picker__backdrop" id="topicPickerBackdrop" hidden></div>
<aside
  class="ap-dialog topic-picker"
  id="topicPickerModal"
  role="dialog"
  aria-modal="true"
  aria-label="Topic"
  aria-hidden="true"
>
  <button class="ap-dialog-close" type="button" data-topic-picker-close aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="topic-picker__body" id="topicPickerBody"></div>
  <!-- The DS dialog footer is a SIBLING of the scrolling body, never inside it:
       that is what pins it to the dialog's bottom edge without position sticky
       and without negative margins clawing back the scroller's padding.
       NOTE no backticks in here - this string is a template literal. -->
  <div id="topicPickerFoot"></div>
</aside>`;

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);

  backdrop = document.getElementById("topicPickerBackdrop");
  modal = document.getElementById("topicPickerModal");
  bodyEl = document.getElementById("topicPickerBody");
  footEl = document.getElementById("topicPickerFoot");

  backdrop.addEventListener("click", close);

  // One delegated listener on the dialog, like every other surface in this app.
  modal.addEventListener("click", (event) => {
    // Both hooks: the dialog's own × and the article footer's Close, which is
    // shared with the feed's pane and emits data-topic-close there too.
    if (event.target.closest("[data-topic-picker-close]") || event.target.closest("[data-topic-close]")) {
      close();
      return;
    }
    if (event.target.closest("[data-topic-picker-back]")) {
      state = { ...state, view: "list", topicId: null };
      paint();
      return;
    }
    const read = event.target.closest("[data-topic-read]");
    if (read) {
      state = { ...state, view: "article", topicId: read.dataset.topicRead, canGoBack: true };
      paint();
      // Reading starts at the top: the dialog kept the list's scroll offset, so
      // an article opened from the fourth card began four cards down its own prose.
      bodyEl.scrollTop = 0;
      return;
    }
    const use = event.target.closest("[data-topic-use]");
    if (use) {
      // Close FIRST. useTopicInChat navigates, and a dialog still mounted over
      // the new chat would have to be dismissed by a reader who did not open it.
      const id = use.dataset.topicUse;
      close();
      useTopicInChat(id);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !modal.classList.contains("open")) return;
    event.preventDefault();
    close();
  });

  initialized = true;
}

export function init() {
  injectOnce();
}

/** The composer's picker: this chat's Playbook, ready-to-draft Topics only. */
export function openTopicPicker({ playbookId = null } = {}) {
  injectOnce();
  requestOpen(MODAL_ID, close);
  state = { view: "list", playbookId, topicId: null, canGoBack: false };
  show();
}

/** One Topic's article, from a row in the in-chat list. No list behind it. */
export function openTopicArticle(topicId) {
  injectOnce();
  const topic = getTopicById(topicId);
  // A link to a Topic that no longer exists opens nothing and goes nowhere.
  if (!topic) return;
  requestOpen(MODAL_ID, close);
  state = { view: "article", playbookId: null, topicId, canGoBack: false };
  show();
}

function show() {
  paint();
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  bodyEl.scrollTop = 0;
}

export function close() {
  if (!initialized) return;
  backdrop.classList.remove("open");
  backdrop.hidden = true;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
  state = null;
  notifyClose(MODAL_ID);
}

// ─── Render ────────────────────────────────────────────────────────────────

function paint() {
  if (!state) return;
  bodyEl.innerHTML = state.view === "article" ? renderArticleView() : renderListView();
  // Only the article has verbs; the list's cards carry their own.
  const openTopic = state.view === "article" && state.topicId ? getTopicById(state.topicId) : null;
  footEl.innerHTML = openTopic
    ? `<div class="ap-dialog-footer"><div class="ap-dialog-footer-right">${renderTopicActions(openTopic, {
        close: "Close",
      })}</div></div>`
    : "";
  const topic = state.topicId ? getTopicById(state.topicId) : null;
  modal.setAttribute(
    "aria-label",
    topic ? `Topic: ${escapeHtml(topic.article?.title || topic.headline)}` : "Pick a Topic",
  );
}

// ── The list ───────────────────────────────────────────────────────────────
// READY-TO-DRAFT only, and never an ignored one. Same rule as the feed's first
// segment: the scan's classification decides it. The picker has no filter, so it
// has no way to show an ignored Topic and no business inventing one — an ignored
// Topic is never surfaced anywhere except by ticking Ignored on the feed.
//
// Grouped and ordered exactly like the feed, with the feed's own cards, so a
// reader who was just reading the feed is not handed a different-looking object.
function renderListView() {
  const pb = state.playbookId ? getContextById(state.playbookId) : null;
  const feed = pb ? getFeedForPlaybook(pb.id) : null;
  const topics = feed ? getTopicsForFeed(feed.id).filter((t) => t.kind === "ready" && t.status !== "ignored") : [];

  if (!topics.length) {
    return html`<div class="topic-picker__head">
        <h2 class="ap-dialog-title topic-picker__title">Pick a Topic</h2>
      </div>
      ${raw(
        renderEmptyState({
          icon: "ap-icon-antenna",
          title: "Nothing ready to draft yet",
          body: pb
            ? `I haven't found a draft-ready Topic for ${pb.name} yet. There may be some under Topics for later in the feed.`
            : "This chat has no Playbook, so there's no feed to pick from.",
          wrapperClass: "topic-picker__empty",
        }),
      )}`;
  }

  const groups = groupTopicsByAge(topics)
    .map(
      (g) =>
        html`<section class="topic-picker__group">
          <h3 class="topic-picker__group-label">${g.group.label}</h3>
          ${raw(
            g.topics
              .map((t) => renderTopicCard(t, { source: findTopicSource(t.sourceId), variant: "picker" }))
              .join(""),
          )}
        </section>`,
    )
    .join("");

  return html`<div class="topic-picker__head">
      <h2 class="ap-dialog-title topic-picker__title">Pick a Topic</h2>
      <!-- Names the scope rather than offering it as a control: a chat keeps the
           brand it was created in, so this is a fact about where you are, not a
           question. -->
      <p class="topic-picker__scope">
        ${raw(pb ? html`Topics created under the <strong>${pb.name}</strong> Playbook` : "")}
      </p>
    </div>
    <div class="topic-picker__list">${raw(groups)}</div>`;
}

// ── The article ────────────────────────────────────────────────────────────
// No header above it: the article's own h2 IS the title. The back action, when
// there is one, names where it returns — "Back" alone makes the reader guess.
function renderArticleView() {
  const topic = getTopicById(state.topicId);
  if (!topic) return renderListView();
  return html`${raw(
      state.canGoBack
        ? html`<button type="button" class="ap-link standalone small topic-picker__back" data-topic-picker-back>
            <i class="ap-icon-arrow-left" aria-hidden="true"></i><span>Back to the topic list</span>
          </button>`
        : "",
    )}
    <div class="topic-picker__article">
      ${raw(renderTopicArticle(topic, { source: findTopicSource(topic.sourceId) }))}
    </div>`;
}
