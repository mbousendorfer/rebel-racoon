// post-card — full-fidelity LinkedIn-style draft preview card.
//
// Originally rendered inside the session screen's Posts tab (dropped at
// Lot 4.4). Lot 21 lifts the renderer out so the right-panel Drafts
// surface can use the rich format the user wanted instead of the
// compact BatchCard.
//
// Each card shows: author block (avatar + name + title + visibility),
// status pill or scheduled/error notice above the card, full body text
// + hashtags + CTA, image (or "Generate an image" placeholder),
// engagement stats, and a decorative LinkedIn-style action footer
// (Like / Comment / Repost / Send). To the right of the card sits an
// action stack — sparkles (rewrite) / bookmark (save as draft) /
// calendar (schedule) / trash (delete). Each carries a `data-post-*`
// attribute ; the consumer wires the actions via event delegation.
//
// Render is pure ; no module-local state. Caller passes the post
// object (cf. posts-store.js / mocks.js) and an optional `opts.focusPost`
// id used to apply the focus pulse animation when navigating in via
// `?focusPost=<id>`.

import { html, raw, formatClock, escapeText, escapeAttr } from "../utils.js?v=2564";
import { isPortraitFormat } from "../clip-formats.js?v=2564";
import { presetById } from "../clip-captions.js?v=2564";
import { renderFeedbackControl } from "./feedback-control.js?v=2564";
import {
  networkLabel,
  normalizeNetwork,
  profileForNetwork,
  renderProfileTag,
  BRAND_INITIALS,
} from "../social-profiles.js?v=2564";
import { validatePost, usedCharacters, youtubeTitle } from "../post-validation.js?v=2564";
import { REVEAL_MS } from "../archie-pixels.js?v=2564";
import { diffWords, diffParagraphs, hasChanges } from "../word-diff.js?v=2564";
import { languageOf } from "../draft-rewrite.js?v=2564";

// The media slot of a draft that has no image yet. ONE dashed slot, two tiers
// (2026-10-07):
//
//   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
//            [✦ Generate an image]              tier 1 — the shortcut (mermaid)
//          In <look>, <shape>. Change              + what it will make
//          (no look yet: "First, I'll ask how …'s images should look.")
//
//      [🖼 Image Studio] [⬆ Upload]            tier 2 — doing it yourself,
//   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    two stroked grey buttons
//
// Tier 1: `.ap-button.mermaid`, the DS's AI treatment (a gradient BORDER: the
//    DS ships no filled AI button). Under it, small, the shortcut it runs (flag
//    sexySquirrel, `opts.imagePreset` from the drafts panel — the card never
//    reads the Playbook): the look's name and this network's shape. "Change"
//    opens the PLAYBOOK, where that preset is set — ⚠️ NOT the Image Studio
//    (rejected): the preset is a setting, the studio a tool.
// Tier 2: the Image Studio and Upload as one row of `stroked grey` buttons, a
//    group-gap below Generate — never BESIDE it (side by side, two outlined
//    rectangles read as equals: rejected). Ghost, they floated in the dashed
//    frame with nothing to hold them; stacked one per row, four centred lines
//    of different widths had no shared edge (both 2026-10-07).
// The WHOLE slot is the drop target (dashed = a real drop, wired in
// right-panel.js on `[data-post-drop]`, drag events only); Upload reuses the
// rail's `data-post-image-upload`.
function renderImagePreset(opts) {
  const p = opts.imagePreset;
  if (!p || !opts.playbookId) return "";
  const shape = p.shape ? `${escapeText(p.shape.label.toLowerCase())} ${escapeText(p.shape.ratio)}` : "";
  const playbook = (label) =>
    `<button type="button" class="ap-link small" data-post-image-preset="${escapeAttr(opts.playbookId)}">${label}</button>`;
  // No look yet: the first click asks for one (draft-image-flow.js requireImageLook).
  if (p.ask)
    return `<p class="posts__card-media-preset">First, I'll ask how ${escapeText(p.brandName)}'s images should look.</p>`;
  return p.look
    ? `<p class="posts__card-media-preset">In ${escapeText(p.look.label)}${shape ? `, ${shape}` : ""}. ${playbook("Change")}</p>`
    : "";
}

// The image loader / reveal (src/archie-pixels.js) in a draft's image box.
// Generating — first image or Try another, over the current one — the field
// and its narrated stages; just after, the arrival over the new <img>. The
// element writes its own narration and holds its own (Archie's) colours.
function renderImagePixels(post) {
  if (post.isGeneratingImage)
    return `<archie-pixels role="status" aria-busy="true" data-since="${post.imageGeneratingSince || ""}"></archie-pixels>`;
  return post.imageRevealAt && Date.now() - post.imageRevealAt < REVEAL_MS
    ? `<archie-pixels data-reveal-at="${post.imageRevealAt}"></archie-pixels>`
    : "";
}

