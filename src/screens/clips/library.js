// /clips — the Clips space's library (flag clipsSpace): the active Playbook's
// videos, and the way in, adding one. The flow starts with the video; the
// clips page comes next (screens/clips/project.js).
//
// « La boîte d'abord, automatique par défaut » (B1, picked 2026-11-20): one box
// stages a video — a file first, then a YouTube link (prod's order; no Drive)
// — and Find the best moments starts the analysis. Asking for something
// specific (prod's focus) is a link that opens a field, never a step. Under
// it the collection, filtered by state, in a grid or a list (Vimeo,
// ElevenLabs Studio).

import { navigate } from "../../router.js?v=2841";
import { isFlagOn } from "../../feature-flags.js?v=2841";
import { renderTopbar } from "../../components/topbar.js?v=2841";
import { playbookForNewWork, subscribe as subscribeScope } from "../../active-playbook.js?v=2841";
import { isDemo } from "../../demo-mode.js?v=2841";
import { getPosts } from "../../posts-store.js?v=2841";
import { escapeHtml, plural } from "../../utils.js?v=2841";
import {
  getVideos,
  exampleVideo,
  addVideo,
  draftKey,
  lengthProblem,
  standInForUrl,
  retryAnalysis,
  subscribe as subscribeVideos,
} from "../../videos-store.js?v=2841";
import {
  fmtMs,
  previewMarkup,
  mountPreviews,
  confirmRemoveVideo,
  dsSelect,
  bindSelectDismiss,
  mediaCard,
  chip,
  fact,
  veil,
  formatLabel,
} from "./shared.js?v=2841";

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

// The analysis ticks every 300 ms: patch its step in place rather than
// repaint the collection, which would reload every thumbnail's <video>.
function onStore() {
  if (!target) return;
  const videos = getVideos(scope()?.id);
  if (sig(videos) !== signature) return paint();
  for (const v of videos) {
    target.querySelectorAll(`[data-clips-stage-of="${v.id}"]`).forEach((n) => (n.textContent = stageLabel(v)));
  }
}

function paint() {
  if (!target) return;
  disposeShowcase?.();
  disposeShowcase = null;
  const videos = getVideos(scope()?.id);
  signature = sig(videos);
  const showcase = videos.length ? null : exampleVideo();
  target.innerHTML = `
    <div class="clips-view">
      <div class="clips-view__page clips-library-page">
        ${renderAddBox()}
        ${
          showcase
            ? `<section class="clips-library" aria-labelledby="clips-example-title">
                <header class="clips-library__head"><h2 class="clips-library__title" id="clips-example-title">What you'll get</h2></header>
                ${renderShowcase(showcase)}
              </section>`
            : renderCollection(videos)
        }
      </div>
    </div>`;
  if (showcase) disposeShowcase = mountPreviews(target.querySelector(".clips-showcase"), showcase);
  applySearch();
}

// ── The add box ──────────────────────────────────────────────────────

const RULES = "MP4, MOV or WebM · 30 seconds to 2 hours · up to 5 GB";
const FOCUS_EXAMPLES = ["About pricing", "With a guest", "In the first 10 minutes", "Under 30 seconds"];
// What the box holds until Find: a staged file, a YouTube link, a request.
const add = { file: null, url: "", specific: false, focus: "" };
const ready = () => !!add.file || !!add.url.trim();
const ctaLabel = () => (add.specific && add.focus.trim() ? "Find these moments" : "Find the best moments");

