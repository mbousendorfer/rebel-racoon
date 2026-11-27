// A new chat's hero: the greeting, the workflow starters, and the "Fresh
// topics to review" grid (flag topicFeed). Moved out of session.js, unchanged.

import { getFeedForPlaybook } from "../../topic-feeds-store.js?v=2974";
import { getFreshTopics, countFresh } from "../../topics-store.js?v=2974";
import { getContextById, getContexts } from "../../contexts-store.js?v=2974";
import { renderTopicCard } from "../../components/topic-card.js?v=2974";
import { findTopicSource } from "../../topics-catalog.js?v=2974";
import { html, raw, escapeHtml } from "../../utils.js?v=2974";
import { getSources as getStreamSources } from "../../sources-stream.js?v=2974";
import { renderStarterCards } from "../../components/starter-card.js?v=2974";
import { isFlagOn, isNewStartOn } from "../../feature-flags.js?v=2974";
import { voicesToFinish } from "../../voice-parts.js?v=2974";
import { networkLabel } from "../../social-profiles.js?v=2974";
import { parseHashParams } from "../../url-state.js?v=2974";
import { renderAsks, renderDoors, renderNewStart, starterAttrs } from "./new-start.js?v=2974";

// Composer "Add" menu — "Connected sources" is a nested submenu (Codex-style
// "Modules d'extension ▸" flyout), not a first-level list. The flyout lists the
// connected connectors as live sources you can query in chat (logo + name →
// ask), and the only place to connect new ones — "Browse connectors" — sits at
// the very bottom of that flyout.
// ── The composer's way into the Topic Feed ─────────────────────────────────
// A flat row in the Add menu, above the connectors submenu. Not a submenu of its
// own: ADS ships no nested dropdown, and this is one destination, not a set. No
// divider before it — it sits directly under "Top performing posts" as one more
// source to pull in, not a separate group.
export function renderTopicPickerRow() {
  return `
    <button type="button" class="ap-action-dropdown-item" data-add-source="topic" role="menuitem">
      <i class="ap-icon-antenna"></i>
      <div class="ap-action-dropdown-item-text">
        <div class="ap-action-dropdown-item-label-container">
          <span class="ap-action-dropdown-item-label">Pick from the Topic Feed</span>
        </div>
      </div>
    </button>
  `;
}

// ── "Fresh topics to review" ───────────────────────────────────────────────
// The freshest to-review Topics from THIS chat's Playbook, at most six, BELOW the
// workflow starters and in the same 3-column grid.
//
// ⚠️ It was a stack of full-width rows ABOVE the starters, on the argument that
// proposals should come before verbs. Both halves were wrong in practice: six
// rows ran ~500px tall and pushed all three workflow cards off the fold, so the
// "proposal" buried the things it was supposed to precede. As a 3x2 grid of the
// SAME card the feed uses, it takes two rows instead of six and the starters stay
// visible.
//
// The card's body opens the Topic's article — reading comes before deciding — and
// `withUse` adds the verb on the card face for the reader who already knows,
// because a card sitting beside three workflow cards you click to start
// something has to be actionable the same way.
//
// NO Playbook chip per row. Every Topic here belongs to the chat's own Playbook,
// so a chip repeated identically six times, under a composer that already names
// the same Playbook, labels nothing. The section header carries the scope once,
// and only when the chat actually has a Playbook to name.
//
// The footer's total is every Topic under a week old WHATEVER its status, so it
// describes the week rather than a to-do list: triaging a row moves N down and
// leaves M where it was.
//
// Renders nothing at all when there is nothing to say, so a hero with no Topics
// is byte-for-byte the hero this app has always had.

function renderFreshTopics(session) {
  const pbId = session?.contextId || null;
  const feed = pbId ? getFeedForPlaybook(pbId) : null;
  if (!feed) return "";
  const topics = getFreshTopics(feed.id);
  if (!topics.length) return "";
  const total = countFresh(feed.id);
  const pb = getContextById(pbId);
  const scopeHref = `#/topics?pb=${encodeURIComponent(pbId)}`;

  const cards = topics
    .map((t) => renderTopicCard(t, { source: findTopicSource(t.sourceId), variant: "picker", withUse: true }))
    .join("");

  return html`
    <h2 class="empty-chat__starter-label" id="freshTopicsLabel">
      <span>Topics to review — what your listening surfaced</span>
      ${raw(pb ? html`<span class="empty-chat__topics-scope">· ${pb.name}</span>` : "")}
    </h2>
    <div class="empty-chat__topics" role="group" aria-labelledby="freshTopicsLabel">
      <div class="empty-chat__topics-grid">${raw(cards)}</div>
      <footer class="empty-chat__topics-foot">
        <span class="empty-chat__topics-count">${topics.length} of ${total} shown</span>
        <a class="ap-link standalone small" href="${raw(scopeHref)}"
          >Open Topic Feed<i class="ap-icon-arrow-right" aria-hidden="true"></i
        ></a>
      </footer>
    </div>
  `;
}

