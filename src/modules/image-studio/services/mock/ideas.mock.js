// Image Generator — mocked ideaService: campaign ideas so the hub never starts
// from a blank page. Drawn from the brand (a Playbook: its objectives, moods,
// voice), its catalogue, and the calendar of events.
//
// Contract:
//   suggest({ brand, products, styles, events, round }) → Promise<Idea[4]>
//   Idea: { id, title, angle, prompt, formatIds[], styleId, productId?, eventId?, eventLabel?, eventDate?, previewSeed }
// `round` changes on "More ideas"; the same round gives the same ideas.

import { hashString, pick, prng, shuffle } from "../../lib/prng.js?v=1301";
import { wait } from "../../lib/delegate.js?v=1301";
import { MOCK } from "../../config/mock.js?v=1301";

const FORMAT_SETS = [
  ["ig-portrait", "ig-story", "fb-square"],
  ["li-square", "li-link", "x-landscape"],
  ["ig-post", "fb-square", "x-square"],
  ["ig-story", "fb-story"],
  ["li-portrait", "ig-portrait"],
];

const EVENT_ANGLES = [
  (e, b) => ({ title: `${e.label}, the ${b.name} way`, angle: e.angle }),
  (e) => ({ title: `Countdown to ${e.label}`, angle: `Build up to ${e.label} with one strong visual a day.` }),
];

const PRODUCT_ANGLES = [
  (p) => ({
    title: `${p.name}, up close`,
    angle: "One product, one detail worth noticing.",
    prompt: `${p.name} in close-up, on a clean surface`,
  }),
  (p) => ({
    title: `A day with ${p.name}`,
    angle: "The product in real use, not on a shelf.",
    prompt: `${p.name} being used in an everyday moment`,
  }),
];

const BRAND_ANGLES = [
  (b) => ({
    title: `What ${b.name} stands for`,
    angle: b.positioning.summary.split(/(?<=\.)\s/)[0] || "Say what you believe in one image.",
    prompt: `A symbolic image of ${b.imageStyle.moods.slice(0, 2).join(" and ") || "the brand's world"}`,
  }),
  (b) => ({
    title: "The number that matters",
    angle: "One figure, big, with the line that explains it.",
    prompt: "A key number about our results",
  }),
  (b) => ({
    title: "Behind the scenes",
    angle: "The people and the process nobody sees.",
    prompt: "The team at work, candid",
  }),
];

function dateLabel(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export async function suggest({ brand, products = [], styles = [], events = [], round = 0 }, { signal } = {}) {
  const [min, max] = MOCK.copy.delayMs;
  await wait(min + Math.random() * (max - min), signal);
  const rand = prng(hashString(`${brand.id}:${round}`));
  const presetsByFamily = (fam) => styles.filter((s) => s.family === fam);
  const own = styles.filter((s) => s.kind === "custom");
  const styleFor = (kind) => {
    if (own.length && rand() < 0.5) return pick(rand, own).id;
    const fam =
      kind === "number"
        ? "graphic"
        : kind === "product"
          ? pick(rand, ["photo", "3d"])
          : pick(rand, ["photo", "illustration", "trend"]);
    const list = presetsByFamily(fam);
    return list.length ? pick(rand, list).id : styles[0]?.id;
  };
  const ideas = [];
  // Two of the three nearest events — an idea for March is noise in September.
  const upcoming = shuffle(rand, events.slice(0, 3)).slice(0, 2);
  for (const e of upcoming) {
    const a = pick(rand, EVENT_ANGLES)(e, brand);
    ideas.push({
      ...a,
      prompt: `${e.label}: ${a.angle}`,
      eventId: e.id,
      eventLabel: e.label,
      eventDate: dateLabel(e.date),
      styleKind: "event",
    });
  }
  const product = products.length ? pick(rand, products) : null;
  if (product) ideas.push({ ...pick(rand, PRODUCT_ANGLES)(product), productId: product.id, styleKind: "product" });
  for (const fn of shuffle(rand, BRAND_ANGLES)) {
    if (ideas.length >= 4) break;
    const a = fn(brand);
    ideas.push({ ...a, styleKind: a.title.startsWith("The number") ? "number" : "brand" });
  }
  return ideas.slice(0, 4).map((idea, i) => ({
    id: `idea_${brand.id}_${round}_${i}`,
    title: idea.title,
    angle: idea.angle,
    prompt: idea.prompt,
    formatIds: pick(rand, FORMAT_SETS),
    styleId: styleFor(idea.styleKind),
    productId: idea.productId || null,
    eventId: idea.eventId || null,
    eventLabel: idea.eventLabel || null,
    eventDate: idea.eventDate || null,
    previewSeed: Math.floor(rand() * 2 ** 31),
  }));
}
