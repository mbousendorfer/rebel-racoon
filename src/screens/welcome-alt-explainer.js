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

import { escapeHtml } from "../utils.js?v=2732";
import { isFlagOn } from "../feature-flags.js?v=2732";
import { networkIcon, networkLabel } from "../social-profiles.js?v=2732";
import { playbookNetworks } from "../voice-parts.js?v=2732";
import { RECAP_SECTIONS } from "../playbook-view.js?v=2732";
import { tint, domainOf } from "./welcome-alt-shell.js?v=2732";
import { styleArtSvg } from "../modules/image-studio/render/style-art.js?v=2732";
import { resolvePalette } from "../modules/image-studio/render/palette.js?v=2732";
import { svgToDataUrl } from "../modules/image-studio/render/visual.js?v=2732";

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
    font: d?.brandTypography?.headingFont || "Averta",
    // A picture as my Image Generator would draw it for this brand.
    art: (variant) => svgToDataUrl(styleArtSvg(variant, palette)),
    traits: traits.length ? traits : ["Warm", "Clear", "Helpful"],
    voice: d?.voiceSummary || "Warm and clear. Every post opens with what matters to the reader.",
    audience: d?.audience?.[0] || "People who care about what they buy",
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

const avatar = (b, net, size) => `
  <span class="ap-avatar size-${size} wx-post__avatar">
    ${bind(b.logo ? `<img src="${e(b.logo)}" alt="" />` : `<span class="ap-avatar-initials">${e(b.name.slice(0, 1))}</span>`)}
    <span class="ap-avatar-network" role="img" aria-label="${e(networkLabel(net))}"><i class="${networkIcon(net)}" aria-hidden="true"></i></span>
  </span>`;

// A post as the networks show it: the DS avatar with its network badge.
const post = (b, net, text, { tag = "", cls = "" } = {}) => `
  <article class="wx-post ${cls}">
    <header class="wx-post__head">${avatar(b, net, 32)}
      <span class="wx-post__who"><strong>${bind(e(b.name))}</strong><span>Just now</span></span>
    </header>
    <p class="wx-post__text">${text}</p>
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
    <p class="wx-caption__text">${e(caption.text)}</p>
  </div>
  <div class="wx-fit" data-h="${h}" data-rows="${Y.rows}" style="--h:${Y(h)}px">
    <div class="wx-canvas" aria-hidden="true" ${attrs}>
      <svg class="wx-threads" viewBox="0 0 ${W} ${Y(h)}" width="${W}" height="${Y(h)}">${svg}</svg>
      ${body}
    </div>
  </div>`;

const partCard = (id, meaning, body, slotDelay) => `
  <div class="wx-part" style="${tint(id)}">
    <div class="wx-part__head">${glyph(id)}<span><strong>${e(part(id).title)}</strong><span>${e(meaning)}</span></span></div>
    <div class="wx-slot" style="--d:${slotDelay.toFixed(2)}s">${body}</div>
  </div>`;

