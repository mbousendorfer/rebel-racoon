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
// What a brief BLOCK is, and what the preview half shows, are not this file's business:
// V3 (setup-stage.js) renders both too, and a second copy is how one Topic ends up
// described two different ways. They live in brief-blocks.js and preview-column.js.
// This file owns the auto-brief LAYOUT — brief above, modifier bar below, picture beside.

import { escapeHtml } from "../../utils.js?v=22";
import { KEY } from "./context.js?v=50";
import * as imageStudio from "../../image-studio.js?v=103";
import { imageTypeBody, styleBody, formatBody, outputBody } from "./settings-view.js?v=23";
import { refsBody, refSummary } from "./references-view.js?v=19";
import { brandingBody } from "./branding-view.js?v=4";
import { briefBody } from "./brief-blocks.js?v=3";
import { previewColumn } from "./preview-column.js?v=2";

// Is the brief holding the stage? For the WHOLE generate flow, image or not.
//
// V3 wins when both flags are on — the same tie-break the retired grid variant used.
// Declaring precedence HERE rather than in the stage's dispatch means no caller has to
// know the order, and there is exactly one place to read it from.
export function isBriefStage(st) {
  return !!st.autoBrief && !st.setupFirst && st.mode === "generate";
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

// The result joins the brief rather than replacing it — see preview-column.js, which
// holds that argument and the column that follows from it.

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
