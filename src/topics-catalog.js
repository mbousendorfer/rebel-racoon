// The listening sources a Topic Feed watches, and the vocabulary every Topic
// surface reads from.
//
// CONFIG, not content: it ships with the app and must exist in `new-alt` mode
// too — a brand-new user still sees all eight source cards on the settings page.
// The Topics those sources produce are content and live in mocks.js, empty for a
// new user. Same split as ff-catalog.js (config) vs mocks.js (data).
//
// `accent` is a SEMANTIC KEY, never a hex — the view maps it to
// `.topic-badge--<accent>`, which resolves DS colour tokens.
//
// `live` — false means the source is not built yet. Toggling it opens the
// feedback modal and leaves the switch alone, rather than pretending it works.
// Only competitor-posts is live, and that is load-bearing: the feed's default
// source filter is derived from LIVE_SOURCE_IDS, so a Topic seeded on a
// non-live source would be filtered out of its own feed on first paint.
//
// `playbookAnchor` — never an id — says which Playbook section a source reads,
// so a card can offer "Review the Playbook's competitors" without hardcoding a
// source id. null = Agorapulse listening feeds it directly and the Playbook has
// nothing to do with it.
//
// `howItWorks` is plain informative prose. It began life as a greyed-out
// read-only textarea on the fork; that read as a broken input, so it is text. Do
// not reintroduce a disabled input here.
//
// ── The register is NEUTRAL, and deliberately not Archie's first person ─────
// Archie speaks as "I" everywhere he is TALKING to you: the thread, the toasts,
// the empty states. This is settings copy, and settings copy explains what the
// system does when nobody is watching. In the first person the same sentences
// read as promises made in conversation ("I only raise a theme once ten people
// have voiced it"), which is the wrong register for a switch you set once and
// leave running for months. So: "every post is read", not "I read every post".

export const TOPIC_SOURCES = Object.freeze([
  {
    id: "competitor-posts",
    name: "Competitors",
    icon: "ap-icon-megaphone",
    accent: "purple",
    live: true,
    playbookAnchor: "competitors",
    defaultEnabled: true,
    howItWorks:
      "Every post your listed competitors publish is read and ranked by how far " +
      "it beat that account's own median engagement, keeping the ones that " +
      "actually outperformed. You get the format, the hook and the angle — plus " +
      "where your own strengths let you answer it differently.",
  },
  {
    id: "influencer-posts",
    name: "Influencers",
    icon: "ap-icon-star",
    accent: "red",
    live: false,
    // null, not "competitors". The fork pointed this at the Playbook's
    // Influencers section; this repo's Playbook has no such section, and sending
    // a reader to Competitors would have the card claim it reads your
    // competitors, which is not what this source does.
    playbookAnchor: null,
    defaultEnabled: true,
    howItWorks:
      "The creators your audience already listens to are followed, and what lands " +
      "for them is tracked: the formats, the partnerships, the recurring themes. " +
      "You get collaboration angles and creative that has already proved itself " +
      "with the people you're trying to reach.",
  },
  {
    id: "brand-website",
    name: "Brand website",
    // NOT one of the web* glyphs. ap-icon-web / web-blogs / web-news are filled
    // multi-tone marks that ignore currentColor, so they render as a dark navy
    // blob inside the tinted badge while every sibling here is a line icon in
    // its accent colour. (ap-icon-web on global-trends below has the same
    // problem — inherited, not fixed here.) ap-icon-link takes the tint and says
    // "a URL", which is what this source is.
    icon: "ap-icon-link",
    accent: "soft-blue",
    live: false,
    playbookAnchor: null,
    defaultEnabled: true,
    // The one source whose subject is a VALUE the feed already holds, so its
    // card shows that value instead of only a description. A flag rather than an
    // id check, so a second value-carrying source would not need the renderer
    // touched again.
    showsWebsites: true,
    howItWorks:
      "Your website is scanned regularly for content worth leveraging — new blog " +
      "posts, product launches, customer success stories — and what turns up " +
      "becomes topics you can post.",
  },
  {
    id: "brand-feedback",
    name: "Brand feedbacks",
    icon: "ap-icon-double-chat-bubbles",
    accent: "menthol",
    live: false,
    playbookAnchor: null,
    defaultEnabled: false,
    howItWorks:
      "What people say to and about you — comments, DMs, reviews — is read for " +
      "the pain points and requests that keep coming back. A theme is only raised " +
      "once ten or more people have voiced it, and it is tied to a real complaint " +
      "so you can answer something specific.",
  },
  {
    id: "competitor-monitoring",
    name: "Competitor monitoring",
    icon: "ap-icon-antenna",
    accent: "electric-blue",
    live: false,
    playbookAnchor: "competitors",
    defaultEnabled: false,
    howItWorks:
      "The complaints and unmet asks piling up under your competitors' posts are " +
      "watched, and the openings are flagged where a strength of yours answers a " +
      "need they're leaving on the table.",
  },
  {
    id: "industry-trends",
    name: "Industry trends",
    icon: "ap-icon-line-graph",
    accent: "green",
    live: false,
    playbookAnchor: null,
    defaultEnabled: false,
    howItWorks:
      "Conversations gaining momentum in your industry are followed, surfacing " +
      "the ones that genuinely grew over the last 30 days — not the ones that " +
      "were always loud.",
  },
  {
    id: "global-trends",
    name: "Global trends",
    icon: "ap-icon-web",
    accent: "orange",
    live: false,
    playbookAnchor: null,
    defaultEnabled: false,
    howItWorks:
      "Cultural, seasonal and news moments that touch your brand are scanned for " +
      "the timely angles with wide reach and low risk of landing badly.",
  },
  {
    id: "internal-ideas",
    name: "Internal team ideas",
    icon: "ap-icon-folder",
    accent: "soft-blue",
    live: false,
    playbookAnchor: null,
    defaultEnabled: false,
    // The only source that reads your own tools rather than social listening,
    // which is why it is the one card that lists connected MCP tools.
    tools: Object.freeze([
      { id: "notion", name: "Notion" },
      { id: "intercom", name: "Intercom" },
      { id: "gdrive", name: "Google Drive" },
    ]),
    howItWorks:
      "The docs and threads your team already writes — roadmaps, support notes, " +
      "launch briefs — are read for the things worth saying publicly that nobody " +
      "got round to posting.",
  },
]);

