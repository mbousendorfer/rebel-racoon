// /clips/:id — one video's project in the Clips space (flag clipsSpace).
//
// Prod's order, as screens instead of chips (content/studio … video-clips.ts):
// the analysis runs as soon as the video is added; then the moments, which the
// user reviews and picks; the options of the whole video (format, subtitles —
// set_clip_options) apply live to every preview; then the accounts and the
// CTA, and one draft per clip × account, written here and scheduled from here.
// Tabs: Clips · Drafts (?tab=drafts).

import { navigate } from "../../router.js?v=2143";
import { isFlagOn } from "../../feature-flags.js?v=2143";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=2143";
import { renderTopbar, setTopbarActions, renderIconBack } from "../../components/topbar.js?v=2143";
import { showToast } from "../../components/toast.js?v=2143";
import { renderPostCard } from "../../components/post-card.js?v=2143";
import { open as openScheduleModal } from "../../components/schedule-modal.js?v=2143";
import { open as openConnectAccountModal } from "../../components/connect-account-modal.js?v=2143";
import { connectableNetworkCards, accountIdsForNetwork } from "../../connect-profiles-flow.js?v=2143";
import { getConnectedProfiles, renderProfileTag } from "../../social-profiles.js?v=2143";
import { getContextById } from "../../contexts-store.js?v=2143";
import { framingContext, resolve, segmentAt, drawOutput } from "../../clip-framing.js?v=2143";
import {
  getPosts,
  addPostDraft,
  removePost,
  insertPost,
  updatePostContent,
  subscribe as subscribePosts,
} from "../../posts-store.js?v=2143";
import { escapeHtml } from "../../utils.js?v=2143";
import {
  getVideo,
  draftKey,
  updateSettings,
  setSelection,
  addClip,
  removeClip,
  restoreClip,
  ANALYSIS_STAGES,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2143";
import {
  fmtMs,
  formatSelect,
  subtitleSelect,
  previewMarkup,
  mountPreviews,
  bindSelectDismiss,
  clipRatioId,
  clipCaptionState,
  formatLabel,
  presetLabel,
  ratioOf,
  clipSegments,
  CTA_OPTIONS,
} from "./shared.js?v=2143";

let target = null;
let videoId = null;
let signature = "";
let disposePreviews = null;
const disposers = [];
// The Drafts tab's own state: the account / CTA picks, and whether the setup
// is showing over drafts that already exist ("Write more drafts").
const draftSetup = { accounts: null, cta: "none", open: false, writing: false };
// The workspace: the clip in the monitors, and the source monitor's clock.
const ws = { focusId: null, playing: false, raf: 0, scrub: false };

// The editor's "Create draft": land on the Drafts tab with the setup open for
// the clip just edited (the editor has already selected it alone).
export function primeDraftSetup(id) {
  videoId = id;
  Object.assign(draftSetup, { accounts: null, cta: "none", open: true, writing: false });
}

export function renderClipsProject(params, el) {
  if (!isFlagOn("clipsSpace")) {
    navigate("/");
    return undefined;
  }
  const video = getVideo(params.id);
  if (!video) {
    navigate("/clips");
    return undefined;
  }
  target = el;
  if (videoId !== video.id) {
    Object.assign(draftSetup, { accounts: null, cta: "none", open: false, writing: false });
    ws.focusId = null;
  }
  videoId = video.id;
  renderTopbar();
  paint();
  const topbar = document.getElementById("topbar");
  el.addEventListener("click", onClick);
  el.addEventListener("change", onChange);
  el.addEventListener("pointerdown", onPointerDown);
  topbar?.addEventListener("click", onClick);
  disposers.push(
    subscribeVideos(onStore),
    subscribePosts(draftKey(video.id), () => tab() === "drafts" && paint()),
    bindSelectDismiss(el),
    bindSelectDismiss(topbar),
  );
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("change", onChange);
    el.removeEventListener("pointerdown", onPointerDown);
    topbar?.removeEventListener("click", onClick);
    stopPlayback();
    disposers.splice(0).forEach((d) => d());
    disposePreviews?.();
    disposePreviews = null;
    target = null;
  };
}

const tab = () => (parseHashParams().get("tab") === "drafts" ? "drafts" : "clips");
const path = () => `/clips/${videoId}`;
const sig = (v) =>
  `${v.status}:${v.clips.map((c) => `${c.id}${c.startMs}${c.endMs}`).join()}:${JSON.stringify(v.settings)}`;

function onStore() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  if (sig(v) !== signature) return paint();
  if (v.status !== "analyzing") return patchSelection(v);
  const pct = Math.round(v.progress * 100);
  const fill = target.querySelector(".clips-analyzing .clips-progress__fill");
  if (fill) fill.style.width = `${pct}%`;
  const label = target.querySelector(".clips-analyzing .clips-progress__label");
  if (label) label.textContent = `${pct}%`;
  const at = ANALYSIS_STAGES.indexOf(v.stage);
  target.querySelectorAll("[data-clips-stage]").forEach((li, i) => {
    li.classList.toggle("is-done", i < at);
    li.classList.toggle("is-current", i === at);
  });
}

