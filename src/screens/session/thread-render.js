// The store-coupled half of the thread: renderThread walks the session's turns
// and dispatches each to its renderer, and the turns that must read a store
// (extraction results, clip extraction, top posts / topics widgets, the connect
// prompt) render here. The pure, dependency-free turns stay in thread-turns.js
// (the handoff gallery imports that one). Moved out of session.js, unchanged.

import {
  renderExtractingNotice,
  renderSourceIntakeTurn,
  renderChoiceTurn,
  renderSystemNotice,
  renderMessageBubble,
  renderNotice,
  renderResultCard,
  renderFailedTurn,
} from "./thread-turns.js?v=1671";
import { getSources as getStreamSources } from "../../sources-stream.js?v=1671";
import { renderTopPostEcho, renderTopPostsWidget } from "../../components/top-post-card.js?v=1671";
import { getTopPost } from "../../top-posts-store.js?v=1671";
import { getTopicById } from "../../topics-store.js?v=1671";
import { renderTopicsWidget } from "../../components/topic-card.js?v=1671";
import { renderProfileEchoCard } from "../../social-profiles.js?v=1671";
import { escapeHtml } from "../../utils.js?v=1671";
import { getIdeas } from "../../library.js?v=1671";
import { renderRefs, resolveRef } from "../../chat-refs.js?v=1671";
import { renderCompactIdeaCard } from "../../components/idea-card-compact.js?v=1671";
import { getThread } from "../../assistant.js?v=1671";
import { getSuggestion } from "../../voice-coach-store.js?v=1671";
import { networkLabel, networkIcon, memoryCardHtml } from "../../network-voice.js?v=1671";
import { isFlagOn } from "../../feature-flags.js?v=1671";
import { CURRENT_USER } from "../../org.js?v=1671";

export function renderThread(messages, sessionId) {
  const turns = messages.map((m) => [m, renderTurn(m, sessionId)]);
  if (isFlagOn("newConversationStyles")) return renderTwoSides(turns);
  return turns.map(([, html]) => html).join("");
}

// ─── New conversation styles (flag newConversationStyles) ───────────────────
// Figma "Conversation styles" § E. Each turn is a head line, then the body on
// the same edge — no avatar column. Archie = his avatar (+ his status pill),
// no name. You = time · You · your avatar, on the right, your bubble or pick
// under it. The time shows on hover — in your head line, in the gutter left
// of Archie's avatar. Archie's consecutive turns share one head.
const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");

function renderTwoSides(turns) {
  const tpl = document.createElement("template");
  let prev = null;
  let out = "";
  for (const [m, html] of turns) {
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    if (!el) continue;
    const side = el.matches(".chat-turn--user") ? "user" : "ai";
    el.querySelectorAll(":scope > .chat-turn-avatar, :scope > .chat-turn-role").forEach((n) => n.remove());
    // Archie goes on: one avatar for the run. A status line starts a new step.
    const status = side === "ai" ? el.querySelector(".assistant-notice__toggle, .extracting-notice") : null;
    // While Archie works (a pending result card, a working status), his avatar
    // IS the loader: the same disc, the mark animated in place.
    const working = side === "ai" && !!el.querySelector(".drafts-card--pending, .ap-status.is-working");
    const cont = side === "ai" && prev === "ai" && !status && !working;
    prev = side;
    const time = clock(m.createdAt);
    const timeHtml = time ? `<span class="e-turn__time">${time}</span>` : "";
    const avatar =
      side === "ai"
        ? `<span class="e-turn__mark" aria-hidden="true">${
            working
              ? `<span class="archie-loader" role="status" aria-label="Working"></span>`
              : `<i class="ap-icon-archie-official"></i>`
          }</span>`
        : `<span class="ap-avatar size-24" aria-hidden="true"><span class="ap-avatar-initials">${escapeHtml(CURRENT_USER.initials)}</span></span>`;
    // The avatar heads the turn, on the same left (right) edge as what
    // follows: in Archie's status line when he has one, else on its own line.
    let head = "";
    if (side === "user")
      head = `<div class="e-turn__head">${timeHtml}<span class="e-turn__name">You</span>${avatar}</div>`;
    else if (status) status.insertAdjacentHTML("afterbegin", avatar);
    else if (!cont) head = `<div class="e-turn__head">${avatar}</div>`;
    out += `
      <div class="e-turn e-turn--${side}${cont ? " e-turn--cont" : ""}">
        ${side === "ai" ? timeHtml : ""}
        <div class="e-turn__content">${head}${el.outerHTML}</div>
      </div>`;
  }
  return out;
}

