// Image Studio V3 — the Options form, built on the DS's real form controls.
//   (flag imageStudioSetupFirst)
//
// ── Why this file duplicates the settings panel ──────────────────────────────
//
// The other two variants render these same seven settings through settings-view.js's
// shared bodies, and CLAUDE.md says a renderer should have one home and several hosts.
// This file is the stated exception, for one reason: SPACE.
//
// The DS routes an in-form exclusive choice to Radio or Radio-button-card — its own
// segmented-control guideline says so outright ("❌ an in-form exclusive choice (that's
// a Radio group)"), and `.ap-filter-chip` isn't a DS class at all but a local stand-in
// for `filter-chips-list`, a control defined as "toggling a chip refines the visible
// list". A form value is not a filter. But radio cards do not fit a 284px pinned column
// or a popover opening upward over a brief — so the two narrow hosts keep their chips,
// and the variant that has the room uses what the DS actually prescribes.
//
// That is an argument about the space each host has, not about what the control means.
// If the pinned panel ever gets room, this file is what it should converge on.
//
// ── What "Any" is doing here ─────────────────────────────────────────────────
//
// A radio group cannot be emptied, so Type and Style get an explicit "Any" option
// instead of the chips' invisible contract (click the selected one again to clear it).
// That is why the engine has setImageTypeExact / setStyleExact: the chip hosts still
// need the toggle, and one setter meaning two things by caller is how contracts drift.
//
// ── Conventions this file follows ────────────────────────────────────────────
//
// `.ap-form-field` per field — it styles only its own 8px gap and its `> label`, so it
// scaffolds any control, not just an `<input>`. UI-PATTERNS §"contrôles de niveau page"
// already prescribes it. A group of radios is a `<fieldset>` with a `<legend>` naming
// the choice, which is what makes ↑↓ navigate the group and Tab skip past it.
//
// Every radio commits on `change`, under its own `data-img-pick-*` hook — NOT the
// chips' `data-img-*` click hooks: a click on a `<label>` wrapping a radio fires both a
// click and a change, so sharing a hook would apply each choice twice and net to zero.

