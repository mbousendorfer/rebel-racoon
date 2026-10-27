# The voice proposal shows its rules the way the Voice profile shows them

Written against: eb99a87dd
Status: applied 2026-10-27.

## Evidence chain

- Surface: the voice proposal block — `learnedVoiceHtml(ctx, net, voice, { only, pending })` in `src/components/voice-intro-modal.js`. It renders in the chat (`voice-learned` turn, `src/screens/session/thread-render.js` `renderVoiceLearnedTurn`), in the proposal dialog (`src/components/voice-proposal-modal.js` `showProposal`), in a draft's feedback offer (`src/components/feedback-control.js` `offerVoiceUpdate` → the same dialog) and on the intro dialog's result stage (`voice-intro-modal.js` `showLearned`). Reproduce: flag `voicePerNetwork` ON, returning mode, a chat → `requireNetworkVoices(sessionId, ["tiktok"], …)` (`src/network-voice-flow.js`) → « Answer a few questions » → answer each.
- Problem: the proposal hand-builds its rules — `<li class="voice-edit__change">` with an olive `ap-icon-plus`, the rule as plain 14px text, its example as a `<q class="voice-edit__example">` — while the Voice profile tab shows the very same rules as grey-05 rule cards with a « For TikTok » tag and quoted examples. What is proposed doesn't look like what gets saved, and the block reads as bare text.
- Design evidence:
  - User directive in the conversation that commissioned this: « les questions et les sections de questions doivent être les mêmes que dans la Voice ».
  - `src/voice-parts.js` header + `voiceItemsHtml(items, { tag })`: « A part's items, read: the rule in ink, a case's kind of post above it in bold, the examples under it as quotes (playbook-v2.css .voice-rule). `tag`: trusted html shown on a rule the network made its own (`adapted`). »
  - The tab's use of it: `src/playbook-view.js` `pb2PartBody` (line 2466) → `voiceItemsHtml(value, { tag })`, `tag` = `voiceNetTag(net)` (line 2037): `<span class="ap-tag grey mini pb2-voice-tag"><i class="<network icon>"></i><span>For <Network></span></span>`.
- Owner: `src/components/voice-intro-modal.js` `learnedVoiceHtml` (the groups' markup, lines ~194–212); `styles/screens/modals.css` `.voice-edit__rules`, `.voice-edit__change`, `.voice-edit__plus`, `.voice-edit__rule`, `.voice-edit__example`.
- Scope and affected surfaces: every host of `learnedVoiceHtml` listed above.
- Uncertainty: `voiceNetTag` is private to `playbook-view.js`; it must become importable without a circular import (`playbook-view.js` already imports `voice-intro-modal.js`).

## Design decision

Render each section's rules with the Voice profile's own renderer, `voiceItemsHtml`, and the network's « For X » tag — so a proposed rule is the same object, in the same look, as the saved one. The « How the Brand sounds » section (a text part, not rules) shows the network's sentence as the tab does: a paragraph, with the same tag beside it.

## Reuse

- `voiceItemsHtml(items, { tag })` — `src/voice-parts.js`
- The « For X » tag markup — `voiceNetTag(net)`, `src/playbook-view.js:2037`
- `.voice-rules` / `.voice-rule*` / `.pb2-voice-tag` styles — `styles/screens/playbook-v2.css` (lines 303–360, 1041), loaded app-wide from `index.html`
- Exemplar: `src/playbook-view.js` `pb2PartBody` + `renderNetworkVoiceRead` (a network tab's rules)

No new primitive: the tag moves to the module that already owns rule rendering.

## Changes

1. `src/voice-parts.js`
   - Change: add `export function voiceNetTagHtml(net)` returning exactly today's `voiceNetTag` markup (it needs `networkIcon`, `networkLabel` from `social-profiles.js` and `escapeHtml` from `utils.js`, both already importable there).
   - Preserve: `voiceItemsHtml` unchanged.
   - Verify: the function returns the same string as `voiceNetTag` for `"linkedin"`.
2. `src/playbook-view.js`
   - Change: `voiceNetTag(net)` becomes a call to `voiceNetTagHtml(net)` (or its call sites use the import directly); delete the local markup.
   - Preserve: every « For LinkedIn » tag on the Playbook's network tabs, unchanged.
   - Verify: Playbook › Voice profile › LinkedIn still shows « For LinkedIn » on its own rules and beside the summary.
3. `src/components/voice-intro-modal.js` — `learnedVoiceHtml`
   - Change: inside each `.voice-edit__group`, replace the hand-built `<ul class="voice-edit__rules">…<li class="voice-edit__change">…</li></ul>` with `voiceItemsHtml(group.rules, { tag: voiceNetTagHtml(net) })` for list parts. For the text part (`voiceSummary`), render `<p class="voice-edit__lead">…sentence…</p>` followed by the tag. Every proposed rule already carries `adapted: true` (`learnNetworkVoice`, `interviewNetworkVoice`, `feedbackNetworkVoice` in `src/voice-parts.js`), so each one shows the tag.
   - Preserve: the butter head (network glyph, « For X », source, « Not saved yet »), « Goes into your Voice profile, X tab », the section grouping and order (`voiceParts()`), the closing note, the `only` filter for a draft's feedback.
   - Verify: a proposal from the 5-question interview shows 4 grey rule cards each tagged « For TikTok », and the summary sentence as a paragraph with the tag.
4. `styles/screens/modals.css`
   - Change: delete `.voice-edit__rules`, `.voice-edit__change`, `.voice-edit__plus`, `.voice-edit__rule`, `.voice-edit__example` (no consumer left); add `.voice-edit__lead` at body size, grey-100, `margin: 0`.
   - Preserve: `.voice-edit__group` bands and hairlines, `.voice-edit__part`, `.voice-edit__where`, `.voice-edit__rest`.
   - Verify: `npm run check:dead` lists none of the deleted classes as still referenced; the rule cards render with their playbook-v2 look inside the white card.

## Scope

- Inherit: chat proposal turn, proposal dialog (Playbook « Learn from… » and the Clips Voice step), feedback offer, intro result stage.
- Verify: the intro result stage (white card on the pixel field) — grey-05 rule cards stay visible on white; the feedback offer (`only`: one rule).
- Exclude: the Voice step block (`voiceAskHtml`) — it shows examples, not rules; the Playbook editor.

## Validation

- Product: a user reads the proposal and recognises, rule for rule, what will appear in the TikTok tab after « Add to Voice profile ».
- Interface: chat (interview, posts, document), proposal dialog, feedback offer, intro result; a rule with an example (posts-learned LinkedIn voice) shows the quote row.
- System: rules rendered only by `voiceItemsHtml`; the tag only by `voiceNetTagHtml`; no parallel rule markup left.
- Repository: `npm run bump && npm run check:ds && npm run check:dead && npm run check:versions` → OK, no new dead export.

## Stop conditions

- Stop if moving the tag creates an import cycle that breaks module evaluation (blank screen / console error) — report the cycle instead of duplicating the markup.
- Stop if `.voice-rule` styles are scoped to `.pb2-*` ancestors and don't apply in the chat — report the selectors rather than copying them.

## Design documentation

- After acceptance and validation: in `docs/reference/FEATURES.md` §9, the proposal's description becomes « les règles de chaque section dans le rendu du Voice profile (`voiceItemsHtml`, cartes grises, tag « For X ») » in place of « le + dans la colonne du glyphe ».
