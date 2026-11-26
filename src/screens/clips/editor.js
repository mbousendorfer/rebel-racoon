// /clips/:id/edit/:clipId — the ONE clip editor of the Clips space (flag
// clipsSpace), rebuilt 2026-11-23 as a desktop editing workspace (« soit
// ambitieux… on peut tout refaire »), after Premiere, Resolve, CapCut:
//
//   ┌ library ┐┌──────── viewer ────────┐┌ inspector ┐
//   │Transcript││ Program (+ Source)      ││ what's    │
//   │Text      ││ transport, timecode     ││ selected  │
//   │Brand     │└────────────────────────┘└───────────┘
//   ┌──────────────── timeline, full width ─────────────────┐
//   │ tools · zoom      Brand · Text · Captions · Video         │
//   └────────────────────────────────────────────────────────┘
//
// Every pane is resizable (gutters, remembered). Editing is by SELECTION, not
// by tool: click a text layer, a framing part, the captions, a
// brand item — the inspector shows its properties; nothing selected, the clip's.
// The timeline holds every track at once, zooms, scrolls and trims (the clip's
// edges, or I / O, within prod's ±2 min window). A blade, copy /
// paste, a context menu, J / K / L and the full keyboard of a desktop editor.
//
// Engines kept as they were: clip-framing.js (the crop editor's parts),
// caption-editor.js (captions, transcript and cleanup on this editor's clock).
// Saving is still the editor's main action (Save changes, ⌘S); nothing is
// written before it. Leaving with unsaved changes asks.
// ponytail: subtitle style edits are outside the undo stack — caption-editor
// keeps its own state; fold them in if undoing a font change is asked for.

import { navigate } from "../../router.js?v=2921";
import { isFlagOn } from "../../feature-flags.js?v=2921";
import { parseHashParams } from "../../url-state.js?v=2921";
import { renderTopbar, setTopbarActions } from "../../components/topbar.js?v=2921";
import { showToast } from "../../components/toast.js?v=2921";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2921";
import { open as openRename } from "../../components/rename-modal.js?v=2921";
import { getContextById } from "../../contexts-store.js?v=2921";
import { escapeHtml } from "../../utils.js?v=2921";
import * as ce from "../../caption-editor.js?v=2921";
import { DEAD_ZONES } from "../../clip-captions.js?v=2921";
import { NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=2921";
import { getVideo, getClip, updateClip, clipLookOf, renderClip } from "../../videos-store.js?v=2921";
import {
  framingContext,
  initialSegments,
  retrim,
  resolve,
  segmentAt,
  drawOutput,
  setLayout,
  toManual,
  split,
  merge,
  snapMs,
  resetSegment,
} from "../../clip-framing.js?v=2921";
import {
  RATIO_IDS,
  ratioOf,
  formatLabel,
  bestFor,
  clipRatioId,
  clipCaptionState,
  SUBTITLE_IDS,
  presetLabel,
  dsSelect,
  bindSelectDismiss,
} from "./shared.js?v=2921";
import { writePostsInChat } from "../../clips-chat.js?v=2921";
import {
  timelineShellHTML,
  paintTimeline,
  paintPlayhead,
  paintVisible,
  fitTimeline,
  zoomBy,
  zoomFromSlider,
  msAt,
  timelinePointerDown,
  timelinePointerMove,
  timelineWheel,
  timelineDrop,
  revealPlayhead,
} from "./editor-timeline.js?v=2921";
import { libraryHTML, inspectorHTML, TEXT_PRESETS, GLYPH } from "./editor-panels.js?v=2921";

const FPS = 25;
export const FRAME_MS = 1000 / FPS;
export const CARD_MS = 2000; // intro / outro card length
const WINDOW_MS = 120000; // prod's trim window: ±2 min around the clip
export const MIN_CLIP_MS = 3000;
export const MIN_TEXT_MS = 400;
const ANIM_MS = 300;
const LAYOUT_KEY = "archie-clips-editor-layout";
const DEFAULT_LAYOUT = { left: 300, right: 320, tl: 340 };

// The safe-area guide's choices: where each network's buttons cover the video.
const DEAD_ZONE_LABELS = { none: "No guide", tiktok: "TikTok zones", reels: "Reels zones", shorts: "Shorts zones" };
const DEAD_ZONE_NETWORK = { tiktok: "tiktok", reels: "instagram", shorts: "youtube" };
const dzIcon = (id) =>
  DEAD_ZONE_NETWORK[id]
    ? `<i class="${NETWORK_ICON_BY_PLATFORM[DEAD_ZONE_NETWORK[id]]} nle-dz-icon" aria-hidden="true"></i>`
    : `<i class="ap-icon-eye-off nle-dz-icon" aria-hidden="true"></i>`;

export let ed = null;
// Copied text layers survive moving to the next clip, like any editor's clipboard.
let clipboard = [];

// ── Time ────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");
// A timecode at 25 fps: MM:SS:FF (H:MM:SS:FF past an hour).
export function fmtTC(ms) {
  const neg = ms < 0;
  const frames = Math.round(Math.abs(ms) / FRAME_MS);
  const ff = frames % FPS;
  const s = Math.floor(frames / FPS);
  const h = Math.floor(s / 3600);
  const body = `${h ? `${h}:` : ""}${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}:${pad2(ff)}`;
  return neg ? `−${body}` : body;
}

// What a typed time means: 12 · 12.5 · 1:02 · 1:02.5 · 01:02:12 (frames).
function parseTC(str) {
  const s = String(str || "")
    .trim()
    .replace(/[^\d:.]/g, "");
  if (!s) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 1) return parts[0] * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  const [m, sec, f] = parts.slice(-3);
  const h = parts.length > 3 ? parts[0] : 0;
  return ((h * 3600 + m * 60 + sec) * FPS + f) * FRAME_MS;
}

export const ratio = () => ratioOf(ed.w.ratioId);
export const clipLen = () => ed.w.endMs - ed.w.startMs;
export const rel = () => ed.t - ed.w.startMs;
export const snapFrame = (ms) => Math.round(ms / FRAME_MS) * FRAME_MS;
export const txById = (id) => ed.w.texts.find((x) => x.id === id);
export const selTexts = () => (ed.sel?.kind === "text" ? ed.sel.ids.map(txById).filter(Boolean) : []);
export const selSeg = () => (ed.sel?.kind === "seg" ? ed.w.segments.find((s) => s.id === ed.sel.id) : null);
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ── Lifecycle ───────────────────────────────────────────────────────

export function renderClipEditor(params, el) {
  if (!isFlagOn("clipsSpace")) {
    navigate("/");
    return undefined;
  }
  const video = getVideo(params.id);
  const clip = getClip(params.id, params.clipId);
  if (!video || !clip) {
    navigate(video ? `/clips/${video.id}` : "/clips");
    return undefined;
  }
  const ctx = framingContext(video);
  const pb = getContextById(video.contextId);
  const look = clipLookOf(pb);
  const durMs = video.durationMs || clip.endMs + WINDOW_MS;
  ed = {
    el,
    video,
    clip,
    ctx,
    pb,
    look,
    // The working copy — written to the clip on Save changes.
    w: {
      title: clip.title,
      startMs: clip.startMs,
      endMs: clip.endMs,
      ratioId: clipRatioId(video, clip),
      segments: JSON.parse(JSON.stringify(clip.segments || initialSegments(ctx, clip.startMs, clip.endMs))),
      texts: JSON.parse(JSON.stringify(clip.texts || [])),
      brand: { ...look.brand, ...(clip.brand || {}) },
      teaser: clip.teaser ? { ...clip.teaser } : suggestTeaser(clip),
    },
    // What the timeline can reach: prod's trim window around the clip as it opened.
    range: { from: Math.max(0, clip.startMs - WINDOW_MS), to: Math.min(durMs, clip.endMs + WINDOW_MS) },
    sel: null,
    lib: "transcript",
    mode: "program", // program | dual (Source + Program)
    tool: "select", // select | blade
    snap: true,
    tracks: {
      brand: { hidden: false, locked: false },
      text: { hidden: false, locked: false },
      captions: { hidden: false, locked: false },
      video: { locked: false },
    },
    muted: false, // the player's mute: listening here, not the clip's sound
    layout: readLayout(),
    tl: { pxPerMs: 0 },
    loop: false,
    rate: 1,
    volume: 1,
    shuttle: 0,
    caption: null,
    capOwn: !!clip.captionCustom,
    capDirty: false,
    deadZones: clipCaptionState(video, clip).deadZones || "tiktok",
    undo: [],
    redo: [],
    dirty: false,
    changed: false,
    discard: false,
    t: clip.startMs,
    phase: "clip",
    phaseEnd: 0,
    playing: false,
    raf: 0,
    last: 0,
    drag: null,
    disposers: [],
  };
  applyUrlIntent();
  ed.saved = snapshot();
  renderTopbar();
  paintTopbar();
  el.innerHTML = shellHTML();
  mountCaptions();
  // The words of the whole reachable window, in source ms: a trim cuts the
  // captions from these, so trimming back out (or Undo) brings them back.
  ed.wordsBase = { s: ed.w.startMs, e: ed.w.endMs };
  ed.srcWords = ce
    .getWords()
    .map((w) => ({ ...w, start: w.start * 1000 + ed.w.startMs, end: w.end * 1000 + ed.w.startMs }));
  paintViewerBar();
  paintLibrary();
  paintInspector();
  bindAll();
  setupVideo();
  return teardown;
}

function teardown() {
  if (!ed) return;
  // The browser's Back can't ask: unsaved changes are kept, not lost.
  if (ed.dirty && !ed.discard) save();
  cancelAnimationFrame(ed.raf);
  ce.unmount();
  ed.video_el?.pause();
  ed.thumbs?.dispose();
  ed.disposers.splice(0).forEach((d) => d());
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  ed = null;
}

// The former tools' URLs still land somewhere sensible.
function applyUrlIntent() {
  const t = parseHashParams().get("tool");
  if (t === "transcript" || t === "cleanup") ed.lib = "transcript";
  else if (t === "text") ed.lib = "text";
  else if (t === "brand") ed.lib = "brand";
  else if (t === "subtitles") ed.sel = { kind: "captions" };
  else if (t === "reframe" || t === "trim") {
    ed.sel = { kind: "seg", id: ed.w.segments[0]?.id };
    ed.mode = "dual";
  }
}

// ponytail: prod's model picks the teaser (teaserStartTime); the proto offers
// 3 s at 40 % of the clip.
function suggestTeaser(c) {
  const len = c.endMs - c.startMs;
  const startMs = Math.round(len * 0.4);
  return { on: false, startMs, endMs: Math.min(len, startMs + 3000) };
}

function readLayout() {
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

function writeLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(ed.layout));
  } catch {}
}

// One repaint per frame for whatever asked for it.
const queued = new Set();
export function later(fn) {
  if (queued.has(fn)) return;
  queued.add(fn);
  requestAnimationFrame(() => {
    queued.delete(fn);
    if (ed) fn();
  });
}

// ── Topbar: back · title · ‹ clip › │ undo redo · Write a post · Save changes ──

