// Embeddable caption editor — a subtitle-editing surface ported from
// platform-studio's video-editor playground, adapted to archie's vanilla JS +
// DS conventions. Mounted INSIDE the clips modal (the "Subtitles" tab of the
// clip editor), not as a separate full-screen surface.
//
// Layout: three panes inside the host container —
//   • Left   : flowing word-level transcript (click a word to seek, double-
//              click to edit its text) + a Speech-cleanup launcher.
//   • Center : faux video preview (the clip), a live caption box positioned /
//              styled per the current preset, dead-zone safe-area guides, and
//              a transport bar (play / scrub).
//   • Right  : tabs — Presets / Font / Effects / Cleanup.
//
// Public API:
//   mount(host, clip, source, { onChange }) — render into `host`; onChange(patch)
//       fires live on every edit with { captionState, transcript, captionsOn,
//       captionStyle, captions } so the hosting modal's draft stays in sync.
//   unmount() — stop playback, drop listeners, clear the host.
//
// Hosted by the Clips space's unified clip editor (flag clipsSpace), it runs
// on the HOST's clock: `opts.clock` = { seek(sec), toggle() } drives the
// footage, and the host pushes the playhead back with setTime(sec, playing) —
// the clip is a window of a long source, so the editor can't own the video.
// `opts.presetIds` narrows the preset grid (prod's eight + none); the Clean up
// tool switches the transcript's cleanup decorations with setCleanupMode().
//
// No real video / ffmpeg — playback is a simulated playhead (rAF), captions
// are pure DOM/CSS. Karaoke word-sweep is intentionally omitted; emphasis is
// per-word marks + an optional static "phrase" highlight under the playhead.

import { escapeHtml, formatClock } from "./utils.js?v=2343";
import {
  PRESETS,
  presetById,
  defaultCaptionState,
  buildTranscript,
  deriveCues,
  stripCaptionPunctuation,
  resolveXFraction,
  resolveYFraction,
  DEAD_ZONES,
  DESIGN_WIDTH,
  detectFillers,
  detectPauses,
  videoForClip,
} from "./clip-captions.js?v=2343";

const FONT_FAMILIES = [
  "Montserrat, Roboto, sans-serif",
  "Roboto, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
];
const FONT_FAMILY_LABELS = {
  "Montserrat, Roboto, sans-serif": "Montserrat",
  "Roboto, sans-serif": "Roboto",
  "Arial, sans-serif": "Arial",
  "Georgia, serif": "Georgia",
  "Courier New, monospace": "Courier",
};

// ── Module state ─────────────────────────────────────────────────────

let host = null; // host container the editor is mounted into
let root = null; // the .cap-ed element inside host
let mounted = false;

let clip = null;
let source = null;
let onChangeCb = null;

let state = null; // CaptionState
let words = []; // transcript words [{ id, text, start, end, mark, removed }]
let cues = []; // derived chunked cues
let duration = 1;

let currentTime = 0;
let playing = false;
let rafId = null;
let lastTs = 0;

let activeTab = "presets";
let cleanupActive = false; // show filler/pause decorations in the transcript
let pausesRemoved = new Set(); // pause idx removed
let clock = null; // host clock (Clips space) — null when the editor owns playback
let presetIds = null; // narrowed preset grid, or null for the whole catalog
let pauseThreshold = 0.4; // seconds of silence that count as a pause

let renderedCueIdx = -1;
let wordSpans = []; // [{ span, start, mark }]
let menuEl = null; // open word popover
let boxDrag = null; // caption-box drag state (null when not dragging)
let resizeDrag = null; // caption-box resize state (null when not resizing)

// ── Helpers ──────────────────────────────────────────────────────────

const fmt = (t) => formatClock(t);

function $(sel) {
  return root ? root.querySelector(sel) : null;
}

// Flat dark video placeholder — no decorative gradients. The stage's sunken
// surface (CSS) carries the frame; the play glyph is the affordance.
function previewBg() {
  return "none";
}

function emitChange() {
  if (typeof onChangeCb !== "function") return;
  onChangeCb({
    captionState: { ...state },
    transcript: words.map((w) => ({ ...w })),
    captionsOn: state.presetId !== "none",
    captionStyle: state.presetId,
    captions: deriveSimpleCaptions(),
  });
}

// Derive the simple segment array (used by the clip-tab teaser overlay + the
// clip card) from the current cues.
function deriveSimpleCaptions() {
  return cues.map((c, i) => ({
    id: `${clip?.id || "clip"}_cap_${i}`,
    start: c.start,
    end: c.end,
    text: c.words.map((w) => stripCaptionPunctuation(w.text)).join(" "),
    emph: [],
  }));
}

// ── Rendering model ──────────────────────────────────────────────────
//
// The caption editor no longer owns a self-contained layout. The video-clips
// modal renders a persistent editor shell — rail · options panel · stage ·
// timeline — with all the data-ce-* hooks already in place (stage hooks in the
// preview, control hooks in the left options panel). mount() takes that shell
// as its root and renders into the existing hooks, so the preview + timeline
// stay put while only the left options panel swaps between Clip / Subtitles.
//
// Hooks the shell must provide:
//   stage  (always present): [data-ce-stage] wrapping [data-ce-video],
//          [data-ce-deadzones], [data-ce-playicon], [data-ce-box],
//          [data-ce-frame] (+ 8 [data-ce-resize] handles); transport bar with
//          [data-ce="playpause"]/[data-ce-playglyph], [data-ce-cur]/[data-ce-dur],
//          [data-ce-scrub]/[data-ce-scrub-fill].
//   controls (Subtitles options only): [data-ce-tab]×3 + [data-ce-tabpanel];
//          [data-ce-reconcile], [data-ce="open-cleanup"]/[data-ce-cleanup-count],
//          [data-ce-cleanup-bar], [data-ce-transcript].

// ── Caption box renderer (port of renderer.ts) ───────────────────────

function stageScale() {
  const stage = $("[data-ce-stage]");
  return stage && stage.clientWidth ? stage.clientWidth / DESIGN_WIDTH : 0.3;
}

