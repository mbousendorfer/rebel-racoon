// A clip's range, cut on the video itself — one dialog, two uses.
//
// Trim (2026-11-20, asked: « le Trim fait dans une modale spécifique qui ne
// permet de faire que ça »). Prod's clip-trim-modal: the source playing, one
// window of 2 minutes either side of the clip (TRIM_PADDING_SECONDS), no
// length rule, « Trim: <title> », Cancel / Save trim. On top of prod: a
// filmstrip of that window under the two handles, the frame under the handle
// you move, Play for the cut.
//
// Add a clip (2026-11-20, « add a clip est inutilisable… réfléchis » — it was
// two times to type, the start guessed). Two steps in the same dialog: FIND the
// moment on the whole video — play it, scrub it, the clips already cut marked
// on the strip so the gaps show — then « Start the clip here »: 30 seconds from
// the playhead, fine-tuned like a Trim (the same ±2 min window), Add clip.
// Prod has no Add a clip.
//
// Public API:
//   open({ video, clip, onSave })        — Trim; onSave({ startMs, endMs }) when it changed
//   openAdd({ video, onSave })           — Add a clip; onSave({ startMs, endMs })

import {
  requestOpen,
  notifyClose,
  bindOverlayDismissal,
  showOverlay,
  hideOverlay,
} from "../modal-coordinator.js?v=2844";
import { escapeHtml } from "../utils.js?v=2844";
import { fmtMs } from "../screens/clips/shared.js?v=2844";

const MODAL_ID = "clip-trim";
const PAD = 120000;
const THUMBS = 12;
const NEW_CLIP_MS = 30000;

let backdrop, modal;
let initialized = false;
// { mode: trim|add, step: find|cut, video, from, startMs, endMs, lo, hi, at, onSave, raf, thumbs }
let t = null;

const HTML = `
<div class="app-modal-backdrop" id="clipTrimBackdrop" hidden></div>
<aside class="ap-dialog clip-trim-modal" id="clipTrimModal" role="dialog" aria-modal="true" aria-labelledby="clipTrimTitle" aria-hidden="true">
  <div class="ap-dialog-header"><span class="ap-dialog-title" id="clipTrimTitle">Trim</span></div>
  <button class="ap-dialog-close" type="button" data-trim-close aria-label="Close"><i class="ap-icon-close"></i></button>
  <div class="ap-dialog-content" id="clipTrimBody"></div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" data-trim-close>Cancel</button>
      <button type="button" class="ap-button primary blue" data-trim-save>Save trim</button>
    </div>
  </div>
</aside>`;

const $ = (sel) => modal.querySelector(sel);
const pct = (ms) => `${((ms - t.lo) / (t.hi - t.lo)) * 100}%`;
const changed = () => t.startMs !== t.from.startMs || t.endMs !== t.from.endMs;
const finding = () => t.mode === "add" && t.step === "find";

const strip = (inner, lane = "") => `
    <div class="clips-trim__strip">
      <div class="clips-trim__thumbs" aria-hidden="true">${"<canvas></canvas>".repeat(THUMBS)}</div>
      ${inner}
    </div>
    ${lane}
    <span class="clips-trim__scale"><span>${fmtMs(t.lo)}</span><span>${fmtMs(t.hi)}</span></span>`;

const player = () => `
    <div class="clips-trim__player clip-trim-modal__player">
      <video data-trim-video src="${escapeHtml(t.video.url)}" muted playsinline preload="metadata"></video>
    </div>`;

// Find: the whole video, the clips already cut marked on it, one playhead.
function findBody() {
  const marks = t.video.clips
    .map(
      (c) =>
        `<span class="clips-trim__mark" style="left:${pct(c.startMs)};width:max(3px, calc(${pct(c.endMs)} - ${pct(c.startMs)}))" title="${escapeHtml(c.title)}"></span>`,
    )
    .join("");
  return `
    <p class="clip-trim-modal__sub">Play or scrub the video to the moment you want, then start the clip there. The grey marks are the clips you already have.</p>
    ${player()}
    <div class="clip-trim-modal__bar">
      <button type="button" class="ap-button stroked grey" data-trim-play><i class="ap-icon-play" aria-hidden="true"></i><span>Play</span></button>
      <span class="clips-trim__read" data-trim-read aria-live="polite"></span>
      <button type="button" class="ap-button primary blue" data-trim-mark>Start the clip here</button>
    </div>
    ${strip(
      `<span class="clips-trim__head is-at" data-trim-head></span>
      <input type="range" class="clips-trim__h clips-trim__seek" data-trim-seek min="${t.lo}" max="${t.hi}" step="1000" value="${t.at}" aria-label="Where in the video" />`,
      `<div class="clips-trim__lane" aria-hidden="true">${marks}</div>`,
    )}`;
}

