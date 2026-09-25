// Image Generator — every output format, per network. The single source for sizes,
// ratios, safe zones and the in-context mockup a format is previewed in.
//
// safeZone: fractions of the canvas each network's own interface covers
// (top / right / bottom / left). Content there may be hidden in the feed.
// layout: the recomposition archetype "Adapt everywhere" uses for this shape —
// square · portrait · tall · wide. Never a crop: each archetype re-places the
// text block and the logo and extends the background.

const f = (id, network, label, width, height, layout, safeZone, mockup, note = "") =>
  Object.freeze({ id, network, label, width, height, layout, safeZone: Object.freeze(safeZone), mockup, note });

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

export const FORMATS = Object.freeze([
  f("ig-post", "instagram", "Post", 1080, 1080, "square", { top: 0, right: 0, bottom: 0, left: 0 }, "feed"),
  f(
    "ig-portrait",
    "instagram",
    "Portrait 4:5",
    1080,
    1350,
    "portrait",
    { top: 0, right: 0, bottom: 0, left: 0 },
    "feed",
    "The profile grid shows the centre 3:4.",
  ),
  f(
    "ig-story",
    "instagram",
    "Story / Reel",
    1080,
    1920,
    "tall",
    { top: 0.13, right: 0.06, bottom: 0.18, left: 0.06 },
    "story",
    "Top: profile bar. Bottom: reply field and actions.",
  ),
  f("fb-square", "facebook", "Post", 1080, 1080, "square", NONE, "feed"),
  f("fb-link", "facebook", "Link", 1200, 630, "wide", NONE, "link", "Title and domain sit under the image."),
  f(
    "fb-story",
    "facebook",
    "Story",
    1080,
    1920,
    "tall",
    { top: 0.12, right: 0.06, bottom: 0.2, left: 0.06 },
    "story",
    "Top: profile bar. Bottom: reply field.",
  ),
  f("x-landscape", "x", "Landscape 16:9", 1600, 900, "wide", NONE, "feed"),
  f("x-square", "x", "Square", 1080, 1080, "square", { top: 0, right: 0, bottom: 0, left: 0 }, "feed"),
  f("li-link", "linkedin", "Link", 1200, 627, "wide", NONE, "link", "Title and domain sit under the image."),
  f("li-square", "linkedin", "Square", 1080, 1080, "square", NONE, "feed"),
  f("li-portrait", "linkedin", "Portrait 4:5", 1080, 1350, "portrait", NONE, "feed"),
]);

export const DEFAULT_FORMAT_ID = "ig-post";

export function formatById(id) {
  return FORMATS.find((format) => format.id === id) || null;
}

export function formatsForNetwork(networkId) {
  return FORMATS.filter((format) => format.network === networkId);
}

/** "1080 × 1350" */
export function formatSize(format) {
  return `${format.width} × ${format.height}`;
}

/** "4:5" — reduced ratio, or the conventional name when it isn't a small integer pair. */
export function formatRatio(format) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const d = gcd(format.width, format.height);
  const w = format.width / d;
  const h = format.height / d;
  if (w > 40 || h > 40) return (format.width / format.height).toFixed(2) + ":1";
  return `${w}:${h}`;
}
