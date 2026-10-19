// First Time User ALT — Playbook reveal. Reached at the end of the
// 3-question chat flow (context-builder.startAlt). Thin onboarding wrapper
// over the shared playbook-view engine: it supplies a DRAFT data source, a
// staged loader, reload-rehydration, and the "Enter Archie" finish. The
// actual rendering + per-card edit machine lives in ../playbook-view.js.

import { navigate } from "../router.js?v=1995";
import { catalogueRoute } from "../active-playbook.js?v=1995";
import { getDraft, isAnalysisReady, save, patchDraft, restoreDraft } from "../context-builder.js?v=1995";
import { mount } from "../playbook-view.js?v=1995";
import { isFlagOn } from "../feature-flags.js?v=1995";
import { renderReview } from "./welcome-alt-review.js?v=1995";
import { open as openRenameModal } from "../components/rename-modal.js?v=1995";
import { networkLabel } from "../network-voice.js?v=1995";

const WELCOME_ALT_KEY = "welcomeAltSessionId";
const WELCOME_ALT_DRAFT_KEY = "welcomeAltDraft";
const WELCOME_ALT_INTEGRATED_KEY = "welcomeAltIntegrated";
const WELCOME_ALT_RETURN_KEY = "welcomeAltReturnTo";

export const LOADING_STAGES = [
  { title: "Reading your website", sub: "Scanning your pages, copy, and brand cues." },
  { title: "Learning your voice", sub: "Capturing your tone, vocabulary, and rhythm." },
  { title: "Mapping your audience", sub: "Working out who you're for — and what moves them." },
  { title: "Building your Playbook", sub: "Turning it all into a Playbook every draft draws from." },
];

// Brand kit (flag sexySquirrel): a Playbook started from files says so, instead
// of claiming to read a website nobody gave.
export const FILE_LOADING_STAGES = [
  { title: "Reading your files", sub: "Looking at your logo, past visuals, and photos." },
  { title: "Picking out your colors", sub: "Sampling the palette your visuals already use." },
  { title: "Mapping your audience", sub: "Working out who you're for — and what moves them." },
  { title: "Building your Playbook", sub: "Turning it all into a Playbook every draft draws from." },
];

// The no-website interview: the loader reads the
// answers, and says the brand look comes later — there was nothing to sample.
export const INTERVIEW_LOADING_STAGES = [
  { title: "Reading your answers", sub: "Turning what you told me into a strategy brief." },
  { title: "Setting up your brand", sub: "You can add your logo and colors to the Playbook later." },
  { title: "Drafting your Playbook", sub: "Audience, goals and voice, from your own words." },
];

// Voice per network: when Archie adapted the voice for other networks, the
// loader says so right after learning it — the work the reveal then shows.
export function withNetworkStage(stages, draft) {
  const nets = Object.keys(draft?.voiceByNetwork || {}).map(networkLabel);
  if (!nets.length) return stages;
  const list =
    nets.length === 1
      ? nets[0]
      : `${nets.slice(0, -1).join(", ")}${nets.length > 2 ? "," : ""} and ${nets[nets.length - 1]}`;
  const at = stages.findIndex((st) => st.title === "Learning your voice");
  const stage = { title: "Adapting your voice", sub: `Tuning it for ${list} — each network gets its own version.` };
  return at < 0 ? stages : [...stages.slice(0, at + 1), stage, ...stages.slice(at + 1)];
}

let introDoneSid = null; // sid whose intro loader has already played

