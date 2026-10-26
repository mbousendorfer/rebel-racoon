// /clips/:id/edit/:clipId — the ONE clip editor of the Clips space (flag
// clipsSpace). Four editors used to hold a share of the tools each: the Video
// Clips modal (trim, format, subtitles), prod's per-post subtitle editor, the
// platform video-editor playground (text overlays, speech cleanup, brand
// template) and the crop-editor playground (per-segment reframing). They are
// one surface here, Opus / Descript-style:
//
//   transcript (left, always) · stage (center) · panel + tool rail (right) ·
//   one timeline for every tool (bottom).
//
// Tools: Reframe · Subtitles · Text · Brand. The format and the safe area sit
// on the Output monitor, the cleanup (fillers, pauses) on the transcript, and
// the trim — In / Out — on the transport, right above the timeline it edits.
// The editor owns the clock and the source <video>; caption-editor.js renders
// the subtitles, the transcript and the cleanup on that clock (mount opts.clock),
// and clip-framing.js is the crop editor's engine.
//
// Nothing is written to the clip until Save; Undo / Redo cover the range, the
// framing, the text overlays, the format and the brand settings.
// ponytail: subtitle style edits are outside the undo stack — caption-editor
// keeps its own state; fold them in if undoing a font change is asked for.

import { navigate } from "../../router.js?v=2172";
import { isFlagOn } from "../../feature-flags.js?v=2172";
import { parseHashParams } from "../../url-state.js?v=2172";
import { renderTopbar, setTopbarActions } from "../../components/topbar.js?v=2172";
import { showToast } from "../../components/toast.js?v=2172";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2172";
import { getContextById } from "../../contexts-store.js?v=2172";
import { escapeHtml } from "../../utils.js?v=2172";
import * as ce from "../../caption-editor.js?v=2172";
import { DEAD_ZONES } from "../../clip-captions.js?v=2172";
import { NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=2172";
import { getVideo, getClip, updateClip, setSelection, clipLookOf } from "../../videos-store.js?v=2172";
import {
  framingContext,
  initialSegments,
  retrim,
  resolve,
  segmentAt,
  drawOutput,
  faceAt,
  centreOnFace,
  setLayout,
  toManual,
  split,
  merge,
  moveBoundary,
  settleBoundary,
  snapMs,
  applyToCamera,
  resetSegment,
  twoBlockedReason,
  cameraName,
  LAYOUTS,
  MIN_SEG_MS,
} from "../../clip-framing.js?v=2172";
import {
  fmtMs,
  fmtPrecise,
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
} from "./shared.js?v=2172";
import { primeDraftSetup } from "./project.js?v=2172";

const MIN_CLIP_MS = 5000;
const MAX_CLIP_MS = 300000;
const FRAME_MS = 40;
const CARD_MS = 2000; // intro / outro card length

// The tools that work on words show the transcript; the ones that work on the
// image give its width back to the stage. The toggle overrides it either way.
const WORD_TOOLS = new Set(["subtitles"]);

const TOOLS = [
  { id: "reframe", label: "Reframe", icon: "ap-icon-cropper", hint: "Who's in the frame, part by part" },
  { id: "subtitles", label: "Subtitles", icon: "ap-icon-closed-captions", hint: "Subtitle style" },
  { id: "text", label: "Text", icon: "ap-icon-alt-text", hint: "Titles and text on the video" },
  { id: "brand", label: "Brand", icon: "ap-icon-target", hint: "Logo, intro and outro" },
];

// Camera colours on the framing track are categorical DATA labels — the
// chart palette, never the interactive blue.
const CAMERA_COLORS = [
  "var(--app-chart-data-1)",
  "var(--app-chart-data-2)",
  "var(--app-chart-data-3)",
  "var(--app-chart-data-4)",
];

// The safe-area guide's choices: where each network's buttons cover the video.
const DEAD_ZONE_LABELS = { none: "No guide", tiktok: "TikTok zones", reels: "Reels zones", shorts: "Shorts zones" };
// …and the network each one is, by its logo.
const DEAD_ZONE_NETWORK = { tiktok: "tiktok", reels: "instagram", shorts: "youtube" };
const dzIcon = (id) =>
  DEAD_ZONE_NETWORK[id]
    ? `<i class="${NETWORK_ICON_BY_PLATFORM[DEAD_ZONE_NETWORK[id]]} clips-ed__dz-icon" aria-hidden="true"></i>`
    : `<i class="ap-icon-eye-off clips-ed__dz-icon" aria-hidden="true"></i>`;

let ed = null;

// The tool in the URL. Two former tools left the rail: Clean up (now the
// transcript's, so Subtitles) and Trim (now the transport's In / Out).
function toolFromUrl() {
  const t = parseHashParams().get("tool");
  if (t === "cleanup") return "subtitles";
  if (t === "trim") return "reframe";
  return TOOLS.some((x) => x.id === t) ? t : "reframe";
}

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
  ed = {
    el,
    video,
    clip,
    ctx,
    pb,
    look,
    tool: toolFromUrl(),
    // The working copy — committed on Save.
    w: {
      title: clip.title,
      startMs: clip.startMs,
      endMs: clip.endMs,
      ratioId: clipRatioId(video, clip),
      segments: JSON.parse(JSON.stringify(clip.segments || initialSegments(ctx, clip.startMs, clip.endMs))),
      texts: JSON.parse(JSON.stringify(clip.texts || [])),
      brand: { ...look.brand, ...(clip.brand || {}) },
    },
    caption: null, // latest caption-editor patch
    capOwn: !!clip.captionCustom, // the clip has its own subtitle style (else the video's)
    capDirty: false,
    deadZones: clipCaptionState(video, clip).deadZones || "tiktok", // the Output's safe-area guide
    trimError: "",
    undo: [],
    redo: [],
    dirty: false,
    t: clip.startMs, // playhead, source ms
    phase: "clip", // clip | intro | outro (brand cards)
    phaseEnd: 0,
    playing: false,
    raf: 0,
    snap: true,
    transcript: null, // null = by tool (WORD_TOOLS), else the user's choice
    selectedText: null,
    drag: null,
    disposers: [],
  };
  ed.saved = snapshot();
  renderTopbar();
  paintTopbar();
  el.innerHTML = shellHTML();
  mountCaptions();
  paintPanel();
  paintTimeline();
  bindAll();
  setupVideo();
  return teardown;
}

function teardown() {
  if (!ed) return;
  cancelAnimationFrame(ed.raf);
  ce.unmount();
  ed.video_el?.pause();
  ed.disposers.splice(0).forEach((d) => d());
  ed = null;
}

const ratio = () => ratioOf(ed.w.ratioId);
const clipLen = () => ed.w.endMs - ed.w.startMs;
const relSec = () => Math.max(0, ed.t - ed.w.startMs) / 1000;

// ── Topbar: back · title │ undo redo · Save · Create draft ───────────

function paintTopbar() {
  const left = `<button type="button" class="ap-icon-button" data-clips-ed="back" aria-label="Back to the video" data-tooltip="Back to the video">
      <i class="ap-icon-arrow-left" aria-hidden="true"></i>
    </button>
    <input class="clips-ed__title-input" data-clips-ed-title value="${escapeHtml(ed.w.title)}" aria-label="Clip title" />`;
  const right = `
    <button type="button" class="ap-icon-button transparent" data-clips-ed="undo" aria-label="Undo" data-tooltip="Undo (⌘Z)" ${ed.undo.length ? "" : "disabled"}><i class="ap-icon-rotate-left" aria-hidden="true"></i></button>
    <button type="button" class="ap-icon-button transparent" data-clips-ed="redo" aria-label="Redo" data-tooltip="Redo (⇧⌘Z)" ${ed.redo.length ? "" : "disabled"}><i class="ap-icon-rotate-right" aria-hidden="true"></i></button>
    <button type="button" class="ap-button stroked grey" data-clips-ed="save" ${ed.dirty ? "" : "disabled"}><span>${ed.dirty ? "Save" : "Saved"}</span></button>
    <button type="button" class="ap-button primary orange" data-clips-ed="draft"><i class="ap-icon-archie-official" aria-hidden="true"></i><span>Create draft</span></button>`;
  setTopbarActions(`/clips/${ed.video.id}/edit/${ed.clip.id}`, `<div class="clips-ed__topbar-actions">${right}</div>`, {
    left,
  });
}

// ── Shell ────────────────────────────────────────────────────────────

