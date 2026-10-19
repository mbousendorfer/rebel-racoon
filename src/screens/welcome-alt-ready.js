// /welcome-alt/ready — flag connectFirst: the end of the first-time run.
//
// Two beats on one screen. Building: the stages of the analysis tick on the
// left (the recap's own stage lists, by source) while the card on the right
// fills with what's learned. Then the reveal: "Your Playbook is ready." and the
// way out — Start writing (saves and enters Archie, the recap's enterArchie),
// or Review the details (the full, editable Playbook page, /welcome-alt/recap).
// A Playbook filled by hand has nothing to build: straight to the reveal, and
// its way out is filling it in.

import { html, raw } from "../utils.js?v=1987";
import { navigate } from "../router.js?v=1987";
import { getDraft, isAnalysisReady, patchDraft, readAltWebsite } from "../context-builder.js?v=1987";
import {
  LOADING_STAGES,
  FILE_LOADING_STAGES,
  INTERVIEW_LOADING_STAGES,
  withNetworkStage,
  enterArchie,
} from "./welcome-alt-recap.js?v=1987";
import { ensureFlowDraft, goBack, mountShell } from "./welcome-alt-shell.js?v=1987";

const STAGE_MS = 1300; // each stage holds at least this long, so the work reads as work
const started = new Map(); // sid → when this screen first showed it (a re-render doesn't restart it)

function stagesFor(d) {
  if (d?.sourceType === "documents") return FILE_LOADING_STAGES;
  if (d?.sourceType === "interview") return INTERVIEW_LOADING_STAGES;
  return withNetworkStage(LOADING_STAGES, d);
}

export function renderWelcomeAltReady(_params, target) {
  const sid = ensureFlowDraft();
  const d0 = getDraft(sid);
  // Reached without a source (a deep link): read the prefilled site, as the
  // brand step would have.
  if (d0 && d0.sourceType !== "manual" && !d0.analysisStartedAt) readAltWebsite(sid, d0.websiteUrl);
  if (!started.has(sid)) started.set(sid, Date.now());

  const progress = () => {
    const d = getDraft(sid);
    if (d?.sourceType === "manual") return { done: true, at: 0, stages: [] };
    const stages = stagesFor(d);
    const elapsed = Date.now() - started.get(sid);
    const at = Math.min(Math.floor(elapsed / STAGE_MS), stages.length - 1);
    const done = isAnalysisReady(sid) && elapsed >= stages.length * STAGE_MS;
    return { done, at, stages };
  };

  let shown = "";
  const left = () => {
    const { done, at, stages } = progress();
    const manual = getDraft(sid)?.sourceType === "manual";
    if (done) {
      return html`
        <h1 class="welcome-flow__title" id="welcomeFlowTitle">
          ${manual ? "Your Playbook is ready to fill." : "Your Playbook is ready."}
        </h1>
        <p class="welcome-intro__sub">
          ${manual
            ? "Tell me how your brand sounds and who it speaks to — every draft I write starts there."
            : "Every draft I write starts from it. You can change anything, any time, from your Playbook."}
        </p>
        <div class="welcome-flow__actions is-reveal">
          ${manual
            ? raw(`<button type="button" class="ap-button primary orange" data-ready-review>
                <span>Fill in my Playbook</span><i class="ap-icon-arrow-right"></i>
              </button>`)
            : raw(`<button type="button" class="ap-button stroked grey" data-ready-review>Review the details</button>
              <button type="button" class="ap-button primary orange" data-ready-start>
                <span>Start writing</span><i class="ap-icon-arrow-right"></i>
              </button>`)}
        </div>
      `;
    }
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Building your Playbook</h1>
      <p class="welcome-intro__sub">A few seconds. Watch it come together on the right.</p>
      <ol class="welcome-flow__stages" aria-live="polite">
        ${stages.map(
          (st, i) => html`
            <li class="welcome-flow__stage ${i < at ? "is-done" : i === at ? "is-current" : ""}">
              <span class="welcome-flow__stage-mark" aria-hidden="true">
                ${i < at ? raw(`<i class="ap-icon-check"></i>`) : ""}
              </span>
              <span class="welcome-intro__text">
                <span class="welcome-intro__step-title">${st.title}</span>
                ${i === at ? raw(`<span class="welcome-intro__step-desc">${st.sub}</span>`) : ""}
              </span>
            </li>
          `,
        )}
      </ol>
      <div class="welcome-flow__actions">
        <button type="button" class="ap-button ghost grey" data-flow-back>
          <i class="ap-icon-arrow-left"></i><span>Back</span>
        </button>
      </div>
    `;
  };

  const shell = mountShell(target, { step: "recap", sid, left });
  const card = target.querySelector("[data-flow-card]");
  // The reveal: the card says it's ready, and takes a breath.
  const reveal = (done) => {
    card.classList.toggle("is-revealed", done);
    if (done && !getDraft(sid)?.revealed) patchDraft(sid, { revealed: true });
  };
  // Repaint only when the state the left shows changes.
  const tick = () => {
    const { done, at } = progress();
    const key = `${done}:${at}`;
    if (key === shown) return;
    shown = key;
    shell.paint();
    reveal(done);
  };
  shown = `${progress().done}:${progress().at}`;
  reveal(progress().done);
  const timer = window.setInterval(tick, 200);

  const onClick = (event) => {
    if (event.target.closest("[data-ready-start]")) enterArchie(sid);
    else if (event.target.closest("[data-ready-review]")) navigate("/welcome-alt/recap");
    else if (event.target.closest("[data-flow-back]")) goBack("recap");
  };
  target.addEventListener("click", onClick);
  return () => {
    window.clearInterval(timer);
    shell.cleanup();
    target.removeEventListener("click", onClick);
  };
}
