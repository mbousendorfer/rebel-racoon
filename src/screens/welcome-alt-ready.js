// /welcome-alt/ready — the end of the first-time run.
//
// Two beats on one screen. Building: the stages of the analysis tick on the
// left (the recap's own stage lists, by source) while the card on the right
// fills with what's learned. Then the reveal: "Your Playbook is ready." and the
// way out — Check what I learned (the review, /welcome-alt/recap), Check my voice
// (/welcome-alt/voice) or Start
// writing (saves and enters Archie, the recap's enterArchie). Back, always.
// A Playbook filled by hand has nothing to build: straight to the reveal, and
// its way out is filling it in.

import { html, raw } from "../utils.js?v=2575";
import { navigate } from "../router.js?v=2575";
import { getDraft, isAnalysisReady, patchDraft, readAltWebsite } from "../context-builder.js?v=2575";
import { finishLabel, finishRun, isIntegrated } from "./welcome-alt-recap.js?v=2575";
import { ensureFlowDraft, goBack, mountShell, stagesFor } from "./welcome-alt-shell.js?v=2575";
import { onlyNetwork, networkVoiceOn } from "../voice-parts.js?v=2575";
import { networkLabel } from "../social-profiles.js?v=2575";

// Where the default voice was read from, said on the reveal.
const READ_FROM = { website: "your site", documents: "your files", interview: "your answers" };

const STAGE_MS = 1300; // each stage holds at least this long, so the work reads as work
const started = new Map(); // sid → when this screen first showed it (a re-render doesn't restart it)

// The way out: two rows like every step's choices — a full-weight way into the
// Playbook, not a stroked "Review the details" (2026-10-19) — and Start
// writing FEATURED among them: it is where the run ends, so its row is taller,
// in the AI orange (border, a light orange ground, an orange tile).
const choice = ({ hook, icon, title, desc, featured = false }) => `
  <li>
    <button type="button" class="welcome-flow__option${featured ? " is-featured" : ""}" ${hook}>
      <span class="welcome-flow__glyph is-icon"><i class="${icon}" aria-hidden="true"></i></span>
      <span class="welcome-flow__option-text">
        <span class="welcome-flow__option-title">${title}</span>
        <span class="welcome-flow__option-desc">${desc}</span>
      </span>
      <i class="ap-icon-arrow-right welcome-flow__option-add" aria-hidden="true"></i>
    </button>
  </li>`;

// Back stays, whatever the state: the run is never one-way.
const back = raw(`<div class="welcome-flow__actions">
  <button type="button" class="ap-button ghost grey" data-flow-back>
    <i class="ap-icon-arrow-left"></i><span>Back</span>
  </button>
</div>`);

// What the review will show, named only when the read found it: a weak read
// leaves the business and the competitors empty (FEATURES § La lecture faible).
function learnedParts(d) {
  const parts = [d?.businessSummary && "business", "audience", "look", d?.competitors?.length && "competitors"].filter(
    Boolean,
  );
  return `Your ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`;
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
          ${manual ? "Your Playbook is set up." : "Your Playbook is ready."}
        </h1>
        <p class="welcome-intro__sub">
          ${manual
            ? "Tell me how your brand sounds and who it speaks to. Every draft I write starts there."
            : getDraft(sid)?.voiceLearnedFrom
              ? `I wrote your Playbook from ${READ_FROM[getDraft(sid)?.sourceType] || "what you gave me"}, and your default voice from ${getDraft(sid).voiceLearnedFrom}. Review them now, or later from your Playbook.`
              : `I wrote your Playbook and a default voice from ${READ_FROM[getDraft(sid)?.sourceType] || "what you gave me"}. Review them now, or later from your Playbook.`}
        </p>
        <ul class="welcome-flow__options">
          ${raw(
            choice({
              hook: "data-ready-review",
              // The pen means « write it myself » elsewhere in the run; reviewing
              // what I found carries the Playbook's own mark.
              icon: manual ? "ap-icon-pen" : "ap-icon-buildings",
              title: manual ? "Fill in my Playbook" : "Check what I learned",
              desc: manual ? "Part by part, card by card." : learnedParts(getDraft(sid)),
            }),
          )}
          ${raw(
            choice({
              hook: "data-ready-voice",
              icon: "ap-icon-quote",
              title: "Check my voice",
              desc: onlyNetwork(getDraft(sid))
                ? `How your ${networkLabel(onlyNetwork(getDraft(sid)))} posts sound.`
                : networkVoiceOn()
                  ? "How you sound, on every network."
                  : "How you sound, everywhere.",
            }),
          )}
          ${manual
            ? ""
            : raw(
                choice({
                  hook: "data-ready-start",
                  icon: "ap-icon-sparkles",
                  featured: true,
                  title: finishLabel(),
                  desc: isIntegrated()
                    ? "Add it to your Playbooks. You can edit it anytime."
                    : "Tell me what to post, and I'll draft it from your Playbook.",
                }),
              )}
        </ul>
        ${back}
      `;
    }
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Building your Playbook</h1>
      <p class="welcome-intro__sub">A few seconds.</p>
      <ol class="welcome-flow__stages">
        ${stages.map(
          (st, i) => html`
            <li class="welcome-flow__stage ${i < at ? "is-done" : i === at ? "is-current" : ""}">
              ${i === at
                ? // The one at work: the chat's working mark (Archie's disc, the
                  // animated mark — thread-render.js), asked « réutiliser ceux
                  // dans la conversation ».
                  raw(`<span class="e-turn__mark"><span class="archie-loader" aria-hidden="true"></span></span>`)
                : raw(
                    `<span class="welcome-flow__stage-mark" aria-hidden="true">${
                      i < at ? `<i class="ap-icon-check"></i>` : ""
                    }</span>`,
                  )}
              <span class="welcome-intro__text">
                <span class="welcome-intro__step-title">${st.title}</span>
                ${i === at ? raw(`<span class="welcome-intro__step-desc">${st.sub}</span>`) : ""}
              </span>
            </li>
          `,
        )}
      </ol>
      ${back}
    `;
  };

  // The card lands each analysed line as its stage ticks (welcome-alt-shell.js).
  const shell = mountShell(target, { step: "recap", sid, left, build: progress });
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
    // Say the stage in the shell's persistent status node (welcome-alt-shell.js).
    const status = target.querySelector("[data-flow-status]");
    if (status) status.textContent = done ? "Your Playbook is ready." : `${progress().stages[at]?.title || ""}…`;
  };
  // `shown` stays empty: the first tick (200 ms) repaints once and says the
  // first stage in the status node, which a node filled at mount wouldn't announce.
  reveal(progress().done);
  const timer = window.setInterval(tick, 200);

  const onClick = (event) => {
    if (event.target.closest("[data-ready-start]")) finishRun(sid);
    else if (event.target.closest("[data-ready-review]")) navigate("/welcome-alt/recap");
    // The Voice has its own review (2026-10-29): reachable from the reveal too.
    else if (event.target.closest("[data-ready-voice]")) navigate("/welcome-alt/voice");
    else if (event.target.closest("[data-flow-back]")) goBack("recap");
  };
  target.addEventListener("click", onClick);
  return () => {
    window.clearInterval(timer);
    shell.cleanup();
    target.removeEventListener("click", onClick);
  };
}
