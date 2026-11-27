// Admin menu — the prototype-only controls (user mode, feature flags, dev docs)
// that used to live on the /settings page, then in the sidebar cog. Now rendered
// in the Admin panel (⇧D, components/admin-panel.js), which wires it.
//
// Pure-ish: renderAdminMenu() returns the markup; applyUserMode / toggleFlag are
// the side-effecting actions wired by the panel's delegated listeners. Every
// change reloads the app so the stores re-seed under the new mode / flag.

import { html, raw, escapeHtml } from "./utils.js?v=2929";
import { FLAGS, FLAG_GROUPS } from "./ff-catalog.js?v=2929";
import { getFlags, setFlag, isFlagOn } from "./feature-flags.js?v=2929";
import { getUserMode, setUserMode } from "./user-mode.js?v=2929";
import { getRole, setRole, ORG } from "./org.js?v=2929";
import { NETWORKS, isNetworkConnected, setNetworkConnected } from "./social-profiles.js?v=2929";
import { resetIntro } from "./components/voice-intro-modal.js?v=2929";
import { getContexts, updateContext } from "./contexts-store.js?v=2929";
import { showToast } from "./components/toast.js?v=2929";
import { failNextAnalysis } from "./videos-store.js?v=2929";

// Which hat I'm wearing inside my organisation. Only meaningful once Playbooks
// have owners, so the section only exists behind that flag.
const ADMIN_ROLE_OPTIONS = [
  { value: "member", label: "Member", hint: "Own your Playbooks, read the shared ones" },
  { value: "manager", label: "Manager", hint: "Share, transfer, and delete shared Playbooks" },
];

const ADMIN_MODE_OPTIONS = [
  { value: "returning", label: "Returning user", hint: "Populated mocks (default)" },
  { value: "new-alt", label: "First-time user", hint: "Empty, starts with the first-time run" },
];

// Switch user mode: persist, land on a coherent screen for the target mode, then
// full-reload so every store re-seeds. (Lifted from the old settings screen.)
export function applyUserMode(target) {
  if (target === getUserMode()) return;
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage may be unavailable in private browsing */
  }
  setUserMode(target);
  if (target === "new-alt" && !window.location.hash.startsWith("#/welcome-alt")) {
    window.location.hash = "#/welcome-alt";
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

// Connect or disconnect the brand on a network, then reload — every surface
// reads the connected accounts at render time.
export function toggleNetwork(network) {
  setNetworkConnected(network, !isNetworkConnected(network));
  window.location.reload();
}

// Flip a feature flag, then reload so every store / surface re-reads it.
// New Start only shows to a first-time user with no Playbook: turning one on
// also switches to that mode, or the flag would do nothing visible.
export function toggleFlag(id) {
  const on = !getFlags()[id];
  setFlag(id, on);
  if (on && id.startsWith("newStart") && getUserMode() !== "new-alt") {
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

// The voice intro shows once; this shows it again.
export function replayVoiceIntro() {
  resetIntro();
  window.location.reload();
}

// Every Playbook's network voices dropped, until the next reload re-seeds them:
// the Voice step, the nudges and the intro's cards start over.
export function resetNetworkVoices() {
  getContexts().forEach((c) => updateContext(c.id, { voiceByNetwork: {} }));
  showToast("Network voices reset. Each network asks for its voice at its next draft.", { duration: 3200 });
}

// One end armed for the Clips space: the next video added finds no clips
// (prod's NO_SPEECH) or its job crashes.
export function armClipsFailure(kind) {
  failNextAnalysis(kind);
  showToast(
    kind === "crash" ? "The next video you add will crash its analysis." : "The next video you add will find no clips.",
    { duration: 3200 },
  );
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
  const networkRows = Object.entries(NETWORKS)
    .map(
      ([id, n]) => `
      <label class="admin-menu__row admin-menu__flag" data-admin-network="${escapeHtml(id)}">
        <span class="admin-menu__network"><i class="${escapeHtml(n.icon)}" aria-hidden="true"></i><span class="admin-menu__opt-label">${escapeHtml(n.label)}</span></span>
        <span class="ap-toggle-container admin-menu__toggle" aria-hidden="true">
          <input type="checkbox" ${isNetworkConnected(id) ? "checked" : ""} tabindex="-1" />
          <i></i>
        </span>
      </label>`,
    )
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
        <div class="admin-menu__flags">${raw(networkRows)}</div>
      </div>
      ${raw(flagSections)}
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">Voice</span>
        <button type="button" class="admin-menu__doc" data-admin-voice-intro>
          <span class="admin-menu__opt-text">
            <span class="admin-menu__opt-label">Replay the voice intro</span>
            <span class="admin-menu__opt-hint">Each network, its own voice — shown again on reload</span>
          </span>
          <i class="ap-icon-refresh" aria-hidden="true"></i>
        </button>
        <button type="button" class="admin-menu__doc" data-admin-voice-reset>
          <span class="admin-menu__opt-text">
            <span class="admin-menu__opt-label">Reset network voices</span>
            <span class="admin-menu__opt-hint"
              >Every network back on the default voice, never set: the Voice step asks again at the next draft</span
            >
          </span>
          <i class="ap-icon-refresh" aria-hidden="true"></i>
        </button>
        <span class="admin-menu__opt-hint"
          >In a chat, Preview in chat › Voice (above) plays the voice step, a voice change and feedback.</span
        >
      </div>
      <div class="admin-menu__section">
        <span class="admin-menu__section-title">Clips</span>
        <button type="button" class="admin-menu__doc" data-admin-clips-fail="empty">
          <span class="admin-menu__opt-text">
            <span class="admin-menu__opt-label">No clips in the next video</span>
            <span class="admin-menu__opt-hint">Prod's NO_SPEECH: the reason, Upload another video and Remove</span>
          </span>
          <i class="ap-icon-warning" aria-hidden="true"></i>
        </button>
        <button type="button" class="admin-menu__doc" data-admin-clips-fail="crash">
          <span class="admin-menu__opt-text">
            <span class="admin-menu__opt-label">Crash the next analysis</span>
            <span class="admin-menu__opt-hint">The job fails at Transcribing audio: Try again and Remove</span>
          </span>
          <i class="ap-icon-warning" aria-hidden="true"></i>
        </button>
      </div>
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
