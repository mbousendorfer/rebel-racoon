import { html, raw, escapeText, escapeAttr } from "../utils.js?v=1079";
import { renderTopbar } from "../components/topbar.js?v=1079";
import {
  getContexts,
  getContextById,
  subscribe as subscribeContexts,
  duplicateContext,
  deleteContext,
} from "../contexts-store.js?v=1079";
import { getSessions, getSessionById, subscribe as subscribeSessions } from "../sessions-store.js?v=1079";
import { parseHashParams, setHashQuery } from "../url-state.js?v=1079";
import { closePanel as closeRightPanel } from "../components/right-panel.js?v=1079";
import { navigate, getPath } from "../router.js?v=1079";
import { setHandoff } from "../handoff.js?v=1079";
import { open as openConfirmModal } from "../components/confirm-modal.js?v=1079";
import { renderEmptyState } from "../components/empty-state.js?v=1079";
import {
  visibleContexts,
  usableContexts,
  canView,
  canEdit,
  canDelete,
  canManageSharing,
  accessLabel,
  isMine,
} from "../playbook-access.js?v=1079";
import { isWorkspaceMode, getActivePlaybookId, setActivePlaybook, catalogueRoute } from "../active-playbook.js?v=1079";
import { open as openShareModal } from "../components/share-playbook-modal.js?v=1079";

// The account HOME — and the Playbooks catalogue it merged with.
//
// ── Two levels, two homes ─────────────────────────────────────────────────
// `/` is the home of the active BRAND: a pure redirect to its most recent chat
// (dashboard.js). This is the home of the ACCOUNT — the level above the
// workspaces, where the two things that exist at that level live: the catalogue
// of brands, and every chat, all brands. A hero on top turns it from a place
// that only manages into a place you start from: type, pick a Playbook, Enter.
//
// ⚠️ NOT the front page that was deleted. `frontPage` made `/` a magazine fed by
// listening, and that arbitration is closed (CLAUDE.md § The Topic Feed). The
// test that separates them: the front page was a page of what Archie PROPOSES;
// this is a page of what you HAVE. No Topic, no topics-store read, and `/` is
// untouched.
//
// ── Two routes, one module ────────────────────────────────────────────────
//   /home      → renderHome          the hero + the two tabs   (workspace mode)
//   /contexts  → renderContextsRoute the catalogue on its own   (flag OFF)
// Each gates itself and bounces, the way /topics and /insights do, so a stale
// deep link lands somewhere real instead of rendering a dead screen. The
// catalogue path is byte-for-byte what it was: flag OFF, nothing here changed.
//
// ⚠️ The names still say `contexts` — the classes (`.contexts-view__*`,
// `.contexts-card*`) and the stylesheet (styles/screens/contexts.css). Renaming
// them would touch a stylesheet and every card selector for something no user
// can see; same call as the `.isv2-` prefix in the Image Studio.

let unsubs = [];
// Where this screen paints — the router's #app. Held at module level because
// every repaint path (a store notify, Clear search, a tab switch) has to reach
// it, and bind() is handed the SECTION, not this.
let mountTarget = null;
let pageState = { query: "", pickedPlaybookId: null };
// Which of the two surfaces this mount is. Module-level rather than threaded
// through every renderer: the search's partial repaint needs it too.
let isHome = false;

export function renderHome(_params, target) {
  // No level above the work without the workspace model — so no home either.
  if (!isWorkspaceMode()) {
    replaceHash("/");
    return;
  }
  return mountScreen(target, true);
}

export function renderContextsRoute(_params, target) {
  // In workspace mode the catalogue IS the home's Playbooks tab. Kept as a
  // route so every stale deep link and every inbound navigate still lands.
  if (isWorkspaceMode()) {
    replaceHash("/home");
    return;
  }
  return mountScreen(target, false);
}

// `replace`, not navigate(): a redirect that writes a history entry gives the
// reader a Back button that lands on the route it just left and bounces again —
// a Back that does nothing. Same call dashboard.js makes for the same reason.
function replaceHash(path) {
  window.location.replace(window.location.href.split("#")[0] + "#" + path);
}

function mountScreen(target, home) {
  isHome = home;
  mountTarget = target;
  renderTopbar();
  drainSubs();
  paint();
  // FIND-B: tear the subscriptions down on route change so off-route
  // notifications don't repaint a target that no longer holds this view.
  unsubs.push(subscribeContexts(() => paint()));
  // The Chats tab has to move when a chat is renamed, pinned or deleted
  // somewhere else — the rail's ⋮ menu, mostly.
  if (home) unsubs.push(subscribeSessions(() => paint()));
  return () => {
    drainSubs();
    // Switching tab is a query-only change, which re-runs this handler: the
    // path is already the NEW one here, so a tab switch keeps the search box
    // and leaving the surface forgets it.
    if (getPath() !== "/home") pageState = { query: "", pickedPlaybookId: null };
  };
}

