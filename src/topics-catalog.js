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
// ⚠️ TOPIC_KINDS is gone with the two tabs it labelled. `ready` needs no label
// now — a draftable Topic wears no chip and has no filter row, exactly like the
// `new` state — and `later`'s label lives in TOPIC_STATES with the other five.
/**
 * The kind a Topic sits in. UNCLASSIFIED FALLS TO `later`, on purpose:
 * "Ready to draft" would claim a readiness nothing earned. The fork's code did
 * the opposite of its own spec here (AC-SEG-6) and defaulted to ready.
 *
 * It used to decide which of two TABS a Topic appeared under. The tabs are gone —
 * `later` is one of the six states now — but the rule is unchanged: the scan
 * classifies, and nothing a reader does moves a Topic between kinds.
 */
export function kindOf(topic) {
  return topic && topic.kind === "ready" ? "ready" : "later";
}

// ── ONE vocabulary ─────────────────────────────────────────────────────────
// Six states, one level. This replaces three separate declarations — the two
// TOPIC_KINDS labels, REVIEW_STATUSES and ATTENTION_SIGNALS — which is what put
// the five things a reader thinks of as one list at three different levels of
// prominence: a DS pill for the signals, a bare icon for the triage states, and
// a whole tab for the kind. One pill species now, and one filter list.
//
// ⚠️ THE DATA MODEL DID NOT FLATTEN, and must not. `status` lives in the triage
// Map (the reader owns it), `isTrending` / `isUpdated` live on the Topic and are
// purged outside 7 days (the scan owns them), `kind` lives on the Topic. FOUR
// fields, still separate — which is exactly what lets a Topic be Already used
// AND Trending and show both. Collapsing them into one field would let a re-scan
// overwrite the reader's answer, which is the whole reason the triage Map exists,
// and would break the wire contract (AC-TRK-6) that reports the three
// independently. `facet` below is how each row knows which field to read.
//
//   facet: "status"  → compared against the triage status
//   facet: "kind"    → compared against kindOf(topic)
//   facet: "signal"  → an independent boolean on the Topic
//
// `tone` is the DS `.ap-status` variant, `icon` its glyph. Every state carries
// BOTH a word and a glyph, so colour is never the only signal (AC-X-4).
//
// `chip: false` on `new` is the one asymmetry, and it is deliberate: it is the
// ABSENCE of an answer, the most common value in any feed, and a glyph meaning
// "nothing has happened yet" is the one thing a glyph cannot say. It would have
// spent a mark on nearly every row to convey nothing. It keeps its FILTER row —
// narrowing to the untouched ones is a real thing to want.
//
// `hint` is a sentence, never a restatement of the label: a tooltip reading
// "Used" over a chip labelled Used has told you nothing.
//
// ── The three tones that changed, and why ─────────────────────────────────
// `ignored` was `red`. The feature's own closed arbitration says the opposite —
// "Ignore is stroked grey and NOT red: ignoring hides a Topic that ticking
// Ignored brings straight back, so nothing is destroyed and red would flag a
// danger that is not there." The contradiction survived because nothing read the
// field; the card drew a bare neutral icon instead. Reading it makes it visible,
// so it gets fixed.
//
// `used` was `blue`, justified by a green "Ready-to-draft tag" whose fill would
// have collided. ⚠️ That tag does not exist — the only `.ap-tag` on any Topic
// surface is the grey "Coming soon" in the filter panel. The reason was stale, so
// green is free, and blue was the wrong colour anyway: blue is the colour of the
// INTERACTIVE in this app (card hover border, links), and a blue pill on a
// clickable card reads as a control. Green is validated / done, which is what
// Already used means.
//
// `later` takes the blue `used` vacated — info / neutral. Parked, not judged.
export const TOPIC_STATES = Object.freeze([
  {
    id: "new",
    // "To review", not "New". The id stays `new` — it is data, written on every
    // seeded Topic and carried in the filter state — and renaming data to change
    // a word buys nothing a reader can see.
    //
    // The word changed because "New" describes the TOPIC and the reader needs it
    // to describe THEIR relationship to it. Every Topic in a feed is new; they
    // all arrived on the same scan. "To review" is the one thing that separates
    // this state from the answers a reader gave. It also matches the in-chat
    // list, which has said "Fresh topics to review" all along.
    label: "To review",
    facet: "status",
    chip: false,
    defaultOn: true,
    hint: "Nothing done with it yet.",
  },
  {
    id: "trending",
    label: "Trending",
    facet: "signal",
    tone: "orange",
    icon: "ap-icon-arrow-up",
    chip: true,
    defaultOn: true,
    hint: "Running well above its own median right now.",
  },
  {
    id: "updated",
    label: "Updated",
    facet: "signal",
    // Warm, adjacent to Trending and deliberately the quieter of the two.
    tone: "tagOrange",
    icon: "ap-icon-refresh",
    chip: true,
    defaultOn: true,
    hint: "Rewritten since you last saw it.",
  },
  {
    id: "used",
    label: "Already used",
    facet: "status",
    tone: "green",
    icon: "ap-icon-rounded-check",
    chip: true,
    defaultOn: true,
    hint: "Taken into a chat to draft a post.",
  },
  {
    id: "later",
    label: "For later",
    facet: "kind",
    tone: "blue",
    icon: "ap-icon-bookmark",
    chip: true,
    // OFF by default, which is what the "Ready to draft" tab did. Landing on a
    // list that mixes draftable Topics with ones the scan says are not draftable
    // yet would bury the reason to be here.
    defaultOn: false,
    hint: "A theme worth keeping — not enough around it to draft from yet.",
  },
  {
    id: "ignored",
    label: "Ignored",
    facet: "status",
    tone: "grey",
    icon: "ap-icon-eye-off",
    chip: true,
    // The one answer that means "not this one", so it is the one state left out
    // of the default. Already used stays IN: the work exists, it is findable, and
    // hiding it is how the same Topic gets drafted twice.
    defaultOn: false,
    hint: "Kept off this list, even if it starts trending or gets updated.",
  },
]);

export function findTopicState(id) {
  return TOPIC_STATES.find((s) => s.id === id) || null;
}

/** The ids a Topic can carry for one facet — the filter reads these. */
export function stateIdsForFacet(facet) {
  return TOPIC_STATES.filter((s) => s.facet === facet).map((s) => s.id);
}

// ── The filter's default ───────────────────────────────────────────────────
// Derived from `defaultOn` rather than written out again, so a state cannot be
// added to the vocabulary and forgotten in the default.
//
// The COUNT matters as much as the contents: narrowedGroupCount compares this
// array's length against the live filter, so the Filters badge reads nothing at
// rest and 1 the moment the reader changes the group.
export const DEFAULT_STATE_IDS = Object.freeze(TOPIC_STATES.filter((s) => s.defaultOn).map((s) => s.id));

/** Every declared state id — what a deep link widens to. */
export const ALL_STATE_IDS = Object.freeze(TOPIC_STATES.map((s) => s.id));

export function findTopicSource(id) {
  return TOPIC_SOURCES.find((s) => s.id === id) || null;
}

export function findCadence(id) {
  return CADENCES.find((c) => c.id === id) || null;
}

export function isLiveSource(id) {
  return LIVE_SOURCE_IDS.includes(id);
}
