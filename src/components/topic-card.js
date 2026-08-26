// One Topic, in the three shapes it is read in.
//
//   renderTopicCard(topic, { variant: "feed" })    the queue on /topics
//   renderTopicCard(topic, { variant: "picker" })  inside the Pick-a-topic dialog
//   renderTopicRow(topic)                          the in-chat "Fresh topics" list
//
// The feed and the picker emit the SAME card, part for part — same badge, age,
// status glyph, signals, headline, summary. A reader who has just been reading
// the feed must not be handed a different-looking object when they open the
// picker. The only differences are behavioural: the picker's whole card is a
// control (so it takes the app's card hover wash) and it has no kebab, because it
// offers one verb and hosts it under the article.
//
// ── The card is a reading surface, not a control panel ─────────────────────
// The body is ONE BUTTON covering the whole text area, and it opens the article.
// The verbs live in the article's own footer, where the reader has just finished
// reading the thing they are deciding on — the earlier shape asked them to decide
// from two clamped lines of summary. The kebab is the shortcut for the reader who
// does not want to open the full read.
//
// The kebab is a SIBLING of the body button, never inside it: a button inside a
// button is invalid HTML and the browser resolves the nesting unpredictably.
// Everything inside the body is a <span> for the same reason — a button may only
// contain phrasing content, so no h3 and no p in there.

import { html, raw, escapeAttr } from "../utils.js?v=22";
import { topicTitle } from "../topics-store.js?v=1";
import { findReviewStatus } from "../topics-catalog.js?v=2";

// ── The signal marks ───────────────────────────────────────────────────────
// Trending and Updated, in words as well as colour: colour alone is never the
// signal (the label is what a screen reader gets, and what a colour-blind reader
// gets). Updated is the deliberately quieter of the two — a rewrite is worth
// knowing about, a spike is worth acting on today.
function renderTrendingMark() {
  return html`<span class="trending-mark"
    ><i class="ap-icon-arrow-up" aria-hidden="true"></i><span>Trending</span></span
  >`;
}

function renderUpdatedMark() {
  return html`<span class="updated-mark"><i class="ap-icon-refresh" aria-hidden="true"></i><span>Updated</span></span>`;
}

// The triage glyph, immediately right of the age — the left of the meta row is
// the Topic's own facts (where it came from, how old it is) and its review state
// reads as one of them, rather than as a chip competing with the signals.
//
// `new` renders NOTHING, and that is the design: it is the absence of a marker.
// The other two record something the reader DID; this one records that they have
// not, and a glyph meaning "nothing has happened" is the one thing a glyph cannot
// say. It was also the most common value in a feed, so it would spend a marker on
// almost every row to convey nothing.
function renderStatusGlyph(status) {
  const s = findReviewStatus(status);
  if (!s || !s.icon) return "";
  return html`<span class="topic-card__status" title="${s.label} — ${s.hint}"
    ><i class="${s.icon}" aria-hidden="true"></i><span class="app-sr-only">${s.label}</span></span
  >`;
}

function renderMeta(topic, source) {
  return html`<span class="topic-card__meta">
    ${raw(
      source
        ? html`<span class="topic-badge topic-badge--${source.accent}" aria-hidden="true"
              ><i class="${source.icon}"></i></span
            ><span class="topic-card__source">${source.name}</span>`
        : "",
    )}
    <span class="topic-card__age">· ${topic.ageLabel}</span>
    ${raw(renderStatusGlyph(topic.status))}
    ${raw(topic.isTrending ? renderTrendingMark() : "")}${raw(topic.isUpdated ? renderUpdatedMark() : "")}
  </span>`;
}

/**
 * The card. `source` is passed in rather than looked up: the host already has
 * the catalogue in hand and resolving it per card would be one lookup per row.
 *
 * `articleOpen` paints the reading state; the same fact is on the button as
 * aria-expanded, because the selected card must not be carried by colour alone.
 */
