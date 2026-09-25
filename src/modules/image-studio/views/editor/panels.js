// Image Generator — the editor's panels: layers (left), properties + text
// ideas (right), and the edit-in-words bar under the stage. Pure renderers.

import { html } from "../../lib/html.js?v=1304";
import { menu } from "../../ui/menu.js?v=1304";
import { picker } from "../../ui/picker.js?v=1304";
import { slider, toggle } from "../../ui/fields.js?v=1304";
import { swatch } from "../../ui/swatch.js?v=1304";
import { FONT_CHOICES } from "../../config/fonts.js?v=1304";
import { resolvePalette } from "../../render/palette.js?v=1304";

const ROLE_LABEL = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
};
const VARIANTS = [
  { value: "color", label: "Colour" },
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
  { value: "icon", label: "Icon only" },
];
const TYPE_ICON = {
  image: "ap-icon-image",
  text: "ap-icon-alt-text",
  logo: "ap-icon-star",
  shape: "ap-icon-view-grid",
  asset: "ap-icon-file--image",
};

export function layerName(l) {
  if (l.type === "image") return "Generated image";
  if (l.type === "text") return (l.props.content || "Text").slice(0, 28);
  if (l.type === "logo") return `Logo · ${VARIANTS.find((v) => v.value === l.props.variant)?.label || "Colour"}`;
  if (l.type === "shape") return "Shape";
  return l.props.name || "Image";
}

// ── Layers ───────────────────────────────────────────────────────────────────

export function renderLayers(layers, selectedId) {
  const sorted = [...layers].sort((a, b) => b.z - a.z);
  return html`
    <section class="ap-card imst-panel" aria-labelledby="imst-layers-title">
      <header class="imst-panel__head">
        <h2 class="ap-body-bold" id="imst-layers-title">Layers</h2>
        ${menu({
          label: "Add a layer",
          align: "end",
          trigger: {
            className: "ap-button ghost grey imst-panel__add",
            label: "Add a layer",
            content: html`<i class="ap-icon-plus" aria-hidden="true"></i><span>Add</span>`,
          },
          items: [
            { action: "add-text", icon: "ap-icon-alt-text", label: "Text" },
            { action: "add-logo", icon: "ap-icon-star", label: "Logo" },
            {
              action: "add-shape",
              icon: "ap-icon-view-grid",
              label: "Shape",
              description: "A backdrop for text or the logo",
            },
            {
              action: "add-asset",
              icon: "ap-icon-file--image",
              label: "From the library",
              description: "Products and reference images",
            },
          ],
        })}
      </header>
      <ul class="imst-layers" role="listbox" aria-label="Layers, top first">
        ${sorted.map(
          (l) => html`
            <li
              class="imst-layers__row${l.id === selectedId ? " is-selected" : ""}${l.hidden ? " is-hidden" : ""}"
              role="option"
              aria-selected="${l.id === selectedId}"
            >
              <button type="button" class="imst-layers__pick" data-imst-select="${l.id}">
                <i class="${TYPE_ICON[l.type] || "ap-icon-image"}" aria-hidden="true"></i>
                <span class="imst-layers__name">${layerName(l)}</span>
              </button>
              <button
                type="button"
                class="ap-icon-button transparent grey"
                data-imst-layer-toggle="hidden"
                data-id="${l.id}"
                aria-pressed="${!l.hidden}"
                aria-label="${l.hidden ? "Show" : "Hide"} ${layerName(l)}"
                data-tooltip="${l.hidden ? "Show" : "Hide"}"
              >
                <i class="${l.hidden ? "ap-icon-eye-off" : "ap-icon-eye-on"}" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                class="ap-icon-button transparent grey"
                data-imst-layer-toggle="locked"
                data-id="${l.id}"
                aria-pressed="${!!l.locked}"
                aria-label="${l.locked ? "Unlock" : "Lock"} ${layerName(l)}"
                data-tooltip="${l.locked ? "Unlock" : "Lock"}"
              >
                <i class="${l.locked ? "ap-icon-lock-on" : "ap-icon-lock-off"}" aria-hidden="true"></i>
              </button>
            </li>
          `,
        )}
      </ul>
    </section>
  `;
}