// Ticking a clip patches the page in place — a repaint would reload every
// preview's stream and the filmstrip.
function patchSelection(v) {
  const n = v.clips.filter((c) => c.selected).length;
  const all = n === v.clips.length && n > 0;
  for (const c of v.clips) {
    target.querySelector(`[data-clips-focus="${CSS.escape(c.id)}"]`)?.classList.toggle("is-selected", c.selected);
    const box = target.querySelector(`[data-clips-select="${CSS.escape(c.id)}"]`);
    if (box) box.checked = c.selected;
    target.querySelector(`[data-clips-block="${CSS.escape(c.id)}"]`)?.classList.toggle("is-selected", c.selected);
  }
  const allBox = target.querySelector("[data-clips-select-all]");
  if (allBox) {
    allBox.checked = all;
    allBox.indeterminate = n > 0 && !all;
    const label = allBox.closest("label")?.querySelector("span");
    if (label) label.textContent = `${n} of ${v.clips.length} selected`;
  }
  const cta = document.querySelector("[data-clips-to-drafts]");
  if (cta) {
    cta.disabled = !n;
    cta.querySelector("span").textContent = `Create drafts${n ? ` (${n})` : ""}`;
  }
}

// The page's actions live in the topbar, like an editor's export bar: the
// whole video's Format and Subtitles, then Create drafts.
function paintTopbarActions(v) {
  const n = v.clips.filter((c) => c.selected).length;
  const ready = v.status === "ready";
  setTopbarActions(
    `/clips/${v.id}`,
    ready
      ? `<div class="clips-topbar-actions">
          ${formatSelect(v.settings.ratio)}
          ${subtitleSelect(v.settings.subtitlePreset)}
          <button type="button" class="ap-button primary orange" data-clips-to-drafts ${n ? "" : "disabled"}>
            <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Create drafts${n ? ` (${n})` : ""}</span>
          </button>
        </div>`
      : "<span></span>",
    {
      left: `${renderIconBack("/clips", "Back to Clips")}<h1 class="app-topbar__title clips-topbar-title">${escapeHtml(v.name)}</h1>`,
    },
  );
}

function paint() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  signature = sig(v);
  stopPlayback();
  disposePreviews?.();
  disposePreviews = null;
  paintTopbarActions(v);
  if (v.status === "analyzing") {
    target.innerHTML = renderAnalyzing(v);
    return;
  }
  if (!v.clips.some((c) => c.id === ws.focusId)) ws.focusId = v.clips[0]?.id || null;
  const posts = getPosts(draftKey(v.id));
  const t = tab();
  target.innerHTML = `
    <div class="clips-view clips-project">
      <div class="clips-bar">
        <div class="ap-tabs clips-bar__tabs">
          <div class="ap-tabs-nav" role="tablist" aria-label="Clips and drafts">
            ${tabButton("clips", "ap-icon-video", "Clips", v.clips.length, t)}
            ${tabButton("drafts", "ap-icon-file--text", "Drafts", posts.length, t)}
          </div>
        </div>
        ${
          t === "clips"
            ? `<button type="button" class="ap-button stroked grey" data-clips-add-clip>
                <i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span>
              </button>`
            : ""
        }
      </div>
      ${t === "drafts" ? `<div class="clips-view__page">${renderDrafts(v, posts)}</div>` : renderWorkspace(v)}
    </div>`;
  if (t === "drafts") swapPlayers(v, posts);
  else {
    patchSelection(v);
    mountWorkspace(v);
  }
  disposePreviews = mountPreviews(target, v);
}

// The post card draws a faux player (a chat draft has no footage). Here the
// clip is real: put its reframed preview in the card, at the draft's format.
function swapPlayers(v, posts) {
  for (const post of posts) {
    const clip = v.clips.find((c) => c.id === post.clipRef?.clipId);
    const player = target.querySelector(`[data-post-id="${CSS.escape(post.id)}"] .posts__card-clip-player`);
    if (!clip || !player) continue;
    player.outerHTML = `<div class="clips-drafts__player">
      ${previewMarkup(v, { ...clip, ratio: post.format || clipRatioId(v, clip) })}
      <a class="ap-button stroked grey clips-drafts__edit" href="#/clips/${v.id}/edit/${clip.id}">
        <i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span>
      </a>
    </div>`;
  }
}

