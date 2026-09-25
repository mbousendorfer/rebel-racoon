// Image Generator — Campaigns and history, for the active Playbook.
// Campaigns: title, period, event, how many images. History: every generation
// run, newest first — reopen it, or delete it.

import { html, toString } from "../lib/html.js?v=1261";
import { delegate } from "../lib/delegate.js?v=1261";
import { renderFrame } from "./frame.js?v=1261";
import { renderEmpty } from "../ui/empty.js?v=1261";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1261";
import { confirmDialog } from "../ui/dialog.js?v=1261";
import { toast } from "../ui/toast.js?v=1261";
import { variationCanvas } from "../ui/variation.js?v=1261";
import { storageService } from "../services/index.js?v=1261";
import { CALENDAR_EVENTS } from "../config/calendar-events.js?v=1261";
import { formatById, formatRatio } from "../config/formats.js?v=1261";
import { networkById } from "../config/networks.js?v=1261";
import { deleteCreation } from "../state/creation-actions.js?v=1261";
import {
  boot,
  getActiveBrand,
  getCampaigns,
  getCreation,
  getCreations,
  getStyle,
  subscribe,
} from "../state/store.js?v=1261";

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function period(c) {
  if (!c.start && !c.end) return "—";
  const f = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return c.end ? `${f(c.start)} – ${f(c.end)}` : `From ${f(c.start)}`;
}

export function mount(target) {
  const paint = () => {
    const brand = getActiveBrand();
    if (!brand) {
      target.innerHTML = toString(
        renderFrame({
          section: "campaigns",
          body: renderEmpty({
            icon: "ap-icon-calendar",
            title: "Start with a Playbook",
            body: "Campaigns and images belong to a brand, and your brand lives in a Playbook.",
            action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
              <span>Create a Playbook</span>
            </button>`,
          }),
        }),
      );
      return;
    }
    const campaigns = getCampaigns(brand.id);
    const creations = getCreations(brand.id).filter((c) => c.variations.length);
    const campaignsBody = campaigns.length
      ? html`<table class="ap-table outer-border imst-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Period</th>
              <th>Event</th>
              <th class="right">Images</th>
            </tr>
          </thead>
          <tbody>
            ${campaigns.map(
              (c) =>
                html`<tr>
                  <td><span class="ap-body-bold">${c.title}</span><br /><span class="ap-caption">${c.angle}</span></td>
                  <td>${period(c)}</td>
                  <td>${CALENDAR_EVENTS.find((e) => e.id === c.eventId)?.label || "—"}</td>
                  <td class="right">${(c.creationIds || []).filter((id) => getCreation(id)).length}</td>
                </tr>`,
            )}
          </tbody>
        </table>`
      : html`<p class="ap-body imst-section__empty">
          No campaign yet. Picking a campaign idea on Generate starts one.
        </p>`;
    const historyBody = creations.length
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
      : html`<p class="ap-body imst-section__empty">Nothing generated for ${brand.playbookName} yet.</p>`;
    target.innerHTML = toString(
      renderFrame({
        section: "campaigns",
        aside: renderBrandPicker(),
        body: html`
          <section class="imst-section" aria-labelledby="imst-campaigns-title">
            <header class="imst-section__head"><h2 class="ap-subtitle" id="imst-campaigns-title">Campaigns</h2></header>
            ${campaignsBody}
          </section>
          <section class="imst-section" aria-labelledby="imst-history-title">
            <header class="imst-section__head"><h2 class="ap-subtitle" id="imst-history-title">History</h2></header>
            ${historyBody}
          </section>
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
        body: "Every style, product, campaign and image in Image Generator is replaced by the demo set. Your Playbooks are not touched. This can't be undone.",
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
