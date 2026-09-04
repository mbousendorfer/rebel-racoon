// Connected social accounts, and the folders drafts can be filed into.
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.

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

// A large, varied set of CONNECTED social profiles — several brands, each on a
// handful of the six badge-supported networks — so the profile quickpicker's
// search field can be evaluated against a realistic long list. social-profiles.js
// appends it to getConnectedProfiles(). Every entry carries its own `initials`
// so the avatar fallback reads as a distinct brand (no shared photo).
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
