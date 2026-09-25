// Image Generator — the catalogue: a Playbook's products, and their product
// shoots (staged scenes generated from the product's image).

import { storageService as storage } from "../services/index.js?v=1308";
import { createAsset, createProduct } from "../model/schema.js?v=1308";
import { uid } from "../lib/id.js?v=1308";
import { uploadAsset } from "./asset-upload.js?v=1308";

export const SHOOT_SCENES = Object.freeze([
  { id: "studio", label: "Studio", styleId: "preset-packshot", prompt: "on a seamless studio backdrop, soft shadow" },
  {
    id: "lifestyle",
    label: "Lifestyle",
    styleId: "preset-lifestyle",
    prompt: "in use in an everyday moment, natural light",
  },
  { id: "seasonal", label: "Seasonal", styleId: "preset-flat-lay", prompt: "styled for the season, props around it" },
]);

export function saveProduct({ id, brandId, name, description, url, imageAssetId }) {
  const base = id ? storage.get("products", id) : null;
  return storage.put(
    "products",
    createProduct({
      ...(base || {}),
      id: id || uid("pr"),
      brandId,
      name: name.trim(),
      description: description.trim(),
      url: url.trim(),
      imageAssetId: imageAssetId ?? base?.imageAssetId ?? null,
    }),
  );
}

/** Stores a drawn product image (from the URL extraction) as an asset. */
export function saveDrawnImage(brandId, name, svg) {
  return storage.put(
    "assets",
    createAsset({
      brandId,
      kind: "product",
      name,
      mime: "image/svg+xml",
      svg,
      source: "generated",
      width: 600,
      height: 600,
    }),
  );
}

export async function uploadProductImage(brandId, file) {
  return uploadAsset(brandId, file, "product", { preview: true });
}

export function deleteProduct(id) {
  const p = storage.get("products", id);
  if (!p) return;
  storage.remove("products", id);
  // Drafts that used it keep their brief; the subject just falls back to a generic shape.
}

/** A product shoot: three staged scenes, stored on the product as seeds. */
export function addShoot(productId, shots) {
  const p = storage.get("products", productId);
  return storage.put("products", { ...p, shoots: [...shots, ...(p.shoots || [])].slice(0, 12) });
}
