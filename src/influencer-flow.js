// Adding an influencer: the check a pasted profile goes through, and the write
// that follows. One module for the three places that add one — the Playbook's
// Influencers section, the Topic Feed's invitation card, and the Influencers
// card of /topics/settings — so the three can never disagree on what is refused.
//
//   checkInfluencerProfile(raw, taken) → { ok, entry } | { ok: false, reason }
//   addInfluencersToPlaybook(playbookId, entries) — writes the list, and
//     switches the feed's Influencers source on if it was off
//
// ── Why a pasted link and nothing else ──────────────────────────────────────
// Archie cannot propose creators: Google's grounding terms forbid storing what a
// grounded search returns, so a creator the model found can never be kept on a
// Playbook nor read every week. The customer brings the profile, and it is then
// checked through the network's own API — which is only possible on Instagram
// business and creator accounts, Facebook Pages and YouTube channels. LinkedIn
// has no API to read a member's posts; X and TikTok are out of V1. Each refusal
// says why, because a field that just goes red teaches nothing.

import { influencerLookup } from "./mocks.js?v=1419";
import { getContextById, updateContext } from "./contexts-store.js?v=1419";
import { getFeedForPlaybook, updateFeed } from "./topic-feeds-store.js?v=1419";

export const INFLUENCER_SOURCE_ID = "influencer-posts";

// Long enough to read "Checking…", short enough that nobody waits in a demo.
export const CHECK_MS = 700;

const SUPPORTED = "Instagram business or creator accounts, Facebook Pages and YouTube channels";

const REFUSED_HOSTS = [
  {
    match: /(^|\.)linkedin\.com$/,
    reason: "LinkedIn doesn't let apps read a member's posts, so I can't follow LinkedIn creators.",
  },
  {
    match: /(^|\.)(x|twitter)\.com$/,
    reason: `X isn't supported yet. Try their Instagram, Facebook Page or YouTube channel instead.`,
  },
  {
    match: /(^|\.)tiktok\.com$/,
    reason: `TikTok isn't supported yet. Try their Instagram, Facebook Page or YouTube channel instead.`,
  },
];

function parseUrl(raw) {
  const s = raw.trim();
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

// The handle a supported network's profile URL names, or null when the path is
// not a profile (a post, a search page, the network's home).
function handleFor(network, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (network === "youtube") {
    const at = parts.find((p) => p.startsWith("@"));
    if (at) return at.slice(1);
    if ((parts[0] === "c" || parts[0] === "channel" || parts[0] === "user") && parts[1]) return parts[1];
    return null;
  }
  if (network === "facebook" && parts[0] === "profile.php") return "profile.php";
  const first = parts[0];
  if (!first || ["p", "reel", "reels", "explore", "stories", "watch", "groups", "events"].includes(first)) return null;
  return first.replace(/^@/, "");
}

function networkOf(host) {
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook|fb)\.com$/.test(host)) return "facebook";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  return null;
}

function nameFromHandle(handle) {
  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** A stable key for "is this profile already listed?" — network + handle. */
function profileKey(network, url) {
  const u = parseUrl(url || "");
  const h = u ? handleFor(network, u) : null;
  return h ? `${network}:${h.toLowerCase()}` : null;
}

/**
 * Checks one pasted profile. `taken` is the set of profile keys already on the
 * Playbook or staged in the dialog, so the same creator is never added twice.
 */
export function checkInfluencerProfile(raw, taken = new Set()) {
  const text = (raw || "").trim();
  if (!text) return { ok: false, reason: "" };
  if (/^@[\w.-]+$/.test(text)) {
    return { ok: false, reason: "Paste the full profile link, so I know which network the handle is on." };
  }
  const url = parseUrl(text);
  if (!url || !url.hostname.includes(".")) {
    return { ok: false, reason: "That doesn't look like a profile link." };
  }
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const refused = REFUSED_HOSTS.find((r) => r.match.test(host));
  if (refused) return { ok: false, reason: refused.reason };

  const network = networkOf(host);
  if (!network) return { ok: false, reason: `I can only follow ${SUPPORTED}.` };

  const handle = handleFor(network, url);
  if (!handle) return { ok: false, reason: "This link points to a post or a page, not to a profile." };
  if (handle === "profile.php") {
    return {
      ok: false,
      reason: "This is a personal Facebook profile. I can only read Facebook Pages.",
    };
  }

  const key = `${network}:${handle.toLowerCase()}`;
  if (taken.has(key)) return { ok: false, reason: "This profile is already in the list." };

  const known = influencerLookup[key];
  const name = known?.name || nameFromHandle(handle);
  if (known?.kind === "personal") {
    return {
      ok: false,
      reason: `${name} is a personal account. I can only read business and creator accounts.`,
    };
  }
  if (known?.kind === "inactive") {
    return {
      ok: false,
      reason: `${name} hasn't posted in over 90 days, so there would be nothing to read.`,
    };
  }

  const profileUrl =
    network === "youtube" ? `https://www.youtube.com/@${handle}` : `https://www.${network}.com/${handle}`;
  return {
    ok: true,
    entry: {
      key,
      name,
      handle,
      network,
      websiteUrl: "",
      description: "",
      socials: [{ network, url: profileUrl }],
    },
  };
}

/** The profile keys already on a list of influencers. */
export function takenKeys(list = []) {
  const keys = new Set();
  for (const c of list) {
    for (const s of Array.isArray(c?.socials) ? c.socials : []) {
      const k = profileKey(s.network, s.url);
      if (k) keys.add(k);
    }
  }
  return keys;
}

/** A checked entry, shaped the way the Playbook stores an influencer. */
export function toInfluencer(entry, i = 0) {
  return {
    id: `inf-new-${i + 1}-${Date.now().toString(36)}`,
    name: entry.name,
    description: entry.description || "",
    websiteUrl: entry.websiteUrl || "",
    socials: entry.socials.map((s) => ({ ...s })),
  };
}

/**
 * Appends checked entries to a saved Playbook and makes sure its feed reads
 * them: adding a creator the feed does not listen to would be a promise the
 * next run breaks. Returns the Playbook's new count.
 */
export function addInfluencersToPlaybook(playbookId, entries) {
  const ctx = getContextById(playbookId);
  if (!ctx || !entries.length) return 0;
  const list = [...(ctx.influencers || []), ...entries.map(toInfluencer)];
  updateContext(playbookId, { influencers: list });
  const feed = getFeedForPlaybook(playbookId);
  if (feed && !feed.sources.includes(INFLUENCER_SOURCE_ID)) {
    updateFeed(feed.id, { sources: [...feed.sources, INFLUENCER_SOURCE_ID] });
  }
  return list.length;
}
