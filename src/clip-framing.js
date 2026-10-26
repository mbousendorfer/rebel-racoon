// Clip framing — the reframe engine of the Clips space (flag clipsSpace).
//
// A port of prod's crop-editor playground (content/studio/playgrounds/
// crop-editor/index.html), minus its DOM: the auto framing the backend computed
// for a clip (crop zones, camera cuts, faces) and the edits a user makes on top
// of it — split, One / Two / Fit layouts, zoom, move boundaries, reset. As in
// prod (platform#87544): no follow the speaker (it panned onto the largest
// face, not the framed person), no apply to every shot of a camera, no faces
// shown nor clicked, and in Two each window has its own zoom.
//
// Pure functions over plain data, so the clip cards (live previews) and the
// editor share one engine. Everything is in SOURCE-absolute ms and normalised
// source coordinates (0..1). A video's `analysis` covers the one window the
// backend analysed; outside it, `fallback` stands in for the auto framing —
// the playground's `autoFor()` already simulated `POST /clip-crops/preview`
// the same way.
//
//   segment = { id, startMs, endMs, layout: AUTO|ONE|TWO|FIT, origin: AUTO|USER,
//               one: {cx, cy, zoom}, two: {top: {cx, cy, zoom}, bottom},
//               auto, camera }

export const MIN_SEG_MS = 500;
const SNAP_MS = 300;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const median = (xs) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export const LAYOUTS = [
  { id: "AUTO", label: "Auto" },
  { id: "ONE", label: "One speaker" },
  { id: "TWO", label: "Two speakers" },
  { id: "FIT", label: "Fit" },
];

// ── Per-video context ────────────────────────────────────────────────

const contexts = new WeakMap();

// Faces become samples (biggest region = the speaker), and the distinct
// horizontal centres of the auto ONE windows become cameras A, B, C… — the
// playground's grouping, which is what "apply to every shot of this camera"
// reads.
export function framingContext(video) {
  if (contexts.has(video)) return contexts.get(video);
  const analysis = video.analysis || { fromMs: 0, toMs: 0, cutsMs: [], faces: [], segments: [] };
  const samples = (analysis.faces || []).map(([t, regions]) => {
    const big = regions.slice().sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
    return {
      t,
      regions,
      count: regions.length,
      cx: big ? big[0] + big[2] / 2 : null,
      cy: big ? big[1] + big[3] / 2 : null,
    };
  });
  const cameras = [];
  const ones = [...(analysis.segments || []), video.fallback].filter((a) => a && a.layout === "ONE");
  for (const a of ones) {
    const cx = a.one.x + a.one.w / 2;
    if (!cameras.some((c) => Math.abs(c.cx - cx) < 0.08)) cameras.push({ cx });
  }
  cameras.sort((a, b) => a.cx - b.cx).forEach((c, i) => (c.id = String.fromCharCode(65 + i)));
  const ctx = {
    W: video.width || 1920,
    H: video.height || 1080,
    samples,
    cuts: analysis.cutsMs || [],
    cameras,
    analysis,
    fallback: video.fallback || { mode: "CROP", layout: "ONE", one: { x: 0.34, y: 0, w: 0.32, h: 1 } },
  };
  contexts.set(video, ctx);
  return ctx;
}

// The window the backend actually analysed — the only stretch with real faces
// and cuts. The editor says so when a clip runs outside it.
function isAnalysed(ctx, startMs, endMs) {
  return startMs >= ctx.analysis.fromMs && endMs <= ctx.analysis.toMs;
}

// ── Auto framing ─────────────────────────────────────────────────────

// Stands in for POST /clip-crops/preview: the auto framing of an arbitrary
// range — the analysed segment overlapping most, recentred on the median face
// when the range moved; the fallback where nothing was analysed.
function autoFor(ctx, startMs, endMs) {
  const overlap = (a) => Math.min(a.endMs, endMs) - Math.max(a.startMs, startMs);
  const segs = ctx.analysis.segments || [];
  const best = segs.length ? segs.reduce((b, a) => (overlap(a) > overlap(b) ? a : b)) : null;
  if (!best || overlap(best) <= 0) return { ...clone(ctx.fallback), startMs, endMs };
  const auto = clone(best);
  if (auto.layout === "ONE" && !auto.pan) {
    const cx = median(ctx.samples.filter((s) => s.t >= startMs && s.t <= endMs && s.cx != null).map((s) => s.cx));
    if (cx != null && (startMs !== best.startMs || endMs !== best.endMs))
      auto.one.x = clamp(cx - auto.one.w / 2, 0, 1 - auto.one.w);
  }
  return auto;
}