export function renderWelcomeAltRecap(_params, target) {
  const integrated = isIntegrated();
  // First-time onboarding is full-bleed; the integrated New-Playbook flow
  // keeps the app shell (sidebar + topbar) — app.js skips the onboarding
  // class when welcomeAltIntegrated is set, so we don't add it here either.
  if (!integrated) document.body.classList.add("onboarding");
  const sid = readSessionId();
  if (!sid) {
    navigate("/welcome-alt");
    return () => {};
  }

  // On reload the in-memory draft is gone — rehydrate from the persisted
  // snapshot so a refresh stays on this step instead of bouncing to the chat.
  let restored = false;
  if (!getDraft(sid)) {
    const snap = readPersistedDraft(sid);
    if (snap) {
      restoreDraft(sid, snap);
      restored = true;
    } else {
      navigate("/welcome-alt");
      return () => {};
    }
  }

  // "Fill it in myself" has nothing to analyse: no loader, straight to the fiche.
  const source = getDraft(sid)?.sourceType;
  // `revealed`: the onboarding's own reveal (/welcome-alt/ready, flag
  // connectFirst) already showed the building — the details open straight.
  const skipLoader =
    restored ||
    source === "manual" ||
    getDraft(sid)?.revealed === true ||
    (introDoneSid === sid && isAnalysisReady(sid));
  if (skipLoader) introDoneSid = sid;

  const config = {
    mode: "onboarding",
    getData: () => getDraft(sid),
    isReady: () => isAnalysisReady(sid),
    commit: () => {}, // the draft is the live source; Save just exits edit
    revert: (snapshot) => patchDraft(sid, snapshot),
    onPaint: () => {
      if (isAnalysisReady(sid)) persistDraft(sid);
    },
    loader:
      source === "documents"
        ? FILE_LOADING_STAGES
        : source === "interview"
          ? INTERVIEW_LOADING_STAGES
          : withNetworkStage(LOADING_STAGES, getDraft(sid)),
    skipLoader,
    onIntroDone: () => {
      introDoneSid = sid;
    },
    showTop: !integrated,
    onEditName: () => {
      const d = getDraft(sid);
      openRenameModal({
        title: "Rename Playbook",
        initialName: d?.name || "",
        placeholder: "Playbook name",
        confirmLabel: "Save name",
        onSubmit: (name) => patchDraft(sid, { name }),
      });
    },
    // The finish CTA lives in the header action bar (top-right) — the same
    // slot the library detail uses for its edit actions, so future edit
    // buttons on this page sit alongside it.
    headerActions: () =>
      integrated
        ? `<button type="button" class="ap-button primary orange" data-welcome-done><span>Save Playbook</span></button>`
        : `<button type="button" class="ap-button primary orange" data-welcome-done>
        <span>Save Playbook and start</span>
        <i class="ap-icon-arrow-right"></i>
      </button>`,
    onFooter: (event) => {
      if (event.target.closest("[data-welcome-done]")) {
        if (integrated) finishIntegrated(sid);
        else enterArchie(sid);
        return true;
      }
      return false;
    },
  };
  // Flag connectFirst: the review is the run's last screen, in its split.
  if (isFlagOn("connectFirst") && !integrated) return renderReview(target, sid, config);
  return mount(target, config);
}

// New Playbook (integrated) finish — persist the Playbook and return to the
// page the flow was launched from, WITHOUT switching user mode or reloading
// (the user is already a returning user). Mirrors enterArchie's save path.
function finishIntegrated(sid) {
  patchDraft(sid, { onComplete: null });
  const saved = save(sid);
  if (!saved) return;
  const returnTo = readReturnTo();
  clearSessionId();
  clearPersistedDraft();
  clearIntegrated();
  navigate(returnTo || catalogueRoute());
}

// "Enter Archie" — persist the Playbook, then finish the ALT flow: become a
// returning user and reload into the populated app. The recap owns this
// (rather than the draft's onComplete) so it still works after a reload,
// where the in-memory onComplete is gone.
export function enterArchie(sid) {
  patchDraft(sid, { onComplete: null });
  const saved = save(sid);
  if (!saved) return;
  clearSessionId();
  clearPersistedDraft();
  document.body.classList.remove("onboarding");
  try {
    window.localStorage.removeItem("archie-user-mode");
  } catch {
    /* ignore */
  }
  window.location.hash = "#/";
  window.location.reload();
}

// ── sessionStorage bridges ─────────────────────────────────────────────

export function readSessionId() {
  try {
    return window.sessionStorage.getItem(WELCOME_ALT_KEY);
  } catch {
    return null;
  }
}

function clearSessionId() {
  try {
    window.sessionStorage.removeItem(WELCOME_ALT_KEY);
  } catch {
    /* ignore */
  }
}

// Draft persistence — so a page reload stays on the recap. JSON.stringify
// drops the onComplete function automatically.
export function persistDraft(sid) {
  try {
    const d = getDraft(sid);
    if (!d) return;
    window.sessionStorage.setItem(WELCOME_ALT_DRAFT_KEY, JSON.stringify({ sid, draft: d }));
  } catch {
    /* ignore */
  }
}

export function readPersistedDraft(sid) {
  try {
    const raw = window.sessionStorage.getItem(WELCOME_ALT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.sid === sid ? parsed.draft : null;
  } catch {
    return null;
  }
}

function clearPersistedDraft() {
  try {
    window.sessionStorage.removeItem(WELCOME_ALT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// Integrated New-Playbook mode (set by the /contexts + composer create
// entry points) vs full-bleed first-time onboarding.
function isIntegrated() {
  try {
    return window.sessionStorage.getItem(WELCOME_ALT_INTEGRATED_KEY) === "1";
  } catch {
    return false;
  }
}

function readReturnTo() {
  try {
    return window.sessionStorage.getItem(WELCOME_ALT_RETURN_KEY) || "";
  } catch {
    return "";
  }
}

function clearIntegrated() {
  try {
    window.sessionStorage.removeItem(WELCOME_ALT_INTEGRATED_KEY);
    window.sessionStorage.removeItem(WELCOME_ALT_RETURN_KEY);
  } catch {
    /* ignore */
  }
}
