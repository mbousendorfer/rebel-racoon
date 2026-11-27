// Published-posts repurposing conversational flow orchestrator.
//
// Launched from the composer Add menu and the new-chat starter (session.js →
// startTopPostsInline). Runs inline in the current session's thread so it reads
// as one continuous conversation.
//
// Arc (mirrors the product spec "select one or more posts → adapt to each
// connected network → schedule"):
//   1. startTopPostsInline — ask the account, the period and the ranking, then
//                           post the winners widget in the thread.
//   2. echoRepurposePicks — echo the picked post(s). session.js then drives the
//                           profile quick-picker (inline-question), the same
//                           numbered Quickpicker the draft flow uses; the data
//                           helper here (repurposeProfileItems) feeds it. The
//                           profile step is a single per-profile version stepper
//                           listing every connected profile — source-network
//                           profiles lead, tagged "· Source" and pre-set to 1
//                           version.
//   3. executeRepurpose   — thinking chip → one adapted draft per
//                           post × target profile × version → post a result turn.

import {
  postAssistantMessage,
  startPending,
  finishPending,
  postDraftResult,
  postTopPostPickTurn,
  postTopPostsWidget,
  postUserTurn,
  postUserProfilesTurn,
  reportDraftFailure,
} from "./assistant.js?v=2984";
import { getTopPosts, getTopPost } from "./top-posts-store.js?v=2984";
import { addPostDraft } from "./posts-store.js?v=2984";
import { addReadySource } from "./sources-stream.js?v=2984";
import {
  getConnectedProfiles,
  BRAND_INITIALS,
  NETWORK_ICON_BY_PLATFORM,
  PROFILE_SEARCH_THRESHOLD,
  networkLabel,
  networkMeta,
  normalizeNetwork,
  getConnectedProfileById,
} from "./social-profiles.js?v=2984";
import { requireConnectedProfiles } from "./connect-profiles-flow.js?v=2984";
import { requireNetworkVoices } from "./network-voice-flow.js?v=2984";
import { withPendingChip } from "./draft-flow.js?v=2984";
import { SORTS, PERIODS } from "./components/top-post-card.js?v=2984";
import * as inlineQuestion from "./inline-question.js?v=2984";
import { playbookForNewWork } from "./active-playbook.js?v=2984";

// Cap on drafts produced in one run — post × angle × channel can multiply fast
// (e.g. 3 posts × 4 angles × 3 channels = 36). Keep the result turn scannable;
// the title flags when the set was clipped.
const MAX_DRAFTS = 10;

// Simulated "loading this profile's top posts" beat before the winners widget.
const PROFILE_LOAD_MS = 1800;

// The base body a winner is repurposed from — its own published copy. Repurposing
// keeps the post's message intact and adapts it per target network (below); it no
// longer re-angles the content. Run through adaptForNetwork per target channel.
function plainCopy(post) {
  return [post.excerpt];
}

// Adapt a base body to a target network's format + character constraints — the
// spec's "adapt the output to each connected network". Light, deterministic
// transforms (this is a prototype): X/Threads compress to a single punchy
// sub-280-char take; the long-form networks keep the full paragraph body.
function adaptForNetwork(textArr, network) {
  const net = (network || "").toLowerCase();
  const paras = Array.isArray(textArr) ? textArr : [textArr];
  if (net === "x" || net === "twitter") {
    // Grow from the hook, adding whole paragraphs while they fit, then clip on a
    // word boundary so the tweet never cuts mid-word.
    let out = (paras[0] || "").trim();
    for (let i = 1; i < paras.length; i += 1) {
      const next = `${out} ${paras[i].trim()}`;
      if (next.length <= 270) out = next;
      else break;
    }
    if (out.length > 280) out = `${out.slice(0, 269).replace(/\s+\S*$/, "")}…`;
    return [out];
  }
  // LinkedIn / Facebook / Instagram keep the full body (Instagram's hashtags are
  // trimmed by adaptHashtags, not here).
  return paras;
}

