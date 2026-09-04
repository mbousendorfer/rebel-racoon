// The metric catalogue and the measure configurator (handoff screens 2c/2d) —
// Archie's own catalogue, exposed to the user: grouped by family, every metric
// typed (volume / rate / counter), the additive ones marked ADDS UP (the only
// ones that unlock "All networks"), the not-yet-available ones listed greyed
// COMING SOON with the proxy Archie would use — the same rule for him and for
// the user. Picking a metric slides the same surface into the configurator:
// scope first (a network acts as a shortcut — it checks its profiles, partial
// deselection allowed), the baseline computes live once the scope is set, and
// Archie's target suggestion lands right behind it. A rate holds a bar
// instead of running from→to.
//
// Two consumers, one flow: `createCatalogFlow()` returns a render/dispatch
// controller the objective modal EMBEDS (the panel is a view of that dialog,
// the design's own "the panel slides"), and `open()` wraps the same flow in a
// standalone body-level dialog for the Playbook block's edit mode.

import { escapeHtml as esc } from "../utils.js?v=1059";
import {
  NETWORK_LABEL,
  getConnectedProfiles,
  renderProfileTag,
  PROFILE_SEARCH_THRESHOLD,
} from "../social-profiles.js?v=1059";
import { requestOpen, notifyClose } from "../modal-coordinator.js?v=1059";
import {
  catalogEntries,
  metricLabel,
  metricTypeLabel,
  scopedBaselineFor,
  proposeTargetFrom,
  isRateMetric,
  isAdditiveMetric,
} from "../objective-measures.js?v=1059";

const COMPUTE_MS = 900;

let flowSeq = 0;

