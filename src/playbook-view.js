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

import { html, raw, escapeHtml as esc } from "./utils.js?v=2388";
import { conceptHint } from "./concepts.js?v=2388";
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
} from "./playbook-brand-kit.js?v=2388";
import { analyzeWebsite, discoverCompetitors, competitorKey } from "./context-mock-analysis.js?v=2388";
import { LANGUAGE_OPTIONS, emptyVoiceEntry } from "./languages.js?v=2388";
import { isFlagOn } from "./feature-flags.js?v=2388";
import { clipLookOf } from "./videos-store.js?v=2388";
import { dsSelect, SUBTITLE_IDS, presetLabel } from "./screens/clips/shared.js?v=2388";
import { parseHashParams } from "./url-state.js?v=2388";
import {
  isListPart,
  voiceParts,
  baseValue,
  cloneItems,
  voiceItemsHtml,
  networkVoiceOn,
  networkVoice,
  playbookNetworks,
  brandVoiceAsIs,
  cloneNetworkVoice,
  voiceNetTagHtml,
  markAdapted,
  withNetworkVoices,
  canLearnFrom,
  ADAPTED_FROM,
} from "./voice-parts.js?v=2388";
import { showToast } from "./components/toast.js?v=2388";
import { introSeen, voiceAskHtml, learnedVoiceHtml } from "./components/voice-intro-modal.js?v=2388";
import { voiceChoices, saveNetworkVoice } from "./network-voice-flow.js?v=2388";
import { updateContext } from "./contexts-store.js?v=2388";
import { openVoiceProposal, openVoiceInterview } from "./components/voice-proposal-modal.js?v=2388";
import { consumeHandoff } from "./handoff.js?v=2388";
import { open as openConfirmModal } from "./components/confirm-modal.js?v=2388";
import {
  NETWORKS,
  NETWORK_ICON_BY_PLATFORM,
  NETWORK_LABEL,
  networkLabel,
  networkIcon,
  getConnectedProfiles,
  normalizeNetwork,
  renderProfileTag,
} from "./social-profiles.js?v=2388";

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
let rosterModal = null; // open competitor/influencer detail modal: { kind, index } or null
let rosterScanning = null; // roster whose "Discover" scan is in flight ("competitors") or null — Influencers has no Discover
let rosterScanTimer = null; // the scan's pending timeout
let rosterFoundNone = null; // roster whose last scan returned nothing new (show the note) or null
let infAdd = null; // the "Add an influencer" dialog's draft ({ name, websiteUrl, socials }), or null
let refModalHost = null; // body-level portal node for the open detail modal
let snapshot = null; // deep copy of editable fields, for Cancel
let editBaseline = null; // the same fields as JSON once the editor has painted — "anything changed?"
let audienceCustom = false; // "Other…" picked in the Primary audience dropdown
let loadingTimer = null;
let loadingStage = 0;
let phase = "ready"; // "loading" | "ready"
let activeTab = "goals"; // Playbook 2.0: the tab on screen
let voiceNet = null; // Voice profile, flag voicePerNetwork: the network whose voice is on screen (null = the default network's, the Playbook's own parts)

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
  rosterModal = null;
  rosterScanning = null;
  rosterFoundNone = null;
  infAdd = null;

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
    target.removeEventListener("click", onClickH);
    target.removeEventListener("input", onInputH);
    target.removeEventListener("change", onChangeH);
    target.removeEventListener("keydown", onKeydownH);
    target.removeEventListener("error", onErrorH, true);
    if (refModalHost) {
      refModalHost.remove();
      refModalHost = null;
    }
    refModalIndex = null;
    rosterModal = null;
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

function prettyUrl(url) {
  return (url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
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

function panelPen(scope) {
  return `<button type="button" class="ap-icon-button transparent recap__panel-edit" data-recap-edit-card="${scope}" title="Edit section" aria-label="Edit section"><i class="ap-icon-pen"></i></button>`;
}

function panelEditActions() {
  return `<div class="recap__panel-actions">${editActionButtons()}</div>`;
}

function renderPanelHead(section, edit, extraAction = "") {
  return `
    <header class="recap__panel-head pb2-panel-head">
      <p class="pb2-panel-lead">${esc(SECTION_LEADS[section.scope] || "")}</p>
      ${edit ? panelEditActions() : `${extraAction}${canEditView() ? panelPen(section.scope) : ""}`}
    </header>
  `;
  return `
    <header class="recap__panel-head">
      <span class="recap__panel-icon"><i class="${section.icon}" aria-hidden="true"></i></span>
      <h2 class="recap__panel-title">${esc(section.title)}</h2>
      ${edit ? panelEditActions() : `${extraAction}${canEditView() ? panelPen(section.scope) : ""}`}
    </header>
  `;
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
  if (cfg?.chipCloud && CHIP_SUGGESTIONS[field]) return renderChipCloud(field, values, placeholder);
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
        <button type="button" class="recap__cta-remove" data-recap-cta-remove="${c._i}" aria-label="Remove link">
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
const REF_NETWORKS = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube"];

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
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const REF_TAG_POOLS = [
  [/ui|product|screen|app|dashboard/, ["Product UI", "Screens", "Tech"]],
  [/team|people|candid|portrait|face|hiring/, ["People", "Candid", "Human"]],
  [/brand|board|palette|logo|identity/, ["Brand", "Studio", "Graphic"]],
  [/office|desk|work|laptop/, ["Workplace", "Indoor", "Lifestyle"]],
  [/nature|outdoor|landscape|mountain|city|street|scene/, ["Outdoor", "Scene", "Editorial"]],
];
const REF_TAG_FALLBACK = ["Photographic", "Editorial", "Lifestyle", "Minimal", "Vibrant", "Muted", "Candid", "Studio"];

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const to = (n) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(0)}${to(8)}${to(4)}`;
}

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
  const edit = editScope === "brand"; // editable only while the Brand section is
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
  // Single-language mode (flag OFF) — a plain picker fixed to the primary
  // language, matching the pre-multilingual behaviour.
  if (!multilingualOn()) {
    // The review (cfg.chipCloud): one language can't be changed here — say it
    // as the fact it is, not as a dropdown with a single option.
    if (cfg?.chipCloud) return `<span class="ap-tag grey"><span>${esc(primary)}</span></span>`;
    return `<select class="ap-native-select recap__lang-select" data-recap-primary-language aria-label="Language">
      <option value="${esc(primary)}" selected>${esc(primary)}</option>
    </select>`;
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

// Guided ⇄ Free-form switch for the Voice profile section (edit mode).
function renderVoiceModeToggle(mode) {
  const manual = mode === "manual";
  return `
    <div class="recap__voice-mode" role="group" aria-label="Voice format">
      <button type="button" class="ap-filter-chip" aria-pressed="${!manual}" data-recap-voice-mode="guided">Part by part</button>
      <button type="button" class="ap-filter-chip" aria-pressed="${manual}" data-recap-voice-mode="manual">In my own words</button>
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
            ${
              net
                ? `<button type="button" class="ap-action-dropdown-item" data-recap-learn="interview"${netAttr} role="menuitem">
              <i class="ap-icon-double-chat-bubbles"></i>
              <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">A few questions…</span></div></div>
            </button>`
                : ""
            }
          </div>
        </details>`
    : "";
}

// « Add a voice for… » (flag voicePerNetwork, a saved Playbook, cfg.onAddNetworkVoice):
// every network, the Playbook's first; picking one opens the voice review on
// it (welcome-alt-recap.js renderPlaybookVoice, 2026-10-29).
function addVoiceMenu(data) {
  if (!isLibrary() || !canEditView() || !networkVoiceOn() || !cfg.onAddNetworkVoice) return "";
  const mine = playbookNetworks(data);
  const nets = [...mine, ...Object.keys(NETWORKS).filter((n) => !mine.includes(n))];
  return `<details class="recap__panel-menu" data-recap-learn-menu>
      <summary class="ap-button primary orange recap__panel-action recap__panel-menu-toggle">
        <i class="ap-icon-plus" aria-hidden="true"></i>
        <span>Add a voice for…</span>
        <i class="ap-icon-chevron-down recap__menu-caret" aria-hidden="true"></i>
      </summary>
      <div class="ap-action-dropdown recap__panel-menu-pop" role="menu" aria-label="Add a voice for a network">
        ${nets
          .map(
            (
              n,
            ) => `<button type="button" class="ap-action-dropdown-item" data-pb2-add-voice="${esc(n)}" role="menuitem">
          <i class="${networkIcon(n)}"></i>
          <div class="ap-action-dropdown-item-text"><div class="ap-action-dropdown-item-label-container"><span class="ap-action-dropdown-item-label">${esc(networkLabel(n))}</span></div></div>
        </button>`,
          )
          .join("")}
      </div>
    </details>`;
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

// ── Competitors + Influencers (the two rosters) ────────────────────────
//
// Two lists of people and brands OUTSIDE this one, with the same life cycle:
// Archie pre-fills each from the website analysis (every entry flagged
// `suggested`) and can scan for more on demand; the user prunes it and adds
// the ones Archie missed. Competitors are who the brand is measured against,
// influencers the creators its audience already listens to.
//
// Competitors render through the card grid below; Influencers through the
// beta's list shape (renderInfluencersPanel, after this block). They share the
// data helpers and the name / website / remove / social hooks, which keep
// their `cmp` prefix; which roster a hook acts on is read from the nearest
// [data-recap-roster].
//
// An entry's logo is never stored — it's resolved from its domain through a
// favicon service at render time, with a monogram tile as the fallback (wired
// by the capturing `error` listener in mount()).

const ROSTER_SCAN_MS = 1600;

const ROSTERS = {
  competitors: {
    scope: "competitors",
    listKey: "competitors",
    dismissedKey: "dismissedCompetitors",
    max: 12,
    idPrefix: "cmp",
    networks: REF_NETWORKS,
    discover: discoverCompetitors,
    key: competitorKey,
    noun: "competitor",
    title: "Competitor",
    untitled: "Untitled competitor",
    namePlaceholder: "Competitor name",
    sitePlaceholder: "https://competitor.com",
    descPlaceholder: "How they position, who they win with, where you differ…",
    ownGroup: "Your competitors",
    pendingEmpty: "None added yet. Pick from my suggestions below.",
    emptyEdit: "No competitors yet. Add the ones you know and I'll find the rest.",
    emptyRead: "No competitors yet. Select Discover competitors and I'll suggest a few.",
    scanning: "Scanning your market for competitors…",
    noneFound: "No new competitors found. Add one by hand instead.",
    discoverFirst: "Discover competitors",
  },
  // Influencers keep only what the beta's list shape reads (renderInfluencersPanel):
  // no suggestions, so no discover / key / tray copy.
  influencers: {
    scope: "influencers",
    listKey: "influencers",
    max: 12,
    idPrefix: "inf",
    // No TikTok: an influencer profile is only worth adding on a network the
    // listening follows creators on.
    networks: REF_NETWORKS.filter((n) => n !== "tiktok"),
    noun: "influencer",
    untitled: "Untitled influencer",
    namePlaceholder: "Influencer name",
    sitePlaceholder: "https://…",
  },
};

// The roster a delegated hook belongs to. Every panel and modal root carries
// data-recap-roster, so a hook with no roster around it is a bug — falling
// back to competitors keeps it from writing into a list nobody asked for.
function rosterOf(el) {
  return ROSTERS[el?.closest?.("[data-recap-roster]")?.dataset.recapRoster] || ROSTERS.competitors;
}

function rosterDomain(c) {
  const raw = (c?.websiteUrl || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function rosterLogoUrl(c) {
  if (c?.logo) return c.logo;
  const domain = rosterDomain(c);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
}

// Deterministic monogram tint so an entry keeps the same colour across
// repaints. Reuses the reference-image hash + HSL helpers rather than adding
// a second bit of colour maths to this file.
function rosterAccent(c) {
  const key = (c?.name || rosterDomain(c) || "roster").toLowerCase();
  const h = hashStr(key);
  return hslToHex(h % 360, 44 + ((h >> 5) % 26), 42);
}

// Monogram letter. A leading article is skipped so names like "The category
// incumbent" / "The low-cost challenger" don't all read as the same "T".
function rosterInitial(c) {
  const source = (c?.name || rosterDomain(c) || "").trim().replace(/^(the|a|an)\s+/i, "");
  return (source.charAt(0) || "?").toUpperCase();
}

function rosterList(data, r) {
  if (!Array.isArray(data[r.listKey])) data[r.listKey] = [];
  return data[r.listKey];
}

function dismissedList(data, r) {
  if (!Array.isArray(data[r.dismissedKey])) data[r.dismissedKey] = [];
  return data[r.dismissedKey];
}

// `suggested: true` is a PENDING proposal from Archie — it is NOT part of the
// Playbook until the user accepts it. Anything that counts a Playbook's
// entries (the section's own grid, the /contexts card counters) must skip
// them; only the "Suggested by Archie" tray reads them.
function pendingEntries(data, r) {
  return rosterList(data, r).filter((c) => c.suggested);
}

// Logo tile — the remote favicon plus a monogram twin that onLoadError reveals
// when the favicon can't load (domain with no icon, blocked request, offline).
// An entry with no website has nothing to resolve, so it renders monogram-only.
function renderRosterLogo(c, size = 36) {
  const px = Number(size) || 36;
  const url = rosterLogoUrl(c);
  const mono = `<span class="recap__cmp-logo recap__cmp-logo--mono${url ? " is-hidden" : ""}" style="--cmp-accent:${esc(
    rosterAccent(c),
  )};--cmp-logo-size:${px}px;" aria-hidden="true">${esc(rosterInitial(c))}</span>`;
  if (!url) return mono;
  return `<img class="recap__cmp-logo" src="${esc(
    url,
  )}" alt="" width="${px}" height="${px}" loading="lazy" style="--cmp-logo-size:${px}px;" data-recap-cmp-logo />${mono}`;
}