// `opts.brandGaps` / `opts.playbookId` come from the host (the drafts panel) —
// the card never resolves a Context itself. A host that passes neither, like the
// studio's own in-feed preview, simply gets no hint.
function renderEmptyMedia(post, opts) {
  // Generating: the image's own 4:3 box, filled by the pixel field — the
  // reveal then lands exactly where the image stays.
  if (post.isGeneratingImage) {
    return `<div class="posts__card-media-generating">${renderImagePixels(post)}</div>`;
  }

  const gaps = Array.isArray(opts.brandGaps) ? opts.brandGaps : [];
  // "a logo, brand colors and reference images" — the list names what is
  // missing, because "your brand kit is incomplete" sends you hunting.
  const labels = gaps.map((g) => g.label);
  const gapList =
    labels.length > 1
      ? `${labels.slice(0, -1).join(", ")}${labels.length > 2 ? "," : ""} and ${labels[labels.length - 1]}`
      : labels[0] || "";
  const hint =
    gaps.length && opts.playbookId
      ? `<p class="posts__card-media-empty-hint muted">
          Add ${gapList} to the Playbook and I'll work them into every image I make.
          <button type="button" class="ap-link small" data-post-playbook-gap="${opts.playbookId}">Open Playbook</button>
        </p>`
      : "";

  return `<div class="posts__card-media-empty">
    <div class="posts__card-media-slot" data-post-drop="${escapeAttr(post.id)}">
      <div class="posts__card-media-shortcut">
        <button type="button" class="ap-button mermaid" data-post-image="${post.id}">
          <i class="ap-icon-archie-official"></i>
          <span>Generate an image</span>
        </button>
        ${renderImagePreset(opts)}
      </div>
      <div class="posts__card-media-alt">
        <button type="button" class="ap-button stroked grey" data-post-studio="${escapeAttr(post.id)}">
          <i class="ap-icon-image"></i>
          <span>Image Studio</span>
        </button>
        <button type="button" class="ap-button stroked grey" data-post-image-upload="${escapeAttr(post.id)}" title="Or drop an image anywhere here">
          <i class="ap-icon-upload"></i>
          <span>Add image</span>
        </button>
      </div>
    </div>
    ${hint}
  </div>`;
}

// The voice behind this draft (flag voicePerNetwork): `opts.voice` is
// voice-parts' networkVoice() for the draft's network, `opts.voiceStale` whether
// that voice changed after the draft was written — both resolved by the host
// (the card never reads a Playbook). Said on the draft itself, its status card
// glued on top: written in the default voice → « Give X its own voice »;
// written before its voice changed → « Rewrite it ». A voice of its own,
// unchanged since, says nothing.
function renderVoiceStatus(net, opts, post) {
  if (!opts.playbookId) return "";
  const label = escapeText(networkLabel(net));
  if (opts.voice?.state === "default")
    return `<div class="ap-status-card orange posts__card-voice-status" role="status">
    <div class="upper">
      <i class="ap-icon-warning_fill" aria-hidden="true"></i>
      <div class="flow"><span>Written in your default voice. No ${label} voice yet.</span></div>
      <button type="button" class="ap-link small standalone" data-post-voice="${escapeAttr(opts.playbookId)}" data-post-voice-net="${escapeAttr(net)}">Add a voice for ${label}</button>
    </div>
  </div>`;
  if (opts.voiceStale && post.status !== "scheduled")
    return `<div class="ap-status-card blue posts__card-voice-status" role="status">
    <div class="upper">
      <i class="ap-icon-info_fill" aria-hidden="true"></i>
      <div class="flow"><span>Your ${label} rules changed since this draft was written.</span></div>
      <button type="button" class="ap-link small standalone" data-post-voice-rewrite="${escapeAttr(post.id)}">Rewrite it</button>
    </div>
  </div>`;
  return "";
}

// What my last rewrite changed (flag draftChanges, resolved by the host into
// `opts.changes`): the DS green status card glued on top, « Your post has been
// updated. » + Undo (then Redo) + Accept, and the new words marked in the text,
// which still reads as it will publish. Accept puts both away (`hidden`), as do
// a hand edit and the next rewrite; the chat's card can still undo.
function changesShown(post, opts) {
  const r = post.revision;
  return opts.changes && r && !r.hidden && post.status !== "scheduled" && !post.isRegenerating;
}

// A translation says where the post went: every word is new, so nothing is marked.
function updatedLine(post) {
  return post.revision.intent === "translate"
    ? `Your post is now in ${languageOf(post)}.`
    : "Your post has been updated.";
}

function renderChangesStatus(post, opts) {
  if (!changesShown(post, opts)) return "";
  const undone = post.revision.undone;
  return `<div class="ap-status-card green posts__card-changes" role="status">
    <div class="upper">
      <i class="ap-icon-${undone ? "rotate-left" : "rounded-check_fill"}" aria-hidden="true"></i>
      <div class="flow"><span>${undone ? "Your post is back to the previous version." : updatedLine(post)}</span></div>
      <span class="posts__card-changes-actions">
        <button type="button" class="ap-link small standalone" data-post-changes-undo="${escapeAttr(post.id)}"><i class="ap-icon-rotate-${undone ? "right" : "left"}" aria-hidden="true"></i>${undone ? "Redo" : "Undo"}</button>
        <button type="button" class="ap-link small standalone" data-post-changes-accept="${escapeAttr(post.id)}"><i class="ap-icon-check" aria-hidden="true"></i>${undone ? "Done" : "Accept"}</button>
      </span>
    </div>
  </div>`;
}

