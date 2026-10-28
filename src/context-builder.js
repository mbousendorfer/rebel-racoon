// Conversational context-builder orchestrator.
//
// Playbook CREATION is the First Time User ALT flow (`startAlt`): a 3-question
// chat (URL → profile → optional documents) that kicks off a mock website
// analysis, then reveals the editable recap (see playbook-view + the
// welcome-alt-recap / integrated New-Playbook wrappers). `save()` persists the
// draft into the contexts-store. The older brief-builder (a "Website /
// Documents" source picker → right-panel brief form) was removed once the ALT
// flow became the single creation path.
//
// State per "session" (a synthetic id when invoked outside a real chat) is the
// draft: { websiteUrl, name, businessSummary, audience, audienceProblems,
// tones, contentStyle, objective, contentAction, ctaLinks, language, color,
// suggestions, editingId, onComplete }.

import * as inlineQuestion from "./inline-question.js?v=2274";
import { connectableNetworkCards, accountIdsForNetwork } from "./connect-profiles-flow.js?v=2274";
import { open as openConnectAccountModal } from "./components/connect-account-modal.js?v=2274";
import { open as openSkipConnectModal } from "./components/skip-connect-modal.js?v=2274";
import { showToast } from "./components/toast.js?v=2274";
import { recordReasons } from "./feedback-store.js?v=2274";
import { postAssistantMessage, postUserTurn, postUserProfilesTurn } from "./assistant.js?v=2274";
import { addContext, updateContext, getContextById } from "./contexts-store.js?v=2274";
import { isWorkspaceMode, setActivePlaybook } from "./active-playbook.js?v=2274";
import {
  analyzeWebsite,
  analyzeBrandFiles,
  analyzeInterview,
  nextInterviewQuestion,
  INTERVIEW_OPENING,
} from "./context-mock-analysis.js?v=2274";
import { open as openConfirmModal } from "./components/confirm-modal.js?v=2274";
import { cloneItems, withNetworkVoices, networkVoiceOn } from "./voice-parts.js?v=2274";
import { markIntroSeen } from "./components/voice-intro-modal.js?v=2274";
import { connectors as connectorMocks } from "./mocks.js?v=2274";
import {
  getConnectedProfiles,
  buildConnectedProfileItems,
  PROFILE_SEARCH_THRESHOLD,
} from "./social-profiles.js?v=2274";
import { cloneVoiceByLanguage, LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "./languages.js?v=2274";
import { isFlagOn } from "./feature-flags.js?v=2274";
import { startDemo } from "./demo-flow.js?v=2274";
import { navigate } from "./router.js?v=2274";
import { setHandoff } from "./handoff.js?v=2274";

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
// screens under flag connectFirst). Returns the unsubscribe.
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

// First Time User ALT — a 3-question onboarding (URL → profiles →
// documents) rendered as inline-questions inside a chat with
// body.onboarding chrome. The website analysis kicks off in
// the background as soon as the URL lands, so by the time the user
// finishes the documents step the brief panel can open immediately.
//
// `prefilledUrl` represents an URL collected by an earlier step that
// lives outside the prototype — the chat surface uses it to pre-populate
// the URL question card so the user just confirms instead of typing.
export function startAlt(sessionId, { onComplete, prefilledUrl = "" } = {}) {
  createAltDraft(sessionId, { onComplete, prefilledUrl });
  askAltUrl(sessionId, (prefilledUrl || "").trim());
}

// ── The onboarding's moves, without the chat ─────────────────────────────
// Each step's effect on the draft, shared by the chat above and by the
// dedicated onboarding screens (flag connectFirst, screens/welcome-alt-*.js):
// one implementation, two hosts.

export function createAltDraft(sessionId, { onComplete = null, prefilledUrl = "" } = {}) {
  const url = (prefilledUrl || "").trim();
  drafts.set(sessionId, emptyDraft({ onComplete, sourceType: "website", websiteUrl: url, sourceUrl: url }));
  // The accounts already connected are the ones the Playbook publishes from.
  syncAltProfiles(sessionId);
  notify(sessionId);
  return drafts.get(sessionId);
}

// Take the connected accounts as the Playbook's, as they stand now.
export function syncAltProfiles(sessionId) {
  commitAltProfiles(sessionId, getConnectedProfiles(), { echo: false });
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

// The onboarding steps, in order, as they exist under the current flags — the
// single place that knows which questions the flow asks. `multilingualPlaybook`
// inserts a language step after the URL. The account step is a choice (a Skip),
// and when nothing is connected it offers to connect rather than listing
// profiles that don't exist. Skipping is not a dead end: the chat flows that
// draft FOR an account ask again at the moment it is needed
// (connect-profiles-flow.js).
// Labels are derived from this list, so adding or removing a step renumbers the
// rest for free.
// Exported for the intro screen (/welcome-alt/intro), which announces them.
export function altSteps() {
  const steps = ["url"];
  if (isFlagOn("multilingualPlaybook")) steps.push("language");
  // Flag connectFirst: the accounts are asked on the screen before the chat.
  if (!isFlagOn("connectFirst")) steps.push("profile");
  steps.push("documents");
  return steps;
}
function altTotalSteps() {
  return altSteps().length;
}
function altStepLabel(stepId) {
  return `${altSteps().indexOf(stepId) + 1} / ${altTotalSteps()}`;
}
// Walk to the step before `stepId`, whichever ones are present under the flags.
function askAltPrevious(sessionId, stepId) {
  const steps = altSteps();
  const prev = steps[steps.indexOf(stepId) - 1];
  const d = drafts.get(sessionId);
  if (prev === "language") askAltLanguage(sessionId);
  else if (prev === "profile") askAltProfile(sessionId);
  else if (prev === "documents") askAltDocuments(sessionId);
  // After the interview, Back leaves it (as in prod); keeping the answers puts
  // this step back.
  else if (d?.sourceType === "interview")
    leaveInterview(sessionId, () =>
      stepId === "language" ? askAltLanguage(sessionId) : askAltProfile(sessionId, { announce: false }),
    );
  else askAltUrl(sessionId, d?.sourceUrl || d?.websiteUrl || "");
}
// The step after the URL question — the language picker when multilingual is
// on, otherwise the account step.
function askAltAfterUrl(sessionId) {
  if (isFlagOn("multilingualPlaybook")) askAltLanguage(sessionId);
  else askAltProfile(sessionId);
}

// The first step offers two more ways in beside
// the URL — from files (logo, past visuals, photos → a mocked analysis) and by
// hand (no analysis; the empty fiche is the form). Same step, same count: only
// its answers change, so every later step is untouched.
const ALT_START_ITEMS = [
  {
    value: "files",
    label: "Start from files instead",
    caption: "Your logo, past visuals, or photos",
    icon: "ap-icon-upload",
  },
  {
    value: "manual",
    label: "Fill it in myself",
    caption: "Write the Playbook yourself, part by part",
    icon: "ap-icon-pen",
  },
];

// Prod's content-studio-playbook-no-website (baked in 2026-10-16): a way in for
// a brand with no site to read — I interview the user instead.
const ALT_NO_WEBSITE_ITEM = {
  value: "noWebsite",
  label: "I don't have a website",
  caption: "Answer a few quick questions instead",
  icon: "ap-icon-single-chat-bubble",
};

// Flag demoMode: try me on a made-up brand before setting up your own
// (demo-flow.js). Leaves the onboarding for the demo chat.
const ALT_DEMO_ITEM = {
  value: "demo",
  label: "Try it with a demo brand",
  caption: "Bramble & Bean, a coffee roaster I made up — nothing gets posted",
  icon: "ap-icon-play",
};

// The no-website interview, in place of the URL question (same step, same
// number). One question at a time, picked from the answers so far by
// nextInterviewQuestion; each answered question joins the thread as Archie's
// line + the user's answer. When the answers can carry a brief, the Playbook is
// written from them in the background and the flow moves on to the account.
function startAltInterview(sessionId) {
  const d = drafts.get(sessionId);
  if (!d) return;
  Object.assign(d, { sourceType: "interview", sourceUrl: "", websiteUrl: "", sourceFile: null, interview: [] });
  postUserTurn(sessionId, ALT_NO_WEBSITE_ITEM.label);
  postAssistantMessage(sessionId, "No problem. I'll ask you a few quick questions instead. Answer in your own words.");
  inlineQuestion.exit(sessionId);
  notify(sessionId);
  askAltInterview(sessionId, nextInterviewQuestion([]));
}

// The Skip label says when Skip unlocks: the core questions carry the brief.
function interviewSkipLabel(step) {
  if (step.optional) return "Skip this question";
  if (step.coreLeft <= 1) return "Skip available after this question";
  return `Skip available in ${step.coreLeft} questions`;
}

function askAltInterview(sessionId, step) {
  const d = drafts.get(sessionId);
  if (!d) return;
  if (step.done) {
    finishAltInterview(sessionId);
    return;
  }
  const record = (turn, echo) => {
    const dd = drafts.get(sessionId);
    if (!dd) return;
    dd.interview = [...dd.interview, { topic: step.topic, question: step.question, ...turn }];
    postAssistantMessage(sessionId, step.question);
    postUserTurn(sessionId, echo);
    inlineQuestion.exit(sessionId);
    notify(sessionId);
    // Prod asks a model for the next question: a beat of "thinking" first.
    inlineQuestion.ask(sessionId, {
      title: "Thinking about the next question…",
      stepLabel: altStepLabel("url"),
      items: [],
      loading: true,
    });
    window.setTimeout(() => {
      const now = drafts.get(sessionId);
      if (now?.sourceType === "interview") askAltInterview(sessionId, nextInterviewQuestion(now.interview));
    }, 900);
  };
  inlineQuestion.ask(sessionId, {
    title: step.question,
    stepLabel: altStepLabel("url"),
    items: [],
    customPlaceholder: "Type your answer…",
    onCustom: (value) => {
      const answer = (value || "").trim();
      if (!answer) return askAltInterview(sessionId, step);
      record({ answer, ...(step.followUp ? { followUp: true } : {}) }, answer);
    },
    skipLabel: interviewSkipLabel(step),
    skipDisabled: !step.optional,
    onSkip: () => record({ answer: "", skipped: true }, "Skipped"),
    onBack: () => leaveInterview(sessionId, () => askAltInterview(sessionId, step)),
  });
}

function finishAltInterview(sessionId) {
  postAssistantMessage(sessionId, "Thanks, that's what I needed. I'm putting your answers together while we finish.");
  // Same background timing as the files analysis: the brief is ready by the
  // time the remaining steps are done.
  analyzeAltInterview(sessionId, drafts.get(sessionId)?.interview || []);
  askAltAfterUrl(sessionId);
}

// Back to "How do you want to start?" drops the answers — confirmed first when
// there are some. `stay` puts the current step back.
function leaveInterview(sessionId, stay) {
  const reset = () => {
    const d = drafts.get(sessionId);
    if (d) Object.assign(d, { sourceType: "website", interview: [] });
    askAltUrl(sessionId, "");
  };
  if (!drafts.get(sessionId)?.interview?.length) return reset();
  openConfirmModal({
    title: "Discard your answers?",
    body: "Going back to the website question drops the answers you gave me.",
    confirmLabel: "Discard",
    cancelLabel: "Keep my answers",
    danger: true,
    onConfirm: reset,
    onCancel: stay,
  });
}

function startAltFromFiles(sessionId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return; // cancelled — the question stays open
    const read = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, url: reader.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }),
    );
    Promise.all(read).then((loaded) => {
      const list = loaded.filter(Boolean);
      if (!drafts.get(sessionId) || !list.length) return;
      postUserTurn(sessionId, `${list.length} ${list.length === 1 ? "file" : "files"} added`);
      inlineQuestion.exit(sessionId);
      // Same background timing as the website analysis, for the same reason.
      readAltFiles(sessionId, list);
      askAltAfterUrl(sessionId);
    });
  });
  input.click();
}

