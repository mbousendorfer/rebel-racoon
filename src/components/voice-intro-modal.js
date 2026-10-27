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

import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=2233";
import { getContextById } from "../contexts-store.js?v=2233";
import { playbookForNewWork } from "../active-playbook.js?v=2233";
import { isNewUser } from "../user-mode.js?v=2233";
import { networkLabel, networkIcon, profileForNetwork } from "../social-profiles.js?v=2233";
import { networkVoiceOn, networkVoice, playbookNetworks, canLearnFrom } from "../voice-parts.js?v=2233";
import { applyNetworkVoice } from "../network-voice-flow.js?v=2233";
import { NETWORK_VOICE_SAMPLE } from "../mocks.js?v=2233";
import { navigate } from "../router.js?v=2233";
import { escapeHtml } from "../utils.js?v=2233";

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

export function voiceComparisonHtml(ctx, { compact = false } = {}) {
  const net = (n, i) => `
    <div class="voice-compare__net" style="--col:${i}">
      <span class="voice-compare__label"><i class="${networkIcon(n)}" aria-hidden="true"></i>${escapeHtml(networkLabel(n))}</span>
      <p class="voice-compare__post">${wordsHtml(fill(NETWORK_VOICE_SAMPLE[n], ctx))}</p>
    </div>`;
  return `
    <div class="voice-compare${compact ? " voice-compare--compact" : ""}">
      <div class="voice-compare__brand">
        <span class="voice-compare__label">Brand voice</span>
        <p class="voice-compare__post">${escapeHtml(fill(NETWORK_VOICE_SAMPLE.brand, ctx))}</p>
      </div>
      <div class="voice-compare__nets">${comparisonNets(ctx).map(net).join("")}</div>
    </div>`;
}

// ── The dialog ──────────────────────────────────────────────────────────────

let backdrop, modal, titleEl, bodyEl, footerEl;
let ctxId = null;
let learning = false;

const HTML = `
<div class="app-modal-backdrop" id="voiceIntroBackdrop" hidden></div>
<aside class="ap-dialog voice-intro-modal" id="voiceIntroModal" role="dialog" aria-modal="true"
  aria-labelledby="voiceIntroTitle" aria-hidden="true">
  <div class="ap-dialog-header">
    <span class="ap-dialog-title" id="voiceIntroTitle"></span>
  </div>
  <button class="ap-dialog-close" type="button" data-vi-action="close" aria-label="Close"><i class="ap-icon-close"></i></button>
  <div class="ap-dialog-content" id="voiceIntroBody"></div>
  <div class="ap-dialog-footer"><div class="ap-dialog-footer-right" id="voiceIntroFooter"></div></div>
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
  bodyEl = document.getElementById("voiceIntroBody");
  footerEl = document.getElementById("voiceIntroFooter");
  modal.addEventListener("click", (e) => {
    const action = e.target.closest("[data-vi-action]")?.dataset.viAction;
    if (action === "close" || action === "done") close();
    else if (action === "next") renderStand();
    else if (action === "learn") learnChecked();
    else if (action === "see") seeVoices();
  });
  modal.addEventListener("change", (e) => e.target.closest("[data-vi-check]") && renderStandFooter());
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
  setTimeout(() => footerEl.querySelector(".primary")?.focus({ preventScroll: true }), 0);
}

const button = (action, kind, label) =>
  `<button type="button" class="ap-button ${kind}" data-vi-action="${action}">${escapeHtml(label)}</button>`;

// Step 1 — the « aha »: the same idea, in each network's voice.
function renderSame(ctx) {
  modal.classList.remove("is-stand");
  titleEl.textContent = "Each network, its own voice";
  bodyEl.innerHTML = `
    <p class="voice-intro__lead">Same idea, written the way each network reads it. I learn each voice from your posts, and you can edit any of them in the Playbook.</p>
    ${voiceComparisonHtml(ctx)}`;
  footerEl.innerHTML = button("close", "ghost grey", "Not now") + button("next", "primary blue", "Next");
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
  const own = networkVoice(ctx, net).state === "own";
  const slot = learnable(ctx, net)
    ? `<label class="ap-checkbox-container"><input type="checkbox" value="${escapeHtml(net)}" data-vi-check checked aria-label="Learn the ${escapeHtml(networkLabel(net))} voice" /><i></i></label>`
    : "";
  return `
    <li class="voice-intro__net" data-vi-net="${escapeHtml(net)}">
      <span class="voice-intro__slot">${slot}</span>
      <i class="${networkIcon(net)} voice-intro__glyph" aria-hidden="true"></i>
      <span class="voice-intro__text">
        <span class="voice-intro__name">${escapeHtml(networkLabel(net))}</span>
        <span class="voice-intro__state">${escapeHtml(stateText(ctx, net))}</span>
      </span>
      <span class="voice-intro__tag">${own ? `<span class="ap-tag green mini">Own voice</span>` : ""}</span>
    </li>`;
}

function renderStand() {
  const ctx = getContextById(ctxId);
  if (!ctx) return close();
  modal.classList.add("is-stand");
  titleEl.textContent = `Here's where ${brandOf(ctx)} stands`;
  bodyEl.innerHTML = `
    <p class="voice-intro__lead">${
      playbookNetworks(ctx).some((n) => learnable(ctx, n))
        ? "Check the networks I should learn from their posts. The others keep the Brand voice until you give them one."
        : "A network without its own voice gets one from a document or your edits — both in the Playbook."
    }</p>
    <ul class="voice-intro__nets">${playbookNetworks(ctx)
      .map((n) => rowHtml(ctx, n))
      .join("")}</ul>`;
  renderStandFooter();
}