// Trim the source post's hashtags to what each network wears well — X stays
// terse (≤2), everyone else keeps the set.
function adaptHashtags(tags, network) {
  const net = (network || "").toLowerCase();
  const list = tags || [];
  if (net === "x" || net === "twitter") return list.slice(0, 2);
  return list;
}

// First sentence of a blob, used by the source label + the X adapter.
function firstSentence(text) {
  const m = (text || "").match(/[^.!?]*[.!?]/);
  return (m ? m[0] : text || "").trim();
}

// Provenance stamped onto every repurposed draft so the Drafts panel always
// shows where a post came from (the flow's core promise: capitalise on what
// worked). Rendered as the collapsible "Generation context" panel by
// post-card.js — a headline (the winner it was repurposed from) + the source
// post's own copy.
function repurposeContext(post) {
  const meta = networkMeta(post.network) || {};
  return {
    kind: "repurpose",
    headline: {
      icon: "ap-icon-shuffle",
      text: `Repurposed from your top ${networkLabel(post.network)} post · ${post.perfBadge}`,
    },
    source: {
      icon: meta.icon || "ap-icon-file--text",
      label: `Your top ${networkLabel(post.network)} post`,
      detail: post.excerpt,
    },
  };
}

// The Playbook governing the voice of the repurposed drafts, set when the flow
// starts and read by executeRepurpose.
const repurposeContexts = new Map(); // sessionId → contextId | null

// Connected social profiles offered on the account picker (step 1). This is what
// the user picks first — the spec's "select a social profile in the first place".
// Shaped as renderPicker items (value / label / caption / avatar) so step 1
// reuses the app's numbered Quickpicker rather than a bespoke card grid. `value`
// is the ACCOUNT id — unique even when several connected accounts share a network
// (the many-profiles case), so each row highlights + echoes independently; the
// picker's onPick resolves it back to an account + network. `search` folds in the
// brand name so a name query matches an @handle row. No winner count: it isn't
// known until the chosen profile's posts load.
function getProfileChoices() {
  return getConnectedProfiles().map((a) => {
    const net = normalizeNetwork(a.platform);
    return {
      value: a.id,
      network: net,
      accountId: a.id,
      label: a.handle,
      caption: [a.platformLabel, a.kind].filter(Boolean).join(" · "),
      search: [a.name, a.handle, a.platformLabel, a.kind].filter(Boolean).join(" "),
      avatar: {
        imageUrl: a.photo || null,
        initials: a.photo ? null : a.initials || BRAND_INITIALS,
        networkIcon: NETWORK_ICON_BY_PLATFORM[net] || null,
      },
    };
  });
}

// Shared arming of the account Quickpicker (step 1 and the period step's Back
// pick the same connected accounts). Rows are keyed by
// account id; onAccount receives the resolved account (or null) + its network
// slug. A live search box appears once the connected list is long enough that a
// flat list stops being scannable.
function accountPickerOpts({ title, subtitle, single = false, onAccount }) {
  const choices = getProfileChoices();
  return {
    items: choices,
    title,
    subtitle,
    single,
    searchable: choices.length > PROFILE_SEARCH_THRESHOLD,
    searchPlaceholder: "Search accounts by name, handle, or network…",
    onPick: (accountId) => {
      const account = getConnectedProfileById(accountId) || null;
      onAccount(account, account ? normalizeNetwork(account.platform) : normalizeNetwork(accountId));
    },
  };
}

// ---- Entry point ---------------------------------------------------------
//
// Asks for the account with the in-chat Quickpicker, then posts an interactive
// selection widget (assistant.postTopPostsWidget). Once posts are confirmed,
// session.js hands off to the profiles step + executeRepurpose.
export function startTopPostsInline(sessionId) {
  if (!getTopPosts().length) {
    postAssistantMessage(
      sessionId,
      "Once your posts start performing, I'll surface your top posts here so you can repurpose what already works. Publish a few and come back.",
    );
    return;
  }
  // An account picker with no rows is a dead end: connect first.
  if (getConnectedProfiles().length === 0) {
    requireConnectedProfiles(sessionId, { stepLabel: "Account", onReady: () => startTopPostsInline(sessionId) });
    return;
  }
  // The drafts' voice: the Playbook new work goes to, kept implicit to stay short.
  repurposeContexts.set(sessionId, playbookForNewWork()?.id || null);
  postAssistantMessage(sessionId, "Which account should I load your top posts from?");
  inlineQuestion.ask(
    sessionId,
    accountPickerOpts({
      title: "Pick an account",
      subtitle: "I'll load its top posts next.",
      onAccount: (account, network) => {
        echoAccount(sessionId, account, network);
        askPeriod(sessionId, network);
      },
    }),
  );
}

