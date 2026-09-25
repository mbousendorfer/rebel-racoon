// Image Generator — the page frame every section renders inside: the section
// tabs (Generate · Campaigns · Brands) and the body. Deep pages (a brand, the
// style creator, the editor) swap the tabs for a back link to their section.

import { html } from "../lib/html.js?v=1225";

export const SECTIONS = Object.freeze([
  // Generating is the product; campaigns are what you generated, brands are the
  // settings that keep every image on-brand. Hence the order.
  { id: "create", path: "/image-generator", icon: "ap-icon-sparkles", label: "Generate" },
  { id: "campaigns", path: "/image-generator/campaigns", icon: "ap-icon-calendar", label: "Campaigns" },
  { id: "brands", path: "/image-generator/brands", icon: "ap-icon-image", label: "Brands" },
]);

function renderTabs(active) {
  return html`
    <div class="ap-tabs">
      <div class="ap-tabs-nav" role="tablist" aria-label="Image Generator sections">
        ${SECTIONS.map(
          (s) => html`
            <button
              type="button"
              class="ap-tabs-tab${s.id === active ? " active" : ""}"
              role="tab"
              aria-selected="${s.id === active ? "true" : "false"}"
              data-imst-nav="${s.path}"
            >
              <i class="${s.icon}" aria-hidden="true"></i>
              <span>${s.label}</span>
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

/**
 * @param {{section?:string, back?:{path:string,label:string}, aside?:object, body:object}} opts
 *   aside: a fragment on the right of the bar (the brand switcher).
 */
export function renderFrame({ section, back, aside, body }) {
  const bar = back
    ? html`<button type="button" class="ap-link imst-back" data-imst-nav="${back.path}">
        <i class="ap-icon-arrow-left" aria-hidden="true"></i><span>${back.label}</span>
      </button>`
    : renderTabs(section);
  return html`
    <section class="imst" data-imst-root>
      <div class="imst-page">
        <div class="imst-bar${back ? " imst-bar--back" : ""}">
          <div class="imst-bar__main">${bar}</div>
          ${aside ? html`<div class="imst-bar__aside">${aside}</div>` : ""}
        </div>
        <div class="imst-body">${body}</div>
      </div>
    </section>
  `;
}
