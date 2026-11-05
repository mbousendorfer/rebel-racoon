// The drafts asks a chat answers itself instead of the scripted reply: delete,
// schedule, image, rewrite / translate, regenerate, first comment, mentions and
// send for review — each resolved from the sentence ("post 2", "the LinkedIn
// one", "all of them") or asked with the posts Quickpicker, then confirmed in
// the thread. Plus the post-plan switch and the schedule plan's "Adjust dates".
// Moved out of session.js, unchanged; it touches none of the screen's state.

import { escapeHtml, formatDayLabel, formatTimeOfDay } from "../../utils.js?v=2764";
import { networkLabel, networkIcon } from "../../social-profiles.js?v=2764";
import {
  getThread,
  postAssistantMessage,
  postRevisionTurn,
  postRevisionGroupTurn,
  postUserTurn,
  postSelectionEcho,
  postSchedulePlan,
  setSchedulePlanStatus,
  startPending,
  finishPending,
  postActivity,
} from "../../assistant.js?v=2764";
import { startRewrite, languageOf, TRANSLATE_LANGUAGES } from "../../draft-rewrite.js?v=2764";
import { startPostPlan } from "../../post-plan-flow.js?v=2764";
import {
  MENTION_ASK,
  UNMENTION_ASK,
  mentionNamesIn,
  mentionInDrafts,
  unmentionInDrafts,
} from "../../mention-flow.js?v=2764";
import {
  getPlans as getPostPlans,
  getActivePlan as getActivePostPlan,
  setActivePlan as setActivePostPlan,
} from "../../post-plan-store.js?v=2764";
import { getSources } from "../../library.js?v=2764";
import { getPosts, removePost, addPostDraft, updatePostContent } from "../../posts-store.js?v=2764";
import * as inlineQuestion from "../../inline-question.js?v=2764";
import { planSlots, defaultStrategy, CADENCES, queueEntries } from "../../schedule-engine.js?v=2764";
import { addToQueue } from "../../schedule-store.js?v=2764";
import { refLabel } from "../../chat-refs.js?v=2764";
import {
  openScheduleForPosts,
  onPostImage,
  openAssignForPosts,
  commitAssigned,
} from "../../components/right-panel/drafts-view.js?v=2764";
import { MEMBERS, EXTERNAL_REVIEWERS, CURRENT_USER } from "../../org.js?v=2764";
import { isPostValid } from "../../post-validation.js?v=2764";
import { reviewBlock } from "../../components/assign-modal.js?v=2764";
import { isFlagOn } from "../../feature-flags.js?v=2764";
import { focusInPanel } from "../../components/right-panel.js?v=2764";
import { blockInDemo } from "../../demo-flow.js?v=2764";

// "Delete all the drafts" — a destructive, irreversible ask, so I confirm it in
// the chat (Quickpicker) instead of acting on the sentence. Same set the Drafts
// panel shows (scheduled posts have left it). No undo: the confirm is the guard.
const DELETE_DRAFTS = /\b(delete|remove|clear|trash|erase)\b.*\bdrafts?\b/i;

function confirmDeleteDrafts(sessionId, drafts, { all = false } = {}) {
  const n = drafts.length;
  // Every draft: a count says it. A selection: name them, one per line.
  postAssistantMessage(
    sessionId,
    all
      ? `This deletes ${n === 1 ? "the only draft" : `all ${n} drafts`} in this chat. Should I go ahead?`
      : `This deletes ${n === 1 ? "this draft" : `these ${n} drafts`}:${drafts.map((d) => `\n- [[post:${d.id}]]`).join("")}`,
  );
  inlineQuestion.ask(sessionId, {
    title: n === 1 ? "Delete this draft?" : `Delete ${n} drafts?`,
    subtitle: "This can't be undone.",
    stepLabel: "Confirm",
    // No rows — the two answers are the footer's buttons, bottom-right. The
    // delete is red: a destructive answer in the chat reads as one (the DS red
    // button, stroked — there is no filled red to take).
    items: [],
    actions: [
      { value: "keep", label: "Keep them" },
      { value: "delete", label: n === 1 ? "Delete the draft" : `Delete ${n} drafts`, danger: true },
    ],
    onPick: (choice) => {
      // The answer stays visible in the thread, like any pick.
      postUserTurn(
        sessionId,
        choice === "delete" ? (n === 1 ? "Delete the draft" : `Delete ${n} drafts`) : "Keep them",
      );
      if (choice !== "delete") {
        postAssistantMessage(sessionId, "Okay, I kept them.");
        return;
      }
      for (const post of drafts) removePost(sessionId, post.id);
      const label = n === 1 ? "1 draft" : `${n} drafts`;
      postAssistantMessage(sessionId, `Done, I deleted ${label}.`);
    },
  });
}