function paintTopbar() {
  const left = `<button type="button" class="ap-icon-button" data-nle="back" aria-label="Back to the video" data-tooltip="Back to the video">
      <i class="ap-icon-arrow-left" aria-hidden="true"></i>
    </button>
    <h1 class="ap-h2 nle-title" data-nle-title>${escapeHtml(ed.w.title)}</h1>
    <button type="button" class="ap-icon-button" data-nle="rename" aria-label="Rename the clip" data-tooltip="Rename the clip">
      <i class="ap-icon-pen" aria-hidden="true"></i>
    </button>
    ${clipNavHTML()}`;
  const right = `
    <button type="button" class="ap-button ghost grey" data-nle="undo" data-tooltip="⌘Z" ${ed.undo.length ? "" : "disabled"}><span>Undo</span></button>
    <button type="button" class="ap-button ghost grey" data-nle="redo" data-tooltip="⇧⌘Z" ${ed.redo.length ? "" : "disabled"}><span>Redo</span></button>
    <button type="button" class="ap-button stroked grey" data-nle="draft"><i class="ap-icon-archie-official" aria-hidden="true"></i><span>Write a post</span></button>
    <button type="button" class="ap-button primary blue" data-nle="save" data-tooltip="⌘S" ${ed.dirty ? "" : "disabled"}>${saveHTML()}</button>`;
  setTopbarActions(`/clips/${ed.video.id}/edit/${ed.clip.id}`, `<div class="nle-topbar-actions">${right}</div>`, {
    left,
  });
}

function clipNavHTML() {
  const clips = ed.video.clips;
  const i = clips.findIndex((c) => c.id === ed.clip.id);
  if (clips.length < 2 || i < 0) return "";
  const btn = (dir, k, label) =>
    `<button type="button" class="ap-icon-button stroked" data-nle-goto="${clips[k]?.id || ""}" aria-label="${label}" data-tooltip="${label}" ${clips[k] ? "" : "disabled"}>
      <i class="ap-icon-chevron-${dir}" aria-hidden="true"></i></button>`;
  return `<span class="nle-clipnav" role="group" aria-label="Clips of this video">
      ${btn("left", i - 1, "Previous clip")}
      <span class="nle-clipnav__label">Clip ${i + 1} of ${clips.length}</span>
      ${btn("right", i + 1, "Next clip")}
    </span>`;
}

const saveHTML = () =>
  !ed.dirty && ed.changed
    ? `<i class="ap-icon-check" aria-hidden="true"></i><span>Saved</span>`
    : `<span>Save changes</span>`;

function syncTopbar() {
  const bar = document.getElementById("topbar");
  const saveBtn = bar?.querySelector('[data-nle="save"]');
  if (!saveBtn) return paintTopbar();
  saveBtn.disabled = !ed.dirty;
  saveBtn.innerHTML = saveHTML();
  const title = bar.querySelector("[data-nle-title]");
  if (title) title.textContent = ed.w.title;
  bar.querySelector('[data-nle="undo"]').disabled = !ed.undo.length;
  bar.querySelector('[data-nle="redo"]').disabled = !ed.redo.length;
  return undefined;
}

// ── Shell ───────────────────────────────────────────────────────────

const iconBtn = (act, label, inner, { kbd, pressed, extra = "", cls = "" } = {}) =>
  `<button type="button" class="ap-icon-button transparent nle-ib ${cls}" data-nle="${act}" aria-label="${label}"
    data-tooltip="${label}${kbd ? ` · ${kbd}` : ""}" ${pressed != null ? `aria-pressed="${pressed}"` : ""} ${extra}>${inner}</button>`;

function shellHTML() {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((d) => `<span class="cap-ed-handle cap-ed-handle--${d}" data-ce-resize="${d}"></span>`)
    .join("");
  const L = ed.layout;
  return `
  <div class="nle" data-nle-root data-mode="${ed.mode}" style="--nle-left:${L.left}px;--nle-right:${L.right}px;--nle-tl:${L.tl}px">
    <aside class="nle-lib" data-nle-lib aria-label="Library"></aside>
    <div class="nle-gutter nle-gutter--v" data-nle-resize="left" role="separator" aria-orientation="vertical" aria-label="Resize the library" tabindex="0"></div>

    <section class="nle-viewer" data-nle-viewer aria-label="Viewer">
      <header class="nle-viewer__bar" data-nle-viewer-bar></header>
      <div class="nle-viewer__stage nle-well" data-nle-stage>
        <section class="nle-monitor nle-monitor--source" aria-label="Source">
          <header class="nle-monitor__bar">
            <span class="nle-monitor__name">Source</span>
            <span class="nle-monitor__meta">${ed.ctx.W}×${ed.ctx.H} · <span data-nle-src-tc></span></span>
          </header>
          <div class="nle-monitor__body" data-nle-source-body>
            <div class="nle-source" data-nle-source>
              <video class="nle-video" data-nle-video playsinline preload="auto"></video>
              <canvas class="nle-overlay" data-nle-overlay></canvas>
            </div>
          </div>
        </section>
        <div class="nle-splitter" data-nle-splitter role="separator" aria-orientation="vertical"
          aria-label="Resize Source and Output" aria-valuemin="30" aria-valuemax="80" aria-valuenow="55" tabindex="0"></div>
        <section class="nle-monitor nle-monitor--program" aria-label="Output">
          <header class="nle-monitor__bar">
            <span class="nle-monitor__name">Output</span>
            <span class="nle-monitor__meta" data-nle-program-meta></span>
          </header>
          <div class="nle-monitor__body nle-well" data-nle-output-wrap>
            <div class="nle-output" data-ce-stage data-nle-output>
              <canvas class="nle-out-canvas" data-nle-out></canvas>
              <div class="cap-ed__deadzones" data-ce-deadzones></div>
              <div class="nle-texts" data-nle-texts data-ce-no-toggle></div>
              <span class="nle-guide nle-guide--v" data-nle-guide="x" hidden></span>
              <span class="nle-guide nle-guide--h" data-nle-guide="y" hidden></span>
              <img class="nle-logo" data-nle-logo alt="" hidden />
              <div class="cap-ed-box" data-ce-box></div>
              <div class="cap-ed-frame" data-ce-frame>${handles}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="nle-transport" role="toolbar" aria-label="Playback">
        <div class="nle-transport__tc">
          <input type="text" class="nle-tc" data-nle-tc spellcheck="false" autocomplete="off"
            aria-label="Playhead time. Type a time and press Enter to jump" data-tooltip="Type a time to jump" />
          <span class="nle-tc-len">/ <span data-nle-len></span></span>
        </div>
        <div class="nle-transport__ctrls">
          ${iconBtn("to-start", "Go to start", GLYPH.toStart, { kbd: "Home" })}
          ${iconBtn("step-back", "Previous frame", GLYPH.stepBack, { kbd: "←" })}
          <button type="button" class="ap-icon-button stroked blue nle-play" data-nle="play" aria-label="Play" data-tooltip="Play / pause · Space">
            <i class="ap-icon-play" aria-hidden="true" data-nle-play-icon></i>
          </button>
          ${iconBtn("step-fwd", "Next frame", GLYPH.stepFwd, { kbd: "→" })}
          ${iconBtn("to-end", "Go to end", GLYPH.toEnd, { kbd: "End" })}
          ${iconBtn("loop", "Loop playback", GLYPH.loop, { pressed: false, cls: "nle-ib--toggle" })}
        </div>
        <div class="nle-transport__right" data-nle-transport-right></div>
      </div>
    </section>

    <div class="nle-gutter nle-gutter--v" data-nle-resize="right" role="separator" aria-orientation="vertical" aria-label="Resize the inspector" tabindex="0"></div>
    <aside class="nle-insp" data-nle-insp aria-label="Inspector"></aside>

    <div class="nle-gutter nle-gutter--h" data-nle-resize="tl" role="separator" aria-orientation="horizontal" aria-label="Resize the timeline" tabindex="0"></div>
    <section class="nle-tl" data-nle-tl aria-label="Timeline">${timelineShellHTML()}</section>

    <div class="ap-action-dropdown nle-menu" data-nle-menu role="menu" hidden></div>
    <div class="nle-keys" data-nle-keys role="dialog" aria-label="Keyboard shortcuts" hidden></div>
  </div>`;
}

// The subtitle look, without the safe-area guide (a view setting, not a look).
const styleKey = (cs) => JSON.stringify({ ...cs, deadZones: null });

function mountCaptions() {
  const c = ed.clip;
  const capClip = {
    id: c.id,
    start: ed.w.startMs / 1000,
    end: ed.w.endMs / 1000,
    title: c.title,
    summary: c.summary,
    why: c.why,
    captionState: clipCaptionState(ed.video, c),
    transcript: c.transcript,
  };
  ce.mount(ed.el.querySelector("[data-nle-root]"), capClip, null, {
    clock: {
      seek: (sec) => seek(ed.w.startMs + sec * 1000),
      toggle: () => togglePlay(),
    },
    presetIds: SUBTITLE_IDS,
    cleanup: true,
    onChange: (patch) => {
      ed.caption = patch;
      ed.capDirty = true;
      const look = styleKey(patch.captionState);
      if (look !== ed.capLook) {
        ed.capOwn = true;
        ed.capLook = look;
      }
      const src = ed.el.querySelector("[data-nle-cap-source]");
      if (src) src.innerHTML = capSourceHTML();
      later(paintTimeline);
      later(paintViewerBar);
      setDirty();
    },
  });
  ed.capLook = styleKey(ce.getState());
}

export function capSourceHTML() {
  const label = presetLabel(ce.getState()?.presetId);
  return ed.capOwn
    ? `<span>This clip's own style · <strong>${escapeHtml(label)}</strong></span>
       <button type="button" class="ap-button ghost grey" data-nle="cap-video"><i class="ap-icon-reset" aria-hidden="true"></i><span>Reset to the video's style</span></button>`
    : `<span>The video's style · <strong>${escapeHtml(label)}</strong></span>`;
}

// ── Footage and clock ───────────────────────────────────────────────

function setupVideo() {
  const v = ed.el.querySelector("[data-nle-video]");
  ed.video_el = v;
  v.src = ed.video.url;
  v.volume = ed.volume;
  v.addEventListener("loadedmetadata", () => ed && seek(ed.w.startMs));
  v.addEventListener("seeked", () => ed && !ed.playing && paintFrame());
  v.addEventListener("loadeddata", () => ed && paintFrame());
  const ro = new ResizeObserver(() => {
    if (!ed) return;
    sizeCanvases();
    paintFrame();
    paintTexts();
    ce.repaintStage();
    if (!ed.tl.pxPerMs) fitTimeline();
    else later(paintVisible);
  });
  ro.observe(ed.el.querySelector("[data-nle-stage]"));
  ro.observe(ed.el.querySelector("[data-nle-tl]"));
  ed.disposers.push(() => ro.disconnect());
  paintTransportRight();
  syncTime();
}

// `free`: the playhead may leave the clip — while trimming, to show the edge.
export function seek(ms, { free = false } = {}) {
  if (!ed) return;
  ed.phase = "clip";
  const lo = free ? ed.range.from : ed.w.startMs;
  const hi = free ? ed.range.to : ed.w.endMs - 1;
  ed.t = Math.max(lo, Math.min(hi, ms));
  if (ed.video_el && ed.video_el.readyState >= 1) ed.video_el.currentTime = ed.t / 1000;
  syncTime();
  paintFrame();
}

function togglePlay() {
  if (!ed) return;
  if (ed.playing) return stop();
  play(1);
  return undefined;
}

