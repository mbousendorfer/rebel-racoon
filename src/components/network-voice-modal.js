// The voice step before a draft, as a dialog — for a surface with no chat to
// ask in (the Clips space). Same question and same answers as the chat's step
// (network-voice-flow.js), one group per network without a voice, the best
// answer checked; Cancel writes nothing. A document asks for it in its own
// dialog (backing out of it brings this one back); « Edit it myself » leaves
// for the Playbook, and the drafts aren't written.
//
// Public API:
//   requireNetworkVoicesInDialog(contextId, networks, onReady)
//   onReady() runs IMMEDIATELY when every network already has a voice — always
//   the case with the flag off — so callers wrap unconditionally.

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2230";
import { getContextById } from "../contexts-store.js?v=2230";
import { networkLabel, networkIcon } from "../social-profiles.js?v=2230";
import {
  missingNetworkVoices,
  voiceChoices,
  applyNetworkVoice,
  editNetworkVoiceInPlaybook,
  documentName,
} from "../network-voice-flow.js?v=2230";
import { open as openFillDocumentModal } from "./fill-document-modal.js?v=2230";
import { escapeHtml } from "../utils.js?v=2230";

const MODAL_ID = "network-voice";

let backdrop, modal, titleEl, bodyEl, confirmBtn;
let pending = null; // { contextId, networks, onReady }

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
      <button type="button" class="ap-button primary orange" data-nv-confirm>Write the drafts</button>
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

const groupHtml = (net) => {
  const { items } = voiceChoices(net);
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

export function requireNetworkVoicesInDialog(contextId, networks, onReady) {
  const missing = missingNetworkVoices(getContextById(contextId), networks);
  if (!missing.length) return onReady();
  injectOnce();
  requestOpen(MODAL_ID, close);
  pending = { contextId, networks: missing, allNetworks: networks, onReady };
  titleEl.textContent =
    missing.length === 1
      ? `${networkLabel(missing[0])} needs a voice first`
      : `${missing.length} networks need a voice first`;
  bodyEl.innerHTML = `<p class="network-voice-modal__lead">I write every draft in its network's voice. Choose one before I write.</p>${missing
    .map(groupHtml)
    .join("")}`;
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
    modal.querySelector(`input[name="nv-${net}"]:checked`)?.value || "plain",
  ]);
  close();
  picks.forEach(([net, choice]) => ["learn", "plain"].includes(choice) && applyNetworkVoice(p.contextId, net, choice));
  const edit = picks.find(([, choice]) => choice === "edit");
  if (edit) return editNetworkVoiceInPlaybook(p.contextId, edit[0]);
  learnFromDocuments(
    p,
    picks.filter(([, choice]) => choice === "document").map(([net]) => net),
  );
}

// One document per network that asked for one, then the drafts.
function learnFromDocuments(p, [net, ...rest]) {
  if (!net) return p.onReady();
  openFillDocumentModal({
    onConfirm: ({ file, url }) => {
      applyNetworkVoice(p.contextId, net, "document", file?.name || documentName(url));
      learnFromDocuments(p, rest);
    },
    onDismiss: () => requireNetworkVoicesInDialog(p.contextId, p.allNetworks, p.onReady),
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
