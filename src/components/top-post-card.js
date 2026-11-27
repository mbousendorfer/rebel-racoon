// top-post-card — how a published post is shown: the decision card (Insights'
// linked posts), the echo row (a picked post in the thread, Sources), and the
// in-thread winners widget (top-posts-flow.js). Pure render, no module state.
//
//   renderTopPostCard(post, { … }) → one decision card
//   renderPostEchoRow / renderTopPostEcho → one quoted post
//   renderTopPostsWidget({ … }) → the single-select winners widget

import { compactNumber, html, raw } from "../utils.js?v=2983";
import {
  profileForNetwork,
  NETWORK_ICON_BY_PLATFORM,
  BRAND_INITIALS,
  networkLabel,
  networkMeta,
} from "../social-profiles.js?v=2983";

// Ranking criteria the flow asks for (askRankCriterion). `compare` sorts descending by the decision-useful value (recent sorts
// ascending by age). Always sorted so the strongest option for that lens is
// first (chart guidance: rank descending by value).
export const SORTS = [
  { key: "performance", label: "Performance", compare: (a, b) => b.vsAvg - a.vsAvg },
  { key: "engagement", label: "Engagement", compare: (a, b) => b.engagementRate - a.engagementRate },
  { key: "impressions", label: "Impressions", compare: (a, b) => b.impressions - a.impressions },
];

// Period filter — narrow the winners to a recency window (spec: "filter by
// metrics"). `maxDays` is the inclusive age ceiling in days. Matched against each
// post's `daysAgo`. Default window is the first entry (last month).
export const PERIODS = [
  { key: "1m", label: "Last month", maxDays: 30 },
  { key: "3m", label: "Last 3 months", maxDays: 90 },
  { key: "6m", label: "Last 6 months", maxDays: 180 },
  { key: "1y", label: "Last year", maxDays: 365 },
];

function iconFor(network) {
  return networkMeta(network)?.icon || "ap-icon-share";
}

// Permalink to the original post on its network — the "Open original" link.
// Prototype: these are mock winners, so we build a plausible per-network URL
// from the post id (opens in a new tab). A real integration would carry the
// permalink on the post payload instead.
const PERMALINK = {
  linkedin: (id) => `https://www.linkedin.com/feed/update/${id}`,
  x: (id) => `https://x.com/i/web/status/${id}`,
  twitter: (id) => `https://x.com/i/web/status/${id}`,
  instagram: (id) => `https://www.instagram.com/p/${id}/`,
  facebook: (id) => `https://www.facebook.com/${id}`,
};
function postPermalink(network, id) {
  const fn = PERMALINK[(network || "").toLowerCase()];
  return fn ? fn(id) : "#";
}

// "View on <network>" link — a discreet text link + the network's own icon,
// opening the original post in a new tab. Shared by the board card footer and
// the conversation echo card so both use the same affordance.
function renderViewOnLink(post) {
  return `<a
      class="top-post-view-on"
      href="${postPermalink(post.network, post.id)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View original post on ${networkLabel(post.network)}"
    ><span>View on</span><i class="${iconFor(post.network)}" aria-hidden="true"></i></a>`;
}

// Post-type indicator — a small overlay pill (icon + label) shown bottom-left of
// every card's visual zone, so the board reads the format of each winner at a
// glance. Generalises the old carousel-only count badge to all post types
// (Text / Photo / Carousel · N / Video), mirroring the DS media overlay badges.
function postTypeBadge(post) {
  const type = post.mediaType || "text";
  const count = post.imageCount || 1;
  // Icon-only badge; a carousel shows its image count, a document its page count.
  let icon = "ap-icon-file--text";
  let title = "Text";
  let text = "";
  if (type === "video") {
    icon = "ap-icon-video";
    title = "Video";
  } else if (type === "document") {
    // LinkedIn Document — no preview, so the badge carries the page count when
    // there is one. A post that only says "document" (Insights' own posts do)
    // used to render "1 pages": a count it never had, mis-pluralised.
    const pages = post.pageCount || 0;
    icon = "ap-icon-file--pdf";
    title = pages > 1 ? `Document · ${pages} pages` : "Document";
    text = pages > 1 ? `${pages} pages` : "";
  } else if (type === "image" && count > 1) {
    icon = "ap-icon-multiple-images";
    title = `Carousel · ${count} images`;
    text = String(count);
  } else if (type === "image") {
    icon = "ap-icon-image";
    title = "Photo";
  }
  return `<span class="top-post-card__type${text ? "" : " top-post-card__type--icon"}" title="${title}"><i class="${icon}" aria-hidden="true"></i>${text}</span>`;
}

// The media block inside the post-preview body, mirroring the Figma
// `.post Contructor` component: a rounded 16:9 media below the copy, with the
// post-type badge overlaid bottom-left.
//   image → poster image
//   text  → no media (the pull-quote note carries the card on its own)
function renderMediaBlock(post) {
  const type = post.mediaType || "text";
  if (type !== "image") return "";
  return `<div class="top-post-card__media top-post-card__media--image">
      <img class="top-post-card__media-img" src="${post.image}" alt="" loading="lazy" />
      ${postTypeBadge(post)}
    </div>`;
}

