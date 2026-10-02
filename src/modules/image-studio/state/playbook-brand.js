// Image Generator — the brand IS the Playbook. This adapter is the ONE file of
// the module that reads Archie's Playbooks: it turns a Context into the brand
// view every generator surface uses, resolves which Playbook is active, and
// knows the two doors back into Archie (the Playbook page, Playbook creation).
//
// The generator writes a Playbook in ONE case only: the style creator
// (/playbook/:id/styles/*), opened from the fiche's Brand section, saving the
// brand's own image styles (`imageStyles`). That is a deliberate edit, the only
// way a Playbook may change (CONCEPTS §1); the rest of the kit is edited on the
// Playbook page itself (src/playbook-brand-kit.js). Sub-brands don't exist: a variant
// is a duplicated Playbook (docs/reference/CONCEPTS.md §1).

import {
  getContextById,
  getContexts,
  subscribe as subscribeContexts,
  updateContext,
} from "../../../contexts-store.js?v=1431";
import { createStyle } from "../model/schema.js?v=1431";
import { canEdit, usableContexts } from "../../../playbook-access.js?v=1431";
import {
  getActivePlaybookId,
  isWorkspaceMode,
  playbookForNewWork,
  subscribe as subscribeActive,
} from "../../../active-playbook.js?v=1431";
import { storageService as storage } from "../services/index.js?v=1431";

// Which copy archetype the mocked copyService uses — guessed from the Playbook's words.
function sectorKeyOf(ctx) {
  const text = [ctx.name, ctx.brandName, ctx.businessSummary, ...(ctx.objective || [])].join(" ").toLowerCase();
  if (/coffee|café|cafe|roast|food|restaurant|bakery/.test(text)) return "coffee";
  if (/financ|bank|pay|invoice|saas|software|b2b|platform|tool|devrel|api|workspace/.test(text)) return "finance";
  return "lifestyle";
}

/** A Playbook, as the generator reads it. `null` for an unknown id. */
function toBrand(ctx) {
  if (!ctx) return null;
  const t = ctx.brandTypography || {};
  const vp = ctx.voiceProfile || {};
  return {
    id: ctx.id,
    // The name ON the visuals is the brand's; the Playbook's own name says which framing.
    name: ctx.brandName || ctx.name,
    playbookName: ctx.name,
    websiteUrl: ctx.websiteUrl || "",
    sectorKey: sectorKeyOf(ctx),
    logos: (ctx.brandLogos || []).map((l) => ({ id: l.id, label: l.label, url: l.url, variant: l.variant || "" })),
    defaultLogoUrl: ctx.brandLogo || "",
    palette: (ctx.brandColors || [])
      .filter((c) => c.hex)
      .map((c) => ({ hex: c.hex, name: c.name || "", role: c.role || "" })),
    fonts: [
      t.headingFont ? { family: t.headingFont, role: "heading" } : null,
      t.bodyFont ? { family: t.bodyFont, role: "body" } : null,
    ].filter(Boolean),
    personality: ctx.brandPersonality || "",
    imageStyle: {
      moods: (ctx.brandMoods || []).slice(),
      // Not `imageDefaults` nor the loose `referenceImages`: both serve the old
      // Image Studio. The brand's look is its own styles (imageStyles).
    },
    voice: {
      tone: [vp.headline, ...(ctx.tones || [])].filter(Boolean).join(" · "),
      examples: [...(ctx.signatureHooks || []), ...(ctx.closingPatterns || [])].filter(Boolean).slice(0, 5),
      avoid: (ctx.voiceAvoid || []).slice(),
      dos: (ctx.doRules || []).slice(),
      donts: (ctx.dontRules || []).slice(),
    },
    positioning: {
      summary: ctx.businessSummary || "",
      audience: (ctx.audience || []).join(", "),
      objectives: (ctx.objective || []).slice(),
      values: [],
    },
    rules: {
      visualDos: [],
      visualDonts: [],
      logoMinPx: 48,
      clearSpace: 0.5,
      noLogoDistortion: true,
      forbiddenPairs: [],
      ...(ctx.brandRules || {}),
    },
  };
}

