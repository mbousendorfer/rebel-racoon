// Published posts that performed — the "winners" board behind Repurpose.
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.

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
