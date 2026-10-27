// /welcome-alt/intro — flag connectFirst: the very first screen of the app for a
// new user. It says what we build together (a Playbook), what one is and why
// it's needed (every post starts from it), then what the setup will ask — and
// shows what comes out of it.
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

import "../archie-pixels.js?v=2238";
import { startDemo } from "../demo-flow.js?v=2238";
import { isFlagOn } from "../feature-flags.js?v=2238";
import { html, raw, escapeHtml } from "../utils.js?v=2238";
import {
  NETWORK_ICON_BY_PLATFORM,
  NETWORKS,
  getConnectedProfiles,
  getConnectableNetworks,
} from "../social-profiles.js?v=2238";
import { navigate } from "../router.js?v=2238";
import { flowSteps, startFlow, STEP_TEXT, playbookCard, tint } from "./welcome-alt-shell.js?v=2238";
import { RECAP_SECTIONS } from "../playbook-view.js?v=2238";

// What a Playbook holds, shown rather than told: the parts the card on the
// right fills, under their Playbook names, glyphs and tints.
const PARTS = ["goals", "voice", "brand", "competitors"];

// The rail stays quiet — the colour lives once, in the parts above. A step
// gets a line only where its title doesn't say why it's asked; the documents
// step is marked Optional instead.
const STEP_HINT = {
  connect: () =>
    raw(
      `<span class="welcome-intro__nets"><span>Works with</span><span class="welcome-intro__nets" role="list" aria-label="Supported networks">${supportedNetworks()
        .map(
          (n) =>
            `<span class="welcome-intro__net-name" role="listitem"><i class="${n.icon}" aria-hidden="true"></i>${escapeHtml(n.label)}</span>`,
        )
        .join("")}</span></span>`,
    ),
  url: "Your website is all I need. No website? I'll ask a few questions.",
};
const OPTIONAL = new Set(["documents"]);

// The networks the account step actually offers (connected or connectable),
// named — so nobody starts the run expecting one that isn't there.
function supportedNetworks() {
  const ids = new Set([
    ...getConnectedProfiles().map((p) => p.platform),
    ...getConnectableNetworks().map((n) => n.platform),
  ]);
  return Object.keys(NETWORKS)
    .filter((id) => ids.has(id))
    .map((id) => NETWORKS[id]);
}

const glyph = (net) =>
  `<span class="welcome-intro__net"><i class="${NETWORK_ICON_BY_PLATFORM[net]}" aria-hidden="true"></i></span>`;

const chips = (list, cls = "welcome-flow__chip") =>
  `<span class="welcome-flow__chips">${list.map((t) => `<span class="${cls}">${t}</span>`).join("")}</span>`;
const line = (t) => `<span class="welcome-flow__line">${t}</span>`;

// The example card, line by line — each line belongs to the step that builds
// it, and lands when that step lights up (the step names are STEP_TEXT). The
// Playbook's real parts, filled with an example brand.
const ROWS = [
  { step: "connect", label: "Publishes on", value: ["linkedin", "instagram", "facebook", "x"].map(glyph).join("") },
  {
    step: "url",
    label: "About",
    value: line("Small-batch soap, made by hand in Lyon with plant oils and nothing you can't pronounce."),
  },
  {
    step: "url",
    label: "Voice",
    value: `<span class="welcome-flow__stack">${chips(["Warm", "Witty", "Never salesy"], "welcome-intro__trait")}${line(
      "Talks like a friend who knows their stuff — short sentences, one idea per post.",
    )}</span>`,
  },
  {
    step: "url",
    label: "Who you write for",
    value: `<span class="welcome-flow__stack">${line("People who read the label")}${chips([
      "Sensitive skin",
      "Less plastic",
    ])}</span>`,
  },
  { step: "url", label: "Goal", value: chips(["Brand awareness", "Visit the shop"]) },
  { step: "language", label: "Writes in", value: `<span class="welcome-intro__plain">English</span>` },
  {
    step: "documents",
    label: "Colors & type",
    // An example brand palette.
    value: ["--app-convo-navy", "--ref-color-orange-100", "--ref-color-yellow-40", "--app-surface-subtle"]
      .map((token) => `<span class="welcome-intro__swatch" style="background: var(${token})"></span>`)
      .join(""),
  },
];

export function renderWelcomeAltIntro(_params, target) {
  const steps = flowSteps();
  const rows = ROWS.filter((r) => steps.includes(r.step));
  const last = steps.length - 1;

  target.innerHTML = html`
    <div class="welcome-intro">
      <section class="welcome-intro__lede" aria-labelledby="welcomeIntroTitle">
        <img class="welcome-intro__wordmark" src="assets/logos/archie-wordmark.svg" alt="Archie" />
        <div class="welcome-intro__copy">
          <h1 class="welcome-intro__title" id="welcomeIntroTitle">Let's build your Playbook together.</h1>
          <p class="welcome-intro__sub">
            A Playbook is the guide I write from — what your Brand does, how it sounds, and how it looks — so every post
            feels like yours.
          </p>
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
                    ${STEP_HINT[id]
                      ? raw(
                          html`<span class="welcome-intro__step-desc"
                            >${typeof STEP_HINT[id] === "function" ? STEP_HINT[id]() : STEP_HINT[id]}</span
                          >`,
                        )
                      : ""}
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
            ${isFlagOn("demoMode")
              ? raw(
                  `<button type="button" class="ap-button stroked grey" data-welcome-demo>Try it with a demo brand</button>`,
                )
              : ""}
          </div>
        </div>
      </section>

      <div class="welcome-intro__stage" aria-hidden="true">
        <archie-pixels data-quiet></archie-pixels>
        <div class="welcome-intro__card">
          ${raw(
            playbookCard({
              mark: `<i class="ap-icon-buildings" aria-hidden="true"></i>`,
              name: "Your Playbook",
              status: `<span class="ap-status mermaid welcome-intro__card-status" style="--i: ${last}">Ready to write</span>`,
              // Several lines from one step land one after the other.
              rows: rows.map((r) => ({
                label: r.label,
                html: r.value,
                style: `--i: ${steps.indexOf(r.step) + rows.filter((o) => o.step === r.step).indexOf(r) * 0.18}`,
              })),
            }),
          )}
        </div>
      </div>
    </div>
  `;

  const onClick = (event) => {
    if (event.target.closest("[data-welcome-demo]")) return startDemo();
    if (!event.target.closest("[data-welcome-begin]")) return;
    startFlow();
    navigate("/welcome-alt/connect");
  };
  target.addEventListener("click", onClick);
  return () => target.removeEventListener("click", onClick);
}
