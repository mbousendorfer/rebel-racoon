// The middle of the first-time run — flag connectFirst. One screen per step, in
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

import { html, raw, escapeHtml } from "../utils.js?v=2271";
import { navigate } from "../router.js?v=2271";
import {
  getDraft,
  patchDraft,
  readAltWebsite,
  readAltFiles,
  writeAltManually,
  analyzeAltInterview,
} from "../context-builder.js?v=2271";
import { nextInterviewQuestion } from "../context-mock-analysis.js?v=2271";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "../languages.js?v=2271";
import { connectors as connectorMocks } from "../mocks.js?v=2271";
import { ensureFlowDraft, goBack, goNext, mountShell, STEP_TEXT } from "./welcome-alt-shell.js?v=2271";

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
const actions = (primary, { skip = "" } = {}) =>
  raw(html`
    <div class="welcome-flow__actions">
      <button type="button" class="ap-button ghost grey" data-flow-back>
        <i class="ap-icon-arrow-left"></i><span>Back</span>
      </button>
      ${skip
        ? raw(`<button type="button" class="ap-button ghost grey" data-flow-skip>${escapeHtml(skip)}</button>`)
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
        field?.setAttribute("aria-invalid", "true");
        field?.focus();
        return;
      }
      readAltWebsite(sid, url);
      goNext("url");
    },
    onInput: (e) => e.target.removeAttribute?.("aria-invalid"),
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
          <textarea
            class="ap-textarea-field welcome-flow__textarea"
            name="answer"
            rows="4"
            placeholder="In your own words…"
            aria-labelledby="welcomeFlowTitle"
            data-flow-autofocus
          ></textarea>
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

function optionRow({ name, value, checked, type = "radio", lead, title, desc = "", badge = "" }) {
  const control =
    type === "radio"
      ? `<span class="ap-radio-container"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${checked ? "checked" : ""} /></span>`
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
          A brand book or guidelines help me get the details right. Optional — you can connect more later.
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
