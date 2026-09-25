// Image Generator — the module's app state over storageService: the active brand,
// resolved brands, and one subscribe() for every view. Persistent state is in
// storage; this file only adds what views derive from it.

import { storageService as storage } from "../services/index.js?v=1225";
import { resolveBrand } from "../model/schema.js?v=1225";
import { STYLE_PRESETS } from "../config/style-presets.js?v=1225";
import { seedDemoData } from "../config/demo-data.js?v=1225";

export function boot() {
  storage.ensureSeeded(seedDemoData);
}

export const subscribe = storage.subscribe;

// ── Brands ───────────────────────────────────────────────────────────────────

export function getBrands() {
  return storage.list("brands").sort((a, b) => a.name.localeCompare(b.name));
}

export function getBrand(id) {
  return storage.get("brands", id);
}

/** The brand as it should be USED: inheritance applied. */
export function getResolvedBrand(id) {
  return resolveBrand(getBrand(id), getBrand);
}

export function getChildren(brandId) {
  return storage.list("brands", (b) => b.parentId === brandId);
}

export function getDefaultBrand() {
  const brands = getBrands();
  return brands.find((b) => b.isDefault) || brands[0] || null;
}

export function getActiveBrandId() {
  const id = storage.getMeta().activeBrandId;
  if (id && getBrand(id)) return id;
  return getDefaultBrand()?.id || null;
}

export function getActiveBrand() {
  const id = getActiveBrandId();
  return id ? getResolvedBrand(id) : null;
}

export function setActiveBrand(id) {
  storage.setMeta({ activeBrandId: id });
}

// ── Styles ───────────────────────────────────────────────────────────────────

/** The style picker's list for a brand: its own custom styles FIRST, then the presets. */
export function getStylesForBrand(brandId) {
  const brand = getBrand(brandId);
  const lineage = [brandId, brand?.parentId].filter(Boolean);
  const custom = storage.list("styles", (s) => lineage.includes(s.brandId));
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
