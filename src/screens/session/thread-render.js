// The store-coupled half of the thread: renderThread walks the session's turns
// and dispatches each to its renderer, and the turns that must read a store
// (extraction results, clip extraction, top posts / topics widgets, the connect
// prompt) render here. The pure, dependency-free turns stay in thread-turns.js.
// Moved out of session.js, unchanged.

import {
  renderExtractingNotice,
  renderSourceIntakeTurn,
  renderChoiceTurn,
  renderSystemNotice,
  renderMessageBubble,
  renderNotice,
  renderResultCard,
  renderFailedTurn,
} from "./thread-turns.js?v=2487";
import { getSources as getStreamSources } from "../../sources-stream.js?v=2487";
import { renderTopPostEcho, renderTopPostsWidget } from "../../components/top-post-card.js?v=2487";
import { getTopPost } from "../../top-posts-store.js?v=2487";
import { getTopicById } from "../../topics-store.js?v=2487";
import { renderTopicsWidget } from "../../components/topic-card.js?v=2487";
import {
  renderProfileEchoCard,
  networkLabel,
  networkIcon,
  profileForNetwork,
  renderProfileTag,
  networkMeta,
} from "../../social-profiles.js?v=2487";
import { escapeHtml, formatTimeOfDay } from "../../utils.js?v=2487";
import { getIdeas } from "../../library.js?v=2487";
import { renderRefs, resolveRef } from "../../chat-refs.js?v=2487";
import { renderCompactIdeaCard } from "../../components/idea-card-compact.js?v=2487";
import { getThread, toolName, toolDescription } from "../../assistant.js?v=2487";
import { getPlans } from "../../post-plan-store.js?v=2487";
import { isFlagOn } from "../../feature-flags.js?v=2487";
import { CURRENT_USER } from "../../org.js?v=2487";
import { getSessionById } from "../../sessions-store.js?v=2487";
import { getContextById } from "../../contexts-store.js?v=2487";
import { needsImageLook } from "../../modules/image-studio/index.js?v=2487";
import { getFocusKey } from "../../components/right-panel.js?v=2487";
import { getPosts } from "../../posts-store.js?v=2487";
import { diffWords, diffParagraphs, changeRatio, wordCounts } from "../../word-diff.js?v=2487";
import { revisionSummary, revisionGroupSummary, revisionState, languageOf } from "../../draft-rewrite.js?v=2487";
import { learnedVoiceHtml, voiceAskHtml } from "../../components/voice-intro-modal.js?v=2487";

// Flag contentPanel — every result in the thread is a card that opens the side
// panel on its own objects (data-content-card="kind:key:ids"), and stays
// .is-active while the panel shows them. Claude's artifact card, in short.
const contentCards = () => isFlagOn("contentPanel");
const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;
function contentCard({ kind, key, ids, title, sub, cta, icon }) {
  return renderResultCard({
    state: "ready",
    icon,
    title,
    sub,
    cta: { label: cta },
    active: getFocusKey() === key,
    dataAttr: `data-content-card="${escapeHtml(kind)}" data-content-key="${escapeHtml(key)}" data-content-ids="${escapeHtml(ids.join(","))}"`,
  });
}

export function renderThread(messages, sessionId) {
  const turns = messages.map((m) => [m, renderTurn(m, sessionId)]);
  if (isFlagOn("newConversationStyles")) return renderTwoSides(turns);
  return turns.map(([, html]) => html).join("");
}

// ─── New conversation styles (flag newConversationStyles) ───────────────────
// Figma "Conversation styles" § E. An avatar column, mirrored: Archie's disc
// on the left, yours on the right, each on the first line of its turn, the
// content beside it — one content edge per side, whatever the turn (text,
// card, status). No name: the side and the avatar say who. The time shows
// on hover, in the outer gutter. Consecutive turns of one side share one
// avatar; the others keep its column empty.
const clock = (ts) => (ts ? formatTimeOfDay(ts) : "");

