// The Playbook made in the chat (flag newChatHero, 2026-11-27, asked: « au clic
// sur la card, ça devrait commencer une conversation et poser des questions pour
// créer le playbook », then « les mêmes questions / step que dans "UP-Interactive
// Playbook: the run first" mais en mode conversation, avec des cards de questions
// comme dans Claude / ChatGPT »).
//
// The run's steps, in the run's order (flowSteps), with the run's words
// (STEP_TEXT, OTHER_WAYS, VOICE_WAYS…), each asked as a question card: the
// Quickpicker, at the foot in place of the composer. An answer leaves the
// question and the answer in the thread. The Playbook is the run's draft
// (context-builder.js), keyed by this chat, and saved the same way.
//
// The chat onboarding deleted with connectFirst (2026-10-29) stays deleted: this
// exists only under newChatHero, opened from its « No Playbook created yet »
// card; everywhere else the run's screens make the Playbook.

import * as inlineQuestion from "./inline-question.js?v=2951";
import {
  postAssistantMessage,
  postUserTurn,
  postSelectionEcho,
  postVoiceTurn,
  startPending,
  updatePending,
  finishPending,
} from "./assistant.js?v=2951";
import {
  createAltDraft,
  readAltWebsite,
  readAltFiles,
  writeAltManually,
  analyzeAltInterview,
  setAltVoiceSource,
  subscribeDraft,
  isAnalysisReady,
  getDraft,
  patchDraft,
  save,
} from "./context-builder.js?v=2951";
import { nextInterviewQuestion } from "./context-mock-analysis.js?v=2951";
import { LANGUAGE_OPTIONS } from "./languages.js?v=2951";
import { connectors as connectorMocks } from "./mocks.js?v=2951";
import { buildConnectedProfileItems } from "./social-profiles.js?v=2951";
import { flowSteps, STEP_TEXT, voiceAccounts } from "./screens/welcome-alt-shell.js?v=2951";
import {
  OTHER_WAYS,
  VOICE_WAYS,
  DOC_CONNECTORS,
  DOC_READS,
  normalizeUrl,
  fallbackFor,
} from "./screens/welcome-alt-steps.js?v=2951";
import { LOADING_STAGES, FILE_LOADING_STAGES, INTERVIEW_LOADING_STAGES } from "./screens/welcome-alt-recap.js?v=2951";

// « 2 of 5 », counted on the run's own steps.
function stepLabel(step) {
  const steps = flowSteps();
  return `${steps.indexOf(step) + 1} of ${steps.length}`;
}

// An answer leaves the question and the answer in the thread, the way a
// question card does once it's answered.
function answered(sid, question, answer, echo = null) {
  postAssistantMessage(sid, question);
  if (echo) postSelectionEcho(sid, echo);
  else postUserTurn(sid, answer);
}

function readImages(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, url: reader.result });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }),
    ),
  ).then((list) => list.filter(Boolean));
}

/**
 * Open the conversation in chat `sid`. `onSaved(ctx)` binds the chat to the
 * Playbook once it's saved.
 */
export function startPlaybookChat(sid, { onSaved = () => {} } = {}) {
  createAltDraft(sid);
  const run = { sid, onSaved, turns: [] };
  postAssistantMessage(
    sid,
    "Let's build your Playbook together: a few questions, one at a time. I'll learn how you sound, who you speak to, and how you look.",
  );
  askWebsite(run);
}

// The step after `step` in the run's order.
function next(run, step) {
  const steps = flowSteps();
  const to = steps[steps.indexOf(step) + 1];
  const ask = {
    language: askLanguage,
    documents: askDocuments,
    voiceFrom: askVoiceFrom,
    recap: review,
    voice: checkVoice,
  }[to];
  (ask || review)(run);
}

function back(run, step) {
  const steps = flowSteps();
  const to = steps[steps.indexOf(step) - 1];
  const ask = {
    url: askWebsite,
    language: askLanguage,
    documents: askDocuments,
    voiceFrom: askVoiceFrom,
    recap: review,
  }[to];
  (ask || askWebsite)(run);
}

// ── 1 · The website, or another way ────────────────────────────────────────

