// Image Generator — the brand IS the Playbook. This adapter is the ONE file of
// the module that reads Archie's Playbooks: it turns a Context into the brand
// view every generator surface uses, resolves which Playbook is active, and
// knows the two doors back into Archie (the Playbook page, Playbook creation).
//
// The generator never writes a Playbook. Editing the brand happens on the
// Playbook page (/playbook/:id), where the brand kit rows live (flag
// sexySquirrel — src/playbook-brand-kit.js). Sub-brands don't exist: a variant
// is a duplicated Playbook (docs/reference/CONCEPTS.md §1).

import { getContextById, subscribe as subscribeContexts } from "../../../contexts-store.js?v=1227";
import { canEdit, usableContexts } from "../../../playbook-access.js?v=1227";
import {
  getActivePlaybookId,
  isWorkspaceMode,
  playbookForNewWork,
  setActivePlaybook,
  subscribe as subscribeActive,
} from "../../../active-playbook.js?v=1227";
import { setHandoff } from "../../../handoff.js?v=1227";
import { navigate } from "../../../router.js?v=1227";
import { storageService as storage } from "../services/index.js?v=1227";

// Which copy archetype the mocked copyService uses — guessed from the Playbook's words.
function sectorKeyOf(ctx) {
  const text = [ctx.name, ctx.brandName, ctx.businessSummary, ...(ctx.objective || [])].join(" ").toLowerCase();
  if (/coffee|café|cafe|roast|food|restaurant|bakery/.test(text)) return "coffee";
  if (/financ|bank|pay|invoice|saas|software|b2b|platform|tool|devrel|api|workspace/.test(text)) return "finance";
  return "lifestyle";
}

/** A Playbook, as the generator reads it. `null` for an unknown id. */
export function toBrand(ctx) {
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
      references: (ctx.referenceImages || []).map((r) => ({ id: r.id, label: r.label, url: r.url })),
      defaults: { ...(ctx.imageDefaults || {}) },
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

export function getBrands() {
  return usableContexts().map(toBrand);
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

export function getActiveBrand() {
  const id = getActiveBrandId();
  return id ? getBrand(id) : null;
}

export function setActiveBrand(id) {
  if (isWorkspaceMode()) setActivePlaybook(id);
  else storage.setMeta({ activePlaybookId: id });
}

/** True when the brand picker is the generator's own (no rail switcher to defer to). */
export function hasOwnBrandPicker() {
  return !isWorkspaceMode();
}

export function canEditBrand(id) {
  const ctx = getContextById(id);
  return !!ctx && canEdit(ctx);
}

export function playbookPath(id) {
  return `/playbook/${encodeURIComponent(id)}`;
}

/** Opens Archie's Playbook creation (URL · files · by hand) and comes back here. */
export function startPlaybookCreation(returnTo = "/image-generator") {
  // Remember what existed, so the Playbook created in between is adopted on return.
  storage.setMeta({ pendingCreationFrom: usableContexts().map((c) => c.id) });
  try {
    window.sessionStorage.setItem("welcomeAltIntegrated", "1");
    window.sessionStorage.setItem("welcomeAltReturnTo", returnTo);
  } catch {
    /* ignore */
  }
  setHandoff("pendingStartContextBuilder", { flow: "alt", prefilledUrl: "", returnTo });
  navigate(`/session/welcome-alt-${Date.now().toString(36)}`);
}

/**
 * Coming back from Playbook creation: the Playbook that didn't exist before
 * becomes the active brand — that's what the user created it for. Cancelled
 * creation (nothing new) just clears the marker.
 */
export function adoptCreatedPlaybook() {
  const before = storage.getMeta().pendingCreationFrom;
  if (!Array.isArray(before)) return;
  const created = usableContexts().find((c) => !before.includes(c.id));
  storage.setMeta({ pendingCreationFrom: null });
  if (created) setActiveBrand(created.id);
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
