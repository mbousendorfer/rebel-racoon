# The clip editor's ruler timecode is data: ink, not blue

Written against: e83b6d5c3

Status: applied 2026-11-23, inside the editor's hierarchy pass (« Yes, do the pass »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the timeline's top-left corner: the ruler's head (`.nle-head--ruler` in `paintTimeline()`, `src/screens/clips/editor-timeline.js`) shows the playhead's time in `span.nle-head__tc` (« 00:00:00 »), updated by `paintPlayhead()`.
- Problem: that timecode is electric blue, but it's a readout: it can't be clicked, typed in, or dragged (the editable timecode is the transport's `input.nle-tc`, in ink). The blue draws the eye to a static value. Rendered: the user's screenshot of 2026-11-23 (blue « 00:00:00 » left of the ruler).
- Design evidence:
  - `styles/screens/clip-editor.css` › `.nle-head__tc { color: var(--ref-color-electric-blue-150); }` (around line 1052).
  - `~/.claude/CLAUDE.md` › Règles visuelles Agorapulse: « Le bleu électrique est la couleur de l'interactif. Liens et contrôles uniquement. Jamais pour teinter une donnée statique. » And: « Encre de texte : grey-80 minimum, grey-100 maximum. »
  - `CLAUDE.md` › Design System: « ink grey-80…100 … blue = interactive ».
- Owner: `styles/screens/clip-editor.css` › `.nle-head__tc`.
- Scope and affected surfaces: that one element, in every clip.
- Uncertainty: none.

## Design decision

The ruler's timecode is a value, so it takes the ink colour (grey-100) and keeps its caption-bold weight and tabular figures. Blue stays on what you act on: the playhead and its knob, selections, toggles.

## Reuse

- `--ref-color-grey-100` (DS token, the editor's text ink, e.g. `.nle-head__name`).
- Exemplar: `.nle-tc` (the transport's timecode, `color: var(--ref-color-grey-100)`).

## Changes

1. `styles/screens/clip-editor.css` — `.nle-head__tc`
   - Change: `color: var(--ref-color-electric-blue-150);` → `color: var(--ref-color-grey-100);`
   - Preserve: `font-size` (caption), `font-weight` (caption-bold), `font-variant-numeric: tabular-nums`.
   - Verify: the corner reads « 00:00:00 » in the same ink as the track names, and still follows the playhead.

## Scope

- Inherit: the timeline of every clip.
- Verify: the playhead (`.nle-tl__playhead`, `.nle-tl__knob`) stays blue; the corner value still updates while scrubbing and playing.
- Exclude: the playhead, the transport timecode, selected states.

## Validation

- Product: scrub the ruler and press → / ← → the corner timecode follows in ink.
- Interface: 1440×900; the corner next to the blue playhead knob at 00:00:00.
- System: no new token.
- Repository: `npm run bump`, then `npm run check:ds` → OK, `npm run check:versions` → OK.

## Stop conditions

- Stop if a doc names the ruler's timecode as an editable or interactive control.

## Design documentation

- None (it applies an existing rule).
