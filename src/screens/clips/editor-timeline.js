// The clip editor's timeline (editor.js): every track at once, full width,
// zoomable and scrollable over prod's ±2 min trim window around the clip.
//
//   Brand     logo bar · intro / outro cards
//   Text      one layer per text, packed into as many lanes as overlap
//   Captions  the subtitle lines, as the caption engine cuts them, and,
//             hatched, what the cleanup hid from them
//   Video     a filmstrip of the source, the framing parts, the camera cuts,
//             the clip's two edges — drag them to trim — and, along its foot,
//             a quiet waveform: a texture to read position by, as in prod's
//             clip editor (which never decodes the audio). No Audio track: prod
//             has none, and nothing in the clip edits sound.
//
// What follows the scroll (the ruler, the filmstrip, the waveform) is drawn on
// canvases the width of the view; the rest is DOM at absolute px. Two tools:
// Select (V) and Blade (B). Snapping (N) lines edges up with the clip's ends,
// the playhead, other texts, camera cuts and parts; Alt drags freely.

import {
  ed,
  seek,
  stop,
  select,
  pushUndo,
  dropNoopUndo,
  setDirty,
  paintFrame,
  paintTexts,
  paintInspector,
  later,
  clipLen,
  snapFrame,
  txById,
  selTexts,
  trimTo,
  refreshAll,
  addText,
  splitPartAt,
  splitTextAt,
  editPoints,
  fmtTC,
  FRAME_MS,
  MIN_TEXT_MS,
  MIN_CLIP_MS,
  CARD_MS,
} from "./editor.js?v=2934";
import {
  segmentAt,
  moveBoundary,
  settleBoundary,
  snapMs,
  cameraName,
  LAYOUTS,
  resolve,
  merge,
} from "../../clip-framing.js?v=2934";
import { ratioOf } from "./shared.js?v=2934";
import * as ce from "../../caption-editor.js?v=2934";
import { deriveCues } from "../../clip-captions.js?v=2934";
import { escapeHtml } from "../../utils.js?v=2934";
import { GLYPH } from "./editor-panels.js?v=2934";

const RULER_H = 32;
const FIT_PAD = 40; // px of air each side of the clip when fitted
const MAX_PX_PER_MS = 0.5; // one frame ≈ 20 px
const SNAP_PX = 8;
const LAYER_H = 28;
const LAYER_GAP = 6;

const x = (ms) => (ms - ed.range.from) * ed.tl.pxPerMs;
const scroller = () => ed.el.querySelector("[data-nle-scroll]");
const q = (sel) => ed.el.querySelector(sel);

export function msAt(clientX) {
  const r = q("[data-nle-inner]").getBoundingClientRect();
  return ed.range.from + (clientX - r.left) / ed.tl.pxPerMs;
}

// ── Rows ────────────────────────────────────────────────────────────

// Overlapping texts stack into lanes, the earliest first.
function packTexts() {
  const ends = [];
  const lane = {};
  [...ed.w.texts]
    .sort((a, b) => a.startMs - b.startMs)
    .forEach((tx) => {
      let i = ends.findIndex((end) => end <= tx.startMs);
      if (i < 0) {
        i = ends.length;
        ends.push(0);
      }
      ends[i] = tx.endMs;
      lane[tx.id] = i;
    });
  return { lane, n: Math.max(1, ends.length) };
}

function rows() {
  const tp = packTexts();
  const list = [
    {
      id: "brand",
      label: "Brand",
      icon: `<i class="ap-icon-target" aria-hidden="true"></i>`,
      h: 44,
      toggles: ["hidden", "locked"],
    },
    {
      id: "text",
      label: "Text",
      icon: GLYPH.text,
      h: tp.n * (LAYER_H + LAYER_GAP) + LAYER_GAP + 8,
      toggles: ["hidden", "locked"],
      tp,
    },
    {
      id: "captions",
      label: "Subtitles",
      icon: `<i class="ap-icon-closed-captions" aria-hidden="true"></i>`,
      h: 44,
      toggles: ["hidden", "locked"],
    },
    {
      id: "video",
      label: "Video",
      icon: `<i class="ap-icon-video" aria-hidden="true"></i>`,
      h: 96,
      toggles: ["locked"],
    },
  ];
  let top = RULER_H;
  for (const r of list) {
    r.top = top;
    top += r.h;
  }
  return list;
}

// ── Shell ───────────────────────────────────────────────────────────

export function timelineShellHTML() {
  return `
    <div class="nle-tl__bar" data-nle-tl-bar role="toolbar" aria-label="Timeline tools"></div>
    <div class="nle-tl__body">
      <div class="nle-tl__heads" data-nle-heads></div>
      <div class="nle-tl__scroll" data-nle-scroll>
        <div class="nle-tl__inner" data-nle-inner>
          <canvas class="nle-tl__cv nle-tl__cv--ruler" data-nle-ruler-cv aria-hidden="true"></canvas>
          <canvas class="nle-tl__cv" data-nle-film aria-hidden="true"></canvas>
          <canvas class="nle-tl__cv" data-nle-wave aria-hidden="true"></canvas>
          <div class="nle-tl__lanes" data-nle-lanes></div>
          <div class="nle-tl__over" data-nle-over></div>
          <div class="nle-tl__playhead" data-nle-playhead><span class="nle-tl__knob" data-nle-knob aria-hidden="true"></span></div>
          <span class="nle-tl__blade" data-nle-blade hidden></span>
        </div>
      </div>
    </div>`;
}