function renderTurn(message, sessionId) {
  // Hidden placeholders (pre-reply AI bubbles) don't render.
  if (message.hidden) return "";

  // Pending marker — renders the inline "Extracting" notice while loading,
  // disappears once the caller flips status to "ready". Figma 25:1413.
  if (message.role === "pending") {
    if (message.status !== "loading") return "";
    return renderExtractingNotice(message.meta);
  }

  // Right-aligned "Source intake" turn — Figma 25:1127 / 25:1131.
  if (message.role === "source-intake") {
    const source = message.sourceId ? getStreamSources(sessionId).find((s) => s.id === message.sourceId) : null;
    return renderSourceIntakeTurn(message, source);
  }

  // AI extraction result — Figma 25:1053.
  if (message.role === "assistant" && message.variant === "extraction") {
    return renderExtractionTurn(message, sessionId);
  }

  // Draft result — intentionally NOT rendered inline. Drafts can finish at any
  // time (incl. while the user is doing something else), so a card here would
  // interleave the conversation unpredictably. The message is kept in the thread
  // only as the batch anchor for the Drafts panel; "ready" is surfaced via a
  // toast + the persistent topbar Drafts count (see the offThread subscription).
  if (message.role === "assistant" && message.variant === "draft") {
    return "";
  }

  // Clip extraction — pending spinner pill that flips to a ready card with
  // an "Open clips" action once the background extraction completes.
  if (message.role === "assistant" && message.variant === "clip-extraction") {
    return renderClipExtractionTurn(message, sessionId);
  }

  // Idea extraction (Flow A — "Extract themes"). Same chrome as clip
  // extraction; flips to a "Themes ready · panel updated" notice when
  // injectIdeasForSource lands.
  if (message.role === "assistant" && message.variant === "idea-extraction") {
    return renderIdeaExtractionTurn(message, sessionId);
  }

  // Profiles echo — right-aligned avatar (+ network badge) + handle chips,
  // used when the user picks which account(s) to draft a clip for.
  if (message.role === "user" && message.variant === "profiles") {
    return renderProfilesTurn(message);
  }

  if (message.role === "user" && message.variant === "top-post-pick") {
    return `
      <div class="chat-turn chat-turn--user">
        <span class="chat-turn-role">You</span>
        ${renderTopPostEcho(message.post)}
      </div>
    `;
  }

  // Inline "top posts" selection widget — the Add-menu flow's in-chat board.
  if (message.role === "assistant" && message.variant === "top-posts-widget") {
    return renderTopPostsWidgetTurn(message);
  }

  // Inline "topics" selection widget — the Add menu's "Pick from the Topic Feed".
  if (message.role === "assistant" && message.variant === "topics-widget") {
    return renderTopicsWidgetTurn(message);
  }

  if (message.role === "assistant" && message.variant === "failed") {
    return renderFailedTurn(message);
  }

  if (message.role === "assistant" && message.variant === "schedule-plan") {
    return renderSchedulePlanTurn(message, sessionId);
  }

  if (message.role === "assistant" && message.variant === "voice-suggestion") {
    return renderVoiceSuggestionTurn(message);
  }

  if (message.role === "user" && message.variant === "selection-echo") {
    return renderSelectionEchoTurn(message.echo);
  }

  // Channel-picker choice turn — chip row + "Draft them" button.
  if (message.role === "assistant-choice") {
    return renderChoiceTurn(message);
  }

  // Drafting / system notices — mermaid status pill + optional detail body.
  if (message.role === "system") {
    return renderSystemNotice(message);
  }

  // "Connect this service first" prompt — shown when a pasted link points to a
  // connector-backed service that isn't connected yet.
  if (message.role === "connect-prompt") {
    return renderConnectPromptTurn(message);
  }

  // Archie's `[[post:id]]` / `[[idea:id]]` / `[[source:id]]` tokens become inline
  // references here — the store-coupled half — so thread-turns.js stays pure.
  if (message.role === "assistant") {
    return renderMessageBubble({ ...message, text: renderRefs(message.text, sessionId) });
  }
  return renderMessageBubble(message);
}

