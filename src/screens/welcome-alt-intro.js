// /welcome-alt/intro — the very first screen of the app for a
// new user. It says what we build together (a Playbook), what one is and why
// it's needed (every post starts from it), then what the setup will ask — and
// shows what comes out of it.
//
// Left, the steps, in the order the run will ask them: the account screen, the
// chat's own steps (altSteps(), so a flag that adds or drops a question changes
// this list too), then the review. Right, the scene that teaches what a
// Playbook changes (welcome-alt-explainer.js).

import { html, raw } from "../utils.js?v=2970";
import { navigate } from "../router.js?v=2970";
import { flowSteps, startFlow, STEP_TEXT, tint } from "./welcome-alt-shell.js?v=2970";
import { RECAP_SECTIONS } from "../playbook-view.js?v=2970";
import { paintExplainer } from "./welcome-alt-explainer.js?v=2970";

// What a Playbook holds, shown rather than told: its parts, under their
// Playbook names, glyphs and tints.
const PARTS = ["goals", "voice", "brand", "competitors"];

// The rail stays quiet — the colour lives once, in the parts above. A step
// gets a line only where its title doesn't say why it's asked; the documents
// step is marked Optional instead.
// Short (2026-10-29, asked: « TROP verbeuse … alléger »): only where the title
// leaves a question open.
const STEP_HINT = {
  url: "No website? I'll ask a few questions.",
  voiceFrom: "Your posts, a document, or your own words.",
};
const OPTIONAL = new Set(["documents"]);

export function renderWelcomeAltIntro(_params, target) {
  const steps = flowSteps();
  target.innerHTML = html`
    <div class="welcome-intro is-plain">
      <section class="welcome-intro__lede" aria-labelledby="welcomeIntroTitle">
        <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
        <div class="welcome-intro__copy">
          <h1 class="welcome-intro__title" id="welcomeIntroTitle">Let's build your Playbook together.</h1>
          <p class="welcome-intro__sub">It tells me what you do and how you talk, so every draft sounds like you.</p>
          <ul class="welcome-intro__parts" aria-label="What a Playbook holds">
            ${PARTS.map((t) => {
              const part = RECAP_SECTIONS.find((sec) => sec.id === t);
              return html`
                <li class="welcome-intro__part-pill" style="${tint(t)}">
                  <i class="${part?.icon || ""}" aria-hidden="true"></i>${part?.title || ""}
                </li>
              `;
            })}
          </ul>
          <ol class="welcome-intro__steps">
            ${steps.map(
              (id, i) => html`
                <li class="welcome-intro__step" style="--i: ${i}">
                  <span class="welcome-intro__num" aria-hidden="true">${i + 1}</span>
                  <span class="welcome-intro__text">
                    <span class="welcome-intro__step-title">
                      ${STEP_TEXT[id].title}
                      ${OPTIONAL.has(id) ? raw(`<span class="welcome-intro__optional">Optional</span>`) : ""}
                    </span>
                    ${STEP_HINT[id] ? raw(html`<span class="welcome-intro__step-desc">${STEP_HINT[id]}</span>`) : ""}
                  </span>
                </li>
              `,
            )}
          </ol>
          <div class="welcome-intro__actions">
            <button type="button" class="ap-button primary orange" data-welcome-begin>
              <span>Build my Playbook</span>
              <i class="ap-icon-arrow-right"></i>
            </button>
            <span class="welcome-intro__time">${steps.length} steps · about 3 min</span>
          </div>
          <!-- Clips first (2026-10-29): cutting clips needs no Playbook, and
               nothing blocks the drafts after — the Playbook only makes them
               sound like you. The same option row as the run's other ways in. -->
          <div class="welcome-intro__clips">
            <p class="welcome-flow__or">Only here for video clips?</p>
            <button type="button" class="welcome-flow__option" data-welcome-clips>
              <span
                class="welcome-flow__glyph is-icon is-tinted"
                style="--part-tint: var(--ref-color-purple-20); --part-ink: var(--ref-color-purple-150)"
                ><i class="ap-icon-video" aria-hidden="true"></i
              ></span>
              <span class="welcome-flow__option-text">
                <span class="welcome-flow__option-title">Start with video clips</span>
                <span class="welcome-flow__option-desc">Cut clips now, build your Playbook later.</span>
              </span>
              <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </section>

      <div class="welcome-intro__stage"><div class="welcome-explainer" data-intro-explainer></div></div>
    </div>
  `;
  const sceneEl = target.querySelector("[data-intro-explainer]");
  if (sceneEl) paintExplainer(sceneEl, "intro", null);

  const onClick = (event) => {
    if (event.target.closest("[data-welcome-clips]")) {
      // The same way in as the « Extract video clips » starter.
      return navigate("/clips");
    }
    if (!event.target.closest("[data-welcome-begin]")) return;
    startFlow();
    navigate("/welcome-alt/brand");
  };
  target.addEventListener("click", onClick);
  return () => target.removeEventListener("click", onClick);
}
