// The right panel's Drafts mode: the feed grouped by network, its filters, the
// per-draft and per-section actions (schedule, save, delete, image, studio,
// rewrite, mention) and the inline editor. Its filter state lives here; the
// shell's delegated clicks write it through setDraftsFilter / setDraftsNetwork.
// Moved out of right-panel.js, unchanged.

import { sessionPlaybookId } from "../../active-playbook.js?v=2766";
import { NETWORK_LABEL, networkMeta } from "../../social-profiles.js?v=2766";
import {
  getPosts,
  removePost,
  insertPost,
  updatePostContent,
  attachImageToDraft,
  attachCarouselToDraft,
  updatePostClip,
  undoRevision,
} from "../../posts-store.js?v=2766";
import { getContextById, getBrandKitGaps } from "../../contexts-store.js?v=2766";
import { renderPostCard } from "../post-card.js?v=2766";
import { isPostValid } from "../../post-validation.js?v=2766";
import { draftVoice, voiceChangedAt } from "../../voice-parts.js?v=2766";
import { html, raw } from "../../utils.js?v=2766";
import { isFlagOn } from "../../feature-flags.js?v=2766";
import { open as openNewScheduleModal } from "../schedule-modal.js?v=2766";
import { open as openLegacyScheduleModal } from "../schedule-modal-legacy.js?v=2766";
import { open as openConfirmModal } from "../confirm-modal.js?v=2766";
import { open as openAssignModal } from "../assign-modal.js?v=2766";
import { showToast } from "../toast.js?v=2766";
import { addMention as addComposerMention } from "../../composer-mentions.js?v=2766";
import { startDraftImageFlow } from "../../draft-image-flow.js?v=2766";
import { openDraftStudio, quickImagePreset } from "../../modules/image-studio/index.js?v=2766";
import { closeInline, activeSessionId, renderPanel } from "../right-panel.js?v=2766";
import { blockInDemo } from "../../demo-flow.js?v=2766";
import { navigate } from "../../router.js?v=2766";
import { giveNetworkVoice } from "../../network-voice-flow.js?v=2766";
import { startRewrite } from "../../draft-rewrite.js?v=2766";
import { getSources as getStreamSources, updateSourceClips } from "../../sources-stream.js?v=2766";
import { open as openVideoClipsModal } from "../video-clips-modal.js?v=2766";

// Drafts-mode local UI state — Lot 21 rich-card view. Filter strip at the
// top of the panel head drives both axes : status (all / needs_fixes) and
// network (all / linkedin / twitter). « Needs fixes » is DERIVED
// (post-validation.js), never a stored status. Survives across
// open/close cycles so the user keeps their filter when they re-open.
let draftsFilter = "all";

let draftsNetwork = "all";

// The only writers from outside the Drafts view (the shell's delegated clicks):
// an imported `let` is read-only to its importer, so the filter moves through
// these two functions rather than by assignment.
export function setDraftsFilter(value) {
  draftsFilter = value;
}

export function setDraftsNetwork(value) {
  draftsNetwork = value;
}

// Network display metadata for the Drafts list — drives the per-network
// separators, their headers, and the network filter dropdown. `twitter`
// is the posts-store alias for `x`. NETWORK_ORDER gives a stable grouping
// order; only networks actually present in the feed render a section.
// `accent` is the network's brand colour (data, not a DS token — per the
// project's "third-party brand colours live in JS" rule). The drafts band
// no longer tints per-network (it uses the accent-blue selection wash), but
// the colour stays available for other per-network surfaces.
const NETWORK_ORDER = ["linkedin", "twitter", "instagram", "facebook", "tiktok", "youtube"];

function networkMetaFor(network) {
  return networkMeta(network) || { icon: "ap-icon-web", label: network || "Other", accent: "#6B7280" };
}

// Multi-select state for bulk scheduling. Lives across renders inside the
// panel; cleared when a session change or a bulk-schedule confirm fires.
export let selectedDraftIds = new Set();

// Inline-edit state — only one card in edit mode at a time. Snapshot of
// the original body fields powers the "no spurious save" check.
export let editingPostId = null;

// "Fixed — ready to publish": a draft that stopped failing validation since the
// last render says so for a moment (and stays under « Needs fixes » meanwhile),
// then settles among the ready ones. Detected by diffing the invalid ids from
// one render to the next — nothing is stored on the post.
const FIXED_MS = 2500;
let lastInvalidIds = new Set();
const justFixed = new Map(); // postId → timeout

function trackFixes(posts) {
  const invalidNow = new Set(posts.filter((p) => !isPostValid(p)).map((p) => p.id));
  for (const id of lastInvalidIds) {
    if (invalidNow.has(id) || justFixed.has(id) || !posts.some((p) => p.id === id)) continue;
    justFixed.set(
      id,
      setTimeout(() => {
        justFixed.delete(id);
        renderPanel();
      }, FIXED_MS),
    );
  }
  lastInvalidIds = invalidNow;
}

const needsFixes = (p) => !isPostValid(p) || justFixed.has(p.id);

let editingOriginal = null;

