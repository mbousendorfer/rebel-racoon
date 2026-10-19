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

import { html, raw } from "../utils.js?v=1950";
import { navigate } from "../router.js?v=1950";
import { getDraft, patchDraft } from "../context-builder.js?v=1950";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=1950";
import { parseHashParams } from "../url-state.js?v=1950";
import { mountShell } from "./welcome-alt-shell.js?v=1950";
import { enterArchie } from "./welcome-alt-recap.js?v=1950";

const LEAVE_MS = 220;

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
  const kicker = () => {
    const part = partOf(current());
    return html`
      <div class="welcome-review__kicker">
        <span class="welcome-flow__glyph is-icon"><i class="${part.icon}" aria-hidden="true"></i></span>
        <span>${part.title}</span>
      </div>
    `;
  };

  const footer = () => {
    if (allDone()) {
      return html`
        <div class="welcome-review__cardfoot">
          <span class="welcome-review__where">Every card is done. Start writing whenever you're ready.</span>
        </div>
      `;
    }
    const part = partOf(current());
    return html`
      <div class="welcome-review__cardfoot">
        <span class="welcome-review__where">${index + 1} of ${count}</span>
        <button type="button" class="ap-button stroked grey" data-review-prev>Back</button>
        <button type="button" class="ap-button primary blue" data-review-ok>
          <i class="ap-icon-check"></i><span data-review-ok-label>${dirty ? "Save" : "Looks good"}</span>
        </button>
      </div>
    `;
  };

  // Deal the stack: the front card shows (with its footer), up to two backs
  // peek under it, the rest is out of the way.
  let applying = false;
  const applyStack = ({ entering = false } = {}) => {
    applying = true;
    const list = cards();
    count = list.length;
    index = Math.min(index, Math.max(0, count - 1));
    list.forEach((el, i) => {
      el.classList.toggle("welcome-review__card", true);
      el.classList.toggle("is-front", i === index);
      el.classList.toggle("is-entering", entering && i === index);
      el.classList.remove("is-leaving");
      el.dataset.behind = i === index ? String(Math.min(2, count - 1 - index)) : "";
      el.querySelector(":scope > .welcome-review__cardfoot")?.remove();
    });
    list.forEach((el) => el.querySelector(":scope > .welcome-review__kicker")?.remove());
    list[index]?.insertAdjacentHTML("afterbegin", kicker());
    list[index]?.insertAdjacentHTML("beforeend", footer());
    shell.paint();
    applying = false;
  };
  const observer = new MutationObserver(() => {
    if (!applying) applyStack();
  });
  observer.observe(body, { childList: true });

  // Open a part: its tab, in edit, from its first card (or its last, going back).
  const openPart = (id, { fromEnd = false } = {}) => {
    if (body.querySelector(".pb2.is-editing")) body.querySelector("[data-recap-save]")?.click();
    body.querySelector(`[data-pb2-tab="${id}"]`)?.click();
    body.querySelector("[data-recap-edit-card]")?.click();
    index = fromEnd ? Number.MAX_SAFE_INTEGER : 0;
    dirty = false;
    applyStack({ entering: true });
    body.querySelector(".welcome-screen")?.scrollTo?.({ top: 0 });
  };

  const finishPart = () => {
    body.querySelector("[data-recap-save]")?.click();
    const done = reviewed();
    done.add(current());
    patchDraft(sid, { reviewedParts: [...done] });
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const next =
      RECAP_SECTIONS.slice(at + 1).find((t) => !done.has(t.id)) || RECAP_SECTIONS.find((t) => !done.has(t.id));
    if (next) openPart(next.id);
    else {
      // Every part done: the last part stays on screen, its card now offering
      // Start writing, and the stack takes the reveal's breath.
      index = 0;
      applyStack({ entering: true });
      shell.sheet.classList.add("is-revealed");
    }
  };

  // The front card leaves, then the next one comes forward.
  const advance = (step) => {
    const front = cards()[index];
    front?.classList.add("is-leaving");
    window.setTimeout(() => {
      dirty = false;
      if (step > 0 && index >= count - 1) return finishPart();
      if (step < 0 && index === 0) {
        const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
        if (at > 0) return openPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true });
        front?.classList.remove("is-leaving");
        return;
      }
      index += step;
      applyStack({ entering: true });
    }, LEAVE_MS);
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
  target.addEventListener("input", markDirty);
  target.addEventListener("change", markDirty);

  openPart(current());

  return () => {
    observer.disconnect();
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
    target.removeEventListener("input", markDirty);
    target.removeEventListener("change", markDirty);
  };
}
