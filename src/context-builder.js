// Playbook creation's draft and its moves.
//
// Playbook CREATION is the first-time run (screens/welcome-alt-*.js): the
// source (a website read in the background, files, an interview or by hand),
// the account the voice is learned from, then the reveal and the reviews of the
// editable recap (playbook-view). `save()` persists the draft into the
// contexts-store. The chat onboarding that came first was deleted with the
// flag connectFirst (2026-10-29).
//
// State per "session" (a synthetic id, the run's) is the draft: { websiteUrl,
// name, businessSummary, audience, audienceProblems, tones, contentStyle,
// objective, contentAction, ctaLinks, language, color, suggestions, editingId,
// onComplete }.

import { addContext, updateContext, getContextById } from "./contexts-store.js?v=2481";
import { isWorkspaceMode, setActivePlaybook } from "./active-playbook.js?v=2481";
import {
  analyzeWebsite,
  analyzeSocialProfiles,
  analyzeDocument,
  analyzeBrandFiles,
  analyzeInterview,
} from "./context-mock-analysis.js?v=2481";
import { cloneItems, withNetworkVoices, networkVoiceOn } from "./voice-parts.js?v=2481";
import { markIntroSeen } from "./components/voice-intro-modal.js?v=2481";
import { getConnectedProfiles, getConnectedProfileById } from "./social-profiles.js?v=2481";
import { cloneVoiceByLanguage, DEFAULT_LANGUAGE } from "./languages.js?v=2481";
import { isFlagOn } from "./feature-flags.js?v=2481";

const drafts = new Map(); // sessionId → draft
const subscribers = new Map(); // sessionId → Set<fn>

function notify(sessionId) {
  const set = subscribers.get(sessionId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn();
    } catch (err) {
      console.warn("[context-builder] subscriber threw", err);
    }
  }
}

function emptyDraft(overrides = {}) {
  return {
    websiteUrl: "",
    name: "",
    businessSummary: "",
    audience: [],
    audienceProblems: [],
    tones: [],
    contentStyle: [],
    objective: [],
    contentAction: [],
    ctaLinks: [], // Array<{ label, url, checked, suggested }>
    language: "English",
    color: "orange",
    voiceProfile: null,
    // Voice profile — the five parts (voice-parts.js).
    signatureHooks: [],
    closingPatterns: [],
    voiceSummary: "",
    voiceAlways: [],
    voiceNever: [],
    voiceByPost: [],
    voiceSometimes: [],
    voiceMode: "guided", // "guided" (structured fields) | "manual" (free-form)
    voiceManual: "",
    // Brand — author-editable identity (seeded from the scraped site on first edit).
    brandPersonality: "",
    brandTypography: null, // { headingFont, bodyFont }
    brandColors: [], // Array<{ name, hex }>
    brandLogos: [], // Array<{ id, label, url }> — every mark found or uploaded
    brandLogo: "", // the DEFAULT's url (one of brandLogos, "" = none)
    // The brand's default look for generated images — { imageType, style, refMode },
    // "" on each = no preference. See contexts-store#normalizeImageDefaults.
    imageDefaults: { imageType: "", style: "", refMode: "" },
    referenceImages: [], // Array<{ id, label, url, note?, networks? }> — note/networks = optional usage guidance
    // Brand kit — see contexts-store#normalizeBrandKit.
    voiceAvoid: [],
    brandRules: null,
    // Competitors — Array<{ id, name, description, websiteUrl, socials:[{network,url}], logo?, suggested? }>.
    // Pre-filled from the website analysis, each flagged `suggested: true` =
    // a PENDING proposal the user still has to accept in the Playbook's
    // Competitors section. dismissedCompetitors keeps the keys of the rejected
    // ones so discovery never proposes them again.
    competitors: [],
    dismissedCompetitors: [],
    // Influencers — same shape as competitors, for the creators this brand's
    // audience already follows. No pending state: what the analysis finds is
    // added directly, as on the beta.
    influencers: [],
    sourceType: null, // "website" | "documents" | "social" | "manual" | "interview"
    interview: [], // the no-website answers: Array<{ topic, question, answer, skipped?, followUp? }>
    sourceUrl: "",
    sourceFile: null,
    sourcePlatform: null,
    connectedSocials: [],
    selectedProfileId: null,
    imageVoice: { websites: [] },
    suggestions: {
      audience: [],
      audienceProblems: [],
      tones: [],
      contentStyle: [],
      objective: [],
      contentAction: [],
      ctaLinks: [],
    },
    customAdditions: {
      audience: [],
      audienceProblems: [],
      tones: [],
      contentStyle: [],
      objective: [],
      contentAction: [],
    },
    editingId: null,
    onComplete: null,
    ...overrides,
  };
}