export function renderDraftsView() {
  // Scheduling and "Save as draft" both move a post out of this workspace,
  // so the panel only ever shows live drafts — there is no "scheduled" tab
  // anymore. Filter scheduled posts out defensively (covers any seeded
  // `status: "scheduled"` posts too).
  const sid = activeSessionId();
  const allPosts = sid ? getPosts(sid).filter((p) => p.status !== "scheduled") : [];
  if (!allPosts.length) return renderDraftsEmpty();
  trackFixes(allPosts);

  // The "scheduled" status filter no longer exists — normalise any stale
  // state left over from an earlier render so the tabs stay in sync.
  if (draftsFilter === "scheduled") draftsFilter = "all";

  // Counts per status — drive the filter rail badges.
  const filterCounts = {
    all: allPosts.length,
    needs_fixes: allPosts.filter((p) => !isPostValid(p)).length,
  };

  // The Playbook behind this chat, resolved ONCE for the whole feed: an
  // image-less draft offers to go complete the brand kit, and the card must not
  // resolve a Context itself (it stays a pure render of a post).
  const ctx = sid ? getContextById(sessionPlaybookId(sid)) : null;
  const brandGaps = getBrandKitGaps(ctx);
  const playbookId = ctx?.id || null;
  // ONCE per feed, on the first image-less draft — not once per card. What the
  // brand kit is missing is a fact about the Playbook, not about this draft, so
  // repeating it down a column of four drafts is four copies of one sentence.
  const firstGapPostId = brandGaps.length
    ? allPosts.find((p) => !p.clipRef && !p.imageUrl && !(p.carousel || []).length)?.id || null
    : null;

  // Apply both filter axes.
  const filtered = allPosts.filter((p) => {
    if (draftsFilter === "needs_fixes" && !needsFixes(p)) return false;
    if (draftsNetwork !== "all" && p.network !== draftsNetwork) return false;
    return true;
  });

  // Filter header — status is the primary axis (which view of the list
  // you're looking at) so it uses the DS .ap-tabs component with
  // .ap-counter badges, matching the Outputs Ideas|Clips tabs. Network
  // is a secondary refinement, so it sits on the trailing edge as a
  // single DS .ap-select (details/summary). Both are first-class DS
  // controls — no native <select> form input, no ad-hoc filter buttons.
  const statusTab = (id, label, count) => {
    const active = draftsFilter === id;
    return `
      <button
        type="button"
        class="ap-tabs-tab ${active ? "active" : ""}"
        data-rpanel-drafts-filter="${id}"
        role="tab"
        aria-selected="${active}"
      >
        <span>${label}</span>
        <span class="ap-counter normal ${active ? "blue" : "grey no-bg"}">${count}</span>
      </button>
    `;
  };

  // Network dropdown options are dynamic — only networks actually present
  // in the current drafts, ordered by NETWORK_ORDER.
  const presentNetworks = [
    ...NETWORK_ORDER.filter((n) => allPosts.some((p) => p.network === n)),
    ...[...new Set(allPosts.map((p) => p.network))].filter((n) => !NETWORK_ORDER.includes(n)),
  ];
  const currentNetwork =
    draftsNetwork === "all" ? { icon: "ap-icon-web", label: "All networks" } : networkMetaFor(draftsNetwork);

  const networkOption = (id) => {
    const meta = id === "all" ? { icon: "ap-icon-web", label: "All networks" } : networkMetaFor(id);
    const count = id === "all" ? allPosts.length : allPosts.filter((p) => p.network === id).length;
    const selected = draftsNetwork === id;
    return `
      <div class="ap-select-option ${selected ? "selected" : ""}" data-rpanel-drafts-network="${id}"
        role="option" aria-selected="${selected}" tabindex="0">
        <i class="${meta.icon} ap-select-option-icon" aria-hidden="true"></i>
        <span class="ap-select-option-text">${meta.label} (${count})</span>
        ${selected ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>
    `;
  };

  const filtersBar = `
    <div class="rpanel-drafts__filters">
      <div class="ap-tabs rpanel-drafts__statustabs">
        <div class="ap-tabs-nav" role="tablist" aria-label="Filter drafts by status">
          ${statusTab("all", "All drafts", filterCounts.all)}
          ${statusTab("needs_fixes", "Needs fixes", filterCounts.needs_fixes)}
        </div>
      </div>
      <details class="ap-select rpanel-drafts__network">
        <summary class="ap-select-trigger" aria-label="Filter drafts by network">
          <span class="ap-select-value">
            <i class="${currentNetwork.icon} ap-select-inline-icon"></i> ${currentNetwork.label}
          </span>
          <i class="ap-icon-chevron-down ap-select-arrow"></i>
        </summary>
        <div class="ap-select-dropdown" role="listbox" aria-label="Network">
          <div class="ap-select-options">
            ${networkOption("all")}
            ${presentNetworks.map((n) => networkOption(n)).join("")}
          </div>
        </div>
      </details>
      ${closeInline()}
    </div>
  `;

  // Multi-select — every draft is selectable. Keep the selection set in
  // sync with what actually exists so a removed draft can't ghost-affect
  // the bulk bar.
  const allIds = new Set(allPosts.map((p) => p.id));
  for (const id of Array.from(selectedDraftIds)) {
    if (!allIds.has(id)) selectedDraftIds.delete(id);
  }
  const selectedCount = selectedDraftIds.size;

  // Feed grouped by network with a separator header per group. Each header
  // carries a per-network "Select all" so a bulk selection naturally stays
  // within one network (the gate for scheduling). Groups follow
  // NETWORK_ORDER; any unknown network falls in after the known ones.
  const feedGroups = [
    ...NETWORK_ORDER.filter((n) => filtered.some((p) => p.network === n)),
    ...[...new Set(filtered.map((p) => p.network))].filter((n) => !NETWORK_ORDER.includes(n)),
  ];

  // Each network section is self-contained: the separator IS the section
  // header AND its bulk-action surface, in two states that share one row
  // (so there's no layout jump on selection):
  //   • Idle      — a calm divider: brand chip + draft count on a hairline,
  //                 no controls. The whole band is click-to-select-all.
  //   • Selecting — the divider fills into a solid contextual toolbar with
  //                 the network's bulk actions. Because every action is
  //                 scoped to one network, scheduling is always valid — so
  //                 there are never dead/disabled buttons sitting idle.
  // The header is sticky so the toolbar stays reachable while scrolling.
  const renderGroup = (network) => {
    const meta = networkMetaFor(network);
    const groupPosts = filtered.filter((p) => p.network === network);
    const groupSelected = groupPosts.filter((p) => selectedDraftIds.has(p.id)).length;
    const allGroupSelected = groupPosts.length > 0 && groupSelected === groupPosts.length;
    const indeterminate = groupSelected > 0 && !allGroupSelected;
    const selecting = groupSelected > 0;
    const cards = groupPosts
      .map((p) =>
        renderPostCard(p, {
          editing: p.id === editingPostId,
          inlineEdit: true,
          selectable: true,
          selected: selectedDraftIds.has(p.id),
          justFixed: justFixed.has(p.id),
          brandGaps: p.id === firstGapPostId ? brandGaps : [],
          playbookId,
          // Which voice wrote it (flag voicePerNetwork) — resolved here, once
          // per card, from the Playbook already in hand.
          voice: draftVoice(ctx, p.network),
          voiceStale: !!ctx && voiceChangedAt(ctx, p.network) > (p.writtenAt || 0),
          // What my last rewrite changed, marked in the text.
          changes: isFlagOn("draftChanges"),
          // What Generate an image will use: the Playbook's look and this
          // network's shape, shown before the click.
          imagePreset: playbookId && !p.imageUrl ? quickImagePreset({ brandId: playbookId, network: p.network }) : null,
        }),
      )
      .join("");
    const draftWord = groupPosts.length === 1 ? "draft" : "drafts";

    const countLabel = selecting ? `· ${groupSelected} selected` : `· ${groupPosts.length} ${draftWord}`;
    const delAria = `Delete ${groupSelected} selected ${meta.label} ${groupSelected === 1 ? "draft" : "drafts"}`;

    // Bulk actions live in the band and only render while a selection
    // exists (per Figma 1007:3335): Save = ghost-blue link, Schedule =
    // primary orange with calendar — the pipeline's final action, same
    // fill as the schedule modal's confirm — Delete = grey icon button. No idle
    // controls — no hairline, no "Select all" hint.
    // A selection holding a draft that won't publish can't be scheduled: the
    // button is disabled and its wrapper (a disabled button doesn't hover)
    // says how many to fix.
    const blocked = groupPosts.filter((p) => selectedDraftIds.has(p.id) && !isPostValid(p)).length;
    const blockedTip = `${blocked} selected ${blocked === 1 ? "draft needs" : "drafts need"} fixing first. Fix or unselect ${blocked === 1 ? "it" : "them"} to continue.`;
    const gate = (button) => (blocked ? `<span data-tooltip="${blockedTip}">${button}</span>` : button);
    const scheduleBtn = `<button type="button" class="ap-button primary orange" data-rpanel-section-schedule="${network}" ${blocked ? "disabled" : ""}>
              <i class="ap-icon-calendar" aria-hidden="true"></i> Schedule
            </button>`;
    const actions = selecting
      ? `
          <div class="rpanel-drafts__group-actions">
            <button type="button" class="ap-button ghost blue" data-rpanel-section-save="${network}">Save as drafts</button>
            ${gate(scheduleBtn)}
            <button type="button" class="ap-icon-button" data-rpanel-section-delete="${network}" aria-label="${delAria}" title="Delete selected drafts">
              <i class="ap-icon-trash" aria-hidden="true"></i>
            </button>
          </div>`
      : "";

    // The band IS the bar: the select-all checkbox sits inside it (left),
    // then the network identity, then (when selecting) the action cluster.
    // Idle is flat/white; hover and selecting tint with the accent wash.
    return `
      <div class="rpanel-drafts__group-header${selecting ? " is-selecting" : ""}">
        <div class="rpanel-drafts__group-band" data-rpanel-drafts-band="${network}">
          <label class="ap-checkbox-container ${indeterminate ? "indeterminate" : ""}" aria-label="Select all ${meta.label} drafts">
            <input type="checkbox" data-rpanel-drafts-select-network="${network}" ${allGroupSelected ? "checked" : ""} />
            <i></i>
          </label>
          <div class="rpanel-drafts__group-identity">
            <i class="${meta.icon} rpanel-drafts__group-icon" aria-hidden="true"></i>
            <span class="rpanel-drafts__group-label">${meta.label}</span>
            <span class="rpanel-drafts__group-count">${countLabel}</span>
          </div>
          ${actions}
        </div>
      </div>
      ${cards}
    `;
  };

  const feed = filtered.length
    ? feedGroups.map((n) => renderGroup(n)).join("")
    : `<div class="app-right-panel__empty">
         <div class="app-right-panel__empty-icon"><i class="ap-icon-search ap-icon-xl"></i></div>
         <div class="app-right-panel__empty-title">No drafts match this filter</div>
         <div class="app-right-panel__empty-sub">Try another filter, or clear the current one.</div>
         <div class="app-right-panel__empty-action">
           <button type="button" class="ap-button stroked grey" data-rpanel-drafts-clear>Clear filters</button>
         </div>
       </div>`;

  // Layout: fixed filter header, then the scrolling feed. Bulk actions
  // live inside each network's (sticky) section header, so there is no
  // separate footer bar.
  return html`
    <div class="rpanel-drafts ${selectedCount ? "has-selection" : ""}">
      ${raw(filtersBar)}
      <div class="posts__feed rpanel-drafts__feed">${raw(feed)}</div>
    </div>
  `;
}

