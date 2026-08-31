// Image Studio — the bottom composer: one card, two jobs.
//
//   Generate   the image brief + Generate
//   Edit       "describe a change" + Redraw
//
// It IS the app's own conversational composer, doing the same job in another
// room — built to `.session__composer-card`'s recipe, value for value, so the
// two read as one control (styles/screens/image-studio-v2.css says which).
//
// A CARD centred on the stage, not a full-width footer strip: at 1440px a
// full-bleed prompt runs ~180 characters per line, which is unreadable, and it
// made the settings look like chrome stranded at the bottom of a huge bar.
//
// The field caps at EIGHT lines then scrolls — a derived brief runs about seven,
// so the whole thing is readable without touching anything. It used to cap at four
// with a toggle to double it, but the toggle was a control you had to find before
// the box would show what was already in it. The cap is exactly `8 × line-height` —
// a textarea's scrollport covers its content AND its padding, and there is no
// padding on top.
//
// Generate is `secondary blue`: it is a step, not the destination. The modal's one
// primary is "Use this image" in the footer (stage-view.js#footerBar).

import { escapeHtml } from "../../utils.js?v=22";
import { isBriefStage } from "./brief-stage.js?v=34";
import { isSetupFirst } from "./setup-stage.js?v=11";

// Empty-state hint for the prompt field — a full structured brief, so the
// placeholder itself shows the kind of rich prompt the box is built for (and why
// it stands eight lines tall). Shown only when the field is empty, which in
// practice means the user cleared what Archie wrote.
const PROMPT_PLACEHOLDER = `Campaign title: AI UX Safeguard
Campaign objective: Raise awareness about the risks of unmediated AI in UX design and establish the line between acceleration and shortcuts.
Audience: UX/UI Designers, Product Managers, Tech Leaders
Tone: Professional, provocative, authoritative

Title: AI can easily ruin your UX
Key message: Velocity is useless if you are building the wrong things faster. Human oversight is non-negotiable.
Narrative purpose: Grab attention immediately with a provocative statement and a striking visual metaphor of speed leading to chaos.
Visual goal: Create an instant visual metaphor for speed without direction or acceleration leading to product degradation.
Visual scene: A deep blue background. On the left, massive bold typography. On the right, a single powerful graphic: a thick, horizontal orange arrow representing velocity. The tail of the arrow is solid and perfectly defined, but as it points forward, the tip shatters and dissolves into a chaotic cloud of tiny, disconnected digital pixels and glitch fragments.
Composition focus: The transition point of the arrow where order turns into digital chaos, aligned with the bold headline.`;

export function composer(st) {
  if (st.mode === "edit") return editComposer(st);
  // Both split variants own their whole stage and their own Generate, so a prompt field
  // down here would be a second copy of text they already show (auto-brief), or the one
  // field V3 exists to remove. Asked as two predicates rather than one combined helper:
  // the combined one would have to live in a module neither of these belongs to, or come
  // back through stage-view and make the import graph a cycle.
  if (isBriefStage(st) || isSetupFirst(st)) return "";
  return generateComposer(st);
}

// The composer is a CARD centred on the stage, not a full-width footer strip.
// At 1440px a full-bleed prompt runs ~180 characters per line — unreadable, and
// it made the six settings look like chrome stranded at the bottom of a huge
// empty bar. Capped and centred, the card reads as one object you act in.
// The split stages own their whole stage and never reach this composer — see
// composer() above. By the time this runs, the brief is always the plain prompt field.
function generateComposer(st) {
  return console_("Image prompt", promptField(st), generateActions(st), "to generate", { inline: true });
}

