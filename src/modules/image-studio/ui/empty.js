// Image Generator — empty state. The DS ships no empty-state class; this is the
// composition Archie's own renderEmptyState uses (icon · subtitle · body · one
// hug-width primary blue CTA), rewritten here so the module imports nothing.

import { html } from "../lib/html.js?v=1235";

export function renderEmpty({ icon, title, body, action }) {
  return html`
    <div class="imst-empty">
      <span class="imst-empty__icon" aria-hidden="true"><i class="${icon} ap-icon-xl"></i></span>
      <h2 class="ap-subtitle imst-empty__title">${title}</h2>
      ${body ? html`<p class="ap-body imst-empty__body">${body}</p>` : ""} ${action || ""}
    </div>
  `;
}
