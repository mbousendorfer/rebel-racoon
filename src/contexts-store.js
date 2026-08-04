// Contexts store — single source of truth for the global contexts list.
//
// Calqued sur connectors-store.js (FIND-01 pattern). Plusieurs surfaces lisent
// les contexts (dashboard New chat dropdown, session Context tab, settings
// drawer Contexts tab) et il faut pouvoir muter (memorize → save as global,
// rename via in-session edit) avec propagation. L'array est seedé une fois
// depuis mocks.contexts ; chaque mutation notifie tous les subscribers.
//
// Public API:
//   getContexts()                → Context[]   (snapshot)
//   getContextById(id)           → Context | null
//   addContext(ctx)              → Context     (assigns id if missing, notifies)
//   updateContext(id, patch)     → Context | null   (deep-ish merge for voice/brief/brand subobjects)
//   subscribe(fn)                → unsubscribe
//
// Note: addContext is also used by the wizard memorize step when the user
// chooses "Save as global". updateContext is used by the section-edit flow
// when scope is "Update everywhere".

import { contexts as seed } from "./mocks.js?v=63";
import { isNewUser } from "./user-mode.js?v=23";
import { createNotifier } from "./store-utils.js?v=2";
import { DEFAULT_ENABLED_IDS, DEFAULT_CADENCE, findTopicSource, findCadence } from "./topics-catalog.js?v=2";
import {
  normalizeLanguages,
  mirrorPrimaryToTopLevel,
  syncTopLevelToPrimary,
  cloneVoiceByLanguage,
} from "./languages.js?v=2";

// Lives up here, away from normalizeBrandLogos where it belongs, because the
// seed below calls that normalizer at module-init time — a `let` declared beside
// the function would still be in its temporal dead zone when the seed runs.
let brandLogoSeq = 0;

// Lot 15 — first-time user mode starts empty so the standalone /contexts
// page renders its empty state. Returning user keeps the mock seed. Every
// seed is upgraded to the multilingual shape (languages/primaryLanguage/
// voiceByLanguage) lazily via normalizeLanguages — legacy single-language
// mocks keep rendering identically.
// Seeds bypass addContext, so anything addContext normalises has to be applied
// here too — `topics` included, or a seeded Playbook with no topics config at
// all would render the section against `undefined`.
const contexts = isNewUser()
  ? []
  : seed.map((c) => normalizeLanguages({ ...c, topics: normalizeTopics(c.topics), ...normalizeBrandLogos(c) }));
const notifier = createNotifier("contexts-store");

export const subscribe = notifier.subscribe;
const notify = () => notifier.notify(getContexts());

