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

import { escapeHtml } from "../../utils.js?v=22";
import { NETWORK_LABEL, NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=39";
import { KEY } from "./context.js?v=42";
import * as imageStudio from "../../image-studio.js?v=89";
import { styleBody } from "./settings-view.js?v=10";
import { refsBody } from "./references-view.js?v=9";
import { brandingBody } from "./branding-view.js?v=4";

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
      <p class="isv2-gcard-label">Write text on the image</p>
      <label class="ap-toggle-container" title="Write text on the image">
        <input type="checkbox" data-img-grid-textonimage ${on ? "checked" : ""} aria-label="Write text on the image" />
        <i aria-hidden="true"></i>
      </label>
    </div>
    <p class="isv2-gcard-hint">${
      on
        ? "I wrote this from your headline idea, shaped by the style you picked. It gets set into the artwork itself."
        : "No words baked into the artwork."
    }</p>
    ${
      on
        ? `<textarea class="isv2-gbrief isv2-gtext" data-img-render-text rows="2" placeholder="${escapeHtml(TEXT_ON_IMAGE_PLACEHOLDER)}" aria-label="Text to write into the image">${escapeHtml(text)}</textarea>
           <p class="ap-form-message error" data-img-render-text-msg role="status"${over ? "" : ` style="display:none"`}>${escapeHtml(over)}</p>`
        : ""
    }
  </div>`;
}

// Type, as DS radio cards rather than a chip row.
//
// Sharing a row with References gives this card real height, and the honest way to
// use it is information rather than padding: each option's description was only ever
// in a `title` tooltip, so it was invisible to anyone who didn't hover. And "Any" —
// the default — was reachable only by clicking the selected chip a second time to
// toggle it off, the kind of hidden affordance the References tiles deliberately
// refuse. Four explicit options, one of them Any, fix both.
//
// Radios are read on `change`, not click: a click on a label-wrapped input fires
// twice (label, then the synthesised click on the input), and both would reach
// setImageType's toggle and cancel each other out.
function typeBody(st) {
  const opts = [{ key: "", label: "Any", desc: "Let me choose" }, ...imageStudio.IMAGE_TYPES];
  return `<div class="isv2-typelist" role="radiogroup" aria-label="Image type">
    ${opts
      .map(
        (o) => `<label class="ap-radio-card card isv2-typeopt">
          <input type="radio" name="isv2GridType" value="${escapeHtml(o.key)}" data-img-type-radio ${(st.imageTypeKey || "") === o.key ? "checked" : ""} />
          <div>
            <span class="ap-radio-card-title">${escapeHtml(o.label)}</span>
            <span>${escapeHtml(o.desc)}</span>
          </div>
        </label>`,
      )
      .join("")}
  </div>`;
}

// How it ships, as ONE card instead of two.
//
// Format and Output were a pair, and the pair wasted the section twice over: Format
// stretched to its neighbour's height with nothing to put there, while the neighbour
// sat underfilled across two columns. Three small chip sets don't need two cards — so
// they share one, laid out as columns divided by hairlines, which fills the width and
// removes the height mismatch entirely (one card can't disagree with itself).
//
// The chips carry the exact same `data-*` hooks as the settings-panel bodies, so
// events.js drives them unchanged.
function outputCard(st, choices, canCarousel, isCarousel) {
  const ratioChips = choices
    .map((f) => {
      const sel = st.formatId === f.id;
      const full = `${f.tag} · ${f.label}`;
      return `<button type="button" class="ap-filter-chip isv2-format-chip" data-img-format="${escapeHtml(f.id)}" aria-pressed="${sel}" title="${escapeHtml(full)}" aria-label="${escapeHtml(full)}"><span class="isv2-ratio-glyph" style="aspect-ratio:${f.ratio}" aria-hidden="true"></span>${escapeHtml(f.tag)}</button>`;
    })
    .join("");

  // "Best for <icon>" — words then icon, network name in the title/aria-label only.
  const netLabel = st.network ? NETWORK_LABEL[st.network] || st.network : "";
  const netIcon = st.network ? NETWORK_ICON_BY_PLATFORM[st.network] : "";
  const bestForNote =
    st.network && netIcon
      ? `<span class="isv2-osub-note" aria-label="Best for ${escapeHtml(netLabel)}">Best for <i class="${netIcon}" title="${escapeHtml(netLabel)}" aria-hidden="true"></i></span>`
      : "";

  const kindGroup = canCarousel
    ? `<div class="isv2-ogroup">
        <p class="isv2-sheet-label">Post type</p>
        <div class="isv2-chip-group">
          <button type="button" class="ap-filter-chip" data-img-output="single" aria-pressed="${!isCarousel}"><i class="ap-icon-image" aria-hidden="true"></i>Single image</button>
          <button type="button" class="ap-filter-chip" data-img-output="carousel" aria-pressed="${isCarousel}"><i class="ap-icon-multiple-images" aria-hidden="true"></i>Carousel</button>
        </div>
      </div>`
    : "";

  const max = imageStudio.carouselMaxFor(st.network);
  const countChips = isCarousel
    ? imageStudio.SLIDE_CHOICES.filter((n) => n <= max)
        .map(
          (n) =>
            `<button type="button" class="ap-filter-chip" data-img-slidecount="${n}" aria-pressed="${st.slideCount === n}">${n}</button>`,
        )
        .join("")
    : imageStudio.VARIATION_CHOICES.map(
        (n) =>
          `<button type="button" class="ap-filter-chip" data-img-varcount="${n}" aria-pressed="${st.variationCount === n}">${n}</button>`,
      ).join("");

  return `<div class="isv2-gcard isv2-gcard--full isv2-gcard--output">
    <p class="isv2-gcard-label">Output</p>
    <div class="isv2-orow">
      <div class="isv2-ogroup">
        <p class="isv2-sheet-label">Aspect ratio${bestForNote}</p>
        <div class="isv2-chip-group">${ratioChips}</div>
      </div>
      ${kindGroup}
      <div class="isv2-ogroup">
        <p class="isv2-sheet-label">${isCarousel ? `Slides${max ? ` · up to ${max}` : ""}` : "Variations"}</p>
        <div class="isv2-chip-group">${countChips}</div>
      </div>
    </div>
  </div>`;
}

// The full-stage brand loader, for both moments the brief is being written: the
// first pass on open (before any card exists — without it they would flash in empty
// and fill under the user), and every reassemble after an edit. The second used to
// be a scrim with a shadowed box over the cards, then a spinner in the Generate
// button; the first was too heavy, the second too quiet for a change that rewrites
// what every card says. Same state, same loader — only the words differ, because
// on open there is nothing yet and on a reassemble there is something being redone.
// `.gen-image-spinner` auto-hosts the animated Archie mark (archie-loader.js), and
// `.gen-loading-mark` is right HERE, at 88px, because this is genuinely the stage.
export function gridAnalyzingView(st = {}) {
  const seeded = !!st.briefSeeded;
  const title = seeded ? "Rewriting your brief…" : "Reading your post…";
  const sub = seeded
    ? "I'm folding your change into the parameters and the words on the image."
    : "I'm setting the best parameters and writing your image brief.";
  return `<div class="isv2-grid-analyzing" role="status" aria-live="polite">
    <span class="gen-image-spinner gen-loading-mark"></span>
    <p class="isv2-grid-analyzing-title">${title}</p>
    <p class="isv2-grid-analyzing-sub">${sub}</p>
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
    // The screen reads top to bottom as three questions: what should it LOOK like,
    // what should it SAY, and how does it SHIP. Format and Output answer the last one
    // — they don't describe the image at all, they decide its shape and how many of
    // it — so they sit at the very bottom, next to the button that acts on them.
    //
    // Cards are paired by height as well as by meaning, because a grid row is as tall
    // as its tallest card: Type beside Style, References beside Branding. Format and
    // Output used to lead this section, and their two chip groups forced the whole
    // first row to their height, leaving Type sitting in a third of a card.
    section("Direction"),
    settingCard("Type", typeBody(st)),
    // References comes BEFORE Style, because it is what switches Style off: reading
    // "From references" on a card that sits above the references themselves is being
    // told the effect before you have seen the cause. Its body splits in two (see
    // .isv2-gcard--split) — stacked, the tiles and the "How to use it" chips left most
    // of the card empty and made it the tallest thing on the screen.
    settingCard("References", refsBody(st, picked), { wide: true, split: true }),
    // Locked when references guide the look — same rule as the settings panel, so the
    // two variants don't disagree about when Style applies. The note can point back
    // now that the references are above it.
    settingCard("Style", styleBody(st), {
      wide: true,
      disabled: hasRefs,
      note: hasRefs ? "Taken from your reference image above" : "",
    }),
    settingCard(
      "Branding",
      hasLogo || hasColors
        ? brandingBody(st, branded, tinted)
        : `<p class="isv2-gcard-hint">No brand kit on this Playbook.</p>`,
      { disabled: !hasLogo && !hasColors },
    ),
    // LAST in Direction, not first on the screen. The words Archie sets into the
    // artwork depend on the look they have to sit on — so this belongs after Type,
    // References and Style are settled, not above them. Same cause-before-effect rule
    // that moved References above Style.
    textOnImageCard(st),

    // What it says — a uniform block of equal-height cards.
    section("Brief"),
    ...BRIEF_FIELDS.map((f) => briefCard(f, st)),

    // How it ships. Last, so the final decisions sit against the Generate button. One
    // card, so it needs no section heading of its own — its label does that job and
    // "Output" stops appearing twice in a row.
    outputCard(st, choices, canCarousel, isCarousel),
  ].join("");

  // No busy state to carry here: while the brief is being rewritten the loader owns
  // the whole stage (stage-view#gridReady), so this view simply isn't on screen.
  return `<div class="isv2-grid">
    <div class="isv2-grid-head">
      <span class="isv2-grid-title">Image setup</span>
      <span class="isv2-grid-sub">I wrote this from your post — tune the options and edit any line.</span>
    </div>
    <div class="isv2-grid-cards">${cards}</div>
    <div class="isv2-grid-actions">
      <button type="button" class="ap-button primary blue isv2-grid-go" data-img-grid-generate><i class="ap-icon-sparkles-mermaid"></i><span>Generate</span></button>
    </div>
  </div>`;
}
