// Image Generator — Campaigns and history. Step 1 skeleton.

import { html, toString } from "../lib/html.js?v=1225";
import { renderFrame } from "./frame.js?v=1225";
import { renderEmpty } from "../ui/empty.js?v=1225";
import { getCampaigns, subscribe } from "../state/store.js?v=1225";

export function mount(target) {
  const paint = () => {
    const campaigns = getCampaigns();
    target.innerHTML = toString(
      renderFrame({
        section: "campaigns",
        body: renderEmpty({
          icon: "ap-icon-calendar",
          title: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`,
          body: campaigns.map((c) => c.title).join(" · "),
          action: html``,
        }),
      }),
    );
  };
  paint();
  return subscribe(paint);
}