// "Schedule all the drafts" — I don't schedule on a sentence: I lay out the plan
// in the chat (each draft, the date I'd give it — the schedule modal's engine,
// so the same dates it would open on), then ask. Schedule commits it as the
// Drafts panel does; Adjust dates opens the modal on the same drafts.
const SCHEDULE_DRAFTS = /\bschedule\b.*\bdrafts?\b/i;
const IMAGE_FOR_DRAFT = /\b(add|make|create|generate)\b.*\b(image|visual|picture)\b.*\b(draft|post)\b/i;
// "all" / "every" names the whole set; anything else ("schedule some drafts",
// "delete a draft") is a selection, so I ask which.
const ALL_OF_THEM = /\b(all|every|each)\b/i;

// Editing drafts from the chat (prod modify_post / regenerate_posts /
// manage_first_comment). A rewrite names its direction; the target is resolved
// from the sentence ("post 2", "the LinkedIn one", "all of them", "it") or
// asked for. Only when the sentence talks about existing drafts — "write a
// longer post about X" is a new post, not an edit.
const REWRITE_INTENTS = [
  // "Translate post 1 into French", "rewrite them in Spanish": a rewrite whose
  // direction is a language (the draft is replaced, Undo brings it back).
  ["translate", /\btranslat\w*\b|\b(?:rewrite|put|write)\b.*\bin (?:french|spanish|english)\b/i],
  // Word-level asks first: "tighten the hook" is punchier, not shorter.
  ["punchier", /\b(punchier|punchy|snappier|sharper|stronger hook|tighten the hook|better hook)\b/i],
  ["emoji", /\bemojis?\b/i],
  ["cta", /\b(cta|call to action|call-to-action)\b/i],
  ["shorter", /\b(shorter|shorten|tighter|tighten|more concise|trim)\b/i],
  ["longer", /\b(longer|lengthen|expand|more detail)\b/i],
  ["warmer", /\b(warmer|friendlier|more casual|more human)\b/i],
  ["formal", /\b(more formal|more professional|formal)\b/i],
  ["fresh", /\b(rewrite|rephrase|another take|reword)\b/i],
];
const ABOUT_EXISTING_DRAFTS = /\b(post|posts|draft|drafts|it|them|these|this|that|one|ones)\b/i;
const NEW_POST_ASK = /\b(write|draft|create|make)\b.*\b(a|an|new)\b.*\b(post|draft)\b.*\babout\b/i;
const REGENERATE_DRAFTS = /\b(regenerate|more drafts|another batch|generate more|a few more|new drafts)\b/i;
const FIRST_COMMENT = /\bfirst comment\b/i;
// "Send these to Julie for review" / "assign the LinkedIn ones to Sam".
const REVIEW_DRAFTS = /\b(send|assign|submit)\b.*\b(review|approval|approve|to)\b|\bfor (review|approval)\b/i;
const REWRITE_DONE = {
  shorter: "shorter",
  longer: "longer",
  warmer: "warmer",
  formal: "more formal",
  fresh: "with a fresh take",
  punchier: "with a punchier hook",
  emoji: "with emojis",
  cta: "with a call to action",
};
// These three only ever edit a draft: "add emojis" needs no "it" to be about one.
const WORD_LEVEL = new Set(["punchier", "emoji", "cta", "translate"]);
const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };

// Which drafts a sentence points at, or null when it doesn't say. `drafts` is
// the panel order (newest first), so "post 2" is the second card.
// "into French": the language named, else the first one the draft isn't in.
function translateTarget(text, draft) {
  const named = text.match(/\b(french|spanish|english)\b/i)?.[1];
  if (named) return named.charAt(0).toUpperCase() + named.slice(1).toLowerCase();
  return TRANSLATE_LANGUAGES.find((l) => l !== languageOf(draft));
}

