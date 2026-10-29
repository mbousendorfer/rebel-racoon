# The run's review card titles use the Playbook page's h2

Written against: dcb0df053ea9ad2a2f8ccd3d07bc7d94ccc9867b

## Evidence chain

- Surface: the first-time run's reviews, `#/welcome-alt/recap` and `#/welcome-alt/voice`.
- Problem: a review card's title (« Never », « Your business »…) is set in the DS marketing text style, the largest and heaviest, with negative letter-spacing. The user, on a screenshot of the Default voice › Never card: « l'UI des cards est peut-être trop bold … + compact et + dans l'UI d'agorapulse ».
- Design evidence:
  - `styles/screens/playbook-v2.css:512`: `.pb2-block__title` uses `--sys-text-style-h2-*`. That is the block's own title style, the one the Playbook page renders.
  - `styles/screens/welcome.css:1326`: `.welcome-flow__sheet .welcome-review__card .pb2-block__title` overrides it with `--sys-text-style-marketing-*` and `letter-spacing: -0.01em`.
  - House rule (design-guidelines): hierarchy comes from size and weight within the DS text styles.
- Owner: `styles/screens/welcome.css`.
- Scope and affected surfaces: every review card title in both run reviews.
- Uncertainty: none on the correction. The card's subtitle (`.pb2-block__hint`, DS subtitle style) stays as is.

## Design decision

Drop the review's override, so the card's title is the block's own h2, the same as on the Playbook page.

## Reuse

- `--sys-text-style-h2-*` through `.pb2-block__title` (`styles/screens/playbook-v2.css:512`)
- Exemplar: a block title on `#/playbook/ctx-acme`

## Changes

1. `styles/screens/welcome.css`, rule `.welcome-flow__sheet .welcome-review__card .pb2-block__title` (around line 1326)
   - Change: delete the whole rule.
   - Preserve: `.welcome-review__card .pb2-block__head { margin-bottom }` just above, and the subtitle rules below.
   - Verify: the card title renders at the h2 size and weight, like on the Playbook page.

## Scope

- Inherit: all review cards on `/welcome-alt/recap` and `/welcome-alt/voice`.
- Verify: the « Your networks » card (« Which networks get their own voice? ») and the « Voice for X » cards still read as one heading over one sentence.
- Exclude: the left column's H1 (« Check what I learned »), the intro's display title.

## Validation

- Product: run the onboarding, open « Check your voice », step through Default voice's five cards.
- Interface: both reviews; long titles (« Which networks get their own voice? ») on a narrow window.
- System: the review no longer defines its own title style; `grep -n "pb2-block__title" styles/screens/welcome.css` → no match.
- Repository: `npm run bump && npm run check:versions && npm run check:ds` → all OK.

## Stop conditions

- Stop if another rule in `welcome.css` sizes `.pb2-block__title` for the review (search before deleting).

## Design documentation

- After acceptance and validation: none.
