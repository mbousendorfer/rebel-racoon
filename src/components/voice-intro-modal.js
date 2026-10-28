// The voice intro (flag voicePerNetwork) — the first time a returning user
// meets « each network, its own voice », shown once:
//   · arriving in the app, for a Playbook with a network on the default voice
//     → this dialog: one post rewritten for each network's voice, then where
//     the Playbook stands and « Learn N voices » from the accounts' posts —
//     each one shown, then used or edited, like everywhere else;
//   · the Voice profile tab → an infobox whose « Show me » opens this dialog;
//   · never for a new user: a creation marks the intro seen (context-builder).
// One key, owned here.
//
// Also owned here, shared by every surface that gives a network its voice:
// learnedVoiceHtml — a voice edit, the one look of what Archie proposes.
//
// Public API:
//   init() · maybeOpenVoiceIntro(path)
//   introSeen() · markIntroSeen() · resetIntro()
//   learnedVoiceHtml(ctx, net, voice?, { only, pending })
//   voiceAskHtml(ctx, net, { id, choices, giving, resolved }) — the Voice step's block
// Anything carrying [data-vi-open] opens the dialog (one delegated listener).

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2316";
import { getContextById } from "../contexts-store.js?v=2316";
import { playbookForNewWork } from "../active-playbook.js?v=2316";
import { isNewUser } from "../user-mode.js?v=2316";
import { networkLabel, networkIcon, profileForNetwork } from "../social-profiles.js?v=2316";
import {
  networkVoiceOn,
  networkVoice,
  playbookNetworks,
  canLearnFrom,
  voiceParts,
  cloneItems,
  baseValue,
  voiceItemsHtml,
  voiceNetTagHtml,
} from "../voice-parts.js?v=2316";
import {
  proposeNetworkVoice,
  saveNetworkVoice,
  editNetworkVoiceInPlaybook,
  learnPhases,
  LEARN_PHASE_MS,
} from "../network-voice-flow.js?v=2316";
import { NETWORK_VOICE_SAMPLE, NETWORK_VOICE_TRAITS } from "../mocks.js?v=2316";
import "../archie-pixels.js?v=2316";
import { navigate } from "../router.js?v=2316";
import { escapeHtml } from "../utils.js?v=2316";

const MODAL_ID = "voice-intro";
const KEY = "archie-voice-intro-seen";

export function introSeen() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetIntro() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const brandOf = (ctx) => ctx?.brandName || ctx?.name || "your brand";

// ── The comparison: one idea, the default voice, then each network's ──────────
// The Playbook's own networks first (three at most), topped up with the three
// that differ the most, so the contrast always shows. Words fade in one by one,
// column after column — the post being rewritten.

const SAMPLE_NETS = ["linkedin", "instagram", "x"];

function comparisonNets(ctx) {
  const own = playbookNetworks(ctx).filter((n) => NETWORK_VOICE_SAMPLE[n]);
  return [...new Set([...own, ...SAMPLE_NETS])].slice(0, 3);
}

const fill = (text, ctx) => text.replaceAll("{brand}", brandOf(ctx));

// Each word its own span (its rank in --w); the whitespace between them stays
// text, so line breaks survive `white-space: pre-line`.
const wordsHtml = (text) => {
  let w = 0;
  return text
    .split(/(\s+)/)
    .map((part) =>
      /^\s*$/.test(part) ? part : `<span class="voice-compare__w" style="--w:${w++}">${escapeHtml(part)}</span>`,
    )
    .join("");
};

// The Brand's own words for its voice: the headline's three, else its tones.
const brandTraits = (ctx) => {
  const head = (ctx?.voiceProfile?.headline || "").split(/\s*·\s*/).filter(Boolean);
  return (head.length ? head : ctx?.tones || []).slice(0, 3);
};
const traitsOf = (ctx, net) => (net === "brand" ? brandTraits(ctx) : NETWORK_VOICE_TRAITS[net] || []);
const traitsHtml = (list) =>
  `<span class="voice-intro__traits">${list
    .map((t, i) => `<span class="voice-intro__trait" style="--k:${i}">${escapeHtml(t)}</span>`)
    .join("")}</span>`;

