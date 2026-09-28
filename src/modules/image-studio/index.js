// Image Generator — the module's ONLY entry point. The shell imports ROUTES from
// here (src/app.js) and nothing else. Behind the `sexySquirrel` flag.
//
// What the module imports from Archie: the shell (router, flags, topbar) and,
// through state/playbook-brand.js only, the Playbooks — the brand IS the
// Playbook. See docs/audits/image-studio-integration.md.

import { navigate } from "../../router.js?v=1350";
import { isFlagOn } from "../../feature-flags.js?v=1350";
import { renderTopbar } from "../../components/topbar.js?v=1350";
import { boot, setActiveBrand, startPlaybookCreation } from "./state/store.js?v=1350";
import { delegate, disposer } from "./lib/delegate.js?v=1350";
import { installMenus } from "./ui/menu.js?v=1350";
import { closeAllDialogs } from "./ui/dialog.js?v=1350";
import * as history from "./views/history.js?v=1350";
import * as styles from "./views/styles.js?v=1350";
import * as styleCreator from "./views/style-creator.js?v=1350";
import * as editor from "./views/editor/index.js?v=1350";

export const FLAG = "sexySquirrel";

/**
 * Wraps a view into a router handler: flag gate, topbar, seed, the delegation
 * every view shares (navigation, menus, the brand picker), and a cleanup that
 * disposes whatever the view added. A view is `mount(target, params, ctx) → cleanup?`.
 */
function screen(mount) {
  return (params, target) => {
    if (!isFlagOn(FLAG)) {
      navigate("/");
      return undefined;
    }
    renderTopbar();
    boot();
    const bag = disposer();
    const ctx = { navigate, dispose: bag };
    bag.add(installMenus(target));
    bag.add(
      delegate(target, "click", "[data-imst-nav]", (event, el) => {
        event.preventDefault();
        navigate(el.dataset.imstNav);
      }),
    );
    bag.add(
      delegate(target, "click", "[data-imst-action='switch-brand']", (_e, el) => setActiveBrand(el.dataset.imstBrand)),
    );
    bag.add(delegate(target, "click", "[data-imst-action='new-playbook']", () => startPlaybookCreation()));
    bag.add(mount(target, params, ctx));
    bag.add(closeAllDialogs);
    return () => bag.run();
  };
}

export const ROUTES = Object.freeze([
  // Images are generated from a draft only (the draft's studio, below): the
  // section opens on what was made. replace(), so Back doesn't bounce here.
  {
    pattern: "/image-generator",
    handler: () => {
      window.location.replace(window.location.href.split("#")[0] + "#/image-generator/history");
      return undefined;
    },
  },
  { pattern: "/image-generator/history", handler: screen(history.mount) },
  { pattern: "/image-generator/styles", handler: screen(styles.mount) },
  // Before /:id — route() takes the first match, and "new" would pass for an id.
  { pattern: "/image-generator/styles/new", handler: screen(styleCreator.mount) },
  { pattern: "/image-generator/styles/:id", handler: screen(styleCreator.mount) },
  { pattern: "/image-generator/editor/:creationId", handler: screen(editor.mount) },
]);

// The one other door into the module: the draft's image studio (right panel),
// behind the same flag. Called by src/components/right-panel.js.
export { openDraftStudio } from "./ui/draft-studio.js?v=1350";
