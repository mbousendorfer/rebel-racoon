// The right panel's Overview (flag contentPanel) — the chat at a glance, and
// what the conversation status card became. Not a dashboard of counters: the
// chat's actual content, in the pipeline's order. On top, my next step (the
// one thing worth doing now, as the DS infobox); then the sources as file
// tiles, the first ideas with their kind, the clips as a filmstrip of their
// thumbnails, the drafts as excerpts with their status. Each section names its
// numbers in words and links to its tab. Render-only; the shell
// (right-panel.js) owns the delegated clicks (data-rpanel-goto / -focus).

import { escapeAttr, escapeText, formatClock } from "../../utils.js?v=2601";
import { getThread } from "../../assistant.js?v=2601";
import { getSources } from "../../sources-stream.js?v=2601";
import { getIdeas } from "../../library.js?v=2601";
import { getPosts } from "../../posts-store.js?v=2601";
import { isPostValid } from "../../post-validation.js?v=2601";
import { networkIcon, networkLabel } from "../../social-profiles.js?v=2601";
import { iconFor } from "../../file-kinds.js?v=2601";
import { thumbBackground } from "../clip-card.js?v=2601";
import { pendingProcesses } from "../conversation-status-card.js?v=2601";
import { activeSessionId } from "../right-panel.js?v=2601";

// Live drafts only — the Drafts tab hides scheduled ones, so does its count.
const liveDrafts = (sid) => getPosts(sid).filter((p) => p.status !== "scheduled");
const allClips = (sources) => sources.flatMap((s) => (Array.isArray(s.clips) ? s.clips : []));

