// Image Generator — the module's data model: factories, validation, inheritance.
// Shapes are documented in docs/audits/image-studio-integration.md §4. Nothing
// here maps to an Archie object: a Brand is not a Playbook, by decision.

import { uid, nowIso } from "../lib/id.js?v=1225";

export const SCHEMA_VERSION = 1;

export const COLOR_ROLES = Object.freeze([
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "accent", label: "Accent only" },
  { id: "background", label: "Background" },
  { id: "text", label: "Text" },
]);

export const FONT_ROLES = Object.freeze([
  { id: "heading", label: "Headings" },
  { id: "body", label: "Body text" },
]);

export const LOGO_VARIANTS = Object.freeze([
  { id: "color", label: "Colour" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "icon", label: "Icon only" },
]);

export const TEXT_MODES = Object.freeze([
  { id: "layer", label: "Editable layer" },
  { id: "embedded", label: "Built into the image" },
]);

export const LAYER_TYPES = Object.freeze(["image", "text", "logo", "shape", "asset"]);

/** The Brand fields a sub-brand can inherit or override, one by one. */
export const BRAND_FIELDS = Object.freeze(["logos", "palette", "fonts", "imageStyle", "voice", "positioning", "rules"]);

// ── Factories ────────────────────────────────────────────────────────────────

export function createBrand(partial = {}) {
  const at = nowIso();
  return {
    id: uid("br"),
    parentId: null,
    name: "Untitled brand",
    websiteUrl: "",
    // Which copy archetype the mock services use (coffee / finance / lifestyle).
    sectorKey: "lifestyle",
    isDefault: false,
    overriddenFields: [],
    logos: [],
    palette: [],
    fonts: [],
    imageStyle: { moods: [], referenceAssetIds: [], preferredStyleIds: [] },
    voice: { tone: "", examples: [], avoid: [] },
    positioning: { sector: "", audience: "", values: [], valueProp: "" },
    rules: { dos: [], donts: [], logoMinPx: 48, clearSpace: 0.5, noLogoDistortion: true, forbiddenPairs: [] },
    createdAt: at,
    updatedAt: at,
    ...partial,
  };
}

export function createStyle(partial = {}) {
  const at = nowIso();
  return {
    id: uid("st"),
    brandId: null,
    kind: "custom",
    family: "custom",
    label: "Untitled style",
    description: "",
    promptTemplate: "",
    supportsEmbeddedText: false,
    render: { generator: "blend", variant: "custom" },
    custom: { sources: [], fidelity: "essential", stylePrompt: "" },
    createdAt: at,
    updatedAt: at,
    ...partial,
  };
}

export function createProduct(partial = {}) {
  const at = nowIso();
  return {
    id: uid("pr"),
    brandId: null,
    name: "",
    description: "",
    url: "",
    imageAssetId: null,
    shotAssetIds: [],
    createdAt: at,
    updatedAt: at,
    ...partial,
  };
}

export function createCampaign(partial = {}) {
  const at = nowIso();
  return {
    id: uid("cp"),
    brandId: null,
    title: "",
    objective: "",
    angle: "",
    eventId: null,
    start: null,
    end: null,
    creationIds: [],
    createdAt: at,
    updatedAt: at,
    ...partial,
  };
}

export function createLayer(type, partial = {}) {
  return {
    id: uid("ly"),
    type,
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.2,
    rotation: 0,
    z: 0,
    hidden: false,
    locked: false,
    props: {},
    ...partial,
  };
}

export function createVariation(seed, partial = {}) {
  return { id: uid("va"), seed, ...partial };
}

export function createCreation(partial = {}) {
  const at = nowIso();
  return {
    id: uid("cr"),
    brandId: null,
    campaignId: null,
    title: "",
    brief: { prompt: "", styleId: null, productId: null, formatIds: [], textMode: "layer", ideaId: null },
    variations: [],
    selectedVariationId: null,
    master: { formatId: null, layers: [] },
    adaptations: [],
    copy: { hooks: [], ctas: [], captions: {} },
    favorite: false,
    history: [],
    checks: null,
    createdAt: at,
    updatedAt: at,
    ...partial,
  };
}

export function createAsset(partial = {}) {
  return {
    id: uid("as"),
    brandId: null,
    kind: "image",
    name: "",
    mime: "image/png",
    width: 0,
    height: 0,
    // Exactly one of these carries the pixels: an IndexedDB blob, or inline SVG
    // markup (seeded logos and product shots are drawn, not uploaded).
    blobKey: null,
    svg: null,
    source: "upload",
    favorite: false,
    createdAt: nowIso(),
    ...partial,
  };
}

export function historyEntry(action, detail = "") {
  return { at: nowIso(), action, detail };
}

// ── Inheritance ──────────────────────────────────────────────────────────────

/**
 * A sub-brand stores only what it overrides. resolveBrand() returns the brand as
 * it should be USED: every field it didn't override comes from its parent
 * (recursively), and `inherited` lists which ones did.
 */
export function resolveBrand(brand, getBrandById, seen = new Set()) {
  if (!brand) return null;
  if (!brand.parentId || seen.has(brand.id)) return { ...brand, inherited: [] };
  seen.add(brand.id);
  const parent = resolveBrand(getBrandById(brand.parentId), getBrandById, seen);
  if (!parent) return { ...brand, inherited: [] };
  const resolved = { ...brand, inherited: [] };
  for (const field of BRAND_FIELDS) {
    if (!brand.overriddenFields.includes(field)) {
      resolved[field] = structuredClone(parent[field]);
      resolved.inherited.push(field);
    }
  }
  return resolved;
}

// ── Palette helpers ──────────────────────────────────────────────────────────

export function colorByRole(brand, role) {
  return brand?.palette?.find((c) => c.role === role)?.hex || null;
}

export function fontByRole(brand, role) {
  return brand?.fonts?.find((f) => f.role === role)?.family || null;
}

// ── Validation ───────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;

/** Returns a list of { field, message } — empty when the brand can be saved. */
export function validateBrand(brand) {
  const errors = [];
  if (!brand.name?.trim()) errors.push({ field: "name", message: "Give the brand a name." });
  for (const color of brand.palette || []) {
    if (!HEX.test(color.hex)) errors.push({ field: "palette", message: `${color.hex} isn't a valid hex colour.` });
  }
  const examples = brand.voice?.examples?.filter((t) => t.trim()) || [];
  if (examples.length > 5) errors.push({ field: "voice", message: "Keep 3 to 5 examples." });
  return errors;
}

export function isHex(value) {
  return HEX.test(value);
}
