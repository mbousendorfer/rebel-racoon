// Image Generator — the Playbook's Images tab (flags sexySquirrel + playbook2).
// Branding says what the brand looks like; this tab is how its IMAGES are made,
// in three parts the fiche lays out as blocks, top to bottom:
//
//   1. Image styles — the lead act: a style is a look learnt from a few images,
//      made in the creator (/playbook/:id/styles/*). "Create a style" is the
//      tab's one primary action; the styles are the big cards.
//   2. Reference images — pictures whose look an image can take after. Just
//      pictures, so a plain picture grid — not the styles' cards.
//   3. Generate an image — the style OR reference image a draft's Generate
//      image uses without asking: one select, grouped by kind.
//   4. Preferred formats — a shape per network, apart: it holds whatever the look.
//
// Everything here saves as it changes, like the styles always did: no Edit.

import { html, raw, toString } from "../lib/html.js?v=1553";
import { navigate } from "../../../router.js?v=1553";
import { styleThumbUrl } from "../ui/style-thumb.js?v=1553";
import { toast } from "../ui/toast.js?v=1553";
import { canEditBrand, getBrand, getStylesForBrand } from "../state/store.js?v=1553";
import { shapesFor } from "../config/formats.js?v=1553";
import {
  addPlaybookReferences,
  deletePlaybookReference,
  getPlaybookDefaultLook,
  getPlaybookFormats,
  getPlaybookReferences,
  setPlaybookDefaultLook,
  setPlaybookFormat,
} from "../state/playbook-brand.js?v=1553";
import { handlePlaybookStylesClick, renderPlaybookStyles } from "./playbook-styles.js?v=1553";

const creatorPath = (playbookId, rest) => `/playbook/${encodeURIComponent(playbookId)}/styles/${rest}`;
const ownStyles = (playbookId) => getStylesForBrand(playbookId).filter((s) => s.kind === "custom");

const NETWORKS = [
  { id: "linkedin", label: "LinkedIn", icon: "ap-icon-linkedin-official" },
  { id: "instagram", label: "Instagram", icon: "ap-icon-instagram-official" },
  { id: "facebook", label: "Facebook", icon: "ap-icon-facebook-official" },
  { id: "x", label: "X", icon: "ap-icon-x-official" },
];

// Every block reads the same way: on the left, what it is and its one action;
// on the right, the things themselves. Styles and reference images keep their
// own shapes there (cards vs plain pictures) — they are different things.
const section = ({ aside, body }) =>
  html`<div class="imst-images-section">
    <div class="imst-images-section__aside">${aside}</div>
    <div class="imst-images-section__body">${body}</div>
  </div>`;

const usedTag = html`<span class="ap-tag grey mini imst-images__used"><span>Used by Generate image</span></span>`;

// ── 1. Image styles ─────────────────────────────────────────────────────────

export function renderImagesStyles(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const count = ownStyles(playbookId).length;
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
          A look I learn from a few of your images — light, colours, framing — and draw every new image in.
        </p>
        ${editable
          ? html`<button type="button" class="ap-button primary blue" data-imst-images="new-style">
              <i class="ap-icon-plus" aria-hidden="true"></i><span>Create a style</span>
            </button>`
          : ""}`,
      body: count
        ? raw(renderPlaybookStyles(playbookId, { canEdit, newTile: false }))
        : html`<p class="ap-body imst-images__empty">
            No style yet. Create one from a few images whose look you want.
          </p>`,
    }),
  );
}

// ── 2. Reference images ─────────────────────────────────────────────────────

export function renderImagesReferences(playbookId, { canEdit = true } = {}) {
  const brand = getBrand(playbookId);
  if (!brand) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const refs = getPlaybookReferences(playbookId);
  const used = brand.defaults?.referenceUrl;
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
          Pictures whose look you like, as they are. A new image can take after one of them.
        </p>
        ${editable
          ? html`<button type="button" class="ap-button stroked grey" data-imst-images="add-reference">
              <i class="ap-icon-plus" aria-hidden="true"></i><span>Add images</span>
            </button>`
          : ""}`,
      body: refs.length
        ? html`<ul class="imst-images-refs">
            ${refs.map(
              (r) =>
                html`<li class="imst-images-refs__item">
                  <img src="${r.url}" alt="${r.label || "Reference image"}" loading="lazy" draggable="false" />
                  ${r.url === used ? usedTag : ""}
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
          </ul>`
        : html`<p class="ap-body imst-images__empty">No reference image yet.</p>`,
    }),
  );
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
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
        When you click <strong>Generate an image</strong> on a draft, I make it in this style or after this image,
        without asking.
      </p>`,
      body:
        styles.length + refs.length
          ? select({
              name: "look",
              value: look.kind ? `${look.kind}:${look.id}` : "",
              groups: [
                { label: "Image styles", options: styles },
                { label: "Reference images", options: refs },
              ],
              placeholder: "None — I ask which style",
              ariaLabel: "Preferred style or image",
              disabled: !editable,
            })
          : html`<p class="ap-body imst-images__empty">Create a style or add a reference image first.</p>`,
    }),
  );
}

// ── 4. Preferred formats ────────────────────────────────────────────────────

// A frame's longer side is the same for every shape, so the ratios compare
// true side by side (a Story is tall, a Link is wide, a Square is square).
function frameSize(shape) {
  const long = Math.max(shape.w, shape.h);
  const r = (v) => Math.round((v / long) * 1000) / 1000;
  return `width:calc(var(--imst-frame) * ${r(shape.w)});height:calc(var(--imst-frame) * ${r(shape.h)})`;
}

export function renderImagesFormats(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const formats = getPlaybookFormats(playbookId);
  // One row per network: its name, the shape drawn empty, the select.
  const rows = NETWORKS.map((n) => {
    const all = shapesFor(n.id);
    const chosen = all.find((s) => s.id === formats[n.id]);
    const shape = chosen || all[0];
    return html`<li class="imst-images-format">
      <span class="imst-images-format__net ap-body-bold"><i class="${n.icon}" aria-hidden="true"></i>${n.label}</span>
      <span class="imst-images-format__stage" aria-hidden="true">
        <span class="imst-images-format__shape" style="${frameSize(shape)}"></span>
      </span>
      ${select({
        name: `format:${n.id}`,
        value: chosen ? chosen.id : "",
        groups: [
          {
            label: "",
            options: [
              { value: "", label: `Automatic (${all[0].label} ${all[0].ratio})` },
              ...all.map((s) => ({ value: s.id, label: `${s.label} ${s.ratio}` })),
            ],
          },
        ],
        placeholder: "Automatic",
        ariaLabel: `Preferred format on ${n.label}`,
        disabled: !editable,
      })}
    </li>`;
  });
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
        The shape I make an image in for each network. Automatic is the shape that network uses most.
      </p>`,
      body: html`<ul class="imst-images-formats">
        ${rows}
      </ul>`,
    }),
  );
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
