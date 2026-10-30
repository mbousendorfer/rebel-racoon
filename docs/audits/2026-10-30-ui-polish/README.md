# UI polish, 2026-10-29 → 30

A snapshot, dated like every file in `audits/`. Read the date before you trust a detail.

Over three iterations we audited 13 surfaces of the prototype on 78 reproducible captures, shipped 61 fix batches to `main`, and re-audited after each iteration with reviewers who had not written the fixes. The global score (the mean of the 13 surface scores, /10) went from **7.08 to 8.37**. The loop stopped on the mission's third rule: two iterations in a row gained less than 0.3 (+0.24, then +0.02). The issues still open at severity 3 all need a product decision, listed in [To decide](#to-decide).

Open [`compare.html`](compare.html) for a slider on each changed screen, with a filter per surface.

## Scores

| Surface                      | Before   | After    |
| ---------------------------- | -------- | -------- |
| Chat                         | 7.0      | 7.9      |
| New chat                     | 7.5      | 7.5      |
| App shell (sidebar + topbar) | 6.0      | 8.0      |
| Side panel                   | 7.0      | 8.5      |
| Draft card                   | 7.0      | 8.0      |
| Schedule modal               | 8.0      | 8.6      |
| Playbooks catalogue          | 7.0      | 8.3      |
| Playbook page                | 7.5      | 8.7      |
| Image Studio (style creator) | 8.0      | 8.5      |
| Topic Feed                   | 7.0      | 8.8      |
| Topic Feed settings          | 7.0      | 8.2      |
| First-time onboarding        | 6.5      | 8.6      |
| Dialogs (10 overlays)        | 6.5      | 9.2      |
| **Global**                   | **7.08** | **8.37** |

Accessibility (pass H) pulled the score down on 9 of the 13 surfaces at the start, and it moved the most: focus now survives every repaint we found (Topic Feed, onboarding reviews, schedule modal), the ten dialogs take focus, contain Tab and close on Esc and on a click outside, every DS select and every tab strip works from the keyboard, and the sidebar shows a 2px focus ring. Hierarchy (pass B) and DS conformance (pass E) come second: one tab head across the Playbook page, empty states with a bare icon and one call to action, dialog headers on `.ap-dialog-subtitle`, about 110 lines of hand-made form CSS replaced by DS fields.

New chat stayed at 7.5: its two open issues (the width of the Topics row, the admin link under the composer) are product calls.

## What went wrong

The independent re-audits caught five regressions in our own fixes. We fixed all five in the next iteration.

| Introduced by                         | Regression                                                                                                                                                        | Fixed by         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| b-01, `inert` around open dialogs     | A click outside no longer closed shortcuts, feedback, bug, chat picker, add source, schedule and four more: their backdrop went inert with the page (severity 3). | c-01 `7933cfbc6` |
| b-16, white feedback card             | On a clip card the « What was off? » panel became a card inside a card.                                                                                           | c-02 `6438cd320` |
| b-04, focus restore in the Topic Feed | Ticking a filter checkbox sent focus to the first box of its group.                                                                                               | c-03 `c8299450a` |
| b-21, website error line              | Screen readers read « Add your website… » before any error.                                                                                                       | c-04 `caa316ea1` |
| c-15, one tab head in edit mode       | A 12px white strip above the Competitors banner in edit.                                                                                                          | d-01 `0cc0841ce` |

Our own score estimates ran high: we put iteration 1 at 8.31 and the re-auditors at 8.11, so every score in this report is the re-auditors' number.

