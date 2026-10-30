// The voice intro (flag voicePerNetwork) — the first time a returning user
// meets « each network, its own voice », shown once:
//   · arriving in the app, for a Playbook with a network on the default voice
//     → this dialog: one post rewritten for each network's voice — starting
//     from the default network's, the voice every network starts from — then
//     where the Playbook stands, then « Personalize X », one network at a
//     time (its posts, five questions, by hand, or keep the default voice),
//     each proposal shown, then added or edited, like everywhere else;
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

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2594";
import { getContextById } from "../contexts-store.js?v=2594";
import { playbookForNewWork } from "../active-playbook.js?v=2594";
import { isNewUser } from "../user-mode.js?v=2594";
import { networkLabel, networkIcon } from "../social-profiles.js?v=2594";
import {
  networkVoiceOn,
  networkVoice,
  voiceNetworks,
  voiceParts,
  cloneItems,
  baseValue,
  voiceItemsHtml,
  voiceNetTagHtml,
} from "../voice-parts.js?v=2594";
import {
  proposeNetworkVoice,
  saveNetworkVoice,
  useDefaultVoice,
  editNetworkVoiceInPlaybook,
  voiceChoices,
  INTERVIEW,
  learnPhases,
  LEARN_PHASE_MS,
} from "../network-voice-flow.js?v=2594";
import { NETWORK_VOICE_SAMPLE, NETWORK_VOICE_TRAITS } from "../mocks.js?v=2594";
import "../archie-pixels.js?v=2594";
import { navigate } from "../router.js?v=2594";
import { escapeHtml } from "../utils.js?v=2594";

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
  const own = voiceNetworks(ctx).filter((n) => NETWORK_VOICE_SAMPLE[n]);
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
  const isBase = net === "brand";
  const label = net === "brand" ? "Default voice" : networkLabel(net);
  return `
    <article class="voice-intro__post" aria-label="${escapeHtml(label)} post">
      <header class="voice-intro__post-head">
        <span class="voice-intro__avatar">${brandMark(ctx)}</span>
        <span class="voice-intro__who">
          <span class="voice-intro__who-name">${escapeHtml(brandOf(ctx))}</span>
          <span class="voice-intro__who-meta">${isBase ? "Default voice · every network" : escapeHtml(label)}</span>
        </span>
        ${net === "brand" ? "" : `<i class="${networkIcon(net)} voice-intro__post-net" aria-hidden="true"></i>`}
      </header>
      <p class="voice-intro__post-text">${wordsHtml(fill(NETWORK_VOICE_SAMPLE[net] || NETWORK_VOICE_SAMPLE.brand, ctx))}</p>
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
      <p class="voice-edit__rest">${only ? `Your other ${label} rules stay as they are.` : `Everything else comes from your default voice.`}</p>
    </section>`;
  return `<div class="voice-edit">${card}</div>`;
}

