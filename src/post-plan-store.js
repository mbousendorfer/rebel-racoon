// post-plan-store — the post plans of a chat (prod `update_post_brief` /
// `confirm_post_brief` / `switch_brief`). A post plan is what I write from when
// a chat has no source: the topic you gave, the facts you added, what I'll
// assume, what I won't invent because you haven't said it, and what you asked
// me to leave out. It belongs to the chat that made it (CONCEPTS §3), like its
// sources and drafts — never to the Playbook.
//
// Shape: { id, topic, audience, facts[], assumptions[], missing[], leftOut[],
//          perProfile, stage, createdAt }
//   stage: "planning" (questions still open) → "ready" (recap shown, waiting
//          for the go) → "writing" → "written"
//
// Public API:
//   getPlans(sid) · getActivePlan(sid) · createPlan(sid, partial)
//   updatePlan(sid, id, partial) · setActivePlan(sid, id)
//   subscribe(sid, fn) · clearSession(sid)

import { createSessionNotifier } from "./store-utils.js?v=2536";

const plansBySession = new Map(); // sid → { plans: [], activeId }
const notifier = createSessionNotifier("post-plan-store");

let seq = 0;
const newId = () => `plan-${Date.now().toString(36)}-${(seq += 1)}`;

function entry(sessionId) {
  if (!plansBySession.has(sessionId)) plansBySession.set(sessionId, { plans: [], activeId: null });
  return plansBySession.get(sessionId);
}

const notify = (sessionId) => notifier.notify(sessionId, getPlans(sessionId));

export function getPlans(sessionId) {
  return entry(sessionId).plans;
}

export function getActivePlan(sessionId) {
  const e = entry(sessionId);
  return e.plans.find((p) => p.id === e.activeId) || null;
}

export function createPlan(sessionId, partial) {
  const e = entry(sessionId);
  const plan = {
    id: newId(),
    topic: "",
    audience: null,
    facts: [],
    assumptions: [],
    missing: [],
    leftOut: [],
    perProfile: 2,
    stage: "planning",
    createdAt: Date.now(),
    ...partial,
  };
  e.plans.push(plan);
  e.activeId = plan.id;
  notify(sessionId);
  return plan;
}

export function updatePlan(sessionId, id, partial) {
  const plan = getPlans(sessionId).find((p) => p.id === id);
  if (!plan) return null;
  Object.assign(plan, partial);
  notify(sessionId);
  return plan;
}

export function setActivePlan(sessionId, id) {
  const e = entry(sessionId);
  if (!e.plans.some((p) => p.id === id)) return;
  e.activeId = id;
  notify(sessionId);
}

export const subscribe = notifier.subscribe;

export function clearSession(sessionId) {
  plansBySession.delete(sessionId);
  notifier.clear(sessionId, []);
}
