// Image Generator — the prompt bar's pickers: DS .ap-select on <details>, with
// the label inside the trigger (.ap-select-inline-label, the repo's toolbar
// convention), option groups, and single or multiple choice (DS checkboxes).
//
// picker({ id, label, value, groups, multi }) → fragment. One delegated click
// on [data-imst-pick] resolves it: data-imst-pick = picker id, data-value = option.

import { html } from "../lib/html.js?v=1307";

/**
 * groups: [{ label?, options: [{ value, label, caption?, disabled?, icon? }] }]
 * value: string (single) | string[] (multi)
 * summary: optional override for the trigger text (e.g. "3 formats")
 */
export function picker({ id, label, value, groups, multi = false, summary, placeholder = "Choose", wide = false }) {
  const selected = new Set(multi ? value : [value]);
  const all = groups.flatMap((g) => g.options);
  const current = all.find((o) => o.value === value);
  const text =
    summary || (multi ? (value.length ? `${value.length} selected` : placeholder) : current?.label || placeholder);
  return html`
    <details
      class="ap-select imst-picker-select${wide ? " imst-picker-select--wide" : ""}"
      data-imst-menu
      data-imst-picker="${id}"
    >
      <summary class="ap-select-trigger" aria-label="${label}: ${text}">
        <span class="ap-select-inline-label">${label}</span>
        <span class="ap-select-value">${text}</span>
        <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
      </summary>
      <div class="ap-select-dropdown" role="listbox" aria-multiselectable="${multi}">
        <div class="ap-select-options">
          ${groups.map(
            (g) => html`
              <div class="ap-select-group">
                ${g.label ? html`<div class="ap-select-group-label">${g.label}</div>` : ""}
                ${g.options.map((o) => {
                  const on = selected.has(o.value);
                  return html`
                    <div
                      class="ap-select-option${on ? " selected" : ""}${o.disabled ? " disabled" : ""}"
                      role="option"
                      tabindex="${o.disabled ? "-1" : "0"}"
                      aria-selected="${on}"
                      aria-disabled="${!!o.disabled}"
                      data-imst-pick="${id}"
                      data-value="${o.value}"
                    >
                      ${multi
                        ? html`<span class="ap-checkbox-container ap-select-option-checkbox" aria-hidden="true"
                            ><input type="checkbox" tabindex="-1" ${on ? "checked" : ""} /><i></i
                          ></span>`
                        : ""}
                      ${o.icon ? html`<i class="${o.icon} ap-select-option-icon" aria-hidden="true"></i>` : ""}
                      <span class="ap-select-option-text">
                        <span class="ap-select-option-title">${o.label}</span>
                        ${o.caption ? html`<span class="ap-select-option-caption">${o.caption}</span>` : ""}
                      </span>
                      ${!multi && on
                        ? html`<i class="ap-icon-check ap-select-option-check" aria-hidden="true"></i>`
                        : ""}
                    </div>
                  `;
                })}
              </div>
            `,
          )}
        </div>
      </div>
    </details>
  `;
}
