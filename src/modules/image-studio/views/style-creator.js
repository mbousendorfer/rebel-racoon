// Image Generator — the custom style creator (/image-generator/styles/new, /:id).
//
// Sources: up to 10 reference images and/or up to 5 presets, each with a weight.
// Fidelity: "Essential" (colours, textures, strokes, mood) or "Style &
// composition" (+ framing, angle, layout). An optional style prompt. A test run
// on three neutral subjects before saving. Saved FOR the active Playbook.

import { html, toString } from "../lib/html.js?v=1301";
import { delegate } from "../lib/delegate.js?v=1301";
import { hashString, randomSeed } from "../lib/prng.js?v=1301";
import { renderFrame } from "./frame.js?v=1301";
import { renderEmpty } from "../ui/empty.js?v=1301";
import { field, preserveFocus, slider, syncSlider, textArea, textInput } from "../ui/fields.js?v=1301";
import { dropzone, bindDropzones } from "../ui/dropzone.js?v=1301";
import { assetImg, hydrateAssets } from "../ui/asset.js?v=1301";
import { toast } from "../ui/toast.js?v=1301";
import { styleThumbUrl } from "../ui/style-thumb.js?v=1301";
import {
  CUSTOM_STYLE_LIMITS,
  STYLE_FAMILIES,
  STYLE_PRESETS,
  STYLE_TEST_SUBJECTS,
  presetById,
} from "../config/style-presets.js?v=1301";
import { createStyle } from "../model/schema.js?v=1301";
import { imageGenerationService } from "../services/index.js?v=1301";
import { getActiveBrand, getAsset, getBrand, getStyle } from "../state/store.js?v=1301";
import { saveStyle, uploadReference, validateStyleDraft } from "../state/style-actions.js?v=1301";

const FIDELITY = [
  { id: "essential", title: "Essential", body: "Colours, textures, strokes and mood." },
  { id: "composition", title: "Style & composition", body: "All of that, plus framing, camera angle and layout." },
];

function draftFrom(style, brandId, fromPreset) {
  if (style) {
    return {
      id: style.id,
      brandId: style.brandId,
      label: style.label,
      description: style.description,
      sources: style.custom.sources.map((s) => ({ ...s })),
      fidelity: style.custom.fidelity,
      stylePrompt: style.custom.stylePrompt || "",
    };
  }
  const preset = fromPreset ? presetById(fromPreset) : null;
  return {
    id: null,
    brandId,
    label: preset ? `My ${preset.label.toLowerCase()}` : "",
    description: "",
    sources: preset ? [{ type: "preset", ref: preset.id, label: preset.label, weight: 1 }] : [],
    fidelity: "essential",
    stylePrompt: "",
  };
}

function share(draft, source) {
  const total = draft.sources.reduce((sum, s) => sum + s.weight, 0) || 1;
  return Math.round((source.weight / total) * 100);
}