function shellHTML() {
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((d) => `<span class="cap-ed-handle cap-ed-handle--${d}" data-ce-resize="${d}"></span>`)
    .join("");
  const rail = TOOLS.map(
    (
      t,
    ) => `<button type="button" class="clips-ed__tool" data-clips-tool="${t.id}" role="tab" aria-selected="false" data-tooltip="${t.hint}" data-tooltip-placement="left">
      <i class="${t.icon}" aria-hidden="true"></i><span>${t.label}</span>
    </button>`,
  ).join("");
  return `
  <div class="clips-ed" data-clips-ed-root>
    <aside class="clips-ed__transcript" aria-label="Transcript">
      <div class="clips-ed__side-head">
        <h2 class="clips-ed__side-title">Transcript</h2>
        <span class="cap-ed__meta" data-ce-reconcile></span>
      </div>
      <p class="clips-ed__side-hint">Click a word to jump to it, double-click to fix it. Click a marked filler or pause to hide it from the subtitles.</p>
      <div class="clips-ed__clean" data-ce-cleanup-list></div>
      <div class="cap-ed__transcript clips-ed__words" data-ce-transcript></div>
    </aside>

    <main class="clips-ed__main">
      <div class="clips-ed__stage" data-clips-stage>
        <section class="clips-ed__monitor clips-ed__monitor--source" aria-label="Source">
          <header class="clips-ed__monitor-bar">
            <span class="clips-ed__monitor-name">Source</span>
            <span class="clips-ed__monitor-meta">${ed.ctx.W}×${ed.ctx.H} · <span data-clips-src-tc>0:00.0</span></span>
          </header>
          <div class="clips-ed__monitor-body" data-clips-source-body>
            <div class="clips-ed__source" data-clips-source>
              <video class="clips-ed__video" data-clips-video playsinline preload="auto"></video>
              <canvas class="clips-ed__overlay" data-clips-overlay></canvas>
            </div>
          </div>
        </section>
        <div class="clips-ed__splitter" data-clips-splitter role="separator" aria-orientation="vertical"
          aria-label="Resize Source and Output" aria-valuemin="30" aria-valuemax="80" aria-valuenow="64" tabindex="0"></div>
        <section class="clips-ed__monitor clips-ed__monitor--output" aria-label="Output">
          <header class="clips-ed__monitor-bar">
            <span class="clips-ed__monitor-name">Output</span>
            <span class="clips-ed__monitor-meta" data-clips-output-label></span>
          </header>
          <div class="clips-ed__monitor-body" data-clips-output-wrap>
            <div class="clips-ed__output" data-ce-stage data-clips-output>
              <canvas class="clips-ed__out-canvas" data-clips-out></canvas>
              <div class="cap-ed__deadzones" data-ce-deadzones></div>
              <div class="clips-ed__texts" data-clips-texts data-ce-no-toggle></div>
              <img class="clips-ed__logo" data-clips-logo alt="" hidden />
              <div class="cap-ed-box" data-ce-box></div>
              <div class="cap-ed-frame" data-ce-frame>${handles}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="clips-ed__transport">
        <button type="button" class="ap-icon-button transparent" data-clips-ed="play" aria-label="Play" data-tooltip="Play / pause (Space)">
          <i class="ap-icon-play" aria-hidden="true" data-clips-play-icon></i>
        </button>
        <span class="clips-ed__time"><span data-clips-cur>0:00.0</span> / <span data-clips-len>0:00.0</span><span class="clips-ed__time-src"> · <span data-clips-at>0:00.0</span> in the video</span></span>
        <div class="clips-ed__tl-tools" role="toolbar" aria-label="Framing parts">
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="split" data-tooltip="Split the part at the playhead (S)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="4" width="5" height="8" rx="1.2"/><rect x="10" y="4" width="5" height="8" rx="1.2"/><path d="M8 1.5v13"/></svg>
            <span>Split</span>
          </button>
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="merge-prev" aria-label="Merge with the previous part" data-tooltip="Merge with the previous part">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3v10"/><path d="M14 8H5"/><path d="M8 5 5 8l3 3"/></svg>
          </button>
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="merge-next" aria-label="Merge with the next part" data-tooltip="Merge with the next part">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 3v10"/><path d="M2 8h9"/><path d="M8 5l3 3-3 3"/></svg>
          </button>
          <span class="clips-ed__tl-sep" aria-hidden="true"></span>
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="snap" aria-pressed="true" data-tooltip="Boundaries and the playhead stick to camera cuts">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v6a4 4 0 0 0 8 0V2"/><path d="M4 5h3M9 5h3"/></svg>
            <span>Snap</span>
          </button>
        </div>
        <span class="clips-ed__transport-spacer"></span>
        <div class="clips-ed__inout" role="group" aria-label="The clip's start and end in the video">
          <label class="clips-ed__inout-field"><span>In</span>
            <span class="ap-input-group"><input type="text" data-clips-time="start" aria-label="Start in the video" /></span></label>
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="set-start" aria-label="Start at the playhead" data-tooltip="Start at the playhead (I)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2v12"/><path d="M13 8H6"/><path d="M9 5 6 8l3 3"/></svg>
          </button>
          <label class="clips-ed__inout-field"><span>Out</span>
            <span class="ap-input-group"><input type="text" data-clips-time="end" aria-label="End in the video" /></span></label>
          <button type="button" class="clips-ed__tl-tool" data-clips-ed="set-end" aria-label="End at the playhead" data-tooltip="End at the playhead (O)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 2v12"/><path d="M3 8h7"/><path d="M7 5l3 3-3 3"/></svg>
          </button>
          <span class="clips-ed__error" data-clips-trim-error role="alert"></span>
        </div>
        <button type="button" class="ap-button ghost grey clips-ed__transcript-toggle" data-clips-ed="transcript" aria-pressed="false">
          <i class="ap-icon-alt-text" aria-hidden="true"></i><span>Transcript</span>
        </button>
      </div>

      <div class="clips-ed__timeline" data-clips-timeline></div>
    </main>

    <aside class="clips-ed__panel" data-clips-panel aria-live="polite"></aside>
    <nav class="clips-ed__rail" role="tablist" aria-label="Editing tools">${rail}</nav>
  </div>`;
}

// The subtitle look, without the safe-area guide (a view setting, not a look).
const styleKey = (cs) => JSON.stringify({ ...cs, deadZones: null });

// The subtitles + transcript + cleanup engine, on this editor's clock.
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
  ce.mount(ed.el.querySelector("[data-clips-ed-root]"), capClip, null, {
    clock: {
      seek: (sec) => seek(ed.w.startMs + sec * 1000),
      toggle: () => togglePlay(),
    },
    presetIds: SUBTITLE_IDS,
    cleanup: true, // fillers and pauses are always marked in the transcript
    onChange: (patch) => {
      ed.caption = patch;
      ed.capDirty = true;
      // A style change detaches the clip from the video's style; hiding a word
      // doesn't (it's the clip's words, not its look) — so compare the look.
      const look = styleKey(patch.captionState);
      if (look !== ed.capLook) {
        ed.capOwn = true;
        ed.capLook = look;
      }
      const src = ed.el.querySelector("[data-clips-cap-source]");
      if (src) src.innerHTML = capSourceHTML();
      paintCleanMarks();
      setDirty();
    },
  });
  ed.capLook = styleKey(ce.getState());
}

// ── The footage and the clock ────────────────────────────────────────

function setupVideo() {
  const v = ed.el.querySelector("[data-clips-video]");
  ed.video_el = v;
  v.src = ed.video.url;
  const onMeta = () => seek(ed.w.startMs);
  v.addEventListener("loadedmetadata", onMeta);
  v.addEventListener("seeked", () => !ed?.playing && paintFrame());
  v.addEventListener("loadeddata", () => ed && paintFrame());
  new ResizeObserver(() => ed && (sizeCanvases(), paintFrame(), ce.repaintStage())).observe(
    ed.el.querySelector("[data-clips-stage]"),
  );
  applyTool();
}

function seek(ms) {
  if (!ed) return;
  ed.phase = "clip";
  ed.t = Math.max(ed.w.startMs, Math.min(ed.w.endMs - 1, ms));
  if (ed.video_el && ed.video_el.readyState >= 1) ed.video_el.currentTime = ed.t / 1000;
  syncTime();
  paintFrame();
}

function togglePlay() {
  if (!ed) return;
  if (ed.playing) return stop();
  ed.playing = true;
  // From the very start with an intro card: the card first, then the clip.
  if (ed.w.brand.intro && ed.t <= ed.w.startMs + 60) {
    ed.phase = "intro";
    ed.phaseEnd = performance.now() + CARD_MS;
  } else {
    ed.phase = "clip";
    if (ed.t >= ed.w.endMs - 80) seek(ed.w.startMs);
    ed.video_el.play().catch(() => {});
  }
  setPlayIcon();
  ed.raf = requestAnimationFrame(tick);
}

