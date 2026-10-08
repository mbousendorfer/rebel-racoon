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
  copy: {
    delayMs: [600, 1200],
  },
  // "Suggest from the post": as slow as the real app's call (4–8 s), so the
  // waiting state is designed for the wait people will actually have.
  suggest: {
    delayMs: [4000, 8000],
  },
  // What a draft's "Generate an image" returns: detailed stock photos (Unsplash),
  // cropped to the chosen shape — rich enough to see the loader's arrival, where
  // the flat style renders showed little (2026-10-08). The studio still draws its
  // style renders. Every id checked to resolve, with CORS (the loader reads them).
  photos: [
    "1506744038136-46273834b3fb",
    "1501785888041-af3ef285b470",
    "1469474968028-56623f02e42e",
    "1441974231531-c6227db76b6e",
    "1470071459604-3b5ec3a7fe05",
    "1497366216548-37526070297c",
    "1556761175-5973dc0f32e7",
    "1504384308090-c894fdcc538d",
    "1498050108023-c5249f4df085",
    "1460925895917-afdab827c52f",
    "1519389950473-47ba0277781c",
    "1551434678-e076c223a692",
    "1495474472287-4d71bcdd2085",
    "1504674900247-0877df9cc836",
    "1414235077428-338989a2e8c0",
    "1523275335684-37898b6baf30",
    "1505740420928-5e560c06d30e",
    "1477959858617-67f85cf4f1df",
    "1449824913935-59a10b8d2000",
    "1494790108377-be9c29b29330",
    "1507003211169-0a1dd7228f2d",
    "1513694203232-719a280e022f",
  ],
});
