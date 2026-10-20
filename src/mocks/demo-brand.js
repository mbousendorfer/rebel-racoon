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

// Filled in full, every section a returning user's Playbook has (Acme is the
// model): the demo is where someone learns what a Playbook IS, so an empty
// part would teach them it's optional. The name says it's a demo wherever a
// Playbook is listed; the copy that talks ABOUT the brand uses `brandName`.
const COFFEE = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=480&h=480&q=70`;

export const DEMO_PLAYBOOK = {
  id: "ctx-demo-bramble",
  name: "Demo: Bramble & Bean",
  color: "orange",
  isDefault: true,
  brandName: "Bramble & Bean",
  brandLogos: [
    { id: "bb-logo", label: "Logo", url: "assets/logos/brands/bramble-bean.svg" },
    { id: "bb-logo-icon", label: "Icon", url: "assets/logos/brands/bramble-bean-icon.svg" },
  ],
  brandLogo: "assets/logos/brands/bramble-bean.svg",
  websiteUrl: "https://brambleandbean.example",
  audience: ["Neighbours and regulars", "Home brewers", "People working from the café"],
  audienceProblems: [
    "Supermarket coffee tastes flat, and they don't know what to buy instead",
    "They want a place to work for an hour that isn't a chain",
  ],
  businessSummary:
    "A neighbourhood coffee roaster and café. Roasts in small batches on site every morning, sells beans in the shop and online, and runs a weekend brunch. Known for its seasonal blends and for knowing regulars by name.",
  briefSummary:
    "A neighbourhood coffee roaster and café. Roasts in small batches on site every morning, sells beans in the shop and online, and runs a weekend brunch. Known for its seasonal blends and for knowing regulars by name.",
  tones: ["Warm", "Plain-spoken", "A little playful"],
  voiceProfile: {
    headline: "Warm · plain-spoken · a little playful",
    writingStyle:
      "Short, friendly sentences that sound like the person behind the counter. Every post names something real — a coffee, a dish, a time — and ends with a reason to drop by.",
    vocabulary:
      "Everyday words and coffee words people already know: 'roast', 'blend', 'flat white', 'cup'. No trade jargon without a one-line explanation, no corporate words.",
    sentenceStructure: "Mostly short sentences, sometimes a fragment for rhythm. One idea per post.",
    formality: "Informal. 'We' and 'you', contractions always. Reads like a note on the café's chalkboard.",
    personality: "Warm and welcoming, proud of the craft without being precious about it. Gently funny.",
    rhetoricalDevices: "Taste notes as the hook, a sensory detail, then the practical bit: when, where, how much.",
    emotionalTone: "Cosy and upbeat. Never pushy, never 'limited time only'.",
    contentPatterns: "Hook (a taste or a moment) → the detail that makes it real → when to come or how to get it.",
    uniqueTraits:
      "Always names the coffee and its origin. A pun now and then, never two in a post. Up to two emoji, at the end of a line.",
  },
  contentStyle: ["Friendly and conversational", "Behind the scenes"],
  objective: ["Brand awareness", "Community engagement", "Foot traffic"],
  contentAction: ["Visit the shop", "Order beans online"],
  voiceSummary:
    "Warm, plain-spoken and a little playful, like the barista who knows your order. Short posts that talk to one person, name the coffee, and end with a reason to drop by.",
  voiceAlways: [
    { text: "Name the coffee and where it comes from.", examples: ["Our Huila, Colombia —"] },
    { text: "Talk to one person, not a crowd: 'you', never 'customers'." },
    {
      text: "Give the practical detail: when, where, or how much.",
      examples: ["Saturday 9–1.", "In the shop from today."],
    },
  ],
  voiceNever: [
    { text: "Never use corporate words like 'leverage' or 'solutions'." },
    { text: "Never more than two emoji in a post." },
    { text: "Never 'limited time only' or countdown pressure." },
  ],
  voiceByPost: [
    {
      when: "New blend or product",
      text: "Lead with how it tastes, then where it's from, then when it's in the shop.",
      examples: ["Think dark chocolate and a bit of cherry."],
    },
    {
      when: "Behind the scenes",
      text: "One moment, told plainly: the time, what's happening, who's doing it.",
      examples: ["6am. The drum's warm and Inès is on the first batch."],
    },
    {
      when: "Event or brunch",
      text: "The dish, the coffee it goes with, the day and the hours. Nothing else.",
      examples: ["Cardamom buns and a flat white, Saturday 9–1."],
    },
  ],
  voiceSometimes: [
    { text: "Close with a small coffee pun.", examples: ["Have a latte fun this weekend."] },
    { text: "Ask regulars for their order.", examples: ["What's your usual? Tell us below."] },
  ],
  voiceAvoid: ["solutions", "leverage", "artisanal journey", "limited time only"],
  voiceBaseNetwork: "instagram",
  voiceByNetwork: {
    linkedin: {
      voiceAlways: [
        { text: "Talk about the business behind the café: sourcing, the team, small-batch choices." },
        { text: "One number when there is one.", examples: ["Thirty kilos at a time."] },
      ],
      voiceNever: [{ text: "Never more than one emoji." }],
    },
    facebook: {
      voiceAlways: [{ text: "Lead with the date and the hours for anything happening in the shop." }],
      voiceSometimes: [{ text: "Thank the neighbourhood by name of the street." }],
    },
  },
  brandPersonality:
    "The café on the corner that knows your name. Proud of its coffee, generous with its time, never stuffy.",
  brandTypography: { headingFont: "Averta", bodyFont: "Averta" },
  brandColors: [
    { name: "Primary", hex: "#6B3A22" },
    { name: "Secondary", hex: "#C8874E" },
    { name: "Accent", hex: "#7A8F4E" },
    { name: "Background", hex: "#F7EFE5" },
    { name: "Text", hex: "#3B2416" },
  ],
  brandRules: { logoMinPx: 32, clearSpace: 0.5, noLogoDistortion: true },
  imageDefaults: { imageType: "photo", style: "warm-natural", refMode: "mood" },
  defaultLook: { kind: "style", id: "st_demo_bramble_warm" },
  formatByNetwork: { instagram: "portrait", facebook: "landscape", linkedin: "landscape" },
  imageStyles: [
    {
      id: "st_demo_bramble_warm",
      label: "Warm counter light",
      description: "Natural morning light on wood and ceramic, one cup or one dish.",
      supportsEmbeddedText: false,
      custom: {
        sources: [
          {
            type: "image",
            name: "Latte on the counter",
            url: COFFEE("photo-1495474472287-4d71bcdd2085"),
            colors: ["#6B3A22", "#C8874E", "#F7EFE5"],
            weight: 0.7,
          },
          {
            type: "image",
            name: "Beans, close",
            url: COFFEE("photo-1442512595331-e89e73853f31"),
            colors: ["#3B2416", "#6B3A22", "#C8874E"],
            weight: 0.5,
          },
        ],
        fidelity: "composition",
        stylePrompt: "Morning light from the side, warm wood, one subject, a little steam. Never staged.",
        dos: ["One cup or one dish per image", "Natural light only", "Real hands, real counter"],
        donts: ["No stock-photo smiles", "No heavy filters", "No text over the coffee"],
      },
    },
  ],
  referenceImages: [
    {
      id: "bb-ref-1",
      label: "The cup",
      url: COFFEE("photo-1509042239860-f550ce710b93"),
      note: "Product posts: one cup, natural light, the wood counter in frame.",
      networks: ["instagram", "facebook"],
    },
    {
      id: "bb-ref-2",
      label: "The beans",
      url: COFFEE("photo-1447933601403-0c6688de566e"),
      note: "Roastery and sourcing posts. Close, textured, no filters.",
      networks: ["instagram", "linkedin"],
    },
    {
      id: "bb-ref-3",
      label: "The café",
      url: COFFEE("photo-1501339847302-ac426a4a7cbb"),
      note: "Brunch and events: the room with people in it, never empty.",
      networks: ["facebook"],
    },
  ],
  competitors: [
    {
      id: "bb-cmp-1",
      name: "Northside Coffee",
      description: "The café two streets up. Strong on offers and community posts, lighter on the coffee itself.",
      websiteUrl: "https://northsidecoffee.example",
      socials: [{ network: "instagram", url: "https://instagram.com/northsidecoffee" }],
    },
    {
      id: "bb-cmp-2",
      name: "Ember Roasters",
      description: "A bigger roaster across town. Great craft content, sells mostly online.",
      websiteUrl: "https://emberroasters.example",
      socials: [
        { network: "instagram", url: "https://instagram.com/emberroasters" },
        { network: "linkedin", url: "https://linkedin.com/company/emberroasters" },
      ],
    },
    {
      id: "bb-cmp-3",
      name: "Crumb & Co",
      description: "The bakery next door. Not coffee, but it competes for the same weekend morning.",
      websiteUrl: "https://crumbandco.example",
      socials: [{ network: "facebook", url: "https://facebook.com/crumbandco" }],
    },
  ],
  influencers: [
    {
      id: "bb-inf-1",
      name: "The Morning Pour",
      description: "Home-brewing tips for beginners. Friendly, practical, followed by exactly our home brewers.",
      socials: [{ network: "instagram", url: "https://instagram.com/themorningpour" }],
    },
    {
      id: "bb-inf-2",
      name: "Eat the Neighbourhood",
      description: "Local food guide. One mention fills the weekend brunch.",
      socials: [{ network: "instagram", url: "https://instagram.com/eattheneighbourhood" }],
    },
  ],
  ctaLinks: [
    { label: "Order beans online", url: "brambleandbean.example/shop", checked: true, suggested: false },
    { label: "Find the café", url: "brambleandbean.example/visit", checked: true, suggested: false },
  ],
  doRules: ["Name the coffee and its origin", "Give the day and the hours", "Talk to one person"],
  dontRules: ["No corporate words", "No more than two emoji"],
  cta: "Come by for a cup — or order the beans online.",
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
