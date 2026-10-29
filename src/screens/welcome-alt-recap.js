// First Time User ALT — Playbook reveal. Reached at the end of the
// 3-question chat flow (context-builder.startAlt). Thin onboarding wrapper
// over the shared playbook-view engine: it supplies a DRAFT data source, a
// staged loader, reload-rehydration, and the "Enter Archie" finish. The
// actual rendering + per-card edit machine lives in ../playbook-view.js.

import { navigate } from "../router.js?v=2520";
import { catalogueRoute } from "../active-playbook.js?v=2520";
import {
  getDraft,
  isAnalysisReady,
  save,
  patchDraft,
  restoreDraft,
  sectionPatchFromAnalysis,
} from "../context-builder.js?v=2520";
import { RECAP_SECTIONS, editVoiceNetwork, networkVoiceFilled } from "../playbook-view.js?v=2520";
import { renderReview } from "./welcome-alt-review.js?v=2520";
import { open as openRenameModal } from "../components/rename-modal.js?v=2520";
import { getConnectedProfiles, networkIcon, networkLabel, normalizeNetwork } from "../social-profiles.js?v=2520";
import {
  brandVoiceAsIs,
  canLearnFrom,
  learnNetworkVoice,
  networkVoice,
  networkVoiceOn,
  playbookNetworks,
  voiceNetworks,
  onlyNetwork,
} from "../voice-parts.js?v=2520";
import { analyzeDocument, analyzeSocialProfiles } from "../context-mock-analysis.js?v=2520";
import { accountIdsForNetwork } from "../connect-profiles-flow.js?v=2520";
import { open as openAnalyzeProfilesModal } from "../components/analyze-profiles-modal.js?v=2520";
import { open as openFillDocumentModal } from "../components/fill-document-modal.js?v=2520";
import { open as openConnectAccountModal } from "../components/connect-account-modal.js?v=2520";
import { openVoiceInterview, openVoiceProposal } from "../components/voice-proposal-modal.js?v=2520";
import { showToast } from "../components/toast.js?v=2520";
import { open as openConfirm } from "../components/confirm-modal.js?v=2520";

const WELCOME_ALT_KEY = "welcomeAltSessionId";
const WELCOME_ALT_DRAFT_KEY = "welcomeAltDraft";
const WELCOME_ALT_INTEGRATED_KEY = "welcomeAltIntegrated";
const WELCOME_ALT_RETURN_KEY = "welcomeAltReturnTo";

// `lands`: the lines of the onboarding's Playbook card (welcome-alt-shell.js)
// that land once the stage is done — a line no stage
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
  return renderDraftView((sid, config) => renderReview(target, sid, config, playbookReview()));
}

// /welcome-alt/voice: the Voice's own review, after the
// Playbook's — the same cards, the voice tab split in two parts.
export function renderWelcomeAltVoice(_params, target) {
  return renderDraftView((sid, config) => {
    startVoiceRules(sid);
    return renderReview(target, sid, { ...config, networkPicker: true }, voiceReview(sid));
  });
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
  title: "Check what I learned",
  sub: "Here's what I learned. Fix anything that's off; I save as you type.",
  parts: RECAP_SECTIONS.filter((t) => t.id !== "voice"),
  next: { label: "Check my voice", go: () => navigate("/welcome-alt/voice") },
  lastLabel: "Looks good, on to your voice",
  done: { title: "Your Playbook is all set.", lead: "Next, check how you sound." },
  back: "/welcome-alt/ready",
});

