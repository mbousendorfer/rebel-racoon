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

import { html, toString } from "../../lib/html.js?v=1307";
import { delegate } from "../../lib/delegate.js?v=1307";
import { renderFrame } from "../frame.js?v=1307";
import { renderEmpty } from "../../ui/empty.js?v=1307";
import { preserveFocus, syncSlider } from "../../ui/fields.js?v=1307";
import { openDialog } from "../../ui/dialog.js?v=1307";
import { toast } from "../../ui/toast.js?v=1307";
import { assetImg, hydrateAssets, warmAssetUrls } from "../../ui/asset.js?v=1307";
import { variationCanvas, variationSvg } from "../../ui/variation.js?v=1307";
import { formatById, formatRatio } from "../../config/formats.js?v=1307";
import { networkById } from "../../config/networks.js?v=1307";
import { isHex } from "../../model/schema.js?v=1307";
import { resolveLayers } from "../../render/layout.js?v=1307";
import { toPngBlob, downloadBlob, slug } from "../../render/export.js?v=1307";
import { copyService, editService, imageGenerationService } from "../../services/index.js?v=1307";
import {
  canEditBrand,
  getAssets,
  getBrand,
  getCreation,
  getProducts,
  saveColorToPlaybook,
  saveFontToPlaybook,
  subscribe,
} from "../../state/store.js?v=1307";
import { adaptEverywhere, replaceVariation, setCaption } from "../../state/creation-actions.js?v=1307";
import { attentionSpots, brandCheck, fixIssue, predictPerformance } from "../../state/checks.js?v=1307";
import { scoreRing } from "../../ui/ring.js?v=1307";
import { heatmapOverlay } from "../../ui/heatmap.js?v=1307";
import { COPY_LIMITS } from "../../config/copy-limits.js?v=1307";
import { FORMATS } from "../../config/formats.js?v=1307";
import { NETWORKS } from "../../config/networks.js?v=1307";
import { renderMockup, safeZoneOverlay } from "../../ui/mockups.js?v=1307";
import { menu } from "../../ui/menu.js?v=1307";
import { toggle } from "../../ui/fields.js?v=1307";
import { wait } from "../../lib/delegate.js?v=1307";
import {
  addAssetLayer,
  addLogoLayer,
  addShapeLayer,
  addTextLayer,
  applyBrand,
  canUndo,
  commitLayers,
  layersOf,
  moveLayer,
  patchLayer,
  removeLayer,
  reorder,
  undoLayers,
} from "../../state/editor-actions.js?v=1307";
import {
  renderChecks,
  renderLayers,
  renderPost,
  renderProps,
  renderSideTabs,
  renderTextIdeas,
  renderWordsBar,
  layerName,
} from "./panels.js?v=1307";

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
    formatId: new URLSearchParams(window.location.hash.split("?")[1] || "").get("format"),
    safeZones: false,
    adapting: false,
    sideTab: "layer",
    heatmap: false,
    check: null, // { status, sig, result }
    caption: { status: "idle" },
  };
  const openAdaptOnMount = new URLSearchParams(window.location.hash.split("?")[1] || "").get("adapt") === "1";
  let alive = true;
  const abort = new AbortController();

  const data = () => {
    const creation = getCreation(id);
    if (!creation || !creation.selectedVariationId) return null;
    const brand = getBrand(creation.brandId);
    const variation = creation.variations.find((v) => v.id === creation.selectedVariationId);
    if (!state.formatId || !creation.brief.formatIds.includes(state.formatId))
      state.formatId = creation.master.formatId;
    const format = formatById(state.formatId) || formatById("ig-post");
    const own = layersOf(creation, format.id);
    return { creation, brand, variation, format, layers: own || [], adapted: !!own };
  };

  const commit = (layers, action) => commitLayers(id, layers, { action, formatId: state.formatId });

  // What the brand check was computed for — any change to it makes the result stale.
  const signature = (d) =>
    JSON.stringify([d.format.id, d.variation.seed, d.variation.bgSeed, d.variation.subjectSeed, d.layers]);

  async function runCheck() {
    const d = data();
    if (!d || !d.adapted) return;
    const sig = signature(d);
    state.check = { status: "loading", sig: null };
    try {
      const result = await brandCheck({
        svg: variationSvg({ creation: d.creation, variation: d.variation, formatId: d.format.id, brand: d.brand }),
        brand: d.brand,
        format: d.format,
        layers: d.layers,
      });
      state.check = { status: "done", sig, result };
    } catch {
      state.check = { status: "done", sig, result: { score: 0, issues: [] } };
    }
    paint();
  }

  const setFormatInUrl = () =>
    history.replaceState(
      null,
      "",
      `#/image-generator/editor/${encodeURIComponent(id)}?format=${encodeURIComponent(state.formatId)}`,
    );

  const renderFormatTabs = (creation) => html`
    <div class="ap-tabs imst-format-tabs">
      <div class="ap-tabs-nav scrollable" role="tablist" aria-label="Formats">
        ${creation.brief.formatIds.map((fid) => {
          const f = formatById(fid);
          const n = networkById(f.network);
          const on = fid === state.formatId;
          const ready = !!layersOf(creation, fid);
          return html`<button
            type="button"
            class="ap-tabs-tab${on ? " active" : ""}"
            role="tab"
            aria-selected="${on}"
            data-imst-format="${fid}"
          >
            <i class="${n.icon}" aria-hidden="true"></i><span>${n.label} ${formatRatio(f)}</span>
            ${fid === creation.master.formatId
              ? html`<span class="ap-counter normal grey">Master</span>`
              : ready
                ? ""
                : html`<span class="ap-counter normal grey">To adapt</span>`}
          </button>`;
        })}
      </div>
    </div>
  `;

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
    const { creation, brand, variation, format, layers, adapted } = d;
    const adaptedCount = creation.brief.formatIds.filter((f) => layersOf(creation, f)).length;
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
                ${canUndo(id, format.id) ? "" : "disabled"}
              >
                <i class="ap-icon-rotate-left" aria-hidden="true"></i><span>Undo</span>
              </button>
              <button type="button" class="ap-button stroked grey" data-imst-action="apply-brand">
                <i class="ap-icon-sparkles" aria-hidden="true"></i><span>Apply the brand</span>
              </button>
              <button type="button" class="ap-button stroked grey" data-imst-action="preview">
                <i class="ap-icon-eye-on" aria-hidden="true"></i><span>Preview in context</span>
              </button>
              ${menu({
                label: "Download",
                trigger: {
                  className: "ap-button stroked grey",
                  label: "Download PNG",
                  content: html`<i class="ap-icon-download" aria-hidden="true"></i><span>Download</span
                    ><i class="ap-icon-chevron-down" aria-hidden="true"></i>`,
                },
                items: [
                  {
                    action: "download",
                    icon: "ap-icon-download",
                    label: "This format",
                    description: `${format.width} × ${format.height} PNG`,
                  },
                  {
                    action: "download-all",
                    icon: "ap-icon-download",
                    label: `All adapted formats (${adaptedCount})`,
                    description: "One PNG per format",
                  },
                ],
              })}
              <button
                type="button"
                class="ap-button primary orange${state.adapting ? " loading" : ""}"
                data-imst-action="adapt"
                ${state.adapting ? "disabled" : ""}
              >
                <i class="ap-icon-sparkles" aria-hidden="true"></i
                ><span>${state.adapting ? "Adapting…" : "Adapt everywhere"}</span>
              </button>
            </div>
          </header>
          <div class="imst-editor">
            <aside class="imst-editor__side">${renderLayers(layers, state.selectedId)}</aside>
            <div class="imst-editor__stage">
              ${renderFormatTabs(creation)}
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
                  interactive: adapted,
                  selectedId: state.selectedId,
                })}
                ${state.safeZones ? safeZoneOverlay(format) : ""}
                ${state.heatmap && adapted ? heatmapOverlay(attentionSpots({ variation, format, layers }), format) : ""}
                ${adapted
                  ? ""
                  : html`<span class="imst-stage__busy">
                      <span class="ap-body-bold">Not adapted to this format yet</span>
                      <button type="button" class="ap-button primary orange" data-imst-action="adapt-one">
                        <i class="ap-icon-sparkles" aria-hidden="true"></i
                        ><span>Adapt to ${networkById(format.network).label} ${formatRatio(format)}</span>
                      </button>
                    </span>`}
                ${state.regen
                  ? html`<span class="imst-stage__busy" role="status"
                      ><span class="ap-loader size-30"></span
                      ><span class="ap-body-bold">New ${state.regen}…</span></span
                    >`
                  : ""}
              </div>
              <div class="imst-stage__tools">
                ${toggle({ path: "view.safeZones", checked: state.safeZones, label: "Show safe zones" })}
                ${format.note ? html`<span class="ap-caption">${format.note}</span>` : ""}
              </div>
              ${renderWordsBar(state.nl)}
            </div>
            <aside class="imst-editor__side">
              ${renderSideTabs(state.sideTab)}
              ${state.sideTab === "post"
                ? renderPost({
                    network: networkById(format.network),
                    limits: COPY_LIMITS[format.network],
                    caption: creation.copy?.captions?.[format.network],
                    status: state.caption.status,
                  })
                : state.sideTab === "checks"
                  ? adapted
                    ? renderChecks({
                        check: state.check?.sig === signature(d) ? state.check : null,
                        perf: predictPerformance({
                          creation,
                          variation,
                          format,
                          layers,
                          check: state.check?.sig === signature(d) ? state.check.result : null,
                        }),
                        heatmap: state.heatmap,
                        ring: scoreRing,
                      })
                    : html`<section class="ap-card imst-panel">
                        <p class="ap-body imst-panel__hint">Adapt this format first.</p>
                      </section>`
                  : html`${renderProps({
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
                    )}`}
            </aside>
          </div>
        `,
      }),
    );
    restore();
    if (state.sideTab === "checks" && adapted && state.check?.status !== "loading" && state.check?.sig !== signature(d))
      runCheck();
    // Keep the active format tab visible in its scrolling bar (not the page).
    const nav = target.querySelector(".imst-format-tabs .ap-tabs-nav");
    const tab = nav?.querySelector(".ap-tabs-tab.active");
    if (
      nav &&
      tab &&
      (tab.offsetLeft < nav.scrollLeft || tab.offsetLeft + tab.offsetWidth > nav.scrollLeft + nav.clientWidth)
    ) {
      nav.scrollLeft = tab.offsetLeft - nav.clientWidth / 2 + tab.offsetWidth / 2;
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const layersNow = () => data()?.layers || [];
  const select = (layerId) => {
    state.selectedId = layerId;
    state.sideTab = "layer";
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

  async function downloadFormat(fid) {
    const creation = getCreation(id);
    const brand = getBrand(creation.brandId);
    const variation = creation.variations.find((v) => v.id === creation.selectedVariationId);
    const f = formatById(fid);
    const layers = layersOf(creation, fid);
    await warmAssetUrls(layers.filter((l) => l.type === "asset").map((l) => l.props.assetId));
    const blob = await toPngBlob({
      svg: variationSvg({ creation, variation, formatId: fid, brand }),
      width: f.width,
      height: f.height,
      layers: resolveLayers(layers, brand),
    });
    downloadBlob(blob, `${slug(creation.title)}-${fid}.png`);
  }

  const exportError = (error) =>
    toast(
      error.name === "SecurityError"
        ? "One image comes from another site and can't be exported."
        : error.message || "The download failed.",
      {
        variant: "error",
      },
    );

  async function doDownload() {
    const { format, adapted } = data();
    if (!adapted) {
      toast("Adapt this format first.", { variant: "error" });
      return;
    }
    try {
      await downloadFormat(format.id);
      toast(`Downloaded ${format.width} × ${format.height} PNG.`);
    } catch (error) {
      exportError(error);
    }
  }

  async function doDownloadAll() {
    const creation = getCreation(id);
    const ready = creation.brief.formatIds.filter((f) => layersOf(creation, f));
    try {
      for (const fid of ready) {
        await downloadFormat(fid);
        await wait(350); // browsers drop back-to-back downloads
      }
      toast(`Downloaded ${ready.length} PNG${ready.length === 1 ? "" : "s"}.`);
    } catch (error) {
      exportError(error);
    }
  }

  async function runAdapt(formatIds) {
    state.adapting = true;
    paint();
    // The mock "recomposes" — a real service would outpaint the background here.
    await wait(1200);
    if (!alive) return;
    const master = getCreation(id).master.formatId;
    const before = new Set(getCreation(id).adaptations.map((a) => a.formatId));
    adaptEverywhere(id, formatIds);
    state.adapting = false;
    const targets = formatIds.filter((f) => f !== master);
    state.formatId = targets.find((f) => !before.has(f)) || targets[0] || master;
    setFormatInUrl();
    toast(`Adapted to ${targets.length} format${targets.length === 1 ? "" : "s"} — recomposed, not cropped.`);
    paint();
  }

  function openAdaptDialog() {
    const creation = getCreation(id);
    const master = creation.master.formatId;
    const picked = new Set(creation.brief.formatIds);
    const body = () => html`
      <p class="ap-body imst-dialog__text">
        Each format is recomposed from the master: the background is redrawn at the new shape, the text and the logo
        move to where that format wants them. Formats already adapted are recomposed again.
      </p>
      <div class="imst-adapt-grid">
        ${NETWORKS.map(
          (n) =>
            html`<fieldset class="imst-adapt-group">
              <legend class="ap-body-bold"><i class="${n.icon}" aria-hidden="true"></i> ${n.label}</legend>
              ${FORMATS.filter((f) => f.network === n.id).map(
                (f) =>
                  html`<label class="ap-checkbox-container">
                    <input
                      type="checkbox"
                      value="${f.id}"
                      data-imst-adapt-pick
                      ${picked.has(f.id) ? "checked" : ""}
                      ${f.id === master ? "disabled" : ""}
                    />
                    <i></i><span>${f.label} · ${formatRatio(f)}${f.id === master ? " (master)" : ""}</span>
                  </label>`,
              )}
            </fieldset>`,
        )}
      </div>
    `;
    const count = () => [...picked].filter((f) => f !== master).length;
    const footer = () =>
      html`<div class="ap-dialog-footer-left">
          <button type="button" class="ap-button ghost grey" data-imst-adapt="all">Select all</button>
        </div>
        <div class="ap-dialog-footer-right">
          <button type="button" class="ap-button stroked grey" data-imst-adapt="cancel">Cancel</button>
          <button type="button" class="ap-button primary orange" data-imst-adapt="go" ${count() ? "" : "disabled"}>
            <i class="ap-icon-sparkles" aria-hidden="true"></i
            ><span>Adapt ${count()} format${count() === 1 ? "" : "s"}</span>
          </button>
        </div>`;
    const dialog = openDialog({
      title: "Adapt everywhere",
      subtitle: `From the master, ${networkById(formatById(master).network).label} ${formatRatio(formatById(master))}.`,
      size: "lg",
      body: body(),
      footer: footer(),
      onMount(el) {
        el.addEventListener("change", (event) => {
          const box = event.target.closest("[data-imst-adapt-pick]");
          if (!box) return;
          if (box.checked) picked.add(box.value);
          else picked.delete(box.value);
          dialog.setFooter(footer());
        });
        el.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-imst-adapt]");
          if (!btn) return;
          const what = btn.dataset.imstAdapt;
          if (what === "all") {
            FORMATS.forEach((f) => picked.add(f.id));
            dialog.setBody(body());
            dialog.setFooter(footer());
          } else if (what === "cancel") dialog.close();
          else {
            dialog.close();
            runAdapt([...picked]);
          }
        });
      },
    });
  }

  function openPreview() {
    const creation = getCreation(id);
    const brand = getBrand(creation.brandId);
    const variation = creation.variations.find((v) => v.id === creation.selectedVariationId);
    const ready = creation.brief.formatIds.filter((f) => layersOf(creation, f));
    const fallback = creation.brief.headline || creation.title;
    openDialog({
      title: "Preview in context",
      subtitle: `${ready.length} format${ready.length === 1 ? "" : "s"}, as each network shows them.`,
      size: "lg",
      body: html`<div class="imst-mocks">
        ${ready.map((fid) => {
          const f = formatById(fid);
          return renderMockup({
            format: f,
            brand,
            caption: creation.copy?.captions?.[f.network]?.text || fallback,
            canvas: variationCanvas({ creation, variation, formatId: fid, brand, layers: layersOf(creation, fid) }),
          });
        })}
      </div>`,
    });
  }

  async function doCaption() {
    const d = data();
    const network = d.format.network;
    state.caption = { status: "loading" };
    paint();
    try {
      const headline = d.layers.find((l) => l.type === "text")?.props.content || d.creation.brief.headline;
      const [text, hashtags] = await Promise.all([
        copyService.caption({ brand: d.brand, brief: d.creation.brief, network, headline }, { signal: abort.signal }),
        copyService.hashtags({ brand: d.brand, brief: d.creation.brief, network }, { signal: abort.signal }),
      ]);
      setCaption(id, network, { text, hashtags });
    } catch (error) {
      if (error.name === "AbortError") return;
      toast("The caption failed. Try again.", { variant: "error" });
    }
    state.caption = { status: "idle" };
    paint();
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
      if (undoLayers(id, state.formatId)) paint();
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
  if (openAdaptOnMount && data()) {
    history.replaceState(null, "", `#/image-generator/editor/${encodeURIComponent(id)}`);
    openAdaptDialog();
  }
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
      else if (path === "caption.text") {
        const limits = COPY_LIMITS[data().format.network];
        const counter = target.querySelector("[data-imst-counter]");
        if (counter) {
          counter.textContent = `${el.value.length} / ${limits.maxChars} characters${el.value.length > limits.maxChars ? " — too long" : ""}`;
          counter.classList.toggle("is-error", el.value.length > limits.maxChars);
        }
      } else if (path === "layer.content") {
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
      if (path === "caption.text") {
        setCaption(id, data().format.network, { text: el.value });
        return;
      }
      if (path === "view.heatmap") {
        state.heatmap = el.checked;
        paint();
        return;
      }
      if (path === "view.safeZones") {
        state.safeZones = el.checked;
        paint();
        return;
      }
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
    delegate(target, "click", "[data-imst-side]", (_e, el) => {
      state.sideTab = el.dataset.imstSide;
      paint();
    }),
    delegate(target, "click", "[data-imst-fix]", (_e, el) => {
      const d = data();
      const issues = state.check?.result?.issues || [];
      const chosen = el.dataset.imstFix === "all" ? issues : issues.filter((i) => i.id === el.dataset.imstFix);
      const layers = chosen.reduce(
        (acc, issue) => fixIssue(issue, acc, { brand: d.brand, format: d.format }),
        d.layers,
      );
      commit(layers, chosen.length > 1 ? `Fixed ${chosen.length} brand issues` : `Fixed: ${chosen[0].title}`);
      toast(chosen.length > 1 ? `${chosen.length} issues fixed.` : `Fixed: ${chosen[0].title.toLowerCase()}.`);
      paint();
    }),
    delegate(target, "click", "[data-imst-copy]", async (_e, el) => {
      const d = data();
      const cap = d.creation.copy?.captions?.[d.format.network] || {};
      const text = el.dataset.imstCopy === "caption" ? cap.text : (cap.hashtags || []).join(" ");
      try {
        await navigator.clipboard.writeText(text);
        toast(el.dataset.imstCopy === "caption" ? "Caption copied." : "Hashtags copied.");
      } catch {
        toast("Copying isn't allowed here — select the text and copy it.", { variant: "error" });
      }
    }),
    delegate(target, "click", "[data-imst-tag-remove]", (_e, el) => {
      const d = data();
      const cap = d.creation.copy?.captions?.[d.format.network] || {};
      setCaption(id, d.format.network, {
        hashtags: (cap.hashtags || []).filter((_, i) => i !== Number(el.dataset.imstTagRemove)),
      });
      paint();
    }),
    delegate(target, "click", "[data-imst-format]", (_e, el) => {
      state.formatId = el.dataset.imstFormat;
      state.selectedId = null;
      setFormatInUrl();
      paint();
    }),
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
      else if (a === "download-all") doDownloadAll();
      else if (a === "adapt") openAdaptDialog();
      else if (a === "adapt-one") runAdapt([state.formatId]);
      else if (a === "preview") openPreview();
      else if (a === "caption") doCaption();
      else if (a === "text-ideas") doTextIdeas();
      else if (a === "undo") {
        if (undoLayers(id, state.formatId)) paint();
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
