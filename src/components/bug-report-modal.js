// "Report a bug" dialog. Self-contained: injects HTML into <body> on init(),
// then open()/close() toggle its visibility. No store — the modal has
// ephemeral local state that resets on each open.
//
// Adapted from the shared Content Studio prototype, trimmed down to the
// pieces that make sense for Archie:
//   - category chips (Visual glitch / Wrong behavior / Feature not working /
//     Performance / Other)
//   - "What were you trying to do?" free-text
//   - "What went wrong?" required textarea
//   - Screenshot: an optional upload. The auto-capture (html2canvas) was
//     removed on 2026-10-28: it never parsed the DS's color() CSS, and the
//     maintained fork drew icons as solid squares, so it promised a
//     screenshot it couldn't take.
//   - Context footer showing the current route + time
//
// On submit we simulate a ~1.4s round-trip and flash a success state; the
// modal then closes itself. Nothing is actually posted.

import { escapeHtml, formatTimeOfDay } from "../utils.js?v=2548";
import { getSessionById } from "../sessions-store.js?v=2548";
import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2548";
import { dropzoneHTML, bindDropzone } from "./dropzone.js?v=2548";

const MODAL_ID = "bugReport";

let backdrop, modal, submitBtn, problemInput, actionInput, problemError;
let categoriesEl, previewEl, dropzoneFallback, dropzone, fileInput;
let previewImg, fileNameEl, contextBar;
let selectedCategory = null;
let screenshotDataUrl = null;
let initialized = false;
// Stays false until the user clicks Submit once. Avoids yelling at
// people who haven't tried yet.
let hasAttemptedSubmit = false;

const CATEGORY_LABELS = {
  visual: "Visual glitch",
  behavior: "Wrong behavior",
  broken: "Feature not working",
  performance: "Performance",
  other: "Other",
};

const HTML = `
<div class="app-modal-backdrop bug-report-modal__backdrop" id="bugReportBackdrop" hidden></div>
<aside
  class="ap-dialog bug-report-modal"
  id="bugReportModal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="bugReportTitle"
  aria-describedby="bugReportDescription"
  aria-hidden="true"
>
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="bugReportTitle">Report a bug</span>
    <span class="ap-dialog-subtitle" id="bugReportDescription">Tell me what happened. I'll send the page you're on with it.</span>
  </div>
  <button class="ap-dialog-close" type="button" id="closeBugReportBtn" aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="ap-dialog-content">
    <div class="bug-report-modal__fields">
      <div class="ap-form-field">
        <label>What type of issue?</label>
        <div class="bug-categories" id="bugCategories" role="group" aria-label="Issue type">
          <button type="button" class="ap-filter-chip" data-value="visual" aria-pressed="false">Visual glitch</button>
          <button type="button" class="ap-filter-chip" data-value="behavior" aria-pressed="false">Wrong behavior</button>
          <button type="button" class="ap-filter-chip" data-value="broken" aria-pressed="false">Feature not working</button>
          <button type="button" class="ap-filter-chip" data-value="performance" aria-pressed="false">Performance</button>
          <button type="button" class="ap-filter-chip" data-value="other" aria-pressed="false">Other</button>
        </div>
      </div>

      <div class="ap-form-field">
        <label for="bugActionInput">What were you trying to do?</label>
        <div class="ap-input-group">
          <input id="bugActionInput" type="text" placeholder="e.g. Schedule a post" />
        </div>
      </div>

      <div class="ap-form-field">
        <label for="bugProblemInput">What went wrong? <span class="bug-field__required">*</span></label>
        <div class="ap-textarea-field resizable">
          <textarea id="bugProblemInput" rows="3" required placeholder="e.g. The button did nothing" aria-describedby="bugProblemError"></textarea>
        </div>
        <p class="form-field-error" id="bugProblemError" role="alert" hidden>Describe what went wrong before submitting.</p>
      </div>

      <div class="ap-form-field">
        <label>Screenshot <small>(optional)</small></label>
        <div class="bug-report-dropzone has-file" id="bugScreenshotPreview" hidden>
          <div class="bug-report-preview">
            <img id="bugPreviewImg" src="" alt="Screenshot" />
            <span class="bug-report-preview__name" id="bugFileName">Page screenshot</span>
            <button type="button" class="ap-button transparent grey bug-report-preview__remove" id="bugRemoveFileBtn">Remove</button>
          </div>
        </div>
        <div id="bugDropzoneFallback">
          ${dropzoneHTML({
            id: "bugDropzone",
            lead: "Drop an image here, or",
            sub: "PNG, JPG or GIF, up to 10 MB",
            accept: "image/png,image/jpeg,image/gif",
            inputId: "bugFileInput",
            compact: true,
          })}
        </div>
      </div>

      <div class="bug-context" id="bugContextBar"></div>
    </div>
  </div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" id="cancelBugReportBtn">Cancel</button>
      <button type="button" class="ap-button primary blue" id="submitBugReportBtn">Submit bug report</button>
    </div>
  </div>
  <div class="bug-report-modal__success">
    <div class="bug-report-modal__success-icon">
      <i class="ap-icon-check" aria-hidden="true"></i>
    </div>
    <h3>Bug reported</h3>
    <p>Thanks. I read every report, and this one tells me what to fix.</p>
  </div>
</aside>`;