function tabButton(id, icon, label, count, current) {
  const on = id === current;
  return `<button type="button" class="ap-tabs-tab${on ? " active" : ""}" role="tab" aria-selected="${on}" data-clips-tab="${id}">
    <i class="${icon}" aria-hidden="true"></i><span>${label}</span>
    <span class="ap-counter normal ${on ? "blue" : "grey"}">${count}</span>
  </button>`;
}

// ── Analysis ─────────────────────────────────────────────────────────

function renderAnalyzing(v) {
  const at = Math.max(0, ANALYSIS_STAGES.indexOf(v.stage));
  const pct = Math.round(v.progress * 100);
  const steps = ANALYSIS_STAGES.map(
    (
      s,
      i,
    ) => `<li class="clips-analyzing__step${i < at ? " is-done" : ""}${i === at ? " is-current" : ""}" data-clips-stage>
      <span class="clips-analyzing__dot" aria-hidden="true"><i class="ap-icon-check"></i></span>${s}
    </li>`,
  ).join("");
  return `
    <div class="clips-view">
      <div class="clips-view__page">
        <section class="clips-analyzing" aria-live="polite">
          <div class="clips-analyzing__player">
            <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline></video>
          </div>
          <div class="clips-analyzing__text">
            <h2 class="clips-analyzing__title">Finding the best moments</h2>
            <p class="clips-analyzing__sub">
              ${fmtMs(v.durationMs)} of video — I'll cut ${v.durationMs > 600000 ? "10 clips" : "3 clips"}. You can leave this
              page: the analysis keeps going and the video waits for you in Clips.
            </p>
            <span class="clips-progress">
              <span class="clips-progress__track"><span class="clips-progress__fill" style="width:${pct}%"></span></span>
              <span class="clips-progress__label">${pct}%</span>
            </span>
            <ol class="clips-analyzing__steps">${steps}</ol>
          </div>
        </section>
      </div>
    </div>`;
}

// ── The workspace: bin · monitors · timeline ─────────────────────────
// An editing app's layout: the clips in a bin on the left, two monitors — the
// SOURCE (the long video, where the clip comes from) and the CLIP (its output,
// reframed at its format) — a transport, and the whole video's timeline at
// the foot: ruler, filmstrip, the clips track, a playhead. One <video> drives
// both monitors; the clip monitor is drawn from it.

const focused = (v) => v.clips.find((c) => c.id === ws.focusId) || v.clips[0] || null;

function renderWorkspace(v) {
  if (!v.clips.length) {
    return `<div class="clips-view__page"><p class="clips-list__none">No clips left. Add one from the video's timeline.</p></div>`;
  }
  const n = v.clips.filter((c) => c.selected).length;
  const all = n === v.clips.length;
  const rows = v.clips
    .map(
      (
        c,
        i,
      ) => `<li class="clips-bin__item${c.selected ? " is-selected" : ""}${c.id === ws.focusId ? " is-focused" : ""}" data-clips-focus="${c.id}" style="--i:${i}">
        <label class="ap-checkbox-container clips-bin__check" aria-label="Select clip ${i + 1}">
          <input type="checkbox" data-clips-select="${c.id}" ${c.selected ? "checked" : ""} /><i></i>
        </label>
        <span class="clips-bin__thumb">${previewMarkup(v, { ...c, ratio: "9:16" }, { captions: false })}</span>
        <span class="clips-bin__text">
          <span class="clips-bin__meta"><span class="clips-bin__num">${i + 1}</span>${fmtMs(c.endMs - c.startMs)}</span>
          <span class="clips-bin__title">${escapeHtml(c.title)}</span>
        </span>
      </li>`,
    )
    .join("");
  return `
    <div class="clips-ws">
      <aside class="clips-bin" aria-label="Clips">
        <header class="clips-bin__head">
          <label class="ap-checkbox-container">
            <input type="checkbox" data-clips-select-all ${all ? "checked" : ""} /><i></i><span>${n} of ${v.clips.length} selected</span>
          </label>
        </header>
        <ol class="clips-bin__list">${rows}</ol>
      </aside>
      <section class="clips-stage" aria-label="Monitors">
        <div class="clips-monitors">
          <figure class="clips-monitor clips-monitor--source">
            <div class="clips-monitor__screen" style="aspect-ratio:${v.width}/${v.height}">
              <video data-clips-src playsinline preload="auto" src="${escapeHtml(v.url)}"></video>
            </div>
            <figcaption><span>Source</span><span class="clips-monitor__tc" data-clips-src-tc>0:00</span></figcaption>
          </figure>
          <figure class="clips-monitor clips-monitor--program" data-clips-program></figure>
        </div>
        <div class="clips-transport">
          <button type="button" class="ap-icon-button transparent" data-clips-ws="prev" aria-label="Previous clip" data-tooltip="Previous clip"><i class="ap-icon-chevron-left" aria-hidden="true"></i></button>
          <button type="button" class="clips-transport__play" data-clips-ws="play" aria-label="Play the clip"><i class="ap-icon-play" aria-hidden="true" data-clips-play-icon></i></button>
          <button type="button" class="ap-icon-button transparent" data-clips-ws="next" aria-label="Next clip" data-tooltip="Next clip"><i class="ap-icon-chevron-right" aria-hidden="true"></i></button>
          <span class="clips-transport__tc"><span data-clips-clip-tc>0:00</span> / <span data-clips-clip-len>0:00</span></span>
          <span class="clips-transport__spacer"></span>
          <a class="ap-button stroked grey" data-clips-edit-link href="#"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span></a>
          <button type="button" class="ap-icon-button transparent" data-clips-ws="remove" aria-label="Remove clip" data-tooltip="Remove clip"><i class="ap-icon-trash" aria-hidden="true"></i></button>
        </div>
        <div class="clips-focus" data-clips-focus-info></div>
      </section>
    </div>
    ${renderTimeline(v)}`;
}

