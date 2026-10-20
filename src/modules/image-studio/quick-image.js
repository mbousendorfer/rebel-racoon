// Image Generator — one image for a draft, without the studio. A draft's
// "Generate an image" calls these (draft-image-flow.js): the Playbook's look,
// the network's shape — asked once, the first time, when the Playbook has no look. The studio stays one click away for
// everything else. Headless, and the same services as the studio.

import { CUSTOM_STYLE_LIMITS, QUICK_PRESETS } from "./config/style-presets.js?v=2073";
import { MOCK } from "./config/mock.js?v=2073";
import { DRAFT_NETWORK, formatById, shapesForBrand } from "./config/formats.js?v=2073";
import { hashString } from "./lib/prng.js?v=2073";
import { copyService, imageGenerationService } from "./services/index.js?v=2073";
import { styleThumbUrl } from "./ui/style-thumb.js?v=2073";
import { canEditBrand, getBrand, getStyle, getStylesForBrand, registerOneOffStyle } from "./state/store.js?v=2073";
import { oneOffStyleFrom, saveStyle, uploadReference } from "./state/style-actions.js?v=2073";
import { setPlaybookDefaultLook } from "./state/playbook-brand.js?v=2073";

/**
 * What the chat can offer: six styles (the Playbook's own first, then one
 * preset per family), each with its thumbnail in the brand's palette, and the
 * shapes the draft's network publishes. `null` when the chat has no Playbook.
 */
export function quickImageChoices({ brandId, network }) {
  const brand = getBrand(brandId);
  if (!brand) return null;
  // The Playbook's default style first, then its own, then the presets.
  const own = getStylesForBrand(brand.id)
    .filter((s) => s.kind === "custom")
    .sort((a, b) => (b.id === brand.defaults.styleId) - (a.id === brand.defaults.styleId));
  const styles = [...own, ...QUICK_PRESETS.map(getStyle).filter(Boolean)]
    .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i)
    .slice(0, 6)
    .map((s) => ({
      id: s.id,
      label: s.label,
      mine: s.kind === "custom",
      isDefault: s.id === brand.defaults.styleId,
      description: s.description || "",
      thumbUrl: styleThumbUrl(s, brand, { seed: hashString(s.id) }),
    }));
  const shapes = shapesForBrand(brand, DRAFT_NETWORK[network] || null).map((s) => ({
    id: s.id,
    label: s.label,
    ratio: s.ratio,
    formatId: s.formatId,
    w: s.w,
    h: s.h,
  }));
  return { brandName: brand.name, styles, shapes };
}

// One one-off per reference image, kept for the page's life: "Try another"
// and the next draft reuse it instead of re-reading the image.
// ponytail: never discarded (a few KB per image in storage); discard with the session if it matters.
const referenceLooks = new Map(); // url → Promise<style>

/**
 * The Playbook's default look as a style "Generate image" can draw with — its
 * default style, or a one-off read from its default reference image. `null`
 * when the Playbook has none (the chat then asks), or the image can't be read.
 * @returns {Promise<{ id: string, label: string } | null>}
 */
export async function defaultQuickLook(brandId) {
  const brand = getBrand(brandId);
  const d = brand?.defaults;
  if (!d) return null;
  if (d.styleId) {
    const style = getStyle(d.styleId);
    return style ? { id: style.id, label: style.label } : null;
  }
  if (!d.referenceUrl) return null;
  if (!referenceLooks.has(d.referenceUrl))
    referenceLooks.set(
      d.referenceUrl,
      fetch(d.referenceUrl)
        .then((r) => r.blob())
        .then((blob) => oneOffStyleFrom(brand.id, [new File([blob], "reference", { type: blob.type })]))
        .then((style) => {
          registerOneOffStyle(style);
          return style;
        }),
    );
  try {
    const style = await referenceLooks.get(d.referenceUrl);
    return { id: style.id, label: d.referenceLabel ? `the look of ${d.referenceLabel}` : "your reference image" };
  } catch {
    referenceLooks.delete(d.referenceUrl);
    return null;
  }
}

// ── The first image: no look yet ─────────────────────────────────────────────
// A Playbook with no default look asks ONCE how its images should look
// (draft-image-flow.js requireImageLook); the answer is its `defaultLook`, and
// every Generate after that goes straight to the loader.