function focusSafe(el) {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function setScreenshot(dataUrl, name) {
  screenshotDataUrl = dataUrl;
  previewImg.src = dataUrl;
  fileNameEl.textContent = name;
  previewEl.hidden = false;
  dropzoneFallback.hidden = true;
}

function clearScreenshot() {
  screenshotDataUrl = null;
  previewImg.src = "";
  fileNameEl.textContent = "";
  previewEl.hidden = true;
  dropzoneFallback.hidden = false;
  fileInput.value = "";
}

function reset() {
  modal.classList.remove("success");
  selectedCategory = null;
  categoriesEl.querySelectorAll(".ap-filter-chip").forEach((c) => c.classList.remove("selected"));
  actionInput.value = "";
  problemInput.value = "";
  setProblemInvalid(false);
  submitBtn.disabled = false;
  submitBtn.textContent = "Submit bug report";
  clearScreenshot();
  contextBar.innerHTML = "";
  hasAttemptedSubmit = false;
}

function setProblemInvalid(invalid) {
  problemInput.closest(".ap-textarea-field")?.classList.toggle("invalid", invalid);
  if (problemError) problemError.hidden = !invalid;
}

// Archie uses a hash router — the route is the context. We summarise it as
// three pills so the user can see what's going to be attached to the bug.
function currentContext() {
  const hash = window.location.hash || "#/";
  const [path, qs] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(qs || "");
  let area = "Dashboard";
  if (path.startsWith("/session/")) area = "Chat";

  const tab = params.get("tab") || params.get("view");
  // A chat is named by its title, never by its id (2026-10-28).
  const chat = area === "Chat" ? getSessionById(path.split("/")[2])?.name : null;
  const focus = tab ? `${tab}` : chat || (path === "/" || path === "" ? "Home" : path.split("/").pop());

  const now = new Date();
  const time = `${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${formatTimeOfDay(now)}`;
  return { area, focus, time };
}

function populateContext() {
  const { area, focus, time } = currentContext();
  contextBar.innerHTML = `
    <span class="bug-context__label" title="Sent with your report so the team can reproduce it">Attached</span>
    <span class="bug-context__pill">${escapeHtml(area)}</span>
    <span class="bug-context__pill">${escapeHtml(focus)}</span>
    <span class="bug-context__pill">${escapeHtml(time)}</span>
  `;
}

export function open() {
  if (!initialized) init();
  requestOpen(MODAL_ID, close);
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  populateContext();
  window.setTimeout(() => focusSafe(problemInput), 50);
}

function close() {
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  backdrop.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
  reset();
  notifyClose(MODAL_ID);
}

export function init() {
  if (initialized) return;
  initialized = true;
  document.body.insertAdjacentHTML("beforeend", HTML);

  backdrop = document.getElementById("bugReportBackdrop");
  modal = document.getElementById("bugReportModal");
  submitBtn = document.getElementById("submitBugReportBtn");
  problemInput = document.getElementById("bugProblemInput");
  problemError = document.getElementById("bugProblemError");
  actionInput = document.getElementById("bugActionInput");
  categoriesEl = document.getElementById("bugCategories");
  previewEl = document.getElementById("bugScreenshotPreview");
  dropzoneFallback = document.getElementById("bugDropzoneFallback");
  dropzone = document.getElementById("bugDropzone");
  fileInput = document.getElementById("bugFileInput");
  previewImg = document.getElementById("bugPreviewImg");
  fileNameEl = document.getElementById("bugFileName");
  contextBar = document.getElementById("bugContextBar");

  // Close / dismiss
  document.getElementById("closeBugReportBtn").addEventListener("click", close);
  document.getElementById("cancelBugReportBtn").addEventListener("click", close);
  bindOverlayDismissal({ modal, backdrop, close });

  // Category chips — single-select with toggle-off. Keep aria-pressed in
  // sync with the visual selected state so screen readers announce which
  // chip is active.
  categoriesEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".ap-filter-chip");
    if (!chip) return;
    const wasSelected = chip.dataset.value === selectedCategory;
    categoriesEl.querySelectorAll(".ap-filter-chip").forEach((c) => {
      c.classList.remove("selected");
      c.setAttribute("aria-pressed", "false");
    });
    if (!wasSelected) {
      chip.classList.add("selected");
      chip.setAttribute("aria-pressed", "true");
      selectedCategory = chip.dataset.value;
    } else {
      selectedCategory = null;
    }
  });

  // Drop-zone / file upload — shared dropzone behaviour (click / keyboard
  // / drag-drop). Only the first dropped image becomes the screenshot.
  bindDropzone(modal, {
    onFiles: (files) => {
      const file = files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshot(ev.target.result, file.name);
      reader.readAsDataURL(file);
    },
  });
  document.getElementById("bugRemoveFileBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    clearScreenshot();
  });

  problemInput.addEventListener("input", () => {
    if (problemInput.value.trim()) setProblemInvalid(false);
  });
  // Re-validate on blur, but only after the user has tried once.
  problemInput.addEventListener("blur", () => {
    if (hasAttemptedSubmit) setProblemInvalid(!problemInput.value.trim());
  });

  // Submit — no backend; mock a round-trip and show the success panel.
  submitBtn.addEventListener("click", async () => {
    hasAttemptedSubmit = true;
    const problem = problemInput.value.trim();
    if (!problem) {
      setProblemInvalid(true);
      focusSafe(problemInput);
      return;
    }
    setProblemInvalid(false);
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="ap-loader size-16" aria-hidden="true"><svg><circle></circle><circle></circle></svg></span><span>Submitting…</span>`;
    // In a real app we'd post { category, action, problem, screenshot, context }.
    void {
      category: selectedCategory && CATEGORY_LABELS[selectedCategory],
      action: actionInput.value.trim(),
      problem,
      screenshot: screenshotDataUrl,
      context: currentContext(),
    };
    await new Promise((r) => setTimeout(r, 1400));
    modal.classList.add("success");
    setTimeout(close, 2200);
  });
}
