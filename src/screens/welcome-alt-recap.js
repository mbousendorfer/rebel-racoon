// First Time User ALT — Playbook reveal. Reached at the end of the
// 3-question chat flow (context-builder.startAlt). Thin onboarding wrapper
// over the shared playbook-view engine: it supplies a DRAFT data source, a
// staged loader, reload-rehydration, and the "Enter Archie" finish. The
// actual rendering + per-card edit machine lives in ../playbook-view.js.

import { navigate } from "../router.js?v=2360";
import { catalogueRoute } from "../active-playbook.js?v=2360";
import {
  getDraft,
  isAnalysisReady,
  save,
  patchDraft,
  restoreDraft,
  sectionPatchFromAnalysis,
} from "../context-builder.js?v=2360";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=2360";
import { isFlagOn } from "../feature-flags.js?v=2360";
import { renderReview } from "./welcome-alt-review.js?v=2360";
import { open as openRenameModal } from "../components/rename-modal.js?v=2360";
import { getConnectedProfiles, networkIcon, networkLabel, normalizeNetwork } from "../social-profiles.js?v=2360";
import {
  brandVoiceAsIs,
  learnNetworkVoice,
  networkVoice,
  networkVoiceOn,
  playbookNetworks,
} from "../voice-parts.js?v=2360";
import { analyzeDocument, analyzeSocialProfiles } from "../context-mock-analysis.js?v=2360";
import { accountIdsForNetwork } from "../connect-profiles-flow.js?v=2360";
import { open as openAnalyzeProfilesModal } from "../components/analyze-profiles-modal.js?v=2360";
import { open as openFillDocumentModal } from "../components/fill-document-modal.js?v=2360";
import { open as openConnectAccountModal } from "../components/connect-account-modal.js?v=2360";
import { openVoiceInterview, openVoiceProposal } from "../components/voice-proposal-modal.js?v=2360";
import { showToast } from "../components/toast.js?v=2360";

const WELCOME_ALT_KEY = "welcomeAltSessionId";
const WELCOME_ALT_DRAFT_KEY = "welcomeAltDraft";
const WELCOME_ALT_INTEGRATED_KEY = "welcomeAltIntegrated";
const WELCOME_ALT_RETURN_KEY = "welcomeAltReturnTo";

// `lands`: the lines of the onboarding's Playbook card (flag connectFirst,
// welcome-alt-shell.js) that land once the stage is done — a line no stage
// names lands as soon as it's known (the site's colours, the competitors).
export const LOADING_STAGES = [
  { title: "Reading your website", sub: "Scanning your pages, copy, and brand cues.", lands: ["summary"] },
  { title: "Learning your voice", sub: "Capturing your tone, vocabulary, and rhythm.", lands: ["voice"] },
  {
    title: "Mapping your audience",
    sub: "Working out who you're for, and what moves them.",
    lands: ["audience", "goal"],
  },
  { title: "Putting it together", sub: "Turning it all into a Playbook every draft draws from." },
];

// Brand kit (flag sexySquirrel): a Playbook started from files says so, instead
// of claiming to read a website nobody gave.
export const FILE_LOADING_STAGES = [
  { title: "Reading your files", sub: "Looking at your logo, past visuals, and photos.", lands: ["summary"] },
  { title: "Picking out your colors", sub: "Sampling the palette your visuals already use.", lands: ["branding"] },
  {
    title: "Mapping your audience",
    sub: "Working out who you're for, and what moves them.",
    lands: ["audience", "goal"],
  },
  { title: "Putting it together", sub: "Turning it all into a Playbook every draft draws from.", lands: ["voice"] },
];

// The no-website interview: the loader reads the
// answers, and says the brand look comes later — there was nothing to sample.
export const INTERVIEW_LOADING_STAGES = [
  { title: "Reading your answers", sub: "Turning what you told me into your Brief.", lands: ["summary"] },
  {
    title: "Setting up your Brand",
    sub: "You can add your logo and colors to the Playbook later.",
    lands: ["branding"],
  },
  {
    title: "Drafting your Playbook",
    sub: "Audience, goals, and voice, from your own words.",
    lands: ["audience", "goal", "voice"],
  },
];

let introDoneSid = null; // sid whose intro loader has already played

export function renderWelcomeAltRecap(_params, target) {
  return renderDraftView(target, (sid, config) => renderReview(target, sid, config, playbookReview()));
}

