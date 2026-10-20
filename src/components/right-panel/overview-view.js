// The right panel's Overview (flag contentPanel) — the chat at a glance, and
// what the conversation status card became: one stacked card per object of
// the pipeline (in progress · sources · ideas · clips · drafts), each with the
// numbers that say where it stands. Modelled on the Claude Code side pane:
// cards that fold under their title, a proportion bar with a named legend,
// and a link row to the full tab. Render-only; the shell (right-panel.js)
// owns the delegated clicks (data-rpanel-goto / data-rpanel-focus).

import { escapeAttr, escapeText } from "../../utils.js?v=2064";
import { getThread } from "../../assistant.js?v=2064";
import { getSources } from "../../sources-stream.js?v=2064";
import { getIdeas } from "../../library.js?v=2064";
import { getPosts } from "../../posts-store.js?v=2064";
import { isPostValid } from "../../post-validation.js?v=2064";
import { networkIcon, networkLabel } from "../../network-voice.js?v=2064";
import { pendingProcesses } from "../conversation-status-card.js?v=2064";
import { SOURCE_KIND_ICON } from "./sources-view.js?v=2064";
import { activeSessionId } from "../right-panel.js?v=2064";

// Live drafts only — the Drafts tab hides scheduled ones, so does its count.
const liveDrafts = (sid) => getPosts(sid).filter((p) => p.status !== "scheduled");
const clipsOf = (sources) => sources.reduce((n, s) => n + (Array.isArray(s.clips) ? s.clips.length : 0), 0);

// One count per tab — read by the panel header and the topbar Content button.
export function contentCounts(sid) {
  if (!sid) return { sources: 0, ideas: 0, clips: 0, drafts: 0 };
  const sources = getSources(sid);
  return {
    sources: sources.length,
    ideas: getIdeas(sid).length,
    clips: clipsOf(sources),
    drafts: liveDrafts(sid).length,
  };
}

