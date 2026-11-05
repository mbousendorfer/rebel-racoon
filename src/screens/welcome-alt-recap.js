// First Time User ALT — Playbook reveal. Reached at the end of the
// 3-question chat flow (context-builder.startAlt). Thin onboarding wrapper
// over the shared playbook-view engine: it supplies a DRAFT data source, a
// staged loader, reload-rehydration, and the "Enter Archie" finish. The
// actual rendering + per-card edit machine lives in ../playbook-view.js.

import { navigate } from "../router.js?v=2731";
import { catalogueRoute } from "../active-playbook.js?v=2731";
import {
  getDraft,
  isAnalysisReady,
  save,
  patchDraft,
  restoreDraft,
  sectionPatchFromAnalysis,
} from "../context-builder.js?v=2731";
import {
  RECAP_SECTIONS,
  editVoiceNetwork,
  networkVoiceFilled,
  setNetworkRules,
  proposeVoiceInline,
} from "../playbook-view.js?v=2731";
import { renderPageReview, renderReview } from "./welcome-alt-review.js?v=2731";
import { open as openRenameModal } from "../components/rename-modal.js?v=2731";
import { getConnectedProfiles, networkIcon, networkLabel, normalizeNetwork } from "../social-profiles.js?v=2731";
import {
  brandVoiceAsIs,
  canLearnFrom,
  learnNetworkVoice,
  networkVoice,
  networkVoiceOn,
  playbookNetworks,
  voiceNetworks,
  onlyNetwork,
} from "../voice-parts.js?v=2731";
import { analyzeDocument, analyzeSocialProfiles } from "../context-mock-analysis.js?v=2731";
import { accountIdsForNetwork } from "../connect-profiles-flow.js?v=2731";
import { open as openAnalyzeProfilesModal } from "../components/analyze-profiles-modal.js?v=2731";
import { open as openFillDocumentModal } from "../components/fill-document-modal.js?v=2731";
import { open as openConnectAccountModal } from "../components/connect-account-modal.js?v=2731";
import { showToast } from "../components/toast.js?v=2731";
import { open as openConfirm } from "../components/confirm-modal.js?v=2731";

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

// The Playbook's review, as one page — for every run (2026-11-04).
export function renderWelcomeAltRecap(_params, target) {
  return renderDraftView((sid, config) => renderPageReview(target, sid, config, playbookReview()));
}

