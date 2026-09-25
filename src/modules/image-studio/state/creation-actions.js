// Image Generator — every write a creation undergoes. A generation run is saved
// as a creation straight away (that IS the history); opening a variation in the
// editor gives it its layers.

import { storageService as storage } from "../services/index.js?v=1261";
import { createCampaign, createCreation, historyEntry } from "../model/schema.js?v=1261";
import { formatById } from "../config/formats.js?v=1261";
import { uid } from "../lib/id.js?v=1261";
import { defaultLayers } from "../render/layout.js?v=1261";

function get(id) {
  return storage.get("creations", id);
}

function save(creation) {
  return storage.put("creations", creation);
}

function shortTitle(prompt) {
  const t = String(prompt || "")
    .replace(/#\w+/g, "")
    .trim();
  if (!t) return "Untitled image";
  return t.length > 48 ? t.slice(0, 45).trimEnd() + "…" : t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * A new creation for a brief. An idea from the hub becomes (or joins) a
 * campaign with its title, angle and event — that is how campaigns fill up.
 */
export function startCreation({ brand, brief, style, idea }) {
  let campaignId = null;
  if (idea) {
    const existing = storage.list("campaigns", (c) => c.brandId === brand.id && c.title === idea.title)[0];
    const campaign =
      existing ||
      storage.put(
        "campaigns",
        createCampaign({
          brandId: brand.id,
          title: idea.title,
          angle: idea.angle,
          objective: idea.angle,
          eventId: idea.eventId,
          start: new Date().toISOString().slice(0, 10),
        }),
      );
    campaignId = campaign.id;
  }
  const creation = save(
    createCreation({
      brandId: brand.id,
      campaignId,
      title: idea?.title || shortTitle(brief.prompt),
      brief: { ...brief },
      styleSnapshot: style ? structuredClone(style) : null,
      history: [historyEntry("created", style ? `Style: ${style.label}` : "")],
    }),
  );
  if (campaignId) {
    const campaign = storage.get("campaigns", campaignId);
    storage.put("campaigns", {
      ...campaign,
      creationIds: [...new Set([...(campaign.creationIds || []), creation.id])],
    });
  }
  return creation;
}

/** Adds a batch of variations (a generation, or "Similar to #n"). Newest batch first. */
export function addBatch(creationId, variations, { label, parentVariationId = null } = {}) {
  const c = get(creationId);
  const batchId = uid("bt");
  const batch = { id: batchId, label, parentVariationId, at: new Date().toISOString() };
  return save({
    ...c,
    batches: [batch, ...(c.batches || [])],
    variations: [...variations.map((v) => ({ ...v, batchId })), ...c.variations],
    history: [
      ...c.history,
      historyEntry(parentVariationId ? "similar" : "generated", `${variations.length} variations`),
    ],
  });
}

export function replaceVariation(creationId, variationId, next) {
  const c = get(creationId);
  return save({
    ...c,
    variations: c.variations.map((v) => (v.id === variationId ? { ...next, id: v.id, batchId: v.batchId } : v)),
    history: [...c.history, historyEntry("regenerated", "One variation")],
  });
}

export function toggleFavorite(creationId, variationId) {
  const c = get(creationId);
  const set = new Set(c.favoriteVariationIds || []);
  if (set.has(variationId)) set.delete(variationId);
  else set.add(variationId);
  return save({ ...c, favoriteVariationIds: [...set], favorite: set.size > 0 });
}

/** Picks the variation to edit and lays out its first format. */
export function openVariation(creationId, variationId) {
  const c = get(creationId);
  const formatId = c.brief.formatIds[0] || "ig-post";
  const layout = formatById(formatId)?.layout || "square";
  const sameVariation = c.selectedVariationId === variationId && c.master.layers.length;
  return save({
    ...c,
    selectedVariationId: variationId,
    master: sameVariation
      ? c.master
      : { formatId, layers: defaultLayers({ layout, headline: c.brief.headline, textMode: c.brief.textMode }) },
    history: sameVariation ? c.history : [...c.history, historyEntry("opened", "In the editor")],
  });
}

export function deleteCreation(id) {
  const c = get(id);
  if (!c) return;
  storage.remove("creations", id);
  if (c.campaignId) {
    const campaign = storage.get("campaigns", c.campaignId);
    if (campaign)
      storage.put("campaigns", { ...campaign, creationIds: (campaign.creationIds || []).filter((x) => x !== id) });
  }
}