function stop() {
  ed.playing = false;
  ed.video_el.pause();
  cancelAnimationFrame(ed.raf);
  if (ed.phase !== "clip") seek(ed.phase === "intro" ? ed.w.startMs : ed.w.startMs);
  setPlayIcon();
  syncTime();
  paintFrame();
}

function tick(now) {
  if (!ed || !ed.playing) return;
  if (ed.phase === "intro" && now >= ed.phaseEnd) {
    ed.phase = "clip";
    ed.video_el.play().catch(() => {});
  } else if (ed.phase === "clip") {
    ed.t = ed.video_el.currentTime * 1000;
    if (ed.t >= ed.w.endMs) {
      ed.video_el.pause();
      if (ed.w.brand.outro) {
        ed.phase = "outro";
        ed.phaseEnd = now + CARD_MS;
      } else return stop();
    }
  } else if (ed.phase === "outro" && now >= ed.phaseEnd) {
    return stop();
  }
  syncTime();
  paintFrame();
  ed.raf = requestAnimationFrame(tick);
}

function setPlayIcon() {
  const i = ed.el.querySelector("[data-clips-play-icon]");
  if (i) i.className = ed.playing ? "ap-icon-pause" : "ap-icon-play";
}

// The timeline tools follow the part under the playhead.
function syncTlTools() {
  const segs = ed.w.segments;
  const i = segs.indexOf(segmentAt(segs, ed.t));
  const q = (a) => ed.el.querySelector(`[data-clips-ed="${a}"]`);
  if (q("merge-prev")) q("merge-prev").disabled = i <= 0;
  if (q("merge-next")) q("merge-next").disabled = i >= segs.length - 1;
  q("snap")?.setAttribute("aria-pressed", String(ed.snap));
}

function syncTime() {
  // The brand cards are drawn alone: no subtitle over them.
  ed.el.querySelector("[data-clips-ed-root]").dataset.phase = ed.phase;
  const cur = ed.el.querySelector("[data-clips-cur]");
  if (cur)
    cur.textContent = ed.phase === "clip" ? fmtPrecise(ed.t - ed.w.startMs) : ed.phase === "intro" ? "Intro" : "Outro";
  const len = ed.el.querySelector("[data-clips-len]");
  if (len) len.textContent = fmtPrecise(clipLen());
  const stc = ed.el.querySelector("[data-clips-src-tc]");
  if (stc) stc.textContent = fmtPrecise(ed.t);
  // The buttons that act at the playhead name the time they'll use.
  ed.el.querySelectorAll("[data-clips-at]").forEach((n) => (n.textContent = fmtPrecise(ed.t)));
  ed.el.querySelectorAll("[data-clips-at-rel]").forEach((n) => (n.textContent = fmtPrecise(ed.t - ed.w.startMs)));
  ce.setTime(relSec(), ed.playing);
  const ph = ed.el.querySelector("[data-clips-playhead]");
  if (ph) ph.style.left = pctIn(ed.t);
  const seg = segmentAt(ed.w.segments, ed.t);
  if (seg.id !== ed.panelSeg) {
    if (ed.tool === "reframe") paintPanel();
    else ed.panelSeg = seg.id;
    syncTlTools();
  }
  ed.el
    .querySelectorAll("[data-clips-seg]")
    .forEach((n) => n.classList.toggle("is-current", n.dataset.clipsSeg === seg.id));
  paintTextsVisibility();
}

// ── Painting the stage ───────────────────────────────────────────────

// Fit a frame of `aspect` (w/h) inside a monitor's body.
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
  const out = ed.el.querySelector("[data-clips-output]");
  const o = fitIn(ed.el.querySelector("[data-clips-output-wrap]"), ratio());
  out.style.width = `${o.w}px`;
  out.style.height = `${o.h}px`;
  const oc = ed.el.querySelector("[data-clips-out]");
  oc.width = Math.round(o.w * dpr);
  oc.height = Math.round(o.h * dpr);
  const src = ed.el.querySelector("[data-clips-source]");
  const body = ed.el.querySelector("[data-clips-source-body]");
  if (body.clientWidth) {
    const f = fitIn(body, ed.ctx.W / ed.ctx.H);
    src.style.width = `${f.w}px`;
    src.style.height = `${f.h}px`;
  }
  const ov = ed.el.querySelector("[data-clips-overlay]");
  ov.width = Math.round(ov.clientWidth * dpr);
  ov.height = Math.round(ov.clientHeight * dpr);
  paintFormatPicker();
}

// The output's shape lives on the Output monitor, like a canvas ratio in an
// editing app — a setting of the frame, not a tool. The video's format by
// default; a clip can take its own.
function paintFormatPicker() {
  const host = ed.el.querySelector("[data-clips-output-label]");
  if (!host) return;
  const videoRatio = ed.video.settings.ratio;
  const own = ed.w.ratioId !== videoRatio;
  host.innerHTML =
    dsSelect({
      label: "Safe area",
      valueHtml: `${dzIcon(ed.deadZones)}${escapeHtml(DEAD_ZONE_LABELS[ed.deadZones] || "No guide")}`,
      current: ed.deadZones,
      attr: "data-clips-deadzones",
      ariaLabel: "Show where the app's buttons cover the video",
      extraClass: "clips-ed__format",
      options: Object.entries(DEAD_ZONE_LABELS).map(([id, label]) => ({ id, label, lead: dzIcon(id) })),
    }) +
    dsSelect({
      label: own ? "This clip" : "Video",
      valueHtml: escapeHtml(formatLabel(ed.w.ratioId)),
      current: own ? ed.w.ratioId : "video",
      attr: "data-clips-format",
      ariaLabel: "Format of this clip",
      extraClass: "clips-ed__format",
      options: [
        { id: "video", label: `Same as the video · ${formatLabel(videoRatio)}` },
        ...RATIO_IDS.map((id) => ({ id, label: formatLabel(id), meta: bestFor(id) })),
      ],
    });
}

function currentRes() {
  return resolve(ed.ctx, segmentAt(ed.w.segments, ed.t), ed.t, ratio());
}

function paintFrame() {
  if (!ed) return;
  const oc = ed.el.querySelector("[data-clips-out]");
  if (!oc.width) sizeCanvases();
  const c2d = oc.getContext("2d");
  if (ed.phase !== "clip") paintCard(c2d, oc.width, oc.height);
  else drawOutput(c2d, ed.video_el, ed.ctx, currentRes(), oc.width, oc.height);
  if (ed.tool === "reframe") paintOverlay();
  paintLogo();
}

// The brand card the intro / outro show: the Playbook's primary colour, its
// logo, its name. Drawn, not filmed — prod's brand template reads the same.
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

function paintOverlay() {
  const ov = ed.el.querySelector("[data-clips-overlay]");
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
  const img = ed.el.querySelector("[data-clips-logo]");
  const b = ed.w.brand;
  const src = ed.pb?.brandLogo;
  if (!img) return;
  img.hidden = !(b.logo && src && ed.phase === "clip");
  if (img.hidden) return;
  if (img.getAttribute("src") !== src) img.src = src;
  img.style.width = `${b.logoSize * 100}%`;
  img.dataset.corner = b.corner;
  // Out of the zones the network's buttons cover, whichever corner it's in.
  const z = DEAD_ZONES[ed.deadZones] || { top: 0, bottom: 0, right: 0 };
  img.style.setProperty("--dz-top", `${z.top * 100}%`);
  img.style.setProperty("--dz-bottom", `${z.bottom * 100}%`);
  img.style.setProperty("--dz-right", `${z.right * 100}%`);
}

// ── Text overlays ────────────────────────────────────────────────────

function paintTexts() {
  const host = ed.el.querySelector("[data-clips-texts]");
  if (!host) return;
  const out = ed.el.querySelector("[data-clips-output]");
  const k = (out.clientWidth || 300) / 1080;
  host.innerHTML = ed.w.texts
    .map(
      (
        tx,
      ) => `<div class="clips-ed-text clips-ed-text--${tx.style}${tx.id === ed.selectedText ? " is-selected" : ""}" data-clips-text="${tx.id}"
        style="left:${tx.x * 100}%;top:${tx.y * 100}%;font-size:${Math.round(tx.size * k)}px">${escapeHtml(tx.text)}</div>`,
    )
    .join("");
  paintTextsVisibility();
}

function paintTextsVisibility() {
  const rel = ed.t - ed.w.startMs;
  ed.el.querySelectorAll("[data-clips-text]").forEach((n) => {
    const tx = ed.w.texts.find((x) => x.id === n.dataset.clipsText);
    const on = tx && ed.phase === "clip" && rel >= tx.startMs && rel <= tx.endMs;
    n.classList.toggle("is-off", !on);
  });
}

