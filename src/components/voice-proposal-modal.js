// A network's voice, given where there is no chat (flag voicePerNetwork) — the
// Playbook's network tab, the Clips space, a draft's feedback. One dialog, two
// moments, the same as the chat's (network-voice-flow.js):
//   openVoiceInterview — the few questions, as fields, each optional;
//   openVoiceProposal  — learning takes a moment (its phases), then what
//     Archie proposes, shown (learnedVoiceHtml): Edit in the Playbook (opens
//     it there, unsaved) · Use this voice (saves it). Closing saves nothing.
//
// Public API:
//   openVoiceInterview({ net, onDone(answers), onCancel? })
//   openVoiceProposal({ ctxId, net, choice?, from?, voice?, phases?, only?,
//                       title?, useLabel?, onUse?(voice), onCancel? })
//     Learned from `choice` / `from`, after its phases — or `voice`, already
//     made: after `phases` if given, else at once (a draft's feedback).
//     `only`: the rules the proposal adds (shown alone).
//     onUse runs after the voice is saved.

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2255";
import { getContextById } from "../contexts-store.js?v=2255";
import { networkLabel } from "../social-profiles.js?v=2255";
import {
  INTERVIEW,
  learnPhases,
  LEARN_PHASE_MS,
  proposeNetworkVoice,
  saveNetworkVoice,
  editNetworkVoiceInPlaybook,
} from "../network-voice-flow.js?v=2255";
import { learnedVoiceHtml } from "./voice-intro-modal.js?v=2255";
import { escapeHtml } from "../utils.js?v=2255";

const MODAL_ID = "voice-proposal";

let backdrop, modal, titleEl, bodyEl, footEl;
let current = null; // { kind: "interview" | "proposal", …the open call's options, voice? }
let timers = [];

const HTML = `
<div class="app-modal-backdrop" id="voiceProposalBackdrop" hidden></div>
<aside class="ap-dialog voice-proposal-modal" id="voiceProposalModal" role="dialog" aria-modal="true"
  aria-labelledby="voiceProposalTitle" aria-hidden="true">
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="voiceProposalTitle"></span>
  </div>
  <button class="ap-dialog-close" type="button" data-vp-action="close" aria-label="Close"><i class="ap-icon-close"></i></button>
  <div class="ap-dialog-content" id="voiceProposalBody"></div>
  <div class="ap-dialog-footer"><div class="ap-dialog-footer-right" id="voiceProposalFoot"></div></div>
</aside>`;

function injectOnce() {
  if (modal) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("voiceProposalBackdrop");
  modal = document.getElementById("voiceProposalModal");
  titleEl = document.getElementById("voiceProposalTitle");
  bodyEl = document.getElementById("voiceProposalBody");
  footEl = document.getElementById("voiceProposalFoot");
  modal.addEventListener("click", (e) => {
    const action = e.target.closest("[data-vp-action]")?.dataset.vpAction;
    if (action === "close") cancel();
    else if (action === "answers") submitAnswers();
    else if (action === "use") use();
    else if (action === "edit") edit();
  });
  bindOverlayDismissal({ modal, backdrop, close: cancel });
}

const button = (action, kind, label, disabled = false) =>
  `<button type="button" class="ap-button ${kind}" data-vp-action="${action}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;

function show() {
  injectOnce();
  requestOpen(MODAL_ID, cancel);
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
}

export function openVoiceInterview({ net, onDone, onCancel = null }) {
  const label = networkLabel(net);
  show();
  current = { kind: "interview", net, onDone, onCancel };
  titleEl.textContent = `How you write on ${label}`;
  bodyEl.innerHTML = `
    <p class="voice-proposal-modal__lead">Answer in your own words. Leave any question empty.</p>
    ${INTERVIEW.map(
      (q) => `<div class="ap-form-field">
        <label for="vp-${q.key}">${escapeHtml(q.ask(label))}</label>
        <div class="ap-textarea-field resizable">
          <textarea id="vp-${q.key}" rows="2" data-vp-answer="${q.key}"></textarea>
        </div>
      </div>`,
    ).join("")}`;
  footEl.innerHTML = button("close", "ghost grey", "Cancel") + button("answers", "primary orange", "Write the rules");
  setTimeout(() => bodyEl.querySelector("textarea")?.focus({ preventScroll: true }), 0);
}

function submitAnswers() {
  const c = current;
  const answers = Object.fromEntries(
    [...bodyEl.querySelectorAll("[data-vp-answer]")]
      .map((t) => [t.dataset.vpAnswer, t.value.trim()])
      .filter(([, v]) => v),
  );
  if (!Object.keys(answers).length) return bodyEl.querySelector("textarea")?.focus();
  hide();
  c.onDone(answers);
}

export function openVoiceProposal(opts) {
  const { ctxId, net, choice = "learn", from = null, voice = null } = opts;
  const label = networkLabel(net);
  show();
  current = { kind: "proposal", ...opts };
  titleEl.textContent = opts.title || `New rules for ${label}`;
  footEl.innerHTML =
    button("close", "ghost grey", "Cancel") +
    button("use", "primary blue", opts.useLabel || "Add to Voice profile", true);
  // Learning takes a moment, and says what it's doing.
  const phases = opts.phases || (voice ? null : learnPhases(net, from));
  if (!phases) return showProposal(voice);
  bodyEl.innerHTML = `<p class="voice-proposal-modal__phase" data-vp-phase>${escapeHtml(phases[0])}</p>`;
  phases.slice(1).forEach((p, i) =>
    timers.push(
      setTimeout(
        () => {
          const el = bodyEl.querySelector("[data-vp-phase]");
          if (el) el.textContent = p;
        },
        LEARN_PHASE_MS * (i + 1),
      ),
    ),
  );
  timers.push(
    setTimeout(
      () => showProposal(voice || proposeNetworkVoice(getContextById(ctxId), net, choice, from)),
      LEARN_PHASE_MS * phases.length,
    ),
  );
}

function showProposal(voice) {
  const c = current;
  c.voice = voice;
  bodyEl.innerHTML = learnedVoiceHtml(getContextById(c.ctxId), c.net, voice, { only: c.only || null });
  footEl.innerHTML =
    button("edit", "stroked grey", "Edit in the Playbook") +
    button("use", "primary blue", c.useLabel || "Add to Voice profile");
  footEl.querySelector(".primary").focus({ preventScroll: true });
}

function use() {
  const c = current;
  if (!c?.voice) return;
  hide();
  saveNetworkVoice(c.ctxId, c.net, c.voice);
  c.onUse?.(c.voice);
}

function edit() {
  const c = current;
  if (!c?.voice) return;
  hide();
  editNetworkVoiceInPlaybook(c.ctxId, c.net, c.voice);
}

function cancel() {
  const c = current;
  hide();
  c?.onCancel?.();
}

function hide() {
  if (!modal) return;
  timers.forEach(clearTimeout);
  timers = [];
  current = null;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
