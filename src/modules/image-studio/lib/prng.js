// Image Generator — seeded pseudo-random numbers. Every mock visual is rendered
// from a seed, so a variation re-renders identically after a reload without
// storing a single pixel.

/** mulberry32: small, fast, good enough for procedural art. */
export function prng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string — domain names, prompts. */
export function hashString(text) {
  let h = 2166136261;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

export function range(rand, min, max) {
  return min + rand() * (max - min);
}

export function shuffle(rand, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
