// /welcome-alt/recap under flag connectFirst — the review, the run's last screen.
//
// The WHOLE Playbook, every block — dealt as a stack of cards, one block at a
// time, instead of a wall. Each part (Brief, Voice profile, Branding,
// Competitors, Influencers) opens straight in edit — the real Playbook view,
// playbook-view, its hero, tabs, tab head and panel Cancel / Save hidden — and
// only its front block shows, the ones still to come stacked behind it.
// Everything is already filled in by me, so it's browsing, not validating:
//   - edits apply as you type (the draft is the live source);
//   - a floating bar under the stack — and the keyboard's arrows, outside a
//     field — goes to the next / previous card, across parts; it holds the one
//     progress indicator (a segment per card of the part) and names what's next;
//     the card itself only says which part it's in (the part's icon);
//   - a part gets its check in the list once each of its cards has been seen.
// Start writing lives on the left, the whole time — never on a card.
//
// The view repaints its whole DOM on most edits (a chip added…), so the stack
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.

import { html, raw } from "../utils.js?v=1960";
import { navigate } from "../router.js?v=1960";
import { getDraft, patchDraft } from "../context-builder.js?v=1960";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=1960";
import { parseHashParams } from "../url-state.js?v=1960";
import { mountShell } from "./welcome-alt-shell.js?v=1960";
import { enterArchie } from "./welcome-alt-recap.js?v=1960";

const MOVE_MS = 220; // the card's exit, before the next one comes in

