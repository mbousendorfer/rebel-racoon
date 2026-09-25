// Image Generator — the attention heatmap overlay (mocked prediction). Hot
// spots are radial gradients; their colours come from CSS (DS red / orange /
// yellow ramps) through stop classes, never from the brand.

import { html, raw } from "../lib/html.js?v=1308";

let seq = 0;

export function heatmapOverlay(spots, format) {
  const id = `imst-heat-${(seq += 1)}`;
  const W = 1000;
  const H = Math.round((1000 * format.height) / format.width);
  return html`<svg class="imst-heat" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id="${id}">
        <stop offset="0" class="imst-heat__stop-hot" />
        <stop offset="0.45" class="imst-heat__stop-warm" />
        <stop offset="1" class="imst-heat__stop-cold" />
      </radialGradient>
    </defs>
    ${raw(
      spots
        .map(
          (s) =>
            `<ellipse cx="${(s.x * W).toFixed(1)}" cy="${(s.y * H).toFixed(1)}" rx="${(s.r * W * 1.4).toFixed(1)}" ry="${(s.r * W * 1.4).toFixed(1)}" fill="url(#${id})" opacity="${(0.35 + s.w * 0.5).toFixed(2)}"/>`,
        )
        .join(""),
    )}
  </svg>`;
}
