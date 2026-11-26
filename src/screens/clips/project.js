// /clips/:id — one video's project in the Clips space (flag clipsSpace).
//
// Prod's order, as screens instead of chips (content/studio … video-clips.ts):
// the analysis runs as soon as the video is added; then the moments, which the
// user reviews and picks; the options of the whole video (format, subtitles —
// set_clip_options) apply live to every preview; then the accounts and the
// CTA, and one draft per clip × account, written here and scheduled from here.
// Tabs: Clips · Drafts (?tab=drafts).

import { navigate } from "../../router.js?v=2888";
import { isFlagOn } from "../../feature-flags.js?v=2888";
import { parseHashParams, setHashQuery } from "../../url-state.js?v=2888";
import { renderTopbar, setTopbarActions, renderIconBack } from "../../components/topbar.js?v=2888";
import { showToast } from "../../components/toast.js?v=2888";
import { open as openConfirm } from "../../components/confirm-modal.js?v=2888";
import { open as openTrim, openAdd } from "../../components/clip-trim-modal.js?v=2888";
import { requireNetworkVoicesInDialog } from "../../components/network-voice-modal.js?v=2888";
import { startRewrite } from "../../draft-rewrite.js?v=2888";
import { draftVoice, voiceChangedAt } from "../../voice-parts.js?v=2888";
import { renderPostCard } from "../../components/post-card.js?v=2888";
import { open as openScheduleModal } from "../../components/schedule-modal.js?v=2888";
import { open as openConnectAccountModal } from "../../components/connect-account-modal.js?v=2888";
import { connectableNetworkCards, accountIdsForNetwork } from "../../connect-profiles-flow.js?v=2888";
import { getConnectedProfiles, renderProfileTag, NETWORK_LABEL } from "../../social-profiles.js?v=2888";
import { getContextById, subscribe as subscribeContexts } from "../../contexts-store.js?v=2888";
import { open as openRename } from "../../components/rename-modal.js?v=2888";
import { writePostsInChat } from "../../clips-chat.js?v=2888";
import {
  getPosts,
  addPostDraft,
  removePost,
  updatePostContent,
  subscribe as subscribePosts,
} from "../../posts-store.js?v=2888";
import { escapeHtml, plural } from "../../utils.js?v=2888";
import {
  getVideo,
  draftKey,
  updateSettings,
  addClip,
  removeClip,
  restoreClip,
  dropRequest,
  ANALYSIS_STAGES,
  subscribe as subscribeVideos,
  retryAnalysis,
  reviewClip,
  clipCountFor,
  setSelection,
  askForClips,
  trimClip,
  updateClip,
} from "../../videos-store.js?v=2888";
import {
  fmtMs,
  lookSelect,
  previewMarkup,
  mountPreviews,
  bindSelectDismiss,
  clipRatioId,
  clipCaptionState,
  formatLabel,
  presetLabel,
  CTA_OPTIONS,
  confirmRemoveVideo,
  mediaCard,
  waitingCard,
  chip,
  fact,
  veil,
} from "./shared.js?v=2888";

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
  }
  videoId = video.id;
  renderTopbar();
  paint();
  const topbar = document.getElementById("topbar");
  el.addEventListener("click", onClick);
  el.addEventListener("change", onChange);
  el.addEventListener("submit", onSubmit);
  el.addEventListener("keydown", onAskKey);
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
    el.removeEventListener("submit", onSubmit);
    el.removeEventListener("keydown", onAskKey);
    topbar?.removeEventListener("click", onClick);
    disposers.splice(0).forEach((d) => d());
    disposePreviews?.();
    disposePreviews = null;
    target = null;
  };
}

const tab = () => (parseHashParams().get("tab") === "drafts" ? "drafts" : "clips");
const path = () => `/clips/${videoId}`;
const sig = (v) =>
  `${v.status}:${v.clips.map((c) => `${c.id}${c.startMs}${c.endMs}${c.title}${c.rendering ? "r" : ""}`).join()}:${JSON.stringify(v.settings)}:${(v.requests || []).map((r) => r.status).join()}:${(v.removed || []).length}`;