export function renderPostCard(post, opts = {}) {
  const inlineEdit = opts.inlineEdit === true;
  const editing = inlineEdit && opts.editing === true;
  const selectable = opts.selectable === true;
  const selected = selectable && opts.selected === true;
  // A host outside a chat (the Clips space) narrows the rail: "Reference in
  // chat" has no chat to reference into there. Default: every action.
  const rail = (name, markup) => (!opts.railActions || opts.railActions.includes(name) ? markup : "");

  // Multi-select affordance — a checkbox sits in the .posts__row-check
  // gutter, which CSS reserves at a fixed width on every row so a
  // non-selectable card (e.g. a scheduled post) stays left-aligned with
  // its selectable siblings instead of sliding into the gutter. Only
  // selectable rows fill the gutter with an actual checkbox.
  const checkbox = `<div class="posts__row-check"${selectable ? "" : ' aria-hidden="true"'}>${
    selectable
      ? `<label class="ap-checkbox-container" aria-label="${escapeAttr(selectLabel(post))}">
          <input type="checkbox" data-post-select="${post.id}" ${selected ? "checked" : ""} />
          <i></i>
        </label>`
      : ""
  }</div>`;

  const net = normalizeNetwork(post.network);
  const handle = authorHandle(post);
  // Instagram and TikTok open the caption with the account's handle, in bold.
  const captionLead =
    net === "instagram" || net === "tiktok" ? `<strong class="posts__card-caption-handle">${handle}</strong> ` : "";
  // The text with my last rewrite's words marked, when they show.
  const changes =
    changesShown(post, opts) && !post.revision.undone && post.revision.intent !== "translate" ? post.revision : null;
  const runs = changes ? diffWords(changes.before.text, post.text) : null;
  const marked = (inner, isNew) =>
    isNew ? `<ins class="draft-diff__add"><span class="draft-diff__sr">Added: </span>${inner}</ins>` : inner;
  const bodyParagraphs = (runs && hasChanges(runs) ? diffParagraphs(runs, "after") : post.text)
    .map((p, i) => `<p class="posts__card-paragraph">${i === 0 ? captionLead : ""}${p}</p>`)
    .join("");

  const hashtags = post.hashtags.length
    ? `<p class="posts__card-hashtags">${post.hashtags
        .map((h) => `<a>${marked(`#${h}`, changes && !changes.before.hashtags.includes(h))}</a>`)
        .join(" ")}</p>`
    : "";

  const cta = post.cta
    ? `<p class="posts__card-cta">${marked(post.cta, changes && changes.before.cta !== post.cta)}</p>`
    : "";

  // Regenerate state (sparkles click → draft-rewrite.js). Two stages :
  //   - thinking  : show a 3-bar shimmer skeleton, hashtags + CTA hidden.
  //   - streaming : empty body container that the streamer fills directly
  //                 with paragraph tokens + a blinking caret.
  // In both stages the inline-edit affordance is suppressed and the
  // .posts__row-actions buttons render with `disabled` so the user
  // can't fire conflicting actions mid-stream.
  const regenerating = post.isRegenerating === true;
  const regenerateStage = regenerating ? post.regenerateStage || "thinking" : null;

  // In edit mode the entire body (paragraphs + hashtags + CTA) collapses
  // into one contenteditable region. Hashtags lose their styling during
  // edit and re-style on save (per spec).
  let editorBody;
  if (regenerating && regenerateStage === "thinking") {
    editorBody = `<div class="posts__card-body posts__card-body--ghost" data-regenerating-body>
        <span class="posts__card-ghost-bar"></span>
        <span class="posts__card-ghost-bar"></span>
        <span class="posts__card-ghost-bar"></span>
      </div>`;
  } else if (regenerating && regenerateStage === "streaming") {
    // Empty container — draft-rewrite.js streams paragraphs into it.
    editorBody = `<div class="posts__card-body" data-regenerating-body></div>`;
  } else if (editing) {
    editorBody = `<div
        class="posts__card-body posts__card-editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        aria-label="Edit draft text"
        data-post-editor="${post.id}"
        spellcheck="true"
      >${escapeText(serializeBody(post))}</div>`;
  } else {
    // Clamped at 3 lines like the network's own fold; the toggle flips
    // `.is-expanded` on the card (right-panel.js, data-post-readmore).
    // ponytail: shown on a length heuristic, not a measured overflow — a short
    // post never clamps, a borderline one may show a toggle that reveals little.
    // Never folded while my changes show: a marked word must not hide below the fold.
    const clamps = !changes && (usedCharacters(post) > 180 || post.text.length > 2);
    // The text itself is the way into the editor (right-panel.js,
    // data-post-edit-body): it reads as a field on hover, says so in a tooltip.
    const editable = inlineEdit
      ? ` posts__card-body--editable" data-post-edit-body="${post.id}" data-tooltip="Click to edit the text"`
      : '"';
    editorBody = `<div class="posts__card-body${clamps ? " posts__card-body--clamp" : ""}${editable}>${bodyParagraphs} ${hashtags} ${cta}</div>${
      clamps
        ? `<button type="button" class="ap-link small posts__card-readmore" data-post-readmore="${post.id}" aria-expanded="false" data-more="${READ_MORE[net] || "See more"}">${READ_MORE[net] || "See more"}</button>`
        : ""
    }`;
  }

  const editActions = editing
    ? `<div class="posts__card-edit-actions">
        <span class="posts__card-edit-keys"><kbd>Esc</kbd> to cancel · <kbd>⌘</kbd>+<kbd>Enter</kbd> to save</span>
        <button type="button" class="ap-button ghost grey" data-post-edit-cancel="${post.id}">Cancel</button>
        <button type="button" class="ap-button primary blue" data-post-edit-save="${post.id}">Save changes</button>
      </div>`
    : "";

  // "How's this draft?" feedback strip — sits below the LinkedIn-preview
  // card (not inside it, so it reads as product feedback rather than a faux
  // LinkedIn reaction). Suppressed while the body is mid-flux.
  const feedbackStrip =
    !editing && !regenerating
      ? renderFeedbackControl(`draft:${post.id}`, {
          kind: "draft",
          label: "How's this draft?",
          // Feedback on how it's written can update its network's voice.
          voice:
            opts.playbookId && opts.voice && opts.voice.state !== "brand" ? { playbookId: opts.playbookId, net } : null,
        })
      : "";

  // Below-card foot row: the feedback strip on the left, the "Generation
  // context" disclosure toggle on the right (same line). A hidden checkbox +
  // label drives a CSS-only collapse so the panel can drop full-width beneath
  // the row without any JS wiring. When the draft has no provenance, the
  // feedback strip renders on its own.
  const gcBody = !editing && !regenerating ? renderGenerationContextBody(post) : "";
  const belowCard = gcBody
    ? `<input type="checkbox" id="gc-${post.id}" class="posts__gencontext-check" hidden />
       <div class="posts__card-footrow">
         ${feedbackStrip}
         <label class="posts__gencontext-toggle" for="gc-${post.id}">
           <i class="ap-icon-information-circle posts__gencontext-info" aria-hidden="true"></i>
           <span class="posts__gencontext-toggle-label">Why this draft</span>
           <i class="ap-icon-chevron-down posts__gencontext-chevron" aria-hidden="true"></i>
         </label>
       </div>
       <div class="posts__gencontext-panel">${gcBody}</div>`
    : feedbackStrip;

  const stats = post.stats || {};
  const engagement =
    net === "linkedin" && (stats.likes || stats.comments || stats.reposts)
      ? `
        <div class="posts__card-engagement">
          <span
            class="posts__card-reactions"
            aria-label="${stats.likes || 0} reactions"
          >
            <span class="posts__card-reaction posts__card-reaction--thumb">
              <i class="ap-icon-thumb-up_fill" aria-hidden="true"></i>
            </span>
            <span class="posts__card-reaction posts__card-reaction--heart">
              <i class="ap-icon-heart_fill" aria-hidden="true"></i>
            </span>
            <span class="posts__card-reaction-count">${stats.likes || 0}</span>
          </span>
          <span class="posts__card-meta muted">${stats.comments || 0} comment${stats.comments === 1 ? "" : "s"} · ${stats.reposts || 0} repost${stats.reposts === 1 ? "" : "s"}</span>
        </div>
      `
      : "";

  // Media block — when the draft was generated from a video clip the card
  // surfaces a native-feeling video player (faux frame + play overlay +
  // duration chip + scrubber). Vertical networks (TikTok, Instagram) use
  // a portrait aspect ratio so the preview matches what the post would
  // actually look like in feed. Otherwise the existing image / generate
  // placeholder path is preserved.
  const subtitleLabel = post.clipRef ? subtitleLabelFor(post.subtitleStyle) : null;
  const subtitleBadge = subtitleLabel
    ? `<span class="ap-status grey no-dot posts__card-subtitle-pill">Subtitles · ${subtitleLabel}</span>`
    : "";

  const isCarousel = Array.isArray(post.carousel) && post.carousel.length > 1;
  const mediaBlock = post.clipRef
    ? `${renderClipPlayer(post)}${subtitleBadge}`
    : isCarousel
      ? `<div class="posts__card-image-wrap posts__card-image-wrap--carousel">
          <img class="posts__card-image" src="${post.carousel[0]}" alt="Carousel slide 1 for this post" loading="lazy" />
          <span class="posts__card-carousel-badge"><i class="ap-icon-multiple-images" aria-hidden="true"></i>${post.carousel.length}</span>
          <div class="posts__card-carousel-dots" aria-hidden="true">${post.carousel
            .map((_, i) => `<span class="posts__card-carousel-dot${i === 0 ? " is-active" : ""}"></span>`)
            .join("")}</div>
          <div class="posts__card-image-controls">
            <button type="button" class="ap-button ghost grey" data-post-image-edit="${post.id}">
              <i class="ap-icon-archie-official"></i>
              <span>Edit slides</span>
            </button>
            <button type="button" class="ap-button ghost red" data-post-image-remove="${post.id}">
              <i class="ap-icon-trash"></i>
              <span>Remove</span>
            </button>
          </div>
        </div>`
      : post.imageUrl
        ? `<div class="posts__card-image-wrap">
          <img class="posts__card-image" src="${post.imageUrl}" alt="Image for this post" loading="lazy" />
          ${renderImagePixels(post)}
          <!-- Edit / Change / Remove. Edit was left out while "Generate an image"
               still opened the studio — back then it was a third near-equal grey
               competing with Change for no gain. Now that Generate produces an
               image in place, Edit is the ONLY way into the Image Studio for a
               single image, so it earns its slot. It reads as one AI action next
               to two greys (the archie glyph), exactly like the carousel's
               "Edit slides" above. -->
          <div class="posts__card-image-controls">
            <button type="button" class="ap-button ghost grey" data-post-image-edit="${post.id}">
              <i class="ap-icon-archie-official"></i>
              <span>Edit image</span>
            </button>
            <button type="button" class="ap-button ghost grey" data-post-image-upload="${post.id}">
              <i class="ap-icon-upload"></i>
              <span>Replace image</span>
            </button>
            <button type="button" class="ap-button ghost red" data-post-image-remove="${post.id}">
              <i class="ap-icon-trash"></i>
              <span>Remove image</span>
            </button>
          </div>
        </div>`
        : renderEmptyMedia(post, opts);

  return html`
    <article
      class="posts__row ${opts.focusPost === post.id ? "is-focused" : ""} ${selected ? "is-selected" : ""}"
      data-post-id="${post.id}"
      ${regenerating ? `data-regenerating="true" data-stage="${regenerateStage}"` : ""}
    >
      ${raw(checkbox)}
      <div class="posts__card-wrap">
        ${raw(renderPostIssues(post, opts))} ${raw(renderVoiceStatus(net, opts, post))}
        ${raw(editing ? "" : renderChangesStatus(post, opts))}
        <article
          class="ap-card posts__card posts__card--${net} ${editing ? "is-editing" : ""} ${changes &&
          Date.now() - changes.at < 1500
            ? "has-fresh-changes"
            : ""}"
        >
          ${raw(
            renderNetworkLayout(net, {
              header: renderNetworkHeader(post, net, handle),
              body: `${editorBody} ${editActions}`,
              media: `${mediaBlock}${net === "youtube" ? renderShortsNotice(post) : ""}`,
              engagement,
              title: net === "youtube" ? `<h3 class="posts__card-yt-title">${escapeText(youtubeTitle(post))}</h3>` : "",
              footer: renderNetworkFooter(net),
            }),
          )}
          ${raw(renderFirstComment(post, { hidden: editing || regenerating }))}
        </article>
        ${raw(belowCard)}
      </div>

      <!-- The rail is prod's (studio-mfe post-card-actions), in its order:
           Reference · Schedule · Edit · Save as draft · Assign · Delete.
           Rewriting is asked in the chat; images live in the media block. -->
      <div class="posts__row-actions" role="group" aria-label="Draft actions">
        ${raw(
          rail(
            "mention",
            `<button
              type="button"
              class="ap-icon-button stroked"
              aria-label="Reference in chat"
              title="Reference"
              data-post-mention="${post.id}"
              ${regenerating ? "disabled" : ""}
            >
              <i class="ap-icon-at"></i>
            </button>`,
          ),
        )}
        ${raw(
          rail(
            "schedule",
            renderBlockedAction(post, regenerating, {
              label: "Schedule draft",
              icon: "ap-icon-calendar",
              attr: "data-post-schedule",
              // The rail's one coloured button: Schedule is where a draft goes
              // next (decided 2026-10-30, PN2-07).
              tone: "blue",
            }),
          ),
        )}
        ${raw(
          inlineEdit
            ? `<button
                type="button"
                class="ap-icon-button stroked"
                aria-label="Edit draft"
                title="Edit"
                data-post-edit="${post.id}"
                ${regenerating ? "disabled" : ""}
              >
                <i class="ap-icon-pen"></i>
              </button>`
            : "",
        )}
        ${raw(
          rail(
            "save",
            `<button
              type="button"
              class="ap-icon-button stroked"
              aria-label="Save as draft"
              title="Save as draft in Agorapulse. It leaves this chat."
              data-post-save-draft="${post.id}"
              ${regenerating ? "disabled" : ""}
            >
              <i class="ap-icon-file--text"></i>
            </button>`,
          ),
        )}
        ${raw(
          rail(
            "assign",
            renderBlockedAction(post, regenerating, {
              label: "Assign for review",
              icon: "ap-icon-user--plus",
              attr: "data-post-assign",
            }),
          ),
        )}
        <button
          type="button"
          class="ap-icon-button stroked posts__row-action--danger"
          aria-label="Delete draft"
          title="Delete draft"
          data-post-delete="${post.id}"
          ${regenerating ? "disabled" : ""}
        >
          <i class="ap-icon-trash"></i>
        </button>
      </div>
    </article>
  `;
}

