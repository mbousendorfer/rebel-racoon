# The clip editor's Subtitles groups are titled like the inspector's sections

Written against: 92f208dc6

Status: applied 2026-11-23 (« Yes, apply them »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the inspector with the subtitles selected, Font and Effects tabs. Each tab is split into groups (`.cap-ed-group`), each titled by `.cap-ed-group-label` (« Text », « Outline and shadow », « Emphasis »…), rendered by `group()` in `src/caption-editor.js`.
- Problem: the group titles are small grey captions, while the sections of the same inspector's other views (« Range », « Subtitles », « Teaser » for the clip; « Look », « Position », « Timing » for a text) are h3 in ink. One role, two treatments, in one panel. Rendered: the user's screenshot of 2026-11-23.
- Design evidence:
  - `styles/screens/caption-editor.css:701` › `.cap-ed-group-label { font-size: var(--sys-text-style-caption-size); line-height: var(--sys-text-style-caption-line-height); font-weight: var(--sys-text-style-caption-bold-weight); color: var(--ref-color-grey-80); margin-bottom: var(--ref-spacing-xxxs); }`.
  - `styles/screens/clip-editor.css` › `.nle-sec__title { … font-size: var(--sys-text-style-h3-size); font-weight: var(--sys-text-style-h3-weight); line-height: var(--sys-text-style-h3-line-height); }` (ink inherited from `.nle`, `--ref-color-grey-100`).
  - design-guidelines `page-patterns.md` › P8: « Card / sub-section title — `h3` — `grey-100` »; › S2: a side panel's « section title `h3` ».
- Owner: `styles/screens/clip-editor.css` (scoped to `.nle-captabs`); `caption-editor.css` stays as it is for the Video Clips modal.
- Scope and affected surfaces: Font and Effects tabs of the Subtitles inspector in the clip editor.
- Uncertainty: none.

## Design decision

A group inside the Subtitles tabs is a section of the inspector, so its title takes the same h3 in ink as every other section of that inspector. The inspector's staircase then holds in every view: h2 (what's selected) → tabs → h3 (its groups) → body (field labels).

## Reuse

- `--sys-text-style-h3-size`, `--sys-text-style-h3-weight`, `--sys-text-style-h3-line-height`, `--ref-color-grey-100`.
- Exemplar: `.nle-sec__title` in `styles/screens/clip-editor.css`.

## Changes

1. `styles/screens/clip-editor.css` — add next to the other `.nle-captabs` rules
   - Change: `.nle-captabs .cap-ed-group-label { font-size: var(--sys-text-style-h3-size); line-height: var(--sys-text-style-h3-line-height); font-weight: var(--sys-text-style-h3-weight); color: var(--ref-color-grey-100); }`
   - Preserve: `margin-bottom`, the hairline between groups (`.cap-ed-group + .cap-ed-group`, grey-20), the group's gap.
   - Verify: « Text », « Outline and shadow », « Emphasis » read like « Look » and « Position » in a text's inspector.

## Scope

- Inherit: every group title of the Font and Effects tabs in the clip editor.
- Verify: the Presets tab (no group titles) is unchanged; a long title (« Outline and shadow ») fits on one line at 260 px or wraps cleanly.
- Exclude: the Video Clips modal, `caption-editor.css`, the DS tabs above the panel.

## Validation

- Product: select the subtitles; open Font, then Effects.
- Interface: 1440×900; inspector at 260 px and 460 px.
- System: tokens only, one scoped rule; same text style as `.nle-sec__title`.
- Repository: `npm run bump`, then `npm run check:ds` → OK, `npm run check:versions` → OK.

## Stop conditions

- Stop if the group titles turn out to be rendered as headings inside a single section on purpose (a doc naming them a « quiet label » for this host).

## Design documentation

- After acceptance and validation: in `docs/reference/FEATURES.md` §20, in « La hiérarchie », add « the Subtitles tabs follow the inspector: groups in h3, labels in body grey-100, no second inset (2026-11-23) ».
