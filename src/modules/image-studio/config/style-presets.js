// Image Generator — the system style presets.
//
// promptTemplate is the fragment sent to the image model. Placeholders:
//   {subject} the brief · {palette} the brand's colours by role · {mood} the brand's moods
// supportsEmbeddedText: whether the style can carry text written BY the model
// (the "Built into the image" text mode). Photo and 3D styles can't render
// type reliably, so they only offer the editable text layer.
// render: which local generator draws the mock (render/generators.js) and its
// variant — the mock has to LOOK like its preset, so a 3D render must never
// resemble a hand drawing. family is the generator's key, nothing more.
//
// The six styles of the Image Studio as it was until 2026-10-07 (Tech Minimal …
// Hand-drawn). The 22 that replaced them, in five families, were too many to
// choose from: back to six (2026-10-08), each drawn with the closest generator.

const p = (id, family, variant, label, description, promptTemplate, supportsEmbeddedText) =>
  Object.freeze({
    id,
    brandId: null,
    kind: "preset",
    family,
    label,
    description,
    promptTemplate,
    supportsEmbeddedText,
    render: Object.freeze({ generator: family, variant }),
  });

export const STYLE_PRESETS = Object.freeze([
  p(
    "preset-tech-minimal",
    "trend",
    "swiss",
    "Tech Minimal",
    "Near-white, hairlines, a faint grid, lots of air.",
    "Minimal tech visual of {subject}, near-white field, hairline strokes, faint grid, generous negative space, accents in {palette}",
    true,
  ),
  p(
    "preset-corporate",
    "illustration",
    "flat",
    "Corporate",
    "Clean and professional, tidy shapes, a clear title.",
    "Clean corporate visual of {subject}, flat vector shapes, tidy layout, professional and trustworthy, palette {palette}, {mood}",
    true,
  ),
  p(
    "preset-3d-render",
    "3d",
    "glossy",
    "3D Render",
    "Glossy forms, soft light, a contact shadow.",
    "3D render of {subject}, glossy materials, soft studio light, contact shadow on a lit floor, palette {palette}",
    false,
  ),
  p(
    "preset-bold-editorial",
    "illustration",
    "editorial",
    "Bold Editorial",
    "A hard diagonal, heavy type, strong contrast.",
    "Bold editorial visual of {subject}, magazine cover energy, hard diagonal composition, heavy type blocks, strong contrast, palette {palette}, {mood}",
    true,
  ),
  p(
    "preset-photoreal",
    "photo",
    "lifestyle",
    "Photoreal",
    "A real photograph: natural light, true detail.",
    "Photorealistic image of {subject}, natural light, true-to-life detail, shallow depth of field, colour grade toward {palette}, {mood}",
    false,
  ),
  p(
    "preset-hand-drawn",
    "illustration",
    "line-art",
    "Hand-drawn",
    "Ink on paper, every stroke by hand.",
    "Hand-drawn ink illustration of {subject}, loose imperfect strokes, paper texture, ink in {palette}",
    true,
  ),
]);

export function presetById(id) {
  return STYLE_PRESETS.find((preset) => preset.id === id) || null;
}

// Six images at most: past that, references start to disagree (2026-10-02).
export const CUSTOM_STYLE_LIMITS = Object.freeze({ images: 6, presets: 5 });

// The presets offered first when the brand has few styles of its own: all six.
// The studio's quick picks and the chat's style question both start from these.
export const QUICK_PRESETS = Object.freeze(STYLE_PRESETS.map((preset) => preset.id));
