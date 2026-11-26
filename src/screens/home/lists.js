// The home's two lists: the Playbooks catalogue (table + cards) and the Chats
// tab (every chat, all brands). Reads the page state home.js owns. Moved out of
// home.js, unchanged.

import {
  visibleContexts,
  ownerOf,
  isMine,
  accessLabel,
  canEdit,
  canManageSharing,
  canDelete,
  canView,
  usableContexts,
} from "../../playbook-access.js?v=2900";
import { isFlagOn } from "../../feature-flags.js?v=2900";
import { escapeAttr, escapeText } from "../../utils.js?v=2900";
import { brandCoverStyle, voiceSentence } from "../../brand-cover.js?v=2900";
import { isWorkspaceMode, getActivePlaybookId } from "../../active-playbook.js?v=2900";
import { getSessions } from "../../sessions-store.js?v=2900";
import { renderEmptyState } from "../../components/empty-state.js?v=2900";
import { getSources, getIdeas } from "../../library.js?v=2900";
import { getPosts } from "../../posts-store.js?v=2900";
import { getContextById } from "../../contexts-store.js?v=2900";
import { voicesToFinish } from "../../voice-parts.js?v=2900";
import { networkIcon, networkLabel } from "../../social-profiles.js?v=2900";
import { pageState } from "../home.js?v=2900";

// The Playbooks tab — a TABLE, the same shape as the Chats tab beside it.
//
// ⚠️ It was a list of horizontal cards for two commits, and before that a grid
// of tiles. The table is the end of that road, and the reason is what these two
// tabs ARE: records to scan. Short comparable fields, one row each, and a
// reader moving DOWN a column — which is what a table is, and what the card
// list was imitating with fixed widths, one uniform row height and aligned
// numbers. Only the border and radius per row were still card.
//
// What the table adds that no card list could: its columns are NAMED, in text,
// in a header. The card list left the reader to infer that "MB" was an owner, a
// pen was a permission and a date was the last edit.
//
// The grid of tiles survives for `/contexts` flag OFF: there, a Playbook is an
// object you browse, not a row you pick from.
export function renderPlaybooksTable(list) {
  if (!list.length) return renderContextsEmpty(visibleContexts(), pageState);
  const sharing = isFlagOn("playbookSharing");
  return `
    <table class="ap-table outer-border header-background clickable-rows home-playbooks">
      <thead>
        <tr>
          <th scope="col">Playbook</th>
          ${sharing ? `<th scope="col">Owner</th><th scope="col">Access</th>` : ""}
          <th scope="col">Updated</th>
          <th scope="col" class="right">Actions</th>
        </tr>
      </thead>
      <tbody>${list.map(renderPlaybookRow).join("")}</tbody>
    </table>
  `;
}

