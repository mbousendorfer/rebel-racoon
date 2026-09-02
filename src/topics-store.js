// Topics — what Archie found in a feed, plus what the reader did with it.
//
// GLOBAL and feed-keyed, like topic-feeds-store: a Topic arrives on a cadence
// and belongs to a feed, not to a chat.
//
// ── The one invariant this store exists to protect ─────────────────────────
// `status`, `isTrending`, `isUpdated` and `kind` are SEPARATE FIELDS and must stay
// that way. No signal is a fourth status; both are independent booleans. A Topic
// can be Already used AND trending, or Ignored AND updated, or several at once.
// No code path may write a signal into `status`, and nothing a reader does may
// write `kind`.
//
// ⚠️ The six STATES a reader sees are one flat vocabulary (topics-catalog's
// TOPIC_STATES) derived from those four fields by `topicStates()`. That is a
// presentation layer, not a merge: flattening the fields themselves would let a
// re-scan overwrite the reader's own answer — the exact thing the separate triage
// Map exists to prevent — and would break the wire contract that reports status,
// trending and updated independently (AC-TRK-6). One vocabulary, four fields.
//
// The consequences the views depend on:
//   • In the FEED, a trending Topic shows under its OWN status — a trending
//     to-review Topic appears only while "To review" is ticked and vanishes when
//     it isn't. Trending is not a feed-level override, because as an override it
//     made the status filter lie. This is why the filter is "untick to hide" and
//     not an OR over ticked rows; see matchesFilters.
//   • An IGNORED Topic is never surfaced by a signal, anywhere. Ignore means
//     ignore: ticking Ignored in the filter is the only way to see one. The
//     opposite rule — "a spike is never hidden by triage" — was tried and
//     dropped: it made Ignore a suggestion rather than an answer, and the one
//     thing a reader wants from "not this one" is that it stays gone.
//
// Triage lives in its OWN map rather than being written onto the Topic: a Topic
// is what the scan returned (server-owned), a triage row is what this user did
// with it (user-owned). Keeping them apart means a re-scan can replace Topics
// without clobbering triage.
//
// Public API:
//   getTopicsForFeed(feedId, filters?) → Topic[]  (newest first, filtered)
//   groupTopicsByAge(topics)           → [{group, topics}] in AGE_GROUPS order
//   countToReview(feedId)              → number   (the sidebar's unread mark)
//   countFresh(feedId)                 → number   (the in-chat list's M)
//   getFreshTopics(feedId)             → Topic[]  (the in-chat list, capped)
//   getTopicById(id)                   → Topic | null
//   topicTitle(topic)                  → string
//   topicStates(topic)                 → string[]  (the six-state vocabulary)
//   countAll(feedId)                   → number   (the list header's total)
//   defaultFilters() / narrowedGroupCount(filters)
//   getStatus(id) / getIgnoreReason(id)
//   markUsed(id) / ignoreTopic(id, reason) / unignoreTopic(id)
//   subscribe(fn)                      → unsubscribe

import { topics as seed } from "./mocks.js?v=1010";
import { isNewUser } from "./user-mode.js?v=1010";
import { createNotifier } from "./store-utils.js?v=1010";
import { DEFAULT_STATE_IDS, LIVE_SOURCE_IDS, TOPIC_STATES, findTopicState, kindOf } from "./topics-catalog.js?v=1010";

const topics = isNewUser() ? [] : seed.map(cloneTopic);

// topicId → { status, reason }. Seeded from the Topic's own `seedStatus` so the
// feed shows a realistic spread instead of thirty identical To-review rows.
//
// ⚠️ The seeded value is NORMALISED against the vocabulary. Two Topics shipped
// `seedStatus: "saved"`, which no state declares — so `matchesFilters` could never
// satisfy it and both were invisible in the feed under EVERY filter state, while
// `countFresh` still counted them (hence the in-chat "5 out of 6 shown" with an
// unreachable 6th). The failure was silent because an unknown id also renders no
// chip. An undeclared state must not be able to delete a Topic from the screen.
const triage = new Map();
for (const t of topics) {
  const seeded = findTopicState(t.seedStatus)?.facet === "status" ? t.seedStatus : "new";
  triage.set(t.id, { status: seeded, reason: t.seedReason || "" });
}