function renderDraftsEmpty() {
  return html`
    <div class="app-right-panel__empty">
      <div class="app-right-panel__empty-icon"><i class="ap-icon-pen ap-icon-xl"></i></div>
      <div class="app-right-panel__empty-title">No drafts yet</div>
      <div class="app-right-panel__empty-sub">
        Pick an idea and choose Draft post. Your drafts land here, ready to review and schedule.
      </div>
    </div>
  `;
}

// "New SM" flag: the redesigned modal, or the previous one kept for
// comparison. Same call shape; the legacy one ignores `playbookId`.
function openScheduleModal(opts) {
  if (blockInDemo()) return;
  return isFlagOn("newScheduleModal") ? openNewScheduleModal(opts) : openLegacyScheduleModal(opts);
}

function onPostSchedule(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const post = getPosts(sid).find((p) => p.id === postId);
  if (!post || !isPostValid(post)) return;
  openScheduleModal({
    posts: [post],
    // The chat's Playbook — whose saved posting rhythm the modal opens on.
    playbookId: sessionPlaybookId(sid) || null,
    onConfirm: () => {
      // The modal queues the post on confirm; here we just drop it from
      // the Drafts workspace.
      commitScheduled(sid, [post]);
      selectedDraftIds.delete(post.id);
      renderPanel();
    },
  });
}