// The Brand's square mark — its icon logo; the wordmark would be a smudge at
// avatar size. Else its initial.
const brandMark = (ctx) => {
  const icon = (ctx?.brandLogos || []).find((l) => l.variant === "icon")?.url;
  return icon
    ? `<img src="${escapeHtml(icon)}" alt="" />`
    : `<span>${escapeHtml(brandOf(ctx).charAt(0).toUpperCase())}</span>`;
};

// One post card — the dialog's stage.
function postCardHtml(ctx, net) {
  const label = net === "brand" ? "Default voice" : networkLabel(net);
  return `
    <article class="voice-intro__post" aria-label="${escapeHtml(label)} post">
      <header class="voice-intro__post-head">
        <span class="voice-intro__avatar">${brandMark(ctx)}</span>
        <span class="voice-intro__who">
          <span class="voice-intro__who-name">${escapeHtml(brandOf(ctx))}</span>
          <span class="voice-intro__who-meta">${net === "brand" ? "Default voice · any network" : escapeHtml(networkLabel(net))}</span>
        </span>
        ${net === "brand" ? "" : `<i class="${networkIcon(net)} voice-intro__post-net" aria-hidden="true"></i>`}
      </header>
      <p class="voice-intro__post-text">${wordsHtml(fill(NETWORK_VOICE_SAMPLE[net], ctx))}</p>
      ${traitsHtml(traitsOf(ctx, net))}
    </article>`;
}

// ── A voice edit ────────────────────────────────────────────────────────────
// What Archie proposes for a network's voice, in ONE look wherever it shows
// (the chat's Voice step, the proposal dialog, the intro, a draft's feedback),
// built like the memory was: on butter, Archie speaks — the network, where the
// voice comes from, « Not saved yet » while it waits for its answer, his
// sentence for the network; below, on white, each rule it adds, marked +.
// Compact and quiet on purpose: a pixel stage and tinted pills around it were
// too much (2026-10-27).
// `voice`: the proposal (default: the network's voice as saved). `only`: the
// rules it ADDS to a voice that already had its own (a draft's feedback) —
// just those. `pending`: the « Not saved yet » pill.
export function learnedVoiceHtml(ctx, net, voice = null, { only = null, pending = true } = {}) {
  voice = voice || networkVoice(ctx, net).voice;
  const label = escapeHtml(networkLabel(net));
  const summary = only
    ? ""
    : String(voice?.voiceSummary || "")
        .replace(baseValue(ctx, "voiceSummary"), "")
        .trim();
  // Grouped under the Voice profile section each rule goes into — the same
  // titles as the Playbook's tab (Always, Never, Depending on the post…).
  // The summary part holds the network's own sentence (what follows the
  // default voice's), shown as that part's one line.
  const groups = voiceParts()
    .map((p) => ({
      title: p.title,
      hint: p.hint,
      kind: p.kind,
      rules:
        p.kind === "text"
          ? summary
            ? [{ text: summary }]
            : []
          : cloneItems(voice?.[p.field]).filter((i) => (only ? only.includes(i.text) : i.adapted)),
    }))
    .filter((g) => g.rules.length);
  const from = only
    ? "from your feedback"
    : voice?.postCount
      ? `from ${voice.postCount} posts of ${voice.learnedFrom}`
      : voice?.learnedFrom
        ? `from ${voice.learnedFrom}`
        : "";
  const name = `For ${label}`;
  // Proposed rules look exactly like saved ones: the Voice profile's renderer
  // and its « For X » tag (every proposed rule is the network's own).
  const tag = voiceNetTagHtml(net);
  const card = `
    <section class="voice-edit__card" aria-label="${name}">
      <div class="voice-edit__say">
        <header class="voice-edit__head">
          <span class="voice-edit__net" aria-hidden="true"><i class="${networkIcon(net)}"></i></span>
          <span class="voice-edit__title">
            <span class="voice-edit__name">${name}</span>
            ${from ? `<span class="voice-edit__from" title="${escapeHtml(from)}">${escapeHtml(from)}</span>` : ""}
          </span>
          ${pending ? `<span class="ap-status grey voice-edit__pending">Not saved yet</span>` : ""}
        </header>
      </div>
      <div class="voice-edit__changes">
        <p class="voice-edit__where">Goes into your Voice profile, ${label} tab</p>
        ${groups
          .map(
            (g) => `<section class="voice-edit__group" aria-label="${escapeHtml(g.title)}">
          <h4 class="voice-edit__part">${escapeHtml(g.title)}</h4>
          <p class="voice-edit__hint">${escapeHtml(g.hint)}</p>
          <div class="voice-edit__body">${
            g.kind === "text"
              ? `<p class="voice-edit__lead">${escapeHtml(g.rules[0].text)}</p>${tag}`
              : voiceItemsHtml(g.rules, { tag })
          }</div>
        </section>`,
          )
          .join("")}
      </div>
      <p class="voice-edit__rest">${only ? `Your other ${label} rules stay as they are.` : "Everything else comes from your default voice."}</p>
    </section>`;
  return `<div class="voice-edit">${card}</div>`;
}

