// Image Generator — what the editor does to a creation's layers. Pure layer
// transforms (return new arrays) + the writes that persist them. Every write
// keeps the previous layers on an in-memory undo stack.

import { storageService as storage } from "../services/index.js?v=1308";
import { createLayer, historyEntry } from "../model/schema.js?v=1308";
import { contrast, inkOn, resolvePalette } from "../render/palette.js?v=1308";

const undo = new Map(); // `${creationId}|${formatId}` → layers[][]

/** The layers of one format of a creation: the master's, or its adaptation's. */
export function layersOf(creation, formatId) {
  if (!formatId || formatId === creation.master.formatId) return creation.master.layers;
  return creation.adaptations.find((a) => a.formatId === formatId)?.layers || null;
}

function writeLayers(creation, formatId, layers) {
  if (!formatId || formatId === creation.master.formatId)
    return { ...creation, master: { ...creation.master, layers } };
  const others = creation.adaptations.filter((a) => a.formatId !== formatId);
  return { ...creation, adaptations: [...others, { formatId, layers }] };
}

export function commitLayers(creationId, layers, { action, record = true, formatId = null } = {}) {
  const c = storage.get("creations", creationId);
  if (!c) return null;
  const f = formatId || c.master.formatId;
  if (record) {
    const key = `${creationId}|${f}`;
    const stack = undo.get(key) || [];
    stack.push(layersOf(c, f) || []);
    if (stack.length > 40) stack.shift();
    undo.set(key, stack);
  }
  return storage.put("creations", {
    ...writeLayers(c, f, layers),
    history: action ? [...c.history, historyEntry("edited", action)] : c.history,
  });
}

export function canUndo(creationId, formatId) {
  const c = storage.get("creations", creationId);
  return (undo.get(`${creationId}|${formatId || c?.master.formatId}`) || []).length > 0;
}

export function undoLayers(creationId, formatId) {
  const c = storage.get("creations", creationId);
  const f = formatId || c?.master.formatId;
  const stack = undo.get(`${creationId}|${f}`) || [];
  const prev = stack.pop();
  if (prev) commitLayers(creationId, prev, { record: false, action: "Undo", formatId: f });
  return !!prev;
}

// ── Layer transforms ─────────────────────────────────────────────────────────

const nextZ = (layers) => Math.max(0, ...layers.map((l) => l.z)) + 1;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function patchLayer(layers, id, patch) {
  return layers.map((l) => (l.id === id ? { ...l, ...patch, props: { ...l.props, ...(patch.props || {}) } } : l));
}

export function moveLayer(layers, id, x, y) {
  return layers.map((l) =>
    l.id === id ? { ...l, x: clamp(x, -l.w * 0.5, 1 - l.w * 0.5), y: clamp(y, -l.h * 0.5, 1 - l.h * 0.5) } : l,
  );
}

export function removeLayer(layers, id) {
  return layers.filter((l) => l.id !== id || l.type === "image");
}

/** z-order: direction +1 brings forward, -1 sends back (the image stays at the bottom). */
export function reorder(layers, id, direction) {
  const sorted = [...layers].sort((a, b) => a.z - b.z);
  const i = sorted.findIndex((l) => l.id === id);
  const j = i + direction;
  if (i < 0 || j < 1 || j >= sorted.length || sorted[i].type === "image") return layers;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((l, k) => ({ ...l, z: k }));
}

export function addTextLayer(layers, content = "Your text") {
  return [
    ...layers,
    createLayer("text", {
      x: 0.1,
      y: 0.4,
      w: 0.8,
      h: 0.14,
      z: nextZ(layers),
      props: { content, fontRole: "heading", colorRole: "text", size: 0.07, align: "left", band: false },
    }),
  ];
}

export function addLogoLayer(layers) {
  return [
    ...layers,
    createLayer("logo", { x: 0.72, y: 0.86, w: 0.2, h: 0.08, z: nextZ(layers), props: { variant: "color" } }),
  ];
}

export function addShapeLayer(layers) {
  // A new shape goes just above the image and UNDER everything else: it's almost
  // always a backdrop for the text or the logo.
  const lifted = layers.map((l) => (l.type === "image" ? l : { ...l, z: l.z + 1 }));
  const image = layers.find((l) => l.type === "image");
  return [
    ...lifted,
    createLayer("shape", {
      x: 0.06,
      y: 0.58,
      w: 0.88,
      h: 0.3,
      z: (image?.z ?? 0) + 1,
      props: { colorRole: "background", opacity: 0.85, radius: 0.08 },
    }),
  ];
}

export function addAssetLayer(layers, { assetId, href, name }) {
  return [
    ...layers,
    createLayer("asset", {
      x: 0.3,
      y: 0.3,
      w: 0.4,
      h: 0.4,
      z: nextZ(layers),
      props: { assetId: assetId || null, href: href || "", name },
    }),
  ];
}

// ── Apply the brand ──────────────────────────────────────────────────────────

/**
 * One click to put everything back in the brand: brand fonts (heading for text
 * layers), brand colours with enough contrast, the right logo version, shapes
 * in brand colours. Returns { layers, changes[] } so the UI can say what moved.
 */
export function applyBrand(layers, brand) {
  const p = resolvePalette(brand);
  const brandHexes = new Set(p.all.concat(p.background, p.text).map((h) => h.toUpperCase()));
  const changes = new Set();
  const next = layers.map((l) => {
    if (l.type === "text") {
      const props = { ...l.props };
      if (props.family) {
        delete props.family;
        changes.add("fonts");
      }
      props.fontRole = props.fontRole === "body" ? "body" : "heading";
      if (props.hex && !brandHexes.has(props.hex.toUpperCase())) {
        delete props.hex;
        changes.add("colours");
      }
      const bg = props.band ? p[props.bandRole || "background"] : p.background;
      const current = props.hex || p[props.colorRole] || p.text;
      if (contrast(bg, current) < 4.5) {
        const ink = inkOn(bg, p.text);
        const role = ["text", "primary", "background"].find((r) => p[r].toUpperCase() === ink.toUpperCase());
        if (role) props.colorRole = role;
        else props.hex = ink;
        changes.add("contrast");
      }
      return { ...l, props };
    }
    if (l.type === "shape") {
      const props = { ...l.props };
      if (props.hex && !brandHexes.has(props.hex.toUpperCase())) {
        delete props.hex;
        props.colorRole = "background";
        changes.add("colours");
      }
      return { ...l, props };
    }
    if (l.type === "logo" && !["color", "white", "black", "icon"].includes(l.props.variant)) {
      changes.add("logo");
      return { ...l, props: { ...l.props, variant: "color" } };
    }
    return l;
  });
  return { layers: next, changes: [...changes] };
}
