// Trim, in a dialog of its own that does nothing else (2026-11-20, asked:
// « le Trim fait dans une modale spécifique qui ne permet de faire que ça »).
// Prod's clip-trim-modal: the source playing, one window of 2 minutes either
// side of the clip (TRIM_PADDING_SECONDS), no length rule, « Trim: <title> »,
// Cancel / Save trim. On top of prod: a filmstrip of that window under the
// two handles, the frame under the handle you move, Play for the cut.
//
// Public API:
//   open({ video, clip, onSave })   — onSave({ startMs, endMs }), only when it changed

import {
  requestOpen,
  notifyClose,
  bindOverlayDismissal,
  showOverlay,
  hideOverlay,
} from "../modal-coordinator.js?v=2809";
import { escapeHtml } from "../utils.js?v=2809";
import { fmtMs } from "../screens/clips/shared.js?v=2809";

const MODAL_ID = "clip-trim";
const PAD = 120000;
const THUMBS = 12;

let backdrop, modal;
let initialized = false;
// { video, from: {startMs,endMs}, startMs, endMs, lo, hi, onSave, raf, thumbs }
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

function body() {
  const handle = (which, label) =>
    `<input type="range" class="clips-trim__h" data-trim-h="${which}" min="${t.lo}" max="${t.hi}" step="500" value="${which === "start" ? t.startMs : t.endMs}" aria-label="${label}" />`;
  return `
    <p class="clip-trim-modal__sub">Move where the clip starts and ends. You can go 2 minutes either side.</p>
    <div class="clips-trim__player clip-trim-modal__player">
      <video data-trim-video src="${escapeHtml(t.video.url)}" muted playsinline preload="metadata"></video>
    </div>
    <div class="clip-trim-modal__bar">
      <button type="button" class="ap-button stroked grey" data-trim-play><i class="ap-icon-play" aria-hidden="true"></i><span>Play the clip</span></button>
      <span class="clips-trim__read" data-trim-read aria-live="polite"></span>
      <button type="button" class="ap-button ghost grey" data-trim-reset>Reset</button>
    </div>
    <div class="clips-trim__strip">
      <div class="clips-trim__thumbs" aria-hidden="true">${"<canvas></canvas>".repeat(THUMBS)}</div>
      <span class="clips-trim__out is-before" data-trim-out="before"></span>
      <span class="clips-trim__out is-after" data-trim-out="after"></span>
      <span class="clips-trim__sel" data-trim-sel></span>
      <span class="clips-trim__head" data-trim-head hidden></span>
      ${handle("start", "Start")}${handle("end", "End")}
    </div>
    <span class="clips-trim__scale"><span>${fmtMs(t.lo)}</span><span>${fmtMs(t.hi)}</span></span>`;
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
  $("[data-trim-reset]").disabled = !changed();
  $("[data-trim-save]").disabled = !changed();
  stop();
  $("[data-trim-video]").currentTime = (moved === "end" ? t.endMs - 300 : t.startMs) / 1000;
}

function play() {
  if (t.raf) return stop();
  const video = $("[data-trim-video]");
  const head = $("[data-trim-head]");
  video.currentTime = t.startMs / 1000;
  video.play().catch(() => {});
  head.hidden = false;
  const tick = () => {
    const ms = video.currentTime * 1000;
    head.style.left = pct(ms);
    if (ms >= t.endMs) return stop();
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
  $("[data-trim-video]").pause();
  $("[data-trim-head]").hidden = true;
  $("[data-trim-play] span").textContent = "Play the clip";
  $("[data-trim-play] i").className = "ap-icon-play";
}

// The filmstrip: one more stream, seeked across the window, each frame
// painted into its canvas.
function paintThumbs() {
  const canvases = [...modal.querySelectorAll(".clips-trim__thumbs canvas")];
  const src = document.createElement("video");
  src.muted = true;
  src.preload = "auto";
  src.src = t.video.url;
  t.thumbs = src;
  let i = 0;
  const next = () => {
    if (i >= canvases.length || t?.thumbs !== src) return src.removeAttribute("src");
    src.currentTime = (t.lo + ((t.hi - t.lo) * (i + 0.5)) / canvases.length) / 1000;
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
    if (e.target.closest("[data-trim-reset]")) {
      Object.assign(t, t.from);
      return sync();
    }
    return undefined;
  });
  modal.addEventListener("input", (e) => {
    const h = e.target.closest("[data-trim-h]");
    if (!h || !t) return;
    const ms = Number(h.value);
    if (h.dataset.trimH === "start") t.startMs = Math.min(ms, t.endMs - 1000);
    else t.endMs = Math.max(ms, t.startMs + 1000);
    sync(h.dataset.trimH);
  });
  bindOverlayDismissal({ modal, backdrop, close });
  initialized = true;
}

function save() {
  if (!t || !changed()) return;
  const { onSave, startMs, endMs } = t;
  close();
  onSave?.({ startMs, endMs });
}

export function open({ video, clip, onSave }) {
  injectOnce();
  requestOpen(MODAL_ID, close);
  const from = { startMs: clip.startMs, endMs: clip.endMs };
  t = {
    video,
    from,
    ...from,
    lo: Math.max(0, from.startMs - PAD),
    hi: Math.min(video.durationMs, from.endMs + PAD),
    onSave,
    raf: 0,
    thumbs: null,
  };
  document.getElementById("clipTrimTitle").textContent = `Trim: ${clip.title}`;
  document.getElementById("clipTrimBody").innerHTML = body();
  sync();
  paintThumbs();
  showOverlay(modal, backdrop);
  document.body.classList.add("has-modal");
  setTimeout(() => $('[data-trim-h="start"]')?.focus({ preventScroll: true }), 0);
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
