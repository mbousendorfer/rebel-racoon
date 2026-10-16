// Draft posts, per session.
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.

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

const AUTHOR_NOBA = {
  name: "NOBA",
  title: "Fashion & lifestyle",
  initials: "NO",
  connection: "",
  visibility: "Public",
};
const AUTHOR_PAW = { name: "Pawtrack", title: "Pet tech", initials: "PT", connection: "", visibility: "Public" };
const AUTHOR_BJJ = {
  name: "Alliance Jiu Jitsu Carlsbad",
  title: "Martial arts school",
  initials: "AJ",
  connection: "",
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
      // The chat asked for LinkedIn AND X: this is the X one (voice per
      // network — the coaching question needs a draft off the base network).
      network: "twitter",
      status: "ready",
      timeLabel: "3h",
      text: [
        "Your Q2 plan isn't a plan, it's a wish list — unless every objective names the single signal you'll watch weekly.",
        "Teams who track one weekly proof point ship on cadence.",
      ],
      hashtags: ["Q2Planning"],
      cta: "",
      stats: { likes: 147, comments: 8, reposts: 11 },
      hasImage: true,
      imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=640&h=360&q=70",
      generationContext: seedIdeaGen("The data-backed post-mortem", "Why we stopped writing quarterly OKRs"),
    },
    {
      id: "post-acme-2",
      author: AUTHOR_MC,
      // Fails on purpose: Instagram won't publish without media
      // (post-validation.js derives the error — nothing is stored here).
      network: "instagram",
      status: "ready",
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
      hasImage: true,
      // A carousel: slide 0 doubles as the poster, like attachCarouselToDraft.
      imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&h=360&q=70",
      carousel: [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&h=360&q=70",
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=640&h=360&q=70",
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=640&h=360&q=70",
      ],
      generationContext: seedIdeaGen("The honest founder retro", "The three constraints that killed our first launch"),
    },
    {
      id: "post-acme-4",
      author: AUTHOR_MC,
      // Fails on purpose: over X's 280 characters (derived, not stored).
      network: "twitter",
      status: "ready",
      timeLabel: "3d",
      text: [
        "Behind-the-scenes on the founder keynote — including the parts that got cut. The cuts are more instructive than the keynote itself.",
        "We dropped the product demo, the roadmap slide and the customer logos. What stayed: the three mistakes we made in year one, and what each one cost us.",
      ],
      hashtags: ["FounderKeynote", "BTS"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: true,
      imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=640&h=360&q=70",
      generationContext: seedIdeaGen("The behind-the-scenes recap", "What a founder keynote looks like at 50 people"),
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
      status: "ready",
      timeLabel: "yesterday",
      text: [
        "The metric Riverside cared about that we didn't track — until they told us. Sharing the reframe that flipped our roadmap.",
      ],
      hashtags: ["Discovery", "Roadmap"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The reframe angle", "The metric Riverside cared about that we didn't track"),
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
  // The first image's look, three states (sessions.js) — see requireImageLook.
  "s-noba-drop": [
    {
      id: "post-noba-1",
      author: AUTHOR_NOBA,
      network: "instagram",
      status: "ready",
      timeLabel: "6 days",
      text: [
        "Linen, but make it city. The spring drop lands Friday — five pieces, one palette, zero ironing.",
        "Swipe for the full edit.",
      ],
      hashtags: ["SpringDrop", "NOBA"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The launch tease", "The spring drop, five pieces"),
    },
    {
      id: "post-noba-2",
      author: AUTHOR_NOBA,
      network: "instagram",
      status: "ready",
      timeLabel: "6 days",
      text: ["The sand overshirt is the piece we kept stealing back from the sample rail. Now it's yours."],
      hashtags: ["Linen", "Overshirt"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The hero piece", "The sand overshirt"),
    },
    {
      id: "post-noba-3",
      author: AUTHOR_NOBA,
      network: "facebook",
      status: "ready",
      timeLabel: "6 days",
      text: ["Spring drop, Friday 10am. Members get an hour's head start — the link goes out Thursday night."],
      hashtags: ["SpringDrop"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The members' early access", "Early access for members"),
    },
  ],
  "s-pawtrack-walks": [
    {
      id: "post-paw-1",
      author: AUTHOR_PAW,
      network: "instagram",
      status: "ready",
      timeLabel: "1 week",
      text: [
        "11:48pm, one missed recall, and a dog who thinks squirrels are a lifestyle.",
        "The map found him two streets over in four minutes.",
      ],
      hashtags: ["NightWalks", "Pawtrack"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The 2am moment", "Night walks, off the lead"),
    },
    {
      id: "post-paw-2",
      author: AUTHOR_PAW,
      network: "facebook",
      status: "ready",
      timeLabel: "1 week",
      text: ["Darker evenings, longer walks. Turn on Night mode and the collar light comes on by itself at dusk."],
      hashtags: ["NightMode"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The feature tip", "Night mode on the collar"),
    },
  ],
  "s-alliance-open-mat": [
    {
      id: "post-bjj-1",
      author: AUTHOR_BJJ,
      network: "instagram",
      status: "ready",
      timeLabel: "1 week",
      text: ["Saturday open mat, 10am. Bring a partner, bring a question, leave with one thing that finally clicked."],
      hashtags: ["OpenMat", "Carlsbad"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: true,
      imageUrl: "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1080&h=1080&q=80",
      generationContext: seedIdeaGen("The invitation", "Saturday open mat"),
    },
    {
      id: "post-bjj-2",
      author: AUTHOR_BJJ,
      network: "facebook",
      status: "ready",
      timeLabel: "1 week",
      text: [
        "Parents ask us if jiu jitsu makes kids aggressive. Saturday is the best answer we have: come and watch an open mat.",
      ],
      hashtags: ["KidsBJJ", "Parents"],
      cta: "",
      stats: { likes: 0, comments: 0, reposts: 0 },
      hasImage: false,
      generationContext: seedIdeaGen("The parent's worry", "Saturday open mat for parents"),
    },
  ],
};