function drainSubs() {
  unsubs.forEach((off) => off());
  unsubs = [];
}

function paint() {
  const target = mountTarget;
  if (!target) return;
  target.innerHTML = html`<section class="screen contexts-view" data-home-root>${raw(renderPage())}</section>`;
  // ⚠️ Bind to the SECTION, not to `target`. `target` is #app, which paint()
  // never replaces — so every repaint (a store notify, Clear search) stacked
  // another pair of listeners on it, and after two paints one click on the
  // ghost card minted two sessions. The section's innerHTML IS replaced, so
  // its listeners die with the node. `querySelector` rather than
  // firstElementChild: the html`` template can leave a leading text node.
  bind(target.querySelector("[data-home-root]"));
}

// Which list the home is showing. In the URL, like every other screen state
// here (`?tab=` on a session, `?pb=` on the feed): the two lists are then
// linkable and the browser's Back moves between them. An unknown value falls
// back rather than rendering nothing.
function activeTab() {
  return parseHashParams().get("tab") === "chats" ? "chats" : "playbooks";
}

function renderPage() {
  // What I'm allowed to see, not what the store holds — a colleague's private
  // Playbook is in the store and must not be in this grid.
  const all = visibleContexts();
  const totalChats = all.reduce((sum, c) => sum + (c.usedIn || 0), 0);

  // Flag OFF — the catalogue on its own, header and all, exactly as before.
  if (!isHome) {
    return html`
      <div class="contexts-view__page">
        <header class="contexts-view__head">
          <div class="contexts-view__head-text">
            <h1 class="contexts-view__title">Playbooks</h1>
            <p class="contexts-view__sub">${all.length} Playbooks · applied across ${totalChats} chats</p>
          </div>
          <div class="contexts-view__head-actions">${raw(renderSearchField())}${raw(renderCreateButton())}</div>
        </header>

        <div class="contexts-view__body">${raw(renderTabBody())}</div>
      </div>
    `;
  }

  // The home. No `h1 Playbooks` and no count sub-line up here: the hero owns
  // the page's only h1, and a heading reading "Playbooks" forty pixels under a
  // tab reading "Playbooks 8" is the same word twice with the same number
  // beside it. What the sub-line said that the tab doesn't survives in the
  // toolbar under it.
  const tab = activeTab();
  return html`
    <div class="contexts-view__page">
      ${raw(renderHomeHero())} ${raw(renderHomeTabs(all.length, getSessions().length, tab))}
      ${raw(renderHomeToolbar(tab, totalChats))}
      <div class="contexts-view__body">${raw(renderTabBody())}</div>
    </div>
  `;
}

// ⚠️ ONE body renderer, two callers: renderPage() and the search's `input`
// handler, which repaints only this so the field keeps its caret. They were two
// copies and they had drifted twice — the partial one read getContexts() where
// the page reads visibleContexts() (so typing surfaced a colleague's private
// Playbook) and it forgot the ghost card (which vanished on the first
// keystroke). Two callers, one function: they cannot drift again.
function renderTabBody() {
  if (isHome && activeTab() === "chats") return renderChatsTab();
  const all = visibleContexts();
  const visible = filter(all, pageState);
  if (visible.length === 0) return renderContextsEmpty(all, pageState);
  return `<div class="contexts-view__grid">${visible.map(renderContextCard).join("")}${renderGhostCard()}</div>`;
}

function renderSearchField() {
  const chats = isHome && activeTab() === "chats";
  return `
    <div class="ap-input-group contexts-view__search">
      <i class="ap-icon-search"></i>
      <input
        type="search"
        class="ap-input"
        placeholder="${chats ? "Search chats…" : "Search Playbooks…"}"
        value="${escapeAttr(pageState.query)}"
        data-contexts-search
      />
    </div>
  `;
}

function renderCreateButton() {
  return `
    <button type="button" class="ap-button primary blue" data-contexts-new>
      <i class="ap-icon-plus"></i>
      <span>Create a Playbook</span>
    </button>
  `;
}