/** The source ids switched on by default on a feed nobody has configured. */
export const DEFAULT_ENABLED_IDS = Object.freeze(TOPIC_SOURCES.filter((s) => s.defaultEnabled).map((s) => s.id));

/** Only these can actually be toggled; the rest open the feedback modal. */
export const LIVE_SOURCE_IDS = Object.freeze(TOPIC_SOURCES.filter((s) => s.live).map((s) => s.id));

// Refresh cadences. Drives COPY, never a timer — a weekly tick would never fire
// inside a demo session, so the recurring feel has to come from the data.
export const CADENCES = Object.freeze([
  { id: "weekly", label: "Weekly", adverb: "weekly", every: "week" },
  { id: "monthly", label: "Monthly", adverb: "monthly", every: "month" },
  { id: "quarterly", label: "Quarterly", adverb: "quarterly", every: "quarter" },
]);

export const DEFAULT_CADENCE = "weekly";

// ── The two kinds, which ARE the two tabs ─────────────────────────────────
// A Topic is either something you can draft now or something worth keeping for
// later, and that single axis is the tab row above the list. One
// vocabulary, not two: the fork carried a `researchType` of `ready-to-post` /
// `content-strategy` and mapped it onto segment ids `ready` / `later` at render
// time — a mapping layer whose only job was to translate an old name.
//
// Worse, its segment predicate also read a CONTENT PILLAR: a `content-strategy`
// Topic already linked to a pillar counted as ready-to-draft. Pillars are not
// part of this port, so that clause is gone and the rule is the flat one it
// always wanted to be — the scan's classification decides the segment, and
// nothing else moves a Topic between them.
export const TOPIC_KINDS = Object.freeze([
  { id: "ready", label: "Ready to draft" },
  { id: "later", label: "Topics for later" },
]);

/**
 * The segment a Topic sits in. UNCLASSIFIED FALLS TO `later`, on purpose:
 * "Ready to draft" would claim a readiness nothing earned. The fork's code did
 * the opposite of its own spec here (AC-SEG-6) and defaulted to ready.
 */
export function kindOf(topic) {
  return topic && topic.kind === "ready" ? "ready" : "later";
}

export const DEFAULT_KIND = "ready";

