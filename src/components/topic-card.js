// topic-card — one dossier, summarised. Three sizes for three surfaces.
//
// Pure render, no store reads: the caller resolves the source and the Playbook
// and passes them in, so the card stays a function of its arguments and can be
// rendered anywhere without knowing where its data came from. Interaction is
// delegated — every hook is a data-* attribute, and all three variants emit the
// SAME three hooks (data-topic-open / -chat / -dismiss), so a host screen wires
// them once regardless of which size it renders.
//
//   renderTopicCard(topic, { source, playbookName })      → the grid card
//   renderTopicLeadCard(topic, { source, playbookName })  → the lead story
//   renderTopicRailCard(topic, { source, playbookName })  → the hero rail
//
// The card body is one big button opening the dialog, and the actions sit
// outside it. That's why the actions live in a sibling footer rather than inside
// the clickable region: a button inside a button is invalid HTML, and the browser
// resolves the nesting unpredictably.

import { html, raw } from "../utils.js?v=22";
import { topicWhen } from "../topics-store.js?v=10";
import { renderSocialPostCard } from "./social-post-card.js?v=8";

// Avatar tints, mirroring social-post-card's set — the footer stacks the post
// authors, so the two surfaces have to agree on what a given accent looks like.
const ACCENTS = new Set([
  "grey",
  "purple",
  "red",
  "menthol",
  "orange",
  "green",
  "electric-blue",
  "yellow",
  "soft-blue",
]);

const MAX_FACES = 3;

function accentFor(author) {
  const a = ((author && author.accent) || "").toLowerCase();
  return ACCENTS.has(a) ? a : "grey";
}

// The authors behind the dossier, as a DS avatar group. Reversed because
// .ap-avatar-group is row-reverse — the first author has to end up leftmost, and
// on top of the stack.
function renderFaces(posts) {
  const shown = posts.slice(0, MAX_FACES);
  const overflow = posts.length - shown.length;
  const faces = shown
    .slice()
    .reverse()
    .map((p) => {
      const author = p.author || {};
      return html`<span class="ap-avatar size-24 social-post-card__avatar" data-accent="${accentFor(author)}"
        ><span class="ap-avatar-initials">${author.initials || "?"}</span></span
      >`;
    })
    .join("");
  const rest = overflow > 0 ? html`<span class="ap-avatar-group-overflow">+${overflow}</span>` : "";
  // No size modifier on the group: its overflow chip defaults to 24px, which is
  // exactly the avatar size used here. Adding `size-32` would resize the chip
  // alone and break the row.
  return html`<span class="ap-avatar-group topic-card__faces" aria-hidden="true">${raw(rest)}${raw(faces)}</span>`;
}

// Kicker left, marks right — two stable anchors instead of one queue of five
// chips. Scanning the feed you look for the SOURCE (which kind of listening found
// this) at a fixed left edge, and for the Playbook / New marks at a fixed right
// edge. In one flat row the badge stayed put but everything else slid sideways
// with the length of the name before it.
//
// Shared by all three variants, so the lead, the grid card and the rail card all
// announce their provenance the same way and the dialog you open from any of them
// repeats the same line back.
function renderEyebrow(topic, { source, playbookName, showPlaybook = true }) {
  return html`<span class="topic-card__eyebrow">
    <span class="topic-card__kicker">
      ${raw(
        source
          ? html`<span class="topic-badge topic-badge--${source.accent}" aria-hidden="true"
                ><i class="${source.icon}"></i></span
              ><span class="topic-card__source">${source.name}</span>
              <span class="topic-card__dot" aria-hidden="true">·</span>`
          : "",
      )}
      <span class="topic-card__when">${topicWhen(topic.ageDays)}</span>
    </span>
    <span class="topic-card__marks">
      ${raw(
        showPlaybook && playbookName
          ? html`<span class="ap-tag grey mini topic-card__playbook">${playbookName}</span>`
          : "",
      )}
      <!-- "New" is a dot + a word styled by this screen, not a DS tag: the DS
           tag palette has no orange variant, and orange is what marks Archie's
           own contribution everywhere else in the app. -->
      ${raw(topic.unseen ? html`<span class="topic-card__new">New</span>` : "")}
    </span>
  </span>`;
}

