// Image Generator — mocked imageGenerationService.
//
// Contract (what a real implementation must honour):
//   generate(request, { signal, onProgress }) → Promise<Variation[]>
//     request: { brief, brand, style, product?, format, textMode, text?, count?, slides?, slideTexts? }
//     Variation: { id, seed, bgSeed, subjectSeed, prompt, slides? }
//     A carousel (`slides` > 1): every variation carries `slides` — one
//     { seed, bgSeed, subjectSeed, headline, prompt } per slide, slide 1 = the
//     variation's own seeds. The slides share the creation's style snapshot (the
//     Style Bible) and the background family; each has its subject and its text.
//     `onProgress(n, of)` fires as slide n starts rendering.
//   similar(variation, request, { signal }) → Promise<Variation[]>   — close variations
//   regenerate(variation, part, request, { signal }) → Promise<Variation>
//     part: "background" | "subject" | "all"
//   Rejects with { code: "generation_failed" } on failure; AbortError on cancel.
//
// The mock returns SEEDS, not pixels: render/ draws them locally, on-style and
// on-palette, so the same variation always looks the same.

import { MOCK } from "../../config/mock.js?v=2515";
import { createVariation } from "../../model/schema.js?v=2515";
import { randomSeed } from "../../lib/prng.js?v=2515";
import { wait } from "../../lib/delegate.js?v=2515";
import { buildPrompt } from "../prompt.js?v=2515";

function delay(signal) {
  const [min, max] = MOCK.generation.delayMs;
  return wait(min + Math.random() * (max - min), signal);
}

function maybeFail(request) {
  const prompt = request?.brief?.prompt || "";
  if (prompt.includes(MOCK.generation.failKeyword) || Math.random() < MOCK.generation.failRate) {
    const error = new Error("Generation failed");
    error.code = "generation_failed";
    throw error;
  }
}

function variation(seed, request, extra = {}) {
  return createVariation(seed, {
    bgSeed: seed ^ 0x5bd1e995,
    subjectSeed: seed ^ 0x27d4eb2d,
    prompt: buildPrompt(request),
    ...extra,
  });
}

export async function generate(request, { signal, onProgress } = {}) {
  const of = Math.max(1, request.slides || 1);
  // Slide 1 sets the look and takes the full wait; each next one renders on it, faster.
  for (let n = 1; n <= of; n++) {
    onProgress?.(n, of);
    if (n === 1) await delay(signal);
    else await wait(MOCK.generation.slideMs, signal);
    if (n === 1) maybeFail(request);
  }
  return Array.from({ length: request.count || MOCK.generation.variations }, () => {
    const v = variation(randomSeed(), request);
    if (of === 1) return v;
    v.slides = Array.from({ length: of }, (_, i) => {
      const headline = request.slideTexts?.[i] ?? "";
      const slideRequest = {
        ...request,
        brief: { ...request.brief, headline },
        text: { headline },
        slide: { n: i + 1, of },
      };
      return i === 0
        ? { seed: v.seed, bgSeed: v.bgSeed, subjectSeed: v.subjectSeed, headline, prompt: buildPrompt(slideRequest) }
        : {
            seed: v.seed + i * 7,
            bgSeed: v.bgSeed,
            subjectSeed: randomSeed(),
            headline,
            prompt: buildPrompt(slideRequest),
          };
    });
    return v;
  });
}

export async function similar(base, request, { signal } = {}) {
  await delay(signal);
  maybeFail(request);
  // Same background family and subject placement, small jitter: seeds near the base.
  return Array.from({ length: request.count || MOCK.generation.variations }, (_, i) =>
    variation(base.seed + (i + 1) * 7, request, { bgSeed: base.bgSeed + i + 1, subjectSeed: base.subjectSeed }),
  );
}

export async function regenerate(base, part, request, { signal } = {}) {
  await delay(signal);
  maybeFail(request);
  const fresh = randomSeed();
  if (part === "background") return { ...base, bgSeed: fresh, prompt: buildPrompt(request) };
  if (part === "subject") return { ...base, subjectSeed: fresh, prompt: buildPrompt(request) };
  return variation(fresh, request);
}
