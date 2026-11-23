# The Reframe timeline's playhead reads as a control: electric blue

Written against: 02ede3184

Status: applied 2026-11-23 (« Yes, apply both »)

## Evidence chain

- Surface: clip editor, Reframe tool — `#/clips/:id/edit/:clipId?tool=reframe`, the timeline under the playback bar (`renderTimeline` in `src/screens/clips/editor.js`, `.clips-tl__playhead` with its `.clips-tl__knob`).
- Problem: the playhead line and its knob are orange (`--ref-color-orange-100`), while the knob is a control you drag to scrub, and the playback slider right above it, which shows the same position, is blue. Rendered: the user's screenshot of 2026-11-23 (orange knob at 0:23.8 under a blue slider at 0:23.8).
- Design evidence:
  - `~/.claude/CLAUDE.md` › Règles visuelles Agorapulse: « Le bleu électrique est la couleur de l'interactif. Liens et contrôles uniquement. »
  - `CLAUDE.md` › Brand color convention: « orange = AI / spotlight actions ».
  - `styles/screens/clips.css:1792-1803`: the knob takes the pointer (`pointer-events: auto`, `cursor: grab`, comment « The playhead's knob is its handle: grab it to scrub »).
- Owner: `styles/screens/clips.css` — `.clips-tl__playhead` (line ~1780) and `.clips-tl__knob` (line ~1792).
- Scope and affected surfaces: the Reframe timeline only (the timeline is hidden outside Reframe: `.clips-ed:not([data-tool="reframe"]) .clips-ed__timeline { display: none }`).
- Uncertainty: none.

## Design decision

The playhead is a control, so it takes the interactive colour: electric blue for both the line and the knob. Two indicators of the same time (the slider above and the playhead below) then share one colour, and orange stays reserved for AI and spotlight actions.

## Reuse

- `--ref-color-electric-blue-100` (DS token, already used on the timeline's current part: `.clips-tl__seg.is-current`, `.clips-tl__text.is-current`).
- Exemplar: `.clips-tl__seg.is-current { border-color: var(--ref-color-electric-blue-100); }` in `styles/screens/clips.css`.

## Changes

1. `styles/screens/clips.css` — `.clips-tl__playhead`
   - Change: `background: var(--ref-color-orange-100);` → `background: var(--ref-color-electric-blue-100);`
   - Preserve: position, width, z-index, `pointer-events: none`.
   - Verify: the vertical line over the tracks is blue.
2. `styles/screens/clips.css` — `.clips-tl__knob`
   - Change: `background: var(--ref-color-orange-100);` → `background: var(--ref-color-electric-blue-100);`
   - Preserve: size, `cursor: grab`, the hover scale.
   - Verify: the knob at the top of the line is blue and still drags.

## Scope

- Inherit: the Reframe timeline of every clip.
- Verify: the drag readout `.clips-tl__readout` (drawn near the playhead) still reads against a blue line; the current part's blue border next to a blue line is still distinguishable (the line is 2px, the border wraps the part).
- Exclude: any other orange in the editor (the « Write a post » icon, AI marks) — not controls of time.

## Validation

- Product: in Reframe, drag the knob → the clip scrubs as before; play → the line moves.
- Interface: 1280 / 1440 / 1920; a clip with one part and one with several parts (Split part); the current part under the playhead.
- System: no new token; the playhead now matches the slider above (`.ap-slider`, blue).
- Repository: `npm run bump` then `npm run check:ds` → « OK — every token, icon and .ap-\* class resolves », `npm run check:versions` → OK.

## Stop conditions

- Stop if a design doc is found that names the orange playhead as a deliberate exception.

## Design documentation

- After acceptance and validation: in `docs/reference/FEATURES.md` §20 (the editor), note « the playhead is blue — a control (2026-11-23) » where the Reframe timeline is described.