// dir: 1 forward, negative = J's reverse shuttle (the footage is stepped, paused).
function play(speed) {
  ed.playing = true;
  ed.shuttle = speed;
  const v = ed.video_el;
  const tz = ed.w.teaser;
  if (speed < 0) {
    v.pause();
    ed.phase = "clip";
  } else if (tz.on && (ed.teaserOnly || ed.t <= ed.w.startMs + 60)) {
    ed.phase = "teaser";
    ed.t = ed.w.startMs + tz.startMs;
    v.currentTime = ed.t / 1000;
    v.playbackRate = ed.rate * speed;
    v.play().catch(() => {});
  } else if (ed.w.brand.intro && !ed.tracks.brand.hidden && ed.t <= ed.w.startMs + 60) {
    ed.phase = "intro";
    ed.phaseEnd = performance.now() + CARD_MS;
  } else {
    ed.phase = "clip";
    if (ed.t >= ed.w.endMs - 80) seek(ed.w.startMs);
    v.playbackRate = ed.rate * speed;
    v.play().catch(() => {});
  }
  ed.last = performance.now();
  setPlayIcon();
  cancelAnimationFrame(ed.raf);
  ed.raf = requestAnimationFrame(tick);
}

export function stop() {
  if (!ed) return;
  ed.playing = false;
  ed.shuttle = 0;
  ed.video_el.pause();
  ed.video_el.playbackRate = ed.rate;
  cancelAnimationFrame(ed.raf);
  ed.teaserOnly = false;
  if (ed.phase !== "clip") seek(ed.w.startMs);
  setPlayIcon();
  syncTime();
  paintFrame();
}

function tick(now) {
  if (!ed || !ed.playing) return;
  const dt = now - ed.last;
  ed.last = now;
  const v = ed.video_el;
  if (ed.shuttle < 0) {
    ed.t += dt * ed.shuttle * ed.rate;
    if (ed.t <= ed.w.startMs) {
      ed.t = ed.w.startMs;
      v.currentTime = ed.t / 1000;
      return stop();
    }
    v.currentTime = ed.t / 1000;
  } else if (ed.phase === "teaser") {
    ed.t = v.currentTime * 1000;
    if (ed.t >= ed.w.startMs + ed.w.teaser.endMs) {
      if (ed.teaserOnly) return stop();
      ed.t = ed.w.startMs;
      v.currentTime = ed.t / 1000;
      if (ed.w.brand.intro && !ed.tracks.brand.hidden) {
        v.pause();
        ed.phase = "intro";
        ed.phaseEnd = now + CARD_MS;
      } else ed.phase = "clip";
    }
  } else if (ed.phase === "intro" && now >= ed.phaseEnd) {
    ed.phase = "clip";
    v.play().catch(() => {});
  } else if (ed.phase === "clip") {
    ed.t = v.currentTime * 1000;
    if (ed.t >= ed.w.endMs) {
      if (ed.loop) {
        ed.t = ed.w.startMs;
        v.currentTime = ed.t / 1000;
      } else if (ed.w.brand.outro && !ed.tracks.brand.hidden) {
        v.pause();
        ed.phase = "outro";
        ed.phaseEnd = now + CARD_MS;
      } else {
        ed.t = ed.w.endMs - 1;
        return stop();
      }
    }
  } else if (ed.phase === "outro" && now >= ed.phaseEnd) {
    return stop();
  }
  syncTime();
  paintFrame();
  if (ed.phase === "clip") revealPlayhead();
  ed.raf = requestAnimationFrame(tick);
  return undefined;
}

function setPlayIcon() {
  const i = ed.el.querySelector("[data-nle-play-icon]");
  if (i) i.className = ed.playing ? "ap-icon-pause" : "ap-icon-play";
  const b = ed.el.querySelector('[data-nle="play"]');
  if (b) b.setAttribute("aria-label", ed.playing ? "Pause" : "Play");
}

export function syncTime() {
  if (!ed) return;
  const root = ed.el.querySelector("[data-nle-root]");
  root.dataset.phase = ed.phase;
  const tc = ed.el.querySelector("[data-nle-tc]");
  if (tc && document.activeElement !== tc)
    tc.value = ed.phase === "clip" ? fmtTC(rel()) : { intro: "Intro", outro: "Outro", teaser: "Teaser" }[ed.phase];
  const len = ed.el.querySelector("[data-nle-len]");
  if (len) len.textContent = fmtTC(clipLen());
  const stc = ed.el.querySelector("[data-nle-src-tc]");
  if (stc) stc.textContent = fmtTC(ed.t);
  ce.setTime(Math.max(0, rel()) / 1000, ed.playing);
  paintPlayhead();
  const seg = segmentAt(ed.w.segments, ed.t);
  if (seg.id !== ed.curSeg) {
    ed.curSeg = seg.id;
    later(paintTimeline);
  }
  paintTextsVisibility();
}

// ── Viewer ──────────────────────────────────────────────────────────

function fitIn(body, aspect) {
  const bw = body.clientWidth;
  const bh = body.clientHeight;
  let w = bw;
  let h = w / aspect;
  if (h > bh) {
    h = bh;
    w = h * aspect;
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

function sizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  const out = ed.el.querySelector("[data-nle-output]");
  const o = fitIn(ed.el.querySelector("[data-nle-output-wrap]"), ratio());
  out.style.width = `${o.w}px`;
  out.style.height = `${o.h}px`;
  const oc = ed.el.querySelector("[data-nle-out]");
  oc.width = Math.round(o.w * dpr);
  oc.height = Math.round(o.h * dpr);
  const src = ed.el.querySelector("[data-nle-source]");
  const body = ed.el.querySelector("[data-nle-source-body]");
  if (body.clientWidth) {
    const f = fitIn(body, ed.ctx.W / ed.ctx.H);
    src.style.width = `${f.w}px`;
    src.style.height = `${f.h}px`;
  }
  const ov = ed.el.querySelector("[data-nle-overlay]");
  ov.width = Math.round(ov.clientWidth * dpr);
  ov.height = Math.round(ov.clientHeight * dpr);
  const meta = ed.el.querySelector("[data-nle-program-meta]");
  if (meta) meta.textContent = `${formatLabel(ed.w.ratioId)} · ${o.w}×${o.h}`;
}

function currentRes() {
  return resolve(ed.ctx, segmentAt(ed.w.segments, ed.t), ed.t, ratio());
}

export function paintFrame() {
  if (!ed) return;
  const oc = ed.el.querySelector("[data-nle-out]");
  if (!oc.width) sizeCanvases();
  const c2d = oc.getContext("2d");
  const outside = ed.t < ed.w.startMs || ed.t >= ed.w.endMs;
  if (ed.phase === "intro" || ed.phase === "outro") paintCard(c2d, oc.width, oc.height);
  else drawOutput(c2d, ed.video_el, ed.ctx, currentRes(), oc.width, oc.height);
  ed.el.querySelector("[data-nle-output]").classList.toggle("is-outside", outside);
  if (ed.mode === "dual") paintOverlay();
  paintLogo();
}

function paintCard(c2d, w, h) {
  const pb = ed.pb;
  const bg = pb?.brandColors?.find((c) => /primary/i.test(c.name))?.hex || "#1A1F36";
  c2d.fillStyle = bg;
  c2d.fillRect(0, 0, w, h);
  c2d.fillStyle = "#fff";
  c2d.textAlign = "center";
  c2d.font = `700 ${Math.round(w * 0.075)}px Montserrat, sans-serif`;
  c2d.fillText(ed.phase === "intro" ? ed.w.title : pb?.cta || pb?.brandName || "", w / 2, h * 0.62, w * 0.86);
  const img = ed.cardLogo;
  if (img?.complete && img.naturalWidth) {
    const lw = w * 0.4;
    const lh = (lw * img.naturalHeight) / img.naturalWidth;
    c2d.drawImage(img, (w - lw) / 2, h * 0.38 - lh / 2, lw, lh);
  }
}

// The crop windows on the Source monitor: the current part's, editable when a
// part is selected (or the playhead's part when nothing is).
function paintOverlay() {
  const ov = ed.el.querySelector("[data-nle-overlay]");
  const c = ov.getContext("2d");
  const cw = ov.width;
  const ch = ov.height;
  const dpr = window.devicePixelRatio || 1;
  const seg = segmentAt(ed.w.segments, ed.t);
  const res = currentRes();
  c.clearRect(0, 0, cw, ch);
  c.fillStyle = "rgba(0,0,0,.6)";
  c.beginPath();
  c.rect(0, 0, cw, ch);
  if (res.kind !== "fit") res.rects.forEach((r) => c.rect(r.x * cw, r.y * ch, r.w * cw, r.h * ch));
  c.fill("evenodd");
  c.lineWidth = 2 * dpr;
  res.rects.forEach((r, i) => {
    c.strokeStyle = seg.layout === "AUTO" ? "rgba(255,255,255,.75)" : "#fff";
    c.setLineDash(seg.layout === "AUTO" ? [8 * dpr, 6 * dpr] : []);
    c.strokeRect(r.x * cw, r.y * ch, r.w * cw, r.h * ch);
    c.setLineDash([]);
    c.fillStyle = "#fff";
    corners(r).forEach(([x, y]) => c.fillRect(x * cw - 5 * dpr, y * ch - 5 * dpr, 10 * dpr, 10 * dpr));
    if (res.kind === "two") {
      c.font = `${12 * dpr}px Averta, sans-serif`;
      c.fillText(i === 0 ? "Top" : "Bottom", r.x * cw + 8 * dpr, r.y * ch + 18 * dpr);
    }
  });
  if (res.kind === "fit") {
    c.fillStyle = "#fff";
    c.font = `${13 * dpr}px Averta, sans-serif`;
    c.fillText("Fit: the whole frame, on a blurred fill", 12 * dpr, ch - 14 * dpr);
  }
}

const corners = (r) => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x, r.y + r.h],
  [r.x + r.w, r.y + r.h],
];

function paintLogo() {
  const img = ed.el.querySelector("[data-nle-logo]");
  const b = ed.w.brand;
  const src = ed.pb?.brandLogo;
  if (!img) return;
  img.hidden = !(b.logo && src && ed.phase === "clip" && !ed.tracks.brand.hidden);
  if (img.hidden) return;
  if (img.getAttribute("src") !== src) img.src = src;
  img.style.width = `${b.logoSize * 100}%`;
  img.dataset.corner = b.corner;
  img.classList.toggle("is-selected", ed.sel?.kind === "brand" && ed.sel.item === "logo");
  const z = DEAD_ZONES[ed.deadZones] || { top: 0, bottom: 0, right: 0 };
  img.style.setProperty("--dz-top", `${z.top * 100}%`);
  img.style.setProperty("--dz-bottom", `${z.bottom * 100}%`);
  img.style.setProperty("--dz-right", `${z.right * 100}%`);
}

// The texts on the Program: each a layer; the selected one framed with handles
// to resize it, and its animation played in and out.
export function paintTexts() {
  const host = ed.el.querySelector("[data-nle-texts]");
  if (!host) return;
  const out = ed.el.querySelector("[data-nle-output]");
  const k = (out.clientWidth || 300) / 1080;
  const sel = new Set(selTexts().map((t) => t.id));
  const handles = ["nw", "ne", "se", "sw"]
    .map((d) => `<span class="nle-text__handle nle-text__handle--${d}" data-nle-text-handle="${d}"></span>`)
    .join("");
  host.innerHTML = ed.w.texts
    .map(
      (
        tx,
      ) => `<div class="nle-text nle-text--${tx.style}${sel.has(tx.id) ? " is-selected" : ""}" data-nle-text="${tx.id}"
        style="left:${tx.x * 100}%;top:${tx.y * 100}%;font-size:${Math.round(tx.size * k)}px">${escapeHtml(tx.text)}${sel.size === 1 && sel.has(tx.id) ? handles : ""}</div>`,
    )
    .join("");
  paintTextsVisibility();
}

