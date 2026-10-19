// /welcome-alt/recap under flag connectFirst — the review, the run's last screen.
//
// The WHOLE Playbook, every block — dealt as a stack of cards, one block at a
// time, instead of a wall. Each part (Brief, Voice profile, Branding,
// Competitors, Influencers) opens straight in edit — the real Playbook view,
// playbook-view, its hero, tabs and tab head hidden — and only its front block
// shows, the ones still to come stacked behind it. Everything is already filled
// in by me, so each card is a glance and a click:
//   - the card names its part on top (the part's icon, as in the list — one
//     icon per part, not per block), and its footer says where you are
//     ("2 of 6") with Back and
//     Looks good — Save as soon as a field on it changed;
//   - the card flies off and the next one comes forward; the last card of a
//     part closes the part (the view's own Save), checks it in the list, and
//     the next part deals its first card;
//   - the list on the left says each part in one sentence, shows where the
//     current one stands, and jumps to any part.
// Start writing lives on the left, the whole time — never on a card.
//
// The view repaints its whole DOM on most edits (a chip added…), so the stack
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.

import { html, raw } from "../utils.js?v=1955";
import { navigate } from "../router.js?v=1955";
import { getDraft, patchDraft } from "../context-builder.js?v=1955";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=1955";
import { parseHashParams } from "../url-state.js?v=1955";
import { mountShell } from "./welcome-alt-shell.js?v=1955";
import { enterArchie } from "./welcome-alt-recap.js?v=1955";

const NEXT_MS = 520; // the stamp lands, then the card swipes off
const PREV_MS = 240;
const STAMP = `<span class="welcome-review__stamp" aria-hidden="true"><i class="ap-icon-check"></i></span>`;

export function renderReview(target, sid, config) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  const current = () => parseHashParams().get("tab") || RECAP_SECTIONS[0].id;
  const partOf = (id) => RECAP_SECTIONS.find((t) => t.id === id) || RECAP_SECTIONS[0];
  const allDone = () => RECAP_SECTIONS.every((t) => reviewed().has(t.id));

  let index = 0; // the front card, within the current part
  let count = 0; // how many cards the current part deals
  let dirty = false; // a field on the front card changed → Save, not Looks good

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">I've filled in every card. Glance at each one, fix what's off, and move on.</p>
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

  // The card's head: its part (icon + name, the list's tile) and, on the right,
  // where it stands in the part — one segment per card, done ones olive.
  const kicker = () => {
    const part = partOf(current());
    return html`
      <div class="welcome-review__kicker">
        <span class="welcome-flow__glyph is-icon"><i class="${part.icon}" aria-hidden="true"></i></span>
        <span class="welcome-review__kicker-name">${part.title}</span>
        <ol class="welcome-review__segs" aria-label="Card ${index + 1} of ${count}">
          ${Array.from(
            { length: count },
            (_, i) => html`<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}"></li>`,
          )}
        </ol>
      </div>
    `;
  };

  // The footer says what comes next — the next card, or the next part — so the
  // button is never a leap in the dark. Every card keeps Back and Looks good.
  const footer = (list) => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const nextPart = RECAP_SECTIONS[at + 1];
    const upNext =
      index < count - 1 ? `Next: ${cardTitle(list[index + 1])}` : nextPart ? `Next: ${nextPart.title}` : "Last card";
    return html`
      <div class="welcome-review__cardfoot">
        <span class="welcome-review__next">${upNext}</span>
        <button type="button" class="ap-button stroked grey" data-review-prev>Back</button>
        <button type="button" class="ap-button primary blue" data-review-ok>
          <i class="ap-icon-check"></i><span data-review-ok-label>${dirty ? "Save" : "Looks good"}</span>
        </button>
      </div>
    `;
  };

  // Deal the stack: the front card shows (head + footer), up to two backs peek
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
      el.querySelectorAll(
        ":scope > .welcome-review__cardfoot, :scope > .welcome-review__kicker, :scope > .welcome-review__stamp",
      ).forEach((n) => n.remove());
    });
    list[index]?.insertAdjacentHTML("afterbegin", kicker());
    list[index]?.insertAdjacentHTML("beforeend", footer(list));
    shell.paint();
    applying = false;
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
    dirty = false;
    applyStack({ enter });
    body.querySelector(".welcome-screen")?.scrollTo?.({ top: 0 });
  };

  const finishPart = () => {
    body.querySelector("[data-recap-save]")?.click();
    const done = reviewed();
    done.add(current());
    patchDraft(sid, { reviewedParts: [...done] });
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    // The next part still to review; once all are, simply the next one in order.
    const next =
      RECAP_SECTIONS.slice(at + 1).find((t) => !done.has(t.id)) ||
      RECAP_SECTIONS.find((t) => !done.has(t.id)) ||
      RECAP_SECTIONS[at + 1];
    if (next) openPart(next.id);
    else {
      // The very last card: it comes back, still editable — Start writing is on the left.
      openPart(current(), { fromEnd: true });
    }
  };

  // Looks good: a check stamps the card, it swipes off tilting, and the next one
  // rises from the stack. Back: the card sinks into the stack, the previous one
  // slides back in from the side.
  let moving = false;
  const advance = (step) => {
    if (moving) return;
    const front = cards()[index];
    if (step < 0 && index === 0 && RECAP_SECTIONS.findIndex((t) => t.id === current()) === 0) return;
    moving = true;
    if (step > 0) front?.insertAdjacentHTML("beforeend", STAMP);
    front?.classList.add(step > 0 ? "is-leave-next" : "is-leave-prev");
    window.setTimeout(
      () => {
        moving = false;
        dirty = false;
        if (step > 0 && index >= count - 1) return finishPart();
        if (step < 0 && index === 0) {
          const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
          return openPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true, enter: "prev" });
        }
        index += step;
        applyStack({ enter: step > 0 ? "next" : "prev" });
      },
      step > 0 ? NEXT_MS : PREV_MS,
    );
  };

  const markDirty = (e) => {
    if (dirty || !e.target.closest(".welcome-review__card.is-front")) return;
    dirty = true;
    const label = body.querySelector("[data-review-ok-label]");
    if (label) label.textContent = "Save";
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) return openPart(part);
    if (e.target.closest("[data-review-ok]")) return advance(1);
    if (e.target.closest("[data-review-prev]")) return advance(-1);
    if (e.target.closest("[data-review-start]")) return enterArchie(sid);
    if (e.target.closest("[data-flow-back]")) return navigate("/welcome-alt/ready");
  };
  target.addEventListener("click", onClick);
  // Capture phase: the view repaints on some edits, which would detach the
  // field before a bubbling listener could tell which card it was on.
  body.addEventListener("input", markDirty, true);
  body.addEventListener("change", markDirty, true);

  openPart(current());

  return () => {
    observer.disconnect();
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
    body.removeEventListener("input", markDirty, true);
    body.removeEventListener("change", markDirty, true);
  };
}
