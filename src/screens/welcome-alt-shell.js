// The onboarding shell — flag connectFirst. Every screen of the first-time
// flow (connect → brand → language → documents → ready) is the same
// split: the step on the left, Archie's stage on the right, where the Playbook
// card fills in with the user's REAL answers as they go — the connected
// profiles, the site's name and voice once it's read, the colours. The intro
// (/welcome-alt/intro) shows the same card filled with an example.
//
// One draft for the whole run, in context-builder (createAltDraft…), keyed by
// the session id the recap already uses (`welcomeAltSessionId`), and persisted
// on every change so a reload lands on the same step with the same answers.

import "../archie-pixels.js?v=2267";
import { html, raw, escapeHtml } from "../utils.js?v=2267";
import { navigate } from "../router.js?v=2267";
import { isFlagOn } from "../feature-flags.js?v=2267";
import {
  altSteps,
  createAltDraft,
  getDraft,
  isAnalysisReady,
  restoreDraft,
  subscribeDraft,
} from "../context-builder.js?v=2267";
import { getConnectedProfiles, renderProfileTag, subscribe as subscribeProfiles } from "../social-profiles.js?v=2267";
import {
  readSessionId,
  persistDraft,
  readPersistedDraft,
  LOADING_STAGES,
  FILE_LOADING_STAGES,
  INTERVIEW_LOADING_STAGES,
} from "./welcome-alt-recap.js?v=2267";
import { RECAP_SECTIONS } from "../playbook-view.js?v=2267";

const PREFILLED_URL = "https://nicesoap.com";
const SESSION_KEY = "welcomeAltSessionId";

// What each step is called, everywhere it's named (the intro's list, the
// progress, each screen's title).
export const STEP_TEXT = {
  connect: { title: "Connect your accounts", desc: "So I write for the networks you publish on." },
  url: { title: "Show me your Brand", desc: "Your website, a few files, or a handful of questions." },
  language: { title: "Pick your language", desc: "The one I'll write your posts in." },
  documents: { title: "Add brand documents", desc: "Optional — a brand book or guidelines." },
  recap: { title: "Review your Playbook", desc: "Everything I learned, before I write a word." },
};

