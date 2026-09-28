// Image Generator — every write a custom style undergoes. A custom style is the
// BRAND's: it lives on the Playbook and is listed first in the studio's picker.

import { storageService as storage } from "../services/index.js?v=1360";
import { createAsset, createStyle } from "../model/schema.js?v=1360";
import { presetById, CUSTOM_STYLE_LIMITS } from "../config/style-presets.js?v=1360";
import { sampleColors } from "../render/sample-colors.js?v=1360";
import { uid } from "../lib/id.js?v=1360";
import { lookFromColors } from "../render/visual.js?v=1360";
import { getAsset } from "./store.js?v=1360";
import { deletePlaybookStyle, findPlaybookStyle, savePlaybookStyle } from "./playbook-brand.js?v=1360";

/** A custom style can write text into the image when the look read from its images can. */
export function deriveEmbeddedText(sources) {
  const colors = sources.filter((s) => s.type === "image").flatMap((s) => s.colors || getAsset(s.ref)?.colors || []);
  return !!presetById(lookFromColors(colors))?.supportsEmbeddedText;
}

export function validateStyleDraft(draft) {
  const errors = [];
  if (!draft.label.trim()) errors.push("Give the style a name.");
  const images = draft.sources.filter((s) => s.type === "image").length;
  if (!images) errors.push("Add at least one reference image: the style's look is read from them.");
  if (images > CUSTOM_STYLE_LIMITS.images) errors.push(`Up to ${CUSTOM_STYLE_LIMITS.images} reference images.`);
  return errors;
}

// A custom style is the BRAND's — a field of its Playbook (imageStyles), written
// through the adapter. Reference images stay in the module's asset store (pixels).
export function saveStyle(draft) {
  const base = draft.id ? findPlaybookStyle(draft.id) : null;
  const style = createStyle({
    ...(base || {}),
    id: draft.id || uid("st"),
    brandId: draft.brandId,
    label: draft.label.trim(),
    description: draft.description.trim(),
    supportsEmbeddedText: deriveEmbeddedText(draft.sources),
    custom: {
      sources: draft.sources.filter((s) => s.type === "image").map((s) => ({ ...s })),
      fidelity: draft.fidelity,
      stylePrompt: draft.stylePrompt.trim(),
    },
    createdAt: base?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return savePlaybookStyle(draft.brandId, style);
}

export function duplicateStyle(brandId, id) {
  const src = findPlaybookStyle(id);
  if (!src) return null;
  return savePlaybookStyle(brandId, {
    ...structuredClone(src),
    id: uid("st"),
    label: `${src.label} (copy)`,
    createdAt: new Date().toISOString(),
  });
}

export function deleteStyle(brandId, id) {
  return deletePlaybookStyle(brandId, id);
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
