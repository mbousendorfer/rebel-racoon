// The voice list: the default voice, then the Playbook's networks, each with
// its « Own voice » toggle — the Playbook's Voice profile tab
// (playbook-view.js renderVoiceNav), with the behavior of the run's Voice
// review (2026-11-05, asked: « on pourrait mutualiser le comportement entre
// ces 2 éléments »). The review keeps its own look (welcome-alt-review.js
// toggleList): sharing it was tried the same day and reverted, « je t'ai pas
// demandé de modifier ça ».
//
// Off, a network uses the default voice and its row opens nothing; on, its row
// opens its voice. The host owns what a click or a toggle does: it passes its
// own hooks, `openAttr` (on a row that opens, its key as the value) and
// `toggleAttr` (on the toggle's input), and wires them in its delegation.
//
// voiceListHtml(rows, { openAttr, toggleAttr })
//   rows: [{ key, icon, title, current?, inert?, mark? (trusted HTML, after
//   the name), toggle?: { on, disabled? } }] — the rows without a toggle (the
//   default voice) head the list, the others follow under « Own voice ».

import { escapeHtml as esc } from "../utils.js?v=2710";

function rowHtml(r, { openAttr, toggleAttr }) {
  const main = `<i class="${r.icon} voice-list__icon" aria-hidden="true"></i><span class="voice-list__name">${esc(r.title)}</span>${r.mark || ""}`;
  const toggle = r.toggle
    ? `<label class="ap-toggle-container voice-list__toggle">
        <input type="checkbox" ${toggleAttr}="${esc(r.key)}" aria-label="Own voice for ${esc(r.title)}"${r.toggle.on ? " checked" : ""}${r.toggle.disabled ? " disabled" : ""} /><i></i>
      </label>`
    : "";
  return `<li class="voice-list__row${r.inert ? " is-inert" : ""}" aria-current="${r.current && !r.inert ? "true" : "false"}">
    ${
      r.inert
        ? `<span class="voice-list__main">${main}</span>`
        : `<button type="button" class="voice-list__main" ${openAttr}="${esc(r.key)}">${main}</button>`
    }
    ${toggle}
  </li>`;
}

export function voiceListHtml(rows, hooks) {
  const head = rows.filter((r) => !r.toggle);
  const nets = rows.filter((r) => r.toggle);
  return `<nav class="voice-list" aria-label="Voices">
    <ul class="voice-list__group">${head.map((r) => rowHtml(r, hooks)).join("")}</ul>
    ${
      nets.length
        ? `<p class="voice-list__head" aria-hidden="true"><span>Network</span><span>Own voice</span></p>
           <ul class="voice-list__group">${nets.map((r) => rowHtml(r, hooks)).join("")}</ul>`
        : ""
    }
  </nav>`;
}