const ROUTE = {
  connect: "/welcome-alt/connect",
  url: "/welcome-alt/brand",
  language: "/welcome-alt/language",
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

// The building stages on /welcome-alt/ready, by source — they tick on the left
// and say when each analysed line of the card lands (a stage's `lands`).
export function stagesFor(d) {
  if (d?.sourceType === "documents") return FILE_LOADING_STAGES;
  if (d?.sourceType === "interview") return INTERVIEW_LOADING_STAGES;
  return LOADING_STAGES;
}

// ── The parts' colours ────────────────────────────────────────────────────

// One tint per Playbook part, shared by the review (its list tiles, its card
// bands) and the card's row labels: a row wears the colour of the part it
// fills. The -20 for the tile, the -150 for its glyph; never electric blue.
const PART_TINT = {
  goals: "orange",
  voice: "purple",
  brand: "menthol",
  competitors: "yellow",
  influencers: "soft-blue",
};
export const tint = (id) =>
  PART_TINT[id]
    ? `--part-tint: var(--ref-color-${PART_TINT[id]}-20); --part-ink: var(--ref-color-${PART_TINT[id]}-150)`
    : "";

// The card's rows by label (the intro's example card uses the same labels),
// IN THE PLAYBOOK'S ORDER, each with the part it fills. Publishes on is the
// account, not a part of the Playbook: it sits in the card's head, with the
// brand; About is the brand's lead, under its name.
const ROW_PART = {
  "Publishes on": "",
  About: "",
  "Writes in": "goals",
  "Who you write for": "goals",
  Goal: "goals",
  Voice: "voice",
  "Main voice": "voice",
  "Colors & type": "brand",
  "Up against": "competitors",
};
const ROW_ORDER = Object.keys(ROW_PART);
const inPlaybookOrder = (rows) => [...rows].sort((a, b) => ROW_ORDER.indexOf(a.label) - ROW_ORDER.indexOf(b.label));

// The Playbook card — the live one on every step and the intro's example.
// Three levels, one per kind of thing: WHO (the head: the brand's mark, its
// name at h1, where it is and where it publishes, the status on the right),
// WHAT (About, the lead: the one paragraph set a size up), and the PARTS the
// Playbook will hold, each under its own name and glyph from the Playbook
// (RECAP_SECTIONS: Brief, Voice profile, Branding, Competitors) in its tint.
// Inside a part, a field is named only when the part holds more than one.
//   rows: [{ label, html, cls?, style? }] — html is the field's content
//   (a value, or its placeholder bars); cls / style ride on the field.
export function playbookCard({ mark, name, sub = "", status = "", rows }) {
  const ordered = inPlaybookOrder(rows);
  const field = (r, { named = true, cls = "" } = {}) => `
    <div class="welcome-intro__row ${cls} ${r.cls || ""}" style="${r.style || ""}">
      <dt class="${named ? "" : "welcome-intro__hidden"}">${escapeHtml(r.label)}</dt>
      <dd>${r.html}</dd>
    </div>`;
  const publish = ordered.find((r) => r.label === "Publishes on");
  const about = ordered.find((r) => r.label === "About");
  const parts = [];
  for (const r of ordered) {
    const part = ROW_PART[r.label];
    if (!part) continue;
    if (parts.at(-1)?.id !== part) parts.push({ id: part, rows: [] });
    parts.at(-1).rows.push(r);
  }
  return `
    <div class="welcome-intro__card-head">
      <span class="welcome-intro__brand">${mark}</span>
      <div class="welcome-flow__card-name">
        <span class="welcome-intro__card-title">${escapeHtml(name)}</span>
        ${sub ? `<span class="welcome-flow__card-sub">${escapeHtml(sub)}</span>` : ""}
        ${publish ? `<dl class="welcome-intro__publish">${field(publish, { named: false })}</dl>` : ""}
      </div>
      ${status}
    </div>
    ${about ? `<dl class="welcome-intro__lead">${field(about, { named: false })}</dl>` : ""}
    ${parts
      .map((p) => {
        const head = RECAP_SECTIONS.find((t) => t.id === p.id);
        const named = p.rows.length > 1;
        return `
          <section class="welcome-intro__part" style="${tint(p.id)}">
            <span class="welcome-flow__glyph is-icon is-tinted welcome-intro__part-tile" aria-hidden="true"><i class="${head?.icon || ""}"></i></span>
            <h3 class="welcome-intro__part-name">${escapeHtml(head?.title || "")}</h3>
            <dl class="welcome-intro__fields">${p.rows.map((r) => field(r, { named })).join("")}</dl>
          </section>`;
      })
      .join("")}
  `;
}

// ── The live card ─────────────────────────────────────────────────────────

const landed = new Set(); // `${sid}:${row}` already shown filled — it lands once, not on every step

const domainOf = (url) =>
  String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const chip = (t, cls = "welcome-flow__chip") => `<span class="${cls}">${escapeHtml(t)}</span>`;
const stack = (...parts) => `<span class="welcome-flow__stack">${parts.filter(Boolean).join("")}</span>`;
const chips = (list, cls) =>
  list.length ? `<span class="welcome-flow__chips">${list.map((t) => chip(t, cls)).join("")}</span>` : "";
const text = (t) => (t ? `<span class="welcome-flow__line">${escapeHtml(t)}</span>` : "");

// Each line of the card — the Playbook's own parts, as they're learned: empty
// (a quiet placeholder), pending (being learned) or filled.
// The analysis lands on the draft in one go, a few seconds after the source is
// given — but only the brand's look and its competitors can honestly be known
// by then. The voice, the audience, the goal and the About wait for their
// stage of "Building your Playbook" (the stage's `lands`), and land one stage
// at a time; before it they stay quiet. `build`: where that screen is
// ({ at, done }) — none on the steps before it.
function cardRows(d, sid, build) {
  const analysing = Boolean(d?.analysisStartedAt) && !isAnalysisReady(sid);
  const at = d?.revealed || build?.done ? Infinity : (build?.at ?? -1);
  const stageOf = new Map();
  stagesFor(d).forEach((st, i) => (st.lands || []).forEach((k) => stageOf.set(k, i)));
  const rows = [];
  const push = (row, known) => {
    const i = stageOf.get(row.key);
    const due = i === undefined || i < at;
    const working = i === undefined ? analysing : i <= at;
    rows.push({ ...row, state: known && due ? "filled" : working && (analysing || known) ? "pending" : "empty" });
  };
  const summary = d?.businessSummary || "";
  push({ key: "summary", label: "About", value: text(summary), lines: 3 }, Boolean(summary));
  const profiles = getConnectedProfiles();
  rows.push({
    key: "profiles",
    label: "Publishes on",
    state: profiles.length ? "filled" : "empty",
    value: `<span class="welcome-flow__chips">${profiles.map((p) => renderProfileTag(p)).join("")}</span>`,
  });
  const traits = (d?.voiceProfile?.headline || "")
    .split(/\s*·\s*/)
    .filter(Boolean)
    .slice(0, 3);
  const voice = traits.length ? traits : (d?.tones || []).slice(0, 2);
  push(
    {
      key: "voice",
      label: "Voice",
      value: stack(chips(voice, "welcome-intro__trait"), text(d?.voiceSummary)),
      lines: 2,
    },
    voice.length > 0,
  );
  const audience = d?.audience?.[0];
  push(
    {
      key: "audience",
      label: "Who you write for",
      value: stack(text(audience), chips((d?.audienceProblems || []).slice(0, 2))),
      lines: 2,
    },
    Boolean(audience),
  );
  const goal = [d?.objective?.[0], d?.contentAction?.[0]].filter(Boolean);
  push({ key: "goal", label: "Goal", value: chips(goal) }, goal.length > 0);
  if (isFlagOn("multilingualPlaybook")) {
    const lang = d?.primaryLanguage || (d?.languages || [])[0];
    rows.push({
      key: "language",
      label: "Writes in",
      state: lang ? "filled" : "empty",
      value: lang ? `<span class="welcome-intro__plain">${escapeHtml(lang)}</span>` : "",
    });
  }
  const colors = [...new Set((d?.brandColors || []).map((c) => c.hex).filter(Boolean))].slice(0, 5);
  const font = d?.brandTypography?.headingFont;
  push(
    {
      key: "branding",
      label: "Colors & type",
      value:
        colors
          .map((hex) => `<span class="welcome-intro__swatch" style="background: ${escapeHtml(hex)}"></span>`)
          .join("") +
        (font ? `<span class="welcome-flow__font"><span aria-hidden="true">Aa</span>${escapeHtml(font)}</span>` : ""),
    },
    colors.length > 0,
  );
  const competitors = (d?.competitors || [])
    .map((c) => c.name)
    .filter(Boolean)
    .slice(0, 3);
  push({ key: "competitors", label: "Up against", value: chips(competitors) }, competitors.length > 0);
  return { rows };
}

function renderCard(sid, build) {
  const d = getDraft(sid);
  const { rows } = cardRows(d, sid, build);
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
  const status = ready
    ? `<span class="ap-status mermaid welcome-intro__card-status">Ready to write</span>`
    : learning
      ? `<span class="ap-status mermaid is-working welcome-intro__card-status">Learning your Brand…</span>`
      : "";
  return playbookCard({
    mark,
    name,
    sub: domain,
    status,
    rows: shownRows.map((r) => {
      const id = `${sid}:${r.key}`;
      const fresh = r.state === "filled" && !landed.has(id);
      if (r.state === "filled") landed.add(id);
      else landed.delete(id);
      return {
        label: r.label,
        cls: `welcome-flow__row is-${r.state}${fresh ? " is-new" : ""}`,
        html: r.state === "filled" ? r.value : `<span class="welcome-flow__placeholder"></span>`.repeat(r.lines || 1),
      };
    }),
  });
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
      <span class="welcome-flow__count">Step ${at + 1} of ${steps.length}</span>
    </div>
  `;
}

// Paint the shell into `target` once; `left()` is repainted by `paint()`, the
// card on every change to the draft or to the connected accounts.
// `sheet`: the review (/welcome-alt/recap) — the same stage, no card around:
// the part's blocks, dealt as a stack, floating on the pixels.
// `build`: /welcome-alt/ready's stages ({ at, done }), which gate the card.
// Returns { paint, sheet, cleanup }.
export function mountShell(target, { step, sid, left, sheet = false, build }) {
  target.innerHTML = html`
    <div class="welcome-intro welcome-flow ${sheet ? "is-review" : ""}">
      <section class="welcome-intro__lede" aria-labelledby="welcomeFlowTitle">
        <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
        <div class="welcome-intro__copy welcome-flow__copy">
          ${raw(renderProgress(step))}
          <div data-flow-left></div>
        </div>
      </section>
      <div class="welcome-intro__stage" ${sheet ? "" : raw('aria-hidden="true"')}>
        <archie-pixels data-quiet></archie-pixels>
        ${sheet
          ? raw(`<div class="welcome-flow__sheet" data-flow-sheet>
              <div class="welcome-flow__sheet-body" data-flow-sheet-body></div>
            </div>`)
          : raw(`<div class="welcome-intro__card welcome-flow__card" data-flow-card></div>`)}
      </div>
    </div>
  `;
  const leftEl = target.querySelector("[data-flow-left]");
  const cardEl = target.querySelector("[data-flow-card]");
  const paintCard = () => {
    if (cardEl) cardEl.innerHTML = renderCard(sid, build?.());
  };
  const paint = () => {
    leftEl.innerHTML = left();
    paintCard();
  };
  paint();
  const offDraft = subscribeDraft(sid, () => {
    persistDraft(sid);
    paintCard();
  });
  const offProfiles = subscribeProfiles(paintCard);
  return {
    paint,
    sheet: target.querySelector("[data-flow-sheet]"),
    cleanup: () => {
      offDraft();
      offProfiles();
    },
  };
}
