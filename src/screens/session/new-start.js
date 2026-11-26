// New Start (flag newStart, 2026-11-26): the new chat a first-time user lands
// on while they have no Playbook. Asked: « un utilisateur arrive sur cette page,
// et découvre Archie … il faut lui indiquer qu'il est possible de créer un
// Playbook … sous le textarea, des requêtes … qui tournent … une entrée pour le
// vidéo clipping », then, of three hybrids, « 1 · Portes vivantes ».
//
// Top to bottom: the wordmark, one line, the real composer on the pixel halo,
// three example requests (a new set every few seconds, one is always a video),
// then two doors, each playing what it does:
//   · Sound like your brand — a generic post rewritten in a brand's voice → the
//     setup run (/welcome-alt), the one way a Playbook is made;
//   · Turn a video into clips — the seeded podcast, wide, cut into three
//     vertical clips → the clips starter (flag clipsSpace: /clips).
//
// Every door is an existing hook: a request row is a `data-starter` with only a
// prompt (session.js puts it in the box and focuses it, nothing is sent), the
// video door is the clips starter. What is local, the rotation, lives in
// <archie-new-start>, which wires itself like <archie-home>.

import { seedVideos } from "../../mocks.js?v=2857";
import { escapeHtml } from "../../utils.js?v=2857";
import { starterAttrs } from "./home-directions.js?v=2857";
import "../../archie-pixels.js?v=2857";

const esc = escapeHtml;

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
    <button type="button" class="nch-ask" data-starter="new-start" data-starter-prompt="${esc(text)}"
      title="Put it in the box to edit">
      <span class="nch-tile nch-tile--sm nch-tone--${KIND[k].tone}" aria-hidden="true"><i class="${KIND[k].icon}"></i></span>
      <span class="nch-ask__text">${esc(text)}</span>
      <i class="ap-icon-pen nch-ask__go" aria-hidden="true"></i>
    </button>
  </li>`;

// The podcast's wide shot, then three moments cropped to 9:16 on a speaker, the
// way Clips frames it (13% / 87%: each speaker's centre, as in home-directions).
const video = seedVideos[0];
const frame = (cls, sec, pos = "50%", caption = "") => `
  <span class="${cls}">
    <video src="${esc(video.url)}#t=${sec}" muted playsinline preload="metadata" style="object-position:${pos} 50%"></video>
    ${caption ? `<span class="ns-cut__caption">${esc(caption)}</span>` : ""}
  </span>`;

export function renderNewStart({ composer }) {
  return `
    <archie-new-start class="empty-chat empty-chat--rows ns" data-empty-chat>
      <span class="empty-chat__logo" role="img" aria-label="Archie">
        <img class="empty-chat__logo-word empty-chat__logo-word--a" src="assets/logos/archie-wordmark.svg" alt="" />
        <img class="empty-chat__logo-mono" src="assets/logos/archie-mono.svg" alt="" />
        <img class="empty-chat__logo-word empty-chat__logo-word--b" src="assets/logos/archie-alt-wordmark.svg" alt="" />
      </span>
      <div class="empty-chat__sub">Give me a link, a file, a video or just an idea. I'll turn it into posts.</div>
      <div class="empty-chat__lead">
        <archie-pixels class="empty-chat__pixels" data-quiet data-ripple aria-hidden="true"></archie-pixels>
        ${composer}
      </div>

      <div class="ns-asks" aria-label="Things you can ask me">
        ${SETS.map((s, i) => `<ul class="nch-asks ns-asks__set" data-ns-set="${i}"${i ? " hidden" : ""}>${s.map(row).join("")}</ul>`).join("")}
      </div>

      <div class="ns-doors">
        <a class="ns-door" href="#/welcome-alt">
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

        <button type="button" class="ns-door" ${starterAttrs("open-video-clips")}>
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
      </div>
    </archie-new-start>`;
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A new set of requests every 6s, unless the reader is on them (pointer or
// focus), the page is hidden, or motion is reduced. The set stays where it was
// across a re-render of the hero.
let shown = 0;
class ArchieNewStart extends HTMLElement {
  connectedCallback() {
    this.show(shown);
    this.timer = setInterval(() => {
      const asks = this.querySelector(".ns-asks");
      if (reduced() || document.hidden || asks?.matches(":hover, :focus-within")) return;
      this.show((shown + 1) % SETS.length);
    }, 6000);
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  show(i) {
    shown = i;
    this.querySelectorAll("[data-ns-set]").forEach((ul) => (ul.hidden = Number(ul.dataset.nsSet) !== i));
  }
}

if (!customElements.get("archie-new-start")) customElements.define("archie-new-start", ArchieNewStart);
