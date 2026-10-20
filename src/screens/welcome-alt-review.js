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
// Draft my first post lives on the left, the whole time — never on a card.
//
// The view repaints its whole DOM on most edits (a chip added…), so the stack
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.
//
// Flag reviewScroll: the same parts and covers, but a part's cards line up one
// under the other in a scroll — the one at the reading line is in focus (the
// others dimmed). The nav stands in the middle of the stage, at the left of
// the column — ↑ · the dots, vertical · ↓ — and steps through them; the index
// follows the scroll. At the bottom, one button confirms the part. The part's
// cover (tile, name, sentence) is the column's first card — not a passing beat
// between parts (2026-10-20) — and isn't counted in the dots.

import { html, raw } from "../utils.js?v=2026";
import { navigate } from "../router.js?v=2026";
import { getDraft, patchDraft } from "../context-builder.js?v=2026";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=2026";
import { parseHashParams } from "../url-state.js?v=2026";
import { isFlagOn } from "../feature-flags.js?v=2026";
import { mountShell, tint } from "./welcome-alt-shell.js?v=2026";
import { enterArchie } from "./welcome-alt-recap.js?v=2026";

const MOVE_MS = 220; // the card's exit, before the next one comes in

// Each part's tint (`tint`, welcome-alt-shell.js — the card's rows share it):
// its card's header band and its tile in the list, so the colour says which
// part you're in (asked for explicitly, 2026-10-19).
const OUT_MS = 240; // the part's stack leaves
const INTRO_MS = 900; // the next part says its name