const checked = () => [...modal.querySelectorAll("[data-vi-check]:checked")].map((i) => i.value);

function renderStandFooter() {
  const ctx = getContextById(ctxId);
  if (!playbookNetworks(ctx).some((n) => learnable(ctx, n))) {
    footerEl.innerHTML = button("done", "ghost grey", "Later") + button("see", "primary blue", "Open the Playbook");
    return;
  }
  const n = checked().length;
  footerEl.innerHTML =
    button("done", "ghost grey", "Later") +
    `<button type="button" class="ap-button primary orange" data-vi-action="learn" ${n ? "" : "disabled"}>${
      n === 1 ? "Learn 1 voice" : `Learn ${n} voices`
    }</button>`;
}

// One network after the other: « Reading … », then the voice lands on the
// Playbook and its tag pops in.
function learnChecked() {
  const nets = checked();
  if (!nets.length || learning) return;
  learning = true;
  footerEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
  modal.querySelectorAll("[data-vi-check]").forEach((i) => (i.disabled = true));
  const step = ([net, ...rest]) => {
    if (!net) return learned(nets);
    const row = modal.querySelector(`[data-vi-net="${net}"]`);
    const account = profileForNetwork(net);
    row.classList.add("is-learning");
    row.querySelector(".voice-intro__state").textContent = `Reading ${account.handle}'s posts…`;
    setTimeout(() => {
      if (!learning) return;
      applyNetworkVoice(ctxId, net, "learn");
      row.classList.remove("is-learning");
      row.querySelector(".voice-intro__slot").innerHTML = "";
      row.querySelector(".voice-intro__state").textContent = stateText(getContextById(ctxId), net);
      row.querySelector(".voice-intro__tag").innerHTML =
        `<span class="ap-tag green mini voice-intro__pop">Own voice</span>`;
      step(rest);
    }, LEARN_MS);
  };
  step(nets);
}

function learned(nets) {
  learning = false;
  modal.dataset.viFirst = nets[0];
  titleEl.textContent = nets.length === 1 ? "1 voice learned" : `${nets.length} voices learned`;
  bodyEl.querySelector(".voice-intro__lead").textContent =
    nets.length === 1
      ? `Every draft for ${networkLabel(nets[0])} now starts from its own voice. Open its tab in the Playbook to see — or change — what I learned.`
      : "Every draft for these networks now starts from its own voice. Open their tabs in the Playbook to see — or change — what I learned.";
  footerEl.innerHTML = button("see", "stroked grey", "See the voices") + button("done", "primary blue", "Done");
  footerEl.querySelector(".primary").focus({ preventScroll: true });
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
  learning = false;
  delete modal.dataset.viFirst;
  modal.classList.remove("open");
  backdrop.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  document.body.classList.remove("has-modal");
  notifyClose(MODAL_ID);
}
