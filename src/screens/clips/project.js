// /clips/:id — one video's project in the Clips space (flag clipsSpace).
//
// Prod's order, as screens instead of chips (content/studio … video-clips.ts):
// the analysis runs as soon as the video is added; then the moments, which the
// user reviews and picks; the options of the whole video (format, subtitles —
// set_clip_options) apply live to every preview; then the accounts and the
// CTA, and one draft per clip × account, written here and scheduled from here.
// Tabs: Clips · Drafts (?tab=drafts).

import { navigate } from "../../router.js?v=2786";
import { isFlagOn } from "../../feature-flags.js?v=2786";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=2786";
import { renderTopbar, setTopbarActions, renderIconBack } from "../../components/topbar.js?v=2786";
import { showToast } from "../../components/toast.js?v=2786";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2786";
import { open as openClipRange } from "../../components/clip-range-modal.js?v=2786";
import { requireNetworkVoicesInDialog } from "../../components/network-voice-modal.js?v=2786";
import { startRewrite } from "../../draft-rewrite.js?v=2786";
import { draftVoice, voiceChangedAt } from "../../voice-parts.js?v=2786";
import { renderPostCard } from "../../components/post-card.js?v=2786";
import { open as openScheduleModal } from "../../components/schedule-modal.js?v=2786";
import { open as openConnectAccountModal } from "../../components/connect-account-modal.js?v=2786";
import { connectableNetworkCards, accountIdsForNetwork } from "../../connect-profiles-flow.js?v=2786";
import { getConnectedProfiles, renderProfileTag, NETWORK_LABEL } from "../../social-profiles.js?v=2786";
import { getContextById, subscribe as subscribeContexts } from "../../contexts-store.js?v=2786";
import { framingContext, resolve, segmentAt, drawOutput } from "../../clip-framing.js?v=2786";
import { buildTranscript } from "../../clip-captions.js?v=2786";
import {
  getPosts,
  addPostDraft,
  removePost,
  updatePostContent,
  subscribe as subscribePosts,
} from "../../posts-store.js?v=2786";
import { escapeHtml, plural } from "../../utils.js?v=2786";
import {
  getVideo,
  draftKey,
  updateSettings,
  addClip,
  removeClip,
  ANALYSIS_STAGES,
  subscribe as subscribeVideos,
  retryAnalysis,
  reviewClip,
} from "../../videos-store.js?v=2786";
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
  confirmRemoveVideo,
} from "./shared.js?v=2786";

let target = null;
let videoId = null;
let signature = "";
let disposePreviews = null;
const disposers = [];
// The Drafts tab's own state: the account / CTA picks, and whether the setup
// is showing over drafts that already exist ("Write more drafts").
// The « Write the posts » step, in prod's order (platform: set_clip_options
// then the account picker): one aspect ratio and one subtitle style for the
// whole run (the video's settings), the CTA, then the accounts — none ticked
// at first. Plus which clip × account the preview shows, and the run's stage.
const draftSetup = {
  accounts: null,
  cta: "none",
  open: false,
  writing: false,
};
// The workspace: the clip in the monitors, and the source monitor's clock.
const ws = { focusId: null, playing: false, raf: 0, scrub: false };

