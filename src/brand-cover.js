// The two things a Playbook's card and its fiche header must say the same way:
// the palette cover and the voice as a sentence. One module, two hosts
// (home/lists.js, playbook-view.js), so the card and the fiche can't drift.

import { escapeAttr } from "./utils.js?v=2743";

// The analysed site's primary / accent / link, deduplicated, up to three.
function paletteOf(ctx) {
  const site = ctx?.imageVoice?.websites?.[0];
  return site
    ? [site.colors?.primary, site.colors?.accent, site.colors?.link].filter((c, i, arr) => c && arr.indexOf(c) === i)
    : [];
}

// A Playbook's own colour (the dot the rail shows beside its chats) as a DS
// token. « blue » takes the soft blue, like the dot: electric blue is the
// interactive colour (CH-04).
const OWN_COLOR = {
  orange: "orange",
  blue: "soft-blue",
  green: "green",
  purple: "purple",
  red: "red",
  yellow: "yellow",
};

// The cover: the palette as flat bands (60 / 25 / 15, or 70 / 30 for two
// colours), as an inline ` style="--cover: …"` the host's CSS paints. A field,
// not a strip: it overrules PB-01 (2026-11-02, the user's call). No palette →
// the Playbook's own colour, light (-20); no colour either → "" and the host's
// CSS falls back to grey-05.
export function brandCoverStyle(ctx) {
  const colors = paletteOf(ctx);
  if (!colors.length) {
    const own = OWN_COLOR[ctx?.color];
    return own ? ` style="--cover: var(--ref-color-${own}-20);"` : "";
  }
  const stops = colors.length === 3 ? [0, 60, 85, 100] : colors.length === 2 ? [0, 70, 100] : [0, 100];
  return ` style="--cover: linear-gradient(90deg, ${colors
    .map((c, i) => `${escapeAttr(c)} ${stops[i]}% ${stops[i + 1]}%`)
    .join(", ")});"`;
}

// The voice reads as a sentence, not a tag: "Direct, operator-first, specific."
export function voiceSentence(ctx) {
  const headline =
    ctx?.voiceProfile?.headline ||
    (Array.isArray(ctx?.tones) && ctx.tones.length ? ctx.tones.join(" · ").toLowerCase() : "");
  if (!headline) return "";
  return (
    headline
      .split(/\s*·\s*/)
      .filter(Boolean)
      .join(", ")
      .replace(/^./, (c) => c.toUpperCase()) + "."
  );
}
