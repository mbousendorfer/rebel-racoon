// Image Generator — which Playbook the images are for. The active brand is
// always visible; one click changes it.
//
// In workspace mode (flag playbookWorkspace) the rail's Playbook switcher is
// already that control and always on screen, so this renders NOTHING: a second
// switcher would be two controls for one scope, and a static label restating the
// rail is chrome the reader has to rule out (CLAUDE.md § The Playbook scope). The
// brand card below names the brand anyway.
// Otherwise it is a DS .ap-action-dropdown (the CSS-UI stand-in for the
// Angular-only nav-selector) over the Playbooks the user can use.

import { html } from "../lib/html.js?v=1261";
import { menu } from "./menu.js?v=1261";
import { logoUrl } from "./asset.js?v=1261";
import { getActiveBrand, getBrands, hasOwnBrandPicker } from "../state/store.js?v=1261";

function mark(brand) {
  const url = logoUrl(brand, "icon");
  return url ? html`<img class="imst-picker__logo" src="${url}" alt="" />` : "";
}

export function renderBrandPicker() {
  const active = getActiveBrand();
  if (!active) return "";
  if (!hasOwnBrandPicker()) return "";
  return menu({
    label: "Choose a Playbook",
    wide: true,
    trigger: {
      className: "ap-button stroked grey imst-picker",
      label: `Playbook: ${active.playbookName}. Change`,
      content: html`${mark(active)}<span class="imst-picker__name">${active.playbookName}</span
        ><i class="ap-icon-chevron-down" aria-hidden="true"></i>`,
    },
    items: [
      ...getBrands().map((b) => ({
        action: "switch-brand",
        attrs: `data-imst-brand="${b.id}"`,
        label: b.playbookName,
        media: mark(b),
        selected: b.id === active.id,
        description: b.name !== b.playbookName ? b.name : "",
      })),
      "divider",
      { action: "new-playbook", icon: "ap-icon-plus", label: "New Playbook" },
    ],
  });
}
