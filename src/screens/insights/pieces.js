// ---- Insights — the pieces every layout shares --------------------------------
//
// The layouts differ in ARRANGEMENT, never in vocabulary: the verdict is
// always the DS status pill, a linked post is always the same card, a measure's
// trend is always the same glyph. Keeping those here is what lets a reader
// switch layout and recognise every object on the other side.
//
// Pure render helpers — strings in, strings out. No listeners: every action is
// a `data-ins-*` hook the shell dispatches.

import { escapeHtml as esc } from "../../utils.js?v=1056";
import { renderPostEchoRow } from "../../components/top-post-card.js?v=1056";
import { getContexts } from "../../contexts-store.js?v=1056";
import { progressBar } from "./charts.js?v=1056";
import { signedPct } from "./model.js?v=1056";

// ── The page's head — the scope control and the state line ────────────────
//
// Insights reads ONE Playbook, and its head is where you change which. That is
// not a decoration: the rail's own scope switcher is parked (see the commented
// block in sidebar.js), so this is the only door to the scope anywhere in the
// app, and a dashboard you cannot re-point is a dashboard of one brand.
//
// It is a real DS select, labelled — a control that changes what the whole page
// shows should LOOK like a control. It was the page title with a chevron for a
// while, on the theory that the brand name is the scope; a title that is
// secretly a picker reads as neither, so the title went back to being a title
// (the page's subject) and the scope became a select beside it.

/** The Playbook picker. One Playbook → the name as text: a select with a single option cannot be used. */
export function playbookSelect(ctx, { className = "" } = {}) {
  const all = getContexts();
  if (all.length < 2) {
    return `<div class="ap-form-field ins-pbfield ${className}">
      <label>Playbook</label>
      <p class="ins-pbfield__name">${esc(ctx.name)}</p>
    </div>`;
  }
  const rows = all
    .map(
      (
        c,
      ) => `<div class="ap-select-option${c.id === ctx.id ? " selected" : ""}" data-ins-scope-pick="${esc(c.id)}" role="option" aria-selected="${c.id === ctx.id}">
        <span class="ap-select-option-text">${esc(c.name)}</span>
        ${c.id === ctx.id ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`,
    )
    .join("");
  // The label is wired to the trigger, and the trigger has combobox semantics.
  // It used to carry aria-label="Playbook — currently <name>", which duplicated
  // BOTH visible strings and, because aria-label overrides content, took the
  // value's own text away from a screen reader to replace it with a sentence.
  return `<div class="ap-form-field ins-pbfield ${className}">
    <label for="insPbTrigger">Playbook</label>
    <details class="ap-select ins-pbselect" data-ins-scope>
      <summary class="ap-select-trigger" id="insPbTrigger" role="combobox"
        aria-haspopup="listbox" aria-expanded="false" aria-controls="insPbListbox">
        <span class="ap-select-value">${esc(ctx.name)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" id="insPbListbox" role="listbox">
        <div class="ap-select-options">${rows}</div>
      </div>
    </details>
  </div>`;
}

/**
 * Which reading is on screen. A select, not a segmented control: this repo
 * deleted its segmented-control port on the grounds that "the product uses TABS
 * for that shape everywhere ... only one of the two lists is ever on screen".
 * The same reasoning rules out tabs here too — the page already has one tab bar
 * (the objectives), and a second above it would read as a hierarchy that isn't
 * there. Two selects side by side, "Playbook" and "View", say what they do.
 */
export function viewSelect(layouts, currentId) {
  const current = layouts.find((l) => l.id === currentId) || layouts[0];
  const rows = layouts
    .map(
      (
        l,
      ) => `<div class="ap-select-option${l.id === current.id ? " selected" : ""}" data-ins-view="${esc(l.id)}" role="option" aria-selected="${l.id === current.id}">
        <span class="ap-select-option-text">${esc(l.label)}</span>
        ${l.id === current.id ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`,
    )
    .join("");
  return `<div class="ap-form-field ins-viewfield">
    <label for="insViewTrigger">View</label>
    <details class="ap-select" data-ins-scope>
      <summary class="ap-select-trigger" id="insViewTrigger" role="combobox"
        aria-haspopup="listbox" aria-expanded="false" aria-controls="insViewListbox">
        <span class="ap-select-value">${esc(current.label)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" id="insViewListbox" role="listbox">
        <div class="ap-select-options">${rows}</div>
      </div>
    </details>
  </div>`;
}

/**
 * How the Playbook's objectives stand, as counts — never a Playbook verdict
 * (there is none by decision).
 *
 * Two DS components, no third thing: the tier is a `.ap-status` (a dot plus a
 * one-or-two-word state, which is exactly what a tier is) and the number is a
 * `.ap-counter normal` after it (the DS's own form for a live count placed after
 * a label — these move whenever a verdict flips). It used to be a hand-made 8px
 * dot beside a bold number, which re-implemented the Status pill's ::before and
 * let the counts line drift from the verdict pills it summarises.
 */