const notifier = createNotifier("topics-store");
export const subscribe = notifier.subscribe;
const notify = () => notifier.notify(null);

// The article and the evidence posts carry nested objects, so a shallow copy
// would hand out references into the mocks module and let a view mutate the seed.
function cloneTopic(t) {
  return {
    ...t,
    article: {
      ...(t.article || {}),
      subheads: Array.isArray(t.article?.subheads) ? t.article.subheads.slice() : [],
      paragraphs: Array.isArray(t.article?.paragraphs) ? t.article.paragraphs.slice() : [],
    },
    posts: Array.isArray(t.posts) ? t.posts.map((p) => ({ ...p, author: { ...(p.author || {}) } })) : [],
    isTrending: !!t.isTrending,
    isUpdated: !!t.isUpdated,
  };
}

// ── Age → sortable minutes ─────────────────────────────────────────────────
// Seeded Topics carry a relative label ("2d ago") rather than a timestamp,
// because a prototype has no clock worth trusting and authored dates rot as the
// file ages. Ascending minutes IS newest first.
//
// Replace this with real timestamps when the feed is wired to a backend — this
// parser is the seam, and nothing else reads `ageLabel`.
//
// `mo` FIRST: the alternation is ordered, so putting `m` first matches the "m"
// of "2mo" and leaves "o" to fail the \b — which is exactly what used to happen,
// sending every month label to MAX_SAFE_INTEGER as "unknown age".
const UNIT_MINUTES = { mo: 43200, w: 10080, d: 1440, h: 60, m: 1 };
const AGE_RE = /^\s*(\d+)\s*(mo|[wdhm])\b/i;
const DAY = 1440;

export function ageMinutes(label) {
  const m = AGE_RE.exec(String(label || ""));
  // Unparseable sorts LAST, not first: an unknown age is not a fresh one.
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * (UNIT_MINUTES[m[2].toLowerCase()] || 1);
}

// The age separators a Topic list draws between its cards.
//
// Defined HERE, next to the parser, and not in the view: the feed asks which
// bucket a Topic falls in, it does not get to decide what "7 days" means. Order
// is newest-first and every render relies on it. Boundaries are inclusive at the
// top, so "1w ago" is Last 7 days rather than falling into the next bucket on a
// technicality.
const AGE_GROUPS = Object.freeze([
  { id: "week", label: "Last 7 days", maxDays: 7 },
  { id: "month", label: "Earlier this month", maxDays: 30 },
  { id: "earlier", label: "Earlier", maxDays: Infinity },
]);

function ageGroupOf(topic) {
  const days = ageMinutes(topic && topic.ageLabel) / DAY;
  return AGE_GROUPS.find((g) => days <= g.maxDays) || AGE_GROUPS[AGE_GROUPS.length - 1];
}

// ── An attention signal only ever lives in Last 7 days ─────────────────────
// Trending and Updated are claims about RIGHT NOW — "this is running above its
// baseline", "the story just moved". A card carrying either under a
// three-weeks-ago separator contradicts itself, and it is the separator the
// reader believes. So the flags are cleared past the first age group rather than
// left to the seed to get right: age is the single source of truth, and a signal
// is a statement about age.
//
// Enforced here because every read goes through this function — the feed, the
// in-chat list, the picker and every count agree for free, and a future seed
// cannot reintroduce the contradiction.
function withTriage(t) {
  const row = triage.get(t.id) || { status: "new", reason: "" };
  const fresh = ageGroupOf(t).id === "week";
  return {
    ...t,
    kind: kindOf(t),
    status: row.status,
    ignoreReason: row.reason,
    // THE TRAIL IS TWO-SIDED, and merging it on read is what keeps the invariant
    // intact. What the scan recorded lives on the Topic (server-owned, replaced
    // wholesale by the next scan); what THIS reader did lives in the triage row
    // (user-owned). Writing the reader's entries onto the Topic would put them in
    // the path of the next scan, which is exactly what the separate Map exists to
    // prevent. Seeded first, so the trail reads oldest to newest.
    history: [...(t.history || []), ...(row.entries || [])],
    isTrending: !!t.isTrending && fresh,
    isUpdated: !!t.isUpdated && fresh,
  };
}

