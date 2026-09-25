// Image Generator — how the mocked AI behaves. The only knobs of the fake backend.

export const MOCK = Object.freeze({
  generation: {
    delayMs: [2000, 4000],
    variations: 4,
    // Share of generations that fail with "Generation failed — try again".
    failRate: 0.1,
    // A brief containing this word always fails — to demo the error state on cue.
    failKeyword: "#fail",
  },
  analysis: {
    stepMs: [700, 1300],
  },
  copy: {
    delayMs: [600, 1200],
  },
});
