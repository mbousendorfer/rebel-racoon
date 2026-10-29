// The middle of the first-time run — flag connectFirst. One screen per step, in
// the onboarding shell (welcome-alt-shell.js); each step's effect on the draft
// is context-builder's (readAltWebsite, readAltFiles, writeAltManually,
// analyzeAltInterview), the same moves the chat onboarding makes.
//
//   /welcome-alt/networks   where the brand posts, and its main network
//                           (nothing to connect: the first draft asks)
//   /welcome-alt/brand      the website (prefilled), or files, a short
//                           interview, or by hand
//   /welcome-alt/interview  no website: one question at a time
//   /welcome-alt/language   flag multilingualPlaybook
//   /welcome-alt/documents  optional
//   /welcome-alt/voice      the default voice, then rules for each network
//                           (flag voicePerNetwork), the main one first
//
// Friction, removed on purpose: the website is the field, not the 4th option;
// the analysis starts on submit and runs while the next steps are answered;
// Enter submits; nothing on these screens leaves the run by accident (no Esc
// exit); Back always keeps what was answered.

import { html, raw, escapeHtml } from "../utils.js?v=2361";
import { navigate } from "../router.js?v=2361";
import {
  getDraft,
  patchDraft,
  isAnalysisReady,
  readAltWebsite,
  readAltFiles,
  writeAltManually,
  analyzeAltInterview,
} from "../context-builder.js?v=2361";
import { nextInterviewQuestion } from "../context-mock-analysis.js?v=2361";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "../languages.js?v=2361";
import { connectors as connectorMocks } from "../mocks.js?v=2361";
import { NETWORKS, networkLabel } from "../social-profiles.js?v=2361";
import { brandVoiceAsIs, mainNetwork, networkVoice, networkVoiceOn, playbookNetworks } from "../voice-parts.js?v=2361";
import { voiceChoices } from "../network-voice-flow.js?v=2361";
import { learnedVoiceHtml, voiceAskHtml } from "../components/voice-intro-modal.js?v=2361";
import { openVoiceInterview, openVoiceProposal } from "../components/voice-proposal-modal.js?v=2361";
import { ensureFlowDraft, goBack, goNext, mountShell, STEP_TEXT, voiceTraits } from "./welcome-alt-shell.js?v=2361";

