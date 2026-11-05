// Building a Playbook — the first time or « Create a Playbook », one run (flag
// voicePerNetwork, which took in playbookAnimations on 2026-11-04): instead of the card filling with bars, each step of the
// run plays a scene that teaches what the Playbook is made of, how its parts
// connect, and what each one lets me do (welcome-alt-shell.js mountShell).
//
// Every scene reads top to bottom, like the HOME-5 stage: what you give me (a
// real-looking object: your site, a brand book, your posts), my stitch (an olive
// thread and a butter pill saying what I do), then what it becomes, at reading
// size. Pieces of the source fly along curves (CSS offset-path) into the part
// they feed, so the link between them is seen, not told.
//
// One fixed 560 × 540 canvas, laid out in px, zoomed to fit the stage
// (`fit()`). Real data where the draft has it (name, logo, colours, traits,
// audience, competitors), a believable example otherwise; what lands after the
// scene is painted (the analysis) is patched in place (`[data-wx-bind]`). The
// pictures are the Image Generator's own style art, in the brand's palette.
// The ready screen paints once and moves by attributes (`is-lit`, `is-done`)
// so its stages light the parts one by one without replaying the scene.

import { escapeHtml } from "../utils.js?v=2751";
import { isFlagOn } from "../feature-flags.js?v=2751";
import { networkIcon, networkLabel } from "../social-profiles.js?v=2751";
import { playbookNetworks } from "../voice-parts.js?v=2751";
import { RECAP_SECTIONS } from "../playbook-view.js?v=2751";
import { tint, domainOf } from "./welcome-alt-shell.js?v=2751";
import { styleArtSvg } from "../modules/image-studio/render/style-art.js?v=2751";
import { resolvePalette } from "../modules/image-studio/render/palette.js?v=2751";
import { svgToDataUrl } from "../modules/image-studio/render/visual.js?v=2751";

const W = 560;
const H = 540;
const PART_IDS = ["goals", "voice", "brand", "competitors"];
const part = (id) => RECAP_SECTIONS.find((s) => s.id === id) || {};
const e = escapeHtml;

// What the draft can still change once the scene is up: patched in place
// (paintExplainer), so a late analysis shows without replaying the scene.
const bind = (html) => `<span class="wx-bind" data-wx-bind>${html}</span>`;

// ── What the draft knows, or a believable example ─────────────────────────

function brandOf(d) {
  const domain = domainOf(d?.websiteUrl) || "yourbrand.com";
  const named = d?.name && d.name !== "New Playbook" ? d.name : "";
  const name = named || domain.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  // The site's palette, else a calm example.
  const hexes = [...new Set((d?.brandColors || []).map((c) => (c.hex || "").toUpperCase()).filter(Boolean))].filter(
    (h) => h !== "#FFFFFF",
  );
  // Fewer than three: the site's own, lightened, rather than a stranger's palette.
  const mix = (pct) => `color-mix(in srgb, ${hexes[0]} ${pct}%, white)`;
  const EXAMPLE = ["#1F6F5C", "#F2C14E", "#E8835A", "#2B3A55"];
  const colors = !hexes.length
    ? EXAMPLE
    : [...hexes, mix(45), mix(20)].slice(0, Math.max(3, Math.min(4, hexes.length)));
  const palette = resolvePalette({
    palette: (hexes.length ? hexes : EXAMPLE).map((hex, i) => ({ hex, role: ["primary", "secondary", "accent"][i] })),
  });
  const traits = (d?.voiceProfile?.headline || "")
    .split(/\s*·\s*/)
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  const nets = playbookNetworks(d).filter((n) => n && n !== "tiktok" && n !== "youtube");
  return {
    domain,
    name,
    logo: d?.brandLogo || "",
    colors,
    // A picture as my Image Generator would draw it for this brand.
    art: (variant) => svgToDataUrl(styleArtSvg(variant, palette)),
    traits: traits.length ? traits : ["Warm", "Clear", "Helpful"],
    lang: d?.primaryLanguage || (d?.languages || [])[0] || "English",
    competitors: (d?.competitors || [])
      .map((c) => c.name)
      .filter(Boolean)
      .slice(0, 2),
    networks: (nets.length ? nets : ["linkedin", "instagram", "facebook"]).slice(0, 3),
  };
}

