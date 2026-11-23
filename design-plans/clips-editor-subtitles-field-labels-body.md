# The clip editor's Subtitles fields are labelled like the rest of the inspector

Written against: 92f208dc6

Status: applied 2026-11-23 (« Yes, apply them »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the inspector with the subtitles selected, Font and Effects tabs. Each control row is `.cap-ed-field` with a `label.cap-ed-flabel` (« Font », « Size », « Weight », « Text color », « Uppercase », « Outline color », « Word being said »…), rendered by `field()` in `src/caption-editor.js`.
- Problem: these labels are smaller and paler than the field labels of the same inspector's other views. Rendered: the user's screenshot of 2026-11-23 (grey 12 px labels down the Font tab).
- Design evidence:
  - `styles/screens/caption-editor.css:718` › `.cap-ed-flabel { font-size: var(--sys-text-style-caption-size); line-height: var(--sys-text-style-caption-line-height); font-weight: var(--sys-text-style-caption-weight); color: var(--ref-color-grey-80) … }`.
  - design-guidelines `page-patterns.md` › P8 Type level by role: « Field label — `body` — `grey-100` — Decided ».
  - Same inspector, other views: `styles/screens/clip-editor.css` › `.nle-field__label { font-size: var(--sys-text-style-body-size); color: var(--ref-color-grey-100); }` (« Size », « X % », « In » / « Out » when a text is selected).
- Owner: `styles/screens/clip-editor.css` (scoped to the editor's host class `.nle-captabs`). `caption-editor.css` is shared with the Video Clips modal (`src/components/video-clips-modal/editor-pane.js`), outside this surface.
- Scope and affected surfaces: Font and Effects tabs of the Subtitles inspector in the clip editor.
- Uncertainty: at 14 px, a long label (« Word being said », « Second highlight ») next to its control at the inspector's minimum width (260 px). `.cap-ed-field` wraps (`flex-wrap: wrap`), so the control drops under its label rather than overflowing; confirm on screen.

## Design decision

A field label is body text in ink (14 px, grey-100), as P8 decides and as the rest of this inspector already shows. The control keeps the emphasis through its frame, not through a fainter label.

## Reuse

- `--sys-text-style-body-size`, `--sys-text-style-body-line-height`, `--sys-text-style-body-weight`, `--ref-color-grey-100`.
- Exemplar: `.nle-field__label` in `styles/screens/clip-editor.css`.

## Changes

1. `styles/screens/clip-editor.css` — add after the `.nle-captabs` rule (or after `.nle-capsrc` if that rule isn't there yet)
   - Change: `.nle-captabs .cap-ed-flabel { font-size: var(--sys-text-style-body-size); line-height: var(--sys-text-style-body-line-height); font-weight: var(--sys-text-style-body-weight); color: var(--ref-color-grey-100); }`
   - Preserve: `.cap-ed-flabel`'s `flex: 1` and `min-width`; the hint under a label (`.cap-ed-fhint`) stays as it is.
   - Verify: « Font », « Size », « Text color » read at 14 px in ink, like « Size » in a text's inspector.

## Scope

- Inherit: every field row of the Font and Effects tabs in the clip editor.
- Verify: rows with a toggle (« Uppercase », « Shadow »), a colour swatch with its hex, a number input, and a DS select still align on the right; long labels at 260 px wrap cleanly.
- Exclude: the hex values beside the swatches (metadata, caption grey-80), the Video Clips modal, `caption-editor.css`.

## Validation

- Product: select the subtitles, open Font, change Size and Text color; open Effects.
- Interface: 1440×900; inspector at 260 px and 460 px.
- System: tokens only, one scoped rule.
- Repository: `npm run bump`, then `npm run check:ds` → OK, `npm run check:versions` → OK.

## Stop conditions

- Stop if, at 260 px, a label wrapping under the larger size breaks a row (control overlapping its label) — that needs a layout decision, not this rule.

## Design documentation

- None (it applies P8 as written).
