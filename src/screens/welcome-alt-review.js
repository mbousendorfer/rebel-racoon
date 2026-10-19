// /welcome-alt/recap under flag connectFirst — the review, the run's last screen.
//
// Only what a new user needs to check before the first draft, nothing more:
// four parts, one at a time, edited in place (no Edit / Save mode — every field
// writes the draft as you type). The rest of the Playbook (competitors,
// influencers, content style, links, Always / Never…) is there later, on the
// Playbook's own page; showing it here was a wall of things to read.
//
// Left: the parts, each checked once the user says it looks good, and the way
// out (Start writing is never gated). Right: the current part, plainly — and a
// footer that walks to the next one.

import { html, raw, escapeHtml } from "../utils.js?v=1938";
import { navigate } from "../router.js?v=1938";
import { getDraft, patchDraft } from "../context-builder.js?v=1938";
import { mountShell } from "./welcome-alt-shell.js?v=1938";
import { enterArchie } from "./welcome-alt-recap.js?v=1938";

const traitsOf = (d) =>
  (d?.voiceProfile?.headline || "")
    .split(/\s*·\s*/)
    .filter(Boolean)
    .slice(0, 4);

const PARTS = [
  {
    id: "brand",
    title: "Your brand",
    lead: "What I know about the business. I use it to ground every post.",
    body: (d) => html`
      <label class="welcome-review__field">
        <span class="welcome-review__label">Name</span>
        <span class="ap-input-group"><input type="text" value="${d.name || ""}" data-review-field="name" /></span>
      </label>
      <label class="welcome-review__field">
        <span class="welcome-review__label">What you do</span>
        <textarea class="ap-textarea-field welcome-review__textarea" rows="5" data-review-field="businessSummary">
${d.businessSummary || ""}</textarea
        >
      </label>
    `,
  },
  {
    id: "audience",
    title: "Who it's for",
    lead: "The people your posts speak to. Pick the closest, or say it your way.",
    body: (d) => {
      const current = d.audience?.[0] || "";
      const options = [...new Set([current, ...(d.suggestions?.audience || [])].filter(Boolean))];
      return html`
        <ul class="welcome-flow__options">
          ${options.map(
            (o) => html`
              <li>
                <label class="welcome-flow__option is-choice">
                  <span class="welcome-flow__option-text">
                    <span class="welcome-flow__option-title">${o}</span>
                  </span>
                  <span class="ap-radio-container"
                    ><input type="radio" name="audience" value="${o}" ${o === current ? raw("checked") : ""}
                  /></span>
                </label>
              </li>
            `,
          )}
        </ul>
        <label class="welcome-review__field">
          <span class="welcome-review__label">Or in your words</span>
          <span class="ap-input-group"
            ><input type="text" placeholder="Busy parents who cook at home" data-review-audience
          /></span>
        </label>
      `;
    },
  },
  {
    id: "voice",
    title: "How you sound",
    lead: "How every post reads. Say it the way you'd brief a new writer.",
    body: (d) => {
      const traits = traitsOf(d);
      return html`
        ${traits.length
          ? raw(
              `<span class="welcome-flow__chips">${traits.map((t) => `<span class="welcome-intro__trait">${escapeHtml(t)}</span>`).join("")}</span>`,
            )
          : ""}
        <label class="welcome-review__field">
          <span class="welcome-review__label">Your voice, in a few sentences</span>
          <textarea class="ap-textarea-field welcome-review__textarea" rows="5" data-review-field="voiceSummary">
${d.voiceSummary || ""}</textarea
          >
        </label>
      `;
    },
  },
  {
    id: "look",
    title: "Your look",
    lead: "The colours I use when I make your images.",
    body: (d) => {
      const colors = d.brandColors || [];
      if (!colors.length) {
        return html`<p class="welcome-intro__sub">
          No colours yet. Add your logo and colours from your Playbook whenever you like — I'll use them from then on.
        </p>`;
      }
      return html`
        <ul class="welcome-review__colors">
          ${colors.map(
            (c, i) => html`
              <li>
                <label class="welcome-review__color">
                  <input type="color" value="${c.hex}" data-review-color="${i}" aria-label="${c.name || "Colour"}" />
                  <span class="welcome-flow__option-text">
                    <span class="welcome-flow__option-title">${c.name || "Colour"}</span>
                    <span class="welcome-flow__option-desc" data-review-hex="${i}">${String(c.hex).toUpperCase()}</span>
                  </span>
                </label>
              </li>
            `,
          )}
        </ul>
      `;
    },
  },
];