function askWebsite(run) {
  const { sid } = run;
  inlineQuestion.ask(sid, {
    title: STEP_TEXT.url.title,
    subtitle: "I'll read your website to learn how you sound, who you speak to, and how you look.",
    stepLabel: stepLabel("url"),
    customFirst: true,
    customIcon: "ap-icon-link",
    customPlaceholder: "your-brand.com",
    items: OTHER_WAYS.map((w) => ({ value: w.value, label: w.title, caption: w.desc, icon: w.icon })),
    onCustom: (value) => {
      const url = normalizeUrl(value);
      if (!url) return askWebsite(run);
      answered(sid, "What's your website?", url.replace(/^https?:\/\//i, "").replace(/\/$/, ""));
      run.source = "website";
      readAltWebsite(sid, url);
      next(run, "url");
    },
    onPick: (way) => {
      if (way === "interview") return askInterview(run);
      if (way === "files") return askFiles(run);
      if (way === "manual") return askName(run);
    },
  });
}

function askFiles(run) {
  const { sid } = run;
  const way = OTHER_WAYS.find((w) => w.value === "files");
  inlineQuestion.ask(sid, {
    title: way.title,
    subtitle: way.desc,
    stepLabel: stepLabel("url"),
    customFile: true,
    customFileMultiple: true,
    customFileAccept: "image/*",
    customFileLabel: "Choose your images",
    customFileHint: "PNG · JPG · SVG",
    onFile: async (files) => {
      const list = await readImages([].concat(files).filter((f) => f.type?.startsWith("image/")));
      if (!list.length) return askFiles(run);
      answered(sid, "Which files should I start from?", "", {
        icon: "ap-icon-image",
        title: list.length > 1 ? `${list.length} images` : list[0].name,
        meta: "To learn your brand from",
      });
      run.source = "documents";
      readAltFiles(sid, list);
      next(run, "url");
    },
    onBack: () => askWebsite(run),
  });
}

// The run's interview, a card per question; a vague answer gets one follow-up.
function askInterview(run) {
  const { sid } = run;
  const step = nextInterviewQuestion(run.turns);
  if (step.done) {
    run.source = "interview";
    analyzeAltInterview(sid, run.turns);
    return next(run, "url");
  }
  const record = (turn) => {
    run.turns.push({ topic: step.topic, question: step.question, ...turn });
    askInterview(run);
  };
  inlineQuestion.ask(sid, {
    title: step.question,
    subtitle: step.followUp ? "One more detail and I'll have it." : `Question ${run.turns.length + 1}`,
    stepLabel: stepLabel("url"),
    customFirst: true,
    customIcon: "ap-icon-pen",
    customPlaceholder: "In your own words…",
    items: [],
    onCustom: (answer) => {
      const text = String(answer || "").trim();
      if (!text) return askInterview(run);
      answered(sid, step.question, text);
      record({ answer: text, ...(step.followUp ? { followUp: true } : {}) });
    },
    ...(step.optional
      ? {
          skipLabel: "Skip this question",
          onSkip: () => {
            answered(sid, step.question, "", { icon: "ap-icon-arrow-right", title: "Skipped" });
            record({ answer: "", skipped: true });
          },
        }
      : {}),
    onBack: () => {
      run.turns = [];
      askWebsite(run);
    },
  });
}

// « Fill it in myself »: the name, then the Playbook page is the form.
function askName(run) {
  const { sid } = run;
  inlineQuestion.ask(sid, {
    title: "What's your Brand called?",
    subtitle: "I'll open an empty Playbook under that name for you to fill in.",
    stepLabel: stepLabel("url"),
    customFirst: true,
    customIcon: "ap-icon-pen",
    customPlaceholder: "Your Brand's name",
    items: [],
    onCustom: (value) => {
      const name = String(value || "").trim();
      if (!name) return askName(run);
      answered(sid, "What's your Brand called?", name);
      run.source = "manual";
      writeAltManually(sid);
      patchDraft(sid, { name });
      next(run, "url");
    },
    onBack: () => askWebsite(run),
  });
}

// ── 2 · Language (flag multilingualPlaybook) ───────────────────────────────

function askLanguage(run) {
  const { sid } = run;
  inlineQuestion.ask(sid, {
    title: STEP_TEXT.language.title,
    subtitle: STEP_TEXT.language.desc,
    stepLabel: stepLabel("language"),
    items: LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l, icon: "ap-icon-web" })),
    onPick: (lang) => {
      answered(sid, "Which language should I write in?", "", { icon: "ap-icon-web", title: lang, meta: "Language" });
      patchDraft(sid, { languages: [lang], primaryLanguage: lang, language: lang });
      next(run, "language");
    },
    onBack: () => back(run, "language"),
  });
}

// ── 3 · Documents (flag connectors) ────────────────────────────────────────

