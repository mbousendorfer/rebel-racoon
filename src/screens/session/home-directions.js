// A new chat's home, six directions (2026-11-02, the sixth 2026-11-03), each behind its own flag so
// they can be compared in the running app. Asked: « la home page permette …
// de comprendre ce qui existe dans le produit … et de rapidement commencer à
// travailler », then five solutions from what Mobbin shows AI tools doing.
//
//   homeOneInput   1 · one input that takes anything, the starting points beside it (Descript)
//   homeModes      2 · four modes fused to the input, each with its own panel (Gamma)
//   homeGallery    3 · a gallery of outcomes, each tile a door (VEED)
//   homePicks      4 · four posts I can write today, from your own material (Obvious)
//   homeShowcase   5 · what you give on the left, the before / after on a stage (Runway)
//   homePrompts    6 · words only: flow chips, each opening its example requests (Copilot)
//   homePromptList 7 · words only: one example request per flow, in a list (Sana)
//   homeDrawer     8 · the requests of 6 in a drawer tucked under the box (Notion)
//
// The first flag ON in that order wins; all OFF = the hero as before.
//
// Every door is an EXISTING hook, so session.js runs the flow it always ran:
// `data-starter*` (batch / clips / top posts), `data-topic-use` / `-read`,
// `data-add-source`. The composer is the real one, passed in. What is local to a
// direction — switching a mode, the stage, a clip playing on hover — lives in
// <archie-home>, which wires itself (the same way <archie-pixels> does), so
// session.js gains no listener.
//
// The media is the product's own: the seeded podcast, cropped to each speaker
// the way the Clips space frames it; the top posts with their images and score;
// the Topic Feed's fresh Topics.

import { isFlagOn } from "../../feature-flags.js?v=2761";
import { chatStarters } from "../../mocks.js?v=2761";
import { getVideos, getVideo, exampleVideo } from "../../videos-store.js?v=2761";
import { getTopPosts } from "../../top-posts-store.js?v=2761";
import { getFeedForPlaybook } from "../../topic-feeds-store.js?v=2761";
import { getFreshTopics, countFresh } from "../../topics-store.js?v=2761";
import { findTopicSource } from "../../topics-catalog.js?v=2761";
import { getContextById } from "../../contexts-store.js?v=2761";
import { voicesToFinish, networkVoiceOn } from "../../voice-parts.js?v=2761";
import { networkLabel, networkIcon } from "../../social-profiles.js?v=2761";
import { isWorkspaceMode } from "../../active-playbook.js?v=2761";
import { escapeHtml, formatClock } from "../../utils.js?v=2761";
import "../../archie-pixels.js?v=2761";

const DIRECTIONS = [
  ["homeOneInput", oneInput],
  ["homeModes", modes],
  ["homeGallery", gallery],
  ["homePicks", picks],
  ["homeShowcase", showcase],
  ["homePrompts", prompts],
  ["homePromptList", promptList],
  ["homeDrawer", drawer],
];

/** The render function of the direction whose flag is ON, or null. */
export function activeHomeDirection() {
  const hit = DIRECTIONS.find(([flag]) => isFlagOn(flag));
  if (!hit) return null;
  return (args) => {
    // The drafts shown are the brand's own: its name from the chat's Playbook.
    const pb = args.session?.contextId ? getContextById(args.session.contextId) : null;
    brand = (pb?.name || "Acme").split(" · ")[0];
    return hit[1](args);
  };
}

// ── Shared pieces ───────────────────────────────────────────────────────────

const esc = escapeHtml;

const WORDMARK = `
  <span class="nch__mark" role="img" aria-label="Archie">
    <img src="assets/logos/archie-wordmark.svg" alt="" />
  </span>`;

// The hooks session.js reads to run a workflow starter, by its action.
// `text` replaces the starter's own prompt (an example request says it its way).
function starterAttrs(action, text) {
  const s = chatStarters.find((x) => x.action === action);
  if (!s) return "";
  const prompt = (text || s.prompt || "")
    .replace(/\{\{source\}\}/g, "your source")
    .replace(/\{\{video-source\}\}/g, "your video");
  return `data-starter="${s.id}" data-starter-action="${action}" data-starter-prompt="${esc(prompt)}"`;
}

// What each starting point is, in one place: the tone of its tile, its icon,
// what it does in one line, and what the composer says while it is chosen.
const KINDS = {
  source: {
    tone: "src",
    icon: "ap-icon-file--text",
    name: "A doc or a link",
    does: "I find the ideas, then draft the posts",
    hint: "Paste a link or drop a file. I'll find the ideas and draft the posts.",
    go: "Find ideas",
    door: () => ({ attrs: starterAttrs("open-batch") }),
  },
  video: {
    tone: "clip",
    icon: "ap-icon-video",
    name: "A video",
    does: "I cut it into vertical clips",
    hint: "Drop a video or paste a YouTube link. I'll cut it into clips.",
    go: "Get clips",
    door: () => ({ attrs: starterAttrs("open-video-clips") }),
  },
  top: {
    tone: "top",
    icon: "ap-icon-line-graph",
    name: "A post that worked",
    does: "I write new ones on its pattern",
    hint: "Tell me which post did well, or let me show you your best ones.",
    go: "Write from this post",
    door: () => ({ attrs: `data-add-source="top-posts"` }),
  },
  topic: {
    tone: "topic",
    icon: "ap-icon-megaphone",
    name: "A Topic",
    does: "I give you your take on it",
    hint: "Pick a Topic from this week, or tell me what to react to.",
    go: "Draft my take",
    door: () => ({ attrs: `data-add-source="topic"` }),
  },
};

const tile = (k, size = "") => `
  <span class="nch-tile nch-tone--${KINDS[k].tone}${size ? ` nch-tile--${size}` : ""}" aria-hidden="true">
    <i class="${KINDS[k].icon}"></i>
  </span>`;

// ── Doors: each one opens ITS object ────────────────────────────────────────
// A card that shows a post, a video or a clip opens that post, that video, that
// clip — never a generic flow that asks for it again. `{ href }` renders an
// <a>, `{ attrs }` a <button> carrying a hook session.js already reads.
const clipsOn = () => isFlagOn("clipsSpace");
const inLibrary = (video) => !!getVideo(video.id);

