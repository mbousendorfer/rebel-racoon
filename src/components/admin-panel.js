// The Admin panel (2026-11-26) — the prototype's controls, out of the tester's
// sight. Asked: « masquer le bouton "admin" partout de l'interface, pour le
// faire apparaître sous forme de panneau avec le raccourci "shift d" comme tu as
// fait dans protopulse … mets y le contenu de la cog avec les features switch ».
//
// ⇧D toggles it (not while typing), Esc and × close it. It holds what the
// sidebar cog and the composer's « Admin: preview in chat » link used to show,
// in two tabs: Settings (user mode, role, connected networks, every feature
// flag, voice and clips tools, docs) and Preview in chat (the chat catalogue,
// when a chat is on screen). Nothing in the app points at it: the shortcut is the only way in.

import {
  renderAdminMenu,
  applyUserMode,
  applyOrgRole,
  toggleFlag,
  toggleNetwork,
  replayVoiceIntro,
  resetNetworkVoices,
  armClipsFailure,
} from "../admin-menu.js?v=2889";
import {
  renderChatGalleryPanel,
  runChatGalleryItem,
  filterChatGallery,
} from "../screens/session/chat-gallery.js?v=2889";

let root = null;

const isOpen = () => root && !root.hidden;

// Two tabs: the cog's content (flags first, the reason to open it), and the
// chat catalogue, long, which would push the flags off screen. The tab stays
// where it was left.
let tab = "settings";
const TABS = [
  ["settings", "Settings"],
  ["chat", "Preview in chat"],
];

function paint() {
  root.querySelector("[data-admin-panel-tabs]").innerHTML = TABS.map(
    ([id, label]) =>
      `<button type="button" class="ap-tabs-tab${id === tab ? " active" : ""}" role="tab" aria-selected="${id === tab}" tabindex="${id === tab ? 0 : -1}" data-admin-panel-tab="${id}">${label}</button>`,
  ).join("");
  root.querySelector("[data-admin-panel-body]").innerHTML =
    tab === "chat" ? renderChatGalleryPanel() : renderAdminMenu();
}

function toggleAdminPanel(open = !isOpen()) {
  if (!root) return;
  if (open) paint();
  root.hidden = !open;
  if (open) root.querySelector("[data-admin-panel-close]")?.focus();
}

export function init() {
  if (root) return;
  root = document.createElement("aside");
  root.className = "admin-panel";
  root.hidden = true;
  root.setAttribute("aria-label", "Admin");
  root.innerHTML = `
    <header class="admin-panel__head">
      <div>
        <h2 class="admin-panel__title">Admin</h2>
        <p class="admin-panel__hint">Prototype controls, hidden from testers. <kbd>⇧</kbd> <kbd>D</kbd> to toggle.</p>
      </div>
      <button type="button" class="ap-icon-button transparent grey" data-admin-panel-close aria-label="Close Admin">
        <i class="ap-icon-close"></i>
      </button>
    </header>
    <div class="ap-tabs admin-panel__tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Admin" data-admin-panel-tabs></div>
    </div>
    <div class="admin-panel__body" role="tabpanel" data-admin-panel-body></div>`;
  document.body.appendChild(root);

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && isOpen()) {
        toggleAdminPanel(false);
        return;
      }
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "d") return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      toggleAdminPanel();
    },
    true,
  );

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-admin-panel-close]")) return toggleAdminPanel(false);
    const tabBtn = event.target.closest("[data-admin-panel-tab]");
    if (tabBtn) {
      tab = tabBtn.dataset.adminPanelTab;
      paint();
      return;
    }
    const item = event.target.closest("[data-chat-gallery-item]");
    if (item) {
      toggleAdminPanel(false);
      runChatGalleryItem(item.dataset.chatGalleryItem);
      return;
    }
    const flagRow = event.target.closest("[data-admin-flag]");
    if (flagRow) {
      event.preventDefault();
      toggleFlag(flagRow.dataset.adminFlag);
    }
    const networkRow = event.target.closest("[data-admin-network]");
    if (networkRow) {
      event.preventDefault();
      toggleNetwork(networkRow.dataset.adminNetwork);
    }
    if (event.target.closest("[data-admin-voice-intro]")) replayVoiceIntro();
    if (event.target.closest("[data-admin-voice-reset]")) resetNetworkVoices();
    const fail = event.target.closest("[data-admin-clips-fail]");
    if (fail) armClipsFailure(fail.dataset.adminClipsFail);
  });

  root.addEventListener("input", (event) => {
    if (event.target.matches("[data-chat-gallery-search-input]")) filterChatGallery(root, event.target.value);
  });

  // User mode and org role apply + reload.
  root.addEventListener("change", (event) => {
    const mode = event.target.closest('[name="sidebar-admin-user-mode"]');
    if (mode) return applyUserMode(mode.value);
    const role = event.target.closest('[name="sidebar-admin-org-role"]');
    if (role) applyOrgRole(role.value);
  });
}
