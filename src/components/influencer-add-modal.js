// "Add influencers" — the one dialog every entry point opens: the Playbook's
// Influencers section, the Topic Feed's invitation card, and the Influencers
// card of /topics/settings.
//
//   init()                                          — inject markup + bind once on boot
//   openInfluencerAdd({ playbookName, taken, onSubmit }) — onSubmit(entries) on Add
//
// The dialog does not write anything itself: the Playbook section stages into
// its draft (a Playbook being created is not saved yet), the feed and the
// settings page write to the saved Playbook. Each host says how in `onSubmit`.
//
// Several in a row, because the empty state asks for "one or more": a checked
// profile is staged below the field, the field clears for the next one, and the
// footer's button counts what will be added. The check itself is
// influencer-flow.js — a pasted profile link, refused with its reason when the
// network's API cannot read it.

import { requestOpen, notifyClose } from "../modal-coordinator.js?v=1419";
import { escapeHtml } from "../utils.js?v=1419";
import { NETWORK_ICON_BY_PLATFORM, NETWORK_LABEL } from "../social-profiles.js?v=1419";
import { checkInfluencerProfile, CHECK_MS } from "../influencer-flow.js?v=1419";

const MODAL_ID = "influencer-add";

let backdrop, modal, subEl, inputEl, checkBtn, msgEl, stagedEl, submitBtn;
let initialized = false;
let state = null;

const HTML = `
<div class="app-modal-backdrop" id="infAddBackdrop" hidden></div>
<aside
  class="ap-dialog influencer-add"
  id="infAddModal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="infAddTitle"
  aria-hidden="true"
>
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="infAddTitle">Add influencers</span>
  </div>
  <button class="ap-dialog-close" type="button" data-inf-add-close aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="ap-dialog-content influencer-add__content">
    <p class="influencer-add__sub" id="infAddSub"></p>
    <div class="ap-form-field">
      <label for="infAddInput">Profile link</label>
      <div class="influencer-add__row">
        <div class="ap-input-group">
          <i class="ap-icon-link" aria-hidden="true"></i>
          <input
            id="infAddInput"
            type="url"
            placeholder="https://www.instagram.com/…"
            spellcheck="false"
            autocomplete="off"
            aria-describedby="infAddMsg infAddNetworks"
          />
        </div>
        <button type="button" class="ap-button stroked grey" id="infAddCheck" disabled>
          <span>Add</span>
        </button>
      </div>
      <p class="ap-form-message error" id="infAddMsg" role="alert" hidden></p>
      <p class="influencer-add__networks" id="infAddNetworks">
        Instagram business and creator accounts, Facebook Pages and YouTube channels.
      </p>
    </div>
    <div class="influencer-add__staged" id="infAddStaged" hidden></div>
  </div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" data-inf-add-close>Cancel</button>
      <button type="button" class="ap-button primary blue" id="infAddSubmit" disabled>
        <span>Add influencers</span>
      </button>
    </div>
  </div>
</aside>`;

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);

  backdrop = document.getElementById("infAddBackdrop");
  modal = document.getElementById("infAddModal");
  subEl = document.getElementById("infAddSub");
  inputEl = document.getElementById("infAddInput");
  checkBtn = document.getElementById("infAddCheck");
  msgEl = document.getElementById("infAddMsg");
  stagedEl = document.getElementById("infAddStaged");
  submitBtn = document.getElementById("infAddSubmit");

  backdrop.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-inf-add-close]")) return close();
    const remove = event.target.closest("[data-inf-add-unstage]");
    if (remove) {
      state.staged.splice(Number(remove.dataset.infAddUnstage), 1);
      paint();
      inputEl.focus();
    }
  });
  inputEl.addEventListener("input", () => {
    state.error = "";
    paint();
  });
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      // An empty field with profiles staged: Enter means "done", like the footer.
      if (!inputEl.value.trim() && state.staged.length) submit();
      else check();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  checkBtn.addEventListener("click", check);
  submitBtn.addEventListener("click", submit);

  initialized = true;
}

function takenNow() {
  return new Set([...state.taken, ...state.staged.map((e) => e.key)]);
}

function check() {
  if (!state || state.checking) return;
  const raw = inputEl.value;
  if (!raw.trim()) return;
  state.checking = true;
  state.error = "";
  paint();
  setTimeout(() => {
    if (!state) return;
    state.checking = false;
    const res = checkInfluencerProfile(raw, takenNow());
    if (res.ok) {
      state.staged.push(res.entry);
      inputEl.value = "";
    } else {
      state.error = res.reason;
    }
    paint();
    inputEl.focus();
  }, CHECK_MS);
}

function paint() {
  const hasText = !!inputEl.value.trim();
  checkBtn.disabled = !hasText || state.checking;
  checkBtn.innerHTML = state.checking
    ? `<span class="ap-loader small"></span><span>Checking…</span>`
    : `<span>Add</span>`;
  inputEl.disabled = state.checking;

  const group = inputEl.closest(".ap-input-group");
  group.classList.toggle("invalid", !!state.error);
  inputEl.setAttribute("aria-invalid", state.error ? "true" : "false");
  msgEl.hidden = !state.error;
  msgEl.textContent = state.error;

  const n = state.staged.length;
  stagedEl.hidden = !n;
  stagedEl.innerHTML = n
    ? `<span class="influencer-add__staged-label">Ready to add</span>
       <ul class="influencer-add__list">${state.staged
         .map(
           (e, i) => `
         <li class="influencer-add__item">
           <i class="${NETWORK_ICON_BY_PLATFORM[e.network]}" aria-hidden="true"></i>
           <span class="influencer-add__who">
             <span class="influencer-add__name">${escapeHtml(e.name)}</span>
             <span class="influencer-add__meta">${escapeHtml(NETWORK_LABEL[e.network] || e.network)} · @${escapeHtml(
               e.handle,
             )}</span>
           </span>
           <span class="ap-tag green mini">Checked</span>
           <button type="button" class="ap-icon-button stroked transparent" data-inf-add-unstage="${i}" aria-label="Remove ${escapeHtml(
             e.name,
           )}" title="Remove"><i class="ap-icon-trash"></i></button>
         </li>`,
         )
         .join("")}</ul>`
    : "";

  submitBtn.disabled = !n || state.checking;
  submitBtn.innerHTML = `<span>${n > 1 ? `Add ${n} influencers` : n === 1 ? "Add 1 influencer" : "Add influencers"}</span>`;
}

function submit() {
  if (!state || !state.staged.length || state.checking) return;
  const entries = state.staged.slice();
  const fn = state.onSubmit;
  close();
  if (typeof fn === "function") fn(entries);
}

export function init() {
  injectOnce();
}

export function openInfluencerAdd({ playbookName = "", taken = new Set(), onSubmit = null } = {}) {
  injectOnce();
  requestOpen(MODAL_ID, close);
  state = { taken, staged: [], error: "", checking: false, onSubmit };
  subEl.textContent =
    `Paste the profile of a creator ${playbookName ? `${playbookName}'s` : "your"} audience follows. ` +
    "Every week I read their new posts and bring the ones worth it to your Topic Feed.";
  inputEl.value = "";
  paint();

  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  setTimeout(() => inputEl?.focus({ preventScroll: true }), 0);
}

export function close() {
  if (!initialized) return;
  state = null;
  backdrop.classList.remove("open");
  backdrop.hidden = true;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