function draftsNamedIn(text, drafts) {
  if (ALL_OF_THEM.test(text) || /\bthem\b|\bthese\b/i.test(text)) return drafts;
  const num = text.match(/\b(?:post|draft)\s*#?(\d+)\b/i)?.[1];
  const word = text.match(/\b(first|second|third|fourth|fifth|last)\b/i)?.[1]?.toLowerCase();
  const index = num ? Number(num) : word ? ORDINALS[word] : null;
  if (index) {
    const d = index === -1 ? drafts[drafts.length - 1] : drafts[index - 1];
    return d ? [d] : null;
  }
  const net = text.match(/\b(linkedin|instagram|facebook|tiktok|youtube|twitter|x)\b/i)?.[1]?.toLowerCase();
  if (net) {
    const network = net === "x" ? "twitter" : net;
    const onNet = drafts.filter((d) => d.network === network);
    if (onNet.length === 1 || (onNet.length && /\bones\b|\bposts\b|\bdrafts\b/i.test(text))) return onNet;
    return null;
  }
  if (drafts.length === 1) return drafts;
  return null;
}

// `language`: a translation's target.
function rewriteDrafts(sessionId, targets, intent, { language } = {}) {
  if (intent === "translate") {
    // A draft already in that language has nothing to translate.
    const asked = targets.length;
    targets = targets.filter((d) => languageOf(d) !== language);
    if (!targets.length) {
      postAssistantMessage(sessionId, `${asked === 1 ? "It's" : "They're"} already in ${language}.`);
      return;
    }
  }
  const done = intent === "translate" ? `in ${language}` : REWRITE_DONE[intent];
  postActivity(sessionId, ["modify_post"]);
  postAssistantMessage(
    sessionId,
    targets.length === 1
      ? `Rewriting [[post:${targets[0].id}]] ${done}.`
      : `Rewriting these ${targets.length} drafts ${done}:${targets.map((d) => `\n- [[post:${d.id}]]`).join("")}`,
  );
  // Each rewritten draft gets its "what changed" sentence (flag draftChanges) —
  // or, when the ask touched several, one for all of them once the last lands.
  const grouped = targets.length > 1;
  const items = [];
  let expected = 0;
  const onCommit = (d) => {
    if (!isFlagOn("draftChanges")) return undefined;
    if (!grouped)
      return (before, after) =>
        postRevisionTurn(sessionId, { postId: d.id, network: d.network, intent, before, after });
    return (before, after) => {
      items.push({ postId: d.id, network: d.network, before, after });
      if (items.length < expected) return;
      const order = targets.map((t) => t.id);
      items.sort((a, b) => order.indexOf(a.postId) - order.indexOf(b.postId));
      postRevisionGroupTurn(sessionId, { intent, items });
    };
  };
  for (const d of targets) if (startRewrite(sessionId, d.id, intent, { onCommit: onCommit(d), language })) expected++;
  // After the rewrite's first repaint of the panel: focusing before it, the
  // repaint put the scroll back where it was and the draft stayed out of sight.
  focusInPanel("post", targets[0].id);
}

// "Regenerate" adds drafts and keeps the ones you have (prod append=true): each
// picked draft gets a fresh sibling on the same network, same context.
function regenerateDrafts(sessionId, targets) {
  const pendingId = startPending(sessionId, "Generating new posts…", ["regenerate_posts"]);
  setTimeout(() => {
    finishPending(sessionId, pendingId);
    const made = targets.map((d) => {
      const fresh = addPostDraft(sessionId, {
        network: d.network,
        text: [d.text[0], "Same idea, from another side: what changes for the reader, and why now."],
        hashtags: d.hashtags,
        language: d.language,
      });
      fresh.generationContext = d.generationContext || null;
      return fresh;
    });
    postAssistantMessage(
      sessionId,
      `I added ${made.length === 1 ? "a new draft" : `${made.length} new drafts`} and kept the others:${made
        .map((d) => `\n- [[post:${d.id}]]`)
        .join("")}`,
    );
    focusInPanel("post", made[0].id);
  }, 2400);
}

// A first comment: the CTA moves there when the draft has one (I ask), else I
// write one that invites the conversation.
function firstCommentFor(sessionId, draft) {
  const write = (comment, { moveCta = false } = {}) => {
    postActivity(sessionId, ["manage_first_comment"]);
    updatePostContent(sessionId, draft.id, { firstComment: comment, ...(moveCta ? { cta: "" } : {}) });
    focusInPanel("post", draft.id);
    postAssistantMessage(sessionId, `I added a first comment to [[post:${draft.id}]].`);
  };
  const generic = "What would you add? I read every reply.";
  if (!draft.cta) return write(generic);
  postAssistantMessage(sessionId, `[[post:${draft.id}]] has a call to action. Where should it go?`);
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "First comment",
    skipLabel: "No thanks",
    items: [
      {
        value: "comment",
        label: "In the first comment",
        caption: "The post stays clean; the link sits right under it.",
      },
      {
        value: "post",
        label: "In the post",
        caption: "Keep it where it is, and add a comment that starts the conversation.",
      },
    ],
    onPick: (where) => {
      postUserTurn(sessionId, where === "comment" ? "In the first comment" : "In the post");
      if (where === "comment") write(draft.cta, { moveCta: true });
      else write(generic);
    },
    onSkip: () => postAssistantMessage(sessionId, "Okay, I'll leave it as it is."),
  });
}

