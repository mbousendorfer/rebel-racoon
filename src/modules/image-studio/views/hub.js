// Image Generator — Generate (hub), the module's front door.
//
//   brand card      the Playbook every image follows (edit it on the Playbook)
//   campaign ideas  four ideas from the brand, its catalogue and the calendar —
//                   a click fills the brief; you can always write your own
//   prompt bar      the brief + Style · Product · Formats · Text pickers → Generate
//   results         batches of four variations, newest first, each with
//                   regenerate · more like this · favourite · download · edit
//
// Deep links: ?style=<id> preselects a style, ?creation=<id> reopens a run.

import { html, toString } from "../lib/html.js?v=1261";
import { delegate } from "../lib/delegate.js?v=1261";
import { renderFrame } from "./frame.js?v=1261";
import { renderEmpty } from "../ui/empty.js?v=1261";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1261";
import { renderBrandCard } from "../ui/brand-card.js?v=1261";
import { picker } from "../ui/picker.js?v=1261";
import { preserveFocus } from "../ui/fields.js?v=1261";
import { toast } from "../ui/toast.js?v=1261";
import { variationCanvas, variationSvg, layersFor, productHref } from "../ui/variation.js?v=1261";
import { STYLE_FAMILIES, presetById } from "../config/style-presets.js?v=1261";
import { FORMATS, formatById, formatRatio } from "../config/formats.js?v=1261";
import { NETWORKS, networkById } from "../config/networks.js?v=1261";
import { upcomingEvents } from "../config/calendar-events.js?v=1261";
import { TEXT_MODES } from "../model/schema.js?v=1261";
import { imageGenerationService, ideaService } from "../services/index.js?v=1261";
import { renderVisual, svgToDataUrl } from "../render/visual.js?v=1261";
import { subjectKindFor } from "../render/subjects.js?v=1261";
import { resolveLayers } from "../render/layout.js?v=1261";
import { toPngBlob, downloadBlob, slug } from "../render/export.js?v=1261";
import {
  getActiveBrand,
  getAsset,
  getCreation,
  getCreations,
  getProducts,
  getStyle,
  getStylesForBrand,
  subscribe,
} from "../state/store.js?v=1261";
import {
  addBatch,
  deleteCreation,
  openVariation,
  replaceVariation,
  startCreation,
  toggleFavorite,
} from "../state/creation-actions.js?v=1261";

const SECTOR_OF = { coffee: "food", finance: "finance", lifestyle: "lifestyle" };

function hashParams() {
  return new URLSearchParams(window.location.hash.split("?")[1] || "");
}

function defaultBrief(brand) {
  const own = getStylesForBrand(brand.id).find((s) => s.kind === "custom");
  return {
    prompt: "",
    headline: "",
    styleId: own?.id || "preset-lifestyle",
    productId: null,
    formatIds: ["ig-post"],
    textMode: "layer",
    ideaId: null,
  };
}

function formatsLine(formatIds) {
  return html`<span class="imst-formats-line">
    ${formatIds.map((id) => {
      const f = formatById(id);
      const n = networkById(f.network);
      return html`<span class="imst-formats-line__item"
        ><i class="${n.icon}" aria-hidden="true"></i><span>${n.label} ${formatRatio(f)}</span></span
      >`;
    })}
  </span>`;
}