// Echo the picked account as a visual profile turn so the choice stays visible
// in the conversation (matches the draft flow's profile echo).
function echoAccount(sessionId, account, network) {
  if (account) postUserProfilesTurn(sessionId, [account]);
  else postUserTurn(sessionId, networkLabel(normalizeNetwork(network)));
}

// The recency window to pull winners from — the same periods the studio board
// filters by (PERIODS), asked before the ranking metric so we only rank posts
// inside the window the user cares about.
const PERIOD_CHOICES = PERIODS.map((p) => ({ value: p.key, label: p.label, icon: "ap-icon-clock" }));

// Account chosen → ask which time window to pull winners from before ranking.
function askPeriod(sessionId, network) {
  postAssistantMessage(sessionId, "How far back should I look?");
  inlineQuestion.ask(sessionId, {
    items: PERIOD_CHOICES,
    title: "Time period",
    subtitle: "I'll only rank posts published in that window.",
    onPick: (periodKey) => {
      askRankCriterion(sessionId, network, periodKey);
    },
    // Back to the account question (re-arm it without re-posting the intro).
    onBack: () =>
      inlineQuestion.ask(
        sessionId,
        accountPickerOpts({
          title: "Pick an account",
          subtitle: "I'll load its top posts next.",
          onAccount: (account, net) => {
            echoAccount(sessionId, account, net);
            askPeriod(sessionId, net);
          },
        }),
      ),
  });
}

// Which metric ranks the winners — the same lenses the studio board sorts by
// (SORTS), asked up front so the widget can surface the strongest posts for the
// metric the user actually cares about (performance / engagement / impressions).
const RANK_CHOICES = [
  { value: "performance", label: "Performance", caption: "Highest vs your average.", icon: "ap-icon-data-increase" },
  { value: "engagement", label: "Engagement rate", caption: "Most reactions per view.", icon: "ap-icon-heart" },
  { value: "impressions", label: "Impressions", caption: "Shown in the most feeds.", icon: "ap-icon-eye-on" },
];

// Window chosen → ask which metric to rank by before surfacing the winners.
function askRankCriterion(sessionId, network, period = "1m") {
  postAssistantMessage(sessionId, "How should I rank them?");
  inlineQuestion.ask(sessionId, {
    items: RANK_CHOICES,
    title: "Rank by",
    subtitle: "I'll put the strongest posts for that metric first.",
    onPick: (sortKey) => {
      presentWinners(sessionId, network, sortKey, period);
    },
    // Back to the period question (re-arm it without re-posting the intro).
    onBack: () =>
      inlineQuestion.ask(sessionId, {
        items: PERIOD_CHOICES,
        title: "Time period",
        subtitle: "I'll only rank posts published in that window.",
        onPick: (periodKey) => {
          askRankCriterion(sessionId, network, periodKey);
        },
      }),
  });
}

// Metric chosen → brief "finding your winners" beat, then drop the interactive
// selection widget into the thread scoped to that account, sorted by the metric.
function presentWinners(sessionId, network, sortKey = "performance", period = "1m") {
  const net = normalizeNetwork(network);
  const sort = SORTS.find((s) => s.key === sortKey) || SORTS[0];
  const window = PERIODS.find((p) => p.key === period) || PERIODS[0];
  const pendingId = startPending(sessionId, "Finding your top posts…");
  setTimeout(() => {
    finishPending(sessionId, pendingId);
    const postIds = getTopPosts()
      .filter((p) => normalizeNetwork(p.network) === net && (p.daysAgo ?? 0) <= window.maxDays)
      .sort(sort.compare)
      .map((p) => p.id);
    postAssistantMessage(
      sessionId,
      `Here are your top ${networkLabel(net)} posts by ${sort.label.toLowerCase()}. Pick one to repurpose.`,
    );
    postTopPostsWidget(sessionId, { network: net, postIds });
  }, PROFILE_LOAD_MS);
}