// The box, rebuilt 2026-11-20 (« pauvre et mal foutu »): two ways in side by
// side, the file first and wider — a real dropzone (icon, « Drop your video
// here », Upload a video, prod's rules) — then « or » and the YouTube field,
// always there. A staged file takes the whole width as a card (its frame, name,
// length, Remove). A footer like a dialog's: the request on the left, the CTA
// grouped right with what it will do. The CTA is never a pale disabled button:
// clicked with nothing added, it says so under the box.
function renderAddBox() {
  const demo = isDemo();
  const off = demo ? "disabled" : "";
  const f = add.file;
  const body = f
    ? `<div class="clips-box__staged">
        <span class="clips-box__thumb"><video src="${escapeHtml(f.url)}#t=1" muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"></video></span>
        <span class="clips-box__staged-text"><b>${escapeHtml(f.name)}</b><span>${fmtMs(f.durationMs)} · ready to analyze</span></span>
        <button type="button" class="ap-button ghost grey" data-clips-unstage><i class="ap-icon-close" aria-hidden="true"></i><span>Remove</span></button>
      </div>`
    : `<div class="clips-box__ways">
        <div class="clips-box__drop" data-clips-browse${demo ? ' aria-disabled="true"' : ""}>
          <i class="ap-icon-upload clips-box__drop-icon" aria-hidden="true"></i>
          <span class="clips-box__drop-title">Drop your video here</span>
          <button type="button" class="ap-button stroked grey" data-clips-browse ${off}><span>Upload a video</span></button>
          <span class="clips-box__rules">${RULES}</span>
        </div>
        <div class="clips-box__or" aria-hidden="true"><span>or</span></div>
        <div class="clips-box__yt">
          <label class="clips-box__label" for="clipsUrl">From YouTube</label>
          <div class="ap-input-group clips-box__link"><i class="ap-icon-youtube-official" aria-hidden="true"></i>
            <input id="clipsUrl" type="url" data-clips-url placeholder="Paste a youtube.com or youtu.be link" value="${escapeHtml(add.url)}" ${off} /></div>
          <p class="clips-box__rules" data-clips-rights ${add.url.trim() ? "" : "hidden"}>Using a video you don't own may violate copyright laws. By continuing, you confirm this is your own content.</p>
        </div>
      </div>`;
  const specific = add.specific
    ? `<div class="clips-box__specific">
        <label class="clips-box__label" for="clipsFocus">What should the clips be about?</label>
        <div class="ap-input-group"><i class="ap-icon-sparkles" aria-hidden="true"></i>
          <input id="clipsFocus" type="text" data-clips-focus placeholder="A topic, a person, a part of the video, a length" value="${escapeHtml(add.focus)}" /></div>
        <div class="clips-box__examples"><span>For example</span>${FOCUS_EXAMPLES.map(
          (x) =>
            `<button type="button" class="ap-tag grey" data-clips-focus-try="${escapeHtml(x)}">${escapeHtml(x)}</button>`,
        ).join("")}</div>
      </div>`
    : "";
  return `
    <section class="clips-box" data-clips-drop data-clips-addbox aria-labelledby="clips-box-title">
      <header class="clips-box__head">
        <h1 class="clips-box__title" id="clips-box-title">Turn a long video into clips</h1>
        <p class="clips-box__sub">I'll find its strongest moments and cut them into short clips, framed and subtitled for each network.</p>
      </header>
      ${body}
      <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" data-clips-file hidden />
      ${specific}
      <p class="ap-form-message error clips-hero__error" id="clipsAddError" role="alert" hidden></p>
      ${demo ? `<p class="clips-box__rules">The demo works with its own videos: adding one of yours is off.</p>` : ""}
      <footer class="clips-box__foot">
        ${
          add.specific
            ? `<button type="button" class="ap-button ghost grey" data-clips-specific="off"><span>Back to the best moments</span></button>`
            : `<button type="button" class="ap-button ghost grey" data-clips-specific="on" ${off}><i class="ap-icon-sparkles" aria-hidden="true"></i><span>Looking for something specific?</span></button>`
        }
        <span class="clips-box__foot-end">
          <span class="clips-box__hint">${add.specific ? "Only the moments that match, framed and subtitled." : "One clip per 2 minutes of video, 3 to 10 clips."}</span>
          <button type="button" class="ap-button primary orange" data-clips-start ${off}>
            <i class="ap-icon-archie-official" aria-hidden="true"></i><span data-clips-start-label>${ctaLabel()}</span></button>
        </span>
      </footer>
      <div class="clips-hero__drop" aria-hidden="true"><i class="ap-icon-upload"></i><span>Drop your video to start</span></div>
    </section>`;
}

// The box repaints alone: the collection's thumbnails keep their streams.
function paintBox(focusSel) {
  const box = target?.querySelector("[data-clips-addbox]");
  if (!box) return;
  box.outerHTML = renderAddBox();
  if (focusSel) target.querySelector(focusSel)?.focus();
}

function syncGo() {
  const b = target?.querySelector("[data-clips-start]");
  if (!b) return;
  b.querySelector("[data-clips-start-label]").textContent = ctaLabel();
  const rights = target.querySelector("[data-clips-rights]");
  if (rights) rights.hidden = !add.url.trim();
}

