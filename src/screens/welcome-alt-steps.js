// The middle of the first-time run. One screen per step, in
// the onboarding shell (welcome-alt-shell.js); each step's effect on the draft
// is context-builder's (readAltWebsite, readAltFiles, writeAltManually,
// analyzeAltInterview), the same moves the chat onboarding makes.
//
//   /welcome-alt/brand      the website (prefilled), or files, a short
//                           interview, or by hand
//   /welcome-alt/interview  no website: one question at a time
//   /welcome-alt/language   flag multilingualPlaybook
//   /welcome-alt/documents  optional
//
// Friction, removed on purpose: the website is the field, not the 4th option;
// the analysis starts on submit and runs while the next steps are answered;
// Enter submits; nothing on these screens leaves the run by accident (no Esc
// exit); Back always keeps what was answered.

import { html, raw, escapeHtml } from "../utils.js?v=2607";
import { navigate } from "../router.js?v=2607";
import {
  getDraft,
  patchDraft,
  readAltWebsite,
  readAltFiles,
  writeAltManually,
  analyzeAltInterview,
  setAltVoiceSource,
} from "../context-builder.js?v=2607";
import { nextInterviewQuestion } from "../context-mock-analysis.js?v=2607";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "../languages.js?v=2607";
import { connectors as connectorMocks } from "../mocks.js?v=2607";
import { ensureFlowDraft, goBack, goNext, mountShell, STEP_TEXT, voiceAccounts } from "./welcome-alt-shell.js?v=2607";
import { networkIcon } from "../social-profiles.js?v=2607";

// Wire one screen: the shell, a click handler, an optional submit / change.
function screen(target, { step, left, onClick, onSubmit, onChange, onInput, onKeydown }) {
  const sid = ensureFlowDraft();
  const shell = mountShell(target, { step, sid, left: () => left(sid) });
  const handlers = {
    click: (e) => {
      if (e.target.closest("[data-flow-back]")) return goBack(step);
      onClick?.(e, sid, shell);
    },
    submit: (e) => {
      e.preventDefault();
      onSubmit?.(e, sid, shell);
    },
    change: (e) => onChange?.(e, sid, shell),
    input: (e) => onInput?.(e, sid, shell),
    keydown: (e) => onKeydown?.(e, sid, shell),
  };
  for (const [type, fn] of Object.entries(handlers)) target.addEventListener(type, fn);
  target.querySelector("[data-flow-autofocus]")?.focus({ preventScroll: true });
  return () => {
    shell.cleanup();
    for (const [type, fn] of Object.entries(handlers)) target.removeEventListener(type, fn);
  };
}

// Raw: it is interpolated into the screens' html templates as markup.
const actions = (primary, { skip = "", skipClass = "ghost grey" } = {}) =>
  raw(html`
    <div class="welcome-flow__actions">
      <button type="button" class="ap-button ghost grey" data-flow-back>
        <i class="ap-icon-arrow-left"></i><span>Back</span>
      </button>
      ${skip
        ? raw(`<button type="button" class="ap-button ${skipClass}" data-flow-skip>${escapeHtml(skip)}</button>`)
        : ""}
      ${raw(primary)}
    </div>
  `);

const continueButton = (label = "Continue", { disabled = false } = {}) =>
  `<button type="submit" class="ap-button primary blue" data-flow-next ${disabled ? "disabled" : ""}><span>${escapeHtml(label)}</span></button>`;

// ── /welcome-alt/brand ───────────────────────────────────────────────────

const OTHER_WAYS = [
  {
    value: "interview",
    icon: "ap-icon-single-chat-bubble",
    title: "I don't have a website",
    desc: "Answer a few quick questions instead.",
  },
  { value: "files", icon: "ap-icon-upload", title: "Start from files", desc: "Your logo, past visuals, or photos." },
  {
    value: "manual",
    icon: "ap-icon-pen",
    title: "Fill it in myself",
    desc: "Write the Playbook yourself, part by part.",
  },
];

function normalizeUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function pickFiles(onFiles) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, url: reader.result });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((loaded) => onFiles(loaded.filter(Boolean)));
  });
  input.click();
}

export function renderWelcomeAltBrand(_params, target) {
  return screen(target, {
    step: "url",
    left: (sid) => {
      const d = getDraft(sid);
      // The domain alone reads better than the full URL; https:// is added back on submit.
      const url = (d?.websiteUrl || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">${STEP_TEXT.url.title}</h1>
        <p class="welcome-intro__sub">
          I'll read your website to learn how you sound, who you speak to, and how you look.
        </p>
        <form class="welcome-flow__url" data-brand-form novalidate>
          <div class="ap-input-group welcome-flow__url-field">
            <i class="ap-icon-link" aria-hidden="true"></i>
            <input
              type="url"
              name="url"
              value="${url}"
              placeholder="your-brand.com"
              aria-label="Your website"
              autocomplete="url"
              data-flow-autofocus
            />
          </div>
          <button type="submit" class="ap-button primary orange">
            <span>Read my website</span>
            <i class="ap-icon-arrow-right"></i>
          </button>
        </form>
        <p class="welcome-flow__url-error" id="brandUrlError" hidden>Add your website, or pick another way below.</p>
        <p class="welcome-flow__or">Or start another way</p>
        <ul class="welcome-flow__options">
          ${OTHER_WAYS.map(
            (w) => html`
              <li>
                <button type="button" class="welcome-flow__option" data-brand-way="${w.value}">
                  <span class="welcome-flow__glyph is-icon"><i class="${w.icon}" aria-hidden="true"></i></span>
                  <span class="welcome-flow__option-text">
                    <span class="welcome-flow__option-title">${w.title}</span>
                    <span class="welcome-flow__option-desc">${w.desc}</span>
                  </span>
                  <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
                </button>
              </li>
            `,
          )}
        </ul>
        ${actions("")}
      `;
    },
    onSubmit: (e, sid) => {
      const field = e.target.querySelector("input[name=url]");
      const url = normalizeUrl(field?.value);
      if (!url) {
        // Seen, not only set: the DS invalid field, and the line that says what to do.
        field?.setAttribute("aria-invalid", "true");
        // Described by the error only while it shows: a hidden description is still read.
        field?.setAttribute("aria-describedby", "brandUrlError");
        field?.closest(".ap-input-group")?.classList.add("invalid");
        e.target.parentElement?.querySelector("#brandUrlError")?.removeAttribute("hidden");
        field?.focus();
        return;
      }
      readAltWebsite(sid, url);
      goNext("url");
    },
    onInput: (e) => {
      e.target.removeAttribute?.("aria-invalid");
      e.target.removeAttribute?.("aria-describedby");
      e.target.closest?.(".ap-input-group")?.classList.remove("invalid");
      e.target.closest?.("[data-flow-left]")?.querySelector("#brandUrlError")?.setAttribute("hidden", "");
    },
    onClick: (e, sid) => {
      const way = e.target.closest("[data-brand-way]")?.dataset.brandWay;
      if (way === "interview") navigate("/welcome-alt/interview");
      else if (way === "manual") {
        writeAltManually(sid);
        goNext("url");
      } else if (way === "files") {
        pickFiles((list) => {
          if (!list.length) return;
          readAltFiles(sid, list);
          goNext("url");
        });
      }
    },
  });
}

// ── /welcome-alt/interview ───────────────────────────────────────────────
// One question at a time, picked from the answers so far; the answers live on
// the draft as they're given, so Back and a reload keep them.

const turnsOf = (sid) => getDraft(sid)?.pendingInterview || [];

export function renderWelcomeAltInterview(_params, target) {
  const record = (sid, shell, turn) => {
    const step = nextInterviewQuestion(turnsOf(sid));
    const turns = [...turnsOf(sid), { topic: step.topic, question: step.question, ...turn }];
    patchDraft(sid, { pendingInterview: turns });
    const next = nextInterviewQuestion(turns);
    if (next.done) {
      analyzeAltInterview(sid, turns);
      goNext("url");
    } else {
      shell.paint();
      document.querySelector("[data-flow-autofocus]")?.focus();
    }
  };
  return screen(target, {
    step: "url",
    left: (sid) => {
      const turns = turnsOf(sid);
      const step = nextInterviewQuestion(turns);
      if (step.done) return "";
      return html`
        <p class="welcome-flow__kicker">Question ${turns.length + 1}</p>
        <h1 class="welcome-flow__title is-question" id="welcomeFlowTitle">${step.question}</h1>
        <form class="welcome-flow__answer" data-interview-form novalidate>
          <div class="ap-textarea-field welcome-flow__textarea">
            <textarea
              name="answer"
              rows="4"
              placeholder="In your own words…"
              aria-labelledby="welcomeFlowTitle"
              data-flow-autofocus
            ></textarea>
          </div>
          ${actions(continueButton("Continue", { disabled: true }), {
            skip: step.optional ? "Skip this question" : "",
          })}
        </form>
      `;
    },
    onInput: (e, sid, shell) => {
      const next = shell && e.target.closest("form")?.querySelector("[data-flow-next]");
      if (next) next.disabled = !e.target.value.trim();
    },
    onKeydown: (e) => {
      // Enter sends; Shift+Enter is a new line.
      if (e.key === "Enter" && !e.shiftKey && e.target.name === "answer") {
        e.preventDefault();
        e.target.form?.requestSubmit();
      }
    },
    onSubmit: (e, sid, shell) => {
      const answer = e.target.querySelector("textarea")?.value.trim();
      if (!answer) return;
      const step = nextInterviewQuestion(turnsOf(sid));
      record(sid, shell, { answer, ...(step.followUp ? { followUp: true } : {}) });
    },
    onClick: (e, sid, shell) => {
      if (e.target.closest("[data-flow-skip]")) record(sid, shell, { answer: "", skipped: true });
    },
  });
}

// ── /welcome-alt/language ────────────────────────────────────────────────

const LANGUAGE_IN_ENGLISH = { Français: "French", Español: "Spanish" };

function optionRow({ name, value, checked, disabled = false, type = "radio", lead, title, desc = "", badge = "" }) {
  const control =
    type === "radio"
      ? `<span class="ap-radio-container"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} /></span>`
      : `<span class="ap-checkbox-container"><input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} /><i></i></span>`;
  return html`
    <li>
      <label class="welcome-flow__option is-choice">
        ${raw(lead || "")}
        <span class="welcome-flow__option-text">
          <span class="welcome-flow__option-title">${title}</span>
          ${desc ? raw(`<span class="welcome-flow__option-desc">${escapeHtml(desc)}</span>`) : ""}
        </span>
        ${raw(badge)}${raw(control)}
      </label>
    </li>
  `;
}

export function renderWelcomeAltLanguage(_params, target) {
  return screen(target, {
    step: "language",
    left: (sid) => {
      const d = getDraft(sid);
      const current = d?.primaryLanguage || (d?.languages || [])[0] || DEFAULT_LANGUAGE;
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">Which language do I write in?</h1>
        <p class="welcome-intro__sub">The one I'll draft your posts in. You can add more later, in your Playbook.</p>
        <form data-choice-form novalidate>
          <ul class="welcome-flow__options">
            ${LANGUAGE_OPTIONS.map((l) =>
              optionRow({
                name: "language",
                value: l,
                checked: l === current,
                lead: `<span class="welcome-flow__glyph is-icon"><i class="ap-icon-web" aria-hidden="true"></i></span>`,
                title: l,
                desc: `Posts in ${LANGUAGE_IN_ENGLISH[l] || l}`,
              }),
            )}
          </ul>
          ${actions(continueButton())}
        </form>
      `;
    },
    onSubmit: (e, sid) => {
      const lang = new FormData(e.target).get("language") || DEFAULT_LANGUAGE;
      patchDraft(sid, { languages: [lang], primaryLanguage: lang, language: lang });
      goNext("language");
    },
  });
}