const tbtn = (act, label, inner, { kbd, pressed, disabled } = {}) =>
  `<button type="button" class="ap-icon-button transparent nle-ib${pressed != null ? " nle-ib--toggle" : ""}" data-nle="${act}"
    aria-label="${label}" data-tooltip="${label}${kbd ? ` · ${kbd}` : ""}"${pressed != null ? ` aria-pressed="${pressed}"` : ""}${disabled ? " disabled" : ""}>${inner}</button>`;

function barHTML() {
  const sel = ed.sel;
  const delLabel = !sel
    ? "Delete"
    : {
        text: sel.ids?.length > 1 ? "Delete texts" : "Delete text",
        seg: "Join this part with its neighbor",
        brand: `Remove ${{ logo: "logo", intro: "intro card", outro: "outro card" }[sel.item] || "item"}`,
      }[sel.kind] || "Delete";
  return `
    <div class="nle-tl__group" role="group" aria-label="Tools">
      ${tbtn("tool-select", "Select tool", `<i class="ap-icon-click" aria-hidden="true"></i>`, { kbd: "V", pressed: ed.tool === "select" })}
      ${tbtn("tool-blade", "Split tool: click a text or the video to split it", GLYPH.blade, { kbd: "B", pressed: ed.tool === "blade" })}
    </div>
    <span class="nle-tl__sep" aria-hidden="true"></span>
    <div class="nle-tl__group" role="group" aria-label="Edit">
      ${tbtn("split", "Split at the playhead", GLYPH.cut, { kbd: "S" })}
      ${tbtn("delete", delLabel, `<i class="ap-icon-trash" aria-hidden="true"></i>`, { kbd: "⌫", disabled: !sel || sel.kind === "captions" })}
      ${tbtn("set-in", "Set the clip's start at the playhead", GLYPH.markIn, { kbd: "I" })}
      ${tbtn("set-out", "Set the clip's end at the playhead", GLYPH.markOut, { kbd: "O" })}
    </div>
    <span class="nle-tl__sep" aria-hidden="true"></span>
    ${tbtn("snap", ed.snap ? "Snapping on" : "Snapping off", GLYPH.magnet, { kbd: "N", pressed: ed.snap })}
    <span class="nle-tl__status" data-nle-tl-status>${statusText()}</span>
    <div class="nle-tl__group nle-tl__group--end" role="group" aria-label="Zoom">
      ${tbtn("zoom-out", "Zoom out", `<i class="ap-icon-minus" aria-hidden="true"></i>`, { kbd: "⌘−" })}
      <input type="range" class="ap-slider nle-tl__zoom" min="0" max="100" step="1" data-nle-zoom aria-label="Timeline zoom" />
      ${tbtn("zoom-in", "Zoom in", `<i class="ap-icon-plus" aria-hidden="true"></i>`, { kbd: "⌘+" })}
      <button type="button" class="ap-button ghost grey nle-tl__fit" data-nle="zoom-fit" data-tooltip="Fit the clip to the timeline · ⇧Z"><span>Fit</span></button>
      <span class="nle-tl__sep" aria-hidden="true"></span>
      ${tbtn("keys", "Keyboard shortcuts", `<i class="ap-icon-keyboard" aria-hidden="true"></i>`, { kbd: "?" })}
    </div>`;
}

// What the selection is, said in the bar (a status line, like Premiere's).
function statusText() {
  const s = ed.sel;
  if (!s) return ed.tool === "blade" ? "Split tool: click a text or the video to split it there." : "";
  if (s.kind === "text") return s.ids.length > 1 ? `${s.ids.length} texts selected` : "1 text selected";
  if (s.kind === "seg") {
    const i = ed.w.segments.findIndex((g) => g.id === s.id);
    return `Part ${i + 1} of ${ed.w.segments.length} selected`;
  }
  return { captions: "Subtitles selected", brand: "Brand item selected" }[s.kind] || "";
}

const TOGGLE = {
  hidden: (on, label) => [
    on ? `Show ${label}` : `Hide ${label}`,
    on ? `<i class="ap-icon-eye-off" aria-hidden="true"></i>` : `<i class="ap-icon-eye-on" aria-hidden="true"></i>`,
  ],
  locked: (on, label) => [
    on ? `Unlock ${label}` : `Lock ${label}`,
    on ? `<i class="ap-icon-lock-on" aria-hidden="true"></i>` : `<i class="ap-icon-lock-off" aria-hidden="true"></i>`,
  ],
};

