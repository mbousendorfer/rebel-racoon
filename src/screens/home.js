import { escapeAttr, html, raw } from "../utils.js?v=2958";
import { conceptText } from "../concepts.js?v=2958";
import { renderTopbar, setTopbarActions } from "../components/topbar.js?v=2958";
import {
  getContexts,
  subscribe as subscribeContexts,
  duplicateContext,
  deleteContext,
} from "../contexts-store.js?v=2958";
import { navigate } from "../router.js?v=2958";
import { openNewPlaybookFlow } from "../context-builder.js?v=2958";
import { open as openConfirmModal } from "../components/confirm-modal.js?v=2958";
import { visibleContexts, isMine } from "../playbook-access.js?v=2958";
import { voicesToFinish } from "../voice-parts.js?v=2958";
import { open as openShareModal } from "../components/share-playbook-modal.js?v=2958";
import { showToast } from "../components/toast.js?v=2958";
import { renderContextCard, renderContextsEmpty, renderGhostCard } from "./home/lists.js?v=2958";

// The Playbooks catalogue (`/contexts`).
//
// ⚠️ The file is still called home.js: it also held the account home (`/home`,
// flag `playbookWorkspace`), deleted on 2026-11-27. The names still say
// `contexts` — the classes (`.contexts-view__*`, `.contexts-card*`) and the
// stylesheet (styles/screens/contexts.css).

let unsubs = [];
// Where this screen paints — the router's #app. Held at module level because
// every repaint path (a store notify, Clear search) has to reach it, and bind()
// is handed the SECTION, not this.
let mountTarget = null;
// `owner` — the catalogue's sort by ownership (all · mine · shared), flag
// playbookSharing only: without the flag every Playbook is mine.
let pageState = { query: "", owner: "all" };

export function renderContextsRoute(_params, target) {
  mountTarget = target;
  renderTopbar();
  drainSubs();
  paint();
  // FIND-B: tear the subscriptions down on route change so off-route
  // notifications don't repaint a target that no longer holds this view.
  unsubs.push(subscribeContexts(() => paint()));
  // The topbar lives outside the section, so its Create needs its own listener.
  const topbar = document.getElementById("topbar");
  const onTopbarClick = (event) => {
    if (event.target.closest("[data-contexts-topbar] [data-contexts-new]")) openNewPlaybookFlow("/contexts");
  };
  topbar?.addEventListener("click", onTopbarClick);
  unsubs.push(() => topbar?.removeEventListener("click", onTopbarClick));
  return () => {
    drainSubs();
    setTopbarActions(null);
    pageState = { query: "", owner: "all" };
  };
}

function drainSubs() {
  unsubs.forEach((off) => off());
  unsubs = [];
}

function paint() {
  const target = mountTarget;
  if (!target) return;
  target.innerHTML = html`<section class="screen contexts-view" data-contexts-root>${raw(renderPage())}</section>`;
  // The catalogue's primary rides the topbar (DS Top bar: actions on the
  // right). None while there is nothing yet: the empty state's « Create your
  // first Playbook » is then the one next step.
  setTopbarActions(
    "/contexts",
    visibleContexts().length ? `<div data-contexts-topbar>${renderCreateButton()}</div>` : null,
  );
  // ⚠️ Bind to the SECTION, not to `target`. `target` is #app, which paint()
  // never replaces — so every repaint (a store notify, Clear search) stacked
  // another pair of listeners on it, and after two paints one click on the
  // ghost card minted two sessions. The section's innerHTML IS replaced, so
  // its listeners die with the node. `querySelector` rather than
  // firstElementChild: the html`` template can leave a leading text node.
  bind(target.querySelector("[data-contexts-root]"));
}

// Above the Playbooks (2026-10-29, asked: « un encart tout en haut des playbooks
// qui indique ce qu'il faudrait faire »): how many have voices to finish, and
// what it costs. No button — each card says which networks.
function voicesWarning(contexts) {
  const n = contexts.filter((c) => voicesToFinish(c).length).length;
  if (!n) return "";
  return `
    <div class="ap-infobox warning has-title contexts-view__voices" role="status">
      <i class="ap-icon-warning_fill" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">${n} Playbook${n === 1 ? " has" : "s have"} voices to finish</span>
          <span class="ap-infobox-message">Until then, ${n === 1 ? "its" : "their"} drafts may miss what works on those networks.</span>
        </div>
      </div>
    </div>`;
}

function renderPage() {
  // What I'm allowed to see, not what the store holds — a colleague's private
  // Playbook is in the store and must not be in this grid.
  const all = visibleContexts();
  return html`
    <div class="contexts-view__page">
      <!-- No drawn <h1>: the topbar names the route and carries the page's
           primary (DS Top bar, page-patterns P1/P2) — the Topic Feed and
           Connectors already work this way. The concept sentence leads the
           page, then the owner tabs (P4), then the toolbar, search first on
           the left (P3). -->
      <!-- With no Playbook, the empty state explains it, so the sentence would say it twice. -->
      ${all.length ? raw(`<p class="concept-lead contexts-view__lead">${escapeAttr(conceptText("playbook"))}</p>`) : ""}
      ${raw(renderOwnerTabs(all))}
      ${raw(all.length ? `<div class="contexts-view__toolbar">${renderSearchField()}</div>` : "")}
      ${raw(voicesWarning(all))}
      <div class="contexts-view__body">${raw(renderBody())}</div>
    </div>
  `;
}