export function tierCounts(rollup) {
  const one = (n, label, tone) =>
    `<span class="ins-count"><span class="ap-status ${tone}">${label}</span><span class="ap-counter normal grey">${n}</span></span>`;
  return `<div class="ins-counts">
    ${one(rollup.onTrack, "On track", "green")}
    ${one(rollup.atRisk, "At risk", "tagOrange")}
    ${one(rollup.offTrack, "Off track", "red")}
    ${rollup.collecting ? one(rollup.collecting, "Collecting", "grey") : ""}
  </div>`;
}

// ── Verdict ───────────────────────────────────────────────────────────────

/** The DS status pill — the one way a verdict is written anywhere in the app. */
export function statusPill(entry, { dot = true } = {}) {
  return `<span class="ap-status ${esc(entry.statusClass)}${dot ? "" : " no-dot"}">${esc(entry.tierLabel)}</span>`;
}

/** A measure's own state as a smaller pill (on / soft / off → the tier words). */
export function measurePill(m) {
  const cls = { "on-track": "green", "at-risk": "tagOrange", "off-track": "red" }[m.tier] || "grey";
  const label = { "on-track": "On track", "at-risk": "At risk", "off-track": "Off track" }[m.tier] || "Pending";
  return `<span class="ap-status ${cls} no-dot">${label}</span>`;
}

// ── Provenance ────────────────────────────────────────────────────────────

/** Who set the objective — Archie (from the website analysis) or the reader. */
export function originMark(entry, { short = false } = {}) {
  if (entry.origin === "user") {
    return `<span class="ins-origin"><i class="ap-icon-user ap-icon-sm" aria-hidden="true"></i>${short ? "You" : "Set by you"}</span>`;
  }
  return `<span class="ins-origin"><i class="ap-icon-archie-official ap-icon-sm" aria-hidden="true"></i>${short ? "Archie" : "Proposed by Archie"}</span>`;
}

