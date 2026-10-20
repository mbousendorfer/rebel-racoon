// The demo brand (flag demoMode) — Bramble & Bean, a neighbourhood coffee
// roaster made up so a first-time user can try Archie before connecting
// anything. One Playbook with a deliberately generic voice, and three pretend
// accounts that ride in already connected (demo-mode.js).
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.

const PHOTO = "assets/avatars/bramble-bean.svg";

export const DEMO_ACCOUNTS = [
  {
    id: "demo-bb-ig",
    platform: "instagram",
    platformLabel: "Instagram",
    kind: "Profile",
    name: "Bramble & Bean",
    handle: "@brambleandbean",
    photo: PHOTO,
    logo: "assets/logos/social/instagram.svg",
    status: "connected",
    token: "ok",
    postCount: 0,
  },
  {
    id: "demo-bb-li",
    platform: "linkedin",
    platformLabel: "LinkedIn",
    kind: "Page",
    name: "Bramble & Bean",
    handle: "Bramble & Bean",
    photo: PHOTO,
    logo: "assets/logos/social/linkedin.svg",
    status: "connected",
    token: "ok",
    postCount: 0,
  },
  {
    id: "demo-bb-fb",
    platform: "facebook",
    platformLabel: "Facebook",
    kind: "Page",
    name: "Bramble & Bean Coffee",
    handle: "Bramble & Bean Coffee",
    photo: PHOTO,
    logo: "assets/logos/social/facebook.svg",
    status: "connected",
    token: "ok",
    postCount: 0,
  },
];

export const DEMO_PLAYBOOK = {
  id: "ctx-demo-bramble",
  name: "Bramble & Bean",
  color: "orange",
  isDefault: true,
  brandName: "Bramble & Bean",
  websiteUrl: "",
  audience: ["Neighbours and regulars", "Home brewers", "People working from the café"],
  businessSummary:
    "A small coffee roaster and café. Roasts in small batches on site, sells beans in the shop and online, and runs a weekend brunch.",
  briefSummary:
    "A small coffee roaster and café. Roasts in small batches on site, sells beans in the shop and online, and runs a weekend brunch.",
  tones: ["Warm", "Plain-spoken"],
  contentStyle: ["Friendly and conversational"],
  objective: ["Brand awareness", "Community engagement"],
  contentAction: ["Visit the shop"],
  voiceSummary:
    "Warm, plain-spoken and a little playful, like the barista who knows your order. Short posts that talk to one person, name the coffee, and end with a reason to drop by.",
  voiceAlways: [
    { text: "Name the coffee and where it comes from.", examples: ["Our Huila, Colombia —"] },
    { text: "Talk to one person, not a crowd: 'you', never 'customers'." },
  ],
  voiceNever: [
    { text: "Never use corporate words like 'leverage' or 'solutions'." },
    { text: "Never more than two emoji in a post." },
  ],
  voiceByPost: [
    {
      when: "New blend or product",
      text: "Lead with how it tastes, then where it's from, then when it's in the shop.",
      examples: ["Think dark chocolate and a bit of cherry."],
    },
  ],
  voiceSometimes: [{ text: "Close with a small coffee pun.", examples: ["Have a latte fun this weekend."] }],
  connectedSocials: DEMO_ACCOUNTS.map((a) => a.id),
};

// ── What the new chat's ways in find, in the demo ─────────────────────────
// The demo lands on the real new chat (hero, starters, Topics, composer), so
// every way in has to find Bramble & Bean material instead of an empty store or
// the returning user's SaaS mocks. Each store swaps to these under isDemo().

// The files the demo hands over in place of an upload: Add PDF / Add video in
// the composer, and the sample buttons of the Batch and Clip studios.
export const DEMO_SAMPLES = {
  pdf: "Autumn menu.pdf",
  video: "Roastery tour.mp4",
  url: "brambleandbean.example/journal/autumn-blend",
};

