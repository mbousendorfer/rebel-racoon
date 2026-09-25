// Image Generator — the module's app state. Its own objects (styles, products,
// campaigns, creations, assets) come from storageService, scoped by `brandId`
// — a Playbook id. The brands themselves are Playbooks, re-exported from the
// adapter so views have one import.

import { storageService as storage } from "../services/index.js?v=1229";
import { STYLE_PRESETS } from "../config/style-presets.js?v=1229";
import { seedDemoData } from "../config/demo-data.js?v=1229";
import { adoptCreatedPlaybook, subscribeBrands } from "./playbook-brand.js?v=1229";

export {
  getActiveBrand,
  getActiveBrandId,
  getBrand,
  getBrands,
  setActiveBrand,
  hasOwnBrandPicker,
  canEditBrand,
  playbookPath,
  startPlaybookCreation,
} from "./playbook-brand.js?v=1229";

export function boot() {
  storage.ensureSeeded(seedDemoData);
  adoptCreatedPlaybook();
}

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
  const custom = storage.list("styles", (s) => s.brandId === brandId);
  return [...custom, ...STYLE_PRESETS];
}

export function getStyle(id) {
  return STYLE_PRESETS.find((p) => p.id === id) || storage.get("styles", id);
}

// ── Everything else, scoped to a brand ───────────────────────────────────────

export function getProducts(brandId) {
  return storage.list("products", (p) => p.brandId === brandId);
}

export function getCampaigns(brandId) {
  return storage.list("campaigns", (c) => !brandId || c.brandId === brandId);
}

export function getCreations(brandId) {
  return storage
    .list("creations", (c) => !brandId || c.brandId === brandId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
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