/** The window as a line — "Rolling 30-day window" / "Ends Dec 31 · 42 days left". */
export function windowLine(entry) {
  const w = entry.window;
  if (w.type === "fixed") {
    const left = w.daysLeft == null ? "" : w.daysLeft > 0 ? ` · ${w.daysLeft} days left` : " · window closed";
    return `${cap(w.short)}${left}`;
  }
  return cap(w.label);
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// ── Trend ─────────────────────────────────────────────────────────────────

const TREND_ICON = { up: "ap-icon-data-increase", down: "ap-icon-data-decrease", flat: "ap-icon-data-stagnate" };

/**
 * The trend glyph — icon + signed %. Only a positive move is coloured (green);
 * flat and negative stay ink, the icon carries the direction.
 */
export function trendGlyph(m, { label = false } = {}) {
  const t = m.trend || { dir: "flat", pct: 0 };
  const good = t.dir === "up";
  return `<span class="ins-trend ${good ? "ins-trend--up" : ""}" title="${esc(t.label)} ${signedPct(t.pct)} over the window">
    <i class="${TREND_ICON[t.dir] || TREND_ICON.flat} ap-icon-sm" aria-hidden="true"></i><span>${signedPct(t.pct)}</span>${label ? `<span class="ins-trend__label">over the window</span>` : ""}
  </span>`;
}

// ── The score ─────────────────────────────────────────────────────────────

/**
 * How far an objective is, as one figure: the percentage, the measure it is
 * measured on, and the trend beside it. Shared, because "42% of target on Link
 * clicks, down 11%" is the same sentence in every layout — only its size moves.
 * A collecting objective has no percentage to print and says so.
 */
export function scoreFigure(entry, { size = "lg" } = {}) {
  const m = entry.headline;
  // A collecting objective has no percentage — but it does have a real number:
  // how far into its grace window it is. An em-dash in a 56px black slot reads
  // as a printing error, so the slot carries the day count and says what is
  // being waited for.
  if (entry.collecting) {
    const day = entry.grace?.day ?? 1;
    const of = entry.grace?.of ?? 7;
    const left = Math.max(0, of - day);
    return `<div class="ins-score ins-score--${size} ins-score--pending">
      <span class="ins-score__value">${day}<span class="ins-score__unit">/${of}</span></span>
      <span class="ins-score__meta">
        <span>days collected</span>
        <span>${left === 0 ? "first verdict due" : `first verdict in ${left} day${left === 1 ? "" : "s"}`}</span>
      </span>
    </div>`;
  }
  return `<div class="ins-score ins-score--${size}">
    <span class="ins-score__value">${entry.progress}<span class="ins-score__unit">%</span></span>
    <span class="ins-score__meta">
      <span>of target on ${esc(m?.metricLabel || "")}</span>
      ${m ? trendGlyph(m) : ""}
    </span>
  </div>`;
}

// ── Measures ──────────────────────────────────────────────────────────────

/** "14,800 → 20,000" or, for a rate, "4.1% · hold above 5.0%". */
function measureFigures(m) {
  if (m.isRate) return `${esc(m.currentLabel)} <span class="ins-muted">· hold above ${esc(m.targetLabel)}</span>`;
  return `${esc(m.currentLabel)} <span class="ins-muted">→ ${esc(m.targetLabel)}</span>`;
}

/** A compact measure row: name + scope, figures, bar, % — the list every layout stacks. */
export function measureRow(m, { showPill = false } = {}) {
  const pct = m.progress == null ? "—" : `${m.progress}%`;
  return `<div class="ins-measure" data-ins-measure-id="${esc(m.id)}">
    <div class="ins-measure__head">
      <span class="ins-measure__name">${esc(m.metricLabel)}${m.scopeLabel ? `<span class="ins-muted"> · ${esc(m.scopeLabel)}</span>` : ""}${m.proxy ? ` <span class="ap-badge blue">proxy</span>` : ""}</span>
      <span class="ins-measure__pct">${pct}</span>
    </div>
    ${progressBar(m.progress, m.tier, { pending: m.progress == null })}
    <div class="ins-measure__foot">
      <span class="ins-measure__figures">${measureFigures(m)}</span>
      ${showPill ? measurePill(m) : trendGlyph(m)}
    </div>
  </div>`;
}

/**
 * An objective measured on a proxy because a connection is missing. A state
 * that needs a sentence of context and describes ONE element inline: the DS
 * Status card. It was a `.ap-tag tagOrange mini` — a Tag names an entity a user
 * can create and remove, its colours name an object TYPE (tagOrange is spoken
 * for: Listening keywords), and `mini` is for referencing an object inline in
 * running text. Three of the component's Don'ts in one span.
 */
export function proxyNote(entry) {
  return `<div class="ap-status-card tagOrange ins-proxy-note">
    <div class="upper">
      <i class="ap-icon-warning_fill" aria-hidden="true"></i>
      <div class="flow"><span>Needs Google Analytics</span></div>
    </div>
    ${entry.soon ? `<p>${esc(entry.soon)}</p>` : ""}
  </div>`;
}

// ── Linked posts ──────────────────────────────────────────────────────────

/**
 * One post drafted with Archie, as evidence. It is the SAME row the winners
 * flow quotes in the conversation (`renderPostEchoRow`) — a post should look
 * like a post wherever it is shown, and Insights had grown its own card that
 * said the same things in a different shape. What is ours is the stat line
 * (this post's contribution to the measure, not a view count) and the trailing
 * controls: **Repurpose** — the loop's other end, since a post that moved an
 * objective is the best brief for the next one — and a remove, because a post
 * Archie attributed can be un-attributed by the reader.
 *
 * The contribution stays in ink rather than borrowing the winners' green
 * ×-vs-average accent — green means "on track" on this screen, and a green
 * multiple inside an off-track objective would read as reassurance.
 *
 * There is NO remove: a post is on this list because Archie measured that it
 * moved the objective, and a reader cannot un-observe that. The one trailing
 * control is Repurpose.
 */
export function postCard(post, entry) {
  const contribution = post.contribution.value || post.metricLabel;
  return renderPostEchoRow({
    className: "ins-postrow",
    network: post.network,
    when: post.date,
    excerpt: post.excerpt,
    mediaType: post.mediaType,
    image: post.image,
    statsHtml: `<b>${esc(contribution)}</b> · ${esc(post.contribution.multiple)}`,
    actionHtml:
      `<button type="button" class="ap-button ghost blue ins-postrow__reuse" data-ins-repurpose="${esc(entry.key)}" data-ins-post="${esc(post.id)}">` +
      `<i class="ap-icon-sparkles" aria-hidden="true"></i><span>Repurpose</span></button>`,
  });
}

/** The empty case under an objective — no posts drafted with Archie yet. */
export function postsEmpty() {
  return `<p class="ins-posts-empty">No post drafted with Archie has moved this objective yet.</p>`;
}

// ── Actions ───────────────────────────────────────────────────────────────

/**
 * The two doors every objective has: into a chat about it (the AI action —
 * orange), and into its editor (routine — stroked grey). Auto-width, always.
 *
 * SECONDARY, not primary: the DS allows one primary per screen and the topbar's
 * New objective is it. Secondary is also the right rung by its own definition —
 * "the main action of a bounded subsection" — which is what a chapter or a pane
 * is. Orange stays: this is the AI door.
 */
export function objectiveActions(entry) {
  const chatLabel = entry.nextMove?.cta || "Work on this";
  return `<div class="ins-actions">
    <button type="button" class="ap-button secondary orange" data-ins-chat="${esc(entry.key)}">
      <i class="ap-icon-sparkles" aria-hidden="true"></i><span>${esc(chatLabel)}</span>
    </button>
    <button type="button" class="ap-button stroked grey" data-ins-adjust="${esc(entry.key)}">
      <i class="ap-icon-pen" aria-hidden="true"></i><span>Adjust</span>
    </button>
  </div>`;
}

// ── Numbers ───────────────────────────────────────────────────────────────

/** A numeral with a name under it — the supporting figures beside a score. */
export function figure(value, name) {
  return `<div class="ins-figure">
    <span class="ins-figure__value">${value}</span>
    <span class="ins-figure__name">${esc(name)}</span>
  </div>`;
}

export { signedPct, esc };
