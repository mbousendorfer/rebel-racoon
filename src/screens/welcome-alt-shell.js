// The onboarding shell. Every screen of the first-time
// flow (brand → language → documents → ready → the reviews) is the same
// split: the step on the left, Archie's stage on the right, where the Playbook
// card fills in with the user's REAL answers as they go — the networks it
// posts on, the site's name and voice once it's read, the colours. The intro
// (/welcome-alt/intro) shows the same card filled with an example.
//
// One draft for the whole run, in context-builder (createAltDraft…), keyed by
// the session id the recap already uses (`welcomeAltSessionId`), and persisted
// on every change so a reload lands on the same step with the same answers.

import { html, raw } from "../utils.js?v=2857";
import { getPath, navigate } from "../router.js?v=2857";
import { parseHashParams } from "../url-state.js?v=2857";
import { altSteps, createAltDraft, getDraft, restoreDraft, subscribeDraft } from "../context-builder.js?v=2857";
import { getConnectedProfiles } from "../social-profiles.js?v=2857";
import {
  readSessionId,
  isIntegrated,
  readReturnTo,
  persistDraft,
  readPersistedDraft,
  LOADING_STAGES,
  FILE_LOADING_STAGES,
  INTERVIEW_LOADING_STAGES,
} from "./welcome-alt-recap.js?v=2857";
import { paintExplainer } from "./welcome-alt-explainer.js?v=2857";
import { setTopbarActions } from "../components/topbar.js?v=2857";

const PREFILLED_URL = "https://nicesoap.com";
const SESSION_KEY = "welcomeAltSessionId";

// What each step is called, everywhere it's named (the intro's list, the
// progress, each screen's title). `step`: its short name in the stepper.
export const STEP_TEXT = {
  url: { step: "Website", title: "Share your website", desc: "Your website, a few files, or a handful of questions." },
  language: { step: "Language", title: "Pick your language", desc: "The one I'll write your posts in." },
  documents: { step: "Documents", title: "Add brand documents", desc: "Optional: a brand book or guidelines." },
  voiceFrom: {
    step: "Voice source",
    title: "Choose how I learn your voice",
    desc: "Your posts, a document, or your own words.",
  },
  voice: {
    step: "Voice",
    title: "Check your voice",
    // Flag OFF there is one voice, not one per network: say it the review's way.
    // (Flags change with a reload, so reading it at load is enough.)
    desc: "How you sound, on every network.",
  },
  recap: { step: "Review", title: "Check what I learned", desc: "Fix anything that's off before I write." },
};

const ROUTE = {
  url: "/welcome-alt/brand",
  language: "/welcome-alt/language",
  documents: "/welcome-alt/documents",
  voiceFrom: "/welcome-alt/voice-from",
  voice: "/welcome-alt/voice",
  recap: "/welcome-alt/ready",
};

// The run, in order, under the flags of the moment: the chat's own steps (no
// account step: the first draft asks), the reveal and the Playbook's review,
// then the Voice's own review — where you post is asked there (2026-10-29).
// The run, in order, under the flags of the moment: the steps before the
// reveal, the reveal and the Playbook's review, then the Voice's own review.
export function flowSteps() {
  // The voice source is asked after the source, as in prod's wizard (2026-10-29).
  return [...altSteps().filter((id) => ROUTE[id]), "voiceFrom", "recap", "voice"];
}

// The connected accounts a voice can be learned from: prod reads LinkedIn,
// Facebook and Instagram (voice-accounts.ts), the ones with posts first.
const VOICE_NETWORKS = new Set(["linkedin", "facebook", "instagram"]);
export function voiceAccounts() {
  return getConnectedProfiles()
    .filter((p) => VOICE_NETWORKS.has(p.platform))
    .sort((a, b) => (b.postCount || 0) - (a.postCount || 0));
}

function goTo(step) {
  navigate(ROUTE[step]);
}
export function goNext(step) {
  const steps = flowSteps();
  goTo(steps[steps.indexOf(step) + 1] || "recap");
}
export function goBack(step) {
  const steps = flowSteps();
  const prev = steps[steps.indexOf(step) - 1];
  if (prev) goTo(prev);
  else if (isIntegrated()) navigate(readReturnTo() || "/");
  else navigate("/welcome-alt/intro");
}

// A fresh run — from the intro's "Let's go", or (`returnTo`) a returning user's
// « Create a Playbook »: the same run, saved and handed back on finish.
export function startFlow({ returnTo = null } = {}) {
  const sid = `welcome-alt-${Date.now().toString(36)}`;
  try {
    window.sessionStorage.setItem(SESSION_KEY, sid);
    if (returnTo) {
      window.sessionStorage.setItem("welcomeAltIntegrated", "1");
      window.sessionStorage.setItem("welcomeAltReturnTo", returnTo);
    } else {
      window.sessionStorage.removeItem("welcomeAltIntegrated");
      window.sessionStorage.removeItem("welcomeAltReturnTo");
    }
  } catch {
    /* ignore */
  }
  createAltDraft(sid, { prefilledUrl: PREFILLED_URL });
  persistDraft(sid);
  return sid;
}

// The run's draft: the live one, else the one saved before a reload, else a new
// run (a deep link straight onto a step).
export function ensureFlowDraft() {
  // A returning user's « Create a Playbook » (context-builder
  // openNewPlaybookFlow, `?new=<where to go back>`): a fresh run, once.
  const back = parseHashParams().get("new");
  if (back) {
    history.replaceState(null, "", `#${window.location.hash.slice(1).split("?")[0]}`);
    return startFlow({ returnTo: back });
  }
  const sid = readSessionId();
  if (sid && getDraft(sid)) return sid;
  const snap = sid && readPersistedDraft(sid);
  if (snap) {
    restoreDraft(sid, snap);
    return sid;
  }
  return startFlow();
}