function startAltManually(sessionId) {
  if (!drafts.get(sessionId)) return;
  postUserTurn(sessionId, "I'll fill it in myself");
  inlineQuestion.exit(sessionId);
  writeAltManually(sessionId);
  askAltAfterUrl(sessionId);
}

function askAltUrl(sessionId, prefilledUrl = "") {
  const intro = prefilledUrl
    ? "Here's the site I found — confirm it below to begin."
    : "Drop your website URL below to begin. No website? I'll ask you a few questions instead.";
  postAssistantMessage(sessionId, intro);
  inlineQuestion.ask(sessionId, {
    title: "How do you want to start?",
    stepLabel: altStepLabel("url"),
    items: [...ALT_START_ITEMS, ALT_NO_WEBSITE_ITEM, ...(isFlagOn("demoMode") ? [ALT_DEMO_ITEM] : [])],
    onPick: (value) => {
      if (value === "demo") startDemo();
      else if (value === "noWebsite") startAltInterview(sessionId);
      else if (value === "files") startAltFromFiles(sessionId);
      else startAltManually(sessionId);
    },
    customPlaceholder: "https://your-brand.com",
    customValue: prefilledUrl,
    onCustom: (value) => {
      if (!drafts.get(sessionId)) return;
      postUserTurn(sessionId, (value || "").trim());
      inlineQuestion.exit(sessionId);
      // Kick off the website analysis in the background. It runs while
      // the user moves through questions 2 and 3 — by the time they
      // finish, the draft is hydrated and the brief panel can render
      // without an additional pending state.
      readAltWebsite(sessionId, value);
      askAltAfterUrl(sessionId);
    },
  });
}