// ── Properties ───────────────────────────────────────────────────────────────

function colorRow({ brand, value, hex, target, unlocked, label }) {
  const p = resolvePalette(brand);
  const roles = Object.keys(ROLE_LABEL);
  return html`
    <div class="imst-prop">
      <span class="imst-prop__label ap-caption">${label}</span>
      <div class="imst-swatch-row" role="group" aria-label="${label}">
        ${roles.map(
          (r) =>
            html`<button
              type="button"
              class="imst-swatch-btn"
              aria-pressed="${!hex && value === r}"
              data-imst-color="${target}"
              data-role="${r}"
              aria-label="${ROLE_LABEL[r]} ${p[r]}"
            >
              ${swatch(p[r], { label: ROLE_LABEL[r], size: "md" })}
            </button>`,
        )}
      </div>
      ${unlocked
        ? html`<div class="ap-input-group imst-hex">
            <span
              class="imst-swatch imst-swatch--sm"
              style="--imst-swatch: ${hex || p[value] || p.text}"
              aria-hidden="true"
            ></span>
            <input
              type="text"
              class="ap-input"
              maxlength="7"
              value="${hex || ""}"
              placeholder="#RRGGBB"
              data-imst-hex="${target}"
              aria-label="Any colour, as a hex value"
            />
          </div>`
        : ""}
    </div>
  `;
}

function sizeRow(l, label, min, max, step, path) {
  const value = path === "size" ? l.props.size : l.w;
  return html`<div class="imst-prop">
    <span class="imst-prop__label ap-caption">${label}</span>
    ${slider({ path: `layer.${path}`, value, min, max, step, label })}
  </div>`;
}

function orderRow(l) {
  if (l.type === "image") return "";
  return html`<div class="imst-prop imst-prop--inline">
    <button type="button" class="ap-button ghost grey" data-imst-order="1" aria-label="Bring forward">
      <span>Bring forward</span>
    </button>
    <button type="button" class="ap-button ghost grey" data-imst-order="-1" aria-label="Send back">
      <span>Send back</span>
    </button>
    <button type="button" class="ap-button ghost grey" data-imst-action="delete-layer">
      <i class="ap-icon-trash" aria-hidden="true"></i><span>Delete</span>
    </button>
  </div>`;
}

