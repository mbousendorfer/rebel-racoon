// The voice of a network (flag voicePerNetwork) — one module for every surface
// that gives one.
//
// A network writes in its own voice, or in the Playbook's default voice. It
// gets its own the same four ways everywhere (voiceChoices): learned from the
// account's posts, from a document, from a few questions, or edited by the user
// in the Playbook. What Archie learns is a PROPOSAL: shown — what it changes
// from the default voice — then used (only then saved) or edited in the
// Playbook. Where a draft is waiting, a fifth answer: use the default voice.
//
// The chat (this file): before a draft for a network never given a voice, the
// Voice step — blocking, in the flow's slot, like requireConnectedProfiles —
// and « Give X its own voice » on a draft in the default voice. The interview
// is asked in the thread; the proposal is a turn (« voice-learned »).
// Without a chat (the Clips space, the Playbook): network-voice-modal.js and
// voice-proposal-modal.js — the same choices, the same proposal.
//
// A voice that changes never rewrites a draft: the drafts written before it
// say so (post-card), each with « Rewrite it ».
//
// Public API:
//   requireNetworkVoices(sessionId, networks, onReady, contextId?)
//   giveNetworkVoice(sessionId, ctxId, net)  — « Give X its own voice »
//   answerVoiceAsk(sessionId, turnId, choice)       — a tile of the Voice step
//   answerLearnedVoice(sessionId, turnId, "use" | "edit")
// Shared with the dialogs:
//   missingNetworkVoices(ctx, networks) · voiceChoices(net, { needed, chat }) ·
//   INTERVIEW · learnPhases(net, from?) · LEARN_PHASE_MS ·
//   proposeNetworkVoice(ctx, net, choice, from?) · saveNetworkVoice(ctxId, net, voice) ·
//   useDefaultVoice(ctxId, net) · editNetworkVoiceInPlaybook(ctxId, net, voice?) ·
//   documentName(url)
//
// onReady() runs IMMEDIATELY when every network already has a voice — always
// the case with the flag off — so callers wrap unconditionally.

import * as inlineQuestion from "./inline-question.js?v=2402";
import {
  postAssistantMessage,
  postUserTurn,
  startPending,
  updatePending,
  finishPending,
  postVoiceTurn,
  resolveTurn,
  getThread,
} from "./assistant.js?v=2402";
import { getContextById, updateContext } from "./contexts-store.js?v=2402";
import { getSessionById } from "./sessions-store.js?v=2402";
import { networkLabel, networkMeta, normalizeNetwork, profileForNetwork } from "./social-profiles.js?v=2402";
import { setHandoff } from "./handoff.js?v=2402";
import { navigate } from "./router.js?v=2402";
import { open as openFillDocumentModal } from "./components/fill-document-modal.js?v=2402";
import { getPosts } from "./posts-store.js?v=2402";
import {
  networkVoiceOn,
  networkVoice,
  canLearnFrom,
  learnNetworkVoice,
  interviewNetworkVoice,
  brandVoiceAsIs,
  playbookNetworks,
  voiceParts,
  adaptNetworkVoice,
} from "./voice-parts.js?v=2402";

// Learning a voice takes a moment, and says what it's doing.
export const LEARN_PHASE_MS = 1400;

// `from`: a document's name, the interview's answers, or nothing (the posts).
// `choice` "adapt": the default voice, adapted.
export function learnPhases(net, from = null, choice = null) {
  const label = networkLabel(net);
  const account = profileForNetwork(net);
  if (choice === "adapt")
    return ["Reading your default voice…", `Adding what works on ${label}…`, `Writing your ${label} voice…`];
  if (from && typeof from === "object") return ["Reading your answers…", `Writing your ${label} voice…`];
  return [
    from ? `Reading ${from}…` : `Reading ${account.postCount} posts of ${account.handle}…`,
    from ? `Finding how you write on ${label}…` : `Finding what works on ${label}…`,
    `Writing your ${label} voice…`,
  ];
}

