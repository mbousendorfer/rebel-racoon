// The Topic article — ONE renderer, three hosts.
//
// The feed shows it beside the list, the picker shows it inside its own dialog,
// and the in-chat list opens it in that same dialog. All three call the functions
// here, so there is exactly one article and no way for two of them to drift
// apart. Same shape as playbook-view.js and connectors-view.js: pure render
// helpers, no store reads beyond the title resolver, no DOM, no listeners.
//
//   renderTopicArticle(topic, { source })  the header, the prose, the evidence
//   renderTopicActions(topic, { close })   the footer's verbs
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
import { topicTitle } from "./topics-store.js?v=1";
import { renderSocialPostCard } from "./components/social-post-card.js?v=8";

/**
 * The article's body. `withTitle: false` for a host that already prints the
 * title in its own header — the dialog does, and printing it twice would be the
 * same sentence twice.
 */
export function renderTopicArticle(topic, { source = null, withTitle = true } = {}) {
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

  return html`<div class="topic-article">
    ${raw(
      withTitle
        ? html`<h2 class="topic-article__title">${topicTitle(topic)}</h2>
            ${raw(renderProvenance(topic, source))}`
        : raw(renderProvenance(topic, source)),
    )}
    ${raw(relevance)}
    <div class="topic-article__body">${raw(body)}</div>
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
function renderRelevance(topic) {
  const rows = [];
  if (topic.relevance) {
    rows.push(
      html`<p class="topic-article__fact">
        <strong class="topic-article__fact-label">Relevance:</strong> ${topic.relevance}
      </p>`,
    );
  }
  if (topic.whyNow) {
    const tone = topic.isTrending
      ? " topic-article__fact--trending"
      : topic.isUpdated
        ? " topic-article__fact--updated"
        : "";
    rows.push(
      html`<p class="topic-article__fact${raw(tone)}">
        <strong class="topic-article__fact-label">Why now:</strong> ${topic.whyNow}
      </p>`,
    );
  }
  if (!rows.length) return "";
  return html`<div class="topic-article__facts">${raw(rows.join(""))}</div>`;
}

/**
 * The footer's verbs.
 *
 * Two, and the same two everywhere the article is shown — plus the host's own way
 * out. `close` names it: the feed's pane says "Close" because the list is still
 * there behind it, and the dialog says the same for the same reason.
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
  return html`<div class="topic-article__actions">
    <button type="button" class="ap-button primary orange" data-topic-use="${escapeAttr(topic.id)}">
      <i class="ap-icon-single-chat-bubble"></i><span>Use in chat</span>
    </button>
    ${raw(
      ignored
        ? html`<button type="button" class="ap-button stroked grey" data-topic-unignore="${escapeAttr(topic.id)}">
            <i class="ap-icon-eye-on"></i><span>Un-ignore</span>
          </button>`
        : html`<button type="button" class="ap-button stroked grey" data-topic-ignore="${escapeAttr(topic.id)}">
            <i class="ap-icon-eye-off"></i><span>Ignore</span>
          </button>`,
    )}
    <button type="button" class="ap-button ghost grey topic-article__close" data-topic-close>${close}</button>
  </div>`;
}