// The frame both modes share, and it IS the app's own conversational composer:
// a bordered card that lights up on focus, a borderless field, the action beside
// it, and a keyboard hint below the card. Same recipe as
// `.session__composer-card` — same border, same shadow, same padding rhythm, same
// focus behaviour — because the user is doing the same thing here (writing a
// brief for Archie) and it should not feel like a different product.
//
// What v2 grew instead and has now shed: an eyebrow, a "Suggest again" button
// and a small/big size toggle. The eyebrow only gave the field an identity that
// the composer's own frame already gives it; the toggle asked the user to click
// before the box would show a brief that was already written, so the field simply
// stands at its full height; and re-deriving the prompt now happens once,
// automatically, when the studio opens.
//
// `inline` puts the action BESIDE the field rather than on a row of its own,
// bottom-aligned so it stays on the field's last line. Both modes use it: a
// toolbar row of its own was a full row of card whose left half was empty, and
// the text would rather have that space. Kept as a flag, not baked in, because a
// console with several actions would need the row back.
function console_(label, field, action, hintVerb, { inline = false } = {}) {
  const toolbar = `<div class="isv2-console-toolbar">${action}</div>`;
  return `<div class="isv2-dock">
    <div class="isv2-console-wrap">
      <div class="isv2-console${inline ? " isv2-console--inline" : ""}" role="group" aria-label="${escapeHtml(label)}">
        ${field}
        ${toolbar}
      </div>
      <div class="isv2-console-hint">
        <kbd>Enter</kbd> ${hintVerb} · <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
      </div>
    </div>
  </div>`;
}

// Archie drafts the prompt from the post on open, so the field leads with what he
// wrote and the user's job is to review it. While he's writing, the field itself
// holds the loader (the stage keeps its empty state) so the layout is legible
// from the first frame.
//
// Only the classic prompt variant reaches this: auto-brief owns its whole stage
// and returns before the composer ever calls it.
function promptField(st) {
  if (st.promptLoading) {
    // `.gen-image-spinner` alone — NOT `.gen-loading-mark`, which is the 88px
    // canvas mark for the stage's empty state. Wearing it here put an 88px glyph
    // in a 36px field, where it overflowed the card and shoved the text sideways.
    return `<div class="isv2-prompt-loading" role="status">
      <span class="gen-image-spinner"></span>
      <span>Writing your image prompt…</span>
    </div>`;
  }
  return `<textarea id="isv2Prompt" class="isv2-prompt" data-img-prompt rows="2" placeholder="${escapeHtml(PROMPT_PLACEHOLDER)}" aria-label="Describe your image">${escapeHtml(st.promptText)}</textarea>`;
}

// The prompt card's own action — running the prompt. `secondary blue`: it is a
// step and not the destination, so it stays a tier below the modal's one primary
// ("Use this image", in the footer), and blue rather than orange because it's the
// routine action of this card rather than the spotlight moment. Before the footer
// existed this button had to carry both jobs, which is why it was orange.
//
// "Generate", not "Generate image": the card is labelled Image prompt and the modal
// is called Image Studio, so the noun was the third "image" in one corner.
function generateActions(st) {
  if (st.genPhase === "generating") {
    return `<button type="button" class="ap-button secondary blue loading" disabled><span class="ap-loading-bar"></span><span>Generating…</span></button>`;
  }
  // A prompt being rewritten isn't one you can run yet.
  const promptReady = !st.promptLoading && !!(st.promptText || "").trim();
  const hasResults = st.genPhase === "results" && st.variations.length > 0;
  const icon = hasResults ? "ap-icon-refresh" : "ap-icon-sparkles-mermaid";
  const label = hasResults ? "Regenerate" : "Generate";
  return `<button type="button" class="ap-button secondary blue" data-img-generate ${promptReady ? "" : "disabled"}><i class="${icon}"></i><span>${label}</span></button>`;
}

// The same composer, re-tasked: describe a change instead of a brief. Identical
// frame, identical field, and its action sits in the same toolbar slot Generate
// uses — so switching modes moves the label, not the furniture. Secondary, like
// Generate: the modal's one primary is "Use this image" in the footer.
function editComposer(st) {
  const busy = st.editBusy ? "disabled" : "";
  return console_(
    "Edit the image",
    `<textarea class="isv2-prompt" data-img-edit-prompt rows="1" placeholder="Describe a change and I'll redraw it…" aria-label="Describe a change for AI to apply" ${busy}>${escapeHtml(st.editPrompt || "")}</textarea>`,
    `<button type="button" class="ap-button stroked grey" data-img-apply-edit="prompt" ${busy}><i class="ap-icon-sparkles-mermaid"></i><span>Redraw</span></button>`,
    "to redraw",
    { inline: true },
  );
}