// ── The hero — the reason this page exists ────────────────────────────────
//
// Type, pick the brand, Enter. It is the one thing the catalogue could not do:
// manage, yes; start, no.
//
// ⚠️ NOT `.empty-chat`, which is the chat's own hero: `.app-shell:has(.empty-chat)`
// in layout.css HIDES the app topbar, and here the topbar carries the only way
// back into the work. Its own classes, its own stylesheet.
//
// No wordmark either — this page is reached by clicking the wordmark, and
// printing it again is the click's own echo.
function renderHomeHero() {
  const options = usableContexts();
  // Nothing to pick from → no hero. A dead composer over an empty picker is
  // exactly the "greyed-out field the reader has to rule out" that the six
  // in-flow pickers were deleted for. The Playbooks tab's own empty state
  // already carries the one useful move, and it should say it once.
  if (options.length === 0) return "";
  const picked = pickedPlaybook();
  return `
    <section class="home-hero">
      <h1 class="home-hero__title">What are we working on?</h1>
      <p class="home-hero__sub">Pick a Playbook, tell me what you need, and I'll open a chat on it.</p>

      <div class="home-hero__card">
        <textarea
          class="home-hero__input"
          rows="3"
          placeholder="Tell me what you need…"
          aria-label="Tell me what you need"
          data-home-prompt
        ></textarea>
        <div class="home-hero__toolbar">
          ${renderHeroPicker(picked, options)}
          <button
            type="button"
            class="ap-button primary orange home-hero__send"
            data-home-send
            aria-label="Send"
            title="Send"
            disabled
          >
            <i class="ap-icon-arrow-up"></i>
          </button>
        </div>
      </div>

      <p class="home-hero__hint">
        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
      </p>
    </section>
  `;
}

// The brand this chat will run on. `usableContexts()`, not visibleContexts():
// a fiche you may read is not necessarily one you may write under.
function pickedPlaybook() {
  const options = usableContexts();
  const wanted = pageState.pickedPlaybookId;
  return (
    (wanted && options.find((c) => c.id === wanted)) ||
    options.find((c) => c.id === getActivePlaybookId()) ||
    options[0] ||
    null
  );
}

// Same DS select as the rail's switcher, deliberately: it is the same question
// about the same object, so it should be the same control. Minus the footer —
// "All playbooks" IS this page, and the surface already carries two doors to
// creating one (the toolbar button and the grid's ghost card).
function renderHeroPicker(picked, options) {
  const rows = options
    .map((c) => {
      const on = picked && c.id === picked.id;
      return `
        <div
          class="ap-select-option${on ? " selected" : ""}"
          data-home-pb-pick="${escapeAttr(c.id)}"
          role="option"
          aria-selected="${on ? "true" : "false"}"
        >
          <span class="app-sidebar__row-color-dot app-sidebar__row-color-dot--${escapeAttr(c.color || "grey")}" aria-hidden="true"></span>
          <span class="ap-select-option-text">${escapeText(c.name)}</span>
          ${on ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
        </div>
      `;
    })
    .join("");
  return `
    <details class="ap-select home-hero__pb" data-home-pb>
      <summary class="ap-select-trigger" title="Playbook: ${escapeAttr(picked?.name || "")} — the brand this chat runs on">
        <span class="app-sidebar__row-color-dot app-sidebar__row-color-dot--${escapeAttr(picked?.color || "grey")}" aria-hidden="true"></span>
        <span class="ap-select-inline-label">Playbook</span>
        <span class="ap-select-value">${escapeText(picked?.name || "Select a Playbook")}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown home-hero__pb-dropdown" role="listbox" aria-label="Choose a Playbook">
        <div class="ap-select-options">${rows}</div>
      </div>
    </details>
  `;
}

// ── The two lists ─────────────────────────────────────────────────────────
// Real DS tabs (.ap-tabs ships in ds/css-ui). /topics dropped its tabs because
// only one list was ever on screen there; here there are genuinely two, which
// is the case the component is for. Counters are safe on both: each counts
// THINGS, so "Chats 12" reads as twelve chats.
function renderHomeTabs(playbookCount, chatCount, tab) {
  const item = (id, icon, label, count) => {
    const on = tab === id;
    return `
      <button
        type="button"
        class="ap-tabs-tab${on ? " active" : ""}"
        role="tab"
        aria-selected="${on ? "true" : "false"}"
        data-home-tab="${id}"
      >
        <i class="${icon}" aria-hidden="true"></i>
        <span>${label}</span>
        <span class="ap-counter normal ${on ? "blue" : "grey"}">${count}</span>
      </button>
    `;
  };
  return `
    <div class="ap-tabs home-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Playbooks and chats">
        ${item("playbooks", "ap-icon-target", "Playbooks", playbookCount)}
        ${item("chats", "ap-icon-single-chat-bubble", "Chats", chatCount)}
      </div>
    </div>
  `;
}