// Inline "top posts" selection widget turn — an AI-side turn hosting the
// interactive multi-select card (renderTopPostsWidget). Resolves the post ids to
// live winners each render; selection + answered state live on the turn message.
function renderTopPostsWidgetTurn(message) {
  const posts = (message.postIds || []).map(getTopPost).filter(Boolean);
  return `
    <div class="chat-turn chat-turn--ai">
      <i class="ap-icon-archie-official chat-turn-avatar" aria-hidden="true"></i>
      ${renderTopPostsWidget({
        network: message.network,
        posts,
        selected: message.selected || [],
        answered: message.status === "answered",
        group: message.id,
      })}
    </div>
  `;
}

// Inline "topics" selection widget turn — the AI-side turn hosting the
// single-select Topic cards (renderTopicsWidget). Resolves the Topic ids to live
// Topics each render, so one that left the feed drops out; selection + answered
// state live on the turn message, exactly like the top-posts widget.
function renderTopicsWidgetTurn(message) {
  const topics = (message.topicIds || []).map(getTopicById).filter(Boolean);
  return `
    <div class="chat-turn chat-turn--ai">
      <i class="ap-icon-archie-official chat-turn-avatar" aria-hidden="true"></i>
      ${renderTopicsWidget({
        topics,
        selected: message.selected || [],
        answered: message.status === "answered",
        group: message.id,
      })}
    </div>
  `;
}

// Visual echo of the selected profiles — a right-aligned wrap of cards, each
// styled like every other selection echo in the thread (rounded navy-tint card,
// avatar + two lines: profile NAME, then the @handle / "Platform · Kind").
// Canonical renderer: social-profiles.renderProfileEchoCard. The payload is the
// raw socialAccounts entries picked in the accounts step.
function renderProfilesTurn(message) {
  const chips = (message.profiles || [])
    .map((account) => renderProfileEchoCard(account, { network: account?.platform }))
    .join("");
  return `
    <div class="chat-turn chat-turn--user">
      <span class="chat-turn-role">You</span>
      <div class="chat-profiles">${chips}</div>
    </div>
  `;
}

// Generic "you picked this object" echo — icon + title + meta chip. Posted via
// assistant.postSelectionEcho when the user selects a source / idea / clip / …
// so the pick stays visible in the thread.
function renderSelectionEchoTurn(echo) {
  if (!echo) return "";
  return `
    <div class="chat-turn chat-turn--user">
      <span class="chat-turn-role">You</span>
      <div class="selection-echo">
        <span class="selection-echo__icon"><i class="${escapeHtml(echo.icon || "ap-icon-file")}" aria-hidden="true"></i></span>
        <span class="selection-echo__body">
          <span class="selection-echo__title">${escapeHtml(echo.title || "")}</span>
          ${echo.meta ? `<span class="selection-echo__meta">${escapeHtml(echo.meta)}</span>` : ""}
        </span>
      </div>
    </div>
  `;
}

// Voice proposal (flag networkVoices) — what Archie wants to REMEMBER for one
// network voice, as a memory card (network-voice.js memoryCardHtml). Reads the
// suggestion's status from its store, so a Remember made on the Playbook's tray
// turns this card to its answered state too; Undo sends it back to the question.
function renderVoiceSuggestionTurn(message) {
  const s = getSuggestion(message.contextId, message.suggestionId);
  if (!s || s.status === "dismissed") return "";
  return `<div class="memory-turn">${memoryCardHtml(s, { attr: "voice", value: `${message.contextId}|${s.id}` })}</div>`;
}

