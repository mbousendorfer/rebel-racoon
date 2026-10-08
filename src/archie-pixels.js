// <archie-pixels> — the Image Generator's loader and reveal, one element.
//
// Waiting: a fine halftone — rounded squares on a 4px grid — in the colours
// the image will be made of (`data-colors`, the Playbook's palette, blended
// smoothly; a grey ink without one), light on a light base. Only the squares'
// SIZE moves: a slow drift and a soft diagonal shimmer. Under the cursor, an
// optical loupe: the field is magnified, squares bigger and further apart,
// trailing the cursor softly. It is the loader: no spinner over it, only a
// label the host may nest.
//
// Arriving (`data-reveal-at`, an epoch ms) — a quadtree: the overlay covers
// the <img> its host already rendered beneath it and resolves into it by
// recursive subdivision, each block the image's own average there (a mip
// level), splitting EARLIER where the image has detail — faces and edges
// sharpen first, flat walls last — with hairline seams and a glint on each
// split of the big blocks; then it fades onto the real thing (its DOM text
// layers included). Picked 2026-10-08 over a refined Archie bloom and a
// diffusion-style focus pull; before that a left-to-right wave, a halftone
// "print" and a split-flap ripple were turned down.
//
//   ┌───────┬───────┐   ┌───┬───┬───────┐   ┌─┬─┬─┬─┬───────┐
//   │       │       │ → ├─┬─┼───┤       │ → ├─┼─┼─┼─┤ (flat) │ → the photo
//   └───────┴───────┘   └─┴─┴───┴───────┘   └─┴─┴─┴─┴───────┘
//
// Everything is a function of the clock, never of how long the element has
// lived: the hosts re-render by innerHTML, so a fresh copy picks the field (or
// the reveal) up exactly where the one it replaced left it. A host renders the
// reveal only while `Date.now() - at < REVEAL_MS`. Reduced motion: one still
// frame, and no reveal at all.
//
// One fragment shader, per device pixel (the 2D-canvas version, square by
// square, was too coarse). ONE WebGL2 context for every instance — browsers
// cap live contexts at ~16 and the studio re-renders often — drawn into a
// shared canvas, then copied into each element's own 2D canvas. Without
// WebGL2: a plain base colour, and no reveal.

const PITCH = 4; // CSS px from one square to the next
export const REVEAL_MS = 1900;
const INK_ALPHA = 0.45; // the halftone is a tint, never the full ink
const SHIMMER = 2.6; // s per pass
const LENS = 64; // CSS px: the loupe's radius
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// The cursor, shared by every instance — one listener, not one per element —
// in client coordinates; null once it leaves the window.
let pointer = null;
addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }), { passive: true });
addEventListener("pointerout", (e) => {
  if (!e.relatedTarget) pointer = null;
});

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;       // device px
uniform vec2 u_page;      // the element's page offset, device px: the field lives in page space
uniform float u_pitch;    // device px
uniform float u_time;     // s
uniform float u_shimmer;  // the diagonal's position, 0…1 across
uniform vec3 u_lens;      // x, y (device px), strength 0…1
uniform float u_lensR;
uniform vec3 u_base, u_ink0, u_ink1, u_ink2;
uniform float u_inkAlpha;
uniform float u_T;        // reveal progress 0…1; < 0: none
uniform sampler2D u_img;
uniform vec2 u_uvScale, u_uvOffset;
uniform float u_texel;    // image texels per device px
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec3 palette(float h) { return mix(mix(u_ink0, u_ink1, smoothstep(.25, .5, h)), u_ink2, smoothstep(.55, .8, h)); }
vec3 image(vec2 p, float lod) { return textureLod(u_img, p / u_res * u_uvScale + u_uvOffset, lod).rgb; }
float lodFor(float px) { return log2(max(px * u_texel, 1.)); }
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
// An anti-aliased rounded square: coverage at f (from its centre), half-size h, corner r; aa = px per unit.
float box(vec2 f, float h, float r, float aa) {
  vec2 d = abs(f) - vec2(h - r);
  float sd = length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r;
  return clamp(.5 - sd * aa, 0., 1.);
}