// ── The timeline (every tool's) ──────────────────────────────────────

function view() {
  const pad = Math.max(5000, clipLen() * 0.25);
  const from = Math.max(0, ed.w.startMs - pad);
  const to = Math.min(ed.video.durationMs, ed.w.endMs + pad);
  return { from, to, span: to - from };
}

function pctIn(ms) {
  const v = ed.viewport || view();
  return `${((ms - v.from) / v.span) * 100}%`;
}

// The transport's In / Out: the clip's range in the video, kept in step with
// the handles (a field being typed in is left alone).
function paintInOut() {
  ed.el.querySelectorAll("[data-clips-time]").forEach((i) => {
    if (i !== document.activeElement) i.value = fmtPrecise(i.dataset.clipsTime === "start" ? ed.w.startMs : ed.w.endMs);
  });
  const err = ed.el.querySelector("[data-clips-trim-error]");
  if (err) err.textContent = ed.trimError;
}

function paintTimeline() {
  paintInOut();
  const host = ed.el.querySelector("[data-clips-timeline]");
  if (!host) return;
  if (!ed.drag) ed.viewport = view();
  const v = ed.viewport;
  const step = niceStep(v.span);
  let ticks = "";
  // The timeline is a window on the video, so its ruler reads the video's time
  // — the time the In / Out fields above it are typed in.
  for (let t = Math.ceil(v.from / step) * step; t <= v.to; t += step)
    ticks += `<span class="clips-tl__tick" style="left:${pctIn(t)}"><span>${fmtMs(t)}</span></span>`;
  // A faux waveform — no audio analysis in the prototype — keyed on source
  // time so the shape doesn't slide when the window moves.
  let wave = "";
  const bars = 120;
  for (let i = 0; i < bars; i++) {
    const t = v.from + (i / bars) * v.span;
    const x = t / 1000;
    const a = Math.abs(Math.sin(x * 1.3) * 0.5 + Math.sin(x * 0.37 + 1.1) * 0.35 + Math.sin(x * 4.1) * 0.15);
    wave += `<span style="height:${Math.round(12 + a * 80)}%"></span>`;
  }
  const segs = ed.w.segments;
  const cur = segmentAt(segs, ed.t);
  const cams = [...new Set(segs.map((s) => s.camera))];
  const camColor = (id) =>
    id === "TWO"
      ? "var(--app-chart-data-5)"
      : id === "FIT"
        ? "var(--app-chart-neutral)"
        : CAMERA_COLORS[
            Math.max(
              0,
              ed.ctx.cameras.findIndex((c) => c.id === id),
            ) % CAMERA_COLORS.length
          ];
  const layoutLabel = (s) =>
    s.layout === "AUTO" ? `Auto · ${autoKind(s)}` : LAYOUTS.find((l) => l.id === s.layout)?.label || s.layout;
  const segHTML = segs
    .map(
      (
        s,
      ) => `<button type="button" class="clips-tl__seg${s.id === cur.id ? " is-current" : ""}${s.origin === "USER" ? " is-edited" : ""}" data-clips-seg="${s.id}"
        style="left:${pctIn(s.startMs)};width:calc(${((s.endMs - s.startMs) / v.span) * 100}% - 2px);--cam:${camColor(s.camera)}"
        aria-label="${escapeHtml(cameraName(s.camera))}, ${escapeHtml(layoutLabel(s))}, ${fmtPrecise(s.startMs - ed.w.startMs)}">
        <span class="clips-tl__seg-cam">${escapeHtml(cameraShort(s.camera))}</span>
        <span class="clips-tl__seg-lay">${escapeHtml(layoutLabel(s))}${s.follow ? " · follow" : ""}</span>
      </button>`,
    )
    .join("");
  const bounds = segs
    .slice(1)
    .map((s, k) => `<span class="clips-tl__bound" data-clips-bound="${k + 1}" style="left:${pctIn(s.startMs)}"></span>`)
    .join("");
  const cuts = ed.ctx.cuts
    .filter((c) => c > ed.w.startMs && c < ed.w.endMs)
    .map((c) => `<span class="clips-tl__cut" style="left:${pctIn(c)}"></span>`)
    .join("");
  const texts = ed.w.texts
    .map(
      (
        tx,
      ) => `<button type="button" class="clips-tl__text${tx.id === ed.selectedText ? " is-current" : ""}" data-clips-text-pick="${tx.id}"
        style="left:${pctIn(ed.w.startMs + tx.startMs)};width:${((tx.endMs - tx.startMs) / v.span) * 100}%">${escapeHtml(tx.text)}</button>`,
    )
    .join("");
  const b = ed.w.brand;
  host.innerHTML = `
    <div class="clips-tl" data-clips-tl>
      <div class="clips-tl__labels" aria-hidden="true">
        <span></span><span>Clip</span><span>Framing</span><span>Text</span>
      </div>
      <div class="clips-tl__tracks" data-clips-tracks>
        <div class="clips-tl__ruler" data-clips-scrub>${ticks}</div>
        <div class="clips-tl__trim" data-clips-scrub>
          <div class="clips-tl__wave">${wave}</div>
          <div class="clips-tl__dim" style="left:0;width:${pctIn(ed.w.startMs)}"></div>
          <div class="clips-tl__dim" style="left:${pctIn(ed.w.endMs)};right:0"></div>
          <div class="clips-tl__cleans" data-clips-cleans>${cleanMarks()}</div>
          <div class="clips-tl__window" style="left:${pctIn(ed.w.startMs)};width:${(clipLen() / v.span) * 100}%">
            ${b.intro ? `<span class="clips-tl__card clips-tl__card--intro">Intro</span>` : ""}
            ${b.outro ? `<span class="clips-tl__card clips-tl__card--outro">Outro</span>` : ""}
            <span class="clips-tl__handle clips-tl__handle--l" data-clips-trim="start" aria-label="Clip start"></span>
            <span class="clips-tl__handle clips-tl__handle--r" data-clips-trim="end" aria-label="Clip end"></span>
          </div>
        </div>
        <div class="clips-tl__frames" data-clips-scrub>${cuts}${segHTML}${bounds}</div>
        <div class="clips-tl__texts" data-clips-scrub>${texts}</div>
        <div class="clips-tl__playhead" data-clips-playhead style="left:${pctIn(ed.t)}"></div>
      </div>
    </div>
    <p class="clips-tl__legend">${cams
      .map(
        (id) =>
          `<span class="clips-tl__legend-item"><span class="clips-tl__swatch" style="background:${camColor(id)}"></span>${escapeHtml(cameraName(id))}</span>`,
      )
      .join("")}<span class="clips-tl__legend-item">Dotted: Auto · Solid: yours</span></p>`;
}

// What the cleanup hid from the subtitles, on the Clip track — the audio isn't cut.
function cleanMarks() {
  return ce
    .getHiddenSpans()
    .map(
      (m) =>
        `<span class="clips-tl__clean" style="left:${pctIn(ed.w.startMs + m.start * 1000)};width:${(((m.end - m.start) * 1000) / ed.viewport.span) * 100}%" title="${escapeHtml(m.label)}"></span>`,
    )
    .join("");
}

function paintCleanMarks() {
  const host = ed.el.querySelector("[data-clips-cleans]");
  if (host) host.innerHTML = cleanMarks();
}

// A camera's short name on the framing track: the wide shot of both speakers
// is "Wide", a single camera its letter.
function cameraShort(id) {
  if (id === "TWO") return "Wide";
  if (id === "FIT") return "Fit";
  return id ? `Cam ${id}` : "—";
}

// What Auto does with a part — named the way the Layout cards name it.
function autoKind(seg) {
  const kind = resolve(ed.ctx, seg, (seg.startMs + seg.endMs) / 2, ratio()).kind;
  return { one: "One speaker", two: "Two speakers", fit: "Fit" }[kind];
}

function niceStep(span) {
  const target = span / 8;
  return [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000].find((s) => s >= target) || 300000;
}

function msAt(clientX) {
  const tracks = ed.el.querySelector("[data-clips-tracks]");
  const r = tracks.getBoundingClientRect();
  const v = ed.viewport;
  return v.from + Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * v.span;
}

// ── Panels ───────────────────────────────────────────────────────────

function transcriptShown() {
  return ed.transcript ?? WORD_TOOLS.has(ed.tool);
}

