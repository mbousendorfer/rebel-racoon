// Image Generator — the module's ONLY entry point. The shell imports ROUTES from
// here (src/app.js) and nothing else; the module imports only the shell's
// router, feature flags and topbar. Everything behind the `sexySquirrel` flag.
//
// See docs/audits/image-studio-integration.md for the integration contract.

import { navigate } from "../../router.js?v=1225";
import { isFlagOn } from "../../feature-flags.js?v=1225";
import { renderTopbar } from "../../components/topbar.js?v=1225";
import { boot } from "./state/store.js?v=1225";
import { delegate, disposer } from "./lib/delegate.js?v=1225";
import * as hub from "./views/hub.js?v=1225";
import * as brands from "./views/brands.js?v=1225";
import * as campaigns from "./views/campaigns.js?v=1225";

export const FLAG = "sexySquirrel";

/**
 * Wraps a view into a router handler: flag gate, topbar, seed, shared
 * navigation delegation, and a cleanup that disposes whatever the view added.
 * A view is `mount(target, params, ctx) → cleanup?`.
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
    bag.add(
      delegate(target, "click", "[data-imst-nav]", (event, el) => {
        event.preventDefault();
        navigate(el.dataset.imstNav);
      }),
    );
    bag.add(mount(target, params, ctx));
    return () => bag.run();
  };
}

export const ROUTES = Object.freeze([
  { pattern: "/image-generator", handler: screen(hub.mount) },
  { pattern: "/image-generator/brands", handler: screen(brands.mount) },
  { pattern: "/image-generator/campaigns", handler: screen(campaigns.mount) },
]);
