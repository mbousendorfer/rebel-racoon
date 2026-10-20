// <archie-pixels> — the Image Generator's loader and reveal, one element.
// Picked 2026-10-08 ("1e") after a long exploration — every rejected direction
// is listed in docs/reference/UI-PATTERNS.md, so it isn't proposed again.
//
// Waiting: a blurred field of soft clouds in Archie's warm colours — orange,
// butter yellow and a deep orange, saturated, drifting (the CSS holds them;
// the Playbook's own palette read as dull grey) — under a fine matrix of square
// white pixels, all one size. Only their opacity moves, each pixel at its own
// slow random rhythm, mostly dim, a few bright, with a soft swell now and
// then: contrast and life, but nothing travels (a diagonal light wave, a cursor
// that made ripples, navy — as pixels, then as a cloud — and pixels sized by
// the colour were all tried and dropped, 2026-10-08). A pill narrates the
// stages — the conversation's working status pill (the DS .ap-status shape),
// on navy so the orange sheen passing through its butter words stands out.
// `data-since` (an epoch ms, when the work began) keeps a re-rendered copy on
// the right stage.
//
// Arriving (`data-reveal-at`, an epoch ms): the element covers the <img> its
// host already rendered, and plays the arrival on its own copy of it, like a
// lens finding its focus — very blurred, red and blue pulled apart and
// converging, a zoom that breathes a hair past its mark, a vignette lifting —
// while the pixels take the image's colours (a pixel preview over the blur) and
// dissolve from the centre out, the matrix rising toward you. Then it fades
// onto the real thing (DOM text layers included) and hides.
//
// Everything is a function of the clock, never of how long the element has
// lived: the hosts re-render by innerHTML, so a fresh copy picks the wait (or
// the arrival) up where the one it replaced left it. A host renders the reveal
// only while `Date.now() - at < REVEAL_MS`. Reduced motion: one still frame,
// and no reveal.

const PITCH = 7; // CSS px between pixels
const SIZE = 3.4; // CSS px: every pixel's side while waiting — only their opacity moves
export const REVEAL_MS = 1600; // 1.4 s went by unseen, 2.6 s dragged, 2 s still a touch slow
const STAGES = ["Reading the post…", "Picking your colors…", "Composing the image…"];
const STAGE_S = 1.6; // s per stage, for a real 6–12 s wait; the last one holds until the image lands
const REFINING = "Refining the details…";
const NARRATE_MIN = 220; // CSS px: narrower (a filmstrip tile) and there is no line
// `data-ripple`: a click sends a ring out through the matrix.
const RIPPLE_SPEED = 650; // CSS px / s
const RIPPLE_LIFE = 1.8; // s, until it has faded out
const RIPPLE_WIDTH = 44; // CSS px: the crest's half-thickness
const RIPPLE_MAX = 4; // rings alive at once — older ones give way
const RIPPLE_WOBBLE = 0.22; // how far the ring strays from a circle, ± of its radius