// Find: the staged video goes in, its analysis starts (prod: at once), with
// the request when one was written.
function start() {
  if (!ready()) {
    addError("Add a video first: drop a file, upload one, or paste a YouTube link.");
    target?.querySelector(".clips-box__drop")?.classList.add("is-asking");
    return undefined;
  }
  const focus = add.specific ? add.focus.trim() : "";
  let v;
  if (add.file) v = addVideo({ ...add.file, contextId: scope()?.id, focus });
  else {
    const url = add.url.trim();
    if (!/^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}/i.test(url))
      return addError(
        "That isn't a YouTube video link. Paste a youtube.com or youtu.be link, or drop the video file here.",
        true,
      );
    // The prototype can't stream YouTube: a beta video stands in for the footage.
    const name = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    v = addVideo({ ...standInForUrl(), name, origin: "url", contextId: scope()?.id, focus });
  }
  Object.assign(add, { file: null, url: "", specific: false, focus: "" });
  navigate(`/clips/${v.id}`);
  return undefined;
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

// ── The collection ───────────────────────────────────────────────────
// Filtered by what each video waits for, searched, sorted, in a grid or a
// list. The search and the filter hide items in place (no repaint, the
// thumbnails keep their streams); the sort and the view repaint.

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name (A to Z)" },
];
const FILTERS = [
  { id: "all", label: "All" },
  { id: "running", label: "Analyzing" },
  { id: "pick", label: "Clips to review" },
  { id: "posts", label: "Posts written" },
  { id: "empty", label: "No clips" },
];
const list = { query: "", sort: "newest", filter: "all", view: "grid" };

const stateOf = (v) =>
  v.status === "analyzing"
    ? "running"
    : v.status === "failed"
      ? "empty"
      : getPosts(draftKey(v.id)).length
        ? "posts"
        : "pick";

function sorted(videos) {
  const by = {
    newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
    oldest: (a, b) => a.addedAt.localeCompare(b.addedAt),
    name: (a, b) => a.name.localeCompare(b.name),
  }[list.sort];
  return [...videos].sort(by);
}

function renderCollection(videos) {
  const count = (id) => (id === "all" ? videos.length : videos.filter((v) => stateOf(v) === id).length);
  // The tabs only show when they sort something: two states at least
  // (« je comprends pas le all - to pick » — All · 2 next to To pick · 2 said nothing).
  const used = FILTERS.filter((f) => f.id !== "all" && count(f.id));
  if (used.length < 2) list.filter = "all";
  const tabs = (used.length < 2 ? [] : FILTERS.filter((f) => f.id === "all" || count(f.id))).map(
    (f) =>
      `<button type="button" class="ap-tabs-tab${list.filter === f.id ? " active" : ""}" role="tab" aria-selected="${list.filter === f.id}" data-clips-filter="${f.id}">${f.label} · ${count(f.id)}</button>`,
  );
  const viewBtn = (id, icon, label) =>
    `<button type="button" class="ap-icon-button ${list.view === id ? "stroked" : "transparent"} grey" data-clips-view="${id}" aria-pressed="${list.view === id}" aria-label="${label}" data-tooltip="${label}"><i class="ap-icon-${icon}" aria-hidden="true"></i></button>`;
  const items = sorted(videos);
  return `
    <section class="clips-library" aria-labelledby="clips-library-title">
      <header class="clips-library__head">
        <h2 class="clips-library__title" id="clips-library-title">Your videos</h2>
        <span class="ap-counter normal grey">${videos.length}</span>
      </header>
      ${tabs.length ? `<div class="ap-tabs clips-library__filters"><div class="ap-tabs-nav" role="tablist" aria-label="Filter videos">${tabs.join("")}</div></div>` : ""}
      <div class="clips-library__tools">
        <!-- Search on the left, how to see the videos on the right (2026-11-23). -->
        <div class="ap-input-group clips-library__search">
          <i class="ap-icon-search" aria-hidden="true"></i>
          <input type="search" data-clips-search placeholder="Search videos" aria-label="Search videos" value="${escapeHtml(list.query)}" />
        </div>
        <span class="clips-library__grow"></span>
        ${dsSelect({
          label: "Sort",
          valueHtml: escapeHtml(SORTS.find((x) => x.id === list.sort).label),
          current: list.sort,
          attr: "data-clips-sort",
          options: SORTS,
          ariaLabel: "Sort videos",
          extraClass: "clips-library__sort",
        })}
        ${viewBtn("grid", "view-grid", "Grid")}${viewBtn("list", "view-list", "List")}
      </div>
      ${
        list.view === "list"
          ? `<table class="ap-table outer-border header-background clickable-rows clips-library__table">
              <thead><tr><th scope="col">Video</th><th scope="col">Status</th><th scope="col" class="right">Length</th><th scope="col" class="right">Clips</th><th scope="col" class="right">Kept</th><th scope="col" class="right">Posts</th><th scope="col" class="right"><span class="clips-library__sr">Next</span></th></tr></thead>
              <tbody>${items.map(renderRow).join("")}</tbody></table>`
          : `<div class="clips-library__grid media-cards">${items.map(renderCard).join("")}</div>`
      }
      <p class="clips-library__none" data-clips-no-match hidden></p>
    </section>`;
}

