// Image Generator — the studio, opened FROM A DRAFT (flag sexySquirrel
// replaces the draft's Image Studio): the draft's Playbook is the brand, only
// its network's shapes, a prompt suggested from the post, and "Use in draft"
// puts the PNG in the post. It is the ONLY place images are generated; the
// brand's own styles live on the Playbook (Brand › Image styles).
//
//   CONTROLS (left column, Generate always in reach at its foot)
//     brand applied · the prompt · the style as a picture (6 quick picks + the
//     full gallery) · the shape drawn to scale ·
//     text on the image and how it's set
//   CANVAS (the rest)
//     before generating — a LIVE preview of what the choices give, in the
//       brand's colours, redrawn on every change: nothing is picked blind
//     generating — the shape, shimmering, with what's being made in words
//     after — the chosen variation LARGE, its actions beside it, the four as a
//       filmstrip, "Refine" to iterate in place, earlier runs underneath

import { html, toString } from "../lib/html.js?v=1366";
import { delegate } from "../lib/delegate.js?v=1366";
import { hashString } from "../lib/prng.js?v=1366";
import { renderEmpty } from "../ui/empty.js?v=1366";
import { preserveFocus } from "../ui/fields.js?v=1366";
import { toast } from "../ui/toast.js?v=1366";
import { hydrateAssets, logoUrl } from "../ui/asset.js?v=1366";
import { styleThumb } from "../ui/style-thumb.js?v=1366";
import { openDialog } from "../ui/dialog.js?v=1366";
import { menu } from "../ui/menu.js?v=1366";
import { variationCanvas, variationSvg, layersFor } from "../ui/variation.js?v=1366";
import { STYLE_FAMILIES, STYLE_PRESETS } from "../config/style-presets.js?v=1366";
import { formatById, shapeForFormat, shapesFor } from "../config/formats.js?v=1366";
import { networkById } from "../config/networks.js?v=1366";
import { copyService, imageGenerationService } from "../services/index.js?v=1366";
import { unbranded } from "../state/playbook-brand.js?v=1366";
import { resolveLayers } from "../render/layout.js?v=1366";
import { toPngBlob, downloadBlob, slug } from "../render/export.js?v=1366";
import { getBrand, getCreation, getProducts, getStyle, getStylesForBrand, subscribe } from "../state/store.js?v=1366";
import {
  addBatch,
  appendVariations,
  deleteCreation,
  replaceVariation,
  startCreation,
} from "../state/creation-actions.js?v=1366";

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

const variationsLabel = (n) => (n === 1 ? "1 variation" : `${n} variations`);

function defaultBrief(brand, network = null) {
  const own = getStylesForBrand(brand.id).find((s) => s.kind === "custom");
  const firstShape = shapesFor(network)[0];
  return {
    prompt: "",
    headline: "",
    styleId: own?.id || "preset-lifestyle",
    productId: null,
    formatIds: [firstShape?.formatId || "ig-post"],
    textMode: "layer",
    useBrand: true,
    count: 4,
  };
}

// What the image is drawn with: the Playbook, or — "Use the Playbook" off — a neutral look.
const lookOf = (brand, brief) => (brief?.useBrand === false ? unbranded(brand) : brand);

/**
 * @param {HTMLElement} target
 * @param {{ draft: { brandId, network, text, imageUrl, slides }, onUse: (dataUrl) => void }} opts
 */
