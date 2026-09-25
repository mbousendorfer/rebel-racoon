// Image Generator — mocked brandAnalysisService.
//
// Contract:
//   fromUrl(url, { onStep, signal }) → Promise<BrandDraft>
//   fromFiles(files, { onStep, signal }) → Promise<BrandDraft>
//   onStep({ id, label, status: "active"|"done", found? }) fires as each part is
//   "detected", so the UI can reveal the brand progressively.
//   BrandDraft: { brand: Brand (unsaved), assets: Asset[] (unsaved), confidence: {field: 0..1} }
//
// Deterministic: the same URL always yields the same brand, derived from a hash
// of its domain, so a demo can be replayed.

import { MOCK } from "../../config/mock.js?v=1225";
import { createAsset, createBrand } from "../../model/schema.js?v=1225";
import { hashString, pick, prng, shuffle } from "../../lib/prng.js?v=1225";
import { wait } from "../../lib/delegate.js?v=1225";
import { LOGO_MARKS, logoSvg } from "../../render/logo.js?v=1225";

export const ANALYSIS_STEPS = Object.freeze([
  { id: "fetch", label: "Reading your website" },
  { id: "logos", label: "Finding your logo" },
  { id: "palette", label: "Picking out your colours" },
  { id: "fonts", label: "Identifying your fonts" },
  { id: "voice", label: "Learning your tone of voice" },
  { id: "positioning", label: "Working out your positioning" },
]);

export const FILE_ANALYSIS_STEPS = Object.freeze([
  { id: "fetch", label: "Reading your files" },
  { id: "logos", label: "Isolating your logo" },
  { id: "palette", label: "Sampling your colours" },
  { id: "fonts", label: "Matching your fonts" },
  { id: "imagery", label: "Describing your imagery" },
]);

// Sector archetypes the mock "recognises" from words in the domain / file names.
const SECTORS = [
  {
    id: "coffee",
    keys: ["coffee", "cafe", "roast", "brew", "bean", "espresso"],
    sector: "Food & drink",
    hues: [24, 30, 18],
    moods: ["warm", "crafted", "morning light", "tactile"],
    tone: "Warm, unhurried and a little nerdy about the craft. We talk like the person behind the counter who remembers your order.",
    audience: "Home brewers and neighbourhood regulars, 25–45",
    values: ["Craft", "Traceability", "Hospitality"],
    valueProp: "Coffee roasted this week, for people who notice.",
    examples: [
      "This week's roast just came out of the drum. Smells like cocoa and a good Saturday.",
      "Grind it just before you brew — your cup will thank you.",
      "Meet the farmers behind our new Guji lot.",
    ],
    avoid: ["cheap", "best coffee in the world", "hacks"],
  },
  {
    id: "finance",
    keys: ["pay", "bank", "fin", "ledger", "money", "account", "invoice", "cash"],
    sector: "Financial software",
    hues: [226, 212, 170],
    moods: ["clear", "confident", "calm", "precise"],
    tone: "Clear, confident and calm. We explain money like a good accountant friend: no jargon, no hype.",
    audience: "Finance leads at 50–500 person companies",
    values: ["Clarity", "Control", "Trust"],
    valueProp: "Close the month in days, not weeks.",
    examples: [
      "Month-end shouldn't mean late nights. Here's how three teams got it down to two days.",
      "Every card, every receipt, one place.",
      "Budgets are plans. We help you keep them.",
    ],
    avoid: ["disrupt", "revolutionary", "guaranteed returns"],
  },
  {
    id: "lifestyle",
    keys: [],
    sector: "Consumer lifestyle",
    hues: [340, 12, 160, 48],
    moods: ["bright", "friendly", "fresh"],
    tone: "Friendly, upbeat and direct. Short sentences, real benefits.",
    audience: "Urban consumers, 20–40",
    values: ["Quality", "Simplicity", "Joy"],
    valueProp: "Everyday things, made better.",
    examples: [
      "Small upgrade, big difference.",
      "Made to be used every day — and loved every day.",
      "New in: the colour you've been asking for.",
    ],
    avoid: ["cheap", "best ever"],
  },
];

const HEADING_FONTS = ["Georgia", "Futura", "Avenir Next", "Didot", "Gill Sans", "Rockwell"];
const BODY_FONTS = ["Helvetica Neue", "Avenir", "Verdana", "Trebuchet MS"];

