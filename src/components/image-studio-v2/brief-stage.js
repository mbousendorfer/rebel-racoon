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
// 1. Modifiers expand IN PLACE, never as a flyout. This studio already deleted a
//    stack of `.ap-select` triggers that threw sheets over the canvas
//    (settings-view.js documents the removal), and the DS has no nested-dropdown
//    pattern. So a modifier opens its control directly beneath the bar.
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
import { KEY } from "./context.js?v=42";
import * as imageStudio from "../../image-studio.js?v=86";
import { imageTypeBody, styleBody, formatBody, outputBody, renderTextBody } from "./settings-view.js?v=10";
import { refsBody, refSummary } from "./references-view.js?v=9";
import { brandingBody } from "./branding-view.js?v=4";

/** Is the brief holding the stage? True only before anything has been generated. */
export function isBriefStage(st) {
  const hasImg = !!st.currentImage || (st.genPhase === "results" && st.variations.length > 0);
  const feedView = hasImg && st.canvasView === "feed";
  return !!st.autoBrief && !st.gridBrief && st.mode === "generate" && !feedView && st.genPhase === "idle";
}

// ── The brief itself ────────────────────────────────────────────────────────

// Each section of the brief is its own BLOCK — a named tile with its value — rather
// than a line in a flowing list. `derivePrompt` emits one "Label: value" per line, so
// the structure is already there in the text; this just stops hiding it. The label
// recedes to a caption and the value carries the weight, so the block reads as an
// answer under a question. Lines with no label (the fallback prompts are plain prose)
// become a block with no caption.
function briefBlock(line) {
  const at = line.indexOf(":");
  const key = at > 0 ? line.slice(0, at) : "";
  const val = at > 0 ? line.slice(at + 1).trim() : line;
  return `<div class="isv2-bs-block">
    ${key ? `<p class="isv2-bs-key">${escapeHtml(key)}</p>` : ""}
    <p class="isv2-bs-val">${escapeHtml(val)}</p>
  </div>`;
}

function briefBody(st) {
  if (st.promptLoading) {
    return `<div class="isv2-bs-loading" role="status">
      <span class="gen-image-spinner gen-loading-mark"></span>
      <p class="isv2-bs-loading-label">Writing your brief…</p>
    </div>`;
  }
  // Taken over → the real field, so editing behaves exactly as it does elsewhere.
  if (st.briefTakenOver) {
    return `<textarea id="isv2Prompt" class="isv2-bs-field" data-img-prompt rows="8" aria-label="Image brief">${escapeHtml(st.promptText)}</textarea>`;
  }
  const lines = (st.promptText || "").split("\n").filter((l) => l.trim());
  if (!lines.length) return `<div class="isv2-bs-block"><p class="isv2-bs-val">No brief yet.</p></div>`;
  return `<div class="isv2-bs-doc">${lines.map(briefBlock).join("")}</div>`;
}

// The one line under the brief: what it is, and the single takeover action.
function briefNote(st) {
  if (st.promptLoading) return "";
  if (!st.briefTakenOver) {
    return `Written from the modifiers below. <button type="button" class="ap-link standalone small" data-img-brief-edit>Edit it yourself</button>`;
  }
  if (st.briefStale) {
    return `<span class="isv2-brief-stale">Modifiers changed since your edit.</span> <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Rebuild from them</button>, or keep your words.`;
  }
  return `This brief is yours — the modifiers won't change it. <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Back to auto</button>`;
}

// ── The modifier bar ────────────────────────────────────────────────────────

// Each modifier is one button: what it changes, and what it is currently set to.
// The value is the point — it's the part of the brief this button owns — so it
// carries the weight and the name recedes.
function modifierChip({ name, label, value, disabled, note }, st) {
  const open = st.openModifier === name;
  const title = note || `${label}: ${value}`;
  return `<button type="button" class="isv2-bs-mod${open ? " is-open" : ""}" data-img-modifier="${escapeHtml(name)}"
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
    case "renderText":
      return renderTextBody(st);
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

export function briefStage(st) {
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
  const words = (st.renderText || "").trim();

  const mods = [
    { name: "imageType", label: "Type", value: typeLabel },
    {
      name: "style",
      label: "Style",
      value: hasRefs ? "From reference" : styleLabel,
      disabled: hasRefs,
      note: hasRefs ? "The reference image sets the look" : "",
    },
    { name: "refs", label: "Reference", value: refSummary(picked, st) },
    { name: "branding", label: "Branding", value: brandValue, disabled: !hasKit },
    { name: "renderText", label: "Text on image", value: st.textOnImage && words ? "On" : "Off" },
    { name: "format", label: "Format", value: fmt ? fmt.tag : "Ratio" },
    {
      name: "output",
      label: canCarousel ? "Output" : "Variations",
      value: isCarousel ? `Carousel · ${st.slideCount}` : String(st.variationCount),
    },
  ];

  const openMod = mods.find((m) => m.name === st.openModifier && !m.disabled);
  const panel = openMod
    ? `<div class="isv2-bs-panel" role="group" aria-label="${escapeHtml(openMod.label)}">
        ${modifierBody(openMod.name, st, ctxVals)}
      </div>`
    : "";

  const note = briefNote(st);
  const canGenerate = !st.promptLoading && !!(st.promptText || "").trim();

  return `<div class="isv2-bs">
    <div class="isv2-bs-brief${st.briefTakenOver ? " is-editing" : ""}">
      <p class="isv2-bs-eyebrow">Image brief</p>
      ${briefBody(st)}
      ${note ? `<p class="isv2-bs-note">${note}</p>` : ""}
    </div>

    <div class="isv2-bs-foot">
      <div class="isv2-bs-mods" role="group" aria-label="Brief modifiers">
        ${mods.map((m) => modifierChip(m, st)).join("")}
      </div>
      ${panel}
      <div class="isv2-bs-actions">
        <button type="button" class="ap-button primary blue isv2-bs-go" data-img-generate ${canGenerate ? "" : "disabled"}>
          <i class="ap-icon-sparkles-mermaid"></i><span>Generate</span>
        </button>
      </div>
    </div>
  </div>`;
}