// A card the user folded stays folded across the re-renders every store
// change triggers. Fed by the panel's capturing `toggle` listener.
const folded = new Set();
export function onOverviewToggle(event) {
  const card = event.target.closest?.("[data-ov-card]");
  if (!card) return;
  if (card.open) folded.delete(card.dataset.ovCard);
  else folded.add(card.dataset.ovCard);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function renderOverviewView() {
  const sid = activeSessionId();
  if (!sid) return "";
  const sources = getSources(sid);
  const ideas = getIdeas(sid);
  const drafts = liveDrafts(sid);
  const clipCount = clipsOf(sources);
  const pending = pendingProcesses(getThread(sid));
  return `
    <div class="rpanel-ov">
      ${renderPending(pending)}
      ${renderSourcesCard(sources)}
      ${renderIdeasCard(ideas)}
      ${clipCount ? renderLinkCard("clips", "Clips", plural(clipCount, "clip")) : ""}
      ${renderDraftsCard(drafts)}
    </div>
  `;
}

// ── Building blocks ─────────────────────────────────────────────────────────

function card(id, title, metric, body) {
  return `
    <details class="rpanel-ov__card" data-ov-card="${id}" ${folded.has(id) ? "" : "open"}>
      <summary class="rpanel-ov__head">
        <span class="rpanel-ov__title">${title}</span>
        <i class="ap-icon-chevron-down rpanel-ov__chevron" aria-hidden="true"></i>
        <span class="rpanel-ov__metric">${metric}</span>
      </summary>
      <div class="rpanel-ov__body">${body}</div>
    </details>
  `;
}

// The link at the foot of a card — always says where it goes.
const footLink = (mode, label) => `
  <button type="button" class="ap-link standalone small rpanel-ov__foot" data-rpanel-goto="${mode}">
    <span>${label}</span><i class="ap-icon-chevron-right" aria-hidden="true"></i>
  </button>
`;

// Proportion bar + its legend: every segment named, with its count.
function renderSplit(parts) {
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (!total) return "";
  const bar = parts
    .filter((p) => p.count)
    .map((p) => `<span class="rpanel-ov__seg rpanel-ov__seg--${p.tone}" style="flex-grow:${p.count}"></span>`)
    .join("");
  const legend = parts
    .map(
      (p) => `
      <li class="rpanel-ov__legend-row">
        <span class="rpanel-ov__swatch rpanel-ov__seg--${p.tone}" aria-hidden="true"></span>
        <span class="rpanel-ov__legend-label">${p.label}</span>
        <span class="rpanel-ov__legend-count">${p.count}</span>
      </li>`,
    )
    .join("");
  return `
    <div class="rpanel-ov__bar" role="img" aria-label="${escapeAttr(parts.map((p) => `${p.count} ${p.label}`).join(", "))}">${bar}</div>
    <ul class="rpanel-ov__legend">${legend}</ul>
  `;
}

const emptyLine = (text) => `<p class="rpanel-ov__empty">${text}</p>`;

// ── Cards ───────────────────────────────────────────────────────────────────

function renderPending(pending) {
  if (!pending.length) return "";
  const rows = pending
    .map(
      (label) => `
      <li class="rpanel-ov__row rpanel-ov__row--static">
        <span class="ap-loader blue size-16" aria-hidden="true"><svg><circle></circle><circle></circle></svg></span>
        <span class="rpanel-ov__row-label">${escapeText(label)}</span>
      </li>`,
    )
    .join("");
  return `
    <section class="rpanel-ov__card rpanel-ov__card--live" role="status">
      <div class="rpanel-ov__head rpanel-ov__head--static">
        <span class="rpanel-ov__title">In progress</span>
      </div>
      <ul class="rpanel-ov__rows">${rows}</ul>
    </section>
  `;
}

function renderSourcesCard(sources) {
  if (!sources.length) {
    return card("sources", "Sources", "None yet", emptyLine("Attach a file or a link and I'll pull ideas from it."));
  }
  const rows = sources
    .map((s) => {
      const icon = s.iconClass || SOURCE_KIND_ICON[s.kind] || "ap-icon-file";
      const clips = Array.isArray(s.clips) ? s.clips.length : 0;
      const meta =
        s.status !== "Processed"
          ? "Reading…"
          : [s.ideaCount ? plural(s.ideaCount, "idea") : "", clips ? plural(clips, "clip") : ""]
              .filter(Boolean)
              .join(" · ") || "No ideas yet";
      return `
        <li>
          <button type="button" class="rpanel-ov__row" data-rpanel-focus="source:${escapeAttr(s.id)}" title="Show in Sources">
            <i class="${icon} rpanel-ov__row-icon" aria-hidden="true"></i>
            <span class="rpanel-ov__row-label">${escapeText(s.filename || "Untitled")}</span>
            <span class="rpanel-ov__row-meta">${meta}</span>
          </button>
        </li>`;
    })
    .join("");
  return card(
    "sources",
    "Sources",
    `${plural(sources.length, "source")} in this chat`,
    `<ul class="rpanel-ov__rows">${rows}</ul>${footLink("sources", "Manage sources")}`,
  );
}

function renderIdeasCard(ideas) {
  if (!ideas.length) {
    return card("ideas", "Ideas", "None yet", emptyLine("I pull ideas from your sources — attach one to get some."));
  }
  const drafted = ideas.filter((i) => i.used > 0).length;
  return card(
    "ideas",
    "Ideas",
    plural(ideas.length, "idea"),
    `${renderSplit([
      { label: "Drafted", count: drafted, tone: "done" },
      { label: "Not drafted yet", count: ideas.length - drafted, tone: "rest" },
    ])}${footLink("ideas", "See all ideas")}`,
  );
}

function renderDraftsCard(drafts) {
  if (!drafts.length) {
    return card("drafts", "Drafts", "None yet", emptyLine("Ask me for a post, or draft one from an idea."));
  }
  const toFix = drafts.filter((p) => !isPostValid(p)).length;
  const byNetwork = new Map();
  for (const p of drafts) byNetwork.set(p.network, (byNetwork.get(p.network) || 0) + 1);
  const networks = [...byNetwork]
    .map(
      ([n, count]) => `
      <li class="rpanel-ov__row rpanel-ov__row--static">
        <i class="${networkIcon(n)} rpanel-ov__row-icon" aria-hidden="true"></i>
        <span class="rpanel-ov__row-label">${escapeText(networkLabel(n))}</span>
        <span class="rpanel-ov__row-meta">${plural(count, "draft")}</span>
      </li>`,
    )
    .join("");
  return card(
    "drafts",
    "Drafts",
    plural(drafts.length, "draft"),
    `${renderSplit([
      { label: "Ready", count: drafts.length - toFix, tone: "ready" },
      { label: "Needs fixes", count: toFix, tone: "fix" },
    ])}<ul class="rpanel-ov__rows rpanel-ov__rows--split">${networks}</ul>${footLink("drafts", "Review drafts")}`,
  );
}

// A card that is only a way in — Claude's « Connecteurs › 10 à reconnecter ».
function renderLinkCard(mode, title, metric) {
  return `
    <button type="button" class="rpanel-ov__card rpanel-ov__card--link" data-rpanel-goto="${mode}">
      <span class="rpanel-ov__title">${title}</span>
      <i class="ap-icon-chevron-right rpanel-ov__chevron" aria-hidden="true"></i>
      <span class="rpanel-ov__metric">${metric}</span>
    </button>
  `;
}
