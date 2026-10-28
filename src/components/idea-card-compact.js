// Compact idea card — the card used by the right-panel Ideas mode and the
// conversation extraction turns, now shared so the standalone Ideas page can
// render the exact same component.
//
// Pure renderer: all interactive state is passed in, so each consumer owns
// its own feedback / why-open state and wires the data-* handlers:
//   data-rpanel-ideas-feedback (+ data-verdict)  → thumbs up / down
//   data-rpanel-idea-why-toggle                  → expand / collapse "Why"
//   data-rpanel-mention-idea                     → Mention (composer)
//   data-rpanel-use-idea                         → Draft (angle picker)
//
//   renderCompactIdeaCard(idea, sources, { verdict, whyOpen, showMention })
//     idea     — { id, kind, title, body, sourceIds[], ref, rationale }
//     sources  — full source list (linked sources resolved by id)
//     verdict  — "up" | "down" | null (active thumb)
//     whyOpen  — boolean (Why panel expanded)
//     showMention — render the Mention button (default true; false where there
//                   is no composer, e.g. the standalone Ideas page)

import { iconFor } from "../file-kinds.js?v=2342";
import { escapeText, escapeAttr } from "../utils.js?v=2342";
import { isFlagOn } from "../feature-flags.js?v=2342";

// Each idea kind → its DS `.ap-tag` colour variant. The one table: every kind
// tag (this card, the panel's Overview and Sources, the full idea card, the
// composer's mention pills) reads it.
export const IDEA_KIND_TAG = { stat: "blue", quote: "menthol", hook: "tagOrange", story: "grey", insight: "green" };

// What each kind of idea is, in the kind tag's tooltip (flag uiIdeaCard).
const IDEA_KIND_HINT = {
  hook: "An opening line built to stop the scroll",
  stat: "A number from your source, made the point of a post",
  quote: "A line worth quoting, with its context",
  story: "A moment to tell, start to finish",
  insight: "A takeaway your audience can use",
};

// The whole card is the Draft target. Its hover border says "clickable", and
// FullStory showed people clicking the idea's text and getting nothing (dead
// clicks on the body, then a hunt for the Draft button). A click anywhere on
// the card that isn't a control, the Why panel or the footer forwards to the
// card's own Draft button, so every host's existing data-rpanel-use-idea
// wiring runs unchanged. The Draft button stays the keyboard / screen-reader
// path. Skipped while the reader is selecting text (people copy ideas out) and
// inside the inert hover preview. ES modules run once, so this is installed once.
document.addEventListener("click", (event) => {
  const card = event.target.closest(".rpanel-ideas__card");
  if (!card || card.closest("[inert]")) return;
  if (
    event.target.closest(
      "button, a, input, label, select, textarea, .rpanel-ideas__why, .rpanel-ideas__rationale, .rpanel-ideas__card-actions",
    )
  )
    return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && card.contains(selection.anchorNode)) return;
  const draftBtn = card.querySelector("[data-rpanel-use-idea]");
  if (draftBtn && !draftBtn.disabled) draftBtn.click();
});

