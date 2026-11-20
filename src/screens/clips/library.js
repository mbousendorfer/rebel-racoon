// /clips — the Clips space's library (flag clipsSpace): the active Playbook's
// videos, and the one way in, adding a video. The flow starts with the video;
// the posts come last (screens/clips/project.js).

import { navigate } from "../../router.js?v=2793";
import { isFlagOn } from "../../feature-flags.js?v=2793";
import { renderTopbar } from "../../components/topbar.js?v=2793";
import { playbookForNewWork, subscribe as subscribeScope } from "../../active-playbook.js?v=2793";
import { isDemo } from "../../demo-mode.js?v=2793";
import { getPosts } from "../../posts-store.js?v=2793";
import { escapeHtml } from "../../utils.js?v=2793";
import {
  getVideos,
  exampleVideo,
  addVideo,
  draftKey,
  lengthProblem,
  standInForUrl,
  retryAnalysis,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2793";
import {
  fmtMs,
  previewMarkup,
  mountPreviews,
  confirmRemoveVideo,
  dsSelect,
  bindSelectDismiss,
} from "./shared.js?v=2793";
import { buildWorkflowFlow } from "../session/workflow-flow.js?v=2793";

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
  el.addEventListener("input", onInput);
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDrop);
  el.addEventListener("pointerover", onHover);
  el.addEventListener("pointerout", onHover);
  disposers.push(subscribeVideos(onStore), subscribeScope(paint), bindSelectDismiss(el));
  return () => {
    el.removeEventListener("click", onClick);
    el.removeEventListener("submit", onSubmit);
    el.removeEventListener("change", onChange);
    el.removeEventListener("input", onInput);
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
    // Prod's step; a percentage only while uploading.
    bar.querySelector(".clips-video__veil-stage").textContent = stageLabel(v);
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
            <form class="clips-hero__form" data-clips-url-form novalidate>
              <div class="ap-input-group clips-hero__url">
                <i class="ap-icon-link" aria-hidden="true"></i>
                <input type="url" data-clips-url placeholder="Paste a YouTube or Google Drive link" aria-label="Video link" ${off} />
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
            <p class="ap-form-message error clips-hero__error" id="clipsAddError" role="alert" hidden></p>
          </div>
          ${showcase ? renderShowcase(showcase) : ""}
          <div class="clips-hero__drop" aria-hidden="true"><i class="ap-icon-upload"></i><span>Drop your video to start</span></div>
        </section>
        ${returning ? "" : buildWorkflowFlow(STEPS)}
        ${returning ? renderGrid(videos) : ""}
      </div>
    </div>`;
  if (showcase) disposeShowcase = mountPreviews(target.querySelector(".clips-showcase"), showcase);
  applySearch();
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

// Past a row of cards (Loom, Frame.io), the library is searched and sorted:
// the search hides cards in place (no repaint, the thumbnails keep their
// streams), the sort repaints the grid. Both live as long as the page.
const SEARCH_FROM = 4;
const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name (A to Z)" },
];
const list = { query: "", sort: "newest" };

function sorted(videos) {
  const by = {
    newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
    oldest: (a, b) => a.addedAt.localeCompare(b.addedAt),
    name: (a, b) => a.name.localeCompare(b.name),
  }[list.sort];
  return [...videos].sort(by);
}

function renderGrid(videos) {
  const tools =
    videos.length >= SEARCH_FROM
      ? `<div class="clips-library__tools">
          <div class="ap-input-group clips-library__search">
            <i class="ap-icon-search" aria-hidden="true"></i>
            <input type="search" data-clips-search placeholder="Search videos" aria-label="Search videos" value="${escapeHtml(list.query)}" />
          </div>
          ${dsSelect({
            label: "Sort",
            valueHtml: escapeHtml(SORTS.find((x) => x.id === list.sort).label),
            current: list.sort,
            attr: "data-clips-sort",
            options: SORTS,
            ariaLabel: "Sort videos",
            extraClass: "clips-library__sort",
          })}
        </div>`
      : "";
  return `
    <section class="clips-library" aria-labelledby="clips-library-title">
      <header class="clips-library__head">
        <h2 class="clips-library__title" id="clips-library-title">Your videos</h2>
        <span class="ap-counter normal grey">${videos.length}</span>
        ${tools}
      </header>
      <div class="clips-library__grid">${sorted(videos).map(renderCard).join("")}</div>
      <p class="clips-library__none" data-clips-no-match hidden></p>
    </section>`;
}

// The search: a card stays when its name holds every word typed.
function applySearch() {
  if (!target) return;
  const words = list.query.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  target.querySelectorAll(".clips-library__grid > [data-clips-card]").forEach((card) => {
    const name = card.querySelector(".clips-video__name")?.textContent.toLowerCase() || "";
    const on = words.every((w) => name.includes(w));
    card.hidden = !on;
    if (on) shown++;
  });
  const none = target.querySelector("[data-clips-no-match]");
  if (none) {
    none.hidden = shown > 0 || !words.length;
    none.textContent = `No video matches « ${list.query.trim()} ».`;
  }
}

// A failed analysis is not a link: the card says why, in place, and holds its
// two ways out (Try again, Remove) — buttons can't sit inside a link.
// No clips (prod's NO_SPEECH) is the video's doing: Remove only. A crash is
// the job's: Try again.
function renderFailedCard(v) {
  const added = new Date(v.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const crash = v.failure?.kind === "crash";
  return `
    <div class="clips-video is-failed" data-clips-card>
      <span class="clips-video__thumb">
        <video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true" data-poster-s="${(v.posterMs || 0) / 1000}"></video>
        <span class="clips-video__duration">${fmtMs(v.durationMs)}</span>
        <span class="clips-video__veil is-failed"><i class="ap-icon-warning" aria-hidden="true"></i><span>${crash ? `Stopped at ${escapeHtml((v.failure?.stage || "the analysis").toLowerCase())}` : "No clips found"}</span></span>
      </span>
      <span class="clips-video__body">
        <span class="clips-video__name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</span>
        <span class="clips-video__meta">Added ${added}</span>
        <p class="ap-form-message error clips-video__error" role="alert">${escapeHtml(v.failure?.reason || "I couldn't analyze this video.")}</p>
        <span class="clips-video__actions">
          ${crash ? `<button type="button" class="ap-button stroked grey" data-clips-retry="${escapeHtml(v.id)}"><i class="ap-icon-refresh" aria-hidden="true"></i><span>Try again</span></button>` : ""}
          <button type="button" class="ap-button ghost grey" data-clips-remove-video="${escapeHtml(v.id)}"><span>Remove</span></button>
        </span>
      </span>
    </div>`;
}

const stageLabel = (v) =>
  v.stage === "Uploading"
    ? `Uploading · ${Math.min(100, Math.round(v.progress * 400))}%`
    : `${v.stage || "Analyzing"}…`;

function renderCard(v) {
  if (v.status === "failed") return renderFailedCard(v);
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
  // What the video waits for, said on the card: the click goes there.
  const toSchedule = posts.length - scheduled;
  const next =
    v.status !== "ready"
      ? null
      : !v.clips.length
        ? { text: "Add a clip", tab: "" }
        : !posts.length
          ? { text: "Review the clips", tab: "" }
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
                 <span class="clips-video__veil-stage">${escapeHtml(stageLabel(v))}</span>
                 <span class="clips-progress"><span class="clips-progress__track is-indeterminate"><span class="clips-progress__fill"></span></span></span>
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

// What went wrong when adding says so under the add controls, not in a toast
// across the screen; a bad link also marks the field (DS invalid state).
function addError(msg, onField = false) {
  const el = target?.querySelector("#clipsAddError");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  if (!onField) return;
  const field = target.querySelector("[data-clips-url]");
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", "clipsAddError");
  field.closest(".ap-input-group")?.classList.add("invalid");
  field.focus();
}

function clearAddError() {
  const el = target?.querySelector("#clipsAddError");
  if (!el || el.hidden) return;
  el.hidden = true;
  const field = target.querySelector("[data-clips-url]");
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
  field.closest(".ap-input-group")?.classList.remove("invalid");
}

function onClick(e) {
  if (e.target.closest("[data-clips-browse]")) target.querySelector("[data-clips-file]")?.click();
  const sort = e.target.closest("[data-clips-sort]");
  if (sort) {
    list.sort = sort.dataset.clipsSort;
    return paint();
  }
  const retry = e.target.closest("[data-clips-retry]");
  if (retry) retryAnalysis(retry.dataset.clipsRetry);
  const remove = e.target.closest("[data-clips-remove-video]");
  if (remove) confirmRemoveVideo(remove.dataset.clipsRemoveVideo);
}

function onInput(e) {
  if (e.target.matches("[data-clips-search]")) {
    list.query = e.target.value;
    return applySearch();
  }
  return clearAddError();
}

function onChange(e) {
  clearAddError();
  if (e.target.matches("[data-clips-file]") && e.target.files?.[0]) addFile(e.target.files[0]);
}

function onSubmit(e) {
  if (!e.target.closest("[data-clips-url-form]")) return;
  e.preventDefault();
  const url = target.querySelector("[data-clips-url]")?.value.trim();
  if (!url) return addError("Paste a link to your video first.", true);
  if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(url))
    return addError("This isn't a link I can open. Paste the video's address, like youtube.com/watch?v=…", true);
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
  if (!file) return addError("That's not a video. Drop an MP4, a MOV or a WebM.");
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
      addError(problem);
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
  probe.onerror = () => addError("I can't read this video. Try an MP4 or a MOV.");
  probe.src = url;
}