const DOORS = {
  // The Clips space has the video (flag clipsSpace): open its project / that
  // clip's editor. Otherwise, or for the new user's example: the video starter.
  video: (video) =>
    clipsOn() && inLibrary(video)
      ? { href: `#/clips/${encodeURIComponent(video.id)}`, verb: "Open in Clips" }
      : { ...KINDS.video.door(), verb: "Cut the clips" },
  clip: (video, clip) =>
    clipsOn() && inLibrary(video)
      ? {
          href: `#/clips/${encodeURIComponent(video.id)}/edit/${encodeURIComponent(clip.id)}`,
          verb: "Edit this clip",
        }
      : { ...KINDS.video.door(), verb: "Cut the clips" },
  // The winners board's own hook: echo this post, then straight to the
  // profiles step (startRepurposeFlow).
  post: (p) => ({ attrs: `data-top-post-repurpose="${esc(p.id)}"`, verb: "Write from this post" }),
  topic: (t) => ({ attrs: `data-topic-use="${esc(t.id)}"`, verb: "Use in chat" }),
  fill: (text) => ({ attrs: `data-nch-fill="${esc(text)}"`, verb: "Use this request", icon: "ap-icon-pen" }),
  images: (ctx) => ({
    attrs: ctx ? `data-open-playbook="${ctx.id}" data-open-playbook-tab="images"` : "",
    verb: "Open image settings",
  }),
  voice: (ctx, net) => ({
    attrs: `data-finish-voices="${ctx.id}" data-finish-voices-net="${net}"`,
    verb: "Add its voice",
  }),
  source: () => ({ ...KINDS.source.door(), verb: "Add a file or a link" }),
};

const verb = (d) =>
  `<span class="nch-verb">${d.icon ? `<i class="${d.icon}" aria-hidden="true"></i>` : ""}${esc(d.verb)}<i class="ap-icon-arrow-right nch-verb__arrow" aria-hidden="true"></i></span>`;

// One clickable card. `inner` is its body; the verb closes it.
const doorEl = (cls, d, inner) =>
  d.href
    ? `<a class="${cls}" href="${d.href}">${inner}${verb(d)}</a>`
    : `<button type="button" class="${cls}" ${d.attrs || ""}>${inner}${verb(d)}</button>`;

// The seeded podcast (or the Clips space's example for a new user), and three
// of its clips. Each speaker is framed the way the Clips space frames them: the
// left or the right half of the dual stack, cropped to 9:16.
function footage(session) {
  const v = getVideos(session?.contextId)[0] || getVideos()[0] || exampleVideo();
  const clips = (v.clips || []).slice(0, 3);
  return { video: v, clips };
}

// A 16:9 source cropped to 9:16 shows 31.6% of its width; object-position puts
// that window on the speaker's centre (25% or 75% of the frame).
const SPEAKER = ["13%", "87%"];

// A still until you point at it; the play mark says it moves, and goes while it
// does (data-playing, set by <archie-home> on the media's own events).
function clipMedia(video, clip, i, { autoplay = false } = {}) {
  const t = `#t=${(clip.startMs / 1000).toFixed(1)},${(clip.endMs / 1000).toFixed(1)}`;
  return `
    <span class="nch-clip" data-nch-play>
      <video class="nch-clip__video" src="${esc(video.url)}${t}" muted playsinline loop preload="metadata"
        ${autoplay ? "data-nch-autoplay" : ""} style="object-position:${SPEAKER[i % 2]} 50%" aria-hidden="true"></video>
      ${autoplay ? "" : `<span class="nch-clip__play" aria-hidden="true"><i class="ap-icon-play"></i></span>`}
      <span class="nch-clip__len">${Math.round((clip.endMs - clip.startMs) / 1000)}s</span>
    </span>`;
}

function videoMedia(video, { len = false } = {}) {
  const t = `#t=${((video.posterMs || 0) / 1000).toFixed(1)}`;
  const s = Math.round((video.durationMs || 0) / 1000);
  return `
    <span class="nch-video">
      <video class="nch-video__media" src="${esc(video.url)}${t}" muted playsinline preload="metadata" aria-hidden="true"></video>
      ${len && s ? `<span class="nch-clip__len">${formatClock(s)}</span>` : ""}
    </span>`;
}

function topPostMini(p, { withImage = true } = {}) {
  return `
    <span class="nch-post">
      <span class="nch-post__head"><i class="${networkIcon(p.network)}" aria-hidden="true"></i><span>${esc(networkLabel(p.network))}, ${esc(p.publishedAt || "")}</span></span>
      <span class="nch-post__text">${esc(p.excerpt)}</span>
      ${withImage && p.image ? `<img class="nch-post__img" src="${esc(p.image)}" alt="" loading="lazy" />` : ""}
      <span class="nch-score">${p.vsAvg}× your average engagement</span>
    </span>`;
}

function topicMini(t) {
  const src = findTopicSource(t.sourceId);
  return `
    <span class="nch-topic">
      <span class="nch-topic__meta">${src ? `<i class="${src.icon}" aria-hidden="true"></i><span>${esc(src.name)}</span>` : ""}${t.isTrending ? `<span class="nch-trend">Trending</span>` : ""}</span>
      <span class="nch-topic__title">${esc(t.headline || t.title || "")}</span>
    </span>`;
}

function freshTopics(session, n = 3) {
  const feed = session?.contextId ? getFeedForPlaybook(session.contextId) : null;
  if (!feed) return { topics: [], total: 0, href: "#/topics" };
  const href = isWorkspaceMode() ? "#/topics" : `#/topics?pb=${encodeURIComponent(session.contextId)}`;
  return { topics: getFreshTopics(feed.id).slice(0, n), total: countFresh(feed.id), href };
}

const bestPosts = (n) =>
  getTopPosts()
    .slice()
    .sort((a, b) => (b.vsAvg || 0) - (a.vsAvg || 0))
    .slice(0, n);

// What a draft looks like coming out: the brand's own posts, real sentences,
// fanned like cards dealt on the table. They spread when you hover the door
// that holds them. `texts` overrides the default sentences.
const SAMPLE = {
  linkedin: "We spent Q2 planning a launch nobody asked for. Here's what the offsite taught us about listening first.",
  x: "We shipped less this quarter, on purpose. What we cut, and why it was the best call we made:",
  instagram: "Behind the scenes of our Q2 offsite, in five photos. Swipe for the whiteboard that changed our roadmap.",
};
let brand = "Acme";

