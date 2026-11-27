// The Playbooks catalogue's pieces: the card, the ghost card, the empty states
// and the first-run scene (whose word-by-word text the Topic Feed and Insights
// reuse).

import { isMine, accessLabel, canEdit, canManageSharing, canDelete, canView } from "../../playbook-access.js?v=2932";
import { escapeAttr, escapeText } from "../../utils.js?v=2932";
import { brandCoverStyle, voiceSentence } from "../../brand-cover.js?v=2932";
import { renderEmptyState } from "../../components/empty-state.js?v=2932";
import { voicesToFinish } from "../../voice-parts.js?v=2932";
import { networkIcon, networkLabel, renderAvatar } from "../../social-profiles.js?v=2932";

// The brand's own mark where the analysis found a logo, its initials where it
// didn't — so the column keeps one width and one shape, and never a stretched
// or cropped lockup. A square takes the brand's square mark (its « Icon » logo)
// when there is one: a wordmark shrunk into a square can't be read.
function playbookThumb(ctx, size) {
  const logo = ctx.brandLogos?.find((l) => l.label === "Icon")?.url || ctx.brandLogo;
  const initials = String(ctx.name || "")
    .split("·")[0]
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return `
    <span class="ap-avatar square size-${size} contexts-card__thumb" aria-hidden="true">
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

// No Playbook at all: the page has to say what one IS before asking for one,
// and show it rather than list it. An example plays once: a Playbook fills in
// its four parts, I read it, and three posts on three networks come out of it.
// Then it keeps going, quietly: each part lights in turn with the words (or the
// image) it shaped in the posts, so "every draft comes from it" is something
// you watch, not a claim. The brand is a made-up café (Bramble &
// Bean), tagged Example so nobody reads it as their own. Decorative
// (aria-hidden): the title and the sentence carry everything it shows.
// `[text]{part}` in a post marks a trace of that part; the CSS lights it.
export const FIRST_RUN_BRAND = ["#6B3A22", "#C8874E", "#7A8F4E", "#F7EFE5"];
const FIRST_RUN_PARTS = [
  { id: "business", icon: "ap-icon-buildings", label: "Business", value: "Café and roaster" },
  { id: "audience", icon: "ap-icon-multiple-users", label: "Audience", value: "Regulars, brewers" },
  { id: "voice", icon: "ap-icon-megaphone", label: "Voice", value: "Warm and plain" },
  { id: "look", icon: "ap-icon-image", label: "Look" },
];
const FIRST_RUN_POSTS = [
  {
    network: "linkedin",
    text: "[Regulars]{audience}, this week's [guest roast]{business} is in: Ethiopia Guji. Bright, a little berry. [Come taste it before it's gone.]{voice}",
  },
  {
    network: "instagram",
    image: true,
    text: "[Saturday brunch]{business}, flat white on the side. [See you at 10?]{voice}",
  },
  {
    network: "facebook",
    text: "[Home brewers]{audience}: the [autumn blend]{business} is back in 250 g bags. [Grab one on your way out.]{voice}",
  },
];
// The wires, in the wires box's own pixels (144 × 360): the card into my mark,
// then my mark out to the three posts, whose centres sit at 56 / 180 / 304.
const FIRST_RUN_WIRES = [
  "M0 180 L32 180",
  "M64 180 C 110 180, 106 56, 144 56",
  "M64 180 L160 180", // the Instagram post sits 16px further right
  "M64 180 C 110 180, 106 304, 144 304",
];
const FIRST_RUN_INDEX = Object.fromEntries(FIRST_RUN_PARTS.map((p, i) => [p.id, i]));

// Word by word (each word its own --w for the typing), traces wrapped.
export function firstRunText(text) {
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
          <div class="pb-first__post-head">${renderAvatar({ photo: "assets/avatars/bramble-bean.svg", initials: "B", network: post.network })}<span>Bramble &amp; Bean</span></div>
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
  // me that's Open (the fiche, read-only) and Duplicate, the one move that turns reading into having. Open rides the
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
  // A click anywhere on the card opens the fiche.
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

  // ── The tile ────────────────────────────────────────────────────────────
  // A brand sheet. The palette cover and
  // the brand mark say whose it is, then the name, the voice as a sentence, the
  // brief; then what I know of its world (three figures); then the activity and
  // its state tags. A Playbook is an OBJECT you browse here.
  return `
    <article class="contexts-card" data-contexts-card="${ctx.id}">

      <div class="contexts-card__cover"${coverStyle}>
        ${ownerTag ? `<div class="contexts-card__tags">${ownerTag}</div>` : ""}
      </div>
      <div class="contexts-card__actions" data-contexts-card-actions>${actions}</div>

      <div class="contexts-card__body">
        <div class="contexts-card__mark">${playbookThumb(ctx, 56)}</div>
        <h3 class="contexts-card__name">
          <!-- The keyboard way in: the tile is no longer a role=button wrapping
               its own action buttons (ARIA nested interactive). A click anywhere
               on the tile still opens it (delegated on data-contexts-card). -->
          <button type="button" class="contexts-card__open" title="${escapeAttr(ctx.name)}">${escapeText(ctx.name)}</button>
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