const autoCx = (auto) => (auto.layout === "ONE" ? auto.one.x + auto.one.w / 2 : null);

function groupFor(ctx, auto) {
  if (auto.layout !== "ONE") return auto.layout;
  const cx = autoCx(auto);
  if (!ctx.cameras.length) return null;
  return ctx.cameras.reduce((best, c) => (Math.abs(c.cx - cx) < Math.abs(best.cx - cx) ? c : best)).id;
}

export function cameraName(id) {
  if (id === "TWO") return "Wide shot";
  if (id === "FIT") return "Fit";
  return id ? `Camera ${id}` : "—";
}

function defaultTwo(auto) {
  if (auto?.layout === "TWO") {
    const c = (r) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, zoom: clamp(1 / r.h, 1, 3) });
    return { top: c(auto.two.top), bottom: c(auto.two.bottom) };
  }
  return { top: { cx: 0.3, cy: 0.4, zoom: 1.8 }, bottom: { cx: 0.7, cy: 0.4, zoom: 1.8 } };
}

let uid = 0;
function makeSeg(ctx, startMs, endMs, auto, base) {
  const seg = base
    ? clone(base)
    : {
        layout: "AUTO",
        origin: "AUTO",
        one: { cx: autoCx(auto) ?? 0.5, cy: 0.5, zoom: 1 },
        two: defaultTwo(auto),
      };
  return Object.assign(seg, { id: `seg${++uid}`, startMs, endMs, auto, camera: groupFor(ctx, auto) });
}

// The auto segments of a clip: the analysed segments clipped to the range, and
// the fallback on whatever part of it lies outside the analysed window.
export function initialSegments(ctx, startMs, endMs) {
  const { fromMs, toMs } = ctx.analysis;
  const pieces = [];
  if (startMs < fromMs) pieces.push([startMs, Math.min(endMs, fromMs)]);
  for (const a of ctx.analysis.segments || []) {
    const s = Math.max(a.startMs, startMs);
    const e = Math.min(a.endMs, endMs);
    if (e - s > 0) pieces.push([s, e]);
  }
  if (endMs > toMs) pieces.push([Math.max(startMs, toMs), endMs]);
  if (!pieces.length) pieces.push([startMs, endMs]);
  // A sliver shorter than a segment may be is folded into its neighbour.
  const merged = [];
  for (const p of pieces.sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && p[1] - p[0] < MIN_SEG_MS) last[1] = p[1];
    else if (last && last[1] - last[0] < MIN_SEG_MS) last[1] = p[1];
    else merged.push([...p]);
  }
  return merged.map(([s, e]) => makeSeg(ctx, s, e, autoFor(ctx, s, e)));
}

// The clip was trimmed: drop what fell outside, stretch the edges, and let an
// untouched edge segment recompute its auto framing for its new range.
export function retrim(ctx, segments, startMs, endMs) {
  let segs = segments.filter((s) => s.endMs > startMs + MIN_SEG_MS / 2 && s.startMs < endMs - MIN_SEG_MS / 2);
  if (!segs.length) return initialSegments(ctx, startMs, endMs);
  segs = segs.map((s) => ({ ...s }));
  const first = segs[0];
  const last = segs[segs.length - 1];
  first.startMs = startMs;
  last.endMs = endMs;
  for (const s of new Set([first, last])) if (s.origin === "AUTO") s.auto = autoFor(ctx, s.startMs, s.endMs);
  return segs;
}

// ── Geometry ─────────────────────────────────────────────────────────

// A crop window centred on (cx, cy) at `zoom`, for an output pane of `aspect`
// (width / height), clamped inside the source.
function windowRect(ctx, cx, cy, zoom, aspect) {
  const k = ctx.H / ctx.W;
  const h = 1 / zoom;
  const w = h * aspect * k;
  const ww = Math.min(w, 1);
  const hh = ww < w ? ww / (aspect * k) : h;
  return { x: clamp(cx - ww / 2, 0, 1 - ww), y: clamp(cy - hh / 2, 0, 1 - hh), w: ww, h: hh };
}