// In / out animations: a text eases in over its first 300 ms, out over its last.
function animStyle(kind, p) {
  const q = Math.max(0, Math.min(1, p));
  const e = 1 - (1 - q) ** 3;
  if (kind === "fade") return { o: e, tf: "" };
  if (kind === "pop") return { o: e, tf: ` scale(${0.6 + 0.4 * e})` };
  if (kind === "slide") return { o: e, tf: ` translateY(${(1 - e) * 24}px)` };
  return { o: 1, tf: "" };
}

function paintTextsVisibility() {
  const r = rel();
  const hidden = ed.tracks.text.hidden;
  ed.el.querySelectorAll("[data-nle-text]").forEach((n) => {
    const tx = txById(n.dataset.nleText);
    const on = tx && !hidden && ed.phase === "clip" && r >= tx.startMs && r <= tx.endMs;
    const selected = n.classList.contains("is-selected");
    n.classList.toggle("is-off", !on);
    if (!tx || !on) {
      n.style.opacity = "";
      n.style.transform = "";
      return;
    }
    const a = r - tx.startMs < ANIM_MS ? animStyle(tx.animIn, (r - tx.startMs) / ANIM_MS) : null;
    const b = tx.endMs - r < ANIM_MS ? animStyle(tx.animOut, (tx.endMs - r) / ANIM_MS) : null;
    const s = a && (!b || a.o < b.o) ? a : b;
    // While selected the text stays fully visible, so it can be placed.
    n.style.opacity = s && !selected ? String(s.o) : "";
    n.style.transform = s && !selected ? `translate(-50%, -50%)${s.tf}` : "";
  });
}

function paintViewerBar() {
  const host = ed.el.querySelector("[data-nle-viewer-bar]");
  if (!host) return;
  const seg = (id, label) =>
    `<button type="button" class="ap-segmented-control__segment${ed.mode === id ? " ap-segmented-control__segment--selected" : ""}"
      data-nle-mode="${id}" aria-pressed="${ed.mode === id}"><span class="ap-segmented-control__label">${label}</span></button>`;
  const videoRatio = ed.video.settings.ratio;
  const own = ed.w.ratioId !== videoRatio;
  host.innerHTML = `
    <div class="ap-segmented-control" role="group" aria-label="Monitors">${seg("program", "Output")}${seg("dual", "Source + output")}</div>
    <div class="nle-viewer__opts">
      ${dsSelect({
        label: "Safe area",
        valueHtml: `${dzIcon(ed.deadZones)}<span>${escapeHtml(DEAD_ZONE_LABELS[ed.deadZones] || "No guide")}</span>`,
        current: ed.deadZones,
        attr: "data-nle-deadzones",
        ariaLabel: "Show where the app's buttons cover the video",
        extraClass: "nle-select",
        options: Object.entries(DEAD_ZONE_LABELS).map(([id, label]) => ({ id, label, lead: dzIcon(id) })),
      })}
      ${dsSelect({
        label: "Format",
        valueHtml: escapeHtml(formatLabel(ed.w.ratioId)),
        current: own ? ed.w.ratioId : "video",
        attr: "data-nle-format",
        ariaLabel: "Format of this clip",
        extraClass: "nle-select",
        options: [
          { id: "video", label: `Same as the video · ${formatLabel(videoRatio)}` },
          ...RATIO_IDS.map((id) => ({ id, label: formatLabel(id), meta: bestFor(id) })),
        ],
      })}
      <button type="button" class="ap-icon-button transparent nle-ib" data-nle="fullscreen" aria-label="Full screen" data-tooltip="Full screen · F">
        <i class="ap-icon-maximize" aria-hidden="true"></i></button>
    </div>`;
}

function paintTransportRight() {
  const host = ed.el.querySelector("[data-nle-transport-right]");
  if (!host) return;
  const muted = ed.muted;
  host.innerHTML = `
    ${dsSelect({
      label: "Speed",
      valueHtml: `${ed.rate}×`,
      current: String(ed.rate),
      attr: "data-nle-rate",
      ariaLabel: "Playback speed",
      extraClass: "nle-select nle-select--up",
      options: ["0.5", "1", "1.5", "2"].map((r) => ({ id: r, label: `${r}×` })),
    })}
    ${iconBtn("mute", muted ? "Unmute" : "Mute", muted ? GLYPH.muted : GLYPH.volume, { pressed: muted, cls: "nle-ib--toggle" })}
    <input type="range" class="ap-slider nle-volume" min="0" max="1" step="0.05" value="${muted ? 0 : ed.volume}"
      data-nle-volume aria-label="Volume" style="--fill:${(muted ? 0 : ed.volume) * 100}%" />`;
}

// ── Panels ──────────────────────────────────────────────────────────

function paintLibrary() {
  const host = ed.el.querySelector("[data-nle-lib]");
  if (!host) return;
  host.innerHTML = libraryHTML();
  if (ed.lib === "transcript") ce.refreshControls();
}

export function paintInspector() {
  const host = ed.el.querySelector("[data-nle-insp]");
  if (!host) return;
  // Typing in the inspector mustn't lose its field: keep focus and caret.
  const f = document.activeElement;
  const keep =
    host.contains(f) && f.dataset?.nleField
      ? { key: f.dataset.nleField, s: f.selectionStart, e: f.selectionEnd }
      : null;
  host.innerHTML = inspectorHTML();
  if (ed.sel?.kind === "captions") ce.refreshControls();
  if (keep) {
    const n = host.querySelector(`[data-nle-field="${keep.key}"]`);
    if (n) {
      n.focus();
      try {
        n.setSelectionRange(keep.s, keep.e);
      } catch {}
    }
  }
  ed.el.querySelector("[data-nle-root]").dataset.sel = ed.sel?.kind || "none";
}

// ── Selection ───────────────────────────────────────────────────────

export function select(sel, { additive = false } = {}) {
  if (additive && sel?.kind === "text" && ed.sel?.kind === "text") {
    const ids = new Set(ed.sel.ids);
    for (const id of sel.ids) ids.has(id) ? ids.delete(id) : ids.add(id);
    sel = ids.size ? { kind: "text", ids: [...ids] } : null;
  }
  const was = ed.sel?.kind;
  ed.sel = sel;
  // A framing part is edited on the Source: the two monitors come up.
  if (sel?.kind === "seg" && ed.mode !== "dual") setMode("dual");
  else if (was === "seg" && sel?.kind !== "seg" && ed.autoDual) setMode("program");
  if (sel?.kind === "seg") ed.autoDual = ed.autoDual ?? true;
  paintInspector();
  paintTexts();
  paintTimeline();
  paintFrame();
  if (ed.lib === "text") paintLibrary();
}

function setMode(mode, { user = false } = {}) {
  ed.mode = mode;
  if (user) ed.autoDual = false;
  else if (mode === "dual") ed.autoDual = true;
  if (mode === "program") ed.autoDual = null;
  ed.el.querySelector("[data-nle-root]").dataset.mode = mode;
  paintViewerBar();
  sizeCanvases();
  paintFrame();
  paintTexts();
  ce.repaintStage();
}

// ── Edits, undo ─────────────────────────────────────────────────────

const snapshot = () => JSON.stringify(ed.w);

export function pushUndo() {
  ed.undo.push(snapshot());
  if (ed.undo.length > 200) ed.undo.shift();
  ed.redo = [];
}

// A grab that changed nothing leaves nothing to undo.
export function dropNoopUndo() {
  if (ed.undo.at(-1) === snapshot()) ed.undo.pop();
  syncTopbar();
}

function restore(json) {
  const prev = { s: ed.w.startMs, e: ed.w.endMs };
  ed.w = JSON.parse(json);
  if (prev.s !== ed.w.startMs || prev.e !== ed.w.endMs) applyRange();
  if (ed.sel?.kind === "text") ed.sel.ids = ed.sel.ids.filter(txById);
  if (ed.sel?.kind === "text" && !ed.sel.ids.length) ed.sel = null;
  if (ed.sel?.kind === "seg" && !selSeg()) ed.sel = null;
  setDirty();
  refreshAll();
}

export function setDirty() {
  ed.dirty = ed.capDirty || snapshot() !== ed.saved;
  syncTopbar();
}

export function refreshAll() {
  syncTopbar();
  sizeCanvases();
  paintViewerBar();
  paintInspector();
  paintTimeline();
  paintTexts();
  seek(Math.max(ed.w.startMs, Math.min(ed.w.endMs - 1, ed.t)));
}

// Every change goes through here: undo point, the change, then the repaint.
export function edit(fn, { inspector = true } = {}) {
  pushUndo();
  fn();
  setDirty();
  if (inspector) paintInspector();
  paintTimeline();
  paintTexts();
  paintFrame();
  if (ed.lib !== "transcript") paintLibrary();
}

function undo() {
  if (!ed.undo.length) return;
  ed.redo.push(snapshot());
  restore(ed.undo.pop());
}

function redo() {
  if (!ed.redo.length) return;
  ed.undo.push(snapshot());
  restore(ed.redo.pop());
}

function save() {
  const c = ed.clip;
  const patch = {
    title: ed.w.title.trim() || c.title,
    startMs: ed.w.startMs,
    endMs: ed.w.endMs,
    segments: ed.w.segments,
    texts: ed.w.texts,
    teaser: ed.w.teaser,
    ratio: ed.w.ratioId === ed.video.settings.ratio && !c.ratio ? null : ed.w.ratioId,
    brand: JSON.stringify(ed.w.brand) === JSON.stringify(ed.look.brand) ? null : ed.w.brand,
  };
  if (c.startMs !== ed.w.startMs || c.endMs !== ed.w.endMs) patch.trimmed = true;
  if (ed.caption) {
    patch.transcript = ed.caption.transcript;
    Object.assign(
      patch,
      ed.capOwn
        ? { captionState: ed.caption.captionState, captionCustom: true }
        : { captionState: null, captionCustom: false },
    );
  }
  updateClip(ed.video.id, c.id, patch);
  ed.video.clips.sort((x, y) => x.startMs - y.startMs);
  ed.saved = snapshot();
  ed.capDirty = false;
  ed.dirty = false;
  ed.changed = true;
  renderClip(ed.video.id, c.id);
  syncTopbar();
}

function leave(to) {
  if (!ed.dirty) return navigate(to);
  openConfirm({
    title: "Save your changes?",
    body: "This clip has changes you haven't saved.",
    confirmLabel: "Save changes",
    cancelLabel: "Discard changes",
    onConfirm: () => {
      save();
      navigate(to);
    },
    onCancel: () => {
      ed.discard = true;
      navigate(to);
    },
  });
  return undefined;
}

// ── Trim: the clip's range, its parts, texts and words follow ───────