// ── The Voice step, in the thread ──────────────────────────────────────────
// A network with no rules of its own, before a draft for it (or « Add rules
// for X » on one): a sibling of the voice edit — on butter, Archie says what's
// missing and what rules for the network cover; on white, the ways to add
// them as tiles — the best one first, full width, recommended; the others
// in a row below — then the way out. Once answered, it folds to its title
// line (the answer is the user's turn below it).
export function voiceAskHtml(ctx, net, { id, choices = [], giving = false, resolved = false }) {
  const label = escapeHtml(networkLabel(net));
  const traits = NETWORK_VOICE_TRAITS[net] || [];
  // What a rule for the network looks like — examples, each one its own chip.
  const examples = traits.length
    ? `<div class="voice-ask__examples">
        <p class="voice-ask__label">Rules for ${label} would say things like</p>
        <ul class="voice-ask__chips">${traits.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>`
    : "";
  const tiles = choices.filter((c) => c.tile);
  const hasDefault = choices.some((c) => c.value === "default");
  const pick = (value) => `data-voice-ask="${escapeHtml(id)}" data-voice-choice="${value}"`;
  return `
    <div class="voice-edit voice-ask${resolved ? " is-resolved" : ""}">
      <section class="voice-edit__card" aria-label="Rules for ${label}">
        <div class="voice-edit__say">
          <header class="voice-edit__head">
            <span class="voice-edit__net" aria-hidden="true"><i class="${networkIcon(net)}"></i></span>
            <span class="voice-edit__title"><span class="voice-edit__name">No rules for ${label} yet</span></span>
          </header>
          ${
            resolved
              ? ""
              : `<p class="voice-edit__line">${
                  giving
                    ? `These drafts follow your default voice.`
                    : `I'd write for ${label} with your default voice — what works elsewhere may not work there.`
                }</p>`
          }
        </div>
        ${
          resolved
            ? ""
            : `<div class="voice-ask__body">
          ${examples}
          <p class="voice-ask__label">How should I add them?</p>
          <div class="voice-ask__options" style="--others:${Math.max(tiles.length - 1, 1)}">${tiles
            .map(
              (c, i) => `<button type="button" class="voice-ask__option${i ? "" : " is-best"}" ${pick(c.value)}>
                <span class="voice-ask__icon" aria-hidden="true"><i class="${c.icon}"></i></span>
                <span class="voice-ask__text">
                  <span class="voice-ask__name">${escapeHtml(c.tile)}</span>
                  <span class="voice-ask__hint">${escapeHtml(c.hint)}</span>
                </span>
                ${i ? "" : `<span class="ap-tag green mini voice-ask__best">Recommended</span>`}
              </button>`,
            )
            .join("")}</div>
          <div class="voice-ask__foot">
            ${hasDefault ? `<button type="button" class="ap-button ghost grey" ${pick("default")}>Use my default voice</button>` : ""}
            <button type="button" class="ap-button ghost grey" ${pick("cancel")}>Not now</button>
          </div>
        </div>`
        }
      </section>
    </div>`;
}

// ── The dialog ──────────────────────────────────────────────────────────────
// The first-time run's look (welcome-alt-intro.js): the words on the left, and
// on the right, on Archie's warm pixel field, the thing they're about.
//   Step 1 — one post on the stage, rewritten in turn for each network: the
//            default voice first, then each network's own, its traits under it.
//            The list on the left follows it, and picks one.
//   Step 2 — where the Playbook stands: on the left the networks to learn, on
//            the stage the Playbook's Voice profile filling as they're learned.
//   Then   — what was learned: one network at a time, what its voice changes
//            from the default voice.