// Repaint hook for surfaces that show a draft as it fills (the onboarding
// screens). Returns the unsubscribe.
export function subscribeDraft(sessionId, fn) {
  if (!subscribers.has(sessionId)) subscribers.set(sessionId, new Set());
  subscribers.get(sessionId).add(fn);
  return () => subscribers.get(sessionId)?.delete(fn);
}

export function getDraft(sessionId) {
  return drafts.get(sessionId) || null;
}

// Map an analysis result onto the section fields of a Playbook/draft, WITHOUT
// touching identity (name) or chrome. Shared by the onboarding draft fill
// (applyAnalysisToDraft) and the saved-Playbook "Auto-fill" overwrite on the
// detail page (screens/playbook.js). Returns a plain patch object.
// The scraped logo candidates → { brandLogos, brandLogo }. Kept beside the
// analysis mapper rather than inside it so the shape stays one line up there.
function logoPatchFromAnalysis(s) {
  const found = s?.imageVoice?.websites?.[0]?.images?.logos;
  const list = (Array.isArray(found) ? found : [])
    .filter((l) => l && l.url)
    .map((l, i) => ({ id: `site-logo-${i}`, label: l.label || "Logo", url: l.url }));
  return { brandLogos: list, brandLogo: list[0]?.url || "" };
}

// The brand's default LOOK, guessed from the site's personality. Tone picks the
// family, energy picks the member — deliberately small, because a website's
// personality genuinely constrains "photographic vs graphic" and "quiet vs loud"
// and nothing finer than that.
//
// Only `style` is derived. `imageType` answers what THIS post should show and
// `refMode` describes the use of a reference image the analysis never picked —
// guessing either would be the retired grid-brief mistake (named fields, invented).
// An unrecognised tone yields "" rather than a fallback preset: putting a claim on
// the fiche that nothing supports is worse than leaving it on "Any".
const LOOK_FAMILY = {
  professional: "graphic",
  "operator-first": "graphic",
  direct: "graphic",
  "evidence-led": "graphic",
  authoritative: "graphic",
  warm: "warm",
  friendly: "warm",
  playful: "warm",
  human: "warm",
};
const LOOK_BY_ENERGY = {
  graphic: { calm: "corporate", medium: "tech-minimal", high: "bold-editorial" },
  warm: { calm: "photoreal", medium: "photoreal", high: "hand-drawn" },
};
function energyBand(e) {
  const v = String(e || "").toLowerCase();
  if (v === "calm" || v === "low") return "calm";
  if (v === "high" || v === "medium-high") return "high";
  return "medium";
}
// NOT part of sectionPatchFromAnalysis, on purpose: that patch is also what
// "Re-analyze website" applies to an EXISTING fiche, and since only `style` is
// derived it would blank a hand-picked image type and reference mode with nothing
// to put in their place. The pre-fill belongs to the path that CREATES a Playbook.
export function imageDefaultsFromAnalysis(analysis) {
  const p = (analysis && analysis.suggestions)?.imageVoice?.websites?.[0]?.personality || {};
  const fam = LOOK_FAMILY[String(p.tone || "").toLowerCase()];
  return { imageType: "", style: fam ? LOOK_BY_ENERGY[fam][energyBand(p.energy)] : "", refMode: "" };
}

