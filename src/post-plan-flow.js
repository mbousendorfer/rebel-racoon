// post-plan-flow — writing a post when the chat has no source (prod
// `content-studio-convo`: update_post_brief → confirm_post_brief → drafts).
//
// "Write a post about our new pricing" in a chat with nothing in it used to hit
// "I don't have any sources in this chat yet". Now I plan it with you instead:
//   1. who it's for (Playbook audiences, or your words)
//   2. one fact to build it on (or none — then I say I'll stay general)
//   3. the post plan card: what I'll assume, what I won't invent, what you
//      asked me to leave out — and "Write drafts from this plan?"
//   4. the accounts (requireConnectedProfiles first), then the drafts.
// The plan lives in post-plan-store (one chat, possibly several plans); the
// composer's status slot shows the active one and its stage.

import {
  postAssistantMessage,
  postUserTurn,
  postUserProfilesTurn,
  postPostPlan,
  startPending,
  finishPending,
  postActivity,
  postDraftResult,
  GENERATION_TOOLS,
} from "./assistant.js?v=2214";
import * as inlineQuestion from "./inline-question.js?v=2214";
import { addPostDraft } from "./posts-store.js?v=2214";
import { getSessionById } from "./sessions-store.js?v=2214";
import { getContextById } from "./contexts-store.js?v=2214";
import { playbookForNewWork } from "./active-playbook.js?v=2214";
import { getConnectedProfiles, buildConnectedProfileItems } from "./social-profiles.js?v=2214";
import { requireConnectedProfiles } from "./connect-profiles-flow.js?v=2214";
import { createPlan, updatePlan, getPlans } from "./post-plan-store.js?v=2214";

// "write / draft / create a post about X" — the ask this flow answers. The
// topic is everything after "about".
const PLAN_ASK = /\b(?:write|draft|create|make)\b[^.?!]*?\b(?:post|posts|draft|drafts)\b[^.?!]*?\b(?:about|on)\s+(.+)/i;

// What you asked me to leave out, read off the ask ("no hashtags", "without
// emoji", "skip the link").
const LEAVE_OUT = [
  ["Hashtags", /\b(no|without|skip|drop)\b[^.]*\bhashtags?\b/i],
  ["Emoji", /\b(no|without|skip|drop)\b[^.]*\bemojis?\b/i],
  ["A link", /\b(no|without|skip|drop)\b[^.]*\blinks?\b/i],
  ["A call to action", /\b(no|without|skip|drop)\b[^.]*\b(cta|call to action)\b/i],
];

function matchPlanAsk(text) {
  const m = String(text || "").match(PLAN_ASK);
  if (!m) return null;
  const topic = m[1]
    .replace(/\b(no|without|skip|drop)\b.*$/i, "")
    .replace(/[,;:.!?\s]+$/, "")
    .trim();
  return topic ? topic : null;
}

function playbookFor(sessionId) {
  const session = getSessionById(sessionId);
  return session?.contextId ? getContextById(session.contextId) : playbookForNewWork();
}

// Entry point — the session's router calls it with the typed ask.
export function startPostPlan(sessionId, text) {
  const topic = matchPlanAsk(text);
  if (!topic) return false;
  const leftOut = LEAVE_OUT.filter(([, re]) => re.test(text)).map(([label]) => label);
  postUserTurn(sessionId, text);
  const plan = createPlan(sessionId, { topic, leftOut });
  postAssistantMessage(
    sessionId,
    `Let's plan this post about ${topic}. Two quick questions, so I write from what's true and not from guesses.`,
  );
  askAudience(sessionId, plan.id);
  return true;
}

function askAudience(sessionId, planId) {
  const ctx = playbookFor(sessionId);
  const audiences = (Array.isArray(ctx?.audience) ? ctx.audience : ctx?.audience ? [ctx.audience] : [])
    .map((a) => (typeof a === "string" ? a : a?.label || a?.name || ""))
    .filter(Boolean)
    .slice(0, 4);
  const items = (audiences.length ? audiences : ["Customers", "Prospects", "People in your industry"]).map((label) => ({
    value: label,
    label,
  }));
  postAssistantMessage(sessionId, "Who is it for?");
  const answer = (audience) => {
    const a = String(audience || "").trim();
    if (!a) return;
    postUserTurn(sessionId, a);
    updatePlan(sessionId, planId, { audience: a });
    askFact(sessionId, planId);
  };
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Post plan · Audience",
    items,
    customPlaceholder: "Or say who, in your words",
    onPick: answer,
    onCustom: answer,
    skipLabel: "Skip",
    // A Skip is procedural — not echoed (copy-principles §8.3).
    onSkip: () => askFact(sessionId, planId),
  });
}