// The words ce holds now, back into the whole window's list (so edits to the
// words survive a trim), then cut to the clip's current range.
function applyRange() {
  const b = ed.wordsBase;
  const now = ce.getWords().map((w) => ({ ...w, start: w.start * 1000 + b.s, end: w.end * 1000 + b.s }));
  ed.srcWords = [...ed.srcWords.filter((w) => w.end <= b.s || w.start >= b.e), ...now].sort(
    (x, y) => x.start - y.start,
  );
  const { startMs: s, endMs: e } = ed.w;
  const len = (e - s) / 1000;
  const words = ed.srcWords
    .filter((w) => w.end > s && w.start < e)
    .map((w) => ({ ...w, start: Math.max(0, (w.start - s) / 1000), end: Math.min(len, (w.end - s) / 1000) }));
  ed.wordsBase = { s, e };
  ce.setWords(words, len);
}

// The clip's new range. Texts and the teaser stay on the footage they were on
// (a head trim shifts them, like any editor's ripple); parts stretch or drop.
export function trimTo(s, e) {
  s = Math.round(Math.max(ed.range.from, Math.min(s, e - MIN_CLIP_MS)));
  e = Math.round(Math.min(ed.range.to, Math.max(e, s + MIN_CLIP_MS)));
  if (s === ed.w.startMs && e === ed.w.endMs) return false;
  const shift = ed.w.startMs - s;
  const len = e - s;
  ed.w.segments = retrim(ed.ctx, ed.w.segments, s, e);
  ed.w.texts = ed.w.texts
    .map((tx) => ({ ...tx, startMs: tx.startMs + shift, endMs: tx.endMs + shift }))
    .filter((tx) => tx.endMs > MIN_TEXT_MS / 2 && tx.startMs < len - MIN_TEXT_MS / 2)
    .map((tx) => ({ ...tx, startMs: Math.max(0, tx.startMs), endMs: Math.min(len, tx.endMs) }));
  const tz = ed.w.teaser;
  tz.startMs = Math.max(0, Math.min(len - 1000, tz.startMs + shift));
  tz.endMs = Math.max(tz.startMs + 1000, Math.min(len, tz.endMs + shift));
  ed.w.startMs = s;
  ed.w.endMs = e;
  applyRange();
  return true;
}

function setInOut(which) {
  const t = snapFrame(ed.t);
  const ok = (() => {
    pushUndo();
    return which === "in" ? trimTo(t, ed.w.endMs) : trimTo(ed.w.startMs, t + FRAME_MS);
  })();
  if (!ok) {
    ed.undo.pop();
    return showToast(
      `A clip can't be shorter than ${MIN_CLIP_MS / 1000} seconds. Move the playhead further from the other edge.`,
      { variant: "error" },
    );
  }
  setDirty();
  refreshAll();
  showToast(`Clip trimmed · ${fmtTC(clipLen())} long`);
  return undefined;
}

// ── Texts ───────────────────────────────────────────────────────────

export function addText(presetId, atRel = Math.max(0, rel())) {
  const p = TEXT_PRESETS.find((x) => x.id === presetId) || TEXT_PRESETS[0];
  const len = clipLen();
  const dur = Math.min(p.dur || 3000, len);
  const start = p.at === "end" ? Math.max(0, len - dur) : Math.max(0, Math.min(len - dur, atRel));
  const id = uid("tx");
  edit(() => {
    ed.w.texts.push({
      id,
      text: p.text(ed),
      startMs: Math.round(start),
      endMs: Math.round(start + dur),
      x: 0.5,
      y: p.y,
      size: p.size,
      style: p.style,
      animIn: p.animIn || "fade",
      animOut: p.animOut || "fade",
    });
    ed.sel = { kind: "text", ids: [id] };
  });
  seek(ed.w.startMs + start + 1);
  later(() => ed.el.querySelector('[data-nle-field="text"]')?.select());
}

function splitTexts(ts, at) {
  let n = 0;
  for (const tx of ts) {
    if (at - tx.startMs < MIN_TEXT_MS || tx.endMs - at < MIN_TEXT_MS) continue;
    const copy = { ...tx, id: uid("tx"), startMs: at };
    tx.endMs = at;
    ed.w.texts.push(copy);
    n++;
  }
  return n;
}

// Split at the playhead (S / ⌘K): the selected texts under it, else the
// framing part under it.
function splitAtPlayhead() {
  const at = Math.round(snapFrame(rel()));
  const under = selTexts().filter((tx) => at > tx.startMs && at < tx.endMs);
  if (under.length && !ed.tracks.text.locked) {
    pushUndo();
    if (!splitTexts(under, at)) {
      ed.undo.pop();
      return showToast("Can't split this close to the text's edge. Move the playhead further in.", {
        variant: "error",
      });
    }
    setDirty();
    paintTimeline();
    paintTexts();
    return undefined;
  }
  return splitPartAt(ed.t);
}

export function splitPartAt(ms) {
  if (ed.tracks.video.locked)
    return showToast("The Video track is locked. Unlock it to split a part.", { variant: "error" });
  const { t } = snapMs(ed.ctx, Math.round(ms), { on: ed.snap });
  pushUndo();
  if (!split(ed.ctx, ed.w.segments, t)) {
    ed.undo.pop();
    return showToast("Can't split this close to a part's edge. Move the playhead further in.", { variant: "error" });
  }
  setDirty();
  paintInspector();
  paintTimeline();
  paintFrame();
  return undefined;
}

export function splitTextAt(id, atRel) {
  const tx = txById(id);
  if (!tx) return;
  pushUndo();
  if (!splitTexts([tx], Math.round(atRel))) return void ed.undo.pop();
  setDirty();
  paintTimeline();
  paintTexts();
}

function deleteSelection() {
  const s = ed.sel;
  if (!s) return;
  if (s.kind === "text" && !ed.tracks.text.locked)
    edit(() => {
      const ids = new Set(s.ids);
      ed.w.texts = ed.w.texts.filter((x) => !ids.has(x.id));
      ed.sel = null;
    });
  else if (s.kind === "seg" && !ed.tracks.video.locked) {
    // Deleting a part joins it with its neighbour: the clip stays whole.
    const i = ed.w.segments.findIndex((x) => x.id === s.id);
    if (ed.w.segments.length < 2 || i < 0)
      return void showToast("A clip needs at least one part, so this one stays.", { variant: "error" });
    edit(() => merge(ed.ctx, ed.w.segments, ed.w.segments[i], i > 0 ? -1 : 1));
    select({ kind: "seg", id: segmentAt(ed.w.segments, ed.t).id });
  } else if (s.kind === "brand")
    edit(() => {
      ed.w.brand[s.item] = false;
      ed.sel = null;
    });
}

function copySelection() {
  const ts = selTexts();
  if (!ts.length) return false;
  clipboard = JSON.parse(JSON.stringify(ts));
  showToast(ts.length === 1 ? "Text copied" : `${ts.length} texts copied`);
  return true;
}

// Pasted at the playhead, keeping the texts' spacing between them.
function paste(items = clipboard, at = rel()) {
  if (!items.length || ed.tracks.text.locked) return;
  const first = Math.min(...items.map((t) => t.startMs));
  const len = clipLen();
  const ids = [];
  edit(() => {
    for (const t of items) {
      const d = t.endMs - t.startMs;
      const s = Math.max(0, Math.min(len - Math.min(d, len), Math.round(at + t.startMs - first)));
      const id = uid("tx");
      ed.w.texts.push({ ...t, id, startMs: s, endMs: Math.min(len, s + d) });
      ids.push(id);
    }
    ed.sel = { kind: "text", ids };
  });
}

function duplicateSelection() {
  const ts = selTexts();
  if (!ts.length) return;
  const end = Math.max(...ts.map((t) => t.endMs));
  paste(ts, end);
}

// Every point worth stopping at: the clip's ends, parts, texts.
export function editPoints() {
  const s = ed.w.startMs;
  return [
    s,
    ed.w.endMs - 1,
    ...ed.w.segments.slice(1).map((g) => g.startMs),
    ...ed.w.texts.flatMap((t) => [s + t.startMs, s + t.endMs]),
  ]
    .filter((t) => t >= s && t < ed.w.endMs)
    .sort((a, b) => a - b);
}

function jumpEdit(dir) {
  const pts = editPoints();
  const t = dir > 0 ? pts.find((p) => p > ed.t + 1) : [...pts].reverse().find((p) => p < ed.t - 1);
  if (t != null) {
    seek(t);
    revealPlayhead();
  }
}

// ── Context menu ────────────────────────────────────────────────────

const menuItem = (act, label, { kbd = "", icon = "", disabled = false, data = "" } = {}) =>
  `<button type="button" role="menuitem" class="ap-action-dropdown-item nle-menu__item" data-nle-menu-act="${act}" ${data} ${disabled ? "disabled" : ""}>
    ${icon ? `<span class="nle-menu__icon">${icon}</span>` : ""}
    <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">${label}</span></div></div>
    ${kbd ? `<kbd class="nle-kbd">${kbd}</kbd>` : ""}
  </button>`;
const SEP = `<div class="ap-action-dropdown-divider nle-menu__sep" role="separator"></div>`;

export function openMenu(x, y, target) {
  const m = ed.el.querySelector("[data-nle-menu]");
  const hasClip = clipboard.length > 0;
  let html = "";
  if (target.kind === "text") {
    html =
      menuItem("split", "Split at the playhead", { kbd: "S", icon: GLYPH.cut }) +
      menuItem("duplicate", "Duplicate text", { kbd: "⌘D", icon: `<i class="ap-icon-copy"></i>` }) +
      menuItem("copy", "Copy text", { kbd: "⌘C" }) +
      menuItem("paste", "Paste at the playhead", { kbd: "⌘V", disabled: !hasClip }) +
      SEP +
      menuItem("delete", "Delete text", { kbd: "⌫", icon: `<i class="ap-icon-trash"></i>` });
  } else if (target.kind === "seg") {
    const i = ed.w.segments.findIndex((s) => s.id === target.id);
    html =
      menuItem("split-part", "Split the part here", { kbd: "S", icon: GLYPH.cut }) +
      menuItem("join-prev", "Join previous part", { disabled: i < 1 }) +
      menuItem("join-next", "Join next part", { disabled: i >= ed.w.segments.length - 1 }) +
      SEP +
      menuItem("reset-seg", "Reset part", { icon: `<i class="ap-icon-reset"></i>` }) +
      menuItem("set-in", "Start the clip here", { kbd: "I" }) +
      menuItem("set-out", "End the clip here", { kbd: "O" });
  } else {
    html =
      menuItem("add-text", "Add text here", { kbd: "T", icon: `<i class="ap-icon-plus"></i>` }) +
      menuItem("paste", "Paste here", { kbd: "⌘V", disabled: !hasClip }) +
      SEP +
      menuItem("set-in", "Start the clip here", { kbd: "I" }) +
      menuItem("set-out", "End the clip here", { kbd: "O" });
  }
  m.innerHTML = html;
  m.hidden = false;
  const r = ed.el.querySelector("[data-nle-root]").getBoundingClientRect();
  const w = m.offsetWidth;
  const h = m.offsetHeight;
  m.style.left = `${Math.min(x - r.left, r.width - w - 8)}px`;
  m.style.top = `${Math.min(y - r.top, r.height - h - 8)}px`;
  m.querySelector("button:not([disabled])")?.focus();
}

function closeMenu() {
  const m = ed?.el.querySelector("[data-nle-menu]");
  if (m && !m.hidden) {
    m.hidden = true;
    m.innerHTML = "";
  }
}

