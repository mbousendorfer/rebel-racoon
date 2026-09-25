// Image Generator — drawing a variation: the generated image (SVG) plus its
// layers (text, logo…) laid over it in the DOM, exactly where the PNG export
// will draw them. One function for the results grid, the editor and exports.

import { html, raw } from "../lib/html.js?v=1235";
import { formatById } from "../config/formats.js?v=1235";
import { renderVisual, svgToDataUrl } from "../render/visual.js?v=1235";
import { subjectKindFor } from "../render/subjects.js?v=1235";
import { defaultLayers, resolveLayers } from "../render/layout.js?v=1235";
import { storageService as storage } from "../services/index.js?v=1235";
import { getAsset, getStyle } from "../state/store.js?v=1235";

export function productHref(productId) {
  if (!productId) return "";
  const product = storage.get("products", productId);
  const asset = product?.imageAssetId ? getAsset(product.imageAssetId) : null;
  return asset?.svg ? storage.svgDataUrl(asset.svg) : "";
}

function figureIn(text) {
  const m = String(text || "").match(/\d[\d.,]*\s?(%|×|x\b|k\b|M\b)?/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

/** The SVG of one variation in one format. */
export function variationSvg({ creation, variation, formatId, brand }) {
  const format = formatById(formatId || creation.brief.formatIds[0]) || formatById("ig-post");
  const style = creation.styleSnapshot || getStyle(creation.brief.styleId);
  return renderVisual({
    style,
    brand,
    seed: variation.seed,
    bgSeed: variation.bgSeed,
    subjectSeed: variation.subjectSeed,
    width: format.width,
    height: format.height,
    subjectKind: subjectKindFor(creation.brief.prompt, creation.brief.productId),
    productHref: productHref(creation.brief.productId),
    text: {
      headline: creation.brief.headline,
      embedded: creation.brief.textMode === "embedded",
      // "Big number" draws the brief's own figure when it has one.
      number: figureIn(creation.brief.headline) || figureIn(creation.brief.prompt),
    },
    getAsset,
    title: creation.title,
  });
}

/** Layers to show over a variation: the creation's own (editor) or the defaults for the format. */
export function layersFor({ creation, formatId, useMaster = false }) {
  const format = formatById(formatId) || formatById("ig-post");
  if (useMaster && creation.master?.layers?.length) return creation.master.layers;
  return defaultLayers({ layout: format.layout, headline: creation.brief.headline, textMode: creation.brief.textMode });
}

/** DOM overlay for resolved layers (skipping the image layer, which is the SVG itself). */
export function overlayHtml(resolved, { interactive = false, selectedId = null } = {}) {
  return raw(
    resolved
      .filter((l) => l.type !== "image" && !l.hidden)
      .sort((a, b) => a.z - b.z)
      .map((l) => {
        const box = `left:${l.x * 100}%;top:${l.y * 100}%;width:${l.w * 100}%;height:${l.h * 100}%;${l.rotation ? `transform:rotate(${l.rotation}deg);` : ""}`;
        const attrs = interactive
          ? `data-imst-layer="${l.id}" tabindex="0" role="button" aria-label="${l.type} layer"`
          : 'aria-hidden="true"';
        const sel = l.id === selectedId ? " is-selected" : "";
        if (l.type === "text") {
          const esc = String(l.content).replace(
            /[&<>"]/g,
            (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
          );
          const band = l.band ? `background:${l.bandColor};box-shadow:0 0 0 0.3em ${l.bandColor};` : "";
          return `<div class="imst-layer imst-layer--text${sel}" ${attrs} style="${box}font-family:${l.fontStack.replace(/"/g, "'")};color:${l.color};text-align:${l.align};font-size:${(l.size * 100).toFixed(2)}cqw;${band}"><span>${esc}</span></div>`;
        }
        if (l.type === "logo" || l.type === "asset") {
          return l.href
            ? `<div class="imst-layer imst-layer--media${sel}" ${attrs} style="${box}"><img src="${l.href}" alt="" draggable="false"/></div>`
            : "";
        }
        if (l.type === "shape") {
          return `<div class="imst-layer imst-layer--shape${sel}" ${attrs} style="${box}background:${l.color};opacity:${l.opacity};border-radius:${l.radius * 100}%"></div>`;
        }
        return "";
      })
      .join(""),
  );
}

/** A variation as a sized canvas: image + overlays. */
export function variationCanvas({ creation, variation, formatId, brand, layers, className = "" }) {
  const format = formatById(formatId) || formatById("ig-post");
  const svg = variationSvg({ creation, variation, formatId: format.id, brand });
  const resolved = resolveLayers(layers || layersFor({ creation, formatId: format.id }), brand);
  return html`
    <div class="imst-canvas ${className}" style="aspect-ratio: ${format.width} / ${format.height}">
      <img class="imst-canvas__image" src="${svgToDataUrl(svg)}" alt="${creation.title}, variation" draggable="false" />
      ${overlayHtml(resolved)}
    </div>
  `;
}
