// Image Generator — the brand's image styles, as the Playbook's Brand section
// shows them (flag sexySquirrel). The fiche calls two functions and knows
// nothing else: renderPlaybookStyles() for the row, handlePlaybookStylesClick()
// from its own delegated click handler.
//
// A style is part of the brand — what its images look like — so it lives ON the
// Playbook (imageStyles) and is managed here, where the logo and the colours
// are. Creating or editing one opens the style creator, a page of its own
// (/playbook/:id/styles/*), because it needs the room: reference images, their
// weights and a test on three subjects. The 22 presets — the looks the studio
// offers besides the brand's own — are browsed from here too, in a dialog.

import { html, toString } from "../lib/html.js?v=1357";
import { navigate } from "../../../router.js?v=1357";
import { styleThumb } from "../ui/style-thumb.js?v=1357";
import { confirmDialog, openDialog } from "../ui/dialog.js?v=1357";
import { toast } from "../ui/toast.js?v=1357";
import { STYLE_FAMILIES, STYLE_PRESETS, STYLE_TEST_SUBJECTS, presetById } from "../config/style-presets.js?v=1357";
import { canEditBrand, getBrand, getStyle, getStylesForBrand } from "../state/store.js?v=1357";
import { deleteStyle, duplicateStyle } from "../state/style-actions.js?v=1357";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;

/** "3 reference images · Style & composition" — what a style is made of, in words. */
export function sourcesSummary(style) {
  const images = (style.custom?.sources || []).filter((s) => s.type === "image").length;
  const keep = style.custom?.fidelity === "composition" ? "Style & composition" : "Essential";
  return [images ? `${images} reference image${images === 1 ? "" : "s"}` : "", keep].filter(Boolean).join(" · ");
}

function styleCard(style, brand, canEdit) {
  return html`
    <article class="ap-card imst-style-card imst-pbstyle">
      ${canEdit
        ? html`<button
            type="button"
            class="imst-style-card__open"
            data-imst-pb-style="edit"
            data-imst-style="${style.id}"
            aria-label="Edit ${style.label}"
          >
            ${styleThumb(style, brand)}
          </button>`
        : html`<span class="imst-style-card__open">${styleThumb(style, brand)}</span>`}
      <div class="imst-style-card__body">
        <div class="imst-style-card__title">
          <span class="ap-body-bold">${style.label}</span>
          ${canEdit
            ? html`<span class="imst-pbstyle__actions">
                <button
                  type="button"
                  class="ap-icon-button transparent grey"
                  data-imst-pb-style="duplicate"
                  data-imst-style="${style.id}"
                  aria-label="Duplicate ${style.label}"
                  data-tooltip="Duplicate"
                >
                  <i class="ap-icon-copy" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="ap-icon-button transparent grey"
                  data-imst-pb-style="delete"
                  data-imst-style="${style.id}"
                  aria-label="Delete ${style.label}"
                  data-tooltip="Delete"
                >
                  <i class="ap-icon-trash" aria-hidden="true"></i>
                </button>
              </span>`
            : ""}
        </div>
        <span class="ap-caption imst-style-card__meta">${sourcesSummary(style)}</span>
      </div>
    </article>
  `;
}

/** The Brand section's "Image styles" row: the Playbook's styles, New style, Browse presets. */
export function renderPlaybookStyles(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const own = getStylesForBrand(playbookId).filter((s) => s.kind === "custom");
  return toString(html`
    <div class="imst-pbstyles">
      ${own.length
        ? html`<div class="imst-pbstyles__grid">${own.map((s) => styleCard(s, brand, editable))}</div>`
        : html`<p class="ap-body imst-pbstyles__empty">
            No style of this brand's own yet. Give a few reference images whose look you want, and it comes first
            whenever an image is made for this Playbook.
          </p>`}
      <div class="imst-pbstyles__actions">
        ${editable
          ? html`<button type="button" class="ap-button stroked grey" data-imst-pb-style="new">
              <i class="ap-icon-plus" aria-hidden="true"></i><span>New style</span>
            </button>`
          : ""}
        <button type="button" class="ap-link" data-imst-pb-style="presets">
          Browse the ${STYLE_PRESETS.length} presets
        </button>
      </div>
    </div>
  `);
}