export function renderCompactIdeaCard(
  idea,
  sources = [],
  { verdict = null, whyOpen = false, showMention = true } = {},
) {
  if (isFlagOn("uiIdeaCard")) return renderClearIdeaCard(idea, sources, { verdict, whyOpen, showMention });
  const kind = idea.kind || "insight";
  const linkedSources = (idea.sourceIds || []).map((id) => sources.find((s) => s.id === id)).filter(Boolean);

  const thumbBtn = (side) => {
    const isActive = verdict === side;
    const icon = isActive ? `ap-icon-thumb-${side}_fill` : `ap-icon-thumb-${side}`;
    const label = side === "up" ? "Mark idea as useful" : "Mark idea as not useful";
    return `
      <button
        type="button"
        class="ap-icon-button transparent sm rpanel-ideas__thumb${isActive ? " is-active" : ""}"
        data-rpanel-ideas-feedback="${escapeAttr(idea.id)}"
        data-verdict="${side}"
        aria-pressed="${isActive}"
        aria-label="${label}"
        title="${label}"
      >
        <i class="${icon}"></i>
      </button>
    `;
  };

  const whyId = `rpanel-idea-why-${idea.id}`;
  const sourceTags = linkedSources.length
    ? linkedSources
        .map(
          (s) => `
            <span class="ap-tag grey" title="${escapeAttr(s.filename)}">
              <i class="${iconFor(s.kind)}" aria-hidden="true"></i>
              <span>${escapeText(s.filename)}</span>
            </span>
          `,
        )
        .join("")
    : idea.ref
      ? `<span class="ap-tag grey" title="${escapeAttr(idea.ref)}">
           <i class="ap-icon-file" aria-hidden="true"></i>
           <span>${escapeText(idea.ref)}</span>
         </span>`
      : "";

  const whyPanel = idea.rationale
    ? `
      <section class="rpanel-ideas__why" data-why-open="${whyOpen ? "true" : "false"}">
        <button
          type="button"
          class="rpanel-ideas__why-head"
          data-rpanel-idea-why-toggle="${escapeAttr(idea.id)}"
          aria-expanded="${whyOpen ? "true" : "false"}"
          aria-controls="${whyId}"
        >
          <i class="ap-icon-info rpanel-ideas__why-info" aria-hidden="true"></i>
          <span class="rpanel-ideas__why-title">Why this idea</span>
          <i class="ap-icon-chevron-${whyOpen ? "up" : "down"} rpanel-ideas__why-chevron" aria-hidden="true"></i>
        </button>
        <div id="${whyId}" class="rpanel-ideas__why-body" ${whyOpen ? "" : "hidden"}>
          <p class="rpanel-ideas__why-rationale">${escapeText(idea.rationale)}</p>
        </div>
      </section>
    `
    : "";

  const cardHead = `
    <div class="rpanel-ideas__card-head">
      <span class="ap-tag ${IDEA_KIND_TAG[kind] || "green"} rpanel-ideas__kind">${kind.charAt(0).toUpperCase() + kind.slice(1)}</span>
      ${
        sourceTags
          ? `<div class="rpanel-ideas__head-source">
              <span class="rpanel-ideas__source-label">Source:</span>
              ${sourceTags}
            </div>`
          : ""
      }
    </div>
  `;

  const mentionBtn = showMention
    ? `<button type="button" class="ap-button ghost blue rpanel-ideas__mention" data-rpanel-mention-idea="${escapeAttr(idea.id)}">
        <i class="ap-icon-at"></i>
        <span>Reference</span>
      </button>`
    : "";

  return `
    <article class="rpanel-ideas__card" data-idea-id="${escapeAttr(idea.id)}">
      <div class="rpanel-ideas__card-content">
        ${cardHead}
        ${idea.title ? `<h4 class="rpanel-ideas__card-title">${escapeText(idea.title)}</h4>` : ""}
        <p class="rpanel-ideas__card-body">${escapeText(idea.body || "")}</p>
        ${whyPanel}
      </div>
      <footer class="rpanel-ideas__card-actions">
        <div class="rpanel-ideas__feedback">
          ${thumbBtn("up")}
          ${thumbBtn("down")}
        </div>
        <div class="rpanel-ideas__primary">
          ${mentionBtn}
          <button type="button" class="ap-button secondary blue rpanel-ideas__use" data-rpanel-use-idea="${escapeAttr(idea.id)}">
            <i class="ap-icon-sparkles"></i>
            <span>Draft post</span>
          </button>
        </div>
      </footer>
    </article>
  `;
}