// One idea per source (library.js appendExtractedIdeas), {filename} filled in.
export const DEMO_IDEA_TEMPLATES = [
  {
    title: "The autumn blend, told from the cupping table",
    body: "What the roaster tasted first in {filename}, and why that cup made the menu.",
    rationale: "Taste notes from the person who chose the coffee read as a recommendation, not an ad.",
    relevance: "High relevance",
    relevanceColor: "orange",
    confidence: 86,
    channels: ["instagram", "facebook"],
  },
  {
    title: "Three things regulars ask about, answered from {filename}",
    body: "A short FAQ post built from the questions the counter hears every morning.",
    rationale: "Answering real questions earns saves and replies from people who already visit.",
    relevance: "Medium relevance",
    relevanceColor: "tagOrange",
    confidence: 74,
    channels: ["facebook", "linkedin"],
  },
  {
    title: "Why we roast in small batches",
    body: "The trade-off behind the roastery's slowest habit, as {filename} explains it.",
    rationale: "A clear stance on craft gives the brand something to be known for.",
    relevance: "High relevance",
    relevanceColor: "orange",
    confidence: 81,
    channels: ["linkedin", "instagram"],
  },
  {
    title: "Weekend brunch, in one photo and two lines",
    body: "A visual post: the dish, the coffee it goes with, and when to come.",
    rationale: "Food posts with a time and a place convert into visits on the weekend.",
    relevance: "Medium relevance",
    relevanceColor: "tagOrange",
    confidence: 70,
    channels: ["instagram"],
  },
];

// The canned ideas a video yields (library.js extractVideoIdeas).
export const DEMO_VIDEO_IDEAS = [
  {
    title: "Six in the morning at the roastery",
    kind: "story",
    body: "A behind-the-scenes post on the first roast of the day, before the café opens.",
    rationale: "Behind-the-scenes posts make a small shop feel like a place people know.",
    relevance: "High relevance",
    relevanceColor: "orange",
    confidence: 84,
    channels: ["instagram", "facebook"],
  },
  {
    title: "The sound that tells us the beans are ready",
    kind: "insight",
    body: "The 'first crack', explained in one minute by the roaster.",
    rationale: "One surprising detail of the craft travels further than a full process tour.",
    relevance: "Medium relevance",
    relevanceColor: "tagOrange",
    confidence: 72,
    channels: ["instagram", "linkedin"],
  },
];

// The moments the Clip Studio finds in the sample video (sources-stream.js).
export const DEMO_CLIPS = [
  {
    start: 18,
    end: 46,
    hue: 22,
    title: "First roast of the day",
    summary: "The drum heating up while the street is still dark.",
    why: "Quiet, atmospheric opener. Works as a vertical reel with no voice-over.",
    network: "instagram",
    tags: ["behind the scenes", "roastery"],
  },
  {
    start: 120,
    end: 168,
    hue: 30,
    title: "The first crack, explained",
    summary: "The roaster leans in and explains the sound that means 'nearly ready'.",
    why: "One clear fact about the craft, said by the person who does it.",
    network: "instagram",
    tags: ["craft", "explainer"],
  },
  {
    start: 300,
    end: 352,
    hue: 200,
    title: "Why we roast small batches",
    summary: "Thirty kilos at a time, and what it costs us to keep it that way.",
    why: "A stance with a number in it. Strong for LinkedIn.",
    network: "linkedin",
    tags: ["stance", "craft"],
  },
  {
    start: 410,
    end: 452,
    hue: 12,
    title: "Tasting the autumn blend",
    summary: "First sip on camera: chocolate, a little cherry.",
    why: "Taste notes on screen sell the product without a sales line.",
    network: "facebook",
    tags: ["product", "tasting"],
  },
];

// The pretend accounts' best posts, for Repurpose a top post. Same shape as
// mocks/top-posts.js builds; metrics decay with rank so every sort reorders.
const PHOTOS = [
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=640&h=360&q=70",
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=640&h=360&q=70",
];