// Generation context panel body — the provenance a generated draft drew on:
// a tinted headline (the angle picked, or the winner it was repurposed from) +
// the source. Returns "" when the draft has no provenance. The toggle + the
// collapse mechanism live in renderPostCard's foot row (a CSS checkbox toggle),
// so the panel can expand full-width while the toggle stays inline on the right.
function renderGenerationContextBody(post) {
  const gc = post.generationContext || {};
  if (!post.generationContext) return "";
  const tone = gc.kind === "repurpose" ? "repurpose" : gc.kind === "clip" ? "clip" : "angle";
  const headline = gc.headline
    ? `<div class="posts__gencontext-headline posts__gencontext-headline--${tone}">
        <i class="${gc.headline.icon}" aria-hidden="true"></i>
        <span>${gc.headline.text}</span>
      </div>`
    : "";
  const source = gc.source
    ? `<div class="posts__gencontext-source">
        <span class="posts__gencontext-source-head">
          <i class="${gc.source.icon}" aria-hidden="true"></i>
          <span>${gc.source.label}</span>
        </span>
        ${gc.source.detail ? `<p class="posts__gencontext-source-detail">${gc.source.detail}</p>` : ""}
      </div>`
    : "";
  return `${headline}${source}`;
}

// The first comment, previewed where it will appear: under the post, below the
// engagement bar. Removable here; written from the chat ("add a first comment").
function renderFirstComment(post, { hidden = false } = {}) {
  if (!post.firstComment || hidden) return "";
  return `<div class="posts__card-first-comment">
    ${previewAvatar(previewIdentity(post), "posts__card-avatar posts__card-avatar--small")}
    <div class="posts__card-first-comment-body">
      <span class="posts__card-first-comment-label">First comment</span>
      <p class="posts__card-first-comment-text">${escapeText(post.firstComment)}</p>
    </div>
    <button type="button" class="ap-icon-button transparent grey" data-post-first-comment-remove="${post.id}" aria-label="Remove the first comment" data-tooltip="Remove the first comment">
      <i class="ap-icon-close"></i>
    </button>
  </div>`;
}

