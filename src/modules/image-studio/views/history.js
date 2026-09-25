// Image Generator — History, for the active Playbook: every generation run,
// newest first — reopen it on Generate, or delete it.

import { html, toString } from "../lib/html.js?v=1308";
import { delegate } from "../lib/delegate.js?v=1308";
import { renderFrame } from "./frame.js?v=1308";
import { renderEmpty } from "../ui/empty.js?v=1308";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1308";
import { confirmDialog } from "../ui/dialog.js?v=1308";
import { toast } from "../ui/toast.js?v=1308";
import { variationCanvas } from "../ui/variation.js?v=1308";
import { storageService } from "../services/index.js?v=1308";
import { formatById, formatRatio } from "../config/formats.js?v=1308";
import { networkById } from "../config/networks.js?v=1308";
import { deleteCreation } from "../state/creation-actions.js?v=1308";
import { boot, getActiveBrand, getCreation, getCreations, getStyle, subscribe } from "../state/store.js?v=1308";

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function mount(target) {
  const paint = () => {
    const brand = getActiveBrand();
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          section: "history",
          body: renderEmpty({
            icon: "ap-icon-history",
            title: "Start with a Playbook",
            body: "Images belong to a brand, and your brand lives in a Playbook.",
            action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
              <span>Create a Playbook</span>
            </button>`,
          }),
        }),
      );
      return;
    }
    const creations = getCreations(brand.id).filter((c) => c.variations.length);
    const list = creations.length
      ? html`<ul class="imst-history">
          ${creations.map((c) => {
            const v = c.variations.find((x) => x.id === c.selectedVariationId) || c.variations[0];
            const f = formatById(c.brief.formatIds[0]);
            const style = c.styleSnapshot || getStyle(c.brief.styleId);
            return html`<li class="ap-card imst-history__item">
              <button
                type="button"
                class="imst-history__open"
                data-imst-nav="/image-generator?creation=${c.id}"
                aria-label="Open ${c.title}"
              >
                ${variationCanvas({
                  creation: c,
                  variation: v,
                  formatId: f.id,
                  brand,
                  className: "imst-history__thumb",
                })}
              </button>
              <div class="imst-history__body">
                <span class="ap-body-bold">${c.title}</span>
                <span class="ap-caption"
                  >${style?.label || "Style"} · ${networkById(f.network).label}
                  ${formatRatio(f)}${c.brief.formatIds.length > 1
                    ? ` + ${c.brief.formatIds.length - 1} more`
                    : ""}</span
                >
                <span class="ap-caption"
                  >${day(c.updatedAt)} · ${c.variations.length}
                  variations${c.favoriteVariationIds?.length
                    ? ` · ${c.favoriteVariationIds.length} in favourites`
                    : ""}</span
                >
              </div>
              <button
                type="button"
                class="ap-icon-button transparent grey"
                data-imst-action="delete-creation"
                data-id="${c.id}"
                aria-label="Delete ${c.title}"
                data-tooltip="Delete"
              >
                <i class="ap-icon-trash" aria-hidden="true"></i>
              </button>
            </li>`;
          })}
        </ul>`
      : renderEmpty({
          icon: "ap-icon-history",
          title: "Nothing generated yet",
          body: `Images you generate for ${brand.playbookName} show up here.`,
        });
    target.innerHTML = toString(
      renderFrame({
        section: "history",
        aside: renderBrandPicker(),
        body: html`
          ${list}
          <div class="imst-page-foot">
            <button type="button" class="ap-button ghost grey" data-imst-action="reset">Reset demo data</button>
          </div>
        `,
      }),
    );
  };
  paint();
  const offs = [
    subscribe(paint),
    delegate(target, "click", "[data-imst-action='delete-creation']", async (_e, el) => {
      const c = getCreation(el.dataset.id);
      const ok = await confirmDialog({
        title: `Delete ${c.title}?`,
        body: "Its variations and edits are deleted. This can't be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      deleteCreation(c.id);
      toast(`${c.title} deleted.`);
    }),
    delegate(target, "click", "[data-imst-action='reset']", async () => {
      const ok = await confirmDialog({
        title: "Reset demo data?",
        body: "Every style, product and image in Image Generator is replaced by the demo set. Your Playbooks are not touched. This can't be undone.",
        confirmLabel: "Reset",
        danger: true,
      });
      if (!ok) return;
      await storageService.resetAll();
      boot();
      toast("Demo data restored.");
    }),
  ];
  return () => offs.forEach((off) => off());
}