function askDocuments(run) {
  const { sid } = run;
  const items = DOC_CONNECTORS.map((id) => connectorMocks.find((c) => c.id === id)).filter(Boolean);
  inlineQuestion.ask(sid, {
    title: "Anything else I should read?",
    subtitle: "A brand book or guidelines help me get the details right. Optional: you can connect more later.",
    stepLabel: stepLabel("documents"),
    multi: true,
    submitLabel: "Continue",
    items: items.map((c) => ({ value: c.id, label: c.name, caption: DOC_READS[c.id], imgSrc: c.logo })),
    onPick: (ids) => {
      const names = items.filter((c) => ids.includes(c.id)).map((c) => c.name);
      if (names.length)
        answered(sid, "Anything else I should read?", "", {
          icon: "ap-icon-link",
          title: names.join(", "),
          meta: "To read",
        });
      patchDraft(sid, { onboardingConnectors: ids });
      next(run, "documents");
    },
    skipLabel: "Skip for now",
    onSkip: () => next(run, "documents"),
    onBack: () => back(run, "documents"),
  });
}

// ── 4 · How I learn the voice ──────────────────────────────────────────────

const VOICE_QUESTION = "How should I learn your voice?";

function askVoiceFrom(run) {
  const { sid } = run;
  const fallback = fallbackFor(sid);
  const ways = VOICE_WAYS.filter((w) => w.value !== "profile" || voiceAccounts().length);
  const rows = fallback ? [...ways, { ...fallback, value: "fallback" }] : ways;
  inlineQuestion.ask(sid, {
    title: VOICE_QUESTION,
    subtitle: "Your voice is how your posts sound: the tone, the words, the length. Every draft I write follows it.",
    stepLabel: stepLabel("voiceFrom"),
    items: rows.map((w) => ({ value: w.value, label: w.title, caption: w.desc, icon: w.icon })),
    onPick: (way) => {
      if (way === "profile") return askVoiceAccount(run);
      if (way === "document") return askVoiceDocument(run);
      if (way === "custom") return askVoiceWords(run);
      answered(sid, VOICE_QUESTION, "", { icon: fallback.icon, title: fallback.title, meta: "Voice" });
      setAltVoiceSource(sid, null);
      next(run, "voiceFrom");
    },
    ...(fallback
      ? {}
      : {
          skipLabel: "Skip for now",
          onSkip: () => {
            setAltVoiceSource(sid, null);
            next(run, "voiceFrom");
          },
        }),
    onBack: () => back(run, "voiceFrom"),
  });
}

function askVoiceAccount(run) {
  const { sid } = run;
  const ids = new Set(voiceAccounts().map((p) => p.id));
  const items = buildConnectedProfileItems().filter((it) => ids.has(it.value));
  inlineQuestion.ask(sid, {
    title: "Which account should I learn from?",
    subtitle: "I read its recent posts and learn your voice from them.",
    stepLabel: stepLabel("voiceFrom"),
    items,
    onPick: (id) => {
      const it = items.find((i) => i.value === id);
      answered(sid, "Which account should I learn from?", "", {
        icon: "ap-icon-user",
        title: it?.label || "Account",
        meta: "To learn your voice from",
      });
      setAltVoiceSource(sid, { kind: "profile", id });
      next(run, "voiceFrom");
    },
    onBack: () => askVoiceFrom(run),
  });
}

function askVoiceDocument(run) {
  const { sid } = run;
  const way = VOICE_WAYS.find((w) => w.value === "document");
  inlineQuestion.ask(sid, {
    title: way.title,
    subtitle: way.desc,
    stepLabel: stepLabel("voiceFrom"),
    customFile: true,
    customFileAccept: ".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown",
    customFileLabel: "Choose a document",
    customFileHint: "PDF · DOCX · TXT · MD",
    onFile: (file) => {
      const f = [].concat(file)[0];
      if (!f) return askVoiceDocument(run);
      answered(sid, VOICE_QUESTION, "", {
        icon: "ap-icon-file--text",
        title: f.name,
        meta: "To learn your voice from",
      });
      setAltVoiceSource(sid, { kind: "document", name: f.name });
      next(run, "voiceFrom");
    },
    onBack: () => askVoiceFrom(run),
  });
}

function askVoiceWords(run) {
  const { sid } = run;
  inlineQuestion.ask(sid, {
    title: "Describe it in your own words",
    subtitle: "I follow it exactly as you write it.",
    stepLabel: stepLabel("voiceFrom"),
    customFirst: true,
    customIcon: "ap-icon-pen",
    customPlaceholder: "e.g. Candid and specific. Short paragraphs, no jargon.",
    items: [],
    onCustom: (value) => {
      const text = String(value || "").trim();
      if (!text) return askVoiceWords(run);
      answered(sid, VOICE_QUESTION, text);
      setAltVoiceSource(sid, { kind: "custom", text });
      next(run, "voiceFrom");
    },
    onBack: () => askVoiceFrom(run),
  });
}