export function mount(target, _params, ctx) {
  const state = {
    brandId: null,
    brief: null,
    idea: null,
    ideas: { status: "idle", list: [], round: 0 },
    creationId: hashParams().get("creation"),
    run: { status: "idle", label: "" },
    regenerating: new Set(),
    warning: "",
    error: "",
    abort: null,
  };

  const brandChanged = (brand) => {
    state.brandId = brand?.id || null;
    state.brief = brand ? defaultBrief(brand) : null;
    state.idea = null;
    state.ideas = { status: "idle", list: [], round: 0 };
    const reopened = state.creationId ? getCreation(state.creationId) : null;
    if (reopened && reopened.brandId === state.brandId)
      state.brief = { ...state.brief, ...structuredClone(reopened.brief) };
    else state.creationId = null;
    const styleParam = hashParams().get("style");
    if (brand && styleParam && getStyle(styleParam)) state.brief.styleId = styleParam;
    if (brand) loadIdeas();
  };

  const setCreationInUrl = (id) => {
    const base = "#/image-generator";
    history.replaceState(null, "", id ? `${base}?creation=${encodeURIComponent(id)}` : base);
  };

  async function loadIdeas(round = state.ideas.round) {
    const brand = getActiveBrand();
    if (!brand) return;
    state.ideas = { ...state.ideas, status: "loading", round };
    paint();
    try {
      const list = await ideaService.suggest({
        brand,
        products: getProducts(brand.id),
        styles: getStylesForBrand(brand.id),
        events: upcomingEvents(new Date(), SECTOR_OF[brand.sectorKey] || "*", 6),
        round,
      });
      if (state.brandId !== brand.id) return;
      state.ideas = { status: "done", list, round };
    } catch {
      state.ideas = { status: "error", list: [], round };
    }
    paint();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  const renderIdeas = (brand) => {
    const { status, list } = state.ideas;
    const cards =
      status === "loading" || status === "idle"
        ? Array.from(
            { length: 4 },
            () =>
              html`<div class="ap-card imst-idea imst-idea--skeleton" aria-hidden="true">
                <span class="imst-skeleton imst-skeleton--thumb"></span><span class="imst-skeleton"></span
                ><span class="imst-skeleton imst-skeleton--short"></span>
              </div>`,
          )
        : list.map((idea) => {
            const style = getStyle(idea.styleId);
            const f = formatById(idea.formatIds[0]);
            const thumb = svgToDataUrl(
              renderVisual({
                style,
                brand,
                seed: idea.previewSeed,
                width: 1080,
                height: 1080,
                subjectKind: subjectKindFor(idea.prompt, idea.productId),
                productHref: productHref(idea.productId),
                getAsset,
              }),
            );
            const on = state.idea?.id === idea.id;
            return html`
              <button
                type="button"
                class="ap-card imst-idea${on ? " is-selected" : ""}"
                aria-pressed="${on}"
                data-imst-idea="${idea.id}"
              >
                <img class="imst-idea__thumb" src="${thumb}" alt="" />
                <span class="imst-idea__body">
                  ${idea.eventLabel
                    ? html`<span class="ap-tag grey mini imst-idea__event"
                        ><i class="ap-icon-calendar" aria-hidden="true"></i
                        ><span>${idea.eventDate} · ${idea.eventLabel}</span></span
                      >`
                    : ""}
                  <span class="ap-body-bold imst-idea__title">${idea.title}</span>
                  <span class="ap-caption imst-idea__angle">${idea.angle}</span>
                  <span class="ap-caption imst-idea__meta"
                    >${style?.label || "Style"} · ${formatsLine(idea.formatIds)}</span
                  >
                </span>
              </button>
            `;
          });
    return html`
      <section class="imst-section" aria-labelledby="imst-ideas-title" aria-busy="${status === "loading"}">
        <header class="imst-section__head">
          <div>
            <h2 class="ap-subtitle" id="imst-ideas-title">Campaign ideas</h2>
            <p class="ap-caption">
              From ${brand.playbookName}, its catalogue and what's coming up. Pick one to fill the brief.
            </p>
          </div>
          <button
            type="button"
            class="ap-button ghost grey"
            data-imst-action="more-ideas"
            ${status === "loading" ? "disabled" : ""}
          >
            <i class="ap-icon-refresh" aria-hidden="true"></i><span>More ideas</span>
          </button>
        </header>
        ${status === "error"
          ? html`<div class="ap-infobox error" role="alert">
              <i class="ap-icon-warning_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts">
                  <div class="ap-infobox-message">I couldn't come up with ideas this time.</div>
                </div>
                <button type="button" class="ap-button ghost blue" data-imst-action="more-ideas">Try again</button>
              </div>
            </div>`
          : html`<div class="imst-grid imst-grid--ideas">${cards}</div>`}
      </section>
    `;
  };

  const renderPromptBar = (brand) => {
    const b = state.brief;
    const styles = getStylesForBrand(brand.id);
    const own = styles.filter((s) => s.kind === "custom");
    const style = getStyle(b.styleId);
    const products = getProducts(brand.id);
    const canEmbed = !!style?.supportsEmbeddedText;
    const styleGroups = [
      ...(own.length
        ? [
            {
              label: `Styles for ${brand.name}`,
              options: own.map((s) => ({ value: s.id, label: s.label, caption: s.description })),
            },
          ]
        : []),
      ...STYLE_FAMILIES.map((f) => ({
        label: f.label,
        options: styles.filter((s) => s.family === f.id).map((s) => ({ value: s.id, label: s.label })),
      })),
    ];
    const formatGroups = NETWORKS.map((n) => ({
      label: n.label,
      options: FORMATS.filter((f) => f.network === n.id).map((f) => ({
        value: f.id,
        label: `${f.label} · ${formatRatio(f)}`,
        caption: `${f.width} × ${f.height}`,
      })),
    }));
    const first = formatById(b.formatIds[0]);
    const running = state.run.status === "loading";
    return html`
      <section class="ap-card imst-prompt" aria-labelledby="imst-prompt-title">
        <h2 class="imst-sr-only" id="imst-prompt-title">Describe the image</h2>
        ${state.idea
          ? html`<div class="imst-prompt__idea">
              <span class="ap-caption">From the idea</span>
              <span class="ap-tag blue"
                ><span>${state.idea.title}</span
                ><button type="button" aria-label="Stop using this idea" data-imst-action="clear-idea">
                  <i class="ap-icon-close" aria-hidden="true"></i></button
              ></span>
            </div>`
          : ""}
        <div class="ap-textarea-field">
          <textarea
            rows="3"
            data-imst-field="prompt"
            aria-label="Describe the image"
            placeholder="Describe the image you want — e.g. our new blend on a wooden table, morning light"
          >
${b.prompt}</textarea
          >
        </div>
        ${state.error ? html`<span class="ap-form-message error" role="alert">${state.error}</span>` : ""}
        <div class="ap-input-group imst-prompt__headline">
          <i class="ap-icon-alt-text" aria-hidden="true"></i>
          <input
            type="text"
            class="ap-input"
            data-imst-field="headline"
            value="${b.headline}"
            placeholder="Text on the image (optional) — e.g. Autumn roast is here"
            aria-label="Text on the image"
          />
        </div>
        <div class="imst-prompt__pickers">
          ${picker({ id: "style", label: "Style", value: b.styleId, groups: styleGroups, wide: true })}
          ${picker({
            id: "product",
            label: "Product",
            value: b.productId || "",
            groups: [
              { options: [{ value: "", label: "None" }, ...products.map((p) => ({ value: p.id, label: p.name }))] },
            ],
            placeholder: "None",
          })}
          ${picker({
            id: "formats",
            label: "Formats",
            value: b.formatIds,
            multi: true,
            groups: formatGroups,
            summary:
              b.formatIds.length === 1
                ? `${networkById(first.network).label} ${formatRatio(first)}`
                : `${b.formatIds.length} formats`,
            wide: true,
          })}
          ${picker({
            id: "textMode",
            label: "Text",
            value: b.textMode,
            groups: [
              {
                options: TEXT_MODES.map((m) => ({
                  value: m.id,
                  label: m.label,
                  caption:
                    m.id === "embedded"
                      ? canEmbed
                        ? "I write it into the image"
                        : `Not with ${style?.label || "this style"}`
                      : "A text layer you can move and edit",
                  disabled: m.id === "embedded" && !canEmbed,
                })),
              },
            ],
          })}
        </div>
        ${state.warning
          ? html`<div class="ap-infobox warning">
              <i class="ap-icon-warning_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts"><div class="ap-infobox-message">${state.warning}</div></div>
              </div>
            </div>`
          : ""}
        <footer class="imst-prompt__footer">
          <span class="ap-caption"
            >4 variations · shown in ${networkById(first.network).label} ${first.label.toLowerCase()} first</span
          >
          <button
            type="button"
            class="ap-button primary orange${running ? " loading" : ""}"
            data-imst-action="generate"
            ${running ? "disabled" : ""}
          >
            <i class="ap-icon-sparkles" aria-hidden="true"></i><span>${running ? "Generating…" : "Generate"}</span>
          </button>
        </footer>
      </section>
    `;
  };

  const renderTile = (creation, v, index, brand) => {
    const fav = (creation.favoriteVariationIds || []).includes(v.id);
    const busy = state.regenerating.has(v.id);
    const formatId = creation.brief.formatIds[0];
    return html`
      <figure class="ap-card imst-variation" aria-busy="${busy}" aria-label="Variation ${index + 1}">
        <div class="imst-variation__media">
          ${variationCanvas({ creation, variation: v, formatId, brand })}
          ${busy ? html`<span class="imst-variation__busy"><span class="ap-loader size-30"></span></span>` : ""}
        </div>
        <figcaption class="imst-variation__bar">
          <button
            type="button"
            class="ap-button stroked grey"
            data-imst-var="edit"
            data-id="${v.id}"
            aria-label="Edit variation ${index + 1}"
          >
            Edit
          </button>
          <span class="imst-variation__actions">
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="regenerate"
              data-id="${v.id}"
              aria-label="Regenerate variation ${index + 1}"
              data-tooltip="Regenerate"
              ${busy ? "disabled" : ""}
            >
              <i class="ap-icon-refresh" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="similar"
              data-id="${v.id}"
              aria-label="More like variation ${index + 1}"
              data-tooltip="More like this"
            >
              <i class="ap-icon-sparkles" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="ap-icon-button transparent grey"
              data-imst-var="favorite"
              data-id="${v.id}"
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
              data-id="${v.id}"
              aria-label="Download variation ${index + 1} as PNG"
              data-tooltip="Download PNG"
            >
              <i class="ap-icon-download" aria-hidden="true"></i>
            </button>
          </span>
        </figcaption>
      </figure>
    `;
  };

  const renderResults = (brand) => {
    const creation = state.creationId ? getCreation(state.creationId) : null;
    const loading = state.run.status === "loading";
    if (!creation && !loading && state.run.status !== "error") return "";
    const style = creation ? creation.styleSnapshot || getStyle(creation.brief.styleId) : null;
    const loadingBatch = loading
      ? html`<section class="imst-batch" aria-live="polite">
          <header class="imst-section__head">
            <h3 class="ap-body-bold">${state.run.label || "Generating 4 variations…"}</h3>
          </header>
          <div class="imst-grid imst-grid--variations">
            ${Array.from(
              { length: 4 },
              () =>
                html`<div class="ap-card imst-variation imst-variation--loading">
                  <div class="imst-variation__media imst-variation__media--empty">
                    <span class="ap-loader size-30"></span>
                  </div>
                </div>`,
            )}
          </div>
        </section>`
      : "";
    const errorBox =
      state.run.status === "error"
        ? html`<div class="ap-infobox error" role="alert">
            <i class="ap-icon-warning_fill" aria-hidden="true"></i>
            <div class="ap-infobox-content">
              <div class="ap-infobox-texts">
                <div class="ap-infobox-title">Generation failed</div>
                <div class="ap-infobox-message">Nothing was lost — your brief is still here.</div>
              </div>
              <button type="button" class="ap-button ghost blue" data-imst-action="${state.run.retry || "generate"}">
                Try again
              </button>
            </div>
          </div>`
        : "";
    const batches = creation
      ? (creation.batches?.length ? creation.batches : [{ id: null, label: "Variations" }]).map((batch) => {
          // Older creations (the demo seed) carry no batches: one unnamed set.
          const vars = creation.variations.filter((v) => (v.batchId ?? null) === batch.id);
          return html`
            <section class="imst-batch">
              <header class="imst-section__head">
                <div>
                  <h3 class="ap-body-bold">${batch.label}</h3>
                  <p class="ap-caption">${style?.label || "Style"} · ${formatsLine(creation.brief.formatIds)}</p>
                </div>
              </header>
              <div class="imst-grid imst-grid--variations">
                ${vars.map((v, i) => renderTile(creation, v, i, brand))}
              </div>
            </section>
          `;
        })
      : [];
    return html`
      <section class="imst-section" aria-labelledby="imst-results-title">
        <header class="imst-section__head">
          <h2 class="ap-subtitle" id="imst-results-title">${creation?.title || "Results"}</h2>
          ${creation
            ? html`<button type="button" class="ap-button ghost grey" data-imst-action="new-brief">
                <i class="ap-icon-plus" aria-hidden="true"></i><span>New image</span>
              </button>`
            : ""}
        </header>
        ${errorBox}${loadingBatch}${batches}
      </section>
    `;
  };

  // Async work (ideas, generation, test runs) can resolve after the route has
  // changed: a painter that outlives its view would overwrite the next screen.
  let alive = true;
  const paint = () => {
    if (!alive) return;
    const brand = getActiveBrand();
    if ((brand?.id || null) !== state.brandId) brandChanged(brand);
    const restore = preserveFocus(target);
    const body = brand
      ? html`${renderBrandCard(brand, { compact: true })}${renderIdeas(brand)}${renderPromptBar(brand)}${renderResults(
          brand,
        )}`
      : renderEmpty({
          icon: "ap-icon-image",
          title: "Start with a Playbook",
          body: "Images follow a brand, and your brand lives in a Playbook: its logo, colours, fonts and rules. Create one from your website, your files, or by hand.",
          action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
            <span>Create a Playbook</span>
          </button>`,
        });
    target.innerHTML = toString(renderFrame({ section: "create", aside: renderBrandPicker(), body }));
    restore();
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const request = (brand) => {
    const style = getStyle(state.brief.styleId);
    const product = state.brief.productId ? getProducts(brand.id).find((p) => p.id === state.brief.productId) : null;
    return {
      brief: state.brief,
      brand,
      style,
      product,
      format: formatById(state.brief.formatIds[0]),
      textMode: state.brief.textMode,
      text: { headline: state.brief.headline },
    };
  };

  async function generate() {
    const brand = getActiveBrand();
    if (!state.brief.prompt.trim()) {
      state.error = "Describe the image first — or pick a campaign idea.";
      paint();
      target.querySelector('[data-imst-field="prompt"]')?.focus();
      return;
    }
    state.error = "";
    const req = request(brand);
    const creation = startCreation({ brand, brief: { ...state.brief }, style: req.style, idea: state.idea });
    state.creationId = creation.id;
    setCreationInUrl(creation.id);
    state.run = { status: "loading", label: "Generating 4 variations…" };
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
      state.run = { status: "error", retry: "generate" };
    }
    paint();
  }

  async function similar(variationId) {
    const brand = getActiveBrand();
    const creation = getCreation(state.creationId);
    const base = creation.variations.find((v) => v.id === variationId);
    const index = creation.variations.filter((v) => v.batchId === base.batchId).findIndex((v) => v.id === variationId);
    state.run = { status: "loading", label: `More like variation ${index + 1}…` };
    paint();
    try {
      const vars = await imageGenerationService.similar(base, {
        ...request(brand),
        brief: creation.brief,
        style: creation.styleSnapshot,
      });
      addBatch(creation.id, vars, { label: `Like variation ${index + 1}`, parentVariationId: variationId });
      state.run = { status: "idle" };
    } catch (error) {
      if (error.name === "AbortError") return;
      state.run = { status: "error", retry: "generate" };
      toast("Those variations failed. Try again.", { variant: "error" });
    }
    paint();
  }

  async function regenerate(variationId) {
    const brand = getActiveBrand();
    const creation = getCreation(state.creationId);
    const base = creation.variations.find((v) => v.id === variationId);
    state.regenerating.add(variationId);
    paint();
    try {
      const next = await imageGenerationService.regenerate(base, "all", {
        ...request(brand),
        brief: creation.brief,
        style: creation.styleSnapshot,
      });
      replaceVariation(creation.id, variationId, next);
    } catch (error) {
      if (error.name !== "AbortError") toast("That variation failed to regenerate. Try again.", { variant: "error" });
    }
    state.regenerating.delete(variationId);
    paint();
  }

  async function download(variationId) {
    const brand = getActiveBrand();
    const creation = getCreation(state.creationId);
    const v = creation.variations.find((x) => x.id === variationId);
    const format = formatById(creation.brief.formatIds[0]);
    try {
      const blob = await toPngBlob({
        svg: variationSvg({ creation, variation: v, formatId: format.id, brand }),
        width: format.width,
        height: format.height,
        layers: resolveLayers(layersFor({ creation, formatId: format.id }), brand),
      });
      downloadBlob(blob, `${slug(creation.title)}-${format.id}.png`);
      toast(`Downloaded ${format.width} × ${format.height} PNG.`);
    } catch (error) {
      toast(error.message || "The download failed.", { variant: "error" });
    }
  }

  const onPick = (id, value) => {
    const b = state.brief;
    if (id === "style") {
      b.styleId = value;
      const style = getStyle(value);
      if (b.textMode === "embedded" && !style?.supportsEmbeddedText) {
        b.textMode = "layer";
        state.warning = `${style?.label || "This style"} can't write text into the image, so your text goes on an editable layer instead.`;
      } else state.warning = "";
    } else if (id === "product") b.productId = value || null;
    else if (id === "formats") {
      const set = new Set(b.formatIds);
      if (set.has(value)) {
        if (set.size > 1) set.delete(value);
      } else set.add(value);
      b.formatIds = FORMATS.map((f) => f.id).filter((f) => set.has(f));
      // Keep the first-picked order readable: the one shown first leads.
      if (!set.has(b.formatIds[0])) b.formatIds.unshift(value);
      paint();
      target.querySelector('[data-imst-picker="formats"]')?.setAttribute("open", "");
      return;
    } else if (id === "textMode") {
      b.textMode = value;
      state.warning = "";
    }
    paint();
  };

  paint();
  const offs = [
    subscribe(paint),
    delegate(target, "input", "[data-imst-field]", (_e, el) => {
      state.brief[el.dataset.imstField] = el.value;
      if (el.dataset.imstField === "prompt" && state.error) {
        state.error = "";
        target.querySelector(".ap-form-message.error")?.remove();
      }
    }),
    delegate(target, "keydown", '[data-imst-field="prompt"]', (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        generate();
      }
    }),
    delegate(target, "click", "[data-imst-pick]", (_e, el) => {
      if (el.getAttribute("aria-disabled") === "true") return;
      onPick(el.dataset.imstPick, el.dataset.value);
    }),
    delegate(target, "click", "[data-imst-idea]", (_e, el) => {
      const idea = state.ideas.list.find((i) => i.id === el.dataset.imstIdea);
      if (!idea) return;
      state.idea = idea;
      const style = getStyle(idea.styleId);
      Object.assign(state.brief, {
        prompt: idea.prompt,
        styleId: idea.styleId,
        productId: idea.productId,
        formatIds: idea.formatIds.slice(),
        ideaId: idea.id,
        textMode: state.brief.textMode === "embedded" && !style?.supportsEmbeddedText ? "layer" : state.brief.textMode,
      });
      state.error = "";
      state.warning = "";
      paint();
      target.querySelector(".imst-prompt")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }),
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const a = el.dataset.imstAction;
      if (a === "generate") generate();
      else if (a === "more-ideas") loadIdeas(state.ideas.round + 1);
      else if (a === "clear-idea") {
        state.idea = null;
        state.brief.ideaId = null;
        paint();
      } else if (a === "new-brief") {
        state.creationId = null;
        state.idea = null;
        state.brief = defaultBrief(getActiveBrand());
        state.run = { status: "idle" };
        setCreationInUrl(null);
        paint();
        target.querySelector('[data-imst-field="prompt"]')?.focus();
      }
    }),
    delegate(target, "click", "[data-imst-var]", (_e, el) => {
      const id = el.dataset.id;
      const action = el.dataset.imstVar;
      if (action === "regenerate") regenerate(id);
      else if (action === "similar") similar(id);
      else if (action === "favorite") {
        const c = toggleFavorite(state.creationId, id);
        toast(c.favoriteVariationIds.includes(id) ? "Added to favourites." : "Removed from favourites.");
      } else if (action === "download") download(id);
      else if (action === "edit") {
        openVariation(state.creationId, id);
        ctx.navigate(`/image-generator/editor/${state.creationId}`);
      }
    }),
  ];
  return () => {
    alive = false;
    state.abort?.abort();
    offs.forEach((off) => off());
  };
}