function interpolate(points, t) {
  const after = points.findIndex((p) => p[0] >= t);
  if (after === 0) return points[0];
  if (after < 0) return points[points.length - 1];
  const a = points[after - 1];
  const b = points[after];
  const k = (t - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => v + (b[i] - v) * k);
}

// Two panes need a portrait output — the playground disables Two for
// landscape and square, so an auto or manual Two falls back to Fit there.
const twoFits = (ratio) => ratio < 1;

function resolveAuto(ctx, a, t, ratio) {
  if (a.layout === "FIT" || (a.layout === "TWO" && !twoFits(ratio))) return { kind: "fit", rects: [] };
  if (a.layout === "TWO") {
    const pane = ratio * 2;
    const r = (p) => windowRect(ctx, p.x + p.w / 2, p.y + p.h / 2, 1 / p.h, pane);
    return { kind: "two", rects: [r(a.two.top), r(a.two.bottom)], split: a.two.split || 0.5 };
  }
  let { x, y, w, h } = a.one;
  if (a.pan) [, x, y] = interpolate(a.pan, t);
  return { kind: "one", rects: [windowRect(ctx, x + w / 2, y + h / 2, 1 / h, ratio)] };
}

// What the output shows at `t`: one window, two stacked panes, or the whole
// frame fitted on a blurred fill.
export function resolve(ctx, seg, t, ratio) {
  if (seg.layout === "AUTO") return resolveAuto(ctx, seg.auto, t, ratio);
  if (seg.layout === "FIT" || (seg.layout === "TWO" && !twoFits(ratio))) return { kind: "fit", rects: [] };
  if (seg.layout === "TWO") {
    const pane = ratio * 2;
    return {
      kind: "two",
      split: 0.5,
      rects: [
        windowRect(ctx, seg.two.top.cx, seg.two.top.cy, seg.two.top.zoom, pane),
        windowRect(ctx, seg.two.bottom.cx, seg.two.bottom.cy, seg.two.bottom.zoom, pane),
      ],
    };
  }
  return { kind: "one", rects: [windowRect(ctx, seg.one.cx, seg.one.cy, seg.one.zoom, ratio)] };
}

export function segmentAt(segments, t) {
  return (
    segments.find((s) => t >= s.startMs && t < s.endMs) ||
    (t < segments[0].startMs ? segments[0] : segments[segments.length - 1])
  );
}

// Paint the reframed output of `video` at its current time onto a 2D context.
// The CDN serves no CORS headers, so the canvas is tainted: it is only ever
// drawn to, never read back.
export function drawOutput(c2d, video, ctx, res, ow, oh) {
  c2d.fillStyle = "#000";
  c2d.fillRect(0, 0, ow, oh);
  if (!video || video.readyState < 2) return;
  const { W, H } = ctx;
  const src = (r) => [r.x * W, r.y * H, r.w * W, r.h * H];
  if (res.kind === "one") c2d.drawImage(video, ...src(res.rects[0]), 0, 0, ow, oh);
  else if (res.kind === "two") {
    const split = Math.round(oh * res.split);
    c2d.drawImage(video, ...src(res.rects[0]), 0, 0, ow, split);
    c2d.drawImage(video, ...src(res.rects[1]), 0, split, ow, oh - split);
    c2d.fillRect(0, split - 1, ow, 2);
  } else {
    const scale = Math.max(ow / W, oh / H);
    const fit = Math.min(ow / W, oh / H);
    c2d.filter = "blur(24px) brightness(.7)";
    c2d.drawImage(video, (ow - W * scale) / 2, (oh - H * scale) / 2, W * scale, H * scale);
    c2d.filter = "none";
    c2d.drawImage(video, (ow - W * fit) / 2, (oh - H * fit) / 2, W * fit, H * fit);
  }
}

// ── Faces (read, never shown) ────────────────────────────────────────

function maxFacesIn(ctx, a, b) {
  return Math.max(0, ...ctx.samples.filter((s) => s.t >= a - 500 && s.t <= b + 500).map((s) => s.count));
}

// Why Two is off for this segment, in words — or "" when it is available.
export function twoBlockedReason(ctx, seg, ratio) {
  if (!twoFits(ratio)) return "Two speakers needs a portrait format";
  if (
    seg.auto.layout !== "TWO" &&
    isAnalysed(ctx, seg.startMs, seg.endMs) &&
    maxFacesIn(ctx, seg.startMs, seg.endMs) < 2
  )
    return "Only one face in this part";
  return "";
}

