// Demo mode (flag demoMode) — the state only, a leaf the stores can read at
// load without a cycle. What the demo does lives in demo-flow.js.
//
// A first-time user who wants to try Archie before connecting anything gets a
// chat on Bramble & Bean (mocks/demo-brand.js): the Playbook and the pretend
// accounts are seeded at load whenever this state is on, so the start and a
// reload take the same path. Kept in sessionStorage under `archie-demo` as
// { done }; switching user mode clears it with the rest of the
// session, and leaving the demo removes it.

import { isFlagOn } from "./feature-flags.js?v=2233";

export const DEMO_KEY = "archie-demo";

function read() {
  try {
    return JSON.parse(window.sessionStorage.getItem(DEMO_KEY) || "null");
  } catch {
    return null;
  }
}

export function writeDemo(state) {
  try {
    if (state) window.sessionStorage.setItem(DEMO_KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}

export function isDemo() {
  return isFlagOn("demoMode") && !!read();
}

// The first wave of drafts has landed: the drafts stay, nothing new is written.
export function isDemoDone() {
  return isDemo() && !!read().done;
}

export function markDemoDone() {
  const s = read();
  if (s) writeDemo({ ...s, done: true });
}