// The drafts of one network currently visible under the active filters —
// the scope a section's "Select all" (checkbox or band click) acts on.
export function visibleNetworkPosts(network) {
  const sid = activeSessionId();
  if (!sid) return [];
  return getPosts(sid).filter((p) => {
    if (p.status === "scheduled") return false;
    if (p.network !== network) return false;
    if (draftsFilter === "needs_fixes" && !needsFixes(p)) return false;
    if (draftsNetwork !== "all" && p.network !== draftsNetwork) return false;
    return true;
  });
}

// Select or clear every visible draft of one network, then repaint.
export function setNetworkSelection(network, shouldSelect) {
  const visible = visibleNetworkPosts(network);
  for (const p of visible) {
    if (shouldSelect) selectedDraftIds.add(p.id);
    else selectedDraftIds.delete(p.id);
  }
  renderPanel();
}

// The target for a section's bulk action: the network's selected drafts.
// Snapshotted with the original feed index so a toast Undo can restore
// them in place. (Buttons are disabled when nothing is selected, so this
// is only ever called with a non-empty selection.)
function sectionTargetSnapshot(sid, network) {
  return getPosts(sid)
    .map((post, idx) => ({ post, idx }))
    .filter(({ post }) => post.network === network && selectedDraftIds.has(post.id));
}

// Per-network bulk delete — confirm-modal gate (destructive), then drop
// the selected drafts of that network with an Undo toast.
export function onSectionDelete(network) {
  const sid = activeSessionId();
  if (!sid) return;
  const snapshot = sectionTargetSnapshot(sid, network);
  if (snapshot.length === 0) return;
  const count = snapshot.length;
  const draftWord = count === 1 ? "draft" : "drafts";
  openConfirmModal({
    title: `Delete ${count} ${draftWord}?`,
    body: `${count === 1 ? "This draft" : `These ${count} drafts`} will be removed from this chat. You can undo right after.`,
    confirmLabel: `Delete ${count} ${draftWord}`,
    danger: true,
    onConfirm: () => {
      for (const { post } of snapshot) {
        removePost(sid, post.id);
        selectedDraftIds.delete(post.id);
      }
      renderPanel();
      showToast(`${count} ${draftWord} deleted`, {
        action: {
          label: "Undo",
          onClick: () => {
            // Re-insert in ascending original index so positions line up.
            for (const { post, idx } of snapshot) insertPost(sid, post, idx);
            renderPanel();
          },
        },
      });
    },
  });
}

