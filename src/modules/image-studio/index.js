// Image Generator — the module's ONLY entry point. The shell imports ROUTES from
// here (src/app.js) and nothing else. Behind the `sexySquirrel` flag.
//
// What the module imports from Archie: the shell (router, flags, topbar) and,
// through state/playbook-brand.js only, the Playbooks — the brand IS the
// Playbook. See docs/audits/image-studio-integration.md.

import { navigate } from "../../router.js?v=1227";
import { isFlagOn } from "../../feature-flags.js?v=1227";
import { renderTopbar } from "../../components/topbar.js?v=1227";
import { boot, setActiveBrand, startPlaybookCreation } from "./state/store.js?v=1227";
import { delegate, disposer } from "./lib/delegate.js?v=1227";
import { installMenus } from "./ui/menu.js?v=1227";
import { closeAllDialogs } from "./ui/dialog.js?v=1227";
import * as hub from "./views/hub.js?v=1227";
import * as campaigns from "./views/campaigns.js?v=1227";

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
  { pattern: "/image-generator", handler: screen(hub.mount) },
  { pattern: "/image-generator/campaigns", handler: screen(campaigns.mount) },
]);
