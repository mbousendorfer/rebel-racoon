// Image Generator — the brand check and the predicted performance of one format.
//
// Brand check: what breaks the Playbook's rules, each with a fix —
//   colour off the palette · logo under the minimum size · logo box off its
//   proportions (a logo is never stretched: the renderer fits it) ·
//   text contrast too low (sampled from the actual pixels behind the text) ·
//   text or logo outside the network's safe zone · text overflowing its box ·
//   a word the brand avoids · a forbidden colour pair · the logo's clear space.
// Score = 100 − 20 per high, 10 per medium, 5 per low issue.
//
// Performance: a MOCKED prediction (0–100) from a few readable factors, each
// named — plus the attention hot spots the heatmap draws.

import { contrast, inkOn, resolvePalette } from "../render/palette.js?v=1308";
import { fitTextSize } from "../render/layout.js?v=1308";
import { resolveLayers } from "../render/layout.js?v=1308";
import { subjectFraction } from "../render/visual.js?v=1308";
import { hashString } from "../lib/prng.js?v=1308";

const PENALTY = { high: 20, medium: 10, low: 5 };

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function toHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** Average colour of a region of the rendered image (fractions of the canvas). */
async function sampler(svg, width, height, brightness = 1) {
  const W = 200;
  const H = Math.max(1, Math.round((W * height) / width));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (brightness !== 1) ctx.filter = `brightness(${brightness})`;
    ctx.drawImage(img, 0, 0, W, H);
    return (box) => {
      const x = Math.max(0, Math.floor(box.x * W));
      const y = Math.max(0, Math.floor(box.y * H));
      const w = Math.max(1, Math.min(W - x, Math.ceil(box.w * W)));
      const h = Math.max(1, Math.min(H - y, Math.ceil(box.h * H)));
      const d = ctx.getImageData(x, y, w, h).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n += 1;
      }
      return n ? toHex(r / n, g / n, b / n) : "#FFFFFF";
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function textHeightNeeded(l, ratio) {
  const perLine = Math.max(1, Math.floor(l.w / (l.props.size * 0.55)));
  return Math.ceil(String(l.props.content || "").length / perLine) * l.props.size * 1.2 * ratio;
}

/**
 * @returns {Promise<{ score:number, issues: Array<{ id, severity, title, detail, layerId?, fix? }> }>}
 */
export async function brandCheck({ svg, brand, format, layers }) {
  const p = resolvePalette(brand);
  const palette = new Set([...p.all, p.background, p.text].map((h) => h.toUpperCase()));
  const resolved = resolveLayers(layers, brand);
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const brightness = resolved.find((l) => l.type === "image")?.brightness || 1;
  const sample = await sampler(svg, format.width, format.height, brightness).catch(() => null);
  const ratio = format.width / format.height;
  const z = format.safeZone;
  const safe = { x: z.left, y: z.top, w: 1 - z.left - z.right, h: 1 - z.top - z.bottom };
  const issues = [];
  const add = (issue) => issues.push({ id: `${issue.kind}-${issue.layerId || "all"}`, ...issue });

  for (const l of layers) {
    if (l.hidden) continue;
    const r = byId.get(l.id);
    if ((l.type === "text" || l.type === "shape") && l.props.hex && !palette.has(l.props.hex.toUpperCase())) {
      add({
        kind: "palette",
        severity: "medium",
        layerId: l.id,
        title: "Colour outside the palette",
        detail: `${l.props.hex.toUpperCase()} isn't one of ${brand.name}'s colours.`,
      });
    }
    if (l.type === "logo") {
      const px = Math.round(l.w * format.width);
      if (px < brand.rules.logoMinPx) {
        add({
          kind: "logo-size",
          severity: "high",
          layerId: l.id,
          title: "Logo too small",
          detail: `${px} px wide — the Playbook asks for at least ${brand.rules.logoMinPx} px.`,
        });
      }
      if (brand.rules.noLogoDistortion && r.href) {
        const img = await loadImage(r.href).catch(() => null);
        if (img?.naturalWidth) {
          const natural = img.naturalHeight / img.naturalWidth;
          const actual = (l.h * format.height) / (l.w * format.width);
          // The logo is drawn "contain", so it's never visibly stretched — but a box
          // far off its ratio means it was resized in one direction.
          if (Math.abs(actual - natural) / natural > 0.35) {
            // Never a stretched logo — the renderer fits it — so this is a minor
            // "the box lies about the logo's size", not a distortion.
            add({
              kind: "logo-ratio",
              severity: "low",
              layerId: l.id,
              natural,
              title: "Logo box doesn't match the logo",
              detail:
                "The logo is never stretched — it's fitted — but its box has other proportions, so it looks smaller than it's set.",
            });
          }
        }
      }
      const pad = l.h * (brand.rules.clearSpace || 0);
      const zone = { x: l.x - pad / ratio, y: l.y - pad, w: l.w + (2 * pad) / ratio, h: l.h + 2 * pad };
      const crowding = layers.find(
        (o) => o.id !== l.id && !o.hidden && (o.type === "text" || o.type === "asset") && overlaps(zone, o),
      );
      if (crowding) {
        add({
          kind: "clear-space",
          severity: "low",
          layerId: l.id,
          title: "Logo clear space",
          detail: `Something sits inside the logo's clear space (${brand.rules.clearSpace} × its height).`,
        });
      }
    }
    if (
      (l.type === "text" || l.type === "logo") &&
      !(
        l.x >= safe.x - 0.001 &&
        l.y >= safe.y - 0.001 &&
        l.x + l.w <= safe.x + safe.w + 0.001 &&
        l.y + l.h <= safe.y + safe.h + 0.001
      )
    ) {
      add({
        kind: "safe-zone",
        severity: "high",
        layerId: l.id,
        title: `${l.type === "text" ? "Text" : "Logo"} outside the safe zone`,
        detail: `Part of it is hidden by the network's interface or off the image.`,
      });
    }
    if (l.type === "text") {
      if (textHeightNeeded(l, ratio) > l.h * 1.15) {
        add({
          kind: "overflow",
          severity: "medium",
          layerId: l.id,
          title: "Text overflows its box",
          detail: "It runs past the space set for it.",
        });
      }
      const bg = l.props.band
        ? r.bandColor
        : sample
          ? sample({ x: l.x, y: l.y, w: l.w, h: Math.min(l.h, textHeightNeeded(l, ratio)) })
          : p.background;
      const c = contrast(bg, r.color);
      const large = l.props.size >= 0.06;
      if (c < (large ? 3 : 4.5)) {
        add({
          kind: "contrast",
          severity: "high",
          layerId: l.id,
          title: "Text contrast too low",
          detail: `Contrast ${c.toFixed(1)} : 1 against what's behind it — ${large ? 3 : 4.5} : 1 is the minimum for ${large ? "large" : "body"} text.`,
        });
      }
      const pair = (brand.rules.forbiddenPairs || []).find(
        ([a, b]) =>
          (a.toUpperCase() === r.color.toUpperCase() && b.toUpperCase() === bg.toUpperCase()) ||
          (b.toUpperCase() === r.color.toUpperCase() && a.toUpperCase() === bg.toUpperCase()),
      );
      if (pair)
        add({
          kind: "pair",
          severity: "medium",
          layerId: l.id,
          title: "Forbidden colour pair",
          detail: `${pair[0]} and ${pair[1]} must never meet.`,
        });
      const avoided = (brand.voice.avoid || []).filter((w) =>
        new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(l.props.content),
      );
      if (avoided.length) {
        add({
          kind: "words",
          severity: "high",
          layerId: l.id,
          title: "Word the brand avoids",
          detail: `“${avoided.join("”, “")}” is on the Playbook's list of words to avoid.`,
          words: avoided,
        });
      }
    }
  }
  const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + PENALTY[i.severity], 0));
  return { score, issues };
}

