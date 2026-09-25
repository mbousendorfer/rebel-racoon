// Image Generator — Campaigns and history, for the active brand. Step 1 skeleton;
// the table and history land with the hub (step 4).

import { html, toString } from "../lib/html.js?v=1227";
import { delegate } from "../lib/delegate.js?v=1227";
import { renderFrame } from "./frame.js?v=1227";
import { renderEmpty } from "../ui/empty.js?v=1227";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1227";
import { confirmDialog } from "../ui/dialog.js?v=1227";
import { toast } from "../ui/toast.js?v=1227";
import { storageService } from "../services/index.js?v=1227";
import { boot, getActiveBrand, getCampaigns, subscribe } from "../state/store.js?v=1227";

export function mount(target) {
  const paint = () => {
    const brand = getActiveBrand();
    const campaigns = brand ? getCampaigns(brand.id) : [];
    target.innerHTML = toString(
      renderFrame({
        section: "campaigns",
        aside: renderBrandPicker(),
        body: html`
          ${renderEmpty({
            icon: "ap-icon-calendar",
            title: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`,
            body: campaigns.map((c) => c.title).join(" · ") || "Nothing generated for this Playbook yet.",
          })}
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