// ── The shared flow ──────────────────────────────────────────────────────────
// state.view: "catalog" | "config". All interactions are click-driven except
// the search input (the host wires input events to handleInput).
export function createCatalogFlow({ contextId, targetLabel, confirmLabel, onAdd, onBack, requestRender }) {
  flowSeq += 1;
  const state = {
    view: "catalog",
    query: "",
    metricId: null,
    network: null, // null = all networks (additive metrics only)
    profileIds: new Set(),
    // The profile menu is a MULTI-select, so it has to survive the re-render
    // each toggle triggers — a native <details> would snap shut on every pick.
    profilesOpen: false,
    profileQuery: "",
    baselineState: "idle", // idle | computing | ready
    baseline: null,
    target: null,
    windowMode: "inherit", // inherit | custom
    timer: null,
  };

  function profilesFor(network) {
    return getConnectedProfiles().filter((p) => p.platform === network);
  }

  function scope() {
    if (!state.network) return undefined;
    const all = profilesFor(state.network);
    const picked = [...state.profileIds];
    if (!picked.length || picked.length === all.length) return { network: state.network };
    return { network: state.network, profileIds: picked };
  }

  // The baseline computes "live" the moment the scope is posed — never typed
  // before the scope is known. The spinner is the design's own beat.
  function recompute() {
    if (state.timer) window.clearTimeout(state.timer);
    state.baselineState = "computing";
    state.baseline = null;
    state.target = null;
    state.timer = window.setTimeout(() => {
      state.timer = null;
      state.baseline = scopedBaselineFor(state.metricId, contextId, scope());
      state.target = proposeTargetFrom(state.metricId, state.baseline, contextId, scope());
      state.baselineState = "ready";
      requestRender();
    }, COMPUTE_MS);
    requestRender();
  }

  function pickMetric(metricId) {
    state.view = "config";
    state.metricId = metricId;
    // Default scope: first connected network as the shortcut (all its
    // profiles) — "all networks" is a deliberate act, and locked unless the
    // metric truly adds up.
    const first = getConnectedProfiles()[0];
    state.network = first ? first.platform : null;
    state.profileIds = new Set(profilesFor(state.network).map((p) => p.id));
    state.windowMode = "inherit";
    recompute();
  }

  function computingLabel() {
    const all = profilesFor(state.network);
    const first = all.find((p) => state.profileIds.has(p.id)) || all[0];
    return `computing from ${first?.handle || first?.name || "your profiles"}…`;
  }

  function scopeChipLabel(network) {
    const all = profilesFor(network);
    const picked = all.filter((p) => state.profileIds.has(p.id)).length;
    const name = NETWORK_LABEL[network] || network;
    if (state.network === network && picked && picked < all.length) return `${name} · ${picked}/${all.length} profiles`;
    return name;
  }

  // ── Views ──────────────────────────────────────────────────────────────

  function renderCatalog() {
    const q = state.query.trim().toLowerCase();
    // Categories COLLAPSE by default (native <details>): the catalog opens as a
    // short stack of ~8 family headers, not a wall of every metric. The header is
    // the hierarchy anchor (bold, with a count); a metric row reveals under it.
    // A search auto-expands the families that still have a match.
    const cats = catalogEntries()
      .map((family) => {
        const metrics = family.metrics.filter((m) => !q || m.label.toLowerCase().includes(q));
        if (!metrics.length) return "";
        const rows = metrics
          .map((m) => {
            if (!m.available) {
              return `
                <div class="objc__soon">
                  <span class="objc__row-name">${esc(m.label)}</span>
                  <span class="ap-tag tagOrange">Needs Google Analytics</span>
                  <span class="objc__spacer"></span>
                  <button type="button" class="ap-link standalone small" data-objc-proxy-pick="${m.proxyId}">Use the proxy</button>
                </div>`;
            }
            // name (grows) · Adds up · TYPE last so every type right-aligns into
            // one column down the card, and Adds up sits just before it.
            return `
              <button type="button" class="ap-list-panel-item objc__row" data-objc-pick="${m.id}">
                <span class="objc__row-name">${esc(m.label)}</span>
                ${m.additive ? `<span class="ap-tag green">Adds up</span>` : ""}
                <span class="ap-tag grey objc__row-type">${metricTypeLabel(m.id)}</span>
              </button>`;
          })
          .join("");
        // name (grows) · count · chevron, so the counts right-align into one
        // column down the stack of category cards.
        return `
          <details class="objc__cat"${q ? " open" : ""}>
            <summary class="objc__cathead">
              <span class="objc__catname">${esc(family.familyLabel)}</span>
              <span class="objc__spacer"></span>
              <span class="ap-counter grey objc__catcount">${metrics.length}</span>
              <i class="ap-icon-chevron-down objc__catarrow" aria-hidden="true"></i>
            </summary>
            <div class="objc__catbody">${rows}</div>
          </details>`;
      })
      .join("");
    return `
      <div class="objc__search">
        <div class="ap-input-group">
          <i class="ap-icon-search" aria-hidden="true"></i>
          <input type="text" data-objc-search value="${esc(state.query)}" placeholder="Search the metric catalog…" aria-label="Search the metric catalog" />
        </div>
      </div>
      <div class="objc__body">${cats || `<p class="objc__empty">Nothing in the catalog matches "${esc(state.query)}".</p>`}</div>`;
  }

  // A suggested target reads as a decision once you can see the jump it asks
  // for — a bare orange chip only says "Archie picked this".
  function pctDelta(baseline, target) {
    const num = (v) => {
      const cleaned = String(v ?? "")
        .replace(/[€$,+\s]/g, "")
        .replace(/%$/, "");
      return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
    };
    const b = num(baseline);
    const t = num(target);
    if (b == null || t == null || b === 0) return null;
    return Math.round(((t - b) / b) * 100);
  }

  // Two groups, a rule between them: WHERE the measure reads (networks, then
  // the profiles under the chosen one) and WHAT it reads to (the target, the
  // window). The metric name + type moved to the dialog subtitle — a
  // breadcrumb row repeating "from the metric catalog" next to a "Catalog"
  // back link was saying the same thing three times.
  function renderConfig() {
    const m = state.metricId;
    const rate = isRateMetric(m);
    const additive = isAdditiveMetric(m);
    const networks = [];
    getConnectedProfiles().forEach((p) => {
      if (!networks.includes(p.platform)) networks.push(p.platform);
    });
    const netName = state.network ? NETWORK_LABEL[state.network] || state.network : "";

    // Scope is ONE choice among ~5, so it is a select, not a chip row: chips
    // spend a whole line on options you set once, and a row of them reads as a
    // multi-select filter when only one can win. Same DS select the objective
    // sentence uses for its window, so the two look like one family.
    //
    // Not-additive is not a PREMIUM lock — feature-lock (purple, a padlock)
    // reads as "upgrade to unlock", a promise this can never keep. "All
    // networks" is simply a disabled option; the caption below says why.
    const networkOptions = networks.map((n) => ({ value: n, label: scopeChipLabel(n) }));
    networkOptions.push({ value: "all", label: "All networks", disabled: !additive });
    const currentNetwork = state.network || "all";
    const currentOption = networkOptions.find((o) => o.value === currentNetwork && !o.disabled);
    const networkSelect = `
      <details class="ap-select objc__select" data-objc-select>
        <summary class="ap-select-trigger">
          <span class="ap-select-value${currentOption ? "" : " ap-select-placeholder"}">${esc(currentOption ? currentOption.label : "Pick a network")}</span>
          <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
        </summary>
        <div class="ap-select-dropdown" role="listbox">
          <div class="ap-select-options">
            ${networkOptions
              .map((o) => {
                if (o.disabled) {
                  return `<div class="ap-select-option disabled" aria-disabled="true"><span class="ap-select-option-text">${esc(o.label)}</span></div>`;
                }
                const on = o.value === currentNetwork;
                return `
                  <div class="ap-select-option${on ? " selected" : ""}" data-objc-network="${esc(o.value)}" role="option" aria-selected="${on}">
                    <span class="ap-select-option-text">${esc(o.label)}</span>
                    ${on ? `<i class="ap-icon-check" aria-hidden="true"></i>` : ""}
                  </div>`;
              })
              .join("")}
          </div>
        </div>
      </details>`;
    const scopeCaption = additive
      ? ""
      : `<p class="objc__caption">${esc(metricLabel(m))} can’t be summed across networks — measure one at a time.</p>`;

    const profiles = state.network ? profilesFor(state.network) : [];
    const pickedCount = profiles.filter((p) => state.profileIds.has(p.id)).length;
    let profileBody;
    if (!state.network) {
      profileBody = `<p class="objc__static">Every connected profile.</p>`;
    } else if (profiles.length <= 1) {
      // One profile is not a choice — a lone chip you can't uncheck is a
      // control that does nothing. Show WHO it is instead, through the same
      // renderProfileTag (DS avatar + corner network badge + name) every other
      // profile surface uses, so a profile looks like a profile everywhere.
      profileBody = `
        <div class="objc__profile">${profiles[0] ? renderProfileTag(profiles[0]) : "—"}</div>
        <p class="objc__caption">The only ${esc(netName)} profile connected.</p>`;
    } else {
      // A chip per profile does not survive contact with a real account — a brand
      // can have 200 connected profiles, and 200 chips is not a control. So: the
      // DS MULTI-select, built the way the DS builds one —
      //   · each option carries a CHECKBOX (.ap-select-option-checkbox holding the
      //     .ap-checkbox-container visual), never .selected + .ap-select-option-check:
      //     those two are the SINGLE-select markers, and a menu of seven rows with
      //     one blue tick reads as "pick one";
      //   · the trigger carries .ap-select-labels — .ap-label chips for what is
      //     picked, with .ap-select-label-count for the overflow;
      //   · an .ap-select-all row, because selecting 200 by hand is not an option.
      // Search appears past the same PROFILE_SEARCH_THRESHOLD every other profile
      // picker in the app uses, and each row shows the profile through
      // renderProfileTag so a profile looks like a profile everywhere.
      const allPicked = pickedCount === profiles.length;
      const q = state.profileQuery.trim().toLowerCase();
      const shown = q
        ? profiles.filter((p) => `${p.handle || ""} ${p.name || ""}`.toLowerCase().includes(q))
        : profiles;
      const searchable = profiles.length > PROFILE_SEARCH_THRESHOLD;
      // The input is inert (tabindex -1, aria-hidden): the row's click handler owns
      // the toggle and re-renders from state, so the box never disagrees with it.
      const checkbox = (on) =>
        `<span class="ap-checkbox-container ap-select-option-checkbox" aria-hidden="true"><input type="checkbox" tabindex="-1"${on ? " checked" : ""} /><i></i></span>`;
      const picked = profiles.filter((p) => state.profileIds.has(p.id));
      const CHIP_MAX = 2;
      const chips = picked
        .slice(0, CHIP_MAX)
        .map((p) => `<span class="ap-label"><span>${esc(p.handle || p.name)}</span></span>`)
        .join("");
      const overflow = picked.length - Math.min(picked.length, CHIP_MAX);
      const rows = shown
        .map((p) => {
          const on = state.profileIds.has(p.id);
          return `
            <div class="ap-select-option objc__profileopt" role="option" aria-selected="${on}" data-objc-profile="${esc(p.id)}">
              ${checkbox(on)}${renderProfileTag(p)}
            </div>`;
        })
        .join("");
      profileBody = `
        <details class="ap-select objc__select objc__profiles" data-objc-select${state.profilesOpen ? " open" : ""}>
          <summary class="ap-select-trigger" data-objc-profiles-toggle>
            <span class="ap-select-labels">${chips}${overflow ? `<span class="ap-select-label-count">+${overflow}</span>` : ""}</span>
            <i class="ap-icon-chevron-down ap-select-arrow" aria-hidden="true"></i>
          </summary>
          <div class="ap-select-dropdown" role="listbox" aria-multiselectable="true">
            ${
              searchable
                ? `<div class="ap-select-search">
                     <i class="ap-icon-search ap-select-search-icon" aria-hidden="true"></i>
                     <input class="ap-select-search-input" type="text" data-objc-profile-search value="${esc(state.profileQuery)}" placeholder="Search profiles…" aria-label="Search profiles" />
                   </div>`
                : ""
            }
            ${
              q
                ? ""
                : `<div class="ap-select-all objc__profileall" role="option" aria-selected="${allPicked}" data-objc-profile-all>
                     ${checkbox(allPicked)}<span>All ${profiles.length} ${esc(netName)} profiles</span>
                   </div>
                   <div class="ap-select-divider"></div>`
            }
            <div class="ap-select-options">
              ${rows || `<p class="ap-select-not-found">No profile matches “${esc(state.profileQuery)}”.</p>`}
            </div>
          </div>
        </details>
        <p class="objc__caption">${allPicked ? `Every ${esc(netName)} profile — deselect one to narrow the measure.` : `${pickedCount} of ${profiles.length} — the measure sums only these.`}</p>`;
    }

    // The same "from X to Y" sentence the measure card shows back on the
    // objective form, so what you configure looks like what lands. Two naked
    // values on two rows read as fields that failed to render.
    const delta = pctDelta(state.baseline, state.target);
    const suggested = `<span class="ap-tag tagOrange">Suggested${delta != null && delta > 0 ? ` · +${delta}%` : ""}</span>`;
    let reading;
    if (state.baselineState !== "ready") {
      reading = `
        <p class="objc__computing">
          <span class="ap-loader blue size-16" aria-hidden="true"><svg><circle></circle><circle></circle></svg></span>
          <span>${esc(computingLabel())}</span>
        </p>`;
    } else if (rate) {
      reading = `<p class="objc__reading">hold above <strong>${esc(state.target || "—")}</strong> ${suggested} <span class="objc__reading-sub">today ${esc(state.baseline || "—")}</span></p>`;
    } else {
      reading = `<p class="objc__reading">from <strong>${esc(state.baseline || "—")}</strong> today to <strong>${esc(state.target || "—")}</strong> ${suggested}</p>`;
    }
    // The type explainer was a boxed info note; it explains the target, so it
    // belongs under the target as helper text, not as a fourth bordered block.
    const readingCaption = rate
      ? `Today’s figure is your last 30 days. A rate has no “from” — the target is a bar to stay above.`
      : `Today’s figure is your last 30 days. A volume measure reads as progress toward its target.`;

    return `
      <div class="objc__cfg">
        <div class="objc__field">
          <span class="objc__fieldlabel">Measure on</span>
          <div class="objc__fieldbody">
            ${networkSelect}
            ${scopeCaption}
          </div>
        </div>
        <div class="objc__field">
          <span class="objc__fieldlabel">Profiles</span>
          <div class="objc__fieldbody">${profileBody}</div>
        </div>
        <hr class="objc__rule" />
        <div class="objc__field">
          <span class="objc__fieldlabel">Target</span>
          <div class="objc__fieldbody">
            ${reading}
            <p class="objc__caption">${readingCaption}</p>
          </div>
        </div>
        <div class="objc__field">
          <span class="objc__fieldlabel">Window</span>
          <div class="objc__fieldbody">
            <div class="objc__chips">
              <button type="button" class="ap-filter-chip" aria-pressed="${state.windowMode === "inherit"}" data-objc-window="inherit"><span>Same as objective</span></button>
              <button type="button" class="ap-filter-chip" aria-pressed="${state.windowMode === "custom"}" data-objc-window="custom"><span>Rolling 30 days</span></button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // The dialog's own footer holds the actions in BOTH views — the config view
  // used to grow its own footer inside the scroll area, which left the real
  // .ap-dialog-footer rendering as an empty bordered band under it. The catalog
  // view had no way out at all but the X (which threw away the whole objective).
  function renderFooter() {
    if (state.view === "catalog") {
      return {
        left: "",
        right: `<button type="button" class="ap-button ghost grey" data-objc-cancel><span>Cancel</span></button>`,
      };
    }
    return {
      left: `<button type="button" class="ap-link standalone" data-objc-back><i class="ap-icon-chevron-left" aria-hidden="true"></i>Catalog</button>`,
      right: `
        <button type="button" class="ap-button ghost grey" data-objc-cancel><span>Cancel</span></button>
        <button type="button" class="ap-button primary orange" data-objc-add${state.baselineState !== "ready" ? " disabled" : ""}>
          <span>${esc(confirmLabel || `Add to ${targetLabel || "the objective"}`)}</span>
        </button>`,
    };
  }

  // The metric + its type ride in the dialog subtitle, not in a breadcrumb row.
  function subtitle() {
    return state.view === "config" ? `${metricLabel(state.metricId)} · ${metricTypeLabel(state.metricId)}` : "";
  }

  return {
    state,
    render() {
      return state.view === "catalog" ? renderCatalog() : renderConfig();
    },
    renderFooter,
    subtitle,
    // Returns true when the event was consumed by the flow.
    handleClick(event) {
      // A click anywhere but inside an open select closes it. Closing the DOM
      // node is enough for the scope select (picking re-renders it shut), but
      // the profile menu's open state is tracked, so clear that too or the next
      // render would pop it back open.
      const inSelect = event.target.closest("[data-objc-select]");
      if (!inSelect) state.profilesOpen = false;
      document.querySelectorAll("[data-objc-select][open]").forEach((d) => {
        if (d !== inSelect) d.removeAttribute("open");
      });
      // The multi-select's own toggle: drive it from state, not the native
      // <details>, so a re-render can put it back the way the user left it.
      const profilesToggle = event.target.closest("[data-objc-profiles-toggle]");
      if (profilesToggle) {
        event.preventDefault();
        state.profilesOpen = !state.profilesOpen;
        if (!state.profilesOpen) state.profileQuery = "";
        requestRender();
        return true;
      }
      const pick = event.target.closest("[data-objc-pick]");
      if (pick) {
        pickMetric(pick.dataset.objcPick);
        return true;
      }
      const proxyPick = event.target.closest("[data-objc-proxy-pick]");
      if (proxyPick) {
        pickMetric(proxyPick.dataset.objcProxyPick);
        return true;
      }
      if (event.target.closest("[data-objc-back]")) {
        if (state.timer) window.clearTimeout(state.timer);
        state.view = "catalog";
        requestRender();
        return true;
      }
      const net = event.target.closest("[data-objc-network]");
      if (net) {
        const n = net.dataset.objcNetwork;
        state.network = n === "all" ? null : n;
        state.profileIds = new Set(state.network ? profilesFor(state.network).map((p) => p.id) : []);
        recompute();
        return true;
      }
      // "All N profiles" selects every profile on the network. It is not a
      // two-way toggle: the scope can never be empty (see below), so unchecking
      // it would only bounce straight back to all.
      if (event.target.closest("[data-objc-profile-all]")) {
        state.profileIds = new Set(profilesFor(state.network).map((p) => p.id));
        recompute();
        return true;
      }
      const prof = event.target.closest("[data-objc-profile]");
      if (prof) {
        const id = prof.dataset.objcProfile;
        if (state.profileIds.has(id)) state.profileIds.delete(id);
        else state.profileIds.add(id);
        if (!state.profileIds.size) state.profileIds = new Set(profilesFor(state.network).map((p) => p.id));
        recompute();
        return true;
      }
      const win = event.target.closest("[data-objc-window]");
      if (win) {
        state.windowMode = win.dataset.objcWindow;
        requestRender();
        return true;
      }
      if (event.target.closest("[data-objc-add]")) {
        if (state.baselineState !== "ready") return true;
        onAdd({
          id: `m-${flowSeq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          metricId: state.metricId,
          scope: scope(),
          target: state.target || undefined,
          window: state.windowMode === "custom" ? { type: "rolling" } : undefined,
        });
        return true;
      }
      if (event.target.closest("[data-objc-cancel]")) {
        onBack?.();
        return true;
      }
      return false;
    },
    handleInput(event) {
      const profileSearch = event.target.closest("[data-objc-profile-search]");
      if (profileSearch) {
        state.profileQuery = profileSearch.value;
        requestRender({ preserveProfileSearch: true });
        return true;
      }
      const search = event.target.closest("[data-objc-search]");
      if (!search) return false;
      state.query = search.value;
      requestRender({ preserveSearch: true });
      return true;
    },
    dispose() {
      if (state.timer) window.clearTimeout(state.timer);
    },
  };
}