function applyTool() {
  // A new tool starts from its own default; the toggle only lasts within one.
  if (ed.lastTool !== ed.tool) ed.transcript = null;
  ed.lastTool = ed.tool;
  const root = ed.el.querySelector("[data-clips-ed-root]");
  root.dataset.tool = ed.tool;
  root.querySelector("[data-clips-stage]")?.style.setProperty("--clips-split", `${splitPct}%`);
  root.dataset.transcript = transcriptShown() ? "on" : "off";
  const tgl = ed.el.querySelector('[data-clips-ed="transcript"]');
  if (tgl) tgl.setAttribute("aria-pressed", String(transcriptShown()));
  ed.el.querySelectorAll("[data-clips-tool]").forEach((b) => {
    const on = b.dataset.clipsTool === ed.tool;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", String(on));
  });
  // The tool is in the URL, so a reload or Back lands on it again.
  history.replaceState(null, "", `#/clips/${ed.video.id}/edit/${ed.clip.id}?tool=${ed.tool}`);
  syncTlTools();
  sizeCanvases();
  paintPanel();
  paintTimeline();
  paintTexts();
  paintFrame();
  ce.repaintStage();
}

function paintPanel() {
  const host = ed.el.querySelector("[data-clips-panel]");
  if (!host) return;
  const tool = TOOLS.find((t) => t.id === ed.tool);
  const body = {
    reframe: reframePanel,
    subtitles: subtitlesPanel,
    text: textPanel,
    brand: brandPanel,
  }[ed.tool]();
  host.innerHTML = `<h2 class="clips-ed__panel-title">${tool.label}</h2>${body}`;
  if (ed.tool === "subtitles") ce.refreshControls();
}

function reframePanel() {
  const segs = ed.w.segments;
  const seg = segmentAt(segs, ed.t);
  ed.panelSeg = seg.id;
  const i = segs.indexOf(seg);
  const r = ratio();
  const blocked = twoBlockedReason(ed.ctx, seg, r);
  const sameCam = segs.filter((s) => s.camera === seg.camera).length;
  const hints = {
    AUTO: `I chose ${autoKind(seg)}`,
    ONE: "One window",
    TWO: "Two, stacked",
    FIT: "Whole frame, blurred fill",
  };
  // Each layout drawn as what it does to a vertical frame — read at a glance.
  const glyph = {
    AUTO: `<i class="ap-icon-sparkles"></i>`,
    ONE: `<b class="clips-layout__person"></b>`,
    TWO: `<b class="clips-layout__person"></b><b class="clips-layout__person"></b>`,
    FIT: `<b class="clips-layout__inset"></b>`,
  };
  const layoutBtns = LAYOUTS.map((l) => {
    const off = l.id === "TWO" && blocked && seg.layout !== "TWO";
    return `<label class="ap-radio-card card clips-layout${off ? " is-off" : ""}">
      <input type="radio" name="clips-layout" value="${l.id}" data-clips-layout-pick ${seg.layout === l.id ? "checked" : ""} ${off ? "disabled" : ""} />
      <div>
        <span class="clips-layout__glyph clips-layout__glyph--${l.id.toLowerCase()}" aria-hidden="true">${glyph[l.id]}</span>
        <span class="clips-layout__name">${l.label}</span>
        <span class="clips-layout__hint">${escapeHtml(off ? blocked : hints[l.id])}</span>
      </div>
    </label>`;
  }).join("");
  const zoom = seg.layout === "ONE" ? seg.one.zoom : seg.layout === "TWO" ? seg.two.zoom : null;
  return `
    <p class="clips-ed__panel-lead">The clip is cut in parts, one per camera shot. I framed each one — drag the window on the source to take over.</p>
    <div class="clips-ed__seg-head">
      <span class="clips-ed__seg-name">Part ${i + 1} of ${segs.length}</span>
      <span class="clips-ed__seg-tags">
        <span class="ap-tag grey">${escapeHtml(cameraName(seg.camera))}</span>
        <span class="ap-tag grey">${seg.origin === "USER" ? "Yours" : "Auto"}</span>
        ${seg.origin === "USER" ? `<button type="button" class="ap-button ghost grey clips-ed__seg-reset" data-clips-ed="reset-seg"><i class="ap-icon-reset" aria-hidden="true"></i><span>Back to Auto</span></button>` : ""}
      </span>
    </div>
    <p class="clips-ed__fact">${fmtPrecise(seg.startMs - ed.w.startMs)} → ${fmtPrecise(seg.endMs - ed.w.startMs)} · ${((seg.endMs - seg.startMs) / 1000).toFixed(1)}s</p>
    <div class="clips-ed__group">
      <span class="clips-ed__label">Layout</span>
      <div class="clips-ed__layouts" role="radiogroup" aria-label="Layout">${layoutBtns}</div>
    </div>
    ${
      zoom != null
        ? `<div class="clips-ed__group">
            <span class="clips-ed__label">Zoom ${zoom.toFixed(2)}×</span>
            <input type="range" class="ap-slider" min="1" max="${seg.layout === "TWO" ? 3 : 2.5}" step="0.05" value="${zoom}" data-clips-zoom
              style="--fill:${((zoom - 1) / ((seg.layout === "TWO" ? 3 : 2.5) - 1)) * 100}%" aria-label="Zoom" />
          </div>`
        : ""
    }
    ${
      seg.layout === "ONE"
        ? `<label class="ap-toggle-container clips-ed__toggle"><input type="checkbox" data-clips-follow ${seg.follow ? "checked" : ""} /><i></i><span>Follow the speaker</span></label>`
        : ""
    }
    ${
      seg.layout === "TWO"
        ? `<button type="button" class="ap-button stroked grey" data-clips-ed="swap"><i class="ap-icon-refresh" aria-hidden="true"></i><span>Swap top and bottom</span></button>`
        : ""
    }
    ${
      seg.camera && sameCam > 1 && seg.origin === "USER"
        ? `<div class="clips-ed__group clips-ed__apply">
            <p class="clips-ed__hint">${escapeHtml(cameraName(seg.camera))} comes back ${sameCam - 1} more time${sameCam === 2 ? "" : "s"} in this clip.</p>
            <button type="button" class="ap-button stroked grey" data-clips-ed="apply-cam">
              <i class="ap-icon-stack" aria-hidden="true"></i><span>Use this framing on all ${sameCam} shots</span>
            </button>
          </div>`
        : ""
    }
    <div class="clips-ed__panel-foot">
      <button type="button" class="ap-button ghost grey" data-clips-ed="reset-all"><i class="ap-icon-reset" aria-hidden="true"></i><span>Reset every part to auto</span></button>
    </div>`;
}

function subtitlesPanel() {
  return `
    <p class="clips-ed__panel-lead">Pick a style, then drag the subtitles on the video to place them.</p>
    <div class="clips-ed__cap-source" data-clips-cap-source>${capSourceHTML()}</div>
    <div class="cap-ed__tabs" role="tablist">
      <button type="button" class="cap-ed__tab" data-ce-tab="presets">Presets</button>
      <button type="button" class="cap-ed__tab" data-ce-tab="font">Font</button>
      <button type="button" class="cap-ed__tab" data-ce-tab="effects">Effects</button>
    </div>
    <div class="cap-ed__tabpanel" data-ce-tabpanel></div>`;
}

// Where the clip's subtitle style comes from: the video's, or its own — with
// the way back.
function capSourceHTML() {
  const preset = ce.getState()?.presetId;
  return ed.capOwn
    ? `<span>This clip's own style · <strong>${escapeHtml(presetLabel(preset))}</strong></span>
       <button type="button" class="ap-button ghost grey" data-clips-ed="cap-video"><i class="ap-icon-reset" aria-hidden="true"></i><span>Back to the video's style</span></button>`
    : `<span>The video's style · <strong>${escapeHtml(presetLabel(preset))}</strong></span>`;
}

