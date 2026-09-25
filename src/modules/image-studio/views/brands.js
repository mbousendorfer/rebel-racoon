// Image Generator — My brands. Step 1 skeleton; cards, detail and management land in step 2.

import { html, toString } from "../lib/html.js?v=1225";
import { renderFrame } from "./frame.js?v=1225";
import { renderEmpty } from "../ui/empty.js?v=1225";
import { getBrands, subscribe } from "../state/store.js?v=1225";

export function mount(target) {
  const paint = () => {
    const brands = getBrands();
    target.innerHTML = toString(
      renderFrame({
        section: "brands",
        body: renderEmpty({
          icon: "ap-icon-image",
          title: `${brands.length} brand${brands.length === 1 ? "" : "s"}`,
          body: brands.map((b) => b.name).join(" · "),
          action: html``,
        }),
      }),
    );
  };
  paint();
  return subscribe(paint);
}
