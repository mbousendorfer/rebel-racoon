# UI redesign, 2026-10-30

Branch `redesign/ui`, cut from `main` at `d33305640`. Not merged. Open [`compare.html`](compare.html) for a before/after slider on every surface.

I redesigned eight surfaces of the prototype, one at a time: a diagnosis, three structurally different directions mocked in static HTML with the real DS and the Acme mock content, a written decision, a build, then up to two refine passes judged on screenshots. A coherence pass and a polish pass followed. Plans live in [`design-plans/`](../../../design-plans/); the diagnosis is [`design-plans/diagnose.md`](../../../design-plans/diagnose.md).

Scope: default config (`returning`, default flags) and the first run (`new-alt`). Surfaces behind a flag that is OFF stayed out.

## Scores

Grid out of 10: clarity in 3 seconds, hierarchy, composition, density, type, finish, usability, character.

| Surface                                | Before | After | Direction kept                           |
| -------------------------------------- | ------ | ----- | ---------------------------------------- |
| Chat                                   | 6.0    | 8.5   | One flow, results as cards in the thread |
| Drafts panel                           | 5.5    | 8.5   | Queue by status, named next step         |
| Panel: Sources, Ideas, Overview, Clips | 6.0    | 8.5   | Ideas by progress                        |
| First run, the two reviews             | 7.0    | 8.5   | One sheet, one way on                    |
| Playbooks                              | 6.0    | 8.5   | The fiche as a document                  |
| Topic Feed                             | 6.5    | 8.5   | The queue as an inbox                    |
| Image Studio, style creator            | 5.0    | 8.5   | My read of your images                   |
| Overlays                               | 6.5    | 8.5   | Current structure, shown to be right     |

Every surface stopped at 8.5. The global target was 9: no surface reached it.

## Chat

| Before                   | After                   |
| ------------------------ | ----------------------- |
| ![](before/chat.jpg)     | ![](after/chat.jpg)     |
| ![](before/new-chat.jpg) | ![](after/new-chat.jpg) |

| A: two panes (7.4)                | B: one flow (8.1, kept)             | C: pipeline strip (7.3)                |
| --------------------------------- | ----------------------------------- | -------------------------------------- |
| ![](explore/chat-A-two-panes.jpg) | ![](explore/chat-B-single-flow.jpg) | ![](explore/chat-C-pipeline-strip.jpg) |

**Diagnosis.** The thread announced each source's result twice: filled blue "2 ideas" pills on the file, then a butter "2 ideas ready" card. The drafts, the point of the chat, were a pale card cut by the composer fade. Your own message was a solid navy block, the loudest thing on screen.

**Why B.** A kept a document open next to the chat, against the rule that the panel never opens on its own. C stacked a second set of pipeline tabs over the topbar's. B puts the result under the request that asked for it.

**What changed.**

- The drafts batch is a grid of cards in the thread: network, DS status, three lines of text, the blocking issue in words, and one verb (Schedule, Shorten it or Add an image). The card opens the panel on its draft; "Review all 4" opens it on the batch.
- A source's counts are text links on its chip. The "N ideas ready" card is gone when the chip already says it.
- Your message is a white bubble with a grey-20 edge.
- New chat: the three Topic cards keep a row for their signal chip, so the three headlines start on one line.

Commits: `c86992608`, `1eff1ace2` (my white bubble kept white ink: invisible text, caught on the first refine), `33aa55a1c`.

## Drafts panel

| Before                       | After                       |
| ---------------------------- | --------------------------- |
| ![](before/panel-drafts.jpg) | ![](after/panel-drafts.jpg) |
| ![](before/draft-edit.jpg)   | ![](after/draft-edit.jpg)   |

| A: labeled preview (7.3)                  | B: list and detail (7.6)              | C: status queue (7.9, kept)            |
| ----------------------------------------- | ------------------------------------- | -------------------------------------- |
| ![](explore/drafts-A-labeled-preview.jpg) | ![](explore/drafts-B-list-detail.jpg) | ![](explore/drafts-C-status-queue.jpg) |