export function renderReview(target, sid, config) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  const current = () => parseHashParams().get("tab") || RECAP_SECTIONS[0].id;
  const partOf = (id) => RECAP_SECTIONS.find((t) => t.id === id) || RECAP_SECTIONS[0];

  let index = 0; // the front card, within the current part
  let count = 0; // how many cards the current part deals

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">
        I've filled in every card. Browse them with the arrows and fix anything that's off — changes save as you type.
      </p>
      <ul class="welcome-flow__options is-compact">
        ${RECAP_SECTIONS.map((t) => {
          const here = t.id === current();
          const mark = done.has(t.id)
            ? `<span class="welcome-review__check" title="Done"><i class="ap-icon-check" aria-hidden="true"></i></span>`
            : here && count
              ? `<span class="welcome-review__count">${index + 1} of ${count}</span>`
              : "";
          return html`
            <li>
              <button
                type="button"
                class="welcome-flow__option"
                data-review-part="${t.id}"
                aria-current="${here ? "true" : "false"}"
              >
                <span class="welcome-flow__glyph is-icon"><i class="${t.icon}" aria-hidden="true"></i></span>
                <span class="welcome-flow__option-text">
                  <span class="welcome-flow__option-title">${t.title}</span>
                  <span class="welcome-flow__option-desc">${t.lead}</span>
                </span>
                ${raw(mark)}
              </button>
            </li>
          `;
        })}
      </ul>
      <div class="welcome-flow__actions">
        <button type="button" class="ap-button stroked grey" data-flow-back>Back</button>
        <button type="button" class="ap-button primary orange" data-review-start>
          <span>Start writing</span><i class="ap-icon-arrow-right"></i>
        </button>
      </div>
    `;
  };

  const shell = mountShell(target, { step: "recap", sid, left, sheet: true });
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  const navEl = document.createElement("nav");
  navEl.className = "welcome-review__nav";
  navEl.setAttribute("aria-label", "Cards");
  shell.sheet.append(navEl);
  const unmount = mount(body, { ...config, showTop: false, headerActions: () => null });

  // The part's cards: its blocks in edit, else the edited panel (a roster), else
  // whatever the part shows when it has nothing to edit.
  const cards = () => {
    const blocks = [...body.querySelectorAll(".pb2-grid[data-recap-editing-card] > .pb2-block")];
    if (blocks.length) return blocks;
    const panel = body.querySelector("[data-recap-editing-card]") || body.querySelector(".pb2__panel");
    return panel ? [panel] : [];
  };

  // Which part this card belongs to: the part's icon and name, the same tile as
  // in the list — the part, not the block, is what tells you where you are.
  // A card's own name: its block title, else (a roster panel) its part's.
  const cardTitle = (el) =>
    el?.querySelector(".pb2-block__title, .recap__panel-title")?.textContent.trim() || partOf(current()).title;

  // The card's head: its part — icon + name, the list's tile.
  const kicker = () => {
    const part = partOf(current());
    return html`
      <div class="welcome-review__kicker">
        <span class="welcome-flow__glyph is-icon"><i class="${part.icon}" aria-hidden="true"></i></span>
        <span class="welcome-review__kicker-name">${part.title}</span>
      </div>
    `;
  };

  // The navigation floats under the stack, out of the card, in three separate
  // pieces: ← on its own, the part's progress (page dots — the one indicator),
  // and Next — named after what's coming — on the right.
  const nav = (list) => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const nextPart = RECAP_SECTIONS[at + 1];
    const upNext = index < count - 1 ? cardTitle(list[index + 1]) : nextPart ? nextPart.title : "";
    const atStart = index === 0 && at === 0;
    return html`
      <span class="welcome-review__navchip">
        <button
          type="button"
          class="ap-icon-button transparent grey"
          data-review-prev
          aria-label="Previous card"
          ${atStart ? raw("disabled") : ""}
        >
          <i class="ap-icon-arrow-left"></i>
        </button>
      </span>
      <ol class="welcome-review__dots" aria-label="Card ${index + 1} of ${count} in ${partOf(current()).title}">
        ${Array.from(
          { length: count },
          (_, i) => html`<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}"></li>`,
        )}
      </ol>
      <button type="button" class="ap-button primary blue" data-review-next ${upNext ? "" : raw("disabled")}>
        <span>${upNext || "Last card"}</span><i class="ap-icon-arrow-right"></i>
      </button>
    `;
  };

  // Deal the stack: the front card shows (with its part on top), up to two backs peek
  // under it, the rest is out of the way. `enter`: how the front one arrives —
  // "next" rises from the back of the stack, "prev" slides back in from the side.
  let applying = false;
  const applyStack = ({ enter = "" } = {}) => {
    applying = true;
    const list = cards();
    count = list.length;
    index = Math.min(index, Math.max(0, count - 1));
    list.forEach((el, i) => {
      el.classList.add("welcome-review__card");
      el.classList.toggle("is-front", i === index);
      el.classList.remove("is-enter-next", "is-enter-prev", "is-leave-next", "is-leave-prev");
      if (enter && i === index) el.classList.add(`is-enter-${enter}`);
      el.dataset.behind = i === index ? String(Math.min(2, count - 1 - index)) : "";
      el.querySelectorAll(":scope > .welcome-review__kicker").forEach((n) => n.remove());
    });
    list[index]?.insertAdjacentHTML("afterbegin", kicker());
    navEl.innerHTML = count ? nav(list) : "";
    applying = false;
    markSeen();
    shell.paint();
  };
  const observer = new MutationObserver(() => {
    if (!applying) applyStack();
  });
  observer.observe(body, { childList: true });

  // Open a part: its tab, in edit, from its first card (or its last, going back).
  const openPart = (id, { fromEnd = false, enter = "next" } = {}) => {
    if (body.querySelector(".pb2.is-editing")) body.querySelector("[data-recap-save]")?.click();
    body.querySelector(`[data-pb2-tab="${id}"]`)?.click();
    body.querySelector("[data-recap-edit-card]")?.click();
    index = fromEnd ? Number.MAX_SAFE_INTEGER : 0;
    applyStack({ enter });
    body.querySelector(".welcome-screen")?.scrollTo?.({ top: 0 });
  };

  const finishPart = () => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const next = RECAP_SECTIONS[at + 1];
    if (next) openPart(next.id);
  };

  // Next: the card swipes off and the next one rises from the stack. Previous:
  // the card sinks into the stack, the one before slides back in from the side.
  // Crossing the end of a part moves into the next (or previous) one.
  let moving = false;
  const move = (step) => {
    if (moving) return;
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    if (step < 0 && index === 0 && at === 0) return;
    if (step > 0 && index >= count - 1 && at === RECAP_SECTIONS.length - 1) return;
    moving = true;
    const front = cards()[index];
    front?.classList.add(step > 0 ? "is-leave-next" : "is-leave-prev");
    window.setTimeout(() => {
      moving = false;
      if (step > 0 && index >= count - 1) return finishPart();
      if (step < 0 && index === 0) return openPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true, enter: "prev" });
      index += step;
      applyStack({ enter: step > 0 ? "next" : "prev" });
    }, MOVE_MS);
  };

  // A part is done once each of its cards has been on top.
  const seen = new Map(); // part id → Set of card indexes seen
  const markSeen = () => {
    const id = current();
    if (!seen.has(id)) seen.set(id, new Set());
    seen.get(id).add(index);
    if (count && seen.get(id).size >= count && !reviewed().has(id)) {
      patchDraft(sid, { reviewedParts: [...reviewed(), id] });
      shell.paint();
    }
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) return openPart(part);
    if (e.target.closest("[data-review-next]")) return move(1);
    if (e.target.closest("[data-review-prev]")) return move(-1);
    if (e.target.closest("[data-review-start]")) return enterArchie(sid);
    if (e.target.closest("[data-flow-back]")) return navigate("/welcome-alt/ready");
  };
  target.addEventListener("click", onClick);
  // The keyboard's arrows browse too — unless you're typing in a field.
  const onKey = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (document.querySelector(".app-modal-backdrop:not([hidden]), body.has-modal")) return;
    e.preventDefault();
    move(e.key === "ArrowRight" ? 1 : -1);
  };
  document.addEventListener("keydown", onKey);

  openPart(current());

  return () => {
    observer.disconnect();
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
