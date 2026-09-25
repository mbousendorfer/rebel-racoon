// Image Generator — every write a custom style undergoes. A custom style is the
// generator's, saved FOR a Playbook (brandId) and listed first in its picker.

import { storageService as storage } from "../services/index.js?v=1304";
import { createAsset, createStyle } from "../model/schema.js?v=1304";
import { presetById, CUSTOM_STYLE_LIMITS } from "../config/style-presets.js?v=1304";
import { sampleColors } from "../render/sample-colors.js?v=1304";
import { uid } from "../lib/id.js?v=1304";

/** A custom style can write text into the image when its heaviest preset can. */
export function deriveEmbeddedText(sources) {
  const top = sources.filter((s) => s.type === "preset").sort((a, b) => b.weight - a.weight)[0];
  return !!(top && presetById(top.ref)?.supportsEmbeddedText);
}

export function validateStyleDraft(draft) {
  const errors = [];
  if (!draft.label.trim()) errors.push("Give the style a name.");
  const images = draft.sources.filter((s) => s.type === "image").length;
  const presets = draft.sources.filter((s) => s.type === "preset").length;
  if (!images && !presets) errors.push("Add at least one reference image or preset.");
  if (images > CUSTOM_STYLE_LIMITS.images) errors.push(`Up to ${CUSTOM_STYLE_LIMITS.images} reference images.`);
  if (presets > CUSTOM_STYLE_LIMITS.presets) errors.push(`Up to ${CUSTOM_STYLE_LIMITS.presets} presets.`);
  return errors;
}

export function saveStyle(draft) {
  const base = draft.id ? storage.get("styles", draft.id) : null;
  const style = createStyle({
    ...(base || {}),
    id: draft.id || uid("st"),
    brandId: draft.brandId,
    label: draft.label.trim(),
    description: draft.description.trim(),
    supportsEmbeddedText: deriveEmbeddedText(draft.sources),
    custom: {
      sources: draft.sources.map((s) => ({ ...s })),
      fidelity: draft.fidelity,
      stylePrompt: draft.stylePrompt.trim(),
    },
    createdAt: base?.createdAt || new Date().toISOString(),
  });
  return storage.put("styles", style);
}

export function duplicateStyle(id) {
  const src = storage.get("styles", id);
  if (!src) return null;
  return storage.put("styles", {
    ...structuredClone(src),
    id: uid("st"),
    label: `${src.label} (copy)`,
    createdAt: new Date().toISOString(),
  });
}

export function deleteStyle(id) {
  storage.remove("styles", id);
}

/** Stores a reference image for a Playbook, with its dominant colours sampled. */
export async function uploadReference(brandId, file) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  const colors = await sampleColors(file);
  const asset = createAsset({ brandId, kind: "reference", name: file.name, mime: file.type, source: "upload", colors });
  if (file.type === "image/svg+xml") asset.svg = await file.text();
  else {
    asset.blobKey = asset.id;
    await storage.putBlob(asset.blobKey, file);
  }
  return storage.put("assets", asset);
}