export function sectionPatchFromAnalysis(analysis) {
  const s = (analysis && analysis.suggestions) || {};
  return {
    businessSummary: analysis?.businessSummary || "",
    briefSummary: analysis?.businessSummary || "", // legacy mirror
    // Primary audience is single-select (the user picks one from Archie's
    // analysed list in the recap), so pre-select only the top suggestion —
    // the full list stays available via `suggestions.audience` for the picker.
    audience: (s.audience || []).slice(0, 1),
    audienceProblems: (s.audienceProblems || []).slice(),
    tones: (s.tones || []).slice(),
    contentStyle: (s.contentStyle || []).slice(),
    objective: (s.objective || []).slice(),
    contentAction: (s.contentAction || []).slice(),
    ctaLinks: (s.ctaLinks || []).map((l) => ({ ...l })),
    language: s.language || "English",
    voiceProfile: s.voiceProfile ? { ...s.voiceProfile } : null,
    imageVoice: s.imageVoice || { websites: [] },
    voiceSummary: s.voiceSummary || "",
    voiceAlways: cloneItems(s.voiceAlways),
    voiceNever: cloneItems(s.voiceNever),
    voiceByPost: cloneItems(s.voiceByPost),
    voiceSometimes: cloneItems(s.voiceSometimes),
    // A fresh analysis always produces structured voice — reset to guided.
    voiceMode: "guided",
    voiceManual: "",
    brandPersonality: s.brandPersonality || "",
    brandTypography: s.brandTypography ? { ...s.brandTypography } : null,
    brandColors: (s.brandColors || []).map((c) => ({ ...c })),
    // Brand kit — only when the analysis has an opinion, so "Re-analyze website"
    // never blanks banned words someone typed.
    ...(Array.isArray(s.voiceAvoid) ? { voiceAvoid: s.voiceAvoid.slice() } : {}),
    // Marks the crawl turned up (imageVoice.websites[0].images.logos). The
    // first becomes the default; the user re-picks in the Brand section.
    ...logoPatchFromAnalysis(s),
    // Competitors Archie found on the brand's market. Flagged `suggested`, so
    // they arrive as PENDING proposals in the Competitors section rather than
    // as Playbook entries — the user accepts the ones that matter.
    competitors: (s.competitors || []).map((c) => ({
      ...c,
      socials: Array.isArray(c.socials) ? c.socials.map((x) => ({ ...x })) : [],
      suggested: true,
    })),
    // No influencers: the analysis cannot propose creators (Google's grounding
    // terms forbid keeping them), so the section opens on its empty state.
  };
}

// Shared draft patch — applied by the First Time User ALT flow (`startAlt`)
// after the website analysis lands. Pre-selects every suggested value so the
// recap reads as "Archie's best guess, edit if anything's off".
function applyAnalysisToDraft(d, analysis) {
  d.name = d.name || analysis.name;
  d.suggestions = analysis.suggestions;
  d.color = analysis.suggestions.color || "orange";
  Object.assign(d, sectionPatchFromAnalysis(analysis));
  d.imageDefaults = imageDefaultsFromAnalysis(analysis);
  // The voice source picked after the website wins over what the source said.
  if (d.voiceSource) applyVoiceSource(d);
}

// Prod's « How should I learn your voice? », asked right after the website
// (2026-10-29, asked: « Oui, comme en prod »): a connected profile's posts, a
// document the user wrote, or their own words used as written — or null, the
// voice read from the source. Picked before the read lands, it waits for it
// (applyAnalysisToDraft); after, it lands now.
//   { kind: "profile", id } | { kind: "document", name } | { kind: "custom", text }
export function setAltVoiceSource(sessionId, source) {
  const d = drafts.get(sessionId);
  if (!d) return;
  d.voiceSource = source || null;
  d.voiceLearnedFrom = "";
  if (d.voiceSource && isAnalysisReady(sessionId)) applyVoiceSource(d);
  notify(sessionId);
}

function applyVoiceSource(d) {
  const src = d.voiceSource;
  if (src.kind === "custom") {
    Object.assign(d, { voiceMode: "manual", voiceManual: src.text, voiceLearnedFrom: "your words" });
    return;
  }
  const profile = src.kind === "profile" ? getConnectedProfileById(src.id) : null;
  if (src.kind === "profile" && !profile) return;
  const s = (profile ? analyzeSocialProfiles([profile.id]) : analyzeDocument({ name: src.name })).suggestions;
  Object.assign(d, {
    voiceMode: "guided",
    voiceSummary: s.voiceSummary || "",
    voiceAlways: cloneItems(s.voiceAlways),
    voiceNever: cloneItems(s.voiceNever),
    voiceByPost: cloneItems(s.voiceByPost),
    voiceSometimes: cloneItems(s.voiceSometimes),
    voiceLearnedFrom: profile ? `the posts of ${profile.handle.replace(/\.$/, "")}` : src.name,
  });
}

// Patch the draft from outside the conversational flow — used by the
// welcome-alt recap to edit Playbook fields without going through
// inlineQuestion.
export function patchDraft(sessionId, patch) {
  const d = drafts.get(sessionId);
  if (!d) return null;
  Object.assign(d, patch);
  notify(sessionId);
  return d;
}