// ── /welcome-alt/voice-from ──────────────────────────────────────────────
// Prod's second question (« How should I learn your voice? », 2026-10-29,
// asked: « Oui, comme en prod »): a connected profile's posts, a document the
// user wrote, or their own words used as written — or Skip, and the voice comes
// from the website. Each way asks its own follow-up on the same screen.

const VOICE_WAYS = [
  { value: "profile", icon: "ap-icon-user", title: "Learn from an account", desc: "I read its recent posts." },
  {
    value: "document",
    icon: "ap-icon-upload",
    title: "Use a document you wrote",
    desc: "A PDF, Word, text or Markdown file.",
  },
  {
    value: "custom",
    icon: "ap-icon-pen",
    title: "Describe it in your own words",
    desc: "I follow it exactly as you write it.",
  },
];

function pickDocument(onFile) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  });
  input.click();
}

// The way out says what it does (asked: « faut renommer le bouton ») — the
// voice comes from what the Playbook was built from.
function fallbackFor(sid) {
  const source = getDraft(sid)?.sourceType;
  if (source === "website") return { label: "Use my website", sub: "I'll take it from your website" };
  if (source === "interview") return { label: "Use my answers", sub: "I'll take it from your answers" };
  return { label: "Skip for now", sub: "skip it for now" };
}