const draftStack = (nets = ["linkedin", "x", "instagram"], texts = []) => `
  <span class="nch-fan" aria-hidden="true">${nets
    .map(
      (n, i) => `
    <span class="nch-mini">
      <span class="nch-mini__head"><span class="nch-mini__av">${esc(brand.charAt(0))}</span><span class="nch-mini__name">${esc(brand)}</span><i class="${networkIcon(n)}"></i></span>
      <span class="nch-mini__text">${esc(texts[i] || SAMPLE[n] || SAMPLE.linkedin)}</span>
    </span>`,
    )
    .join("")}</span>`;

const fileToDrafts = (name = "notes.pdf") =>
  `<span class="nch-flow"><span class="nch-file"><i class="ap-icon-file--pdf" aria-hidden="true"></i><span>${esc(name)}</span></span>${draftStack()}</span>`;

const brandImages = `<span class="nch-brand" aria-hidden="true"><span class="nch-brand__img nch-brand__img--a">Listen first, launch second</span><span class="nch-brand__img nch-brand__img--b">18% more activation</span></span>`;

// The networks and where each one's voice stands (flag voicePerNetwork).
const voiceRows = (voices) =>
  `<span class="nch-voices">${["linkedin", "x", "instagram"]
    .map(
      (n) =>
        `<span class="nch-voice"><i class="${networkIcon(n)}" aria-hidden="true"></i><span>${voices.includes(n) ? "Follows your default voice" : "A voice of its own"}</span></span>`,
    )
    .join("")}</span>`;

function shell(variant, body) {
  return `
    <archie-home class="empty-chat empty-chat--rows nch nch--${variant}" data-empty-chat>
      ${body}
    </archie-home>`;
}

// The real composer with the brand's pixel halo behind it, as on today's hero.
const lead = (composer) => `
  <div class="empty-chat__lead nch__lead">
    <archie-pixels class="empty-chat__pixels" data-quiet data-ripple aria-hidden="true"></archie-pixels>
    ${composer}
  </div>`;

const ctxOf = (session) => (session?.contextId ? getContextById(session.contextId) : null);

// ── 1 · One input, the starting points beside it ────────────────────────────
// The box takes a file, a video, a link or a sentence. The four chips are the
// starting points; hovering one says in the box what it will do, a click starts
// it. Under them, three things a newcomer would not guess, each shown working.
function oneInput({ composer, session }) {
  const { video, clips } = footage(session);
  const ctx = ctxOf(session);
  const { topics, href } = freshTopics(session, 1);
  const chip = (k) => `
    <button type="button" class="nch-chip" ${KINDS[k].door().attrs} data-nch-hint="${esc(KINDS[k].hint)}">
      ${tile(k, "sm")}<span>${esc(KINDS[k].name)}</span>
    </button>`;
  const card = (d, vis, name, line, well = false) =>
    doorEl(
      "nch-can__card",
      d,
      `<span class="nch-can__vis${well ? " nch-can__vis--well" : ""}">${vis}</span>
       <span class="nch-can__say"><span class="nch-can__name">${name}</span><span class="nch-can__line">${line}</span></span>`,
    );
  const voices = voicesToFinish(ctx);
  // The third card: the voice per network when that feature is on, else the
  // brand's images — never a feature the app doesn't have.
  const third =
    networkVoiceOn() && ctx
      ? card(
          voices.length
            ? DOORS.voice(ctx, voices[0])
            : { attrs: `data-open-playbook="${ctx.id}" data-open-playbook-tab="voice"`, verb: "Open my voices" },
          voiceRows(voices),
          "A voice for each network",
          "LinkedIn and X don't sound the same. Your drafts won't either.",
        )
      : card(DOORS.images(ctx), brandImages, "Images in your brand", "Your colours and fonts, made with each draft.");
  return shell(
    "one",
    `
    ${WORDMARK}
    <h1 class="nch__title">What are we posting today?</h1>
    ${lead(composer)}
    <div class="nch-chips" role="group" aria-label="Start from">${["source", "video", "top", "topic"].map(chip).join("")}</div>
    <section class="nch-can" aria-labelledby="nchCan">
      <h2 class="nch__h" id="nchCan">What else I can do</h2>
      <div class="nch-can__grid">
        ${card(
          DOORS.video(video),
          clips
            .slice(0, 2)
            .map((c, i) => clipMedia(video, c, i))
            .join(""),
          "Clips from one video",
          `One video, ${video.clips.length} vertical clips with subtitles.`,
          true,
        )}
        ${
          topics[0]
            ? card(
                { href, verb: "Open Topic Feed" },
                topicMini(topics[0]),
                "What your market talks about",
                "I follow your competitors and bring back the week's Topics.",
              )
            : card(
                DOORS.source(),
                fileToDrafts(),
                "Posts from a doc or a link",
                "The ideas first, then a draft for each network.",
              )
        }
        ${third}
      </div>
    </section>`,
  );
}

