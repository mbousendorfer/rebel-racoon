// Image Generator — the brand's style creator, opened from the Playbook's Brand
// section (/playbook/:id/styles/new, /playbook/:id/styles/:styleId). The style is
// saved ON that Playbook (imageStyles); the topbar's back returns to the fiche.
//
// Sources: up to 6 reference images, all counted the same — the look is read from
// them (no presets to mix: removed at the user's request, 2026-09-28).
// An optional style prompt. (The "what to keep" choice was removed at the
// user's request, 2026-10-02: a new style keeps the essentials.) Saved FOR the
// active Playbook. (A three-subject "Test run" column was removed at the user's
// request, 2026-10-06: "ça n'a pas de sens".)

import { html, toString } from "../lib/html.js?v=2345";
import { delegate } from "../lib/delegate.js?v=2345";
import { getPath } from "../../../router.js?v=2345";
import { setTopbarActions } from "../../../components/topbar.js?v=2345";
import { renderFrame } from "./frame.js?v=2345";
import { renderEmpty } from "../ui/empty.js?v=2345";
import { field, preserveFocus, textInput } from "../ui/fields.js?v=2345";
import { dropzone, bindDropzones } from "../ui/dropzone.js?v=2345";
import { assetImg, hydrateAssets } from "../ui/asset.js?v=2345";
import { toast } from "../ui/toast.js?v=2345";
import { CUSTOM_STYLE_LIMITS, presetById } from "../config/style-presets.js?v=2345";
import { copyService } from "../services/index.js?v=2345";
import { lookFromColors } from "../render/visual.js?v=2345";
import { canEditBrand, getAsset, getBrand, getStyle } from "../state/store.js?v=2345";
import { saveStyle, uploadReference, validateStyleDraft } from "../state/style-actions.js?v=2345";

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

/**
 * `embed`: the same creator inside the studio (its "New style" popover, over the
 * preview area): no page frame or heading, the actions in `embed.footer`,
 * and `onSaved(style)` / `onCancel()` instead of going back to the fiche.
 */