function renderTwoSides(turns) {
  const tpl = document.createElement("template");
  const mark = (working) =>
    `<span class="e-turn__mark" aria-hidden="true">${
      working
        ? `<span class="archie-loader" role="status" aria-label="Working"></span>`
        : `<i class="ap-icon-archie-official"></i>`
    }</span>`;
  const you = `<span class="ap-avatar size-24" aria-hidden="true"><span class="ap-avatar-initials">${escapeHtml(CURRENT_USER.initials)}</span></span>`;
  const items = [];
  // A long job still running on a video (clips, ideas) is not a turn: as in
  // prod (ap-clip-processing-card, projected after the messages), its card
  // stays at the very end of the thread, below the latest message, with no
  // avatar — its own loader says it works. Once ready it is a turn again,
  // moved to the end of the thread (postClipExtractionTurn, assistant.js).
  const trailing = [];
  let head = null; // the item that carries the avatar of Archie's current run
  for (const [m, html] of turns) {
    tpl.innerHTML = html.trim();
    const el = tpl.content.firstElementChild;
    if (!el) continue;
    if (el.matches(".chat-turn--clip-extraction") && el.querySelector(".drafts-card--pending")) {
      trailing.push(el.outerHTML);
      continue;
    }
    const side = el.matches(".chat-turn--user") ? "user" : "ai";
    el.querySelectorAll(":scope > .chat-turn-avatar, :scope > .chat-turn-role").forEach((n) => n.remove());
    const prev = items.at(-1);
    const status = side === "ai" ? el.querySelector(".assistant-notice__toggle, .extracting-notice") : null;
    // While Archie works (a pending result card, a working status) his avatar
    // is the loader — the run's ONE avatar, wherever the work sits in the run.
    const working = side === "ai" && !!el.querySelector(".drafts-card--pending, .ap-status.is-working");
    // A side goes on: one avatar per run. Archie's status lines in a row
    // stack 8px apart; text after anything continues the run; a status after
    // his text starts a new step with its own avatar. Your turns in a row
    // (a file, then your words) share yours the same way.
    const stack = side === "ai" && prev?.side === "ai" && status && prev.status;
    const cont = prev?.side === side && (side === "user" || !status);
    const item = { side, el, status, stack, cont, working, time: clock(m.createdAt) };
    if (side === "ai" && !stack && !cont) head = item;
    if (side === "ai" && working && head) head.working = true;
    items.push(item);
  }
  const turn = (cls, avatar, body, time = "") =>
    `<div class="e-turn ${cls}"><span class="e-turn__avatar">${time ? `<span class="e-turn__time">${time}</span>` : ""}${avatar}</span><div class="e-turn__content">${body}</div></div>`;
  return items
    .map((it) => {
      const avatar = it.stack || it.cont ? "" : it.side === "user" ? you : mark(it.working);
      const cls = `e-turn--${it.side}${it.stack ? " e-turn--stack" : it.cont ? " e-turn--cont" : ""}`;
      return turn(cls, avatar, it.el.outerHTML, it.time);
    })
    .concat(trailing.map((html) => turn("e-turn--trailing", "", html)))
    .join("");
}

// Where each avatar stands, against what its turn opens with: a one-line
// element (a status, your source, a line of text, a one-line bubble) gets
// the avatar centred on it; anything taller (a card, a bubble or text that
// wraps, an infobox) gets it on its top edge. Whether a bubble wraps is
// only known once laid out, so it is measured — on every change in the
// screen and every resize — and handed to the CSS as --e-lead. The time
// lives in the avatar's column and follows it.
function alignTurnAvatars(scope) {
  for (const turn of scope.querySelectorAll(".e-turn")) {
    const content = turn.querySelector(":scope > .e-turn__content");
    let box = content?.firstElementChild;
    if (box?.matches(".chat-turn")) box = box.firstElementChild ?? box;
    if (box?.matches("details")) box = box.querySelector(":scope > summary") ?? box;
    if (!box) continue;
    const cs = getComputedStyle(box);
    const r = box.getBoundingClientRect();
    const frame = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce(
      (n, k) => n + parseFloat(cs[k]),
      0,
    );
    const oneLine = r.height - frame < 1.5 * (parseFloat(cs.lineHeight) || 18);
    const top = r.top - content.getBoundingClientRect().top;
    turn.style.setProperty("--e-lead", `${Math.round(oneLine ? top + r.height / 2 - 12 : top)}px`);
  }
}

