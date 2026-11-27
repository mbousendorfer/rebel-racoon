// Clips space — what the library, the project page and the
// editor share: time formatting, the video-wide options (format, subtitles),
// and the live reframed previews.

import { FORMATS, ratioNetworksMeta } from "../../clip-formats.js?v=2933";
import { PROD_PRESET_IDS, presetById, captionStateFor } from "../../clip-captions.js?v=2933";
import { framingContext, initialSegments, resolve, segmentAt, drawOutput } from "../../clip-framing.js?v=2933";
import { escapeHtml } from "../../utils.js?v=2933";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2933";
import { showToast } from "../../components/toast.js?v=2933";
import { navigate } from "../../router.js?v=2933";
import { getVideo, getVideos, removeVideo, subscribe as subscribeVideos } from "../../videos-store.js?v=2933";

// A footage well shows a loading sheen until its first frame is in (clips.css,
// `:not(.is-ready)`): every well is marked here, once, from the media events
// of whatever <video> it holds, so no screen has to wire it.
const WELLS =
  ".media-card__stage, .clips-showcase__source, .clips-recap__player, .clips-preview, .clips-clip, .nle-well";
for (const type of ["loadeddata", "seeked"]) {
  document.addEventListener(type, (e) => e.target.closest?.(WELLS)?.classList.add("is-ready"), true);
}

// An analysis that ends says so wherever you are (Runway, Higgsfield): a toast
// with Open — except on that video's own page, which shows it in place.
const lastStatus = new Map();
subscribeVideos(() => {
  for (const v of getVideos()) {
    const was = lastStatus.get(v.id);
    lastStatus.set(v.id, v.status);
    if (was !== "analyzing" || v.status === "analyzing") continue;
    if (location.hash.startsWith(`#/clips/${v.id}`)) continue;
    const msg =
      v.status === "ready"
        ? `${v.clips.length} clip${v.clips.length === 1 ? "" : "s"} ready · ${v.name}`
        : v.failure?.kind === "crash"
          ? `I couldn't finish ${v.name}`
          : `No clips in ${v.name}`;
    showToast(msg, {
      variant: v.status === "ready" ? "success" : "error",
      duration: 8000,
      action: { label: "Open", onClick: () => navigate(`/clips/${v.id}`) },
    });
  }
});

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
// Prod's sections (clip-editor-modal: Ratio, Subtitles, Reframe, Text,
// Teaser), the transcript set apart, plus Brand (the proto's).
export const presetLabel = (id) => (id === "none" ? "No subtitles" : presetById(id)?.label || id);

export function clipRatioId(video, clip) {
  return clip.ratio || video.settings.ratio || "9:16";
}

export function clipCaptionState(video, clip) {
  return clip.captionState || captionStateFor(video.settings.subtitlePreset);
}

function clipSegments(video, clip) {
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
// <select>. `attr` names the data attribute each option carries. The trigger's
// name says the value too (« Format of this clip: Vertical 9:16 »); valueHtml
// is already escaped, so only its tags are stripped.
export function dsSelect({ label, valueHtml, options, attr, current, ariaLabel, extraClass = "" }) {
  const items = options
    .map((o) => {
      const on = o.id === current;
      return `<div class="ap-select-option${on ? " selected" : ""}" role="option" aria-selected="${on}" tabindex="0" ${attr}="${escapeHtml(o.id)}">
        ${o.lead || ""}<span class="ap-select-option-text">${escapeHtml(o.label)}</span>${o.meta || ""}
        ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`;
    })
    .join("");
  return `<details class="ap-select ${extraClass}">
    <summary class="ap-select-trigger" aria-label="${escapeHtml(ariaLabel || label)}: ${valueHtml
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()}">
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
  // The options are focusable (tabindex 0): Enter or Space picks one, the
  // arrows walk the list, Escape closes and hands focus back to the trigger.
  const onKey = (e) => {
    const opt = root.contains(e.target) && e.target.closest?.(".ap-select-option");
    if (opt && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      const sel = opt.closest("details.ap-select");
      opt.click();
      sel?.removeAttribute("open");
      sel?.querySelector("summary")?.focus();
    } else if (opt && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      e.stopPropagation();
      const all = [...opt.parentElement.querySelectorAll(".ap-select-option")];
      all[(all.indexOf(opt) + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus();
    } else if (e.key === "Escape") {
      const open = e.target.closest?.("details.ap-select[open]");
      close(null);
      open?.querySelector("summary")?.focus();
    }
  };
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey, true);
  return () => {
    document.removeEventListener("pointerdown", onDown);
    document.removeEventListener("keydown", onKey, true);
  };
}

// The video's look, one DS select (refonte B): Format then Subtitles, two
// sections of one list (the DS has no nested menu: sections + divider). Each
// option keeps its own attribute — data-clips-ratio / data-clips-preset.
export function lookSelect(ratio, preset) {
  const opt = (attr, id, label, on, lead = "", meta = "") =>
    `<div class="ap-select-option${on ? " selected" : ""}" role="option" aria-selected="${on}" tabindex="0" ${attr}="${escapeHtml(id)}">
      ${lead}<span class="ap-select-option-text">${escapeHtml(label)}</span>${meta}
      ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
    </div>`;
  const formats = RATIO_IDS.map((id) =>
    opt("data-clips-ratio", id, formatLabel(id), id === ratio, "", bestFor(id)),
  ).join("");
  const subs = SUBTITLE_IDS.map((id) =>
    opt(
      "data-clips-preset",
      id,
      presetLabel(id),
      id === preset,
      id === "none"
        ? `<span class="clips-preset-swatch"><i class="ap-icon-close" aria-hidden="true"></i></span>`
        : `<span class="clips-preset-swatch"><span class="cap-ed-preview-${id}">Aa</span></span>`,
    ),
  ).join("");
  const value = `${formatLabel(ratio)} · ${presetLabel(preset)}`;
  return `<details class="ap-select clips-look">
    <summary class="ap-select-trigger" aria-label="Look of every clip without its own: ${escapeHtml(value)}">
      <span class="ap-select-inline-label">Look</span>
      <span class="ap-select-value">${escapeHtml(value)}</span>
      <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
    </summary>
    <div class="ap-select-dropdown" role="listbox" aria-label="Look of every clip without its own">
      <div class="ap-select-options">
        <div class="ap-select-group"><span class="ap-select-group-label">Format</span></div>
        ${formats}
        <div class="ap-select-divider"></div>
        <div class="ap-select-group"><span class="ap-select-group-label">Subtitles</span></div>
        ${subs}
      </div>
    </div>
  </details>`;
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

// Removing a video is destructive and has no undo: the DS confirm modal asks.
// Its clips go with it; drafts already written from it stay in posts-store.
export function confirmRemoveVideo(id, { onRemoved } = {}) {
  const v = getVideo(id);
  if (!v) return;
  openConfirm({
    // The clips go with the video: the dialog says it in its title and its
    // button, not only in its body (2026-11-23).
    title: v.clips.length ? "Remove this video and its clips?" : "Remove this video?",
    body: v.clips.length
      ? `« ${v.name} » leaves Clips with its ${v.clips.length} clip${v.clips.length === 1 ? "" : "s"}: you won't be able to review, edit or post them anymore. This can't be undone. Posts already written in a chat stay.`
      : `« ${v.name} » leaves Clips. This can't be undone.`,
    confirmLabel: v.clips.length ? "Remove the video and its clips" : "Remove the video",
    cancelLabel: "Cancel",
    danger: true,
    onConfirm: () => {
      removeVideo(id);
      onRemoved?.();
    },
  });
}