// ── The Voice step, in the thread ──────────────────────────────────────────
// A network with no rules of its own, before a draft for it (or « Add rules
// for X » on one): a sibling of the voice edit — on butter, Archie says what's
// missing and what rules for the network cover; on white, the ways to add
// them — the best one first, a full-width tile, recommended; the others as a
// quiet two-column list below — then the way out, the default voice (the
// default answer) last, at the far right. Once answered, it folds to its
// title line (the answer is the user's turn below it).
// `line` replaces Archie's sentence; `later` names the way out (null: none —
// the creation review, where leaving it is the answer).
export function voiceAskHtml(
  ctx,
  net,
  { id, choices = [], giving = false, resolved = false, line = null, later = "Not now" },
) {
  const label = escapeHtml(networkLabel(net));
  const traits = NETWORK_VOICE_TRAITS[net] || [];
  // What a rule for the network looks like — examples, each one its own chip.
  const examples = traits.length
    ? `<div class="voice-ask__examples">
        <p class="voice-ask__label">A ${label} voice would say things like</p>
        <ul class="voice-ask__chips">${traits.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>`
    : "";
  const tiles = choices.filter((c) => c.tile);
  const hasDefault = choices.some((c) => c.value === "default");
  const pick = (value) => `data-voice-ask="${escapeHtml(id)}" data-voice-choice="${value}"`;
  return `
    <div class="voice-edit voice-ask${resolved ? " is-resolved" : ""}">
      <section class="voice-edit__card" aria-label="Voice for ${label}">
        <div class="voice-edit__say">
          <header class="voice-edit__head">
            <span class="voice-edit__net" aria-hidden="true"><i class="${networkIcon(net)}"></i></span>
            <span class="voice-edit__title"><span class="voice-edit__name">No ${label} voice yet</span></span>
          </header>
          ${
            resolved
              ? ""
              : `<p class="voice-edit__line">${
                  line
                    ? escapeHtml(line)
                    : giving
                      ? `These drafts are written in your default voice.`
                      : `I'd write for ${label} in your default voice — what works there may not work on ${label}.`
                }</p>`
          }
        </div>
        ${
          resolved
            ? ""
            : `<div class="voice-ask__body">
          ${examples}
          ${
            tiles.length
              ? `<p class="voice-ask__label">How should I add them?</p>
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
            .join("")}</div>`
              : ""
          }
          <div class="voice-ask__foot">
            ${later ? `<button type="button" class="ap-button ghost grey" ${pick("cancel")}>${escapeHtml(later)}</button>` : ""}
            ${hasDefault ? `<button type="button" class="ap-button stroked blue" ${pick("default")}>Use my default voice</button>` : ""}
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
    const way = e.target.closest("[data-vi-way]");
    if (way) return pickWay(way.dataset.viWay);
    const action = e.target.closest("[data-vi-action]")?.dataset.viAction;
    if (action === "close" || action === "done") close();
    else if (action === "next") renderStand();
    else if (action === "start") {
      queue = picked();
      qi = 0;
      if (queue.length) renderPersonalize();
    } else if (action === "see") seeVoices();
    else if (action === "keep") {
      useDefaultVoice(ctxId, queue[qi]);
      nextNetwork("kept");
    } else if (action === "later") nextNetwork("later");
    else if (action === "keep-own") nextNetwork("kept");
    else if (action === "back-net") {
      if (qi === 0) return renderStand();
      qi -= 1;
      renderPersonalize();
    } else if (action === "back") renderPersonalize();
    else if (action === "answers") submitForm();
    else if (action === "use") {
      saveNetworkVoice(ctxId, queue[qi], proposal);
      nextNetwork("added");
    } else if (action === "edit") {
      const id = ctxId;
      const net = queue[qi];
      const voice = proposal;
      close();
      editNetworkVoiceInPlaybook(id, net, voice);
    }
  });
  modal.addEventListener("change", (e) => e.target.closest("[data-vi-pick]") && renderStandActions());
  bindOverlayDismissal({ modal, backdrop, close: () => !learning && close() });
}

// Arriving in the app: once, for a returning user whose Playbook still has a
// network on the default voice — and never over another dialog or the first run.
export function maybeOpenVoiceIntro(path) {
  if (!networkVoiceOn() || introSeen() || isNewUser() || document.body.classList.contains("has-modal")) return;
  if (path.startsWith("/welcome-alt")) return;
  const ctx = playbookForNewWork();
  if (!ctx || !voiceNetworks(ctx).some((n) => networkVoice(ctx, n).state !== "own")) return;
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
  subEl.textContent = `Your default voice is how ${brandOf(ctx)} sounds, on no network in particular. Each network adapts it its own way: I add what works there, and you review it before it's saved.`;
  actionsEl.innerHTML = button("close", "ghost grey", "Not now") + button("next", "primary blue", "Next");
  showVoice("brand");
}

// The list on the left and the post on the stage, for one voice. Unless the
// user picked one, the stage moves on to the next by itself.
function showVoice(net, { manual = false } = {}) {
  const ctx = getContextById(ctxId);
  if (!ctx || modal.classList.contains("is-stand")) return;
  const base = "brand";
  const voices = [base, ...comparisonNets(ctx)];
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
              <span class="voice-intro__voice-hint">${escapeHtml(n === base ? "Your default voice — every network starts from it" : traitsOf(ctx, n).join(" · "))}</span>
            </span>
          </button></li>`,
        )
        .join("")}
    </ul>`;
  stageEl.innerHTML = `
    <div class="voice-intro__status ap-status ${net === base ? "grey" : "mermaid"}" data-vi-status>${
      net === base ? "Your default voice" : `Rewritten for ${escapeHtml(networkLabel(net))}`
    }</div>
    ${postCardHtml(ctx, net)}`;
  clearTimeout(timer);
  if (manual) return;
  const next = voices[(voices.indexOf(net) + 1) % voices.length];
  timer = setTimeout(() => showVoice(next), net === base ? CYCLE_MS - 1600 : CYCLE_MS);
}

