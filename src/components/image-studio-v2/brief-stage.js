// Image Studio — the auto-brief stage: the PROMPT is the screen, the settings are
// modifiers on it (flag imageStudioAutoBrief, before anything is generated).
//
// This variant already has the engine for it: every setting rewrites the brief. So
// the settings aren't a parallel form beside the prompt — they are literally the
// controls that rewrite the text you are reading. Laying them out as a bar of
// modifiers under the brief says exactly that, where a 284px column of accordions
// next to an empty canvas said "two unrelated things".
//
// ── Two decisions worth defending ────────────────────────────────────────────
//
// 1. A modifier opens a POPOVER upward, over the brief. The removed `.ap-select`
//    sheets this studio once had were flyouts over the IMAGE, which is a different
//    thing: here there is no image yet, the popover is anchored to the bar that owns
//    it, and being out of flow is what keeps the stage from ever scrolling.
//
// 2. ONE modifier open at a time (`openModifier`), unlike the settings panel's
//    independent sections. The panel could afford several open because the panel was
//    the whole surface; here the brief is the hero and the stage must not scroll, so
//    two stacked control bodies would break the layout. Small surface is the point.
//
// The read-only brief renders as STYLED LINES rather than a textarea: `derivePrompt`
// emits "Label: value" per line, so the label can recede and the value carry the
// weight — the text reads as a document instead of a form field. Taking the brief
// over swaps in the real textarea, so the editing path is untouched.