export function renderWelcomeAltVoiceFrom(_params, target) {
  let view = "choose"; // "choose" | "profile" | "custom"
  const backToChoose = raw(html`
    <div class="welcome-flow__actions">
      <button type="button" class="ap-button ghost grey" data-voice-back>
        <i class="ap-icon-arrow-left"></i><span>Back</span>
      </button>
      ${raw(continueButton("Continue", { disabled: view === "custom" }))}
    </div>
  `);
  return screen(target, {
    step: "voiceFrom",
    left: (sid) => {
      if (view === "profile") {
        const accounts = voiceAccounts();
        const first = accounts.find((p) => p.postCount > 0)?.id;
        return html`
          <h1 class="welcome-flow__title" id="welcomeFlowTitle">Which account should I learn from?</h1>
          <p class="welcome-intro__sub">I read its recent posts and learn your voice from them.</p>
          <form data-voice-profile-form novalidate>
            <ul class="welcome-flow__options">
              ${accounts.map((p) =>
                optionRow({
                  name: "account",
                  value: p.id,
                  checked: p.id === first,
                  disabled: !p.postCount,
                  lead: `<span class="welcome-flow__glyph is-icon"><i class="${networkIcon(p.platform)}" aria-hidden="true"></i></span>`,
                  title: p.handle,
                  desc: p.postCount
                    ? `${p.platformLabel} · ${p.postCount} posts`
                    : `${p.platformLabel} · No posts to read yet`,
                }),
              )}
            </ul>
            ${backToChoose}
          </form>
        `;
      }
      if (view === "custom") {
        return html`
          <h1 class="welcome-flow__title" id="welcomeFlowTitle">Describe it in your own words</h1>
          <p class="welcome-intro__sub">I follow it exactly as you write it.</p>
          <form class="welcome-flow__answer" data-voice-custom-form novalidate>
            <div class="ap-textarea-field welcome-flow__textarea">
              <textarea
                name="answer"
                rows="5"
                placeholder="e.g. Candid and specific. Short paragraphs, no jargon. Confident but down-to-earth."
                aria-labelledby="welcomeFlowTitle"
                data-flow-autofocus
              ></textarea>
            </div>
            ${raw(html`
              <div class="welcome-flow__actions">
                <button type="button" class="ap-button ghost grey" data-voice-back>
                  <i class="ap-icon-arrow-left"></i><span>Back</span>
                </button>
                ${raw(continueButton("Continue", { disabled: true }))}
              </div>
            `)}
          </form>
        `;
      }
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">How should I learn your voice?</h1>
        <p class="welcome-intro__sub">
          Your voice is how your posts sound: the tone, the words, the length. Every draft I write follows it. Pick one,
          or ${fallbackFor(sid).sub}.
        </p>
        <ul class="welcome-flow__options">
          ${VOICE_WAYS.filter((w) => w.value !== "profile" || voiceAccounts().length).map(
            (w) => html`
              <li>
                <button type="button" class="welcome-flow__option" data-voice-way="${w.value}">
                  <span class="welcome-flow__glyph is-icon"><i class="${w.icon}" aria-hidden="true"></i></span>
                  <span class="welcome-flow__option-text">
                    <span class="welcome-flow__option-title">${w.title}</span>
                    <span class="welcome-flow__option-desc">${w.desc}</span>
                  </span>
                  <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
                </button>
              </li>
            `,
          )}
        </ul>
        ${actions("", { skip: fallbackFor(sid).label, skipClass: "secondary blue" })}
      `;
    },
    onInput: (e) => {
      const next = e.target.closest("[data-voice-custom-form]")?.querySelector("[data-flow-next]");
      if (next) next.disabled = !e.target.value.trim();
    },
    onSubmit: (e, sid) => {
      if (e.target.matches("[data-voice-profile-form]")) {
        const id = new FormData(e.target).get("account");
        if (!id) return;
        setAltVoiceSource(sid, { kind: "profile", id });
        return goNext("voiceFrom");
      }
      if (e.target.matches("[data-voice-custom-form]")) {
        const text = e.target.querySelector("textarea")?.value.trim();
        if (!text) return;
        setAltVoiceSource(sid, { kind: "custom", text });
        goNext("voiceFrom");
      }
    },
    onClick: (e, sid, shell) => {
      if (e.target.closest("[data-voice-back]")) {
        view = "choose";
        return shell.paint();
      }
      if (e.target.closest("[data-flow-skip]")) {
        setAltVoiceSource(sid, null);
        return goNext("voiceFrom");
      }
      const way = e.target.closest("[data-voice-way]")?.dataset.voiceWay;
      if (way === "document")
        return pickDocument((file) => {
          setAltVoiceSource(sid, { kind: "document", name: file.name });
          goNext("voiceFrom");
        });
      if (way) {
        view = way;
        shell.paint();
        target.querySelector("[data-flow-autofocus]")?.focus();
      }
    },
  });
}

// ── /welcome-alt/documents ───────────────────────────────────────────────

// Every step lists its choices the same way: one row under another, a title and
// what it is for. Here, what I'd read in each.
const DOC_CONNECTORS = ["slite", "notion", "gdrive", "slack"];
const DOC_READS = {
  slite: "Your brand book and wiki pages",
  notion: "Brand pages and guidelines",
  gdrive: "Brand books, decks, and PDFs",
  slack: "Channels where your team talks about the Brand",
};

export function renderWelcomeAltDocuments(_params, target) {
  return screen(target, {
    step: "documents",
    left: (sid) => {
      const picked = new Set(getDraft(sid)?.onboardingConnectors || []);
      const items = DOC_CONNECTORS.map((id) => connectorMocks.find((c) => c.id === id)).filter(Boolean);
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">Anything else I should read?</h1>
        <p class="welcome-intro__sub">
          A brand book or guidelines help me get the details right. Optional: you can connect more later.
        </p>
        <form data-choice-form novalidate>
          <ul class="welcome-flow__options">
            ${items.map((c) =>
              optionRow({
                type: "checkbox",
                name: "connector",
                value: c.id,
                checked: picked.has(c.id),
                lead: `<span class="welcome-flow__glyph"><img src="${escapeHtml(c.logo)}" alt="" /></span>`,
                title: c.name,
                desc: DOC_READS[c.id],
              }),
            )}
          </ul>
          ${actions(continueButton(), { skip: "Skip for now" })}
        </form>
      `;
    },
    onSubmit: (e, sid) => {
      patchDraft(sid, { onboardingConnectors: new FormData(e.target).getAll("connector") });
      goNext("documents");
    },
    onClick: (e) => {
      if (e.target.closest("[data-flow-skip]")) goNext("documents");
    },
  });
}
