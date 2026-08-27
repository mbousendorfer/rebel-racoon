// All prototype data. One module, hardcoded, easy to edit.
// No network, no persistence, no randomness.

// Per-session sources / ideas / drafts live in their own bySession maps
// below. Source counts, idea counts and draft counts are derived from
// those stores at render time — never declared here.
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

// Top-performing published posts — the seed for the "Use top performing posts"
// flow (top-posts-store.js / top-posts-flow.js). These are POSTS the user
// already shipped, not drafts. The winner-selection screen (top-post-card.js)
// is decision-driven, so each post carries enough structured signal to compare
// and sort them:
//   daysAgo            recency, for the "Recent" sort + the age label
//   vsAvg              how many × the account's average engagement it did (the
//                      headline decision metric + the relative bar)
//   engagementRate     %, the "Engagement" sort
//   impressions        reach, the "Reach" sort
//   reactions/comments/shares/saves  the raw breakdown
//   perfBadge          percentile trust signal (e.g. "Top 3%")
//   topic              short theme label (chip)
//   whyItWorked        the pattern Archie verbalises before milking it
// `metricLine` is the legacy one-line summary still used by the Save-the-angle
// idea rationale. Account-level (not per session); empty in new-alt mode.
// ~9 winners per connected profile (LinkedIn / X / Instagram / Facebook), so
// picking any profile in the repurposing flow surfaces a full board. Each
// network's list is authored best-first; buildTopPosts() stamps a descending
// performance ramp (vsAvg / badge / engagement / reach / recency) onto them so
// the default "Performance" sort reads as a clean ranking.
const TOP_POST_CONTENT = {
  linkedin: [
    {
      topic: "Onboarding",
      excerpt:
        "We deleted our entire onboarding checklist. Activation went up 18%. Here's the counterintuitive reason fewer steps converted more people.",
      hashtags: ["SaaS", "Onboarding"],
      why: "a contrarian hook backed by one concrete number, then a promise to explain the why",
    },
    {
      topic: "Hiring",
      excerpt: "We stopped asking for cover letters. Best hiring call we made all year.",
      hashtags: ["Hiring", "Culture"],
      why: "a bold policy change stated as a result first, then the practical how",
    },
    {
      topic: "Leadership",
      excerpt:
        "The best managers I've worked with did one thing relentlessly: they made decisions reversible. Cheap to try, cheap to undo. It sounds like a small habit, but it's the quiet reason some teams move twice as fast as everyone else — nobody is paralyzed by getting it perfect the first time.",
      hashtags: ["Leadership", "Management"],
    },
    {
      topic: "Product",
      excerpt:
        "We killed our most-requested feature and churn actually dropped. 'Most requested' and 'most valuable' are almost never the same list.",
      hashtags: ["Product", "SaaS"],
    },
    {
      topic: "Careers",
      excerpt:
        "Nobody gets promoted for being busy. They get promoted for removing work. A short take on doing less, better.",
      hashtags: ["Careers", "Productivity"],
    },
    {
      topic: "Culture",
      excerpt:
        "We published every salary band internally last quarter. I won't pretend it wasn't terrifying — I lost sleep over it for a week. But it turned out to be the single biggest trust unlock we've ever done, and not one person left over it. Transparency compounds quietly.",
      hashtags: ["Culture", "Transparency"],
    },
    {
      topic: "Remote work",
      excerpt: "Remote work didn't kill culture. Bad meetings did. We cut ours by 40% and shipped faster.",
      hashtags: ["RemoteWork", "Productivity"],
      why: "a myth-bust followed immediately by a concrete number",
    },
    {
      topic: "Sales",
      excerpt: "Our best sales month came from saying no to three deals.",
      hashtags: ["Sales", "Strategy"],
    },
    {
      topic: "Strategy",
      excerpt:
        "Your strategy isn't a deck. It's what you say no to on a random Tuesday. Everything else is decoration.",
      hashtags: ["Strategy", "Leadership"],
    },
  ],
  x: [
    {
      topic: "AI tooling",
      excerpt:
        "Most “AI content tools” just autocomplete a blank box and call it magic. The ones that actually win do the boring, unglamorous part: they remember your brand voice across every single post, every channel, for months. That consistency is the whole game — and it's the part nobody bothers to demo.",
      hashtags: ["AI", "ContentMarketing"],
      why: "a sharp category take that names the real problem, ending on a quotable one-liner",
    },
    {
      topic: "Marketing",
      excerpt: "Nobody shares your product. They share how it makes them look.",
      hashtags: ["Marketing", "Brand"],
    },
    {
      topic: "Pricing",
      excerpt:
        "Your pricing page is a trust test, not a math problem. Stop optimizing the number. Start optimizing the doubt.",
      hashtags: ["Pricing", "SaaS"],
      why: "a reframing one-liner that flips a common assumption in the first breath",
    },
    {
      topic: "Writing",
      excerpt: "Cut your first sentence. Your real hook is sentence two.",
      hashtags: ["Writing", "Copywriting"],
    },
    {
      topic: "Growth",
      excerpt:
        "Growth isn't a hack. It's 100 boring things done consistently. Here are the 10 that moved the needle most for us.",
      hashtags: ["Growth", "Marketing"],
      why: "a contrarian opener that resolves into a concrete listicle payoff",
    },
    {
      topic: "Startups",
      excerpt:
        "You don't have a marketing problem. You have a 'nobody can explain what you do in one line' problem. Fix the sentence first.",
      hashtags: ["Startups", "Positioning"],
    },
    {
      topic: "Founders",
      excerpt: "The moat isn't the feature. It's four years of decisions nobody wants to copy.",
      hashtags: ["Founders", "Moats"],
    },
    {
      topic: "Productivity",
      excerpt: "Calendars are where priorities go to die. If it actually matters, it's a project — not a meeting.",
      hashtags: ["Productivity", "Focus"],
    },
    {
      topic: "Content",
      excerpt: "Post the thing you're slightly afraid to post. That's the one that works. The safe one is invisible.",
      hashtags: ["Content", "CreatorEconomy"],
    },
  ],
  instagram: [
    {
      topic: "Behind the scenes",
      excerpt:
        "Behind the scenes: how our 4-person team ships a week of social content in one afternoon. Swipe for the exact workflow →",
      hashtags: ["BehindTheScenes", "Workflow"],
      why: "a behind-the-scenes promise plus a save-worthy, step-by-step payoff",
    },
    {
      topic: "Hooks",
      excerpt: "5 hooks that stopped the scroll last month. Save this before your next post →",
      hashtags: ["ContentTips", "Hooks"],
    },
    {
      topic: "Templates",
      excerpt: "The 3 content templates we reuse every single week. Steal them — swipe through and save the last one.",
      hashtags: ["Templates", "Content"],
      why: "a numbered, steal-this promise with instant, save-worthy utility",
    },
    {
      topic: "Workflow",
      excerpt: "Our whole content system fits on one screen. Screenshot slide 4 — that's the part everyone asks about.",
      hashtags: ["Workflow", "Systems"],
    },
    {
      topic: "Carousel",
      excerpt: "How to turn one blog post into 10 posts. A carousel you'll actually come back to — save it.",
      hashtags: ["Repurposing", "Carousel"],
    },
    {
      topic: "Reels",
      excerpt: "The 6-second intro formula our Reels use. Copy it word for word →",
      hashtags: ["Reels", "VideoTips"],
    },
    {
      topic: "Design",
      excerpt: "Same photo, three edits, three completely different vibes. Which one's your brand? Swipe →",
      hashtags: ["Design", "BrandAesthetic"],
    },
    {
      topic: "Grid",
      excerpt: "Your grid is your first impression. 4 tweaks that make a feed look 'expensive'. Swipe →",
      hashtags: ["Aesthetic", "Branding"],
    },
    {
      topic: "Community",
      excerpt:
        "We reposted our community's words for a week and engagement doubled. Here's the permission-to-repost script →",
      hashtags: ["Community", "UGC"],
    },
  ],
  facebook: [
    {
      topic: "Community",
      excerpt:
        "We asked our community one question and got 200 replies in a day. Here's the question — and why it worked.",
      hashtags: ["Community", "Engagement"],
      why: "a curiosity gap plus social proof packed into the first line",
    },
    {
      topic: "Story",
      excerpt:
        "A customer emailed us at 2am, absolutely furious — caps lock, the whole thing. Instead of firing back a templated apology, we picked up the phone and called her. What happened over the next twenty minutes turned her into our single loudest advocate. Here's the full story, and the three things we quietly changed because of it 👇",
      hashtags: ["CustomerStory", "Support"],
    },
    {
      topic: "Event",
      excerpt:
        "300 of you showed up to our first live session. Here's everything we learned about what this community actually wants.",
      hashtags: ["Community", "Events"],
    },
    {
      topic: "Announcement",
      excerpt:
        "We're making our most-loved guide completely free — no email gate, no catch. Here's why giving it away is good business.",
      hashtags: ["Announcement", "Content"],
    },
    {
      topic: "Milestone",
      excerpt:
        "Ten years ago this was a spreadsheet and a stubborn idea nobody else believed in. Today it's a team of 40, across six countries, serving people we never imagined we'd reach. To everyone who bet on us early — before there was anything to bet on: thank you. This one's yours.",
      hashtags: ["Milestone", "Gratitude"],
    },
    {
      topic: "Poll",
      excerpt:
        "Quick one for the group: what's the ONE tool you'd never give up? We'll compile the top answers into a guide.",
      hashtags: ["Poll", "Community"],
    },
    {
      topic: "Tips",
      excerpt:
        "5 questions every small team should ask before hiring their first marketer. Comment 'guide' and we'll send the full list over.",
      hashtags: ["SmallBusiness", "Marketing"],
    },
    {
      topic: "Growth",
      excerpt: "We just passed 50,000 of you here. Ask us anything for the next 24 hours 👇",
      hashtags: ["Community", "AMA"],
    },
    {
      topic: "Discussion",
      excerpt:
        "Hot take: most 'engagement' advice makes pages boring. Here's what we did instead — and the reactions surprised us.",
      hashtags: ["Engagement", "SocialMedia"],
    },
  ],
};

// Descending performance ramp applied per network (best-first). Nine tiers so
// each profile fills a board; picking-order = performance. `days` (recency) is
// kept inside ~1 month for the whole top block so the default "Last month"
// window already shows a full board; cycled winners beyond the block age past it
// (topPostRamp adds 7d each), so the wider periods reveal progressively more.
const TOP_POST_RAMP = [
  { vsAvg: 4.3, badge: "Top 2%", eng: 8.4, imp: 53000, days: 2 },
  { vsAvg: 3.6, badge: "Top 4%", eng: 7.0, imp: 45000, days: 5 },
  { vsAvg: 3.0, badge: "Top 6%", eng: 6.2, imp: 39000, days: 8 },
  { vsAvg: 2.6, badge: "Top 9%", eng: 5.5, imp: 34000, days: 12 },
  { vsAvg: 2.2, badge: "Top 12%", eng: 4.9, imp: 29000, days: 16 },
  { vsAvg: 1.9, badge: "Top 15%", eng: 4.3, imp: 25000, days: 19 },
  { vsAvg: 1.6, badge: "Top 18%", eng: 3.8, imp: 21000, days: 23 },
  { vsAvg: 1.4, badge: "Top 23%", eng: 3.4, imp: 18000, days: 26 },
  { vsAvg: 1.2, badge: "Top 28%", eng: 3.0, imp: 15000, days: 29 },
];

// Decorrelate the metrics: each post takes its vsAvg/badge from the ramp by its
// own index (so the default "Performance" sort reads 4.3→1.2), but its
// engagement %, reach, and recency are pulled from DIFFERENT ramp rows via these
// permutations. Without this every metric is rank-aligned and all four sorts
// return the same order (i.e. sorting looks broken). Each is a permutation of 0-8.
const TOP_POST_ENG_ORDER = [2, 6, 0, 8, 1, 5, 3, 7, 4];
const TOP_POST_REACH_ORDER = [4, 1, 7, 0, 8, 3, 6, 2, 5];
const TOP_POST_DAYS_ORDER = [6, 3, 8, 1, 4, 0, 7, 5, 2];

const TOP_POST_ID_ABBR = { linkedin: "li", x: "x", instagram: "ig", facebook: "fb" };

// Media type per winner — a post is either an image or plain text (video posts
// are never repurposed here). Which one shapes how it's repurposed, so the
// winner cards surface it as a preview tile. Assigned by a per-network pattern
// (index-aligned to TOP_POST_CONTENT) so each profile's board shows a realistic
// mix rather than authoring it per item. IG skews visual; X/LinkedIn broader.
// LinkedIn also has native Document posts (a PDF carousel) — flagged "document"
// so the board indicates the type + page count (no visual preview).
const TOP_POST_MEDIA_PATTERN = {
  linkedin: ["image", "document", "text", "text", "image", "text", "document", "text", "image"],
  x: ["text", "text", "image", "text", "text", "text", "text", "image", "text"],
  instagram: ["image", "text", "image", "text", "image", "image", "text", "image", "text"],
  facebook: ["image", "text", "image", "text", "text", "image", "text", "text", "text"],
};

// Page counts cycled across Document winners (LinkedIn PDF carousels).
const TOP_POST_PAGE_COUNTS = [7, 12, 5, 10, 9];

// Curated stock photos (Unsplash direct URLs — business / tech / marketing) used
// as the poster for image winners. Cropped to 16:9 to match the tile. No
// local post-image assets exist in the proto, so these load over the network; the
// card falls back to a grey tile if one is blocked.
const TOP_POST_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=640&h=360&q=70",
];

// Image count cycled across image winners: 1 = single photo, >1 = a multi-image
// (carousel) post, which the card flags with a stacked-images badge. Mixed so a
// board shows both single and multi-image winners.
const TOP_POST_IMAGE_COUNTS = [1, 3, 1, 2, 5, 1, 4, 1];

