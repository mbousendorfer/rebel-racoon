// Image Generator — uploading a file as a module asset: pixels in IndexedDB
// (or inline for SVG), metadata in the assets collection.
//
// `preview`: a product photo is drawn INSIDE generated SVGs, and an SVG loaded
// as an image can't fetch a blob: URL — only an embedded data: URL. So photos
// that may become a subject also keep a small JPEG data URL (≤ 640 px).

import { storageService as storage } from "../services/index.js?v=1307";
import { createAsset } from "../model/schema.js?v=1307";

async function previewDataUrl(file, max = 640) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadAsset(brandId, file, kind = "image", { preview = false } = {}) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  const asset = createAsset({ brandId, kind, name: file.name, mime: file.type, source: "upload" });
  if (file.type === "image/svg+xml") asset.svg = await file.text();
  else {
    asset.blobKey = asset.id;
    await storage.putBlob(asset.blobKey, file);
    if (preview) {
      const p = await previewDataUrl(file).catch(() => null);
      if (p) Object.assign(asset, { preview: p.dataUrl, width: p.width, height: p.height });
    }
  }
  return storage.put("assets", asset);
}