// Read-only network badges for an entry's social profiles. Rendered as plain
// icons on the card (which is itself a button — no nested links) and as real
// links in the modal.
function rosterSocials(c) {
  return (Array.isArray(c?.socials) ? c.socials : []).filter((s) => s && NETWORK_ICON_BY_PLATFORM[s.network]);
}

function renderRosterNetIcons(c) {
  const socials = rosterSocials(c);
  if (!socials.length) return "";
  return `<span class="recap__cmp-nets">${socials
    .map((s) => {
      const label = esc(NETWORK_LABEL[s.network] || s.network);
      return `<i class="${NETWORK_ICON_BY_PLATFORM[s.network]}" title="${label}" aria-label="${label}"></i>`;
    })
    .join("")}</span>`;
}

function renderRosterNetLinks(c) {
  const socials = rosterSocials(c);
  if (!socials.length) return `<span class="recap__cmpmodal-empty">No social profiles yet.</span>`;
  return `<span class="recap__cmp-netlinks">${socials
    .map((s) => {
      const label = esc(NETWORK_LABEL[s.network] || s.network);
      return `<a class="recap__cmp-netlink" href="${esc(
        s.url,
      )}" target="_blank" rel="noopener noreferrer" title="${label}"><i class="${
        NETWORK_ICON_BY_PLATFORM[s.network]
      }" aria-hidden="true"></i><span>${label}</span></a>`;
    })
    .join("")}</span>`;
}

// One card. `i` is the index into the FULL list (both states share it) so the
// handlers stay index-addressed.
//
// A pending card reads as a proposal, not as a Playbook entry: dashed border,
// recessed surface, and its own Add / Dismiss row. Those two buttons must be
// SIBLINGS of the open-button (the card body is itself a <button>, so nesting
// them would be invalid HTML), hence the flex-column card container.
function renderRosterCard(r, c, i, { edit = false, pending = false } = {}) {
  const domain = rosterDomain(c);
  const desc = (c.description || "").trim();
  const name = esc(c.name || r.noun);
  const nets = renderRosterNetIcons(c);
  return `
    <div class="recap__cmpcard${pending ? " recap__cmpcard--suggested" : ""}">
      <button type="button" class="recap__cmpcard-open" data-recap-cmp-open="${i}" aria-label="${
        edit && !pending ? "Edit" : "View"
      } ${name} details">
        <span class="recap__cmpcard-head">
          ${renderRosterLogo(c, 36)}
          <span class="recap__cmpcard-id">
            <span class="recap__cmpcard-name">${esc(c.name || r.untitled)}</span>
            ${domain ? `<span class="recap__cmpcard-domain">${esc(domain)}</span>` : ""}
          </span>
        </span>
        <span class="recap__cmpcard-desc${desc ? "" : " recap__cmpcard-desc--empty"}">${
          desc ? esc(desc) : "No description yet"
        }</span>
        ${nets ? `<span class="recap__cmpcard-foot">${nets}</span>` : ""}
      </button>
      ${
        pending && canEditView()
          ? `<div class="recap__cmpcard-actions">
               <button type="button" class="ap-button secondary blue recap__cmpcard-act" data-recap-cmp-accept="${i}">
                 <i class="ap-icon-plus" aria-hidden="true"></i><span>Add</span>
               </button>
               <button type="button" class="ap-button ghost grey recap__cmpcard-act" data-recap-cmp-dismiss="${i}">
                 <span>Dismiss</span>
               </button>
             </div>`
          : edit
            ? `<button type="button" class="recap__refimg-remove recap__cmpcard-remove" data-recap-cmp-remove="${i}" aria-label="Remove ${name}"><i class="ap-icon-close"></i></button>`
            : ""
      }
    </div>`;
}

// Scan-in-flight state, scoped to this panel — the whole-Playbook staged loader
// would be far too heavy for a single-section action.
function renderRosterScan(r) {
  const skeletons = [0, 1, 2]
    .map(
      () => `
      <div class="recap__cmpcard recap__cmpcard--skeleton" aria-hidden="true">
        <span class="recap__cmpskel recap__cmpskel--logo"></span>
        <span class="recap__cmpskel recap__cmpskel--line"></span>
        <span class="recap__cmpskel recap__cmpskel--line is-short"></span>
      </div>`,
    )
    .join("");
  return `
    <p class="recap__cmp-scanning" role="status">
      <span class="archie-loader" aria-hidden="true"></span>
      <span>${esc(r.scanning)}</span>
    </p>
    <div class="recap__cmpgrid">${skeletons}</div>`;
}

// `rosterPicker` (the onboarding review): the roster as ONE list to pick from,
// the way every other choice in the review is made — each entry a tile (logo,
// name, its description in full), ticked = in the Playbook, in a stable order.
// Unticking sends an entry
// back to the suggestions (nothing is lost); "Add someone else" is the manual
// add. Same hooks as the tray (accept / accept-all / add), plus unaccept.
const PICKER_COPY = {
  competitors: {
    title: "Who you're up against",
    hint: "I found these in your market. Tick the ones you're measured against.",
    empty: "I didn't find anyone yet. Add the competitors you know.",
    add: "Add another competitor",
  },
  influencers: {
    title: "Who your audience follows",
    hint: "The creators your audience listens to. I turn what they post into Topics.",
    empty: "No one yet. Add the creators your audience already follows.",
    add: "Add an influencer",
  },
};

function renderRosterPicker(data, r, { addHook = "data-recap-cmp-add" } = {}) {
  const copy = PICKER_COPY[r.scope] || PICKER_COPY.competitors;
  const list = rosterList(data, r);
  const indexed = list.map((c, i) => ({ c, i }));
  // A stable order: a tile ticked stays where it is (moving it under the cursor
  // would lose the reader).
  const ordered = indexed;
  const pending = indexed.filter(({ c }) => c.suggested).length;
  const tile = ({ c, i }) => {
    const on = !c.suggested;
    const desc = (c.description || "").trim();
    const domain = rosterDomain(c);
    // A label around the real DS checkbox: one click toggles, keyboard-reachable.
    return `
      <label class="recap__pick${on ? " is-picked" : ""}" data-recap-cmp-${on ? "unaccept" : "accept"}="${i}">
        ${renderRosterLogo(c, 40)}
        <span class="recap__pick-text">
          <span class="recap__pick-name">${esc(c.name || r.untitled)}${
            domain ? `<span class="recap__pick-domain">${esc(domain)}</span>` : ""
          }</span>
          ${desc ? `<span class="recap__pick-desc">${esc(desc)}</span>` : ""}
        </span>
        <span class="ap-checkbox-container"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(
          c.name || r.untitled,
        )} in my Playbook" /><i></i></span>
      </label>`;
  };
  return `
    <div class="recap__picker" data-recap-roster="${r.scope}">
      <header class="pb2-block__head"><h3 class="pb2-block__title">${esc(copy.title)}</h3></header>
      <p class="pb2-block__hint">${esc(list.length ? copy.hint : copy.empty)}</p>
      ${ordered.length ? `<div class="recap__pick-list">${ordered.map(tile).join("")}</div>` : ""}
      <div class="recap__pick-foot">
        ${
          list.length < r.max
            ? `<button type="button" class="ap-button ghost blue" ${addHook}><i class="ap-icon-plus"></i><span>${esc(copy.add)}</span></button>`
            : ""
        }
        ${
          pending > 1
            ? `<button type="button" class="ap-button ghost grey" data-recap-cmp-accept-all><i class="ap-icon-check"></i><span>Select all</span></button>`
            : ""
        }
      </div>
    </div>`;
}

function renderRosterPanel(data, r, edit) {
  const section = SECTIONS.find((s) => s.scope === r.scope);
  const list = rosterList(data, r);
  // Index into the full array, so accept/dismiss/remove stay index-addressed
  // while the two states render in separate groups.
  const indexed = list.map((c, i) => ({ c, i }));
  const active = indexed.filter(({ c }) => !c.suggested);
  const pending = indexed.filter(({ c }) => c.suggested);

  const gridOf = (entries, opts) =>
    `<div class="recap__cmpgrid">${entries.map(({ c, i }) => renderRosterCard(r, c, i, opts)).join("")}</div>`;

  // Archie's proposals live in their own tray below the Playbook's own
  // entries — a pending suggestion is not part of this brand yet.
  const pendingGroup = pending.length
    ? `<section class="recap__cmpgroup recap__cmpgroup--suggested">
         <header class="recap__cmpgroup-head">
           <span class="recap__cmpgroup-title">
             <i class="ap-icon-sparkles" aria-hidden="true"></i>
             <span>My suggestions</span>
             <span class="ap-tag grey mini recap__cmpgroup-count">${pending.length}</span>
           </span>
           ${
             pending.length > 1 && canEditView()
               ? `<button type="button" class="ap-button ghost grey recap__cmpgroup-act" data-recap-cmp-accept-all>
                    <i class="ap-icon-check" aria-hidden="true"></i><span>Add all</span>
                  </button>`
               : ""
           }
         </header>
         <p class="recap__cmpgroup-sub">Not in your Playbook yet. Add the ones that matter.</p>
         ${gridOf(pending, { edit, pending: true })}
       </section>`
    : "";

  // The panel body is a flex column of padded .recap__row blocks; this section
  // has no label→value rows, so its content gets its own padded wrapper.
  let hint = "";
  let inner;
  if (rosterScanning === r.scope) {
    inner = renderRosterScan(r);
  } else if (cfg?.rosterPicker && edit) {
    inner = renderRosterPicker(data, r);
  } else {
    const activeEmpty = `<p class="recap__cmp-empty">${esc(
      pending.length ? r.pendingEmpty : edit ? r.emptyEdit : r.emptyRead,
    )}</p>`;
    const activeGroup = active.length ? gridOf(active, { edit, pending: false }) : activeEmpty;
    // Only label the active group when a suggestions tray sits under it —
    // a lone grid needs no heading.
    const activeBlock = pending.length
      ? `<section class="recap__cmpgroup">
           <header class="recap__cmpgroup-head">
             <span class="recap__cmpgroup-title"><span>${esc(r.ownGroup)}</span>
               <span class="ap-tag grey mini recap__cmpgroup-count">${active.length}</span>
             </span>
           </header>
           ${activeGroup}
         </section>`
      : activeGroup;

    if (edit) hint = renderSectionHint(SECTION_HINTS[r.scope]);
    inner = [
      activeBlock,
      edit && list.length < r.max
        ? `<button type="button" class="ap-button secondary blue recap__add-row" data-recap-cmp-add>
             <i class="ap-icon-plus"></i><span>Add ${esc(r.noun)}</span>
           </button>`
        : "",
      pendingGroup,
      !edit && rosterFoundNone === r.scope
        ? `<p class="recap__cmp-note"><i class="ap-icon-info" aria-hidden="true"></i><span>${esc(r.noneFound)}</span></p>`
        : "",
    ].join("");
  }
  const body = `${hint}<div class="recap__cmpsec">${inner}</div>`;

  // One scan at a time across both rosters: the timer and the result slot are
  // shared, and two skeleton panels at once would read as the page reloading.
  const discoverBtn =
    !edit && !rosterScanning && canEditView()
      ? `<button type="button" class="ap-button ghost grey recap__panel-action" data-recap-cmp-discover title="Scan your market for competitors to suggest">
           <i class="ap-icon-sparkles" aria-hidden="true"></i>
           <span>${esc(list.length ? "Discover more" : r.discoverFirst)}</span>
         </button>`
      : "";

  // Playbook 2.0, reading: the tab's own head (lead + Discover + Edit), like the
  // other tabs, and the cards in a block below — no panel head repeating it.
  if (!edit)
    return `${pb2TabHead("competitors", discoverBtn)}
      <section class="pb2-block pb2-block--bare" id="${section.id}">${body}</section>`;
  return `
    <section class="recap__panel ${edit ? "is-editing" : ""}" id="${section.id}" data-recap-roster="${r.scope}" ${
      edit ? "data-recap-editing-card" : ""
    }>
      ${renderPanelHead(section, edit, discoverBtn)}
      <div class="recap__panel-body">${body}</div>
    </section>
  `;
}

// Per-entry detail modal — the card stays a summary, everything editable
// (name, website, description, social profiles) lives here. Editable while its
// section is in edit scope, read-only otherwise; same rule as the
// reference-image modal.
function renderRosterModal(data) {
  if (!rosterModal) return "";
  const r = ROSTERS[rosterModal.kind];
  const list = rosterList(data, r);
  const c = list[rosterModal.index];
  if (!c) return "";
  const i = rosterModal.index;
  const edit = editScope === r.scope;
  const domain = rosterDomain(c);

  const nameBlock = edit
    ? `<div class="ap-input-group">
         <input type="text" data-recap-cmp-field="name" data-recap-cmp-index="${i}" value="${esc(
           c.name || "",
         )}" placeholder="${esc(r.namePlaceholder)}" aria-label="${esc(r.namePlaceholder)}" />
       </div>`
    : `<p class="recap__cmpmodal-value">${esc(c.name || r.untitled)}</p>`;

  const siteBlock = edit
    ? `<div class="ap-input-group">
         <input type="text" data-recap-cmp-field="websiteUrl" data-recap-cmp-index="${i}" value="${esc(
           c.websiteUrl || "",
         )}" placeholder="${esc(r.sitePlaceholder)}" aria-label="Website" spellcheck="false" />
       </div>`
    : domain
      ? `<a class="recap__cmpmodal-link" href="${esc(
          c.websiteUrl,
        )}" target="_blank" rel="noopener noreferrer"><i class="ap-icon-link" aria-hidden="true"></i><span>${esc(
          domain,
        )}</span><i class="ap-icon-external-link" aria-hidden="true"></i></a>`
      : `<span class="recap__cmpmodal-empty">No website yet.</span>`;

  const descBlock = edit
    ? `<div class="ap-textarea-field resizable">
         <textarea data-recap-cmp-field="description" data-recap-cmp-index="${i}" rows="4" placeholder="${esc(
           r.descPlaceholder,
         )}" aria-label="Description">${esc(c.description || "")}</textarea>
       </div>`
    : (c.description || "").trim()
      ? `<p class="recap__cmpmodal-note">${esc(c.description)}</p>`
      : `<p class="recap__cmpmodal-empty">No description yet.</p>`;

  const socials = Array.isArray(c.socials) ? c.socials : [];
  const socialsBlock = edit
    ? `<div class="recap__cmp-socialedit">
         ${socials
           .map((s, si) => {
             // A profile saved on a network the roster no longer offers keeps its
             // own option, so the select never shows a value it didn't store.
             const nets = r.networks.includes(s.network) ? r.networks : [...r.networks, s.network];
             const options = nets
               .map(
                 (n) =>
                   `<option value="${n}"${s.network === n ? " selected" : ""}>${esc(NETWORK_LABEL[n] || n)}</option>`,
               )
               .join("");
             return `
             <div class="recap__cmp-socialrow">
               <select class="ap-native-select recap__cmp-socialnet" data-recap-cmp-social-network data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" aria-label="Network">
                 ${options}
               </select>
               <div class="ap-input-group recap__cmp-socialurl">
                 <input type="text" data-recap-cmp-social-url data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" value="${esc(
                   s.url || "",
                 )}" placeholder="https://…" aria-label="Profile URL" spellcheck="false" />
               </div>
               <button type="button" class="recap__cta-remove" data-recap-cmp-social-remove data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" aria-label="Remove profile">
                 <i class="ap-icon-close"></i>
               </button>
             </div>`;
           })
           .join("")}
         <button type="button" class="ap-button secondary blue recap__add-row" data-recap-cmp-social-add="${i}">
           <i class="ap-icon-plus"></i><span>Add profile</span>
         </button>
       </div>`
    : renderRosterNetLinks(c);

  const removeBtn = edit
    ? `<button type="button" class="ap-button transparent grey" data-recap-cmp-remove="${i}"><i class="ap-icon-trash"></i><span>Remove ${esc(
        r.noun,
      )}</span></button>`
    : "";

  return `
  <div class="app-modal-backdrop recap__cmpmodal-backdrop" data-recap-cmpmodal-backdrop data-recap-roster="${r.scope}">
    <aside class="ap-dialog recap__cmpmodal" role="dialog" aria-modal="true" aria-label="${esc(r.title)}">
      <div class="ap-dialog-header"><span class="ap-dialog-title">${esc(r.title)}</span></div>
      <button type="button" class="ap-dialog-close" data-recap-cmp-close aria-label="Close"><i class="ap-icon-close"></i></button>
      <div class="ap-dialog-content recap__cmpmodal-content">
        <div class="recap__cmpmodal-id">
          ${renderRosterLogo(c, 48)}
          ${
            c.suggested
              ? `<span class="ap-tag grey mini recap__cmp-badge"><i class="ap-icon-sparkles" aria-hidden="true"></i><span>Suggested, not added yet</span></span>`
              : ""
          }
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Name</span>
          ${nameBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Website</span>
          ${siteBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Description</span>
          ${descBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Social profiles</span>
          ${socialsBlock}
        </div>
      </div>
      <div class="ap-dialog-footer">
        <div class="ap-dialog-footer-left">${c.suggested ? "" : removeBtn}</div>
        <div class="ap-dialog-footer-right">
          ${
            c.suggested && canEditView()
              ? `<button type="button" class="ap-button ghost grey" data-recap-cmp-dismiss="${i}"><span>Dismiss</span></button>
                 <button type="button" class="ap-button primary orange" data-recap-cmp-accept="${i}">
                   <i class="ap-icon-plus" aria-hidden="true"></i><span>Add to Playbook</span>
                 </button>`
              : `<button type="button" class="ap-button primary orange" data-recap-cmp-close><span>Done</span></button>`
          }
        </div>
      </div>
    </aside>
  </div>`;
}

// ── Influencers (the beta's list shape) ────────────────────────────────
//
// Copied from the Competitors section as it ships on app.beta.agorapulse.com,
// not from this prototype's Competitors: a plain LIST, no suggestion tray, no
// Discover, no detail dialog.
//   • read — one full-width row per influencer: name, a line of real links
//     (website, then each profile with its network's icon and name), the
//     description. The header carries "Add an influencer" beside the pencil.
//   • add  — a dialog: name, website, then ONE fixed field per network.
//     Works from read mode and commits on the spot, like the beta.
//   • edit — the pencil turns every row into its own inline form (name,
//     website, the fixed network fields) with a trash button; the description
//     isn't editable and hides, exactly as it does there.
// Nothing lands at creation: every Playbook starts on the empty state.

function influencerSocialUrl(c, network) {
  return (Array.isArray(c?.socials) ? c.socials : []).find((s) => s?.network === network)?.url || "";
}

function renderInfluencerLinks(c, r) {
  const domain = rosterDomain(c);
  const links = [];
  if (domain) {
    links.push(
      `<a class="ap-link standalone small recap__inf-link" href="${esc(
        c.websiteUrl.startsWith("http") ? c.websiteUrl : `https://${c.websiteUrl}`,
      )}" target="_blank" rel="noopener noreferrer"><i class="ap-icon-web" aria-hidden="true"></i><span>${esc(
        domain,
      )}</span></a>`,
    );
  }
  rosterSocials(c)
    .filter((s) => (s.url || "").trim() && r.networks.includes(s.network))
    .forEach((s) => {
      links.push(
        `<a class="ap-link standalone small recap__inf-link" href="${esc(
          s.url,
        )}" target="_blank" rel="noopener noreferrer"><i class="${
          NETWORK_ICON_BY_PLATFORM[s.network]
        }" aria-hidden="true"></i><span>${esc(NETWORK_LABEL[s.network] || s.network)}</span></a>`,
      );
    });
  return links.length ? `<span class="recap__inf-links">${links.join("")}</span>` : "";
}

