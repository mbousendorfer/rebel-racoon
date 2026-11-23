# The clip editor's Subtitles panel keeps the inspector's left edge

Written against: 92f208dc6

Status: applied 2026-11-23 (« Yes, apply them »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the inspector with the subtitles selected (click the Subtitles track name). `captionsInsp()` in `src/screens/clips/editor-panels.js` renders the source line, a hint, the DS tabs (`ce.tabsHTML()`), and `<div class="cap-ed__tabpanel nle-captabs" data-ce-tabpanel>`, which `src/caption-editor.js` fills with the Presets / Font / Effects controls.
- Problem: everything inside the tab panel (group titles « Text », « Outline and shadow », « Emphasis », the field rows) starts 16 px to the right of the tabs, the « The video's style » line, and the hint above it. Rendered: the user's screenshot of 2026-11-23 (the tabs and hint at one left edge, the groups at another).
- Design evidence:
  - `styles/screens/caption-editor.css:481` › `.cap-ed__tabpanel { … padding: var(--ref-spacing-sm); … }`.
  - `styles/screens/clip-editor.css:177` › `.nle-insp__body { … padding: var(--ref-spacing-sm); }`: the panel sits inside a body that already insets its content by `--ref-spacing-sm`, so the panel's own padding doubles it.
  - design-guidelines `page-patterns.md` › S2 Contextual side panel: « each section padding `--ref-spacing-sm` », a single inset; no card or extra frame inside the panel.
- Owner: `styles/screens/clip-editor.css` (the editor's host class `.nle-captabs`). Not `caption-editor.css`: its `.cap-ed__tabpanel` padding is right for its other host, the Video Clips modal (`src/components/video-clips-modal/editor-pane.js:61`), which has no outer padding.
- Scope and affected surfaces: the three tabs (Presets, Font, Effects) of the Subtitles inspector in the clip editor.
- Uncertainty: none.

## Design decision

In the clip editor, the tab panel takes no side padding of its own: the inspector body already provides the one inset S2 asks for, so the groups, the fields, and the preset grid line up with the tabs and the text above them. The top padding stays, so the first group keeps its gap under the tabs.

## Reuse

- `--ref-spacing-sm` (kept for the top padding).
- Exemplar: the other inspector views (`clipInsp()`, `textInsp()` in `editor-panels.js`) render their sections straight into `.nle-insp__body`, with no second padding.

## Changes

1. `styles/screens/clip-editor.css` — add a rule next to the inspector's rules (after `.nle-capsrc`)
   - Change: `.nle-captabs { padding: var(--ref-spacing-sm) 0 0; }` (the specificity of the two classes on one element is equal, so place it after `caption-editor.css` in load order, which `index.html` already does: `clip-editor.css` links after `caption-editor.css`).
   - Preserve: `.cap-ed__tabpanel`'s `display`, `flex-direction`, `gap`, and `overflow-y`; the Video Clips modal's padding (untouched, it doesn't carry `.nle-captabs`).
   - Verify: in the editor, « Text » (Font tab) and the first preset card (Presets tab) start at the same x as the « Presets » tab label and the hint above.

## Scope

- Inherit: Presets, Font, and Effects tabs in the clip editor.
- Verify: the Presets grid still fits two columns at the inspector's minimum width (260 px) and doesn't touch the panel's edges; the controls' right edge lines up with the hint's right edge.
- Exclude: the Video Clips modal (flag `clipsSpace` OFF), `caption-editor.css`.

## Validation

- Product: select the subtitles, switch through Presets, Font, Effects; pick a preset; change a font.
- Interface: 1440×900; inspector at 260 px and 460 px (drag the right gutter).
- System: one host rule; no `.ap-*` override; the shared engine's stylesheet unchanged.
- Repository: `npm run bump`, then `npm run check:ds` → OK, `npm run check:versions` → OK.

## Stop conditions

- Stop if `.cap-ed__tabpanel` is found inside another padded host in the editor, or if `clip-editor.css` no longer loads after `caption-editor.css` (the rule would then lose the cascade).

## Design documentation

- None (it applies S2 as written).
