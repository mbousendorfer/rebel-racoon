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
//   - at the end of a part, the interstitial asks to confirm it ("Brief look
//     right?" — Back to Brief / Confirm Brief); confirming checks it in the
//     list and deals the next part. The last one ends on "all set".
// Start writing lives on the left, the whole time — never on a card.
//
// The view repaints its whole DOM on most edits (a chip added…), so the stack
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.

import { html, raw } from "../utils.js?v=1969";
import { navigate } from "../router.js?v=1969";
import { getDraft, patchDraft } from "../context-builder.js?v=1969";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=1969";
import { parseHashParams } from "../url-state.js?v=1969";
import { mountShell } from "./welcome-alt-shell.js?v=1969";
import { enterArchie } from "./welcome-alt-recap.js?v=1969";

const MOVE_MS = 220; // the card's exit, before the next one comes in

// Each part's tint — its card's header band and its tile in the list share it,
// so the colour says which part you're in (asked for explicitly, 2026-10-19).
// Soft DS tints only, and never electric blue: blue stays the interactive colour.
// Each tint comes with its own dark shade for the part's glyph (the -150 of the
// same ramp), so the icon carries the colour too instead of a flat grey.
const PART_TINT = {
  goals: "orange",
  voice: "purple",
  brand: "menthol",
  competitors: "yellow",
  influencers: "soft-blue",
};
const tint = (id) =>
  PART_TINT[id]
    ? `--part-tint: var(--ref-color-${PART_TINT[id]}-20); --part-ink: var(--ref-color-${PART_TINT[id]}-150)`
    : "";
