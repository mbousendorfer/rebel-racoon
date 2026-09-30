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

/**
 * The five SHAPES the generator offers — what a person picks is a shape, not
 * one of eleven network formats. Each maps to the format the image is made in
 * first (the master); "Adapt everywhere" in the editor makes the others.
 * `networks` lists who uses that shape, shown as icons under it.
 */
const FORMAT_SHAPES = Object.freeze([
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    formatId: "ig-post",
    w: 1,
    h: 1,
    networks: ["instagram", "facebook", "x", "linkedin"],
  },
  {
    id: "portrait",
    label: "Portrait",
    ratio: "4:5",
    formatId: "ig-portrait",
    w: 4,
    h: 5,
    networks: ["instagram", "linkedin"],
  },
  {
    id: "story",
    label: "Story",
    ratio: "9:16",
    formatId: "ig-story",
    w: 9,
    h: 16,
    networks: ["instagram", "facebook"],
  },
  { id: "landscape", label: "Landscape", ratio: "16:9", formatId: "x-landscape", w: 16, h: 9, networks: ["x"] },
  {
    id: "link",
    label: "Link",
    ratio: "1.91:1",
    formatId: "li-link",
    w: 1.91,
    h: 1,
    networks: ["linkedin", "facebook"],
  },
]);

export function shapeForFormat(formatId) {
  const f = formatById(formatId);
  if (!f) return FORMAT_SHAPES[0];
  return (
    FORMAT_SHAPES.find((s) => s.formatId === formatId) ||
    FORMAT_SHAPES.find(
      (s) =>
        s.id ===
        { square: "square", portrait: "portrait", tall: "story", wide: f.mockup === "link" ? "link" : "landscape" }[
          f.layout
        ],
    ) ||
    FORMAT_SHAPES[0]
  );
}

/** Network ids as Archie's drafts name them → this module's. */
export const DRAFT_NETWORK = Object.freeze({
  linkedin: "linkedin",
  twitter: "x",
  x: "x",
  instagram: "instagram",
  facebook: "facebook",
});

/**
 * The shapes a network publishes, each pointing at THAT network's format.
 * With no network, every shape with its default format.
 */
export function shapesFor(network) {
  if (!network) return FORMAT_SHAPES;
  const byShape = {
    square: (f) => f.layout === "square",
    portrait: (f) => f.layout === "portrait",
    story: (f) => f.layout === "tall",
    landscape: (f) => f.layout === "wide" && f.mockup !== "link",
    link: (f) => f.mockup === "link",
  };
  return FORMAT_SHAPES.map((s) => {
    const f = FORMATS.find((x) => x.network === network && byShape[s.id](x));
    return f ? { ...s, formatId: f.id, networks: [network] } : null;
  }).filter(Boolean);
}