// The editor's "Write a post": land on the Drafts tab with the setup open for
// the clip just edited (the editor has already selected it alone).
export function primeDraftSetup(id) {
  videoId = id;
  Object.assign(draftSetup, {
    accounts: null,
    cta: "none",
    open: true,
    writing: false,
  });
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
  document.addEventListener("keydown", onKeyDown);
  topbar?.addEventListener("click", onClick);
  disposers.push(
    subscribeVideos(onStore),
    subscribePosts(draftKey(video.id), () => tab() === "drafts" && paint()),
    // A voice changed: the drafts' voice status repaints (Rewrite it).
    subscribeContexts(() => tab() === "drafts" && paint()),
    bindSelectDismiss(el),
    bindSelectDismiss(topbar),
  );
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("change", onChange);
    el.removeEventListener("input", onInput);
    document.removeEventListener("keydown", onKeyDown);
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
  if (v.status === "failed") return;
  if (v.status !== "analyzing") {
    // A clip's own format or subtitles changed in the inspector, or a tick.
    if (tab() === "clips") paintFocus(v);
    // The draft setup counts and previews the ticked clips: it repaints.
    else return paint();
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

// A decision patches the page in place — a repaint would reload every
// preview's stream in the strip.
const reviewState = (c) => (!c.reviewed ? "todo" : c.selected ? "keep" : "skip");
const REVIEW_LABEL = { todo: "to review", keep: "kept", skip: "skipped" };

function patchSelection(v) {
  const n = v.clips.filter((c) => c.selected).length;
  const skipped = v.clips.filter((c) => c.reviewed && !c.selected).length;
  const todo = v.clips.length - n - skipped;
  v.clips.forEach((c, i) => {
    const thumb = target.querySelector(`[data-clips-watch="${CSS.escape(c.id)}"]`);
    if (!thumb) return;
    const st = reviewState(c);
    thumb.classList.remove("is-todo", "is-keep", "is-skip");
    thumb.classList.add(`is-${st}`);
    thumb.setAttribute("aria-label", `Clip ${i + 1}: ${c.title}, ${REVIEW_LABEL[st]}`);
  });
  const sum = target.querySelector("[data-clips-review-count]");
  if (sum) sum.textContent = [`${n} kept`, `${skipped} skipped`, `${todo} to review`].join(" · ");
  const cta = target.querySelector("[data-clips-to-drafts]");
  if (cta) {
    cta.disabled = !n;
    cta.querySelector("[data-clips-cta-label]").textContent = ctaLabel(n);
  }
  const step = target.querySelector("[data-clips-step-count]");
  if (step) step.textContent = `${n} kept`;
}

const ctaLabel = (n) => (n ? `Write posts for ${n} clip${n === 1 ? "" : "s"}` : "Keep a clip to post it");

// The topbar names the video and leads back. Its right side holds the video's
// own settings — the look of every clip that has none of its own (a clip
// overrides it in its panel or the editor) — then, on step 1, the page's next
// step (O3: the page's primary, rightmost), counted in clips.
function paintTopbarActions(v) {
  const look =
    v.status === "ready"
      ? `<div class="clips-topbar-look" role="group" aria-label="Every clip's look, unless it has its own">
          <span class="clips-topbar-look__label">All clips</span>
          ${formatSelect(v.settings.ratio)}
          ${subtitleSelect(v.settings.subtitlePreset)}
        </div>`
      : "";
  const right = look ? `<div class="clips-topbar-actions">${look}</div>` : "<span></span>";
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
  if (v.status !== "ready") {
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
          ${stepButton("clips", 1, "Review the clips", `<span data-clips-step-count>${v.clips.filter((c) => c.selected).length} kept</span>`, t)}
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

// The analysis screen also says a failure: where it stopped (the step marked,
// the earlier ones done), why, and the two ways out — Try again (the page's one
// step, primary blue) and Remove this video (confirm modal).
function renderAnalyzing(v) {
  const failed = v.status === "failed";
  const at = Math.max(0, ANALYSIS_STAGES.indexOf(failed ? v.failure?.stage : v.stage));
  const pct = Math.round(v.progress * 100);
  const n = v.durationMs > 600000 ? 10 : 3;
  const steps = ANALYSIS_STAGES.map(
    (
      s,
      i,
    ) => `<li class="clips-analyzing__step${i < at ? " is-done" : ""}${i === at ? (failed ? " is-failed" : " is-current") : ""}" data-clips-stage>
      <span class="clips-analyzing__dot" aria-hidden="true"><i class="${i === at && failed ? "ap-icon-close" : "ap-icon-check"}"></i></span>${s}${i === at && failed ? ` <span class="clips-analyzing__stopped">· stopped here</span>` : ""}
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
            ${
              failed
                ? `<h2 class="clips-analyzing__title">I couldn't analyze this video</h2>
                   <p class="ap-form-message error clips-analyzing__error" role="alert">${escapeHtml(v.failure?.reason || "")}</p>`
                : `<h2 class="clips-analyzing__title">Finding the best moments</h2>
            <p class="clips-analyzing__sub">
              ${fmtMs(v.durationMs)} of video, so I'll cut ${n} clips. You can leave this page: the analysis keeps going
              and the video waits for you in Clips.
            </p>
            <span class="clips-progress">
              <span class="clips-progress__track"><span class="clips-progress__fill" style="width:${pct}%"></span></span>
              <span class="clips-progress__label">${pct}%</span>
            </span>`
            }
            <ol class="clips-analyzing__steps">${steps}</ol>
            ${
              failed
                ? `<div class="clips-analyzing__actions">
                     <button type="button" class="ap-button primary blue" data-clips-retry><i class="ap-icon-refresh" aria-hidden="true"></i><span>Try again</span></button>
                     <button type="button" class="ap-button ghost grey" data-clips-remove-video><span>Remove this video</span></button>
                   </div>`
                : ""
            }
          </div>
        </section>
        ${
          failed
            ? ""
            : `<section class="clips-coming" aria-label="What you'll get">
          <div class="clips-coming__head">
            <h3 class="clips-coming__title">Your ${n} clips land here</h3>
            <p class="clips-coming__sub">Each one vertical, framed on the speakers and subtitled. Then you pick the ones to post, polish them, and I write the posts.</p>
          </div>
          <ol class="clips-coming__slots" style="--n:${n}" aria-hidden="true">${Array.from(
            { length: n },
            (_, i) => `<li class="clips-coming__slot" style="--i:${i}"><span>${i + 1}</span></li>`,
          ).join("")}</ol>
        </section>`
        }
      </div>
    </div>`;
}

// ── The review: one clip at a time ───────────────────────────────────
// The open clip plays large on the stage (grey-150, the viewer), its details
// and the two verbs beside it — Keep or Skip — and its words under them. The
// strip at the foot holds every clip, each saying kept / skipped / to review,
// and the step's way out: Write posts for the kept ones. A decision moves on
// to the next clip still to review. Keys: K keep · X skip · ← → · Space.
// A hidden <video> (the long one) feeds the clip's canvas.

const focused = (v) => v.clips.find((c) => c.id === ws.focusId) || v.clips[0] || null;

function renderWorkspace(v) {
  if (!v.clips.length) {
    return `<div class="clips-view__page"><div class="clips-list__none"><p>No clips left.</p>
      <button type="button" class="ap-button ghost blue" data-clips-add-clip><i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span></button></div></div>`;
  }
  const thumbs = v.clips
    .map((c, i) => {
      const st = reviewState(c);
      return `<li class="clips-review__film-item">
        <button type="button" class="clips-review__thumb is-${st}" data-clips-watch="${escapeHtml(c.id)}" aria-label="Clip ${i + 1}: ${escapeHtml(c.title)}, ${REVIEW_LABEL[st]}" ${c.id === ws.focusId ? 'aria-current="true"' : ""} data-tooltip="${escapeHtml(c.title)}">
          ${previewMarkup(v, { ...c, ratio: "9:16" }, { captions: false })}
          <span class="clips-review__badge" aria-hidden="true"><i class="ap-icon-check"></i></span>
          <span class="clips-review__num" aria-hidden="true">${i + 1}</span>
        </button>
      </li>`;
    })
    .join("");
  return `
    <div class="clips-review">
      <section class="clips-review__stage clips-clip" aria-label="The clip" data-clips-monitors>
        <video class="clips-preview__video" data-clips-src playsinline preload="auto" src="${escapeHtml(v.url)}"></video>
        <div class="clips-review__program" data-clips-program></div>
        <div class="clips-transport clips-review__transport">
          <button type="button" class="ap-icon-button stroked" data-clips-ws="play" aria-label="Play the clip" data-tooltip="Play / pause (Space)"><i class="ap-icon-play" aria-hidden="true" data-clips-play-icon></i></button>
          <input type="range" class="ap-slider clips-transport__scrub" min="0" max="1000" step="1" value="0" data-clips-clip-scrub aria-label="Position in the clip" aria-valuetext="0:00 of 0:00" />
          <span class="clips-transport__tc"><span data-clips-clip-tc>0:00</span> / <span data-clips-clip-len>0:00</span></span>
        </div>
      </section>
      <aside class="clips-review__side" aria-label="About this clip" data-clips-focus-info></aside>
      <footer class="clips-review__strip">
        <ol class="clips-review__film" aria-label="Clips">${thumbs}
          <li class="clips-review__film-item">
            <button type="button" class="clips-review__add" data-clips-add-clip aria-label="Add a clip" data-tooltip="A new clip: you pick where it starts and ends"><i class="ap-icon-plus" aria-hidden="true"></i></button>
          </li>
        </ol>
        <div class="clips-review__sum">
          <span class="clips-review__count" data-clips-review-count aria-live="polite"></span>
          <button type="button" class="ap-button primary orange" data-clips-to-drafts>
            <i class="ap-icon-archie-official" aria-hidden="true"></i><span data-clips-cta-label></span>
          </button>
        </div>
      </footer>
    </div>`;
}

// The open clip: its picture on the stage, its details and words beside it.
function paintFocus(v) {
  const c = focused(v);
  if (!c) return;
  const i = v.clips.indexOf(c);
  const cap = clipCaptionState(v, c);
  const line = (c.summary || c.title || "").split(/\s+/).slice(0, 4).join(" ");
  const prog = target.querySelector("[data-clips-program]");
  if (prog)
    prog.innerHTML = `
        <div class="clips-monitor__screen" data-clips-prog-screen>
          <canvas data-clips-prog></canvas>
          ${cap.presetId !== "none" ? `<span class="clips-preview__caption"><span class="cap-ed-preview-${escapeHtml(cap.presetId)}">${escapeHtml(line)}</span></span>` : ""}
        </div>`;
  const st = reviewState(c);
  const status =
    st === "keep"
      ? `<span class="ap-status green">Kept</span>`
      : st === "skip"
        ? `<span class="ap-status grey">Skipped</span>`
        : "";
  // Its words, from the clip's transcript (edited in the editor) or built from
  // its text — a click plays from that word.
  const words = (
    c.transcript ||
    buildTranscript({
      id: c.id,
      start: c.startMs / 1000,
      end: c.endMs / 1000,
      title: c.title,
      summary: c.summary,
      why: c.why,
    })
  ).filter((w) => !w.removed);
  const info = target.querySelector("[data-clips-focus-info]");
  if (info)
    info.innerHTML = `
      <p class="clips-review__of"><span>Clip ${i + 1} of ${v.clips.length} · ${fmtMs(c.endMs - c.startMs)} · ${fmtMs(c.startMs)} → ${fmtMs(c.endMs)} in the video</span>${status}</p>
      <div class="clips-review__head">
        <h2 class="clips-review__title">${escapeHtml(c.title)}</h2>
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
      ${
        c.why
          ? `<div class="clips-inspector__why">
              <i class="ap-icon-archie-official" aria-hidden="true"></i>
              <div><span class="clips-inspector__label">Why I picked it</span><p>${escapeHtml(c.why)}</p></div>
            </div>`
          : ""
      }
      <div class="clips-review__decide">
        <button type="button" class="ap-button primary blue" data-clips-review="keep" aria-pressed="${st === "keep"}" data-tooltip="Keep it to post it (K)"><i class="ap-icon-check" aria-hidden="true"></i><span>Keep</span></button>
        <button type="button" class="ap-button stroked grey" data-clips-review="skip" aria-pressed="${st === "skip"}" data-tooltip="Leave it out (X)"><span>Skip</span></button>
        <a class="ap-button ghost grey" href="#/clips/${v.id}/edit/${c.id}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span></a>
      </div>
      <p class="clips-review__keys">K keeps, X skips, ← → move between clips.</p>
      <section class="clips-review__words" aria-labelledby="clips-review-words-title">
        <h3 class="clips-inspector__label" id="clips-review-words-title">Transcript</h3>
        <p class="clips-review__transcript" data-clips-transcript>${words
          .map(
            (w) =>
              `<span class="clips-review__w" data-clips-word="${w.start}" data-end="${w.end}">${escapeHtml(w.text)}</span>`,
          )
          .join(" ")}</p>
        <p class="clips-review__keys">Click a word to play from it. Fix a word in the editor.</p>
      </section>`;
  const len = target.querySelector("[data-clips-clip-len]");
  if (len) len.textContent = fmtMs(c.endMs - c.startMs);
  target
    .querySelectorAll("[data-clips-watch]")
    .forEach((b) => b.toggleAttribute("aria-current", b.dataset.clipsWatch === c.id));
  sizeProgram();
  paintProgram(v);
}

// The clip's picture takes the room the stage gives it, at its own format.
function sizeProgram() {
  const v = getVideo(videoId);
  const c = v && focused(v);
  const body = target?.querySelector("[data-clips-program]");
  const screen = target?.querySelector("[data-clips-prog-screen]");
  if (!c || !body || !screen) return;
  const aspect = ratioOf(clipRatioId(v, c));
  const w = Math.max(160, Math.min(body.clientWidth, body.clientHeight * aspect));
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
    scrub.setAttribute("aria-valuetext", `${fmtMs(Number(scrub.value))} of ${fmtMs(len)}`);
  }
  // The words follow the playhead: said, being said, to come.
  if (c) {
    const sec = (t - c.startMs) / 1000;
    target.querySelectorAll("[data-clips-word]").forEach((w) => {
      const start = Number(w.dataset.clipsWord);
      w.classList.toggle("is-past", Number(w.dataset.end) <= sec);
      w.classList.toggle("is-now", start <= sec && sec < Number(w.dataset.end));
    });
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
    .querySelector(`[data-clips-watch="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

// ── Drafts ───────────────────────────────────────────────────────────

function renderDrafts(v, posts) {
  if (draftSetup.writing) {
    // Prod's two jobs: the clips are rendered (crop + subtitles burned), then
    // the posts are written — one per clip × account.
    const w = draftSetup.writing;
    const stage = (id, label) => {
      const state = w.stage === id ? "is-current" : w.stage === "write" && id === "render" ? "is-done" : "";
      return `<li class="clips-drafts__stage ${state}">${
        state === "is-done"
          ? `<i class="ap-icon-check" aria-hidden="true"></i>`
          : state
            ? `<span class="ap-loader" aria-hidden="true"></span>`
            : `<span class="clips-drafts__stage-dot"></span>`
      }<span>${label}</span></li>`;
    };
    return `<div class="clips-drafts__writing" role="status">
      <h2 class="clips-drafts__writing-title">Turning ${w.clips} clip${w.clips === 1 ? "" : "s"} into ${w.posts} post${w.posts === 1 ? "" : "s"}</h2>
      <p class="clips-drafts__writing-sub">They land on this page as drafts, ready to schedule. Nothing gets published.</p>
      <ol class="clips-drafts__stages">
        ${stage("render", `Rendering ${w.clips} clip${w.clips === 1 ? "" : "s"}: ${escapeHtml(w.look)}`)}
        ${stage("write", `Writing ${w.posts} post${w.posts === 1 ? "" : "s"} from the clips`)}
      </ol>
    </div>`;
  }
  if (!posts.length || draftSetup.open) return renderDraftSetup(v, posts.length > 0);
  const toSchedule = posts.filter((p) => p.status !== "scheduled");
  return `
    <div class="clips-toolbar">
      <div class="clips-toolbar__head">
        <h2 class="clips-toolbar__title">${
          toSchedule.length
            ? `${toSchedule.length} draft${toSchedule.length === 1 ? "" : "s"} ready to schedule`
            : `All ${posts.length} draft${posts.length === 1 ? " is" : "s are"} scheduled`
        }</h2>
        <p class="clips-toolbar__count">One post per clip and account${
          posts.length - toSchedule.length ? `, ${posts.length - toSchedule.length} already scheduled` : ""
        }. Change a video with Edit clip, then schedule them from here.</p>
      </div>
      <div class="clips-toolbar__actions">
        <button type="button" class="ap-button stroked grey" data-clips-more-drafts>
          <i class="ap-icon-plus" aria-hidden="true"></i><span>Write more drafts</span>
        </button>
        <button type="button" class="ap-button primary orange" data-clips-schedule-all ${toSchedule.length ? "" : "disabled"}>
          <i class="ap-icon-calendar" aria-hidden="true"></i><span>Schedule ${toSchedule.length || ""}</span>
        </button>
      </div>
    </div>
    ${draftGroups(v, posts)}`;
}

// The drafts, grouped by the clip they come from (in the video's order): the
// clip names its group and leads to the editor; each draft is the real post
// card, its account, its status. A draft whose clip is gone groups last.
function draftGroups(v, posts) {
  const pb = getContextById(v.contextId);
  const byClip = new Map();
  for (const p of posts) {
    const id = p.clipRef?.clipId;
    const key = v.clips.some((c) => c.id === id) ? id : "";
    if (!byClip.has(key)) byClip.set(key, []);
    byClip.get(key).push(p);
  }
  const order = [...v.clips.map((c) => c.id).filter((id) => byClip.has(id)), ...(byClip.has("") ? [""] : [])];
  return order
    .map((id) => {
      const group = byClip.get(id);
      const i = v.clips.findIndex((c) => c.id === id);
      const c = v.clips[i];
      const scheduled = group.filter((p) => p.status === "scheduled").length;
      const head = c
        ? `<h3 class="clips-group__title"><span class="clips-group__num">Clip ${i + 1}</span>${escapeHtml(c.title)}</h3>
           <span class="clips-group__meta">${fmtMs(c.endMs - c.startMs)} · ${plural(group.length, "draft")}${scheduled ? ` · ${scheduled} scheduled` : ""}</span>
           <a class="ap-button ghost grey clips-group__edit" href="#/clips/${v.id}/edit/${c.id}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span></a>`
        : `<h3 class="clips-group__title">From a removed clip</h3>
           <span class="clips-group__meta">${plural(group.length, "draft")}</span>`;
      return `<section class="clips-group" aria-label="${escapeHtml(c ? `Clip ${i + 1}: ${c.title}` : "From a removed clip")}">
        <header class="clips-group__head">${head}</header>
        <div class="clips-drafts posts">${group.map((p) => renderDraft(p, pb)).join("")}</div>
      </section>`;
    })
    .join("");
}

// A scheduled draft stays in the list, said so above its card — this space is
// where the video's whole output is read, scheduled or not.
function renderDraft(p, pb) {
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
    ${renderPostCard(p, {
      railActions: scheduled ? ["delete"] : ["schedule", "delete"],
      // Which voice wrote it, and the way to its Playbook.
      playbookId: pb?.id || null,
      voice: draftVoice(pb, p.network),
      voiceStale: !!pb && voiceChangedAt(pb, p.network) > (p.writtenAt || 0),
    })}
  </div>`;
}

// The format of a clip's posts: the clip's own if it has one (set in the
// editor), else the run's one aspect ratio — every account gets the same, as
// in prod.
function postFormat(v, clip) {
  return clip.ratio || v.settings.ratio;
}

// « Write the posts »: one column, read top to bottom in prod's order — the
// clips kept at the review, how they render, how the post ends, the accounts —
// then the bar with the count and the action. No preview before writing (it
// showed a draft that didn't exist): the drafts themselves land on this page.
function renderDraftSetup(v, hasDrafts) {
  const clips = v.clips.filter((c) => c.selected);
  const profiles = getConnectedProfiles();
  // Nothing ticked at first (prod): an account picked before must be picked again.
  if (draftSetup.accounts === null) draftSetup.accounts = new Set();
  const accounts = profiles.filter((p) => draftSetup.accounts.has(p.id));
  const pb = getContextById(v.contextId);
  const count = clips.length * accounts.length;
  // The clips: picked at step 1, summed up here — a strip and their length.
  const totalMs = clips.reduce((n, c) => n + (c.endMs - c.startMs), 0);
  const STRIP = 6;
  const strip = clips
    .slice(0, STRIP)
    .map(
      (c) =>
        `<li class="clips-write__thumb" title="${escapeHtml(c.title)}">${previewMarkup(v, { ...c, ratio: "9:16" }, { captions: false })}</li>`,
    )
    .join("");
  const more = clips.length > STRIP ? `<li class="clips-write__more">+${clips.length - STRIP}</li>` : "";

  // Where: the connected accounts, each with the format its network gets —
  // or, with none, the networks to connect (asked in the flow, never before).
  const accountBlock = profiles.length
    ? `<ul class="clips-write__accounts">${profiles
        .map(
          (p) => `<li><label class="ap-checkbox-container clips-write__account">
            <input type="checkbox" data-clips-account="${escapeHtml(p.id)}" ${draftSetup.accounts.has(p.id) ? "checked" : ""} /><i></i>
            ${renderProfileTag(p)}
            <span class="clips-write__account-meta">${escapeHtml(NETWORK_LABEL[p.platform] || p.platform)}</span>
          </label></li>`,
        )
        .join("")}</ul>`
    : `<p class="clips-write__empty">No account connected yet. Connect one and I write its drafts — nothing is published.</p>
       <div class="clips-write__connect">${connectableNetworkCards()
         .map(
           (n) => `<button type="button" class="ap-button stroked grey" data-clips-connect="${escapeHtml(n.value)}">
             ${n.preview}<span>${escapeHtml(n.label)}</span></button>`,
         )
         .join("")}</div>`;

  // A choice, read top to bottom: the DS radio, its name, what it does.
  const choice = (name, attr, value, checked, label, hint, off = false) => `
    <label class="clips-write__choice${off ? " is-off" : ""}">
      <span class="ap-radio-container"><input type="radio" name="${name}" value="${value}" ${attr} ${checked ? "checked" : ""} ${off ? "disabled" : ""} /></span>
      <span class="clips-write__choice-text"><span class="clips-write__choice-name">${escapeHtml(label)}</span><span class="clips-write__choice-hint">${escapeHtml(hint)}</span></span>
    </label>`;

  // How they render: set at step 1 (the video's look) or on a clip (its own),
  // summed up by look — nothing to choose here.
  const looks = lookGroups(v, clips);

  // How the post ends: the real call to action, said in each option.
  const ctaText = pb?.cta || "";
  const ctaChoices = CTA_OPTIONS.map((o) => {
    const off = o.id !== "none" && !ctaText;
    const hint =
      o.id === "none"
        ? "The post ends on the clip's message."
        : off
          ? "This Playbook has no call to action yet."
          : o.id === "in_post"
            ? `The caption ends with “${ctaText}”`
            : `“${ctaText}” goes in the first comment, where a link doesn't cost reach.`;
    return choice("clips-cta", "data-clips-cta", o.id, draftSetup.cta === o.id, o.label, hint, off);
  }).join("");

  const why = !clips.length
    ? "Keep at least one clip at step 1."
    : !profiles.length
      ? "Connect an account to write the posts."
      : !accounts.length
        ? "Pick one or more accounts."
        : "";

  return `
    <section class="clips-write" aria-labelledby="clips-write-title">
      <header class="clips-write__head">
        <h2 class="clips-write__title" id="clips-write-title">Write posts from ${plural(clips.length, "clip")}</h2>
        <p class="clips-write__sub">I render the clips you kept, then write one post per clip and account${pb ? `, in ${escapeHtml(pb.name)}'s voice` : ""}. Nothing is published: the drafts land on this page, ready to schedule.</p>
      </header>
      <div class="clips-write__form">
          <section class="clips-write__group">
            <div class="clips-write__group-head">
              <h3 class="clips-write__label">Clips</h3>
              <button type="button" class="ap-button ghost blue" data-clips-tab="clips">Change clips</button>
            </div>
            ${
              clips.length
                ? `<ul class="clips-write__strip" aria-label="The clips">${strip}${more}</ul>
                   <p class="clips-write__meta">${plural(clips.length, "clip")} · ${fmtMs(totalMs)} of video</p>`
                : `<p class="clips-write__empty">No clip kept.</p>`
            }
          </section>
          ${
            looks.length
              ? `<section class="clips-write__group">
                  <div class="clips-write__group-head">
                    <h3 class="clips-write__label">How they render</h3>
                    <button type="button" class="ap-button ghost blue" data-clips-tab="clips">Change at step 1</button>
                  </div>
                  <ul class="clips-write__looks">${looks
                    .map(
                      (l) => `<li class="clips-write__look">
                        <span class="clips-write__look-name">${escapeHtml(l.label)}</span>
                        <span class="clips-write__look-meta">${escapeHtml(l.who)}</span>
                      </li>`,
                    )
                    .join("")}</ul>
                </section>`
              : ""
          }
          <section class="clips-write__group">
            <div class="clips-write__group-head"><h3 class="clips-write__label">Call to action</h3></div>
            <div class="clips-write__choices" role="radiogroup" aria-label="Call to action">${ctaChoices}</div>
          </section>
          <section class="clips-write__group">
            <div class="clips-write__group-head"><h3 class="clips-write__label" id="clips-write-accounts">Accounts</h3></div>
            ${profiles.length ? `<p class="clips-write__meta">Pick one or more, across networks. I write one post per clip for each.</p>` : ""}
            ${accountBlock}
          </section>
      </div>
      <footer class="clips-write__bar">
        <p class="clips-write__count">
          ${
            why
              ? `<span class="clips-write__why"><i class="ap-icon-info" aria-hidden="true"></i>${
                  // What blocks the run is one click away: the accounts sit below the fold.
                  accounts.length || !profiles.length || !clips.length
                    ? why
                    : `<button type="button" class="ap-link standalone" data-clips-goto-accounts>${why}</button>`
                }</span>`
              : `<strong>${plural(count, "draft")}</strong><span>${plural(clips.length, "clip")} × ${plural(accounts.length, "account")}</span>`
          }
        </p>
        <div class="clips-write__actions">
          <button type="button" class="ap-button ghost grey" data-clips-setup-cancel>Cancel</button>
          <button type="button" class="ap-button primary orange" data-clips-write ${count ? "" : "disabled"}>
            <i class="ap-icon-archie-official" aria-hidden="true"></i><span>${count ? `Write ${plural(count, "draft")}` : "Write the drafts"}</span>
          </button>
        </div>
      </footer>
    </section>`;
}

// The selected clips grouped by how they render: the format and the subtitles
// each one gets — the video's (step 1) unless the clip has its own.
function lookGroups(v, clips) {
  const groups = new Map();
  clips.forEach((c) => {
    const preset = clipCaptionState(v, c).presetId;
    const label = `${formatLabel(postFormat(v, c))} · ${preset === "none" ? "No subtitles" : `${presetLabel(preset)} subtitles`}`;
    const own = Boolean(c.ratio || c.captionCustom);
    const key = `${label}|${own}`;
    if (!groups.has(key)) groups.set(key, { label, own, nums: [] });
    groups.get(key).nums.push(v.clips.indexOf(c) + 1);
  });
  return [...groups.values()].map((g) => ({
    label: g.label,
    who: g.own
      ? `${g.nums.length === 1 ? "Clip" : "Clips"} ${g.nums.join(", ")} · ${g.nums.length === 1 ? "its" : "their"} own look`
      : `${g.nums.length} clip${g.nums.length === 1 ? "" : "s"} in the video's look`,
  }));
}

