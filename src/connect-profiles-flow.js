// The "connect an account first" step, shared by every chat flow that drafts
// FOR a social account.
//
// Behind the `skipConnectProfiles` flag, Playbook creation no longer asks which
// profile will publish, so a user can reach a draft flow with nothing connected.
// Rather than dead-ending ("connect one in Settings", a page that no longer
// exists), the flow REPLACES its "pick an account" step with this one, in the
// same slot, and resumes where it left off once an account lands.
//
// Public API:
//   requireConnectedProfiles(sessionId, { stepLabel, onReady, onBack })
//
// onReady() runs IMMEDIATELY when at least one account is connected — which is
// always the case with the flag off, so this module is a no-op there. That
// single short-circuit is why callers can wrap unconditionally.

import * as inlineQuestion from "./inline-question.js?v=2591";
import { postAssistantMessage, postUserProfilesTurn } from "./assistant.js?v=2591";
import { getConnectedProfiles, getConnectableNetworks, normalizeNetwork } from "./social-profiles.js?v=2591";
import { getSessionById } from "./sessions-store.js?v=2591";
import { getContextById } from "./contexts-store.js?v=2591";
import { playbookNetworks } from "./voice-parts.js?v=2591";
import { open as openConnectAccountModal } from "./components/connect-account-modal.js?v=2591";

// The connect step's cards — one per NETWORK, laid out like Agorapulse's own
// "Add new social profiles" grid: the network's full-colour glyph, its name,
// and what you connect on it ("Pages", "Professional accounts"). That is the
// product's real unit here — you don't pick from accounts you already have, you
// pick a network and its dialog hands one back.
// Exported because Playbook creation offers the same grid as its (optional)
// account step. `first`: the networks to lead with, in order — the Playbook's,
// its main one first.
export function connectableNetworkCards({ first = [] } = {}) {
  const rank = (platform) => {
    const i = first.indexOf(normalizeNetwork(platform));
    return i < 0 ? first.length : i;
  };
  const nets = [...getConnectableNetworks()].sort((a, b) => rank(a.platform) - rank(b.platform));
  return nets.map((net) => ({
    value: net.platform,
    label: net.label,
    caption: net.kinds,
    // Trusted markup — the glyph is a DS icon class, not user content.
    preview: net.icon ? `<span class="connect-card__glyph"><i class="${net.icon}" aria-hidden="true"></i></span>` : "",
  }));
}

// The accounts a network hands back, for the dialog that confirms them.
export function accountIdsForNetwork(platform) {
  const net = getConnectableNetworks().find((n) => n.platform === platform);
  return net ? net.accounts.map((a) => a.id) : [];
}

export function requireConnectedProfiles(sessionId, { stepLabel = "Account", onReady, onBack } = {}) {
  if (getConnectedProfiles().length > 0) {
    if (typeof onReady === "function") onReady();
    return;
  }

  const ctx = getContextById(getSessionById(sessionId)?.contextId);
  const items = connectableNetworkCards({ first: playbookNetworks(ctx) });
  if (!items.length) {
    // Nothing connected and nothing left to connect — say so rather than
    // showing an empty picker.
    postAssistantMessage(
      sessionId,
      "I can't find a social account to write for. Add one in Agorapulse, then try again.",
    );
    return;
  }

  postAssistantMessage(
    sessionId,
    "I need a social account before I can write a draft: it sets the format and the length. Connect one and I'll pick up where we left off.",
  );
  inlineQuestion.ask(sessionId, {
    title: "Connect an account to continue",
    subtitle: "Nothing publishes yet. This only lets me write and schedule for it.",
    stepLabel,
    variant: "cards",
    cardCols: 4,
    items,
    skipLabel: "Cancel",
    onPick: (platform) => {
      // Picking a network opens its dialog — the consent beat. Cancelling it
      // leaves the grid standing, exactly like backing out of an OAuth screen.
      openConnectAccountModal({
        network: platform,
        preselected: accountIdsForNetwork(platform),
        onConfirm: (accounts) => {
          if (!accounts.length) return;
          inlineQuestion.exit(sessionId);
          postUserProfilesTurn(sessionId, accounts);
          if (typeof onReady === "function") onReady();
        },
        // Backing out of the dialog puts the grid back, not a dead end.
        onDismiss: () => requireConnectedProfiles(sessionId, { stepLabel, onReady, onBack }),
      });
    },
    onBack: typeof onBack === "function" ? onBack : undefined,
    onSkip: () => {},
  });
}
