# Each section of the voice proposal says what it is, above its content

Written against: eb99a87dd
Status: applied 2026-10-27 — stop condition hit: the chat proposal from the 5-question interview measures 863px (over an 800px viewport); nothing trimmed, reported to the user.

## Evidence chain

- Surface: the voice proposal block — `learnedVoiceHtml` in `src/components/voice-intro-modal.js`, one `.voice-edit__group` per Voice profile part with `<h4 class="voice-edit__part">` as its title. Hosts: chat `voice-learned` turn, proposal dialog (`src/components/voice-proposal-modal.js`), feedback offer (`src/components/feedback-control.js`), intro result stage. Reproduce as in plan `voice-proposal-1-rules-as-in-voice-profile.md`.
- Problem: measured in the browser, each section title (`.voice-edit__part`) renders at 12px / 16px bold, under the 14px / 18px rules it heads — the title is smaller than its content, the hierarchy the user reported as inverted (« mal hiérarchisé »). Nothing says what a section is for, while the Voice profile tab says it under every title (« Rules every post follows. »).
- Design evidence:
  - `docs/reference/UI-PATTERNS.md` §5, _Celui d'Archie_ / _Typo_: « titre 14 / 18 gras, ligne secondaire 12 / 16 grey-80 … partout » (cards in the thread).
  - The Voice profile tab's section head: `src/playbook-view.js` `pb2VoiceParts` (line 2529) → `pb2Block(title, body, { hint: PART_COPY[field]?.hint })`; `PART_COPY` (line 2437): voiceSummary « The overall tone, in a few sentences. », voiceAlways « Rules every post follows. », voiceNever « What no post ever does, and the words I never use. », voiceByPost « How each kind of post is written — a launch, a hiring post, a recap. », voiceSometimes « Habits I use sometimes, not in every post. ».
  - User directive in the commissioning conversation: the sections must be « les mêmes que dans la Voice ».
- Owner: `styles/screens/modals.css` `.voice-edit__part` (two rules today — padding-left and type, lines ~1982 and ~2000); `src/components/voice-intro-modal.js` group markup.
- Scope and affected surfaces: every host of `learnedVoiceHtml`.
- Uncertainty: `PART_COPY` is private to `src/playbook-view.js`; its hints must become importable (see Changes 1).

## Design decision

A section title is the card's title rung — 14/18 bold grey-100 — and under it the section's own description from the Voice profile, as the card's secondary line, 12/16 grey-80. The section then reads « Always · Rules every post follows. » before its rules, exactly as in the tab, at the card's scale.

## Reuse

- `--sys-text-style-body-bold-size` / `-line-height` / `-weight`, `--ref-color-grey-100` (title)
- `--sys-text-style-caption-size` / `-line-height`, `--ref-color-grey-80` (hint)
- The hints: `PART_COPY[field].hint` — `src/playbook-view.js:2437`
- Exemplars: `.voice-edit__name` (14/18 bold title in the same block) and `.voice-edit__from` (12/16 grey-80 in the same block)

## Changes

1. `src/voice-parts.js`
   - Change: add a `hint` to each entry of `VOICE_PARTS` with the exact `PART_COPY[field].hint` strings above; `voiceParts()` exposes it.
   - Preserve: `title`, `field`, `kind`, order.
   - Verify: `voiceParts().map(p => p.hint)` returns the five strings.
2. `src/playbook-view.js`
   - Change: `pb2VoiceParts` takes the hint from the part (`hint` from `voiceParts()`), and `PART_COPY` drops its `hint` keys (keeps `empty`, `placeholder`).
   - Preserve: the tab's hints, word for word.
   - Verify: Playbook › Voice profile shows the same five hints as before.
3. `src/components/voice-intro-modal.js` — `learnedVoiceHtml`
   - Change: carry `hint` into each group and render `<p class="voice-edit__hint">${hint}</p>` right after the group's `<h4 class="voice-edit__part">`.
   - Preserve: the group order, the rules under it, the `only` filter.
   - Verify: each band reads title, hint, then its content.
4. `styles/screens/modals.css`
   - Change: merge the two `.voice-edit__part` rules into one: `margin: 0; padding-left: calc(16px + var(--ref-spacing-xs));` with `font-size: var(--sys-text-style-body-bold-size); line-height: var(--sys-text-style-body-bold-line-height); font-weight: var(--sys-text-style-body-bold-weight); color: var(--ref-color-grey-100);`. Add `.voice-edit__hint { margin: 0; padding-left: calc(16px + var(--ref-spacing-xs)); font-size: var(--sys-text-style-caption-size); line-height: var(--sys-text-style-caption-line-height); color: var(--ref-color-grey-80); }`.
   - Preserve: the bands' 12/16 padding and grey-20 hairlines.
   - Verify: computed `.voice-edit__part` = 14px / 18px / 700 / grey-100; `.voice-edit__hint` = 12px / 16px / grey-80; title, hint and content start at the same x as the card's title (45px in the chat).

## Scope

- Inherit: all hosts of `learnedVoiceHtml`.
- Verify: the feedback offer (`only`, one section) and the intro result stage (narrower).
- Exclude: the butter head; the Voice step block (`voiceAskHtml`); the Playbook tab's own `pb2-block__title` (18px — a page section, not a card).

## Validation

- Product: scanning the proposal, a user sees five named sections, each saying what it holds, then the rules.
- Interface: chat proposal (5 sections), feedback offer (1 section), proposal dialog, intro result; long hint (« How each kind of post is written — a launch, a hiring post, a recap. ») wraps under the title without overflow at 520px and in the dialog.
- System: one source for the hints (`VOICE_PARTS`), read by the tab and the proposal; no copied strings.
- Repository: `npm run bump && npm run check:ds && npm run check:dead && npm run check:versions` → OK.

## Stop conditions

- Stop if the five hints make the chat proposal taller than the viewport at 800px height without plan 1's rule cards being any shorter — report the measured height before trimming anything.
- Stop if any other surface reads `PART_COPY.*.hint` — move it as well, or report it.

## Design documentation

- After acceptance and validation: `docs/reference/FEATURES.md` §9 — the proposal's sections are « titre 14/18 gras, puis la description de la section du Voice profile (12/16 grey-80, `VOICE_PARTS[].hint`, partagée avec l'onglet) ».