// Empty-state hero — shown inside the assistant thread region when the user
// hasn't sent a first message yet. Mirrors the handoff (Chat.jsx empty state):
// hero question + sub-line + 2x2 grid of starter cards. Cards click → prefill
// the composer textarea (handler in bindSession via [data-starter]).
//
// FIND-A4: the raw prompts in mocks.chatStarters use a `{{source}}` placeholder
// that the previous version dropped into the textarea verbatim. Resolve it at
// render time: if a source is attached we name it; otherwise we fall back to
// "your source" so the prompt still reads cleanly for first-run users.
//
// Context decision: handled entirely by the composer picker (visible
// inline inside this hero). The previous inline AI question flow
// ("Quick — which context?") was removed — the composer picker is now
// the single, always-visible context affordance.
export function renderEmptyHero(sessionId, composerMarkup = "", session = null) {
  // Flag newStart4: no Playbook yet → the page that introduces Archie, the
  // composer inside it, under the turns.
  if (isNewStartOn() && !getContexts().length) return renderNewStart(composerMarkup);
  const sources = getStreamSources(sessionId);
  const firstSource = sources.find((s) => s.status !== "Processing") || sources[0] || null;
  const sourceLabel = firstSource ? `"${firstSource.filename}"` : "your source";
  // `{{video-source}}` resolves to the first processed video source so the
  // "Extract video clips" starter reads naturally even when the first
  // overall source is a PDF.
  const firstVideo = sources.find(
    (s) => (s.kind || "").toLowerCase() === "video" && s.status === "Processed" && typeof s.durationSec === "number",
  );
  const videoLabel = firstVideo ? `"${firstVideo.filename}"` : "your video";
  // Flag newChatHero: the same wordmark + sub-line, the composer on the grey
  // pixel field of the other empty states, New Start's example requests under
  // it, then its two doors (the Playbook one only while there is none). No
  // workflows nor Topics: both went on 2026-11-27 (asked: « supprimes ça »,
  // « pareil, ça vire ça »).
  if (isFlagOn("newChatHero")) {
    return html`
      <div class="empty-chat empty-chat--rows" data-empty-chat>
        <!-- Two screens (2026-11-27, asked: « ce bloc … sur un "deuxième"
             écran … avec une discrète flèche en bas de l'écran, qui
             "scrollerait" sur un nouveau panneau, qui aurait des cards et
             expliquerait les diverses features d'Archie »): the first holds
             the composer, the requests and what's missing, the height of the
             thread; the second, below, what I can do. -->
        <section class="empty-chat__screen">
          ${raw(playbookReadyBlock(session))}
          <span class="empty-chat__logo" role="img" aria-label="Archie">
            <img class="empty-chat__logo-word empty-chat__logo-word--a" src="assets/logos/archie-wordmark.svg" alt="" />
            <img class="empty-chat__logo-mono" src="assets/logos/archie-mono.svg" alt="" />
            <img
              class="empty-chat__logo-word empty-chat__logo-word--b"
              src="assets/logos/archie-alt-wordmark.svg"
              alt=""
            />
          </span>
          <div class="empty-chat__sub">${heroSub()}</div>
          <div class="empty-chat__lead">
            <!-- The other empty states' grey pixel field, masked into the
                 ground, on both sides of the composer. -->
            <span class="empty-chat__dots" aria-hidden="true"></span>
            ${raw(composerMarkup)}
          </div>
          ${raw(renderAsks("empty-chat__asks"))} ${raw(heroWarning(session))}
          <button type="button" class="empty-chat__more" data-hero-more>
            <span class="empty-chat__more-label">Discover Archie</span>
            <i class="ap-icon-chevron-down" aria-hidden="true"></i>
          </button>
        </section>
        ${raw(renderFeatures())}
      </div>
    `;
  }
  // The three cards come from components/starter-card.js.
  const cards = renderStarterCards({ sourceLabel, videoLabel });
  return html`
    <div class="empty-chat" data-empty-chat>
      ${raw(playbookReadyBlock(session))}
      <span class="empty-chat__logo" role="img" aria-label="Archie">
        <img class="empty-chat__logo-word empty-chat__logo-word--a" src="assets/logos/archie-wordmark.svg" alt="" />
        <img class="empty-chat__logo-mono" src="assets/logos/archie-mono.svg" alt="" />
        <img class="empty-chat__logo-word empty-chat__logo-word--b" src="assets/logos/archie-alt-wordmark.svg" alt="" />
      </span>
      <div class="empty-chat__sub">${heroSub()}</div>
      ${raw(composerMarkup)}
      <!-- Starters first, proposals second. The other way round was tried on the
           argument that "what should I post today?" is the question someone
           opening a blank chat actually has — true, but six full-width Topic rows
           pushed all three workflow cards below the fold, so the proposal buried
           the features it was meant to introduce. Both are card grids now, so the
           Topics cost two rows instead of six and nothing is hidden. -->
      <h2 class="empty-chat__starter-label" id="starterGridLabel">Turn a source, a video, or a top post into drafts</h2>
      <div class="starter-grid" role="group" aria-labelledby="starterGridLabel">${raw(cards)}</div>
      ${raw(finishVoicesRow(session))} ${raw(renderFreshTopics(session))}
    </div>
  `;
}