export function renderProps({ layer: l, brand, format, unlock, canSave, logoPx }) {
  if (!l) {
    return html`<section class="ap-card imst-panel">
      <p class="ap-body imst-panel__hint">Select a layer on the image or in the list to change it.</p>
    </section>`;
  }
  let body = "";
  if (l.type === "text") {
    const heading = brand.fonts.find((f) => f.role === "heading")?.family || "Brand heading";
    const bodyFont = brand.fonts.find((f) => f.role === "body")?.family || "Brand body";
    const fontOptions = unlock.font
      ? [
          {
            label: "Brand",
            options: [
              { value: "role:heading", label: `${heading} (headings)` },
              { value: "role:body", label: `${bodyFont} (body)` },
            ],
          },
          { label: "Any font", options: FONT_CHOICES.map((f) => ({ value: `family:${f.family}`, label: f.family })) },
        ]
      : [
          {
            options: [
              { value: "role:heading", label: `${heading} (headings)` },
              { value: "role:body", label: `${bodyFont} (body)` },
            ],
          },
        ];
    const fontValue = l.props.family ? `family:${l.props.family}` : `role:${l.props.fontRole || "heading"}`;
    const offBrandFont = l.props.family && !brand.fonts.some((f) => f.family === l.props.family);
    const offBrandHex = l.props.hex && !brand.palette.some((c) => c.hex.toUpperCase() === l.props.hex.toUpperCase());
    body = html`
      <div class="imst-prop">
        <label class="imst-prop__label ap-caption" for="imst-text-content">Text</label>
        <div class="ap-textarea-field">
          <textarea id="imst-text-content" rows="2" data-imst-field="layer.content">${l.props.content}</textarea>
        </div>
      </div>
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Font</span>
        ${picker({ id: "font", label: "Font", value: fontValue, groups: fontOptions, wide: true })}
        ${toggle({ path: "unlock.font", checked: unlock.font, label: "Use any font" })}
        ${offBrandFont && canSave
          ? html`<button
              type="button"
              class="ap-link imst-save-link"
              data-imst-save="font"
              data-value="${l.props.family}"
            >
              Save ${l.props.family} as the Playbook's heading font
            </button>`
          : ""}
      </div>
      ${colorRow({
        brand,
        value: l.props.colorRole,
        hex: l.props.hex,
        target: "text",
        unlocked: unlock.color,
        label: "Colour",
      })}
      <div class="imst-prop">
        ${toggle({ path: "unlock.color", checked: unlock.color, label: "Use any colour" })}
        ${offBrandHex && canSave
          ? html`<button
              type="button"
              class="ap-link imst-save-link"
              data-imst-save="color"
              data-value="${l.props.hex}"
            >
              Save ${l.props.hex.toUpperCase()} to the Playbook's colours
            </button>`
          : ""}
      </div>
      ${sizeRow(l, "Size", 0.03, 0.16, 0.005, "size")}
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Alignment</span>
        <div class="imst-chips" role="group" aria-label="Alignment">
          ${["left", "center", "right"].map(
            (a) =>
              html`<button
                type="button"
                class="ap-filter-chip"
                aria-pressed="${(l.props.align || "left") === a}"
                data-imst-align="${a}"
              >
                ${a === "center" ? "Centre" : a[0].toUpperCase() + a.slice(1)}
              </button>`,
          )}
        </div>
      </div>
      <div class="imst-prop">
        ${toggle({ path: "layer.band", checked: !!l.props.band, label: "Band behind the text" })}
      </div>
      ${l.props.band
        ? colorRow({
            brand,
            value: l.props.bandRole || "background",
            hex: null,
            target: "band",
            unlocked: false,
            label: "Band colour",
          })
        : ""}
    `;
  } else if (l.type === "logo") {
    const min = brand.rules.logoMinPx;
    body = html`
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Version</span>
        ${picker({
          id: "variant",
          label: "Logo",
          value: l.props.variant || "color",
          groups: [
            { options: VARIANTS.filter((v) => brand.logos.some((x) => x.variant === v.value) || v.value === "color") },
          ],
        })}
      </div>
      ${sizeRow(l, "Size", 0.06, 0.6, 0.01, "w")}
      <p class="ap-caption imst-prop__note${logoPx < min ? " is-warning" : ""}">
        ${logoPx < min
          ? html`<i class="ap-icon-warning_fill" aria-hidden="true"></i> Logo width ${logoPx} px — the Playbook asks for
              at least ${min} px.`
          : html`Logo width ${logoPx} px · minimum ${min} px.
            ${brand.rules.noLogoDistortion ? "Its proportions are locked." : ""}`}
      </p>
    `;
  } else if (l.type === "shape") {
    body = html`
      ${colorRow({
        brand,
        value: l.props.colorRole,
        hex: l.props.hex,
        target: "shape",
        unlocked: unlock.color,
        label: "Colour",
      })}
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Opacity</span>${slider({
          path: "layer.opacity",
          value: l.props.opacity ?? 1,
          min: 0.1,
          max: 1,
          step: 0.05,
          label: "Opacity",
        })}
      </div>
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Rounded corners</span>${slider({
          path: "layer.radius",
          value: l.props.radius || 0,
          min: 0,
          max: 0.5,
          step: 0.02,
          label: "Rounded corners",
        })}
      </div>
    `;
  } else if (l.type === "asset") {
    body = sizeRow(l, "Size", 0.1, 1, 0.01, "w");
  } else {
    body = html`
      <p class="ap-body">
        The generated image. Regenerate just the background or just the subject — the rest stays as it is.
      </p>
      <div class="imst-prop imst-prop--inline">
        <button type="button" class="ap-button stroked grey" data-imst-regen="background">
          <i class="ap-icon-refresh" aria-hidden="true"></i><span>New background</span>
        </button>
        <button type="button" class="ap-button stroked grey" data-imst-regen="subject">
          <i class="ap-icon-refresh" aria-hidden="true"></i><span>New subject</span>
        </button>
      </div>
      <div class="imst-prop">
        <span class="imst-prop__label ap-caption">Brightness</span>${slider({
          path: "layer.brightness",
          value: l.props.brightness || 1,
          min: 0.5,
          max: 1.6,
          step: 0.05,
          label: "Brightness",
        })}
      </div>
    `;
  }
  return html`
    <section class="ap-card imst-panel" aria-labelledby="imst-props-title">
      <header class="imst-panel__head"><h2 class="ap-body-bold" id="imst-props-title">${layerName(l)}</h2></header>
      ${body} ${orderRow(l)}
    </section>
  `;
}

