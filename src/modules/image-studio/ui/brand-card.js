// Image Generator — the active brand, as the generator will apply it: logo,
// palette with roles, fonts, moods. Read-only here; the pen goes to the
// Playbook page, where the brand is edited.

import { html } from "../lib/html.js?v=1301";
import { swatch } from "./swatch.js?v=1301";
import { logoUrl } from "./asset.js?v=1301";
import { canEditBrand, playbookPath } from "../state/store.js?v=1301";

const ROLE = { primary: "Primary", secondary: "Secondary", accent: "Accent", background: "Background", text: "Text" };

/** What's missing for images to really follow the brand — named, never a bare count. */
export function brandGaps(brand) {
  const gaps = [];
  if (!brand.logos.length) gaps.push("a logo");
  if (brand.palette.length < 2) gaps.push("colours");
  if (!brand.fonts.length) gaps.push("fonts");
  return gaps;
}

export function renderBrandCard(brand, { compact = false } = {}) {
  const logo = logoUrl(brand, "color");
  const editable = canEditBrand(brand.id);
  const gaps = brandGaps(brand);
  const heading = brand.fonts.find((f) => f.role === "heading")?.family;
  const body = brand.fonts.find((f) => f.role === "body")?.family;
  return html`
    <section
      class="ap-card imst-brand${compact ? " imst-brand--compact" : ""}"
      aria-label="Brand applied to every image"
    >
      <div class="imst-brand__logo">
        ${logo
          ? html`<img src="${logo}" alt="${brand.name} logo" />`
          : html`<i class="ap-icon-image ap-icon-xl" aria-hidden="true"></i>`}
      </div>
      <div class="imst-brand__body">
        <div class="imst-brand__title">
          <h2 class="ap-subtitle">${brand.name}</h2>
          <span class="ap-caption">Every image follows this Playbook's brand</span>
        </div>
        <dl class="imst-brand__facts">
          <div>
            <dt class="ap-caption">Colours</dt>
            <dd>
              ${brand.palette.length
                ? html`<span class="imst-palette"
                    >${brand.palette.map((c) =>
                      swatch(c.hex, { label: [c.name, ROLE[c.role]].filter(Boolean).join(" · ") }),
                    )}</span
                  >`
                : html`<span class="ap-body">Not set</span>`}
            </dd>
          </div>
          <div>
            <dt class="ap-caption">Fonts</dt>
            <dd class="ap-body">
              ${heading || body
                ? [heading && `Headings: ${heading}`, body && `Body: ${body}`].filter(Boolean).join(" · ")
                : "Not set"}
            </dd>
          </div>
          ${brand.imageStyle.moods.length
            ? html`<div>
                <dt class="ap-caption">Moods</dt>
                <dd class="ap-tag-list">
                  ${brand.imageStyle.moods.map((m) => html`<span class="ap-tag grey"><span>${m}</span></span>`)}
                </dd>
              </div>`
            : ""}
        </dl>
      </div>
      <button type="button" class="ap-link imst-brand__edit" data-imst-nav="${playbookPath(brand.id)}">
        <i class="${editable ? "ap-icon-pen" : "ap-icon-eye-on"}" aria-hidden="true"></i>
        <span>${editable ? "Edit in the Playbook" : "View the Playbook"}</span>
      </button>
    </section>
    ${gaps.length
      ? html`<div class="ap-infobox warning">
          <i class="ap-icon-warning_fill" aria-hidden="true"></i>
          <div class="ap-infobox-content">
            <div class="ap-infobox-texts">
              <div class="ap-infobox-message">
                This Playbook has no ${gaps.join(", ").replace(/, ([^,]*)$/, " or $1")} yet, so I'll improvise them. Add
                them in the Playbook to keep every image on-brand.
              </div>
            </div>
          </div>
        </div>`
      : ""}
  `;
}
