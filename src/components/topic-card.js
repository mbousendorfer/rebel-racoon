// One Topic, in the two shapes it is read in.
//
//   renderTopicCard(topic, { variant: "feed" })    the queue on /topics
//   renderTopicCard(topic, { variant: "picker" })  the Pick-a-topic dialog, and
//                                                  the new chat's Fresh-topics grid
//
// There WAS a third shape — renderTopicRow, a full-width row for the new chat's
// hero. Six of them stacked ran ~500px tall and pushed the workflow starters off
// the fold, and a row cannot carry an action without becoming a card anyway. The
// hero now renders the picker's card in a grid, so a Topic looks the same
// wherever it is read, and the shape count went down rather than up.
//
// The feed and the picker emit the SAME CARD, part for part — same frame, badge,
// age, status glyph, signals, headline, summary. A reader who has just been
// reading the feed must not be handed a different-looking object when they open
// the picker. The only difference is that the feed's card can be the one
// currently OPEN beside the list and the picker's cannot: one click there chooses
// the Topic, so nothing stays selected long enough to need marking.
//
// The feed variant was called `row` for one commit, when the list really was a
// continuous surface ruled by hairlines instead of a column of cards. That went
// too far — a wall of cards comes from the gaps and the weight, not from the
// cards having edges — and it left the screen as one 1440px slab belonging to no
// other surface in this app.
//
// The card also carries the reader's own progress: an untriaged Topic is set in
// the headline's full weight and a triaged one drops back a step. That is the
// unread/read idiom every mail client uses, and it is the other half of why the
// `new` status renders no glyph — the card's weight already says it.
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
import { topicTitle, topicStates } from "../topics-store.js?v=9";
import { findTopicState } from "../topics-catalog.js?v=4";

// ── The state chips: ONE species, five tones ──────────────────────────────
// Every state a Topic carries renders as a DS Tag — `.ap-tag <tone>` + glyph +
// word, from the tone and icon topics-catalog declares per state.
//
// ⚠️ This replaced TWO renderers that put one vocabulary at two levels: the two
// signals were already DS pills, while Already used and Ignored were bare neutral
// icons with a `title`, and For later was not on the card at all — it was a whole
// tab. A pill, an icon and a tab for what a reader thinks of as one list.
//
// ⚠️ IT WAS `.ap-status`, and that was the wrong sibling. Status has no icon slot,
// so the glyph had to be smuggled into the dot's place with `no-dot` — a modifier
// whose whole job is to REMOVE the dot, used to repurpose it. Tag styles `> i` and
// `> span` as real slots (12px glyph, 180px truncating label), carries a border as
// well as a fill so a chip has an edge, and ships the five tones this vocabulary
// needs. Height, radius, padding and type all resolve from --comp-tag-*, so this
// still costs no CSS of its own.
//
// One consequence, and it is a fix: Tag has no plain-`orange` modifier. Trending
// wore `orange` — the AI / spotlight ACTION colour the header's Use-in-chat primary
// owns — on a static chip. It takes `tagOrange` now, and Updated moves to
// `menthol`, cool against Trending's warm so the two signals differ rather than
// reading as two shades of one thing.
//
// `new` renders nothing, and that is the design: it is the absence of an answer,
// the most common value in any feed, and a glyph meaning "nothing has happened
// yet" is the one thing a glyph cannot say. It keeps its filter row.
//
// A Topic can wear more than one — Already used AND Trending is a real state, and
// showing both is the point. They sit in one group at the end of the meta row so
// the row wraps as a unit instead of one chip at a time.
//
// Colour is never the only signal: each chip carries its word, so a colour-blind
// reader and a screen reader both get "Trending" either way. The `title` carries
// the state's hint, which says what it MEANS rather than repeating the label.
function renderStateChips(topic) {
  const chips = topicStates(topic)
    .map((id) => findTopicState(id))
    .filter((st) => st && st.chip)
    .map(
      (st) =>
        html`<span class="ap-tag ${st.tone}" title="${st.label} — ${st.hint}">
          <i class="${st.icon}" aria-hidden="true"></i><span>${st.label}</span>
        </span>`,
    )
    .join("");
  if (!chips) return "";
  return html`<span class="topic-card__states">${raw(chips)}</span>`;
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
    ${raw(renderStateChips(topic))}
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
  { source = null, variant = "feed", menuOpen = false, articleOpen = false, withUse = false } = {},
) {
  if (!topic) return "";
  const picker = variant === "picker";
  const ignored = topic.status === "ignored";
  // Read/unread, in the mail-reader sense: `new` is the one status still waiting
  // for an answer, so everything else has been dealt with and steps back.
  const triaged = topic.status !== "new";

  return html`<article
    class="topic-card topic-card--${raw(picker ? "picker" : "feed")}${raw(triaged ? " is-triaged" : "")}${raw(
      articleOpen ? " is-reading" : "",
    )}"
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
    <!-- The verb ON the card, for a host that has no kebab and sits beside other
         cards you click to START something — the new chat's hero. A sibling of
         the body button, never inside it: a button in a button is invalid HTML.
         The body still opens the article, so "read before you choose" keeps its
         door; this is the second one, for the reader who already knows. -->
    ${raw(
      withUse
        ? html`<div class="topic-card__act">
            <!-- secondary + blue, a DS-shipped variant: electric-blue-10 fill,
                 electric-blue-100 ink. Blue because this is the SECONDARY door
                 into a chat - blue is the interactive/navigation colour in this
                 app, and orange is kept for the spotlight primary, which is the
                 one in the article's own header. Was secondary orange for a
                 commit; that spent the AI colour on a second-rank entry point.
                 NOTE no backticks in here - this is inside a template literal. -->
            <button type="button" class="ap-button secondary blue" data-topic-use="${escapeAttr(topic.id)}">
              <i class="ap-icon-single-chat-bubble"></i><span>Use in chat</span>
            </button>
          </div>`
        : "",
    )}
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
