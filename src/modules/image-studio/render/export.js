// Image Generator — export to PNG, in the browser.
//
// 1. the generated SVG is rasterised through an <img> (an SVG loaded that way
//    can't fetch webfonts, which is why text layers are NOT drawn in the SVG);
// 2. drawn into a canvas at the format's real size;
// 3. text / logo / shape layers are drawn natively with the 2D API, after
//    document.fonts has loaded the families they use;
// 4. canvas.toBlob → a download.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image couldn't be drawn."));
    img.src = url;
  });
}

function svgUrl(svg) {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws layers onto a canvas context. Layer coordinates are fractions of the
 * canvas (x, y, w, h in 0..1). Supported: text, logo / image (via `href`), shape.
 */
export async function drawLayers(ctx, layers, width, height) {
  const fonts = layers
    .filter((l) => l.type === "text" && !l.hidden)
    .map((l) => `700 ${Math.round(l.size * width)}px ${l.fontStack}`);
  if (document.fonts) await Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => {})));
  for (const layer of [...layers].sort((a, b) => a.z - b.z)) {
    if (layer.hidden) continue;
    const x = layer.x * width;
    const y = layer.y * height;
    const w = layer.w * width;
    const h = layer.h * height;
    ctx.save();
    if (layer.rotation) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (layer.type === "shape") {
      ctx.fillStyle = layer.color;
      ctx.globalAlpha = layer.opacity ?? 1;
      const r = (layer.radius || 0) * Math.min(w, h);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
      ctx.fill();
    } else if ((layer.type === "logo" || layer.type === "image" || layer.type === "asset") && layer.href) {
      const img = await loadImage(layer.href).catch(() => null);
      if (img) {
        // Never distort: fit inside the box, keeping the ratio.
        const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * ratio;
        const dh = img.naturalHeight * ratio;
        ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      }
    } else if (layer.type === "text" && layer.content) {
      const size = layer.size * width;
      ctx.font = `700 ${size}px ${layer.fontStack}`;
      ctx.textBaseline = "top";
      ctx.textAlign = layer.align || "left";
      const lines = wrap(ctx, layer.content, w);
      const lineH = size * 1.2;
      if (layer.band) {
        ctx.fillStyle = layer.bandColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - size * 0.4, y - size * 0.3, w + size * 0.8, lines.length * lineH + size * 0.6);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = layer.color;
      const ax = layer.align === "center" ? x + w / 2 : layer.align === "right" ? x + w : x;
      lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lineH));
    }
    ctx.restore();
  }
}

/** Renders SVG (+ optional layers) at width × height and returns a PNG Blob. */
export async function toPngBlob({ svg, width, height, layers = [] }) {
  const url = svgUrl(svg);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const brightness = layers.find((l) => l.type === "image")?.brightness || 1;
    if (brightness !== 1) ctx.filter = `brightness(${brightness})`;
    ctx.drawImage(img, 0, 0, width, height);
    ctx.filter = "none";
    await drawLayers(ctx, layers, width, height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed."))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function slug(text) {
  return (
    String(text || "image")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "image"
  );
}