/** Generate an image asks first: the Playbook has no look yet, and you may give it one. */
export function needsImageLook(brandId) {
  const brand = getBrand(brandId);
  return !!brand && !brand.defaults.styleId && !brand.defaults.referenceUrl && canEditBrand(brand.id);
}

/** Makes a style the Playbook's default look — or none, with `null` (Undo). */
export function setImageLook(brandId, styleId) {
  return setPlaybookDefaultLook(brandId, styleId ? { kind: "style", id: styleId } : { kind: "", id: "" });
}

/**
 * A brand style learned from the user's own images, saved on the Playbook —
 * the style creator's save, without its page: named after the brand, renamed
 * on the Playbook if need be.
 * @returns {Promise<{ id: string, label: string, thumbUrl: string }>}
 */
export async function styleFromImages(brandId, files) {
  const brand = getBrand(brandId);
  const images = [...files].filter((f) => f.type.startsWith("image/")).slice(0, CUSTOM_STYLE_LIMITS.images);
  if (!brand || !images.length) throw new Error("Those aren't images.");
  const assets = await Promise.all(images.map((f) => uploadReference(brand.id, f)));
  const style = saveStyle({
    brandId: brand.id,
    label: `${brand.name} look`,
    description: `Learned from ${images.length} of your images`,
    sources: assets.map((a) => ({ type: "image", ref: a.id, label: a.name, weight: 0.8 })),
    fidelity: "essential",
    stylePrompt: "",
  });
  if (!style) throw new Error("I couldn't save that style.");
  return { id: style.id, label: style.label, thumbUrl: styleThumbUrl(style, brand, { seed: hashString(style.id) }) };
}

/**
 * What "Generate an image" will use on a draft, before anyone clicks it: the
 * Playbook's look (its default style or reference image, else its first style
 * or a preset — what the click uses), the shape for this network, and `ask`
 * when there is no look yet and the first click will ask for one (then `look`
 * is null). `null` when there is no Playbook.
 */
export function quickImagePreset({ brandId, network }) {
  const brand = getBrand(brandId);
  if (!brand) return null;
  const d = brand.defaults || {};
  const shape = shapesForBrand(brand, DRAFT_NETWORK[network] || null)[0];
  const style = d.styleId ? getStyle(d.styleId) : null;
  // No look yet: the first click asks (needsImageLook) — the caption says so
  // instead of naming a preset nobody chose.
  const ask = needsImageLook(brand.id);
  const look = style
    ? { label: style.label, thumbUrl: styleThumbUrl(style, brand) }
    : d.referenceUrl
      ? { label: d.referenceLabel || "your reference image", thumbUrl: d.referenceUrl }
      : ask
        ? null
        : quickImageChoices({ brandId, network })?.styles[0] || null;
  return { ask, brandName: brand.name, look, shape: shape ? { label: shape.label, ratio: shape.ratio } : null };
}

/** What the image shows, read from the post (the studio's "Suggest from the post"). */
export function suggestImageSubject({ brandId, text }) {
  return copyService.promptFromPost({ brand: getBrand(brandId), text });
}

/**
 * One generation for a draft: the same mocked call as the studio (its wait, its
 * failures), but what comes back is a detailed stock photo cropped to the
 * shape (MOCK.photos), not the style render — so the loader's arrival shows.
 * Rejects when the (mocked) model fails.
 * ponytail: the photo ignores the style and the post; a real backend returns the generated image.
 * @returns {Promise<string>} the image URL
 */
export async function generateQuickImage({ brandId, prompt, styleId, formatId }) {
  const brand = getBrand(brandId);
  const style = getStyle(styleId);
  const format = formatById(formatId);
  if (!brand || !style || !format) throw new Error("I couldn't set up that image.");
  const brief = { prompt, headline: "", styleId, productId: null, formatIds: [format.id], textMode: "layer", count: 1 };
  await imageGenerationService.generate({ brief, brand, style, product: null, format, textMode: "layer", count: 1 });
  const id = MOCK.photos[Math.floor(Math.random() * MOCK.photos.length)];
  return `https://images.unsplash.com/photo-${id}?w=${format.width}&h=${format.height}&fit=crop&crop=entropy&auto=format&q=80`;
}