// /welcome-alt/voice (flag connectFirst): the Voice's own review, after the
// Playbook's — the same cards, the voice tab split in two parts.
export function renderWelcomeAltVoice(_params, target) {
  return renderDraftView(
    target,
    (sid, config) => {
      startVoiceRules(sid);
      return renderReview(target, sid, { ...config, networkPicker: true }, voiceReview(sid));
    },
    { fallback: "/welcome-alt/recap" },
  );
}

// The first time on the Voice review: every network follows the default voice
// (chosen), except one that already has rules of its own (learned from posts).
// `voiceRulesFor` lists the networks picked for rules — the draft's, never saved.
function startVoiceRules(sid) {
  const d = getDraft(sid);
  if (!networkVoiceOn() || d.voiceRulesFor) return;
  const nets = playbookNetworks(d);
  const own = nets.filter((n) => networkVoice(d, n).state === "own");
  patchDraft(sid, {
    voiceRulesFor: own,
    voiceByNetwork: {
      ...Object.fromEntries(nets.filter((n) => !own.includes(n)).map((n) => [n, brandVoiceAsIs(d)])),
      ...Object.fromEntries(own.map((n) => [n, d.voiceByNetwork[n]])),
    },
  });
}

// The Playbook: every part but the Voice, which has its own review next.
const playbookReview = () => ({
  step: "recap",
  title: "Review your Playbook",
  sub: "I've filled in every card. Scroll through and fix anything that's off. Changes save as you type.",
  parts: RECAP_SECTIONS.filter((t) => t.id !== "voice"),
  next: { label: "On to your voice", go: () => navigate("/welcome-alt/voice") },
  done: { title: "Your Playbook is all set.", lead: "Every part is confirmed. Now, how you sound." },
  back: "/welcome-alt/ready",
});

