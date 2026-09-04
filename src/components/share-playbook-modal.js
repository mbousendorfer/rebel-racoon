// Share a Playbook — the one surface where a Playbook's reach is decided.
//
// Two states, not a recipient list: a Playbook is either mine alone, or it's in
// front of the whole organisation. That was the product call, and it's what
// makes this a radio pair instead of a people picker. The distinction the doc
// asks to underline isn't "who receives it" but "who may USE it vs who may EDIT
// it" — so both cards say it in as many words.
//
// It also holds the two things that only make sense once a Playbook is shared:
// who owns it (and handing that over), and the change log. Neither belongs on
// the Playbook page itself — the fiche answers "who are you?", not "who touched
// this?" (CONCEPTS.md §1).
//
// Public API:
//   init()  — inject markup + bind once on app boot
//   open({ contextId, onDone })
//     • onDone() — fired after a committed change (scope or ownership), so the
//       caller can repaint or bail out if it just handed away its own access.

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=1059";
import { getContextById, updateContext, appendHistory } from "../contexts-store.js?v=1059";
import { canTransfer, isMine, actingOnBehalf, ownerName } from "../playbook-access.js?v=1059";
import { MEMBERS, ORG, CURRENT_USER, getMember, memberName } from "../org.js?v=1059";
import { showToast } from "./toast.js?v=1059";
import { html, raw, escapeHtml } from "../utils.js?v=1059";

const MODAL_ID = "sharePlaybook";

let backdrop, modal, subtitleEl, contentEl, saveBtn, cancelBtn, closeBtn;
let initialized = false;
let activeId = null;
let pendingOnDone = null;
// The scope currently picked in the radio pair — read back on Save. Kept in a
// variable rather than off the DOM so a re-render of the body can restore it.
let picked = "personal";
let transferTo = null;

const HTML = `
<div class="app-modal-backdrop share-playbook-modal__backdrop" id="sharePlaybookBackdrop" hidden></div>
<aside
  class="ap-dialog share-playbook-modal"
  id="sharePlaybookModal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="sharePlaybookTitle"
  aria-hidden="true"
>
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="sharePlaybookTitle">Share this Playbook</span>
    <span class="ap-dialog-subtitle" id="sharePlaybookSubtitle"></span>
  </div>
  <button class="ap-dialog-close" type="button" id="sharePlaybookClose" aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="ap-dialog-content" id="sharePlaybookContent"></div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button transparent grey" id="sharePlaybookCancel">Cancel</button>
      <button type="button" class="ap-button primary blue" id="sharePlaybookSave">Save</button>
    </div>
  </div>
</aside>`;

function avatar(member) {
  const initials = member?.initials || "?";
  return html`<span class="ap-avatar size-24" aria-hidden="true"
    ><span class="ap-avatar-initials">${initials}</span></span
  >`;
}

function renderScopeCards(ctx) {
  const org = `${escapeHtml(ORG.name)}`;
  return html`
    <div class="share-playbook-modal__options" role="radiogroup" aria-label="Who can use this Playbook">
      <label class="ap-radio-card card share-playbook-modal__option">
        <input type="radio" name="playbookScope" value="personal" ${raw(picked === "personal" ? "checked" : "")} />
        <div>
          <span class="ap-radio-card-title">
            <i class="ap-icon-lock-on" aria-hidden="true"></i>
            Just me
          </span>
          <span>Nobody else in ${raw(org)} can see it or use it.</span>
        </div>
      </label>

      <label class="ap-radio-card card share-playbook-modal__option">
        <input
          type="radio"
          name="playbookScope"
          value="organization"
          ${raw(picked === "organization" ? "checked" : "")}
        />
        <div>
          <span class="ap-radio-card-title">
            <i class="ap-icon-multiple-users" aria-hidden="true"></i>
            Everyone at ${raw(org)}
          </span>
          <span
            >All ${ORG.memberCount} of them can read it and write with it. You stay the only one who can change
            it.</span
          >
        </div>
      </label>
    </div>
  `;
}

