// The Topic article — ONE renderer, three hosts.
//
// The feed shows it beside the list, the picker shows it inside its own dialog,
// and the in-chat list opens it in that same dialog. All three call the functions
// here, so there is exactly one article and no way for two of them to drift
// apart. Same shape as playbook-view.js and connectors-view.js: pure render
// helpers, no store reads beyond the title resolver, no DOM, no listeners.
//
//   renderTopicHeader(topic, { source, withActions })   the object's identity
//   renderTopicArticle(topic, { source, withHeader })   the prose and the evidence
//   renderTopicActions(topic, { close })                the two verbs
//
// ── Why the identity is its own renderer ───────────────────────────────────
// The feed's pane keeps its header OUTSIDE the scroller, so the title and the
// verbs stay put while the analysis scrolls. It used to keep only the verbs
// there: a strip of "Use in chat / Ignore / Close" above a body whose title sat
// below it, inside the scroller — so the actions had no subject, and scrolling
// took away the one line naming what they act on.
//
// The dialog composes the same two pieces differently: identity inline at the
// top of its scroller, verbs in a sticky footer against its bottom edge. That is
// the host's business. What may NOT differ is what the identity and the verbs
// SAY, which is why both are rendered from here and nowhere else.
//
// ── What the article is ────────────────────────────────────────────────────
// The claim (its own title), the analysis in its two authored sections, and the
// posts the analysis was written from. Nothing else — and in particular no
// version history: an updated Topic reads as its current version, because a
// reader deciding what to post does not need the draft that preceded it.
//
// It carries no "Why now" block of its own beyond the relevance rows below. The
// card used to repeat the reason a Topic was flagged while the mark above already
// said THAT it was flagged, and it could only ever show two clamped lines of an
// explanation whose whole value is the detail.

import { html, raw, escapeAttr } from "./utils.js?v=22";
import { topicTitle } from "./topics-store.js?v=4";
import { renderSocialPostCard } from "./components/social-post-card.js?v=8";
import { renderEmptyState } from "./components/empty-state.js?v=3";

/**
 * The object's identity: the claim as an h2, and where it came from underneath.
 *
 * `withActions: true` also hangs the two verbs and the way out on it — for a host
 * that puts its header outside the scroller and wants them to stay in view with
 * the title they act on. The dialog leaves it false and keeps its own footer.
 */
export function renderTopicHeader(topic, { source = null, withActions = false } = {}) {
  if (!topic) return "";
  // No way out up here. A two-pane reader does not close a message, it opens the
  // next one — the list is right there — so a Close button spent the header's
  // best slot on the one action the layout already provides. Escape still closes
  // the pane, wired by the host.
  return html`<div class="topic-article__head">
    <h2 class="topic-article__title">${topicTitle(topic)}</h2>
    <div class="topic-article__head-meta">
      ${raw(renderProvenance(topic, source))} ${raw(withActions ? renderTopicActions(topic, { close: null }) : "")}
    </div>
  </div>`;
}

/**
 * The prose and the evidence. `withHeader: false` for a host that renders the
 * identity itself, outside the scroller — printing it twice would be the same
 * sentence twice.
 */
export function renderTopicArticle(topic, { source = null, withHeader = true } = {}) {
  if (!topic) return "";
  const article = topic.article || {};
  const paragraphs = article.paragraphs || [];
  const subheads = article.subheads || [];

  // The prose is authored as N paragraphs under M subheads, where the subheads
  // mark where a section STARTS. Two subheads and three paragraphs means the
  // second section runs to the end — so a subhead is emitted before the
  // paragraph at its own index and the rest of the paragraphs fall under the
  // last one opened. Never a section per paragraph: that turned a two-part
  // analysis into a list of headed fragments.
  const body = paragraphs
    .map((p, i) => {
      const head = subheads[i] ? html`<h3 class="topic-article__subhead">${subheads[i]}</h3>` : "";
      return html`${raw(head)}
        <p class="topic-article__para">${p}</p>`;
    })
    .join("");

  const relevance = renderRelevance(topic);
  const posts = topic.posts || [];

  // ── A "later" Topic HAS no detailed version, by definition ────────────────
  // `later` is the scan saying it found a theme worth keeping but not enough
  // material to write up. So the prose slot carries that fact instead of prose —
  // keyed on the KIND, not on whether an article happens to exist, because the
  // kind is the claim being made. Rendering three paragraphs under a "Topics for
  // later" tab said the opposite of the tab.
  //
  // No button of its own: the header's primary IS the action this copy names, and
  // a second Use-in-chat two inches above it would be the same verb asking twice.
  const laterBody = renderEmptyState({
    icon: "ap-icon-note",
    title: "Not enough to write a detailed version yet",
    body: "I haven't found enough content or assets around this topic to draft from. Use it in chat if you have assets that fill the gaps, or leave it here and let a later scan add to it.",
    wrapperClass: "topic-article__empty",
  });

  return html`<div class="topic-article">
    ${raw(withHeader ? renderTopicHeader(topic, { source }) : "")} ${raw(relevance)}
    <div class="topic-article__body">${raw(topic.kind === "later" ? laterBody : body)}</div>
    ${raw(
      posts.length
        ? html`<section class="topic-article__section">
            <!-- "Contributing posts", not "Sources": a Source in this app is
                 something you bring INTO a chat, and these are the evidence the
                 analysis was written from. Naming them Sources put two different
                 objects under one word on the same screen. -->
            <h3 class="topic-article__section-head">
              Contributing posts <span class="ap-counter normal grey">${posts.length}</span>
            </h3>
            <div class="topic-article__posts">${raw(posts.map((p) => renderSocialPostCard(p)).join(""))}</div>
          </section>`
        : "",
    )}
    ${raw(renderHistory(topic))}
  </div>`;
}