// ---- Step 2: echo the pick(s) ----------------------------------------
//
// Echoes every chosen winner as a compact preview card so the picks stay visible in the
// conversation. Returns the valid post ids so the caller can drive the angle
// quick-picker; the picker itself lives in session.js (inline-question), which
// owns the onPick closures the way the draft flow's profile picker does.
export function echoRepurposePicks(sessionId, postIds, { echo = true } = {}) {
  const ids = (postIds || []).filter(Boolean);
  const posts = ids.map(getTopPost).filter(Boolean);
  if (!posts.length) return [];

  // The inline widget path already shows the picks (a frozen selection card), so
  // it validates ids without posting duplicate compact echoes (`echo: false`).
  if (!echo) return posts.map((p) => p.id);

  for (const post of posts) {
    postTopPostPickTurn(sessionId, {
      network: post.network,
      excerpt: post.excerpt,
      perfBadge: post.perfBadge,
      vsAvg: post.vsAvg,
      engagementRate: post.engagementRate,
      impressions: post.impressions,
      views: post.views,
      reactions: post.reactions,
      shares: post.shares,
      saves: post.saves,
      mediaType: post.mediaType,
      image: post.image,
    });
  }
  return posts.map((p) => p.id);
}

// Unique source networks across the picked posts — the profiles the winner(s)
// already live on, which the repurpose target picker excludes.
function repurposeSourceNetworks(postIds) {
  const posts = (postIds || []).map(getTopPost).filter(Boolean);
  return [...new Set(posts.map((p) => normalizeNetwork(p.network)).filter((n) => networkMeta(n)))];
}

// Repurpose-target quick-picker items — the user's CONNECTED SOCIAL PROFILES,
// presented as profile rows (brand avatar + network badge + handle). `include`
// scopes the list to the scope choice that opened the step:
//   "other"  (default) → profiles the winner did NOT run on (spread the win)
//   "source"           → only the profile(s) the winner already ran on (repost)
//   "all"              → every profile, source(s) first and flagged "· Source"
// The "· Source" tag is only added in the mixed "all" list — in a source-only
// list the context already makes it obvious.
export function repurposeProfileItems(postIds, { include = "other" } = {}) {
  const sourceNets = repurposeSourceNetworks(postIds);
  const connected = getConnectedProfiles();
  const isSource = (p) => sourceNets.includes(normalizeNetwork(p.platform));
  let ordered;
  if (include === "source") ordered = connected.filter(isSource);
  else if (include === "all") ordered = [...connected.filter(isSource), ...connected.filter((p) => !isSource(p))];
  else ordered = connected.filter((p) => !isSource(p)); // "other"
  const tagSource = include === "all";
  return ordered.map((p) => {
    const base = [p.platformLabel, p.kind].filter(Boolean).join(" · ");
    return {
      value: p.id,
      label: p.handle,
      // Flag source-network profiles so the caller can default them "on" in the
      // unified repurpose stepper (source pre-set to 1, others to 0).
      isSource: isSource(p),
      // "Source" is emphasised (own class) so it stands out from the muted
      // "Network · Kind" prefix. Caption is inserted raw by the picker renderer.
      caption: tagSource && isSource(p) ? `${base} · <span class="top-posts-source-tag">Original</span>` : base,
      // Plain-text haystack for the picker's live search (the caption carries
      // HTML, so build search text from the raw fields instead).
      search: [p.name, p.handle, p.platformLabel, p.kind].filter(Boolean).join(" "),
      avatar: {
        imageUrl: p.photo,
        initials: p.initials || BRAND_INITIALS,
        networkIcon: NETWORK_ICON_BY_PLATFORM[normalizeNetwork(p.platform)],
      },
    };
  });
}

