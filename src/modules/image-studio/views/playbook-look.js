// Image Generator — the brand's LOOK, as the Playbook's Brand tab shows it
// (flags sexySquirrel + playbook2): what "Generate image" on a draft starts
// from, without asking. ONE look — one of the brand's image styles OR one of
// its reference images (`defaultLook`).
//
// The fiche shows only the chosen look, small, with "Change look". The two
// libraries live in the "Choose the look" dialog, one tab each and NOT built
// alike: a style is a recipe (a list row — its picture, its name, what it is
// made of, its actions), a reference image is just a picture (a grid of
// pictures). One radio group runs across both tabs, so only one thing is ever
// picked; "Use this look" saves it. Managing the libraries (new, duplicate,
// delete a style; add, delete an image) happens in the same dialog, live.

import { html, toString } from "../lib/html.js?v=1541";
import { navigate } from "../../../router.js?v=1541";
import { styleThumb } from "../ui/style-thumb.js?v=1541";
import { confirmDialog, openDialog } from "../ui/dialog.js?v=1541";
import { toast } from "../ui/toast.js?v=1541";
import { canEditBrand, getBrand, getStyle, getStylesForBrand } from "../state/store.js?v=1541";
import { deleteStyle, duplicateStyle } from "../state/style-actions.js?v=1541";
import {
  addPlaybookReferences,
  deletePlaybookReference,
  getPlaybookDefaultLook,
  getPlaybookReferences,
  setPlaybookDefaultLook,
} from "../state/playbook-brand.js?v=1541";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;

const ownStyles = (playbookId) => getStylesForBrand(playbookId).filter((s) => s.kind === "custom");

function styleRecipe(style) {
  const n = (style.custom?.sources || []).filter((s) => s.type === "image").length;
  return n ? `From ${n} reference image${n === 1 ? "" : "s"}` : "No reference image yet";
}

/** The chosen look, resolved — `null` when none, or when its item was deleted. */
function currentLook(playbookId, brand) {
  const look = getPlaybookDefaultLook(playbookId);
  if (look.kind === "style") {
    const style = ownStyles(playbookId).find((s) => s.id === look.id);
    if (style)
      return {
        art: styleThumb(style, brand),
        label: style.label,
        kind: `Image style, ${styleRecipe(style).toLowerCase()}`,
      };
  }
  if (look.kind === "reference") {
    const ref = getPlaybookReferences(playbookId).find((r) => r.id === look.id);
    if (ref)
      return {
        art: html`<img class="imst-thumb" src="${ref.url}" alt="" draggable="false" />`,
        label: ref.label || "Reference image",
        kind: "Reference image",
      };
  }
  return null;
}

/** The fiche's "Look" row: the chosen look, and the button that changes it. */
export function renderPlaybookLook(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const look = currentLook(playbookId, brand);
  if (!look)
    return toString(html`
      <div class="imst-look imst-look--empty">
        <p class="ap-body">No look yet, so I ask which style each time.</p>
        ${editable
          ? html`<button type="button" class="ap-button secondary blue" data-imst-look="open">
              <i class="ap-icon-plus" aria-hidden="true"></i><span>Choose a look</span>
            </button>`
          : ""}
      </div>
    `);
  return toString(html`
    <div class="imst-look">
      <span class="imst-look__art">${look.art}</span>
      <span class="imst-look__text">
        <span class="ap-body-bold">${look.label}</span>
        <span class="ap-caption">${look.kind}</span>
      </span>
      ${editable
        ? html`<button type="button" class="ap-button stroked grey" data-imst-look="open">
            <span>Change look</span>
          </button>`
        : ""}
    </div>
  `);
}

// ── The dialog ───────────────────────────────────────────────────────────────

