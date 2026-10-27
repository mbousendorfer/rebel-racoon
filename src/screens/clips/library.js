// /clips — the Clips space's library (flag clipsSpace): the active Playbook's
// videos, and the one way in, adding a video. The flow starts with the video;
// the posts come last (screens/clips/project.js).

import { navigate } from "../../router.js?v=2239";
import { isFlagOn } from "../../feature-flags.js?v=2239";
import { renderTopbar } from "../../components/topbar.js?v=2239";
import { showToast } from "../../components/toast.js?v=2239";
import { renderEmptyState } from "../../components/empty-state.js?v=2239";
import { playbookForNewWork, subscribe as subscribeScope } from "../../active-playbook.js?v=2239";
import { isDemo } from "../../demo-mode.js?v=2239";
import { getPosts } from "../../posts-store.js?v=2239";
import { escapeHtml } from "../../utils.js?v=2239";
import {
  getVideos,
  addVideo,
  draftKey,
  lengthProblem,
  standInForUrl,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2239";
import { fmtMs, previewMarkup, mountPreviews } from "./shared.js?v=2239";
import { buildWorkflowFlow } from "../session/workflow-flow.js?v=2239";

let target = null;
let disposeShowcase = null;
let signature = "";
const disposers = [];

export function renderClipsLibrary(_params, el) {
  if (!isFlagOn("clipsSpace")) {
    navigate("/");
    return undefined;
  }
  renderTopbar();
  target = el;
  paint();
  el.addEventListener("click", onClick);
  el.addEventListener("submit", onSubmit);
  el.addEventListener("change", onChange);
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDrop);
  el.addEventListener("pointerover", onHover);
  el.addEventListener("pointerout", onHover);
  disposers.push(subscribeVideos(onStore), subscribeScope(paint));
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("submit", onSubmit);
    el.removeEventListener("change", onChange);
    el.removeEventListener("dragover", onDragOver);
    el.removeEventListener("dragleave", onDragLeave);
    el.removeEventListener("drop", onDrop);
    el.removeEventListener("pointerover", onHover);
    el.removeEventListener("pointerout", onHover);
    disposeShowcase?.();
    disposeShowcase = null;
    disposers.splice(0).forEach((d) => d());
    target = null;
  };
}

const scope = () => playbookForNewWork();

function sig(videos) {
  return videos.map((v) => `${v.id}:${v.status}:${v.clips.length}`).join("|");
}

// The analysis ticks every 300 ms: patch the progress in place rather than
// repaint the grid, which would reload every thumbnail's <video>.
function onStore() {
  if (!target) return;
  const videos = getVideos(scope()?.id);
  if (sig(videos) !== signature) return paint();
  for (const v of videos) {
    const bar = target.querySelector(`[data-clips-progress="${v.id}"]`);
    if (!bar) continue;
    bar.querySelector(".clips-progress__fill").style.width = `${Math.round(v.progress * 100)}%`;
    bar.querySelector(".clips-progress__label").textContent =
      `${v.stage || "Analyzing"}… ${Math.round(v.progress * 100)}%`;
  }
}