const OUT_MS = 240; // the part's stack leaves
const INTRO_MS = 900; // the next part says its name

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
                <span class="welcome-flow__glyph is-icon is-tinted" style="${tint(t.id)}"
                  ><i class="${t.icon}" aria-hidden="true"></i
                ></span>
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
  // The part's own moment, between two parts: its tile, name and sentence.
  const introEl = document.createElement("div");
  introEl.className = "welcome-review__intro";
  introEl.setAttribute("aria-live", "polite");
  shell.sheet.append(introEl);
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
      <div class="welcome-review__kicker" style="${tint(current())}">
        <span class="welcome-flow__glyph is-icon"><i class="${part.icon}" aria-hidden="true"></i></span>
        <span class="welcome-review__kicker-name">${part.title}</span>
      </div>
    `;
  };

  // The navigation floats under the stack, out of the card: three pieces of one
  // shape — white 44px pills — ← · the part's progress (page dots, the one
  // indicator) · Next, named after what's coming. A deliberate visual exception
  // to the DS buttons (2026-10-19): a blue rectangle among white pills broke it.
  const nav = (list) => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const nextPart = RECAP_SECTIONS[at + 1];
    const upNext = index < count - 1 ? cardTitle(list[index + 1]) : nextPart ? nextPart.title : "Finish";
    const atStart = index === 0 && at === 0;
    return html`
      <button
        type="button"
        class="welcome-review__navbtn is-icon"
        data-review-prev
        aria-label="Previous card"
        ${atStart ? raw("disabled") : ""}
      >
        <i class="ap-icon-arrow-left" aria-hidden="true"></i>
      </button>
      <ol class="welcome-review__dots" aria-label="Card ${index + 1} of ${count} in ${partOf(current()).title}">
        ${Array.from(
          { length: count },
          (_, i) => html`<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}"></li>`,
        )}
      </ol>
      <button type="button" class="welcome-review__navbtn" data-review-next ${upNext ? "" : raw("disabled")}>
        <span>${upNext || "Last card"}</span><i class="ap-icon-arrow-right" aria-hidden="true"></i>
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
      el.classList.remove("is-enter-next", "is-enter-prev", "is-leave-next", "is-leave-prev", "is-dealt");
      if (enter && i === index) el.classList.add(`is-enter-${enter}`);
      el.dataset.behind = i === index ? String(Math.min(2, count - 1 - index)) : "";
      el.querySelectorAll(":scope > .welcome-review__kicker").forEach((n) => n.remove());
    });
    list[index]?.insertAdjacentHTML("afterbegin", kicker());
    navEl.innerHTML = count ? nav(list) : "";
    applying = false;
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

  // Changing part is its own beat, unlike moving between cards: the whole stack
  // leaves, the new part says its name (its tinted tile, title, sentence), and
  // its cards are dealt onto the stack.
  const switchPart = (id, opts = {}) => {
    if (moving) return;
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      openPart(id, { ...opts, enter: "" });
      shell.sheet.classList.remove("is-part-out");
      const part = partOf(id);
      introEl.innerHTML = html`
        <div class="welcome-review__intro-card" style="${tint(id)}">
          <span class="welcome-review__intro-tile"><i class="${part.icon}" aria-hidden="true"></i></span>
          <span class="welcome-review__intro-title">${part.title}</span>
          <span class="welcome-review__intro-lead">${part.lead}</span>
        </div>
      `;
      shell.sheet.classList.add("is-part-intro");
      window.setTimeout(() => {
        shell.sheet.classList.remove("is-part-intro");
        introEl.innerHTML = "";
        cards()[index]?.classList.add("is-dealt");
        navEl.classList.add("is-dealt");
        window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
        moving = false;
      }, INTRO_MS);
    }, OUT_MS);
  };

  // The end of a part: the interstitial asks to confirm it before the next
  // one is dealt — the part's check in the list comes from that answer.
  const confirmCard = (from, to) => {
    const part = partOf(from);
    const next = to ? partOf(to) : null;
    return html`
      <div class="welcome-review__intro-card is-confirm" style="${tint(from)}">
        <span class="welcome-review__intro-tile">
          <i class="${part.icon}" aria-hidden="true"></i>
          <span class="welcome-review__intro-done"><i class="ap-icon-check" aria-hidden="true"></i></span>
        </span>
        <span class="welcome-review__intro-title">${part.title} look right?</span>
        <span class="welcome-review__intro-lead">
          ${next ? `Confirm it and I'll move on to ${next.title}.` : "Confirm it and your Playbook is all set."} You can
          still change anything later, from your Playbook.
        </span>
        <span class="welcome-review__intro-actions">
          <button type="button" class="ap-button stroked grey" data-review-again="${from}">
            Back to ${part.title}
          </button>
          <button type="button" class="ap-button primary blue" data-review-confirm="${from}">
            <i class="ap-icon-check"></i><span>Confirm ${part.title}</span>
          </button>
        </span>
      </div>
    `;
  };
  const doneCard = () => html`
    <div class="welcome-review__intro-card is-done">
      <span class="welcome-review__intro-tile is-all"><i class="ap-icon-check" aria-hidden="true"></i></span>
      <span class="welcome-review__intro-title">Your Playbook is all set.</span>
      <span class="welcome-review__intro-lead">Every part is confirmed. Start writing whenever you're ready.</span>
      <span class="welcome-review__intro-actions">
        <button type="button" class="ap-button stroked grey" data-review-again="${RECAP_SECTIONS[0].id}">
          Review it again
        </button>
      </span>
    </div>
  `;

  const showIntro = (markup) => {
    introEl.innerHTML = markup;
    shell.sheet.classList.add("is-part-intro", "is-asking");
    introEl.querySelector("[data-review-confirm], [data-review-again]")?.focus({ preventScroll: true });
  };
  const hideIntro = () => {
    shell.sheet.classList.remove("is-part-intro", "is-asking");
    introEl.innerHTML = "";
  };

  const finishPart = () => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const from = current();
    const to = RECAP_SECTIONS[at + 1]?.id || null;
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      shell.sheet.classList.remove("is-part-out");
      showIntro(confirmCard(from, to));
      moving = false;
    }, OUT_MS);
  };

  // Confirmed: the part is checked, and the next one is dealt (or, the last
  // one, the Playbook is all set).
  const confirmPart = (from) => {
    patchDraft(sid, { reviewedParts: [...new Set([...reviewed(), from])] });
    const at = RECAP_SECTIONS.findIndex((t) => t.id === from);
    const to = RECAP_SECTIONS[at + 1];
    if (!to) {
      showIntro(doneCard());
      shell.paint();
      return;
    }
    hideIntro();
    openPart(to.id, { enter: "" });
    cards()[index]?.classList.add("is-dealt");
    navEl.classList.add("is-dealt");
    window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
  };

  // Not yet: back into the part, on its last card.
  const reviewAgain = (id) => {
    hideIntro();
    openPart(id, { fromEnd: id === current(), enter: "" });
    cards()[index]?.classList.add("is-dealt");
  };

  // Next: the card swipes off and the next one rises from the stack. Previous:
  // the card sinks into the stack, the one before slides back in from the side.
  // Crossing the end of a part moves into the next (or previous) one.
  let moving = false;
  const move = (step) => {
    if (moving) return;
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    if (step < 0 && index === 0 && at === 0) return;
    moving = true;
    const front = cards()[index];
    front?.classList.add(step > 0 ? "is-leave-next" : "is-leave-prev");
    window.setTimeout(() => {
      moving = false;
      if (step > 0 && index >= count - 1) return finishPart();
      if (step < 0 && index === 0) return switchPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true });
      index += step;
      applyStack({ enter: step > 0 ? "next" : "prev" });
    }, MOVE_MS);
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) {
      if (shell.sheet.classList.contains("is-asking")) {
        hideIntro();
        return part === current() ? reviewAgain(part) : switchPart(part);
      }
      return part === current() ? undefined : switchPart(part);
    }
    const confirm = e.target.closest("[data-review-confirm]")?.dataset.reviewConfirm;
    if (confirm) return confirmPart(confirm);
    const again = e.target.closest("[data-review-again]")?.dataset.reviewAgain;
    if (again) return reviewAgain(again);
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
    if (shell.sheet.classList.contains("is-asking")) return;
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