const CYCLE_MS = 5200;

let backdrop, modal, titleEl, subEl, leftEl, actionsEl, stageEl;
let ctxId = null;
let learning = false;
let shown = "brand"; // step 1: the voice on the stage
let timer = null;

const HTML = `
<div class="app-modal-backdrop" id="voiceIntroBackdrop" hidden></div>
<aside class="ap-dialog voice-intro-modal" id="voiceIntroModal" role="dialog" aria-modal="true"
  aria-labelledby="voiceIntroTitle" aria-hidden="true">
  <button class="ap-dialog-close" type="button" data-vi-action="close" aria-label="Close"><i class="ap-icon-close"></i></button>
  <div class="voice-intro__split">
    <section class="voice-intro__lede">
      <h2 class="voice-intro__title" id="voiceIntroTitle"></h2>
      <p class="voice-intro__sub" id="voiceIntroSub"></p>
      <div class="voice-intro__left" id="voiceIntroLeft"></div>
      <div class="voice-intro__actions" id="voiceIntroActions"></div>
    </section>
    <div class="voice-intro__stage">
      <archie-pixels data-quiet></archie-pixels>
      <div class="voice-intro__stage-inner" id="voiceIntroStage"></div>
    </div>
  </div>
</aside>`;

export function init() {
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-vi-open]");
    if (opener) openVoiceIntro(opener.dataset.viOpen || null);
  });
}

function injectOnce() {
  if (modal) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = HTML;
  document.body.appendChild(wrapper);
  backdrop = document.getElementById("voiceIntroBackdrop");
  modal = document.getElementById("voiceIntroModal");
  titleEl = document.getElementById("voiceIntroTitle");
  subEl = document.getElementById("voiceIntroSub");
  leftEl = document.getElementById("voiceIntroLeft");
  actionsEl = document.getElementById("voiceIntroActions");
  stageEl = document.getElementById("voiceIntroStage");
  modal.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-vi-show]");
    if (pick) return showVoice(pick.dataset.viShow, { manual: true });
    const result = e.target.closest("[data-vi-result]");
    if (result) return showLearned(result.dataset.viResult);
    const action = e.target.closest("[data-vi-action]")?.dataset.viAction;
    if (action === "close" || action === "done") close();
    else if (action === "next") renderStand();
    else if (action === "learn") learnChecked();
    else if (action === "see") seeVoices();
    else if (action === "use") useShown();
    else if (action === "edit") editShown();
  });
  modal.addEventListener("change", (e) => e.target.closest("[data-vi-check]") && renderStandActions());
  bindOverlayDismissal({ modal, backdrop, close: () => !learning && close() });
}

// Arriving in the app: once, for a returning user whose Playbook still has a
// network on the default voice — and never over another dialog or the first run.
export function maybeOpenVoiceIntro(path) {
  if (!networkVoiceOn() || introSeen() || isNewUser() || document.body.classList.contains("has-modal")) return;
  if (path.startsWith("/welcome-alt") || path.startsWith("/session/welcome-alt-")) return;
  const ctx = playbookForNewWork();
  if (!ctx || !playbookNetworks(ctx).some((n) => networkVoice(ctx, n).state !== "own")) return;
  openVoiceIntro(ctx.id);
}

function openVoiceIntro(contextId = null) {
  const ctx = getContextById(contextId) || playbookForNewWork();
  if (!ctx) return;
  markIntroSeen();
  injectOnce();
  requestOpen(MODAL_ID, close);
  ctxId = ctx.id;
  renderSame(ctx);
  backdrop.hidden = false;
  backdrop.classList.add("open");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");
  setTimeout(() => actionsEl.querySelector(".primary")?.focus({ preventScroll: true }), 0);
}

const button = (action, kind, label) =>
  `<button type="button" class="ap-button ${kind}" data-vi-action="${action}">${escapeHtml(label)}</button>`;