// Where it came from and how old it is, on one line under the title. Sentence
// case and caption size — a run of facts, not a labelled header block.
function renderProvenance(topic, source) {
  return html`<p class="topic-article__provenance">
    ${raw(
      source
        ? html`<span class="topic-badge topic-badge--${source.accent}" aria-hidden="true"
              ><i class="${source.icon}"></i></span
            ><span class="topic-article__source">${source.name}</span>`
        : "",
    )}
    <span>· ${topic.ageLabel}</span>
  </p>`;
}

// ── Relevance and Why now ──────────────────────────────────────────────────
// Two rows at most, and only the ones the Topic actually carries. They answer
// who the Topic is for and why it landed now, which is what a reader needs
// before the analysis rather than after it.
//
// Relevance is NEVER tinted, under any signal: who a Topic is for does not change
// because the pile grew or the story moved. Why now takes the signal's tint when
// there is one, because it is the row the signal is about — peach for a spike,
// menthol for a rewrite, nothing at all otherwise. Tinting an ordinary Topic's
// rows would spend the spike's colour on a Topic with no spike.
// ONE SHAPE, TWO INSTANCES. These are the Topic's own two quick facts and they
// are the same RANK, so they get the same block: an icon, a label, a sentence.
//
// ⚠️ They were two different species. Relevance was a paragraph with a bold
// inline "Relevance:" and Why now was a DS infobox — so one read as leftover
// prose and the other as a system alert, 8px apart. The infobox was doubly
// wrong: it is the component for a message the APP is telling you, and these are
// attributes of the Topic. A tinted alert also outranked the analysis it
// introduces.
//
// The hierarchy is the label DOWN, not the sentence up: caption-bold in the light
// ink for the label, body in the default ink for the sentence. The old markup had
// it backwards — a bold dark "Relevance:" competing with its own content.
//
// Grayscale only. The label names the fact and the glyph shapes it; spending an
// accent colour on metadata would leave nothing for the actions. And NOT
// .topic-badge for the glyph, tempting as it is: that pip means "which listening
// source produced this" and the article's header carries one 40px above. The same
// square cannot mean two things on one surface.
const FACTS = [
  { key: "relevance", label: "Relevance", icon: "ap-icon-target" },
  { key: "whyNow", label: "Why now", icon: "ap-icon-clock" },
];

function renderRelevance(topic) {
  const rows = FACTS.filter((f) => topic[f.key]).map(
    (f) =>
      html`<div class="topic-article__fact">
        <i class="${f.icon} topic-article__fact-icon" aria-hidden="true"></i>
        <span class="topic-article__fact-label">${f.label}</span>
        <p class="topic-article__fact-text">${topic[f.key]}</p>
      </div>`,
  );
  if (!rows.length) return "";
  return html`<div class="topic-article__facts">${raw(rows.join(""))}</div>`;
}