function truncate(s, n = 60) {
  const t = (s || "").trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t;
}

// Normalise the target argument into a `[{ network, count }]` list applied to
// every picked post. Accepts either the new per-profile shape (objects, from the
// "Other profiles" stepper where each profile carries its own draft count) or a
// bare network-slug array (each treated as count 1). Invalid networks are
// dropped; counts floor at 1. An empty result signals "each post on its own
// source network" (the "same profile" branch).
function normalizeTargets(targets) {
  return (targets || [])
    .map((t) => (typeof t === "string" ? { network: t, count: 1 } : t || {}))
    .map((t) => ({ network: (t.network || "").toLowerCase(), count: Math.max(1, Math.floor(t.count) || 1) }))
    .filter((t) => networkMeta(t.network));
}

// ---- Step 3: generate the adapted drafts ------------------------------
//
// `postIds` is the picked winners. `targets` is the profiles to publish to as
// `[{ network, count }]` — `count` is how many versions to write for that
// profile (the per-profile stepper). One draft per post × target × version,
// each body adapted to the target network. An empty `targets` means "same
// profile" — each post back on its own source network, one version. Capped at
// MAX_DRAFTS.
export function executeRepurpose(sessionId, postIds, targets) {
  const posts = (postIds || []).map(getTopPost).filter(Boolean);
  if (!posts.length) return;

  const pickedTargets = normalizeTargets(targets);
  // The Playbook chosen on step 1 governs the drafts' voice — stamp it on each.
  const contextId = repurposeContexts.get(sessionId) || null;
  // No explicit targets → each post back on its own network.
  const nets = pickedTargets.length ? pickedTargets.map((t) => t.network) : posts.map((p) => p.network);
  requireNetworkVoices(sessionId, nets, () => writeRepurpose(sessionId, posts, pickedTargets, contextId), contextId);
}

function writeRepurpose(sessionId, posts, pickedTargets, contextId) {
  withPendingChip(
    sessionId,
    () => {
      // Each repurposed post becomes a ready source so the user can later find
      // which post fed these drafts (deduped by id in sources-stream).
      for (const post of posts) {
        const meta = networkMeta(post.network) || {};
        addReadySource(sessionId, {
          id: `src-toppost-${post.id}`,
          filename: truncate(firstSentence(post.excerpt), 60),
          kind: `${meta.label || "Post"} post`,
          preview: `Repurposed${post.perfBadge ? ` · ${post.perfBadge}` : ""}`,
          iconClass: meta.icon || null,
          // Carry the winner so the Sources panel renders the real post card.
          topPost: post,
        });
      }
      const drafts = [];
      let capped = false;
      outer: for (const post of posts) {
        // No explicit targets → repost to this post's own network (one version).
        const postTargets = pickedTargets.length ? pickedTargets : [{ network: post.network, count: 1 }];
        const base = plainCopy(post);
        for (const { network, count } of postTargets) {
          for (let i = 0; i < count; i += 1) {
            if (drafts.length >= MAX_DRAFTS) {
              capped = true;
              break outer;
            }
            const draft = addPostDraft(sessionId, {
              network,
              text: adaptForNetwork(base, network),
              hashtags: adaptHashtags(post.hashtags, network),
            });
            draft.generationContext = repurposeContext(post);
            draft.contextId = contextId;
            drafts.push(draft);
          }
        }
      }
      postDraftResult(sessionId, {
        ideaTitle: repurposeTitle(posts, drafts.length, capped),
        drafts,
      });
    },
    (err) =>
      reportDraftFailure(
        sessionId,
        err,
        () => writeRepurpose(sessionId, posts, pickedTargets, contextId),
        "top-posts-flow",
      ),
  );
}

// Result-turn title: names the source when it's a single winner, counts them
// otherwise, and flags a clipped set so the count never reads as "all of them".
function repurposeTitle(posts, count, capped) {
  const base =
    posts.length === 1
      ? `New takes on your top ${networkLabel(posts[0].network)} post`
      : `New takes on ${posts.length} of your top posts`;
  return capped ? `${base} · first ${count}` : base;
}
