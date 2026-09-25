// Image Generator — the editor (/image-generator/editor/:creationId).
// Step 4 opens it on the chosen variation; layers, text, "Apply the brand" and
// natural-language edits land in step 5.

import { html, toString } from "../lib/html.js?v=1261";
import { renderFrame } from "./frame.js?v=1261";
import { renderEmpty } from "../ui/empty.js?v=1261";
import { variationCanvas } from "../ui/variation.js?v=1261";
import { getBrand, getCreation, subscribe } from "../state/store.js?v=1261";

export function mount(target, params) {
  const paint = () => {
    const creation = getCreation(params.creationId);
    const back = {
      path: creation ? `/image-generator?creation=${creation.id}` : "/image-generator",
      label: "Back to results",
    };
    if (!creation || !creation.selectedVariationId) {
      target.innerHTML = toString(
        renderFrame({
          back,
          body: renderEmpty({
            icon: "ap-icon-image",
            title: "This image doesn't exist any more",
            body: "It may have been deleted from the history.",
          }),
        }),
      );
      return;
    }
    const brand = getBrand(creation.brandId);
    const variation = creation.variations.find((v) => v.id === creation.selectedVariationId);
    target.innerHTML = toString(
      renderFrame({
        back,
        body: html`
          <header class="imst-creator__head"><h1 class="ap-h2">${creation.title}</h1></header>
          <div class="imst-editor-stub">
            ${variationCanvas({
              creation,
              variation,
              formatId: creation.master.formatId,
              brand,
              layers: creation.master.layers,
            })}
          </div>
        `,
      }),
    );
  };
  paint();
  return subscribe(paint);
}
