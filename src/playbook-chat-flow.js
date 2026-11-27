// The Playbook made in the chat (flag newChatHero, 2026-11-27, asked: « au clic
// sur la card, ça devrait commencer une conversation et poser des questions pour
// créer le playbook », then « les mêmes questions / step que dans "UP-Interactive
// Playbook: the run first" mais en mode conversation, avec des cards de questions
// comme dans Claude / ChatGPT », then « ne pas utiliser le quickpicker … ces
// questions sous forme de cards dans le flux de discussion directement »).
//
// The run's steps, in the run's order (flowSteps), with the run's words
// (STEP_TEXT, OTHER_WAYS, VOICE_WAYS…), each asked as a question card IN the
// thread (variant `pb-ask`, renderPbAskTurn in thread-render.js): the run's own
// option rows, URL field and answer box, inside an Archie turn. The composer
// stays at the foot. Answered, a card folds to its question and the answer.
// A question that only takes words (the interview, the Brand's name, the voice
// in your own words) is no card: I ask it as a sentence and the answer is
// typed in the composer, like any reply (asked: « ça devrait simplement être
// une phrase dans la conversation, et que l'utilisateur réponde en utilisant
// le composer »).
// The Playbook is the run's draft (context-builder.js), keyed by this chat,
// saved the same way.
//
// The chat onboarding deleted with connectFirst (2026-10-29) stays deleted: this
// exists only under newChatHero, opened from its « No Playbook created yet »
// card; everywhere else the run's screens make the Playbook.

import { getThread, refreshThread, postAssistantMessage, postUserTurn, postVoiceTurn } from "./assistant.js?v=2979";
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
} from "./context-builder.js?v=2979";
import { nextInterviewQuestion } from "./context-mock-analysis.js?v=2979";
import { LANGUAGE_OPTIONS } from "./languages.js?v=2979";
import { connectors as connectorMocks } from "./mocks.js?v=2979";
import { buildConnectedProfileItems } from "./social-profiles.js?v=2979";
import { flowSteps, STEP_TEXT, voiceAccounts } from "./screens/welcome-alt-shell.js?v=2979";
import {
  OTHER_WAYS,
  VOICE_WAYS,
  DOC_CONNECTORS,
  DOC_READS,
  normalizeUrl,
  fallbackFor,
} from "./screens/welcome-alt-steps.js?v=2979";
import { LOADING_STAGES, FILE_LOADING_STAGES, INTERVIEW_LOADING_STAGES } from "./screens/welcome-alt-recap.js?v=2979";

// « 2 of 5 », counted on the run's own steps.
function stepLabel(step) {
  const steps = flowSteps();
  return `${steps.indexOf(step) + 1} of ${steps.length}`;
}

const way = (w) => ({ value: w.value, title: w.title, desc: w.desc, icon: w.icon });

// ── The cards ──────────────────────────────────────────────────────────────
// A card is a thread turn; its handlers wait here, by turn id, until answered.
// Each card opens a group in `run.groups` (the card and any turn posted with
// it), so Back can take the last two groups out of the thread and ask the
// earlier step again.

const handlersById = new Map();

function ask(run, spec, handlers, { withIds = [] } = {}) {
  const id = postVoiceTurn(run.sid, "pb-ask", { contextId: null, network: null, ask: spec });
  handlersById.set(id, { run, handlers });
  run.groups.push([...withIds, id]);
  // The card's field takes the focus once the thread has painted it — and
  // again after the hero's transition, which swaps the page late — unless
  // the reader is already in another field.
  const focus = () => {
    if (document.activeElement && document.activeElement !== document.body) return;
    document.querySelector(`[data-pb-ask="${id}"] :is(input[type=text], textarea)`)?.focus({ preventScroll: true });
  };
  window.setTimeout(focus, 60);
  window.setTimeout(focus, 2400);
  return id;
}

// Fold a card to its question and the answer.
function settle(sid, id, answer = "") {
  const msg = getThread(sid).find((m) => m.id === id);
  if (!msg) return;
  msg.resolved = true;
  msg.answer = answer;
  handlersById.delete(id);
  refreshThread(sid);
}

// Back: the current card and the one before it leave the thread; `again`
// asks the earlier step anew.
function goBack(run, again) {
  textWaits.delete(run.sid);
  const drop = [...(run.groups.pop() || []), ...(run.groups.pop() || [])];
  const thread = getThread(run.sid);
  for (const id of drop) {
    handlersById.delete(id);
    const i = thread.findIndex((m) => m.id === id);
    if (i >= 0) thread.splice(i, 1);
  }
  refreshThread(run.sid);
  again(run);
}