// Language step (multilingual flag ON only) — pick the ONE language this
// Playbook writes in. It becomes the Playbook's primary language, the default
// Archie drafts posts in; more languages can be added later in the editor.
// Voice examples are authored per language, never translated.
function askAltLanguage(sessionId) {
  postAssistantMessage(
    sessionId,
    "Which language should this Playbook write in? It's the language I'll draft your posts in — you can add more later in the Playbook.",
  );
  const d = drafts.get(sessionId);
  const current =
    d?.primaryLanguage || d?.language || (Array.isArray(d?.languages) && d.languages[0]) || DEFAULT_LANGUAGE;
  inlineQuestion.ask(sessionId, {
    title: "Choose your Playbook language",
    subtitle: "The language I'll write your posts in. You can add more later.",
    stepLabel: altStepLabel("language"),
    items: LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l, icon: "ap-icon-web" })),
    selected: current,
    onPick: (lang) => {
      const chosen = lang || DEFAULT_LANGUAGE;
      const dd = drafts.get(sessionId);
      if (dd) {
        dd.languages = [chosen];
        dd.primaryLanguage = chosen;
        dd.language = chosen;
      }
      postUserTurn(sessionId, chosen);
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      askAltProfile(sessionId);
    },
    onBack: () => askAltPrevious(sessionId, "language"),
  });
}