// Every typed ask I answer in the chat instead of the scripted reply: the
// drafts asks, then a post with no source to write from (post-plan-flow.js).
// Returns true when one took the message.
export function routeTypedAsk(session, text) {
  if (routeDraftsAsk(session, text)) return true;
  // A post plan is for a chat with nothing to write from yet — once a source is
  // in, "write a post about…" drafts from it as before.
  if (!getSources(session.id).length && startPostPlan(session.id, text)) return true;
  return false;
}

export function askSwitchPostPlan(sessionId) {
  const plans = getPostPlans(sessionId);
  const active = getActivePostPlan(sessionId);
  postAssistantMessage(sessionId, "Which post plan should I work from?");
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Post plan",
    items: plans.map((p) => ({
      value: p.id,
      label: p.topic,
      caption: p.id === active?.id ? "Current plan" : null,
    })),
    onPick: (id) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) return;
      postUserTurn(sessionId, plan.topic);
      setActivePostPlan(sessionId, id);
      postAssistantMessage(sessionId, `Okay, back to the plan about ${plan.topic}.`);
    },
    skipLabel: "Not now",
    onSkip: () => {},
  });
}

// Who the sentence names as the reviewer — a member's or an external
// reviewer's first or full name ("to Julie", "to Sam Rivera").
function reviewerNamedIn(text) {
  const all = [...MEMBERS.filter((m) => m.id !== CURRENT_USER.id), ...EXTERNAL_REVIEWERS];
  const folded = text.toLowerCase();
  return (
    all.find((r) => folded.includes(r.name.toLowerCase())) ||
    all.find((r) => new RegExp(`\\b${r.name.split(" ")[0].toLowerCase()}\\b`).test(folded)) ||
    null
  );
}

// Send drafts for review from the chat (prod assign_posts): only drafts that
// pass validation can go; a named reviewer who can't approve them is told why;
// no name → I ask. Then my plan and the go — Send, or Adjust in the modal.
function reviewFromChat(sessionId, picked, text) {
  const ready = picked.filter(isPostValid);
  const blocked = picked.filter((d) => !isPostValid(d));
  if (!ready.length) {
    postAssistantMessage(
      sessionId,
      `${picked.length === 1 ? "That draft needs" : "Those drafts need"} fixes before anyone can review ${picked.length === 1 ? "it" : "them"}. See Needs fixes in Drafts.`,
    );
    return;
  }
  const named = reviewerNamedIn(text);
  const block = named && reviewBlock(named, ready);
  if (named && !block) return proposeReview(sessionId, ready, named, blocked);
  const them = ready.length === 1 ? "it" : "them";
  if (block) postAssistantMessage(sessionId, `I can't send ${them} to ${named.name}: ${block.why}.`);
  const eligible = [...MEMBERS.filter((m) => m.id !== CURRENT_USER.id), ...EXTERNAL_REVIEWERS].filter(
    (r) => !reviewBlock(r, ready),
  );
  postAssistantMessage(sessionId, `Who should review ${them}?`);
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Reviewer",
    searchable: eligible.length > 6,
    searchPlaceholder: "Search people…",
    items: eligible.map((r) => ({ value: r.id, label: r.name, caption: r.external ? r.org : "Team member" })),
    skipLabel: "Not now",
    onPick: (id) => {
      const reviewer = eligible.find((r) => r.id === id);
      if (!reviewer) return;
      postUserTurn(sessionId, reviewer.name);
      proposeReview(sessionId, ready, reviewer, blocked);
    },
    onSkip: () => postAssistantMessage(sessionId, "Okay, I'll leave them as they are."),
  });
}

