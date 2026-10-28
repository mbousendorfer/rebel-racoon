# The voice blocks start their text at the same x as every Archie card

Written against: f756c0beb
Status: applied 2026-10-27.

## Evidence chain

- Surface: the chat's Voice step block (`voiceAskHtml`) and the voice proposal block (`learnedVoiceHtml`), both in `src/components/voice-intro-modal.js`; their head is `<span class="voice-edit__net"><i class="<network icon>"></i></span>`.
- Problem: the network glyph sits in a 24px white disc (`.voice-edit__net`: `width/height: 24px; border-radius: 50%; background: var(--app-surface)`), 8px from the title (`.voice-edit__head { gap: var(--ref-spacing-xxs) }`). The block's text therefore starts 32px in, unlike the other Archie cards, and the disc adds a tile the thread's cards don't have.
- Design evidence: `docs/reference/UI-PATTERNS.md` §5, _Celui d'Archie_: « sans tuile derrière son glyphe … Le glyphe de tête occupe une colonne de 16px, à 12px du texte, calé sur la ligne du titre : toutes les cartes d'Archie commencent leur texte au même x ».
- Owner: `styles/screens/modals.css` — `.voice-edit__head` (1913), `.voice-edit__net` (1919), and the offsets derived from it: `.voice-edit__line` padding-left (1957), `.voice-edit__change` first column + gap (1970), `.voice-edit__rest` padding-left (2002–2005).
- Scope and affected surfaces: both blocks wherever they render (chat, `voice-proposal-modal`, intro result stage).
- Uncertainty: none.

## Design decision

Use the thread's documented head column: a bare 16px glyph, 12px before the title, top-aligned on the title's line. Re-derive every indent that encodes the old 24 + 8 = 32px offset to 16 + 12 = 28px, so the sentence, the rules' `+` column and the footnote stay aligned under the title.

## Reuse

- `--sys-icon-css-sm` (16px), `--ref-spacing-xs` (12px)
- Exemplar: `.drafts-card__icon` (`styles/chat.css:682`) — `width: 16px; height: 16px; margin-top: 1px; align-self: flex-start; background: transparent`, glyph at `--sys-icon-css-sm`.

## Changes

1. `styles/screens/modals.css` — `.voice-edit__net`
   - Change: `width: 16px; height: 16px; margin-top: 1px; align-self: flex-start;` remove `border-radius` and `background`; keep `font-size: var(--sys-icon-css-sm)`, `color`, `flex: none`, centring.
   - Preserve: the network icon itself (the `<i>` in both renderers).
   - Verify: no disc behind the glyph; glyph box 16×16.
2. `styles/screens/modals.css` — `.voice-edit__head`
   - Change: `gap: var(--ref-spacing-xs)`; `align-items: flex-start` (the glyph aligns on the title line through its 1px margin, as `.drafts-card__icon`).
   - Preserve: name/source baseline wrapper (`.voice-edit__title`), the « Not saved yet » pill on the right.
   - Verify: the title starts 28px from the card's inner left edge (16 + 12).
3. `styles/screens/modals.css` — derived offsets
   - Change: `.voice-edit__line` `padding-left: calc(16px + var(--ref-spacing-xs))`; `.voice-edit__change` `grid-template-columns: 16px 4.5rem minmax(0, 1fr)` and `column-gap: var(--ref-spacing-xs)`; `.voice-edit__rest` left padding `calc(var(--ref-spacing-sm) + 16px + var(--ref-spacing-xs))`.
   - Preserve: the `+` centred on its rule's first line (`.voice-edit__plus` margin-top formula).
   - Verify: title, sentence, rule parts and footnote share one left edge; the `+` centre is vertically under the glyph centre.

## Scope

- Inherit: Voice step block, voice proposal block (chat, dialog, intro result).
- Verify: the intro result stage, where the card sits borderless on the pixel field.
- Exclude: `.voice-ask__body` contents (examples, tiles) — they start at the card's inset, not at the text column; the tiles' own 32px icon squares.

## Validation

- Product: the Voice step and the proposal read as Archie cards, like the drafts card above them.
- Interface: chat thread with a drafts card and a Voice step block one after the other — their text starts at the same x; proposal dialog; intro result.
- System: the glyph column copies `.drafts-card__icon`; no new token.
- Repository: `npm run bump && npm run check:ds` → `check-ds: OK`.

## Stop conditions

- Stop if the network glyph proves unreadable without a ground at 16px on butter (some brand glyphs are dark discs already) — report instead of re-adding a tile.

## Design documentation

- After acceptance and validation: none — the rule is already in `UI-PATTERNS.md` §5.