// "Connect this service first" prompt — Archie can't import a pasted link
// because its backing connector (Slite, Notion, …) isn't connected. Renders an
// AI turn with the explanation + a Connect (logo-branded) / Close action row.
// The Connect click delegate connects the service and retries the import; the
// turn then collapses to a one-line confirmation.
function renderConnectPromptTurn(message) {
  if (message.status === "dismissed") return "";

  // Resolved — a standalone success status (green wash + filled check), not an
  // AI chat reply. Mirrors the connect-card so the request → success reads as
  // one coherent block.
  if (message.status === "connected") {
    return `
      <div class="connect-status" role="status">
        <i class="ap-icon-rounded-check_fill connect-status__icon" aria-hidden="true"></i>
        <p class="connect-status__text">
          <strong>${escapeHtml(message.connectorName)} connected</strong> — importing your ${escapeHtml(
            message.noun,
          )} now.
        </p>
      </div>
    `;
  }

  // Standalone connection card (not a chat bubble) — reused for any "connect a
  // service" or "grant an authorization" request. Header = connector logo tile
  // + name + a state pill; one supporting line; primary Connect + ghost Cancel.
  // The connector logo sits in a white rounded tile so a single-colour brand
  // mark always reads on a light surface. Falls back to the Archie sparkle.
  const name = escapeHtml(message.connectorName);
  const logo = message.logo
    ? `<img src="${escapeHtml(message.logo)}" alt="" />`
    : `<i class="ap-icon-archie-official" aria-hidden="true"></i>`;
  return `
    <div class="connect-card" role="group" aria-label="Connect ${name}">
      <div class="connect-card__head">
        <span class="connect-card__logo" aria-hidden="true">${logo}</span>
        <div class="connect-card__heading">
          <span class="connect-card__title">${name}</span>
          <span class="connect-card__sub">Connect to import this ${escapeHtml(
            message.noun,
          )} — I'll retry automatically.</span>
        </div>
        <span class="ap-status grey no-dot connect-card__state">Not connected</span>
      </div>
      <div class="connect-card__actions">
        <button type="button" class="ap-button primary blue" data-connect-prompt-connect="${escapeHtml(message.id)}">
          Connect ${name}
        </button>
        <button type="button" class="ap-button ghost grey" data-connect-prompt-dismiss="${escapeHtml(message.id)}">
          Cancel
        </button>
      </div>
    </div>
  `;
}

// Inline "Extracting" notice (Figma 25:1413) — mermaid status pill + small
// blue spinner, sits in the thread while a source extraction is in flight.
// Wrapped in role=status + aria-label so screen readers announce that
// extraction is running (the bare "Extracting" pill is meaningless out
// of context).
// Per-idea interaction state for the extraction-turn cards (the shared compact
// idea card is a pure renderer, so the consumer owns this). Toggled by the
// data-rpanel-* handlers in bindSession, which then repaint the single card.
export const extractionVerdict = new Map();

// ideaId → 'up' | 'down'
export const extractionWhyOpen = new Set();

function renderExtractionTurn(message, sessionId) {
  const count = message.count ?? (message.ideas ? message.ideas.length : 0);
  // Render the EXACT shared idea card (renderCompactIdeaCard) used by the
  // right-panel Ideas mode + the standalone Ideas page — feedback + Mention +
  // Draft. The thread message only carries {id,title,body}, so resolve the full
  // idea (kind / Source / rationale) from the library by id, like the panel does.
  const sources = sessionId ? getStreamSources(sessionId) : [];
  const byId = new Map((sessionId ? getIdeas(sessionId) : []).map((i) => [i.id, i]));
  const cards = (message.ideas || [])
    .map((m) => {
      const idea = byId.get(m.id) || m;
      return renderCompactIdeaCard(idea, sources, {
        verdict: extractionVerdict.get(idea.id) || null,
        whyOpen: extractionWhyOpen.has(idea.id),
        showMention: true,
      });
    })
    .join("");
  return `
    <div class="chat-turn chat-turn--ai chat-turn--extraction">
      ${renderNotice({
        variant: "mermaid",
        label: `Extracted ${count} idea${count === 1 ? "" : "s"}`,
        open: message.open !== false,
        loading: message.status === "loading",
        bodyHtml: `
          <div class="extraction-turn__detail">
            <div class="extraction-turn__analyzed-row">
              <strong>Analyzed</strong>
              <span>${message.filename}</span>
            </div>
            ${cards}
          </div>
        `,
      })}
    </div>
  `;
}