// Per-network schedule — opens the modal seeded with the section's target
// drafts (selection, or all of the network when nothing is checked).
// Single-network by construction, so always valid.
export function onSectionSchedule(network) {
  const sid = activeSessionId();
  if (!sid) return;
  const target = sectionTargetSnapshot(sid, network).map(({ post }) => post);
  if (target.length === 0 || !target.every(isPostValid)) return;
  openScheduleModal({
    posts: target,
    playbookId: sessionPlaybookId(sid) || null,
    onConfirm: () => {
      commitScheduled(sid, target);
      for (const p of target) selectedDraftIds.delete(p.id);
      renderPanel();
    },
  });
}

// The chat's "Adjust dates" on a schedule plan: the same modal, the same commit
// as the panel's own Schedule, for the drafts the plan named. `onScheduled`
// lets the chat say what happened.
export function openScheduleForPosts(sid, posts, onScheduled) {
  if (!sid || !posts.length) return;
  openScheduleModal({
    posts,
    playbookId: sessionPlaybookId(sid) || null,
    onConfirm: (slots) => {
      commitScheduled(sid, posts);
      for (const p of posts) selectedDraftIds.delete(p.id);
      renderPanel();
      onScheduled?.(slots);
    },
  });
}

// Assign for review — the Agorapulse approval workflow. Like Schedule and Save,
// it moves the drafts OUT of the chat: they now wait in the reviewer's queue.
// Undo puts them back where they were. Exported for the chat ("send these to
// Julie for review"): `reviewerId` preselects, `onAssigned` lets it reply.
export function openAssignForPosts(sid, posts, { reviewerId = null, onAssigned = null } = {}) {
  if (!sid || !posts.length || !posts.every(isPostValid)) return;
  openAssignModal({
    posts,
    reviewerId,
    onConfirm: (assignment) => {
      commitAssigned(sid, posts, assignment);
      onAssigned?.(assignment);
    },
  });
}

// The drafts leave the chat for the reviewer's queue — toast + Undo. Shared by
// the modal and the chat's "Send N posts for review" (which confirms without it).
export function commitAssigned(sid, posts, assignment) {
  const snapshot = getPosts(sid)
    .map((post, idx) => ({ post, idx }))
    .filter(({ post }) => posts.some((p) => p.id === post.id));
  for (const { post } of snapshot) {
    removePost(sid, post.id);
    selectedDraftIds.delete(post.id);
  }
  renderPanel();
  const n = snapshot.length;
  showToast(`Sent ${n} ${n === 1 ? "post" : "posts"} to ${assignment.reviewer.name} for review`, {
    action: {
      label: "Undo",
      onClick: () => {
        for (const { post, idx } of snapshot) insertPost(sid, post, idx);
        renderPanel();
      },
    },
  });
}

function onPostAssign(postId) {
  const sid = activeSessionId();
  const post = sid && getPosts(sid).find((p) => p.id === postId);
  if (post) openAssignForPosts(sid, [post]);
}

// Remove a freshly-scheduled batch from the Drafts workspace. The schedule
// modal already pushes the posts onto the calendar queue (schedule-store)
// on confirm, so here we only drop them from the list.
function commitScheduled(sid, posts) {
  for (const p of posts) removePost(sid, p.id);
}

// Per-network "Save as drafts" — opens the save modal for the section's
// target drafts (selection, or all of the network when nothing is checked).
// The modal offers three choices: keep them as separate drafts, file them
// into a new Agorapulse folder, or into an existing one. Whatever the user
// picks, the drafts leave the workspace with an Undo toast that restores the
// batch in place (and reverses the folder count for the folder choices).
export function onSectionSave(network) {
  const sid = activeSessionId();
  if (!sid) return;
  const snapshot = sectionTargetSnapshot(sid, network);
  if (snapshot.length === 0) return;
  const count = snapshot.length;
  const draftWord = count === 1 ? "draft" : "drafts";
  Promise.all([import("../save-folder-modal.js?v=2766"), import("../../folders-store.js?v=2766")]).then(
    ([{ open: openSaveModal }, { addDraftsToFolder }]) => {
      openSaveModal({
        count,
        // folder === null → save as separate drafts; otherwise file into it.
        onConfirm: (folder) => {
          for (const { post } of snapshot) {
            removePost(sid, post.id);
            selectedDraftIds.delete(post.id);
          }
          if (folder) addDraftsToFolder(folder.id, count);
          renderPanel();
          const message = folder
            ? `${count} ${draftWord} saved to "${folder.name}"`
            : `${count} ${draftWord} saved to Agorapulse`;
          showToast(message, {
            action: {
              label: "Undo",
              onClick: () => {
                for (const { post, idx } of snapshot) insertPost(sid, post, idx);
                if (folder) addDraftsToFolder(folder.id, -count);
                renderPanel();
              },
            },
          });
        },
      });
    },
  );
}

// Per-card "Save as draft" — single-post counterpart of onSaveAsDraft.
function onPostSaveAsDraft(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const idx = getPosts(sid).findIndex((p) => p.id === postId);
  if (idx < 0) return;
  const post = getPosts(sid)[idx];
  removePost(sid, postId);
  selectedDraftIds.delete(postId);
  renderPanel();
  showToast("Draft saved to Agorapulse", {
    action: {
      label: "Undo",
      onClick: () => {
        insertPost(sid, post, idx);
        renderPanel();
      },
    },
  });
}

