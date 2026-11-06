// Shared Playbook view + per-section editor. Renders a product-grade detail
// surface — a compact identity header, a sticky section-nav rail with quick
// facts, and three section panels (Brief · Voice profile · Branding) —
// plus the inline per-section edit machine. Driven by a `cfg` adapter so the
// same surface powers two contexts:
//   • onboarding (welcome-alt-recap) — a context-builder DRAFT, with a
//     staged loader and a "Save and start" finish.
//   • library (/playbook/:id)        — a saved Context, in the app shell,
//     editing straight into the store, with header actions (Start chat /
//     Edit name / Delete).
//
// The renderers operate on a plain `data` object (draft or Context — both
// expose the same field names). Persistence + chrome + copy are injected
// via `cfg`; the edit state (editScope / snapshot) lives module-local and
// is safe because only one route renders at a time.

import { escapeHtml as esc, html, prettyUrl, raw } from "./utils.js?v=2765";
import { brandCoverStyle, voiceSentence } from "./brand-cover.js?v=2765";
import { conceptHint } from "./concepts.js?v=2765";
import {
  renderColorRole,
  colorRoleCaption,
  renderLogoVariants,
  renderVisualRules,
  handleImageStylesClick,
  handleRecapLookClick,
  renderRecapLook,
  handleKitClick,
  handleKitInput,
  handleKitChange,
  kitSnapshot,
  renderImagesTab,
  setInlineChoices,
} from "./playbook-brand-kit.js?v=2765";
import { analyzeWebsite } from "./context-mock-analysis.js?v=2765";
import { LANGUAGE_OPTIONS, emptyVoiceEntry } from "./languages.js?v=2765";
import { isFlagOn } from "./feature-flags.js?v=2765";
import { clipLookOf } from "./videos-store.js?v=2765";
import { dsSelect, SUBTITLE_IDS, presetLabel } from "./screens/clips/shared.js?v=2765";
import { parseHashParams } from "./url-state.js?v=2765";
import {
  isListPart,
  voiceParts,
  baseValue,
  cloneItems,
  voiceItemsHtml,
  networkVoiceOn,
  networkVoice,
  voiceNetworks,
  onlyNetwork,
  brandVoiceAsIs,
  cloneNetworkVoice,
  voiceNetTagHtml,
  markAdapted,
  withNetworkVoices,
  canLearnFrom,
  ADAPTED_FROM,
  voiceHasRules,
  partQuestion,
} from "./voice-parts.js?v=2765";
import { showToast } from "./components/toast.js?v=2765";
import { introSeen, voiceAskHtml, learnedVoiceHtml } from "./components/voice-intro-modal.js?v=2765";
import {
  voiceChoices,
  saveNetworkVoice,
  learnPhases,
  LEARN_PHASE_MS,
  proposeNetworkVoice,
} from "./network-voice-flow.js?v=2765";
import { openVoiceProposal } from "./components/voice-proposal-modal.js?v=2765";
import { consumeHandoff } from "./handoff.js?v=2765";
import { open as openConfirmModal } from "./components/confirm-modal.js?v=2765";
import {
  NETWORK_ICON_BY_PLATFORM,
  NETWORK_LABEL,
  networkLabel,
  networkIcon,
  getConnectedProfiles,
  normalizeNetwork,
  NETWORKS,
} from "./social-profiles.js?v=2765";
import {
  ROSTERS,
  REF_NETWORKS,
  hashStr,
  hslToHex,
  rosterOf,
  rosterList,
  renderRosterPanel,
  renderRosterModal,
  renderInfluencersPanel,
  renderInfluencerAddModal,
  resetRosterState,
  closeRosterDialogs,
  stopRosterScan,
  handleRosterClick,
  handleInfAddInput,
} from "./playbook-rosters.js?v=2765";

// Brief — chip fields (multi-value), in display order.
const GOAL_FIELDS = [
  { key: "audience", label: "Primary audience", placeholder: "Add an audience…" },
  { key: "contentStyle", label: "Content style", placeholder: "Add a style…" },
  { key: "objective", label: "Primary goal", placeholder: "Add a goal…" },
  { key: "contentAction", label: "Content action", placeholder: "Add an action…" },
];

// Competitors and Influencers close the list on purpose: the panel renderers
// address the first three positionally (SECTIONS[0..2]), and they read as the
// least core sections — market context after audience, voice and brand. Who
// you're up against first, then who your audience listens to.
//
// A Playbook is a FACT SHEET: every section answers "who are you?" — brand,
// audience, voice, who you compete with. Operational config (which listening
// sources are live, how often they refresh) belongs on the route that owns the
// feature, not here — see screens/topics.js. That's why there's no Topics
// section: it was tried, and a grid of switches read as a settings panel wedged
// into a profile.
const SECTIONS = [
  { id: "pbk-sec-goals", scope: "goals", icon: "ap-icon-target", title: "Brief" },
  { id: "pbk-sec-voice", scope: "voice", icon: "ap-icon-quote", title: "Voice profile" },
  { id: "pbk-sec-brand", scope: "brand", icon: "ap-icon-image", title: "Branding" },
  { id: "pbk-sec-competitors", scope: "competitors", icon: "ap-icon-buildings", title: "Competitors" },
  { id: "pbk-sec-influencers", scope: "influencers", icon: "ap-icon-star", title: "Influencers" },
];

// Edit-mode guidance. Surfaced only while a section is being edited (one at a
// time), so the read view stays clean. Brief gets a per-field hint
// (q = prompt, a = what Archie does with it); Voice profile and Brand each get
// a single "captured by Archie" banner.
const FIELD_HINTS = {
  languages: {
    q: "Which languages do you publish in?",
    a: "Pick one or more. I write each post natively in the language you choose, never as a translation.",
  },
  businessSummary: {
    q: "Does this describe your business correctly?",
    a: "I wrote this from what I read about your business. Fix anything that's off.",
  },
  // A weak read leaves the summary empty on purpose (FEATURES § La lecture
  // faible): the hint asks instead of claiming a text that isn't there.
  businessSummaryEmpty: {
    q: "What does your business do?",
    a: "I couldn't tell from what I read. Say it in a few sentences, and every post starts from it.",
  },
  audience: {
    q: "Who is your primary audience?",
    a: "I shape every post's angle and framing for them.",
  },
  contentStyle: {
    q: "What content style fits your brand?",
    a: "I follow this for the structure and format of every post.",
  },
  objective: {
    q: "What's your primary social media objective?",
    a: "I favor angles that serve this goal.",
  },
  contentAction: {
    q: "What action should your content drive?",
    a: "I end posts with a call to action that drives this.",
  },
  ctaLinks: {
    q: "Call to action",
    a: "I add these links when a post calls for an action.",
  },
  brandLogo: {
    q: "Which logo should I default to?",
    a: "I place the default logo bottom-right on the images I make. The others are there when you want to place one yourself.",
  },
  brandColors: {
    q: "Which colors does the Brand use?",
    a: "I use these in every image I make. The role says where each one goes.",
  },
  brandType: {
    q: "Which fonts does the Brand use?",
    a: "The fonts I set your text in.",
  },
  brandPersonality: {
    q: "How should the Brand's images feel?",
    a: "How your images should feel.",
  },
  visualRules: {
    q: "What should images never do?",
    a: "What I never do with your logo and colors.",
  },
  imageDefaults: {
    q: "What should generated images look like by default?",
    a: "I start every image here. Change any of it per post in the Image Studio. That never changes this Playbook.",
  },
};

const SECTION_HINTS = {
  voice: {
    q: "Voice profile",
    a: "I learned this voice from your account's recent posts.",
  },
  brand: {
    // "Your logo, plus…" because the logo is the one thing in this section Archie
    // can't find for you — a banner claiming it picked everything up from the site
    // would be contradicted by the very first row.
    q: "Visual identity",
    a: "Your logo, plus the colors and fonts I found on your site, so visuals stay on-brand.",
  },
  competitors: {
    q: "Who you're up against",
    a: "I scan your market and suggest competitors. Add the ones that matter. I won't suggest a dismissed one again.",
  },
};

const STAGE_MS = 2400;

let mountTarget = null;
let cfg = null;
let editScope = null; // null (read) | "goals" | "voice" | "brand" | "competitors" | "influencers"
let refModalIndex = null; // open reference-image detail modal (index) or null
let refModalHost = null; // body-level portal node for the open detail modal
let snapshot = null; // deep copy of editable fields, for Cancel
let editBaseline = null; // the same fields as JSON once the editor has painted — "anything changed?"
let audienceCustom = false; // "Other…" picked in the Primary audience dropdown
let loadingTimer = null;
let loadingStage = 0;
let phase = "ready"; // "loading" | "ready"
let activeTab = "goals"; // Playbook 2.0: the tab on screen
let voiceNet = null; // Voice profile, flag voicePerNetwork: the network whose voice is on screen (null = the default network's, the Playbook's own parts)

// `cfg.stack`: every tab it lists at once, all in edit — the edit scope is
// then this, not one section.
const STACK = "stack";
const inEdit = (scope) => editScope === scope || (editScope === STACK && cfg.stack.includes(scope));

// What the rosters (playbook-rosters.js) read of this view, passed at each
// call: the live state as getters, never captured.
const rosterCtx = {
  get cfg() {
    return cfg;
  },
  get editScope() {
    return editScope;
  },
  get mountTarget() {
    return mountTarget;
  },
  repaint,
  canEdit: canEditView,
  inEdit,
  tabHead: pb2TabHead,
  sectionHint: (scope) => renderSectionHint(SECTION_HINTS[scope]),
  sectionId: (scope) => SECTIONS.find((s) => s.scope === scope).id,
};

// ── Public API ───────────────────────────────────────────────────────────

// cfg: {
//   mode: "onboarding" | "library",
//   getData(): object,                 // the live data object (draft | Context)
//   isReady(): boolean,                // analysis landed? (loader waits on it)
//   commit(): void,                    // Save — persist + notify
//   revert(snapshot): void,            // Cancel — restore editable fields
//   onPaint(): void,                   // each ready paint (e.g. reload snapshot)
//   loader: [{title,sub}] | null,      // staged loader (onboarding); null = none
//   skipLoader: boolean,               // force straight to ready
//   onIntroDone(): void,               // loader finished
//   showTop: boolean,                  // render the Archie/BETA top strip
//   canEdit: boolean,                  // default true; false = read-only fiche
//                                      // (someone else's shared Playbook)
//   ownership: {                       // null = don't say anything about it
//     tag: string,                     //   mark beside the name ("Shared by Sam")
//     owner: string, initials: string, //   the Owner quick-fact
//   } | null,
//   notice(): string,                  // html above the layout (read-only banner)
//   headerActions(): string | null,    // html for the header action bar (library)
//   audienceList: boolean,             // the audience as a list of rows, not a dropdown
//   chipCloud: boolean,                // chip fields as a cloud of toggles (found + common)
//   rosterPicker: boolean,             // competitors / influencers as one list to tick
//   stack: string[] | null,            // these tabs on one page, all in edit (a returning
//                                      // user's Create a Playbook review); edits apply live
//   onEditName(): void,                // header name pencil (rename)
//   onAnalyzeVoice(): void,            // Voice profile → analyze social profiles
//   onFooter(event): boolean,          // catch-all click handler (header actions)
// }
export function mount(target, config) {
  cfg = config;
  mountTarget = target;
  setInlineChoices(cfg.chipCloud);
  activeTab = tabFromUrl();
  voiceNet = parseHashParams().get("voice") || null;
  editScope = null;
  snapshot = null;
  audienceCustom = false;
  resetRosterState();
  if (cfg.stack) {
    const d = cfg.getData();
    if (cfg.stack.includes("brand")) ensureBrand(d);
    cfg.stack.forEach((id) => ROSTERS[id] && rosterList(d, ROSTERS[id]));
    editScope = STACK;
  }

  if (cfg.loader && !cfg.skipLoader) {
    phase = "loading";
    loadingStage = 0;
    paint();
    startLoadingSequence();
  } else {
    phase = "ready";
    paint();
    // « Edit it myself », or « Edit in the Playbook » on what Archie proposes
    // (network-voice-flow.js editNetworkVoiceInPlaybook sets the key): the
    // network's tab opens in edit — on the proposal, unsaved, else on its own
    // voice, else from the default voice.
    const edit = isLibrary() ? consumeHandoff("editNetworkVoice") : null;
    const d = cfg.getData();
    // No handoff → nothing to open (a draft without an id matched undefined === undefined).
    if (edit && edit.playbookId === d?.id && edit.net === voiceNet) {
      if (edit.voice) editNetworkVoiceFrom(edit.voice);
      else if (networkVoice(d, voiceNet).state === "own") openEdit(d, "voice");
      else editNetworkVoiceFrom(brandVoiceAsIs(d));
    }
  }

  const onClickH = (e) => onClick(e);
  const onInputH = (e) => onInput(e);
  const onChangeH = (e) => onChange(e);
  const onKeydownH = (e) => onKeydown(e);
  const onErrorH = (e) => onLoadError(e);
  target.addEventListener("click", onClickH);
  target.addEventListener("input", onInputH);
  target.addEventListener("change", onChangeH);
  target.addEventListener("keydown", onKeydownH);
  // Competitor favicons come from a remote service, so a domain with no icon
  // (or an offline session) has to fall back to the monogram tile. `error`
  // doesn't bubble, so this listener has to run in the CAPTURE phase — that's
  // what lets us keep the repo's "delegated handlers, no inline on*" rule.
  target.addEventListener("error", onErrorH, true);
  // A chip field's Add menu opens on its own field, ready to type (`toggle`
  // doesn't bubble: captured).
  const onToggleH = (e) => {
    if (e.target.open && e.target.matches?.(".recap__chip-menu"))
      e.target.querySelector("[data-recap-chip-input]")?.focus();
  };
  target.addEventListener("toggle", onToggleH, true);
  // A reload can't save (nothing persists across it), so it's the one exit
  // that still has to ask — only while there is something to lose.
  const onBeforeUnloadH = (e) => {
    if (!isLibrary() || !editScope || !isDirty(cfg.getData())) return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onBeforeUnloadH);

  return () => {
    // Leaving the fiche — a chat in the rail, Start a chat, any route — saves
    // the open section rather than dropping it (Playbook 2.0).
    if (isLibrary()) saveOnLeave();
    window.removeEventListener("beforeunload", onBeforeUnloadH);
    stopLoading();
    stopRosterScan();
    [...voiceProposals.keys()].forEach(dropVoiceProposal);
    target.removeEventListener("click", onClickH);
    target.removeEventListener("input", onInputH);
    target.removeEventListener("change", onChangeH);
    target.removeEventListener("keydown", onKeydownH);
    target.removeEventListener("error", onErrorH, true);
    target.removeEventListener("toggle", onToggleH, true);
    if (refModalHost) {
      refModalHost.remove();
      refModalHost = null;
    }
    refModalIndex = null;
    closeRosterDialogs();
    mountTarget = null;
    cfg = null;
    editScope = null;
    snapshot = null;
    editBaseline = null;
  };
}

// Every repaint keeps the reader where they are. paint() rebuilds the whole
// `.welcome-screen` (the scroll container), so its scrollTop resets to 0 — and
// in edit mode nearly every click repaints (Add a logo, Add colour, a chip's ×,
// a role picked…), which threw the page back to the top under the pointer. The
// few moves that SHOULD land at the top (a tab switch) scroll there themselves
// after the repaint; mount() paints fresh and starts at the top anyway.
function repaint() {
  if (!mountTarget) return;
  const top = mountTarget.querySelector(".welcome-screen")?.scrollTop ?? 0;
  paint();
  const next = mountTarget.querySelector(".welcome-screen");
  if (next && top) next.scrollTop = top;
}

