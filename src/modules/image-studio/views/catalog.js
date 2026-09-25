// Image Generator — Catalog: the active Playbook's products. Add one from its
// page URL (mocked extraction) or by hand; a product can be the subject of an
// image, and stays recognisable because its own picture is drawn in. "Product
// shoot" stages it in three scenes — studio, lifestyle, seasonal.

import { html, toString } from "../lib/html.js?v=1308";
import { delegate } from "../lib/delegate.js?v=1308";
import { randomSeed } from "../lib/prng.js?v=1308";
import { renderFrame } from "./frame.js?v=1308";
import { renderEmpty } from "../ui/empty.js?v=1308";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1308";
import { menu } from "../ui/menu.js?v=1308";
import { assetImg, hydrateAssets, warmAssetUrls } from "../ui/asset.js?v=1308";
import { confirmDialog, openDialog } from "../ui/dialog.js?v=1308";
import { dropzone, bindDropzones } from "../ui/dropzone.js?v=1308";
import { field, textArea, textInput } from "../ui/fields.js?v=1308";
import { toast } from "../ui/toast.js?v=1308";
import { productHref } from "../ui/variation.js?v=1308";
import { renderVisual, svgToDataUrl } from "../render/visual.js?v=1308";
import { imageGenerationService, productService, storageService } from "../services/index.js?v=1308";
import { getActiveBrand, getAsset, getProducts, getStyle, subscribe } from "../state/store.js?v=1308";
import {
  SHOOT_SCENES,
  addShoot,
  deleteProduct,
  saveDrawnImage,
  saveProduct,
  uploadProductImage,
} from "../state/product-actions.js?v=1308";

function shotUrl(product, shot, brand) {
  const scene = SHOOT_SCENES.find((s) => s.id === shot.scene);
  return svgToDataUrl(
    renderVisual({
      style: getStyle(scene.styleId),
      brand,
      seed: shot.seed,
      width: 1080,
      height: 1080,
      subjectKind: "product",
      productHref: productHref(product.id),
      getAsset,
    }),
  );
}

