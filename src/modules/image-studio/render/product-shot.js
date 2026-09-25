// Image Generator — simple drawn product shots for the demo catalogue and the
// mocked URL extraction. Standalone SVG; brand colours are content.

import { escapeHtml } from "../lib/html.js?v=1225";

const SHAPES = {
  bag: (c) =>
    `<path d="M70 60 h60 l10 120 h-80 z" fill="${c.primary}"/>` +
    `<rect x="70" y="52" width="60" height="14" rx="3" fill="${c.text}"/>` +
    `<rect x="82" y="100" width="36" height="40" rx="4" fill="${c.background}"/>` +
    `<circle cx="100" cy="120" r="9" fill="${c.accent}"/>`,
  kettle: (c) =>
    `<path d="M62 170 q-6 -70 38 -84 q44 14 38 84 z" fill="${c.primary}"/>` +
    `<path d="M136 120 q34 -30 36 -52" stroke="${c.text}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<path d="M70 96 q30 -46 60 0" stroke="${c.text}" stroke-width="7" fill="none"/>` +
    `<ellipse cx="100" cy="86" rx="14" ry="5" fill="${c.accent}"/>`,
  cup: (c) =>
    `<path d="M60 90 h80 l-10 80 h-60 z" fill="${c.primary}"/>` +
    `<path d="M138 104 q26 4 16 30 q-6 14 -22 12" stroke="${c.primary}" stroke-width="8" fill="none"/>` +
    `<ellipse cx="100" cy="90" rx="40" ry="8" fill="${c.text}"/>` +
    `<path d="M88 70 q-8 -14 4 -26 M108 70 q-8 -14 4 -26" stroke="${c.accent}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  card: (c) =>
    `<rect x="36" y="70" width="128" height="80" rx="10" fill="${c.primary}" transform="rotate(-8 100 110)"/>` +
    `<rect x="52" y="92" width="26" height="18" rx="3" fill="${c.accent}" transform="rotate(-8 100 110)"/>` +
    `<rect x="52" y="126" width="80" height="6" rx="3" fill="${c.background}" transform="rotate(-8 100 110)"/>`,
  screen: (c) =>
    `<rect x="30" y="56" width="140" height="92" rx="8" fill="${c.text}"/>` +
    `<rect x="38" y="64" width="124" height="76" rx="4" fill="${c.background}"/>` +
    `<rect x="48" y="104" width="14" height="28" fill="${c.primary}"/><rect x="68" y="92" width="14" height="40" fill="${c.primary}"/>` +
    `<rect x="88" y="80" width="14" height="52" fill="${c.accent}"/><rect x="108" y="96" width="14" height="36" fill="${c.primary}"/>` +
    `<rect x="84" y="148" width="32" height="10" fill="${c.text}"/>`,
  bottle: (c) =>
    `<rect x="84" y="40" width="32" height="22" rx="4" fill="${c.text}"/>` +
    `<path d="M76 62 h48 q10 20 10 40 v70 h-68 v-70 q0 -20 10 -40 z" fill="${c.primary}"/>` +
    `<rect x="74" y="110" width="52" height="34" fill="${c.background}"/>`,
};

export const PRODUCT_SHAPES = Object.freeze(Object.keys(SHAPES));

export function productShotSvg({ shape, colors, label }) {
  const draw = SHAPES[shape] || SHAPES.bag;
  const title = label ? `<title>${escapeHtml(label)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="600" height="600">${title}` +
    `<rect width="200" height="200" fill="${colors.surface || "#F4F4F4"}"/>` +
    `<ellipse cx="100" cy="182" rx="56" ry="7" fill="#000" opacity="0.12"/>` +
    draw(colors) +
    `</svg>`
  );
}
