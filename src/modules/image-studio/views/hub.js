// Image Generator — Generate: the studio. The whole screen is the tool.
//
//   CONTROLS (left column, Generate always in reach at its foot)
//     brand applied · the prompt · the style as a picture (6 quick picks + the
//     full gallery) · the shape drawn to scale · the product as a thumbnail ·
//     text on the image and how it's set
//   CANVAS (the rest)
//     before generating — a LIVE preview of what the choices give, in the
//       brand's colours, redrawn on every change: nothing is picked blind
//     generating — the shape, shimmering, with what's being made in words
//     after — the chosen variation LARGE, its actions beside it, the four as a
//       filmstrip, "Refine" to iterate in place, earlier runs underneath
//
// Deep links: ?creation=<id> reopens a run · ?style=<id> / ?product=<id> preselect.

import { html, toString } from "../lib/html.js?v=1317";
import { delegate } from "../lib/delegate.js?v=1317";
import { hashString } from "../lib/prng.js?v=1317";
import { renderFrame } from "./frame.js?v=1317";
import { renderEmpty } from "../ui/empty.js?v=1317";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1317";
import { preserveFocus } from "../ui/fields.js?v=1317";
import { toast } from "../ui/toast.js?v=1317";
import { swatch } from "../ui/swatch.js?v=1317";
import { assetImg, hydrateAssets, logoUrl, warmAssetUrls } from "../ui/asset.js?v=1317";
import { styleThumb } from "../ui/style-thumb.js?v=1317";
import { openDialog } from "../ui/dialog.js?v=1317";
import { variationCanvas, variationSvg, layersFor } from "../ui/variation.js?v=1317";
import { STYLE_FAMILIES, STYLE_PRESETS } from "../config/style-presets.js?v=1317";
import { FORMAT_SHAPES, formatById, shapeForFormat } from "../config/formats.js?v=1317";
import { networkById } from "../config/networks.js?v=1317";
import { imageGenerationService } from "../services/index.js?v=1317";
import { resolveLayers } from "../render/layout.js?v=1317";
import { toPngBlob, downloadBlob, slug } from "../render/export.js?v=1317";
import {
  getActiveBrand,
  getCreation,
  getProducts,
  getStyle,
  getStylesForBrand,
  subscribe,
} from "../state/store.js?v=1317";
import {
  addBatch,
  deleteCreation,
  openVariation,
  replaceVariation,
  startCreation,
  toggleFavorite,
} from "../state/creation-actions.js?v=1317";

// The presets offered first when the brand has few styles of its own — one per
// family, the ones that read best at thumbnail size.
const QUICK_PRESETS = [
  "preset-lifestyle",
  "preset-clay",
  "preset-flat",
  "preset-big-number",
  "preset-editorial",
  "preset-packshot",
  "preset-retro",
];

const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] || "");

function defaultBrief(brand) {
  const own = getStylesForBrand(brand.id).find((s) => s.kind === "custom");
  return {
    prompt: "",
    headline: "",
    styleId: own?.id || "preset-lifestyle",
    productId: null,
    formatIds: ["ig-post"],
    textMode: "layer",
  };
}