/**
 * The cards' events, delegated by session.js (click, submit, change). Returns
 * true when the event was a card's.
 */
export function handlePbAsk(event) {
  const card = event.target.closest?.("[data-pb-ask]");
  if (!card) return false;
  const id = card.dataset.pbAsk;
  const entry = handlersById.get(id);
  if (!entry) return false;
  const { run, handlers: h } = entry;
  if (event.type === "submit") {
    event.preventDefault();
    const data = new FormData(event.target);
    const text = String(data.get("answer") || "").trim();
    if (h.onValues) h.onValues(data.getAll("answer").map(String), id);
    else if (text) h.onText?.(text, id);
    else event.target.querySelector("input, textarea")?.focus();
    return true;
  }
  if (event.type === "change") {
    if (!event.target.matches("[data-pb-file]")) return false;
    const files = Array.from(event.target.files || []);
    if (files.length) h.onFiles?.(files, id);
    return true;
  }
  if (event.type !== "click") return false;
  const pick = event.target.closest("[data-pb-pick]");
  if (pick) {
    event.preventDefault();
    h.onPick?.(pick.dataset.pbPick, id);
    return true;
  }
  const act = event.target.closest("[data-pb-act]")?.dataset.pbAct;
  if (!act) return false;
  event.preventDefault();
  if (act === "back") goBack(run, h.onBack);
  else if (act === "skip") h.onSkip?.(id);
  else if (act === "files") card.querySelector("[data-pb-file]")?.click();
  else h.onAct?.(act, id);
  return true;
}

// ── Questions in words ────────────────────────────────────────────────────
// Archie asks in a sentence; the next message typed in the composer is the
// answer (session.js hands it over through answerPbText before anything else
// reads it). No card, no Back.

// `suggestions` (2026-11-27, asked: « pour chaque question, on pourrait proposer
// des options "par défaut" que l'utilisateur peut facilement cliquer … un peu
// de proactivité »): likely answers under the sentence (variant `pb-say`,
// renderPbSayTurn); a click sends one as the answer, typing still works. They
// go once the question is answered.

const textWaits = new Map(); // sid → { onAnswer, sayId }
const sayIds = new Map(); // pb-say turn id → sid

function askText(run, question, onAnswer, suggestions = []) {
  const sayId = postVoiceTurn(run.sid, "pb-say", { contextId: null, network: null, text: question, suggestions });
  sayIds.set(sayId, run.sid);
  textWaits.set(run.sid, { onAnswer, sayId });
  run.groups.push([sayId]);
  window.setTimeout(() => document.querySelector("#assistantInput")?.focus({ preventScroll: true }), 60);
}

/** A suggested answer clicked under a question (delegated by session.js). */
export function handlePbSuggest(event) {
  const btn = event.target.closest?.("[data-pb-suggest]");
  if (!btn) return false;
  const sid = sayIds.get(btn.closest("[data-pb-say]")?.dataset.pbSay);
  if (!sid) return false;
  event.preventDefault();
  answerPbText(sid, btn.dataset.pbSuggest);
  return true;
}