// Resolve an extraction-turn idea by id (library first, then any extraction
// turn in the thread) so the card handlers can read its title / data.
export function findExtractionIdea(sessionId, ideaId) {
  const fromLib = getIdeas(sessionId).find((i) => i.id === ideaId);
  if (fromLib) return fromLib;
  for (const m of getThread(sessionId)) {
    if (m.variant === "extraction" && Array.isArray(m.ideas)) {
      const hit = m.ideas.find((i) => i.id === ideaId);
      if (hit) return hit;
    }
  }
  return null;
}

// Re-render a single extraction-turn idea card in place (after a feedback / Why
// toggle) so the rest of the thread + scroll position stay put.
export function repaintExtractionCard(root, session, ideaId) {
  const idea = findExtractionIdea(session.id, ideaId);
  const article = root.querySelector(`.extraction-turn__detail [data-idea-id="${ideaId}"]`);
  if (!idea || !article) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderCompactIdeaCard(idea, getStreamSources(session.id), {
    verdict: extractionVerdict.get(ideaId) || null,
    whyOpen: extractionWhyOpen.has(ideaId),
    showMention: true,
  });
  const fresh = tmp.firstElementChild;
  if (fresh) article.replaceWith(fresh);
}

// Channel-picker choice turn — chips toggle on click, "Draft them" submits.
// Network → icon mapping — used both in the Drafts summary card network row
// and (later) by the Drafts work-surface in Lot 4. Keep the slug list aligned
// with mocks.socialAccounts so the visual surfaces never miss a network.
// Pending → ready clip-extraction card. The turn carries only the sourceId
// and filename; the renderer reads the live source from sources-stream, so the
// same turn naturally flips state when extractClipsForSource lands its result
// (the session view subscribes to subscribeSources, repainting the thread).
function renderClipExtractionTurn(message, sessionId) {
  const source = getStreamSources(sessionId).find((s) => s.id === message.sourceId);
  const filename = escapeHtml(source?.filename || message.filename || "your video");

  // Source was removed (e.g. user deleted it from /sources) — degrade to a
  // muted "unavailable" card rather than leave a broken CTA.
  if (!source) {
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${renderResultCard({
          state: "unavailable",
          icon: "ap-icon-file--video",
          title: "Clips no longer available",
          sub: `${filename} was removed.`,
        })}
      </div>
    `;
  }

  const clipsCount = Array.isArray(source.clips) ? source.clips.length : 0;
  const isReady = source.clipExtractionStatus === "ready" || clipsCount > 0;

  if (!isReady) {
    // Live stage label from the extraction ticker (sources-stream); falls back
    // to a generic line before the first tick lands.
    const stage = source.clipStage || "Cutting your clips…";
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${renderResultCard({
          state: "pending",
          busyLabel: stage,
          title: stage,
          sub: "Turning your video into post-ready clips — this takes a moment. You can keep chatting.",
        })}
      </div>
    `;
  }

  const titleLabel = clipsCount === 1 ? "1 clip to review" : `${clipsCount} clips to review`;
  return `
    <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
      ${renderResultCard({
        state: "ready",
        icon: "ap-icon-video",
        title: titleLabel,
        sub: `From <span class="drafts-card__sub-quote">${filename}</span>`,
        cta: { label: "Open clips" },
        dataAttr: `data-clip-card-open="${source.id}"`,
      })}
    </div>
  `;
}