// ── 5 · The analysis, if it hasn't landed yet ──────────────────────────────

function whenReady(run, then) {
  const { sid } = run;
  if (isAnalysisReady(sid)) return then();
  const stages =
    run.source === "documents"
      ? FILE_LOADING_STAGES
      : run.source === "interview"
        ? INTERVIEW_LOADING_STAGES
        : LOADING_STAGES;
  let i = 0;
  const pending = startPending(sid, `${stages[0].title}…`);
  const tick = window.setInterval(() => {
    i = Math.min(i + 1, stages.length - 1);
    updatePending(sid, pending, `${stages[i].title}…`);
  }, 1500);
  const off = subscribeDraft(sid, () => {
    if (!isAnalysisReady(sid)) return;
    window.clearInterval(tick);
    off?.();
    finishPending(sid, pending);
    then();
  });
}

// ── 6 · What I learned ─────────────────────────────────────────────────────

function review(run) {
  const { sid } = run;
  whenReady(run, () => {
    const d = getDraft(sid) || {};
    const facts = [];
    if (d.audience?.[0]) facts.push({ label: "Audience", text: d.audience[0] });
    if (d.objective?.length) facts.push({ label: "Goal", text: d.objective.slice(0, 2).join(", ") });
    if (d.tones?.length) facts.push({ label: "Tone", text: d.tones.slice(0, 3).join(", ") });
    postVoiceTurn(sid, "playbook-learned", {
      intro: run.source === "manual" ? "Your Playbook is ready to fill in." : "Here's what I learned.",
      title: d.name || "Your Brand",
      text: d.businessSummary || "",
      facts,
    });
    inlineQuestion.ask(sid, {
      title: STEP_TEXT.recap.title,
      subtitle: STEP_TEXT.recap.desc,
      stepLabel: stepLabel("recap"),
      items: [
        { value: "ok", label: "Looks good", caption: "Next, your voice.", icon: "ap-icon-check" },
        {
          value: "fix",
          label: "Fix it in the Playbook",
          caption: "I save it, then open it for you.",
          icon: "ap-icon-pen",
        },
      ],
      onPick: (v) => {
        if (v === "fix") return finish(run, { open: true });
        postSelectionEcho(sid, { icon: "ap-icon-check", title: "Looks good", meta: STEP_TEXT.recap.title });
        next(run, "recap");
      },
      onBack: () => back(run, "recap"),
    });
  });
}

// ── 7 · The voice ──────────────────────────────────────────────────────────

function checkVoice(run) {
  const { sid } = run;
  const d = getDraft(sid) || {};
  const rules = (list) => (list || []).map((r) => r?.text || r).filter(Boolean);
  const facts = [];
  if (rules(d.voiceAlways).length) facts.push({ label: "Always", list: rules(d.voiceAlways).slice(0, 3) });
  if (rules(d.voiceNever).length) facts.push({ label: "Never", list: rules(d.voiceNever).slice(0, 2) });
  postVoiceTurn(sid, "playbook-learned", {
    intro: "And this is how you'll sound.",
    title: "Your voice",
    text:
      (d.voiceMode === "manual" ? d.voiceManual : d.voiceSummary) ||
      (facts.length ? "" : "Not set yet. Describe it in the Playbook and every draft will follow it."),
    facts,
  });
  inlineQuestion.ask(sid, {
    title: STEP_TEXT.voice.title,
    subtitle: STEP_TEXT.voice.desc,
    stepLabel: stepLabel("voice"),
    items: [],
    actions: [{ value: "save", label: "Save my Playbook", primary: true }],
    onPick: () => finish(run),
    onBack: () => back(run, "voice"),
  });
}

// ── 8 · Save ───────────────────────────────────────────────────────────────

function finish(run, { open = false } = {}) {
  const { sid } = run;
  const saved = save(sid);
  if (!saved) return;
  postSelectionEcho(sid, { icon: "ap-icon-target", title: saved.name, meta: "Playbook saved" });
  postAssistantMessage(
    sid,
    open
      ? `I saved ${saved.name}. Fix anything that's off in the Playbook, then come back and tell me what to post.`
      : `Your Playbook is ready. Tell me what to post, or drop a link or a file, and I'll write it as ${saved.name}.`,
  );
  run.onSaved(saved, { open });
}