function headHTML(r) {
  const st = ed.tracks[r.id];
  const tools = r.toggles
    .map((k) => {
      const [label, icon] = TOGGLE[k](!!st[k], r.label.toLowerCase());
      return `<button type="button" class="ap-icon-button transparent nle-ib nle-ib--sm${st[k] ? " is-on" : ""}" data-nle-track-toggle="${r.id}:${k}"
        aria-pressed="${!!st[k]}" aria-label="${label}" data-tooltip="${label}">${icon}</button>`;
    })
    .join("");
  const selectable = r.id === "captions" ? "captions" : null;
  return `<div class="nle-head${st.locked ? " is-locked" : ""}${st.hidden ? " is-dim" : ""}" style="height:${r.h}px">
    ${selectable ? `<button type="button" class="nle-head__name" data-nle-select="${selectable}">` : `<span class="nle-head__name">`}
      <span class="nle-head__icon">${r.icon}</span><span>${r.label}</span>
    ${selectable ? "</button>" : "</span>"}
    <span class="nle-head__tools">${tools}</span>
  </div>`;
}

// ── Lanes ───────────────────────────────────────────────────────────

function clipEdges() {
  const d = ed.drag;
  return d?.kind === "trim" ? { s: d.s, e: d.e } : { s: ed.w.startMs, e: ed.w.endMs };
}

function laneHTML(r) {
  const { s, e } = clipEdges();
  const L = `left:${x(s)}px;width:${x(e) - x(s)}px`;
  const st = ed.tracks[r.id];
  const cls = `nle-lane nle-lane--${r.id}${st.locked ? " is-locked" : ""}${st.hidden ? " is-dim" : ""}`;
  const body = {
    brand: brandLane,
    text: () => textLane(r.tp),
    captions: captionLane,
    video: videoLane,
  }[r.id]();
  return `<div class="${cls}" data-nle-lane="${r.id}" style="top:${r.top}px;height:${r.h}px">
    <div class="nle-lane__clip" style="${L}"></div>${body}</div>`;
}

const span = (from, to) => `left:${x(from)}px;width:${Math.max(2, x(to) - x(from))}px`;

function brandLane() {
  const b = ed.w.brand;
  const s = ed.w.startMs;
  const e = ed.w.endMs;
  const on = (item) => ed.sel?.kind === "brand" && ed.sel.item === item;
  const items = [];
  if (b.logo && ed.pb?.brandLogo)
    items.push(
      `<button type="button" class="nle-block nle-block--bar${on("logo") ? " is-selected" : ""}" data-nle-brand-item="logo" style="${span(s, e)}">
        <span class="nle-block__label">Logo · ${{ tl: "top left", tr: "top right", bl: "bottom left", br: "bottom right" }[b.corner] || "top right"}</span></button>`,
    );
  const cardW = CARD_MS;
  if (b.intro)
    items.push(
      `<button type="button" class="nle-block nle-block--card${on("intro") ? " is-selected" : ""}" data-nle-brand-item="intro" style="${span(s, s + cardW)}">
        <span class="nle-block__label">Intro card</span></button>`,
    );
  if (b.outro)
    items.push(
      `<button type="button" class="nle-block nle-block--card${on("outro") ? " is-selected" : ""}" data-nle-brand-item="outro" style="${span(e - cardW, e)}">
        <span class="nle-block__label">Outro card</span></button>`,
    );
  if (!items.length)
    return `<span class="nle-lane__hint" style="${span(s, e)}">No logo, intro card, or outro card. Add them from the Brand tab.</span>`;
  return items.join("");
}

function textLane(tp) {
  const s = ed.w.startMs;
  if (!ed.w.texts.length)
    return `<span class="nle-lane__hint" style="${span(s, ed.w.endMs)}">No text yet. Drag a style here from the Text tab, or press T.</span>`;
  const sel = new Set(selTexts().map((t) => t.id));
  return ed.w.texts
    .map((tx) => {
      const top = 8 + tp.lane[tx.id] * (LAYER_H + LAYER_GAP);
      return `<button type="button" class="nle-block nle-block--text${sel.has(tx.id) ? " is-selected" : ""}" data-nle-layer="${tx.id}"
        style="${span(s + tx.startMs, s + tx.endMs)};top:${top}px;height:${LAYER_H}px"
        aria-label="${escapeHtml(tx.text)}, ${fmtTC(tx.startMs)} to ${fmtTC(tx.endMs)}">
        <span class="nle-block__edge nle-block__edge--start" data-nle-edge="start" aria-hidden="true"></span>
        <span class="nle-block__label">${escapeHtml(tx.text)}</span>
        <span class="nle-block__edge nle-block__edge--end" data-nle-edge="end" aria-hidden="true"></span>
      </button>`;
    })
    .join("");
}

function captionLane() {
  const st = ce.getState();
  const s = ed.w.startMs;
  if (!st || st.presetId === "none")
    return `<button type="button" class="nle-lane__hint nle-lane__hint--action" data-nle-select="captions" style="${span(s, ed.w.endMs)}">No subtitles. Click to pick a style.</button>`;
  const on = ed.sel?.kind === "captions";
  // What the cleanup hid (fillers, pauses), hatched under the lines it left.
  const hidden = ce
    .getHiddenSpans()
    .map(
      (m) =>
        `<span class="nle-hidspan" style="${span(s + m.start * 1000, s + m.end * 1000)}" title="${escapeHtml(m.label)}"></span>`,
    )
    .join("");
  return (
    hidden +
    deriveCues(ce.getWords(), st)
      .map((c) => {
        const text = c.words.map((w) => w.text).join(" ");
        return `<button type="button" class="nle-block nle-block--cue${on ? " is-selected" : ""}" data-nle-cue="${c.start}"
        style="${span(s + c.start * 1000, s + c.end * 1000)}" aria-label="${escapeHtml(text)}"><span class="nle-block__label">${escapeHtml(text)}</span></button>`;
      })
      .join("")
  );
}

