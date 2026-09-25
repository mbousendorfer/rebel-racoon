import { html, raw, escapeText } from "../utils.js?v=1250";
import { showToast } from "./toast.js?v=1250";
import { getQueue, getQueueOn, dayKey, addToQueue, subscribe as subscribeQueue } from "../schedule-store.js?v=1250";
import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=1250";
import {
  renderProfileTag,
  profileForNetwork,
  NETWORK_LABEL,
  NETWORK_ICON_BY_PLATFORM,
} from "../social-profiles.js?v=1250";
import { getContextById } from "../contexts-store.js?v=1250";
import { canEdit } from "../playbook-access.js?v=1250";
import { getPreset, savePreset } from "../schedule-presets-store.js?v=1250";

// Schedule modal — one column, result first.
//   • Header   — "Schedule N drafts" + one line saying I already picked.
//   • Rhythm   — ONE sentence summing up how the dates were picked
//                ("Every weekday · from Sat 26 Sep · best time per network")
//                and an "Adjust" disclosure, closed at rest, holding the
//                four settings: rhythm (multi only), start day, time of day,
//                days to skip. Every change re-spreads live.
//   • Timeline — the batch as a posting schedule: ONE bordered list, one row
//                per draft in date order, hairlines between rows. Each row
//                reads WHAT → WHEN: the draft on the left (media thumbnail
//                first, then profile + first lines), its date on the right
//                (a tinted cell — tile, time + pen, why, how busy the day
//                is), and the ✕ in a column of its own.
//   • Footer   — what the batch adds up to ("4 posts over 8 days"), the
//                disclosure line, then Cancel + the one primary.
//
// ⚠️ This replaced a two-mode version (Optimal / Custom radio cards, cadence
// chips, a free-text "describe your own strategy", a "Compute best times"
// gate, a month calendar and a drag-to-reorder list). Every control sat at
// the same level and two primaries competed — Compute unlocked Schedule and
// nothing said so, while the calendar already painted dates that did not
// yet count. Don't bring the gate or the mode picker back: dates are
// proposed on open, and editing one IS the custom mode.
//
// Finding the times TAKES a beat — ~2.5s on open and after every setting
// change, the rows landing one after another. That is a wait, not a gate:
// nothing to click to start it, and a change mid-way simply restarts it.
// Schedule waits for it (a date the user hasn't seen can't be confirmed).
//
// What else is on a suggested day is answered ON the row: a link naming the
// count ("2 other posts that day"), orange and naming the clash when a post on
// the SAME network sits within two hours, which unfolds that day's agenda
// under the row. The sentence says how many busy days I stepped over.
//
// The rhythm can be saved PER PLAYBOOK (schedule-presets-store): the modal
// opens on the chat's Playbook preset when there is one. Operational config,
// so a store keyed by Playbook — never a field on the fiche (CONCEPTS §1).
//
// A hand-edited date is PINNED: the settings re-spread every other draft
// around it and never overwrite it, and the row says so ("Set by you") with
// a way back to my suggestion.
//
// The mock end-to-end is the entire scope — confirm pushes new entries
// into schedule-store, fires a toast. Real Publishing API call is the
// replacement point.

const ROOT_ID = "scheduleModal";

// Per-network suggested publishing windows. Each entry lists
// { dow: [0..6 sunday-first], hours: [24h]} — mirrors the kind of static
// benchmarks a publishing tool ships with out of the box.
const PER_NETWORK_OPTIMAL = {
  linkedin: { dow: [2, 3, 4], hours: [9, 12] },
  twitter: { dow: [1, 2, 3, 4, 5], hours: [10, 14, 17] },
  x: { dow: [1, 2, 3, 4, 5], hours: [10, 14, 17] },
  instagram: { dow: [2, 4, 0], hours: [11, 19] },
  facebook: { dow: [1, 3, 5], hours: [13, 16] },
  tiktok: { dow: [2, 3, 4], hours: [18, 20, 22] },
};

const FALLBACK_OPTIMAL = { dow: [1, 2, 3, 4, 5], hours: [9, 13, 17] };

// Posting rhythms. Each decides WHICH days a draft can land on; the
// per-network map then decides the HOUR. `days` is a sunday-first dow set;
// `every` spaces slots N days apart from the start; `weekly` repeats the
// start day's weekday.
const CADENCES = [
  { id: "weekdays", label: "Every weekday", days: [1, 2, 3, 4, 5] },
  { id: "thrice", label: "3 times a week", days: [1, 3, 5] },
  { id: "twice", label: "Twice a week", days: [2, 4] },
  { id: "alternate", label: "Every other day", every: 2 },
  { id: "once", label: "Once a week", weekly: true },
];

// Time-of-day bias. `null` = each network's own best hour.
const TIMES_OF_DAY = [
  { id: null, label: "Best time", short: "best time per network" },
  { id: "morning", label: "Morning", short: "mornings" },
  { id: "afternoon", label: "Afternoon", short: "afternoons" },
  { id: "evening", label: "Evening", short: "evenings" },
];

// Monday-first, the way a work week reads. Values are sunday-first dow.
const WEEKDAYS = [
  { dow: 1, short: "Mon" },
  { dow: 2, short: "Tue" },
  { dow: 3, short: "Wed" },
  { dow: 4, short: "Thu" },
  { dow: 5, short: "Fri" },
  { dow: 6, short: "Sat" },
  { dow: 0, short: "Sun" },
];