// Cut: two handles on a window of 2 minutes either side.
function cutBody() {
  const handle = (which, label) =>
    `<input type="range" class="clips-trim__h" data-trim-h="${which}" min="${t.lo}" max="${t.hi}" step="500" value="${which === "start" ? t.startMs : t.endMs}" aria-label="${label}" />`;
  return `
    <p class="clip-trim-modal__sub">${t.mode === "add" ? "Move where the clip starts and ends. It runs 30 seconds to begin with." : "Move where the clip starts and ends. You can go 2 minutes either side."}</p>
    ${player()}
    <div class="clip-trim-modal__bar">
      <button type="button" class="ap-button stroked grey" data-trim-play><i class="ap-icon-play" aria-hidden="true"></i><span>Play the clip</span></button>
      <span class="clips-trim__read" data-trim-read aria-live="polite"></span>
      ${
        t.mode === "add"
          ? `<button type="button" class="ap-button ghost grey" data-trim-back><i class="ap-icon-arrow-left" aria-hidden="true"></i><span>Pick another moment</span></button>`
          : `<button type="button" class="ap-button ghost grey" data-trim-reset>Reset</button>`
      }
    </div>
    ${strip(`<span class="clips-trim__out is-before" data-trim-out="before"></span>
      <span class="clips-trim__out is-after" data-trim-out="after"></span>
      <span class="clips-trim__sel" data-trim-sel></span>
      <span class="clips-trim__head" data-trim-head hidden></span>
      ${handle("start", "Start")}${handle("end", "End")}`)}`;
}

function paint() {
  stop();
  if (finding()) Object.assign(t, { lo: 0, hi: t.video.durationMs });
  else
    Object.assign(t, { lo: Math.max(0, t.from.startMs - PAD), hi: Math.min(t.video.durationMs, t.from.endMs + PAD) });
  document.getElementById("clipTrimBody").innerHTML = finding() ? findBody() : cutBody();
  const save = $("[data-trim-save]");
  save.hidden = finding();
  save.textContent = t.mode === "add" ? "Add clip" : "Save trim";
  if (finding()) seekTo(t.at);
  else sync();
  paintThumbs();
}

function seekTo(ms) {
  t.at = Math.max(t.lo, Math.min(t.hi, ms));
  $("[data-trim-seek]").value = t.at;
  $("[data-trim-head]").style.left = pct(t.at);
  $("[data-trim-read]").textContent = `${fmtMs(t.at)} of ${fmtMs(t.video.durationMs)}`;
  const video = $("[data-trim-video]");
  if (!t.raf) video.currentTime = t.at / 1000;
}

// The handles can't cross (a clip lasts a second at least); the frame under
// the one being moved shows in the player.
function sync(moved = "start") {
  $('[data-trim-h="start"]').value = t.startMs;
  $('[data-trim-h="end"]').value = t.endMs;
  $('[data-trim-out="before"]').style.width = pct(t.startMs);
  $('[data-trim-out="after"]').style.left = pct(t.endMs);
  const sel = $("[data-trim-sel]");
  sel.style.left = pct(t.startMs);
  sel.style.right = `calc(100% - ${pct(t.endMs)})`;
  $("[data-trim-read]").textContent =
    `Start ${fmtMs(t.startMs)} · End ${fmtMs(t.endMs)} · ${fmtMs(t.endMs - t.startMs)} long`;
  $("[data-trim-reset]")?.toggleAttribute("disabled", !changed());
  $("[data-trim-save]").disabled = t.mode === "trim" && !changed();
  stop();
  $("[data-trim-video]").currentTime = (moved === "end" ? t.endMs - 300 : t.startMs) / 1000;
}

// Play: on Find the video runs on (the playhead follows); on Cut it plays the
// clip and stops at its end.
function play() {
  if (t.raf) return stop();
  const video = $("[data-trim-video]");
  const head = $("[data-trim-head]");
  if (!finding()) video.currentTime = t.startMs / 1000;
  video.play().catch(() => {});
  head.hidden = false;
  const tick = () => {
    const ms = video.currentTime * 1000;
    if (finding()) {
      t.at = ms;
      $("[data-trim-seek]").value = ms;
      $("[data-trim-read]").textContent = `${fmtMs(ms)} of ${fmtMs(t.video.durationMs)}`;
    }
    head.style.left = pct(ms);
    if (!finding() && ms >= t.endMs) return stop();
    t.raf = requestAnimationFrame(tick);
    return undefined;
  };
  t.raf = requestAnimationFrame(tick);
  $("[data-trim-play] span").textContent = "Pause";
  $("[data-trim-play] i").className = "ap-icon-pause";
  return undefined;
}