**Diagnosis.** One draft filled the panel. Schedule, the last verb of the pipeline, was one unlabeled icon among six. Nothing on the card said which drafts could go.

**Why C, with A's preview.** C sorts by what you have to do. It hid the network-faithful preview behind a button, and that preview is a core feature (FEATURES §4), so every card keeps it.

**What changed.**

- Two sections, "Needs a fix" then "Ready to schedule". Ready carries "Schedule 2": everything ready in one go, where you used to schedule network by network. A section never mixes statuses, so a bulk Schedule is always valid.
- The next step is a named button at the end of the row under the card, after "How's this draft?" and "Why this draft". Schedule left the icon rail in the panel. `nextStep()` in `post-validation.js` picks the verb for both the panel and the thread.

Commits: `086dcad81`, `6c5ec04c3`, `141cecec1`.

## Panel: Sources, Ideas, Overview, Clips

| Before                        | After                        |
| ----------------------------- | ---------------------------- |
| ![](before/panel-ideas.jpg)   | ![](after/panel-ideas.jpg)   |
| ![](before/panel-sources.jpg) | ![](after/panel-sources.jpg) |

| A: reading list (7.4)                 | B: by source (7.6)                 | C: by progress (8.0, kept)           |
| ------------------------------------- | ---------------------------------- | ------------------------------------ |
| ![](explore/panel-A-reading-list.jpg) | ![](explore/panel-B-by-source.jpg) | ![](explore/panel-C-by-progress.jpg) |

**Diagnosis.** Each idea card carried two buttons and three rows of meta. A bordered grey kind tag read as a control. Ideas already drafted took a full card.

**Why C.** It asks the Drafts panel's question: what is left, then what is done. B rebuilt the Sources tab inside Ideas. A hid every verb until hover.

**What changed.**

- Ideas: "To draft" as full cards, then "Drafted" folded to one row each, with "N drafts" opening those drafts. A drafted idea with no draft still in the chat says "Drafted".
- An object's kind is a bold word before its source ("Insight · q2-strategy-offsite-notes.pdf"), on ideas, clips, Sources rows and the Overview.
- Sources lost its permanent definition sentence.

I cut the mockup's "Draft all 3": it would add a flow step nobody asked for.

Commits: `f3a960bbb`, `5a5b65515`, `90cf3fa82`.

## First run, the two reviews

| Before                        | After                        |
| ----------------------------- | ---------------------------- |
| ![](before/welcome-recap.jpg) | ![](after/welcome-recap.jpg) |
| ![](before/welcome-voice.jpg) | ![](after/welcome-voice.jpg) |

| A: document (8.1, kept)                | B: one part at a time (7.7)            | C: card and editor (7.8)                  |
| -------------------------------------- | -------------------------------------- | ----------------------------------------- |
| ![](explore/onboarding-A-document.jpg) | ![](explore/onboarding-B-one-part.jpg) | ![](explore/onboarding-C-card-editor.jpg) |

**Diagnosis.** Two navigations sat over one list: a capsule with arrows and dots, and the part list on the left. Two primary buttons did the same thing.

**Why A.** B is the one-card stack deleted on 2026-10-20; picking it would have undone that removal. C squeezed the real fiche editor into a 400px column.

**What changed.**

- A part reads as one white sheet that scrolls, with a hairline between its blocks and the part's band once at the top. No dimming, no capsule, no keyboard glide.
- One way on, always in the left column: "Looks good, on to Branding", ending on "Draft my first post".
- The sheet enters whole.

Commits: `26f86fc12`, `b382cf29c`, `9e95f1f16`. The last fixes a regression I introduced: the final confirm said "Looks good, finish" and "Draft my first post" had disappeared. The `first-time-chat` capture caught it during the report.

## Playbooks

| Before                         | After                         |
| ------------------------------ | ----------------------------- |
| ![](before/playbook-goals.jpg) | ![](after/playbook-goals.jpg) |
| ![](before/playbook-voice.jpg) | ![](after/playbook-voice.jpg) |
| ![](before/playbooks.jpg)      | ![](after/playbooks.jpg)      |