// The draft is posted as the account: the preview and the written draft show it.
function accountAuthor(account, pb) {
  return {
    name: account?.name || account?.handle || pb?.brandName || "Your account",
    title: "",
    initials: account?.initials || "AC",
    connection: "1st",
    visibility: "public",
  };
}

function writeDrafts() {
  const v = getVideo(videoId);
  const clips = v.clips.filter((c) => c.selected);
  const accounts = getConnectedProfiles().filter((p) => draftSetup.accounts?.has(p.id));
  if (!clips.length || !accounts.length) return;
  // Every network gets its voice before a word is written
  // — asked in a dialog, the space has no chat.
  requireNetworkVoicesInDialog(
    v.contextId,
    accounts.map((a) => a.platform),
    () => renderAndWrite(v, clips, accounts),
  );
}

function renderAndWrite(v, clips, accounts) {
  const pb = getContextById(v.contextId);
  const key = draftKey(v.id);
  draftSetup.writing = {
    stage: "render",
    clips: clips.length,
    posts: clips.length * accounts.length,
    look: (() => {
      const g = lookGroups(v, clips);
      return g.length === 1 ? g[0].label : `${g.length} looks`;
    })(),
  };
  paint();
  setTimeout(() => {
    draftSetup.writing.stage = "write";
    paint();
  }, 1400);
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
          format: postFormat(v, clip),
          subtitleStyle: clipCaptionState(v, clip).presetId,
        });
        d.author = accountAuthor(a, pb);
        if (pb?.cta && draftSetup.cta === "in_post") d.cta = pb.cta;
        if (pb?.cta && draftSetup.cta === "first_comment") d.firstComment = pb.cta;
      }
    }
    Object.assign(draftSetup, { writing: false, open: false });
    paint();
    const n = clips.length * accounts.length;
    showToast(`${n} draft${n === 1 ? "" : "s"} written`);
  }, 2800);
}

