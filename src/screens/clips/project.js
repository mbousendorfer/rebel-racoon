// /clips/:id — one video's project in the Clips space (flag clipsSpace).
//
// Prod's order, as screens instead of chips (content/studio … video-clips.ts):
// the analysis runs as soon as the video is added; then the moments, which the
// user reviews and picks; the options of the whole video (format, subtitles —
// set_clip_options) apply live to every preview; then the accounts and the
// CTA, and one draft per clip × account, written here and scheduled from here.
// Tabs: Clips · Drafts (?tab=drafts).

import { navigate } from "../../router.js?v=2193";
import { isFlagOn } from "../../feature-flags.js?v=2193";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=2193";
import { renderTopbar, setTopbarActions, renderIconBack } from "../../components/topbar.js?v=2193";
import { showToast } from "../../components/toast.js?v=2193";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2193";
import { renderPostCard } from "../../components/post-card.js?v=2193";
import { open as openScheduleModal } from "../../components/schedule-modal.js?v=2193";
import { open as openConnectAccountModal } from "../../components/connect-account-modal.js?v=2193";
import { connectableNetworkCards, accountIdsForNetwork } from "../../connect-profiles-flow.js?v=2193";
import { getConnectedProfiles, renderProfileTag } from "../../social-profiles.js?v=2193";
import { getContextById } from "../../contexts-store.js?v=2193";
import { framingContext, resolve, segmentAt, drawOutput } from "../../clip-framing.js?v=2193";
import { captionStateFor } from "../../clip-captions.js?v=2193";
import {
  getPosts,
  addPostDraft,
  removePost,
  updatePostContent,
  subscribe as subscribePosts,
} from "../../posts-store.js?v=2193";
import { escapeHtml } from "../../utils.js?v=2193";
import {
  getVideo,
  draftKey,
  updateSettings,
  updateClip,
  setSelection,
  addClip,
  removeClip,
  ANALYSIS_STAGES,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2193";
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
  dsSelect,
  RATIO_IDS,
  SUBTITLE_IDS,
  bestFor,
  CTA_OPTIONS,
} from "./shared.js?v=2193";

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
  el.addEventListener("input", onInput);
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
    el.removeEventListener("input", onInput);
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
  if (v.status !== "analyzing") {
    // A clip's own format or subtitles changed in the inspector, or a tick.
    if (tab() === "clips") paintFocus(v);
    return patchSelection(v);
  }
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
    target.querySelectorAll(`[data-clips-select="${CSS.escape(c.id)}"]`).forEach((box) => (box.checked = c.selected));
  }
  const allBox = target.querySelector("[data-clips-select-all]");
  if (allBox) {
    allBox.checked = all;
    allBox.indeterminate = n > 0 && !all;
  }
  const cta = document.getElementById("topbar")?.querySelector("[data-clips-to-drafts]");
  if (cta) {
    cta.disabled = !n;
    cta.querySelector("[data-clips-cta-label]").textContent = ctaLabel(n);
  }
  const step = target.querySelector("[data-clips-step-count]");
  if (step) step.textContent = `${n} of ${v.clips.length}`;
}

const ctaLabel = (n) => (n ? `Write posts for ${n} clip${n === 1 ? "" : "s"}` : "Tick a clip to post it");