function runMenu(act) {
  closeMenu();
  const s = ed.sel;
  switch (act) {
    case "split":
      return splitAtPlayhead();
    case "split-part":
      return splitPartAt(ed.t);
    case "duplicate":
      return duplicateSelection();
    case "copy":
      return copySelection();
    case "paste":
      return paste();
    case "delete":
      return deleteSelection();
    case "join-prev":
    case "join-next": {
      const i = ed.w.segments.findIndex((x) => x.id === s?.id);
      if (i < 0) return undefined;
      edit(() => merge(ed.ctx, ed.w.segments, ed.w.segments[i], act === "join-prev" ? -1 : 1));
      return select({ kind: "seg", id: segmentAt(ed.w.segments, ed.t).id });
    }
    case "reset-seg":
      return selSeg() && edit(() => resetSegment(ed.ctx, selSeg()));
    case "set-in":
      return setInOut("in");
    case "set-out":
      return setInOut("out");
    case "add-text":
      return addText("body");
    default:
      return undefined;
  }
}

// ── Keyboard shortcuts sheet ────────────────────────────────────────

const SHORTCUTS = [
  [
    "Playback",
    [
      ["Space", "Play / pause"],
      ["J · K · L", "Play backward · stop · play forward (press again to go faster)"],
      ["← →", "Previous / next frame"],
      ["⇧← ⇧→", "One second back / forward"],
      ["↑ ↓", "Previous / next edit point"],
      ["Home · End", "Start / end of the clip"],
    ],
  ],
  [
    "Editing",
    [
      ["S · ⌘K", "Split at the playhead"],
      ["I · O", "Set the clip's start / end at the playhead"],
      ["T", "Add text at the playhead"],
      ["⌫", "Delete the selection"],
      ["⌘C · ⌘V · ⌘D", "Copy · paste · duplicate texts"],
      ["⌘A", "Select every text"],
      ["⌥ + arrows", "Nudge the selected text"],
    ],
  ],
  [
    "Timeline",
    [
      ["V · B", "Select tool · split tool"],
      ["N", "Turn snapping on or off"],
      ["⌘+ · ⌘−", "Zoom in / out"],
      ["⇧Z", "Fit the clip in the timeline"],
      ["⌥ while dragging", "Drag without snapping"],
    ],
  ],
  [
    "General",
    [
      ["⌘Z · ⇧⌘Z", "Undo · redo"],
      ["⌘S", "Save changes"],
      ["F", "Full screen"],
      ["Esc", "Deselect · close"],
      ["?", "Show this list"],
    ],
  ],
];

function toggleKeys(force) {
  const k = ed.el.querySelector("[data-nle-keys]");
  const open = force ?? k.hidden;
  if (!open) {
    k.hidden = true;
    return;
  }
  k.innerHTML = `
    <header class="nle-keys__head">
      <h2 class="nle-keys__title">Keyboard shortcuts</h2>
      <button type="button" class="ap-icon-button transparent" data-nle="keys-close" aria-label="Close"><i class="ap-icon-close" aria-hidden="true"></i></button>
    </header>
    <div class="nle-keys__grid">${SHORTCUTS.map(
      ([g, rows]) =>
        `<section><h3 class="nle-keys__group">${g}</h3><dl>${rows
          .map(
            ([key, what]) =>
              `<div class="nle-keys__row"><dt><kbd class="nle-kbd">${key}</kbd></dt><dd>${what}</dd></div>`,
          )
          .join("")}</dl></section>`,
    ).join("")}</div>`;
  k.hidden = false;
  k.querySelector("button")?.focus();
}

// ── Events ──────────────────────────────────────────────────────────

function bindAll() {
  const root = ed.el;
  const topbar = document.getElementById("topbar");
  const on = (target, type, fn, opts) => {
    target?.addEventListener(type, fn, opts);
    ed.disposers.push(() => target?.removeEventListener(type, fn, opts));
  };
  on(root, "click", handleClick);
  on(topbar, "click", handleClick);
  on(root, "input", handleInput);
  on(root, "change", handleChange);
  on(root, "pointerdown", handlePointerDown);
  on(root, "pointermove", (e) => timelinePointerMove(e));
  on(root, "contextmenu", handleContextMenu);
  on(root, "dblclick", handleDblClick);
  on(root, "dragstart", handleDragStart);
  on(root, "dragover", (e) => e.target.closest?.("[data-nle-scroll]") && e.preventDefault());
  on(root, "drop", (e) => timelineDrop(e));
  on(document, "keydown", handleKey);
  on(document, "fullscreenchange", () => ed && (sizeCanvases(), paintFrame(), paintTexts(), ce.repaintStage()));
  const scroller = root.querySelector("[data-nle-scroll]");
  on(scroller, "scroll", () => later(paintVisible));
  on(scroller, "wheel", (e) => timelineWheel(e), { passive: false });
  ed.disposers.push(bindSelectDismiss(root));
  ed.cardLogo = new Image();
  if (ed.pb?.brandLogo) ed.cardLogo.src = ed.pb.brandLogo;
}

function handleClick(e) {
  if (!ed) return undefined;
  const t = e.target;
  if (!t.closest("[data-nle-menu]")) closeMenu();
  const menuAct = t.closest("[data-nle-menu-act]")?.dataset.nleMenuAct;
  if (menuAct) return runMenu(menuAct);
  const goto = t.closest("[data-nle-goto]")?.dataset.nleGoto;
  if (goto) return leave(`/clips/${ed.video.id}/edit/${goto}`);
  const libTab = t.closest("[data-nle-lib-tab]")?.dataset.nleLibTab;
  if (libTab) {
    ed.lib = libTab;
    return paintLibrary();
  }
  const mode = t.closest("[data-nle-mode]")?.dataset.nleMode;
  if (mode) return setMode(mode, { user: true });
  const preset = t.closest("[data-nle-text-preset]")?.dataset.nleTextPreset;
  if (preset) return addText(preset);
  const pickText = t.closest("[data-nle-pick-text]")?.dataset.nlePickText;
  if (pickText) {
    const tx = txById(pickText);
    if (tx) seek(ed.w.startMs + tx.startMs + 1);
    select({ kind: "text", ids: [pickText] }, { additive: e.shiftKey });
    revealPlayhead();
    return paintLibrary();
  }
  const sel = t.closest("[data-nle-select]")?.dataset.nleSelect;
  if (sel && !t.closest("[data-nle-scroll]")) {
    const [kind, item] = sel.split(":");
    return select(kind === "none" ? null : kind === "brand" ? { kind, item } : { kind });
  }
  const act = t.closest("[data-nle]")?.dataset.nle;
  const seg = selSeg() || segmentAt(ed.w.segments, ed.t);
  switch (act) {
    case "back":
      return leave(`/clips/${ed.video.id}`);
    case "rename":
      return openRename({
        title: "Rename the clip",
        initialName: ed.w.title,
        placeholder: "Clip title",
        confirmLabel: "Rename",
        onSubmit: (name) => edit(() => (ed.w.title = name)),
      });
    case "undo":
      return undo();
    case "redo":
      return redo();
    case "save":
      return ed.dirty ? save() : undefined;
    case "draft":
      if (ed.dirty) save();
      return writePostsInChat(ed.video, [ed.clip.id]);
    case "play":
      return togglePlay();
    case "to-start":
      if (ed.playing) stop();
      seek(ed.w.startMs);
      return revealPlayhead();
    case "to-end":
      if (ed.playing) stop();
      seek(ed.w.endMs - 1);
      return revealPlayhead();
    case "step-back":
    case "step-fwd":
      if (ed.playing) stop();
      return seek(ed.t + (act === "step-fwd" ? FRAME_MS : -FRAME_MS));
    case "loop":
      ed.loop = !ed.loop;
      t.closest("[data-nle]").setAttribute("aria-pressed", String(ed.loop));
      return undefined;
    case "mute":
      ed.muted = !ed.muted;
      ed.video_el.muted = ed.muted;
      return paintTransportRight();
    case "fullscreen":
      return toggleFullscreen();
    case "keys":
      return toggleKeys();
    case "keys-close":
      return toggleKeys(false);
    case "tool-select":
    case "tool-blade":
      ed.tool = act === "tool-blade" ? "blade" : "select";
      return paintTimeline();
    case "snap":
      ed.snap = !ed.snap;
      return paintTimeline();
    case "split":
      return splitAtPlayhead();
    case "delete":
      return deleteSelection();
    case "zoom-in":
      return zoomBy(1.6);
    case "zoom-out":
      return zoomBy(1 / 1.6);
    case "zoom-fit":
      return fitTimeline();
    case "set-in":
      return setInOut("in");
    case "set-out":
      return setInOut("out");
    case "duplicate":
      return duplicateSelection();
    case "deselect":
      return select(null);
    case "teaser-start":
    case "teaser-end":
      return edit(() => {
        const r = Math.max(0, rel());
        const tz = ed.w.teaser;
        if (act === "teaser-start") Object.assign(tz, { startMs: r, endMs: Math.max(r + 1000, tz.endMs) });
        else tz.endMs = Math.max(tz.startMs + 1000, r);
        tz.endMs = Math.min(clipLen(), tz.endMs);
      });
    case "teaser-play":
      if (ed.playing) stop();
      ed.teaserOnly = true;
      return togglePlay();
    case "reset-seg":
      return edit(() => resetSegment(ed.ctx, seg));
    case "reset-all":
      return edit(() => (ed.w.segments = initialSegments(ed.ctx, ed.w.startMs, ed.w.endMs)));
    case "swap":
      return edit(() => {
        [seg.two.top, seg.two.bottom] = [seg.two.bottom, seg.two.top];
        seg.origin = "USER";
      });
    case "join-prev":
    case "join-next": {
      const i = ed.w.segments.indexOf(seg);
      edit(() => merge(ed.ctx, ed.w.segments, seg, act === "join-prev" ? -1 : 1));
      return i >= 0 && select({ kind: "seg", id: segmentAt(ed.w.segments, ed.t).id });
    }
    case "center-x":
    case "center-y":
      return edit(() => selTexts().forEach((tx) => (tx[act === "center-x" ? "x" : "y"] = 0.5)));
    case "cap-video": {
      ce.resetStyle(clipCaptionState(ed.video, { captionState: null }));
      ed.capOwn = false;
      ed.capLook = styleKey(ce.getState());
      const src = ed.el.querySelector("[data-nle-cap-source]");
      if (src) src.innerHTML = capSourceHTML();
      return undefined;
    }
    case "brand-reset":
      return edit(() => (ed.w.brand = { ...ed.look.brand }));
    case "lib-transcript":
      ed.lib = "transcript";
      return paintLibrary();
    default:
      break;
  }
  const track = t.closest("[data-nle-track-toggle]");
  if (track) {
    const [id, key] = track.dataset.nleTrackToggle.split(":");
    ed.tracks[id][key] = !ed.tracks[id][key];
    if (id === "captions" && key === "hidden")
      ed.el.querySelector("[data-nle-root]").classList.toggle("is-captions-hidden", ed.tracks.captions.hidden);
    paintTimeline();
    paintTexts();
    paintFrame();
    return undefined;
  }
  const fmt = t.closest("[data-nle-format]");
  if (fmt) return pickFormat(fmt);
  const dz = t.closest("[data-nle-deadzones]");
  if (dz) {
    dz.closest("details")?.removeAttribute("open");
    ed.deadZones = dz.dataset.nleDeadzones;
    ce.setDeadZones(ed.deadZones);
    paintViewerBar();
    return paintLogo();
  }
  const rate = t.closest("[data-nle-rate]");
  if (rate) {
    rate.closest("details")?.removeAttribute("open");
    ed.rate = Number(rate.dataset.nleRate);
    ed.video_el.playbackRate = ed.rate * Math.max(1, ed.shuttle);
    return paintTransportRight();
  }
  const corner = t.closest("[data-nle-corner]");
  if (corner) {
    corner.closest("details")?.removeAttribute("open");
    return edit(() => (ed.w.brand.corner = corner.dataset.nleCorner));
  }
  const anim = t.closest("[data-nle-anim]");
  if (anim) {
    anim.closest("details")?.removeAttribute("open");
    const [key, val] = anim.dataset.nleAnim.split(":");
    return edit(() => selTexts().forEach((tx) => (tx[key] = val)));
  }
  const style = t.closest("[data-nle-text-style]");
  if (style) return edit(() => selTexts().forEach((tx) => (tx.style = style.dataset.nleTextStyle)));
  // A click on the Program, off any object, clears the selection.
  if (
    t.closest("[data-nle-output-wrap]") &&
    !t.closest("[data-nle-text], [data-ce-box], [data-ce-frame], [data-nle-logo]")
  ) {
    if (ed.sel && ed.sel.kind !== "seg") select(null);
  }
  return undefined;
}

