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
// The field caps at FOUR lines then scrolls. A derived brief runs about seven,
// and leaving it seven lines tall made the composer the biggest object in the
// modal when the image is the thing being judged. The cap is exactly
// `4 × line-height` — a textarea's scrollport covers its content AND its padding,
// and there is no padding on top. The expand toggle raises the cap to eight.
//
// Generate is `secondary blue`: it is a step, not the destination. The modal's one
// primary is "Use this image" in the footer (stage-view.js#footerBar).

import { escapeHtml } from "../../utils.js?v=21";

// Empty-state hint for the prompt field — a full structured brief, so the
// placeholder itself shows the kind of rich prompt the box is built for (and why
// the expand toggle exists). Shown only when the field is empty, which in
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
  return st.mode === "edit" ? editComposer(st) : generateComposer(st);
}

// The composer is a CARD centred on the stage, not a full-width footer strip.
// At 1440px a full-bleed prompt runs ~180 characters per line — unreadable, and
// it made the six settings look like chrome stranded at the bottom of a huge
// empty bar. Capped and centred, the card reads as one object you act in.
function generateComposer(st) {
  // Auto-brief variant: the brief is an OUTPUT of the settings, read-only until
  // the user takes it over — framed and hinted as such, not as a field to fill.
  if (st.autoBrief) {
    const taken = !!st.briefTakenOver;
    return console_("Image brief", promptField(st), generateActions(st), "to generate", {
      inline: true,
      aux: expandToggle(st),
      expanded: !!st.composerExpanded,
      hint: briefHint(st),
      cls: `isv2-console--brief${taken ? " is-editing" : " is-readonly"}${taken && st.briefStale ? " is-stale" : ""}`,
    });
  }
  return console_("Image prompt", promptField(st), generateActions(st), "to generate", {
    inline: true,
    aux: expandToggle(st),
    expanded: !!st.composerExpanded,
  });
}

// The one line under the brief that carries the auto-brief model: what the brief
// is, and the single takeover action inline in the sentence (an `.ap-link`
// button — the repo's idiom for a button that reads as a link). While the brief
// is being written there's nothing to act on, so it stays quiet.
function briefHint(st) {
  if (st.promptLoading) return "Writing the brief from your settings…";
  if (!st.briefTakenOver) {
    return `Auto-written from your settings. <button type="button" class="ap-link standalone small" data-img-brief-edit>Edit the brief</button> to make it your own.`;
  }
  if (st.briefStale) {
    return `<span class="isv2-brief-stale">Settings changed since your edit.</span> <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Rebuild from settings</button>, or keep your words.`;
  }
  return `This brief is yours — settings won't change it. <button type="button" class="ap-link standalone small" data-img-brief-rebuild>Back to auto</button>.`;
}

// Doubles the field's height cap, 4 lines → 8. It holds the console's TOP-RIGHT
// corner while Generate stays on the field's last line, so the two controls read
// as what they are: one resizes the box, one runs what's in it. Hidden while the
// brief is being written — there is nothing to expand yet.
function expandToggle(st) {
  if (st.promptLoading) return "";
  const on = !!st.composerExpanded;
  const label = on ? "Collapse the prompt" : "Expand the prompt";
  return `<button type="button" class="ap-icon-button isv2-console-expand" data-img-composer-expand aria-pressed="${on}" aria-label="${label}" title="${label}"><i class="ap-icon-${on ? "minimize" : "maximize"}" aria-hidden="true"></i></button>`;
}

// The frame both modes share, and it IS the app's own conversational composer:
// a bordered card that lights up on focus, a borderless field, the action beside
// it, and a keyboard hint below the card. Same recipe as
// `.session__composer-card` — same border, same shadow, same padding rhythm, same
// focus behaviour — because the user is doing the same thing here (writing a
// brief for Archie) and it should not feel like a different product.
//
// What v2 grew instead and has now shed: an eyebrow, a "Suggest again" button
// and an expand toggle. The eyebrow only gave the field an identity that the
// composer's own frame already gives it; the expand solved a scrolling problem
// the composer solves with a line cap; and re-deriving the prompt now happens
// once, automatically, when the studio opens.
//
// `inline` puts the action BESIDE the field rather than on a row of its own,
// bottom-aligned so it stays on the field's last line. Both modes use it: a
// toolbar row of its own was a full row of card whose left half was empty, and
// the text would rather have that space. Kept as a flag, not baked in, because a
// console with several actions would need the row back.
function console_(
  label,
  field,
  action,
  hintVerb,
  { inline = false, aux = "", expanded = false, hint = "", cls = "" } = {},
) {
  const toolbar = aux || action ? `<div class="isv2-console-toolbar">${aux}${action}</div>` : "";
  // `hint` overrides the default keyboard hint — the auto-brief variant explains
  // what the brief is instead of how to type in it.
  const hintHtml = hint || `<kbd>Enter</kbd> ${hintVerb} · <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line`;
  return `<div class="isv2-dock">
    <div class="isv2-console-wrap">
      <div class="isv2-console${inline ? " isv2-console--inline" : ""}${expanded ? " is-expanded" : ""}${cls ? " " + cls : ""}" role="group" aria-label="${escapeHtml(label)}">
        ${field}
        ${toolbar}
      </div>
      <div class="isv2-console-hint">
        ${hintHtml}
      </div>
    </div>
  </div>`;
}

// Archie drafts the brief from the post on open, so the field leads with what he
// wrote and the user's job is to review it. While he's writing, the field itself
// holds the loader (the stage keeps its empty state) so the layout is legible
// from the first frame.
function promptField(st) {
  if (st.promptLoading) {
    // `.gen-image-spinner` alone — NOT `.gen-loading-mark`, which is the 88px
    // canvas mark for the stage's empty state. Wearing it here put an 88px glyph
    // in a 36px field, where it overflowed the card and shoved the text sideways.
    return `<div class="isv2-prompt-loading" role="status">
      <span class="gen-image-spinner"></span>
      <span>${st.autoBrief ? "Writing the brief…" : "Writing your image prompt…"}</span>
    </div>`;
  }
  // Auto-brief keeps the brief read-only until the user takes it over: you can't
  // drift the field from its settings, so there's nothing for the guard to catch.
  // It stays `data-img-prompt` (readonly blocks input; renderBody still autosizes
  // it) and Generate reads state.promptText as before.
  const readonly = st.autoBrief && !st.briefTakenOver;
  const aria = st.autoBrief ? "Image brief, written from your settings" : "Describe your image";
  return `<textarea id="isv2Prompt" class="isv2-prompt${readonly ? " isv2-prompt--readonly" : ""}" data-img-prompt rows="2" ${readonly ? "readonly " : ""}placeholder="${escapeHtml(PROMPT_PLACEHOLDER)}" aria-label="${escapeHtml(aria)}">${escapeHtml(st.promptText)}</textarea>`;
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