export function renderTopicCard(
  topic,
  { source = null, variant = "feed", menuOpen = false, articleOpen = false } = {},
) {
  if (!topic) return "";
  const picker = variant === "picker";
  const ignored = topic.status === "ignored";

  return html`<article
    class="topic-card${raw(picker ? " topic-card--picker" : "")}${raw(articleOpen ? " is-reading" : "")}"
    data-topic-id="${escapeAttr(topic.id)}"
  >
    <button
      type="button"
      class="topic-card__body"
      data-topic-read="${escapeAttr(topic.id)}"
      ${raw(picker ? "" : `aria-expanded="${articleOpen ? "true" : "false"}"`)}
    >
      ${raw(renderMeta(topic, source))}
      <span class="topic-card__headline">${topicTitle(topic)}</span>
      <!-- No "Summary:" label. Every card carried one, so it labelled nothing —
           a two-line block under a headline is self-evidently the summary, and
           the word ate a chunk of the first of only two visible lines. -->
      <span class="topic-card__summary">${topic.summary}</span>
      <!-- The reason only ever shows on an ignored Topic, and only in the feed:
           it is the sentence the reader typed, and without it Ignored is a state
           with no explanation attached. The picker never lists an ignored Topic,
           so it can never render this. -->
      ${raw(
        ignored && topic.ignoreReason
          ? html`<span class="topic-card__reason"
              ><span class="topic-card__reason-label">You ignored this:</span> ${topic.ignoreReason}</span
            >`
          : "",
      )}
    </button>
    ${raw(picker ? "" : renderKebab(topic, menuOpen))}
  </article>`;
}

// Two rows, and deliberately only two. Four behind one trigger is a menu; two is
// the shortcut for the reader who does not want to open the article. If a third
// verb turns up, revisit rather than grow it.
//
// ONE SLOT, TWO DIRECTIONS on the second row: Ignore, or Un-ignore. Never both,
// because they are one decision read from opposite ends. An ignored Topic used to
// get no row at all, which left the decision with no way back on the surface that
// took it.
//
// No red mode on Ignore. Ignoring hides a Topic that ticking Ignored brings back
// — nothing is destroyed — so red would be flagging a danger that is not there.
function renderKebab(topic, menuOpen) {
  const ignored = topic.status === "ignored";
  return html`<button
      type="button"
      class="ap-icon-button transparent topic-card__more"
      data-topic-more="${escapeAttr(topic.id)}"
      aria-haspopup="menu"
      aria-expanded="${menuOpen ? "true" : "false"}"
      aria-label="More actions"
    >
      <i class="ap-icon-more"></i>
    </button>
    ${raw(
      menuOpen
        ? html`<div class="ap-action-dropdown topic-card__menu" role="menu">
            ${raw(menuRow(topic.id, "data-topic-use", "ap-icon-single-chat-bubble", "Use in chat"))}
            ${raw(
              ignored
                ? menuRow(topic.id, "data-topic-unignore", "ap-icon-eye-on", "Un-ignore", "Back on this list to review")
                : menuRow(
                    topic.id,
                    "data-topic-ignore",
                    "ap-icon-eye-off",
                    "Ignore",
                    "Kept off this list, even if it trends or updates",
                  ),
            )}
          </div>`
        : "",
    )}`;
}

// The DS Action Dropdown's own markup. `has-description` is the DS's two-line
// variant — the description states the OUTCOME rather than repeating the label.
function menuRow(topicId, attr, icon, label, description = "") {
  return html`<button
    type="button"
    role="menuitem"
    class="ap-action-dropdown-item${raw(description ? " has-description" : "")}"
    ${raw(`${attr}="${escapeAttr(topicId)}"`)}
  >
    <i class="${icon}"></i>
    <div class="ap-action-dropdown-item-text">
      <div class="ap-action-dropdown-item-label-container">
        <span class="ap-action-dropdown-item-label">${label}</span>
      </div>
      ${raw(description ? html`<span class="ap-action-dropdown-item-description">${description}</span>` : "")}
    </div>
  </button>`;
}

// ── The in-chat row ────────────────────────────────────────────────────────
// A different shape for a different job: the feed's card is a thing you triage,
// this is a line in a short list you skim before starting a chat. One button per
// row, and it OPENS THE ARTICLE — it does not choose the Topic. That decision
// comes after reading.
//
// No Playbook chip per row, unlike the fork. Every row in this list belongs to
// the chat's own Playbook, so a chip repeated identically six times — under a
// composer that already names the same Playbook — labels nothing. The section
// header carries the scope once.
//
// The signal mark rides at the END OF THE TITLE, inline, so it reads as part of
// the sentence it qualifies rather than as a second label on its own line.
export function renderTopicRow(topic, { source = null } = {}) {
  if (!topic) return "";
  const mark = topic.isTrending ? renderTrendingMark() : topic.isUpdated ? renderUpdatedMark() : "";
  return html`<button type="button" class="topic-row" data-topic-read="${escapeAttr(topic.id)}">
    <span class="topic-row__glyph">
      ${raw(
        source
          ? html`<span class="topic-badge topic-badge--${source.accent}" aria-hidden="true"
              ><i class="${source.icon}"></i
            ></span>`
          : "",
      )}
    </span>
    <span class="topic-row__text">
      <span class="topic-row__title">${topicTitle(topic)}${raw(mark ? ` ${mark}` : "")}</span>
      <span class="topic-row__summary">${topic.summary}</span>
    </span>
  </button>`;
}
