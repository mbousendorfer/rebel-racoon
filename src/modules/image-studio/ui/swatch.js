// Image Generator — colour swatches. The DS ships none: a square with the
// hairline border, the brand colour as its fill (content, not chrome), the hex
// in a tooltip and in the accessible name.

import { html, raw } from "../lib/html.js?v=1227";

export function swatch(hex, { label, size = "md", attrs = "" } = {}) {
  const name = label ? `${label} ${hex}` : hex;
  return html`<span
    class="imst-swatch imst-swatch--${size}"
    style="--imst-swatch: ${hex}"
    role="img"
    aria-label="${name}"
    data-tooltip="${name}"
    ${raw(attrs)}
  ></span>`;
}

export function paletteStrip(palette, { size = "sm" } = {}) {
  return html`<span class="imst-palette">${palette.map((c) => swatch(c.hex, { label: c.name, size }))}</span>`;
}