function emptyState() {
  return {
    open: false,
    posts: [], // [{id, network, text/preview}]
    slots: [], // [{post, when: epoch ms, pinned: bool}] — one per draft, in post order
    strategy: { cadence: "weekdays", timeOfDay: null, skip: [], startFrom: null },
    adjustOpen: false,
    peekId: null, // the row whose day agenda is unfolded (one at a time)
    playbook: null, // the chat's Playbook — whose rhythm preset we read / save
    skippedBusy: 0, // busy days the spread stepped over (said in the sentence)
    onConfirm: null,
    status: "idle", // 'idle' | 'scheduling' | 'error'
    errorMessage: "",
  };
}

let state = emptyState();
let unsubscribeQueue = null;

// The "finding the best times" beat: the first date lands after COMPUTE_MS,
// the last one COMPUTE_STAGGER_MS later — whatever the batch size, so a
// 12-draft batch doesn't take twice as long as a 3-draft one.
const COMPUTE_MS = 2000;
const COMPUTE_STAGGER_MS = 800;
let computeTimers = [];

function cancelCompute() {
  computeTimers.forEach(clearTimeout);
  computeTimers = [];
}

// Re-spread, then hold every freshly-picked date back until its turn.
// Pinned rows are never recomputed, so they never wait.
function compute() {
  cancelCompute();
  respread();
  const pending = state.slots.filter((s) => !s.pinned);
  pending.forEach((slot, i) => {
    slot.pending = true;
    const at = COMPUTE_MS + (pending.length > 1 ? Math.round((i * COMPUTE_STAGGER_MS) / (pending.length - 1)) : 0);
    computeTimers.push(
      setTimeout(() => {
        if (!state.open) return;
        slot.pending = false;
        slot.justLanded = true; // consumed by the next render — plays the landing once
        render();
      }, at),
    );
  });
}