function productCard(p, brand) {
  const domain = p.url ? p.url.replace(/^https?:\/\//, "").split("/")[0] : "";
  return html`
    <article class="ap-card imst-product">
      <div class="imst-product__media">
        ${p.imageAssetId
          ? assetImg(p.imageAssetId, { alt: p.name })
          : html`<i class="ap-icon-product-tag ap-icon-xl" aria-hidden="true"></i>`}
      </div>
      <div class="imst-product__body">
        <div class="imst-style-card__title">
          <h3 class="ap-body-bold">${p.name}</h3>
          ${menu({
            label: `${p.name} actions`,
            trigger: {
              className: "ap-icon-button imst-icon-summary",
              label: `${p.name} actions`,
              content: html`<i class="ap-icon-more" aria-hidden="true"></i>`,
            },
            items: [
              {
                action: "product-use",
                icon: "ap-icon-sparkles",
                label: "Use in a new image",
                attrs: `data-id="${p.id}"`,
              },
              {
                action: "product-shoot",
                icon: "ap-icon-image",
                label: "Product shoot",
                description: "Studio, lifestyle and seasonal scenes",
                attrs: `data-id="${p.id}"`,
              },
              { action: "product-edit", icon: "ap-icon-pen", label: "Edit", attrs: `data-id="${p.id}"` },
              "divider",
              { action: "product-delete", icon: "ap-icon-trash", label: "Delete", attrs: `data-id="${p.id}"` },
            ],
          })}
        </div>
        <p class="ap-caption imst-product__desc">${p.description}</p>
        ${domain ? html`<span class="ap-caption imst-product__domain">${domain}</span>` : ""}
        ${p.shoots?.length
          ? html`<div class="imst-product__shoots" aria-label="Product shoot">
              ${p.shoots
                .slice(0, 3)
                .map(
                  (s) =>
                    html`<img
                      src="${shotUrl(p, s, brand)}"
                      alt="${SHOOT_SCENES.find((x) => x.id === s.scene)?.label} scene"
                    />`,
                )}
            </div>`
          : ""}
      </div>
    </article>
  `;
}

export function mount(target, _params, ctx) {
  let alive = true;
  const paint = () => {
    if (!alive) return;
    const brand = getActiveBrand();
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          section: "catalog",
          body: renderEmpty({
            icon: "ap-icon-product-tag",
            title: "Start with a Playbook",
            body: "A catalogue belongs to a brand, and your brand lives in a Playbook.",
            action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
              <span>Create a Playbook</span>
            </button>`,
          }),
        }),
      );
      return;
    }
    const products = getProducts(brand.id);
    target.innerHTML = toString(
      renderFrame({
        section: "catalog",
        aside: renderBrandPicker(),
        body: html`
          <section class="imst-section" aria-labelledby="imst-catalog-title">
            <header class="imst-section__head">
              <div>
                <h2 class="ap-subtitle" id="imst-catalog-title">Catalog for ${brand.name}</h2>
                <p class="ap-caption">
                  A product picked as the subject of an image is drawn from its own picture, so it stays recognisable.
                </p>
              </div>
              <button type="button" class="ap-button primary blue" data-imst-action="product-add">
                <i class="ap-icon-plus" aria-hidden="true"></i><span>Add product</span>
              </button>
            </header>
            ${products.length
              ? html`<div class="imst-grid imst-grid--styles">${products.map((p) => productCard(p, brand))}</div>`
              : renderEmpty({
                  icon: "ap-icon-product-tag",
                  title: "No product yet",
                  body: "Add one from its page, or by hand.",
                })}
          </section>
        `,
      }),
    );
    hydrateAssets(target);
  };

  // ── Add / edit ─────────────────────────────────────────────────────────────

  function openProductDialog(existing = null) {
    const brand = getActiveBrand();
    const draft = {
      mode: existing ? "manual" : "url",
      url: existing?.url || "",
      name: existing?.name || "",
      description: existing?.description || "",
      imageAssetId: existing?.imageAssetId || null,
      drawnSvg: null,
      status: "idle",
      error: "",
    };
    const imagePreview = () =>
      draft.drawnSvg
        ? html`<img class="imst-product-form__img" src="${storageService.svgDataUrl(draft.drawnSvg)}" alt="" />`
        : draft.imageAssetId
          ? assetImg(draft.imageAssetId, { className: "imst-product-form__img" })
          : "";
    const body = () => html`
      ${existing
        ? ""
        : html`<div class="ap-tabs">
            <div class="ap-tabs-nav" role="tablist" aria-label="How to add it">
              ${[
                ["url", "From its page"],
                ["manual", "By hand"],
              ].map(
                ([m, label]) =>
                  html`<button
                    type="button"
                    role="tab"
                    class="ap-tabs-tab${draft.mode === m ? " active" : ""}"
                    aria-selected="${draft.mode === m}"
                    data-imst-pmode="${m}"
                  >
                    ${label}
                  </button>`,
              )}
            </div>
          </div>`}
      ${draft.mode === "url" && draft.status !== "done"
        ? html`<form class="imst-form-row" data-imst-pform="url" novalidate>
              ${field({
                label: "Product page",
                id: "imst-p-url",
                control: textInput({
                  path: "url",
                  id: "imst-p-url",
                  value: draft.url,
                  placeholder: "yourbrand.com/shop/product",
                  type: "url",
                  attrs: "autofocus",
                }),
              })}
              <button
                type="submit"
                class="ap-button primary orange${draft.status === "loading" ? " loading" : ""}"
                ${draft.status === "loading" ? "disabled" : ""}
              >
                <i class="ap-icon-sparkles" aria-hidden="true"></i
                ><span>${draft.status === "loading" ? "Reading the page…" : "Get the details"}</span>
              </button>
            </form>
            ${draft.error ? html`<span class="ap-form-message error" role="alert">${draft.error}</span>` : ""}`
        : html`
            ${draft.status === "done"
              ? html`<p class="ap-caption">Found on the page — check it before saving.</p>`
              : ""}
            <div class="imst-product-form">
              <div class="imst-product-form__fields">
                ${field({
                  label: "Name",
                  id: "imst-p-name",
                  control: textInput({
                    path: "name",
                    id: "imst-p-name",
                    value: draft.name,
                    placeholder: "e.g. GPS collar",
                  }),
                })}
                ${field({
                  label: "Description",
                  id: "imst-p-desc",
                  control: textArea({ path: "description", id: "imst-p-desc", value: draft.description, rows: 3 }),
                })}
                ${field({
                  label: "Page (optional)",
                  id: "imst-p-page",
                  control: textInput({ path: "url", id: "imst-p-page", value: draft.url, placeholder: "https://…" }),
                })}
              </div>
              <div class="imst-product-form__image">
                ${imagePreview()}
                ${dropzone({
                  id: "product-image",
                  title:
                    draft.imageAssetId || draft.drawnSvg ? "Replace the picture —" : "Drop the product picture, or",
                  sub: "PNG, JPG, SVG or WebP",
                  multiple: false,
                  compact: true,
                })}
              </div>
            </div>
          `}
    `;
    const footer = () =>
      html`<div class="ap-dialog-footer-right">
        <button type="button" class="ap-button stroked grey" data-imst-pdlg="cancel">Cancel</button>
        <button
          type="button"
          class="ap-button primary blue"
          data-imst-pdlg="save"
          ${draft.mode === "url" && draft.status !== "done" ? "disabled" : ""}
        >
          ${existing ? "Save changes" : "Add product"}
        </button>
      </div>`;
    const dialog = openDialog({
      title: existing ? `Edit ${existing.name}` : "Add a product",
      subtitle: `To ${brand.playbookName}'s catalogue.`,
      size: "md",
      body: body(),
      footer: footer(),
      onMount(el) {
        const repaint = () => {
          dialog.setBody(body());
          dialog.setFooter(footer());
          hydrateAssets(el);
        };
        hydrateAssets(el);
        const offDrop = bindDropzones(el, async (_id, files) => {
          try {
            const asset = await uploadProductImage(brand.id, files[0]);
            draft.imageAssetId = asset.id;
            draft.drawnSvg = null;
            await warmAssetUrls([asset.id]);
            repaint();
          } catch (error) {
            toast(error.message, { variant: "error" });
          }
        });
        el.addEventListener("input", (event) => {
          const f = event.target.dataset?.imstField;
          if (f) draft[f] = event.target.value;
        });
        el.addEventListener("submit", async (event) => {
          event.preventDefault();
          draft.status = "loading";
          draft.error = "";
          repaint();
          try {
            const found = await productService.fromUrl(draft.url, { brand });
            Object.assign(draft, {
              name: found.name,
              description: found.description,
              url: found.url,
              drawnSvg: found.svg,
              status: "done",
            });
          } catch (error) {
            Object.assign(draft, { status: "idle", error: error.message || "I couldn't read that page." });
          }
          if (dialog.el.isConnected) repaint();
        });
        el.addEventListener("click", (event) => {
          const mode = event.target.closest("[data-imst-pmode]");
          if (mode) {
            draft.mode = mode.dataset.imstPmode;
            repaint();
            return;
          }
          const btn = event.target.closest("[data-imst-pdlg]");
          if (!btn) return;
          if (btn.dataset.imstPdlg === "cancel") return dialog.close();
          if (!draft.name.trim()) {
            toast("Give the product a name.", { variant: "error" });
            return;
          }
          const imageAssetId = draft.drawnSvg
            ? saveDrawnImage(brand.id, draft.name, draft.drawnSvg).id
            : draft.imageAssetId;
          const saved = saveProduct({
            id: existing?.id,
            brandId: brand.id,
            name: draft.name,
            description: draft.description,
            url: draft.url,
            imageAssetId,
          });
          dialog.close();
          toast(existing ? `${saved.name} updated.` : `${saved.name} added to the catalogue.`);
        });
        return offDrop;
      },
    });
  }

  // ── Product shoot ──────────────────────────────────────────────────────────

  async function openShoot(product) {
    const brand = getActiveBrand();
    await warmAssetUrls([product.imageAssetId]);
    const shots = SHOOT_SCENES.map((scene) => ({ scene: scene.id, seed: randomSeed(), status: "loading" }));
    const body = () =>
      html`<div class="imst-test-grid">
        ${shots.map((s) => {
          const scene = SHOOT_SCENES.find((x) => x.id === s.scene);
          return html`<figure class="imst-test-grid__item">
            <div class="imst-test-grid__frame">
              ${s.status === "loading"
                ? html`<span class="ap-loader size-24"></span>`
                : s.status === "error"
                  ? html`<span class="ap-caption">Failed</span>`
                  : html`<img
                      src="${shotUrl(product, s, brand)}"
                      alt="${product.name}, ${scene.label.toLowerCase()} scene"
                    />`}
            </div>
            <figcaption class="imst-shoot__caption">
              <span class="ap-caption">${scene.label}</span>
              ${s.status === "done"
                ? html`<button type="button" class="ap-link" data-imst-shoot-use="${s.scene}">Use</button>`
                : ""}
            </figcaption>
          </figure>`;
        })}
      </div>`;
    const footer = () =>
      html`<div class="ap-dialog-footer-right">
        <button
          type="button"
          class="ap-button stroked grey"
          data-imst-shoot="again"
          ${shots.some((s) => s.status === "loading") ? "disabled" : ""}
        >
          Shoot again
        </button>
        <button
          type="button"
          class="ap-button primary blue"
          data-imst-shoot="save"
          ${shots.some((s) => s.status === "done") ? "" : "disabled"}
        >
          Save to the product
        </button>
      </div>`;
    const run = async (dialog) => {
      await Promise.all(
        shots.map(async (s) => {
          const scene = SHOOT_SCENES.find((x) => x.id === s.scene);
          try {
            await imageGenerationService.generate(
              { brief: { prompt: `${product.name} ${scene.prompt}` }, brand, style: getStyle(scene.styleId), product },
              {},
            );
            s.status = "done";
          } catch {
            s.status = "error";
          }
          if (dialog.el.isConnected) {
            dialog.setBody(body());
            dialog.setFooter(footer());
          }
        }),
      );
    };
    const dialog = openDialog({
      title: `Product shoot — ${product.name}`,
      subtitle: "The product, staged in three scenes, in the brand's colours.",
      size: "lg",
      body: body(),
      footer: footer(),
      onMount(el) {
        el.addEventListener("click", (event) => {
          const use = event.target.closest("[data-imst-shoot-use]");
          if (use) {
            const scene = SHOOT_SCENES.find((x) => x.id === use.dataset.imstShootUse);
            dialog.close();
            ctx.navigate(`/image-generator?product=${product.id}&style=${scene.styleId}`);
            return;
          }
          const btn = event.target.closest("[data-imst-shoot]");
          if (!btn) return;
          if (btn.dataset.imstShoot === "save") {
            addShoot(
              product.id,
              shots.filter((s) => s.status === "done").map(({ scene, seed }) => ({ scene, seed })),
            );
            toast(`Saved to ${product.name}.`);
            dialog.close();
          } else {
            shots.forEach((s) => Object.assign(s, { seed: randomSeed(), status: "loading" }));
            dialog.setBody(body());
            dialog.setFooter(footer());
            run(dialog);
          }
        });
      },
    });
    run(dialog);
  }

  paint();
  getProducts(getActiveBrand()?.id).forEach((p) => p.imageAssetId && warmAssetUrls([p.imageAssetId]));
  const offs = [
    subscribe(paint),
    delegate(target, "click", "[data-imst-action]", async (_e, el) => {
      const a = el.dataset.imstAction;
      const product = el.dataset.id ? storageService.get("products", el.dataset.id) : null;
      if (a === "product-add") openProductDialog();
      else if (a === "product-edit") openProductDialog(product);
      else if (a === "product-shoot") openShoot(product);
      else if (a === "product-use") ctx.navigate(`/image-generator?product=${product.id}`);
      else if (a === "product-delete") {
        const ok = await confirmDialog({
          title: `Delete ${product.name}?`,
          body: "Images already made with it keep it. This can't be undone.",
          confirmLabel: "Delete product",
          danger: true,
        });
        if (!ok) return;
        deleteProduct(product.id);
        toast(`${product.name} deleted.`);
      }
    }),
  ];
  return () => {
    alive = false;
    offs.forEach((off) => off());
  };
}
