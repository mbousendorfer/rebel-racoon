// The voice step before a draft (flag voicePerNetwork). A draft is written in
// its network's voice, so a network with no voice yet gets one FIRST — in the
// slot of the flow that asked, like requireConnectedProfiles, and the flow
// resumes once every network has one. It blocks: there is no "write anyway".
// Optimizing a voice is never a click: it is learned (the account's posts, a
// document, the user's answers to a few questions right here) or edited by the
// user — in the Clips dialog, « Edit it myself » leaves for the Playbook. The last answer is the Brand voice as it is: allowed, and warned
// (here, on the draft, on the Playbook).
//
// Public API:
//   requireNetworkVoices(sessionId, networks, onReady, contextId?)
//   contextId: the Playbook the drafts are written for, when it isn't the chat's
// Shared with the dialog that asks the same thing where there is no chat (the
// Clips space, components/network-voice-modal.js):
//   missingNetworkVoices(ctx, networks) · voiceChoices(net, { chat }) ·
//   applyNetworkVoice(ctxId, net, choice, from?) · editNetworkVoiceInPlaybook(ctxId, net)
// The chat's « voice-learned » turn answers through:
//   answerLearnedVoice(sessionId, turnId, "keep" | "edit")
//
// onReady() runs IMMEDIATELY when every network already has a voice — always
// the case with the flag off — so callers wrap unconditionally.

import * as inlineQuestion from "./inline-question.js?v=2243";
import {
  postAssistantMessage,
  postUserTurn,
  startPending,
  updatePending,
  finishPending,
  postVoiceTurn,
  resolveTurn,
} from "./assistant.js?v=2243";
import { introSeen, markIntroSeen } from "./components/voice-intro-modal.js?v=2243";
import { getContextById, updateContext } from "./contexts-store.js?v=2243";
import { getSessionById } from "./sessions-store.js?v=2243";
import { networkLabel, networkMeta, normalizeNetwork, profileForNetwork } from "./social-profiles.js?v=2243";
import { setHandoff } from "./handoff.js?v=2243";
import { navigate } from "./router.js?v=2243";
import { open as openFillDocumentModal } from "./components/fill-document-modal.js?v=2243";
import {
  networkVoiceOn,
  networkVoice,
  canLearnFrom,
  learnNetworkVoice,
  interviewNetworkVoice,
  brandVoiceAsIs,
  playbookNetworks,
} from "./voice-parts.js?v=2243";

// Learning a voice takes a moment, and says what it's doing: three phases.
export const LEARN_PHASE_MS = 1400;

export function learnPhases(net, docName = null) {
  const label = networkLabel(net);
  const account = profileForNetwork(net);
  return [
    docName ? `Reading ${docName}…` : `Reading ${account.postCount} posts of ${account.handle}…`,
    docName ? `Finding how you write on ${label}…` : `Finding what works on ${label}…`,
    `Writing your ${label} voice…`,
  ];
}

// The networks of a batch that have no voice yet — none with the flag off.
export function missingNetworkVoices(ctx, networks) {
  if (!networkVoiceOn() || !ctx) return [];
  return [...new Set((networks || []).map(normalizeNetwork))].filter(
    (n) => networkMeta(n) && networkVoice(ctx, n).state === "borrowed",
  );
}

export function requireNetworkVoices(sessionId, networks, onReady, contextId = null) {
  const ctx = getContextById(contextId || getSessionById(sessionId)?.contextId);
  const missing = missingNetworkVoices(ctx, networks);
  if (!missing.length) return onReady();
  askVoice(sessionId, ctx.id, missing, onReady);
}

// The ways to give a network its voice, the best first: learned from the
// account's posts when it has enough, from a document, from the user — asked
// in the chat (`chat`), else edited in the Playbook — or none.
export function voiceChoices(net, { chat = false } = {}) {
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
    chat
      ? {
          value: "interview",
          label: `Tell me how you write on ${label}`,
          caption: "I ask you a few quick questions here and write the voice from your answers.",
        }
      : {
          value: "edit",
          label: "Edit it myself",
          caption: `I open the ${label} voice in the Playbook, starting from the Brand voice. Ask me again once it's saved.`,
        },
    {
      value: "plain",
      label: "Use the Brand voice as it is",
      caption: `Not optimized for ${label}: no length, format or hashtag habits of its own.`,
    },
  ].filter(Boolean);
  return { account, items };
}

// The interview: a few questions about how the user writes on the network,
// one at a time, each skippable; the answers become its voice.
const INTERVIEW = [
  { key: "length", ask: (l) => `How long is a post of yours on ${l}? One line, a few sentences, a long read…` },
  { key: "layout", ask: () => "How do you lay it out? Short paragraphs, line breaks, emojis, a list…" },
  { key: "tags", ask: (l) => `Hashtags and mentions on ${l}: how many, and where?` },
  { key: "never", ask: (l) => `Anything you'd never do on ${l}?` },
  {
    key: "example",
    ask: (l) => `Last one: paste a post of yours that sounds just right on ${l}. It shows me better than any rule.`,
  },
];

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

// The learned voices waiting for an answer: turn id → { ctxId, net, go }.
const awaiting = new Map();