function isComputing() {
  return state.slots.some((s) => s.pending);
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultStartFrom() {
  // Tomorrow — never schedule a batch in the past.
  const d = startOfDay(Date.now());
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

function pickHour(hours, timeOfDay) {
  if (!hours || hours.length === 0) return 9;
  const sorted = [...hours].sort((a, b) => a - b);
  if (timeOfDay === "morning") return sorted[0];
  if (timeOfDay === "evening") return sorted[sorted.length - 1];
  if (timeOfDay === "afternoon") return sorted[Math.floor(sorted.length / 2)];
  return sorted[0];
}

function networkOf(post) {
  return (post.network || "linkedin").toLowerCase();
}

export function init() {
  let scrim = document.getElementById(`${ROOT_ID}Scrim`);
  let modal = document.getElementById(ROOT_ID);
  if (!modal) {
    scrim = document.createElement("div");
    scrim.id = `${ROOT_ID}Scrim`;
    scrim.className = "schedule-modal__scrim";
    scrim.hidden = true;
    document.body.appendChild(scrim);

    modal = document.createElement("div");
    modal.id = ROOT_ID;
    modal.className = "ap-dialog schedule-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", `${ROOT_ID}Title`);
    modal.hidden = true;
    document.body.appendChild(modal);
  }

  modal.addEventListener("click", onClick);
  modal.addEventListener("change", onChange);
  // Backdrop click + Escape go through the shared coordinator. `state.open`
  // is the canonical isOpen — visibility is driven by .hidden.
  bindOverlayDismissal({
    modal,
    backdrop: scrim,
    close,
    isOpen: () => state.open,
  });
}

export function open({ posts, onConfirm, playbookId = null }) {
  if (!posts || posts.length === 0) return;
  // Register with the coordinator first so any other overlay currently
  // up gets closed before we paint; it also snapshots the trigger for focus.
  requestOpen(ROOT_ID, close);
  const playbook = playbookId ? getContextById(playbookId) : null;
  const preset = playbook ? getPreset(playbook.id) : null;
  state = {
    ...emptyState(),
    open: true,
    posts: [...posts],
    playbook,
    // The Playbook's saved rhythm when it has one — but never its start date:
    // a batch always starts tomorrow.
    strategy: {
      ...(preset || { cadence: "weekdays", timeOfDay: null, skip: [] }),
      startFrom: defaultStartFrom(),
    },
    onConfirm: typeof onConfirm === "function" ? onConfirm : null,
  };
  // Dates are proposed on open — the user waits for them, never asks for them.
  compute();
  state.entering = true; // first paint staggers the rows in (consumed by render)
  if (!unsubscribeQueue) {
    unsubscribeQueue = subscribeQueue(() => {
      if (state.open) render();
    });
  }
  render();
}

function close() {
  cancelCompute();
  state = emptyState();
  if (unsubscribeQueue) {
    unsubscribeQueue();
    unsubscribeQueue = null;
  }
  render();
  notifyClose(ROOT_ID);
}

// ── The spread ────────────────────────────────────────────────────────
// Does a day match the rhythm? One draft has no rhythm: it takes its
// network's best days instead.
function dayMatches(day, start, strategy) {
  const dow = day.getDay();
  if (strategy.skip.includes(dow)) return false;
  if (state.posts.length === 1) {
    const map = PER_NETWORK_OPTIMAL[networkOf(state.posts[0])] || FALLBACK_OPTIMAL;
    return map.dow.includes(dow);
  }
  const cadence = CADENCES.find((c) => c.id === strategy.cadence) || CADENCES[0];
  if (cadence.every) return Math.round((day - start) / 86400000) % cadence.every === 0;
  if (cadence.weekly) return dow === start.getDay();
  return cadence.days.includes(dow);
}

// How many days that matched the rhythm I stepped over because something
// was already scheduled on them — the proof, in the sentence, that the
// spread read the calendar.
// The days already carrying a post on one of THIS batch's networks. That is
// what the spread avoids: a Facebook post doesn't crowd a LinkedIn one, so a
// day busy on another network stays eligible — and its row says what's there.
// (A batch is usually one network: the Drafts panel schedules per network.)
function busyDaysForBatch() {
  const networks = new Set(state.posts.map((p) => platformOf(networkOf(p))));
  const keys = new Set();
  for (const e of getQueue()) if (networks.has(platformOf(e.network))) keys.add(dayKey(e.when));
  return keys;
}

function countSkippedBusy() {
  const free = state.slots.filter((x) => !x.pinned);
  if (!free.length) return 0;
  const last = Math.max(...free.map((x) => x.when));
  const start = startOfDay(state.strategy.startFrom || defaultStartFrom());
  const busy = busyDaysForBatch();
  let n = 0;
  for (const cursor = new Date(start); cursor.getTime() <= last; cursor.setDate(cursor.getDate() + 1)) {
    if (busy.has(dayKey(cursor.getTime())) && dayMatches(cursor, start, state.strategy)) n++;
  }
  return n;
}

// Walking from `startFrom`, collect the next `count` days that match the
// rhythm, skipping the weekdays the user ticked, any day already carrying a
// post on one of the batch's networks, and any day a pinned draft already
// holds — so the new dates slot in around what's on the calendar. Bounded
// look-ahead so a pathological pattern can't loop forever.
function strategyDays(count, strategy, takenKeys) {
  const start = startOfDay(strategy.startFrom || defaultStartFrom());
  const single = state.posts.length === 1;
  // One draft has no rhythm: any day qualifies, the network's best day wins below.
  const cadence = single ? null : CADENCES.find((c) => c.id === strategy.cadence) || CADENCES[0];
  const skip = new Set(strategy.skip);
  const busy = busyDaysForBatch();
  const startDow = start.getDay();
  const days = [];
  const cursor = new Date(start);
  for (let guard = 0; days.length < count && guard < 400; guard++) {
    const dow = cursor.getDay();
    let qualifies = true;
    if (cadence?.every) {
      qualifies = Math.round((cursor - start) / 86400000) % cadence.every === 0;
    } else if (cadence?.weekly) {
      qualifies = dow === startDow;
    } else if (cadence) {
      qualifies = cadence.days.includes(dow);
    }
    const key = dayKey(cursor.getTime());
    const taken = busy.has(key) || takenKeys.has(key);
    if (qualifies && !skip.has(dow) && !taken) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// A single draft goes to the first free day that is one of its network's
// best days — "Best time for this post", not "the first free day".
function singleDay(post, strategy) {
  const map = PER_NETWORK_OPTIMAL[networkOf(post)] || FALLBACK_OPTIMAL;
  const candidates = strategyDays(14, strategy, new Set());
  return candidates.find((d) => map.dow.includes(d.getDay())) || candidates[0];
}

// Re-spread every draft that the user hasn't set by hand. Pinned rows keep
// their date and their day counts as taken.
function respread() {
  const s = state.strategy;
  const byPost = new Map(state.slots.map((slot) => [slot.post.id, slot]));
  const pinned = state.posts.filter((p) => byPost.get(p.id)?.pinned);
  const free = state.posts.filter((p) => !byPost.get(p.id)?.pinned);
  const takenKeys = new Set(pinned.map((p) => dayKey(byPost.get(p.id).when)));
  const days =
    state.posts.length === 1 ? [singleDay(free[0] || state.posts[0], s)] : strategyDays(free.length, s, takenKeys);
  const fallback = startOfDay(s.startFrom || defaultStartFrom());

  let i = 0;
  state.slots = state.posts.map((post) => {
    const existing = byPost.get(post.id);
    if (existing?.pinned) return existing;
    const map = PER_NETWORK_OPTIMAL[networkOf(post)] || FALLBACK_OPTIMAL;
    const hour = pickHour(map.hours, s.timeOfDay);
    // If the rhythm couldn't yield enough distinct days, stack the remainder
    // on the last day an hour apart so nothing silently drops.
    const baseDay = days[i] || days[days.length - 1] || fallback;
    const overflow = i >= days.length ? i - days.length + 1 : 0;
    i++;
    const when = new Date(baseDay);
    when.setHours(hour + overflow, 0, 0, 0);
    return { post, when: when.getTime(), pinned: false };
  });
  state.skippedBusy = countSkippedBusy();
}

// ── Events ────────────────────────────────────────────────────────────
function onClick(event) {
  // One .ap-select open at a time — a click anywhere else in the dialog
  // closes the others (the <details> doesn't do it on its own).
  event.currentTarget.querySelectorAll("details.ap-select[open]").forEach((d) => {
    if (!d.contains(event.target)) d.open = false;
  });

  if (event.target.closest("[data-schedule-close]")) {
    close();
    return;
  }
  if (event.target.closest("[data-schedule-adjust]")) {
    state.adjustOpen = !state.adjustOpen;
    state.adjustRevealing = state.adjustOpen;
    render();
    return;
  }
  const cadence = event.target.closest("[data-schedule-cadence]");
  if (cadence) {
    state.strategy.cadence = cadence.dataset.scheduleCadence;
    compute();
    render();
    return;
  }
  const tod = event.target.closest("[data-schedule-tod]");
  if (tod) {
    state.strategy.timeOfDay = tod.dataset.scheduleTod || null;
    compute();
    render();
    return;
  }
  // The time on a row is text, not a field: its pen opens the browser's own
  // date-time picker, anchored on a hidden input sitting under the row head.
  const when = event.target.closest("[data-schedule-when]");
  if (when) {
    const input = modal().querySelector(`[data-schedule-slot="${CSS.escape(when.dataset.scheduleWhen)}"]`);
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
    return;
  }
  const peek = event.target.closest("[data-schedule-peek]");
  if (peek) {
    state.peekId = state.peekId === peek.dataset.schedulePeek ? null : peek.dataset.schedulePeek;
    render();
    return;
  }
  if (event.target.closest("[data-schedule-save-preset]")) {
    if (!state.playbook || !canEdit(state.playbook)) return;
    const { cadence, timeOfDay, skip } = state.strategy;
    savePreset(state.playbook.id, { cadence, timeOfDay, skip });
    render();
    return;
  }
  const reset = event.target.closest("[data-schedule-reset]");
  if (reset) {
    const slot = state.slots.find((s) => s.post.id === reset.dataset.scheduleReset);
    if (slot) slot.pinned = false;
    compute();
    render();
    return;
  }
  const removeBtn = event.target.closest("[data-schedule-remove]");
  if (removeBtn) {
    const id = removeBtn.dataset.scheduleRemove;
    state.posts = state.posts.filter((p) => p.id !== id);
    state.slots = state.slots.filter((s) => s.post.id !== id);
    if (state.posts.length === 0) close();
    else render();
    return;
  }
  if (event.target.closest("[data-schedule-confirm]")) {
    if (state.status === "scheduling" || isComputing()) return;
    confirmSchedule();
  }
}

function onChange(event) {
  if (event.target.matches("[data-schedule-start]")) {
    const ts = new Date(`${event.target.value}T00:00:00`).getTime();
    if (isNaN(ts)) return;
    state.strategy.startFrom = ts;
    compute();
    render();
    return;
  }
  if (event.target.matches("[data-schedule-skip]")) {
    const dow = parseInt(event.target.value, 10);
    const skip = new Set(state.strategy.skip);
    if (event.target.checked) skip.add(dow);
    else skip.delete(dow);
    // Skipping all seven days would leave nowhere to post — refuse the last one.
    if (skip.size === 7) {
      event.target.checked = false;
      return;
    }
    state.strategy.skip = [...skip];
    compute();
    render();
    return;
  }
  const slotInput = event.target.closest("[data-schedule-slot]");
  if (slotInput) {
    const ts = new Date(slotInput.value).getTime();
    const slot = state.slots.find((s) => s.post.id === slotInput.dataset.scheduleSlot);
    if (!slot || isNaN(ts)) return;
    slot.when = ts;
    slot.pinned = true;
    slot.justLanded = true; // the row moves to its new place in the timeline — say so
    render();
  }
}

function confirmSchedule() {
  state.status = "scheduling";
  state.errorMessage = "";
  render();

  const slots = state.slots.map((s) => ({ postId: s.post.id, when: s.when }));

  // Push into the live schedule queue before onConfirm, which may close the modal.
  addToQueue(
    state.slots.map((s) => ({
      id: `q-${s.post.id}-${s.when}`,
      network: s.post.network || "linkedin",
      text: extractFirstLine(s.post),
      when: s.when,
    })),
  );

  let result;
  try {
    result = state.onConfirm ? state.onConfirm(slots) : undefined;
  } catch (err) {
    onConfirmFailed(err);
    return;
  }

  if (result && typeof result.then === "function") {
    Promise.resolve(result).then(() => onConfirmSucceeded(slots), onConfirmFailed);
  } else {
    onConfirmSucceeded(slots);
  }
}

function extractFirstLine(post) {
  // post.text may be an array of paragraphs on real drafts.
  if (Array.isArray(post.text) && post.text.length > 0) return post.text[0];
  const text = (post.preview || post.text || "").toString();
  return text.split("\n")[0] || text;
}

function onConfirmSucceeded(slots) {
  showToast(`${slots.length} ${slots.length === 1 ? "post" : "posts"} scheduled`);
  close();
}

function onConfirmFailed(err) {
  // eslint-disable-next-line no-console
  console.error("schedule-modal: confirm failed", err);
  state.status = "error";
  state.errorMessage = (err && err.message) || "Couldn't schedule those drafts. Try again.";
  render();
}

// ── Render ────────────────────────────────────────────────────────────
function modal() {
  return document.getElementById(ROOT_ID);
}

function render() {
  const scrim = document.getElementById(`${ROOT_ID}Scrim`);
  const modal = document.getElementById(ROOT_ID);
  if (!scrim || !modal) return;
  if (!state.open) {
    scrim.hidden = true;
    modal.hidden = true;
    modal.innerHTML = "";
    return;
  }
  scrim.hidden = false;
  modal.hidden = false;
  // The reveal re-renders while the user may have a select open — keep it open.
  const openSelect = modal.querySelector("details.ap-select[open]")?.dataset.selectKey;
  modal.innerHTML = renderInner();
  // One-shot animation flags: each plays on exactly one paint, so the
  // re-renders the staggered reveal causes never restart an animation.
  state.entering = false;
  state.adjustRevealing = false;
  state.slots.forEach((slot) => (slot.justLanded = false));
  if (openSelect) {
    const again = modal.querySelector(`details.ap-select[data-select-key="${openSelect}"]`);
    if (again) again.open = true;
  }
}

function renderInner() {
  const n = state.posts.length;
  const busy = state.status === "scheduling";
  const computing = isComputing();
  return html`
    <div class="ap-dialog-header">
      <span class="ap-dialog-title" id="${ROOT_ID}Title">Schedule ${n} ${n === 1 ? "draft" : "drafts"}</span>
      <span class="ap-dialog-subtitle">
        ${computing
          ? n === 1
            ? "I'm finding the best time for this post, around what's already scheduled."
            : "I'm finding the best time for each draft, around what's already scheduled."
          : n === 1
            ? "I picked the best time for this post, around what's already scheduled. Change it if you need to."
            : "I picked a time for each draft, around what's already scheduled. Change any of them."}
      </span>
    </div>

    <div class="ap-dialog-content schedule-modal__body">
      ${state.status === "error"
        ? raw(`
            <div class="ap-infobox error" role="alert">
              <i class="ap-icon-error_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts">
                  <span class="ap-infobox-message">${escapeText(state.errorMessage)}</span>
                </div>
              </div>
            </div>
          `)
        : ""}
      ${raw(renderRhythm())} ${raw(renderTimeline())}
    </div>

    <div class="ap-dialog-footer">
      <div class="ap-dialog-footer-left schedule-modal__foot">${raw(renderFootSummary())}</div>
      <div class="ap-dialog-footer-right">
        <button type="button" class="ap-button ghost grey" data-schedule-close ${busy ? "disabled" : ""}>Cancel</button>
        <button
          type="button"
          class="ap-button primary orange"
          data-schedule-confirm
          ${busy || computing ? "disabled" : ""}
        >
          ${busy
            ? raw(`<span class="schedule-modal__spinner" aria-hidden="true"></span><span>Scheduling…</span>`)
            : raw(
                `<i class="ap-icon-calendar"></i><span>${state.status === "error" ? "Try again" : `Schedule ${n} ${n === 1 ? "post" : "posts"}`}</span>`,
              )}
        </button>
      </div>
    </div>

    <button type="button" class="ap-dialog-close" data-schedule-close aria-label="Close (Esc)">
      <i class="ap-icon-close"></i>
    </button>
  `;
}

// ── Formatting (en-US like the rest of the copy — a French date inside an
// English sentence reads as a bug) ──────────────────────────────────────
function formatDay(ts) {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatShortDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function networkName(network) {
  return NETWORK_LABEL[network === "twitter" ? "x" : network] || network;
}

// ── How I picked ──────────────────────────────────────────────────────
// One sentence, its variable parts in bold — the closed state of the
// settings, so the reasoning is read before a way to change it is offered.
function rhythmSentence() {
  const s = state.strategy;
  const b = (t) => `<strong>${escapeText(t)}</strong>`;
  const tod = TIMES_OF_DAY.find((t) => t.id === s.timeOfDay) || TIMES_OF_DAY[0];
  const at = s.timeOfDay ? `in the ${b(tod.label.toLowerCase())}` : `at ${b("each network's best time")}`;
  const skip = s.skip.length
    ? `, never on ${b(
        WEEKDAYS.filter((w) => s.skip.includes(w.dow))
          .map((w) => w.short)
          .join(", "),
      )}`
    : "";
  // Whose rhythm this is, when it's the Playbook's saved one.
  const lead = usingSavedPreset() ? `${b(`${state.playbook.name}'s rhythm`)} — ` : "";
  const n = state.skippedBusy;
  const stepped =
    n > 0 && !isComputing()
      ? ` I stepped over ${b(`${n} ${n === 1 ? "day" : "days"}`)} that already ${n === 1 ? "has a post" : "have posts"} on the same network.`
      : "";
  if (state.posts.length === 1) {
    const name = networkName(networkOf(state.posts[0]));
    const when = s.timeOfDay ? `in the ${b(tod.label.toLowerCase())}` : `at ${b(`${name}'s best time`)}`;
    return `${lead}${lead ? "from" : "From"} ${b(formatDay(s.startFrom))}, ${when}${skip}.${stepped}`;
  }
  const cadence = CADENCES.find((c) => c.id === s.cadence) || CADENCES[0];
  return `${lead}${b(cadence.label)} from ${b(formatDay(s.startFrom))}, ${at}${skip}.${stepped}`;
}

function sameRhythm(a, b) {
  return (
    a.cadence === b.cadence &&
    (a.timeOfDay || null) === (b.timeOfDay || null) &&
    [...a.skip].sort().join() === [...b.skip].sort().join()
  );
}

function usingSavedPreset() {
  const saved = state.playbook ? getPreset(state.playbook.id) : null;
  return !!saved && sameRhythm(saved, state.strategy);
}

// Saving the rhythm for the chat's Playbook — a quiet action at the end of
// the skip-days row, not a section of its own: it is the rare gesture of the
// panel, so it takes no height. The Playbook is named in the tooltip; once
// saved, the sentence above names it too ("Acme · Q2 marketing's rhythm —").
// Saving is the owner's call, like editing the fiche.
function renderPresetAction() {
  const ctx = state.playbook;
  if (!ctx) return "";
  const name = ctx.name;
  const tip = escapeText(`${name} will start from this rhythm every time you schedule for it.`);
  if (!canEdit(ctx)) {
    return `<span class="schedule-modal__preset-note" data-tooltip="${escapeText(`Only the owner of ${name} can save its posting rhythm.`)}">Only the owner can save it</span>`;
  }
  if (usingSavedPreset()) {
    return `<span class="schedule-modal__preset-note is-saved" data-tooltip="${tip}"><i class="ap-icon-check" aria-hidden="true"></i>Saved for this Playbook</span>`;
  }
  const saved = getPreset(ctx.id);
  return `
    <button type="button" class="ap-button ghost blue schedule-modal__preset-save" data-schedule-save-preset data-tooltip="${tip}">
      <i class="ap-icon-bookmark" aria-hidden="true"></i><span>${saved ? "Update for this Playbook" : "Save for this Playbook"}</span>
    </button>`;
}

function renderRhythm() {
  const open = state.adjustOpen;
  return `
    <section class="schedule-modal__rhythm${open ? " is-open" : ""}" aria-label="How I picked the dates">
      <div class="schedule-modal__rhythm-head">
        <span class="schedule-modal__rhythm-mark" aria-hidden="true">
          ${
            isComputing()
              ? `<span class="ap-loader size-16"></span>`
              : `<i class="ap-icon-sparkles schedule-modal__rhythm-icon"></i>`
          }
        </span>
        <p class="schedule-modal__rhythm-summary">${rhythmSentence()}</p>
        <button
          type="button"
          class="ap-button ghost blue schedule-modal__adjust"
          data-schedule-adjust
          aria-expanded="${open ? "true" : "false"}"
          aria-controls="scheduleAdjust"
        >
          <span>${open ? "Done" : "Adjust"}</span>
          <i class="ap-icon-chevron-down schedule-modal__adjust-arrow" aria-hidden="true"></i>
        </button>
      </div>
      ${open ? renderSettings() : ""}
    </section>
  `;
}

function renderSelect({ label, value, options, attr }) {
  const items = options
    .map(
      (o) => `
      <div class="ap-select-option${o.selected ? " selected" : ""}" ${attr}="${o.id ?? ""}" role="option" aria-selected="${o.selected}">
        <span class="ap-select-option-text">${escapeText(o.label)}</span>
        ${o.selected ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
      </div>`,
    )
    .join("");
  return `
    <details class="ap-select" data-select-key="${attr}">
      <summary class="ap-select-trigger" aria-label="${escapeText(label)}">
        <span class="ap-select-value">${escapeText(value)}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-label="${escapeText(label)}">
        <div class="ap-select-options">${items}</div>
      </div>
    </details>
  `;
}

function renderSettings() {
  const s = state.strategy;
  const multi = state.posts.length > 1;
  const cadence = CADENCES.find((c) => c.id === s.cadence) || CADENCES[0];
  const tod = TIMES_OF_DAY.find((t) => t.id === s.timeOfDay) || TIMES_OF_DAY[0];
  const skipBoxes = WEEKDAYS.map(
    (w) => `
      <label class="ap-checkbox-container">
        <input type="checkbox" value="${w.dow}" data-schedule-skip ${s.skip.includes(w.dow) ? "checked" : ""} />
        <i></i>
        <span>${w.short}</span>
      </label>`,
  ).join("");
  return `
    <div
      class="schedule-modal__settings${multi ? " schedule-modal__settings--three" : ""}${state.adjustRevealing ? " is-revealing" : ""}"
      id="scheduleAdjust"
    >
      ${
        multi
          ? `<div class="ap-form-field">
        <label>Posting rhythm</label>
        ${renderSelect({
          label: "Posting rhythm",
          value: cadence.label,
          attr: "data-schedule-cadence",
          options: CADENCES.map((c) => ({ id: c.id, label: c.label, selected: c.id === cadence.id })),
        })}
      </div>`
          : ""
      }
      <div class="ap-form-field">
        <label for="scheduleStartFrom">Starting</label>
        <div class="ap-input-group">
          <i class="ap-icon-calendar" aria-hidden="true"></i>
          <input type="date" id="scheduleStartFrom" value="${toDateInput(s.startFrom)}" data-schedule-start />
        </div>
      </div>
      <div class="ap-form-field">
        <label>Time of day</label>
        ${renderSelect({
          label: "Time of day",
          value: tod.label,
          attr: "data-schedule-tod",
          options: TIMES_OF_DAY.map((t) => ({ id: t.id, label: t.label, selected: t.id === tod.id })),
        })}
      </div>
      <div class="schedule-modal__settings-foot">
        <div class="schedule-modal__skip" role="group" aria-labelledby="scheduleSkipLabel">
          <span class="schedule-modal__skip-label" id="scheduleSkipLabel">Skip</span>
          ${skipBoxes}
        </div>
        ${renderPresetAction()}
      </div>
    </div>
  `;
}

// Why I picked THIS time. There is one concept — the network's BEST TIME —
// whatever made it (its best days, the rhythm, a time-of-day bias): the
// badge on the tile says it for every date I picked, and this is its
// tooltip. "Best hour" / "Best window" / "Best morning hour" were three
// words for one idea and got merged.
// No days in the tooltip: the date is the rhythm's, the hour is the network's,
// and naming the network's best days on a date outside them contradicted it.
function reasonFor(slot) {
  const name = networkName(networkOf(slot.post));
  const tod = state.strategy.timeOfDay;
  return tod ? `${name}'s best time in the ${tod}` : `${name}'s best time`;
}

// What else is on the day a draft lands on — the queue plus the other
// drafts of this batch. It replaces the calendar: the one thing the calendar
// was for was "am I stacking on a busy day?", and the answer belongs on the
// row being decided. A CLASH is a post on the same network within two hours
// — the case that actually costs reach, so it's the one that turns orange.
const CLASH_MS = 2 * 60 * 60 * 1000;

function platformOf(network) {
  const n = (network || "").toLowerCase();
  return n === "twitter" ? "x" : n;
}

function dayAgenda(slot) {
  const key = dayKey(slot.when);
  const mine = platformOf(networkOf(slot.post));
  const items = [
    ...getQueueOn(slot.when).map((e) => ({
      when: e.when,
      network: platformOf(e.network),
      text: e.text,
      isBatch: false,
    })),
    ...state.slots
      .filter((s) => s !== slot && !s.pending && dayKey(s.when) === key)
      .map((s) => ({
        when: s.when,
        network: platformOf(networkOf(s.post)),
        text: extractFirstLine(s.post),
        isBatch: true,
      })),
  ]
    .map((e) => ({ ...e, clash: e.network === mine && Math.abs(e.when - slot.when) < CLASH_MS }))
    .sort((a, b) => a.when - b.when);
  return { items, clash: items.find((e) => e.clash) || null };
}

function formatGap(ms) {
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

// The row's note: a link that names what's there and unfolds the day. Short
// on purpose — it lives in the WHEN cell; which post, on which network, is
// one click away in the unfolded agenda.
function renderDayNote(slot, agenda) {
  if (!agenda.items.length) return "";
  const id = escapeText(slot.post.id);
  const open = state.peekId === slot.post.id;
  const n = agenda.items.length;
  const label = agenda.clash
    ? `Too close: ${formatGap(agenda.clash.when - slot.when)}`
    : `+${n} ${n === 1 ? "post" : "posts"} that day`;
  return `
    <span class="schedule-modal__when-note${agenda.clash ? " is-clash" : ""}">
      <i class="${agenda.clash ? "ap-icon-warning_fill" : "ap-icon-calendar"}" aria-hidden="true"></i>
      <button
        type="button"
        class="ap-link small"
        data-schedule-peek="${id}"
        aria-expanded="${open ? "true" : "false"}"
        aria-controls="schedulePeek-${id}"
        ${agenda.clash ? `data-tooltip="${escapeText(`${networkName(agenda.clash.network)} post at ${formatTime(agenda.clash.when)}`)}"` : ""}
      >${escapeText(label)}</button>
    </span>`;
}

// The day's agenda, unfolded under the row: every post on that day, in
// time order, with this draft's own slot marked so the gap reads at a glance.
function renderPeek(slot, agenda) {
  const id = escapeText(slot.post.id);
  const entries = [
    ...agenda.items,
    { when: slot.when, network: platformOf(networkOf(slot.post)), text: extractFirstLine(slot.post), isSelf: true },
  ].sort((a, b) => a.when - b.when);
  const rows = entries
    .map(
      (e) => `
      <li class="schedule-modal__peek-item${e.isSelf ? " is-self" : ""}${e.clash ? " is-clash" : ""}">
        <span class="schedule-modal__peek-time">${formatTime(e.when)}</span>
        <i class="${NETWORK_ICON_BY_PLATFORM[e.network] || "ap-icon-megaphone"}" aria-hidden="true"></i>
        <span class="schedule-modal__peek-text">${escapeText(e.text || "")}</span>
        ${
          e.isSelf
            ? `<span class="ap-status blue no-dot">This draft</span>`
            : e.clash
              ? `<span class="ap-status orange no-dot">${formatGap(e.when - slot.when)} apart</span>`
              : e.isBatch
                ? `<span class="ap-status grey no-dot">This batch</span>`
                : ""
        }
      </li>`,
    )
    .join("");
  return `
    <div class="schedule-modal__peek" id="schedulePeek-${id}">
      <span class="schedule-modal__peek-head">${escapeText(formatDay(slot.when))}</span>
      <ul class="schedule-modal__peek-list">${rows}</ul>
    </div>`;
}

// The date tile — weekday, the day in large, the month. Static data, so
// grey ink on white: never blue, which is the interactive colour here.
function renderTile(slot) {
  if (slot.pending) {
    return `
      <div class="schedule-modal__tile is-pending" aria-hidden="true">
        <span class="schedule-modal__shimmer schedule-modal__shimmer--sm"></span>
        <span class="schedule-modal__shimmer schedule-modal__shimmer--lg"></span>
        <span class="schedule-modal__shimmer schedule-modal__shimmer--sm"></span>
      </div>`;
  }
  const d = new Date(slot.when);
  // Every date I picked wears my sparkle on its corner — "the network's best
  // time", one treatment for all. A date set by hand has none; its row says
  // "Set by you" instead.
  const reason = slot.pinned ? null : reasonFor(slot);
  const badge = reason
    ? `<span class="schedule-modal__tile-badge" role="img" aria-label="${escapeText(reason)}" data-tooltip="${escapeText(reason)}">
        <i class="ap-icon-sparkles ap-icon-xs" aria-hidden="true"></i>
      </span>`
    : "";
  return `
    <span class="schedule-modal__tile-wrap">
      <div class="schedule-modal__tile" aria-hidden="true">
        <span class="schedule-modal__tile-dow">${d.toLocaleDateString("en-US", { weekday: "short" })}</span>
        <span class="schedule-modal__tile-day">${d.getDate()}</span>
        <span class="schedule-modal__tile-month">${d.toLocaleDateString("en-US", { month: "short" })}</span>
      </div>
      ${badge}
    </span>`;
}

// WHEN — the tile on the rail, the time and its pen, then at most two short
// lines: why this time (or "Set by you"), and whether the day is busy.
function renderWhen(slot) {
  const id = escapeText(slot.post.id);
  if (slot.pending) {
    return `
      <div class="schedule-modal__when">
        ${renderTile(slot)}
        <div class="schedule-modal__when-body">
          <span class="schedule-modal__when-pending" role="status">Finding a time…</span>
        </div>
      </div>`;
  }
  const agenda = dayAgenda(slot);
  return `
    <div class="schedule-modal__when">
      ${renderTile(slot)}
      <div class="schedule-modal__when-body">
        <span class="schedule-modal__when-head">
          <span class="schedule-modal__when-time">${formatTime(slot.when)}</span>
          <button
            type="button"
            class="ap-icon-button schedule-modal__when-edit"
            data-schedule-when="${id}"
            aria-label="Change the publish time — ${escapeText(formatDay(slot.when))}, ${formatTime(slot.when)}"
            data-tooltip="Change date or time"
          >
            <i class="ap-icon-pen"></i>
          </button>
          <input
            type="datetime-local"
            class="schedule-modal__when-input"
            value="${toLocalInput(slot.when)}"
            data-schedule-slot="${id}"
            tabindex="-1"
            aria-hidden="true"
          />
        </span>
        ${
          slot.pinned
            ? `<span class="schedule-modal__when-note">Set by you ·
                <button type="button" class="ap-link small" data-schedule-reset="${id}" aria-label="Use my suggestion again">Reset</button></span>`
            : ""
        }
        ${renderDayNote(slot, agenda)}
      </div>
    </div>`;
}

// The draft's media, when it has one — what the post will LOOK like in the
// feed is half of recognising it. Image → the image; carousel → its first
// slide + the slide count; video clip → its hue frame + a play glyph and the
// duration (clips carry no poster image, the same frame post-card draws).
function renderThumb(post) {
  if (post.clipRef) {
    const clip = post.clipRef;
    const h = typeof clip.hue === "number" ? clip.hue : 24;
    const secs = Math.max(1, Math.round(clip.end - clip.start));
    const bg = `linear-gradient(135deg, oklch(0.42 0.12 ${h}) 0%, oklch(0.18 0.06 ${h}) 100%)`;
    return `
      <span class="schedule-modal__thumb is-video" style="background: ${bg}" aria-label="Video clip, ${secs} seconds" role="img">
        <i class="ap-icon-play_fill" aria-hidden="true"></i>
        <span class="schedule-modal__thumb-badge">0:${String(secs).padStart(2, "0")}</span>
      </span>`;
  }
  // A text-only post still fills the column — a neutral tile saying "text"
  // — the quote glyph — so every row's text starts at the same x and
  // nothing floats.
  if (!post.imageUrl) {
    return `
      <span class="schedule-modal__thumb is-text" role="img" aria-label="Text-only post">
        <i class="ap-icon-quote" aria-hidden="true"></i>
      </span>`;
  }
  const count = Array.isArray(post.carousel) ? post.carousel.length : 0;
  return `
    <span class="schedule-modal__thumb">
      <img src="${escapeText(post.imageUrl)}" alt="${count > 1 ? `Carousel, ${count} images` : "Image for this post"}" loading="lazy" />
      ${count > 1 ? `<span class="schedule-modal__thumb-badge">1/${count}</span>` : ""}
    </span>`;
}

// WHAT — the draft itself: who publishes it, what it says, what it shows,
// and its one action (leave it out).
function renderDraft(slot) {
  const post = slot.post;
  const network = networkOf(post);
  return `
    <div class="schedule-modal__draft">
      ${renderThumb(post)}
      <div class="schedule-modal__draft-body">
        ${renderProfileTag(profileForNetwork(network), { network })}
        <p class="schedule-modal__draft-text">${escapeText(extractFirstLine(post))}</p>
      </div>
    </div>`;
}

function renderRow(slot, i) {
  const classes = [
    "schedule-modal__row",
    slot.pending ? "is-pending" : "",
    slot.justLanded ? "is-landing" : "",
    state.entering ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <li class="${classes}" style="--i: ${i}">
      ${renderDraft(slot)}
      ${renderWhen(slot)}
      <div class="schedule-modal__row-actions">
        ${
          state.posts.length > 1
            ? `<button
          type="button"
          class="ap-icon-button schedule-modal__draft-remove"
          data-schedule-remove="${escapeText(slot.post.id)}"
          aria-label="Leave this draft out"
          data-tooltip="Leave this draft out"
        >
          <i class="ap-icon-close"></i>
        </button>`
            : ""
        }
      </div>
      ${!slot.pending && state.peekId === slot.post.id ? renderPeek(slot, dayAgenda(slot)) : ""}
    </li>`;
}

// The batch as a posting timeline: one framed list, rows in date order. A
// hand-edited date moves its row to its new place.
function renderTimeline() {
  const rows = [...state.slots]
    .sort((a, b) => a.when - b.when)
    .map(renderRow)
    .join("");
  return `<ol class="schedule-modal__timeline" aria-label="Drafts and their publish times">${rows}</ol>`;
}

// Footer left: what the batch adds up to, once the dates exist.
function renderFootSummary() {
  const disclosure = `<span class="schedule-modal__foot-disclosure">Posts will publish to your connected accounts.</span>`;
  if (isComputing() || state.slots.length === 0) return disclosure;
  const times = state.slots.map((s) => s.when).sort((a, b) => a - b);
  const first = times[0];
  const last = times[times.length - 1];
  let span;
  if (times.length === 1) {
    span = `<strong>${escapeText(formatDay(first))}</strong> at ${formatTime(first)}`;
  } else {
    const days = Math.round((startOfDay(last) - startOfDay(first)) / 86400000) + 1;
    span = `<strong>${times.length} posts over ${days} ${days === 1 ? "day" : "days"}</strong> · ${escapeText(formatShortDate(first))} – ${escapeText(formatShortDate(last))}`;
  }
  return `<span class="schedule-modal__foot-span">${span}</span>${disclosure}`;
}

function toDateInput(ts) {
  const d = new Date(ts || defaultStartFrom());
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalInput(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