function stop() {
  if (!t?.raf) return;
  cancelAnimationFrame(t.raf);
  t.raf = 0;
  $("[data-trim-video]")?.pause();
  const head = $("[data-trim-head]");
  if (head && !finding()) head.hidden = true;
  const btn = $("[data-trim-play]");
  if (btn) {
    btn.querySelector("span").textContent = finding() ? "Play" : "Play the clip";
    btn.querySelector("i").className = "ap-icon-play";
  }
}

// The filmstrip: one more stream, seeked across the window, each frame
// painted into its canvas.
function paintThumbs() {
  t.thumbs?.removeAttribute("src");
  const canvases = [...modal.querySelectorAll(".clips-trim__thumbs canvas")];
  const src = document.createElement("video");
  src.muted = true;
  src.preload = "auto";
  src.src = t.video.url;
  t.thumbs = src;
  const { lo, hi } = t;
  let i = 0;
  const next = () => {
    if (i >= canvases.length || t?.thumbs !== src) return src.removeAttribute("src");
    src.currentTime = (lo + ((hi - lo) * (i + 0.5)) / canvases.length) / 1000;
    return undefined;
  };
  src.addEventListener("seeked", () => {
    const cv = canvases[i];
    if (!cv) return;
    cv.width = 160;
    cv.height = 90;
    try {
      cv.getContext("2d").drawImage(src, 0, 0, 160, 90);
    } catch {}
    i++;
    next();
  });
  src.addEventListener("loadedmetadata", next, { once: true });
}

// « Start the clip here »: 30 seconds from the playhead (pulled back if the
// video ends sooner), then the cut step on that range.
function mark() {
  const startMs = Math.max(0, Math.min(Math.round(t.at), t.video.durationMs - NEW_CLIP_MS));
  t.from = { startMs, endMs: Math.min(t.video.durationMs, startMs + NEW_CLIP_MS) };
  Object.assign(t, t.from, { step: "cut" });
  paint();
}

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("clipTrimBackdrop");
  modal = document.getElementById("clipTrimModal");
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-trim-close]")) return close();
    if (e.target.closest("[data-trim-save]")) return save();
    if (e.target.closest("[data-trim-play]")) return play();
    if (e.target.closest("[data-trim-mark]")) return mark();
    if (e.target.closest("[data-trim-back]")) {
      t.step = "find";
      return paint();
    }
    if (e.target.closest("[data-trim-reset]")) {
      Object.assign(t, t.from);
      return sync();
    }
    return undefined;
  });
  modal.addEventListener("input", (e) => {
    if (!t) return;
    if (e.target.closest("[data-trim-seek]")) {
      stop();
      return seekTo(Number(e.target.value));
    }
    const h = e.target.closest("[data-trim-h]");
    if (!h) return undefined;
    const ms = Number(h.value);
    if (h.dataset.trimH === "start") t.startMs = Math.min(ms, t.endMs - 1000);
    else t.endMs = Math.max(ms, t.startMs + 1000);
    return sync(h.dataset.trimH);
  });
  bindOverlayDismissal({ modal, backdrop, close });
  initialized = true;
}

function save() {
  if (!t || finding() || (t.mode === "trim" && !changed())) return;
  const { onSave, startMs, endMs } = t;
  close();
  onSave?.({ startMs, endMs });
}

function show(state, title, focusSel) {
  injectOnce();
  requestOpen(MODAL_ID, close);
  t = { raf: 0, thumbs: null, ...state };
  document.getElementById("clipTrimTitle").textContent = title;
  paint();
  showOverlay(modal, backdrop);
  document.body.classList.add("has-modal");
  setTimeout(() => $(focusSel)?.focus({ preventScroll: true }), 0);
}

export function open({ video, clip, onSave }) {
  const from = { startMs: clip.startMs, endMs: clip.endMs };
  show({ mode: "trim", step: "cut", video, from, ...from, onSave }, `Trim: ${clip.title}`, '[data-trim-h="start"]');
}

// Add: the playhead starts at the first stretch no clip covers.
export function openAdd({ video, onSave }) {
  const edges = [...video.clips].sort((a, b) => a.startMs - b.startMs);
  let at = 0;
  for (const c of edges) {
    if (c.startMs - at >= NEW_CLIP_MS) break;
    at = Math.max(at, c.endMs);
  }
  show(
    { mode: "add", step: "find", video, at: Math.min(at, video.durationMs), onSave },
    "Add a clip",
    "[data-trim-seek]",
  );
}

function close() {
  if (!initialized || !t) return;
  stop();
  t.thumbs?.removeAttribute("src");
  $("[data-trim-video]")?.removeAttribute("src");
  t = null;
  hideOverlay(modal, backdrop);
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
