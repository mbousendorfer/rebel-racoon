# The clip editor runs on the app's dark media surface

Written against: 8802f0c09

## Evidence chain

- Surface: `/clips/:id/edit/:clipId`, rendered by `src/screens/clips/editor.js` (`renderClipEditor`, its `shellHTML()`). The rail is hidden on this route (`body.clips-editing`, set in `src/app.js` `setAfterRender`).
- Problem: the editor is light. `styles/screens/clips.css` paints `.clips-ed` white (`background: var(--ref-color-white)`), and `.clips-ed__light` maps the dark `--app-vc-*` ramp back onto DS greys, so the embedded caption editor controls (`styles/screens/caption-editor.css`, which are drawn for dark) render light too. The person who owns the product asked for the editor in dark mode.
- Design evidence: `styles/tokens.css` § "Video-clips dark surface ramp" declares `--app-vc-*` as **the single place the app defines a dark palette**, for media-editor surfaces. It has an elevation scale (sunken < surface < raised < overlay), two border weights, three text levels, and accents that reuse DS hues (blue = selected, orange = primary/AI). Exemplar on the same ramp: the Video Clips modal (`styles/components/video-clips-modal.css`), e.g. `.vc-rail` (raised + `--app-vc-border`), `.vc-rail__item.is-on` (`--app-vc-accent-pill` / `--ref-color-electric-blue-60`), `.vc-editor__timeline` (raised), `.vc-protrim__track` (sunken), `.vc-protrim__window` (`--app-vc-accent` border + `--app-vc-accent-soft` fill).
- Owner: `styles/screens/clips.css` § "The clip editor" (from `.clips-ed` to the end of the file) and the two `clips-ed__light` class uses in `src/screens/clips/editor.js` `shellHTML()`.
- Scope and affected surfaces: the editor only — transcript column, stage, transport, timeline, tool panel, tool rail. `/clips` and `/clips/:id` stay light.
- Uncertainty:
  - CSS-UI components inside the editor (`.ap-button.stroked/ghost grey`, `.ap-icon-button.transparent`, `.ap-input-group`, `.ap-radio-container`, `.ap-radio-card.card`, `.ap-toggle-container`, `.ap-checkbox-container`, `.ap-select`, `.ap-tag`, `.ap-link`, and the `.ap-slider` / `.ap-segmented-control` ports) paint with `--ref-color-*` and `--comp-*` values. For example, `.ap-button.stroked` uses `background: var(--ref-color-white)` and `.ap-input-group` uses `--comp-input-fill-color`. How they read on dark must be checked one by one.
  - The topbar stays the app's light chrome: it is outside `.clips-ed` and shared by every route.

## Design decision

Make `.clips-ed` a **dark scope**. Inside it, the DS grey ramp, white and the input fill variables are redefined onto the `--app-vc-*` ramp. Every DS control and every `--ref-color-grey-*` rule already written for the editor then turns dark through the variables. No `.ap-*` class is redeclared.

Delete the light remap `.clips-ed__light`. Its only purpose was to turn the dark-native caption editor controls light. Without it, they get their intended dark look.

Role mapping (light role → dark token):

| DS variable inside `.clips-ed`      | Becomes                    | Role                               |
| ----------------------------------- | -------------------------- | ---------------------------------- |
| `--ref-color-white`                 | `--app-vc-surface-raised`  | panels, cards, stroked-button fill |
| `--ref-color-grey-05`               | `--app-vc-surface-sunken`  | wells: stage, tracks, hovers       |
| `--ref-color-grey-10`               | `--app-vc-surface-overlay` | tags, chips, quiet fills           |
| `--ref-color-grey-20`               | `--app-vc-border`          | every hairline                     |
| `--ref-color-grey-40`               | `--app-vc-border-strong`   | control borders, waveform bars     |
| `--ref-color-grey-60`               | `--app-vc-text-subtle`     | disabled, meta                     |
| `--ref-color-grey-80`               | `--app-vc-text-muted`      | secondary text                     |
| `--ref-color-grey-100`              | `--app-vc-text`            | primary text                       |
| `--comp-input-fill-color`           | `--app-vc-field`           | text fields                        |
| `--comp-input-border-default-color` | `--app-vc-border-strong`   | text fields                        |

The editor's base surface is `--app-vc-surface`, and its stage well is `--app-vc-surface-sunken`. The transcript, panel, rail and timeline sit on the base surface, separated by `--app-vc-border` hairlines (same construction as `.vc-rail` / `.vc-panel` in the modal). Electric blue and orange keep their DS values. The output frame and the source frame stay `#000`: footage reads on black.

## Reuse

- `--app-vc-surface-sunken`, `--app-vc-surface`, `--app-vc-surface-raised`, `--app-vc-surface-overlay`, `--app-vc-field`, `--app-vc-border`, `--app-vc-border-strong`, `--app-vc-text`, `--app-vc-text-muted`, `--app-vc-text-subtle`, `--app-vc-accent`, `--app-vc-accent-soft`, `--app-vc-accent-pill`, `--app-vc-hover` (all in `styles/tokens.css`)
- Exemplar: `styles/components/video-clips-modal.css` (`.vc-rail`, `.vc-rail__item.is-on`, `.vc-panel`, `.vc-editor__timeline`, `.vc-protrim__track`, `.vc-protrim__window`)
- Exemplar: `styles/screens/caption-editor.css` (dark-native controls: `.cap-ed__tab`, `.cap-ed-preset`, `.cap-ed-seg__btn`, `.cap-ed-tword`)