// A ring's shape: a few harmonics around the circle, drawn at random per click
// and drifting as it spreads, so no two rings share an outline and none is round.
const wobble = () =>
  [2, 3, 5, 7].map((n) => ({
    n,
    amp: (0.35 + 0.65 * Math.random()) / n ** 0.6,
    phase: Math.random() * 6.283,
    drift: (Math.random() - 0.5) * 3,
  }));

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (t) => 1 - (1 - t) ** 3;
const backOut = (t, s) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
// 0…1 from an integer, neighbours independent (murmur3's finaliser): a plain
// multiply-and-modulo left neighbouring pixels in step — it read as one in two.
const hash = (k) => {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Any CSS colour → "#rrggbb", by letting a canvas normalise it.
let probe;
function hexOf(color) {
  probe ||= document.createElement("canvas").getContext("2d");
  probe.fillStyle = "#000";
  probe.fillStyle = String(color).trim();
  return probe.fillStyle.startsWith("#") ? probe.fillStyle : "#888888";
}

// The field: three warm clouds, drifting (t in s, absolute — continuous across
// copies), drawn by CSS.
function clouds(t, inks) {
  const a = t * 0.85; // drifting a little faster than at first: the wait has some life
  return [
    { x: 50 + 22 * Math.cos(a), y: 45 + 18 * Math.sin(a * 1.3), rx: 40, ry: 50, c: inks[1], k: 0.9 },
    { x: 45 + 25 * Math.sin(a * 0.8), y: 60 + 15 * Math.cos(a), rx: 35, ry: 45, c: inks[0], k: 0.9 },
    { x: 55 + 20 * Math.cos(a * 1.1 + 2), y: 50 + 20 * Math.sin(a * 0.7), rx: 45, ry: 55, c: inks[2], k: 0.6 },
  ];
}
const cloudsCss = (cs) =>
  cs
    .map(
      (c) =>
        `radial-gradient(${c.rx}% ${c.ry}% at ${c.x}% ${c.y}%, ${c.c}${Math.round(c.k * 255).toString(16)}, transparent)`,
    )
    .join(", ");

let filters = 0;

class ArchiePixels extends HTMLElement {
  connectedCallback() {
    this.revealAt = Number(this.dataset.revealAt) || 0;
    this.since = Number(this.dataset.since) || Date.now();
    if (this.revealAt) {
      this.source = this.parentElement?.querySelector("img");
      if (!this.source || reduced() || Date.now() - this.revealAt >= REVEAL_MS) return void (this.hidden = true);
    }
    if (!this.dots) this.build();
    const css = getComputedStyle(this);
    this.inks = [1, 2, 3].map((n) => hexOf(css.getPropertyValue(`--archie-pixels-cloud-${n}`)));
    // `--archie-pixels-ink`: the matrix's colour while waiting — white by default
    // (on the saturated clouds); a host on a pale ground sets a tint so it shows.
    const ink = css.getPropertyValue("--archie-pixels-ink").trim();
    const rgbOf = (c) => (hexOf(c).match(/[0-9a-f]{2}/gi) || []).map((h) => parseInt(h, 16));
    this.ink = ink ? rgbOf(ink).join(",") : "255,255,255";
    // `--archie-pixels-glow` (`data-ripple`): the colour the wave takes the
    // pixels to — the ink's own when unset.
    const glow = css.getPropertyValue("--archie-pixels-glow").trim();
    this.inkRgb = ink ? rgbOf(ink) : [255, 255, 255];
    this.glowRgb = glow ? rgbOf(glow) : this.inkRgb;
    if (this.revealAt) {
      // With CORS first, so the pixels can read the image's colours; without it
      // if the host refuses (the pixels then stay white).
      const src = this.source.currentSrc || this.source.src;
      const cors = /^https?:/.test(src) && new URL(src).origin !== location.origin;
      const load = (withCors) => {
        if (withCors) this.photo.crossOrigin = "anonymous";
        else this.photo.removeAttribute("crossorigin");
        this.photo.src = src;
        return this.photo.decode();
      };
      load(cors)
        .catch(() => (cors ? load(false) : Promise.reject()))
        .then(
          () => {
            this.ready = true;
            this.sample();
          },
          () => (this.hidden = true),
        );
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this);
    // `data-ripple` (a backdrop the reader clicks around — the new chat's halo):
    // a press anywhere over the element sends a ring out from that point, the
    // pixels on its crest coming up and swelling as it passes, fading as it
    // spreads. Read from the window, because a backdrop takes no pointer events
    // itself — so a click in the composer above it starts one too.
    this.ripples = [];
    if (this.hasAttribute("data-ripple") && !reduced()) {
      this.onPress = (e) => {
        const r = this.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        if (x < 0 || y < 0 || x > r.width || y > r.height) return;
        this.ripples = [...this.ripples, { x, y, at: performance.now(), shape: wobble() }].slice(-RIPPLE_MAX);
        this.toggleAttribute("data-rippling", true); // a host can lift the field while a ring runs
      };
      window.addEventListener("pointerdown", this.onPress, { passive: true });
    }
    if (!reduced()) this.raf = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    if (this.onPress) window.removeEventListener("pointerdown", this.onPress);
  }

  build() {
    const id = `archie-pixels-chroma-${++filters}`;
    this.insertAdjacentHTML(
      "afterbegin",
      `<div class="archie-pixels__field"></div>
      <img class="archie-pixels__image" alt="" aria-hidden="true" />
      <div class="archie-pixels__vignette"></div>
      <canvas class="archie-pixels__dots" aria-hidden="true"></canvas>
      <span class="ap-status is-working archie-pixels__label" hidden><span class="archie-pixels__line"></span></span>
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
    this.line = this.label.firstElementChild;
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
    // `data-quiet`: the field alone, no narration (a backdrop, not a wait).
    this.label.hidden = this.hasAttribute("data-quiet") || w < NARRATE_MIN;
    this.sample();
    this.render(performance.now());
  }

  // The image's colour under each pixel — what the pixels take on as it arrives.
  // None if the image can't be read (the pixels then stay white).
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
    this.render(now);
  };

  render(now) {
    const { w, h, ctx, cols, rows } = this;
    const t = reduced() ? 0 : now / 1000;
    const e = this.revealAt ? (Date.now() - this.revealAt) / REVEAL_MS : -1;
    const arriving = this.revealAt && this.ready && e >= 0;
    const p = arriving ? clamp(e) : 0;

    const cs = clouds(t, this.inks);
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
    this.vignette.style.opacity = arriving ? 1 - smooth(0.15, 0.85, p) : 0; // the lens only: on the wait, it muddied the yellow
    // onto the real image — only while arriving, so a host's CSS opacity holds on a wait
    if (this.revealAt) this.style.opacity = 1 - smooth(0.85, 1, p);

    // The matrix: square pixels of one size, each one's opacity on its own rhythm,
    // then carrying the image's colours away.
    this.dots.style.transform = `scale(${1 + 0.18 * focus})`;
    ctx.clearRect(0, 0, w, h);
    const take = smooth(0, 0.3, p);
    const far = Math.hypot(w, h) / 2;
    // The live rings: how far each has gone, how strong it still is.
    const waves = [];
    for (const r of this.ripples || []) {
      const age = (now - r.at) / 1000;
      if (age < RIPPLE_LIFE)
        waves.push({
          x: r.x,
          y: r.y,
          age,
          shape: r.shape,
          radius: RIPPLE_SPEED * age,
          k: (1 - age / RIPPLE_LIFE) ** 2,
        });
    }
    if (this.ripples?.length && !waves.length) {
      this.ripples = [];
      this.removeAttribute("data-rippling");
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const x = (i + 0.5) * PITCH;
        const y = (j + 0.5) * PITCH;
        // Its own random rhythm — a speed and a phase drawn once per pixel —
        // squared, so most pixels sit dim and a few come up bright: contrast.
        const own = 0.5 + 0.5 * Math.sin(t * (0.5 + 0.9 * hash(k)) + hash(k + 7919) * 6.283);
        // And now and then a soft swell: every 4–9 s, at its own moment, it rises
        // and falls over about a second (sharp flashes crackled, 2026-10-08).
        const period = 4 + 5 * hash(k + 104729);
        const since = (t + period * hash(k + 1299709)) % period;
        const flash = since < 1.2 ? Math.sin((Math.PI * since) / 1.2) ** 2 : 0;
        let side = SIZE;
        let a = Math.max(0.03 + 0.85 * own * own, flash * 0.85);
        let rgb = this.ink;
        if (waves.length) {
          let g = 0;
          let trough = 0;
          for (const v of waves) {
            const dx = x - v.x;
            const dy = y - v.y;
            const d = Math.hypot(dx, dy);
            if (Math.abs(d - v.radius) > v.radius * RIPPLE_WOBBLE * 1.6 + RIPPLE_WIDTH * 3) continue;
            // The radius in this pixel's direction: the harmonics, then a grain of
            // its own so the crest is ragged at the scale of the matrix.
            const angle = Math.atan2(dy, dx);
            let bend = 0;
            for (const h of v.shape) bend += h.amp * Math.sin(h.n * angle + h.phase + h.drift * v.age);
            const reach = v.radius * (1 + RIPPLE_WOBBLE * bend * 0.6) + (hash(k + 15485863) - 0.5) * RIPPLE_WIDTH;
            const off = (d - reach) / RIPPLE_WIDTH;
            if (off > -4 && off < 3) {
              g = Math.max(g, v.k * Math.exp(-off * off));
              // The trough just behind the crest goes quiet, the way water does —
              // the twinkle is already contrasted, so a crest alone barely reads.
              trough = Math.max(trough, v.k * Math.exp(-((off + 1.8) ** 2) / 0.8));
            }
          }
          if (trough > 0.01) a *= 1 - 0.85 * trough;
          if (g > 0.01) {
            a = lerp(a, 0.9 + 0.1 * own, g);
            side *= 1 + 0.5 * g;
            rgb = this.inkRgb.map((c, n) => Math.round(lerp(c, this.glowRgb[n], g))).join(",");
          }
        }
        if (arriving) {
          const c = k * 4;
          if (this.colors) rgb = [0, 1, 2].map((n) => Math.round(lerp(255, this.colors[c + n], take))).join(",");
          side = lerp(side, PITCH * 0.76, take);
          a = lerp(a, 0.5 + 0.4 * own, take); // still twinkling as it carries the image
          const from = Math.hypot(x - w / 2, y - h / 2) / far;
          side *= 1 - smooth(0.3 + 0.4 * from, 0.5 + 0.4 * from, p); // dissolving from the centre out
        }
        if (side < 0.4) continue;
        const half = side / 2;
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.beginPath();
        ctx.roundRect(x - half, y - half, half * 2, half * 2, half * 0.25);
        ctx.fill();
      }

    // The narration: its stages, then "Refining the details…" as the image arrives.
    if (this.label.hidden) return;
    const stage = Math.min(STAGES.length - 1, Math.floor((Date.now() - this.since) / 1000 / STAGE_S));
    const text = this.revealAt ? REFINING : STAGES[stage];
    if (this.line.textContent !== text) this.line.textContent = text;
    this.label.style.opacity = this.revealAt ? 1 - smooth(0.35, 0.5, p) : 1;
  }
}

if (!customElements.get("archie-pixels")) customElements.define("archie-pixels", ArchiePixels);
