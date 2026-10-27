// The voice intro (flag voicePerNetwork) — the first time someone meets « each
// network, its own voice », shown once, whichever door they come through:
//   · arriving in the app, for a Playbook with a network still on the Brand
//     voice → this dialog: the same post in each network's voice, then where
//     the Playbook stands and « Learn N voices » from the accounts' posts;
//   · the chat's Voice step (network-voice-flow.js), when the dialog never ran
//     → Archie's message carries the comparison (`voiceComparisonHtml`);
//   · the Voice profile tab → an infobox whose « Show me » opens this dialog;
//   · the creation review (a new user) → the comparison on its Voice tab, and
//     the save marks the intro seen, so the dialog never follows.
// One key, owned here: the first door marks it, the others stay as they are.
//
// Public API:
//   init() · maybeOpenVoiceIntro(path)
//   introSeen() · markIntroSeen() · resetIntro()
//   voiceComparisonHtml(ctx, { compact })
// Anything carrying [data-vi-open] opens the dialog (one delegated listener).

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2237";
import { getContextById } from "../contexts-store.js?v=2237";
import { playbookForNewWork } from "../active-playbook.js?v=2237";
import { isNewUser } from "../user-mode.js?v=2237";
import { networkLabel, networkIcon, profileForNetwork } from "../social-profiles.js?v=2237";
import { networkVoiceOn, networkVoice, playbookNetworks, canLearnFrom } from "../voice-parts.js?v=2237";
import { applyNetworkVoice } from "../network-voice-flow.js?v=2237";
import { NETWORK_VOICE_SAMPLE, NETWORK_VOICE_TRAITS } from "../mocks.js?v=2237";
import "../archie-pixels.js?v=2237";
import { navigate } from "../router.js?v=2237";
import { escapeHtml } from "../utils.js?v=2237";

const MODAL_ID = "voice-intro";
const KEY = "archie-voice-intro-seen";
const LEARN_MS = 1100;

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

// ── The comparison: one idea, the Brand voice, then each network's ──────────
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

// One post card — the dialog's stage, and the comparison's. `compact`: smaller
// type, no reserved height.
function postCardHtml(ctx, net, { compact = false } = {}) {
  const label = net === "brand" ? "Brand voice" : networkLabel(net);
  return `
    <article class="voice-intro__post${compact ? " voice-intro__post--compact" : ""}" aria-label="${escapeHtml(label)} post">
      <header class="voice-intro__post-head">
        <span class="voice-intro__avatar">${brandMark(ctx)}</span>
        <span class="voice-intro__who">
          <span class="voice-intro__who-name">${escapeHtml(brandOf(ctx))}</span>
          <span class="voice-intro__who-meta">${net === "brand" ? "Brand voice · any network" : escapeHtml(networkLabel(net))}</span>
        </span>
        ${net === "brand" ? "" : `<i class="${networkIcon(net)} voice-intro__post-net" aria-hidden="true"></i>`}
      </header>
      <p class="voice-intro__post-text">${wordsHtml(fill(NETWORK_VOICE_SAMPLE[net], ctx))}</p>
      ${traitsHtml(traitsOf(ctx, net))}
    </article>`;
}

// The comparison, where there's no room for the dialog's turn-by-turn post —
// the chat's first Voice step, the creation review: the same stage, the Brand
// voice's post over the networks' own, side by side. `compact` (the chat, whose
// thread repaints on every turn): no word-by-word replay.
export function voiceComparisonHtml(ctx, { compact = false } = {}) {
  return `
    <div class="voice-compare${compact ? " voice-compare--compact" : ""}">
      <archie-pixels data-quiet></archie-pixels>
      <div class="voice-compare__inner">
        <div class="voice-compare__brand">${postCardHtml(ctx, "brand", { compact: true })}</div>
        <span class="voice-intro__status ap-status mermaid">Rewritten for each network</span>
        <div class="voice-compare__nets">${comparisonNets(ctx)
          .map(
            (n, i) =>
              `<div class="voice-compare__net" style="--col:${i}">${postCardHtml(ctx, n, { compact: true })}</div>`,
          )
          .join("")}</div>
      </div>
    </div>`;
}

// ── The dialog ──────────────────────────────────────────────────────────────
// The first-time run's look (welcome-alt-intro.js): the words on the left, and
// on the right, on Archie's warm pixel field, the thing they're about.
//   Step 1 — one post on the stage, rewritten in turn for each network: the
//            Brand voice first, then each network's own, its traits under it.
//            The list on the left follows it, and picks one.
//   Step 2 — where the Playbook stands: on the left the networks to learn, on
//            the stage the Playbook's Voice profile filling as they're learned.

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
    const action = e.target.closest("[data-vi-action]")?.dataset.viAction;
    if (action === "close" || action === "done") close();
    else if (action === "next") renderStand();
    else if (action === "learn") learnChecked();
    else if (action === "see") seeVoices();
  });
  modal.addEventListener("change", (e) => e.target.closest("[data-vi-check]") && renderStandActions());
  bindOverlayDismissal({ modal, backdrop, close: () => !learning && close() });
}