// /welcome-alt/voice: the Voice's own review, after the
// Playbook's — the same cards, the voice tab split in two parts.
export function renderWelcomeAltVoice(_params, target) {
  return renderDraftView((sid, config) => {
    startVoiceRules(sid);
    // The column, still, and it ends on the run's own finish — for every run.
    return renderReview(
      target,
      sid,
      { ...config, networkPicker: true },
      voiceReview(sid, { calm: true, lastLabel: finishLabel() }),
    );
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
  sub: "Fix anything that's off. I save as you type.",
  parts: RECAP_SECTIONS.filter((t) => t.id !== "voice"),
  next: { label: "Check my voice", go: () => navigate("/welcome-alt/voice") },
  lastLabel: "Looks good, on to your voice",
  back: "/welcome-alt/ready",
});

// The Voice: the default voice (its five parts), then — flag voicePerNetwork,
// a Playbook with networks — one row per network under it, each with a DS
// toggle « Own voice » (2026-11-04, replaced 2026-11-05 by « Network voices »,
// a row per voice with its state, and « Add a network voice »; asked: « j'arrive pas à comprendre que je
// vais customiser des voices pour les divers networks », then « too confusing,
// too much » for a tree with a Customize per row; it replaces a DS
// multi-select, which read as « your networks »). Off: the network uses the
// default voice, its row opens nothing. On: it is a part, its card on the right
// as before — the ways as tiles (`onWay`) until it has rules, then its editor.
const VOICE_TINT = "voice";
function voiceReview(sid, overrides = {}) {
  const voice = RECAP_SECTIONS.find((t) => t.id === "voice");
  const nets = () => (networkVoiceOn() ? voiceNetworks(getDraft(sid)) : []);
  const netOf = (partId) => partId.startsWith("voice-net-") && partId.slice("voice-net-".length);
  const customizing = (n) => (getDraft(sid).voiceRulesFor || []).includes(n);
  // One network: the default voice is that network's, said in its words.
  const only = () => {
    const net = onlyNetwork(getDraft(sid));
    return net ? networkLabel(net) : "";
  };
  const notNetworks = (el) => !el.matches(".pb2-voice-net");
  const ruleState = (n) => {
    const v = getDraft(sid).voiceByNetwork?.[n];
    const count = ["voiceAlways", "voiceNever", "voiceByPost", "voiceSometimes"].reduce(
      (c, f) => c + (v?.[f] || []).length,
      0,
    );
    if (!networkVoiceFilled(getDraft(sid), n)) return "Uses your default voice";
    return count ? `${count} rule${count === 1 ? "" : "s"}` : "Filled in";
  };
  const defaultPart = () => ({
    id: "voice-default",
    tab: "voice",
    tint: VOICE_TINT,
    title: "Default voice",
    icon: voice.icon,
    lead: only() ? `How your ${only()} posts sound.` : "How you sound on every network.",
    open: () => editVoiceNetwork(null),
    pick: (all) => all.filter(notNetworks),
  });
  const netRow = (n) => ({
    id: `voice-net-${n}`,
    tab: "voice",
    tint: VOICE_TINT,
    title: networkLabel(n),
    icon: networkIcon(n),
    net: n,
    // Its state, said: how many rules, or none yet.
    lead: ruleState(n),
    // On the default voice: not a part, only an entry of « Add a network voice ».
    inert: !customizing(n),
    // On and still empty: the confirm keeps the default voice.
    skipLabel: () => !networkVoiceFilled(getDraft(sid), n) && `Use my default voice for ${networkLabel(n)}`,
    open: () => editVoiceNetwork(n),
    pick: (all) => {
      const card = all.filter((el) => el.matches(`.pb2-voice-net--${n}`));
      return card.length ? card : all;
    },
  });
  // The list: every network. The parts (opened, confirmed one after the
  // other): the default voice and the networks added.
  const rows = () => [defaultPart(), ...nets().map(netRow)];
  const parts = () => rows().filter((r) => !r.inert);
  const onToggle = (partId, on) => setNetworkRules(netOf(partId), on);

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
  // The default voice, rewritten from a source (the fiche's Learn from…): a
  // proposal first, saved only on « Add to Voice profile », like a network's
  // voice (ui-polish OB-17: it used to overwrite at once, with no undo).
  const learnDefault = (analysis, from, refresh) => {
    const p = sectionPatchFromAnalysis(analysis);
    const rules = [p.voiceAlways, p.voiceNever, p.voiceByPost, p.voiceSometimes].reduce(
      (n, list) => n + (list?.length || 0),
      0,
    );
    openConfirm({
      title: `New default voice from ${from}`,
      body: `${p.voiceSummary ? `« ${p.voiceSummary} » ` : ""}Plus ${rules} rule${rules === 1 ? "" : "s"} for how you write. Your current voice stays until you add this one.`,
      confirmLabel: "Add to Voice profile",
      cancelLabel: "Keep my voice",
      onConfirm: () => {
        patchDraft(sid, {
          voiceSummary: p.voiceSummary,
          voiceAlways: p.voiceAlways,
          voiceNever: p.voiceNever,
          voiceByPost: p.voiceByPost,
          voiceSometimes: p.voiceSometimes,
          voiceMode: "guided",
        });
        refresh();
        showToast("Default voice updated.");
      },
    });
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
        proposal: true,
        onConfirm: (doc) => learnDefault(analyzeDocument({ name: docName(doc) }), docName(doc), refresh),
      });
    }
    // A network: learned in its card on the right, then filled in at once and
    // opened in edit — no « Add to Voice profile » step (proposeVoiceInline).
    const propose = (opts) =>
      proposeVoiceInline({
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
    if (way === "document")
      return openFillDocumentModal({
        proposal: true,
        onConfirm: (doc) => propose({ choice: "document", from: docName(doc) }),
      });
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
      : networkVoiceOn()
        ? "Your default voice works on every network. Give a network its own voice when it should sound different. I save as you type."
        : "Every draft I write starts from this voice. I save as you type.",
    parts,
    rows,
    onWay,
    onToggle,
    next: { label: finishLabel(), go: () => finishRun(sid) },
    // The last confirm and the left's way out are one action: one wording
    // (2026-11-04 — it read « Looks good, finish » beside « Draft my first post »).
    lastLabel: `Looks good, ${finishLabel().charAt(0).toLowerCase()}${finishLabel().slice(1)}`,
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
    body: `${list} ${empty.length === 1 ? "has" : "have"} no voice of ${empty.length === 1 ? "its" : "their"} own, so I'll write ${empty.length === 1 ? "its" : "their"} posts in your default voice. You can add one anytime in your Playbook.`,
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