// Three posts dealt as a fan: the middle one readable, the sides behind it.
function fanPosts(b, textOf, { y, d, tagOf = () => "" }) {
  const nets = b.networks;
  const slots = [
    { x: 24, rot: -5, z: 1, cls: "is-side", net: nets[1] || nets[0] },
    { x: 180, rot: 0, z: 3, cls: "is-front", net: nets[0] },
    { x: 336, rot: 5, z: 2, cls: "is-side", net: nets[2] || nets[0] },
  ];
  return slots
    .map((s, i) =>
      at(s.x, y + (s.rot ? 16 : 0), 200, post(b, s.net, textOf(i), { tag: tagOf(i), cls: s.cls }), {
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
        <div class="wx-browser__nav"><span class="wx-browser__brand">${brandMark(b, 20)}<strong>${bind(e(b.name))}</strong></span><span>Shop</span><span>About</span><span>Journal</span></div>
        <div class="wx-browser__hero">
          <div class="wx-browser__copy">
            <span class="wx-browser__h">Made with care,<br />for every day.</span>
            <span class="wx-browser__sub">For people who care about what they buy.</span>
            ${bind(`<span class="wx-browser__cta" style="background:${e(b.colors[0])}">Shop now</span>`)}
          </div>
          ${bind(`<img class="wx-browser__img" src="${b.art("flat-lay")}" alt="" />`)}
        </div>
        <span class="wx-scan"></span>
      </div>
    </div>`;
  const cards = [
    {
      id: "goals",
      x: 16,
      y: Y(300),
      meaning: "Who you write for, and why",
      body: bind(`<span class="wx-slot__text">${e(b.audience)}</span>`),
    },
    {
      id: "voice",
      x: 288,
      y: Y(300),
      meaning: "How you sound",
      body: bind(`<span class="wx-chips">${chips(b.traits)}</span>`),
    },
    {
      id: "brand",
      x: 16,
      y: Y(424),
      meaning: "Your colors, logo and type",
      body: bind(`${swatches(b.colors)}<span class="wx-font"><b>Aa</b>${e(b.font)}</span>`),
    },
    {
      id: "competitors",
      x: 288,
      y: Y(424),
      meaning: "Who you're up against",
      body: bind(
        b.competitors.length
          ? `<span class="wx-chips">${chips(b.competitors)}</span>`
          : `<span class="wx-slot__text">I'll suggest a few</span>`,
      ),
    },
  ];
  // Where each piece leaves the site, and what it looks like on the way.
  const flights = [
    [
      190,
      128,
      144,
      Y(372),
      2.0,
      `<span class="wx-chip is-fly"><i class="ap-icon-multiple-users"></i>Your audience</span>`,
    ],
    [190, 96, 416, Y(372), 2.25, `<span class="wx-chip is-fly"><i class="ap-icon-quote"></i>Your words</span>`],
    [400, 120, 144, Y(496), 2.5, swatches(b.colors.slice(0, 3), "is-fly")],
    [300, 16, 416, Y(496), 2.75, `<span class="wx-chip is-fly"><i class="ap-icon-search"></i>Brands like yours</span>`],
  ];
  return stage(
    {
      title: "How I get to know your brand",
      text: "I read your site and sort what I find into four parts. Every draft I write starts there.",
    },
    at(80, 0, 400, site, { cls: "wx-hero" }) +
      seam(Y(216), "I sort it into your Playbook", 1.2) +
      at(
        0,
        Y(262),
        W,
        `<div class="wx-pbhead">${brandMark(b, 22)}<strong>Your Playbook</strong><span>${e(b.domain)}</span></div>`,
        { cls: "wx-pbhead-row", d: 1.4 },
      ) +
      cards
        .map((c, i) => at(c.x, c.y, 256, partCard(c.id, c.meaning, c.body, 2.9 + i * 0.25), { d: 1.5 + i * 0.1 }))
        .join("") +
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
  const lines = [
    "Spring is here, and so is our new range.",
    "Three things we wish we'd known sooner.",
    "Ten years together. Thank you.",
  ];
  return stage(
    {
      title: "Every draft, in your language",
      text: `I write in ${lang} on every network, so nothing needs translating.`,
    },
    at(
      150,
      30,
      260,
      `<div class="wx-langcard">${brandMark(b, 36)}<span><strong>${bind(e(b.name))}</strong><span>Your Playbook</span></span>
        <span class="wx-lang"><i class="ap-icon-translate" aria-hidden="true"></i>${e(lang)}</span></div>`,
      { cls: "wx-hero" },
    ) +
      seam(Y(160), `I write in ${lang}`, 0.6) +
      fanPosts(b, (i) => `<span class="wx-type" style="--d:${(1.6 + i * 0.35).toFixed(2)}s">${e(lines[i])}</span>`, {
        y: Y(250),
        d: 1.1,
      }),
    thread(280, 106, 280, Y(206), 0.4) + fanThreads(Y(206), Y(250), 0.9),
    { h: 410, Y },
  );
}

// Documents: your brand book sharpens the voice and the look.
function documentsScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([262, 340], gap);
  const book = `
    <div class="wx-book">
      <div class="wx-book__page">
        <span class="wx-book__brand">${brandMark(b, 22)}<strong>${bind(e(b.name))}</strong></span>
        <span class="wx-book__label">Our voice</span>
        <span class="wx-book__quote"><mark>Warm, never pushy.</mark> We talk like a friend who knows the product.</span>
        <span class="wx-book__label">We say</span>
        <span class="wx-book__say">"you", "made for", "every day"</span>
      </div>
      <div class="wx-book__page">
        <span class="wx-book__label">Colors</span>
        ${bind(swatches(b.colors, "is-big"))}
        <span class="wx-book__label">Type</span>
        <span class="wx-book__type"><b>Aa</b><span>${bind(e(b.font))}<br />Headings and body</span></span>
      </div>
    </div>`;
  return stage(
    {
      title: "Your brand book, put to work",
      text: "The words you use go to your Voice profile. Your colors and type go to Branding.",
    },
    at(40, 0, 480, book, { cls: "wx-hero" }) +
      seam(Y(262), "I keep your words and your look", 1.1) +
      at(
        24,
        Y(340),
        240,
        partCard("voice", "How you sound", `<span class="wx-slot__text">Warm, never pushy</span>`, 2.6),
        {
          d: 1.4,
        },
      ) +
      at(
        296,
        Y(340),
        240,
        partCard(
          "brand",
          "Your colors, logo and type",
          bind(`${swatches(b.colors)}<span class="wx-font"><b>Aa</b>${e(b.font)}</span>`),
          2.9,
        ),
        { d: 1.55 },
      ) +
      fly(
        150,
        104,
        144,
        Y(400),
        1.9,
        `<span class="wx-chip is-fly"><i class="ap-icon-quote"></i>Warm, never pushy</span>`,
      ) +
      fly(400, 76, 416, Y(400), 2.2, swatches(b.colors.slice(0, 3), "is-fly")),
    thread(280, 216, 280, Y(302), 0.9) + thread(280, Y(302), 144, Y(340), 1.2) + thread(280, Y(302), 416, Y(340), 1.2),
    { h: 460, Y },
  );
}