| A: document (8.3, kept)              | B: outline (7.4)                    | C: spec sheet (7.8)                    |
| ------------------------------------ | ----------------------------------- | -------------------------------------- |
| ![](explore/playbook-A-document.jpg) | ![](explore/playbook-B-outline.jpg) | ![](explore/playbook-C-spec-sheet.jpg) |

**Diagnosis.** Every section of the fiche was a bordered card in an uneven two-column grid, each opening on a helper sentence. CONCEPTS §1 calls the Playbook "the document you'd hand a freelance writer".

**Why A.** C's two-column table could not hold the voice's rules or the branding. B kept the boxes and swapped working tabs for a second navigation.

**What changed.**

- The fiche is one 760px reading column: sections without boxes, a hairline between them, the voice's rules as lines.
- A section's helper sentence sits behind an (i) next to its title while reading, and stays written while editing.
- Competitors and Influencers line up with that column.
- Catalogue: "Playbooks" appears once (the topbar says it), and a card's counts read as one line of text.

No field was added or removed.

Commits: `f6ff33b51`, `03793d326`, `6944a3785`, `897b9b281`.

## Topic Feed

| Before                 | After                 |
| ---------------------- | --------------------- |
| ![](before/topics.jpg) | ![](after/topics.jpg) |

| A: inbox (8.2, kept)            | B: article lead (7.6)             | C: dense wire (7.7)             |
| ------------------------------- | --------------------------------- | ------------------------------- |
| ![](explore/topics-A-inbox.jpg) | ![](explore/topics-B-article.jpg) | ![](explore/topics-C-dense.jpg) |

The feed is the most arbitrated surface in the repo: master-detail where the list shrinks, two verbs, six chips from four fields, one article renderer for three hosts. All three directions stayed inside those decisions.

**What changed.** Each age group is one sheet of rows with a hairline between them. A row keeps the card's states by an inset ring (blue-40 on hover, blue-100 open) and the existing read/unread (regular weight and grey-05 once answered). A row's "…" shows on hover, keyboard focus or the open row only.

**Left alone.** The article's peach Relevance / Why now facts. A comment in `topics.css` argues for them, and they flipped twice before (outline, then peach). See To decide.

Commits: `23b98c4ac`, `b8bf70b73`.

## Image Studio, style creator

| Before                       | After                       |
| ---------------------------- | --------------------------- |
| ![](before/image-studio.jpg) | ![](after/image-studio.jpg) |

| A: images first (7.8)                        | B: my read (8.3, kept)                    | C: from your library (7.7)                   |
| -------------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| ![](explore/image-studio-A-images-first.jpg) | ![](explore/image-studio-B-read-back.jpg) | ![](explore/image-studio-C-from-library.jpg) |