// A row of the list: the video, its state, its facts in named columns, what's next.
function renderRow(v) {
  const st = stateOf(v);
  const posts = getPosts(draftKey(v.id)).length;
  const status = {
    running: `<span class="ap-status blue no-dot" data-clips-stage-of="${escapeHtml(v.id)}">${escapeHtml(stageLabel(v))}</span>`,
    empty: `<span class="ap-status red">${v.failure?.kind === "crash" ? "Stopped" : "No clips"}</span>`,
    pick: `<span class="ap-status orange">${plural(v.clips.length, "clip")} to review</span>`,
    posts: `<span class="ap-status green">${plural(posts, "post")}</span>`,
  }[st];
  const next = nextOf(v);
  return `<tr data-clips-card data-state="${st}" data-name="${escapeHtml(v.name.toLowerCase())}" data-href="#/clips/${encodeURIComponent(v.id)}${next?.tab || ""}">
    <td><span class="clips-library__vid"><span class="clips-library__thumb"><video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"></video></span><b>${escapeHtml(v.name)}</b></span></td>
    <td>${status}</td>
    <td class="right clips-library__num">${fmtMs(v.durationMs)}</td>
    <td class="right clips-library__num">${v.status === "ready" ? v.clips.length : "–"}</td>
    <td class="right clips-library__num">${v.status === "ready" ? v.clips.filter((c) => c.selected).length : "–"}</td>
    <td class="right clips-library__num">${posts || "–"}</td>
    <td class="right">${next ? `<span class="media-card__next">${next.text}<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>` : ""}</td>
  </tr>`;
}

// The search and the filter: an item stays when its name holds every word
// typed and it is in the filter.
function applySearch() {
  if (!target) return;
  const words = list.query.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  target
    .querySelectorAll(".clips-library__grid > [data-clips-card], .clips-library__table [data-clips-card]")
    .forEach((card) => {
      const name = card.dataset.name || "";
      const on = words.every((w) => name.includes(w)) && (list.filter === "all" || card.dataset.state === list.filter);
      card.hidden = !on;
      if (on) shown++;
    });
  const none = target.querySelector("[data-clips-no-match]");
  if (none) {
    none.hidden = shown > 0;
    none.textContent = words.length ? `No video matches « ${list.query.trim()} ».` : "No video here yet.";
  }
}

// A failed analysis is not a link: the card says why, in place, and holds its
// ways out (Try again, Remove) — buttons can't sit inside a link. No clips
// (prod's NO_SPEECH) is the video's doing: Remove only. A crash is the job's:
// Try again. The shared media card, like every video and clip.
function renderFailedCard(v) {
  const crash = v.failure?.kind === "crash";
  return mediaCard({
    tag: "div",
    attrs: `data-clips-card data-state="empty" data-name="${escapeHtml(v.name.toLowerCase())}"`,
    stage: thumb(v),
    over: veil(
      crash ? `Stopped at ${escapeHtml((v.failure?.stage || "the analysis").toLowerCase())}` : "No clips found",
      { running: false, warn: true },
    ),
    bl: chip(sourceFormat(v)),
    br: chip(fmtMs(v.durationMs)),
    title: escapeHtml(v.name),
    titleTip: v.name,
    meta: [`Added ${addedOn(v)}`, ORIGIN[v.origin] || "Uploaded"],
    desc: `<span class="ap-form-message error" role="alert">${escapeHtml(v.failure?.reason || "I couldn't analyze this video.")}</span>`,
    foot: `${crash ? `<button type="button" class="ap-button stroked grey" data-clips-retry="${escapeHtml(v.id)}"><i class="ap-icon-refresh" aria-hidden="true"></i><span>Try again</span></button>` : ""}
      <button type="button" class="ap-button ghost grey" data-clips-remove-video="${escapeHtml(v.id)}"><span>Remove</span></button>`,
  });
}

