// Image Generator — the colours a render uses, resolved from the brand's roles.
// Brand colours are CONTENT: they go into generated visuals only, never into
// the UI chrome. A brand with no palette renders in a neutral set rather than
// failing, and says so elsewhere (the brand card's gap notice).

const NEUTRAL = {
  primary: "#2E3A59",
  secondary: "#6B7A99",
  accent: "#F2994A",
  background: "#F4F5F8",
  text: "#1B2233",
};

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128];
}

function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

/** Mixes a toward b by t (0..1). */
export function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

export const lighten = (hex, t) => mix(hex, "#FFFFFF", t);
export const darken = (hex, t) => mix(hex, "#000000", t);

/** Relative luminance (WCAG). */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** The ink that reads on `bg`: the brand's text colour if it contrasts, else white or near-black. */
export function inkOn(bg, preferred) {
  if (preferred && contrast(bg, preferred) >= 4.5) return preferred;
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#111111") ? "#FFFFFF" : "#111111";
}

/**
 * { primary, secondary, accent, background, text, all[] } from a brand view.
 * Missing roles are filled from the palette's other colours, then the neutral set.
 * `tint` (optional hex list, e.g. a custom style's reference colours) is blended in by `tintWeight`.
 */
export function resolvePalette(brand, { tint = [], tintWeight = 0 } = {}) {
  const colors = brand?.palette || [];
  const byRole = (role) => colors.find((c) => c.role === role)?.hex;
  const loose = colors.map((c) => c.hex);
  const pick = (role, i) => byRole(role) || loose[i] || NEUTRAL[role];
  const p = {
    primary: pick("primary", 0),
    secondary: pick("secondary", 1),
    accent: pick("accent", 2),
    background: byRole("background") || NEUTRAL.background,
    text: byRole("text") || NEUTRAL.text,
  };
  if (tint.length && tintWeight > 0) {
    p.secondary = mix(p.secondary, tint[0], tintWeight);
    if (tint[1]) p.accent = mix(p.accent, tint[1], tintWeight);
    if (tint[2]) p.background = mix(p.background, lighten(tint[2], 0.7), tintWeight * 0.6);
  }
  p.all = [p.primary, p.secondary, p.accent];
  return p;
}
