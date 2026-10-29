// Assign drafts for review — the Agorapulse approval workflow (CONCEPTS §6:
// a workflow belongs to the platform, so it attaches to the Draft, never the
// Playbook). One reviewer, an optional due date, an optional comment. On
// confirm the caller moves the drafts OUT of the chat, like Schedule and Save:
// they now wait in that person's review queue, not here.
//
// Public API:
//   init()  — inject markup + bind once on app boot
//   open({ posts, onConfirm, reviewerId? })
//     • posts      — the drafts to assign (all must pass validatePost — the
//                    callers gate it; this dialog doesn't re-check)
//     • onConfirm({ reviewer, dueAt, comment }) — reviewer is a MEMBERS or
//                    EXTERNAL_REVIEWERS entry; dueAt a datetime-local string
//                    or null; comment a trimmed string ("" when empty)
//     • reviewerId — preselects someone (the chat's "send these to Julie")
//   reviewBlock(reviewer, posts) → null | { tag, why } — why someone can't be
//                    picked; the same rule the picker greys rows with.
//
// The shell is the save-folder dialog's (.open class, modal-coordinator); the
// picker is the share dialog's (.ap-select trigger + DS Selection Dropdown,
// disabled rows that say why with an `ap-tag grey mini` + tooltip).

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2417";
import { MEMBERS, EXTERNAL_REVIEWERS, CURRENT_USER, getReviewer, hasProfileAccess } from "../org.js?v=2417";
import { profileForNetwork } from "../social-profiles.js?v=2417";
import { html, raw, escapeText, escapeAttr } from "../utils.js?v=2417";

const MODAL_ID = "assignReview";

let backdrop, modal, titleEl, contentEl, confirmBtn;
let initialized = false;
let state = emptyState();

function emptyState() {
  return { posts: [], reviewerId: null, dueAt: null, comment: "", query: "", onConfirm: null };
}

const fold = (text) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// Why this person can't review these drafts — or null. External reviewers
// approve through a link, with no seat and so no profile gate.
export function reviewBlock(reviewer, posts) {
  if (!reviewer || reviewer.external) return null;
  const first = reviewer.name.split(" ")[0];
  if (!reviewer.canApprove) return { tag: "Can't approve", why: `${first}'s role can't approve posts in Agorapulse` };
  for (const post of posts) {
    const profile = profileForNetwork(post.network);
    if (profile && !hasProfileAccess(reviewer.id, profile.id))
      return { tag: "No access", why: `${first} can't reach ${profile.handle || profile.name} in Agorapulse` };
  }
  return null;
}

const HTML = `
<div class="app-modal-backdrop assign-modal__backdrop" id="assignReviewBackdrop" hidden></div>
<aside class="ap-dialog assign-modal" id="assignReviewModal" role="dialog" aria-modal="true"
  aria-labelledby="assignReviewTitle" aria-hidden="true">
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="assignReviewTitle">Assign for review</span>
    <span class="ap-dialog-subtitle">They leave this chat and wait for approval in Agorapulse.</span>
  </div>
  <button class="ap-dialog-close" type="button" data-assign-close aria-label="Close (Esc)">
    <i class="ap-icon-close"></i>
  </button>
  <div class="ap-dialog-content assign-modal__body" id="assignReviewContent"></div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" data-assign-close>Cancel</button>
      <button type="button" class="ap-button primary blue" id="assignReviewConfirm" data-assign-confirm>Assign</button>
    </div>
  </div>
</aside>`;

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("assignReviewBackdrop");
  modal = document.getElementById("assignReviewModal");
  titleEl = document.getElementById("assignReviewTitle");
  contentEl = document.getElementById("assignReviewContent");
  confirmBtn = document.getElementById("assignReviewConfirm");

  bindOverlayDismissal({ modal, backdrop, close });
  modal.addEventListener("click", onClick);
  modal.addEventListener("change", onChange);
  modal.addEventListener("input", onInput);
  initialized = true;
}

function onClick(event) {
  const picker = modal.querySelector("[data-assign-pop]");
  if (picker?.open && !picker.contains(event.target)) picker.open = false;
  if (event.target.closest("[data-assign-close]")) return close();
  if (event.target.closest("[data-assign-confirm]")) return submit();
  if (event.target.closest("[data-assign-due-pick]")) {
    const input = modal.querySelector("[data-assign-due-input]");
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
    return;
  }
  if (event.target.closest("[data-assign-due-clear]")) {
    state.dueAt = null;
    render();
  }
}

function onChange(event) {
  const row = event.target.closest("[data-assign-reviewer]");
  if (row) {
    state.reviewerId = row.checked ? row.value : null;
    state.query = "";
    render();
    return;
  }
  if (event.target.matches("[data-assign-due-input]")) {
    state.dueAt = event.target.value || null;
    render();
  }
}

// Typing filters rows in place (no re-render, so the search keeps its focus);
// the comment is read on submit and mirrored so a re-render keeps it.
function onInput(event) {
  if (event.target.matches("[data-assign-comment]")) {
    state.comment = event.target.value;
    return;
  }
  if (!event.target.matches("[data-assign-search]")) return;
  state.query = event.target.value;
  const q = fold(state.query.trim());
  let visible = 0;
  modal.querySelectorAll("[data-assign-row]").forEach((row) => {
    const hit = !q || row.dataset.assignRow.includes(q);
    row.classList.toggle("is-hidden", !hit);
    if (hit) visible++;
  });
  modal.querySelector("[data-assign-nomatch]").hidden = visible > 0;
}

