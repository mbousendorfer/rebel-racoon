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

import { html, raw, toString } from "../lib/html.js?v=1567";
import { navigate } from "../../../router.js?v=1567";
import { styleThumbUrl } from "../ui/style-thumb.js?v=1567";
import { toast } from "../ui/toast.js?v=1567";
import { renderEmpty } from "../ui/empty.js?v=1567";
import { canEditBrand, getBrand, getStylesForBrand } from "../state/store.js?v=1567";
import { shapesFor } from "../config/formats.js?v=1567";
import {
  addPlaybookReferences,
  deletePlaybookReference,
  getPlaybookDefaultLook,
  getPlaybookFormats,
  getPlaybookReferences,
  setPlaybookDefaultLook,
  setPlaybookFormat,
} from "../state/playbook-brand.js?v=1567";
import { handlePlaybookStylesClick, renderPlaybookStyles } from "./playbook-styles.js?v=1567";

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

// An empty block says what goes there and how to fill it, with its one action
// (the aside then drops its own copy of that button). Read-only, no action.
const emptyBlock = ({ icon, title, body, action }) =>
  html`<div class="imst-images-empty">${renderEmpty({ icon, title, body, action })}</div>`;

const usedTag = html`<span class="ap-tag grey mini imst-images__used"><span>Used by Generate image</span></span>`;

// ── 1. Image styles ─────────────────────────────────────────────────────────

const createStyleButton = html`<button type="button" class="ap-button primary blue" data-imst-images="new-style">
  <i class="ap-icon-plus" aria-hidden="true"></i><span>Create a style</span>
</button>`;

export function renderImagesStyles(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const count = ownStyles(playbookId).length;
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
          A look I learn from a few of your images — light, colours, framing — and draw every new image in.
        </p>
        ${editable && count ? createStyleButton : ""}`,
      body: count
        ? raw(renderPlaybookStyles(playbookId, { canEdit, newTile: false }))
        : emptyBlock({
            icon: "ap-icon-sparkles",
            title: "Draw every image in your brand's look",
            body: editable
              ? "Give me 2 to 6 images that share the look you want, and I learn it."
              : "Nobody has created a style for this brand yet.",
            action: editable ? createStyleButton : "",
          }),
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
        ${editable && refs.length
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
        : emptyBlock({
            icon: "ap-icon-image",
            title: "Keep the pictures whose look you like",
            body: editable
              ? "Add one, and a new image can take after it."
              : "Nobody has added a reference image for this brand yet.",
            action: editable
              ? html`<button type="button" class="ap-button primary blue" data-imst-images="add-reference">
                  <i class="ap-icon-plus" aria-hidden="true"></i><span>Add images</span>
                </button>`
              : "",
          }),
    }),
  );
}

// ── 3. Generate image ───────────────────────────────────────────────────────

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
  const value = look.kind ? `${look.kind}:${look.id}` : "";
  // Both kinds, each under its own name, as small pictures — ONE radio group
  // across the two, so exactly one is the default.
  const item = (o) =>
    html`<li>
      <button
        type="button"
        class="imst-images-pick__item"
        role="radio"
        aria-checked="${o.value === value ? "true" : "false"}"
        data-imst-images-look="${o.value}"
        ${editable ? "" : "disabled"}
      >
        <span class="imst-images-pick__art">
          <img src="${o.avatar}" alt="" draggable="false" loading="lazy" />
          <span class="imst-images-pick__check" aria-hidden="true"><i class="ap-icon-check"></i></span>
        </span>
        <span class="ap-caption imst-images-pick__name">${o.label}</span>
      </button>
    </li>`;
  const group = (title, hint, items) =>
    items.length
      ? html`<div class="imst-images-pick__group">
          <span class="imst-images-pick__title"
            ><span class="ap-body-bold">${title}</span> <span class="ap-caption">${hint}</span></span
          >
          <ul class="imst-images-pick__list">
            ${items.map(item)}
          </ul>
        </div>`
      : "";
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
          When you click <strong>Generate an image</strong> on a draft, I start from the one you pick here, without
          asking.
        </p>
        ${styles.length + refs.length
          ? html`<p class="ap-body-bold imst-images__ask">
              ${value ? "Your default is checked." : "Pick one as the default."}
            </p>`
          : ""}`,
      body:
        styles.length + refs.length
          ? html`<div class="imst-images-pick" role="radiogroup" aria-label="Default style or reference image">
              ${group("Image styles", "I draw the image in the style.", styles)}
              ${group("Reference images", "I make the image take after it.", refs)}
            </div>`
          : emptyBlock({
              icon: "ap-icon-question",
              title: "Skip the style question on every draft",
              body: "Create an image style or add a reference image above, then pick it here.",
            }),
    }),
  );
}

// ── 4. Preferred formats ────────────────────────────────────────────────────

export function renderImagesFormats(playbookId, { canEdit = true } = {}) {
  if (!getBrand(playbookId)) return "";
  const editable = canEdit && canEditBrand(playbookId);
  const formats = getPlaybookFormats(playbookId);
  // One row per network: its name, then its shapes as the studio shows them
  // (.imst-seg, compact) — nothing set means the network's usual shape, first.
  const rows = NETWORKS.map((n) => {
    const all = shapesFor(n.id);
    const current = all.find((s) => s.id === formats[n.id]) || all[0];
    return html`<li class="imst-images-format">
      <span class="imst-images-format__net ap-body-bold"><i class="${n.icon}" aria-hidden="true"></i>${n.label}</span>
      <div class="imst-seg imst-seg--compact" role="radiogroup" aria-label="Preferred format on ${n.label}">
        ${all.map(
          (s) =>
            html`<button
              type="button"
              class="imst-seg__opt"
              role="radio"
              aria-checked="${s.id === current.id ? "true" : "false"}"
              aria-label="${s.label} ${s.ratio}"
              data-imst-images-format="${n.id}:${s.id}"
              ${editable ? "" : "disabled"}
            >
              <span class="imst-seg__box"
                ><span
                  class="imst-seg__frame"
                  style="aspect-ratio: ${s.w} / ${s.h}; ${s.w >= s.h ? "width: 100%" : "height: 100%"}"
                ></span
              ></span>
              <span class="imst-seg__name">${s.label}</span>
              <span class="ap-caption imst-seg__ratio">${s.ratio}</span>
            </button>`,
        )}
      </div>
    </li>`;
  });
  return toString(
    section({
      aside: html`<p class="ap-body imst-images__lead">
        The shape I make an image in for each network. Until you pick one, it's the shape that network uses most.
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
  const lookItem = event.target.closest("[data-imst-images-look]");
  if (lookItem) {
    const [kind, ...rest] = lookItem.dataset.imstImagesLook.split(":");
    if (setPlaybookDefaultLook(playbookId, { kind, id: rest.join(":") })) {
      toast(`${lookItem.textContent.trim()} is now the default for Generate an image.`);
      onChange();
    }
    return true;
  }
  const fmt = event.target.closest("[data-imst-images-format]");
  if (fmt) {
    const [network, shapeId] = fmt.dataset.imstImagesFormat.split(":");
    if (setPlaybookFormat(playbookId, network, shapeId)) onChange();
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
