# The clip editor's timeline blocks stand out from their tracks: white on grey-05

Written against: e83b6d5c3

Status: applied 2026-11-23, inside the editor's hierarchy pass (« Yes, do the pass »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the timeline's Brand, Text, and Subtitles tracks (`laneHTML()` in `src/screens/clips/editor-timeline.js`): each lane renders a `.nle-lane__clip` spanning the clip's range, then its blocks (`.nle-block`: the logo bar, intro / outro cards, text layers, subtitle lines).
- Problem: the blocks and the track behind them have the same white fill, so only a hairline separates them and the three tracks read as one undifferentiated band. Rendered: the user's screenshot of 2026-11-23 (« Logo · top right », the subtitle lines, the empty Text track: white on white), with the user's words « ça manque de hiérarchie et de contraste entre les éléments ».
- Design evidence:
  - `styles/screens/clip-editor.css`: `.nle-lane__clip { background: var(--ref-color-white); }` (around line 1143) and `.nle-block { background: var(--ref-color-white); border: 1px solid var(--ref-color-grey-20); }` (around line 1187). The ground under the lanes is `.nle-tl__inner { background: var(--ref-color-grey-05); }`.
  - `~/.claude/CLAUDE.md` › Règles visuelles Agorapulse: « Bordures, séparateurs, filets et contours : grey-20. Jamais grey-40. » The border can't carry more contrast, so the separation has to come from the fill.
  - `CLAUDE.md` › flag `contentPanel`: the app's look for objects on a surface is « grey-05 canvas, white cards ».
  - `docs/reference/UI-PATTERNS.md`: « Le cadre appartient aux OBJETS, jamais à la colonne qui les liste. » Here the lane carries the same white surface as its objects.
- Owner: `styles/screens/clip-editor.css` › `.nle-lane__clip` (and its Video override `.nle-lane--video .nle-lane__clip`).
- Scope and affected surfaces: the Brand, Text, and Subtitles lanes. The Video lane already clears this fill (`background: none`) so its filmstrip shows.
- Uncertainty: the clip's range on these three lanes was marked only by that white fill. It stays readable from the ruler's white band (`paintVisible()` fills the clip's span in `--ref-color-white`), the Video track's clip frame (`.nle-vclip`), and the in / out brackets (`.nle-inout`). Confirm this on screen; see Stop conditions.

## Design decision

The track is ground, the blocks are objects: the lanes stop painting white and show the timeline's own grey-05 ground, so every white block (logo bar, cards, text layers, subtitle lines) stands on grey-05. This is the app's white-cards-on-grey-05 convention, and it adds contrast without darkening any border.

## Reuse

- `--ref-color-grey-05` (already the ground of `.nle-tl__inner`); `--ref-color-white` stays on `.nle-block`.
- Exemplar: the content panel's Sources / Ideas / Drafts views (flag `contentPanel`, « grey-05 canvas, white cards »).

## Changes

1. `styles/screens/clip-editor.css` — `.nle-lane__clip`
   - Change: delete `background: var(--ref-color-white);`.
   - Preserve: `position: absolute; top: 0; bottom: 0;` and the element itself (`laneHTML()` still emits it; it costs nothing and keeps the span available).
   - Verify: on the Brand, Text, and Subtitles tracks, the area inside the clip is grey-05 and every block is a white rectangle with its grey-20 border.
2. `styles/screens/clip-editor.css` — `.nle-lane--video .nle-lane__clip`
   - Change: delete the rule (it only cleared the white fill that no longer exists).
   - Preserve: the Video lane's filmstrip, parts, and clip frame.
   - Verify: the Video track looks unchanged.

## Scope

- Inherit: the Brand, Text, and Subtitles tracks of every clip.
- Verify: the empty-track hints (`.nle-lane__hint`, grey-80 on grey-05) stay legible; a selected block (`.nle-block.is-selected`, blue-05 fill + blue border) still reads on grey-05; the locked-track hatch (`.nle-lane.is-locked`) still shows; the outside-the-clip shade (`.nle-shade`) on the Video lane still dims the filmstrip.
- Exclude: block styles, borders, the ruler, the Video lane, the track heads.

## Validation

- Product: open a clip with a logo, an outro card, subtitles, and two text layers (add Title and Heading from the Text tab); select one, lock a track, hide a track.
- Interface: 1440×900 and 1920×1080; zoomed to fit and zoomed in (⌘+ ×3); a clip trimmed shorter (drag its end) so the outside-the-clip region is visible on every lane.
- System: no new token or class; the change removes a declaration and a rule.
- Repository: `npm run bump`, then `npm run check:ds` → OK, `npm run check:versions` → OK, `npm run check:dead` → no new entry for `nle-lane`.

## Stop conditions

- Stop if, on screen, the clip's in / out range becomes hard to read on the Brand, Text, and Subtitles tracks. Then the range needs its own marker, which is a separate decision; do not reintroduce a white lane fill.

## Design documentation

- After acceptance and validation: in `docs/reference/FEATURES.md` §20 (the timeline), add « the tracks are the timeline's grey-05 ground; their blocks are white (2026-11-23) ».
