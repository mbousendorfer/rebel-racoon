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
import * as imageStudio from "../../image-studio.js?v=80";
import { imageTypeBody, styleBody, formatBody, outputBody } from "./settings-view.js?v=9";
import { refsBody } from "./references-view.js?v=8";
import { brandingBody } from "./branding-view.js?v=3";

// The six content fields, in the order the attachment shows them. Each is one card:
// a bold label over a bordered textarea bound to s.brief[key]. Heights are fixed in
// CSS so the six read as one uniform block, not a ragged stack.
const BRIEF_FIELDS = [
  { key: "about", label: "What this is about" },
  { key: "achieve", label: "What it should achieve" },
  { key: "audience", label: "Who it is for" },
  { key: "tone", label: "Tone" },
  { key: "headline", label: "Headline idea" },
  { key: "oneThing", label: "The one thing to get across" },
];

// A full-width label that splits the grid into scannable groups — the parameters
// (quick, high-impact choices) up top, the written brief below.
function section(label) {
  return `<p class="isv2-grid-section">${escapeHtml(label)}</p>`;
}

// The card IS the field. A bordered DS textarea nested inside a bordered card drew
// two frames and paid two paddings for one input — which is what made the block
// read as cramped and cheap. So the card takes the input's frame and focus states
// and the textarea goes borderless inside it, the same recipe as the app's own
// composer (.isv2-console + .isv2-prompt). A <label> wrapper means clicking
// anywhere on the card puts the caret in the text.
function briefCard({ key, label }, st) {
  const value = (st.brief && st.brief[key]) || "";
  return `<label class="isv2-gcard isv2-gcard--brief">
    <span class="isv2-gcard-label">${escapeHtml(label)}</span>
    <textarea class="isv2-gbrief" data-img-brief-field="${escapeHtml(key)}" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</textarea>
  </label>`;
}

// A setting as a card: the same label rhythm as the content cards, with the existing
// control body inline. `wide` gives the pickers that need room (References, Style)
// the full grid width.
function settingCard(label, body, { wide = false, full = false, disabled = false, note = "" } = {}) {
  const span = full ? " isv2-gcard--full" : wide ? " isv2-gcard--wide" : "";
  return `<div class="isv2-gcard isv2-gcard--setting${span}${disabled ? " is-disabled" : ""}">
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
  return `<div class="isv2-gcard isv2-gcard--toggle isv2-gcard--full">
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

// The opening "Archie is reading your post" state — a full-stage brand loader
// shown while the structured brief is seeded (runDerive, ~2s), BEFORE the grid
// appears. Without it the cards would flash in empty and then fill under the user;
// with it, the analysis reads as the deliberate step it is. Shown once per open
// (gated on !briefSeeded) — later reassembles on edits never bring it back.
// `.gen-image-spinner` auto-hosts the animated Archie mark (archie-loader.js).
export function gridAnalyzingView() {
  return `<div class="isv2-grid-analyzing" role="status" aria-live="polite">
    <span class="gen-image-spinner gen-loading-mark"></span>
    <p class="isv2-grid-analyzing-title">Reading your post…</p>
    <p class="isv2-grid-analyzing-sub">Archie is setting the best parameters and writing your image brief.</p>
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

    // Parameters first: the quick, high-impact choices belong at the top, not below
    // six paragraphs of copy. Type leads — it's the biggest lever.
    //
    // Three columns, and the spans are chosen so each run fills a row exactly —
    // the three chip cards, then Style beside Branding, then References — which is
    // what keeps the whole setup roughly one screen instead of a long scroll.
    section("Parameters"),
    settingCard("Type", imageTypeBody(st)),
    settingCard("Format", formatBody(st, choices)),
    settingCard(canCarousel ? "Output" : "Variations", outputBody(st, canCarousel, isCarousel)),
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
    settingCard("References", refsBody(st, picked), { full: true }),

    // The written brief below — a uniform block of equal-height cards.
    section("Brief"),
    ...BRIEF_FIELDS.map((f) => briefCard(f, st)),
  ].join("");

  // A change reassembles the hidden prompt instantly, so this reports work that is
  // already DONE rather than making the user wait on a spinner for something they
  // never see. It confirms the dependency ("that setting fed the brief") at no cost
  // in time — see image-studio.js#assembleGridNow.
  const flash = st.briefFlash
    ? `<span class="isv2-grid-flash" role="status"><i class="ap-icon-rounded-check" aria-hidden="true"></i>Brief updated</span>`
    : "";

  return `<div class="isv2-grid">
    <div class="isv2-grid-head">
      <span class="isv2-grid-title">Image setup</span>
      <span class="isv2-grid-sub">Archie derived this from your post — tune the parameters and edit any line.</span>
    </div>
    <div class="isv2-grid-cards">${cards}</div>
    <div class="isv2-grid-actions">
      <span class="isv2-grid-actions-side"></span>
      <button type="button" class="ap-button primary blue isv2-grid-go" data-img-grid-generate><i class="ap-icon-sparkles-mermaid"></i><span>Generate</span></button>
      <span class="isv2-grid-actions-side">${flash}</span>
    </div>
  </div>`;
}
