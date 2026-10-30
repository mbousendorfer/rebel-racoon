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
// Cancel / Save hidden — and its blocks read as ONE sheet over the stage, one
// under the other, that scrolls (redesign 2026-10-30, design-plans/
// redesign-onboarding.md). Everything is already filled in by me, so it's
// browsing, not validating:
//   - edits apply as you type (the draft is the live source);
//   - no card in focus, no nav capsule, no keyboard glide: the list on the
//     left is the part's navigation, the sheet just scrolls;
//   - the part's band (its icon + name) heads the sheet once;
//   - ONE way on, in the left column, always in the same place: the part's
//     confirm (« Looks good, on to … »). It checks it in the list and the next
//     part's sheet comes in; the last one goes straight on. Before the last
//     part, the step's own way on (« Check my voice ») stays as a quiet
//     second door. (2026-10-20: this replaced the stack — one card at a time —
//     deleted with its flag; 2026-10-30: the floating confirm at the foot of
//     the stage and the ↑ · dots · ↓ capsule, two navigations over a list that
//     already navigates, went.)
//
// The view repaints its whole DOM on most edits (a chip added…), so the sheet
// is re-laid after every paint (a MutationObserver on the host).

import { html, raw } from "../utils.js?v=2603";
import { navigate } from "../router.js?v=2603";
import { getDraft, patchDraft } from "../context-builder.js?v=2603";
import { mount } from "../playbook-view.js?v=2603";
import { parseHashParams } from "../url-state.js?v=2603";
import { mountShell, tint } from "./welcome-alt-shell.js?v=2603";

// Each part's tint (`tint`, welcome-alt-shell.js — the card's rows share it):
// its cards' header band, its cover and its tile in the list, so the colour
// says which part you're in (asked for explicitly, 2026-10-19).
const OUT_MS = 240; // the part's column leaves