// Wire one screen: the shell, a click handler, an optional submit / change.
// `mounted(shell, sid)`: once painted; may return its own cleanup.
function screen(target, { step, left, onClick, onSubmit, onChange, onInput, onKeydown, mounted }) {
  const sid = ensureFlowDraft();
  const shell = mountShell(target, { step, sid, left: () => left(sid) });
  const off = mounted?.(shell, sid);
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
    off?.();
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

// ── /welcome-alt/networks ────────────────────────────────────────────────
// Where the brand posts, and the network that matters most: first in
// `connectedSocials` (voice-parts.js mainNetwork). Nothing is connected here,
// the first draft asks for an account (connect-profiles-flow.js).

const netGlyph = (id) =>
  `<span class="welcome-flow__glyph"><i class="${NETWORKS[id].icon}" aria-hidden="true"></i></span>`;

export function renderWelcomeAltNetworks(_params, target) {
  return screen(target, {
    step: "networks",
    left: (sid) => {
      const nets = playbookNetworks(getDraft(sid));
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">Where do you post?</h1>
        <p class="welcome-intro__sub">
          I'll write for each network you pick. Nothing to connect yet: I'll ask for an account when your first post is
          ready.
        </p>
        <form data-choice-form novalidate>
          <ul class="welcome-flow__options is-grid" aria-label="Networks">
            ${Object.keys(NETWORKS).map((id) =>
              optionRow({
                type: "checkbox",
                name: "network",
                value: id,
                checked: nets.includes(id),
                lead: netGlyph(id),
                title: NETWORKS[id].label,
              }),
            )}
          </ul>
          ${nets.length > 1
            ? raw(html`
                <p class="welcome-flow__or" id="welcomeMainNet">Which one matters most? I'll set up its voice first.</p>
                <ul class="welcome-flow__options is-grid" aria-labelledby="welcomeMainNet">
                  ${nets.map((id) =>
                    optionRow({
                      name: "main",
                      value: id,
                      checked: id === nets[0],
                      lead: netGlyph(id),
                      title: NETWORKS[id].label,
                    }),
                  )}
                </ul>
              `)
            : ""}
          ${actions(continueButton("Continue", { disabled: !nets.length }))}
        </form>
      `;
    },
    onChange: (e, sid, shell) => {
      const data = new FormData(e.target.form);
      const picked = data.getAll("network");
      // The main one: the radio, else the one that was main, else the first left.
      const main = [data.get("main"), mainNetwork(getDraft(sid)), picked[0]].find((n) => n && picked.includes(n));
      patchDraft(sid, { connectedSocials: main ? [main, ...picked.filter((n) => n !== main)] : [] });
      shell.paint();
      target.querySelector(`input[name="${e.target.name}"][value="${e.target.value}"]`)?.focus();
    },
    onSubmit: (_e, sid) => {
      if (playbookNetworks(getDraft(sid)).length) goNext("networks");
    },
  });
}

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

// ── /welcome-alt/voice ───────────────────────────────────────────────────
// The default voice is read from the source (it lands on the card here), and
// every network starts from it. Flag voicePerNetwork: the same voice
// everywhere, or rules for each network, one network open at a time, the main
// one first; the ways in are the creation review's (Adapt · questions; no
// account yet, so no posts to learn from). What Archie proposes lands on the
// draft on « Add to Voice profile »; a network left alone asks before its
// first draft. The review reads the same draft, nothing is asked twice.

const READ_FROM = { website: "your site", documents: "your files", interview: "your answers" };
const andList = (items) => new Intl.ListFormat("en", { type: "conjunction" }).format(items);

export function renderWelcomeAltVoice(_params, target) {
  let open; // the network whose card is open; undefined → the first without rules

  const nets = (d) => (networkVoiceOn() ? playbookNetworks(d) : []);
  const each = (d) => d.voiceSplit !== "same";
  const firstOpen = (d) => nets(d).find((n) => networkVoice(d, n).state !== "own") ?? null;

  // A network: its card when open (the card names it), else a row that opens it.
  const netRow = (d, net) => {
    const { state } = networkVoice(d, net);
    const label = networkLabel(net);
    const main = net === nets(d)[0] && nets(d).length > 1;
    if (net === open) {
      const card =
        state === "own"
          ? `${learnedVoiceHtml(d, net, null, { pending: false })}
             <div class="welcome-flow__actions"><button type="button" class="ap-button ghost grey" data-voice-ask="${escapeHtml(net)}" data-voice-choice="reset">Use my default voice instead</button></div>`
          : voiceAskHtml(d, net, {
              id: net,
              choices: voiceChoices(net).items.filter((c) => c.value !== "document" && c.value !== "edit"),
              line: main
                ? `Your main network, so let's start here. Until you add rules, your ${label} posts follow your default voice.`
                : `Until you add rules, your ${label} posts follow your default voice. Left as is, I'll ask before your first ${label} post.`,
              later: null,
            });
      return html`<li class="welcome-flow__voice-net">${raw(card)}</li>`;
    }
    const desc = [
      main ? "Your main network" : "",
      state === "own" ? "Rules added" : d.voiceByNetwork?.[net] ? "Your default voice" : "No rules yet",
    ]
      .filter(Boolean)
      .join(" · ");
    return html`
      <li>
        <button type="button" class="welcome-flow__option" data-voice-open="${net}" aria-expanded="false">
          ${raw(netGlyph(net))}
          <span class="welcome-flow__option-text">
            <span class="welcome-flow__option-title">Rules for ${label}</span>
            <span class="welcome-flow__option-desc">${desc}</span>
          </span>
          <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
        </button>
      </li>
    `;
  };

  return screen(target, {
    step: "voice",
    left: (sid) => {
      const d = getDraft(sid);
      if (!isAnalysisReady(sid)) {
        return html`
          <h1 class="welcome-flow__title" id="welcomeFlowTitle">${STEP_TEXT.voice.title}</h1>
          <p class="welcome-intro__sub">One moment, I'm still reading how you sound.</p>
          <span class="ap-loader small" aria-label="Reading"></span>
          ${actions("")}
        `;
      }
      if (open === undefined) open = firstOpen(d);
      const traits = voiceTraits(d).map((t) => t.toLowerCase());
      const list = nets(d);
      const names = andList(list.map(networkLabel));
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">${STEP_TEXT.voice.title}</h1>
        <p class="welcome-intro__sub">
          ${traits.length
            ? `I read your default voice from ${READ_FROM[d.sourceType] || "your Brand"}: ${andList(traits)}. Every network starts from it.`
            : "Your default voice is on your Playbook. Every network starts from it."}
        </p>
        <form data-choice-form novalidate>
          ${list.length
            ? raw(html`
                <ul class="welcome-flow__options" role="radiogroup" aria-label="Rules per network">
                  ${[
                    optionRow({
                      name: "split",
                      value: "same",
                      checked: !each(d),
                      lead: `<span class="welcome-flow__glyph is-icon"><i class="ap-icon-quote" aria-hidden="true"></i></span>`,
                      title: "The same voice everywhere",
                      desc: `I write for ${names} in your default voice.`,
                    }),
                    optionRow({
                      name: "split",
                      value: "each",
                      checked: each(d),
                      lead: `<span class="welcome-flow__glyph is-icon"><i class="ap-icon-sparkles" aria-hidden="true"></i></span>`,
                      title: "Rules for each network",
                      desc: "Your default voice, plus what works on each one.",
                    }),
                  ]}
                </ul>
                ${each(d)
                  ? raw(html`
                      <p class="welcome-flow__or">Your networks</p>
                      <ul class="welcome-flow__options">
                        ${list.map((n) => netRow(d, n))}
                      </ul>
                    `)
                  : ""}
              `)
            : ""}
          ${actions(continueButton())}
        </form>
      `;
    },
    onChange: (e, sid, s) => {
      if (e.target.name !== "split") return;
      const d = getDraft(sid);
      // The same voice everywhere: every network keeps the default voice,
      // chosen. Back to rules for each: what was kept that way goes.
      patchDraft(sid, {
        voiceSplit: e.target.value,
        voiceByNetwork:
          e.target.value === "same"
            ? Object.fromEntries(nets(d).map((n) => [n, brandVoiceAsIs(d)]))
            : Object.fromEntries(Object.entries(d.voiceByNetwork || {}).filter(([, v]) => v.optimizedBy !== "brand")),
      });
      open = undefined;
      s.paint();
    },
    onClick: (e, sid, s) => {
      const toggle = e.target.closest("[data-voice-open]")?.dataset.voiceOpen;
      if (toggle) {
        open = toggle;
        return s.paint();
      }
      const pick = e.target.closest("[data-voice-choice]");
      if (!pick) return;
      const net = pick.dataset.voiceAsk;
      const choice = pick.dataset.voiceChoice;
      const d = getDraft(sid);
      // Added: the next network without rules opens.
      const set = (voice) => {
        patchDraft(sid, { voiceByNetwork: { ...(d.voiceByNetwork || {}), [net]: voice } });
        open = choice === "reset" ? net : firstOpen(getDraft(sid));
        s.paint();
      };
      if (choice === "reset") return set(brandVoiceAsIs(d));
      if (choice === "interview")
        return openVoiceInterview({
          net,
          onDone: (answers) => openVoiceProposal({ ctx: d, net, choice, from: answers, onUse: set }),
        });
      openVoiceProposal({ ctx: d, net, choice, onUse: set });
    },
    onSubmit: () => goNext("voice"),
    // Still reading: repaint once the analysis lands.
    mounted: (s, sid) => {
      if (isAnalysisReady(sid)) return null;
      const timer = window.setInterval(() => {
        if (!isAnalysisReady(sid)) return;
        window.clearInterval(timer);
        s.paint();
      }, 200);
      return () => window.clearInterval(timer);
    },
  });
}
