// /welcome-alt/connect — flag connectFirst: connecting the social profiles,
// the first step of the run, in the onboarding shell (welcome-alt-shell.js).
//
// The two beats stay the product's (DECISIONS.md § Connecting an account): a
// network row asks, connect-account-modal consents. What's connected is listed
// on top and lands on the Playbook card on the right as it happens. Skipping
// stays possible behind skip-connect-modal (its reasons are optional), so the
// ask comes first without becoming a prerequisite.

import { html, raw, escapeHtml } from "../utils.js?v=2038";
import {
  getConnectedProfiles,
  getConnectableNetworks,
  NETWORK_ICON_BY_PLATFORM,
  NETWORK_LABEL,
  BRAND_INITIALS,
  subscribe as subscribeProfiles,
} from "../social-profiles.js?v=2038";
import { accountIdsForNetwork } from "../connect-profiles-flow.js?v=2038";
import { open as openConnectAccountModal } from "../components/connect-account-modal.js?v=2038";
import { open as openSkipConnectModal } from "../components/skip-connect-modal.js?v=2038";
import { recordReasons } from "../feedback-store.js?v=2038";
import { SKIP_CONNECT_TARGET, syncAltProfiles } from "../context-builder.js?v=2038";
import { ensureFlowDraft, goBack, goNext, mountShell } from "./welcome-alt-shell.js?v=2038";

function connectedRow(p) {
  const inner = p.photo
    ? `<img src="${escapeHtml(p.photo)}" alt="" />`
    : `<span class="ap-avatar-initials">${escapeHtml(p.initials || BRAND_INITIALS)}</span>`;
  return html`
    <li class="welcome-flow__option is-static">
      <span class="ap-avatar size-32" aria-hidden="true">
        ${raw(inner)}<span class="ap-avatar-network"><i class="${NETWORK_ICON_BY_PLATFORM[p.platform]}"></i></span>
      </span>
      <span class="welcome-flow__option-text">
        <span class="welcome-flow__option-title">${p.name || p.handle}</span>
        <span class="welcome-flow__option-desc">${NETWORK_LABEL[p.platform] || p.platformLabel || ""}</span>
      </span>
      <span class="welcome-flow__connected"><i class="ap-icon-check" aria-hidden="true"></i>Connected</span>
    </li>
  `;
}

function networkRow(net) {
  return html`
    <li>
      <button type="button" class="welcome-flow__option" data-connect-network="${net.platform}">
        <span class="welcome-flow__glyph"><i class="${net.icon}" aria-hidden="true"></i></span>
        <span class="welcome-flow__option-text">
          <span class="welcome-flow__option-title">${net.label}</span>
          <span class="welcome-flow__option-desc">${net.kinds}</span>
        </span>
        <i class="ap-icon-plus welcome-flow__option-add" aria-hidden="true"></i>
      </button>
    </li>
  `;
}

function left() {
  const connected = getConnectedProfiles();
  const networks = getConnectableNetworks();
  const none = connected.length === 0;
  return html`
    <h1 class="welcome-flow__title" id="welcomeFlowTitle">Connect your accounts</h1>
    <p class="welcome-intro__sub">I'll write for the networks you publish on. Nothing gets posted without your OK.</p>
    <ul class="welcome-flow__options">
      ${connected.map(connectedRow)} ${networks.map(networkRow)}
    </ul>
    <div class="welcome-flow__actions">
      <button type="button" class="ap-button ghost grey" data-flow-back>
        <i class="ap-icon-arrow-left"></i><span>Back</span>
      </button>
      ${none ? raw(`<button type="button" class="ap-button ghost grey" data-welcome-skip>Skip for now</button>`) : ""}
      <button type="button" class="ap-button primary blue" data-flow-next ${none ? raw("disabled") : ""}>
        <span>Continue</span>
      </button>
    </div>
  `;
}

export function renderWelcomeAltConnect(_params, target) {
  const sid = ensureFlowDraft();
  const shell = mountShell(target, { step: "connect", sid, left });
  const offProfiles = subscribeProfiles(shell.paint);

  const next = () => {
    syncAltProfiles(sid);
    goNext("connect");
  };
  const onClick = (event) => {
    const row = event.target.closest("[data-connect-network]");
    if (row) {
      const network = row.dataset.connectNetwork;
      // The modal connects; the subscriptions repaint. Cancel leaves the screen as is.
      openConnectAccountModal({ network, preselected: accountIdsForNetwork(network) });
    } else if (event.target.closest("[data-flow-next]")) next();
    else if (event.target.closest("[data-flow-back]")) goBack("connect");
    else if (event.target.closest("[data-welcome-skip]")) {
      openSkipConnectModal({
        onSkip: (reasons, comment) => {
          if (reasons.length || comment) {
            recordReasons(SKIP_CONNECT_TARGET, { reasons, comment }, { kind: "skip", step: "connect-profiles" });
          }
          next();
        },
      });
    }
  };
  target.addEventListener("click", onClick);
  return () => {
    shell.cleanup();
    offProfiles();
    target.removeEventListener("click", onClick);
  };
}
