// <archie-pixels> — the Image Generator's loader and reveal, one element.
// Picked 2026-10-08 ("1e") after a long exploration — every rejected direction
// is listed in docs/reference/UI-PATTERNS.md, so it isn't proposed again.
//
// Waiting: a blurred field of three soft clouds in the colours the image will
// be made of (`data-colors`, the Playbook's palette; a grey ink without one),
// drifting, under a fine dot matrix. The matrix is alive — a dot is bigger
// where the colour is dense, a light wave runs through it — and it answers
// the cursor: the dots swell under it, the field shifts in parallax. A line
// narrates the stages (`data-since`, an epoch ms, says when the work began, so
// a re-rendered copy stays on the right stage).
//
// Arriving (`data-reveal-at`, an epoch ms): the element covers the <img> its
// host already rendered, and plays the arrival on its own copy of it, like a
// lens finding its focus — very blurred, red and blue pulled apart and
// converging, a zoom that breathes a hair past its mark, a vignette lifting —
// while the dots take the image's colours (a pixel preview over the blur) and
// dissolve from the centre out, the matrix rising toward you. Then it fades
// onto the real thing (DOM text layers included) and hides.
//
// Everything is a function of the clock, never of how long the element has
// lived: the hosts re-render by innerHTML, so a fresh copy picks the wait (or
// the arrival) up where the one it replaced left it. A host renders the reveal
// only while `Date.now() - at < REVEAL_MS`. Reduced motion: one still frame,
// and no reveal.

const PITCH = 7; // CSS px between dots
export const REVEAL_MS = 1400;
const STAGES = ["Reading the post…", "Picking your colours…", "Composing the image…"];
const STAGE_S = 0.8; // s per stage; the last one holds until the image lands
const REFINING = "Refining the details…";
const LENS = 46; // CSS px: the cursor's reach on the matrix
const NARRATE_MIN = 220; // CSS px: narrower (a filmstrip tile) and there is no line

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (t) => 1 - (1 - t) ** 3;
const backOut = (t, s) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

// The cursor, shared by every instance — one listener, not one per element —
// in client coordinates; null once it leaves the window.
let pointer = null;
addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }), { passive: true });
addEventListener("pointerout", (e) => {
  if (!e.relatedTarget) pointer = null;
});

// Any CSS colour → "#rrggbb", by letting a canvas normalise it.
let probe;
function hexOf(color) {
  probe ||= document.createElement("canvas").getContext("2d");
  probe.fillStyle = "#000";
  probe.fillStyle = String(color).trim();
  return probe.fillStyle.startsWith("#") ? probe.fillStyle : "#888888";
}

// The field: three clouds, drifting (t in s, absolute — continuous across copies);
// px/py shift them in % for the parallax. Drawn by CSS, read back by the dots.
function clouds(t, inks, px, py) {
  const a = t * 0.6;
  return [
    { x: 50 + 22 * Math.cos(a) + px, y: 45 + 18 * Math.sin(a * 1.3) + py, rx: 40, ry: 50, c: inks[1], k: 0.6 },
    { x: 45 + 25 * Math.sin(a * 0.8) + px, y: 60 + 15 * Math.cos(a) + py, rx: 35, ry: 45, c: inks[2], k: 0.53 },
    {
      x: 55 + 20 * Math.cos(a * 1.1 + 2) + px,
      y: 50 + 20 * Math.sin(a * 0.7) + py,
      rx: 45,
      ry: 55,
      c: inks[0],
      k: 0.47,
    },
  ];
}
const cloudsCss = (cs) =>
  cs
    .map(
      (c) =>
        `radial-gradient(${c.rx}% ${c.ry}% at ${c.x}% ${c.y}%, ${c.c}${Math.round(c.k * 255).toString(16)}, transparent)`,
    )
    .join(", ");
const density = (cs, x, y) =>
  clamp(cs.reduce((s, c) => s + c.k * Math.exp(-(((x - c.x) / c.rx) ** 2) - ((y - c.y) / c.ry) ** 2), 0));

let filters = 0;

