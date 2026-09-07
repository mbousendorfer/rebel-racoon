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

import * as inlineQuestion from "./inline-question.js?v=1072";
import { postAssistantMessage, postUserProfilesTurn } from "./assistant.js?v=1072";
import {
  getConnectedProfiles,
  getConnectableAccounts,
  NETWORK_ICON_BY_PLATFORM,
  BRAND_INITIALS,
} from "./social-profiles.js?v=1072";
import { open as openConnectAccountModal } from "./components/connect-account-modal.js?v=1072";

// Picker rows for the accounts on offer — same shape as
// buildConnectedProfileItems() so the connect step and the pick step it stands
// in for read as one family. Exported because Playbook creation offers the same
// list as its (optional) account step.
export function connectableItems() {
  return getConnectableAccounts().map((p) => ({
    value: p.id,
    label: p.handle,
    caption: [p.platformLabel, p.kind].filter(Boolean).join(" · "),
    search: [p.name, p.handle, p.platformLabel, p.kind].filter(Boolean).join(" "),
    avatar: {
      imageUrl: p.photo,
      initials: p.initials || BRAND_INITIALS,
      networkIcon: NETWORK_ICON_BY_PLATFORM[p.platform],
    },
  }));
}

export function requireConnectedProfiles(sessionId, { stepLabel = "Account", onReady, onBack } = {}) {
  if (getConnectedProfiles().length > 0) {
    if (typeof onReady === "function") onReady();
    return;
  }

  const items = connectableItems();
  if (!items.length) {
    // Nothing connected and nothing left to connect — say so rather than
    // showing an empty picker.
    postAssistantMessage(sessionId, "I have no social account to write for, and none left to connect.");
    return;
  }

  postAssistantMessage(
    sessionId,
    "I need a social account before I can write a draft — it sets the format and the length. Connect one and I'll pick up where we left off.",
  );
  inlineQuestion.ask(sessionId, {
    title: "Connect an account to continue",
    subtitle: "Nothing publishes yet — this only lets me write and schedule for it.",
    stepLabel,
    items,
    multi: true,
    submitLabel: "Connect",
    skipLabel: "Cancel",
    onPick: (ids) => {
      const picked = Array.isArray(ids) ? ids : [ids];
      if (!picked.length) return;
      // The modal is the consent step: it shows what is about to be connected
      // and owns the confirm. Cancelling it leaves the question standing.
      openConnectAccountModal({
        preselected: picked,
        onConfirm: (accounts) => {
          if (!accounts.length) return;
          inlineQuestion.exit(sessionId);
          postUserProfilesTurn(sessionId, accounts);
          if (typeof onReady === "function") onReady();
        },
      });
    },
    onBack: typeof onBack === "function" ? onBack : undefined,
    onSkip: () => {},
  });
}