// ── The trail ──────────────────────────────────────────────────────────────
// LAST in the article, and COLLAPSED. Last because the reading order is facts,
// then the analysis, then the evidence it was written from, then what happened to
// the Topic - the trail is meta, not part of the argument. Collapsed because 38
// of the 50 Topics that have one have a SINGLE entry: a permanently open section
// would spend a heading and a row on one line of provenance.
//
// The disclosure is the DS accordion, driven by a sibling checkbox rather than by
// a JS class toggle. `.ap-accordion.collapsed` is the DS's own mechanism and it
// wants a class flipped in script - but this renderer is PURE and has three hosts,
// none of which has anywhere to keep an open/closed flag. A checkbox keeps the
// state in the DOM, stays keyboard-operable, and costs one host-scoped rule.
//
// Statuses here are not only review statuses: a trail carries `updated` and
// `trending` too, which are signals. Hence a local label map rather than
// findReviewStatus, which only knows the three review states.
const TRAIL_LABEL = {
  new: "To review",
  used: "Used",
  ignored: "Ignored",
  updated: "Updated",
  trending: "Trending",
};

function renderHistory(topic) {
  const trail = topic.history || [];
  if (!trail.length) return "";
  const id = `topic-trail-${topic.id}`;
  const rows = trail
    .map(
      (h) =>
        html`<li class="topic-article__trail-row">
          <span class="topic-article__trail-head">
            <strong class="topic-article__trail-status">${TRAIL_LABEL[h.status] || h.status}</strong>
            <span class="topic-article__trail-when">${h.when}</span>
          </span>
          ${raw(h.note ? html`<span class="topic-article__trail-note">${h.note}</span>` : "")}
        </li>`,
    )
    .join("");

  return html`<div class="topic-article__history">
    <input type="checkbox" class="topic-article__trail-check" id="${escapeAttr(id)}" />
    <div class="ap-accordion collapsed">
      <label class="ap-accordion-header" for="${escapeAttr(id)}">
        <span class="ap-accordion-title"
          >Topic history <span class="ap-counter normal grey">${String(trail.length)}</span></span
        >
        <i class="ap-icon-chevron-down ap-accordion-toggle" aria-hidden="true"></i>
      </label>
      <div class="ap-accordion-content">
        <ol class="topic-article__trail">
          ${raw(rows)}
        </ol>
      </div>
    </div>
  </div>`;
}

/**
 * The footer's verbs.
 *
 * Two, and the same two everywhere the article is shown — plus, optionally, the
 * host's own way out. `close` names it and the dialog's footer takes it; a falsy
 * `close` omits it, for a host that already renders one (the pane puts it in the
 * header, opposite the title).
 *
 * Use in chat is the PRIMARY and it is ORANGE: it hands the Topic to Archie, and
 * orange is the AI / spotlight action everywhere else in this app. Ignore is a
 * stroked grey secondary, not a red one — ignoring hides a Topic that ticking
 * Ignored brings straight back, so nothing is destroyed and red would be flagging
 * a danger that is not there.
 *
 * An ignored Topic swaps Ignore for Un-ignore: one slot, two directions, never
 * both, because they are one decision read from opposite ends.
 */
export function renderTopicActions(topic, { close = "Close" } = {}) {
  if (!topic) return "";
  const ignored = topic.status === "ignored";
  // Secondary FIRST, primary LAST — the affirmative action is the one you reach
  // last, and in the pane this group is right-aligned so "last" also means
  // closest to the edge the eye lands on. It was the other way round for a
  // commit, which put Ignore in the position the primary should hold.
  return html`<div class="topic-article__actions">
    <!-- The way out comes FIRST and the primary LAST, which is the order the DS
         dialog footer prescribes and the order topic-ignore-modal.js already uses
         (Cancel, then the action). It used to be [Ignore][Use in chat][Close] with
         Close shoved right by a margin - a hand-rolled footer layout inside a
         component that ships one. -->
    ${raw(
      close
        ? html`<button type="button" class="ap-button transparent grey topic-article__close" data-topic-close>
            ${close}
          </button>`
        : "",
    )}
    ${raw(
      ignored
        ? html`<button type="button" class="ap-button stroked grey" data-topic-unignore="${escapeAttr(topic.id)}">
            <i class="ap-icon-eye-on"></i><span>Un-ignore</span>
          </button>`
        : html`<button type="button" class="ap-button stroked grey" data-topic-ignore="${escapeAttr(topic.id)}">
            <i class="ap-icon-eye-off"></i><span>Ignore</span>
          </button>`,
    )}
    <button type="button" class="ap-button primary orange" data-topic-use="${escapeAttr(topic.id)}">
      <i class="ap-icon-single-chat-bubble"></i><span>Use in chat</span>
    </button>
  </div>`;
}