// Only shown on the way OUT of sharing, and only when somebody is actually
// relying on it. Say the consequence before it happens, not in a toast after.
function renderConsequence(ctx) {
  const leaving = ctx.scope === "organization" && picked === "personal";
  const chats = ctx.usedIn || 0;
  if (!leaving) return "";
  const who = chats === 1 ? "1 chat" : `${chats} chats`;
  const body = chats
    ? `${who} across ${escapeHtml(ORG.name)} still run on this Playbook. They keep the drafts already written — they can save and schedule those — but they won't be able to generate anything new.`
    : `Anyone in ${escapeHtml(ORG.name)} who opened it loses access. Playbooks they duplicated from it are their own and stay untouched.`;
  return html`
    <div class="ap-infobox warning share-playbook-modal__warn">
      <i class="ap-icon-warning" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-message">${raw(body)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderTransfer(ctx) {
  if (!canTransfer(ctx)) return "";
  const owner = getMember(ctx.ownerId);
  const target = transferTo ? getMember(transferTo) : null;
  const candidates = MEMBERS.filter((m) => m.id !== ctx.ownerId);
  const options = candidates
    .map((m) => {
      const on = m.id === transferTo;
      return html`<div
        class="ap-select-option${raw(on ? " selected" : "")}"
        data-share-owner="${m.id}"
        role="option"
        aria-selected="${on ? "true" : "false"}"
      >
        <span class="ap-select-option-text">${m.name}${raw(m.id === CURRENT_USER.id ? " (you)" : "")}</span>
        ${raw(on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : "")}
      </div>`;
    })
    .join("");

  return html`
    <div class="share-playbook-modal__owner">
      <span class="share-playbook-modal__owner-label">Owner</span>
      <span class="share-playbook-modal__owner-who">
        ${raw(avatar(owner))}
        <span>${raw(owner ? escapeHtml(owner.name) : "a teammate")}${raw(isMine(ctx) ? " (you)" : "")}</span>
      </span>
    </div>
    <details class="share-playbook-modal__handover">
      <summary>Hand it over to someone else<i class="ap-icon-chevron-down" aria-hidden="true"></i></summary>
      <div class="share-playbook-modal__handover-row">
        <details class="ap-select share-playbook-modal__ownerselect">
          <summary class="ap-select-trigger">
            <span class="ap-select-value"
              >${raw(
                target ? escapeHtml(target.name) : `<span class="ap-select-placeholder">Choose a teammate…</span>`,
              )}</span
            >
            <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
          </summary>
          <div class="ap-select-dropdown" role="listbox" aria-label="New owner">
            <div class="ap-select-options">${raw(options)}</div>
          </div>
        </details>
        <button
          type="button"
          class="ap-button stroked grey share-playbook-modal__transfer"
          data-share-transfer
          ${raw(transferTo ? "" : "disabled")}
        >
          <i class="ap-icon-user--arrow-right" aria-hidden="true"></i>
          <span>Transfer</span>
        </button>
      </div>
      <p class="share-playbook-modal__handover-note">
        They become the only person who can edit it${raw(isMine(ctx) ? " — including instead of you" : "")}.
      </p>
    </details>
  `;
}

function renderLog(ctx) {
  const entries = Array.isArray(ctx.history) ? ctx.history.slice().reverse() : [];
  if (!entries.length) return "";
  const rows = entries
    .map(
      (e) =>
        html`<li class="share-playbook-modal__log-row">
          <span class="share-playbook-modal__log-who">${raw(escapeHtml(memberName(e.actorId)))}</span>
          <span class="share-playbook-modal__log-what">${e.action}</span>
          <span class="share-playbook-modal__log-when">${e.when}</span>
        </li>`,
    )
    .join("");
  return html`
    <details class="share-playbook-modal__log">
      <summary>Recent changes<i class="ap-icon-chevron-down" aria-hidden="true"></i></summary>
      <ul class="share-playbook-modal__log-list">
        ${raw(rows)}
      </ul>
    </details>
  `;
}

function renderBody() {
  const ctx = getContextById(activeId);
  if (!ctx) return;
  subtitleEl.textContent = ctx.name;
  contentEl.innerHTML = [renderScopeCards(ctx), renderConsequence(ctx), renderTransfer(ctx), renderLog(ctx)].join("");
  // One meaningful action: Save commits a scope change and nothing else, so it
  // stands down when the pick matches what's already true. Transfer has its own
  // button because it's a different decision, not a variant of this one.
  saveBtn.disabled = picked === ctx.scope;
  saveBtn.textContent = picked === "organization" ? "Share with the org" : "Make it private";
}

function injectOnce() {
  if (initialized) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);

  backdrop = document.getElementById("sharePlaybookBackdrop");
  modal = document.getElementById("sharePlaybookModal");
  subtitleEl = document.getElementById("sharePlaybookSubtitle");
  contentEl = document.getElementById("sharePlaybookContent");
  saveBtn = document.getElementById("sharePlaybookSave");
  cancelBtn = document.getElementById("sharePlaybookCancel");
  closeBtn = document.getElementById("sharePlaybookClose");

  cancelBtn.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  bindOverlayDismissal({ modal, backdrop, close });
  saveBtn.addEventListener("click", commitScope);

  contentEl.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="playbookScope"]')) return;
    picked = event.target.value === "organization" ? "organization" : "personal";
    renderBody();
  });

  contentEl.addEventListener("click", (event) => {
    const owner = event.target.closest("[data-share-owner]");
    if (owner) {
      transferTo = owner.dataset.shareOwner;
      renderBody();
      // renderBody() rebuilds the body, which would collapse the disclosure the
      // click happened inside — reopen it so the Transfer button stays reachable.
      contentEl.querySelector(".share-playbook-modal__handover")?.setAttribute("open", "");
      return;
    }
    if (event.target.closest("[data-share-transfer]")) commitTransfer();
  });

  initialized = true;
}

export function init() {
  injectOnce();
}

// Every write goes through here: the log line is part of the change, not an
// afterthought, and acting on someone else's Playbook owes them a heads-up.
function record(ctx, action) {
  appendHistory(ctx.id, action);
  if (actingOnBehalf(ctx)) showToast(`${ownerName(ctx)} will be notified.`);
}

function commitScope() {
  const ctx = getContextById(activeId);
  if (!ctx || picked === ctx.scope) return;
  const target = picked;
  const action =
    target === "organization" ? "shared it with the organisation" : "stopped sharing it with the organisation";
  record(ctx, action);
  updateContext(ctx.id, { scope: target });
  const fn = pendingOnDone;
  close();
  showToast(
    target === "organization"
      ? `Everyone at ${ORG.name} can now use “${ctx.name}”.`
      : `“${ctx.name}” is yours alone again.`,
  );
  if (typeof fn === "function") fn();
}

function commitTransfer() {
  const ctx = getContextById(activeId);
  if (!ctx || !transferTo || transferTo === ctx.ownerId) return;
  const to = getMember(transferTo);
  record(ctx, `handed it over to ${to?.name || "a teammate"}`);
  updateContext(ctx.id, { ownerId: transferTo });
  const fn = pendingOnDone;
  close();
  showToast(`“${ctx.name}” now belongs to ${to?.name || "a teammate"}.`);
  if (typeof fn === "function") fn();
}

export function open({ contextId, onDone = null } = {}) {
  const ctx = getContextById(contextId);
  if (!ctx) return;
  injectOnce();
  requestOpen(MODAL_ID, close);

  activeId = contextId;
  pendingOnDone = onDone;
  picked = ctx.scope === "organization" ? "organization" : "personal";
  transferTo = null;
  renderBody();

  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");

  setTimeout(() => {
    contentEl.querySelector('input[name="playbookScope"]:checked')?.focus({ preventScroll: true });
  }, 0);
}

function close() {
  if (!initialized) return;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  activeId = null;
  pendingOnDone = null;
  transferTo = null;
  notifyClose(MODAL_ID);
}
