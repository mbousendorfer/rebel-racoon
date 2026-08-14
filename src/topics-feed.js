// topics-feed — the shared render engine behind every surface that shows a run
// of topics: the /topics section page and the front page at `/`.
//
// Pure functions, no store reads and no state, on the model of playbook-view.js
// (recap + detail) and connectors-view.js (page + modal). Each host resolves its
// own data and passes in the two lookups it wants used, so this module never has
// to know whether it's rendering a filtered section or a curated front page.
//
//   groupByAge(topics)                    → [{ id, label, items }]
//   renderSourceChips(...)                → the section chips ("rubriques")
//   renderMagazine(topics, opts)          → lead story + grid
//
// THE LAYOUT: one lead story, then a grid. A news front page leads with one
// item because a run of equal cards has no answer to "what should I read first?"
// — and Archie's whole job here is to answer exactly that. The grid below keeps
// the old rule that made the feed scannable (every card the same height); only
// the lead breaks it, and it breaks it on purpose.

import { html, raw } from "./utils.js?v=22";
import { renderTopicCard, renderTopicLeadCard } from "./components/topic-card.js?v=7";

// Date buckets, from `ageDays` rather than a real clock. Order matters — a feed
// renders them in this sequence and drops the empty ones. Moved here from
// screens/topics.js when the front page needed the same buckets.
export const GROUPS = [
  { id: "week", label: "This week", holds: (d) => d <= 7 },
  { id: "month", label: "Earlier this month", holds: (d) => d <= 30 },
  { id: "older", label: "Earlier", holds: () => true },
];

export function groupByAge(topics) {
  const out = GROUPS.map((g) => ({ ...g, items: [] }));
  for (const t of topics) {
    const bucket = out.find((g) => g.holds(t.ageDays ?? 0));
    (bucket || out[out.length - 1]).items.push(t);
  }
  return out.filter((g) => g.items.length > 0);
}

// The sections of the paper. Six sources, fixed and known — the case the DS
// guidelines name for a filter-chip list (always-visible toggles over a small
// flat set), where the Playbook facet next to it stays a select because that set
// grows with the account and chips can't survive twenty of them.
//
// A zero-count section is DISABLED rather than hidden, the same rule the selects
// already followed: the row must not reshuffle under the cursor, and a dead
// combination stays unreachable instead of returning an empty feed.
//
// `counts` is computed by the host AGAINST THE OTHER FACET's current selection,
// so a number here never promises rows the Playbook filter would exclude.
export function renderSourceChips(sources, { active = "all", counts = {}, total = 0 } = {}) {
  const chip = (id, label, count, { disabled = false } = {}) =>
    html`<button
      type="button"
      class="ap-filter-chip"
      aria-pressed="${active === id ? "true" : "false"}"
      ${raw(disabled ? "disabled" : "")}
      data-topics-source="${id}"
    >
      <span>${label}</span>
      <span class="ap-filter-chip-count">${String(count)}</span>
    </button>`;

  const rest = sources
    .map((s) => {
      const n = counts[s.id] || 0;
      // Disabled only when it's not the current selection — otherwise clearing a
      // facet you just emptied would be impossible.
      return chip(s.id, s.name, n, { disabled: n === 0 && active !== s.id });
    })
    .join("");

  return html`<div class="topics-sections" role="group" aria-label="Filter by listening source">
    ${raw(chip("all", "All", total))}${raw(rest)}
  </div>`;
}

/**
 * Lead story + grid.
 *
 * @param {object[]} topics      already filtered and sorted newest-first
 * @param {object}   opts
 * @param {Function} opts.resolveSource    (topic) → catalogue source | null
 * @param {Function} opts.resolvePlaybook  (topic) → Playbook name
 * @param {boolean}  opts.grouped          date headings under the lead (/topics)
 *                                         vs. one flat run (the front page,
 *                                         which only ever shows fresh items)
 * @param {number}   opts.limit            cap the grid (0 = no cap)
 */
export function renderMagazine(topics, { resolveSource, resolvePlaybook, grouped = true, limit = 0 } = {}) {
  if (!topics.length) return "";
  const [lead, ...rest] = topics;
  const opts = (t) => ({ source: resolveSource(t), playbookName: resolvePlaybook(t) });
  const tail = limit > 0 ? rest.slice(0, limit) : rest;

  const grid = (items) =>
    html`<div class="topics-grid">${raw(items.map((t) => renderTopicCard(t, opts(t))).join(""))}</div>`;

  const body = grouped
    ? groupByAge(tail)
        .map(
          (g) =>
            html`<section class="topics-group">
              <h2 class="topics-group__label">${g.label}</h2>
              ${raw(grid(g.items))}
            </section>`,
        )
        .join("")
    : tail.length
      ? grid(tail)
      : "";

  return html`${raw(renderTopicLeadCard(lead, opts(lead)))}${raw(body)}`;
}
