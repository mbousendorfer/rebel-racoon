# The clip editor's inspector title stands a step above its sections

Written against: e83b6d5c3

Status: applied 2026-11-23, inside the editor's hierarchy pass (« Yes, do the pass »)

## Evidence chain

- Surface: clip editor, `#/clips/:id/edit/:clipId`, the inspector on the right (`inspectorHTML()` in `src/screens/clips/editor-panels.js`): its header `h2.nle-insp__title` (« Clip », « Text », « Framing », « Subtitles », « Brand »), then sections titled by `h3.nle-sec__title` (« Range », « Format », « Teaser », « Look », « Position »…).
- Problem: the header and the section titles read at the same level. Rendered: the user's screenshot of 2026-11-23 (« Clip » above « Range » / « Format » / « Teaser »), with the user's words « ça manque de hiérarchie… tout est très au même niveau ».
- Design evidence:
  - `styles/screens/clip-editor.css`: `.nle-insp__title` uses `--sys-text-style-h3-size` / `-weight` / `-line-height` (16/700/24), and `.nle-sec__title` uses `--sys-text-style-h4-*` (14/700/20). That is a 2 px step at the same weight.
  - `docs/reference/UI-PATTERNS.md` › settings page family: « À 18 le titre de page n'est qu'à 2px des `.ap-card-title` (16) et la hiérarchie se lit plate. 24 → 16 → label de groupe en `.ap-caption-bold` (12) donne trois marches lisibles. »
  - `~/.claude/CLAUDE.md` › Règles visuelles Agorapulse: « On hiérarchise par graisse et par taille. »
  - Prior decision for this same panel, lost in the 2026-11-23 rebuild without being replaced (`git show 70208ae73:docs/reference/FEATURES.md`, §20): « Le titre du panneau est en h2 (18/700), un niveau au-dessus de ses sous-titres. »
- Owner: `styles/screens/clip-editor.css` › `.nle-insp__title` (around line 201).
- Scope and affected surfaces: the inspector header for every selection kind (clip, text, framing part, subtitles, brand item). The header row is 48 px tall (`.nle-insp__head`, `height: 48px`), which fits a 24 px line.
- Uncertainty: none.

## Design decision

The inspector's header names what is being edited, so it takes the DS **h2** text style (18/700/24). The panel then has three readable steps: 18 (what's selected) → 14 bold (its sections) → 12 (labels and hints), the same staircase the repo already prescribes and the one the previous editor had.

## Reuse

- `--sys-text-style-h2-size`, `--sys-text-style-h2-weight`, `--sys-text-style-h2-line-height` (DS text style tokens; no new value).
- Exemplar: the top bar's clip title, `h1.ap-h2.nle-title` in `paintTopbar()` (`src/screens/clips/editor.js`), already set in the h2 style.

## Changes

1. `styles/screens/clip-editor.css` — `.nle-insp__title`
   - Change: `font-size: var(--sys-text-style-h3-size);` → `var(--sys-text-style-h2-size)`; `font-weight: var(--sys-text-style-h3-weight);` → `var(--sys-text-style-h2-weight)`; `line-height: var(--sys-text-style-h3-line-height);` → `var(--sys-text-style-h2-line-height)`.
   - Preserve: `flex: 1`, `margin: 0`, the header's icon and close button, the 48 px header height.
   - Verify: « Clip » renders at 18 px / 700, visibly above « Range » (14 px / 700).

## Scope

- Inherit: every inspector state (nothing selected, a text, several texts « 3 texts », a framing part, subtitles, logo / intro / outro).
- Verify: a long title does not wrap (« 3 texts », « Subtitles », « Framing »); the header icon stays vertically centred next to the larger text.
- Exclude: the section titles (`.nle-sec__title`), the facts' values (`.nle-facts dd`), the library tabs — not part of this finding.

## Validation

- Product: open a clip in the editor; click a text layer, a framing part, the subtitles track name, the logo bar; Esc back to the clip. The header names each selection at 18 px.
- Interface: 1440×900 and 1920×1080; inspector widths 260 px (minimum) and 460 px (maximum, drag the right gutter).
- System: only DS text-style tokens; no new class, no `.ap-*` override.
- Repository: `npm run bump`, then `npm run check:ds` → « OK — every token, icon and .ap-\* class resolves against @latest. », `npm run check:versions` → OK.

## Stop conditions

- Stop if the header row clips the 24 px line height at 48 px, or if a current doc names the inspector title as h3 on purpose.

## Design documentation

- After acceptance and validation: in `docs/reference/FEATURES.md` §20 (the editor's inspector), record « the inspector's title is in h2 (18/700), a step above its sections (h4) — 2026-11-23 ».