// Under the tabs rather than beside them: the DS nav owns its full-width rule,
// and hanging a search field inside a [role=tablist] would put a non-tab in it.
function renderHomeToolbar(tab, totalChats) {
  const hint =
    tab === "playbooks"
      ? `<p class="home-toolbar__hint muted">Applied across ${totalChats} chats</p>`
      : `<p class="home-toolbar__hint muted">Every chat, every Playbook.</p>`;
  return `
    <div class="home-toolbar">
      ${hint}
      <div class="home-toolbar__actions">
        ${renderSearchField()}
        ${tab === "playbooks" ? renderCreateButton() : ""}
      </div>
    </div>
  `;
}

// The Chats tab — `getSessions()`, UNSCOPED. That is the whole point of the
// tab: at the account level the question is "where is my work", and the rail
// one level down already answers "this brand's work".
//
// .ap-table rather than .ap-list-panel: the latter is a master-detail left
// column (border-right, height 100%) with no column structure, and this needs
// three aligned columns.
function renderChatsTab() {
  const q = (pageState.query || "").trim().toLowerCase();
  const rows = getSessions()
    .map((s) => ({ session: s, ctx: chatPlaybook(s) }))
    .filter(({ session, ctx }) => {
      if (!q) return true;
      // The brand is a visible column, so it has to be searchable.
      return `${session.name} ${ctx?.name || ""}`.toLowerCase().includes(q);
    })
    // Pinned first, then the store's own order (newest first) — the same
    // ordering the rail and the search modal lead with. No sort control: that
    // is the rail's, and this is not the rail.
    .sort((a, b) => Number(!!b.session.pinned) - Number(!!a.session.pinned));

  if (rows.length === 0) {
    return q
      ? renderEmptyState({
          icon: "ap-icon-search",
          title: "No chats match",
          body: `No chat matches "${escapeText(pageState.query)}". Try a different term.`,
          actionHtml: `<button type="button" class="ap-button stroked grey" data-contexts-clear-query>Clear search</button>`,
          wrapperClass: "contexts-view__empty contexts-view__empty--rich",
          level: 2,
        })
      : renderEmptyState({
          icon: "ap-icon-single-chat-bubble",
          title: "No chats yet",
          body: "Start one from the box above — pick a Playbook and tell me what you need.",
          wrapperClass: "contexts-view__empty contexts-view__empty--rich",
          level: 2,
        });
  }

  const body = rows
    .map(
      ({ session, ctx }) => `
      <tr data-home-chat="${escapeAttr(session.id)}" role="button" tabindex="0">
        <td>
          <div class="ap-table-cell-content">
            ${session.pinned ? `<i class="ap-icon-pin home-chats__pin" title="Pinned" aria-hidden="true"></i>` : ""}
            <span class="home-chats__name">${escapeText(session.name)}</span>
          </div>
        </td>
        <td>
          <div class="ap-table-cell-content">
            <span class="app-sidebar__row-color-dot app-sidebar__row-color-dot--${escapeAttr(ctx?.color || "grey")}" aria-hidden="true"></span>
            <span class="${ctx ? "" : "muted"}">${ctx ? escapeText(ctx.name) : "No Playbook"}</span>
          </div>
        </td>
        <td class="home-chats__when">${escapeText(session.lastActivity || "")}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <table class="ap-table small outer-border home-chats">
      <thead>
        <tr>
          <th scope="col">Chat</th>
          <th scope="col">Playbook</th>
          <th scope="col">Last activity</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// The Playbook behind a chat, but only if I may open it — same rule the rail's
// rows follow: a chat that lost access shows the grey dot and the neutral word,
// never a name it can't reach.
function chatPlaybook(session) {
  if (!session?.contextId) return null;
  const ctx = getContextById(session.contextId);
  return ctx && canView(ctx) ? ctx : null;
}

// FIND-B4: rich empty state — separates "no contexts at all" (first-run)
// from "search active with no match". Returning user with everything
// deleted hits the same first-run path, which is fine — both want a
// "Create your first context" CTA.
function renderContextsEmpty(allContexts, pageState) {
  const hasQuery = (pageState.query || "").trim().length > 0;
  if (allContexts.length === 0) {
    return renderEmptyState({
      icon: "ap-icon-target",
      title: "No Playbooks yet",
      body: "Capture your brand, audience, brief, and tone of voice — I'll apply it to every draft.",
      actionHtml: `<button type="button" class="ap-button primary blue" data-contexts-new><i class="ap-icon-plus"></i><span>Create your first Playbook</span></button>`,
      wrapperClass: "contexts-view__empty contexts-view__empty--rich",
    });
  }
  if (hasQuery) {
    return renderEmptyState({
      icon: "ap-icon-search",
      title: "No Playbooks match",
      body: `No Playbook matches "${escapeText(pageState.query)}". Try a different term.`,
      actionHtml: `<button type="button" class="ap-button stroked grey" data-contexts-clear-query>Clear search</button>`,
      wrapperClass: "contexts-view__empty contexts-view__empty--rich",
    });
  }
  return renderEmptyState({
    icon: "ap-icon-target",
    title: "No Playbooks to show",
    body: "Create one to get started.",
    wrapperClass: "contexts-view__empty contexts-view__empty--rich",
  });
}

// Claude-Projects-style summary card. The card is the primary
// "what is this context" affordance — readable at a glance, with
// secondary actions tucked into a hover-reveal toolbar in the
// top-right corner. DO/DON'T lists and the tones chip row moved
// out: they bloated the card without helping identification, and
// they live in the read panel where they belong.
// Trailing "ghost" card — visually invites a new Playbook from the grid
// itself, so the user doesn't have to chase the header CTA after scrolling.
// Triggers the same `data-contexts-new` handler as the header button.
function renderGhostCard() {
  return `
    <button type="button" class="contexts-card contexts-card--ghost" data-contexts-new aria-label="Create a new Playbook">
      <span class="contexts-card--ghost__glyph"><i class="ap-icon-archie-official"></i></span>
      <span class="contexts-card--ghost__title">Create a Playbook</span>
      <span class="contexts-card--ghost__sub">One brand, one voice, one goal — I'll keep every draft aligned.</span>
    </button>
  `;
}

function renderContextCard(ctx) {
  const color = ctx.color || "orange";
  const summary = (ctx.businessSummary || ctx.briefSummary || "").trim();
  const voiceHeadline =
    ctx.voiceProfile?.headline ||
    (Array.isArray(ctx.tones) && ctx.tones.length ? ctx.tones.join(" · ").toLowerCase() : "");
  const audienceCount = Array.isArray(ctx.audience) ? ctx.audience.length : ctx.audience ? 1 : 0;
  // `suggested` entries are still pending proposals from Archie, not
  // competitors of this brand yet — they must not inflate the count.
  const competitorCount = Array.isArray(ctx.competitors) ? ctx.competitors.filter((c) => !c.suggested).length : 0;
  const usedIn = ctx.usedIn || 0;
  // Brand color preview — first website's primary / accent / link from
  // imageVoice, up to 3 dots. Matches the "people avatars" affordance
  // in the Claude reference but uses the analysed brand palette.
  const site = ctx.imageVoice?.websites?.[0];
  const paletteDots = site
    ? [site.colors?.primary, site.colors?.accent, site.colors?.link]
        .filter((c, i, arr) => c && arr.indexOf(c) === i)
        .slice(0, 3)
    : [];
  const dotsHtml = paletteDots.length
    ? `<div class="contexts-card__palette" aria-hidden="true">${paletteDots
        .map((c) => `<span class="contexts-card__palette-dot" style="background:${escapeAttr(c)};"></span>`)
        .join("")}</div>`
    : "";
  const isDefaultBadge = ctx.isDefault
    ? `<span class="contexts-card__badge" title="Default Playbook"><i class="ap-icon-star_fill"></i></span>`
    : "";
  // Who this Playbook belongs to, in the card's metadata corner next to the
  // palette dots — never a coloured border, a card's state goes in its content.
  // It tried living beside the title first and broke long names onto two lines;
  // the foot is also where the Claude reference puts its people avatars.
  // Mine-and-private says nothing, because that's the default nobody needs told.
  const access = accessLabel(ctx);
  const ownerTag = access
    ? `<span class="ap-tag grey mini contexts-card__owner" title="${escapeAttr(access)}">
        <i class="${isMine(ctx) ? "ap-icon-multiple-users" : "ap-icon-user"}" aria-hidden="true"></i>
        <span>${escapeText(access)}</span>
      </span>`
    : "";
  // Only the actions I can actually take. For a Playbook someone shared with
  // me that's Duplicate alone — the one move that turns reading into having.
  const actions = [
    canManageSharing(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-share="${ctx.id}" title="Share" aria-label="Share">
          <i class="ap-icon-share"></i>
        </button>`
      : "",
    canEdit(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-edit="${ctx.id}" title="Edit" aria-label="Edit">
          <i class="ap-icon-pen"></i>
        </button>`
      : "",
    `<button type="button" class="ap-icon-button transparent" data-contexts-duplicate="${ctx.id}" title="Duplicate" aria-label="Duplicate">
      <i class="ap-icon-copy"></i>
    </button>`,
    canDelete(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-delete="${ctx.id}" title="Delete" aria-label="Delete">
          <i class="ap-icon-trash"></i>
        </button>`
      : "",
  ].join("");
  // ── Entering a brand vs. reading its fiche ──────────────────────────────
  //
  // The card BODY opens the fiche, in both models. It was wired to enter the
  // workspace for one commit and that was wrong twice over: the management
  // verbs (the pen included) are revealed on hover, so a slightly wide click
  // lands on the body — and there the costs are not symmetrical. Opening a
  // fiche is a page; switching brand moves the whole app. The ambient target
  // gets the harmless meaning, the explicit control gets the scope move.
  //
  // Which is why the scope move needs a control here at all: in account scope
  // the rail — and with it the switcher — is off screen, so without this link
  // the catalogue could only ever send you back where you came from.
  const isCurrent = isWorkspaceMode() && ctx.id === getActivePlaybookId();
  const currentTag = isCurrent
    ? `<span class="ap-tag blue mini contexts-card__current"><span>Current</span></span>`
    : "";
  // "Switch", not "Open": the body already opens something, and only a scope
  // can be switched — the word says which of the two doors this is.
  const switchLink =
    isWorkspaceMode() && !isCurrent
      ? `<button
          type="button"
          class="ap-link small contexts-card__switch"
          data-contexts-switch="${ctx.id}"
          title="Switch to ${escapeAttr(ctx.name)}"
          aria-label="Switch to ${escapeAttr(ctx.name)}"
        >Switch</button>`
      : "";
  return `
    <article class="contexts-card contexts-card--${color}" data-contexts-card="${ctx.id}" role="button" tabindex="0">
      <span class="contexts-card__swatch" aria-hidden="true"></span>

      <div class="contexts-card__actions" data-contexts-card-actions>${actions}</div>

      <header class="contexts-card__head">
        <h3 class="contexts-card__name">
          ${escapeText(ctx.name)}
          ${isDefaultBadge}
        </h3>
      </header>

      ${
        voiceHeadline
          ? `<div class="contexts-card__voice">
              <i class="ap-icon-archie-official"></i>
              <span>${escapeText(voiceHeadline)}</span>
            </div>`
          : ""
      }

      ${
        summary
          ? `<p class="contexts-card__brief">${escapeText(summary)}</p>`
          : `<p class="contexts-card__brief contexts-card__brief--empty">No brief yet — open this Playbook to add one.</p>`
      }

      <footer class="contexts-card__foot">
        <div class="contexts-card__counters">
          <span class="contexts-card__counter" title="${usedIn} ${usedIn === 1 ? "chat uses this Playbook" : "chats use this Playbook"}">
            <i class="ap-icon-single-chat-bubble"></i>
            <span>${usedIn}</span>
          </span>
          ${
            audienceCount
              ? `<span class="contexts-card__counter" title="${audienceCount} ${audienceCount === 1 ? "audience" : "audiences"}">
                  <i class="ap-icon-target"></i>
                  <span>${audienceCount}</span>
                </span>`
              : ""
          }
          ${
            competitorCount
              ? `<span class="contexts-card__counter" title="${competitorCount} ${competitorCount === 1 ? "competitor" : "competitors"}">
                  <i class="ap-icon-buildings"></i>
                  <span>${competitorCount}</span>
                </span>`
              : ""
          }
        </div>
        <div class="contexts-card__meta">
          ${currentTag}
          ${ownerTag}
          ${dotsHtml}
        </div>
      </footer>

      <div class="contexts-card__updated">
        <span>Updated ${escapeText(ctx.updatedAt || "recently")}</span>
        ${switchLink}
      </div>
    </article>
  `;
}

function filter(list, { query }) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.brandName || "").toLowerCase().includes(q) ||
      (c.briefSummary || "").toLowerCase().includes(q),
  );
}

