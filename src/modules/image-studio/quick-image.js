// Image Generator — one image for a draft, without the studio (flag sexySquirrel).
// The chat asks the minimum (style · shape · text) and calls these; the studio
// stays one click away for everything else. Headless: no DOM beyond the canvas
// the PNG export draws on, and the same engine as the studio — the Playbook's
// styles, the network's shapes, the same renderer and services.

import { QUICK_PRESETS } from "./config/style-presets.js?v=1475";
import { DRAFT_NETWORK, formatById, shapesFor } from "./config/formats.js?v=1475";
import { hashString } from "./lib/prng.js?v=1475";
import { copyService, imageGenerationService } from "./services/index.js?v=1475";
import { resolveLayers } from "./render/layout.js?v=1475";
import { toPngBlob } from "./render/export.js?v=1475";
import { styleThumbUrl } from "./ui/style-thumb.js?v=1475";
import { layersFor, variationSvg } from "./ui/variation.js?v=1475";
import { getBrand, getStyle, getStylesForBrand } from "./state/store.js?v=1475";

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * What the chat can offer: six styles (the Playbook's own first, then one
 * preset per family), each with its thumbnail in the brand's palette, and the
 * shapes the draft's network publishes. `null` when the chat has no Playbook.
 */
export function quickImageChoices({ brandId, network }) {
  const brand = getBrand(brandId);
  if (!brand) return null;
  const own = getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
  const styles = [...own, ...QUICK_PRESETS.map(getStyle).filter(Boolean)]
    .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      label: s.label,
      mine: s.kind === "custom",
      description: s.description || "",
      thumbUrl: styleThumbUrl(s, brand, { seed: hashString(s.id) }),
    }));
  const shapes = shapesFor(DRAFT_NETWORK[network] || null).map((s) => ({
    id: s.id,
    label: s.label,
    ratio: s.ratio,
    formatId: s.formatId,
    w: s.w,
    h: s.h,
  }));
  return { brandName: brand.name, styles, shapes };
}

/** A line for the image, lifted from the post (the studio's Suggest). As slow as the real call. */
export function suggestImageLine(text, round = 0) {
  return copyService.headlineFromPost({ text, round });
}

/** What the image shows, read from the post (the studio's "Suggest from the post"). */
export function suggestImageSubject({ brandId, text }) {
  return copyService.promptFromPost({ brand: getBrand(brandId), text });
}

/**
 * One generation, baked: the variation with its text and logo, as the PNG
 * "Use in draft" would write. Rejects when the (mocked) model fails.
 * @returns {Promise<string>} a PNG data URL
 */
export async function generateQuickImage({ brandId, prompt, styleId, formatId, headline = "" }) {
  const brand = getBrand(brandId);
  const style = getStyle(styleId);
  const format = formatById(formatId);
  if (!brand || !style || !format) throw new Error("I couldn't set up that image.");
  const brief = { prompt, headline, styleId, productId: null, formatIds: [format.id], textMode: "layer", count: 1 };
  const [variation] = await imageGenerationService.generate({
    brief,
    brand,
    style,
    product: null,
    format,
    textMode: "layer",
    text: { headline },
    count: 1,
  });
  const creation = { title: "Draft image", brief, styleSnapshot: style, master: { layers: [] } };
  const blob = await toPngBlob({
    svg: variationSvg({ creation, variation, formatId: format.id, brand }),
    width: format.width,
    height: format.height,
    layers: resolveLayers(layersFor({ creation, formatId: format.id }), brand),
  });
  return blobToDataUrl(blob);
}
