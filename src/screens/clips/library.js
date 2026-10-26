// /clips — the Clips space's library (flag clipsSpace): the active Playbook's
// videos, and the one way in, adding a video. The flow starts with the video;
// the posts come last (screens/clips/project.js).

import { navigate } from "../../router.js?v=2129";
import { isFlagOn } from "../../feature-flags.js?v=2129";
import { renderTopbar } from "../../components/topbar.js?v=2129";
import { showToast } from "../../components/toast.js?v=2129";
import { renderEmptyState } from "../../components/empty-state.js?v=2129";
import { playbookForNewWork, subscribe as subscribeScope } from "../../active-playbook.js?v=2129";
import { isDemo } from "../../demo-mode.js?v=2129";
import { getPosts } from "../../posts-store.js?v=2129";
import { escapeHtml } from "../../utils.js?v=2129";
import {
  getVideos,
  addVideo,
  draftKey,
  lengthProblem,
  standInForUrl,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2129";
import { fmtMs } from "./shared.js?v=2129";

let target = null;
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
  disposers.push(subscribeVideos(onStore), subscribeScope(paint));
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("submit", onSubmit);
    el.removeEventListener("change", onChange);
    el.removeEventListener("dragover", onDragOver);
    el.removeEventListener("dragleave", onDragLeave);
    el.removeEventListener("drop", onDrop);
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
  const pb = scope();
  const videos = getVideos(pb?.id);
  signature = sig(videos);
  const off = isDemo() ? "disabled" : "";
  target.innerHTML = `
    <div class="clips-view">
      <div class="clips-view__page">
        <section class="clips-add" data-clips-drop>
          <span class="clips-add__icon"><i class="ap-icon-video" aria-hidden="true"></i></span>
          <div class="clips-add__text">
            <h1 class="clips-add__title">Turn a long video into clips</h1>
            <p class="clips-add__sub">
              Add a video and I'll find its best moments, frame the speakers and add subtitles. You refine, then I write
              the posts${pb ? ` in ${escapeHtml(pb.name)}'s voice` : ""}.
            </p>
          </div>
          <form class="clips-add__form" data-clips-url-form>
            <div class="ap-input-group clips-add__url">
              <i class="ap-icon-link" aria-hidden="true"></i>
              <input type="text" data-clips-url placeholder="Paste a YouTube or Google Drive link" aria-label="Video link" ${off} />
            </div>
            <button type="submit" class="ap-button primary orange" ${off}>
              <i class="ap-icon-archie-official" aria-hidden="true"></i><span>Get clips</span>
            </button>
            <span class="clips-add__or">or</span>
            <button type="button" class="ap-button stroked grey" data-clips-browse ${off}>
              <i class="ap-icon-upload" aria-hidden="true"></i><span>Upload a video</span>
            </button>
            <input type="file" accept="video/*" data-clips-file hidden />
          </form>
          <p class="clips-add__rules">From 30 seconds to 2 hours. Drop a file anywhere on this card.</p>
        </section>
        ${videos.length ? renderGrid(videos) : renderEmpty()}
      </div>
    </div>`;
}

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
      <h2 class="clips-library__title" id="clips-library-title">Videos</h2>
      <div class="clips-library__grid">${videos.map(renderCard).join("")}</div>
    </section>`;
}

function renderCard(v) {
  const posts = getPosts(draftKey(v.id));
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const added = new Date(v.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const facts =
    v.status === "ready"
      ? [
          `${v.clips.length} clip${v.clips.length === 1 ? "" : "s"}`,
          posts.length ? `${posts.length} draft${posts.length === 1 ? "" : "s"}` : "",
          scheduled ? `${scheduled} scheduled` : "",
        ].filter(Boolean)
      : [];
  return `
    <a class="clips-video" href="#/clips/${encodeURIComponent(v.id)}">
      <span class="clips-video__thumb">
        <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"></video>
        <span class="clips-video__duration">${fmtMs(v.durationMs)}</span>
      </span>
      <span class="clips-video__body">
        <span class="clips-video__name">${escapeHtml(v.name)}</span>
        <span class="clips-video__meta">Added ${added}${facts.length ? ` · ${facts.join(" · ")}` : ""}</span>
        ${
          v.status === "analyzing"
            ? `<span class="clips-progress" data-clips-progress="${v.id}">
                 <span class="clips-progress__track"><span class="clips-progress__fill" style="width:${Math.round(v.progress * 100)}%"></span></span>
                 <span class="clips-progress__label">${escapeHtml(v.stage || "Analyzing")}… ${Math.round(v.progress * 100)}%</span>
               </span>`
            : ""
        }
      </span>
    </a>`;
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
