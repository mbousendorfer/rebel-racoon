// Image Generator — the Playbook's Images tab (flags sexySquirrel + playbook2).
// Branding says what the brand looks like; this tab is how its IMAGES are made,
// in three parts the fiche lays out as blocks, top to bottom:
//
//   1. Image styles — the lead act: a style is a look learnt from a few images,
//      made in the creator (/playbook/:id/styles/*). "Create a style" is the
//      tab's one primary action; the styles are the big cards.
//   2. Reference images — pictures whose look an image can take after. Just
//      pictures, so a plain picture grid — not the styles' cards.
//   3. Generate image — what a draft's Generate image uses without asking: ONE
//      look (a style OR a reference image: one select, grouped by kind) and a
//      shape per network.
//
// Everything here saves as it changes, like the styles always did: no Edit.

import { html, raw, toString } from "../lib/html.js?v=1544";
import { navigate } from "../../../router.js?v=1544";
import { styleThumbUrl } from "../ui/style-thumb.js?v=1544";
import { toast } from "../ui/toast.js?v=1544";
import { canEditBrand, getBrand, getStylesForBrand } from "../state/store.js?v=1544";
import { shapesFor } from "../config/formats.js?v=1544";
import {
  addPlaybookReferences,
  deletePlaybookReference,
  getPlaybookDefaultLook,
  getPlaybookFormats,
  getPlaybookReferences,
  setPlaybookDefaultLook,
  setPlaybookFormat,
} from "../state/playbook-brand.js?v=1544";
import { handlePlaybookStylesClick, renderPlaybookStyles } from "./playbook-styles.js?v=1544";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;
const ownStyles = (playbookId) => getStylesForBrand(playbookId).filter((s) => s.kind === "custom");

const NETWORKS = [
  { id: "linkedin", label: "LinkedIn", icon: "ap-icon-linkedin-official" },
  { id: "instagram", label: "Instagram", icon: "ap-icon-instagram-official" },
  { id: "facebook", label: "Facebook", icon: "ap-icon-facebook-official" },
  { id: "x", label: "X", icon: "ap-icon-x-official" },
];

// ── 1. Image styles ─────────────────────────────────────────────────────────

export function renderImagesStyles(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const count = ownStyles(playbookId).length;
  return toString(html`
    <div class="imst-images-styles">
      <div class="imst-images-styles__head">
        <p class="ap-body imst-images__lead">
          A style is a look I learn from a few of your images — the light, the colours, the framing. Every image I make
          for this brand can be drawn in it.
        </p>
        ${editable
          ? html`<button type="button" class="ap-button primary orange" data-imst-images="new-style">
              <i class="ap-icon-sparkles" aria-hidden="true"></i><span>Create a style</span>
            </button>`
          : ""}
      </div>
      ${count
        ? html`${raw(renderPlaybookStyles(playbookId, { canEdit, newTile: false }))}`
        : html`<p class="ap-body imst-pbstyles__empty">No style yet. Give me a few images whose look you want.</p>`}
    </div>
  `);
}

// ── 2. Reference images ─────────────────────────────────────────────────────

export function renderImagesReferences(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const refs = getPlaybookReferences(playbookId);
  return toString(html`
    <p class="ap-body imst-images__lead">Pictures whose look you like. A new image can take after one of them.</p>
    <ul class="imst-images-refs">
      ${editable
        ? html`<li>
            <button type="button" class="imst-images-refs__add" data-imst-images="add-reference">
              <i class="ap-icon-plus" aria-hidden="true"></i><span class="ap-caption">Add images</span>
            </button>
          </li>`
        : ""}
      ${refs.map(
        (r) =>
          html`<li class="imst-images-refs__item">
            <img src="${r.url}" alt="${r.label || "Reference image"}" loading="lazy" draggable="false" />
            ${editable
              ? html`<button
                  type="button"
                  class="ap-close-button imst-images-refs__remove"
                  data-imst-images="delete-reference"
                  data-imst-item="${r.id}"
                  aria-label="Delete ${r.label || "this reference image"}"
                >
                  <i class="ap-icon-close" aria-hidden="true"></i>
                </button>`
              : ""}
          </li>`,
      )}
    </ul>
  `);
}

// ── 3. Generate image ───────────────────────────────────────────────────────