function styleRow(style, brand, picked) {
  const id = style.id;
  return html`<li class="imst-lookpick__row">
    <label class="ap-radio-container imst-lookpick__pick">
      <input type="radio" name="imst-look" value="style:${id}" ${picked ? "checked" : ""} data-imst-look-pick />
      <span class="imst-lookpick__thumb">${styleThumb(style, brand)}</span>
      <span class="imst-lookpick__text">
        <span class="ap-body-bold">${style.label}</span>
        <span class="ap-caption">${styleRecipe(style)}</span>
      </span>
    </label>
    <span class="imst-lookpick__actions">
      <button
        type="button"
        class="ap-icon-button transparent grey"
        data-imst-look="edit-style"
        data-imst-item="${id}"
        aria-label="Edit ${style.label}"
        data-tooltip="Edit"
      >
        <i class="ap-icon-pen" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="ap-icon-button transparent grey"
        data-imst-look="duplicate-style"
        data-imst-item="${id}"
        aria-label="Duplicate ${style.label}"
        data-tooltip="Duplicate"
      >
        <i class="ap-icon-copy" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="ap-icon-button transparent grey"
        data-imst-look="delete-style"
        data-imst-item="${id}"
        aria-label="Delete ${style.label}"
        data-tooltip="Delete"
      >
        <i class="ap-icon-trash" aria-hidden="true"></i>
      </button>
    </span>
  </li>`;
}

function referenceTile(ref, picked) {
  const label = ref.label || "Reference image";
  return html`<li class="imst-lookpick__tile">
    <label class="imst-lookpick__image">
      <input type="radio" name="imst-look" value="reference:${ref.id}" ${picked ? "checked" : ""} data-imst-look-pick />
      <img src="${ref.url}" alt="${label}" draggable="false" loading="lazy" />
      <span class="imst-lookpick__check" aria-hidden="true"><i class="ap-icon-check"></i></span>
    </label>
    <button
      type="button"
      class="ap-close-button imst-lookpick__remove"
      data-imst-look="delete-reference"
      data-imst-item="${ref.id}"
      aria-label="Delete ${label}"
    >
      <i class="ap-icon-close" aria-hidden="true"></i>
    </button>
  </li>`;
}

function pickerBody(playbookId, state) {
  const brand = getBrand(playbookId);
  const styles = ownStyles(playbookId);
  const refs = getPlaybookReferences(playbookId);
  const isPicked = (kind, id) => state.pick.kind === kind && state.pick.id === id;
  const tab = (key, label, count) =>
    html`<button
      type="button"
      class="ap-tabs-tab${state.tab === key ? " active" : ""}"
      role="tab"
      aria-selected="${state.tab === key ? "true" : "false"}"
      data-imst-look-tab="${key}"
    >
      ${label} <span class="ap-counter grey">${count}</span>
    </button>`;
  const stylesPanel = html`
    <p class="ap-body imst-lookpick__intro">
      A style is a look I learnt from a few images. New images are drawn in it.
    </p>
    ${styles.length
      ? html`<ul class="imst-lookpick__list" role="radiogroup" aria-label="Image styles">
          ${styles.map((s) => styleRow(s, brand, isPicked("style", s.id)))}
        </ul>`
      : html`<p class="ap-body imst-lookpick__empty">No style yet.</p>`}
    <button type="button" class="ap-button stroked grey imst-lookpick__add" data-imst-look="new-style">
      <i class="ap-icon-plus" aria-hidden="true"></i><span>New style</span>
    </button>
  `;
  const refsPanel = html`
    <p class="ap-body imst-lookpick__intro">One picture whose look new images take after.</p>
    <ul class="imst-lookpick__grid" role="radiogroup" aria-label="Reference images">
      <li>
        <button type="button" class="imst-lookpick__upload" data-imst-look="add-reference">
          <i class="ap-icon-plus" aria-hidden="true"></i><span class="ap-caption">Add images</span>
        </button>
      </li>
      ${refs.map((r) => referenceTile(r, isPicked("reference", r.id)))}
    </ul>
  `;
  return html`
    <div class="ap-tabs imst-lookpick">
      <div class="ap-tabs-nav" role="tablist" aria-label="Kind of look">
        ${tab("style", "Image styles", styles.length)} ${tab("reference", "Reference images", refs.length)}
      </div>
      <div class="ap-tabs-panel active" role="tabpanel">${state.tab === "style" ? stylesPanel : refsPanel}</div>
    </div>
  `;
}

function pickerFooter(state) {
  return html`<div class="ap-dialog-footer-right">
    <button type="button" class="ap-button ghost grey" data-imst-look="cancel">Cancel</button>
    <button type="button" class="ap-button primary blue" data-imst-look="use" ${state.pick.kind ? "" : "disabled"}>
      Use this look
    </button>
  </div>`;
}

