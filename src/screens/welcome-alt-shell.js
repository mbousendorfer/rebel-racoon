// The onboarding shell — flag connectFirst. Every screen of the first-time
// flow (connect → brand → language → network → documents → ready) is the same
// split: the step on the left, Archie's stage on the right, where the Playbook
// card fills in with the user's REAL answers as they go — the connected
// profiles, the site's name and voice once it's read, the colours. The intro
// (/welcome-alt/intro) shows the same card filled with an example.
//
// One draft for the whole run, in context-builder (createAltDraft…), keyed by
// the session id the recap already uses (`welcomeAltSessionId`), and persisted
// on every change so a reload lands on the same step with the same answers.

import "../archie-pixels.js?v=1931";
import { html, raw, escapeHtml } from "../utils.js?v=1931";
import { navigate } from "../router.js?v=1931";
import { isFlagOn } from "../feature-flags.js?v=1931";
import {
  altSteps,
  createAltDraft,
  getDraft,
  isAnalysisReady,
  restoreDraft,
  subscribeDraft,
} from "../context-builder.js?v=1931";
import {
  NETWORK_ICON_BY_PLATFORM,
  NETWORK_LABEL,
  BRAND_INITIALS,
  getConnectedProfiles,
  subscribe as subscribeProfiles,
} from "../social-profiles.js?v=1931";
import { networkVoicesOn } from "../network-voice.js?v=1931";
import { readSessionId, persistDraft, readPersistedDraft } from "./welcome-alt-recap.js?v=1931";

const PREFILLED_URL = "https://nicesoap.com";
const SESSION_KEY = "welcomeAltSessionId";

// What each step is called, everywhere it's named (the intro's list, the
// progress, each screen's title).
export const STEP_TEXT = {
  connect: { title: "Connect your social profiles", desc: "So I write for the networks you publish on." },
  url: { title: "Show me your brand", desc: "Your website, a few files, or a handful of questions." },
  language: { title: "Pick your language", desc: "The one I'll write your posts in." },
  network: { title: "Choose your main network", desc: "Your main voice is built for it." },
  documents: { title: "Add your documents", desc: "Optional — a brand book or guidelines." },
  recap: { title: "Meet your Playbook", desc: "Everything I learned, before I write a word." },
};

const ROUTE = {
  connect: "/welcome-alt/connect",
  url: "/welcome-alt/brand",
  language: "/welcome-alt/language",
  network: "/welcome-alt/network",
  documents: "/welcome-alt/documents",
  recap: "/welcome-alt/ready",
};

// The run, in order, under the flags of the moment: the account screen, the
// chat's own steps (the account step is the first screen here), the reveal.
export function flowSteps() {
  return ["connect", ...altSteps().filter((id) => ROUTE[id]), "recap"];
}

function goTo(step) {
  navigate(ROUTE[step]);
}
export function goNext(step) {
  const steps = flowSteps();
  goTo(steps[steps.indexOf(step) + 1] || "recap");
}
export function goBack(step) {
  const steps = flowSteps();
  const prev = steps[steps.indexOf(step) - 1];
  if (prev) goTo(prev);
  else navigate("/welcome-alt/intro");
}

// A fresh run — from the intro's "Let's go".
export function startFlow() {
  const sid = `welcome-alt-${Date.now().toString(36)}`;
  try {
    window.sessionStorage.setItem(SESSION_KEY, sid);
    window.sessionStorage.removeItem("welcomeAltIntegrated");
    window.sessionStorage.removeItem("welcomeAltReturnTo");
  } catch {
    /* ignore */
  }
  createAltDraft(sid, { prefilledUrl: PREFILLED_URL });
  persistDraft(sid);
  return sid;
}

// The run's draft: the live one, else the one saved before a reload, else a new
// run (a deep link straight onto a step).
export function ensureFlowDraft() {
  const sid = readSessionId();
  if (sid && getDraft(sid)) return sid;
  const snap = sid && readPersistedDraft(sid);
  if (snap) {
    restoreDraft(sid, snap);
    return sid;
  }
  return startFlow();
}