function textPanel() {
  const rows = ed.w.texts
    .map(
      (
        tx,
        k,
      ) => `<li class="clips-ed__text${tx.id === ed.selectedText ? " is-selected" : ""}" data-clips-text-row="${tx.id}">
        <div class="clips-ed__text-head">
          <span class="clips-ed__seg-name">Text ${k + 1}</span>
          <button type="button" class="ap-icon-button transparent" data-clips-text-remove="${tx.id}" aria-label="Remove text ${k + 1}" data-tooltip="Remove"><i class="ap-icon-trash" aria-hidden="true"></i></button>
        </div>
        <textarea class="clips-ed__text-input" rows="2" data-clips-text-field="text" data-id="${tx.id}" aria-label="Text">${escapeHtml(tx.text)}</textarea>
        <div class="ap-segmented-control" role="radiogroup" aria-label="Style">
          ${["box", "plain"]
            .map(
              (
                st,
              ) => `<button type="button" class="ap-segmented-control__segment${tx.style === st ? " ap-segmented-control__segment--selected" : ""}" role="radio" aria-checked="${tx.style === st}"
                data-clips-text-style="${st}" data-id="${tx.id}"><span class="ap-segmented-control__label">${st === "box" ? "Boxed" : "Plain"}</span></button>`,
            )
            .join("")}
        </div>
        <label class="clips-ed__field"><span>Size</span>
          <input type="range" class="ap-slider" min="36" max="120" step="2" value="${tx.size}" data-clips-text-field="size" data-id="${tx.id}"
            style="--fill:${((tx.size - 36) / 84) * 100}%" aria-label="Size" /></label>
        <p class="clips-ed__fact">On screen ${fmtPrecise(tx.startMs)} → ${fmtPrecise(tx.endMs)}</p>
        <div class="clips-ed__row">
          <button type="button" class="ap-button stroked grey" data-clips-text-at="start" data-id="${tx.id}">Start at <span data-clips-at-rel>${fmtPrecise(ed.t - ed.w.startMs)}</span></button>
          <button type="button" class="ap-button stroked grey" data-clips-text-at="end" data-id="${tx.id}">End at <span data-clips-at-rel>${fmtPrecise(ed.t - ed.w.startMs)}</span></button>
        </div>
      </li>`,
    )
    .join("");
  const hasHook = ed.w.texts.some((t) => t.text === ed.w.title);
  return `
    <p class="clips-ed__panel-lead">A title for the first seconds, a name, a key number. Drag it on the video to place it.</p>
    <div class="clips-ed__row">
      ${hasHook ? "" : `<button type="button" class="ap-button stroked grey" data-clips-ed="add-hook"><i class="ap-icon-archie-official" aria-hidden="true"></i><span>Add the clip title</span></button>`}
      <button type="button" class="ap-button stroked grey" data-clips-ed="add-text"><i class="ap-icon-plus" aria-hidden="true"></i><span>Add text</span></button>
    </div>
    ${rows ? `<ul class="clips-ed__text-list">${rows}</ul>` : ""}`;
}

function brandPanel() {
  const b = ed.w.brand;
  const pb = ed.pb;
  const corners = [
    ["tl", "Top left"],
    ["tr", "Top right"],
    ["bl", "Bottom left"],
    ["br", "Bottom right"],
  ];
  const fromPb = JSON.stringify(b) === JSON.stringify(ed.look.brand);
  return `
    <p class="clips-ed__panel-lead">${
      pb
        ? `From the ${escapeHtml(pb.name)} Playbook. What you change here applies to this clip only.`
        : "No Playbook: no logo or brand cards to add."
    }</p>
    ${
      pb?.brandLogo
        ? `<label class="ap-toggle-container clips-ed__toggle"><input type="checkbox" data-clips-brand="logo" ${b.logo ? "checked" : ""} /><i></i><span>Logo on the video</span></label>
          ${
            b.logo
              ? `<div class="clips-ed__group">
                  ${dsSelect({
                    label: "Corner",
                    valueHtml: escapeHtml(corners.find(([id]) => id === b.corner)?.[1] || "Top right"),
                    current: b.corner,
                    attr: "data-clips-corner",
                    options: corners.map(([id, label]) => ({ id, label })),
                  })}
                  <span class="clips-ed__label">Size <span data-clips-logo-size-val>${Math.round(b.logoSize * 100)}%</span></span>
                  <input type="range" class="ap-slider" min="0.08" max="0.3" step="0.01" value="${b.logoSize}" data-clips-logo-size
                    style="--fill:${((b.logoSize - 0.08) / 0.22) * 100}%" aria-label="Logo size" />
                </div>`
              : ""
          }`
        : pb
          ? `<p class="clips-ed__hint">This Playbook has no logo yet.</p>`
          : ""
    }
    ${
      pb
        ? `<label class="ap-toggle-container clips-ed__toggle"><input type="checkbox" data-clips-brand="intro" ${b.intro ? "checked" : ""} /><i></i><span>Intro card (2 s, the clip's title)</span></label>
           <label class="ap-toggle-container clips-ed__toggle"><input type="checkbox" data-clips-brand="outro" ${b.outro ? "checked" : ""} /><i></i><span>Outro card (2 s, the call to action)</span></label>
           <div class="clips-ed__row">
             ${fromPb ? "" : `<button type="button" class="ap-button ghost grey" data-clips-ed="brand-reset">Back to the Playbook's look</button>`}
             <a class="ap-link" href="#/playbook/${encodeURIComponent(pb.id)}?tab=brand">Open the Playbook</a>
           </div>`
        : ""
    }`;
}

// ── Edits ────────────────────────────────────────────────────────────

const snapshot = () => JSON.stringify(ed.w);

function pushUndo() {
  ed.undo.push(snapshot());
  if (ed.undo.length > 200) ed.undo.shift();
  ed.redo = [];
}

function restore(json) {
  const prevLen = clipLen();
  ed.w = JSON.parse(json);
  if (clipLen() !== prevLen) ce.setDuration(clipLen() / 1000);
  setDirty();
  refreshAll();
}

// Changed = differs from what's saved, so undoing back to it reads "Saved".
function setDirty() {
  ed.dirty = ed.capDirty || snapshot() !== ed.saved;
  syncTopbar();
}

// Patch the topbar's buttons in place — a repaint would take the focus away
// from the title field while it's being typed in.
function syncTopbar() {
  const bar = document.getElementById("topbar");
  const save = bar?.querySelector('[data-clips-ed="save"]');
  if (!save) return paintTopbar();
  save.disabled = !ed.dirty;
  save.querySelector("span").textContent = ed.dirty ? "Save" : "Saved";
  bar.querySelector('[data-clips-ed="undo"]').disabled = !ed.undo.length;
  bar.querySelector('[data-clips-ed="redo"]').disabled = !ed.redo.length;
  return undefined;
}

function refreshAll() {
  syncTopbar();
  sizeCanvases();
  paintPanel();
  paintTimeline();
  paintTexts();
  seek(Math.max(ed.w.startMs, Math.min(ed.w.endMs - 1, ed.t)));
}

function edit(fn, { timeline = true } = {}) {
  pushUndo();
  fn();
  setDirty();
  paintPanel();
  syncTlTools();
  if (timeline) paintTimeline();
  paintFrame();
}

// Trim's errors sit next to the In / Out fields, where the time was typed.
function trimError(msg) {
  ed.trimError = msg;
  paintInOut();
}

function setRange(startMs, endMs) {
  const dur = ed.video.durationMs;
  let s = Math.max(0, Math.round(startMs));
  let e = Math.min(dur, Math.round(endMs));
  if (e - s < MIN_CLIP_MS) return trimError("A clip runs 5 seconds at least.");
  if (e - s > MAX_CLIP_MS) return trimError("A clip runs 5 minutes at most.");
  ed.trimError = "";
  edit(() => {
    ed.w.startMs = s;
    ed.w.endMs = e;
    ed.w.segments = retrim(ed.ctx, ed.w.segments, s, e);
    ce.setDuration((e - s) / 1000);
  });
  seek(Math.max(s, Math.min(e - 1, ed.t)));
  return undefined;
}

function parseTime(str) {
  const m = String(str)
    .trim()
    .match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (Number(m[1] || 0) * 60 + Number(m[2])) * 1000;
}

function save() {
  const c = ed.clip;
  const patch = {
    title: ed.w.title.trim() || c.title,
    startMs: ed.w.startMs,
    endMs: ed.w.endMs,
    segments: ed.w.segments,
    texts: ed.w.texts,
    ratio: ed.w.ratioId === ed.video.settings.ratio && !c.ratio ? null : ed.w.ratioId,
    brand: JSON.stringify(ed.w.brand) === JSON.stringify(ed.look.brand) ? null : ed.w.brand,
  };
  // The words are the clip's either way; the look is its own, or the video's.
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
  ed.saved = snapshot();
  ed.capDirty = false;
  ed.dirty = false;
  syncTopbar();
  showToast("Clip saved");
}

function leave(to) {
  if (!ed.dirty) return navigate(to);
  openConfirm({
    title: "Save your changes?",
    body: "This clip has edits you haven't saved.",
    confirmLabel: "Save and leave",
    cancelLabel: "Leave without saving",
    onConfirm: () => {
      save();
      navigate(to);
    },
    onCancel: () => navigate(to),
  });
  return undefined;
}

// ── Events ───────────────────────────────────────────────────────────

function bindAll() {
  const root = ed.el;
  const topbar = document.getElementById("topbar");
  const onClick = (e) => handleClick(e);
  const onInput = (e) => handleInput(e);
  const onChange = (e) => handleChange(e);
  const onDown = (e) => handlePointerDown(e);
  const onKey = (e) => handleKey(e);
  root.addEventListener("click", onClick);
  topbar?.addEventListener("click", onClick);
  topbar?.addEventListener("input", onInput);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey);
  ed.disposers.push(bindSelectDismiss(root));
  ed.cardLogo = new Image();
  if (ed.pb?.brandLogo) ed.cardLogo.src = ed.pb.brandLogo;
  ed.disposers.push(() => {
    root.removeEventListener("click", onClick);
    topbar?.removeEventListener("click", onClick);
    topbar?.removeEventListener("input", onInput);
    root.removeEventListener("input", onInput);
    root.removeEventListener("change", onChange);
    root.removeEventListener("pointerdown", onDown);
    document.removeEventListener("keydown", onKey);
  });
}

