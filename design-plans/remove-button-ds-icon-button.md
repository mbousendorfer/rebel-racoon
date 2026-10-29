# Row remove buttons use the DS icon button

Written against: dcb0df053ea9ad2a2f8ccd3d07bc7d94ccc9867b

## Evidence chain

- Surface: the Playbook editor (`src/playbook-view.js`), shown both on the Playbook page and in the run's reviews: voice rules (Always, Never, Depending on the post, Now and then), call-to-action links (Brief › Links), a competitor's social links.
- Problem: the × that removes a row is a hand-built 32px bordered square (`.recap__cta-remove`), heavier than the DS control and unlike the × beside a brand color in the same view.
- Design evidence:
  - `CLAUDE.md` § Design System: "Do not invent custom components … when the DS already provides them"; house rule "Never hand-build a control the DS ships".
  - The DS ships `.ap-icon-button` (`@agorapulse/ui-theme` `css-ui/index.css`).
  - Exemplar in the same file: `src/playbook-view.js:1180`, the brand color remove: `<button type="button" class="ap-icon-button transparent grey" … aria-label="Remove color"><i class="ap-icon-close"></i></button>`.
  - The hand-built control: `styles/screens/welcome.css:3087–3111` (`.recap__cta-remove`, `:hover`, `i`).
- Owner: `src/playbook-view.js` (markup), `styles/screens/welcome.css` (styles).
- Scope and affected surfaces: the three `.recap__cta-remove` consumers:
  - `src/playbook-view.js:837`, CTA link remove (`data-recap-cta-remove`);
  - `src/playbook-view.js:1688`, competitor social remove (`data-recap-cmp-social-remove`);
  - `src/playbook-view.js:2621`, voice rule remove (`data-vr-remove`).
- Uncertainty: `transparent` and `grey` are not `.ap-icon-button` modifiers in CSS-UI (only `.stroked.transparent` is). The exemplar renders as the default `.ap-icon-button`. Keep the exemplar's exact classes so the two × stay identical; validate the render.

## Design decision

Every row remove button is the DS icon button, marked up like the brand color remove in the same view. The hand-built square's visual CSS goes; its class stays only as a layout hook for the grids that place it.

## Reuse

- `.ap-icon-button` with `<i class="ap-icon-close">`
- Exemplar: `src/playbook-view.js:1180`

## Changes

1. `src/playbook-view.js:837`, `:1688`, `:2621`
   - Change: `class="recap__cta-remove"` → `class="ap-icon-button transparent grey recap__cta-remove"`. Keep the `data-*` attributes, `aria-label` and the `<i class="ap-icon-close">` child as they are.
   - Preserve: click handling (delegation on the `data-*` attributes), labels.
   - Verify: each × removes its row as before.
2. `styles/screens/welcome.css:3087–3111`
   - Change: delete the visual declarations of `.recap__cta-remove` (display, size, border, radius, background, color, cursor, transition), `.recap__cta-remove i`, and `.recap__cta-remove:hover`.
   - Preserve: the layout rules that place it: `.welcome-review__card .recap__cta-remove { grid-column: 3; }` (around line 1467) and the responsive `grid-area: remove; align-self: start;` (around line 3174).
   - Verify: the × sits in the same grid cell, at the DS icon button size.
3. Repository
   - Change: `npm run bump` (the `?v=` cache-buster), as for any JS/CSS change.

## Scope

- Inherit: the Playbook page (Brief › Links edit, Competitors edit, Voice profile edit) and both run reviews.
- Verify: the brand color remove (`:1180`) and brand kit pair remove (`src/playbook-brand-kit.js:187`) look identical to the new × buttons.
- Exclude: the Image Studio's own close buttons (module `src/modules/image-studio/`), modal close buttons.

## Validation

- Product: on `#/playbook/ctx-acme?tab=voice`, edit the default voice, remove a rule; on the Brief tab, edit Links and remove one; in the run, « Check your voice » › Never, remove a rule.
- Interface: hover and keyboard focus on the ×; a rule row with a long, wrapping text; the narrow-window CTA grid (`grid-area: remove`).
- System: `grep -n "border: 1px solid var(--app-border)" styles/screens/welcome.css` near `.recap__cta-remove` → gone; no new remove-button style introduced.
- Repository: `npm run bump && npm run check:versions && npm run check:ds` → all OK.

## Stop conditions

- Stop if the default `.ap-icon-button` renders with a fill or border that differs from the brand color ×, which would mean the exemplar relies on a local patch (check `styles/ds-patches.css`) — report it before choosing a variant.

## Design documentation

- After acceptance and validation: none.
