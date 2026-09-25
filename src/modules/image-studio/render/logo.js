// Image Generator — procedural logos for the demo brands and the mocked brand
// analysis. Returns standalone SVG markup (brand colours are CONTENT here).

import { escapeHtml } from "../lib/html.js?v=1225";

const MARKS = {
  bean: (c) =>
    `<ellipse cx="32" cy="32" rx="18" ry="24" transform="rotate(28 32 32)" fill="${c}"/>` +
    `<path d="M24 12 C 40 24, 24 40, 40 52" stroke="__BG__" stroke-width="4" fill="none" stroke-linecap="round" transform="rotate(28 32 32)"/>`,
  ledger: (c) =>
    `<rect x="10" y="10" width="44" height="44" rx="12" fill="${c}"/>` +
    `<rect x="20" y="34" width="6" height="12" rx="2" fill="__BG__"/>` +
    `<rect x="29" y="26" width="6" height="20" rx="2" fill="__BG__"/>` +
    `<rect x="38" y="18" width="6" height="28" rx="2" fill="__BG__"/>`,
  circle: (c, initial) =>
    `<circle cx="32" cy="32" r="24" fill="${c}"/>` +
    `<text x="32" y="41" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="__BG__">${initial}</text>`,
  hex: (c, initial) =>
    `<polygon points="32,6 55,19 55,45 32,58 9,45 9,19" fill="${c}"/>` +
    `<text x="32" y="41" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" fill="__BG__">${initial}</text>`,
  wave: (c) =>
    `<rect x="8" y="8" width="48" height="48" rx="24" fill="${c}"/>` +
    `<path d="M16 36 q8 -10 16 0 t16 0" stroke="__BG__" stroke-width="5" fill="none" stroke-linecap="round"/>`,
};

export const LOGO_MARKS = Object.freeze(Object.keys(MARKS));

/**
 * @param {{name:string, mark?:string, variant:"color"|"white"|"black"|"icon",
 *          primary:string, text:string, background:string, font?:string}} spec
 */
export function logoSvg(spec) {
  const { name, variant } = spec;
  const mark = MARKS[spec.mark] || MARKS.circle;
  const initial = escapeHtml((name || "?").trim().charAt(0).toUpperCase());
  const ink = variant === "white" ? "#FFFFFF" : variant === "black" ? "#111111" : spec.primary;
  const word = variant === "white" ? "#FFFFFF" : variant === "black" ? "#111111" : spec.text;
  const knock = variant === "white" ? spec.primary : variant === "black" ? "#FFFFFF" : spec.background;
  const markSvg = mark(ink, initial).replaceAll("__BG__", knock);
  if (variant === "icon") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${markSvg}</svg>`;
  }
  const font = escapeHtml(spec.font || "Helvetica, Arial, sans-serif");
  const label = escapeHtml(name);
  const width = Math.round(84 + label.length * 15);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 64" width="${width}" height="64">` +
    markSvg +
    `<text x="74" y="41" font-family="${font}" font-size="26" font-weight="700" fill="${word}">${label}</text>` +
    `</svg>`
  );
}