import { escapeHtml } from "../../utils.js?v=22";
import { NETWORK_LABEL, NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=39";
import { getPosts } from "../../posts-store.js?v=46";
import { renderPostCard } from "../post-card.js?v=83";
import { KEY, ctx } from "./context.js?v=42";
import * as imageStudio from "../../image-studio.js?v=90";
import { imageTypeBody, styleBody, formatBody, outputBody } from "./settings-view.js?v=10";
import { refsBody, refSummary } from "./references-view.js?v=9";
import { brandingBody } from "./branding-view.js?v=4";

/** Is the brief holding the stage? For the WHOLE generate flow, image or not. */
export function isBriefStage(st) {
  return !!st.autoBrief && !st.gridBrief && st.mode === "generate";
}

// ── The brief itself ────────────────────────────────────────────────────────

// Each section of the brief is its own BLOCK — a named tile with its value — rather
// than a line in a flowing list. `derivePrompt` emits one "Label: value" per line, so
// the structure is already there in the text; this just stops hiding it. The label
// recedes to a caption and the value carries the weight, so the block reads as an
// answer under a question. Lines with no label (the fallback prompts are plain prose)
// become a block with no caption.
// The words on the image, as the lead block. This one edits `renderText` — the text that
// actually gets set into the artwork — not the prompt's sentence about it. They used to be
// two fields that looked like one: a "Text on image" modifier holding the real value and a
// brief line describing it. One field, the real one, and the prompt line follows from it.
function textHeroBlock(st) {
  const val = st.renderText || "";
  const over = imageStudio.renderTextOverMessage(val);
  return `<label class="isv2-bs-block isv2-bs-block--hero">
    <span class="isv2-bs-key">Text on the image</span>
    <textarea class="isv2-bs-val" data-img-render-text placeholder="No words on the image" aria-label="Text on the image">${escapeHtml(val)}</textarea>
    <span class="ap-form-message error" data-img-render-text-msg role="status"${over ? "" : ` style="display:none"`}>${escapeHtml(over)}</span>
  </label>`;
}

function briefBlock(line, index) {
  const at = line.indexOf(":");
  const key = at > 0 ? line.slice(0, at) : "";
  const val = at > 0 ? line.slice(at + 1).trim() : line;
  const label = key || "Brief";
  return `<label class="isv2-bs-block">
    ${key ? `<span class="isv2-bs-key">${escapeHtml(key)}</span>` : ""}
    <textarea class="isv2-bs-val" data-img-brief-line="${index}" aria-label="${escapeHtml(label)}">${escapeHtml(val)}</textarea>
  </label>`;
}

function briefBody(st) {
  if (st.promptLoading) {
    return `<div class="isv2-bs-loading" role="status">
      <span class="gen-image-spinner gen-loading-mark"></span>
      <p class="isv2-bs-loading-label">Writing your brief…</p>
    </div>`;
  }
  // Every block is editable, always — no read-only mode and no link to press first.
  //
  // Indices stay pointed at the RAW prompt lines even though the blocks are reordered,
  // because an edit writes back to its own line (image-studio.js#writeBriefLine). So the
  // order on screen and the order in the text are allowed to differ.
  //
  // "Text in image" leads, and leads bigger: those words are the only part of the brief
  // that ends up literally visible in the artwork, so they outrank a description of it.
  const lines = (st.promptText || "").split("\n");
  const isText = (l) => /^\s*text in image\s*:/i.test(l);
  const rest = lines
    .map((l, i) => ({ l, i }))
    .filter((e) => e.l.trim() && !isText(e.l))
    .map((e) => briefBlock(e.l, e.i))
    .join("");
  const blocks = textHeroBlock(st) + rest;
  if (!blocks)
    return `<div class="isv2-bs-doc"><div class="isv2-bs-block"><span class="isv2-bs-key">Brief</span></div></div>`;
  return `<div class="isv2-bs-doc">${blocks}</div>`;
}

// Where the brief stands, rendered in the modal FOOTER beside Regenerate (stage-view.js#
// footerBar) rather than under the blocks. It is a status line about the whole brief, and
// the footer is where this modal already keeps the things that talk about the whole
// modal — under the blocks it competed with the blocks for the same reading.
//
// No invitation to start editing, since every block already is a field: this only reports
// the state, and offers the way back to Archie's version once something has changed.
export function briefNote(st) {
  if (st.promptLoading) return "";
  if (!st.briefTakenOver)
    return `I write this brief from the options above. Change one and I rewrite it — or edit the text yourself.`;
  if (st.briefStale) {
    return `<span class="isv2-brief-stale">You changed the options after editing this.</span> <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Rewrite it from them</button>, or keep your words.`;
  }
  return `This is your text now, so I'll leave it alone. <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Let me write it again</button>`;
}

// ── The modifier bar ────────────────────────────────────────────────────────

// Each modifier is one button: what it changes, and what it is currently set to.
// The value is the point — it's the part of the brief this button owns — so it
// carries the weight and the name recedes.
// `set` means the modifier carries a real choice rather than a default left alone. It
// drives the accent treatment, which is the DS's documented meaning for that colour
// ("interaction, info, links, SELECTED" — foundations/color.md), so the bar shows at a
// glance what has been decided and what Archie is still choosing for you.
function modifierChip({ name, label, value, disabled, note, set }, st) {
  const open = st.openModifier === name;
  const title = note || `${label}: ${value}`;
  return `<button type="button" class="isv2-bs-mod${set ? " is-set" : ""}${open ? " is-open" : ""}" data-img-modifier="${escapeHtml(name)}"
    aria-expanded="${open}" ${disabled ? "disabled" : ""} title="${escapeHtml(title)}">
    <span class="isv2-bs-mod-label">${escapeHtml(label)}</span>
    <span class="isv2-bs-mod-value">${escapeHtml(value)}</span>
    <i class="ap-icon-chevron-up isv2-bs-mod-arrow" aria-hidden="true"></i>
  </button>`;
}

// name → the control that modifier opens. Every body is the SAME one the settings
// panel uses, so the controls and their data-* handlers are shared, not re-written.
function modifierBody(name, st, ctxVals) {
  const { picked, choices, canCarousel, isCarousel, branded, tinted, hasKit } = ctxVals;
  switch (name) {
    case "refs":
      return refsBody(st, picked);
    case "branding":
      return hasKit
        ? brandingBody(st, branded, tinted)
        : `<p class="isv2-sheet-hint">No brand kit on this Playbook.</p>`;
    case "imageType":
      return imageTypeBody(st);
    case "style":
      return styleBody(st);
    case "format":
      return formatBody(st, choices);
    case "output":
      return outputBody(st, canCarousel, isCarousel);
    default:
      return "";
  }
}

// The FIRST write owns the stage on its own, centred: there is no brief to frame yet,
// so an eyebrow with a spinner tucked under it just looked like a broken layout. Later
// reassembles keep the layout and swap only the blocks (see briefBody), because the
// modifiers and the popover you just used have to stay where they were.
function bootLoader() {
  return `<div class="isv2-bs-boot" role="status" aria-live="polite">
    <span class="gen-image-spinner gen-loading-mark"></span>
    <p class="isv2-bs-boot-title">Writing your brief…</p>
    <p class="isv2-bs-boot-sub">I'm reading your post and setting the options for it.</p>
  </div>`;
}

// The result joins the brief rather than replacing it. Generating used to swap the
// entire screen for the classic canvas — a different layout, different controls, and
// the modifiers you had just been using gone. Keeping the brief and adding the picture
// beside it means one interface for the whole loop: read the brief, look at what it
// produced, change a modifier, regenerate.
// Image ↔ in-feed. It lives in the preview's own header because it changes what the
// PREVIEW shows and nothing else — centred over the whole stage it read as modal chrome
// and sat a half-modal away from its effect. Switching it no longer leaves the split
// either: the preview simply holds the post card instead of the bare image.
function previewToggle(st, disabled) {
  const feed = st.canvasView === "feed";
  const off = disabled ? "disabled" : "";
  const netIcon = st.network ? NETWORK_ICON_BY_PLATFORM[st.network] || "ap-icon-image" : "ap-icon-image";
  const netLabel = st.network ? NETWORK_LABEL[st.network] || st.network : "your feed";
  return `<div class="isv2-viewseg isv2-bs-viewseg" role="group" aria-label="Preview view">
    <button type="button" class="ap-filter-chip" data-img-view="image" aria-pressed="${!feed}" ${off}><i class="ap-icon-image" aria-hidden="true"></i>Image</button>
    <button type="button" class="ap-filter-chip" data-img-view="feed" aria-pressed="${feed}" title="Preview on ${escapeHtml(netLabel)}" ${off}><i class="${netIcon}" aria-hidden="true"></i>In feed</button>
  </div>`;
}

// The in-feed take: the same post the studio was opened on, carrying this image.
function feedCard(st) {
  const post = ctx.sessionId && ctx.postId ? getPosts(ctx.sessionId).find((p) => p.id === ctx.postId) : null;
  const base = post || {
    id: ctx.postId || "preview",
    author: { name: "You", title: "", initials: "YO", connection: "1st", visibility: "public" },
    network: st.network || "linkedin",
    status: "ready",
    timeLabel: "now",
    text: ["Your post text will appear here."],
    hashtags: [],
    cta: "",
    stats: { likes: 0, comments: 0, reposts: 0 },
  };
  const urls = st.variations.map((v) => v.url);
  const media =
    st.outputMode === "carousel"
      ? { imageUrl: urls[0] || null, carousel: urls }
      : { imageUrl: urls[st.selectedIndex ?? 0] || null, carousel: null };
  return `<div class="isv2-bs-feed">${renderPostCard({ ...base, clipRef: null, isRegenerating: false, ...media })}</div>`;
}

function previewColumn(st) {
  const ratio = imageStudio.activeRatio(KEY);
  // The layout must not change when the first image lands, so this half is here from the
  // first frame — an empty state that points at the half doing the work, rather than a
  // column that appears out of nowhere and reflows everything the user was reading.
  if (st.genPhase !== "generating" && !st.variations.length) {
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st, true)}
      </div>
      <div class="isv2-bs-shot is-empty" style="aspect-ratio:${ratio}">
        <i class="ap-icon-image" aria-hidden="true"></i>
        <p class="isv2-bs-empty-title">Your image appears here</p>
        <p class="isv2-bs-empty-sub">Set the options on the left, then generate.</p>
      </div>
      <div class="isv2-bs-thumbs" aria-hidden="true"></div>
    </div>`;
  }
  if (st.genPhase === "generating") {
    const n = st.outputMode === "carousel" ? st.slideCount : st.variationCount;
    const what = st.outputMode === "carousel" ? "slide" : "variation";
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st, true)}
      </div>
      <div class="isv2-bs-shot is-busy" style="aspect-ratio:${ratio}" role="status">
        <span class="gen-image-spinner"></span>
        <span class="isv2-bs-shot-label">Generating ${n} ${what}${n > 1 ? "s" : ""}…</span>
      </div>
      <div class="isv2-bs-thumbs" aria-hidden="true"></div>
    </div>`;
  }
  const i = st.selectedIndex ?? 0;
  const shot = st.variations[i];
  if (!shot) return "";
  if (st.canvasView === "feed") {
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st)}
      </div>
      ${feedCard(st)}
    </div>`;
  }
  // Rendered even when there is nothing to put in it: the strip has a height, and letting
  // it appear only with the second variation resized the shot box the moment the image
  // arrived — a layout change by the back door.
  const thumbs =
    st.variations.length > 1
      ? `<div class="isv2-bs-thumbs" role="group" aria-label="Variations">
          ${st.variations
            .map(
              (v, n) =>
                `<button type="button" class="isv2-bs-thumb${n === i ? " is-on" : ""}" data-img-variation="${n}" aria-pressed="${n === i}" aria-label="Variation ${n + 1}">
                  <img src="${escapeHtml(v.url)}" alt="" loading="lazy" />
                </button>`,
            )
            .join("")}
        </div>`
      : `<div class="isv2-bs-thumbs" aria-hidden="true"></div>`;
  // Changed the brief or a modifier since this was made? Say so ON the image, with the
  // fix attached: the picture is the thing that has gone out of date, so the prompt to
  // redo it belongs there rather than in a footer the eye has already left.
  const stale = imageStudio.previewStale(st);
  const restale = stale
    ? `<div class="isv2-bs-stale">
        <p class="isv2-bs-stale-note">The brief changed since this image.</p>
        <button type="button" class="ap-button primary blue" data-img-generate>
          <i class="ap-icon-refresh"></i><span>Regenerate</span>
        </button>
      </div>`
    : "";
  return `<div class="isv2-bs-preview">
    <div class="isv2-bs-preview-head">
      <p class="isv2-bs-eyebrow">Preview</p>
      ${previewToggle(st)}
    </div>
    <div class="isv2-bs-shot${stale ? " is-stale" : ""}" style="aspect-ratio:${ratio}">
      <img src="${escapeHtml(shot.url)}" alt="Generated image" />
      ${restale}
    </div>
    ${thumbs}
  </div>`;
}

export function briefStage(st) {
  // Nothing written yet → the centred loader IS the screen.
  if (st.promptLoading && !(st.promptText || "").trim()) return bootLoader();
  const picked = imageStudio.selectedReference(st);
  const choices = imageStudio.formatChoices(KEY);
  const canCarousel = imageStudio.supportsCarousel(st.network);
  const isCarousel = canCarousel && st.outputMode === "carousel";
  const hasLogo = !!st.playbookLogo;
  const hasColors = (st.playbookColors || []).length > 0;
  const hasKit = hasLogo || hasColors;
  const branded = hasLogo && !!st.useBranding;
  const tinted = hasColors && !!st.useBrandColors;
  const hasRefs = st.referenceImages.length > 0;
  const ctxVals = { picked, choices, canCarousel, isCarousel, branded, tinted, hasKit };

  const typeLabel = st.imageTypeKey
    ? imageStudio.IMAGE_TYPES.find((o) => o.key === st.imageTypeKey)?.label || "Any"
    : "Any";
  const styleLabel = st.styleKey ? imageStudio.STYLE_PRESETS.find((o) => o.key === st.styleKey)?.label || "Any" : "Any";
  const fmt = choices.find((f) => f.id === st.formatId);
  let brandValue = "Off";
  if (!hasKit) brandValue = "No kit";
  else if (branded && tinted) brandValue = st.playbookName || "On";
  else if (branded) brandValue = "Logo";
  else if (tinted) brandValue = "Colors";

  const mods = [
    { name: "imageType", label: "Type", value: typeLabel, set: !!st.imageTypeKey },
    // Reference BEFORE Style: a reference switches Style off, and "From reference" is the
    // effect. Reading the effect before its cause is the same mistake the brief blocks
    // made when Style sat above the References card.
    { name: "refs", label: "Reference", value: refSummary(picked, st), set: !!picked },
    {
      name: "style",
      label: "Style",
      value: hasRefs ? "From reference" : styleLabel,
      disabled: hasRefs,
      note: hasRefs ? "The reference image sets the look" : "",
      set: !hasRefs && !!st.styleKey,
    },
    { name: "branding", label: "Branding", value: brandValue, disabled: !hasKit, set: branded || tinted },
    // Format always holds a value — there is no "unset" for it, so nothing to signal.
    { name: "format", label: "Format", value: fmt ? fmt.tag : "Ratio" },
    {
      name: "output",
      label: canCarousel ? "Output" : "Variations",
      value: isCarousel ? `Carousel · ${st.slideCount}` : String(st.variationCount),
      set: isCarousel,
    },
  ];

  const openMod = mods.find((m) => m.name === st.openModifier && !m.disabled);
  // A POPOVER above the bar, over the brief — out of flow, so opening one can never
  // push the layout or bring back a scrollbar.
  const panel = openMod
    ? `<div class="isv2-bs-pop" role="group" aria-label="${escapeHtml(openMod.label)}">
        <p class="isv2-bs-pop-title">${escapeHtml(openMod.label)}</p>
        ${modifierBody(openMod.name, st, ctxVals)}
      </div>`
    : "";

  const preview = previewColumn(st);
  // Two halves, genuinely: the brief and the controls that write it on one side, the
  // picture on the other. The modifiers sit at the BOTTOM of their own half rather than
  // spanning the width, so each side is a complete thing — read/edit here, judge there.
  return `<div class="isv2-bs${preview ? " is-split" : ""}">
    <div class="isv2-bs-left">
      <div class="isv2-bs-brief${st.briefTakenOver ? " is-editing" : ""}">
        <p class="isv2-bs-eyebrow">Image brief</p>
        ${briefBody(st)}
      </div>
      <div class="isv2-bs-foot">
        <div class="isv2-bs-mods" role="group" aria-label="Brief options">
          ${mods.map((m) => modifierChip(m, st)).join("")}
        </div>
        ${panel}
      </div>
    </div>
    ${preview}
  </div>`;
}
