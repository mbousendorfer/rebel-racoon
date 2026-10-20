// Demo flow (flag demoMode) — try Archie on Bramble & Bean before connecting
// anything. The state is demo-mode.js; this is what the demo does:
//   - startDemo(): from the first screen of the first-time run. Arms the state,
//     pre-connects the pretend accounts and reloads into the demo chat, so the
//     stores seed the brand at load exactly as they do on a reload.
//   - runDemoChat(): my opening, then a subject to write about → the post plan
//     (post-plan-flow.js), which needs no source and finds the accounts
//     already connected.
//   - one wave: the first drafts end the demo (soft stop) — they stay to look
//     at and edit, but every new ask gets the end card back.
//   - blockInDemo(): every way to schedule asks for a real brand instead.
//   - exitDemo(): wipes it all and goes back to the real setup.

import { DEMO_ACCOUNTS, DEMO_PLAYBOOK } from "./mocks.js?v=2034";
import { isDemo, isDemoDone, markDemoDone, writeDemo } from "./demo-mode.js?v=2034";
import { postAssistantMessage, postUserTurn } from "./assistant.js?v=2034";
import * as inlineQuestion from "./inline-question.js?v=2034";
import { startPostPlan } from "./post-plan-flow.js?v=2034";
import { getPosts, subscribe as subscribePosts } from "./posts-store.js?v=2034";
import { open as openConfirm } from "./components/confirm-modal.js?v=2034";

const PROFILES_KEY = "archie-connected-profiles";

const SUBJECTS = [
  { value: "our new autumn blend", label: "Our new autumn blend", icon: "ap-icon-star" },
  {
    value: "a morning behind the scenes at the roastery",
    label: "Behind the scenes at the roastery",
    icon: "ap-icon-image",
  },
  { value: "the weekend brunch", label: "The weekend brunch", icon: "ap-icon-calendar" },
];

function reloadTo(hash) {
  window.location.hash = hash;
  window.location.reload();
}

export function startDemo() {
  const sessionId = `demo-${Date.now().toString(36)}`;
  writeDemo({ sessionId, done: false });
  try {
    window.sessionStorage.setItem(PROFILES_KEY, JSON.stringify(DEMO_ACCOUNTS.map((a) => a.id)));
  } catch {
    /* ignore */
  }
  const title = encodeURIComponent(`${DEMO_PLAYBOOK.name} demo`);
  reloadTo(`#/session/${sessionId}?contextId=${DEMO_PLAYBOOK.id}&title=${title}`);
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

// The router re-renders the session on every hash change; the opening runs
// once per page load (a reload starts the chat over, the brand stays).
let opened = null;
export function runDemoChat(sessionId) {
  if (opened === sessionId) return;
  opened = sessionId;
  watchWave(sessionId);
  postAssistantMessage(
    sessionId,
    `This is ${DEMO_PLAYBOOK.name}, a coffee roaster I made up so you can try me. Its accounts are pretend: I'll write real drafts, but nothing will ever be posted.`,
  );
  if (isDemoDone()) return postEndCard(sessionId);
  const write = (subject) => {
    const s = String(subject || "").trim();
    if (!s) return;
    inlineQuestion.exit(sessionId);
    startPostPlan(sessionId, /\babout\b/i.test(s) ? s : `Write a post about ${s}`);
  };
  inlineQuestion.ask(sessionId, {
    title: "What should we post about?",
    stepLabel: "Demo",
    items: SUBJECTS,
    customPlaceholder: "Or a subject of your own",
    onPick: write,
    onCustom: write,
  });
}

// The soft stop. Also what a new ask gets once the demo is done.
const END_LINE =
  "That's your first wave. The demo stops here: set up your brand and I'll write for your real accounts.";
const AFTER_LINE = "The demo stops at one wave. Set up your brand and I'll write this one for your real accounts.";

export function postEndCard(sessionId, text = END_LINE) {
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

// A typed ask in the demo chat once the wave is in: echoed, then the end card.
export function answerAfterDemo(sessionId, text) {
  postUserTurn(sessionId, text);
  postEndCard(sessionId, AFTER_LINE);
}

// writeFromPlan adds the drafts in a loop, then posts its result card — wait
// one tick so the end card lands after it.
let watching = null;
function watchWave(sessionId) {
  if (watching === sessionId || isDemoDone()) return;
  watching = sessionId;
  const off = subscribePosts(sessionId, () => {
    if (!getPosts(sessionId).length || isDemoDone()) return;
    off();
    markDemoDone();
    setTimeout(() => postEndCard(sessionId), 0);
  });
}
