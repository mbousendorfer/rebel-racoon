// Mocked "website analysis" — the proto has no real scraping. analyzeWebsite
// returns a deterministic draft based on the URL: agorapulse.com hits a
// hand-tuned mock matching the V1 brief HTML reference, anything else
// returns a generic SaaS template that still produces a usable brief.
//
// The shape returned is consumed by context-builder.js after the ~10s
// pending turn finishes, then passed to the right-panel brief renderer.
// Suggested values become menthol chips (AI-suggested). Other static
// option lists come from the brief panel renderer.

import { networkFields, isListPart, isNewPart, itemsFromLines } from "./network-voice.js?v=1913";
import { objectivesInText } from "./objective-measures.js?v=1913";

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
    "This brand sells a product or service that solves a specific problem for a clearly defined audience. The website highlights the value proposition, key features, and credibility markers (case studies, testimonials, results). Edit this summary to match your business — I'll use it to ground every post.",
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

// How each network bends the base voice, as Archie would read it off that
// network's posts — the Optimize wizard's options, part by part: two ways to
// sound for the summary, three lines for each list (a case reads "Kind of
// post: how it's written"). The first of each — the first two lines of a list
// — is Archie's pick, what Optimize writes when nobody chooses
// (analyzeNetworkVoices). `closings` feed the coaching question ("How do you
// usually end a post on X?"), whose answer joins Now and then.
const NETWORK_VOICE = {
  linkedin: {
    voiceSummary: [
      "Professional and conversational: a first line strong enough to earn the « see more », then short paragraphs that read like a peer sharing what worked.",
      "Measured and expert: a lesson from experience told as a short story, ending on one plain takeaway.",
    ],
    voiceAlways: [
      "Put the hook in the first line — it's all that shows before « see more ».",
      "Short paragraphs with air between them.",
      "End on a takeaway or a question.",
    ],
    voiceNever: [
      "Never put the link in the post when it's about an idea — it goes in the comments.",
      "No more than three hashtags.",
      "Never open with « Excited to announce ».",
    ],
    voiceByPost: [
      "Lesson or opinion: a one-line hook, a short story in three beats, then the lesson in one plain sentence.",
      "Company news: what changed and why it matters to the reader, before any thank-you.",
      "Document or carousel: one line that says what the reader will learn, then let the slides do the work.",
    ],
    voiceSometimes: [
      "Close by asking for the reader's take.",
      "Three hashtags at the end, never in the text.",
      "Emoji as bullets in a list, never mid-sentence.",
    ],
    closings: ["What's your take?", "Follow for the next one.", "Link in the comments."],
  },
  instagram: {
    voiceSummary: [
      "Warm and visual: the caption frames the image, opens on a line worth stopping for and keeps the details for the carousel.",
      "Casual and close: it talks to one person, with a few emoji and short lines that read on a phone.",
    ],
    voiceAlways: [
      "Put the hook in the first line, before the caption is cut.",
      "Short paragraphs, then the hashtags in one block at the very end.",
      "Point to the link in bio for anything to click.",
    ],
    voiceNever: [
      "Never put a link in the caption — it can't be clicked.",
      "Never use emoji mid-sentence.",
      "No hashtags in the body of the caption.",
    ],
    voiceByPost: [
      "Carousel: the caption says why to swipe; the details live on the slides.",
      "Reel: one line that says the hook again in words.",
      "Single photo: one moment someone can picture, then one sentence of context.",
    ],
    voiceSometimes: [
      "Close by asking to save the post.",
      "Close by asking to tag someone.",
      "One or two emoji to open a line.",
    ],
    closings: ["Save this for later.", "Tag someone who needs this.", "Tell me in the comments."],
  },
  x: {
    voiceSummary: [
      "Short and dry: one idea per post, said the way you'd reply to a friend.",
      "Punchy and opinionated: the take up front, the detail in a thread when it needs one.",
    ],
    voiceAlways: [
      "One idea per post, under 280 characters.",
      "Anything longer becomes a numbered thread.",
      "The link goes last.",
    ],
    voiceNever: ["No more than one hashtag.", "No more than one emoji.", "Never a setup line before the point."],
    voiceByPost: [
      "Thread: a hook post that stands alone, then two to four replies, one step each.",
      "Hot take: the opinion in the first five words, one reason after it.",
      "Link share: say what the reader gets, then the link.",
    ],
    voiceSometimes: ["Close by asking « Thoughts? ».", "Open with « Hot take: » or « Thread: ».", "Lowercase is fine."],
    closings: ["Thoughts?", "More in the thread below.", "Agree or disagree?"],
  },
  facebook: {
    voiceSummary: [
      "Friendly and conversational: two or three short paragraphs that read like a chat, ending on a question.",
      "Warm and casual: one short paragraph and a clear link preview — the link does the work.",
    ],
    voiceAlways: [
      "Two or three short paragraphs that read like a conversation.",
      "Keep the link in the post so the preview card shows.",
      "End on a question that opens the comments.",
    ],
    voiceNever: [
      "No hashtags — they read as spam here.",
      "Never post a link without saying what's behind it.",
      "Never write like an ad.",
    ],
    voiceByPost: [
      "Event: what, when and where in the first line, then who it's for.",
      "Community question: ask one thing people can answer in a sentence.",
      "Link share: one short paragraph, then the link preview.",
    ],
    voiceSometimes: [
      "Close by asking what the reader would add.",
      "Close by asking to share it.",
      "An emoji to open the post.",
    ],
    closings: ["What would you add?", "Share this with someone who needs it.", "Link in the comments."],
  },
  tiktok: {
    voiceSummary: [
      "Casual and fast: the caption backs the video with one line that says the hook again in words.",
      "Playful and native: all lowercase, the caption asks the question the video answers.",
    ],
    voiceAlways: [
      "One caption line that says the hook again in words.",
      "Two or three hashtags that match the video.",
      "Casual casing.",
    ],
    voiceNever: [
      "Never explain the whole video in the caption.",
      "No corporate wording.",
      "No more than three hashtags.",
    ],
    voiceByPost: [
      "Tutorial: the caption names the result, the video shows the steps.",
      "Trend: the caption plays along in one line; the brand stays in the background.",
      "Behind the scenes: one line of context, said like a person.",
    ],
    voiceSometimes: ["Close by asking to follow for part 2.", "Close by asking to save it.", "Open with « POV: »."],
    closings: ["Follow for part 2.", "Save this one.", "Tell me in the comments."],
  },
  youtube: {
    voiceSummary: [
      "Clear and helpful: the title carries the hook, the description opens with what the video answers, then chapters.",
      "Plain and searchable: a title that asks a question, a description that answers it in three short lines.",
    ],
    voiceAlways: [
      "The title carries the hook.",
      "The description opens with what the video answers.",
      "Links and timestamps live in the description.",
    ],
    voiceNever: [
      "No emoji in titles.",
      "Never bury the main link below the fold.",
      "No clickbait the video doesn't deliver.",
    ],
    voiceByPost: [
      "Tutorial: the title names the result, the description lists the steps as chapters.",
      "Short: the title is the hook; the description is one line.",
      "Interview: the guest's name and the one question that matters, in the title.",
    ],
    voiceSometimes: [
      "Close by asking to subscribe.",
      "Close by asking a question for the comments.",
      "Three hashtags in the description; the first shows above the title.",
    ],
    closings: ["Subscribe for the next one.", "Tell us in the comments.", "Full video linked below."],
  },
};