function isReady() {
  return cfg.isReady ? cfg.isReady() : true;
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── Loader ─────────────────────────────────────────────────────────────

function stopLoading() {
  if (loadingTimer) {
    window.clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

function startLoadingSequence() {
  stopLoading();
  loadingTimer = window.setInterval(() => {
    if (loadingStage < cfg.loader.length - 1) {
      loadingStage += 1;
      repaint();
    } else if (isReady()) {
      stopLoading();
      cfg.onIntroDone?.();
      phase = "ready";
      repaint();
    }
    // else: hold on the final stage until the data lands.
  }, STAGE_MS);
}

// ── Data helpers ───────────────────────────────────────────────────────

function brandSite(data) {
  const sites = data?.imageVoice?.websites;
  return Array.isArray(sites) && sites.length ? sites[0] : null;
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Default brand colours derived from the scraped site palette, so a Playbook
// that has never been hand-edited still shows named swatches the user can
// then rename / extend. Used to seed `data.brandColors` on first edit.
function deriveBrandColors(site) {
  const c = site?.colors || {};
  return [
    { name: "Primary", hex: c.primary },
    { name: "Accent", hex: c.accent },
    { name: "Background", hex: c.background },
    { name: "Text", hex: c.textPrimary },
    { name: "Link", hex: c.link },
  ].filter((s) => s.hex);
}

// The marks Archie found on the site, in the order the Brand section offers
// them. Mirrors deriveBrandColors: the scraped material is the default the user
// then prunes and adds to.
function deriveBrandLogos(site) {
  const found = site?.images?.logos;
  if (!Array.isArray(found)) return [];
  return found
    .filter((l) => l && l.url)
    .map((l, i) => ({ id: `site-logo-${i}`, label: l.label || "Logo", url: l.url }));
}

// The Playbook's marks — authored `brandLogos` if present, else what the site
// analysis turned up.
function brandLogoList(data) {
  if (Array.isArray(data.brandLogos) && data.brandLogos.length) return data.brandLogos;
  return deriveBrandLogos(brandSite(data));
}

// Which mark is the default: `brandLogo` is the resolved url (see
// contexts-store#normalizeBrandLogos), so an index is derived, never stored.
function defaultLogoIndex(data, list) {
  const i = list.findIndex((l) => l.url === data.brandLogo);
  return i === -1 ? (list.length ? 0 : -1) : i;
}

// The authored brand palette — user-edited `brandColors` if present, else the
// derived site palette (read-only view falls back to this).
function visualColors(data) {
  if (Array.isArray(data.brandColors) && data.brandColors.length) return data.brandColors;
  return deriveBrandColors(brandSite(data));
}

function brandFonts(data) {
  const site = brandSite(data);
  const t = data.brandTypography || {};
  return {
    headingFont: t.headingFont || site?.typography?.headingFont || site?.typography?.primaryFont || "",
    bodyFont: t.bodyFont || site?.typography?.primaryFont || "",
  };
}

// Lazily promote the derived palette / scraped fonts into editable fields the
// first time the user opens the Brand editor (alpha feedback #10).
function ensureBrand(data) {
  if (!Array.isArray(data.brandColors) || !data.brandColors.length) {
    data.brandColors = deriveBrandColors(brandSite(data));
  }
  // Promote the scraped marks so the gallery has entries to reorder / remove,
  // and adopt the first as the default if nothing was chosen yet.
  if (!Array.isArray(data.brandLogos) || !data.brandLogos.length) {
    data.brandLogos = deriveBrandLogos(brandSite(data));
  }
  if (!data.brandLogo && data.brandLogos.length) data.brandLogo = data.brandLogos[0].url;
  if (!data.brandTypography || typeof data.brandTypography !== "object") {
    data.brandTypography = brandFonts(data);
  }
  if (!Array.isArray(data.referenceImages)) data.referenceImages = [];
  // Shape only, deliberately NOT derived like the four above: the pre-fill is the
  // analysis's job (context-builder#imageDefaultsFromAnalysis). Guessing a look the
  // first time someone opens the editor would be a silent write to the fiche.
  if (!data.imageDefaults || typeof data.imageDefaults !== "object") {
    data.imageDefaults = { imageType: "", style: "", refMode: "" };
  }
}

// Snapshot only the user-editable fields so Cancel can restore them.
export function snapshotEditable(d) {
  return JSON.parse(
    JSON.stringify({
      name: d.name || "",
      businessSummary: d.businessSummary || "",
      audience: d.audience || [],
      contentStyle: d.contentStyle || [],
      objective: d.objective || [],
      contentAction: d.contentAction || [],
      ctaLinks: d.ctaLinks || [],
      language: d.language || "",
      languages: d.languages || [],
      primaryLanguage: d.primaryLanguage || "",
      voiceByLanguage: d.voiceByLanguage || {},
      voiceSummary: d.voiceSummary || "",
      voiceAlways: d.voiceAlways || [],
      voiceNever: d.voiceNever || [],
      voiceByPost: d.voiceByPost || [],
      voiceSometimes: d.voiceSometimes || [],
      voiceByNetwork: d.voiceByNetwork || {},
      voiceChangedAt: d.voiceChangedAt || 0,
      voiceMode: d.voiceMode || "guided",
      voiceManual: d.voiceManual || "",
      brandPersonality: d.brandPersonality || "",
      brandTypography: d.brandTypography || null,
      brandColors: d.brandColors || [],
      brandLogos: d.brandLogos || [],
      brandLogo: d.brandLogo || "",
      imageDefaults: d.imageDefaults || { imageType: "", style: "", refMode: "" },
      competitors: d.competitors || [],
      dismissedCompetitors: d.dismissedCompetitors || [],
      ...kitSnapshot(d),
      influencers: d.influencers || [],
    }),
  );
}

// ── Language helpers (multilingual Playbook) ───────────────────────────────

// Multilingual Playbooks are gated behind a feature flag (default OFF). When
// OFF, a Playbook behaves single-language: only the primary language surfaces,
// no per-language voice switcher, no draft-time language question.
function multilingualOn() {
  return isFlagOn("multilingualPlaybook");
}

// The Playbook's declared languages, always a non-empty array. Collapses to
// the primary language alone when the multilingual flag is OFF (secondary
// languages stay in the data, just hidden).
function contextLanguages(data) {
  const langs = Array.isArray(data.languages) && data.languages.length ? data.languages : null;
  const primary = data.primaryLanguage || (langs && langs[0]) || data.language || "English";
  if (!multilingualOn()) return [primary];
  return langs || [primary];
}

// ── Shared bits ──────────────────────────────────────────────────────────

function editActionButtons() {
  return `
    <button type="button" class="ap-button ghost grey recap__edit-cancel" data-recap-cancel>
      <span>Cancel</span>
    </button>
    <button type="button" class="ap-button primary blue recap__edit-save" data-recap-save>
      <i class="ap-icon-check"></i><span>Save changes</span>
    </button>
  `;
}

function canEditView() {
  return cfg?.canEdit !== false;
}

// The brand marks — a GALLERY, because a site carries several and Archie brings
// back all of them: the header lockup, the reversed one, the icon, the favicon.
// One is the default (`brandLogo`), which is what the header shows and what the
// image generator stamps; the rest stay available to place by hand in the studio.
//
// Read mode shows the whole set with the default marked rather than the default
// alone: seeing that four marks were found is the thing worth knowing, and it's
// what tells you there's a choice here at all without entering edit mode.
//
// Tiles are SQUARE thumbnails with the label underneath — at 72px a wordmark and
// its reversed twin are hard to tell apart, and "Reversed" vs "Icon" is not
// something a thumbnail can say on its own.
//
// Upload is a button + a hidden input rather than the shared `.ap-dropzone`,
// because the "Reference images" row one line below in this same section is
// already a button + hidden input. Two different upload affordances that close
// together would read as two different kinds of control.
const MAX_BRAND_LOGOS = 8;

function renderBrandLogo(data, edit) {
  const list = brandLogoList(data);
  if (!list.length && !edit) return `<span class="recap__row-empty">Not set yet</span>`;
  const active = defaultLogoIndex(data, list);
  const tiles = list
    .map((logo, i) => {
      const on = i === active;
      const label = esc(logo.label || "Logo");
      // Read mode is a recap — nothing is clickable, the badge just reports
      // which mark is in use. Edit mode makes each tile the pick control.
      const frame = edit
        ? `<button type="button" class="recap__logotile${on ? " is-default" : ""}" aria-pressed="${on}" data-recap-logo-pick="${i}" title="${on ? "Default logo" : "Make default"}">`
        : `<span class="recap__logotile${on ? " is-default" : ""}">`;
      return `
      <div class="recap__logoslot">
        ${frame}
          <img src="${esc(logo.url)}" alt="${label}" loading="lazy" />
          ${on ? `<span class="recap__logotile-badge" aria-hidden="true"><i class="ap-icon-check"></i></span>` : ""}
        ${edit ? "</button>" : "</span>"}
        ${edit ? `<button type="button" class="recap__logo-remove" data-recap-logo-remove="${i}" aria-label="Remove ${label}"><i class="ap-icon-close"></i></button>` : ""}
        <span class="recap__logotile-label">${label}${on ? ` <span class="recap__logotile-tag">Default</span>` : ""}</span>
      </div>`;
    })
    .join("");
  const gallery = tiles ? `<div class="recap__logos">${tiles}</div>` : "";
  if (!edit) return gallery;
  return `
    <div class="recap__logo-edit">
      ${gallery}
      ${
        list.length < MAX_BRAND_LOGOS
          ? `<button type="button" class="ap-button secondary blue recap__logo-add" data-recap-logo-add>
               <i class="ap-icon-upload" aria-hidden="true"></i><span>Add a logo</span>
             </button>`
          : ""
      }
      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" multiple hidden data-recap-logo-input />
    </div>`;
}

// ── Edit-mode field renderers ──────────────────────────────────────────

function renderEditChips(field, values, placeholder) {
  const suggestions = cfg?.chipCloud && CHIP_SUGGESTIONS[field];
  if (suggestions && !cfg.stack) return renderChipCloud(field, values, placeholder);
  const list = Array.isArray(values) ? values : [];
  const chips = list
    .map(
      (v, i) => `
      <span class="ap-tag blue recap__chip recap__chip--editable">
        <span>${esc(v)}</span>
        <button type="button" data-recap-chip-remove="${field}" data-recap-chip-index="${i}" aria-label="Remove ${esc(v)}">
          <i class="ap-icon-close"></i>
        </button>
      </span>
    `,
    )
    .join("");
  if (suggestions)
    return `<div class="recap__chips recap__chips--edit">${chips}${renderChipMenu(field, list, placeholder)}</div>`;
  return `
    <div class="recap__chips recap__chips--edit">
      ${chips}
      <span class="recap__chip-add">
        <div class="ap-input-group recap__chip-add-field">
          <input type="text" data-recap-chip-input="${field}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" />
        </div>
        <button type="button" class="ap-icon-button stroked grey recap__chip-add-btn" data-recap-chip-add="${field}" aria-label="Add">
          <i class="ap-icon-plus"></i>
        </button>
      </span>
    </div>
  `;
}

// Primary audience is single-select. Build the option pool from Archie's
// analysed audiences (the onboarding draft carries them in
// `suggestions.audience`; a saved Playbook with a website re-derives them
// live), unioned with whatever's currently selected so nothing is ever lost.
function audienceOptionPool(data) {
  const current = Array.isArray(data.audience) ? data.audience : [];
  let analysed = data.suggestions && Array.isArray(data.suggestions.audience) ? data.suggestions.audience : [];
  if (!analysed.length && data.websiteUrl) {
    try {
      analysed = analyzeWebsite(data.websiteUrl)?.suggestions?.audience || [];
    } catch {
      analysed = [];
    }
  }
  const pool = [];
  const seen = new Set();
  const add = (v) => {
    const t = (v || "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    pool.push(t);
  };
  analysed.forEach(add);
  current.forEach(add);
  return pool;
}

// Single-select audience picker: Archie's analysed audiences are the options
// of a native dropdown (one choice only), with a trailing "Other…" entry that
// reveals a free-text input to define a custom audience. Built on the DS
// `.ap-select` dropdown (the same component as the Batch Studio playbook picker)
// so the single-choice nature reads as a proper dropdown. Options are addressed
// by index — the pool is recomputed deterministically on pick. `audienceCustom`
// (module-local, reset whenever the edit scope changes) tracks the "Other…" state.
function renderAudiencePicker(data) {
  const pool = audienceOptionPool(data);
  const selected = Array.isArray(data.audience) && data.audience.length ? data.audience[0] : "";
  if (cfg?.audienceList) return renderAudienceList(pool, selected);
  const options = pool
    .map((v, i) => {
      const on = !audienceCustom && v.toLowerCase() === selected.toLowerCase();
      return `<div class="ap-select-option${on ? " selected" : ""}" data-recap-audience-pick="${i}" role="option" aria-selected="${on}">
          <span class="ap-select-option-text">${esc(v)}</span>
          ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
        </div>`;
    })
    .join("");
  const otherOption = `<div class="ap-select-option${audienceCustom ? " selected" : ""}" data-recap-audience-pick="other" role="option" aria-selected="${audienceCustom}">
      <i class="ap-icon-plus ap-select-option-icon" aria-hidden="true"></i>
      <span class="ap-select-option-text">Other: define your own…</span>
    </div>`;
  const triggerLabel = audienceCustom ? "Other: define your own…" : selected;
  return `
    <div class="recap__audience-picker">
      <details class="ap-select recap__audience-select" data-recap-audience-details>
        <summary class="ap-select-trigger">
          <span class="ap-select-value${triggerLabel ? "" : " ap-select-placeholder"}">${esc(triggerLabel || "Choose an audience")}</span>
          <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
        </summary>
        <div class="ap-select-dropdown" role="listbox" aria-label="Primary audience">
          <div class="ap-select-options">${options}${otherOption}</div>
        </div>
      </details>
      ${
        audienceCustom
          ? `<span class="recap__chip-add recap__audience-add">
        <div class="ap-input-group recap__chip-add-field">
          <input type="text" data-recap-audience-input placeholder="Define your audience…" aria-label="Define your audience" />
        </div>
        <button type="button" class="ap-icon-button stroked grey recap__chip-add-btn" data-recap-audience-add aria-label="Add audience">
          <i class="ap-icon-plus"></i>
        </button>
      </span>`
          : ``
      }
    </div>
  `;
}

// `audienceList` (the onboarding review, welcome-alt-review.js): the same choice
// laid out IN the card — one row per option, a DS radio, and "In my own words"
// with its field — instead of a dropdown that hides the options. Same hooks
// (data-recap-audience-pick / -input / -add), so the handlers are the dropdown's.
function renderAudienceList(pool, selected) {
  // A label around the real DS radio: native, keyboard-reachable, valid HTML.
  // A click lands on the label and on its input — the handler is idempotent.
  const row = (pick, label, on) => `
    <label class="recap__audience-option${on ? " is-selected" : ""}" data-recap-audience-pick="${pick}">
      <span class="ap-radio-container"><input type="radio" name="recap-audience" ${on ? "checked" : ""} /></span>
      <span class="recap__audience-option-text">${esc(label)}</span>
    </label>`;
  const isPool = pool.some((v) => v.toLowerCase() === selected.toLowerCase());
  const own = audienceCustom || (!!selected && !isPool);
  // "In my own words" is always open: its row, then a full textarea under it.
  // Typing writes the audience as you go (onInput, no repaint — the caret stays).
  return `
    <div class="recap__audience-list" role="radiogroup" aria-label="Primary audience">
      ${pool.map((v, i) => row(i, v, !own && v.toLowerCase() === selected.toLowerCase())).join("")}
      <div class="recap__audience-own${own ? " is-selected" : ""}">
        ${row("other", "In my own words", own)}
        <div class="ap-textarea-field resizable">
          <textarea rows="3" data-recap-audience-text placeholder="Who do you write for? Busy parents who cook at home, small-team founders…" aria-label="Your audience, in your own words">${esc(own && !isPool ? selected : "")}</textarea>
        </div>
      </div>
    </div>
  `;
}

// `chipCloud` (the onboarding review): a field's chips as a cloud — the values
// found first, ticked, then the common ones for that field, unticked — each a
// toggle; your own still go in through the field after them.
const CHIP_SUGGESTIONS = {
  contentStyle: [
    "Direct and actionable",
    "Storytelling",
    "Educational how-tos",
    "Behind the scenes",
    "Data and proof",
    "Conversational",
    "Opinion and hot takes",
    "Short and punchy",
    "Customer stories",
    "Lists and tips",
  ],
  objective: [
    "Brand awareness",
    "Lead generation",
    "Sales",
    "Community engagement",
    "Website traffic",
    "Thought leadership",
    "Recruiting",
    "Customer loyalty",
  ],
  contentAction: [
    "Visit the website",
    "Book a demo",
    "Sign up",
    "Buy now",
    "Comment and share",
    "Follow the page",
    "Download a guide",
    "Contact us",
  ],
};

// `stack` (the one-page review): only the values kept show; Add opens a menu —
// a field for your own, then the common ones not kept yet.
function renderChipMenu(field, picked, placeholder) {
  const low = new Set(picked.map((v) => v.toLowerCase()));
  const rest = CHIP_SUGGESTIONS[field].filter((v) => !low.has(v.toLowerCase()));
  return `
    <details class="recap__panel-menu recap__chip-menu">
      <summary class="ap-button ghost blue"><i class="ap-icon-plus" aria-hidden="true"></i><span>Add</span></summary>
      <div class="ap-action-dropdown recap__panel-menu-pop" role="menu" aria-label="${esc(placeholder)}">
        <div class="ap-input-group recap__chip-menu-field">
          <input type="text" data-recap-chip-input="${field}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" />
        </div>
        ${rest
          .map(
            (
              v,
            ) => `<button type="button" class="ap-action-dropdown-item" role="menuitem" data-recap-chip-toggle="${field}" data-recap-chip-value="${esc(v)}">
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">${esc(v)}</span></div></div>
            </button>`,
          )
          .join("")}
      </div>
    </details>`;
}

function renderChipCloud(field, values, placeholder) {
  const picked = Array.isArray(values) ? values : [];
  const low = new Set(picked.map((v) => v.toLowerCase()));
  const rest = (CHIP_SUGGESTIONS[field] || []).filter((v) => !low.has(v.toLowerCase()));
  const chip = (v, on) =>
    `<button type="button" class="ap-filter-chip" aria-pressed="${on}" data-recap-chip-toggle="${field}" data-recap-chip-value="${esc(v)}">${on ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}<span>${esc(v)}</span></button>`;
  return `
    <div class="recap__chips recap__chips--cloud">
      ${[...picked.map((v) => chip(v, true)), ...rest.map((v) => chip(v, false))].join("")}
    </div>
    <span class="recap__chip-add">
      <div class="ap-input-group recap__chip-add-field">
        <input type="text" data-recap-chip-input="${field}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" />
      </div>
      <button type="button" class="ap-icon-button stroked grey recap__chip-add-btn" data-recap-chip-add="${field}" aria-label="Add">
        <i class="ap-icon-plus"></i>
      </button>
    </span>
  `;
}

function renderTextarea(field, value, placeholder) {
  return `
    <div class="ap-textarea-field resizable">
      <textarea data-recap-text="${field}" rows="3" placeholder="${esc(placeholder)}">${esc(value || "")}</textarea>
    </div>
  `;
}

function renderCtaEditor(data) {
  const allCtas = Array.isArray(data.ctaLinks) ? data.ctaLinks : [];
  const rows = allCtas
    .map((c, i) => ({ ...c, _i: i }))
    .filter((c) => c.checked || c.suggested === false)
    .map(
      (c) => `
      <div class="recap__cta-edit">
        <div class="ap-input-group recap__cta-edit-label">
          <input type="text" data-recap-cta-field="label" data-recap-cta-index="${c._i}" value="${esc(c.label || "")}" placeholder="Label" aria-label="CTA label" />
        </div>
        <div class="ap-input-group recap__cta-edit-url">
          <input type="text" data-recap-cta-field="url" data-recap-cta-index="${c._i}" value="${esc(c.url || "")}" placeholder="https://…" aria-label="CTA URL" />
        </div>
        <button type="button" class="ap-icon-button transparent grey recap__cta-remove" data-recap-cta-remove="${c._i}" aria-label="Remove link">
          <i class="ap-icon-close"></i>
        </button>
      </div>
    `,
    )
    .join("");
  return `
    <div class="recap__cta-edit-list">${rows}</div>
    <button type="button" class="ap-button secondary blue recap__add-row" data-recap-cta-add>
      <i class="ap-icon-plus"></i><span>Add link</span>
    </button>
  `;
}

// Reference-image gallery (#11) — up to 10 visual references, each with
// optional usage guidance (a freeform note + target networks).
const MAX_REF_IMAGES = 10;

// Read-only network mini-badges (icons only) for an image's target networks.
function renderRefNetBadges(networks) {
  const nets = Array.isArray(networks) ? networks.filter((n) => NETWORK_ICON_BY_PLATFORM[n]) : [];
  if (!nets.length) return "";
  return `<span class="recap__refimg-nets">${nets
    .map(
      (n) =>
        `<i class="${NETWORK_ICON_BY_PLATFORM[n]}" title="${esc(NETWORK_LABEL[n] || n)}" aria-label="${esc(NETWORK_LABEL[n] || n)}"></i>`,
    )
    .join("")}</span>`;
}

// Edit-mode network toggles — compact icon-only buttons (recognizable logos +
// a selection ring) so they stay one tidy row at any panel width. The platform
// name rides on title/aria-label.
function renderRefNetChips(networks, i) {
  const nets = Array.isArray(networks) ? networks : [];
  return `<div class="recap__refedit-nets">${REF_NETWORKS.map((n) => {
    const on = nets.includes(n);
    const label = esc(NETWORK_LABEL[n] || n);
    return `<button type="button" class="recap__refedit-net" aria-pressed="${on}" data-recap-refnet="${n}" data-recap-refimg-index="${i}" title="${label}" aria-label="${label}"><i class="${NETWORK_ICON_BY_PLATFORM[n]}" aria-hidden="true"></i></button>`;
  }).join("")}</div>`;
}

// Deterministic mock "vision" read of an image — the indications Archie surfaces
// (dominant colours + scene/subject tags). Stable per image (hashed from its
// label/seed), since the prototype has no real image analysis.
const REF_TAG_POOLS = [
  [/ui|product|screen|app|dashboard/, ["Product UI", "Screens", "Tech"]],
  [/team|people|candid|portrait|face|hiring/, ["People", "Candid", "Human"]],
  [/brand|board|palette|logo|identity/, ["Brand", "Studio", "Graphic"]],
  [/office|desk|work|laptop/, ["Workplace", "Indoor", "Lifestyle"]],
  [/nature|outdoor|landscape|mountain|city|street|scene/, ["Outdoor", "Scene", "Editorial"]],
];
const REF_TAG_FALLBACK = ["Photographic", "Editorial", "Lifestyle", "Minimal", "Vibrant", "Muted", "Candid", "Studio"];

// Deterministic mock signals for an image that has no stored tags/colours yet.
function refImageSignals(img) {
  const key = (img.label || img.id || img.url || "image").toLowerCase();
  const h = hashStr(key);
  const palette = [30, 50, 66, 82].map((lig, i) => {
    const hue = (((h >> (i * 5)) % 360) + 360) % 360;
    const sat = 42 + ((h >> (i * 3)) % 34);
    return hslToHex(hue, sat, lig);
  });
  let tags = null;
  for (const [re, t] of REF_TAG_POOLS) {
    if (re.test(key)) {
      tags = t;
      break;
    }
  }
  if (!tags) tags = [0, 1, 2].map((i) => REF_TAG_FALLBACK[(h >> (i * 4)) % REF_TAG_FALLBACK.length]);
  return { palette, tags: [...new Set(tags)] };
}

// An image's tags / colours — stored on the image once edited, else the mock
// signals (seeded lazily so the first edit has something to mutate).
function refTags(img) {
  return Array.isArray(img.tags) ? img.tags : refImageSignals(img).tags;
}
function refColors(img) {
  return Array.isArray(img.colors) ? img.colors : refImageSignals(img).palette;
}
// Promote the mock signals onto the image so the first edit has arrays to mutate.
function ensureRefTagsColors(img) {
  if (!Array.isArray(img.tags)) img.tags = refImageSignals(img).tags.slice();
  if (!Array.isArray(img.colors)) img.colors = refImageSignals(img).palette.slice();
}

// Per-image detail modal — big preview + Archie's extracted indications, then
// the usage notes + target networks (editable in edit mode, read-only otherwise).
function renderRefModal(data) {
  if (refModalIndex == null) return "";
  const imgs = Array.isArray(data.referenceImages) ? data.referenceImages : [];
  const img = imgs[refModalIndex];
  if (!img) return "";
  const i = refModalIndex;
  const edit = inEdit("brand"); // editable only while the Brand section is
  const tags = refTags(img);
  const colors = refColors(img);

  const tagsBlock = edit
    ? `<div class="recap__reftags">
        ${tags
          .map(
            (t, ti) =>
              `<span class="ap-tag grey"><span>${esc(t)}</span><button type="button" data-recap-reftag-remove data-recap-refimg-index="${i}" data-recap-tag-index="${ti}" aria-label="Remove ${esc(t)}"><i class="ap-icon-close"></i></button></span>`,
          )
          .join("")}
        <input type="text" class="recap__reftag-input" data-recap-reftag-input data-recap-refimg-index="${i}" placeholder="Add tag…" aria-label="Add tag" />
      </div>`
    : `<div class="recap__reftags">${
        tags.map((t) => `<span class="ap-tag grey"><span>${esc(t)}</span></span>`).join("") ||
        `<span class="recap__refmodal-empty">None</span>`
      }</div>`;

  const colorsBlock = edit
    ? `<div class="recap__refcolors">
        ${colors
          .map(
            (c, ci) =>
              `<span class="recap__refcolor"><input type="color" class="recap__refcolor-input" value="${esc(c)}" data-recap-refcolor data-recap-refimg-index="${i}" data-recap-color-index="${ci}" aria-label="Color ${ci + 1}" /><button type="button" class="recap__refcolor-x" data-recap-refcolor-remove data-recap-refimg-index="${i}" data-recap-color-index="${ci}" aria-label="Remove color"><i class="ap-icon-close"></i></button></span>`,
          )
          .join("")}
        <button type="button" class="recap__refcolor-add" data-recap-refcolor-add data-recap-refimg-index="${i}" aria-label="Add color"><i class="ap-icon-plus"></i></button>
      </div>`
    : `<div class="recap__refcolors">${
        colors
          .map((c) => `<span class="recap__refmodal-dot" style="background:${esc(c)};" title="${esc(c)}"></span>`)
          .join("") || `<span class="recap__refmodal-empty">None</span>`
      }</div>`;

  const notes = edit
    ? `<div class="ap-textarea-field resizable">
        <textarea data-recap-refnote data-recap-refimg-index="${i}" rows="3" placeholder="When to use this image, do's and don'ts, style notes" aria-label="Usage guidance">${esc(img.note || "")}</textarea>
      </div>`
    : img.note && img.note.trim()
      ? `<p class="recap__refmodal-note">${esc(img.note)}</p>`
      : `<p class="recap__refmodal-empty">No notes yet.</p>`;
  const netsBlock = edit
    ? renderRefNetChips(img.networks, i)
    : renderRefNetBadges(img.networks) || `<span class="recap__refmodal-empty">Any network.</span>`;
  const removeBtn = edit
    ? `<button type="button" class="ap-button transparent grey" data-recap-refimg-remove="${i}"><i class="ap-icon-trash"></i><span>Remove image</span></button>`
    : "";
  // DS dialog chrome (.ap-dialog + header/close/content/footer) inside a
  // centered .app-modal-backdrop scrim.
  return `
  <div class="app-modal-backdrop recap__refmodal-backdrop" data-recap-refmodal-backdrop>
    <aside class="ap-dialog recap__refmodal" role="dialog" aria-modal="true" aria-label="Reference image">
      <div class="ap-dialog-header"><span class="ap-dialog-title">Reference image</span></div>
      <button type="button" class="ap-dialog-close" data-recap-refimg-close aria-label="Close"><i class="ap-icon-close"></i></button>
      <div class="ap-dialog-content recap__refmodal-content">
        <div class="recap__refmodal-grid">
          <div class="recap__refmodal-preview"><img src="${esc(img.url)}" alt="${esc(img.label || "Reference image")}" /></div>
          <div class="recap__refmodal-panel">
            <div class="recap__refmodal-sec">
              <span class="recap__refedit-flabel">Tags</span>
              ${tagsBlock}
            </div>
            <div class="recap__refmodal-sec">
              <span class="recap__refedit-flabel">Dominant colors</span>
              ${colorsBlock}
            </div>
            <div class="recap__refmodal-sec">
              <span class="recap__refedit-flabel">Usage notes</span>
              ${notes}
            </div>
            <div class="recap__refmodal-sec">
              <span class="recap__refedit-flabel">Best for</span>
              ${netsBlock}
            </div>
          </div>
        </div>
      </div>
      <div class="ap-dialog-footer">
        <div class="ap-dialog-footer-left">${removeBtn}</div>
        <div class="ap-dialog-footer-right">
          <button type="button" class="ap-button primary orange" data-recap-refimg-close><span>Done</span></button>
        </div>
      </div>
    </aside>
  </div>`;
}

// Static Archie brand mark (same glyph as the loader, sans the SMIL pop
// animation). Paints with currentColor so the banner can tint it brand orange.
const ARCHIE_MARK_SVG = `<svg class="recap__panel-hint-icon" viewBox="0 0 227.15 170.03" aria-hidden="true"><path fill="currentColor" d="M227.15,81.98v29.37c0,4.69-3.81,8.5-8.5,8.5h-29.37c-4.69,0-8.5-3.81-8.5-8.5v-27.11c0-4.69-3.78-8.5-8.47-8.5h-27.45c-4.69,0-8.5,3.81-8.5,8.5v26.91c0,4.69-3.78,8.47-8.47,8.47h-28.92c-4.69,0-8.5,3.81-8.5,8.5v33.89c0,4.69-3.78,8.47-8.47,8.47h-32.67c-4.69,0-8.47-3.78-8.47-8.47v-34.03c0-4.69-3.81-8.47-8.5-8.47H8.47c-4.69,0-8.47-3.81-8.47-8.5v-23.86c0-4.69,3.78-8.47,8.47-8.47h23.89c4.69,0,8.5-3.81,8.5-8.5v-14.18c0-4.69,3.78-8.5,8.47-8.5h16.07c4.69,0,8.47-3.78,8.47-8.44V8.5C73.87,3.81,77.66,0,82.34,0h32.64C119.67,0,123.46,3.81,123.46,8.5v32.11c0,4.69-3.78,8.47-8.47,8.47h-32.64c-4.69,0-8.47,3.81-8.47,8.5v14.46c0,4.69-3.81,8.5-8.5,8.5h-16.04c-4.69,0-8.47,3.78-8.47,8.47v20.05c0,4.69,3.78,8.5,8.47,8.5h32.67c4.69,0,8.47-3.81,8.47-8.5v-26.83c0-4.72,3.81-8.5,8.5-8.5h30.38c3.87,0,7-3.13,7-7v-26.94c0-4.69,3.81-8.5,8.5-8.5h27.45c4.69,0,8.47,3.81,8.47,8.5v25.22c0,4.69,3.81,8.47,8.5,8.47h29.37c4.69,0,8.5,3.81,8.5,8.5Z"/></svg>`;

// Section-level edit banner (Voice profile, Brand) — where Archie sourced it.
// Butter background + the Archie mark in brand orange ("captured by Archie").
function renderSectionHint(hint) {
  if (!hint) return "";
  return `
    <div class="recap__panel-hint">
      ${ARCHIE_MARK_SVG}
      <div class="recap__panel-hint-text">
        <span class="recap__panel-hint-q">${esc(hint.q)}</span>
        <span class="recap__panel-hint-a">${esc(hint.a)}</span>
      </div>
    </div>`;
}

// ── Section panels ─────────────────────────────────────────────────────

// Edit view — toggle chips for language membership + a primary-language picker
// when more than one is selected. Voice examples are then authored per language
// in the Voice profile panel (never machine-translated).
function renderLanguagePicker(data) {
  const selected = contextLanguages(data);
  const primary = data.primaryLanguage || selected[0];
  // Single-language mode (flag OFF) — one language, switchable (asked
  // 2026-11-04: « dans la review, il faut pouvoir changer la langue »).
  if (!multilingualOn()) {
    const options = LANGUAGE_OPTIONS.map((o) => {
      const on = o === primary;
      return `<div class="ap-select-option${on ? " selected" : ""}" data-recap-lang-pick="${esc(o)}" role="option" aria-selected="${on}">
          <span class="ap-select-option-text">${esc(o)}</span>
          ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
        </div>`;
    }).join("");
    return `<details class="ap-select recap__lang-select">
        <summary class="ap-select-trigger" aria-label="Language">
          <span class="ap-select-value">${esc(primary)}</span>
          <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
        </summary>
        <div class="ap-select-dropdown" role="listbox" aria-label="Language">
          <div class="ap-select-options">${options}</div>
        </div>
      </details>`;
  }
  const chips = LANGUAGE_OPTIONS.map((o) => {
    const on = selected.includes(o);
    return `<button type="button" class="ap-filter-chip" aria-pressed="${on}" data-recap-lang-toggle="${esc(o)}">${esc(o)}</button>`;
  }).join("");
  const primaryPicker =
    selected.length > 1
      ? `<label class="recap__lang-primary">
           <span class="recap__lang-primary-label">Primary: the language I write in by default</span>
           <select class="ap-native-select recap__lang-select" data-recap-primary-language aria-label="Primary language">
             ${selected.map((o) => `<option value="${esc(o)}" ${o === primary ? "selected" : ""}>${esc(o)}</option>`).join("")}
           </select>
         </label>`
      : "";
  return `<div class="recap__lang-picker" data-recap-langs>${chips}</div>${primaryPicker}`;
}

// Guided ⇄ Free-form switch for the Voice profile section (edit mode): one of
// two views, so DS tabs (filter chips read as independent filters).
function renderVoiceModeToggle(mode) {
  const manual = mode === "manual";
  return `
    <div class="ap-tabs recap__voice-mode">
      <div class="ap-tabs-nav" role="tablist" aria-label="Voice format">
        <button type="button" class="ap-tabs-tab${manual ? "" : " active"}" role="tab" aria-selected="${!manual}" tabindex="${manual ? -1 : 0}" data-recap-voice-mode="guided">Part by part</button>
        <button type="button" class="ap-tabs-tab${manual ? " active" : ""}" role="tab" aria-selected="${manual}" tabindex="${manual ? 0 : -1}" data-recap-voice-mode="manual">In my own words</button>
      </div>
    </div>`;
}

// "Learn from…" — a single DS dropdown that merges the old "Learn from my
// posts" (social profiles) and document analysis, both scoped to Voice profile.
// `net` (flag voicePerNetwork): on a network's tab it learns THAT network's
// voice — the only way, with Edit, that a network's voice gets optimized.
function learnMenu(net = null) {
  const netAttr = net ? ` data-recap-learn-net="${esc(net)}"` : "";
  return cfg.onAnalyzeVoice
    ? `<details class="recap__panel-menu" data-recap-learn-menu>
          <summary class="ap-button ghost grey recap__panel-action recap__panel-menu-toggle">
            <i class="ap-icon-double-chat-bubbles" aria-hidden="true"></i>
            <span>Learn from…</span>
            <i class="ap-icon-chevron-down recap__menu-caret" aria-hidden="true"></i>
          </summary>
          <div class="ap-action-dropdown recap__panel-menu-pop" role="menu" aria-label="Learn voice from">
            <button type="button" class="ap-action-dropdown-item" data-recap-learn="posts"${netAttr} role="menuitem">
              <i class="ap-icon-double-chat-bubbles"></i>
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">My posts</span></div></div>
            </button>
            <button type="button" class="ap-action-dropdown-item" data-recap-learn="documents"${netAttr} role="menuitem">
              <i class="ap-icon-file--text"></i>
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">Documents…</span></div></div>
            </button>
          </div>
        </details>`
    : "";
}

// The brand's colours as editable rows — one per colour, plus "Add colour".
// Shared by the recap panel and the Playbook 2.0 Colour block.
function renderColorEditor(data) {
  const colorRows = (Array.isArray(data.brandColors) ? data.brandColors : [])
    .map(
      (c, i) => `
        <div class="recap__color-row">
          <span class="recap__color-swatch" data-recap-color-swatch="${i}" style="background:${esc(c.hex || "#ffffff")};"></span>
          <input type="text" class="recap__color-name" data-recap-color-field="name" data-recap-color-index="${i}" value="${esc(c.name || "")}" placeholder="Name" aria-label="Color name" />
          <input type="text" class="recap__color-hex" data-recap-color-field="hex" data-recap-color-index="${i}" value="${esc(c.hex || "")}" placeholder="#1A1F36" aria-label="Hex value" spellcheck="false" />
          ${renderColorRole(c, i)}
          <button type="button" class="ap-icon-button transparent grey" data-recap-color-remove="${i}" aria-label="Remove color"><i class="ap-icon-close"></i></button>
        </div>`,
    )
    .join("");
  return `<div class="recap__colors" data-recap-colors>${colorRows}</div>
    <button type="button" class="ap-button secondary blue recap__color-add" data-recap-color-add>
      <i class="ap-icon-plus"></i><span>Add color</span>
    </button>`;
}

// Headings + body font, as two inputs. Shared like the colour editor.
function renderTypoEditor(data) {
  const fonts = data.brandTypography || brandFonts(data);
  // The review (cfg.chipCloud): each font named, with an "Aa" set in it.
  if (cfg?.chipCloud) {
    const field = (key, label) => `
      <label class="recap__typo-field">
        <span class="recap__typo-aa" style="font-family: ${esc(fonts[key] || "inherit")}, sans-serif" aria-hidden="true">Aa</span>
        <span class="recap__typo-text">
          <span class="recap__typo-label">${label}</span>
          <div class="ap-input-group"><input type="text" data-recap-typo="${key}" value="${esc(fonts[key] || "")}" placeholder="${label} font" aria-label="${label} font" /></div>
        </span>
      </label>`;
    return `<div class="recap__typo-edit is-labelled">${field("headingFont", "Headings")}${field("bodyFont", "Body")}</div>`;
  }
  return `<div class="recap__typo-edit">
      <div class="ap-input-group">
        <input type="text" data-recap-typo="headingFont" value="${esc(fonts.headingFont || "")}" placeholder="Headings font" aria-label="Headings font" />
      </div>
      <div class="ap-input-group">
        <input type="text" data-recap-typo="bodyFont" value="${esc(fonts.bodyFont || "")}" placeholder="Body font" aria-label="Body font" />
      </div>
    </div>`;
}

// ── Header + rail ──────────────────────────────────────────────────────

// The Playbook's mark: its logo when it has one, the initials monogram
// otherwise. A brand that HAS a logo is recognised by it, so a tinted "AC"
// standing in front of one is a worse identity than the real thing.
//
// Both are rendered and one is hidden — the same image + monogram-twin pattern
// renderRosterLogo uses, so a logo that can't load (a data URL from a file
// the browser then rejected) falls back to the initials instead of an empty box.
// The swap is wired by onLoadError().
// ── Playbook 2.0 — the fiche in tabs ─────────────────────
// The long single page (rail + four stacked panels) became one TAB per section,
// opening on the first. (An Overview tab of four cards, one per section, was
// DELETED: every card restated a tab — git log -S renderOverview.) Only the saved Playbook's
// page (mode "library") changes; the onboarding recap keeps its reveal. The
// section renderers are the SAME — a tab hosts one panel, edit mode included.

const TABS = [
  { id: "goals", title: "Brief" },
  { id: "voice", title: "Voice profile" },
  { id: "brand", title: "Branding" },
  // How the brand's images are made (flag sexySquirrel) — kept apart from Brand,
  // which says what the brand looks like.
  { id: "images", title: "Image generation" },
  { id: "competitors", title: "Competitors" },
  { id: "influencers", title: "Influencers" },
];

// What each section is FOR, said once at the top of its tab — the tab already
// names it, so the panel head carries the sentence instead of repeating the title.
const SECTION_LEADS = {
  goals: "What the business is, who the posts are for, and what they should make happen.",
  // Flag voicePerNetwork: the model in one line — the default voice is where
  // every network starts, a network's own voice is rules on top of it.
  voice: networkVoiceOn()
    ? "The voice I start from on every network. A network with a voice of its own adds its rules on top."
    : "How the Brand sounds, in five parts. I follow them in every draft.",
  brand: "How the Brand looks: its logos, colors, type, and the rules its images follow.",
  images: "How I make the Brand's images, and what I start from.",
  competitors: "Who the Brand is measured against, so I can position it.",
  influencers: "The creators the Brand's audience listens to. I watch what they post.",
};

// The recap's sections with what each holds — the onboarding review walks
// through them one by one (welcome-alt-review.js).
export const RECAP_SECTIONS = TABS.filter((t) => t.id !== "images").map((t) => ({
  ...t,
  lead: SECTION_LEADS[t.id],
  icon: SECTIONS.find((sec) => sec.scope === t.id)?.icon || "",
}));

// The saved Playbook's page, as opposed to the creation recap: only there does
// leaving save an open section, or a reload ask first. Both pages share ONE
// layout (tabs + blocks) — the recap's old panels were deleted (2026-10-15).
function isLibrary() {
  return cfg?.mode === "library";
}

// The tabs on screen. Creation has no Images tab: image styles hang off a saved
// Playbook (their routes need its id), and the old recap never had them either.
function visibleTabs() {
  return isLibrary() ? TABS : TABS.filter((t) => t.id !== "images");
}

function tabFromUrl() {
  const q = parseHashParams();
  const wanted = q.get("tab") || q.get("section");
  const tabs = visibleTabs();
  return tabs.some((t) => t.id === wanted) ? wanted : tabs[0].id;
}

// The tab is the page's state, kept in the URL without a route change (the
// router would remount the fiche and drop an open edit).
function setTab(id) {
  activeTab = id;
  const [path] = window.location.hash.slice(1).split("?");
  const q = parseHashParams();
  q.delete("section");
  if (id === TABS[0].id) q.delete("tab");
  else q.set("tab", id);
  const query = q.toString();
  history.replaceState(null, "", `#${path}${query ? `?${query}` : ""}`);
}

// ── Voice per network (flag voicePerNetwork) ───────────────────────────────
// The Voice profile tab lists its voices left (renderVoiceNav): the default voice — generic,
// tied to no network, the Playbook's own parts — then one per network the
// Playbook publishes on, each a variation of it. Which one is on screen is
// `?voice=` — kept like `?tab=`, without a route change.
function voiceNets(data) {
  if (!networkVoiceOn() || data?.voiceMode === "manual") return [];
  return voiceNetworks(data);
}

// The run's voice review opens a network's rules in edit (null: the default
// voice) — a network without rules shows its card, the ways as tiles.
export function editVoiceNetwork(net) {
  setVoiceNet(net);
  openEdit(cfg.getData(), "voice");
}

// The fiche's networks (2026-11-05, asked — the model: « les networks
// disponibles affichés sont ceux qui ont des profils connectés · il est possible
// d'ajouter une voice pour un network dont il n'y a pas de profils connectés ·
// sans actions de l'utilisateur, un network utilise la Voice par Default »):
// the connected ones (from two, as before — with one, the default voice is that
// network's), every network with a voice of its own even with no account, and
// the one open, being configured. The others: « Add a voice for another
// network » (voiceMoreMenu).
function ficheNets(data) {
  if (!networkVoiceOn() || data?.voiceMode === "manual") return [];
  const own = Object.keys(NETWORKS).filter((n) => networkVoice(data, n).state === "own");
  const open = voiceNet && NETWORKS[voiceNet] ? [voiceNet] : [];
  // The connected first, in their order; then the others with a voice.
  return [...new Set([...voiceNets(data), ...own, ...open])];
}

// Leaving a voice being learned, on the fiche, stops it: nothing opens later.
function dropOtherProposals(keep = null) {
  if (isLibrary()) [...voiceProposals.keys()].filter((n) => n !== keep).forEach(dropVoiceProposal);
}

function setVoiceNet(net) {
  dropOtherProposals(net);
  voiceNet = net || null;
  const [path] = window.location.hash.slice(1).split("?");
  const q = parseHashParams();
  if (voiceNet) q.set("voice", voiceNet);
  else q.delete("voice");
  const query = q.toString();
  history.replaceState(null, "", `#${path}${query ? `?${query}` : ""}`);
}

// The voice being read or edited: the network's own, or the default voice.
function voiceTarget(data) {
  return (voiceNet && data?.voiceByNetwork?.[voiceNet]) || data;
}

// What marks a rule (or the summary) as this network's own (voice-parts).
const voiceNetTag = voiceNetTagHtml;

// The voice intro's door on this tab (voice-intro-modal.js): on a Playbook,
// until the intro was seen, an infobox that opens it. Never in the creation
// review — the intro is for people who knew the app before network voices.
function voiceIntroHtml(data) {
  if (!isLibrary() || introSeen() || !voiceNets(data).length) return "";
  return `<div class="ap-infobox info has-title pb2-voice-notice" role="status">
    <i class="ap-icon-info_fill" aria-hidden="true"></i>
    <div class="ap-infobox-content">
      <div class="ap-infobox-texts">
        <span class="ap-infobox-title">Each network can now have its own voice</span>
        <span class="ap-infobox-message">On top of your default voice, I add what works on each network: from your posts, or by adapting it.</span>
        <button type="button" class="ap-link" data-vi-open="${esc(data.id || "")}">Show me</button>
      </div>
    </div>
  </div>`;
}

// The voices, as the DS secondary-nav column left of the voice on screen
// (2026-10-29, asked: « on peut pas avoir des tabs et en dessous de nouveau des
// tabs ») — the page's tabs stay the only row of tabs. Built on the account
// selector's CSS-UI recipe (design-guidelines O4, ap-nav-selector being
// Angular-only): 36 px caption rows, the current one a blue fill, never an edge
// bar. Default voice first, then the networks, each marked « Follows default »
// when it has no voice of its own.
// The Voice profile tab's list (the secondary nav, recipe O4): a list of
// voices, each row one you open (2026-11-05, ux-heuristics, asked: « le fait que
// l'on puisse définir une voice par network et l'éditer en cliquant sur la même
// ligne » n'était pas compris, « il manque l'indication que le network utilise
// la voice par défaut… ou qu'elle soit remplie », « que l'utilisateur puisse
// ajouter lui-même une voice »). Default voice first, its line naming the
// networks that use it; then « Network voices », one card per network with a
// voice of its own, its rules counted; then the networks on the default voice,
// a dashed row each to configure; then « Add a voice for another network ».
// No toggle: a voice goes back to the default voice from its own page (Use my
// default voice instead) — no trash on every row (2026-11-05, asked: « ne pas
// afficher l'action supprimer sur toutes les lignes »).
const ruleCount = (v) =>
  ["voiceAlways", "voiceNever", "voiceByPost", "voiceSometimes"].reduce((n, f) => n + (v?.[f] || []).length, 0);
function renderVoiceNav(data) {
  // Creation shows each network as a card under the default voice instead.
  if (!isLibrary() || !networkVoiceOn() || data?.voiceMode === "manual") return "";
  const nets = ficheNets(data);
  // A network has a voice of its own (a card, its rules counted) or uses the
  // default voice — a dashed row to configure. No third state: the default
  // voice « by choice » is gone from the fiche (2026-11-05, asked).
  const own = nets.filter((n) => networkVoice(data, n).state === "own");
  // The run's Voice review look, its own classes reused (2026-11-05, asked:
  // « comme sur la création du playbook, avec le network voice en bold… les
  // borders sont trop grosses ») — the default voice an option card with its
  // tinted tile, the network voices one framed list with hairlines, bold names.
  const netRow = (n) => {
    const count = ruleCount(networkVoice(data, n).voice);
    return `<li class="welcome-review__net" aria-current="${n === voiceNet}">
      <button type="button" class="welcome-review__net-main" data-pb2-voice-net="${n}">
        <i class="${networkIcon(n)} welcome-review__net-icon" aria-hidden="true"></i>
        <span class="welcome-review__net-text">
          <span class="welcome-review__net-name">${esc(networkLabel(n))} voice</span>
          ${count ? `<span class="welcome-review__net-state">${count} rule${count === 1 ? "" : "s"}</span>` : ""}
        </span>
        <i class="ap-icon-chevron-right pb2-voice-nav__chevron" aria-hidden="true"></i>
      </button>
    </li>`;
  };
  // The networks on the default voice: a dashed row each, the run's Voice
  // review's own (.welcome-review__addable); a click opens it to configure.
  // « Configure », not « + Add »: the default voice is used anyway until then
  // (2026-11-05, asked: « remplacer par configure »). Every network keeps its
  // place in the one list, a card or a dashed row, as in the run (2026-11-05,
  // asked: « l'élément cliqué remonte tout en haut »).
  const configureRow = (
    n,
  ) => `<li><button type="button" class="welcome-review__addable" data-pb2-voice-net="${esc(n)}"${n === voiceNet ? ' aria-current="true"' : ""}>
              <i class="${networkIcon(n)} welcome-review__net-icon" aria-hidden="true"></i>
              <span class="welcome-review__addable-name">${esc(networkLabel(n))} voice</span>
              ${canEditView() ? '<span class="welcome-review__addable-add">Configure</span>' : ""}
            </button></li>`;
  return `<nav class="pb2-voice-nav" aria-label="Voices">
      <button type="button" class="welcome-flow__option" data-pb2-voice-net="" aria-current="${!voiceNet}">
        <span class="welcome-flow__glyph is-icon is-tinted" style="--part-tint: var(--ref-color-purple-20); --part-ink: var(--ref-color-purple-150)"><i class="ap-icon-quote" aria-hidden="true"></i></span>
        <span class="welcome-flow__option-text">
          <span class="welcome-flow__option-title">Default voice</span>
          <span class="welcome-flow__option-desc">The base of every network voice</span>
        </span>
      </button>
      <div class="welcome-review__nets">
        <p class="welcome-review__nets-head">Network voices</p>
        ${nets.length ? `<ul class="welcome-review__nets-list">${nets.map((n) => (own.includes(n) ? netRow(n) : configureRow(n))).join("")}</ul>` : ""}
        ${canEditView() ? voiceMoreMenu(nets) : ""}
      </div>
    </nav>`;
}

// « Add a voice for another network »: the networks with no account connected
// and no voice yet, in a DS action dropdown under the list (2026-11-05, asked:
// « il est possible d'ajouter une voice pour un network dont il n'y a pas de
// profils connectés »). A pick opens it, on its ways — no posts to read.
function voiceMoreMenu(listed) {
  const others = Object.keys(NETWORKS).filter((n) => !listed.includes(n));
  if (!others.length) return "";
  return `<details class="recap__panel-menu pb2-voice-more" data-pb2-voice-more>
      <summary class="ap-button ghost blue recap__panel-menu-toggle">
        <i class="ap-icon-plus" aria-hidden="true"></i>
        <span>Add a voice for another network</span>
      </summary>
      <div class="ap-action-dropdown recap__panel-menu-pop" role="menu" aria-label="Networks">
        ${others
          .map(
            (
              n,
            ) => `<button type="button" class="ap-action-dropdown-item" data-pb2-voice-net="${esc(n)}" role="menuitem">
              <i class="${networkIcon(n)}"></i>
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">${esc(networkLabel(n))}</span></div></div>
            </button>`,
          )
          .join("")}
      </div>
    </details>`;
}

function withVoiceNav(data, body) {
  const nav = renderVoiceNav(data);
  return nav ? `<div class="pb2-voice-layout">${nav}<div class="pb2-voice-main">${body}</div></div>` : body;
}

// The voice on screen names itself in the head: the list says which one,
// the head says what it is.
function voiceTitle(data) {
  if (!renderVoiceNav(data)) {
    // One network: the default voice is that network's, and says so.
    const only = onlyNetwork(data);
    return only ? { lead: `The voice I write your ${networkLabel(only)} posts in.` } : {};
  }
  return voiceNet
    ? { title: `${networkLabel(voiceNet)} voice`, icon: networkIcon(voiceNet) }
    : { title: "Default voice", icon: "ap-icon-quote" };
}

function renderHeader2(data) {
  const colors = visualColors(data);
  const accent = colors.find((c) => /accent/i.test(c.name))?.hex || colors[0]?.hex || "var(--ref-color-orange-100)";
  const primary = colors[0]?.hex || accent;
  const site = brandSite(data);
  const domain = site?.domain || prettyUrl(data.websiteUrl);
  const usedIn = typeof data.usedIn === "number" ? data.usedIn : null;
  const langs = contextLanguages(data);
  // One line of facts about the brand, each with its own glyph so the eye can
  // pick one out without reading the row, thin rules between them. The site is
  // the one live item: it opens the brand's own website.
  // (ap-icon-link, not ap-icon-web: that one is a full-colour glyph and ignores the grey.)
  const href = data.websiteUrl
    ? /^https?:\/\//.test(data.websiteUrl)
      ? data.websiteUrl
      : `https://${data.websiteUrl}`
    : domain
      ? `https://${domain}`
      : "";
  const item = (icon, body, title = "") =>
    `<span class="pb2-meta__item"${title ? ` title="${esc(title)}"` : ""}><i class="${icon} pb2-meta__icon" aria-hidden="true"></i>${body}</span>`;
  const meta = [
    domain
      ? `<span class="pb2-meta__item"><a class="pb2-meta__link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(domain)} in a new tab"><i class="ap-icon-link pb2-meta__icon" aria-hidden="true"></i>${esc(domain)}</a></span>`
      : "",
    langs.length ? item("ap-icon-translate", esc(langs.join(" · ")), langs.length > 1 ? "Languages" : "Language") : "",
    usedIn !== null ? item("ap-icon-single-chat-bubble", `Used in ${usedIn} ${usedIn === 1 ? "chat" : "chats"}`) : "",
    data.updatedAt ? item("ap-icon-history", `Updated ${esc(data.updatedAt)}`) : "",
    cfg.ownership?.owner
      ? `<span class="pb2-meta__item"><span class="ap-avatar size-24" aria-hidden="true"><span class="ap-avatar-initials">${esc(
          cfg.ownership.initials || "?",
        )}</span></span>${esc(cfg.ownership.owner)}</span>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  // The saved Playbook's page wears its card: the palette cover, the mark
  // astride its edge, the voice as a sentence under the name. The creation
  // review keeps the plain header — its brand is still being read.
  const cover = cfg.mode === "library";
  const voice = cover ? voiceSentence(data) : "";
  return `
    <header class="pb2-hero${cover ? " pb2-hero--cover" : ""}">
      ${cover ? `<div class="pb2-hero__cover"${brandCoverStyle(data)}></div>` : ""}
      <div class="pb2-hero__id">
        <span class="pb2-hero__mark">${renderHeaderMark(data, accent, primary, { square: true })}</span>
        <div class="pb2-hero__text">
          <div class="pb2-hero__titlerow">
            <h1 class="pb2-hero__name">${esc(data.name || "New Playbook")}</h1>
            ${conceptHint("playbook")}
            ${
              cfg.onEditName
                ? `<button type="button" class="ap-icon-button transparent grey" data-recap-edit-name title="Rename" aria-label="Rename Playbook"><i class="ap-icon-pen"></i></button>`
                : ""
            }
            ${
              cfg.ownership?.tag
                ? `<span class="ap-tag grey mini" title="${esc(cfg.ownership.hint || cfg.ownership.tag)}"><span>${esc(cfg.ownership.tag)}</span></span>`
                : ""
            }
          </div>
          ${voice ? `<p class="pb2-hero__voice">${esc(voice)}</p>` : ""}
          ${cover ? "" : `<div class="pb2-meta">${meta}</div>`}
        </div>
      </div>
      ${cover && meta ? `<div class="pb2-meta pb2-hero__foot">${meta}</div>` : ""}
      ${cfg.headerActions?.() ? `<div class="pb2-hero__actions">${cfg.headerActions()}</div>` : ""}
    </header>
  `;
}

// The tab head (lead + Edit, or Cancel / Save) is sticky. At rest it needs no
// edge; once content slides under it, a hairline says where the bar ends —
// otherwise a card is simply guillotined by a band of the same grey as the page.
// Wired per paint: paint() replaces the scroller, and its listener with it.
function watchTabHeadStuck() {
  const scroller = mountTarget?.querySelector(".welcome-screen.pb2");
  const head = scroller?.querySelector(".pb2-tabhead");
  const tabs = scroller?.querySelector(".pb2-tabs");
  if (!head || !tabs) return;
  const sync = () =>
    head.classList.toggle(
      "is-stuck",
      scroller.scrollTop > 0 && head.getBoundingClientRect().top <= tabs.getBoundingClientRect().bottom + 0.5,
    );
  scroller.addEventListener("scroll", sync, { passive: true });
  sync();
}

function renderTabs2(data) {
  // Pending suggestions are not part of the Playbook: they are never counted.
  const counts = {
    competitors: rosterList(data, ROSTERS.competitors).filter((c) => !c.suggested).length,
    influencers: rosterList(data, ROSTERS.influencers).filter((c) => !c.suggested).length,
  };
  return `
    <div class="ap-tabs flush pb2-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Playbook sections">
        ${visibleTabs()
          .map((t) => {
            const on = t.id === activeTab;
            // WAI-ARIA tabs: one Tab stop (the active tab), ←/→ between them (onKeydown).
            return `<button type="button" class="ap-tabs-tab${on ? " active" : ""}" role="tab" aria-selected="${on}"
            id="pb2-tab-${t.id}" aria-controls="pb2-panel" tabindex="${on ? 0 : -1}"
            data-pb2-tab="${t.id}">
            <span>${esc(t.title)}</span>
            ${counts[t.id] ? `<span class="ap-counter normal grey">${counts[t.id]}</span>` : ""}
          </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

const pb2Empty = (text) => `<p class="pb2-empty">${esc(text)}</p>`;
// Static facts, so grey tags — blue is for what you can act on.
const pb2Tags = (values) =>
  `<span class="pb2-tags">${values.map((v) => `<span class="ap-tag grey" title="${esc(v)}"><span>${esc(v)}</span></span>`).join("")}</span>`;

// The palette, as a brand guideline shows it: ONE continuous strip, then each
// colour's name, hex and (brand kit) role. One band per COLOUR — two roles on
// one hex (Primary = Accent) share their band.
function pb2Palette(data, { roles = false, max = 6 } = {}) {
  const colors = [];
  for (const c of visualColors(data)) {
    const hex = String(c.hex || "").toUpperCase();
    const same = colors.find((x) => x.hex.toUpperCase() === hex);
    if (same) same.name = [same.name, c.name].filter(Boolean).join(" · ");
    else colors.push({ ...c });
  }
  colors.splice(max);
  if (!colors.length) return pb2Empty("No colors found yet.");
  return `<div class="pb2-strip" role="img" aria-label="Brand colors: ${esc(colors.map((c) => c.name || c.hex).join(", "))}">
      ${colors.map((c) => `<span class="pb2-strip__band" style="background:${esc(c.hex)}"></span>`).join("")}
    </div>
    <ul class="pb2-swatches">${colors
      .map((c) => {
        const role = roles ? colorRoleCaption(c) : "";
        return `<li class="pb2-swatch"><span class="pb2-swatch__name">${esc(c.name || "Color")}</span><span class="pb2-swatch__hex">${esc(
          (c.hex || "").toUpperCase(),
        )}</span>${role ? `<span class="pb2-swatch__role">${esc(role)}</span>` : ""}</li>`;
      })
      .join("")}</ul>`;
}

// ── The tabs, in read mode ──────────────────────────────────────────────────
// A tab reads as a spread of blocks; EDIT opens the section's own form (the
// recap panel, unchanged), so every field, hint and save path stays one code.

// `aside`: trusted html in the caption's place (a badge, a tag) — for what a
// caption would only say in words.
function pb2Block(
  title,
  body,
  { wide = false, caption = "", hint = "", aside = "", index = 0, icon = "", className = "" } = {},
) {
  return `
    <section class="pb2-block${wide ? " pb2-block--wide" : ""}${className ? ` ${className}` : ""}" style="--pb2-i:${index}">
      <header class="pb2-block__head">
        ${icon ? `<i class="${icon} pb2-block__icon" aria-hidden="true"></i>` : ""}
        <h3 class="pb2-block__title">${esc(title)}</h3>
        ${caption ? `<span class="pb2-block__caption">${esc(caption)}</span>` : ""}
        ${aside}
      </header>
      ${hint ? `<p class="pb2-block__hint">${esc(hint)}</p>` : ""}
      <div class="pb2-block__body">${body}</div>
    </section>
  `;
}

// `editing`: Cancel / Save take Edit's place — same bar, same spot, sticky.
// `title` (+ `icon`): the voice on screen names itself above its sentence.
function pb2TabHead(
  scope,
  extra = "",
  { editing = false, noEdit = false, lead = SECTION_LEADS[scope], title = "", icon = "" } = {},
) {
  if (cfg?.stack) return ""; // the stack heads each part itself (renderStack)
  const edit =
    canEditView() && !noEdit
      ? `<button type="button" class="ap-button stroked blue" data-recap-edit-card="${scope}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit</span></button>`
      : "";
  return `
    <header class="pb2-tabhead">
      ${
        title
          ? `<div class="pb2-tabhead__text">
        <h2 class="pb2-tabhead__title">${icon ? `<i class="${icon}" aria-hidden="true"></i>` : ""}${esc(title)}</h2>
        ${lead ? `<p class="pb2-tabhead__sub">${esc(lead)}</p>` : ""}
      </div>`
          : `<p class="pb2-tabhead__lead">${esc(lead || "")}</p>`
      }
      <div class="pb2-tabhead__actions">${editing ? editActionButtons() : `${extra}${edit}`}</div>
    </header>
  `;
}

// ── The tabs, in edit mode ───────────────────────────────────────────────
// Editing is the SAME page as reading: the same blocks, titles, icons, widths
// and order, each value swapped for its field. Only the head says you're
// editing — Cancel / Save where Edit was. (It used to open the onboarding
// recap's panel: one long card, labels in a left column, groups and a banner —
// a second layout for the same content.)

// A field's guidance, minus its question: the block title already asks it.
const pb2Hint = (hint) => (hint?.a ? `<p class="pb2-hint">${esc(hint.a)}</p>` : "");

function pb2EditGrid(scope, blocks, before = "", head = {}) {
  return `${pb2TabHead(scope, "", { editing: true, ...head })}${before}<div class="pb2-grid" data-recap-editing-card>${blocks
    .filter(Boolean)
    .join("")}</div>`;
}

function renderGoalsEdit2(data) {
  const placeholder = (key) => GOAL_FIELDS.find((f) => f.key === key)?.placeholder || "";
  const chips = (key) => pb2Hint(FIELD_HINTS[key]) + renderEditChips(key, data[key], placeholder(key));
  return pb2EditGrid("goals", [
    pb2Block(
      "Your business",
      `${pb2Hint(data.businessSummary ? FIELD_HINTS.businessSummary : FIELD_HINTS.businessSummaryEmpty)}<div class="ap-textarea-field resizable">
         <textarea data-recap-summary rows="4" placeholder="Describe your business in a few sentences…">${esc(data.businessSummary || "")}</textarea>
       </div>
       <div><span class="pb2-sub">Written in</span>${multilingualOn() ? pb2Hint(FIELD_HINTS.languages) : ""}${renderLanguagePicker(data)}</div>`,
      { wide: true, index: 0, icon: "ap-icon-buildings" },
    ),
    pb2Block("Who you write for", pb2Hint(FIELD_HINTS.audience) + renderAudiencePicker(data), {
      index: 1,
      icon: "ap-icon-user",
    }),
    pb2Block("Content style", chips("contentStyle"), { index: 2, icon: "ap-icon-quote" }),
    pb2Block("Goal", chips("objective"), { index: 3, icon: "ap-icon-target" }),
    pb2Block("Call to action", chips("contentAction"), { index: 4, icon: "ap-icon-arrow-right" }),
    pb2Block("Links", pb2Hint(FIELD_HINTS.ctaLinks) + renderCtaEditor(data), {
      wide: true,
      index: 5,
      icon: "ap-icon-link",
    }),
  ]);
}

function renderVoiceEdit2(data) {
  // How it's written (guided parts, or your own words) heads the first card it
  // switches (ui-polish OB2-03: at the bottom of « The voice » it read as a
  // header over nothing); the parts follow, the same blocks as in read.
  const mode = `<div><span class="pb2-sub">Describe it</span>${renderVoiceModeToggle(data.voiceMode)}</div>`;
  if (data.voiceMode === "manual")
    return pb2EditGrid("voice", [
      pb2Block("The voice", pb2Traits(data), { wide: true, index: 0, icon: "ap-icon-quote" }),
      pb2Block(
        "In your own words",
        `${mode}<div class="ap-textarea-field resizable">
           <textarea data-recap-text="voiceManual" rows="10" placeholder="How you open, your tone, formatting, what to avoid">${esc(data.voiceManual || "")}</textarea>
         </div>`,
        { wide: true, index: 1, icon: "ap-icon-quote" },
      ),
    ]);
  // The list stays on screen in edit: switching asks, like the page tabs.
  if (voiceNet && data.voiceByNetwork?.[voiceNet]) {
    const grid = pb2EditGrid(
      "voice",
      [
        cfg.networkPicker && cfg.onVoiceWay ? voiceWaysCard(voiceNet) : "",
        ...pb2VoiceParts(data.voiceByNetwork[voiceNet], { edit: true, brand: data, net: voiceNet }),
      ],
      "",
      {
        lead: networkVoiceLead(voiceNet, data.voiceByNetwork[voiceNet], data),
        ...voiceTitle(data),
      },
    );
    return withVoiceNav(data, grid);
  }
  return withVoiceNav(
    data,
    pb2EditGrid(
      "voice",
      [
        cfg.networkPicker && cfg.onVoiceWay ? voiceWaysCard() : "",
        ...pb2VoiceParts(data, { edit: true, lead: mode }),
        ...networkVoiceCards(data),
      ],
      "",
      voiceTitle(data),
    ),
  );
}

function renderBrandEdit2(data) {
  const blocks = [
    pb2Block(
      "Logos",
      `${pb2Hint(FIELD_HINTS.brandLogo)}${renderBrandLogo(data, true)}<div><span class="pb2-sub">Versions</span>${renderLogoVariants(data, true, data.brandLogos)}</div>`,
      { wide: true, index: 0, icon: "ap-icon-image" },
    ),
    pb2Block("Colors", pb2Hint(FIELD_HINTS.brandColors) + renderColorEditor(data), { wide: true, index: 1 }),
    pb2Block("Typography", pb2Hint(FIELD_HINTS.brandType) + renderTypoEditor(data), { index: 2 }),
    pb2Block(
      "Personality",
      pb2Hint(FIELD_HINTS.brandPersonality) +
        renderTextarea("brandPersonality", data.brandPersonality, "How the Brand comes across, in a few sentences…"),
      { index: 3 },
    ),
  ];
  blocks.push(
    pb2Block("Visual rules", pb2Hint(FIELD_HINTS.visualRules) + renderVisualRules(data, true), {
      wide: true,
      index: 4,
    }),
  );
  return pb2EditGrid("brand", blocks);
}

const pb2Text = (text, empty = "Not set yet.") => (text ? `<p class="pb2-prose">${esc(text)}</p>` : pb2Empty(empty));

function renderGoalsRead2(data) {
  const audience = (data.audience || [])[0];
  const ctas = (Array.isArray(data.ctaLinks) ? data.ctaLinks : []).filter((l) => l.checked);
  const blocks = [
    pb2Block(
      "Your business",
      `${data.businessSummary ? `<p class="pb2-lead pb2-lead--xl">${esc(data.businessSummary)}</p>` : pb2Empty("No business summary yet.")}
       <div class="pb2-inline"><span class="pb2-sub">Written in</span>${pb2Tags(contextLanguages(data))}</div>`,
      {
        wide: true,
        index: 0,
        icon: "ap-icon-buildings",
        hint: "What I know about the business, and the languages I write in.",
      },
    ),
    pb2Block(
      "Who you write for",
      audience ? `<p class="pb2-lead">${esc(audience)}</p>` : pb2Empty("No audience set yet."),
      {
        index: 1,
        icon: "ap-icon-user",
        hint: "The people every post is for.",
      },
    ),
    pb2Block(
      "Content style",
      // Phrases, not labels: a tag would cut them at 180px (2026-10-28).
      (data.contentStyle || []).length
        ? `<p class="pb2-lead">${esc(data.contentStyle.map((v) => v.replace(/\.?$/, ".")).join(" "))}</p>`
        : pb2Empty("No content style yet."),
      { index: 2, icon: "ap-icon-quote", hint: "The shape every post takes." },
    ),
    pb2Block("Goal", (data.objective || []).length ? pb2Checklist(data.objective) : pb2Empty("No goal set yet."), {
      index: 3,
      icon: "ap-icon-target",
      hint: "What the posts work toward.",
    }),
    pb2Block(
      "Call to action",
      (data.contentAction || []).length
        ? pb2Checklist(data.contentAction, "ap-icon-arrow-right")
        : pb2Empty("No action set yet."),
      { index: 4, icon: "ap-icon-arrow-right", hint: "The action I end posts on." },
    ),
    pb2Block(
      "Links",
      ctas.length
        ? `<ul class="pb2-links">${ctas
            .map(
              (c) =>
                `<li class="pb2-link"><span class="pb2-link__icon" aria-hidden="true"><i class="ap-icon-link"></i></span><span class="pb2-link__text"><span class="pb2-link__label">${esc(
                  c.label || prettyUrl(c.url),
                )}</span>${c.url ? `<span class="pb2-link__url">${esc(prettyUrl(c.url))}</span>` : ""}</span></li>`,
            )
            .join("")}</ul>`
        : pb2Empty("No links yet. Add the pages a post can send readers to."),
      { wide: true, index: 5, icon: "ap-icon-link", hint: "Links I add when a post calls for an action." },
    ),
  ];
  return `${pb2TabHead("goals")}<div class="pb2-grid">${blocks.join("")}</div>`;
}

function pb2Checklist(values, icon = "ap-icon-check") {
  return `<ul class="pb2-checks">${values
    // The circle is a wrapper: an ap-icon-* class masks its own element.
    .map(
      (v) =>
        `<li class="pb2-check"><span class="pb2-check__mark" aria-hidden="true"><i class="${icon}"></i></span><span>${esc(v)}</span></li>`,
    )
    .join("")}</ul>`;
}

// The voice as Archie heard it, in three or four words — read-only in both
// modes: it's what the analysis found, not a field. Rides on the base's
// "How the Brand sounds".
function pb2Traits(data) {
  const traits = String(data.voiceProfile?.headline || "")
    .split(/\s*[·•|,]\s*/)
    .filter(Boolean)
    .slice(0, 4);
  return traits.length
    ? `<p class="pb2-traits">${traits
        .map((t) => `<span class="pb2-trait">${esc(t.charAt(0).toUpperCase() + t.slice(1))}</span>`)
        .join('<span class="pb2-trait__dot" aria-hidden="true"></span>')}</p>`
    : "";
}

// What each part says when it's empty, and what its editor asks.
const PART_COPY = {
  voiceSummary: {
    empty: "Not set yet. Say in a few sentences how the Brand sounds.",
    placeholder: "How the Brand sounds, in a few sentences…",
  },
  voiceAlways: {
    empty: "No rules yet. Add what every post does.",
    placeholder: "A rule every post follows…",
  },
  voiceNever: {
    empty: "Nothing yet. Add what no post does.",
    placeholder: "Something no post does…",
  },
  voiceByPost: {
    empty: "No cases yet. Add how each kind of post is written.",
    placeholder: "How this kind of post is written…",
  },
  voiceSometimes: {
    empty: "Nothing yet. Add the habits that come back now and then.",
    placeholder: "A habit that comes back now and then…",
  },
};

// A part, read: the summary as a lead paragraph, the others as rules.
function pb2PartBody(field, value, tag = "") {
  if (!isListPart(field)) return value ? `<p class="pb2-lead">${esc(value)}</p>` : pb2Empty(PART_COPY[field].empty);
  return cloneItems(value).length ? voiceItemsHtml(value, { tag }) : pb2Empty(PART_COPY[field].empty);
}

// A part's editor: a paragraph, or its rules — one row each, a case with its
// kind of post above the rule. The examples come from the brand's posts: shown
// under the rule, kept as they are.
function renderRuleEditor(field, items) {
  const cases = field === "voiceByPost";
  const rows = (Array.isArray(items) ? items : [])
    .map(
      (it, i) => `
      <div class="pb2-rule-edit">
        <div class="pb2-rule-edit__fields">
          ${
            cases
              ? `<div class="ap-input-group"><input type="text" data-vr-list="${field}" data-vr-index="${i}" data-vr-key="when" value="${esc(it.when || "")}" placeholder="Kind of post" aria-label="Kind of post" /></div>`
              : ""
          }
          <div class="ap-textarea-field resizable"><textarea rows="2" data-vr-list="${field}" data-vr-index="${i}" data-vr-key="text" placeholder="${esc(PART_COPY[field].placeholder)}" aria-label="${esc(PART_COPY[field].placeholder)}">${esc(it.text || "")}</textarea></div>
          ${
            it.examples?.length
              ? `<p class="pb2-rule-edit__examples">From your posts: ${it.examples.map((x) => `“${esc(x)}”`).join(" · ")}</p>`
              : ""
          }
        </div>
        <button type="button" class="ap-icon-button transparent grey recap__cta-remove" data-vr-remove="${field}" data-vr-index="${i}" aria-label="Remove"><i class="ap-icon-close"></i></button>
      </div>`,
    )
    .join("");
  return `<div class="pb2-rule-edits${cases ? " is-cases" : ""}">${rows}</div>
    <button type="button" class="ap-button secondary blue recap__add-row" data-vr-add="${field}">
      <i class="ap-icon-plus"></i><span>${cases ? "Add a case" : "Add a rule"}</span>
    </button>`;
}

function renderPartEditor(field, value) {
  return isListPart(field)
    ? renderRuleEditor(field, value)
    : renderTextarea(field, value, PART_COPY[field].placeholder);
}

// The words this brand never says — one list, read and edited in the Never block.
function pb2AvoidRow(data, { edit = false } = {}) {
  const words = data.voiceAvoid || [];
  if (!edit && !words.length) return "";
  const body = edit
    ? renderEditChips("voiceAvoid", words, "Add a word or phrase…")
    : `<span class="pb2-tags">${words
        .map(
          (w) =>
            `<span class="ap-tag grey pb2-avoid"><i class="ap-icon-ban" aria-hidden="true"></i><span>${esc(w)}</span></span>`,
        )
        .join("")}</span>`;
  return `<div class="pb2-avoid-row"><span class="pb2-sub">Words to avoid</span>${body}</div>`;
}

// The five parts of a voice (VOICE_PARTS), in one order everywhere — read and
// edit. `lead`: trusted html on top of the first block. `net` (flag
// voicePerNetwork): `data` is that network's voice and `brand` the Playbook —
// its own rules are tagged, the default voice's traits and banned words stay the
// Brand's (shown, not edited here).
function pb2VoiceParts(data, { edit = false, lead = "", index = 2, brand = data, net = null } = {}) {
  const tag = net ? voiceNetTag(net) : "";
  return voiceParts().map(({ field, title, hint }, i) => {
    let body = edit
      ? renderPartEditor(field, field === "voiceSummary" ? baseValue(data, field) : data[field])
      : pb2PartBody(field, baseValue(data, field), tag);
    if (field === "voiceSummary" && !net) body = (i === 0 ? lead : "") + pb2Traits(data) + body;
    if (field === "voiceNever" && !(net && edit)) body += pb2AvoidRow(brand, { edit: edit && !net });
    const ownSummary = net && field === "voiceSummary" && baseValue(data, field) !== baseValue(brand, field);
    return pb2Block(title, body, {
      aside: ownSummary && !edit ? tag : "",
      wide: true,
      // A network's voice written by hand: each part asks its question (the
      // former « A few questions » way, merged in 2026-11-04).
      hint: (net && edit && partQuestion(field, net)) || hint,
      index: index + i,
      icon: field === "voiceSummary" ? "ap-icon-quote" : "",
    });
  });
}

function renderVoiceRead2(data, learnMenu) {
  if (data.voiceMode === "manual") {
    const own = pb2Block("In your own words", pb2Text(data.voiceManual), { wide: true, icon: "ap-icon-quote" });
    return `${pb2TabHead("voice", learnMenu)}<div class="pb2-grid">${own}</div>`;
  }
  if (voiceNet) return renderNetworkVoiceRead(data);
  return withVoiceNav(
    data,
    `${pb2TabHead("voice", learnMenu, voiceTitle(data))}${voiceIntroHtml(data)}<div class="pb2-grid">${[
      ...pb2VoiceParts(data),
      ...networkVoiceCards(data),
    ].join("")}</div>`,
  );
}

// The creation review (flag voicePerNetwork): a card per network the Playbook
// publishes on, after the default voice — where a new user gives each network
// its rules. Rules learned from its posts: shown, with the way back to the
// default voice. None yet: the Voice step's choices (the chat's, as tiles);
// left unanswered, its first draft asks. The document and « Write them
// myself » stay on the saved Playbook's tab.
// « LinkedIn, Instagram, and X ».
const andList = (items) => new Intl.ListFormat("en", { type: "conjunction" }).format(items);

// Whether the networks get rules of their own (2026-10-28, asked: « il faut
// pouvoir choisir de spécifier (ou non) des voices pour chaque network »).
// Creation only: the draft's `voiceSplit`, never saved. The saved Playbook
// dropped it (2026-10-29): Your networks at the head of its Default voice
// tab says each network's state instead, in its list (renderVoiceNav).
const voiceSplitIsEach = (data) => data.voiceSplit !== "same";

// The choice itself: two DS radio cards, before the networks' cards in the
// creation review.
function voiceSplitBlock(data, index) {
  const each = voiceSplitIsEach(data);
  const names = andList(voiceNets(data).map(networkLabel));
  const option = (value, title, info) => `
    <label class="ap-radio-card card pb2-voice-split__option" data-pb2-voice-split="${value}">
      <input type="radio" name="pb2-voice-split" value="${value}" ${each === (value === "each") ? "checked" : ""} />
      <div>
        <span class="ap-radio-card-header"><span class="ap-radio-card-title">${esc(title)}</span></span>
        <span>${esc(info)}</span>
      </div>
    </label>`;
  const later = "You can give a network its own voice later, in your Playbook.";
  return pb2Block(
    "Your networks",
    `<div class="pb2-voice-split" role="radiogroup" aria-label="Rules per network">
      ${option("same", "The same voice everywhere", `I write for ${names} in your default voice. ${later}`)}
      ${option("each", "A voice for each network", `I add what works on ${names} on top of your default voice.`)}
    </div>`,
    {
      wide: true,
      hint: "Each network can follow your default voice as it is, or have a voice of its own.",
      index,
      className: "pb2-voice-split-block",
    },
  );
}

// The creation review (flag voicePerNetwork): after the default voice, the
// choice, then — rules for each network — a card per network the Playbook
// publishes on, where a new user gives each network its rules. Rules learned
// from its posts: shown, with the way back to the default voice. None yet: the
// Voice step's choices (the chat's, as tiles); left unanswered, its first draft
// asks. The document and « Write them myself » stay on the saved Playbook's tab.
function networkVoiceCards(data) {
  if (cfg.networkPicker && !isLibrary() && data.voiceMode !== "manual")
    return networkPickerCards(data, voiceNetworks(data));
  const nets = isLibrary() ? [] : voiceNets(data);
  if (!nets.length) return [];
  const first = voiceParts().length;
  const split = voiceSplitBlock(data, first);
  if (!voiceSplitIsEach(data)) return [split];
  return [
    split,
    ...nets.map((net, i) => {
      const label = networkLabel(net);
      const { state, chosen, voice } = networkVoice(data, net);
      const body =
        state === "own"
          ? `${learnedVoiceHtml(data, net, voice, { pending: false })}
           <div class="pb2-voice-net__foot"><button type="button" class="ap-button ghost grey" data-pb2-voice-reset="${esc(net)}">Use my default voice instead</button></div>`
          : voiceAskHtml(data, net, {
              id: net,
              choices: voiceChoices(net, { needed: !chosen }).items.filter(
                (c) => c.value !== "document" && c.value !== "edit",
              ),
              line: chosen
                ? `Your ${label} posts follow your default voice.`
                : `Your ${label} posts follow your default voice until you add some. I'll ask before your first ${label} post.`,
              later: null,
            });
      return pb2Block(`Voice for ${label}`, body, {
        wide: true,
        hint: `What your ${label} posts do on top of your default voice.`,
        index: first + 1 + i,
        icon: networkIcon(net),
        className: "pb2-voice-net",
      });
    }),
  ];
}

// The run's voice review: the ways to (re)write a voice from a source — the
// fiche's Learn from…, as tiles in a card at the head of the voice's column
// (2026-10-29, asked: in the right column, in edit, for the default voice AND a
// network's rules). `net` null: the default voice (posts of any account, a
// document); a network: its posts, a document, a few questions, adapted.
// The ways to give a voice, as the run's option rows (welcome-alt-steps.js,
// « How should I learn your voice? »): asked « faut utiliser la même chose ».
function voiceWaysRows(items) {
  return `<ul class="welcome-flow__options pb2-voice-rows">${items
    .map(
      (t) => `<li><button type="button" class="welcome-flow__option" ${t.attrs}>
        <span class="welcome-flow__glyph is-icon"><i class="${t.icon}" aria-hidden="true"></i></span>
        <span class="welcome-flow__option-text"><span class="welcome-flow__option-title">${esc(t.name)}</span><span class="welcome-flow__option-desc">${esc(t.hint)}</span></span>
        <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
      </button></li>`,
    )
    .join("")}</ul>`;
}

// A network with no voice of its own, in the run's review and on the fiche:
// an empty state, straight on the ground, not a card (2026-11-04, asked:
// « ceci devrait prendre le style des empty states, donc pas dans une card,
// mais direct sur le background. Partout »). The DS ships no generic empty
// state, so it is composed from its anatomy (design-guidelines empty-states):
// the network's glyph bare (no medallion), the benefit as an H3, one sentence,
// then the ways as the run's option rows. Still a .pb2-block, so the review
// picks it as its part's card like any other.
// `bare`: under a head that already names the network and says what happens
// meanwhile (the fiche), no glyph and no title — one sentence, then the ways
// (2026-11-05, asked: « du doublon d'information / de titre »).
function voiceEmptyState(net, rows, body, { className = "", bare = false } = {}) {
  const label = networkLabel(net);
  return `<section class="pb2-block pb2-block--wide pb2-voice-empty${bare ? " is-bare" : ""} ${className}">
    ${bare ? "" : `<i class="${networkIcon(net)} pb2-voice-empty__icon" aria-hidden="true"></i>`}
    <div class="pb2-voice-empty__text">
      ${bare ? "" : `<h3 class="pb2-voice-empty__title">Give ${esc(label)} its own voice</h3>`}
      <p class="pb2-voice-empty__body">${esc(body)}</p>
    </div>
    ${rows}
  </section>`;
}

function voiceWaysCard(
  net = null,
  { title = "Rewrite it from", hint = "", className = "pb2-voice-ways", empty = "" } = {},
) {
  const account = getConnectedProfiles().find((p) => canLearnFrom(p) && (!net || normalizeNetwork(p.platform) === net));
  const label = net ? networkLabel(net) : "";
  const tiles = [
    account && {
      value: "learn",
      icon: "ap-icon-double-chat-bubbles",
      tile: net ? `Your ${label} posts` : "An account's posts",
      hint: `${account.handle} · ${account.postCount} posts`,
    },
    {
      value: "document",
      icon: "ap-icon-file--text",
      tile: "A document",
      hint: net ? "A style guide or a brief" : "A brand book or a style guide",
    },
    net && {
      value: "adapt",
      icon: "ap-icon-sparkles",
      tile: "Adapt my default voice",
      hint: `I tune its length and format for ${label}`,
    },
    net && { value: "write", icon: "ap-icon-pen", tile: "Write it myself", hint: "Start from an empty page" },
  ].filter(Boolean);
  // At the head of a voice being edited, the ways are a tool, not a part: a
  // compact white capsule, the stage's chrome like the ↑ / ↓ nav (2026-10-29,
  // asked: « ressemble beaucoup trop à une card éditable » ; a butter strip the
  // same day vanished on the stage). Already editing: no « Write it myself ».
  if (className === "pb2-voice-ways")
    return `<section class="pb2-block pb2-block--wide pb2-voice-ways" title="${esc(
      hint ||
        (net
          ? "I show you what I'd change, and you decide what to keep."
          : "I rewrite your default voice from what I read. You can edit it after."),
    )}">
      <p class="pb2-voice-ways__lead"><i class="ap-icon-sparkles" aria-hidden="true"></i><span>${esc(title)}</span></p>
      <div class="pb2-voice-ways__actions">${tiles
        .filter((c) => c.value !== "write")
        // The labels finish « Rewrite it from … ».
        .map((c) => ({
          ...c,
          tile: { learn: net ? `${label} posts` : c.tile, adapt: "My default voice" }[c.value] || c.tile,
        }))
        .map(
          (c) =>
            `<button type="button" class="ap-button ghost grey" data-voice-ask="${esc(net || "")}" data-voice-choice="${c.value}" title="${esc(c.hint)}"><i class="${c.icon}" aria-hidden="true"></i><span>${esc(c.tile)}</span></button>`,
        )
        .join("")}</div>
    </section>`;
  const rows = voiceWaysRows(
    tiles.map((c) => ({
      attrs: `data-voice-ask="${esc(net || "")}" data-voice-choice="${c.value}"`,
      icon: c.icon,
      name: c.tile,
      hint: c.hint,
    })),
  );
  if (empty && net) return voiceEmptyState(net, rows, empty, { className });
  return pb2Block(title, rows, {
    wide: true,
    hint:
      hint ||
      (net
        ? `I show you what I'd change, and you decide what to keep.`
        : "I rewrite your default voice from what I read. You can edit it after."),
    className,
    icon: net ? networkIcon(net) : "",
  });
}

// The run's Voice review (cfg.networkPicker — 2026-10-29): a card per
// network picked, the ways to fill its voice as tiles; once it has rules, its
// part opens them in edit (setVoiceNetwork). Which networks get a voice of
// their own is picked on the review's left, in a DS multi-select
// (welcome-alt-recap, 2026-11-04, asked: « ça pourrait pas juste être un select
// avec un dropdown à choix multiple ? » — a « Your networks » part with a card
// of checkboxes, and an illustration under it, came before).
// `voiceRulesFor` is the draft's (never saved): a network out of it keeps the
// default voice, chosen; in it and left empty, the default voice too, at save.
function networkPickerCards(data, nets) {
  if (!networkVoiceOn() || !nets.length) return [];
  const picked = data.voiceRulesFor || [];
  // A network picked with an empty voice: its card is the ways to fill it.
  return nets
    .filter((net) => picked.includes(net) && !networkVoiceFilled(data, net))
    .map((net) =>
      voiceProposals.has(net)
        ? voiceProposalCard(net, voiceProposals.get(net))
        : voiceWaysCard(net, {
            empty: `Until you do, I write your ${networkLabel(net)} posts in your default voice. Start from one of these.`,
            className: `pb2-voice-net pb2-voice-net--${net}`,
          }),
    );
}

// The run's voice review: a network's voice learned and proposed IN its card
// on the right, not in a dialog (2026-11-04, asked: « il faudrait que le
// loading et le résultat s'affiche directement dans la section à droite, et
// pas dans des modales. Travaille bien mieux ce loader aussi »). The steps run
// one after the other, then the voice is filled in at once — no « Add to Voice
// profile » step here (2026-11-04, asked: « pas besoin de l'étape de
// validation "add to voice profile" remplis directement »): its editor opens,
// where it can be changed. voice-proposal-modal.js stays for the hosts with no
// column (the fiche, Clips, a draft's feedback).
const voiceProposals = new Map(); // net → { steps, at, timers }
// A step lasts twice the dialog's (LEARN_PHASE_MS): the scene is there to be
// watched (2026-11-04, asked: « un peu plus lente »).
const STEP_MS = LEARN_PHASE_MS * 2; // slow enough to be watched

function dropVoiceProposal(net) {
  voiceProposals.get(net)?.timers.forEach(clearTimeout);
  voiceProposals.delete(net);
}

// The options of openVoiceProposal: `voice` already made (after `phases`),
// else learned from `choice` / `from`. onUse(voice) adds it to the draft, at
// the end of the steps.
export function proposeVoiceInline({ ctx, net, choice = "learn", from = null, voice = null, phases = null, onUse }) {
  dropVoiceProposal(net);
  const steps = phases || learnPhases(net, from, choice);
  // Made up front, filled in at the end of the steps.
  const made = voice || proposeNetworkVoice(ctx, net, choice, from);
  const entry = { steps, at: 0, timers: [], choice, from, voice: made };
  voiceProposals.set(net, entry);
  steps.forEach((_, i) =>
    entry.timers.push(
      setTimeout(
        () => {
          if (voiceProposals.get(net) !== entry) return;
          if (i < steps.length - 1) {
            entry.at = i + 1;
            // In place, so the scene's transitions run and its loops don't restart.
            return paintVoiceStep(net, entry) || repaint();
          }
          dropVoiceProposal(net);
          onUse?.(made);
        },
        STEP_MS * (i + 1),
      ),
    ),
  );
  repaint();
}

// Learning, as a scene in the run's own language (welcome-alt-explainer.js:
// objects, an olive thread, my butter seam): what I read on top — the
// account's posts fanned, the document, or the default voice — swept by a
// scan; the thread and the seam saying the step under way, three marks for
// the three steps; and the network's voice taking shape below: blank, then
// its print breathing, then its rules written in. The objects carry no real
// text, only lines (2026-11-04, asked: « tu peux quand même faire mieux comme
// animation de loading... c'est visuellement pauvre », then « un peu plus
// lente… et pas utiliser du vrai contenu, abstrait le texte »). A step patches
// the scene in place (paintVoiceStep), never repaints it: a repaint snapped
// every transition and restarted the loops (2026-11-05, asked: « l'animation
// est un peu buggée »).
// `data-review-own-actions`: the review shows no confirm under this card.
const lines = (...widths) => widths.map((w) => `<span class="pb2-vl__bar" style="width:${w}%"></span>`).join("");
// The scan sweeps the front object only, clipped to it.
const SCAN = `<span class="pb2-vl__scan" aria-hidden="true"></span>`;

function loaderSource(net, { choice, from }) {
  if (choice === "adapt")
    return `<div class="wx-print pb2-vl__print">
      <div class="pb2-vl__head"><span class="welcome-flow__glyph is-icon"><i class="ap-icon-quote" aria-hidden="true"></i></span>${lines(44)}</div>
      <span class="pb2-vl__pills"><i></i><i></i><i></i></span>
      ${lines(92, 70)}${SCAN}
    </div>`;
  if (from)
    return `<div class="wx-source pb2-vl__doc">
      <div class="pb2-vl__head"><i class="ap-icon-file--text" aria-hidden="true"></i>${lines(40)}</div>
      ${lines(96, 84, 60)}${SCAN}
    </div>`;
  return `<div class="pb2-vl__fan">${[0, 1, 2]
    .map(
      (i) => `<article class="wx-post pb2-vl__post ${i === 0 ? "is-front" : "is-side"}">
        <div class="pb2-vl__head">
          <span class="ap-avatar size-24 wx-post__avatar"><span class="ap-avatar-initials"></span><span class="ap-avatar-network"><i class="${networkIcon(net)}" aria-hidden="true"></i></span></span>
          ${lines(36)}
        </div>
        ${lines(94, 66)}${i === 0 ? SCAN : ""}
      </article>`,
    )
    .join("")}</div>`;
}

const WAVE = Array.from({ length: 28 }, (_, i) => {
  const h = 6 + Math.round(Math.abs(Math.sin(i * 0.9) * 16 + Math.sin(i * 0.37) * 8));
  return `<rect x="${i * 9}" y="${((34 - h) / 2).toFixed(1)}" width="5" height="${h}" rx="2.5" style="--i:${i}" />`;
}).join("");

// The voice below, per step: three blank rows, its print breathing, then its
// rules written into the same three rows.
function voiceStepBody(at) {
  if (at === 1)
    return `<svg class="wx-wave pb2-vl__wave" viewBox="0 0 248 34" width="248" height="34" aria-hidden="true">${WAVE}</svg>`;
  const written = at > 1;
  return `<ul class="pb2-vl__rules${written ? "" : " is-blank"}">${[82, 64, 74]
    .map(
      (w, i) =>
        `<li style="--d:${(i * 0.6).toFixed(1)}s">${written ? `<i class="ap-icon-plus" aria-hidden="true"></i>` : ""}${lines(w)}</li>`,
    )
    .join("")}</ul>`;
}

const voiceStepPips = (steps, at) =>
  steps.map((_, i) => `<li class="${i < at ? "is-done" : i === at ? "is-current" : ""}"></li>`).join("");

function voiceProposalCard(net, entry) {
  const { steps, at } = entry;
  const label = networkLabel(net);
  return `<section class="pb2-block pb2-block--wide pb2-voice-net pb2-voice-net--${net} pb2-voice-learning is-step-${at}" data-vl-net="${esc(net)}" data-review-own-actions aria-busy="true">
    <div class="pb2-vl">
      <div class="pb2-vl__source">${loaderSource(net, entry)}</div>
      <span class="pb2-vl__thread is-in" aria-hidden="true"><i></i></span>
      <div class="pb2-vl__seam-row">
        <span class="wx-seam pb2-vl__seam" role="status"><i class="ap-icon-sparkles" aria-hidden="true"></i><span>${esc(steps[at])}</span></span>
        <ol class="pb2-vl__pips" aria-label="Step ${at + 1} of ${steps.length}">${voiceStepPips(steps, at)}</ol>
      </div>
      <span class="pb2-vl__thread is-out" aria-hidden="true"><i></i></span>
      <div class="pb2-vl__result">
        <div class="pb2-vl__result-head"><i class="${networkIcon(net)}" aria-hidden="true"></i><strong>${esc(label)} voice</strong></div>
        <div class="pb2-vl__result-body">${voiceStepBody(at)}</div>
      </div>
    </div>
  </section>`;
}

// The next step on the scene already on screen; false when it isn't there.
function paintVoiceStep(net, { steps, at }) {
  const card = mountTarget?.querySelector(`.pb2-voice-learning[data-vl-net="${CSS.escape(net)}"]`);
  if (!card) return false;
  card.className = card.className.replace(/\bis-step-\d+/, `is-step-${at}`);
  const seam = card.querySelector(".pb2-vl__seam");
  seam.lastElementChild.textContent = steps[at];
  seam.getAnimations().forEach((a) => (a.cancel(), a.play()));
  const pips = card.querySelector(".pb2-vl__pips");
  pips.setAttribute("aria-label", `Step ${at + 1} of ${steps.length}`);
  [...pips.children].forEach((li, i) => (li.className = i < at ? "is-done" : i === at ? "is-current" : ""));
  card.querySelector(".pb2-vl__result-body").innerHTML = voiceStepBody(at);
  return true;
}

// A network's own voice with something in it — empty, it still has to be filled.
export function networkVoiceFilled(data, net) {
  const { state, voice } = networkVoice(data, net);
  return state === "own" && voiceHasRules(voice);
}

// Picking: a network out of `voiceRulesFor` is not added — never set (its
// rules, if any, go; its first draft asks), one in it waits for rules. Exported for the
// review's network select (welcome-alt-recap).
export function setNetworkRules(net, on) {
  const d = cfg.getData();
  const picked = (d.voiceRulesFor || []).filter((n) => n !== net);
  d.voiceRulesFor = on ? [...picked, net] : picked;
  const rest = Object.fromEntries(Object.entries(d.voiceByNetwork || {}).filter(([n]) => n !== net));
  d.voiceByNetwork = rest;
  repaint();
}

// The same voice everywhere: every network keeps the default voice, chosen.
// Back to rules for each: what was kept that way goes, so a network learns
// from its posts again or is asked before its next draft. Creation only.
function setVoiceSplit(value) {
  const d = cfg.getData();
  if (voiceSplitIsEach(d) === (value === "each")) return;
  d.voiceSplit = value;
  d.voiceByNetwork =
    value === "same"
      ? Object.fromEntries(voiceNets(d).map((n) => [n, brandVoiceAsIs(d)]))
      : Object.fromEntries(Object.entries(d.voiceByNetwork || {}).filter(([, v]) => v.optimizedBy !== "brand"));
  repaint();
}

// « Use my default voice instead » on a network with rules of its own, on the
// saved Playbook: its rules go, confirmed first.
function resetNetworkVoice(net) {
  const d = cfg.getData();
  const label = networkLabel(net);
  openConfirmModal({
    title: `Use your default voice on ${label}?`,
    body: `I remove the ${label} voice, and ${label} follows your default voice. Drafts already written keep their text.`,
    confirmLabel: "Remove the voice",
    danger: true,
    onConfirm: () => {
      saveNetworkVoice(d.id, net, brandVoiceAsIs(d));
      // Its row is a line now (the voice list): the default voice opens.
      if (voiceNet === net) setVoiceNet(null);
      repaint();
    },
  });
}

// A network's voice from a source, on the fiche — the run's way: learned in the
// page (proposeVoiceInline), then opened in edit, filled in and unsaved: Save
// keeps it, Cancel drops it (editNetworkVoiceFrom). No proposal dialog.
// `opts`: proposeVoiceInline's choice / from / voice / phases. Left for another
// voice or an edit meanwhile, nothing opens.
export function learnNetworkVoiceInline(net, opts = {}) {
  setVoiceNet(net);
  proposeVoiceInline({
    ctx: cfg.getData(),
    net,
    ...opts,
    // Cancel brings back its ways.
    onUse: (voice) => {
      if (voiceNet === net && !editScope) editNetworkVoiceFrom(voice);
      else repaint();
    },
  });
}

// A choice on a network's card in the creation review: what Archie proposes
// lands in the draft on « Add to Voice profile »; saved with the Playbook.
function giveNetworkVoice(net, choice) {
  const d = cfg.getData();
  const set = (voice) => {
    d.voiceByNetwork = { ...(d.voiceByNetwork || {}), [net]: voice };
    repaint();
  };
  if (choice === "default") return set(brandVoiceAsIs(d));
  openVoiceProposal({ ctx: d, net, choice, onUse: set });
}

// A network with no voice of its own, on the fiche: what happens meanwhile,
// then the ways to give it one, as the run's tiles. Each tile is the fiche's
// own hook (screens/playbook.js `data-recap-learn`, `data-pb2-voice-own`).
function networkVoiceEmpty(net) {
  const label = networkLabel(net);
  const account = getConnectedProfiles().find((p) => canLearnFrom(p) && normalizeNetwork(p.platform) === net);
  const hook = (way) => `data-recap-learn="${way}" data-recap-learn-net="${esc(net)}"`;
  const tiles = [
    account && {
      attrs: hook("posts"),
      icon: "ap-icon-double-chat-bubbles",
      name: `Your ${label} posts`,
      hint: `${account.handle} · ${account.postCount} posts`,
    },
    { attrs: hook("documents"), icon: "ap-icon-file--text", name: "A document", hint: "A style guide or a brief" },
    {
      attrs: hook("adapt"),
      icon: "ap-icon-sparkles",
      name: "Adapt my default voice",
      hint: `I tune its length and format for ${label}`,
    },
    {
      attrs: "data-pb2-voice-own",
      icon: "ap-icon-pen",
      name: "Write it myself",
      hint: "Start from your default voice",
    },
  ].filter(Boolean);
  return voiceEmptyState(net, voiceWaysRows(tiles), `Give ${label} its own voice, from one of these.`, {
    className: `pb2-voice-net pb2-voice-net--${net}`,
    bare: true,
  });
}

function networkVoiceLead(net, voice, data) {
  const label = networkLabel(net);
  const base = "Your default voice";
  if (voice?.learnedFrom === ADAPTED_FROM)
    return `${base}, adapted for ${label}: what's specific to ${label} is tagged « For ${label} ».`;
  if (voice?.optimizedBy === "learned")
    return voice.postCount
      ? `${base}, plus what I learned from ${voice.postCount} posts of ${voice.learnedFrom}, tagged « For ${label} ».`
      : `${base}, plus what I learned from ${voice.learnedFrom}, tagged « For ${label} ».`;
  return `${base}, plus what you wrote for ${label}, tagged « For ${label} ».`;
}

// A network's voice, read — its row selected in the list: Learn from…
// (posts, documents) and Edit, the two ways a network's voice gets optimized;
// there is no button that optimizes it. Its own: the five parts, its rules
// tagged. None yet, or the default voice as it is: that voice on grey, warned.
function renderNetworkVoiceRead(data) {
  const net = voiceNet;
  const label = networkLabel(net);
  // Being learned: the run's own scene, in the page, under the network's name
  // (2026-11-05, asked: « réutilises les mêmes animations de loading et
  // fonctionnement dans l'édition de playbook que dans la first user
  // experience… je ne veux pas de la modale de loading »).
  const learning = canEditView() && voiceProposals.get(net);
  if (learning)
    return withVoiceNav(
      data,
      `<div class="pb2-voice-solo">
        <h2 class="pb2-tabhead__title pb2-voice-solo__title"><i class="${networkIcon(net)}" aria-hidden="true"></i>${esc(label)} voice</h2>
        ${voiceProposalCard(net, learning)}
      </div>`,
    );
  const { state, voice } = networkVoice(data, net);
  if (state === "default") {
    // Read-only: that voice on grey, as it is.
    if (!canEditView())
      return withVoiceNav(
        data,
        `${pb2TabHead("voice", "", {
          noEdit: true,
          lead: `${label} follows your default voice.`,
          ...voiceTitle(data),
        })}${voiceIntroHtml(data)}<div class="pb2-grid pb2-grid--borrowed">${pb2VoiceParts(data).join("")}</div>`,
      );
    // No copy of the default voice: an empty state that says what happens and
    // offers the ways to give the network its own voice (2026-10-29, asked:
    // « directement proposer les options de création de voice et faire un empty
    // state + compréhensible que de recopier la voice par défaut »).
    // Nothing to choose nor remove: without a voice of its own a network uses
    // the default voice (2026-11-05, asked — « Use my default voice for X » and
    // « Remove the X voice » are gone from here).
    // What X writes in, said as a DS infobox — the first thing under the head,
    // with the way to read that voice (2026-11-05, asked: « c'est absolument
    // pas clair que X utilise la default voice. On dirait qu'elle n'est juste
    // pas remplie »). The head says nothing more than its name.
    const uses = `<div class="ap-infobox info has-title pb2-voice-notice pb2-voice-uses" role="status">
      <i class="ap-icon-info_fill" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">${esc(label)} uses your default voice</span>
          <span class="ap-infobox-message">I write your ${esc(label)} posts with your default voice until you give ${esc(label)} a voice of its own.</span>
          <button type="button" class="ap-link" data-pb2-voice-net="">See your default voice</button>
        </div>
      </div>
    </div>`;
    // One column, the ways' width, centred: the name, what it writes in, the
    // ways, then its actions at the foot (2026-11-05, asked: « le placement de
    // tout le reste ne va pas, tout est éclaté / éparpillé, ça n'a aucune
    // structure » — the head had its title flush left and Remove flush right,
    // the infobox and the ways centred at two other widths).
    return withVoiceNav(
      data,
      `<div class="pb2-voice-solo">
        <h2 class="pb2-tabhead__title pb2-voice-solo__title"><i class="${networkIcon(net)}" aria-hidden="true"></i>${esc(label)} voice</h2>
        ${voiceIntroHtml(data)}${uses}${networkVoiceEmpty(net)}
      </div>`,
    );
  }
  // The way back to the default voice closes the voice, under its parts: the
  // head keeps two actions, Learn from… and Edit.
  const reset = canEditView()
    ? `<div class="pb2-voice-reset"><button type="button" class="ap-button ghost grey" data-pb2-voice-reset="${esc(net)}">Use my default voice instead</button></div>`
    : "";
  return withVoiceNav(
    data,
    `${pb2TabHead("voice", canEditView() ? learnMenu(net) : "", {
      lead: networkVoiceLead(net, voice, data),
      ...voiceTitle(data),
    })}${voiceIntroHtml(data)}<div class="pb2-grid">${pb2VoiceParts(voice, { brand: data, net }).join("")}</div>${reset}`,
  );
}

const PB2_LOGO_VERSIONS = { color: "Color", white: "White", black: "Black", icon: "Icon only" };

function renderBrandRead2(data) {
  const logos = brandLogoList(data);
  const { headingFont, bodyFont } = brandFonts(data);
  const r = data.brandRules || {};
  const specimen = (role, font, sample) =>
    `<div class="pb2-font">
      <span class="pb2-font__glyphs" style="font-family:'${esc(font)}', var(--sys-text-style-body-font-family);">Aa</span>
      <div class="pb2-font__meta">
        <span class="pb2-sub">${esc(role)}</span>
        <span class="pb2-font__name">${esc(font)}</span>
        <span class="pb2-font__sample" style="font-family:'${esc(font)}', var(--sys-text-style-body-font-family);">${esc(sample)}</span>
      </div>
    </div>`;
  const marks = logos.length
    ? `<ul class="pb2-logos">${logos
        .map(
          (l) => `<li class="pb2-logo-tile">
            <span class="pb2-logo-tile__art${l.variant === "white" || /revers|white|negative/i.test(l.label || "") ? " is-dark" : ""}"><img src="${esc(l.url)}" alt="${esc(l.label || "Logo")}" /></span>
            <span class="pb2-logo-tile__name">${esc(l.label || "Logo")}${l.url === data.brandLogo ? ' <span class="ap-tag grey mini"><span>Default</span></span>' : ""}</span>
            ${l.variant ? `<span class="pb2-logo-tile__version">${esc(PB2_LOGO_VERSIONS[l.variant] || "")}</span>` : ""}
          </li>`,
        )
        .join("")}</ul>`
    : pb2Empty("No logos yet. Select Edit to add the ones this Brand uses.");
  const pairs = (r.forbiddenPairs || []).map(
    ([a, b]) =>
      `<span class="pb2-pair"><span class="pb2-pair__chip" style="background:${esc(a)}"></span><span class="pb2-pair__chip" style="background:${esc(b)}"></span></span>`,
  );
  const blocks = [
    pb2Block("Logos", marks, { wide: true, index: 0, icon: "ap-icon-image" }),
    pb2Block("Colors", pb2Palette(data, { roles: true, max: 8 }), { wide: true, index: 1 }),
    pb2Block(
      "Typography",
      headingFont || bodyFont
        ? `<div class="pb2-fonts">${specimen("Headings", headingFont || bodyFont, "Every objective names its signal.")}${specimen(
            "Body",
            bodyFont || headingFont,
            "Short paragraphs, one idea each, and a line break that lets it land.",
          )}</div>`
        : pb2Empty("No typography captured yet."),
      { index: 2 },
    ),
    pb2Block(
      "Personality",
      data.brandPersonality
        ? `<p class="pb2-statement">${esc(data.brandPersonality)}</p>`
        : pb2Empty("No personality captured yet."),
      { index: 3 },
    ),
  ];
  blocks.push(
    pb2Block(
      "Visual rules",
      // Do / Don't moved into each image style (the style creator), 2026-10-05.
      `<dl class="pb2-facts pb2-facts--alone">
        <div><dt>Logo minimum size</dt><dd>${esc(r.logoMinPx ?? 48)} px</dd></div>
        <div><dt>Clear space around the logo</dt><dd>${esc(r.clearSpace ?? 0.5)} × the logo's height</dd></div>
        <div><dt>Logo distortion</dt><dd>${r.noLogoDistortion === false ? "Allowed" : "Never stretch or skew the logo"}</dd></div>
        <div><dt>Color pairs to avoid</dt><dd>${pairs.length ? `<span class="pb2-pairs">${pairs.join("")}</span>` : "None"}</dd></div>
      </dl>`,
      { wide: true, index: 4 },
    ),
  );
  // flag clipsSpace — what this brand's clips look like: identity, like the
  // image look; read when a video is added or a clip is opened (CONCEPTS §1).
  if (isFlagOn("clipsSpace") && isLibrary())
    blocks.push(
      pb2Block("How your clips look", renderClipLook(data), {
        wide: true,
        index: 5,
        icon: "ap-icon-video",
        hint: "Where every clip starts in the Clips space. A clip can still change it for itself.",
      }),
    );
  // The creation recap only: the image look, before the Playbook has an Images tab.
  if (!isLibrary())
    blocks.push(
      pb2Block("How your images look", renderRecapLook(data), {
        wide: true,
        index: 5,
        icon: "ap-icon-image",
        hint: "Pick a look to start from, or leave it and I'll ask the first time you generate an image.",
      }),
    );
  return `${pb2TabHead("brand")}<div class="pb2-grid">${blocks.join("")}</div>`;
}

// The clip look saves as it changes, like the image look — there's no form to
// open for four settings.
function renderClipLook(data) {
  const look = clipLookOf(data);
  const b = look.brand;
  const corners = { tl: "Top left", tr: "Top right", bl: "Bottom left", br: "Bottom right" };
  if (!canEditView())
    return `<dl class="pb2-facts pb2-facts--alone">
      <div><dt>Subtitles</dt><dd>${esc(presetLabel(look.subtitlePreset))}</dd></div>
      <div><dt>Logo</dt><dd>${b.logo ? esc(corners[b.corner]) : "None"}</dd></div>
      <div><dt>Intro card</dt><dd>${b.intro ? "Yes" : "No"}</dd></div>
      <div><dt>Outro card</dt><dd>${b.outro ? "Yes" : "No"}</dd></div>
    </dl>`;
  const toggle = (key, label, on, off = false) =>
    `<label class="ap-toggle-container"><input type="checkbox" data-pb2-cliplook-toggle="${key}" ${on ? "checked" : ""} ${off ? "disabled" : ""} /><i></i><span>${label}</span></label>`;
  return `<div class="pb2-cliplook">
    ${dsSelect({
      label: "Subtitles",
      valueHtml: esc(presetLabel(look.subtitlePreset)),
      current: look.subtitlePreset,
      attr: "data-pb2-cliplook-preset",
      options: SUBTITLE_IDS.map((id) => ({ id, label: presetLabel(id) })),
    })}
    ${toggle("logo", data.brandLogo ? "The logo on every clip" : "The logo on every clip. Add a logo first", b.logo && !!data.brandLogo, !data.brandLogo)}
    ${
      b.logo && data.brandLogo
        ? dsSelect({
            label: "Corner",
            valueHtml: esc(corners[b.corner]),
            current: b.corner,
            attr: "data-pb2-cliplook-corner",
            options: Object.entries(corners).map(([id, label]) => ({ id, label })),
          })
        : ""
    }
    ${toggle("intro", "An intro card with the clip's title", b.intro)}
    ${toggle("outro", "An outro card with the call to action", b.outro)}
  </div>`;
}

function setClipLook(patch) {
  const d = cfg.getData();
  if (!d) return;
  const look = clipLookOf(d);
  d.clipLook = {
    subtitlePreset: look.subtitlePreset,
    logo: look.brand.logo,
    corner: look.brand.corner,
    logoSize: look.brand.logoSize,
    intro: look.brand.intro,
    outro: look.brand.outro,
    ...(d.clipLook || {}),
    ...patch,
  };
  cfg.commit?.();
  repaint();
}

// The Images tab saves as it changes (styles, reference images, Generate image
// settings), so its head has no Edit. Image styles lead — making one is the
// tab's main act.
function renderImagesPanel(data) {
  const parts = renderImagesTab(data, canEditView());
  if (!parts) return "";
  return `${pb2TabHead("images", "", { noEdit: true })}<div class="pb2-grid">${[
    pb2Block("Image styles", parts.styles, { wide: true, index: 0, icon: "ap-icon-sparkles" }),
    pb2Block("Reference images", parts.references, { wide: true, index: 1, icon: "ap-icon-image" }),
    pb2Block("Generate an image", parts.generate, { wide: true, index: 2, icon: "ap-icon-sparkles-mermaid" }),
  ].join("")}</div>`;
}

// `cfg.stack`: the listed tabs one under the other, each in edit under its
// name and what it's for.
const STACK_EDITORS = {
  goals: renderGoalsEdit2,
  brand: renderBrandEdit2,
  competitors: (d) => renderRosterPanel(d, ROSTERS.competitors, true, rosterCtx),
  influencers: (d) => renderInfluencersPanel(d, true, rosterCtx),
};
function renderStack(data) {
  return cfg.stack
    .map(
      (id) => `
    <section class="pb2-stack__part" id="pb2-part-${id}" aria-labelledby="pb2-part-${id}-title">
      <header class="pb2-stack__head">
        <h2 class="pb2-stack__title" id="pb2-part-${id}-title">${esc(TABS.find((t) => t.id === id).title)}</h2>
        <p class="pb2-stack__lead">${esc(SECTION_LEADS[id])}</p>
      </header>
      ${STACK_EDITORS[id](data)}
    </section>`,
    )
    .join("");
}

function renderActivePanel(data) {
  if (cfg.stack) return renderStack(data);
  const scope = editScope;
  // Editing opens the section's own form; reading gets the tab's spread.
  if (activeTab === "voice") {
    // Creation's review: each network connected so far gets its voice — learned
    // from its posts, else optimized — shown here before it's saved.
    // (Not in the run's voice review: a network's voice starts empty there,
    // to be filled — 2026-10-29, asked: « il ne faut pas qu'elles soient préremplies ».)
    if (!isLibrary() && networkVoiceOn() && !cfg.networkPicker) data.voiceByNetwork = withNetworkVoices(data);
    // The run's voice review (cfg.networkPicker) opens a network's rules in edit.
    const keep = cfg.networkPicker ? voiceNetworks(data) : isLibrary() ? ficheNets(data) : [];
    if (voiceNet && !keep.includes(voiceNet)) setVoiceNet(null);
    return scope === "voice" ? renderVoiceEdit2(data) : renderVoiceRead2(data, learnMenu());
  }
  if (activeTab === "brand") return scope === "brand" ? renderBrandEdit2(data) : renderBrandRead2(data);
  if (activeTab === "images") return renderImagesPanel(data);
  if (activeTab === "competitors")
    return renderRosterPanel(data, ROSTERS.competitors, scope === "competitors", rosterCtx);
  if (activeTab === "influencers") return renderInfluencersPanel(data, scope === "influencers", rosterCtx);
  return scope === "goals" ? renderGoalsEdit2(data) : renderGoalsRead2(data);
}

// `square`: the tile is square, and a wide lockup shrunk into it reads as an
// empty box — so the brand's square mark (its "Icon" version) takes the tile
// when it has one. The default logo stays the default everywhere else.
function renderHeaderMark(data, accent, primary, { square = false } = {}) {
  const tint = `--brand-accent:${esc(accent)}; --brand-primary:${esc(primary)};`;
  const mono = `<span class="recap__monogram${data.brandLogo ? " is-hidden" : ""}" style="${tint}">${esc(initials(data.name))}</span>`;
  if (!data.brandLogo) return mono;
  const icon = square ? brandLogoList(data).find((l) => /^icon$/i.test(l.label || ""))?.url : "";
  return `<span class="recap__monogram recap__monogram--mark"><img src="${esc(icon || data.brandLogo)}" alt="${esc(
    data.name || "Brand",
  )} logo" data-recap-brand-logo /></span>${mono}`;
}

// ── Loader + top strip ─────────────────────────────────────────────────

function renderLoading(stageIdx) {
  const stages = cfg.loader || [];
  const idx = Math.min(stageIdx, stages.length - 1);
  const stage = stages[idx] || { title: "", sub: "" };
  const steps = stages
    .map((_, i) => {
      const c = i < idx ? "is-done" : i === idx ? "is-active" : "";
      return `<span class="recap-loading__step ${c}"></span>`;
    })
    .join("");
  return `
    <div class="recap-loading">
      <span class="recap-loading__spinner archie-loader" aria-hidden="true"></span>
      <span class="recap-loading__eyebrow"><i class="ap-icon-archie-official" aria-hidden="true"></i> Building your Playbook</span>
      <h1 class="recap-loading__title">${esc(stage.title)}</h1>
      <p class="recap-loading__sub">${esc(stage.sub)}</p>
      <div
        class="recap-loading__steps"
        role="progressbar"
        aria-valuemin="1"
        aria-valuemax="${stages.length}"
        aria-valuenow="${idx + 1}"
        aria-label="${esc(stage.title)}"
      >${steps}</div>
    </div>
  `;
}

function renderTop() {
  if (!cfg.showTop) return "";
  return `
    <header class="welcome-screen__top">
      <span class="welcome-screen__brand">
        <i class="ap-icon-archie-official"></i>
        Archie
      </span>
      <span class="ap-badge blue">BETA</span>
    </header>
  `;
}

function paint() {
  cfg.onPaint?.();
  const modeClass = cfg.mode === "library" ? "welcome-screen--library" : "";

  if (phase === "loading") {
    mountTarget.innerHTML = html`
      <section class="welcome-screen welcome-screen--reveal welcome-screen--loading ${modeClass}">
        <div class="welcome-screen__bg" aria-hidden="true"></div>
        ${raw(renderTop())}
        <div class="welcome-screen__body recap recap--loading">${raw(renderLoading(loadingStage))}</div>
      </section>
    `;
    return;
  }

  const data = cfg.getData();
  const scope = editScope;
  mountTarget.innerHTML = html`
    <section class="welcome-screen welcome-screen--reveal ${modeClass} pb2 ${scope ? "is-editing" : ""}">
      ${raw(renderTop())}
      <div class="welcome-screen__body recap pb2__body">
        ${raw(renderHeader2(data))} ${raw(cfg.notice?.() || "")} ${raw(renderTabs2(data))}
        <div class="pb2__panel" role="tabpanel" id="pb2-panel" aria-labelledby="pb2-tab-${activeTab}">
          ${raw(renderActivePanel(data))}
        </div>
        ${raw(renderRefModal(data))} ${raw(renderRosterModal(data, rosterCtx))} ${raw(renderInfluencerAddModal())}
      </div>
    </section>
  `;
  // The edit bar sticks right under the tabs, so it needs their height.
  const tabsEl = mountTarget.querySelector(".pb2-tabs");
  if (tabsEl) mountTarget.querySelector(".pb2")?.style.setProperty("--pb2-tabs-h", `${tabsEl.offsetHeight}px`);
  watchTabHeadStuck();
  portalModal();
}

// The detail modals (reference image, competitor) are rendered inside the recap
// body, but the recap scroll container / reveal transform stops their fixed
// backdrop from covering the viewport. Move whichever one is open onto <body>
// (like the app's real modals) and bind the same delegated handlers so its
// controls keep working. Only one can be open at a time — refModalIndex and
// rosterModal are mutually exclusive — so one host covers both.
function portalModal() {
  if (refModalHost) {
    refModalHost.remove();
    refModalHost = null;
  }
  const modalEl = mountTarget?.querySelector(".recap__refmodal-backdrop, .recap__cmpmodal-backdrop");
  if (!modalEl) return;
  refModalHost = document.createElement("div");
  refModalHost.className = "recap__refmodal-host";
  refModalHost.appendChild(modalEl);
  refModalHost.addEventListener("click", onClick);
  refModalHost.addEventListener("input", onInput);
  refModalHost.addEventListener("change", onChange);
  refModalHost.addEventListener("keydown", onKeydown);
  refModalHost.addEventListener("error", onLoadError, true);
  document.body.appendChild(refModalHost);
}

// ── Section-nav scroll-spy ─────────────────────────────────────────────

function setActiveNav(id) {
  mountTarget?.querySelectorAll("[data-recap-nav]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.recapNav === id);
  });
}

// ── Competitor logo fallback + discovery scan ───────────────────────────

// A competitor favicon that can't load (no icon for that domain, blocked
// request, offline session) hides itself and reveals its monogram twin. Runs in
// the capture phase because `error` events don't bubble.
function onLoadError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  // Same twin swap for the header's brand mark, one level up: the image is
  // wrapped in the tile, so it's the TILE that hides and the monogram after it
  // that comes back.
  if (img.hasAttribute("data-recap-brand-logo")) {
    const tile = img.closest(".recap__monogram--mark");
    tile?.classList.add("is-hidden");
    tile?.nextElementSibling?.classList.remove("is-hidden");
    return;
  }
  if (!img.hasAttribute("data-recap-cmp-logo")) return;
  img.classList.add("is-hidden");
  img.nextElementSibling?.classList.remove("is-hidden");
}

// ── Edit-mode mutations ──────────────────────────────────────────────────

function addChip(field) {
  const data = cfg.getData();
  if (!data || !mountTarget) return;
  const input = mountTarget.querySelector(`[data-recap-chip-input="${field}"]`);
  const val = (input?.value || "").trim();
  if (!val) return;
  const list = Array.isArray(data[field]) ? data[field].slice() : [];
  if (!list.some((v) => v.toLowerCase() === val.toLowerCase())) list.push(val);
  data[field] = list;
  repaint();
  mountTarget.querySelector(`[data-recap-chip-input="${field}"]`)?.focus();
}

// Single-select: replace the audience with exactly the picked value.
function setAudience(value) {
  const data = cfg.getData();
  if (!data) return;
  const t = (value || "").trim();
  if (!t) return;
  data.audience = [t];
  repaint();
}

function addAudienceCustom() {
  const data = cfg.getData();
  if (!data || !mountTarget) return;
  const input = mountTarget.querySelector("[data-recap-audience-input]");
  const val = (input?.value || "").trim();
  if (!val) return;
  audienceCustom = false;
  setAudience(val);
}

// Every hook that writes to the Playbook. In read-only mode they're not rendered
// — this list is the second line of defence, so a stale DOM node or a hook added
// later without thinking can't slip a write past the gate.
const WRITE_HOOKS = [
  "[data-recap-edit-card]",
  "[data-recap-edit-name]",
  "[data-recap-save]",
  "[data-recap-cmp-add]",
  "[data-recap-cmp-remove]",
  "[data-recap-cmp-accept]",
  "[data-recap-cmp-accept-all]",
  "[data-recap-cmp-unaccept]",
  "[data-recap-cmp-dismiss]",
  "[data-recap-cmp-discover]",
  "[data-recap-infadd-open]",
  "[data-recap-infadd-submit]",
  "[data-recap-refimg-add]",
  "[data-recap-refimg-remove]",
  "[data-recap-learn]",
  "[data-recap-look]",
  "[data-recap-kit-pick]",
  "[data-recap-kit-pair-add]",
  "[data-recap-kit-pair-remove]",
].join(",");

// ── Edit lifecycle ───────────────────────────────────────────────────────

// Open a section in edit: the snapshot Cancel restores, then the baseline the
// "unsaved changes" check compares against.
function openEdit(data, scope) {
  if (scope === "brand") ensureBrand(data);
  const editRoster = ROSTERS[scope];
  if (editRoster) rosterList(data, editRoster);
  snapshot = snapshotEditable(data);
  editScope = scope;
  audienceCustom = false;
  repaint();
  // Taken AFTER the editor paints: rendering it seeds fields (a language's voice
  // entry), which would otherwise read as an edit nobody made.
  editBaseline = JSON.stringify(snapshotEditable(data));
}

function resetEdit() {
  snapshot = null;
  editBaseline = null;
  editScope = null;
  refModalIndex = null;
  closeRosterDialogs();
  audienceCustom = false;
}

function isDirty(data) {
  return !!data && editBaseline !== null && JSON.stringify(snapshotEditable(data)) !== editBaseline;
}

// Save — tidy what the editor left half-filled, persist, close the section.
function commitEdit(data) {
  if (typeof data.name === "string") data.name = data.name.trim();
  if (Array.isArray(data.ctaLinks)) {
    data.ctaLinks = data.ctaLinks.filter((c) => (c.label || "").trim() || (c.url || "").trim() || c.suggested);
  }
  // Drop the rules left blank — in the voice being edited (a network's own, or
  // the default voice). A network's rule that isn't the default voice's is its own.
  const voice = editScope === "voice" ? voiceTarget(data) : data;
  voiceParts().forEach(({ field }) => {
    if (isListPart(field) && Array.isArray(voice[field])) voice[field] = cloneItems(voice[field]);
  });
  // A network's voice edited: optimized if something changed, else it stays
  // the default voice as it is (and says so).
  if (voice !== data) {
    const changed = markAdapted(data, voice);
    if (voice.optimizedBy !== "learned") voice.optimizedBy = changed ? "you" : "brand";
    if (!changed) showToast(`Nothing changed. ${networkLabel(voiceNet)} still follows your default voice.`);
  }
  // A voice saved with a change is stamped: the drafts written before it say so.
  if (editScope === "voice" && isDirty(data)) {
    if (voice !== data) voice.changedAt = Date.now();
    else data.voiceChangedAt = Date.now();
  }
  // Drop roster entries left completely blank (an "Add competitor" row the
  // user opened and abandoned) and social rows with no URL. `suggested` is
  // kept: an unaccepted proposal stays pending across a Save rather than
  // being silently adopted into the Playbook.
  Object.values(ROSTERS).forEach(({ listKey }) => {
    if (!Array.isArray(data[listKey])) return;
    data[listKey] = data[listKey].filter(
      (c) => (c.name || "").trim() || (c.websiteUrl || "").trim() || (c.description || "").trim(),
    );
    data[listKey].forEach((c) => {
      c.socials = (Array.isArray(c.socials) ? c.socials : []).filter((s) => (s.url || "").trim());
    });
  });
  cfg.commit?.();
  resetEdit();
}

// Playbook 2.0: a section in edit left by a ROUTE (a chat in the rail, Start a
// chat…) is SAVED — the page is going away, there is nowhere to ask; the toast
// says so and carries the way back. A TAB switch asks instead (switchTab).
// Nothing changed → the editor simply closes.
function saveOnLeave() {
  if (!editScope || !cfg) return;
  const data = cfg.getData();
  if (!isDirty(data)) {
    resetEdit();
    return;
  }
  const title = SECTIONS.find((x) => x.scope === editScope)?.title || "Playbook";
  const before = snapshot;
  const revert = cfg.revert;
  commitEdit(data);
  showToast(`${title} changes saved.`, {
    action: {
      label: "Undo",
      onClick: () => {
        revert?.(before);
        repaint();
      },
    },
  });
}

// Changing tab with unsaved changes asks what to do with them (2026-10-06, the
// user's call over the silent save): Save changes, Discard changes, or — the X
// or Esc — stay on the edit. Nothing changed → the editor closes, no question.
function switchTab(id) {
  leaveEdit(() => {
    dropOtherProposals();
    setTab(id);
    repaint();
    mountTarget?.querySelector(".welcome-screen")?.scrollTo({ top: 0 });
  });
}

// Leave whatever is in edit, then `go` — asking first when it has changes.
function leaveEdit(go) {
  const data = cfg?.getData();
  if (!editScope || !isDirty(data)) {
    if (editScope) resetEdit();
    go();
    return;
  }
  const title = SECTIONS.find((x) => x.scope === editScope)?.title || "this section";
  openConfirmModal({
    title: `Save your changes to ${title}?`,
    body: "You're leaving this tab with changes you haven't saved.",
    confirmLabel: "Save changes",
    cancelLabel: "Discard changes",
    onConfirm: () => {
      commitEdit(cfg.getData());
      go();
    },
    onCancel: () => {
      if (snapshot) cfg.revert?.(snapshot);
      resetEdit();
      go();
    },
  });
}

// Edit a network's voice from a starting point that isn't saved: the default
// voice (a network without its own), or what Archie proposes. Cancel goes back
// to what was saved; Save keeps it (commitEdit).
function editNetworkVoiceFrom(voice) {
  const d = cfg.getData();
  const before = snapshotEditable(d);
  d.voiceByNetwork = { ...(d.voiceByNetwork || {}), [voiceNet]: cloneNetworkVoice(voice) };
  openEdit(d, "voice");
  snapshot = before;
  editBaseline = JSON.stringify(before);
}

function onClick(event) {
  // Playbook 2.0 tabs — never locked; leaving a section with changes asks.
  const tab = event.target.closest("[data-pb2-tab]");
  if (tab) {
    if (tab.dataset.pb2Tab !== activeTab) switchTab(tab.dataset.pb2Tab);
    return;
  }
  // Voice per network — the Voice profile's own tabs; Edit on a network without
  // a voice of its own starts from the default voice as it is.
  // Write it myself, on a network without rules: its editor, from the default
  // voice as it is.
  if (event.target.closest("[data-pb2-voice-own]") && voiceNet)
    return editNetworkVoiceFrom(brandVoiceAsIs(cfg.getData()));
  const voiceTab = event.target.closest("[data-pb2-voice-net]");
  if (voiceTab) {
    voiceTab.closest("details")?.removeAttribute("open");
    const net = voiceTab.dataset.pb2VoiceNet || null;
    if (net !== voiceNet)
      leaveEdit(() => {
        setVoiceNet(net);
        repaint();
      });
    return;
  }
  const clipPreset = event.target.closest("[data-pb2-cliplook-preset]");
  if (clipPreset) return setClipLook({ subtitlePreset: clipPreset.dataset.pb2CliplookPreset });
  const clipCorner = event.target.closest("[data-pb2-cliplook-corner]");
  if (clipCorner) return setClipLook({ corner: clipCorner.dataset.pb2CliplookCorner });
  const clipToggle = event.target.closest("[data-pb2-cliplook-toggle]");
  if (clipToggle && clipToggle.matches("input"))
    return setClipLook({ [clipToggle.dataset.pb2CliplookToggle]: clipToggle.checked });
  const giveVoice = !isLibrary() && event.target.closest("[data-voice-choice]");
  if (giveVoice && cfg.onVoiceWay)
    return cfg.onVoiceWay(giveVoice.dataset.voiceAsk || null, giveVoice.dataset.voiceChoice);
  if (giveVoice) return giveNetworkVoice(giveVoice.dataset.voiceAsk, giveVoice.dataset.voiceChoice);
  // A click on the label clicks its radio too: answer the radio's alone, or
  // the saved Playbook's confirm would open twice.
  const voiceSplit = event.target.closest("[data-pb2-voice-split]");
  if (voiceSplit) return event.target.matches("input") && setVoiceSplit(voiceSplit.dataset.pb2VoiceSplit);
  const resetVoice = event.target.closest("[data-pb2-voice-reset]");
  if (resetVoice && cfg.networkPicker) return setNetworkRules(resetVoice.dataset.pb2VoiceReset, false);
  if (resetVoice)
    return isLibrary()
      ? resetNetworkVoice(resetVoice.dataset.pb2VoiceReset)
      : giveNetworkVoice(resetVoice.dataset.pb2VoiceReset, "default");
  if (!canEditView() && event.target.closest(WRITE_HOOKS)) return;

  // Section-nav — scroll the panel into view (buttons, not anchors, so the
  // hash router is never triggered).
  const nav = event.target.closest("[data-recap-nav]");
  if (nav) {
    const el = mountTarget?.querySelector(`#${nav.dataset.recapNav}`);
    el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    setActiveNav(nav.dataset.recapNav);
    return;
  }

  // Header name pencil → rename (mode-specific handler).
  if (event.target.closest("[data-recap-edit-name]")) {
    cfg.onEditName?.();
    return;
  }

  const data = cfg.getData();
  if (!data) return;

  // Image styles (flag sexySquirrel) — live in and out of edit mode.
  if (handleImageStylesClick(event, data, repaint)) return;
  if (!isLibrary() && handleRecapLookClick(event, data)) {
    repaint();
    return;
  }

  // Brand kit rows (flag sexySquirrel) — only live while a section is edited.
  if (editScope && handleKitClick(event, data)) {
    repaint();
    return;
  }

  const penBtn = event.target.closest("[data-recap-edit-card]");
  if (penBtn) {
    openEdit(data, penBtn.dataset.recapEditCard);
    mountTarget
      ?.querySelector(
        "[data-recap-editing-card] input, [data-recap-editing-card] textarea, [data-recap-editing-card] select",
      )
      ?.focus();
    return;
  }

  if (event.target.closest("[data-recap-cancel]")) {
    if (snapshot) cfg.revert?.(snapshot);
    resetEdit();
    repaint();
    return;
  }

  if (event.target.closest("[data-recap-save]")) {
    commitEdit(data);
    repaint();
    return;
  }

  // ── Add an influencer + Competitors + Influencers (playbook-rosters.js) ──
  if (handleRosterClick(event, data, rosterCtx)) return;

  // Voice profile: switch between the guided fields and a free-form textarea.
  const voiceMode = event.target.closest("[data-recap-voice-mode]");
  if (voiceMode) {
    data.voiceMode = voiceMode.dataset.recapVoiceMode;
    repaint();
    mountTarget?.querySelector("[data-recap-text='voiceManual']")?.focus();
    return;
  }

  // Languages (Brief) — toggle a language in/out of the Playbook.
  const langToggle = event.target.closest("[data-recap-lang-toggle]");
  if (langToggle) {
    const lang = langToggle.dataset.recapLangToggle;
    const langs = contextLanguages(data).slice();
    const at = langs.indexOf(lang);
    if (at >= 0) {
      if (langs.length <= 1) return; // never remove the last language
      langs.splice(at, 1);
      if (data.voiceByLanguage) delete data.voiceByLanguage[lang];
      if (data.primaryLanguage === lang) data.primaryLanguage = langs[0];
    } else {
      langs.push(lang);
      if (!data.voiceByLanguage || typeof data.voiceByLanguage !== "object") data.voiceByLanguage = {};
      if (!data.voiceByLanguage[lang]) data.voiceByLanguage[lang] = emptyVoiceEntry(data);
    }
    data.languages = langs;
    if (!data.primaryLanguage || !langs.includes(data.primaryLanguage)) data.primaryLanguage = langs[0];
    repaint();
    return;
  }

  // Single-language switch (flag OFF): the Playbook's one language, replaced.
  // Its voice entry moves with it — the same words, relabelled.
  const langPick = event.target.closest("[data-recap-lang-pick]");
  if (langPick) {
    langPick.closest("details")?.removeAttribute("open");
    const lang = langPick.dataset.recapLangPick;
    const prev = contextLanguages(data)[0];
    if (lang !== prev) {
      const vbl = data.voiceByLanguage && typeof data.voiceByLanguage === "object" ? data.voiceByLanguage : {};
      vbl[lang] = vbl[prev] || vbl[lang] || emptyVoiceEntry(data);
      delete vbl[prev];
      data.voiceByLanguage = vbl;
      data.languages = [lang];
      data.primaryLanguage = lang;
      data.language = lang;
    }
    repaint();
    return;
  }

  // Primary audience dropdown — pick an analysed option (by pool index) or
  // switch to "Other…", which reveals the free-text input. Picking closes the
  // DS .ap-select <details>.
  const audPick = event.target.closest("[data-recap-audience-pick]");
  if (audPick) {
    audPick.closest("details")?.removeAttribute("open");
    const val = audPick.dataset.recapAudiencePick;
    if (val === "other") {
      audienceCustom = true;
      repaint();
      mountTarget?.querySelector("[data-recap-audience-input], [data-recap-audience-text]")?.focus();
    } else {
      audienceCustom = false;
      const pool = audienceOptionPool(data);
      const idx = Number(val);
      if (pool[idx] != null) setAudience(pool[idx]);
      else repaint();
    }
    return;
  }
  // Confirm a custom value typed under the "Other…" option.
  if (event.target.closest("[data-recap-audience-add]")) {
    addAudienceCustom();
    return;
  }

  // Chip cloud (cfg.chipCloud): a toggle per value — ticked joins the field,
  // unticked leaves it.
  const chipToggle = event.target.closest("[data-recap-chip-toggle]");
  if (chipToggle) {
    const field = chipToggle.dataset.recapChipToggle;
    const value = chipToggle.dataset.recapChipValue;
    const list = Array.isArray(data[field]) ? data[field] : [];
    const has = list.some((v) => v.toLowerCase() === value.toLowerCase());
    data[field] = has ? list.filter((v) => v.toLowerCase() !== value.toLowerCase()) : [...list, value];
    repaint();
    return;
  }

  const chipRemove = event.target.closest("[data-recap-chip-remove]");
  if (chipRemove) {
    const field = chipRemove.dataset.recapChipRemove;
    const idx = Number(chipRemove.dataset.recapChipIndex);
    if (Array.isArray(data[field])) data[field] = data[field].filter((_, i) => i !== idx);
    repaint();
    return;
  }

  const chipAdd = event.target.closest("[data-recap-chip-add]");
  if (chipAdd) {
    addChip(chipAdd.dataset.recapChipAdd);
    return;
  }

  // A voice part's rules (rule-editor rows).
  const ruleRemove = event.target.closest("[data-vr-remove]");
  if (ruleRemove) {
    const field = ruleRemove.dataset.vrRemove;
    const idx = Number(ruleRemove.dataset.vrIndex);
    const target = voiceTarget(data);
    if (Array.isArray(target[field])) target[field] = target[field].filter((_, i) => i !== idx);
    repaint();
    return;
  }
  const ruleAdd = event.target.closest("[data-vr-add]");
  if (ruleAdd) {
    const field = ruleAdd.dataset.vrAdd;
    const target = voiceTarget(data);
    const list = Array.isArray(target[field]) ? target[field] : [];
    target[field] = [...list, field === "voiceByPost" ? { when: "", text: "" } : { text: "" }];
    repaint();
    const inputs = mountTarget?.querySelectorAll(`[data-vr-list="${field}"]`);
    inputs?.[field === "voiceByPost" ? inputs.length - 2 : inputs.length - 1]?.focus();
    return;
  }

  const ctaRemove = event.target.closest("[data-recap-cta-remove]");
  if (ctaRemove) {
    const idx = Number(ctaRemove.dataset.recapCtaRemove);
    if (Array.isArray(data.ctaLinks)) data.ctaLinks = data.ctaLinks.filter((_, i) => i !== idx);
    repaint();
    return;
  }

  if (event.target.closest("[data-recap-cta-add]")) {
    const ctas = Array.isArray(data.ctaLinks) ? data.ctaLinks.slice() : [];
    ctas.push({ label: "", url: "", checked: true, suggested: false });
    data.ctaLinks = ctas;
    repaint();
    const inputs = mountTarget?.querySelectorAll('[data-recap-cta-field="label"]');
    inputs?.[inputs.length - 1]?.focus();
    return;
  }

  // Brand colours — add / remove a named #hex swatch.
  const colorRemove = event.target.closest("[data-recap-color-remove]");
  if (colorRemove) {
    const idx = Number(colorRemove.dataset.recapColorRemove);
    if (Array.isArray(data.brandColors)) data.brandColors = data.brandColors.filter((_, i) => i !== idx);
    repaint();
    return;
  }
  if (event.target.closest("[data-recap-color-add]")) {
    const list = Array.isArray(data.brandColors) ? data.brandColors.slice() : [];
    list.push({ name: "", hex: "#1A1F36" });
    data.brandColors = list;
    repaint();
    const inputs = mountTarget?.querySelectorAll('[data-recap-color-field="name"]');
    inputs?.[inputs.length - 1]?.focus();
    return;
  }

  // Brand logos — promote one to default / drop one / add more. All part of the
  // Brand section's Save/Cancel flow, like every other field in it.
  if (event.target.closest("[data-recap-logo-add]")) {
    mountTarget?.querySelector("[data-recap-logo-input]")?.click();
    return;
  }
  const logoPick = event.target.closest("[data-recap-logo-pick]");
  if (logoPick) {
    const logo = brandLogoList(data)[Number(logoPick.dataset.recapLogoPick)];
    // The default is stored as the url, not an index — an index would silently
    // point at a different mark as soon as one above it is removed.
    if (logo) data.brandLogo = logo.url;
    repaint();
    return;
  }
  // Default look — one hook for the three sub-controls, single-select with toggle-off.
  // Pressing the picked chip again clears the field, and cleared IS "no preference".
  const look = event.target.closest("[data-recap-look]");
  if (look) {
    const field = look.dataset.recapLook;
    const val = look.dataset.recapLookValue;
    if (!data.imageDefaults || typeof data.imageDefaults !== "object") {
      data.imageDefaults = { imageType: "", style: "", refMode: "" };
    }
    data.imageDefaults[field] = data.imageDefaults[field] === val ? "" : val;
    repaint();
    return;
  }
  const logoRemove = event.target.closest("[data-recap-logo-remove]");
  if (logoRemove) {
    const idx = Number(logoRemove.dataset.recapLogoRemove);
    const list = brandLogoList(data).slice();
    const [gone] = list.splice(idx, 1);
    data.brandLogos = list;
    // Removing the default hands the job to whatever's left, so the header and
    // the generator are never pointed at a mark that isn't in the set anymore.
    if (gone && gone.url === data.brandLogo) data.brandLogo = list[0]?.url || "";
    repaint();
    return;
  }

  // Reference images — open the file picker / open the detail modal / close it /
  // remove a thumbnail.
  if (event.target.closest("[data-recap-refimg-add]")) {
    mountTarget?.querySelector("[data-recap-refimg-input]")?.click();
    return;
  }
  const refOpen = event.target.closest("[data-recap-refimg-open]");
  if (refOpen) {
    refModalIndex = Number(refOpen.dataset.recapRefimgOpen);
    repaint();
    return;
  }
  // Close the modal (× / Done button, or a click on the backdrop itself).
  // Reference-image edits are part of the Brand section's Save/Cancel flow — no
  // separate commit here.
  if (event.target.closest("[data-recap-refimg-close]") || event.target.matches?.("[data-recap-refmodal-backdrop]")) {
    refModalIndex = null;
    repaint();
    return;
  }
  const refImgRemove = event.target.closest("[data-recap-refimg-remove]");
  if (refImgRemove) {
    const idx = Number(refImgRemove.dataset.recapRefimgRemove);
    if (Array.isArray(data.referenceImages)) data.referenceImages = data.referenceImages.filter((_, i) => i !== idx);
    refModalIndex = null; // the open image may be gone / indices shifted
    repaint();
    return;
  }
  // Reference image — toggle a target network on/off (in place, no page jump).
  const refNet = event.target.closest("[data-recap-refnet]");
  if (refNet) {
    const idx = Number(refNet.dataset.recapRefimgIndex);
    const net = refNet.dataset.recapRefnet;
    const img = data.referenceImages?.[idx];
    if (img) {
      const nets = Array.isArray(img.networks) ? img.networks : [];
      const on = nets.includes(net);
      img.networks = on ? nets.filter((n) => n !== net) : [...nets, net];
      refNet.setAttribute("aria-pressed", String(!on));
    }
    return;
  }
  // Reference image — remove a detected tag.
  const tagRm = event.target.closest("[data-recap-reftag-remove]");
  if (tagRm) {
    const img = data.referenceImages?.[Number(tagRm.dataset.recapRefimgIndex)];
    if (img) {
      ensureRefTagsColors(img);
      img.tags.splice(Number(tagRm.dataset.recapTagIndex), 1);
      repaint();
    }
    return;
  }
  // Reference image — remove / add a dominant colour.
  const colorRm = event.target.closest("[data-recap-refcolor-remove]");
  if (colorRm) {
    const img = data.referenceImages?.[Number(colorRm.dataset.recapRefimgIndex)];
    if (img) {
      ensureRefTagsColors(img);
      img.colors.splice(Number(colorRm.dataset.recapColorIndex), 1);
      repaint();
    }
    return;
  }
  const colorAdd = event.target.closest("[data-recap-refcolor-add]");
  if (colorAdd) {
    const img = data.referenceImages?.[Number(colorAdd.dataset.recapRefimgIndex)];
    if (img) {
      ensureRefTagsColors(img);
      img.colors.push("#3b4a6b");
      repaint();
    }
    return;
  }

  // Footer / header actions (mode-specific) — Save and start / Start chat / etc.
  cfg.onFooter?.(event);
}

// Text edits mutate the live data object WITHOUT a repaint so inputs keep
// focus mid-type.
function onInput(event) {
  // The add dialog lives in READ mode, so it answers before the edit guard.
  if (handleInfAddInput(event)) return;
  if (!editScope) return;
  // The audience in your own words (cfg.audienceList): written as you type,
  // and the radios follow without a repaint.
  if (event.target.matches?.("[data-recap-audience-text]")) {
    const d = cfg.getData();
    const t = event.target.value.trim();
    if (d && t) {
      d.audience = [t];
      audienceCustom = true;
      const list = event.target.closest(".recap__audience-list");
      list?.querySelectorAll("[data-recap-audience-pick]").forEach((row) => {
        const on = row.dataset.recapAudiencePick === "other";
        row.classList.toggle("is-selected", on);
        const radio = row.querySelector("input");
        if (radio) radio.checked = on;
      });
      list?.querySelector(".recap__audience-own")?.classList.add("is-selected");
    }
    return;
  }
  const data = cfg.getData();
  if (!data) return;
  const t = event.target;
  if (handleKitInput(event, data)) return;
  if (t.matches("[data-recap-summary]")) {
    data.businessSummary = t.value;
  } else if (t.matches("[data-recap-refnote]")) {
    const idx = Number(t.dataset.recapRefimgIndex);
    if (data.referenceImages?.[idx]) data.referenceImages[idx].note = t.value;
  } else if (t.matches("[data-recap-refcolor]")) {
    const img = data.referenceImages?.[Number(t.dataset.recapRefimgIndex)];
    if (img) {
      ensureRefTagsColors(img);
      img.colors[Number(t.dataset.recapColorIndex)] = t.value;
    }
  } else if (t.matches("[data-recap-text]")) {
    (t.dataset.recapText === "voiceSummary" ? voiceTarget(data) : data)[t.dataset.recapText] = t.value;
  } else if (t.matches("[data-recap-typo]")) {
    if (!data.brandTypography || typeof data.brandTypography !== "object") data.brandTypography = brandFonts(data);
    data.brandTypography[t.dataset.recapTypo] = t.value;
  } else if (t.matches("[data-vr-list]")) {
    const item = voiceTarget(data)[t.dataset.vrList]?.[Number(t.dataset.vrIndex)];
    if (item) item[t.dataset.vrKey] = t.value;
  } else if (t.matches("[data-recap-cta-field]")) {
    const idx = Number(t.dataset.recapCtaIndex);
    const field = t.dataset.recapCtaField;
    if (data.ctaLinks?.[idx]) data.ctaLinks[idx][field] = t.value;
  } else if (t.matches("[data-recap-color-field]")) {
    const idx = Number(t.dataset.recapColorIndex);
    const field = t.dataset.recapColorField;
    if (data.brandColors?.[idx]) data.brandColors[idx][field] = t.value;
    if (field === "hex") {
      const sw = mountTarget?.querySelector(`[data-recap-color-swatch="${idx}"]`);
      if (sw) sw.style.background = t.value;
    }
  } else if (t.matches("[data-recap-cmp-field]")) {
    const c = data[rosterOf(t).listKey]?.[Number(t.dataset.recapCmpIndex)];
    if (c) c[t.dataset.recapCmpField] = t.value;
  } else if (t.matches("[data-recap-inf-social]")) {
    // One fixed field per network: write that network's profile, creating it
    // on first keystroke. Empty ones are pruned on Save.
    const c = data[rosterOf(t).listKey]?.[Number(t.dataset.recapCmpIndex)];
    if (c) {
      if (!Array.isArray(c.socials)) c.socials = [];
      let s = c.socials.find((x) => x.network === t.dataset.recapInfSocial);
      if (!s) c.socials.push((s = { network: t.dataset.recapInfSocial, url: "" }));
      s.url = t.value;
    }
  } else if (t.matches("[data-recap-cmp-social-url]")) {
    const c = data[rosterOf(t).listKey]?.[Number(t.dataset.recapCmpIndex)];
    const s = c?.socials?.[Number(t.dataset.recapCmpSocialIndex)];
    if (s) s.url = t.value;
  }
}

let refImgCounter = 0;
let brandLogoCounter = 0;

function onChange(event) {
  if (!editScope) return;
  const data = cfg.getData();
  if (!data) return;
  if (handleKitChange(event, data, repaint)) return;
  // Brand-logo upload — appended to the set, read as data URLs so they persist
  // with the Playbook (an object URL is ephemeral and wouldn't survive the store).
  if (event.target.matches("[data-recap-logo-input]")) {
    const picked = Array.from(event.target.files || []).filter((f) => f.type.startsWith("image/"));
    event.target.value = ""; // so re-picking the same file fires again
    if (!picked.length) return;
    const list = brandLogoList(data).slice();
    const room = Math.max(0, MAX_BRAND_LOGOS - list.length);
    Promise.all(
      picked.slice(0, room).map(
        (f) =>
          new Promise((res) => {
            const reader = new FileReader();
            brandLogoCounter += 1;
            const id = `logo-up-${brandLogoCounter}`;
            // The filename, minus its extension, is the only label the user has
            // given us — better than a generic "Logo" they'd have to tell apart.
            const label = f.name.replace(/\.[^.]+$/, "") || "Logo";
            reader.onload = () => res({ id, label, url: reader.result });
            reader.onerror = () => res(null);
            reader.readAsDataURL(f);
          }),
      ),
    ).then((loaded) => {
      loaded.filter(Boolean).forEach((logo) => list.push(logo));
      data.brandLogos = list;
      // First mark in an empty Playbook becomes the default on its own — there's
      // nothing to choose between yet, and leaving it unset would show a gallery
      // with no default while the generator still had nothing to stamp.
      if (!data.brandLogo && list.length) data.brandLogo = list[0].url;
      repaint();
    });
    return;
  }
  // Reference-image upload — read each picked image as a data URL and append,
  // capped at MAX_REF_IMAGES. Part of the Brand section's Save flow.
  if (event.target.matches("[data-recap-refimg-input]")) {
    const picked = Array.from(event.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (!picked.length) return;
    if (!Array.isArray(data.referenceImages)) data.referenceImages = [];
    const room = Math.max(0, MAX_REF_IMAGES - data.referenceImages.length);
    Promise.all(
      picked.slice(0, room).map(
        (f) =>
          new Promise((res) => {
            const reader = new FileReader();
            refImgCounter += 1;
            const id = `ref-${refImgCounter}`;
            reader.onload = () => res({ id, label: f.name, url: reader.result, networks: [] });
            reader.onerror = () => res(null);
            reader.readAsDataURL(f);
          }),
      ),
    ).then((loaded) => {
      loaded.filter(Boolean).forEach((img) => data.referenceImages.push(img));
      repaint();
    });
    return;
  }
  if (event.target.matches("[data-recap-primary-language]")) {
    const val = event.target.value;
    const langs = contextLanguages(data);
    if (langs.includes(val)) {
      data.primaryLanguage = val;
      repaint(); // refresh the "primary" tag + header/rail
    }
    return;
  }
  // Roster social row — the network select. No repaint: the row's own
  // <select> already shows the new value, and repainting would steal focus.
  if (event.target.matches("[data-recap-cmp-social-network]")) {
    const c = data[rosterOf(event.target).listKey]?.[Number(event.target.dataset.recapCmpIndex)];
    const s = c?.socials?.[Number(event.target.dataset.recapCmpSocialIndex)];
    if (s) s.network = event.target.value;
    return;
  }
}

function onKeydown(event) {
  const tab = (event.key === "ArrowRight" || event.key === "ArrowLeft") && event.target.closest?.("[data-pb2-tab]");
  if (tab) {
    const tabs = [...tab.parentElement.querySelectorAll("[data-pb2-tab]")];
    const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    event.preventDefault();
    next.click();
    mountTarget?.querySelector(`#pb2-tab-${CSS.escape(next.dataset.pb2Tab)}`)?.focus();
    return;
  }
  // The voice format tabs (two of them): ←/→ pick the other one and keep focus on it.
  const mode =
    (event.key === "ArrowRight" || event.key === "ArrowLeft") && event.target.closest?.("[data-recap-voice-mode]");
  if (mode) {
    const other = mode.dataset.recapVoiceMode === "guided" ? "manual" : "guided";
    event.preventDefault();
    mode.parentElement.querySelector(`[data-recap-voice-mode="${other}"]`)?.click();
    mountTarget?.querySelector(`[data-recap-voice-mode="${other}"]`)?.focus();
    return;
  }
  if (!editScope) return;
  if (event.target.matches("[data-recap-audience-input]") && event.key === "Enter") {
    event.preventDefault();
    addAudienceCustom();
  } else if (event.target.matches("[data-recap-chip-input]") && event.key === "Enter") {
    event.preventDefault();
    addChip(event.target.dataset.recapChipInput);
  } else if (event.target.matches("[data-recap-reftag-input]") && event.key === "Enter") {
    event.preventDefault();
    const value = event.target.value.trim();
    if (!value) return;
    const data = cfg.getData();
    const img = data?.referenceImages?.[Number(event.target.dataset.recapRefimgIndex)];
    if (img) {
      ensureRefTagsColors(img);
      if (!img.tags.includes(value)) img.tags.push(value);
      repaint();
      // Re-focus the (fresh) tag input so the user can keep adding.
      refModalHost?.querySelector("[data-recap-reftag-input]")?.focus();
    }
  }
}