const ORIGIN = { upload: "Uploaded", url: "From YouTube", chat: "From a chat", seed: "Uploaded" };
const addedOn = (v) => new Date(v.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
// A source video's format, named like a clip's (« Landscape 16:9 »).
function sourceFormat(v) {
  const r = v.width / v.height;
  const ids = ["16:9", "4:3", "1:1", "4:5", "9:16"];
  const near = ids.reduce(
    (a, id) => {
      const [w, h] = id.split(":").map(Number);
      return Math.abs(w / h - r) < Math.abs(a.r - r) ? { id, r: w / h } : a;
    },
    { id: "16:9", r: 16 / 9 },
  );
  return escapeHtml(formatLabel(near.id));
}
const thumb = (v) =>
  `<video src="${escapeHtml(v.url)}#t=${(v.posterMs || 0) / 1000}" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true" data-poster-s="${(v.posterMs || 0) / 1000}"></video>`;

const stageLabel = (v) =>
  v.stage === "Uploading"
    ? `Uploading · ${Math.min(100, Math.round(v.progress * 400))}%`
    : `${v.stage || "Analyzing"}…`;

// What the video waits for, said on the card and the row: the click goes there.
function nextOf(v) {
  if (v.status !== "ready") return null;
  const posts = getPosts(draftKey(v.id));
  const toSchedule = posts.filter((p) => p.status !== "scheduled").length;
  if (!v.clips.length) return { text: "Add a clip", tab: "" };
  if (!posts.length) return { text: "Review the clips", tab: "" };
  if (toSchedule) return { text: `Schedule ${toSchedule} draft${toSchedule === 1 ? "" : "s"}`, tab: "?tab=drafts" };
  return { text: "Write more posts", tab: "?tab=drafts" };
}

function renderCard(v) {
  if (v.status === "failed") return renderFailedCard(v);
  const posts = getPosts(draftKey(v.id));
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  // Where the clips sit in the video, along the stage's foot.
  const map =
    v.status === "ready" && v.clips.length
      ? `<span class="media-card__map">${v.clips
          .map(
            (c) =>
              `<span style="left:${(c.startMs / v.durationMs) * 100}%;width:max(3px, ${((c.endMs - c.startMs) / v.durationMs) * 100}%)"></span>`,
          )
          .join("")}</span>`
      : "";
  const next = nextOf(v);
  const n = v.clips.length;
  const href = `#/clips/${encodeURIComponent(v.id)}${next?.tab || ""}`;
  return mediaCard({
    href,
    attrs: `data-clips-card data-state="${stateOf(v)}" data-name="${escapeHtml(v.name.toLowerCase())}"`,
    stage: thumb(v),
    over:
      map +
      (v.status === "analyzing"
        ? veil(`<span data-clips-stage-of="${escapeHtml(v.id)}">${escapeHtml(stageLabel(v))}</span>`, {
            attrs: `data-clips-progress="${escapeHtml(v.id)}"`,
          })
        : ""),
    bl: chip(sourceFormat(v)),
    br: chip(fmtMs(v.durationMs)),
    title: escapeHtml(v.name),
    titleTip: v.name,
    meta: [`Added ${addedOn(v)}`, ORIGIN[v.origin] || "Uploaded"],
    facts:
      v.status === "ready"
        ? [
            fact("video", `<b>${n}</b> ${n === 1 ? "clip" : "clips"}`),
            posts.length ? fact("file--text", `<b>${posts.length}</b> ${posts.length === 1 ? "draft" : "drafts"}`) : "",
            scheduled ? fact("calendar", `<b>${scheduled}</b> scheduled`) : "",
          ]
        : [],
    // The foot: where the card leads, and ⋯ with Remove (the clips go too —
    // confirmRemoveVideo says so).
    foot: `${next ? `<a class="media-card__next" href="${href}">${next.text}<i class="ap-icon-arrow-right" aria-hidden="true"></i></a>` : ""}
      <details class="clips-more">
        <summary class="ap-icon-button transparent grey" aria-label="More actions for « ${escapeHtml(v.name)} »" data-tooltip="More"><i class="ap-icon-more" aria-hidden="true"></i></summary>
        <div class="ap-action-dropdown clips-more__menu" role="menu">
          <button type="button" role="menuitem" class="ap-action-dropdown-item red-mode" data-clips-remove-video="${escapeHtml(v.id)}">
            <i class="ap-icon-trash" aria-hidden="true"></i>
            <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">Remove this video</span></div></div>
          </button>
        </div>
      </details>`,
  });
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

// What went wrong when adding says so under the box, not in a toast across
// the screen; a bad link also marks the field (DS invalid state).
function addError(msg, onField = false) {
  const el = target?.querySelector("#clipsAddError");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  if (!onField) return;
  const field = target.querySelector("[data-clips-url]");
  if (!field) return;
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", "clipsAddError");
  field.closest(".ap-input-group")?.classList.add("invalid");
  field.focus();
}

function clearAddError() {
  target?.querySelector(".clips-box__drop.is-asking")?.classList.remove("is-asking");
  const el = target?.querySelector("#clipsAddError");
  if (!el || el.hidden) return;
  el.hidden = true;
  const field = target.querySelector("[data-clips-url]");
  field?.removeAttribute("aria-invalid");
  field?.removeAttribute("aria-describedby");
  field?.closest(".ap-input-group")?.classList.remove("invalid");
}

function onClick(e) {
  const t = e.target;
  if (t.closest("[data-clips-browse]"))
    return isDemo() ? undefined : target.querySelector("[data-clips-file]")?.click();
  if (t.closest("[data-clips-unstage]")) {
    add.file = null;
    return paintBox();
  }
  const spec = t.closest("[data-clips-specific]");
  if (spec) {
    add.specific = spec.dataset.clipsSpecific === "on";
    return paintBox(add.specific ? "[data-clips-focus]" : null);
  }
  const tryIt = t.closest("[data-clips-focus-try]");
  if (tryIt) {
    add.focus = tryIt.dataset.clipsFocusTry;
    return paintBox("[data-clips-focus]");
  }
  if (t.closest("[data-clips-start]")) return start();
  const filter = t.closest("[data-clips-filter]");
  if (filter) {
    list.filter = filter.dataset.clipsFilter;
    target.querySelectorAll("[data-clips-filter]").forEach((b) => {
      const on = b === filter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    return applySearch();
  }
  const view = t.closest("[data-clips-view]");
  if (view) {
    list.view = view.dataset.clipsView;
    return paint();
  }
  const sort = t.closest("[data-clips-sort]");
  if (sort) {
    list.sort = sort.dataset.clipsSort;
    return paint();
  }
  const retry = t.closest("[data-clips-retry]");
  if (retry) return retryAnalysis(retry.dataset.clipsRetry);
  const remove = t.closest("[data-clips-remove-video]");
  if (remove) {
    remove.closest("details")?.removeAttribute("open");
    return confirmRemoveVideo(remove.dataset.clipsRemoveVideo);
  }
  const row = t.closest("tr[data-href]");
  if (row) return navigate(row.dataset.href.slice(1));
  return undefined;
}

function onInput(e) {
  const t = e.target;
  if (t.matches("[data-clips-search]")) {
    list.query = t.value;
    return applySearch();
  }
  if (t.matches("[data-clips-url]")) add.url = t.value;
  if (t.matches("[data-clips-focus]")) add.focus = t.value;
  clearAddError();
  return syncGo();
}

function onChange(e) {
  clearAddError();
  if (e.target.matches("[data-clips-file]") && e.target.files?.[0]) stageFile(e.target.files[0]);
}

function onSubmit(e) {
  e.preventDefault();
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
  return stageFile(file);
}

// The file plays for real, from memory: read its length first, refuse what
// prod refuses, then stage it in the box (prod: the preview, then the CTA).
function stageFile(file) {
  if (file.size > 5 * 1024 * 1024 * 1024) return addError("Video too large. Maximum size is 5GB");
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
    add.file = { name: file.name, url, durationMs, width: probe.videoWidth, height: probe.videoHeight };
    paintBox();
  };
  probe.onerror = () => addError("I can't read this video. Try an MP4 or a MOV.");
  probe.src = url;
  return undefined;
}