import { escapeHtml } from "../../utils.js?v=22";
import { NETWORK_LABEL, NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=46";
import { KEY } from "./context.js?v=50";
import * as imageStudio from "../../image-studio.js?v=102";

const ANY = ""; // the radio value that means "no preference" — the engine stores null

// ── Primitives ──────────────────────────────────────────────────────────────

// A field: label above control, the DS's own 8px between them. `note` is the label's
// description slot (`> small`), which is where a per-field hint belongs — that retires
// the free-floating `.isv2-sheet-hint` line the chips needed.
function field(label, body, { note = "", wide = false, id = "" } = {}) {
  const small = note ? `<small>${note}</small>` : "";
  return `<fieldset class="ap-form-field isv2-field${wide ? " isv2-field--wide" : ""}"${id ? ` data-field="${id}"` : ""}>
    <legend>${escapeHtml(label)}${small}</legend>
    ${body}
  </fieldset>`;
}

// A plain radio: the dot, then the words. For a fixed, short set of plain options.
function radio(hook, name, value, label, { checked = false, disabled = false } = {}) {
  return `<label class="ap-radio-container">
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${hook}="${escapeHtml(value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
    <span>${escapeHtml(label)}</span>
  </label>`;
}

// A radio CARD: for an option that carries a glyph, or a title plus a line explaining
// it. `.card` adds the bordered frame; without it the card is just a radio with a
// description, which is the shape "How to use it" and Format want.
function radioCard(
  hook,
  name,
  value,
  title,
  { checked = false, desc = "", icon = "", glyph = "", framed = false } = {},
) {
  const lead = glyph || (icon ? `<i class="${icon}" aria-hidden="true"></i>` : "");
  return `<label class="ap-radio-card${framed ? " card" : ""}">
    <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${hook}="${escapeHtml(value)}" ${checked ? "checked" : ""} />
    <div>
      <span class="ap-radio-card-header">${lead}<span class="ap-radio-card-title">${escapeHtml(title)}</span></span>
      ${desc ? `<span>${escapeHtml(desc)}</span>` : ""}
    </div>
  </label>`;
}

// The DS toggle, in its own shape: the label is a DIRECT `> span` of the container, not
// a sibling in a flex row. The shared bodies wrap it, which is drift from the DS's
// "components style their direct children" rule.
function toggle(hook, label, on, { title = "", disabled = false } = {}) {
  return `<label class="ap-toggle-container"${title ? ` title="${escapeHtml(title)}"` : ""}>
    <input type="checkbox" ${hook} ${on ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="${escapeHtml(label)}" />
    <i aria-hidden="true"></i>
    <span>${escapeHtml(label)}</span>
  </label>`;
}

const rowOf = (html) => `<div class="isv2-radio-row">${html}</div>`;
const gridOf = (html) => `<div class="isv2-radio-grid">${html}</div>`;

// ── The fields ──────────────────────────────────────────────────────────────

// Reference image. The switch owns "none at all" and is the field's own control, so
// there is no second label above it. Everything below appears only while it is on — a
// sub-option that outlives its subject is a control that lies.
function referenceField(st) {
  const picked = imageStudio.selectedReference(st);
  const on = !!picked;
  const head = toggle("data-img-toggle-ref", "Use a reference image", on, {
    title: "Give the generator an image to match",
  });
  if (!on) return `<div class="isv2-field isv2-field--wide">${head}</div>`;

  const pool = imageStudio.referencePool(st);
  const brand = pool.filter((r) => r.fromPlaybook);
  const mine = pool.filter((r) => !r.fromPlaybook);
  const tile = (r) => {
    const on2 = picked && r.id === picked.id;
    const bits = [r.label || "Reference image"];
    if ((r.note || "").trim()) bits.push(r.note.trim());
    const remove = r.fromPlaybook
      ? ""
      : `<button type="button" class="isv2-ref-remove" data-img-ref-remove="${escapeHtml(r.id)}" aria-label="Remove this image"><i class="ap-icon-close" aria-hidden="true"></i></button>`;
    // The tile geometry stays ours — the DS has no thumbnail-grid radio — but the
    // SEMANTICS are now a real radio: one name, one checked, keyboard-navigable.
    return `<div class="isv2-ref-slot">
      <label class="isv2-ref isv2-ref--pick${on2 ? " is-used" : " is-skipped"}" title="${escapeHtml(bits.join(" · "))}">
        <input type="radio" name="isv2-ref" value="${escapeHtml(r.id)}" data-img-pick-ref="${escapeHtml(r.id)}" ${on2 ? "checked" : ""} aria-label="${escapeHtml(bits[0])}" />
        <i class="ap-icon-image isv2-ref-ph" aria-hidden="true"></i>
        <img src="${escapeHtml(r.url)}" alt="" />
        <span class="isv2-ref-scrim" aria-hidden="true"></span>
        <span class="isv2-ref-radio" aria-hidden="true"></span>
      </label>
      ${remove}
    </div>`;
  };
  const capped = mine.length >= imageStudio.MAX_REFS;
  const adder = capped
    ? `<p class="isv2-fieldnote">Maximum ${imageStudio.MAX_REFS} images. Remove one to add another.</p>`
    : `<button type="button" class="ap-button stroked grey isv2-ref-add" data-img-dropzone data-img-ref-add>
        <i class="ap-icon-plus" aria-hidden="true"></i><span>Add an image</span>
      </button>`;
  const group = (label, items) =>
    items.length
      ? `<fieldset class="ap-form-field isv2-tilefield">
          <legend>${escapeHtml(label)}</legend>
          <div class="isv2-refs">${items.map(tile).join("")}</div>
        </fieldset>`
      : "";
  const book = st.playbookName ? `Brand book — ${st.playbookName}` : "Brand book";

  // Plain radios and the ACTIVE mode's sentence as the field's note, not three cards each
  // carrying their own. The DS gives a radio card a first-class slot for a description,
  // and all three at once are 100px of guidance for a decision you make once — the same
  // trade the chips made when they put the live hint under the row. One line, and it is
  // the line about the mode you actually chose.
  const active = imageStudio.REF_MODES.some((m) => m.key === st.refMode) ? st.refMode : imageStudio.DEFAULT_REF_MODE;
  const modes = field(
    "How to use it",
    rowOf(
      imageStudio.REF_MODES.map((m) =>
        radio("data-img-pick-refmode", "isv2-refmode", m.key, m.label, { checked: m.key === active }),
      ).join(""),
    ),
  );
  // ONE note. The mode's sentence and the fact that this image also settles Style were
  // two consecutive 12px grey lines, the second wearing an info icon nothing else in the
  // form wears — a wall of small grey text under the control it explains. Same ink, same
  // size, one paragraph.
  const modeHint = `<p class="isv2-fieldnote">${escapeHtml(imageStudio.REF_MODES.find((m) => m.key === active).hint)} It also sets the style, so there's no Style to pick.</p>`;

  return `<div class="isv2-field isv2-field--wide">
    ${head}
    <div class="isv2-reffield">
      ${group(book, brand)}
      ${group("Custom", mine)}
      ${adder}
    </div>
    ${modes}
    ${modeHint}
  </div>`;
}

// Text in image. `.ap-textarea-field` IS a form field — same column, same 8px gap, and
// it styles its own `> label > small`. Nesting it inside `.ap-form-field` would give one
// field two scaffolds.
function textField(st) {
  const text = st.renderText || "";
  const over = imageStudio.renderTextOverMessage(text);
  return `<div class="ap-textarea-field narrow isv2-textfield isv2-field">
    <label>Text in image</label>
    <textarea data-img-render-text rows="2" placeholder="Black Friday
−50% on everything" aria-label="Text to write into the image">${escapeHtml(text)}</textarea>
    <p class="ap-form-message error" data-img-render-text-msg role="status"${over ? "" : ` style="display:none"`}>${escapeHtml(over)}</p>
  </div>`;
}

function brandingField(st) {
  const hasLogo = !!st.playbookLogo;
  const colors = st.playbookColors || [];
  const hasColors = colors.length > 0;
  if (!hasLogo && !hasColors) return field("Branding", `<p class="isv2-fieldnote">No brand kit on this Playbook.</p>`);
  const dots = hasColors
    ? `<span class="isv2-branddots" aria-hidden="true">${colors
        .slice(0, 5)
        .map((c) => `<span class="isv2-branddot" style="background:${escapeHtml(c.hex)}"></span>`)
        .join("")}</span>`
    : "";
  return field(
    "Branding",
    `<div class="isv2-togglestack">
      ${toggle("data-img-toggle-branding", "Show my logo", hasLogo && !!st.useBranding, { disabled: !hasLogo })}
      <span class="isv2-toggleline">${toggle("data-img-toggle-brand-colors", "Use brand colours", hasColors && !!st.useBrandColors, { disabled: !hasColors })}${dots}</span>
    </div>`,
    { note: st.playbookName ? escapeHtml(st.playbookName) : "" },
  );
}

function typeField(st) {
  const opts = [
    radio("data-img-pick-type", "isv2-type", ANY, "Any", { checked: !st.imageTypeKey }),
    ...imageStudio.IMAGE_TYPES.map((o) =>
      radio("data-img-pick-type", "isv2-type", o.key, o.label, { checked: st.imageTypeKey === o.key }),
    ),
  ].join("");
  return field("Type", gridOf(opts));
}

function styleField(st) {
  const cards = [
    radioCard("data-img-pick-style", "isv2-style", ANY, "Any", { checked: !st.styleKey, framed: true }),
    ...imageStudio.STYLE_PRESETS.map((o) =>
      radioCard("data-img-pick-style", "isv2-style", o.key, o.label, { checked: st.styleKey === o.key, framed: true }),
    ),
  ].join("");
  return field("Style", gridOf(cards), { note: "The look, when no reference is guiding it." });
}

function formatField(st) {
  const choices = imageStudio.formatChoices(KEY);
  // Plain radios, "1:1 · Square" on one line, and no ratio glyph. The glyph is a nice
  // idea that cost more than it gave here: three cards sharing a half-width cell had
  // ~130px each, so glyph + tag + word wrapped, and the field became three ragged
  // two-line columns. Dropping it also puts Format in the same vocabulary as Type and
  // Variations beside it — one kind of control per group, not two.
  const cards = choices
    .map((f) =>
      radio("data-img-pick-format", "isv2-format", f.id, `${f.tag} · ${f.label}`, {
        checked: st.formatId === f.id,
      }),
    )
    .join("");
  // "Best for <icon>" — the words, then the network's glyph, its name in the title.
  // As the label's description, which is the DS slot for a per-field hint.
  let note = "";
  if (st.network) {
    const label = NETWORK_LABEL[st.network] || st.network;
    const icon = NETWORK_ICON_BY_PLATFORM[st.network];
    note = icon
      ? `Best for <i class="${icon}" title="${escapeHtml(label)}" aria-hidden="true"></i>`
      : `Best for ${escapeHtml(label)}`;
  }
  return field("Format", rowOf(cards), { note });
}

function outputField(st) {
  const canCarousel = imageStudio.supportsCarousel(st.network);
  const isCarousel = canCarousel && st.outputMode === "carousel";
  if (!canCarousel) return "";
  // Unframed: `.card` is for an option you compare by looking at it — a thumbnail, a
  // plan. These two are named things with a glyph, and the frame cost 26px a row, which
  // was the whole difference between the last field fitting the fold and being cut.
  return field(
    "Output",
    rowOf(
      radioCard("data-img-pick-output", "isv2-output", "single", "Single image", {
        checked: !isCarousel,
        icon: "ap-icon-image",
      }) +
        radioCard("data-img-pick-output", "isv2-output", "carousel", "Carousel", {
          checked: isCarousel,
          icon: "ap-icon-multiple-images",
        }),
    ),
  );
}

// The count. Radios, not a slider and never `.ap-stepper` (a step trail) or
// `.ap-counter` (a read-out): for four-to-six fixed values, one tap on the number you
// want beats dragging to it. The bare digits used to be pill chips, which is exactly
// what a paginator looks like — a labelled radio group cannot be mistaken for one.
function countField(st) {
  const canCarousel = imageStudio.supportsCarousel(st.network);
  const isCarousel = canCarousel && st.outputMode === "carousel";
  if (isCarousel) {
    const max = imageStudio.carouselMaxFor(st.network);
    const opts = imageStudio.SLIDE_CHOICES.filter((n) => n <= max)
      .map((n) =>
        radio("data-img-pick-slidecount", "isv2-slides", String(n), String(n), { checked: st.slideCount === n }),
      )
      .join("");
    return field("Slides", rowOf(opts), { note: `Up to ${max} on this network.` });
  }
  const opts = imageStudio.VARIATION_CHOICES.map((n) =>
    radio("data-img-pick-varcount", "isv2-varcount", String(n), String(n), { checked: st.variationCount === n }),
  ).join("");
  // No note: "Variations" plus a row of numbers is the whole sentence, and the line cost
  // the last field on the fold.
  return field("Variations", rowOf(opts));
}

// ── The two groups ──────────────────────────────────────────────────────────
//
// The order is the one FEATURES has always claimed: what goes IN the image, then how it
// is made. Grouping states it instead of implying it by sequence.
export function optionsForm(st) {
  const hasRefs = st.referenceImages.length > 0;
  const groups = [
    {
      label: "What's in the image",
      fields: [referenceField(st), textField(st), brandingField(st)],
    },
    {
      label: "How it's made",
      // Style is ABSENT while a reference guides the look, not present-and-greyed: a
      // field that can do nothing is not a field, and the reason is stated where the
      // cause is (referenceField's note).
      fields: [typeField(st), formatField(st), hasRefs ? "" : styleField(st), outputField(st), countField(st)],
    },
  ];
  return groups
    .map(
      (g) => `<section class="isv2-optgroup">
        <h3 class="isv2-optgroup-label">${escapeHtml(g.label)}</h3>
        <div class="isv2-optgrid">${g.fields.filter(Boolean).join("")}</div>
      </section>`,
    )
    .join("");
}
