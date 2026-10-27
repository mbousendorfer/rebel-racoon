// The voice step before a draft (flag voicePerNetwork). A draft is written in
// its network's voice, so a network with no voice yet gets one FIRST — in the
// slot of the flow that asked, like requireConnectedProfiles, and the flow
// resumes once every network has one. It blocks: there is no "write anyway".
// Optimizing a voice is never a click: it is learned (the account's posts, a
// document) or edited by the user — « Edit it myself » leaves the flow for the
// Playbook. The last answer is the Brand voice as it is: allowed, and warned
// (here, on the draft, on the Playbook).
//
// Public API:
//   requireNetworkVoices(sessionId, networks, onReady, contextId?)
//   contextId: the Playbook the drafts are written for, when it isn't the chat's
// Shared with the dialog that asks the same thing where there is no chat (the
// Clips space, components/network-voice-modal.js):
//   missingNetworkVoices(ctx, networks) · voiceChoices(net) ·
//   applyNetworkVoice(ctxId, net, choice, docName?) · editNetworkVoiceInPlaybook(ctxId, net)
//
// onReady() runs IMMEDIATELY when every network already has a voice — always
// the case with the flag off — so callers wrap unconditionally.

import * as inlineQuestion from "./inline-question.js?v=2238";
import { postAssistantMessage, postUserTurn, startPending, finishPending, postVoiceIntro } from "./assistant.js?v=2238";
import { introSeen, markIntroSeen } from "./components/voice-intro-modal.js?v=2238";
import { getContextById, updateContext } from "./contexts-store.js?v=2238";
import { getSessionById } from "./sessions-store.js?v=2238";
import { networkLabel, networkMeta, normalizeNetwork, profileForNetwork } from "./social-profiles.js?v=2238";
import { setHandoff } from "./handoff.js?v=2238";
import { navigate } from "./router.js?v=2238";
import { open as openFillDocumentModal } from "./components/fill-document-modal.js?v=2238";
import {
  networkVoiceOn,
  networkVoice,
  canLearnFrom,
  learnNetworkVoice,
  brandVoiceAsIs,
  playbookNetworks,
} from "./voice-parts.js?v=2238";

const LEARN_MS = 1800;

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
// account's posts when it has enough, from a document, by hand, or none.
export function voiceChoices(net) {
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

// `announce` is false when the question is PUT BACK (the document dialog was
// dismissed): the thread already says why it's asked.
function askVoice(sessionId, ctxId, nets, onReady, { announce = true } = {}) {
  const [net, ...rest] = nets;
  const label = networkLabel(net);
  const { account, items } = voiceChoices(net);
  // The first time anyone meets network voices, this is the intro (voice-intro-modal.js).
  if (announce && !introSeen()) {
    markIntroSeen();
    postVoiceIntro(sessionId, { contextId: ctxId, network: net });
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
    onPick: (choice) => {
      inlineQuestion.exit(sessionId);
      postUserTurn(sessionId, items.find((i) => i.value === choice)?.label || "");
      const next = (docName) => {
        setVoice(sessionId, ctxId, net, choice, docName);
        if (rest.length) askVoice(sessionId, ctxId, rest, onReady);
        else onReady();
      };
      if (choice === "plain") return next();
      if (choice === "edit") {
        postAssistantMessage(
          sessionId,
          `I've opened the ${label} voice in the Playbook. Change at least one thing, save it, then ask me again.`,
        );
        return editNetworkVoiceInPlaybook(ctxId, net);
      }
      // Backing out of the document dialog puts the question back.
      const learning = (docName) => {
        const pendingId = startPending(
          sessionId,
          docName ? `Reading ${docName}…` : `Reading ${account.handle}'s posts…`,
          ["analyze_tone"],
        );
        setTimeout(() => {
          finishPending(sessionId, pendingId);
          next(docName);
        }, LEARN_MS);
      };
      if (choice === "learn") return learning();
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
// or from `docName`), or the Brand voice as it is.
export function applyNetworkVoice(ctxId, net, choice, docName = null) {
  const ctx = getContextById(ctxId);
  if (!ctx) return;
  const account = profileForNetwork(net);
  const voice =
    choice === "learn"
      ? learnNetworkVoice(ctx, net, { from: account.handle, postCount: account.postCount })
      : choice === "document"
        ? learnNetworkVoice(ctx, net, { from: docName })
        : brandVoiceAsIs(ctx);
  updateContext(ctxId, {
    voiceByNetwork: { ...(ctx.voiceByNetwork || {}), [net]: voice },
    // A network written for is one the Playbook publishes on.
    ...(!playbookNetworks(ctx).includes(net) && { connectedSocials: [...(ctx.connectedSocials || []), net] }),
  });
}

function setVoice(sessionId, ctxId, net, choice, docName) {
  const label = networkLabel(net);
  applyNetworkVoice(ctxId, net, choice, docName);
  postAssistantMessage(
    sessionId,
    choice === "learn"
      ? `I learned your ${label} voice from ${profileForNetwork(net)?.postCount} posts. It's in the Playbook if you want to change it.`
      : choice === "document"
        ? `I learned your ${label} voice from ${docName}. It's in the Playbook if you want to change it.`
        : `I'll write for ${label} in the Brand voice as it is. It isn't optimized for ${label}, so the drafts may miss what works there. You can optimize it from the Playbook at any time.`,
  );
}