// The networks of a batch never given a voice — none with the flag off.
export function missingNetworkVoices(ctx, networks) {
  if (!networkVoiceOn() || !ctx) return [];
  return [...new Set((networks || []).map(normalizeNetwork))].filter((n) => {
    const v = networkMeta(n) && networkVoice(ctx, n);
    return v && v.state === "default" && !v.chosen;
  });
}

export function requireNetworkVoices(sessionId, networks, onReady, contextId = null) {
  const ctx = getContextById(contextId || getSessionById(sessionId)?.contextId);
  const missing = missingNetworkVoices(ctx, networks);
  if (!missing.length) return onReady();
  askVoice(sessionId, ctx.id, missing, onReady);
}

// The ways to give a network its own voice, the best first — the same
// everywhere. `needed`: a draft is waiting, so the default voice is an answer
// too. `chat`: the questions are asked in the thread, else in a dialog.
export function voiceChoices(net, { needed = false, chat = false } = {}) {
  const label = networkLabel(net);
  const account = profileForNetwork(net);
  const learn = canLearnFrom(account);
  const items = [
    learn && {
      value: "learn",
      icon: "ap-icon-double-chat-bubbles",
      tile: "From your posts",
      hint: `${account.handle} · ${account.postCount} posts`,
      label: `Learn from ${account.handle}'s posts`,
      caption: `I read its ${account.postCount} posts and keep what already works for you on ${label}.`,
    },
    {
      value: "adapt",
      icon: "ap-icon-sparkles",
      tile: "Adapt my default voice",
      hint: "Nothing to read",
      label: `Adapt my default voice for ${label}`,
      caption: `I keep your default voice and add what works on ${label}: length, layout, hashtags.`,
    },
    {
      value: "document",
      icon: "ap-icon-file--text",
      tile: "From a document",
      hint: "A style guide or a brief",
      label: "Learn from a document",
      caption:
        account && !learn
          ? `${account.handle} has too few posts to learn from — a style guide or a brief works too.`
          : `A style guide or a brief about how you write on ${label}.`,
    },
    {
      value: "interview",
      icon: "ap-icon-question",
      tile: `Answer ${INTERVIEW.length} questions`,
      hint: "About a minute",
      label: "Answer a few questions",
      caption: `Five quick questions about how you write on ${label}${chat ? ", right here" : ""}.`,
    },
    {
      value: "edit",
      icon: "ap-icon-pen",
      tile: "Write them myself",
      hint: "In your Voice profile",
      label: "Write it myself",
      caption: `I open ${label} in your Voice profile, starting from your default voice.`,
    },
    needed && {
      value: "default",
      label: "Use my default voice",
      caption: `Nothing specific to ${label} — length, format, hashtags — so drafts may miss what works there.`,
    },
  ].filter(Boolean);
  return { account, items };
}

// The questions about how the user writes on a network, each skippable.
// ONE question per part of the Voice profile, in its order and under its
// title (voice-parts VOICE_PARTS): each answer lands in that part.
const QUESTIONS = {
  voiceSummary: (l) => `How do you sound on ${l}, in a sentence?`,
  voiceAlways: (l) => `What does every post of yours on ${l} do? Its length, how it opens, its layout…`,
  voiceNever: (l) => `What would you never do on ${l}?`,
  voiceByPost: () => "Does it change with the kind of post? An announcement, a tip, a story…",
  voiceSometimes: (l) => `What do you do now and then on ${l}, not every time? Hashtags, a question at the end…`,
};
export const INTERVIEW = voiceParts().map((p) => ({ key: p.field, title: p.title, ask: QUESTIONS[p.field] }));

// What Archie learned, not saved: from the account's posts, a document (`from`
// its name) or the interview (`from` its answers).
export function proposeNetworkVoice(ctx, net, choice, from = null) {
  const account = profileForNetwork(net);
  if (choice === "learn") return learnNetworkVoice(ctx, net, { from: account.handle, postCount: account.postCount });
  if (choice === "adapt") return adaptNetworkVoice(ctx, net);
  if (choice === "document") return learnNetworkVoice(ctx, net, { from });
  return interviewNetworkVoice(ctx, net, from || {});
}

