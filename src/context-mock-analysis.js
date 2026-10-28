// Mocked "website analysis" — the proto has no real scraping. analyzeWebsite
// returns a deterministic draft based on the URL: agorapulse.com hits a
// hand-tuned mock matching the V1 brief HTML reference, anything else
// returns a generic SaaS template that still produces a usable brief.
//
// The shape returned is consumed by context-builder.js after the ~10s
// pending turn finishes, then passed to the right-panel brief renderer.
// Suggested values become menthol chips (AI-suggested). Other static
// option lists come from the brief panel renderer.

import { objectivesInText } from "./objective-measures.js?v=2323";

const AGORAPULSE = {
  name: "Agorapulse",
  businessSummary:
    "Agorapulse is a B2B SaaS platform designed for social media managers, agencies, and marketing teams. It centralises social media management across multiple platforms, enabling teams to publish, monitor, and report from a single inbox. Agorapulse operates on a subscription model with plans tailored to both independent professionals and large agencies. Its core promise is to save time, reduce tool fragmentation, and make social media ROI measurable.",
  suggestions: {
    audience: [
      "Agency Social Media Manager",
      "In-house Brand Strategist",
      "Freelance Social Media Consultant",
      "Marketing Director",
      "Content Creator",
    ],
    audienceProblems: [
      // Agency Social Media Manager
      "Managing content calendars for 10+ clients",
      "Justifying agency fees with measurable results",
      "Briefing writers who don't know the client's brand",
      "Handling last-minute content requests at scale",
      "Maintaining consistent quality across all accounts",
      // In-house Brand Strategist
      "Aligning social content with brand guidelines",
      "Getting leadership buy-in on content strategy",
      "Keeping up with platform algorithm changes",
      "Coordinating with multiple internal stakeholders",
      "Proving the brand impact of organic social",
      // Freelance Social Media Consultant
      "Onboarding new clients quickly without deep context",
      "Producing high-quality content with limited resources",
      "Differentiating from cheaper generalist competitors",
      "Managing unpredictable client feedback cycles",
      "Scaling output without hiring extra help",
      // Marketing Director
      "Linking social media performance to business outcomes",
      "Managing a lean team with high content demands",
      "Keeping content strategy consistent across channels",
      "Reporting ROI to the C-suite in clear terms",
      "Finding time to stay close to execution",
      // Content Creator
      "Running out of original content ideas consistently",
      "Repurposing long-form content efficiently",
      "Maintaining a posting cadence without burnout",
      "Growing reach beyond the existing follower base",
      "Adapting one piece of content to multiple formats",
    ],
    tones: ["Professional & authoritative"],
    voiceProfile: {
      headline: "Professional · data-driven · approachable",
      writingStyle:
        "Professional, data-grounded, and action-oriented. Combines analytical evidence with clear, immediate takeaways aimed at busy social media managers and marketing leaders. Sentences open with the value to the reader and back claims with measurable outcomes.",
      vocabulary:
        "Industry-specific marketing jargon balanced with plain-English: 'ROI', 'engagement', 'social inbox', 'reporting', 'workflow', alongside conversational terms like 'busy team', 'one place', 'in seconds'. Avoids hype words ('revolutionary', 'game-changer') in favour of measurable claims.",
      sentenceStructure:
        "Mostly short to medium sentences. Headlines are punchy and benefit-led. Body copy occasionally extends for product feature explanations or case studies. Bullet lists are favored over long paragraphs when explaining capabilities.",
      formality:
        "Semi-formal. Direct address ('you', 'your team') keeps the brand approachable while remaining credible to enterprise buyers. Contractions are used freely, but the tone never drifts into slang or memes.",
      personality:
        "Confident, helpful, results-focused. Speaks with the authority of a tool that has supported thousands of social teams. Empathetic to the chaos of multi-platform work without being self-deprecating about the category.",
      rhetoricalDevices:
        "Lists for product benefits. Customer quotes for proof. Concrete numbers and percentages for credibility (time saved, response-rate gains, ROI). Frequent 'before / after' contrasts between fragmented workflows and the unified Agorapulse experience.",
      emotionalTone:
        "Reassuring and supportive. Acknowledges the daily firefight of multi-platform social media management and positions Agorapulse as the calm centre that gives teams back their time, their data, and their evenings.",
      contentPatterns:
        "Problem → solution → proof. Most pages open with a social-media-manager pain point ('lost in 8 tabs', 'can't prove ROI'), present Agorapulse's specific answer, and close with social proof or a CTA to start a free trial.",
      uniqueTraits:
        "Frequent 'social media inbox' framing. Emphasises ROI measurement and time-to-publish as the two big differentiators. Customer success stories from agencies and in-house teams are woven throughout the marketing site rather than ghettoised on a /customers page.",
    },
    contentStyle: ["Data-driven with storytelling", "Direct and actionable"],
    objective: ["Lead generation", "Brand awareness"],
    contentAction: ["Sign up for a free trial", "Book a demo"],
    voiceSummary:
      "Professional, data-grounded and action-oriented. Posts open with the value to the reader, back claims with measurable outcomes and close on one clear call to action.",
    voiceAlways: [
      {
        text: "Open with a benefit-led headline, then short scannable paragraphs.",
        examples: ["Stop juggling 8 tabs to run your social."],
      },
      {
        text: "Back claims with numbers and percentages.",
      },
      {
        text: "Speak to the reader directly — 'you', 'your team'.",
      },
    ],
    voiceNever: [
      {
        text: "Never more than one call to action per post.",
      },
      {
        text: "No hype words like 'revolutionary' or 'game-changer'.",
      },
    ],
    voiceByPost: [
      {
        when: "Feature post",
        text: "Lead with the problem it removes, list the capabilities as bullets, close on the free trial.",
        examples: ["Your team is losing hours to this:"],
      },
      {
        when: "Data or report post",
        text: "Open on the number, say what it means for the reader, then link the report.",
        examples: ["Here's what the data actually says:"],
      },
    ],
    voiceSometimes: [
      {
        text: "Close on the free trial.",
        examples: ["Start your free trial — no card required."],
      },
      {
        text: "Close on a demo offer.",
        examples: ["Book a demo and we'll map it to your workflow."],
      },
      {
        text: "Minimal emoji.",
      },
    ],
    brandPersonality:
      "Confident, helpful, results-focused. Speaks with the authority of a tool that has supported thousands of social teams, and stays empathetic to the chaos of multi-platform work.",
    brandTypography: { headingFont: "Averta", bodyFont: "Averta" },
    brandColors: [
      { name: "Primary", hex: "#212E44" },
      { name: "Accent", hex: "#FF6726" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#212E44" },
    ],
    ctaLinks: [
      { label: "Free trial signup", url: "agorapulse.com/free-trial", checked: true, suggested: true },
      { label: "Book a demo", url: "agorapulse.com/demo", checked: true, suggested: true },
      { label: "Pricing page", url: "agorapulse.com/pricing", checked: false, suggested: true },
      { label: "Customer stories", url: "agorapulse.com/customers", checked: false, suggested: true },
      { label: "Blog & resources", url: "agorapulse.com/blog", checked: false, suggested: true },
    ],
    language: "English",
    languages: ["English"],
    primaryLanguage: "English",
    color: "orange",
    competitors: [
      {
        name: "Hootsuite",
        description:
          "The incumbent. Broadest network coverage and enterprise footprint, but a heavier, pricier suite that smaller teams outgrow the budget for.",
        websiteUrl: "https://hootsuite.com",
        socials: [
          { network: "linkedin", url: "https://linkedin.com/company/hootsuite" },
          { network: "x", url: "https://x.com/hootsuite" },
          { network: "instagram", url: "https://instagram.com/hootsuite" },
        ],
      },
      {
        name: "Buffer",
        description:
          "Simple, affordable scheduling with a strong creator following. Light on inbox, listening and agency reporting.",
        websiteUrl: "https://buffer.com",
        socials: [
          { network: "linkedin", url: "https://linkedin.com/company/bufferapp" },
          { network: "x", url: "https://x.com/buffer" },
        ],
      },
      {
        name: "Sprout Social",
        description:
          "Premium analytics and social listening aimed at larger in-house teams. Frequently the head-to-head in agency deals.",
        websiteUrl: "https://sproutsocial.com",
        socials: [
          { network: "linkedin", url: "https://linkedin.com/company/sprout-social-inc-" },
          { network: "x", url: "https://x.com/sproutsocial" },
        ],
      },
      {
        name: "Later",
        description:
          "Visual-first planning built around Instagram and TikTok. Popular with ecommerce and creator-led brands.",
        websiteUrl: "https://later.com",
        socials: [
          { network: "instagram", url: "https://instagram.com/latermedia" },
          { network: "tiktok", url: "https://tiktok.com/@later" },
        ],
      },
      {
        name: "Sendible",
        description:
          "Agency-focused scheduling and white-label reporting at a mid-market price. Closest positioning on agency workflows.",
        websiteUrl: "https://sendible.com",
        socials: [
          { network: "linkedin", url: "https://linkedin.com/company/sendible" },
          { network: "x", url: "https://x.com/sendible" },
        ],
      },
    ],
    imageVoice: {
      websites: [
        {
          domain: "agorapulse.com",
          url: "https://agorapulse.com",
          colors: {
            primary: "#212E44",
            accent: "#FF6726",
            background: "#FFFFFF",
            textPrimary: "#FF6726",
            link: "#FF6726",
          },
          typography: {
            primaryFont: "Averta",
            headingFont: "Averta",
            h1Size: "56px",
            h2Size: "20px",
            bodySize: "16px",
            fontStack: ["Averta", "Arial", "Helvetica"],
          },
          images: {
            logo: { label: "Logo", url: "assets/logos/archie-wordmark.svg" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
            // EVERY mark the crawl turned up, not just one. A site carries
            // several — the header lockup, a monochrome version, an alternate —
            // and they're all legitimately "the logo", so the Brand section
            // offers the set and the user promotes one to default.
            logos: [
              { label: "Logo", url: "assets/logos/archie-wordmark.svg" },
              { label: "Monochrome", url: "assets/logos/archie-mono.svg" },
              { label: "Alternate", url: "assets/logos/archie-alt-wordmark.svg" },
            ],
          },
          buttons: {
            primary: { bg: "#FF6726", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#FF6726", border: "#FF6726", label: "Secondary" },
          },
          personality: {
            tone: "professional",
            energy: "medium",
            audience: "business professionals",
          },
        },
      ],
    },
  },
};

const GENERIC = {
  name: "Untitled brand",
  businessSummary:
    // Honest when the read is thin: a paragraph that fits any brand broke the
    // trust of the first Playbook a tester built from their own site. It says
    // what is missing and asks for the one sentence that fixes it (2026-10-28).
    "I couldn't read enough on this site to say what the business does. Click Edit and add one sentence: what you sell, and to whom. I'll ground every post on it.",
  suggestions: {
    audience: [
      "Operations and marketing leads at growing B2B teams",
      "Founders and decision-makers evaluating the product",
      "Hands-on end users who run the day-to-day",
      "Agencies and consultants serving similar clients",
    ],
    audienceProblems: [
      "Saving time on repetitive tasks",
      "Making better decisions with less data",
      "Reducing operational costs",
      "Scaling without adding headcount",
    ],
    tones: ["Professional & authoritative"],
    voiceProfile: {
      headline: "Professional · clear · helpful",
      writingStyle:
        "Clear, professional, and direct. Sentences are concise and reader-friendly. Each section opens with the benefit and follows with supporting evidence.",
      vocabulary:
        "Plain English with occasional industry terms where relevant. Avoids jargon that hasn't been earned and explains acronyms on first use.",
      sentenceStructure:
        "Mostly short to medium sentences with occasional structural variation for emphasis. Lists are used when explaining multi-step processes.",
      formality: "Semi-formal — friendly enough for a marketing site, credible enough for an enterprise buyer.",
      personality:
        "Trustworthy, helpful, and knowledgeable. Speaks to the reader as an equal who happens to have done the homework.",
      rhetoricalDevices:
        "Lists for clarity. Evidence and customer proof for credibility. Occasional rhetorical questions to set up the value proposition.",
      emotionalTone: "Neutral, supportive, and quietly confident. Reassures without overpromising.",
      contentPatterns:
        "Problem → solution → proof structure across most pages. Calls to action are clear and singular.",
      uniqueTraits:
        "Edit this profile to capture what makes your brand's voice distinctive — the words you reach for, the metaphors you avoid, the moments where the writing relaxes.",
    },
    contentStyle: ["Direct and actionable"],
    objective: ["Brand awareness"],
    contentAction: ["Visit the website"],
    voiceSummary:
      "Clear, professional and direct. Each post opens with the benefit and follows with the evidence. Edit this to say how your brand actually sounds.",
    voiceAlways: [
      {
        text: "Open with the benefit to the reader.",
        examples: ["Here's the problem most teams hit:"],
      },
      {
        text: "Clear, concise paragraphs; a short list when explaining steps.",
      },
      {
        text: "Sentence case and plain English.",
      },
    ],
    voiceNever: [
      {
        text: "Never more than one call to action per post.",
      },
      {
        text: "No jargon that hasn't been explained.",
      },
    ],
    voiceByPost: [
      {
        when: "Product post",
        text: "The problem, what changes, then one call to action.",
        examples: ["What if you could [outcome]?"],
      },
    ],
    voiceSometimes: [
      {
        text: "Close by pointing to the website.",
        examples: ["Learn more on our site.", "Get started today."],
      },
    ],
    brandPersonality:
      "Trustworthy, helpful, and knowledgeable. Speaks to the reader as an equal who has done the homework. Edit to capture what makes your brand's personality distinctive.",
    brandTypography: { headingFont: "System UI", bodyFont: "System UI" },
    brandColors: [
      { name: "Primary", hex: "#178DFE" },
      { name: "Accent", hex: "#178DFE" },
      { name: "Background", hex: "#FFFFFF" },
      { name: "Text", hex: "#344563" },
    ],
    ctaLinks: [{ label: "Homepage", url: "", checked: true, suggested: true }],
    language: "English",
    languages: ["English"],
    primaryLanguage: "English",
    color: "blue",
    // Placeholder competitor set — like every other GENERIC field, it's a
    // usable template the user edits rather than a real market read.
    competitors: [
      {
        name: "The category incumbent",
        description:
          "The best-known name in the category. Broadest feature set, highest price, and the one prospects benchmark you against.",
        websiteUrl: "",
        socials: [],
      },
      {
        name: "The low-cost challenger",
        description: "Cheaper and simpler. Wins on price with smaller teams and loses on depth once they scale.",
        websiteUrl: "",
        socials: [],
      },
      {
        name: "The niche specialist",
        description:
          "Narrower than you but excellent at one job. Comes up whenever a prospect cares most about that one thing.",
        websiteUrl: "",
        socials: [],
      },
    ],
    imageVoice: {
      websites: [
        {
          domain: "",
          url: "",
          colors: {
            primary: "#178DFE", // electric-blue-100 (the default seeded color)
            accent: "#178DFE",
            background: "#FFFFFF",
            textPrimary: "#344563",
            link: "#178DFE",
          },
          typography: {
            primaryFont: "System UI",
            headingFont: "System UI",
            h1Size: "48px",
            h2Size: "20px",
            bodySize: "16px",
            fontStack: ["System UI", "Arial", "sans-serif"],
          },
          images: {
            logo: { label: "Logo", url: "" },
            favicon: { label: "Favicon", url: "" },
            ogImage: { label: "OgImage", url: "" },
            // Filled by analyzeWebsite() from the real domain. For a site we
            // know nothing else about, the favicon is the one mark that can
            // honestly be fetched — inventing a wordmark for "foo-bar.com"
            // would put a logo in the Playbook that nobody's brand owns.
            logos: [],
          },
          buttons: {
            primary: { bg: "#178DFE", color: "#FFFFFF", label: "Primary" },
            secondary: { bg: "#FFFFFF", color: "#178DFE", border: "#178DFE", label: "Secondary" },
          },
          personality: {
            tone: "professional",
            energy: "medium",
            audience: "business professionals",
          },
        },
      ],
    },
  },
};

/**
 * Pretend to analyse a set of connected social profiles and return the same
 * draft skeleton shape as analyzeWebsite. The content is "learned from the
 * posts" — voice/format/style lean conversational and engagement-led.
 * @param {string[]} profileIds
 * @returns {{ name, businessSummary, suggestions: object }}
 */
export function analyzeSocialProfiles(profileIds = []) {
  const n = Array.isArray(profileIds) ? profileIds.length : 0;
  const result = clone(GENERIC);
  result.businessSummary = `Built from ${n || "your"} connected social ${
    n === 1 ? "profile" : "profiles"
  }. I studied your recent posts — how you open, how you close, the formats you favor, and the tone that earns engagement — and mapped them into the sections below. Edit anything that's off.`;
  Object.assign(result.suggestions, {
    contentStyle: ["Conversational", "Engagement-led"],
    objective: ["Brand awareness", "Build personal brand"],
    contentAction: ["Reply in the comments"],
    voiceSummary:
      "Approachable and quick — the voice that already performs on your feed: a scroll-stopping opener, a few punchy lines, a question at the end.",
    voiceAlways: [
      {
        text: "Open on a short, scroll-stopping line.",
        examples: ["Quick one for you:", "Saw this come up again this week:"],
      },
      {
        text: "A few punchy lines with line breaks.",
      },
      {
        text: "Casual sentence case — it reads like a person, not a brand.",
      },
    ],
    voiceNever: [
      {
        text: "Never more than the odd hashtag.",
      },
      {
        text: "Never a hard sell.",
      },
    ],
    voiceByPost: [
      {
        when: "Tip or quick win",
        text: "One line of setup, the tip, then a question.",
      },
    ],
    voiceSometimes: [
      {
        text: "End on a question to drive replies.",
        examples: ["Drop a comment if this helped.", "What would you add?"],
      },
      {
        text: "An emoji for rhythm, sparingly.",
      },
    ],
    brandPersonality: "Approachable, quick, community-first — the voice that already performs on your feed.",
  });
  return result;
}

/**
 * Pretend to analyse a website and return a draft skeleton.
 * @param {string} url
 * @returns {{ name, businessSummary, suggestions: object }}
 */
export function analyzeWebsite(url) {
  const lower = String(url || "").toLowerCase();
  if (lower.includes("agorapulse")) {
    return clone(AGORAPULSE);
  }
  const derivedName = deriveName(url) || GENERIC.name;
  const generic = clone(GENERIC);
  generic.name = derivedName;
  // Patch domain-dependent fields with the actual URL when available.
  const domain = deriveDomain(url);
  if (domain) {
    if (generic.suggestions.ctaLinks[0]) {
      generic.suggestions.ctaLinks[0].url = domain;
    }
    const site = generic.suggestions.imageVoice?.websites?.[0];
    if (site) {
      site.domain = domain;
      site.url = url.startsWith("http") ? url : `https://${domain}`;
      // The favicon is the one mark a crawl of an unknown site really returns.
      // Same service the Competitors section already resolves logos through.
      const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
      if (site.images) {
        site.images.favicon = { label: "Favicon", url: favicon };
        site.images.logos = [{ label: "Favicon", url: favicon }];
      }
    }
  }
  return generic;
}

function deriveName(url) {
  const domain = deriveDomain(url);
  if (!domain) return "";
  // "Foo Bar" from "foo-bar.com"
  const slug = domain.split(".")[0] || "";
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Mock-analyse a set of brand FILES (logo, past visuals, photos) — the "Start
 * from files" way into a Playbook. Nothing is parsed: the
 * palette is derived from the file names so the same files always give the
 * same brand, and the first image is taken as the logo. Same shape as
 * analyzeWebsite.
 * @param {{name:string, url:string}[]} files  — url is a data URL
 */
export function analyzeBrandFiles(files = []) {
  const list = Array.isArray(files) ? files : [];
  const first = list[0]?.name || "My brand";
  const stem = first
    .replace(/\.[^.]+$/, "")
    .replace(/[-_ ]?(logo|brand|final|v\d+|copy)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const name = stem ? stem.replace(/\b\w/g, (c) => c.toUpperCase()) : "My brand";
  let h = 2166136261;
  for (const ch of list.map((f) => f.name).join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hue = (h >>> 0) % 360;
  const hsl = (hh, sat, l) => {
    const a = (sat / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n) => {
      const k = (n + hh / 30) % 12;
      return Math.round(255 * (l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  };
  const result = clone(GENERIC);
  result.name = name;
  result.businessSummary = `Built from your ${list.length} file${list.length === 1 ? "" : "s"}. I took the colors and the look from them — edit each section to say what the brand does and who it's for.`;
  result.suggestions.brandColors = [
    { name: "Primary", hex: hsl(hue, 62, 44), role: "primary" },
    { name: "Secondary", hex: hsl((hue + 150) % 360, 34, 42), role: "secondary" },
    { name: "Accent", hex: hsl((hue + 40) % 360, 86, 58), role: "accent" },
    { name: "Background", hex: hsl(hue, 30, 96), role: "background" },
    { name: "Text", hex: hsl(hue, 40, 14), role: "text" },
  ];
  const site = result.suggestions.imageVoice?.websites?.[0];
  if (site) {
    site.domain = "";
    site.url = "";
    site.images = { ...(site.images || {}), logos: list[0] ? [{ label: "Logo", url: list[0].url }] : [] };
  }
  return result;
}

// ── The "no website" interview ──────────────────────────────────────
// Ported from prod's business-interview (content-studio-playbook-no-website):
// without a site to read, Archie asks what a site would have told it, one
// question at a time. Four CORE topics carry the brief and may not be skipped;
// two OPTIONAL ones (where posts send people, who else the audience looks at)
// may. A vague answer gets ONE follow-up. Six answers at most — skips don't
// count. Prod asks a model; here the order is scripted and the follow-up is a
// word-count heuristic.
// A turn: { topic, question, answer, skipped?, followUp? }.

export const INTERVIEW_OPENING = "Who are you, and what do you do? It can be a business or just you.";
const MAX_INTERVIEW_ANSWERS = 6;

const INTERVIEW_TOPICS = [
  { id: "who", core: true },
  { id: "offer", core: true },
  { id: "audience", core: true },
  { id: "goals", core: true },
  { id: "cta", core: false },
  { id: "rivals", core: false },
];

// [business, person] — the brand can be a company or someone building a
// personal brand, and the words change with it ("customers" vs "clients").
const INTERVIEW_QUESTIONS = {
  offer: [
    "What do you offer, and why do people pick you over someone else?",
    "What do you offer — services, expertise, content — and why do people come to you?",
  ],
  audience: [
    "Who are your customers? Describe one or two typical people you sell to.",
    "Who do you want to reach — clients, followers, recruiters? Describe one or two typical people.",
  ],
  goals: [
    "What should social media do for you — awareness, leads, sales, bookings?",
    "What should social media do for you — a following, new clients, a new job?",
  ],
  cta: [
    "Where should people go after reading a post? A shop, a booking page, a newsletter… Paste the link if you have one.",
    "Where should people go after reading a post? Your portfolio, a link-in-bio, your email… Paste the link if you have one.",
  ],
  rivals: [
    "Who else does your audience look at? Name a few businesses in your space.",
    "Who else does your audience look at? Name a few people in your space.",
  ],
};

const INTERVIEW_FOLLOW_UPS = {
  who: 'Tell me a bit more: what do you do, day to day? For example "I run a bakery in Lyon".',
  offer: "Can you be more specific? Name one or two things you offer, and what makes them worth it.",
  audience: "Picture one real person who'd love what you do. What's their job or situation, and what do they want?",
  goals: "If social media worked perfectly a year from now, what would have changed for you?",
};

const VAGUE_ANSWER = /\b(stuff|things|everyone|everybody|anyone|idk|i don'?t know|not sure|no idea|whatever)\b/i;
function isVagueAnswer(answer) {
  const words = String(answer || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length < 4 || (words.length < 8 && VAGUE_ANSWER.test(answer));
}

function isPersonalBrand(turns) {
  const first = turns.find((t) => t.topic === "who" && !t.skipped)?.answer || "";
  if (/\b(we|we're|our|us)\b/i.test(first)) return false;
  return /\b(i|i'm|i am|my|me)\b/i.test(first);
}

/**
 * The next interview question, or `{ done: true }` once the answers can carry
 * a brief. `coreLeft` counts the core topics still uncovered, this question's
 * included (0 on an optional one) — the Skip label says when Skip unlocks.
 * @returns {{done:true} | {done:false, topic, question, optional, coreLeft, followUp?}}
 */
export function nextInterviewQuestion(turns = []) {
  const answered = turns.filter((t) => !t.skipped).length;
  if (answered >= MAX_INTERVIEW_ANSWERS) return { done: true };
  // A topic is covered by a usable answer, by its follow-up (whatever it
  // says — one nudge, never two), or by a skip. An optional topic is covered by
  // any answer: it never gets a follow-up.
  const isCore = (id) => INTERVIEW_TOPICS.some((t) => t.id === id && t.core);
  const covered = new Set(
    turns.filter((t) => t.skipped || t.followUp || !isCore(t.topic) || !isVagueAnswer(t.answer)).map((t) => t.topic),
  );
  const coreLeft = INTERVIEW_TOPICS.filter((t) => t.core && !covered.has(t.id)).length;
  const last = turns[turns.length - 1];
  if (last && !last.skipped && !last.followUp && !covered.has(last.topic)) {
    return {
      done: false,
      topic: last.topic,
      question: INTERVIEW_FOLLOW_UPS[last.topic],
      optional: false,
      coreLeft,
      followUp: true,
    };
  }
  const next = INTERVIEW_TOPICS.find((t) => !covered.has(t.id));
  if (!next) return { done: true };
  const question = next.id === "who" ? INTERVIEW_OPENING : INTERVIEW_QUESTIONS[next.id][isPersonalBrand(turns) ? 1 : 0];
  return { done: false, topic: next.id, question, optional: !next.core, coreLeft: next.core ? coreLeft : 0 };
}

/**
 * The Playbook draft written from the interview answers instead of a crawled
 * site. Same shape as analyzeWebsite. Uses only what the user said: no URL it
 * didn't give, no logo or colours (they're added on the Playbook later), no
 * competitor it didn't name. Voice and style stay the generic template — the
 * account step is where a voice is learned.
 */
export function analyzeInterview(turns = []) {
  // A topic's last answer: a follow-up supersedes the vague one it asked about.
  const said = (topic) => (turns.filter((t) => t.topic === topic && !t.skipped).pop()?.answer || "").trim();
  const sentence = (s) => (s && !/[.!?…]$/.test(s) ? `${s}.` : s);
  const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const person = isPersonalBrand(turns);
  const who = said("who");

  const result = clone(GENERIC);
  // "I'm Jane Doe, …" / "We're Bloom Bakery, …" — else a placeholder to rename.
  const named = who.match(
    /\b(?:[Ii]'m|[Ii] am|[Ww]e're|[Ww]e are|[Mm]y name is|[Tt]his is|[Ii]t's)\s+([A-Z][\w'&-]*(?:\s+[A-Z][\w'&-]*){0,3})/,
  );
  result.name = named ? named[1] : person ? "My personal brand" : "My brand";
  result.businessSummary = [who, said("offer")].map(sentence).filter(Boolean).join(" ");

  const s = result.suggestions;
  const audience = said("audience");
  s.audience = audience ? [short(audience, 140)] : [];
  s.audienceProblems = [];
  const goals = said("goals");
  const objectives = objectivesInText(goals);
  s.objective = objectives.length ? objectives : goals ? [short(goals, 60)] : [];
  const links = said("cta").match(/(https?:\/\/[^\s,]+|[\w-]+(?:\.[\w-]+)+\/?[^\s,]*)/g) || [];
  s.ctaLinks = links.map((url, i) => ({
    label: i === 0 ? "Main link" : "Link",
    url,
    checked: i === 0,
    suggested: true,
  }));
  s.contentAction = links.length ? ["Visit the link"] : [];
  s.competitors = said("rivals")
    .split(/,|;|\band\b|\n/i)
    .map((n) => n.trim().replace(/[.!]+$/, ""))
    .filter((n) => n && n.split(/\s+/).length <= 5)
    .slice(0, 5)
    .map((name) => ({ name, description: "You named them in the interview.", websiteUrl: "", socials: [] }));
  s.brandColors = [];
  s.brandTypography = null;
  s.imageVoice = { websites: [] };
  return result;
}

/**
 * Mock-analyse an uploaded document. We don't actually parse the file —
 * we use the filename to derive a brand name. Returns the same shape
 * as `analyzeWebsite`.
 */
export function analyzeDocument(file) {
  const generic = clone(GENERIC);
  const filename = (file && file.name) || "Untitled document";
  const stem = filename.replace(/\.[^.]+$/, "");
  const prettyName =
    stem
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Untitled brand";

  generic.name = prettyName;
  generic.businessSummary = `Playbook built from your document "${filename}". Edit each section below to match what's actually in the file — I'll ground every post in your written Brand guidance.`;
  generic.suggestions.voiceProfile = {
    ...generic.suggestions.voiceProfile,
    headline: "Professional · clear · helpful",
  };
  return generic;
}

/**
 * Identity of a competitor for dedupe purposes — its domain when it has a
 * website, else its lowercased name (the GENERIC placeholders ship no URL).
 * Exported so the Playbook view can record a dismissal under the same key
 * discovery later excludes on. Accepts a competitor or an existing key.
 */
export function competitorKey(c) {
  if (typeof c === "string") return c.trim().toLowerCase();
  return (
    deriveDomain(c?.websiteUrl || "") ||
    String(c?.name || "")
      .trim()
      .toLowerCase() ||
    ""
  );
}

/**
 * Mock "competitor discovery" for a brand's website. Returns the entries from
 * that brand's competitor pool that aren't already known, so a repeat scan is
 * idempotent and only ever adds what's new.
 *
 * @param {string} url  the Playbook's website URL
 * @param {{ exclude?: Array<object|string> }} options  competitors already on
 *   the Playbook — accepted or still pending — plus the keys of the ones the
 *   user dismissed, so Archie never re-proposes a rejected competitor.
 * @returns {object[]} fresh competitors, each flagged `suggested: true`
 */
export function discoverCompetitors(url, { exclude = [] } = {}) {
  const pool = clone(analyzeWebsite(url).suggestions.competitors || []);
  const known = new Set((Array.isArray(exclude) ? exclude : []).map(competitorKey).filter(Boolean));
  return pool.filter((c) => {
    const key = competitorKey(c);
    if (!key || known.has(key)) return false;
    known.add(key); // guard against duplicates inside the pool itself
    return true;
  });
}

function deriveDomain(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
