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