// Evidence on the left, the two actions on the right. `emphasis` decides whether
// "Start a chat" is filled: the grid renders many cards at once and nine filled
// orange buttons is a wall of spotlight where none of them reads as important,
// but the lead is the only one of its kind on the page — the same argument that
// lets the dialog keep primary.
function renderFoot(topic, posts, { emphasis = false } = {}) {
  const postLabel = posts.length === 1 ? "1 post" : `${posts.length} posts`;
  return html`<footer class="topic-card__foot">
    <span class="topic-card__evidence">
      ${raw(posts.length ? renderFaces(posts) : "")}
      <span class="topic-card__evidence-label">${postLabel}</span>
    </span>
    <span class="topic-card__actions">
      <button type="button" class="ap-button ghost grey" data-topic-dismiss="${topic.id}">
        <span>Dismiss</span>
      </button>
      <button
        type="button"
        class="ap-button ${raw(emphasis ? "primary" : "secondary")} orange"
        data-topic-chat="${topic.id}"
      >
        <i class="ap-icon-single-chat-bubble" aria-hidden="true"></i>
        <span>Start a chat</span>
      </button>
    </span>
  </footer>`;
}

export function renderTopicCard(topic, { source = null, playbookName = "" } = {}) {
  if (!topic) return "";
  const posts = topic.posts || [];

  return html`<article class="topic-card${raw(topic.unseen ? " is-unseen" : "")}" data-topic-id="${topic.id}">
    <button type="button" class="topic-card__body" data-topic-open="${topic.id}">
      ${raw(renderEyebrow(topic, { source, playbookName }))}
      <span class="topic-card__headline">${topic.headline}</span>
      <span class="topic-card__summary">${topic.summary}</span>
    </button>
    ${raw(renderFoot(topic, posts))}
  </article>`;
}

// The lead story. Same object, given the room a front page gives its top item:
// a bigger headline, a deck long enough to be an argument rather than a label,
// and — the part that makes it read as journalism — ONE of the source posts
// quoted in place. The evidence is what a dossier is for, and showing a scrap of
// it is the difference between "Archie found something" and "here is what people
// are saying".
//
// The quote sits INSIDE the body button, which is legal because
// renderSocialPostCard is deliberately inert (no interactive children) — and it
// means clicking the quote opens the dossier, which is what you'd expect.
export function renderTopicLeadCard(topic, { source = null, playbookName = "" } = {}) {
  if (!topic) return "";
  const posts = topic.posts || [];
  const quote = posts[0] || null;

  return html`<article
    class="topic-card topic-card--lead${raw(topic.unseen ? " is-unseen" : "")}"
    data-topic-id="${topic.id}"
  >
    <button type="button" class="topic-card__body" data-topic-open="${topic.id}">
      ${raw(renderEyebrow(topic, { source, playbookName }))}
      <span class="topic-card__headline">${topic.headline}</span>
      <span class="topic-card__summary">${topic.summary}</span>
      ${raw(
        quote
          ? html`<span class="topic-card__quote">${raw(renderSocialPostCard(quote, { compact: true }))}</span>`
          : "",
      )}
    </button>
    ${raw(renderFoot(topic, posts, { emphasis: true }))}
  </article>`;
}

// The hero rail. No deck, no footer: three of these sit under a composer, above
// the workflow starters, and the job is to make a headline tempting enough to
// click — not to let you finish reading without opening it.
//
// The whole card opens the dossier, exactly like a feed card, so the CTA has to
// promise that and not the chat — "Start a chat" here would be a lie, and the
// dialog it opens carries that button anyway. It's a link with an arrow rather
// than a button, the same idiom the starter cards below already use, so the two
// rows read as one hero instead of two toolbars.
//
// Dismiss is deliberately absent. Tidying your feed is what /topics is for; on
// the way into a chat, a grey button next to every headline is noise.
export function renderTopicRailCard(topic, { source = null, playbookName = "" } = {}) {
  if (!topic) return "";
  return html`<article class="topic-rail-card${raw(topic.unseen ? " is-unseen" : "")}" data-topic-id="${topic.id}">
    <button type="button" class="topic-rail-card__body" data-topic-open="${topic.id}">
      ${raw(renderEyebrow(topic, { source, playbookName, showPlaybook: false }))}
      <span class="topic-rail-card__headline">${topic.headline}</span>
      <span class="topic-rail-card__cta ap-link standalone small"
        >See what I found<i class="ap-icon-arrow-right" aria-hidden="true"></i
      ></span>
    </button>
  </article>`;
}