// ── Standalone wrapper (Playbook block edit mode) ────────────────────────────

const MODAL_ID = "objectiveCatalog";

let backdrop = null;
let panel = null;
let bodyEl = null;
let titleEl = null;
let subEl = null;
let footLeftEl = null;
let footRightEl = null;
let initialized = false;
let flow = null;
let onDone = null;

const SHELL = `
<div class="app-modal-backdrop objc__backdrop" id="objcBackdrop" hidden>
  <aside class="ap-dialog objc" id="objcModal" role="dialog" aria-modal="true" aria-label="Metric catalog" tabindex="-1">
    <div class="ap-dialog-header">
      <span class="ap-dialog-title" id="objcTitle">Add a measure</span>
      <span class="ap-dialog-subtitle" id="objcSub" hidden></span>
    </div>
    <button type="button" class="ap-dialog-close" data-objc-close aria-label="Close"><i class="ap-icon-close"></i></button>
    <div class="ap-dialog-content objc__content"></div>
    <div class="ap-dialog-footer">
      <div class="ap-dialog-footer-left" id="objcFootLeft"></div>
      <div class="ap-dialog-footer-right" id="objcFootRight"></div>
    </div>
  </aside>
</div>`;

export function init() {
  if (initialized) return;
  const host = document.createElement("div");
  host.innerHTML = SHELL;
  while (host.firstChild) document.body.appendChild(host.firstChild);
  backdrop = document.getElementById("objcBackdrop");
  panel = document.getElementById("objcModal");
  bodyEl = panel.querySelector(".objc__content");
  titleEl = document.getElementById("objcTitle");
  subEl = document.getElementById("objcSub");
  footLeftEl = document.getElementById("objcFootLeft");
  footRightEl = document.getElementById("objcFootRight");

  panel.addEventListener("click", (e) => {
    if (e.target.closest("[data-objc-close]")) {
      close();
      return;
    }
    flow?.handleClick(e);
  });
  panel.addEventListener("input", (e) => flow?.handleInput(e));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop && !backdrop.hidden) close();
  });
  window.addEventListener("hashchange", close);
  initialized = true;
}