// ── Edits (each mutates the segments it is given) ────────────────────

export function toManual(ctx, seg, t, ratio) {
  seg.origin = "USER";
  if (seg.auto.layout === "TWO" && twoFits(ratio)) {
    seg.layout = "TWO";
    seg.two = defaultTwo(seg.auto);
    return;
  }
  seg.layout = "ONE";
  const r = resolveAuto(ctx, seg.auto, t, ratio).rects[0];
  seg.one = r ? { cx: r.x + r.w / 2, cy: r.y + r.h / 2, zoom: clamp(1 / r.h, 1, 2.5) } : { cx: 0.5, cy: 0.5, zoom: 1 };
}

export function setLayout(ctx, seg, layout, t, ratio) {
  if (layout === "ONE" && seg.layout === "AUTO") {
    toManual(ctx, seg, t, ratio);
    if (seg.layout === "TWO")
      seg.one = { cx: seg.two.top.cx, cy: seg.two.top.cy, zoom: clamp(seg.two.top.zoom, 1, 2.5) };
  }
  if (layout === "TWO" && seg.auto.layout !== "TWO") {
    const s = ctx.samples.find((x) => x.t >= seg.startMs - 500 && x.t <= seg.endMs + 500 && x.count >= 2);
    if (s) {
      const faces = s.regions
        .slice()
        .sort((a, b) => b[2] * b[3] - a[2] * a[3])
        .slice(0, 2)
        .map(([x, y, w, h]) => ({ cx: x + w / 2, cy: y + h / 2, zoom: 1.8 }))
        .sort((a, b) => a.cx - b.cx);
      seg.two.top = faces[0];
      seg.two.bottom = faces[1];
    }
  }
  seg.layout = layout;
  seg.origin = layout === "AUTO" ? "AUTO" : "USER";
}

export function snapMs(ctx, t, { on = true, radiusMs = SNAP_MS } = {}) {
  if (!on || !ctx.cuts.length) return { t, snapped: false };
  const cut = ctx.cuts.reduce((b, c) => (Math.abs(c - t) < Math.abs(b - t) ? c : b), Infinity);
  return Math.abs(cut - t) <= Math.max(SNAP_MS, radiusMs) ? { t: cut, snapped: true } : { t, snapped: false };
}

// Split the segment under `t` in two; each half keeps the edits and gets the
// auto framing of its own range. Returns false when a half would be too short.
export function split(ctx, segments, t) {
  const seg = segmentAt(segments, t);
  if (t - seg.startMs < MIN_SEG_MS || seg.endMs - t < MIN_SEG_MS) return false;
  const i = segments.indexOf(seg);
  segments.splice(
    i,
    1,
    makeSeg(ctx, seg.startMs, t, autoFor(ctx, seg.startMs, t), seg),
    makeSeg(ctx, t, seg.endMs, autoFor(ctx, t, seg.endMs), seg),
  );
  return true;
}

export function merge(ctx, segments, seg, dir) {
  const i = segments.indexOf(seg);
  const j = i + dir;
  if (j < 0 || j >= segments.length) return false;
  const other = segments[j];
  const start = Math.min(seg.startMs, other.startMs);
  const end = Math.max(seg.endMs, other.endMs);
  segments.splice(Math.min(i, j), 2, makeSeg(ctx, start, end, autoFor(ctx, start, end), seg));
  return true;
}

// Move the boundary between segments[k-1] and segments[k] to `t`.
export function moveBoundary(ctx, segments, k, t) {
  const left = segments[k - 1];
  const right = segments[k];
  const v = clamp(t, left.startMs + MIN_SEG_MS, right.endMs - MIN_SEG_MS);
  left.endMs = v;
  right.startMs = v;
  return v;
}

export function settleBoundary(ctx, segments, k) {
  const left = segments[k - 1];
  const right = segments[k];
  left.auto = autoFor(ctx, left.startMs, left.endMs);
  right.auto = autoFor(ctx, right.startMs, right.endMs);
}

export function resetSegment(ctx, seg) {
  const fresh = makeSeg(ctx, seg.startMs, seg.endMs, autoFor(ctx, seg.startMs, seg.endMs));
  Object.assign(seg, fresh, { id: seg.id });
}
