// Topic → chat. The one forward action a Topic has, from all four surfaces that
// offer it: the feed card's menu, the article beside the feed, the in-chat fresh
// list, and the composer's picker.
//
// It hands the Topic to a NEW chat as a SOURCE. Rather than invent a downstream
// surface, it reuses the one the app already has — so Extract ideas, Draft a
// post, Ask about it and the Sources panel all light up with no new plumbing and
// no special case anywhere.
//
// Two halves, because the entry point and the arrival sit on opposite sides of a
// navigation, and because four callers need the first half while only session.js
// can host the second:
//
//   useTopicInChat(topicId)             mark it Used, then navigate to a fresh
//                                       chat bound to the Topic's Playbook
//   attachTopicToChat(sessionId, id)    consumed at session mount: attach
//
// ── The mark lands BEFORE the chat opens ───────────────────────────────────
// Not after, and not on arrival. The reader's last sight of the feed has to be
// the Topic already marked, or the feed they come back to looks like it forgot.
// It is done here rather than in each caller so all four surfaces mean exactly
// the same thing by "Use in chat".
//
// ── No echo message, and no question picker ────────────────────────────────
// The source-intake card already names the Topic and the composer is right
// there. A sentence repeating the headline was the same fact twice, and a picker
// of three suggested questions was a decision asked of a reader who had just
// made one.
//
// Version pins MUST match screens/session.js's for sources-stream and handoff:
// each keeps per-session state in a module-local Map, and a second copy at a
// different URL would keep its own.

import { navigate } from "./router.js?v=1033";
import { setHandoff } from "./handoff.js?v=1033";
import { addReadySource } from "./sources-stream.js?v=1033";
import { getTopicById, topicTitle, markUsed } from "./topics-store.js?v=1033";
import { getFeedById } from "./topic-feeds-store.js?v=1033";
import { findTopicSource } from "./topics-catalog.js?v=1033";

export const TOPIC_CHAT_HANDOFF = "pendingTopicChat";

/**
 * Mark the Topic Used and open a new chat with it attached.
 * @returns {boolean} false when the Topic is unknown, so a caller can bail
 *   without navigating — a link to a Topic that no longer exists goes nowhere.
 */
export function useTopicInChat(topicId) {
  const topic = getTopicById(topicId);
  if (!topic) return false;

  markUsed(topic.id);
  setHandoff(TOPIC_CHAT_HANDOFF, { topicId: topic.id });

  // The Playbook and the chat's name ride in the URL rather than in the handoff:
  // session.js already resolves `?contextId=` and `?title=` when it mints a
  // `new-*` session, so the chat is bound and named on its very first paint
  // instead of being renamed a frame later.
  const feed = getFeedById(topic.feedId);
  const params = new URLSearchParams();
  if (feed?.playbookId) params.set("contextId", feed.playbookId);
  params.set("title", topicTitle(topic));
  navigate(`/session/new-${Date.now().toString(36)}?${params.toString()}`);
  return true;
}

/**
 * Consumed at session mount. Attaches the Topic as an already-processed source;
 * intake-lifecycle turns that into the source-intake card in the thread.
 *
 * Deduped on the Topic id inside addReadySource, so re-entering the same chat
 * cannot double it up.
 */
export function attachTopicToChat(sessionId, topicId) {
  const topic = getTopicById(topicId);
  if (!topic) return;
  const source = findTopicSource(topic.sourceId);
  addReadySource(sessionId, {
    id: topic.id,
    filename: topicTitle(topic),
    kind: "Topic",
    preview: topic.summary,
    iconClass: source?.icon || "ap-icon-antenna",
  });
}
