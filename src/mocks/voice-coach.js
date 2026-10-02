// Voice coaching (flag networkVoices) — the proposals Archie has pending on a
// Playbook's network voices, as if noticed in earlier chats. Read by
// voice-coach-store.js; they are NOT part of the Playbook until accepted.

export const voiceSuggestionsByContext = {
  "ctx-acme": [
    {
      id: "vs-seed-1",
      network: "linkedin",
      text: "Keep the opening line under 12 words.",
      why: "You shortened the hook on 3 of your last 4 LinkedIn drafts.",
      source: "edits",
    },
    {
      id: "vs-seed-2",
      network: "instagram",
      text: "Write the caption for someone who hasn't heard of Acme — no product names in the first line.",
      why: "You marked two Instagram drafts as Too generic and rewrote their opening.",
      source: "feedback",
    },
    {
      id: "vs-seed-3",
      network: "x",
      text: "No hashtags on X.",
      why: "You removed every hashtag from your last X drafts.",
      source: "edits",
    },
  ],
};
