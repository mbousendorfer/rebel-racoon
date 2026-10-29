// What each object of the app IS, said once, to the user, in Archie's voice.
//
// The words a newcomer meets first — Playbook, Topic, Source, Idea… — are this
// product's own, so each page that hosts one says what it is (the sentence,
// visible), and every other place it appears carries a "?" with the same
// sentence (conceptHint, the DS tooltip on hover AND focus). One registry, so
// a definition can never say two different things on two screens.
// docs/copy/copy-principles.md § Concepts.

import { escapeAttr } from "./utils.js?v=2546";

export const CONCEPTS = {
  playbook: {
    name: "Playbook",
    text: "A Playbook is everything I know about one Brand: its business, audience, voice, and look. Each chat uses one, so every draft sounds like that Brand.",
  },
  chat: {
    name: "chat",
    text: "A chat is where we work on one piece of content together. Its sources, ideas, and drafts stay in it.",
  },
  topicFeed: {
    name: "Topic Feed",
    text: "The Topic Feed is where I bring what I spot in your competitors' and influencers' posts. Read a Topic, then use it in a chat or ignore it.",
  },
  topic: {
    name: "Topic",
    text: "A Topic is something I spotted in your listening, with my analysis and the posts behind it. Use it in a chat to draft from it.",
  },
  source: {
    name: "Source",
    text: "A Source is a file, link, video, or text you add to a chat. I read it and pull ideas from it.",
  },
  idea: {
    name: "Idea",
    text: "An Idea is a hook, stat, quote, story, or insight I pulled from your sources. Draft one to get a post.",
  },
  clip: {
    name: "Clip",
    text: "A Clip is a short moment I cut from one of your videos, with subtitles. Draft one to get a post.",
  },
  draft: {
    name: "Draft",
    text: "A Draft is a post I wrote in this chat, not published yet. Edit it, then schedule it or save it to Agorapulse.",
  },
  connector: {
    name: "Connector",
    text: "A Connector links a tool like Notion or Google Drive. I search it live during a chat, so nothing is imported.",
  },
  objective: {
    name: "objective",
    text: "An objective is a goal I track for you: a metric and a target. I tell you whether the posts I draft are moving it.",
  },
};

export const conceptText = (id) => CONCEPTS[id]?.text || "";

// The "?" beside a concept's name: focusable (tabindex) so the tooltip opens on
// keyboard focus too, and named for screen readers. Never inside a button —
// a focusable element in a control is a control inside a control.
export function conceptHint(id) {
  const c = CONCEPTS[id];
  if (!c) return "";
  const article = /^[aeiou]/i.test(c.name) ? "an" : "a";
  return `<i class="ap-icon-question concept-hint" tabindex="0" role="img" aria-label="${escapeAttr(
    `What's ${article} ${c.name}? ${c.text}`,
  )}" data-tooltip="${escapeAttr(c.text)}"></i>`;
}