export function answerLearnedVoice(sessionId, turnId, action) {
  const wait = awaiting.get(turnId);
  if (!wait) return;
  awaiting.delete(turnId);
  resolveTurn(sessionId, turnId);
  const label = networkLabel(wait.net);
  if (action === "keep") {
    postUserTurn(sessionId, "Use this voice");
    return wait.go();
  }
  postUserTurn(sessionId, "Edit it in the Playbook");
  postAssistantMessage(
    sessionId,
    `I've opened the ${label} voice in the Playbook. Save your changes, then ask me again.`,
  );
  editNetworkVoiceInPlaybook(wait.ctxId, wait.net);
}

// `announce` is false when the question is PUT BACK (the document dialog was
// dismissed): the thread already says why it's asked.
function askVoice(sessionId, ctxId, nets, onReady, { announce = true } = {}) {
  const [net, ...rest] = nets;
  const label = networkLabel(net);
  const { account, items } = voiceChoices(net, { chat: true });
  // The first time anyone meets network voices, this is the intro (voice-intro-modal.js).
  if (announce && !introSeen()) {
    markIntroSeen();
    postVoiceTurn(sessionId, "voice-intro", { contextId: ctxId, network: net });
  } else if (announce)
    postAssistantMessage(
      sessionId,
      `${label} doesn't have a voice yet, and I write every draft in its network's voice.`,
    );
  inlineQuestion.ask(sessionId, {
    title: `How should I write on ${label}?`,
    stepLabel: "Voice",
    skipLabel: "Cancel",
    items,
    onPick: (picked) => {
      let choice = picked;
      inlineQuestion.exit(sessionId);
      postUserTurn(sessionId, items.find((i) => i.value === choice)?.label || "");
      const go = () => (rest.length ? askVoice(sessionId, ctxId, rest, onReady) : onReady());
      // A learned voice waits for its answer: use it, or edit it first.
      const next = (from) => {
        const turnId = setVoice(sessionId, ctxId, net, choice, from);
        if (turnId) awaiting.set(turnId, { ctxId, net, go });
        else go();
      };
      if (choice === "plain") return next();
      // `from`: the document's name, or the interview's answers.
      const learning = (from, phases = learnPhases(net, from)) => {
        const pendingId = startPending(sessionId, phases[0]);
        phases
          .slice(1)
          .forEach((p, i) => setTimeout(() => updatePending(sessionId, pendingId, p), LEARN_PHASE_MS * (i + 1)));
        setTimeout(() => {
          finishPending(sessionId, pendingId);
          next(from);
        }, LEARN_PHASE_MS * phases.length);
      };
      if (choice === "learn") return learning();
      if (choice === "interview") {
        postAssistantMessage(
          sessionId,
          `Let's write it together: a few quick questions about how you write on ${label}. Answer in your own words, or skip any of them.`,
        );
        return askInterview(sessionId, net, (answers) => {
          // Nothing said: the Brand voice as it is, said so.
          if (!Object.keys(answers).length) {
            choice = "plain";
            return next();
          }
          learning(answers, ["Reading your answers…", `Writing your ${label} voice…`]);
        });
      }
      // Backing out of the document dialog puts the question back.
      openFillDocumentModal({
        onConfirm: ({ file, url }) => learning(file?.name || documentName(url)),
        onDismiss: () => askVoice(sessionId, ctxId, nets, onReady, { announce: false }),
      });
    },
    onSkip: () => postAssistantMessage(sessionId, `OK, I won't write anything for now.`),
  });
}

export function documentName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "your document";
  } catch {
    return "your document";
  }
}

// « Edit it myself »: the network's tab, opened in edit (playbook-view consumes
// the key). The flow that asked stops here.
export function editNetworkVoiceInPlaybook(ctxId, net) {
  setHandoff("editNetworkVoice", { playbookId: ctxId, net });
  navigate(`/playbook/${ctxId}?tab=voice&voice=${net}`);
}

// Writes the chosen voice on the Playbook: learned (from the account's posts,
// a document — `from` its name — or the interview — `from` its answers), or
// the Brand voice as it is.
export function applyNetworkVoice(ctxId, net, choice, from = null) {
  const ctx = getContextById(ctxId);
  if (!ctx) return;
  const account = profileForNetwork(net);
  const voice =
    choice === "learn"
      ? learnNetworkVoice(ctx, net, { from: account.handle, postCount: account.postCount })
      : choice === "document"
        ? learnNetworkVoice(ctx, net, { from })
        : choice === "interview"
          ? interviewNetworkVoice(ctx, net, from)
          : brandVoiceAsIs(ctx);
  updateContext(ctxId, {
    voiceByNetwork: { ...(ctx.voiceByNetwork || {}), [net]: voice },
    // A network written for is one the Playbook publishes on.
    ...(!playbookNetworks(ctx).includes(net) && { connectedSocials: [...(ctx.connectedSocials || []), net] }),
  });
}

// A learned voice shows what it changes (the « voice-learned » turn, whose id
// is returned: it waits for an answer); the Brand voice as it is says what
// that costs.
function setVoice(sessionId, ctxId, net, choice, from) {
  const label = networkLabel(net);
  applyNetworkVoice(ctxId, net, choice, from);
  if (choice === "plain")
    return postAssistantMessage(
      sessionId,
      `I'll write for ${label} in the Brand voice as it is. It isn't optimized for ${label}, so the drafts may miss what works there. You can optimize it from the Playbook at any time.`,
    );
  return postVoiceTurn(sessionId, "voice-learned", { contextId: ctxId, network: net });
}
