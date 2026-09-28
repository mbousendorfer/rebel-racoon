// Image Generator — Generate (/image-generator): the studio, as a page.
// The studio itself is views/studio.js, shared with the draft's image modal.

import { mountStudio } from "./studio.js?v=1335";

export function mount(target, _params, ctx) {
  return mountStudio(target, { mode: "page", navigate: ctx.navigate });
}
