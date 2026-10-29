// « Add a clip » — the one moment a clip's range is chosen. Once the clip
// exists its start and end are fixed (prod can't retrim), so the Clips space
// asks for them here and nowhere else. Same init/open/close pattern as the
// rename-modal.
//
// Public API:
//   open({ durationMs, startMs, endMs, onSubmit })  — onSubmit({ startMs, endMs })

import { requestOpen, notifyClose } from "../modal-coordinator.js?v=2485";
import { fmtPrecise, parseTime, MIN_CLIP_MS, MAX_CLIP_MS } from "../screens/clips/shared.js?v=2485";

const MODAL_ID = "clip-range";

let backdrop, modal, startEl, endEl, msgEl, lenEl, addBtn;
let initialized = false;
let pending = null;
let duration = 0;

const HTML = `
<div class="app-modal-backdrop" id="clipRangeBackdrop" hidden></div>
<aside class="ap-dialog clip-range-modal" id="clipRangeModal" role="dialog" aria-modal="true" aria-labelledby="clipRangeTitle" aria-hidden="true">
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="clipRangeTitle">Add a clip</span>
  </div>
  <button class="ap-dialog-close" type="button" data-clip-range-close aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="ap-dialog-content">
    <p class="clip-range-modal__sub">Pick where it starts and ends in the video. You can't change it once the clip is made.</p>
    <div class="clip-range-modal__fields">
      <div class="ap-form-field">
        <label for="clipRangeStart">Start</label>
        <div class="ap-input-group"><input id="clipRangeStart" type="text" inputmode="decimal" aria-describedby="clipRangeMsg" /></div>
      </div>
      <div class="ap-form-field">
        <label for="clipRangeEnd">End</label>
        <div class="ap-input-group"><input id="clipRangeEnd" type="text" inputmode="decimal" aria-describedby="clipRangeMsg" /></div>
      </div>
    </div>
    <p class="clip-range-modal__len" id="clipRangeLen"></p>
    <p class="ap-form-message error" id="clipRangeMsg" role="alert" hidden></p>
  </div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" data-clip-range-close>Cancel</button>
      <button type="button" class="ap-button primary blue" id="clipRangeAdd">Add clip</button>
    </div>
  </div>
</aside>`;

// The range typed, or why it can't be one.
function read() {
  const s = parseTime(startEl.value);
  const e = parseTime(endEl.value);
  if (s == null || e == null) return { error: "Type a time like 1:32.5" };
  if (e > duration) return { error: `The video ends at ${fmtPrecise(duration)}.` };
  if (e - s < MIN_CLIP_MS) return { error: "A clip runs 5 seconds at least." };
  if (e - s > MAX_CLIP_MS) return { error: "A clip runs 5 minutes at most." };
  return { startMs: Math.round(s), endMs: Math.round(e) };
}

function validate() {
  const r = read();
  const bad = !!r.error;
  msgEl.hidden = !bad;
  msgEl.textContent = r.error || "";
  lenEl.hidden = bad;
  lenEl.textContent = bad ? "" : `${fmtPrecise(r.endMs - r.startMs)} long`;
  [startEl, endEl].forEach((el) => el.closest(".ap-input-group").classList.toggle("invalid", bad));
  addBtn.disabled = bad;
  return r;
}

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("clipRangeBackdrop");
  modal = document.getElementById("clipRangeModal");
  startEl = document.getElementById("clipRangeStart");
  endEl = document.getElementById("clipRangeEnd");
  msgEl = document.getElementById("clipRangeMsg");
  lenEl = document.getElementById("clipRangeLen");
  addBtn = document.getElementById("clipRangeAdd");

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-clip-range-close]")) close();
    else if (e.target.closest("#clipRangeAdd")) submit();
  });
  backdrop.addEventListener("click", close);
  modal.addEventListener("input", validate);
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  initialized = true;
}

function submit() {
  const r = validate();
  if (r.error) return;
  const fn = pending;
  close();
  fn?.(r);
}

export function open({ durationMs, startMs, endMs, onSubmit }) {
  injectOnce();
  requestOpen(MODAL_ID, close);
  duration = durationMs;
  pending = onSubmit;
  startEl.value = fmtPrecise(startMs);
  endEl.value = fmtPrecise(endMs);
  validate();
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  setTimeout(() => {
    startEl.focus({ preventScroll: true });
    startEl.select();
  }, 0);
}

function close() {
  if (!initialized) return;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  pending = null;
  notifyClose(MODAL_ID);
}