// Re-seed a draft from a persisted snapshot (e.g. the welcome-alt recap
// rehydrating itself after a page reload, where the in-memory Map is
// empty). Replaces any existing draft for the session wholesale.
export function restoreDraft(sessionId, draft) {
  if (!draft) return null;
  drafts.set(sessionId, draft);
  notify(sessionId);
  return draft;
}

// True once the website analysis has populated the draft. The welcome-alt
// recap screen polls this to decide between "Analyzing…" and "Show
// the Playbook".
export function isAnalysisReady(sessionId) {
  const d = drafts.get(sessionId);
  if (!d) return false;
  // "Fill it in myself" never waits for an analysis — the empty fiche IS the form.
  if (d.sourceType === "manual") return true;
  return Boolean(d.businessSummary || (d.tones && d.tones.length));
}

// ── The onboarding's moves ───────────────────────────────────────────────
// Each step's effect on the draft, for the run's screens
// (screens/welcome-alt-*.js). The chat onboarding they replaced was deleted
// with the flag connectFirst (2026-10-29).

export function createAltDraft(sessionId, { onComplete = null, prefilledUrl = "" } = {}) {
  const url = (prefilledUrl || "").trim();
  drafts.set(sessionId, emptyDraft({ onComplete, sourceType: "website", websiteUrl: url, sourceUrl: url }));
  // The accounts already connected are the ones the Playbook publishes from.
  syncAltProfiles(sessionId);
  notify(sessionId);
  return drafts.get(sessionId);
}

// Take the connected accounts as the Playbook's, as they stand now. The first
// one is the selected profile: a Playbook still names ONE identity.
function syncAltProfiles(sessionId) {
  const d = drafts.get(sessionId);
  const profiles = getConnectedProfiles();
  if (d && profiles.length) {
    d.selectedProfileId = profiles[0].id;
    d.connectedSocials = profiles.map((p) => p.platform);
  }
  notify(sessionId);
}

// Read a website: the analysis runs in the background while the next steps are
// answered, and lands on the draft when it's done.
export function readAltWebsite(sessionId, url) {
  const d = drafts.get(sessionId);
  if (!d) return;
  Object.assign(d, {
    sourceType: "website",
    sourceUrl: (url || "").trim(),
    websiteUrl: (url || "").trim(),
    sourceFile: null,
    interview: [],
    analysisStartedAt: Date.now(),
  });
  notify(sessionId);
  window.setTimeout(() => {
    const dd = drafts.get(sessionId);
    if (!dd || dd.sourceType !== "website") return;
    applyAnalysisToDraft(dd, analyzeWebsite(dd.sourceUrl || dd.websiteUrl));
    notify(sessionId);
  }, 6000);
}

// Read brand files ({ name, url } data URLs): same background analysis.
export function readAltFiles(sessionId, list) {
  const d = drafts.get(sessionId);
  if (!d || !list?.length) return;
  Object.assign(d, {
    sourceType: "documents",
    sourceFile: list[0].name,
    sourceUrl: "",
    websiteUrl: "",
    analysisStartedAt: Date.now(),
  });
  notify(sessionId);
  window.setTimeout(() => {
    const dd = drafts.get(sessionId);
    if (!dd || dd.sourceType !== "documents") return;
    applyAnalysisToDraft(dd, analyzeBrandFiles(list));
    // Every file is a reference; the first one is taken as the logo.
    dd.referenceImages = list.map((f, i) => ({ id: `ref-file-${i}`, label: f.name, url: f.url }));
    notify(sessionId);
  }, 4000);
}

// No analysis: the empty fiche is the form.
export function writeAltManually(sessionId) {
  const d = drafts.get(sessionId);
  if (!d) return;
  Object.assign(d, { sourceType: "manual", sourceUrl: "", websiteUrl: "", name: d.name || "New Playbook" });
  notify(sessionId);
}

// The interview's answers → the Playbook, in the background.
export function analyzeAltInterview(sessionId, interview) {
  const d = drafts.get(sessionId);
  if (!d) return;
  Object.assign(d, {
    sourceType: "interview",
    sourceUrl: "",
    websiteUrl: "",
    sourceFile: null,
    interview,
    analysisStartedAt: Date.now(),
  });
  notify(sessionId);
  window.setTimeout(() => {
    const dd = drafts.get(sessionId);
    if (dd?.sourceType !== "interview") return;
    applyAnalysisToDraft(dd, analyzeInterview(dd.interview));
    notify(sessionId);
  }, 4000);
}