No new primitive.

## Changes

1. `styles/tokens.css`
   - Change: directly under the "Video-clips dark surface ramp" block, add the dark-scope rule `.clips-ed { … }` that redefines the ten variables in the table above onto the `--app-vc-*` tokens. Add a comment saying this is the dark ramp applied as a scope, for the Clips editor.
   - Preserve: the ramp's values and every existing consumer of `--app-vc-*`.
   - Verify: inside the editor, `getComputedStyle(el).getPropertyValue("--ref-color-grey-20")` resolves to `--app-vc-border`'s value. Outside it, the value is unchanged.

2. `styles/screens/clips.css` § "The clip editor"
   - Change: delete the `.clips-ed__light` rule. Set `.clips-ed` `background` to `var(--app-vc-surface)` and `color` to `var(--app-vc-text)`. Set `.clips-ed__main` `background` to `var(--app-vc-surface-sunken)`. Restyle the active rail tool (`.clips-ed__tool.is-on`) on the modal's rail exemplar: `background: var(--app-vc-accent-pill)`, `color: var(--ref-color-electric-blue-60)`. Restyle the trim window (`.clips-tl__window`) on `.vc-protrim__window`: border `var(--app-vc-accent)`, fill `var(--app-vc-accent-soft)`. Replace the white veil of the out-of-range areas (`.clips-tl__dim`, currently `rgba(255, 255, 255, 0.7)`) with `var(--app-vc-scrim)`.
   - Preserve: the grid (transcript · main · panel · rail), every size and spacing value, the `#000` of `.clips-ed__output` and `.clips-ed__source`, and the categorical camera colours (`--app-chart-data-*`) of `.clips-tl__seg`.
   - Verify: no `#fff` / white surface remains in the editor except the footage and the subtitle box, and every hairline reads as `--app-vc-border`.

3. `src/screens/clips/editor.js` `shellHTML()`
   - Change: remove the `clips-ed__light` class from `<aside class="clips-ed__transcript …">` and from `<aside class="clips-ed__panel …">`.
   - Preserve: every `data-*` hook and the DOM structure.
   - Verify: the Subtitles tool (Presets / Font / Effects) and the transcript render with the caption editor's dark styles, matching the Video Clips modal.

4. `styles/ds-patches.css` (only if validation finds a DS control that the variable scope cannot fix)
   - Change: add a `.clips-ed`-scoped variant for that control only, in the file's existing comment style ("missing variant: on the dark media surface"). Candidates to check first: the `.ap-toggle-container` knob, the inner ring of `.ap-radio-container`, and the check glyph of `.ap-checkbox-container`.
   - Preserve: the light rendering of those controls everywhere else.
   - Verify: on and off states read at a glance on `--app-vc-surface`.

## Scope

- Inherit: every element under `.clips-ed` — transcript, stage labels, transport, timeline (ruler, waveform, trim, framing, text tracks, legend), the seven tool panels, the tool rail, and the caption editor's word menu while it is mounted inside the root.
- Verify: the canvases drawn in JS (`paintOverlay`, `paintCard` in `editor.js`) already use literal black and white on footage, so they are unchanged. The subtitle box and the text overlays keep their preset colours.
- Exclude: the topbar (shared light chrome), `/clips`, `/clips/:id`, the Video Clips modal, and the Playbook's "How your clips look" block.

## Validation

- Product: open a clip and use every tool once. Trim with the handles. In Reframe, switch layouts, drag the window, Split and Merge. Pick a subtitle preset. In Clean up, remove a filler. Add a Text title. Toggle the logo in Brand. Change the Format. Then Save. Everything works and reads on dark.
- Interface: `#/clips/vid-journey-panel/edit/vid-journey-panel-c2` (four parts, two cameras) and `#/clips/vid-social-podcast/edit/vid-social-podcast-c3` (one Two-up part), at 1440×900 and at 1280×800. Check the disabled buttons (Merge with previous, Reset this part), the open `.ap-select` (Brand › Corner), the word menu in the transcript, and the empty Text panel.
- System: no new `.ap-*` declaration outside `styles/ds-patches.css`, and no hex value outside `styles/tokens.css`. `.clips-ed__light` is gone from the CSS and the JS.
- Repository: `npm run bump` → the version rewrites; `npm run check:ds` → OK; `npm run check:versions` → OK; `npm run check:dead` → no new DEAD entry for `clips.css`.

## Stop conditions

- Stop if a DS control can only be fixed by redeclaring its class outside `styles/ds-patches.css`.
- Stop if the variable scope leaks out of `.clips-ed`, for example into a popover appended to `<body>`. The caption editor's word menu is the one to check.
- Stop if the request turns out to include the topbar. That is a decision about shared app chrome, not about this editor.

## Design documentation

- After acceptance and validation: in `docs/reference/UI-PATTERNS.md`, record that the `--app-vc-*` dark ramp is applied to the Clips editor as a variable scope (`.clips-ed` in `styles/tokens.css`). In `docs/reference/FEATURES.md` §20 (the editor), replace "light" wording, if any, with "the dark media surface".