// The building stages on /welcome-alt/ready, by source — they tick on the left
// and say when each analysed line of the card lands (a stage's `lands`).
export function stagesFor(d) {
  if (d?.sourceType === "documents") return FILE_LOADING_STAGES;
  if (d?.sourceType === "interview") return INTERVIEW_LOADING_STAGES;
  return LOADING_STAGES;
}

// ── The parts' colours ────────────────────────────────────────────────────

// One tint per Playbook part, shared by the review (its list tiles, its card
// bands) and the card's row labels: a row wears the colour of the part it
// fills. The -20 for the tile, the -150 for its glyph; never electric blue.
const PART_TINT = {
  goals: "orange",
  voice: "purple",
  brand: "menthol",
  competitors: "yellow",
  influencers: "soft-blue",
};
export const tint = (id) =>
  PART_TINT[id]
    ? `--part-tint: var(--ref-color-${PART_TINT[id]}-20); --part-ink: var(--ref-color-${PART_TINT[id]}-150)`
    : "";

export const domainOf = (url) =>
  String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

function renderProgress(step, { all = false } = {}) {
  const steps = flowSteps();
  const at = steps.indexOf(step);
  // The DS stepper: done = completed + check, the current one active, the rest
  // pending. In the column only the current step shows its name (too narrow for
  // all); in the topbar (`all`) every step does.
  return html`
    <nav
      class="ap-stepper welcome-flow__progress ${all ? "is-all" : ""}"
      aria-label="Step ${at + 1} of ${steps.length}"
    >
      ${raw(
        steps
          .map((id, i) => {
            const state = i < at ? "completed" : i === at ? "active" : "pending";
            return html`<div
              class="ap-stepper-item ${state}"
              title="${STEP_TEXT[id].title}"
              ${i === at ? raw('aria-current="step"') : ""}
            >
              <span>${i < at ? raw(`<i class="ap-icon-check" aria-hidden="true"></i>`) : i + 1}</span>
              <span class="welcome-flow__step-label">${STEP_TEXT[id].step}</span>
            </div>`;
          })
          .join(`<span class="ap-stepper-separator" aria-hidden="true"><i class="ap-icon-chevron-right"></i></span>`),
      )}
    </nav>
  `;
}

// Paint the shell into `target` once; `left()` is repainted by `paint()`, the
// card on every change to the draft.
// `sheet`: the review (/welcome-alt/recap) — the same stage, no card around:
// the part's blocks, dealt as a stack, floating on the pixels.
// `build`: /welcome-alt/ready's stages ({ at, done }), which gate the card.
// Returns { paint, sheet, cleanup }.
// One run for a first-time user and a returning user's « Create a Playbook »
// (2026-11-04, asked: « il n'y a pas de raison d'en avoir 2 différents »): a
// plain stage, no pixels; each step plays a scene
// that teaches the Playbook's parts (welcome-alt-explainer.js) instead of the
// card filling in. Only the frame differs: the first time is full-bleed with
// the stepper in the column, a returning user's run (`isIntegrated()`) sits in
// the app's chrome with the stepper in the topbar.
export function mountShell(target, { step, sid, left, sheet = false, build }) {
  const integrated = isIntegrated();
  target.innerHTML = html`
    <div class="welcome-intro welcome-flow ${sheet ? "is-review" : ""}">
      <section class="welcome-intro__lede" aria-labelledby="welcomeFlowTitle">
        <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
        <div class="welcome-intro__copy welcome-flow__copy">
          ${integrated ? "" : raw(renderProgress(step))}
          <div data-flow-left></div>
          <!-- One status node that outlives the left column's repaints: a live
               region rebuilt with its text already in it is not announced. -->
          <p class="welcome-intro__hidden" role="status" data-flow-status></p>
        </div>
      </section>
      <div class="welcome-intro__stage">
        ${sheet
          ? raw(`<div class="welcome-flow__sheet" data-flow-sheet>
              <div class="welcome-flow__sheet-body" data-flow-sheet-body></div>
            </div>`)
          : raw(`<div class="welcome-explainer" data-flow-explainer></div>`)}
      </div>
    </div>
  `;
  // A returning user's run sits in the app's chrome: the stepper goes to the
  // topbar, after the title, where every step can be named (2026-11-03).
  if (integrated) {
    setTopbarActions(getPath(), "", {
      left: `<h1 class="app-topbar__title">New Playbook</h1><span class="welcome-flow__topbar-rule" aria-hidden="true"></span>${renderProgress(step, { all: true })}`,
    });
  }
  const leftEl = target.querySelector("[data-flow-left]");
  const sceneEl = target.querySelector("[data-flow-explainer]");
  const paintCard = () => {
    if (sceneEl) paintExplainer(sceneEl, step, getDraft(sid), build?.());
  };
  const paint = () => {
    leftEl.innerHTML = left();
    paintCard();
  };
  paint();
  const offDraft = subscribeDraft(sid, () => {
    persistDraft(sid);
    paintCard();
  });
  return {
    paint,
    sheet: target.querySelector("[data-flow-sheet]"),
    cleanup: () => {
      offDraft();
      if (integrated) setTopbarActions(null);
    },
  };
}