function handleClick(e) {
  if (!ed) return;
  const t = e.target;
  const tool = t.closest("[data-clips-tool]");
  if (tool) {
    ed.tool = tool.dataset.clipsTool;
    applyTool();
    return;
  }
  const act = t.closest("[data-clips-ed]")?.dataset.clipsEd;
  const seg = segmentAt(ed.w.segments, ed.t);
  switch (act) {
    case "back":
      return leave(`/clips/${ed.video.id}`);
    case "undo":
      return undo();
    case "redo":
      return redo();
    case "save":
      return save();
    case "draft":
      if (ed.dirty) save();
      setSelection(ed.video.id, [ed.clip.id]);
      primeDraftSetup(ed.video.id);
      return navigate(`/clips/${ed.video.id}?tab=drafts`);
    case "play":
      return togglePlay();
    case "transcript":
      ed.transcript = !transcriptShown();
      return applyTool();
    case "set-start":
      return setRange(ed.t, ed.w.endMs);
    case "set-end":
      return setRange(ed.w.startMs, ed.t);
    case "snap":
      ed.snap = !ed.snap;
      return syncTlTools();
    case "split":
      return doSplit();
    case "merge-prev":
    case "merge-next":
      return edit(() => merge(ed.ctx, ed.w.segments, seg, act === "merge-prev" ? -1 : 1));
    case "apply-cam":
      return edit(() => {
        const n = applyToCamera(ed.w.segments, seg);
        showToast(`Applied to ${n} more ${n === 1 ? "shot" : "shots"}`);
      });
    case "reset-seg":
      return edit(() => resetSegment(ed.ctx, seg));
    case "reset-all":
      return edit(() => (ed.w.segments = initialSegments(ed.ctx, ed.w.startMs, ed.w.endMs)));
    case "swap":
      return edit(() => {
        [seg.two.top, seg.two.bottom] = [seg.two.bottom, seg.two.top];
        seg.origin = "USER";
      });
    case "add-hook":
    case "add-text":
      edit(() => {
        const id = `tx${Date.now().toString(36)}`;
        const rel = act === "add-hook" ? 0 : Math.max(0, ed.t - ed.w.startMs);
        ed.w.texts.push({
          id,
          text: act === "add-hook" ? ed.w.title : "Your text",
          startMs: rel,
          endMs: Math.min(clipLen(), rel + 3000),
          x: 0.5,
          y: act === "add-hook" ? 0.3 : 0.5,
          size: act === "add-hook" ? 64 : 56,
          style: "box",
        });
        ed.selectedText = id;
        paintTexts();
      });
      // The playhead goes to the new text, so it shows at full strength.
      return seek(ed.w.startMs + txById(ed.selectedText).startMs + 1);
    case "cap-video": {
      ce.resetStyle(clipCaptionState(ed.video, { captionState: null }));
      // After the reset's own change event, which counts as a style change.
      ed.capOwn = false;
      ed.capLook = styleKey(ce.getState());
      const src = ed.el.querySelector("[data-clips-cap-source]");
      if (src) src.innerHTML = capSourceHTML();
      return undefined;
    }
    case "brand-reset":
      return edit(() => (ed.w.brand = { ...ed.look.brand }));
    default:
      break;
  }
  const segBtn = t.closest("[data-clips-seg]");
  if (segBtn) {
    const s = ed.w.segments.find((x) => x.id === segBtn.dataset.clipsSeg);
    if (s) seek(s.startMs + 1);
    if (ed.tool !== "reframe") {
      ed.tool = "reframe";
      applyTool();
    }
    return undefined;
  }
  const fmt = t.closest("[data-clips-format]");
  if (fmt) {
    fmt.closest("details")?.removeAttribute("open");
    const id = fmt.dataset.clipsFormat === "video" ? ed.video.settings.ratio : fmt.dataset.clipsFormat;
    if (id === ed.w.ratioId) return undefined;
    return edit(() => {
      ed.w.ratioId = id;
      sizeCanvases();
      ce.repaintStage();
      paintTexts();
    });
  }
  const dz = t.closest("[data-clips-deadzones]");
  if (dz) {
    dz.closest("details")?.removeAttribute("open");
    ed.deadZones = dz.dataset.clipsDeadzones;
    ce.setDeadZones(ed.deadZones);
    paintFormatPicker();
    paintLogo();
    return undefined;
  }
  const corner = t.closest("[data-clips-corner]");
  if (corner) {
    corner.closest("details")?.removeAttribute("open");
    return edit(() => (ed.w.brand.corner = corner.dataset.clipsCorner), { timeline: false });
  }
  const style = t.closest("[data-clips-text-style]");
  if (style)
    return edit(() => {
      txById(style.dataset.id).style = style.dataset.clipsTextStyle;
      paintTexts();
    });
  const at = t.closest("[data-clips-text-at]");
  if (at)
    return edit(() => {
      const tx = txById(at.dataset.id);
      const rel = ed.t - ed.w.startMs;
      if (at.dataset.clipsTextAt === "start") tx.startMs = Math.min(rel, tx.endMs - 500);
      else tx.endMs = Math.max(rel, tx.startMs + 500);
      paintTexts();
    });
  const rm = t.closest("[data-clips-text-remove]");
  if (rm)
    return edit(() => {
      ed.w.texts = ed.w.texts.filter((x) => x.id !== rm.dataset.clipsTextRemove);
      paintTexts();
    });
  const pick = t.closest("[data-clips-text-pick]");
  if (pick) {
    ed.selectedText = pick.dataset.clipsTextPick;
    const tx = txById(ed.selectedText);
    if (tx) seek(ed.w.startMs + tx.startMs + 1);
    ed.tool = "text";
    applyTool();
    paintTimeline();
  }
  return undefined;
}

const txById = (id) => ed.w.texts.find((x) => x.id === id);

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

function doSplit() {
  if (ed.tool !== "reframe") {
    ed.tool = "reframe";
    applyTool();
  }
  const { t } = snapMs(ed.ctx, Math.round(ed.t), { on: ed.snap });
  pushUndo();
  if (!split(ed.ctx, ed.w.segments, t)) {
    ed.undo.pop();
    showToast("Too close to the edge of a part to split here.", { variant: "error" });
    return;
  }
  setDirty();
  paintPanel();
  paintTimeline();
  paintFrame();
  syncTlTools();
}