// ── The live card ─────────────────────────────────────────────────────────

const landed = new Set(); // `${sid}:${row}` already shown filled — it lands once, not on every step

const domainOf = (url) =>
  String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const glyph = (net) =>
  `<span class="welcome-intro__net" title="${escapeHtml(NETWORK_LABEL[net] || net)}"><i class="${NETWORK_ICON_BY_PLATFORM[net]}" aria-hidden="true"></i></span>`;

function avatar(p) {
  const inner = p.photo
    ? `<img src="${escapeHtml(p.photo)}" alt="" />`
    : `<span class="ap-avatar-initials">${escapeHtml(p.initials || BRAND_INITIALS)}</span>`;
  const badge = NETWORK_ICON_BY_PLATFORM[p.platform]
    ? `<span class="ap-avatar-network"><i class="${NETWORK_ICON_BY_PLATFORM[p.platform]}"></i></span>`
    : "";
  return `<span class="ap-avatar size-32" title="${escapeHtml(p.name || p.handle || "")}">${inner}${badge}</span>`;
}

// Each line of the card: empty (a quiet placeholder), pending (being learned)
// or filled.
function cardRows(d, sid) {
  const pending = Boolean(d?.analysisStartedAt) && !isAnalysisReady(sid);
  const state = (filled) => (filled ? "filled" : pending ? "pending" : "empty");
  const rows = [];
  const profiles = getConnectedProfiles();
  rows.push({
    key: "profiles",
    label: "Publishes on",
    state: profiles.length ? "filled" : "empty",
    value: profiles.map(avatar).join(""),
  });
  const traits = (d?.voiceProfile?.headline || "")
    .split(/\s*·\s*/)
    .filter(Boolean)
    .slice(0, 3);
  const voice = traits.length ? traits : (d?.tones || []).slice(0, 2);
  rows.push({
    key: "voice",
    label: "Voice",
    state: state(voice.length),
    value: voice.map((t) => `<span class="welcome-intro__trait">${escapeHtml(t)}</span>`).join(""),
  });
  const audience = d?.audience?.[0];
  rows.push({
    key: "audience",
    label: "Speaks to",
    state: state(Boolean(audience)),
    value: audience ? `<span class="welcome-flow__line">${escapeHtml(audience)}</span>` : "",
  });
  if (isFlagOn("multilingualPlaybook")) {
    const lang = d?.primaryLanguage || (d?.languages || [])[0];
    rows.push({
      key: "language",
      label: "Writes in",
      state: lang ? "filled" : "empty",
      value: lang ? `<span class="welcome-intro__plain">${escapeHtml(lang)}</span>` : "",
    });
  }
  if (networkVoicesOn()) {
    const base = d?.voiceBaseNetwork;
    rows.push({
      key: "network",
      label: "Main voice",
      state: base ? "filled" : "empty",
      value: base
        ? `${glyph(base)}<span class="welcome-intro__plain">${escapeHtml(NETWORK_LABEL[base] || base)}</span>`
        : "",
    });
  }
  const colors = [...new Set((d?.brandColors || []).map((c) => c.hex).filter(Boolean))].slice(0, 5);
  rows.push({
    key: "branding",
    label: "Branding",
    state: state(colors.length),
    value: colors
      .map((hex) => `<span class="welcome-intro__swatch" style="background: ${escapeHtml(hex)}"></span>`)
      .join(""),
  });
  return { rows };
}

