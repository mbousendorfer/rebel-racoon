// The Playbook's two rosters — Competitors and Influencers — cut out of
// playbook-view.js: their rendering, their dialogs, the Discover scan and
// their click hooks. The view's live state (cfg, editScope, mountTarget) is
// never imported: playbook-view passes a `ctx` at every call —
//   { cfg, editScope, mountTarget (live getters), repaint(), canEdit(),
//     inEdit(scope), tabHead(scope, extra, opts), sectionHint(scope),
//     sectionId(scope) }.
// What only the rosters use (the open detail modal, the scan, the add
// dialog's draft) lives here.

import { escapeHtml as esc, hostname } from "./utils.js?v=2762";
import { discoverCompetitors, competitorKey } from "./context-mock-analysis.js?v=2762";
import { NETWORK_ICON_BY_PLATFORM, NETWORK_LABEL } from "./social-profiles.js?v=2762";

let rosterModal = null; // open competitor/influencer detail modal: { kind, index } or null
let rosterScanning = null; // roster whose "Discover" scan is in flight ("competitors") or null — Influencers has no Discover
let rosterScanTimer = null; // the scan's pending timeout
let rosterFoundNone = null; // roster whose last scan returned nothing new (show the note) or null
let infAdd = null; // the "Add an influencer" dialog's draft ({ name, websiteUrl, socials }), or null

// mount(): a fresh page starts with nothing open, scanned or drafted.
export function resetRosterState() {
  rosterModal = null;
  rosterScanning = null;
  rosterFoundNone = null;
  infAdd = null;
}

// Leaving an edit (resetEdit) or the page: the detail modal and the add
// dialog close.
export function closeRosterDialogs() {
  rosterModal = null;
  infAdd = null;
}

// Shared with the reference images (playbook-view imports them back): the
// networks an image or a competitor can target, and the hash + HSL maths of
// the deterministic tints.
export const REF_NETWORKS = ["facebook", "instagram", "linkedin", "x", "tiktok", "youtube"];

export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const to = (n) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(0)}${to(8)}${to(4)}`;
}

// ── Competitors + Influencers (the two rosters) ────────────────────────
//
// Two lists of people and brands OUTSIDE this one, with the same life cycle:
// Archie pre-fills each from the website analysis (every entry flagged
// `suggested`) and can scan for more on demand; the user prunes it and adds
// the ones Archie missed. Competitors are who the brand is measured against,
// influencers the creators its audience already listens to.
//
// Competitors render through the card grid below; Influencers through the
// beta's list shape (renderInfluencersPanel, after this block). They share the
// data helpers and the name / website / remove / social hooks, which keep
// their `cmp` prefix; which roster a hook acts on is read from the nearest
// [data-recap-roster].
//
// An entry's logo is never stored — it's resolved from its domain through a
// favicon service at render time, with a monogram tile as the fallback (wired
// by the capturing `error` listener in playbook-view.js mount()).

const ROSTER_SCAN_MS = 1600;

export const ROSTERS = {
  competitors: {
    scope: "competitors",
    listKey: "competitors",
    dismissedKey: "dismissedCompetitors",
    max: 12,
    idPrefix: "cmp",
    networks: REF_NETWORKS,
    discover: discoverCompetitors,
    key: competitorKey,
    noun: "competitor",
    title: "Competitor",
    untitled: "Untitled competitor",
    namePlaceholder: "Competitor name",
    sitePlaceholder: "https://competitor.com",
    descPlaceholder: "How they position, who they win with, where you differ…",
    ownGroup: "Your competitors",
    pendingEmpty: "None added yet. Pick from my suggestions below.",
    emptyEdit: "No competitors yet. Add the ones you know and I'll find the rest.",
    emptyRead: "No competitors yet. Select Discover competitors and I'll suggest a few.",
    scanning: "Scanning your market for competitors…",
    noneFound: "No new competitors found. Add one by hand instead.",
    discoverFirst: "Discover competitors",
  },
  // Influencers keep only what the beta's list shape reads (renderInfluencersPanel):
  // no suggestions, so no discover / key / tray copy.
  influencers: {
    scope: "influencers",
    listKey: "influencers",
    max: 12,
    idPrefix: "inf",
    // No TikTok: an influencer profile is only worth adding on a network the
    // listening follows creators on.
    networks: REF_NETWORKS.filter((n) => n !== "tiktok"),
    noun: "influencer",
    untitled: "Untitled influencer",
    namePlaceholder: "Influencer name",
    sitePlaceholder: "https://…",
  },
};

// The roster a delegated hook belongs to. Every panel and modal root carries
// data-recap-roster, so a hook with no roster around it is a bug — falling
// back to competitors keeps it from writing into a list nobody asked for.
export function rosterOf(el) {
  return ROSTERS[el?.closest?.("[data-recap-roster]")?.dataset.recapRoster] || ROSTERS.competitors;
}

function rosterDomain(c) {
  const raw = (c?.websiteUrl || "").trim();
  return raw ? hostname(raw) : "";
}

function rosterLogoUrl(c) {
  if (c?.logo) return c.logo;
  const domain = rosterDomain(c);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
}

// Deterministic monogram tint so an entry keeps the same colour across
// repaints. Reuses the reference-image hash + HSL helpers rather than adding
// a second bit of colour maths to this file.
function rosterAccent(c) {
  const key = (c?.name || rosterDomain(c) || "roster").toLowerCase();
  const h = hashStr(key);
  return hslToHex(h % 360, 44 + ((h >> 5) % 26), 42);
}

// Monogram letter. A leading article is skipped so names like "The category
// incumbent" / "The low-cost challenger" don't all read as the same "T".
function rosterInitial(c) {
  const source = (c?.name || rosterDomain(c) || "").trim().replace(/^(the|a|an)\s+/i, "");
  return (source.charAt(0) || "?").toUpperCase();
}

export function rosterList(data, r) {
  if (!Array.isArray(data[r.listKey])) data[r.listKey] = [];
  return data[r.listKey];
}

function dismissedList(data, r) {
  if (!Array.isArray(data[r.dismissedKey])) data[r.dismissedKey] = [];
  return data[r.dismissedKey];
}

// `suggested: true` is a PENDING proposal from Archie — it is NOT part of the
// Playbook until the user accepts it. Anything that counts a Playbook's
// entries (the section's own grid, the /contexts card counters) must skip
// them; only the "Suggested by Archie" tray reads them.
function pendingEntries(data, r) {
  return rosterList(data, r).filter((c) => c.suggested);
}

// Logo tile — the remote favicon plus a monogram twin that onLoadError reveals
// when the favicon can't load (domain with no icon, blocked request, offline).
// An entry with no website has nothing to resolve, so it renders monogram-only.
function renderRosterLogo(c, size = 36) {
  const px = Number(size) || 36;
  const url = rosterLogoUrl(c);
  const mono = `<span class="recap__cmp-logo recap__cmp-logo--mono${url ? " is-hidden" : ""}" style="--cmp-accent:${esc(
    rosterAccent(c),
  )};--cmp-logo-size:${px}px;" aria-hidden="true">${esc(rosterInitial(c))}</span>`;
  if (!url) return mono;
  return `<img class="recap__cmp-logo" src="${esc(
    url,
  )}" alt="" width="${px}" height="${px}" loading="lazy" style="--cmp-logo-size:${px}px;" data-recap-cmp-logo />${mono}`;
}

