// Image Generator — the studio, opened from a draft (flag sexySquirrel: it
// replaces the draft's Image Studio). A near-fullscreen dialog around the same
// studio as the Generate tab (views/studio.js, mode "draft"): the chat's
// Playbook is the brand, the draft's network sets the shapes, and "Use in
// draft" hands the finished PNG back to the caller — the draft.

import { html } from "../lib/html.js?v=1360";
import { openDialog } from "./dialog.js?v=1360";
import { installMenus } from "./menu.js?v=1360";
import { toast } from "./toast.js?v=1360";
import { mountStudio } from "../views/studio.js?v=1360";
import { DRAFT_NETWORK } from "../config/formats.js?v=1360";
import { networkById } from "../config/networks.js?v=1360";
import { getActiveBrandId } from "../state/store.js?v=1360";

/**
 * @param {{ brandId?: string, network?: string, text?: string, imageUrl?: string,
 *           slides?: number, onUse: (dataUrl: string) => void }} draft
 */
export function openDraftStudio({ brandId, network, text = "", imageUrl = "", slides = 0, onUse }) {
  const net = DRAFT_NETWORK[network] || null;
  const label = net ? networkById(net).label : "";
  const excerpt = String(text).replace(/\s+/g, " ").trim();
  let cleanup = null;
  const dialog = openDialog({
    title: label ? `Image for this ${label} post` : "Image for this post",
    subtitle: excerpt ? `“${excerpt.length > 110 ? excerpt.slice(0, 107).trimEnd() + "…" : excerpt}”` : "",
    size: "studio",
    body: html`<div class="imst imst-draft-host" data-imst-draft-host></div>`,
    footer: html`<div class="ap-dialog-footer-right" data-imst-draft-foot></div>`,
    onMount(el, api) {
      const host = el.querySelector("[data-imst-draft-host]");
      const offMenus = installMenus(host);
      const offStudio = mountStudio(host, {
        draft: { brandId: brandId || getActiveBrandId(), network: net, text: excerpt, imageUrl, slides },
        footer: el.querySelector("[data-imst-draft-foot]"),
        onCancel: () => api.close(),
        onUse(dataUrl) {
          onUse(dataUrl);
          dialog.close();
          toast(imageUrl ? "The draft's image was replaced." : "Image added to the draft.");
        },
      });
      cleanup = () => {
        offStudio?.();
        offMenus();
      };
      return cleanup;
    },
  });
  return dialog;
}
