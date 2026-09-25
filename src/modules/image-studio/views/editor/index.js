// Image Generator — the editor (/image-generator/editor/:creationId).
//
//   layers (left) · stage (centre) · properties + text ideas (right)
//   Header: Undo · Apply the brand · Download PNG
//   Under the stage: edit in words, and (on the image layer) regenerate the
//   background or the subject alone.
//
// Layers move by drag or arrow keys (Shift = ×5) and resize from their corner;
// Delete removes the selected one. A drag patches the DOM live and commits once,
// on release, so the undo stack gets one step per gesture.

import { html, toString } from "../../lib/html.js?v=1301";
import { delegate } from "../../lib/delegate.js?v=1301";
import { renderFrame } from "../frame.js?v=1301";
import { renderEmpty } from "../../ui/empty.js?v=1301";
import { preserveFocus, syncSlider } from "../../ui/fields.js?v=1301";
import { openDialog } from "../../ui/dialog.js?v=1301";
import { toast } from "../../ui/toast.js?v=1301";
import { assetImg, hydrateAssets, warmAssetUrls } from "../../ui/asset.js?v=1301";
import { variationCanvas, variationSvg } from "../../ui/variation.js?v=1301";
import { formatById, formatRatio } from "../../config/formats.js?v=1301";
import { networkById } from "../../config/networks.js?v=1301";
import { isHex } from "../../model/schema.js?v=1301";
import { resolveLayers } from "../../render/layout.js?v=1301";
import { toPngBlob, downloadBlob, slug } from "../../render/export.js?v=1301";
import { copyService, editService, imageGenerationService } from "../../services/index.js?v=1301";
import {
  canEditBrand,
  getAssets,
  getBrand,
  getCreation,
  getProducts,
  saveColorToPlaybook,
  saveFontToPlaybook,
  subscribe,
} from "../../state/store.js?v=1301";
import { replaceVariation } from "../../state/creation-actions.js?v=1301";
import {
  addAssetLayer,
  addLogoLayer,
  addShapeLayer,
  addTextLayer,
  applyBrand,
  canUndo,
  commitLayers,
  moveLayer,
  patchLayer,
  removeLayer,
  reorder,
  undoLayers,
} from "../../state/editor-actions.js?v=1301";
import { renderLayers, renderProps, renderTextIdeas, renderWordsBar, layerName } from "./panels.js?v=1301";

const CHANGE_WORDS = { fonts: "fonts", colours: "colours", contrast: "text contrast", logo: "logo version" };