// What stops this draft from publishing, above the card — DERIVED by
// validatePost on every render, never read from the post. Led by the account it
// would publish to (renderProfileTag), since the rule is that network's. A
// draft fixed a moment ago (`opts.justFixed`, held by the drafts panel) says so
// in green before it settles back among the ready ones.
function renderPostIssues(post, opts = {}) {
  if (opts.justFixed) return infobox("success", "ap-icon-rounded-check_fill", "Fixed. Ready to publish.", "status");
  const { errors, warnings } = validatePost(post);
  const list = (items) =>
    items.length === 1
      ? escapeText(items[0].message)
      : `<ul class="posts__card-errors-list">${items.map((e) => `<li>${escapeText(e.message)}</li>`).join("")}</ul>`;
  const account = renderProfileTag(profileForNetwork(post.network), { network: post.network });
  return [
    errors.length
      ? infobox(
          "error",
          "ap-icon-error_fill",
          `<span class="posts__card-issue-account">${account}</span>${list(errors)}`,
          "alert",
        )
      : "",
    warnings.length ? infobox("warning", "ap-icon-warning_fill", list(warnings)) : "",
  ].join("");
}

function infobox(tone, icon, body, role = "") {
  return `<div class="ap-infobox ${tone} posts__card-issue"${role ? ` role="${role}"` : ""}>
    <i class="${icon}" aria-hidden="true"></i>
    <div class="ap-infobox-content">
      <div class="ap-infobox-texts">
        <div class="ap-infobox-message">${body}</div>
      </div>
    </div>
  </div>`;
}