// A text-only winner has no media, so the pull-quote IS the card — and posts vary
// wildly in length (a one-line hook vs a network's max-length body). Scale the
// type to the length so short posts read big and punchy while long ones step down
// to fit more, and every tier line-clamps so the card height stays bounded (the
// copy truncates rather than growing the card / its grid row). Thresholds are on
// the rendered character count.
function soloSizeTier(text) {
  const n = (text || "").length;
  if (n <= 70) return "top-post-card__text--xl";
  if (n <= 150) return "top-post-card__text--lg";
  if (n <= 300) return "top-post-card__text--md";
  return "top-post-card__text--sm";
}

/**
 * ONE post, as Insights draws the posts that moved an objective. The profile
 * head with its `View on` link, the copy, the media or the pull-quote and the
 * post-type badge are fixed; the host owns what it measures:
 *
 *   statsHtml — the strip under the body. Give it `.top-post-card__stat`
 *               children; two columns read as well as four.
 *   heroHtml  — the footer's left half, the one figure the card is about.
 *   ctaHtml   — the footer's button, so the host carries its own data hook.
 *   className — a host modifier (Insights uses `--neutral`, see the CSS).
 */
export function renderTopPostCard(post, { className = "", statsHtml, heroHtml, ctaHtml }) {
  // These are posts from the brand's own profiles, so the card leads with the
  // profile identity (brand avatar + network badge + handle). Falls back to the
  // network label when no connected profile resolves.
  const account = profileForNetwork(post.network);
  const net = (post.network || "").toLowerCase();
  const networkIcon = NETWORK_ICON_BY_PLATFORM[net] || iconFor(post.network);
  const handle = account?.handle || networkLabel(post.network);
  const avatarInner = account?.photo
    ? `<img src="${account.photo}" alt="" />`
    : `<span class="ap-avatar-initials">${BRAND_INITIALS}</span>`;
  const mediaHtml = renderMediaBlock(post);
  // Text-only winners have no media, so the copy IS the body: the pull-quote on a
  // soft "note" surface, with the post-type badge overlaid bottom-left (same as
  // the media cards). Media posts keep copy-above-media.
  const bodyInner = mediaHtml
    ? html`<p class="top-post-card__text">${post.excerpt}</p>
        ${raw(mediaHtml)}`
    : html` <div class="top-post-card__note">
        <p class="top-post-card__text top-post-card__text--solo ${soloSizeTier(post.excerpt)}">${post.excerpt}</p>
        ${raw(postTypeBadge(post))}
      </div>`;
  return html`
    <article class="ap-card top-post-card ${className}">
      <header class="top-post-card__preview-head">
        <span class="ap-avatar size-24 top-post-card__avatar" aria-hidden="true"
          >${raw(avatarInner)}<span class="ap-avatar-network"><i class="${networkIcon}"></i></span
        ></span>
        <span class="top-post-card__identity">
          <span class="top-post-card__author">${handle}</span>
          <span class="top-post-card__time">${post.publishedOn || post.date || ""}</span>
        </span>
        ${raw(renderViewOnLink(post))}
      </header>

      <div class="top-post-card__body">${raw(bodyInner)}</div>

      <div class="top-post-card__perf">
        <div class="top-post-card__stats">${raw(statsHtml)}</div>
        <div class="top-post-card__foot">${raw(heroHtml)} ${raw(ctaHtml)}</div>
      </div>
    </article>
  `;
}

/**
 * The echo row itself, shared. Two callers now — the winners flow (a picked
 * post, in the thread) and Insights' linked posts, which carry a contribution
 * to an objective instead of a view count. Same DOM, same CSS, so a post looks
 * like a post wherever it is quoted; only the stat line and the trailing action
 * differ. The chat geometry (right-aligned bubble, sharp top-right, 440px cap)
 * lives on `.top-post-echo` and is reset by the host, the way
 * `.top-posts-widget__row` already does.
 *
 * @param {object} o
 *   network / when / excerpt — the identity and the copy
 *   mediaType / image — the thumbnail; a glyph stands in when there is no image
 *   statsHtml — the one stat line, host-owned (`<b>` for what matters)
 *   actionHtml — the trailing control in the head (View on…, or a remove button)
 *   className — a host modifier on the row
 */