// ── Review statuses ────────────────────────────────────────────────────────
// `id` is what triage stores; `label` is what a reader sees.
//
// Trending and Updated are deliberately ABSENT: they are independent booleans on
// the Topic, not a fourth and fifth status. A Topic can be Ignored AND trending,
// so the two can never share one field — that is the invariant the whole feature
// rests on, and topics-store is where it is enforced.
//
// THREE statuses, and only two carry an icon. `new` has none because it is the
// ABSENCE of a marker: the other two record something the reader DID — used it,
// ignored it — while this one records that they have not, and a glyph meaning
// "nothing has happened" is the one thing a glyph cannot say. It was also the
// most common value in a feed, so it spent a marker on almost every row to
// convey nothing, competing with Trending and Updated — the two marks in that
// row a reader genuinely cannot know without being told.
//
// `icon` and `hint` live HERE rather than in the card because the Filters panel
// shows the same pair, and two copies of "which icon means used" would drift the
// first time one changed. Both are OUTLINE glyphs: the filled variants exist and
// either would read as "more applied" on its own, but mixed weights in one set
// make the set look like two sets.
//
// `hint` is a sentence, not a restatement of the label — a tooltip that says
// "Used" over an icon labelled Used has told you nothing.
//
// `statusColor` is the DS .ap-status variant, and it lives here for the same
// reason. The three map 1:1 onto the DS's own variants, so nothing here invents
// a colour. Used is BLUE, not green: green is taken by the Ready-to-draft tag
// and .ap-tag green computes the identical fill, so two chips in one row would
// share a colour meaning different things. The DS house rule also gives Status
// blue as "info / neutral" — and Used records that the Topic went somewhere, not
// that it went well, which is what green would claim.
export const REVIEW_STATUSES = Object.freeze([
  {
    id: "new",
    // "To review", not "New". The id stays `new` — it is data, written on every
    // seeded Topic and carried in the filter state — and renaming data to change
    // a word buys nothing a reader can see.
    //
    // The word changed because "New" describes the TOPIC and the reader needs it
    // to describe THEIR relationship to it. Every Topic in a feed is new; they
    // all arrived on the same scan. "To review" is the one thing that separates
    // this state from Used and Ignored: those two are answers the reader gave,
    // and this is the one still waiting for one. It also matches the in-chat
    // list, which has said "Fresh topics to review" all along.
    label: "To review",
    statusColor: "grey",
  },
  {
    id: "used",
    label: "Used",
    statusColor: "blue",
    icon: "ap-icon-rounded-check",
    hint: "Taken into a chat to draft a post.",
  },
  {
    id: "ignored",
    label: "Ignored",
    statusColor: "red",
    icon: "ap-icon-eye-off",
    hint: "Kept off this list, even if it starts trending or gets updated.",
  },
]);

// ── Filter default: To review + Used ───────────────────────────────────────
// Ignored is the one left out, and it is the only one that earns being left out.
// "Used" is a Topic you took into a chat: the work exists, it is findable, and
// hiding it makes the feed forget what you did with it — which is also how you
// end up drafting the same Topic twice. "Ignored" is the one answer that means
// "not this one", so showing it by default would put work the reader actively
// pushed away in front of someone looking for what to do next.
//
// The COUNT matters as much as the contents: narrowedGroupCount compares this
// array's length against the live filter, so the Filters badge reads nothing at
// rest and 1 the moment the reader changes the group. Adding an id here without
// that being true would pin the badge on permanently.
export const DEFAULT_STATUS_IDS = Object.freeze(["new", "used"]);

export function findTopicSource(id) {
  return TOPIC_SOURCES.find((s) => s.id === id) || null;
}

export function findCadence(id) {
  return CADENCES.find((c) => c.id === id) || null;
}

export function findTopicKind(id) {
  return TOPIC_KINDS.find((k) => k.id === id) || null;
}

export function findReviewStatus(id) {
  return REVIEW_STATUSES.find((s) => s.id === id) || null;
}

export function isLiveSource(id) {
  return LIVE_SOURCE_IDS.includes(id);
}

// ── The two attention signals ──────────────────────────────────────────────
// Not statuses, and never rendered as one. Colour, against the DS Status
// palette: Trending takes `orange` — the same Archie orange the card's mark
// uses, so the two read as one signal — and Updated takes `tagOrange`, warm,
// adjacent to Trending and quieter than it. Updated is the deliberately quieter
// of the two. Blue would be the closer semantic ("information"), but Used
// already owns blue, and two blues meaning different things in one row is the
// collision that put Used on blue rather than green in the first place.
export const ATTENTION_SIGNALS = Object.freeze([
  { id: "trending", label: "Trending", statusColor: "orange", icon: "ap-icon-arrow-up" },
  { id: "updated", label: "Updated", statusColor: "tagOrange", icon: "ap-icon-refresh" },
]);

export function findAttentionSignal(id) {
  return ATTENTION_SIGNALS.find((s) => s.id === id) || null;
}