// Record the account(s) this Playbook publishes as, echo them, and move on.
// The first one is the selected profile — connecting several is allowed, but a
// Playbook still names ONE identity.
//
// `echo: false` records without a user turn — the accounts were connected
// before the chat began (flag connectFirst), so there is no answer to echo.
function commitAltProfiles(sessionId, profiles, { echo = true } = {}) {
  const d = drafts.get(sessionId);
  if (!d || !profiles.length) return;
  d.selectedProfileId = profiles[0].id;
  d.connectedSocials = profiles.map((p) => p.platform);
  if (echo) postUserProfilesTurn(sessionId, profiles);
}

// The feedback-store key for the skip reasons. One key, not one per user: the
// question is asked once, and a second answer replaces the first.
export const SKIP_CONNECT_TARGET = "skip:connect-profiles";

// The account step. It is a CHOICE rather than a
// gate: optional either way, and shaped by what the user actually has.
//   - nothing connected → offer to connect (the same rows and the same modal as
//     the in-chat step), or Skip;
//   - something connected → the normal profile pick, plus a Skip.
// Skipping leaves connectedSocials empty, which is a legitimate Playbook state:
// the chat flows ask for an account when they need one.
//
// `announce` is false when a dialog this step opened hands control back (the
// connect dialog cancelled, the skip dialog backed out): the step is being PUT
// BACK, not asked again, and re-posting its line would leave the thread saying
// the same sentence twice for one question.
function askAltProfile(sessionId, { announce = true } = {}) {
  // No account step in this run (flag connectFirst): every way in lands on the
  // step that follows it instead.
  if (!altSteps().includes("profile")) {
    askAltDocuments(sessionId);
    return;
  }
  const connectedProfiles = getConnectedProfiles();

  if (connectedProfiles.length === 0) {
    if (announce) {
      postAssistantMessage(
        sessionId,
        "Connect the account you'll publish from and I'll tune tone and format for it. Skip it and I'll ask when I write your first draft.",
      );
    }
    inlineQuestion.ask(sessionId, {
      title: "Connect an account (optional)",
      subtitle: "Nothing publishes yet — this only lets me write and schedule for it.",
      stepLabel: altStepLabel("profile"),
      // The same grid as the in-chat step, and as the product's own "Add new
      // social profiles" screen: pick a network, its dialog hands back the
      // account.
      variant: "cards",
      cardCols: 4,
      items: connectableNetworkCards(),
      skipLabel: "Skip",
      onPick: (platform) => {
        openConnectAccountModal({
          network: platform,
          preselected: accountIdsForNetwork(platform),
          onConfirm: (accounts) => {
            if (!accounts.length) return;
            commitAltProfiles(sessionId, accounts);
            inlineQuestion.exit(sessionId);
            notify(sessionId);
            askAltDocuments(sessionId);
          },
          // Backing out of the dialog puts the grid back, not a dead end.
          onDismiss: () => askAltProfile(sessionId, { announce: false }),
        });
      },
      // Skipping is allowed, but not silent: the dialog reassures about what a
      // connected account is used for, then asks why this one isn't. It is the
      // only moment that question can be asked — later flows ask for an
      // account, never for a reason. Backing out of it leaves the grid
      // standing, exactly like backing out of the connect dialog.
      onSkip: () => {
        openSkipConnectModal({
          onSkip: (reasons, comment) => {
            // The reasons are optional: record only an actual answer.
            if (reasons.length || comment) {
              recordReasons(SKIP_CONNECT_TARGET, { reasons, comment }, { kind: "skip", step: "connect-profiles" });
            }
            showToast("Noted — I'll ask again when I write your first draft.");
            inlineQuestion.exit(sessionId);
            notify(sessionId);
            askAltDocuments(sessionId);
          },
          onDismiss: () => askAltProfile(sessionId, { announce: false }),
        });
      },
      onBack: () => askAltPrevious(sessionId, "profile"),
    });
    return;
  }

  // Connected profiles + their picker presentation come from the shared
  // social-profiles helper so this onboarding step and the in-session
  // draft profile picker stay identical.
  const items = buildConnectedProfileItems();

  if (announce) {
    postAssistantMessage(sessionId, "Pick the profile to use for this Playbook. I'll tune tone and format for it.");
  }
  inlineQuestion.ask(sessionId, {
    title: "Which account will publish? (optional)",
    stepLabel: altStepLabel("profile"),
    items,
    // With many connected profiles, filter the list live instead of scrolling.
    searchable: items.length > PROFILE_SEARCH_THRESHOLD,
    searchPlaceholder: "Search accounts by name, handle, or network…",
    onPick: (id) => {
      const profile = connectedProfiles.find((p) => p.id === id);
      if (!drafts.get(sessionId)) return;
      if (profile) commitAltProfiles(sessionId, [profile]);
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      askAltDocuments(sessionId);
    },
    skipLabel: "Skip",
    onSkip: () => {
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      askAltDocuments(sessionId);
    },
    // Back to the language picker (multilingual on) or the URL question — and
    // askAltPrevious re-renders question 1 with whatever URL the draft holds.
    onBack: () => askAltPrevious(sessionId, "profile"),
  });
}