function byRecency(a, b) {
  return ageMinutes(a.ageLabel) - ageMinutes(b.ageLabel);
}

// The LIVE sources, not every declared one. Seven of the eight in
// topics-catalog.js are `live: false` — declared for the settings page, unable to
// produce a Topic — and the Filters panel only offers the live ones. This has to
// be the same set: "all sources" is what the panel can tick, so deriving it from
// all eight would leave the group permanently narrowed against a default it could
// never reach, and pin the Filters badge to 1.
const ALL_SOURCE_IDS = LIVE_SOURCE_IDS.slice();

/** The filter state a feed opens with. Reset restores exactly this. */
export function defaultFilters() {
  return { states: DEFAULT_STATE_IDS.slice(), sources: ALL_SOURCE_IDS.slice(), only: null };
}

// ── The one deriver: which of the six states a Topic carries ───────────────
// Read by the card (one chip per id) and by the filter (one row per id), so the
// two cannot disagree about what a Topic IS. Four fields in, one flat list out —
// which is the whole shape of this change: the presentation flattened, the data
// did not.
//
// Order follows TOPIC_STATES so a row of chips always reads in the same order,
// whatever combination a Topic happens to carry.
//
// Signals come from the ALREADY-PURGED object: withTriage cleared them outside
// the first age group before this ever sees them, so a Topic under an
// "Earlier this month" separator cannot claim to be trending.
export function topicStates(topic) {
  if (!topic) return [];
  return TOPIC_STATES.filter((st) => {
    if (st.facet === "status") return topic.status === st.id;
    if (st.facet === "kind") return kindOf(topic) === st.id;
    return st.id === "trending" ? !!topic.isTrending : !!topic.isUpdated;
  }).map((st) => st.id);
}

// How many of the two groups are narrowed below full breadth. The Filters badge
// counts GROUPS, not ticked options — "2" means two groups are filtering, which
// is what the reader needs to know. Counting options gave numbers like "5" that
// meant nothing.
//
// Compared against the DEFAULT, not against all options: the status default is
// two of three, so a full-breadth comparison would read "narrowed" the moment the
// panel opened and pin the badge to 1 forever. The badge means "you have changed
// something", and at rest it means nothing is changed.
//
// Length alone is enough, deliberately: any change to a group's selection changes
// its length UNLESS the reader swaps one option for another — still a deviation,
// but not one worth a second data structure to catch in a prototype.
//
// The kind used to be excluded here because the tab row above the list was a
// control you could see, and a control you can see needs no badge. The tabs are
// gone and `later` is a row in the state group like the rest, so it is counted by
// the same comparison as everything else.
export function narrowedGroupCount(filters = defaultFilters()) {
  let n = 0;
  if (filters.only) n++;
  else if ((filters.states || []).length !== DEFAULT_STATE_IDS.length) n++;
  if ((filters.sources || []).length !== ALL_SOURCE_IDS.length) n++;
  return n;
}

