// Clips space (flag clipsSpace) — what the library, the project page and the
// editor share: time formatting, the video-wide options (format, subtitles),
// and the live reframed previews.

import { FORMATS, ratioNetworksMeta } from "../../clip-formats.js?v=2345";
import { PROD_PRESET_IDS, presetById, captionStateFor } from "../../clip-captions.js?v=2345";
import { framingContext, initialSegments, resolve, segmentAt, drawOutput } from "../../clip-framing.js?v=2345";
import { escapeHtml } from "../../utils.js?v=2345";

// m:ss for a duration or a playhead, from ms.
export function fmtMs(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// A precise playhead: m:ss.d
export function fmtPrecise(ms) {
  const t = Math.max(0, ms || 0) / 1000;
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
}

// The five ratios prod renders (set_clip_options), in the order creators read them.
export const RATIO_IDS = ["9:16", "1:1", "4:5", "16:9", "4:3"];
export const ratioOf = (id) => (FORMATS[id] || FORMATS["9:16"]).ratio;
export const formatLabel = (id) => `${FORMATS[id]?.label || "Vertical"} ${id}`;
export const bestFor = (id) => (FORMATS[id] ? ratioNetworksMeta(FORMATS[id]) : "");

export const SUBTITLE_IDS = PROD_PRESET_IDS;

// The editor's rail: one tool each, in its order. The project page lists them
// too, so a clip says what can be changed on it before the editor opens.
export const EDITOR_TOOLS = [
  { id: "reframe", label: "Reframe", icon: "ap-icon-cropper", hint: "Who's in the frame, part by part" },
  { id: "transcript", label: "Transcript", icon: "ap-icon-file--text", hint: "Fix a word, hide fillers and pauses" },
  { id: "subtitles", label: "Subtitles", icon: "ap-icon-closed-captions", hint: "Their style, font and effects" },
  { id: "text", label: "Text", icon: "ap-icon-alt-text", hint: "Titles and text on the video" },
  { id: "brand", label: "Brand", icon: "ap-icon-target", hint: "Your logo, an intro and an outro" },
];
export const presetLabel = (id) => (id === "none" ? "No subtitles" : presetById(id)?.label || id);

export function clipRatioId(video, clip) {
  return clip.ratio || video.settings.ratio || "9:16";
}

export function clipCaptionState(video, clip) {
  return clip.captionState || captionStateFor(video.settings.subtitlePreset);
}

export function clipSegments(video, clip) {
  return clip.segments || initialSegments(framingContext(video), clip.startMs, clip.endMs);
}

// The CTA placement — prod's ctaPreference.
export const CTA_OPTIONS = [
  { id: "none", label: "No call to action", hint: "The post ends on the clip's message." },
  { id: "in_post", label: "In the post", hint: "I end the caption with the Playbook's call to action." },
  {
    id: "first_comment",
    label: "In the first comment",
    hint: "The link goes right under the post, where it doesn't cost reach.",
  },
];

// A DS select (.ap-select on <details>) — the house dropdown, never a bare
// <select>. `attr` names the data attribute each option carries.
export function dsSelect({ label, valueHtml, options, attr, current, ariaLabel, extraClass = "" }) {
  const items = options
    .map((o) => {
      const on = o.id === current;
      return `<div class="ap-select-option${on ? " selected" : ""}" role="option" aria-selected="${on}" ${attr}="${escapeHtml(o.id)}">
        ${o.lead || ""}<span class="ap-select-option-text">${escapeHtml(o.label)}</span>${o.meta || ""}
        ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`;
    })
    .join("");
  return `<details class="ap-select ${extraClass}">
    <summary class="ap-select-trigger" aria-label="${escapeHtml(ariaLabel || label)}">
      <span class="ap-select-inline-label">${escapeHtml(label)}</span>
      <span class="ap-select-value">${valueHtml}</span>
      <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
    </summary>
    <div class="ap-select-dropdown" role="listbox" aria-label="${escapeHtml(ariaLabel || label)}">
      <div class="ap-select-options">${items}</div>
    </div>
  </details>`;
}

// <details> opens natively; closing on an outside click or Escape is each
// surface's job (schedule-modal and the image studio do the same).
export function bindSelectDismiss(root) {
  const close = (except) =>
    root.querySelectorAll("details.ap-select[open]").forEach((d) => d !== except && d.removeAttribute("open"));
  const onDown = (e) => close(e.target.closest?.("details.ap-select"));
  const onKey = (e) => e.key === "Escape" && close(null);
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("pointerdown", onDown);
    document.removeEventListener("keydown", onKey);
  };
}