// One count per tab — read by the panel header and the topbar Content button.
export function contentCounts(sid) {
  if (!sid) return { sources: 0, ideas: 0, clips: 0, drafts: 0 };
  const sources = getSources(sid);
  return {
    sources: sources.length,
    ideas: getIdeas(sid).length,
    clips: allClips(sources).length,
    drafts: liveDrafts(sid).length,
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const IDEAS_SHOWN = 3;
const DRAFTS_SHOWN = 4;

export function renderOverviewView() {
  const sid = activeSessionId();
  if (!sid) return "";
  const sources = getSources(sid);
  const ideas = getIdeas(sid);
  const drafts = liveDrafts(sid);
  const clips = allClips(sources);
  const pending = pendingProcesses(getThread(sid));
  return `
    <div class="rpanel-ov">
      ${renderNextStep({ sources, ideas, drafts, pending })}
      ${renderSources(sources)}
      ${renderIdeas(ideas)}
      ${clips.length ? renderClips(clips) : ""}
      ${renderDrafts(drafts)}
    </div>
  `;
}

// ── Section chrome ──────────────────────────────────────────────────────────

// Title, the section's numbers in words, and the way to its tab.
function section(id, title, metric, link, body) {
  return `
    <section class="rpanel-ov__section" aria-labelledby="rpanel-ov-${id}">
      <header class="rpanel-ov__section-head">
        <h3 class="rpanel-ov__title" id="rpanel-ov-${id}">${title}</h3>
        ${metric ? `<span class="rpanel-ov__metric">${metric}</span>` : ""}
        ${link ? `<button type="button" class="ap-link standalone small rpanel-ov__link" data-rpanel-goto="${id}">${link}</button>` : ""}
      </header>
      ${body}
    </section>
  `;
}

const emptyLine = (text) => `<p class="rpanel-ov__empty">${text}</p>`;

// ── My next step ────────────────────────────────────────────────────────────
// The one thing worth doing now, said once, as the DS infobox — its type says
// how it stands: work in progress (info, with the loader), drafts that can't
// go out yet (warning), drafts ready (success), ideas waiting (info). The
// action sits in the infobox's content, like the failed turn's Retry.

function renderNextStep({ sources, ideas, drafts, pending }) {
  const toFix = drafts.filter((p) => !isPostValid(p)).length;
  const waiting = ideas.filter((i) => !(i.used > 0)).length;
  let box = null;
  if (pending.length) {
    box = { type: "info", line: `${escapeText(pending[0].replace(/…$/, ""))}…` };
  } else if (toFix) {
    box = {
      type: "warning",
      line: `${plural(toFix, "draft")} ${toFix === 1 ? "needs fixes before it can" : "need fixes before they can"} go out.`,
      // Straight to the « Needs fixes » filter: the drafts to fix, not all of them.
      cta: { to: "drafts", label: "Review drafts", filter: "needs_fixes" },
    };
  } else if (drafts.length) {
    box = {
      type: "success",
      line: `${plural(drafts.length, "draft")} ${drafts.length === 1 ? "is" : "are"} ready to schedule.`,
      cta: { to: "drafts", label: "Review drafts" },
    };
  } else if (waiting) {
    box = {
      type: "info",
      line: `${plural(waiting, "idea")} ${waiting === 1 ? "is" : "are"} waiting. Pick one and I'll draft it.`,
      cta: { to: "ideas", label: "See ideas" },
    };
  } else if (sources.length) {
    box = { type: "info", line: "I've read your sources. Ask me for a post whenever you're ready." };
  } else {
    return "";
  }
  const icon = pending.length
    ? `<span class="ap-loader size-16" aria-hidden="true"><svg><circle></circle><circle></circle></svg></span>`
    : `<i class="${NEXT_ICON[box.type]}" aria-hidden="true"></i>`;
  return `
    <div class="ap-infobox ${box.type} rpanel-ov__next"${pending.length ? ' role="status"' : ""}>
      ${icon}
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-message">${box.line}</span>
        </div>
        ${box.cta ? `<button type="button" class="ap-button stroked grey" data-rpanel-goto="${box.cta.to}"${box.cta.filter ? ` data-rpanel-goto-filter="${box.cta.filter}"` : ""}>${box.cta.label}</button>` : ""}
      </div>
    </div>
  `;
}

const NEXT_ICON = { info: "ap-icon-info_fill", warning: "ap-icon-warning_fill", success: "ap-icon-rounded-check_fill" };

// ── Sources — file tiles ────────────────────────────────────────────────────

function renderSources(sources) {
  if (!sources.length) {
    return section("sources", "Sources", "", "", emptyLine("Attach a file or a link and I'll pull ideas from it."));
  }
  const rows = sources
    .map((s) => {
      const reading = s.status !== "Processed";
      const clips = Array.isArray(s.clips) ? s.clips.length : 0;
      const tile = s.serviceLogo
        ? `<img src="${escapeAttr(s.serviceLogo)}" alt="" />`
        : `<i class="${s.iconClass || iconFor(s.kind)}" aria-hidden="true"></i>`;
      const meta = reading
        ? "Reading…"
        : [s.ideaCount ? plural(s.ideaCount, "idea") : "No ideas yet", clips ? plural(clips, "clip") : ""]
            .filter(Boolean)
            .join(", ");
      return `
        <li>
          <button type="button" class="rpanel-ov__item" data-rpanel-focus="source:${escapeAttr(s.id)}">
            <span class="rpanel-ov__tile">${tile}</span>
            <span class="rpanel-ov__item-text">
              <span class="rpanel-ov__item-title">${escapeText(s.filename || "Untitled")}</span>
              <span class="rpanel-ov__item-meta">${meta}</span>
            </span>
          </button>
        </li>`;
    })
    .join("");
  return section("sources", "Sources", "", "Open", `<ul class="rpanel-ov__list">${rows}</ul>`);
}

// ── Ideas — kind + title, how many made it to a draft ───────────────────────

function renderIdeas(ideas) {
  if (!ideas.length) {
    return section("ideas", "Ideas", "", "", emptyLine("I pull ideas from your sources. Attach one to get some."));
  }
  const drafted = ideas.filter((i) => i.used > 0).length;
  // Not drafted yet first: that's where the next post comes from.
  const shown = [...ideas].sort((a, b) => (a.used > 0) - (b.used > 0)).slice(0, IDEAS_SHOWN);
  const rows = shown
    .map((i) => {
      const kind = i.kind || "insight";
      return `
        <li>
          <button type="button" class="rpanel-ov__item rpanel-ov__item--idea" data-rpanel-focus="idea:${escapeAttr(i.id)}">
            <span class="rpanel-ideas__kind-word rpanel-ov__kind">${kind.charAt(0).toUpperCase() + kind.slice(1)}</span>
            <span class="rpanel-ov__item-title">${escapeText(i.title)}</span>
            ${i.used > 0 ? `<span class="ap-status green rpanel-ov__state">Drafted</span>` : ""}
          </button>
        </li>`;
    })
    .join("");
  const progress = `
    <span class="rpanel-ov__progress" aria-hidden="true">
      <span class="rpanel-ov__progress-fill" style="width:${Math.round((drafted / ideas.length) * 100)}%"></span>
    </span>`;
  return section(
    "ideas",
    "Ideas",
    `${progress}<span>${drafted} of ${ideas.length} drafted</span>`,
    ideas.length > IDEAS_SHOWN ? `See all ${ideas.length}` : "Open",
    `<ul class="rpanel-ov__list">${rows}</ul>`,
  );
}

// ── Clips — a filmstrip of their thumbnails ─────────────────────────────────

function renderClips(clips) {
  const frames = clips
    .map(
      (c) => `
      <li>
        <button type="button" class="rpanel-ov__frame" data-rpanel-focus="clip:${escapeAttr(c.id)}">
          <span class="rpanel-ov__frame-thumb" style="background-image:${thumbBackground(c.hue)}">
            <span class="rpanel-ov__frame-time">${formatClock((c.end || 0) - (c.start || 0))}</span>
          </span>
          <span class="rpanel-ov__frame-title">${escapeText(c.title || "Clip")}</span>
        </button>
      </li>`,
    )
    .join("");
  return section("clips", "Clips", "", "Open", `<ul class="rpanel-ov__strip">${frames}</ul>`);
}

// ── Drafts — the post itself, where it goes, whether it can ─────────────────

function renderDrafts(drafts) {
  if (!drafts.length) {
    return section("drafts", "Drafts", "", "", emptyLine("Ask me for a post, or draft one from an idea."));
  }
  const toFix = drafts.filter((p) => !isPostValid(p)).length;
  const rows = drafts
    .slice(0, DRAFTS_SHOWN)
    .map((p) => {
      const ok = isPostValid(p);
      const text = Array.isArray(p.text) ? p.text.join(" ") : p.text || "";
      const label = escapeAttr(networkLabel(p.network));
      return `
        <li>
          <button type="button" class="rpanel-ov__draft" data-rpanel-focus="post:${escapeAttr(p.id)}">
            <i class="${networkIcon(p.network)} rpanel-ov__draft-network" title="${label}" aria-label="${label}"></i>
            <span class="rpanel-ov__draft-body">
              <span class="rpanel-ov__draft-text">${escapeText(text)}</span>
              <span class="ap-status ${ok ? "green" : "orange"} rpanel-ov__state">${ok ? "Ready" : "Needs fixes"}</span>
            </span>
            ${p.imageUrl ? `<img class="rpanel-ov__draft-media" src="${escapeAttr(p.imageUrl)}" alt="" loading="lazy" />` : ""}
          </button>
        </li>`;
    })
    .join("");
  const metric = toFix
    ? `${drafts.length - toFix} ready, ${toFix} ${toFix === 1 ? "needs" : "need"} fixes`
    : `${drafts.length} ready`;
  return section(
    "drafts",
    "Drafts",
    metric,
    drafts.length > DRAFTS_SHOWN ? `See all ${drafts.length}` : "Open",
    `<ul class="rpanel-ov__list rpanel-ov__list--drafts">${rows}</ul>`,
  );
}
