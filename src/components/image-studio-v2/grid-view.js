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
import * as imageStudio from "../../image-studio.js?v=82";
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
function settingCard(label, body, { wide = false, full = false, split = false, disabled = false, note = "" } = {}) {
  const span = full ? " isv2-gcard--full" : wide ? " isv2-gcard--wide" : "";
  return `<div class="isv2-gcard isv2-gcard--setting${span}${split ? " isv2-gcard--split" : ""}${disabled ? " is-disabled" : ""}">
    <p class="isv2-gcard-label">${escapeHtml(label)}</p>
    ${note ? `<p class="isv2-gcard-hint">${escapeHtml(note)}</p>` : ""}
    <div class="isv2-gcard-body">${body}</div>
  </div>`;
}

// "Write text on the image" — first card, full width, because the words baked into
// the artwork are the most visible thing the image will carry.
//
// The words are DERIVED from the post like every other line of the brief (Archie
// picks the line that reads at a glance) and edited right here — not deferred to the
// blueprint, and not a mirror of "Headline idea": mirroring meant editing one field
// silently rewrote another, the same trap Type → headline used to be.
//
// The field only exists while the switch is on; a text box for text you have turned
// off is an invitation to write something that will never appear. Turning it back on
// restores what you wrote (see setTextOnImage).
const TEXT_ON_IMAGE_PLACEHOLDER = `Black Friday
−50% on everything`;

function textOnImageCard(st) {
  const on = !!st.textOnImage;
  const text = st.renderText || "";
  const over = imageStudio.renderTextOverMessage(text);
  return `<div class="isv2-gcard isv2-gcard--full isv2-gcard--textonimage${on ? " is-on" : ""}">
    <div class="isv2-gcard-toggle-row">
      <div class="isv2-gcard-toggle-copy">
        <p class="isv2-gcard-label">Write text on the image</p>
        <p class="isv2-gcard-hint">${
          on
            ? "Archie took this from your post. It gets set into the artwork itself."
            : "No words baked into the artwork."
        }</p>
      </div>
      <label class="ap-toggle-container" title="Write text on the image">
        <input type="checkbox" data-img-grid-textonimage ${on ? "checked" : ""} aria-label="Write text on the image" />
        <i aria-hidden="true"></i>
      </label>
    </div>
    ${
      on
        ? `<textarea class="isv2-gbrief isv2-gtext" data-img-render-text rows="2" placeholder="${escapeHtml(TEXT_ON_IMAGE_PLACEHOLDER)}" aria-label="Text to write into the image">${escapeHtml(text)}</textarea>
           <p class="ap-form-message error" data-img-render-text-msg role="status"${over ? "" : ` style="display:none"`}>${escapeHtml(over)}</p>`
        : ""
    }
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
    // Full width, but its body splits in two (see .isv2-gcard--split) — stacked, the
    // tiles and the "How to use it" chips left the right two-thirds of the card empty
    // and made it the tallest thing on the screen.
    settingCard("References", refsBody(st, picked), { full: true, split: true }),

    // The written brief below — a uniform block of equal-height cards.
    section("Brief"),
    ...BRIEF_FIELDS.map((f) => briefCard(f, st)),
  ].join("");

  // Rewriting the brief BLOCKS. The prompt being rebuilt is never shown in this
  // variant, so a passive indicator left the user unsure their change had landed;
  // a scrim over the cards makes the dependency ("that setting feeds the brief")
  // impossible to miss, and stops a second change arriving mid-flight. Only once
  // the brief is seeded — before that, the opening loader owns the screen.
  const busy = st.promptLoading && st.briefSeeded;
  const scrim = busy
    ? `<div class="isv2-grid-scrim" role="status" aria-live="polite">
        <div class="isv2-grid-scrim-box">
          <span class="gen-image-spinner gen-loading-mark"></span>
          <p class="isv2-grid-scrim-label">Rewriting the brief…</p>
        </div>
      </div>`
    : "";

  return `<div class="isv2-grid${busy ? " is-busy" : ""}">
    <div class="isv2-grid-head">
      <span class="isv2-grid-title">Image setup</span>
      <span class="isv2-grid-sub">Archie derived this from your post — tune the parameters and edit any line.</span>
    </div>
    <div class="isv2-grid-cards">${cards}</div>
    <div class="isv2-grid-actions">
      <button type="button" class="ap-button primary blue isv2-grid-go" data-img-grid-generate ${busy ? "disabled" : ""}><i class="ap-icon-sparkles-mermaid"></i><span>Generate</span></button>
    </div>
    ${scrim}
  </div>`;
}