export function mountStudio(target, { draft, onUse, onCancel = () => {}, footer = null }) {
  // The dialog's footer holds the final actions (DS: right-aligned); clicks are
  // delegated from the dialog so body and footer share one set of handlers.
  const root = target.closest(".ap-dialog") || target;
  const brandNow = () => getBrand(draft.brandId);
  const shapes = () => shapesFor(draft.network);
  const state = {
    brandId: null,
    brief: null,
    creationId: null,
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
    state.brief = brand ? defaultBrief(brand, draft.network) : null;
    // A draft that already has an image shows it first; any choice switches to the live preview.
    state.showCurrent = !!draft.imageUrl;
    state.focusId = null;
    state.creationId = null;
  };

  const currentCreation = () => (state.creationId ? getCreation(state.creationId) : null);
  const latestBatch = (c) => (c.batches?.length ? c.batches[0] : { id: null, label: "Variations" });
  const batchVariations = (c, batch) => c.variations.filter((v) => (v.batchId ?? null) === batch.id);
  const focused = (c) => {
    const current = batchVariations(c, latestBatch(c));
    return c.variations.find((v) => v.id === state.focusId) || current[0] || c.variations[0] || null;
  };

  // ── Controls ───────────────────────────────────────────────────────────────

  const quickStyles = (brand) => {
    const own = state.brief.useBrand === false ? [] : getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
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
    const on = state.brief.useBrand !== false;
    return html`
      <div class="imst-ctl-brand-block">
        <div class="imst-ctl-brand">
          ${logo
            ? html`<img class="imst-ctl-brand__logo" src="${logo}" alt="" />`
            : html`<span class="imst-ctl-brand__logo imst-ctl-brand__logo--initial" aria-hidden="true"
                >${brand.name.slice(0, 1)}</span
              >`}
          <div class="imst-ctl-brand__text">
            <span class="ap-body-bold">${brand.name}</span>
            <span class="ap-caption"
              >${on ? "This chat's Playbook · applied" : "Not applied — neutral colours, no logo"}</span
            >
          </div>
          ${on
            ? html`<span
                class="imst-dots"
                role="img"
                aria-label="Brand colours: ${brand.palette.map((c) => c.name || c.hex).join(", ")}"
                >${brand.palette
                  .slice(0, 5)
                  .map(
                    (c) =>
                      html`<span
                        class="imst-dots__dot"
                        style="--imst-swatch: ${c.hex}"
                        data-tooltip="${c.name ? `${c.name} ${c.hex}` : c.hex}"
                      ></span>`,
                  )}</span
              >`
            : ""}
          <label class="ap-toggle-container" data-tooltip="${on ? "Don't use the Playbook" : "Use the Playbook"}">
            <input type="checkbox" data-imst-usebrand aria-label="Use the Playbook" ${on ? "checked" : ""} /><i></i
            ><span></span>
          </label>
        </div>
      </div>
    `;
  };

  // "Best for" + the network's icon; its name goes in title / aria-label.
  const bestFor = (networks) =>
    html`<span class="ap-caption imst-best"
      >Best for
      <span class="imst-best__nets"
        >${networks.map(
          (n) =>
            html`<i
              class="${networkById(n).icon}"
              role="img"
              aria-label="${networkById(n).label}"
              title="${networkById(n).label}"
            ></i>`,
        )}</span
      ></span
    >`;

  const renderControls = (brand) => {
    const b = state.brief;
    const style = getStyle(b.styleId);
    const shape = shapeForFormat(b.formatIds[0]);
    const format = formatById(b.formatIds[0]);
    const canEmbed = !!style?.supportsEmbeddedText;
    // Every shape for the same networks (a draft's dialog): say it once, beside the title.
    const nets = shapes().map((x) => x.networks.join(","));
    const sharedNets = nets.every((n) => n === nets[0]) ? shapes()[0]?.networks : null;
    const styleCount = getStylesForBrand(brand.id).length || STYLE_PRESETS.length;
    return html`
      <aside class="imst-controls" aria-label="Describe the image">
        <div class="imst-controls__scroll">
          ${renderBrandRow(brand)}

          <section class="imst-ctl">
            <label class="imst-ctl__label ap-body-bold" for="imst-prompt">Describe the image</label>
            <div class="imst-composer${state.error ? " has-error" : ""}">
              <textarea
                id="imst-prompt"
                class="imst-composer__input"
                rows="4"
                data-imst-field="prompt"
                placeholder="What should the image show? A scene, a subject, a mood…"
                ${state.error ? html`aria-invalid="true" aria-describedby="imst-prompt-error"` : ""}
              >
${b.prompt}</textarea
              >
              <div class="imst-composer__bar">
                ${draft.text
                  ? html`<button type="button" class="ap-button mermaid" data-imst-action="suggest">
                      <i class="ap-icon-sparkles" aria-hidden="true"></i><span>Suggest from the post</span>
                    </button>`
                  : ""}
                <span class="ap-caption imst-composer__hint">⌘ Enter to generate</span>
              </div>
            </div>
            ${state.error
              ? html`<span class="ap-form-message error" id="imst-prompt-error" role="alert">${state.error}</span>`
              : ""}
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-style">
            <header class="imst-ctl__head">
              <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-style">Style</h3>
              <button type="button" class="ap-link" data-imst-action="all-styles">All ${styleCount} styles</button>
            </header>
            <div class="imst-tiles" role="radiogroup" aria-labelledby="imst-ctl-style">
              ${quickStyles(brand).map(
                (s) =>
                  html`<button
                    type="button"
                    class="imst-tile"
                    role="radio"
                    aria-checked="${s.id === b.styleId}"
                    data-imst-style="${s.id}"
                    aria-label="${s.label}"
                  >
                    ${styleThumb(s, lookOf(brand, b), { className: "imst-tile__img", seed: hashString(s.id) })}
                    ${s.kind === "custom"
                      ? html`<span class="ap-tag grey mini imst-mine"><span>My style</span></span>`
                      : ""}
                    <span class="imst-tile__name">${s.label}</span>
                    ${s.id === b.styleId
                      ? html`<span class="imst-tile__check" aria-hidden="true"><i class="ap-icon-check"></i></span>`
                      : ""}
                  </button>`,
              )}
            </div>
            <p class="ap-caption imst-ctl__note">
              <span class="ap-body-bold">${style.label}</span>${style.kind === "custom"
                ? html` · My style`
                : ""}${style.description ? html` — ${style.description}` : ""}
            </p>
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-shape">
            <header class="imst-ctl__head">
              <div class="imst-ctl__title">
                <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-shape">Shape</h3>
                ${sharedNets ? bestFor(sharedNets) : ""}
              </div>
              <span class="ap-caption imst-ctl__meta">${format.width} × ${format.height} px</span>
            </header>
            <div class="imst-seg" role="radiogroup" aria-labelledby="imst-ctl-shape">
              ${shapes().map(
                (s) =>
                  html`<button
                    type="button"
                    class="imst-seg__opt"
                    role="radio"
                    aria-checked="${s.id === shape.id}"
                    data-imst-shape="${s.id}"
                    aria-label="${s.label} ${s.ratio}, best for ${s.networks
                      .map((n) => networkById(n).label)
                      .join(", ")}"
                  >
                    <span class="imst-seg__box"
                      ><span
                        class="imst-seg__frame"
                        style="aspect-ratio: ${s.w} / ${s.h}; ${s.w >= s.h ? "width: 100%" : "height: 100%"}"
                      ></span
                    ></span>
                    <span class="imst-seg__name">${s.label}</span>
                    <span class="ap-caption imst-seg__ratio">${s.ratio}</span>
                    ${sharedNets ? "" : bestFor(s.networks)}
                  </button>`,
              )}
            </div>
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-count">
            <header class="imst-ctl__head imst-ctl__head--control">
              <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-count">Variations</h3>
              ${menu({
                align: "end",
                label: "How many variations",
                trigger: {
                  className: "ap-button stroked grey",
                  label: `${variationsLabel(b.count)}. Change`,
                  content: html`<span>${variationsLabel(b.count)}</span
                    ><i class="ap-icon-chevron-down" aria-hidden="true"></i>`,
                },
                items: [1, 2, 3, 4].map((n) => ({
                  action: "count",
                  attrs: `data-imst-count="${n}"`,
                  label: variationsLabel(n),
                  selected: n === b.count,
                })),
              })}
            </header>
          </section>

          <section class="imst-ctl" aria-labelledby="imst-ctl-text">
            <header class="imst-ctl__head">
              <h3 class="imst-ctl__label ap-body-bold" id="imst-ctl-text">Text on the image</h3>
              <span class="ap-caption imst-ctl__meta">Optional</span>
            </header>
            <div class="imst-composer imst-composer--line">
              <input
                type="text"
                class="imst-composer__line"
                data-imst-field="headline"
                value="${b.headline}"
                placeholder="A headline, e.g. Plans that name their signal"
                aria-labelledby="imst-ctl-text"
              />
              ${draft.text
                ? html`<button
                    type="button"
                    class="ap-button mermaid"
                    data-imst-action="suggest-headline"
                    aria-label="Suggest a headline from the post"
                    data-tooltip="${b.headline ? "Another line from the post" : "A line from the post"}"
                  >
                    <i class="ap-icon-sparkles" aria-hidden="true"></i><span>Suggest</span>
                  </button>`
                : ""}
            </div>
            <label class="ap-toggle-container imst-ctl__toggle">
              <input
                type="checkbox"
                data-imst-textmode
                ${b.textMode === "embedded" ? "checked" : ""}
                ${canEmbed ? "" : "disabled"}
              /><i></i><span>Write it into the image</span>
            </label>
            <span class="ap-caption imst-ctl__note"
              >${!canEmbed
                ? `${style.label} can't write text, so it stays an editable layer you can move and restyle.`
                : b.textMode === "embedded"
                  ? "Part of the picture — it won't be editable afterwards."
                  : "Otherwise it stays an editable layer you can move and restyle."}</span
            >
            ${state.warning
              ? html`<span class="ap-caption imst-ctl__warn" role="status"
                  ><i class="ap-icon-warning_fill" aria-hidden="true"></i> ${state.warning}</span
                >`
              : ""}
          </section>
        </div>
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
              brand: lookOf(brand, b),
            })}<span class="ap-tag grey imst-stage2__badge"><span>Preview</span></span>`,
          "is-preview",
        )}
        <p class="ap-body imst-canvas-area__caption">
          <span class="ap-body-bold"
            >A preview of
            ${style.label}${b.useBrand === false ? ", in neutral colours" : ` in ${brand.name}'s colours`}.</span
          >
          Describe what you want and generate — you'll get
          ${b.count === 1 ? "one image" : `${b.count} variations to pick from`}.
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
              ><span class="ap-body-bold"
                >Generating ${variationsLabel(state.brief.count).toLowerCase()} in ${style.label}…</span
              ></span
            >`,
        )}
        <div class="imst-filmstrip">
          ${Array.from(
            { length: state.brief.count > 1 ? state.brief.count : 0 },
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
    // Every image of this session in ONE strip, oldest first, a gap between
    // runs — no "earlier" section and no batch jargon ("Like variation 2") —
    // and a "+" tile at the end that adds one more.
    const runs = c.batches?.length ? [...c.batches].reverse() : [latestBatch(c)];
    const strip = runs.flatMap((bt) => batchVariations(c, bt).map((x, i) => ({ x, runStart: i === 0 })));
    const shown = new Set(strip.map((e) => e.x.id));
    c.variations.filter((x) => !shown.has(x.id)).forEach((x, i) => strip.push({ x, runStart: i === 0 }));
    const index = strip.findIndex((e) => e.x.id === v.id);
    const busy = state.busy.has(v.id);
    const style = c.styleSnapshot || getStyle(c.brief.styleId);
    return html`
      <div class="imst-canvas-area">
        <header class="imst-result-bar">
          <div class="imst-result-bar__what">
            <span class="ap-body-bold"
              >${strip.length > 1 ? `Variation ${index + 1} of ${strip.length}` : "Your image"}</span
            >
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
              data-imst-var="download"
              aria-label="Download as PNG"
              data-tooltip="Download PNG"
            >
              <i class="ap-icon-download" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        ${stageFrame(
          format,
          html`${variationCanvas({
            creation: c,
            variation: v,
            formatId: format.id,
            brand: lookOf(brand, c.brief),
          })}${busy
            ? html`<span class="imst-stage2__status"
                ><span class="ap-loader size-30"></span><span class="ap-body-bold">Regenerating…</span></span
              >`
            : ""}`,
        )}
        ${strip.length
          ? html` <div class="imst-filmstrip" role="listbox" aria-label="Variations" data-imst-strip>
              ${strip.map(
                ({ x, runStart }, i) =>
                  html`<button
                    type="button"
                    class="imst-filmstrip__item${runStart && i > 0 ? " is-run-start" : ""}"
                    role="option"
                    aria-selected="${x.id === v.id}"
                    data-imst-focus="${x.id}"
                    aria-label="Variation ${i + 1}"
                    style="aspect-ratio: ${format.width} / ${format.height}"
                  >
                    ${variationCanvas({
                      creation: c,
                      variation: x,
                      formatId: format.id,
                      brand: lookOf(brand, c.brief),
                    })}
                  </button>`,
              )}
              ${state.addingOne
                ? html`<span
                    class="imst-filmstrip__item imst-filmstrip__add is-loading"
                    style="aspect-ratio: ${format.width} / ${format.height}"
                    role="status"
                    aria-label="Generating one more"
                    ><span class="imst-shimmer"></span><span class="ap-loader size-16"></span
                  ></span>`
                : html`<button
                    type="button"
                    class="imst-filmstrip__item imst-filmstrip__add"
                    data-imst-var="add-one"
                    aria-label="Generate one more"
                    data-tooltip="One more"
                    style="aspect-ratio: ${format.width} / ${format.height}"
                    ${state.run.status === "loading" ? "disabled" : ""}
                  >
                    <i class="ap-icon-plus" aria-hidden="true"></i>
                  </button>`}
            </div>`
          : ""}
        <form class="imst-refine" data-imst-form="refine">
          <i class="ap-icon-sparkles imst-refine__icon" aria-hidden="true"></i>
          <input
            type="text"
            class="imst-refine__input"
            data-imst-field="refine"
            value="${state.refine}"
            placeholder="Refine this one — warmer light, a closer crop…"
            aria-label="Refine this variation"
          />
          <button type="submit" class="ap-button primary orange" ${state.run.status === "loading" ? "disabled" : ""}>
            <span>Refine</span>
          </button>
        </form>
      </div>
    `;
  };

  const renderCurrent = () => html`
    <div class="imst-canvas-area imst-canvas-area--preview">
      <div class="imst-stage2">
        <div class="imst-current">
          <img class="imst-current__img" src="${draft.imageUrl}" alt="The draft's current image" />
          <span class="ap-tag grey imst-stage2__badge"
            ><span>${draft.slides > 1 ? `Current carousel · slide 1 of ${draft.slides}` : "Current image"}</span></span
          >
        </div>
      </div>
      <p class="ap-body imst-canvas-area__caption">
        <span class="ap-body-bold">The draft's ${draft.slides > 1 ? "carousel" : "image"} as it is.</span>
        Pick a style or describe a new one — a new image ${draft.slides > 1 ? "replaces the carousel" : "replaces it"}
        only when you choose.
      </p>
    </div>
  `;

  const renderCanvas = (brand) => {
    if (state.run.status === "loading") return renderLoading();
    if (state.run.status === "error") return renderError();
    const c = currentCreation();
    if (c && c.variations.length) return renderResults(brand, c);
    if (state.showCurrent) return renderCurrent();
    return renderPreview(brand);
  };

  // Cancel · Generate (orange: the AI action) · Use in draft (the final one, primary).
  // Once there is a result, Generate steps back to "Generate again".
  const paintFooter = () => {
    if (!footer) return;
    const c = currentCreation();
    const running = state.run.status === "loading";
    const result = !!(c && c.variations.length) && state.run.status !== "error";
    footer.innerHTML = toString(html`
      <button type="button" class="ap-button stroked grey" data-imst-action="cancel">Cancel</button>
      ${brandNow()
        ? html`<button
            type="button"
            class="ap-button ${result ? "secondary blue" : "primary orange"}${running ? " loading" : ""}"
            data-imst-action="generate"
            ${running ? "disabled" : ""}
          >
            <i class="ap-icon-sparkles" aria-hidden="true"></i
            ><span>${running ? "Generating…" : result ? "Generate again" : "Generate"}</span>
          </button>`
        : ""}
      ${result
        ? html`<button
            type="button"
            class="ap-button primary blue${state.using ? " loading" : ""}"
            data-imst-var="use"
            ${state.using || running ? "disabled" : ""}
          >
            <i class="ap-icon-check" aria-hidden="true"></i
            ><span>${draft.imageUrl ? "Replace the draft's image" : "Use in draft"}</span>
          </button>`
        : ""}
    `);
  };

  const paint = () => {
    if (!alive) return;
    const brand = brandNow();
    if ((brand?.id || null) !== state.brandId) brandChanged(brand);
    const restore = preserveFocus(target);
    if (!brand) {
      target.innerHTML = toString(
        renderEmpty({
          icon: "ap-icon-image",
          title: "This chat has no Playbook",
          body: "Images follow a brand, and the brand lives in the chat's Playbook. Pick one for this chat first.",
        }),
      );
      paintFooter();
      return;
    }
    target.innerHTML = toString(
      html`<div class="imst-studio imst-studio--draft">
        ${renderControls(brand)}
        <main class="imst-canvas-col">${renderCanvas(brand)}</main>
      </div>`,
    );
    paintFooter();
    hydrateAssets(target);
    restore();
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const request = (brand, brief = state.brief, style = getStyle(brief.styleId)) => ({
    brief,
    brand: lookOf(brand, brief),
    style,
    product: brief.productId ? getProducts(brand.id).find((p) => p.id === brief.productId) : null,
    format: formatById(brief.formatIds[0]),
    textMode: brief.textMode,
    text: { headline: brief.headline },
    // The CURRENT choice, also for More like this / Refine on an earlier run.
    count: state.brief.count || 4,
  });

  async function generate() {
    const brand = brandNow();
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
    state.run = { status: "loading" };
    state.abort = new AbortController();
    paint();
    try {
      const variations = await imageGenerationService.generate(req, { signal: state.abort.signal });
      addBatch(creation.id, variations, { label: variationsLabel(variations.length) });
      state.run = { status: "idle" };
    } catch (error) {
      if (error.name === "AbortError") return;
      deleteCreation(creation.id);
      state.creationId = null;
      state.run = { status: "error" };
    }
    paint();
  }

  /** The "+" tile: one more image from the same brief, into the latest run. */
  async function addOne() {
    const c = currentCreation();
    if (!c || state.addingOne) return;
    state.addingOne = true;
    paint();
    try {
      const [v] = await imageGenerationService.generate(
        { ...request(brandNow(), c.brief, c.styleSnapshot), count: 1 },
        {},
      );
      appendVariations(c.id, [v]);
      state.focusId = v.id;
    } catch {
      toast("That one didn't come through. Try again.", { variant: "error" });
    }
    state.addingOne = false;
    paint();
  }

  /** Refine: a new batch close to the focused variation. */
  async function iterate(refinement = "") {
    const brand = brandNow();
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
    const brand = brandNow();
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

  /** Draft mode: the chosen variation, text and logo baked, into the post. */
  async function useInDraft() {
    const brand = brandNow();
    const c = currentCreation();
    const v = focused(c);
    const f = formatById(c.brief.formatIds[0]);
    state.using = true;
    paint();
    try {
      const blob = await toPngBlob({
        svg: variationSvg({ creation: c, variation: v, formatId: f.id, brand: lookOf(brand, c.brief) }),
        width: f.width,
        height: f.height,
        layers: resolveLayers(layersFor({ creation: c, formatId: f.id }), lookOf(brand, c.brief)),
      });
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      onUse?.(dataUrl);
    } catch (error) {
      state.using = false;
      toast(error.message || "The image couldn't be added.", { variant: "error" });
      paint();
    }
  }

  // A suggestion takes as long as the real call (4–8 s): the field says it's
  // reading the post and shimmers, the button spins, the field is read-only
  // meanwhile. It then fills IN PLACE — nothing else is redrawn.
  async function suggestInto(button, field, ask) {
    if (!button || button.disabled) return;
    const input = target.querySelector(`[data-imst-field='${field}']`);
    const box = input?.closest(".imst-composer");
    const placeholder = input?.placeholder;
    // The DS way to say "working" on a button: the icon becomes the loader.
    const icon = button.querySelector("i");
    const spinner = document.createElement("span");
    spinner.className = "ap-loader size-16";
    icon?.replaceWith(spinner);
    button.classList.add("loading");
    button.disabled = true;
    box?.classList.add("is-suggesting");
    if (input) {
      input.readOnly = true;
      input.placeholder = "Reading the post…";
      if (!input.value) input.setAttribute("aria-busy", "true");
    }
    try {
      const text = await ask();
      state.brief[field] = text;
      if (input) {
        input.value = text;
        input.focus();
      }
      // The headline is drawn on the live preview: show it there too.
      if (field === "headline" && !currentCreation()) paint();
      if (field === "prompt" && state.error) {
        state.error = "";
        target.querySelector(".imst-composer")?.classList.remove("has-error");
        target.querySelector("#imst-prompt-error")?.remove();
      }
    } catch {
      toast("No suggestion this time. Try again.", { variant: "error" });
    } finally {
      if (icon) spinner.replaceWith(icon);
      button.classList.remove("loading");
      button.disabled = false;
      box?.classList.remove("is-suggesting");
      if (input) {
        input.readOnly = false;
        input.placeholder = placeholder;
        input.removeAttribute("aria-busy");
      }
    }
  }

  const suggestFromPost = (button) =>
    suggestInto(button, "prompt", () => copyService.promptFromPost({ brand: brandNow(), text: draft.text }));

  const suggestHeadline = (button) =>
    suggestInto(button, "headline", () =>
      copyService.headlineFromPost({
        text: draft.text,
        round: (state.headlineRound = (state.headlineRound ?? -1) + 1),
      }),
    );

  async function download() {
    const brand = brandNow();
    const c = currentCreation();
    const v = focused(c);
    const f = formatById(c.brief.formatIds[0]);
    try {
      const blob = await toPngBlob({
        svg: variationSvg({ creation: c, variation: v, formatId: f.id, brand: lookOf(brand, c.brief) }),
        width: f.width,
        height: f.height,
        layers: resolveLayers(layersFor({ creation: c, formatId: f.id }), lookOf(brand, c.brief)),
      });
      downloadBlob(blob, `${slug(c.title)}-${f.id}.png`);
      toast(`Downloaded ${f.width} × ${f.height} PNG.`);
    } catch (error) {
      toast(error.message || "The download failed.", { variant: "error" });
    }
  }

  function openStyleGallery() {
    const brand = brandNow();
    let family = "all";
    // Measured once on open: two and a half rows, then the height holds whatever the filter shows.
    let galleryH = 0;
    const own = getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
    const card = (s) =>
      html`<button
        type="button"
        class="imst-gallery__item${s.kind === "custom" ? " is-mine" : ""}"
        aria-pressed="${s.id === state.brief.styleId}"
        data-imst-pick-style="${s.id}"
      >
        <span class="imst-gallery__art"
          >${styleThumb(s, lookOf(brand, state.brief), { seed: hashString(s.id) })}${s.kind === "custom"
            ? html`<span class="ap-tag grey mini imst-mine"><span>My style</span></span>`
            : ""}</span
        >
        <span class="imst-gallery__text"
          ><span class="ap-body-bold">${s.label}</span
          ><span class="ap-caption">${s.description || "Made from your references."}</span></span
        >
      </button>`;
    const body = () => html`
      <div class="imst-chips" role="group" aria-label="Filter styles">
        ${[
          { id: "all", label: "All" },
          ...(own.length ? [{ id: "own", label: "My styles" }] : []),
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
      <div class="imst-gallery-scroll" style="${galleryH ? `--imst-gallery-h: ${galleryH}px` : ""}">
        ${family === "all" && own.length
          ? html`<h3 class="ap-body-bold imst-gallery__group">My styles</h3>
              <div class="imst-gallery">${own.map(card)}</div>
              <h3 class="ap-body-bold imst-gallery__group">Presets</h3>
              <div class="imst-gallery">${STYLE_PRESETS.map(card)}</div>`
          : html`<div class="imst-gallery">
              ${(family === "own" ? own : STYLE_PRESETS.filter((s) => family === "all" || s.family === family)).map(
                card,
              )}
            </div>`}
      </div>
    `;
    const dialog = openDialog({
      title: "Styles",
      subtitle: `Every one drawn in ${brand.name}'s colours.`,
      size: "lg",
      body: body(),
      onMount(el) {
        const scroller = el.querySelector(".imst-gallery-scroll");
        const item = el.querySelector(".imst-gallery__item");
        if (scroller && item) {
          const gap = parseFloat(getComputedStyle(el.querySelector(".imst-gallery")).rowGap) || 0;
          const pad = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
          galleryH = Math.round(item.offsetHeight * 2.5 + gap * 2 + pad);
          scroller.style.setProperty("--imst-gallery-h", `${galleryH}px`);
        }
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
    state.showCurrent = false;
    if (state.run.status === "loading") return;
    if (currentCreation()) {
      state.creationId = null;
      state.focusId = null;
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
      state.brief.formatIds = [shapes().find((s) => s.id === el.dataset.imstShape).formatId];
      leaveResults();
      paint();
    }),
    delegate(target, "change", "[data-imst-usebrand]", (_e, el) => {
      state.brief.useBrand = el.checked;
      // The Playbook's own styles are its identity too: off, fall back to a preset.
      if (!el.checked && getStyle(state.brief.styleId)?.kind === "custom") state.brief.styleId = "preset-lifestyle";
      leaveResults();
      paint();
    }),
    delegate(target, "change", "[data-imst-textmode]", (_e, el) => {
      state.brief.textMode = el.checked ? "embedded" : "layer";
      state.warning = "";
      paint();
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
    delegate(root, "click", "[data-imst-action]", (_e, el) => {
      const a = el.dataset.imstAction;
      if (a === "cancel") onCancel();
      else if (a === "generate") generate();
      else if (a === "suggest") suggestFromPost(el);
      else if (a === "suggest-headline") suggestHeadline(el);
      else if (a === "all-styles") openStyleGallery();
      else if (a === "count") {
        state.brief.count = Number(el.dataset.imstCount) || 4;
        paint();
      }
    }),
    delegate(root, "click", "[data-imst-var]", (_e, el) => {
      const c = currentCreation();
      const v = focused(c);
      const a = el.dataset.imstVar;
      if (a === "regenerate") regenerate();
      else if (a === "add-one") addOne();
      else if (a === "download") download();
      else if (a === "use") useInDraft();
    }),
  ];
  return () => {
    alive = false;
    state.abort?.abort();
    offs.forEach((off) => off());
  };
}