// ── Events ───────────────────────────────────────────────────────────

function onClick(e) {
  const v = getVideo(videoId);
  if (!v) return;
  const t = e.target;
  if (t.closest("[data-clips-retry]")) return retryAnalysis(v.id);
  if (t.closest("[data-clips-remove-video]")) return confirmRemoveVideo(v.id, { onRemoved: () => navigate("/clips") });
  // The clip's ⋯ menu closes on any click outside it, and after its item.
  (target || document).querySelectorAll("details.clips-more[open]").forEach((d) => {
    if (!d.contains(t) || t.closest("[role=menuitem]")) d.removeAttribute("open");
  });

  if (t.closest("[data-clips-goto-accounts]")) {
    const head = target.querySelector("#clips-write-accounts");
    head?.scrollIntoView({ behavior: "smooth", block: "start" });
    head?.closest("section")?.querySelector("input[type=checkbox]")?.focus({ preventScroll: true });
    return;
  }

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
  const decide = t.closest("[data-clips-review]")?.dataset.clipsReview;
  if (decide) return decideClip(v, decide === "keep");
  const word = t.closest("[data-clips-word]");
  if (word) return playFrom(v, Number(word.dataset.clipsWord));

  if (t.closest("[data-clips-add-clip]")) {
    // The range is asked here, once: a clip's start and end are fixed after.
    // The suggestion: 30 s right after the open clip.
    const at = focused(v)?.endMs || 0;
    const startMs = Math.max(0, Math.min(v.durationMs - 30000, at));
    return openClipRange({
      durationMs: v.durationMs,
      startMs,
      endMs: Math.min(v.durationMs, startMs + 30000),
      onSubmit: (range) => {
        const clip = addClip(v.id, range);
        navigate(`/clips/${v.id}/edit/${clip.id}`);
      },
    });
  }

  if (t.closest("[data-clips-to-drafts]")) {
    draftSetup.open = true;
    return setHashQuery(path(), { tab: "drafts" });
  }
  if (t.closest("[data-clips-more-drafts]")) {
    // A new run: its accounts are picked again (prod), nothing carried over.
    Object.assign(draftSetup, { open: true, accounts: null });
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
  // The draft's voice: « Give X its own voice » asks in the Voice dialog;
  // « Rewrite it » rewrites it in its network's voice as it is now.
  const voice = t.closest("[data-post-voice]");
  if (voice)
    return requireNetworkVoicesInDialog(voice.dataset.postVoice, [voice.dataset.postVoiceNet], () => {}, {
      giving: true,
    });
  const rewrite = t.closest("[data-post-voice-rewrite]");
  if (rewrite) return startRewrite(key, rewrite.dataset.postVoiceRewrite, "voice");
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
// The clip list walks with ↑ / ↓ (Home / End): the next clip opens and takes
// the focus, the way a media bin moves in an editor.
// The review's keys, page-wide while step 1 is on screen: K keep, X skip,
// ← → the previous / next clip, Space plays. A field, a modal, or a control
// reached with the keyboard (a button presses, a slider moves) keeps its keys.
function onKeyDown(e) {
  const v = getVideo(videoId);
  if (!v || v.status !== "ready" || tab() !== "clips" || !focused(v)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.body.classList.contains("has-modal")) return;
  const el = e.target;
  if (el.closest?.("input, textarea, select, [contenteditable=true], details[open]")) return;
  const key = e.key.toLowerCase();
  const onControl = el.matches?.(":focus-visible") && el.closest("button, a[href], summary, [tabindex]");
  if ((key === " " || key.startsWith("arrow")) && onControl && !el.closest("[data-clips-watch]")) return;
  if (key === "k" || key === "x") {
    e.preventDefault();
    return decideClip(v, key === "k");
  }
  if (key === "arrowleft" || key === "arrowright") {
    e.preventDefault();
    const i = v.clips.indexOf(focused(v)) + (key === "arrowright" ? 1 : -1);
    const to = v.clips[Math.max(0, Math.min(v.clips.length - 1, i))];
    if (to.id !== ws.focusId) {
      focusClip(v, to.id);
      if (el.closest?.("[data-clips-watch]"))
        target.querySelector(`[data-clips-watch="${CSS.escape(to.id)}"]`)?.focus();
    }
    return undefined;
  }
  if (key === " ") {
    e.preventDefault();
    return playClip(v);
  }
  return undefined;
}

// Keep or Skip the open clip, then move on to the next clip still to review
// (after this one, then from the top); with none left, stay.
function decideClip(v, keep) {
  const c = focused(v);
  if (!c) return;
  reviewClip(v.id, c.id, keep);
  const i = v.clips.indexOf(c);
  const next = [...v.clips.slice(i + 1), ...v.clips.slice(0, i)].find((x) => !x.reviewed);
  if (next) focusClip(v, next.id);
}

function playFrom(v, sec) {
  const c = focused(v);
  const video = target.querySelector("[data-clips-src]");
  if (!c || !video || video.readyState < 1) return;
  stopPlayback();
  video.currentTime = c.startMs / 1000 + sec;
  playClip(v);
}

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