Two first-audit fixes did not ship as proposed. Turning « Draft post » orange (PN-12) contradicts FEATURES §17, and a confirm before deleting a reference image (PB-16) adds a step; both went to [To decide](#to-decide). The catalogue tile keeps 28px icon buttons (PB-03): at the DS 36px, most Playbook names wrapped onto two lines.

## Method

- **Capture.** `scripts/ui-capture.mjs` (Playwright) takes 78 shots listed in `scripts/ui-capture.config.json`: 1440 and 1280 everywhere, 1024 for the chat and the panel. Each shot starts from cleared storage, a frozen clock, a seeded `Math.random`, animations off and `prefers-reduced-motion` on. Two runs in a row came out pixel-identical. `scripts/ui-diff.mjs` (pixelmatch) compares two capture folders.
- **Audit.** Eight passes per surface: UX and flows, hierarchy, typography, colour, DS conformance, states, copy, accessibility. Every finding cites a shot, a `file:line` and a rule. The first audit ran from zero: it did not read `2026-10-28-ux-review.md`.
- **Fixes.** One batch per commit on `main`, each with `npm run bump`, `check:ds`, `check:versions` and `check:templates`, a recapture and a pixel diff against `before/`. Behaviour changes were checked in a real browser.
- **This folder.** `before/` and `after/` hold the 38 changed shots at 1440 (and 1024 for the shell), as JPEG at 1280px wide, to keep the repo light. The full PNG set at every width lives in `.ui-review/` on the machine that ran the loop.

## By surface

Each section gives the surface's score, its changed screens (before | after) and the batches that changed it, with the problem the first audit or a re-audit found, the pass that found it (A UX and flows · B hierarchy · C type · D colour · E DS conformance · F states · G copy · H accessibility), the files and the commit.

## Chat

**7.0 → 7.9**

| Before                                    | After                                   |
| ----------------------------------------- | --------------------------------------- |
| ![chat@1024 before](before/chat@1024.jpg) | ![chat@1024 after](after/chat@1024.jpg) |
| ![chat@1440 before](before/chat@1440.jpg) | ![chat@1440 after](after/chat@1440.jpg) |

| Change                                                                      | Problem                                                                                                                                                                                         | Rule          | Files                                                                                     | Commit      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- | ----------- |
| **Composer: Playbook as text, Send radius and state** (CH-08, CH-11, CH-12) | On a started chat, the Playbook indicator is the DS **disabled** select: grey-20 fill, value in grey-60 (2.32:1), label grey-80 on grey-20 (3.89:1).                                            | D/H/E, E, E/H | `src/screens/session.js`, `src/screens/session/composer.js`, `styles/screens/session.css` | `346efe2de` |
| **Composer shares the thread edges; card focus** (CH-10, CH-13)             | The thread gets `padding-inline: 68px` (time gutter) but the composer doesn't.                                                                                                                  | B, H          | `styles/chat.css`                                                                         | `a026740da` |
| **Playbook label keeps its size** (CH2-02)                                  | The same label is 14px in the new-chat select (« Playbook \ / Acme… ») and drops to 12px caption once the chat starts, so it changes size at the exact moment the user sends the first message. | C             | `styles/screens/session.css`                                                              | `c33135f1b` |

## New chat

**7.5 → 7.5**

| Before                                            | After                                           |
| ------------------------------------------------- | ----------------------------------------------- |
| ![new-chat@1440 before](before/new-chat@1440.jpg) | ![new-chat@1440 after](after/new-chat@1440.jpg) |

## App shell (sidebar + topbar)

**6.0 → 8.0**

| Before                                    | After                                   |
| ----------------------------------------- | --------------------------------------- |
| ![chat@1024 before](before/chat@1024.jpg) | ![chat@1024 after](after/chat@1024.jpg) |

| Change                                                                  | Problem                                                                                                                                        | Rule      | Files                                                                                                                              | Commit      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Rail: visible focus ring, readable active chat** (CH-01, CH-02)       | `:focus-visible` sets `outline: none` and only a `grey-10` fill on the white rail: 1.18:1 against white, effectively invisible (WCAG 2.4.7).   | D/H, H    | `styles/components/sidebar.css`                                                                                                    | `831981358` |
| **Chat rows: real buttons, current chat, labels** (CH-03, CH-04, CH-07) | (a) The row is `div role=button` with a `<details><summary>` "Chat actions" inside.                                                            | H, H/D    | `src/components/sidebar.js`, `src/components/sidebar/recent-chats.js`, `src/components/topbar.js`, `styles/components/sidebar.css` | `5b684e70c` |
| **Sidebar edges, header tier, footer name** (CH-05, CH-06, CH-14)       | « Chats » starts at x=12 while « Pinned »/« Recent » start at x=20 and the nav icons and row dots at x=24, so the column has three left edges. | B/C, C, G | `src/components/sidebar.js`, `styles/components/sidebar.css`                                                                       | `61c7ef6ec` |
| **Sidebar keycaps join the shared rule** (CH2-01)                       | b-43 unified « every `<kbd>` the app draws » into one ds-patches rule, but two keycaps were left out.                                          | E         | `styles/components/sidebar.css`, `styles/ds-patches.css`                                                                           | `9b8af6616` |

## Side panel

**7.0 → 8.5**

| Before                                                        | After                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| ![panel-clips@1440 before](before/panel-clips@1440.jpg)       | ![panel-clips@1440 after](after/panel-clips@1440.jpg)       |
| ![panel-drafts@1440 before](before/panel-drafts@1440.jpg)     | ![panel-drafts@1440 after](after/panel-drafts@1440.jpg)     |
| ![panel-ideas@1440 before](before/panel-ideas@1440.jpg)       | ![panel-ideas@1440 after](after/panel-ideas@1440.jpg)       |
| ![panel-overview@1440 before](before/panel-overview@1440.jpg) | ![panel-overview@1440 after](after/panel-overview@1440.jpg) |
| ![panel-sources@1024 before](before/panel-sources@1024.jpg)   | ![panel-sources@1024 after](after/panel-sources@1024.jpg)   |
| ![panel-sources@1440 before](before/panel-sources@1440.jpg)   | ![panel-sources@1440 after](after/panel-sources@1440.jpg)   |

| Change                                                                                      | Problem                                                                                                                                                                          | Rule         | Files                                                                                                                      | Commit      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Panel menus reachable by keyboard** (PN-01, PN-02)                                        | The menu items are `<div role="menuitem">` with no tabindex and no key handler.                                                                                                  | H            | `src/components/right-panel.js`, `src/components/right-panel/drafts-view.js`, `src/components/right-panel/sources-view.js` | `0327bc5ff` |
| **No blue hover background in the panel** (PN-03, PN-04)                                    | On hover the row fills with `electric-blue-05` and turns blue.                                                                                                                   | E/D          | `styles/components/right-panel.css`                                                                                        | `979a9a9ba` |
| **Overview: one verb, right filter, quiet live region** (PN-06, PN-07, PN-08, PN-09, PN-10) | « 2 drafts need a fix » leads to **All drafts**, where the first draft shown is the valid LinkedIn one.                                                                          | A, G, G/A, H | `src/components/right-panel.js`, `src/components/right-panel/overview-view.js`                                             | `92d3a6d25` |
| **One look for Draft post** (PN-12)                                                         | It's an AI action (sparkle), but styled `secondary blue`.                                                                                                                        | D/E          | `src/components/clip-card.js`, `src/components/right-panel/ideas-view.js`                                                  | `e8d35ebe0` |
| **Overview on DS text styles** (PN-22)                                                      | The draft excerpts are 13px and the clip duration 11px, sizes outside the DS text styles (caption 12, body 14).                                                                  | E/C          | `styles/chat.css`, `styles/components/right-panel.css`                                                                     | `49c5af2d3` |
| **Panel tabs behave as tabs** (PN-05)                                                       | They are `role="tab"` without `aria-controls`, without a `tabpanel`, and without roving tabindex or arrow keys.                                                                  | H            | `src/components/right-panel.js`                                                                                            | `1fbe65030` |
| **Ideas card shows Drafted** (PN2-01)                                                       | The Overview marks « The three constraints… » **Drafted**.                                                                                                                       | A            | `src/components/idea-card-compact.js`                                                                                      | `e34b0fe12` |
| **Clip source chip; aria-controls when open** (PN2-06, PN2-03)                              | Every tab carries `aria-controls="rpanelBody"`, but when the panel is closed `renderPanel()` empties it, so that id doesn't exist and the reference dangles (WCAG 4.1.2, minor). | E/C, H       | `src/components/clip-card.js`, `src/components/right-panel.js`, `styles/components/clip-card.css`                          | `da21dcefc` |

## Draft card

**7.0 → 8.0**

| Before                                                        | After                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| ![draft-edit@1440 before](before/draft-edit@1440.jpg)         | ![draft-edit@1440 after](after/draft-edit@1440.jpg)         |
| ![draft-feedback@1440 before](before/draft-feedback@1440.jpg) | ![draft-feedback@1440 after](after/draft-feedback@1440.jpg) |

| Change                                                                          | Problem                                                                                          | Rule        | Files                                                                          | Commit      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------ | ----------- |
| **Draft rail: one colour, labelled group and checkboxes** (PN-13, PN-14, PN-24) | In a rail of six identical icon buttons, the only coloured one is Reference, a secondary action. | B/D, C/E, H | `src/components/post-card.js`, `src/components/right-panel/drafts-view.js`     | `92824a71b` |
| **Feedback form visible and labelled** (PN-15, PN-16)                           | The panel is a grey-05 box with 8px padding.                                                     | B/E, H/E    | `src/components/feedback-control.js`, `styles/components/feedback-control.css` | `3e986a9df` |
| **Feedback panel matches its host (regression b-16)** (PN2-02)                  | The `aria-label` is hardcoded to « Anything else about this draft?                               | H/G         | `src/components/feedback-control.js`, `styles/components/feedback-control.css` | `6438cd320` |

## Schedule modal

**8.0 → 8.6**

| Before                                                        | After                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| ![schedule-modal@1440 before](before/schedule-modal@1440.jpg) | ![schedule-modal@1440 after](after/schedule-modal@1440.jpg) |

| Change                                              | Problem                                                                                                                                                                             | Rule | Files                                                            | Commit      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- | ----------- |
| **One name for the object: draft** (PN-18)          | The title and button say « Schedule 1 draft », the footer says « 4 posts over 8 days » and « Posts will publish… ».                                                                 | G    | `docs/reference/FEATURES.md`, `src/components/schedule-modal.js` | `856246104` |
| **Docs synced, last post wording** (PN2-04, PN2-05) | FEATURES still quotes « 2 drafts need a fix before they can go out » → Review drafts, the status « Ready / Needs a fix », and Sources / Clips sections that « nomme ses chiffres ». | G    | `docs/reference/FEATURES.md`, `src/components/schedule-modal.js` | `63448d2cd` |
| **Schedule modal holds keyboard focus** ()          |                                                                                                                                                                                     |      | `src/components/schedule-modal.js`, `src/modal-coordinator.js`   | `dfb78975f` |

## Playbooks catalogue

**7.0 → 8.3**

| Before                                                          | After                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| ![empty-playbooks@1440 before](before/empty-playbooks@1440.jpg) | ![empty-playbooks@1440 after](after/empty-playbooks@1440.jpg) |
| ![playbooks@1440 before](before/playbooks@1440.jpg)             | ![playbooks@1440 after](after/playbooks@1440.jpg)             |

| Change                                                                         | Problem                                                                                                                                                                                               | Rule           | Files                                                                                                                | Commit      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Catalogue tile back on the house rules** (PB-02, PB-03, PB-04, PB-05, PB-09) | A hand-built pill (radius 999, grey-05) instead of the DS tag, and its Archie glyph is painted `electric-blue-100` on static data: blue = interactive, so this is a false affordance (house rule §2). | B, D/E, D/H, E | `src/screens/home/lists.js`, `styles/screens/contexts.css`                                                           | `9236b57ba` |
| **Empty states: one next step, bare icon** (PB-06, PB-07, PB-08, TP-07)        | The icon sits on a 64px grey-10 tile in grey-60 ink.                                                                                                                                                  | A/B, C/E, E, G | `src/components/empty-state.js`, `src/screens/home.js`, `src/screens/home/lists.js`, `styles/components/sidebar.css` | `68d59da69` |
| **Search label, tile button, Playbook tabs** (PB-10, PB-11, PB-19)             | `<input type="search">` with a placeholder only: no `<label>` and no `aria-label` (WCAG 1.3.1 / 4.1.2 / 3.3.2).                                                                                       | H              | `src/playbook-view.js`, `src/screens/home.js`, `src/screens/home/lists.js`, `styles/screens/contexts.css`            | `1f5ce14ff` |
| **Visible tile focus and disabled reason** (PB2-01, PB2-02)                    | The name button drops its outline, and the only focus cue left is the tile's 1px border going grey-20 → blue.                                                                                         | H, H/A         | `src/modules/image-studio/views/style-creator.js`, `styles/screens/contexts.css`                                     | `d18b81307` |

## Playbook page

**7.5 → 8.7**

| Before                                                                    | After                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![playbook-brand@1440 before](before/playbook-brand@1440.jpg)             | ![playbook-brand@1440 after](after/playbook-brand@1440.jpg)             |
| ![playbook-competitors@1440 before](before/playbook-competitors@1440.jpg) | ![playbook-competitors@1440 after](after/playbook-competitors@1440.jpg) |
| ![playbook-goals@1440 before](before/playbook-goals@1440.jpg)             | ![playbook-goals@1440 after](after/playbook-goals@1440.jpg)             |
| ![playbook-images@1440 before](before/playbook-images@1440.jpg)           | ![playbook-images@1440 after](after/playbook-images@1440.jpg)           |
| ![playbook-influencers@1440 before](before/playbook-influencers@1440.jpg) | ![playbook-influencers@1440 after](after/playbook-influencers@1440.jpg) |
| ![playbook-voice@1440 before](before/playbook-voice@1440.jpg)             | ![playbook-voice@1440 after](after/playbook-voice@1440.jpg)             |

| Change                                                      | Problem                                                                                                                         | Rule             | Files                                                                                               | Commit      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| **One tab head for all six tabs** (PB-12, PB-13, PB-18)     | The only tab still on the old recap panel.                                                                                      | A/B, B, G        | `src/playbook-view.js`, `styles/screens/playbook-v2.css`                                            | `5f61ba52e` |
| **Roster cards: DS buttons, one frame less** (PB-14, PB-15) | `.ap-button` height forced to 28px with a caption-size font, against house rule §6 (36px pinned, no size modifier).             | B, E             | `styles/screens/welcome.css`                                                                        | `2d3c260ca` |
| **Colour caption dedupe** (PB-17)                           | When two names share a hex they merge (« Primary · Text »), and `colorRoleCaption` compares the role against the merged string. | G                | `src/playbook-brand-kit.js`                                                                         | `15a055ee1` |
| **Tab head kept in edit mode** (PB2-03)                     | In read mode, the lead sits bare above the block.                                                                               | A/B              | `src/playbook-view.js`                                                                              | `e1f55c37b` |
| **Roster edit finished (regression c-15)** (PB3-01, PB3-02) | A 12px white strip sits between the card's top border and a full-bleed butter band.                                             | B/E, E (hygiene) | `src/screens/welcome-alt-review.js`, `styles/screens/playbook-v2.css`, `styles/screens/welcome.css` | `0cc0841ce` |

## Image Studio (style creator)

**8.0 → 8.5**

| Before                                                    | After                                                   |
| --------------------------------------------------------- | ------------------------------------------------------- |
| ![image-studio@1440 before](before/image-studio@1440.jpg) | ![image-studio@1440 after](after/image-studio@1440.jpg) |

| Change                                                 | Problem                                                                           | Rule     | Files                                             | Commit      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------- | ------------------------------------------------- | ----------- |
| **Style creator asks for images first** (PB-20, PB-21) | The page asks for a name before the user has given the images that are the style. | A/B, C/H | `src/modules/image-studio/views/style-creator.js` | `49decf80c` |

## Topic Feed

**7.0 → 8.8**

| Before                                                    | After                                                   |
| --------------------------------------------------------- | ------------------------------------------------------- |
| ![empty-topics@1440 before](before/empty-topics@1440.jpg) | ![empty-topics@1440 after](after/empty-topics@1440.jpg) |
| ![topics@1440 before](before/topics@1440.jpg)             | ![topics@1440 after](after/topics@1440.jpg)             |

| Change                                                           | Problem                                                                                                                                                 | Rule    | Files                                                                           | Commit      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- | ----------- |
| **Topic Feed: focus survives the repaint** (TP-01, TP-03, TP-05) | `paint()` rebuilds the whole screen with `target.innerHTML` and never restores focus.                                                                   | H       | `src/screens/topics.js`, `styles/screens/topics.css`                            | `d80261e14` |
| **DS Select options operable by keyboard** (TP-02)               | The options are `<div role="option">` with no `tabindex` and no key handler.                                                                            | H       | `src/screens/topics-settings.js`, `src/screens/topics.js`                       | `6b779fee3` |
| **Source posts scroll into view** (TP-04)                        | The bar is `position: sticky; bottom: 0`, and the tray unfolds _after_ the end of the article.                                                          | A       | `src/screens/topics.js`                                                         | `59b4a4679` |
| **Empty and no-Playbook feed** (TP-06, TP-08)                    | With zero Playbooks, the toolbar still renders "Playbook │ Choose a Playbook" over an empty listbox, plus a live Filters button over nothing to filter. | F, G    | `src/screens/topics.js`                                                         | `1cc0ff3d1` |
| **Topic copy and labels** (TP-12, TP-13, TP-14, TP-15)           | "or leave it here, my next scan may add more." is an em dash in an Archie line (brief: no em dash in UI copy).                                          | D, G, H | `src/components/topic-card.js`, `src/topic-article.js`, `src/topics-catalog.js` | `7961dbf0d` |
| **Filter checkboxes keep focus (regression b-04)** (TP2-01)      | The refocus matches only the first `data-*` attribute and its value.                                                                                    | H       | `src/screens/topics.js`                                                         | `c8299450a` |

## Topic Feed settings

**7.0 → 8.2**

| Before                                                          | After                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| ![topics-settings@1440 before](before/topics-settings@1440.jpg) | ![topics-settings@1440 after](after/topics-settings@1440.jpg) |

| Change                                                     | Problem                                                                                                                             | Rule     | Files                                                                                           | Commit      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ----------- |
| **Unavailable sources readable and honest** (TP-09, TP-10) | `.is-off` text is `--ref-color-grey-60` (#858FA1) on the transparent card, so on `--sys-settings-content-background-color` #F9F9FA. | A / D, D | `src/screens/topics-settings.js`, `styles/screens/topics-settings.css`                          | `9102ced4b` |
| **Same empty state on feed and settings** (TP2-02, TP2-03) | The feed's no-Playbook state now leads with the benefit ("Get Topics from your competitors and influencers", antenna).              | C, G     | `src/components/empty-state.js`, `src/screens/topics-settings.js`, `styles/screens/session.css` | `9ef60ba3d` |

## First-time onboarding

**6.5 → 8.6**

| Before                                                      | After                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| ![welcome-intro@1440 before](before/welcome-intro@1440.jpg) | ![welcome-intro@1440 after](after/welcome-intro@1440.jpg) |
| ![welcome-ready@1440 before](before/welcome-ready@1440.jpg) | ![welcome-ready@1440 after](after/welcome-ready@1440.jpg) |
| ![welcome-recap@1440 before](before/welcome-recap@1440.jpg) | ![welcome-recap@1440 after](after/welcome-recap@1440.jpg) |
| ![welcome-voice@1440 before](before/welcome-voice@1440.jpg) | ![welcome-voice@1440 after](after/welcome-voice@1440.jpg) |

| Change                                                             | Problem                                                                                                                              | Rule         | Files                                                                                                                                    | Commit      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Review screens: focus survives repaints** (OB-02, OB-19)         | `applyColumn()` rebuilds the nav, the confirm bar and the whole left column on every move, scroll index change or confirm.           | H            | `src/screens/welcome-alt-review.js`                                                                                                      | `3a4661b18` |
| **Weak read: honest copy over empty fields** (OB-01)               | On a weak read (GENERIC, FEATURES §10 « La lecture faible »), the summary is left empty on purpose.                                  | F/G          | `src/playbook-view.js`, `src/screens/welcome-alt-ready.js`                                                                               | `00ca4b93b` |
| **Reveal and progress for screen readers** (OB-03, OB-04)          | The whole stage is `aria-hidden` on every step except the reviews, and that includes the card.                                       | H            | `src/screens/welcome-alt-ready.js`, `src/screens/welcome-alt-shell.js`                                                                   | `75e490edc` |
| **Website field shows its error** (OB-05)                          | If the field is cleared and submitted, the only response is `aria-invalid="true"`.                                                   | F/H          | `src/screens/welcome-alt-steps.js`, `styles/screens/welcome.css`                                                                         | `887ff1b51` |
| **Voice review copy with one voice** (OB-06, OB-07, OB-12)         | "Give a network its own voice when it needs one" promises something this screen can't do.                                            | B, G         | `src/screens/welcome-alt-intro.js`, `src/screens/welcome-alt-recap.js`, `src/screens/welcome-alt-review.js`                              | `7b7d667c1` |
| **Card and stage consistency** (OB-10, OB-11, OB-13, OB-14, OB-15) | The card's chips mix casing ("Professional", "clear", "helpful").                                                                    | A, B, C/G, E | `src/screens/welcome-alt-intro.js`, `src/screens/welcome-alt-ready.js`, `src/screens/welcome-alt-shell.js`, `styles/screens/welcome.css` | `18441b8d7` |
| **Voice mode switch as DS tabs** (OB-09)                           | This one-of-N mode switch is built from filter-chip pills.                                                                           | E            | `src/playbook-view.js`, `styles/screens/welcome.css`                                                                                     | `cee453266` |
| **Error described only when shown (regression b-21)** (OB2-01)     | The input always points `aria-describedby` at `#brandUrlError`.                                                                      | H            | `src/screens/welcome-alt-steps.js`                                                                                                       | `caa316ea1` |
| **Voice tabs: one Tab stop, arrows** (OB2-02)                      | `role="tab"` without the rest of the pattern: no roving `tabindex` (both tabs are Tab stops), no ←/→.                                | H            | `src/playbook-view.js`                                                                                                                   | `0fd57f493` |
| **How you sound, everywhere** (OB2-04)                             | With `voicePerNetwork` OFF, the review now says "How you sound everywhere." and "Every draft I write starts from this voice" (b-38). | G            | `src/screens/welcome-alt-ready.js`, `src/screens/welcome-alt-shell.js`                                                                   | `5296205d5` |
| **Voice lead punctuation** (OB3-01)                                | The two screens use the same sentence with different punctuation.                                                                    | G            | `src/screens/welcome-alt-recap.js`                                                                                                       | `402775674` |

## Dialogs (10 overlays)

**6.5 → 9.2**

| Before                                                                        | After                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ![modal-add-source@1440 before](before/modal-add-source@1440.jpg)             | ![modal-add-source@1440 after](after/modal-add-source@1440.jpg)             |
| ![modal-analyze-profiles@1440 before](before/modal-analyze-profiles@1440.jpg) | ![modal-analyze-profiles@1440 after](after/modal-analyze-profiles@1440.jpg) |
| ![modal-bug@1440 before](before/modal-bug@1440.jpg)                           | ![modal-bug@1440 after](after/modal-bug@1440.jpg)                           |
| ![modal-chat-picker@1440 before](before/modal-chat-picker@1440.jpg)           | ![modal-chat-picker@1440 after](after/modal-chat-picker@1440.jpg)           |
| ![modal-connect-account@1440 before](before/modal-connect-account@1440.jpg)   | ![modal-connect-account@1440 after](after/modal-connect-account@1440.jpg)   |
| ![modal-feedback@1440 before](before/modal-feedback@1440.jpg)                 | ![modal-feedback@1440 after](after/modal-feedback@1440.jpg)                 |
| ![modal-fill-document@1440 before](before/modal-fill-document@1440.jpg)       | ![modal-fill-document@1440 after](after/modal-fill-document@1440.jpg)       |
| ![modal-save-folder@1440 before](before/modal-save-folder@1440.jpg)           | ![modal-save-folder@1440 after](after/modal-save-folder@1440.jpg)           |
| ![modal-search@1440 before](before/modal-search@1440.jpg)                     | ![modal-search@1440 after](after/modal-search@1440.jpg)                     |
| ![modal-shortcuts@1440 before](before/modal-shortcuts@1440.jpg)               | ![modal-shortcuts@1440 after](after/modal-shortcuts@1440.jpg)               |

| Change                                                                            | Problem                                                                                                                                                                                                | Rule               | Files                                                                                                                                                                 | Commit      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Dialogs own the keyboard** (OV-02, OV-03, OV-12)                                | These five `aria-modal` dialogs leave focus on the trigger behind the scrim.                                                                                                                           | H, H/A             | `src/components/analyze-profiles-modal.js`, `src/components/connect-account-modal.js`, `src/components/search-modal.js`, `src/modal-coordinator.js`                   | `1d7107f50` |
| **Shortcut legend repaired** (OV-01, OV-16)                                       | The close X sits below the title on the left.                                                                                                                                                          | E/H, G/A           | `src/components/shortcut-legend.js`                                                                                                                                   | `1839a59fd` |
| **One colour role per dialog button** (OV-04, OV-05, OV-06)                       | "Send feedback" and "Submit bug report" are `.primary.orange`.                                                                                                                                         | D, D/A, E/B        | `src/components/add-source-modal.js`, `src/components/bug-report-modal.js`, `src/components/feedback-modal.js`, `src/components/fill-document-modal.js`               | `83646d260` |
| **Bug and feedback forms on DS fields** (OV-09, OV-10, OV-18, OV-19)              | Hand-rolled `.bug-input`, `.bug-textarea` and `.feedback-modal__textarea` duplicate the DS `.ap-input-group` and `.ap-textarea-field`.                                                                 | D/E, E/C/D, F/E, G | `src/archie-loader.js`, `src/components/bug-report-modal.js`, `src/components/feedback-modal.js`, `styles/components/archie-loader.css`                               | `38807a1dd` |
| **Dialog headers and widths** (OV-07, OV-08)                                      | There are two header grammars.                                                                                                                                                                         | B, B/C             | `docs/reference/UI-PATTERNS.md`, `src/components/analyze-profiles-modal.js`, `src/components/connect-account-modal.js`, `src/components/feedback-modal.js`            | `2ee9206a5` |
| **Dialog copy and empty states** (OV-13, OV-14, OV-15, OV-17)                     | copy-principles §323/§441 allow no em dash in product UI.                                                                                                                                              | F, G, G/B          | `src/components/analyze-profiles-modal.js`, `src/components/chat-picker-modal.js`, `src/components/connect-account-modal.js`, `src/components/fill-document-modal.js` | `67999f226` |
| **Search highlight and dropzone focus contrast** (OV-11, OV-21)                   | The highlighted row renders electric-blue-100 text on electric-blue-05 at 3.15:1, below the AA 4.5:1 minimum for 14px (SC 1.4.3).                                                                      | D, D/H             | `styles/ds-patches.css`, `styles/screens/modals.css`                                                                                                                  | `3868d303f` |
| **One keycap style** (OV-20)                                                      | Four keycap styles live side by side: grey-05 fill, white fill, white with a 2px bottom border, and the picker's numbered boxes.                                                                       | E                  | `styles/ds-patches.css`, `styles/screens/modals.css`, `styles/screens/session.css`                                                                                    | `2efd8ac6c` |
| **Click outside closes dialogs again (regression b-01)** (OV2-01, OV2-02, OV2-05) | See Regressions.                                                                                                                                                                                       | A/H, E, H          | `src/components/fill-document-modal.js`, `src/components/search-modal.js`, `src/modal-coordinator.js`                                                                 | `7933cfbc6` |
| **Connect empty state, parallel save copy** (OV2-03, OV2-04)                      | When nothing can be connected, the header still explains how connecting shapes drafts ("I write each draft for the network it publishes on…"), and the actual message is a smaller body line under it. | G, G/B             | `src/components/connect-account-modal.js`, `src/components/save-folder-modal.js`                                                                                      | `06a9944df` |

## Copy changes

| Before                                                                                            | After                                                                                       | Why                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| I wrote this from what I read about your business. Fix anything that's off. (over an empty field) | I couldn't tell from what I read. Say it in a few sentences, and every post starts from it. | The weak read leaves the summary empty; the hint claimed a text that wasn't there. |
| No Playbooks yet                                                                                  | Teach me your Brand once                                                                    | An empty-state title says the benefit.                                             |
| No Playbook to listen for                                                                         | Get Topics from your competitors and influencers                                            | Same rule; the old body also left influencers out.                                 |
| Review drafts, Manage, See all 5, Open                                                            | Open, or See all N                                                                          | One verb for « go to this tab ».                                                   |
| 2 drafts need a fix · Needs a fix · 2 to fix                                                      | 2 drafts need fixes · Needs fixes · 2 need fixes                                            | One wording, the tab's.                                                            |
| 4 posts over 8 days · Posts will publish to your connected accounts.                              | 4 drafts over 8 days · This draft publishes to your connected account.                      | A scheduled item is still a draft (GLOSSARY), and one draft is singular.           |
| +1 post that day                                                                                  | +1 scheduled that day                                                                       | The modal says « draft » everywhere else.                                          |
| Empty chat — start fresh                                                                          | Starts empty                                                                                | No em dash; the old caption repeated its title.                                    |
| Pick the accounts to learn from — I read their recent posts…                                      | Pick the accounts to learn from. I read their recent posts…                                 | No em dash in UI copy.                                                             |
| Drop a Brand doc or paste a link — I'll read it…                                                  | Drop a brand doc or paste a link. I'll read it…                                             | Same, and no capital mid-sentence.                                                 |
| Save as separate drafts (for one draft)                                                           | Save as a draft                                                                             | « Separate » means nothing for one item.                                           |
| Ignore Topic                                                                                      | Ignore                                                                                      | The card already said « Ignore » for the same verb.                                |
| Toggle the sidebar (collapse to icon rail or expand)                                              | Collapse or expand the sidebar                                                              | One line in the shortcut legend.                                                   |
| e.g. The calendar didn't open, the button did nothing, or the state reset unexpectedly…           | e.g. The button did nothing                                                                 | Placeholders stay short.                                                           |
| How you sound, on every network. (one voice)                                                      | How you sound, everywhere.                                                                  | With `voicePerNetwork` OFF there is one voice.                                     |
| Every draft I write starts from this voice. I save as you type.                                   | (replaces « Give a network its own voice when it needs one »)                               | The screen offered no way to do that.                                              |

## To decide

Each item needs a product call, contradicts a doc in `docs/reference/`, or adds a step to a flow. We coded none of them.

### Chat and shell

- **Admin link in the new-chat hero (CH-17).** A prototype control sits in the hero's prime spot. Recommendation: move it into the sidebar cog's Admin popover, which already holds the prototype controls.
- **Topics row width in the hero (CH-16).** The composer and starters use a 740px column, the Topics row 1016px; `session.css:806` keeps the wider row on purpose. Recommendation: constrain Topics to the 740px column.
- **Source pills in the thread (CH-09).** White on electric-blue-100 is 3.35:1. Options: an electric-blue-150 fill (passes AA, off-DS) or wait for the DS. Recommendation: blue-150 until the DS fixes its primary.
- **Electric blue in the Playbook palette (CH-04).** A Playbook's colour is data, and blue is the interactive colour. Recommendation: remove blue from the palette at the source.
- **Mock copy (CH-15).** One Archie line in `src/mocks/threads.js:121` quotes a Playbook name with straight quotes; the mission forbids editing mocks. Recommendation: allow copy-only edits to mock Archie lines.

### Side panel, drafts, schedule

- **Which account a draft preview shows (PN-17, severity 3).** The card shows the post's author (Maya Chen), the schedule modal the connected page (Northwind Studio Co.). Recommendation: the preview takes the connected profile, the one that publishes.
- **Panel width under 1230px (PN-20).** PANEL-SIDEBAR-RULES §11 (panel ≥ 610px) and §8 (chat ≥ 560px) contradict each other; at 1024 the composer toolbar wraps. Recommendation: lower the panel floor to 380px under 1280px.
- **The schedule sentence (PN-19).** « Not before Fri, Oct 30 » lands on Tue, Nov 3 with no reason on screen. Recommendation: name the chosen day in the sentence.
- **Draft post colour (PN-12).** The audit proposed orange (an AI action); FEATURES §17 keeps orange for the one primary. We unified the cards on secondary blue with the sparkle. Recommendation: keep blue on cards.
- **Schedule emphasis on the draft rail (PN2-07).** All six rail buttons are now grey. Recommendation: stroked blue for Schedule only.
- **A video's clips on its Sources card (PN-23).** The Overview says « 2 ideas, 5 clips », the Sources card lists only the ideas. Recommendation: a « 5 clips » row like the ideas row.
- **Idea kind colours (PN-11).** « Insight » green sits next to the green « Drafted ». Recommendation: grey kind tags; the word tells them apart.
- **Clip density (PN-21).** One clip per screen at full panel width. Recommendation: cap the thumbnail height in the panel only.

### Playbooks

- **Catalogue tile colour strip (PB-01).** It reads as the coloured edge bar the house rules ban; FEATURES §9 keeps it. Recommendation: the brand mark the table view already uses.
- **Reference image delete (PB-16).** One click, no confirm, no undo, while deleting a style asks. Recommendation: Undo on the existing toast.
- **Unsaved style on Cancel or Back (Image Studio).** A typed name and up to six images vanish. Recommendation: a « Discard this style? » confirm when something changed.
- **Duplicate catalogue title.** The topbar and the `h1` both say « Playbooks », and the tooltip repeats the subtitle. Recommendation: drop the topbar's hint on this route.

### Topic Feed

- **Influencer invite (TP-16).** A second primary on screen, shown even when the feed already holds influencer Topics. Recommendation: show it only when the Playbook follows no influencer, as a secondary blue button on the card.
- **Unavailable sources on Feed settings (TP-17).** Since the AA fix, six unavailable cards weigh as much as the two live ones. Recommendation: group them under « Not available yet » as compact cards.
- **Brand website site list (TP-11).** Editable while the source can't run. Recommendation: read-only until it goes live.

### Onboarding

- **Two primaries per review (OB-08).** The orange « Check my voice » on the left and the blue confirm at the bottom. Recommendation: secondary blue on the left.
- **Voice rewritten from a source with no undo (OB-17).** Recommendation: the same proposal flow as a network voice (show, then « Add to Voice profile »).
- **Featured reveal row hover (OB-16).** House rule says blue border, the row is orange by arbitration. Recommendation: record the exception in UI-PATTERNS.
- **« Step 3 of 4 » on a screen that can end the run (OB-18).** Recommendation: « Looks good, finish » goes straight to the end, without the « all set » card.
- **Voice-mode tabs at the bottom of their card (OB2-03).** They switch the cards below and read as a header over nothing. Recommendation: move them to the head of the cards they switch.

### Dialogs

- **Feedback and add-source widths.** UI-PATTERNS lists both at 640. Recommendation: feedback to 560, and update the doc.
- **« I read every message ».** Archie claims to read feedback; the team does. Recommendation: keep the first person and make the claim true.
- **`--app-radius-modal` (16px).** UI-PATTERNS documents it; the dialogs render the DS 8px. Recommendation: follow the DS and remove the token from the doc.

## DS gaps

What the design system doesn't provide yet, with what the app does meanwhile.

- **Contrast of the DS action colours.** White on `orange-100` measures 2.91:1, white on `electric-blue-100` 3.35:1, electric-blue links on white 3.35:1. All fail AA for 14px text; only the DS can change them.
- **No compact button.** `.ap-button` is pinned at 36px. The catalogue tile keeps a 28px override in `contexts.css`.
- **No keycap.** One app rule in `ds-patches.css` § Keycap now serves the whole app.
- **No error text under a field.** The onboarding website field uses caption + `--sys-text-color-error`.
- **No keyboard behaviour in CSS-UI selects and tabs.** Each host wires `tabindex`, Enter / Space and the arrow keys by hand (Topic Feed, panel, Playbook page, panel tabs, voice tabs).
- **No dialog focus contract or backdrop primitive.** `modal-coordinator.js` handles focus in, `inert` and focus restore for every overlay.
- **No segmented control in CSS-UI** (Angular-only); mode switches use `.ap-tabs`.
- **No radius tokens above 16px.** `welcome.css` keeps 20, 22, 24 and 32px.
- **Avatar initials** on `--comp-avatar-background-color` measure 2.06:1.