**Diagnosis.** An empty 700px form: drop zone, an "optional" prompt behind a greyed button, a name. No feedback before saving. Three things came out of this screen on request earlier (Test run, Do / Don't, Presets to mix), and none of them came back.

**Why B, opening with A.** The code already writes a style prompt from the images' sampled colors (`generatePrompt`). It sat behind a disabled button.

**What changed.**

- Empty, the page is the drop zone alone.
- Once images land, I read them on my own. The prompt shows as "What I read from them" with the sampled palette and my mark, still editable ("Read them again").
- The name comes last, and the six images a style takes fit on one row.

FEATURES §18 said 10 images. The limit is 6 (`CUSTOM_STYLE_LIMITS`), now fixed in the doc. My first empty title also said "3 to 10", corrected in the build.

Commits: `723abb3d2`, `3130719db`, `2bb2dc193`, `c02fa47ba`. The polish commit `2bb2dc193` described a subtitle change its replace had failed to make; `c02fa47ba` makes it and says so.

## Overlays

| Before                           | After                           |
| -------------------------------- | ------------------------------- |
| ![](before/modal-add-source.jpg) | ![](after/modal-add-source.jpg) |

| A: per method (8.0, kept)              | B: one dialog (7.6)                    | C: no dialog (7.9)                    |
| -------------------------------------- | -------------------------------------- | ------------------------------------- |
| ![](explore/overlays-A-per-method.jpg) | ![](explore/overlays-B-one-dialog.jpg) | ![](explore/overlays-C-no-dialog.jpg) |

Search and Pick a chat were already right. I explored adding a source, the one overlay with a structural doubt. C turned out to be what the prototype already does: "Add PDF" and "Add video" add the source with no dialog (`startPillFromKind`). "Attach a file" is the fallback for a dropped file I can't classify. B would add a dialog where there is none today. The structure stays, and each add dialog now says under its title what I do with the source.

Commit: `0d94b6e93`.

## Coherence

| Pattern                    | Before                                                                | After                                                                                     | Commit      |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| A draft that won't publish | Orange in the thread, red infobox in the panel                        | DS error tone in both. The Overview keeps its warning: it summarizes the chat's next step | `6ea9304e2` |
| A card's next-step verb    | Stroked blue on drafts, tinted secondary blue on ideas and clips      | Stroked blue everywhere; Draft post keeps its sparkle                                     | `24d559133` |
| What I propose             | Suggested competitors in dashed cards (dashed reads as a drop target) | Solid grey-20 edge, my butter mark on the group                                           | `ac5c41eb8` |

The three rules are written in [`UI-PATTERNS.md`](../../reference/UI-PATTERNS.md).

## Polish

- Accessibility: the thread's draft card was a `role="button"` div holding its own verb button, a nested interactive. The network name is now the button that opens it. Checked headless: zero nested interactives, tab order X → Schedule → Instagram, the six (i) on the fiche focusable and named (`bfa5ec02c`).
- Empty style creator: no duplicate label, subtitle "Up to 6 images" (`2bb2dc193`, `c02fa47ba`).
- Voice rules on the fiche as hairline rows (`897b9b281`).
- Copy: every string I added checked against `copy-principles.md` and `GLOSSARY.md`; two British spellings fixed (`202fc9ae5`).

## Copy changes

| Before                                                                             | After                                                                    | Why                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| 4 drafts to review · Review drafts                                                 | One card per draft · Schedule · Shorten it · Add an image · Review all 4 | The verb on the object, named                   |
| Generate from the images (disabled) · Style prompt (optional)                      | What I read from them · The look, in words · Read them again             | It runs on its own and it is my read            |
| Drop images here or browse · Up to 6 images that share the look you want · 0 added | Drop a few images that share a look, or browse · Up to 6 images          | One sentence says it once                       |
| Attach a file                                                                      | Attach a file · I read it and tell you what's in it.                     | Says what happens next                          |
| Looks good, finish                                                                 | Draft my first post                                                      | The last confirm says where it leads            |
| Source: [grey tag]                                                                 | Insight · q2-strategy-offsite-notes.pdf                                  | A fact reads as words, a tag reads as a control |

## To decide

1. **Chat: drop the "N ideas ready" card** after each source; its counts live on the source's chip. Recommendation: drop it, one result announced once. Mockup: [chat B](explore/chat-B-single-flow.jpg). Built.
2. **Drafts: Schedule leaves the icon rail** (prod's `post-card-actions` order) for a named button under the card. Recommendation: keep. Built.
3. **Drafts: group by status** instead of by network, bulk selection per status section. Recommendation: keep; the network stays on every card and in the filter. Built.
4. **First run: remove the floating confirm, the ↑ · dots · ↓ capsule and its ↑ / ↓ keyboard glide.** Recommendation: keep the removal. Built.
5. **Topic Feed: the article's peach facts.** Kept as they are. Recommendation: decide one rule for "Archie's read" across surfaces before touching them again. Mockup of the alternative: [topics B](explore/topics-B-article.jpg).
6. **Image Studio: pick the Playbook's reference images in the style creator.** New capability, not built. Recommendation: build it, the brand already has the images. Mockup: [image studio C](explore/image-studio-C-from-library.jpg).

Global navigation (the sidebar) was not proposed for change.
