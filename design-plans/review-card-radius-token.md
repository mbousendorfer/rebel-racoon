# The run's review cards use the card radius token

Written against: dcb0df053ea9ad2a2f8ccd3d07bc7d94ccc9867b

## Evidence chain

- Surface: the first-time run's reviews, `#/welcome-alt/recap` and `#/welcome-alt/voice` (each part shown as a column of cards on the right-hand stage).
- Problem: each review card is rounded at a hard-coded `20px`, and its tinted top band repeats `20px 20px 0 0`. The same block on the Playbook page is rounded at 12px. The card reads heavier than the rest of the app.
- Design evidence:
  - `CLAUDE.md` § Design System, step 3: "Use DS tokens, not hardcoded values."
  - `styles/tokens.css:73`: `--app-radius-card: 12px; /* handoff source/idea/post/context cards */`.
  - `styles/screens/playbook-v2.css:483`: `.pb2-block { border-radius: var(--app-radius-card); }`. The review card is that same `.pb2-block` (class `welcome-review__card` is added on it in `src/screens/welcome-alt-review.js:288`).
- Owner: `styles/screens/welcome.css`.
- Scope and affected surfaces: every card of both run reviews (Brief, Branding, Competitors, Influencers, Default voice, Your networks, Voice for X).
- Uncertainty: none.

## Design decision

Round the review card with the app's card token, so it matches the same block on the Playbook page. Its tinted band follows the card's corners.

## Reuse

- `--app-radius-card` (`styles/tokens.css:73`)
- Exemplar: `styles/screens/playbook-v2.css:483` (`.pb2-block`)

## Changes

1. `styles/screens/welcome.css`, rule `.welcome-flow__sheet.is-scroll .welcome-review__card` (around line 1072)
   - Change: `border-radius: 20px;` → `border-radius: var(--app-radius-card);`
   - Preserve: padding, shadow, background, `animation: none`.
   - Verify: the card's corners match a block on `#/playbook/ctx-acme`.
2. `styles/screens/welcome.css`, rule `.welcome-review__kicker` (around line 1298)
   - Change: `border-radius: 20px 20px 0 0;` → `border-radius: var(--app-radius-card) var(--app-radius-card) 0 0;`
   - Preserve: the band's tint, margins, padding and bottom border.
   - Verify: the band's top corners follow the card's, with no gap or overflow at the corners.

## Scope

- Inherit: all review cards on `/welcome-alt/recap` and `/welcome-alt/voice`, first-time and « Create a Playbook ».
- Verify: the "all set" card at the end of a part (`.welcome-review__done` or equivalent) keeps its own look. It is not in this rule.
- Exclude: the run's left column, the intro, the Ready screen's Playbook card.

## Validation

- Product: run the onboarding (`archie-user-mode=new-alt`), open « Check what I learned », then « Check your voice ». Cards look like the Playbook page's blocks.
- Interface: both reviews; a card with a tinted band; a long card (Brief › Your business) and a short one (Influencers).
- System: no new radius value introduced; `--app-radius-card` is the only radius on the card.
- Repository: `npm run bump && npm run check:versions && npm run check:ds` → all OK.

## Stop conditions

- Stop if the band's tint shows outside the card's corners after the change (would need `overflow: hidden` on the card, which may clip the stage's shadow — ask first).

## Design documentation

- After acceptance and validation: none.