// ── Text ideas (hooks + CTAs in the brand's voice) ───────────────────────────

export function renderTextIdeas(ideas, hasText) {
  const loading = ideas.status === "loading";
  const list = (title, items) =>
    items.length
      ? html`<div class="imst-prop">
          <span class="imst-prop__label ap-caption">${title}</span>
          <ul class="imst-idea-list">
            ${items.map(
              (t) =>
                html`<li>
                  <button type="button" class="imst-idea-list__item" data-imst-use-text="${t}">
                    <span>${t}</span><span class="ap-link">Use</span>
                  </button>
                </li>`,
            )}
          </ul>
        </div>`
      : "";
  return html`
    <section class="ap-card imst-panel" aria-labelledby="imst-textideas-title" aria-busy="${loading}">
      <header class="imst-panel__head">
        <h2 class="ap-body-bold" id="imst-textideas-title">Text ideas</h2>
        <button
          type="button"
          class="ap-button ghost grey${loading ? " loading" : ""}"
          data-imst-action="text-ideas"
          ${loading ? "disabled" : ""}
        >
          <i class="ap-icon-sparkles" aria-hidden="true"></i><span>${ideas.hooks.length ? "More" : "Suggest"}</span>
        </button>
      </header>
      ${ideas.hooks.length
        ? html`${list("Hooks", ideas.hooks)}${list("Calls to action", ideas.ctas)}`
        : html`<p class="ap-caption imst-panel__hint">
            Three hooks and calls to action in the brand's voice.
            ${hasText ? "Pick one to replace the text." : "Pick one to add it as text."}
          </p>`}
    </section>
  `;
}

// ── Edit in words ────────────────────────────────────────────────────────────

export function renderWordsBar(nl) {
  const busy = nl.status === "loading";
  return html`
    <form class="imst-words" data-imst-form="words">
      <div class="ap-input-group imst-words__input">
        <i class="ap-icon-sparkles" aria-hidden="true"></i>
        <input
          type="text"
          class="ap-input"
          data-imst-field="words"
          value="${nl.text}"
          placeholder='Edit in words — e.g. "logo in white, bottom right" or "lighter background"'
          aria-label="Edit the image in words"
          ${busy ? "disabled" : ""}
        />
      </div>
      <button type="submit" class="ap-button primary orange${busy ? " loading" : ""}" ${busy ? "disabled" : ""}>
        <span>Apply</span>
      </button>
    </form>
    ${nl.message
      ? html`<p class="ap-caption imst-words__result${nl.status === "error" ? " is-error" : ""}" role="status">
          ${nl.message}
        </p>`
      : ""}
  `;
}
