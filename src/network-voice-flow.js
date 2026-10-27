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

import * as inlineQuestion from "./inline-question.js?v=2251";
import {
  postAssistantMessage,
  postUserTurn,
  startPending,
  updatePending,
  finishPending,
  postVoiceTurn,
  resolveTurn,
} from "./assistant.js?v=2251";
import { getContextById, updateContext } from "./contexts-store.js?v=2251";
import { getSessionById } from "./sessions-store.js?v=2251";
import { networkLabel, networkMeta, normalizeNetwork, profileForNetwork } from "./social-profiles.js?v=2251";
import { setHandoff } from "./handoff.js?v=2251";
import { navigate } from "./router.js?v=2251";
import { open as openFillDocumentModal } from "./components/fill-document-modal.js?v=2251";
import { getPosts } from "./posts-store.js?v=2251";
import {
  networkVoiceOn,
  networkVoice,
  canLearnFrom,
  learnNetworkVoice,
  interviewNetworkVoice,
  brandVoiceAsIs,
  playbookNetworks,
} from "./voice-parts.js?v=2251";

// Learning a voice takes a moment, and says what it's doing.
export const LEARN_PHASE_MS = 1400;

// `from`: a document's name, the interview's answers, or nothing (the posts).
export function learnPhases(net, from = null) {
  const label = networkLabel(net);
  const account = profileForNetwork(net);
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
      label: `Learn it from ${account.handle}'s posts`,
      caption: `I read its ${account.postCount} posts and keep what already works on ${label}.`,
    },
    {
      value: "document",
      label: "Learn it from a document",
      caption:
        account && !learn
          ? `${account.handle} doesn't have enough posts to learn from — a style guide or a brief works too.`
          : `A style guide or a brief that says how you write on ${label}.`,
    },
    {
      value: "interview",
      label: `Tell me how you write on ${label}`,
      caption: `A few quick questions${chat ? " here" : ""}, and I write the voice from your answers.`,
    },
    {
      value: "edit",
      label: "Edit it myself",
      caption: `I open the ${label} voice in the Playbook, starting from the default voice.`,
    },
    needed && {
      value: "default",
      label: "Use the default voice",
      caption: `No length, format or hashtag habits of ${label}'s own — the drafts may miss what works there.`,
    },
  ].filter(Boolean);
  return { account, items };
}

// The questions about how the user writes on a network, each skippable.
export const INTERVIEW = [
  { key: "length", ask: (l) => `How long is a post of yours on ${l}? One line, a few sentences, a long read…` },
  { key: "layout", ask: () => "How do you lay it out? Short paragraphs, line breaks, emojis, a list…" },
  { key: "tags", ask: (l) => `Hashtags and mentions on ${l}: how many, and where?` },
  { key: "never", ask: (l) => `Anything you'd never do on ${l}?` },
  {
    key: "example",
    ask: (l) => `Paste a post of yours that sounds just right on ${l}. It shows me better than any rule.`,
  },
];

