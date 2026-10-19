// /welcome-alt/recap under flag connectFirst — the review, the run's last screen.
//
// The WHOLE Playbook, every block — but walked, not dumped. One part at a time
// (Brief, Voice profile, Branding, Competitors, Influencers) in the floating
// card on Archie's stage, the real Playbook view inside it (playbook-view, its
// own tabs hidden: the list on the left drives them). Everything is already
// filled in by me, so the job is to skim and confirm:
//   - click any block to edit it — the part opens in edit, that block's field
//     focused (no hunting for the Edit button);
//   - "Looks good" checks the part off in the list and opens the next one;
//   - all checked, the card takes the reveal's breath and offers Start writing.
// Start writing is never gated: it's on the left the whole time.

import { html, raw } from "../utils.js?v=1945";
import { navigate } from "../router.js?v=1945";
import { getDraft, patchDraft } from "../context-builder.js?v=1945";
import { mount, RECAP_SECTIONS } from "../playbook-view.js?v=1945";
import { parseHashParams } from "../url-state.js?v=1945";
import { mountShell } from "./welcome-alt-shell.js?v=1945";
import { enterArchie } from "./welcome-alt-recap.js?v=1945";

// What can take the focus inside a block in edit — its field, else its control.
const FOCUSABLE = 'input:not([type=hidden]), textarea, select, button, [tabindex]:not([tabindex="-1"])';

export function renderReview(target, sid, config) {
  const reviewed = () => new Set(getDraft(sid)?.reviewedParts || []);
  const current = () => parseHashParams().get("tab") || RECAP_SECTIONS[0].id;
  const allDone = () => RECAP_SECTIONS.every((t) => reviewed().has(t.id));

  const left = () => {
    const done = reviewed();
    return html`
      <h1 class="welcome-flow__title" id="welcomeFlowTitle">Review your Playbook</h1>
      <p class="welcome-intro__sub">
        I've filled in every part. Skim each one, and click anything that's off to fix it.
      </p>
      <ul class="welcome-flow__options is-compact">
        ${RECAP_SECTIONS.map(
          (t) => html`
            <li>
              <button
                type="button"
                class="welcome-flow__option"
                data-review-part="${t.id}"
                aria-current="${t.id === current() ? "true" : "false"}"
              >
                <span class="welcome-flow__option-text">
                  <span class="welcome-flow__option-title">${t.title}</span>
                </span>
                ${done.has(t.id)
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
        ${allDone()
          ? "" /* the card's footer says it now — once is enough */
          : raw(`<button type="button" class="ap-button primary orange" data-review-start>
              <span>Start writing</span><i class="ap-icon-arrow-right"></i>
            </button>`)}
      </div>
    `;
  };

  const shell = mountShell(target, { step: "recap", sid, left, sheet: true });
  const body = shell.sheet.querySelector("[data-flow-sheet-body]");
  const foot = shell.sheet.querySelector("[data-flow-sheet-foot]");
  const unmount = mount(body, { ...config, showTop: false, headerActions: () => null });

  const paintFoot = () => {
    const done = reviewed();
    const pips = html`
      <ol class="welcome-review__pips" aria-label="${done.size} of ${RECAP_SECTIONS.length} checked">
        ${RECAP_SECTIONS.map(
          (t) => html`<li class="${done.has(t.id) ? "is-done" : ""} ${t.id === current() ? "is-current" : ""}"></li>`,
        )}
      </ol>
    `;
    foot.innerHTML = allDone()
      ? html`
          ${raw(pips)}
          <span class="welcome-review__foot-text">Every part looks good.</span>
          <button type="button" class="ap-button primary orange" data-review-start>
            <span>Start writing</span><i class="ap-icon-arrow-right"></i>
          </button>
        `
      : html`
          ${raw(pips)}
          <button type="button" class="ap-button primary blue" data-review-ok>
            <i class="ap-icon-check"></i><span>Looks good</span>
          </button>
        `;
    shell.sheet.classList.toggle("is-revealed", allDone());
  };
  const repaint = () => {
    shell.paint();
    paintFoot();
  };
  paintFoot();

  const openPart = (id) => {
    body.querySelector(`[data-pb2-tab="${id}"]`)?.click();
    body.querySelector(".welcome-screen")?.scrollTo?.({ top: 0 });
    repaint();
  };

  const onClick = (e) => {
    const part = e.target.closest("[data-review-part]")?.dataset.reviewPart;
    if (part) return openPart(part);
    if (e.target.closest("[data-review-ok]")) {
      const done = reviewed();
      done.add(current());
      patchDraft(sid, { reviewedParts: [...done] });
      const next = RECAP_SECTIONS.find((t) => !done.has(t.id));
      return next ? openPart(next.id) : repaint();
    }
    if (e.target.closest("[data-review-start]")) return enterArchie(sid);
    if (e.target.closest("[data-flow-back]")) return navigate("/welcome-alt/ready");

    // Click a block to edit it: the part opens in edit (the view's own Edit),
    // and the same block's first field takes the focus. Only from reading, and
    // never on a control the block already has.
    const block = e.target.closest(".pb2-block");
    if (!block || !body.contains(block) || body.querySelector(".pb2.is-editing")) return;
    if (e.target.closest("button, a, input, textarea, select, label")) return;
    // Matched by title, not position: edit mode can add a block before it.
    const title = block.querySelector(".pb2-block__title")?.textContent.trim();
    const edit = body.querySelector("[data-recap-edit-card]");
    if (!edit) return;
    edit.click();
    const same = [...body.querySelectorAll(".pb2-block")].find(
      (b) => b.querySelector(".pb2-block__title")?.textContent.trim() === title,
    );
    // The view focuses the part's first field on its own; the clicked block wins.
    const field = same?.querySelector(FOCUSABLE);
    if (field) field.focus({ preventScroll: true });
    else document.activeElement?.blur();
    same?.scrollIntoView({ block: "center" });
  };
  target.addEventListener("click", onClick);
  return () => {
    unmount?.();
    shell.cleanup();
    target.removeEventListener("click", onClick);
  };
}