// Step 2 — where the Playbook stands: the default voice, which every network
// starts from, then each network — its own rules, or the default voice.
// « Personalize » then walks them, one network at a time: pick a way (its
// posts, the default voice adapted, five questions, by hand) or keep the
// default voice; what Archie learns is shown and added — or edited — before the next.
let queue = []; // the networks to personalize, in order
let qi = 0;
let proposal = null; // the voice proposed for queue[qi], not saved
const outcome = new Map(); // net → "added" | "kept" | "later"

function stateText(ctx, net) {
  const { state, voice } = networkVoice(ctx, net);
  if (outcome.get(net) === "added") return "Its own voice, just added";
  if (state === "own")
    return voice.optimizedBy === "you"
      ? "Its own voice, written by you"
      : voice.postCount
        ? `Its own voice, from ${voice.postCount} posts of ${voice.learnedFrom}`
        : `Its own voice, from ${voice.learnedFrom}`;
  return `Uses your default voice`;
}

// `pick`: a checkbox to choose whether to personalize it — checked when it
// still writes in the default voice.
function rowHtml(ctx, net, { pick = false } = {}) {
  const { state } = networkVoice(ctx, net);
  const box = pick
    ? `<label class="ap-checkbox-container"><input type="checkbox" value="${escapeHtml(net)}" data-vi-pick ${
        state === "default" ? "checked" : ""
      } aria-label="Personalize ${escapeHtml(networkLabel(net))}" /><i></i></label>`
    : "";
  return `
    <li class="voice-intro__net" data-vi-net="${escapeHtml(net)}">
      ${pick ? `<span class="voice-intro__slot">${box}</span>` : ""}
      ${glyphTile(net)}
      <span class="voice-intro__text">
        <span class="voice-intro__name">${escapeHtml(networkLabel(net))}</span>
        <span class="voice-intro__state">${escapeHtml(stateText(ctx, net))}</span>
      </span>
    </li>`;
}

const rowsHtml = (ctx, opts) =>
  `<ul class="voice-intro__nets">${voiceNetworks(ctx)
    .map((n) => rowHtml(ctx, n, opts))
    .join("")}</ul>`;

// The networks checked to personalize, in the Playbook's order.
const picked = () => [...leftEl.querySelectorAll("[data-vi-pick]:checked")].map((i) => i.value);

function renderStandActions() {
  const ctx = getContextById(ctxId);
  if (!voiceNetworks(ctx).length) {
    actionsEl.innerHTML = button("done", "primary blue", "Done");
    return;
  }
  const nets = picked();
  const label =
    nets.length === 1
      ? `Personalize ${networkLabel(nets[0])}`
      : nets.length
        ? `Personalize ${nets.length} networks`
        : "Personalize";
  actionsEl.innerHTML =
    button("done", "ghost grey", "Later") +
    `<button type="button" class="ap-button primary orange" data-vi-action="start"${nets.length ? "" : " disabled"}>${escapeHtml(label)}</button>`;
}

// The Playbook card on the stage — the first-time run's, its Voice profile
// part only: the default voice with the Brand's traits, then one line per
// network — its own rules with its traits, or the default voice; a quiet bar
// while one is being learned.
function cardFieldHtml(ctx, net, { pending = false } = {}) {
  const { state, voice } = networkVoice(ctx, net);
  const value = pending
    ? `<span class="voice-intro__bar"></span><span class="voice-intro__bar is-short"></span>`
    : state === "own" && voice.optimizedBy !== "you"
      ? traitsHtml(NETWORK_VOICE_TRAITS[net] || [])
      : state === "own"
        ? `<span class="voice-intro__plain">As you set it</span>`
        : `<span class="voice-intro__plain">Your default voice</span>`;
  return `
    <div class="voice-intro__field${pending ? " is-pending" : ""}" data-vi-field="${escapeHtml(net)}">
      <dt><i class="${networkIcon(net)}" aria-hidden="true"></i>${escapeHtml(networkLabel(net))}</dt>
      <dd>${value}</dd>
    </div>`;
}