export function mount(target, _params, ctx) {
  const state = {
    brandId: null,
    brief: null,
    creationId: hashParams().get("creation"),
    focusId: null,
    run: { status: "idle" }, // idle | loading | error
    busy: new Set(), // variation ids being regenerated
    refine: "",
    warning: "",
    error: "",
    abort: null,
  };
  let alive = true;

  const brandChanged = (brand) => {
    state.brandId = brand?.id || null;
    state.brief = brand ? defaultBrief(brand) : null;
    state.focusId = null;
    const reopened = state.creationId ? getCreation(state.creationId) : null;
    if (reopened && reopened.brandId === state.brandId)
      state.brief = { ...state.brief, ...structuredClone(reopened.brief), formatIds: [reopened.brief.formatIds[0]] };
    else state.creationId = null;
    const styleParam = hashParams().get("style");
    if (brand && styleParam && getStyle(styleParam)) state.brief.styleId = styleParam;
    const productParam = hashParams().get("product");
    if (brand && productParam && getProducts(brand.id).some((p) => p.id === productParam))
      state.brief.productId = productParam;
    if (brand) warmAssetUrls(getProducts(brand.id).map((p) => p.imageAssetId)).then(paint);
  };

  const setCreationInUrl = (id) =>
    history.replaceState(null, "", id ? `#/image-generator?creation=${encodeURIComponent(id)}` : "#/image-generator");

  const currentCreation = () => (state.creationId ? getCreation(state.creationId) : null);
  const latestBatch = (c) => (c.batches?.length ? c.batches[0] : { id: null, label: "Variations" });
  const batchVariations = (c, batch) => c.variations.filter((v) => (v.batchId ?? null) === batch.id);
  const focused = (c) => {
    const current = batchVariations(c, latestBatch(c));
    return c.variations.find((v) => v.id === state.focusId) || current[0] || c.variations[0] || null;
  };

  // ── Controls ───────────────────────────────────────────────────────────────

  const quickStyles = (brand) => {
    const own = getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
    const list = [...own, ...QUICK_PRESETS.map(getStyle).filter(Boolean)].filter(
      (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
    );
    const selected = getStyle(state.brief.styleId);
    const top = list.slice(0, 6);
    if (selected && !top.some((s) => s.id === selected.id)) top[5] = selected;
    return top;
  };

  const renderBrandRow = (brand) => {
    const logo = logoUrl(brand, "icon") || logoUrl(brand, "color");
    return html`
      <div class="imst-ctl-brand">
        ${logo ? html`<img class="imst-ctl-brand__logo" src="${logo}" alt="" />` : ""}
        <div class="imst-ctl-brand__text">
          <span class="ap-body-bold">${brand.name}</span>
          <span class="imst-palette" aria-label="Brand colours"
            >${brand.palette.slice(0, 5).map((c) => swatch(c.hex, { label: c.name, size: "sm" }))}</span
          >
        </div>
        ${renderBrandPicker()}
      </div>
    `;
  };

  const renderControls = (brand) => {
    const b = state.brief;
    const style = getStyle(b.styleId);
    const shape = shapeForFormat(b.formatIds[0]);
    const products = getProducts(brand.id);
    const canEmbed = !!style?.supportsEmbeddedText;
    const running = state.run.status === "loading";
    return html`
      <aside class="imst-controls" aria-label="Describe the image">
        <div class="imst-controls__scroll">
          ${renderBrandRow(brand)}

          <section class="imst-ctl">
            <label class="imst-ctl__label ap-body-bold" for="imst-prompt">Describe the image</label>
            <div class="ap-textarea-field imst-ctl-prompt">
              <textarea
                id="imst-prompt"
                rows="5"
                data-imst-field="prompt"
                placeholder="e.g. A dog running through autumn leaves at sunrise, wearing the collar"
              >
${b.prompt}</textarea
              >
            </div>
            ${state.error ? html`<span class="ap-form-message error" role="alert">${state.error}</span>` : ""}
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-style">
            <header class="imst-ctl__head">
              <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-style">Style</h3>
              <button type="button" class="ap-link" data-imst-action="all-styles">All styles</button>
            </header>
            <div class="imst-style-now">
              ${styleThumb(style, brand, {
                className: "imst-style-now__thumb",
                kind: "object",
                seed: hashString(style.id),
              })}
              <div class="imst-style-now__text">
                <span class="ap-body-bold">${style.label}</span>
                <span class="ap-caption"
                  >${style.description || (style.kind === "custom" ? `A style of ${brand.name}'s` : "")}</span
                >
                ${style.kind === "custom"
                  ? html`<span class="ap-tag grey mini"><span>${brand.name}'s style</span></span>`
                  : ""}
              </div>
            </div>
            <div class="imst-style-quick" role="radiogroup" aria-labelledby="imst-ctl-style">
              ${quickStyles(brand).map(
                (s) =>
                  html`<button
                    type="button"
                    class="imst-style-pick"
                    role="radio"
                    aria-checked="${s.id === b.styleId}"
                    data-imst-style="${s.id}"
                    title="${s.label}"
                  >
                    ${styleThumb(s, brand, { className: "imst-style-pick__thumb", seed: hashString(s.id) })}
                    <span class="ap-caption imst-style-pick__name">${s.label}</span>
                  </button>`,
              )}
            </div>
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-shape">
            <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-shape">Shape</h3>
            <div class="imst-shapes" role="radiogroup" aria-labelledby="imst-ctl-shape">
              ${FORMAT_SHAPES.map(
                (s) =>
                  html`<button
                    type="button"
                    class="imst-shape"
                    role="radio"
                    aria-checked="${s.id === shape.id}"
                    data-imst-shape="${s.id}"
                    aria-label="${s.label} ${s.ratio}"
                  >
                    <span class="imst-shape__box"
                      ><span
                        class="imst-shape__frame"
                        style="aspect-ratio: ${s.w} / ${s.h}; ${s.w >= s.h ? "width: 100%" : "height: 100%"}"
                      ></span
                    ></span>
                    <span class="ap-caption imst-shape__name">${s.label}</span>
                    <span class="imst-shape__nets" aria-hidden="true"
                      >${s.networks.map((n) => html`<i class="${networkById(n).icon}"></i>`)}</span
                    >
                  </button>`,
              )}
            </div>
          </section>

          ${products.length
            ? html`<section class="imst-ctl" aria-labelledby="imst-ctl-product">
                <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-product">
                  Product <span class="ap-caption">optional</span>
                </h3>
                <div class="imst-products" role="radiogroup" aria-labelledby="imst-ctl-product">
                  <button
                    type="button"
                    class="imst-product-pick imst-product-pick--none"
                    role="radio"
                    aria-checked="${!b.productId}"
                    data-imst-product=""
                  >
                    <span class="imst-product-pick__thumb"><i class="ap-icon-close" aria-hidden="true"></i></span
                    ><span class="ap-caption">None</span>
                  </button>
                  ${products.map(
                    (p) =>
                      html`<button
                        type="button"
                        class="imst-product-pick"
                        role="radio"
                        aria-checked="${b.productId === p.id}"
                        data-imst-product="${p.id}"
                        title="${p.name}"
                      >
                        <span class="imst-product-pick__thumb"
                          >${p.imageAssetId
                            ? assetImg(p.imageAssetId)
                            : html`<i class="ap-icon-product-tag" aria-hidden="true"></i>`}</span
                        >
                        <span class="ap-caption imst-product-pick__name">${p.name}</span>
                      </button>`,
                  )}
                </div>
              </section>`
            : ""}

          <section class="imst-ctl" aria-labelledby="imst-ctl-text">
            <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-text">
              Text on the image <span class="ap-caption">optional</span>
            </h3>
            <div class="ap-input-group">
              <input
                type="text"
                class="ap-input"
                data-imst-field="headline"
                value="${b.headline}"
                placeholder="e.g. Every walk, remembered"
                aria-labelledby="imst-ctl-text"
              />
            </div>
            <div class="imst-ctl-radios" role="radiogroup" aria-label="How the text is set">
              <label class="ap-radio-container">
                <input
                  type="radio"
                  name="imst-textmode"
                  value="layer"
                  data-imst-textmode
                  ${b.textMode === "layer" ? "checked" : ""}
                />
                <span>An editable layer</span>
              </label>
              <label class="ap-radio-container">
                <input
                  type="radio"
                  name="imst-textmode"
                  value="embedded"
                  data-imst-textmode
                  ${b.textMode === "embedded" ? "checked" : ""}
                  ${canEmbed ? "" : "disabled"}
                />
                <span
                  >Written into the
                  image${canEmbed ? "" : html` <span class="ap-caption">— not with ${style.label}</span>`}</span
                >
              </label>
            </div>
            ${state.warning
              ? html`<span class="ap-caption imst-ctl__warn" role="status"
                  ><i class="ap-icon-warning_fill" aria-hidden="true"></i> ${state.warning}</span
                >`
              : ""}
          </section>
        </div>
        <footer class="imst-controls__foot">
          <span class="ap-caption">4 variations · ${shape.label.toLowerCase()} ${shape.ratio}</span>
          <button
            type="button"
            class="ap-button primary orange${running ? " loading" : ""}"
            data-imst-action="generate"
            ${running ? "disabled" : ""}
          >
            <i class="ap-icon-sparkles" aria-hidden="true"></i><span>${running ? "Generating…" : "Generate"}</span>
          </button>
        </footer>
      </aside>
    `;
  };

  // ── Canvas ─────────────────────────────────────────────────────────────────

  const stageFrame = (format, inner, extra = "") => html`
    <div class="imst-stage2" style="--imst-ratio: ${format.width / format.height}">
      <div class="imst-stage2__frame ${extra}">${inner}</div>
    </div>
  `;

  const renderPreview = (brand) => {
    const b = state.brief;
    const style = getStyle(b.styleId);
    const format = formatById(b.formatIds[0]);
    const pseudo = { title: "Preview", brief: { ...b }, styleSnapshot: style, master: { layers: [] } };
    const seed = hashString(`${style.id}|${b.productId || ""}|${b.prompt.length > 10 ? b.prompt.slice(0, 40) : ""}`);
    return html`
      <div class="imst-canvas-area imst-canvas-area--preview">
        ${stageFrame(
          format,
          html`${variationCanvas({
              creation: pseudo,
              variation: { seed, bgSeed: seed ^ 91, subjectSeed: seed ^ 17 },
              formatId: format.id,
              brand,
            })}<span class="ap-tag grey imst-stage2__badge"><span>Preview</span></span>`,
          "is-preview",
        )}
        <p class="ap-body imst-canvas-area__caption">
          <span class="ap-body-bold">A preview of ${style.label} in ${brand.name}'s colours.</span>
          Describe what you want and generate — you'll get four variations to pick from.
        </p>
      </div>
    `;
  };

  const renderLoading = () => {
    const format = formatById(state.brief.formatIds[0]);
    const style = getStyle(state.brief.styleId);
    return html`
      <div class="imst-canvas-area" aria-live="polite" aria-busy="true">
        ${stageFrame(
          format,
          html`<span class="imst-shimmer"></span
            ><span class="imst-stage2__status"
              ><span class="ap-loader size-30"></span
              ><span class="ap-body-bold">Generating 4 variations in ${style.label}…</span></span
            >`,
        )}
        <div class="imst-filmstrip">
          ${Array.from(
            { length: 4 },
            () =>
              html`<span
                class="imst-filmstrip__item is-loading"
                style="aspect-ratio: ${format.width} / ${format.height}"
                ><span class="imst-shimmer"></span
              ></span>`,
          )}
        </div>
      </div>
    `;
  };

  const renderError = () => html`
    <div class="imst-canvas-area imst-canvas-area--center">
      <div class="ap-infobox error" role="alert">
        <i class="ap-icon-warning_fill" aria-hidden="true"></i>
        <div class="ap-infobox-content">
          <div class="ap-infobox-texts">
            <div class="ap-infobox-title">Generation failed</div>
            <div class="ap-infobox-message">Nothing was lost — your brief is still on the left.</div>
          </div>
          <button type="button" class="ap-button ghost blue" data-imst-action="generate">Try again</button>
        </div>
      </div>
    </div>
  `;

  const renderResults = (brand, c) => {
    const format = formatById(c.brief.formatIds[0]);
    const v = focused(c);
    const batch = c.batches?.find((x) => x.id === v.batchId) || latestBatch(c);
    const strip = batchVariations(c, batch);
    const index = strip.findIndex((x) => x.id === v.id);
    const fav = (c.favoriteVariationIds || []).includes(v.id);
    const busy = state.busy.has(v.id);
    const style = c.styleSnapshot || getStyle(c.brief.styleId);
    const earlier = (c.batches || []).filter((x) => x.id !== batch.id);
    return html`
      <div class="imst-canvas-area">
        <header class="imst-result-bar">
          <div class="imst-result-bar__what">
            <span class="ap-body-bold">${batch.label} · variation ${index + 1} of ${strip.length}</span>
            <span class="ap-caption"
              >${style?.label || "Style"} · ${shapeForFormat(format.id).label} ${shapeForFormat(format.id).ratio}</span
            >
          </div>
          <div class="imst-result-bar__actions">
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="regenerate"
              aria-label="Regenerate this variation"
              data-tooltip="Regenerate"
              ${busy ? "disabled" : ""}
            >
              <i class="ap-icon-refresh" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="favorite"
              aria-pressed="${fav}"
              aria-label="${fav ? "Remove from favourites" : "Add to favourites"}"
              data-tooltip="${fav ? "In favourites" : "Favourite"}"
            >
              <i class="${fav ? "ap-icon-heart_fill" : "ap-icon-heart"}" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="download"
              aria-label="Download as PNG"
              data-tooltip="Download PNG"
            >
              <i class="ap-icon-download" aria-hidden="true"></i>
            </button>
            <button type="button" class="ap-button stroked grey" data-imst-var="similar">
              <i class="ap-icon-sparkles" aria-hidden="true"></i><span>More like this</span>
            </button>
            <button type="button" class="ap-button stroked grey" data-imst-var="adapt">
              <i class="ap-icon-view-grid" aria-hidden="true"></i><span>Adapt everywhere</span>
            </button>
            <button type="button" class="ap-button primary blue" data-imst-var="edit">
              <i class="ap-icon-pen" aria-hidden="true"></i><span>Edit</span>
            </button>
          </div>
        </header>
        ${stageFrame(
          format,
          html`${variationCanvas({ creation: c, variation: v, formatId: format.id, brand })}${busy
            ? html`<span class="imst-stage2__status"
                ><span class="ap-loader size-30"></span><span class="ap-body-bold">Regenerating…</span></span
              >`
            : ""}`,
        )}
        <div class="imst-filmstrip" role="listbox" aria-label="${batch.label}" data-imst-strip>
          ${strip.map(
            (x, i) =>
              html`<button
                type="button"
                class="imst-filmstrip__item"
                role="option"
                aria-selected="${x.id === v.id}"
                data-imst-focus="${x.id}"
                aria-label="Variation ${i + 1}"
                style="aspect-ratio: ${format.width} / ${format.height}"
              >
                ${variationCanvas({ creation: c, variation: x, formatId: format.id, brand })}
                ${(c.favoriteVariationIds || []).includes(x.id)
                  ? html`<i class="ap-icon-heart_fill imst-filmstrip__fav" aria-label="In favourites"></i>`
                  : ""}
              </button>`,
          )}
        </div>
        <form class="imst-refine" data-imst-form="refine">
          <div class="ap-input-group imst-refine__input">
            <i class="ap-icon-sparkles" aria-hidden="true"></i>
            <input
              type="text"
              class="ap-input"
              data-imst-field="refine"
              value="${state.refine}"
              placeholder="Refine this one — e.g. warmer light, closer on the product"
              aria-label="Refine this variation"
            />
          </div>
          <button type="submit" class="ap-button primary orange" ${state.run.status === "loading" ? "disabled" : ""}>
            <span>Refine</span>
          </button>
        </form>
        ${earlier.length
          ? html`<section class="imst-earlier" aria-labelledby="imst-earlier-title">
              <h3 class="ap-body-bold" id="imst-earlier-title">Earlier in this image</h3>
              ${earlier.map(
                (bt) =>
                  html`<div class="imst-earlier__row">
                    <span class="ap-caption imst-earlier__label">${bt.label}</span>
                    <div class="imst-earlier__thumbs">
                      ${batchVariations(c, bt).map(
                        (x, i) =>
                          html`<button
                            type="button"
                            class="imst-filmstrip__item imst-filmstrip__item--small"
                            data-imst-focus="${x.id}"
                            aria-label="${bt.label}, variation ${i + 1}"
                            style="aspect-ratio: ${format.width} / ${format.height}"
                          >
                            ${variationCanvas({ creation: c, variation: x, formatId: format.id, brand })}
                          </button>`,
                      )}
                    </div>
                  </div>`,
              )}
            </section>`
          : ""}
      </div>
    `;
  };

  const renderCanvas = (brand) => {
    if (state.run.status === "loading") return renderLoading();
    if (state.run.status === "error") return renderError();
    const c = currentCreation();
    if (c && c.variations.length) return renderResults(brand, c);
    return renderPreview(brand);
  };

  const paint = () => {
    if (!alive) return;
    const brand = getActiveBrand();
    if ((brand?.id || null) !== state.brandId) brandChanged(brand);
    const restore = preserveFocus(target);
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          section: "create",
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "Start with a Playbook",
            body: "Images follow a brand, and your brand lives in a Playbook: its logo, colours, fonts and rules. Create one from your website, your files, or by hand.",
            action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
              <span>Create a Playbook</span>
            </button>`,
          }),
        }),
      );
      return;
    }
    target.innerHTML = toString(
      renderFrame({
        section: "create",
        fill: true,
        body: html`<div class="imst-studio">
          ${renderControls(brand)}
          <main class="imst-canvas-col">${renderCanvas(brand)}</main>
        </div>`,
      }),
    );
    hydrateAssets(target);
    restore();
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const request = (brand, brief = state.brief, style = getStyle(brief.styleId)) => ({
    brief,
    brand,
    style,
    product: brief.productId ? getProducts(brand.id).find((p) => p.id === brief.productId) : null,
    format: formatById(brief.formatIds[0]),
    textMode: brief.textMode,
    text: { headline: brief.headline },
  });

  async function generate() {
    const brand = getActiveBrand();
    if (!state.brief.prompt.trim()) {
      state.error = "Describe the image first.";
      paint();
      target.querySelector("#imst-prompt")?.focus();
      return;
    }
    state.error = "";
    const req = request(brand);
    const creation = startCreation({ brand, brief: { ...state.brief }, style: req.style });
    state.creationId = creation.id;
    state.focusId = null;
    setCreationInUrl(creation.id);
    state.run = { status: "loading" };
    state.abort = new AbortController();
    paint();
    try {
      const variations = await imageGenerationService.generate(req, { signal: state.abort.signal });
      addBatch(creation.id, variations, { label: "4 variations" });
      state.run = { status: "idle" };
    } catch (error) {
      if (error.name === "AbortError") return;
      deleteCreation(creation.id);
      state.creationId = null;
      setCreationInUrl(null);
      state.run = { status: "error" };
    }
    paint();
  }

  /** More like this / Refine: a new batch close to the focused variation. */
  async function iterate(refinement = "") {
    const brand = getActiveBrand();
    const c = currentCreation();
    const base = focused(c);
    const brief = refinement ? { ...c.brief, prompt: `${c.brief.prompt}. ${refinement}` } : c.brief;
    const n =
      batchVariations(c, c.batches?.find((x) => x.id === base.batchId) || latestBatch(c)).findIndex(
        (x) => x.id === base.id,
      ) + 1;
    state.run = { status: "loading" };
    paint();
    try {
      const vars = await imageGenerationService.similar(base, request(brand, brief, c.styleSnapshot), {});
      addBatch(c.id, vars, {
        label: refinement ? `Refined: ${refinement}` : `Like variation ${n}`,
        parentVariationId: base.id,
      });
      state.focusId = null;
      state.refine = "";
      state.run = { status: "idle" };
    } catch {
      state.run = { status: "idle" };
      toast("Those variations failed. Try again.", { variant: "error" });
    }
    paint();
  }

  async function regenerate() {
    const brand = getActiveBrand();
    const c = currentCreation();
    const v = focused(c);
    state.busy.add(v.id);
    paint();
    try {
      const next = await imageGenerationService.regenerate(v, "all", request(brand, c.brief, c.styleSnapshot));
      replaceVariation(c.id, v.id, next);
    } catch {
      toast("That variation failed to regenerate. Try again.", { variant: "error" });
    }
    state.busy.delete(v.id);
    paint();
  }

  async function download() {
    const brand = getActiveBrand();
    const c = currentCreation();
    const v = focused(c);
    const f = formatById(c.brief.formatIds[0]);
    try {
      const blob = await toPngBlob({
        svg: variationSvg({ creation: c, variation: v, formatId: f.id, brand }),
        width: f.width,
        height: f.height,
        layers: resolveLayers(layersFor({ creation: c, formatId: f.id }), brand),
      });
      downloadBlob(blob, `${slug(c.title)}-${f.id}.png`);
      toast(`Downloaded ${f.width} × ${f.height} PNG.`);
    } catch (error) {
      toast(error.message || "The download failed.", { variant: "error" });
    }
  }

  function openStyleGallery() {
    const brand = getActiveBrand();
    let family = "all";
    const own = getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
    const body = () => html`
      <div class="imst-chips" role="group" aria-label="Filter styles">
        ${[
          { id: "all", label: "All" },
          ...(own.length ? [{ id: "own", label: `${brand.name}'s` }] : []),
          ...STYLE_FAMILIES,
        ].map(
          (f) =>
            html`<button
              type="button"
              class="ap-filter-chip"
              aria-pressed="${family === f.id}"
              data-imst-family="${f.id}"
            >
              ${f.label}
            </button>`,
        )}
      </div>
      <div class="imst-gallery">
        ${[...own, ...STYLE_PRESETS]
          .filter((s) => family === "all" || (family === "own" ? s.kind === "custom" : s.family === family))
          .map(
            (s) =>
              html`<button
                type="button"
                class="imst-gallery__item"
                aria-pressed="${s.id === state.brief.styleId}"
                data-imst-pick-style="${s.id}"
              >
                ${styleThumb(s, brand, { seed: hashString(s.id) })}
                <span class="imst-gallery__text"
                  ><span class="ap-body-bold">${s.label}</span><span class="ap-caption">${s.description}</span></span
                >
              </button>`,
          )}
      </div>
    `;
    const dialog = openDialog({
      title: "Styles",
      subtitle: `Every one drawn in ${brand.name}'s colours.`,
      size: "lg",
      body: body(),
      onMount(el) {
        el.addEventListener("click", (event) => {
          const chip = event.target.closest("[data-imst-family]");
          if (chip) {
            family = chip.dataset.imstFamily;
            dialog.setBody(body());
            return;
          }
          const pick = event.target.closest("[data-imst-pick-style]");
          if (!pick) return;
          setStyle(pick.dataset.imstPickStyle);
          dialog.close();
        });
      },
    });
  }

  function setStyle(styleId) {
    state.brief.styleId = styleId;
    const style = getStyle(styleId);
    if (state.brief.textMode === "embedded" && !style?.supportsEmbeddedText) {
      state.brief.textMode = "layer";
      state.warning = `${style.label} can't write text into the image, so the text goes on an editable layer.`;
    } else state.warning = "";
    leaveResults();
    paint();
  }

  // Changing the brief after a run goes back to the live preview of the new choices.
  function leaveResults() {
    if (state.run.status === "loading") return;
    if (currentCreation()) {
      state.creationId = null;
      state.focusId = null;
      setCreationInUrl(null);
    }
    state.run = { status: "idle" };
  }

  paint();
  const offs = [
    subscribe(paint),
    delegate(target, "input", "[data-imst-field]", (_e, el) => {
      const f = el.dataset.imstField;
      if (f === "refine") state.refine = el.value;
      else {
        state.brief[f] = el.value;
        if (f === "prompt" && state.error) {
          state.error = "";
          target.querySelector(".imst-ctl .ap-form-message.error")?.remove();
        }
      }
    }),
    // The preview follows the text on the image once you're done typing.
    delegate(target, "change", "[data-imst-field='headline']", () => {
      if (!currentCreation()) paint();
    }),
    delegate(target, "keydown", "#imst-prompt", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        generate();
      }
    }),
    delegate(target, "click", "[data-imst-style]", (_e, el) => setStyle(el.dataset.imstStyle)),
    delegate(target, "click", "[data-imst-shape]", (_e, el) => {
      state.brief.formatIds = [FORMAT_SHAPES.find((s) => s.id === el.dataset.imstShape).formatId];
      leaveResults();
      paint();
    }),
    delegate(target, "click", "[data-imst-product]", (_e, el) => {
      state.brief.productId = el.dataset.imstProduct || null;
      leaveResults();
      paint();
    }),
    delegate(target, "change", "[data-imst-textmode]", (_e, el) => {
      state.brief.textMode = el.value;
      state.warning = "";
      if (!currentCreation()) paint();
    }),
    delegate(target, "click", "[data-imst-focus]", (_e, el) => {
      state.focusId = el.dataset.imstFocus;
      paint();
      target.querySelector(`[data-imst-focus="${state.focusId}"]`)?.focus({ preventScroll: true });
    }),
    delegate(target, "keydown", "[data-imst-strip]", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const items = [...target.querySelectorAll("[data-imst-strip] [data-imst-focus]")];
      const i = items.findIndex((x) => x.getAttribute("aria-selected") === "true");
      const next = items[(i + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
      if (next) next.click();
      event.preventDefault();
    }),
    delegate(target, "submit", "[data-imst-form='refine']", (event) => {
      event.preventDefault();
      if (!state.refine.trim()) {
        target.querySelector("[data-imst-field='refine']")?.focus();
        return;
      }
      iterate(state.refine.trim());
    }),
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const a = el.dataset.imstAction;
      if (a === "generate") generate();
      else if (a === "all-styles") openStyleGallery();
    }),
    delegate(target, "click", "[data-imst-var]", (_e, el) => {
      const c = currentCreation();
      const v = focused(c);
      const a = el.dataset.imstVar;
      if (a === "regenerate") regenerate();
      else if (a === "similar") iterate();
      else if (a === "favorite") {
        const next = toggleFavorite(c.id, v.id);
        toast(next.favoriteVariationIds.includes(v.id) ? "Added to favourites." : "Removed from favourites.");
      } else if (a === "download") download();
      else if (a === "edit" || a === "adapt") {
        openVariation(c.id, v.id);
        ctx.navigate(`/image-generator/editor/${c.id}${a === "adapt" ? "?adapt=1" : ""}`);
      }
    }),
  ];
  return () => {
    alive = false;
    state.abort?.abort();
    offs.forEach((off) => off());
  };
}