// ── The media card ───────────────────────────────────────────────────
// ONE card for everything that shows a video or a clip with its facts —
// the library's videos, the clips page's clips, the waiting ones (2026-11-20:
// « toutes ces cards ne sont pas cohérentes… un composant commun décliné en
// plusieurs tailles/variantes »). Anatomy, always the same:
//   stage — a dark 4:3 well, the media at its real shape; four corner slots
//           (tl: a box or a status · tr: ⋯ · bl: what it is · br: its length),
//           all chips alike; `over` for a veil or the clips' map
//   body  — the title (two lines), a meta line (« · »-joined), a two-line
//           description, facts (icon + number named in words)
//   foot  — the actions, or what the card leads to, under a hairline
// Hover: the blue border; kept / selected (.is-kept): the blue border, held.
// CSS: styles/components/media-card.css.

export const chip = (text) => `<span class="media-card__chip">${text}</span>`;
export const fact = (icon, html) =>
  `<span class="media-card__fact"><i class="ap-icon-${icon}" aria-hidden="true"></i><span>${html}</span></span>`;

export function mediaCard({
  tag = "article",
  attrs = "",
  cls = "",
  stage = "",
  tl = "",
  tr = "",
  bl = "",
  br = "",
  over = "",
  title = "",
  titleTip = "",
  meta = [],
  desc = "",
  facts = [],
  foot = "",
  href = "",
}) {
  const m = meta.filter(Boolean);
  const f = facts.filter(Boolean);
  // A card that opens something: one link over the whole card (named by the
  // title), so its foot can still hold buttons — a link can't hold buttons.
  const cover = href
    ? `<a class="media-card__cover" href="${href}" aria-label="${escapeHtml(titleTip || title.replace(/<[^>]+>/g, ""))}"></a>`
    : "";
  return `<${tag} class="media-card ${cls}" ${attrs}>${cover}
    <span class="media-card__stage">${stage}${over}${tl ? `<span class="media-card__tl">${tl}</span>` : ""}${tr ? `<span class="media-card__tr">${tr}</span>` : ""}${bl ? `<span class="media-card__bl">${bl}</span>` : ""}${br ? `<span class="media-card__br">${br}</span>` : ""}</span>
    <span class="media-card__body">
      <span class="media-card__title"${titleTip ? ` title="${escapeHtml(titleTip)}"` : ""}>${title}</span>
      ${m.length ? `<span class="media-card__meta">${m.join(" · ")}</span>` : ""}
      ${desc ? `<span class="media-card__desc">${desc}</span>` : ""}
      ${f.length ? `<span class="media-card__facts">${f.join("")}</span>` : ""}
    </span>
    ${foot ? `<span class="media-card__foot">${foot}</span>` : ""}
  </${tag}>`;
}

// A card still to come: the same frame, shimmering.
export const waitingCard = () =>
  `<div class="media-card is-waiting" aria-hidden="true"><span class="media-card__stage"></span><span class="media-card__body"><span class="media-card__line"></span><span class="media-card__line is-short"></span></span></div>`;

// A veil over the stage: a line, and a bar when something is running.
export const veil = (text, { running = true, warn = false, attrs = "" } = {}) =>
  `<span class="media-card__veil" ${attrs}>${warn ? `<i class="ap-icon-warning" aria-hidden="true"></i>` : ""}<span>${text}</span>${
    running
      ? `<span class="clips-progress__track is-indeterminate"><span class="clips-progress__fill"></span></span>`
      : ""
  }</span>`;
