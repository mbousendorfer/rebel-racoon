// Image Generator — the visual shown where it will live: a feed post, a story,
// or a link card, per network. The network chrome is drawn in DS greys only —
// it's a stand-in for someone else's interface, never the brand's colours.
// Also the safe-zone overlay: the parts of a format a network's UI covers.

import { html } from "../lib/html.js?v=1304";
import { networkById } from "../config/networks.js?v=1304";
import { logoUrl } from "./asset.js?v=1304";

function avatar(brand) {
  const url = logoUrl(brand, "icon");
  return url
    ? html`<img class="imst-mock__avatar" src="${url}" alt="" />`
    : html`<span class="imst-mock__avatar" aria-hidden="true"></span>`;
}

const lines = (n) =>
  html`<span class="imst-mock__lines" aria-hidden="true"
    >${Array.from({ length: n }, () => html`<span></span>`)}</span
  >`;

/**
 * @param {{format, brand, canvas: fragment, caption?: string}} o
 */
export function renderMockup({ format, brand, canvas, caption = "" }) {
  const n = networkById(format.network);
  const handle = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const head = html`<header class="imst-mock__head">
    ${avatar(brand)}<span class="imst-mock__who"
      ><span class="ap-body-bold">${n.id === "x" ? brand.name : handle}</span
      ><span class="ap-caption">${n.id === "linkedin" ? "Sponsored" : "Just now"}</span></span
    ><i class="${n.icon} imst-mock__network" aria-label="${n.label}"></i>
  </header>`;
  if (format.mockup === "story") {
    return html`
      <figure class="imst-mock imst-mock--story" aria-label="${n.label} ${format.label} preview">
        <div class="imst-mock__phone">
          ${canvas}
          <div class="imst-mock__story-top">
            <span class="imst-mock__progress"><span></span></span>${head}
          </div>
          <div class="imst-mock__story-bottom"><span class="imst-mock__reply">Send message</span></div>
        </div>
        <figcaption class="ap-caption">${n.label} · ${format.label}</figcaption>
      </figure>
    `;
  }
  if (format.mockup === "link") {
    return html`
      <figure class="imst-mock imst-mock--feed" aria-label="${n.label} ${format.label} preview">
        <div class="imst-mock__card">
          ${head} ${caption ? html`<p class="ap-body imst-mock__caption">${caption}</p>` : lines(2)}
          <div class="imst-mock__link">
            ${canvas}
            <div class="imst-mock__link-meta">
              <span class="ap-caption"
                >${(brand.websiteUrl || "yourbrand.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}</span
              ><span class="ap-body-bold">${brand.name}</span>
            </div>
          </div>
          <footer class="imst-mock__actions" aria-hidden="true">${lines(1)}</footer>
        </div>
        <figcaption class="ap-caption">${n.label} · ${format.label}</figcaption>
      </figure>
    `;
  }
  return html`
    <figure class="imst-mock imst-mock--feed" aria-label="${n.label} ${format.label} preview">
      <div class="imst-mock__card">
        ${head}
        ${n.id === "linkedin" || n.id === "facebook" || n.id === "x"
          ? caption
            ? html`<p class="ap-body imst-mock__caption">${caption}</p>`
            : lines(2)
          : ""}
        ${canvas}
        <footer class="imst-mock__actions" aria-hidden="true">
          <i class="ap-icon-heart"></i><i class="ap-icon-single-chat-bubble"></i><i class="ap-icon-share"></i>
        </footer>
        ${n.id === "instagram"
          ? caption
            ? html`<p class="ap-body imst-mock__caption"><strong>${handle}</strong> ${caption}</p>`
            : lines(2)
          : ""}
      </div>
      <figcaption class="ap-caption">${n.label} · ${format.label}</figcaption>
    </figure>
  `;
}

/** Hatched bands over the parts of the format the network's interface covers. */
export function safeZoneOverlay(format) {
  const z = format.safeZone;
  const n = networkById(format.network);
  const band = (style, where) =>
    html`<span class="imst-safe__band" style="${style}" title="Covered by ${n.label}'s ${where}"></span>`;
  const any = z.top || z.bottom || z.left || z.right;
  return html`
    <div class="imst-safe" aria-hidden="true">
      ${z.top ? band(`top:0;left:0;right:0;height:${z.top * 100}%`, "top bar") : ""}
      ${z.bottom ? band(`bottom:0;left:0;right:0;height:${z.bottom * 100}%`, "bottom bar") : ""}
      ${z.left ? band(`top:${z.top * 100}%;bottom:${z.bottom * 100}%;left:0;width:${z.left * 100}%`, "edge") : ""}
      ${z.right ? band(`top:${z.top * 100}%;bottom:${z.bottom * 100}%;right:0;width:${z.right * 100}%`, "edge") : ""}
      <span
        class="imst-safe__frame"
        style="top:${z.top * 100}%;bottom:${z.bottom * 100}%;left:${z.left * 100}%;right:${z.right * 100}%"
      ></span>
      ${any ? "" : html`<span class="imst-safe__none ap-caption">${n.label} shows this format whole</span>`}
    </div>
  `;
}
