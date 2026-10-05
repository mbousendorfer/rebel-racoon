// Image Generator — the brand's image styles, as the Playbook's Brand section
// shows them (flag sexySquirrel). The fiche calls two functions and knows
// nothing else: renderPlaybookStyles() for the row, handlePlaybookStylesClick()
// from its own delegated click handler.
//
// A style is part of the brand — what its images look like — so it lives ON the
// Playbook (imageStyles) and is managed here, where the logo and the colours
// are. Creating or editing one opens the style creator, a page of its own
// (/playbook/:id/styles/*), because it needs the room: reference images, their
// weights and a test on three subjects. The system presets are NOT shown here:
// they belong to no Playbook, and the fiche lists only what is this brand's.

import { html, toString } from "../lib/html.js?v=1535";
import { navigate } from "../../../router.js?v=1535";
import { styleThumb } from "../ui/style-thumb.js?v=1535";
import { confirmDialog } from "../ui/dialog.js?v=1535";
import { toast } from "../ui/toast.js?v=1535";
import { canEditBrand, getBrand, getStyle, getStylesForBrand } from "../state/store.js?v=1535";
import { deleteStyle, duplicateStyle } from "../state/style-actions.js?v=1535";
import {
  addPlaybookReferences,
  deletePlaybookReference,
  getPlaybookReferences,
  togglePlaybookDefaultLook,
} from "../state/playbook-brand.js?v=1535";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;

/** "3 reference images" — what a style is made of, in words. */
function sourcesSummary(style) {
  const images = (style.custom?.sources || []).filter((s) => s.type === "image").length;
  return images ? `${images} reference image${images === 1 ? "" : "s"}` : "";
}

// The default look is ONE of the brand's styles or reference images: either
// card carries the same star, and the one that is default says so.
function defaultButton(kind, id, label, isDefault) {
  return html`<button
    type="button"
    class="ap-icon-button transparent grey${isDefault ? " is-default" : ""}"
    data-imst-pb-default="${kind}"
    data-imst-item="${id}"
    aria-pressed="${isDefault ? "true" : "false"}"
    aria-label="${isDefault ? `Stop using ${label} by default` : `Use ${label} by default`}"
    data-tooltip="${isDefault ? "Stop using by default" : "Use by default"}"
  >
    <i class="ap-icon-star" aria-hidden="true"></i>
  </button>`;
}

const defaultTag = html`<span class="ap-tag grey mini"><span>Default</span></span>`;

/** One card of either row: the picture, the name, what it is, its actions. */
function itemCard({ art, label, meta, isDefault, actions, openAttrs }) {
  return html`
    <article class="ap-card imst-style-card imst-pbstyle">
      ${openAttrs
        ? html`<button type="button" class="imst-style-card__open" ${openAttrs} aria-label="Edit ${label}">
            ${art}
          </button>`
        : html`<span class="imst-style-card__open">${art}</span>`}
      <div class="imst-style-card__body">
        <div class="imst-style-card__title">
          <span class="ap-body-bold">${label}</span>
          ${actions ? html`<span class="imst-pbstyle__actions">${actions}</span>` : ""}
        </div>
        <span class="ap-caption imst-style-card__meta">${isDefault ? defaultTag : ""}${meta}</span>
      </div>
    </article>
  `;
}

const deleteButton = (attrs, label) =>
  html`<button
    type="button"
    class="ap-icon-button transparent grey"
    ${attrs}
    aria-label="Delete ${label}"
    data-tooltip="Delete"
  >
    <i class="ap-icon-trash" aria-hidden="true"></i>
  </button>`;

function styleCard(style, brand, canEdit) {
  const isDefault = brand.defaults?.styleId === style.id;
  const id = html`data-imst-style="${style.id}"`;
  return itemCard({
    art: styleThumb(style, brand),
    label: style.label,
    meta: sourcesSummary(style),
    isDefault,
    openAttrs: canEdit ? html`data-imst-pb-style="edit" ${id}` : null,
    actions: canEdit
      ? html`${defaultButton("style", style.id, style.label, isDefault)}
          <button
            type="button"
            class="ap-icon-button transparent grey"
            data-imst-pb-style="duplicate"
            ${id}
            aria-label="Duplicate ${style.label}"
            data-tooltip="Duplicate"
          >
            <i class="ap-icon-copy" aria-hidden="true"></i>
          </button>
          ${deleteButton(html`data-imst-pb-style="delete" ${id}`, style.label)}`
      : null,
  });
}