function pickFormat(node) {
  node.closest("details")?.removeAttribute("open");
  const id = node.dataset.nleFormat === "video" ? ed.video.settings.ratio : node.dataset.nleFormat;
  if (id === ed.w.ratioId) return undefined;
  // A framing is made for one format (prod): a new one starts again from the
  // auto framing — asked first when the framing holds edits.
  const apply = () => {
    edit(() => {
      ed.w.ratioId = id;
      ed.w.segments = initialSegments(ed.ctx, ed.w.startMs, ed.w.endMs);
    });
    if (ed.sel?.kind === "seg") ed.sel = { kind: "seg", id: segmentAt(ed.w.segments, ed.t).id };
    sizeCanvases();
    ce.repaintStage();
    paintViewerBar();
    paintInspector();
    paintTexts();
    paintFrame();
  };
  if (!ed.w.segments.some((x) => x.origin === "USER")) return apply();
  openConfirm({
    title: "Change the format?",
    body: `Your framing was made for ${formatLabel(ed.w.ratioId)}. In ${formatLabel(id)}, I reframe the clip from scratch, and your framing changes are lost.`,
    confirmLabel: "Change the format",
    cancelLabel: `Keep ${formatLabel(ed.w.ratioId)}`,
    onConfirm: apply,
  });
  return undefined;
}

function toggleFullscreen() {
  const v = ed.el.querySelector("[data-nle-viewer]");
  if (document.fullscreenElement) return document.exitFullscreen?.().catch(() => {});
  return v
    .requestFullscreen?.()
    .catch(() => showToast("Full screen isn't available in this browser.", { variant: "error" }));
}