function renderTimeline(v) {
  const pct = (ms) => `${(ms / v.durationMs) * 100}%`;
  const step = [5000, 10000, 30000, 60000, 120000, 300000, 600000].find((s) => v.durationMs / s <= 12) || 900000;
  let ticks = "";
  for (let t = 0; t <= v.durationMs; t += step) ticks += `<span style="left:${pct(t)}">${fmtMs(t)}</span>`;
  const blocks = v.clips
    .map(
      (
        c,
        i,
      ) => `<button type="button" class="clips-tl2__clip${c.selected ? " is-selected" : ""}${c.id === ws.focusId ? " is-focused" : ""}"
        style="left:${pct(c.startMs)};width:max(14px, ${pct(c.endMs - c.startMs)})" data-clips-block="${c.id}"
        data-tooltip="${i + 1}. ${escapeHtml(c.title)}" aria-label="Clip ${i + 1}: ${escapeHtml(c.title)}"><span>${i + 1}</span></button>`,
    )
    .join("");
  return `
    <section class="clips-tl2" aria-label="Timeline">
      <div class="clips-tl2__labels" aria-hidden="true"><span></span><span>Video</span><span>Clips</span></div>
      <div class="clips-tl2__tracks" data-clips-tracks>
        <div class="clips-tl2__ruler" data-clips-scrub>${ticks}</div>
        <div class="clips-tl2__film" data-clips-film data-clips-scrub></div>
        <div class="clips-tl2__clips" data-clips-scrub>${blocks}</div>
        <div class="clips-tl2__playhead" data-clips-ph></div>
      </div>
    </section>`;
}