export function mount(target, params, ctx) {
  const editing = params.id ? getStyle(params.id) : null;
  // A style belongs to one Playbook: edit it in that brand's colours.
  const brand = editing ? getBrand(editing.brandId) : getActiveBrand();
  const fromPreset = new URLSearchParams(window.location.hash.split("?")[1] || "").get("from");
  const state = {
    draft: draftFrom(editing, brand?.id, fromPreset),
    test: null, // { status: "loading" | "done" | "error", seeds: [] }
    stale: false,
    errors: [],
    uploading: 0,
    abort: null,
  };

  const back = { path: "/image-generator/styles", label: "All styles" };

  // The style as it would be saved — what the preview renders with.
  const previewStyle = () =>
    createStyle({
      id: state.draft.id || "st_preview",
      brandId: state.draft.brandId,
      label: state.draft.label,
      custom: { ...state.draft, sources: state.draft.sources },
    });

  const renderSource = (s, i) => {
    const media =
      s.type === "image"
        ? assetImg(s.ref, { className: "imst-source__media" })
        : html`<img
            class="imst-source__media"
            src="${styleThumbUrl(presetById(s.ref), brand, { width: 400, height: 400 })}"
            alt=""
          />`;
    const name = s.type === "image" ? getAsset(s.ref)?.name || "Reference image" : presetById(s.ref)?.label || s.label;
    return html`
      <li class="imst-source">
        ${media}
        <div class="imst-source__body">
          <span class="imst-source__name ap-body-bold">${name}</span>
          <span class="imst-source__weight">
            ${slider({
              path: `sources.${i}.weight`,
              value: s.weight,
              min: 0.1,
              max: 1,
              step: 0.05,
              label: `Weight of ${name}`,
            })}
            <span class="ap-caption imst-source__share" data-imst-share="${i}">Weight ${share(state.draft, s)}%</span>
          </span>
        </div>
        <button
          type="button"
          class="ap-icon-button transparent grey"
          data-imst-action="remove-source"
          data-index="${i}"
          aria-label="Remove ${name}"
        >
          <i class="ap-icon-close" aria-hidden="true"></i>
        </button>
      </li>
    `;
  };

  const renderPresetAdder = (count) => {
    if (count >= CUSTOM_STYLE_LIMITS.presets)
      return html`<p class="ap-caption">That's the maximum of ${CUSTOM_STYLE_LIMITS.presets} presets.</p>`;
    const taken = new Set(state.draft.sources.filter((s) => s.type === "preset").map((s) => s.ref));
    return html`
      <details class="ap-select imst-select imst-preset-adder" data-imst-menu>
        <summary class="ap-select-trigger" aria-label="Add a preset">
          <i class="ap-icon-plus" aria-hidden="true"></i>
          <span class="ap-select-value ap-select-placeholder">Add a preset</span>
          <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
        </summary>
        <div class="ap-select-dropdown" role="listbox">
          <div class="ap-select-options">
            ${STYLE_FAMILIES.map(
              (f) => html`
                <div class="ap-select-group">
                  <div class="ap-select-group-label">${f.label}</div>
                  ${STYLE_PRESETS.filter((p) => p.family === f.id && !taken.has(p.id)).map(
                    (p) =>
                      html`<div class="ap-select-option" role="option" tabindex="0" data-imst-add-preset="${p.id}">
                        <span class="ap-select-option-text"
                          ><span class="ap-select-option-title">${p.label}</span></span
                        >
                      </div>`,
                  )}
                </div>
              `,
            )}
          </div>
        </div>
      </details>
    `;
  };

  const renderPreview = () => {
    const t = state.test;
    const tiles = STYLE_TEST_SUBJECTS.map((subject, i) => {
      let inner;
      if (!t) inner = html`<span class="imst-test-grid__empty ap-caption">${subject.label}</span>`;
      else if (t.status === "loading")
        inner = html`<span class="imst-test-grid__loading"><span class="ap-loader size-24"></span></span>`;
      else if (t.status === "error") inner = html`<span class="imst-test-grid__empty ap-caption">—</span>`;
      else
        inner = html`<img
          src="${styleThumbUrl(previewStyle(), brand, { seed: t.seeds[i], kind: subject.id })}"
          alt="${subject.label}, in this style"
        />`;
      return html`<figure class="imst-test-grid__item">
        <div class="imst-test-grid__frame">${inner}</div>
        <figcaption class="ap-caption">${subject.label}</figcaption>
      </figure>`;
    });
    return html`
      <section
        class="ap-card imst-creator__preview"
        aria-labelledby="imst-test-title"
        aria-busy="${t?.status === "loading"}"
      >
        <header class="imst-section__head">
          <div>
            <h2 class="ap-subtitle" id="imst-test-title">Test run</h2>
            <p class="ap-caption">Three neutral subjects, in ${brand.name}'s colours.</p>
          </div>
          <button
            type="button"
            class="ap-button primary orange"
            data-imst-action="test"
            ${t?.status === "loading" || !state.draft.sources.length ? "disabled" : ""}
          >
            <i class="ap-icon-sparkles" aria-hidden="true"></i
            ><span>${t?.status === "done" ? "Test again" : "Test the style"}</span>
          </button>
        </header>
        ${state.stale && t?.status === "done"
          ? html`<div class="ap-infobox info">
              <i class="ap-icon-info_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts">
                  <div class="ap-infobox-message">You changed the style since this test. Test again to see it.</div>
                </div>
              </div>
            </div>`
          : ""}
        ${t?.status === "error"
          ? html`<div class="ap-infobox error" role="alert">
              <i class="ap-icon-warning_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts">
                  <div class="ap-infobox-message">The test run failed. Try again.</div>
                </div>
                <button type="button" class="ap-button ghost blue" data-imst-action="test">Try again</button>
              </div>
            </div>`
          : ""}
        <div class="imst-test-grid">${tiles}</div>
      </section>
    `;
  };

  // Async work (ideas, generation, test runs) can resolve after the route has
  // changed: a painter that outlives its view would overwrite the next screen.
  let alive = true;
  const paint = () => {
    if (!alive) return;
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          back,
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "Start with a Playbook",
            body: "A style is saved for a brand, and your brand lives in a Playbook.",
          }),
        }),
      );
      return;
    }
    const restore = preserveFocus(target);
    const d = state.draft;
    const images = d.sources.map((s, i) => [s, i]).filter(([s]) => s.type === "image");
    const presets = d.sources.map((s, i) => [s, i]).filter(([s]) => s.type === "preset");
    target.innerHTML = toString(
      renderFrame({
        back,
        body: html`
          <header class="imst-creator__head">
            <h1 class="ap-h2">${editing ? `Edit ${editing.label}` : "New style"}</h1>
            <p class="ap-body">Saved for ${brand.playbookName}. It will come first whenever you pick a style for it.</p>
          </header>
          <div class="imst-creator">
            <div class="imst-creator__form">
              <section class="ap-card imst-creator__card">
                ${field({
                  label: "Name",
                  id: "imst-st-name",
                  control: textInput({
                    path: "label",
                    id: "imst-st-name",
                    value: d.label,
                    placeholder: "e.g. Morning light",
                  }),
                })}
                ${field({
                  label: "Description",
                  id: "imst-st-desc",
                  hint: "Optional — shown under the name in the style picker.",
                  control: textInput({
                    path: "description",
                    id: "imst-st-desc",
                    value: d.description,
                    placeholder: "e.g. Warm window light over wood",
                  }),
                })}
              </section>
              <section class="ap-card imst-creator__card" aria-labelledby="imst-src-images">
                <header class="imst-section__head">
                  <h2 class="ap-body-bold" id="imst-src-images">Reference images</h2>
                  <span class="ap-caption">${images.length} of ${CUSTOM_STYLE_LIMITS.images}</span>
                </header>
                ${images.length
                  ? html`<ul class="imst-sources">
                      ${images.map(([s, i]) => renderSource(s, i))}
                    </ul>`
                  : ""}
                ${images.length < CUSTOM_STYLE_LIMITS.images
                  ? dropzone({
                      id: "refs",
                      title: state.uploading ? "Adding…" : "Drop images whose look you want, or",
                      sub: "PNG, JPG, SVG or WebP",
                      compact: true,
                    })
                  : ""}
              </section>
              <section class="ap-card imst-creator__card" aria-labelledby="imst-src-presets">
                <header class="imst-section__head">
                  <h2 class="ap-body-bold" id="imst-src-presets">Presets to mix</h2>
                  <span class="ap-caption">${presets.length} of ${CUSTOM_STYLE_LIMITS.presets}</span>
                </header>
                ${presets.length
                  ? html`<ul class="imst-sources">
                      ${presets.map(([s, i]) => renderSource(s, i))}
                    </ul>`
                  : ""}
                ${renderPresetAdder(presets.length)}
              </section>
              <section class="ap-card imst-creator__card" aria-labelledby="imst-fidelity">
                <h2 class="ap-body-bold" id="imst-fidelity">What to keep from the sources</h2>
                <div class="imst-radio-row" role="radiogroup" aria-labelledby="imst-fidelity">
                  ${FIDELITY.map(
                    (f) =>
                      html`<label class="ap-radio-card card">
                        <input
                          type="radio"
                          name="imst-fidelity"
                          value="${f.id}"
                          ${d.fidelity === f.id ? "checked" : ""}
                          data-imst-fidelity
                        />
                        <div><span class="ap-body-bold">${f.title}</span><span>${f.body}</span></div>
                      </label>`,
                  )}
                </div>
                ${field({
                  label: "Style prompt",
                  id: "imst-st-prompt",
                  hint: "Optional. Added to every image in this style.",
                  control: textArea({
                    path: "stylePrompt",
                    id: "imst-st-prompt",
                    value: d.stylePrompt,
                    rows: 2,
                    placeholder: "e.g. Always a plain background, soft light",
                  }),
                })}
              </section>
            </div>
            ${renderPreview()}
          </div>
          ${state.errors.length
            ? html`<div class="ap-infobox error" role="alert">
                <i class="ap-icon-warning_fill" aria-hidden="true"></i>
                <div class="ap-infobox-content">
                  <div class="ap-infobox-texts"><div class="ap-infobox-message">${state.errors.join(" ")}</div></div>
                </div>
              </div>`
            : ""}
          <div class="imst-creator__footer">
            <button type="button" class="ap-button stroked grey" data-imst-nav="/image-generator/styles">Cancel</button>
            <button type="button" class="ap-button primary blue" data-imst-action="save">
              ${editing ? "Save changes" : "Save style"}
            </button>
          </div>
        `,
      }),
    );
    hydrateAssets(target);
    restore();
  };

  const markStale = () => {
    if (state.test?.status === "done" && !state.stale) {
      state.stale = true;
      paint();
    }
  };

  const setShares = () => {
    state.draft.sources.forEach((s, i) => {
      const el = target.querySelector(`[data-imst-share="${i}"]`);
      if (el) el.textContent = `Weight ${share(state.draft, s)}%`;
    });
  };

  async function runTest() {
    state.test = { status: "loading", seeds: [] };
    state.stale = false;
    state.abort?.abort();
    state.abort = new AbortController();
    paint();
    try {
      await imageGenerationService.generate(
        {
          brief: { prompt: state.draft.stylePrompt || "style test" },
          brand,
          style: previewStyle(),
          format: { width: 1080, height: 1080 },
          textMode: "layer",
        },
        { signal: state.abort.signal },
      );
      const base = hashString(state.draft.label) ^ randomSeed();
      state.test = { status: "done", seeds: [base, base + 97, base + 211] };
    } catch (error) {
      if (error.name === "AbortError") return;
      state.test = { status: "error", seeds: [] };
    }
    paint();
  }

  paint();
  const offs = [
    bindDropzones(target, async (_id, files) => {
      const room = CUSTOM_STYLE_LIMITS.images - state.draft.sources.filter((s) => s.type === "image").length;
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (files.length > images.length) toast("Only images can be used as references.", { variant: "error" });
      if (images.length > room)
        toast(`Only ${room} more reference image${room === 1 ? "" : "s"} fit — the rest were left out.`, {
          variant: "error",
        });
      state.uploading += 1;
      paint();
      for (const file of images.slice(0, room)) {
        try {
          const asset = await uploadReference(brand.id, file);
          state.draft.sources.push({ type: "image", ref: asset.id, label: asset.name, weight: 0.8 });
        } catch (error) {
          toast(error.message, { variant: "error" });
        }
      }
      state.uploading -= 1;
      state.stale = !!state.test;
      paint();
    }),
    delegate(target, "input", "[data-imst-field]", (_e, el) => {
      const path = el.dataset.imstField;
      const m = /^sources\.(\d+)\.weight$/.exec(path);
      if (m) {
        state.draft.sources[Number(m[1])].weight = Number(el.value);
        syncSlider(el);
        setShares();
      } else state.draft[path] = el.value;
    }),
    delegate(target, "change", "[data-imst-field]", (_e, el) => {
      if (el.dataset.imstField !== "label" && el.dataset.imstField !== "description") markStale();
    }),
    delegate(target, "change", "[data-imst-fidelity]", (_e, el) => {
      state.draft.fidelity = el.value;
      state.stale = !!state.test;
      paint();
    }),
    delegate(target, "click", "[data-imst-add-preset]", (_e, el) => {
      const preset = presetById(el.dataset.imstAddPreset);
      state.draft.sources.push({ type: "preset", ref: preset.id, label: preset.label, weight: 0.5 });
      state.stale = !!state.test;
      paint();
    }),
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const action = el.dataset.imstAction;
      if (action === "remove-source") {
        state.draft.sources.splice(Number(el.dataset.index), 1);
        state.stale = !!state.test;
        paint();
      } else if (action === "test") runTest();
      else if (action === "save") {
        state.errors = validateStyleDraft(state.draft);
        if (state.errors.length) {
          paint();
          target.querySelector(".ap-infobox.error")?.scrollIntoView({ block: "nearest" });
          return;
        }
        const saved = saveStyle(state.draft);
        toast(editing ? `${saved.label} updated.` : `${saved.label} saved for ${brand.playbookName}.`);
        ctx.navigate("/image-generator/styles");
      }
    }),
  ];
  return () => {
    alive = false;
    state.abort?.abort();
    offs.forEach((off) => off());
  };
}
