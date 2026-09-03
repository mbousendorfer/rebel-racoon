// Who may do what to a Playbook.
//
// A Playbook has exactly one owner and one of two scopes:
//   "personal"     — only its owner sees it
//   "organization" — everyone in the org may SEE and USE it; only the owner
//                    (and a manager) may EDIT it
//
// There is no named sharing: you don't hand a Playbook to three colleagues, you
// either keep it or you put it in front of the whole org. That was the explicit
// product call, and it's why this file has no member-list plumbing.
//
// ⚠️ The store deliberately keeps returning everything. Filtering inside
// contexts-store would make the degraded-chat banner impossible to write: a chat
// whose Playbook stopped being shared still has to name it ("this chat used
// Nutrix · product launch"), which means reading a Playbook you may no longer
// open. So the store holds the facts and this module holds the rights — every
// surface asks here, and `revokedContextFor()` is the one place allowed to look
// past the gate.

import { getContexts, getContextById } from "./contexts-store.js?v=1038";
import { isFlagOn } from "./feature-flags.js?v=1038";
import { CURRENT_USER, isManager, memberName, getMember } from "./org.js?v=1038";

// Single choke point. Flag OFF ⇒ the app behaves exactly as it did before
// sharing existed: one implicit user, everything visible, everything editable.
function on() {
  return isFlagOn("playbookSharing");
}

function isShared(ctx) {
  return !!ctx && ctx.scope === "organization";
}

export function isMine(ctx) {
  if (!ctx) return false;
  if (!on()) return true;
  return ctx.ownerId === CURRENT_USER.id;
}

export function ownerOf(ctx) {
  return (ctx && getMember(ctx.ownerId)) || null;
}

export function ownerName(ctx) {
  return memberName(ctx?.ownerId);
}

// ── The rights table ──────────────────────────────────────────────────
// Owner            → everything
// Shared with me   → view / use / duplicate (and edit too, if I'm a manager)
// Someone else's personal Playbook → nothing at all

export function canView(ctx) {
  if (!ctx) return false;
  if (!on()) return true;
  return isMine(ctx) || isShared(ctx);
}

// "Use" = attach it to a chat and generate with it.
function canUse(ctx) {
  return canView(ctx);
}

export function canEdit(ctx) {
  if (!ctx) return false;
  if (!on()) return true;
  if (isMine(ctx)) return true;
  // A manager's reach stops at what the org can already see — an untouched
  // personal Playbook stays private even from them (doc §8, Q1).
  return isShared(ctx) && isManager();
}

export const canDelete = canEdit;

// Sharing and hand-over are the only two rights that don't exist at all with
// the flag off — everything else has a pre-sharing equivalent that must keep
// behaving identically, but a Share button would be a new affordance.
export function canManageSharing(ctx) {
  return on() && canEdit(ctx);
}

export const canTransfer = canManageSharing;

// True when acting on a Playbook I don't own — the case that owes its owner a
// notification (doc §6.4).
export function actingOnBehalf(ctx) {
  return on() && !!ctx && !isMine(ctx);
}

export function accessLabel(ctx) {
  if (!on() || !ctx) return "";
  if (!isMine(ctx)) return `Shared by ${ownerName(ctx)}`;
  return isShared(ctx) ? "Shared with org" : "";
}

// ── What the surfaces list ────────────────────────────────────────────

export function visibleContexts() {
  return getContexts().filter(canView);
}

export function usableContexts() {
  return getContexts().filter(canUse);
}

export function editableContexts() {
  return getContexts().filter(canEdit);
}

// The tombstone: what a chat can still say about a Playbook it lost. Returns
// null whenever the chat is fine, so callers can treat it as the predicate.
export function revokedContextFor(session) {
  const id = session?.contextId;
  if (!on() || !id) return null;
  const ctx = getContextById(id);
  // Deleted outright, or pulled back to personal by its owner — either way the
  // chat can no longer generate. A missing record still gets a name so the
  // banner reads like a sentence.
  if (!ctx) return { name: "a Playbook", ownerName: "its owner" };
  if (canView(ctx)) return null;
  return { name: ctx.name, ownerName: ownerName(ctx) };
}