function askAltDocuments(sessionId) {
  postAssistantMessage(
    sessionId,
    "Connect the documents that describe your Brand — a brand book, guidelines, a strategy doc. Optional.",
  );
  // Onboarding keeps the choice tight — the four sources most people connect
  // first. The full catalogue lives on /connectors; the subtitle points there.
  const ONBOARDING_DOC_CONNECTORS = ["slite", "notion", "gdrive", "slack"];
  const items = ONBOARDING_DOC_CONNECTORS.map((id) => connectorMocks.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => ({
      value: c.id,
      label: c.name,
      caption: c.desc,
      imgSrc: c.logo,
    }));
  inlineQuestion.ask(sessionId, {
    title: "Connect documents (optional)",
    subtitle: "You can connect more later from Connectors.",
    stepLabel: altStepLabel("documents"),
    items,
    multi: true,
    submitLabel: "Continue",
    skipLabel: "Skip",
    onPick: (ids) => {
      if (ids?.length) {
        const noun = ids.length === 1 ? "connector" : "connectors";
        postUserTurn(sessionId, `${ids.length} ${noun} connected`);
      }
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      afterAltDocuments(sessionId);
    },
    onSkip: () => {
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      afterAltDocuments(sessionId);
    },
    onBack: () => askAltPrevious(sessionId, "documents"),
  });
}

// Optional final step — upload reference images so generated visuals stay
// on-brand. Picking the one action opens a file dialog (data URLs → the draft's
// referenceImages, surfaced in the Playbook + the image generator); a cancelled
// dialog leaves the question open so the user can still Skip.
function afterAltDocuments(sessionId) {
  if (altSteps().includes("images")) askAltReferenceImages(sessionId);
  else maybeOpenAltBrief(sessionId);
}