const readAsDataUrl = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ label: file.name.replace(/\.[a-z0-9]+$/i, ""), url: reader.result });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

function openLookPicker(playbookId, onChange) {
  const saved = getPlaybookDefaultLook(playbookId);
  const state = { tab: saved.kind === "reference" ? "reference" : "style", pick: { ...saved } };
  let dialog = null;
  const paint = () => {
    dialog.setBody(pickerBody(playbookId, state));
    dialog.setFooter(pickerFooter(state));
  };
  // A route change (the style creator) leaves the fiche: close first.
  const go = (path) => {
    dialog.close();
    navigate(path);
  };

  function addReferences() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.addEventListener("change", async () => {
      const files = [...(input.files || [])].filter((f) => f.type.startsWith("image/"));
      const images = (await Promise.all(files.map(readAsDataUrl))).filter(Boolean);
      if (!addPlaybookReferences(playbookId, images)) return;
      // A single new image is most likely the one being picked.
      if (images.length === 1) {
        const refs = getPlaybookReferences(playbookId);
        state.pick = { kind: "reference", id: refs[refs.length - 1].id };
      }
      paint();
      onChange();
    });
    input.click();
  }

  dialog = openDialog({
    title: "Choose the look",
    subtitle: "Generate image starts every new image from it.",
    size: "md",
    body: pickerBody(playbookId, state),
    footer: pickerFooter(state),
    onMount(el) {
      const onChangeEvt = (event) => {
        const input = event.target.closest("[data-imst-look-pick]");
        if (!input) return;
        const [kind, ...rest] = input.value.split(":");
        state.pick = { kind, id: rest.join(":") };
        dialog.setFooter(pickerFooter(state));
      };
      const onClick = (event) => {
        const tab = event.target.closest("[data-imst-look-tab]");
        if (tab) {
          state.tab = tab.dataset.imstLookTab;
          paint();
          return;
        }
        const el2 = event.target.closest("[data-imst-look]");
        if (!el2) return;
        const id = el2.dataset.imstItem;
        const action = el2.dataset.imstLook;
        if (action === "cancel") dialog.close();
        else if (action === "use") {
          if (!setPlaybookDefaultLook(playbookId, state.pick)) return;
          dialog.close();
          const look = currentLook(playbookId, getBrand(playbookId));
          toast(`Generate image now starts from ${look?.label || "this look"}.`);
          onChange();
        } else if (action === "new-style") go(creatorPath(playbookId, "new"));
        else if (action === "edit-style") go(creatorPath(playbookId, encodeURIComponent(id)));
        else if (action === "duplicate-style") {
          const copy = duplicateStyle(playbookId, id);
          if (copy) toast(`Duplicated as ${copy.label}.`);
          paint();
          onChange();
        } else if (action === "delete-style") {
          const style = getStyle(id);
          confirmDialog({
            title: `Delete ${style?.label || "this style"}?`,
            body: "Images already made with it stay as they are. This can't be undone.",
            confirmLabel: "Delete style",
          }).then((ok) => {
            if (!ok) return;
            deleteStyle(playbookId, id);
            if (state.pick.id === id) state.pick = { kind: "", id: "" };
            paint();
            onChange();
          });
        } else if (action === "add-reference") addReferences();
        else if (action === "delete-reference") {
          deletePlaybookReference(playbookId, id);
          if (state.pick.id === id) state.pick = { kind: "", id: "" };
          paint();
          onChange();
        }
      };
      el.addEventListener("change", onChangeEvt);
      el.addEventListener("click", onClick);
      return () => {
        el.removeEventListener("change", onChangeEvt);
        el.removeEventListener("click", onClick);
      };
    },
  });
}

/** The fiche's delegated click, for the Look row. Returns true when it handled the click. */
export function handlePlaybookLookClick(event, playbookId, { onChange = () => {} } = {}) {
  const el = event.target.closest('[data-imst-look="open"]');
  if (!el || !playbookId) return false;
  if (canEditBrand(playbookId)) openLookPicker(playbookId, onChange);
  return true;
}