// ── Pieces ────────────────────────────────────────────────────────────────

// An absolutely placed block on the canvas; `d`: its entrance delay (s).
const at = (x, y, w, inner, { cls = "", d = 0, attrs = "", style = "" } = {}) =>
  `<div class="wx-at ${cls}" ${attrs} style="left:${x}px;top:${y}px;width:${w}px;--d:${d}s;${style}">${inner}</div>`;

// A curve from (x1,y1) down to (x2,y2): leaves vertically, arrives vertically.
const curve = (x1, y1, x2, y2) => {
  const k = Math.max(24, (y2 - y1) * 0.55);
  return `M${x1} ${y1} C${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
};

// A piece of the source travelling to where it lands.
const fly = (x1, y1, x2, y2, d, inner) =>
  `<div class="wx-fly" style="offset-path:path('${curve(x1, y1, x2, y2)}');--d:${d}s">${inner}</div>`;

// An olive thread, with a particle running it once it has drawn (hidden till
// then: a circle waiting for its motion sits at the canvas origin).
const thread = (x1, y1, x2, y2, d, attrs = "") => {
  const p = curve(x1, y1, x2, y2);
  return `<g class="wx-thread" ${attrs} style="--d:${d}s">
    <path class="wx-thread__line" d="${p}" pathLength="1" />
    <circle class="wx-particle" r="3" opacity="0">
      <set attributeName="opacity" to="1" begin="${(d + 0.8).toFixed(2)}s" />
      <animateMotion dur="2.2s" begin="${(d + 0.8).toFixed(2)}s" repeatCount="indefinite" path="${p}" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
    </circle>
  </g>`;
};

// My stitch: the butter pill on the thread, saying what I do.
const seam = (y, label, d) =>
  at(0, y, W, `<span class="wx-seam"><i class="ap-icon-sparkles" aria-hidden="true"></i>${e(label)}</span>`, {
    cls: "wx-seam-row",
    d,
  });

const glyph = (id) =>
  `<span class="welcome-flow__glyph is-icon is-tinted wx-glyph" style="${tint(id)}"><i class="${part(id).icon}"></i></span>`;

const brandMark = (b, size = 28) => bind(markOf(b, size));
const markOf = (b, size) =>
  b.logo
    ? `<img class="wx-mark" src="${e(b.logo)}" alt="" style="width:${size}px;height:${size}px" />`
    : `<span class="wx-mark is-initial" style="width:${size}px;height:${size}px;background:${e(b.colors[0])}">${e(b.name.slice(0, 1))}</span>`;

const swatches = (colors, cls = "") =>
  `<span class="wx-swatches ${cls}">${colors.map((c) => `<i style="background:${e(c)}"></i>`).join("")}</span>`;

const chips = (list, cls = "wx-chip") => list.map((t) => `<span class="${cls}">${e(t)}</span>`).join("");

// Text abstracted to lines: the shape of a sentence, not its words (widths in %).
const lines = (widths, cls = "") =>
  `<span class="wx-lines ${cls}">${widths.map((w) => `<i style="width:${w}%"></i>`).join("")}</span>`;

const avatar = (b, net, size) => `
  <span class="ap-avatar size-${size} wx-post__avatar">
    ${bind(b.logo ? `<img src="${e(b.logo)}" alt="" />` : `<span class="ap-avatar-initials">${e(b.name.slice(0, 1))}</span>`)}
    <span class="ap-avatar-network" role="img" aria-label="${e(networkLabel(net))}"><i class="${networkIcon(net)}" aria-hidden="true"></i></span>
  </span>`;

// A post as the networks show it: the DS avatar with its network badge, its text as lines.
const post = (b, net, { tag = "", cls = "", lineCls = "" } = {}) => `
  <article class="wx-post ${cls}">
    <header class="wx-post__head">${avatar(b, net, 32)}<strong class="wx-post__who">${bind(e(b.name))}</strong></header>
    ${lines([100, 92, 64], `wx-post__text ${lineCls}`)}
    ${tag}
  </article>`;

// A scene's rows: the y's where a new row starts. Spare height on a tall stage
// goes BETWEEN rows (`gap` each, set by measure()), never inside an object, so
// every y of a scene goes through Y(): an object keeps its size, a thread
// between two rows stretches with them.
const rowsOf = (breaks, gap) => {
  const Y = (y) => y + gap * breaks.filter((b) => b <= y).length;
  Y.rows = breaks.length;
  return Y;
};

// `h`: the scene's own height before any air, so a short one isn't framed by empty space.
const stage = (caption, body, svg, { attrs = "", h = H, Y }) => `
  <div class="wx-caption">
    <h3 class="wx-caption__title">${e(caption.title)}</h3>
    ${caption.text ? `<p class="wx-caption__text">${e(caption.text)}</p>` : ""}
  </div>
  <div class="wx-fit" data-h="${h}" data-rows="${Y.rows}" style="--h:${Y(h)}px">
    <div class="wx-canvas" aria-hidden="true" ${attrs}>
      <svg class="wx-threads" viewBox="0 0 ${W} ${Y(h)}" width="${W}" height="${Y(h)}">${svg}</svg>
      ${body}
    </div>
  </div>`;

const partCard = (id, body, slotDelay) => `
  <div class="wx-part" style="${tint(id)}">
    <div class="wx-part__head">${glyph(id)}<strong>${e(part(id).title)}</strong></div>
    <div class="wx-slot" style="--d:${slotDelay.toFixed(2)}s">${body}</div>
  </div>`;

// Three posts dealt as a fan: the middle one in front, the sides behind it.
function fanPosts(b, { y, d, tagOf = () => "", lineCls = "" }) {
  const nets = b.networks;
  const slots = [
    { x: 24, rot: -5, z: 1, cls: "is-side", net: nets[1] || nets[0] },
    { x: 180, rot: 0, z: 3, cls: "is-front", net: nets[0] },
    { x: 336, rot: 5, z: 2, cls: "is-side", net: nets[2] || nets[0] },
  ];
  return slots
    .map((s, i) =>
      at(s.x, y + (s.rot ? 16 : 0), 200, post(b, s.net, { tag: tagOf(i), cls: s.cls, lineCls }), {
        cls: "wx-fan",
        d: d + (i === 1 ? 0 : 0.18),
        style: `z-index:${s.z};--rot:${s.rot}deg`,
      }),
    )
    .join("");
}
const fanThreads = (y1, y2, d) =>
  thread(280, y1, 124, y2 + 16, d) + thread(280, y1, 280, y2, d) + thread(280, y1, 436, y2 + 16, d);

// ── The scenes ─────────────────────────────────────────────────────────────

// Website: I read your site, and every piece of it goes to one of four parts.
function brandScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([216, 262, 424], gap);
  const site = `
    <div class="wx-browser">
      <div class="wx-browser__bar"><span class="wx-browser__dots"><i></i><i></i><i></i></span>
        <span class="wx-browser__url"><i class="ap-icon-lock-on" aria-hidden="true"></i>${e(b.domain)}</span>
      </div>
      <div class="wx-browser__page">
        <div class="wx-browser__nav"><span class="wx-browser__brand">${brandMark(b, 20)}<strong>${bind(e(b.name))}</strong></span>${lines([100, 100, 100], "is-nav")}</div>
        <div class="wx-browser__hero">
          <div class="wx-browser__copy">
            ${lines([90, 70], "is-title")}
            ${lines([80])}
            ${bind(`<span class="wx-browser__cta" style="background:${e(b.colors[0])}"></span>`)}
          </div>
          ${bind(`<img class="wx-browser__img" src="${b.art("flat-lay")}" alt="" />`)}
        </div>
        <span class="wx-scan"></span>
      </div>
    </div>`;
  const cards = [
    { id: "goals", x: 16, y: Y(300), body: lines([90, 60]) },
    { id: "voice", x: 288, y: Y(300), body: bind(`<span class="wx-chips">${chips(b.traits)}</span>`) },
    { id: "brand", x: 16, y: Y(424), body: bind(`${swatches(b.colors)}<span class="wx-font"><b>Aa</b></span>`) },
    {
      id: "competitors",
      x: 288,
      y: Y(424),
      body: bind(b.competitors.length ? `<span class="wx-chips">${chips(b.competitors)}</span>` : lines([70, 45])),
    },
  ];
  // Where each piece leaves the site, and what it looks like on the way: an icon, no words.
  const dot = (icon) => `<span class="wx-chip is-fly is-icon"><i class="${icon}"></i></span>`;
  const flights = [
    [190, 128, 144, Y(372), 2.0, dot("ap-icon-multiple-users")],
    [190, 96, 416, Y(372), 2.25, dot("ap-icon-quote")],
    [400, 120, 144, Y(496), 2.5, swatches(b.colors.slice(0, 3), "is-fly")],
    [300, 16, 416, Y(496), 2.75, dot("ap-icon-search")],
  ];
  return stage(
    { title: "How I get to know your brand" },
    at(80, 0, 400, site, { cls: "wx-hero" }) +
      seam(Y(216), "I read your site", 1.2) +
      at(
        0,
        Y(262),
        W,
        `<div class="wx-pbhead">${brandMark(b, 22)}<strong>Your Playbook</strong><span>${e(b.domain)}</span></div>`,
        { cls: "wx-pbhead-row", d: 1.4 },
      ) +
      cards.map((c, i) => at(c.x, c.y, 256, partCard(c.id, c.body, 2.9 + i * 0.25), { d: 1.5 + i * 0.1 })).join("") +
      flights.map((f) => fly(...f)).join(""),
    thread(280, 206, 280, Y(262), 1),
    { Y },
  );
}

// Language: one Playbook, every post in its language.
function languageScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([160, 250], gap);
  const lang = b.lang;
  return stage(
    { title: "Every draft, in your language" },
    at(
      150,
      30,
      260,
      `<div class="wx-langcard">${brandMark(b, 36)}<strong>${bind(e(b.name))}</strong>
        <span class="wx-lang"><i class="ap-icon-translate" aria-hidden="true"></i>${e(lang)}</span></div>`,
      { cls: "wx-hero" },
    ) +
      seam(Y(160), `I write in ${lang}`, 0.6) +
      fanPosts(b, { y: Y(250), d: 1.1, lineCls: "wx-type" }),
    thread(280, 106, 280, Y(206), 0.4) + fanThreads(Y(206), Y(250), 0.9),
    { h: 410, Y },
  );
}

// Documents: your brand book sharpens the voice and the look.
function documentsScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([160, 238], gap);
  const book = `
    <div class="wx-book">
      <div class="wx-book__page">
        <span class="wx-book__brand">${brandMark(b, 22)}<strong>${bind(e(b.name))}</strong></span>
        ${lines([70], "is-mark")}
        ${lines([100, 85, 92, 60])}
      </div>
      <div class="wx-book__page">
        ${bind(swatches(b.colors, "is-big"))}
        <span class="wx-book__type"><b>Aa</b>${lines([100, 70])}</span>
      </div>
    </div>`;
  return stage(
    { title: "Your brand book, put to work" },
    at(40, 0, 480, book, { cls: "wx-hero" }) +
      seam(Y(160), "I keep your words and your look", 1.1) +
      at(24, Y(238), 240, partCard("voice", bind(`<span class="wx-chips">${chips(b.traits)}</span>`), 2.6), {
        d: 1.4,
      }) +
      at(
        296,
        Y(238),
        240,
        partCard("brand", bind(`${swatches(b.colors)}<span class="wx-font"><b>Aa</b></span>`), 2.9),
        { d: 1.55 },
      ) +
      fly(150, 64, 144, Y(288), 1.9, `<span class="wx-chip is-fly is-icon"><i class="ap-icon-quote"></i></span>`) +
      fly(400, 40, 416, Y(288), 2.2, swatches(b.colors.slice(0, 3), "is-fly")),
    thread(280, 136, 280, Y(200), 0.9) + thread(280, Y(200), 144, Y(238), 1.2) + thread(280, Y(200), 416, Y(238), 1.2),
    { h: 350, Y },
  );
}

// Voice source: learned once from what you give me, then every post sounds like you.
function voiceScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([100, 142, 314], gap);
  const perNetwork = isFlagOn("voicePerNetwork");
  const sources = [
    {
      icon: "ap-icon-post",
      title: "Your posts",
      body: [b.networks[0], b.networks[1] || b.networks[0]]
        .map((n, i) => `<span class="wx-mini"><i class="${networkIcon(n)}"></i>${lines([i ? 70 : 100])}</span>`)
        .join(""),
    },
    { icon: "ap-icon-file--pdf", title: "A document", body: lines([100, 75]) },
    {
      icon: "ap-icon-single-chat-bubble",
      title: "Your own words",
      body: `<span class="wx-bubble is-me">${lines([100])}</span><span class="wx-bubble">${lines([100])}</span>`,
    },
  ];
  // The voice print: bars of a waveform, each breathing on its own beat.
  const bars = Array.from({ length: 36 }, (_, i) => {
    const h = 8 + Math.round(Math.abs(Math.sin(i * 0.9) * 22 + Math.sin(i * 0.37) * 12));
    return `<rect x="${i * 9}" y="${((46 - h) / 2).toFixed(1)}" width="5" height="${h}" rx="2.5" style="--i:${i}" />`;
  }).join("");
  return stage(
    { title: "Your voice, learned once, used everywhere" },
    sources
      .map((s, i) =>
        at(
          8 + i * 186,
          0,
          172,
          `<div class="wx-source"><span class="wx-source__head"><i class="${s.icon}"></i>${s.title}</span>${s.body}</div>`,
          { cls: "wx-hero", d: i * 0.12 },
        ),
      )
      .join("") +
      seam(Y(100), "I learn how you sound", 0.7) +
      at(
        100,
        Y(142),
        360,
        `<div class="wx-print" style="${tint("voice")}">
          <div class="wx-print__head">${glyph("voice")}<strong>Voice profile</strong></div>
          <svg class="wx-wave" viewBox="0 0 320 46" width="320" height="46">${bars}</svg>
          ${bind(
            `<span class="wx-chips">${b.traits
              .map(
                (t, i) => `<span class="wx-chip is-tinted" style="--d:${(1.6 + i * 0.15).toFixed(2)}s">${e(t)}</span>`,
              )
              .join("")}</span>`,
          )}
        </div>`,
        { cls: "wx-hero", d: 1.1 },
      ) +
      fanPosts(b, {
        y: Y(314),
        d: 2.2,
        tagOf: (i) =>
          !perNetwork
            ? `<span class="wx-tag"><i class="ap-icon-quote"></i>Your voice</span>`
            : i === 2
              ? `<span class="wx-tag is-own">${e(networkLabel(b.networks[2] || b.networks[0]))} voice</span>`
              : `<span class="wx-tag"><i class="ap-icon-quote"></i>Default voice</span>`,
      }),
    [92, 280, 468].map((x) => thread(x, 84, 280, Y(142), 0.4)).join("") + fanThreads(Y(294), Y(314), 2),
    { h: 454, Y },
  );
}

const partChips = () =>
  PART_IDS.map((id, i) =>
    at(
      i * 142,
      0,
      134,
      `<div class="wx-partchip" style="${tint(id)}">${glyph(id)}<strong>${e(part(id).title)}</strong></div>`,
      { cls: "wx-corner", attrs: `data-part="${id}"` },
    ),
  ).join("");
const pin = (id) => `<span class="wx-pin" style="${tint(id)}"><i class="${part(id).icon}"></i></span>`;

// Building, then ready: four parts, one post. Each stage lights a part, its
// thread draws, and its share of the post is marked on the post itself.
function readyScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([124, 436], gap);
  const net = b.networks[0];
  // Each part's share of the draft: its lines, marked in its tint.
  const mark = (id, widths) =>
    `<span class="wx-hl is-lines" data-part="${id}" style="${tint(id)}">${pin(id)}${lines(widths)}</span>`;
  const chipsRow = partChips();
  const draft = `
    <article class="wx-draft">
      <header class="wx-post__head">${avatar(b, net, 40)}<strong class="wx-post__who">${bind(e(b.name))}</strong></header>
      ${mark("goals", [60])}
      ${mark("voice", [100, 80])}
      <div class="wx-draft__img wx-hl is-block" data-part="brand" style="${tint("brand")}">
        ${bind(`<img src="${b.art("lifestyle")}" alt="" />`)}
        ${pin("brand")}
      </div>
      ${mark("competitors", [75])}
    </article>`;
  const doors = `<div class="wx-doors"><span class="ap-status mermaid">Ready to write</span></div>`;
  // Where each part's thread lands on the post.
  const ends = [
    [170, Y(124)],
    [250, Y(124)],
    [330, Y(124)],
    [410, Y(124)],
  ];
  return stage(
    { title: "Four parts, one draft" },
    chipsRow + at(100, Y(124), 360, draft, { cls: "wx-hero" }) + at(0, Y(436), W, doors, { cls: "wx-doors-row" }),
    PART_IDS.map((id, i) => thread(67 + i * 142, 44, ...ends[i], 0, `data-part="${id}"`)).join(""),
    { attrs: `data-scene-ready`, h: 476, Y },
  );
}

// The intro (/welcome-alt/intro), before anything is asked: what a Playbook
// is FOR. The same idea drafted without one, then rewritten one part at a
// time: each part lights, its thread draws, and the sentence it owns turns from
// generic into the brand's (the image takes the brand's palette). Then it
// holds, and plays again (play()). An example brand, the run's prefilled one.
const INTRO_BRAND = {
  websiteUrl: "https://nicesoap.com",
  audience: ["People with sensitive skin"],
  voiceProfile: { headline: "Warm · Witty · Never salesy" },
};
function introScene(_d, gap = 0) {
  const b = brandOf(INTRO_BRAND);
  const Y = rowsOf([124], gap);
  const net = "instagram";
  // A sentence the part rewrites: the generic one, then the brand's, marked.
  const swap = (id, before, after) =>
    `<span class="wx-swap" data-part="${id}"><span class="wx-swap__before">${e(before)}</span><span class="wx-swap__after"><span class="wx-hl" style="${tint(id)}">${pin(id)}${e(after)}</span></span></span>`;
  const draft = `
    <article class="wx-draft">
      <header class="wx-post__head">${avatar(b, net, 40)}
        <span class="wx-post__who"><strong>${e(b.name)}</strong><span>Post about the new soap</span></span>
        <span class="wx-swap wx-draft__state" data-part="done">
          <span class="wx-swap__before"><span class="ap-status grey">Without a Playbook</span></span>
          <span class="wx-swap__after"><span class="ap-status mermaid">With your Playbook</span></span>
        </span>
      </header>
      <p class="wx-draft__text">
        ${swap("goals", "Check out our new product!", "Sensitive skin? This one's for you.")}
        ${swap(
          "voice",
          "We're thrilled to announce our amazing new lavender soap, available now!",
          "Lavender, olive oil, and nothing you can't pronounce. Made by hand in Lyon.",
        )}
      </p>
      <div class="wx-draft__img wx-hl is-block" data-part="brand" style="${tint("brand")}">
        <i class="ap-icon-image wx-draft__stock" aria-hidden="true"></i>
        <img src="${b.art("flat-lay")}" alt="" />
        ${pin("brand")}
      </div>
      <p class="wx-draft__text">${swap("competitors", "Buy yours today.", "Wrapped in paper, never in plastic.")}</p>
    </article>`;
  const ends = [170, 250, 330, 410].map((x) => [x, Y(124)]);
  return stage(
    {
      title: "Same idea, written like you",
      text: "I write every draft from your Playbook. Here's what each part changes.",
    },
    partChips() + at(100, Y(124), 360, draft, { cls: "wx-hero" }),
    PART_IDS.map((id, i) => thread(67 + i * 142, 44, ...ends[i], 0, `data-part="${id}"`)).join(""),
    { attrs: `data-scene-ready data-scene-intro`, h: 476, Y },
  );
}

const SCENES = {
  intro: introScene,
  url: brandScene,
  language: languageScene,
  documents: documentsScene,
  voiceFrom: voiceScene,
  recap: readyScene,
};

// How the scene sits on the stage. Air first: every row gets AIR px more
// before the scale is chosen (`s`, as wide as the stage allows, never taller);
// what height is left over still goes between the rows (`gap`, at most 40px a
// row, in 4px steps so a resize doesn't redraw for every pixel).
const AIR = 24;
function measure(el) {
  const stageEl = el.parentElement;
  const fitEl = el.querySelector(".wx-fit");
  if (!stageEl || !fitEl) return null;
  const caption = el.querySelector(".wx-caption")?.offsetHeight || 0;
  const h = Number(fitEl.dataset.h) || H;
  const rows = Number(fitEl.dataset.rows) || 0;
  const room = stageEl.clientHeight - caption - 80;
  const sw = Math.min(1.2, (stageEl.clientWidth - 40) / W);
  const s = Math.max(0.5, Math.min(sw, room / (h + rows * AIR)));
  const spare = rows ? room / s - h : 0;
  const gap = Math.max(0, Math.min(40, Math.floor(spare / rows / 4) * 4));
  return { s, gap };
}

const draw = (el) => (SCENES[el._wx.step] || brandScene)(el._wx.d, el._wx.gap);

// Draw at the air the stage gives: once without, to measure, then again with
// it, in the same task (nothing is painted in between, nothing replays).
function layout(el) {
  el.innerHTML = draw(el);
  const m = measure(el);
  if (m && m.gap !== el._wx.gap) {
    el._wx.gap = m.gap;
    el.innerHTML = draw(el);
  }
  el._wxScene = draw(el);
  const fitEl = el.querySelector(".wx-fit");
  if (m && fitEl) fitEl.style.setProperty("--s", String(measure(el)?.s ?? m.s));
}

// Paint `el` for `step`: the scene once, then (ready screen) its lit parts.
// Same step, newer draft: swap only the bound pieces, the scene keeps playing.
// A resize that changes the air redraws (and replays) the scene; one that
// doesn't only rescales it.
export function paintExplainer(el, step, d, build) {
  const fresh = el.dataset.step !== step;
  el._wx = { ...(el._wx || {}), step, d, build, gap: fresh ? 0 : el._wx?.gap || 0 };
  if (fresh) {
    el.dataset.step = step;
    layout(el);
    if (!el._wxFit) {
      el._wxFit = new ResizeObserver(() => {
        const m = measure(el);
        if (!m) return;
        if (m.gap !== el._wx.gap) {
          el._wx.gap = m.gap;
          el.innerHTML = draw(el);
          el._wxScene = draw(el);
          light(el);
        }
        el.querySelector(".wx-fit")?.style.setProperty("--s", String(measure(el)?.s ?? m.s));
      });
      el._wxFit.observe(el.parentElement);
    }
  } else {
    const scene = draw(el);
    if (el._wxScene !== scene) {
      const next = document.createElement("template");
      next.innerHTML = scene;
      const bound = next.content.querySelectorAll("[data-wx-bind]");
      el.querySelectorAll("[data-wx-bind]").forEach((node, i) => {
        if (bound[i] && node.innerHTML !== bound[i].innerHTML) node.innerHTML = bound[i].innerHTML;
      });
      el._wxScene = scene;
    }
  }
  light(el);
}

// The ready screen: its stages light the parts, by attribute.
function light(el) {
  const build = el._wx?.build;
  const ready = el.querySelector("[data-scene-ready]");
  if (!ready) return;
  if (ready.hasAttribute("data-scene-intro")) return play(el, ready);
  const stages = build?.stages?.length || 1;
  const done = Boolean(build?.done);
  litParts(ready, done ? 4 : Math.min(4, Math.ceil((((build?.at ?? -1) + 1) / stages) * 4)), done);
}

function litParts(ready, lit, done) {
  ready.classList.toggle("is-done", done);
  ready.querySelectorAll("[data-part]").forEach((p) => {
    p.classList.toggle("is-lit", p.dataset.part === "done" ? done : PART_IDS.indexOf(p.dataset.part) < lit);
  });
}

// The intro's rewrite, on a clock: a part every STEP_MS, the result held,
// then again from the generic draft. Stops once its scene is gone (a redraw,
// a route change). Reduced motion: the result, still.
const STEP_MS = 1400;
function play(el, ready) {
  if (el._wxPlaying === ready) return;
  el._wxPlaying = ready;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return litParts(ready, 4, true);
  const beats = [...PART_IDS.map((_, i) => [i + 1, false]), [4, true]];
  const run = (i) => {
    if (!ready.isConnected) return;
    if (i === beats.length) {
      litParts(ready, 0, false);
      return window.setTimeout(() => run(0), STEP_MS);
    }
    litParts(ready, ...beats[i]);
    window.setTimeout(() => run(i + 1), i === beats.length - 1 ? 5200 : STEP_MS);
  };
  litParts(ready, 0, false);
  window.setTimeout(() => run(0), 1600);
}