// A DS single-select (.ap-select on <details>), live: an option writes on click.
function select({ name, value, groups, placeholder, ariaLabel, disabled }) {
  const all = groups.flatMap((g) => g.options);
  const current = all.find((o) => o.value === value);
  const option = (o) =>
    html`<div
      class="ap-select-option${o.value === value ? " selected" : ""}"
      role="option"
      tabindex="0"
      aria-selected="${o.value === value ? "true" : "false"}"
      data-imst-images-pick="${name}"
      data-imst-value="${o.value}"
    >
      ${o.avatar ? html`<img class="ap-select-option-avatar imst-images__avatar" src="${o.avatar}" alt="" />` : ""}
      <span class="ap-select-option-text"><span class="ap-select-option-title">${o.label}</span></span>
      ${o.value === value ? html`<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
    </div>`;
  return html`<details class="ap-select imst-images__select" data-imst-images-select ${disabled ? "inert" : ""}>
    <summary class="ap-select-trigger" aria-label="${ariaLabel}">
      ${current?.avatar
        ? html`<img class="ap-select-avatar imst-images__avatar" src="${current.avatar}" alt="" />`
        : ""}
      <span class="ap-select-value${current ? "" : " ap-select-placeholder"}">${current?.label || placeholder}</span>
      <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
    </summary>
    <div class="ap-select-dropdown" role="listbox">
      <div class="ap-select-options">
        ${groups
          .filter((g) => g.options.length)
          .map(
            (g) =>
              html`${g.label
                ? html`<div class="ap-select-group"><span class="ap-select-group-label">${g.label}</span></div>`
                : ""}${g.options.map(option)}`,
          )}
      </div>
    </div>
  </details>`;
}

export function renderImagesGenerate(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const look = getPlaybookDefaultLook(playbookId);
  const styles = ownStyles(playbookId).map((s) => ({
    value: `style:${s.id}`,
    label: s.label,
    avatar: styleThumbUrl(s, brand),
  }));
  const refs = getPlaybookReferences(playbookId).map((r) => ({
    value: `reference:${r.id}`,
    label: r.label || "Reference image",
    avatar: r.url,
  }));
  const formats = getPlaybookFormats(playbookId);
  const hasLooks = styles.length + refs.length > 0;
  return toString(html`
    <p class="ap-body imst-images__lead">
      When you click <strong>Generate image</strong> on a draft, I use these right away — no questions about style or
      shape.
    </p>
    <dl class="imst-images-settings">
      <div class="imst-images-settings__row">
        <dt class="ap-body-bold">Look</dt>
        <dd>
          ${hasLooks
            ? select({
                name: "look",
                value: look.kind ? `${look.kind}:${look.id}` : "",
                groups: [
                  { label: "Image styles", options: styles },
                  { label: "Reference images", options: refs },
                ],
                placeholder: "None — I ask which style",
                ariaLabel: "Look for Generate image",
                disabled: !editable,
              })
            : html`<span class="ap-body">Create a style or add a reference image first.</span>`}
        </dd>
      </div>
      ${NETWORKS.map((n) => {
        const shapes = shapesFor(n.id).map((s) => ({ value: s.id, label: `${s.label} ${s.ratio}` }));
        return html`<div class="imst-images-settings__row">
          <dt class="ap-body-bold">
            <i class="${n.icon}" aria-hidden="true"></i>
            ${n.label} format
          </dt>
          <dd>
            ${select({
              name: `format:${n.id}`,
              value: shapes.some((s) => s.value === formats[n.id]) ? formats[n.id] : "",
              groups: [{ label: "", options: [{ value: "", label: "Automatic" }, ...shapes] }],
              placeholder: "Automatic",
              ariaLabel: `Format on ${n.label}`,
              disabled: !editable,
            })}
          </dd>
        </div>`;
      })}
    </dl>
  `);
}

// ── Events ──────────────────────────────────────────────────────────────────

const readAsDataUrl = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ label: file.name.replace(/\.[a-z0-9]+$/i, ""), url: reader.result });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

function addReferences(playbookId, onChange) {
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

/** The fiche's delegated click, for the whole tab. Returns true when it handled the click. */
export function handlePlaybookImagesClick(event, playbookId, { onChange = () => {} } = {}) {
  if (!playbookId) return false;
  // One select open at a time; a click elsewhere closes them.
  const inSelect = event.target.closest("[data-imst-images-select]");
  for (const d of document.querySelectorAll("details[data-imst-images-select][open]"))
    if (d !== inSelect) d.open = false;

  const pick = event.target.closest("[data-imst-images-pick]");
  if (pick) {
    const name = pick.dataset.imstImagesPick;
    const value = pick.dataset.imstValue;
    if (name === "look") {
      const [kind, ...rest] = value.split(":");
      setPlaybookDefaultLook(playbookId, { kind, id: rest.join(":") });
      toast(`Generate image now starts from ${pick.textContent.trim()}.`);
    } else setPlaybookFormat(playbookId, name.split(":")[1], value);
    onChange();
    return true;
  }
  const el = event.target.closest("[data-imst-images]");
  if (el) {
    if (!canEditBrand(playbookId)) return true;
    const action = el.dataset.imstImages;
    if (action === "new-style") navigate(creatorPath(playbookId, "new"));
    else if (action === "add-reference") addReferences(playbookId, onChange);
    else if (action === "delete-reference") {
      deletePlaybookReference(playbookId, el.dataset.imstItem);
      toast("Reference image deleted.");
      onChange();
    }
    return true;
  }
  return handlePlaybookStylesClick(event, playbookId, { onChange });
}
