// Image Generator — mocked copyService: hooks, CTAs, captions and hashtags, in the
// brand's voice (its tone, its examples' rhythm, never its "avoid" words).
//
// Contract:
//   hooks({ brand, brief, round? }) → Promise<string[3]>
//   ctas({ brand, brief, round? }) → Promise<string[3]>
//   caption({ brand, brief, network, headline }) → Promise<string>   (within the network's limit)
//   hashtags({ brand, brief, network }) → Promise<string[]>

import { MOCK } from "../../config/mock.js?v=1301";
import { COPY_LIMITS } from "../../config/copy-limits.js?v=1301";
import { hashString, prng, shuffle } from "../../lib/prng.js?v=1301";
import { wait } from "../../lib/delegate.js?v=1301";

function delay(signal) {
  const [min, max] = MOCK.copy.delayMs;
  return wait(min + Math.random() * (max - min), signal);
}

// The thing the post is about, as a short phrase: the headline if there is one,
// else the brief with its idea prefix ("Event: angle") and filler removed.
function subjectOf(brief) {
  const raw = String(brief?.headline || brief?.prompt || "").replace(/#\w+/g, "");
  const main = (raw.includes(":") ? raw.split(":")[0] : raw)
    .replace(/^(a|an|the|our|my)\s+/i, "")
    .replace(/\b(photo|image|picture|visual|illustration) of\s+/i, "")
    .trim();
  if (!main) return "what we do";
  const short = main.split(/\s+/).slice(0, 7).join(" ");
  return short.charAt(0).toLowerCase() + short.slice(1);
}

function scrub(text, brand) {
  let out = text;
  for (const word of brand?.voice?.avoid || []) {
    if (!word) continue;
    out = out.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").replace(/\s{2,}/g, " ");
  }
  return out.trim();
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const HOOKS = [
  (s) => `${cap(s)}, done properly`,
  (s) => `The story behind ${s}`,
  (s) => `What changes with ${s}`,
  (s) => `Three things nobody tells you about ${s}`,
  (s) => `${cap(s)} — this week only`,
  (s) => `We made ${s} simpler`,
  (s) => `Why ${s} matters now`,
  (s) => `${cap(s)}, in one picture`,
];

const CTAS_BY_SECTOR = {
  coffee: ["Order this week's roast", "Visit the roastery", "Find your blend", "Taste it this week"],
  finance: ["Book a 20-minute demo", "See how it works", "Start your free trial", "Talk to our team"],
  default: ["Discover more", "See how it works", "Get yours", "Learn more"],
};

/** Three hooks: two built on the subject, one taken from the brand's own voice examples. `round` varies them. */
export async function hooks({ brand, brief, round = 0 }, { signal } = {}) {
  await delay(signal);
  const rand = prng(hashString(`${brief?.prompt || ""}|${brand?.id || ""}|${round}`));
  const subject = subjectOf(brief);
  const built = shuffle(rand, HOOKS)
    .slice(0, 3)
    .map((fn) => scrub(fn(subject), brand));
  const voice = (brand?.voice?.examples || []).filter((e) => e.length <= 90);
  if (voice.length) built[2] = scrub(voice[Math.floor(rand() * voice.length)], brand);
  return built;
}

export async function ctas({ brand, round = 0 }, { signal } = {}) {
  await delay(signal);
  const list = CTAS_BY_SECTOR[brand?.sectorKey] || CTAS_BY_SECTOR.default;
  return shuffle(prng(hashString(`${brand?.id}|cta|${round}`)), list).slice(0, 3);
}

export async function hashtags({ brand, brief, network }, { signal } = {}) {
  await delay(signal);
  const limits = COPY_LIMITS[network] || COPY_LIMITS.instagram;
  const words = [
    brand?.name?.replace(/\s+/g, ""),
    ...(brief?.prompt || "").split(/\s+/).filter((w) => w.length > 4),
    ...(brand?.positioning?.objectives || []),
    ...(brand?.imageStyle?.moods || []),
  ]
    .filter(Boolean)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 2);
  const unique = [...new Set(words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)))];
  const count = Math.max(limits.hashtags.min, Math.min(limits.hashtags.max, unique.length));
  return unique.slice(0, count).map((w) => `#${w}`);
}

export async function caption({ brand, brief, network, headline }, { signal } = {}) {
  await delay(signal);
  const limits = COPY_LIMITS[network] || COPY_LIMITS.instagram;
  const example = brand?.voice?.examples?.[hashString(network) % Math.max(1, brand?.voice?.examples?.length || 1)];
  const subject = subjectOf(brief);
  const cta = (CTAS_BY_SECTOR[brand?.sectorKey] || CTAS_BY_SECTOR.default)[0];
  const byNetwork = {
    x: [headline || `${subject}.`, cta + "."],
    instagram: [headline || subject, example, `${cta} — link in bio.`],
    facebook: [headline || subject, example, `${cta}.`],
    linkedin: [headline || subject, example, brand?.positioning?.summary?.split(/(?<=\.)\s/)[0], `${cta}.`],
  };
  let text = scrub(
    (byNetwork[network] || byNetwork.facebook).filter(Boolean).join(network === "x" ? " " : "\n\n"),
    brand,
  );
  if (text.length > limits.maxChars) text = text.slice(0, limits.maxChars - 1).trimEnd() + "…";
  return text;
}