const glyphTile = (net) =>
  net === "brand"
    ? `<span class="voice-intro__tile is-brand" aria-hidden="true"><i class="ap-icon-quote"></i></span>`
    : `<span class="voice-intro__tile" aria-hidden="true"><i class="${networkIcon(net)}"></i></span>`;

// Step 1 — the « aha »: the same idea, in each network's voice.
function renderSame(ctx) {
  modal.classList.remove("is-stand");
  stageEl.classList.remove("is-result");
  titleEl.textContent = "Each network, its own voice";
  subEl.textContent =
    "The same idea, written the way each network reads it. I learn what works on each one from your posts — you review it before it's saved.";
  actionsEl.innerHTML = button("close", "ghost grey", "Not now") + button("next", "primary blue", "Next");
  showVoice("brand");
}

// The list on the left and the post on the stage, for one voice. Unless the
// user picked one, the stage moves on to the next by itself.
function showVoice(net, { manual = false } = {}) {
  const ctx = getContextById(ctxId);
  if (!ctx || modal.classList.contains("is-stand")) return;
  const voices = ["brand", ...comparisonNets(ctx)];
  shown = net;
  const label = (n) => (n === "brand" ? "Default voice" : networkLabel(n));
  leftEl.innerHTML = `
    <ul class="voice-intro__voices" aria-label="Voices">
      ${voices
        .map(
          (
            n,
          ) => `<li><button type="button" class="voice-intro__voice${n === net ? " is-on" : ""}" data-vi-show="${n}" aria-pressed="${n === net}">
            ${glyphTile(n)}
            <span class="voice-intro__voice-text">
              <span class="voice-intro__voice-name">${escapeHtml(label(n))}</span>
              <span class="voice-intro__voice-hint">${escapeHtml(n === "brand" ? "How your Brand sounds, everywhere" : traitsOf(ctx, n).join(" · "))}</span>
            </span>
          </button></li>`,
        )
        .join("")}
    </ul>`;
  stageEl.innerHTML = `
    <div class="voice-intro__status ap-status ${net === "brand" ? "grey" : "mermaid"}" data-vi-status>${
      net === "brand" ? "Written in the default voice" : `Rewritten for ${escapeHtml(networkLabel(net))}`
    }</div>
    ${postCardHtml(ctx, net)}`;
  clearTimeout(timer);
  if (manual) return;
  const next = voices[(voices.indexOf(net) + 1) % voices.length];
  timer = setTimeout(() => showVoice(next), net === "brand" ? CYCLE_MS - 1600 : CYCLE_MS);
}

// Step 2 — where the Playbook stands, and the voices to learn. What's learned
// here is a proposal (`proposals`) until it's used (`used`): only then saved.
const proposals = new Map(); // net → voice
const used = new Set();
let resultNets = [];

function stateText(ctx, net) {
  if (proposals.has(net)) return used.has(net) ? "Added to your Voice profile" : "To review";
  const { state, voice } = networkVoice(ctx, net);
  if (state === "own")
    return voice.optimizedBy === "you"
      ? "Its own rules, written by you"
      : voice.postCount
        ? `Its own rules, from ${voice.postCount} posts of ${voice.learnedFrom}`
        : `Its own rules, from ${voice.learnedFrom}`;
  const account = profileForNetwork(net);
  return canLearnFrom(account)
    ? `Default voice — I can learn from ${account.postCount} posts of ${account.handle}`
    : "Default voice — too few posts to learn from";
}

const learnable = (ctx, net) => networkVoice(ctx, net).state !== "own" && canLearnFrom(profileForNetwork(net));

function rowHtml(ctx, net) {
  const slot = learnable(ctx, net)
    ? `<label class="ap-checkbox-container"><input type="checkbox" value="${escapeHtml(net)}" data-vi-check checked aria-label="Learn from ${escapeHtml(networkLabel(net))}" /><i></i></label>`
    : "";
  return `
    <li class="voice-intro__net" data-vi-net="${escapeHtml(net)}">
      <span class="voice-intro__slot">${slot}</span>
      ${glyphTile(net)}
      <span class="voice-intro__text">
        <span class="voice-intro__name">${escapeHtml(networkLabel(net))}</span>
        <span class="voice-intro__state">${escapeHtml(stateText(ctx, net))}</span>
      </span>
    </li>`;
}