function handleInput(e) {
  if (!ed) return;
  const t = e.target;
  if (t.matches("[data-nle-zoom]")) return zoomFromSlider(Number(t.value));
  if (t.matches("[data-nle-volume]")) {
    ed.volume = Number(t.value);
    ed.video_el.volume = ed.volume;
    if (ed.muted && ed.volume > 0) {
      ed.muted = false;
      ed.video_el.muted = false;
    }
    t.style.setProperty("--fill", `${ed.volume * 100}%`);
    return;
  }
  if (t.matches("[data-nle-logo-size]")) {
    ed.w.brand.logoSize = Number(t.value);
    t.style.setProperty("--fill", `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    const val = ed.el.querySelector("[data-nle-logo-size-val]");
    if (val) val.textContent = `${Math.round(t.value * 100)}%`;
    setDirty();
    paintLogo();
    return;
  }
  const field = t.dataset.nleField;
  if (field && ed.sel?.kind === "text") {
    if (!ed.typing) {
      pushUndo();
      ed.typing = true;
    }
    for (const tx of selTexts()) {
      if (field === "text") tx.text = t.value;
      else if (field === "size") tx.size = Number(t.value);
      else if (field === "x" || field === "y") tx[field] = Math.max(0, Math.min(1, Number(t.value) / 100));
    }
    if (t.type === "range") t.style.setProperty("--fill", `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    const val = ed.el.querySelector(`[data-nle-val="${field}"]`);
    if (val) val.textContent = t.value;
    setDirty();
    paintTexts();
    later(paintTimeline);
  }
}

function handleChange(e) {
  if (!ed) return undefined;
  const t = e.target;
  ed.typing = false;
  if (t.matches("[data-nle-layout-pick]")) {
    const seg = selSeg() || segmentAt(ed.w.segments, ed.t);
    return edit(() => setLayout(ed.ctx, seg, t.value, ed.t, ratio()));
  }
  if (t.matches("[data-nle-teaser]")) return edit(() => (ed.w.teaser.on = t.checked));
  if (t.matches("[data-nle-brand]")) {
    const key = t.dataset.nleBrand;
    edit(() => (ed.w.brand[key] = t.checked));
    paintLibrary();
    if (t.checked && (key === "intro" || key === "outro")) {
      if (ed.playing) stop();
      ed.phase = key;
      syncTime();
      paintFrame();
    }
    return undefined;
  }
  // A typed time (the transport's timecode, a text's In / Out / Duration).
  const tf = t.dataset.nleTime;
  if (tf) {
    const ms = parseTC(t.value);
    if (ms == null) return paintInspector();
    if (tf === "playhead") {
      seek(ed.w.startMs + ms);
      revealPlayhead();
      t.blur();
      return undefined;
    }
    const len = clipLen();
    return edit(() =>
      selTexts().forEach((tx) => {
        if (tf === "in") tx.startMs = Math.max(0, Math.min(tx.endMs - MIN_TEXT_MS, ms));
        else if (tf === "out") tx.endMs = Math.min(len, Math.max(tx.startMs + MIN_TEXT_MS, ms));
        else tx.endMs = Math.min(len, tx.startMs + Math.max(MIN_TEXT_MS, ms));
      }),
    );
  }
  if (t.dataset.nleField || t.matches("[data-nle-logo-size]")) {
    paintInspector();
    paintTimeline();
  }
  return undefined;
}

function handleDblClick(e) {
  const layer = e.target.closest("[data-nle-layer]");
  const onVideo = e.target.closest("[data-nle-text]");
  if (!layer && !onVideo) return;
  const id = layer?.dataset.nleLayer || onVideo.dataset.nleText;
  if (ed.sel?.kind !== "text" || !ed.sel.ids.includes(id)) select({ kind: "text", ids: [id] });
  const f = ed.el.querySelector('[data-nle-field="text"]');
  f?.focus();
  f?.select();
}

function handleDragStart(e) {
  const p = e.target.closest?.("[data-nle-text-preset]");
  if (!p) return;
  e.dataTransfer.setData("text/x-nle-preset", p.dataset.nleTextPreset);
  e.dataTransfer.effectAllowed = "copy";
}

function handleContextMenu(e) {
  const inTl = e.target.closest("[data-nle-scroll]");
  const onText = e.target.closest("[data-nle-text]");
  if (!inTl && !onText) return;
  e.preventDefault();
  const layer = e.target.closest("[data-nle-layer]");
  const seg = e.target.closest("[data-nle-seg]");
  const id = layer?.dataset.nleLayer || onText?.dataset.nleText;
  if (id) {
    if (ed.sel?.kind !== "text" || !ed.sel.ids.includes(id)) select({ kind: "text", ids: [id] });
    return openMenu(e.clientX, e.clientY, { kind: "text" });
  }
  // « … here » in the menu means where you right-clicked: the playhead goes there.
  if (inTl) {
    if (ed.playing) stop();
    seek(msAt(e.clientX));
  }
  if (seg) {
    select({ kind: "seg", id: seg.dataset.nleSeg });
    return openMenu(e.clientX, e.clientY, { kind: "seg", id: seg.dataset.nleSeg });
  }
  return openMenu(e.clientX, e.clientY, { kind: "empty" });
}

const isMod = (e) => e.metaKey || e.ctrlKey;

function handleKey(e) {
  if (!ed) return;
  const k = e.key;
  const inModal = document.body.classList.contains("has-modal");
  if (k === "Escape" && !inModal) {
    const menu = ed.el.querySelector("[data-nle-menu]");
    const keys = ed.el.querySelector("[data-nle-keys]");
    if (!menu.hidden) return closeMenu();
    if (!keys.hidden) return toggleKeys(false);
    if (e.target.closest?.("input, textarea")) return e.target.blur();
    if (ed.sel) return select(null);
    return undefined;
  }
  if (isMod(e) && k.toLowerCase() === "s") {
    e.preventDefault();
    if (ed.dirty && !inModal) save();
    return undefined;
  }
  if (inModal) return undefined;
  const gutter = e.target.closest?.("[data-nle-resize], [data-nle-splitter]");
  if (gutter && k.startsWith("Arrow")) {
    e.preventDefault();
    return nudgeGutter(gutter, k);
  }
  if (e.target.closest?.("input, textarea, select, [contenteditable=true]")) return undefined;
  // Space and arrows stay with a keyboard-focused control (a radio moves).
  if (
    (e.code === "Space" || k.startsWith("Arrow") || k === "Enter") &&
    e.target.matches?.(":focus-visible") &&
    e.target.closest("button, a[href], summary, [role=option], [role=menuitem], [role=radio], input[type=radio]")
  )
    return undefined;
  const mod = isMod(e);
  const lower = k.toLowerCase();
  const hit = () => e.preventDefault();
  if (mod && lower === "z") return (hit(), e.shiftKey ? redo() : undo());
  if (mod && lower === "c") return copySelection() && hit();
  if (mod && lower === "v") return (hit(), paste());
  if (mod && lower === "d") return (hit(), duplicateSelection());
  if (mod && lower === "a") {
    hit();
    return ed.w.texts.length && select({ kind: "text", ids: ed.w.texts.map((t) => t.id) });
  }
  if (mod && lower === "k") return (hit(), splitAtPlayhead());
  if (mod && (k === "=" || k === "+")) return (hit(), zoomBy(1.6));
  if (mod && (k === "-" || k === "_")) return (hit(), zoomBy(1 / 1.6));
  if (mod) return undefined;
  if (e.altKey && k.startsWith("Arrow") && selTexts().length) {
    hit();
    const d = e.shiftKey ? 0.05 : 0.01;
    const dx = k === "ArrowLeft" ? -d : k === "ArrowRight" ? d : 0;
    const dy = k === "ArrowUp" ? -d : k === "ArrowDown" ? d : 0;
    if (!ed.nudging) pushUndo();
    ed.nudging = true;
    clearTimeout(ed.nudgeT);
    ed.nudgeT = setTimeout(() => ed && (ed.nudging = false), 600);
    selTexts().forEach((tx) => {
      tx.x = Math.max(0.02, Math.min(0.98, tx.x + dx));
      tx.y = Math.max(0.02, Math.min(0.98, tx.y + dy));
    });
    setDirty();
    paintTexts();
    return later(paintInspector);
  }
  if (e.code === "Space") return (hit(), togglePlay());
  switch (k) {
    case "ArrowLeft":
    case "ArrowRight": {
      hit();
      if (ed.playing) stop();
      const step = e.shiftKey ? 1000 : FRAME_MS;
      seek(ed.t + (k === "ArrowRight" ? step : -step));
      return revealPlayhead();
    }
    case "ArrowUp":
    case "ArrowDown":
      hit();
      if (ed.playing) stop();
      return jumpEdit(k === "ArrowDown" ? 1 : -1);
    case "Home":
    case "End":
      hit();
      if (ed.playing) stop();
      seek(k === "Home" ? ed.w.startMs : ed.w.endMs - 1);
      return revealPlayhead();
    case "Delete":
    case "Backspace":
      hit();
      return deleteSelection();
    case "?":
    case "/":
      hit();
      return toggleKeys();
    default:
      break;
  }
  switch (lower) {
    case "k":
      return ed.playing && stop();
    case "l":
      if (ed.playing && ed.shuttle > 0) {
        ed.shuttle = Math.min(4, ed.shuttle * 2);
        ed.video_el.playbackRate = ed.rate * ed.shuttle;
        return undefined;
      }
      if (ed.playing) stop();
      return play(1);
    case "j":
      if (ed.playing && ed.shuttle < 0) {
        ed.shuttle = Math.max(-4, ed.shuttle * 2);
        return undefined;
      }
      if (ed.playing) stop();
      return play(-1);
    case "s":
      return splitAtPlayhead();
    case "i":
      return setInOut("in");
    case "o":
      return setInOut("out");
    case "t":
      return addText("body");
    case "n":
      ed.snap = !ed.snap;
      showToast(ed.snap ? "Snapping on" : "Snapping off");
      return paintTimeline();
    case "v":
    case "b":
      ed.tool = lower === "b" ? "blade" : "select";
      return paintTimeline();
    case "f":
      return toggleFullscreen();
    default:
      break;
  }
  if (k === "Z" && e.shiftKey) return fitTimeline();
  return undefined;
}

// ── Pointer: gutters, crop, texts on the video; the timeline's own ──

function handlePointerDown(e) {
  if (!ed) return undefined;
  if (e.button === 2) return undefined;
  if (e.button !== 0) return undefined;
  const t = e.target;
  if (!t.closest("[data-nle-menu]")) closeMenu();
  const keys = ed.el.querySelector("[data-nle-keys]");
  if (!keys.hidden && !t.closest("[data-nle-keys]")) toggleKeys(false);
  const gutter = t.closest("[data-nle-resize]");
  if (gutter) return startGutterDrag(e, gutter.dataset.nleResize);
  if (t.closest("[data-nle-splitter]")) return startSplitDrag(e);
  if (t.closest("[data-nle-overlay]")) return startCropDrag(e);
  const handle = t.closest("[data-nle-text-handle]");
  if (handle) return startTextResize(e, handle);
  const text = t.closest("[data-nle-text]");
  if (text) return startTextDrag(e, text);
  if (t.closest("[data-ce-box], [data-ce-frame]") && !ed.tracks.captions.locked) {
    if (ed.sel?.kind !== "captions") select({ kind: "captions" });
    return undefined;
  }
  if (t.closest("[data-nle-logo]")) return select({ kind: "brand", item: "logo" });
  if (t.closest("[data-nle-scroll]")) return timelinePointerDown(e);
  return undefined;
}

// ── Gutters ──

const LIMITS = { left: [220, 460], right: [260, 460] };

function applyLayout() {
  const root = ed.el.querySelector("[data-nle-root]");
  const L = ed.layout;
  root.style.setProperty("--nle-left", `${L.left}px`);
  root.style.setProperty("--nle-right", `${L.right}px`);
  root.style.setProperty("--nle-tl", `${L.tl}px`);
}

function clampLayout() {
  const L = ed.layout;
  const h = ed.el.querySelector("[data-nle-root]").clientHeight || 800;
  L.left = Math.max(LIMITS.left[0], Math.min(LIMITS.left[1], L.left));
  L.right = Math.max(LIMITS.right[0], Math.min(LIMITS.right[1], L.right));
  L.tl = Math.max(160, Math.min(Math.round(h * 0.65), L.tl));
}

function startGutterDrag(e, which) {
  e.preventDefault();
  const g = e.target.closest("[data-nle-resize]");
  g.classList.add("is-dragging");
  g.setPointerCapture?.(e.pointerId);
  const x0 = e.clientX;
  const y0 = e.clientY;
  const L0 = { ...ed.layout };
  const move = (ev) => {
    if (which === "left") ed.layout.left = L0.left + (ev.clientX - x0);
    else if (which === "right") ed.layout.right = L0.right - (ev.clientX - x0);
    else ed.layout.tl = L0.tl - (ev.clientY - y0);
    clampLayout();
    applyLayout();
  };
  const up = () => {
    g.classList.remove("is-dragging");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    writeLayout();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function nudgeGutter(g, k) {
  if (g.matches("[data-nle-splitter]")) return applySplit(splitPct + (k === "ArrowLeft" ? -2 : 2));
  const which = g.dataset.nleResize;
  const d = 16;
  if (which === "left") ed.layout.left += k === "ArrowRight" ? d : k === "ArrowLeft" ? -d : 0;
  if (which === "right") ed.layout.right += k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0;
  if (which === "tl") ed.layout.tl += k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0;
  clampLayout();
  applyLayout();
  writeLayout();
  return undefined;
}

// Source / Program split, in % of the stage.
let splitPct = 55;

function applySplit(pct) {
  splitPct = Math.max(30, Math.min(80, pct));
  const stage = ed.el.querySelector("[data-nle-stage]");
  stage.style.setProperty("--nle-split", `${splitPct}%`);
  ed.el.querySelector("[data-nle-splitter]")?.setAttribute("aria-valuenow", String(Math.round(splitPct)));
  sizeCanvases();
  paintFrame();
  paintTexts();
  ce.repaintStage();
}

function startSplitDrag(e) {
  const handle = e.target.closest("[data-nle-splitter]");
  const stage = ed.el.querySelector("[data-nle-stage]");
  const r = stage.getBoundingClientRect();
  e.preventDefault();
  handle.classList.add("is-dragging");
  handle.setPointerCapture?.(e.pointerId);
  const move = (ev) => applySplit(((ev.clientX - r.left) / r.width) * 100);
  const up = () => {
    handle.classList.remove("is-dragging");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// ── The crop window on the Source ──

function startCropDrag(e) {
  if (ed.tracks.video.locked) return;
  const ov = ed.el.querySelector("[data-nle-overlay]");
  const r = ov.getBoundingClientRect();
  const at = (ev) => [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
  const [px, py] = at(e);
  const seg = segmentAt(ed.w.segments, ed.t);
  if (ed.sel?.kind !== "seg" || ed.sel.id !== seg.id) select({ kind: "seg", id: seg.id });
  const res = currentRes();
  const near = (w) => corners(w).some(([x, y]) => Math.abs(x - px) * r.width < 12 && Math.abs(y - py) * r.height < 12);
  const inside = (w) => px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h;
  const cornerIdx = res.rects.findIndex(near);
  const pane = cornerIdx >= 0 ? cornerIdx : res.rects.findIndex(inside);
  e.preventDefault();
  pushUndo();
  let moved = false;
  let start = null;
  const move = (ev) => {
    const [qx, qy] = at(ev);
    const dx = qx - px;
    const dy = qy - py;
    if (Math.abs(dx) + Math.abs(dy) > 0.004) moved = true;
    if (pane < 0 || !moved) return;
    if (!start) {
      if (seg.layout === "AUTO") toManual(ed.ctx, seg, ed.t, ratio());
      start = JSON.parse(JSON.stringify(seg.layout === "TWO" ? seg.two : seg.one));
    }
    const W = ed.ctx.W;
    const H = ed.ctx.H;
    if (cornerIdx >= 0) {
      const c = seg.layout === "TWO" ? seg.two[pane === 0 ? "top" : "bottom"] : seg.one;
      const half = Math.max(
        Math.abs(qy - c.cy),
        (Math.abs(qx - c.cx) * W) / H / (seg.layout === "TWO" ? ratio() * 2 : ratio()),
      );
      c.zoom = Math.max(1, Math.min(seg.layout === "TWO" ? 3 : 2.5, 1 / (2 * half)));
    } else if (seg.layout === "TWO") {
      const key = pane === 0 ? "top" : "bottom";
      seg.two[key].cx = clamp01(start[key].cx + dx);
      seg.two[key].cy = clamp01(start[key].cy + dy);
    } else {
      seg.one.cx = clamp01(start.cx + dx);
      seg.one.cy = clamp01(start.cy + dy);
    }
    seg.origin = "USER";
    paintFrame();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!moved) return void ed.undo.pop();
    setDirty();
    paintInspector();
    paintTimeline();
    paintFrame();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ── Texts on the Program: drag to place (magnetic centre lines), corners to size ──

function startTextDrag(e, node) {
  const out = ed.el.querySelector("[data-nle-output]");
  const r = out.getBoundingClientRect();
  const tx = txById(node.dataset.nleText);
  if (!tx) return;
  e.preventDefault();
  e.stopPropagation();
  const additive = e.shiftKey;
  if (additive || ed.sel?.kind !== "text" || !ed.sel.ids.includes(tx.id))
    select({ kind: "text", ids: [tx.id] }, { additive });
  if (ed.tracks.text.locked) return;
  pushUndo();
  const sx = e.clientX;
  const sy = e.clientY;
  const items = selTexts().map((t) => ({ t, x: t.x, y: t.y }));
  const guides = { x: out.querySelector('[data-nle-guide="x"]'), y: out.querySelector('[data-nle-guide="y"]') };
  const move = (ev) => {
    const dx = (ev.clientX - sx) / r.width;
    const dy = (ev.clientY - sy) / r.height;
    for (const it of items) {
      it.t.x = Math.max(0.05, Math.min(0.95, it.x + dx));
      it.t.y = Math.max(0.05, Math.min(0.95, it.y + dy));
    }
    // Magnetic: within 8 px of the video's centre lines; Alt drags freely.
    for (const [key, size] of [
      ["x", r.width],
      ["y", r.height],
    ]) {
      const on = items.length === 1 && !ev.altKey && Math.abs(tx[key] - 0.5) * size <= 8;
      if (on) tx[key] = 0.5;
      guides[key].hidden = !on;
    }
    for (const it of items) {
      const n = ed.el.querySelector(`[data-nle-text="${CSS.escape(it.t.id)}"]`);
      if (n) {
        n.style.left = `${it.t.x * 100}%`;
        n.style.top = `${it.t.y * 100}%`;
      }
    }
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    guides.x.hidden = guides.y.hidden = true;
    dropNoopUndo();
    setDirty();
    paintTexts();
    paintInspector();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function startTextResize(e, handle) {
  const node = handle.closest("[data-nle-text]");
  const tx = txById(node.dataset.nleText);
  if (!tx || ed.tracks.text.locked) return;
  e.preventDefault();
  e.stopPropagation();
  pushUndo();
  const box = node.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
  const s0 = tx.size;
  const move = (ev) => {
    const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
    tx.size = Math.round(Math.max(24, Math.min(160, (s0 * d) / d0)));
    paintTexts();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    dropNoopUndo();
    setDirty();
    paintInspector();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