// Drafts have no title, so the composer pill reads "<Network> — <snippet>"
// (e.g. "LinkedIn — Boost your reach this quarter…"), derived from the
// draft's network + the first line of its body. Mirrors the Mention action
// on idea / clip / source cards, which feed addComposerMention a string.
function onPostMention(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const post = getPosts(sid).find((p) => p.id === postId);
  if (!post) return;
  const network = NETWORK_LABEL[(post.network || "").toLowerCase()] || "Draft";
  const firstLine = (Array.isArray(post.text) ? post.text[0] : post.text) || "";
  const snippet = firstLine.trim().slice(0, 40);
  const label = snippet ? `${network} · ${snippet}${firstLine.trim().length > 40 ? "…" : ""}` : `${network} draft`;
  addComposerMention(sid, label);
}

function onPostFirstCommentRemove(postId) {
  const sid = activeSessionId();
  const post = sid && getPosts(sid).find((p) => p.id === postId);
  if (!post?.firstComment) return;
  const previous = post.firstComment;
  updatePostContent(sid, postId, { firstComment: null });
  showToast("First comment removed", {
    action: { label: "Undo", onClick: () => updatePostContent(sid, postId, { firstComment: previous }) },
  });
}

function onPostDelete(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const idx = getPosts(sid).findIndex((p) => p.id === postId);
  if (idx < 0) return;
  selectedDraftIds.delete(postId);
  const removed = removePost(sid, postId);
  if (!removed) return;
  showToast("Draft deleted", {
    action: {
      label: "Undo",
      onClick: () => insertPost(sid, removed, idx),
    },
  });
}

// "Generate an image" on a draft's empty media slot → one image, in place, no
// studio. This used to open the Image Studio; the studio is where you go to
// STEER an image (references, type, style, format, branding), and paying a
// full-screen modal to press one button was the long way round for "just give
// me an image". The studio stays one click away on the result, via Edit.
//
// No toast: the image appearing in the slot IS the feedback, and Remove sits
// right there on it if it's wrong. Nothing is asked either (2026-10-08): the
// click goes straight to the loader, with the Playbook's look and this
// network's shape (draft-image-flow.js).
export function onPostImage(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const post = getPosts(sid).find((p) => p.id === postId);
  if (!post || post.isGeneratingImage) return;
  startDraftImageFlow(sid, postId, { repaint: renderPanel });
}

// Open the Image Studio on a draft, in whichever mode its media calls for. One
// function behind two entry points: the rail's Image Studio button (any state)
// and "Edit" / "Edit slides" on the media itself (contextual).
//
// The no-media branch is why the rail button exists. "Generate an image" in the
// empty slot produces a picture in one click with no way to steer it, and the
// media block's studio controls only exist once there IS media — so an
// image-less draft had no route to the studio at all.
function onPostStudio(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const post = getPosts(sid).find((p) => p.id === postId);
  if (!post) return;
  // The Image Generator's studio: the draft's Playbook as the brand, and the PNG back into the post.
  openDraftStudio({
    brandId: sessionPlaybookId(sid) || null,
    network: post.network,
    text: Array.isArray(post.text) ? post.text.join("\n") : post.text || "",
    imageUrl: post.imageUrl || "",
    carousel: Array.isArray(post.carousel) ? post.carousel : null,
    onUse: (dataUrl) => attachImageToDraft(sid, postId, dataUrl),
    onUseCarousel: (urls) => attachCarouselToDraft(sid, postId, urls),
    // "In feed": this very draft as the Drafts board draws it, the studio's
    // image in place of its own. The module can't import post-card, so the
    // card comes from here; `inert` because it's a picture of the card, not
    // a second set of its controls. A carousel result keeps its slides.
    renderFeedPreview: (imageUrl, carousel = null) => {
      const live = getPosts(sid).find((p) => p.id === postId) || post;
      return `<div class="posts__feed-preview" inert>${renderPostCard({
        ...live,
        imageUrl,
        carousel,
        clipRef: null,
        isRegenerating: false,
      })}</div>`;
    },
  });
}

// Upload / change a draft image without the AI studio — spin up a throwaway
// file picker, turn the pick into an object URL and attach it to the draft.
// We deliberately keep the object URL alive (no revoke) since the card keeps
// rendering it as its src.
export function onPostImageUpload(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    attachImageToDraft(sid, postId, URL.createObjectURL(file));
    renderPanel();
  });
  input.click();
}

// Clear a draft image — nulling imageUrl drops the card back to the
// generate/upload placeholder (post-card.js renders on imageUrl presence).
function onPostImageRemove(postId) {
  const sid = activeSessionId();
  if (!sid) return;
  attachImageToDraft(sid, postId, null);
  renderPanel();
  showToast("Image removed");
}