function referenceCard(ref, brand, canEdit) {
  const label = ref.label || "Reference image";
  const isDefault = !!brand.defaults?.referenceUrl && brand.defaults.referenceUrl === ref.url;
  return itemCard({
    art: html`<img class="imst-thumb" src="${ref.url}" alt="" draggable="false" loading="lazy" />`,
    label,
    meta: "Reference image",
    isDefault,
    openAttrs: null,
    actions: canEdit
      ? html`${defaultButton("reference", ref.id, label, isDefault)}
        ${deleteButton(html`data-imst-pb-ref="delete" data-imst-item="${ref.id}"`, label)}`
      : null,
  });
}

/** The first tile of a row: an empty-state card that is the button. */
function newTile(attrs, title, caption) {
  return html`<button type="button" class="imst-pbstyles__new" ${attrs}>
    <span class="imst-pbstyles__new-art" aria-hidden="true"><i class="ap-icon-plus"></i></span>
    <span class="imst-pbstyles__new-text">
      <span class="ap-body-bold">${title}</span>
      <span class="ap-caption">${caption}</span>
    </span>
  </button>`;
}

/** The Brand section's "Image styles" row: the Playbook's own styles and New style. */
export function renderPlaybookStyles(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const own = getStylesForBrand(playbookId).filter((s) => s.kind === "custom");
  // "New style" is the FIRST tile of the grid, an empty-state card that is the
  // button — always in reach at the left, however many styles follow.
  const tile = editable
    ? newTile(
        html`data-imst-pb-style="new"`,
        "New style",
        own.length ? "From a few reference images" : "Give a few reference images whose look you want",
      )
    : "";
  if (!own.length && !editable)
    return toString(html`<p class="ap-body imst-pbstyles__empty">No style of this brand's own yet.</p>`);
  return toString(html`
    <div class="imst-pbstyles">
      <div class="imst-pbstyles__grid">${tile}${own.map((s) => styleCard(s, brand, editable))}</div>
    </div>
  `);
}

/** The Brand section's "Reference images" row: built and handled like the styles row. */
export function renderPlaybookReferences(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const refs = getPlaybookReferences(playbookId);
  const tile = editable
    ? newTile(html`data-imst-pb-ref="add"`, "Add reference image", "A picture whose look new images take after")
    : "";
  if (!refs.length && !editable)
    return toString(html`<p class="ap-body imst-pbstyles__empty">No reference image yet.</p>`);
  return toString(html`
    <div class="imst-pbstyles">
      <div class="imst-pbstyles__grid">${tile}${refs.map((r) => referenceCard(r, brand, editable))}</div>
    </div>
  `);
}

const readAsDataUrl = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ label: file.name.replace(/\.[a-z0-9]+$/i, ""), url: reader.result });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

function pickReferences(playbookId, onChange) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.addEventListener("change", async () => {
    const files = [...(input.files || [])].filter((f) => f.type.startsWith("image/"));
    const images = (await Promise.all(files.map(readAsDataUrl))).filter(Boolean);
    if (addPlaybookReferences(playbookId, images)) {
      toast(images.length === 1 ? "Reference image added." : `${images.length} reference images added.`);
      onChange();
    }
  });
  input.click();
}

/** The fiche's delegated click, for both rows. Returns true when it handled the click. */
export function handlePlaybookStylesClick(event, playbookId, { onChange = () => {} } = {}) {
  if (!playbookId) return false;
  const star = event.target.closest("[data-imst-pb-default]");
  const ref = event.target.closest("[data-imst-pb-ref]");
  if (star || ref) {
    if (!canEditBrand(playbookId)) return true;
    if (star) {
      togglePlaybookDefaultLook(playbookId, star.dataset.imstPbDefault, star.dataset.imstItem);
      onChange();
    } else if (ref.dataset.imstPbRef === "add") pickReferences(playbookId, onChange);
    else if (ref.dataset.imstPbRef === "delete") {
      deletePlaybookReference(playbookId, ref.dataset.imstItem);
      toast("Reference image deleted.");
      onChange();
    }
    return true;
  }
  const el = event.target.closest("[data-imst-pb-style]");
  if (!el) return false;
  const action = el.dataset.imstPbStyle;
  const styleId = el.dataset.imstStyle;
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