// Saves a network's voice — stamped, so the drafts written before it say so.
// A network written for is one the Playbook publishes on.
export function saveNetworkVoice(ctxId, net, voice) {
  const ctx = getContextById(ctxId);
  if (!ctx) return;
  updateContext(ctxId, {
    voiceByNetwork: { ...(ctx.voiceByNetwork || {}), [net]: { ...voice, changedAt: Date.now() } },
    ...(!playbookNetworks(ctx).includes(net) && { connectedSocials: [...(ctx.connectedSocials || []), net] }),
  });
}

// « Use the default voice »: the answer is kept, so it isn't asked again.
export function useDefaultVoice(ctxId, net) {
  const ctx = getContextById(ctxId);
  if (ctx) saveNetworkVoice(ctxId, net, brandVoiceAsIs(ctx));
}

// « Edit it myself », or « Edit » on a proposal: the network's tab, in edit
// (playbook-view consumes the key) — on `voice` when there is one, else on the
// network's own voice, else from the default voice. Nothing is saved until
// the user saves there.
export function editNetworkVoiceInPlaybook(ctxId, net, voice = null) {
  setHandoff("editNetworkVoice", { playbookId: ctxId, net, ...(voice && { voice }) });
  navigate(`/playbook/${ctxId}?tab=voice&voice=${net}`);
}

export function documentName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "your document";
  } catch {
    return "your document";
  }
}

// ── The chat ────────────────────────────────────────────────────────────────

// « Give X its own voice » on a draft in the default voice (its status card in
// the chat's Drafts panel): the same step, without the default-voice answer.
// The drafts aren't rewritten — once the voice is used, each one says it was
// written before it (post-card).
export function giveNetworkVoice(sessionId, ctxId, net) {
  askVoice(
    sessionId,
    ctxId,
    [net],
    () => {
      const label = networkLabel(net);
      const n = getPosts(sessionId).filter(
        (p) => normalizeNetwork(p.network) === net && p.status !== "scheduled",
      ).length;
      if (n)
        postAssistantMessage(
          sessionId,
          `${label} has its own voice now. ${n === 1 ? `Your ${label} draft was` : `Your ${n} ${label} drafts were`} written before it: rewrite ${n === 1 ? "it" : "each one"} from its card.`,
        );
    },
    { giving: true },
  );
}

function askInterview(sessionId, net, onDone, answers = {}, k = 0) {
  const step = INTERVIEW[k];
  if (!step) return onDone(answers);
  const question = step.ask(networkLabel(net));
  const record = (answer, echo) => {
    postAssistantMessage(sessionId, question);
    postUserTurn(sessionId, echo);
    inlineQuestion.exit(sessionId);
    askInterview(sessionId, net, onDone, { ...answers, ...(answer && { [step.key]: answer }) }, k + 1);
  };
  inlineQuestion.ask(sessionId, {
    title: question,
    stepLabel: `Voice profile · ${step.title}`,
    items: [],
    customPlaceholder: "Type your answer…",
    onCustom: (value) => {
      const answer = (value || "").trim();
      if (!answer) return askInterview(sessionId, net, onDone, answers, k);
      record(answer, answer);
    },
    skipLabel: "Skip this question",
    onSkip: () => record("", "Skipped"),
  });
}

// The proposals waiting for an answer: turn id → { ctxId, net, voice, go }.
const awaiting = new Map();

// A proposal with no flow waiting on it (none was waiting, or it's gone): the
// turn carries everything to act on — its buttons never go dead.
function orphanProposal(sessionId, turnId) {
  const m = getThread(sessionId).find((t) => t.id === turnId && t.variant === "voice-learned" && !t.resolved);
  if (!m?.voice) return null;
  const label = networkLabel(m.network);
  return {
    ctxId: m.contextId,
    net: m.network,
    voice: m.voice,
    go: () => postAssistantMessage(sessionId, `Added. I'll write for ${label} with these rules from now on.`),
  };
}