// One fixed URL field per network, icon outside the input — the same row in
// the add dialog and in the inline editor. `attrs` says which of the two.
function renderInfluencerSocialFields(r, valueOf, attrs) {
  return r.networks
    .map((n) => {
      const label = NETWORK_LABEL[n] || n;
      return `
      <div class="recap__inf-field">
        <i class="${NETWORK_ICON_BY_PLATFORM[n]}" aria-hidden="true"></i>
        <div class="ap-input-group">
          <input type="url" ${attrs(n)} value="${esc(valueOf(n))}" placeholder="${esc(
            label,
          )} URL" aria-label="${esc(label)} URL" spellcheck="false" />
        </div>
      </div>`;
    })
    .join("");
}

function renderInfluencerEditRow(r, c, i) {
  return `
    <div class="recap__inf-edit">
      <div class="recap__inf-edit-head">
        <span class="recap__inf-name">${esc(c.name || r.untitled)}</span>
        <button type="button" class="ap-icon-button stroked transparent" data-recap-cmp-remove="${i}" aria-label="Remove this ${esc(
          r.noun,
        )}" title="Remove this ${esc(r.noun)}"><i class="ap-icon-trash"></i></button>
      </div>
      <div class="ap-input-group">
        <input type="text" data-recap-cmp-field="name" data-recap-cmp-index="${i}" value="${esc(
          c.name || "",
        )}" placeholder="${esc(r.namePlaceholder)}" aria-label="${esc(r.namePlaceholder)}" />
      </div>
      <div class="recap__inf-field">
        <i class="ap-icon-web" aria-hidden="true"></i>
        <div class="ap-input-group">
          <input type="url" data-recap-cmp-field="websiteUrl" data-recap-cmp-index="${i}" value="${esc(
            c.websiteUrl || "",
          )}" placeholder="${esc(r.sitePlaceholder)}" aria-label="Website" spellcheck="false" />
        </div>
      </div>
      <span class="recap__inf-label">Social profiles</span>
      ${renderInfluencerSocialFields(
        r,
        (n) => influencerSocialUrl(c, n),
        (n) => `data-recap-inf-social="${n}" data-recap-cmp-index="${i}"`,
      )}
    </div>`;
}