// Read-only network badges for an entry's social profiles. Rendered as plain
// icons on the card (which is itself a button — no nested links) and as real
// links in the modal.
function rosterSocials(c) {
  return (Array.isArray(c?.socials) ? c.socials : []).filter((s) => s && NETWORK_ICON_BY_PLATFORM[s.network]);
}

function renderRosterNetIcons(c) {
  const socials = rosterSocials(c);
  if (!socials.length) return "";
  return `<span class="recap__cmp-nets">${socials
    .map((s) => {
      const label = esc(NETWORK_LABEL[s.network] || s.network);
      return `<i class="${NETWORK_ICON_BY_PLATFORM[s.network]}" title="${label}" aria-label="${label}"></i>`;
    })
    .join("")}</span>`;
}

function renderRosterNetLinks(c) {
  const socials = rosterSocials(c);
  if (!socials.length) return `<span class="recap__cmpmodal-empty">No social profiles yet.</span>`;
  return `<span class="recap__cmp-netlinks">${socials
    .map((s) => {
      const label = esc(NETWORK_LABEL[s.network] || s.network);
      return `<a class="recap__cmp-netlink" href="${esc(
        s.url,
      )}" target="_blank" rel="noopener noreferrer" title="${label}"><i class="${
        NETWORK_ICON_BY_PLATFORM[s.network]
      }" aria-hidden="true"></i><span>${label}</span></a>`;
    })
    .join("")}</span>`;
}

// One card. `i` is the index into the FULL list (both states share it) so the
// handlers stay index-addressed.
//
// A pending card reads as a proposal, not as a Playbook entry: dashed border,
// recessed surface, and its own Add / Dismiss row. Those two buttons must be
// SIBLINGS of the open-button (the card body is itself a <button>, so nesting
// them would be invalid HTML), hence the flex-column card container.
function renderRosterCard(r, c, i, { edit = false, pending = false } = {}, ctx) {
  const domain = rosterDomain(c);
  const desc = (c.description || "").trim();
  const name = esc(c.name || r.noun);
  const nets = renderRosterNetIcons(c);
  return `
    <div class="recap__cmpcard${pending ? " recap__cmpcard--suggested" : ""}">
      <button type="button" class="recap__cmpcard-open" data-recap-cmp-open="${i}" aria-label="${
        edit && !pending ? "Edit" : "View"
      } ${name} details">
        <span class="recap__cmpcard-head">
          ${renderRosterLogo(c, 36)}
          <span class="recap__cmpcard-id">
            <span class="recap__cmpcard-name">${esc(c.name || r.untitled)}</span>
            ${domain ? `<span class="recap__cmpcard-domain">${esc(domain)}</span>` : ""}
          </span>
        </span>
        <span class="recap__cmpcard-desc${desc ? "" : " recap__cmpcard-desc--empty"}">${
          desc ? esc(desc) : "No description yet"
        }</span>
        ${nets ? `<span class="recap__cmpcard-foot">${nets}</span>` : ""}
      </button>
      ${
        pending && ctx.canEdit()
          ? `<div class="recap__cmpcard-actions">
               <button type="button" class="ap-button secondary blue recap__cmpcard-act" data-recap-cmp-accept="${i}">
                 <i class="ap-icon-plus" aria-hidden="true"></i><span>Add</span>
               </button>
               <button type="button" class="ap-button ghost grey recap__cmpcard-act" data-recap-cmp-dismiss="${i}">
                 <span>Dismiss</span>
               </button>
             </div>`
          : edit
            ? `<button type="button" class="recap__refimg-remove recap__cmpcard-remove" data-recap-cmp-remove="${i}" aria-label="Remove ${name}"><i class="ap-icon-close"></i></button>`
            : ""
      }
    </div>`;
}

// Scan-in-flight state, scoped to this panel — the whole-Playbook staged loader
// would be far too heavy for a single-section action.
function renderRosterScan(r) {
  const skeletons = [0, 1, 2]
    .map(
      () => `
      <div class="recap__cmpcard recap__cmpcard--skeleton" aria-hidden="true">
        <span class="recap__cmpskel recap__cmpskel--logo"></span>
        <span class="recap__cmpskel recap__cmpskel--line"></span>
        <span class="recap__cmpskel recap__cmpskel--line is-short"></span>
      </div>`,
    )
    .join("");
  return `
    <p class="recap__cmp-scanning" role="status">
      <span class="archie-loader" aria-hidden="true"></span>
      <span>${esc(r.scanning)}</span>
    </p>
    <div class="recap__cmpgrid">${skeletons}</div>`;
}

// `rosterPicker` (the onboarding review): the roster as ONE list to pick from,
// the way every other choice in the review is made — each entry a tile (logo,
// name, its description in full), ticked = in the Playbook, in a stable order.
// Unticking sends an entry
// back to the suggestions (nothing is lost); "Add someone else" is the manual
// add. Same hooks as the tray (accept / accept-all / add), plus unaccept.
const PICKER_COPY = {
  competitors: {
    title: "Who you're up against",
    hint: "I found these in your market. Tick the ones you're measured against.",
    empty: "I didn't find anyone yet. Add the competitors you know.",
    add: "Add another competitor",
  },
  influencers: {
    title: "Who your audience follows",
    hint: "The creators your audience listens to. I watch what they post for you.",
    empty: "No one yet. Add the creators your audience already follows.",
    add: "Add an influencer",
  },
};

function renderRosterPicker(data, r, { addHook = "data-recap-cmp-add" } = {}) {
  const copy = PICKER_COPY[r.scope] || PICKER_COPY.competitors;
  const list = rosterList(data, r);
  const indexed = list.map((c, i) => ({ c, i }));
  // A stable order: a tile ticked stays where it is (moving it under the cursor
  // would lose the reader).
  const ordered = indexed;
  const pending = indexed.filter(({ c }) => c.suggested).length;
  const tile = ({ c, i }) => {
    const on = !c.suggested;
    const desc = (c.description || "").trim();
    const domain = rosterDomain(c);
    // A label around the real DS checkbox: one click toggles, keyboard-reachable.
    return `
      <label class="recap__pick${on ? " is-picked" : ""}" data-recap-cmp-${on ? "unaccept" : "accept"}="${i}">
        ${renderRosterLogo(c, 40)}
        <span class="recap__pick-text">
          <span class="recap__pick-name">${esc(c.name || r.untitled)}${
            domain ? `<span class="recap__pick-domain">${esc(domain)}</span>` : ""
          }</span>
          ${desc ? `<span class="recap__pick-desc">${esc(desc)}</span>` : ""}
        </span>
        <span class="ap-checkbox-container"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(
          c.name || r.untitled,
        )} in my Playbook" /><i></i></span>
      </label>`;
  };
  return `
    <div class="recap__picker" data-recap-roster="${r.scope}">
      <header class="pb2-block__head"><h3 class="pb2-block__title">${esc(copy.title)}</h3></header>
      <p class="pb2-block__hint">${esc(list.length ? copy.hint : copy.empty)}</p>
      ${ordered.length ? `<div class="recap__pick-list">${ordered.map(tile).join("")}</div>` : ""}
      <div class="recap__pick-foot">
        ${
          list.length < r.max
            ? `<button type="button" class="ap-button ghost blue" ${addHook}><i class="ap-icon-plus"></i><span>${esc(copy.add)}</span></button>`
            : ""
        }
        ${
          pending > 1
            ? `<button type="button" class="ap-button ghost grey" data-recap-cmp-accept-all><i class="ap-icon-check"></i><span>Select all</span></button>`
            : ""
        }
      </div>
    </div>`;
}

export function renderRosterPanel(data, r, edit, ctx) {
  const sectionId = ctx.sectionId(r.scope);
  const list = rosterList(data, r);
  // Index into the full array, so accept/dismiss/remove stay index-addressed
  // while the two states render in separate groups.
  const indexed = list.map((c, i) => ({ c, i }));
  const active = indexed.filter(({ c }) => !c.suggested);
  const pending = indexed.filter(({ c }) => c.suggested);

  const gridOf = (entries, opts) =>
    `<div class="recap__cmpgrid">${entries.map(({ c, i }) => renderRosterCard(r, c, i, opts, ctx)).join("")}</div>`;

  // Archie's proposals live in their own tray below the Playbook's own
  // entries — a pending suggestion is not part of this brand yet.
  const pendingGroup = pending.length
    ? `<section class="recap__cmpgroup recap__cmpgroup--suggested">
         <header class="recap__cmpgroup-head">
           <span class="recap__cmpgroup-title">
             <i class="ap-icon-sparkles" aria-hidden="true"></i>
             <span>My suggestions</span>
             <span class="ap-tag grey mini recap__cmpgroup-count">${pending.length}</span>
           </span>
           ${
             pending.length > 1 && ctx.canEdit()
               ? `<button type="button" class="ap-button ghost grey recap__cmpgroup-act" data-recap-cmp-accept-all>
                    <i class="ap-icon-check" aria-hidden="true"></i><span>Add all</span>
                  </button>`
               : ""
           }
         </header>
         <p class="recap__cmpgroup-sub">Not in your Playbook yet. Add the ones that matter.</p>
         ${gridOf(pending, { edit, pending: true })}
       </section>`
    : "";

  // The panel body is a flex column of padded .recap__row blocks; this section
  // has no label→value rows, so its content gets its own padded wrapper.
  let hint = "";
  let inner;
  if (rosterScanning === r.scope) {
    inner = renderRosterScan(r);
  } else if (ctx.cfg?.rosterPicker && edit) {
    inner = renderRosterPicker(data, r);
  } else {
    const activeEmpty = `<p class="recap__cmp-empty">${esc(
      pending.length ? r.pendingEmpty : edit ? r.emptyEdit : r.emptyRead,
    )}</p>`;
    const activeGroup = active.length ? gridOf(active, { edit, pending: false }) : activeEmpty;
    // Only label the active group when a suggestions tray sits under it —
    // a lone grid needs no heading.
    const activeBlock = pending.length
      ? `<section class="recap__cmpgroup">
           <header class="recap__cmpgroup-head">
             <span class="recap__cmpgroup-title"><span>${esc(r.ownGroup)}</span>
               <span class="ap-tag grey mini recap__cmpgroup-count">${active.length}</span>
             </span>
           </header>
           ${activeGroup}
         </section>`
      : activeGroup;

    if (edit) hint = ctx.sectionHint(r.scope);
    inner = [
      activeBlock,
      edit && list.length < r.max
        ? `<button type="button" class="ap-button secondary blue recap__add-row" data-recap-cmp-add>
             <i class="ap-icon-plus"></i><span>Add ${esc(r.noun)}</span>
           </button>`
        : "",
      pendingGroup,
      !edit && rosterFoundNone === r.scope
        ? `<p class="recap__cmp-note"><i class="ap-icon-info" aria-hidden="true"></i><span>${esc(r.noneFound)}</span></p>`
        : "",
    ].join("");
  }
  const body = `${hint}<div class="recap__cmpsec">${inner}</div>`;

  // One scan at a time across both rosters: the timer and the result slot are
  // shared, and two skeleton panels at once would read as the page reloading.
  const discoverBtn =
    !edit && !rosterScanning && ctx.canEdit()
      ? `<button type="button" class="ap-button ghost grey recap__panel-action" data-recap-cmp-discover title="Scan your market for competitors to suggest">
           <i class="ap-icon-sparkles" aria-hidden="true"></i>
           <span>${esc(list.length ? "Discover more" : r.discoverFirst)}</span>
         </button>`
      : "";

  // Playbook 2.0, reading: the tab's own head (lead + Discover + Edit), like the
  // other tabs, and the cards in a block below — no panel head repeating it.
  if (!edit)
    return `${ctx.tabHead("competitors", discoverBtn)}
      <section class="pb2-block pb2-block--bare" id="${sectionId}">${body}</section>`;
  // Editing keeps the tab's own head (Cancel / Save where Edit was), like the
  // other tabs: the old panel head moved the lead into a box on Edit.
  return `${ctx.tabHead(r.scope, "", { editing: true })}
    <section class="recap__panel is-editing pb2-block--bare" id="${sectionId}" data-recap-roster="${r.scope}" data-recap-editing-card>
      <div class="recap__panel-body">${body}</div>
    </section>
  `;
}

// Per-entry detail modal — the card stays a summary, everything editable
// (name, website, description, social profiles) lives here. Editable while its
// section is in edit scope, read-only otherwise; same rule as the
// reference-image modal.
export function renderRosterModal(data, ctx) {
  if (!rosterModal) return "";
  const r = ROSTERS[rosterModal.kind];
  const list = rosterList(data, r);
  const c = list[rosterModal.index];
  if (!c) return "";
  const i = rosterModal.index;
  const edit = ctx.inEdit(r.scope);
  const domain = rosterDomain(c);

  const nameBlock = edit
    ? `<div class="ap-input-group">
         <input type="text" data-recap-cmp-field="name" data-recap-cmp-index="${i}" value="${esc(
           c.name || "",
         )}" placeholder="${esc(r.namePlaceholder)}" aria-label="${esc(r.namePlaceholder)}" />
       </div>`
    : `<p class="recap__cmpmodal-value">${esc(c.name || r.untitled)}</p>`;

  const siteBlock = edit
    ? `<div class="ap-input-group">
         <input type="text" data-recap-cmp-field="websiteUrl" data-recap-cmp-index="${i}" value="${esc(
           c.websiteUrl || "",
         )}" placeholder="${esc(r.sitePlaceholder)}" aria-label="Website" spellcheck="false" />
       </div>`
    : domain
      ? `<a class="recap__cmpmodal-link" href="${esc(
          c.websiteUrl,
        )}" target="_blank" rel="noopener noreferrer"><i class="ap-icon-link" aria-hidden="true"></i><span>${esc(
          domain,
        )}</span><i class="ap-icon-external-link" aria-hidden="true"></i></a>`
      : `<span class="recap__cmpmodal-empty">No website yet.</span>`;

  const descBlock = edit
    ? `<div class="ap-textarea-field resizable">
         <textarea data-recap-cmp-field="description" data-recap-cmp-index="${i}" rows="4" placeholder="${esc(
           r.descPlaceholder,
         )}" aria-label="Description">${esc(c.description || "")}</textarea>
       </div>`
    : (c.description || "").trim()
      ? `<p class="recap__cmpmodal-note">${esc(c.description)}</p>`
      : `<p class="recap__cmpmodal-empty">No description yet.</p>`;

  const socials = Array.isArray(c.socials) ? c.socials : [];
  const socialsBlock = edit
    ? `<div class="recap__cmp-socialedit">
         ${socials
           .map((s, si) => {
             // A profile saved on a network the roster no longer offers keeps its
             // own option, so the select never shows a value it didn't store.
             const nets = r.networks.includes(s.network) ? r.networks : [...r.networks, s.network];
             const options = nets
               .map(
                 (n) =>
                   `<option value="${n}"${s.network === n ? " selected" : ""}>${esc(NETWORK_LABEL[n] || n)}</option>`,
               )
               .join("");
             return `
             <div class="recap__cmp-socialrow">
               <select class="ap-native-select recap__cmp-socialnet" data-recap-cmp-social-network data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" aria-label="Network">
                 ${options}
               </select>
               <div class="ap-input-group recap__cmp-socialurl">
                 <input type="text" data-recap-cmp-social-url data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" value="${esc(
                   s.url || "",
                 )}" placeholder="https://…" aria-label="Profile URL" spellcheck="false" />
               </div>
               <button type="button" class="ap-icon-button transparent grey recap__cta-remove" data-recap-cmp-social-remove data-recap-cmp-index="${i}" data-recap-cmp-social-index="${si}" aria-label="Remove profile">
                 <i class="ap-icon-close"></i>
               </button>
             </div>`;
           })
           .join("")}
         <button type="button" class="ap-button secondary blue recap__add-row" data-recap-cmp-social-add="${i}">
           <i class="ap-icon-plus"></i><span>Add profile</span>
         </button>
       </div>`
    : renderRosterNetLinks(c);

  const removeBtn = edit
    ? `<button type="button" class="ap-button transparent grey" data-recap-cmp-remove="${i}"><i class="ap-icon-trash"></i><span>Remove ${esc(
        r.noun,
      )}</span></button>`
    : "";

  return `
  <div class="app-modal-backdrop recap__cmpmodal-backdrop" data-recap-cmpmodal-backdrop data-recap-roster="${r.scope}">
    <aside class="ap-dialog recap__cmpmodal" role="dialog" aria-modal="true" aria-label="${esc(r.title)}">
      <div class="ap-dialog-header"><span class="ap-dialog-title">${esc(r.title)}</span></div>
      <button type="button" class="ap-dialog-close" data-recap-cmp-close aria-label="Close"><i class="ap-icon-close"></i></button>
      <div class="ap-dialog-content recap__cmpmodal-content">
        <div class="recap__cmpmodal-id">
          ${renderRosterLogo(c, 48)}
          ${
            c.suggested
              ? `<span class="ap-tag grey mini recap__cmp-badge"><i class="ap-icon-sparkles" aria-hidden="true"></i><span>Suggested, not added yet</span></span>`
              : ""
          }
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Name</span>
          ${nameBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Website</span>
          ${siteBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Description</span>
          ${descBlock}
        </div>
        <div class="recap__cmpmodal-sec">
          <span class="recap__refedit-flabel">Social profiles</span>
          ${socialsBlock}
        </div>
      </div>
      <div class="ap-dialog-footer">
        <div class="ap-dialog-footer-left">${c.suggested ? "" : removeBtn}</div>
        <div class="ap-dialog-footer-right">
          ${
            c.suggested && ctx.canEdit()
              ? `<button type="button" class="ap-button ghost grey" data-recap-cmp-dismiss="${i}"><span>Dismiss</span></button>
                 <button type="button" class="ap-button primary orange" data-recap-cmp-accept="${i}">
                   <i class="ap-icon-plus" aria-hidden="true"></i><span>Add to Playbook</span>
                 </button>`
              : `<button type="button" class="ap-button primary orange" data-recap-cmp-close><span>Done</span></button>`
          }
        </div>
      </div>
    </aside>
  </div>`;
}

// ── Influencers (the beta's list shape) ────────────────────────────────
//
// Copied from the Competitors section as it ships on app.beta.agorapulse.com,
// not from this prototype's Competitors: a plain LIST, no suggestion tray, no
// Discover, no detail dialog.
//   • read — one full-width row per influencer: name, a line of real links
//     (website, then each profile with its network's icon and name), the
//     description. The header carries "Add an influencer" beside the pencil.
//   • add  — a dialog: name, website, then ONE fixed field per network.
//     Works from read mode and commits on the spot, like the beta.
//   • edit — the pencil turns every row into its own inline form (name,
//     website, the fixed network fields) with a trash button; the description
//     isn't editable and hides, exactly as it does there.
// Nothing lands at creation: every Playbook starts on the empty state.

function influencerSocialUrl(c, network) {
  return (Array.isArray(c?.socials) ? c.socials : []).find((s) => s?.network === network)?.url || "";
}

function renderInfluencerLinks(c, r) {
  const domain = rosterDomain(c);
  const links = [];
  if (domain) {
    links.push(
      `<a class="ap-link standalone small recap__inf-link" href="${esc(
        c.websiteUrl.startsWith("http") ? c.websiteUrl : `https://${c.websiteUrl}`,
      )}" target="_blank" rel="noopener noreferrer"><i class="ap-icon-web" aria-hidden="true"></i><span>${esc(
        domain,
      )}</span></a>`,
    );
  }
  rosterSocials(c)
    .filter((s) => (s.url || "").trim() && r.networks.includes(s.network))
    .forEach((s) => {
      links.push(
        `<a class="ap-link standalone small recap__inf-link" href="${esc(
          s.url,
        )}" target="_blank" rel="noopener noreferrer"><i class="${
          NETWORK_ICON_BY_PLATFORM[s.network]
        }" aria-hidden="true"></i><span>${esc(NETWORK_LABEL[s.network] || s.network)}</span></a>`,
      );
    });
  return links.length ? `<span class="recap__inf-links">${links.join("")}</span>` : "";
}

