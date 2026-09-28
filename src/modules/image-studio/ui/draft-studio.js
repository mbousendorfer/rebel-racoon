// Image Generator — the studio, opened from a draft (flag sexySquirrel: it
// replaces the draft's Image Studio). A near-fullscreen dialog around the same
// studio as the Generate tab (views/studio.js, mode "draft"): the chat's
// Playbook is the brand, the draft's network sets the shapes, and "Use in
// draft" hands the finished PNG back to the caller — the draft.

import { html } from "../lib/html.js?v=1335";
import { openDialog } from "./dialog.js?v=1335";
import { installMenus } from "./menu.js?v=1335";
import { toast } from "./toast.js?v=1335";
import { mountStudio } from "../views/studio.js?v=1335";
import { DRAFT_NETWORK } from "../config/formats.js?v=1335";
import { networkById } from "../config/networks.js?v=1335";
import { boot, getActiveBrandId } from "../state/store.js?v=1335";

/**
 * @param {{ brandId?: string, network?: string, text?: string, imageUrl?: string,
 *           slides?: number, onUse: (dataUrl: string) => void }} draft
 */
export function openDraftStudio({ brandId, network, text = "", imageUrl = "", slides = 0, onUse }) {
  boot();
  const net = DRAFT_NETWORK[network] || null;
  const label = net ? networkById(net).label : "";
  const excerpt = String(text).replace(/\s+/g, " ").trim();
  let cleanup = null;
  const dialog = openDialog({
    title: label ? `Image for this ${label} post` : "Image for this post",
    subtitle: excerpt ? `“${excerpt.length > 110 ? excerpt.slice(0, 107).trimEnd() + "…" : excerpt}”` : "",
    size: "studio",
    body: html`<div class="imst imst-draft-host" data-imst-draft-host></div>`,
    onMount(el) {
      const host = el.querySelector("[data-imst-draft-host]");
      const offMenus = installMenus(host);
      const offStudio = mountStudio(host, {
        mode: "draft",
        draft: { brandId: brandId || getActiveBrandId(), network: net, text: excerpt, imageUrl, slides },
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
