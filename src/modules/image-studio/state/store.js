// Image Generator — the module's app state. Its own objects (creations and
// assets) come from storageService, scoped by `brandId` — a Playbook id. The
// brands, and the brand's own styles, are the Playbooks', read through the
// adapter and re-exported here so views have one import.

import { storageService as storage } from "../services/index.js?v=1382";
import { STYLE_PRESETS } from "../config/style-presets.js?v=1382";
import { findPlaybookStyle, getPlaybookStyles, subscribeBrands } from "./playbook-brand.js?v=1382";

export { getActiveBrandId, getBrand, canEditBrand } from "./playbook-brand.js?v=1382";

/** One subscription for everything a view shows: module storage + Playbooks. */
export function subscribe(fn) {
  const a = storage.subscribe(fn);
  const b = subscribeBrands(fn);
  return () => {
    a();
    b();
  };
}

// ── Styles ───────────────────────────────────────────────────────────────────

/** The style picker's list for a brand: its own custom styles FIRST, then the presets. */
export function getStylesForBrand(brandId) {
  return [...getPlaybookStyles(brandId), ...STYLE_PRESETS];
}

export function getStyle(id) {
  return STYLE_PRESETS.find((p) => p.id === id) || findPlaybookStyle(id);
}

// ── Everything else, scoped to a brand ───────────────────────────────────────

export function getProducts(brandId) {
  return storage.list("products", (p) => p.brandId === brandId);
}

export function getCreation(id) {
  return storage.get("creations", id);
}

export function getAssets(brandId, kind) {
  return storage.list("assets", (a) => a.brandId === brandId && (!kind || a.kind === kind));
}

export function getAsset(id) {
  return storage.get("assets", id);
}
