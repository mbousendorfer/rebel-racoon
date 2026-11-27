// Which Playbook a surface works for.
//
// Three answers, one per kind of surface:
//
//   • Insights reads ONE Playbook at a time, and its heading is where you change
//     which (insights/pieces.js `playbookTitle`). That pick is the ACTIVE
//     Playbook below — persisted, like the sidebar's collapse state, so
//     reopening Insights lands on the brand you left. Nothing else reads it.
//   • New work — a fresh chat, a clip studio, a batch, a repurpose board — is
//     born under the default Playbook (`playbookForNewWork`), the value their
//     own pickers open on.
//   • A chat writes for its own Playbook (`sessionPlaybookId`).
//
// The workspace model (flag `playbookWorkspace`: one active Playbook chosen in
// the rail scoping every surface, an account home at `/home`) was deleted on
// 2026-11-27. The Topic Feed and its settings read `?pb=`.
//
// Public API:
//   getActivePlaybookId()  → string | null
//   getActivePlaybook()    → Context | null   (falls back to the default)
//   setActivePlaybook(id)  mutates + notifies
//   subscribe(fn)          → unsubscribe
//   playbookForNewWork()   → the Playbook new work is born under
//   sessionPlaybookId(id)  → the Playbook a chat writes for

import { getContexts, getContextById, getDefaultContext } from "./contexts-store.js?v=2941";
import { createNotifier } from "./store-utils.js?v=2941";
import { getSessionById } from "./sessions-store.js?v=2941";
import { parseHashParams } from "./url-state.js?v=2941";

const KEY = "archie-active-playbook";

const notifier = createNotifier("active-playbook");
export const subscribe = notifier.subscribe;

let activeId = read();

function read() {
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

function write(id) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Resolved on every read rather than cached: a stored id can outlive the
// Playbook it names — deleted elsewhere, or absent in `new-alt` mode where the
// stores seed empty — and a scope pointing at nothing would empty the page
// with no way to tell why.
export function getActivePlaybook() {
  const stored = activeId ? getContextById(activeId) : null;
  if (stored) return stored;
  const fallback = getDefaultContext() || getContexts()[0] || null;
  if (fallback && fallback.id !== activeId) {
    activeId = fallback.id;
    write(activeId);
  }
  return fallback;
}

export function getActivePlaybookId() {
  const pb = getActivePlaybook();
  return pb ? pb.id : null;
}

export function setActivePlaybook(id) {
  if (!id || id === activeId) return;
  activeId = id;
  write(id);
  notifier.notify(null);
}

// The Playbook a piece of NEW work is born under — a fresh chat, a clip studio,
// a batch, a repurpose board: the implicit default, which is the value those
// pickers open on.
export function playbookForNewWork() {
  return getDefaultContext();
}

// The Playbook a chat writes for. A chat not created yet (`new`, `new-<id>`)
// is in no store: its Playbook is the URL's (the composer pill writes it
// there), else the one new work is born under — session.js's own rule. Read
// from the store alone, the first chat after the run had none, so no gate on
// it fired (the Voice step, the accounts — 2026-11-05).
export function sessionPlaybookId(sessionId) {
  const s = getSessionById(sessionId);
  if (s) return s.contextId || null;
  if (!sessionId || (sessionId !== "new" && !String(sessionId).startsWith("new-"))) return null;
  const here = window.location.hash.match(/^#\/session\/([^?]+)/)?.[1];
  return (here === sessionId && parseHashParams().get("contextId")) || playbookForNewWork()?.id || null;
}
