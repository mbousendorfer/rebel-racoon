// Demo flow (flag demoMode) — try Archie on Bramble & Bean before connecting
// anything. The state is demo-mode.js; this is what the demo does:
//   - startDemo(): from the first-time run (intro, the chat's first question,
//     the Skip dialog). Arms the state, pre-connects the pretend accounts and
//     reloads into a NEW CHAT — the real one: hero, starters, Topics, composer.
//     The stores swap to Bramble & Bean material at load (isDemo()), so every
//     way in finds something: top posts, Topics, sample files, coffee ideas.
//     Nothing here scripts the chat; the hero's sub-line says it's a demo.
//   - one wave: the first drafts, in any chat of the demo (the studios open
//     their own), end it (soft stop) — they stay to look at and edit, but
//     every new ask gets the end card back.
//   - blockInDemo(): every way to schedule asks for a real brand instead.
//   - exitDemo(): wipes it all and goes back to the real setup.

import { DEMO_ACCOUNTS, DEMO_PLAYBOOK, DEMO_SAMPLES } from "./mocks.js?v=2050";
import { isDemo, isDemoDone, markDemoDone, writeDemo } from "./demo-mode.js?v=2050";
import { postAssistantMessage, postUserTurn } from "./assistant.js?v=2050";
import * as inlineQuestion from "./inline-question.js?v=2050";
import { getPosts, subscribe as subscribePosts } from "./posts-store.js?v=2050";
import { open as openConfirm } from "./components/confirm-modal.js?v=2050";

const PROFILES_KEY = "archie-connected-profiles";

function reloadTo(hash) {
  window.location.hash = hash;
  window.location.reload();
}

export function startDemo() {
  writeDemo({ done: false });
  try {
    window.sessionStorage.setItem(PROFILES_KEY, JSON.stringify(DEMO_ACCOUNTS.map((a) => a.id)));
  } catch {
    /* ignore */
  }
  reloadTo(`#/session/new-${Date.now().toString(36)}?contextId=${DEMO_PLAYBOOK.id}`);
}

export function exitDemo() {
  writeDemo(null);
  try {
    window.sessionStorage.removeItem(PROFILES_KEY);
  } catch {
    /* ignore */
  }
  reloadTo("#/welcome-alt");
}

export function confirmExitDemo() {
  openConfirm({
    title: "Leave the demo?",
    body: `Everything made with ${DEMO_PLAYBOOK.name} is cleared, and we start on your own brand.`,
    confirmLabel: "Leave the demo",
    cancelLabel: "Keep exploring",
    onConfirm: exitDemo,
  });
}

// The one gate in front of scheduling. True when it stopped the action.
export function blockInDemo() {
  if (!isDemo()) return false;
  openConfirm({
    title: "This is a demo",
    body: `${DEMO_PLAYBOOK.name} isn't a real brand, so nothing gets scheduled. Set up your own and I'll schedule for your accounts.`,
    confirmLabel: "Set up my brand",
    cancelLabel: "Keep exploring",
    onConfirm: exitDemo,
  });
  return true;
}

// The new chat hero's sub-line, in the demo: where I say it's a demo, and the
// way out while the topbar is hidden (it takes over once the chat starts).
export function renderDemoHeroLine() {
  return `Try me on ${DEMO_PLAYBOOK.name}, a coffee roaster I made up — nothing gets posted.
    <button type="button" class="ap-link" data-demo-exit>Exit demo</button>`;
}

// The studios ask for a file the demo user doesn't have: hand them the brand's.
// `kind` is "batch" (a PDF) or "clip" (a video); session.js wires the click.
export function renderDemoSample(kind) {
  if (!isDemo()) return "";
  const clip = kind === "clip";
  return `<button type="button" class="ap-button stroked grey" data-demo-sample="${kind}">
    <i class="${clip ? "ap-icon-video" : "ap-icon-file--text"}" aria-hidden="true"></i>
    <span>Use ${clip ? DEMO_SAMPLES.video : DEMO_SAMPLES.pdf}</span>
  </button>`;
}

export function demoSampleFile(kind) {
  return kind === "clip"
    ? new File([""], DEMO_SAMPLES.video, { type: "video/mp4" })
    : new File([""], DEMO_SAMPLES.pdf, { type: "application/pdf" });
}

// The soft stop. Also what a new ask gets once the demo is done.
const END_LINE =
  "That's your first wave. The demo stops here: set up your brand and I'll write for your real accounts.";
const AFTER_LINE = "The demo stops at one wave. Set up your brand and I'll write this one for your real accounts.";

function postEndCard(sessionId, text = END_LINE) {
  postAssistantMessage(sessionId, text);
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Demo",
    items: [],
    actions: [
      { value: "keep", label: "Keep looking", stroked: true },
      { value: "setup", label: "Set up my brand", primary: true },
    ],
    onPick: (value) => {
      if (value === "setup") exitDemo();
      else inlineQuestion.exit(sessionId);
    },
  });
}

// Once the wave is in, any ask — typed or clicked — gets the end card. A typed
// one is echoed first, like any message.
export function answerAfterDemo(sessionId, text = "") {
  if (text) postUserTurn(sessionId, text);
  postEndCard(sessionId, AFTER_LINE);
}

// Every chat the demo renders is watched: the studios mint their own, and the
// first drafts in any of them end the wave. writeFromPlan & co add the drafts
// in a loop, then post their result card — wait one tick so the end card lands
// after it.
const watched = new Set();
export function trackDemoSession(sessionId) {
  if (watched.has(sessionId) || isDemoDone()) return;
  watched.add(sessionId);
  const off = subscribePosts(sessionId, () => {
    if (!getPosts(sessionId).length || isDemoDone()) return;
    off();
    markDemoDone();
    setTimeout(() => postEndCard(sessionId), 0);
  });
}