// Pending → ready idea-extraction notice for the "Extract themes" branch.
// Uses the shared renderResultCard so "ideas ready", "clips ready" and
// "drafts to review" all read as one result-card family.
function renderIdeaExtractionTurn(message, sessionId) {
  const source = getStreamSources(sessionId).find((s) => s.id === message.sourceId);
  const filename = escapeHtml(source?.filename || message.filename || "your video");

  if (message.status === "loading") {
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${renderResultCard({
          state: "pending",
          busyLabel: "Reading video for ideas",
          title: "Extracting ideas from content…",
          sub: "About 15s. You can keep chatting.",
        })}
      </div>
    `;
  }

  // Source removed before the user opened the ready card — degrade rather
  // than crash on source.id.
  if (!source) {
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${renderResultCard({
          state: "unavailable",
          icon: "ap-icon-file--video",
          title: "Ideas no longer available",
          sub: `${filename} was removed.`,
        })}
      </div>
    `;
  }

  return `
    <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
      ${renderResultCard({
        state: "ready",
        title: "Ideas ready",
        sub: `From <span class="drafts-card__sub-quote">${filename}</span>`,
        cta: { label: "View ideas" },
        dataAttr: `data-ideas-card-open="${source.id}"`,
      })}
    </div>
  `;
}

// "Schedule all the drafts" — my plan, readable at a glance: one row per draft,
// sorted by date, the draft on the left (network glyph + its reference), its
// date on the right in a column that reads top to bottom. A row whose draft has
// left the store (scheduled) keeps its label as plain text.
function renderSchedulePlanTurn(message, sessionId) {
  const day = (ts) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  // Until it's scheduled, a date is the quick way into the schedule modal.
  const editable = message.status !== "scheduled";
  const rows = message.rows
    .map((r) => {
      const live = resolveRef("post", r.postId, sessionId);
      const what = live ? renderRefs(`[[post:${r.postId}]]`, sessionId) : escapeHtml(r.label);
      return `
        <li class="schedule-plan__row">
          <span class="schedule-plan__what">
            <i class="${networkIcon(r.network)} schedule-plan__network" title="${escapeHtml(networkLabel(r.network))}" aria-label="${escapeHtml(networkLabel(r.network))}"></i>
            <span class="schedule-plan__label">${what}</span>
          </span>
          ${
            editable
              ? `<button type="button" class="schedule-plan__when schedule-plan__when--edit" data-schedule-plan-edit="${message.id}" aria-label="Change the date — ${day(r.when)}, ${time(r.when)}" data-tooltip="Change date or time">
                  <span class="schedule-plan__day">${day(r.when)}</span>
                  <span class="schedule-plan__time">${time(r.when)}</span>
                  <i class="ap-icon-pen schedule-plan__edit" aria-hidden="true"></i>
                </button>`
              : `<span class="schedule-plan__when">
                  <span class="schedule-plan__day">${day(r.when)}</span>
                  <span class="schedule-plan__time">${time(r.when)}</span>
                </span>`
          }
        </li>`;
    })
    .join("");
  const state =
    message.status === "scheduled"
      ? `<span class="schedule-plan__state"><i class="ap-icon-check" aria-hidden="true"></i>Scheduled</span>`
      : message.status === "dismissed"
        ? `<span class="schedule-plan__state schedule-plan__state--muted">Not scheduled</span>`
        : "";
  return `
    <div class="chat-turn chat-turn--ai">
      <i class="ap-icon-archie-official chat-turn-avatar" aria-hidden="true"></i>
      <div class="chat-bubble chat-bubble--ai">
        <div class="chat-bubble-text">${renderRefs(message.text, sessionId)}</div>
        <div class="schedule-plan">
          <ol class="schedule-plan__list">${rows}</ol>
          <div class="schedule-plan__foot"><span>${message.summary}</span>${state}</div>
        </div>
      </div>
    </div>
  `;
}
