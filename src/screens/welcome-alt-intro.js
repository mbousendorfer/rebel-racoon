// /welcome-alt/intro — flag connectFirst: the very first screen of the app for a
// new user. It says what the setup will ask, and shows what comes out of it.
//
// Left, the steps, in the order the run will ask them: the account screen, the
// chat's own steps (altSteps(), so a flag that adds or drops a question changes
// this list too), then the review. Right, on Archie's warm pixel field, the
// Playbook those steps build — each step lights up as the part of the Playbook
// it produces lands on the card. One orchestrated load sequence, all CSS
// (`--i` per step), nothing after it. Reduced motion: the finished state.
//
// The card is an illustration, not data: the Playbook's real parts (Voice
// profile, Branding…) filled with example values.

import "../archie-pixels.js?v=1916";
import { html, raw } from "../utils.js?v=1922";
import { altSteps } from "../context-builder.js?v=1922";
import { NETWORK_ICON_BY_PLATFORM } from "../social-profiles.js?v=1922";
import { navigate } from "../router.js?v=1922";

const glyph = (net) =>
  `<span class="welcome-intro__net"><i class="${NETWORK_ICON_BY_PLATFORM[net]}" aria-hidden="true"></i></span>`;

// Per step: what the list says, and the line of the Playbook it builds.
const STEPS = {
  connect: {
    title: "Connect your social profiles",
    desc: "So I write for the networks you publish on.",
    label: "Publishes on",
    value: ["linkedin", "instagram", "facebook", "x"].map(glyph).join(""),
  },
  url: {
    title: "Show me your brand",
    desc: "Your website, a few files, or a handful of questions.",
    label: "Voice",
    value: ["Warm", "Witty", "Never salesy"].map((t) => `<span class="welcome-intro__trait">${t}</span>`).join(""),
  },
  language: {
    title: "Pick your language",
    desc: "The one I'll write your posts in.",
    label: "Writes in",
    value: `<span class="welcome-intro__plain">English</span>`,
  },
  network: {
    title: "Choose your main network",
    desc: "Your main voice is built for it.",
    label: "Main voice",
    value: `${glyph("linkedin")}<span class="welcome-intro__plain">LinkedIn</span>`,
  },
  documents: {
    title: "Add your documents",
    desc: "Optional — a brand book or guidelines.",
    label: "Branding",
    // An example brand palette.
    value: ["--app-convo-navy", "--ref-color-orange-100", "--ref-color-yellow-40", "--app-surface-subtle"]
      .map((token) => `<span class="welcome-intro__swatch" style="background: var(${token})"></span>`)
      .join(""),
  },
  recap: {
    title: "Review your Playbook",
    desc: "Everything I learned, on one page you can edit.",
  },
};

export function renderWelcomeAltIntro(_params, target) {
  const steps = ["connect", ...altSteps().filter((id) => STEPS[id]), "recap"];
  const rows = steps.filter((id) => STEPS[id].label);
  const last = steps.length - 1;

  target.innerHTML = html`
    <div class="welcome-intro">
      <section class="welcome-intro__lede" aria-labelledby="welcomeIntroTitle">
        <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
        <div class="welcome-intro__copy">
          <h1 class="welcome-intro__title" id="welcomeIntroTitle">Let's get to know your brand.</h1>
          <p class="welcome-intro__sub">
            ${steps.length} short steps, a few minutes. Skip anything optional: you review it all before I write a word.
          </p>
          <ol class="welcome-intro__steps">
            ${steps.map(
              (id, i) => html`
                <li class="welcome-intro__step" style="--i: ${i}">
                  <span class="welcome-intro__num" aria-hidden="true">${i + 1}</span>
                  <span class="welcome-intro__text">
                    <span class="welcome-intro__step-title">${STEPS[id].title}</span>
                    <span class="welcome-intro__step-desc">${STEPS[id].desc}</span>
                  </span>
                </li>
              `,
            )}
          </ol>
          <div class="welcome-intro__actions">
            <button type="button" class="ap-button primary orange" data-welcome-begin>
              <span>Let's go</span>
              <i class="ap-icon-arrow-right"></i>
            </button>
          </div>
        </div>
      </section>

      <div class="welcome-intro__stage" aria-hidden="true">
        <archie-pixels data-quiet></archie-pixels>
        <div class="welcome-intro__card">
          <div class="welcome-intro__card-head">
            <span class="welcome-intro__brand"><i class="ap-icon-buildings"></i></span>
            <span class="welcome-intro__card-title">Your Playbook</span>
          </div>
          <dl class="welcome-intro__rows">
            ${rows.map(
              (id) => html`
                <div class="welcome-intro__row" style="--i: ${steps.indexOf(id)}">
                  <dt>${STEPS[id].label}</dt>
                  <dd>${raw(STEPS[id].value)}</dd>
                </div>
              `,
            )}
          </dl>
          <div class="welcome-intro__card-foot" style="--i: ${last}">
            <span class="ap-status mermaid">Ready to write</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const onClick = (event) => {
    if (event.target.closest("[data-welcome-begin]")) navigate("/welcome-alt/connect");
  };
  target.addEventListener("click", onClick);
  return () => target.removeEventListener("click", onClick);
}