// A rail action that can't run on a draft that won't publish (Assign, Schedule).
// The tooltip sits on a wrapper: a disabled button gets no pointer events, so it
// could never show its own.
// Each card's checkbox names its draft — « Select draft » on every card said
// nothing about which one.
function selectLabel(post) {
  const text = (Array.isArray(post.text) ? post.text.join(" ") : post.text || "").trim();
  const words = text.split(/\s+/).slice(0, 6).join(" ");
  return `Select ${networkLabel(normalizeNetwork(post.network))} draft${words ? `: ${words}` : ""}`;
}

function renderBlockedAction(post, regenerating, { label, icon, attr, tone = "" }) {
  const blocker = validatePost(post).errors[0];
  const button = `<button type="button" class="ap-icon-button stroked${tone ? ` ${tone}` : ""}" aria-label="${label}" ${
    blocker ? "" : `title="${label}"`
  } ${attr}="${post.id}" ${regenerating || blocker ? "disabled" : ""}><i class="${icon}"></i></button>`;
  return blocker
    ? `<span class="posts__row-action-blocked" data-tooltip="Fix this draft first: ${escapeAttr(blocker.message)}">${button}</span>`
    : button;
}

// ── The network's own chrome ────────────────────────────────────────
// One card, six layouts: each network orders the same pieces its own way and
// draws its own header and (decorative) action bar, so the preview is the post
// as it will look there — not a LinkedIn post wearing another logo.