function proposeReview(sessionId, drafts, reviewer, blocked = []) {
  const n = drafts.length;
  postActivity(sessionId, ["assign_posts"]);
  postAssistantMessage(
    sessionId,
    `I'll send ${n === 1 ? "this draft" : `these ${n} drafts`} to ${reviewer.name} for review:${drafts
      .map((d) => `\n- [[post:${d.id}]]`)
      .join(
        "",
      )}${blocked.length ? `\n\n${blocked.length === 1 ? "One draft stays here" : `${blocked.length} drafts stay here`}: ${blocked.length === 1 ? "it needs" : "they need"} fixes first.` : ""}`,
  );
  inlineQuestion.ask(sessionId, {
    title: n === 1 ? "Send it for review?" : "Send them for review?",
    stepLabel: "Review",
    items: [],
    actions: [
      { value: "adjust", label: "Adjust", stroked: true },
      { value: "send", label: n === 1 ? "Send for review" : `Send ${n} posts for review`, primary: true },
    ],
    skipLabel: "Not now",
    onPick: (choice) => {
      const done = (assignment) =>
        postAssistantMessage(
          sessionId,
          `Sent to ${assignment.reviewer.name}. ${n === 1 ? "It's" : "They're"} in their review queue now, out of this chat.`,
        );
      if (choice === "adjust") {
        postUserTurn(sessionId, "Adjust");
        openAssignForPosts(sessionId, drafts, { reviewerId: reviewer.id, onAssigned: done });
        return;
      }
      postUserTurn(sessionId, n === 1 ? "Send for review" : `Send ${n} posts for review`);
      const assignment = { reviewer, dueAt: null, comment: "" };
      commitAssigned(sessionId, drafts, assignment);
      done(assignment);
    },
    onSkip: () => postAssistantMessage(sessionId, "Okay, I'll leave them as they are."),
  });
}

