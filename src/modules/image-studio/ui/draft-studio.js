// Image Generator — the studio, opened from a draft (flag sexySquirrel: it
// replaces the draft's Image Studio). A near-fullscreen dialog around the same
// studio as the Generate tab (views/studio.js, mode "draft"): the chat's
// Playbook is the brand, the draft's network sets the shapes, and "Use in
// draft" hands the finished PNG back to the caller — the draft.

import { html } from "../lib/html.js?v=2377";
import { openDialog } from "./dialog.js?v=2377";
import { installMenus } from "./menu.js?v=2377";
import { toast } from "./toast.js?v=2377";
import { mountStudio } from "../views/studio.js?v=2377";
import { DRAFT_NETWORK } from "../config/formats.js?v=2377";
import { getActiveBrandId } from "../state/store.js?v=2377";

/**
 * @param {{ brandId?: string, network?: string, text?: string, imageUrl?: string,
 *           carousel?: string[], onUse: (dataUrl: string) => void,
 *           onUseCarousel?: (dataUrls: string[]) => void,
 *           renderFeedPreview?: (imageUrl: string, carousel?: string[]) => string }} draft
 * `carousel`: the draft's slides, every one loaded. A result of several slides
 * comes back through `onUseCarousel` (in order); one image through `onUse`.
 * `renderFeedPreview` is the draft's own card with another image (or slides) —
 * the shell's markup, handed in because the module imports no app component.
 */
export function openDraftStudio({
  brandId,
  network,
  text = "",
  imageUrl = "",
  carousel = null,
  onUse,
  onUseCarousel = null,
  renderFeedPreview = null,
}) {
  const net = DRAFT_NETWORK[network] || null;
  const excerpt = String(text).replace(/\s+/g, " ").trim();
  let cleanup = null;
  const dialog = openDialog({
    // Just the tool's name: the post is right behind the dialog, and quoting it
    // here cost the header two lines.
    title: "Image Studio",
    size: "studio",
    body: html`<div class="imst imst-draft-host" data-imst-draft-host></div>`,
    headerAside: html`<div class="imst-dialog__modes" data-imst-draft-modes></div>`,
    footer: html`<div class="ap-dialog-footer-left" data-imst-draft-foot-left></div>
      <div class="ap-dialog-footer-right" data-imst-draft-foot></div>`,
    onMount(el, api) {
      const host = el.querySelector("[data-imst-draft-host]");
      const offMenus = installMenus(host);
      const offStudio = mountStudio(host, {
        draft: { brandId: brandId || getActiveBrandId(), network: net, text: excerpt, imageUrl, carousel },
        footer: el.querySelector("[data-imst-draft-foot]"),
        footerLeft: el.querySelector("[data-imst-draft-foot-left]"),
        modes: el.querySelector("[data-imst-draft-modes]"),
        onEscape: (fn) => (api.beforeEscape = fn),
        renderFeedPreview,
        onCancel: () => api.close(),
        onUse(dataUrl) {
          onUse(dataUrl);
          dialog.close();
          toast(imageUrl ? "Draft image replaced" : "Image added to draft");
        },
        onUseCarousel: onUseCarousel
          ? (urls) => {
              onUseCarousel(urls);
              dialog.close();
              toast(
                carousel?.length > 1
                  ? `Carousel replaced · ${urls.length} slides`
                  : `Carousel of ${urls.length} slides added to draft`,
              );
            }
          : null,
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
