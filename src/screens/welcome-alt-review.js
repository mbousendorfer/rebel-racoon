// The run's two reviews — one screen, two hosts
// (2026-10-29, asked: « séparer + fortement la Voice et le Playbook », the
// same cards for both):
//   /welcome-alt/recap  the Playbook — Brief, Branding, Competitors, Influencers;
//   /welcome-alt/voice  the Voice — the default voice, then the networks.
// Each review is a list of PARTS ({ id, tab, title, icon, lead, tint?, pick? }):
// a part opens a playbook-view tab, and `pick` keeps the blocks that are its
// own (the Voice's two parts share the voice tab).
//
// Every block, part by part. Each part opens straight in edit — the
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
//   - no cover card: the list on the left names the part (covers removed
//     2026-10-29, asked: they repeated the left entry);
//   - one button at the bottom confirms the part ("Looks good — on to …"): it
//     checks it in the list and the next part's column cascades in. The last
//     one goes straight on (ui-polish OB-18: an « all set » card in between
//     was a step on a screen that says « Step 3 of 4 »).
// The way on lives on the left, the whole time — never on a card: on to the
// Voice from the Playbook, Draft my first post from the Voice.
// (2026-10-20: this replaced the stack — one card at a time, a passing cover
// and a confirm interstitial between parts — deleted with its flag.)
//
// The view repaints its whole DOM on most edits (a chip added…), so the column
// is re-applied after every paint (a MutationObserver on the host) — the card
// index lives here, not in the DOM.

import { html, raw } from "../utils.js?v=2765";
import { navigate } from "../router.js?v=2765";
import { getDraft, patchDraft } from "../context-builder.js?v=2765";
import { mount } from "../playbook-view.js?v=2765";
import { parseHashParams } from "../url-state.js?v=2765";
import { mountShell, tint } from "./welcome-alt-shell.js?v=2765";

// Each part's tint (`tint`, welcome-alt-shell.js — the card's rows share it):
// its cards' header band, its cover and its tile in the list, so the colour
// says which part you're in (asked for explicitly, 2026-10-19).
const OUT_MS = 240; // the part's column leaves
const GLIDE_MS = 720; // a card glides to the middle

