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
// 4. The form has a MEASURE (~520px, left-aligned in its half) rather than filling it. At
//    the half's full width a row put its label at one edge and its value at the other with
//    400px of nothing between them — the pair stopped reading as a pair. A form is one
//    of the few things that should be narrower than the space it has.
//
// 5. The DENSITY is the DS's, not the pinned panel's. These same seven rows run at 36px in
//    a 284px rail, where every pixel counts; in a 520px card that reads as a table. Under
//    `.isv2-opts` a row takes `.ap-list-panel-item`'s geometry (40px, `xxs sm`) and a
//    section body takes `.ap-accordion-content`'s padding and gap — the DS components for
//    "rows inside a bounded card" and "an expanded section". FEATURES §7bis has the table.
//
// The brief's blocks (brief-blocks.js) and the preview column (preview-column.js) are
// shared with the auto-brief stage — one renderer each, two hosts, so a card and the
// thing it opens can't end up saying different sentences about the same brief.

import { settingRowEntries } from "./settings-view.js?v=19";
import { briefBody, briefNote } from "./brief-blocks.js?v=2";
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

// The seven rows, verbatim from the settings panel — same sections, same state, same
// data-* hooks — but in TWO bounded groups instead of one flat ladder.
//
// FEATURES has always said the order encodes a reasoning: "ce qui va DANS l'image, puis
// son traitement". In a 284px column that could only ever be implied by the sequence.
// Here there is room to state it, and stating it is what turns seven equal-weight rows
// into two things a reader can scan. The two labels are HEADINGS — body size, bold,
// grey-100, sentence case (the house rule bans uppercase labels). They were captions at
// grey-80, which is `.isv2-sheet-hint`'s costume: the tier for an ASIDE about a thing. At
// that weight above a 380px card they read as a footnote floating over it rather than as
// the question the card answers — and ink alone was never going to carry a section
// heading. It also puts them at the level of the `Preview` heading across the hairline.
//
// The group is a CARD, built to `.ap-card`'s recipe value for value (white,
// 1px grey-10, the app's card radius) rather than by taking the class: `.ap-card`
// carries `padding: sm` and `gap: sm`, and these rows need the hairlines to run
// edge to edge with nothing between them. Overriding a `.ap-*` class outside
// ds-patches.css flips the cascade silently, so this composes from the same tokens
// instead — reuse, then compose, then invent.
const GROUPS = [
  { label: "What's in the image", rows: ["refs", "renderText", "branding"] },
  { label: "How it's made", rows: ["imageType", "style", "format", "output"] },
];

function optionsPane(st) {
  const entries = settingRowEntries(st);
  const groups = GROUPS.map(({ label, rows }) => {
    const html = rows.map((name) => entries.find((e) => e.name === name)?.html || "").join("");
    if (!html) return "";
    return `<div class="isv2-optgroup">
      <p class="isv2-optgroup-label">${label}</p>
      <div class="isv2-optgroup-rows">${html}</div>
    </div>`;
  }).join("");
  return `<div class="isv2-opts">${groups}</div>`;
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