// ── 2 · Modes on the input ──────────────────────────────────────────────────
// Four DS tabs over the composer. A mode changes what the box asks for and what
// lies under it: requests to try, your video's clips, your best posts, this
// week's Topics. Every item says what a click does, and does it to that item.
function modes({ composer, session }) {
  const { video, clips } = footage(session);
  const posts = bestPosts(3);
  const { topics, total, href } = freshTopics(session, 3);
  const tab = (k, i) => `
    <button type="button" class="ap-tabs-tab nch-mode${i === 0 ? " active" : ""}" role="tab" id="nchMode-${k}" aria-controls="nchPane-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-nch-mode="${k}" data-nch-hint="${esc(KINDS[k].hint)}">
      <i class="${KINDS[k].icon}" aria-hidden="true"></i><span>${esc(KINDS[k].name)}</span>
    </button>`;
  const pane = (k, i, head, items, more = "") => `
    <section class="nch-pane" role="tabpanel" id="nchPane-${k}" aria-labelledby="nchMode-${k}" ${i ? "hidden" : ""} data-nch-pane="${k}">
      <header class="nch-pane__head"><p class="nch-pane__lede">${head}</p>${more}</header>
      <div class="nch-pane__grid">${items}</div>
    </section>`;
  // An item is its picture (in a well) and its name, or an object card as is.
  const item = (d, body) => doorEl("nch-item", d, body);
  const pictured = (vis, name, { well = false } = {}) =>
    `<span class="nch-item__vis${well ? " nch-item__vis--well" : ""}">${vis}</span><span class="nch-item__name">${esc(name)}</span>`;
  const empty = (text, button = "") => `<div class="nch-empty"><p>${text}</p>${button}</div>`;
  const REQUESTS = [
    ["Turn our offsite notes into a week of posts", draftStack()],
    [
      "3 LinkedIn posts from our latest blog article",
      draftStack(
        ["linkedin", "linkedin", "linkedin"],
        [
          "Most onboarding checklists ask for too much, too early. We cut ours to three steps.",
          "Activation went up 18% the week we deleted half our setup flow.",
          "The best onboarding is the one your users never notice. A short read from our blog.",
        ],
      ),
    ],
    [
      "A thread for X from the keynote slides",
      draftStack(
        ["x", "x", "x"],
        [
          "Our keynote in one thread. 1/ Teams don't need more tools, they need fewer handoffs.",
          "2/ Every handoff costs a day. We counted 14 in a single launch.",
          "3/ So we rebuilt the launch around one owner per post. Here's how.",
        ],
      ),
    ],
  ];
  const panes = [
    pane(
      "source",
      0,
      "Try one of these requests, or paste your own link.",
      REQUESTS.map(([text, vis]) => item(DOORS.fill(text), pictured(vis, text))).join(""),
      `<button type="button" class="ap-button stroked grey" ${KINDS.source.door().attrs}><i class="ap-icon-plus"></i><span>Add a file or a link</span></button>`,
    ),
    pane(
      "video",
      1,
      `Your latest video: ${video.clips.length} clips ready to cut.`,
      clips
        .map((c, i) => item(DOORS.clip(video, c), pictured(clipMedia(video, c, i), c.title, { well: true })))
        .join(""),
      `<button type="button" class="ap-button stroked grey" ${KINDS.video.door().attrs}><i class="ap-icon-upload"></i><span>Add a video</span></button>`,
    ),
    pane(
      "top",
      2,
      posts.length
        ? "Your best posts. Pick one and I'll write new ones on its pattern."
        : "Your best posts will show up here.",
      posts.length
        ? posts.map((p) => item(DOORS.post(p), topPostMini(p))).join("")
        : empty(
            "Once your posts start performing, I'll surface the best ones so you can write more like them.",
            `<button type="button" class="ap-button stroked grey" ${KINDS.top.door().attrs}><i class="ap-icon-line-graph"></i><span>Find my top posts</span></button>`,
          ),
    ),
    pane(
      "topic",
      3,
      topics.length
        ? `${topics.length} of ${total} Topics from this week's listening.`
        : "Nothing new from your listening this week.",
      topics.length
        ? topics.map((t) => item(DOORS.topic(t), topicMini(t))).join("")
        : empty("I'll bring back what your competitors and favourite voices post about.", ""),
      `<a class="ap-link standalone small" href="${href}">Open Topic Feed<i class="ap-icon-arrow-right" aria-hidden="true"></i></a>`,
    ),
  ].join("");

  return shell(
    "modes",
    `
    ${WORDMARK}
    <h1 class="nch__title">What are we starting from?</h1>
    <div class="nch-modes">
      <div class="ap-tabs nch-modes__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="Start from">${["source", "video", "top", "topic"].map(tab).join("")}</div></div>
      ${lead(composer)}
    </div>
    ${panes}`,
  );
}

// ── 3 · A gallery of outcomes ───────────────────────────────────────────────
// Tiles, each a picture of what comes back and a door into it; six when the
// Playbook has everything, four otherwise, so the grid never has a hole.
function gallery({ composer, session }) {
  const { video, clips } = footage(session);
  const post = bestPosts(1)[0];
  const topic = freshTopics(session, 1).topics[0];
  const ctx = ctxOf(session);
  const t = (d, vis, name, line, mod = "") =>
    doorEl(
      `nch-tile-card${mod}`,
      d,
      `<span class="nch-tile-card__vis">${vis}</span>
       <span class="nch-tile-card__say"><span class="nch-tile-card__name">${name}</span><span class="nch-tile-card__line">${line}</span></span>`,
    );
  const all = [
    t(DOORS.source(), fileToDrafts(), "Posts from a doc or a link", "The ideas first, then a draft for each network"),
    t(
      DOORS.video(video),
      clips.map((c, i) => clipMedia(video, c, i)).join(""),
      "Clips from a video",
      "Vertical, framed on the speaker, with subtitles",
      " nch-tile-card--well",
    ),
    post &&
      t(
        DOORS.post(post),
        topPostMini(post, { withImage: false }),
        "New posts from your best one",
        "Same pattern, a new angle",
      ),
    topic && t(DOORS.topic(topic), topicMini(topic), "Your take on a Topic", "What your market talks about this week"),
    t(DOORS.images(ctx), brandImages, "Images in your brand", "Your colours and fonts, made with each draft"),
    t(
      DOORS.fill("Plan a week of posts around our next launch"),
      `<span class="nch-week" aria-hidden="true">${["Mon", "Tue", "Wed", "Thu", "Fri"]
        .map((d, i) => `<span class="nch-week__day${i % 2 ? "" : " is-on"}"><small>${d}</small><i></i></span>`)
        .join("")}</span>`,
      "A week of posts",
      "Planned around a launch or an event",
    ),
  ].filter(Boolean);
  const tiles = all.slice(0, all.length >= 6 ? 6 : 4);
  return shell(
    "gallery",
    `
    ${WORDMARK}
    <h1 class="nch__title">What do you want to make?</h1>
    <div class="nch-gallery" style="--nch-cols:${tiles.length >= 6 ? 3 : 2}" role="group" aria-label="What I can make">${tiles.join("")}</div>
    ${lead(composer)}`,
  );
}