// The Voice: the default voice (its five parts), then — flag voicePerNetwork,
// a Playbook with networks — the networks (where you post, which ones get rules),
// then a part per network picked. All open the voice tab; each picks its own
// blocks. The ways to fill a part are tiles on its cards (`onWay`): the fiche's
// Learn from… for the default voice; posts, a document, questions or the
// default voice adapted for a network. No account yet: posts connect one first.
const VOICE_TINT = "voice";
const NETWORKS_GROUP = "Network by network";
const NETWORKS_HINT = "Every network uses your default voice until you give it its own.";
function voiceReview(sid, overrides = {}) {
  const voice = RECAP_SECTIONS.find((t) => t.id === "voice");
  const nets = () => (networkVoiceOn() ? voiceNetworks(getDraft(sid)) : []);
  const netOf = (partId) => partId.startsWith("voice-net-") && partId.slice("voice-net-".length);
  // One network: the default voice is that network's, said in its words.
  const only = () => {
    const net = onlyNetwork(getDraft(sid));
    return net ? networkLabel(net) : "";
  };
  const notNetworks = (el) => !el.matches(".pb2-voice-net, .pb2-voice-networks");
  // The ways live on the cards (tiles), not on the left (2026-10-29).
  const parts = () =>
    [
      {
        id: "voice-default",
        tab: "voice",
        tint: VOICE_TINT,
        group: only() || "Every network",
        groupHint: "I wrote your default voice from what you gave me. Edit any part.",
        title: "Default voice",
        icon: voice.icon,
        lead: only() ? `How your ${only()} posts sound.` : "How you sound everywhere.",
        open: () => editVoiceNetwork(null),
        pick: (all) => all.filter(notNetworks),
      },
      nets().length > 0 && {
        id: "voice-networks",
        tab: "voice",
        tint: VOICE_TINT,
        group: NETWORKS_GROUP,
        groupHint: NETWORKS_HINT,
        title: "Your networks",
        nextLabel: "Looks good, on to your networks",
        action: "Add a voice for a network",
        icon: "ap-icon-web",
        lead: "Which networks get a voice of their own.",
        open: () => editVoiceNetwork(null),
        pick: (all) => all.filter((el) => el.matches(".pb2-voice-networks")),
      },
      ...nets()
        .filter((n) => (getDraft(sid).voiceRulesFor || []).includes(n))
        .map((n) => ({
          id: `voice-net-${n}`,
          tab: "voice",
          tint: VOICE_TINT,
          group: NETWORKS_GROUP,
          title: `Voice for ${networkLabel(n)}`,
          icon: networkIcon(n),
          lead: `How your ${networkLabel(n)} posts sound, on top of your default voice.`,
          // Empty: its card, the ways as tiles. Filled: it opens in edit (the
          // network's own five parts, voiceNet).
          badge: networkVoiceFilled(getDraft(sid), n) ? null : "To fill in",
          open: () => editVoiceNetwork(n),
          pick: (all) => {
            const card = all.filter((el) => el.matches(`.pb2-voice-net--${n}`));
            return card.length ? card : all;
          },
        })),
    ].filter(Boolean);

  // The accounts to read on a network (or any, for the default voice).
  const accountsOn = (net) => getConnectedProfiles().filter((p) => !net || normalizeNetwork(p.platform) === net);
  // Posts: the accounts already connected, else connect one first (the
  // connect dialog is the consent, DECISIONS « Connecting an account »).
  const withAccounts = (net, use) => {
    const have = accountsOn(net).filter(canLearnFrom);
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
    showToast(`Default voice rewritten from ${from}${from.endsWith(".") ? "" : "."}`);
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
    // Written from an empty page: its own voice, nothing in it yet, in edit.
    if (way === "write") {
      const empty = {
        voiceSummary: "",
        voiceAlways: [],
        voiceNever: [],
        voiceByPost: [],
        voiceSometimes: [],
        optimizedBy: "you",
      };
      patchDraft(sid, { voiceByNetwork: { ...(getDraft(sid).voiceByNetwork || {}), [net]: empty } });
      return refresh();
    }
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
    title: "Check your voice",
    sub: only()
      ? `Your default voice is how your ${only()} posts sound. I save as you type.`
      : "Your default voice works on every network. Give a network its own voice when it needs one. I save as you type.",
    parts,
    onWay,
    next: { label: finishLabel(), go: () => finishRun(sid) },
    done: { title: "Your voice is set.", lead: "I start every draft from it." },
    back: "/welcome-alt/recap",
    ...overrides,
  };
}

// The draft behind both hosts, rehydrated on a reload, and the view's config.
// `host(sid, config)` renders it.
function renderDraftView(host) {
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
  // `revealed`: the onboarding's own reveal (/welcome-alt/ready) already
  // showed the building — the details open straight.
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
  // The reviews close the run, in its split — a returning user's new Playbook
  // too (2026-10-29).
  return host(sid, config);
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

// "Enter Archie" — persist the Playbook, then finish the ALT flow: a new chat
// on it. The recap owns this
// (rather than the draft's onComplete) so it still works after a reload,
// where the in-memory onComplete is gone.
// The run's end, whoever runs it: a first-time user enters Archie; a returning
// user creating one Playbook more (`welcomeAltIntegrated`) saves it and goes
// back where they started — no reload, which would re-seed the stores.
export function finishRun(sid) {
  const finish = () => (isIntegrated() ? finishIntegrated(sid) : enterArchie(sid));
  // Networks picked for a voice of their own and left empty: said, and asked,
  // before the run ends (2026-10-29, asked: « il faut prévenir l'utilisateur et
  // lui demander confirmation que tout est ok et lui dire qu'il pourra toujours
  // réediter les voices dans le playbook »).
  const d = getDraft(sid);
  const empty = networkVoiceOn() ? (d?.voiceRulesFor || []).filter((n) => !networkVoiceFilled(d, n)) : [];
  if (!empty.length) return finish();
  const names = empty.map(networkLabel);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  const count = `${empty.length} empty voice${empty.length === 1 ? "" : "s"}`;
  openConfirm({
    title: `Continue with ${count}?`,
    body: `${list} ${empty.length === 1 ? "has" : "have"} no voice of ${empty.length === 1 ? "its" : "their"} own yet. Until you fill ${empty.length === 1 ? "it" : "them"} in, I write ${empty.length === 1 ? "its" : "their"} posts in your default voice. You can edit every voice later in your Playbook.`,
    confirmLabel: "Continue",
    cancelLabel: empty.length === 1 ? "Fill it in" : "Fill them in",
    onConfirm: finish,
    // The review opens the part the URL's `tab` names: the first empty voice.
    onCancel: () => navigate(`/welcome-alt/voice?tab=voice-net-${encodeURIComponent(empty[0])}`),
  });
}
export const finishLabel = () => (isIntegrated() ? "Save my Playbook" : "Draft my first post");

export function enterArchie(sid) {
  patchDraft(sid, { onComplete: null });
  const saved = save(sid);
  if (!saved) return;
  clearSessionId();
  clearPersistedDraft();
  document.body.classList.remove("onboarding");
  // No reload: it re-seeded the stores, dropped the Playbook just built and
  // landed in Acme's chats. The user stays new — their own Playbook, nothing
  // else — and lands on a new chat on it (2026-10-29).
  // `welcome`: the chat opens on « Your Playbook is ready » (empty-hero.js).
  navigate(`/session/new-${Date.now().toString(36)}?contextId=${encodeURIComponent(saved.id)}&welcome=1`);
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
export function isIntegrated() {
  try {
    return window.sessionStorage.getItem(WELCOME_ALT_INTEGRATED_KEY) === "1";
  } catch {
    return false;
  }
}

export function readReturnTo() {
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