export function mount(target, params, ctx, { embed = null } = {}) {
  // The Playbook is in the URL: a style belongs to one, and is edited in its colours.
  const found = params.styleId ? getStyle(params.styleId) : null;
  const editing = found && found.brandId === params.id ? found : null;
  const brand = canEditBrand(params.id) ? getBrand(params.id) : null;
  const state = {
    draft: draftFrom(editing, brand?.id),
    errors: [],
    // Set by the first Save: from then on each field says what it is missing,
    // under itself, and clears as soon as it is filled.
    showErrors: false,
    uploading: 0,
    promptBusy: false, // "Generate the prompt" is reading the images
  };

  const fiche = `/playbook/${encodeURIComponent(params.id)}`;

  // A reference image as a tile: the picture, and a way to take it out. Every
  // image counts the same (no weights: removed at the user's request, 2026-10-02).
  const renderSource = (s, i) => {
    // An image is an upload (asset) or, for a seeded style, a URL with its colours.
    const media = s.url
      ? html`<img class="imst-source__media" src="${s.url}" alt="" />`
      : assetImg(s.ref, { className: "imst-source__media" });
    const name = s.name || getAsset(s.ref)?.name || "Reference image";
    return html`
      <li class="imst-source" title="${name}">
        ${media}
        <button
          type="button"
          class="ap-close-button imst-source__remove"
          data-imst-action="remove-source"
          data-index="${i}"
          aria-label="Remove ${name}"
        >
          <i class="ap-icon-close" aria-hidden="true"></i>
        </button>
      </li>
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
    const page = (body) => (embed ? body : renderFrame({ body }));
    // One surface for one form: on the page the groups share a single card,
    // split by hairlines; in the studio's column the column is the surface.
    // The images come first in the studio, since they are what makes the style.
    const card = "imst-creator__group";
    const nameMissing = state.showErrors && !d.label.trim();
    const imagesMissing = state.showErrors && !images.length;
    // What the fields say themselves stays out of the banner.
    const otherErrors = state.errors.filter(
      (e) => !(nameMissing && e.startsWith("Give the style")) && !(imagesMissing && e.startsWith("Add at least one")),
    );
    const fieldError = (id, text) => html`<p class="ap-form-message error" id="${id}" role="alert">${text}</p>`;
    const identity = html` <section class="${card}">
      ${field({
        label: "Name",
        id: "imst-st-name",
        control: textInput({
          path: "label",
          id: "imst-st-name",
          value: d.label,
          placeholder: "e.g. Morning light",
          attrs: nameMissing ? 'class="invalid" aria-invalid="true" aria-describedby="imst-st-name-msg"' : "",
        }),
      })}
      ${nameMissing ? fieldError("imst-st-name-msg", "Give the style a name.") : ""}
    </section>`;
    const refs = html` <section class="${card}" aria-labelledby="imst-src-images">
        <div class="ap-form-field">
          <label id="imst-src-images">Reference images</label>
          ${dropzone({
            id: "refs",
            icon: "ap-icon-image",
            title: state.uploading ? "Adding…" : "Drop images here or",
            sub:
              images.length >= CUSTOM_STYLE_LIMITS.images
                ? `${CUSTOM_STYLE_LIMITS.images} images added, the most a style takes. Remove one to add another`
                : `Up to ${CUSTOM_STYLE_LIMITS.images} images that share the look you want · ${images.length} added`,
            compact: true,
            filled: true,
            // Full, the zone stays and says so: disabled, never hidden.
            disabled: images.length >= CUSTOM_STYLE_LIMITS.images,
          })}
          ${imagesMissing
            ? fieldError("imst-st-images-msg", "Add at least one image. I read the style's look from them.")
            : ""}
        </div>
        ${images.length
          ? html`<ul class="imst-sources">
              ${images.map(([s, i]) => renderSource(s, i))}
            </ul>`
          : ""}
      </section>
      <section class="${card}">
        <!-- The DS textarea field, its label inside it; Generate is a standalone link on the label's line. -->
        <div class="ap-textarea-field resizable imst-prompt-field">
          <label for="imst-st-prompt">Style prompt <small>(optional)</small></label>
          <button
            type="button"
            class="ap-link standalone imst-prompt-field__gen${!images.length || state.promptBusy ? " disabled" : ""}"
            data-imst-action="generate-prompt"
            aria-disabled="${!images.length || state.promptBusy}"
          >
            <i class="ap-icon-sparkles" aria-hidden="true"></i
            ><span
              >${state.promptBusy
                ? "Reading your images…"
                : d.stylePrompt
                  ? "Generate again"
                  : "Generate from the images"}</span
            >
          </button>
          <textarea
            id="imst-st-prompt"
            data-imst-field="stylePrompt"
            rows="4"
            placeholder="Generate the prompt from your images, then edit it if you like."
            ${state.promptBusy ? "disabled" : ""}
          >
${d.stylePrompt}</textarea
          >
        </div>
      </section>`;
    target.innerHTML = toString(
      page(html`
        ${embed
          ? ""
          : html`<header class="imst-creator__head">
              <h1 class="ap-h2">${editing ? `Edit ${editing.label}` : "New style"}</h1>
              <p class="ap-body">A look I learn from your images, then draw ${brand.playbookName}'s new images in.</p>
            </header>`}
        <div class="imst-creator${embed ? " imst-creator--embed" : ""}">
          <div class="imst-creator__form${embed ? "" : " ap-card imst-creator__card"}">
            ${embed ? html`${refs}${identity}` : html`${identity}${refs}`}
          </div>
        </div>
        ${otherErrors.length
          ? html`<div class="ap-infobox error" role="alert">
              <i class="ap-icon-warning_fill" aria-hidden="true"></i>
              <div class="ap-infobox-content">
                <div class="ap-infobox-texts"><div class="ap-infobox-message">${otherErrors.join(" ")}</div></div>
              </div>
            </div>`
          : ""}
      `),
    );
    hydrateAssets(target);
    restore();
    // No saving while the prompt is being written: it would save without it.
    (embed ? embed.footer : document.getElementById("topbar"))
      ?.querySelector('[data-imst-creator="save"]')
      ?.toggleAttribute("disabled", state.promptBusy);
  };

  // "Generate the prompt": the images' look and palette, put in words — a draft to edit.
  async function generatePrompt() {
    const colors = state.draft.sources.flatMap((s) => s.colors || getAsset(s.ref)?.colors || []);
    state.promptBusy = true;
    paint();
    try {
      state.draft.stylePrompt = await copyService.promptFromImages({
        colors,
        look: presetById(lookFromColors(colors)),
      });
    } catch {
      toast("I couldn't read the images. Try again.", { variant: "error" });
    }
    state.promptBusy = false;
    paint();
  }

  function save() {
    state.errors = validateStyleDraft(state.draft);
    state.showErrors = true;
    if (state.errors.length) {
      paint();
      const first = target.querySelector('[aria-invalid="true"], .ap-form-message.error, .ap-infobox.error');
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (first?.matches("input")) first.focus();
      return;
    }
    const saved = saveStyle(state.draft);
    toast(editing ? `${saved.label} updated.` : `${saved.label} added to ${brand.playbookName}.`);
    if (embed) embed.onSaved(saved);
    else ctx.navigate(fiche);
  }

  paint();
  // The page's actions live in the topbar, right side (DS: the header carries them).
  const topbar = embed ? embed.footer : document.getElementById("topbar");
  const buttons = html`<button type="button" class="ap-button ghost grey" data-imst-creator="cancel">Cancel</button>
    <button type="button" class="ap-button primary blue" data-imst-creator="save">
      ${editing ? "Save changes" : "Save style"}
    </button>`;
  // In the studio, the buttons go straight into its footer (already right-grouped).
  const actions = embed ? buttons : html`<div class="imst-topbar-actions">${buttons}</div>`;
  if (brand && embed) embed.footer.innerHTML = toString(actions);
  else if (brand) setTopbarActions(getPath(), toString(actions));
  const offs = [
    topbar
      ? delegate(topbar, "click", "[data-imst-creator]", (_e, el) => {
          if (el.dataset.imstCreator === "save") {
            if (!el.disabled) save();
          } else if (embed) embed.onCancel();
          else ctx.navigate(fiche);
        })
      : () => {},
    bindDropzones(target, async (_id, files) => {
      const room = CUSTOM_STYLE_LIMITS.images - state.draft.sources.filter((s) => s.type === "image").length;
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (files.length > images.length) toast("Only images can be used as references.", { variant: "error" });
      if (images.length > room)
        toast(`Only ${room} more reference image${room === 1 ? "" : "s"} fit. I left the rest out.`, {
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
      paint();
    }),
    delegate(target, "input", "[data-imst-field]", (_e, el) => {
      state.draft[el.dataset.imstField] = el.value;
      // A field flagged as missing clears the moment it is filled.
      if (el.getAttribute("aria-invalid") === "true" && el.value.trim()) paint();
    }),
    delegate(target, "click", "[data-imst-action]", (_e, el) => {
      const action = el.dataset.imstAction;
      if (action === "remove-source") {
        state.draft.sources.splice(Number(el.dataset.index), 1);
        paint();
      } else if (action === "generate-prompt") {
        if (el.getAttribute("aria-disabled") !== "true") generatePrompt();
      } else if (action === "save") save();
    }),
  ];
  return () => {
    alive = false;
    offs.forEach((off) => off());
    if (!embed) setTopbarActions(null);
  };
}