// The Playbook card on the stage — the first-time run's, its Voice profile
// part only, one line per network: its traits once it has its own voice (or a
// proposal), the default voice, or a quiet bar (breathing while it's learned).
function cardFieldHtml(ctx, net, { pending = false, landing = false } = {}) {
  const { state, voice } = networkVoice(ctx, net);
  const value =
    proposals.has(net) || (state === "own" && voice.optimizedBy !== "you")
      ? traitsHtml(NETWORK_VOICE_TRAITS[net] || [])
      : state === "own"
        ? `<span class="voice-intro__plain">As you set it</span>`
        : pending
          ? `<span class="voice-intro__bar"></span><span class="voice-intro__bar is-short"></span>`
          : `<span class="voice-intro__plain">The default voice</span>`;
  return `
    <div class="voice-intro__field${pending ? " is-pending" : ""}${landing ? " is-landing" : ""}" data-vi-field="${escapeHtml(net)}">
      <dt><i class="${networkIcon(net)}" aria-hidden="true"></i>${escapeHtml(networkLabel(net))}</dt>
      <dd>${value}</dd>
    </div>`;
}

function renderCard(ctx) {
  stageEl.innerHTML = `
    <div class="voice-intro__card">
      <div class="voice-intro__card-head">
        <span class="voice-intro__mark">${brandMark(ctx)}</span>
        <span class="voice-intro__card-title">${escapeHtml(ctx.name || brandOf(ctx))}</span>
      </div>
      <section class="voice-intro__part">
        <span class="voice-intro__part-tile" aria-hidden="true"><i class="ap-icon-quote"></i></span>
        <h3 class="voice-intro__part-name">Voice profile</h3>
        <dl class="voice-intro__fields">
          <div class="voice-intro__field">
            <dt>Default voice</dt>
            <dd>${traitsHtml(brandTraits(ctx))}</dd>
          </div>
          ${playbookNetworks(ctx)
            .map((n) => cardFieldHtml(ctx, n))
            .join("")}
        </dl>
      </section>
    </div>`;
}

function renderStand() {
  const ctx = getContextById(ctxId);
  if (!ctx) return close();
  clearTimeout(timer);
  modal.classList.add("is-stand");
  titleEl.textContent = `Here's where ${brandOf(ctx)} stands`;
  subEl.textContent = playbookNetworks(ctx).some((n) => learnable(ctx, n))
    ? "Pick the networks I should learn from. You'll review what I find before anything is saved."
    : "Add rules for a network from a document, a few questions or by hand — all in your Voice profile.";
  leftEl.innerHTML = `<ul class="voice-intro__nets">${playbookNetworks(ctx)
    .map((n) => rowHtml(ctx, n))
    .join("")}</ul>`;
  renderCard(ctx);
  renderStandActions();
}

const checked = () => [...modal.querySelectorAll("[data-vi-check]:checked")].map((i) => i.value);

function renderStandActions() {
  const ctx = getContextById(ctxId);
  if (!playbookNetworks(ctx).some((n) => learnable(ctx, n))) {
    actionsEl.innerHTML = button("done", "ghost grey", "Later") + button("see", "primary blue", "Open the Playbook");
    return;
  }
  const n = checked().length;
  actionsEl.innerHTML =
    button("done", "ghost grey", "Later") +
    `<button type="button" class="ap-button primary orange" data-vi-action="learn" ${n ? "" : "disabled"}>${
      n === 1 ? "Learn from 1 network" : `Learn from ${n} networks`
    }</button>`;
}