// `review`: { step, title, sub, parts (a list, or a function for parts that
// come and go; a part's `open()` opens its tab in edit itself, its `badge` says
// what's left to do, its `group` / `groupHint` head a run of parts —
// what's left to do), next: { label, go }, back, onWay?,
// start? (the part to open first), progress? (false: no step dots) }.
// `onWay(partId, way, refresh)`: a card's tile was picked (the voice review);
// `refresh()` repaints the part with what it changed.
export function renderReview(target, sid, config, review) {
  const parts = () => (typeof review.parts === "function" ? review.parts() : review.parts);
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  // The part on screen: the URL's tab when it names one (a reload), else the first.
  let currentId = parts().find((t) => t.id === parseHashParams().get("tab"))?.id || parts()[0].id;
  const current = () => currentId;
  const partOf = (id) => parts().find((t) => t.id === id) || parts()[0];
  const tintOf = (id) => tint(partOf(id).tint || id);
  // The part's yes says where it leads — the next part, or the end
  // (2026-10-20: "Confirm Brief" read as admin).
  const looksGood = (id) => {
    const next = parts()[parts().findIndex((t) => t.id === id) + 1];
    return next ? next.nextLabel || `Looks good, on to ${next.title}` : review.lastLabel || "Looks good, finish";
  };

  const isLast = () => parts().at(-1)?.id === current();
  // The part just confirmed: its check pops in once, for the length of the pop
  // (the list can repaint twice in a frame). The list repaints on every move,
  // so a check that always animated replayed on every click (2026-10-20).
  let justChecked = null;

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">${review.title}</h1>
      <p class="welcome-intro__sub">${review.sub}</p>
      <ul class="welcome-flow__options">
        ${parts().map((t, i, all) => {
          const here = t.id === current();
          // A group opens with its name and a sentence (the voice review:
          // the default voice, then the networks).
          // Only when there are groups to tell apart: a group of one part was a
          // kicker and a hint repeating the sub-line above it.
          const group =
            t.group && new Set(all.map((p) => p.group)).size > 1 && t.group !== all[i - 1]?.group
              ? html`<li class="welcome-review__group">
                  <p class="welcome-flow__kicker">${t.group}</p>
                  ${t.groupHint ? raw(html`<p class="welcome-review__group-hint">${t.groupHint}</p>`) : ""}
                </li>`
              : "";
          const mark = done.has(t.id)
            ? `<span class="welcome-review__check${t.id === justChecked ? " is-new" : ""}" title="Done"><i class="ap-icon-check" aria-hidden="true"></i></span>`
            : "";
          // A part that adds rather than reviews (`action`: the voice review's
          // networks) is a + button, not a row like the parts (2026-10-29, asked:
          // « plutôt un genre de "bouton +" »).
          if (t.action)
            return html`
              ${raw(group)}
              <li>
                <button
                  type="button"
                  class="ap-button secondary blue welcome-review__add"
                  data-review-part="${t.id}"
                  aria-current="${here ? "true" : "false"}"
                >
                  <i class="ap-icon-plus" aria-hidden="true"></i><span>${t.action}</span>
                </button>
              </li>
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
                <span class="welcome-flow__glyph is-icon is-tinted" style="${tintOf(t.id)}"
                  ><i class="${t.icon}" aria-hidden="true"></i
                ></span>
                <span class="welcome-flow__option-text">
                  <span class="welcome-flow__option-title">${t.title}</span>
                  <span class="welcome-flow__option-desc">${t.lead}</span>
                </span>
                ${t.badge && !done.has(t.id) ? raw(`<span class="ap-status orange">${t.badge}</span>`) : ""}
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
        <!-- The screen's one way on, always here (redesign 2026-10-30): the
             part's confirm, which says where it leads. Before the last part,
             the step's way on stays a quieter second door (skip to it). -->
        <button type="button" class="ap-button primary blue" data-review-confirm="${current()}">
          <span>${looksGood(current())}</span><i class="ap-icon-arrow-right"></i>
        </button>
      </div>
      ${isLast()
        ? ""
        : raw(
            html`<div class="welcome-review__skip">
              <button type="button" class="ap-button ghost blue" data-review-start>
                <span>${review.next.label}</span>
              </button>
            </div>`,
          )}
    `;
  };

  const shell = mountShell(target, { step: review.step, sid, left, sheet: true });
  shell.sheet.classList.add("is-scroll");
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

  // Lay the part out as one sheet (redesign 2026-10-30): its blocks one under
  // the other, the part's band on the first only (re-laid after a repaint,
  // swapped with the part). No card in focus, no nav: the sheet scrolls.
  let applying = false;
  const applyColumn = () => {
    applying = true;
    // The left list (and its confirm) is rebuilt below, which destroys a
    // focused button: note its data-* hook and focus its twin after (WCAG 2.4.3).
    // The confirm's value names the part, so a twin by hook name alone also counts.
    const focused = target.contains(document.activeElement) ? document.activeElement : null;
    const hook = focused && [...focused.attributes].find((a) => a.name.startsWith("data-"));
    cards().forEach((el, i) => {
      el.classList.add("welcome-review__card");
      const band = el.querySelector(":scope > .welcome-review__kicker");
      if (i === 0 && !band) el.insertAdjacentHTML("afterbegin", kicker());
      if (i > 0) band?.remove();
    });
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
    if (!applying) applyColumn();
  });
  observer.observe(body, { childList: true });

  // Open a part: its tab, in edit, the sheet at its top.
  const openPart = (id) => {
    currentId = partOf(id).id;
    if (body.querySelector(".pb2.is-editing")) body.querySelector("[data-recap-save]")?.click();
    body.querySelector(`[data-pb2-tab="${partOf(id).tab || currentId}"]`)?.click();
    // A part may open its tab in edit itself (the voice review: a network's rules).
    if (partOf(id).open) partOf(id).open();
    else body.querySelector("[data-recap-edit-card]")?.click();
    applyColumn();
    body.scrollTop = 0;
  };

  // A part's sheet arrives whole: one surface, one entrance (its blocks no
  // longer cascade one by one). A repaint builds a new grid, without the class:
  // the entrance never replays on an edit.
  const deal = () => cards()[0]?.parentElement?.classList.add("is-dealt");

  // Changing part: the sheet leaves, the new one comes in.
  let moving = false;
  const switchPart = (id) => {
    if (moving) return;
    moving = true;
    shell.sheet.classList.add("is-part-out");
    window.setTimeout(() => {
      openPart(id);
      shell.sheet.classList.remove("is-part-out");
      deal();
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
    if (!to) return review.next.go();
    switchPart(to.id);
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) {
      if (part !== current()) switchPart(part);
      return;
    }
    const confirm = e.target.closest("[data-review-confirm]")?.dataset.reviewConfirm;
    if (confirm) return confirmPart(confirm);
    if (e.target.closest("[data-review-start]")) return review.next.go();
    if (e.target.closest("[data-flow-back]")) return navigate(review.back);
  };
  target.addEventListener("click", onClick);
  openPart(current());

  return () => {
    observer.disconnect();
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
  };
}