// The drafts asks I handle in the chat instead of the scripted reply. Returns
// true when it took the message.
function routeDraftsAsk(session, text) {
  const asked = NEW_POST_ASK.test(text) ? null : REWRITE_INTENTS.find(([, re]) => re.test(text))?.[0];
  const rewrite = asked && (WORD_LEVEL.has(asked) || ABOUT_EXISTING_DRAFTS.test(text)) ? asked : null;
  // A mention first (flag draftMentions): « remove @X from the draft » takes
  // the mention out, it doesn't delete the draft.
  const mention = isFlagOn("draftMentions")
    ? UNMENTION_ASK.test(text)
      ? "unmention"
      : (MENTION_ASK.test(text) || /(?:^|\s)@\w/.test(text)) &&
          !/\b(?:don'?t|do not|without)\s+(?:mention|tag)/i.test(text)
        ? "mention"
        : null
    : null;
  const intent = mention
    ? mention
    : DELETE_DRAFTS.test(text)
      ? "delete"
      : SCHEDULE_DRAFTS.test(text)
        ? "schedule"
        : IMAGE_FOR_DRAFT.test(text)
          ? "image"
          : FIRST_COMMENT.test(text)
            ? "firstComment"
            : REVIEW_DRAFTS.test(text) && ABOUT_EXISTING_DRAFTS.test(text)
              ? "review"
              : REGENERATE_DRAFTS.test(text)
                ? "regenerate"
                : rewrite
                  ? "modify"
                  : null;
  if (!intent) return false;
  const sessionId = session.id;
  const drafts = getPosts(sessionId).filter((p) => p.status !== "scheduled");
  // An edit with nothing to edit isn't mine to answer — let the reply handle it.
  const EDITS = ["modify", "regenerate", "firstComment", "review", "mention", "unmention"];
  if (!drafts.length && EDITS.includes(intent)) return false;
  postUserTurn(sessionId, text);
  if (!drafts.length) {
    postAssistantMessage(
      sessionId,
      `There are no drafts in this chat to ${intent === "image" ? "illustrate" : intent}.`,
    );
    return true;
  }
  const all = ALL_OF_THEM.test(text);
  if (EDITS.includes(intent)) {
    const run = (picked) =>
      intent === "modify"
        ? rewriteDrafts(sessionId, picked, rewrite, {
            language: rewrite === "translate" ? translateTarget(text, picked[0]) : undefined,
          })
        : intent === "regenerate"
          ? regenerateDrafts(sessionId, picked)
          : intent === "review"
            ? reviewFromChat(sessionId, picked, text)
            : intent === "mention"
              ? mentionInDrafts(sessionId, picked, mentionNamesIn(text))
              : intent === "unmention"
                ? unmentionInDrafts(sessionId, picked, mentionNamesIn(text))
                : firstCommentFor(sessionId, picked[0]);
    const named = draftsNamedIn(text, drafts);
    // Taking a mention out: of every draft that has it, unless the sentence says which.
    const targets =
      intent === "firstComment" && named ? named.slice(0, 1) : intent === "unmention" ? named || drafts : named;
    if (targets?.length) run(targets);
    else askWhichDrafts(sessionId, drafts, { verb: intent, onPick: run });
    return true;
  }
  if (intent === "image") {
    if (drafts.length === 1) imageForDraft(sessionId, drafts[0]);
    else askWhichDrafts(sessionId, drafts, { verb: "image", onPick: ([d]) => imageForDraft(sessionId, d) });
  } else if (all || drafts.length === 1) {
    if (intent === "delete") confirmDeleteDrafts(sessionId, drafts, { all: true });
    else proposeSchedule(session, drafts);
  } else {
    askWhichDrafts(sessionId, drafts, {
      verb: intent,
      onPick: (picked) =>
        intent === "delete" ? confirmDeleteDrafts(sessionId, picked) : proposeSchedule(session, picked),
    });
  }
  return true;
}

// "Which drafts?" — the posts Quickpicker: the drafts as the thread lists them
// (network glyph + reference, previewed on hover), multi for schedule / delete,
// single for an image. Nothing pre-selected.
function askWhichDrafts(sessionId, drafts, { verb, onPick }) {
  const multi = verb !== "image" && verb !== "firstComment";
  const copy = {
    schedule: { q: "Which drafts should I schedule?", cta: "Schedule drafts", tone: "orange" },
    delete: { q: "Which drafts should I delete?", cta: "Delete drafts" },
    image: { q: "Which draft should I make an image for?", cta: "Make image" },
    modify: { q: "Which drafts should I edit?", cta: "Edit drafts" },
    regenerate: { q: "Which drafts should I write new ones for?", cta: "Write new drafts" },
    firstComment: { q: "Which draft should get a first comment?", cta: "Add first comment" },
    review: { q: "Which drafts should I send for review?", cta: "Send for review" },
    mention: { q: "Which drafts should I add the mention to?", cta: "Add mention" },
    unmention: { q: "Which drafts should I take the mention out of?", cta: "Take it out" },
  }[verb];
  postAssistantMessage(sessionId, copy.q);
  inlineQuestion.ask(sessionId, {
    title: copy.q,
    subtitle: multi ? "Pick one or more." : null,
    stepLabel: "Drafts",
    variant: "posts",
    multi,
    single: !multi,
    items: drafts.map((d) => ({
      value: d.id,
      label: escapeHtml(refLabel("post", d)),
      icon: networkIcon(d.network),
      sessionId,
    })),
    submitLabel: copy.cta,
    submitTone: copy.tone,
    skipLabel: "Not now",
    onPick: (value) => {
      const ids = Array.isArray(value) ? value : [value];
      const picked = drafts.filter((d) => ids.includes(d.id));
      if (!picked.length) return;
      // The pick stays visible as what was picked — one echo card per draft
      // (network glyph, its opening words, "<Network> draft"), not a sentence.
      for (const d of picked) {
        postSelectionEcho(sessionId, {
          icon: networkIcon(d.network),
          title: refLabel("post", d).split(" · ").slice(1).join(" · ") || refLabel("post", d),
          meta: `${networkLabel(d.network)} draft`,
        });
      }
      onPick(picked);
    },
    onSkip: () => postAssistantMessage(sessionId, "Okay, I'll leave them as they are."),
  });
}

// An image for one draft — the Drafts panel's own image action, so the chat
// and the panel make it the same way (the Image Generator's questions under
// sexySquirrel, a one-click image otherwise).
function imageForDraft(sessionId, draft) {
  postAssistantMessage(sessionId, `Let's make an image for [[post:${draft.id}]].`);
  focusInPanel("post", draft.id);
  onPostImage(draft.id);
}

const planTime = formatTimeOfDay;
const postsWord = (n) => (n === 1 ? "1 post" : `${n} posts`);

function proposeSchedule(session, drafts) {
  if (blockInDemo()) return;
  const sessionId = session.id;
  const n = drafts.length;
  const strategy = defaultStrategy(session.contextId);
  const slots = planSlots(drafts, strategy).sort((a, b) => a.when - b.when);
  const first = slots[0].when;
  const last = slots[slots.length - 1].when;

  // How I picked, in one sentence — the modal's closed-settings sentence.
  const nets = [...new Set(drafts.map((p) => networkLabel(p.network)))];
  const best = nets.length === 1 ? `${nets[0]}'s best time` : "each network's best time";
  const cadence = (CADENCES.find((c) => c.id === strategy.cadence) || CADENCES[0]).label.toLowerCase();
  const intro =
    n === 1
      ? `Here's when I'd post it: ${formatDayLabel(first)}, at ${best}.`
      : `Here's when I'd post them: ${cadence} from ${formatDayLabel(strategy.startFrom)}, each at ${best}, around what's already scheduled.`;
  const days = Math.round((new Date(last).setHours(0, 0, 0, 0) - new Date(first).setHours(0, 0, 0, 0)) / 86400000) + 1;
  const summary =
    n === 1
      ? `<strong>${formatDayLabel(first)}</strong> at ${planTime(first)}`
      : `<strong>${postsWord(n)} over ${days} ${days === 1 ? "day" : "days"}</strong> · ${formatDayLabel(first)} – ${formatDayLabel(last)}`;

  const planId = postSchedulePlan(sessionId, {
    intro,
    summary,
    rows: slots.map((s) => ({
      postId: s.post.id,
      network: s.post.network,
      label: refLabel("post", s.post),
      when: s.when,
    })),
  });

  inlineQuestion.ask(sessionId, {
    title: `Schedule ${postsWord(n)}?`,
    subtitle: "Posts will publish to your connected accounts.",
    stepLabel: "Schedule",
    items: [],
    skipLabel: "Not now",
    actions: [
      { value: "adjust", label: "Adjust dates", stroked: true },
      { value: "schedule", label: `Schedule ${postsWord(n)}`, primary: true, tone: "orange" },
    ],
    onPick: (choice) => {
      postUserTurn(sessionId, choice === "schedule" ? `Schedule ${postsWord(n)}` : "Adjust dates");
      if (choice === "adjust") {
        postAssistantMessage(sessionId, "I opened the planner on the same dates. Change any of them, then schedule.");
        openPlanInModal(sessionId, planId);
        return;
      }
      addToQueue(queueEntries(slots));
      for (const post of drafts) removePost(sessionId, post.id);
      finishSchedulePlan(sessionId, planId, slots);
    },
    onSkip: () => {
      setSchedulePlanStatus(sessionId, planId, "dismissed");
      postAssistantMessage(sessionId, "Okay, they stay in your drafts.");
    },
  });
}

function finishSchedulePlan(sessionId, planId, slots) {
  setSchedulePlanStatus(sessionId, planId, "scheduled");
  const sorted = [...(slots || [])].sort((a, b) => a.when - b.when);
  const firstAt = sorted[0]?.when;
  const n = sorted.length;
  postAssistantMessage(
    sessionId,
    firstAt
      ? `Done, I scheduled ${postsWord(n)}. The first goes out ${formatDayLabel(firstAt)} at ${planTime(firstAt)}.`
      : "Done, they're scheduled.",
  );
}

// The plan's drafts in the schedule modal — from "Adjust dates", or straight
// from a date in the plan (the quick way to change one). Scheduling there
// settles the plan, and the plan's question if it's still open.
export function openPlanInModal(sessionId, planId) {
  const plan = getThread(sessionId).find((m) => m.id === planId);
  if (!plan) return;
  const posts = plan.rows.map((r) => getPosts(sessionId).find((p) => p.id === r.postId)).filter(Boolean);
  if (!posts.length) return;
  openScheduleForPosts(sessionId, posts, (slots) => {
    if (inlineQuestion.isActive(sessionId)) inlineQuestion.exit(sessionId);
    finishSchedulePlan(sessionId, planId, slots);
  });
}