// The Voice: the default voice (its five parts), then — flag voicePerNetwork,
// a Playbook with networks — the networks (the main one, which ones get rules),
// then a part per network picked. All open the voice tab; each picks its own
// blocks. The ways to fill a part are listed on the left (`ways`): the fiche's
// Learn from… for the default voice; posts, a document, questions or the
// default voice adapted for a network. No account yet: posts connect one first.
const VOICE_TINT = "voice";
function voiceReview(sid) {
  const voice = RECAP_SECTIONS.find((t) => t.id === "voice");
  const nets = () => (networkVoiceOn() ? playbookNetworks(getDraft(sid)) : []);
  const netOf = (partId) => partId.startsWith("voice-net-") && partId.slice("voice-net-".length);
  const notNetworks = (el) => !el.matches(".pb2-voice-net, .pb2-voice-networks");
  const parts = () =>
    [
      {
        id: "voice-default",
        tab: "voice",
        tint: VOICE_TINT,
        title: "Default voice",
        icon: voice.icon,
        lead: "How you sound on every network.",
        pick: (all) => all.filter(notNetworks),
      },
      nets().length && {
        id: "voice-networks",
        tab: "voice",
        tint: VOICE_TINT,
        title: "Your networks",
        icon: "ap-icon-web",
        lead: "Your main network, and the ones that get rules of their own.",
        pick: (all) => all.filter((el) => el.matches(".pb2-voice-networks")),
      },
      ...nets()
        .filter((n) => (getDraft(sid).voiceRulesFor || []).includes(n))
        .map((n) => ({
          id: `voice-net-${n}`,
          tab: "voice",
          tint: VOICE_TINT,
          title: `Rules for ${networkLabel(n)}`,
          icon: networkIcon(n),
          lead: `What your ${networkLabel(n)} posts do on top of your default voice.`,
          pick: (all) => all.filter((el) => el.matches(`.pb2-voice-net--${n}`)),
        })),
    ].filter(Boolean);

  // The accounts to read on a network (or any, for the default voice).
  const accountsOn = (net) => getConnectedProfiles().filter((p) => !net || normalizeNetwork(p.platform) === net);
  const postsDesc = (net) => {
    const a = accountsOn(net).find((p) => p.postCount);
    if (a) return `${a.handle} · ${a.postCount} posts`;
    return net ? `Connect your ${networkLabel(net)} account, I read its posts` : "Connect an account, I read its posts";
  };
  const ways = (partId) => {
    const net = netOf(partId);
    if (partId === "voice-default")
      return {
        label: "Learn it from",
        items: [
          { id: "posts", icon: "ap-icon-double-chat-bubbles", title: "An account's posts", desc: postsDesc(null) },
          { id: "document", icon: "ap-icon-file--text", title: "A document", desc: "A brand book or a style guide" },
        ],
      };
    if (!net) return null;
    const label = networkLabel(net);
    return {
      label: `Add rules for ${label} from`,
      items: [
        { id: "posts", icon: "ap-icon-double-chat-bubbles", title: `Your ${label} posts`, desc: postsDesc(net) },
        { id: "document", icon: "ap-icon-file--text", title: "A document", desc: "A style guide or a brief" },
        { id: "interview", icon: "ap-icon-question", title: "A few questions", desc: "About a minute" },
        { id: "adapt", icon: "ap-icon-sparkles", title: "Your default voice, adapted", desc: "Nothing to read" },
      ],
    };
  };

  // Posts: the accounts already connected, else connect one first (the
  // connect dialog is the consent, DECISIONS « Connecting an account »).
  const withAccounts = (net, use) => {
    const have = accountsOn(net);
    if (have.length)
      return openAnalyzeProfilesModal({
        network: net ? have[0].platform : null,
        onConfirm: (ids) => use(getConnectedProfiles().filter((p) => ids.includes(p.id))),
      });
    const on = net || playbookNetworks(getDraft(sid))[0];
    openConnectAccountModal({
      network: on,
      preselected: accountIdsForNetwork(on),
      onConfirm: (accounts) => accounts.length && use(accounts),
    });
  };
  // The default voice, rewritten from a source (the fiche's Learn from…).
  const learnDefault = (analysis, from, refresh) => {
    const p = sectionPatchFromAnalysis(analysis);
    patchDraft(sid, {
      voiceSummary: p.voiceSummary,
      voiceAlways: p.voiceAlways,
      voiceNever: p.voiceNever,
      voiceByPost: p.voiceByPost,
      voiceSometimes: p.voiceSometimes,
      voiceMode: "guided",
    });
    refresh();
    showToast(`Default voice learned from ${from}${from.endsWith(".") ? "" : "."}`);
  };
  const onWay = (partId, way, refresh) => {
    const net = netOf(partId);
    const docName = ({ file, url }) => file?.name || String(url || "").replace(/^https?:\/\//, "") || "your document";
    if (!net) {
      if (way === "posts")
        return withAccounts(null, (accounts) =>
          learnDefault(
            analyzeSocialProfiles(accounts.map((a) => a.id)),
            accounts.map((a) => a.handle).join(", "),
            refresh,
          ),
        );
      return openFillDocumentModal({
        onConfirm: (doc) => learnDefault(analyzeDocument({ name: docName(doc) }), docName(doc), refresh),
      });
    }
    // A network: what I propose shows first, and lands on « Add to Voice profile ».
    const propose = (opts) =>
      openVoiceProposal({
        ctx: getDraft(sid),
        net,
        onUse: (voice) => {
          patchDraft(sid, { voiceByNetwork: { ...(getDraft(sid).voiceByNetwork || {}), [net]: voice } });
          refresh();
        },
        ...opts,
      });
    if (way === "adapt") return propose({ choice: "adapt" });
    if (way === "interview")
      return openVoiceInterview({ net, onDone: (answers) => propose({ choice: "interview", from: answers }) });
    if (way === "document")
      return openFillDocumentModal({ onConfirm: (doc) => propose({ choice: "document", from: docName(doc) }) });
    withAccounts(net, (accounts) => {
      const source = {
        from: accounts.map((a) => a.handle).join(", "),
        postCount: accounts.reduce((n, a) => n + (a.postCount || 0), 0),
      };
      propose({
        voice: learnNetworkVoice(getDraft(sid), net, source),
        phases: [
          `Reading ${source.postCount} posts of ${source.from}…`,
          `Finding what works on ${networkLabel(net)}…`,
          `Writing your ${networkLabel(net)} rules…`,
        ],
      });
    });
  };

  return {
    step: "voice",
    title: "Set your voice",
    sub: nets().length
      ? "Your default voice first, then the networks that need rules of their own. Changes save as you type."
      : "How you sound, read from your source. Fix anything that's off. Changes save as you type.",
    parts,
    ways,
    onWay,
    next: { label: "Draft my first post", go: () => enterArchie(sid) },
    done: { title: "Your voice is set.", lead: "Every draft starts from it. Let's write the first one." },
    back: "/welcome-alt/recap",
  };
}

// The draft behind both hosts, rehydrated on a reload, and the view's config.
// `host(sid, config)` renders it (flag connectFirst); otherwise, the recap.
function renderDraftView(target, host, { fallback = null } = {}) {
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
      source === "documents" ? FILE_LOADING_STAGES : source === "interview" ? INTERVIEW_LOADING_STAGES : LOADING_STAGES,
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
  // Flag connectFirst: the reviews close the run, in its split.
  if (isFlagOn("connectFirst") && !integrated) return host(sid, config);
  if (fallback) {
    navigate(fallback);
    return () => {};
  }
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
