// Image Generator — where the text block and the logo sit, per layout
// archetype (config/formats.js: square · portrait · tall · wide). "Adapt
// everywhere" recomposes with these, it never crops: a wide format moves the
// text to the left half, a story keeps everything out of the network's UI.

import { createLayer } from "../model/schema.js?v=1301";
import { fontStack } from "../config/fonts.js?v=1301";
import { resolvePalette, inkOn } from "./palette.js?v=1301";
import { assetUrlSync, logoUrl } from "../ui/asset.js?v=1301";

export const ARCHETYPES = Object.freeze({
  square: { text: { x: 0.08, y: 0.62, w: 0.84, h: 0.2, size: 0.075 }, logo: { x: 0.72, y: 0.87, w: 0.2, h: 0.07 } },
  portrait: { text: { x: 0.08, y: 0.66, w: 0.84, h: 0.18, size: 0.072 }, logo: { x: 0.72, y: 0.9, w: 0.2, h: 0.06 } },
  tall: { text: { x: 0.1, y: 0.56, w: 0.8, h: 0.14, size: 0.085 }, logo: { x: 0.38, y: 0.74, w: 0.24, h: 0.045 } },
  wide: { text: { x: 0.06, y: 0.3, w: 0.44, h: 0.4, size: 0.05 }, logo: { x: 0.06, y: 0.82, w: 0.16, h: 0.1 } },
});

/** The starting layers of a creation for a format: the image, the headline (layer mode), the logo. */
export function defaultLayers({ layout = "square", headline = "", textMode = "layer" }) {
  const a = ARCHETYPES[layout] || ARCHETYPES.square;
  const layers = [createLayer("image", { x: 0, y: 0, w: 1, h: 1, z: 0, locked: true, props: { source: "variation" } })];
  if (textMode === "layer" && headline) {
    layers.push(
      createLayer("text", {
        ...a.text,
        z: 2,
        props: {
          content: headline,
          fontRole: "heading",
          colorRole: "text",
          size: a.text.size,
          align: "left",
          band: false,
        },
      }),
    );
  }
  layers.push(createLayer("logo", { ...a.logo, z: 3, props: { variant: "color" } }));
  return layers;
}

/** Re-places an existing set of layers for another archetype (same content, new positions). */
export function recompose(layers, layout) {
  const a = ARCHETYPES[layout] || ARCHETYPES.square;
  return layers.map((l) => {
    if (l.type === "text") return { ...l, ...a.text, props: { ...l.props, size: a.text.size } };
    if (l.type === "logo") return { ...l, ...a.logo };
    return { ...l };
  });
}

/**
 * Concrete drawing specs (colours, font stacks, URLs) for layers — what the
 * DOM preview and the PNG export both draw from.
 */
export function resolveLayers(layers, brand) {
  const p = resolvePalette(brand);
  const heading = brand?.fonts?.find((f) => f.role === "heading")?.family;
  const body = brand?.fonts?.find((f) => f.role === "body")?.family;
  const colorOf = (props) => props.hex || p[props.colorRole] || p.text;
  return layers.map((l) => {
    const base = {
      id: l.id,
      type: l.type,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      z: l.z,
      rotation: l.rotation,
      hidden: l.hidden,
      locked: l.locked,
    };
    if (l.type === "text") {
      const family = l.props.family || (l.props.fontRole === "body" ? body : heading);
      return {
        ...base,
        content: l.props.content,
        size: l.props.size,
        align: l.props.align,
        band: l.props.band,
        bandColor: p[l.props.bandRole || "background"],
        color: l.props.band ? inkOn(p[l.props.bandRole || "background"], colorOf(l.props)) : colorOf(l.props),
        fontStack: family ? fontStack(family) : "Helvetica, Arial, sans-serif",
      };
    }
    if (l.type === "logo") return { ...base, href: logoUrl(brand, l.props.variant || "color") };
    if (l.type === "shape")
      return { ...base, color: colorOf(l.props), radius: l.props.radius || 0, opacity: l.props.opacity ?? 1 };
    if (l.type === "asset") return { ...base, href: l.props.href || assetUrlSync(l.props.assetId) };
    if (l.type === "image") return { ...base, brightness: l.props.brightness || 1 };
    return base;
  });
}