function renderCard(sid) {
  const d = getDraft(sid);
  const { rows } = cardRows(d, sid);
  // "Ready" belongs to the reveal (/welcome-alt/ready sets `revealed`); until
  // then a read source is still being learned, whatever has landed already.
  const ready = d?.revealed === true;
  const learning = !ready && Boolean(d?.analysisStartedAt);
  // Revealed, the card shows what it knows: a line still empty then (a skipped
  // account, no colours from an interview) would read as unfinished.
  const shownRows = ready ? rows.filter((r) => r.state === "filled") : rows;
  // The site only while it's the source — not on the interview or files path.
  const domain = d?.sourceType === "website" && !d?.pendingInterview?.length ? domainOf(d.websiteUrl) : "";
  const name = (d?.name && d.name !== "New Playbook" ? d.name : "") || "Your Playbook";
  const mark = d?.brandLogo
    ? `<img src="${escapeHtml(d.brandLogo)}" alt="" />`
    : d?.name && d.name !== "New Playbook"
      ? escapeHtml(d.name.slice(0, 1).toUpperCase())
      : `<i class="ap-icon-buildings" aria-hidden="true"></i>`;
  return html`
    <div class="welcome-intro__card-head">
      <span class="welcome-intro__brand">${raw(mark)}</span>
      <span class="welcome-flow__card-name">
        <span class="welcome-intro__card-title">${name}</span>
        ${domain ? raw(`<span class="welcome-flow__card-sub">${escapeHtml(domain)}</span>`) : ""}
      </span>
    </div>
    <dl class="welcome-intro__rows">
      ${shownRows.map((r) => {
        const id = `${sid}:${r.key}`;
        const fresh = r.state === "filled" && !landed.has(id);
        if (r.state === "filled") landed.add(id);
        else landed.delete(id);
        return html`
          <div class="welcome-intro__row welcome-flow__row is-${r.state} ${fresh ? "is-new" : ""}">
            <dt>${r.label}</dt>
            <dd>${r.state === "filled" ? raw(r.value) : raw(`<span class="welcome-flow__placeholder"></span>`)}</dd>
          </div>
        `;
      })}
    </dl>
    <div class="welcome-intro__card-foot welcome-flow__foot">
      ${ready
        ? raw(`<span class="ap-status mermaid">Ready to write</span>`)
        : learning
          ? raw(`<span class="ap-status mermaid is-working">Learning your brand…</span>`)
          : ""}
    </div>
  `;
}

function renderProgress(step) {
  const steps = flowSteps();
  const at = steps.indexOf(step);
  return html`
    <div class="welcome-flow__progress" aria-label="Step ${at + 1} of ${steps.length}">
      <ol class="welcome-flow__dots" aria-hidden="true">
        ${steps.map(
          (id, i) => html`
            <li
              class="welcome-flow__dot ${i < at ? "is-done" : i === at ? "is-current" : ""}"
              title="${STEP_TEXT[id].title}"
            >
              ${i < at ? raw(`<i class="ap-icon-check"></i>`) : i + 1}
            </li>
          `,
        )}
      </ol>
      <span class="welcome-flow__count">${at + 1} of ${steps.length}</span>
    </div>
  `;
}

// Paint the shell into `target` once; `left()` is repainted by `paint()`, the
// card on every change to the draft or to the connected accounts.
// Returns { paint, cleanup }.
export function mountShell(target, { step, sid, left }) {
  target.innerHTML = html`
    <div class="welcome-intro welcome-flow">
      <section class="welcome-intro__lede" aria-labelledby="welcomeFlowTitle">
        <div class="welcome-flow__top">
          <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
          ${raw(renderProgress(step))}
        </div>
        <div class="welcome-intro__copy welcome-flow__copy" data-flow-left></div>
      </section>
      <div class="welcome-intro__stage" aria-hidden="true">
        <archie-pixels data-quiet></archie-pixels>
        <div class="welcome-intro__card welcome-flow__card" data-flow-card></div>
      </div>
    </div>
  `;
  const leftEl = target.querySelector("[data-flow-left]");
  const cardEl = target.querySelector("[data-flow-card]");
  const paintCard = () => {
    cardEl.innerHTML = renderCard(sid);
  };
  const paint = () => {
    leftEl.innerHTML = left();
  };
  paint();
  paintCard();
  const offDraft = subscribeDraft(sid, () => {
    persistDraft(sid);
    paintCard();
  });
  const offProfiles = subscribeProfiles(paintCard);
  return {
    paint,
    paintCard,
    cleanup: () => {
      offDraft();
      offProfiles();
    },
  };
}