function onStore() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  if (sig(v) !== signature) return paint();
  if (v.status === "failed") return;
  if (v.status !== "analyzing") {
    // The draft setup counts and previews the ticked clips: it repaints.
    if (tab() !== "clips") return paint();
    return patchSelection(v);
  }
  // The analysis ticks: patch its steps in place (the recap's player keeps
  // playing).
  const steps = target.querySelector("[data-clips-steps]");
  if (steps) steps.innerHTML = runSteps(v);
}

// Keeping a clip patches the page in place — a repaint would reload every
// preview's stream.
function patchSelection(v) {
  const n = kept(v).length;
  for (const c of v.clips) {
    target.querySelector(`[data-clips-card="${CSS.escape(c.id)}"]`)?.classList.toggle("is-kept", c.selected);
    const box = target.querySelector(`[data-clips-keep="${CSS.escape(c.id)}"]`);
    if (box) box.checked = c.selected;
    target.querySelector(`[data-clips-band="${CSS.escape(c.id)}"]`)?.classList.toggle("is-kept", c.selected);
  }
  const num = target.querySelector("[data-clips-kept-n]");
  if (num) num.textContent = String(n);
  const step = target.querySelector("[data-clips-step-count]");
  if (step) step.textContent = `${n} kept`;
  paintTopbarActions(v);
}

const ctaLabel = (n) => (n ? `Write posts with ${plural(n, "clip")}` : "Keep a clip to post it");

// The topbar names the video and leads back. On the clips, its right side
// counts what is kept and holds the page's way out, Write posts (the video's
// look moved to the recap).
function paintTopbarActions(v) {
  const n = v.status === "ready" ? kept(v).length : 0;
  const right =
    v.status === "ready" && tab() === "clips"
      ? `<div class="clips-topbar-actions">
          <button type="button" class="ap-button primary orange" data-clips-to-drafts ${n ? "" : "disabled"}>
            <i class="ap-icon-archie-official" aria-hidden="true"></i><span>${ctaLabel(n)}</span>
          </button>
        </div>`
      : "<span></span>";
  setTopbarActions(`/clips/${v.id}`, right, {
    left: `${renderIconBack("/clips", "Back to Clips")}<h1 class="app-topbar__title clips-topbar-title">${escapeHtml(v.name)}</h1>`,
  });
}