/** The composer's message, when a question in words is waiting for it. */
export function answerPbText(sid, text) {
  const wait = textWaits.get(sid);
  if (!wait) return false;
  textWaits.delete(sid);
  const say = getThread(sid).find((m) => m.id === wait.sayId);
  if (say) say.resolved = true;
  const onAnswer = wait.onAnswer;
  postUserTurn(sid, text);
  // A beat before the next line, the way a reply lands.
  window.setTimeout(() => onAnswer(text), 450);
  return true;
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
 * Open the conversation in chat `sid`. `onSaved(ctx, { open })` binds the chat
 * to the Playbook once it's saved (or opens it, to fix it).
 */
export function startPlaybookChat(sid, { onSaved = () => {} } = {}) {
  createAltDraft(sid);
  const run = { sid, onSaved, turns: [], groups: [], readings: [] };
  postAssistantMessage(
    sid,
    "Let's build your Playbook together: a few questions, one at a time. I'll learn how you sound, who you speak to, and how you look.",
  );
  askWebsite(run);
}

// The step after / before `step`, in the run's order.
const ASK = {
  url: (run) => askWebsite(run),
  language: (run) => askLanguage(run),
  documents: (run) => askDocuments(run),
  voiceFrom: (run) => askVoiceFrom(run),
  recap: (run) => review(run),
  voice: (run) => checkVoice(run),
};
function next(run, step) {
  const steps = flowSteps();
  (ASK[steps[steps.indexOf(step) + 1]] || ASK.recap)(run);
}
const previous = (step) => (run) => {
  const steps = flowSteps();
  (ASK[steps[steps.indexOf(step) - 1]] || ASK.url)(run);
};

// ── 1 · The website, or another way ────────────────────────────────────────

function askWebsite(run) {
  const { sid } = run;
  ask(
    run,
    {
      kind: "url",
      title: STEP_TEXT.url.title,
      subtitle: "I'll read your website to learn how you sound, who you speak to, and how you look.",
      step: stepLabel("url"),
      placeholder: "your-brand.com",
      submitLabel: "Read my website",
      tone: "orange",
      orLabel: "Or start another way",
      items: OTHER_WAYS.map(way),
    },
    {
      onText: (value, id) => {
        const url = normalizeUrl(value);
        const host = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
        settle(sid, id, host);
        readAltWebsite(sid, url);
        run.source = "website";
        startReading(run, {
          phases: [`Reading ${host}`, ...LOADING_STAGES.slice(1).map((st) => st.title)],
          done: `Read ${host}`,
          until: analysisDone(sid),
        });
        next(run, "url");
      },
      onPick: (v, id) => {
        settle(sid, id, OTHER_WAYS.find((w) => w.value === v)?.title || "");
        if (v === "interview") askInterview(run);
        else if (v === "files") askFiles(run);
        else if (v === "manual") askName(run);
      },
    },
  );
}

function askFiles(run) {
  const { sid } = run;
  const w = OTHER_WAYS.find((x) => x.value === "files");
  ask(
    run,
    {
      kind: "file",
      title: w.title,
      subtitle: w.desc,
      step: stepLabel("url"),
      fileLabel: "Choose images",
      accept: "image/*",
      multiple: true,
      back: true,
    },
    {
      onFiles: async (files, id) => {
        const list = await readImages(files.filter((f) => f.type?.startsWith("image/")));
        if (!list.length) return;
        settle(sid, id, list.length > 1 ? `${list.length} images` : list[0].name);
        readAltFiles(sid, list);
        run.source = "documents";
        startReading(run, {
          phases: FILE_LOADING_STAGES.map((st) => st.title),
          done: list.length > 1 ? `Read ${list.length} images` : `Read ${list[0].name}`,
          until: analysisDone(sid),
        });
        next(run, "url");
      },
      onBack: askWebsite,
    },
  );
}

// The run's interview, one sentence per question, answered in the composer;
// a vague answer gets one follow-up. An optional question takes « skip ».
const SKIP = /^(skip( this one)?|pass|no|none|n\/a|nothing)[.!]?$/i;

// Likely answers for each interview topic, [business, person] like the
// questions themselves, each long enough to pass as specific (a short answer
// would earn a follow-up). Written for the prototype: a real Archie would draft
// them from what it already knows. The audience leads with B2B or B2C from
// what the earlier answers say.
const SUGGESTED = {
  who: [
    [
      "We're a small local business",
      "We're a startup building a software product",
      "We're an agency working for several clients",
      "I'm a freelancer working on my own",
    ],
  ],
  offer: [
    [
      "Products we make and sell online",
      "Services we deliver to businesses",
      "Software that saves teams time every week",
    ],
    [
      "My expertise, through consulting and coaching",
      "Content I create: articles, videos and talks",
      "Freelance work for clients in my field",
    ],
  ],
  audience: [
    [
      "Businesses: managers and their teams (B2B)",
      "Consumers buying for themselves (B2C)",
      "Both businesses and individual consumers",
    ],
    [
      "Companies that could hire me (B2B)",
      "People who follow my work and buy from me (B2C)",
      "Recruiters and people in my industry",
    ],
  ],
  goals: [
    ["More people knowing our brand", "Leads and sales from social media", "More bookings and appointments"],
    ["A bigger following in my field", "New clients for my services", "Finding my next job"],
  ],
  cta: [
    ["Our website's homepage", "Our online shop", "Our booking page", "Skip this one"],
    ["My portfolio", "My link-in-bio page", "My email or newsletter", "Skip this one"],
  ],
  rivals: [["Skip this one"]],
};

const B2B = /\b(software|saas|agency|consult\w*|b2b|teams?|companies|businesses|clients?|enterprise|startup)\b/i;
const B2C =
  /\b(shop|store|bakery|restaurant|caf[eé]|coffee|clothing|fashion|beauty|fitness|gym|consumers?|families|home)\b/i;

function suggestionsFor(step, turns) {
  const first = turns.find((t) => t.topic === "who" && !t.skipped)?.answer || "";
  const personal = !/\b(we|we're|our|us)\b/i.test(first) && /\b(i|i'm|i am|my|me)\b/i.test(first);
  const sets = SUGGESTED[step.topic] || [];
  let list = [...((personal && sets[1]) || sets[0] || [])];
  if (step.topic === "audience" && !personal) {
    const said = turns.map((t) => t.answer || "").join(" ");
    if (B2C.test(said) && !B2B.test(said)) list = [list[1], list[0], list[2]];
  }
  return list.map((label) => ({ label, value: label }));
}

function askInterview(run) {
  const { sid } = run;
  const step = nextInterviewQuestion(run.turns);
  if (step.done) {
    analyzeAltInterview(sid, run.turns);
    run.source = "interview";
    startReading(run, {
      phases: INTERVIEW_LOADING_STAGES.map((st) => st.title),
      done: "Read your answers",
      until: analysisDone(sid),
    });
    return next(run, "url");
  }
  askText(
    run,
    step.optional ? `${step.question} You can skip this one.` : step.question,
    (text) => {
      const skipped = step.optional && SKIP.test(text.trim());
      run.turns.push({
        topic: step.topic,
        question: step.question,
        ...(skipped ? { answer: "", skipped: true } : { answer: text, ...(step.followUp ? { followUp: true } : {}) }),
      });
      askInterview(run);
    },
    suggestionsFor(step, run.turns),
  );
}

// « Fill it in myself »: the name, then the Playbook page is the form.
function askName(run) {
  const { sid } = run;
  askText(run, "What's your Brand called? I'll open an empty Playbook under that name for you to fill in.", (name) => {
    writeAltManually(sid);
    patchDraft(sid, { name: name.trim() });
    run.source = "manual";
    next(run, "url");
  });
}

// ── 2 · Language (flag multilingualPlaybook) ───────────────────────────────

function askLanguage(run) {
  const { sid } = run;
  ask(
    run,
    {
      kind: "choices",
      title: STEP_TEXT.language.title,
      subtitle: STEP_TEXT.language.desc,
      step: stepLabel("language"),
      items: LANGUAGE_OPTIONS.map((l) => ({ value: l, title: l, icon: "ap-icon-web" })),
      back: true,
    },
    {
      onPick: (lang, id) => {
        settle(sid, id, lang);
        patchDraft(sid, { languages: [lang], primaryLanguage: lang, language: lang });
        next(run, "language");
      },
      onBack: previous("language"),
    },
  );
}

// ── 3 · Documents (flag connectors) ────────────────────────────────────────

function askDocuments(run) {
  const { sid } = run;
  const items = DOC_CONNECTORS.map((id) => connectorMocks.find((c) => c.id === id)).filter(Boolean);
  ask(
    run,
    {
      kind: "checks",
      title: "Anything else I should read?",
      subtitle: "A brand book or guidelines help me get the details right. Optional: you can connect more later.",
      step: stepLabel("documents"),
      items: items.map((c) => ({ value: c.id, title: c.name, desc: DOC_READS[c.id], imgSrc: c.logo })),
      submitLabel: "Continue",
      skipLabel: "Skip for now",
      back: true,
    },
    {
      onValues: (ids, id) => {
        settle(
          sid,
          id,
          items
            .filter((c) => ids.includes(c.id))
            .map((c) => c.name)
            .join(", ") || "Nothing for now",
        );
        patchDraft(sid, { onboardingConnectors: ids });
        next(run, "documents");
      },
      onSkip: (id) => {
        settle(sid, id, "Skipped");
        next(run, "documents");
      },
      onBack: previous("documents"),
    },
  );
}

// ── 4 · How I learn the voice ──────────────────────────────────────────────

function askVoiceFrom(run) {
  const { sid } = run;
  const fallback = fallbackFor(sid);
  const ways = VOICE_WAYS.filter((w) => w.value !== "profile" || voiceAccounts().length);
  const rows = fallback ? [...ways, { ...fallback, value: "fallback" }] : ways;
  ask(
    run,
    {
      kind: "choices",
      title: "How should I learn your voice?",
      subtitle: "Your voice is how your posts sound: the tone, the words, the length. Every draft I write follows it.",
      step: stepLabel("voiceFrom"),
      items: rows.map(way),
      skipLabel: fallback ? "" : "Skip for now",
      back: true,
    },
    {
      onPick: (v, id) => {
        settle(sid, id, rows.find((w) => w.value === v)?.title || "");
        if (v === "profile") return askVoiceAccount(run);
        if (v === "document") return askVoiceDocument(run);
        if (v === "custom") return askVoiceWords(run);
        setAltVoiceSource(sid, null);
        next(run, "voiceFrom");
      },
      onSkip: (id) => {
        settle(sid, id, "Skipped");
        setAltVoiceSource(sid, null);
        next(run, "voiceFrom");
      },
      onBack: previous("voiceFrom"),
    },
  );
}

function askVoiceAccount(run) {
  const { sid } = run;
  const ids = new Set(voiceAccounts().map((p) => p.id));
  const items = buildConnectedProfileItems()
    .filter((it) => ids.has(it.value))
    .map((it) => ({
      value: it.value,
      title: it.label,
      desc: it.caption,
      imgSrc: it.avatar?.imageUrl,
      icon: "ap-icon-user",
    }));
  ask(
    run,
    {
      kind: "choices",
      title: "Which account should I learn from?",
      subtitle: "I read its recent posts and learn your voice from them.",
      step: stepLabel("voiceFrom"),
      items,
      back: true,
    },
    {
      onPick: (pid, id) => {
        const it = items.find((i) => i.value === pid);
        settle(sid, id, it?.title || "");
        setAltVoiceSource(sid, { kind: "profile", id: pid });
        startReading(run, {
          phases: [`Reading ${it?.title || "the account"}'s posts`, "Learning how you sound there"],
          done: `Read ${it?.title || "the account"}'s posts`,
          until: pause(4200),
        });
        next(run, "voiceFrom");
      },
      onBack: askVoiceFrom,
    },
  );
}

function askVoiceDocument(run) {
  const { sid } = run;
  const w = VOICE_WAYS.find((x) => x.value === "document");
  ask(
    run,
    {
      kind: "file",
      title: w.title,
      subtitle: w.desc,
      step: stepLabel("voiceFrom"),
      fileLabel: "Choose a document",
      accept: ".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown",
      back: true,
    },
    {
      onFiles: ([f], id) => {
        settle(sid, id, f.name);
        setAltVoiceSource(sid, { kind: "document", name: f.name });
        startReading(run, {
          phases: [`Reading ${f.name}`, "Learning how you write"],
          done: `Read ${f.name}`,
          until: pause(3200),
        });
        next(run, "voiceFrom");
      },
      onBack: askVoiceFrom,
    },
  );
}

function askVoiceWords(run) {
  const { sid } = run;
  askText(
    run,
    "Describe your voice in your own words. I'll follow it exactly as you write it.",
    (text) => {
      setAltVoiceSource(sid, { kind: "custom", text: text.trim() });
      next(run, "voiceFrom");
    },
    [
      "Warm and direct. Short sentences, no jargon.",
      "Professional and confident, backed by numbers.",
      "Playful and casual, a few emojis, never stiff.",
    ].map((label) => ({ label, value: label })),
  );
}

// ── 5 · Reading, in the background ─────────────────────────────────────────
// A website, files, the answers, an account's posts, a document: each takes a
// moment to read. A loader turn says so the moment it starts (variant
// `pb-reading`, the thread's working pill), its words moving through the
// run's stages, while the next questions are asked; done, it stays as « Read
// lemonde.fr · 6s » (asked 2026-11-27: « ça prend un peu de temps, donc
// rajouter un loader asynchrone est nécessaire sur ces étapes »). The review
// waits for every reading.

const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const analysisDone = (sid) =>
  new Promise((resolve) => {
    if (isAnalysisReady(sid)) return resolve();
    const off = subscribeDraft(sid, () => {
      if (!isAnalysisReady(sid)) return;
      off?.();
      resolve();
    });
  });

function startReading(run, { phases, done, until }) {
  const { sid } = run;
  const started = Date.now();
  const id = postVoiceTurn(sid, "pb-reading", { contextId: null, network: null, label: phases[0], loading: true });
  const find = () => getThread(sid).find((m) => m.id === id);
  let i = 0;
  const tick = window.setInterval(() => {
    const m = find();
    if (!m?.loading || i >= phases.length - 1) return;
    m.label = phases[++i];
    refreshThread(sid);
  }, 1600);
  run.readings.push(
    until.then(() => {
      window.clearInterval(tick);
      const m = find();
      if (!m) return;
      m.loading = false;
      m.label = `${done} · ${Math.max(1, Math.round((Date.now() - started) / 1000))}s`;
      refreshThread(sid);
    }),
  );
}

function whenReady(run, then) {
  Promise.all([analysisDone(run.sid), ...run.readings]).then(then);
}

// ── 6 · What I learned ─────────────────────────────────────────────────────

// Prod's in-thread Playbook proposal (playbook-proposal-card, studio chat,
// 2026-11-25), reused (asked 2026-11-27: « on a littéralement travaillé sur
// les styles de ces éléments cette semaine sur Archie en prod, j'aimerais que
// tu réutilises ces styles »): what I learned is ONE card — a butter head (the
// step, the Playbook), labelled rows — and the answer sits under it, ghost
// grey then primary blue; answered, a green check and what was chosen.
function proposal(run, card, handlers) {
  const id = postVoiceTurn(run.sid, "playbook-learned", { contextId: null, network: null, ...card });
  handlersById.set(id, { run, handlers });
  run.groups.push([id]);
  return id;
}

function review(run) {
  const { sid } = run;
  whenReady(run, () => {
    const d = getDraft(sid) || {};
    const rows = [];
    if (d.businessSummary) rows.push({ label: "What you do", text: d.businessSummary });
    if (d.audience?.[0]) rows.push({ label: "Audience", text: d.audience[0] });
    if (d.objective?.length) rows.push({ label: "Goal", text: d.objective.slice(0, 2).join(", ") });
    if (d.tones?.length) rows.push({ label: "Tone", text: d.tones.slice(0, 3).join(", ") });
    proposal(
      run,
      {
        intro: run.source === "manual" ? "Your Playbook is ready to fill in." : "Here's what I learned.",
        title: STEP_TEXT.recap.title,
        caption: `${stepLabel("recap")} · Playbook: ${d.name || "Your Brand"}`,
        rows,
        actions: [
          { value: "fix", label: "Fix it in the Playbook" },
          { value: "ok", label: "Looks good", primary: true },
        ],
      },
      {
        onAct: (v, id) => {
          settle(sid, id, v === "fix" ? "Fix it in the Playbook" : "Looks good");
          if (v === "fix") return finish(run, { open: true });
          next(run, "recap");
        },
      },
    );
  });
}

// ── 7 · The voice ──────────────────────────────────────────────────────────

function checkVoice(run) {
  const { sid } = run;
  const d = getDraft(sid) || {};
  const rules = (list) => (list || []).map((r) => r?.text || r).filter(Boolean);
  const summary = d.voiceMode === "manual" ? d.voiceManual : d.voiceSummary;
  const rows = [];
  if (summary) rows.push({ label: "How you sound", text: summary });
  if (rules(d.voiceAlways).length) rows.push({ label: "Always", list: rules(d.voiceAlways).slice(0, 3) });
  if (rules(d.voiceNever).length) rows.push({ label: "Never", list: rules(d.voiceNever).slice(0, 2) });
  if (!rows.length)
    rows.push({
      label: "How you sound",
      text: "Not set yet. Describe it in the Playbook and every draft will follow it.",
    });
  proposal(
    run,
    {
      intro: "And this is how you'll sound.",
      title: STEP_TEXT.voice.title,
      caption: `${stepLabel("voice")} · ${STEP_TEXT.voice.desc}`,
      rows,
      actions: [{ value: "save", label: "Save my Playbook", primary: true }],
    },
    {
      onAct: (_act, id) => {
        settle(sid, id, "Playbook saved");
        finish(run);
      },
    },
  );
}

// ── 8 · Save ───────────────────────────────────────────────────────────────

function finish(run, { open = false } = {}) {
  const { sid } = run;
  const saved = save(sid);
  if (!saved) return;
  postAssistantMessage(
    sid,
    open
      ? `I saved ${saved.name}. Fix anything that's off in the Playbook, then come back and tell me what to post.`
      : `Your Playbook ${saved.name} is ready. Tell me what to post, or drop a link or a file, and I'll write it in your voice.`,
  );
  run.onSaved(saved, { open });
}