// Flag `uiIdeaCard` ON: the card says what it is ("Story idea", the thumbs
// beside it), where it comes from ("From notes.pdf", Why this idea at the end
// of that line) and what to do with it (a footer of actions alone). Same
// options and data-* hooks as the card below, so every host wires both alike.
function renderClearIdeaCard(idea, sources = [], { verdict = null, whyOpen = false, showMention = true } = {}) {
  const kind = idea.kind || "insight";
  const linkedSources = (idea.sourceIds || []).map((id) => sources.find((s) => s.id === id)).filter(Boolean);

  const thumbBtn = (side) => {
    const isActive = verdict === side;
    const icon = isActive ? `ap-icon-thumb-${side}_fill` : `ap-icon-thumb-${side}`;
    const label = side === "up" ? "Mark idea as useful" : "Mark idea as not useful";
    return `
      <button
        type="button"
        class="ap-icon-button transparent sm rpanel-ideas__thumb${isActive ? " is-active" : ""}"
        data-rpanel-ideas-feedback="${escapeAttr(idea.id)}"
        data-verdict="${side}"
        aria-pressed="${isActive}"
        aria-label="${label}"
        title="${label}"
      >
        <i class="${icon}"></i>
      </button>
    `;
  };

  // Where the idea comes from, said as a sentence ("From notes.pdf"), not a
  // second grey pill beside the kind: the kind says what it is, this says
  // where it was found. More than one source → the first, "+ N more", all in
  // the tooltip.
  const fromNames = linkedSources.length ? linkedSources.map((s) => s.filename) : idea.ref ? [idea.ref] : [];
  const fromIcon = linkedSources.length ? iconFor(linkedSources[0].kind) : "ap-icon-file";
  const fromLine = fromNames.length
    ? `<span class="rpanel-ideas__from" title="${escapeAttr(fromNames.join(", "))}">
        <i class="${fromIcon}" aria-hidden="true"></i>
        <span class="rpanel-ideas__from-text">From <span class="rpanel-ideas__from-name">${escapeText(fromNames[0])}</span></span>
        ${fromNames.length > 1 ? `<span class="rpanel-ideas__from-more">+ ${fromNames.length - 1} more</span>` : ""}
      </span>`
    : "";

  // "Why this idea" is a quiet toggle on the provenance line; the rationale
  // gets its grey-05 box only once it's open, when there is something in it.
  const whyId = `rpanel-idea-why-${idea.id}`;
  const whyToggle = idea.rationale
    ? `<button
        type="button"
        class="rpanel-ideas__why-toggle"
        data-rpanel-idea-why-toggle="${escapeAttr(idea.id)}"
        aria-expanded="${whyOpen ? "true" : "false"}"
        aria-controls="${whyId}"
      >
        <span>Why this idea</span>
        <i class="ap-icon-chevron-down" aria-hidden="true"></i>
      </button>`
    : "";
  const rationale = idea.rationale
    ? `<p id="${whyId}" class="rpanel-ideas__rationale" ${whyOpen ? "" : "hidden"}>${escapeText(idea.rationale)}</p>`
    : "";

  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
  // The head says what this is: an idea, and which kind ("Story idea" — a
  // bare "Story" reads as an Instagram Story in a social tool), the kind's
  // meaning in its tooltip. Rating it sits beside it: a verdict on the idea,
  // not something to do with it, so it stays out of the actions row.
  const cardHead = `
    <div class="rpanel-ideas__card-head">
      <span class="ap-tag ${IDEA_KIND_TAG[kind] || "green"} rpanel-ideas__kind" title="${escapeAttr(IDEA_KIND_HINT[kind] || "")}">${kindLabel} idea</span>
      <div class="rpanel-ideas__feedback">
        ${thumbBtn("up")}
        ${thumbBtn("down")}
      </div>
    </div>
  `;

  const mentionBtn = showMention
    ? `<button type="button" class="ap-button ghost blue rpanel-ideas__mention" data-rpanel-mention-idea="${escapeAttr(idea.id)}" title="Add this idea to your message, to ask me about it">
        <i class="ap-icon-at"></i>
        <span>Reference</span>
      </button>`
    : "";

  return `
    <article class="rpanel-ideas__card" data-idea-id="${escapeAttr(idea.id)}">
      <div class="rpanel-ideas__card-content">
        ${cardHead}
        ${idea.title ? `<h4 class="rpanel-ideas__card-title">${escapeText(idea.title)}</h4>` : ""}
        <p class="rpanel-ideas__card-body">${escapeText(idea.body || "")}</p>
        ${
          fromLine || whyToggle
            ? `<div class="rpanel-ideas__meta" data-why-open="${whyOpen ? "true" : "false"}">${fromLine}${whyToggle}</div>`
            : ""
        }
        ${rationale}
      </div>
      <footer class="rpanel-ideas__card-actions">
        <div class="rpanel-ideas__primary">
          ${mentionBtn}
          <button type="button" class="ap-button secondary blue rpanel-ideas__use" data-rpanel-use-idea="${escapeAttr(idea.id)}" title="Write a post from this idea">
            <i class="ap-icon-sparkles"></i>
            <span>Draft post</span>
          </button>
        </div>
      </footer>
    </article>
  `;
}