// Absolute publish date for a post given its recency (daysAgo). Derived from a
// FIXED base ("today" = 2 Jul 2026) so the mock reads consistently regardless of
// the real clock — e.g. daysAgo 4 → "Jun 28, 2026". Shown on the winner cards
// alongside the relative "Nd ago" age.
const TOP_POST_TODAY = new Date(2026, 6, 2);
const TOP_POST_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function topPostDate(daysAgo) {
  const d = new Date(TOP_POST_TODAY);
  d.setDate(d.getDate() - daysAgo);
  return `${TOP_POST_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Maximum body length (characters) a text post can reach on each network — the
// real platform limits (as of 2026). Text winners get random copy at a spread of
// lengths up to this cap (see TEXT_LEN_LADDER) so the board exercises every
// pull-quote size tier AND the worst case: a maxed-out post must truncate, not
// break the card, its wrapping, or the grid.
const NETWORK_MAX_CHARS = {
  linkedin: 3000,
  x: 280,
  instagram: 2200,
  facebook: 63206,
};

// Target lengths cycled across a network's text winners so the board shows the
// full range of size tiers (short pull-quote → small body copy). The network's
// own max is appended per-network so at least one card per board hits the cap and
// proves truncation works.
const TEXT_LEN_LADDER = [55, 135, 260, 520, 1400];

// Sentence pool for synthesising random long-form post copy. Assembled and sliced
// to an exact target length so a text winner fills its network's max body.
const FILLER_SENTENCES = [
  "Growth isn't a single lever you pull — it's a hundred unglamorous decisions made consistently, week after week, long after the excitement wears off.",
  "The teams that win aren't the ones with the biggest budget; they're the ones who ship, measure, and adjust faster than everyone else.",
  "Most content fails not because it's bad, but because it never had a hook worth stopping for in the first two seconds.",
  "We spent a quarter obsessing over a metric that turned out not to matter, and the lesson cost us more than the number ever could.",
  "Your brand voice is the one asset a competitor can't copy overnight, so protect it like it's the product — because it is.",
  "Every process that scales starts as a messy experiment somebody was brave enough to run without permission.",
  "The best marketing doesn't feel like marketing; it feels like a colleague sharing something useful they genuinely believe in.",
  "Consistency beats intensity: one honest post a week for a year will outperform a frantic launch month every single time.",
  "We killed a feature half the team loved because the data was clear, and retention thanked us within two weeks.",
  "Attention is earned in seconds and lost in silence, so give people a reason to care before you ask them to act.",
  "The hardest part of strategy isn't deciding what to do — it's having the discipline to say no to everything else.",
  "Small teams move fast because there's nowhere for a decision to hide; ownership is obvious and accountability is real.",
  "If you can't explain what you do in a single clear sentence, no ad budget in the world will fix the confusion.",
  "Trust compounds quietly in the background until one day it becomes the only reason a customer chooses you at all.",
  "We learned more from the campaign that flopped than from the three that quietly worked exactly as planned.",
  "Great communities aren't built by broadcasting louder; they're built by listening closely and replying like a human.",
  "Every dashboard is a story someone chose to tell, so always ask what the numbers are conveniently leaving out.",
  "The goal was never more posts — it was more of the right posts, aimed at the people who actually needed to hear them.",
];

// Build a string of ~`len` characters of random copy from the pool, trimmed back
// to the last whole word (and any trailing punctuation) so a card never ends
// mid-word. Stays within `len` — the CSS line-clamp handles visual truncation.
function randomText(len) {
  let out = "";
  while (out.length < len) {
    const s = FILLER_SENTENCES[Math.floor(Math.random() * FILLER_SENTENCES.length)];
    out += (out ? " " : "") + s;
  }
  const cut = out.slice(0, len);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, "");
}

// How many winners to synthesise per network. The authored content (9 items) is
// cycled to fill the board so the "Load more" pager (12 at a time) has a real
// second page to reveal; metrics / dates / media keep degrading past the ramp.
const TOP_POSTS_PER_NETWORK = 24;

// Networks intentionally left with ZERO winners so the repurpose board shows its
// empty state when that profile is picked. X is empty by design here (a
// showcase); its authored content above is kept so it can surface again just by
// removing it from this set.
const TOP_POST_EMPTY_NETWORKS = new Set(["x"]);

// Ramp row for any rank i — reads the authored 9 tiers, then extends the decay
// below the last tier so cycled winners keep descending (vsAvg floored at 1.0×
// so the tail still reads as "at least average").
function topPostRamp(i) {
  const R = TOP_POST_RAMP;
  if (i < R.length) return R[i];
  const base = R[R.length - 1];
  const over = i - (R.length - 1);
  return {
    vsAvg: Math.max(1, +(base.vsAvg - over * 0.03).toFixed(1)),
    badge: `Top ${Math.min(70, 28 + over * 3)}%`,
    eng: Math.max(1.5, +(base.eng - over * 0.12).toFixed(1)),
    imp: Math.max(2000, Math.round(base.imp - over * 800)),
    days: base.days + over * 7,
  };
}

function buildTopPosts() {
  const out = [];
  // Running counter so image winners cycle through the stock pool across the
  // whole set (not per network) for variety.
  let imgIdx = 0;
  // Running counter so Document winners cycle through the page-count list.
  let docIdx = 0;
  for (const [network, posts] of Object.entries(TOP_POST_CONTENT)) {
    // Skip networks flagged empty by design → their board renders the empty state.
    if (TOP_POST_EMPTY_NETWORKS.has(network)) continue;
    // Per-network ladder of text lengths (short → this network's max) cycled
    // across its text winners so every board shows the size-tier spread + the cap.
    const cap = NETWORK_MAX_CHARS[network] || 3000;
    const textLadder = [...new Set([...TEXT_LEN_LADDER.map((t) => Math.min(t, cap)), cap])];
    let textIdx = 0;
    for (let i = 0; i < TOP_POSTS_PER_NETWORK; i += 1) {
      const c = posts[i % posts.length]; // cycle the authored content
      const j = i % 9; // position within the 9-item cycle (drives the permutations)
      const block = Math.floor(i / 9) * 9; // shift the permutation into the right decay tier
      // vsAvg / badge track the post's own rank (Performance descends overall),
      // but the other metrics come from different ramp rows so each sort reorders.
      const perf = topPostRamp(i);
      const eng = topPostRamp(block + TOP_POST_ENG_ORDER[j]).eng;
      const imp = topPostRamp(block + TOP_POST_REACH_ORDER[j]).imp;
      const days = topPostRamp(block + TOP_POST_DAYS_ORDER[j]).days;
      const reactions = Math.round(((imp * eng) / 100) * 0.78);
      const comments = Math.round(reactions * 0.09);
      const secondary = Math.round(reactions * 0.14); // shares (or saves on IG)
      const usesSaves = network === "instagram";
      const mediaType = TOP_POST_MEDIA_PATTERN[network]?.[j] || "text";
      const post = {
        id: `top-${TOP_POST_ID_ABBR[network]}-${i + 1}`,
        network,
        publishedAt: `${days}d ago`,
        publishedOn: topPostDate(days),
        daysAgo: days,
        topic: c.topic,
        // Text winners get random copy at a laddered length (short → this
        // network's max) so the board shows every size tier; image winners keep
        // their authored caption.
        excerpt:
          mediaType === "text" || mediaType === "document"
            ? randomText(textLadder[textIdx++ % textLadder.length])
            : c.excerpt,
        perfBadge: perf.badge,
        vsAvg: perf.vsAvg,
        engagementRate: eng,
        impressions: imp,
        // Views (total) run above Reach (unique accounts) — the two metrics the
        // winner cards surface side by side.
        views: Math.round(imp * 1.7),
        reactions,
        comments,
        metricLine: `${perf.vsAvg}× your average engagement · ${reactions.toLocaleString()} reactions · ${comments} comments`,
        whyItWorked: c.why || "a strong hook backed by a concrete result",
        hashtags: c.hashtags,
        // Media type drives the card's preview tile (image / text).
        mediaType,
      };
      if (usesSaves) post.saves = secondary;
      else post.shares = secondary;
      // Image winners carry a poster image + an image count (>1 = carousel).
      if (mediaType === "image") {
        post.image = TOP_POST_IMAGES[imgIdx % TOP_POST_IMAGES.length];
        post.imageCount = TOP_POST_IMAGE_COUNTS[imgIdx % TOP_POST_IMAGE_COUNTS.length];
        imgIdx += 1;
      }
      // Document winners (LinkedIn PDF carousels) carry a page count — no preview.
      if (mediaType === "document") {
        post.pageCount = TOP_POST_PAGE_COUNTS[docIdx % TOP_POST_PAGE_COUNTS.length];
        docIdx += 1;
      }
      out.push(post);
    }
  }
  return out;
}

export const topPosts = buildTopPosts();

// Per-session source seed. Each conversation owns its own sources — no
// cross-session reuse. Listed by sessionId for clarity; sources-stream.js
// loads this into its per-session Map at boot for returning users.
export const sourcesBySession = {
  "s-acme-launch": [
    {
      id: "src-acme-1",
      filename: "q2-strategy-offsite-notes.pdf",
      kind: "PDF",
      status: "Processed",
      signal: "High signal",
      signalColor: "orange",
      ideaCount: 2,
      addedAt: "2d ago",
    },
    {
      id: "src-acme-2",
      filename: "founder-keynote.mp4",
      kind: "Video",
      status: "Processed",
      signal: "Medium signal",
      signalColor: "tagOrange",
      ideaCount: 2,
      addedAt: "2d ago",
      durationSec: 1458,
      clips: [
        {
          id: "cl1",
          start: 252,
          end: 282,
          hue: 22,
          title: '"It\'s about removing the blank page"',
          summary: "Tightest version of the Studio positioning — a single sentence that lands the whole thesis.",
          why: "Quotable hook. Reads as a standalone post on X or as the lede of a LinkedIn story.",
          network: "x",
          tags: ["hook", "positioning"],
        },
        {
          id: "cl2",
          start: 510,
          end: 568,
          hue: 280,
          title: "One draft → every network in 4 seconds",
          summary: "Live demo of a single post auto-adapting for FB, IG, LinkedIn, and X. Strong visual moment.",
          why: "Video carries this — short, kinetic, and ends with a clear payoff.",
          network: "instagram",
          tags: ["demo", "product"],
        },
        {
          id: "cl3",
          start: 890,
          end: 938,
          hue: 200,
          title: "6.2 hours back per week",
          summary: "The headline beta-user stat, delivered with the customer story behind it.",
          why: "Specific number + before/after. LinkedIn audiences over-index on time-savings proof.",
          network: "linkedin",
          tags: ["stat", "proof"],
        },
        {
          id: "cl4",
          start: 1102,
          end: 1156,
          hue: 12,
          title: 'Why we killed the "scheduling" tab',
          summary: "Contrarian product decision — explains the philosophy behind the Studio rebuild.",
          why: "Founder POV in a single beat. Ideal for thought-leadership context.",
          network: "linkedin",
          tags: ["contrarian", "pov"],
        },
        {
          id: "cl5",
          start: 1340,
          end: 1392,
          hue: 145,
          title: '"Stop measuring posts. Start measuring outcomes."',
          summary: "Closing line of the keynote. Clean delivery, room around it for graphics.",
          why: "Vertical-format reel material. Punchy, mid-length, ends on a quotable.",
          network: "tiktok",
          tags: ["closing", "reel"],
        },
      ],
    },
    {
      id: "src-acme-3",
      filename: "roadmap-blogpost.com/launch",
      kind: "URL",
      status: "Processed",
      signal: "Medium signal",
      signalColor: "tagOrange",
      ideaCount: 1,
      addedAt: "1d ago",
    },
  ],
  "s-riverside": [
    {
      id: "src-riv-1",
      filename: "riverside-discovery-call.mp3",
      kind: "Audio",
      status: "Processed",
      signal: "High signal",
      signalColor: "orange",
      ideaCount: 3,
      addedAt: "Yesterday",
    },
    {
      id: "src-riv-2",
      filename: "riverside-case-study-draft.pdf",
      kind: "PDF",
      status: "Processed",
      signal: "Medium signal",
      signalColor: "tagOrange",
      ideaCount: 1,
      addedAt: "Yesterday",
    },
  ],
  "s-state-of-social": [
    {
      id: "src-sos-1",
      filename: "state-of-social-2026-report.pdf",
      kind: "PDF",
      status: "Processed",
      signal: "High signal",
      signalColor: "orange",
      ideaCount: 4,
      addedAt: "2d ago",
    },
    {
      id: "src-sos-2",
      filename: "social-trends-keynote.mp4",
      kind: "Video",
      status: "Processed",
      signal: "Medium signal",
      signalColor: "tagOrange",
      ideaCount: 2,
      addedAt: "2d ago",
      durationSec: 1820,
    },
  ],
  "s-weekly-recap": [
    {
      id: "src-weekly-1",
      filename: "analytics-week-12.pdf",
      kind: "PDF",
      status: "Processed",
      signal: "Low signal",
      signalColor: "grey",
      ideaCount: 2,
      addedAt: "5d ago",
    },
  ],
};

// Idea model — Q1 hybrid:
//   • Original archie fields (relevance/confidence/pinned/state/channels/
//     sourceIds) preserved for the rich workspace UX
//   • Handoff fields layered on top — `kind` (stat/quote/hook/story/insight)
//     for filter rails, `tags` for chip rows, `used` for "Most used / Unused"
//     sort, `ref` for the inline citation snippet shown on each card
//
// Partitioned by session so each conversation owns its own idea pool —
// counts displayed in the topbar, status card and chat-picker match the
// store contents on a per-session basis. Per-source `ideaCount` in
// Handcrafted "angles" for the draft-from-idea flow. When the user clicks
// Draft on an idea card, Archie suggests 4 AI-generated angles (title +
// short description) the idea could be reframed into before asking how
// many drafts. These are mocked per-idea for the main demo session; any
// idea without a handcrafted set falls back to draft-flow's generateAngles().
// Keyed by idea id; each angle is { id, title, description }.
export const anglesByIdea = {
  "idea-acme-1": [
    {
      id: "angle-acme-1-1",
      title: "The honest founder retro",
      description:
        "Walk through the three bottlenecks — scope, distribution, onboarding — and what you'd do differently.",
    },
    {
      id: "angle-acme-1-2",
      title: "The contrarian take on launch hype",
      description: "Argue that most launches fail on distribution, not product, using your scope-creep story as proof.",
    },
    {
      id: "angle-acme-1-3",
      title: "A playbook for first-time launchers",
      description: "Turn the three constraints into a pre-launch checklist readers can steal before their own launch.",
    },
    {
      id: "angle-acme-1-4",
      title: "The data-backed post-mortem",
      description: "Frame each constraint around the number it cost you, and the metric that finally moved.",
    },
  ],
  "idea-acme-2": [
    {
      id: "angle-acme-2-1",
      title: "The contrarian manifesto",
      description: "Make the case that OKRs are a lagging signal, not a focus tool — and what you replaced them with.",
    },
    {
      id: "angle-acme-2-2",
      title: "The before-and-after story",
      description: "Show one quarter run on OKRs versus one run without, and what changed for the team.",
    },
    {
      id: "angle-acme-2-3",
      title: "A how-to for ditching rituals",
      description: "Give readers a three-step path to retire OKRs without losing alignment.",
    },
    {
      id: "angle-acme-2-4",
      title: "The reply to OKR defenders",
      description: "Pre-empt the obvious objections and answer them head-on to spark debate.",
    },
  ],
  "idea-acme-3": [
    {
      id: "angle-acme-3-1",
      title: "The behind-the-scenes recap",
      description: "Show the keynote as it really happened, including the bits that got cut.",
    },
    {
      id: "angle-acme-3-2",
      title: "The lessons-learned angle",
      description: "Pull three things you'd change about presenting to a small, high-trust room.",
    },
    {
      id: "angle-acme-3-3",
      title: "The vulnerable founder story",
      description: "Share the nerves and the moment it clicked, to make the post relatable.",
    },
    {
      id: "angle-acme-3-4",
      title: "The tactical breakdown",
      description: "Turn the keynote structure into a template other founders can reuse.",
    },
  ],
  "idea-acme-4": [
    {
      id: "angle-acme-4-1",
      title: "The positioning statement",
      description: "Lead with the quote and unpack what “removing the blank page” means for your users.",
    },
    {
      id: "angle-acme-4-2",
      title: "The contrarian framing",
      description: "Use the quote to push back on the “AI replaces writers” narrative dominating the feed.",
    },
    {
      id: "angle-acme-4-3",
      title: "The customer-proof angle",
      description: "Pair the quote with a short story of a writer who shipped faster, not less.",
    },
    {
      id: "angle-acme-4-4",
      title: "The manifesto post",
      description: "Expand the quote into a three-line belief statement about how you build.",
    },
  ],
  "idea-acme-5": [
    {
      id: "angle-acme-5-1",
      title: "The editorial rule of thumb",
      description: "Share the exact filter you use to decide what's safe to talk about publicly.",
    },
    {
      id: "angle-acme-5-2",
      title: "The thoughtful-vs-hype angle",
      description: "Position your restraint as a deliberate choice in a market full of roadmap theater.",
    },
    {
      id: "angle-acme-5-3",
      title: "A how-to for transparent roadmaps",
      description: "Give teams a simple framework for deciding what to share and what to hold.",
    },
    {
      id: "angle-acme-5-4",
      title: "The behind-the-curtain story",
      description: "Tell the story of a roadmap item you almost announced — and why you didn't.",
    },
  ],
};

// `sourcesBySession` is kept in sync with the count of ideas pointing at
// that source below.
export const ideasBySession = {
  "s-acme-launch": [
    {
      id: "idea-acme-1",
      title: "The three constraints that killed our first launch",
      body: "A candid retro framed around the three bottlenecks we kept underestimating: scope, distribution, and onboarding.",
      kind: "story",
      tags: ["retro", "operator", "launch"],
      used: 1,
      ref: "p. 4 · offsite notes",
      rationale:
        "Concrete and personal — operator retros are the kind of post readers save and reread. Strong pull on discussion.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 92,
      channels: ["linkedin"],
      state: "Pinned",
      pinned: true,
      sourceIds: ["src-acme-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-acme-2",
      title: "Why we stopped writing quarterly OKRs",
      body: "Contrarian take grounded in the offsite notes. Frames OKRs as a lagging signal rather than a tool for focus.",
      kind: "insight",
      tags: ["okrs", "contrarian"],
      used: 0,
      ref: "p. 7 · offsite notes",
      rationale:
        "A contrarian frame on a rituals-heavy topic. High comment potential from teams with their own OKR scars.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 88,
      channels: ["linkedin", "x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-acme-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-acme-3",
      title: "What a founder keynote looks like at 50 people",
      body: "Behind-the-scenes recap of the keynote, including the bits that got cut.",
      kind: "story",
      tags: ["bts", "founder"],
      used: 0,
      ref: "12:30 · keynote",
      rationale:
        "Behind-the-scenes posts earn trust fast — readers get a rare look at how the company actually operates.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 76,
      channels: ["linkedin", "instagram"],
      state: "New",
      pinned: false,
      sourceIds: ["src-acme-2"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-acme-4",
      title: '"Studio isn\'t about replacing the writer."',
      body: "\"Studio isn't about replacing the writer — it's about removing the blank page.\"",
      kind: "quote",
      tags: ["positioning", "hero"],
      used: 1,
      ref: "04:12 · keynote",
      rationale: "Crisp hero quote — works equally well as the lede or the close of a launch post.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 90,
      channels: ["linkedin", "x", "instagram"],
      state: "Pinned",
      pinned: true,
      sourceIds: ["src-acme-2"],
      extractedAt: "1d ago",
    },
    {
      id: "idea-acme-5",
      title: "How we pick which roadmap items we talk about publicly",
      body: "An editorial rule of thumb the team actually uses.",
      kind: "insight",
      tags: ["editorial", "judgement"],
      used: 2,
      ref: "acme.com/launch",
      rationale:
        "Editorial restraint is under-used as an angle. Positions the team as thoughtful rather than hype-driven.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 71,
      channels: ["linkedin"],
      state: "Reviewed",
      pinned: false,
      sourceIds: ["src-acme-3"],
      extractedAt: "just now",
    },
  ],
  "s-riverside": [
    {
      id: "idea-riv-1",
      title: "Riverside's 6-week onboarding rebuild",
      body: "The arc: legacy CMS → unified Studio workflow. Three decisions that compounded, told from the customer's POV.",
      kind: "story",
      tags: ["case-study", "onboarding"],
      used: 2,
      ref: "08:42 · discovery call",
      rationale:
        "Operator-shaped story with a clear before/after. Customer-told arcs convert better than vendor-told ones.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 91,
      channels: ["linkedin"],
      state: "Pinned",
      pinned: true,
      sourceIds: ["src-riv-1"],
      extractedAt: "Yesterday",
    },
    {
      id: "idea-riv-2",
      title: "The metric Riverside cared about that we didn't track",
      body: "How a single discovery call reframed our success metric — and why it changed the roadmap that quarter.",
      kind: "insight",
      tags: ["metrics", "discovery"],
      used: 1,
      ref: "22:10 · discovery call",
      rationale: "Naming a blind spot earns credibility. Pairs well as a teaser for the longer customer story post.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 84,
      channels: ["linkedin", "x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-riv-1"],
      extractedAt: "Yesterday",
    },
    {
      id: "idea-riv-3",
      title: '"We just needed one place to start a draft."',
      body: '"We just needed one place to start a draft. Everything else followed from that."',
      kind: "quote",
      tags: ["positioning", "verbatim"],
      used: 0,
      ref: "31:05 · discovery call",
      rationale: "Single-sentence customer quote that maps to the Studio thesis — strong lede or close.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 89,
      channels: ["linkedin", "x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-riv-1"],
      extractedAt: "Yesterday",
    },
    {
      id: "idea-riv-4",
      title: "From spreadsheet chaos to one workflow — the Riverside arc",
      body: "The before/after of consolidating four tools into one. Numbers from the case study draft: 11 hours/week reclaimed.",
      kind: "stat",
      tags: ["before-after", "time-saved"],
      used: 0,
      ref: "p. 3 · case-study draft",
      rationale:
        "Hard time-savings number sourced from the customer's own tracking — the kind of stat operators forward.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 78,
      channels: ["linkedin"],
      state: "New",
      pinned: false,
      sourceIds: ["src-riv-2"],
      extractedAt: "Yesterday",
    },
  ],
  "s-state-of-social": [
    {
      id: "idea-sos-1",
      title: "73% of social managers say context-switching is their #1 blocker",
      body: "73% of social media managers say context-switching between tools is their #1 blocker — up from 58% last year.",
      kind: "stat",
      tags: ["report", "pain-point"],
      used: 3,
      ref: "p. 9 · State of Social 2026",
      rationale: "Hard number with a year-over-year comparison — gives the post immediate credibility on LinkedIn.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 95,
      channels: ["linkedin", "x"],
      state: "Pinned",
      pinned: true,
      sourceIds: ["src-sos-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-sos-2",
      title: "The platform decline no one wants to call",
      body: "Two-year trend buried in the report: organic reach on the big-three networks is down 34% on average. Implications for next-year planning.",
      kind: "insight",
      tags: ["industry", "contrarian"],
      used: 1,
      ref: "p. 14 · State of Social 2026",
      rationale: "Contrarian read of a closely-watched number. Strong inbound for thought-leadership audiences.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 86,
      channels: ["linkedin"],
      state: "New",
      pinned: false,
      sourceIds: ["src-sos-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-sos-3",
      title: "Why Gen Z marketers are leaving the funnel framework behind",
      body: "A hook framed around generational shifts the report names but doesn't unpack — leave the reader wanting the follow-up.",
      kind: "hook",
      tags: ["audience", "gen-z"],
      used: 0,
      ref: "p. 22 · State of Social 2026",
      rationale: "Generational angle drives shares — works as a thread opener or a single-line LinkedIn hook.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 73,
      channels: ["linkedin", "x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-sos-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-sos-4",
      title: "Three numbers from the 2026 report that flipped my Q3 plan",
      body: "A short-form retrospective listing three counter-intuitive findings from the report and what I changed.",
      kind: "story",
      tags: ["retro", "planning"],
      used: 0,
      ref: "Generated · synthesis",
      rationale: "Operator retros built on industry data perform well — concrete, specific, easy to disagree with.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 70,
      channels: ["linkedin"],
      state: "New",
      pinned: false,
      sourceIds: ["src-sos-1"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-sos-5",
      title: '"Posting more is not strategy — it never was."',
      body: '"Posting more is not strategy — it never was. Picking the right beat is."',
      kind: "quote",
      tags: ["positioning", "verbatim"],
      used: 1,
      ref: "06:24 · social trends keynote",
      rationale: "Strong quotable for thought-leadership posts. Works as the close of a longer breakdown.",
      relevance: "High relevance",
      relevanceColor: "orange",
      confidence: 88,
      channels: ["linkedin", "x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-sos-2"],
      extractedAt: "2d ago",
    },
    {
      id: "idea-sos-6",
      title: "The one founder story we won't tell (and why)",
      body: "A meta-post about editorial restraint — when not posting is itself the brand move.",
      kind: "hook",
      tags: ["meta", "editorial"],
      used: 0,
      ref: "23:18 · social trends keynote",
      rationale:
        "Meta-post about judgement, not the story itself. Niche but memorable for founders in similar positions.",
      relevance: "Low relevance",
      relevanceColor: "grey",
      confidence: 54,
      channels: ["x"],
      state: "New",
      pinned: false,
      sourceIds: ["src-sos-2"],
      extractedAt: "2d ago",
    },
  ],
  "s-weekly-recap": [
    {
      id: "idea-weekly-1",
      title: "What week 12 told us about Tuesday vs Thursday",
      body: "Engagement split this week ran 2.3× higher on Tuesday morning than Thursday afternoon — same length, same author.",
      kind: "stat",
      tags: ["timing", "engagement"],
      used: 1,
      ref: "p. 2 · analytics-week-12",
      rationale: "Day-of-week stats are the kind of thing social managers test for themselves — invites engagement.",
      relevance: "Medium relevance",
      relevanceColor: "tagOrange",
      confidence: 74,
      channels: ["linkedin"],
      state: "New",
      pinned: false,
      sourceIds: ["src-weekly-1"],
      extractedAt: "5d ago",
    },
    {
      id: "idea-weekly-2",
      title: "The post we almost skipped that pulled the week",
      body: "A short retro about the post we nearly didn't publish — and the reach numbers that came out of it.",
      kind: "story",
      tags: ["retro", "weekly"],
      used: 0,
      ref: "p. 5 · analytics-week-12",
      rationale: "Near-miss stories add credibility — readers reward operators who admit to the close calls.",
      relevance: "Low relevance",
      relevanceColor: "grey",
      confidence: 62,
      channels: ["linkedin"],
      state: "New",
      pinned: false,
      sourceIds: ["src-weekly-1"],
      extractedAt: "5d ago",
    },
  ],
};

// Flat union — kept for legacy consumers that read a single global pool
// (assistant.js reasoning text, right-panel.js Ideas tab). Stays mutable
// so library.js dual-write (`injectIdeasForSource` → seedIdeas.unshift)
// continues to land here.
// ---- Contexts --------------------------------------------------------------
//
// A *context* is a named bundle that can hold Voice, Brief and Brand
// components. A session attaches at most ONE context. Components are
// optional — a context may have only voice, for instance.

// Component samples (reused inside contexts + by the stage wizards).

export const voiceAnalysis = {
  sections: [
    {
      id: "hooks",
      title: "Opening Hooks",
      bullets: [
        "Cold-open with a contrarian claim, then immediately soften with a personal story.",
        "Never start with a question — always a statement the reader can disagree with.",
      ],
    },
    {
      id: "closing",
      title: "Closing Patterns",
      bullets: [
        "Close with a one-line callback to the opening claim, rarely with a CTA.",
        "Avoid the word 'takeaway'. Leave the reader to name it themselves.",
      ],
    },
    {
      id: "rhythm",
      title: "Formatting Rhythm",
      bullets: [
        "Short sentence, short sentence, longer sentence that earns it.",
        "Line breaks carry weight — never fill them with filler words.",
      ],
    },
    {
      id: "style",
      title: "Visual Style",
      bullets: [
        "No emojis. No bullets except under a header.",
        "Bold a maximum of one phrase per post, and only when it's the thesis.",
      ],
    },
    {
      id: "soul",
      title: "Soul",
      bullets: [
        "Trust the reader to be smart. Don't explain the joke.",
        "If the post can be read aloud without sounding like a brand, it passes.",
      ],
    },
    {
      id: "verbatim",
      title: "Verbatim Examples",
      bullets: [
        '"We didn\'t ship the thing. We shipped a version of the thing that we could live with."',
        '"Quarterly OKRs are a retrospective tool wearing a planning costume."',
      ],
    },
    {
      id: "metadata",
      title: "Metadata",
      bullets: ["Average post length: 85 words.", "Posts per week analyzed: 14."],
    },
  ],
};

export const strategyBrief = {
  sections: [
    {
      id: "goals",
      title: "Goals",
      fields: [
        { label: "Primary objective", value: "Establish the founder as a credible voice on product discipline." },
        { label: "Target action", value: "Inbound intros from operators at 50–200-person startups." },
      ],
    },
    {
      id: "audience",
      title: "Audience",
      fields: [
        {
          label: "Target demographic",
          value: "Product leaders, 5–15 years in, operator-track rather than investor-track.",
        },
        {
          label: "Pain points",
          value: "Team is shipping, but no one outside the company can tell what the strategy is.",
        },
      ],
    },
    {
      id: "voice",
      title: "Brand Voice",
      fields: [
        { label: "Tone", value: "Candid, specific, allergic to LinkedIn platitudes." },
        { label: "Style", value: "Short paragraphs, no emojis, one thesis per post." },
      ],
    },
  ],
};

export const brandTheme = {
  url: "https://acme.com",
  colors: [
    { name: "Primary", hex: "#FF6726" },
    { name: "Surface", hex: "#F9F9FA" },
    { name: "Ink", hex: "#212E44" },
    { name: "Accent", hex: "#178DFE" },
  ],
  imageryNotes: [
    "Studio-lit product photography, shallow depth of field.",
    "Never stock imagery. Never AI-generated faces.",
  ],
  buttons: [
    { label: "Get started", variant: "primary" },
    { label: "Learn more", variant: "secondary" },
  ],
  personality: ["Candid", "Precise", "Warm", "Operator-first", "No-nonsense"],
};

// Named contexts — whole bundles. Sessions attach one of these by id.
//
// Q2 hybrid Context model — the editable fields surfaced in the Contexts
// view + drawer (color / isDefault / brandName / audience / briefSummary /
// tones / doRules / dontRules / cta / usedIn / updatedAt) sit at the top
// level. The rich analytical sub-objects (voice / brief / brand) move
// under `analysis` — read-only, surfaced in the Context tab as
// "Voice analysis / Strategy brief / Brand theme" once Archie has
// processed source material.
//
// Old call sites that read `context.voice` / `context.brief` /
// `context.brand` keep working through accessor helpers below. New
// surfaces (Lot 8 Contexts page, drawer, ContextCard) read the flat
// fields directly.

// The logo variants Archie finds on a brand's site: the header lockup, the
// reversed one from the footer, the square icon, the favicon. Shared between the
// Playbooks of the same brand (Acme has two) so a variant added here shows up on
// both, the way it would if both had been scraped from the same site.
//
// The reversed lockup carries its own dark plate INSIDE the SVG. That's how a
// brand kit presents it, and it's also the only way it survives being shown on a
// white thumbnail tile — a white-on-transparent mark would render as an empty box.
const ACME_LOGOS = [
  { id: "acme-logo", label: "Logo", url: "assets/logos/brands/acme.svg" },
  { id: "acme-logo-reverse", label: "Reversed", url: "assets/logos/brands/acme-reverse.svg" },
  { id: "acme-logo-icon", label: "Icon", url: "assets/logos/brands/acme-icon.svg" },
  { id: "acme-logo-favicon", label: "Favicon", url: "assets/logos/brands/acme-favicon.svg" },
];

const PAWTRACK_LOGOS = [
  { id: "pawtrack-logo", label: "Logo", url: "assets/logos/brands/pawtrack.svg" },
  { id: "pawtrack-logo-reverse", label: "Reversed", url: "assets/logos/brands/pawtrack-reverse.svg" },
  { id: "pawtrack-logo-icon", label: "Icon", url: "assets/logos/brands/pawtrack-icon.svg" },
  { id: "pawtrack-logo-favicon", label: "Favicon", url: "assets/logos/brands/pawtrack-favicon.svg" },
];

export const contexts = [
  {
    id: "ctx-acme",
    name: "Acme · Q2 marketing",
    color: "orange",
    isDefault: true,
    ownerId: "u-me",
    // Mine, and I put it in front of the whole org — the state a Playbook lands
    // in after the Share modal says "My organisation".
    scope: "organization",
    brandName: "Acme",
    brandLogos: ACME_LOGOS.map((l) => ({ ...l })),
    brandLogo: "assets/logos/brands/acme.svg",
    websiteUrl: "https://acme.example.com",
    audience: ["Operators and marketing leads at 50–200-person B2B startups"],
    businessSummary:
      "Drive awareness for Acme's Q2 launch. Lead with concrete time savings + customer outcomes, not feature lists.",
    briefSummary:
      "Drive awareness for Acme's Q2 launch. Lead with concrete time savings + customer outcomes, not feature lists.",
    tones: ["Direct", "Operator-first"],
    voiceProfile: {
      headline: "Direct · operator-first · specific",
      writingStyle:
        "Direct, hook-first, and benefit-led. Every sentence has to earn its place: cut the throat-clearing, lead with the outcome, back it with a number or a quote.",
      vocabulary:
        "Plain operator language — 'time saved', 'shipped', 'closed', 'pipeline'. Avoid corporate jargon ('synergy', 'leverage', '10x') and feature-shaped marketing words ('robust', 'powerful', 'cutting-edge').",
      sentenceStructure:
        "Short to medium sentences. Often opens on a number or a contrarian beat. Lists when there are three or more parallel points; otherwise prose.",
      formality:
        "Semi-formal. Always 'we' and 'you' — never the third person. Contractions are fine. The tone matches a smart Slack message, not a press release.",
      personality:
        "Confident without bragging. Helpful without performing. Speaks the way operators actually talk to each other — direct, specific, occasionally dry.",
      rhetoricalDevices:
        "Open with a hook or specific number. Use before / after contrasts. End every post with a clear next step. No 'stay tuned' cliffhangers.",
      emotionalTone: "Steady and confident. Acknowledges the messy reality of B2B without complaining about it.",
      contentPatterns:
        "Hook → context → concrete result → call to action. Most posts top out around 90 words and resolve in a single idea.",
      uniqueTraits:
        "No emoji in B2B contexts. Customer outcomes always sit ahead of feature names. Numbers are real, sourced, and rounded honestly (not '99.999%').",
    },
    contentStyle: ["Direct and actionable", "Data-driven with storytelling"],
    objective: ["Brand awareness", "Lead generation"],
    contentAction: ["Sign up for a free trial", "Book a demo"],
    signatureHooks: [
      "Most teams get this backwards:",
      "Here's what actually moved the needle:",
      "We cut [task] from days to minutes —",
    ],
    closingPatterns: ["Try it free for 30 days — link in the comments.", "What's your take? Reply and tell me."],
    formattingStyle:
      "Short paragraphs, one idea each. Opens on a hook line, then 2–3 lines of context. A tight three-item list when points are parallel, prose otherwise. Generous line breaks — no walls of text. Most posts top out around 90 words.",
    visualStyle:
      "No emoji. Sentence case throughout — no ALL-CAPS shouting. Numbers as digits ('3x', '40%'). One link, dropped in the first comment, never mid-sentence.",
    brandPersonality:
      "Confident without bragging, helpful without performing. Speaks the way operators talk to each other — direct, specific, occasionally dry. Never hypey.",
    brandTypography: { headingFont: "Inter", bodyFont: "Inter" },
    brandColors: [
      { name: "Primary", hex: "#1A1F36" },
      { name: "Secondary", hex: "#3B4A6B" },
      { name: "Accent", hex: "#FF6726" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#1A1F36" },
    ],
    // Brand reference images (#11) — the visual references the Image Studio
    // pulls in so generated imagery stays on-brand.
    referenceImages: [
      {
        id: "acme-ref-1",
        label: "Product UI",
        url: "https://picsum.photos/seed/acme-brand-ui/480/480",
        note: "Use for feature launches & how-to posts. Keep the real UI — don't mock up fake screens or crop the logo.",
        networks: ["linkedin", "x"],
      },
      {
        id: "acme-ref-2",
        label: "Team candid",
        url: "https://picsum.photos/seed/acme-brand-team/480/480",
        note: "Great for culture & hiring content. Don't over-retouch — keep it authentic.",
        networks: ["instagram", "facebook"],
      },
      { id: "acme-ref-3", label: "Brand board", url: "https://picsum.photos/seed/acme-brand-board/480/480" },
    ],
    // Competitors — the market Archie positions this brand against. `suggested`
    // marks the ones Archie discovered (vs. added by hand). Logos resolve from
    // the domain at render time, so no url is stored here.
    competitors: [
      {
        id: "acme-cmp-1",
        name: "Notion",
        description:
          "The all-in-one workspace everyone already has a tab open for. Wins on flexibility, loses on opinionated workflows.",
        websiteUrl: "https://notion.so",
        socials: [
          { network: "linkedin", url: "https://linkedin.com/company/notionhq" },
          { network: "x", url: "https://x.com/NotionHQ" },
          { network: "youtube", url: "https://youtube.com/@Notion" },
        ],
        suggested: true,
      },
      {
        id: "acme-cmp-2",
        name: "Linear",
        description:
          "Beloved by engineering teams for speed and craft. Comes up whenever a prospect cares about issue tracking first.",
        websiteUrl: "https://linear.app",
        socials: [{ network: "x", url: "https://x.com/linear" }],
        suggested: true,
      },
      {
        id: "acme-cmp-3",
        name: "Basecamp",
        description:
          "The opinionated veteran. Flat pricing and a strong point of view on how teams should work — a values-led alternative.",
        websiteUrl: "https://basecamp.com",
        socials: [
          { network: "x", url: "https://x.com/basecamp" },
          { network: "linkedin", url: "https://linkedin.com/company/basecamp" },
        ],
      },
    ],
    ctaLinks: [
      { label: "30-day free trial", url: "acme.example.com/trial", checked: true, suggested: false },
      { label: "Book a demo", url: "acme.example.com/demo", checked: true, suggested: false },
    ],
    // Multilingual Playbook — the flat signatureHooks/closingPatterns/cta above
    // mirror the primary (English) entry. Voice examples are authored PER
    // LANGUAGE; Archie selects the native set, never translates.
    languages: ["English", "Français"],
    primaryLanguage: "English",
    voiceByLanguage: {
      English: {
        signatureHooks: [
          "Most teams get this backwards:",
          "Here's what actually moved the needle:",
          "We cut [task] from days to minutes —",
        ],
        closingPatterns: ["Try it free for 30 days — link in the comments.", "What's your take? Reply and tell me."],
        cta: "Try Acme free for 30 days.",
        ctaLabels: {
          "acme.example.com/trial": "30-day free trial",
          "acme.example.com/demo": "Book a demo",
        },
      },
      Français: {
        signatureHooks: [
          "La plupart des équipes s'y prennent à l'envers :",
          "Voici ce qui a vraiment fait bouger les choses :",
          "On a réduit [tâche] de plusieurs jours à quelques minutes —",
        ],
        closingPatterns: [
          "Essayez gratuitement pendant 30 jours — lien en commentaire.",
          "Votre avis ? Répondez et dites-moi.",
        ],
        cta: "Essayez Acme gratuitement pendant 30 jours.",
        ctaLabels: {
          "acme.example.com/trial": "Essai gratuit de 30 jours",
          "acme.example.com/demo": "Réserver une démo",
        },
      },
    },
    language: "English",
    imageVoice: {
      websites: [
        {
          domain: "acme.example.com",
          url: "https://acme.example.com",
          colors: {
            primary: "#1A1F36",
            accent: "#FF6726",
            background: "#FFFFFF",
            textPrimary: "#1A1F36",
            link: "#FF6726",
          },
          typography: {
            primaryFont: "Inter",
            headingFont: "Inter",
            h1Size: "48px",
            h2Size: "24px",
            bodySize: "16px",
            fontStack: ["Inter", "system-ui", "sans-serif"],
          },
          images: {
            logo: { label: "Logo", url: "" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
          },
          buttons: {
            primary: { bg: "#FF6726", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#1A1F36", border: "#1A1F36", label: "Secondary" },
          },
          personality: {
            tone: "operator-first",
            energy: "medium-high",
            audience: "B2B startup operators",
          },
        },
      ],
    },
    doRules: [
      'Use "we" and "you" — never third person',
      "Open with a hook or specific number",
      "End every post with a clear next step",
    ],
    dontRules: ["No emoji in B2B contexts", 'Avoid jargon: "synergy", "leverage", "10x"'],
    cta: "Try Acme free for 30 days.",
    usedIn: 4,
    updatedAt: "3 minutes ago",
    analysis: {
      voice: voiceAnalysis,
      brief: strategyBrief,
      brand: brandTheme,
    },
  },
  {
    id: "ctx-founder-voice",
    name: "Founder voice only",
    color: "blue",
    isDefault: false,
    ownerId: "u-me",
    scope: "personal",
    brandName: "Jamie Torres · Personal",
    websiteUrl: "",
    audience: ["B2B founders and product leaders thinking about how teams ship"],
    businessSummary:
      "Build trust over time with sharp opinions, lived experience, zero promotional content. Posts should make readers re-examine an assumption.",
    briefSummary:
      "Build trust over time with sharp opinions, lived experience, zero promotional content. Posts should make readers re-examine an assumption.",
    tones: ["Direct", "Conversational"],
    voiceProfile: {
      headline: "Direct · conversational · opinionated",
      writingStyle:
        "Conversational and pointed. Reads like a strong founder DM — sharp opinion up front, lived context behind it, no marketing varnish.",
      vocabulary:
        "Plain English, occasional technical terms used precisely. Avoids growth-speak ('community', 'movement') and the LinkedIn cliché vocabulary ('grateful', 'humbled', 'thrilled').",
      sentenceStructure:
        "Short. Sometimes a single line. Occasional longer sentences when explaining a counter-intuitive idea, but never paragraphs of throat-clearing.",
      formality:
        "Informal. First person ('I', 'we'), contractions, the occasional cuss kept in if it's the right word.",
      personality:
        "Opinionated, generous with credit, willing to be wrong out loud. Speaks from scar tissue, not theory.",
      rhetoricalDevices:
        "Contrarian take or a specific moment up top. Often a single surprising data point. Resolves on a reframe rather than a CTA.",
      emotionalTone:
        "Engaged and a bit impatient. Readers should feel pulled forward and slightly challenged, never sold to.",
      contentPatterns:
        "Hook (contrarian or anecdote) → context → reframe. One idea per post. Length is whatever the idea needs; usually short.",
      uniqueTraits:
        "No CTAs, no links, no product mentions. No hashtags. The byline is the brand — the audience follows the human, not a logo.",
    },
    contentStyle: ["Direct and actionable"],
    objective: ["Build personal brand", "Brand awareness"],
    contentAction: ["Read more on the blog"],
    signatureHooks: [
      "Unpopular opinion:",
      "I used to believe [X]. I was wrong.",
      "Nobody tells you this when you start:",
    ],
    closingPatterns: [
      "Curious if it's just me — or you've seen it too.",
      "Still figuring this out. Tell me where I'm wrong.",
    ],
    formattingStyle:
      "Very short. Often a single line that lands. The occasional longer sentence to explain a counter-intuitive idea. Heavy line breaks for rhythm. No lists, no headers — reads like a thought, not a doc.",
    visualStyle:
      "No emoji, no hashtags. A lowercase opening is fine when it suits the cadence. First person always ('I', 'we'). Zero links or product mentions.",
    brandPersonality:
      "Opinionated, generous with credit, willing to be wrong out loud. Speaks from scar tissue, not theory. The human is the brand — readers follow the person, not a logo.",
    brandTypography: { headingFont: "System UI", bodyFont: "System UI" },
    brandColors: [
      { name: "Primary", hex: "#178DFE" },
      { name: "Accent", hex: "#178DFE" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#1A1F36" },
    ],
    ctaLinks: [],
    language: "English",
    imageVoice: {
      websites: [
        {
          domain: "",
          url: "",
          colors: {
            primary: "#178DFE",
            accent: "#178DFE",
            background: "#FFFFFF",
            textPrimary: "#1A1F36",
            link: "#178DFE",
          },
          typography: {
            primaryFont: "System UI",
            headingFont: "System UI",
            h1Size: "44px",
            h2Size: "22px",
            bodySize: "16px",
            fontStack: ["System UI", "Inter", "sans-serif"],
          },
          images: {
            logo: { label: "Logo", url: "" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
          },
          buttons: {
            primary: { bg: "#178DFE", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#178DFE", border: "#178DFE", label: "Secondary" },
          },
          personality: {
            tone: "direct",
            energy: "calm",
            audience: "founders & product leaders",
          },
        },
      ],
    },
    doRules: [
      "Start with a contrarian take or a moment, not a stat",
      "Write like you talk — short sentences, real verbs",
      "One idea per post",
    ],
    dontRules: ["No CTAs, no links, no product mentions", "No hashtags"],
    cta: "",
    usedIn: 1,
    updatedAt: "yesterday",
    analysis: {
      voice: voiceAnalysis,
      brief: null,
      brand: null,
    },
  },
  {
    id: "ctx-customer",
    name: "Customer stories",
    color: "green",
    isDefault: false,
    ownerId: "u-me",
    scope: "personal",
    brandName: "Acme",
    brandLogos: ACME_LOGOS.map((l) => ({ ...l })),
    brandLogo: "assets/logos/brands/acme.svg",
    websiteUrl: "https://acme.example.com/customers",
    audience: ["Prospects evaluating Acme who care about real outcomes from teams like theirs"],
    businessSummary:
      "Turn customer interviews into evidence-led posts. Lead with the team's situation, the change they made, and the measurable result. Quote them directly.",
    briefSummary:
      "Turn customer interviews into evidence-led posts. Lead with the team's situation, the change they made, and the measurable result. Quote them directly.",
    tones: ["Professional", "Conversational"],
    voiceProfile: {
      headline: "Professional · evidence-led · honest",
      writingStyle:
        "Story-shaped and grounded in fact. Each post follows a specific team's arc — situation, change, result — and lets their voice carry it.",
      vocabulary:
        "Industry-neutral. Customer's own words for their problem and outcome; Acme's words stay out of the quote. Avoid marketing words ('transformed', 'revolutionised') in favour of measurable verbs.",
      sentenceStructure:
        "Medium-length sentences. A short opening line for the hook, then 2–3 sentences of context, a quote, and a closing line that names the result.",
      formality:
        "Professional but warm. Always names the customer and their role. 'They' for the team, 'we' only when speaking about Acme's role in the story.",
      personality:
        "Trustworthy, attentive, occasionally surprised on the customer's behalf. Lets the customer be the hero.",
      rhetoricalDevices:
        "Direct quotes — never paraphrased. Before / after metrics. Specific names of teams and tools.",
      emotionalTone: "Genuine and slightly understated. Lets the numbers and the human carry the emotion.",
      contentPatterns: "Situation → change → result, with a quote anchoring the change. One customer per post.",
      uniqueTraits:
        'No generic testimonials ("game changer", "love this"). No paraphrasing. No "stay tuned" cliffhangers — every story resolves.',
    },
    contentStyle: ["Data-driven with storytelling"],
    objective: ["Brand awareness", "Lead generation"],
    contentAction: ["Read the full customer story", "Book a demo"],
    signatureHooks: ["When [Team] started, they were [problem].", "Here's what changed for [Customer]:"],
    closingPatterns: ["See how teams like yours use Acme →", "Their words, not ours."],
    formattingStyle:
      "Story-shaped: a short hook line, 2–3 sentences of context, a pulled quote on its own line, then a closing line that names the result. Medium-length sentences. The quote is always set apart.",
    visualStyle:
      "No emoji. Names the customer and their role in full. Metrics as digits ('cut response time 60%'). One quote per post, verbatim — never paraphrased.",
    brandPersonality:
      "Trustworthy, attentive, occasionally surprised on the customer's behalf. Lets the customer be the hero and the numbers carry the emotion.",
    brandTypography: { headingFont: "Inter", bodyFont: "Inter" },
    brandColors: [
      { name: "Primary", hex: "#1A6E3F" },
      { name: "Accent", hex: "#34A65F" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#1A1F36" },
    ],
    ctaLinks: [
      {
        label: "See how teams like yours use Acme",
        url: "acme.example.com/customers",
        checked: true,
        suggested: false,
      },
      { label: "Book a demo", url: "acme.example.com/demo", checked: true, suggested: false },
    ],
    language: "English",
    imageVoice: {
      websites: [
        {
          domain: "acme.example.com",
          url: "https://acme.example.com/customers",
          colors: {
            primary: "#1A6E3F",
            accent: "#34A65F",
            background: "#FFFFFF",
            textPrimary: "#1A1F36",
            link: "#1A6E3F",
          },
          typography: {
            primaryFont: "Inter",
            headingFont: "Inter",
            h1Size: "44px",
            h2Size: "22px",
            bodySize: "16px",
            fontStack: ["Inter", "system-ui", "sans-serif"],
          },
          images: {
            logo: { label: "Logo", url: "" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
          },
          buttons: {
            primary: { bg: "#1A6E3F", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#1A6E3F", border: "#1A6E3F", label: "Secondary" },
          },
          personality: {
            tone: "evidence-led",
            energy: "calm",
            audience: "B2B buyers in evaluation",
          },
        },
      ],
    },
    doRules: [
      "Always name the customer and their role",
      "Pull one direct quote per post",
      "Include a specific metric or before/after",
    ],
    dontRules: [
      'No generic testimonials ("game changer", "love this")',
      "Don't paraphrase — quote them",
      'No "stay tuned" cliffhangers',
    ],
    cta: "See how teams like yours use Acme →",
    usedIn: 0,
    updatedAt: "2 days ago",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
  },
  // A consumer brand, deliberately unlike the three B2B Playbooks above: it
  // gives the Topics feed a market where listening has something vivid to say
  // (a crowded hardware category whose buyers talk in feelings, not specs), and
  // its competitors are the real names the seeded dossiers cite.
  {
    id: "ctx-pawtrack",
    name: "Pawtrack · always-on",
    color: "purple",
    isDefault: false,
    ownerId: "u-me",
    scope: "personal",
    brandName: "Pawtrack",
    brandLogos: PAWTRACK_LOGOS.map((l) => ({ ...l })),
    brandLogo: "assets/logos/brands/pawtrack.svg",
    websiteUrl: "https://pawtrack.example.com",
    audience: ["Dog and cat owners who have already had one scare and never want another"],
    businessSummary:
      "Sell the Pawtrack collar on relief, not on radios. Owners don't buy LTE-M and IP68 — they buy knowing where their animal is at 2am. Lead with the moment the tracker mattered.",
    briefSummary:
      "Sell the Pawtrack collar on relief, not on radios. Owners don't buy LTE-M and IP68 — they buy knowing where their animal is at 2am. Lead with the moment the tracker mattered.",
    tones: ["Warm", "Reassuring"],
    voiceProfile: {
      headline: "Warm · plain-spoken · never alarmist",
      writingStyle:
        "Story-first and close to the ground. Opens on a real moment — a gate left open, a cat that didn't come in — then says what happened next. Specs appear only once they've earned it, and always in service of the moment.",
      vocabulary:
        "The words owners use: 'she got out', 'he bolted', 'found her'. Never 'asset', 'device', 'solution' or 'pet parent'. Coverage and range are described as what they let you do, not as numbers.",
      sentenceStructure:
        "Short sentences. One idea each. The turn in the story gets its own line. Lists only for practical instructions, never for features.",
      formality:
        "Informal but never cute. 'You' and 'your dog', never the third person. Contractions throughout. Reads like a message from someone who's been there.",
      personality:
        "Steady and kind. Takes the fear seriously without dramatising it, and never implies the owner was careless.",
      rhetoricalDevices:
        "Open on the moment, not the product. Before / after in time, not in metrics. Resolve every story — the animal always comes home in ours, and we don't post the ones that don't.",
      emotionalTone: "Relief, mostly. Warm, a little wry about animals being animals. Never panic-selling.",
      contentPatterns:
        "Moment → what we did → how it ended → the one thing that made it possible. Around 80 words, one animal per post.",
      uniqueTraits:
        "Names the animal, always. Real owner photos over studio product shots. No fear-based statistics about lost pets — the story carries the stakes on its own.",
    },
    contentStyle: ["Story-driven", "Warm and human"],
    objective: ["Brand awareness", "Community building"],
    contentAction: ["Shop the collar", "Read owner stories"],
    signatureHooks: [
      "She was gone eleven minutes.",
      "The gate was open. Nobody knows how long.",
      "Here's the part nobody tells you about a cat that goes out:",
    ],
    closingPatterns: ["Home in forty minutes. That's the whole point.", "Tell us about yours — we read all of them."],
    formattingStyle:
      "Opens on a one-line moment. Two or three short paragraphs, a single idea each. The turn in the story sits on its own line. Around 80 words. Emoji sparingly, and only ones an owner would actually use.",
    visualStyle:
      "Real owner photos, daylight, animals mid-motion — never a studio product shot as the hero. Sentence case. Distances in the local unit ('6km from camp'). The collar visible but not centred.",
    brandPersonality:
      "Steady and kind. Takes the fear seriously without dramatising it, is a little wry about animals being animals, and never makes an owner feel careless.",
    brandTypography: { headingFont: "Poppins", bodyFont: "Inter" },
    brandColors: [
      { name: "Primary", hex: "#2F1B54" },
      { name: "Accent", hex: "#7C4DFF" },
      { name: "Warm", hex: "#FFB86B" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#241537" },
    ],
    referenceImages: [
      {
        id: "pawtrack-ref-1",
        label: "Owner + dog, daylight",
        url: "https://picsum.photos/seed/pawtrack-owner-dog/480/480",
        note: "The default hero for reunion stories. Real light, animal mid-motion, collar visible but not the subject.",
        networks: ["instagram", "facebook"],
      },
      {
        id: "pawtrack-ref-2",
        label: "Collar detail",
        url: "https://picsum.photos/seed/pawtrack-collar/480/480",
        note: "Only for posts that genuinely need the hardware. Never the lead image on a story post.",
        networks: ["instagram"],
      },
    ],
    competitors: [
      {
        id: "pawtrack-cmp-1",
        name: "Fi",
        description:
          "The design-led challenger. Leads on module specs and battery, and owns the running-club end of the market.",
        websiteUrl: "https://tryfi.com",
        socials: [
          { network: "instagram", url: "https://instagram.com/fi.collars" },
          { network: "facebook", url: "https://facebook.com/tryfi" },
        ],
      },
      {
        id: "pawtrack-cmp-2",
        name: "Whistle",
        description:
          "The incumbent with retail shelf space. Bundles health monitoring, and speaks to vets as much as to owners.",
        websiteUrl: "https://whistle.com",
        socials: [
          { network: "facebook", url: "https://facebook.com/whistle" },
          { network: "instagram", url: "https://instagram.com/whistle" },
        ],
      },
      {
        id: "pawtrack-cmp-3",
        name: "Jiobit",
        description:
          "Smallest tracker in the category, sold on being unnoticeable. Strong with cats and small breeds, priced high.",
        websiteUrl: "https://jiobit.com",
        socials: [{ network: "instagram", url: "https://instagram.com/jiobit" }],
      },
      {
        id: "pawtrack-cmp-4",
        name: "Tractive",
        description:
          "The volume player in Europe. Unlimited range on a cheap subscription, and by far the best at owner stories.",
        websiteUrl: "https://tractive.com",
        socials: [
          { network: "instagram", url: "https://instagram.com/tractive" },
          { network: "tiktok", url: "https://tiktok.com/@tractive" },
        ],
        suggested: true,
      },
      {
        id: "pawtrack-cmp-5",
        name: "Garmin",
        description:
          "Comes from hunting-dog GPS, not from pets. Wins on range and durability, loses on anything a city owner cares about.",
        websiteUrl: "https://garmin.com",
        socials: [{ network: "youtube", url: "https://youtube.com/@garmin" }],
        suggested: true,
      },
    ],
    ctaLinks: [
      { label: "Shop the collar", url: "pawtrack.example.com/shop", checked: true, suggested: false },
      { label: "Read owner stories", url: "pawtrack.example.com/stories", checked: true, suggested: false },
    ],
    language: "English",
    imageVoice: {
      websites: [
        {
          domain: "pawtrack.example.com",
          url: "https://pawtrack.example.com",
          colors: {
            primary: "#2F1B54",
            accent: "#7C4DFF",
            background: "#FFFFFF",
            textPrimary: "#241537",
            link: "#7C4DFF",
          },
          typography: {
            primaryFont: "Inter",
            headingFont: "Poppins",
            h1Size: "52px",
            h2Size: "26px",
            bodySize: "17px",
            fontStack: ["Inter", "system-ui", "sans-serif"],
          },
          images: {
            logo: { label: "Logo", url: "" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
          },
          buttons: {
            primary: { bg: "#7C4DFF", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#2F1B54", border: "#2F1B54", label: "Secondary" },
          },
          personality: {
            tone: "warm",
            energy: "calm",
            audience: "dog and cat owners",
          },
        },
      ],
    },
    doRules: ["Name the animal, always", "Open on the moment, not the product", "Resolve the story — say how it ended"],
    dontRules: [
      "No fear statistics about lost pets",
      'Never say "pet parent"',
      "No studio product shot as the hero image",
    ],
    cta: "Home in forty minutes. That's the whole point.",
    usedIn: 2,
    updatedAt: "yesterday",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
  },
  // -- FOUR REAL-BRAND PLAYBOOKS, from actual listening exports --------------
  // Ported from the fork (axel-van/rebel-racoon, src/mocks.js) so the Topic Feed
  // can be judged on real prose instead of on invented topics. These four were
  // built from real website analyses and real 30-day listening scans; the Acme
  // and founder-voice Playbooks above are authored for this prototype.
  //
  // Three fork fields are dropped on the way in: "topics" (the listening config,
  // which lives in topic-feeds-store here - CONCEPTS.md section 1), plus
  // "strategy" and "influencers", which have no surface in this repo.
  {
    id: "ctx-alliance-bjj",
    name: "Alliance Jiu Jitsu Carlsbad",
    color: "red",
    isDefault: false,
    brandName: "Alliance Jiu Jitsu Carlsbad",
    brandLogo: null,
    websiteUrl: "https://alliancecarlsbad.com/",
    audience: [
      "Active Carlsbad parents weighing martial arts for a child, and wary of programs that make kids aggressive",
      "Busy professionals and former practitioners returning to the mats after a multi-year break",
      "Women who want self-defence without walking into a room of experienced men — the academy runs a women-only program",
      "Teens and competitors who want structured progression under an Alliance black belt, not just open mats",
    ],
    businessSummary:
      "Win on coaching quality and a safety-first mat culture, not on trophies. Open since 2017 on Roosevelt St and affiliated to Alliance — the team founded by Romero 'Jacaré' Cavalcanti, Fábio Gurgel and Alexandre Paiva — with programs split by who you are rather than by belt: adults, teens, kids, women, competition team, plus no-gi, boxing and yoga. The front door is a complimentary 30-minute one-on-one introduction followed by a free trial period. Local competitors are loud about youth programs, belt promotions and community events; the opening is to explain what those milestones actually build — self-control, problem-solving, resilience — for parents and adults who want capability without aggression.",
    briefSummary:
      "Win on coaching quality and a safety-first mat culture, not on trophies. Local competitors are loud about youth programs, belt promotions and community events; the opening is to explain what those milestones actually build.",
    tones: ["Reassuring", "Expert"],
    voiceProfile: {
      headline: "Calm · expert · safety-first",
      writingStyle:
        "Answers a parent's real hesitation before selling anything. Explains the mechanism — why grappling teaches control rather than aggression — then lets the conclusion follow. Long-form and patient; never hypes competition results.",
      vocabulary:
        "Character development, self-control, problem-solving, structured progression, safety-first. The site's own recurring words are worth keeping: purpose, control, respect, structure, confidence, community, 'leave ego at the door'. Never 'dominate', 'destroy', 'killer instinct', or anything that frames training as fighting.",
      sentenceStructure:
        "Short declaratives, often in pairs — a two-word imperative followed by what it gets you ('Train smarter. Build real skill, strength, and confidence—both on and off the mats.'). One claim per sentence, and the claim names something checkable: a program, an age range, a coach, a class time.",
      formality:
        "Plain and direct. Second person throughout ('you or your child'), contractions allowed, no slang and no exclamation marks. Reads like a coach talking to a parent at the door, not like an ad.",
      personality:
        "Assured and unhurried. Confident enough to describe the room honestly — clean mats, beginners welcome, everyone trains with control — instead of claiming to be the best.",
      rhetoricalDevices:
        "Contrast the milestone with what it builds. Name the hesitation first, answer it second. Member and parent quotes as proof, since the strongest existing material on the site is testimonials about the coaches.",
      emotionalTone:
        "Reassuring. The reader is usually nervous — for themselves or for their kid — and the job of the first three lines is to make the room feel safe and legible.",
      contentPatterns:
        "Hesitation → mechanism → what it builds → an invitation with no pressure. Around 80–120 words. One audience per post; never write to parents and competitors in the same caption.",
      uniqueTraits:
        "Sorts everything by who it's for — adults, teens, kids, women, competition team — the way the site's own program menu does. Names the coach when the post is about instruction. States the offer precisely rather than saying 'free trial': a 30-minute one-on-one intro first, then the trial.",
      examples: [],
    },
    contentStyle: ["Educational", "Long-form"],
    objective: ["Brand awareness", "Lead generation"],
    contentAction: ["Book a free intro class", "View the class schedule"],
    signatureHooks: [
      "Train Hard. Stay Humble.",
      "Train with Purpose. Belong to Something Bigger.",
      "Confidence for kids. Discipline for teens. Growth for adults.",
      "No ego, no intimidation.",
      "When something goes wrong, there's always another move to progress.",
    ],
    closingPatterns: [
      "Schedule your free introduction.",
      "Come train with us.",
      "No pressure — just a chance to train.",
    ],
    formattingStyle:
      "Opens on the hesitation or the person, never on the academy. Two or three short lines, one idea each, with the em dash used to attach the payoff to the imperative. Names the audience explicitly. Closes on the free intro with no urgency language. At most one emoji, and no emoji strings or arrow stacks in long-form copy.",
    visualStyle:
      "Black backgrounds, one accent — the Alliance yellow — and nothing else. Condensed uppercase headings over light body text. Square edges: the site's buttons carry no radius. Photography is on the mats, in the gi, mid-instruction rather than posed; kids' and women's classes shot at eye level, not from the ceiling.",
    brandPersonality:
      "Expert, reassuring and disciplined. World-class credentials worn lightly — the lineage is stated once and then earned back through how the room is described.",
    brandTypography: {
      headingFont: "Teko",
      bodyFont: "Ubuntu",
    },
    brandColors: [
      {
        name: "Primary",
        hex: "#FFC20E",
      },
      {
        name: "Secondary",
        hex: "#29282D",
      },
      {
        name: "Background",
        hex: "#020101",
      },
      {
        name: "Surface",
        hex: "#FFFFFF",
      },
      {
        name: "Text",
        hex: "#9C9C9C",
      },
    ],
    referenceImages: [],
    competitors: [
      {
        id: "alliance-cmp-1",
        name: "Gracie Barra Carlsbad",
        description:
          "Most active locally. Promotes youth programs on character building, celebrates belt and stripe promotions, and ran a 1st-anniversary celebration plus belt-rank seminars. Part of the largest BJJ association in the world, which gives it the same lineage argument Alliance uses.",
        websiteUrl: "https://graciebarracarlsbad.com/",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/gbcarlsbad",
          },
        ],
      },
      {
        id: "alliance-cmp-2",
        name: "Six Blades Jiu-Jitsu Carlsbad",
        description:
          "Leans on welcome-back stories (a student returning after a three-year hiatus) and on very young beginners, alongside belt promotions. Ribeiro lineage, on Innovation Way in the business park rather than in the village.",
        websiteUrl: "https://rjjcarlsbad.com/",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/sixbladesbjjcarlsbad",
          },
          {
            network: "facebook",
            url: "https://facebook.com/ribeirojjcarlsbad",
          },
        ],
      },
      {
        id: "alliance-cmp-3",
        name: "Freedom Jiu Jitsu Academy Carlsbad",
        description:
          "Posts belt and stripe promotions; part of the local cluster driving engagement around milestones. Positions on inclusiveness — 'all ages and all experience levels' — which is the closest competitor claim to Alliance's safety-first angle.",
        websiteUrl: "https://freedomjiujitsucarlsbad.com/",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/freedomjiujitsucarlsbad",
          },
        ],
      },
    ],
    ctaLinks: [
      {
        label: "Book a free intro class",
        url: "alliancecarlsbad.com/get-started/",
        checked: true,
        suggested: false,
      },
      {
        label: "Class schedule",
        url: "alliancecarlsbad.com/schedule/",
        checked: true,
        suggested: false,
      },
      {
        label: "Programs",
        url: "alliancecarlsbad.com/classes/",
        checked: true,
        suggested: false,
      },
      {
        label: "Meet our team",
        url: "alliancecarlsbad.com/team-alliance-carlsbad/",
        checked: false,
        suggested: false,
      },
    ],
    language: "English",
    imageVoice: null,
    doRules: [
      "Address the fear that martial arts makes children aggressive, directly.",
      "Explain what a promotion or a technique teaches, not just that it happened.",
      "Name the offer precisely — a complimentary 30-minute one-on-one introduction first, then a free trial period.",
      "Say who the class is for before saying what it teaches; the academy sorts every program by person, not by belt.",
      "Name the coach when the post is about instruction. Johnny Faria, Mark Vorgeas, Michael Nelms and Karolina Vorgeas are why the testimonials read the way they do.",
      "State the Alliance lineage once, in plain terms — Jacaré, Gurgel, Paiva — then move on.",
    ],
    dontRules: [
      "Don't post generic holiday greetings — the export flagged competitors' Independence Day posts as carrying no brand angle.",
      "Don't mirror competitors' anniversary or seminar promotion; it doesn't translate into a credible theme for this brand.",
      "Don't lean on 'world-class' and 'elite'. The site already says both on nearly every screen, and neither answers the question a nervous parent is actually asking.",
      "Don't open on a medal count or a champion callout. Results are proof further down the post, never the hook — this is the one habit the live Instagram has that the strategy argues against.",
      "No urgency or scarcity framing on the intro offer. 'No pressure' is the academy's own promise and countdown language breaks it.",
    ],
    cta: "Book a free intro class",
    usedIn: 0,
    updatedAt: "just now",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
    voice: null,
    brief: null,
    brand: null,
  },
  {
    id: "ctx-noba",
    name: "Noba Fashion",
    color: "yellow",
    isDefault: false,
    brandName: "NOBA",
    brandLogo: null,
    websiteUrl: "https://www.nobalifestyle.com/",
    audience: [
      "Style-conscious professionals, 28–45, who want the look of quiet luxury without the luxury invoice",
      "Repeat buyers who came in through one linen or cashmere piece and are building a wardrobe around it",
    ],
    businessSummary:
      "Sell the material and the restraint, not the season. The market Noba is watched against — Belgian multibrand chains — runs on discount percentages, weekly drops and celebrity capsules. Noba's whole claim is the opposite: fewer, better pieces at an accessible price, worn for years rather than for a weekend. Every post should make the durability argument concrete rather than repeat the word 'quality'.",
    briefSummary:
      "Sell the material and the restraint, not the season. Competitors run on discount percentages and weekly drops; Noba's claim is fewer, better pieces at an accessible price.",
    tones: ["Understated", "Confident"],
    voiceProfile: {
      headline: "Quiet · confident · never salesy",
      writingStyle:
        "Describes the garment and lets the reader draw the conclusion. Leads with the material and what it does over time — how linen softens, why cashmere holds its shape — instead of adjectives. Never hypes a drop.",
      vocabulary:
        "Linen, cashmere, merino, suede, tailored, considered, effortless. Never 'must-have', 'obsessed', 'grab yours', 'last chance', and no percentage-off language in organic copy.",
      sentenceStructure:
        "Short declaratives. One claim per sentence, and the claim is always checkable — a fabric, a construction, a use.",
      formality: "Polished but plain. 'You' and 'your', full words rather than slang, and no exclamation marks.",
      personality: "Assured and unhurried. Says less than it could, and never sounds like it needs the sale.",
      rhetoricalDevices:
        "Contrast the seasonal against the lasting. Show one piece styled several ways rather than several pieces once.",
      emotionalTone: "Calm confidence. Aspirational without being remote.",
      contentPatterns: "Material → what it does over time → how it's worn. Around 60 words, one piece per post.",
      uniqueTraits:
        "Names the fibre every time. Neutral, daylight photography over flat-lays. No countdown timers, no sale stickers on organic content.",
    },
    contentStyle: ["Editorial", "Product-led"],
    objective: ["Brand awareness", "Sales"],
    contentAction: ["Shop the collection", "Discover more"],
    signatureHooks: [
      "True style isn't loud or seasonal.",
      "One hundred percent linen. That's the entire spec sheet.",
      "Built to be worn next summer, and the one after that.",
    ],
    closingPatterns: ["Dress with class, for less.", "Fewer pieces. Worn longer."],
    formattingStyle:
      "Opens on the piece or the fibre. Two or three short lines. No emoji strings, at most one. Never opens with a discount.",
    visualStyle:
      "Neutral and jewel tones, daylight, models in motion rather than posed. Full-look framing so the cut reads. Sentence case throughout.",
    brandPersonality:
      "Assured, understated and accessible. Confident enough not to shout, warm enough not to feel like a luxury house.",
    brandTypography: null,
    brandColors: [],
    referenceImages: [],
    competitors: [
      {
        id: "noba-cmp-1",
        name: "ZEB",
        description:
          "Highest-volume poster in the scan and the loudest discounter — '-50% & -70%' ran through most of July. Multibrand, festival-heavy, and the one running its own staff and ambassadors as the face of the brand.",
        websiteUrl: "https://www.zeb.be",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/zebfashion",
          },
        ],
      },
      {
        id: "noba-cmp-2",
        name: "JBC",
        description:
          "Belgian family retailer, and the strongest engagement in the set by a distance. Wins on personality — a celebrity capsule (CAMILLE x JBC), topical humour and second-hand Bring Back days — rather than on product.",
        websiteUrl: "https://www.jbc.be",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/jbcfashion",
          },
        ],
      },
      {
        id: "noba-cmp-3",
        name: "The Fashion Store",
        description:
          "Multibrand with 75+ labels. Posts twice daily on a fixed schedule, mixing sale reminders with customer-worn looks from its #thefashionstorelovers creators.",
        websiteUrl: "https://www.thefashionstore.be",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/thefashionstore_be",
          },
        ],
      },
      {
        id: "noba-cmp-4",
        name: "E5 Mode",
        description:
          "The closest thing in the set to Noba's register: label-led FW26 storytelling, 'quiet luxury', 'timeless', 'some pieces never date'. Posts in threes, one brand at a time, with almost no discount language.",
        websiteUrl: "https://www.e5.be",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/e5mode",
          },
        ],
      },
      {
        id: "noba-cmp-5",
        name: "PointCarré",
        description:
          "Smallest volume, most creator-dependent. Nearly every post is a paid partnership look, and the comment counts on those run far ahead of its own brand posts.",
        websiteUrl: "https://www.pointcarre.be",
        socials: [
          {
            network: "instagram",
            url: "https://instagram.com/point_carre",
          },
        ],
      },
    ],
    ctaLinks: [
      {
        label: "Shop the collection",
        url: "nobalifestyle.com/collections",
        checked: true,
        suggested: false,
      },
      {
        label: "Our story",
        url: "nobalifestyle.com/pages/our-story",
        checked: true,
        suggested: false,
      },
    ],
    language: "English",
    imageVoice: null,
    doRules: [
      "Name the fibre — linen, cashmere, merino, suede — in every product post.",
      "Argue durability with something checkable: how the fabric ages, how it's made, how it's worn again.",
      "Show one piece styled several ways rather than several pieces once.",
    ],
    dontRules: [
      "No percentage-off language in organic posts — that's the competitors' whole feed and it undercuts the claim.",
      "Don't chase a weekend: festival and one-off event content contradicts 'built to last'.",
      "No countdown or scarcity framing.",
    ],
    cta: "Dress with class, for less.",
    usedIn: 0,
    updatedAt: "just now",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
    voice: null,
    brief: null,
    brand: null,
  },
  {
    id: "ctx-dwelling",
    name: "The Dwelling Company",
    color: "green",
    isDefault: false,
    brandName: "The Dwelling Company",
    brandLogo: null,
    websiteUrl: "https://www.thedwellingcompany.com/",
    audience: [
      "Cost-burdened middle-income renters — households on $20k–$75k paying more than 30% of income in rent",
      "Eco-conscious apartment seekers who weigh how a building was made, not just what it costs",
      "Municipalities, landowners and capital partners looking for attainable housing that actually pencils",
    ],
    businessSummary:
      "The Dwelling Company manufactures, develops and operates attainable, sustainable, connected apartments built on a steel skeleton. Up to 90% of the building is assembled in a centralised factory — including about 95% of the MEP systems, against roughly 10% for panelised construction — which is where the cost saving comes from. The market it is built for is the 9.7 million cost-burdened US rental households, 21.4 million of whom earn between $20k and $75k.",
    briefSummary:
      "Steel-skeleton modular apartments, up to 90% factory-assembled, for the 9.7m US renters paying more than 30% of their income in rent. Attainable, sustainable, connected.",
    tones: ["Direct", "Evidence-led"],
    voiceProfile: {
      headline: "Attainable · sustainable · connected",
      writingStyle:
        "States the problem with a number, then the structural reason it exists, then what the factory changes about it. Never sells the building without saying what it costs to run. Reads like an engineer explaining a constraint, not a developer selling a unit.",
      vocabulary:
        "Cost-burdened, attainable, steel skeleton, modular, MEP, factory completion, Energy Star, DOE ZERH, operating cost. Attainable, never 'affordable housing' — the distinction is the whole positioning. Never 'luxury', never 'dream home'.",
      sentenceStructure: null,
      examples: [],
    },
    contentStyle: ["Data-driven with structural insights", "Problem-solution oriented"],
    objective: ["Brand awareness", "Lead generation"],
    contentAction: ["Contact us for inquiries", "Follow our LinkedIn page"],
    signatureHooks: [],
    closingPatterns: [],
    formattingStyle: null,
    visualStyle: null,
    brandPersonality: "engineering-led, plain-spoken, socially serious",
    brandTypography: null,
    brandColors: [],
    referenceImages: [],
    competitors: [
      {
        id: "dw-cmp-1",
        name: "Factory_OS",
        description:
          "Named in the brand brief. Vallejo, CA — factory-built multifamily at volume, the closest US analogue to this model. The scan returned no posts from this account in the window.",
        websiteUrl: "https://factoryos.com/",
        socials: [],
      },
      {
        id: "dw-cmp-2",
        name: "Vessel Technologies",
        description:
          "Named in the brand brief. Panelised apartment buildings pitched on operating cost rather than sticker price. The scan returned no posts from this account in the window.",
        websiteUrl: "https://www.vesseltechnologies.com/",
        socials: [],
      },
      {
        id: "dw-cmp-3",
        name: "Autovol",
        description:
          "Named in the brand brief. Nampa, ID — robotic modular assembly, the automation end of the same argument. The scan returned no posts from this account in the window.",
        websiteUrl: "https://autovol.com/",
        socials: [],
      },
      {
        id: "dw-cmp-4",
        name: "Module",
        description:
          "Named in the brand brief. Pittsburgh — incremental, expandable modular homes. The scan returned no posts from this account in the window.",
        websiteUrl: "https://modulehousing.com/",
        socials: [],
      },
      {
        id: "dw-cmp-5",
        name: "Sibomat",
        description:
          "Not in the brand brief — surfaced by the scan, and not a competitor. A Belgian timber-frame housebuilder and the loudest account in the window: material performance, showroom visits, a 35-year repeat customer.",
        websiteUrl: "https://www.sibomat.be/",
        socials: [],
      },
      {
        id: "dw-cmp-6",
        name: "Stabilame",
        description:
          "Not in the brand brief — surfaced by the scan. Walloon mass-timber and CLT builder; the only account in the window doing public-amenity work — a marina capitainerie built over water, visitor infrastructure.",
        websiteUrl: "https://www.stabilame.be/",
        socials: [],
      },
      {
        id: "dw-cmp-7",
        name: "Thomas & Piron",
        description:
          "Not in the brand brief — surfaced by the scan. Large Belgian developer, 50 years old this year. Most of its posts in the window are anniversary, recruitment and sponsorship — the noise the scan flagged.",
        websiteUrl: "https://www.thomas-piron.eu/",
        socials: [],
      },
      {
        id: "dw-cmp-8",
        name: "Maisons Blavier",
        description:
          "Not in the brand brief — surfaced by the scan. Bilingual FR/NL housebuilder running an open-house and show-home programme, plus a behind-the-scenes build series.",
        websiteUrl: "https://www.blavier.be/",
        socials: [],
      },
    ],
    ctaLinks: [
      {
        label: "Contact us",
        url: "https://www.thedwellingcompany.com/contact",
      },
      {
        label: "Follow on LinkedIn",
        url: "https://www.linkedin.com/company/the-dwelling-company/",
      },
    ],
    language: "English",
    imageVoice: null,
    doRules: [
      "Lead with the number. 9.7 million cost-burdened households, 30% of income, 90% factory completion — the argument is arithmetic before it is anything else.",
      "Say what it costs to LIVE in, not only what it costs to build. Energy Star and DOE ZERH are the half of the story a renter actually pays for.",
    ],
    dontRules: [
      "Don't say 'affordable housing'. This is attainable, market-rate, unsubsidised — collapsing the two loses the whole position.",
      "Don't borrow the timber-sustainability argument the scan is full of. Steel and factory completion is a different claim, and echoing a competitor's material story concedes the point.",
    ],
    cta: "Contact us for inquiries",
    usedIn: 0,
    updatedAt: "just now",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
    voice: null,
    brief: null,
    brand: null,
  },
  {
    id: "ctx-agorapulse",
    name: "Agorapulse",
    color: "orange",
    isDefault: false,
    brandName: "Agorapulse",
    brandLogo: null,
    websiteUrl: "https://www.agorapulse.com/",
    audience: [
      "Social Media Managers running publishing, inbox and reporting day to day",
      "Marketing agencies handling several client accounts at once",
      "Growing marketing teams that need shared calendars and approval workflows",
      "The social media manager who has to justify the budget upward — the one asked what the posting actually returned",
      "Teams evaluating a switch off Hootsuite or Sprout Social on cost, usability and support",
    ],
    businessSummary:
      "Agorapulse is an easy-to-use social media management platform for growing marketing teams, agencies and businesses: one dashboard for publishing, inbox, reporting, monitoring and team collaboration. Shared calendars, automated moderation and social ROI tracking are the levers — the pitch is saving time, staying organised, and being able to prove the value of the work. Founded in Paris in 2010 by Emeric Ernoult and Benoît Hédiard and bootstrapped since, it shipped the first social media inbox in 2014 and now serves 31K+ social media managers daily. The site argues on four numbers rather than adjectives: 50% of content-creation time saved, 30% average saving for teams switching, 96% user satisfaction, and support answering in 30 minutes or less. Social ROI is the differentiator it claims outright — tracking sales, traffic and leads back to organic posts.",
    briefSummary:
      "One dashboard for publishing, inbox, reporting, monitoring and collaboration. The pitch is saving time, staying organised, and proving social ROI.",
    tones: ["Direct", "Helpful"],
    voiceProfile: {
      headline: "Direct · practical · customer-first",
      writingStyle:
        "Says the useful thing first and shows the workflow rather than describing it. Leans on what real teams did and what it changed. Educational without being abstract — every piece should leave a social media manager able to do something on Monday.",
      vocabulary:
        "Workflow, inbox, publishing, reporting, social ROI, approval, moderation, shared calendar. Concrete nouns over category language; never 'synergy', 'revolutionise' or 'game-changer'.",
      sentenceStructure:
        "Short and load-bearing. The best lines on the site are built on a turn — 'Keep tabs, without switching tabs' — where the second half reverses the first. Body copy runs two or three sentences, then a list of what it lets you do.",
      formality:
        "Semi-formal and colloquial where it helps. Second person throughout, contractions everywhere, and willing to name the feeling out loud ('the internal friction and downright annoyance of having to send multiple emails'). Never corporate, never slangy.",
      personality:
        "A peer who has done the job. Speaks to the social media manager, not to the buyer above them, and takes their side — the recurring subtext is that this work is undervalued and measurable.",
      rhetoricalDevices:
        "Contradict the assumption, then explain ('The best time to post on social media isn't when you think'). Named customer with a number attached. Head-to-head comparisons answered plainly rather than dodged.",
      emotionalTone:
        "Reassuring and slightly conspiratorial. Acknowledges the chaos — tab-switching, approval chasing, proving your worth — and positions the product as relief rather than transformation.",
      contentPatterns:
        "Pain → mechanism → proof → try it free. Blog headlines lead with the reader's problem or a customer's number; product copy leads with the job and closes on a three-item capability list.",
      uniqueTraits:
        "Social ROI is the claim nothing else in the category makes as flatly. Customer names and figures carry the argument in place of adjectives. Competitors are named directly, trademark symbols and all, rather than alluded to.",
      examples: [],
    },
    contentStyle: ["Direct and actionable", "Customer-centric storytelling", "Tool-driven and educational"],
    objective: ["Lead generation", "Product adoption"],
    contentAction: ["Sign up for a free trial", "Book a personalized demo", "Try free social media tools"],
    signatureHooks: [
      "Keep tabs, without switching tabs.",
      "Drive real impact on social media. From engagement to ROI.",
      "The best time to post on social media isn't when you think.",
      "Is your social media strategy failing? Here's why.",
      "Save time, stay organized, and easily manage your social media.",
    ],
    closingPatterns: [
      "Try for free now — 30 days, no card required.",
      "See how teams like yours did it.",
      "Book a demo and we'll walk your workflow.",
    ],
    formattingStyle:
      "Opens on the reader's problem or a customer's number, never on the product. Two or three short sentences, then a three-item list of what it lets you do. Headlines built on a reversal or a contradicted assumption. Numbers stated plainly — 50%, 30%, 96%, 30 minutes — with the customer named beside them. Free trial mentioned at the end, with the terms attached rather than as pressure.",
    visualStyle:
      "Navy text on white, orange for emphasis and blue for the action. Light peach and grey tints separate sections; nothing is dark. Product screenshots do the explaining — real dashboards and inboxes, not illustration. Sentence case in body copy, title case in headlines. Buttons are barely rounded.",
    brandPersonality:
      "Direct, practical and customer-first. A peer who has done the job, on the side of the social media manager rather than the buyer — and confident enough to name competitors and put its numbers next to theirs.",
    brandTypography: {
      headingFont: "Averta",
      bodyFont: "Averta",
    },
    brandColors: [
      {
        name: "Primary",
        hex: "#212E44",
      },
      {
        name: "Secondary",
        hex: "#344563",
      },
      {
        name: "Accent",
        hex: "#FF6726",
      },
      {
        name: "Action",
        hex: "#1863DC",
      },
      {
        name: "Background",
        hex: "#FFFFFF",
      },
      {
        name: "Surface",
        hex: "#FFEFE9",
      },
    ],
    referenceImages: [],
    competitors: [
      {
        id: "agp-cmp-1",
        name: "Sprout Social",
        description:
          "Named in the brand brief. In the scan: pillar guides on analytics and a two-part Bluesky playbook — cornerstone content built to rank and anchor a topic cluster.",
        websiteUrl: "https://sproutsocial.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/sprout-social-inc-",
          },
          {
            network: "instagram",
            url: "https://instagram.com/sproutsocial",
          },
        ],
      },
      {
        id: "agp-cmp-2",
        name: "Hootsuite",
        description:
          "Named in the brand brief. In the scan: the loudest AI move of the window — Social OS, pitched as rebuilding the product around an agent layer rather than bolting AI onto it.",
        websiteUrl: "https://www.hootsuite.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/hootsuite",
          },
        ],
      },
      {
        id: "agp-cmp-3",
        name: "Sendible",
        description: "Named in the brand brief. The scan returned no posts from this account in the window.",
        websiteUrl: "https://www.sendible.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/sendible",
          },
          {
            network: "instagram",
            url: "https://instagram.com/sendible",
          },
        ],
      },
      {
        id: "agp-cmp-4",
        name: "Loomly",
        description: "Named in the brand brief. The scan returned no posts from this account in the window.",
        websiteUrl: "https://www.loomly.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/loomly",
          },
          {
            network: "instagram",
            url: "https://instagram.com/loomlysocial",
          },
        ],
      },
      {
        id: "agp-cmp-5",
        name: "Buffer",
        description:
          "Not in the brand brief — surfaced by the scan. Practitioner-voice content on MCP servers and head-to-head comparisons, plus the Insights launch.",
        websiteUrl: "https://buffer.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/bufferapp",
          },
          {
            network: "instagram",
            url: "https://instagram.com/buffer",
          },
        ],
      },
      {
        id: "agp-cmp-6",
        name: "Vista Social",
        description:
          "Not in the brand brief — surfaced by the scan. Ask Vista, a conversational command surface across 50+ tools, and image-to-video in the AI Assistant.",
        websiteUrl: "https://vistasocial.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/vistasocial",
          },
          {
            network: "instagram",
            url: "https://instagram.com/vistasocialapp",
          },
        ],
      },
      {
        id: "agp-cmp-7",
        name: "Sprinklr",
        description:
          "Not in the brand brief — surfaced by the scan. Enterprise framing: governed measurement definitions, and LLM Insights for brand visibility inside AI answers.",
        websiteUrl: "https://www.sprinklr.com/",
        socials: [
          {
            network: "linkedin",
            url: "https://www.linkedin.com/company/sprinklr",
          },
          {
            network: "instagram",
            url: "https://instagram.com/sprinklr",
          },
        ],
      },
    ],
    ctaLinks: [
      {
        label: "Start a free trial",
        url: "https://www.agorapulse.com/free-trial/",
        checked: true,
        suggested: false,
      },
      {
        label: "Book a demo",
        url: "https://www.agorapulse.com/request-demo/",
        checked: true,
        suggested: false,
      },
      {
        label: "Pricing",
        url: "https://www.agorapulse.com/pricing/",
        checked: true,
        suggested: false,
      },
      {
        label: "Free social media tools",
        url: "https://www.agorapulse.com/free-social-media-marketing-tools/",
        checked: true,
        suggested: false,
      },
      {
        label: "Success stories",
        url: "https://www.agorapulse.com/blog/success-stories/",
        checked: false,
        suggested: false,
      },
      {
        label: "Agorapulse Academy",
        url: "https://www.agorapulse.com/academy/",
        checked: false,
        suggested: false,
      },
    ],
    language: "English",
    imageVoice: null,
    doRules: [
      "Show the workflow. A screenshot of the thing working beats a paragraph describing it.",
      "Answer the comparison question honestly — the scan shows head-to-head content is what captures bottom-funnel search.",
      "Attach a number to a named customer. The site argues with 50%, 30%, 96% and 30 minutes rather than with adjectives; a claim without a name behind it is weaker than the brand's own baseline.",
      "Write to the social media manager, not to the person who signs off. The brand's whole position is taking their side.",
      "State the trial terms when you offer it — 30 days, no card required. It is the reason the offer reads as low-risk.",
    ],
    dontRules: [
      "Don't announce an AI capability without saying which job it removes. The window is full of agent launches and thin on what they actually replace.",
      "Don't publish a metrics list. Competitors already own 'here are 30 metrics'; the opening is which ones tie to a decision.",
      "Don't lead with the platform. Every strong line on the site opens on the reader's problem and reaches the product second.",
      "No hype vocabulary — 'revolutionary', 'game-changer', 'synergy'. The brand's credibility rests on sounding like a practitioner.",
      "Don't claim ROI in the abstract. Social ROI means tracked sales, traffic and leads from organic posts; used loosely it becomes the category language it was meant to replace.",
    ],
    cta: "Start a free trial",
    usedIn: 0,
    updatedAt: "just now",
    analysis: {
      voice: null,
      brief: null,
      brand: null,
    },
    voice: null,
    brief: null,
    brand: null,
  },
];

// ---- Playbooks that only exist under the `playbookSharing` flag ------------
//
// Kept out of `contexts` and appended by contexts-store when the flag is on —
// the same split as demoManyProfiles. These aren't data riding along an existing
// object: they're whole Playbooks that only mean something once ownership exists. With the flag off they'd be a stray
// half-filled fiche and an extra library card nobody asked for.
export const sharedContexts = [
  // Sam's Playbook, shared with the whole org — the read-only case, and the
  // problem the sharing feature exists for: two people building a Playbook for
  // the SAME brand (Acme), each with their own editorial framing, neither aware
  // of the other. Mine is "Acme · Q2 marketing" above.
  {
    id: "ctx-acme-devrel",
    name: "Acme · Developer relations",
    color: "blue",
    isDefault: false,
    ownerId: "u-sam",
    scope: "organization",
    brandName: "Acme",
    brandLogos: ACME_LOGOS.map((l) => ({ ...l })),
    brandLogo: "assets/logos/brands/acme.svg",
    websiteUrl: "https://acme.example.com/developers",
    audience: [
      "Backend engineers who found us through the API docs",
      "Platform teams deciding whether to build or buy",
    ],
    businessSummary:
      "Acme's developer surface, written for people who read the changelog before the landing page. Ship notes, API design decisions, and honest trade-offs — no funnel language.",
    briefSummary:
      "Acme's developer surface, written for people who read the changelog before the landing page. Ship notes, API design decisions, and honest trade-offs — no funnel language.",
    tones: ["Technical", "Direct"],
    voiceProfile: {
      headline: "Technical · direct · unmarketed",
      writingStyle:
        "Leads with the change and what it costs. Explains the trade-off rather than claiming there isn't one.",
      vocabulary: "Precise API vocabulary, no abstraction. Says 'endpoint', 'rate limit', 'breaking change' plainly.",
      sentenceStructure: "Short declaratives. One idea per line. Code or a payload where an example beats a sentence.",
      formality: "Peer to peer. 'We' for the team that shipped it, 'you' for the person integrating.",
      personality: "Straight, unhurried, willing to say what's still rough.",
      rhetoricalDevices: "Before / after payloads. Named versions. Explicit migration notes.",
      emotionalTone: "Level. Enthusiasm is carried by the change itself, never by adjectives.",
      contentPatterns: "What changed → why → what it breaks → how to migrate.",
      uniqueTraits: 'No "excited to announce". No emoji. Never ships a post without a link to the reference.',
    },
    contentStyle: ["Technical deep-dive"],
    objective: ["Product adoption"],
    contentAction: ["Read the changelog", "Try it in the sandbox"],
    signatureHooks: ["We changed how [thing] works.", "This one breaks something. Here's what:"],
    closingPatterns: ["Full reference →", "Migration notes in the changelog."],
    formattingStyle:
      "Short declarative lines, one idea each. A payload or snippet where it replaces a paragraph. Version numbers spelled out.",
    visualStyle: "No emoji. No exclamation marks. Endpoint names in backticks. Versions as digits.",
    brandPersonality: "Straight, unhurried, willing to name what's still rough. Talks to peers, not prospects.",
    brandTypography: { headingFont: "Inter", bodyFont: "JetBrains Mono" },
    brandColors: [
      { name: "Primary", hex: "#212E44" },
      { name: "Accent", hex: "#3D7DD6" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#1A1F36" },
    ],
    ctaLinks: [
      { label: "Read the changelog", url: "acme.example.com/changelog", checked: true, suggested: false },
      { label: "Try it in the sandbox", url: "acme.example.com/sandbox", checked: true, suggested: false },
    ],
    language: "English",
    doRules: ["Name the version", "Say what breaks", "Link the reference"],
    dontRules: ['No "excited to announce"', "No emoji", "Don't claim there's no trade-off"],
    cta: "Full reference →",
    usedIn: 2,
    updatedAt: "yesterday",
    // Pre-filled so "Recent changes" in the Share modal has something to show
    // on a first run. No diffs, by design — who and when, never what.
    history: [
      { id: "h-seed-1", actorId: "u-sam", action: "created this Playbook", when: "3 weeks ago" },
      { id: "h-seed-2", actorId: "u-sam", action: "shared it with the organisation", when: "3 weeks ago" },
      { id: "h-seed-3", actorId: "u-lea", action: "edited the Voice & style section", when: "yesterday" },
    ],
    analysis: { voice: null, brief: null, brand: null },
  },
  // The tombstone. Deliberately thin: nothing ever renders this Playbook,
  // because nobody but Jonas can see it. It exists so one seeded chat can point
  // at a Playbook it lost access to and still say its name — which is what
  // playbook-access's revokedContextFor() reads. See the note at the top of that
  // file for why the store doesn't just hide it.
  {
    id: "ctx-orphan-brightline",
    name: "Brightline · launch",
    color: "grey",
    isDefault: false,
    ownerId: "u-jonas",
    scope: "personal",
    brandName: "Brightline",
    websiteUrl: "https://brightline.example.com",
    audience: ["Ops leads at mid-market logistics firms"],
    businessSummary: "Launch narrative for Brightline, written while the positioning was still moving.",
    briefSummary: "Launch narrative for Brightline, written while the positioning was still moving.",
    tones: ["Professional"],
    language: "English",
    usedIn: 1,
    updatedAt: "a week ago",
    analysis: { voice: null, brief: null, brand: null },
  },
];

// Legacy accessors — keep `context.voice`, `context.brief`, `context.brand`
// reading from the new analysis sub-object so callers from before Lot 8
// don't break. Callers should migrate to ctx.analysis.* over time.
for (const ctx of contexts) {
  if (ctx.analysis) {
    Object.defineProperty(ctx, "voice", { get: () => ctx.analysis.voice, enumerable: true });
    Object.defineProperty(ctx, "brief", { get: () => ctx.analysis.brief, enumerable: true });
    Object.defineProperty(ctx, "brand", { get: () => ctx.analysis.brand, enumerable: true });
  }
}

// ---- Topic feeds + Topics (the listening feature) -------------------------
//
// A FEED is one Playbook's standing query: which sources it watches, how often,
// and which sites the Brand-website source reads. Two are seeded; every other
// Playbook gets one provisioned on first read (topic-feeds-store), so nobody
// ever meets a screen asking them to set listening up before anything happens.
//
// A TOPIC is what a scan assembled: a headline, an article in two sections, and
// the posts the article was written from. `kind` is the segment it lands in and
// comes from the scan alone — "ready" is draftable now, "later" is a theme worth
// keeping. `isTrending` / `isUpdated` are the two attention signals, and they are
// independent of `seedStatus`: a Topic can be Used and trending at once. Signals
// only apply inside the first age group, and topics-store enforces that on read
// rather than trusting what is written here.
//
// `ageLabel` is a relative phrase, not a date — a prototype has no clock worth
// trusting, and authored dates rot as the file ages. It is the ONLY age input:
// the card's "2d ago" and the group it sits under both derive from it, so the two
// cannot disagree. topics-store.ageMinutes is the seam to replace with real
// timestamps.
//
// `seedStatus` gives the landing feed a real triage spread rather than twenty-one
// identical To-review rows, and `seedReason` carries the sentence a reader typed
// when they ignored one — the Ignored state is meaningless without it.
//
// `posts[].author.accent` is a semantic avatar tint resolved in
// social-post-card.css — never a hex. Zero engagement counts are OMITTED rather
// than written as 0: the card prints labelled figures, and "0 reposts" is worse
// than nothing.

export const topicFeeds = [
  {
    id: "feed-acme",
    name: "Acme competitors · weekly",
    playbookId: "ctx-acme",
    sources: ["competitor-posts"],
    websites: ["https://acme.example.com"],
    cadence: "weekly",
  },
  {
    id: "feed-founder",
    name: "Category product moves · monthly",
    playbookId: "ctx-founder-voice",
    sources: ["competitor-posts"],
    websites: ["https://acme.example.com"],
    cadence: "monthly",
  },
  // The four real lanes, one per real-brand Playbook. "notify" and "showTrending"
  // are dropped: this repo has no per-feed notification or trending toggle.
  {
    id: "topic-list-7",
    name: "Modular & timber competitors · last 30 days",
    playbookId: "ctx-dwelling",
    sources: ["competitor-posts"],
    cadence: "monthly",
    websites: ["https://www.thedwellingcompany.com/"],
  },
  {
    id: "topic-list-4",
    name: "Carlsbad competitors · last 30 days",
    playbookId: "ctx-alliance-bjj",
    sources: ["competitor-posts"],
    cadence: "monthly",
    websites: ["https://alliancejiujitsucarlsbad.com"],
  },
  {
    id: "topic-list-6",
    name: "Competitor product moves",
    playbookId: "ctx-agorapulse",
    sources: ["competitor-posts", "industry-trends", "brand-website"],
    cadence: "monthly",
    websites: ["https://www.agorapulse.com/", "https://www.agorapulse.com/blog/"],
  },
  {
    id: "topic-list-5",
    name: "Belgian multibrand competitors · last 30 days",
    playbookId: "ctx-noba",
    sources: ["competitor-posts"],
    cadence: "monthly",
    websites: ["https://www.nobalifestyle.com/", "https://www.nobalifestyle.com/blog"],
  },
];

export const topics = [
  {
    id: "topic-acme-1",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "2h ago",
    kind: "ready",
    headline: "Linear's least-produced post of the quarter beat everything they shipped",
    summary:
      "A plain-text note about cutting their own roadmap outperformed three launch videos and a redesign announcement. The engagement is on the admission, not the news.",
    isTrending: true,
    article: {
      title: "Linear's least-produced post of the quarter beat everything they shipped",
      subheads: ["What actually got shared", "The version Acme can write"],
      paragraphs: [
        "Linear published four things this quarter that cost real production money: two launch films, an interactive changelog and a redesigned pricing page. The post that beat all four was seven sentences of plain text explaining why they deleted their public roadmap.",
        "The comments are not about roadmaps. They are operators saying they have the same problem and have never seen anyone say it out loud. The post works because it names a decision the reader has been putting off, and then shows the cost of making it.",
        "Acme has the same shape of story sitting unused: the Q2 scope cut. Same admission, same audience, and a number attached — three weeks of build handed back. The format is a text post, not a film.",
      ],
    },
    posts: [
      {
        id: "topic-acme-1-p1",
        network: "linkedin",
        publishedOn: "2 days ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "We deleted our public roadmap. It was generating more support load than trust — every date became a promise someone quoted back to us. Here is what we do instead.",
        likes: 1840,
        comments: 212,
        reposts: 96,
      },
      {
        id: "topic-acme-1-p2",
        network: "x",
        publishedOn: "3 days ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "Shipping a roadmap is easy. Being held to one is the part nobody prices in.",
        likes: 920,
        comments: 64,
        reposts: 140,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "3 weeks ago",
        note: "Surfaced from the weekly competitor scan (4 matching posts).",
      },
      {
        status: "updated",
        when: "12 days ago",
        note: "Rewritten — two more posts joined it and the engagement read changed.",
      },
      {
        status: "used",
        when: "9 days ago",
        note: "Drafted into a chat — the roadmap-transparency post.",
      },
      {
        status: "trending",
        when: "4 days ago",
        note: "Running 3.1x its own median. Flagged for a second look.",
      },
      {
        status: "new",
        when: "2h ago",
        note: "Surfaced from the weekly competitor scan (9 matching posts). Ranked on engagement against Linear's own median.",
      },
    ],
  },
  {
    id: "topic-acme-2",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "5h ago",
    kind: "ready",
    headline: "Notion is using templates as onboarding and calling it content",
    summary:
      "Every template launch this month ends in a setup flow rather than a download. The content team is doing activation work under a marketing label.",
    article: {
      title: "Notion is using templates as onboarding and calling it content",
      subheads: ["The pattern across six launches", "Why it matters for Q2"],
      paragraphs: [
        "Six template posts in four weeks, and none of them end at the template. Each one opens a workspace with the structure already built, which means the reader's first action is using the product rather than saving a file.",
        "The marketing value is secondary. What they are buying is a first session that already contains the customer's own data, which is the hardest thing to manufacture in a trial.",
        "Acme's Q2 launch has the same opportunity and currently ships a PDF. The change is not a content change; it is deciding that the asset opens the product.",
      ],
    },
    posts: [
      {
        id: "topic-acme-2-p1",
        network: "linkedin",
        publishedOn: "4 days ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "New template: the quarterly planning workspace we use internally. It opens with your team already in it.",
        likes: 2400,
        comments: 88,
        reposts: 310,
      },
      {
        id: "topic-acme-2-p2",
        network: "x",
        publishedOn: "6 days ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Templates are the shortest path from 'interesting' to 'in use'.",
        likes: 610,
        comments: 22,
        reposts: 74,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5h ago",
        note: "Surfaced from the weekly competitor scan (6 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-3",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "1d ago",
    kind: "ready",
    headline: "The homepage teardowns keep failing on the same three things",
    summary:
      "Anthony Pierri has published five teardowns this month. Every one flags a missing subject, a feature list where an outcome should be, and a headline that could belong to any competitor.",
    isUpdated: true,
    article: {
      title: "The homepage teardowns keep failing on the same three things",
      subheads: ["The three failures, in order", "What Acme's own page does"],
      paragraphs: [
        "Five teardowns, five identical opening notes: the page does not say who it is for, the hero sells a feature set rather than an outcome, and the headline survives a find-and-replace of the company name.",
        "The third one is the useful test. If a competitor could paste their logo onto your hero and nothing would read as false, the hero is not positioning — it is category description.",
        "Acme's page fails the third test today. The fix is one sentence, and the customer quote from the Q2 beta already contains it.",
      ],
    },
    posts: [
      {
        id: "topic-acme-3-p1",
        network: "linkedin",
        publishedOn: "1 day ago",
        author: { name: "Anthony Pierri", handle: "@anthonypierri", initials: "AP", accent: "orange" },
        text: "Teardown #47. Same three problems as #46, #45 and #44. Nobody on the page. No outcome in the hero. A headline that fits every company in the category.",
        likes: 1520,
        comments: 140,
        reposts: 68,
      },
      {
        id: "topic-acme-3-p2",
        network: "linkedin",
        publishedOn: "5 days ago",
        author: { name: "Anthony Pierri", handle: "@anthonypierri", initials: "AP", accent: "orange" },
        text: "If your competitor can swap their logo into your hero and it still reads true, you have written the category, not the product.",
        likes: 3100,
        comments: 201,
        reposts: 240,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "6 days ago",
        note: "Surfaced from the weekly competitor scan (3 matching posts).",
      },
      {
        status: "updated",
        when: "1d ago",
        note: "Rewritten — a fifth teardown landed and the pattern held.",
      },
    ],
  },
  {
    id: "topic-acme-4",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "2d ago",
    kind: "ready",
    headline: "Basecamp is arguing against tools its buyers already pay for",
    summary:
      "Three posts in two weeks position their product as the thing you adopt instead of the stack you have. The argument is subtraction, and it is landing.",
    article: {
      title: "Basecamp is arguing against tools its buyers already pay for",
      subheads: ["Subtraction as a pitch", "The risk in copying it"],
      paragraphs: [
        "Basecamp's last three posts do not compare features. They count tools: how many the reader is paying for, how many they opened yesterday, how many their team can name. The product is positioned as the one that replaces four.",
        "It works because the reader can verify the count themselves in about ten seconds, and because it makes the incumbent's strength — breadth — into the problem.",
        "Acme cannot make this argument without a migration story, and does not have one yet. Worth knowing which of our own comparisons rest on breadth.",
      ],
    },
    posts: [
      {
        id: "topic-acme-4-p1",
        network: "linkedin",
        publishedOn: "6 days ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "Count the tools your team pays for. Now count the ones anyone opened this week. That gap is the pitch.",
        likes: 1200,
        comments: 96,
        reposts: 140,
      },
      {
        id: "topic-acme-4-p2",
        network: "x",
        publishedOn: "9 days ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "We are not trying to be in your stack. We are trying to be most of it.",
        likes: 740,
        comments: 40,
        reposts: 88,
      },
    ],
    seedStatus: "used",
    history: [
      {
        status: "new",
        when: "2d ago",
        note: "Surfaced from the weekly competitor scan (7 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-5",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "3d ago",
    kind: "ready",
    headline: "Launch copy swapped time saved for time to value this quarter",
    summary:
      "Across fourteen B2B launches this month, the headline metric moved from hours saved to days-until-working. The claim is easier to prove and harder to dismiss.",
    article: {
      title: "Launch copy swapped time saved for time to value this quarter",
      subheads: ["What changed in the wording", "Which one Acme can evidence"],
      paragraphs: [
        "Hours saved is a claim about a counterfactual, and buyers have learned to discount it. Time to value is a claim about a calendar, and it can be checked against their own onboarding.",
        "Eleven of the fourteen launches led with a number of days. Three still led with hours saved, and all three were the ones without a customer named in the post.",
        "Acme has the days number from the Q2 beta and is not using it. It is also the only one of the two claims our own data actually supports.",
      ],
    },
    posts: [
      {
        id: "topic-acme-5-p1",
        network: "linkedin",
        publishedOn: "4 days ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "Stop selling hours saved. Nobody believes the baseline. Sell the date the thing starts working.",
        likes: 2800,
        comments: 150,
        reposts: 190,
      },
      {
        id: "topic-acme-5-p2",
        network: "x",
        publishedOn: "1 week ago",
        author: { name: "Lenny's Newsletter", handle: "@lennysan", initials: "LN", accent: "soft-blue" },
        text: "The best launch copy this month all had a number of days in it, not a percentage.",
        likes: 1400,
        comments: 58,
        reposts: 120,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "3d ago",
        note: "Surfaced from the weekly competitor scan (14 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-6",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "4d ago",
    kind: "ready",
    headline: "Elena Verna's growth posts have stopped mentioning funnels",
    summary:
      "Six weeks of posts, no funnel diagrams, no stage names. The framing is now a single question about whether the product gets used in week one.",
    article: {
      title: "Elena Verna's growth posts have stopped mentioning funnels",
      subheads: ["What replaced the funnel", "The version for Acme's audience"],
      paragraphs: [
        "The funnel was a way of talking about a pipeline to people who own a pipeline. The new framing is about the first week of use, which is the thing an operator can actually change on their own.",
        "It also removes the argument about stage definitions, which is where most of these posts used to end up in the comments.",
        "Acme's audience is operators at 50 to 200 people. They have the same problem and no growth team to hand it to.",
      ],
    },
    posts: [
      {
        id: "topic-acme-6-p1",
        network: "linkedin",
        publishedOn: "5 days ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "I have stopped drawing funnels. The only question that predicted retention in any company I worked with: did they use it in week one.",
        likes: 4200,
        comments: 300,
        reposts: 410,
      },
      {
        id: "topic-acme-6-p2",
        network: "x",
        publishedOn: "2 weeks ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "Week-one usage beats every acquisition metric on the dashboard.",
        likes: 1100,
        comments: 44,
        reposts: 96,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "4d ago",
        note: "Surfaced from the weekly competitor scan (8 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-7",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "6d ago",
    kind: "ready",
    headline: "Linear ships its changelog as marketing and nobody files it as marketing",
    summary:
      "The changelog reads like a product diary, gets shared like an essay, and carries more reach than the paid campaign running beside it.",
    article: {
      title: "Linear ships its changelog as marketing and nobody files it as marketing",
      subheads: ["Why it travels", "What it costs to run"],
      paragraphs: [
        "Each entry names the person who shipped it and the reason it was worth shipping. That second half is what makes it shareable: it is a decision, not a diff.",
        "The reach comes from engineers reposting their own work, which is a distribution channel the marketing team does not have to buy or brief.",
        "The cost is a writing habit, not a budget line. Acme ships weekly and writes none of it down.",
      ],
    },
    posts: [
      {
        id: "topic-acme-7-p1",
        network: "x",
        publishedOn: "1 week ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "Changelog: sub-issues now roll up estimates to the parent. Small thing. Asked for 300 times.",
        likes: 980,
        comments: 36,
        reposts: 124,
      },
      {
        id: "topic-acme-7-p2",
        network: "linkedin",
        publishedOn: "10 days ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "Our changelog is the most-read page we have. It was never meant to be.",
        likes: 1650,
        comments: 110,
        reposts: 88,
      },
    ],
    seedStatus: "used",
    history: [
      {
        status: "new",
        when: "6d ago",
        note: "Surfaced from the weekly competitor scan (11 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-8",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "7d ago",
    kind: "later",
    headline: "Every launch this week led with a number and two named the task",
    summary:
      "Nine launches, nine headline metrics, and only two that said which job stops arriving. The gap between claim and task is the opening.",
    article: {
      title: "Every launch this week led with a number and two named the task",
      subheads: ["The nine claims", "The two that landed"],
      paragraphs: [
        "Percentages, multiples and hours, all in the hero. None of them wrong, and seven of them impossible to picture. A number without a task attached is a benchmark, not a benefit.",
        "The two that named the task — one about weekly reporting, one about invoice chasing — were also the two with a customer quote in the first screen.",
        "Acme's Q2 hero currently has the number and not the task. Both are already in the beta feedback.",
      ],
    },
    posts: [
      {
        id: "topic-acme-8-p1",
        network: "linkedin",
        publishedOn: "1 week ago",
        author: { name: "Dave Gerhardt", handle: "@davegerhardt", initials: "DG", accent: "yellow" },
        text: "Your metric is not a benefit. Tell me which meeting disappears.",
        likes: 2200,
        comments: 180,
        reposts: 150,
      },
      {
        id: "topic-acme-8-p2",
        network: "x",
        publishedOn: "9 days ago",
        author: { name: "Anthony Pierri", handle: "@anthonypierri", initials: "AP", accent: "orange" },
        text: "Nine launches this week. Two of them told me what stops landing in my inbox.",
        likes: 860,
        comments: 30,
        reposts: 70,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "7d ago",
        note: "Surfaced from the weekly competitor scan (9 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-9",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "9d ago",
    kind: "ready",
    headline: "Notion's customer stories count hours and never mention headcount",
    summary:
      "Four stories this month, every one with a time figure and none with a team size. The claim is deliberately portable across company stages.",
    article: {
      title: "Notion's customer stories count hours and never mention headcount",
      subheads: ["The choice they made", "Where it leaves a gap"],
      paragraphs: [
        "Headcount dates a story: a reader at 60 people discounts a story about a team of 400. Hours do not have that problem, so one story serves every segment.",
        "The cost is that none of the stories prove the product works at scale — which is exactly the objection Acme hears in its own late-stage calls.",
        "Naming the stage is a differentiator here rather than a limitation, because Acme's audience is one stage and can be addressed directly.",
      ],
    },
    posts: [
      {
        id: "topic-acme-9-p1",
        network: "linkedin",
        publishedOn: "11 days ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "How one team cut 11 hours a week out of planning. No new tools, no new hires.",
        likes: 1900,
        comments: 74,
        reposts: 160,
      },
      {
        id: "topic-acme-9-p2",
        network: "linkedin",
        publishedOn: "2 weeks ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Six hours back, every week, on reporting alone.",
        likes: 1350,
        comments: 48,
        reposts: 90,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "9d ago",
        note: "Surfaced from the weekly competitor scan (4 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-10",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "11d ago",
    kind: "later",
    headline: "The same pricing-page question keeps coming back in Lenny's threads",
    summary:
      "Three threads in a month, all asking when to show pricing. The consensus is not a rule — it is that hiding it costs you the people who would have self-served.",
    article: {
      title: "The same pricing-page question keeps coming back in Lenny's threads",
      subheads: ["What the threads agree on", "What Acme's page does today"],
      paragraphs: [
        "Nobody in the threads defends a hidden price on principle. The defence is always operational: the packaging is not ready, or sales wants the conversation.",
        "The counter-argument that lands is a number — the share of qualified traffic that leaves without contacting anyone. Two people posted theirs.",
        "Acme hides pricing and does not measure that share. It is a one-week measurement, not a redesign.",
      ],
    },
    posts: [
      {
        id: "topic-acme-10-p1",
        network: "linkedin",
        publishedOn: "12 days ago",
        author: { name: "Lenny's Newsletter", handle: "@lennysan", initials: "LN", accent: "soft-blue" },
        text: "Third thread this month on whether to show pricing. Same conclusion: you are not protecting a conversation, you are losing the people who never wanted one.",
        likes: 3400,
        comments: 420,
        reposts: 280,
      },
      {
        id: "topic-acme-10-p2",
        network: "x",
        publishedOn: "3 weeks ago",
        author: { name: "Lenny's Newsletter", handle: "@lennysan", initials: "LN", accent: "soft-blue" },
        text: "'Contact us' is a pricing page for exactly one buyer.",
        likes: 1250,
        comments: 60,
        reposts: 130,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "11d ago",
        note: "Surfaced from the weekly competitor scan (3 matching threads).",
      },
    ],
  },
  {
    id: "topic-acme-11",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "13d ago",
    kind: "ready",
    headline: "Basecamp's no-demo stance is positioning, not a support decision",
    summary:
      "They repeat it often enough that it now reads as a claim about the product: if it needed a demo, it would be the wrong product.",
    article: {
      title: "Basecamp's no-demo stance is positioning, not a support decision",
      subheads: ["The claim underneath", "Whether it is copyable"],
      paragraphs: [
        "Refusing demos looks like an operations choice and functions as a product claim. Every repetition says the same thing — this is simple enough that a call would waste your afternoon.",
        "It only works with a price low enough to self-serve and an onboarding that survives no hand-holding. Both are prerequisites, not consequences.",
        "Acme has neither yet, which makes this a topic to watch rather than one to answer.",
      ],
    },
    posts: [
      {
        id: "topic-acme-11-p1",
        network: "linkedin",
        publishedOn: "2 weeks ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "We still do not do demos. If you need one to understand it, we built it wrong.",
        likes: 2600,
        comments: 340,
        reposts: 190,
      },
      {
        id: "topic-acme-11-p2",
        network: "x",
        publishedOn: "3 weeks ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "No demo. No onboarding call. No implementation partner. That is the feature.",
        likes: 1480,
        comments: 120,
        reposts: 210,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "13d ago",
        note: "Surfaced from the weekly competitor scan (5 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-12",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "16d ago",
    kind: "later",
    headline: "Launch weeks are getting shorter and considerably louder",
    summary:
      "The median B2B launch this quarter ran three days, down from a fortnight last year, with roughly the same volume of posts compressed into it.",
    article: {
      title: "Launch weeks are getting shorter and considerably louder",
      subheads: ["What the compression does", "The quieter option"],
      paragraphs: [
        "Three days of everything at once buys a spike and spends the whole audience at once. The posts after day three land on people who have already decided.",
        "Two of the launches tracked did the opposite — one artefact a week for five weeks — and both held attention longer, with lower peaks.",
        "Acme's Q2 plan is currently a three-day shape. The five-week shape costs the same and is easier to staff.",
      ],
    },
    posts: [
      {
        id: "topic-acme-12-p1",
        network: "linkedin",
        publishedOn: "2 weeks ago",
        author: { name: "Dave Gerhardt", handle: "@davegerhardt", initials: "DG", accent: "yellow" },
        text: "Launch week is now launch Tuesday. Everyone is shouting on the same day and wondering why reach is down.",
        likes: 1750,
        comments: 130,
        reposts: 110,
      },
      {
        id: "topic-acme-12-p2",
        network: "x",
        publishedOn: "3 weeks ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "A launch is a distribution problem you can spread over a month, or a spike you can spend in a day.",
        likes: 990,
        comments: 42,
        reposts: 84,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "16d ago",
        note: "Surfaced from the weekly competitor scan (12 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-13",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "19d ago",
    kind: "ready",
    headline: "Linear's hiring posts do more brand work than its advertising",
    summary:
      "Role descriptions written as opinions about how work should go, shared by people who are not job-hunting. The reach is several times the paid posts beside them.",
    article: {
      title: "Linear's hiring posts do more brand work than its advertising",
      subheads: ["Why a job post travels", "The transferable part"],
      paragraphs: [
        "The posts are not lists of requirements. Each opens with a position on the craft — what good looks like, what they refuse to do — and the role follows from it.",
        "That makes them readable by people with no intention of applying, which is where the reach comes from.",
        "Acme is hiring two roles this quarter and writing both as requirement lists.",
      ],
    },
    posts: [
      {
        id: "topic-acme-13-p1",
        network: "linkedin",
        publishedOn: "3 weeks ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "We are hiring a designer. First, what we believe about design reviews — because if you disagree, the rest will not fit.",
        likes: 2100,
        comments: 88,
        reposts: 175,
      },
      {
        id: "topic-acme-13-p2",
        network: "x",
        publishedOn: "4 weeks ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "Job posts are positioning documents that happen to end in a form.",
        likes: 680,
        comments: 26,
        reposts: 90,
      },
    ],
    seedStatus: "ignored",
    seedReason: "We don't comment on other companies' hiring.",
    history: [
      {
        status: "new",
        when: "19d ago",
        note: "Surfaced from the weekly competitor scan (6 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-14",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "22d ago",
    kind: "ready",
    headline: "Dave Gerhardt's message-testing thread has become a template",
    summary:
      "A five-step way to test positioning on sales calls before it reaches a homepage. It is being reposted as a process rather than an opinion.",
    article: {
      title: "Dave Gerhardt's message-testing thread has become a template",
      subheads: ["The five steps", "Where Acme could run it"],
      paragraphs: [
        "Write three versions of the claim, use each one on the next ten calls, and record which sentence the prospect repeats back. The winner is the one they say, not the one they rate.",
        "The mechanism is that repetition is behaviour and preference is a survey answer. Only one of those predicts anything.",
        "Acme has thirty Q2 beta calls booked, which is three times what the method needs.",
      ],
    },
    posts: [
      {
        id: "topic-acme-14-p1",
        network: "linkedin",
        publishedOn: "3 weeks ago",
        author: { name: "Dave Gerhardt", handle: "@davegerhardt", initials: "DG", accent: "yellow" },
        text: "How to test messaging without a research budget: three versions, ten calls each, write down the sentence they repeat back to you.",
        likes: 5100,
        comments: 380,
        reposts: 620,
      },
      {
        id: "topic-acme-14-p2",
        network: "x",
        publishedOn: "4 weeks ago",
        author: { name: "Dave Gerhardt", handle: "@davegerhardt", initials: "DG", accent: "yellow" },
        text: "The winning message is the one your prospect says back. Not the one they picked in a survey.",
        likes: 1900,
        comments: 70,
        reposts: 240,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "22d ago",
        note: "Surfaced from the weekly competitor scan (4 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-15",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "26d ago",
    kind: "ready",
    headline: "Notion is moving from workspace to system of record, quietly",
    summary:
      "The language shifted over about six weeks: fewer posts about flexibility, more about being the place a decision is written down. That is a different buyer.",
    article: {
      title: "Notion is moving from workspace to system of record, quietly",
      subheads: ["The wording that changed", "What it opens up"],
      paragraphs: [
        "Flexibility was the pitch to an individual. A system of record is a pitch to whoever gets asked where the decision was made, and that person signs differently.",
        "The posts have not announced this. It shows up in which nouns repeat — record, source of truth, audit — and in which ones stopped.",
        "It vacates the flexible-workspace position Acme has been arguing against, which is worth a post of its own.",
      ],
    },
    posts: [
      {
        id: "topic-acme-15-p1",
        network: "linkedin",
        publishedOn: "4 weeks ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Where does your team write down a decision so the next person can find it? That is the question we are building for.",
        likes: 1600,
        comments: 64,
        reposts: 120,
      },
      {
        id: "topic-acme-15-p2",
        network: "x",
        publishedOn: "5 weeks ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Source of truth is a promise about six months from now, not about today.",
        likes: 520,
        comments: 18,
        reposts: 60,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "26d ago",
        note: "Surfaced from the weekly competitor scan (8 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-16",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "29d ago",
    kind: "later",
    headline: "The category language from Q1 has already been abandoned",
    summary:
      "Three phrases that were in every deck in January appear in almost nothing published this month. The half-life of category language is now about one quarter.",
    article: {
      title: "The category language from Q1 has already been abandoned",
      subheads: ["The three phrases", "How to write around it"],
      paragraphs: [
        "All three described a shape of software rather than a job, which is why they aged out as soon as the shape became common. Nobody differentiates on a shape everybody has.",
        "The copy that survived the quarter described tasks. Tasks do not go out of fashion, because the reader still has to do them on Monday.",
        "Acme's Q2 messaging contains two of the three phrases.",
      ],
    },
    posts: [
      {
        id: "topic-acme-16-p1",
        network: "linkedin",
        publishedOn: "4 weeks ago",
        author: { name: "Anthony Pierri", handle: "@anthonypierri", initials: "AP", accent: "orange" },
        text: "Every phrase that describes a category will be shared by everyone in it within two quarters. Describe the task instead.",
        likes: 2900,
        comments: 210,
        reposts: 230,
      },
      {
        id: "topic-acme-16-p2",
        network: "x",
        publishedOn: "5 weeks ago",
        author: { name: "Lenny's Newsletter", handle: "@lennysan", initials: "LN", accent: "soft-blue" },
        text: "Category language is rented, not owned.",
        likes: 760,
        comments: 28,
        reposts: 90,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "29d ago",
        note: "Surfaced from the weekly competitor scan (16 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-17",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "5w ago",
    kind: "ready",
    headline: "Linear's pricing page rewrite dropped the feature table entirely",
    summary:
      "Three plans, three sentences, no comparison grid. The table came back for two days and then went away again.",
    article: {
      title: "Linear's pricing page rewrite dropped the feature table entirely",
      subheads: ["What replaced the grid", "The two-day reversal"],
      paragraphs: [
        "Each plan is described by who it is for and the one limit that matters. The reader chooses on a sentence rather than by scanning forty rows for a tick.",
        "The grid returned briefly and was pulled again, which suggests it was tested rather than debated.",
        "Acme's pricing page has a forty-one-row table and no sentence describing any plan.",
      ],
    },
    posts: [
      {
        id: "topic-acme-17-p1",
        network: "linkedin",
        publishedOn: "5 weeks ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "New pricing page. Three plans, three sentences. If a row in a table is deciding your purchase, we have not explained the product.",
        likes: 1400,
        comments: 90,
        reposts: 105,
      },
      {
        id: "topic-acme-17-p2",
        network: "x",
        publishedOn: "6 weeks ago",
        author: { name: "Linear", handle: "@linear", initials: "LI", accent: "purple" },
        text: "Feature tables are for procurement, not for deciding.",
        likes: 620,
        comments: 34,
        reposts: 72,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5w ago",
        note: "Surfaced from the weekly competitor scan (3 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-18",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "7w ago",
    kind: "later",
    headline: "Operator-first is now everywhere and has stopped meaning anything",
    summary:
      "The phrase appears in eleven of the twenty accounts tracked, used to mean four different things. Acme's own voice profile leans on it.",
    article: {
      title: "Operator-first is now everywhere and has stopped meaning anything",
      subheads: ["The four meanings", "What to say instead"],
      paragraphs: [
        "It is used for audience (people who run things), for tone (plain language), for pedigree (the founder has operated), and for product (fewer approvals). Those are not the same claim.",
        "A phrase carrying four meanings communicates none of them, and the reader supplies whichever they already believed.",
        "Acme's voice profile uses it as tone. The tone is describable without it, in words the audience uses about their own work.",
      ],
    },
    posts: [
      {
        id: "topic-acme-18-p1",
        network: "linkedin",
        publishedOn: "7 weeks ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "'Operator-first' is in every bio I read this week. I still cannot tell what any of them are claiming.",
        likes: 2400,
        comments: 190,
        reposts: 140,
      },
      {
        id: "topic-acme-18-p2",
        network: "x",
        publishedOn: "8 weeks ago",
        author: { name: "Dave Gerhardt", handle: "@davegerhardt", initials: "DG", accent: "yellow" },
        text: "If your differentiator fits in eleven other bios, it is a genre, not a difference.",
        likes: 1150,
        comments: 52,
        reposts: 130,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "7w ago",
        note: "Surfaced from the weekly competitor scan (11 matching accounts).",
      },
    ],
  },
  {
    id: "topic-acme-19",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "2mo ago",
    kind: "ready",
    headline: "Basecamp's book still outperforms everything on its blog",
    summary:
      "A book published years ago drives more inbound conversation than any post this quarter. The asset compounds because it is quotable.",
    article: {
      title: "Basecamp's book still outperforms everything on its blog",
      subheads: ["Why it keeps working", "The smaller version"],
      paragraphs: [
        "The book is a set of positions with names. Named positions get quoted, and every quote carries the source with it, which is a distribution property a blog post does not have.",
        "It also outlives its own launch: the conversation this quarter is from readers who found it years late.",
        "The transferable version is not a book. It is naming two or three positions Acme will defend, and using the same names every time.",
      ],
    },
    posts: [
      {
        id: "topic-acme-19-p1",
        network: "linkedin",
        publishedOn: "2 months ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "Still the most common way people find us: someone quoted a chapter at them.",
        likes: 1800,
        comments: 140,
        reposts: 220,
      },
      {
        id: "topic-acme-19-p2",
        network: "x",
        publishedOn: "2 months ago",
        author: { name: "Basecamp", handle: "@basecamp", initials: "BC", accent: "menthol" },
        text: "Write the thing people can quote at each other when you are not in the room.",
        likes: 980,
        comments: 44,
        reposts: 160,
      },
    ],
    seedStatus: "ignored",
    seedReason: "Too old to lead with, and we've made this point already.",
    history: [
      {
        status: "new",
        when: "2mo ago",
        note: "Surfaced from the weekly competitor scan (2 matching posts).",
      },
    ],
  },
  {
    id: "topic-acme-20",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "3mo ago",
    kind: "later",
    headline: "Bundled AI stopped being a differentiator in about six weeks",
    summary:
      "Between February and April every tracked competitor shipped an assistant, and the claim went from headline to footnote across the whole set.",
    article: {
      title: "Bundled AI stopped being a differentiator in about six weeks",
      subheads: ["How fast it flattened", "What differentiates now"],
      paragraphs: [
        "Seventeen launches in six weeks, all with the same hero sentence. By the end of it the assistant had moved to the third screen of the same companies' pages.",
        "What stayed in the hero was the task the assistant removed. The ones that named a task still lead with it; the ones that named a capability do not lead with anything.",
        "Acme's Q2 hero names a capability.",
      ],
    },
    posts: [
      {
        id: "topic-acme-20-p1",
        network: "linkedin",
        publishedOn: "3 months ago",
        author: { name: "Lenny's Newsletter", handle: "@lennysan", initials: "LN", accent: "soft-blue" },
        text: "Everyone shipped an assistant. In six weeks it went from the headline to the footer. Capability is not positioning.",
        likes: 3600,
        comments: 240,
        reposts: 300,
      },
      {
        id: "topic-acme-20-p2",
        network: "x",
        publishedOn: "3 months ago",
        author: { name: "Elena Verna", handle: "@elenaverna", initials: "EV", accent: "red" },
        text: "The AI in your hero is now table stakes. What does it stop me doing?",
        likes: 1300,
        comments: 58,
        reposts: 150,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "3mo ago",
        note: "Surfaced from the weekly competitor scan (17 matching launches).",
      },
    ],
  },
  {
    id: "topic-acme-21",
    feedId: "feed-acme",
    sourceId: "competitor-posts",
    ageLabel: "4mo ago",
    kind: "ready",
    headline: "Notion's community pages outrank its own product pages",
    summary:
      "Search results for the category are dominated by pages Notion did not write. The product pages sit below them.",
    article: {
      title: "Notion's community pages outrank its own product pages",
      subheads: ["What is ranking", "The uncomfortable read"],
      paragraphs: [
        "Templates, forum answers and third-party walkthroughs occupy the first page. All of them are about the product and none of them are controlled by it.",
        "That is enormous reach and no message discipline: the first thing a buyer reads is written by someone with no stake in the positioning.",
        "Acme has no community surface, which means no reach and complete control. Neither is obviously better, and it is worth deciding on purpose.",
      ],
    },
    posts: [
      {
        id: "topic-acme-21-p1",
        network: "linkedin",
        publishedOn: "4 months ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Most people meet us through something a customer built. We stopped treating that as a problem.",
        likes: 2000,
        comments: 96,
        reposts: 180,
      },
      {
        id: "topic-acme-21-p2",
        network: "x",
        publishedOn: "4 months ago",
        author: { name: "Notion", handle: "@notion", initials: "NO", accent: "grey" },
        text: "Our best-performing pages are the ones we did not write.",
        likes: 700,
        comments: 30,
        reposts: 88,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "4mo ago",
        note: "Surfaced from the weekly competitor scan (6 matching posts).",
      },
    ],
  },
  // -- THE REAL TOPICS (31) --------------------------------------------------
  // From the same export. Mapping: laneId to feedId, research to article,
  // researchType "content-strategy" to kind "later" and "ready-to-post" to
  // "ready". Not carried: whyNowDetail, history, versions, volume, whatChanged -
  // this repo renders none of them, and unused seed data rots.
  {
    id: "br-40",
    feedId: "topic-list-7",
    sourceId: "competitor-posts",
    ageLabel: "1d ago",
    kind: "ready",
    headline: "Timber accounts own 'sustainable material'. Nobody owns 'cheaper to live in'",
    summary:
      "Four posts across Sibomat and Stabilame sell wood frame and CLT on carbon storage, local sourcing and thermal comfort. Every claim is about the material. None is about the bill that arrives after someone moves in.",
    whyNow:
      "The densest cluster in the whole window — timber sustainability posts across multiple accounts through late June and July, and the single theme the scan ranked highest by volume.",
    isTrending: true,
    article: {
      title: "They are selling the material. The renter is paying the running cost",
      subheads: ["Two accounts, one vocabulary", "The bill that decides affordability"],
      paragraphs: [
        "Four posts in this window make the same case from two accounts. Sibomat explains why it builds in softwood — renewable, strong for its weight, thermally efficient — and pairs that with indoor comfort and durability language. Stabilame shows a Stoumont house where the structure is glued CLT and the wall finishes are cut from the same panels, selling total material harmony. A third Sibomat post uses a couple who chose timber frame twice, thirty-five years apart, as proof the method lasts.",
        "The vocabulary is remarkably consistent: renewable sourcing, carbon storage, certified forest origin, insulation performance. It is a good argument and it is well made. But every single claim is about the material the building is made of, and the story stops at handover.",
        "What none of them says is what the building costs to run. Energy Star and DOE ZERH are operating-cost standards, not material credentials — they describe the bill after somebody moves in, which for a household already over the 30% rent threshold is the number that decides whether the apartment is attainable at all.",
        "That is the opening, and it is a different argument rather than a louder version of theirs. Borrowing the timber-sustainability frame would concede the point to accounts who own it and can out-detail us on it. Leading with the operating cost puts the conversation on ground where a steel skeleton and 95% factory-installed MEP is the stronger answer, not the weaker one.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "1 day ago",
        note: "Surfaced from the 16 Jun – 16 Jul Instagram scan (4 matching items).",
      },
    ],
  },
  {
    id: "br-41",
    feedId: "topic-list-7",
    sourceId: "competitor-posts",
    ageLabel: "3d ago",
    kind: "ready",
    headline: "A competitor argues AGAINST finishing in the factory. That argument has a number",
    summary:
      "Sibomat concedes modular is popular and faster, then explains why it deliberately assembles on the plot instead: standard modules cannot follow a family's brief or an awkward site. It is the clearest statement of the objection in the window.",
    isUpdated: true,
    article: {
      title: "Yes, modules are faster. The question is whether 90% costs you the floor plan",
      subheads: ["A competitor makes the objection for us", "What 90% actually standardises"],
      paragraphs: [
        "Sibomat's post is unusually direct for a competitor. It grants that modular building is popular and rightly so — preparing walls and structures in a controlled workshop delivers speed, quality and a more efficient process. Then it explains the deliberate choice to do something else: prefabricate in the atelier, but carry out the rest of the build on the plot itself, so the house can follow one family's requirements and one site's contours instead of a standard module.",
        "Stabilame makes the same point from the commercial side, with a wood post-and-beam brasserie at Froidchapelle sold on panoramic integration with the lakes and bespoke interior detailing.",
        "This is the objection worth answering directly, because it is the honest version of it. The unhelpful reply is to claim modules are just as flexible. The useful reply is that the 90% figure is about the parts nobody chooses — the steel skeleton, the risers, the 95% of MEP that goes in indoors — and that finishing those in a factory is what buys the rent reduction. The floor plan is not what gets standardised; the plumbing is.",
        "There is a second-order point available too. Their argument assumes one house on one plot. At apartment scale the trade inverts: repetition is the product, and a controlled indoor environment is how you get consistent MEP across ninety units rather than ninety variations of it.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "2 weeks ago",
        note: "Surfaced from the competitor scan (1 matching item).",
      },
      {
        status: "new",
        when: "3 days ago",
        note: "Re-scanned — 4 matching items, and a second account joined it.",
      },
    ],
  },
  {
    id: "br-42",
    feedId: "topic-list-7",
    sourceId: "competitor-posts",
    ageLabel: "5d ago",
    kind: "later",
    headline: "Two competitors are filming the build. A factory line is a better episode than a muddy site",
    summary:
      "Maisons Blavier launched a bilingual behind-the-scenes site series and Thomas & Piron a site-manager memories series, both in the same fortnight. The format is proven and the subject is transparency.",
    article: {
      title: "The format is available. The footage is the commitment",
      subheads: ["Three posts, one proven format", "What a credible series costs"],
      paragraphs: [
        "Three posts in a two-week window run the same play. Maisons Blavier published part one of a site series in French and again in Dutch, promising to show how a house takes shape phase by phase and how its teams track progress. Thomas & Piron ran a site manager recalling his last project — a fully circular fire station designed by Philippe Samyn. Mi Casa, outside the Idea, is doing a production-process series of its own.",
        "The demand behind it is uncertainty: someone committing to a build wants to see the phases, the checks and who is watching. That is exactly the anxiety a factory answers better than a site does — a controlled line, repeatable stations, quality control that is measured rather than described.",
        "Which is why this is a commitment rather than a post. A credible series needs factory access, a camera on the line across several weeks, someone to own the edit, and sign-off to show a process competitors would study. The alternative — one polished flythrough — is a brochure, and the format's whole appeal is that it does not look like one.",
        "Blocked on: factory filming access and a named owner for a recurring slot. Without both this becomes a single video that sets an expectation nothing follows.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5 days ago",
        note: "Surfaced from the competitor scan (3 matching items).",
      },
    ],
  },
  {
    id: "br-43",
    feedId: "topic-list-7",
    sourceId: "competitor-posts",
    ageLabel: "2w ago",
    kind: "later",
    headline: "Stabilame is winning civic work — a marina office built over water",
    summary:
      "Three project announcements clustered at the start of July: the Capitainerie at Ath standing largely on water, new visitor infrastructure at the Grottes de Han, and the Domaine de Chevetogne. Public amenities, won on short local supply chains.",
    article: {
      title: "The buyer here is a municipality, and it is a different sale entirely",
      subheads: ["Civic work, won on short supply chains", "Why a residential reference won't do"],
      paragraphs: [
        "Three Stabilame posts in the first half of July announce civic and recreational work: the Capitainerie at Ath, much of it over water; the new reception buildings at the Domaine des Grottes de Han, open to the public this summer; and the Domaine de Chevetogne. The copy leans on short local supply circuits, techniques for building in wet conditions, and low environmental impact.",
        "This is the one thread in the window with a completely different buyer. A municipality or a regional operator is not comparing rent to income — it is comparing a tender, a timetable and a maintenance liability, and it is accountable for the choice in public.",
        "The argument transfers, but the proof does not. Factory completion is genuinely stronger for public work: a fixed programme, fewer weather-dependent weeks, and a predictable snag list. What is missing is a delivered civic building to point at, and public-sector procurement does not accept a residential reference as evidence.",
        "Blocked on: one completed public or institutional project with a named client willing to be cited, plus whatever framework or prequalification the relevant procurement route requires. Until then this is a market to watch, not a campaign to run.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "2 weeks ago",
        note: "Surfaced from the competitor scan (4 matching items).",
      },
    ],
  },
  {
    id: "br-44",
    feedId: "topic-list-7",
    sourceId: "competitor-posts",
    ageLabel: "3w ago",
    kind: "later",
    headline: "Half the industry closed for July. A factory does not take a building holiday",
    summary:
      "Blavier, Naturhome and Stabilame all posted shutdown notices for the same three weeks — Belgium's statutory construction holiday. Sites stop; the model that assembles indoors does not have to.",
    article: {
      title: "The most revealing posts in the scan are the out-of-office ones",
      subheads: ["Three out-of-office notices, one fortnight", "The schedule argument, and its tone problem"],
      paragraphs: [
        "Three accounts published near-identical notices in the second week of July. Maisons Blavier closed its offices until 3 August, in French and again in Dutch, while keeping advisors reachable. Naturhome paused from 18 July to 3 August. Stabilame's whole team went from 10 July to 2 August. This is the Belgian construction holiday — statutory, industry-wide, and unremarkable to anyone in the sector.",
        "The export flagged this Idea as self-promotional and declined to write it up, which is the right call about the posts themselves: they are logistics notices, and there is nothing to say back to an out-of-office.",
        "It is kept because of what it accidentally demonstrates. Site-dependent construction has weeks in the year when nothing progresses, and everyone in the market has silently agreed which weeks those are. A model that assembles indoors is not exposed to that in the same way — the schedule argument writes itself.",
        "Blocked on a decision rather than an asset, and not a comfortable one: this only works as a schedule-reliability argument, and it has to be made without appearing to mock a statutory holiday that protects workers. Wrong tone and it reads as a firm boasting that its people do not get August off.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "3 weeks ago",
        note: "Surfaced from the competitor scan (3 matching items).",
      },
    ],
  },
  {
    id: "br-10",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "11d ago",
    kind: "ready",
    headline: "Beyond the mats: how BJJ builds resilient, confident kids",
    summary:
      "Gracie Barra and Six Blades are both pushing youth programs on character building — 'raise boys who are kind, confident, and capable' — and taking students as young as four. The claim is everywhere; the mechanism behind it is explained nowhere.",
    article: {
      title: "The parent's real question isn't 'will it work' — it's 'will it make my child aggressive'",
      subheads: ["Character is the category's pitch", "Why the safest room produces the least fighting"],
      paragraphs: [
        "Across the tracked Carlsbad academies, youth programs are being sold on character: kind, confident, capable children, sometimes from age four. The shift is a good one, and it is now the category default rather than a differentiator. What none of the posts do is answer the hesitation that actually stops a parent signing up — whether martial arts will teach their child to settle conflict with their fists.",
        "That question has a real answer, and it is structural rather than cultural. Most martial arts are striking arts: they train a child to meet conflict with immediate outward aggression. Brazilian Jiu-Jitsu is grappling — leverage, technique and control. A child is taught to neutralise a threat, control a situation and escape safely, which is a fundamentally different instinct to rehearse. Every movement is cause and effect, so the training rewards keeping a cool head and thinking, not swinging.",
        "The mat culture is the other half of it. A child who does not feel safe cannot build resilience — an environment that is chaotic or overly competitive puts them in survival mode, and character development stops there. The clearest expression of the opposite is the tap: when a partner taps, everything stops, immediately and without exception. That single rule teaches respect for someone else's boundaries and that it is safe to admit you are caught. Strength is for protecting and controlling, never for intimidating.",
        "This is also why capable children fight least. Bullying runs on insecurity in both directions — the aggressor proving dominance, the target projecting fear. A child who knows with certainty that they could control a confrontation, and do it without hurting anyone, has nothing left to prove. That is the angle the local conversation has left open: not that character development matters, but how it is actually produced.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5h ago",
        note: "Surfaced from the 1–31 July competitor scan (8 matching posts).",
      },
    ],
  },
  {
    id: "br-11",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "5h ago",
    kind: "ready",
    headline: "What do BJJ belt promotions really mean for your child's growth?",
    summary:
      "Gracie Barra, Freedom and Six Blades are all posting belt and stripe promotions, and it is the highest-engagement theme in the set. Everyone shows the milestone; nobody explains what earning it actually built.",
    whyNow: "Belt and stripe promotions are the highest-volume theme across all three tracked competitors this month.",
    isTrending: true,
    article: {
      title: "A belt is a byproduct of the person a child is becoming",
      subheads: ["An honest system, poorly explained", "Plateaus, stripes and the comparison trap"],
      paragraphs: [
        "In a category full of participation trophies, the youth belt system is unusually honest — and unusually badly explained. Children move white, grey, yellow, orange, green, earning up to four stripes inside each rank. Those stripes are the mechanism worth talking to parents about: for a young child a year is an eternity, and stripes break an intimidating goal into phases small enough to feel. Each one is a signal that daily effort is compounding.",
        "The reason it works is that the recognition is earned rather than given. A promotion arrives after a child has worked through frustration, refined something they were bad at, and shown up disciplined when they were tired. That teaches the thing empty praise cannot: that their success sits entirely inside their own control. Confidence built that way does not break when life produces a setback.",
        "The mats behave like a laboratory for that. A student chasing a stripe will hit plateaus — a position they cannot escape, a newer partner who suddenly gives them trouble — and with decent coaching they learn to read those as information rather than failure. The question shifts to 'what do I do differently next time?'. Children who discover that consistency produces progression on the mats start applying it to schoolwork without being told to.",
        "There is a practical parent angle here too, and it is a corrective. The instinct is to compare — why did another child get a stripe first? The more useful move is to ask what they improved today rather than what they received, to normalise plateaus rather than apologise for them, and to model showing up on the days motivation is low. That is the piece the promotion posts never carry.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5h ago",
        note: "Surfaced from the 1–31 July competitor scan (13 matching posts).",
      },
      {
        status: "trending",
        when: "5h ago",
        note: "Flagged trending — highest-volume theme in the scan.",
      },
    ],
  },
  {
    id: "br-12",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "6w ago",
    kind: "ready",
    headline: "Returning to the mats: how to restart your BJJ journey safely",
    summary:
      "Six Blades welcomed back a student after a three-year hiatus, and it wasn't an isolated post. There is a local audience trying to come back, and nothing in the set speaks to what makes a comeback fail.",
    article: {
      title: "The comeback fails on ego long before it fails on cardio",
      subheads: ["The hesitations, and the real obstacle", "The ramp, and the room you pick"],
      paragraphs: [
        "A dusty gi in the back of a closet comes with a specific set of hesitations: whether the cardio is gone, whether the joints will hold, whether you can keep pace with people who never stopped. The local signal is that plenty of people in North County are having that thought — former white belts who trained for a few months three years ago, coloured belts who took a multi-year break for work or family.",
        "The obstacle is almost never conditioning. It is that your brain remembers techniques your body cannot yet execute, so timing and spatial awareness lag behind knowledge. Force the gap closed with raw athletic effort and the injury rate climbs. The useful reframe is to stop trying to win rounds and start collecting data: accept that you will be slower and more easily fatigued, and treat that as a temporary state rather than a new baseline.",
        "Physically it wants a ramp, because grappling loads the neck, shoulders, lower back and knees, and a desk-bound body needs to re-adapt to that. Three things do most of the work: a real warm-up that mobilises hips and shoulders, controlled intensity — you are allowed to decline a roll or ask to keep the pace down — and positional sparring from closed guard or side control instead of open scrambles, which is where injuries happen.",
        "Which makes the choice of academy the actual decision. A room that treats every round like a championship final is a poor bet for someone returning, or for anyone who has to be functional at work tomorrow. A structured adult curriculum rebuilds fundamentals in a cooperative setting before adding resistance, and coaches who watch mat dynamics will pair a returning student with partners who are safe rather than eager.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5h ago",
        note: "Surfaced from the 1–31 July competitor scan (6 matching posts).",
      },
    ],
  },
  {
    id: "br-13",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "2d ago",
    kind: "later",
    headline: "The family that rolls together: BJJ as a shared lifestyle",
    summary:
      "Competitors are running family classes and turning academy anniversaries into family community events. The angle is strong and the volume is high — but this one can't be written yet, because it needs assets nobody has shot.",
    article: {
      title: "Blocked on assets, not on the idea",
      subheads: ["Parents on the mat, not on the sideline", "One shoot, three formats"],
      paragraphs: [
        "The opening is parents training alongside their children rather than watching from the side, positioning one academy as the place where both find a real program rather than a compromise. Competitors are already gathering families — family classes, anniversaries run as community events — so the audience is assembled and the framing is unclaimed.",
        "The export flagged this Idea as needing assets before it can be written, and the two it names are specific: high-quality photos or video of Carlsbad families actually training at the academy, and testimonials from parents who train alongside their kids. Neither can be substituted with stock — the whole claim is that this happens here.",
        "Suggested formats were an Instagram carousel, a short video reel, and a blog post — which is to say the shoot serves all three, so the asset gap is one production job rather than three.",
        "Worth noting what the same scan told us NOT to copy: competitors' generic Independence Day posts were flagged as carrying no brand angle at all, and Gracie Barra's 1st-anniversary celebration and belt-rank seminars were flagged as self-promotional events that don't translate into a credible theme for another academy. The family angle is the part of the community conversation that does transfer.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "5h ago",
        note: "Surfaced from the 1–31 July competitor scan (11 matching posts).",
      },
      {
        status: "trending",
        when: "5h ago",
        note: "Flagged trending — second-highest-volume theme in the scan.",
      },
    ],
  },
  {
    id: "br-14",
    feedId: "topic-list-5",
    sourceId: "competitor-posts",
    ageLabel: "12d ago",
    kind: "ready",
    headline: "From Summer to Autumn: Smart Transitional Layering for the Belgian Climate",
    summary:
      "Advice on building a transitional wardrobe with light layering pieces and versatile essential tops without immediately packing away your summer wardrobe. Focuses on practical multi-brand solutions for unpredictable Belgian weather.",
    article: {
      title: "Belgian weather demands smart layers, not a sudden wardrobe swap",
      subheads: ["Why a wardrobe swap is the wrong move", "Combinations that carry summer into October"],
      paragraphs: [
        "You know the feeling: the mornings already feel surprisingly crisp, while the afternoon sun warms up the terrace again. In fashion stores and across social media, heavy autumn collections and winter coats are already being pushed everywhere. Yet it is far too early to permanently banish your favorite summer items to the attic.",
        "The secret to effortless style during this transitional period lies not in hastily purchasing a complete autumn wardrobe, but in masterfully combining light layers. As a Belgian multi-brand expert, we at Noba Fashion know how quickly our climate can shift. With a few cleverly chosen basic pieces from our wide brand selection, you can transform your summer outfits into autumn-proof combinations in no time.",
        "A successful transitional look relies on garments that adapt easily to temperature fluctuations. Lightweight knitwear is the ultimate in-between piece: a finely knit cardigan or a thin cotton sweater goes over a summer dress or top in the morning, and around your shoulders as soon as the sun breaks through. Timeless denim and light trousers form the foundation — enough protection against a cool breeze, and they pair effortlessly with both sunny tops and autumn blazers. And a versatile mid-season jacket, whether a classic trench coat, a denim jacket or a refined overshirt, instantly elevates any look while staying practical for life on the go.",
        "Fashion is about smart combinations, not monthly overhauls. An airy summer dress gains an instant autumnal feel layered under a tailored blazer, with open sandals swapped for closed-toe shoes or ankle boots. A sleeveless summer top carries over just as easily under a fluid button-down shirt worn open as a light jacket. Combining different brands within a single outfit gives you the freedom to refine your personal style — functional for the morning rush, elegant for work, comfortable for the weekend.",
        "The Belgian autumn requires flexibility. By resisting the urge to jump straight into heavy winter wear and focusing instead on thoughtful transitional layers, you get the absolute most out of your closet. With a few strong foundational elements from our multi-brand selection, you can step out the door every morning with confidence — no matter what your weather app predicts.",
      ],
    },
    posts: [
      {
        id: "br-14-p1",
        network: "instagram",
        publishedOn: "3 weeks ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "30 graden op de planning = tijd voor luchtige zomerlooks. ☀️ En laat dat nu nét goed uitkomen: we hebben extra veel shorts, T-shirts, kleedjes en andere zonnige items toegevoegd aan onze SOLDEN.",
        likes: 163,
        comments: 2,
        reposts: 0,
      },
      {
        id: "br-14-p2",
        network: "instagram",
        publishedOn: "11 days ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Onze #JBCfamily gespot aan zee in de leukste (matching) outfits. Staat een tripje naar de Belgische kust ook nog op jullie planning deze zomer? 🌊",
        likes: 78,
        comments: 1,
        reposts: 0,
      },
      {
        id: "br-14-p3",
        network: "instagram",
        publishedOn: "3 weeks ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Onze allermooiste #JBCfamily gespot op vakantie! 🌞 Deel ook je leukste vakantiekiekjes met ons @jbcfashion. 💛",
        likes: 143,
        comments: 1,
        reposts: 0,
      },
      {
        id: "br-14-p4",
        network: "instagram",
        publishedOn: "3 weeks ago",
        author: {
          name: "ZEB",
          handle: "@zebfashion",
          initials: "ZE",
          accent: "orange",
        },
        text: "Hold the screen to discover your holiday essential 🌴✅️ #zebfashion #multibrandstore #vakantie",
        likes: 3,
        comments: 4,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "2h ago",
        note: "Surfaced from the 4 July – 3 August competitor scan (4 matching posts). Keywords: 30 graden, zomerlooks, vakantie, zee.",
      },
    ],
  },
  {
    id: "br-15",
    feedId: "topic-list-5",
    sourceId: "competitor-posts",
    ageLabel: "2h ago",
    kind: "ready",
    headline: "Less Impulse, More Value: Building a Sustainable Sale Capsule",
    summary:
      "Strategic styling advice on leveraging the final sale days to build a timeless capsule wardrobe rather than chasing impulsive discounts. Focuses on selecting high-quality basic pieces and multi-brand classics.",
    whyNow:
      "The final markdown weeks run straight through the 30-day scan, with discount messaging on three of the five tracked accounts at once.",
    isTrending: true,
    article: {
      title: "Don't get carried away by sale frenzy: choose smart investments",
      subheads: ["The pitfall of the final sale weeks", "Building a capsule instead of a pile"],
      paragraphs: [
        "Red stickers, aggressive discounts up to -70%, and slogans shouting 'now or never': the final sale weeks can be overwhelming. The pitfall of this period is well known — you come home with garments that were fantastically discounted, only for them to sit at the back of your closet after a single wear because they match nothing else you own.",
        "At Noba Fashion, we take a different view of sales. We don't see them as a hunt for as many cheap items as possible, but as the moment to secure high-quality multi-brand classics that will last for years. With a targeted approach, an impulsive shopping trip becomes a sustainable upgrade to your wardrobe.",
        "A successful sale purchase meets three simple criteria: the fit is perfect, the quality is exceptional, and the item fits seamlessly into your daily lifestyle. Ask yourself with every item whether you would consider buying it at full price — if the answer is yes, you have found a genuine gem. During the final markdowns that points at three categories: a timeless, well-cut blazer in a neutral shade such as navy, sand or black; high-quality jeans or trousers from a top brand with a great fit; and classic knitwear and blouses — crisp white shirts, finely knit wool or cotton sweaters, neatly finished tops.",
        "The great advantage of a multi-brand store is being able to compare and combine pieces from different quality brands side by side. A capsule wardrobe is ideally around ten well-coordinated garments you can mix and match effortlessly. Searching for neutral color palettes during the sales — warm beige, grey, deep blue, olive green — is what makes new additions integrate with what is already in your closet, and what removes the familiar 'I have nothing to wear' frustration on a busy morning.",
        "Shopping with a plan brings peace of mind. Instead of getting lost in overcrowded racks filled with fleeting trends, a thoughtful shopping visit helps you build a reliable wardrobe you can count on. Style isn't about the quantity of clothes in your closet, but about the quality and versatility of the pieces you wear — which is how you walk away from the final sale weeks with true long-term value rather than buyer's remorse.",
      ],
    },
    posts: [
      {
        id: "br-15-p1",
        network: "instagram",
        publishedOn: "3 weeks ago",
        author: {
          name: "The Fashion Store",
          handle: "@thefashionstore_be",
          initials: "TF",
          accent: "purple",
        },
        text: "Op zoek naar verkoeling? Onze winkels hebben airco! Én je geniet van solden met kortingen tot -70%*🛍️",
        likes: 3,
        comments: 0,
        reposts: 0,
      },
      {
        id: "br-15-p2",
        network: "instagram",
        publishedOn: "4 weeks ago",
        author: {
          name: "ZEB",
          handle: "@zebfashion",
          initials: "ZE",
          accent: "orange",
        },
        text: "Beat the heat & shop je zomer items tot -70%* instore of via link in bio 🔗",
        likes: 3,
        comments: 0,
        reposts: 0,
      },
      {
        id: "br-15-p3",
        network: "instagram",
        publishedOn: "10 days ago",
        author: {
          name: "The Fashion Store",
          handle: "@thefashionstore_be",
          initials: "TF",
          accent: "purple",
        },
        text: "Groetjes van onze #thefashionstorelovers vanop vakantie ☀️ Shop je favoriete vakantielooks aan kortingen tot -70%* ✨",
        likes: 3,
        comments: 1,
        reposts: 0,
      },
      {
        id: "br-15-p4",
        network: "instagram",
        publishedOn: "4 weeks ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Maak je vakantiekoffer klaar met de favoriete zomerlooks van @oliviaburguet, @ashleygaleyn en @maimouna.badjie. Ontdek nu nog meer items in SOLDEN! 🌞",
        likes: 92,
        comments: 0,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "2h ago",
        note: "Surfaced from the 4 July – 3 August competitor scan (4 matching posts).",
      },
      {
        status: "trending",
        when: "2h ago",
        note: "Flagged trending — discount messaging runs across three accounts at once.",
      },
    ],
  },
  {
    id: "br-16",
    feedId: "topic-list-5",
    sourceId: "competitor-posts",
    ageLabel: "4mo ago",
    kind: "ready",
    headline: "Showing Your Colors: How to Wear Autumn's Plum & Warm Earth Tones Trend",
    summary:
      "Practical styling guide for integrating rich autumn colors like plum (brownish pink) and warm earth tones into an existing wardrobe. Demonstrates how to subtly balance this trend with neutral basic elements.",
    article: {
      title: "Add depth to your wardrobe with autumn's richest hues",
      subheads: ["This season's shift toward depth", "Texture is what makes earth tones work"],
      paragraphs: [
        "As summer days shorten, the fashion world's color palette transforms. This season sees a clear shift toward deep, warm tones that exude luxury and calm. The absolute showstopper of this autumn is plum — a refined, deep brownish-pink shade — accompanied by warm earth tones like rust brown, chocolate and soft terracotta.",
        "While these rich colors look stunning on mannequins, many women wonder how to translate this trend into their own daily wardrobes. Nobody wants to purchase a head-to-toe outfit that feels dated after a single season. At Noba Fashion, we show you how to introduce these trend colors subtly and stylishly.",
        "Plum serves as the perfect bridge between classic and modern: it has the warmth of brown and the softness of pink, which makes it a surprisingly accessible color for virtually every skin tone. Wear it as a stylish accent — a plum handbag, belt or scarf against grey trousers and a white blouse — or as a statement top, a fluid blouse or knit sweater with your trusted blue jeans, which gives an everyday look extra character without feeling over-the-top. For those who want to make a statement, tone-on-tone with soft pink or warm brown is softer than black-and-white and remarkably elegant.",
        "Alongside plum, rich earth tones form the foundation for a harmonious autumn look, and the key to wearing them lies in playing with textures. A warm brown suede skirt paired with a smooth cotton top, or a rust-colored cardigan layered over a denim shirt, creates engaging visual dynamics that a single flat color cannot. The benefit of a wide multi-brand selection is that different shades of brown and plum from various brands sit side by side in one place, so you find the exact nuance that makes your complexion glow.",
        "Fashion should remain fun and, above all, fit who you are. You don't need to reinvent your entire style to follow the latest trends: adding just one or two key pieces in plum or a warm earth tone gives your familiar outfits a fresh, contemporary appeal. With the right balance between striking trend colors and timeless basics, you can step out the door this autumn feeling confident and stylish.",
      ],
    },
    posts: [
      {
        id: "br-16-p1",
        network: "instagram",
        publishedOn: "10 days ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Volgende week gaat Circus CAMILLE van start… en ook JBC is er dit jaar opnieuw bij met een superleuke stand vol officiële CAMILLE-merch. In deze video krijg je alvast een eerste sneak peek van het nieuwe Circus CAMILLE T-shirt. 🎪✨",
        likes: 2830,
        comments: 34,
        reposts: 0,
      },
      {
        id: "br-16-p2",
        network: "instagram",
        publishedOn: "8 days ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Nieuwe CAMILLE x JBC-collectie én Circus Merch loading... ❤️‍🔥 Heel snel verkrijgbaar... #CAMILLExJBC #CAMILLEcollectie",
        likes: 1058,
        comments: 47,
        reposts: 0,
      },
      {
        id: "br-16-p3",
        network: "instagram",
        publishedOn: "6 days ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Miauw! Voor haar nieuwste collectie liet @camille_dhont zich inspireren door haar eigen kat: Moustache. Shop jouw favoriete looks nu al op JBC.be en vanaf morgen in alle JBC-winkels.",
        likes: 1013,
        comments: 22,
        reposts: 0,
      },
      {
        id: "br-16-p4",
        network: "instagram",
        publishedOn: "6 days ago",
        author: {
          name: "JBC",
          handle: "@jbcfashion",
          initials: "JB",
          accent: "red",
        },
        text: "Er is een nieuwe designer bij CAMILLE x JBC. Hij miauwt, hij heeft snorharen, en hij heet Moustache. Het is... de kat van CAMILLE! Van printjes tot piepkleine details, Moustache heeft zijn pootafdrukje letterlijk overal achtergelaten.",
        likes: 879,
        comments: 17,
        reposts: 0,
      },
      {
        id: "br-16-p5",
        network: "instagram",
        publishedOn: "12 days ago",
        author: {
          name: "ZEB",
          handle: "@zebfashion",
          initials: "ZE",
          accent: "orange",
        },
        text: "NEW: de drinkflessen van Dopper in superleuke zomerkleurtjes🚰☀️ Gemaakt met 90% gerecycleerd staal ✅️",
        likes: 3,
        comments: 0,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "2h ago",
        note: "Surfaced from the 4 July – 3 August competitor scan (5 matching posts). Keywords: collectie, print, kleuren, nieuwe collectie.",
      },
    ],
  },
  {
    id: "br-20",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "4d ago",
    kind: "later",
    headline: "The competing gym's kids programme now runs on the same nights as yours",
    summary:
      "Their schedule page changed this week. The Tuesday and Thursday kids classes that used to sit opposite yours now overlap them exactly, and their last three posts push that timetable.",
    isUpdated: true,
    article: {
      title: "The timetable gap has closed",
      subheads: ["What changed since the last scan", "What the comparison falls back to"],
      paragraphs: [
        "This Idea originally described a scheduling gap: the nearest competing academy ran its kids programme on nights you did not, so parents comparing the two were not choosing between them. Their schedule page now shows the same Tuesday and Thursday slots.",
        "The angle changes with it. Availability is no longer the differentiator, so the comparison falls back to instructor ratio and belt progression — both things your own posts already document and theirs do not.",
      ],
    },
    posts: [],
    seedStatus: "new",
  },
  {
    id: "br-21",
    feedId: "topic-list-5",
    sourceId: "competitor-posts",
    ageLabel: "5d ago",
    kind: "ready",
    headline: "The multibrand discount wave has stopped, three weeks early",
    summary:
      "Four of the five tracked accounts pulled their sale messaging this week and went back to full-price editorial. The markdown conversation you were planning to answer has already moved on.",
    isUpdated: true,
    article: {
      title: "The sale ended before the response could ship",
      subheads: ["The wave ended three weeks early", "What survives the change in timing"],
      paragraphs: [
        "The original reading of this Idea was that a sustained discount wave gave a sustainable-wardrobe message something concrete to push against. That wave has ended earlier than the seasonal pattern suggested — four of five accounts are back to full-price editorial.",
        "What survives is the observation, not the urgency: shoppers who bought in the wave are three weeks from regret posts, which is a better moment for the capsule argument than the sale itself was.",
      ],
    },
    posts: [],
    seedStatus: "new",
  },
  {
    id: "br-22",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "18d ago",
    kind: "ready",
    headline: "Consistency is the only thing every promotion in this town has in common",
    summary:
      "Eleven July posts frame progress the same way — show up, keep showing up, the rank follows. Nobody explains what consistency actually looks like in a first year, which is the part a beginner is trying to work out before they sign.",
    article: {
      title: "Everyone says 'stay consistent'. Almost nobody says what that means in practice",
      subheads: ["Eleven posts, one word: consistency", "The number nobody publishes"],
      paragraphs: [
        "Eleven of the twenty-five posts in the July window frame training as a long-term journey built on steady effort — belt and stripe promotions, anniversary reflections, open mats. The vocabulary is remarkably uniform across the three tracked academies: endurance, perseverance, showing up. Sixty-four percent of it ran on Instagram, the rest on Facebook.",
        "The messaging is also honest about pressure. Several posts note that sparring is where technique gets tested and that the pressure is productive when paired with patience — training rounds framed as a place to try things and help a partner improve rather than to win. That is a genuinely useful thing to say to an adult who is worried about being the worst person in the room.",
        "Where the category stops short is the specific. 'Be consistent' is advice you can only act on if you know the number. Two sessions a week for a year is a different proposition to four, and a beginner deciding whether this fits around a job is doing exactly that arithmetic. None of the tracked posts answer it.",
        "The opening is the mechanics rather than the mindset: what a realistic first year looks like week by week, what actually stalls people at the three-month mark, and why missing a fortnight does not undo it. The sentiment is taken; the specifics are unclaimed.",
      ],
    },
    posts: [],
    seedStatus: "used",
    history: [
      {
        status: "new",
        when: "18 days ago",
        note: "Surfaced from the 1–31 July competitor scan (11 matching posts).",
      },
      {
        status: "used",
        when: "9 days ago",
        note: "Drafted into a chat — first-year expectations post.",
      },
    ],
  },
  {
    id: "br-23",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "3d ago",
    kind: "ready",
    headline: "The best coaching in the room happens between rounds",
    summary:
      "Gracie Barra ran a post asking students for the best advice they had been given on the mats, and it outperformed everything else they published in July. The subject — peer learning, not instruction — is barely covered by anyone else.",
    whyNow:
      "Peer-learning posts drew the highest engagement of any theme in the window, on ten matching posts across two accounts.",
    isTrending: true,
    article: {
      title: "The thing beginners are most afraid of is the thing that teaches them fastest",
      subheads: ["The post about what happens between rounds", "Nobody explains how the culture is produced"],
      paragraphs: [
        "One tracked account published a post in late July about the conversations that happen between rounds — questions asked, experiences swapped, advice passed down — and closed it by asking followers for the best guidance they had received on the mats. It drew more response than any of that account's promotional posts in the same window.",
        "The framing matters. It presents the room as collaborative rather than competitive, and it makes the explicit claim that a beginner has something to learn from everyone training near them, not only from the instructor. Ten posts across two academies touched the theme; sixty percent ran on Instagram.",
        "This lands on the exact hesitation that keeps adults out of a first class. The fear is not injury so much as being the least capable person present and having that be visible. A room where the person ahead of you is expected to help you is a different proposition to one where they are expected to beat you.",
        "The gap is that everyone celebrates the culture and nobody explains how it is produced. It is not accidental — it comes from how rounds are paired, how the tap is treated, and what an instructor does when a stronger student goes too hard. That is the piece worth writing, because it is the piece a parent or a returning adult is actually assessing.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "3 days ago",
        note: "Surfaced from the 1–31 July competitor scan (10 matching posts).",
      },
      {
        status: "trending",
        when: "2 days ago",
        note: "Flagged trending — engagement above the window baseline.",
      },
    ],
  },
  {
    id: "br-24",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "7w ago",
    kind: "ready",
    headline: "Is grappling alone enough? The striking question parents keep asking",
    summary:
      "Six Blades has its 'Little Samurai' group training stand-up striking alongside grappling. One post, one account — but it puts a question in front of parents that is worth answering properly.",
    article: {
      title: "Most of what a child actually faces isn't a punch",
      subheads: ["One post, one implied criticism", "What a playground confrontation actually is"],
      paragraphs: [
        "A single Instagram post in the July window shows a nearby academy's seven-to-twelve group working stand-up striking alongside their grappling. One matching item out of twenty-five, which is under the three-item floor this lane treats as evidence — but adding striking to a kids curriculum is a positioning decision, and the implied claim travels further than the post does.",
        "The claim is that grappling alone is incomplete self-defence, and it is the kind of thing a parent hears once and then carries into every comparison. It deserves a real answer rather than a defensive one.",
        "The answer is about what children actually encounter. Playground and schoolyard confrontations are overwhelmingly grabs, shoves, pins and being taken to the ground — not exchanges of punches. Grappling trains precisely that situation, and it trains it with an outcome that does not require hurting the other child: control, escape, and a conflict that ends without escalating. Striking trains a child to answer force with force, which is a different instinct to rehearse and a harder one to switch off.",
        "That is the post. Not a rebuttal of another academy's curriculum, but the mechanism a parent is trying to reason about when they ask whether their child should learn to punch.",
      ],
    },
    posts: [],
    seedStatus: "ignored",
    seedReason:
      "Real question, but one post from one account is thin. Revisit when more than a single post is driving it.",
    history: [
      {
        status: "new",
        when: "7 weeks ago",
        note: "Surfaced from the 1–31 July competitor scan (1 matching post).",
      },
      {
        status: "ignored",
        when: "6 weeks ago",
        note: "Ignored — single post, below the evidence floor.",
      },
    ],
  },
  {
    id: "br-25",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "1d ago",
    kind: "ready",
    headline: "Competitors sell confidence to girls and character to boys",
    summary:
      "Gracie Barra's youth copy splits cleanly by gender — empowerment and fun for girls, self-control and respect for boys. It is the most consistent pattern in the scan and nobody has questioned whether parents want the split.",
    isUpdated: true,
    article: {
      title: "The same programme, described two different ways depending on the child",
      subheads: ["The same class, described twice", "The mechanism does not vary by child"],
      paragraphs: [
        "Eleven July posts cover youth programmes, eighty-two percent of them on Instagram, and the framing divides by gender with unusual consistency. Posts about boys lead on behavioural outcomes — self-control, respect, problem-solving, perseverance, raising boys who are kind and capable rather than fighters. Posts about girls lead on empowerment, self-assurance, fun and friendship, frequently welcoming pairs of sisters.",
        "Both halves are reasonable on their own. Read together they describe the same class twice, and the split implies the two children are there for different reasons. A parent with a son and a daughter is being sold two programmes.",
        "There is a straightforward position available here, and it is the one this Playbook already holds: the mechanism does not vary by child. The tap teaches the same thing to everyone in the room. Leverage over strength matters more to the smaller person regardless of who that is. Control rather than aggression is the point of the art, not a girls' version of it.",
        "The scan also fills in the specifics worth answering alongside: dedicated cohorts for four-year-olds and for seven-to-twelves, a parent-and-child class, and a free introductory session. Those are the concrete comparisons a parent will make once the framing question is settled.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "27 days ago",
        note: "Surfaced from the 1–31 July competitor scan (11 matching posts).",
      },
    ],
  },
  {
    id: "br-26",
    feedId: "topic-list-4",
    sourceId: "competitor-posts",
    ageLabel: "6d ago",
    kind: "later",
    headline: "Most of what the Carlsbad academies published in July was about themselves",
    summary:
      "Anniversaries, belt promotions, new-member welcomes and holiday greetings account for the bulk of the twenty-five posts in the window. Four self-promotional formats, three academies, almost no teaching.",
    article: {
      title: "Four formats, three academies, and a month with almost nothing to learn from",
      subheads: ["Four formats, all social proof", "Won on frequency, not on content"],
      paragraphs: [
        "The July scan flags four recurring formats as self-promotional rather than subject matter: school anniversary and seminar announcements, individual belt and stripe promotions, welcome posts for new and returning students, and Independence Day greetings. Between them they account for most of the twenty-five posts collected across the three tracked academies.",
        "That is not a criticism of any one of them — social proof is a legitimate thing for a local academy to publish, and the promotions genuinely matter to the students in them. It is an observation about what is left over. Strip the four formats out and the month contains a handful of posts that teach a parent or a prospective adult student anything.",
        "The competitive read is that attention in this category is not being won on content. It is being won on frequency and on local familiarity, which is a position that is hard to attack directly and easy to go around. Everything else in this lane — how character development is actually produced, what a realistic first year looks like, why a room where people help each other is safer — is unoccupied ground.",
        "The practical consequence is about cadence rather than volume. Matching their posting rate is the wrong target; publishing the explanations they are not publishing is the cheap one.",
      ],
    },
    posts: [],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "6 days ago",
        note: "Surfaced from the 1–31 July competitor scan (aggregate noise flags).",
      },
    ],
  },
  {
    id: "br-27",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "2h ago",
    kind: "ready",
    headline: "Everyone is shipping an agent. Nobody says what it takes off your plate",
    summary:
      "Fourteen posts across Hootsuite, Vista Social and Buffer pitch conversational agents as a replacement for the dashboard. The claims are about architecture — orchestration layers, autonomous teammates — not about which job disappears on a Tuesday.",
    relevance:
      "Social media managers spend their working days inside publishing and monitoring dashboards, so shifting execution to conversational AI agents fundamentally alters their daily operations. Teams managing high-volume channels feel the need for automated triage first.",
    whyNow:
      "The highest-volume theme in the whole scan — 14 items, and every major competitor moved within the same thirty days.",
    isTrending: true,
    article: {
      title: "The category is selling the architecture. Social media managers buy the hour back",
      subheads: ["Fourteen items, all architecture", "Show the Tuesday, not the layer"],
      paragraphs: [
        "Fourteen items in this window pitch conversational agents as a replacement for the dashboard. Hootsuite describes rebuilding the product around an agent layer rather than bolting AI onto it. Vista Social launched a command surface wired into fifty-odd tools. Buffer published a creator's stack of MCP servers. The vocabulary is consistent across all three: orchestration layers, intelligence units, autonomous teammates.",
        "What is almost entirely missing is the other half of the sentence. An agent that runs continuously and only interrupts you when something matters is a good pitch — but a social media manager reading it wants to know which of today's twenty jobs it does. Morning briefing? Inbox triage? Flagging the post that overperformed? Some posts list those duties; most stop at the layer.",
        "That gap is the opening, and it is not a positioning argument — it is a format one. The same claim written as a workflow beats it written as an architecture. Show the Tuesday: what the inbox looked like at 9am, what the agent had already sorted, what was left for a human, and how long that took before.",
        "One competitor makes the cost comparison explicit, setting a monthly subscription against the labour it displaces. That framing is available to anyone, and it is more concrete than any of the capability language around it.",
      ],
    },
    posts: [
      {
        id: "agp-p1",
        network: "instagram",
        publishedOn: "14 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: 'Still using a dashboard to manage social? That\'s sooo 2025. The smarter way: Connect the AI tool you already use (Claude, Gemini, whatever) to handle your social tasks right in the chat. Comment "chat" for the shortcut👇',
        likes: 18,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Dayg7sfjNo4/",
      },
      {
        id: "agp-p2",
        network: "instagram",
        publishedOn: "24 Jun 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "There's a future where you'll be able to do everything you do in Hootsuite now — without ever looking at our software. Today, we're announcing a major step toward that future. While others bolt AI features onto their existing tools and platforms, we've…",
        likes: 62,
        comments: 14,
        reposts: 0,
        url: "https://www.instagram.com/p/DZ-GDNcDj9a/",
      },
      {
        id: "agp-p3",
        network: "instagram",
        publishedOn: "14 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Last year, scaling meant hiring another coordinator. This year, it means setting up an agent. Here's the test I use to tell a real AI agent from a gimmick: does it just generate content, or does it actually run your operations? Triaging inboxes, flagging…",
        likes: 21,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Dax2KWUiloD/",
      },
      {
        id: "agp-p4",
        network: "instagram",
        publishedOn: "3 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "Meet Wisdom. Your social-first AI teammate, and the intelligence layer behind everything in Hootsuite's Social OS. In seconds, Wisdom: 👀 Surfaces what deserves your attention 🧠 Explains why it matters 💡 Sets you up to take action. Ask it anything. It knows…",
        likes: 23,
        comments: 3,
        reposts: 0,
        url: "https://www.instagram.com/p/DaVp3aMGpRP/",
      },
      {
        id: "agp-p5",
        network: "instagram",
        publishedOn: "25 Jun 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: 'We knew there was a better way to manage social. And we knew we couldn\'t deliver it by bolting AI onto Hootsuite. So we started over and built AI right in. Comment "Suite" for more details!',
        likes: 60,
        comments: 12,
        reposts: 0,
        url: "https://www.instagram.com/p/DaA5GJ0lJFO/",
      },
      {
        id: "agp-p6",
        network: "instagram",
        publishedOn: "25 Jun 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Your social media now has a whole AI team on the clock. Ask Vista lives inside Vista Social and it types back. Need a report? Done. Inbox chaos? Sorted. Leads slipping through the cracks at 2am? Leo's got it. 50+ tools. 25+ agents. 20+ skills. All yours, just…",
        likes: 13,
        comments: 2,
        reposts: 0,
        url: "https://www.instagram.com/p/DaAoBwyFNkf/",
      },
    ],
    seedStatus: "new",
    volume: "high",
    history: [
      {
        status: "new",
        when: "2 hours ago",
        note: "Surfaced from the Apr 2025 – Jul 2026 competitor scan (14 matching items).",
      },
    ],
  },
  {
    id: "br-28",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "4d ago",
    kind: "ready",
    headline: "MCP is being explained to engineers. Nobody has explained it to a social media manager",
    summary:
      "Eight items, three quarters of them blog posts, frame connectors as the glue between social data and the AI tools people already draft in. Every one is pitched at a technical reader — and the person who would benefit most isn't one.",
    relevance:
      "Marketing teams increasingly rely on external AI tools for strategy and drafting, making direct data connectors essential for bridging the gap between social data and AI generation. Technical operators running multi-channel pipelines adopt these integrations first.",
    whyNow:
      "Concentrated thought-leadership and guide publications from Buffer and Hootsuite throughout July 2026 highlight the growing adoption of MCP.",
    isUpdated: true,
    article: {
      title: "Your listening data, in the chat window where the work already happens",
      subheads: ["Eight items, one technical register", "The same story, told to a social media manager"],
      paragraphs: [
        "Eight items in this window cover Model Context Protocol connectors, three quarters of them on web blogs. Buffer publishes a creator's roundup of the eight servers they use weekly. Hootsuite frames protocol bridges as the way social intelligence reaches outside tools. One head-to-head comparison makes a point of MCP access being included on every plan.",
        "All of it is written for someone comfortable with the words 'server' and 'protocol'. The person with the most to gain is a social media manager who already drafts in a chat tool and retypes numbers into it by hand — and none of this content is addressed to them.",
        "Written for that reader, the story is short: the reporting you screenshot into a prompt can arrive by itself. No new dashboard to learn, no export step, and the thing you were already doing gets its data automatically. That is a workflow post, not a technical one, and it is unoccupied.",
        "The pricing angle travels with it. If protocol access is a paid tier elsewhere and not here, that belongs in the comparison content the scan shows already captures bottom-funnel search. Written as one piece the two arguments answer different readers without competing: the workflow story for the person who does not care what a server is, and the tier comparison for the one who is already choosing between vendors.",
      ],
    },
    posts: [
      {
        id: "agp-p7",
        network: "instagram",
        publishedOn: "9 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "One MCP is great. Several MCPs stacked on top of each other is even better. Here are the 8 I use in my day to day as a creator. Comment MCP to get the article or check the link in bio🔗",
        likes: 40,
        comments: 4,
        reposts: 0,
        url: "https://www.instagram.com/p/DalMPEzMMvm/",
      },
      {
        id: "agp-p8",
        network: "instagram",
        publishedOn: "15 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "As of today, you have access to Insights in Buffer! 🎉 Your numbers can tell you a lot, but not always what to do with them. Buffer Insights helps close that gap. It reads what's working across your channels and suggests what to try next, you can act on right…",
        likes: 111,
        comments: 5,
        reposts: 0,
        url: "https://www.instagram.com/p/Da0IuICiKbD/",
      },
      {
        id: "agp-p9",
        network: "instagram",
        publishedOn: "14 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: 'Still using a dashboard to manage social? That\'s sooo 2025. The smarter way: Connect the AI tool you already use (Claude, Gemini, whatever) to handle your social tasks right in the chat. Comment "chat" for the shortcut👇',
        likes: 18,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Dayg7sfjNo4/",
      },
      {
        id: "agp-p10",
        network: "instagram",
        publishedOn: "24 Jun 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "There's a future where you'll be able to do everything you do in Hootsuite now — without ever looking at our software. Today, we're announcing a major step toward that future. While others bolt AI features onto their existing tools and platforms, we've…",
        likes: 62,
        comments: 14,
        reposts: 0,
        url: "https://www.instagram.com/p/DZ-GDNcDj9a/",
      },
    ],
    seedStatus: "new",
    volume: "medium",
    history: [
      {
        status: "new",
        when: "1 week ago",
        note: "Surfaced from the competitor scan (1 matching item).",
      },
      {
        status: "new",
        when: "4 days ago",
        note: "Re-scanned — 8 matching items, and the framing shifted.",
      },
    ],
  },
  {
    id: "br-45",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "1d ago",
    kind: "ready",
    headline: "Two ways to sell an agent: bring your own AI, or move into theirs",
    summary:
      "Every account in this window agrees the chat replaces the dashboard. They split on where the agent lives — one rebuilds the suite into apps behind a central agent and bridges out to the AI you already use, the other is a command surface you move into. That is the choice nobody is putting to the buyer.",
    relevance:
      "Social media managers spend much of their working day inside publishing, inbox, and analytics dashboards, so a shift toward conversational agent layers directly alters how daily team and account operations are managed.",
    whyNow:
      "Concentrated messaging across June and July 2026 driven by Hootsuite's Social OS release, Vista Social's Ask Vista launch, and Buffer's practitioner content on MCP integrations.",
    article: {
      title: "The category agrees on the premise and splits on the architecture",
      subheads: ["One premise, two architectures", "The question a buyer can actually answer"],
      paragraphs: [
        "Every monitored account in this window makes the same promise: conversational commands supersede interface navigation, agents run in the background, and you are interrupted only when something matters. The vocabulary is shared too — orchestration layers, intelligence units, autonomous teammates.",
        "They diverge on structure, and the divergence is the story. One approach reorganises a legacy suite into purpose-built component apps — publishing, care, listening, advocacy — governed by a central agent, and keeps protocol bridges open so listening data flows into whatever AI tool the rest of the company already uses. The other positions its product as a standalone conversational command surface wired directly into its own tools; a third framing presents the software as one link inside a practitioner's stack rather than the platform itself.",
        "Underneath the two shapes is one number worth repeating: a provider's own research claims most senior marketing leaders already run AI tools that have no access to live social data. Both architectures are answers to that, and they ask opposite things of you — bring your own AI and let the data reach it, or bring your work to the vendor's chat.",
        'That is a question a social media manager can actually answer, unlike "is AI a foundation or a feature". Whoever writes it as a straight comparison — where does the agent live, whose AI does it feed, what happens to your data when you change tools — publishes the piece the category has been talking around for a month.',
      ],
    },
    posts: [
      {
        id: "agp-p31",
        network: "instagram",
        publishedOn: "24 Jun 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "There's a future where you'll be able to do everything you do in Hootsuite now — without ever looking at our software. While others bolt AI features onto their existing tools and platforms, we've rebuilt Hootsuite from the ground up with AI as a foundation, not a feature. Flow real-time social listening insights directly into the AI tools you already use across your organization via MCP connectors.",
        likes: 62,
        comments: 14,
        reposts: 0,
        url: "https://www.instagram.com/p/DZ-GDNcDj9a/",
      },
      {
        id: "agp-p32",
        network: "instagram",
        publishedOn: "25 Jun 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: 'We knew there was a better way to manage social. And we knew we couldn\'t deliver it by bolting AI onto Hootsuite. So we started over and built AI right in. Comment "Suite" for more details!',
        likes: 60,
        comments: 12,
        reposts: 0,
        url: "https://www.instagram.com/p/DaA5GJ0lJFO/",
      },
      {
        id: "agp-p33",
        network: "instagram",
        publishedOn: "25 Jun 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: 'Your social media now has a whole AI team on the clock. Ask Vista lives inside Vista Social and it types back. Need a report? Done. Inbox chaos? Sorted. 50+ tools. 25+ agents. 20+ skills. All yours, just by typing. Comment "ask vista" below and we\'ll send you the link. 👇',
        likes: 13,
        comments: 2,
        reposts: 0,
        url: "https://www.instagram.com/p/DaAoBwyFNkf/",
      },
      {
        id: "agp-p34",
        network: "instagram",
        publishedOn: "14 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Here's the test I use to tell a real AI agent from a gimmick: does it just generate content, or does it actually run your operations? Triaging inboxes, flagging leads in comments, drafting review replies, building monthly reports — while you sleep. Ask Vista does the math for you too — every agent logs the hours it saved and what that labor would've cost a human.",
        likes: 21,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Dax2KWUiloD/",
      },
      {
        id: "agp-p35",
        network: "instagram",
        publishedOn: "9 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "One MCP is great. Several MCPs stacked on top of each other is even better. Here are the 8 I use in my day to day as a creator. Comment MCP to get the article or check the link in bio🔗",
        likes: 40,
        comments: 4,
        reposts: 0,
        url: "https://www.instagram.com/p/DalMPEzMMvm/",
      },
    ],
    seedStatus: "new",
    volume: "high",
    history: [
      {
        status: "new",
        when: "1 day ago",
        note: "Surfaced from the competitor scan (5 matching items).",
      },
    ],
  },
  {
    id: "br-29",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "6d ago",
    kind: "ready",
    headline: "The argument isn't more metrics. It's which number ends an argument",
    summary:
      "Sprinklr says analytics break down when teams use inconsistent definitions. Buffer shipped Insights to turn numbers into next steps. Sprout published the pillar guide. Four items, one shared premise: volume of metrics is not insight.",
    relevance:
      "Marketing leaders struggle to prove social ROI when dealing with disconnected platform metrics and multiple unaligned dashboards. Agencies and growing teams handling multiple client accounts feel the pressure of metric fragmentation most acutely.",
    whyNow: "Featured insights and product updates from Sprinklr and Buffer clustered densely in mid-July 2026.",
    article: {
      title: "Everyone tracks more. Almost nobody says which number changes a decision",
      subheads: ["Three competitors, one complaint", "Which number ends an argument"],
      paragraphs: [
        "Four items in this window, split across web blogs, Facebook and Instagram, converge on the same complaint: reporting breaks at scale when teams use inconsistent definitions and siloed tools, so results can't be compared or trusted. Sprinklr argues for a single governed measurement framework. Buffer shipped a feature to turn data into takeaways. Sprout published the cornerstone metrics guide.",
        "The convergence is the interesting part. Three competitors with very different customers arrived at the same premise — that tracking more does not produce more insight — which means the premise is safe and the differentiation has to be downstream of it.",
        "Downstream is the decision. A metrics guide tells you what to measure; almost nothing in this window tells you which number should change what you do next week, or what to stop doing when it moves. For an agency reporting on several accounts, that is the whole job.",
        "There is a customer story shape here too, and this Playbook is built for it: one team, one report that used to take a morning, and the specific meeting it now settles.",
      ],
    },
    posts: [
      {
        id: "agp-p11",
        network: "instagram",
        publishedOn: "15 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "As of today, you have access to Insights in Buffer! 🎉 Your numbers can tell you a lot, but not always what to do with them. Buffer Insights helps close that gap. It reads what's working across your channels and suggests what to try next, you can act on right…",
        likes: 111,
        comments: 5,
        reposts: 0,
        url: "https://www.instagram.com/p/Da0IuICiKbD/",
      },
      {
        id: "agp-p12",
        network: "instagram",
        publishedOn: "2 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "Customer feedback isn't the hard part anymore. Turning it into action is. Sprinklr's Chief Product Officer Karthik Suri shares a simple framework for what makes an AI-native approach to Customer Feedback Management different: 1️⃣ Data. 2️⃣ Context. 3️⃣…",
        likes: 7,
        comments: 1,
        reposts: 0,
        url: "https://www.instagram.com/p/DaSte_qgDgz/",
      },
      {
        id: "agp-p13",
        network: "instagram",
        publishedOn: "20 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "The biggest moments don't announce themselves. They start as signals. A shift in conversation. An emerging trend. A change in customer behavior. The advantage doesn't go to the team with the most data. It goes to the team that recognizes what matters first…",
        likes: 9,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/DbBTbdAAhzY/",
      },
      {
        id: "agp-p14",
        network: "instagram",
        publishedOn: "16 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "Most telecom brands only get noticed when something goes wrong. That's the challenge. 🙇‍♀️ According to the 2026 Social Index, more than 60% of telecom brands operate in negative sentiment. Yet a handful are changing the narrative. Not through more content.…",
        likes: 8,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Da25kKljGEX/",
      },
    ],
    seedStatus: "new",
    volume: "low",
    history: [
      {
        status: "new",
        when: "6 days ago",
        note: "Surfaced from the competitor scan (4 matching items).",
      },
    ],
  },
  {
    id: "br-30",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "19d ago",
    kind: "ready",
    headline: "Buyers are asking an AI about you before they ask you",
    summary:
      "Sprinklr launched LLM Insights to track how brands appear in AI answers, and its content playbook argues search is moving into AI Overviews. Two items — thin — but it is the one theme in the scan with no incumbent.",
    relevance:
      "Marketing teams responsible for corporate reputation must track how conversational AI tools represent their brand, as prospective customers rely on direct AI answers during product research.",
    whyNow:
      "Launch announcements for LLM tracking tools and published guidance on generative engine optimization appeared in mid-2026.",
    article: {
      title: "The comparison page that matters most may be one you never see",
      subheads: ["Two items, below this lane's floor", "Unglamorous, and close to what already works"],
      paragraphs: [
        "Two items in this window cover brand visibility inside AI answers. Sprinklr launched LLM Insights — tracking how a brand shows up across LLM-powered search, and whether AI recommends it — and published a content playbook arguing that content now needs sharper structure, direct answers and credible sourcing because discovery is moving beyond ranked links.",
        "Two items is below the floor this lane treats as evidence, so this is an observation rather than a trend. It is recorded because of what it implies rather than how loud it is: if a prospective customer asks an assistant which social tool suits an agency, the answer is assembled from content nobody in this category is writing for that purpose.",
        "The practical version is unglamorous. Direct answers to real questions, sourced and structured, published where they can be cited. That is close to what the comparison content in this scan already does — the difference is writing it to be quoted rather than to be clicked.",
        "Worth watching before it is worth investing in. If a second competitor ships tracking for this, it stops being an observation.",
      ],
    },
    posts: [
      {
        id: "agp-p15",
        network: "instagram",
        publishedOn: "24 Jun 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "MAD//FEST energy, with a view ⛱️✨ Join us at the Sprinklr × SAMY Beach Hut, where social expertise meets real-time customer intelligence. Together with @samy.uk, we're creating a space for marketers to connect, explore, and rethink how campaigns come to life…",
        likes: 13,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/DZ9vxkilcO5/",
      },
      {
        id: "agp-p16",
        network: "instagram",
        publishedOn: "11 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "Someone on Instagram just compared your product to a competitor's. You didn't see it. Your dashboard didn't flag it. Your team won't know until it's too late. That's what happens when you monitor only for mentions and don't fully listen. We put together a…",
        likes: 12,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/DaoIf15FFY7/",
      },
      {
        id: "agp-p17",
        network: "instagram",
        publishedOn: "2 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: 'One report distills billions of social conversations into one picture. Social Media Trends 2026 names answer-engine optimisation as the discovery shift leaders are least ready for — and video getting indexed in public search as the one closest behind it. Comment "Trends" to get it.',
        likes: 44,
        comments: 6,
        reposts: 0,
      },
    ],
    seedStatus: "ignored",
    seedReason:
      "Two posts, both from one competitor. Real shift, but I'd rather write it when there's more than one account behind it.",
    volume: "low",
    history: [
      {
        status: "new",
        when: "19 days ago",
        note: "Surfaced from the competitor scan (2 matching items).",
      },
      {
        status: "ignored",
        when: "12 days ago",
        note: "Ignored — below the evidence floor.",
      },
    ],
  },
  {
    id: "br-31",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "6w ago",
    kind: "ready",
    headline: "Sprout has written the Bluesky guide twice. The question underneath it is unanswered",
    summary:
      "Two Sprout pieces: what Bluesky is, and how to build a brand presence on it. Both answer 'how'. Neither answers the question a social media manager actually has, which is whether it is worth the hours.",
    relevance:
      "Social media managers regularly evaluate whether emerging networks merit dedicated resource investment and how to establish brand presence without overextending operational capacity.",
    whyNow: "Dedicated strategy guides and platform explainers were published by monitored accounts in mid-July 2026.",
    article: {
      title: "Not 'how to post on Bluesky' — 'is it worth your Thursday'",
      subheads: ["Two guides, both about how", "An honest way to run the test"],
      paragraphs: [
        "Two web-blog items in this window, both from the same competitor: an explainer on what Bluesky is and where it fits in a 2026 strategy, and a fuller guide to building a brand presence — how the network differs from X and Threads, why a roughly 42-million audience skewing 25-34 is worth testing, and how to adapt tone and cadence.",
        "Both are 'how' content, and both are good at it. Neither answers the prior question, which is the one a social media manager with a full calendar actually asks: does this earn a slot, and what comes off the calendar to pay for it?",
        "That question has a shape this Playbook is suited to. Not a verdict — an honest way to run the test. What a fair trial looks like, over how many weeks, and the number that would tell you to keep going or stop. Two competitors have covered the setup; nobody has covered the decision.",
        "The audience fit also deserves a sentence rather than a statistic. A 25-34 skew matters to some of the brands reading this and not at all to others, and saying which is which is more useful than the number on its own.",
      ],
    },
    posts: [
      {
        id: "agp-p18",
        network: "instagram",
        publishedOn: "1 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "We recently moved our newsletter, The Weekly Scroll, to Substack and received a few questions about it. There were three main reasons: 🔠 Simple feature set 🛠️ Building expertise with a social platform ✨Social by default See what we've done so far at the link…",
        likes: 45,
        comments: 3,
        reposts: 0,
        url: "https://www.instagram.com/p/DaQay0btZxD/",
      },
      {
        id: "agp-p19",
        network: "instagram",
        publishedOn: "13 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: 'Brandon Green (@kidlightbulbs), a Staff Product Manager here at Buffer and founder of Unstream (@unstream.stream), described his marketing strategy as "impulse posting." Think of something, drop everything to write it, forget about it for two weeks. So he…',
        likes: 39,
        comments: 4,
        reposts: 0,
        url: "https://www.instagram.com/p/DavEqQLDRy3/",
      },
      {
        id: "agp-p20",
        network: "instagram",
        publishedOn: "9 Jul 2026",
        author: {
          name: "Sprout Social",
          handle: "@sproutsocial",
          initials: "SS",
          accent: "green",
        },
        text: "Bluesky, part two. Part one covered what it is; this one is the build — how to set up a brand presence, what to post in the first month, and which of your existing formats travel. Link in bio.",
        likes: 31,
        comments: 4,
        reposts: 0,
      },
    ],
    seedStatus: "used",
    volume: "low",
    history: [
      {
        status: "new",
        when: "6 weeks ago",
        note: "Surfaced from the competitor scan (2 matching items).",
      },
      {
        status: "used",
        when: "3 weeks ago",
        note: "Drafted into a chat.",
      },
    ],
  },
  {
    id: "br-32",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "3d ago",
    kind: "later",
    headline: "Buffer's creator says half their followers came from a ten-minute DM setup",
    summary:
      "Keyword-triggered DMs through Meta's official API, framed as the single biggest driver of their Instagram growth. Two items, both Buffer, both first-person — and the format is the whole reason it lands.",
    relevance:
      "Creator account managers and social marketers experience manual inbox strain when delivering resource links at scale.",
    whyNow:
      "Multiple posts published in June and July 2026 outline specific automation setups and account growth results.",
    article: {
      title: "The tactic is public. The proof is what's missing",
      subheads: ["One creator, one number", "What the publishable version needs"],
      paragraphs: [
        "Two items in this window, split between a first-person Instagram post and a longer guide, both from Buffer. The claim is specific: roughly half the account's followers came from keyword-triggered DM automation running on Meta's official API, set up in about ten minutes. The guide's angle is doing it without sounding robotic.",
        "It works because it is first-person and numbered. A platform explaining DM automation is a feature page; a person saying what it did for their own account is a story, and the comments do the rest.",
        "Which is also what this Idea is waiting on. The version worth publishing needs someone's real numbers — before, after, over what period — and permission to use them. Without that it is the same explainer everyone has.",
        "Blocked on: a customer or an in-house account willing to share follower data, and a screen recording of the setup rather than a description of it.",
      ],
    },
    posts: [
      {
        id: "agp-p21",
        network: "instagram",
        publishedOn: "30 Jun 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "Roughly half my followers came from this ten-minute setup. It's the \"comment the word and I'll send it\" thing you've seen everywhere. Runs through Meta's official API, so it won't get your account banned/limited. It's done the most for my growth journey on…",
        likes: 147,
        comments: 13,
        reposts: 0,
        url: "https://www.instagram.com/p/DaNq3Zfsfp5/",
      },
      {
        id: "agp-p22",
        network: "instagram",
        publishedOn: "26 Jun 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Comment VISTA and stop losing leads while you sleep 💸 Most content creators and businesses don't realize how much money walks away simply because no one replied in time Vista Social handles your DMs so you never miss another one",
        likes: 127,
        comments: 11,
        reposts: 0,
        url: "https://www.instagram.com/p/DaEEC7GuuLb/",
      },
      {
        id: "agp-p23",
        network: "instagram",
        publishedOn: "7 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: 'Comment "Ask Vista" and I\'ll DM you the link. I built an AI agent team that runs my social media 24/7 — zero humans, zero coding. In Ask Vista, I click New Agent, describe what I need in plain English, and it builds it. Mine hand me a morning briefing,…',
        likes: 225,
        comments: 305,
        reposts: 0,
        url: "https://www.instagram.com/p/DafuSiJx8yw/",
      },
    ],
    seedStatus: "new",
    volume: "medium",
    history: [
      {
        status: "new",
        when: "3 days ago",
        note: "Surfaced from the competitor scan (2 matching items).",
      },
    ],
  },
  {
    id: "br-33",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "5d ago",
    kind: "later",
    headline: '"Not every trend is your trend" — a way to tell which ones are',
    summary:
      "Vista Social ran two posts pulling apart the same week's viral moments: one a format you can build on, one a template where every brand's output is identical but the logo. The test underneath it is reusable.",
    relevance:
      "Social media teams waste significant creative hours jumping on fleeting fads that fail to deliver enduring audience connection.",
    whyNow: "Concentrated commentary and tactical guides emerged across multiple publishing channels in mid-July.",
    article: {
      title: "A format you can build on, or a template you can only copy",
      subheads: ["Format or template — the distinction", "Why this needs a recurring slot"],
      paragraphs: [
        "Two Instagram posts in this window make the same argument from different angles. The first separates a mockumentary format — which a brand can take and tell its own story inside — from an AI-edit template where every participant produces the identical clip with a different logo. The second argues most trends are a spike on one platform driven by a handful of accounts, not a trend at all.",
        "Both land on a test rather than a verdict, which is the useful part: does this give us something to build on, and is it moving on more than one network? That is two questions a social media manager can actually apply on a Thursday without a meeting.",
        "The reason this isn't ready is that a trend-vetting piece is worthless in the abstract. It needs this week's examples, and by the time it publishes they have to still be current — which makes it a repeatable format rather than a one-off, and a format needs a slot in the calendar and someone who owns it.",
        "Blocked on: a recurring slot, and a decision about who picks the two examples each time.",
      ],
    },
    posts: [
      {
        id: "agp-p24",
        network: "instagram",
        publishedOn: "20 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Not every trend is your trend. 🚩 Two blew up this week — one's worth your team's time, one's a trap. The Netflix mockumentary format? Do it. It's a format, not a clip. You build your own story, your own angle, your own dramatic zoom on a random photo. People…",
        likes: 88,
        comments: 3,
        reposts: 0,
        url: "https://www.instagram.com/p/DbBUd_mP1lJ/",
      },
      {
        id: "agp-p25",
        network: "instagram",
        publishedOn: "15 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: 'Most "trends" are a spike on one platform, driven by a handful of accounts — not actual cross-platform momentum. ㅤ We put together the exact 5-step check to confirm a trend is real before you build content around it. ㅤ Comment "TRENDS" and we\'ll send you the…',
        likes: 16,
        comments: 4,
        reposts: 0,
        url: "https://www.instagram.com/p/Da0VxlSiWjp/",
      },
      {
        id: "agp-p26",
        network: "instagram",
        publishedOn: "20 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "The biggest moments don't announce themselves. They start as signals. A shift in conversation. An emerging trend. A change in customer behavior. The advantage doesn't go to the team with the most data. It goes to the team that recognizes what matters first…",
        likes: 9,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/DbBTbdAAhzY/",
      },
    ],
    seedStatus: "new",
    volume: "high",
    history: [
      {
        status: "new",
        when: "5 days ago",
        note: "Surfaced from the competitor scan (2 matching items).",
      },
    ],
  },
  {
    id: "br-34",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "11d ago",
    kind: "later",
    headline: "Buffer publishes head-to-head comparisons. We publish feature pages",
    summary:
      "Buffer vs Sprout, Buffer vs Hootsuite, Buffer vs Metricool — all on the blog, all pitched at people already deciding. The scan's own note calls it bottom-funnel search capture, and nobody in the set is doing it defensively.",
    article: {
      title: "The comparison the buyer runs anyway, written by someone who knows the answer",
      subheads: ["Three comparisons, all conceding something", "The decision that comes before the draft"],
      paragraphs: [
        "Three head-to-head comparisons in this window, all Buffer, all on the blog: against Sprout Social, against Hootsuite, against Metricool. Each covers features, pricing structure and which team size it suits. The scan tags all three the same way — competitor-comparison content aimed at high-intent switchers.",
        "The tone is what makes them work. They concede things. A comparison that finds the competitor better at nothing reads as an advert and converts like one, and buyers who have already opened three tabs can tell the difference immediately.",
        "This is the highest-intent content in the whole scan and it is the one thing here that needs a decision before a draft. Being honest in public about where a rival is stronger is a position, not a writing task.",
        "Blocked on: sign-off on how candid the comparisons are allowed to be, and current pricing for each competitor — the numbers go stale fast and a wrong one is worse than no page.",
      ],
    },
    posts: [
      {
        id: "agp-p27",
        network: "instagram",
        publishedOn: "17 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "Buffer vs Sprout Social, honestly. Where Sprout is stronger (approval chains, enterprise reporting), where we are (price per channel, API access on every plan), and who each one actually suits. Full comparison on the blog.",
        likes: 58,
        comments: 9,
        reposts: 0,
      },
      {
        id: "agp-p28",
        network: "instagram",
        publishedOn: "10 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "Buffer vs Hootsuite. We concede the listening depth — Hootsuite has fifteen years of it. What we will not concede is what a team of five pays to publish. The numbers, side by side, on the blog.",
        likes: 41,
        comments: 12,
        reposts: 0,
      },
      {
        id: "agp-p29",
        network: "instagram",
        publishedOn: "9 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "Buffer vs Metricool: pricing models (per-channel against per-brand), analytics depth, and who each suits. Includes the bit most comparison pages leave out — MCP and API access is on every Buffer plan, not a tier.",
        likes: 37,
        comments: 5,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "11 days ago",
        note: "Surfaced from the competitor scan (3 matching items).",
      },
    ],
  },
  {
    id: "br-35",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "5w ago",
    kind: "later",
    headline: "The brands winning attention stopped posting about their product",
    summary:
      "Sprinklr's line — 76% of tech brands stuck because they all say the same thing — next to Vista Social's case study where organic LinkedIn was the biggest lead source of the year. Three items, one argument.",
    relevance:
      "Marketing leaders struggling with low engagement rates need alternative approaches to capture attention in saturated feeds.",
    whyNow: "Several reports and podcast highlights focused on organic strategy throughout July.",
    article: {
      title: "Posting more didn't work. Posting about something else did",
      subheads: ["The pattern, and what replacing it looks like", "This argument needs a named company"],
      paragraphs: [
        "Three items in this window, two thirds Instagram. Sprinklr's claim is blunt: most tech brands aren't stuck because they post too little, they're stuck because they all post launches, features and product updates. One global brand publishes 32 times a week to very little effect. Vista Social's contribution is a case study — a company whose biggest lead source last year was organic LinkedIn, not paid.",
        "The two halves fit together well. One names the pattern, the other shows what replacing it looks like, and the second is the half that persuades anyone.",
        "That is also the blocker. This argument does not survive being made in the abstract — it needs a named company, a real before-and-after, and someone prepared to be quoted saying they stopped posting about their product.",
        "Blocked on: a customer willing to go on record with lead-source numbers. Without one this is an opinion piece competing with a case study.",
      ],
    },
    posts: [
      {
        id: "agp-p30",
        network: "instagram",
        publishedOn: "9 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "76% of tech brands are stuck. Not because they aren't posting. Because they're saying the same things everyone else is. Launches. Features. Product updates. Meanwhile, the brands winning attention are creating content people actually want to engage with. The…",
        likes: 5,
        comments: 2,
        reposts: 0,
        url: "https://www.instagram.com/p/DakyZH5li3d/",
      },
      {
        id: "agp-p31",
        network: "instagram",
        publishedOn: "21 Jul 2026",
        author: {
          name: "Vista Social",
          handle: "@vistasocial",
          initials: "VS",
          accent: "purple",
        },
        text: "Vector's 👻 biggest lead source last year wasn't paid. It was organic LinkedIn. 💙 ㅤ Jess Cook, their VP of Marketing, said they spent maybe $40K on ads for all of 2025. That was basically the whole budget, and organic still carried the year. ㅤ Now they're…",
        likes: 11,
        comments: 5,
        reposts: 0,
        url: "https://www.instagram.com/p/DbDukl-lXwj/",
      },
      {
        id: "agp-p32",
        network: "instagram",
        publishedOn: "16 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "Most telecom brands only get noticed when something goes wrong. That's the challenge. 🙇‍♀️ According to the 2026 Social Index, more than 60% of telecom brands operate in negative sentiment. Yet a handful are changing the narrative. Not through more content.…",
        likes: 8,
        comments: 0,
        reposts: 0,
        url: "https://www.instagram.com/p/Da25kKljGEX/",
      },
    ],
    seedStatus: "new",
    volume: "high",
    history: [
      {
        status: "new",
        when: "5 weeks ago",
        note: "Surfaced from the competitor scan (3 matching items).",
      },
    ],
  },
  {
    id: "br-36",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "6mo ago",
    kind: "later",
    headline: "Everyone announced a pricing change in the same quarter",
    summary:
      "Per-channel, per-brand, per-seat — three competitors repriced within weeks of each other and each explained it as simplification. Nobody published what a team of five actually ends up paying.",
    article: {
      title: "Three repricings, no worked example",
      subheads: ["Three repricings, one quarter", "The worked example, and the decision behind it"],
      paragraphs: [
        "Three accounts changed pricing model inside one quarter and all three used the word simplification. One moved to per-channel, one to per-brand, one added a seat tier on top of both.",
        "None of them published the arithmetic. The comparison a buyer actually runs — a team of five, twelve channels, one approval step — is absent from all three announcements, which is why the comparison content that ranks is written by third parties.",
        "The opening is the worked example rather than an opinion about who is cheapest: same team, same channels, three bills, shown.",
        "Blocked on: current published rates for all three, and a decision about whether we are willing to show a case where we are not the cheapest. Without the second, the piece is a pricing page in disguise and reads like one.",
      ],
    },
    posts: [
      {
        id: "agp-p33",
        network: "instagram",
        publishedOn: "14 Jul 2026",
        author: {
          name: "Buffer",
          handle: "@buffer",
          initials: "BF",
          accent: "electric-blue",
        },
        text: "We are simplifying pricing. One price per channel, every feature on every plan, no seat maths. What you pay now is what you pay when your team doubles.",
        likes: 63,
        comments: 14,
        reposts: 0,
      },
      {
        id: "agp-p34",
        network: "instagram",
        publishedOn: "8 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "New plans, live today. Pricing now follows brands rather than channels, so a team running twelve profiles for one brand pays for one brand. Simpler to predict, simpler to approve.",
        likes: 29,
        comments: 7,
        reposts: 0,
      },
      {
        id: "agp-p35",
        network: "instagram",
        publishedOn: "1 Jul 2026",
        author: {
          name: "Sprout Social",
          handle: "@sproutsocial",
          initials: "SS",
          accent: "green",
        },
        text: "A clearer way to buy Sprout. Seats are unbundled from channels, so you add reviewers without adding publishing licences. Same platform, a plan that matches how teams are actually shaped.",
        likes: 22,
        comments: 3,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "6 months ago",
        note: "Surfaced from the competitor scan (3 matching items).",
      },
    ],
  },
  {
    id: "br-37",
    feedId: "topic-list-6",
    sourceId: "competitor-posts",
    ageLabel: "6mo ago",
    kind: "later",
    headline: "The approval workflow is everyone's screenshot and nobody's argument",
    summary:
      "Four posts across two accounts show an approval queue in a product shot. None of them says what it prevents — the wrong logo, the unapproved claim, the post that went out during an outage.",
    article: {
      title: "They show the queue. The story is the thing that did not get published",
      subheads: ["Four screenshots, no consequence", "The near-miss nobody will describe"],
      paragraphs: [
        "Four items, two accounts, all product screenshots: a draft, a reviewer, a green tick. The feature is table stakes and the copy treats it that way — a caption naming the feature and a link.",
        "What none of them has is a consequence. An approval step earns its cost exactly once, on the day it catches the post that would have been a problem, and that is the only version of this story anyone remembers.",
        "This is a strong pillar and a weak post, which is the distinction worth keeping: the argument is available, the evidence is not.",
        "Blocked on: one customer willing to describe a near-miss on the record. Anonymised it is a hypothetical, and a hypothetical is what all four of these screenshots already are.",
      ],
    },
    posts: [
      {
        id: "agp-p36",
        network: "instagram",
        publishedOn: "16 Jul 2026",
        author: {
          name: "Sprout Social",
          handle: "@sproutsocial",
          initials: "SS",
          accent: "green",
        },
        text: "Draft, review, approve. Every post through one queue, with the reviewer named and the version history kept. Link in bio for the walkthrough.",
        likes: 19,
        comments: 2,
        reposts: 0,
      },
      {
        id: "agp-p37",
        network: "instagram",
        publishedOn: "6 Jul 2026",
        author: {
          name: "Sprout Social",
          handle: "@sproutsocial",
          initials: "SS",
          accent: "green",
        },
        text: "Approval workflows, now with conditional steps — legal only sees the posts that mention a claim. Fewer bottlenecks, same paper trail.",
        likes: 26,
        comments: 4,
        reposts: 0,
      },
      {
        id: "agp-p38",
        network: "instagram",
        publishedOn: "13 Jul 2026",
        author: {
          name: "Hootsuite",
          handle: "@hootsuite",
          initials: "HS",
          accent: "yellow",
        },
        text: "Set who signs off on what, per channel and per campaign. Nest keeps the queue and the record, so nothing publishes without the pair of eyes you decided it needed.",
        likes: 17,
        comments: 1,
        reposts: 0,
      },
      {
        id: "agp-p39",
        network: "instagram",
        publishedOn: "2 Jul 2026",
        author: {
          name: "Sprinklr",
          handle: "@sprinklr",
          initials: "SP",
          accent: "orange",
        },
        text: "Governance is not a feature you notice until you need it. Approval paths, audit trails and brand-safety checks across every channel — configured once, enforced everywhere.",
        likes: 11,
        comments: 0,
        reposts: 0,
      },
    ],
    seedStatus: "new",
    history: [
      {
        status: "new",
        when: "6 months ago",
        note: "Surfaced from the competitor scan (4 matching items).",
      },
    ],
  },
];

// ---- Posts (shown in the session Posts tab when populated) ----------------
//
// Partitioned by session so each conversation owns its own drafts —
// counters in the topbar pill, status card and chat picker derive from
// these arrays on a per-session basis.

const AUTHOR_MC = {
  name: "Maya Chen",
  title: "Head of Marketing",
  initials: "MC",
  connection: "1st",
  visibility: "Public",
};

const AUTHOR_JT = {
  name: "Jamie Torres",
  title: "Founder & CEO",
  initials: "JT",
  connection: "1st",
  visibility: "Public",
};

// Provenance stamped on every seeded draft so each card shows the collapsible
// "Generation context" panel (post-card.js) — same shape draft-flow's
// ideaContext produces for live idea drafts: the angle picked as the headline
// pill + the source idea the draft drew on. Keeps the demo honest: every
// existing draft can show where it came from, not just newly generated ones.
const seedIdeaGen = (angle, ideaTitle) => ({
  kind: "idea",
  headline: { icon: "ap-icon-target", text: `Angle · ${angle}` },
  source: { icon: "ap-icon-sparkles", label: "1 source idea", detail: ideaTitle },
});

export const postsBySession = {
  // Written while the Playbook was still shared. They survive the loss of
  // access: everything on these cards that SAVES or SCHEDULES keeps working,
  // everything that GENERATES does not.
  "s-brightline": [
    {
      id: "post-brightline-1",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "1w",
      text: [
        "Brightline ships next month. The part we're proudest of isn't the routing engine — it's that ops leads can override it without calling us.",
        "Every automation we shipped this year came with a manual escape hatch. That's the whole product philosophy in one sentence.",
      ],
      hashtags: ["Logistics", "Ops"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
    },
    {
      id: "post-brightline-2",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "1w",
      text: [
        "We asked twelve ops leads what they'd automate last. Every single one said the exception queue — the thing most tools automate first.",
        "So we didn't. Brightline routes the predictable 80% and hands you the rest with the context already attached.",
      ],
      hashtags: ["Logistics"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
    },
  ],
  "s-acme-launch": [
    {
      id: "post-acme-1",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "3h",
      text: [
        "Your Q2 plan isn't a plan, it's a wish list — unless every objective names the single signal you'll watch weekly to prove it.",
        "Teams who track one weekly proof point ship on cadence. Teams who wait for quarterly wrap-ups publish less, and ship less.",
      ],
      hashtags: ["Q2Planning", "ContentOps"],
      cta: "",
      stats: { likes: 147, comments: 8, reposts: 11 },
      hasImage: false,
      generationContext: seedIdeaGen("The data-backed post-mortem", "Why we stopped writing quarterly OKRs"),
    },
    {
      id: "post-acme-2",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "needs_fixes",
      timeLabel: "6h",
      text: [
        "Short version of today's offsite: we stopped writing quarterly OKRs. Here's what replaced them and why the team ships faster now.",
        "The replacement is simple: one weekly operating signal, one owner, and one decision the team can actually make before Friday.",
      ],
      hashtags: ["OKRs", "OperatorNotes"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The contrarian take", "Why we stopped writing quarterly OKRs"),
      errors: [
        {
          id: "e-acme-2-1",
          message: "Caption exceeds 2,200 characters for LinkedIn.",
          field: "caption",
          platform: "linkedin",
        },
        {
          id: "e-acme-2-2",
          message: "First comment requires at least one mention.",
          field: "firstComment",
          platform: "linkedin",
        },
      ],
    },
    {
      id: "post-acme-3",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "2d",
      text: [
        "Three constraints killed our first launch: scope, distribution, and onboarding. All three were visible at the offsite — and all three were missing from the retrospective doc.",
        "If your retro doesn't name the constraints, your next launch will hit the same ones.",
      ],
      hashtags: ["Launches", "Retros"],
      cta: "",
      stats: { likes: 198, comments: 22, reposts: 14 },
      hasImage: false,
      generationContext: seedIdeaGen("The honest founder retro", "The three constraints that killed our first launch"),
    },
    {
      id: "post-acme-4",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "needs_fixes",
      timeLabel: "3d",
      text: [
        "Behind-the-scenes on the founder keynote — including the parts that got cut. The cuts are more instructive than the keynote itself.",
      ],
      hashtags: ["FounderKeynote", "BTS"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The behind-the-scenes recap", "What a founder keynote looks like at 50 people"),
      errors: [
        {
          id: "e-acme-4-1",
          message: "Image dimensions invalid for LinkedIn (1200×627 recommended).",
          field: "media",
          platform: "linkedin",
        },
      ],
    },
  ],
  "s-riverside": [
    {
      id: "post-riv-1",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "2h",
      text: [
        "Riverside cut 11 hours a week off their content workflow. They didn't add tools — they removed three.",
        "The change started with a single decision: pick one place to start every draft. Everything downstream followed from there.",
      ],
      hashtags: ["CustomerStory", "Workflow"],
      cta: "Read the full Riverside story →",
      stats: { likes: 132, comments: 9, reposts: 7 },
      hasImage: false,
      generationContext: seedIdeaGen("The customer-proof angle", "Riverside's 6-week onboarding rebuild"),
    },
    {
      id: "post-riv-2",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "5h",
      text: [
        '"We just needed one place to start a draft." — that line from the discovery call became the brief for the entire rebuild.',
        "Six weeks later, the Riverside team is publishing 2× the cadence with the same headcount.",
      ],
      hashtags: ["CustomerVoice", "Quotes"],
      cta: "",
      stats: { likes: 89, comments: 6, reposts: 4 },
      hasImage: false,
      generationContext: seedIdeaGen("The verbatim quote", '"We just needed one place to start a draft."'),
    },
    {
      id: "post-riv-3",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "needs_fixes",
      timeLabel: "yesterday",
      text: [
        "The metric Riverside cared about that we didn't track — until they told us. Sharing the reframe that flipped our roadmap.",
      ],
      hashtags: ["Discovery", "Roadmap"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The reframe angle", "The metric Riverside cared about that we didn't track"),
      errors: [
        {
          id: "e-riv-3-1",
          message: "Post body is too short for LinkedIn's recommended length (200+ chars).",
          field: "caption",
          platform: "linkedin",
        },
      ],
    },
    {
      id: "post-riv-4",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "scheduled",
      scheduledForLabel: "Tue · 9:30",
      timeLabel: "yesterday",
      text: [
        "Spreadsheet chaos → one workflow, in six weeks. The Riverside arc, told with the before/after metrics they tracked themselves.",
        "Three numbers stood out: 11h/week saved, 2× publishing cadence, and 0 tools added.",
      ],
      hashtags: ["BeforeAfter", "Operators"],
      cta: "Read the full case study →",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen(
        "The before-and-after story",
        "From spreadsheet chaos to one workflow — the Riverside arc",
      ),
    },
    {
      id: "post-riv-5",
      author: AUTHOR_MC,
      network: "twitter",
      status: "ready",
      timeLabel: "2d",
      text: ['"We just needed one place to start a draft."', "Six weeks later, 2× the cadence, same team."],
      hashtags: [],
      cta: "",
      stats: { likes: 41, comments: 2, reposts: 6 },
      hasImage: false,
      generationContext: seedIdeaGen("The punchy quote hook", '"We just needed one place to start a draft."'),
    },
  ],
  "s-state-of-social": [
    {
      id: "post-sos-1",
      author: AUTHOR_JT,
      network: "linkedin",
      status: "ready",
      timeLabel: "1h",
      text: [
        "A quick operator note for B2B teams: weekly proof points build more trust than polished campaign reveals.",
        "The 2026 State of Social repeatedly emphasizes how audience trust rises when brands publish one concrete learning per week instead of one massive campaign wrap-up at the end of the quarter.",
        "If Q2 B2B Social Growth wants more repeatable reach, publish the useful lesson now, support it with one real signal from B2B Social…",
      ],
      hashtags: ["Longform", "Reports", "B2BMarketing"],
      cta: "Follow for more practical B2B content systems and repeatable editorial angles.",
      stats: { likes: 281, comments: 13, reposts: 19 },
      hasImage: false,
      generationContext: seedIdeaGen(
        "The data-backed manifesto",
        "Three numbers from the 2026 report that flipped my Q3 plan",
      ),
    },
    {
      id: "post-sos-2",
      author: AUTHOR_JT,
      network: "linkedin",
      status: "scheduled",
      scheduledForLabel: "Thu · 9:00",
      timeLabel: "yesterday",
      text: [
        "The one founder story we won't tell — and why editorial restraint is a better brand move than another launch anthem.",
        "A meta-post about why our team chooses which roadmap pieces to talk about publicly. Restraint is a feature.",
      ],
      hashtags: ["Editorial", "Founders"],
      cta: "Save this one — useful the next time you're tempted to post something just to post.",
      stats: { likes: 62, comments: 4, reposts: 2 },
      hasImage: false,
      generationContext: seedIdeaGen("The editorial rule of thumb", "The one founder story we won't tell (and why)"),
    },
  ],
  "s-weekly-recap": [
    {
      id: "post-weekly-1",
      author: AUTHOR_MC,
      network: "linkedin",
      status: "ready",
      timeLabel: "4d",
      text: [
        "Week 12 reach split: Tuesday morning 2.3× Thursday afternoon. Same length, same author, same hashtags.",
        "Timing remains the cheapest lever we have — and the one most teams stop testing after their second month.",
      ],
      hashtags: ["WeeklyRecap", "Timing"],
      cta: "",
      stats: { likes: 73, comments: 5, reposts: 3 },
      hasImage: false,
      generationContext: seedIdeaGen("The tactical breakdown", "What week 12 told us about Tuesday vs Thursday"),
    },
  ],
};

// ---- Assistant thread seeds (per-session conversation history) -----------
//
// Each demo session gets a scripted thread so opening one looks like a
// real, mid-flight conversation instead of an empty hero. Turns mirror
// the live assistant.js shape exactly — assistant.js's seedThread()
// clones each turn, assigns a fresh id + createdAt, and drops them into
// the per-session thread map. Brand-new sessions (id === "new" or
// runtime-created) keep the default greeting → empty hero path.
//
// Ids on draft/extraction sub-items reference the actual ids in
// postsBySession / ideasBySession so the cards link back to the real
// content on click.

export const threadsBySession = {
  "s-brightline": [
    {
      role: "user",
      meta: "You",
      text: "Draft two launch posts from the Brightline brief — lead with the escape hatch, not the routing engine.",
    },
    {
      role: "assistant",
      variant: "draft",
      meta: "Archie",
      ideaTitle: "The automation ops leads actually asked for",
      drafts: [
        {
          id: "post-brightline-1",
          network: "linkedin",
          preview:
            "Brightline ships next month. The part we're proudest of isn't the routing engine — it's that ops leads can override it without calling us.",
        },
        {
          id: "post-brightline-2",
          network: "linkedin",
          preview:
            "We asked twelve ops leads what they'd automate last. Every single one said the exception queue — the thing most tools automate first.",
        },
      ],
      count: 2,
      open: false,
    },
  ],
  "s-acme-launch": [
    {
      role: "assistant",
      meta: "Archie",
      text: "Hi. Want me to compare ideas, pick the strongest one, or draft a post? You can also type a question or drop a source.",
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "PDF",
      filename: "q2-strategy-offsite-notes.pdf",
      size: "1.2mb",
      sourceId: "src-acme-1",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "q2-strategy-offsite-notes.pdf",
      ideas: [
        {
          id: "idea-acme-1",
          title: "The three constraints that killed our first launch",
          body: "A candid retro framed around the three bottlenecks we kept underestimating: scope, distribution, and onboarding.",
        },
        {
          id: "idea-acme-2",
          title: "Why we stopped writing quarterly OKRs",
          body: "Contrarian take grounded in the offsite notes. Frames OKRs as a lagging signal rather than a tool for focus.",
        },
      ],
      count: 2,
      open: false,
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "Video",
      filename: "founder-keynote.mp4",
      size: "34mb",
      sourceId: "src-acme-2",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "founder-keynote.mp4",
      ideas: [
        {
          id: "idea-acme-3",
          title: "What a founder keynote looks like at 50 people",
          body: "Behind-the-scenes recap of the keynote, including the bits that got cut.",
        },
        {
          id: "idea-acme-4",
          title: '"Studio isn\'t about replacing the writer."',
          body: "\"Studio isn't about replacing the writer — it's about removing the blank page.\"",
        },
      ],
      count: 2,
      open: false,
    },
    {
      role: "user",
      meta: "You",
      text: "Pull the strongest ideas from these and draft 4 posts across LinkedIn and X.",
    },
    {
      role: "assistant",
      meta: "Archie",
      text: 'I drafted 4 posts grounded in "The three constraints that killed our first launch". Each is sized for its network and follows the Acme · Q2 marketing playbook. Two are ready; one is past LinkedIn\'s caption limit and one is missing image dimensions — both flagged in the Drafts panel.',
    },
    {
      role: "assistant",
      variant: "draft",
      meta: "Archie",
      ideaTitle: "The three constraints that killed our first launch",
      drafts: [
        {
          id: "post-acme-1",
          network: "linkedin",
          preview:
            "Your Q2 plan isn't a plan, it's a wish list — unless every objective names the single signal you'll watch weekly to prove it.",
        },
        {
          id: "post-acme-2",
          network: "linkedin",
          preview:
            "Short version of today's offsite: we stopped writing quarterly OKRs. Here's what replaced them and why the team ships faster now.",
        },
        {
          id: "post-acme-3",
          network: "linkedin",
          preview:
            "Three constraints killed our first launch: scope, distribution, and onboarding. All three were visible at the offsite — and all three were missing from the retrospective doc.",
        },
        {
          id: "post-acme-4",
          network: "linkedin",
          preview:
            "Behind-the-scenes on the founder keynote — including the parts that got cut. The cuts are more instructive than the keynote itself.",
        },
      ],
      count: 4,
      open: false,
    },
  ],
  "s-riverside": [
    {
      role: "assistant",
      meta: "Archie",
      text: "Hi. Want me to compare ideas, pick the strongest one, or draft a post? You can also type a question or drop a source.",
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "Audio",
      filename: "riverside-discovery-call.mp3",
      size: "18mb",
      sourceId: "src-riv-1",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "riverside-discovery-call.mp3",
      ideas: [
        {
          id: "idea-riv-1",
          title: "Riverside's 6-week onboarding rebuild",
          body: "The arc: legacy CMS → unified Studio workflow. Three decisions that compounded, told from the customer's POV.",
        },
        {
          id: "idea-riv-2",
          title: "The metric Riverside cared about that we didn't track",
          body: "How a single discovery call reframed our success metric — and why it changed the roadmap that quarter.",
        },
        {
          id: "idea-riv-3",
          title: '"We just needed one place to start a draft."',
          body: '"We just needed one place to start a draft. Everything else followed from that."',
        },
      ],
      count: 3,
      open: false,
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "PDF",
      filename: "riverside-case-study-draft.pdf",
      size: "0.8mb",
      sourceId: "src-riv-2",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "riverside-case-study-draft.pdf",
      ideas: [
        {
          id: "idea-riv-4",
          title: "From spreadsheet chaos to one workflow — the Riverside arc",
          body: "The before/after of consolidating four tools into one. Numbers from the case study draft: 11 hours/week reclaimed.",
        },
      ],
      count: 1,
      open: false,
    },
    {
      role: "user",
      meta: "You",
      text: "Turn this into 5 customer-story posts — 4 LinkedIn, 1 X. Lead with their words.",
    },
    {
      role: "assistant",
      meta: "Archie",
      text: 'Drafted 5 posts grounded in "Riverside\'s 6-week onboarding rebuild". Each leads with a customer quote, names the metric, and closes with a link to the case study. One needs a longer LinkedIn body — flagged in Drafts.',
    },
    {
      role: "assistant",
      variant: "draft",
      meta: "Archie",
      ideaTitle: "Riverside's 6-week onboarding rebuild",
      drafts: [
        {
          id: "post-riv-1",
          network: "linkedin",
          preview:
            "Riverside cut 11 hours a week off their content workflow. They didn't add tools — they removed three.",
        },
        {
          id: "post-riv-2",
          network: "linkedin",
          preview:
            '"We just needed one place to start a draft." — that line from the discovery call became the brief for the entire rebuild.',
        },
        {
          id: "post-riv-3",
          network: "linkedin",
          preview:
            "The metric Riverside cared about that we didn't track — until they told us. Sharing the reframe that flipped our roadmap.",
        },
        {
          id: "post-riv-4",
          network: "linkedin",
          preview:
            "Spreadsheet chaos → one workflow, in six weeks. The Riverside arc, told with the before/after metrics they tracked themselves.",
        },
        {
          id: "post-riv-5",
          network: "twitter",
          preview: '"We just needed one place to start a draft."',
        },
      ],
      count: 5,
      open: false,
    },
  ],
  "s-state-of-social": [
    {
      role: "assistant",
      meta: "Archie",
      text: "Hi. Want me to compare ideas, pick the strongest one, or draft a post? You can also type a question or drop a source.",
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "PDF",
      filename: "state-of-social-2026-report.pdf",
      size: "3.4mb",
      sourceId: "src-sos-1",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "state-of-social-2026-report.pdf",
      ideas: [
        {
          id: "idea-sos-1",
          title: "73% of social managers say context-switching is their #1 blocker",
          body: "Year-over-year jump in the State of Social 2026 — context-switching is now ranked above hiring and tooling cost.",
        },
        {
          id: "idea-sos-2",
          title: "The platform decline no one wants to call",
          body: "Two-year trend buried in the report: organic reach on the big-three networks is down 34% on average.",
        },
        {
          id: "idea-sos-3",
          title: "Why Gen Z marketers are leaving the funnel framework behind",
          body: "A hook framed around generational shifts the report names but doesn't unpack.",
        },
        {
          id: "idea-sos-4",
          title: "Three numbers from the 2026 report that flipped my Q3 plan",
          body: "A short-form retrospective listing three counter-intuitive findings and what I changed.",
        },
      ],
      count: 4,
      open: false,
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "Video",
      filename: "social-trends-keynote.mp4",
      size: "42mb",
      sourceId: "src-sos-2",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "social-trends-keynote.mp4",
      ideas: [
        {
          id: "idea-sos-5",
          title: '"Posting more is not strategy — it never was."',
          body: '"Posting more is not strategy — it never was. Picking the right beat is."',
        },
        {
          id: "idea-sos-6",
          title: "The one founder story we won't tell (and why)",
          body: "A meta-post about editorial restraint — when not posting is itself the brand move.",
        },
      ],
      count: 2,
      open: false,
    },
    {
      role: "user",
      meta: "You",
      text: "What's the strongest thought-leadership angle in here? Draft 2 posts.",
    },
    {
      role: "assistant",
      meta: "Archie",
      text: 'The strongest signal is "73% of social managers say context-switching is their #1 blocker" — hard year-over-year delta, credible source. I drafted 2 posts: one long-form for LinkedIn, one scheduled mid-week for the founder account.',
    },
    {
      role: "assistant",
      variant: "draft",
      meta: "Archie",
      ideaTitle: "73% of social managers say context-switching is their #1 blocker",
      drafts: [
        {
          id: "post-sos-1",
          network: "linkedin",
          preview:
            "A quick operator note for B2B teams: weekly proof points build more trust than polished campaign reveals.",
        },
        {
          id: "post-sos-2",
          network: "linkedin",
          preview:
            "The one founder story we won't tell — and why editorial restraint is a better brand move than another launch anthem.",
        },
      ],
      count: 2,
      open: false,
    },
  ],
  "s-weekly-recap": [
    {
      role: "assistant",
      meta: "Archie",
      text: "Hi. Want me to compare ideas, pick the strongest one, or draft a post? You can also type a question or drop a source.",
    },
    {
      role: "source-intake",
      meta: "Source intake",
      kind: "PDF",
      filename: "analytics-week-12.pdf",
      size: "0.4mb",
      sourceId: "src-weekly-1",
      status: "ready",
    },
    {
      role: "assistant",
      variant: "extraction",
      meta: "Archie",
      filename: "analytics-week-12.pdf",
      ideas: [
        {
          id: "idea-weekly-1",
          title: "What week 12 told us about Tuesday vs Thursday",
          body: "Engagement split this week ran 2.3× higher on Tuesday morning than Thursday afternoon — same length, same author.",
        },
        {
          id: "idea-weekly-2",
          title: "The post we almost skipped that pulled the week",
          body: "A short retro about the post we nearly didn't publish — and the reach numbers that came out of it.",
        },
      ],
      count: 2,
      open: false,
    },
    {
      role: "user",
      meta: "You",
      text: "Draft the recap post.",
    },
    {
      role: "assistant",
      meta: "Archie",
      text: 'Drafted 1 LinkedIn post grounded in "What week 12 told us about Tuesday vs Thursday" — opens with the 2.3× delta and closes on the cheapest lever most teams stop testing.',
    },
    {
      role: "assistant",
      variant: "draft",
      meta: "Archie",
      ideaTitle: "What week 12 told us about Tuesday vs Thursday",
      drafts: [
        {
          id: "post-weekly-1",
          network: "linkedin",
          preview:
            "Week 12 reach split: Tuesday morning 2.3× Thursday afternoon. Same length, same author, same hashtags.",
        },
      ],
      count: 1,
      open: false,
    },
  ],
};

// ── Already-scheduled queue ──────────────────────────────────────────────
// Seed for the schedule modal's calendar context. Represents posts the
// user (or teammates) queued across other sessions / outside Archie — so
// the calendar dots and "N posts already scheduled" affordance feel
// populated from the first open instead of empty until the user schedules
// something themselves.
//
// Each entry is a lightweight summary: `id`, `network`, `text` (first
// line shown in the day list), `when` (epoch ms). The real queue is
// owned by the publishing backend ; this mock stands in for the GET that
// would fetch upcoming posts in a date range.
//
// The list is *seeded relative to "today"* so the calendar always shows
// upcoming activity regardless of when the prototype is opened.
function seedScheduledQueue() {
  const now = new Date();
  const at = (daysFromNow, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  // Day offsets chosen to land 1–14 days out with two clusters (mid-week
  // peak around d+2 / d+9) so the calendar density reads naturally.
  return [
    {
      id: "sched-1",
      network: "linkedin",
      text: "Behind the offsite: the three constraints we keep hitting",
      when: at(1, 9, 0),
    },
    {
      id: "sched-2",
      network: "twitter",
      text: "Tiny thread on weekly proof points →",
      when: at(2, 10, 30),
    },
    {
      id: "sched-3",
      network: "linkedin",
      text: "Why we stopped writing quarterly OKRs",
      when: at(2, 14, 0),
    },
    {
      id: "sched-4",
      network: "instagram",
      text: "Team retro recap — slide carousel",
      when: at(3, 11, 0),
    },
    {
      id: "sched-5",
      network: "twitter",
      text: "Hot take: editorial restraint > another launch anthem",
      when: at(5, 17, 0),
    },
    {
      id: "sched-6",
      network: "linkedin",
      text: "One weekly operating signal — operator note",
      when: at(7, 9, 0),
    },
    {
      id: "sched-7",
      network: "facebook",
      text: "Customer story: how Acme cut content QA in half",
      when: at(8, 13, 0),
    },
    {
      id: "sched-8",
      network: "linkedin",
      text: "Founder keynote BTS — the cuts are more instructive",
      when: at(9, 12, 0),
    },
    {
      id: "sched-9",
      network: "twitter",
      text: "Three things I'd cut from your retro doc",
      when: at(9, 14, 0),
    },
    {
      id: "sched-10",
      network: "instagram",
      text: "Reel: weekly proof points in 30 seconds",
      when: at(12, 19, 0),
    },
  ];
}

export const scheduledQueue = seedScheduledQueue();

// Lookup helpers ----------------------------------------------------------------

// ── Settings drawer mocks ─────────────────────────────────────────────────
// All settings sections are mocked in-memory. Connect/disconnect, save, etc.
// flip these objects locally — no persistence.

// Mock doc lists exposed by each connector once "connected". Used by the
// Add source modal's Browse sub-screen.
export const connectorDocs = {
  slite: [
    { id: "slite-1", title: "Q2 strategy offsite — full notes", kind: "Doc", size: "8 min read", iconKey: "text" },
    { id: "slite-2", title: "Brand guidelines v3", kind: "Doc", size: "12 min read", iconKey: "text" },
    { id: "slite-3", title: "Onboarding playbook", kind: "Doc", size: "5 min read", iconKey: "text" },
    { id: "slite-4", title: "Customer interview — Acme", kind: "Doc", size: "4 min read", iconKey: "text" },
    { id: "slite-5", title: "Sales enablement deck — narrative", kind: "Doc", size: "9 min read", iconKey: "text" },
    { id: "slite-6", title: "Engineering principles", kind: "Doc", size: "6 min read", iconKey: "text" },
  ],
  notion: [
    { id: "notion-1", title: "Roadmap H2 2026", kind: "Page", size: "Updated 2d ago", iconKey: "text" },
    { id: "notion-2", title: "Hiring plan — design + eng", kind: "Page", size: "Updated 1w ago", iconKey: "text" },
    { id: "notion-3", title: "Engineering wiki — home", kind: "Page", size: "Updated 3d ago", iconKey: "text" },
    { id: "notion-4", title: "Q1 retro notes", kind: "Page", size: "Updated 1mo ago", iconKey: "text" },
    { id: "notion-5", title: "Pricing experiment results", kind: "Page", size: "Updated 4d ago", iconKey: "text" },
  ],
  gdrive: [
    { id: "gd-1", title: "Q2-pitch.pdf", kind: "PDF", size: "2.4 MB", iconKey: "pdf" },
    { id: "gd-2", title: "Customer logos.png", kind: "Image", size: "780 KB", iconKey: "image" },
    { id: "gd-3", title: "Founder keynote — rough cut.mp4", kind: "Video", size: "84 MB", iconKey: "video" },
    { id: "gd-4", title: "Pricing model.xlsx", kind: "Spreadsheet", size: "1.1 MB", iconKey: "file" },
    { id: "gd-5", title: "Brand assets/", kind: "Folder", size: "32 files", iconKey: "file" },
    { id: "gd-6", title: "Customer success stories.docx", kind: "Word", size: "640 KB", iconKey: "word" },
  ],
  slack: [
    { id: "slack-1", title: "#product-launches — last 7 days", kind: "Channel", size: "120 messages", iconKey: "text" },
    { id: "slack-2", title: "#wins — Q2 highlights", kind: "Channel", size: "48 messages", iconKey: "text" },
    { id: "slack-3", title: "DM with Lucia — messaging draft", kind: "Thread", size: "26 messages", iconKey: "text" },
    {
      id: "slack-4",
      title: "#feedback — recent customer pings",
      kind: "Channel",
      size: "60 messages",
      iconKey: "text",
    },
    { id: "slack-5", title: "#leadership — strategy thread", kind: "Thread", size: "18 messages", iconKey: "text" },
  ],
  confluence: [
    { id: "conf-1", title: "Product spec — Inbox v4", kind: "Page", size: "Updated 3d ago", iconKey: "text" },
    { id: "conf-2", title: "GTM playbook — Q3", kind: "Page", size: "Updated 1w ago", iconKey: "text" },
    { id: "conf-3", title: "Architecture decision records", kind: "Space", size: "42 pages", iconKey: "text" },
  ],
  gdocs: [
    { id: "gdocs-1", title: "Messaging house — master", kind: "Doc", size: "Updated 2d ago", iconKey: "text" },
    { id: "gdocs-2", title: "Webinar script — April", kind: "Doc", size: "6 min read", iconKey: "text" },
  ],
  dropbox: [
    { id: "dbx-1", title: "Brand kit 2026/", kind: "Folder", size: "58 files", iconKey: "file" },
    { id: "dbx-2", title: "Case study — Acme.pdf", kind: "PDF", size: "1.8 MB", iconKey: "pdf" },
  ],
  onedrive: [
    { id: "od-1", title: "Sales deck — enterprise.pptx", kind: "Slides", size: "9.2 MB", iconKey: "file" },
    { id: "od-2", title: "Quarterly report.docx", kind: "Word", size: "720 KB", iconKey: "word" },
  ],
  box: [
    { id: "box-1", title: "Legal — MSA template.pdf", kind: "PDF", size: "320 KB", iconKey: "pdf" },
    { id: "box-2", title: "Customer assets/", kind: "Folder", size: "120 files", iconKey: "file" },
  ],
  github: [
    { id: "gh-1", title: "product/roadmap — open issues", kind: "Issues", size: "37 open", iconKey: "text" },
    { id: "gh-2", title: "Release notes — v2.8.0", kind: "Release", size: "Published 4d ago", iconKey: "text" },
    { id: "gh-3", title: "PR #1284 — Inbox filters", kind: "Pull request", size: "Merged", iconKey: "text" },
  ],
  linear: [
    { id: "lin-1", title: "Cycle 41 — committed scope", kind: "Cycle", size: "22 issues", iconKey: "text" },
    { id: "lin-2", title: "ENG-902 — Live connectors", kind: "Issue", size: "In progress", iconKey: "text" },
  ],
  jira: [
    { id: "jira-1", title: "SOCIAL-1203 — Calendar revamp", kind: "Epic", size: "14 stories", iconKey: "text" },
    { id: "jira-2", title: "Sprint 58 — board", kind: "Sprint", size: "31 issues", iconKey: "text" },
  ],
  trello: [
    { id: "trello-1", title: "Content calendar — June", kind: "Board", size: "48 cards", iconKey: "text" },
    { id: "trello-2", title: "Campaign — Summer launch", kind: "List", size: "12 cards", iconKey: "text" },
  ],
  asana: [
    { id: "asana-1", title: "Launch checklist — v2.8", kind: "Project", size: "26 tasks", iconKey: "text" },
    { id: "asana-2", title: "Content ops — recurring", kind: "Project", size: "40 tasks", iconKey: "text" },
  ],
  figma: [
    { id: "fig-1", title: "Brand system — components", kind: "File", size: "Updated 1d ago", iconKey: "image" },
    { id: "fig-2", title: "Social templates — 2026", kind: "File", size: "Updated 5d ago", iconKey: "image" },
  ],
  teams: [
    { id: "teams-1", title: "Marketing — General", kind: "Channel", size: "82 messages", iconKey: "text" },
    { id: "teams-2", title: "Launch room — standup", kind: "Channel", size: "37 messages", iconKey: "text" },
  ],
  discord: [
    { id: "disc-1", title: "#community — last 7 days", kind: "Channel", size: "210 messages", iconKey: "text" },
    { id: "disc-2", title: "#feedback — feature asks", kind: "Channel", size: "64 messages", iconKey: "text" },
  ],
  hubspot: [
    { id: "hs-1", title: "Q2 pipeline — closing soon", kind: "Deals", size: "18 deals", iconKey: "text" },
    { id: "hs-2", title: "Customer testimonials — list", kind: "Contacts", size: "32 records", iconKey: "text" },
  ],
  salesforce: [
    {
      id: "sf-1",
      title: "Enterprise opportunities — open",
      kind: "Opportunities",
      size: "24 records",
      iconKey: "text",
    },
    { id: "sf-2", title: "Account — Acme Corp", kind: "Account", size: "Updated 2d ago", iconKey: "text" },
  ],
  intercom: [
    { id: "ic-1", title: "Recent conversations — billing", kind: "Conversations", size: "53 threads", iconKey: "text" },
    { id: "ic-2", title: "Help center — top articles", kind: "Articles", size: "120 articles", iconKey: "text" },
  ],
  zendesk: [
    { id: "zd-1", title: "Tickets — last 7 days", kind: "Tickets", size: "88 tickets", iconKey: "text" },
    { id: "zd-2", title: "Knowledge base — product", kind: "Articles", size: "64 articles", iconKey: "text" },
  ],
  airtable: [
    { id: "at-1", title: "Content calendar", kind: "Base", size: "4 tables", iconKey: "file" },
    { id: "at-2", title: "Client roster", kind: "Table", size: "62 records", iconKey: "file" },
    { id: "at-3", title: "Asset library — briefs", kind: "Table", size: "138 records", iconKey: "file" },
    { id: "at-4", title: "Campaign tracker — Q3", kind: "Table", size: "27 records", iconKey: "file" },
  ],
  zoom: [
    { id: "zoom-1", title: "Discovery call — Acme.mp4", kind: "Recording", size: "42 min", iconKey: "video" },
    { id: "zoom-2", title: "Webinar — Retention tactics", kind: "Recording", size: "58 min", iconKey: "video" },
    { id: "zoom-3", title: "Customer QBR — transcript", kind: "Transcript", size: "11k words", iconKey: "text" },
    { id: "zoom-4", title: "Team retro — June", kind: "Recording", size: "34 min", iconKey: "video" },
  ],
  fathom: [
    { id: "fathom-1", title: "Sales call — Northwind", kind: "Summary", size: "Updated 1d ago", iconKey: "text" },
    {
      id: "fathom-2",
      title: "Podcast interview — full transcript",
      kind: "Transcript",
      size: "9k words",
      iconKey: "text",
    },
    { id: "fathom-3", title: "Strategy sync — highlights", kind: "Highlights", size: "12 clips", iconKey: "text" },
  ],
};

// Connectors catalog. Each connector behaves like a Codex-style extension:
// once connected it becomes a LIVE, queryable source (the assistant searches
// its content via a simulated MCP query — see assistant.js sendConnectorMessage).
//
// Fields:
//   category      grouping for the gallery (Docs & wikis / Storage / …)
//   featured      surfaced in the gallery's "Featured" grid
//   accent        brand color used by the monogram-tile fallback (no token —
//                 these are third-party brand identities, like social logos)
//   capabilities  MCP-tool-style verbs; shown as the connector's "tools" and
//                 replayed in the simulated "Querying … via MCP" reasoning chip
//   logo          only the four original connectors ship an SVG asset; the
//                 rest fall back to an accent monogram tile (renderConnectorLogo)
export const connectors = [
  {
    id: "slite",
    name: "Slite",
    desc: "Search and read docs from your Slite workspace",
    category: "Docs & wikis",
    featured: true,
    accent: "#3155EE",
    capabilities: ["Search docs", "Read note content", "List recent edits"],
    logo: "assets/logos/slite.svg",
    status: "connected",
    account: "matt@archie.io",
    lastSync: "just now",
  },
  {
    id: "notion",
    name: "Notion",
    desc: "Search pages and query databases in your Notion workspace",
    category: "Docs & wikis",
    featured: true,
    accent: "#111111",
    capabilities: ["Search pages", "Read page content", "Query databases"],
    logo: "assets/logos/notion.svg",
    status: "connected",
    account: "matthieu@archie.io",
    lastSync: "5 minutes ago",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    desc: "Search files and read documents across your Drive",
    category: "Storage",
    featured: true,
    accent: "#1FA463",
    capabilities: ["Search files", "Read documents", "List folders"],
    logo: "assets/logos/gdrive.svg",
    status: "disconnected",
  },
  {
    id: "slack",
    name: "Slack",
    desc: "Search messages and read channel history",
    category: "Messaging",
    accent: "#611F69",
    capabilities: ["Search messages", "Read channel history", "List channels"],
    logo: "assets/logos/slack.svg",
    status: "disconnected",
  },
  {
    id: "confluence",
    logo: "assets/logos/confluence.svg",
    name: "Confluence",
    desc: "Search spaces and read pages from Confluence",
    category: "Docs & wikis",
    accent: "#1868DB",
    capabilities: ["Search spaces", "Read pages", "List recent updates"],
    status: "disconnected",
  },
  {
    id: "gdocs",
    logo: "assets/logos/gdocs.svg",
    name: "Google Docs",
    desc: "Search and read content from your Google Docs",
    category: "Docs & wikis",
    accent: "#1A73E8",
    capabilities: ["Search docs", "Read document content", "List comments"],
    status: "disconnected",
  },
  {
    id: "dropbox",
    logo: "assets/logos/dropbox.svg",
    name: "Dropbox",
    desc: "Search files and read content stored in Dropbox",
    category: "Storage",
    accent: "#0061FF",
    capabilities: ["Search files", "Read file content", "List folders"],
    status: "disconnected",
  },
  {
    id: "onedrive",
    logo: "assets/logos/onedrive.svg",
    name: "OneDrive",
    desc: "Search files and read documents from OneDrive",
    category: "Storage",
    accent: "#0364B8",
    capabilities: ["Search files", "Read documents", "List folders"],
    status: "disconnected",
  },
  {
    id: "box",
    logo: "assets/logos/box.svg",
    name: "Box",
    desc: "Search files and read content stored in Box",
    category: "Storage",
    accent: "#0061D5",
    capabilities: ["Search files", "Read file content", "List folders"],
    status: "disconnected",
  },
  {
    id: "github",
    logo: "assets/logos/github.svg",
    name: "GitHub",
    desc: "Search repos and read issues, PRs and releases",
    category: "Dev & project",
    featured: true,
    accent: "#24292E",
    capabilities: ["Search repos", "Read issues & PRs", "List releases"],
    status: "disconnected",
  },
  {
    id: "linear",
    logo: "assets/logos/linear.svg",
    name: "Linear",
    desc: "Search issues and read cycle details from Linear",
    category: "Dev & project",
    accent: "#5E6AD2",
    capabilities: ["Search issues", "Read issue details", "List cycles"],
    status: "disconnected",
  },
  {
    id: "jira",
    logo: "assets/logos/jira.svg",
    name: "Jira",
    desc: "Search issues and read sprint details from Jira",
    category: "Dev & project",
    accent: "#2684FF",
    capabilities: ["Search issues", "Read tickets", "List sprints"],
    status: "disconnected",
  },
  {
    id: "trello",
    logo: "assets/logos/trello.svg",
    name: "Trello",
    desc: "Search cards and read boards from Trello",
    category: "Dev & project",
    accent: "#0079BF",
    capabilities: ["Search cards", "Read card content", "List boards"],
    status: "disconnected",
  },
  {
    id: "asana",
    logo: "assets/logos/asana.svg",
    name: "Asana",
    desc: "Search tasks and read projects from Asana",
    category: "Dev & project",
    accent: "#F06A6A",
    capabilities: ["Search tasks", "Read task details", "List projects"],
    status: "disconnected",
  },
  {
    id: "figma",
    logo: "assets/logos/figma.svg",
    name: "Figma",
    desc: "Search files and read frame content from Figma",
    category: "Dev & project",
    accent: "#A259FF",
    capabilities: ["Search files", "Read frame content", "List comments"],
    status: "disconnected",
  },
  {
    id: "teams",
    logo: "assets/logos/teams.svg",
    name: "Microsoft Teams",
    desc: "Search messages and read channel posts from Teams",
    category: "Messaging",
    accent: "#4B53BC",
    capabilities: ["Search messages", "Read channel posts", "List teams"],
    status: "disconnected",
  },
  {
    id: "discord",
    logo: "assets/logos/discord.svg",
    name: "Discord",
    desc: "Search messages and read channel history from Discord",
    category: "Messaging",
    accent: "#5865F2",
    capabilities: ["Search messages", "Read channel history", "List servers"],
    status: "disconnected",
  },
  {
    id: "hubspot",
    logo: "assets/logos/hubspot.svg",
    name: "HubSpot",
    desc: "Search records and read deals and contacts from HubSpot",
    category: "CRM & support",
    accent: "#FF7A59",
    capabilities: ["Search records", "Read deals & contacts", "List pipelines"],
    status: "disconnected",
  },
  {
    id: "salesforce",
    logo: "assets/logos/salesforce.svg",
    name: "Salesforce",
    desc: "Search records and read opportunities from Salesforce",
    category: "CRM & support",
    accent: "#00A1E0",
    capabilities: ["Search records", "Read opportunities", "List accounts"],
    status: "disconnected",
  },
  {
    id: "intercom",
    logo: "assets/logos/intercom.svg",
    name: "Intercom",
    desc: "Search conversations and read help articles from Intercom",
    category: "CRM & support",
    accent: "#1F8DED",
    capabilities: ["Search conversations", "Read tickets", "List articles"],
    status: "disconnected",
  },
  {
    id: "zendesk",
    logo: "assets/logos/zendesk.svg",
    name: "Zendesk",
    desc: "Search tickets and read conversations from Zendesk",
    category: "CRM & support",
    accent: "#03363D",
    capabilities: ["Search tickets", "Read conversations", "List articles"],
    status: "disconnected",
  },
  {
    id: "airtable",
    name: "Airtable",
    desc: "Search bases and read records across your Airtable workspace",
    category: "Storage",
    accent: "#2D7FF9",
    capabilities: ["Search bases", "Read records", "List tables"],
    status: "disconnected",
  },
  {
    id: "zoom",
    name: "Zoom",
    desc: "Search cloud recordings and read meeting transcripts from Zoom",
    category: "Meetings & calls",
    accent: "#0B5CFF",
    capabilities: ["Search recordings", "Read transcripts", "List meetings"],
    status: "disconnected",
  },
  {
    id: "fathom",
    name: "Fathom",
    desc: "Search calls and read AI meeting summaries from Fathom",
    category: "Meetings & calls",
    accent: "#5468FF",
    capabilities: ["Search calls", "Read summaries & highlights", "List meetings"],
    status: "disconnected",
  },
];

// Draft folders — Agorapulse content folders the user can file saved drafts
// into. Seed examples so the "Save in an existing folder" picker has options.
export const draftFolders = [
  { id: "folder-evergreen", name: "Evergreen", count: 21 },
  { id: "folder-launches", name: "Product Launches", count: 12 },
  { id: "folder-thought-leadership", name: "Thought Leadership", count: 8 },
  { id: "folder-customer-stories", name: "Customer Stories", count: 5 },
  { id: "folder-events", name: "Holidays & Events", count: 7 },
];

export const socialAccounts = [
  {
    id: "fb-page",
    platform: "facebook",
    platformLabel: "Facebook",
    kind: "Page",
    name: "Northwind Studio",
    handle: "Northwind Studio",
    photo: "assets/avatars/northwind-studio.svg",
    logo: "assets/logos/social/facebook.svg",
    status: "connected",
    token: "expired",
    postCount: 48,
  },
  {
    id: "ig",
    platform: "instagram",
    platformLabel: "Instagram",
    kind: "Profile",
    name: "Northwind Studio",
    handle: "@northwind.studio",
    photo: "assets/avatars/northwind-studio.svg",
    logo: "assets/logos/social/instagram.svg",
    status: "connected",
    token: "expiring",
    expiresInDays: 7,
    postCount: 0,
  },
  {
    id: "li",
    platform: "linkedin",
    platformLabel: "LinkedIn",
    kind: "Page",
    name: "Northwind Studio Co.",
    handle: "Northwind Studio Co.",
    photo: "assets/avatars/northwind-studio.svg",
    logo: "assets/logos/social/linkedin.svg",
    status: "connected",
    token: "ok",
    postCount: 312,
  },
  {
    id: "x",
    platform: "x",
    platformLabel: "X (Twitter)",
    kind: "Profile",
    name: "Northwind Studio",
    handle: "@northwindhq",
    photo: "assets/avatars/northwind-studio.svg",
    logo: "assets/logos/social/x.svg",
    status: "connected",
    token: "ok",
    postCount: 0,
  },
  {
    id: "tt",
    platform: "tiktok",
    platformLabel: "TikTok",
    logo: "assets/logos/social/tiktok.svg",
    status: "disconnected",
  },
  {
    id: "yt",
    platform: "youtube",
    platformLabel: "YouTube",
    logo: "assets/logos/social/youtube.svg",
    status: "disconnected",
  },
  {
    id: "pin",
    platform: "pinterest",
    platformLabel: "Pinterest",
    logo: "assets/logos/social/pinterest.svg",
    status: "disconnected",
  },
  {
    id: "th",
    platform: "threads",
    platformLabel: "Threads",
    logo: "assets/logos/social/threads.svg",
    status: "disconnected",
  },
  {
    id: "bs",
    platform: "bluesky",
    platformLabel: "Bluesky",
    logo: "assets/logos/social/bluesky.svg",
    status: "disconnected",
  },
];

// Demo dataset for the `manyProfiles` feature flag. A large, varied set of
// CONNECTED social profiles — several brands, each on a handful of the six
// badge-supported networks — so the profile quickpicker's search field can be
// evaluated against a realistic long list. Not part of the default seed;
// social-profiles.js appends it to getConnectedProfiles() only when the flag
// is on. Every entry carries its own `initials` so the avatar fallback reads
// as a distinct brand (no shared photo).
export const demoManyProfiles = (() => {
  // [platform, platformLabel, kind, handleStyle] — "@" builds an @handle from
  // the brand slug, "name" reuses the brand name as the handle.
  const networks = [
    ["facebook", "Facebook", "Page", "name"],
    ["instagram", "Instagram", "Profile", "@"],
    ["linkedin", "LinkedIn", "Page", "name"],
    ["x", "X (Twitter)", "Profile", "@"],
    ["tiktok", "TikTok", "Profile", "@"],
    ["youtube", "YouTube", "Channel", "name"],
  ];
  // [brand name, which networks it's on (indices into `networks`), post counts
  // aligned to those networks] — a couple of profiles sit at 0 posts so the
  // "No posts to analyze" disabled state still appears in the long list.
  const brands = [
    ["Bright Harbor", [0, 1, 2, 3], [210, 540, 96, 1200]],
    ["Cedar & Co.", [0, 2, 5], [88, 140, 0]],
    ["Lumen Labs", [1, 3, 4], [1900, 320, 760]],
    ["Northgate Coffee", [0, 1, 4], [430, 2100, 980]],
    ["Verdant Home", [1, 2, 5], [670, 210, 145]],
    ["Atlas Outdoors", [0, 3, 5], [150, 540, 0]],
    ["Marigold Bakery", [1, 4], [3100, 1450]],
    ["Pulse Fitness", [0, 1, 2, 4], [260, 1800, 90, 620]],
    ["Harbor & Vine", [2, 3], [310, 45]],
    ["Solstice Travel", [1, 5], [2400, 380]],
    ["Copper Kettle", [0, 1], [120, 890]],
    ["Nimbus Software", [2, 3, 5], [540, 720, 0]],
    ["Willow Studio", [1, 4], [960, 540]],
  ];
  // ~36 demo profiles across 13 brands — with the 4 base Northwind accounts
  // that's ~40 connected profiles, a realistic "many profiles" list.
  const slug = (name) =>
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "");
  const initialsOf = (name) =>
    name
      .replace(/&/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  const out = [];
  let i = 0;
  for (const [name, netIdx, counts] of brands) {
    const initials = initialsOf(name);
    netIdx.forEach((idx, j) => {
      const [platform, platformLabel, kind, handleStyle] = networks[idx];
      const handle = handleStyle === "@" ? `@${slug(name)}` : name;
      out.push({
        id: `demo-${i++}`,
        platform,
        platformLabel,
        kind,
        name,
        handle,
        initials,
        photo: null,
        status: "connected",
        token: "ok",
        postCount: counts[j],
      });
    });
  }
  return out;
})();