// What Auto does with a part, named the way the Layout cards name it.
export function autoKind(seg) {
  const kind = resolve(ed.ctx, seg, (seg.startMs + seg.endMs) / 2, ratioOf(ed.w.ratioId)).kind;
  return { one: "One speaker", two: "Two speakers", fit: "Fit" }[kind];
}

export const cameraShort = (id) => (id === "TWO" ? "Wide" : id === "FIT" ? "Fit" : id ? `Cam ${id}` : "—");

function videoLane() {
  const { s, e } = clipEdges();
  const segs = ed.w.segments;
  const cur = segmentAt(segs, ed.t);
  const selId = ed.sel?.kind === "seg" ? ed.sel.id : null;
  const layoutLabel = (g) =>
    g.layout === "AUTO" ? `Auto · ${autoKind(g)}` : LAYOUTS.find((l) => l.id === g.layout)?.label || g.layout;
  const parts = segs
    .map(
      (
        g,
      ) => `<button type="button" class="nle-part${g.id === selId ? " is-selected" : ""}${g.id === cur.id ? " is-current" : ""}${g.origin === "USER" ? " is-edited" : ""}"
        data-nle-seg="${g.id}" style="left:${x(g.startMs) - x(s)}px;width:${x(g.endMs) - x(g.startMs)}px"
        aria-label="${escapeHtml(cameraName(g.camera))}, ${escapeHtml(layoutLabel(g))}, from ${fmtTC(g.startMs - ed.w.startMs)}">
        <span class="nle-part__chip"><b>${escapeHtml(cameraShort(g.camera))}</b> ${escapeHtml(layoutLabel(g))}${g.origin === "USER" ? " · yours" : ""}</span>
      </button>`,
    )
    .join("");
  const bounds = segs
    .slice(1)
    .map(
      (g, k) => `<span class="nle-bound" data-nle-bound="${k + 1}" style="left:${x(g.startMs)}px">
        <button type="button" class="ap-icon-button stroked nle-bound__join" data-nle-join="${k + 1}" aria-label="Join the two parts" data-tooltip="Join the two parts">${GLYPH.join}</button>
      </span>`,
    )
    .join("");
  const cuts = ed.ctx.cuts
    .filter((c) => c > ed.range.from && c < ed.range.to)
    .map((c) => `<span class="nle-cut" style="left:${x(c)}px" title="Camera cut"></span>`)
    .join("");
  return `${cuts}<div class="nle-vclip" style="${span(s, e)}">${parts}</div>${bounds}
    <span class="nle-trim nle-trim--start" data-nle-trim="start" style="left:${x(s)}px" data-tooltip="Drag to trim the start"></span>
    <span class="nle-trim nle-trim--end" data-nle-trim="end" style="left:${x(e)}px" data-tooltip="Drag to trim the end"></span>`;
}

function overHTML() {
  const { s, e } = clipEdges();
  const total = x(ed.range.to);
  const d = ed.drag;
  return `
    <span class="nle-shade" style="left:0;width:${x(s)}px"></span>
    <span class="nle-shade" style="left:${x(e)}px;width:${Math.max(0, total - x(e))}px"></span>
    <span class="nle-inout nle-inout--in" style="left:${x(s)}px"></span>
    <span class="nle-inout nle-inout--out" style="left:${x(e)}px"></span>
    ${d?.guide != null ? `<span class="nle-snapline" style="left:${x(d.guide)}px"></span>` : ""}
    ${d?.label ? `<span class="nle-readout" style="left:${x(d.at)}px">${escapeHtml(d.label)}</span>` : ""}`;
}

export function paintTimeline() {
  if (!ed || !ed.tl.pxPerMs) return;
  const rs = rows();
  ed.rows = rs;
  const height = rs.at(-1).top + rs.at(-1).h;
  q("[data-nle-tl-bar]").innerHTML = barHTML();
  setZoomSlider();
  q("[data-nle-heads]").innerHTML =
    `<div class="nle-head nle-head--ruler" style="height:${RULER_H}px"><span class="nle-head__tc" data-nle-head-tc></span></div>` +
    rs.map(headHTML).join("");
  const inner = q("[data-nle-inner]");
  inner.style.width = `${Math.ceil(x(ed.range.to))}px`;
  inner.style.height = `${height}px`;
  inner.dataset.tool = ed.tool;
  if (ed.drag) inner.dataset.drag = ed.drag.kind;
  else delete inner.dataset.drag;
  q("[data-nle-lanes]").innerHTML = rs.map(laneHTML).join("");
  q("[data-nle-over]").innerHTML = overHTML();
  const v = rs.find((r) => r.id === "video");
  const fh = v.h - 12;
  const wh = Math.round(fh * 0.4); // prod's strip along the track's foot
  Object.assign(q("[data-nle-film]").style, { top: `${v.top + 6}px`, height: `${fh}px` });
  Object.assign(q("[data-nle-wave]").style, { top: `${v.top + 6 + fh - wh}px`, height: `${wh}px` });
  paintPlayhead();
  paintVisible();
}

