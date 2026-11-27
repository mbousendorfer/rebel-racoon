// Admin menu — the prototype-only controls (user mode, feature flags, dev docs)
// that used to live on the /settings page, then in the sidebar cog. Now rendered
// in the Admin panel (⇧D, components/admin-panel.js), which wires it.
//
// Pure-ish: renderAdminMenu() returns the markup; applyUserMode / toggleFlag are
// the side-effecting actions wired by the panel's delegated listeners. Every
// change reloads the app so the stores re-seed under the new mode / flag.

import { html, raw, escapeHtml } from "./utils.js?v=2945";
import { FLAGS, FLAG_GROUPS } from "./ff-catalog.js?v=2945";
import { getFlags, setFlag, isFlagOn } from "./feature-flags.js?v=2945";
import { getUserMode, setUserMode } from "./user-mode.js?v=2945";
import { getRole, setRole, ORG } from "./org.js?v=2945";
import { NETWORKS, isNetworkConnected, setNetworkConnected } from "./social-profiles.js?v=2945";

// Which hat I'm wearing inside my organisation. Only meaningful once Playbooks
// have owners, so the section only exists behind that flag.
const ADMIN_ROLE_OPTIONS = [
  { value: "member", label: "Member", hint: "Own your Playbooks, read the shared ones" },
  { value: "manager", label: "Manager", hint: "Share, transfer, and delete shared Playbooks" },
];

const ADMIN_MODE_OPTIONS = [
  { value: "returning", label: "Returning user", hint: "Populated mocks (default)" },
  { value: "new-alt", label: "First-time user", hint: "Empty, no Playbook yet" },
];

// Switch user mode: persist, land on a coherent screen for the target mode, then
// full-reload so every store re-seeds. (Lifted from the old settings screen.)
// First-time lands on / , which picks the run or a new chat (flag
// interactivePlaybook, dashboard.js).
export function applyUserMode(target) {
  if (target === getUserMode()) return;
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage may be unavailable in private browsing */
  }
  setUserMode(target);
  if (target === "new-alt" && !window.location.hash.startsWith("#/welcome-alt")) {
    window.location.hash = "#/";
  } else if (target === "returning") {
    const h = window.location.hash;
    if (h.startsWith("#/welcome")) {
      window.location.hash = "#/";
    }
  }
  window.location.reload();
}

// Switch org role, then reload: access is read synchronously at render time
// everywhere, so nothing subscribes to it — same contract as user mode.
export function applyOrgRole(target) {
  if (target === getRole()) return;
  setRole(target);
  window.location.reload();
}

// Connect or disconnect the brand on a network. The select stays open so
// several can be ticked; the reload waits for it to close (applyNetworks) —
// every surface reads the connected accounts at render time.
let networksChanged = false;
export function toggleNetwork(network) {
  setNetworkConnected(network, !isNetworkConnected(network));
  networksChanged = true;
}
export function applyNetworks() {
  if (networksChanged) window.location.reload();
}

export function networksSummary() {
  const ids = Object.keys(NETWORKS);
  const on = ids.filter(isNetworkConnected);
  if (on.length === ids.length) return `All ${ids.length} networks`;
  if (!on.length) return "No network connected";
  return on.map((id) => NETWORKS[id].label).join(", ");
}

// Flip a feature flag, then reload so every store / surface re-reads it.
// New Start, the new chat's hero (newChatHero) and the run first
// (interactivePlaybook) are first-time-user screens: turning one on also
// switches to that mode (empty stores, no Playbook), or the flag would show a
// populated account instead.
const FIRST_TIME_FLAGS = (id) => id.startsWith("newStart") || id === "newChatHero" || id === "interactivePlaybook";
export function toggleFlag(id) {
  const on = !getFlags()[id];
  setFlag(id, on);
  if (on && FIRST_TIME_FLAGS(id) && getUserMode() !== "new-alt") {
    try {
      window.sessionStorage.clear();
    } catch {
      /* storage may be unavailable in private browsing */
    }
    setUserMode("new-alt");
    window.location.hash = "#/";
  }
  window.location.reload();
}