// Voice source: learned once from what you give me, then every post sounds like you.
function voiceScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([108, 150, 372], gap);
  const perNetwork = isFlagOn("voicePerNetwork");
  const sources = [
    {
      icon: "ap-icon-post",
      title: "Your posts",
      body: `<span class="wx-mini"><i class="${networkIcon(b.networks[0])}"></i>Our busiest week yet.</span>
             <span class="wx-mini"><i class="${networkIcon(b.networks[1] || b.networks[0])}"></i>You asked, we listened.</span>`,
    },
    {
      icon: "ap-icon-file--pdf",
      title: "A document",
      body: `<span class="wx-mini is-doc">We say "you", never "users". Short sentences.</span>`,
    },
    {
      icon: "ap-icon-single-chat-bubble",
      title: "Your own words",
      body: `<span class="wx-bubble is-me">How do you sound?</span><span class="wx-bubble">Friendly, but expert.</span>`,
    },
  ];
  // The voice print: bars of a waveform, each breathing on its own beat.
  const bars = Array.from({ length: 36 }, (_, i) => {
    const h = 8 + Math.round(Math.abs(Math.sin(i * 0.9) * 22 + Math.sin(i * 0.37) * 12));
    return `<rect x="${i * 9}" y="${((46 - h) / 2).toFixed(1)}" width="5" height="${h}" rx="2.5" style="--i:${i}" />`;
  }).join("");
  const lines = [
    "Small steps, big results. Here's what changed for us this month.",
    "Three habits that give you back an hour a day. Number two surprised us.",
    "You asked, we listened. Here's what's new.",
  ];
  return stage(
    {
      title: "Your voice, learned once, used everywhere",
      text: perNetwork
        ? "Give me any one of these and I learn how you sound. Each network uses that voice, or gets one of its own."
        : "Give me any one of these and I learn how you sound. Then every draft sounds like you, on every network.",
    },
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
      seam(Y(108), "I learn how you sound", 0.7) +
      at(
        100,
        Y(150),
        360,
        `<div class="wx-print" style="${tint("voice")}">
          <div class="wx-print__head">${glyph("voice")}<span><strong>Voice profile</strong><span>How you sound</span></span></div>
          <svg class="wx-wave" viewBox="0 0 320 46" width="320" height="46">${bars}</svg>
          ${bind(
            `<span class="wx-chips">${b.traits
              .map(
                (t, i) => `<span class="wx-chip is-tinted" style="--d:${(1.6 + i * 0.15).toFixed(2)}s">${e(t)}</span>`,
              )
              .join("")}</span>`,
          )}
          <p class="wx-print__quote">${bind(e(b.voice))}</p>
        </div>`,
        { cls: "wx-hero", d: 1.1 },
      ) +
      fanPosts(b, (i) => e(lines[i]), {
        y: Y(372),
        d: 2.2,
        tagOf: (i) =>
          !perNetwork
            ? `<span class="wx-tag"><i class="ap-icon-quote"></i>Your voice</span>`
            : i === 2
              ? `<span class="wx-tag is-own">${e(networkLabel(b.networks[2] || b.networks[0]))} voice</span>`
              : `<span class="wx-tag"><i class="ap-icon-quote"></i>Default voice</span>`,
      }),
    [92, 280, 468].map((x) => thread(x, 92, 280, Y(150), 0.4)).join("") + fanThreads(Y(352), Y(372), 2),
    { Y },
  );
}