export function watchTurnAvatars(root) {
  if (!isFlagOn("newConversationStyles")) return () => {};
  let pending = false;
  let live = true;
  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      if (live) alignTurnAvatars(root);
    });
  };
  const mutations = new MutationObserver(schedule);
  mutations.observe(root, { childList: true, subtree: true, characterData: true });
  const resizes = new ResizeObserver(schedule);
  resizes.observe(root);
  document.fonts?.ready.then(schedule);
  schedule();
  return () => {
    live = false;
    mutations.disconnect();
    resizes.disconnect();
  };
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
    return renderSourceIntakeTurn(message, source, {
      focusable: contentCards(),
      active: getFocusKey() === `source:${message.sourceId}`,
    });
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
  // The one exception: the LAST batch of a chat whose Playbook has no image
  // look yet carries a line offering to pick one — derived, so it is gone the
  // moment a look exists, from here or from the Playbook.
  if (message.role === "assistant" && message.variant === "draft") {
    return (contentCards() ? renderDraftsCardTurn(message) : "") + renderImageLookNudge(message, sessionId);
  }

  if (message.role === "assistant" && message.variant === "revision") {
    return renderRevisionTurn(message, sessionId);
  }

  if (message.role === "assistant" && message.variant === "revision-group") {
    return renderRevisionGroupTurn(message, sessionId);
  }

  if (message.role === "assistant" && message.variant === "image-look-set") {
    return renderImageLookSetTurn(message);
  }

  if (message.role === "assistant" && message.variant === "voice-ask") {
    return renderMessageBubble({
      role: "assistant",
      text: voiceAskHtml(getContextById(message.contextId), message.network, message),
    });
  }
  if (message.role === "assistant" && message.variant === "voice-learned") {
    return renderVoiceLearnedTurn(message);
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

  if (message.role === "assistant" && message.variant === "activity") {
    return renderActivityTurn(message);
  }

  if (message.role === "assistant" && message.variant === "failed") {
    return renderFailedTurn(message);
  }

  if (message.role === "assistant" && message.variant === "schedule-plan") {
    return renderSchedulePlanTurn(message, sessionId);
  }

  if (message.role === "assistant" && message.variant === "post-plan") {
    return renderPostPlanTurn(message, sessionId);
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

// The tools a step ran, as the prod thread shows them (chat-thread.component
// toActivityGroup): running → the current tool's name + "…"; done → one tool
// "Name · 1.6s" unfolding its description, several "Ran 3 tools · 3.0s"
// unfolding one row per tool (toolbox glyph, name, duration).
function renderActivityTurn(message) {
  const tools = message.tools || [];
  // Whole seconds, and nothing at all for an instant step ("Set Publishing
  // Accounts", not "… · 0.0s") — the prod's tenths read as noise here.
  const sec = (ms) => Math.round(ms / 1000);
  const dur = (ms) => (sec(ms) > 0 ? ` · ${sec(ms)}s` : "");
  // The pill is a status like any other; what it unfolds — the tool calls —
  // has its own look (assistant-notice__tools, a small card of rows).
  if (message.status === "loading") {
    return renderNotice({
      variant: "mermaid",
      label: `${escapeHtml(toolName(tools[0].tool))}…`,
      loading: true,
      showChevron: false,
      open: false,
    });
  }
  const totalMs = tools.reduce((s, t) => s + (t.ms || 0), 0);
  if (tools.length === 1) {
    return renderNotice({
      variant: "mermaid",
      label: `${escapeHtml(toolName(tools[0].tool, true))}${dur(totalMs)}`,
      open: false,
      bodyHtml: `<div class="assistant-notice__detail">${escapeHtml(toolDescription(tools[0].tool))}</div>`,
    });
  }
  // One row per tool, each on its own line of the card. How long it took is
  // DRAWN, not only written: a bar scaled to the longest tool of the run, so
  // the heavy step stands out; an instant one shows no bar and no time.
  const longest = Math.max(...tools.map((t) => t.ms || 0), 1);
  const rows = tools
    .map((t) => {
      const ms = t.ms || 0;
      const instant = ms < 500;
      return `<li class="assistant-notice__tool${instant ? " is-instant" : ""}">
        <i class="ap-icon-toolbox" aria-hidden="true"></i>
        <span class="assistant-notice__tool-name">${escapeHtml(toolName(t.tool, true))}</span>
        <span class="assistant-notice__tool-bar" aria-hidden="true"><span style="width: ${instant ? 0 : Math.round((ms / longest) * 100)}%"></span></span>
        <span class="assistant-notice__tool-duration">${instant ? "" : `${sec(ms)}s`}</span>
      </li>`;
    })
    .join("");
  return renderNotice({
    variant: "mermaid",
    label: `Ran ${tools.length} tools${dur(totalMs)}`,
    open: false,
    bodyHtml: `<ul class="assistant-notice__detail assistant-notice__tools">${rows}</ul>`,
  });
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

// "Want an image on these?" — under the chat's last batch of drafts, while its
// Playbook has no image look (draft-image-flow.js requireImageLook). Pick a
// look runs the first Generate an image on the batch's first draft, so the
// answer lands as an image straight away.
function renderImageLookNudge(message, sessionId) {
  const brandId = getSessionById(sessionId)?.contextId;
  const first = message.drafts?.[0]?.id;
  if (!first || !needsImageLook(brandId)) return "";
  const last = getThread(sessionId).findLast((m) => m.variant === "draft");
  if (last?.id !== message.id) return "";
  return renderMessageBubble({
    role: "assistant",
    text: `Want an image on these? Pick a look once and I'll add one to any draft in a click.
      <button type="button" class="ap-link" data-image-look-start="${escapeHtml(first)}">Pick a look</button>`,
  });
}

// The look just set — a receipt with Undo, and where to change it. It reads the
// Playbook: a look changed or undone since shows as such, not as still set.
function renderImageLookSetTurn(message) {
  const ctx = getContextById(message.contextId);
  const label = escapeHtml(message.label);
  const brand = escapeHtml(ctx?.brandName || ctx?.name || "this Brand");
  const isSet = ctx?.defaultLook?.kind === "style" && ctx.defaultLook.id === message.styleId;
  const playbook = `<button type="button" class="ap-link" data-image-look-playbook="${escapeHtml(message.contextId)}">the Playbook</button>`;
  return renderMessageBubble({
    role: "assistant",
    text: isSet
      ? `Done. ${brand}'s images start from <strong>${label}</strong> now. Change it any time in ${playbook}.
        <button type="button" class="ap-link" data-image-look-undo="${escapeHtml(message.contextId)}">Undo</button>`
      : ctx?.defaultLook?.kind
        ? `${brand}'s images start from another look now. It changed in ${playbook}.`
        : `${brand}'s images no longer start from ${label}. I'll ask the next time you generate one.`,
  });
}

// What Archie learned for a network in the Voice step — not saved yet: what it
// changes from the default voice, then the answer the flow waits for — use it,
// or edit it in the Playbook (network-voice-flow.js answerLearnedVoice).
function renderVoiceLearnedTurn(message) {
  const ctx = getContextById(message.contextId);
  const label = escapeHtml(networkLabel(message.network));
  const id = escapeHtml(message.id);
  const ask = message.resolved
    ? `<a class="ap-link" href="#/playbook/${escapeHtml(message.contextId)}?tab=voice&amp;voice=${escapeHtml(message.network)}">See ${label} in your Voice profile</a>`
    : `Add them and I'll write with them, or edit them first.
      <div class="voice-learned__actions">
        <button type="button" class="ap-button stroked grey" data-voice-learned="${id}" data-voice-action="edit">Edit in the Playbook</button>
        <button type="button" class="ap-button primary blue" data-voice-learned="${id}" data-voice-action="use">Add to Voice profile</button>
      </div>`;
  return renderMessageBubble({
    role: "assistant",
    text: `Here's what I'd add to your Voice profile for ${label}.
      ${learnedVoiceHtml(ctx, message.network, message.voice, { pending: !message.resolved })}
      ${ask}`,
  });
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
          )}. I'll retry on my own.</span>
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

// A drafts batch as one card: how many, on which networks (icon + name).
function renderDraftsCardTurn(message) {
  const drafts = message.drafts || [];
  const count = message.count ?? drafts.length;
  if (!count) return "";
  const networks = [...new Set(drafts.map((d) => d.network).filter(Boolean))];
  return `
    <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
      ${contentCard({
        kind: "post",
        key: `drafts:${message.id}`,
        ids: drafts.map((d) => d.id),
        icon: "ap-icon-pen",
        title: `${plural(count, "draft")} to review`,
        sub: networks
          .map(
            (n) =>
              `<span class="drafts-card__network"><i class="${networkIcon(n)}" aria-hidden="true"></i>${escapeHtml(networkLabel(n))}</span>`,
          )
          .join(""),
        cta: "Review drafts",
      })}
    </div>
  `;
}

// "What changed" (flag draftChanges): one rewritten draft, my sentence naming
// the change, then the change itself — Changes (one column, added marked,
// removed struck) or Side by side (Before | After). A rewrite that touched
// most of the words opens on Side by side: a word diff of it is confetti.
// A translation is all new words, so it only shows side by side, its columns
// named by language, with its length against the network's limit instead of
// word counts.
// Undo / Redo read the draft as it is now; a draft changed since can't be undone
// from here.
const diffSource = (v) => [
  ...v.text,
  ...(v.hashtags?.length ? [v.hashtags.map((h) => `#${h}`).join(" ")] : []),
  ...(v.cta ? [v.cta] : []),
];
const paragraphsHtml = (runs, view) =>
  diffParagraphs(runs, view)
    .map((p) => `<p class="revision-card__paragraph">${p}</p>`)
    .join("");
// A translation's columns: the text as it reads, no marks.
const plainHtml = (v) =>
  diffSource(v)
    .map((p) => `<p class="revision-card__paragraph">${escapeHtml(p)}</p>`)
    .join("");

// The legend under the text: each count wears its own mark, so it reads the
// marks above as much as it counts them.
function revisionCounts({ added, removed }) {
  const item = (n, kind, verb) =>
    n
      ? `<span class="revision-card__count"><span class="draft-diff__${kind}">${n} word${n === 1 ? "" : "s"}</span> ${verb}</span>`
      : "";
  return `${item(added, "add", "added")}${item(removed, "del", "removed")}`;
}

// "412 → 501 characters, under LinkedIn's 3,000".
function revisionLength(network, before, after) {
  const count = (v) => diffSource(v).join(" ").length;
  const meta = networkMeta(network);
  const limit = meta?.limit
    ? `, ${count(after) > meta.limit ? "over" : "under"} ${meta.label}'s ${meta.limit.toLocaleString("en-US")}`
    : "";
  return `${count(before)} → ${count(after)} characters${limit}`;
}

const UNDONE_STATE = `<i class="ap-icon-rotate-left" aria-hidden="true"></i>Back to the version before`;

// The change itself: the tabs (none for a translation) and the text.
function revisionBody({ id, postId, before, after, intent, view, translated }) {
  const runs = diffWords(diffSource(before), diffSource(after));
  const shown = translated ? "side" : view || (changeRatio(runs) > 0.5 ? "side" : "changes");
  const tab = (key, label) =>
    `<button type="button" class="ap-tabs-tab${shown === key ? " active" : ""}" role="tab" aria-selected="${shown === key}" data-revision-tab="${key}" data-revision-id="${escapeHtml(id)}"${postId ? ` data-revision-post="${escapeHtml(postId)}"` : ""}>${label}</button>`;
  const labels = translated ? [languageOf(before), languageOf(after)] : ["Before", "After"];
  const text =
    shown === "side"
      ? `<div class="revision-card__side">
          <div class="revision-card__col is-before"><p class="revision-card__col-label">${labels[0]}</p>${translated ? plainHtml(before) : paragraphsHtml(runs, "before")}</div>
          <div class="revision-card__col"${translated ? ` lang="${languageOf(after) === "French" ? "fr" : languageOf(after) === "Spanish" ? "es" : "en"}"` : ""}><p class="revision-card__col-label">${labels[1]}</p>${translated ? plainHtml(after) : paragraphsHtml(runs, "after")}</div>
        </div>`
      : `<div class="revision-card__text">${paragraphsHtml(runs, "unified")}</div>`;
  const tabs = translated
    ? ""
    : `<div class="ap-tabs revision-card__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="How to show the changes">${tab("changes", "Changes")}${tab("side", "Side by side")}</div></div>`;
  return { runs, tabs, text };
}

// Where a translation's tabs would be: the move it made.
const languageMove = (before, after) =>
  `<span class="revision-card__lang"><i class="ap-icon-translate" aria-hidden="true"></i>${languageOf(before)} → ${languageOf(after)}</span>`;

function undoButton(id, post, state, postId) {
  const target = postId ? ` data-revision-post="${escapeHtml(postId)}"` : "";
  return state.live
    ? `<button type="button" class="ap-button stroked grey" data-revision-undo="${escapeHtml(id)}"${target}>${state.undone ? "Redo" : "Undo"}</button>`
    : `<span data-tooltip="${post ? "This draft changed since" : "This draft was deleted"}"><button type="button" class="ap-button stroked grey" disabled>Undo</button></span>`;
}

function openDraftButton(key, ids, label) {
  return `<button type="button" class="ap-button secondary blue${getFocusKey() === key ? " is-active" : ""}" data-content-card="post" data-content-key="${key}" data-content-ids="${escapeHtml(ids.join(","))}">${label}</button>`;
}

// The marks are drawn once, as the card lands: a highlighter stroke. The thread
// repaints while it runs, so each repaint resumes the stroke where it is
// (a negative delay) instead of starting it over.
const SWEEP_MS = 1400;

function renderRevisionTurn(message, sessionId) {
  const { id, postId, before, after, intent } = message;
  const translated = intent === "translate";
  const post = getPosts(sessionId).find((p) => p.id === postId);
  const state = revisionState(post, before, after);
  const elapsed = Date.now() - (message.createdAt || 0);
  const fresh = !state.undone && elapsed < SWEEP_MS;
  const { runs, tabs, text } = revisionBody({ id, before, after, intent, view: message.view, translated });
  const key = `revision:${id}`;
  return renderMessageBubble({
    role: "assistant",
    text: `${escapeHtml(revisionSummary(intent, before, after))}
      <section class="revision-card${state.undone ? " is-undone" : ""}${fresh ? " is-fresh" : ""}" ${fresh ? `style="--sweep-elapsed: ${elapsed}ms"` : ""} aria-label="What changed">
        <div class="revision-card__head">
          ${renderProfileTag(profileForNetwork(message.network), { network: message.network })}
          ${translated ? languageMove(before, after) : tabs}
        </div>
        ${text}
        <div class="revision-card__foot">
          <p class="revision-card__${state.undone ? "state" : "legend"}">${
            state.undone
              ? UNDONE_STATE
              : translated
                ? revisionLength(message.network, before, after)
                : revisionCounts(wordCounts(runs))
          }</p>
          <span class="revision-card__actions">
            ${undoButton(id, post, state)}
            ${post ? openDraftButton(key, [postId], "Open draft") : ""}
          </span>
        </div>
      </section>`,
  });
}

// One ask, several drafts: one card, a row per draft — its account and what it
// lost or gained (or its language move); one row open at a time with its
// change, its Undo and Open draft. Undo all / Redo all and Open N drafts in the foot.
function renderRevisionGroupTurn(message, sessionId) {
  const { id, intent, items } = message;
  const translated = intent === "translate";
  const posts = getPosts(sessionId);
  const elapsed = Date.now() - (message.createdAt || 0);
  const rows = items.map((item) => {
    const post = posts.find((p) => p.id === item.postId);
    return { item, post, state: revisionState(post, item.before, item.after) };
  });
  const rowHtml = ({ item, post, state }) => {
    const open = message.openId === item.postId;
    const { runs, tabs, text } = revisionBody({
      id,
      postId: item.postId,
      before: item.before,
      after: item.after,
      intent,
      view: message.views?.[item.postId],
      translated,
    });
    const sum = state.undone
      ? UNDONE_STATE
      : translated
        ? `<i class="ap-icon-translate" aria-hidden="true"></i>${languageOf(item.before)} → ${languageOf(item.after)}`
        : revisionCounts(wordCounts(runs));
    return `
      <div class="revision-group__row${open ? " is-open" : ""}${state.undone ? " is-undone" : ""}">
        <button type="button" class="revision-group__head" data-revision-row="${escapeHtml(id)}" data-revision-post="${escapeHtml(item.postId)}" aria-expanded="${open}">
          ${renderProfileTag(profileForNetwork(item.network), { network: item.network })}
          <span class="revision-group__sum">${sum}</span>
          <i class="ap-icon-chevron-down revision-group__chevron" aria-hidden="true"></i>
        </button>
        ${
          open
            ? `<div class="revision-group__detail">
                ${tabs}
                ${text}
                <div class="revision-group__actions">
                  ${translated ? `<span class="revision-card__legend">${revisionLength(item.network, item.before, item.after)}</span>` : ""}
                  ${undoButton(id, post, state, item.postId)}
                  ${post ? openDraftButton(`revision:${id}:${item.postId}`, [item.postId], "Open draft") : ""}
                </div>
              </div>`
            : ""
        }
      </div>`;
  };
  const live = rows.filter((r) => r.state.live);
  const changed = rows.filter((r) => !r.state.undone).length;
  const allUndone = live.length && live.every((r) => r.state.undone);
  const openable = rows.filter((r) => r.post).map((r) => r.item.postId);
  const fresh = !allUndone && elapsed < SWEEP_MS;
  return renderMessageBubble({
    role: "assistant",
    text: `${escapeHtml(revisionGroupSummary(intent, items))}
      <section class="revision-card revision-group${fresh ? " is-fresh" : ""}" ${fresh ? `style="--sweep-elapsed: ${elapsed}ms"` : ""} aria-label="What changed">
        ${rows.map(rowHtml).join("")}
        <div class="revision-card__foot">
          <p class="revision-card__legend">${changed ? `${changed} draft${changed === 1 ? "" : "s"} changed` : "Back to the versions before"}</p>
          <span class="revision-card__actions">
            ${live.length ? `<button type="button" class="ap-button stroked grey" data-revision-undo-all="${escapeHtml(id)}">${allUndone ? "Redo all" : "Undo all"}</button>` : ""}
            ${openable.length ? openDraftButton(`revision:${id}`, openable, `Open ${openable.length} draft${openable.length === 1 ? "" : "s"}`) : ""}
          </span>
        </div>
      </section>`,
  });
}

function renderExtractionTurn(message, sessionId) {
  const count = message.count ?? (message.ideas ? message.ideas.length : 0);
  if (contentCards() && message.status !== "loading" && count) {
    return `
      <div class="chat-turn chat-turn--ai chat-turn--extraction">
        ${contentCard({
          kind: "idea",
          key: `ideas:${message.id}`,
          ids: (message.ideas || []).map((i) => i.id),
          title: `${plural(count, "idea")} ready`,
          sub: `From <span class="drafts-card__sub-quote">${escapeHtml(message.filename || "your source")}</span>`,
          cta: "View ideas",
        })}
      </div>
    `;
  }
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
          sub: `${filename} was removed from this chat's sources.`,
        })}
      </div>
    `;
  }

  const clipsCount = Array.isArray(source.clips) ? source.clips.length : 0;
  const isReady = source.clipExtractionStatus === "ready" || clipsCount > 0;

  if (!isReady) {
    // Live stage label from the extraction ticker (sources-stream); falls back
    // to a generic line before the first tick lands.
    const convNew = isFlagOn("newConversationStyles");
    const stage = source.clipStage || (convNew ? "Cutting your clips…" : "Cutting your clips");
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${renderResultCard({
          state: "pending",
          busyLabel: stage,
          // OFF (Monday): the stage carries no ellipsis, the title adds it.
          title: convNew ? stage : `${stage}…`,
          sub: "Turning your video into clips. You can keep chatting meanwhile.",
        })}
      </div>
    `;
  }

  const titleLabel = clipsCount === 1 ? "1 clip to review" : `${clipsCount} clips to review`;
  if (contentCards()) {
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${contentCard({
          kind: "clip",
          key: `clips:${source.id}`,
          ids: source.clips.map((c) => c.id),
          icon: "ap-icon-video",
          title: titleLabel,
          sub: `From <span class="drafts-card__sub-quote">${filename}</span>`,
          cta: "Open clips",
        })}
      </div>
    `;
  }
  return `
    <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
      ${renderResultCard({
        state: "ready",
        icon: isFlagOn("newConversationStyles") ? "ap-icon-video" : undefined,
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
          title: isFlagOn("newConversationStyles") ? "Extracting ideas from content…" : "Reading the video for ideas…",
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
          sub: `${filename} was removed from this chat's sources.`,
        })}
      </div>
    `;
  }

  if (contentCards()) {
    const ids = getIdeas(sessionId)
      .filter((i) => i.sourceIds?.includes(source.id))
      .map((i) => i.id);
    return `
      <div class="chat-turn chat-turn--ai chat-turn--clip-extraction">
        ${contentCard({
          kind: "idea",
          key: `ideas:${message.id}`,
          ids,
          title: ids.length ? `${plural(ids.length, "idea")} ready` : "Ideas ready",
          sub: `From <span class="drafts-card__sub-quote">${filename}</span>`,
          cta: "View ideas",
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

// The post plan recap (post-plan-flow.js) — read live from post-plan-store, so
// its stage follows the plan. Three lists in the prod's order: what I'll
// assume, what I won't invent because it wasn't given, what you asked me to
// leave out (only when there is something). A plan without a single fact gets
// the prod's "likely generic" warning.
const PLAN_STAGE_LABEL = {
  planning: "Being planned",
  ready: "Ready",
  writing: "Writing",
  written: "Drafts written",
};

function renderPostPlanTurn(message, sessionId) {
  const plan = getPlans(sessionId).find((p) => p.id === message.planId);
  if (!plan) return "";
  const list = (title, items) =>
    items.length
      ? `<div class="post-plan__section">
          <span class="post-plan__heading">${title}</span>
          <ul class="post-plan__list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>`
      : "";
  const generic = plan.generic
    ? `<div class="ap-infobox warning">
        <i class="ap-icon-warning_fill" aria-hidden="true"></i>
        <div class="ap-infobox-content">
          <div class="ap-infobox-texts">
            <span class="ap-infobox-message">With no fact to build on, these drafts will likely read generic. Add one and I'll use it.</span>
          </div>
        </div>
      </div>`
    : "";
  const tone = plan.stage === "written" ? "green" : plan.stage === "writing" ? "orange" : "grey";
  return `
    <div class="chat-turn chat-turn--ai">
      <i class="ap-icon-archie-official chat-turn-avatar" aria-hidden="true"></i>
      <div class="chat-bubble chat-bubble--ai">
        <div class="chat-bubble-text">Here's the post plan (${plan.perProfile} drafts per account).</div>
        <div class="post-plan">
          <div class="post-plan__head">
            <span class="post-plan__topic">${escapeHtml(plan.topic.charAt(0).toUpperCase() + plan.topic.slice(1))}</span>
            <span class="ap-status ${tone}">${PLAN_STAGE_LABEL[plan.stage] || ""}</span>
          </div>
          ${plan.facts.length ? list("Built on", plan.facts) : ""}
          ${list("I'll assume this", plan.assumptions)}
          ${list("Not given yet, so I won't invent it", plan.missing)}
          ${list("Left out, as you asked", plan.leftOut)}
          ${generic}
        </div>
      </div>
    </div>
  `;
}

// "Schedule all the drafts" — my plan, readable at a glance: one row per draft,
// sorted by date, the draft on the left (network glyph + its reference), its
// date on the right in a column that reads top to bottom. A row whose draft has
// left the store (scheduled) keeps its label as plain text.
function renderSchedulePlanTurn(message, sessionId) {
  const day = (ts) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = formatTimeOfDay;
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
              ? `<button type="button" class="schedule-plan__when schedule-plan__when--edit" data-schedule-plan-edit="${message.id}" aria-label="Change the date: ${day(r.when)}, ${time(r.when)}" data-tooltip="Change date or time">
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
