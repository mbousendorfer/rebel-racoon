// feedback-control — the shared "how's this?" control rendered on every
// Archie-generated element that takes feedback (drafts, images, clips).
//
// One control = two thumb buttons + a collapsible "what was off?" panel
// (reason chips + optional comment) revealed on a thumbs-down. All state
// lives in feedback-store.js, keyed by a `targetId` the caller mints
// (draft:<id> / image:<id>:<seed> / clip:<id>).
//
// Two render shapes share one click handler:
//   - renderFeedbackThumbs() + renderFeedbackPanel()  → split, for the
//                                clip card where the thumbs sit in the
//                                existing footer row and the panel expands
//                                below it.
//   - renderMessageActions()   → the quiet bar under a draft, after affectUI's
//                                Message Actions: Copy · thumbs · Read aloud,
//                                icons only, the reasons row unfolding below.
//
// onFeedbackClick(event) is the single delegated handler. Each host surface
// calls it first from its own delegation root and bails if it returns true.
// It mutates the store and updates the DOM in place (no full re-render) so
// list scroll position survives — same rationale as the clip/idea thumbs it
// replaces.

import { escapeAttr, escapeText } from "../utils.js?v=2160";
import { showToast } from "./toast.js?v=2160";
import { getFeedback, setVerdict, recordDetail } from "../feedback-store.js?v=2160";

// "What was off?" reasons per element kind. value = stable key, label = UI.
const REASONS = {
  draft: [
    { value: "off-topic", label: "Off-topic" },
    { value: "wrong-tone", label: "Wrong tone" },
    { value: "inaccurate", label: "Inaccurate" },
    { value: "too-generic", label: "Too generic" },
    { value: "formatting", label: "Formatting" },
  ],
  image: [
    { value: "off-brand", label: "Off-brand" },
    { value: "wrong-style", label: "Wrong style" },
    { value: "low-quality", label: "Low quality" },
    { value: "mismatch", label: "Doesn't match the draft" },
  ],
  clip: [
    { value: "wrong-moment", label: "Wrong moment" },
    { value: "bad-framing", label: "Bad framing" },
    { value: "low-quality", label: "Low quality" },
    { value: "off-topic", label: "Off-topic" },
  ],
};

const NOUN = { draft: "draft", image: "image", clip: "clip" };

// ── Render ──────────────────────────────────────────────────────────────

// The two thumb buttons. Reuses the DS .ap-icon-button chrome + the existing
// .rpanel-ideas__thumb active-colour flip; the active side also swaps to the
// filled icon so the state reads without relying on colour alone.
export function renderFeedbackThumbs(targetId, { kind } = {}) {
  const noun = NOUN[kind] || "result";
  const verdict = getFeedback(targetId)?.verdict || null;
  const tid = escapeAttr(targetId);
  const thumb = (side) => {
    const active = verdict === side;
    const base = side === "up" ? "ap-icon-thumb-up" : "ap-icon-thumb-down";
    const icon = active ? `${base}_fill` : base;
    const label = side === "up" ? `Mark this ${noun} as good` : `Mark this ${noun} as needing work`;
    return `
      <button
        type="button"
        class="ap-icon-button transparent sm rpanel-ideas__thumb fb__thumb${active ? " is-active" : ""}"
        data-fb-verdict="${side}"
        data-fb-for="${tid}"
        data-fb-kind="${escapeAttr(kind || "")}"
        aria-pressed="${active}"
        ${side === "down" ? `aria-expanded="false"` : ""}
        aria-label="${label}"
        title="${label}"
      >
        <i class="${icon}"></i>
      </button>`;
  };
  return `<div class="fb__thumbs">${thumb("up")}${thumb("down")}</div>`;
}