// The one filter predicate. Factored out so the list and any "what is the filter
// hiding?" count can never disagree about what hidden means.
//
// ── One semantics, on every row: UNTICK A STATE TO HIDE WHAT CARRIES IT ────
// A Topic shows only when EVERY state it carries is ticked. That is what lets six
// rows behave identically while the four underlying fields stay separate.
//
// ⚠️ NOT an OR over ticked rows, and this is the load-bearing part. Under an OR,
// an *ignored + trending* Topic would reappear the moment Trending was ticked —
// which is the "Trending, normally hidden" group this feature explicitly rejected
// (AC-PICK-2b: "Decided: no.") and a direct breach of the store's own rule that an
// ignored Topic is never surfaced by a signal, anywhere. The rule was not up for
// revision, so the semantics follows from it rather than being a taste call.
//
// What it costs, plainly: a state can be HIDDEN but not ISOLATED — there is no
// "show me only what is spiking". That would be a sort or a separate chip row,
// not this list.
// ── And ONE positive operator: `only` ─────────────────────────────────────
// ⚠️ "Only X" CANNOT be expressed as a tick pattern, which is why it gets its own
// field. Untick-to-hide can only ever hide Topics that CARRY a label, and a `later`
// Topic always also carries a triage status — so ticking `later` alone hides every
// Topic including the `later` ones, and `ready` has no label at all, so nothing can
// hide it. Shipping "Only" as `states = [X]` returned an empty list.
//
// So `only` is a REQUIREMENT: show the Topics carrying X, ignore the ticks. It does
// not weaken the ignored rule — "Only Ignored" is the reader explicitly asking for
// ignored Topics, which is what ticking Ignored does, just in one click. A signal
// never surfaces an ignored Topic on its own; the reader has to name it.
function matchesFilters(t, filters) {
  const { states = [], sources = [], only = null } = filters;
  if (!sources.includes(t.sourceId)) return false;
  if (only) return topicStates(t).includes(only);
  return topicStates(t).every((id) => states.includes(id));
}

/**
 * A feed's Topics, newest first, with triage merged in.
 * `filters` omitted → unfiltered, which is what the picker and every count want.
 */
export function getTopicsForFeed(feedId, filters = null) {
  return topics
    .filter((t) => t.feedId === feedId)
    .map(withTriage)
    .filter((t) => !filters || matchesFilters(t, filters))
    .sort(byRecency);
}

/** A feed's Topics split into AGE_GROUPS order, empty groups dropped. */
export function groupTopicsByAge(list) {
  return AGE_GROUPS.map((g) => ({ group: g, topics: list.filter((t) => ageGroupOf(t).id === g.id) })).filter(
    (row) => row.topics.length,
  );
}

/** The header's first number: everything the feed holds, before filters. */
export function countAll(feedId) {
  return topics.filter((t) => t.feedId === feedId).length;
}

// ── The sidebar's unread mark ──────────────────────────────────────────────
// Topics still waiting for an answer AND draftable. The `kind` half is new: this
// counted every `new` Topic, including the `later` ones parked behind the second
// tab, so the badge read 9 on a feed where a click showed 4. With the tabs gone
// and For later off by default, a badge that does not count what a click shows is
// a badge that lies.
export function countToReview(feedId) {
  return topics.filter((t) => t.feedId === feedId && getStatus(t.id) === "new" && kindOf(t) === "ready").length;
}

// ── The in-chat list ───────────────────────────────────────────────────────
// Six, because eight filled the section past the point where the eye takes it in
// as one group, and the closing row is a better answer than a longer scroll.
const FRESH_MAX = 6;
/** Age cut for "fresh": the same 7 days the feed's first age group uses. */
const FRESH_DAYS = 7;
const isFresh = (t) => ageMinutes(t.ageLabel) <= FRESH_DAYS * DAY;

/**
 * Every Topic in this feed under a week old, WHATEVER its status. The
 * denominator of the in-chat list's "N out of M shown": M is what is fresh, not
 * what is untriaged, so the number does not drop as the reader works through the
 * list — it describes the week, not a to-do list. Counting every status is also
 * what keeps M ≥ N, since the list only draws the fresh to-review ones.
 */
export function countFresh(feedId) {
  return topics.filter((t) => t.feedId === feedId && isFresh(t)).length;
}