// A shared Playbook takes other people's work down with it, so the confirm says
// how many chats and what survives — not just "this will be removed".
function deleteBody(ctx) {
  if (ctx.scope !== "organization") {
    return `"${ctx.name}" will be removed. Chats using it will need a new Playbook.`;
  }
  const n = ctx.usedIn || 0;
  const who = n === 1 ? "1 chat" : `${n} chats`;
  return n
    ? `"${ctx.name}" is shared with your organisation and ${who} run on it. They keep the drafts already written — those can still be saved or scheduled — but they won't generate anything new.`
    : `"${ctx.name}" is shared with your organisation. It disappears from everyone's list. Playbooks duplicated from it are their own and stay untouched.`;
}

function bind(root) {
  root.addEventListener("click", (event) => {
    // The hero's picker is a <details>: it doesn't close itself on an outside
    // click. Before the dispatch guards, so a click on empty page space shuts
    // it. No document listener — paint() recreates this node, and a listener on
    // the document would outlive it.
    const openPicker = root.querySelector("[data-home-pb][open]");
    if (openPicker && !openPicker.contains(event.target)) openPicker.removeAttribute("open");

    // Tabs — the state lives in the URL, so the router repaints and Back works.
    const tabBtn = event.target.closest("[data-home-tab]");
    if (tabBtn) {
      event.preventDefault();
      const next = tabBtn.dataset.homeTab;
      if (next !== activeTab()) setHashQuery("/home", { tab: next });
      return;
    }

    // Picking a brand in the hero writes NOTHING but the pick. The scope moves
    // on Send, which is the explicit commit — a picker that silently re-scoped
    // the app is the exact failure active-playbook.js's header describes.
    // Repaint only the picker: the textarea beside it holds what the reader
    // typed, and a full paint would throw it away.
    const pbPick = event.target.closest("[data-home-pb-pick]");
    if (pbPick) {
      event.preventDefault();
      pageState.pickedPlaybookId = pbPick.dataset.homePbPick;
      const host = root.querySelector("[data-home-pb]");
      if (host) host.outerHTML = renderHeroPicker(pickedPlaybook(), usableContexts());
      return;
    }

    if (event.target.closest("[data-home-send]")) {
      event.preventDefault();
      submitHomePrompt(root);
      return;
    }

    // A chat row. Opening a chat from up here has to re-scope: otherwise the
    // reader lands on a conversation the rail beside it doesn't list.
    const chatRow = event.target.closest("[data-home-chat]");
    if (chatRow) {
      openChatFromHome(chatRow.dataset.homeChat);
      return;
    }

    const shareBtn = event.target.closest("[data-contexts-share]");
    if (shareBtn) {
      event.stopPropagation();
      // The store notifies on commit and this screen is subscribed, so the card's
      // mark repaints on its own — no onDone needed here.
      openShareModal({ contextId: shareBtn.dataset.contextsShare });
      return;
    }
    // Edit (pen icon) — opens the Playbook detail page, where the brief
    // panel handles in-place edits (rename, toggle chips, change brand
    // color, etc.).
    const editBtn = event.target.closest("[data-contexts-edit]");
    if (editBtn) {
      event.stopPropagation();
      navigate(`/playbook/${editBtn.dataset.contextsEdit}`);
      return;
    }
    if (event.target.closest("[data-contexts-new]")) {
      // Launch the conversational Playbook flow (welcome-alt) integrated in
      // the app shell: the `welcomeAltIntegrated` flag keeps the sidebar +
      // topbar visible and the recap finishes by returning here (no
      // switch-to-returning). A `welcome-alt-` session id gets the flow + hero.
      try {
        window.sessionStorage.setItem("welcomeAltIntegrated", "1");
        window.sessionStorage.setItem("welcomeAltReturnTo", catalogueRoute());
      } catch {
        /* ignore */
      }
      setHandoff("pendingStartContextBuilder", { flow: "alt", prefilledUrl: "", returnTo: catalogueRoute() });
      navigate(`/session/welcome-alt-${Date.now().toString(36)}`);
      return;
    }
    if (event.target.closest("[data-contexts-clear-query]")) {
      pageState.query = "";
      paint();
      return;
    }
    const dupBtn = event.target.closest("[data-contexts-duplicate]");
    if (dupBtn) {
      event.stopPropagation();
      const copy = duplicateContext(dupBtn.dataset.contextsDuplicate);
      if (copy) {
        import("../components/toast.js?v=1079").then(({ showToast }) => showToast("Playbook duplicated"));
        navigate(`/playbook/${copy.id}`);
      }
      return;
    }
    const delBtn = event.target.closest("[data-contexts-delete]");
    if (delBtn) {
      event.stopPropagation();
      const ctx = getContexts().find((c) => c.id === delBtn.dataset.contextsDelete);
      if (!ctx) return;
      if (getContexts().length <= 1) {
        import("../components/toast.js?v=1079").then(({ showToast }) =>
          showToast("Can't delete the last Playbook — every chat needs one."),
        );
        return;
      }
      // FIND-C1: DS confirm-modal so the delete prompt is keyboard-
      // accessible, themed, and consistent with the rest of the prototype.
      openConfirmModal({
        title: "Delete Playbook?",
        body: deleteBody(ctx),
        confirmLabel: "Delete Playbook",
        cancelLabel: "Keep",
        danger: true,
        onConfirm: () => {
          deleteContext(ctx.id);
          import("../components/toast.js?v=1079").then(({ showToast }) => showToast("Playbook deleted"));
        },
      });
      return;
    }
    // "Switch" — make this brand the active workspace and go into its work.
    // `/` resolves that home (dashboard.js): its most recent chat, else a fresh
    // one. Before the card-body fallback below, and it stops propagation, so
    // the two doors on one card can't both fire.
    const switchBtn = event.target.closest("[data-contexts-switch]");
    if (switchBtn) {
      event.stopPropagation();
      setActivePlaybook(switchBtn.dataset.contextsSwitch);
      navigate("/");
      return;
    }
    // Card click — anywhere outside the action buttons opens the panel in
    // read-only mode for inspection. The footer buttons stop propagation
    // so they win over this fallback.
    const card = event.target.closest("[data-contexts-card]");
    if (card) {
      navigate(`/playbook/${card.dataset.contextsCard}`);
      return;
    }
  });

  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-contexts-search]")) {
      pageState.query = event.target.value || "";
      // Repaint the body in place so empty <-> grid transitions both work
      // without losing the search field's focus — through renderTabBody(), the
      // one renderer the full paint also uses.
      const body = root.querySelector(".contexts-view__body");
      if (body) body.innerHTML = renderTabBody();
      return;
    }
    // Typing in the hero: the only thing that changes is whether Send can fire.
    // Patched by hand, never repainted — a repaint would take the caret with it.
    if (event.target.matches("[data-home-prompt]")) {
      const send = root.querySelector("[data-home-send]");
      if (send) send.disabled = !event.target.value.trim();
    }
  });

  root.addEventListener("keydown", (event) => {
    // Enter sends, Shift+Enter is a newline — the composer's contract, because
    // this is the same gesture one screen earlier.
    if (event.target.matches("[data-home-prompt]") && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitHomePrompt(root);
      return;
    }
    // A <tr role="button"> is not natively activatable.
    const chatRow = event.target.closest("[data-home-chat]");
    if (chatRow && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openChatFromHome(chatRow.dataset.homeChat);
    }
  });
}