export function getBrand(id) {
  return toBrand(getContextById(id));
}

/**
 * The Playbook the generator works for. In workspace mode it is THE active
 * Playbook (the rail's switcher is the only control, and it is always visible).
 * Otherwise it is the generator's own pick, remembered in its storage, falling
 * back to the Playbook new work goes to.
 */
export function getActiveBrandId() {
  const usable = new Set(usableContexts().map((c) => c.id));
  if (isWorkspaceMode()) {
    const id = getActivePlaybookId();
    return usable.has(id) ? id : null;
  }
  const picked = storage.getMeta().activePlaybookId;
  if (picked && usable.has(picked)) return picked;
  const fallback = playbookForNewWork()?.id;
  return usable.has(fallback) ? fallback : usableContexts()[0]?.id || null;
}

export function canEditBrand(id) {
  const ctx = getContextById(id);
  return !!ctx && canEdit(ctx);
}

// ── The brand's own image styles — a field of the Playbook (imageStyles) ─────
// The style creator is the only writer, and a deliberate edit, like the rest
// of the fiche. The generator turns each into a full style (createStyle).

/** The Playbook's own styles, as the generator uses them. */
export function getPlaybookStyles(id) {
  const ctx = getContextById(id);
  return (ctx?.imageStyles || []).map((s) => createStyle({ ...s, brandId: id }));
}

/** A custom style by id, whichever Playbook holds it (a creation remembers only the id). */
export function findPlaybookStyle(styleId) {
  for (const ctx of getContexts()) {
    const hit = (ctx.imageStyles || []).find((s) => s.id === styleId);
    if (hit) return createStyle({ ...hit, brandId: ctx.id });
  }
  return null;
}

/** Adds or replaces one style on the Playbook. */
export function savePlaybookStyle(id, style) {
  const ctx = getContextById(id);
  if (!ctx || !canEdit(ctx)) return null;
  const { brandId: _b, ...stored } = style;
  const list = ctx.imageStyles || [];
  const next = list.some((s) => s.id === style.id)
    ? list.map((s) => (s.id === style.id ? stored : s))
    : [...list, stored];
  updateContext(id, { imageStyles: next, updatedAt: "just now" });
  return createStyle({ ...stored, brandId: id });
}

export function deletePlaybookStyle(id, styleId) {
  const ctx = getContextById(id);
  if (!ctx || !canEdit(ctx)) return false;
  updateContext(id, { imageStyles: (ctx.imageStyles || []).filter((s) => s.id !== styleId), updatedAt: "just now" });
  return true;
}

/** Repaint when a Playbook changes or the active one does. */
export function subscribeBrands(fn) {
  const a = subscribeContexts(fn);
  const b = subscribeActive(fn);
  return () => {
    a();
    b();
  };
}

// "Use the Playbook" off: the same brand id (its styles and history stay
// its own) but none of its identity — no logo, a neutral palette, the default
// fonts, no moods or words to avoid. Colours are CONTENT here, not chrome.
const NEUTRAL_PALETTE = [
  { hex: "#2B2F36", name: "Graphite", role: "primary" },
  { hex: "#C8A27A", name: "Sand", role: "accent" },
  { hex: "#F4F1EC", name: "Paper", role: "background" },
  { hex: "#8A94A6", name: "Slate", role: "secondary" },
  { hex: "#1C1E22", name: "Ink", role: "text" },
];

export function unbranded(brand) {
  if (!brand) return brand;
  return {
    ...brand,
    unbranded: true,
    logos: [],
    defaultLogoUrl: "",
    palette: NEUTRAL_PALETTE.map((c) => ({ ...c })),
    fonts: [],
    personality: "",
    imageStyle: { moods: [], references: [] },
    voice: { ...brand.voice, avoid: [], dos: [], donts: [] },
    rules: { ...brand.rules, visualDos: [], visualDonts: [], forbiddenPairs: [] },
  };
}
