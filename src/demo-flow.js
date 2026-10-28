// Demo flow (flag demoMode) — try Archie on Bramble & Bean before connecting
// anything. The state is demo-mode.js; this is what the demo does:
//   - startDemo(): from the first-time run (intro, the chat's first question,
//     the Skip dialog). Arms the state, pre-connects the pretend accounts and
//     reloads into a NEW CHAT — the real one: hero, starters, Topics, composer.
//     The stores swap to Bramble & Bean material at load (isDemo()), so every
//     way in finds something: top posts, Topics, sample files, coffee ideas.
//     Nothing here scripts the chat; a card at the bottom of the sidebar says it's a demo.
//     No Playbook can be created in the demo (its buttons are hidden under
//     body.demo, and session.js refuses the builder's handoff).
//   - one wave: the first drafts, in any chat of the demo (the studios open
//     their own), end it (soft stop) — they stay to look at and edit, but
//     every new ask gets the end card back.
//   - blockInDemo(): every way to schedule asks for a real brand instead.
//   - exitDemo(): wipes it all and goes back to the real setup.

import { DEMO_ACCOUNTS, DEMO_PLAYBOOK, DEMO_SAMPLES } from "./mocks.js?v=2307";
import { isDemo, isDemoDone, markDemoDone, writeDemo } from "./demo-mode.js?v=2307";
import { postAssistantMessage, postUserTurn } from "./assistant.js?v=2307";
import * as inlineQuestion from "./inline-question.js?v=2307";
import { getPosts, subscribe as subscribePosts } from "./posts-store.js?v=2307";
import { open as openConfirm } from "./components/confirm-modal.js?v=2307";
import { showToast } from "./components/toast.js?v=2307";
import { pushScriptedSource, completeScriptedSource } from "./sources-stream.js?v=2307";

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
    body: `Everything made with ${DEMO_PLAYBOOK.brandName} is cleared, and we start on your own brand.`,
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
    body: `${DEMO_PLAYBOOK.brandName} isn't a real brand, so nothing gets scheduled. Set up your own and I'll schedule for your accounts.`,
    confirmLabel: "Set up my brand",
    cancelLabel: "Keep exploring",
    onConfirm: exitDemo,
  });
  return true;
}

// The demo is said in a card at the bottom of the sidebar, above the user row —
// always on screen, never in the way (a full-width banner was tried and
// dropped on 2026-10-20). The DS Infobox with a title; the way out is a link in
// it. sidebar.js renders it and wires [data-demo-exit].
export function renderDemoCard() {
  if (!isDemo()) return "";
  return `
    <div class="ap-infobox info has-title app-sidebar__demo" role="status">
      <i class="ap-icon-info_fill" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">You're in a demo</span>
          <span class="ap-infobox-message">${DEMO_PLAYBOOK.brandName} is a coffee roaster I made up. Nothing you make here gets posted.</span>
          <button type="button" class="ap-link" data-demo-exit>Exit demo</button>
        </div>
      </div>
    </div>`;
}

// Nothing of the user's own comes into the demo: no file, no link, no pasted
// text — only the brand's demo content. The ways in that matter are disabled
// or turned into "demo" ones where they're drawn (composer, studios); this is
// the net under all the others (the Playbook's logos and references, the Image
// Generator, a drop on the chat…): every file picker, drop and pasted file is
// refused, and said so. The bug report keeps its screenshots.
const NO_OWN_CONTENT = "In the demo I only work with demo content — your own files stay out.";
const exempt = (target) => !!target?.closest?.(".bug-report-modal");

// body.demo is what hides every way to create a Playbook (styles/layout.css).
export function initDemoMode() {
  if (!isDemo()) return;
  document.body.classList.add("demo");
  const refuse = (event, say) => {
    event.preventDefault();
    event.stopPropagation();
    if (say) showToast(NO_OWN_CONTENT);
  };
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.matches?.('input[type="file"]') && !exempt(event.target)) refuse(event, true);
    },
    true,
  );
  for (const type of ["dragenter", "dragover", "drop"]) {
    document.addEventListener(
      type,
      (event) => {
        if (!event.dataTransfer?.types?.includes("Files") || exempt(event.target)) return;
        refuse(event, type === "drop");
      },
      true,
    );
  }
  document.addEventListener(
    "paste",
    (event) => {
      if (event.clipboardData?.files?.length && !exempt(event.target)) refuse(event, true);
    },
    true,
  );
}

// The demo's own sources — what Add demo PDF / video / URL / text attach, and
// what any other "add a source" (the Sources panel, the Content tab) hands over
// instead of opening the upload modal. Same scripted pipeline as the composer's.
const DEMO_KIND_LABEL = { pdf: "PDF", video: "Video", url: "URL", text: "Text" };
export function addDemoSource(sessionId, kind = "pdf") {
  if (!DEMO_SAMPLES[kind]) return;
  const sourceId = pushScriptedSource({ filename: DEMO_SAMPLES[kind], kind: DEMO_KIND_LABEL[kind], sessionId });
  setTimeout(() => completeScriptedSource(sourceId, { signal: "Medium relevance", signalColor: "tagOrange" }), 6000);
}

// The studios ask for a file the demo user doesn't have: hand them the brand's.
// `kind` is "batch" (a PDF) or "clip" (a video); session.js wires the click.
export function renderDemoSample(kind) {
  if (!isDemo()) return "";
  const clip = kind === "clip";
  return `<button type="button" class="ap-button stroked grey" data-demo-sample="${kind}">
    <i class="${clip ? "ap-icon-video" : "ap-icon-file--text"}" aria-hidden="true"></i>
    <span>Use demo content</span>
    <span class="ap-badge orange">Demo</span>
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
