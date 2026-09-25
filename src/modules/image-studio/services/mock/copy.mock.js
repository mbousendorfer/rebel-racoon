// Image Generator — mocked copyService: hooks, CTAs, captions and hashtags, in the
// brand's voice (its tone, its examples' rhythm, never its "avoid" words).
//
// Contract:
//   hooks({ brand, brief }) → Promise<string[3]>
//   ctas({ brand, brief }) → Promise<string[3]>
//   caption({ brand, brief, network, headline }) → Promise<string>   (within the network's limit)
//   hashtags({ brand, brief, network }) → Promise<string[]>

import { MOCK } from "../../config/mock.js?v=1227";
import { COPY_LIMITS } from "../../config/copy-limits.js?v=1227";
import { hashString, prng, shuffle } from "../../lib/prng.js?v=1227";
import { wait } from "../../lib/delegate.js?v=1227";

function delay(signal) {
  const [min, max] = MOCK.copy.delayMs;
  return wait(min + Math.random() * (max - min), signal);
}

function subjectOf(brief) {
  const text = (brief?.prompt || "").replace(/#\w+/g, "").trim();
  if (!text) return "what we do";
  return text.length > 60 ? text.slice(0, 57).trimEnd() + "…" : text;
}

function scrub(text, brand) {
  let out = text;
  for (const word of brand?.voice?.avoid || []) {
    if (!word) continue;
    out = out.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").replace(/\s{2,}/g, " ");
  }
  return out.trim();
}

const HOOKS = [
  (s) => `The story behind ${s}`,
  (s) => `${s.charAt(0).toUpperCase() + s.slice(1)}, done properly`,
  (s) => `What changes when you get ${s} right`,
  (s) => `Three things nobody tells you about ${s}`,
  (s) => `We made ${s} simpler`,
  (s) => `${s.charAt(0).toUpperCase() + s.slice(1)} — this week only`,
];

const CTAS_BY_SECTOR = {
  coffee: ["Order this week's roast", "Visit the roastery", "Find your blend"],
  finance: ["Book a 20-minute demo", "See how it works", "Start your free trial"],
  default: ["Discover more", "Shop the collection", "Learn more"],
};

export async function hooks({ brand, brief }, { signal } = {}) {
  await delay(signal);
  const rand = prng(hashString((brief?.prompt || "") + (brand?.id || "")));
  const subject = subjectOf(brief);
  return shuffle(rand, HOOKS)
    .slice(0, 3)
    .map((fn) => scrub(fn(subject), brand));
}

export async function ctas({ brand }, { signal } = {}) {
  await delay(signal);
  return (CTAS_BY_SECTOR[brand?.sectorKey] || CTAS_BY_SECTOR.default).slice();
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