// One fixed URL field per network, icon outside the input — the same row in
// the add dialog and in the inline editor. `attrs` says which of the two.
function renderInfluencerSocialFields(r, valueOf, attrs) {
  return r.networks
    .map((n) => {
      const label = NETWORK_LABEL[n] || n;
      return `
      <div class="recap__inf-field">
        <i class="${NETWORK_ICON_BY_PLATFORM[n]}" aria-hidden="true"></i>
        <div class="ap-input-group">
          <input type="url" ${attrs(n)} value="${esc(valueOf(n))}" placeholder="${esc(
            label,
          )} URL" aria-label="${esc(label)} URL" spellcheck="false" />
        </div>
      </div>`;
    })
    .join("");
}

function renderInfluencerEditRow(r, c, i) {
  return `
    <div class="recap__inf-edit">
      <div class="recap__inf-edit-head">
        <span class="recap__inf-name">${esc(c.name || r.untitled)}</span>
        <button type="button" class="ap-icon-button stroked transparent" data-recap-cmp-remove="${i}" aria-label="Remove this ${esc(
          r.noun,
        )}" title="Remove this ${esc(r.noun)}"><i class="ap-icon-trash"></i></button>
      </div>
      <div class="ap-input-group">
        <input type="text" data-recap-cmp-field="name" data-recap-cmp-index="${i}" value="${esc(
          c.name || "",
        )}" placeholder="${esc(r.namePlaceholder)}" aria-label="${esc(r.namePlaceholder)}" />
      </div>
      <div class="recap__inf-field">
        <i class="ap-icon-web" aria-hidden="true"></i>
        <div class="ap-input-group">
          <input type="url" data-recap-cmp-field="websiteUrl" data-recap-cmp-index="${i}" value="${esc(
            c.websiteUrl || "",
          )}" placeholder="${esc(r.sitePlaceholder)}" aria-label="Website" spellcheck="false" />
        </div>
      </div>
      <span class="recap__inf-label">Social profiles</span>
      ${renderInfluencerSocialFields(
        r,
        (n) => influencerSocialUrl(c, n),
        (n) => `data-recap-inf-social="${n}" data-recap-cmp-index="${i}"`,
      )}
    </div>`;
}