export function renderReview(target, sid) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  let current = PARTS.find((p) => !reviewed().has(p.id))?.id || PARTS[0].id;

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">Four things to check. Change anything — you can fine-tune the rest later.</p>
      <ul class="welcome-flow__options is-compact">
        ${PARTS.map(
          (p) => html`
            <li>
              <button
                type="button"
                class="welcome-flow__option"
                data-review-part="${p.id}"
                aria-current="${p.id === current ? "true" : "false"}"
              >
                <span class="welcome-flow__option-text">
                  <span class="welcome-flow__option-title">${p.title}</span>
                </span>
                ${done.has(p.id)
                  ? raw(
                      `<span class="welcome-review__check" title="Looks good"><i class="ap-icon-check" aria-hidden="true"></i></span>`,
                    )
                  : ""}
              </button>
            </li>
          `,
        )}
      </ul>
      <div class="welcome-flow__actions">
        <button type="button" class="ap-button stroked grey" data-flow-back>Back</button>
        ${PARTS.every((p) => done.has(p.id))
          ? "" /* the footer says it now — once is enough */
          : raw(`<button type="button" class="ap-button primary orange" data-review-start>
              <span>Start writing</span><i class="ap-icon-arrow-right"></i>
            </button>`)}
      </div>
    `;
  };

  const shell = mountShell(target, { step: "recap", sid, left, sheet: true });
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  const foot = shell.sheet.querySelector("[data-flow-sheet-foot]");

  const paintPart = () => {
    const d = getDraft(sid) || {};
    const part = PARTS.find((p) => p.id === current);
    const at = PARTS.indexOf(part);
    body.innerHTML = html`
      <section class="welcome-review__part" aria-labelledby="welcomeReviewPart">
        <h2 class="welcome-review__title" id="welcomeReviewPart">${part.title}</h2>
        <p class="welcome-intro__sub">${part.lead}</p>
        <div class="welcome-review__fields">${raw(part.body(d))}</div>
      </section>
    `;
    const done = reviewed();
    const allDone = PARTS.every((p) => done.has(p.id));
    foot.innerHTML = allDone
      ? html`
          <span class="welcome-review__foot-text">All four look good.</span>
          <button type="button" class="ap-button primary orange" data-review-start>
            <span>Start writing</span><i class="ap-icon-arrow-right"></i>
          </button>
        `
      : html`
          <span class="welcome-review__foot-text">${at + 1} of ${PARTS.length}</span>
          <button type="button" class="ap-button primary blue" data-review-ok>
            <i class="ap-icon-check"></i><span>Looks good</span>
          </button>
        `;
  };
  const paint = () => {
    shell.paint();
    paintPart();
  };
  paintPart();

  // Typing writes the draft — no Save step. (The draft notifies; nothing here
  // repaints on it, so the field keeps its focus.)
  const onInput = (e) => {
    const field = e.target.dataset.reviewField;
    if (field) return patchDraft(sid, { [field]: e.target.value });
    if (e.target.matches("[data-review-audience]")) {
      const v = e.target.value.trim();
      if (v) {
        patchDraft(sid, { audience: [v] });
        body.querySelectorAll('input[name="audience"]').forEach((r) => (r.checked = false));
      }
      return;
    }
    const ci = e.target.dataset.reviewColor;
    if (ci !== undefined) {
      const colors = (getDraft(sid)?.brandColors || []).map((c) => ({ ...c }));
      if (colors[ci]) colors[ci].hex = e.target.value;
      patchDraft(sid, { brandColors: colors });
      const hex = body.querySelector(`[data-review-hex="${ci}"]`);
      if (hex) hex.textContent = e.target.value.toUpperCase();
    }
  };
  const onChange = (e) => {
    if (e.target.name === "audience") patchDraft(sid, { audience: [e.target.value] });
  };
  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) {
      current = part;
      paint();
    } else if (e.target.closest("[data-review-ok]")) {
      const done = reviewed();
      done.add(current);
      patchDraft(sid, { reviewedParts: [...done] });
      // On to the next part not checked yet — or stay, with the way out below.
      current = PARTS.find((p) => !done.has(p.id))?.id || current;
      paint();
    } else if (e.target.closest("[data-review-start]")) enterArchie(sid);
    else if (e.target.closest("[data-flow-back]")) navigate("/welcome-alt/ready");
  };
  target.addEventListener("input", onInput);
  target.addEventListener("change", onChange);
  target.addEventListener("click", onClick);
  return () => {
    shell.cleanup();
    target.removeEventListener("input", onInput);
    target.removeEventListener("change", onChange);
    target.removeEventListener("click", onClick);
  };
}