// ── Starting a chat from the home ─────────────────────────────────────────
//
// The Playbook and the chat's NAME ride in the URL, because session.js resolves
// `?contextId=` and `?title=` as it mints a `new-*` session — so the chat is
// bound and named on its first paint. Only the text needs a bridge, and a
// single-use handoff is that bridge.
//
// setActivePlaybook BEFORE navigate, like every other switch here: the other
// order is what leaves the rail naming one brand above another's page.
function submitHomePrompt(root) {
  const field = root.querySelector("[data-home-prompt]");
  const text = (field?.value || "").trim();
  // Send is disabled while the field is empty; this is the keyboard's guard.
  // sendMessage() itself returns early on empty text, so an empty submit would
  // open a chat and post nothing — which reads as a bug.
  if (!text) return;
  const picked = pickedPlaybook();
  if (!picked) return;
  setActivePlaybook(picked.id);
  setHandoff("pendingHomePrompt", { text });
  const params = new URLSearchParams({ contextId: picked.id, title: chatNameFromPrompt(text) });
  navigate(`/session/new-${Date.now().toString(36)}?${params.toString()}`);
}

// The chat's name IS the ask, truncated on a word. No shared helper to reuse:
// session.js's own is private and dates the chat ("Chat · Jun 3, 14:20"), which
// says less than the sentence the reader just typed.
function chatNameFromPrompt(text) {
  const line = String(text).split("\n")[0].trim();
  if (line.length <= 60) return line;
  return `${line.slice(0, 59).replace(/\s+\S*$/, "")}…`;
}

function openChatFromHome(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return;
  // A chat with no Playbook — or one whose fiche I can't open — is left alone:
  // it lives in every workspace by construction, and switching to a brand I
  // cannot view would break the scope's own guarantee.
  const ctx = chatPlaybook(session);
  if (ctx) setActivePlaybook(ctx.id);
  closeRightPanel();
  navigate(`/session/${session.id}`);
}
