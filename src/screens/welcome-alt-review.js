// /welcome-alt/recap under flag connectFirst — the review, the run's last screen.
//
// The WHOLE Playbook, every block, part by part (Brief, Voice profile,
// Branding, Competitors, Influencers). Each part opens straight in edit — the
// real Playbook view, playbook-view, its hero, tabs, tab head and panel
// Cancel / Save hidden — and its blocks line up one under the other in a
// column that scrolls over the stage. Everything is already filled in by me,
// so it's browsing, not validating:
//   - edits apply as you type (the draft is the live source);
//   - the card at the reading line (the middle of the stage) is in focus, the
//     others a step back — a dimming that follows the scroll (--focus);
//   - the nav stands in the middle of the stage, right of the column — one
//     compact capsule, ↑ · the dots · ↓ (and the keyboard's ↑ / ↓, outside a
//     field) glide the next card to the middle; the index follows the scroll;
//   - the part's cover (tile, name, sentence) is the column's first card, not
//     counted in the dots;
//   - one button at the bottom confirms the part ("Looks good — on to …"): it
//     checks it in the list and the next part's column cascades in. The last
//     one ends on "all set".
// Draft my first post lives on the left, the whole time — never on a card.
// (2026-10-20: this replaced the stack — one card at a time, a passing cover
// and a confirm interstitial between parts — deleted with its flag.)
//
// The view repaints its whole DOM on most edits (a chip added…), so the column
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.

import { html, raw } from "../utils.js?v=2237";
import { navigate } from "../router.js?v=2237";
import { getDraft, patchDraft } from "../context-builder.js?v=2237";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=2237";
import { parseHashParams } from "../url-state.js?v=2237";
import { mountShell, tint } from "./welcome-alt-shell.js?v=2237";
import { enterArchie } from "./welcome-alt-recap.js?v=2237";

// Each part's tint (`tint`, welcome-alt-shell.js — the card's rows share it):
// its cards' header band, its cover and its tile in the list, so the colour
// says which part you're in (asked for explicitly, 2026-10-19).
const OUT_MS = 240; // the part's column leaves
const GLIDE_MS = 720; // a card glides to the middle