function renderCard(ctx, { pending = null } = {}) {
  stageEl.classList.remove("is-result");
  const fields = `<div class="voice-intro__field"><dt>Default voice</dt><dd>${traitsHtml(brandTraits(ctx))}</dd></div>`;
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
          ${fields}${voiceNetworks(ctx)
            .map((n) => cardFieldHtml(ctx, n, { pending: n === pending }))
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
  modal.classList.remove("is-personalize");
  qi = 0;
  const waiting = voiceNetworks(ctx).filter((n) => networkVoice(ctx, n).state === "default");
  titleEl.textContent = `Here's where ${brandOf(ctx)} stands`;
  subEl.textContent = waiting.length
    ? `Every network starts from your default voice. Check the ones to personalize now — one at a time, about a minute each. You review every change before it's saved.`
    : `Every network has a voice of its own. Check one to personalize it again, or keep them as they are.`;
  leftEl.innerHTML = rowsHtml(ctx, { pick: true });
  renderCard(ctx);
  renderStandActions();
}

// One network: the ways to adapt the default voice to it, the best first —
// its posts when it has enough, the default voice adapted, five questions, by
// hand — or keep it as is.
function renderPersonalize() {
  const ctx = getContextById(ctxId);
  const net = queue[qi];
  if (!ctx || !net) return renderDone();
  proposal = null;
  modal.classList.add("is-personalize");
  const label = networkLabel(net);
  titleEl.textContent = `Personalize ${label}`;
  // A network that already has rules of its own is personalized again; one on
  // the default voice gets its first.
  const hasOwn = networkVoice(ctx, net).state === "own";
  subEl.textContent = `${queue.length > 1 ? `${qi + 1} of ${queue.length} · ` : ""}${
    hasOwn
      ? `${label} has its own voice, ${stateText(ctx, net).replace(/^Its own voice, /, "")}. How should I update it?`
      : `${label} uses your default voice for now. How should I adapt it to ${label}?`
  }`;
  const ways = voiceChoices(net).items.filter((i) => ["learn", "adapt", "interview", "edit"].includes(i.value));
  leftEl.innerHTML = `
    <ul class="voice-intro__voices" aria-label="Ways to personalize ${escapeHtml(label)}">
      ${ways
        .map(
          (w, i) => `<li><button type="button" class="voice-intro__voice" data-vi-way="${w.value}">
            <span class="voice-intro__tile" aria-hidden="true"><i class="${w.icon}"></i></span>
            <span class="voice-intro__voice-text">
              <span class="voice-intro__voice-name">${escapeHtml(w.tile)}</span>
              <span class="voice-intro__voice-hint">${escapeHtml(w.hint)}</span>
            </span>
            ${i ? "" : `<span class="ap-tag green mini voice-intro__best"><span>Recommended</span></span>`}
          </button></li>`,
        )
        .join("")}
    </ul>
    ${
      hasOwn
        ? `<button type="button" class="ap-link voice-intro__keep" data-vi-action="keep-own">Keep its current rules</button>`
        : `<button type="button" class="ap-link voice-intro__keep" data-vi-action="keep">Keep my default voice on ${escapeHtml(label)}</button>`
    }`;
  stageEl.classList.remove("is-result");
  stageEl.innerHTML = `
    <div class="voice-intro__status ap-status mermaid">How your ${escapeHtml(label)} posts could read</div>
    ${postCardHtml(ctx, net)}`;
  // Back: the previous network, or where the Playbook stands. Later: this
  // network waits for the Playbook (its Voice profile tab) — on to the next.
  actionsEl.innerHTML =
    button("back-net", "ghost grey", "Back") + button("later", "stroked grey", "Later, in the Playbook");
}

// Learning takes a moment (its phases on the stage), then the proposal.
function learnWay(choice, from = null) {
  const ctx = getContextById(ctxId);
  const net = queue[qi];
  learning = true;
  leftEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
  actionsEl.innerHTML = "";
  const phases = learnPhases(net, from, choice);
  stageEl.classList.remove("is-result");
  stageEl.innerHTML = `<p class="voice-intro__phase" data-vi-phase>${escapeHtml(phases[0])}</p>`;
  phases.slice(1).forEach((p, i) =>
    setTimeout(
      () => {
        const el = stageEl.querySelector("[data-vi-phase]");
        if (learning && el) el.textContent = p;
      },
      LEARN_PHASE_MS * (i + 1),
    ),
  );
  setTimeout(() => {
    if (!learning) return;
    learning = false;
    proposal = proposeNetworkVoice(ctx, net, choice, from);
    showProposal();
  }, LEARN_PHASE_MS * phases.length);
}

// The five questions, on the stage — one per Voice profile section.
function renderForm() {
  const net = queue[qi];
  const label = networkLabel(net);
  stageEl.classList.add("is-result");
  stageEl.innerHTML = `
    <form class="voice-intro__form" data-vi-form>
      ${INTERVIEW.map(
        (q) => `<div class="ap-form-field">
          <label for="vi-${q.key}"><span class="voice-intro__form-part">${escapeHtml(q.title)}</span>${escapeHtml(q.ask(label))}</label>
          <div class="ap-textarea-field resizable"><textarea id="vi-${q.key}" rows="2" data-vi-answer="${q.key}"></textarea></div>
        </div>`,
      ).join("")}
    </form>`;
  actionsEl.innerHTML = button("back", "ghost grey", "Back") + button("answers", "primary orange", "Write the voice");
  setTimeout(() => stageEl.querySelector("textarea")?.focus({ preventScroll: true }), 0);
}

function submitForm() {
  const answers = Object.fromEntries(
    [...stageEl.querySelectorAll("[data-vi-answer]")]
      .map((t) => [t.dataset.viAnswer, t.value.trim()])
      .filter(([, v]) => v),
  );
  if (!Object.keys(answers).length) return stageEl.querySelector("textarea")?.focus();
  learnWay("interview", answers);
}

function showProposal() {
  const ctx = getContextById(ctxId);
  const net = queue[qi];
  stageEl.classList.add("is-result");
  stageEl.innerHTML = learnedVoiceHtml(ctx, net, proposal, { pending: true });
  actionsEl.innerHTML =
    button("back", "ghost grey", "Back") +
    button("edit", "stroked grey", "Edit in the Playbook") +
    button("use", "primary blue", "Add to Voice profile");
  actionsEl.querySelector(".primary").focus({ preventScroll: true });
}

function nextNetwork(result) {
  outcome.set(queue[qi], result);
  qi += 1;
  renderPersonalize();
}

function pickWay(way) {
  const net = queue[qi];
  if (way === "learn" || way === "adapt") return learnWay(way);
  if (way === "interview") return renderForm();
  const id = ctxId;
  close();
  editNetworkVoiceInPlaybook(id, net);
}

function renderDone() {
  const ctx = getContextById(ctxId);
  modal.classList.remove("is-personalize");
  const added = [...outcome].filter(([, r]) => r === "added").map(([n]) => networkLabel(n));
  titleEl.textContent = added.length ? "Added to your Voice profile" : "All set";
  // Who still writes in the default voice, said as it is.
  const still = voiceNetworks(ctx)
    .filter((n) => networkVoice(ctx, n).state === "default")
    .map((n) => networkLabel(n));
  const rest = still.length
    ? `${still.join(" and ")} ${still.length === 1 ? "writes" : "write"} in your default voice for now: personalize ${still.length === 1 ? "it" : "them"} anytime from its Voice profile tab.`
    : "Every network has a voice of its own.";
  subEl.textContent = added.length
    ? `${added.join(" and ")} ${added.length === 1 ? "has its own voice" : "have their own voices"} now. ${rest}`
    : rest;
  leftEl.innerHTML = rowsHtml(ctx);
  renderCard(ctx);
  actionsEl.innerHTML = button("see", "stroked grey", "See the Voice profile") + button("done", "primary blue", "Done");
  actionsEl.querySelector(".primary").focus({ preventScroll: true });
}

function seeVoices() {
  const id = ctxId;
  const ctx = getContextById(id);
  const nets = voiceNetworks(ctx);
  const added = [...outcome].filter(([, r]) => r === "added").map(([n]) => n);
  const net = added[added.length - 1] || nets.find((n) => networkVoice(ctx, n).state !== "own") || null;
  close();
  navigate(`/playbook/${id}?tab=voice${net ? `&voice=${net}` : ""}`);
}

function close() {
  if (!modal) return;
  clearTimeout(timer);
  learning = false;
  queue = [];
  qi = 0;
  proposal = null;
  outcome.clear();
  modal.classList.remove("is-stand", "is-personalize");
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