export function renderAdminMenu() {
  const mode = getUserMode();
  const flags = getFlags();

  const modeRows = ADMIN_MODE_OPTIONS.map((opt) => {
    const active = opt.value === mode;
    return `
      <label class="ap-radio-card card admin-menu__mode" data-admin-mode="${escapeHtml(opt.value)}">
        <input type="radio" name="sidebar-admin-user-mode" value="${escapeHtml(opt.value)}" ${active ? "checked" : ""} />
        <span class="admin-menu__opt-text">
          <span class="admin-menu__opt-label">${escapeHtml(opt.label)}</span>
          <span class="admin-menu__opt-hint">${escapeHtml(opt.hint)}</span>
        </span>
      </label>
    `;
  }).join("");

  const role = getRole();
  const roleRows = ADMIN_ROLE_OPTIONS.map((opt) => {
    const active = opt.value === role;
    return `
      <label class="ap-radio-card card admin-menu__mode" data-admin-role="${escapeHtml(opt.value)}">
        <input type="radio" name="sidebar-admin-org-role" value="${escapeHtml(opt.value)}" ${active ? "checked" : ""} />
        <span class="admin-menu__opt-text">
          <span class="admin-menu__opt-label">${escapeHtml(opt.label)}</span>
          <span class="admin-menu__opt-hint">${escapeHtml(opt.hint)}</span>
        </span>
      </label>
    `;
  }).join("");

  // One section per group; the row's tooltip says what the flag does.
  const flagRow = (flag) => `
      <label class="admin-menu__row admin-menu__flag" data-admin-flag="${escapeHtml(flag.id)}" data-tooltip="${escapeHtml(flag.tip)}">
        <span class="admin-menu__opt-label">${escapeHtml(flag.label)}</span>
        <span class="ap-toggle-container admin-menu__toggle" aria-hidden="true">
          <input type="checkbox" ${flags[flag.id] ? "checked" : ""} tabindex="-1" />
          <i></i>
        </span>
      </label>
    `;
  const flagSections = FLAG_GROUPS.map(
    (group) => `
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">${escapeHtml(group)}</span>
        <div class="admin-menu__flags">${FLAGS.filter((f) => f.group === group)
          .map(flagRow)
          .join("")}</div>
      </div>
    `,
  ).join("");

  // The networks the brand is connected on — all six unless one is unticked.
  // The DS multi-select: a checkbox per option, the summary in the trigger.
  const networkOptions = Object.entries(NETWORKS)
    .map(([id, n]) => {
      const on = isNetworkConnected(id);
      return `
      <div class="ap-select-option" role="option" aria-selected="${on}" tabindex="0" data-admin-network="${escapeHtml(id)}">
        <span class="ap-checkbox-container ap-select-option-checkbox" aria-hidden="true"><input type="checkbox" tabindex="-1" ${on ? "checked" : ""} /><i></i></span>
        <i class="${escapeHtml(n.icon)}" aria-hidden="true"></i>
        <span class="ap-select-option-text">${escapeHtml(n.label)}</span>
      </div>`;
    })
    .join("");

  return html`
    <div class="admin-menu">
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">User mode</span>
        <div class="admin-menu__cards" role="radiogroup" aria-label="User mode">${raw(modeRows)}</div>
      </div>
      ${raw(
        isFlagOn("playbookSharing")
          ? `<div class="admin-menu__section">
              <span class="admin-menu__section-title">Your role at ${escapeHtml(ORG.name)}</span>
              <div class="admin-menu__cards" role="radiogroup" aria-label="Your role">${roleRows}</div>
            </div>`
          : "",
      )}
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">Connected networks</span>
        <details class="ap-select" data-admin-networks>
          <summary class="ap-select-trigger" aria-label="Connected networks">
            <span class="ap-select-value" data-admin-networks-value>${networksSummary()}</span>
            <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
          </summary>
          <div class="ap-select-dropdown" role="listbox" aria-multiselectable="true">
            <div class="ap-select-options">${raw(networkOptions)}</div>
          </div>
        </details>
      </div>
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">Share</span>
        <button type="button" class="ap-button stroked grey" data-admin-copy-flags>
          <i class="ap-icon-link" aria-hidden="true"></i><span>Copy link with my flags</span>
        </button>
      </div>
      ${raw(flagSections)}
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">Docs</span>
        <a class="admin-menu__doc" href="handoff/overlays.html" target="_blank" rel="noopener">
          <span class="admin-menu__opt-text">
            <span class="admin-menu__opt-label">Overlay index</span>
            <span class="admin-menu__opt-hint">Every modal &amp; panel, as a shareable link</span>
          </span>
          <i class="ap-icon-external-link" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  `;
}
