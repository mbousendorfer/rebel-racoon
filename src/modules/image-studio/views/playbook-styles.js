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

import { html, toString } from "../lib/html.js?v=1423";
import { navigate } from "../../../router.js?v=1423";
import { styleThumb } from "../ui/style-thumb.js?v=1423";
import { confirmDialog } from "../ui/dialog.js?v=1423";
import { toast } from "../ui/toast.js?v=1423";
import { canEditBrand, getBrand, getStyle, getStylesForBrand } from "../state/store.js?v=1423";
import { deleteStyle, duplicateStyle } from "../state/style-actions.js?v=1423";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;

/** "3 reference images · Style & composition" — what a style is made of, in words. */
function sourcesSummary(style) {
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

/** The Brand section's "Image styles" row: the Playbook's own styles and New style. */
export function renderPlaybookStyles(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const own = getStylesForBrand(playbookId).filter((s) => s.kind === "custom");
  // "New style" is the FIRST tile of the grid, an empty-state card that is the
  // button — always in reach at the left, however many styles follow.
  const newTile = editable
    ? html`<button type="button" class="imst-pbstyles__new" data-imst-pb-style="new">
        <span class="imst-pbstyles__new-art" aria-hidden="true"><i class="ap-icon-plus"></i></span>
        <span class="imst-pbstyles__new-text">
          <span class="ap-body-bold">New style</span>
          <span class="ap-caption"
            >${own.length ? "From a few reference images" : "Give a few reference images whose look you want"}</span
          >
        </span>
      </button>`
    : "";
  if (!own.length && !editable)
    return toString(html`<p class="ap-body imst-pbstyles__empty">No style of this brand's own yet.</p>`);
  return toString(html`
    <div class="imst-pbstyles">
      <div class="imst-pbstyles__grid">${newTile}${own.map((s) => styleCard(s, brand, editable))}</div>
    </div>
  `);
}

/** The fiche's delegated click, for the row above. Returns true when it handled the click. */
export function handlePlaybookStylesClick(event, playbookId, { onChange = () => {} } = {}) {
  const el = event.target.closest("[data-imst-pb-style]");
  if (!el || !playbookId) return false;
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