export function answerLearnedVoice(sessionId, turnId, action) {
  const wait = awaiting.get(turnId) || orphanProposal(sessionId, turnId);
  if (!wait) return;
  awaiting.delete(turnId);
  resolveTurn(sessionId, turnId);
  if (action === "use") {
    postUserTurn(sessionId, "Add to Voice profile");
    saveNetworkVoice(wait.ctxId, wait.net, wait.voice);
    return wait.go();
  }
  postUserTurn(sessionId, "Edit in the Playbook");
  postAssistantMessage(
    sessionId,
    `I've opened these rules in your Voice profile. Change what you want, save, then ask me again for the drafts.`,
  );
  editNetworkVoiceInPlaybook(wait.ctxId, wait.net, wait.voice);
}

// The Voice steps waiting for a pick: turn id → pick(choice).
const asking = new Map();

export function answerVoiceAsk(sessionId, turnId, choice) {
  asking.get(turnId)?.(choice);
}

// The step is a block in the thread (« voice-ask », thread-render): what's
// missing, what rules for the network cover, the ways to add them as tiles,
// the best one recommended — then « Use my default voice » and « Not now ».
// `giving`: from « Add rules for X » — nothing waits, so no default voice.
function askVoice(sessionId, ctxId, nets, onReady, { giving = false } = {}) {
  const [net, ...rest] = nets;
  const label = networkLabel(net);
  const { items } = voiceChoices(net, { needed: !giving, chat: true });
  const turnId = postVoiceTurn(sessionId, "voice-ask", { contextId: ctxId, network: net, choices: items, giving });
  const go = () => (rest.length ? askVoice(sessionId, ctxId, rest, onReady) : onReady());
  // The block keeps its tiles until a choice goes through (a dismissed
  // document dialog leaves it to pick again).
  const answered = (echo) => {
    asking.delete(turnId);
    resolveTurn(sessionId, turnId);
    postUserTurn(sessionId, echo);
  };
  const keepDefault = () => {
    useDefaultVoice(ctxId, net);
    postAssistantMessage(
      sessionId,
      `I'll write for ${label} in your default voice. You can give ${label} its own voice in your Voice profile anytime.`,
    );
    go();
  };
  // Learning takes a moment, then the proposal waits for its answer.
  const learning = (choice, from = null) => {
    const phases = learnPhases(net, from, choice);
    const pendingId = startPending(sessionId, phases[0]);
    phases
      .slice(1)
      .forEach((p, i) => setTimeout(() => updatePending(sessionId, pendingId, p), LEARN_PHASE_MS * (i + 1)));
    setTimeout(() => {
      finishPending(sessionId, pendingId);
      const voice = proposeNetworkVoice(getContextById(ctxId), net, choice, from);
      const learnedId = postVoiceTurn(sessionId, "voice-learned", { contextId: ctxId, network: net, voice });
      awaiting.set(learnedId, { ctxId, net, voice, go });
    }, LEARN_PHASE_MS * phases.length);
  };
  asking.set(turnId, (choice) => {
    if (choice === "cancel") {
      answered("Not now");
      return postAssistantMessage(sessionId, `OK, I won't write anything for now.`);
    }
    const item = items.find((i) => i.value === choice);
    if (!item) return;
    if (choice === "document")
      return openFillDocumentModal({
        onConfirm: ({ file, url }) => {
          answered(item.label);
          learning(choice, file?.name || documentName(url));
        },
      });
    answered(item.label);
    if (choice === "default") return keepDefault();
    if (choice === "learn" || choice === "adapt") return learning(choice);
    if (choice === "edit") {
      postAssistantMessage(
        sessionId,
        `I've opened ${label} in your Voice profile, starting from your default voice. Add your rules, save, then ask me again.`,
      );
      return editNetworkVoiceInPlaybook(ctxId, net);
    }
    postAssistantMessage(
      sessionId,
      `${INTERVIEW.length} quick questions about how you write on ${label} — one per section of your Voice profile. Answer in your own words, or skip any of them.`,
    );
    askInterview(sessionId, net, (answers) => {
      if (Object.keys(answers).length) return learning(choice, answers);
      // Nothing said: the default voice — or, from « Add rules for X », as it was.
      if (giving) return postAssistantMessage(sessionId, `OK — ${label} stays on your default voice for now.`);
      keepDefault();
    });
  });
}