// The topbar names the video and leads back; on step 1 its right side holds the
// page's next step (O3: the page's primary, rightmost), counted in clips.
function paintTopbarActions(v) {
  const n = v.clips.filter((c) => c.selected).length;
  const right =
    v.status !== "analyzing" && tab() !== "drafts"
      ? `<button type="button" class="ap-button primary blue" data-clips-to-drafts ${n ? "" : "disabled"}>
          <span data-clips-cta-label>${ctaLabel(n)}</span><i class="ap-icon-arrow-right" aria-hidden="true"></i>
        </button>`
      : "<span></span>";
  setTopbarActions(`/clips/${v.id}`, right, {
    left: `${renderIconBack("/clips", "Back to Clips")}<h1 class="app-topbar__title clips-topbar-title">${escapeHtml(v.name)}</h1>`,
  });
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
        <nav class="ap-stepper clips-bar__steps" aria-label="Steps">
          ${stepButton("clips", 1, "Pick the clips", `<span data-clips-step-count>${v.clips.filter((c) => c.selected).length} of ${v.clips.length}</span>`, t)}
          <span class="ap-stepper-separator" aria-hidden="true"><i class="ap-icon-chevron-right"></i></span>
          ${stepButton("drafts", 2, "Write the posts", posts.length ? `${posts.length} draft${posts.length === 1 ? "" : "s"}` : "", t)}
        </nav>
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

// The page is two steps in a row, not two parallel views: the DS stepper —
// the current step active, the one before it completed, the one after pending.
function stepButton(id, n, label, meta, current) {
  const on = id === current;
  const state = on ? "active" : id === "clips" ? "completed" : "pending";
  return `<button type="button" class="ap-stepper-item clickable ${state} clips-step" ${on ? 'aria-current="step"' : ""} data-clips-tab="${id}">
    <span>${state === "completed" ? `<i class="ap-icon-check" aria-hidden="true"></i>` : n}</span>
    <span>${label}${meta ? ` <span class="clips-step__meta">· ${meta}</span>` : ""}</span>
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

// ── The workspace: the list · the clip ──────────────────────────────
// Master–detail. Left, the clips: tick the ones to post, open one, add one.
// Right, the open clip: its video at its format with ITS scrubber, and right
// against it what it is, where it sits in the video, and its actions. A hidden
// <video> (the long one) feeds the clip's canvas.

const focused = (v) => v.clips.find((c) => c.id === ws.focusId) || v.clips[0] || null;

function renderWorkspace(v) {
  if (!v.clips.length) {
    return `<div class="clips-view__page"><div class="clips-list__none"><p>No clips left.</p>
      <button type="button" class="ap-button primary blue" data-clips-add-clip><i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span></button></div></div>`;
  }
  const n = v.clips.filter((c) => c.selected).length;
  const all = n === v.clips.length;
  const rows = v.clips
    .map(
      (
        c,
        i,
      ) => `<li class="clips-bin__item${c.selected ? " is-selected" : ""}${c.id === ws.focusId ? " is-focused" : ""}" data-clips-focus="${c.id}" style="--i:${i}">
        <label class="ap-checkbox-container clips-bin__check" aria-label="Post clip ${i + 1}" data-tooltip="Post this clip">
          <input type="checkbox" data-clips-select="${c.id}" ${c.selected ? "checked" : ""} /><i></i>
        </label>
        <button type="button" class="clips-bin__open" data-clips-watch="${c.id}" aria-label="Watch clip ${i + 1}: ${escapeHtml(c.title)}">
          <span class="clips-bin__thumb">${previewMarkup(v, { ...c, ratio: "9:16" }, { captions: false })}</span>
          <span class="clips-bin__text">
            <span class="clips-bin__meta"><span class="clips-bin__num">${i + 1}</span>${fmtMs(c.endMs - c.startMs)}</span>
            <span class="clips-bin__title">${escapeHtml(c.title)}</span>
          </span>
        </button>
      </li>`,
    )
    .join("");
  return `
    <div class="clips-ws">
      <aside class="clips-bin" aria-label="Clips">
        <header class="clips-bin__head">
          <label class="ap-checkbox-container" aria-label="Post every clip">
            <input type="checkbox" data-clips-select-all ${all ? "checked" : ""} /><i></i><span>Clips</span>
          </label>
          <button type="button" class="ap-button ghost grey" data-clips-add-clip data-tooltip="A new 30-second clip after this one — set its range in the editor">
            <i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span>
          </button>
        </header>
        <p class="clips-bin__hint">Tick the clips to turn into posts. Click one to open it.</p>
        <ol class="clips-bin__list">${rows}</ol>
      </aside>
      <section class="clips-clip" aria-label="The clip" data-clips-monitors>
        <video class="clips-preview__video" data-clips-src playsinline preload="auto" src="${escapeHtml(v.url)}"></video>
        <div class="clips-clip__player">
          <div class="clips-clip__body" data-clips-program></div>
          <div class="clips-transport">
            <button type="button" class="ap-icon-button stroked" data-clips-ws="play" aria-label="Play the clip" data-tooltip="Play / pause (Space)"><i class="ap-icon-play" aria-hidden="true" data-clips-play-icon></i></button>
            <input type="range" class="ap-slider clips-transport__scrub" min="0" max="1000" step="1" value="0" data-clips-clip-scrub aria-label="Position in the clip" />
            <span class="clips-transport__tc"><span data-clips-clip-tc>0:00</span> / <span data-clips-clip-len>0:00</span></span>
          </div>
        </div>
        <aside class="clips-inspector" aria-label="About this clip" data-clips-focus-info></aside>
      </section>
    </div>`;
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
        <div class="clips-monitor__screen" data-clips-prog-screen>
          <canvas data-clips-prog></canvas>
          ${cap.presetId !== "none" ? `<span class="clips-preview__caption"><span class="cap-ed-preview-${escapeHtml(cap.presetId)}">${escapeHtml(line)}</span></span>` : ""}
        </div>`;
  const info = target.querySelector("[data-clips-focus-info]");
  if (info)
    info.innerHTML = `
      <h2 class="clips-inspector__title">${escapeHtml(c.title)}</h2>
      <p class="clips-inspector__of">Clip ${i + 1} of ${v.clips.length} · ${escapeHtml(formatLabel(ratio))} · ${fmtMs(c.endMs - c.startMs)}</p>
      <div class="clips-place" aria-label="${fmtMs(c.startMs)} to ${fmtMs(c.endMs)} in the video">
        <div class="clips-place__track"><span class="clips-place__clip" style="left:${(c.startMs / v.durationMs) * 100}%;width:max(3px, ${((c.endMs - c.startMs) / v.durationMs) * 100}%)"></span></div>
        <span class="clips-place__label">${fmtMs(c.startMs)} → ${fmtMs(c.endMs)} in the ${fmtMs(v.durationMs)} video</span>
      </div>
      <div class="clips-inspector__actions">
        <a class="ap-button stroked blue" href="#/clips/${v.id}/edit/${c.id}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span></a>
        <details class="clips-more">
          <summary class="ap-icon-button transparent" aria-label="More actions for this clip" data-tooltip="More"><i class="ap-icon-more" aria-hidden="true"></i></summary>
          <div class="ap-action-dropdown clips-more__menu" role="menu">
            <button type="button" role="menuitem" class="ap-action-dropdown-item red-mode" data-clips-ws="remove">
              <i class="ap-icon-trash" aria-hidden="true"></i>
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container">
                <span class="ap-action-dropdown-item-label">Remove this clip</span>
              </div></div>
            </button>
          </div>
        </details>
      </div>
      ${c.why ? `<div class="clips-inspector__why"><span class="clips-inspector__label">Why this clip</span><p>${escapeHtml(c.why)}</p></div>` : ""}
      <div class="clips-inspector__controls">
        <span class="clips-inspector__label">How it looks</span>
        ${dsSelect({
          label: "Format",
          valueHtml: escapeHtml(c.ratio ? formatLabel(c.ratio) : `Video's · ${formatLabel(v.settings.ratio)}`),
          current: c.ratio || "video",
          attr: "data-clips-clip-ratio",
          options: [
            { id: "video", label: `Same as the video · ${formatLabel(v.settings.ratio)}` },
            ...RATIO_IDS.map((id) => ({ id, label: formatLabel(id), meta: bestFor(id) })),
          ],
        })}
        ${dsSelect({
          label: "Subtitles",
          valueHtml: escapeHtml(
            c.captionCustom ? presetLabel(cap.presetId) : `Video's · ${presetLabel(v.settings.subtitlePreset)}`,
          ),
          current: c.captionCustom ? cap.presetId : "video",
          attr: "data-clips-clip-preset",
          options: [
            { id: "video", label: `Same as the video · ${presetLabel(v.settings.subtitlePreset)}` },
            ...SUBTITLE_IDS.map((id) => ({ id, label: presetLabel(id) })),
          ],
        })}
      </div>`;
  const len = target.querySelector("[data-clips-clip-len]");
  if (len) len.textContent = fmtMs(c.endMs - c.startMs);
  target
    .querySelectorAll("[data-clips-focus]")
    .forEach((n) => n.classList.toggle("is-focused", n.dataset.clipsFocus === c.id));
  sizeProgram();
  paintProgram(v);
}

// The clip's picture takes the room it can at its own format — the tallest
// that fits beside its details — so the details sit right against it, and no
// black bars fill the space between.
function sizeProgram() {
  const v = getVideo(videoId);
  const c = v && focused(v);
  const section = target?.querySelector("[data-clips-monitors]");
  const body = target?.querySelector("[data-clips-program]");
  const screen = target?.querySelector("[data-clips-prog-screen]");
  const info = target?.querySelector("[data-clips-focus-info]");
  if (!c || !section || !body || !screen || !info) return;
  const cs = getComputedStyle(section);
  const availW =
    section.clientWidth -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight) -
    info.offsetWidth -
    (parseFloat(cs.columnGap) || 0);
  const aspect = ratioOf(clipRatioId(v, c));
  const w = Math.max(160, Math.min(availW, body.clientHeight * aspect));
  const h = w / aspect;
  screen.style.width = `${Math.round(w)}px`;
  screen.style.height = `${Math.round(h)}px`;
  const canvas = target.querySelector("[data-clips-prog]");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
}

function mountWorkspace(v) {
  const video = target.querySelector("[data-clips-src]");
  if (!video) return;
  // The source lands on the clip in the monitors — whichever it is by the
  // time the (long) video's metadata arrives.
  video.addEventListener("loadedmetadata", () => {
    const c = focused(v);
    if (c) video.currentTime = c.startMs / 1000 + 0.05;
  });
  video.addEventListener("seeked", () => !ws.playing && syncClock(v));
  video.addEventListener("loadeddata", () => syncClock(v));
  paintFocus(v);
  const ro = new ResizeObserver(() => {
    sizeProgram();
    paintProgram(v);
  });
  ro.observe(target.querySelector("[data-clips-monitors]"));
  disposers.push(() => ro.disconnect());
  syncClock(v);
}

function paintProgram(v) {
  const canvas = target?.querySelector("[data-clips-prog]");
  const video = target?.querySelector("[data-clips-src]");
  const c = focused(v);
  if (!canvas || !video || !c) return;
  const t = video.currentTime * 1000;
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

// One clock for the picture, the timecode and the clip's scrubber.
function syncClock(v) {
  const video = target?.querySelector("[data-clips-src]");
  if (!video) return;
  const c = focused(v);
  // Until the source can seek, the playhead stands where it is going: the
  // focused clip's start.
  const t = video.readyState >= 1 ? video.currentTime * 1000 : c?.startMs || 0;
  const ctc = target.querySelector("[data-clips-clip-tc]");
  if (ctc && c) ctc.textContent = fmtMs(Math.max(0, Math.min(c.endMs, t) - c.startMs));
  const scrub = target.querySelector("[data-clips-clip-scrub]");
  if (scrub && c) {
    const len = c.endMs - c.startMs;
    scrub.max = String(len);
    scrub.value = String(Math.max(0, Math.min(len, t - c.startMs)));
    scrub.style.setProperty("--fill", `${(scrub.value / len) * 100}%`);
  }
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

// Focusing a clip moves the playhead to its start at once — the source
// follows as soon as it can seek.
function focusClip(v, id, { seek = true } = {}) {
  stopPlayback();
  ws.focusId = id;
  paintFocus(v);
  const c = focused(v);
  const video = target.querySelector("[data-clips-src]");
  if (seek && c && video && video.readyState >= 1) video.currentTime = c.startMs / 1000 + 0.05;
  syncClock(v);
  target
    .querySelector(`[data-clips-focus="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
        <button type="button" class="ap-button primary orange" data-clips-schedule-all ${toSchedule.length ? "" : "disabled"}>
          <i class="ap-icon-calendar" aria-hidden="true"></i><span>Schedule ${toSchedule.length || ""}</span>
        </button>
      </div>
    </div>
    <div class="clips-drafts posts">
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
          ${clips.length} clip${clips.length === 1 ? "" : "s"} to post. One draft per clip and account${pb ? `, written in ${escapeHtml(pb.name)}'s voice` : ""}.
        </p>
      </header>
      <div class="clips-setup__group">
        <h3 class="clips-setup__label">How the clips look</h3>
        <p class="clips-setup__hint">For every clip — a clip that has its own format or subtitles keeps them.</p>
        <div class="clips-setup__looks">
          ${formatSelect(v.settings.ratio)}
          ${subtitleSelect(v.settings.subtitlePreset)}
        </div>
      </div>
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
        <button type="button" class="ap-button ghost grey" data-clips-setup-cancel>Cancel</button>
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
  // The clip's ⋯ menu closes on any click outside it, and after its item.
  (target || document).querySelectorAll("details.clips-more[open]").forEach((d) => {
    if (!d.contains(t) || t.closest("[role=menuitem]")) d.removeAttribute("open");
  });

  const tabBtn = t.closest("[data-clips-tab]");
  if (tabBtn) return setHashQuery(path(), tabBtn.dataset.clipsTab === "drafts" ? { tab: "drafts" } : {});

  const clipRatio = t.closest("[data-clips-clip-ratio]");
  if (clipRatio) {
    clipRatio.closest("details")?.removeAttribute("open");
    const id = clipRatio.dataset.clipsClipRatio;
    return updateClip(v.id, ws.focusId, { ratio: id === "video" ? null : id });
  }
  const clipPreset = t.closest("[data-clips-clip-preset]");
  if (clipPreset) {
    clipPreset.closest("details")?.removeAttribute("open");
    const id = clipPreset.dataset.clipsClipPreset;
    return updateClip(
      v.id,
      ws.focusId,
      id === "video"
        ? { captionState: null, captionCustom: false }
        : { captionState: captionStateFor(id), captionCustom: true },
    );
  }
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
  if (wsAct === "remove") {
    // Destructive, and the product has no undo: the DS confirm modal is the
    // safeguard, labelled with the verb.
    const id = ws.focusId;
    openConfirm({
      title: "Remove this clip?",
      body: "It leaves this video's clips. Drafts already written from it stay.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      danger: true,
      onConfirm: () => removeClip(v.id, id),
    });
    return undefined;
  }
  const watch = t.closest("[data-clips-watch]");
  if (watch) return focusClip(v, watch.dataset.clipsWatch);

  if (t.closest("[data-clips-add-clip]")) {
    // A 30 s range right after the open clip, opened in the editor to set it.
    const at = focused(v)?.endMs || 0;
    const startMs = Math.min(v.durationMs - 30000, at);
    const clip = addClip(v.id, { startMs: Math.max(0, startMs), endMs: Math.max(0, startMs) + 30000 });
    return navigate(`/clips/${v.id}/edit/${clip.id}`);
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
    // No drafts yet: back to the clips; otherwise the drafts stay in view.
    if (!getPosts(draftKey(v.id)).length) return setHashQuery(path(), { tab: "clips" });
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
    const id = del.dataset.postDelete;
    openConfirm({
      title: "Delete this draft?",
      body: "The post and its text are gone for good; the clip stays.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
      onConfirm: () => removePost(key, id),
    });
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

// The clip's scrubber: a position inside the clip, nowhere else.
function onInput(e) {
  if (!e.target.matches("[data-clips-clip-scrub]")) return;
  const v = getVideo(videoId);
  const c = v && focused(v);
  const video = target.querySelector("[data-clips-src]");
  if (!c || !video) return;
  stopPlayback();
  if (video.readyState >= 1) video.currentTime = (c.startMs + Number(e.target.value)) / 1000;
  syncClock(v);
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
