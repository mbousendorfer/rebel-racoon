# The dead-zone guide names the network the way the Effects tab does

Written against: 8802f0c09

## Evidence chain

- Surface: the subtitle stage of the clip editor (`/clips/:id/edit/:clipId`, `[data-ce-deadzones]` in `shellHTML()` of `src/screens/clips/editor.js`) and of the Video Clips modal (`src/components/video-clips-modal/editor-pane.js`). Both are painted by `renderDeadzones()` in `src/caption-editor.js`.
- Problem: the guide prints the raw id, "tiktok" (and "reels", "shorts"): `<span>${net}</span>`, where `net = state.deadZones`. The Effects tab of the same tool labels the same choice "TikTok" / "Reels" / "Shorts" (`renderEffectsTab()`, `segBtns("deadZones", …)`). The default caption state is `deadZones: "tiktok"` (`defaultCaptionState()` in `src/clip-captions.js`), so the lowercase id is on screen the first time any clip opens.
- Design evidence: a direct contradiction in user-facing content within the same task. The Effects tab and the guide name the same setting two ways.
- Owner: `src/caption-editor.js` `renderDeadzones()` and `renderEffectsTab()`.
- Scope and affected surfaces: the clip editor's output stage and the Video Clips modal's stage.
- Uncertainty: none.

## Design decision

One name per setting. The guide prints the label the Effects tab shows for the current value, read from a single list both functions use, so they can't drift apart again.

## Reuse

- The `{ v, label }` list already passed to `segBtns("deadZones", …)` in `renderEffectsTab()`

No new primitive.

## Changes

1. `src/caption-editor.js`
   - Change: lift the dead-zone options out of `renderEffectsTab()` into one module constant, `DEAD_ZONE_OPTIONS = [{ v: "none", label: "None" }, { v: "tiktok", label: "TikTok" }, { v: "reels", label: "Reels" }, { v: "shorts", label: "Shorts" }]`. Pass it to `segBtns("deadZones", s.deadZones, DEAD_ZONE_OPTIONS)`. In `renderDeadzones()`, print `DEAD_ZONE_OPTIONS.find((o) => o.v === net)?.label` (escaped) in both `<span>`s instead of `net`.
   - Preserve: the zone geometry (`DEAD_ZONES`), the `.cap-ed-dz*` styles, and the "None" behaviour (no guide).
   - Verify: the guide reads "TikTok" when TikTok is picked in Effects, then "Reels" and "Shorts".

## Scope

- Inherit: the clip editor and the Video Clips modal (shared renderer).
- Verify: the Effects tab still renders its four buttons with the same labels and selection.
- Exclude: `DEAD_ZONES` keys and every persisted `deadZones` value (ids stay lowercase in the data).

## Validation

- Product: open a clip, go to Subtitles › Effects and switch Dead zones through TikTok, Reels and Shorts. The guide on the video names each one as the button does.
- Interface: `#/clips/vid-journey-panel/edit/vid-journey-panel-c2` (Clips space, flag `clipsSpace`) and the Video Clips modal opened from a chat source with the flag OFF.
- System: one list feeds both the buttons and the guide.
- Repository: `npm run bump` → OK; `npm run check:versions` → OK; `npm run check:dead` → no new DEAD entry.

## Stop conditions

- Stop if the guide is meant to show something other than the network's name (for example the safe-area size). That would be a copy decision, not this fix.

## Design documentation

- None.