class ArchiePixels extends HTMLElement {
  hover = 0; // 0…1, the cursor's effect easing in and out
  lx = 0; // where it is, in CSS px, trailing the cursor
  ly = 0;

  connectedCallback() {
    this.revealAt = Number(this.dataset.revealAt) || 0;
    this.since = Number(this.dataset.since) || Date.now();
    if (this.revealAt) {
      this.source = this.parentElement?.querySelector("img");
      if (!this.source || reduced() || Date.now() - this.revealAt >= REVEAL_MS) return void (this.hidden = true);
    }
    if (!this.dots) this.build();
    const css = getComputedStyle(this);
    const inks = (
      this.dataset.colors ? this.dataset.colors.split(",") : [css.getPropertyValue("--archie-pixels-ink")]
    ).map(hexOf);
    this.inks = [0, 1, 2].map((i) => inks[Math.min(i, inks.length - 1)]);
    if (this.revealAt) {
      this.photo.src = this.source.currentSrc || this.source.src;
      this.photo.decode().then(
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

  build() {
    const id = `archie-pixels-chroma-${++filters}`;
    this.insertAdjacentHTML(
      "afterbegin",
      `<div class="archie-pixels__field"></div>
      <img class="archie-pixels__image" alt="" aria-hidden="true" />
      <div class="archie-pixels__vignette"></div>
      <canvas class="archie-pixels__dots" aria-hidden="true"></canvas>
      <span class="archie-pixels__label" hidden><span class="archie-pixels__steps">${"<i></i>".repeat(4)}</span><span></span></span>
      <svg class="archie-pixels__filter" aria-hidden="true"><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feColorMatrix in="SourceGraphic" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset in="r" result="ro"/>
        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/><feOffset in="b" result="bo"/>
        <feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/>
      </filter></svg>`,
    );
    this.field = this.querySelector(".archie-pixels__field");
    this.photo = this.querySelector(".archie-pixels__image");
    this.vignette = this.querySelector(".archie-pixels__vignette");
    this.dots = this.querySelector(".archie-pixels__dots");
    this.ctx = this.dots.getContext("2d");
    this.label = this.querySelector(".archie-pixels__label");
    this.steps = [...this.label.querySelectorAll("i")];
    this.line = this.label.lastElementChild;
    this.chroma = { url: `url(#${id})`, offsets: this.querySelectorAll("feOffset") };
  }

  resize() {
    const w = this.clientWidth;
    const h = this.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    this.w = w;
    this.h = h;
    this.dots.width = Math.round(w * dpr);
    this.dots.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cols = Math.ceil(w / PITCH);
    this.rows = Math.ceil(h / PITCH);
    this.label.hidden = w < NARRATE_MIN;
    this.sample();
    this.render(performance.now());
  }

  // The image's colour under each dot — what the dots take on as it arrives.
  // None if the image can't be read (the dots then stay white).
  sample() {
    if (!this.ready || !this.cols) return;
    const c = document.createElement("canvas");
    c.width = this.cols;
    c.height = this.rows;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const { naturalWidth: iw, naturalHeight: ih } = this.photo;
    const s = Math.max(this.cols / iw, this.rows / ih);
    ctx.drawImage(
      this.photo,
      (iw - this.cols / s) / 2,
      (ih - this.rows / s) / 2,
      this.cols / s,
      this.rows / s,
      0,
      0,
      this.cols,
      this.rows,
    );
    try {
      this.colors = ctx.getImageData(0, 0, this.cols, this.rows).data;
    } catch {
      this.colors = null;
    }
  }

  tick = (now) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.w) return;
    if (this.revealAt && Date.now() - this.revealAt >= REVEAL_MS) {
      this.hidden = true;
      return cancelAnimationFrame(this.raf);
    }
    this.follow();
    this.render(now);
  };

  // The cursor's effect eases in where it comes near, trails it, fades out when it leaves.
  follow() {
    if (!pointer && !this.hover) return;
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
      if (this.hover < 0.02) [this.lx, this.ly] = [x, y];
      this.lx += (x - this.lx) * 0.2;
      this.ly += (y - this.ly) * 0.2;
    }
    this.hover += ((near ? 1 : 0) - this.hover) * 0.12;
    if (this.hover < 0.003) this.hover = 0;
  }