function askAltReferenceImages(sessionId) {
  postAssistantMessage(
    sessionId,
    "Last one, optional: add a few reference images so I keep generated visuals on-brand. Or skip.",
  );
  inlineQuestion.ask(sessionId, {
    title: "Add reference images (optional)",
    subtitle: "Logos, product shots, a brand board — I use them in the image generator.",
    stepLabel: altStepLabel("images"),
    items: [
      {
        value: "add",
        label: "Add reference images",
        caption: "Choose files from your computer",
        icon: "ap-icon-multiple-images",
      },
    ],
    skipLabel: "Skip",
    onPick: () => openAltReferenceImagePicker(sessionId),
    onSkip: () => {
      inlineQuestion.exit(sessionId);
      notify(sessionId);
      maybeOpenAltBrief(sessionId);
    },
    onBack: () => askAltDocuments(sessionId),
  });
}

// Throwaway multi-file picker → reads each image as a data URL (so it persists
// with the Playbook, unlike an ephemeral object URL) into the draft, then
// advances. Mirrors the Playbook Brand-section upload handler.
let altRefSeq = 0;
function openAltReferenceImagePicker(sessionId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    if (!files.length) return; // cancelled — leave the question open to Skip
    let pending = files.length;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const d = drafts.get(sessionId);
        if (d) {
          if (!Array.isArray(d.referenceImages)) d.referenceImages = [];
          altRefSeq += 1;
          d.referenceImages.push({ id: `ref-${altRefSeq}`, label: file.name, url: reader.result });
        }
        pending -= 1;
        if (pending === 0) {
          const n = files.length;
          postUserTurn(sessionId, `${n} reference ${n === 1 ? "image" : "images"} added`);
          inlineQuestion.exit(sessionId);
          notify(sessionId);
          maybeOpenAltBrief(sessionId);
        }
      };
      reader.readAsDataURL(file);
    }
  });
  input.click();
}

// At the end of the ALT chat, navigate to the centered /welcome-alt/recap
// surface instead of opening the right-anchored brief panel. The brief
// panel is an editing surface; the end of a conversational flow deserves
// a dedicated result presentation (UI/UX review).
//
// Stashes the ALT sessionId in sessionStorage so the recap screen can
// re-attach to the same draft after navigation.
function maybeOpenAltBrief(sessionId) {
  // Navigate straight to the recap — it owns the branded loading
  // sequence (centered Archie loader + staged "here's what we're doing"
  // copy) and waits for the analysis to land before revealing the
  // Playbook. No in-chat "Reading your site" notice: the loading moment
  // belongs on the recap surface, not as a stray chat pill.
  try {
    window.sessionStorage.setItem("welcomeAltSessionId", sessionId);
  } catch {
    /* ignore */
  }
  // Use the hash router — context-builder doesn't import navigate()
  // directly to avoid a cycle with the router module.
  window.location.hash = "#/welcome-alt/recap";
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
    voiceAlways: cloneItems(d.voiceAlways),
    voiceNever: cloneItems(d.voiceNever),
    voiceByPost: cloneItems(d.voiceByPost),
    voiceSometimes: cloneItems(d.voiceSometimes),
    // A NEW Playbook: each network it publishes on gets its voice — learned
    // from the account's posts, else the default voice optimized for it — or the
    // one the review showed (flag voicePerNetwork — stored either way, shown
    // under the flag). Re-saving an existing one never rewrites them.
    ...(!d.editingId && { voiceByNetwork: withNetworkVoices(d) }),
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
  inlineQuestion.exit(sessionId);
  notify(sessionId);
  if (onComplete) onComplete(saved);
  return saved;
}

// "Create a Playbook" from a screen of the app shell: the conversational flow
// (welcome-alt) runs in its own transient session with the sidebar + topbar
// kept (`welcomeAltIntegrated`), and the recap hands back to `returnTo`.
export function openNewPlaybookFlow(returnTo) {
  try {
    window.sessionStorage.setItem("welcomeAltIntegrated", "1");
    window.sessionStorage.setItem("welcomeAltReturnTo", returnTo);
  } catch {
    /* ignore */
  }
  setHandoff("pendingStartContextBuilder", { flow: "alt", prefilledUrl: "", returnTo });
  navigate(`/session/welcome-alt-${Date.now().toString(36)}`);
}