// A nudge among the starters while the chat's Playbook has network voices to
// finish (2026-10-29, asked: « quand des voice sont incomplètes … un bloc sur la
// home avec un nudge », then « Un starter de plus »). It goes when they're all
// done; it opens the Playbook's Voice tab on the first one.
// The hero's second screen: what I can do, one card per feature, in the clips
// door's shape (a stage that shows it, a title, a line, the way in). Each way
// in is the feature's own: a starter run in this chat, or its page.
function renderFeatures() {
  const card = ({ attrs, stage, title, desc, go }) => `
    <button type="button" class="ns-door hero-feature" ${attrs}>
      <span class="ns-door__stage hero-feature__stage" aria-hidden="true">${stage}</span>
      <span class="ns-door__title">${title}</span>
      <span class="ns-door__desc">${desc}</span>
      <span class="ap-link standalone ns-door__go">${go}<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
    </button>`;
  const sheet = (icon, lines = 3) =>
    `<span class="hero-feature__sheet"><i class="${icon}"></i>${"<b></b>".repeat(lines)}</span>`;
  const cards = [
    card({
      attrs: starterAttrs("open-batch"),
      stage: `<span class="hero-feature__file"><i class="ap-icon-file--pdf"></i>Q3 report.pdf</span>
        <i class="ap-icon-arrow-right hero-feature__arrow"></i>
        <span class="hero-feature__stack">${sheet("ap-icon-linkedin-official")}${sheet("ap-icon-x-official")}${sheet("ap-icon-instagram-official")}</span>`,
      title: "Batch from a source",
      desc: "Give me an article, a PDF or a page. I'll pull the strongest ideas and draft a set of posts across your networks.",
      go: "Try it with a source",
    }),
    renderDoors({ brand: false })
      .replace(/^\s*<div class="ns-doors">/, "")
      .replace(/<\/div>\s*$/, ""),
    card({
      attrs: starterAttrs("open-top-posts"),
      stage: `<span class="hero-feature__post">${sheet("ap-icon-linkedin-official", 2)}<span class="ap-status green no-dot">Top post · 1.2k reactions</span></span>
        <i class="ap-icon-arrow-right hero-feature__arrow"></i>
        <span class="hero-feature__stack">${sheet("ap-icon-linkedin-official")}${sheet("ap-icon-instagram-official")}</span>`,
      title: "Repurpose a top post",
      desc: "Pick one of your best-performing posts. I'll find what made it work and turn it into fresh drafts.",
      go: "Pick a top post",
    }),
    card({
      attrs: `data-hero-feature-href="#/topics"`,
      stage: `<span class="hero-feature__topics">
          <span class="hero-feature__topic"><span class="ap-status orange no-dot">Trending</span><b></b><b></b></span>
          <span class="hero-feature__topic"><span class="ap-status grey no-dot">Competitors</span><b></b><b></b></span>
        </span>`,
      title: "Find what to post about",
      desc: "I follow your industry, your competitors and the people you watch, and bring you topics worth a post.",
      go: "Open Topic Feed",
    }),
  ].join("");
  return `
    <section class="empty-chat__features" id="heroFeatures" aria-labelledby="heroFeaturesTitle">
      <button type="button" class="empty-chat__more empty-chat__more--up" data-hero-top>
        <i class="ap-icon-chevron-up" aria-hidden="true"></i>
        <span class="empty-chat__more-label">Back to the chat</span>
      </button>
      <h2 class="empty-chat__features-title" id="heroFeaturesTitle">What I can do</h2>
      <p class="empty-chat__features-lede">Pick one to start, or just tell me what you need.</p>
      <div class="ns-doors hero-features">${cards}</div>
    </section>`;
}