// The onboarding steps before the account and the reveal, in order, under the
// flags of the moment: `multilingualPlaybook` inserts a language step after the
// URL, `connectors` the documents. The screens' order derives from this list
// (welcome-alt-shell.js flowSteps).
export function altSteps() {
  const steps = ["url"];
  if (isFlagOn("multilingualPlaybook")) steps.push("language");
  // The documents step offers connectors: it waits for their flag (2026-10-29).
  if (isFlagOn("connectors")) steps.push("documents");
  return steps;
}

export function save(sessionId) {
  const d = drafts.get(sessionId);
  if (!d) return;
  const name = (d.name || "").trim();
  if (!name) return; // Save button is disabled in this state; defensive.
  // A new user never knew the app without network voices: no intro to show them (voice-intro-modal.js).
  if (!d.editingId && networkVoiceOn()) markIntroSeen();
  const payload = {
    name,
    color: d.color,
    websiteUrl: d.websiteUrl,
    sourceType: d.sourceType || null,
    sourceUrl: d.sourceUrl || d.websiteUrl || "",
    sourceFile: d.sourceFile || null,
    sourcePlatform: d.sourcePlatform || null,
    connectedSocials: Array.isArray(d.connectedSocials) ? d.connectedSocials.slice() : [],
    selectedProfileId: d.selectedProfileId || null,
    businessSummary: d.businessSummary,
    briefSummary: d.businessSummary, // mirror to legacy field for backwards-read compat
    audience: d.audience,
    audienceProblems: d.audienceProblems,
    tones: d.tones,
    contentStyle: d.contentStyle,
    objective: d.objective,
    contentAction: d.contentAction,
    ctaLinks: d.ctaLinks.filter((l) => l.checked),
    cta: d.ctaLinks.find((l) => l.checked)?.url || "",
    voiceProfile: d.voiceProfile || null,
    imageVoice: d.imageVoice && Array.isArray(d.imageVoice.websites) ? d.imageVoice : { websites: [] },
    // The voice, five parts (voice-parts.js).
    signatureHooks: Array.isArray(d.signatureHooks) ? d.signatureHooks.filter((s) => (s || "").trim()) : [],
    closingPatterns: Array.isArray(d.closingPatterns) ? d.closingPatterns.filter((s) => (s || "").trim()) : [],
    voiceSummary: d.voiceSummary || "",
    voiceMode: d.voiceMode || "guided",
    voiceManual: d.voiceManual || "",
    voiceAlways: cloneItems(d.voiceAlways),
    voiceNever: cloneItems(d.voiceNever),
    voiceByPost: cloneItems(d.voiceByPost),
    voiceSometimes: cloneItems(d.voiceSometimes),
    // A NEW Playbook: each network it publishes on keeps what the review gave
    // it — rules learned from the account's posts, added there, or the default
    // voice kept. One left unanswered gets nothing, so its first draft asks
    // (flag voicePerNetwork — stored either way, shown under the flag).
    // Re-saving an existing one never rewrites them.
    // The run's voice review (`voiceRulesFor` set) learns nothing behind the
    // user's back: what it gave each network is what is saved.
    ...(!d.editingId && { voiceByNetwork: d.voiceRulesFor ? { ...(d.voiceByNetwork || {}) } : withNetworkVoices(d) }),
    brandPersonality: d.brandPersonality || "",
    brandTypography: d.brandTypography ? { ...d.brandTypography } : null,
    brandColors: Array.isArray(d.brandColors) ? d.brandColors.map((c) => ({ ...c })) : [],
    brandLogos: Array.isArray(d.brandLogos) ? d.brandLogos.map((l) => ({ ...l })) : [],
    brandLogo: d.brandLogo || "",
    imageDefaults: { ...(d.imageDefaults || {}) },
    // A ready-made look picked on the recap (playbook-view's Branding tab).
    defaultLook: d.defaultLook ? { ...d.defaultLook } : undefined,
    voiceAvoid: Array.isArray(d.voiceAvoid) ? d.voiceAvoid.slice() : [],
    brandRules: d.brandRules ? structuredClone(d.brandRules) : null,
    referenceImages: Array.isArray(d.referenceImages)
      ? d.referenceImages.map((i) => ({ ...i, networks: Array.isArray(i.networks) ? [...i.networks] : [] }))
      : [],
    // Competitors survive the save with their pending flag — an unaccepted
    // suggestion stays pending on the saved Playbook rather than being dropped
    // or silently adopted. The store deep-copies socials and stamps missing ids.
    competitors: Array.isArray(d.competitors)
      ? d.competitors.map((c) => ({ ...c, socials: Array.isArray(c.socials) ? c.socials.map((s) => ({ ...s })) : [] }))
      : [],
    dismissedCompetitors: Array.isArray(d.dismissedCompetitors) ? d.dismissedCompetitors.slice() : [],
    influencers: Array.isArray(d.influencers)
      ? d.influencers.map((c) => ({ ...c, socials: Array.isArray(c.socials) ? c.socials.map((s) => ({ ...s })) : [] }))
      : [],
    updatedAt: "just now",
  };

  // Multilingual model — context-builder edits a single (primary) language's
  // voice. Preserve any secondary-language voice already saved on the context
  // and write the edited hooks/closings into the primary entry. The store
  // re-derives the flat mirror (signatureHooks/closingPatterns/cta) from here.
  const primaryLanguage = d.primaryLanguage || d.language || DEFAULT_LANGUAGE;
  const existing = d.editingId ? getContextById(d.editingId) : null;
  // Merge the existing context's voice (preserve secondary languages on edit)
  // with the draft's own voiceByLanguage — the latter holds this session's
  // per-language edits (and the primary entry the recap seeded from analysis).
  const baseVbl = {
    ...(existing && existing.voiceByLanguage && typeof existing.voiceByLanguage === "object"
      ? cloneVoiceByLanguage(existing.voiceByLanguage)
      : {}),
    ...(d.voiceByLanguage && typeof d.voiceByLanguage === "object" ? cloneVoiceByLanguage(d.voiceByLanguage) : {}),
  };
  // Languages come from the draft first (the onboarding language step / edits),
  // then any already saved on the context, else just the primary. addContext /
  // updateContext normalize this and fill empty voice entries per language.
  const draftLangs = Array.isArray(d.languages) && d.languages.length ? d.languages.slice() : null;
  const languages =
    draftLangs ||
    (Array.isArray(existing?.languages) && existing.languages.length ? existing.languages.slice() : [primaryLanguage]);
  // Only seed the primary entry from the flat analysis fields when there's no
  // per-language entry at all — never overwrite an entry the user edited (which
  // would resurrect hooks they deleted).
  if (!baseVbl[primaryLanguage]) {
    baseVbl[primaryLanguage] = {
      signatureHooks: payload.signatureHooks.slice(),
      closingPatterns: payload.closingPatterns.slice(),
      cta: "",
      ctaLabels: {},
    };
  }
  // Drop empty lines from every language entry.
  Object.values(baseVbl).forEach((e) => {
    if (Array.isArray(e.signatureHooks)) e.signatureHooks = e.signatureHooks.filter((s) => (s || "").trim());
    if (Array.isArray(e.closingPatterns)) e.closingPatterns = e.closingPatterns.filter((s) => (s || "").trim());
  });
  payload.languages = languages.includes(primaryLanguage) ? languages : [primaryLanguage, ...languages];
  payload.primaryLanguage = primaryLanguage;
  payload.voiceByLanguage = baseVbl;

  const saved = d.editingId ? updateContext(d.editingId, payload) : addContext(payload);
  // A brand you just created is the brand you are in. Only on creation: editing
  // the fiche you are already scoped to must not re-point the app, and editing
  // another one from /contexts is not a request to switch.
  if (!d.editingId && isWorkspaceMode() && saved) setActivePlaybook(saved.id);
  const onComplete = d.onComplete;
  drafts.delete(sessionId);
  notify(sessionId);
  if (onComplete) onComplete(saved);
  return saved;
}

// "Create a Playbook" from a screen of the app shell: the same run as a
// first-time user's, straight to the brand (the intro and the demo are for the
// first time); the recap hands back to `returnTo`.
export function openNewPlaybookFlow(returnTo) {
  window.location.hash = `#/welcome-alt/brand?new=${encodeURIComponent(returnTo || "/")}`;
}