export function paintPlayhead() {
  if (!ed?.tl.pxPerMs) return;
  const ph = q("[data-nle-playhead]");
  if (ph) ph.style.transform = `translateX(${x(ed.t)}px)`;
  const tc = q("[data-nle-head-tc]");
  if (tc) tc.textContent = fmtTC(ed.t - ed.w.startMs);
}

// Keep the playhead in view: paged while playing, like a desktop editor.
export function revealPlayhead() {
  const sc = scroller();
  if (!sc || !ed.tl.pxPerMs) return;
  const px = x(ed.t);
  if (px < sc.scrollLeft + 20 || px > sc.scrollLeft + sc.clientWidth - 40)
    sc.scrollLeft = Math.max(0, px - sc.clientWidth * 0.15);
}

// ── Zoom ────────────────────────────────────────────────────────────

const minPx = () => scroller().clientWidth / (ed.range.to - ed.range.from);

function setZoom(px, anchorMs, anchorX) {
  const sc = scroller();
  const lo = minPx();
  px = Math.max(lo, Math.min(MAX_PX_PER_MS, px));
  ed.tl.pxPerMs = px;
  paintTimeline();
  sc.scrollLeft = Math.max(0, (anchorMs - ed.range.from) * px - anchorX);
  paintVisible();
}

export function fitTimeline() {
  const sc = scroller();
  // Not laid out yet (the first resize can come before the timeline has a
  // width): try again on the next frame rather than staying blank.
  if (!sc?.clientWidth) return void later(fitTimeline);
  const px = Math.max(minPx(), Math.min(MAX_PX_PER_MS, (sc.clientWidth - FIT_PAD * 2) / clipLen()));
  setZoom(px, ed.w.startMs, FIT_PAD);
}

export function zoomBy(f, clientX) {
  const sc = scroller();
  const r = sc.getBoundingClientRect();
  let anchorX = clientX != null ? clientX - r.left : null;
  if (anchorX == null) {
    const ph = x(ed.t) - sc.scrollLeft;
    anchorX = ph >= 0 && ph <= sc.clientWidth ? ph : sc.clientWidth / 2;
  }
  const anchorMs = ed.range.from + (sc.scrollLeft + anchorX) / ed.tl.pxPerMs;
  setZoom(ed.tl.pxPerMs * f, anchorMs, anchorX);
}

// The slider runs on a log scale between the whole window and frame level.
function setZoomSlider() {
  const z = q("[data-nle-zoom]");
  if (!z) return;
  const lo = minPx();
  const v = (100 * Math.log(ed.tl.pxPerMs / lo)) / Math.log(MAX_PX_PER_MS / lo);
  z.value = String(Math.round(Math.max(0, Math.min(100, v))));
  z.style.setProperty("--fill", `${z.value}%`);
}

export function zoomFromSlider(value) {
  const lo = minPx();
  const px = lo * (MAX_PX_PER_MS / lo) ** (value / 100);
  zoomBy(px / ed.tl.pxPerMs);
}

export function timelineWheel(e) {
  const sc = scroller();
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX);
  } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
    e.preventDefault();
    sc.scrollLeft += e.deltaY;
  }
}

// ── What follows the scroll: ruler, filmstrip, waveform ─────────────

const TICK_STEPS = [40, 80, 200, 400, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000];

function cssVars() {
  const cs = getComputedStyle(q("[data-nle-root]"));
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    tick: v("--ref-color-grey-60"),
    label: v("--ref-color-grey-80"),
    band: v("--ref-color-white"),
    off: v("--ref-color-grey-05"),
    wave: v("--ref-color-white"),
    film: v("--ref-color-grey-10"),
    font: v("--sys-text-style-caption-font-family") || "Averta, sans-serif",
  };
}

function prepCanvas(cv, w, h) {
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  cv.style.width = `${w}px`;
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}

