// ---- Insights — the three readings, and which one is on screen ----------------
//
// The catalogue (`LAYOUTS`) and the reader's choice (localStorage) live here,
// apart from the shell, because TWO modules need them: the screen, which paints
// the chosen layout, and the topbar, which renders the switch. The shell
// imports the topbar, so a switch owned by the shell would have made the
// topbar import it back — a cycle for one string.
//
// ⚠️ The switch is PROTOTYPE chrome, not product UI. Three layouts are three
// answers to "how do I read my objectives", kept side by side to be compared
// live; the day one wins, the others are a delete and this module goes with
// them. That is exactly why the control sits in the topbar and not in the page:
// the page is the thing being evaluated, and a comparison control standing
// inside it reads as one of the page's own features.

import { escapeHtml as esc } from "../../utils.js?v=1082";
import * as report from "./layouts/report.js?v=1082";
import * as cockpit from "./layouts/cockpit.js?v=1082";
import * as cockpitBis from "./layouts/cockpit-bis.js?v=1082";

export const LAYOUTS = [cockpit, cockpitBis, report];

/** localStorage — which layout the reader last chose. */
export const INSIGHTS_LAYOUT_KEY = "archie-insights-layout";

// Cockpit is what a first visit opens on: every objective is visible at once,
// so "what needs me" is answered before anything is clicked, and the pane's
// structure is the clearer read. Report is one switch away and the choice
// sticks.
export const DEFAULT_LAYOUT = "cockpit";

export function readLayoutId() {
  try {
    const v = localStorage.getItem(INSIGHTS_LAYOUT_KEY);
    return LAYOUTS.some((l) => l.id === v) ? v : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeLayoutId(id) {
  try {
    localStorage.setItem(INSIGHTS_LAYOUT_KEY, id);
  } catch {
    /* private mode — the choice just doesn't persist */
  }
}

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

/**
 * The switch, as the topbar wears it — far right, where /topics puts its cog
 * and a session puts its panel pills: the app's canonical home for a
 * page-level control.
 *
 * It is a ghost button in the topbar's own vocabulary (icon + label, like the
 * Sources / Ideas / Drafts pills beside it), carrying the CURRENT reading's
 * glyph and name so the resting state answers "which view am I in" without
 * being opened. Only the menu is the DS select's (`.ap-select-dropdown` /
 * `-options` / `-option`), so an option row reads the same as in every other
 * picker in the app.
 *
 * It used to be a labelled 180px "View" field in a page bar of its own. Two
 * things were wrong with that: it spent a row of the page on prototype chrome,
 * and it stood beside "New objective" — the page's one real primary — as if
 * the two were the same kind of thing.
 */
export function viewSwitch(currentId) {
  const current = layoutById(currentId);
  const rows = LAYOUTS.map(
    (l) => `<div class="ap-select-option${l.id === current.id ? " selected" : ""}" data-ins-view="${esc(l.id)}"
      role="option" aria-selected="${l.id === current.id}" title="${esc(l.title)}">
      <span class="ap-select-option-text">${esc(l.label)}</span>
      ${l.id === current.id ? `<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>` : ""}
    </div>`,
  ).join("");
  // `aria-label` says WHAT is being chosen, because `combobox` takes no name
  // from its contents — and the contents are the current value, which AT reads
  // separately. The listbox is labelled too: it is the popup that asks.
  return `<details class="ins-viewswitch" data-ins-scope>
    <summary class="ap-button ghost grey ins-viewswitch__trigger" role="combobox" aria-label="View"
      aria-haspopup="listbox" aria-expanded="false" aria-controls="insViewListbox">
      <i class="${esc(current.icon)}" aria-hidden="true"></i>
      <span>${esc(current.label)}</span>
      <i class="ap-icon-chevron-down ins-viewswitch__arrow" aria-hidden="true"></i>
    </summary>
    <div class="ap-select-dropdown ins-viewswitch__menu" id="insViewListbox" role="listbox" aria-label="View">
      <div class="ap-select-options">${rows}</div>
    </div>
  </details>`;
}
