// Image Generator — the brand's style creator, opened from the Playbook's Brand
// section (/playbook/:id/styles/new, /playbook/:id/styles/:styleId). The style is
// saved ON that Playbook (imageStyles); the topbar's back returns to the fiche.
//
// Sources: up to 10 reference images, each with a weight — the look is read from
// them (no presets to mix: removed at the user's request, 2026-09-28).
// Fidelity: "Essential" (colours, textures, strokes, mood) or "Style &
// composition" (+ framing, angle, layout). An optional style prompt. A test run
// on three neutral subjects before saving. Saved FOR the active Playbook.

import { html, toString } from "../lib/html.js?v=1422";
import { delegate } from "../lib/delegate.js?v=1422";
import { getPath } from "../../../router.js?v=1422";
import { setTopbarActions } from "../../../components/topbar.js?v=1422";
import { hashString, randomSeed } from "../lib/prng.js?v=1422";
import { renderFrame } from "./frame.js?v=1422";
import { renderEmpty } from "../ui/empty.js?v=1422";
import { field, preserveFocus, slider, syncSlider, textArea, textInput } from "../ui/fields.js?v=1422";
import { dropzone, bindDropzones } from "../ui/dropzone.js?v=1422";
import { assetImg, hydrateAssets } from "../ui/asset.js?v=1422";
import { toast } from "../ui/toast.js?v=1422";
import { styleThumbUrl } from "../ui/style-thumb.js?v=1422";
import { CUSTOM_STYLE_LIMITS, STYLE_TEST_SUBJECTS } from "../config/style-presets.js?v=1422";
import { createStyle } from "../model/schema.js?v=1422";
import { imageGenerationService } from "../services/index.js?v=1422";
import { canEditBrand, getAsset, getBrand, getStyle } from "../state/store.js?v=1422";
import { saveStyle, uploadReference, validateStyleDraft } from "../state/style-actions.js?v=1422";

const FIDELITY = [
  { id: "essential", title: "Essential", body: "Colours, textures, strokes and mood." },
  { id: "composition", title: "Style & composition", body: "All of that, plus framing, camera angle and layout." },
];

function draftFrom(style, brandId) {
  if (style) {
    return {
      id: style.id,
      brandId: style.brandId,
      label: style.label,
      description: style.description,
      sources: style.custom.sources.filter((s) => s.type === "image").map((s) => ({ ...s })),
      fidelity: style.custom.fidelity,
      stylePrompt: style.custom.stylePrompt || "",
    };
  }
  return {
    id: null,
    brandId,
    label: "",
    description: "",
    sources: [],
    fidelity: "essential",
    stylePrompt: "",
  };
}

function share(draft, source) {
  const total = draft.sources.reduce((sum, s) => sum + s.weight, 0) || 1;
  return Math.round((source.weight / total) * 100);
}

export function mount(target, params, ctx) {
  // The Playbook is in the URL: a style belongs to one, and is edited in its colours.
  const found = params.styleId ? getStyle(params.styleId) : null;
  const editing = found && found.brandId === params.id ? found : null;
  const brand = canEditBrand(params.id) ? getBrand(params.id) : null;
  const state = {
    draft: draftFrom(editing, brand?.id),
    test: null, // { status: "loading" | "done" | "error", seeds: [] }
    stale: false,
    errors: [],
    uploading: 0,
    abort: null,
  };

  const fiche = `/playbook/${encodeURIComponent(params.id)}`;

  // The style as it would be saved — what the preview renders with.
  const previewStyle = () =>
    createStyle({
      id: state.draft.id || "st_preview",
      brandId: state.draft.brandId,
      label: state.draft.label,
      custom: { ...state.draft, sources: state.draft.sources },
    });

  const renderSource = (s, i) => {
    // An image is an upload (asset) or, for a seeded style, a URL with its colours.
    const media = s.url
      ? html`<img class="imst-source__media" src="${s.url}" alt="" />`
      : assetImg(s.ref, { className: "imst-source__media" });
    const name = s.name || getAsset(s.ref)?.name || "Reference image";
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
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "You can't edit this Playbook's styles",
            body: "Styles are part of a Playbook's brand, and only its owner edits them.",
          }),
        }),
      );
      return;
    }
    const restore = preserveFocus(target);
    const d = state.draft;
    const images = d.sources.map((s, i) => [s, i]).filter(([s]) => s.type === "image");
    target.innerHTML = toString(
      renderFrame({
        body: html`
          <header class="imst-creator__head">
            <h1 class="ap-h2">${editing ? `Edit ${editing.label}` : "New style"}</h1>
            <p class="ap-body">
              Part of ${brand.playbookName}'s brand. It comes first whenever an image is made for this Playbook.
            </p>
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
              <section class="ap-card imst-creator__card" aria-labelledby="imst-fidelity">
                <h2 class="ap-body-bold" id="imst-fidelity">What to keep from the images</h2>
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

  function save() {
    state.errors = validateStyleDraft(state.draft);
    if (state.errors.length) {
      paint();
      target.querySelector(".ap-infobox.error")?.scrollIntoView({ block: "nearest" });
      return;
    }
    const saved = saveStyle(state.draft);
    toast(editing ? `${saved.label} updated.` : `${saved.label} added to ${brand.playbookName}.`);
    ctx.navigate(fiche);
  }

  paint();
  // The page's actions live in the topbar, right side (DS: the header carries them).
  const topbar = document.getElementById("topbar");
  if (brand)
    setTopbarActions(
      getPath(),
      toString(
        html`<div class="imst-topbar-actions">
          <button type="button" class="ap-button ghost grey" data-imst-creator="cancel">Cancel</button>
          <button type="button" class="ap-button primary blue" data-imst-creator="save">
            ${editing ? "Save changes" : "Save style"}
          </button>
        </div>`,
      ),
    );
  const offs = [
    topbar
      ? delegate(topbar, "click", "[data-imst-creator]", (_e, el) => {
          if (el.dataset.imstCreator === "save") save();
          else ctx.navigate(fiche);
        })
      : () => {},
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
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const action = el.dataset.imstAction;
      if (action === "remove-source") {
        state.draft.sources.splice(Number(el.dataset.index), 1);
        state.stale = !!state.test;
        paint();
      } else if (action === "test") runTest();
      else if (action === "save") save();
    }),
  ];
  return () => {
    alive = false;
    state.abort?.abort();
    offs.forEach((off) => off());
    setTopbarActions(null);
  };
}