export function formatSelect(current, attr = "data-clips-ratio") {
  return dsSelect({
    label: "Format",
    valueHtml: escapeHtml(formatLabel(current)),
    current,
    attr,
    options: RATIO_IDS.map((id) => ({ id, label: formatLabel(id), meta: bestFor(id) })),
  });
}

export function subtitleSelect(current, attr = "data-clips-preset") {
  return dsSelect({
    label: "Subtitles",
    valueHtml: escapeHtml(presetLabel(current)),
    current,
    attr,
    options: SUBTITLE_IDS.map((id) => ({
      id,
      label: presetLabel(id),
      lead:
        id === "none"
          ? `<span class="clips-preset-swatch"><i class="ap-icon-close" aria-hidden="true"></i></span>`
          : `<span class="clips-preset-swatch"><span class="cap-ed-preview-${id}">Aa</span></span>`,
    })),
  });
}

// ── Live reframed previews ───────────────────────────────────────────
// Every [data-clip-preview="<clipId>"] canvas shows its clip AS IT WILL RENDER:
// the reframed output at the clip's format, painted from a muted <video> of the
// source. Paused on the clip's first frame; plays on hover, looping the clip.

export function previewMarkup(video, clip, { captions = true } = {}) {
  const ratio = clipRatioId(video, clip);
  const cap = clipCaptionState(video, clip);
  const line = (clip.summary || clip.title || "").split(/\s+/).slice(0, 4).join(" ");
  return `<div class="clips-preview" style="aspect-ratio:${ratio.replace(":", "/")}" data-clip-preview="${escapeHtml(clip.id)}" data-ratio="${ratio}">
    <canvas class="clips-preview__canvas"></canvas>
    ${
      captions && cap.presetId !== "none"
        ? `<span class="clips-preview__caption"><span class="cap-ed-preview-${escapeHtml(cap.presetId)}">${escapeHtml(line)}</span></span>`
        : ""
    }
  </div>`;
}

// Each preview streams the source, so it only mounts once it scrolls into view —
// ten clips × two accounts of drafts would otherwise open twenty streams at once.
export function mountPreviews(root, video) {
  const disposers = [];
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const clip = video.clips.find((c) => c.id === entry.target.dataset.clipPreview);
        if (clip) disposers.push(mountPreview(entry.target, video, clip));
      }
    },
    { rootMargin: "200px" },
  );
  root.querySelectorAll("[data-clip-preview]").forEach((el) => io.observe(el));
  return () => {
    io.disconnect();
    disposers.forEach((d) => d());
  };
}

function mountPreview(el, video, clip) {
  const canvas = el.querySelector("canvas");
  const c2d = canvas.getContext("2d");
  const ctx = framingContext(video);
  const segments = clipSegments(video, clip);
  const ratio = ratioOf(el.dataset.ratio || clipRatioId(video, clip));
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "metadata";
  v.className = "clips-preview__video";
  v.src = video.url;
  el.appendChild(v);
  let raf = 0;
  const startS = clip.startMs / 1000 + 0.4;

  const paint = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * (window.devicePixelRatio || 1)));
    const h = Math.max(1, Math.round(r.height * (window.devicePixelRatio || 1)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const t = v.currentTime * 1000;
    drawOutput(c2d, v, ctx, resolve(ctx, segmentAt(segments, t), t, ratio), w, h);
  };
  const loop = () => {
    if (v.currentTime * 1000 >= clip.endMs) v.currentTime = clip.startMs / 1000;
    paint();
    raf = requestAnimationFrame(loop);
  };
  const onMeta = () => (v.currentTime = startS);
  const enter = () => {
    v.play().catch(() => {});
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };
  // data-autoplay: the clip plays on its own and keeps playing (the library's showcase).
  const auto = el.hasAttribute("data-autoplay") && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const leave = () => {
    if (auto) return;
    v.pause();
    cancelAnimationFrame(raf);
    v.currentTime = startS;
  };
  v.addEventListener("loadedmetadata", onMeta);
  v.addEventListener("seeked", paint);
  el.addEventListener("pointerenter", enter);
  el.addEventListener("pointerleave", leave);
  if (auto) enter();
  return () => {
    cancelAnimationFrame(raf);
    el.removeEventListener("pointerenter", enter);
    el.removeEventListener("pointerleave", leave);
    v.pause();
    v.removeAttribute("src");
    v.load();
  };
}
