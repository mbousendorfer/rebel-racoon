// New Start (flags newStart2 · newStart3, 2026-11-26): the new chat a first-time user
// lands on while they have no Playbook. Asked: « un utilisateur arrive sur cette
// page, et découvre Archie … il faut lui indiquer qu'il est possible de créer un
// Playbook … sous le textarea, des requêtes … qui tournent … une entrée pour le
// vidéo clipping », then « 1 · Portes vivantes » for the body, then « pas fan
// que tu aies réutilisé le nuage de points … redesign cet écran de rien » and
// « les 3 sous 3 FS » for the top, then « #1 : supprimes ». So: two tops, one
// per flag, no pixel halo, no wordmark (#1, a mark and a large headline on a
// blank page, was deleted) —
//   #2 the wall of posts: the formats I write drift behind the headline;
//   #3 Archie opens: no hero, two turns of a thread — hello (typed live), then
//      the doors as my offer — and the composer under them.
//
// The body, the same under both: the real composer, three example
// requests (a new set every few seconds, one is always a video), then two
// doors, each playing what it does:
//   · Sound like your brand — a generic post rewritten in a brand's voice → the
//     setup run (/welcome-alt), the one way a Playbook is made;
//   · Turn a video into clips — the seeded podcast, wide, cut into three
//     vertical clips → the clips starter (flag clipsSpace: /clips).
//
// Every door is an existing hook: a request row is a `data-starter` with only a
// prompt (session.js puts it in the box and focuses it, nothing is sent), the
// video door is the clips starter. What is local (the rotation, #3's typing)
// lives in <archie-new-start>, which wires itself.

import { seedVideos, chatStarters } from "../../mocks.js?v=2879";
import { escapeHtml } from "../../utils.js?v=2879";
import { networkIcon } from "../../social-profiles.js?v=2879";

const esc = escapeHtml;