const TOP_CONTENT = {
  instagram: [
    [
      "image",
      "Seasonal blend",
      "Autumn blend is in. Dark chocolate, a bit of cherry, and it smells like October. ☕",
      "taste notes up front and a clear 'it's here'",
    ],
    [
      "image",
      "Behind the scenes",
      "6am. The drum's warm, the street's dark, and the first batch is nearly there.",
      "a quiet behind-the-scenes moment people rarely see",
    ],
    [
      "image",
      "Brunch",
      "Saturday brunch: cardamom buns, a flat white, and a table by the window. 9–1.",
      "a time, a place and one photo of the plate",
    ],
    [
      "text",
      "Community",
      "Bring your own cup this week and your coffee's on us. Yes, really.",
      "a simple offer that asks for one small action",
    ],
  ],
  linkedin: [
    [
      "text",
      "Craft",
      "We roast thirty kilos at a time. Bigger batches would be cheaper. Here's why we haven't changed.",
      "a stance with a number and a cost attached",
    ],
    [
      "image",
      "Team",
      "Meet Inès, who has tasted every coffee we've sold for six years.",
      "a named person behind the product",
    ],
    [
      "text",
      "Sourcing",
      "Our Huila beans come from one farm, two hours from the nearest town. We visited in March.",
      "a specific origin story instead of a claim",
    ],
  ],
  facebook: [
    [
      "image",
      "Brunch",
      "Brunch is back this Saturday. Cardamom buns are already in the oven. 🥐",
      "a reminder with a date and a craving",
    ],
    [
      "text",
      "Community",
      "Thank you for 5 years on this corner. Free filter coffee all day Sunday.",
      "a thank-you with a reason to come",
    ],
    [
      "image",
      "Seasonal blend",
      "The autumn blend: our favourite cup this year. In the shop and online from today.",
      "the product, the feeling, and where to get it",
    ],
  ],
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY = new Date(2026, 9, 20);

function buildDemoTopPosts() {
  const out = [];
  let photo = 0;
  for (const [network, items] of Object.entries(TOP_CONTENT)) {
    items.forEach(([mediaType, topic, excerpt, why], i) => {
      const vsAvg = +(3.4 - i * 0.6).toFixed(1);
      const eng = +(6.8 - i * 1.1).toFixed(1);
      const imp = 9200 - i * 1900;
      const days = 3 + i * 6;
      const reactions = Math.round(((imp * eng) / 100) * 0.78);
      const comments = Math.round(reactions * 0.09);
      const d = new Date(TODAY);
      d.setDate(d.getDate() - days);
      const post = {
        id: `top-demo-${network}-${i + 1}`,
        network,
        publishedAt: `${days}d ago`,
        publishedOn: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
        daysAgo: days,
        topic,
        excerpt,
        perfBadge: `Top ${5 + i * 5}%`,
        vsAvg,
        engagementRate: eng,
        impressions: imp,
        views: Math.round(imp * 1.7),
        reactions,
        comments,
        metricLine: `${vsAvg}× your average engagement · ${reactions.toLocaleString()} reactions · ${comments} comments`,
        whyItWorked: why,
        hashtags: [],
        mediaType,
      };
      if (network === "instagram") post.saves = Math.round(reactions * 0.14);
      else post.shares = Math.round(reactions * 0.14);
      if (mediaType === "image") {
        post.image = PHOTOS[photo % PHOTOS.length];
        post.imageCount = 1;
        photo += 1;
      }
      out.push(post);
    });
  }
  return out;
}

export const DEMO_TOP_POSTS = buildDemoTopPosts();

// Listening for the demo brand: one feed, three fresh Topics, so the hero's
// "Topics to review" row exists and Use in chat works.
export const DEMO_TOPIC_FEED = {
  id: "feed-demo-bramble",
  name: "Bramble & Bean neighbours · weekly",
  playbookId: "ctx-demo-bramble",
  sources: ["competitor-posts"],
  websites: [],
  cadence: "weekly",
};

const author = (name, handle, initials, accent) => ({ name, handle, initials, accent });

export const DEMO_TOPICS = [
  {
    id: "topic-demo-1",
    feedId: "feed-demo-bramble",
    sourceId: "competitor-posts",
    ageLabel: "3h ago",
    kind: "ready",
    headline: "Northside Coffee's 'bring your own cup' week beat every product post they made",
    summary:
      "A simple sustainability offer drew five times their usual comments. People shared it to tag friends, not to praise the coffee.",
    relevance:
      "Regulars respond to small, concrete offers they can act on this week. Bramble & Bean already runs a refill discount nobody has posted about.",
    whyNow: "Their best post in a month, and the comments are still coming in.",
    isTrending: true,
    article: {
      title: "Northside Coffee's 'bring your own cup' week beat every product post they made",
      subheads: ["What got shared", "The version Bramble & Bean can write"],
      paragraphs: [
        "Northside posted a one-line offer: bring your own cup this week and the coffee is free. It outperformed their seasonal launch and two latte-art reels.",
        "The comments are people tagging friends. The post works because it asks for one easy action and gives a reason to come in this week.",
        "Bramble & Bean already gives 20p off for a refill. Said plainly, with a week attached, it's the same post.",
      ],
    },
    posts: [
      {
        id: "topic-demo-1-p1",
        network: "instagram",
        publishedOn: "2 days ago",
        author: author("Northside Coffee", "@northsidecoffee", "NC", "green"),
        text: "Bring your own cup this week and your coffee's on us. That's it, that's the post.",
        likes: 1240,
        comments: 186,
        reposts: 64,
      },
    ],
    seedStatus: "new",
    history: [{ status: "new", when: "3h ago", note: "Surfaced from the weekly neighbours scan (3 matching posts)." }],
  },
  {
    id: "topic-demo-2",
    feedId: "feed-demo-bramble",
    sourceId: "competitor-posts",
    ageLabel: "1d ago",
    kind: "ready",
    headline: "Roasters are posting the 'first crack' and audiences love the sound",
    summary:
      "Short clips of beans cracking in the drum are the most saved roastery content this month. The sound does the work.",
    relevance:
      "Bramble & Bean roasts on site every morning. A ten-second clip costs nothing and shows what a supermarket bag can't.",
    whyNow: "Three roasters posted one this week and all three were their most-saved post.",
    isUpdated: true,
    article: {
      title: "Roasters are posting the 'first crack' and audiences love the sound",
      subheads: ["What's working", "The version Bramble & Bean can write"],
      paragraphs: [
        "The clips are short: the drum, the beans, a crackle like popcorn. No voice-over, no music.",
        "Saves are high because people come back to listen. The craft explains itself.",
        "Bramble & Bean roasts every morning at six. One phone on a tripod is enough.",
      ],
    },
    posts: [
      {
        id: "topic-demo-2-p1",
        network: "instagram",
        publishedOn: "1 day ago",
        author: author("Ember Roasters", "@emberroasters", "ER", "orange"),
        text: "Turn your sound on. That's the first crack. 🔊",
        likes: 2310,
        comments: 98,
        reposts: 120,
      },
    ],
    seedStatus: "new",
    history: [{ status: "new", when: "1d ago", note: "Surfaced from the weekly neighbours scan (3 matching posts)." }],
  },
  {
    id: "topic-demo-3",
    feedId: "feed-demo-bramble",
    sourceId: "competitor-posts",
    ageLabel: "2d ago",
    kind: "ready",
    headline: "The bakery next door is getting more weekend visits from one Friday post",
    summary:
      "A Friday evening post with the weekend menu and opening hours is now their most reliable driver of Saturday traffic.",
    relevance: "Bramble & Bean's brunch is on the same street, on the same days, and never posted on a Friday.",
    whyNow: "Four Fridays in a row, each one their best post of the week.",
    article: {
      title: "The bakery next door is getting more weekend visits from one Friday post",
      subheads: ["What's working", "The version Bramble & Bean can write"],
      paragraphs: [
        "Every Friday at six, the bakery posts the weekend menu, one photo and the hours. Nothing else.",
        "It works because it arrives when people plan their weekend.",
        "Bramble & Bean's brunch would fit the same slot: the dish, the coffee, the hours.",
      ],
    },
    posts: [
      {
        id: "topic-demo-3-p1",
        network: "facebook",
        publishedOn: "2 days ago",
        author: author("Crumb & Co", "@crumbandco", "CC", "purple"),
        text: "This weekend: sourdough, cinnamon knots, and the last of the plum tarts. Open 8–2 Saturday and Sunday.",
        likes: 640,
        comments: 52,
        reposts: 31,
      },
    ],
    seedStatus: "new",
    history: [{ status: "new", when: "2d ago", note: "Surfaced from the weekly neighbours scan (2 matching posts)." }],
  },
];
