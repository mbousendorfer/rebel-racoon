# Archie's sentence in the voice blocks reads as a secondary line

Written against: f756c0beb
Status: applied 2026-10-27.

## Evidence chain

- Surface: the chat's Voice step block (`voiceAskHtml`, `src/components/voice-intro-modal.js`, rendered by `src/screens/session/thread-render.js` for the `voice-ask` turn) and its sibling, the voice proposal block (`learnedVoiceHtml`, same file; `voice-learned` turn, `src/components/voice-proposal-modal.js`, the intro dialog's result stage). Reproduce: flag `voicePerNetwork` ON, returning mode, a chat with drafts, then `requireNetworkVoices(sessionId, ["tiktok"], …)` from `src/network-voice-flow.js`.
- Problem: the block's title (`.voice-edit__name`) and Archie's sentence under it (`.voice-edit__line`) render at the same size and ink — measured 14px / 18px, title bold, sentence regular, both `rgb(52, 69, 99)` (grey-100). Nothing separates the title from the explanation; the block has no clear first read.
- Design evidence: `docs/reference/UI-PATTERNS.md` §5 « Les éléments du fil », _Celui d'Archie_ / _Typo_: « titre 14 / 18 gras, ligne secondaire 12 / 16 grey-80 (ou navy-20 sur navy), partout ». `docs/reference/UI-PATTERNS.md:60`: every size comes from the DS text styles (`--sys-text-style-*`).
- Owner: `styles/screens/modals.css` — `.voice-edit__line` (line 1955).
- Scope and affected surfaces: every consumer of `.voice-edit__line` — the Voice step block (chat), the voice proposal block (chat `voice-learned` turn, `voice-proposal-modal` dialog, the intro dialog's result stage in `voice-intro-modal`).
- Uncertainty: none.

## Design decision

Set the sentence in the documented secondary style: caption size and line height, grey-80 ink. The title stays 14/18 bold grey-100, so the block reads title → explanation, as every other Archie card in the thread does.

## Reuse

- `--sys-text-style-caption-size`, `--sys-text-style-caption-line-height`, `--ref-color-grey-80`
- Exemplar: `.voice-edit__from` (`styles/screens/modals.css`, same block) already uses exactly this triplet.

## Changes

1. `styles/screens/modals.css` — `.voice-edit__line`
   - Change: add `font-size: var(--sys-text-style-caption-size); line-height: var(--sys-text-style-caption-line-height);` and change `color` from `var(--ref-color-grey-100)` to `var(--ref-color-grey-80)`.
   - Preserve: `margin: 0`, the left padding (owned by plan 2), `text-wrap: pretty`.
   - Verify: computed style of `.voice-edit__line` = 12px / 16px, `rgb(93, 106, 130)`.

## Scope

- Inherit: Voice step block, voice proposal block in the chat, the proposal dialog, the intro dialog's result stage.
- Verify: the intro result stage (white card on the pixel field) — the sentence stays legible on white.
- Exclude: `.voice-edit__name`, `.voice-edit__from`, the rules list (`.voice-edit__rule` stays body size — it is the content being proposed, not a secondary line).

## Validation

- Product: the user sees « No rules for TikTok yet » first, then the explanation.
- Interface: chat (Voice step, proposal), proposal dialog (Playbook › Voice profile › a network tab › Learn from… › A few questions…), intro dialog result (Admin › Replay the voice intro › Next › Learn).
- System: no new token; same triplet as `.voice-edit__from`.
- Repository: `npm run bump && npm run check:ds` → `check-ds: OK`; `npm run check:versions` → OK.

## Stop conditions

- Stop if the sentence must carry the block's message on its own (e.g. a variant with no title) — then the title rule changes, not this line.

## Design documentation

- After acceptance and validation: none — `UI-PATTERNS.md` §5 already states the rule; the FEATURES §9 phrase « la phrase d'Archie en corps » becomes « la phrase d'Archie en ligne secondaire (12/16 grey-80) ».