export function mount(target, params, ctx) {
  const id = params.creationId;
  const state = {
    selectedId: null,
    unlock: { font: false, color: false },
    nl: { status: "idle", text: "", message: "" },
    ideas: { status: "idle", hooks: [], ctas: [] },
    regen: null, // "background" | "subject"
    drag: null,
  };
  let alive = true;
  const abort = new AbortController();

  const data = () => {
    const creation = getCreation(id);
    if (!creation || !creation.selectedVariationId) return null;
    const brand = getBrand(creation.brandId);
    const variation = creation.variations.find((v) => v.id === creation.selectedVariationId);
    const format = formatById(creation.master.formatId) || formatById("ig-post");
    return { creation, brand, variation, format, layers: creation.master.layers };
  };

  const commit = (layers, action) => commitLayers(id, layers, { action });

  const paint = () => {
    if (!alive || state.drag) return;
    const d = data();
    const back = { path: d ? `/image-generator?creation=${id}` : "/image-generator", label: "Back to results" };
    if (!d || !d.brand) {
      target.innerHTML = toString(
        renderFrame({
          back,
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "This image isn't available",
            body: "It may have been deleted, or its Playbook is no longer shared with you.",
          }),
        }),
      );
      return;
    }
    const { creation, brand, variation, format, layers } = d;
    if (state.selectedId && !layers.some((l) => l.id === state.selectedId)) state.selectedId = null;
    const selected = layers.find((l) => l.id === state.selectedId) || null;
    const logoPx = selected?.type === "logo" ? Math.round(selected.w * format.width) : 0;
    const restore = preserveFocus(target);
    const n = networkById(format.network);
    target.innerHTML = toString(
      renderFrame({
        back,
        body: html`
          <header class="imst-editor__head">
            <div>
              <h1 class="ap-h2">${creation.title}</h1>
              <p class="ap-caption">
                ${n.label} ${format.label.toLowerCase()} · ${formatRatio(format)} · ${format.width} × ${format.height}
              </p>
            </div>
            <div class="imst-editor__actions">
              <button
                type="button"
                class="ap-button ghost grey"
                data-imst-action="undo"
                ${canUndo(id) ? "" : "disabled"}
              >
                <i class="ap-icon-rotate-left" aria-hidden="true"></i><span>Undo</span>
              </button>
              <button type="button" class="ap-button stroked grey" data-imst-action="download">
                <i class="ap-icon-download" aria-hidden="true"></i><span>Download PNG</span>
              </button>
              <button type="button" class="ap-button primary orange" data-imst-action="apply-brand">
                <i class="ap-icon-sparkles" aria-hidden="true"></i><span>Apply the brand</span>
              </button>
            </div>
          </header>
          <div class="imst-editor">
            <aside class="imst-editor__side">${renderLayers(layers, state.selectedId)}</aside>
            <div class="imst-editor__stage">
              <div
                class="imst-stage${state.regen ? " is-busy" : ""}"
                style="--imst-stage-ratio: ${format.width / format.height}"
              >
                ${variationCanvas({
                  creation,
                  variation,
                  formatId: format.id,
                  brand,
                  layers,
                  interactive: true,
                  selectedId: state.selectedId,
                })}
                ${state.regen
                  ? html`<span class="imst-stage__busy" role="status"
                      ><span class="ap-loader size-30"></span
                      ><span class="ap-body-bold">New ${state.regen}…</span></span
                    >`
                  : ""}
              </div>
              ${renderWordsBar(state.nl)}
            </div>
            <aside class="imst-editor__side">
              ${renderProps({
                layer: selected,
                brand,
                format,
                unlock: state.unlock,
                canSave: canEditBrand(brand.id),
                logoPx,
              })}
              ${renderTextIdeas(
                state.ideas,
                layers.some((l) => l.type === "text"),
              )}
            </aside>
          </div>
        `,
      }),
    );
    restore();
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const layersNow = () => data()?.layers || [];
  const select = (layerId) => {
    state.selectedId = layerId;
    paint();
    target.querySelector(`[data-imst-layer="${layerId}"]`)?.focus({ preventScroll: true });
  };

  function addLayer(kind) {
    const before = new Set(layersNow().map((l) => l.id));
    const layers =
      kind === "text"
        ? addTextLayer(layersNow())
        : kind === "logo"
          ? addLogoLayer(layersNow())
          : addShapeLayer(layersNow());
    commit(layers, `Added ${kind}`);
    state.selectedId = layers.find((l) => !before.has(l.id))?.id || null;
    paint();
  }

  function openLibrary() {
    const { brand } = data();
    const products = getProducts(brand.id).filter((p) => p.imageAssetId);
    const refs = getAssets(brand.id, "reference");
    // Playbook reference images: only those the export can draw (same origin / data).
    const pbRefs = brand.imageStyle.references.filter((r) => /^(data:|blob:|\/|assets\/)/.test(r.url || ""));
    const tiles = [
      ...products.map((p) => ({ assetId: p.imageAssetId, name: p.name, media: assetImg(p.imageAssetId) })),
      ...refs.map((a) => ({ assetId: a.id, name: a.name, media: assetImg(a) })),
      ...pbRefs.map((r) => ({ href: r.url, name: r.label, media: html`<img src="${r.url}" alt="" />` })),
    ];
    const dialog = openDialog({
      title: "Add from the library",
      subtitle: `Products and reference images of ${brand.playbookName}.`,
      size: "lg",
      body: tiles.length
        ? html`<div class="imst-library">
            ${tiles.map(
              (t, i) =>
                html`<button type="button" class="ap-card imst-library__tile" data-imst-lib="${i}">
                  ${t.media}<span class="ap-caption">${t.name}</span>
                </button>`,
            )}
          </div>`
        : html`<p class="ap-body">Nothing here yet. Products and the reference images of your styles show up here.</p>`,
      onMount(el) {
        hydrateAssets(el);
        el.addEventListener("click", (event) => {
          const tile = event.target.closest("[data-imst-lib]");
          if (!tile) return;
          const t = tiles[Number(tile.dataset.imstLib)];
          const before = new Set(layersNow().map((l) => l.id));
          const layers = addAssetLayer(layersNow(), { assetId: t.assetId, href: t.href, name: t.name });
          dialog.close();
          warmAssetUrls([t.assetId]).then(() => {
            commit(layers, `Added ${t.name}`);
            state.selectedId = layers.find((l) => !before.has(l.id))?.id || null;
            paint();
          });
        });
      },
    });
  }

  function doApplyBrand() {
    const { layers, changes } = applyBrand(layersNow(), data().brand);
    commit(layers, "Applied the brand");
    toast(
      changes.length
        ? `Brand applied: ${changes.map((c) => CHANGE_WORDS[c]).join(", ")} fixed.`
        : "Everything already follows the brand.",
    );
    paint();
  }

  async function doDownload() {
    const { creation, brand, variation, format, layers } = data();
    try {
      await warmAssetUrls(layers.filter((l) => l.type === "asset").map((l) => l.props.assetId));
      const blob = await toPngBlob({
        svg: variationSvg({ creation, variation, formatId: format.id, brand }),
        width: format.width,
        height: format.height,
        layers: resolveLayers(layers, brand),
      });
      downloadBlob(blob, `${slug(creation.title)}-${format.id}.png`);
      toast(`Downloaded ${format.width} × ${format.height} PNG.`);
    } catch (error) {
      toast(
        error.name === "SecurityError"
          ? "One image comes from another site and can't be exported."
          : error.message || "The download failed.",
        { variant: "error" },
      );
    }
  }

  async function doWords() {
    const text = state.nl.text.trim();
    if (!text) return;
    state.nl = { status: "loading", text, message: "" };
    paint();
    try {
      const result = await editService.interpret(
        { instruction: text, layers: layersNow(), brand: data().brand },
        { signal: abort.signal },
      );
      if (result.understood) {
        commit(result.layers, `In words: ${text}`);
        state.nl = { status: "done", text: "", message: `Done: ${result.applied.join(", ")}.` };
      } else {
        state.nl = {
          status: "error",
          text,
          message: `I couldn't apply that one. Try "logo in white, bottom right", "bigger text", "add a band" or "lighter background".`,
        };
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      state.nl = { status: "error", text, message: "That edit failed. Try again." };
    }
    paint();
  }

  async function doRegen(part) {
    const { creation, brand, variation } = data();
    state.regen = part;
    paint();
    try {
      const next = await imageGenerationService.regenerate(
        variation,
        part,
        {
          brief: creation.brief,
          brand,
          style: creation.styleSnapshot,
          format: formatById(creation.master.formatId),
          textMode: creation.brief.textMode,
        },
        { signal: abort.signal },
      );
      replaceVariation(id, variation.id, next);
    } catch (error) {
      if (error.name === "AbortError") return;
      toast(`The new ${part} failed. Try again.`, { variant: "error" });
    }
    state.regen = null;
    paint();
  }

  async function doTextIdeas() {
    const { creation, brand } = data();
    state.ideas = { ...state.ideas, status: "loading" };
    paint();
    try {
      const round = (state.ideas.round ?? -1) + 1;
      const brief = creation.brief;
      const [hooks, ctas] = await Promise.all([
        copyService.hooks({ brand, brief, round }, { signal: abort.signal }),
        copyService.ctas({ brand, brief, round }, { signal: abort.signal }),
      ]);
      state.ideas = { status: "done", hooks, ctas, round };
    } catch (error) {
      if (error.name === "AbortError") return;
      state.ideas = { ...state.ideas, status: "error" };
      toast("No text ideas this time. Try again.", { variant: "error" });
    }
    paint();
  }

  function useText(text) {
    const layers = layersNow();
    const selected = layers.find((l) => l.id === state.selectedId && l.type === "text");
    const targetLayer = selected || layers.filter((l) => l.type === "text").sort((a, b) => b.z - a.z)[0];
    if (targetLayer) {
      commit(patchLayer(layers, targetLayer.id, { hidden: false, props: { content: text } }), "Text from ideas");
      state.selectedId = targetLayer.id;
    } else {
      const next = addTextLayer(layers, text);
      commit(next, "Text from ideas");
      state.selectedId = next[next.length - 1].id;
    }
    paint();
  }

  // ── Drag / resize (live DOM, one commit on release) ────────────────────────

  function onPointerDown(event) {
    const layerEl = event.target.closest("[data-imst-layer]");
    const stage = target.querySelector("[data-imst-stage]");
    if (!layerEl || !stage || event.button !== 0) return;
    const layerId = layerEl.dataset.imstLayer;
    const layer = layersNow().find((l) => l.id === layerId);
    if (!layer) return;
    if (state.selectedId !== layerId) {
      select(layerId);
    }
    if (layer.locked) return;
    event.preventDefault();
    const el = target.querySelector(`[data-imst-layer="${layerId}"]`);
    const rect = target.querySelector("[data-imst-stage]").getBoundingClientRect();
    state.drag = {
      id: layerId,
      mode: event.target.closest("[data-imst-handle]") ? "resize" : "move",
      startX: event.clientX,
      startY: event.clientY,
      rect,
      layer,
      el,
      next: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function onPointerMove(event) {
    const d = state.drag;
    if (!d) return;
    const dx = (event.clientX - d.startX) / d.rect.width;
    const dy = (event.clientY - d.startY) / d.rect.height;
    const l = d.layer;
    if (d.mode === "move") {
      d.next.x = l.x + dx;
      d.next.y = l.y + dy;
      d.el.style.left = `${d.next.x * 100}%`;
      d.el.style.top = `${d.next.y * 100}%`;
    } else {
      d.next.w = Math.max(0.04, Math.min(1, l.w + dx));
      // Logos and images keep their proportions — the brand forbids distortion.
      d.next.h =
        l.type === "text" ? l.h : l.type === "shape" ? Math.max(0.03, Math.min(1, l.h + dy)) : l.h * (d.next.w / l.w);
      d.el.style.width = `${d.next.w * 100}%`;
      d.el.style.height = `${d.next.h * 100}%`;
    }
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    const d = state.drag;
    state.drag = null;
    if (!d) return;
    const moved = d.next.x !== d.layer.x || d.next.y !== d.layer.y || d.next.w !== d.layer.w || d.next.h !== d.layer.h;
    if (!moved) return paint();
    const layers =
      d.mode === "move"
        ? moveLayer(layersNow(), d.id, d.next.x, d.next.y)
        : patchLayer(layersNow(), d.id, { w: d.next.w, h: d.next.h });
    commit(layers, d.mode === "move" ? `Moved ${layerName(d.layer)}` : `Resized ${layerName(d.layer)}`);
    paint();
  }

  function onKey(event) {
    if (!state.selectedId || event.target.matches("input, textarea, [contenteditable]")) return;
    const layer = layersNow().find((l) => l.id === state.selectedId);
    if (!layer) return;
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key] && !layer.locked) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      commit(moveLayer(layersNow(), layer.id, layer.x + dx, layer.y + dy), `Moved ${layerName(layer)}`);
      paint();
      target.querySelector(`[data-imst-layer="${layer.id}"]`)?.focus({ preventScroll: true });
    } else if ((event.key === "Delete" || event.key === "Backspace") && layer.type !== "image") {
      event.preventDefault();
      commit(removeLayer(layersNow(), layer.id), `Deleted ${layerName(layer)}`);
      state.selectedId = null;
      paint();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (undoLayers(id)) paint();
    }
  }

  // ── Property writes ────────────────────────────────────────────────────────

  function setProp(path, value) {
    const layer = layersNow().find((l) => l.id === state.selectedId);
    if (!layer) return;
    const key = path.replace(/^layer\./, "");
    if (key === "w") {
      const h = layer.type === "text" || layer.type === "shape" ? layer.h : layer.h * (value / layer.w);
      commit(patchLayer(layersNow(), layer.id, { w: value, h }), `Resized ${layerName(layer)}`);
    } else commit(patchLayer(layersNow(), layer.id, { props: { [key]: value } }), `Changed ${layerName(layer)}`);
  }

  paint();
  warmAssetUrls(
    layersNow()
      .filter((l) => l.type === "asset")
      .map((l) => l.props.assetId),
  ).then(paint);
  const offs = [
    subscribe(paint),
    () => abort.abort(),
    delegate(target, "pointerdown", "[data-imst-layer]", (event) => onPointerDown(event)),
    delegate(target, "click", "[data-imst-stage]", (event) => {
      if (!event.target.closest("[data-imst-layer]")) {
        const image = layersNow().find((l) => l.type === "image");
        if (image) select(image.id);
      }
    }),
    delegate(target, "keydown", "*", (event, el) => el === event.target && onKey(event)),
    delegate(target, "click", "[data-imst-select]", (_e, el) => select(el.dataset.imstSelect)),
    delegate(target, "click", "[data-imst-layer-toggle]", (_e, el) => {
      const layer = layersNow().find((l) => l.id === el.dataset.id);
      const key = el.dataset.imstLayerToggle;
      commit(
        patchLayer(layersNow(), layer.id, { [key]: !layer[key] }),
        `${key === "hidden" ? (layer.hidden ? "Showed" : "Hid") : layer.locked ? "Unlocked" : "Locked"} ${layerName(layer)}`,
      );
      paint();
    }),
    delegate(target, "click", "[data-imst-order]", (_e, el) => {
      commit(reorder(layersNow(), state.selectedId, Number(el.dataset.imstOrder)), "Reordered layers");
      paint();
    }),
    delegate(target, "input", "[data-imst-field]", (_e, el) => {
      const path = el.dataset.imstField;
      if (path === "words") state.nl.text = el.value;
      else if (path === "layer.content") {
        const layer = layersNow().find((l) => l.id === state.selectedId);
        const node = target.querySelector(`[data-imst-layer="${layer.id}"] span`);
        if (node) node.textContent = el.value;
      } else if (el.type === "range") {
        syncSlider(el);
      }
    }),
    delegate(target, "change", "[data-imst-field]", (_e, el) => {
      const path = el.dataset.imstField;
      if (path === "words") return;
      if (path.startsWith("unlock.")) {
        state.unlock[path.slice(7)] = el.checked;
        paint();
        return;
      }
      if (path === "layer.band") setProp(path, el.checked);
      else if (path === "layer.content") setProp(path, el.value);
      else if (el.type === "range") setProp(path, Number(el.value));
      paint();
    }),
    delegate(target, "change", "[data-imst-hex]", (_e, el) => {
      const hex = el.value.trim().startsWith("#") ? el.value.trim() : `#${el.value.trim()}`;
      if (!isHex(hex)) {
        toast(`${el.value} isn't a hex colour — use one like #1A1F36.`, { variant: "error" });
        return;
      }
      setProp("layer.hex", hex.toUpperCase());
      paint();
    }),
    delegate(target, "click", "[data-imst-color]", (_e, el) => {
      const layer = layersNow().find((l) => l.id === state.selectedId);
      if (el.dataset.imstColor === "band")
        commit(patchLayer(layersNow(), layer.id, { props: { bandRole: el.dataset.role } }), "Band colour");
      else
        commit(patchLayer(layersNow(), layer.id, { props: { colorRole: el.dataset.role, hex: undefined } }), "Colour");
      paint();
    }),
    delegate(target, "click", "[data-imst-align]", (_e, el) => {
      setProp("layer.align", el.dataset.imstAlign);
      paint();
    }),
    delegate(target, "click", "[data-imst-pick]", (_e, el) => {
      const pickId = el.dataset.imstPick;
      const v = el.dataset.value;
      if (pickId === "variant") setProp("layer.variant", v);
      else if (pickId === "font") {
        const layer = layersNow().find((l) => l.id === state.selectedId);
        const props = v.startsWith("role:") ? { fontRole: v.slice(5), family: undefined } : { family: v.slice(7) };
        commit(patchLayer(layersNow(), layer.id, { props }), "Font");
      }
      paint();
    }),
    delegate(target, "click", "[data-imst-save]", (_e, el) => {
      const { brand } = data();
      const ok =
        el.dataset.imstSave === "color"
          ? saveColorToPlaybook(brand.id, el.dataset.value)
          : saveFontToPlaybook(brand.id, "heading", el.dataset.value);
      toast(ok ? `Saved to ${brand.playbookName}.` : "You can't edit this Playbook.", {
        variant: ok ? "success" : "error",
      });
    }),
    delegate(target, "click", "[data-imst-regen]", (_e, el) => doRegen(el.dataset.imstRegen)),
    delegate(target, "click", "[data-imst-use-text]", (_e, el) => useText(el.dataset.imstUseText)),
    delegate(target, "submit", "[data-imst-form='words']", (event) => {
      event.preventDefault();
      doWords();
    }),
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const a = el.dataset.imstAction;
      if (a === "add-text") addLayer("text");
      else if (a === "add-logo") addLayer("logo");
      else if (a === "add-shape") addLayer("shape");
      else if (a === "add-asset") openLibrary();
      else if (a === "apply-brand") doApplyBrand();
      else if (a === "download") doDownload();
      else if (a === "text-ideas") doTextIdeas();
      else if (a === "undo") {
        if (undoLayers(id)) paint();
      } else if (a === "delete-layer") {
        const layer = layersNow().find((l) => l.id === state.selectedId);
        if (layer && layer.type !== "image") {
          commit(removeLayer(layersNow(), layer.id), `Deleted ${layerName(layer)}`);
          state.selectedId = null;
          paint();
        }
      }
    }),
  ];
  return () => {
    alive = false;
    window.removeEventListener("pointermove", onPointerMove);
    offs.forEach((off) => off());
  };
}