export function paintVisible() {
  if (!ed?.tl.pxPerMs || !ed.rows) return;
  const sc = scroller();
  const sl = sc.scrollLeft;
  const vw = sc.clientWidth;
  const px = ed.tl.pxPerMs;
  const col = cssVars();
  const from = ed.range.from + sl / px; // ms at the view's left edge
  const { s, e } = clipEdges();

  // Ruler: the clip's own time (0 at its start), frames when zoomed in.
  const rc = q("[data-nle-ruler-cv]");
  rc.style.left = `${sl}px`;
  const r = prepCanvas(rc, vw, RULER_H);
  r.fillStyle = col.off;
  r.fillRect(0, 0, vw, RULER_H);
  r.fillStyle = col.band;
  r.fillRect((s - from) * px, 0, (e - s) * px, RULER_H);
  const step = TICK_STEPS.find((st) => st * px >= 84) || 300000;
  const minor = step >= 1000 ? step / 5 : step >= 200 ? step / 5 : step / 2;
  r.font = `11px ${col.font}`;
  r.textBaseline = "top";
  const t0 = Math.floor((from - s) / minor) * minor;
  for (let t = t0; (s + t - from) * px < vw + 2; t += minor) {
    const X = Math.round((s + t - from) * px) + 0.5;
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    r.fillStyle = col.tick;
    r.fillRect(X, RULER_H - (major ? 10 : 5), 1, major ? 10 : 5);
    if (major) {
      r.fillStyle = col.label;
      const label =
        step < 1000
          ? fmtTC(t)
          : `${t < 0 ? "−" : ""}${Math.floor(Math.abs(t) / 60000)}:${String(Math.floor((Math.abs(t) % 60000) / 1000)).padStart(2, "0")}`;
      r.fillText(label, X + 4, 6);
    }
  }

  // Filmstrip: source frames on a fixed grid, filled in as they're read.
  const film = q("[data-nle-film]");
  const fh = parseFloat(film.style.height) || 60;
  film.style.left = `${sl}px`;
  const f = prepCanvas(film, vw, fh);
  const tw = Math.round((fh * 16) / 9);
  const msPerThumb = tw / px;
  const Q = [200, 500, 1000, 2000, 5000, 10000, 20000, 60000].find((v) => v >= msPerThumb * 0.75) || 120000;
  const th = thumbs();
  const want = [];
  for (let i = Math.floor(sl / tw); i * tw < sl + vw; i++) {
    const X = i * tw - sl;
    const tMid = ed.range.from + (i * tw + tw / 2) / px;
    const key = Math.round(tMid / Q) * Q;
    const img = th.get(key);
    if (img) f.drawImage(img, X, 0, tw, fh);
    else {
      f.fillStyle = col.film;
      f.fillRect(X, 0, tw - 1, fh);
      want.push(key);
    }
  }
  th.want(want);

  // The waveform strip along the Video track's foot, shaped on the words
  // (speech loud, the gaps quiet): a darkened band, the bars faint over it.
  const wave = q("[data-nle-wave]");
  const wh = parseFloat(wave.style.height) || 30;
  wave.style.left = `${sl}px`;
  const w = prepCanvas(wave, vw, wh);
  w.fillStyle = "rgba(0, 0, 0, 0.22)";
  w.fillRect(0, 0, vw, wh);
  w.fillStyle = col.wave;
  const words = ed.srcWords || [];
  let wi = 0;
  w.globalAlpha = 0.55;
  for (let X = 0; X < vw; X += 4) {
    const t = from + X / px;
    while (wi < words.length && words[wi].end < t) wi++;
    const inWord = wi < words.length && words[wi].start <= t;
    const n = noise(Math.floor(t / 40));
    const n2 = noise(Math.floor(t / 160) + 7);
    const amp = inWord ? 0.3 + 0.45 * n + 0.25 * n2 : 0.03 + 0.05 * n;
    const hgt = Math.max(1, amp * (wh - 6));
    w.fillRect(X, wh - 3 - hgt, 2, hgt);
  }
}

