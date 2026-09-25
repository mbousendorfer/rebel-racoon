// Image Generator — Styles: the Playbook's own styles first, then the system
// presets by family. Every thumbnail is drawn in the active brand's palette.

import { html, toString } from "../lib/html.js?v=1229";
import { delegate } from "../lib/delegate.js?v=1229";
import { renderFrame } from "./frame.js?v=1229";
import { renderEmpty } from "../ui/empty.js?v=1229";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1229";
import { menu } from "../ui/menu.js?v=1229";
import { styleThumb } from "../ui/style-thumb.js?v=1229";
import { confirmDialog, openDialog } from "../ui/dialog.js?v=1229";
import { toast } from "../ui/toast.js?v=1229";
import { STYLE_FAMILIES, STYLE_PRESETS, STYLE_TEST_SUBJECTS, presetById } from "../config/style-presets.js?v=1229";
import { getActiveBrand, getStyle, getStylesForBrand, subscribe } from "../state/store.js?v=1229";
import { deleteStyle, duplicateStyle } from "../state/style-actions.js?v=1229";

/** "Lifestyle 70% · Editorial 30% · 2 images" — what a custom style is made of, in words. */
export function sourcesSummary(style) {
  const sources = style.custom?.sources || [];
  const total = sources.reduce((sum, s) => sum + s.weight, 0) || 1;
  const presets = sources
    .filter((s) => s.type === "preset")
    .map((s) => `${presetById(s.ref)?.label || s.label} ${Math.round((s.weight / total) * 100)}%`);
  const images = sources.filter((s) => s.type === "image").length;
  return [...presets, images ? `${images} reference image${images === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
}

function customCard(style, brand) {
  return html`
    <article class="ap-card imst-style-card">
      <button
        type="button"
        class="imst-style-card__open"
        data-imst-nav="/image-generator/styles/${style.id}"
        aria-label="Edit ${style.label}"
      >
        ${styleThumb(style, brand)}
      </button>
      <div class="imst-style-card__body">
        <div class="imst-style-card__title">
          <h3 class="ap-body-bold">${style.label}</h3>
          ${menu({
            label: `${style.label} actions`,
            trigger: {
              className: "ap-icon-button imst-icon-summary",
              label: `${style.label} actions`,
              content: html`<i class="ap-icon-more" aria-hidden="true"></i>`,
            },
            items: [
              { action: "edit-style", icon: "ap-icon-pen", label: "Edit", attrs: `data-imst-style="${style.id}"` },
              {
                action: "duplicate-style",
                icon: "ap-icon-copy",
                label: "Duplicate",
                attrs: `data-imst-style="${style.id}"`,
              },
              "divider",
              {
                action: "delete-style",
                icon: "ap-icon-trash",
                label: "Delete",
                attrs: `data-imst-style="${style.id}"`,
              },
            ],
          })}
        </div>
        <span class="ap-caption imst-style-card__meta">${sourcesSummary(style)}</span>
        <span class="imst-style-card__tags">
          <span class="ap-tag grey mini"
            ><span>${style.custom.fidelity === "composition" ? "Style & composition" : "Essential"}</span></span
          >
          ${style.supportsEmbeddedText ? html`<span class="ap-tag grey mini"><span>Text in image</span></span>` : ""}
        </span>
      </div>
    </article>
  `;
}

function presetCard(preset, brand) {
  return html`
    <button
      type="button"
      class="ap-card imst-style-card imst-style-card--preset"
      data-imst-preset="${preset.id}"
      aria-label="${preset.label} — preview"
    >
      ${styleThumb(preset, brand)}
      <span class="imst-style-card__body">
        <span class="ap-body-bold">${preset.label}</span>
        <span class="ap-caption imst-style-card__meta">${preset.description}</span>
        ${preset.supportsEmbeddedText
          ? html`<span class="imst-style-card__tags"
              ><span class="ap-tag grey mini"><span>Text in image</span></span></span
            >`
          : ""}
      </span>
    </button>
  `;
}

function openPresetPreview(preset, brand, navigate) {
  const dialog = openDialog({
    title: preset.label,
    subtitle: preset.description,
    size: "lg",
    body: html`
      <div class="imst-test-grid">
        ${STYLE_TEST_SUBJECTS.map(
          (s, i) =>
            html`<figure class="imst-test-grid__item">
              ${styleThumb(preset, brand, { seed: 7 + i * 131, kind: s.id })}
              <figcaption class="ap-caption">${s.label}</figcaption>
            </figure>`,
        )}
      </div>
      <p class="ap-body imst-dialog__text">
        ${preset.supportsEmbeddedText
          ? "This style can carry text I write into the image, or an editable text layer."
          : "Text goes on an editable layer with this style — it can't carry text written into the image."}
      </p>
    `,
    footer: html`<div class="ap-dialog-footer-right">
      <button type="button" class="ap-button stroked grey" data-imst-dlg="customize">Make it your own</button>
      <button type="button" class="ap-button primary blue" data-imst-dlg="use">Use this style</button>
    </div>`,
    onMount(el) {
      el.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-imst-dlg]");
        if (!btn) return;
        dialog.close();
        if (btn.dataset.imstDlg === "customize") navigate(`/image-generator/styles/new?from=${preset.id}`);
        else navigate(`/image-generator?style=${preset.id}`);
      });
    },
  });
}

export function mount(target, _params, ctx) {
  let family = "all";
  const paint = () => {
    const brand = getActiveBrand();
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          section: "styles",
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "Start with a Playbook",
            body: "Styles are saved for a brand, and your brand lives in a Playbook.",
            action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
              <span>Create a Playbook</span>
            </button>`,
          }),
        }),
      );
      return;
    }
    const own = getStylesForBrand(brand.id).filter((s) => s.kind === "custom");
    const presets = STYLE_PRESETS.filter((p) => family === "all" || p.family === family);
    target.innerHTML = toString(
      renderFrame({
        section: "styles",
        aside: renderBrandPicker(),
        body: html`
          <section class="imst-section" aria-labelledby="imst-own-styles">
            <header class="imst-section__head">
              <div>
                <h2 class="ap-subtitle" id="imst-own-styles">Styles for ${brand.name}</h2>
                <p class="ap-caption">They come first whenever you pick a style for this Playbook.</p>
              </div>
              <button type="button" class="ap-button primary blue" data-imst-nav="/image-generator/styles/new">
                <i class="ap-icon-plus" aria-hidden="true"></i><span>New style</span>
              </button>
            </header>
            ${own.length
              ? html`<div class="imst-grid imst-grid--styles">${own.map((s) => customCard(s, brand))}</div>`
              : html`<p class="ap-body imst-section__empty">
                  No style of your own yet. Mix reference images and presets into one you can reuse.
                </p>`}
          </section>
          <section class="imst-section" aria-labelledby="imst-presets">
            <header class="imst-section__head">
              <h2 class="ap-subtitle" id="imst-presets">Presets</h2>
            </header>
            <div class="imst-chips" role="group" aria-label="Filter presets by family">
              ${[{ id: "all", label: "All" }, ...STYLE_FAMILIES].map(
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
            <div class="imst-grid imst-grid--styles">${presets.map((p) => presetCard(p, brand))}</div>
          </section>
        `,
      }),
    );
  };
  paint();
  const offs = [
    subscribe(paint),
    delegate(target, "click", "[data-imst-family]", (_e, el) => {
      family = el.dataset.imstFamily;
      paint();
      target.querySelector(`[data-imst-family="${family}"]`)?.focus();
    }),
    delegate(target, "click", "[data-imst-preset]", (_e, el) =>
      openPresetPreview(presetById(el.dataset.imstPreset), getActiveBrand(), ctx.navigate),
    ),
    delegate(target, "click", "[data-imst-action='edit-style']", (_e, el) =>
      ctx.navigate(`/image-generator/styles/${el.dataset.imstStyle}`),
    ),
    delegate(target, "click", "[data-imst-action='duplicate-style']", (_e, el) => {
      const copy = duplicateStyle(el.dataset.imstStyle);
      if (copy) toast(`Duplicated as ${copy.label}.`);
    }),
    delegate(target, "click", "[data-imst-action='delete-style']", async (_e, el) => {
      const style = getStyle(el.dataset.imstStyle);
      const ok = await confirmDialog({
        title: `Delete ${style.label}?`,
        body: "Images already made with it stay as they are. This can't be undone.",
        confirmLabel: "Delete style",
        danger: true,
      });
      if (!ok) return;
      deleteStyle(style.id);
      toast(`${style.label} deleted.`);
    }),
  ];
  return () => offs.forEach((off) => off());
}