function applyBoxStyle() {
  const box = $("[data-ce-box]");
  if (!box) return;
  const s = state;
  const k = stageScale();
  box.style.display = s.presetId === "none" ? "none" : "flex";
  box.style.fontFamily = s.fontFamily;
  box.style.fontSize = `${s.fontSizePx * k}px`;
  box.style.fontWeight = String(s.fontWeight);
  box.style.color = s.textColor;
  box.style.textTransform = s.uppercase ? "uppercase" : "none";
  box.style.webkitTextStroke = `${s.strokeWidthPx * k * 0.35}px ${s.strokeColor}`;
  box.style.setProperty("paint-order", "stroke fill");
  box.style.textShadow = s.shadow
    ? `${s.shadowX * k}px ${s.shadowY * k}px ${Math.max(0, s.shadowBlur) * k}px ${s.shadowColor}`
    : "none";
  box.style.fontStyle = s.italic ? "italic" : "normal";
  box.style.width = `${s.widthFraction * 100}%`;
  box.style.left = `${resolveXFraction(s) * 100}%`;
  box.style.top = `${resolveYFraction(s) * 100}%`;
  box.classList.toggle("cap-ed-box--plate", !!s.plate);
  box.style.setProperty("--cap-plate", s.plateColor || "rgba(10, 12, 16, 0.82)");
  syncFrame();
}

// Overlay the selection frame on the caption box's current bounding rect (the
// box is center-anchored + content-sized, so the frame is positioned from its
// measured rect relative to the stage).
function syncFrame() {
  const frame = $("[data-ce-frame]");
  const box = $("[data-ce-box]");
  const stage = $("[data-ce-stage]");
  if (!frame || !box || !stage) return;
  if (state.presetId === "none") {
    frame.style.display = "none";
    return;
  }
  frame.style.display = "";
  const sr = stage.getBoundingClientRect();
  const br = box.getBoundingClientRect();
  frame.style.left = `${br.left - sr.left}px`;
  frame.style.top = `${br.top - sr.top}px`;
  frame.style.width = `${br.width}px`;
  frame.style.height = `${br.height}px`;
}

