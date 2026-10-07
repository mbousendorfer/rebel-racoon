// <archie-pixels> — the Image Generator's loader and reveal, one element.
//
// Waiting: a halftone of small square pixels on a fine grid, in the colours
// the image will be made of (`data-colors`, the Playbook's palette; a grey ink
// without one), light on a light base. Only their SIZE moves — a slow drift,
// and a soft diagonal shimmer passing through — so it reads as quiet, not as
// noise (dithered blocks were rejected as too coarse, 2026-10-07). Under the
// cursor, a loupe: the pixels swell and part, trailing it softly. It is the
// loader: no spinner over it, only a label the host may nest.
//
// Arriving (`data-reveal-at`, an epoch ms) — the Archie bloom: the overlay
// covers the <img> its host already rendered beneath it; in its centre the
// Archie mark appears drawn in the image's own pixels, popping in the
// loader's order; then the image blooms outward from the mark, each pixel
// landing with a small overshoot, and dissolves pixel by pixel into the real
// image (its DOM text layers included). Picked 2026-10-07 over a left-to-right
// wave, a "print" (halftone of the image) and a split-flap ripple.
//
//   ·········      ····▪····      ··▪■■■▪··      ▪■■■■■■■▪
//   ···▪ ▪···  →   ··■■■■■··  →   ▪■■■■■■■▪  →   (the photo)
//   ·········      ····▪····      ··▪■■■▪··      ▪■■■■■■■▪
//   halftone       the mark       the bloom      dissolved
//
// Everything is a function of the clock, never of how long the element has
// lived: the hosts re-render by innerHTML, so a fresh copy picks the halftone
// (or the bloom) up exactly where the one it replaced left it. A host renders
// the reveal only while `Date.now() - at < REVEAL_MS`. Reduced motion: one
// still frame, and no reveal at all.
//
// A 2D canvas drawn in device pixels (each square snapped, so edges stay
// crisp): one Path2D per ink for the halftone, one for the image's pixels,
// clipped over a one-pixel-per-cell copy of the image; one for the cells
// already dissolved, erased.

import { MARK_PATH } from "./archie-loader.js?v=1716";

const PITCH = 6; // CSS px from one pixel to the next
const FPS = 30; // the halftone's rate; the bloom runs every frame
export const REVEAL_MS = 1600;
const POP = 0.12; // one pixel's pop, as a share of REVEAL_MS
const HALFTONE = 0; // the states of a cell during a reveal
const IMAGE = 1;
const GONE = 2;
// The Archie mark (its outline from archie-loader.js) and the centres of the
// loader's 7 squares in its viewBox — the order the mark's pixels pop in.
const MARK = [
  [99, 24],
  [56, 64],
  [20, 99],
  [66, 144],
  [113, 97],
  [158, 53],
  [204, 97],
];
const MARK_W = 227.15;
const MARK_H = 170.03;
const INK_ALPHA = 0.42; // the halftone is a tint, never the full ink
const SHIMMER = 2.4; // s per pass
const LENS = 56; // CSS px: the cursor's reach on the halftone

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => x * x * (3 - 2 * x);
const backOut = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; // overshoots ~10%, settles at 1

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise: smooth, cheap, enough for slow clouds.
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// The cursor, shared by every instance — one listener, not one per element —
// in client coordinates; null once it leaves the window.
let pointer = null;
addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }), { passive: true });
addEventListener("pointerout", (e) => {
  if (!e.relatedTarget) pointer = null;
});

// The image as `object-fit: cover` draws it into a w × h box.
function cover(ctx, img, w, h) {
  const iw = img.naturalWidth || w;
  const ih = img.naturalHeight || h;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h);
}

class ArchiePixels extends HTMLElement {
  hover = 0; // 0…1, the lens easing in and out
  lx = 0; // the lens centre, in CSS px, trailing the cursor
  ly = 0;

  connectedCallback() {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("aria-hidden", "true");
      this.prepend(this.canvas);
      this.mosaic = document.createElement("canvas"); // the image, one pixel per cell
    }
    this.ctx = this.canvas.getContext("2d");
    const css = getComputedStyle(this);
    this.base = css.getPropertyValue("--archie-pixels-base").trim();
    // Each ink as a translucent fill over the base.
    const probe = this.ctx;
    this.inks = (
      this.dataset.colors ? this.dataset.colors.split(",") : [css.getPropertyValue("--archie-pixels-ink")]
    ).map((c) => {
      probe.fillStyle = "#000";
      probe.fillStyle = c.trim();
      return probe.fillStyle;
    });

