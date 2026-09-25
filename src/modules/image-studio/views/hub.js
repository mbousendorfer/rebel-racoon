// Image Generator — Generate (hub), the module's front door. Step 1 skeleton:
// proves the route, the seed and the active brand. Campaign ideas, the prompt bar and results land in step 4.

import { html, toString } from "../lib/html.js?v=1225";
import { renderFrame } from "./frame.js?v=1225";
import { renderEmpty } from "../ui/empty.js?v=1225";
import { getActiveBrand, getCreations, subscribe } from "../state/store.js?v=1225";

export function mount(target) {
  const paint = () => {
    const brand = getActiveBrand();
    const count = brand ? getCreations(brand.id).length : 0;
    target.innerHTML = toString(
      renderFrame({
        section: "create",
        body: renderEmpty({
          icon: "ap-icon-sparkles",
          title: "What do you want to create?",
          body: brand
            ? `${count} image${count === 1 ? "" : "s"} created so far. The prompt bar, campaign ideas and the four variations arrive in step 4.`
            : "Set up a brand first, so every image follows it.",
          action: html``,
        }),
      }),
    );
  };
  paint();
  return subscribe(paint);
}