// What's missing before my drafts can sound like the Brand, in the hero (flag
// newChatHero): no Playbook yet, or networks still on the default voice. A
// warning, not a use case (asked 2026-11-27: « cette boite, elle ressemble
// actuellement à un use case, ça a la même tête que "faire un clip" … comme un
// warning. Là, la landing est vraiment bruyante »): one slim row, a still
// picture of a post marked with the warning glyph, what's missing in a line,
// and the way to fix it — the conversation in this chat. It replaced a door
// with an animated stage, the clips door's twin.
function heroWarning(session) {
  const ctx = session?.contextId ? getContextById(session.contextId) : null;
  if (!getContexts().length) {
    return warningRow({
      attrs: `data-starter="create-playbook" data-starter-action="create-playbook" data-starter-prompt="Help me create my Playbook"`,
      title: "No Playbook created yet",
      text: "My posts will sound generic until I learn your Brand: your voice, your audience, your look.",
      go: "Create my Playbook",
    });
  }
  const nets = voicesToFinish(ctx);
  if (!nets.length) return "";
  const names = nets.map(networkLabel);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return warningRow({
    attrs: `data-starter="finish-voices" data-starter-action="finish-voices" data-starter-prompt="Help me finish my voices" data-voices-ctx="${escapeHtml(ctx.id)}" data-voices-nets="${escapeHtml(nets.join(","))}"`,
    title: "Finish your voices",
    text: `${list} still ${nets.length === 1 ? "uses" : "use"} your default voice, so ${nets.length === 1 ? "its" : "their"} drafts may miss what works there.`,
    go: nets.length === 1 ? "Add its voice" : "Add their voices",
  });
}

function warningRow({ attrs, title, text, go }) {
  return `
    <button type="button" class="hero-warning" ${attrs}>
      <span class="hero-warning__art" aria-hidden="true">
        <span class="hero-warning__post"><b></b><b></b><b></b></span>
        <i class="ap-icon-warning_fill hero-warning__badge"></i>
      </span>
      <span class="hero-warning__text">
        <span class="hero-warning__title">${escapeHtml(title)}</span>
        <span class="hero-warning__desc">${escapeHtml(text)}</span>
      </span>
      <span class="ap-link standalone hero-warning__go">${escapeHtml(go)}<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
    </button>`;
}

function finishVoicesRow(session) {
  const ctx = session?.contextId ? getContextById(session.contextId) : null;
  const nets = voicesToFinish(ctx);
  if (!nets.length) return "";
  // Says what it costs (asked: « expliquer que la qualité de génération des
  // drafts pour ce network ne sera pas terrible du coup »), naming the networks.
  const names = nets.map(networkLabel);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const desc = `${list} still ${nets.length === 1 ? "uses" : "use"} your default voice, so ${nets.length === 1 ? "its" : "their"} drafts may miss what works there.`;
  // A DS warning infobox (asked: « est-ce que ça ne devrait pas être une
  // infobox tout simplement ? ») — the same one the Playbooks catalogue shows,
  // its action the DS infobox's own button (stroked grey, as <ap-infobox>
  // renders buttonLabel). A custom card was tried first.
  return `
    <div class="ap-infobox warning has-title empty-chat__voices" role="status">
      <i class="ap-icon-warning_fill" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">Finish your voices</span>
          <span class="ap-infobox-message">${desc}</span>
        </div>
        <button type="button" class="ap-button stroked grey" data-finish-voices="${ctx.id}" data-finish-voices-net="${nets[0]}">
          <span>${nets.length === 1 ? "Add its voice" : "Add their voices"}</span>
        </button>
      </div>
    </div>`;
}

// The first chat after the run (`?welcome=1`, set by its « Draft my first
// post »): at the very top, the Playbook is ready and the first step (2026-10-29,
// asked: « un genre de bloc d'onboarding … tout en haut de la conversation »).
// The hero goes with the first message, the block with it.
function playbookReadyBlock(session) {
  if (parseHashParams().get("welcome") !== "1") return "";
  const ctx = session?.contextId ? getContextById(session.contextId) : null;
  if (!ctx) return "";
  // A DS infobox, not a card (asked: « celui du haut devrait peut-être être une
  // infobox »): it's news, the cards below are things to do.
  return `
    <div class="ap-infobox success has-title empty-chat__ready" role="status">
      <i class="ap-icon-rounded-check_fill" aria-hidden="true"></i>
      <div class="ap-infobox-content">
        <div class="ap-infobox-texts">
          <span class="ap-infobox-title">Your Playbook is ready</span>
          <span class="ap-infobox-message">Tell me what to post, or drop a link or a file. I'll draft it in your voice.</span>
          <button type="button" class="ap-link" data-open-playbook="${ctx.id}">Open my Playbook</button>
        </div>
      </div>
    </div>`;
}

function heroSub() {
  return "Drop a source and I'll turn it into drafts ready to schedule, all in this chat.";
}