// ── 4 · Posts I can write today ─────────────────────────────────────────────
// Archie starts: four posts it can already write from what the Playbook has,
// one per feature, so the product is learnt by using it. Built on the Topic
// Feed and the user's own material only; four whatever the Playbook holds.
function picks({ composer, session }) {
  const { video, clips } = footage(session);
  const post = bestPosts(1)[0];
  const topic = freshTopics(session, 1).topics[0];
  const ctx = ctxOf(session);
  const voices = voicesToFinish(ctx);
  const card = (k, from, vis, title, d) =>
    doorEl(
      "nch-pick",
      d,
      `<span class="nch-pick__from">${tile(k, "sm")}<span>${from}</span></span>
       <span class="nch-pick__vis">${vis}</span>
       <span class="nch-pick__title">${title}</span>`,
    );
  const cards = [
    clips[0] &&
      card(
        "video",
        inLibrary(video) ? "From your latest video" : "From a video",
        `<span class="nch-pick__well">${clips
          .slice(0, 2)
          .map((c, i) => clipMedia(video, c, i))
          .join("")}</span>`,
        `${video.clips.length} clips from your latest video`,
        DOORS.video(video),
      ),
    post &&
      card(
        "top",
        "From your best post",
        topPostMini(post, { withImage: false }),
        "A follow-up on the same pattern",
        DOORS.post(post),
      ),
    topic &&
      card("topic", "Trending this week", topicMini(topic), "Your take on it, in your voice", DOORS.topic(topic)),
    voices.length &&
      card(
        "source",
        "From your Playbook",
        voiceRows(voices),
        `Give ${esc(networkLabel(voices[0]))} its own voice`,
        DOORS.voice(ctx, voices[0]),
      ),
    card("source", "From your brand", brandImages, "An image for your next post", DOORS.images(ctx)),
    card("source", "From a doc or a link", fileToDrafts(), "A week of posts from your notes", DOORS.source()),
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join("");
  return shell(
    "picks",
    `
    ${WORDMARK}
    <h1 class="nch__title">Posts I can write for you today</h1>
    <p class="nch__sub">From your videos, your best posts and this week's Topics. Pick one, or start your own.</p>
    <div class="nch-picks" role="group" aria-label="Ready to write">${cards}</div>
    ${lead(composer)}`,
  );
}

// ── 5 · Show and do ─────────────────────────────────────────────────────────
// Left: what you can give me, and the box. Right: a stage that plays each before
// and after in turn. Choosing a row holds the stage on it and sets the box;
// pointing at the stage or the rows pauses it.
function showcase({ composer, session }) {
  const { video, clips } = footage(session);
  const post = bestPosts(1)[0];
  const topic = freshTopics(session, 1).topics[0];
  const order = ["video", "source", "top", "topic"].filter((k) => (k === "top" ? post : k === "topic" ? topic : true));
  const row = (k, i) => `
    <button type="button" class="nch-row" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-nch-slide-to="${i}" data-nch-hint="${esc(KINDS[k].hint)}">
      ${tile(k)}<span class="nch-row__text"><span class="nch-row__name">${esc(KINDS[k].name)}</span><span class="nch-row__does">${esc(KINDS[k].does)}</span></span>
      <span class="nch-row__bar" aria-hidden="true"></span>
    </button>`;
  // Each scene reads top to bottom: what you give me, what I do with it (my
  // butter seam), what you get. The foot names the result and holds the verb.
  const mins = Math.round((video.durationMs || 0) / 60000);
  const length = mins > 1 ? `a ${mins}-minute video` : "a one-minute video";
  const scene = (input, does, output) => `
      <div class="nch-scene">
        <div class="nch-scene__in">${input}</div>
        <div class="nch-seam"><span class="nch-seam__pill"><i class="ap-icon-sparkles" aria-hidden="true"></i>${esc(does)}</span></div>
        <div class="nch-scene__out">${output}</div>
      </div>`;
  const slides = {
    video: scene(
      videoMedia(video, { len: true }),
      "I find the moments worth a clip",
      `<span class="nch-scene__clips">${clips
        .map(
          (c, i) =>
            `<span class="nch-scene__clip">${clipMedia(video, c, i, { autoplay: true })}<span class="nch-scene__clip-title">${esc(c.title || "")}</span></span>`,
        )
        .join("")}</span>`,
    ),
    source: scene(
      `<span class="nch-doc">
        <span class="nch-doc__head"><span class="nch-doc__icon" aria-hidden="true"><i class="ap-icon-file--pdf"></i></span><span class="nch-doc__name">q2-strategy-offsite-notes.pdf</span><span class="nch-doc__meta">8 pages</span></span>
        <span class="nch-doc__text">…and the roadmap review kept coming back to one point. <mark>We shipped less this quarter, on purpose.</mark> The launches we cut freed the team for…</span>
      </span>`,
      "I pull out the ideas",
      draftStack(),
    ),
    top: post
      ? scene(
          topPostMini(post, { withImage: false }),
          "I find why it worked",
          draftStack(["linkedin", "linkedin", "x"]),
        )
      : "",
    topic: topic ? scene(topicMini(topic), "I write your angle on it", draftStack(["linkedin"])) : "",
  };
  const result = {
    video: [`${video.clips.length} clips, cut and captioned`, `From ${length}`],
    source: ["9 ideas, a draft for each network", "From one PDF"],
    top: ["New posts on the same pattern", "Same hook, a new subject"],
    topic: ["Your take, in your voice", "Drafted for LinkedIn"],
  };
  // The stage's button starts the kind on the very object it shows.
  const go = {
    video: DOORS.video(video),
    source: DOORS.source(),
    top: post && DOORS.post(post),
    topic: topic && DOORS.topic(topic),
  };
  const button = (k, i) => {
    const d = go[k];
    const label = `<i class="ap-icon-sparkles" aria-hidden="true"></i><span>${esc(KINDS[k].go)}</span>`;
    const tab = i ? 'tabindex="-1"' : "";
    return d.href
      ? `<a class="ap-button primary orange nch-slide__go" href="${d.href}" ${tab}>${label}</a>`
      : `<button type="button" class="ap-button primary orange nch-slide__go" ${d.attrs} ${tab}>${label}</button>`;
  };
  return shell(
    "show",
    `
    <div class="nch-split">
      <div class="nch-split__do">
        ${WORDMARK}
        <h1 class="nch__title">Give me anything. I'll turn it into posts.</h1>
        <div class="nch-rows" role="tablist" aria-label="What you can give me">${order.map(row).join("")}</div>
        ${lead(composer)}
      </div>
      <div class="nch-stage" data-nch-stage aria-live="polite">
        ${order
          .map(
            (k, i) => `
          <section class="nch-slide nch-slide--${k}${i === 0 ? " is-on" : ""}" role="tabpanel" data-nch-slide="${i}" ${i ? 'aria-hidden="true"' : ""}>
            ${slides[k]}
            <footer class="nch-slide__foot">
              <span class="nch-slide__result"><span class="nch-slide__what">${esc(result[k][0])}</span><span class="nch-slide__from">${esc(result[k][1])}</span></span>
              ${button(k, i)}
            </footer>
          </section>`,
          )
          .join("")}
      </div>
    </div>`,
  );
}

// ── 6 · Example requests ────────────────────────────────────────────────────
// Words only: what you can say to me. Under the box, one chip per flow (the
// first one chosen); under the chips, four requests of that flow. Pointing at
// a request writes it in the box as a ghost; a click sends it and runs the flow
// (the starters' own hooks, the request as their prompt), except « Write a
// post », whose requests only fill the box: they are there to be rewritten.
const FLOWS = [
  {
    k: "video",
    name: "Video clips",
    asks: [
      "Cut my latest podcast into short vertical clips",
      "Turn this webinar into clips for Reels and TikTok",
      "Find the three best moments of this interview",
      "Make a 30-second teaser from our product demo",
    ],
  },
  {
    k: "top",
    name: "Top posts",
    asks: [
      "Write three posts like my best one this month",
      "Do more of what worked on LinkedIn lately",
      "Turn my top Instagram post into a LinkedIn post",
      "Find my best post of the quarter and write two more like it",
    ],
  },
  {
    k: "source",
    name: "From a source",
    asks: [
      "Turn this blog post into a week of LinkedIn posts",
      "Pull five post ideas out of this PDF",
      "Write posts from our latest newsletter",
      "Draft posts from this product page",
    ],
  },
  {
    k: "topic",
    name: "Topics",
    asks: [
      "Find a trending Topic and give me our take",
      "What should we react to this week?",
      "What are people in our industry talking about?",
      "Give me our take on this week's biggest news",
    ],
  },
  {
    k: "free",
    name: "Write a post",
    hint: "Tell me what the post is about, and where it goes.",
    asks: [
      "Write a LinkedIn post about our new feature",
      "Draft an X thread about our latest customer story",
      "Announce our next webinar on Instagram",
      "Thank our community for 10,000 followers",
    ],
  },
];

// What a request does on click, its tone and its icon — shared by 6 and 7.
const STARTER = { video: "open-video-clips", top: "open-top-posts", source: "open-batch" };
const askAttrs = (k, text) =>
  k === "free" ? DOORS.fill(text).attrs : k === "topic" ? `data-add-source="topic"` : starterAttrs(STARTER[k], text);
const flowTone = (k) => (KINDS[k] ? KINDS[k].tone : "free");
const flowIcon = (k) => (KINDS[k] ? KINDS[k].icon : "ap-icon-pen");

// One request. `fill` (« Write a post ») only lands in the box, to be rewritten
// before it goes; `icon` puts the flow's tile before the sentence (7).
const askRow = (k, text, { attrs = askAttrs(k, text), icon = null } = {}) => `
    <li>
      <button type="button" class="nch-ask" ${attrs} data-nch-hint="${esc(text)}"
        title="${k === "free" ? "Put it in the box to edit" : "Send this request"}">
        ${icon ? `<span class="nch-tile nch-tile--sm nch-tone--${flowTone(k)}" aria-hidden="true"><i class="${icon}"></i></span>` : ""}
        <span class="nch-ask__text">${esc(text)}</span>
        <i class="${k === "free" ? "ap-icon-pen" : "ap-icon-arrow-right"} nch-ask__go" aria-hidden="true"></i>
      </button>
    </li>`;

const voiceAsk = (ctx, voices, withIcon = false) =>
  voices.length
    ? askRow("voice", `Give ${networkLabel(voices[0])} a voice of its own`, {
        attrs: DOORS.voice(ctx, voices[0]).attrs,
        icon: withIcon ? networkIcon(voices[0]) : null,
      })
    : "";

function prompts({ composer, session }) {
  const ctx = ctxOf(session);
  const voices = networkVoiceOn() && ctx ? voicesToFinish(ctx) : [];
  const ask = (k, text) => askRow(k, text, { icon: flowIcon(k) });
  const tone = (f) => flowTone(f.k);
  const icon = (f) => flowIcon(f.k);
  const chip = (f, i) => `
    <button type="button" class="nch-flow-chip" role="tab" id="nchFlow-${f.k}" aria-controls="nchFlowPane-${f.k}"
      aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-nch-flow="${f.k}"
      data-nch-hint="${esc(f.hint || KINDS[f.k].hint)}">
      <span class="nch-tile nch-tile--sm nch-tone--${tone(f)}" aria-hidden="true"><i class="${icon(f)}"></i></span>
      <span>${esc(f.name)}</span>
    </button>`;
  const pane = (f, i) => `
    <ul class="nch-asks" id="nchFlowPane-${f.k}" role="tabpanel" aria-labelledby="nchFlow-${f.k}"
      data-nch-flow-pane="${f.k}"${i ? " hidden" : ""}>
      ${f.asks.map((t) => ask(f.k, t)).join("")}
      ${f.k === "free" ? voiceAsk(ctx, voices, true) : ""}
    </ul>`;
  return shell(
    "prompts",
    `
    ${WORDMARK}
    <p class="nch__sub">Say what you want to post. Or start from one of these.</p>
    ${lead(composer)}
    <div class="nch-flows">
      <div class="nch-flows__chips" role="tablist" aria-label="Example requests by flow">${FLOWS.map(chip).join("")}</div>
      ${FLOWS.map(pane).join("")}
    </div>`,
  );
}

// ── 7 · One request per flow ────────────────────────────────────────────────
// The list of 6 without its chips: under the box, one request per flow in one
// white panel, each led by its flow's tile. Same hover and click as 6.
// « Other examples » deals the next request of each flow (four sets).
function promptList({ composer, session }) {
  const ctx = ctxOf(session);
  const voices = networkVoiceOn() && ctx ? voicesToFinish(ctx) : [];
  const sets = FLOWS[0].asks.map((_, i) => i);
  const list = (i) => `
    <ul class="nch-asks" data-nch-set="${i}" aria-label="Example requests"${i ? " hidden" : ""}>
      ${FLOWS.map((f) => askRow(f.k, f.asks[i], { icon: flowIcon(f.k) })).join("")}
      ${voiceAsk(ctx, voices, true)}
    </ul>`;
  return shell(
    "prompt-list",
    `
    ${WORDMARK}
    <p class="nch__sub">Say what you want to post. Or start from one of these.</p>
    ${lead(composer)}
    <div class="nch-flows">
      ${sets.map(list).join("")}
      <button type="button" class="ap-button ghost grey nch-asks__more" data-nch-shuffle>
        <i class="ap-icon-refresh" aria-hidden="true"></i><span>Other examples</span>
      </button>
    </div>`,
  );
}

// ── 8 · The drawer under the box ────────────────────────────────────────────
// The requests of 6, in a drawer that slides out from under the composer card:
// a grey tray as wide as the card, starting behind it, so the two read as one
// object. On the tray, the flows as tabs (their icon in their tone) and a
// chevron to shut it; shut, the tabs stay and choosing one opens it again.
// Under them, the chosen flow's four requests. Same hover and click as 6.
function drawer({ composer, session }) {
  const ctx = ctxOf(session);
  const voices = networkVoiceOn() && ctx ? voicesToFinish(ctx) : [];
  const tab = (f, i) => `
    <button type="button" class="nch-drawer__tab" role="tab" id="nchFlow-${f.k}" aria-controls="nchFlowPane-${f.k}"
      aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-nch-flow="${f.k}"
      data-nch-hint="${esc(f.hint || KINDS[f.k].hint)}">
      <i class="${flowIcon(f.k)} nch-tone--${flowTone(f.k)}" aria-hidden="true"></i>
      <span>${esc(f.name)}</span>
    </button>`;
  const pane = (f, i) => `
    <ul class="nch-asks nch-drawer__list" id="nchFlowPane-${f.k}" role="tabpanel" aria-labelledby="nchFlow-${f.k}"
      data-nch-flow-pane="${f.k}"${i ? " hidden" : ""}>
      ${f.asks.map((t) => askRow(f.k, t, { icon: flowIcon(f.k) })).join("")}
      ${f.k === "free" ? voiceAsk(ctx, voices, true) : ""}
    </ul>`;
  const tray = `
    <div class="nch-drawer" data-nch-drawer>
      <div class="nch-drawer__head">
        <div class="nch-drawer__tabs" role="tablist" aria-label="Example requests by flow">${FLOWS.map(tab).join("")}</div>
        <button type="button" class="ap-icon-button transparent grey nch-drawer__shut" data-nch-drawer-toggle
          aria-controls="nchDrawerBody" aria-expanded="true" aria-label="Hide examples" title="Hide examples">
          <i class="ap-icon-chevron-up" aria-hidden="true"></i>
        </button>
      </div>
      <div class="nch-drawer__body" id="nchDrawerBody">${FLOWS.map(pane).join("")}</div>
    </div>`;
  // The tray goes right under the card, before the composer's hint row.
  const hint = '<div class="session__composer-hint">';
  const box = composer.includes(hint) ? composer.replace(hint, tray + hint) : composer + tray;
  return shell(
    "drawer",
    `
    ${WORDMARK}
    <p class="nch__sub">Say what you want to post. Or start from one of these.</p>
    ${lead(box)}`,
  );
}

// ── <archie-home>: the directions' local behaviour ──────────────────────────
// No state outside the element but the mode / slide it shows, kept across the
// re-renders session.js does while the chat is empty.
const memory = { mode: "source", slide: 0, held: false, flow: null, set: 0, drawerShut: false };
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

class ArchieHome extends HTMLElement {
  connectedCallback() {
    this.input = () => this.querySelector("#assistantInput");
    this.base = this.input()?.dataset.placeholder || this.input()?.placeholder || "";
    this.addEventListener("click", this);
    this.addEventListener("keydown", this);
    this.addEventListener("pointerover", this);
    this.addEventListener("pointerout", this);
    this.addEventListener("focusin", this);
    this.addEventListener("focusout", this);
    // Media events don't bubble: listen in the capture phase. A playing clip
    // drops its play mark.
    const playing = (e) => e.target.closest?.("[data-nch-play]")?.toggleAttribute("data-playing", e.type === "play");
    this.addEventListener("play", playing, true);
    this.addEventListener("pause", playing, true);
    if (this.querySelector("[data-nch-mode]")) this.setMode(memory.mode, false);
    if (this.querySelector("[data-nch-flow]")) {
      this.setFlow(memory.flow);
      // The chips are centred: the notch follows them when the width changes.
      const flows = this.querySelector(".nch-flows");
      if (flows) {
        this.resized = new ResizeObserver(() => this.notch());
        this.resized.observe(flows);
      }
    }
    if (this.querySelector("[data-nch-set]")) this.setSet(memory.set);
    if (this.querySelector("[data-nch-drawer]")) this.shutDrawer(memory.drawerShut);
    if (this.querySelector("[data-nch-stage]")) {
      this.setSlide(memory.slide);
      this.restart();
    }
  }

  // The stage moves on every 4.2s unless held, read (pointer on the stage or
  // the rows, focus inside) or out of sight. Restarted when the pointer leaves,
  // so the progress hairline and the step start together.
  restart() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (memory.held || this.reading || reduced() || document.hidden || this.matches(":focus-within")) return;
      const n = this.querySelectorAll("[data-nch-slide]").length;
      this.setSlide((memory.slide + 1) % n);
    }, 4200);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    this.resized?.disconnect();
  }

  // The panel's notch stands under the chosen chip (direction 6). Layout
  // offsets, not rects: the hero's rise moves it with a transform.
  notch() {
    const wrap = this.querySelector(".nch-flows");
    const chip = this.querySelector('[data-nch-flow][aria-selected="true"]');
    if (wrap && chip) wrap.style.setProperty("--nch-notch-x", `${chip.offsetLeft + chip.offsetWidth / 2}px`);
  }

  // The placeholder a mode or a row sets is the box's own until the next one
  // (composer.js restores `data-placeholder` when a chip leaves the box).
  setBase(text) {
    this.base = text;
    const input = this.input();
    if (input) input.dataset.placeholder = text;
    this.hint(text);
  }

  hint(text) {
    const input = this.input();
    if (!input || input.value) return;
    input.placeholder = text || this.base;
  }

  setMode(k, focus) {
    const tabs = [...this.querySelectorAll("[data-nch-mode]")];
    if (!tabs.some((t) => t.dataset.nchMode === k)) k = tabs[0]?.dataset.nchMode;
    memory.mode = k;
    tabs.forEach((t) => {
      const on = t.dataset.nchMode === k;
      t.setAttribute("aria-selected", String(on));
      t.classList.toggle("active", on);
      t.tabIndex = on ? 0 : -1;
      if (on) {
        this.setBase(t.dataset.nchHint);
        if (focus) t.focus();
      }
    });
    this.querySelectorAll("[data-nch-pane]").forEach((p) => (p.hidden = p.dataset.nchPane !== k));
  }

  // The example requests on show (direction 6): one set at a time.
  // The flow whose requests show (direction 6). `deal`: they come in one
  // after the other, when a chip is chosen.
  setFlow(k, { deal = false, focus = false } = {}) {
    const chips = [...this.querySelectorAll("[data-nch-flow]")];
    if (!chips.some((c) => c.dataset.nchFlow === k)) k = chips[0]?.dataset.nchFlow;
    memory.flow = k;
    chips.forEach((c) => {
      const on = c.dataset.nchFlow === k;
      c.setAttribute("aria-selected", String(on));
      c.tabIndex = on ? 0 : -1;
      if (on) {
        this.setBase(c.dataset.nchHint);
        if (focus) c.focus();
      }
    });
    this.querySelectorAll("[data-nch-flow-pane]").forEach((p) => {
      p.hidden = p.dataset.nchFlowPane !== k;
      p.classList.toggle("is-dealt", deal && !p.hidden);
    });
    this.notch();
  }

  // The drawer under the box (direction 8): open, or shut down to its lip.
  shutDrawer(shut) {
    memory.drawerShut = shut;
    const d = this.querySelector("[data-nch-drawer]");
    d.classList.toggle("is-shut", shut);
    d.querySelector("#nchDrawerBody").hidden = shut;
    const btn = d.querySelector("[data-nch-drawer-toggle]");
    const label = shut ? "Show examples" : "Hide examples";
    btn.setAttribute("aria-expanded", String(!shut));
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  // The example set on show (direction 7). `deal`: on « Other examples ».
  setSet(i, deal = false) {
    const sets = this.querySelectorAll("[data-nch-set]");
    memory.set = i % sets.length;
    sets.forEach((l) => {
      l.hidden = +l.dataset.nchSet !== memory.set;
      l.classList.toggle("is-dealt", deal && !l.hidden);
    });
  }

  setSlide(i) {
    memory.slide = i;
    this.querySelectorAll("[data-nch-slide]").forEach((s) => {
      const on = +s.dataset.nchSlide === i;
      s.classList.toggle("is-on", on);
      s.setAttribute("aria-hidden", String(!on));
      s.querySelector(".nch-slide__go")?.setAttribute("tabindex", on ? "0" : "-1");
      s.querySelectorAll("video[data-nch-autoplay]").forEach((v) =>
        on && !reduced() ? v.play().catch(() => {}) : v.pause(),
      );
    });
    this.querySelectorAll("[data-nch-slide-to]").forEach((r) => {
      const on = +r.dataset.nchSlideTo === i;
      r.setAttribute("aria-selected", String(on));
      r.tabIndex = on ? 0 : -1;
      r.classList.toggle("is-held", on && memory.held);
      if (on) {
        this.setBase(r.dataset.nchHint);
      }
    });
  }

  handleEvent(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (e.type === "click") {
      const mode = t.closest("[data-nch-mode]");
      if (mode) return this.setMode(mode.dataset.nchMode, false);
      const to = t.closest("[data-nch-slide-to]");
      if (to) {
        memory.held = true;
        return this.setSlide(+to.dataset.nchSlideTo);
      }
      if (t.closest("[data-nch-shuffle]")) {
        this.setSet(memory.set + 1, true);
        return this.hint(this.base);
      }
      if (t.closest("[data-nch-drawer-toggle]")) return this.shutDrawer(!memory.drawerShut);
      const flow = t.closest("[data-nch-flow]");
      if (flow) {
        // A shut drawer opens on the flow you chose.
        if (memory.drawerShut && flow.closest("[data-nch-drawer]")) this.shutDrawer(false);
        return this.setFlow(flow.dataset.nchFlow, { deal: true });
      }
      const fill = t.closest("[data-nch-fill]");
      if (fill) {
        const input = this.input();
        if (!input) return;
        input.value = fill.dataset.nchFill;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      return;
    }
    if (e.type === "keydown") {
      // Arrow keys move along a tablist (modes, rows), the ARIA way.
      const tab = t.closest("[data-nch-mode],[data-nch-slide-to],[data-nch-flow]");
      if (!tab || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const list = [...tab.parentElement.children];
      const next = list[(list.indexOf(tab) + (/Right|Down/.test(e.key) ? 1 : list.length - 1)) % list.length];
      next.focus();
      next.click();
      return;
    }
    // Pointing at the stage or the rows pauses the stage (and its hairline).
    const reading = t.closest(".nch-stage, .nch-rows");
    if (reading && this.querySelector("[data-nch-stage]")) {
      if (e.type === "pointerover" && !this.reading) {
        this.reading = true;
        this.classList.add("is-reading");
      } else if (e.type === "pointerout" && !e.relatedTarget?.closest?.(".nch-stage, .nch-rows")) {
        this.reading = false;
        this.classList.remove("is-reading");
        this.setSlide(memory.slide);
        this.restart();
      }
    }
    // Hover or focus on a starting point says, in the box, what it will do.
    const hinted = t.closest(":is(.nch-chip, .nch-ask, .nch-flow-chip, .nch-drawer__tab)[data-nch-hint]");
    if (e.type === "pointerover" || e.type === "focusin") {
      if (hinted) this.hint(hinted.dataset.nchHint);
      const media = t.closest("[data-nch-play]")?.querySelector("video");
      if (media && !media.dataset.nchAutoplay) media.play().catch(() => {});
    } else {
      if (hinted && !hinted.contains(e.relatedTarget)) this.hint(this.base);
      const box = t.closest("[data-nch-play]");
      const media = box?.querySelector("video");
      if (media && !media.dataset.nchAutoplay && !box.contains(e.relatedTarget)) media.pause();
    }
  }
}

if (!customElements.get("archie-home")) customElements.define("archie-home", ArchieHome);