// ⚠️ ONE body renderer, two callers: renderPage() and the search's `input`
// handler, which repaints only this so the field keeps its caret. They were two
// copies and they had drifted twice — the partial one read getContexts() where
// the page reads visibleContexts() (so typing surfaced a colleague's private
// Playbook) and it forgot the ghost card (which vanished on the first
// keystroke). Two callers, one function: they cannot drift again.
function renderBody() {
  const all = visibleContexts();
  const visible = filter(byOwner(all, pageState.owner), pageState);
  if (visible.length === 0) return renderContextsEmpty(all, pageState);
  // No « Create a Playbook » ghost among other people's: a new one is mine.
  const ghost = pageState.owner === "shared" ? "" : renderGhostCard();
  return `<div class="contexts-view__grid">${visible.map(renderContextCard).join("")}${ghost}</div>`;
}

function renderSearchField() {
  return `
    <div class="ap-input-group contexts-view__search">
      <i class="ap-icon-search"></i>
      <input
        type="search"
        placeholder="Search Playbooks…"
        aria-label="Search Playbooks"
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

// ── Mine · Shared with me (flag playbookSharing) ─────────────────────────
// The catalogue sorted by whose it is, the way a gallery of design systems
// splits yours from the ones shared with you. DS tabs: one list on screen, three
// views of it, each counting Playbooks. Nothing shared with me → no tabs, there
// is nothing to sort. Flag OFF isMine() is always true, so they never show.
function byOwner(list, owner) {
  if (owner === "mine") return list.filter(isMine);
  if (owner === "shared") return list.filter((c) => !isMine(c));
  return list;
}

function renderOwnerTabs(all) {
  const shared = byOwner(all, "shared").length;
  if (!shared) return "";
  const item = (id, label, count) => {
    const on = pageState.owner === id;
    return `
      <button
        type="button"
        class="ap-tabs-tab${on ? " active" : ""}"
        role="tab"
        aria-selected="${on ? "true" : "false"}"
        data-contexts-owner="${id}"
      >
        <span>${label}</span>
        <span class="ap-counter normal ${on ? "blue" : "grey"}">${count}</span>
      </button>
    `;
  };
  return `
    <div class="ap-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Sort Playbooks by owner">
        ${item("all", "All", all.length)}
        ${item("mine", "Mine", all.length - shared)}
        ${item("shared", "Shared with me", shared)}
      </div>
    </div>
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
    return `"${ctx.name}" will be removed. Chats using it will need a new Playbook. This can't be undone.`;
  }
  const n = ctx.usedIn || 0;
  const who = n === 1 ? "1 chat" : `${n} chats`;
  return n
    ? `"${ctx.name}" is shared with everyone in your organization, and ${who} use it. They keep their drafts and can still save or schedule them, but I can't draft anything new in them. This can't be undone.`
    : `"${ctx.name}" is shared with everyone in your organization. It disappears from everyone's list. Copies duplicated from it stay untouched. This can't be undone.`;
}

function bind(root) {
  root.addEventListener("click", (event) => {
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
      openNewPlaybookFlow("/contexts");
      return;
    }
    const ownerTab = event.target.closest("[data-contexts-owner]");
    if (ownerTab) {
      pageState.owner = ownerTab.dataset.contextsOwner;
      paint();
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
        showToast("Playbook duplicated");
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
        showToast("Can't delete your only Playbook. Every chat needs one, so create another first.");
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
          showToast("Playbook deleted");
        },
      });
      return;
    }
    // Card click — anywhere outside the action buttons opens the fiche. The
    // action buttons stop propagation so they win over this fallback.
    const card = event.target.closest("[data-contexts-card]");
    if (card) navigate(`/playbook/${card.dataset.contextsCard}`);
  });

  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-contexts-search]")) {
      pageState.query = event.target.value || "";
      // Repaint the body in place so empty <-> grid transitions both work
      // without losing the search field's focus — through renderBody(), the
      // one renderer the full paint also uses.
      const body = root.querySelector(".contexts-view__body");
      if (body) body.innerHTML = renderBody();
    }
  });

  root.addEventListener("keydown", (event) => {
    // An <article> is not natively activatable.
    if (event.key !== "Enter" && event.key !== " ") return;
    // The tile's actions (Edit, Duplicate, Delete) are buttons of their own.
    if (event.target.closest("[data-contexts-card-actions]")) return;
    const card = event.target.closest("[data-contexts-card]");
    if (card) {
      event.preventDefault();
      navigate(`/playbook/${card.dataset.contextsCard}`);
    }
  });
}
