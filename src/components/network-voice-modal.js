// The voice step before a draft, as a dialog — for a surface with no chat to
// ask in (the Clips space). The same choices as everywhere (network-voice-flow
// voiceChoices), one group per network, the best answer checked; Cancel writes
// nothing. Then, network by network: a document asks for it in its own dialog,
// the questions in theirs, and what Archie learned is shown before it's used
// (voice-proposal-modal); backing out of any of them brings this one back.
// « Edit it myself » or « Edit in the Playbook » leave for the Playbook, and
// the drafts aren't written.
//
// Public API:
//   requireNetworkVoicesInDialog(contextId, networks, onReady, { giving })
//   onReady() runs IMMEDIATELY when every network already has a voice — always
//   the case with the flag off — so callers wrap unconditionally.
//   `giving` (« Give X its own voice » on a draft): asked even for a network on
//   the default voice, without that answer.

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2289";
import { getContextById } from "../contexts-store.js?v=2289";
import { networkLabel, networkIcon } from "../social-profiles.js?v=2289";
import {
  missingNetworkVoices,
  voiceChoices,
  useDefaultVoice,
  editNetworkVoiceInPlaybook,
  documentName,
} from "../network-voice-flow.js?v=2289";
import { open as openFillDocumentModal } from "./fill-document-modal.js?v=2289";
import { openVoiceProposal, openVoiceInterview } from "./voice-proposal-modal.js?v=2289";
import { escapeHtml } from "../utils.js?v=2289";

const MODAL_ID = "network-voice";

let backdrop, modal, titleEl, bodyEl, confirmBtn;
let pending = null; // { contextId, networks, allNetworks, onReady, giving }

const HTML = `
<div class="app-modal-backdrop" id="networkVoiceBackdrop" hidden></div>
<aside class="ap-dialog network-voice-modal" id="networkVoiceModal" role="dialog" aria-modal="true"
  aria-labelledby="networkVoiceTitle" aria-hidden="true">
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="networkVoiceTitle"></span>
  </div>
  <button class="ap-dialog-close" type="button" data-nv-close aria-label="Close"><i class="ap-icon-close"></i></button>
  <div class="ap-dialog-content" id="networkVoiceBody"></div>
  <div class="ap-dialog-footer">
    <div class="ap-dialog-footer-right">
      <button type="button" class="ap-button ghost grey" data-nv-close>Cancel</button>
      <button type="button" class="ap-button primary orange" data-nv-confirm>Continue</button>
    </div>
  </div>
</aside>`;

function injectOnce() {
  if (modal) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("networkVoiceBackdrop");
  modal = document.getElementById("networkVoiceModal");
  titleEl = document.getElementById("networkVoiceTitle");
  bodyEl = document.getElementById("networkVoiceBody");
  confirmBtn = modal.querySelector("[data-nv-confirm]");
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-nv-close]")) close();
    else if (e.target.closest("[data-nv-confirm]")) confirm();
  });
  bindOverlayDismissal({ modal, backdrop, close });
}

const groupHtml = (net, giving) => {
  const { items } = voiceChoices(net, { needed: !giving });
  return `<fieldset class="network-voice-modal__group">
    <legend class="network-voice-modal__legend"><i class="${networkIcon(net)}" aria-hidden="true"></i>How should I write on ${escapeHtml(networkLabel(net))}?</legend>
    ${items
      .map(
        (i, k) => `<label class="network-voice-modal__choice">
          <span class="ap-radio-container"><input type="radio" name="nv-${escapeHtml(net)}" value="${i.value}" ${k ? "" : "checked"} /></span>
          <span class="network-voice-modal__text"><span class="network-voice-modal__name">${escapeHtml(i.label)}</span><span class="network-voice-modal__hint">${escapeHtml(i.caption)}</span></span>
        </label>`,
      )
      .join("")}
  </fieldset>`;
};

export function requireNetworkVoicesInDialog(contextId, networks, onReady, { giving = false } = {}) {
  const missing = giving ? networks : missingNetworkVoices(getContextById(contextId), networks);
  if (!missing.length) return onReady();
  injectOnce();
  requestOpen(MODAL_ID, close);
  pending = { contextId, networks: missing, allNetworks: networks, onReady, giving };
  const one = networkLabel(missing[0]);
  titleEl.textContent = giving
    ? `Find what works on ${one}`
    : missing.length === 1
      ? `How should I write on ${one}?`
      : `How should I write on these ${missing.length} networks?`;
  bodyEl.innerHTML = `<p class="network-voice-modal__lead">${
    giving
      ? `These drafts use your default voice. Once ${escapeHtml(one)} has its own rules, you can rewrite each one.`
      : `I don't know how you write on ${missing.length === 1 ? escapeHtml(one) : "these networks"} yet. Pick how I should learn it before I write.`
  }</p>${missing.map((n) => groupHtml(n, giving)).join("")}`;
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  setTimeout(() => confirmBtn.focus({ preventScroll: true }), 0);
}

function confirm() {
  const p = pending;
  if (!p) return;
  const picks = p.networks.map((net) => [
    net,
    modal.querySelector(`input[name="nv-${net}"]:checked`)?.value || "default",
  ]);
  close();
  const edit = picks.find(([, choice]) => choice === "edit");
  if (edit) return editNetworkVoiceInPlaybook(p.contextId, edit[0]);
  picks.filter(([, choice]) => choice === "default").forEach(([net]) => useDefaultVoice(p.contextId, net));
  giveVoices(
    p,
    picks.filter(([, choice]) => choice !== "default"),
  );
}

// Network by network: the source (a document, the questions), then what
// Archie learned, used — then the drafts. Backing out brings the step back.
function giveVoices(p, [pick, ...rest]) {
  if (!pick) return p.onReady();
  const [net, choice] = pick;
  const back = () => requireNetworkVoicesInDialog(p.contextId, p.allNetworks, p.onReady, { giving: p.giving });
  const propose = (from = null) =>
    openVoiceProposal({
      ctxId: p.contextId,
      net,
      choice,
      from,
      onUse: () => giveVoices(p, rest),
      onCancel: back,
    });
  if (choice === "learn") return propose();
  if (choice === "interview") return openVoiceInterview({ net, onDone: propose, onCancel: back });
  openFillDocumentModal({
    onConfirm: ({ file, url }) => propose(file?.name || documentName(url)),
    onDismiss: back,
  });
}

function close() {
  if (!modal) return;
  pending = null;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