function paint() {
  if (!target) return;
  disposeShowcase?.();
  disposeShowcase = null;
  const pb = scope();
  const videos = getVideos(pb?.id);
  signature = sig(videos);
  const off = isDemo() ? "disabled" : "";
  const showcase = videos.find((v) => v.status === "ready" && v.clips.length >= 3) || null;
  target.innerHTML = `
    <div class="clips-view">
      <div class="clips-view__page clips-library-page">
        <section class="clips-hero" data-clips-drop aria-labelledby="clips-hero-title">
          <div class="clips-hero__copy">
            <h1 class="clips-hero__title" id="clips-hero-title">Turn a long video into clips</h1>
            <p class="clips-hero__sub">
              I find the best moments, frame the speakers and add subtitles. You refine, then I write the posts${
                pb ? ` in ${escapeHtml(pb.name)}'s voice` : ""
              }.
            </p>
            <form class="clips-hero__form" data-clips-url-form>
              <div class="ap-input-group clips-hero__url">
                <i class="ap-icon-link" aria-hidden="true"></i>
                <input type="text" data-clips-url placeholder="Paste a YouTube or Google Drive link" aria-label="Video link" ${off} />
              </div>
              <button type="submit" class="ap-button primary orange" ${off}>
                <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Get clips</span>
              </button>
            </form>
            <div class="clips-hero__upload">
              <button type="button" class="ap-button stroked grey" data-clips-browse ${off}>
                <i class="ap-icon-upload" aria-hidden="true"></i><span>Upload a video</span>
              </button>
              <span class="clips-hero__rules">or drop a file here · from 30 seconds to 2 hours</span>
              <input type="file" accept="video/*" data-clips-file hidden />
            </div>
          </div>
          ${showcase ? renderShowcase(showcase) : ""}
          <div class="clips-hero__drop" aria-hidden="true"><i class="ap-icon-upload"></i><span>Drop your video to start</span></div>
        </section>
        ${buildWorkflowFlow(STEPS)}
        ${videos.length ? renderGrid(videos) : renderEmpty()}
      </div>
    </div>`;
  if (showcase) disposeShowcase = mountPreviews(target.querySelector(".clips-showcase"), showcase);
}

// The hero shows what the space makes, with the space's own work: a long
// video on the left, three of its clips — reframed for real — on the right.
function renderShowcase(v) {
  const clips = v.clips.slice(0, 3);
  return `
    <div class="clips-showcase" aria-hidden="true">
      <div class="clips-showcase__source">
        <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1"></video>
        <span class="clips-showcase__badge">${fmtMs(v.durationMs)}</span>
      </div>
      <span class="clips-showcase__arrow"><i class="ap-icon-arrow-right"></i></span>
      <div class="clips-showcase__clips">
        ${clips
          .map(
            (c, i) => `<div class="clips-showcase__clip" style="--i:${i}">
              ${previewMarkup(v, { ...c, ratio: "9:16" })}
              <span class="clips-showcase__dur">${fmtMs(c.endMs - c.startMs)}</span>
            </div>`,
          )
          .join("")}
      </div>
    </div>`;
}

const STEPS = [
  {
    tone: "in",
    icon: "ap-icon-file--video",
    title: "Add a video",
    text: "A podcast, a webinar, a keynote — up to two hours.",
  },
  {
    tone: "ai",
    icon: "ap-icon-archie-official",
    title: "I cut the best moments",
    text: "Framed on the speakers, subtitled in your brand's style.",
  },
  {
    tone: "out",
    icon: "ap-icon-calendar",
    title: "You refine, then post",
    text: "Trim, reframe, restyle — then one draft per clip and account.",
  },
];

function renderEmpty() {
  return renderEmptyState({
    icon: "ap-icon-video",
    title: "Your videos will live here",
    body: "Every video you add keeps its clips and the drafts made from them, so you can come back and cut more.",
    wrapperClass: "clips-view__empty",
  });
}

function renderGrid(videos) {
  return `
    <section class="clips-library" aria-labelledby="clips-library-title">
      <header class="clips-library__head">
        <h2 class="clips-library__title" id="clips-library-title">Your videos</h2>
        <span class="ap-counter normal grey">${videos.length}</span>
      </header>
      <div class="clips-library__grid">${videos.map(renderCard).join("")}</div>
    </section>`;
}

function renderCard(v) {
  const posts = getPosts(draftKey(v.id));
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const added = new Date(v.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fact = (icon, text) =>
    `<span class="clips-video__fact"><i class="${icon}" aria-hidden="true"></i>${text}</span>`;
  const facts =
    v.status === "ready"
      ? [
          fact("ap-icon-video", `${v.clips.length} clip${v.clips.length === 1 ? "" : "s"}`),
          posts.length ? fact("ap-icon-file--text", `${posts.length} draft${posts.length === 1 ? "" : "s"}`) : "",
          scheduled ? fact("ap-icon-calendar", `${scheduled} scheduled`) : "",
        ].join("")
      : "";
  // Where the clips sit in the video, at the foot of the thumbnail.
  const map =
    v.status === "ready" && v.clips.length
      ? `<span class="clips-video__map">${v.clips
          .map(
            (c) =>
              `<span style="left:${(c.startMs / v.durationMs) * 100}%;width:max(3px, ${((c.endMs - c.startMs) / v.durationMs) * 100}%)"></span>`,
          )
          .join("")}</span>`
      : "";
  const pct = Math.round(v.progress * 100);
  return `
    <a class="clips-video${v.status === "analyzing" ? " is-analyzing" : ""}" href="#/clips/${encodeURIComponent(v.id)}" data-clips-card>
      <span class="clips-video__thumb">
        <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true" data-poster-s="${(v.posterMs || 0) / 1000}"></video>
        <span class="clips-video__duration">${fmtMs(v.durationMs)}</span>
        ${map}
        ${
          v.status === "analyzing"
            ? `<span class="clips-video__veil" data-clips-progress="${v.id}">
                 <span class="clips-video__veil-stage">${escapeHtml(v.stage || "Analyzing")}…</span>
                 <span class="clips-progress"><span class="clips-progress__track"><span class="clips-progress__fill" style="width:${pct}%"></span></span>
                 <span class="clips-progress__label">${pct}%</span></span>
               </span>`
            : ""
        }
      </span>
      <span class="clips-video__body">
        <span class="clips-video__name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</span>
        <span class="clips-video__meta">Added ${added}</span>
        ${facts ? `<span class="clips-video__facts">${facts}</span>` : ""}
      </span>
    </a>`;
}

// A thumbnail plays its video, muted, while the pointer is on it.
function onHover(e) {
  const card = e.target.closest?.("[data-clips-card]");
  if (!card || card.contains(e.relatedTarget)) return;
  const v = card.querySelector("video");
  if (!v) return;
  if (e.type === "pointerover") v.play().catch(() => {});
  else {
    v.pause();
    v.currentTime = Number(v.dataset.posterS) || 0;
  }
}

// ── Adding a video ───────────────────────────────────────────────────

function onClick(e) {
  if (e.target.closest("[data-clips-browse]")) target.querySelector("[data-clips-file]")?.click();
}

function onChange(e) {
  if (e.target.matches("[data-clips-file]") && e.target.files?.[0]) addFile(e.target.files[0]);
}

function onSubmit(e) {
  if (!e.target.closest("[data-clips-url-form]")) return;
  e.preventDefault();
  const url = target.querySelector("[data-clips-url]")?.value.trim();
  if (!url) return showToast("Paste a video link first.", { variant: "error" });
  // The prototype can't stream YouTube: a beta video stands in for the footage.
  const s = standInForUrl();
  const name = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const v = addVideo({ ...s, name, origin: "url", contextId: scope()?.id });
  navigate(`/clips/${v.id}`);
}

function onDragOver(e) {
  const zone = e.target.closest("[data-clips-drop]");
  if (!zone || isDemo()) return;
  e.preventDefault();
  zone.classList.add("is-dragover");
}

function onDragLeave(e) {
  e.target.closest("[data-clips-drop]")?.classList.remove("is-dragover");
}

function onDrop(e) {
  const zone = e.target.closest("[data-clips-drop]");
  if (!zone || isDemo()) return;
  e.preventDefault();
  zone.classList.remove("is-dragover");
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("video/"));
  if (!file) return showToast("Drop a video file — MP4, MOV or WebM.", { variant: "error" });
  addFile(file);
}

// The file plays for real, from memory: read its length and size first, refuse
// what prod refuses, then start the analysis.
function addFile(file) {
  const url = URL.createObjectURL(file);
  const probe = document.createElement("video");
  probe.preload = "metadata";
  probe.onloadedmetadata = () => {
    const durationMs = Math.round(probe.duration * 1000);
    const problem = lengthProblem(durationMs);
    if (problem) {
      URL.revokeObjectURL(url);
      showToast(problem, { variant: "error" });
      return;
    }
    const v = addVideo({
      name: file.name,
      url,
      durationMs,
      width: probe.videoWidth,
      height: probe.videoHeight,
      contextId: scope()?.id,
    });
    navigate(`/clips/${v.id}`);
  };
  probe.onerror = () => showToast("I can't read this video. Try an MP4 or a MOV.", { variant: "error" });
  probe.src = url;
}