// The focused clip, in the monitors and the info panel.
function paintFocus(v) {
  const c = focused(v);
  if (!c) return;
  const i = v.clips.indexOf(c);
  const ratio = clipRatioId(v, c);
  const cap = clipCaptionState(v, c);
  const line = (c.summary || c.title || "").split(/\s+/).slice(0, 4).join(" ");
  const prog = target.querySelector("[data-clips-program]");
  if (prog)
    prog.innerHTML = `
      <div class="clips-monitor__screen" style="aspect-ratio:${ratio.replace(":", "/")}">
        <canvas data-clips-prog></canvas>
        ${cap.presetId !== "none" ? `<span class="clips-preview__caption"><span class="cap-ed-preview-${escapeHtml(cap.presetId)}">${escapeHtml(line)}</span></span>` : ""}
        <span class="clips-monitor__off" data-clips-off hidden>Outside this clip</span>
      </div>
      <figcaption><span>Clip ${i + 1} · ${escapeHtml(formatLabel(ratio))}</span><span class="clips-monitor__tc">${fmtMs(c.endMs - c.startMs)}</span></figcaption>`;
  const own = [
    c.ratio ? formatLabel(c.ratio) : "",
    c.captionCustom ? presetLabel(cap.presetId) : "",
    c.segments?.some((s) => s.origin === "USER") ? "Reframed" : "",
    c.texts?.length ? `${c.texts.length} text${c.texts.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const info = target.querySelector("[data-clips-focus-info]");
  if (info)
    info.innerHTML = `
      <p class="clips-focus__range">Clip ${i + 1} · ${fmtMs(c.startMs)} → ${fmtMs(c.endMs)}</p>
      <h2 class="clips-focus__title">${escapeHtml(c.title)}</h2>
      ${c.why ? `<p class="clips-focus__why">${escapeHtml(c.why)}</p>` : ""}
      ${own.length ? `<p class="clips-focus__own">${own.map((o) => `<span class="ap-tag grey">${escapeHtml(o)}</span>`).join("")}</p>` : ""}`;
  const edit = target.querySelector("[data-clips-edit-link]");
  if (edit) edit.setAttribute("href", `#/clips/${v.id}/edit/${c.id}`);
  const len = target.querySelector("[data-clips-clip-len]");
  if (len) len.textContent = fmtMs(c.endMs - c.startMs);
  target
    .querySelectorAll("[data-clips-focus]")
    .forEach((n) => n.classList.toggle("is-focused", n.dataset.clipsFocus === c.id));
  target
    .querySelectorAll("[data-clips-block]")
    .forEach((n) => n.classList.toggle("is-focused", n.dataset.clipsBlock === c.id));
  sizeProgram();
  paintProgram(v);
}

function sizeProgram() {
  const canvas = target.querySelector("[data-clips-prog]");
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
}

function mountWorkspace(v) {
  const video = target.querySelector("[data-clips-src]");
  if (!video) return;
  const c = focused(v);
  video.addEventListener("loadedmetadata", () => {
    if (c) video.currentTime = c.startMs / 1000 + 0.05;
  });
  video.addEventListener("seeked", () => !ws.playing && syncClock(v));
  video.addEventListener("loadeddata", () => syncClock(v));
  paintFocus(v);
  mountFilmstrip(v, target.querySelector("[data-clips-film]"));
  syncClock(v);
}

function paintProgram(v) {
  const canvas = target?.querySelector("[data-clips-prog]");
  const video = target?.querySelector("[data-clips-src]");
  const c = focused(v);
  if (!canvas || !video || !c) return;
  const t = video.currentTime * 1000;
  const inside = t >= c.startMs - 40 && t <= c.endMs + 40;
  target.querySelector("[data-clips-off]")?.toggleAttribute("hidden", inside);
  const ctx = framingContext(v);
  const segs = clipSegments(v, c);
  const at = Math.max(c.startMs, Math.min(c.endMs - 1, t));
  drawOutput(
    canvas.getContext("2d"),
    video,
    ctx,
    resolve(ctx, segmentAt(segs, at), at, ratioOf(clipRatioId(v, c))),
    canvas.width,
    canvas.height,
  );
}

// One clock for the monitors, the timecodes and the playhead.
function syncClock(v) {
  const video = target?.querySelector("[data-clips-src]");
  if (!video) return;
  const t = video.currentTime * 1000;
  const c = focused(v);
  const tc = target.querySelector("[data-clips-src-tc]");
  if (tc) tc.textContent = fmtMs(t);
  const ctc = target.querySelector("[data-clips-clip-tc]");
  if (ctc && c) ctc.textContent = fmtMs(Math.max(0, Math.min(c.endMs, t) - c.startMs));
  const ph = target.querySelector("[data-clips-ph]");
  if (ph) ph.style.left = `${(t / v.durationMs) * 100}%`;
  paintProgram(v);
}

function playClip(v) {
  const video = target.querySelector("[data-clips-src]");
  const c = focused(v);
  if (!video || !c) return;
  if (ws.playing) return stopPlayback();
  const t = video.currentTime * 1000;
  if (t < c.startMs || t >= c.endMs - 100) video.currentTime = c.startMs / 1000;
  ws.playing = true;
  video.play().catch(() => {});
  setPlayIcon(true);
  const tick = () => {
    if (!ws.playing || !target) return;
    if (video.currentTime * 1000 >= c.endMs) {
      stopPlayback();
      return;
    }
    syncClock(v);
    ws.raf = requestAnimationFrame(tick);
  };
  ws.raf = requestAnimationFrame(tick);
}

function stopPlayback() {
  ws.playing = false;
  cancelAnimationFrame(ws.raf);
  target?.querySelector("[data-clips-src]")?.pause();
  setPlayIcon(false);
}

function setPlayIcon(on) {
  const i = target?.querySelector("[data-clips-play-icon]");
  if (i) i.className = on ? "ap-icon-pause" : "ap-icon-play";
}

function focusClip(v, id, { seek = true } = {}) {
  stopPlayback();
  ws.focusId = id;
  paintFocus(v);
  const c = focused(v);
  const video = target.querySelector("[data-clips-src]");
  if (seek && video && c && video.readyState >= 1) video.currentTime = c.startMs / 1000 + 0.05;
  target
    .querySelector(`[data-clips-focus="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Scrubbing the timeline moves the source; landing inside a clip focuses it.
function onPointerDown(e) {
  const v = getVideo(videoId);
  if (!v || e.button !== 0) return;
  if (!e.target.closest("[data-clips-scrub]") || e.target.closest("[data-clips-block]")) return;
  const tracks = target.querySelector("[data-clips-tracks]");
  const video = target.querySelector("[data-clips-src]");
  if (!tracks || !video) return;
  e.preventDefault();
  stopPlayback();
  const r = tracks.getBoundingClientRect();
  const at = (ev) => Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * v.durationMs;
  const move = (ev) => {
    const t = at(ev);
    if (video.readyState >= 1) video.currentTime = t / 1000;
    const hit = v.clips.find((c) => t >= c.startMs && t <= c.endMs);
    if (hit && hit.id !== ws.focusId) {
      ws.focusId = hit.id;
      paintFocus(v);
    }
    const ph = target.querySelector("[data-clips-ph]");
    if (ph) ph.style.left = `${(t / v.durationMs) * 100}%`;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  move(e);
}

// ── The filmstrip ────────────────────────────────────────────────────
// Frames of the source along the timeline, drawn once per video from a
// hidden <video> and kept: a later visit re-attaches the same canvases. The
// CDN sends no CORS headers, so frames are drawn, never read back.

const FRAMES = 24;
const filmstrips = new Map(); // videoId → { frames: canvas[], done }

function mountFilmstrip(v, host) {
  if (!host) return;
  let film = filmstrips.get(v.id);
  if (!film) {
    film = { frames: [], done: false };
    filmstrips.set(v.id, film);
    buildFilmstrip(v, film);
  }
  film.host = host;
  host.innerHTML = "";
  for (let i = 0; i < FRAMES; i++) host.appendChild(film.frames[i] || placeholder());
}

function placeholder() {
  const s = document.createElement("span");
  s.className = "clips-tl2__frame is-empty";
  return s;
}

function buildFilmstrip(v, film) {
  const probe = document.createElement("video");
  probe.muted = true;
  probe.preload = "auto";
  probe.src = v.url;
  let i = 0;
  const next = () => {
    if (i >= FRAMES) {
      film.done = true;
      probe.removeAttribute("src");
      probe.load();
      return;
    }
    probe.currentTime = (((i + 0.5) / FRAMES) * v.durationMs) / 1000;
  };
  probe.addEventListener("loadedmetadata", next);
  probe.addEventListener("seeked", () => {
    const c = document.createElement("canvas");
    c.className = "clips-tl2__frame";
    c.width = 160;
    c.height = 90;
    c.getContext("2d").drawImage(probe, 0, 0, 160, 90);
    film.frames[i] = c;
    const slot = film.host?.children[i];
    if (slot && film.host.isConnected) film.host.replaceChild(c, slot);
    i += 1;
    next();
  });
}

// ── Drafts ───────────────────────────────────────────────────────────

function renderDrafts(v, posts) {
  if (draftSetup.writing) {
    return `<div class="clips-drafts__writing"><span class="ap-loader" aria-hidden="true"></span><p>Writing your drafts…</p></div>`;
  }
  if (!posts.length || draftSetup.open) return renderDraftSetup(v, posts.length > 0);
  const toSchedule = posts.filter((p) => p.status !== "scheduled");
  return `
    <div class="clips-toolbar">
      <p class="clips-toolbar__count">${posts.length} draft${posts.length === 1 ? "" : "s"}${
        posts.length - toSchedule.length ? ` · ${posts.length - toSchedule.length} scheduled` : ""
      }</p>
      <div class="clips-toolbar__actions">
        <button type="button" class="ap-button stroked grey" data-clips-more-drafts>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>Write more drafts</span>
        </button>
        <button type="button" class="ap-button primary blue" data-clips-schedule-all ${toSchedule.length ? "" : "disabled"}>
          <i class="ap-icon-calendar" aria-hidden="true"></i><span>Schedule ${toSchedule.length || ""}</span>
        </button>
      </div>
    </div>
    <div class="clips-drafts posts clips-paper">
      ${posts.map(renderDraft).join("")}
    </div>`;
}

// A scheduled draft stays in the list, said so above its card — this space is
// where the video's whole output is read, scheduled or not.
function renderDraft(p) {
  const scheduled = p.status === "scheduled";
  const when =
    scheduled && p.scheduledFor
      ? new Date(p.scheduledFor).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
  return `<div class="clips-drafts__item">
    ${scheduled ? `<p class="clips-drafts__status"><span class="ap-status green">Scheduled${when ? ` · ${escapeHtml(when)}` : ""}</span></p>` : ""}
    ${renderPostCard(p, { railActions: scheduled ? ["delete"] : ["schedule", "delete"] })}
  </div>`;
}

function renderDraftSetup(v, hasDrafts) {
  const clips = v.clips.filter((c) => c.selected);
  const profiles = getConnectedProfiles();
  if (draftSetup.accounts === null) draftSetup.accounts = new Set(profiles.slice(0, 1).map((p) => p.id));
  const accounts = profiles.filter((p) => draftSetup.accounts.has(p.id));
  const pb = getContextById(v.contextId);
  const count = clips.length * accounts.length;
  const accountBlock = profiles.length
    ? `<div class="clips-setup__accounts">${profiles
        .map(
          (p) => `<label class="ap-checkbox-container clips-setup__account">
            <input type="checkbox" data-clips-account="${escapeHtml(p.id)}" ${draftSetup.accounts.has(p.id) ? "checked" : ""} /><i></i>
            ${renderProfileTag(p)}
          </label>`,
        )
        .join("")}</div>`
    : `<p class="clips-setup__hint">Connect an account first — the network sets the length and the format of each draft. Nothing publishes yet.</p>
       <div class="clips-setup__connect">${connectableNetworkCards()
         .map(
           (n) => `<button type="button" class="ap-button stroked grey" data-clips-connect="${escapeHtml(n.value)}">
             ${n.preview}<span>${escapeHtml(n.label)}</span></button>`,
         )
         .join("")}</div>`;
  const ctas = CTA_OPTIONS.map(
    (o) => `<label class="ap-radio-card card clips-setup__cta">
      <input type="radio" name="clips-cta" value="${o.id}" data-clips-cta ${draftSetup.cta === o.id ? "checked" : ""} />
      <div><span>${escapeHtml(o.label)}</span><p class="clips-setup__cta-hint">${escapeHtml(o.hint)}</p></div>
    </label>`,
  ).join("");
  return `
    <section class="clips-setup" aria-labelledby="clips-setup-title">
      <header class="clips-setup__head">
        <h2 class="clips-setup__title" id="clips-setup-title">Where should I post these?</h2>
        <p class="clips-setup__sub">
          ${clips.length} clip${clips.length === 1 ? "" : "s"} selected · ${escapeHtml(formatLabel(v.settings.ratio))} ·
          ${escapeHtml(presetLabel(v.settings.subtitlePreset))}. One draft per clip and account${pb ? `, written in ${escapeHtml(pb.name)}'s voice` : ""}.
        </p>
      </header>
      <div class="clips-setup__group">
        <h3 class="clips-setup__label">Accounts</h3>
        ${accountBlock}
      </div>
      <div class="clips-setup__group">
        <h3 class="clips-setup__label">Call to action</h3>
        <div class="clips-setup__ctas">${ctas}</div>
        ${
          draftSetup.cta !== "none" && pb?.cta
            ? `<p class="clips-setup__hint">From the Playbook: “${escapeHtml(pb.cta)}”</p>`
            : draftSetup.cta !== "none"
              ? `<p class="clips-setup__hint">This Playbook has no call to action yet — I'll leave it out.</p>`
              : ""
        }
      </div>
      <footer class="clips-setup__foot">
        ${
          hasDrafts
            ? `<button type="button" class="ap-button ghost grey" data-clips-setup-cancel>Cancel</button>`
            : `<button type="button" class="ap-button ghost grey" data-clips-tab="clips">Back to clips</button>`
        }
        <button type="button" class="ap-button primary orange" data-clips-write ${count ? "" : "disabled"}>
          <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Write ${count || ""} draft${count === 1 ? "" : "s"}</span>
        </button>
      </footer>
    </section>`;
}

function writeDrafts() {
  const v = getVideo(videoId);
  const clips = v.clips.filter((c) => c.selected);
  const accounts = getConnectedProfiles().filter((p) => draftSetup.accounts?.has(p.id));
  if (!clips.length || !accounts.length) return;
  const pb = getContextById(v.contextId);
  const key = draftKey(v.id);
  draftSetup.writing = true;
  paint();
  setTimeout(() => {
    for (const clip of clips) {
      for (const a of accounts) {
        const d = addPostDraft(key, {
          network: a.platform,
          text: [clip.title, clip.summary].filter(Boolean),
          hashtags: (clip.tags || []).slice(0, 3),
          clipRef: {
            start: clip.startMs / 1000,
            end: clip.endMs / 1000,
            sourceName: v.name,
            sourceId: v.id,
            clipId: clip.id,
          },
          format: clipRatioId(v, clip),
          subtitleStyle: clipCaptionState(v, clip).presetId,
        });
        if (pb?.cta && draftSetup.cta === "in_post") d.cta = pb.cta;
        if (pb?.cta && draftSetup.cta === "first_comment") d.firstComment = pb.cta;
      }
    }
    Object.assign(draftSetup, { writing: false, open: false });
    paint();
    const n = clips.length * accounts.length;
    showToast(`${n} draft${n === 1 ? "" : "s"} written`);
  }, 1600);
}

// ── Events ───────────────────────────────────────────────────────────

function onClick(e) {
  const v = getVideo(videoId);
  if (!v) return;
  const t = e.target;

  const tabBtn = t.closest("[data-clips-tab]");
  if (tabBtn) return setHashQuery(path(), tabBtn.dataset.clipsTab === "drafts" ? { tab: "drafts" } : {});

  const ratio = t.closest("[data-clips-ratio]");
  if (ratio) {
    ratio.closest("details")?.removeAttribute("open");
    return updateSettings(v.id, { ratio: ratio.dataset.clipsRatio });
  }
  const preset = t.closest("[data-clips-preset]");
  if (preset) {
    preset.closest("details")?.removeAttribute("open");
    return updateSettings(v.id, { subtitlePreset: preset.dataset.clipsPreset });
  }

  const wsAct = t.closest("[data-clips-ws]")?.dataset.clipsWs;
  if (wsAct === "play") return playClip(v);
  if (wsAct === "prev" || wsAct === "next") {
    const i = v.clips.findIndex((c) => c.id === ws.focusId);
    const j = Math.max(0, Math.min(v.clips.length - 1, i + (wsAct === "next" ? 1 : -1)));
    return focusClip(v, v.clips[j].id);
  }
  if (wsAct === "remove") {
    const gone = removeClip(v.id, ws.focusId);
    if (gone) showToast("Clip removed", { action: { label: "Undo", onClick: () => restoreClip(v.id, gone) } });
    return undefined;
  }
  const block = t.closest("[data-clips-block]");
  if (block) return focusClip(v, block.dataset.clipsBlock);
  const row = t.closest("[data-clips-focus]");
  if (row && !t.closest("label")) return focusClip(v, row.dataset.clipsFocus);

  if (t.closest("[data-clips-add-clip]")) {
    // A 30 s range in the first gap after the last clip, opened on Trim.
    const last = v.clips[v.clips.length - 1];
    const startMs = Math.min(v.durationMs - 30000, last ? last.endMs + 5000 : 0);
    const clip = addClip(v.id, { startMs: Math.max(0, startMs), endMs: Math.max(0, startMs) + 30000 });
    return navigate(`/clips/${v.id}/edit/${clip.id}?tool=trim`);
  }

  if (t.closest("[data-clips-to-drafts]")) {
    draftSetup.open = true;
    return setHashQuery(path(), { tab: "drafts" });
  }
  if (t.closest("[data-clips-more-drafts]")) {
    draftSetup.open = true;
    return paint();
  }
  if (t.closest("[data-clips-setup-cancel]")) {
    draftSetup.open = false;
    return paint();
  }
  if (t.closest("[data-clips-write]")) return writeDrafts();

  const connect = t.closest("[data-clips-connect]");
  if (connect) {
    const platform = connect.dataset.clipsConnect;
    openConnectAccountModal({
      network: platform,
      preselected: accountIdsForNetwork(platform),
      onConfirm: (accounts) => {
        if (!accounts.length) return;
        draftSetup.accounts = new Set(accounts.map((a) => a.id));
        paint();
      },
    });
    return undefined;
  }

  const key = draftKey(v.id);
  const schedule = t.closest("[data-post-schedule]");
  if (schedule) {
    const post = getPosts(key).find((p) => p.id === schedule.dataset.postSchedule);
    if (post) scheduleDrafts(v, [post]);
    return undefined;
  }
  if (t.closest("[data-clips-schedule-all]")) {
    return scheduleDrafts(
      v,
      getPosts(key).filter((p) => p.status !== "scheduled"),
    );
  }
  const del = t.closest("[data-post-delete]");
  if (del) {
    const posts = getPosts(key);
    const index = posts.findIndex((p) => p.id === del.dataset.postDelete);
    const removed = removePost(key, del.dataset.postDelete);
    if (removed)
      showToast("Draft deleted", { action: { label: "Undo", onClick: () => insertPost(key, removed, index) } });
    return undefined;
  }
  const clipEdit = t.closest("[data-post-clip-edit]");
  if (clipEdit) {
    const post = getPosts(key).find((p) => p.id === clipEdit.dataset.postClipEdit);
    if (post?.clipRef?.clipId) navigate(`/clips/${v.id}/edit/${post.clipRef.clipId}`);
  }
  return undefined;
}

function scheduleDrafts(v, posts) {
  if (!posts.length) return;
  openScheduleModal({
    posts,
    playbookId: v.contextId,
    onConfirm: (slots) => {
      for (const s of slots) updatePostContent(draftKey(v.id), s.postId, { status: "scheduled", scheduledFor: s.when });
    },
  });
}

function onChange(e) {
  const v = getVideo(videoId);
  if (!v) return;
  const t = e.target;
  if (t.matches("[data-clips-select-all]")) return setSelection(v.id, t.checked ? v.clips.map((c) => c.id) : []);
  if (t.matches("[data-clips-select]")) {
    const ids = v.clips.filter((c) => (c.id === t.dataset.clipsSelect ? t.checked : c.selected)).map((c) => c.id);
    return setSelection(v.id, ids);
  }
  if (t.matches("[data-clips-account]")) {
    draftSetup.accounts = draftSetup.accounts || new Set();
    if (t.checked) draftSetup.accounts.add(t.dataset.clipsAccount);
    else draftSetup.accounts.delete(t.dataset.clipsAccount);
    return paint();
  }
  if (t.matches("[data-clips-cta]")) {
    draftSetup.cta = t.value;
    return paint();
  }
  return undefined;
}
