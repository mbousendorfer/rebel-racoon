// Chat sessions — the sidebar's list, and the demo conversations.
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.

// Source counts, idea counts and draft counts are NOT declared here: they are
// derived at render time from sources/, ideas/ and posts/, which own the
// per-session data.
export const recentSessions = [
  {
    id: "s-acme-launch",
    name: "Q2 launch announcement",
    lastActivity: "2 hours ago",
    contextId: "ctx-acme",
    pinned: true,
  },
  {
    id: "s-riverside",
    name: "Riverside customer story → 5 posts",
    lastActivity: "Yesterday",
    contextId: "ctx-customer",
    pinned: false,
  },
  {
    id: "s-state-of-social",
    name: "State of Social → thought leadership",
    lastActivity: "2 days ago",
    contextId: "ctx-founder-voice",
    pinned: false,
  },
  {
    id: "s-weekly-recap",
    name: "Weekly engagement recap",
    lastActivity: "5 days ago",
    contextId: "ctx-acme",
    pinned: false,
  },
];

// The chat that lost its Playbook — appended by sessions-store only when the
// `playbookSharing` flag is on, for the same reason as sharedContexts. Its
// drafts and thread live in postsBySession / threadsBySession regardless; an
// entry keyed by a session that doesn't exist is simply never read.
export const sharedSessions = [
  // The degraded chat: its Playbook (ctx-orphan-brightline) belongs to Jonas and
  // is no longer shared, so this conversation can't generate anything new — only
  // save or schedule the two drafts it already produced. Behind the
  // `playbookSharing` flag this reads as a normal chat.
  {
    id: "s-brightline",
    name: "Brightline launch → 2 posts",
    lastActivity: "a week ago",
    contextId: "ctx-orphan-brightline",
    pinned: false,
  },
];

// Every seeded chat, flag or no flag. Stores that ask "is this one of the demo
// conversations, so should I seed its sources / ideas / drafts?" read THIS, not
// recentSessions: an entry for a session that doesn't exist is simply never
// looked up, whereas a missing one leaves a real chat with empty panels.
export const allSeedSessions = [...recentSessions, ...sharedSessions];

// Empty-state Chat starter cards — the workflow prompts shown when a
// conversation has no user message yet. Surfaced as the big card grid under
// the composer in the empty-chat hero (renderEmptyHero in screens/session.js).
// Each card maps to a REAL Archie capability and is one of three kinds:
//   • `prompt`     — clicking pre-fills the composer with an editable prompt.
//                    The `{{source}}` / `{{video-source}}` placeholders are
//                    resolved at render time to the first attached (video)
//                    source filename, or the literal "your source" / "your
//                    video" for first-run users.
//   • `action`     — clicking launches a guided flow instead of injecting text.
//                    Handled in session.js's starter click delegation:
//                      - "open-batch"       → Batch Studio source-intake screen
//                      - "open-video-clips" → scripted video intake + clip flow
//   • `comingSoon` — a teaser card rendered non-interactive with a "Coming
//                    soon" badge. No prompt/action fires on click.
//
// `subtitle` + `cta` drive the visible card copy; `prompt` is still carried on
// the element (data-starter-prompt) so prompt-kind cards inject clean text.
export const chatStarters = [
  {
    id: "starter-batch",
    icon: "ap-icon-archie-official",
    tone: "mermaid",
    title: "Batch from a source",
    subtitle: "Pull the strongest ideas and draft a set of posts across your networks.",
    cta: "Start drafting",
    // Opens the dedicated Batch Studio intake (upload 1+ sources + pick a
    // Playbook → new chat). See renderBatchStudio in screens/session.js.
    action: "open-batch",
  },
  {
    id: "starter-video-clips",
    icon: "ap-icon-video",
    tone: "purple",
    title: "Extract video clips",
    subtitle: "Find the best moments in a video and cut them into posts.",
    cta: "Clip a video",
    prompt:
      "Surface the best ideas from {{video-source}} and turn them into posts across LinkedIn, X, Instagram, and TikTok.",
    // `action` switches the starter from text-injection to a direct
    // dispatch in renderEmptyHero's click handler. See session.js.
    action: "open-video-clips",
  },
  {
    id: "starter-top-posts",
    icon: "ap-icon-feature-analytics",
    tone: "green",
    title: "Use top performing posts",
    subtitle: "Draw on your best-performing posts and turn what works into fresh drafts.",
    cta: "Reuse a winner",
    // Launches the in-chat "milk a top post" flow (top-posts-flow.js) via the
    // starter click delegation in session.js — same direct-action pattern as
    // "open-batch" / "open-video-clips". No prompt injection.
    action: "open-top-posts",
  },
];