// A creator has no logo to show: two initials give each row a face, the way
// the Competitors cards have theirs.
function initialsOf(name) {
  return name
    .replace(/'s\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function renderInfluencersPanel(data, edit) {
  const r = ROSTERS.influencers;
  const section = SECTIONS.find((s) => s.scope === r.scope);
  const list = rosterList(data, r);

  // The review (cfg.rosterPicker): the same picker as Competitors; an influencer
  // is added through its own dialog (data-recap-infadd-open), as on the page.
  if (cfg?.rosterPicker) {
    return `
      <section class="recap__panel" id="${section.id}" data-recap-roster="${r.scope}" data-recap-editing-card>
        <div class="recap__panel-body">${renderRosterPicker(data, r, { addHook: "data-recap-infadd-open" })}</div>
      </section>`;
  }

  let rows;
  if (!list.length) {
    rows = renderInfluencersEmpty(edit);
  } else if (edit) {
    rows = list.map((c, i) => renderInfluencerEditRow(r, c, i)).join("");
  } else {
    rows = `<ul class="recap__inf-list">${list
      .map((c) => {
        const desc = (c.description || "").trim();
        return `
        <li class="recap__inf-row">
          <span class="ap-avatar size-40" aria-hidden="true"><span class="ap-avatar-initials">${esc(initialsOf(c.name || r.untitled))}</span></span>
          <div class="recap__inf-main">
            <div class="recap__inf-head">
              <span class="recap__inf-name">${esc(c.name || r.untitled)}</span>
              ${renderInfluencerLinks(c, r)}
            </div>
            ${desc ? `<p class="recap__inf-desc">${esc(desc)}</p>` : ""}
          </div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  // The beta hides Add while the section is being edited — Save/Cancel own
  // the header then.
  const addBtn =
    !edit && canEditView() && list.length && list.length < r.max
      ? `<button type="button" class="ap-button ghost grey recap__panel-action" data-recap-infadd-open>
           <i class="ap-icon-plus" aria-hidden="true"></i><span>Add an influencer</span>
         </button>`
      : "";

  return `
    <section class="recap__panel ${edit ? "is-editing" : ""}" id="${section.id}" data-recap-roster="${r.scope}" ${
      edit ? "data-recap-editing-card" : ""
    }>
      ${renderPanelHead(section, edit, addBtn)}
      <div class="recap__panel-body">
        <div class="recap__infsec">
          ${rows}
        </div>
      </div>
    </section>
  `;
}

// Empty is the state every Playbook starts in: Archie cannot suggest creators
// (Google's grounding terms forbid keeping what a grounded search finds), so
// the section has to sell the one thing it unlocks — Topics from what creators
// post — and hand over the way in. Its CTA is the only Add while it is empty;
// the header's comes back with the first entry.
function renderInfluencersEmpty(edit) {
  const cta =
    !edit && canEditView()
      ? `<button type="button" class="ap-button primary blue" data-recap-infadd-open>
           <i class="ap-icon-plus" aria-hidden="true"></i><span>Add your first influencer</span>
         </button>`
      : "";
  return `
    <div class="recap__inf-empty">
      <span class="topic-badge topic-badge--lg topic-badge--red" aria-hidden="true"><i class="ap-icon-star"></i></span>
      <div class="recap__inf-empty-text">
        <h3 class="recap__inf-empty-title">Turn what creators post into Topics</h3>
        <p class="recap__inf-empty-body">Add the creators your audience already follows. I read their new posts and bring the ones worth reacting to into your Topic Feed.</p>
      </div>
      ${cta}
    </div>`;
}

function emptyInfluencerDraft() {
  return { name: "", websiteUrl: "", socials: {} };
}

// The add dialog. Rendered with the recap body and portalled to <body> like
// the other detail modals (portalModal matches .recap__cmpmodal-backdrop).
function renderInfluencerAddModal() {
  if (!infAdd) return "";
  const r = ROSTERS.influencers;
  const ready = infAdd.name.trim().length > 0;
  return `
  <div class="app-modal-backdrop recap__cmpmodal-backdrop" data-recap-infadd-backdrop data-recap-roster="${r.scope}">
    <aside class="ap-dialog recap__cmpmodal" role="dialog" aria-modal="true" aria-label="Add an influencer">
      <div class="ap-dialog-header"><span class="ap-dialog-title">Add an influencer</span></div>
      <button type="button" class="ap-dialog-close" data-recap-infadd-close aria-label="Close"><i class="ap-icon-close"></i></button>
      <div class="ap-dialog-content recap__cmpmodal-content recap__infadd">
        <p class="recap__inf-intro">Enter the influencer's name, website, and social profiles. Only the name is required.</p>
        <div class="ap-input-group">
          <input type="text" data-recap-infadd-field="name" value="${esc(infAdd.name)}" placeholder="${esc(
            r.namePlaceholder,
          )}" aria-label="${esc(r.namePlaceholder)}" />
        </div>
        <div class="recap__inf-field">
          <i class="ap-icon-web" aria-hidden="true"></i>
          <div class="ap-input-group">
            <input type="url" data-recap-infadd-field="websiteUrl" value="${esc(infAdd.websiteUrl)}" placeholder="${esc(
              r.sitePlaceholder,
            )}" aria-label="Website" spellcheck="false" />
          </div>
        </div>
        <span class="recap__inf-label">Social profiles</span>
        ${renderInfluencerSocialFields(
          r,
          (n) => infAdd.socials[n] || "",
          (n) => `data-recap-infadd-social="${n}"`,
        )}
      </div>
      <div class="ap-dialog-footer">
        <div class="ap-dialog-footer-right">
          <button type="button" class="ap-button ghost grey" data-recap-infadd-close><span>Cancel</span></button>
          <button type="button" class="ap-button primary blue" data-recap-infadd-submit${ready ? "" : " disabled"}>
            <i class="ap-icon-plus" aria-hidden="true"></i><span>Add an influencer</span>
          </button>
        </div>
      </div>
    </aside>
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
  // Flag voicePerNetwork: the model in one line — the creation review's cover
  // is the only place a new user meets it (the intro is for returning users).
  voice: networkVoiceOn()
    ? "One default voice for every network, and rules for the networks that need their own. I follow them in every draft."
    : "How the Brand sounds, in five parts. I follow them in every draft.",
  brand: "How the Brand looks: its logos, colors, type, and the rules its images follow.",
  images: "How I make this Brand's images: the styles I draw them in, and what Generate an image does on a draft.",
  competitors: "Who the Brand is measured against, so I can position it.",
  influencers: "The creators your audience listens to. I turn what they post into Topics in your Topic Feed.",
};

// The recap's sections with what each holds — the onboarding review walks
// through them one by one (flag connectFirst, welcome-alt-review.js).
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
// The Voice profile tab has its own row of tabs: the default voice — generic,
// tied to no network, the Playbook's own parts — then one per network the
// Playbook publishes on, each a variation of it. Which one is on screen is
// `?voice=` — kept like `?tab=`, without a route change.
function voiceNets(data) {
  if (!networkVoiceOn() || data?.voiceMode === "manual") return [];
  return playbookNetworks(data);
}

// The run's voice review opens a network's rules in edit (null: the default
// voice) — a network without rules shows its card, the ways as tiles.
export function editVoiceNetwork(net) {
  setVoiceNet(net);
  openEdit(cfg.getData(), "voice");
}

function setVoiceNet(net) {
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
        <span class="ap-infobox-title">Each network can now have its own rules</span>
        <span class="ap-infobox-message">On top of your default voice, I add what works on each network: from your posts, or by adapting it.</span>
        <button type="button" class="ap-link" data-vi-open="${esc(data.id || "")}">Show me</button>
      </div>
    </div>
  </div>`;
}

function renderVoiceTabs(data) {
  const nets = voiceNets(data);
  // Creation shows each network as a card under the default voice instead.
  if (!nets.length || !isLibrary()) return "";
  const tab = (net, label, icon, mark = "") => {
    const on = (net || null) === voiceNet;
    // Which networks have rules of their own, readable without opening each:
    // one that only follows the default voice says so (2026-10-28).
    const inherits = net && networkVoice(data, net).state !== "own";
    return `<button type="button" class="ap-tabs-tab${on ? " active" : ""}" role="tab" aria-selected="${on}" data-pb2-voice-net="${net}">
      ${icon ? `<i class="${icon}" aria-hidden="true"></i>` : ""}<span>${esc(label)}</span>${mark}${
        inherits ? `<span class="pb2-voice-tabs__inherit">Default voice</span>` : ""
      }
    </button>`;
  };
  // The default voice's tab: no network, every network starts from it.
  const defaultTab = tab("", "Default voice", "", `<span class="pb2-voice-tabs__inherit">All networks</span>`);
  return `
    <div class="ap-tabs flush pb2-voice-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Voices">
        ${defaultTab}${nets.map((n) => tab(n, networkLabel(n), networkIcon(n))).join("")}
      </div>
    </div>`;
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
  return `
    <header class="pb2-hero">
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
          <div class="pb2-meta">${meta}</div>
        </div>
      </div>
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
            return `<button type="button" class="ap-tabs-tab${on ? " active" : ""}" role="tab" aria-selected="${on}"
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
function pb2TabHead(scope, extra = "", { editing = false, noEdit = false, lead = SECTION_LEADS[scope] } = {}) {
  const edit =
    canEditView() && !noEdit
      ? `<button type="button" class="ap-button stroked blue" data-recap-edit-card="${scope}"><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit</span></button>`
      : "";
  return `
    <header class="pb2-tabhead">
      <p class="pb2-tabhead__lead">${esc(lead || "")}</p>
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
      `${pb2Hint(FIELD_HINTS.businessSummary)}<div class="ap-textarea-field resizable">
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
  // The voice's traits and how it's written (guided parts, or your own words)
  // ride on the first block; the parts follow, the same blocks as in read.
  const mode = `<div><span class="pb2-sub">Describe it</span>${renderVoiceModeToggle(data.voiceMode)}</div>`;
  if (data.voiceMode === "manual")
    return pb2EditGrid("voice", [
      pb2Block("The voice", `${pb2Traits(data)}${mode}`, { wide: true, index: 0, icon: "ap-icon-quote" }),
      pb2Block(
        "In your own words",
        `<div class="ap-textarea-field resizable">
           <textarea data-recap-text="voiceManual" rows="10" placeholder="How you open, your tone, formatting, what to avoid">${esc(data.voiceManual || "")}</textarea>
         </div>`,
        { wide: true, index: 1, icon: "ap-icon-quote" },
      ),
    ]);
  // The voice tabs stay on screen in edit: switching asks, like the page tabs.
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
      },
    );
    return `${renderVoiceTabs(data)}${grid}`;
  }
  return `${renderVoiceTabs(data)}${pb2EditGrid("voice", [
    cfg.networkPicker && cfg.onVoiceWay ? voiceWaysCard() : "",
    ...pb2VoiceParts(data, { edit: true, lead: mode }),
    ...networkVoiceCards(data),
  ])}`;
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
        <button type="button" class="recap__cta-remove" data-vr-remove="${field}" data-vr-index="${i}" aria-label="Remove"><i class="ap-icon-close"></i></button>
      </div>`,
    )
    .join("");
  return `<div class="pb2-rule-edits">${rows}</div>
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
    if (field === "voiceSummary" && !net) body = pb2Traits(data) + body + (i === 0 ? lead : "");
    if (field === "voiceNever" && !(net && edit)) body += pb2AvoidRow(brand, { edit: edit && !net });
    const ownSummary = net && field === "voiceSummary" && baseValue(data, field) !== baseValue(brand, field);
    return pb2Block(title, body, {
      aside: ownSummary && !edit ? tag : "",
      wide: true,
      hint,
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
  return `${renderVoiceTabs(data)}${pb2TabHead("voice", learnMenu + addVoiceMenu(data))}${voiceIntroHtml(data)}<div class="pb2-grid">${[
    ...pb2VoiceParts(data),
    ...networkVoiceCards(data),
    isLibrary() && canEditView() && voiceNets(data).length ? voiceSplitBlock(data, voiceParts().length) : "",
  ].join("")}</div>`;
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
// Creation: the draft's `voiceSplit`, never saved. The saved Playbook: read
// from its networks — every one kept on the default voice, by choice, is « the
// same voice everywhere ».
function voiceSplitIsEach(data) {
  if (!isLibrary()) return data.voiceSplit !== "same";
  return !voiceNets(data).every((n) => {
    const v = networkVoice(data, n);
    return v.state === "default" && v.chosen;
  });
}

// The choice itself: two DS radio cards, before the networks' cards in the
// creation review, after the default voice's parts on the saved Playbook.
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
  const later = isLibrary()
    ? "You can add rules for a network anytime, on its tab."
    : "You can add rules for a network later, in your Playbook.";
  return pb2Block(
    "Your networks",
    `<div class="pb2-voice-split" role="radiogroup" aria-label="Rules per network">
      ${option("same", "The same voice everywhere", `I write for ${names} in your default voice. ${later}`)}
      ${option("each", "Rules for each network", `I add what works on ${names} on top of your default voice.`)}
    </div>`,
    {
      wide: true,
      hint: "Each network can follow your default voice as it is, or have rules of its own.",
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
    return networkPickerCards(data, playbookNetworks(data), voiceParts().length);
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
      return pb2Block(`Rules for ${label}`, body, {
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
function voiceWaysCard(
  net = null,
  { title = "Rewrite it from a source", hint = "", className = "pb2-voice-ways" } = {},
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
      value: "interview",
      icon: "ap-icon-question",
      tile: "A few questions",
      hint: "5 questions, about a minute",
    },
    net && {
      value: "adapt",
      icon: "ap-icon-sparkles",
      tile: "Adapt my default voice",
      hint: `I tune it for ${label}: length, format, hashtags`,
    },
    net && { value: "write", icon: "ap-icon-pen", tile: "Write it myself", hint: "Start from an empty page" },
  ].filter(Boolean);
  return pb2Block(
    title,
    `<div class="voice-ask__options" style="--others:${Math.max(tiles.length - 1, 1)}">${tiles
      .map(
        (
          c,
          i,
        ) => `<button type="button" class="voice-ask__option${i ? "" : " is-best"}" data-voice-ask="${esc(net || "")}" data-voice-choice="${c.value}">
          <span class="voice-ask__icon" aria-hidden="true"><i class="${c.icon}"></i></span>
          <span class="voice-ask__text"><span class="voice-ask__name">${esc(c.tile)}</span><span class="voice-ask__hint">${esc(c.hint)}</span></span>
        </button>`,
      )
      .join("")}</div>`,
    {
      wide: true,
      hint:
        hint ||
        (net
          ? `I show you what I'd change before anything is saved.`
          : "I rewrite your default voice from what I read. You can edit it after."),
      className,
      icon: net ? networkIcon(net) : "",
    },
  );
}

// The run's Voice review (cfg.networkPicker, flag connectFirst — 2026-10-29,
// asked: « que l'on puisse ou non ajouter des voices pour des networks
// spécifiques »; the main-network card was removed the same day, asked):
// where the brand posts, then which networks get rules of their own — none by
// default, every network on the default voice — then a card per network
// picked. The ways to add rules are tiles in a network's card (2026-10-29: in
// the right column, not the review's left); once it has rules, its part opens
// them in edit (setVoiceNetwork).
// `voiceRulesFor` is the draft's (never saved): a network out of it keeps the
// default voice, chosen; in it with no rules yet, its first draft asks.
function networkPickerCards(data, nets, first) {
  if (!nets.length || !networkVoiceOn()) return [];
  const picked = data.voiceRulesFor || [];
  // One row per network — a voice is a network's, not an account's — with the
  // connected accounts on it underneath, as a reminder of what I write for
  // (2026-10-29, asked: « groupe ça par network »).
  const accountsOn = (net) => getConnectedProfiles().filter((p) => normalizeNetwork(p.platform) === net);
  const row = (net, on, desc, control) => {
    const accounts = accountsOn(net);
    return `
    <label class="recap__pick${on ? " is-picked" : ""}">
      <span class="welcome-flow__glyph"><i class="${networkIcon(net)}" aria-hidden="true"></i></span>
      <span class="recap__pick-text">
        <span class="recap__pick-name">${esc(networkLabel(net))}</span>
        ${desc ? `<span class="recap__pick-desc">${esc(desc)}</span>` : ""}
        ${
          accounts.length
            ? `<span class="pb2-voice-accounts"><span class="pb2-voice-accounts__label">${
                accounts.length > 1 ? "Connected accounts" : "Connected account"
              }</span>${accounts.map((a) => renderProfileTag(a)).join("")}</span>`
            : ""
        }
      </span>
      ${control}
    </label>`;
  };
  // The one question, on the networks of the connected accounts (where the
  // brand posts is known — 2026-10-29, asked: « la question, c'est est-ce que
  // tu veux utiliser une voice spécifique pour les networks suivants ou bien
  // utiliser la voice par défaut »).
  const stateOf = (net) =>
    !picked.includes(net)
      ? "Uses your default voice"
      : networkVoiceFilled(data, net)
        ? "Its own voice"
        : "Its own voice, to fill in";
  const pickBlock = pb2Block(
    "Which networks get their own voice?",
    `<div class="recap__pick-list">${nets
      .map((net) =>
        row(
          net,
          picked.includes(net),
          stateOf(net),
          `<span class="ap-checkbox-container" data-pb2-voice-rules="${esc(net)}"><input type="checkbox" ${
            picked.includes(net) ? "checked" : ""
          } aria-label="A voice of its own for ${esc(networkLabel(net))}" /><i></i></span>`,
        ),
      )
      .join("")}</div>`,
    {
      wide: true,
      hint: "The networks of your connected accounts. Each uses your default voice. Tick the ones that need their own: each gets an empty voice for you to fill in.",
      index: first,
      className: "pb2-voice-networks",
    },
  );
  // A network picked with an empty voice: its card is the ways to fill it.
  const cards = nets
    .filter((net) => picked.includes(net) && !networkVoiceFilled(data, net))
    .map((net) =>
      voiceWaysCard(net, {
        title: `Voice for ${networkLabel(net)}`,
        hint: `Empty for now. Until you fill it in, your ${networkLabel(net)} posts use your default voice. Start from:`,
        className: `pb2-voice-net pb2-voice-net--${net}`,
      }),
    );
  return [pickBlock, ...cards];
}

// A network's own voice with something in it — empty, it still has to be filled.
export function networkVoiceFilled(data, net) {
  const { state, voice } = networkVoice(data, net);
  if (state !== "own") return false;
  return (
    Boolean(String(voice.voiceSummary || "").trim()) ||
    ["voiceAlways", "voiceNever", "voiceByPost", "voiceSometimes"].some((f) => (voice[f] || []).length)
  );
}

// Picking: a network out of `voiceRulesFor` keeps the default voice,
// chosen (its rules, if any, go), one in it waits for rules.
function setNetworkRules(net, on) {
  const d = cfg.getData();
  const picked = (d.voiceRulesFor || []).filter((n) => n !== net);
  d.voiceRulesFor = on ? [...picked, net] : picked;
  const rest = Object.fromEntries(Object.entries(d.voiceByNetwork || {}).filter(([n]) => n !== net));
  d.voiceByNetwork = on ? rest : { ...rest, [net]: brandVoiceAsIs(d) };
  repaint();
}

// The same voice everywhere: every network keeps the default voice, chosen.
// Back to rules for each: what was kept that way goes, so a network learns
// from its posts again (creation) or is asked before its next draft. On the
// saved Playbook, rules about to go are confirmed first.
function setVoiceSplit(value) {
  const d = cfg.getData();
  if (voiceSplitIsEach(d) === (value === "each")) return;
  const nets = voiceNets(d);
  if (!isLibrary()) {
    d.voiceSplit = value;
    d.voiceByNetwork =
      value === "same"
        ? Object.fromEntries(nets.map((n) => [n, brandVoiceAsIs(d)]))
        : Object.fromEntries(Object.entries(d.voiceByNetwork || {}).filter(([, v]) => v.optimizedBy !== "brand"));
    return repaint();
  }
  if (value === "each") {
    updateContext(d.id, {
      voiceByNetwork: Object.fromEntries(
        Object.entries(d.voiceByNetwork || {}).filter(([, v]) => v.optimizedBy !== "brand"),
      ),
    });
    return repaint();
  }
  const apply = () => {
    nets.forEach((n) => saveNetworkVoice(d.id, n, brandVoiceAsIs(d)));
    repaint();
  };
  const withRules = nets.filter((n) => networkVoice(d, n).state === "own").map(networkLabel);
  if (!withRules.length) return apply();
  const rules = andList(withRules);
  openConfirmModal({
    title: "Use your default voice everywhere?",
    body: `The rules for ${rules} are removed, and every network follows your default voice. Drafts already written keep their text.`,
    confirmLabel: "Remove the rules",
    danger: true,
    onConfirm: apply,
    // The radio stays where it was.
    onCancel: repaint,
  });
}

// « Use my default voice instead » on a network with rules of its own, on the
// saved Playbook: its rules go, confirmed first.
function resetNetworkVoice(net) {
  const d = cfg.getData();
  const label = networkLabel(net);
  openConfirmModal({
    title: `Use your default voice on ${label}?`,
    body: `The rules for ${label} are removed, and ${label} follows your default voice. Drafts already written keep their text.`,
    confirmLabel: "Remove the rules",
    danger: true,
    onConfirm: () => {
      saveNetworkVoice(d.id, net, brandVoiceAsIs(d));
      repaint();
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
  if (choice === "interview")
    return openVoiceInterview({
      net,
      onDone: (answers) => openVoiceProposal({ ctx: d, net, choice, from: answers, onUse: set }),
    });
  openVoiceProposal({ ctx: d, net, choice, onUse: set });
}

function networkVoiceLead(net, voice, data) {
  const label = networkLabel(net);
  const base = "Your default voice";
  if (voice?.learnedFrom === ADAPTED_FROM)
    return `${base}, adapted for ${label}: its own rules are tagged « For ${label} ».`;
  if (voice?.optimizedBy === "learned")
    return voice.postCount
      ? `${base}, plus rules for ${label} learned from ${voice.postCount} posts of ${voice.learnedFrom}, tagged « For ${label} ».`
      : `${base}, plus rules for ${label} learned from ${voice.learnedFrom}, tagged « For ${label} ».`;
  return `${base}, plus rules for ${label} you wrote, tagged « For ${label} ».`;
}

// A warning infobox on a network's voice tab: its title, its message, an
// optional trusted action.
const voiceNotice = (title, message, action = "") =>
  `<div class="ap-infobox warning has-title pb2-voice-notice" role="status">
    <i class="ap-icon-warning_fill" aria-hidden="true"></i>
    <div class="ap-infobox-content">
      <div class="ap-infobox-texts">
        <span class="ap-infobox-title">${esc(title)}</span>
        <span class="ap-infobox-message">${esc(message)}</span>
        ${action}
      </div>
    </div>
  </div>`;

// A network's voice, read — under the default voice tab's own head: Learn from…
// (posts, documents) and Edit, the two ways a network's voice gets optimized;
// there is no button that optimizes it. Its own: the five parts, its rules
// tagged. None yet, or the default voice as it is: that voice on grey, warned.
function renderNetworkVoiceRead(data) {
  const net = voiceNet;
  const label = networkLabel(net);
  const { state, chosen, voice } = networkVoice(data, net);
  const tabs = renderVoiceTabs(data);
  if (state === "default") {
    // Edit starts from the default voice (data-pb2-voice-own).
    const actions = canEditView()
      ? `${learnMenu(net)}<button type="button" class="ap-button stroked blue" data-pb2-voice-own><i class="ap-icon-pen" aria-hidden="true"></i><span>Edit</span></button>${
          cfg.onAddNetworkVoice && networkVoiceOn()
            ? `<button type="button" class="ap-button primary orange" data-pb2-add-voice="${esc(net)}"><i class="ap-icon-plus" aria-hidden="true"></i><span>Add a voice for ${esc(label)}</span></button>`
            : `<button type="button" class="ap-button primary orange" data-recap-learn="adapt" data-recap-learn-net="${esc(net)}"><i class="ap-icon-sparkles" aria-hidden="true"></i><span>Adapt for ${esc(label)}</span></button>`
        }`
      : "";
    // Kept on the default voice by choice: said, not warned. Never set: warned.
    const notice = chosen
      ? ""
      : voiceNotice(
          `${label} follows your default voice`,
          `No rules for ${label} yet (length, format, hashtags), so drafts may miss what works there.`,
        );
    return `${tabs}${pb2TabHead("voice", actions, {
      noEdit: true,
      lead: chosen
        ? `${label} follows your default voice. Adapt it for ${label}, or add rules when ${label} needs its own.`
        : `Adapt your default voice for ${label}, or add rules from your posts, a document or a few questions.`,
    })}${voiceIntroHtml(data)}${notice}<div class="pb2-grid pb2-grid--borrowed">${pb2VoiceParts(data).join("")}</div>`;
  }
  const reset = `<button type="button" class="ap-button ghost grey" data-pb2-voice-reset="${esc(net)}">Use my default voice instead</button>`;
  return `${tabs}${pb2TabHead("voice", canEditView() ? reset + learnMenu(net) : "", { lead: networkVoiceLead(net, voice, data) })}${voiceIntroHtml(data)}<div class="pb2-grid">${pb2VoiceParts(
    voice,
    { brand: data, net },
  ).join("")}</div>`;
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

function renderActivePanel(data) {
  const scope = editScope;
  // Editing opens the section's own form; reading gets the tab's spread.
  if (activeTab === "voice") {
    // Creation's review: each network connected so far gets its voice — learned
    // from its posts, else optimized — shown here before it's saved.
    // (Not in the run's voice review: a network's voice starts empty there,
    // to be filled — 2026-10-29, asked: « il ne faut pas qu'elles soient préremplies ».)
    if (!isLibrary() && networkVoiceOn() && !cfg.networkPicker) data.voiceByNetwork = withNetworkVoices(data);
    // The run's voice review (cfg.networkPicker) opens a network's rules in edit.
    const keep = cfg.networkPicker ? playbookNetworks(data) : isLibrary() ? voiceNets(data) : [];
    if (voiceNet && !keep.includes(voiceNet)) setVoiceNet(null);
    return scope === "voice" ? renderVoiceEdit2(data) : renderVoiceRead2(data, learnMenu());
  }
  if (activeTab === "brand") return scope === "brand" ? renderBrandEdit2(data) : renderBrandRead2(data);
  if (activeTab === "images") return renderImagesPanel(data);
  if (activeTab === "competitors") return renderRosterPanel(data, ROSTERS.competitors, scope === "competitors");
  if (activeTab === "influencers") return renderInfluencersPanel(data, scope === "influencers");
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
        <div class="pb2__panel" role="tabpanel">${raw(renderActivePanel(data))}</div>
        ${raw(renderRefModal(data))} ${raw(renderRosterModal(data))} ${raw(renderInfluencerAddModal())}
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

function stopRosterScan() {
  if (rosterScanTimer) {
    window.clearTimeout(rosterScanTimer);
    rosterScanTimer = null;
  }
  rosterScanning = null;
}

// Mock "scan" — shows the section-scoped skeleton, then merges only the
// entries that aren't already known (so a repeat scan is idempotent and
// removing one brings just that one back).
function startRosterScan(r) {
  const data = cfg?.getData();
  if (!data || rosterScanning) return;
  stopRosterScan();
  rosterScanning = r.scope;
  rosterFoundNone = null;
  repaint();
  rosterScanTimer = window.setTimeout(() => {
    rosterScanTimer = null;
    rosterScanning = null;
    const live = cfg?.getData();
    if (!live || !mountTarget) return;
    const existing = rosterList(live, r);
    // Exclude what's already on the Playbook (accepted or still pending) AND
    // everything the user dismissed — Archie never re-proposes a rejection.
    const found = r.discover(live.websiteUrl || live.sourceUrl || "", {
      exclude: [...existing, ...dismissedList(live, r)],
    });
    const room = Math.max(0, r.max - existing.length);
    const added = found.slice(0, room).map((c) => ({ ...c, suggested: true }));
    added.forEach((c) => existing.push(c));
    rosterFoundNone = added.length === 0 ? r.scope : null;
    // Persist in library mode (no-op in onboarding, where the draft IS the data).
    if (added.length) cfg.commit?.();
    repaint();
  }, ROSTER_SCAN_MS);
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
  rosterModal = null;
  infAdd = null;
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
  const voiceTab = event.target.closest("[data-pb2-voice-net]");
  if (voiceTab) {
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
  const addVoice = event.target.closest("[data-pb2-add-voice]");
  if (addVoice) return cfg.onAddNetworkVoice?.(addVoice.dataset.pb2AddVoice);
  const rulesFor = event.target.closest("[data-pb2-voice-rules]");
  if (rulesFor)
    return event.target.matches("input") && setNetworkRules(rulesFor.dataset.pb2VoiceRules, event.target.checked);
  const resetVoice = event.target.closest("[data-pb2-voice-reset]");
  if (resetVoice && cfg.networkPicker) return setNetworkRules(resetVoice.dataset.pb2VoiceReset, false);
  if (resetVoice)
    return isLibrary()
      ? resetNetworkVoice(resetVoice.dataset.pb2VoiceReset)
      : giveNetworkVoice(resetVoice.dataset.pb2VoiceReset, "default");
  if (event.target.closest("[data-pb2-voice-own]") && voiceNet)
    return editNetworkVoiceFrom(brandVoiceAsIs(cfg.getData()));
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

  // ── Add an influencer (dialog, from read mode) ──
  if (event.target.closest("[data-recap-infadd-open]")) {
    infAdd = emptyInfluencerDraft();
    repaint(); // the page stays on the section behind the dialog
    document.querySelector("[data-recap-infadd-field='name']")?.focus();
    return;
  }
  if (event.target.closest("[data-recap-infadd-close]") || event.target.matches?.("[data-recap-infadd-backdrop]")) {
    infAdd = null;
    repaint();
    return;
  }
  if (event.target.closest("[data-recap-infadd-submit]")) {
    if (!infAdd || !infAdd.name.trim()) return;
    const r = ROSTERS.influencers;
    const list = rosterList(data, r);
    if (list.length < r.max) {
      list.push({
        id: `${r.idPrefix}-new-${list.length + 1}-${Date.now().toString(36)}`,
        name: infAdd.name.trim(),
        description: "",
        websiteUrl: infAdd.websiteUrl.trim(),
        socials: r.networks
          .map((network) => ({ network, url: (infAdd.socials[network] || "").trim() }))
          .filter((x) => x.url),
      });
      cfg.commit?.();
    }
    infAdd = null;
    repaint();
    return;
  }

  // ── Competitors + Influencers ──
  // Every hook below acts on the roster it sits in (rosterOf).
  if (event.target.closest("[data-recap-cmp-discover]")) {
    startRosterScan(rosterOf(event.target));
    return;
  }

  // Accept a proposal — it becomes one of the Playbook's own entries.
  // Deliberately available in READ mode: adopting a suggestion shouldn't
  // require entering the section editor, that's the point of the tray.
  const cmpAccept = event.target.closest("[data-recap-cmp-accept]");
  if (cmpAccept) {
    const c = rosterList(data, rosterOf(cmpAccept))[Number(cmpAccept.dataset.recapCmpAccept)];
    if (!c) return;
    delete c.suggested;
    rosterModal = null;
    if (!editScope) cfg.commit?.(); // in edit mode the section's Save commits
    repaint();
    return;
  }

  // Picker (cfg.rosterPicker): untick — back to my suggestions, nothing lost.
  const cmpUnaccept = event.target.closest("[data-recap-cmp-unaccept]");
  if (cmpUnaccept) {
    const c = rosterList(data, rosterOf(cmpUnaccept))[Number(cmpUnaccept.dataset.recapCmpUnaccept)];
    if (!c) return;
    c.suggested = true;
    rosterModal = null;
    repaint();
    return;
  }

  const cmpAcceptAll = event.target.closest("[data-recap-cmp-accept-all]");
  if (cmpAcceptAll) {
    pendingEntries(data, rosterOf(cmpAcceptAll)).forEach((c) => delete c.suggested);
    rosterModal = null;
    if (!editScope) cfg.commit?.();
    repaint();
    return;
  }

  // Dismiss a proposal — drop it and remember the rejection so a later scan
  // doesn't surface it again.
  const cmpDismiss = event.target.closest("[data-recap-cmp-dismiss]");
  if (cmpDismiss) {
    const r = rosterOf(cmpDismiss);
    const list = rosterList(data, r);
    const idx = Number(cmpDismiss.dataset.recapCmpDismiss);
    const c = list[idx];
    if (!c) return;
    const key = r.key(c);
    const dismissed = dismissedList(data, r);
    if (key && !dismissed.includes(key)) dismissed.push(key);
    list.splice(idx, 1);
    rosterModal = null; // indices shifted — the open modal no longer means anything
    if (!editScope) cfg.commit?.();
    repaint();
    return;
  }

  const cmpOpen = event.target.closest("[data-recap-cmp-open]");
  if (cmpOpen) {
    rosterModal = { kind: rosterOf(cmpOpen).scope, index: Number(cmpOpen.dataset.recapCmpOpen) };
    repaint();
    return;
  }

  if (event.target.closest("[data-recap-cmp-close]") || event.target.matches?.("[data-recap-cmpmodal-backdrop]")) {
    rosterModal = null;
    repaint();
    return;
  }

  const cmpRemove = event.target.closest("[data-recap-cmp-remove]");
  if (cmpRemove) {
    const idx = Number(cmpRemove.dataset.recapCmpRemove);
    const list = rosterList(data, rosterOf(cmpRemove));
    if (idx >= 0 && idx < list.length) list.splice(idx, 1);
    rosterModal = null; // the open modal's index no longer means anything
    repaint();
    return;
  }

  const cmpAdd = event.target.closest("[data-recap-cmp-add]");
  if (cmpAdd) {
    const r = rosterOf(cmpAdd);
    const list = rosterList(data, r);
    if (list.length >= r.max) return;
    list.push({
      id: `${r.idPrefix}-new-${list.length + 1}-${Date.now().toString(36)}`,
      name: "",
      description: "",
      websiteUrl: "",
      socials: [],
    });
    rosterModal = { kind: r.scope, index: list.length - 1 }; // open the blank card straight away
    repaint();
    mountTarget?.querySelector("[data-recap-cmp-field='name']")?.focus();
    return;
  }

  const cmpSocialAdd = event.target.closest("[data-recap-cmp-social-add]");
  if (cmpSocialAdd) {
    const c = rosterList(data, rosterOf(cmpSocialAdd))[Number(cmpSocialAdd.dataset.recapCmpSocialAdd)];
    if (!c) return;
    if (!Array.isArray(c.socials)) c.socials = [];
    c.socials.push({ network: rosterOf(cmpSocialAdd).networks[0], url: "" });
    repaint();
    const inputs = document.querySelectorAll("[data-recap-cmp-social-url]");
    inputs[inputs.length - 1]?.focus();
    return;
  }

  const cmpSocialRemove = event.target.closest("[data-recap-cmp-social-remove]");
  if (cmpSocialRemove) {
    const c = rosterList(data, rosterOf(cmpSocialRemove))[Number(cmpSocialRemove.dataset.recapCmpIndex)];
    const si = Number(cmpSocialRemove.dataset.recapCmpSocialIndex);
    if (c && Array.isArray(c.socials) && si >= 0 && si < c.socials.length) c.socials.splice(si, 1);
    repaint();
    return;
  }

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
  // No repaint: that would steal the caret — only the submit's state follows.
  const addField = event.target.closest?.("[data-recap-infadd-field], [data-recap-infadd-social]");
  if (addField && infAdd) {
    if (addField.dataset.recapInfaddField) infAdd[addField.dataset.recapInfaddField] = addField.value;
    else infAdd.socials[addField.dataset.recapInfaddSocial] = addField.value;
    const submit = document.querySelector("[data-recap-infadd-submit]");
    if (submit) submit.disabled = !infAdd.name.trim();
    return;
  }
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
