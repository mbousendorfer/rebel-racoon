// Image Generator — storageService: CRUD for every entity of the module.
//
// Metadata lives in localStorage, one key per collection, all under
// `imageStudio:v1:`. Pixels (uploads, exported / favourited PNGs) live in the
// IndexedDB database `imageStudio`, store `blobs`. Generated variations are NOT
// stored as pixels: seed + style + palette + format re-render them identically.
//
// Swappable: a real backend only has to honour the same function signatures.

import { createNotifier } from "../state/notifier.js?v=1225";
import { SCHEMA_VERSION, resolveBrand } from "../model/schema.js?v=1225";

const PREFIX = "imageStudio:v1:";
export const COLLECTIONS = Object.freeze(["brands", "styles", "products", "campaigns", "creations", "assets"]);

const cache = new Map();
const notifier = createNotifier();

function key(name) {
  return PREFIX + name;
}

function readJson(name, fallback) {
  try {
    const raw = window.localStorage.getItem(key(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`[image-generator] unreadable ${key(name)}; starting empty.`, error);
    return fallback;
  }
}

function writeJson(name, value) {
  try {
    window.localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch (error) {
    // Quota: the metadata is small, so this is almost always a private window.
    console.warn(`[image-generator] could not persist ${key(name)}`, error);
    return false;
  }
}

function load(collection) {
  if (!COLLECTIONS.includes(collection)) throw new Error(`Unknown collection: ${collection}`);
  if (!cache.has(collection)) cache.set(collection, readJson(collection, []));
  return cache.get(collection);
}

function save(collection, items) {
  cache.set(collection, items);
  writeJson(collection, items);
  notifier.notify({ collection });
}

// ── Collections ──────────────────────────────────────────────────────────────

export function list(collection, predicate) {
  const items = load(collection);
  return predicate ? items.filter(predicate) : items.slice();
}

export function get(collection, id) {
  return load(collection).find((item) => item.id === id) || null;
}

/** Insert or replace by id. Stamps updatedAt. Returns the stored entity. */
export function put(collection, entity) {
  const items = load(collection).slice();
  const stored = { ...entity, updatedAt: new Date().toISOString() };
  const index = items.findIndex((item) => item.id === entity.id);
  if (index === -1) items.push(stored);
  else items[index] = stored;
  save(collection, items);
  return stored;
}

export function putMany(collection, entities) {
  const items = load(collection).slice();
  for (const entity of entities) {
    const index = items.findIndex((item) => item.id === entity.id);
    if (index === -1) items.push(entity);
    else items[index] = entity;
  }
  save(collection, items);
}

export function remove(collection, id) {
  save(
    collection,
    load(collection).filter((item) => item.id !== id),
  );
}

export function removeWhere(collection, predicate) {
  save(
    collection,
    load(collection).filter((item) => !predicate(item)),
  );
}

export function subscribe(fn) {
  return notifier.subscribe(fn);
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export function getMeta() {
  return readJson("meta", { schemaVersion: SCHEMA_VERSION, seededAt: null, activeBrandId: null });
}

export function setMeta(patch) {
  const next = { ...getMeta(), ...patch };
  writeJson("meta", next);
  notifier.notify({ collection: "meta" });
  return next;
}

/** Seeds the demo data once per browser. `seed()` returns { brands, styles, … }. */
export function ensureSeeded(seed) {
  const meta = getMeta();
  if (meta.seededAt) return false;
  const data = seed();
  for (const collection of COLLECTIONS) if (data[collection]) putMany(collection, data[collection]);
  setMeta({ schemaVersion: SCHEMA_VERSION, seededAt: new Date().toISOString(), activeBrandId: data.activeBrandId });
  return true;
}

/** Wipes the module's metadata and blobs (Brands page › Reset demo data). */
export async function resetAll() {
  for (const collection of [...COLLECTIONS, "meta"]) {
    try {
      window.localStorage.removeItem(key(collection));
    } catch {
      /* ignore */
    }
  }
  cache.clear();
  await clearBlobs();
  notifier.notify({ collection: "*" });
}

// ── Blobs (IndexedDB) ────────────────────────────────────────────────────────

const DB_NAME = "imageStudio";
const STORE = "blobs";
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function putBlob(blobKey, blob) {
  return tx("readwrite", (store) => store.put(blob, blobKey));
}

export function getBlob(blobKey) {
  return tx("readonly", (store) => store.get(blobKey));
}

export function deleteBlob(blobKey) {
  return tx("readwrite", (store) => store.delete(blobKey));
}

async function clearBlobs() {
  try {
    await tx("readwrite", (store) => store.clear());
  } catch {
    /* no database yet */
  }
}

const objectUrls = new Map();

/** A displayable URL for an asset: inline SVG → data URL, blob → object URL (cached). */
export async function assetUrl(asset) {
  if (!asset) return null;
  if (asset.svg) return svgDataUrl(asset.svg);
  if (!asset.blobKey) return null;
  if (objectUrls.has(asset.blobKey)) return objectUrls.get(asset.blobKey);
  const blob = await getBlob(asset.blobKey).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(asset.blobKey, url);
  return url;
}

export function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ── Import / export ──────────────────────────────────────────────────────────

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** One brand as a portable JSON document: the brand, its styles, products and assets (pixels inlined). */
export async function exportBrand(brandId) {
  const stored = get("brands", brandId);
  if (!stored) throw new Error("Brand not found");
  // A sub-brand travels RESOLVED: the file has no parent to inherit from.
  const { inherited: _inherited, ...brand } = resolveBrand(stored, (id) => get("brands", id));
  const assets = [];
  const referenced = new Set([...brand.logos.map((l) => l.assetId), ...(brand.imageStyle?.referenceAssetIds || [])]);
  for (const asset of list("assets", (a) => a.brandId === brandId || referenced.has(a.id))) {
    const copy = { ...asset };
    if (asset.blobKey) {
      const blob = await getBlob(asset.blobKey).catch(() => null);
      copy.dataUrl = blob ? await blobToDataUrl(blob) : null;
    }
    assets.push(copy);
  }
  return {
    format: "image-generator/brand",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    brand,
    styles: list("styles", (s) => s.brandId === brandId),
    products: list("products", (p) => p.brandId === brandId),
    assets,
  };
}

/**
 * Imports a brand document. Ids are re-minted so importing the same file twice
 * yields two brands rather than overwriting one. Returns the new brand.
 */
export async function importBrand(doc, mintId) {
  if (doc?.format !== "image-generator/brand" || !doc.brand)
    throw new Error("This file isn't a Image Generator brand.");
  const ids = new Map();
  const remap = (old, prefix) => {
    if (!old) return old;
    if (!ids.has(old)) ids.set(old, mintId(prefix));
    return ids.get(old);
  };
  const brandId = remap(doc.brand.id, "br");
  for (const asset of doc.assets || []) {
    const { dataUrl, ...rest } = asset;
    const next = { ...rest, id: remap(asset.id, "as"), brandId };
    if (dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      next.blobKey = next.id;
      await putBlob(next.blobKey, blob);
    }
    put("assets", next);
  }
  const remapAssets = (list_) => (list_ || []).map((id) => ids.get(id) || id);
  for (const style of doc.styles || []) {
    put("styles", {
      ...style,
      id: remap(style.id, "st"),
      brandId,
      custom: style.custom && {
        ...style.custom,
        sources: style.custom.sources.map((s) => (s.type === "image" ? { ...s, ref: ids.get(s.ref) || s.ref } : s)),
      },
    });
  }
  for (const product of doc.products || []) {
    put("products", {
      ...product,
      id: remap(product.id, "pr"),
      brandId,
      imageAssetId: ids.get(product.imageAssetId) || product.imageAssetId,
      shotAssetIds: remapAssets(product.shotAssetIds),
    });
  }
  const brand = {
    ...doc.brand,
    id: brandId,
    parentId: null,
    isDefault: false,
    overriddenFields: [],
    name: doc.brand.name,
    logos: doc.brand.logos.map((l) => ({ ...l, assetId: ids.get(l.assetId) || l.assetId })),
    imageStyle: {
      ...doc.brand.imageStyle,
      referenceAssetIds: remapAssets(doc.brand.imageStyle?.referenceAssetIds),
      preferredStyleIds: (doc.brand.imageStyle?.preferredStyleIds || []).map((id) => ids.get(id) || id),
    },
  };
  return put("brands", brand);
}