/**
 * What Archie offers for each part of a network voice — the Optimize wizard's
 * options, keyed by part (network-voice.js VOICE_PARTS).
 * @param {string} network
 * @returns {{ [part: string]: string[] } | null}
 */
export function networkVoiceOptions(network) {
  const v = NETWORK_VOICE[network];
  if (!v) return null;
  const { closings, ...parts } = v;
  return clone(parts);
}

/** Closings that read native on a network — the coaching question's answers. */
export function networkClosings(network) {
  return NETWORK_VOICE[network]?.closings?.slice() || null;
}

// What each network itself recommends, part by part — "What X says" in the
// Optimize assistant's right column. Researched 2026-10-15 on the networks'
// OWN pages (creator portals, business help centres, official blogs; no
// third-party blog), each sentence paraphrased, never quoted, with the page it
// comes from. An empty list = the network publishes nothing official on that
// part (the column says so). A few come from ad guidance and say it in the
// text ("From X's ad guidance: …"). Two X pages exist only in German.
// ponytail: a snapshot — re-check the sources before trusting a number.
const NETWORK_GUIDANCE = {
  linkedin: {
    signatureHooks: [
      {
        text: "Lead with what the reader gets out of the post, using as few characters as possible.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
      {
        text: "Open with a thought-provoking question, a relevant statistic or a point from the content you're linking to.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
    ],
    closingPatterns: [
      {
        text: "Treat each post as the start of a conversation: end on a question that invites comments, then reply to them.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
    ],
    formattingStyle: [
      {
        text: "Keep updates short. LinkedIn suggests about 150 characters or fewer.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
      {
        text: "Add an image to your posts. Collages of 3–4 images and uploaded PDFs or slide decks also work well for organizations.",
        source: "https://business.linkedin.com/advertise/linkedin-pages/best-practices",
      },
    ],
    visualStyle: [
      {
        text: "Try posts with no link for questions or ideas, and add tracking codes to the links you do share.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
    ],
    hashtagStyle: [
      {
        text: "Pick 3–5 hashtags your organization cares about and add them when they're relevant.",
        source: "https://business.linkedin.com/advertise/linkedin-pages/best-practices",
      },
      {
        text: "Use the hashtags your communities already use, and give themed series their own hashtag.",
        source:
          "https://www.linkedin.com/business/marketing/blog/linkedin-pages/5-non-obvious-ways-to-improve-your-linkedin-company-page",
      },
    ],
  },
  instagram: {
    signatureHooks: [
      {
        text: "Make the first 3 seconds of a reel engaging so people don't scroll past.",
        source: "https://creators.instagram.com/faq?locale=en_US",
      },
    ],
    closingPatterns: [],
    formattingStyle: [
      {
        text: "Keep reels to 3 minutes or less if you want them recommended to people who don't follow you.",
        source: "https://creators.instagram.com/faq?locale=en_US",
      },
      {
        text: "If you mostly post photos, share feed posts or carousels on a regular schedule.",
        source: "https://creators.instagram.com/faq?locale=en_US",
      },
    ],
    visualStyle: [],
    hashtagStyle: [
      {
        text: "Use no more than five hashtags per reel or post. Instagram now caps it at five.",
        source: "https://www.threads.com/@creators/post/DSalXGPCWM4",
      },
      {
        text: "Put keywords and hashtags in the caption, not the comments. Use only ones that match your topic, because off-topic tags hurt distribution.",
        source: "https://about.instagram.com/blog/announcements/break-down-how-instagram-search-works",
      },
    ],
  },
  x: {
    signatureHooks: [
      {
        text: "Write it like a text message: real, conversational and concise.",
        source: "https://business.x.com/en/basics/get-your-business-started-with-x",
      },
      {
        text: "From X's ad guidance: get straight to the point with one clear message. Its best ads run 50–100 characters.",
        source: "https://business.x.com/en/advertising/creative-best-practices",
      },
    ],
    closingPatterns: [
      {
        text: "Add a clear call to action when it fits, such as sending people to your site.",
        source: "https://business.x.com/en/basics/get-your-business-started-with-x",
      },
      {
        text: "Ask questions to start conversations, collect feedback or let followers vote on a choice.",
        source: "https://business.x.com/de/basics/what-to-tweet",
      },
    ],
    formattingStyle: [
      {
        text: "Keep each post to one specific message. If you have more to say, link to your site or start a thread.",
        source: "https://business.x.com/de/basics/what-to-tweet",
      },
      {
        text: "Add media such as an image, video, GIF or poll to your posts.",
        source: "https://business.x.com/en/basics/get-your-business-started-with-x",
      },
    ],
    visualStyle: [
      {
        text: "If you use emojis, put them at the end of the text to add emotion.",
        source: "https://business.x.com/en/basics/get-your-business-started-with-x",
      },
    ],
    hashtagStyle: [
      {
        text: "If you use hashtags, keep to 1–2 per post.",
        source: "https://business.x.com/en/basics/get-your-business-started-with-x",
      },
      {
        text: "Capitalize each word for readability and avoid all caps. Don't force a slogan into a hashtag that doesn't fit the post.",
        source: "https://business.x.com/de/blog/the-dos-and-donts-of-hashtags",
      },
    ],
  },
  facebook: {
    signatureHooks: [
      {
        text: "From Meta's video-ad guidance: grab attention right away by opening on strong visuals and showing your brand in the first seconds.",
        source: "https://www.facebook.com/business/news/updated-features-for-video-ads",
      },
    ],
    closingPatterns: [],
    formattingStyle: [
      {
        text: "Use short reels (10–30 seconds) to grow reach and longer ones (30 seconds to over 3 minutes) to build engagement.",
        source: "https://creators.facebook.com/blog/making-it-easier-to-create-videos-on-facebook",
      },
      {
        text: "Assume video plays without sound, and carry the message with captions and on-screen text.",
        source: "https://www.facebook.com/business/news/updated-features-for-video-ads",
      },
    ],
    visualStyle: [],
    hashtagStyle: [
      {
        text: "Write each hashtag as one word with no spaces. Numbers work, but punctuation and special characters don't.",
        source: "https://www.facebook.com/help/587836257914341",
      },
    ],
  },
  tiktok: {
    signatureHooks: [
      {
        text: "Put something eye-catching in the first 5 seconds to stop the scroll, whatever the video's length.",
        source: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
      },
      {
        text: "From TikTok's ad guidance: land the hook within 6 seconds and state your core message within the first 3.",
        source: "https://ads.tiktok.com/help/article/creative-best-practices",
      },
    ],
    closingPatterns: [
      {
        text: "From TikTok's ad guidance: end on a clear call to action that tells viewers what to think, feel or do.",
        source: "https://ads.tiktok.com/help/article/creative-best-practices",
      },
    ],
    formattingStyle: [
      {
        text: "Build the video like a story, with a beginning, a middle and an end. Fit the length to the type of content.",
        source: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
      },
      {
        text: "Add on-screen text, such as headlines, intro cards or auto-captions. Many viewers watch on mute.",
        source: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
      },
    ],
    visualStyle: [],
    hashtagStyle: [
      {
        text: "Use 2–3 hashtags per video, and only ones that relate to the video.",
        source: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
      },
      {
        text: "Pair them with a clear description so viewers quickly get what the video is about.",
        source: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
      },
    ],
  },
  youtube: {
    signatureHooks: [
      {
        text: "Keep titles short and put the most important words first. Save episode numbers and branding for the end.",
        source: "https://support.google.com/youtube/answer/12340300?hl=en",
      },
      {
        text: "Put the key information at the top of the description, since that is what shows before Show more.",
        source: "https://support.google.com/youtube/answer/12948449?hl=en",
      },
    ],
    closingPatterns: [
      {
        text: "Use end screens in the last 5–20 seconds to promote other videos or ask for subscriptions. Leave room for them.",
        source: "https://support.google.com/youtube/answer/6388789?hl=en",
      },
      {
        text: "Link to playlists of related videos in the description.",
        source: "https://support.google.com/youtube/answer/12948449?hl=en",
      },
    ],
    formattingStyle: [
      {
        text: "Write a unique description for each video (up to 5,000 characters). Use your one or two main keywords in both the title and description.",
        source: "https://support.google.com/youtube/answer/12948449?hl=en",
      },
      {
        text: "Add chapters to longer videos so viewers can jump to the key parts.",
        source: "https://support.google.com/youtube/answer/12948449?hl=en",
      },
    ],
    visualStyle: [
      {
        text: "Use ALL CAPS and emoji sparingly, only to stress an emotion or a special moment.",
        source: "https://support.google.com/youtube/answer/12340300?hl=en",
      },
      {
        text: "Avoid loud or misleading titles, such as all caps, strings of exclamation marks, or clickbait that misrepresents the video.",
        source: "https://support.google.com/youtube/answer/141805?hl=en",
      },
    ],
    hashtagStyle: [
      {
        text: "Add hashtags to the title or description. Up to three from the description appear next to the title. Hashtags can't contain spaces.",
        source: "https://support.google.com/youtube/answer/6390658?hl=en",
      },
      {
        text: "Use only hashtags directly related to the video. YouTube ignores all of them if there are more than 60.",
        source: "https://support.google.com/youtube/answer/6390658?hl=en",
      },
    ],
  },
};

// Each network's guidelines landing page — the link when a part has no source.
const NETWORK_GUIDANCE_URL = {
  linkedin: "https://business.linkedin.com/advertise/linkedin-pages/best-practices",
  instagram: "https://creators.instagram.com/best-practices",
  x: "https://business.x.com/en/basics/get-your-business-started-with-x",
  facebook: "https://creators.facebook.com/how-to-get-your-content-seen-on-facebook/",
  tiktok: "https://www.tiktok.com/creator-academy/en/article/elements-of-tiktok-video?lang=en",
  youtube: "https://www.youtube.com/creators/grow/optimize-your-content/",
};

/** The network's guidelines landing page, or "" when there's none. */
export function networkGuidanceUrl(network) {
  return NETWORK_GUIDANCE_URL[network] || "";
}

// NETWORK_GUIDANCE is filed by TOPIC (openings, closings, formatting, emoji,
// hashtags — how the networks write it); a voice part reads the topics it
// covers. Nothing official on the summary or on cases: the column says so.
const GUIDANCE_TOPICS = {
  voiceAlways: ["formattingStyle", "visualStyle"],
  voiceSometimes: ["signatureHooks", "closingPatterns", "hashtagStyle"],
};

/** What the network says about one part: [{ text, source }] (may be empty). */
export function networkGuidance(network, field) {
  return (GUIDANCE_TOPICS[field] || []).flatMap((topic) => NETWORK_GUIDANCE[network]?.[topic] || []);
}

/**
 * Pretend to read the posts of each network the Playbook publishes on and
 * return how each one adapts the base voice — the voiceByNetwork a Playbook is
 * born with (flag networkVoices): Archie's pick for every part. The base
 * network gets no entry: it IS the base. A part the product just added
 * (voiceNewSection) is left to do — the demo of a new part.
 * @param {string[]} networks
 * @param {string} base
 */
export function analyzeNetworkVoices(networks = [], base = "") {
  const out = {};
  for (const n of new Set(networks)) {
    const opts = networkVoiceOptions(n);
    if (n === base || !opts) continue;
    const entry = { drafted: true };
    for (const field of networkFields()) {
      if (!opts[field] || isNewPart(field)) continue;
      entry[field] = isListPart(field) ? itemsFromLines(field, opts[field].slice(0, 2)) : opts[field][0];
    }
    out[n] = entry;
  }
  return out;
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