// One Playbook, as a row. The words it says — the brief, the default star, the
// Current mark — come from the same three helpers the tile uses, so the two
// shapes can't drift into saying different things about one Playbook.
function renderPlaybookRow(ctx) {
  const sharing = isFlagOn("playbookSharing");
  const owner = sharing ? ownerOf(ctx) : null;
  const mine = isMine(ctx);
  const accessTitle = canEdit(ctx) ? "You can edit it" : `View only. ${owner?.name || "Its owner"} edits it`;
  const title = startChatTitle(ctx);
  return `
    <tr
      data-contexts-card="${escapeAttr(ctx.id)}"
      role="button"
      tabindex="0"
      ${title ? `title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"` : ""}
    >
      <td>
        <div class="ap-table-cell-content home-playbooks__identity">
          ${playbookThumb(ctx)}
          <div class="home-playbooks__text">
            <div class="home-playbooks__name-row">
              <span class="app-sidebar__row-color-dot app-sidebar__row-color-dot--${escapeAttr(ctx.color || "grey")}" aria-hidden="true"></span>
              <span class="home-playbooks__name">${escapeText(ctx.name)}</span>
              ${defaultBadge(ctx)}${currentTagFor(ctx)}
            </div>
            <div class="home-playbooks__brief">${escapeText(playbookBrief(ctx))}</div>
          </div>
        </div>
      </td>
      ${
        sharing
          ? `<td>
              <div class="ap-table-cell-content home-playbooks__owner">
                <span class="ap-avatar size-24"><span class="ap-avatar-initials">${escapeText(mine ? "MB" : owner?.initials || "?")}</span></span>
                <span class="home-playbooks__owner-name">${escapeText(mine ? "You" : owner?.name || "A teammate")}</span>
              </div>
            </td>
            <td>
              <div class="ap-table-cell-content home-playbooks__access" title="${escapeAttr(accessTitle)}" aria-label="${escapeAttr(accessTitle)}">
                <i class="${canEdit(ctx) ? "ap-icon-pen" : "ap-icon-eye-on"}" aria-hidden="true"></i>
              </div>
            </td>`
          : ""
      }
      <td><div class="ap-table-cell-content">${escapeText(ctx.updatedAt || "—")}</div></td>
      <td class="right">${playbookMoreMenu(ctx)}</td>
    </tr>
  `;
}

// The brand's own mark where the analysis found a logo, its initials where it
// didn't — so the column keeps one width and one shape, and never a stretched
// or cropped lockup. A square takes the brand's square mark (its « Icon » logo)
// when there is one: a wordmark shrunk into a square can't be read.
function playbookThumb(ctx, size = 32) {
  const logo = ctx.brandLogos?.find((l) => l.label === "Icon")?.url || ctx.brandLogo;
  const initials = String(ctx.name || "")
    .split("·")[0]
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return `
    <span class="ap-avatar square size-${size} home-playbooks__thumb" aria-hidden="true">
      ${
        logo
          ? `<img src="${escapeAttr(logo)}" alt="" />`
          : `<span class="ap-avatar-initials">${escapeText(initials)}</span>`
      }
    </span>
  `;
}

function playbookBrief(ctx) {
  const summary = (ctx.businessSummary || ctx.briefSummary || "").trim();
  return summary || "No business summary yet. Open this Playbook to add one.";
}

function defaultBadge(ctx) {
  return ctx.isDefault
    ? `<span class="contexts-card__badge" role="img" aria-label="Default Playbook" title="Default Playbook: new chats start with it"><i class="ap-icon-star_fill" aria-hidden="true"></i></span>`
    : "";
}

// What activating this Playbook does, as a title — empty without the workspace
// model, where a card opens the fiche instead.
function startChatTitle(ctx) {
  return isWorkspaceMode() ? `Start a chat in ${ctx.name}` : "";
}

function currentTagFor(ctx) {
  return isWorkspaceMode() && ctx.id === getActivePlaybookId()
    ? `<span class="ap-tag blue mini contexts-card__current" title="The Playbook you're working in"><span>Current</span></span>`
    : "";
}

// The four verbs, in a DS action-dropdown. Same `data-contexts-*` hooks as the
// tile's hover toolbar, so the screen's handlers don't know which shape fired.
function playbookMoreMenu(ctx) {
  const menuId = `ctxMore-${ctx.id}`;
  const item = (hook, icon, label, danger) => `
    <button
      type="button"
      role="menuitem"
      class="ap-action-dropdown-item${danger ? " red-mode" : ""}"
      ${hook}="${escapeAttr(ctx.id)}"
    >
      <i class="${icon}"></i>
      <div class="ap-action-dropdown-item-text">
        <div class="ap-action-dropdown-item-label-container">
          <span class="ap-action-dropdown-item-label">${label}</span>
        </div>
      </div>
    </button>
  `;
  return `
    <div class="home-playbooks__more">
      <button
        type="button"
        class="ap-icon-button transparent"
        data-playbook-more="${escapeAttr(ctx.id)}"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="${menuId}"
        aria-label="More actions"
        title="More actions"
      >
        <i class="ap-icon-more"></i>
      </button>
      <div class="ap-action-dropdown home-playbooks__more-menu" id="${menuId}" role="menu" hidden>
        ${canManageSharing(ctx) ? item("data-contexts-share", "ap-icon-share", "Share Playbook") : ""}
        ${
          canEdit(ctx)
            ? item("data-contexts-edit", "ap-icon-pen", "Edit Playbook")
            : canView(ctx)
              ? item("data-contexts-edit", "ap-icon-eye-on", "Open Playbook")
              : ""
        }
        ${item("data-contexts-duplicate", "ap-icon-copy", "Duplicate Playbook")}
        ${canDelete(ctx) ? item("data-contexts-delete", "ap-icon-trash", "Delete Playbook", true) : ""}
      </div>
    </div>
  `;
}

// The Chats tab — `getSessions()`, UNSCOPED. That is the whole point of the
// tab: at the account level the question is "where is my work", and the rail
// one level down already answers "this brand's work".
//
// .ap-table rather than .ap-list-panel: the latter is a master-detail left
// column (border-right, height 100%) with no column structure, and this needs
// three aligned columns.
export function renderChatsTab() {
  const q = (pageState.query || "").trim().toLowerCase();
  // Recency, the store's own order, and nothing else. NOT pinned-first, which
  // this list led with for a commit: a pin is something you do to a chat inside
  // its workspace, so the rail is where it sorts and where it shows. Up here the
  // only visible ordering column is Last activity, and a list ordered by a fact
  // it doesn't print reads as arbitrary.
  const rows = getSessions()
    .map((s) => ({ session: s, ctx: chatPlaybook(s) }))
    .filter(({ session, ctx }) => {
      if (!q) return true;
      // The brand is a visible column, so it has to be searchable.
      return `${session.name} ${ctx?.name || ""}`.toLowerCase().includes(q);
    });

  if (rows.length === 0) {
    return q
      ? renderEmptyState({
          icon: "ap-icon-search",
          title: "No chats match",
          body: `No chat matches "${escapeText(pageState.query)}". Try a different term.`,
          actionHtml: `<button type="button" class="ap-button stroked grey" data-contexts-clear-query>Clear search</button>`,
          wrapperClass: "contexts-view__empty contexts-view__empty--rich",
          level: 2,
        })
      : renderChatsFirstRun();
  }

  const body = rows
    .map(
      ({ session, ctx }) => `
      <tr data-home-chat="${escapeAttr(session.id)}" role="button" tabindex="0">
        <td>
          <div class="ap-table-cell-content">
            <span class="home-chats__name">${escapeText(session.name)}</span>
          </div>
        </td>
        ${countCell(getSources(session.id).length)}
        ${countCell(getIdeas(session.id).length)}
        ${countCell(getPosts(session.id).length)}
        <td>
          <div class="ap-table-cell-content">
            <span class="app-sidebar__row-color-dot app-sidebar__row-color-dot--${escapeAttr(ctx?.color || "grey")}" aria-hidden="true"></span>
            <span class="${ctx ? "" : "muted"}">${ctx ? escapeText(ctx.name) : "No Playbook"}</span>
          </div>
        </td>
        <td><div class="ap-table-cell-content">${escapeText(session.lastActivity || "")}</div></td>
      </tr>
    `,
    )
    .join("");

  return `
    <table class="ap-table small outer-border header-background clickable-rows home-chats">
      <thead>
        <tr>
          <th scope="col">Chat</th>
          <th scope="col" class="right">Sources</th>
          <th scope="col" class="right">Ideas</th>
          <th scope="col" class="right">Drafts</th>
          <th scope="col">Playbook</th>
          <th scope="col">Last activity</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// How far the work in a chat got — sources in, ideas out, drafts written. Three
// numbers with a COLUMN HEADER each rather than three icons in one cell: a
// number needs its name in text, and in a table the header is that name.
//
// ⚠️ Not the same call as the Playbooks tab, which just LOST its three counters.
// The difference is what the reader is doing: nobody picks a brand by how many
// audiences its fiche lists, but "3 sources · 5 ideas · 2 drafts" is exactly how
// far a conversation got, which is what you scan a list of work for.
//
// A zero prints as a zero, muted: an empty cell in a numeric column reads as
// "unknown", and "this chat has produced nothing yet" is a fact worth seeing.
function countCell(n) {
  return `<td class="right"><div class="ap-table-cell-content">
    <span class="${n ? "home-chats__count" : "home-chats__count home-chats__count--zero"}">${n}</span>
  </div></td>`;
}

// The Playbook behind a chat, but only if I may open it — same rule the rail's
// rows follow: a chat that lost access shows the grey dot and the neutral word,
// never a name it can't reach.
export function chatPlaybook(session) {
  if (!session?.contextId) return null;
  const ctx = getContextById(session.contextId);
  return ctx && canView(ctx) ? ctx : null;
}

// No Playbook at all: the page has to say what one IS before asking for one,
// and show it rather than list it. An example plays once: a Playbook fills in
// its four parts, I read it, and three posts on three networks come out of it.
// Then it keeps going, quietly: each part lights in turn with the words (or the
// image) it shaped in the posts, so "every draft comes from it" is something
// you watch, not a claim. The brand is the made-up café of the demo (Bramble &
// Bean), tagged Example so nobody reads it as their own. Decorative
// (aria-hidden): the title and the sentence carry everything it shows.
// `[text]{part}` in a post marks a trace of that part; the CSS lights it.
const FIRST_RUN_BRAND = ["#6B3A22", "#C8874E", "#7A8F4E", "#F7EFE5"];
const FIRST_RUN_PARTS = [
  { id: "business", icon: "ap-icon-buildings", label: "Business", value: "Café and roaster" },
  { id: "audience", icon: "ap-icon-multiple-users", label: "Audience", value: "Regulars, brewers" },
  { id: "voice", icon: "ap-icon-megaphone", label: "Voice", value: "Warm and plain" },
  { id: "look", icon: "ap-icon-image", label: "Look" },
];
const FIRST_RUN_POSTS = [
  {
    network: "ap-icon-linkedin-official",
    text: "[Regulars]{audience}, this week's [guest roast]{business} is in: Ethiopia Guji. Bright, a little berry. [Come taste it before it's gone.]{voice}",
  },
  {
    network: "ap-icon-instagram-official",
    image: true,
    text: "[Saturday brunch]{business}, flat white on the side. [See you at 10?]{voice}",
  },
  {
    network: "ap-icon-facebook-official",
    text: "[Home brewers]{audience}: the [autumn blend]{business} is back in 250 g bags. [Grab one on your way out.]{voice}",
  },
];
// The wires, in the wires box's own pixels (144 × 360): the card into my mark,
// then my mark out to the three posts, whose centres sit at 56 / 180 / 304.
const FIRST_RUN_WIRES = [
  "M0 180 L24 180",
  "M72 180 C 110 180, 106 56, 144 56",
  "M72 180 L160 180", // the Instagram post sits 16px further right
  "M72 180 C 110 180, 106 304, 144 304",
];
const FIRST_RUN_INDEX = Object.fromEntries(FIRST_RUN_PARTS.map((p, i) => [p.id, i]));

// Word by word (each word its own --w for the typing), traces wrapped.
function firstRunText(text) {
  let w = 0;
  const words = (s) =>
    s
      .split(/(\s+)/)
      .map((t) => (/^\s*$/.test(t) ? t : `<span class="pb-first__word" style="--w:${w++}">${escapeText(t)}</span>`))
      .join("");
  return text.replace(/\[([^\]]+)\]\{(\w+)\}|([^[]+)/g, (_, trace, part, plain) =>
    trace ? `<span class="pb-first__trace" style="--i:${FIRST_RUN_INDEX[part]}">${words(trace)}</span>` : words(plain),
  );
}

function renderPlaybooksFirstRun() {
  const logo = `<span class="pb-first__logo">B</span>`;
  const parts = FIRST_RUN_PARTS.map(
    (p, i) => `
      <li class="pb-first__part" style="--i:${i}">
        <i class="${p.icon}"></i>
        <span class="pb-first__part-label">${p.label}</span>
        ${
          p.value
            ? `<span class="pb-first__part-value">${p.value}</span>`
            : `<span class="pb-first__swatches">${FIRST_RUN_BRAND.map((_, j) => `<span style="background:var(--b${j});--j:${j}"></span>`).join("")}</span>`
        }
        <i class="ap-icon-check pb-first__part-check"></i>
      </li>`,
  ).join("");
  const posts = FIRST_RUN_POSTS.map(
    (post, k) => `
      <div class="pb-first__post${post.image ? " pb-first__post--image" : ""}" style="--k:${k}">
        ${post.image ? `<span class="pb-first__photo"><span class="pb-first__cup"></span></span>` : ""}
        <div class="pb-first__post-body">
          <div class="pb-first__post-head">${logo}<span>Bramble &amp; Bean</span><i class="${post.network}"></i></div>
          <p class="pb-first__post-text">${firstRunText(post.text)}</p>
        </div>
      </div>`,
  ).join("");
  return `
    <div class="pb-first" style="${FIRST_RUN_BRAND.map((c, j) => `--b${j}:${c}`).join(";")}">
      <div class="pb-first__stage" aria-hidden="true">
        <div class="pb-first__sheet">
          <div class="pb-first__cover">
            ${FIRST_RUN_BRAND.map((_, j) => `<span style="background:var(--b${j})"></span>`).join("")}
            <span class="pb-first__example">Example</span>
          </div>
          <div class="pb-first__sheet-head">
            <span class="pb-first__logo pb-first__logo--lg">B</span>
            <span class="pb-first__sheet-name">Bramble &amp; Bean</span>
            <span class="pb-first__sheet-kind">Playbook</span>
          </div>
          <ul class="pb-first__parts">${parts}</ul>
        </div>
        <div class="pb-first__wires">
          <svg class="pb-first__wire-lines" viewBox="0 0 144 360">
            ${FIRST_RUN_WIRES.map((d, n) => `<path d="${d}" pathLength="1" style="--n:${n}" />`).join("")}
          </svg>
          ${FIRST_RUN_WIRES.flatMap((d, n) => [0, 1].map((h) => `<span class="pb-first__spark${n ? "" : " pb-first__spark--in"}" style="offset-path:path('${d}');--n:${n};--h:${h}"></span>`)).join("")}
          <span class="pb-first__mark">
            <svg class="pb-first__orbit" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" pathLength="24" /></svg>
            <i class="ap-icon-archie-official"></i>
          </span>
        </div>
        <div class="pb-first__posts">${posts}</div>
      </div>
      <div class="pb-first__copy">
        <h2 class="ap-h1">Teach me your Brand once</h2>
        <p class="ap-subtitle">Everything I know about your Brand, in one place. Every draft starts here.</p>
      </div>
      <div class="pb-first__action">
        <button type="button" class="ap-button primary blue" data-contexts-new><i class="ap-icon-plus"></i><span>Create my Playbook</span></button>
        <p class="pb-first__hint">Start from your website, your files, or a few questions.</p>
      </div>
    </div>
  `;
}

// No chat yet: the Playbooks' first run, told for a chat. One example chat
// (Bramble & Bean again, tagged Example): you ask, a file rides along, I answer,
// and the three things a chat holds come out of it, named the way the table's
// columns name them (sources · ideas · drafts). Then each one lights in turn.
// Same stage, wires and timeline as the Playbook's (.pb-first), so the two tabs
// read as one family. The action follows the hero: with a Playbook the box
// above starts a chat, so the button focuses it; without one there is no box,
// and the Playbook comes first. Decorative scene, the copy carries it all.
const CHAT_OUTPUTS = [
  { label: "1 source", lines: [{ icon: "ap-icon-file--pdf", text: "autumn-menu.pdf" }] },
  {
    label: "3 ideas",
    lines: [
      { text: "Guji, bright and a little berry" },
      { text: "Brewing it at home" },
      { text: "Why we roast in autumn" },
    ],
  },
  {
    label: "2 drafts",
    lines: [
      { icon: "ap-icon-linkedin-official", text: "Regulars, the autumn blend is in…" },
      { icon: "ap-icon-instagram-official", text: "Saturday brunch, flat white on…" },
    ],
  },
];

function renderChatsFirstRun() {
  const hasPlaybook = usableContexts().length > 0;
  const outputs = CHAT_OUTPUTS.map(
    (out, k) => `
      <div class="pb-first__post chat-first__out" style="--k:${k};--i:${k}">
        <span class="chat-first__out-label">${out.label}</span>
        ${out.lines.map((l) => `<span class="chat-first__out-line">${l.icon ? `<i class="${l.icon}"></i>` : ""}<span>${l.text}</span></span>`).join("")}
      </div>`,
  ).join("");
  return `
    <div class="pb-first pb-first--chats" style="${FIRST_RUN_BRAND.map((c, j) => `--b${j}:${c}`).join(";")}">
      <div class="pb-first__stage" aria-hidden="true">
        <div class="pb-first__sheet chat-first__chat">
          <div class="chat-first__head">
            <span class="pb-first__logo">B</span>
            <span class="chat-first__name">Autumn blend launch</span>
            <span class="chat-first__example">Example</span>
          </div>
          <div class="chat-first__thread">
            <p class="chat-first__bubble">${firstRunText("Write about our autumn blend. The menu is attached.")}</p>
            <span class="chat-first__file"><i class="ap-icon-file--pdf"></i>autumn-menu.pdf</span>
            <p class="chat-first__reply"><i class="ap-icon-archie-official"></i><span>${firstRunText("Here are 3 ideas from your menu and 2 drafts.")}</span></p>
          </div>
        </div>
        <div class="pb-first__wires">
          <svg class="pb-first__wire-lines" viewBox="0 0 144 360">
            ${FIRST_RUN_WIRES.map((d, n) => `<path d="${d}" pathLength="1" style="--n:${n}" />`).join("")}
          </svg>
          ${FIRST_RUN_WIRES.flatMap((d, n) => [0, 1].map((h) => `<span class="pb-first__spark${n ? "" : " pb-first__spark--in"}" style="offset-path:path('${d}');--n:${n};--h:${h}"></span>`)).join("")}
          <span class="pb-first__mark">
            <svg class="pb-first__orbit" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" pathLength="24" /></svg>
            <i class="ap-icon-archie-official"></i>
          </span>
        </div>
        <div class="pb-first__posts">${outputs}</div>
      </div>
      <div class="pb-first__copy">
        <h2 class="ap-h1">Bring me a source, get drafts back</h2>
        <p class="ap-subtitle">Start with a link, a file, or a few words. Each chat keeps its sources, ideas, and drafts together.</p>
      </div>
      <div class="pb-first__action">
        ${
          hasPlaybook
            ? `<button type="button" class="ap-button primary blue" data-home-focus-prompt><i class="ap-icon-plus"></i><span>Start your first chat</span></button>`
            : `<button type="button" class="ap-button primary blue" data-contexts-new><i class="ap-icon-plus"></i><span>Create my Playbook</span></button>
               <p class="pb-first__hint">Every chat starts from a Playbook, so create one first.</p>`
        }
      </div>
    </div>
  `;
}

// FIND-B4: rich empty state — separates "no contexts at all" (first-run)
// from "search active with no match". Returning user with everything
// deleted hits the same first-run path, which is fine — both want a
// "Create your first context" CTA.
export function renderContextsEmpty(allContexts, pageState) {
  const hasQuery = (pageState.query || "").trim().length > 0;
  if (allContexts.length === 0) return renderPlaybooksFirstRun();
  if (hasQuery) {
    return renderEmptyState({
      icon: "ap-icon-search",
      title: "No Playbooks match",
      body: `No Playbook matches "${escapeText(pageState.query)}". Try a different term.`,
      actionHtml: `<button type="button" class="ap-button stroked grey" data-contexts-clear-query>Clear search</button>`,
      wrapperClass: "contexts-view__empty contexts-view__empty--rich",
    });
  }
  return renderEmptyState({
    icon: "ap-icon-target",
    title: "No Playbooks you can open",
    body: "Playbooks shared with you will show here. Create your own to start drafting.",
    actionHtml: `<button type="button" class="ap-button primary blue" data-contexts-new><i class="ap-icon-plus"></i><span>Create a Playbook</span></button>`,
    wrapperClass: "contexts-view__empty contexts-view__empty--rich",
  });
}

// Claude-Projects-style summary card. The card is the primary
// "what is this context" affordance — readable at a glance, with
// secondary actions tucked into a hover-reveal toolbar in the
// top-right corner. DO/DON'T lists and the tones chip row moved
// out: they bloated the card without helping identification, and
// they live in the read panel where they belong.
// Trailing "ghost" card — visually invites a new Playbook from the grid
// itself, so the user doesn't have to chase the header CTA after scrolling.
// Triggers the same `data-contexts-new` handler as the header button.
export function renderGhostCard() {
  // The card's own anatomy, empty: a neutral cover, the
  // Archie mark astride its edge where a brand's logo would sit, then the
  // name slot and one sentence. It spans the grid's four rows like a card.
  return `
    <button type="button" class="contexts-card contexts-card--ghost" data-contexts-new aria-label="Create a Playbook">
      <span class="contexts-card__cover"></span>
      <span class="contexts-card__body">
        <span class="contexts-card__mark"><span class="contexts-card--ghost__glyph"><i class="ap-icon-archie-official" aria-hidden="true"></i></span></span>
        <span class="contexts-card__name">Create a Playbook</span>
        <span class="contexts-card__brief">One Brand, its voice and its goal. I write every draft from it.</span>
      </span>
    </button>
  `;
}

export function renderContextCard(ctx) {
  const summary = (ctx.businessSummary || ctx.briefSummary || "").trim();
  const audienceCount = Array.isArray(ctx.audience) ? ctx.audience.length : ctx.audience ? 1 : 0;
  // `suggested` entries are still pending proposals from Archie, not
  // competitors of this brand yet — they must not inflate the count.
  const competitorCount = Array.isArray(ctx.competitors) ? ctx.competitors.filter((c) => !c.suggested).length : 0;
  const influencerCount = Array.isArray(ctx.influencers) ? ctx.influencers.filter((c) => !c.suggested).length : 0;
  const usedIn = ctx.usedIn || 0;
  // The palette cover — the same field the fiche's header carries.
  const coverStyle = brandCoverStyle(ctx);
  const isDefaultBadge = defaultBadge(ctx);
  // Who this Playbook belongs to, on the cover's top left — never a coloured
  // border, a card's state goes in its content. It tried living beside the
  // title first and broke long names onto two lines, then in the foot, which it
  // overflowed. Mine-and-private says nothing: the default nobody needs told.
  const access = accessLabel(ctx);
  const ownerTag = access
    ? `<span class="ap-tag grey mini contexts-card__owner" title="${escapeAttr(access)}">
        <i class="${isMine(ctx) ? "ap-icon-multiple-users" : "ap-icon-user"}" aria-hidden="true"></i>
        <span>${escapeText(access)}</span>
      </span>`
    : "";
  // Only the actions I can actually take. For a Playbook someone shared with
  // me that's Open (the fiche, read-only — the card itself starts a chat) and
  // Duplicate, the one move that turns reading into having. Open rides the
  // edit hook: both just navigate to the fiche, which gates editing itself.
  const actions = [
    canManageSharing(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-share="${ctx.id}" title="Share Playbook" aria-label="Share Playbook">
          <i class="ap-icon-share"></i>
        </button>`
      : "",
    canEdit(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-edit="${ctx.id}" title="Edit Playbook" aria-label="Edit Playbook">
          <i class="ap-icon-pen"></i>
        </button>`
      : canView(ctx)
        ? `<button type="button" class="ap-icon-button transparent" data-contexts-edit="${ctx.id}" title="Open Playbook" aria-label="Open Playbook">
            <i class="ap-icon-eye-on"></i>
          </button>`
        : "",
    `<button type="button" class="ap-icon-button transparent" data-contexts-duplicate="${ctx.id}" title="Duplicate Playbook" aria-label="Duplicate Playbook">
      <i class="ap-icon-copy"></i>
    </button>`,
    canDelete(ctx)
      ? `<button type="button" class="ap-icon-button transparent" data-contexts-delete="${ctx.id}" title="Delete Playbook" aria-label="Delete Playbook">
          <i class="ap-icon-trash"></i>
        </button>`
      : "",
  ].join("");
  // ── On the home, a card IS the workspace ────────────────────────────────
  //
  // Clicking it switches to that brand and opens a fresh chat in it: on a page
  // whose subject is "which brand am I working in", the card is the door, the
  // way it is in every workspace picker. The fiche keeps the pen, with the
  // other management verbs.
  //
  // ⚠️ This REVERSES what stood here for a commit — the body opening the fiche,
  // with a small "Switch" link carrying the scope move — argued from the
  // asymmetry of a mis-click (a page versus the whole app moving). The user's
  // call, and what makes it safe is that nothing is lost: the new chat is
  // empty, the crumb goes back, and the brand you left is one card away. The
  // Switch link went with it, redundant: a second control for what the whole
  // card now does.
  //
  // Flag OFF there is no workspace to enter, so the card keeps opening the
  // fiche and none of this renders.
  const currentTag = currentTagFor(ctx);
  const cardTitle = startChatTitle(ctx);
  // The tile's own pieces. What the two shapes must say IDENTICALLY — the
  // default star, the Current mark, the title of the click — comes from the
  // shared helpers above, the same rule topic-card.js follows for its shapes.
  const voice = voiceSentence(ctx);
  const voiceHtml = voice ? `<p class="contexts-card__voice">${escapeText(voice)}</p>` : "";
  const briefHtml = summary
    ? `<p class="contexts-card__brief">${escapeText(summary)}</p>`
    : `<p class="contexts-card__brief contexts-card__brief--empty">${escapeText(playbookBrief(ctx))}</p>`;
  // What I know about the brand's world: three fixed columns, every card the
  // same, so the figures line up across the grid. Each figure names what it
  // counts in text: an icon beside a number never did.
  const stat = (icon, n, one, many) =>
    `<div class="contexts-card__stat"><span class="contexts-card__stat-n"><i class="${icon}" aria-hidden="true"></i>${n}</span><span class="contexts-card__stat-label">${n === 1 ? one : many}</span></div>`;
  const statsHtml = `
    <div class="contexts-card__stats">
      ${stat("ap-icon-target", audienceCount, "audience", "audiences")}
      ${stat("ap-icon-buildings", competitorCount, "competitor", "competitors")}
      ${stat("ap-icon-star", influencerCount, "influencer", "influencers")}
    </div>
  `;
  // The foot: how much it's used (the count leads, in ink), then when it last
  // moved, quieter. No middle dot: two pieces, two weights.
  const chatsLabel = usedIn ? `${usedIn} ${usedIn === 1 ? "chat" : "chats"}` : "No chats yet";
  const activityHtml = `
    <div class="contexts-card__activity">
      <span class="contexts-card__chats${usedIn ? "" : " is-empty"}"><i class="ap-icon-single-chat-bubble" aria-hidden="true"></i>${chatsLabel}</span>
      ${ctx.updatedAt ? `<span class="contexts-card__updated">Updated ${escapeText(ctx.updatedAt)}</span>` : ""}
    </div>`;
  // Voices to finish (2026-10-29, asked: « une indication quand une voice n'est
  // pas complète ou manquante sur la card d'un playbook »): how many, and on
  // which networks.
  const toFinish = voicesToFinish(ctx);
  const voicesHtml = toFinish.length
    ? `<div class="contexts-card__voices">
        <span class="ap-status orange">${toFinish.length} voice${toFinish.length === 1 ? "" : "s"} to finish</span>
        <span class="contexts-card__voice-nets">${toFinish
          .map(
            (n) =>
              `<i class="${networkIcon(n)}" title="${escapeAttr(networkLabel(n))}" aria-label="${escapeAttr(networkLabel(n))}"></i>`,
          )
          .join("")}</span>
      </div>`
    : "";
  const openAttrs = `
      data-contexts-card="${ctx.id}"
      ${cardTitle ? `title="${escapeAttr(cardTitle)}"` : ""}`;

  // ── The tile ────────────────────────────────────────────────────────────
  // The catalogue's own shape, flag OFF: a brand sheet. The palette cover and
  // the brand mark say whose it is, then the name, the voice as a sentence, the
  // brief; then what I know of its world (three figures); then the activity and
  // its state tags. A Playbook is an OBJECT you browse here. On the home the
  // same Playbook is a row you pick from (renderPlaybookRow), which is why the
  // two shapes differ in everything but the words they say.
  return `
    <article class="contexts-card"${openAttrs}>

      <div class="contexts-card__cover"${coverStyle}>
        ${currentTag || ownerTag ? `<div class="contexts-card__tags">${currentTag}${ownerTag}</div>` : ""}
      </div>
      <div class="contexts-card__actions" data-contexts-card-actions>${actions}</div>

      <div class="contexts-card__body">
        <div class="contexts-card__mark">${playbookThumb(ctx, 56)}</div>
        <h3 class="contexts-card__name">
          <!-- The keyboard way in: the tile is no longer a role=button wrapping
               its own action buttons (ARIA nested interactive). A click anywhere
               on the tile still opens it (delegated on data-contexts-card). -->
          <button type="button" class="contexts-card__open" title="${escapeAttr(ctx.name)}"${cardTitle ? ` aria-label="${escapeAttr(cardTitle)}"` : ""}>${escapeText(ctx.name)}</button>
          ${isDefaultBadge}
        </h3>
        ${voiceHtml}
        ${briefHtml}
      </div>

      ${statsHtml}

      <footer class="contexts-card__foot">
        ${activityHtml}
        ${voicesHtml}
      </footer>
    </article>
  `;
}
