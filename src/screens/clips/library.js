// /clips — the Clips space's library (flag clipsSpace): the active Playbook's
// videos, and the one way in, adding a video. The flow starts with the video;
// the posts come last (screens/clips/project.js).

import { navigate } from "../../router.js?v=2513";
import { isFlagOn } from "../../feature-flags.js?v=2513";
import { renderTopbar } from "../../components/topbar.js?v=2513";
import { showToast } from "../../components/toast.js?v=2513";
import { playbookForNewWork, subscribe as subscribeScope } from "../../active-playbook.js?v=2513";
import { isDemo } from "../../demo-mode.js?v=2513";
import { getPosts } from "../../posts-store.js?v=2513";
import { escapeHtml } from "../../utils.js?v=2513";
import {
  getVideos,
  exampleVideo,
  addVideo,
  draftKey,
  lengthProblem,
  standInForUrl,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2513";
import { fmtMs, previewMarkup, mountPreviews } from "./shared.js?v=2513";
import { buildWorkflowFlow } from "../session/workflow-flow.js?v=2513";

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
  // Once videos exist the space is a library: the add bar shrinks to one line
  // and the videos come up; the explainer (showcase + steps) is for the first
  // visit only (2026-10-28).
  const returning = videos.length > 0;
  const showcase = returning ? null : exampleVideo();
  target.innerHTML = `
    <div class="clips-view">
      <div class="clips-view__page clips-library-page">
        <section class="clips-hero${returning ? " clips-hero--compact" : ""}" data-clips-drop aria-labelledby="clips-hero-title">
          <div class="clips-hero__copy">
            <h1 class="clips-hero__title" id="clips-hero-title">${returning ? "Add a video" : "Turn a long video into clips"}</h1>
            ${
              returning
                ? `<p class="clips-hero__sub">I'll cut it into short clips, framed and subtitled, ready to post.</p>`
                : `<p class="clips-hero__sub">
              I find the best moments, frame the speakers and add subtitles. You refine, then I write the posts${
                pb ? ` in ${escapeHtml(pb.name)}'s voice` : ""
              }.
            </p>`
            }
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
        ${returning ? "" : buildWorkflowFlow(STEPS)}
        ${returning ? renderGrid(videos) : ""}
      </div>
    </div>`;
  if (showcase) disposeShowcase = mountPreviews(target.querySelector(".clips-showcase"), showcase);
}

// The hero shows what the space makes, with the space's own work: a real
// podcast on the left, where its clips sit in it, and three of them on the
// right, reframed for real. The middle one plays on its own; the others on hover.
function renderShowcase(v) {
  const clips = v.clips.slice(0, 3);
  const map = v.clips
    .map(
      (c, i) =>
        `<span class="${i < 3 ? "is-shown" : ""}" style="--i:${i};left:${(c.startMs / v.durationMs) * 100}%;width:max(3px, ${((c.endMs - c.startMs) / v.durationMs) * 100}%)"></span>`,
    )
    .join("");
  return `
    <figure class="clips-showcase">
      <figcaption class="clips-showcase__head">
        <span class="ap-tag grey mini">Example</span>
        <span>A ${Math.round(v.durationMs / 60000)}-minute podcast, cut into ${v.clips.length} clips</span>
      </figcaption>
      <div class="clips-showcase__stage" aria-hidden="true">
        <div class="clips-showcase__in">
          <div class="clips-showcase__source">
            <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1"></video>
            <span class="clips-showcase__badge">${fmtMs(v.durationMs)}</span>
          </div>
          <span class="clips-showcase__map">${map}</span>
          <span class="clips-showcase__label">Your video</span>
        </div>
        <span class="clips-showcase__arrow"><i class="ap-icon-arrow-right"></i></span>
        <div class="clips-showcase__clips">
          ${clips
            .map(
              (c, i) => `<div class="clips-showcase__clip" style="--i:${i}">
                <div class="clips-showcase__frame">
                  ${previewMarkup(v, { ...c, ratio: "9:16" }).replace("data-clip-preview", i === 1 ? "data-autoplay data-clip-preview" : "data-clip-preview")}
                  <span class="clips-showcase__dur">${fmtMs(c.endMs - c.startMs)}</span>
                </div>
                <span class="clips-showcase__title">${escapeHtml(c.title)}</span>
              </div>`,
            )
            .join("")}
        </div>
      </div>
    </figure>`;
}

const STEPS = [
  {
    tone: "in",
    icon: "ap-icon-file--video",
    title: "Add a video",
    text: "A podcast, a webinar, a keynote. Up to two hours.",
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
    text: "Reframe, restyle. Then one draft per clip and account.",
  },
];

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
  // What the video waits for, said on the card: the click goes there.
  const toSchedule = posts.length - scheduled;
  const next =
    v.status !== "ready"
      ? null
      : !v.clips.length
        ? { text: "Add a clip", tab: "" }
        : !posts.length
          ? { text: "Pick clips and write posts", tab: "" }
          : toSchedule
            ? { text: `Schedule ${toSchedule} draft${toSchedule === 1 ? "" : "s"}`, tab: "?tab=drafts" }
            : { text: "Write more posts", tab: "?tab=drafts" };
  return `
    <a class="clips-video${v.status === "analyzing" ? " is-analyzing" : ""}" href="#/clips/${encodeURIComponent(v.id)}${next?.tab || ""}" data-clips-card>
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
        ${next ? `<span class="clips-video__next">${next.text}<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>` : ""}
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
  if (!file) return showToast("Drop a video file: MP4, MOV or WebM.", { variant: "error" });
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