function startEdit(postId, at) {
  if (editingPostId === postId) return;
  if (editingPostId) commitEdit(editingPostId); // auto-save the previous card
  const sid = activeSessionId();
  const post = sid && getPosts(sid).find((p) => p.id === postId);
  if (!post) return;
  editingPostId = postId;
  editingOriginal = {
    text: [...(post.text || [])],
    hashtags: [...(post.hashtags || [])],
    cta: post.cta || "",
  };
  renderPanel();
  // Focus the editor; the caret goes where the text was clicked (`at`), else
  // at the end of the body.
  requestAnimationFrame(() => {
    const editor = document.querySelector(`[data-post-editor="${postId}"]`);
    if (!editor) return;
    editor.focus();
    const pos = at && document.caretPositionFromPoint?.(at.x, at.y);
    const range = document.createRange();
    if (pos && editor.contains(pos.offsetNode)) {
      range.setStart(pos.offsetNode, pos.offset);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

export function commitEdit(postId) {
  if (editingPostId !== postId) return;
  const sid = activeSessionId();
  const editor = document.querySelector(`[data-post-editor="${postId}"]`);
  if (!sid || !editor) {
    editingPostId = null;
    editingOriginal = null;
    renderPanel();
    return;
  }
  const parsed = parseEditorBody(editor.innerText);
  const original = editingOriginal;
  const changed =
    JSON.stringify(parsed.text) !== JSON.stringify(original.text) ||
    JSON.stringify(parsed.hashtags) !== JSON.stringify(original.hashtags) ||
    parsed.cta !== original.cta;
  editingPostId = null;
  editingOriginal = null;
  if (changed) {
    // A hand edit: the marks of my last rewrite would no longer be true.
    updatePostContent(sid, postId, { ...parsed, revision: null }); // notify → posts-store subscriber re-renders
  } else {
    renderPanel(); // no notify path → render manually
  }
}

export function cancelEdit(postId) {
  if (editingPostId !== postId) return;
  editingPostId = null;
  editingOriginal = null;
  renderPanel();
}

// Reverse of post-card.js#serializeBody — split blank-line-separated
// blocks, find the hashtag-only block (if any), extract its tags into
// the hashtags array. Everything else becomes text[]. CTA folds into
// text[] as a regular paragraph (accepted per spec — only hashtags need
// to re-style on save).
//
// The hashtag block can sit anywhere among the blocks (typically last
// in social-post convention, but a CTA may follow it). Scanning all
// blocks instead of walking from the end keeps the round-trip robust
// against either ordering.
function parseEditorBody(raw) {
  const blocks = String(raw)
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const text = [];
  let hashtags = [];
  for (const block of blocks) {
    if (!hashtags.length && /^(#\S+\s*)+$/.test(block)) {
      hashtags = block
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.replace(/^#/, ""));
    } else {
      text.push(block);
    }
  }
  return { text, hashtags, cta: "" };
}

// The per-card actions on a single draft, from the shell's delegated click
// listener (right-panel.js), at the same point in its branch order. True when
// the click was one of them.
export function handleDraftsClick(event) {
  // Per-card actions on a single draft (Lot 21 rich PostCard).
  const editBtn = event.target.closest("[data-post-edit]");
  if (editBtn) {
    startEdit(editBtn.dataset.postEdit);
    return true;
  }
  // A click on the draft's text opens the editor with the caret where it
  // landed — unless it ended a text selection (the user was copying).
  const editBody = event.target.closest("[data-post-edit-body]");
  if (editBody && window.getSelection()?.isCollapsed !== false) {
    startEdit(editBody.dataset.postEditBody, { x: event.clientX, y: event.clientY });
    return true;
  }
  const saveBtn = event.target.closest("[data-post-edit-save]");
  if (saveBtn) {
    commitEdit(saveBtn.dataset.postEditSave);
    return true;
  }
  const cancelBtn = event.target.closest("[data-post-edit-cancel]");
  if (cancelBtn) {
    cancelEdit(cancelBtn.dataset.postEditCancel);
    return true;
  }
  // The network's "…see more": unclamps the body in place, no re-render.
  const readMore = event.target.closest("[data-post-readmore]");
  if (readMore) {
    const expanded = readMore.closest(".posts__card").classList.toggle("is-expanded");
    readMore.setAttribute("aria-expanded", String(expanded));
    readMore.textContent = expanded ? "Show less" : readMore.dataset.more;
    return true;
  }
  const mentionBtn = event.target.closest("[data-post-mention]");
  if (mentionBtn) {
    onPostMention(mentionBtn.dataset.postMention);
    return true;
  }
  const saveDraftBtn = event.target.closest("[data-post-save-draft]");
  if (saveDraftBtn) {
    onPostSaveAsDraft(saveDraftBtn.dataset.postSaveDraft);
    return true;
  }
  const assignBtn = event.target.closest("[data-post-assign]");
  if (assignBtn) {
    onPostAssign(assignBtn.dataset.postAssign);
    return true;
  }
  const scheduleBtn = event.target.closest("[data-post-schedule]");
  if (scheduleBtn) {
    // The Edit affordance on the scheduled status-card renders as an
    // <a href="#"> per DS pattern — swallow the default so the URL
    // hash doesn't get dirtied when it's clicked.
    if (scheduleBtn.tagName === "A") event.preventDefault();
    onPostSchedule(scheduleBtn.dataset.postSchedule);
    return true;
  }
  const fcRemove = event.target.closest("[data-post-first-comment-remove]");
  if (fcRemove) {
    onPostFirstCommentRemove(fcRemove.dataset.postFirstCommentRemove);
    return true;
  }
  const delBtn = event.target.closest("[data-post-delete]");
  if (delBtn) {
    onPostDelete(delBtn.dataset.postDelete);
    return true;
  }
  const imageBtn = event.target.closest("[data-post-image]");
  if (imageBtn) {
    onPostImage(imageBtn.dataset.postImage);
    return true;
  }
  const imageEditBtn = event.target.closest("[data-post-image-edit]");
  if (imageEditBtn) {
    onPostStudio(imageEditBtn.dataset.postImageEdit);
    return true;
  }
  const studioBtn = event.target.closest("[data-post-studio]");
  if (studioBtn) {
    onPostStudio(studioBtn.dataset.postStudio);
    return true;
  }
  const imageUploadBtn = event.target.closest("[data-post-image-upload]");
  if (imageUploadBtn) {
    onPostImageUpload(imageUploadBtn.dataset.postImageUpload);
    return true;
  }
  // The draft's image preset is a Playbook setting: Change opens where it is set.
  const presetBtn = event.target.closest("[data-post-image-preset]");
  if (presetBtn) {
    navigate(`/playbook/${presetBtn.dataset.postImagePreset}?tab=images`);
    return true;
  }
  // The draft's voice (flag voicePerNetwork): « Give X its own voice » asks
  // in the chat; « Rewrite it » rewrites it in its network's voice as it is now.
  const voiceBtn = event.target.closest("[data-post-voice]");
  if (voiceBtn) {
    const sid = activeSessionId();
    if (sid) giveNetworkVoice(sid, voiceBtn.dataset.postVoice, voiceBtn.dataset.postVoiceNet);
    return true;
  }
  const rewriteBtn = event.target.closest("[data-post-voice-rewrite]");
  if (rewriteBtn) {
    const sid = activeSessionId();
    if (sid) startRewrite(sid, rewriteBtn.dataset.postVoiceRewrite, "voice");
    return true;
  }
  // My last rewrite, from the draft's green status card: undone (then
  // redone), its removed words shown or hidden, or closed — the card and the
  // marks go.
  const changesUndo = event.target.closest("[data-post-changes-undo]");
  if (changesUndo) {
    const sid = activeSessionId();
    if (sid) undoRevision(sid, changesUndo.dataset.postChangesUndo);
    return true;
  }
  const changesToggle = event.target.closest("[data-post-changes-view], [data-post-changes-dismiss]");
  if (changesToggle) {
    const sid = activeSessionId();
    const id = changesToggle.dataset.postChangesView || changesToggle.dataset.postChangesDismiss;
    const post = sid && getPosts(sid).find((p) => p.id === id);
    if (!post?.revision) return true;
    const patch = changesToggle.dataset.postChangesView ? { view: !post.revision.view } : { hidden: true };
    updatePostContent(sid, id, { revision: { ...post.revision, ...patch } });
    return true;
  }
  const gapBtn = event.target.closest("[data-post-playbook-gap]");
  if (gapBtn) {
    navigate(`/playbook/${gapBtn.dataset.postPlaybookGap}`);
    return true;
  }
  const imageRemoveBtn = event.target.closest("[data-post-image-remove]");
  if (imageRemoveBtn) {
    onPostImageRemove(imageRemoveBtn.dataset.postImageRemove);
    return true;
  }
  // "Edit clip" on a draft generated from a video clip — reopen the source
  // clip in the Video Clips modal (single-clip, subtitles tab). Saving
  // persists to the source AND re-syncs this draft's PIP (trim / format /
  // subtitle style) so the card reflects the edit.
  const postClipEditBtn = event.target.closest("[data-post-clip-edit]");
  if (postClipEditBtn) {
    const pid = postClipEditBtn.dataset.postClipEdit;
    const sid = activeSessionId();
    if (!sid) return true;
    const post = getPosts(sid).find((p) => p.id === pid);
    const ref = post && post.clipRef;
    if (!ref || !ref.sourceId || !ref.clipId) return true;
    const source = getStreamSources(sid).find((s) => s.id === ref.sourceId);
    if (!source) return true;
    // flag clipsSpace: one editor — the clip opens in the Clips space's.
    if (isFlagOn("clipsSpace")) {
      import("../../screens/clips/open-in-clips.js?v=2766").then(({ openInClips }) =>
        openInClips(sid, source, ref.clipId),
      );
      return true;
    }
    openVideoClipsModal(source, {
      editingClipId: ref.clipId,
      captionsTab: true,
      clipOverrides: { format: post.format },
      onSaveClips: (srcId, nextClips) => {
        updateSourceClips(srcId, nextClips);
        const edited = (nextClips || []).find((c) => c.id === ref.clipId);
        if (!edited) return;
        updatePostClip(sid, pid, {
          start: edited.start,
          end: edited.end,
          format: edited.format || null,
          subtitleStyle: edited.captionsOn ? edited.captionStyle : "none",
        });
      },
    });
    return true;
  }
  return false;
}
