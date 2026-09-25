// Image Generator — the hero silhouette of a render. Mock "subjects": an
// object, a person, a place, or a product shape. Each generator draws this path
// in its own treatment (flat fill, outline, clay, gloss…), which is what keeps
// one subject recognisable across styles.

/** An SVG path `d` for a subject centred on (cx, cy), about `s` tall. */
export function subjectPath(kind, cx, cy, s, rand = Math.random) {
  const h = s / 2;
  if (kind === "person") {
    const head = s * 0.18;
    return (
      `M ${cx - head} ${cy - h + head} a ${head} ${head} 0 1 0 ${head * 2} 0 a ${head} ${head} 0 1 0 ${-head * 2} 0 Z ` +
      `M ${cx - s * 0.34} ${cy + h} C ${cx - s * 0.34} ${cy - s * 0.02}, ${cx + s * 0.34} ${cy - s * 0.02}, ${cx + s * 0.34} ${cy + h} Z`
    );
  }
  if (kind === "place") {
    const w = s * 1.2;
    const x0 = cx - w / 2;
    const peaks = [0.1, 0.32, 0.55, 0.78].map((f) => x0 + w * f);
    const heights = peaks.map(() => 0.35 + rand() * 0.5);
    return (
      `M ${x0} ${cy + h} L ${x0} ${cy + h * 0.2} ` +
      peaks.map((x, i) => `L ${x} ${cy + h - s * heights[i]} L ${x + w * 0.1} ${cy + h * 0.1}`).join(" ") +
      ` L ${x0 + w} ${cy + h * 0.25} L ${x0 + w} ${cy + h} Z`
    );
  }
  if (kind === "product") {
    const w = s * 0.55;
    const r = s * 0.06;
    return `M ${cx - w / 2 + r} ${cy - h} h ${w - 2 * r} q ${r} 0 ${r} ${r} v ${s - 2 * r} q 0 ${r} ${-r} ${r} h ${-(w - 2 * r)} q ${-r} 0 ${-r} ${-r} v ${-(s - 2 * r)} q 0 ${-r} ${r} ${-r} Z`;
  }
  // object: a cup-like vessel
  const top = cy - h * 0.6;
  const w = s * 0.62;
  return (
    `M ${cx - w / 2} ${top} L ${cx + w / 2} ${top} L ${cx + w * 0.36} ${cy + h} L ${cx - w * 0.36} ${cy + h} Z ` +
    `M ${cx + w / 2 - s * 0.02} ${top + s * 0.12} q ${s * 0.26} ${s * 0.02} ${s * 0.18} ${s * 0.3} q ${-s * 0.06} ${s * 0.14} ${-s * 0.24} ${s * 0.12}`
  );
}

/** Which subject a brief implies — cheap keyword matching, stable per brief. */
export function subjectKindFor(prompt = "", product = null) {
  if (product) return "product";
  const p = prompt.toLowerCase();
  if (/(person|people|team|woman|man|founder|customer|owner|hands?|face)/.test(p)) return "person";
  if (/(place|city|landscape|hill|mountain|beach|office|street|outside|outdoor|forest|park)/.test(p)) return "place";
  return "object";
}
