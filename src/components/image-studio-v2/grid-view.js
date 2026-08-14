// Image Studio — the grid-brief variant (flag imageStudioGridBrief).
//
// A third take on the generate screen: instead of a floating settings panel beside
// the image plus a prose prompt in the composer, the WHOLE generate surface becomes
// a full-bleed dashboard grid of editable cards — a structured brief editor. The
// prompt is decomposed into named fields Archie fills from the post, and the
// settings (Type / Style / References / Branding / Format / Output) are cards too,
// with their controls INLINE. There is no prose prompt: the cards are the editor,
// and Generate (below) assembles them into the model prompt (image-studio.js#
// assembleGridPrompt). Rendered by stage-view when gridBrief && genPhase === "idle".
//
// Everything here is a pure function of state — the one-way render path the whole
// studio follows. The setting cards reuse the EXACT body builders the settings panel
// uses, so their data-* controls are already wired in events.js and work unchanged;
// only the container differs.

import { escapeHtml } from "../../utils.js?v=21";
import { KEY } from "./context.js?v=41";
import * as imageStudio from "../../image-studio.js?v=79";
import { imageTypeBody, styleBody, formatBody, outputBody } from "./settings-view.js?v=9";
import { refsBody } from "./references-view.js?v=8";
import { brandingBody } from "./branding-view.js?v=3";

// The six content fields, in the order the attachment shows them. Each is one card:
// a bold label over a bordered textarea bound to s.brief[key].
const BRIEF_FIELDS = [
  { key: "about", label: "What this is about", rows: 2 },
  { key: "achieve", label: "What it should achieve", rows: 3 },
  { key: "audience", label: "Who it is for", rows: 2 },
  { key: "tone", label: "Tone", rows: 1 },
  { key: "headline", label: "Headline idea", rows: 1 },
  { key: "oneThing", label: "The one thing to get across", rows: 2 },
];

function briefCard({ key, label, rows }, st) {
  const value = (st.brief && st.brief[key]) || "";
  return `<div class="isv2-gcard">
    <p class="isv2-gcard-label">${escapeHtml(label)}</p>
    <div class="ap-textarea-field isv2-gfield">
      <textarea data-img-brief-field="${escapeHtml(key)}" rows="${rows}" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</textarea>
    </div>
  </div>`;
}

// A setting as a card: the same label rhythm as the content cards, with the existing
// control body inline. `wide` gives the pickers that need room (References, Style)
// the full grid width.
function settingCard(label, body, { wide = false, disabled = false, note = "" } = {}) {
  return `<div class="isv2-gcard isv2-gcard--setting${wide ? " isv2-gcard--wide" : ""}${disabled ? " is-disabled" : ""}">
    <p class="isv2-gcard-label">${escapeHtml(label)}</p>
    ${note ? `<p class="isv2-gcard-hint">${escapeHtml(note)}</p>` : ""}
    <div class="isv2-gcard-body">${body}</div>
  </div>`;
}

// "Write text on the image" — the one toggle card, sitting first and full width the
// way the attachment shows it. On paints the headline into the artwork; the literal
// words are refined on the blueprint (Edit mode).
function textOnImageCard(st) {
  const on = !!st.textOnImage;
  return `<div class="isv2-gcard isv2-gcard--toggle isv2-gcard--wide">
    <div class="isv2-gcard-toggle-row">
      <div class="isv2-gcard-toggle-copy">
        <p class="isv2-gcard-label">Write text on the image</p>
        <p class="isv2-gcard-hint">Edit it on the blueprint, where it will appear.</p>
      </div>
      <label class="ap-toggle-container" title="Write text on the image">
        <input type="checkbox" data-img-grid-textonimage ${on ? "checked" : ""} aria-label="Write text on the image" />
        <i aria-hidden="true"></i>
      </label>
    </div>
  </div>`;
}

export function gridBriefView(st) {
  const picked = imageStudio.selectedReference(st);
  const hasLogo = !!st.playbookLogo;
  const hasColors = (st.playbookColors || []).length > 0;
  const branded = hasLogo && !!st.useBranding;
  const tinted = hasColors && !!st.useBrandColors;
  const hasRefs = st.referenceImages.length > 0;
  const choices = imageStudio.formatChoices(KEY);
  const canCarousel = imageStudio.supportsCarousel(st.network);
  const isCarousel = canCarousel && st.outputMode === "carousel";

  const cards = [
    textOnImageCard(st),
    ...BRIEF_FIELDS.map((f) => briefCard(f, st)),
    settingCard("References", refsBody(st, picked), { wide: true }),
    settingCard("Type", imageTypeBody(st)),
    // Style is locked when references guide the look — mirror the settings panel's
    // rule so the two variants don't disagree about when Style applies.
    settingCard("Style", styleBody(st), {
      wide: true,
      disabled: hasRefs,
      note: hasRefs ? "From references" : "",
    }),
    settingCard(
      "Branding",
      hasLogo || hasColors
        ? brandingBody(st, branded, tinted)
        : `<p class="isv2-gcard-hint">No brand kit on this Playbook.</p>`,
      { disabled: !hasLogo && !hasColors },
    ),
    settingCard("Format", formatBody(st, choices)),
    settingCard(canCarousel ? "Output" : "Variations", outputBody(st, canCarousel, isCarousel)),
  ].join("");

  return `<div class="isv2-grid">
    <div class="isv2-grid-head">
      <span class="isv2-grid-title">Brief</span>
      <span class="isv2-grid-sub">Archie derived this from your post. It is what the model is told — change any line.</span>
    </div>
    <div class="isv2-grid-cards">${cards}</div>
    <div class="isv2-grid-actions">
      <button type="button" class="ap-button secondary blue" data-img-grid-generate><i class="ap-icon-sparkles-mermaid"></i><span>Generate</span></button>
    </div>
  </div>`;
}