// `review.calm` (every run's Voice review since 2026-11-04; first asked for a
// returning user's Create a Playbook, 2026-11-03: « trop
// animé et compliqué … une expérience + simple »): the same column, still — no
// tinted band, no dimming, no glide, no ↑ / ↓ capsule, no cascade.
//
// `review`: { step, title, sub, parts (a list, or a function for parts that
// come and go; a part's `open()` opens its tab in edit itself, its `badge` says
// what's left to do, its `group` / `groupHint` head a run of parts —
// what's left to do), rows? (the list on the left when it holds more than the
// parts: a row with `inert` is shown, never opened nor confirmed — the voice
// review's networks left on the default voice; a row's `net`: a network, listed
// under « Network voices » (inert: in the Add menu), answered by
// onToggle(partId, on); `removable: false` hides its trash), moreNets? (the
// networks to add from a menu under the rows: { id, title, icon }),
// onLeavePart?(partId), next: { label, go },
// back, onWay?, start? (the part to open first), progress? (false: no step
// dots) }.
// `onWay(partId, way, refresh)`: a card's tile was picked (the voice review);
// `refresh()` repaints the part with what it changed.
export function renderReview(target, sid, config, review) {
  const parts = () => (typeof review.parts === "function" ? review.parts() : review.parts);
  const calm = !!review.calm;
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  // The part on screen: the URL's tab when it names one (a reload), else the first.
  let currentId = parts().find((t) => t.id === parseHashParams().get("tab"))?.id || parts()[0].id;
  const current = () => currentId;
  const partOf = (id) => parts().find((t) => t.id === id) || parts()[0];
  const tintOf = (id) => tint(partOf(id).tint || id);
  // The part's yes says where it leads — the next part, or the end
  // (2026-10-20: "Confirm Brief" read as admin).
  // A part with nothing in it yet says so (`skipLabel`: the voice review's
  // empty network) instead of « Looks good ».
  const looksGood = (id) => {
    const skip = partOf(id).skipLabel?.();
    if (skip) return skip;
    const next = parts()[parts().findIndex((t) => t.id === id) + 1];
    return next ? next.nextLabel || `Looks good, on to ${next.title}` : review.lastLabel || "Looks good, finish";
  };

  let index = 0; // the card in focus, within the current part
  let count = 0; // how many cards the current part has
  // The part just confirmed: its check pops in once, for the length of the pop
  // (the list can repaint twice in a frame). The list repaints on every move,
  // so a check that always animated replayed on every click (2026-10-20).
  let justChecked = null;

  // The network rows (the voice review): « Network voices », a row per network
  // with a voice of its own — its name over its state, opening its part, a
  // Remove beside it (two controls, never one inside the other) — and each
  // network still on the default voice, a dashed row to add it, in the same
  // order (2026-11-05, ux-heuristics, asked: a toggle that both set the state
  // and opened the row wasn't understood, the state wasn't said, and « que
  // l'utilisateur puisse ajouter lui-même une voice »). Answered by
  // onToggle(partId, on).
  const netList = () => {
    const rows = (review.rows?.() || []).filter((t) => t.net);
    const more = review.moreNets?.() || [];
    if (!rows.length && !more.length) return "";
    const done = reviewed();
    const row = (t) => {
      const here = t.id === current();
      const check = done.has(t.id)
        ? `<span class="welcome-review__check${t.id === justChecked ? " is-new" : ""}" title="Done"><i class="ap-icon-check" aria-hidden="true"></i></span>`
        : "";
      return html`
        <li class="welcome-review__net" aria-current="${here ? "true" : "false"}">
          <button type="button" class="welcome-review__net-main" data-review-part="${t.id}">
            <i class="${t.icon} welcome-review__net-icon" aria-hidden="true"></i>
            <span class="welcome-review__net-text">
              <span class="welcome-review__net-name">${t.title} voice</span>
              ${t.lead ? raw(html`<span class="welcome-review__net-state">${t.lead}</span>`) : ""}
            </span>
            ${raw(check)}
          </button>
          ${here && t.removable !== false
            ? raw(
                html`<button
                  type="button"
                  class="ap-icon-button transparent grey welcome-review__net-remove"
                  data-review-remove="${t.id}"
                  aria-label="Remove the ${t.title} voice"
                  title="Remove the ${t.title} voice"
                >
                  <i class="ap-icon-trash"></i>
                </button>`,
              )
            : ""}
        </li>
      `;
    };
    // The voices without an answer: a dashed row, « X voice · Configure »
    // as in the fiche (2026-11-05, asked: « remplacer par configure », « les
    // montrer en pointillé les voices que l'on peut ajouter ») — a click adds
    // it and opens it. Every network keeps its place in the one list: a row
    // added used to leave its place for the head of the list (2026-11-05,
    // asked: « l'élément cliqué remonte tout en haut »).
    const addable = (t) =>
      html`<li>
        <button type="button" class="welcome-review__addable" data-review-add-net="${t.id}">
          <i class="${t.icon} welcome-review__net-icon" aria-hidden="true"></i>
          <span class="welcome-review__addable-name">${t.title} voice</span>
          <span class="welcome-review__addable-add">Configure</span>
        </button>
      </li>`;
    return html`
      <li class="welcome-review__nets">
        <p class="welcome-review__nets-head">Network voices</p>
        ${rows.length
          ? raw(
              html`<ul class="welcome-review__nets-list">
                ${raw(rows.map((t) => (t.inert ? addable(t) : row(t))).join(""))}
              </ul>`,
            )
          : ""}
        ${raw(moreMenu(more))}
      </li>
    `;
  };

  // « Add a voice for another network »: the networks with no account
  // connected, in a DS action dropdown under the rows (2026-11-05, asked: the
  // fiche's model, « Oui, aligne »). A pick adds it and opens it, like a row.
  const moreMenu = (more) =>
    more.length
      ? html`<details class="recap__panel-menu pb2-voice-more" data-review-more>
          <summary class="ap-button ghost blue recap__panel-menu-toggle">
            <i class="ap-icon-plus" aria-hidden="true"></i><span>Add a voice for another network</span>
          </summary>
          <div class="ap-action-dropdown recap__panel-menu-pop" role="menu" aria-label="Networks">
            ${raw(
              more
                .map(
                  (t) =>
                    html`<button
                      type="button"
                      class="ap-action-dropdown-item"
                      data-review-add-net="${t.id}"
                      role="menuitem"
                    >
                      <i class="${t.icon}"></i>
                      <div class="ap-action-dropdown-item-text">
                        <div class="ap-action-dropdown-item-label-container">
                          <span class="ap-action-dropdown-item-label">${t.title}</span>
                        </div>
                      </div>
                    </button>`,
                )
                .join(""),
            )}
          </div>
        </details>`
      : "";

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">${review.title}</h1>
      <p class="welcome-intro__sub">${review.sub}</p>
      <ul class="welcome-flow__options">
        ${(review.rows?.() || parts())
          .filter((t) => !t.net)
          .map((t, i, all) => {
            const here = t.id === current();
            // A group opens with its name and a sentence.
            // Only when there are groups to tell apart: a group of one part was a
            // kicker and a hint repeating the sub-line above it.
            const groupLi = (name, hint) =>
              html`<li class="welcome-review__group">
                <p class="welcome-flow__kicker">${name}</p>
                ${hint ? raw(html`<p class="welcome-review__group-hint">${hint}</p>`) : ""}
              </li>`;
            const groups = new Set(all.map((p) => p.group).filter(Boolean));
            const group =
              t.group && groups.size > 1 && t.group !== all[i - 1]?.group ? groupLi(t.group, t.groupHint) : "";
            const mark = t.inert
              ? ""
              : done.has(t.id)
                ? `<span class="welcome-review__check${t.id === justChecked ? " is-new" : ""}" title="Done"><i class="ap-icon-check" aria-hidden="true"></i></span>`
                : here && count > 1 && !calm
                  ? `<span class="welcome-review__count">${index + 1} of ${count}</span>`
                  : "";
            const inner = html`
              <span class="welcome-flow__glyph is-icon is-tinted" style="${tintOf(t.id)}"
                ><i class="${t.icon}" aria-hidden="true"></i
              ></span>
              <span class="welcome-flow__option-text">
                <span class="welcome-flow__option-title">${t.title}</span>
                ${t.lead ? raw(html`<span class="welcome-flow__option-desc">${t.lead}</span>`) : ""}
              </span>
              ${t.badge && !done.has(t.id) ? raw(`<span class="ap-status orange">${t.badge}</span>`) : ""} ${raw(mark)}
            `;
            return html`
              ${raw(group)}
              <li>
                <button
                  type="button"
                  class="welcome-flow__option"
                  data-review-part="${t.id}"
                  aria-current="${here ? "true" : "false"}"
                >
                  ${raw(inner)}
                </button>
              </li>
            `;
          })}
        ${raw(netList())}
      </ul>
      <div class="welcome-flow__actions">
        <button type="button" class="ap-button ghost grey" data-flow-back>
          <i class="ap-icon-arrow-left"></i><span>Back</span>
        </button>
        <!-- Secondary: the screen's one primary is the part's confirm, at the
             bottom of the stage (ui-polish OB-08). Calm: that one alone. -->
        ${calm
          ? ""
          : raw(
              html`<button type="button" class="ap-button secondary blue" data-review-start>
                <span>${review.next.label}</span><i class="ap-icon-arrow-right"></i>
              </button>`,
            )}
      </div>
    `;
  };

  const shell = mountShell(target, { step: review.step, sid, left, sheet: true });
  shell.sheet.classList.add("is-scroll");
  shell.sheet.classList.toggle("is-calm", calm);
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  // The part's tool strip (the voice's « Rewrite it from a source »), pinned
  // over the column: the view renders it, the stage shows a copy, a click on
  // the copy clicks the original (the view's own delegation stays the one).
  const toolsEl = document.createElement("div");
  toolsEl.className = "welcome-review__tools";
  shell.sheet.append(toolsEl);
  toolsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-voice-choice]");
    if (!btn) return;
    body
      .querySelector(
        `.pb2-voice-ways [data-voice-choice="${btn.dataset.voiceChoice}"][data-voice-ask="${btn.dataset.voiceAsk}"]`,
      )
      ?.click();
  });
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
    // A way to fill the part, picked on a card's tile (the voice review):
    // `net` null is the default voice.
    ...(review.onWay && {
      onVoiceWay: (net, way) =>
        review.onWay(net ? `voice-net-${net}` : current(), way === "learn" ? "posts" : way, () => openPart(current())),
    }),
    showTop: false,
    headerActions: () => null,
    audienceList: true,
    chipCloud: true,
    rosterPicker: true,
  });

  // The part's cards: its blocks in edit (the ones it picks; the tab's others
  // hide), else the edited panel (a roster), else whatever the part shows when
  // it has nothing to edit.
  const cards = () => {
    const all = [...body.querySelectorAll(".pb2-grid[data-recap-editing-card] > .pb2-block")];
    const pick = partOf(current()).pick;
    const picked = pick ? pick(all) : all;
    all.forEach((el) => (el.hidden = !picked.includes(el)));
    // A tool strip (the voice's « Rewrite it from a source ») heads the column
    // but is no card: no band, no dot, no focus.
    const tools = picked.find((el) => el.matches(".pb2-voice-ways"));
    if (tools) tools.hidden = true;
    const strip = tools?.innerHTML || "";
    if (toolsEl.dataset.html !== strip) {
      toolsEl.dataset.html = strip;
      toolsEl.innerHTML = strip;
    }
    shell.sheet.classList.toggle("has-tools", !!tools);
    shell.sheet.style.setProperty("--tools-h", `${toolsEl.offsetHeight}px`);
    const blocks = picked.filter((el) => el !== tools);
    if (blocks.length) return blocks;
    const panel = body.querySelector("[data-recap-editing-card]") || body.querySelector(".pb2__panel");
    return panel ? [panel] : [];
  };

  // A card's own name: its block title, else (a roster panel) its part's.
  const cardTitle = (el) => el?.querySelector(".pb2-block__title")?.textContent.trim() || partOf(current()).title;

  // The card's head: its part — icon + name, the list's tile.
  const kicker = () => {
    const part = partOf(current());
    return html`
      <div class="welcome-review__kicker" style="${tintOf(current())}">
        <span class="welcome-flow__glyph is-icon"><i class="${part.icon}" aria-hidden="true"></i></span>
        <span class="welcome-review__kicker-name">${part.title}</span>
      </div>
    `;
  };

  // The nav: one compact white capsule — ↑ · the part's progress (page dots,
  // the one indicator) · ↓. ↓ goes dark on the part's last card: the confirm,
  // below, is the way on.
  const nav = (list) => {
    const at = parts().findIndex((t) => t.id === current());
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
    // The nav, the confirm and the left list are rebuilt below, which destroys a
    // focused button: note its data-* hook and focus its twin after (WCAG 2.4.3).
    // The confirm's value names the part, so a twin by hook name alone also counts.
    const focused = target.contains(document.activeElement) ? document.activeElement : null;
    const hook = focused && [...focused.attributes].find((a) => a.name.startsWith("data-"));
    const list = cards();
    count = list.length;
    index = Math.min(index, Math.max(0, count - 1));
    list.forEach((el, i) => {
      el.classList.add("welcome-review__card");
      el.classList.toggle("is-active", i === index);
      if (!calm && !el.querySelector(":scope > .welcome-review__kicker")) el.insertAdjacentHTML("afterbegin", kicker());
      if (!el.style.getPropertyValue("--focus")) el.style.setProperty("--focus", i === index ? "1" : "0");
    });
    navEl.innerHTML = count && !calm ? nav(list) : "";
    const part = partOf(current());
    // A part with nothing in it (`skipLabel`: the voice review's empty network)
    // has no « Looks good » to give: its way on is a ghost grey button under
    // the card's options, not the bar's primary (2026-11-04, asked: « the
    // button should be under the options, but more as a grey ghost button »).
    // A card with its own answers (`data-review-own-actions`: a voice being
    // learned or proposed) gets neither.
    const card = list[index];
    const own = !!card?.matches("[data-review-own-actions]");
    const skip = !own && part.skipLabel?.();
    barEl.hidden = !!skip || own;
    barEl.innerHTML =
      skip || own
        ? ""
        : html`
            <button type="button" class="ap-button primary blue" data-review-confirm="${part.id}">
              <i class="ap-icon-check"></i><span>${looksGood(part.id)}</span>
            </button>
          `;
    if (skip && card && !card.querySelector(":scope > .welcome-review__skip"))
      card.insertAdjacentHTML(
        "beforeend",
        html`<div class="welcome-review__skip">
          <button type="button" class="ap-button ghost grey" data-review-confirm="${part.id}">
            <span>${skip}</span>
          </button>
        </div>`,
      );
    applying = false;
    shell.paint();
    if (hook && !target.contains(document.activeElement)) {
      const twin =
        target.querySelector(`[${hook.name}="${CSS.escape(hook.value)}"]`) || target.querySelector(`[${hook.name}]`);
      twin?.focus({ preventScroll: true });
    }
  };
  // A repaint (a box ticked, a chip added) rebuilds the column: the card being
  // edited stays where it was instead of the column jumping back to the top.
  const observer = new MutationObserver(() => {
    if (applying) return;
    applyColumn();
    centre({ instant: true });
  });
  observer.observe(body, { childList: true });

  // Open a part: its tab, in edit, from its first card (or its last, going back).
  const openPart = (id, { fromEnd = false } = {}) => {
    currentId = partOf(id).id;
    if (body.querySelector(".pb2.is-editing")) body.querySelector("[data-recap-save]")?.click();
    body.querySelector(`[data-pb2-tab="${partOf(id).tab || currentId}"]`)?.click();
    // A part may open its tab in edit itself (the voice review: a network's rules).
    if (partOf(id).open) partOf(id).open();
    else body.querySelector("[data-recap-edit-card]")?.click();
    index = fromEnd ? Number.MAX_SAFE_INTEGER : 0;
    if (calm) body.scrollTop = 0;
    applyColumn();
    centre({ instant: true });
  };

  // Bring the current card to the reading line — the middle of the stage,
  // where the nav stands (2026-10-20: at 45% the nav read as off-centre). A
  // card taller than the scroll starts at its top. The glide is ours, not the
  // browser's smooth scroll (too short, too abrupt): a slow ease-in-out. While it
  // glides, the scroll doesn't pick the index.
  const easeInOut = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
  let gliding = false;
  let glideFrame = 0;
  const centre = ({ instant = false } = {}) => {
    if (calm) return; // still: the scroll is the reader's (a part opens at its top, openPart)
    const el = cards()[index];
    if (!el) return;
    const box = body.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const room = body.clientHeight * 0.5;
    const max = body.scrollHeight - body.clientHeight;
    const to = Math.max(0, Math.min(max, body.scrollTop + r.top - box.top - Math.max(24, room - r.height / 2)));
    window.cancelAnimationFrame(glideFrame);
    if (instant || calm || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gliding = false;
      body.scrollTop = to;
      return focus();
    }
    const from = body.scrollTop;
    const t0 = performance.now();
    gliding = true;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / GLIDE_MS);
      body.scrollTop = from + (to - from) * easeInOut(p);
      if (p < 1) glideFrame = window.requestAnimationFrame(step);
      else {
        gliding = false;
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
    if (calm) return;
    const line = body.getBoundingClientRect().top + body.clientHeight * 0.5;
    let best = index;
    let dist = Infinity;
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
  };

  // Changing part: the column leaves, the new one cascades in.
  let moving = false;
  // `review.onLeavePart(id)`: the part on screen is left (the voice review
  // drops a network left with no voice — never added).
  const switchPart = (id, opts = {}) => {
    if (id !== current()) review.onLeavePart?.(current());
    if (calm) return openPart(id, opts);
    if (moving) return;
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      openPart(id, opts);
      shell.sheet.classList.remove("is-part-out");
      deal();
      navEl.classList.add("is-dealt");
      window.setTimeout(() => navEl.classList.remove("is-dealt"), 500);
      moving = false;
    }, OUT_MS);
  };

  // Confirmed: the part is checked, and the next one cascades in (or, the
  // last one, the way on).
  const confirmPart = (from) => {
    if (!reviewed().has(from)) {
      justChecked = from;
      window.setTimeout(() => (justChecked = null), 400);
    }
    patchDraft(sid, { reviewedParts: [...new Set([...reviewed(), from])] });
    const to = parts()[parts().findIndex((t) => t.id === from) + 1];
    review.onLeavePart?.(from);
    if (!to) return review.next.go();
    switchPart(to.id);
  };

  // ↑ / ↓: the neighbour glides to the middle. Above a part's first card is
  // the previous part (from its end); below its last, nothing — the confirm is
  // the way on.
  const move = (step) => {
    if (moving) return;
    const at = parts().findIndex((t) => t.id === current());
    if (step < 0 && index === 0) {
      if (at > 0) switchPart(parts()[at - 1].id, { fromEnd: true });
      return;
    }
    if (step > 0 && index >= count - 1) return;
    index += step;
    applyColumn();
    centre();
  };

  const onClick = (e) => {
    // The network voices: add one (it opens), remove one.
    const addNet = e.target.closest("[data-review-add-net]")?.dataset.reviewAddNet;
    if (addNet) {
      e.target.closest("details")?.removeAttribute("open");
      if (addNet !== current()) review.onLeavePart?.(current());
      review.onToggle?.(addNet, true);
      return openPart(addNet);
    }
    const remove = e.target.closest("[data-review-remove]")?.dataset.reviewRemove;
    if (remove) {
      const wasHere = remove === current();
      review.onToggle?.(remove, false);
      return wasHere ? openPart(parts()[0].id) : shell.paint();
    }
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) {
      if (part !== current()) switchPart(part);
      return;
    }
    const confirm = e.target.closest("[data-review-confirm]")?.dataset.reviewConfirm;
    if (confirm) return confirmPart(confirm);
    // A dimmed card comes into focus — the click still reaches its field.
    const dimmed = e.target.closest(".welcome-review__card:not(.is-active)");
    if (dimmed) {
      index = cards().indexOf(dimmed);
      applyColumn();
      centre();
    }
    if (e.target.closest("[data-review-next]")) return move(1);
    if (e.target.closest("[data-review-prev]")) return move(-1);
    if (e.target.closest("[data-review-start]")) return review.next.go();
    if (e.target.closest("[data-flow-back]")) return navigate(review.back);
  };
  target.addEventListener("click", onClick);
  // The keyboard's ↑ / ↓ browse too — unless you're typing in a field.
  const onKey = (e) => {
    if (calm) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    // Arrows inside a widget (a card's action menu, a radio group) belong to it.
    if (e.target.closest?.('[role="menu"], [role="listbox"], [role="radiogroup"], [role="tablist"]')) return;
    if (document.querySelector(".app-modal-backdrop:not([hidden]), body.has-modal")) return;
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

// The Playbook's review as ONE page — every run since 2026-11-04 (2026-11-03, asked: « voir facilement ce que Archie a trouvé, et
// éditer ce qui manque sans cliquer dans tous les sens »): every part one
// under the other, already in edit (playbook-view's `stack`), chip fields
// showing only what's kept. The list on the left is a table of contents — a
// click scrolls to its part, a part with its essentials missing says
// « To fill in ». One button at the bottom goes on.
const missing = {
  goals: (d) => !d.businessSummary || !(d.audience || []).length,
  brand: (d) => !d.brandLogo,
};

export function renderPageReview(target, sid, config, review) {
  const left = () => {
    const d = getDraft(sid) || {};
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">${review.title}</h1>
      <p class="welcome-intro__sub">${review.sub}</p>
      <ul class="welcome-flow__options">
        ${review.parts.map(
          (t) => html`
            <li>
              <button type="button" class="welcome-flow__option" data-review-jump="${t.id}">
                <span class="welcome-flow__glyph is-icon is-tinted" style="${tint(t.tint || t.id)}"
                  ><i class="${t.icon}" aria-hidden="true"></i
                ></span>
                <span class="welcome-flow__option-text">
                  <span class="welcome-flow__option-title">${t.title}</span>
                  <span class="welcome-flow__option-desc">${t.lead}</span>
                </span>
                ${missing[t.id]?.(d) ? raw(`<span class="ap-status orange">To fill in</span>`) : ""}
              </button>
            </li>
          `,
        )}
      </ul>
      <div class="welcome-flow__actions">
        <button type="button" class="ap-button ghost grey" data-flow-back>
          <i class="ap-icon-arrow-left"></i><span>Back</span>
        </button>
      </div>
    `;
  };

  const shell = mountShell(target, { step: review.step, sid, left, sheet: true });
  shell.sheet.classList.add("is-scroll", "is-calm", "is-page");
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  const barEl = document.createElement("div");
  barEl.className = "welcome-review__bar";
  barEl.innerHTML = html`
    <button type="button" class="ap-button primary blue" data-review-done>
      <i class="ap-icon-check"></i><span>${review.lastLabel}</span>
    </button>
  `;
  shell.sheet.append(barEl);
  const unmount = mount(body, {
    ...config,
    showTop: false,
    headerActions: () => null,
    audienceList: true,
    chipCloud: true,
    rosterPicker: true,
    stack: review.parts.map((t) => t.id),
  });

  // Each block a card of the column (the review's card look), and the list's
  // « To fill in » kept true — after every repaint of the view.
  const dress = () => {
    body
      .querySelectorAll(".pb2-stack__part .pb2-grid > .pb2-block, .pb2-stack__part > .recap__panel")
      .forEach((el) => el.classList.add("welcome-review__card"));
    shell.paint();
  };
  const observer = new MutationObserver(dress);
  observer.observe(body, { childList: true });
  dress();

  const onClick = (e) => {
    const jump = e.target.closest("[data-review-jump]")?.dataset.reviewJump;
    if (jump) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      body.querySelector(`#pb2-part-${jump}`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      return;
    }
    if (e.target.closest("[data-review-done]")) return review.next.go();
    if (e.target.closest("[data-flow-back]")) return navigate(review.back);
  };
  target.addEventListener("click", onClick);

  return () => {
    observer.disconnect();
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
  };
}
