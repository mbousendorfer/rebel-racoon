import { getSessions } from "../sessions-store.js?v=2964";
import { getContexts } from "../contexts-store.js?v=2964";
import { isNewUser } from "../user-mode.js?v=2964";
import { isFlagOn, isNewStartOn } from "../feature-flags.js?v=2964";

// Dashboard route — pure redirect surface.
//
// Two branches:
//   1. First-time onboarding — isNewUser() with no Playbook yet → /welcome-alt
//      (flag interactivePlaybook; OFF, they land on a new chat like branch 2).
//   2. Returning user — most recent session, or /session/new if none.
//
// `/` renders nothing of its own, deliberately. This is a tool you come to with
// a task already in mind, so the landing page is the chat you were last in.
//
// It DID render something once: behind the `frontPage` flag, `/` became a
// magazine front page filled by the listening feature — a lead story, a grid of
// six, section chips. That went out with the Topics magazine it was built on
// (see the Topic Feed § in CLAUDE.md). If a front page comes back, it comes back
// on top of the Topic Feed's own data, not as a second reader of a second store.

export function renderDashboard(_params, _target) {
  // Branch 1 — first-time user without a Playbook → onboarding.
  // ALT mode lands on /welcome-alt (visual profile picker → conversational
  // Playbook builder).
  // Flag newStart: no run first — the new chat introduces Archie and offers it.
  // Flag newChatHero: the same, the hero's « Sound like your Brand » door offers it.
  // Flag interactivePlaybook OFF: no run forced at all.
  if (
    isNewUser() &&
    getContexts().length === 0 &&
    isFlagOn("interactivePlaybook") &&
    !isNewStartOn() &&
    !isFlagOn("newChatHero")
  ) {
    window.location.replace(window.location.href.split("#")[0] + "#/welcome-alt");
    return;
  }

  // Branch 2 — normal redirect: the most recent chat.
  const recent = getSessions()[0];
  const targetPath = isNewUser() || !recent ? "/session/new" : `/session/${recent.id}`;
  window.location.replace(window.location.href.split("#")[0] + "#" + targetPath);
}
