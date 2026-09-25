// Image Generator — Generate (hub), the module's front door. The active brand
// (a Playbook) sits on top; campaign ideas, the prompt bar and the four
// variations land below it in step 4.

import { html, toString } from "../lib/html.js?v=1229";
import { renderFrame } from "./frame.js?v=1229";
import { renderEmpty } from "../ui/empty.js?v=1229";
import { renderBrandPicker } from "../ui/brand-picker.js?v=1229";
import { renderBrandCard } from "../ui/brand-card.js?v=1229";
import { getActiveBrand, getCreations, subscribe } from "../state/store.js?v=1229";

export function mount(target) {
  const paint = () => {
    const brand = getActiveBrand();
    const count = brand ? getCreations(brand.id).length : 0;
    const body = brand
      ? html`
          ${renderBrandCard(brand)}
          ${renderEmpty({
            icon: "ap-icon-sparkles",
            title: "What do you want to create?",
            body: `${count} image${count === 1 ? "" : "s"} created for ${brand.playbookName} so far. The prompt bar, campaign ideas and the four variations arrive in step 4.`,
          })}
        `
      : renderEmpty({
          icon: "ap-icon-image",
          title: "Start with a Playbook",
          body: "Images follow a brand, and your brand lives in a Playbook: its logo, colours, fonts and rules. Create one from your website, your files, or by hand.",
          action: html`<button type="button" class="ap-button primary blue" data-imst-action="new-playbook">
            <span>Create a Playbook</span>
          </button>`,
        });
    target.innerHTML = toString(renderFrame({ section: "create", aside: renderBrandPicker(), body }));
  };
  paint();
  return subscribe(paint);
}
