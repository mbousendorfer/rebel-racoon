# The voice blocks take the Archie card frame: chat-card width, 8px corners

Written against: f756c0beb
Status: applied 2026-10-27 — the width uses `width: var(--app-chat-card); max-width: 100%`: `min(…, 100%)` collapsed the size container to 2px in the chat bubble (the stop condition's premise).

## Evidence chain

- Surface: the chat's Voice step block (`voiceAskHtml`) and the voice proposal block (`learnedVoiceHtml`), `src/components/voice-intro-modal.js`, wrapped in `.voice-edit > .voice-edit__card`.
- Problem: the block is 560px wide (`.voice-edit { width: 560px; max-width: 100% }`) with 12px corners (`.voice-edit__card { border-radius: var(--app-radius-card) }`), while the other Archie cards in the thread are 520px with 8px corners — the block reads as a foreign card.
- Design evidence: `docs/reference/UI-PATTERNS.md` §5, _Celui d'Archie_: « coins 8, inset 12 / 16, largeur `--app-chat-card` (520, posée sur la carte …) ». `styles/tokens.css:37` `--app-chat-card: 520px`; `styles/tokens.css:70` `--app-radius-lg: var(--sys-border-radius-lg); /* 8 */`.
- Owner: `styles/screens/modals.css` — `.voice-edit` (1890), `.voice-edit__card` (1899).
- Scope and affected surfaces: both blocks in the chat, the proposal dialog, the intro result stage.
- Uncertainty: none. Note: the width must stay a definite value — the card is a size container (`container-type: inline-size`) inside a chat bubble that sizes to its content; a percentage-only width collapses it.

## Design decision

Give the block the documented Archie card frame: the chat-card width (still capped by the available space) and 8px corners. The size container keeps working because `min(var(--app-chat-card), 100%)` resolves to a definite width.

## Reuse

- `--app-chat-card`, `--app-radius-lg`
- Exemplar: `.failed-turn` (`styles/chat.css:1448`) — `width: min(var(--app-chat-card), 100%)`.

## Changes

1. `styles/screens/modals.css` — `.voice-edit`
   - Change: replace `width: 560px; max-width: 100%;` with `width: min(var(--app-chat-card), 100%);`.
   - Preserve: the vertical margins and the `:first-child` rule; the comment explaining why the width must be definite.
   - Verify: computed width 520px in the chat; the tiles' `@container (max-width: 420px)` rule still applies only below 420px.
2. `styles/screens/modals.css` — `.voice-edit__card`
   - Change: `border-radius: var(--app-radius-lg)`.
   - Preserve: border grey-20, `overflow: hidden` (the butter head follows the corners), `container-type`.
   - Verify: 8px corners, butter head clipped to them.

## Scope

- Inherit: Voice step block, voice proposal block (chat, dialog, intro result).
- Verify: the proposal dialog (560px dialog — the block now leaves side room) and the intro result stage (`.voice-intro__stage-inner.is-result` sets its own width; the block must still fill it — check `max-width`).
- Exclude: the tiles' 12px corners (`.voice-ask__option`), which are cards inside the card.

## Validation

- Product: in the thread, the Voice step block lines up in width and corners with the drafts card above it.
- Interface: chat at full width and with the right panel open (narrow thread); proposal dialog; intro result stage; tiles at 520px — three secondary tiles on one row.
- System: reuses `--app-chat-card` and `--app-radius-lg`; no new value.
- Repository: `npm run bump && npm run check:ds` → `check-ds: OK`.

## Stop conditions

- Stop if three secondary tiles no longer fit one row at 520px without truncating their titles — report the measured widths instead of changing the tile layout.
- Stop if the intro result stage needs the block wider than the chat card — that stage would then need its own width rule, out of this plan's scope.

## Design documentation

- After acceptance and validation: none — `UI-PATTERNS.md` §5 already sets the frame.
