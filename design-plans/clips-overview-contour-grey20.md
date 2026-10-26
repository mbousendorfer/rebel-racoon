# The project overview's clip marks are outlined in grey-20

> **Superseded 2026-10-26** — the Clips space went back to the light DS (no dark scope, no `--app-vc-*` ramp). Kept for history only.

Written against: 8802f0c09

## Evidence chain

- Surface: `/clips/:id`, the strip "Where the clips sit in the video" rendered by `renderOverview()` in `src/screens/clips/project.js`. Each clip is a `<button class="clips-overview__clip">`.
- Problem: the default outline of a clip mark is `grey-60` (`styles/screens/clips.css` `.clips-overview__clip { border: 1px solid var(--ref-color-grey-60) }`), on a `grey-40` fill.
- Design evidence: `CLAUDE.md` § Design System, the house rules: "borders grey-20". The global UI rule: "Bordures, séparateurs, filets et contours : grey-20 … grey-40 reste légitime en remplissage de forme."
- Owner: `styles/screens/clips.css` `.clips-overview__clip`.
- Scope and affected surfaces: the overview strip of every video project, on both tabs (Clips and Drafts).
- Uncertainty: none. The `grey-40` fill is allowed as a fill and stays.

## Design decision

The default outline of a clip mark follows the house contour rule: `grey-20`. The interactive states keep their blue: `.is-selected` (`electric-blue-100` border, `electric-blue-40` fill) and `:hover` (`electric-blue-150` border). That is blue on what you can click.

## Reuse

- `--ref-color-grey-20`
- Exemplar: `.clips-overview__track` in the same file (`border: 1px solid var(--ref-color-grey-20)`)

No new primitive.

## Changes

1. `styles/screens/clips.css` `.clips-overview__clip`
   - Change: `border: 1px solid var(--ref-color-grey-20);` instead of `var(--ref-color-grey-60)`.
   - Preserve: the `grey-40` fill, the 3px radius, `.is-selected` and `:hover`.
   - Verify: unselected marks have a grey-20 hairline. Selected marks stay blue. Hover turns the outline blue.

## Scope

- Inherit: every unselected clip mark on `/clips/:id`.
- Verify: the selected state and the hover state.
- Exclude: the editor's timeline (its own tracks, covered by `design-plans/clips-editor-dark-mode.md`) and the library cards.

## Validation

- Product: on a project, untick a clip. Its mark turns grey with a grey-20 outline. Tick it again and it turns blue.
- Interface: `#/clips/vid-social-podcast` (10 marks, 52 min video) at 1440×900. Hover a mark.
- System: no other `grey-40`/`grey-60` outline remains in `.clips-overview*`.
- Repository: `npm run bump` → OK; `npm run check:ds` → OK; `npm run check:versions` → OK.

## Stop conditions

- Stop if unselected marks lose their legibility against the `grey-05` track. Report it rather than picking another grey: the rule allows no other contour value.

## Design documentation

- None.