// Typing re-renders, so the field being typed in has to be re-focused at the
// same caret. Two searchable fields now: the catalog's and the profile menu's.
export function searchSelectorFor(opts = {}) {
  if (opts.preserveProfileSearch) return "[data-objc-profile-search]";
  if (opts.preserveSearch) return "[data-objc-search]";
  return null;
}

function paint(opts = {}) {
  if (!flow) return;
  paintChrome();
  const sel = searchSelectorFor(opts);
  if (sel) {
    const el = bodyEl.querySelector(sel);
    const pos = el ? el.selectionStart : null;
    bodyEl.innerHTML = flow.render();
    const next = bodyEl.querySelector(sel);
    if (next && pos != null) {
      next.focus();
      next.setSelectionRange(pos, pos);
    }
    return;
  }
  bodyEl.innerHTML = flow.render();
}

// Title stays the task; the subtitle names the metric once one is picked.
function paintChrome() {
  const sub = flow.subtitle();
  subEl.textContent = sub;
  subEl.hidden = !sub;
  const foot = flow.renderFooter();
  footLeftEl.innerHTML = foot.left;
  footRightEl.innerHTML = foot.right;
}

export function open({ contextId, targetLabel, onAdd }) {
  init();
  requestOpen(MODAL_ID, close);
  onDone = onAdd;
  flow = createCatalogFlow({
    contextId,
    targetLabel,
    onAdd: (entry) => {
      const cb = onDone;
      close();
      cb?.(entry);
    },
    onBack: close,
    requestRender: paint,
  });
  titleEl.textContent = "Add a measure";
  paint();
  backdrop.hidden = false;
  panel.focus?.();
}

export function close() {
  if (!backdrop || backdrop.hidden) return;
  flow?.dispose();
  flow = null;
  onDone = null;
  backdrop.hidden = true;
  bodyEl.innerHTML = "";
  footLeftEl.innerHTML = "";
  footRightEl.innerHTML = "";
  subEl.hidden = true;
  notifyClose(MODAL_ID);
}