export function renderReview(target, sid, config) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  const current = () => parseHashParams().get("tab") || RECAP_SECTIONS[0].id;
  const partOf = (id) => RECAP_SECTIONS.find((t) => t.id === id) || RECAP_SECTIONS[0];
  // The part's yes, in both modes: it says where it leads — the next part, or
  // the end (2026-10-20: "Confirm Brief" read as admin).
  const looksGood = (id) => {
    const next = RECAP_SECTIONS[RECAP_SECTIONS.findIndex((t) => t.id === id) + 1];
    return next ? `Looks good — on to ${next.title}` : "Looks good — finish";
  };

  let index = 0; // the front card, within the current part
  let allSet = false; // the "all set" card is up (it carries Draft my first post)
  let count = 0; // how many cards the current part deals
  // The part just confirmed: its check pops in once, for the length of the pop
  // (the list can repaint twice in a frame). The list repaints on every move,
  // so a check that always animated replayed on every click (2026-10-20).
  let justChecked = null;
  const scroll = isFlagOn("reviewScroll");

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">
        ${scroll
          ? "I've filled in every card. Scroll through and fix anything that's off — changes save as you type."
          : "I've filled in every card. Browse them with the arrows and fix anything that's off — changes save as you type."}
      </p>
      <ul class="welcome-flow__options">
        ${RECAP_SECTIONS.map((t) => {
          const here = t.id === current();
          const mark = done.has(t.id)
            ? `<span class="welcome-review__check${t.id === justChecked ? " is-new" : ""}" title="Done"><i class="ap-icon-check" aria-hidden="true"></i></span>`
            : here && count > 1
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
        <button type="button" class="ap-button ghost grey" data-flow-back>
          <i class="ap-icon-arrow-left"></i><span>Back</span>
        </button>
        ${allSet /* the "all set" card offers it — once is enough */
          ? ""
          : raw(`<button type="button" class="ap-button primary orange" data-review-start>
              <span>Draft my first post</span><i class="ap-icon-arrow-right"></i>
            </button>`)}
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
  // Scroll mode: the part's confirm, at the bottom of the stage.
  const barEl = document.createElement("div");
  barEl.className = "welcome-review__bar";
  if (scroll) shell.sheet.append(barEl);
  const unmount = mount(body, {
    ...config,
    showTop: false,
    headerActions: () => null,
    audienceList: true,
    chipCloud: true,
    rosterPicker: true,
  });

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

  // Scroll mode: the part's cover, heading its column — the same tile, name
  // and sentence as the stack's passing cover, as a card that stays.
  const coverEl = () => body.querySelector(".welcome-review__cover");
  const cover = () => {
    const part = partOf(current());
    return html`
      <section class="welcome-review__cover" data-part="${part.id}" style="${tint(part.id)}">
        <span class="welcome-review__intro-tile"><i class="${part.icon}" aria-hidden="true"></i></span>
        <h2 class="welcome-review__intro-title">${part.title}</h2>
        <p class="welcome-review__cover-lead">${part.lead}</p>
      </section>
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
    if (scroll) {
      return html`
        <button
          type="button"
          class="welcome-review__navbtn is-icon"
          data-review-prev
          aria-label="Previous card"
          ${atStart ? raw("disabled") : ""}
        >
          <i class="ap-icon-arrow-up" aria-hidden="true"></i>
        </button>
        ${count > 1
          ? raw(html`
              <ol class="welcome-review__dots" aria-label="Card ${index + 1} of ${count} in ${partOf(current()).title}">
                ${Array.from(
                  { length: count },
                  (_, i) => html`<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}"></li>`,
                )}
              </ol>
            `)
          : ""}
        <button
          type="button"
          class="welcome-review__navbtn is-icon"
          data-review-next
          aria-label="Next: ${upNext}"
          ${index >= count - 1 /* the part goes on through its confirm, below */ ? raw("disabled") : ""}
        >
          <i class="ap-icon-arrow-down" aria-hidden="true"></i>
        </button>
      `;
    }
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
      ${count > 1 /* one card has no progress to show */
        ? raw(html`
            <ol class="welcome-review__dots" aria-label="Card ${index + 1} of ${count} in ${partOf(current()).title}">
              ${Array.from(
                { length: count },
                (_, i) => html`<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}"></li>`,
              )}
            </ol>
          `)
        : ""}
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
      if (scroll) {
        // Every card wears its part's band; the one at the reading line is in focus.
        el.classList.toggle("is-active", i === index);
        if (!el.querySelector(":scope > .welcome-review__kicker")) el.insertAdjacentHTML("afterbegin", kicker());
        if (!el.style.getPropertyValue("--focus")) el.style.setProperty("--focus", i === index ? "1" : "0");
        return;
      }
      el.classList.toggle("is-front", i === index);
      el.classList.remove("is-enter-next", "is-enter-prev", "is-leave-next", "is-leave-prev", "is-dealt");
      if (enter && i === index) el.classList.add(`is-enter-${enter}`);
      el.dataset.behind = i === index ? String(Math.min(2, count - 1 - index)) : "";
      el.querySelectorAll(":scope > .welcome-review__kicker").forEach((n) => n.remove());
    });
    if (!scroll) list[index]?.insertAdjacentHTML("afterbegin", kicker());
    // The cover heads the column — re-laid after a repaint, swapped with the part.
    if (scroll && list[0]) {
      const head = list[0].previousElementSibling;
      if (!head?.matches(".welcome-review__cover") || head.dataset.part !== current()) {
        coverEl()?.remove();
        list[0].insertAdjacentHTML("beforebegin", cover());
      }
    }
    navEl.innerHTML = count ? nav(list) : "";
    if (scroll) {
      const part = partOf(current());
      barEl.innerHTML = html`
        <button type="button" class="ap-button primary blue" data-review-confirm="${part.id}">
          <i class="ap-icon-check"></i><span>${looksGood(part.id)}</span>
        </button>
      `;
    }
    applying = false;
    shell.paint();
  };
  const observer = new MutationObserver(() => {
    if (applying) return;
    applyStack();
    if (scroll) focus(); // the repainted cards keep their dimming
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
    if (scroll) centre({ instant: true });
  };

  // Scroll mode: bring the current card to the reading line — the middle of
  // the stage, where the nav stands (2026-10-20: at 45% the nav read as
  // off-centre). A card taller than the scroll
  // starts at its top. The glide is ours, not the browser's smooth scroll
  // (too short, too abrupt): a slow ease-in-out, the snap off while it runs
  // (it would catch the scroll on the way). While it glides, the scroll
  // doesn't pick the index.
  const GLIDE_MS = 720;
  const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
  let gliding = false;
  let glideFrame = 0;
  const centre = ({ instant = false } = {}) => {
    const el = cards()[index];
    if (!el) return;
    const box = body.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const room = body.clientHeight * 0.5;
    const max = body.scrollHeight - body.clientHeight;
    const to = Math.max(0, Math.min(max, body.scrollTop + r.top - box.top - Math.max(24, room - r.height / 2)));
    window.cancelAnimationFrame(glideFrame);
    if (instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gliding = false;
      body.classList.remove("is-gliding");
      body.scrollTop = to;
      return focus();
    }
    const from = body.scrollTop;
    const t0 = performance.now();
    gliding = true;
    body.classList.add("is-gliding");
    const step = (now) => {
      const p = Math.min(1, (now - t0) / GLIDE_MS);
      body.scrollTop = from + (to - from) * easeInOut(p);
      if (p < 1) glideFrame = window.requestAnimationFrame(step);
      else {
        gliding = false;
        body.classList.remove("is-gliding");
      }
    };
    glideFrame = window.requestAnimationFrame(step);
  };

  // Scroll mode: how in focus each card is — 1 on the reading line, easing to 0
  // a card's height away — drives its dimming continuously (--focus), so it
  // follows the scroll instead of switching. The card under the line is the
  // current one.
  const focus = () => {
    const line = body.getBoundingClientRect().top + body.clientHeight * 0.5;
    let best = index;
    let dist = Infinity;
    const head = coverEl();
    if (head) {
      const r = head.getBoundingClientRect();
      const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0;
      head.style.setProperty("--focus", (1 - Math.min(1, d / 280)).toFixed(3));
    }
    cards().forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0;
      el.style.setProperty("--focus", (1 - Math.min(1, d / 280)).toFixed(3));
      if (d < dist) [best, dist] = [i, d];
    });
    if (gliding || best === index) return;
    index = best;
    applyStack();
  };
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      focus();
    });
  };
  if (scroll) {
    shell.sheet.classList.add("is-scroll");
    body.addEventListener("scroll", onScroll, { passive: true });
  }

  // A part's cards arrive: the front one is dealt onto the stack — in a
  // scroll, they all cascade in, the nearest first.
  const deal = () => {
    if (!scroll) return cards()[index]?.classList.add("is-dealt");
    cards().forEach((el, i) => {
      el.style.setProperty("--deal", Math.abs(i - index));
      el.classList.add("is-dealt");
    });
    coverEl()?.style.setProperty("--deal", index + 1);
    coverEl()?.classList.add("is-dealt");
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
      // Scroll mode: the cover is the column's first card — no passing beat.
      if (scroll) {
        deal();
        navEl.classList.add("is-dealt");
        window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
        moving = false;
        return;
      }
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
        deal();
        navEl.classList.add("is-dealt");
        window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
        moving = false;
      }, INTRO_MS);
    }, OUT_MS);
  };

  // The end of a part: the interstitial asks to confirm it before the next
  // one is dealt — the part's check in the list comes from that answer.
  const confirmCard = (from) => {
    const part = partOf(from);
    const plural = /s$/.test(part.title); // Competitors, Influencers
    return html`
      <div class="welcome-review__intro-card is-confirm" style="${tint(from)}">
        <span class="welcome-review__intro-tile">
          <i class="${part.icon}" aria-hidden="true"></i>
          <span class="welcome-review__intro-done"><i class="ap-icon-check" aria-hidden="true"></i></span>
        </span>
        <span class="welcome-review__intro-title"> ${plural ? "Do" : "Does"} the ${part.title} look right? </span>
        <span class="welcome-review__intro-lead">
          You can change ${plural ? "them" : "it"} anytime from your Playbook.
        </span>
        <span class="welcome-review__intro-actions">
          <button type="button" class="ap-button stroked grey" data-review-again="${from}">
            Back to ${part.title}
          </button>
          <button type="button" class="ap-button primary blue" data-review-confirm="${from}">
            <i class="ap-icon-check"></i><span>${looksGood(from)}</span>
          </button>
        </span>
      </div>
    `;
  };
  const doneCard = () => html`
    <div class="welcome-review__intro-card is-done">
      <span class="welcome-review__intro-tile is-all"><i class="ap-icon-check" aria-hidden="true"></i></span>
      <span class="welcome-review__intro-title">Your Playbook is all set.</span>
      <span class="welcome-review__intro-lead">Every part is confirmed — I'll write every draft from it.</span>
      <span class="welcome-review__intro-actions">
        <button type="button" class="ap-button stroked grey" data-review-again="${RECAP_SECTIONS[0].id}">
          Review it again
        </button>
        <button type="button" class="ap-button primary orange" data-review-start>
          <span>Draft my first post</span><i class="ap-icon-arrow-right"></i>
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
    if (allSet) {
      allSet = false;
      shell.paint();
    }
  };

  const finishPart = () => {
    const from = current();
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      shell.sheet.classList.remove("is-part-out");
      showIntro(confirmCard(from));
      moving = false;
    }, OUT_MS);
  };

  // Confirmed: the part is checked, and the next one is dealt (or, the last
  // one, the Playbook is all set).
  const confirmPart = (from) => {
    if (!reviewed().has(from)) {
      justChecked = from;
      window.setTimeout(() => (justChecked = null), 400);
    }
    patchDraft(sid, { reviewedParts: [...new Set([...reviewed(), from])] });
    const at = RECAP_SECTIONS.findIndex((t) => t.id === from);
    const to = RECAP_SECTIONS[at + 1];
    if (!to) {
      allSet = true;
      showIntro(doneCard());
      shell.paint();
      return;
    }
    hideIntro();
    // Scroll mode: the next part gets its cover, then its cards cascade in.
    if (scroll) return switchPart(to.id);
    openPart(to.id, { enter: "" });
    deal();
    navEl.classList.add("is-dealt");
    window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
  };

  // Not yet: back into the part, on its last card.
  const reviewAgain = (id) => {
    hideIntro();
    openPart(id, { fromEnd: id === current(), enter: "" });
    deal();
  };

  // Next: the card swipes off and the next one rises from the stack. Previous:
  // the card sinks into the stack, the one before slides back in from the side.
  // Crossing the end of a part moves into the next (or previous) one.
  let moving = false;
  const move = (step) => {
    if (moving) return;
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    if (step < 0 && index === 0 && at === 0) return;
    if (scroll) {
      if (step > 0 && index >= count - 1) return; // the confirm, at the bottom, moves on
      if (step < 0 && index === 0) return switchPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true });
      index += step;
      applyStack();
      return centre();
    }
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
    // Scroll mode: a dimmed card comes into focus — the click still reaches its field.
    const dimmed = scroll && e.target.closest(".welcome-review__card:not(.is-active)");
    if (dimmed) {
      index = cards().indexOf(dimmed);
      applyStack();
      centre();
    }
    if (e.target.closest("[data-review-next]")) return move(1);
    if (e.target.closest("[data-review-prev]")) return move(-1);
    if (e.target.closest("[data-review-start]")) return enterArchie(sid);
    if (e.target.closest("[data-flow-back]")) return navigate("/welcome-alt/ready");
  };
  target.addEventListener("click", onClick);
  // The keyboard's arrows browse too — unless you're typing in a field.
  const onKey = (e) => {
    const keys = scroll ? ["ArrowDown", "ArrowUp"] : ["ArrowRight", "ArrowLeft"];
    if (!keys.includes(e.key)) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (document.querySelector(".app-modal-backdrop:not([hidden]), body.has-modal")) return;
    if (shell.sheet.classList.contains("is-asking")) return;
    e.preventDefault();
    move(e.key === keys[0] ? 1 : -1);
  };
  document.addEventListener("keydown", onKey);

  openPart(current());

  return () => {
    observer.disconnect();
    body.removeEventListener("scroll", onScroll);
    window.cancelAnimationFrame(frame);
    window.cancelAnimationFrame(glideFrame);
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