function presetPreview(preset, brand) {
  openDialog({
    title: preset.label,
    subtitle: preset.description,
    size: "lg",
    body: html`
      <div class="imst-test-grid">
        ${STYLE_TEST_SUBJECTS.map(
          (s, i) =>
            html`<figure class="imst-test-grid__item">
              ${styleThumb(preset, brand, { seed: 7 + i * 131, kind: s.id })}
              <figcaption class="ap-caption">${s.label}</figcaption>
            </figure>`,
        )}
      </div>
      <p class="ap-body imst-dialog__text">
        ${preset.supportsEmbeddedText
          ? "This style can carry text I write into the image, or an editable text layer."
          : "Text goes on an editable layer with this style — it can't carry text written into the image."}
      </p>
    `,
  });
}

function browsePresets(playbookId) {
  const brand = getBrand(playbookId);
  let family = "all";
  let galleryH = 0; // measured on open: two and a half rows, whatever the filter shows
  const body = () => html`
    <div class="imst-chips" role="group" aria-label="Filter presets by family">
      ${[{ id: "all", label: "All" }, ...STYLE_FAMILIES].map(
        (f) =>
          html`<button
            type="button"
            class="ap-filter-chip"
            aria-pressed="${family === f.id}"
            data-imst-family="${f.id}"
          >
            ${f.label}
          </button>`,
      )}
    </div>
    <div class="imst-gallery-scroll" style="${galleryH ? `--imst-gallery-h: ${galleryH}px` : ""}">
      <div class="imst-gallery">
        ${STYLE_PRESETS.filter((p) => family === "all" || p.family === family).map(
          (p) =>
            html`<button
              type="button"
              class="imst-gallery__item"
              data-imst-preset="${p.id}"
              aria-label="${p.label} — preview"
            >
              <span class="imst-gallery__art">${styleThumb(p, brand)}</span>
              <span class="imst-gallery__text"
                ><span class="ap-body-bold">${p.label}</span><span class="ap-caption">${p.description}</span></span
              >
            </button>`,
        )}
      </div>
    </div>
  `;
  const dialog = openDialog({
    title: "Presets",
    subtitle: `The looks the studio offers besides this brand's own — every one drawn in ${brand.name}'s colours.`,
    size: "lg",
    body: body(),
    onMount(el) {
      const scroller = el.querySelector(".imst-gallery-scroll");
      const item = el.querySelector(".imst-gallery__item");
      if (scroller && item) {
        const gap = parseFloat(getComputedStyle(el.querySelector(".imst-gallery")).rowGap) || 0;
        const pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
        galleryH = Math.round(item.offsetHeight * 2.5 + gap * 2 + pad);
        scroller.style.setProperty("--imst-gallery-h", `${galleryH}px`);
      }
      el.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-imst-family]");
        if (chip) {
          family = chip.dataset.imstFamily;
          dialog.setBody(body());
          return;
        }
        const card = event.target.closest("[data-imst-preset]");
        if (card) presetPreview(presetById(card.dataset.imstPreset), brand);
      });
    },
  });
}

/** The fiche's delegated click, for the row above. Returns true when it handled the click. */
export function handlePlaybookStylesClick(event, playbookId, { onChange = () => {} } = {}) {
  const el = event.target.closest("[data-imst-pb-style]");
  if (!el || !playbookId) return false;
  const action = el.dataset.imstPbStyle;
  const styleId = el.dataset.imstStyle;
  if (action === "presets") {
    browsePresets(playbookId);
    return true;
  }
  if (!canEditBrand(playbookId)) return true;
  if (action === "new") navigate(creatorPath(playbookId, "new"));
  else if (action === "edit") navigate(creatorPath(playbookId, encodeURIComponent(styleId)));
  else if (action === "duplicate") {
    const copy = duplicateStyle(playbookId, styleId);
    if (copy) {
      toast(`Duplicated as ${copy.label}.`);
      onChange();
    }
  } else if (action === "delete") {
    const style = getStyle(styleId);
    confirmDialog({
      title: `Delete ${style?.label || "this style"}?`,
      body: "Images already made with it stay as they are. This can't be undone.",
      confirmLabel: "Delete style",
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      deleteStyle(playbookId, styleId);
      toast(`${style?.label || "The style"} deleted.`);
      onChange();
    });
  }
  return true;
}