// The hooks session.js reads to run a workflow starter, by its action.
function starterAttrs(action) {
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

const row = ([k, text]) => `
  <li>
    <button type="button" class="ns-ask" data-starter="new-start" data-starter-prompt="${esc(text)}"
      title="Put it in the box to edit">
      <span class="ns-tile ns-tile--sm ns-tone--${KIND[k].tone}" aria-hidden="true"><i class="${KIND[k].icon}"></i></span>
      <span class="ns-ask__text">${esc(text)}</span>
      <i class="ap-icon-pen ns-ask__go" aria-hidden="true"></i>
    </button>
  </li>`;

// The podcast's wide shot, then three moments cropped to 9:16 on a speaker, the
// way Clips frames it (13% / 87%: each speaker's centre).
const video = seedVideos[0];
const frame = (cls, sec, pos = "50%", caption = "") => `
  <span class="${cls}">
    <video src="${esc(video.url)}#t=${sec}" muted playsinline preload="metadata" style="object-position:${pos} 50%"></video>
    ${caption ? `<span class="ns-cut__caption">${esc(caption)}</span>` : ""}
  </span>`;

// The doors and the requests are the same under both tops.
function doors() {
  return `
      <div class="ns-doors">
        <a class="ns-door" href="#/welcome-alt" data-ns-reveal style="--i: 1">
          <span class="ns-door__stage ns-voice" aria-hidden="true">
            <span class="ns-voice__post ns-voice__post--before">
              <span class="ap-status grey no-dot">Without a Playbook</span>
              <span class="ns-voice__text">Exciting news! We're thrilled to announce our brand new feature. Check it out today! #innovation #growth</span>
            </span>
            <span class="ns-voice__post ns-voice__post--after">
              <span class="ap-status green no-dot">With your Playbook</span>
              <span class="ns-voice__text">You asked for it <mark>three times in October</mark>. Bulk scheduling is live: pick 40 posts, one click, done.</span>
            </span>
          </span>
          <span class="ns-door__title">Sound like your brand</span>
          <span class="ns-door__desc">Without a Playbook, my posts stay generic. Give me your website and I'll learn your voice, your audience and your look.</span>
          <span class="ap-link standalone ns-door__go">Create my Playbook<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
        </a>

        <button type="button" class="ns-door" ${starterAttrs("open-video-clips")} data-ns-reveal style="--i: 2">
          <span class="ns-door__stage ns-cut" aria-hidden="true">
            ${frame("ns-cut__wide", 500)}
            <span class="ns-cut__clips">
              ${frame("ns-cut__clip", 512, "13%", "We tried it")}
              ${frame("ns-cut__clip", 640, "87%", "It worked")}
              ${frame("ns-cut__clip", 771, "13%", "Here's why")}
            </span>
          </span>
          <span class="ns-door__title">Turn a video into clips</span>
          <span class="ns-door__desc">Drop a video or a YouTube link. I'll find the best moments, frame them vertical and caption them.</span>
          <span class="ap-link standalone ns-door__go">Try it with a video<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
        </button>
      </div>`;
}

const asks = () => `
      <div class="ns-asks" data-ns-rotor aria-label="Things you can ask me">
        ${SETS.map((s, i) => `<ul class="ns-asks__set" data-ns-set="${i}"${i ? " hidden" : ""}>${s.map(row).join("")}</ul>`).join("")}
      </div>`;

// No halo, no wordmark: the composer on the page's own ground.
const lead = (composer) => `<div class="empty-chat__lead ns__lead">${composer}</div>`;

const MARK = `<span class="e-turn__mark" aria-hidden="true"><i class="ap-icon-archie-official"></i></span>`;

// #2's band: the formats I write, drifting. Twice the same run, so the loop
// has no seam (the track moves by half its width).
const WALL = [
  ["post", "linkedin", "Three things we learned shipping bulk scheduling in 11 weeks."],
  ["clip", "", "We tried it"],
  ["post", "instagram", "Behind the scenes of launch week. Swipe for the whiteboard."],
  ["carousel", "", "5 mistakes we made with our first newsletter"],
  ["post", "x", "We almost cut this feature. Here's why we didn't."],
  ["clip", "", "Here's why"],
  ["post", "facebook", "Our support team answered 1,200 messages last month. One lesson stood out."],
  ["carousel", "", "How we plan a month of posts in an hour"],
];
const wallCard = ([kind, net, text]) => {
  if (kind === "clip")
    return `<span class="ns-wall__card ns-wall__card--clip"><i class="ap-icon-play"></i><span class="ns-cut__caption">${esc(text)}</span></span>`;
  if (kind === "carousel")
    return `<span class="ns-wall__card ns-wall__card--carousel"><span class="ns-wall__slide">${esc(text)}</span><span class="ns-wall__count">1/5</span></span>`;
  return `<span class="ns-wall__card"><i class="${networkIcon(net)}"></i><span>${esc(text)}</span></span>`;
};

// #4's third turn: the same requests as text, each led by its tone tile, no box.
const suggestion = ([k, text], n) => `
  <li data-ns-reveal style="--i: ${5 + n}">
    <button type="button" class="ns-suggest" data-starter="new-start" data-starter-prompt="${esc(text)}"
      title="Put it in the box to edit">
      <span class="ns-tile ns-tile--sm ns-tone--${KIND[k].tone}" aria-hidden="true"><i class="${KIND[k].icon}"></i></span>
      <span class="ns-suggest__text">“${esc(text)}”</span>
      <i class="ap-icon-pen ns-suggest__go" aria-hidden="true"></i>
    </button>
  </li>`;

// #3 and #4's first turn, typed once per page load.
const HELLO =
  "Hi, I'm Archie. Give me a link, a file, a video or just an idea, and I'll turn it into posts ready to schedule.";

const hello = () => `
      <div class="ns-turn">
        ${MARK}
        <div class="ns-turn__body">
          <p class="ns-say" data-ns-hello aria-label="${esc(HELLO)}">${esc(HELLO)}</p>
        </div>
      </div>`;

export function renderNewStart({ composer, variant = 2 }) {
  // #4: #3 with the composer at the foot (session.js renders it there), the
  // turns centred, the requests as my third turn instead of a box.
  if (variant === 4) {
    return `
    <archie-new-start class="empty-chat ns ns--thread ns--foot" data-empty-chat>
      ${hello()}
      <div class="ns-turn ns-turn--next" data-ns-next>
        <span class="ns-turn__gutter" aria-hidden="true"></span>
        <div class="ns-turn__body">
          <p class="ns-say" data-ns-reveal style="--i: 0">Here's where I'm best. Pick one, or just tell me what you need.</p>
          ${doors()}
        </div>
      </div>
      <div class="ns-turn ns-turn--next" data-ns-next>
        <span class="ns-turn__gutter" aria-hidden="true"></span>
        <div class="ns-turn__body ns-suggests" data-ns-rotor>
          <p class="ns-say" data-ns-reveal style="--i: 4">Or ask me something like:</p>
          ${SETS.map((s, i) => `<ul class="ns-suggests__set" data-ns-set="${i}"${i ? " hidden" : ""} aria-label="Things you can ask me">${s.map((x, n) => suggestion(x, n)).join("")}</ul>`).join("")}
        </div>
      </div>
    </archie-new-start>`;
  }
  if (variant === 3) {
    return `
    <archie-new-start class="empty-chat empty-chat--rows ns ns--thread" data-empty-chat>
      ${hello()}
      <div class="ns-turn ns-turn--next" data-ns-next>
        <span class="ns-turn__gutter" aria-hidden="true"></span>
        <div class="ns-turn__body">
          <p class="ns-say" data-ns-reveal style="--i: 0">Here's where I'm best. Pick one, or just tell me what you need.</p>
          ${doors()}
        </div>
      </div>
      ${lead(composer)}
      ${asks()}
    </archie-new-start>`;
  }
  return `
    <archie-new-start class="empty-chat empty-chat--rows ns ns--wall" data-empty-chat>
      <div class="ns-wall" aria-hidden="true">
        <div class="ns-wall__track">${[...WALL, ...WALL].map(wallCard).join("")}</div>
      </div>
      <h1 class="ns-title">What should we post this week?</h1>
      ${lead(composer)}
      ${asks()}
      ${doors()}
    </archie-new-start>`;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A new set of requests every 6s, unless the reader is on them (pointer or
// focus), the page is hidden, or motion is reduced. The set stays where it was
// across a re-render of the hero.
let shown = 0;
let greeted = false;
class ArchieNewStart extends HTMLElement {
  connectedCallback() {
    this.show(shown);
    this.hello();
    this.timer = setInterval(() => {
      const rotor = this.querySelector("[data-ns-rotor]");
      if (reduced() || document.hidden || rotor?.matches(":hover, :focus-within")) return;
      this.show((shown + 1) % SETS.length, true);
    }, 6000);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    clearTimeout(this.typing);
  }

  // #3 / #4: the first turn types itself, once per page load; when it is done
  // the rest comes in one piece after the other ([data-ns-reveal], --i sets
  // the order), like a reply being written. A re-render shows it all at once.
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
      else this.classList.remove("is-typing");
    };
    this.typing = setTimeout(step, 350);
  }

  // `deal`: a new set comes in row after row (a rotation, not the first paint,
  // which #3 / #4 reveal on their own).
  show(i, deal = false) {
    shown = i;
    this.querySelectorAll("[data-ns-set]").forEach((ul) => {
      ul.hidden = Number(ul.dataset.nsSet) !== i;
      ul.classList.toggle("is-dealt", deal && !ul.hidden);
    });
  }
}

if (!customElements.get("archie-new-start")) customElements.define("archie-new-start", ArchieNewStart);