const READ_MORE = {
  linkedin: "…see more",
  facebook: "See more",
  instagram: "more",
  x: "Show more",
  tiktok: "more",
  youtube: "…more",
};

// Icon + label per network, in the network's order. X, Instagram and TikTok
// show glyphs only, like the apps do.
const FOOTERS = {
  linkedin: [
    ["ns-linkedin_like", "Like"],
    ["ns-linkedin_comment", "Comment"],
    ["ns-linkedin_repost", "Repost"],
    ["ns-linkedin_share", "Send"],
  ],
  facebook: [
    ["ns-facebook_like", "Like"],
    ["ns-facebook_comment", "Comment"],
    ["ns-facebook_share", "Share"],
  ],
  x: [["ns-x_comment"], ["ns-x_repost"], ["ns-x_like"], ["ns-x_view"], ["ns-x_bookmark"]],
  instagram: [["ns-instagram_like"], ["ns-instagram_comment"], ["ns-instagram_share"], ["ns-instagram_bookmark"]],
  tiktok: [["ns-tiktok_like"], ["ns-tiktok_comment"], ["ns-tiktok_share"], ["ns-tiktok_melody", "Original sound"]],
  youtube: [["ns-youtube-shorts_like", "Like"], ["ns-youtube-shorts_dislike"], ["ns-youtube-shorts_share", "Share"]],
};

function authorHandle(post) {
  const account = profileForNetwork(post.network);
  if (account?.handle) return escapeText(account.handle.replace(/^@/, ""));
  return escapeText((post.author?.name || "you").toLowerCase().replace(/[^a-z0-9]/g, ""));
}

// Who the preview shows: the connected account that will publish it, the one
// the Schedule modal names (decided 2026-10-30, PN-17). A person's details
// (« 1st », job title) don't belong to a page; the post's mock author stays the
// fallback when nothing is connected on that network.
function previewIdentity(post) {
  const acct = profileForNetwork(post.network);
  if (!acct) return post.author;
  return {
    name: escapeText(acct.name),
    initials: acct.initials || BRAND_INITIALS,
    photo: acct.photo,
    connection: "",
    title: "",
    visibility: post.author?.visibility || "Public",
  };
}

function previewAvatar(a, cls = "posts__card-avatar") {
  return `<div class="${cls}" aria-hidden="true">${a.photo ? `<img src="${escapeAttr(a.photo)}" alt="" />` : a.initials}</div>`;
}

function renderNetworkHeader(post, net, handle) {
  const a = previewIdentity(post);
  if (net === "instagram" || net === "tiktok" || net === "youtube")
    return `<header class="posts__card-header posts__card-header--compact">
      ${previewAvatar(a, "posts__card-avatar posts__card-avatar--small")}
      <span class="posts__card-name">${net === "youtube" ? a.name : handle}</span>
    </header>`;
  if (net === "x")
    return `<header class="posts__card-header">
      ${previewAvatar(a)}
      <div class="row posts__card-author-row">
        <span class="posts__card-name">${a.name}</span>
        <span class="muted">@${handle} · ${post.timeLabel}</span>
      </div>
    </header>`;
  if (net === "facebook")
    return `<header class="posts__card-header">
      ${previewAvatar(a)}
      <div class="posts__card-author">
        <span class="posts__card-name">${a.name}</span>
        <div class="muted posts__card-meta">${post.timeLabel} · ${a.visibility}</div>
      </div>
    </header>`;
  return `<header class="posts__card-header">
    ${previewAvatar(a)}
    <div class="posts__card-author">
      <div class="row posts__card-author-row">
        <span class="posts__card-name">${a.name}</span>
        ${a.connection ? `<span class="muted">· ${a.connection}</span>` : ""}
      </div>
      ${a.title ? `<div class="muted posts__card-title">${a.title}</div>` : ""}
      <div class="muted posts__card-meta">${post.timeLabel} · ${a.visibility}</div>
    </div>
  </header>`;
}

// Decoration only (aria-hidden): the actionable controls are the rail's.
function renderNetworkFooter(net) {
  const items = FOOTERS[net] || FOOTERS.linkedin;
  return `<footer class="posts__card-footer posts__card-footer--${net}" aria-hidden="true">${items
    .map(
      ([icon, label]) =>
        `<span class="posts__card-action"><i class="ap-icon-${icon}"></i>${label ? `<span>${label}</span>` : ""}</span>`,
    )
    .join("")}</footer>`;
}

// Media-led networks put the picture first and the caption under the action
// bar; YouTube puts the video, then its title, then the channel.
function renderNetworkLayout(net, p) {
  if (net === "instagram" || net === "tiktok") return `${p.header}${p.media}${p.footer}${p.body}`;
  if (net === "youtube") return `${p.media}${p.title}${p.header}${p.body}${p.footer}`;
  return `${p.header}${p.body}${p.media}${p.engagement}${p.footer}`;
}

// A vertical clip publishes to YouTube as a Short — said under the player, since
// it changes where the post appears.
function renderShortsNotice(post) {
  const portrait = post.clipRef && (post.format ? isPortraitFormat(post.format) : false);
  return portrait
    ? `<p class="posts__card-shorts muted"><i class="ap-icon-youtube" aria-hidden="true"></i>Vertical: publishes as a YouTube Short.</p>`
    : "";
}