  render(now) {
    const { w, h, ctx, cols, rows } = this;
    const t = reduced() ? 0 : now / 1000;
    const e = this.revealAt ? (Date.now() - this.revealAt) / REVEAL_MS : -1;
    const arriving = this.revealAt && this.ready && e >= 0;
    const p = arriving ? clamp(e) : 0;

    // The field, shifted a little away from the cursor.
    const px = -(this.lx / w - 0.5) * 8 * this.hover;
    const py = -(this.ly / h - 0.5) * 8 * this.hover;
    const cs = clouds(t, this.inks, px, py);
    this.field.style.backgroundImage = cloudsCss(cs);
    this.field.style.opacity = 1 - smooth(0, 0.5, p);

    // The image, finding its focus.
    const focus = outCubic(p);
    const split = 7 * (1 - focus) * smooth(0, 0.15, p);
    this.chroma.offsets[0].setAttribute("dx", -split);
    this.chroma.offsets[1].setAttribute("dx", split);
    this.photo.style.opacity = arriving ? smooth(0, 0.2, p) : 0;
    this.photo.style.filter = `${split > 0.05 ? this.chroma.url : ""} blur(${28 * (1 - focus)}px)`;
    this.photo.style.transform = `scale(${lerp(1.08, 1, backOut(p, 1.4))})`; // a hair past 1: the breath
    this.vignette.style.opacity = arriving ? 1 - smooth(0.15, 0.85, p) : 0.55;
    this.style.opacity = 1 - smooth(0.85, 1, p); // onto the real image

    // The matrix: alive, answering the cursor, then carrying the image's colours away.
    this.dots.style.transform = `scale(${1 + 0.18 * focus})`;
    ctx.clearRect(0, 0, w, h);
    const take = smooth(0, 0.3, p);
    const far = Math.hypot(w, h) / 2;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * PITCH;
        const y = (j + 0.5) * PITCH;
        const dense = density(cs, (x / w) * 100, (y / h) * 100);
        const wave = Math.max(0, Math.sin((x + 0.6 * y) / 38 - t * 2.6)) ** 6;
        let r = 0.45 + 1.7 * dense + 0.55 * wave;
        let a = 0.55 + 0.35 * dense + 0.2 * wave;
        if (this.hover) {
          const boost = this.hover * Math.exp(-((Math.hypot(x - this.lx, y - this.ly) / LENS) ** 2));
          r += 1.6 * boost;
          a = Math.min(1, a + 0.3 * boost);
        }
        let rgb = "255,255,255";
        if (arriving) {
          const k = (j * cols + i) * 4;
          if (this.colors) rgb = [0, 1, 2].map((n) => Math.round(lerp(255, this.colors[k + n], take))).join(",");
          r = lerp(r, PITCH * 0.42, take);
          a = lerp(a, 1, take);
          const from = Math.hypot(x - w / 2, y - h / 2) / far;
          r *= 1 - smooth(0.3 + 0.4 * from, 0.5 + 0.4 * from, p); // dissolving from the centre out
        }
        if (r < 0.2) continue;
        ctx.fillStyle = `rgba(${rgb},${a * 0.75})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

    // The narration: its stages, then "Refining the details…" as the image arrives.
    if (this.label.hidden) return;
    const stage = Math.min(STAGES.length - 1, Math.floor((Date.now() - this.since) / 1000 / STAGE_S));
    const text = this.revealAt ? REFINING : STAGES[stage];
    if (this.line.textContent !== text) this.line.textContent = text;
    const on = this.revealAt ? 4 : stage + 1;
    this.steps.forEach((s, i) => s.classList.toggle("is-on", i < on));
    this.label.style.opacity = this.revealAt ? 1 - smooth(0.35, 0.5, p) : 1;
  }
}

if (!customElements.get("archie-pixels")) customElements.define("archie-pixels", ArchiePixels);
