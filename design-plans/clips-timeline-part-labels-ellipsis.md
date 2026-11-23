# Framing parts' labels end with « … » instead of being cut mid-word

Written against: 02ede3184

Status: applied 2026-11-23 (« Yes, apply both »)

## Evidence chain

- Surface: clip editor, Reframe tool — `#/clips/:id/edit/:clipId?tool=reframe`, the Framing track's parts (`segHTML` in `renderTimeline`, `src/screens/clips/editor.js:730-742`).
- Problem: on a narrow part the two lines of its label are chopped mid-word with no ellipsis — « Wid » / « Autc » in the user's screenshot of 2026-11-23 (the first part, after a Split part).
- Design evidence:
  - The button `.clips-tl__seg` clips its content: `white-space: nowrap; overflow: hidden;` (`styles/screens/clips.css:1660-1681`).
  - Its two children `.clips-tl__seg-cam` (camera, bold) and `.clips-tl__seg-lay` (layout) have no `text-overflow`, so the browser cuts them at the box edge.
  - The full label is already in the button's `aria-label` (camera, layout, start time), so nothing is lost by truncating visually.
- Owner: `styles/screens/clips.css` — `.clips-tl__seg-cam` (line ~1696) and a new rule for `.clips-tl__seg-lay` beside it.
- Scope and affected surfaces: the Framing track in Reframe.
- Uncertainty: none.

## Design decision

A label that doesn't fit ends with « … », line by line: each span becomes a block that truncates with an ellipsis. The button keeps its size and its accessible name.

## Reuse

- The single-line truncation already in the Clips space: `overflow: hidden; white-space: nowrap; text-overflow: ellipsis;`.
- Exemplar: `.clips-box__staged-text b` in `styles/screens/clips.css` (line ~235, the staged file's name in the add box).

## Changes

1. `styles/screens/clips.css` — `.clips-tl__seg-cam`
   - Change: add `display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis;` (keep its `font-weight`).
   - Preserve: the bold weight, the caption size inherited from `.clips-tl__seg`.
   - Verify: a narrow part shows « W… » instead of « Wid ».
2. `styles/screens/clips.css` — `.clips-tl__seg-lay` (new rule next to it)
   - Change: `display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis;`
   - Preserve: regular weight.
   - Verify: a narrow part shows « Au… » instead of « Autc ».

## Scope

- Inherit: every framing part.
- Verify: wide parts look the same as before (full text, no ellipsis); hover and current borders unchanged.
- Exclude: the Text track parts (`.clips-tl__text`) unless they show the same cut — check them, but don't change them in this plan.

## Validation

- Product: Split part near the start of a clip so a part is ~2 s wide → its two lines end with « … »; hover still shows the blue border; clicking still selects it.
- Interface: 1280 / 1440 / 1920; one part and many parts.
- System: no new token; same ellipsis pattern as the rest of the app.
- Repository: `npm run bump`, then `npm run check:ds` and `npm run check:versions` → OK.

## Stop conditions

- Stop if the spans' parent stops being a flex column (the `display: block` children rely on `.clips-tl__seg { display: flex; flex-direction: column; }`).

## Design documentation

- None.