export function renderPostEchoRow({
  network,
  when = "",
  excerpt = "",
  mediaType = "text",
  image = null,
  statsHtml = "",
  actionHtml = "",
  className = "",
} = {}) {
  // A thumbnail always resolves: an image when there is one, otherwise the glyph
  // for what the post is. It used to draw an empty grey square for a document,
  // because only `text` had a fallback.
  const thumb = image
    ? `<span class="top-post-echo__thumb"><img src="${image}" alt="" loading="lazy" /></span>`
    : `<span class="top-post-echo__thumb top-post-echo__thumb--text"><i class="${MEDIA_GLYPH[mediaType] || MEDIA_GLYPH.text}" aria-hidden="true"></i></span>`;
  // Lead with the posting profile (brand avatar + network badge + handle) — the
  // same identity the board card shows — not a bare network label. Falls back to
  // the network label when no connected profile resolves.
  const net = (network || "").toLowerCase();
  const account = profileForNetwork(network);
  const networkIcon = NETWORK_ICON_BY_PLATFORM[net] || iconFor(network);
  const handle = account?.handle || networkLabel(network);
  const avatarInner = account?.photo
    ? `<img src="${account.photo}" alt="" />`
    : `<span class="ap-avatar-initials">${BRAND_INITIALS}</span>`;
  return html`
    <div class="ap-card top-post-echo ${className}">
      ${raw(thumb)}
      <div class="top-post-echo__body">
        <span class="top-post-echo__head">
          <span class="ap-avatar size-16 top-post-echo__avatar" aria-hidden="true"
            >${raw(avatarInner)}<span class="ap-avatar-network"><i class="${networkIcon}"></i></span
          ></span>
          <span class="top-post-echo__net">${handle}</span>
          ${when ? raw(html`<span class="top-post-echo__when">${when}</span>`) : ""} ${raw(actionHtml)}
        </span>
        <span class="top-post-echo__excerpt">${excerpt}</span>
        <span class="top-post-echo__stats">${raw(statsHtml)}</span>
      </div>
    </div>
  `;
}

const MEDIA_GLYPH = {
  text: "ap-icon-file--text",
  document: "ap-icon-file--text",
  image: "ap-icon-image",
  video: "ap-icon-file--video",
};

// ── Conversation echo ────────────────────────────────────────────────
// Compact card shown in the thread when the user picks a winner to build on
// (assistant.postTopPostPickTurn → renderTopPostPickTurn in session.js), so the
// chosen post stays visible as a real preview rather than a truncated text echo.
export function renderTopPostEcho(post) {
  if (!post) return "";
  return renderPostEchoRow({
    network: post.network,
    when: post.publishedOn,
    excerpt: post.excerpt,
    mediaType: post.mediaType,
    image: post.image,
    statsHtml: `<b class="top-post-echo__avg">${post.vsAvg}×</b> vs avg · <b>${compactNumber(post.views)}</b> views · <b>${compactNumber(post.impressions)}</b> impressions`,
    actionHtml: renderViewOnLink(post),
  });
}

// ── Inline selection widget (Add-menu flow) ─────────────────────────
// A ChatGPT-apps-style interactive card embedded in the conversation: a compact,
// multi-select list of an account's winners + a confirm CTA. Reuses the echo
// card visuals; selection lives on the widget turn (assistant.js) and re-renders
// in place. `renderTopPostsWidgetTurn` in session.js wraps this in an AI turn.

// One selectable row — the echo card inside the DS radio-button card
// (`.ap-radio-card.card`): the card renders the radio dot (::before) + the
// selected/hover border, we just supply the content. The whole row is a
// `<label>` so clicking anywhere selects the (visually-hidden) real
// `<input type=radio>`; a shared `name` (per widget `group`) makes the rows a
// native single-select group. `disabled` freezes it once the pick is confirmed.
function renderTopPostSelectRow(post, { selected = false, disabled = false, group = "" } = {}) {
  if (!post) return "";
  return html`
    <label class="ap-radio-card card top-posts-widget__row">
      <input
        type="radio"
        name="topposts-pick-${group}"
        value="${post.id}"
        data-topposts-widget-radio="${post.id}"
        ${raw(selected ? "checked" : "")}
        ${raw(disabled ? "disabled" : "")}
      />
      <div>${raw(renderTopPostEcho(post))}</div>
    </label>
  `;
}

// The widget card — header + single-select rows + a "Reuse this post" CTA.
// SINGLE-select (pick one winner, like the studio's per-card Repurpose). When
// `answered`, rows freeze and the footer drops (a static record of the pick).
// `group` scopes the radios' shared `name` to this widget so multiple widgets in
// one thread don't cross-select.
export function renderTopPostsWidget({ network, posts = [], selected = [], answered = false, group = "" } = {}) {
  const sel = new Set(selected);
  const rows = posts
    .map((p) => renderTopPostSelectRow(p, { selected: sel.has(p.id), disabled: answered, group }))
    .join("");
  const footer = answered
    ? ""
    : `<div class="top-posts-widget__foot">
        <button
          type="button"
          class="ap-button primary blue top-posts-widget__cta"
          data-topposts-widget-confirm
          ${sel.size ? "" : "disabled"}
        >
          <span>Reuse this post</span>
        </button>
      </div>`;
  return html`
    <div class="top-posts-widget${answered ? " top-posts-widget--answered" : ""}" data-topposts-widget>
      <div class="top-posts-widget__head">
        <span class="top-posts-widget__title">
          <i class="${iconFor(network)}" aria-hidden="true"></i>
          Your top ${networkLabel(network)} posts
        </span>
        <span class="top-posts-widget__hint muted">Pick one</span>
      </div>
      <div class="top-posts-widget__list" role="radiogroup" aria-label="Pick one post to repurpose">${raw(rows)}</div>
      ${raw(footer)}
    </div>
  `;
}