function avatar(person) {
  return `<span class="ap-avatar size-24" aria-hidden="true"><span class="ap-avatar-initials">${escapeText(person.initials)}</span></span>`;
}

function renderRow(person) {
  const block = reviewBlock(person, state.posts);
  const on = state.reviewerId === person.id;
  return html`<label
    class="ap-selection-dropdown-item assign-modal__row${raw(block ? " is-disabled" : "")}"
    data-assign-row="${fold(`${person.name} ${person.org || ""}`)}"
  >
    <span class="ap-checkbox-container">
      <input
        type="checkbox"
        value="${person.id}"
        data-assign-reviewer
        ${raw(on ? "checked" : "")}
        ${raw(block ? "disabled" : "")}
      />
      <i></i>
    </span>
    ${raw(avatar(person))}
    <span class="assign-modal__row-name">${person.name}</span>
    ${raw(person.org ? `<span class="assign-modal__row-org">${escapeText(person.org)}</span>` : "")}
    ${raw(
      block
        ? `<span class="ap-tag grey mini" data-tooltip="${escapeAttr(block.why)}">${escapeText(block.tag)}</span>`
        : "",
    )}
  </label>`;
}

// Never an empty picker: the external reviewers are config and always there,
// so the list has rows even when nobody in the org can approve.
function renderPicker() {
  const team = MEMBERS.filter((m) => m.id !== CURRENT_USER.id);
  const picked = getReviewer(state.reviewerId);
  const value = picked
    ? `${avatar(picked)}<span>${escapeText(picked.name)}</span>`
    : `<span class="ap-select-placeholder">Choose a reviewer…</span>`;
  return html`
    <details class="ap-select assign-modal__picker" data-assign-pop>
      <summary class="ap-select-trigger" id="assignReviewer">
        <span class="ap-select-value">${raw(value)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-selection-dropdown assign-modal__pop">
        <div class="ap-selection-dropdown-search">
          <i class="ap-icon-search" aria-hidden="true"></i>
          <input
            type="text"
            data-assign-search
            placeholder="Search people…"
            aria-label="Search reviewers"
            autocomplete="off"
          />
        </div>
        <div class="ap-selection-dropdown-items" role="group" aria-label="Reviewers">
          <div class="ap-selection-dropdown-group">Team members</div>
          ${raw(team.map(renderRow).join(""))}
          <div class="ap-selection-dropdown-group">External users</div>
          ${raw(EXTERNAL_REVIEWERS.map(renderRow).join(""))}
          <div class="ap-selection-dropdown-empty" data-assign-nomatch hidden>Nobody matches your search.</div>
        </div>
      </div>
    </details>
  `;
}

function formatDue(value) {
  const d = new Date(value);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

function renderDue() {
  const pick = (label) =>
    `<button type="button" class="ap-button ghost blue" data-assign-due-pick><i class="ap-icon-calendar"></i><span>${label}</span></button>`;
  return `<div class="assign-modal__due">
    ${
      state.dueAt
        ? `<span class="assign-modal__due-value">${escapeText(formatDue(state.dueAt))}</span>
           ${pick("Change")}
           <button type="button" class="ap-icon-button" data-assign-due-clear aria-label="Remove the due date" data-tooltip="Remove the due date"><i class="ap-icon-close"></i></button>`
        : pick("Add a due date")
    }
    <input type="datetime-local" class="assign-modal__due-input" data-assign-due-input value="${escapeAttr(state.dueAt || "")}" tabindex="-1" aria-hidden="true" />
  </div>`;
}

function render() {
  const n = state.posts.length;
  const noun = n === 1 ? "post" : "posts";
  titleEl.textContent = `Assign ${n} ${noun} for review`;
  contentEl.innerHTML = `
    <div class="ap-form-field">
      <label for="assignReviewer">Reviewer</label>
      ${renderPicker()}
    </div>
    <div class="ap-form-field">
      <label>Due date <span class="assign-modal__optional">· optional</span></label>
      ${renderDue()}
    </div>
    <div class="ap-form-field">
      <label for="assignReviewComment">Comment <span class="assign-modal__optional">· optional</span></label>
      <div class="ap-textarea-field resizable">
        <textarea id="assignReviewComment" rows="3" data-assign-comment placeholder="What should they look at?">${escapeText(state.comment)}</textarea>
      </div>
    </div>`;
  confirmBtn.textContent = `Assign ${n} ${noun}`;
  confirmBtn.disabled = !state.reviewerId;
}

function submit() {
  const reviewer = getReviewer(state.reviewerId);
  if (!reviewer) return;
  const fn = state.onConfirm;
  const payload = { reviewer, dueAt: state.dueAt, comment: state.comment.trim() };
  close();
  fn?.(payload);
}

export function init() {
  injectOnce();
}

export function open({ posts, onConfirm, reviewerId = null } = {}) {
  if (!posts?.length) return;
  injectOnce();
  requestOpen(MODAL_ID, close);
  // A preselected reviewer who can't take these drafts is dropped, not forced.
  const pre = getReviewer(reviewerId);
  state = {
    ...emptyState(),
    posts: [...posts],
    reviewerId: pre && !reviewBlock(pre, posts) ? pre.id : null,
    onConfirm: typeof onConfirm === "function" ? onConfirm : null,
  };
  render();
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  setTimeout(() => modal.querySelector(".ap-select-trigger")?.focus({ preventScroll: true }), 0);
}

function close() {
  if (!initialized) return;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  state = emptyState();
  notifyClose(MODAL_ID);
}