// What each part gives a draft, said on its chip.
const ROLE = {
  goals: "Who it's for",
  voice: "How it sounds",
  brand: "How it looks",
  competitors: "What's different",
};
const partChips = () =>
  PART_IDS.map((id, i) =>
    at(
      i * 142,
      0,
      134,
      `<div class="wx-partchip" style="${tint(id)}">${glyph(id)}<span><strong>${e(part(id).title)}</strong><span>${ROLE[id]}</span></span></div>`,
      { cls: "wx-corner", attrs: `data-part="${id}"` },
    ),
  ).join("");
const pin = (id) => `<span class="wx-pin" style="${tint(id)}"><i class="${part(id).icon}"></i></span>`;

// Building, then ready: four parts, one post. Each stage lights a part, its
// thread draws, and its share of the post is marked on the post itself.
function readyScene(d, gap = 0) {
  const b = brandOf(d);
  const Y = rowsOf([124, 482], gap);
  const net = b.networks[0];
  const mark = (id, text) => `<span class="wx-hl" data-part="${id}" style="${tint(id)}">${pin(id)}${text}</span>`;
  const chipsRow = partChips();
  const draft = `
    <article class="wx-draft">
      <header class="wx-post__head">${avatar(b, net, 40)}
        <span class="wx-post__who"><strong>${bind(e(b.name))}</strong><span>Draft for ${e(networkLabel(net))}</span></span>
      </header>
      <p class="wx-draft__text">
        ${mark("goals", "If you run a growing team,")}
        ${mark("voice", "here's the one habit that gave us back four hours a week.")}
      </p>
      <div class="wx-draft__img wx-hl is-block" data-part="brand" style="${tint("brand")}">
        ${bind(`<img src="${b.art("lifestyle")}" alt="" />`)}
        ${pin("brand")}
      </div>
      <p class="wx-draft__text">${mark("competitors", "Nobody else in our space is talking about it yet.")}</p>
    </article>`;
  const doors = `<div class="wx-doors">
    <span class="ap-status mermaid">Ready to write</span>
    <span><i class="ap-icon-double-chat-bubbles"></i>Drafts in any chat</span>
    <span><i class="ap-icon-sparkles"></i>Ideas from Topics</span>
    <span><i class="ap-icon-image"></i>On-brand images</span>
  </div>`;
  // Where each part's thread lands on the post.
  const ends = [
    [170, Y(124)],
    [250, Y(124)],
    [330, Y(124)],
    [410, Y(124)],
  ];
  return stage(
    {
      title: "Four parts, one draft",
      text: "Each part shapes the same draft, so it sounds and looks like you.",
    },
    chipsRow + at(100, Y(124), 360, draft, { cls: "wx-hero" }) + at(0, Y(482), W, doors, { cls: "wx-doors-row" }),
    PART_IDS.map((id, i) => thread(67 + i * 142, 52, ...ends[i], 0, `data-part="${id}"`)).join(""),
    { attrs: `data-scene-ready`, Y },
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
    PART_IDS.map((id, i) => thread(67 + i * 142, 52, ...ends[i], 0, `data-part="${id}"`)).join(""),
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
