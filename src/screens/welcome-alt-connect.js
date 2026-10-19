// /welcome-alt/connect — under flag connectFirst, connecting the social profiles
// before the onboarding chat (after /welcome-alt/intro, welcome-alt-intro.js).
//
// Modelled on Agorapulse's own Archie signup step (core-mfe archie-connect-page):
// one row per network, the connected profiles beside them, "Start using Archie"
// once one is connected. The two beats stay the product's (DECISIONS.md §
// Connecting an account): the row asks, connect-account-modal consents. Skipping
// stays possible — behind the same skip-with-reasons dialog as the chat step —
// so the ask comes first without becoming a prerequisite.

import { html, raw } from "../utils.js?v=1922";
import {
  getConnectedProfiles,
  getConnectableNetworks,
  renderProfileTag,
  subscribe,
} from "../social-profiles.js?v=1922";
import { accountIdsForNetwork } from "../connect-profiles-flow.js?v=1922";
import { open as openConnectAccountModal } from "../components/connect-account-modal.js?v=1922";
import { open as openSkipConnectModal } from "../components/skip-connect-modal.js?v=1922";
import { recordReasons } from "../feedback-store.js?v=1922";
import { showToast } from "../components/toast.js?v=1922";
import { SKIP_CONNECT_TARGET } from "../context-builder.js?v=1922";
import { startOnboardingChat } from "./welcome-alt.js?v=1922";

function networkRow(net) {
  return html`
    <li>
      <button type="button" class="welcome-connect__network" data-connect-network="${net.platform}">
        <span class="welcome-connect__glyph"><i class="${net.icon}" aria-hidden="true"></i></span>
        <span class="welcome-connect__network-name">${net.label}</span>
        <i class="ap-icon-plus welcome-connect__network-add" aria-hidden="true"></i>
      </button>
    </li>
  `;
}

function paint(target) {
  const connected = getConnectedProfiles();
  const networks = getConnectableNetworks();
  const none = connected.length === 0;
  target.innerHTML = html`
    <div class="welcome-screen welcome-connect">
      <div class="welcome-connect__layout">
        <section class="welcome-connect__card" aria-labelledby="welcomeConnectTitle">
          <h1 class="welcome-connect__title" id="welcomeConnectTitle">
            Almost there! It's time to add your first profile
          </h1>
          <p class="welcome-connect__sub">
            Connect the accounts you publish from. I'll learn your tone and format from them — nothing publishes without
            you.
          </p>
          ${networks.length
            ? raw(`<ul class="welcome-connect__networks">${networks.map(networkRow).join("")}</ul>`)
            : raw(`<p class="welcome-connect__sub">Every account you have is connected.</p>`)}
          <div class="welcome-connect__footer">
            ${none
              ? raw(`<button type="button" class="ap-button ghost blue" data-welcome-skip>
                  <span>Skip for now</span>
                </button>`)
              : ""}
            <button type="button" class="ap-button primary orange" data-welcome-start ${none ? raw("disabled") : ""}>
              <span>Start using Archie</span>
              <i class="ap-icon-arrow-right"></i>
            </button>
          </div>
        </section>
        ${none
          ? ""
          : raw(html`
              <aside class="welcome-connect__card welcome-connect__panel" aria-labelledby="welcomeConnectedTitle">
                <h2 class="welcome-connect__panel-title" id="welcomeConnectedTitle">Connected profiles</h2>
                <ul class="welcome-connect__profiles">
                  ${connected.map((p) => `<li>${renderProfileTag(p)}</li>`)}
                </ul>
              </aside>
            `)}
      </div>
    </div>
  `;
}

export function renderWelcomeAltConnect(_params, target) {
  paint(target);
  const unsubscribe = subscribe(() => paint(target));

  const onClick = (event) => {
    const row = event.target.closest("[data-connect-network]");
    if (row) {
      const network = row.dataset.connectNetwork;
      // The modal connects; the subscription repaints. Cancel leaves the screen as is.
      openConnectAccountModal({ network, preselected: accountIdsForNetwork(network) });
      return;
    }
    if (event.target.closest("[data-welcome-start]")) {
      startOnboardingChat();
      return;
    }
    if (event.target.closest("[data-welcome-skip]")) {
      openSkipConnectModal({
        onSkip: (reasons, comment) => {
          recordReasons(SKIP_CONNECT_TARGET, { reasons, comment }, { kind: "skip", step: "connect-profiles" });
          showToast("Noted — I'll ask again when I write your first draft.");
          startOnboardingChat();
        },
      });
    }
  };
  target.addEventListener("click", onClick);

  return () => {
    unsubscribe();
    target.removeEventListener("click", onClick);
  };
}