function askFact(sessionId, planId) {
  postAssistantMessage(
    sessionId,
    "What's one fact I should build it on? A number, a date, a name, a price — anything real.",
  );
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Post plan · Fact",
    items: [],
    customPlaceholder: "e.g. Plans start at $29 a month from Monday",
    onCustom: (text) => {
      const fact = String(text || "").trim();
      if (!fact) return;
      postUserTurn(sessionId, fact);
      const plan = getPlans(sessionId).find((p) => p.id === planId);
      updatePlan(sessionId, planId, { facts: [...(plan?.facts || []), fact] });
      showPlan(sessionId, planId);
    },
    skipLabel: "I don't have one",
    onBack: () => askAudience(sessionId, planId),
    onSkip: () => {
      postUserTurn(sessionId, "I don't have one");
      showPlan(sessionId, planId);
    },
  });
}

// The recap card, then the go. What I assume is always said; what's missing is
// what I won't make up.
function showPlan(sessionId, planId) {
  const plan = getPlans(sessionId).find((p) => p.id === planId);
  if (!plan) return;
  const ctx = playbookFor(sessionId);
  const assumptions = [
    plan.audience ? `It's for ${plan.audience}` : "It's for your Playbook's main audience",
    `It sounds like ${ctx?.name || "your Playbook"}`,
    "Each network gets its usual length",
  ];
  const missing = [];
  if (!plan.facts.length) missing.push("A concrete fact or number — I'll keep it general instead");
  missing.push("A date or a link — I'll leave a placeholder");
  updatePlan(sessionId, planId, {
    assumptions,
    missing,
    generic: plan.facts.length === 0,
    stage: "ready",
  });
  postActivity(sessionId, ["update_post_brief"]);
  postPostPlan(sessionId, { planId });
  inlineQuestion.ask(sessionId, {
    title: "Write drafts from this plan?",
    stepLabel: "Post plan",
    items: [],
    actions: [
      { value: "adjust", label: "Adjust", stroked: true },
      { value: "write", label: `Write ${plan.perProfile} drafts per account`, primary: true },
    ],
    skipLabel: "Not now",
    onPick: (value) => {
      if (value === "adjust") {
        postUserTurn(sessionId, "Adjust");
        updatePlan(sessionId, planId, { stage: "planning" });
        askAudience(sessionId, planId);
        return;
      }
      postUserTurn(sessionId, "Write the drafts");
      requireConnectedProfiles(sessionId, {
        stepLabel: "Account",
        onReady: () => askAccounts(sessionId, planId),
      });
    },
    onSkip: () => postAssistantMessage(sessionId, "Okay — the plan stays here. Say the word when you want the drafts."),
  });
}

function askAccounts(sessionId, planId) {
  const connected = getConnectedProfiles();
  if (connected.length === 1) return writeFromPlan(sessionId, planId, connected);
  postAssistantMessage(sessionId, "Which accounts should I write for?");
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Accounts",
    multi: true,
    items: buildConnectedProfileItems({ requirePosts: false }),
    submitLabel: "Write drafts",
    onPick: (ids) => {
      const picked = connected.filter((a) => [].concat(ids).includes(a.id));
      if (!picked.length) return;
      postUserProfilesTurn(sessionId, picked);
      writeFromPlan(sessionId, planId, picked);
    },
    onSkip: () => {},
  });
}

function writeFromPlan(sessionId, planId, accounts) {
  const plan = getPlans(sessionId).find((p) => p.id === planId);
  if (!plan) return;
  updatePlan(sessionId, planId, { stage: "writing" });
  const pendingId = startPending(sessionId, "Generating post drafts…", GENERATION_TOOLS);
  setTimeout(() => {
    finishPending(sessionId, pendingId);
    const fact = plan.facts[0];
    const openers = [
      `${capitalize(plan.topic)} — here's what changes for you.`,
      `We've been working on ${plan.topic}. Here's the short version.`,
      `Three things to know about ${plan.topic}.`,
    ];
    const drafts = [];
    accounts.forEach((account) => {
      for (let i = 0; i < plan.perProfile; i += 1) {
        const d = addPostDraft(sessionId, {
          network: account.platform,
          text: [openers[(drafts.length + i) % openers.length], fact || "More on what it means for you, soon."],
          hashtags: [],
        });
        d.generationContext = {
          kind: "idea",
          headline: { icon: "ap-icon-file--text", text: `Post plan · ${plan.topic}` },
          source: {
            icon: "ap-icon-file--text",
            label: "Post plan",
            detail:
              [plan.audience && `For ${plan.audience}`, fact && `Built on: ${fact}`].filter(Boolean).join(" · ") ||
              "No fact given — kept general",
          },
        };
        drafts.push(d);
      }
    });
    updatePlan(sessionId, planId, { stage: "written" });
    postDraftResult(sessionId, { ideaTitle: plan.topic, drafts });
  }, 6000);
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