// One network after the other: « Reading … » on the left while its line on
// the card breathes, then the proposal's traits land on the card.
function learnChecked() {
  const nets = checked();
  if (!nets.length || learning) return;
  learning = true;
  actionsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
  modal.querySelectorAll("[data-vi-check]").forEach((i) => (i.disabled = true));
  const step = ([net, ...rest]) => {
    if (!net) return learned(nets);
    const row = modal.querySelector(`[data-vi-net="${net}"]`);
    const field = () => stageEl.querySelector(`[data-vi-field="${net}"]`);
    const state = row.querySelector(".voice-intro__state");
    const phases = learnPhases(net);
    row.classList.add("is-learning");
    state.textContent = phases[0];
    field().outerHTML = cardFieldHtml(getContextById(ctxId), net, { pending: true });
    phases.slice(1).forEach((p, i) =>
      setTimeout(
        () => {
          if (learning) state.textContent = p;
        },
        LEARN_PHASE_MS * (i + 1),
      ),
    );
    setTimeout(() => {
      if (!learning) return;
      const ctx = getContextById(ctxId);
      proposals.set(net, proposeNetworkVoice(ctx, net, "learn"));
      row.classList.remove("is-learning");
      row.querySelector(".voice-intro__slot").innerHTML =
        `<i class="ap-icon-check voice-intro__done" aria-hidden="true"></i>`;
      state.textContent = stateText(ctx, net);
      field().outerHTML = cardFieldHtml(ctx, net, { landing: true });
      step(rest);
    }, LEARN_PHASE_MS * phases.length);
  };
  step(nets);
}

// Learned: each proposal shown, one network at a time — on the left the voices
// learned (a click shows one), on the stage what it changes; Use this voice
// saves it and moves on, Edit in the Playbook opens it there, unsaved.
function learned(nets) {
  learning = false;
  resultNets = nets;
  titleEl.textContent =
    nets.length === 1 ? `New rules for ${networkLabel(nets[0])}` : `New rules for ${nets.length} networks`;
  subEl.textContent = "Here's what I'd add to your Voice profile. Nothing is saved until you add it.";
  showLearned(nets[0]);
}

function showLearned(net) {
  const ctx = getContextById(ctxId);
  modal.dataset.viFirst = net;
  leftEl.innerHTML = `
    <ul class="voice-intro__voices" aria-label="Networks to review">
      ${resultNets
        .map(
          (
            n,
          ) => `<li><button type="button" class="voice-intro__voice${n === net ? " is-on" : ""}" data-vi-result="${n}" aria-pressed="${n === net}">
            ${glyphTile(n)}
            <span class="voice-intro__voice-text">
              <span class="voice-intro__voice-name">${escapeHtml(networkLabel(n))}</span>
              <span class="voice-intro__voice-hint">${escapeHtml(stateText(ctx, n))}</span>
            </span>
          </button></li>`,
        )
        .join("")}
    </ul>`;
  stageEl.classList.add("is-result");
  stageEl.innerHTML = learnedVoiceHtml(ctx, net, proposals.get(net), { pending: !used.has(net) });
  actionsEl.innerHTML = resultNets.every((n) => used.has(n))
    ? button("done", "primary blue", "Done")
    : used.has(net)
      ? button("done", "ghost grey", "Later")
      : button("edit", "stroked grey", "Edit in the Playbook") + button("use", "primary blue", "Add to Voice profile");
  actionsEl.querySelector(".primary")?.focus({ preventScroll: true });
}

function useShown() {
  const net = modal.dataset.viFirst;
  if (!proposals.has(net)) return;
  saveNetworkVoice(ctxId, net, proposals.get(net));
  used.add(net);
  if (resultNets.every((n) => used.has(n))) {
    titleEl.textContent = "Added to your Voice profile";
    subEl.textContent = `I'll write for ${resultNets.length === 1 ? networkLabel(resultNets[0]) : "these networks"} with ${resultNets.length === 1 ? "its" : "their"} own rules from now on. You can change them anytime.`;
  }
  showLearned(resultNets.find((n) => !used.has(n)) || net);
}

function editShown() {
  const net = modal.dataset.viFirst;
  const voice = proposals.get(net);
  const id = ctxId;
  close();
  editNetworkVoiceInPlaybook(id, net, voice);
}

function seeVoices() {
  const id = ctxId;
  const ctx = getContextById(id);
  const nets = playbookNetworks(ctx);
  const net = modal.dataset.viFirst || nets.find((n) => networkVoice(ctx, n).state !== "own") || nets[0];
  close();
  navigate(`/playbook/${id}?tab=voice${net ? `&voice=${net}` : ""}`);
}

function close() {
  if (!modal) return;
  clearTimeout(timer);
  learning = false;
  proposals.clear();
  used.clear();
  resultNets = [];
  delete modal.dataset.viFirst;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
