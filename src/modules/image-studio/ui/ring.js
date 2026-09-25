// Image Generator — a score ring on the app's .app-ring port (ds-patches):
// the tier class picks the colour, the label ALWAYS names the metric.

import { html } from "../lib/html.js?v=1308";

export function scoreRing(score, { name, size = 56, stroke = 6 }) {
  const tier = score >= 80 ? "on-track" : score >= 60 ? "at-risk" : "off-track";
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return html`<svg
    class="app-ring app-ring--${tier}"
    width="${size}"
    height="${size}"
    viewBox="0 0 ${size} ${size}"
    role="img"
    aria-label="${name}: ${score} out of 100"
  >
    <circle class="app-ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" />
    <circle
      class="app-ring__arc"
      cx="${size / 2}"
      cy="${size / 2}"
      r="${r}"
      fill="none"
      stroke-width="${stroke}"
      stroke-linecap="round"
      stroke-dasharray="${((c * score) / 100).toFixed(2)} ${c.toFixed(2)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"
    />
    <text
      class="app-ring__label"
      x="50%"
      y="50%"
      dy="0.36em"
      text-anchor="middle"
      font-size="${Math.round(size * 0.3)}"
      font-weight="700"
    >
      ${score}
    </text>
  </svg>`;
}