function paint() {
  const v = getVideo(videoId);
  if (!target || !v) return;
  signature = sig(v);
  disposePreviews?.();
  disposePreviews = null;
  paintTopbarActions(v);
  // The analysis is the clips page's first state (2026-11-20): the recap
  // already there, the clips to come as waiting fiches.
  if (v.status !== "ready") {
    target.innerHTML = `<div class="clips-view clips-project"><div class="clips-view__page clips-page">
      ${renderRecap(v)}${v.status === "analyzing" ? renderComing(v) : ""}
    </div></div>`;
    return;
  }
  const posts = getPosts(draftKey(v.id));
  // Posts are written in a chat now: the « Write the posts » step only shows
  // for a video whose drafts were written here before (2026-11-20).
  const t = posts.length ? tab() : "clips";
  target.innerHTML = `
    <div class="clips-view clips-project">
      <div class="clips-bar"${posts.length ? "" : " hidden"}>
        <nav class="ap-stepper clips-bar__steps" aria-label="Steps">
          ${stepButton("clips", 1, "Review the clips", `<span data-clips-step-count>${v.clips.filter((c) => c.selected).length} kept</span>`, t)}
          <span class="ap-stepper-separator" aria-hidden="true"><i class="ap-icon-chevron-right"></i></span>
          ${stepButton("drafts", 2, "Write the posts", posts.length ? `${posts.length} draft${posts.length === 1 ? "" : "s"}` : "", t)}
        </nav>
      </div>
      ${t === "drafts" ? `<div class="clips-view__page">${renderDrafts(v, posts)}</div>` : renderPage(v)}
    </div>`;
  if (t === "drafts") swapPlayers(v, posts);
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
// Prod's steps (no percentage but the upload's), in the recap; under it, the
// clips to come as fiches that wait. It ends in clips, in no clips (prod's
// NO_SPEECH: the video, not the job — Upload another video, Remove) or in a
// crash (Try again, Remove).

function runSteps(v) {
  const at = Math.max(0, ANALYSIS_STAGES.indexOf(v.stage));
  // The upload is the first quarter of the simulated run: its own percentage.
  const upload = Math.min(100, Math.round(v.progress * ANALYSIS_STAGES.length * 100));
  return ANALYSIS_STAGES.map((s, i) => {
    const state = i < at ? "is-done" : i === at ? "is-current" : "";
    const label = i === at ? (i === 0 ? `Uploading · ${upload}%` : `${s}…`) : s;
    return `<li class="clips-run__step ${state}"><span class="clips-run__dot" aria-hidden="true">${i < at ? '<i class="ap-icon-check"></i>' : ""}</span>${label}</li>`;
  }).join("");
}

function renderRunStatus(v) {
  if (v.status === "analyzing")
    return `<div class="clips-run" aria-live="polite">
        <ol class="clips-run__steps" data-clips-steps>${runSteps(v)}</ol>
        <p class="clips-run__note">It can take a few minutes. You can leave this page: I'll tell you when the clips are ready. Set the look now, the clips come out in it.</p>
      </div>`;
  const empty = v.failure?.kind !== "crash";
  return `<div class="clips-run">
      <div class="ap-infobox ${empty ? "warning" : "error"} has-title" role="alert">
        <i class="ap-icon-warning" aria-hidden="true"></i>
        <div class="ap-infobox-content"><div class="ap-infobox-texts">
          <span class="ap-infobox-title">${empty ? "No clips in this video" : `I stopped at ${escapeHtml((v.failure?.stage || "the analysis").toLowerCase())}`}</span>
          <span class="ap-infobox-message">${escapeHtml(v.failure?.reason || "")}</span>
        </div></div>
      </div>
      <div class="clips-run__acts">
        ${
          empty
            ? `<a class="ap-button primary blue" href="#/clips"><i class="ap-icon-upload" aria-hidden="true"></i><span>Upload another video</span></a>`
            : `<button type="button" class="ap-button primary blue" data-clips-retry><i class="ap-icon-refresh" aria-hidden="true"></i><span>Try again</span></button>`
        }
        <button type="button" class="ap-button ghost grey" data-clips-remove-video><span>Remove this video</span></button>
      </div>
    </div>`;
}

// The clips to come: as many waiting fiches as prod will cut.
// A request written at launch comes back with three clips (videos-store's
// focusedMoments); the automatic run with prod's count.
const launchAsk = (v) => (v.requests || []).find((r) => r.status === "running");
const comingCount = (v) => (launchAsk(v) ? 3 : clipCountFor(v.durationMs));

function renderComing(v) {
  const ask = launchAsk(v);
  const n = comingCount(v);
  return `<section class="clips-group-sec" aria-label="The clips to come">
      <header class="clips-group-sec__head">
        <h2 class="clips-group-sec__title">${ask ? "From your request" : "The best moments"}</h2>
        <span class="clips-group-sec__meta">${ask ? `« ${escapeHtml(ask.text)} » · ` : ""}${ask ? "the clips" : plural(n, "clip")}, as soon as I've found them</span>
      </header>
      <div class="media-cards" aria-hidden="true">${waitingCard().repeat(n)}</div>
    </section>`;
}

// ── The clips page ───────────────────────────────────────────────────
// Opus Clip's model, picked 2026-11-20 (« la page de clips v2 ») over the
// one-at-a-time review: the video's recap at the top (its player, what it is,
// the facts, where the clips fall in it, its look), a request field to ask for
// other clips (prod's focus), then the clips as posters — each kept with its
// box, trimmed (prod's Trim), edited in the editor. A request answers in its
// own group above Archie's first pick.

const kept = (v) => v.clips.filter((c) => c.selected);
const totalMs = (clips) => clips.reduce((s, c) => s + c.endMs - c.startMs, 0);
const added = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// Prod's focus, one example per kind: a part of the video, a length, words.
const ASK_EXAMPLES = ["In the first 10 minutes", "Under 30 seconds", "Where someone tells a story"];

function renderPage(v) {
  const requests = v.requests || [];
  const best = v.clips.filter((c) => !c.requestId);
  // Asked for at launch, the analysis cut no « best moments »: the section
  // goes, its tools move to the first request.
  const noBest = !best.length && requests.length > 0;
  const tools = `<span class="clips-group-sec__tools">
            <button type="button" class="ap-button ghost grey" data-clips-select-all>Keep all</button>
            <button type="button" class="ap-button ghost grey" data-clips-add-clip><i class="ap-icon-plus" aria-hidden="true"></i><span>Add a clip</span></button>
          </span>`;
  const groups = requests.map((r, i) => renderRequest(v, r, noBest && i === requests.length - 1 ? tools : "")).join("");
  return `
    <div class="clips-view__page clips-page">
      ${renderRecap(v)}
      ${groups}
      ${
        noBest
          ? ""
          : `<section class="clips-group-sec" aria-labelledby="clips-best-title">
        <header class="clips-group-sec__head">
          <h2 class="clips-group-sec__title" id="clips-best-title">The best moments</h2>
          <span class="clips-group-sec__meta">${plural(best.length, "clip")} · in video order</span>
          ${tools}
        </header>
        ${best.length ? `<div class="media-cards">${best.map((c) => renderCard(v, c)).join("")}</div>` : `<p class="clips-group-sec__none">No clips left. Add one, or ask for other clips.</p>`}
      </section>`
      }
      ${renderRemoved(v)}
      ${renderAsk()}
    </div>`;
}

// Where the video came from, said with the date and its size.
const ORIGIN = { upload: "Uploaded", url: "From YouTube", chat: "From a chat", seed: "Uploaded" };
// The facts are the media card's (shared.js `fact`): one vocabulary for numbers.

// The recap: what the video is before what was cut from it. Polished
// 2026-11-20 (« c'est pauvre visuellement »): a meta line under the title, the
// summary in full ink, the facts as four named tiles, a key on the band.
// The recap: what the video is before what was cut from it.
function renderRecap(v) {
  const k = kept(v);
  const band = v.clips
    .map(
      (c) =>
        `<span class="${c.selected ? "is-kept" : ""}" data-clips-band="${escapeHtml(c.id)}" style="left:${(c.startMs / v.durationMs) * 100}%;width:max(3px, ${((c.endMs - c.startMs) / v.durationMs) * 100}%)"></span>`,
    )
    .join("");
  return `
    <section class="clips-recap" aria-labelledby="clips-recap-title">
      <div class="clips-recap__main">
      <div class="clips-recap__player">
        <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" controls playsinline></video>
      </div>
      <div class="clips-recap__body">
        <div class="clips-recap__head">
          <h2 class="clips-recap__title" id="clips-recap-title">About this video</h2>
          ${lookSelect(v.settings.ratio, v.settings.subtitlePreset)}
          <details class="clips-more">
            <summary class="ap-icon-button stroked grey" aria-label="More actions for this video" data-tooltip="More"><i class="ap-icon-more" aria-hidden="true"></i></summary>
            <div class="ap-action-dropdown clips-more__menu" role="menu">${menuItem("Remove this video", "trash", "data-clips-remove-video", true)}</div>
          </details>
        </div>
        <p class="media-card__meta clips-recap__meta">Added ${added(v.addedAt)} · ${ORIGIN[v.origin] || "Uploaded"} · ${v.width}×${v.height}</p>
        ${v.summary ? `<p class="clips-recap__summary">${escapeHtml(v.summary)}</p>` : ""}
        <p class="media-card__facts">
          ${fact("clock", `<b>${fmtMs(v.durationMs)}</b> long`)}
          ${
            v.status === "ready"
              ? `${fact("video", `<b>${v.clips.length}</b> ${v.clips.length === 1 ? "clip" : "clips"}`)}${fact("hourglass", `<b>${fmtMs(totalMs(v.clips))}</b> of clips`)}${fact("check", `<b data-clips-kept-n>${k.length}</b> of ${v.clips.length} kept`)}`
              : fact(
                  "video",
                  `<b>${v.status === "analyzing" ? comingCount(v) : 0}</b> ${v.status === "analyzing" ? "clips coming" : "clips"}`,
                )
          }
        </p>
        ${
          v.status === "ready"
            ? `<div class="clips-recap__map">
          <span class="clips-recap__map-label">Where the clips are <span class="clips-recap__key"><i class="is-kept"></i>Kept <i></i>Not kept</span></span>
          <div class="clips-recap__band" aria-hidden="true">${band}</div>
          <div class="clips-recap__ends"><span>0:00</span><span>${fmtMs(v.durationMs)}</span></div>
        </div>`
            : renderRunStatus(v)
        }
      </div>
      </div>
    </section>`;
}

// Asking for other clips: the app's own composer (the new chat's), standing
// not a row of the video's card (2026-11-20: « on dirait que la partie Archie
// est intégrée au bloc du clip… ça ne ressemble pas du tout au composer »).
// It floats at the foot of the screen, narrower than the page, Archie's mark
// at the start of its field so it reads as the way to talk about the clips
// (« flottante en bas de l'écran… pas toute la largeur… une icône Archie »).
// The same card, field and orange send; the examples in its toolbar. Enter
// sends, Shift+Enter a new line.
function renderAsk() {
  return `<form class="clips-ask" data-clips-ask novalidate aria-label="Ask for other clips">
      <div class="session__composer-card">
        <div class="session__composer-input-row">
          <span class="clips-ask__mark" aria-hidden="true"><i class="ap-icon-archie-official"></i></span>
          <textarea class="session__composer-input-field" data-clips-ask-input rows="2" aria-label="Ask for other clips"
            placeholder="Ask me for other clips: a topic, a person, a part of the video, a length…"></textarea>
        </div>
        <div class="session__composer-toolbar">
          ${ASK_EXAMPLES.map(
            (x) =>
              `<button type="button" class="ap-button stroked grey" data-clips-ask-try="${escapeHtml(x)}"><span>${escapeHtml(x)}</span></button>`,
          ).join("")}
          <button type="submit" class="ap-button primary orange session__composer-send" aria-label="Find clips" title="Find clips (Enter)">
            <i class="ap-icon-arrow-up" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </form>`;
}

function renderRequest(v, r, tools = "") {
  const clips = v.clips.filter((c) => c.requestId === r.id);
  const head = `<header class="clips-group-sec__head">
      <h2 class="clips-group-sec__title">From your request</h2>
      <span class="clips-ask__tag"><i class="ap-icon-archie-official" aria-hidden="true"></i>« ${escapeHtml(r.text)} »</span>
      ${r.status === "done" ? `<span class="clips-group-sec__meta">${plural(clips.length, "clip")}</span>` : ""}
      ${tools}
    </header>`;
  const body =
    r.status === "speaker"
      ? renderSpeakerQuestion(r)
      : r.status === "running"
        ? `<p class="clips-group-sec__meta" role="status">Finding these moments…</p><div class="media-cards" aria-hidden="true">${waitingCard().repeat(2)}</div>`
        : r.status === "none"
          ? // Prod's NO_MATCH, as the DS infobox; its × drops the request.
            `<div class="ap-infobox info has-title" role="status">
              <i class="ap-icon-info_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content"><div class="ap-infobox-texts">
                <span class="ap-infobox-title">No new clips</span>
                <span class="ap-infobox-message">I didn't find a part of the video that matches what you asked for, so I made no new clips. The clips you already had are still there.</span>
              </div></div>
              <button type="button" class="ap-infobox-close" data-clips-speaker-cancel="${escapeHtml(r.id)}" aria-label="Remove this request"><i class="ap-icon-close" aria-hidden="true"></i></button>
            </div>`
          : `<div class="media-cards">${clips.map((c) => renderCard(v, c)).join("")}</div>`;
  return `<section class="clips-group-sec">${head}${body}</section>`;
}

function menuItem(label, icon, attr, danger = false) {
  return `<button type="button" role="menuitem" class="ap-action-dropdown-item${danger ? " red-mode" : ""}" ${attr}>
    <i class="ap-icon-${icon}" aria-hidden="true"></i>
    <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container">
      <span class="ap-action-dropdown-item-label">${escapeHtml(label)}</span>
    </div></div>
  </button>`;
}

// A fiche (picked 2026-11-20): the clip as it will render, small, playing on
// hover; its box to keep it, its title, where it runs in the video and its
// length, why I picked it on two lines; then Trim, Edit clip and ⋯ (Rename,
// Remove). Three to a row.
function renderCard(v, c) {
  const id = escapeHtml(c.id);
  const title = escapeHtml(c.title);
  // The shared media card (shared.js): the clip at its real shape on the
  // stage, its box top left, its format and length below; where it runs and
  // its subtitles, why I picked it; Trim, Edit clip, ⋯.
  return mediaCard({
    attrs: `data-clips-card="${id}"`,
    cls: c.selected ? "is-kept" : "",
    stage: previewMarkup(v, c, { captions: false }),
    over: c.rendering ? veil("Rendering your edited clip…", { attrs: 'role="status"' }) : "",
    tl: `<label class="media-card__keep"><span class="ap-checkbox-container"><input type="checkbox" data-clips-keep="${id}" ${c.selected ? "checked" : ""} aria-label="Keep « ${title} »" /><i></i></span></label>`,
    bl: chip(escapeHtml(formatLabel(clipRatioId(v, c)))),
    br: chip(fmtMs(c.endMs - c.startMs)),
    title,
    meta: [
      `${fmtMs(c.startMs)} – ${fmtMs(c.endMs)} in the video`,
      c.trimmed ? "Trimmed" : "",
      `Subtitles: ${escapeHtml(presetLabel(clipCaptionState(v, c).presetId))}`,
    ],
    desc: c.why ? escapeHtml(c.why) : "",
    foot: `<button type="button" class="ap-button ghost grey" data-clips-trim="${id}"><i class="ap-icon-shorten" aria-hidden="true"></i><span>Trim</span></button>
      <a class="ap-button ghost grey" href="#/clips/${encodeURIComponent(v.id)}/edit/${encodeURIComponent(c.id)}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit clip</span></a>
      <details class="clips-more">
        <summary class="ap-icon-button transparent grey" aria-label="More actions for « ${title} »" data-tooltip="More"><i class="ap-icon-more" aria-hidden="true"></i></summary>
        <div class="ap-action-dropdown clips-more__menu" role="menu">
          ${menuItem("Rename", "pen", `data-clips-rename="${id}"`)}
          ${menuItem("Remove this clip", "trash", `data-clips-remove="${id}"`, true)}
        </div>
      </details>`,
  });
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

  const keep = t.closest("[data-clips-keep]");
  if (keep) return reviewClip(v.id, keep.dataset.clipsKeep, keep.checked);
  if (t.closest("[data-clips-select-all]"))
    return setSelection(
      v.id,
      // The best moments, or, when the launch asked for something, those clips.
      [...kept(v), ...(v.clips.some((c) => !c.requestId) ? v.clips.filter((c) => !c.requestId) : v.clips)].map(
        (c) => c.id,
      ),
    );
  const tryAsk = t.closest("[data-clips-ask-try]");
  if (tryAsk) {
    const input = target.querySelector("[data-clips-ask-input]");
    input.value = tryAsk.dataset.clipsAskTry;
    return input.focus();
  }
  // Trim: its own dialog, which does nothing else (clip-trim-modal.js).
  const trim = t.closest("[data-clips-trim]");
  if (trim) {
    const c = v.clips.find((x) => x.id === trim.dataset.clipsTrim);
    if (!c) return undefined;
    return openTrim({ video: v, clip: c, onSave: (range) => trimClip(v.id, c.id, range) });
  }
  const restore = t.closest("[data-clips-restore]");
  if (restore) return restoreClip(v.id, restore.dataset.clipsRestore);
  const ans = t.closest("[data-clips-speaker-cancel]");
  if (ans) return dropRequest(v.id, ans.dataset.clipsSpeakerCancel);
  const rename = t.closest("[data-clips-rename]");
  if (rename) {
    const c = v.clips.find((x) => x.id === rename.dataset.clipsRename);
    if (!c) return undefined;
    return openRename({
      title: "Rename this clip",
      initialName: c.title,
      placeholder: "Clip title",
      onSubmit: (title) => updateClip(v.id, c.id, { title }),
    });
  }
  const remove = t.closest("[data-clips-remove]");
  if (remove) {
    // « Rien ne bloque » (2026-11-20): no question, it goes at once and comes
    // back — Undo on the snackbar, then « Removed clips » at the foot of the page.
    const gone = removeClip(v.id, remove.dataset.clipsRemove);
    if (gone)
      showToast(`« ${gone.clip.title} » removed.`, {
        action: { label: "Undo", onClick: () => restoreClip(v.id, gone.clip.id) },
      });
    return undefined;
  }

  // Add a clip: found on the video, then cut like a Trim (clip-trim-modal.js).
  if (t.closest("[data-clips-add-clip]"))
    return openAdd({
      video: v,
      onSave: (range) => {
        const clip = addClip(v.id, range);
        navigate(`/clips/${v.id}/edit/${clip.id}`);
      },
    });

  // Write posts opens a new chat with the kept clips (clips-chat.js).
  if (t.closest("[data-clips-to-drafts]"))
    return writePostsInChat(
      v,
      kept(v).map((c) => c.id),
    );
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

// « Find clips »: the request goes to Archie; it answers in its own group.
function onSubmit(e) {
  const who = e.target.closest("[data-clips-speaker]");
  if (who) {
    e.preventDefault();
    const v = getVideo(videoId);
    const r = v?.requests?.find((x) => x.id === who.dataset.clipsSpeaker);
    const speaker = who.querySelector("input:checked")?.value;
    if (r && speaker) askForClips(v.id, r.text, { speaker, requestId: r.id });
    return;
  }
  if (!e.target.closest("[data-clips-ask]")) return;
  e.preventDefault();
  const input = target.querySelector("[data-clips-ask-input]");
  if (!input.value.trim()) return input.focus();
  askForClips(videoId, input.value);
  input.value = "";
  // The composer floats at the foot; the answer opens at the top of the clips.
  requestAnimationFrame(() =>
    target?.querySelector(".clips-group-sec")?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
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

// ── Which voice (prod's SPEAKER_UNKNOWN) ─────────────────────────────

function renderSpeakerQuestion(r) {
  const voices = r.voices || [];
  return `<form class="clips-who" data-clips-speaker="${escapeHtml(r.id)}">
      <p class="clips-who__q">I can hear ${voices.length} voices in this video, but I can't tell which one you mean. Which one is it?</p>
      <div class="clips-who__opts" role="radiogroup" aria-label="Which voice">${voices
        .map(
          (name, i) => `<label class="clips-who__opt">
            <span class="ap-radio-container"><input type="radio" name="who-${escapeHtml(r.id)}" value="${escapeHtml(name)}" ${i === 0 ? "checked" : ""} /></span>
            <span>${escapeHtml(name)}</span></label>`,
        )
        .join("")}</div>
      <span class="clips-who__acts">
        <button type="submit" class="ap-button primary blue">Find these moments</button>
        <button type="button" class="ap-button ghost grey" data-clips-speaker-cancel="${escapeHtml(r.id)}">Cancel the request</button>
      </span>
    </form>`;
}

// ── Removed clips ────────────────────────────────────────────────────
// What Remove took, kept with the video for as long as the page lives.

function renderRemoved(v) {
  const gone = v.removed || [];
  if (!gone.length) return "";
  return `<details class="clips-removed">
      <summary class="ap-link"><i class="ap-icon-history" aria-hidden="true"></i><span>Removed clips (${gone.length})</span></summary>
      <ul class="clips-removed__list">${gone
        .map(
          (c) => `<li><span class="clips-removed__title">${escapeHtml(c.title)}</span>
            <span class="clips-removed__at">${fmtMs(c.startMs)} – ${fmtMs(c.endMs)} in the video</span>
            <button type="button" class="ap-button ghost grey" data-clips-restore="${escapeHtml(c.id)}">Restore</button></li>`,
        )
        .join("")}</ul>
    </details>`;
}

// The ask's composer sends on Enter, like the chat's.
function onAskKey(e) {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || !e.target.matches("[data-clips-ask-input]")) return;
  e.preventDefault();
  e.target.closest("form")?.requestSubmit();
}