/**
 * Up to six Topics for the in-chat list, in the order they are shown: the
 * newest trending one, then the newest updated one, then the newest of the rest.
 *
 * The order is the point — the top row has to be the one most worth acting on.
 * Used and Ignored are excluded: both mean the reader has already answered.
 * Older-than-a-week is excluded too, or "Fresh topics to review" would be false.
 */
export function getFreshTopics(feedId) {
  const all = topics
    .filter((t) => t.feedId === feedId)
    .map(withTriage)
    .filter((t) => t.status === "new" && isFresh(t));
  const trending = all.filter((t) => t.isTrending).sort(byRecency)[0] || null;
  const updated = all.filter((t) => t.isUpdated && t !== trending).sort(byRecency)[0] || null;
  const picked = [trending, updated].filter(Boolean);
  const rest = all
    .filter((t) => t !== trending && t !== updated)
    .sort(byRecency)
    .slice(0, FRESH_MAX - picked.length);
  return [...picked, ...rest].slice(0, FRESH_MAX);
}

export function getTopicById(id) {
  const t = topics.find((x) => x.id === id);
  return t ? withTriage(t) : null;
}

/**
 * THE title of a Topic, for every surface that shows one.
 *
 * A Topic carries two: `headline`, written when the scan grouped the posts, and
 * `article.title`, written when Archie wrote the article. They were different
 * sentences about the same topic, so a card said one thing and the article you
 * opened from it said another — the card read as a summary of something else.
 *
 * The article's is the one that survives: it is the claim the Topic actually
 * makes, and it is what the reader is deciding on. `headline` stays in the data
 * as the fallback for a Topic whose article has not been written.
 */
export function topicTitle(topic) {
  return topic?.article?.title || topic?.headline || "";
}

function getStatus(topicId) {
  return (triage.get(topicId) || {}).status || "new";
}

function getIgnoreReason(topicId) {
  return (triage.get(topicId) || {}).reason || "";
}

/**
 * Use in chat marks the Topic Used. Its own function rather than a generic
 * setStatus, because Used is the only status any surface sets directly and the
 * mark has to land BEFORE the chat opens.
 */
export function markUsed(topicId) {
  const t = topics.find((x) => x.id === topicId);
  if (!t) return null;
  const prev = triage.get(topicId) || { reason: "" };
  triage.set(topicId, {
    ...prev,
    status: "used",
    entries: [...(prev.entries || []), { status: "used", when: "just now", note: "Used in a chat as a source." }],
  });
  notify();
  return withTriage(t);
}

export function ignoreTopic(topicId, reason = "") {
  const t = topics.find((x) => x.id === topicId);
  if (!t) return null;
  const why = String(reason || "").trim();
  const prev = triage.get(topicId) || {};
  triage.set(topicId, {
    status: "ignored",
    reason: why,
    entries: [
      ...(prev.entries || []),
      { status: "ignored", when: "just now", note: why ? `Ignored — ${why}` : "Ignored, without a reason given." },
    ],
  });
  notify();
  return withTriage(t);
}

// The way back. Its own function rather than a generic setter because it has to
// CLEAR the reason as well — the sentence the reader typed would otherwise
// survive on a Topic that is no longer ignored: invisible while it sits there,
// and wrong the moment anything reads it.
//
// Back to `new`, not to whatever the status was before. The two states an ignore
// can be undone FROM are `new` (nothing had happened) and `used` (the Topic went
// into a chat), and restoring `used` would put finished work back on a list of
// things to do. Un-ignore means "put it back in the queue", which is `new`.
export function unignoreTopic(topicId) {
  const t = topics.find((x) => x.id === topicId);
  if (!t) return null;
  // Wipes `entries` for the same reason it wipes `reason`: this is the path the
  // toast's Undo takes, and an undo that leaves its own footprint in the trail
  // has not undone anything. The Topic's seeded history is untouched — that half
  // is the scan's, not the reader's.
  triage.set(topicId, { status: "new", reason: "", entries: [] });
  notify();
  return withTriage(t);
}