// The collapsible "what was off?" panel. Hidden unless the host opens it on a
// thumbs-down. Pre-checks any reasons / comment already on record so the
// panel restores its answered state if it's re-opened.
// `bar` (message actions): the row opens only on a thumbs-down click — never
// restored on render, it folds away after "Thanks" — and the comment hides
// behind an "Other" reason.
export function renderFeedbackPanel(targetId, { kind, bar = false } = {}) {
  const reasons = REASONS[kind] || REASONS.draft;
  const rec = getFeedback(targetId);
  const open = !bar && rec?.verdict === "down" && (rec.reasons?.length || rec.comment);
  const picked = new Set(rec?.reasons || []);
  const tid = escapeAttr(targetId);
  const chips = reasons
    .map(
      (r) => `
      <button
        type="button"
        class="ap-filter-chip"
        data-fb-reason="${escapeAttr(r.value)}"
        aria-pressed="${picked.has(r.value)}"
      >${escapeText(r.label)}</button>`,
    )
    .join("");
  const other = bar
    ? `<button type="button" class="ap-filter-chip" data-fb-other aria-pressed="${!!rec?.comment}">Other</button>`
    : "";
  return `
    <div class="fb__panel" data-fb-panel="${tid}" ${open ? "" : "hidden"}>
      <p class="fb__panel-label">${bar ? "What went wrong?" : "What was off?"}</p>
      <div class="fb__reasons">${chips}${other}</div>
      <textarea
        class="fb__comment"
        data-fb-comment
        rows="2"
        placeholder="${bar ? "Tell me more" : "Anything else? (optional)"}"
        ${bar && !rec?.comment ? "hidden" : ""}
      >${escapeText(rec?.comment || "")}</textarea>
      <div class="fb__panel-actions">
        <button type="button" class="ap-button primary blue fb__send" data-fb-send="${tid}">${bar ? "Send" : "Send feedback"}</button>
      </div>
      ${bar ? `<p class="fb__thanks">Thanks — this helps me improve.</p>` : ""}
    </div>`;
}

// Message-actions bar — the quiet row under a draft. `text` is what Copy
// writes and Read aloud speaks. Each action swaps to its "done" look in place
// (copy → check, play → equalizer), so both glyphs are rendered and CSS
// crossfades them.
export function renderMessageActions(targetId, { kind, text = "" } = {}) {
  const noun = NOUN[kind] || "result";
  const tid = escapeAttr(targetId);
  return `
    <div class="fb fb--bar" data-fb-target="${tid}" data-fb-text="${escapeAttr(text)}">
      <div class="fb__bar" role="toolbar" aria-label="Actions on this ${noun}">
        <button type="button" class="ap-icon-button transparent sm fb__thumb fb__copy" data-fb-copy aria-label="Copy" title="Copy">
          <i class="ap-icon-copy fb__idle"></i><i class="ap-icon-check fb__done" aria-hidden="true"></i>
        </button>
        ${renderFeedbackThumbs(targetId, { kind })}
        <button type="button" class="ap-icon-button transparent sm fb__thumb fb__speak" data-fb-speak aria-pressed="false" aria-label="Read aloud" title="Read aloud">
          <i class="ap-icon-play fb__idle"></i>
          <span class="fb__done fb__eq" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
        </button>
      </div>
      ${renderFeedbackPanel(targetId, { kind, bar: true })}
      <span class="fb__live" aria-live="polite"></span>
    </div>`;
}

// ── Delegated click handler ───────────────────────────────────────────────

