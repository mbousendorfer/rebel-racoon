// Image Generator — the system style presets, grouped by family.
//
// promptTemplate is the fragment sent to the image model. Placeholders:
//   {subject} the brief · {palette} the brand's colours by role · {mood} the brand's moods
// supportsEmbeddedText: whether the style can carry text written BY the model
// (the "Built into the image" text mode). Photo and 3D styles can't render
// type reliably, so they only offer the editable text layer.
// render: which local generator draws the mock (render/generators.js) and its
// variant — the mock has to LOOK like its preset, so a clay render must never
// resemble an infographic.

export const STYLE_FAMILIES = Object.freeze([
  { id: "illustration", label: "Illustration" },
  { id: "3d", label: "3D" },
  { id: "photo", label: "Photo" },
  { id: "graphic", label: "Graphic" },
  { id: "trend", label: "Trends" },
]);

const p = (id, family, label, description, promptTemplate, supportsEmbeddedText) =>
  Object.freeze({
    id,
    brandId: null,
    kind: "preset",
    family,
    label,
    description,
    promptTemplate,
    supportsEmbeddedText,
    render: Object.freeze({ generator: family, variant: id.replace(/^preset-/, "") }),
  });

export const STYLE_PRESETS = Object.freeze([
  // ── Illustration ──
  p(
    "preset-flat",
    "illustration",
    "Flat",
    "Solid shapes, no gradients, a clear silhouette.",
    "Flat vector illustration of {subject}, solid colour shapes, no gradients, crisp silhouettes, palette {palette}, {mood}",
    true,
  ),
  p(
    "preset-line-art",
    "illustration",
    "Line art",
    "One confident stroke weight on a quiet ground.",
    "Minimal line-art drawing of {subject}, single stroke weight, generous negative space, ink in {palette}",
    true,
  ),
  p(
    "preset-editorial",
    "illustration",
    "Editorial",
    "Magazine-style, conceptual, textured grain.",
    "Conceptual editorial illustration of {subject}, magazine cover feel, subtle grain texture, palette {palette}, {mood}",
    true,
  ),
  p(
    "preset-watercolor",
    "illustration",
    "Watercolor",
    "Soft washes and bleeding edges on paper.",
    "Loose watercolor painting of {subject}, soft washes, paper texture, bleeding edges, tones of {palette}",
    false,
  ),
  p(
    "preset-isometric",
    "illustration",
    "Isometric",
    "A small world at 30°, tidy and explanatory.",
    "Isometric illustration of {subject}, 30 degree axonometric view, clean geometry, palette {palette}",
    false,
  ),
  // ── 3D ──
  p(
    "preset-clay",
    "3d",
    "Clay",
    "Soft matte clay forms, rounded and playful.",
    "3D clay render of {subject}, soft matte plasticine, rounded forms, studio softbox light, pastel variants of {palette}",
    false,
  ),
  p(
    "preset-glossy",
    "3d",
    "Glossy product",
    "Polished hero render with sharp reflections.",
    "Glossy 3D product render of {subject}, polished surfaces, sharp specular highlights, gradient backdrop in {palette}",
    false,
  ),
  p(
    "preset-low-poly",
    "3d",
    "Low-poly",
    "Faceted geometry, flat-shaded triangles.",
    "Low-poly 3D scene of {subject}, faceted flat-shaded triangles, simple lighting, palette {palette}",
    false,
  ),
  p(
    "preset-toy",
    "3d",
    "Toy-like",
    "Vinyl-toy proportions, bright and chunky.",
    "Toy-like 3D render of {subject}, vinyl collectible proportions, chunky shapes, bright {palette}",
    false,
  ),
  // ── Photo ──
  p(
    "preset-lifestyle",
    "photo",
    "Lifestyle",
    "Real moments, natural light, shallow depth.",
    "Lifestyle photograph of {subject}, natural window light, candid moment, shallow depth of field, colour grade toward {palette}, {mood}",
    false,
  ),
  p(
    "preset-packshot",
    "photo",
    "Packshot",
    "The product alone on a clean studio sweep.",
    "Studio packshot of {subject}, seamless backdrop, soft shadow, e-commerce clarity, backdrop in {palette}",
    false,
  ),
  p(
    "preset-flat-lay",
    "photo",
    "Flat lay",
    "Shot from above, objects arranged on a surface.",
    "Overhead flat-lay photograph of {subject}, objects neatly arranged, top-down, surface tinted {palette}",
    false,
  ),
  p(
    "preset-cinematic",
    "photo",
    "Cinematic",
    "Wide, moody, graded like a film still.",
    "Cinematic film still of {subject}, anamorphic framing, moody contrast, teal-and-warm grade shifted to {palette}, {mood}",
    false,
  ),
  // ── Graphic ──
  p(
    "preset-infographic",
    "graphic",
    "Infographic",
    "Data made visual: bars, icons, a clear scale.",
    "Clean infographic about {subject}, simple charts and icons, grid layout, brand palette {palette}",
    true,
  ),
  p(
    "preset-big-number",
    "graphic",
    "Big number",
    "One figure, huge, with a short line under it.",
    "Bold typographic poster built around one large number about {subject}, strong contrast, palette {palette}",
    true,
  ),
  p(
    "preset-quote",
    "graphic",
    "Typographic quote",
    "A quote as the image, set with care.",
    "Typographic quote card about {subject}, elegant type hierarchy, generous margins, palette {palette}",
    true,
  ),
  p(
    "preset-before-after",
    "graphic",
    "Before / after",
    "A split frame that shows the change.",
    "Split-screen before and after comparison of {subject}, clear divider, labelled halves, palette {palette}",
    true,
  ),
  // ── Trends ──
  p(
    "preset-collage",
    "trend",
    "Collage",
    "Cut-out paper, torn edges, layered scraps.",
    "Mixed-media paper collage of {subject}, torn edges, layered cut-outs, halftone scraps, palette {palette}",
    false,
  ),
  p(
    "preset-neo-brutalism",
    "trend",
    "Neo-brutalism",
    "Thick outlines, hard shadows, loud blocks.",
    "Neo-brutalist graphic of {subject}, thick black outlines, hard offset shadows, flat loud colour blocks from {palette}",
    true,
  ),
  p(
    "preset-gradient",
    "trend",
    "Abstract gradient",
    "Soft mesh gradients and blurred orbs.",
    "Abstract mesh gradient evoking {subject}, blurred luminous orbs, smooth transitions across {palette}",
    false,
  ),
  p(
    "preset-retro",
    "trend",
    "Retro",
    "70s sunbursts, warm stripes, rounded type.",
    "Retro 1970s poster of {subject}, sunburst stripes, warm faded print, rounded display type, palette {palette}",
    true,
  ),
  p(
    "preset-swiss",
    "trend",
    "Swiss minimal",
    "A strict grid, one shape, lots of air.",
    "Swiss minimal poster about {subject}, strict grid, asymmetric composition, one geometric shape, palette {palette}",
    true,
  ),
]);

export function presetById(id) {
  return STYLE_PRESETS.find((preset) => preset.id === id) || null;
}

export function presetsByFamily(familyId) {
  return STYLE_PRESETS.filter((preset) => preset.family === familyId);
}

/** Neutral subjects for a custom style's test run (the brief asks for 3). */
export const STYLE_TEST_SUBJECTS = Object.freeze([
  { id: "object", label: "An everyday object" },
  { id: "person", label: "A person at work" },
  { id: "place", label: "A place" },
]);

export const CUSTOM_STYLE_LIMITS = Object.freeze({ images: 10, presets: 5 });