export function renderReview(target, sid, config) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  const current = () => parseHashParams().get("tab") || RECAP_SECTIONS[0].id;
  const partOf = (id) => RECAP_SECTIONS.find((t) => t.id === id) || RECAP_SECTIONS[0];
  // The part's yes says where it leads — the next part, or the end
  // (2026-10-20: "Confirm Brief" read as admin).
  const looksGood = (id) => {
    const next = RECAP_SECTIONS[RECAP_SECTIONS.findIndex((t) => t.id === id) + 1];
    return next ? `Looks good — on to ${next.title}` : "Looks good — finish";
  };

  let index = 0; // the card in focus, within the current part
  let allSet = false; // the "all set" card is up (it carries Draft my first post)
  let count = 0; // how many cards the current part has
  // The part just confirmed: its check pops in once, for the length of the pop
  // (the list can repaint twice in a frame). The list repaints on every move,
  // so a check that always animated replayed on every click (2026-10-20).
  let justChecked = null;

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">
        I've filled in every card. Scroll through and fix anything that's off — changes save as you type.
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
  shell.sheet.classList.add("is-scroll");
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  // The end of the run: "all set", over the stage.
  const introEl = document.createElement("div");
  introEl.className = "welcome-review__intro";
  introEl.setAttribute("aria-live", "polite");
  shell.sheet.append(introEl);
  const navEl = document.createElement("nav");
  navEl.className = "welcome-review__nav";
  navEl.setAttribute("aria-label", "Cards");
  shell.sheet.append(navEl);
  // The part's confirm, at the bottom of the stage.
  const barEl = document.createElement("div");
  barEl.className = "welcome-review__bar";
  shell.sheet.append(barEl);
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

  // The part's cover, heading its column: its tile, name and sentence.
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

  // The nav: one compact white capsule — ↑ · the part's progress (page dots,
  // the one indicator) · ↓. ↓ goes dark on the part's last card: the confirm,
  // below, is the way on.
  const nav = (list) => {
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    const upNext = index < count - 1 ? cardTitle(list[index + 1]) : "";
    const atStart = index === 0 && at === 0;
    return html`
      <button
        type="button"
        class="welcome-review__navbtn"
        data-review-prev
        aria-label="Previous card"
        ${atStart ? raw("disabled") : ""}
      >
        <i class="ap-icon-arrow-up" aria-hidden="true"></i>
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
      <button
        type="button"
        class="welcome-review__navbtn"
        data-review-next
        aria-label="${upNext ? `Next: ${upNext}` : "Next card"}"
        ${upNext ? "" : raw("disabled")}
      >
        <i class="ap-icon-arrow-down" aria-hidden="true"></i>
      </button>
    `;
  };

  // Lay the column out: every card wears its part's band, the one in focus is
  // marked, the cover heads the column (re-laid after a repaint, swapped with
  // the part), the nav and the confirm follow the index.
  let applying = false;
  const applyColumn = () => {
    applying = true;
    const list = cards();
    count = list.length;
    index = Math.min(index, Math.max(0, count - 1));
    list.forEach((el, i) => {
      el.classList.add("welcome-review__card");
      el.classList.toggle("is-active", i === index);
      if (!el.querySelector(":scope > .welcome-review__kicker")) el.insertAdjacentHTML("afterbegin", kicker());
      if (!el.style.getPropertyValue("--focus")) el.style.setProperty("--focus", i === index ? "1" : "0");
    });
    if (list[0]) {
      const head = list[0].previousElementSibling;
      if (!head?.matches(".welcome-review__cover") || head.dataset.part !== current()) {
        coverEl()?.remove();
        list[0].insertAdjacentHTML("beforebegin", cover());
      }
    }
    navEl.innerHTML = count ? nav(list) : "";
    const part = partOf(current());
    barEl.innerHTML = html`
      <button type="button" class="ap-button primary blue" data-review-confirm="${part.id}">
        <i class="ap-icon-check"></i><span>${looksGood(part.id)}</span>
      </button>
    `;
    applying = false;
    shell.paint();
  };
  const observer = new MutationObserver(() => {
    if (applying) return;
    applyColumn();
    focus(); // the repainted cards keep their dimming
  });
  observer.observe(body, { childList: true });

  // Open a part: its tab, in edit, from its first card (or its last, going back).
  const openPart = (id, { fromEnd = false } = {}) => {
    if (body.querySelector(".pb2.is-editing")) body.querySelector("[data-recap-save]")?.click();
    body.querySelector(`[data-pb2-tab="${id}"]`)?.click();
    body.querySelector("[data-recap-edit-card]")?.click();
    index = fromEnd ? Number.MAX_SAFE_INTEGER : 0;
    applyColumn();
    centre({ instant: true });
  };

  // Bring the current card to the reading line — the middle of the stage,
  // where the nav stands (2026-10-20: at 45% the nav read as off-centre). A
  // card taller than the scroll starts at its top. The glide is ours, not the
  // browser's smooth scroll (too short, too abrupt): a slow ease-in-out, the
  // snap off while it runs (it would catch the scroll on the way). While it
  // glides, the scroll doesn't pick the index.
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

  // How in focus each card is — 1 on the reading line, easing to 0 a card's
  // height away — drives its dimming continuously (--focus), so it follows the
  // scroll instead of switching. The card under the line is the current one.
  const focusOf = (el, line) => {
    const r = el.getBoundingClientRect();
    const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0;
    el.style.setProperty("--focus", (1 - Math.min(1, d / 280)).toFixed(3));
    return d;
  };
  const focus = () => {
    const line = body.getBoundingClientRect().top + body.clientHeight * 0.5;
    let best = index;
    let dist = Infinity;
    if (coverEl()) focusOf(coverEl(), line);
    cards().forEach((el, i) => {
      const d = focusOf(el, line);
      if (d < dist) [best, dist] = [i, d];
    });
    if (gliding || best === index) return;
    index = best;
    applyColumn();
  };
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      focus();
    });
  };
  body.addEventListener("scroll", onScroll, { passive: true });

  // A part's column arrives: its cards cascade in, the nearest first, the cover
  // with them.
  const deal = () => {
    cards().forEach((el, i) => {
      el.style.setProperty("--deal", Math.abs(i - index));
      el.classList.add("is-dealt");
    });
    coverEl()?.style.setProperty("--deal", index + 1);
    coverEl()?.classList.add("is-dealt");
  };

  // Changing part: the column leaves, the new one cascades in. The snap stays
  // off while the cascade lands: it follows a card's transform, so it chased
  // each rising card and the column slid back under them (2026-10-20).
  let moving = false;
  const switchPart = (id, opts = {}) => {
    if (moving) return;
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      openPart(id, opts);
      shell.sheet.classList.remove("is-part-out");
      body.classList.add("is-settling");
      window.setTimeout(() => body.classList.remove("is-settling"), 950);
      deal();
      navEl.classList.add("is-dealt");
      window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
      moving = false;
    }, OUT_MS);
  };

  // The end of the run: every part confirmed.
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
  const showDone = () => {
    allSet = true;
    introEl.innerHTML = doneCard();
    shell.sheet.classList.add("is-part-intro", "is-asking");
    introEl.querySelector("[data-review-again]")?.focus({ preventScroll: true });
    shell.paint();
  };
  const hideDone = () => {
    shell.sheet.classList.remove("is-part-intro", "is-asking");
    introEl.innerHTML = "";
    if (allSet) {
      allSet = false;
      shell.paint();
    }
  };

  // Confirmed: the part is checked, and the next one cascades in (or, the
  // last one, the Playbook is all set).
  const confirmPart = (from) => {
    if (!reviewed().has(from)) {
      justChecked = from;
      window.setTimeout(() => (justChecked = null), 400);
    }
    patchDraft(sid, { reviewedParts: [...new Set([...reviewed(), from])] });
    const to = RECAP_SECTIONS[RECAP_SECTIONS.findIndex((t) => t.id === from) + 1];
    if (!to) return showDone();
    switchPart(to.id);
  };

  // ↑ / ↓: the neighbour glides to the middle. Above a part's first card is
  // the previous part (from its end); below its last, nothing — the confirm is
  // the way on.
  const move = (step) => {
    if (moving) return;
    const at = RECAP_SECTIONS.findIndex((t) => t.id === current());
    if (step < 0 && index === 0) {
      if (at > 0) switchPart(RECAP_SECTIONS[at - 1].id, { fromEnd: true });
      return;
    }
    if (step > 0 && index >= count - 1) return;
    index += step;
    applyColumn();
    centre();
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) {
      const asking = shell.sheet.classList.contains("is-asking");
      if (asking) hideDone();
      if (part !== current()) return switchPart(part);
      if (asking) openPart(part);
      return;
    }
    const confirm = e.target.closest("[data-review-confirm]")?.dataset.reviewConfirm;
    if (confirm) return confirmPart(confirm);
    const again = e.target.closest("[data-review-again]")?.dataset.reviewAgain;
    if (again) {
      hideDone();
      return again === current() ? openPart(again) : switchPart(again);
    }
    // A dimmed card comes into focus — the click still reaches its field.
    const dimmed = e.target.closest(".welcome-review__card:not(.is-active)");
    if (dimmed) {
      index = cards().indexOf(dimmed);
      applyColumn();
      centre();
    }
    if (e.target.closest("[data-review-next]")) return move(1);
    if (e.target.closest("[data-review-prev]")) return move(-1);
    if (e.target.closest("[data-review-start]")) return enterArchie(sid);
    if (e.target.closest("[data-flow-back]")) return navigate("/welcome-alt/ready");
  };
  target.addEventListener("click", onClick);
  // The keyboard's ↑ / ↓ browse too — unless you're typing in a field.
  const onKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (document.querySelector(".app-modal-backdrop:not([hidden]), body.has-modal")) return;
    if (shell.sheet.classList.contains("is-asking")) return;
    e.preventDefault();
    move(e.key === "ArrowDown" ? 1 : -1);
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