function nearestCueIdx(t) {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    const dist = t < c.start ? c.start - t : t - c.end;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function renderCaptionFrame(force = false) {
  const box = $("[data-ce-box]");
  if (!box) return;
  if (state.presetId === "none") {
    box.style.display = "none";
    return;
  }
  const t = currentTime;
  const liveIdx = cues.findIndex((c) => t >= c.start && t <= c.end);
  const idx = liveIdx >= 0 ? liveIdx : nearestCueIdx(t);
  box.classList.toggle("ghost", liveIdx < 0);

  if (idx !== renderedCueIdx || force) {
    renderedCueIdx = idx;
    box.innerHTML = "";
    wordSpans = [];
    const cue = idx >= 0 ? cues[idx] : null;
    if (cue) {
      const breaks = new Set((cue.lineStarts || [0]).slice(1));
      let line = null;
      cue.words.forEach((word, i) => {
        if (line === null || breaks.has(i)) {
          line = document.createElement("span");
          line.className = "cap-ed-line";
          box.appendChild(line);
        }
        const span = document.createElement("span");
        span.className = "cap-ed-word";
        span.textContent = stripCaptionPunctuation(word.text);
        line.appendChild(span);
        line.append(" ");
        wordSpans.push({ span, start: word.start, mark: word.mark });
      });
    }
  }

  // per-frame emphasis pass
  const s = state;
  const phrase = s.highlight === "phrase";
  let currentStart = -Infinity;
  if (phrase) {
    for (const w of wordSpans) if (w.start <= t && w.start > currentStart) currentStart = w.start;
  }
  for (const { span, start, mark } of wordSpans) {
    let color = "";
    if (mark === "font") color = s.manualFontColor;
    else if (phrase && start === currentStart && t >= start) color = s.highlightColor;
    span.style.color = color;
    span.style.background = mark === "h1" ? s.highlight1Color : mark === "h2" ? s.highlight2Color : "";
    span.classList.toggle("cap-ed-word-hl", mark === "h1" || mark === "h2");
  }
  // The box height tracks its content — re-sync the selection frame.
  syncFrame();
}

// ── Dead-zone guides ─────────────────────────────────────────────────

// One list for the Effects tab's buttons and the guide on the video.
const DEAD_ZONE_OPTIONS = [
  { v: "none", label: "None" },
  { v: "tiktok", label: "TikTok" },
  { v: "reels", label: "Reels" },
  { v: "shorts", label: "Shorts" },
];

function renderDeadzones() {
  const el = $("[data-ce-deadzones]");
  if (!el) return;
  if (state.deadZones === "none") {
    el.innerHTML = "";
    return;
  }
  const z = DEAD_ZONES[state.deadZones];
  // The same name the Effects tab gives the choice — never the raw id.
  const net = escapeHtml(DEAD_ZONE_OPTIONS.find((o) => o.v === state.deadZones)?.label || "");
  el.innerHTML = `
    <div class="cap-ed-dz cap-ed-dz--top" style="height:${z.top * 100}%"><span>${net}</span></div>
    <div class="cap-ed-dz cap-ed-dz--bottom" style="height:${z.bottom * 100}%"><span>${net}</span></div>
    <div class="cap-ed-dz cap-ed-dz--right" style="width:${z.right * 100}%;top:${z.top * 100}%;bottom:${z.bottom * 100}%"></div>
  `;
}

// ── Transcript ───────────────────────────────────────────────────────

function renderTranscript() {
  const hostEl = $("[data-ce-transcript]");
  if (!hostEl) return;
  const fillers = cleanupActive ? detectFillers(words) : [];
  const fillerIdx = new Map();
  fillers.forEach((f) => {
    for (let k = 0; k < f.count; k++) fillerIdx.set(f.startIdx + k, true);
  });
  const pauses = detectPauses(words, pauseThreshold);
  const pauseByIdx = new Map(pauses.map((p) => [p.idx, p]));

  let html = "";
  words.forEach((w, i) => {
    const pause = pauseByIdx.get(i);
    if (pause) {
      const removed = pausesRemoved.has(i);
      const cls = "cap-ed-pause" + (cleanupActive ? " is-proposed" : "") + (removed ? " is-removed" : "");
      html += `<button type="button" class="${cls}" data-ce-pause="${i}" aria-label="${pause.dur}s pause${removed ? ", hidden" : ""}">${pause.dur}s</button>`;
    }
    const isFiller = fillerIdx.has(i);
    const cls =
      "cap-ed-tword" +
      (w.removed ? " is-removed" : "") +
      (isFiller ? " is-filler" : "") +
      (w.mark ? " is-marked is-mark-" + w.mark : "");
    html += `<span class="${cls}" data-ce-word="${i}">${escapeHtml(w.text)}</span> `;
  });
  hostEl.innerHTML = html;
  // Emphasis reads in the colours the video shows it in.
  hostEl.style.setProperty("--ce-h1", state.highlight1Color);
  hostEl.style.setProperty("--ce-h2", state.highlight2Color);
  hostEl.style.setProperty("--ce-font", state.manualFontColor);
  updateActiveWord();
}

function updateActiveWord() {
  const hostEl = $("[data-ce-transcript]");
  if (!hostEl) return;
  let activeI = -1;
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    if (currentTime >= words[i].start && (!next || currentTime < next.start)) {
      activeI = i;
      break;
    }
  }
  hostEl.querySelectorAll(".cap-ed-tword.is-active").forEach((e) => e.classList.remove("is-active"));
  if (activeI >= 0) {
    const el = hostEl.querySelector(`[data-ce-word="${activeI}"]`);
    if (el) {
      el.classList.add("is-active");
      if (playing) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
}

// ── Right panel tabs ─────────────────────────────────────────────────

// A short choice (two or three options): the DS radio, label beside it.
function radios(name, current, opts) {
  return `<div class="cap-ed-radios" role="radiogroup" aria-label="${escapeHtml(name)}">${opts
    .map(
      (o) => `<label class="cap-ed-radio">
        <span class="ap-radio-container"><input type="radio" name="ce-${name}" value="${escapeHtml(String(o.v))}" data-ce-seg="${name}" ${o.v === current ? "checked" : ""} /></span>
        <span>${escapeHtml(o.label)}</span>
      </label>`,
    )
    .join("")}</div>`;
}

// A number: the DS input group.
function num(key, value, min, max) {
  return `<span class="ap-input-group cap-ed-num"><input type="number" data-ce-set="${key}" min="${min}" max="${max}" value="${value}" /></span>`;
}

// The subtitle settings' tabs — the DS tabs, the same in both hosts.
export function tabsHTML() {
  const tab = (id, label) =>
    `<button type="button" class="ap-tabs-tab" role="tab" aria-selected="false" data-ce-tab="${id}">${label}</button>`;
  return `<div class="ap-tabs cap-ed__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="Subtitle settings">${tab("presets", "Presets")}${tab("font", "Font")}${tab("effects", "Effects")}</div></div>`;
}

function field(label, control, hint) {
  const lbl = `<label class="cap-ed-flabel">${escapeHtml(label)}${hint ? `<span class="cap-ed-fhint">${escapeHtml(hint)}</span>` : ""}</label>`;
  return `<div class="cap-ed-field">${lbl}${control}</div>`;
}

// Group a set of fields under a quiet section header.
function group(label, body) {
  return `<div class="cap-ed-group"><div class="cap-ed-group-label">${escapeHtml(label)}</div>${body}</div>`;
}

// The DS select (CSS-UI .ap-select on a <details>), never a bare <select>.
function pick(key, current, opts) {
  const cur = opts.find((o) => o.v === current) || opts[0];
  const items = opts
    .map(
      (
        o,
      ) => `<div class="ap-select-option${o.v === current ? " selected" : ""}" role="option" aria-selected="${o.v === current}"
        data-ce-pick="${key}" data-ce-pick-val="${escapeHtml(String(o.v))}">
        <span class="ap-select-option-text">${escapeHtml(o.label)}</span>
        ${o.v === current ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`,
    )
    .join("");
  return `<details class="ap-select cap-ed-pick">
    <summary class="ap-select-trigger" aria-label="${escapeHtml(key)}">
      <span class="ap-select-value">${escapeHtml(cur.label)}</span>
      <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
    </summary>
    <div class="ap-select-dropdown" role="listbox"><div class="ap-select-options">${items}</div></div>
  </details>`;
}

// No colour picker in the DS: the native swatch, with its hex beside it.
function colorInput(key, value) {
  return `<span class="cap-ed-color"><input type="color" data-ce-color="${key}" value="${value}" aria-label="${key}" /><span class="cap-ed-color__hex">${escapeHtml(String(value).toUpperCase())}</span></span>`;
}

function renderPresetsTab() {
  const list = presetIds
    ? presetIds.map((id) => (id === "none" ? { id: "none", label: "None" } : presetById(id))).filter(Boolean)
    : PRESETS;
  const cards = list
    .map((p) => {
      const isOn = p.id === state.presetId;
      const sample =
        p.id === "none"
          ? `<span class="cap-ed-preset__none"><i class="ap-icon-eye-off"></i></span>`
          : `<span class="cap-ed-preset__sample cap-ed-preview-${p.id}">TO GET <mark>STARTED</mark></span>`;
      return `
      <label class="ap-radio-card card cap-ed-preset">
        <input type="radio" name="ce-preset" value="${p.id}" data-ce-preset-pick ${isOn ? "checked" : ""} />
        <div>
          <span class="cap-ed-preset__frame">${sample}</span>
          <span class="cap-ed-preset__label">${escapeHtml(p.label)}</span>
        </div>
      </label>`;
    })
    .join("");
  return `<div class="cap-ed-presets" role="radiogroup" aria-label="Subtitle style">${cards}</div>`;
}

function renderFontTab() {
  const s = state;
  const fams = FONT_FAMILIES.map((f) => ({ v: f, label: FONT_FAMILY_LABELS[f] || f }));
  const weights = [
    { v: 400, label: "Regular" },
    { v: 700, label: "Bold" },
    { v: 900, label: "Black" },
  ];
  const toggle = (key, label, on) =>
    `<label class="ap-toggle-container cap-ed-toggle"><input type="checkbox" data-ce-toggle="${key}" ${on ? "checked" : ""} /><i></i><span>${label}</span></label>`;

  return `
    ${group(
      "Text",
      `${field("Font", pick("fontFamily", s.fontFamily, fams))}
       ${field("Size", num("fontSizePx", s.fontSizePx, 24, 160))}
       ${field("Weight", pick("fontWeight", s.fontWeight, weights))}
       ${field("Text color", colorInput("textColor", s.textColor))}
       ${field("Uppercase", toggle("uppercase", "", s.uppercase))}`,
    )}
    ${group(
      "Outline and shadow",
      `${field("Outline color", colorInput("strokeColor", s.strokeColor))}
       ${field("Outline width", num("strokeWidthPx", s.strokeWidthPx, 0, 24))}
       ${field("Shadow", toggle("shadow", "", s.shadow))}
       ${
         s.shadow
           ? `<div class="cap-ed-subfields">
               ${field("Color", colorInput("shadowColor", s.shadowColor))}
               ${field("Offset X", num("shadowX", s.shadowX, -20, 20))}
               ${field("Offset Y", num("shadowY", s.shadowY, -20, 20))}
               ${field("Blur", num("shadowBlur", s.shadowBlur, 0, 40))}
             </div>`
           : ""
       }`,
    )}
    ${group(
      "Emphasis",
      `${field("Word being said", colorInput("highlightColor", s.highlightColor))}
       ${field("Highlight", colorInput("highlight1Color", s.highlight1Color))}
       ${field("Second highlight", colorInput("highlight2Color", s.highlight2Color))}
       ${field("Colored word", colorInput("manualFontColor", s.manualFontColor))}`,
    )}
  `;
}

function renderEffectsTab() {
  const s = state;
  return `
    ${group(
      "Layout",
      `${field(
        "Position",
        pick("position", s.position, [
          { v: "auto", label: "Auto" },
          { v: "top", label: "Top" },
          { v: "middle", label: "Middle" },
          { v: "bottom", label: "Bottom" },
          ...(s.position === "custom" ? [{ v: "custom", label: "Where I placed it" }] : []),
        ]),
      )}
       ${field(
         "Max lines",
         radios("maxLines", s.maxLines, [
           { v: 1, label: "1" },
           { v: 2, label: "2" },
           { v: 3, label: "3" },
         ]),
       )}
       ${field("Max words", num("wordsPerCue", s.wordsPerCue, 0, 12), "0 = no limit")}`,
    )}
    ${
      clock
        ? ""
        : group(
            "Safe area",
            field(
              "Dead zones",
              pick("deadZones", s.deadZones, DEAD_ZONE_OPTIONS),
              "Shows where the app's buttons cover the video",
            ),
          )
    }
  `;
}

// Speech-cleanup lives in the LEFT panel, merged with the transcript: this
// compact bar (shown under the "Speech cleanup" button) summarises what was
// found and offers bulk Remove all / Restore all. Individual removal happens
// right in the transcript — click a highlighted filler word or a pause chip.
function renderCleanupBar() {
  renderCleanupList();
  const bar = $("[data-ce-cleanup-bar]");
  if (!bar) return;
  bar.hidden = !cleanupActive;
  const btn = $('[data-ce="open-cleanup"]');
  if (btn) {
    // The DS stroked button: blue while the cleanup is on, grey otherwise.
    btn.setAttribute("aria-pressed", String(cleanupActive));
    btn.classList.toggle("blue", cleanupActive);
    btn.classList.toggle("grey", !cleanupActive);
  }
  if (!cleanupActive) {
    bar.innerHTML = "";
    return;
  }
  const fillers = detectFillers(words);
  const pauses = detectPauses(words);
  if (!fillers.length && !pauses.length) {
    bar.innerHTML = `<span class="cap-ed-cleanup-bar__count">Nothing to clean up</span>
      <button type="button" class="ap-button ghost grey" data-ce-cleanup-done>Done</button>`;
    return;
  }
  const anyPending = fillers.some((f) => !words[f.startIdx].removed) || pauses.some((p) => !pausesRemoved.has(p.idx));
  bar.innerHTML = `
    <span class="cap-ed-cleanup-bar__count">${fillers.length} filler${fillers.length === 1 ? "" : "s"} · ${pauses.length} pause${pauses.length === 1 ? "" : "s"} — click to remove</span>
    <span class="cap-ed-cleanup-bar__actions">
      <button type="button" class="ap-button ghost grey" data-ce-cleanup-all="${anyPending ? "remove" : "restore"}">${anyPending ? "Hide all" : "Show all"}</button>
      <button type="button" class="ap-button ghost grey" data-ce-cleanup-done>Done</button>
    </span>`;
}

// The cleanup, at the head of the transcript (Clips space): what's marked,
// one action for all of it, the pause threshold. Each filler or pause is
// hidden or shown by clicking it in the transcript. The slider is built once,
// so repainting the summary never cuts a drag.
function renderCleanupList() {
  const host = $("[data-ce-cleanup-list]");
  if (!host) return;
  const fillers = detectFillers(words);
  const pauses = detectPauses(words, pauseThreshold);
  if (!host.querySelector("[data-ce-pause-threshold]")) {
    host.innerHTML = `
      <div class="cap-ed-clean-head">
        <span class="cap-ed-clean-sum" data-ce-clean-sum></span>
        <button type="button" class="ap-button ghost grey" data-ce-cleanup-all="remove" data-ce-clean-all></button>
      </div>
      <label class="cap-ed-clean-threshold">
        <span data-ce-clean-th></span>
        <input type="range" class="ap-slider" min="0.2" max="1.5" step="0.1" value="${pauseThreshold}" data-ce-pause-threshold aria-label="Pause threshold" />
      </label>
      <p class="cap-ed-clean-note">Hidden words and pauses leave the subtitles only — the audio isn't cut.</p>`;
  }
  const hidden =
    fillers.filter((f) => words[f.startIdx].removed).length + pauses.filter((p) => pausesRemoved.has(p.idx)).length;
  const total = fillers.length + pauses.length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  host.querySelector("[data-ce-clean-sum]").textContent = total
    ? `${plural(fillers.length, "filler word")} · ${plural(pauses.length, "pause")}${hidden ? ` · ${hidden} hidden` : ""}`
    : "No filler words or long pauses";
  const all = host.querySelector("[data-ce-clean-all]");
  all.hidden = !total;
  all.dataset.ceCleanupAll = hidden < total ? "remove" : "restore";
  all.innerHTML = `<i class="${hidden < total ? "ap-icon-eye-off" : "ap-icon-eye-on"}" aria-hidden="true"></i><span>${hidden < total ? "Hide all" : "Show all"}</span>`;
  host.querySelector("[data-ce-clean-th]").textContent = `Pauses over ${pauseThreshold.toFixed(1)}s`;
  const range = host.querySelector("[data-ce-pause-threshold]");
  range.style.setProperty("--fill", `${((pauseThreshold - 0.2) / 1.3) * 100}%`);
}

function renderTabPanel() {
  const panel = $("[data-ce-tabpanel]");
  if (!panel) return;
  root.querySelectorAll("[data-ce-tab]").forEach((b) => {
    const on = b.dataset.ceTab === activeTab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  if (activeTab === "presets") panel.innerHTML = renderPresetsTab();
  else if (activeTab === "font") panel.innerHTML = renderFontTab();
  else panel.innerHTML = renderEffectsTab();
}

// ── Recompute + repaint ──────────────────────────────────────────────

function recomputeCues() {
  cues = deriveCues(words, state);
  renderedCueIdx = -1;
  updateReconcile();
}

function updateReconcile() {
  const el = $("[data-ce-reconcile]");
  if (el) {
    const removed = words.filter((w) => w.removed).length + pausesRemoved.size;
    el.textContent = `${cues.length} subtitle line${cues.length === 1 ? "" : "s"} · ${words.length} words${removed ? ` · ${removed} cleaned` : ""}`;
  }
  const cc = $("[data-ce-cleanup-count]");
  if (cc) {
    const n = detectFillers(words).length + detectPauses(words).length;
    cc.textContent = n ? String(n) : "";
    cc.hidden = !n;
  }
}

function repaintAll() {
  applyBoxStyle();
  renderDeadzones();
  renderCaptionFrame(true);
}

// ── Playback ─────────────────────────────────────────────────────────

function setPlaying(on) {
  playing = on;
  const glyph = $("[data-ce-playglyph]");
  if (glyph)
    glyph.innerHTML = on
      ? `<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>`
      : `<path d="M8 5v14l11-7z" fill="currentColor"/>`;
  const big = $("[data-ce-playicon]");
  if (big) big.classList.toggle("is-hidden", on);
  // Drive the real footage too (muted) — it loops independently behind the
  // captions; the synthetic playhead stays the source of truth for caption sync.
  if (clock) return; // the host owns the footage and the clock
  const video = $("[data-ce-video]");
  if (video) {
    if (on) video.play().catch(() => {});
    else video.pause();
  }
  if (on) {
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  } else if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function tick() {
  if (!playing) return;
  // The video drives the playhead — read its real currentTime each frame.
  const video = $("[data-ce-video]");
  if (video && isFinite(video.duration)) currentTime = video.currentTime;
  else currentTime = Math.min(duration, currentTime + 1 / 60); // fallback pre-metadata
  syncTime();
  rafId = requestAnimationFrame(tick);
}

function seek(t) {
  currentTime = Math.max(0, Math.min(duration, t));
  if (clock) {
    clock.seek(currentTime);
    syncTime();
    return;
  }
  // Drive the real video (duration is now the video's, so 1:1).
  const video = $("[data-ce-video]");
  if (video && isFinite(video.duration)) {
    video.currentTime = Math.max(0, Math.min(video.duration - 0.03, currentTime));
  }
  syncTime();
}

// Re-time the synthetic transcript onto the real video's duration so caption
// timings track the actual footage. Runs once when video metadata loads.
function retimeToVideo(vDur) {
  if (!vDur || !isFinite(vDur) || vDur <= 0) return;
  const old = duration || vDur;
  if (Math.abs(old - vDur) < 0.01) return;
  const scale = vDur / old;
  words.forEach((w) => {
    w.start = +(w.start * scale).toFixed(2);
    w.end = +(w.end * scale).toFixed(2);
  });
  duration = vDur;
  recomputeCues();
  const dur = $("[data-ce-dur]");
  if (dur) dur.textContent = fmt(duration);
  renderTranscript();
  if (currentTime > duration) currentTime = 0;
  syncTime();
  emitChange();
}

function syncTime() {
  const cur = $("[data-ce-cur]");
  if (cur) cur.textContent = fmt(currentTime);
  const frac = duration ? currentTime / duration : 0;
  const fill = $("[data-ce-scrub-fill]");
  if (fill) fill.style.width = `${frac * 100}%`;
  // Keep the timeline's playhead in lock-step with the transport scrub — both
  // visualize the same playback position.
  const ph = $("[data-vc-protrim-playhead]");
  if (ph) ph.style.left = `${frac * 100}%`;
  renderCaptionFrame();
  updateActiveWord();
}

// ── Events ───────────────────────────────────────────────────────────

function closeMenu() {
  if (menuEl) {
    menuEl.removeEventListener("click", onMenuClick);
    menuEl.remove();
    menuEl = null;
    document.removeEventListener("pointerdown", onDocPointer, true);
  }
}

function onDocPointer(e) {
  if (menuEl && !menuEl.contains(e.target) && !e.target.closest("[data-ce-word]")) closeMenu();
}

// The word menu lives in document.body (so position:fixed is viewport-anchored
// — the modal's own transform would otherwise become the containing block), so
// it gets its own click handler rather than bubbling to the root delegate.
function onMenuClick(e) {
  const markBtn = e.target.closest("[data-ce-mark]");
  if (markBtn && menuEl) {
    const i = Number(menuEl.dataset.ceWordIdx);
    words[i].mark = markBtn.dataset.ceMark || null;
    closeMenu();
    renderTranscript();
    renderCaptionFrame(true);
    emitChange();
    return;
  }
  const fix = e.target.closest("[data-ce-word-fix]");
  if (fix) {
    const i = Number(fix.dataset.ceWordFix);
    closeMenu();
    const span = $(`[data-ce-word="${i}"]`);
    if (span) startWordEdit(i, span);
    return;
  }
  const wordRemove = e.target.closest("[data-ce-word-remove]");
  if (wordRemove) {
    const i = Number(wordRemove.dataset.ceWordRemove);
    words[i].removed = !words[i].removed;
    closeMenu();
    renderTranscript();
    recomputeCues();
    renderCaptionFrame(true);
    renderCleanupBar();
    emitChange();
  }
}

// One item of the word menu, the DS action-dropdown item.
function item(attrs, lead, label, checked = false) {
  return `<button type="button" role="menuitem" class="ap-action-dropdown-item" ${attrs}>
    ${lead}
    <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container">
      <span class="ap-action-dropdown-item-label">${escapeHtml(label)}</span>
    </div></div>
    ${checked ? '<i class="ap-icon-check cap-ed-menu__check"></i>' : ""}
  </button>`;
}

function openWordMenu(wordIdx, anchorEl) {
  closeMenu();
  const w = words[wordIdx];
  const dots = [
    { mark: "font", color: state.manualFontColor, label: "Colored word" },
    { mark: "h1", color: state.highlight1Color, label: "Highlight" },
    { mark: "h2", color: state.highlight2Color, label: "Second highlight" },
  ]
    .map((d) =>
      item(
        `data-ce-mark="${d.mark}"`,
        `<span class="cap-ed-menu__dot" style="background:${d.color}"></span>`,
        d.label,
        w.mark === d.mark,
      ),
    )
    .join("");
  menuEl = document.createElement("div");
  menuEl.className = "ap-action-dropdown cap-ed-menu";
  menuEl.setAttribute("role", "menu");
  menuEl.innerHTML = `
    ${dots}
    ${item('data-ce-mark=""', "", "Clear emphasis")}
    <div class="ap-action-dropdown-divider"></div>
    ${item(`data-ce-word-remove="${wordIdx}"`, `<i class="${w.removed ? "ap-icon-eye-on" : "ap-icon-eye-off"}"></i>`, w.removed ? "Show in subtitles" : "Hide from subtitles")}
    ${item(`data-ce-word-fix="${wordIdx}"`, `<i class="ap-icon-pen"></i>`, "Fix the word")}`;
  // Append to document.body — position:fixed must resolve against the viewport,
  // and the modal's transform would otherwise capture it as the containing block.
  menuEl.dataset.ceWordIdx = String(wordIdx);
  menuEl.addEventListener("click", onMenuClick);
  document.body.appendChild(menuEl);
  const r = anchorEl.getBoundingClientRect();
  const mw = 188;
  const mh = menuEl.offsetHeight || 200;
  // Flip above the word if there isn't room below.
  const top = r.bottom + 6 + mh > window.innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6;
  menuEl.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - mw - 8))}px`;
  menuEl.style.top = `${top}px`;
  document.addEventListener("pointerdown", onDocPointer, true);
}

// Fixing a word: a small field in place of the word. Enter saves it; Escape
// or leaving the field puts the word back — an inline edit never saves on
// blur (house rule).
function startWordEdit(wordIdx, span) {
  const input = document.createElement("input");
  input.className = "cap-ed-word-input";
  input.value = words[wordIdx].text;
  input.size = Math.max(3, words[wordIdx].text.length + 1);
  input.setAttribute("aria-label", "Fix the word");
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    if (save && text && text !== words[wordIdx].text) {
      words[wordIdx].text = text;
      recomputeCues();
      renderCaptionFrame(true);
      emitChange();
    }
    renderTranscript();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(false));
}

function onRootClick(e) {
  const t = e.target;

  if (t.closest('[data-ce="playpause"]')) return clock ? clock.toggle() : setPlaying(!playing);
  if (t.closest('[data-ce="back"]')) return seek(currentTime - 5);
  if (t.closest('[data-ce="fwd"]')) return seek(currentTime + 5);

  const picked = t.closest("[data-ce-pick]");
  if (picked) {
    picked.closest("details")?.removeAttribute("open");
    const key = picked.dataset.cePick;
    state[key] = key === "fontWeight" ? Number(picked.dataset.cePickVal) : picked.dataset.cePickVal;
    renderTabPanel();
    recomputeCues();
    repaintAll();
    emitChange();
    return undefined;
  }

  // Click the preview (anywhere but the caption box / frame) toggles playback.
  if (
    t.closest("[data-ce-stage]") &&
    !t.closest("[data-ce-box]") &&
    !t.closest("[data-ce-frame]") &&
    !t.closest("[data-ce-no-toggle]")
  ) {
    return clock ? clock.toggle() : setPlaying(!playing);
  }

  const tabBtn = t.closest("[data-ce-tab]");
  if (tabBtn) {
    activeTab = tabBtn.dataset.ceTab;
    renderTabPanel();
    return;
  }

  // Speech cleanup toggles a mode in the LEFT panel: decorate fillers/pauses
  // in the transcript and show the cleanup bar.
  if (t.closest('[data-ce="open-cleanup"]')) {
    cleanupActive = !cleanupActive;
    renderTranscript();
    renderCleanupBar();
    return;
  }

  const cleanAll = t.closest("[data-ce-cleanup-all]");
  if (cleanAll) {
    const removed = cleanAll.dataset.ceCleanupAll === "remove";
    detectFillers(words).forEach((f) => {
      for (let k = 0; k < f.count; k++) if (words[f.startIdx + k]) words[f.startIdx + k].removed = removed;
    });
    pausesRemoved = new Set(removed ? detectPauses(words, pauseThreshold).map((p) => p.idx) : []);
    renderTranscript();
    recomputeCues();
    renderCaptionFrame(true);
    renderCleanupBar();
    emitChange();
    return;
  }
  if (t.closest("[data-ce-cleanup-done]")) {
    cleanupActive = false;
    renderTranscript();
    renderCleanupBar();
    return;
  }

  const fillerToggle = t.closest("[data-ce-filler-toggle]");
  if (fillerToggle) {
    const i = Number(fillerToggle.dataset.ceFillerToggle);
    const f = detectFillers(words).find((x) => x.startIdx === i);
    if (f) {
      const target = !words[f.startIdx].removed;
      for (let k = 0; k < f.count; k++) if (words[f.startIdx + k]) words[f.startIdx + k].removed = target;
      renderTranscript();
      recomputeCues();
      renderCaptionFrame(true);
      renderCleanupBar();
      renderCleanupList();
      emitChange();
    }
    return;
  }

  const wordEl = t.closest("[data-ce-word]");
  if (wordEl) {
    const i = Number(wordEl.dataset.ceWord);
    seek(words[i].start + 0.01);
    // In cleanup mode, clicking a highlighted filler removes/restores it
    // inline (no emphasis menu).
    if (cleanupActive) {
      const f = detectFillers(words).find((x) => i >= x.startIdx && i < x.startIdx + x.count);
      if (f) {
        const target = !words[f.startIdx].removed;
        for (let k = 0; k < f.count; k++) if (words[f.startIdx + k]) words[f.startIdx + k].removed = target;
        renderTranscript();
        recomputeCues();
        renderCaptionFrame(true);
        renderCleanupBar();
        emitChange();
        return;
      }
    }
    // Any other word (or any word outside the cleanup): its menu.
    openWordMenu(i, wordEl);
    return;
  }

  const pauseEl = t.closest("[data-ce-pause]");
  if (pauseEl) {
    const i = Number(pauseEl.dataset.cePause);
    if (pausesRemoved.has(i)) pausesRemoved.delete(i);
    else pausesRemoved.add(i);
    renderTranscript();
    renderCleanupBar();
    updateReconcile();
    emitChange();
    return;
  }

  const scrub = t.closest("[data-ce-scrub]");
  if (scrub) {
    const r = scrub.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * duration);
    return;
  }
}

function onRootDblClick(e) {
  const wordEl = e.target.closest("[data-ce-word]");
  if (wordEl) {
    closeMenu();
    startWordEdit(Number(wordEl.dataset.ceWord), wordEl);
  }
}

function onRootInput(e) {
  const hex = e.target.closest?.(".cap-ed-color")?.querySelector(".cap-ed-color__hex");
  if (hex) hex.textContent = e.target.value.toUpperCase();
  if (e.target.matches?.("[data-ce-pause-threshold]")) {
    pauseThreshold = Number(e.target.value);
    // Pauses still long enough stay hidden; the rest are no longer pauses.
    const still = new Set(detectPauses(words, pauseThreshold).map((p) => p.idx));
    pausesRemoved = new Set([...pausesRemoved].filter((i) => still.has(i)));
    renderTranscript();
    renderCleanupList();
    updateReconcile();
    return;
  }
  const numSel = e.target.closest("[data-ce-set]");
  if (numSel) {
    const key = numSel.dataset.ceSet;
    let v = numSel.value;
    if (numSel.type === "number") {
      v = Number(v);
      if (key === "widthFraction") v = Math.max(0.3, Math.min(0.98, v / 100));
    }
    if (key === "fontWeight") v = Number(v);
    state[key] = v;
    if (
      key === "fontSizePx" ||
      key === "wordsPerCue" ||
      key === "widthFraction" ||
      key === "fontFamily" ||
      key === "fontWeight"
    )
      recomputeCues();
    repaintAll();
    emitChange();
    return;
  }
  const color = e.target.closest("[data-ce-color]");
  if (color) {
    state[color.dataset.ceColor] = color.value;
    repaintAll();
    emitChange();
    return;
  }
}

function onRootChange(e) {
  // The DS radios: a preset card, or a short choice (max lines).
  if (e.target.matches?.("[data-ce-preset-pick]")) return applyPreset(e.target.value);
  if (e.target.matches?.("[data-ce-seg]")) {
    const key = e.target.dataset.ceSeg;
    state[key] = key === "maxLines" ? Number(e.target.value) : e.target.value;
    renderTabPanel();
    recomputeCues();
    repaintAll();
    emitChange();
    return undefined;
  }
  const toggle = e.target.closest("[data-ce-toggle]");
  if (toggle) {
    state[toggle.dataset.ceToggle] = toggle.checked;
    renderTabPanel();
    recomputeCues();
    repaintAll();
    emitChange();
  }
}

// ── Caption-box drag (free positioning) ─────────────────────────────
// Dragging the caption box flips position to "custom" and tracks the pointer
// as a fraction of the stage, so the box can sit anywhere on the frame.

// Handle → which dimensions it drives: wx (width: +east/-west/0) and
// fy (font/height: +down/-up/0).
const RESIZE_DIRS = {
  e: { wx: 1, fy: 0 },
  w: { wx: -1, fy: 0 },
  s: { wx: 0, fy: 1 },
  n: { wx: 0, fy: -1 },
  se: { wx: 1, fy: 1 },
  sw: { wx: -1, fy: 1 },
  ne: { wx: 1, fy: -1 },
  nw: { wx: -1, fy: -1 },
};

function onBoxPointerDown(e) {
  // Resize handle takes priority over dragging the box.
  const handle = e.target.closest("[data-ce-resize]");
  const stage = $("[data-ce-stage]");
  if (handle && stage && state.presetId !== "none") {
    e.preventDefault();
    e.stopPropagation();
    const rect = stage.getBoundingClientRect();
    resizeDrag = {
      dir: RESIZE_DIRS[handle.dataset.ceResize] || { wx: 0, fy: 0 },
      startX: e.clientX,
      startY: e.clientY,
      anchorW: state.widthFraction,
      anchorFont: state.fontSizePx,
      w: rect.width || 1,
      scale: (rect.width || 1) / DESIGN_WIDTH,
    };
    $("[data-ce-frame]")?.classList.add("is-active");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeUp);
    window.addEventListener("pointercancel", onResizeUp);
    return;
  }

  const box = e.target.closest("[data-ce-box]");
  if (!box || !stage || state.presetId === "none") return;
  e.preventDefault();
  const rect = stage.getBoundingClientRect();
  boxDrag = {
    startX: e.clientX,
    startY: e.clientY,
    anchorX: resolveXFraction(state),
    anchorY: resolveYFraction(state),
    w: rect.width || 1,
    h: rect.height || 1,
  };
  box.classList.add("is-dragging");
  window.addEventListener("pointermove", onBoxPointerMove);
  window.addEventListener("pointerup", onBoxPointerUp);
  window.addEventListener("pointercancel", onBoxPointerUp);
}

function onBoxPointerMove(e) {
  if (!boxDrag) return;
  const dx = (e.clientX - boxDrag.startX) / boxDrag.w;
  const dy = (e.clientY - boxDrag.startY) / boxDrag.h;
  state.position = "custom";
  state.xFraction = Math.max(0.08, Math.min(0.92, boxDrag.anchorX + dx));
  state.yFraction = Math.max(0.06, Math.min(0.94, boxDrag.anchorY + dy));
  applyBoxStyle();
}

function onBoxPointerUp() {
  if (!boxDrag) return;
  boxDrag = null;
  $("[data-ce-box]")?.classList.remove("is-dragging");
  window.removeEventListener("pointermove", onBoxPointerMove);
  window.removeEventListener("pointerup", onBoxPointerUp);
  window.removeEventListener("pointercancel", onBoxPointerUp);
  // Reflect the now-custom position in the Effects tab + persist.
  if (activeTab === "effects") renderTabPanel();
  emitChange();
}

// Resize: side handles change width, top/bottom change size (height via font),
// corners change both.
function onResizeMove(e) {
  if (!resizeDrag) return;
  const { dir, startX, startY, anchorW, anchorFont, w, scale } = resizeDrag;
  if (dir.wx) {
    const dxFrac = (e.clientX - startX) / w;
    state.widthFraction = Math.max(0.3, Math.min(0.98, anchorW + dir.wx * 2 * dxFrac));
  }
  if (dir.fy) {
    const dyDesign = (e.clientY - startY) / scale;
    state.fontSizePx = Math.max(24, Math.min(160, Math.round(anchorFont + dir.fy * dyDesign * 0.7)));
  }
  recomputeCues();
  applyBoxStyle();
  renderCaptionFrame(true);
}

function onResizeUp() {
  if (!resizeDrag) return;
  resizeDrag = null;
  $("[data-ce-frame]")?.classList.remove("is-active");
  window.removeEventListener("pointermove", onResizeMove);
  window.removeEventListener("pointerup", onResizeUp);
  window.removeEventListener("pointercancel", onResizeUp);
  emitChange();
}

function onKeydown(e) {
  if (!mounted) return;
  if (e.key === "Escape" && menuEl) {
    closeMenu();
    return;
  }
  const inField = e.target.closest("[contenteditable=true], input, select, textarea");
  if (inField || clock) return;
  if (e.key === " ") {
    e.preventDefault();
    setPlaying(!playing);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    seek(currentTime - 5);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    seek(currentTime + 5);
  }
}

function applyPreset(id) {
  const p = presetById(id);
  if (!p && id !== "none") return;
  if (p) Object.assign(state, p.apply);
  state.presetId = id;
  renderTabPanel();
  recomputeCues();
  repaintAll();
  emitChange();
}

// ── Lifecycle ────────────────────────────────────────────────────────

// Re-render the left-panel controls into their hooks. The modal calls this
// after it (re)inserts the Subtitles options panel, since those hooks only
// exist while the Subtitles tab is active.
export function refreshControls() {
  if (!mounted) return;
  renderTranscript();
  renderTabPanel();
  renderCleanupBar();
  updateReconcile();
}

// Repaint everything that is sized off the stage. The caption box scales with
// the stage width (stageScale → DESIGN_WIDTH), so changing the crop ratio
// resizes the stage and the box has to be re-laid-out at the new scale.
export function repaintStage() {
  if (!mounted) return;
  repaintAll();
}

// External playback sync — the modal's timeline playhead/track drives these so
// the two scrubbers stay in lock-step. frac is 0..1 of the clip.
export function seekFraction(frac) {
  if (!mounted) return;
  seek(Math.max(0, Math.min(1, frac)) * duration);
}

export function getFraction() {
  return duration ? currentTime / duration : 0;
}

export function mount(hostEl, c, src, opts = {}) {
  if (!hostEl) return;
  if (mounted) unmount();
  host = hostEl;
  clip = c;
  source = src;
  onChangeCb = typeof opts.onChange === "function" ? opts.onChange : null;
  clock = opts.clock || null;
  presetIds = Array.isArray(opts.presetIds) ? opts.presetIds : null;
  const cleanupAlways = !!opts.cleanup; // the host marks fillers and pauses at all times

  duration = Math.max(6, (c.end || 0) - (c.start || 0));
  currentTime = 0;
  playing = false;
  cleanupActive = cleanupAlways;
  pausesRemoved = new Set();
  activeTab = "presets";
  renderedCueIdx = -1;

  state = c.captionState ? { ...defaultCaptionState(), ...c.captionState } : defaultCaptionState();
  words = Array.isArray(c.transcript) && c.transcript.length ? c.transcript.map((w) => ({ ...w })) : buildTranscript(c);

  // The modal provides the full editor shell with all data-ce-* hooks — we
  // render into it rather than injecting our own layout.
  root = host;
  mounted = true;

  root.addEventListener("click", onRootClick);
  root.addEventListener("dblclick", onRootDblClick);
  root.addEventListener("input", onRootInput);
  root.addEventListener("change", onRootChange);
  root.addEventListener("pointerdown", onBoxPointerDown);
  document.addEventListener("keydown", onKeydown);

  const stage = $("[data-ce-stage]");
  if (stage) stage.style.backgroundImage = previewBg(c.hue);
  const video = clock ? null : $("[data-ce-video]");
  if (video) {
    video.src = videoForClip(c);
    // The real video is the time source: once its duration is known, re-time
    // the transcript onto it so captions track the actual footage.
    const onMeta = () => retimeToVideo(video.duration);
    video.addEventListener("loadedmetadata", onMeta);
    if (video.readyState >= 1) onMeta();
  }
  const dur = $("[data-ce-dur]");
  if (dur) dur.textContent = fmt(duration);

  recomputeCues();
  renderTranscript();
  renderTabPanel();
  renderCleanupList();
  requestAnimationFrame(() => {
    if (!mounted) return;
    repaintAll();
    syncTime();
  });
}

export function unmount() {
  if (!mounted) return;
  setPlaying(false);
  closeMenu();
  onBoxPointerUp();
  onResizeUp();
  document.removeEventListener("keydown", onKeydown);
  if (root) {
    root.removeEventListener("click", onRootClick);
    root.removeEventListener("dblclick", onRootDblClick);
    root.removeEventListener("input", onRootInput);
    root.removeEventListener("change", onRootChange);
    root.removeEventListener("pointerdown", onBoxPointerDown);
  }
  // The modal owns the shell DOM (it tears it down on close); just clear the
  // dynamic caption box so a stale frame can't linger if the shell is reused.
  const box = root && root.querySelector("[data-ce-box]");
  if (box) box.innerHTML = "";
  mounted = false;
  root = null;
  host = null;
  clip = null;
  source = null;
  onChangeCb = null;
  clock = null;
  presetIds = null;
}

// Host clock (Clips space): the playhead the host's footage is at, in clip
// seconds. Moves the caption, the active transcript word and the scrub.
export function setTime(sec, isPlaying = false) {
  if (!mounted) return;
  currentTime = Math.max(0, Math.min(duration, sec));
  playing = isPlaying;
  syncTime();
}

// The Clips space reads the style to say where it comes from…
export function getState() {
  return mounted ? { ...state } : null;
}

// …and puts the video's style back on the clip (the words stay as they are).
export function resetStyle(captionState) {
  if (!mounted) return;
  state = { ...defaultCaptionState(), ...captionState, deadZones: state.deadZones };
  renderTabPanel();
  renderTranscript();
  recomputeCues();
  repaintAll();
  emitChange();
}

// The safe-area guide, set from the host's Output monitor: a guide to look
// at, not a property of the clip, so it isn't a change.
export function setDeadZones(v) {
  if (!mounted) return;
  state.deadZones = v;
  renderDeadzones();
}

// What's hidden from the subtitles, in clip seconds — the host marks it on its
// timeline.
export function getHiddenSpans() {
  if (!mounted) return [];
  const hiddenWords = words
    .filter((w) => w.removed)
    .map((w) => ({ start: w.start, end: w.end, label: `“${w.text}” hidden` }));
  const hiddenPauses = detectPauses(words, pauseThreshold)
    .filter((p) => pausesRemoved.has(p.idx))
    .map((p) => ({ start: p.start, end: p.end, label: `${p.dur}s pause hidden` }));
  return [...hiddenWords, ...hiddenPauses];
}

// The clip was trimmed: re-time the transcript onto the new length.
export function setDuration(sec) {
  if (!mounted || !clock) return;
  const old = duration;
  duration = Math.max(1, sec);
  if (Math.abs(old - duration) < 0.01) return;
  const k = duration / old;
  words.forEach((w) => {
    w.start = +(w.start * k).toFixed(2);
    w.end = +(w.end * k).toFixed(2);
  });
  recomputeCues();
  renderTranscript();
  renderCleanupBar();
  syncTime();
  emitChange();
}