// The loader's halftone at p (local device px), through the loupe.
vec3 halftone(vec2 p, out float size) {
  vec2 c = u_lens.xy;
  float k = u_lens.z * exp(-pow(length(p - c) / u_lensR, 2.)) * .45;
  vec2 q = c + (p - c) * (1. - k); // magnified around the cursor
  vec2 g = (q + u_page) / u_pitch, cell = floor(g);
  vec2 lc = (cell + .5) * u_pitch - u_page;
  float drift = noise(cell * .07 + vec2(u_time * .09, -u_time * .06));
  float sh = exp(-pow(((lc.x + .6 * lc.y) / (u_res.x + .6 * u_res.y) - u_shimmer) / .12, 2.));
  size = clamp(.1 + .48 * smoothstep(0., 1., drift) + .36 * sh, 0., 1.) * .82;
  float h = size * .5;
  float a = box((fract(g) - .5) * u_pitch, h * u_pitch, h * u_pitch * .45, 1. - k);
  vec3 ink = palette(noise(cell * .025 + vec2(u_time * .025 + 17.3, -u_time * .02 + 5.1)));
  return mix(u_base, ink, a * u_inkAlpha);
}

// quadtree: blocks split where the image has detail first; hairline seams; a glint on each split.
vec3 quadtree(vec2 p) {
  float top = ceil(log2(max(u_res.x, u_res.y))) - 3.; // first blocks: ~1/8 of the long side
  float L = top, split = 0., last = 0., size = 1.;
  vec2 bc = p;
  for (int i = 0; i < 14; i++) {
    if (L < 0.) break;
    size = exp2(L);
    vec2 b = floor(p / size);
    bc = (b + .5) * size;
    vec3 m = image(bc, lodFor(size));
    float d = 0.;
    for (int c = 0; c < 4; c++) {
      vec2 o = vec2(float(c & 1), float(c >> 1)) - .5;
      d += length(image(bc + o * size * .5, lodFor(size * .5)) - m);
    }
    float depth = (top - L) / top; // 0 coarsest … 1 one device px
    split = .03 + .78 * pow(depth, .8) - .14 * clamp(d * .7, 0., 1.) + .04 * hash(b + L * 17.); // time spent on the mid levels
    if (u_T < split) break;
    last = split;
    L -= 1.;
  }
  if (L < 0.) return image(p, 0.);
  vec3 col = image(bc, lodFor(size));
  vec2 e = min(fract(p / size), 1. - fract(p / size)) * size; // device px to the block's edges
  // Seams and glints on the big blocks only: on small ones they read as salt noise.
  float big = smoothstep(8., 24., size);
  float seam = (1. - smoothstep(0., 1., min(e.x, e.y))) * big;
  col = mix(col, vec3(1.), seam * .3);
  return col + .2 * (1. - smoothstep(0., .05, u_T - last)) * step(.001, last) * smoothstep(4., 16., size);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); // top-left origin, like the DOM
  float s;
  vec3 col;
  if (u_T < 0.) col = halftone(p, s);
  else col = mix(halftone(p, s), quadtree(p), smoothstep(0., .06, u_T));
  float alpha = u_T < 0. ? 1. : 1. - smoothstep(.9, 1., u_T); // onto the real image
  outColor = vec4(col * alpha, alpha);
}`;

const UNIFORMS = [
  "u_res",
  "u_page",
  "u_pitch",
  "u_time",
  "u_shimmer",
  "u_lens",
  "u_lensR",
  "u_base",
  "u_ink0",
  "u_ink1",
  "u_ink2",
  "u_inkAlpha",
  "u_T",
  "u_img",
  "u_uvScale",
  "u_uvOffset",
  "u_texel",
];

// The one context, made on first use; null without WebGL2.
let shared;
function engine() {
  if (shared !== undefined) return shared;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, depth: false });
  if (!gl) return (shared = null);
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "a");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (shared = null);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const loc = Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(prog, u)]));
  gl.uniform1i(loc.u_img, 0);
  // A 1×1 stand-in, so the samplers always have something bound.
  const blank = texture(gl, 1, 1, gl.RGBA, new Uint8Array(4));
  return (shared = { gl, canvas, loc, blank });
}

function texture(gl, w, h, format, data) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, format === gl.RED ? gl.R8 : gl.RGBA, w, h, 0, format, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// Any CSS colour → [r, g, b] in 0…1, by letting a canvas normalise it.
let probe;
function rgbOf(color) {
  probe ||= document.createElement("canvas").getContext("2d");
  probe.fillStyle = "#000";
  probe.fillStyle = String(color).trim();
  const s = probe.fillStyle;
  const rgb = s[0] === "#" ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.match(/[\d.]+/g).slice(0, 3);
  return rgb.map((v) => Number(v) / 255);
}

class ArchiePixels extends HTMLElement {
  hover = 0; // 0…1, the loupe easing in and out
  lx = 0; // the loupe's centre, in CSS px, trailing the cursor
  ly = 0;

  connectedCallback() {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("aria-hidden", "true");
      this.prepend(this.canvas);
    }
    this.ctx = this.canvas.getContext("2d");
    const css = getComputedStyle(this);
    this.base = rgbOf(css.getPropertyValue("--archie-pixels-base"));
    const inks = (
      this.dataset.colors ? this.dataset.colors.split(",") : [css.getPropertyValue("--archie-pixels-ink")]
    ).map(rgbOf);
    this.inks = [0, 1, 2].map((i) => inks[Math.min(i, inks.length - 1)]);
    this.revealAt = Number(this.dataset.revealAt) || 0;

    if (!engine()) {
      if (this.revealAt) this.hidden = true;
      else this.style.background = css.getPropertyValue("--archie-pixels-base");
      return;
    }
    if (this.revealAt) {
      this.img = this.parentElement?.querySelector("img");
      if (!this.img || reduced() || Date.now() - this.revealAt >= REVEAL_MS) return void (this.hidden = true);
      this.img.decode().then(
        () => {
          this.ready = true;
          this.upload();
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
    const gl = shared?.gl;
    if (gl && this.tex) gl.deleteTexture(this.tex);
    this.tex = null;
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
    // The field lives in page space: side by side (the stage and its tiles),
    // each element is a window onto one field, not one picture twice.
    const box = this.getBoundingClientRect();
    this.page = [box.left * this.dpr, box.top * this.dpr];
    this.upload();
    this.render(performance.now());
  }

  // The image as a mipmapped texture (each mip level is its own average over
  // blocks: the quadtree's blocks) and its cover crop.
  upload() {
    if (!this.ready || !this.w) return;
    const { gl } = shared;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const iw = this.img.naturalWidth || W;
    const ih = this.img.naturalHeight || H;
    const box = W / H;
    const pic = iw / ih;
    const [sx, sy] = pic > box ? [box / pic, 1] : [1, pic / box];
    this.uv = [sx, sy, (1 - sx) / 2, (1 - sy) / 2];
    this.texel = (iw * sx) / W;
    if (!this.tex) {
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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

  // The loupe eases in where the cursor comes near, trails it, and fades out
  // when it leaves. Not during a reveal.
  follow() {
    if (this.revealAt || (!pointer && !this.hover)) return;
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
      this.lx += (x - this.lx) * 0.2;
      this.ly += (y - this.ly) * 0.2;
    }
    this.hover += ((near ? 1 : 0) - this.hover) * 0.08;
    if (this.hover < 0.003) this.hover = 0;
  }

  render(now) {
    const { gl, canvas, loc, blank } = shared;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (canvas.width < W) canvas.width = W; // the shared canvas only grows
    if (canvas.height < H) canvas.height = H;
    const t = reduced() ? 0 : now / 1000;
    const e = Date.now() - this.revealAt;
    const T = this.revealAt && this.ready && e >= 0 ? e / REVEAL_MS : -1;
    const dpr = this.dpr;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(loc.u_res, W, H);
    gl.uniform2f(loc.u_page, ...this.page);
    gl.uniform1f(loc.u_pitch, PITCH * dpr);
    gl.uniform1f(loc.u_time, t);
    gl.uniform1f(loc.u_shimmer, ((t / SHIMMER) % 1) * 1.6 - 0.3);
    gl.uniform3f(loc.u_lens, this.lx * dpr, this.ly * dpr, this.hover);
    gl.uniform1f(loc.u_lensR, LENS * dpr);
    gl.uniform3f(loc.u_base, ...this.base);
    gl.uniform3f(loc.u_ink0, ...this.inks[0]);
    gl.uniform3f(loc.u_ink1, ...this.inks[1]);
    gl.uniform3f(loc.u_ink2, ...this.inks[2]);
    gl.uniform1f(loc.u_inkAlpha, INK_ALPHA);
    gl.uniform1f(loc.u_T, T);
    const [sx, sy, ox, oy] = this.uv || [1, 1, 0, 0];
    gl.uniform2f(loc.u_uvScale, sx, sy);
    gl.uniform2f(loc.u_uvOffset, ox, oy);
    gl.uniform1f(loc.u_texel, this.texel || 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex || blank);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Copied in the same task, before the drawing buffer is presented and cleared.
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.drawImage(canvas, 0, canvas.height - H, W, H, 0, 0, W, H);
  }
}

if (!customElements.get("archie-pixels")) customElements.define("archie-pixels", ArchiePixels);
