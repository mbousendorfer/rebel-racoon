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
    // Two soft hills and a path between them — a landscape, not a skyline.
    const w = s * 1.25;
    const x0 = cx - w / 2;
    const base = cy + h;
    const p1 = 0.45 + rand() * 0.2;
    const p2 = 0.3 + rand() * 0.2;
    return (
      `M ${x0} ${base} L ${x0} ${base - s * 0.25} ` +
      `C ${x0 + w * 0.15} ${base - s * p1 - s * 0.2}, ${x0 + w * 0.38} ${base - s * p1 - s * 0.2}, ${x0 + w * 0.52} ${base - s * 0.35} ` +
      `C ${x0 + w * 0.62} ${base - s * p2 - s * 0.15}, ${x0 + w * 0.86} ${base - s * p2 - s * 0.2}, ${x0 + w} ${base - s * 0.3} ` +
      `L ${x0 + w} ${base} Z`
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

/**
 * The inner lines of a subject — what makes a silhouette read as a thing: a
 * mug's rim, saucer and steam; a person's hair and collar; a place's sun and
 * trees; a product's label. Generators draw it over the silhouette in a
 * lighter or darker tone of their own fill (generators.js#subject).
 */
export function subjectDetail(kind, cx, cy, s) {
  const h = s / 2;
  if (kind === "person") {
    const head = s * 0.18;
    const top = cy - h;
    return [
      // hair
      `M ${cx - head * 1.05} ${top + head * 1.1} q ${head * 0.2} ${-head * 1.25} ${head * 1.05} ${-head * 1.15} q ${head * 0.95} ${-head * 0.05} ${head * 1.05} ${head * 1.15}`,
      // collar + placket
      `M ${cx - s * 0.12} ${cy + s * 0.08} l ${s * 0.12} ${s * 0.12} l ${s * 0.12} ${-s * 0.12} M ${cx} ${cy + s * 0.2} l 0 ${s * 0.26}`,
      // shoulders seams
      `M ${cx - s * 0.26} ${cy + s * 0.22} q ${s * 0.02} ${s * 0.14} ${s * 0.04} ${s * 0.28} M ${cx + s * 0.26} ${cy + s * 0.22} q ${-s * 0.02} ${s * 0.14} ${-s * 0.04} ${s * 0.28}`,
    ].join(" ");
  }
  if (kind === "place") {
    const w = s * 1.2;
    const x0 = cx - w / 2;
    const tree = (x, y, t) =>
      `M ${x} ${y} l ${t * 0.5} ${-t * 1.4} l ${t * 0.5} ${t * 1.4} Z M ${x + t * 0.5} ${y} l 0 ${t * 0.4}`;
    return [
      // the sun, over the hills
      `M ${cx + s * 0.28} ${cy - h * 0.62} m ${-s * 0.11} 0 a ${s * 0.11} ${s * 0.11} 0 1 0 ${s * 0.22} 0 a ${s * 0.11} ${s * 0.11} 0 1 0 ${-s * 0.22} 0`,
      tree(x0 + w * 0.14, cy + h * 0.72, s * 0.09),
      tree(x0 + w * 0.24, cy + h * 0.8, s * 0.07),
      tree(x0 + w * 0.78, cy + h * 0.78, s * 0.08),
      // a path winding down between them
      `M ${x0 + w * 0.5} ${cy + h * 0.35} q ${-w * 0.12} ${s * 0.2} ${w * 0.02} ${s * 0.3} q ${w * 0.14} ${s * 0.1} ${-w * 0.06} ${s * 0.22}`,
    ].join(" ");
  }
  if (kind === "product") {
    const w = s * 0.55;
    return [
      `M ${cx - w * 0.36} ${cy - h * 0.2} h ${w * 0.72} v ${s * 0.32} h ${-w * 0.72} Z`,
      `M ${cx - w * 0.5} ${cy - h * 0.72} h ${w}`,
      `M ${cx - w * 0.2} ${cy - h * 0.05} h ${w * 0.4} M ${cx - w * 0.14} ${cy + h * 0.05} h ${w * 0.28}`,
    ].join(" ");
  }
  // object: a mug — rim, saucer, steam, a highlight
  const top = cy - h * 0.6;
  const w = s * 0.62;
  return [
    `M ${cx - w / 2} ${top} q ${w / 2} ${s * 0.08} ${w} 0`,
    `M ${cx - w * 0.78} ${cy + h * 1.02} q ${w * 0.78} ${s * 0.12} ${w * 1.56} 0`,
    `M ${cx - w * 0.18} ${top - s * 0.06} q ${-s * 0.06} ${-s * 0.09} 0 ${-s * 0.18} q ${s * 0.06} ${-s * 0.09} 0 ${-s * 0.18}`,
    `M ${cx + w * 0.12} ${top - s * 0.05} q ${-s * 0.06} ${-s * 0.09} 0 ${-s * 0.18} q ${s * 0.06} ${-s * 0.09} 0 ${-s * 0.18}`,
    `M ${cx - w * 0.3} ${top + s * 0.12} l ${w * 0.06} ${s * 0.5}`,
  ].join(" ");
}