// Build the editable plain-text body shown inside the contenteditable
// region. Paragraphs separated by blank lines ; hashtags rendered as
// "#tag #tag2" on their own line ; CTA on its own line.
// The reverse parse lives in right-panel.js (parseEditorBody).
function serializeBody(post) {
  const parts = [];
  if (post.text?.length) parts.push(post.text.join("\n\n"));
  if (post.hashtags?.length) parts.push(post.hashtags.map((h) => `#${h}`).join(" "));
  if (post.cta) parts.push(post.cta);
  return parts.join("\n\n");
}

// HTML-escape user content before injecting into the contenteditable.
// innerText reads back the literal characters, so escaping here avoids
// the editor rendering injected markup on first paint.

// ── Video clip player (faux) ────────────────────────────────────────
//
// Mimics what a native video post looks like on the destination network:
// 9:16 frame for TikTok / Instagram (Reels-style), 16:9 for everything
// else. The frame itself is a hue-driven gradient so each draft feels
// like a real extracted thumbnail; play overlay + duration chip + a
// 1-px scrubber bar at the bottom (paused mid-clip) round out the
// "this is a player" affordance. Filename surfaces in a top-left bezel
// so the user still sees where the clip came from.

const PORTRAIT_NETWORKS = new Set(["tiktok", "instagram"]);

const SUBTITLE_LABEL = {
  // Legacy light styles (Video Clips modal caption tab).
  bold: "Bold",
  clean: "Clean",
  caption: "Caption",
  // Clip-draft flow styles (align with the subtitle-style card grid).
  karaoke: "Karaoke",
  "deep-diver": "Deep Diver",
  youshaei: "Youshaei",
  popline: "Popline",
  mozi: "Mozi",
  thinkmedia: "ThinkMedia",
  beasty: "Beasty",
  simple: "Simple",
};

// Resolve a subtitle style id to a human label. The conversational draft flow
// uses the light bold/clean/caption set; editing a clip in the Video Clips
// modal can set any caption preset id (karaoke, …) — fall back to the preset
// catalog's label so the badge stays accurate after an edit.
function subtitleLabelFor(style) {
  if (!style || style === "none") return null;
  if (SUBTITLE_LABEL[style]) return SUBTITLE_LABEL[style];
  const preset = presetById(style);
  return preset ? preset.label : style;
}

function renderClipPlayer(post) {
  const clip = post.clipRef;
  const duration = Math.max(1, Math.round(clip.end - clip.start));
  // Prefer the explicit export format chosen in the clip-draft flow; fall
  // back to the network's default orientation when no format was set.
  const portrait = post.format ? isPortraitFormat(post.format) : PORTRAIT_NETWORKS.has(post.network);
  const h = typeof clip.hue === "number" ? clip.hue : 24;
  const bg = `linear-gradient(135deg, oklch(0.28 0.08 ${h}) 0%, oklch(0.14 0.05 ${h}) 100%)`;
  const blob1 = `radial-gradient(circle at 30% 35%, oklch(0.74 0.20 ${h}) 0%, transparent 48%)`;
  const blob2 = `radial-gradient(circle at 75% 70%, oklch(0.55 0.16 ${(h + 50) % 360}) 0%, transparent 44%)`;
  const blob3 = `radial-gradient(circle at 50% 88%, oklch(0.42 0.12 ${(h + 25) % 360}) 0%, transparent 36%)`;
  const aspectClass = portrait ? "posts__card-clip-player--portrait" : "posts__card-clip-player--landscape";
  const source = clip.sourceName || "";
  // The "Edit clip" affordance only works when the draft carries a back-ref to
  // its source clip (sourceId + clipId). Legacy / manual clipRefs omit them.
  const editBtn =
    clip.sourceId && clip.clipId
      ? `<button type="button" class="posts__card-clip-edit" data-post-clip-edit="${post.id}" aria-label="Edit clip">
        <i class="ap-icon-pen" aria-hidden="true"></i>
        <span>Edit clip</span>
      </button>`
      : "";
  return `
    <div
      class="posts__card-clip-player ${aspectClass}"
      style="background-image: ${blob1}, ${blob2}, ${blob3}, ${bg}"
      role="img"
      aria-label="Video preview from ${escapeAttr(source)} (${formatPlayerTime(duration)})"
    >
      <span class="posts__card-clip-player-source" title="${escapeAttr(source)}">
        <i class="ap-icon-file--video" aria-hidden="true"></i>
        <span>${escapeText(source)}</span>
      </span>
      <span class="posts__card-clip-player-dur">${formatPlayerTime(duration)}</span>
      ${editBtn}
      <button type="button" class="posts__card-clip-player-play" aria-label="Play preview" tabindex="-1">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
      <span class="posts__card-clip-player-scrubber" aria-hidden="true">
        <span class="posts__card-clip-player-progress" style="width: 24%"></span>
      </span>
    </div>
  `;
}

const formatPlayerTime = (sec) => formatClock(sec, { round: true });
