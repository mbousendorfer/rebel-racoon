// Image Generator — renders one mock visual as standalone SVG markup.
//
// Deterministic: the same (style, brand palette, seeds, size, subject) always
// draws the same picture, which is why a variation stores seeds, not pixels.
// A preset draws with its own generator. A CUSTOM style blends its sources:
//   · presets — "Style & composition" always draws with the heaviest one (the
//     framing is part of the style); "Essential" picks one per seed by weight
//     (only colours, textures and mood are held);
//   · reference images — their sampled colours tint the palette by their weight.

import { prng } from "../lib/prng.js?v=1237";
import { presetById } from "../config/style-presets.js?v=1237";
import { generatorFor } from "./generators.js?v=1237";
import { inkOn, resolvePalette } from "./palette.js?v=1237";
import { fontStack } from "../config/fonts.js?v=1237";
import { subjectPath } from "./subjects.js?v=1237";

let renderSeq = 0;

function weightedPick(rand, sources) {
  const total = sources.reduce((sum, s) => sum + s.weight, 0) || 1;
  let t = rand() * total;
  for (const s of sources) {
    t -= s.weight;
    if (t <= 0) return s;
  }
  return sources[sources.length - 1];
}

/** Which generator a style draws with, for a given seed, plus the palette tint it asks for. */
export function resolveStyleDrawing(style, seed, getAsset = () => null) {
  if (!style) return { family: "illustration", variant: "flat", tint: [], tintWeight: 0 };
  if (style.kind !== "custom") return { ...style.render, family: style.family, tint: [], tintWeight: 0 };
  const sources = style.custom?.sources || [];
  const presets = sources.filter((s) => s.type === "preset" && presetById(s.ref) && s.weight > 0);
  const images = sources.filter((s) => s.type === "image" && s.weight > 0);
  let chosen = presetById("preset-editorial");
  if (presets.length) {
    const src =
      style.custom.fidelity === "composition"
        ? [...presets].sort((a, b) => b.weight - a.weight)[0]
        : weightedPick(prng(seed ^ 0x9e3779b9), presets);
    chosen = presetById(src.ref);
  }
  const tint = images.flatMap((s) => getAsset(s.ref)?.colors || []).slice(0, 3);
  const imageWeight = images.reduce((sum, s) => sum + s.weight, 0);
  const presetWeight = presets.reduce((sum, s) => sum + s.weight, 0);
  const tintWeight = tint.length ? Math.min(0.85, imageWeight / (imageWeight + presetWeight || 1)) : 0;
  return { family: chosen.family, variant: chosen.render.variant, tint, tintWeight };
}

/**
 * @param {{style, brand, seed:number, bgSeed?:number, subjectSeed?:number, width:number, height:number,
 *          subjectKind?:string, productHref?:string, text?:{number?:string}, getAsset?:Function, title?:string}} o
 * @returns {string} SVG markup
 */
export function renderVisual(o) {
  const W = 1000;
  const H = Math.round((1000 * o.height) / o.width);
  const drawing = resolveStyleDrawing(o.style, o.seed, o.getAsset);
  const p = resolvePalette(o.brand, { tint: drawing.tint, tintWeight: drawing.tintWeight });
  const r = prng(o.seed);
  const rb = prng(o.bgSeed ?? o.seed ^ 0x5bd1e995);
  const rs = prng(o.subjectSeed ?? o.seed ^ 0x27d4eb2d);
  // The subject sits where the text layer ISN'T: lower-right third on a tall
  // canvas, right of centre on a wide one — the text block and logo take the rest.
  // Matches render/layout.js: square/portrait keep the text in the lower third,
  // stories keep it just under the middle, wide formats on the left half.
  const ratio = H / W;
  const wide = ratio < 0.72;
  const tall = ratio > 1.5;
  const s = wide ? H * (0.5 + rs() * 0.12) : W * (tall ? 0.52 + rs() * 0.1 : 0.4 + rs() * 0.08);
  const cx = W * (wide ? 0.72 : 0.5 + (rs() - 0.5) * 0.14);
  const cy = H * (wide ? 0.5 : tall ? 0.3 : 0.36 + (rs() - 0.5) * 0.06);
  const kind = o.subjectKind || "object";
  const ctx = {
    W,
    H,
    p,
    r,
    rb,
    rs,
    id: `imst-r${(renderSeq += 1)}`,
    subject: { kind, cx, cy, s, d: subjectPath(kind, cx, cy, s, rs) },
    text: o.text || null,
    productHref: o.productHref || "",
  };
  const body = generatorFor(drawing.family, drawing.variant)(ctx) + embeddedText(ctx, o);
  const title = o.title ? `<title>${String(o.title).replace(/[&<>]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${o.width}" height="${o.height}" preserveAspectRatio="xMidYMid slice">${title}${body}</svg>`;
}

// "Built into the image": the model writes the headline itself, so it becomes
// part of the pixels — in the brand's heading font, on a soft scrim so it reads
// whatever the generator drew underneath. Only offered for styles that support it.
function embeddedText(c, o) {
  const headline = o.text?.embedded && o.text.headline ? String(o.text.headline) : "";
  if (!headline) return "";
  const { W, H, p } = c;
  const family = o.brand?.fonts?.find((f) => f.role === "heading")?.family;
  const font = family ? fontStack(family).replace(/"/g, "'") : "Helvetica, Arial, sans-serif";
  const size = Math.min(W, H) * (headline.length > 28 ? 0.06 : 0.08);
  const words = headline.split(/\s+/);
  const perLine = Math.max(1, Math.floor((W * 0.8) / (size * 0.55)));
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  const shown = lines.slice(0, 3);
  const top = H * 0.08;
  const scrimH = size * 1.25 * shown.length + size;
  const ink = inkOn(p.background, p.text);
  const esc = (t) => t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);
  return (
    `<rect x="${W * 0.05}" y="${top - size * 0.2}" width="${W * 0.9}" height="${scrimH}" rx="${size * 0.3}" fill="${p.background}" opacity="0.82"/>` +
    shown
      .map(
        (l, i) =>
          `<text x="${W * 0.09}" y="${top + size * (1.05 + i * 1.25)}" font-size="${size}" font-weight="700" font-family="${font}" fill="${ink}">${esc(l)}</text>`,
      )
      .join("")
  );
}

export function svgToDataUrl(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