    this.revealAt = Number(this.dataset.revealAt) || 0;
    if (this.revealAt) {
      this.img = this.parentElement?.querySelector("img");
      if (!this.img || reduced() || Date.now() - this.revealAt >= REVEAL_MS) return void (this.hidden = true);
      this.img.decode().then(
        () => {
          this.ready = true;
          this.sample();
        },
        () => (this.hidden = true),
      );
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this);
    if (!reduced()) this.raf = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
  }

  resize() {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!w || !h) return;
    this.dpr = window.devicePixelRatio || 1;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.cols = Math.ceil(w / PITCH);
    this.rows = Math.ceil(h / PITCH);
    // The halftone lives in page space: side by side (the stage and its
    // tiles), each element is a window onto one field, not one picture twice.
    const box = this.getBoundingClientRect();
    this.ox = Math.round(box.left / PITCH);
    this.oy = Math.round(box.top / PITCH);
    this.sample();
    this.last = -1;
    this.draw(performance.now());
  }

  // The image's colour under each cell (the last, partial column and row
  // included: the cover is stretched over whole cells, a < 1-cell error).
  sample() {
    if (!this.ready || !this.w) return;
    this.mosaic.width = this.cols;
    this.mosaic.height = this.rows;
    cover(this.mosaic.getContext("2d"), this.img, this.cols, this.rows);
    this.plan();
  }

  tick = (now) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.cols) return;
    // The bloom and the lens run every frame; the halftone alone steps at FPS.
    const lens = this.follow();
    const frame = Math.floor(now / (1000 / FPS));
    if (frame === this.last && !this.revealAt && !lens) return;
    this.last = frame;
    this.draw(now);
  };

  // The lens: it eases in where the cursor comes near, trails it, and fades
  // out when it leaves. True while it shows. Not during a reveal.
  follow() {
    if (this.revealAt || (!pointer && !this.hover)) return false;
    const box = this.getBoundingClientRect();
    const near =
      pointer &&
      pointer.x > box.left - LENS &&
      pointer.x < box.right + LENS &&
      pointer.y > box.top - LENS &&
      pointer.y < box.bottom + LENS;
    if (near) {
      const k = this.w / box.width || 1; // a modal still scaling in
      const x = (pointer.x - box.left) * k;
      const y = (pointer.y - box.top) * k;
      if (this.hover < 0.02) [this.lx, this.ly] = [x, y]; // it appears where the cursor enters
      this.lx += (x - this.lx) * 0.22;
      this.ly += (y - this.ly) * 0.22;
    }
    this.hover += ((near ? 1 : 0) - this.hover) * 0.1;
    if (this.hover < 0.005) this.hover = 0;
    return this.hover > 0;
  }

  // Each cell's timeline for the bloom — once per size, not per frame.
  // Times are shares of REVEAL_MS.
  plan() {
    const { cols, rows, w, h } = this;
    const n = cols * rows;
    const at = (x) => (x + 0.5) * PITCH;
    // The mark, centred, half the box: which cells it covers, and for each the
    // loader square it belongs to (its pop order).
    const scale = Math.min(0.5 * w, 0.5 * h * (MARK_W / MARK_H)) / MARK_W;
    const x0 = (w - MARK_W * scale) / 2;
    const y0 = (h - MARK_H * scale) / 2;
    const glyph = new Path2D(MARK_PATH);
    const probe = this.mosaic.getContext("2d");
    const order = new Int8Array(n).fill(-1);
    const marked = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const u = (at(x) - x0) / scale;
        const v = (at(y) - y0) / scale;
        if (!probe.isPointInPath(glyph, u, v)) continue;
        const k = y * cols + x;
        let near = Infinity;
        MARK.forEach(([mx, my], m) => {
          const d = Math.hypot(u - mx, v - my);
          if (d < near) [near, order[k]] = [d, m];
        });
        marked.push([x, y]);
      }
    // Every other cell: how far from the mark, which is when the bloom reaches it.
    // ponytail: brute force, cells × mark cells (~3M on the studio's stage, once);
    // a two-pass distance transform if it ever shows in a profile.
    let far = 1;
    const dist = new Float32Array(n);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let best = Infinity;
        for (const [mx, my] of marked) best = Math.min(best, (mx - x) ** 2 + (my - y) ** 2);
        dist[y * cols + x] = Math.sqrt(best);
        far = Math.max(far, dist[y * cols + x]);
      }
    this.delay = new Float32Array(n);
    this.gone = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const j = hash(k, 5);
      this.delay[k] = order[k] >= 0 ? 0.02 + order[k] * 0.04 + 0.02 * j : 0.34 + 0.38 * (dist[k] / far) + 0.03 * j;
      this.gone[k] = Math.max(this.delay[k] + 0.2, 0.55) + 0.04 * j;
    }
  }

  // One cell of the bloom at time T (0…1): HALFTONE, IMAGE (the image's
  // colour, this.rs of the cell) or GONE (the photo shows).
  cell(k, T) {
    if (T >= this.gone[k]) return GONE;
    const p = (T - this.delay[k]) / POP;
    if (p <= 0) return HALFTONE;
    this.rs = p >= 1 ? 1 : backOut(p); // a pop with an overshoot, like the loader's squares
    return IMAGE;
  }

  draw(now) {
    const e = Date.now() - this.revealAt;
    if (this.revealAt && e >= REVEAL_MS) {
      this.hidden = true;
      return cancelAnimationFrame(this.raf);
    }
    const { ctx, cols, rows, ox, oy, w, h, dpr, inks, hover, lx, ly } = this;
    const t = reduced() ? 0 : now / 1000;
    const T = this.revealAt && this.delay && e >= 0 ? e / REVEAL_MS : -1;
    const pitch = PITCH * dpr;
    const shimmerAt = ((t / SHIMMER) % 1) * 1.6 - 0.3; // the diagonal's position, 0…1 across
    const halftone = inks.map(() => new Path2D());
    const image = new Path2D();
    const clear = new Path2D(); // where the photo shows

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        // From the cell's own whole-pixel bounds, so full cells meet without a seam.
        const left = Math.round(x * pitch);
        const top = Math.round(y * pitch);
        const cw = Math.round((x + 1) * pitch) - left;
        const ch = Math.round((y + 1) * pitch) - top;
        const state = T >= 0 ? this.cell(y * cols + x, T) : HALFTONE;
        if (state === GONE) {
          clear.rect(left, top, cw, ch);
          continue;
        }
        let size; // 0…1 of the cell
        let path;
        let px = 0; // the lens's push, in device px
        let py = 0;
        if (state === IMAGE) {
          size = this.rs;
          path = image;
        } else {
          const cx = (x + 0.5) * PITCH;
          const cy = (y + 0.5) * PITCH;
          const i = x + ox;
          const j = y + oy;
          const drift = noise(i * 0.11 + t * 0.12, j * 0.11 - t * 0.08);
          const u = (cx + 0.6 * cy) / (w + 0.6 * h);
          const shimmer = Math.exp(-(((u - shimmerAt) / 0.12) ** 2));
          // Under the cursor the pixels swell and part, like a loupe on a print.
          let lens = 0;
          if (hover) {
            const dx = cx - lx;
            const dy = cy - ly;
            const d = Math.hypot(dx, dy) || 1;
            lens = hover * Math.exp(-((d / LENS) ** 2));
            // Pushed hardest mid-radius, not at the centre (that tore a hole).
            const push = lens * Math.min(1, d / LENS) * 0.7 * pitch;
            px = Math.round((dx / d) * push);
            py = Math.round((dy / d) * push);
          }
          size = clamp01(0.1 + 0.42 * smooth(drift) + 0.4 * shimmer + 0.75 * lens) * ((PITCH - 1) / PITCH);
          const ink = noise(i * 0.04 + t * 0.03 + 17.3, j * 0.04 - t * 0.02 + 5.1);
          path = halftone[Math.min(inks.length - 1, Math.floor(clamp01((ink - 0.2) / 0.6) * inks.length))];
        }
        const sw = Math.round(size * cw);
        const sh = Math.round(size * ch);
        if (sw < 1 || sh < 1) continue;
        path.rect(left + ((cw - sw) >> 1) + px, top + ((ch - sh) >> 1) + py, sw, sh);
      }

    ctx.setTransform(1, 0, 0, 1, 0, 0); // device pixels: every square lands on whole pixels
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.base;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = INK_ALPHA;
    halftone.forEach((path, k) => {
      ctx.fillStyle = inks[k];
      ctx.fill(path);
    });
    ctx.globalAlpha = 1;
    if (T < 0) return;
    // The photo where cells are done, then the image's pixels over it.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill(clear);
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.clip(image);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mosaic, 0, 0, this.cols * pitch, this.rows * pitch);
    ctx.restore();
  }
}

if (!customElements.get("archie-pixels")) customElements.define("archie-pixels", ArchiePixels);
