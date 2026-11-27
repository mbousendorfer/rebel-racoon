// New Start (flag newStart4, 2026-11-26): the new chat a first-time user lands
// on while they have no Playbook. Asked: « un utilisateur arrive sur cette
// page, et découvre Archie … il faut lui indiquer qu'il est possible de créer un
// Playbook … sous le textarea, des requêtes … qui tournent … une entrée pour le
// vidéo clipping », then « 1 · Portes vivantes » for the body. #1, #2 (a wall of
// posts) and #3 (the same thread, composer under it) were deleted; #4 stays:
// Archie opens the thread — hello (typed live), the doors as his offer, then the
// example requests as his third turn — then the composer, the whole block
// centred in the page (2026-11-27, asked: « remonte le champ d'input … que
// l'ensemble soit plutôt centré verticalement »; it was at the foot).
//
// The requests: three at a time, a new set every few seconds, one is always a
// video. The two doors each play what they do:
//   · Sound like your brand — a generic post rewritten in a brand's voice → the
//     setup run (/welcome-alt), the one way a Playbook is made;
//   · Turn a video into clips — the seeded podcast, wide, cut into three
//     vertical clips → the clips starter (/clips).
//
// Every door is an existing hook: a request is a `data-starter` with only a
// prompt (session.js puts it in the box and focuses it, nothing is sent), the
// video door is the clips starter. What is local (the rotation, the typing)
// lives in <archie-new-start>, which wires itself.

import { seedVideos, chatStarters } from "../../mocks.js?v=2982";
import { escapeHtml } from "../../utils.js?v=2982";

const esc = escapeHtml;

// The skeleton a piece shows before it comes in (asked: « afficher un skeleton
// avant chaque apparition de nouvel élément »): its shape in grey, shimmering,
// laid over it; new-start.css plays it on the reveal and on each new set.
const SKEL = {
  line: `<span class="ns-skel ns-skel--line" aria-hidden="true"></span>`,
  door: `<span class="ns-skel ns-skel--door" aria-hidden="true"><b class="ns-skel__stage"></b><b class="ns-skel__title"></b><b></b><b></b><b class="ns-skel__short"></b><b class="ns-skel__go"></b></span>`,
  ask: `<span class="ns-skel ns-skel--ask" aria-hidden="true"><b class="ns-skel__tile"></b><b></b></span>`,
};

// The hooks session.js reads to run a workflow starter, by its action.
export function starterAttrs(action) {
  const s = chatStarters.find((x) => x.action === action);
  if (!s) return "";
  const prompt = (s.prompt || "")
    .replace(/\{\{source\}\}/g, "your source")
    .replace(/\{\{video-source\}\}/g, "your video");
  return `data-starter="${s.id}" data-starter-action="${action}" data-starter-prompt="${esc(prompt)}"`;
}

// Three sets of three. Each set holds one video request, so the clips are
// never more than one glance away.
const SETS = [
  [
    ["link", "Write 3 LinkedIn posts from this article"],
    ["video", "Find the best 30 seconds of my webinar"],
    ["idea", "Give me 5 post ideas for our product launch"],
  ],
  [
    ["pdf", "Turn this PDF into a week of posts"],
    ["video", "Cut this YouTube video into clips for Reels"],
    ["idea", "Write an Instagram caption for our team offsite"],
  ],
  [
    ["link", "Rewrite this blog post as an X thread"],
    ["video", "Make 3 vertical clips from my customer interview"],
    ["idea", "Announce our new feature on LinkedIn and Facebook"],
  ],
];

const KIND = {
  link: { icon: "ap-icon-link", tone: "src" },
  pdf: { icon: "ap-icon-file--pdf", tone: "src" },
  video: { icon: "ap-icon-video", tone: "clip" },
  idea: { icon: "ap-icon-sparkles", tone: "free" },
};

// The podcast's wide shot, then three moments cropped to 9:16 on a speaker, the
// way Clips frames it (13% / 87%: each speaker's centre).
const video = seedVideos[0];
const frame = (cls, sec, pos = "50%", caption = "") => `
  <span class="${cls}">
    <video src="${esc(video.url)}#t=${sec}" muted playsinline preload="metadata" style="object-position:${pos} 50%"></video>
    ${caption ? `<span class="ns-cut__caption">${esc(caption)}</span>` : ""}
  </span>`;