/** Applies the fix of one issue. Returns new layers. */
export function fixIssue(issue, layers, { brand, format }) {
  const p = resolvePalette(brand);
  const ratio = format.width / format.height;
  const z = format.safeZone;
  return layers.map((l) => {
    if (l.id !== issue.layerId) return l;
    switch (issue.kind) {
      case "palette":
        return { ...l, props: { ...l.props, hex: undefined } };
      case "logo-size": {
        const w = (brand.rules.logoMinPx * 1.1) / format.width;
        return { ...l, w, h: l.h * (w / l.w) };
      }
      case "logo-ratio":
        // Back to the logo's own proportions: h (fraction of H) = w·W·natural / H.
        return { ...l, h: l.w * ratio * issue.natural };
      case "clear-space":
        return { ...l, x: 1 - z.right - l.w - 0.04, y: 1 - z.bottom - l.h - 0.04 };
      case "safe-zone": {
        const w = Math.min(l.w, 1 - z.left - z.right - 0.04);
        const h = Math.min(l.h, 1 - z.top - z.bottom - 0.04);
        return {
          ...l,
          w,
          h,
          x: Math.min(Math.max(l.x, z.left + 0.02), 1 - z.right - w - 0.02),
          y: Math.min(Math.max(l.y, z.top + 0.02), 1 - z.bottom - h - 0.02),
        };
      }
      case "overflow":
        return { ...l, props: { ...l.props, size: fitTextSize(l.props.content, l, l.props.size, ratio) } };
      case "contrast":
      case "pair": {
        // A band in the brand's background, and the ink that reads on it.
        const ink = inkOn(p.background, p.text);
        const role = ["text", "primary"].find((r) => p[r].toUpperCase() === ink.toUpperCase());
        return {
          ...l,
          props: {
            ...l.props,
            band: true,
            bandRole: "background",
            hex: role ? undefined : ink,
            colorRole: role || l.props.colorRole,
          },
        };
      }
      case "words": {
        let text = l.props.content;
        for (const w of issue.words)
          text = text.replace(new RegExp(`\\s*\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "");
        return { ...l, props: { ...l.props, content: text.replace(/\s{2,}/g, " ").trim() } };
      }
      default:
        return l;
    }
  });
}

/**
 * Predicted performance — MOCKED, deterministic for the same image. Returns the
 * score and the factors behind it, each named, so the number is never alone.
 */
export function predictPerformance({ creation, variation, format, layers, check }) {
  const text = layers.find((l) => l.type === "text" && !l.hidden);
  const factors = [];
  let score = 52;
  const push = (label, delta) => {
    factors.push({ label, delta });
    score += delta;
  };
  if (check)
    push(
      check.issues.some((i) => i.kind === "contrast") ? "Text hard to read" : "Readable text",
      check.issues.some((i) => i.kind === "contrast") ? -10 : 8,
    );
  if (text) {
    const n = String(text.props.content).length;
    push(n <= 40 ? "Short headline" : n > 80 ? "Long headline" : "Headline length", n <= 40 ? 8 : n > 80 ? -8 : 2);
  } else push("No text on the image", -3);
  if (/(person|people|team|face|owner|customer|founder)/i.test(creation.brief.prompt))
    push("A person in the picture", 6);
  if (creation.brief.productId) push("Product in the picture", 4);
  if (format.mockup === "story") push("Full-screen format", 4);
  if (check) push("Brand consistency", Math.round((check.score - 70) / 6));
  const jitter = (hashString(`${variation.seed}|${format.id}`) % 11) - 5;
  push("Composition", jitter);
  return { score: Math.max(12, Math.min(96, Math.round(score))), factors };
}

/** Where the eye goes first: the subject, then the text, then the logo (fractions + weight). */
export function attentionSpots({ variation, format, layers }) {
  const sub = subjectFraction({
    width: format.width,
    height: format.height,
    seed: variation.seed,
    subjectSeed: variation.subjectSeed,
  });
  const spots = [{ x: sub.x, y: sub.y, r: sub.r * 1.1, w: 1 }];
  for (const l of layers) {
    if (l.hidden || l.type === "image") continue;
    const w = l.type === "text" ? 0.75 : l.type === "logo" ? 0.35 : 0.3;
    spots.push({
      x: l.x + l.w / 2,
      y: l.y + l.h / 2,
      r: Math.max(l.w, l.h * (format.height / format.width)) * 0.55,
      w,
    });
  }
  return spots;
}
