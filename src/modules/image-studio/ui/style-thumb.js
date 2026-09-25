// Image Generator — a style's thumbnail: the style drawn in the active brand's
// palette, so the gallery previews what THIS brand would get.

import { html } from "../lib/html.js?v=1301";
import { hashString } from "../lib/prng.js?v=1301";
import { renderVisual, svgToDataUrl } from "../render/visual.js?v=1301";
import { getAsset } from "../state/store.js?v=1301";

export function styleThumbUrl(style, brand, { seed, kind = "object", width = 1080, height = 1080 } = {}) {
  return svgToDataUrl(
    renderVisual({
      style,
      brand,
      seed: seed ?? hashString(style.id),
      width,
      height,
      subjectKind: kind,
      getAsset,
    }),
  );
}

export function styleThumb(style, brand, opts = {}) {
  return html`<img
    class="imst-thumb ${opts.className || ""}"
    src="${styleThumbUrl(style, brand, opts)}"
    alt=""
    draggable="false"
  />`;
}