// The doors' SVG pieces (2026-11-26, asked: « pousser un peu plus loin le côté
// animé »), choreographed in new-start.css on the doors' 9s loop:
//   · three four-point sparks that pop when the brand's post is written;
//   · a 9:16 frame drawn by its stroke (pathLength 100) where each clip lands.
const STAR = "M0,-6 C1,-1 1,-1 6,0 C1,1 1,1 0,6 C-1,1 -1,1 -6,0 C-1,-1 -1,-1 0,-6Z";
const SPARKS = `
            <svg class="ns-voice__sparks" viewBox="0 0 60 30" aria-hidden="true">
              <g transform="translate(12 18)"><path class="ns-spark" d="${STAR}" /></g>
              <g transform="translate(32 8) scale(0.7)"><path class="ns-spark" d="${STAR}" /></g>
              <g transform="translate(48 20) scale(0.5)"><path class="ns-spark" d="${STAR}" /></g>
            </svg>`;
const FRAME = `<span class="ns-cut__frame"><svg viewBox="0 0 90 160" preserveAspectRatio="none" aria-hidden="true"><rect x="1.5" y="1.5" width="87" height="157" rx="9" pathLength="100" /></svg></span>`;

// The two doors — one renderer, two hosts: this page's second turn, and the
// new chat's hero under the example requests (flag newChatHero, 2026-11-27,
// asked: « un bloc un peu plus visuel … les 2 blocs du FS New Start #4 … en
// dessous des prompts suggérés »). The hero shows the clips door only
// (`brand: false`): what's missing there is a warning row of its own
// (heroWarning in empty-hero.js), not a door.
export function renderDoors({ brand = true } = {}) {
  return `
      <div class="ns-doors">
${
  brand
    ? `
        <a class="ns-door ns-door--missing" href="#/welcome-alt" data-ns-reveal style="--i: 1">
          ${SKEL.door}
          <!-- The DS status card glued on top (2026-11-27, asked: « une status bar
               au dessus de l'invite à créer un playbook, pour
               signifier qu'il est manquant »): orange = action required. -->
          <span class="ap-status-card orange ns-door__status">
            <span class="upper">
              <i class="ap-icon-warning_fill" aria-hidden="true"></i>
              <span class="flow"><span>No Playbook yet.</span> My posts will sound generic.</span>
            </span>
          </span>
          <span class="ns-door__stage ns-voice" aria-hidden="true">
            <span class="ns-voice__post ns-voice__post--before">
              <span class="ap-status grey no-dot">Without a Playbook</span>
              <span class="ns-voice__text">Exciting news! We're thrilled to announce our brand new feature. Check it out today! #innovation #growth</span>
              <span class="ns-voice__sweep"></span>
            </span>
            <span class="ns-voice__post ns-voice__post--after">
              <span class="ap-status green no-dot">With your Playbook</span>
              <span class="ns-voice__text ns-voice__write">You asked for it <mark>three times in October</mark>. Bulk scheduling is live: pick 40 posts, one click, done.</span>
            </span>
            ${SPARKS}
          </span>
          <span class="ns-door__title">Sound like your Brand</span>
          <span class="ns-door__desc">Show me your website or a few files, and I'll learn your voice, your audience, and your look.</span>
          <span class="ap-link standalone ns-door__go">Create my Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
        </a>
`
    : ""
}

        <button type="button" class="ns-door" ${starterAttrs("open-video-clips")} data-ns-reveal style="--i: 2">
          ${SKEL.door}
          <span class="ns-door__stage ns-cut" aria-hidden="true">
            ${frame("ns-cut__wide", 500)}
            <span class="ns-cut__scan"></span>
            <span class="ns-cut__frames">${FRAME}${FRAME}${FRAME}</span>
            <span class="ns-cut__clips">
              ${frame("ns-cut__clip", 512, "13%", "We tried it")}
              ${frame("ns-cut__clip", 640, "87%", "It worked")}
              ${frame("ns-cut__clip", 771, "13%", "Here's why")}
            </span>
          </span>
          <span class="ns-door__title">Turn a video into clips</span>
          <span class="ns-door__desc">Drop a video or a YouTube link. I'll find the best moments, reframe them for vertical, and add subtitles.</span>
          <span class="ap-link standalone ns-door__go">Try it with a video<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
        </button>
      </div>`;
}

const MARK = `<span class="e-turn__mark" aria-hidden="true"><i class="ap-icon-archie-official"></i></span>`;

// The third turn: the requests as text, each led by its tone tile, no box.
const suggestion = ([k, text], n) => `
  <li data-ns-reveal style="--i: ${5 + n}">
    ${SKEL.ask}
    <button type="button" class="ns-suggest" data-starter="new-start" data-starter-prompt="${esc(text)}"
      title="Edit it before sending">
      <span class="ns-tile ns-tile--sm ns-tone--${KIND[k].tone}" aria-hidden="true"><i class="${KIND[k].icon}"></i></span>
      <span class="ns-suggest__text">“${esc(text)}”</span>
      <i class="ap-icon-pen ns-suggest__go" aria-hidden="true"></i>
    </button>
  </li>`;

// The first turn, typed once per page load.
const HELLO =
  "Hi, I'm Archie. Give me a link, a file, a video, or an idea, and I'll turn it into posts ready to schedule.";

const hello = () => `
      <div class="ns-turn">
        ${MARK}
        <div class="ns-turn__body">
          <p class="ns-say" data-ns-hello aria-label="${esc(HELLO)}">${esc(HELLO)}</p>
        </div>
      </div>`;

// The turns, the requests as my third turn, then the composer (session.js
// renders it, it is only placed here).
export function renderNewStart(composer = "") {
  return `
  <archie-new-start class="empty-chat ns ns--thread" data-empty-chat>
    ${hello()}
    <div class="ns-turn ns-turn--next" data-ns-next>
      <span class="ns-turn__gutter" aria-hidden="true"></span>
      <div class="ns-turn__body">
        <p class="ns-say" data-ns-reveal style="--i: 0">${SKEL.line}Here's what I do best. Pick one, or tell me what you need.</p>
        ${renderDoors()}
      </div>
    </div>
    <div class="ns-turn ns-turn--next" data-ns-next>
      <span class="ns-turn__gutter" aria-hidden="true"></span>
      ${renderAsks("ns-turn__body")}
    </div>
    <div class="ns__composer">${composer}</div>
  </archie-new-start>`;
}

// « Or ask me something like: » and the rotating requests — one renderer, two
// hosts: this page's third turn, and the new chat's hero under the composer
// (flag newChatHero, 2026-11-27, asked: « pareil pour les prompts en dessous du
// composer, tu peux t'inspirer de … newchat4 »). `cls` is the host's layout.
export function renderAsks(cls = "") {
  return `
      <archie-asks class="${cls} ns-suggests" data-ns-rotor>
        <p class="ns-say" data-ns-reveal style="--i: 4">${SKEL.line}Or ask me something like:</p>
        ${SETS.map((s, i) => `<ul class="ns-suggests__set" data-ns-set="${i}"${i ? " hidden" : ""} aria-label="Things you can ask me">${s.map((x, n) => suggestion(x, n)).join("")}</ul>`).join("")}
      </archie-asks>`;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A new set of requests every 6s, unless the reader is on them (pointer or
// focus), the page is hidden, or motion is reduced. The set stays where it was
// across a re-render of the hero.
let shown = 0;
class ArchieAsks extends HTMLElement {
  connectedCallback() {
    this.show(shown);
    this.timer = setInterval(() => {
      if (reduced() || document.hidden || this.matches(":hover, :focus-within")) return;
      this.show((shown + 1) % SETS.length, true);
    }, 6000);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  // `deal`: a new set comes in row after row (a rotation, not the first paint,
  // which reveals itself).
  show(i, deal = false) {
    shown = i;
    this.querySelectorAll("[data-ns-set]").forEach((ul) => {
      ul.hidden = Number(ul.dataset.nsSet) !== i;
      ul.classList.toggle("is-dealt", deal && !ul.hidden);
    });
  }
}

if (!customElements.get("archie-asks")) customElements.define("archie-asks", ArchieAsks);

let greeted = false;
class ArchieNewStart extends HTMLElement {
  connectedCallback() {
    this.hello();
  }

  disconnectedCallback() {
    clearTimeout(this.typing);
  }

  // The first turn types itself, once per page load; when it is done
  // the rest comes in one piece after the other ([data-ns-reveal], --i sets
  // the order), each its skeleton first, like a reply being written. A re-render shows it all at once.
  hello() {
    const p = this.querySelector("[data-ns-hello]");
    if (!p || greeted || reduced()) return;
    greeted = true;
    const text = p.textContent;
    let n = 0;
    this.classList.add("is-typing");
    p.textContent = "";
    const step = () => {
      n += 2;
      p.textContent = text.slice(0, n);
      if (n < text.length) this.typing = setTimeout(step, 22);
      else this.classList.replace("is-typing", "is-revealing");
    };
    this.typing = setTimeout(step, 350);
  }
}

if (!customElements.get("archie-new-start")) customElements.define("archie-new-start", ArchieNewStart);