// What Archie learned, not saved: from the account's posts, a document (`from`
// its name) or the interview (`from` its answers).
export function proposeNetworkVoice(ctx, net, choice, from = null) {
  const account = profileForNetwork(net);
  if (choice === "learn") return learnNetworkVoice(ctx, net, { from: account.handle, postCount: account.postCount });
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
          `${label} has its own voice now. ${n === 1 ? `Your ${label} draft was` : `Your ${n} ${label} drafts were`} written before it — rewrite ${n === 1 ? "it" : "any of them"} from ${n === 1 ? "its" : "their"} card.`,
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
    stepLabel: `Voice · ${k + 1} of ${INTERVIEW.length}`,
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

export function answerLearnedVoice(sessionId, turnId, action) {
  const wait = awaiting.get(turnId);
  if (!wait) return;
  awaiting.delete(turnId);
  resolveTurn(sessionId, turnId);
  if (action === "use") {
    postUserTurn(sessionId, "Use this voice");
    saveNetworkVoice(wait.ctxId, wait.net, wait.voice);
    return wait.go();
  }
  postUserTurn(sessionId, "Edit it in the Playbook");
  postAssistantMessage(
    sessionId,
    `I've opened what I learned for ${networkLabel(wait.net)} in the Playbook. Change what you want and save it, then ask me again.`,
  );
  editNetworkVoiceInPlaybook(wait.ctxId, wait.net, wait.voice);
}

// `announce` is false when the question is PUT BACK (the document dialog was
// dismissed): the thread already says why it's asked. `giving`: from « Give X
// its own voice » — nothing waits, so the default voice isn't an answer.
function askVoice(sessionId, ctxId, nets, onReady, { announce = true, giving = false } = {}) {
  const [net, ...rest] = nets;
  const label = networkLabel(net);
  const { items } = voiceChoices(net, { needed: !giving, chat: true });
  if (announce)
    postAssistantMessage(
      sessionId,
      giving
        ? `Let's give ${label} a voice of its own.`
        : `${label} doesn't have a voice yet, and I write every draft in its network's voice.`,
    );
  inlineQuestion.ask(sessionId, {
    title: `How should I write on ${label}?`,
    stepLabel: "Voice",
    skipLabel: "Cancel",
    items,
    onPick: (choice) => {
      inlineQuestion.exit(sessionId);
      postUserTurn(sessionId, items.find((i) => i.value === choice)?.label || "");
      const go = () => (rest.length ? askVoice(sessionId, ctxId, rest, onReady) : onReady());
      const keepDefault = () => {
        useDefaultVoice(ctxId, net);
        postAssistantMessage(
          sessionId,
          `I'll write for ${label} in the default voice. It has no habits of ${label}'s own, so the drafts may miss what works there — you can give ${label} its own voice from the Playbook at any time.`,
        );
        go();
      };
      if (choice === "default") return keepDefault();
      if (choice === "edit") {
        postAssistantMessage(
          sessionId,
          `I've opened the ${label} voice in the Playbook, starting from the default voice. Save it, then ask me again.`,
        );
        return editNetworkVoiceInPlaybook(ctxId, net);
      }
      // Learning takes a moment, then the proposal waits for its answer.
      const learning = (from = null) => {
        const phases = learnPhases(net, from);
        const pendingId = startPending(sessionId, phases[0]);
        phases
          .slice(1)
          .forEach((p, i) => setTimeout(() => updatePending(sessionId, pendingId, p), LEARN_PHASE_MS * (i + 1)));
        setTimeout(() => {
          finishPending(sessionId, pendingId);
          const voice = proposeNetworkVoice(getContextById(ctxId), net, choice, from);
          const turnId = postVoiceTurn(sessionId, "voice-learned", { contextId: ctxId, network: net, voice });
          awaiting.set(turnId, { ctxId, net, voice, go });
        }, LEARN_PHASE_MS * phases.length);
      };
      if (choice === "learn") return learning();
      if (choice === "interview") {
        postAssistantMessage(
          sessionId,
          `Let's write it together: a few quick questions about how you write on ${label}. Answer in your own words, or skip any of them.`,
        );
        return askInterview(sessionId, net, (answers) => {
          if (Object.keys(answers).length) return learning(answers);
          // Nothing said: the default voice — or, from « Give X its own voice », as it was.
          if (giving) return postAssistantMessage(sessionId, `OK, ${label} keeps the default voice for now.`);
          keepDefault();
        });
      }
      // Backing out of the document dialog puts the question back.
      openFillDocumentModal({
        onConfirm: ({ file, url }) => learning(file?.name || documentName(url)),
        onDismiss: () => askVoice(sessionId, ctxId, nets, onReady, { announce: false, giving }),
      });
    },
    onSkip: () => postAssistantMessage(sessionId, `OK, I won't write anything for now.`),
  });
}
