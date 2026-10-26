# The clip editor's panel buttons keep their own width

Written against: 8802f0c09

## Evidence chain

- Surface: `/clips/:id/edit/:clipId`. The tool panel `<aside class="clips-ed__panel" data-clips-panel>` is rendered by `paintPanel()` in `src/screens/clips/editor.js`.
- Problem: some `.ap-button`s in the panel stretch to the panel's full width:
  - in the Reframe panel, "Apply to all … shots (n)" (inside `.clips-ed__group`) and "Swap top and bottom" (a direct child of the panel);
  - in the Format panel, "Use the video's format" (a direct child of the panel).
- Design evidence: `CLAUDE.md` § Design System, the house rules: "CTAs never full width". The global UI rule says the same thing: "Les boutons ne font jamais toute la largeur de leur conteneur. Les CTA restent auto-width".
- Owner: `styles/screens/clips.css`:
  - `.clips-ed__panel` (`display: flex; flex-direction: column;` with no `align-items`, so its children stretch);
  - `.clips-ed__group` (same construction).
- Scope and affected surfaces: the seven tool panels (Trim, Reframe, Subtitles, Clean up, Text, Brand, Format). Buttons inside `.clips-ed__row` (a flex row) already keep their width.
- Uncertainty: none.

## Design decision

A button in the tool panel hugs its label. Scope the fix to the buttons, not to the containers: the panel also holds content that must stay full width (`.clips-ed__fields` grid, `.clips-ed__text-list`, `.clips-ed__formats` radio cards, `.ap-select`, the caption editor's tab panel).

## Reuse

- `.ap-button` (CSS-UI), unchanged
- Exemplar: `styles/screens/playbook-v2.css` `.pb2-cliplook` (flex column + `align-items: flex-start`, so controls keep their width)

No new primitive.

## Changes

1. `styles/screens/clips.css`, next to `.clips-ed__panel`
   - Change: add `.clips-ed__panel .ap-button { align-self: flex-start; }`.
   - Preserve: full-width children that aren't buttons (fields grid, text list, format cards, selects, the caption editor's preset grid), and the buttons already laid out in `.clips-ed__row`.
   - Verify: "Apply to all Two-up shots (2)", "Swap top and bottom" and "Use the video's format" are as wide as their label plus padding, left-aligned.

## Scope

- Inherit: every `.ap-button` rendered in the tool panel, now and later.
- Verify: buttons inside `.clips-ed__row` still sit side by side. The caption editor's own buttons (`.cap-ed__tab`, `.cap-ed-preset`, `.cap-ed-seg__btn`, `.cap-ed-clean-row__seek`) are not `.ap-button` and are unchanged.
- Exclude: the topbar actions, the timeline, and the `/clips` and `/clips/:id` pages.

## Validation

- Product: open a clip, go to Reframe on a Two-up part, then to Format with a format different from the video's. Every button keeps its width.
- Interface: `#/clips/vid-journey-panel/edit/vid-journey-panel-c2` (Reframe: Apply to all + Swap once Two speakers is picked), Format after picking 1:1, at 1440×900.
- System: no `.ap-button` declaration outside this descendant rule. No width override.
- Repository: `npm run bump` → OK; `npm run check:ds` → OK; `npm run check:versions` → OK.

## Stop conditions

- Stop if a button is meant to fill the panel (none today). That would be a deliberate exception to document, not a CSS change.

## Design documentation

- None. The rule is already documented.
