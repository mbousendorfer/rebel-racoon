import { html, raw, escapeText } from "../utils.js?v=1230";
import { showToast } from "./toast.js?v=1230";
import {
  getQueueOn,
  busyCountsByDay,
  dayKey,
  addToQueue,
  subscribe as subscribeQueue,
} from "../schedule-store.js?v=1230";
import { requestOpen, notifyClose, bindOverlayDismissal } from "../modal-coordinator.js?v=1230";
import { renderProfileTag, profileForNetwork, NETWORK_LABEL } from "../social-profiles.js?v=1230";

// Schedule modal — one column, result first.
//   • Header   — "Schedule N drafts" + one line saying I already picked.
//   • Rhythm   — ONE sentence summing up how the dates were picked
//                ("Every weekday · from Sat 26 Sep · best time per network")
//                and an "Adjust" disclosure, closed at rest, holding the
//                four settings: rhythm (multi only), start day, time of day,
//                days to skip. Every change re-spreads live.
//   • Drafts   — one row per draft: profile, first line, its date/time
//                (editable) and what else is already on that day.
//   • Footer   — the disclosure line, then Cancel + the one primary.
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

export function open({ posts, onConfirm }) {
  if (!posts || posts.length === 0) return;
  // Register with the coordinator first so any other overlay currently
  // up gets closed before we paint; it also snapshots the trigger for focus.
  requestOpen(ROOT_ID, close);
  state = {
    ...emptyState(),
    open: true,
    posts: [...posts],
    strategy: { cadence: "weekdays", timeOfDay: null, skip: [], startFrom: defaultStartFrom() },
    onConfirm: typeof onConfirm === "function" ? onConfirm : null,
  };
  // Dates are proposed on open — the user waits for them, never asks for them.
  compute();
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
// Walking from `startFrom`, collect the next `count` days that match the
// rhythm, skipping the weekdays the user ticked, any day already carrying
// a scheduled post and any day a pinned draft already holds — so the new
// dates slot in around what's on the calendar. Bounded look-ahead so a
// pathological pattern can't loop forever.
function strategyDays(count, strategy, takenKeys) {
  const start = startOfDay(strategy.startFrom || defaultStartFrom());
  const single = state.posts.length === 1;
  // One draft has no rhythm: any day qualifies, the network's best day wins below.
  const cadence = single ? null : CADENCES.find((c) => c.id === strategy.cadence) || CADENCES[0];
  const skip = new Set(strategy.skip);
  const busy = busyCountsByDay();
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
    const taken = (busy.get(key) || 0) > 0 || takenKeys.has(key);
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
            ? "I picked the best time for this post, around what's already scheduled. Change it below if you need to."
            : "I picked a time for each draft, around what's already scheduled. Change any of them below."}
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
      ${raw(renderRhythm())} ${raw(renderSlots())}
    </div>

    <div class="ap-dialog-footer">
      <div class="ap-dialog-footer-left">
        <span class="schedule-modal__foot-disclosure">Posts will publish to your connected accounts.</span>
      </div>
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

function formatDay(ts) {
  // en-US like the rest of the copy — a French date inside an English sentence reads as a bug.
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

// The one sentence that says HOW I picked — rhythm · start · time of day
// (· skipped days). It is the closed state of the settings, so the user
// reads the reasoning before being offered a way to change it.
function rhythmSummary() {
  const s = state.strategy;
  const parts = [];
  const tod = (TIMES_OF_DAY.find((t) => t.id === s.timeOfDay) || TIMES_OF_DAY[0]).short;
  if (state.posts.length > 1) {
    parts.push((CADENCES.find((c) => c.id === s.cadence) || CADENCES[0]).label);
    parts.push(`from ${formatDay(s.startFrom)}`);
    parts.push(tod);
  } else {
    // One draft has no rhythm — lead with what decided its date.
    const network = networkOf(state.posts[0]);
    const name = NETWORK_LABEL[network === "twitter" ? "x" : network] || network;
    parts.push(s.timeOfDay ? tod.charAt(0).toUpperCase() + tod.slice(1) : `Best time for ${name}`);
    parts.push(`from ${formatDay(s.startFrom)}`);
  }
  if (s.skip.length) {
    const names = WEEKDAYS.filter((w) => s.skip.includes(w.dow)).map((w) => w.short);
    parts.push(`no ${names.join(", ")}`);
  }
  return parts.join(" · ");
}

function renderRhythm() {
  const open = state.adjustOpen;
  return `
    <section class="schedule-modal__rhythm" aria-label="How I picked the dates">
      <div class="schedule-modal__rhythm-head">
        ${
          isComputing()
            ? `<span class="ap-loader size-16 schedule-modal__rhythm-icon" aria-hidden="true"></span>`
            : `<i class="ap-icon-clock schedule-modal__rhythm-icon" aria-hidden="true"></i>`
        }
        <span class="schedule-modal__rhythm-summary">${escapeText(rhythmSummary())}</span>
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
    <div class="schedule-modal__settings${multi ? " schedule-modal__settings--three" : ""}" id="scheduleAdjust">
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
      <div class="ap-form-field schedule-modal__skip">
        <label id="scheduleSkipLabel">Skip these days</label>
        <div class="schedule-modal__skip-days" role="group" aria-labelledby="scheduleSkipLabel">${skipBoxes}</div>
      </div>
    </div>
  `;
}

// What else is on the day a draft lands on — the queue plus the other
// drafts of this batch. It replaces the calendar: the one thing the calendar
// was for was "am I stacking on a busy day?", and the answer belongs on the
// row being decided, not in a second column.
function sameDayNote(slot) {
  const key = dayKey(slot.when);
  const others = [
    ...getQueueOn(slot.when),
    ...state.slots
      .filter((s) => s !== slot && !s.pending && dayKey(s.when) === key)
      .map((s) => ({ when: s.when, network: networkOf(s.post) })),
  ].sort((a, b) => a.when - b.when);
  if (others.length === 0) return "";
  const shown = others
    .slice(0, 2)
    .map((e) => `${formatTime(e.when)} ${NETWORK_LABEL[e.network === "twitter" ? "x" : e.network] || e.network}`)
    .join(", ");
  const more = others.length > 2 ? ` and ${others.length - 2} more` : "";
  return `Also that day: ${shown}${more}`;
}

function renderSlots() {
  const rows = state.slots
    .map((slot) => {
      const post = slot.post;
      const network = networkOf(post);
      const note = slot.pending ? "" : sameDayNote(slot);
      return `
        <li class="schedule-modal__slot">
          <div class="schedule-modal__slot-post">
            ${renderProfileTag(profileForNetwork(network), { network })}
            <span class="schedule-modal__slot-text">${escapeText(extractFirstLine(post))}</span>
          </div>
          <div class="schedule-modal__slot-when">
            ${
              slot.pending
                ? `<div class="schedule-modal__slot-pending" role="status">
              <span class="ap-loader size-16" aria-hidden="true"></span><span>Finding a time…</span>
            </div>`
                : `<div class="ap-input-group">
              <input
                type="datetime-local"
                value="${toLocalInput(slot.when)}"
                data-schedule-slot="${escapeText(post.id)}"
                aria-label="Publish time"
              />
            </div>`
            }
            ${
              state.posts.length > 1
                ? `<button
              type="button"
              class="ap-icon-button stroked transparent"
              data-schedule-remove="${escapeText(post.id)}"
              aria-label="Leave this draft out"
              title="Leave this draft out"
            >
              <i class="ap-icon-close"></i>
            </button>`
                : ""
            }
          </div>
          ${
            slot.pinned || note
              ? `<div class="schedule-modal__slot-meta">
            ${
              slot.pinned
                ? `<span>Set by you</span>
              <button type="button" class="ap-link small" data-schedule-reset="${escapeText(post.id)}">Use my suggestion</button>`
                : ""
            }
            ${note ? `<span>${escapeText(note)}</span>` : ""}
          </div>`
              : ""
          }
        </li>
      `;
    })
    .join("");
  return `<ul class="schedule-modal__slots" aria-label="Drafts and their publish times">${rows}</ul>`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