// Arriving in the app: once, for a returning user whose Playbook still has a
// network on the Brand voice — and never over another dialog or the first run.
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
  titleEl.textContent = "Each network, its own voice";
  subEl.textContent =
    "One idea, written the way each network reads it. I learn each voice from your posts, and you can edit any of them in the Playbook.";
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
  const label = (n) => (n === "brand" ? "Brand voice" : networkLabel(n));
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
      net === "brand" ? "Written in the Brand voice" : `Rewritten for ${escapeHtml(networkLabel(net))}`
    }</div>
    ${postCardHtml(ctx, net)}`;
  clearTimeout(timer);
  if (manual) return;
  const next = voices[(voices.indexOf(net) + 1) % voices.length];
  timer = setTimeout(() => showVoice(next), net === "brand" ? CYCLE_MS - 1600 : CYCLE_MS);
}

// Step 2 — where the Playbook stands, and the voices to learn.
function stateText(ctx, net) {
  const { state, voice } = networkVoice(ctx, net);
  if (state === "own")
    return voice.optimizedBy === "you"
      ? "Edited by you"
      : voice.postCount
        ? `Learned from ${voice.postCount} posts of ${voice.learnedFrom}`
        : `Learned from ${voice.learnedFrom}`;
  const now = state === "plain" ? "Uses the Brand voice as it is" : "No voice yet";
  const account = profileForNetwork(net);
  return canLearnFrom(account)
    ? `${now} — I can learn it from ${account.postCount} posts of ${account.handle}`
    : `${now} — too few posts to learn from; a document or your edits can give it one`;
}

const learnable = (ctx, net) => networkVoice(ctx, net).state !== "own" && canLearnFrom(profileForNetwork(net));

function rowHtml(ctx, net) {
  const slot = learnable(ctx, net)
    ? `<label class="ap-checkbox-container"><input type="checkbox" value="${escapeHtml(net)}" data-vi-check checked aria-label="Learn the ${escapeHtml(networkLabel(net))} voice" /><i></i></label>`
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
// part only, one line per network: its traits once it has its own voice, the
// Brand voice as it is, or a quiet bar (breathing while it's being learned).
function cardFieldHtml(ctx, net, { pending = false, landing = false } = {}) {
  const { state, voice } = networkVoice(ctx, net);
  const value =
    state === "own"
      ? voice.optimizedBy === "you"
        ? `<span class="voice-intro__plain">As you set it</span>`
        : traitsHtml(NETWORK_VOICE_TRAITS[net] || [])
      : state === "plain" && !pending
        ? `<span class="voice-intro__plain">The Brand voice as it is</span>`
        : `<span class="voice-intro__bar"></span><span class="voice-intro__bar is-short"></span>`;
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
            <dt>Brand voice</dt>
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
    ? "Check the networks I should learn from their posts. The others keep the Brand voice until you give them one."
    : "A network without its own voice gets one from a document or your edits — both in the Playbook.";
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
      n === 1 ? "Learn 1 voice" : `Learn ${n} voices`
    }</button>`;
}

// One network after the other: « Reading … » on the left while its line on
// the card breathes, then the voice lands on the Playbook and its traits pop in.
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
    row.classList.add("is-learning");
    row.querySelector(".voice-intro__state").textContent = `Reading ${profileForNetwork(net).handle}'s posts…`;
    field().outerHTML = cardFieldHtml(getContextById(ctxId), net, { pending: true });
    setTimeout(() => {
      if (!learning) return;
      applyNetworkVoice(ctxId, net, "learn");
      const ctx = getContextById(ctxId);
      row.classList.remove("is-learning");
      row.querySelector(".voice-intro__slot").innerHTML =
        `<i class="ap-icon-check voice-intro__done" aria-hidden="true"></i>`;
      row.querySelector(".voice-intro__state").textContent = stateText(ctx, net);
      field().outerHTML = cardFieldHtml(ctx, net, { landing: true });
      step(rest);
    }, LEARN_MS);
  };
  step(nets);
}

function learned(nets) {
  learning = false;
  modal.dataset.viFirst = nets[0];
  titleEl.textContent = nets.length === 1 ? "1 voice learned" : `${nets.length} voices learned`;
  subEl.textContent =
    nets.length === 1
      ? `Every draft for ${networkLabel(nets[0])} now starts from its own voice. Open its tab in the Playbook to see — or change — what I learned.`
      : "Every draft for these networks now starts from its own voice. Open their tabs in the Playbook to see — or change — what I learned.";
  actionsEl.innerHTML = button("see", "stroked grey", "See the voices") + button("done", "primary blue", "Done");
  actionsEl.querySelector(".primary").focus({ preventScroll: true });
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
  delete modal.dataset.viFirst;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