let liveZoomUndo = false;
function handleInput(e) {
  if (!ed) return;
  const t = e.target;
  if (t.matches("[data-clips-ed-title]")) {
    ed.w.title = t.value;
    setDirtyQuiet();
    return;
  }
  const seg = segmentAt(ed.w.segments, ed.t);
  if (t.matches("[data-clips-zoom]")) {
    if (!liveZoomUndo) {
      pushUndo();
      liveZoomUndo = true;
    }
    if (seg.layout === "AUTO") toManual(ed.ctx, seg, ed.t, ratio());
    (seg.layout === "TWO" ? seg.two : seg.one).zoom = Number(t.value);
    seg.origin = "USER";
    t.style.setProperty("--fill", `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    t.closest(".clips-ed__group").querySelector(".clips-ed__label").textContent = `Zoom ${Number(t.value).toFixed(2)}×`;
    setDirtyQuiet();
    paintFrame();
    return;
  }
  if (t.matches("[data-clips-logo-size]")) {
    ed.w.brand.logoSize = Number(t.value);
    t.style.setProperty("--fill", `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    const val = ed.el.querySelector("[data-clips-logo-size-val]");
    if (val) val.textContent = `${Math.round(t.value * 100)}%`;
    setDirtyQuiet();
    paintLogo();
    return;
  }
  if (t.matches("[data-clips-text-field]")) {
    const tx = txById(t.dataset.id);
    if (!tx) return;
    if (t.dataset.clipsTextField === "size") {
      tx.size = Number(t.value);
      t.style.setProperty("--fill", `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    } else tx.text = t.value;
    setDirtyQuiet();
    paintTexts();
  }
}

// Typing and sliding mark the clip as changed without repainting the panel
// under the cursor.
function setDirtyQuiet() {
  setDirty();
}

function handleChange(e) {
  if (!ed) return;
  const t = e.target;
  const seg = segmentAt(ed.w.segments, ed.t);
  if (t.matches("[data-clips-zoom]")) {
    liveZoomUndo = false;
    paintPanel();
    paintTimeline();
    return;
  }
  if (t.matches("[data-clips-time]")) {
    const ms = parseTime(t.value);
    if (ms == null) return trimError("Type a time like 1:32.5");
    if (t.dataset.clipsTime === "start") setRange(ms, ed.w.endMs);
    else setRange(ed.w.startMs, ms);
    t.value = fmtPrecise(t.dataset.clipsTime === "start" ? ed.w.startMs : ed.w.endMs); // 0:33 → 0:33.0
    return undefined;
  }
  if (t.matches("[data-clips-layout-pick]")) return edit(() => setLayout(ed.ctx, seg, t.value, ed.t, ratio()));
  if (t.matches("[data-clips-follow]")) return edit(() => ((seg.follow = t.checked), (seg.origin = "USER")));
  if (t.matches("[data-clips-snap]")) {
    ed.snap = t.checked;
    return undefined;
  }
  if (t.matches("[data-clips-brand]")) {
    const key = t.dataset.clipsBrand;
    edit(() => (ed.w.brand[key] = t.checked));
    // A card switched on is shown right away, held on the Output.
    if (t.checked && (key === "intro" || key === "outro")) {
      if (ed.playing) stop();
      ed.phase = key;
      syncTime();
      paintFrame();
    }
    return undefined;
  }
  if (t.matches("[data-clips-text-field]") || t.matches("[data-clips-logo-size]")) {
    pushUndo();
    paintTimeline();
  }
  return undefined;
}

function handleKey(e) {
  if (!ed) return;
  if (e.target.closest?.("[data-clips-splitter]") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    applySplit(splitPct + (e.key === "ArrowLeft" ? -2 : 2));
    return;
  }
  if (e.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
  if (document.body.classList.contains("has-modal")) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "s" || e.key === "S") {
    if (!e.metaKey && !e.ctrlKey) doSplit();
  } else if ((e.key === "i" || e.key === "o") && !e.metaKey && !e.ctrlKey) {
    // In / Out at the playhead — the editing apps' keys.
    if (e.key === "i") setRange(ed.t, ed.w.endMs);
    else setRange(ed.w.startMs, ed.t);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    seek(ed.t - FRAME_MS);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    seek(ed.t + FRAME_MS);
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }
}

// ── Pointer: scrub, trim, boundaries, the crop window, text overlays ─

function handlePointerDown(e) {
  if (!ed || e.button !== 0) return;
  const t = e.target;
  const trim = t.closest("[data-clips-trim]");
  if (trim) return startDrag(e, { kind: "trim", edge: trim.dataset.clipsTrim });
  const bound = t.closest("[data-clips-bound]");
  if (bound) return startDrag(e, { kind: "bound", k: Number(bound.dataset.clipsBound), el: bound });
  if (t.closest("[data-clips-splitter]")) return startSplitDrag(e);
  if (t.closest("[data-clips-overlay]")) return startCropDrag(e);
  const text = t.closest("[data-clips-text]");
  if (text) return startTextDrag(e, text);
  if (t.closest("[data-clips-scrub]") && !t.closest("[data-clips-seg], [data-clips-text-pick]"))
    return startDrag(e, { kind: "scrub" });
  return undefined;
}

function startDrag(e, d) {
  e.preventDefault();
  ed.drag = d;
  if (d.kind !== "scrub") pushUndo();
  const move = (ev) => onDragMove(ev);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onDragEnd();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  onDragMove(e);
}

function onDragMove(e) {
  const d = ed.drag;
  if (!d) return;
  const ms = msAt(e.clientX);
  if (d.kind === "scrub") return seek(snapMs(ed.ctx, ms, { on: ed.snap, radiusMs: 0 }).t);
  if (d.kind === "trim") {
    const v = ed.viewport;
    if (d.edge === "start")
      ed.w.startMs = Math.round(
        Math.max(v.from, Math.min(ed.w.endMs - MIN_CLIP_MS, Math.max(ed.w.endMs - MAX_CLIP_MS, ms))),
      );
    else
      ed.w.endMs = Math.round(
        Math.min(v.to, Math.max(ed.w.startMs + MIN_CLIP_MS, Math.min(ed.w.startMs + MAX_CLIP_MS, ms))),
      );
    paintTimeline();
    return seek(d.edge === "start" ? ed.w.startMs : ed.w.endMs - 1);
  }
  if (d.kind === "bound") {
    const { t, snapped } = snapMs(ed.ctx, Math.round(ms), { on: ed.snap });
    const v = moveBoundary(ed.ctx, ed.w.segments, d.k, t);
    paintTimeline();
    ed.el.querySelector(`[data-clips-bound="${d.k}"]`)?.classList.toggle("is-snapped", snapped);
    return seek(v);
  }
  return undefined;
}

function onDragEnd() {
  const d = ed.drag;
  ed.drag = null;
  if (!d) return;
  if (d.kind === "trim") {
    ed.w.segments = retrim(ed.ctx, ed.w.segments, ed.w.startMs, ed.w.endMs);
    ce.setDuration(clipLen() / 1000);
    setDirty();
    paintPanel();
  }
  if (d.kind === "bound") {
    settleBoundary(ed.ctx, ed.w.segments, d.k);
    setDirty();
    paintPanel();
  }
  paintTimeline();
  paintFrame();
}

// The crop window on the source: drag inside to move it, drag a corner to
// zoom, click a face to centre on it — the playground's gestures.
function startCropDrag(e) {
  const ov = ed.el.querySelector("[data-clips-overlay]");
  const r = ov.getBoundingClientRect();
  const at = (ev) => [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
  const [px, py] = at(e);
  const seg = segmentAt(ed.w.segments, ed.t);
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
      const target = seg.layout === "TWO" ? seg.two : seg.one;
      const c = seg.layout === "TWO" ? seg.two[pane === 0 ? "top" : "bottom"] : seg.one;
      const half = Math.max(
        Math.abs(qy - c.cy),
        (Math.abs(qx - c.cx) * W) / H / (seg.layout === "TWO" ? ratio() * 2 : ratio()),
      );
      target.zoom = Math.max(1, Math.min(seg.layout === "TWO" ? 3 : 2.5, 1 / (2 * half)));
    } else if (seg.layout === "TWO") {
      const key = pane === 0 ? "top" : "bottom";
      seg.two[key].cx = clamp01(start[key].cx + dx);
      seg.two[key].cy = clamp01(start[key].cy + dy);
    } else {
      seg.one.cx = clamp01(start.cx + dx);
      seg.one.cy = clamp01(start.cy + dy);
      seg.follow = false;
    }
    seg.origin = "USER";
    paintFrame();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!moved) {
      const face = faceAt(ed.ctx, ed.t, px, py);
      if (face) centreOnFace(ed.ctx, seg, face, ed.t, ratio());
      else return void ed.undo.pop();
    }
    setDirty();
    paintPanel();
    paintTimeline();
    paintFrame();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Source / Output split, in % of the stage: dragged, or nudged with the arrow
// keys on the focused handle. Kept for the session.
let splitPct = 64;

function applySplit(pct) {
  splitPct = Math.max(30, Math.min(80, pct));
  const stage = ed.el.querySelector("[data-clips-stage]");
  stage.style.setProperty("--clips-split", `${splitPct}%`);
  ed.el.querySelector("[data-clips-splitter]")?.setAttribute("aria-valuenow", String(Math.round(splitPct)));
  sizeCanvases();
  paintFrame();
  ce.repaintStage();
}

function startSplitDrag(e) {
  const handle = e.target.closest("[data-clips-splitter]");
  const stage = ed.el.querySelector("[data-clips-stage]");
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

function startTextDrag(e, node) {
  const out = ed.el.querySelector("[data-clips-output]");
  const r = out.getBoundingClientRect();
  const tx = txById(node.dataset.clipsText);
  if (!tx) return;
  e.preventDefault();
  e.stopPropagation();
  ed.selectedText = tx.id;
  pushUndo();
  const sx = e.clientX;
  const sy = e.clientY;
  const ox = tx.x;
  const oy = tx.y;
  const move = (ev) => {
    tx.x = Math.max(0.05, Math.min(0.95, ox + (ev.clientX - sx) / r.width));
    tx.y = Math.max(0.05, Math.min(0.95, oy + (ev.clientY - sy) / r.height));
    node.style.left = `${tx.x * 100}%`;
    node.style.top = `${tx.y * 100}%`;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    setDirty();
    if (ed.tool !== "text") {
      ed.tool = "text";
      applyTool();
    } else paintPanel();
    paintTimeline();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
