// The voice step before a draft (flag voicePerNetwork). A draft is written in
// its network's voice, so a network with no voice yet gets one FIRST — in the
// slot of the flow that asked, like requireConnectedProfiles, and the flow
// resumes once every network has one. It blocks: there is no "write anyway",
// but one of the three answers is the Brand voice as it is — a voice defined,
// not optimized, allowed and warned (here, on the draft, on the Playbook).
//
// Public API:
//   requireNetworkVoices(sessionId, networks, onReady, contextId?)
//   contextId: the Playbook the drafts are written for, when it isn't the chat's
// Shared with the dialog that asks the same thing where there is no chat (the
// Clips space, components/network-voice-modal.js):
//   missingNetworkVoices(ctx, networks) · voiceChoices(net) · applyNetworkVoice(ctxId, net, choice)
//
// onReady() runs IMMEDIATELY when every network already has a voice — always
// the case with the flag off — so callers wrap unconditionally.

import * as inlineQuestion from "./inline-question.js?v=2227";
import { postAssistantMessage, postUserTurn, startPending, finishPending } from "./assistant.js?v=2227";
import { getContextById, updateContext } from "./contexts-store.js?v=2227";
import { getSessionById } from "./sessions-store.js?v=2227";
import { networkLabel, networkMeta, normalizeNetwork, profileForNetwork } from "./social-profiles.js?v=2227";
import {
  networkVoiceOn,
  networkVoice,
  canLearnFrom,
  learnNetworkVoice,
  optimizeForNetwork,
  copyBrandVoice,
  playbookNetworks,
} from "./voice-parts.js?v=2227";

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

// The three ways to give a network its voice, the first one the best — learned
// from the account's posts when it has enough.
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
      value: "optimize",
      label: `Optimize the Brand voice for ${label}`,
      caption:
        account && !learn
          ? `${account.handle} doesn't have enough posts to learn from, so I start from the Brand voice.`
          : `I start from the Brand voice and add what works on ${label}.`,
    },
    {
      value: "plain",
      label: "Use the Brand voice as it is",
      caption: `Not optimized for ${label}: no length, format or hashtag habits of its own.`,
    },
  ].filter(Boolean);
  return { account, items };
}

function askVoice(sessionId, ctxId, [net, ...rest], onReady) {
  const label = networkLabel(net);
  const { account, items } = voiceChoices(net);
  postAssistantMessage(sessionId, `${label} doesn't have a voice yet, and I write every draft in its network's voice.`);
  inlineQuestion.ask(sessionId, {
    title: `How should I write on ${label}?`,
    stepLabel: "Voice",
    skipLabel: "Cancel",
    items,
    onPick: (choice) => {
      inlineQuestion.exit(sessionId);
      postUserTurn(sessionId, items.find((i) => i.value === choice)?.label || "");
      const done = () => {
        setVoice(sessionId, ctxId, net, choice, account);
        if (rest.length) askVoice(sessionId, ctxId, rest, onReady);
        else onReady();
      };
      if (choice === "plain") return done();
      const pendingId = startPending(
        sessionId,
        choice === "learn" ? `Reading ${account.handle}'s posts…` : `Optimizing the ${label} voice…`,
        ["analyze_tone"],
      );
      setTimeout(() => {
        finishPending(sessionId, pendingId);
        done();
      }, LEARN_MS);
    },
    onSkip: () => postAssistantMessage(sessionId, `OK, I won't write anything for now.`),
  });
}

// Writes the chosen voice on the Playbook.
export function applyNetworkVoice(ctxId, net, choice) {
  const ctx = getContextById(ctxId);
  if (!ctx) return;
  const account = profileForNetwork(net);
  const voice =
    choice === "learn"
      ? learnNetworkVoice(ctx, net, account)
      : choice === "optimize"
        ? optimizeForNetwork(ctx, net)
        : { ...copyBrandVoice(ctx), optimizedBy: "brand" };
  updateContext(ctxId, {
    voiceByNetwork: { ...(ctx.voiceByNetwork || {}), [net]: voice },
    // A network written for is one the Playbook publishes on.
    ...(!playbookNetworks(ctx).includes(net) && { connectedSocials: [...(ctx.connectedSocials || []), net] }),
  });
}

function setVoice(sessionId, ctxId, net, choice, account) {
  const label = networkLabel(net);
  applyNetworkVoice(ctxId, net, choice);
  postAssistantMessage(
    sessionId,
    choice === "learn"
      ? `I learned your ${label} voice from ${account.postCount} posts. It's in the Playbook if you want to change it.`
      : choice === "optimize"
        ? `Your ${label} voice is ready: the Brand voice, optimized for ${label}. It's in the Playbook if you want to change it.`
        : `I'll write for ${label} in the Brand voice as it is. It isn't optimized for ${label}, so the drafts may miss what works there. You can optimize it from the Playbook at any time.`,
  );
}