// Returns true if it consumed the event. Hosts call:
//   if (onFeedbackClick(event)) return;
export function onFeedbackClick(event) {
  const thumb = event.target.closest("[data-fb-verdict]");
  if (thumb) {
    const targetId = thumb.dataset.fbFor;
    const kind = thumb.dataset.fbKind || "";
    const noun = NOUN[kind] || "result";
    const rec = setVerdict(targetId, thumb.dataset.fbVerdict, { kind });
    syncThumbs(targetId);
    const panel = findPanel(targetId);
    const bar = thumb.closest(".fb--bar");
    if (rec?.verdict) {
      thumb.classList.add("is-popping");
      setTimeout(() => thumb.classList.remove("is-popping"), 320);
    }
    if (rec?.verdict === "down") {
      if (panel) openPanel(panel, true);
      panel?.querySelector("[data-fb-reason]")?.focus();
    } else {
      if (panel) openPanel(panel, false);
      if (rec?.verdict === "up") bar ? announce(bar, "Thanks") : showToast("Thanks — noted.", { duration: 2600 });
    }
    return true;
  }

  const copy = event.target.closest("[data-fb-copy]");
  if (copy) {
    navigator.clipboard?.writeText(copy.closest("[data-fb-text]")?.dataset.fbText || "").catch(() => {});
    copy.classList.add("is-on");
    copy.setAttribute("aria-label", "Copied");
    announce(copy, "Copied");
    clearTimeout(copy._fbTimer);
    copy._fbTimer = setTimeout(() => {
      copy.classList.remove("is-on");
      copy.setAttribute("aria-label", "Copy");
    }, 1600);
    return true;
  }

  const speak = event.target.closest("[data-fb-speak]");
  if (speak) {
    const play = speak.getAttribute("aria-pressed") !== "true";
    // One voice at a time: starting a draft stops whichever one was reading.
    window.speechSynthesis?.cancel();
    for (const b of document.querySelectorAll("[data-fb-speak]")) setSpeaking(b, false);
    if (play && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(speak.closest("[data-fb-text]")?.dataset.fbText || "");
      u.onend = u.onerror = () => setSpeaking(speak, false);
      speechSynthesis.speak(u);
      setSpeaking(speak, true);
      announce(speak, "Reading aloud");
    }
    return true;
  }

  const other = event.target.closest("[data-fb-other]");
  if (other) {
    const on = other.getAttribute("aria-pressed") !== "true";
    other.setAttribute("aria-pressed", String(on));
    const box = other.closest("[data-fb-panel]")?.querySelector("[data-fb-comment]");
    if (box) {
      box.hidden = !on;
      if (on) box.focus();
    }
    return true;
  }

  const reason = event.target.closest("[data-fb-reason]");
  if (reason && reason.closest("[data-fb-panel]")) {
    const pressed = reason.getAttribute("aria-pressed") === "true";
    reason.setAttribute("aria-pressed", String(!pressed));
    return true;
  }

  const send = event.target.closest("[data-fb-send]");
  if (send) {
    const targetId = send.dataset.fbSend;
    const panel = findPanel(targetId);
    if (panel) {
      const reasons = [...panel.querySelectorAll('[data-fb-reason][aria-pressed="true"]')].map(
        (b) => b.dataset.fbReason,
      );
      const box = panel.querySelector("[data-fb-comment]");
      const comment = box && !box.hidden ? box.value : "";
      recordDetail(targetId, { reasons, comment });
      // The bar says thanks in place, then folds the row away.
      if (panel.closest(".fb--bar")) {
        panel.classList.add("is-sent");
        announce(panel, "Thanks — this helps me improve.");
        setTimeout(() => {
          openPanel(panel, false);
          panel.classList.remove("is-sent");
        }, 1600);
        return true;
      }
      panel.hidden = true;
    }
    showToast("Thanks — this helps me improve.", { duration: 2600 });
    return true;
  }

  return false;
}

// ── In-place DOM helpers ────────────────────────────────────────────────

// Re-sync every thumb button bound to this target (both the up and down
// button, wherever they live) to the store's current verdict.
function syncThumbs(targetId) {
  const verdict = getFeedback(targetId)?.verdict || null;
  for (const btn of document.querySelectorAll("[data-fb-verdict]")) {
    if (btn.dataset.fbFor !== targetId) continue;
    const side = btn.dataset.fbVerdict;
    const active = verdict === side;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
    const i = btn.querySelector("i");
    if (i) {
      const base = side === "up" ? "ap-icon-thumb-up" : "ap-icon-thumb-down";
      i.className = active ? `${base}_fill` : base;
    }
  }
}

// Shows / hides a reason panel and keeps its thumbs-down's aria-expanded true.
function openPanel(panel, open) {
  panel.hidden = !open;
  for (const btn of document.querySelectorAll('[data-fb-verdict="down"]')) {
    if (btn.dataset.fbFor === panel.dataset.fbPanel) btn.setAttribute("aria-expanded", String(open));
  }
}

function setSpeaking(btn, on) {
  btn.classList.toggle("is-on", on);
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", on ? "Stop reading" : "Read aloud");
  btn.title = on ? "Stop reading" : "Read aloud";
}

function announce(el, message) {
  const live = el.closest(".fb")?.querySelector(".fb__live");
  if (live) live.textContent = message;
}

// Keyboard on the bar's reason row: Esc folds it back onto thumbs-down,
// Enter in the comment sends. One document listener — the row lives in
// several hosts (panel, thread) and keydown has no host handler to ride.
document.addEventListener("keydown", (event) => {
  const panel = event.target.closest?.(".fb--bar [data-fb-panel]");
  if (!panel) return;
  if (event.key === "Escape") {
    openPanel(panel, false);
    panel.closest(".fb")?.querySelector('[data-fb-verdict="down"]')?.focus();
  } else if (event.key === "Enter" && !event.shiftKey && event.target.matches("[data-fb-comment]")) {
    event.preventDefault();
    panel.querySelector("[data-fb-send]")?.click();
  }
});

// targetIds contain ":" so we match by dataset value rather than build a
// CSS selector that would need escaping.
function findPanel(targetId) {
  for (const el of document.querySelectorAll("[data-fb-panel]")) {
    if (el.dataset.fbPanel === targetId) return el;
  }
  return null;
}