function noise(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// Frames for the filmstrip, read from a second, hidden copy of the footage —
// one seek at a time, the ones in view first. Drawing a cross-origin frame
// only taints the canvas, which the filmstrip never reads back.
function thumbs() {
  if (ed.thumbs) return ed.thumbs;
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = ed.video.url;
  const cache = new Map();
  let queue = [];
  let busy = false;
  let current = null;
  const pump = () => {
    if (busy || !queue.length || v.readyState < 1) return;
    busy = true;
    current = queue.shift();
    v.currentTime = Math.max(0, current / 1000);
  };
  const onSeeked = () => {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    try {
      c.getContext("2d").drawImage(v, 0, 0, 160, 90);
      cache.set(current, c);
      if (cache.size > 600) cache.delete(cache.keys().next().value);
    } catch {}
    busy = false;
    if (ed) later(paintVisible);
    pump();
  };
  v.addEventListener("loadedmetadata", pump);
  v.addEventListener("seeked", onSeeked);
  v.addEventListener("error", () => (busy = false));
  ed.thumbs = {
    get: (k) => cache.get(k),
    want(keys) {
      queue = [...new Set(keys)].filter((k) => !cache.has(k));
      pump();
    },
    dispose() {
      queue = [];
      v.removeEventListener("seeked", onSeeked);
      v.removeAttribute("src");
      v.load();
    },
  };
  return ed.thumbs;
}

// ── Snapping ────────────────────────────────────────────────────────

// Everything an edge can land on, in source ms: [ms, what it is].
function snapTargets({ exceptText, edges = true } = {}) {
  const s = ed.w.startMs;
  const list = [
    [s, "the clip's start"],
    [ed.w.endMs, "the clip's end"],
    [ed.t, "the playhead"],
    ...ed.ctx.cuts.map((c) => [c, "a camera cut"]),
    ...ed.w.segments.slice(1).map((g) => [g.startMs, "a part"]),
  ];
  if (edges)
    for (const o of ed.w.texts)
      if (!exceptText?.has(o.id)) list.push([s + o.startMs, "a text"], [s + o.endMs, "a text"]);
  return list;
}

// The nearest target to any of the edges, as [shift, target, label].
function snapFind(edgesMs, targets, free) {
  if (free || !ed.snap) return null;
  const radius = SNAP_PX / ed.tl.pxPerMs;
  let best = null;
  for (const edge of edgesMs)
    for (const [t, name] of targets) {
      const d = t - edge;
      if (Math.abs(d) <= radius && (!best || Math.abs(d) < Math.abs(best[0]))) best = [d, t, name];
    }
  return best;
}

// ── Pointer ─────────────────────────────────────────────────────────

function drag(e, onMove, onUp) {
  e.preventDefault();
  const move = (ev) => onMove(ev);
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onUp?.(ev);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function inRuler(e) {
  const r = q("[data-nle-inner]").getBoundingClientRect();
  return e.clientY - r.top < RULER_H;
}

export function timelinePointerDown(e) {
  const t = e.target;
  const ms = msAt(e.clientX);
  if (t.closest("[data-nle-knob]") || inRuler(e)) return scrub(e);
  if (ed.tool === "blade") return blade(e, ms);
  const join = t.closest("[data-nle-join]");
  if (join) {
    if (ed.tracks.video.locked) return undefined;
    pushUndo();
    merge(ed.ctx, ed.w.segments, ed.w.segments[Number(join.dataset.nleJoin)], -1);
    setDirty();
    paintInspector();
    paintTimeline();
    return paintFrame();
  }
  const trim = t.closest("[data-nle-trim]");
  if (trim && !ed.tracks.video.locked) return trimDrag(e, trim.dataset.nleTrim);
  const bound = t.closest("[data-nle-bound]");
  if (bound && !ed.tracks.video.locked) return boundDrag(e, Number(bound.dataset.nleBound));
  const layer = t.closest("[data-nle-layer]");
  if (layer) return layerDrag(e, layer.dataset.nleLayer, t.closest("[data-nle-edge]")?.dataset.nleEdge || "move");
  const seg = t.closest("[data-nle-seg]");
  if (seg) {
    const g = ed.w.segments.find((x) => x.id === seg.dataset.nleSeg);
    if (ed.playing) stop();
    seek(Math.max(g.startMs + 1, Math.min(g.endMs - 1, ms)));
    return select({ kind: "seg", id: g.id });
  }
  const cue = t.closest("[data-nle-cue]");
  if (cue) {
    if (ed.playing) stop();
    seek(ed.w.startMs + Number(cue.dataset.nleCue) * 1000 + 1);
    return ed.sel?.kind === "captions" ? undefined : select({ kind: "captions" });
  }
  const brand = t.closest("[data-nle-brand-item]");
  if (brand) return select({ kind: "brand", item: brand.dataset.nleBrandItem });
  const pick = t.closest("[data-nle-select]");
  if (pick) {
    select({ kind: pick.dataset.nleSelect });
    return scrub(e);
  }
  // Empty track: clear the selection and move the playhead there.
  if (ed.sel) select(null);
  return scrub(e);
}

function scrub(e) {
  if (ed.playing) stop();
  const targets = editPoints().map((p) => [p, ""]);
  const go = (ev) => {
    let m = msAt(ev.clientX);
    const hit = snapFind([m], targets, ev.altKey);
    if (hit) m += hit[0];
    seek(m);
  };
  q("[data-nle-inner]").dataset.drag = "scrub";
  go(e);
  drag(e, go, () => delete q("[data-nle-inner]")?.dataset.drag);
}

function blade(e, ms) {
  const layer = e.target.closest("[data-nle-layer]");
  const lane = e.target.closest("[data-nle-lane]")?.dataset.nleLane;
  const hit = snapFind([ms], snapTargets(), e.altKey);
  const at = snapFrame(hit ? ms + hit[0] : ms);
  e.preventDefault();
  if (layer && !ed.tracks.text.locked) return splitTextAt(layer.dataset.nleLayer, at - ed.w.startMs);
  if (lane === "video" && at > ed.w.startMs && at < ed.w.endMs) return splitPartAt(at);
  return undefined;
}

// The blade shows where it would cut.
export function timelinePointerMove(e) {
  if (!ed?.tl.pxPerMs) return;
  const line = q("[data-nle-blade]");
  if (!line) return;
  const lane = e.target.closest?.("[data-nle-lane]")?.dataset.nleLane;
  const show =
    ed.tool === "blade" && !ed.drag && (lane === "video" || (lane === "text" && e.target.closest("[data-nle-layer]")));
  line.hidden = !show;
  if (!show) return;
  const ms = msAt(e.clientX);
  const hit = snapFind([ms], snapTargets(), e.altKey);
  line.style.transform = `translateX(${x(snapFrame(hit ? ms + hit[0] : ms))}px)`;
}

function boundDrag(e, k) {
  if (ed.playing) stop();
  pushUndo();
  const targets = snapTargets().filter(([, name]) => name !== "a part");
  drag(
    e,
    (ev) => {
      let t = msAt(ev.clientX);
      const hit = snapFind([t], targets, ev.altKey);
      if (hit) t += hit[0];
      else t = snapMs(ed.ctx, Math.round(t), { on: ed.snap && !ev.altKey }).t;
      const v = moveBoundary(ed.ctx, ed.w.segments, k, Math.round(t));
      ed.drag = {
        kind: "bound",
        at: v,
        guide: hit ? hit[1] : null,
        label: `${fmtTC(v - ed.w.startMs)}${hit ? ` · on ${hit[2]}` : ""}`,
      };
      seek(v);
      paintTimeline();
    },
    () => {
      ed.drag = null;
      settleBoundary(ed.ctx, ed.w.segments, k);
      dropNoopUndo();
      setDirty();
      paintInspector();
      paintTimeline();
      paintFrame();
    },
  );
}

// The clip's edges: a ghost follows the pointer (the Program shows the edge's
// frame), the trim lands on release — one undo step.
function trimDrag(e, edge) {
  if (ed.playing) stop();
  const targets = snapTargets({ edges: false }).filter(
    ([, name]) => !name.startsWith("the clip") && name !== "the playhead",
  );
  targets.push([ed.t, "the playhead"]);
  const t0 = ed.t;
  ed.drag = { kind: "trim", s: ed.w.startMs, e: ed.w.endMs };
  drag(
    e,
    (ev) => {
      let t = msAt(ev.clientX);
      const hit = snapFind([t], targets, ev.altKey);
      if (hit) t += hit[0];
      t = snapFrame(t);
      const d = ed.drag;
      if (edge === "start") d.s = Math.max(ed.range.from, Math.min(d.e - MIN_CLIP_MS, t));
      else d.e = Math.min(ed.range.to, Math.max(d.s + MIN_CLIP_MS, t));
      d.at = edge === "start" ? d.s : d.e;
      d.guide = hit ? hit[1] : null;
      const len = d.e - d.s;
      d.label = `${edge === "start" ? "Start" : "End"} ${fmtTC(d.at - ed.w.startMs)} · ${fmtTC(len)} long${hit ? ` · on ${hit[2]}` : ""}`;
      seek(edge === "start" ? d.s : d.e - 1, { free: true });
      paintTimeline();
    },
    () => {
      const d = ed.drag;
      ed.drag = null;
      pushUndo();
      if (!trimTo(d.s, d.e)) {
        ed.undo.pop();
        seek(t0);
        return paintTimeline();
      }
      setDirty();
      refreshAll();
      return seek(edge === "start" ? ed.w.startMs : ed.w.endMs - 1);
    },
  );
}

// A text layer: the body moves it (with every selected text), an edge sets
// its start or end. A press that doesn't move is a click.
function layerDrag(e, id, part) {
  const tx = txById(id);
  if (!tx) return;
  const additive = e.shiftKey || e.metaKey;
  if (additive || ed.sel?.kind !== "text" || !ed.sel.ids.includes(id))
    select({ kind: "text", ids: [id] }, { additive });
  if (ed.tracks.text.locked || !txById(id) || !selTexts().some((t) => t.id === id)) return;
  if (ed.playing) stop();
  pushUndo();
  const x0 = e.clientX;
  const m0 = msAt(e.clientX);
  const group = part === "move" ? selTexts() : [tx];
  const orig = group.map((t) => ({ t, s: t.startMs, e: t.endMs }));
  const len = clipLen();
  const s0 = ed.w.startMs;
  const targets = snapTargets({ exceptText: new Set(group.map((t) => t.id)) });
  let moved = false;
  drag(
    e,
    (ev) => {
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      moved = true;
      let d = msAt(ev.clientX) - m0;
      const me = orig.find((o) => o.t === tx);
      let hit = null;
      if (part === "start") {
        hit = snapFind([s0 + me.s + d], targets, ev.altKey);
        if (hit) d += hit[0];
        tx.startMs = Math.round(Math.max(0, Math.min(me.e - MIN_TEXT_MS, snapFrame(me.s + d))));
      } else if (part === "end") {
        hit = snapFind([s0 + me.e + d], targets, ev.altKey);
        if (hit) d += hit[0];
        tx.endMs = Math.round(Math.min(len, Math.max(me.s + MIN_TEXT_MS, snapFrame(me.e + d))));
      } else {
        hit = snapFind([s0 + me.s + d, s0 + me.e + d], targets, ev.altKey);
        if (hit) d += hit[0];
        const lo = -Math.min(...orig.map((o) => o.s));
        const hi = len - Math.max(...orig.map((o) => o.e));
        d = snapFrame(Math.max(lo, Math.min(hi, d)));
        for (const o of orig) {
          o.t.startMs = Math.round(o.s + d);
          o.t.endMs = Math.round(o.e + d);
        }
      }
      const at = part === "end" ? tx.endMs : tx.startMs;
      ed.drag = {
        kind: "layer",
        at: s0 + at,
        guide: hit ? hit[1] : null,
        label: `${fmtTC(tx.startMs)} → ${fmtTC(tx.endMs)}${hit ? ` · on ${hit[2]}` : ""}`,
      };
      seek(s0 + (part === "end" ? tx.endMs - 1 : tx.startMs + 1));
      paintTexts();
      paintTimeline();
    },
    () => {
      ed.drag = null;
      if (!moved) {
        ed.undo.pop();
        return paintTimeline();
      }
      setDirty();
      paintInspector();
      return paintTimeline();
    },
  );
}

// A text preset dropped on the timeline lands where it's dropped.
export function timelineDrop(e) {
  const id = e.dataTransfer?.getData("text/x-nle-preset");
  if (!id || !e.target.closest("[data-nle-scroll]")) return;
  e.preventDefault();
  const at = Math.max(0, Math.min(clipLen() - 500, msAt(e.clientX) - ed.w.startMs));
  addText(id, snapFrame(at));
}