// A creator has no logo to show: two initials give each row a face, the way
// the Competitors cards have theirs.
function initialsOf(name) {
  return name
    .replace(/'s\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function renderInfluencersPanel(data, edit, ctx) {
  const r = ROSTERS.influencers;
  const sectionId = ctx.sectionId(r.scope);
  const list = rosterList(data, r);

  // The review (cfg.rosterPicker): the same picker as Competitors; an influencer
  // is added through its own dialog (data-recap-infadd-open), as on the page.
  if (ctx.cfg?.rosterPicker) {
    return `
      <section class="recap__panel" id="${sectionId}" data-recap-roster="${r.scope}" data-recap-editing-card>
        <div class="recap__panel-body">${renderRosterPicker(data, r, { addHook: "data-recap-infadd-open" })}</div>
      </section>`;
  }

  let rows;
  if (!list.length) {
    rows = renderInfluencersEmpty(edit, ctx);
  } else if (edit) {
    rows = list.map((c, i) => renderInfluencerEditRow(r, c, i)).join("");
  } else {
    rows = `<ul class="recap__inf-list">${list
      .map((c) => {
        const desc = (c.description || "").trim();
        return `
        <li class="recap__inf-row">
          <span class="ap-avatar size-40" aria-hidden="true"><span class="ap-avatar-initials">${esc(initialsOf(c.name || r.untitled))}</span></span>
          <div class="recap__inf-main">
            <div class="recap__inf-head">
              <span class="recap__inf-name">${esc(c.name || r.untitled)}</span>
              ${renderInfluencerLinks(c, r)}
            </div>
            ${desc ? `<p class="recap__inf-desc">${esc(desc)}</p>` : ""}
          </div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  // The beta hides Add while the section is being edited — Save/Cancel own
  // the header then.
  const addBtn =
    !edit && ctx.canEdit() && list.length && list.length < r.max
      ? `<button type="button" class="ap-button ghost grey recap__panel-action" data-recap-infadd-open>
           <i class="ap-icon-plus" aria-hidden="true"></i><span>Add an influencer</span>
         </button>`
      : "";

  // Reading: the tab's own head (lead + Add + Edit), like Competitors and the
  // other tabs — the old panel head boxed the lead and showed an icon-only Edit.
  if (!edit)
    return `${ctx.tabHead("influencers", addBtn)}
      <section class="pb2-block pb2-block--bare" id="${sectionId}" data-recap-roster="${r.scope}"><div class="recap__infsec">${rows}</div></section>`;
  return `${ctx.tabHead(r.scope, "", { editing: true })}
    <section class="recap__panel is-editing pb2-block--bare" id="${sectionId}" data-recap-roster="${r.scope}" data-recap-editing-card>
      <div class="recap__panel-body">
        <div class="recap__infsec">
          ${rows}
        </div>
      </div>
    </section>
  `;
}

// Empty is the state every Playbook starts in: Archie cannot suggest creators
// (Google's grounding terms forbid keeping what a grounded search finds), so
// the section has to sell the one thing it unlocks — Topics from what creators
// post — and hand over the way in. Its CTA is the only Add while it is empty;
// the header's comes back with the first entry.
function renderInfluencersEmpty(edit, ctx) {
  const cta =
    !edit && ctx.canEdit()
      ? `<button type="button" class="ap-button primary blue" data-recap-infadd-open>
           <i class="ap-icon-plus" aria-hidden="true"></i><span>Add your first influencer</span>
         </button>`
      : "";
  return `
    <div class="recap__inf-empty">
      <span class="topic-badge topic-badge--lg topic-badge--red" aria-hidden="true"><i class="ap-icon-star"></i></span>
      <div class="recap__inf-empty-text">
        <h3 class="recap__inf-empty-title">Turn what creators post into Topics</h3>
        <p class="recap__inf-empty-body">Add the creators your audience already follows. I read their new posts and bring the ones worth reacting to into your Topic Feed.</p>
      </div>
      ${cta}
    </div>`;
}

function emptyInfluencerDraft() {
  return { name: "", websiteUrl: "", socials: {} };
}

// The add dialog. Rendered with the recap body and portalled to <body> like
// the other detail modals (portalModal matches .recap__cmpmodal-backdrop).
export function renderInfluencerAddModal() {
  if (!infAdd) return "";
  const r = ROSTERS.influencers;
  const ready = infAdd.name.trim().length > 0;
  return `
  <div class="app-modal-backdrop recap__cmpmodal-backdrop" data-recap-infadd-backdrop data-recap-roster="${r.scope}">
    <aside class="ap-dialog recap__cmpmodal" role="dialog" aria-modal="true" aria-label="Add an influencer">
      <div class="ap-dialog-header"><span class="ap-dialog-title">Add an influencer</span></div>
      <button type="button" class="ap-dialog-close" data-recap-infadd-close aria-label="Close"><i class="ap-icon-close"></i></button>
      <div class="ap-dialog-content recap__cmpmodal-content recap__infadd">
        <p class="recap__inf-intro">Enter the influencer's name, website, and social profiles. Only the name is required.</p>
        <div class="ap-input-group">
          <input type="text" data-recap-infadd-field="name" value="${esc(infAdd.name)}" placeholder="${esc(
            r.namePlaceholder,
          )}" aria-label="${esc(r.namePlaceholder)}" />
        </div>
        <div class="recap__inf-field">
          <i class="ap-icon-web" aria-hidden="true"></i>
          <div class="ap-input-group">
            <input type="url" data-recap-infadd-field="websiteUrl" value="${esc(infAdd.websiteUrl)}" placeholder="${esc(
              r.sitePlaceholder,
            )}" aria-label="Website" spellcheck="false" />
          </div>
        </div>
        <span class="recap__inf-label">Social profiles</span>
        ${renderInfluencerSocialFields(
          r,
          (n) => infAdd.socials[n] || "",
          (n) => `data-recap-infadd-social="${n}"`,
        )}
      </div>
      <div class="ap-dialog-footer">
        <div class="ap-dialog-footer-right">
          <button type="button" class="ap-button ghost grey" data-recap-infadd-close><span>Cancel</span></button>
          <button type="button" class="ap-button primary blue" data-recap-infadd-submit${ready ? "" : " disabled"}>
            <i class="ap-icon-plus" aria-hidden="true"></i><span>Add an influencer</span>
          </button>
        </div>
      </div>
    </aside>
  </div>`;
}

// ── Discover scan ──────────────────────────────────────────────────────

export function stopRosterScan() {
  if (rosterScanTimer) {
    window.clearTimeout(rosterScanTimer);
    rosterScanTimer = null;
  }
  rosterScanning = null;
}

// Mock "scan" — shows the section-scoped skeleton, then merges only the
// entries that aren't already known (so a repeat scan is idempotent and
// removing one brings just that one back).
function startRosterScan(r, ctx) {
  const data = ctx.cfg?.getData();
  if (!data || rosterScanning) return;
  stopRosterScan();
  rosterScanning = r.scope;
  rosterFoundNone = null;
  ctx.repaint();
  rosterScanTimer = window.setTimeout(() => {
    rosterScanTimer = null;
    rosterScanning = null;
    const live = ctx.cfg?.getData();
    if (!live || !ctx.mountTarget) return;
    const existing = rosterList(live, r);
    // Exclude what's already on the Playbook (accepted or still pending) AND
    // everything the user dismissed — Archie never re-proposes a rejection.
    const found = r.discover(live.websiteUrl || live.sourceUrl || "", {
      exclude: [...existing, ...dismissedList(live, r)],
    });
    const room = Math.max(0, r.max - existing.length);
    const added = found.slice(0, room).map((c) => ({ ...c, suggested: true }));
    added.forEach((c) => existing.push(c));
    rosterFoundNone = added.length === 0 ? r.scope : null;
    // Persist in library mode (no-op in onboarding, where the draft IS the data).
    if (added.length) ctx.cfg.commit?.();
    ctx.repaint();
  }, ROSTER_SCAN_MS);
}

// ── Clicks ─────────────────────────────────────────────────────────────

// Every roster hook of onClick, in its order there; true when the click was
// one of them (onClick stops), false to let onClick go on.
export function handleRosterClick(event, data, ctx) {
  // ── Add an influencer (dialog, from read mode) ──
  if (event.target.closest("[data-recap-infadd-open]")) {
    infAdd = emptyInfluencerDraft();
    ctx.repaint(); // the page stays on the section behind the dialog
    document.querySelector("[data-recap-infadd-field='name']")?.focus();
    return true;
  }
  if (event.target.closest("[data-recap-infadd-close]") || event.target.matches?.("[data-recap-infadd-backdrop]")) {
    infAdd = null;
    ctx.repaint();
    return true;
  }
  if (event.target.closest("[data-recap-infadd-submit]")) {
    if (!infAdd || !infAdd.name.trim()) return true;
    const r = ROSTERS.influencers;
    const list = rosterList(data, r);
    if (list.length < r.max) {
      list.push({
        id: `${r.idPrefix}-new-${list.length + 1}-${Date.now().toString(36)}`,
        name: infAdd.name.trim(),
        description: "",
        websiteUrl: infAdd.websiteUrl.trim(),
        socials: r.networks
          .map((network) => ({ network, url: (infAdd.socials[network] || "").trim() }))
          .filter((x) => x.url),
      });
      ctx.cfg.commit?.();
    }
    infAdd = null;
    ctx.repaint();
    return true;
  }

  // ── Competitors + Influencers ──
  // Every hook below acts on the roster it sits in (rosterOf).
  if (event.target.closest("[data-recap-cmp-discover]")) {
    startRosterScan(rosterOf(event.target), ctx);
    return true;
  }

  // Accept a proposal — it becomes one of the Playbook's own entries.
  // Deliberately available in READ mode: adopting a suggestion shouldn't
  // require entering the section editor, that's the point of the tray.
  const cmpAccept = event.target.closest("[data-recap-cmp-accept]");
  if (cmpAccept) {
    const c = rosterList(data, rosterOf(cmpAccept))[Number(cmpAccept.dataset.recapCmpAccept)];
    if (!c) return true;
    delete c.suggested;
    rosterModal = null;
    if (!ctx.editScope) ctx.cfg.commit?.(); // in edit mode the section's Save commits
    ctx.repaint();
    return true;
  }

  // Picker (cfg.rosterPicker): untick — back to my suggestions, nothing lost.
  const cmpUnaccept = event.target.closest("[data-recap-cmp-unaccept]");
  if (cmpUnaccept) {
    const c = rosterList(data, rosterOf(cmpUnaccept))[Number(cmpUnaccept.dataset.recapCmpUnaccept)];
    if (!c) return true;
    c.suggested = true;
    rosterModal = null;
    ctx.repaint();
    return true;
  }

  const cmpAcceptAll = event.target.closest("[data-recap-cmp-accept-all]");
  if (cmpAcceptAll) {
    pendingEntries(data, rosterOf(cmpAcceptAll)).forEach((c) => delete c.suggested);
    rosterModal = null;
    if (!ctx.editScope) ctx.cfg.commit?.();
    ctx.repaint();
    return true;
  }

  // Dismiss a proposal — drop it and remember the rejection so a later scan
  // doesn't surface it again.
  const cmpDismiss = event.target.closest("[data-recap-cmp-dismiss]");
  if (cmpDismiss) {
    const r = rosterOf(cmpDismiss);
    const list = rosterList(data, r);
    const idx = Number(cmpDismiss.dataset.recapCmpDismiss);
    const c = list[idx];
    if (!c) return true;
    const key = r.key(c);
    const dismissed = dismissedList(data, r);
    if (key && !dismissed.includes(key)) dismissed.push(key);
    list.splice(idx, 1);
    rosterModal = null; // indices shifted — the open modal no longer means anything
    if (!ctx.editScope) ctx.cfg.commit?.();
    ctx.repaint();
    return true;
  }

  const cmpOpen = event.target.closest("[data-recap-cmp-open]");
  if (cmpOpen) {
    rosterModal = { kind: rosterOf(cmpOpen).scope, index: Number(cmpOpen.dataset.recapCmpOpen) };
    ctx.repaint();
    return true;
  }

  if (event.target.closest("[data-recap-cmp-close]") || event.target.matches?.("[data-recap-cmpmodal-backdrop]")) {
    rosterModal = null;
    ctx.repaint();
    return true;
  }

  const cmpRemove = event.target.closest("[data-recap-cmp-remove]");
  if (cmpRemove) {
    const idx = Number(cmpRemove.dataset.recapCmpRemove);
    const list = rosterList(data, rosterOf(cmpRemove));
    if (idx >= 0 && idx < list.length) list.splice(idx, 1);
    rosterModal = null; // the open modal's index no longer means anything
    ctx.repaint();
    return true;
  }

  const cmpAdd = event.target.closest("[data-recap-cmp-add]");
  if (cmpAdd) {
    const r = rosterOf(cmpAdd);
    const list = rosterList(data, r);
    if (list.length >= r.max) return true;
    list.push({
      id: `${r.idPrefix}-new-${list.length + 1}-${Date.now().toString(36)}`,
      name: "",
      description: "",
      websiteUrl: "",
      socials: [],
    });
    rosterModal = { kind: r.scope, index: list.length - 1 }; // open the blank card straight away
    ctx.repaint();
    ctx.mountTarget?.querySelector("[data-recap-cmp-field='name']")?.focus();
    return true;
  }

  const cmpSocialAdd = event.target.closest("[data-recap-cmp-social-add]");
  if (cmpSocialAdd) {
    const c = rosterList(data, rosterOf(cmpSocialAdd))[Number(cmpSocialAdd.dataset.recapCmpSocialAdd)];
    if (!c) return true;
    if (!Array.isArray(c.socials)) c.socials = [];
    c.socials.push({ network: rosterOf(cmpSocialAdd).networks[0], url: "" });
    ctx.repaint();
    const inputs = document.querySelectorAll("[data-recap-cmp-social-url]");
    inputs[inputs.length - 1]?.focus();
    return true;
  }

  const cmpSocialRemove = event.target.closest("[data-recap-cmp-social-remove]");
  if (cmpSocialRemove) {
    const c = rosterList(data, rosterOf(cmpSocialRemove))[Number(cmpSocialRemove.dataset.recapCmpIndex)];
    const si = Number(cmpSocialRemove.dataset.recapCmpSocialIndex);
    if (c && Array.isArray(c.socials) && si >= 0 && si < c.socials.length) c.socials.splice(si, 1);
    ctx.repaint();
    return true;
  }

  return false;
}

// The add dialog's fields (onInput, before its edit guard). No repaint: that
// would steal the caret — only the submit's state follows.
export function handleInfAddInput(event) {
  const addField = event.target.closest?.("[data-recap-infadd-field], [data-recap-infadd-social]");
  if (!(addField && infAdd)) return false;
  if (addField.dataset.recapInfaddField) infAdd[addField.dataset.recapInfaddField] = addField.value;
  else infAdd.socials[addField.dataset.recapInfaddSocial] = addField.value;
  const submit = document.querySelector("[data-recap-infadd-submit]");
  if (submit) submit.disabled = !infAdd.name.trim();
  return true;
}
