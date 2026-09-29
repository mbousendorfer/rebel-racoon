// Image Generator — a style's thumbnail: the style drawn in the active brand's
// palette, so the gallery previews what THIS brand would get.

import { html } from "../lib/html.js?v=1386";
import { hashString } from "../lib/prng.js?v=1386";
import { renderVisual, resolveStyleDrawing, svgToDataUrl } from "../render/visual.js?v=1386";
import { resolvePalette } from "../render/palette.js?v=1386";
import { hasStyleArt, styleArtSvg } from "../render/style-art.js?v=1386";
import { getAsset } from "../state/store.js?v=1386";

// A thumbnail is the style's own picture (render/style-art.js), drawn in the
// brand's palette — a custom style shows its heaviest preset's, tinted by its
// references. Passing a subject `kind` asks for a TEST instead: the generator
// on that subject, which is what the style creator's preview is.
export function styleThumbUrl(style, brand, { seed, kind, width = 1080, height = 1080 } = {}) {
  const drawing = style ? resolveStyleDrawing(style, seed ?? hashString(style.id), getAsset) : null;
  if (!kind && drawing && hasStyleArt(drawing.variant))
    return svgToDataUrl(
      styleArtSvg(drawing.variant, resolvePalette(brand, { tint: drawing.tint, tintWeight: drawing.tintWeight })),
    );
  return svgToDataUrl(
    renderVisual({
      style,
      brand,
      seed: seed ?? hashString(style.id),
      width,
      height,
      subjectKind: kind || "object",
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