function freshId() {
  // Stable-enough id for the proto: "ctx-" + base36 timestamp + random suffix.
  return `ctx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Competitors carry a nested socials array, so a shallow copy isn't enough —
// clone both levels and stamp an id on entries that arrive without one (the
// mock analysis and the mocks seed them without).
let competitorSeq = 0;
function normalizeCompetitors(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => ({
    ...c,
    id: c.id || `cmp-${(competitorSeq += 1)}`,
    name: c.name || "",
    description: c.description || "",
    websiteUrl: c.websiteUrl || "",
    logo: c.logo || "",
    socials: Array.isArray(c.socials) ? c.socials.map((s) => ({ ...s })) : [],
  }));
}

// Brand logos — a SET of marks with one resolved default.
//
// A site scrape finds several: the header lockup, the reversed one from the
// footer, the square icon, the favicon. They're all legitimately "the logo", so
// storing one string would mean throwing three away and asking the user to
// re-upload the one they actually wanted.
//
// `brandLogos` is the set; `brandLogo` stays the DEFAULT'S URL rather than
// becoming an id or a getter. Two reasons: everything downstream (the Playbook
// header, the studio's stamp, `branding-view`'s preview) already reads
// `brandLogo` and needs no change, and `snapshotEditable` JSON-round-trips the
// data, which would flatten a getter. The invariant this enforces is that
// `brandLogo` is always one of the set's urls, or "" when the set is empty.
// (`brandLogoSeq` is declared at the top of the file — see the note there.)
function normalizeBrandLogos(ctx) {
  const list = (Array.isArray(ctx.brandLogos) ? ctx.brandLogos : [])
    .filter((l) => l && l.url)
    .map((l) => ({ id: l.id || `logo-${(brandLogoSeq += 1)}`, label: l.label || "Logo", url: l.url }));
  // A context that only ever carried the single `brandLogo` (the mocks, an
  // older payload) becomes a one-entry set rather than losing its mark.
  if (!list.length && ctx.brandLogo) {
    list.push({ id: `logo-${(brandLogoSeq += 1)}`, label: "Logo", url: ctx.brandLogo });
  }
  const urls = list.map((l) => l.url);
  return {
    brandLogos: list,
    brandLogo: urls.includes(ctx.brandLogo) ? ctx.brandLogo : urls[0] || "",
  };
}

// Topics config — which listening sources this Playbook has switched on, and
// how often I refresh them. One cadence for the whole Playbook, not one per
// source. The catalog (names, icons, descriptions) is config and lives in
// topics-catalog.js; only the user's choices are stored here.
function normalizeTopics(t) {
  const src = t && typeof t === "object" ? t : {};
  const enabled = Array.isArray(src.enabledSourceIds) ? src.enabledSourceIds.slice() : DEFAULT_ENABLED_IDS.slice();
  return {
    // Keep only ids the catalog still knows about, so a removed source can't
    // linger in a seeded Playbook and count towards an enabled total.
    enabledSourceIds: enabled.filter((id) => !!findTopicSource(id)),
    cadence: findCadence(src.cadence) ? src.cadence : DEFAULT_CADENCE,
  };
}

export function getContexts() {
  return contexts.slice();
}

export function getContextById(id) {
  return contexts.find((c) => c.id === id) || null;
}

// The playbook a fresh chat starts with — the one flagged isDefault, else
// the first available. Returns null only when there are no playbooks at all.
export function getDefaultContext() {
  return contexts.find((c) => c.isDefault) || contexts[0] || null;
}

/**
 * Add a new global context to the store. Q2 hybrid shape — flat editable
 * fields (color, brandName, audience, briefSummary, tones, doRules,
 * dontRules, cta, usedIn) sit at the top level. The analytical sub-object
 * (analysis: {voice, brief, brand}) is preserved for the legacy accessors
 * the rest of the app reads.
 *
 * @param {object} ctx — partial Context, fields not provided default to
 *   sensible empties so the editor can render without nulls.
 * @returns {Context}
 */
export function addContext(ctx = {}) {
  // audience used to be a free-text string; the V1 brief builder makes it
  // a multi-pick array. Accept either shape so seeds and existing code
  // paths keep working (string → wrap in single-element array).
  const audienceVal = Array.isArray(ctx.audience)
    ? ctx.audience.slice()
    : typeof ctx.audience === "string" && ctx.audience.length > 0
      ? [ctx.audience]
      : [];
  const next = {
    id: ctx.id || freshId(),
    name: ctx.name || "Untitled playbook",
    color: ctx.color || "orange",
    isDefault: ctx.isDefault === true,
    // — legacy fields (kept for backwards compatibility with seeds + the
    //   ContextForm read mode) —
    brandName: ctx.brandName || "",
    briefSummary: ctx.briefSummary || "",
    doRules: Array.isArray(ctx.doRules) ? ctx.doRules.slice() : [],
    dontRules: Array.isArray(ctx.dontRules) ? ctx.dontRules.slice() : [],
    cta: ctx.cta || "",
    // — V1 brief-builder fields —
    websiteUrl: ctx.websiteUrl || "",
    sourceType: ctx.sourceType || null,
    sourceUrl: ctx.sourceUrl || ctx.websiteUrl || "",
    sourceFile: ctx.sourceFile || null,
    sourcePlatform: ctx.sourcePlatform || null,
    businessSummary: ctx.businessSummary || ctx.briefSummary || "",
    audience: audienceVal,
    audienceProblems: Array.isArray(ctx.audienceProblems) ? ctx.audienceProblems.slice() : [],
    tones: Array.isArray(ctx.tones) ? ctx.tones.slice() : [],
    voiceProfile: ctx.voiceProfile && typeof ctx.voiceProfile === "object" ? { ...ctx.voiceProfile } : null,
    contentStyle: Array.isArray(ctx.contentStyle) ? ctx.contentStyle.slice() : [],
    objective: Array.isArray(ctx.objective) ? ctx.objective.slice() : [],
    contentAction: Array.isArray(ctx.contentAction) ? ctx.contentAction.slice() : [],
    ctaLinks: Array.isArray(ctx.ctaLinks) ? ctx.ctaLinks.map((l) => ({ ...l })) : [],
    // — multilingual model (see languages.js) — flat `language` kept as a
    //   transitional mirror of primaryLanguage.
    language: ctx.language || "English",
    languages: Array.isArray(ctx.languages) ? ctx.languages.slice() : undefined,
    primaryLanguage: ctx.primaryLanguage || undefined,
    voiceByLanguage: ctx.voiceByLanguage ? cloneVoiceByLanguage(ctx.voiceByLanguage) : undefined,
    connectedSocials: Array.isArray(ctx.connectedSocials) ? ctx.connectedSocials.slice() : [],
    selectedProfileId: ctx.selectedProfileId || null,
    imageVoice:
      ctx.imageVoice && Array.isArray(ctx.imageVoice.websites)
        ? { websites: ctx.imageVoice.websites.map((w) => ({ ...w })) }
        : { websites: [] },
    // — 3-section model: voice & style + brand identity —
    signatureHooks: Array.isArray(ctx.signatureHooks) ? ctx.signatureHooks.slice() : [],
    closingPatterns: Array.isArray(ctx.closingPatterns) ? ctx.closingPatterns.slice() : [],
    formattingStyle: ctx.formattingStyle || "",
    visualStyle: ctx.visualStyle || "",
    voiceMode: ctx.voiceMode === "manual" ? "manual" : "guided",
    voiceManual: ctx.voiceManual || "",
    brandPersonality: ctx.brandPersonality || "",
    brandTypography: ctx.brandTypography && typeof ctx.brandTypography === "object" ? { ...ctx.brandTypography } : null,
    brandColors: Array.isArray(ctx.brandColors) ? ctx.brandColors.map((c) => ({ ...c })) : [],
    // The brand marks + which one is the default (see normalizeBrandLogos).
    // Optional — a Playbook can have a voice and an audience without anyone
    // having supplied a logo, and the surfaces that use it have to say so rather
    // than stamp a placeholder.
    ...normalizeBrandLogos(ctx),
    referenceImages: Array.isArray(ctx.referenceImages)
      ? ctx.referenceImages.map((i) => ({ ...i, networks: Array.isArray(i.networks) ? [...i.networks] : [] }))
      : [],
    // — competitors (name / description / website / social profiles / logo) —
    //   `suggested: true` = still a pending proposal from Archie, not yet part
    //   of the Playbook. dismissedCompetitors holds the keys of the ones the
    //   user rejected so discovery never re-proposes them.
    competitors: normalizeCompetitors(ctx.competitors),
    dismissedCompetitors: Array.isArray(ctx.dismissedCompetitors) ? ctx.dismissedCompetitors.slice() : [],
    // — topics (which listening sources are on + how often I refresh them) —
    //   Always present, even while the `topics` flag is OFF: the config rides
    //   along in the data like competitors do, only the surfaces are gated.
    topics: normalizeTopics(ctx.topics),
    // — meta —
    usedIn: typeof ctx.usedIn === "number" ? ctx.usedIn : 0,
    updatedAt: ctx.updatedAt || "just now",
    analysis: ctx.analysis || { voice: null, brief: null, brand: null },
  };
  // Fill the multilingual structure (languages/primaryLanguage/voiceByLanguage)
  // then push the primary entry down onto the flat legacy fields. Safe here:
  // at construction the primary entry either came from the caller's
  // voiceByLanguage or was seeded from the flat fields — mirroring is idempotent.
  normalizeLanguages(next);
  mirrorPrimaryToTopLevel(next);
  // Re-attach the legacy voice/brief/brand getters so old call sites stay
  // working on freshly-added contexts too.
  Object.defineProperty(next, "voice", { get: () => next.analysis?.voice, enumerable: true });
  Object.defineProperty(next, "brief", { get: () => next.analysis?.brief, enumerable: true });
  Object.defineProperty(next, "brand", { get: () => next.analysis?.brand, enumerable: true });
  contexts.push(next);
  notify();
  return next;
}

/**
 * Patch a context. Top-level fields are replaced; analysis is replaced
 * wholesale (not deep-merged) to keep the model simple. Both old keys
 * (voice/brief/brand) and new keys (color, brandName, audience,
 * briefSummary, tones, doRules, dontRules, cta, isDefault, usedIn) are
 * accepted so the migration path stays open for legacy consumers.
 *
 * @param {string} id
 * @param {object} patch
 * @returns {Context | null}
 */
export function updateContext(id, patch) {
  const c = contexts.find((x) => x.id === id);
  if (!c) return null;
  // New flat editable fields
  if (patch.name !== undefined) c.name = patch.name;
  if (patch.color !== undefined) c.color = patch.color;
  if (patch.isDefault !== undefined) c.isDefault = patch.isDefault;
  if (patch.brandName !== undefined) c.brandName = patch.brandName;
  if (patch.audience !== undefined) c.audience = patch.audience;
  if (patch.briefSummary !== undefined) c.briefSummary = patch.briefSummary;
  if (patch.tones !== undefined) c.tones = patch.tones;
  if (patch.voiceProfile !== undefined) c.voiceProfile = patch.voiceProfile;
  if (patch.doRules !== undefined) c.doRules = patch.doRules;
  if (patch.dontRules !== undefined) c.dontRules = patch.dontRules;
  if (patch.cta !== undefined) c.cta = patch.cta;
  // V1 brief-builder fields
  if (patch.websiteUrl !== undefined) c.websiteUrl = patch.websiteUrl;
  if (patch.sourceType !== undefined) c.sourceType = patch.sourceType;
  if (patch.sourceUrl !== undefined) c.sourceUrl = patch.sourceUrl;
  if (patch.sourceFile !== undefined) c.sourceFile = patch.sourceFile;
  if (patch.sourcePlatform !== undefined) c.sourcePlatform = patch.sourcePlatform;
  if (patch.businessSummary !== undefined) c.businessSummary = patch.businessSummary;
  if (patch.audienceProblems !== undefined) c.audienceProblems = patch.audienceProblems;
  if (patch.contentStyle !== undefined) c.contentStyle = patch.contentStyle;
  if (patch.objective !== undefined) c.objective = patch.objective;
  if (patch.contentAction !== undefined) c.contentAction = patch.contentAction;
  if (patch.ctaLinks !== undefined) c.ctaLinks = patch.ctaLinks;
  if (patch.imageVoice !== undefined) c.imageVoice = patch.imageVoice;
  if (patch.signatureHooks !== undefined) c.signatureHooks = patch.signatureHooks;
  if (patch.closingPatterns !== undefined) c.closingPatterns = patch.closingPatterns;
  if (patch.formattingStyle !== undefined) c.formattingStyle = patch.formattingStyle;
  if (patch.visualStyle !== undefined) c.visualStyle = patch.visualStyle;
  if (patch.voiceMode !== undefined) c.voiceMode = patch.voiceMode;
  if (patch.voiceManual !== undefined) c.voiceManual = patch.voiceManual;
  if (patch.brandPersonality !== undefined) c.brandPersonality = patch.brandPersonality;
  if (patch.brandTypography !== undefined) c.brandTypography = patch.brandTypography;
  if (patch.brandColors !== undefined) c.brandColors = patch.brandColors;
  // The set and its default are one fact, so they re-normalize together even
  // when only one of them is patched — otherwise a patch that drops the default
  // logo from the set would leave `brandLogo` pointing at a mark that's gone.
  if (patch.brandLogos !== undefined || patch.brandLogo !== undefined) {
    Object.assign(
      c,
      normalizeBrandLogos({
        brandLogos: patch.brandLogos !== undefined ? patch.brandLogos : c.brandLogos,
        brandLogo: patch.brandLogo !== undefined ? patch.brandLogo : c.brandLogo,
      }),
    );
  }
  if (patch.referenceImages !== undefined) c.referenceImages = patch.referenceImages;
  if (patch.competitors !== undefined) c.competitors = normalizeCompetitors(patch.competitors);
  if (patch.dismissedCompetitors !== undefined)
    c.dismissedCompetitors = Array.isArray(patch.dismissedCompetitors) ? patch.dismissedCompetitors.slice() : [];
  if (patch.topics !== undefined) c.topics = normalizeTopics(patch.topics);
  // — multilingual fields —
  if (patch.languages !== undefined)
    c.languages = Array.isArray(patch.languages) ? patch.languages.slice() : patch.languages;
  if (patch.primaryLanguage !== undefined) c.primaryLanguage = patch.primaryLanguage;
  if (patch.voiceByLanguage !== undefined) c.voiceByLanguage = cloneVoiceByLanguage(patch.voiceByLanguage);
  // Transitional single-language patch — map onto primaryLanguage + languages.
  if (patch.language !== undefined) {
    c.language = patch.language;
    c.primaryLanguage = patch.language;
    const rest = Array.isArray(c.languages) ? c.languages.filter((l) => l !== patch.language) : [];
    c.languages = [patch.language, ...rest];
  }
  if (patch.connectedSocials !== undefined) c.connectedSocials = patch.connectedSocials;
  if (patch.selectedProfileId !== undefined) c.selectedProfileId = patch.selectedProfileId;
  if (patch.usedIn !== undefined) c.usedIn = patch.usedIn;
  if (patch.updatedAt !== undefined) c.updatedAt = patch.updatedAt;
  // Legacy + analysis sub-object
  if (patch.analysis !== undefined) c.analysis = patch.analysis;
  if (patch.voice !== undefined) c.analysis = { ...(c.analysis || {}), voice: patch.voice };
  if (patch.brief !== undefined) c.analysis = { ...(c.analysis || {}), brief: patch.brief };
  if (patch.brand !== undefined) c.analysis = { ...(c.analysis || {}), brand: patch.brand };

  // Keep the per-language voice map and the flat legacy mirror in sync.
  const touchedLangStruct =
    patch.languages !== undefined ||
    patch.primaryLanguage !== undefined ||
    patch.voiceByLanguage !== undefined ||
    patch.language !== undefined;
  const touchedFlatVoice =
    patch.signatureHooks !== undefined ||
    patch.closingPatterns !== undefined ||
    patch.cta !== undefined ||
    patch.ctaLinks !== undefined;
  if (touchedLangStruct) {
    // voiceByLanguage / primaryLanguage are authoritative → refresh flat mirror.
    normalizeLanguages(c);
    mirrorPrimaryToTopLevel(c);
  } else if (touchedFlatVoice) {
    // Legacy caller edited the flat fields → push them into the primary entry.
    normalizeLanguages(c);
    syncTopLevelToPrimary(c);
  }

  notify();
  return c;
}

/**
 * Duplicate a context — clones every editable field, resets usedIn /
 * isDefault, marks the name as "(copy)". Returns the new context.
 */
export function duplicateContext(id) {
  const src = contexts.find((c) => c.id === id);
  if (!src) return null;
  return addContext({
    name: `${src.name} (copy)`,
    color: src.color,
    brandName: src.brandName,
    audience: src.audience,
    briefSummary: src.briefSummary,
    tones: (src.tones || []).slice(),
    doRules: (src.doRules || []).slice(),
    dontRules: (src.dontRules || []).slice(),
    cta: src.cta,
    languages: Array.isArray(src.languages) ? src.languages.slice() : undefined,
    primaryLanguage: src.primaryLanguage || undefined,
    voiceByLanguage: src.voiceByLanguage ? cloneVoiceByLanguage(src.voiceByLanguage) : undefined,
    signatureHooks: (src.signatureHooks || []).slice(),
    closingPatterns: (src.closingPatterns || []).slice(),
    formattingStyle: src.formattingStyle || "",
    visualStyle: src.visualStyle || "",
    brandPersonality: src.brandPersonality || "",
    brandTypography: src.brandTypography ? { ...src.brandTypography } : null,
    brandColors: (src.brandColors || []).map((c) => ({ ...c })),
    brandLogos: (src.brandLogos || []).map((l) => ({ ...l })),
    brandLogo: src.brandLogo || "",
    referenceImages: (src.referenceImages || []).map((i) => ({
      ...i,
      networks: Array.isArray(i.networks) ? [...i.networks] : [],
    })),
    topics: src.topics ? { ...src.topics, enabledSourceIds: (src.topics.enabledSourceIds || []).slice() } : undefined,
    isDefault: false,
    usedIn: 0,
    analysis: src.analysis ? { ...src.analysis } : { voice: null, brief: null, brand: null },
  });
}

/**
 * Delete a context. Refuses to delete the last remaining one — every chat
 * needs a context to point at. Returns true on success.
 */
export function deleteContext(id) {
  if (contexts.length <= 1) return false;
  const idx = contexts.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  contexts.splice(idx, 1);
  notify();
  return true;
}