function hsl(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function detectSector(text) {
  const lower = text.toLowerCase();
  return SECTORS.find((s) => s.keys.some((k) => lower.includes(k))) || SECTORS[SECTORS.length - 1];
}

function nameFromDomain(url) {
  const host = String(url)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  const stem = host.split(".")[0] || "brand";
  return stem
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildDraft(seedText, name, url) {
  const rand = prng(hashString(seedText));
  const archetype = detectSector(seedText);
  const hue = pick(rand, archetype.hues);
  const palette = [
    { hex: hsl(hue, 62, 44), name: "Signature", role: "primary" },
    { hex: hsl((hue + 150) % 360, 34, 42), name: "Support", role: "secondary" },
    { hex: hsl((hue + 40) % 360, 86, 58), name: "Spark", role: "accent" },
    { hex: hsl(hue, 30, 96), name: "Paper", role: "background" },
    { hex: hsl(hue, 40, 14), name: "Ink", role: "text" },
  ];
  const fonts = [
    { family: pick(rand, HEADING_FONTS), role: "heading" },
    { family: pick(rand, BODY_FONTS), role: "body" },
  ];
  const brand = createBrand({
    name,
    websiteUrl: url || "",
    palette,
    fonts,
    imageStyle: { moods: shuffle(rand, archetype.moods).slice(0, 3), referenceAssetIds: [], preferredStyleIds: [] },
    voice: { tone: archetype.tone, examples: archetype.examples.slice(), avoid: archetype.avoid.slice() },
    positioning: {
      sector: archetype.sector,
      audience: archetype.audience,
      values: archetype.values.slice(),
      valueProp: archetype.valueProp,
    },
    rules: {
      dos: ["Keep generous space around the logo", "Use the background colour as the main field"],
      donts: ["Don't recolour the logo outside its variants", "Don't put text over busy areas"],
      logoMinPx: 48,
      clearSpace: 0.5,
      noLogoDistortion: true,
      forbiddenPairs: [[palette[2].hex, palette[3].hex]],
    },
  });
  brand.sectorKey = archetype.id;
  const mark = pick(rand, LOGO_MARKS);
  const spec = {
    name,
    mark,
    primary: palette[0].hex,
    text: palette[4].hex,
    background: palette[3].hex,
    font: fonts[0].family,
  };
  const assets = ["color", "white", "black", "icon"].map((variant) =>
    createAsset({
      brandId: brand.id,
      kind: "logo",
      name: `${name} logo — ${variant}`,
      mime: "image/svg+xml",
      svg: logoSvg({ ...spec, variant }),
      source: "generated",
    }),
  );
  brand.logos = assets.map((asset, i) => ({ variant: ["color", "white", "black", "icon"][i], assetId: asset.id }));
  const confidence = {
    logos: 0.9,
    palette: 0.82 + rand() * 0.1,
    fonts: 0.55 + rand() * 0.25,
    voice: 0.6 + rand() * 0.2,
    positioning: 0.5 + rand() * 0.3,
  };
  return { brand, assets, confidence };
}

async function runSteps(steps, draft, onStep, signal) {
  const [min, max] = MOCK.analysis.stepMs;
  for (const step of steps) {
    onStep?.({ ...step, status: "active" });
    await wait(min + Math.random() * (max - min), signal);
    onStep?.({ ...step, status: "done", found: foundFor(step.id, draft) });
  }
}

function foundFor(stepId, { brand, assets }) {
  switch (stepId) {
    case "logos":
      return { assets: assets.slice(0, 2) };
    case "palette":
      return { palette: brand.palette };
    case "fonts":
      return { fonts: brand.fonts };
    case "voice":
      return { text: brand.voice.tone };
    case "positioning":
      return { text: `${brand.positioning.sector} · ${brand.positioning.audience}` };
    case "imagery":
      return { tags: brand.imageStyle.moods };
    default:
      return null;
  }
}

export async function fromUrl(url, { onStep, signal } = {}) {
  const trimmed = String(url || "").trim();
  if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(trimmed)) {
    const error = new Error("That doesn't look like a website address.");
    error.code = "invalid_url";
    throw error;
  }
  const normalized = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const draft = buildDraft(normalized, nameFromDomain(normalized), normalized);
  await runSteps(ANALYSIS_STEPS, draft, onStep, signal);
  return draft;
}

export async function fromFiles(files, { onStep, signal } = {}) {
  const list = Array.from(files || []);
  if (!list.length) {
    const error = new Error("Add at least one file.");
    error.code = "no_files";
    throw error;
  }
  const seedText = list.map((file) => `${file.name}:${file.size}`).join("|");
  const first = list[0].name.replace(/\.[^.]+$/, "").replace(/[-_]?(logo|brand|final|v\d+)$/i, "");
  const draft = buildDraft(seedText, nameFromDomain(first || "My brand"), "");
  await runSteps(FILE_ANALYSIS_STEPS, draft, onStep, signal);
  return draft;
}
