// Image Studio V3 — the options come first, the brief comes last.
//   (flag imageStudioSetupFirst; wins over imageStudioAutoBrief when both are on)
//
// ┌───────────────────────────────┬──────────────────────────────────┐
// │ [ Options ] [ Advanced ]      │  PREVIEW      [Image | In feed]  │
// │  References          Acme  ▾  │  ┌────────────────────────────┐  │
// │  Text in image             ▾  │  │  the image, or its         │  │
// │  Branding            Acme  ▾  │  │  placeholder               │  │
// │  Type                 Any  ▾  │  └────────────────────────────┘  │
// │  Style     From references  ▾ │  ▪ ▪ ▪                           │
// │  Format         1:1 · Square ▾│                                  │
// │  Output       2 variations  ▾ │                                  │
// └───────────────────────────────┴──────────────────────────────────┘
//
// The other two variants land the user on the BRIEF — a prose field in the bottom
// composer (classic), or the hero of the stage (auto-brief) — and treat the options as
// secondary. This one inverts that: the options are the form, Generate is its submit,
// and the brief is the answer to "what did you actually send?" rather than the thing
// you have to fill in first. There is no prose prompt field anywhere in this variant.
//
// ── Three decisions worth defending ──────────────────────────────────────────
//
// 1. The pane switch is a CHIP PAIR, not `.ap-tabs`. The modal header already carries
//    an `.ap-tabs` strip (Generate | Edit); a second one 300px away "would read as a
//    competing mode switch beside the real one" — the stated reason the Image / In feed
//    toggle uses `.ap-filter-chip` + `aria-pressed` (stage-view.js#viewToggle). Using
//    the same primitive also makes this strip symmetric with the one facing it in the
//    preview header.
//
// 2. Advanced is DISABLED until an image exists, exactly the way the header disables
//    Edit, with the same sentence. What it holds is the prompt that produced the image
//    on screen; offered before there is one it would be a draft of a brief, which is
//    the surface this variant exists to remove.
//
// 3. The layout NEVER changes — two halves from open to commit, the same geometry the
//    auto-brief stage uses (`.isv2-bs`), so switching pane or landing an image reflows
//    nothing. The options half scrolls internally; the preview half does not.
//
// 4. The row list has a MEASURE (~440px) and is LEFT-ALIGNED, sharing its edge with the
//    pane switch above it. A list of label-and-value rows stretched across a 700px half
//    puts the two halves of every row at opposite ends of the screen; a panel that reads
//    as a panel is narrower than the space it sits in.
//
// 5. The rows are the pinned inspector's, verbatim — same sections, same chips, same
//    state, same data-* hooks. What differs is the room they get, not what they are.
//
// The brief's blocks (brief-blocks.js) and the preview column (preview-column.js) are
// shared with the auto-brief stage — one renderer each, two hosts, so a card and the
// thing it opens can't end up saying different sentences about the same brief.

import { settingRows } from "./settings-view.js?v=24";
import { briefBody, briefNote } from "./brief-blocks.js?v=3";
import { previewColumn } from "./preview-column.js?v=2";

/** Is V3 holding the stage? For the WHOLE generate flow, image or not. */
export function isSetupFirst(st) {
  return !!st.setupFirst && st.mode === "generate";
}

/** Is the brief reachable yet? It describes an image, so it needs one. */
function briefReady(st) {
  return st.variations.length > 0 || !!st.currentImage;
}

// One chip per pane, driven by `aria-pressed` like every other toggle in this app.
function paneTabs(st) {
  const advanced = st.pane === "advanced" && briefReady(st);
  const locked = !briefReady(st);
  return `<div class="isv2-panetabs" role="group" aria-label="Options or the brief">
    <button type="button" class="ap-filter-chip" data-img-pane="options" aria-pressed="${!advanced}">Options</button>
    <button type="button" class="ap-filter-chip" data-img-pane="advanced" aria-pressed="${advanced}" ${locked ? 'disabled title="Generate an image first"' : ""}>Advanced</button>
  </div>`;
}

// The options: the SAME seven rows as the pinned inspector, and nothing wrapped around
// them.
//
// ⚠️ This was briefly two bordered cards holding nineteen permanently-visible radio
// buttons, on the theory that controls this small don't need disclosure. That was wrong,
// and the reason is worth keeping: **a collapsed row IS the grouping.** One option, one
// row, its current value in the header — so the pane at rest is a seven-line summary of
// the whole configuration, which is exactly what the first step of a form wants. Opened
// out, the same content becomes forty elements with no summary anywhere, and grouping
// them under two headings just makes two catch-alls.
//
// The overflow that motivated the change (198px with three rows open) was measured with
// three rows open at once, which is a test, not a use. One or two at a time fits, and the
// pane fades its bottom edge when it doesn't.
function optionsPane(st) {
  return `<div class="isv2-opts">${settingRows(st)}</div>`;
}

// The brief, and where it stands. The status line sits UNDER the blocks here rather
// than in the modal footer (where the auto-brief stage keeps it): this pane is what the
// sentence is about, and the footer is a half-modal away from it.
function advancedPane(st) {
  // Past tense, and no "above": this brief has already been sent — it is what produced
  // the image beside it — and the options it came from are in the other pane.
  const note = briefNote(st, {
    intro: `I wrote this from your options. Change one and I'll write it again — or edit the text yourself.`,
  });
  return `<div class="isv2-opts isv2-opts--brief">
    <p class="isv2-bs-eyebrow">The brief I sent</p>
    ${briefBody(st)}
    ${note ? `<p class="isv2-bs-note">${note}</p>` : ""}
  </div>`;
}

export function setupStage(st) {
  const advanced = st.pane === "advanced" && briefReady(st);
  return `<div class="isv2-bs is-split isv2-bs--setup">
    <div class="isv2-bs-left">
      ${paneTabs(st)}
      ${advanced ? advancedPane(st) : optionsPane(st)}
    </div>
    ${previewColumn(st)}
  </div>`;
}
