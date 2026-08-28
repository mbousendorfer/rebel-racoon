# Acceptance criteria — the Topic Feed

Ported from `axel-van/rebel-racoon` @ `dbfd9d3c` (`docs/specs/AC-TOPIC-FEED-AND-CHAT.md`)
and **corrected against what this repo actually built**. Written from the running app:
each criterion says what the reader does and what they should see, so anyone with a build
can run it.

**Behaviour only.** No field names, routes, endpoints or code references. If a rule is
really about how the system works rather than how it looks, it is written as what the
reader would observe instead.

**Status:** proposed. Not yet agreed with engineering.

---

## 0. What changed against the original, and why

Nine criteria in the original describe behaviour this repo deliberately does **not** have.
§3.5 adds seven more, annotated in place rather than listed here: those are gaps in the post
card, not decisions, and §6 is ported as a product spec this prototype does not instrument.
They are listed rather than silently dropped, because each one is a decision somebody may
want to reopen — and because the audit that produced them is why the port happened at all.

| Original                                                         | Here                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-ROUTE-1/2/3` — the feed follows a global **active Playbook** | Scoped by a URL param on the feed, and by the chat's own Playbook in chat. A global scope written to by a select sitting in the feed's filter bar re-scoped the sidebar, the next new chat and the composer, and persisted it.                                                                                                                     |
| `AC-SEG-1`…`6` — two segments as tabs above the list             | **Withdrawn.** `later` is the **For later** state — one filter row, one chip — so `kind` sits at the same level as the other five instead of owning a whole control. The classification rules survive as rules about the field (`AC-ST-5`): unclassified still falls to `later`, and segment membership never read a content pillar in this build. |
| `AC-PANE-3` — the article stacks on a narrow window              | Reversed: the LIST is the fixed half and the article takes the rest, so side by side survives a 14" laptop. When it does stack, opening an article scrolls it into view — the original left it below the fold with no feedback at all.                                                                                                             |
| `AC-ACT-2` — Ignore always asks for a reason                     | It does, and the "don't show this again" escape is gone: it manufactured ignored Topics with no reason, in a feature built to print the reason back. The field itself is **optional** instead.                                                                                                                                                     |
| `AC-PANE-6` — the article shows a **"See all N posts"** link     | The contributing posts are listed in place. There is no separate view, so `AC-DLG-5`'s inner-view back action has nothing to apply to.                                                                                                                                                                                                             |
| `AC-POST-5/6/9` — evidence-post sentiment is editable            | Evidence posts are inert. A three-value sentiment menu on somebody else's post is its own decision; the card is read-only here.                                                                                                                                                                                                                    |
| `AC-CHAT-8` — extracted ideas come from the Topic's own analysis | Not built: extraction still runs the generic mock. Kept as a criterion for the real thing.                                                                                                                                                                                                                                                         |
| §6 — tracking events and properties                              | Not carried over. Those names have to be agreed with whoever owns the plan; inventing them in a prototype doc is how a plan gets two sources of truth.                                                                                                                                                                                             |

---

## 1. The invariant everything else depends on

> **`AC-CORE-1` — a Topic's review state, its kind and its two attention signals are
> FOUR separate fields, surfaced as ONE vocabulary.**
>
> The reader sees six states at one level — To review, Trending, Updated, Already used,
> For later, Ignored — each a DS Status pill with its own tone, glyph and word. That is
> presentation. Underneath, `status` (the reader's answer), `kind` (the scan's
> classification) and `isTrending` / `isUpdated` (the scan's signals) stay separate
> fields, and no code path may write one into another.
>
> **That separation is exactly what lets the flat vocabulary work.** A Topic can be
> Already used **and** Trending, or Ignored **and** Updated, and every surface shows
> both chips. Collapsing the fields into one would make one fact hide another and let a
> re-scan overwrite the reader's own answer.
>
> **Verify:** ignore a trending Topic. It leaves the list even though Trending is
> ticked. Re-tick Ignored and it comes back with its Trending chip intact. Ignoring it
> said nothing about whether it's spiking.

Everything below follows from this. Break it and the feed's filter starts lying, and a
Topic's review state quietly overwrites what the scan found about it.

---

## 2. Topic Feed

### 2.1 Arriving at a feed

| ID           | Title                                                | Criterion                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-ROUTE-1` | Feed opens on one Playbook, and says which           | Opening the Topic Feed from the sidebar shows **one** Playbook's feed, named in a labelled control on the page. The reader never picks a feed from a list — a feed is implicit in its Playbook — and switching that control changes **this page only**.            |
| `AC-ROUTE-2` | A link to one feed opens that feed                   | A link to one specific feed opens that feed, not whatever the reader's current scope happens to be. Every other link into the feed depends on this, including `AC-ROUTE-5`.                                                                                        |
| `AC-ROUTE-3` | Switching Playbook swaps the feed, and nothing else  | Switching Playbook on the feed swaps the feed under the reader. **Verify the blast radius:** the sidebar's count, a new chat's Playbook and the composer's picker must all be exactly as they were. A scope control on one page may not re-scope another.          |
| `AC-ROUTE-4` | Every Playbook's feed already listens to competitors | **Every Playbook has a feed, and it's already listening.** A brand new to the app never lands on a screen asking it to set something up first — the feed listens to competitor posts from day one. There's no "no sources yet" wall.                               |
| `AC-ROUTE-5` | A Topic link opens its article, filters widen        | A link to one Topic opens the feed with that Topic's article already showing. The status filter widens to **every state** for that visit, since an Ignored Topic isn't in the default view and the article would otherwise open onto a card the list doesn't show. |

### 2.2 The list: order and grouping

| ID         | Title                                 | Criterion                                                                                                                                                                      |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-AGE-1` | Topics always sort newest first       | Topics are always ordered **newest first**. No other sort, no control to change it.                                                                                            |
| `AC-AGE-2` | Three age groups, always in order     | The list is broken into age groups, in order: **Last 7 days**, **Earlier this month**, **Earlier**. A Topic exactly seven days old counts as _Last 7 days_.                    |
| `AC-AGE-3` | Empty age groups are hidden           | A group with nothing in it isn't shown. No empty headings.                                                                                                                     |
| `AC-AGE-4` | Card age and its group share one date | A card's age ("2d ago") and the group it sits in both come from the same real publication date, so they can't disagree.                                                        |
| `AC-AGE-5` | Paging can add to an existing group   | Loading more Topics can add cards to a group already on screen — it doesn't always start a new group. A page boundary inside a group must not push a later group out of order. |

### 2.3 States

⚠️ **`AC-SEG-1`…`AC-SEG-6` are withdrawn: the two segments are gone.** They were tabs
above the list — _Ready to draft_ / _Topics for later_ — which put `kind` at a different
level from the other four states: a whole control for one of them, checkboxes for two,
and nothing at all in the filter for the signals.

`later` is now the **For later** state, one row in the Filters panel and one chip on the
card like the rest. `AC-SEG-2` and `AC-SEG-6` survive as rules about the FIELD rather
than about a control: the scan classifies, unclassified falls to `later`, and nothing a
reader does moves a Topic between kinds.

| ID        | Title                                      | Criterion                                                                                                                                                                                                          |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-ST-1` | Six states, one level                      | Exactly six: **To review · Trending · Updated · Already used · For later · Ignored**. Each is one filter row and — except To review — one DS Status pill on the card, same height, same shape, same slot.          |
| `AC-ST-2` | To review shows no chip                    | **To review** carries no chip. It is the absence of an answer and the commonest value in a feed; a mark meaning "nothing has happened yet" would sit on almost every row and say nothing. It keeps its filter row. |
| `AC-ST-3` | A Topic may carry several                  | A Topic wears every state that applies, in the vocabulary's own order. Already used **and** Trending is a real state and both chips show.                                                                          |
| `AC-ST-4` | Colour is never the only signal            | Every chip carries its word as well as its tone and glyph. Ignored is **grey**, never red — ignoring destroys nothing.                                                                                             |
| `AC-ST-5` | The scan owns kind, the reader owns triage | The scan classifies `kind` and sets the signals; the reader sets `status`. Nothing a reader does moves a Topic between kinds, and a re-scan cannot overwrite triage.                                               |

### 2.4 Filters

One control: a **Filters** dropdown above the list, with a badge.

| ID           | Title                                                       | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-FILT-1`  | Two filter groups                                           | Two groups: **Topic status** — an `.ap-select` multi-select behind one trigger, six options, each with the DS **Only** shortcut at its end revealed on hover — and **Sources**, a list of checkboxes. The trigger names the **exclusions** ("All except For later, Ignored"), or the requirement when one is set ("Only Trending"), never a bare count. ⚠️ **Only** is a positive REQUIREMENT, not a tick pattern: untick-to-hide can only hide Topics that carry a label, and a `later` Topic always also carries a status, so ticking `later` alone hides everything. Touching any checkbox leaves the mode. |
| `AC-FILT-2`  | Defaults ticked: To review, Trending, Updated, Already used | Defaults: those four ticked, **For later** and **Ignored** unticked, every source. Which reproduces the old landing exactly — the _Ready to draft_ tab plus Ignored unticked — with one control instead of two. Ignored means "not this one"; For later means the scan found nothing draftable yet, and landing on a list that mixes the two buries the reason to be here. Already used stays IN: the work exists, it is findable, and hiding it is how the same Topic gets drafted twice.                                                                                                                     |
| `AC-FILT-2b` | One semantics on every row: untick to hide                  | A Topic shows only when **every** state it carries is ticked. ⚠️ NOT an OR over ticked rows — under an OR an ignored-but-trending Topic would reappear the moment Trending was ticked, which is the group `AC-PICK-2b` rejected outright and a breach of `AC-SIG-2`. Consequence, stated: a state can be hidden but not **isolated**; there is no "show me only what is spiking".                                                                                                                                                                                                                              |
| `AC-FILT-3`  | Badge counts narrowed groups, not options                   | The badge counts **groups that are narrowed**, not options ticked. Two narrowed groups shows "2". At the defaults, no badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `AC-FILT-4`  | Reset restores the exact defaults                           | **Reset filters** puts the defaults above back exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `AC-FILT-5`  | Any filter change returns to page one                       | Any filter change goes back to page one. Narrowing must never leave the reader three pages deep in a list that's now wider than it looks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `AC-FILT-6`  | The filter is never overridden                              | The list is **exactly** what the filter says. Nothing overrides it — see `AC-SIG-2`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 2.5 Attention signals

| ID         | Title                                      | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-SIG-1` | Signals never replace the review state     | A Topic can carry **Trending**, **Updated**, both, or neither, whatever its review state is. Neither is ever shown as a review-state pill. ⚠️ They now render as the SAME pill species as the review states — one vocabulary, six rows — but they never replace one: a Topic that is Already used and Trending wears both. What was withdrawn is the words "never shown as a review-state pill", not the independence underneath them. |
| `AC-SIG-2` | A signal never overrides the status filter | In the feed, a signalled Topic still shows **under its own review state**. A trending Topic that's been ignored stays hidden while Ignored is unticked. A signal never overrides the filter. Which is precisely why the filter is "untick to hide" and not an OR over ticked rows (`AC-FILT-2b`).                                                                                                                                      |
| `AC-SIG-3` | Signals only apply inside Last 7 days      | Signals only apply inside **Last 7 days**. An older Topic shows neither mark, whatever the data says — a "trending" card under _Earlier_ contradicts itself.                                                                                                                                                                                                                                                                           |

### 2.6 The article, beside the list

| ID           | Title                                                       | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-PANE-1`  | Card click opens the article beside the list                | Clicking a card's body opens that Topic's article **in the page, beside the list** — not a dialog, not the right panel. Clicking again closes it, and **the list does not change width when it does**: the pane holds its place with a placeholder rather than collapsing.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AC-PANE-2`  | The first Topic's article opens only once                   | On arriving at a list, the first Topic's article opens by itself **once**. Once the reader closes it, it doesn't reopen on its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AC-PANE-3`  | The pane holds the reading measure; the list takes the rest | The PANE is the fixed half — exactly the prose measure plus its own padding — and the list absorbs the remainder down to a 340px floor. A narrower window takes from the queue, never from the prose. **Verify at 1920px: the reader is capped at 1132 and LEFT-ALIGNED — every row's left edge equals the topbar title's — the list measures 460 and the pane 648, and there is no white space in the pane beyond its own 24px padding. Verify at a tall window with a short article: the pane's card ends where the article ends rather than running to the bottom.** It stacks only below the sum of the two floors, and the switch is measured on the space available to the two, never on the browser window. |
| `AC-PANE-3b` | A stacked article is brought into view                      | When the article does stack under the list, opening one scrolls it into view. A click that renders something below the fold is indistinguishable from a click that did nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `AC-PANE-3c` | The two columns scroll independently                        | Side by side, the list and the article each scroll in their own right. Scrolling one must not move the other, and a repaint must not lose either offset. **Verify:** scroll the list halfway, open a Topic, triage it — the list is still where you left it.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `AC-PANE-4`  | Article actions never move                                  | The actions sit in a toolbar ABOVE the article and outside its scrollport, so they are in the same place for a short article as for a long one and cannot be scrolled away. **Verify:** scroll the article to its end — the toolbar has not moved a pixel, and neither has the list.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `AC-PANE-5`  | Article actions: Use in chat and Ignore                     | Its actions are **Use in chat** (primary) and **Ignore**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `AC-PANE-6`  | Article shows title, prose, and the posts                   | The article shows its title, the prose in its two sections, and the contributing posts in place. No version history — an Updated Topic just reads as its current version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `AC-TITLE-1` | Every surface shows the article's own title                 | Every surface showing a Topic's title shows **the article's title**. The scan's original headline is only a fallback for a Topic with no article yet. A card and the article it opens must never show different sentences.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AC-TITLE-2` | Every surface shows it in the same order                    | The card and the article header render one identity in one order: **the claim, then the provenance run (source · age · state chips), then the actions**. ⚠️ The card led with its meta run and the article led with its title, so the door and the room presented one object two ways round — and the leading caption line is identical on every card in the feed while only `competitor-posts` is live, so the eye crossed the same eleven characters before every claim. **Verify:** the third element of a feed card's body and the second row of the pane's header say the same thing in the same order.                                                                                                       |
| `AC-TITLE-3` | The state chips are part of that identity                   | Wherever a Topic's identity is rendered, the chips of `AC-ST-1` render with it — the card AND the article header, from one exported renderer (`renderTopicStates`, in [`topic-article.js`](../../src/topic-article.js)). ⚠️ They were private to the card, so opening a Topic marked **Trending** landed the reader on a page that never said the word. The header holds a chip's height whether or not the Topic carries one, so `AC-PANE-4`'s fixed-height header survives them.                                                                                                                                                                                                                                 |

#### The trail

| ID           | Title                                                        | Criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-LATER-1` | A `later` Topic shows its analysis                           | A Topic in the second segment renders its written analysis like any other. What it lacks is a draftable angle, not a write-up — all 18 seeded `later` Topics carry one (136 words average). A note AFTER the prose says so; it must never replace the prose.                                                                                                                                                                                                                                                                                             |
| `AC-POSTS-1` | The evidence is a collapsible section, always closed at rest | **Contributing posts** is one collapsible section: the heading, the total count and a chevron on one clickable line. It rests **closed on every Topic**, whatever its kind — a resting state that varies with a field the reader cannot see is a rule they have to discover. Opening it shows **every** post: the old two-visible cap and its "N more posts" link are gone, because a collapsible section plus that link is two nested disclosures for one list. The count still states the total, so folding defers the evidence rather than hiding it. |
| `AC-TRAIL-1` | The trail is two-sided and merges on read                    | A Topic's history is the scan's entries (held on the Topic) plus **this reader's** (held in the triage row), concatenated seeded-first on read. **Verify: ignoring a Topic adds one entry; un-ignoring removes it and leaves the seeded entries untouched.** Neither half may overwrite the other.                                                                                                                                                                                                                                                       |
| `AC-TRAIL-2` | The trail sits last and starts collapsed                     | It renders after the evidence, collapsed, with its entry count on the header. 38 of the 50 Topics carrying a trail have a single entry, so open-by-default would spend a heading and a row on one line of provenance.                                                                                                                                                                                                                                                                                                                                    |
| `AC-TRAIL-3` | A trail status is not only a review status                   | The trail carries `updated` and `trending` as well as the three review states, so its labels come from their own map. A trail that only knew the review states would print a raw `trending` at the reader.                                                                                                                                                                                                                                                                                                                                               |

### 2.7 Card actions

| ID         | Title                                        | Criterion                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-ACT-1` | Use in chat marks Used, opens a new chat     | **Use in chat** marks the Topic Used, then opens a **new chat** with the Topic attached as a source. The mark lands before the chat opens. Same meaning on every surface that offers it. The Topic **stays in the feed** afterwards, carrying its Used mark — Used is ticked by default (`AC-FILT-2`).                         |
| `AC-ACT-2` | Ignore asks for a reason and is reversible   | **Ignore** always asks, and the question can never be switched off. The reason is **optional**; when given it is kept and printed back on the card, so an ignored Topic explains itself. On submit the Topic leaves the feed — Ignored is the one state unticked by default. Reversible, and undoing it **clears the reason**. |
| `AC-ACT-4` | Only one card menu open at a time            | One card menu open at a time across the whole feed. Clicking outside closes it.                                                                                                                                                                                                                                                |
| `AC-ACT-5` | Triage survives navigation and the next scan | What the reader did with a Topic survives leaving the screen, coming back, and the next scan. A re-scan that rewrites a Topic must not reset it.                                                                                                                                                                               |

### 2.8 Loading more

| ID          | Title                                       | Criterion                                                                                                                         |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `AC-PAGE-1` | A page is 10 Topics                         | A page is **10** Topics.                                                                                                          |
| `AC-PAGE-2` | Load more behaves like scrolling to the end | The next page loads when the reader reaches the end of the list, or from an explicit **Load more** control. Both behave the same. |
| `AC-PAGE-3` | No second load while one is in flight       | Reaching the end again while a page is still loading doesn't start a second load.                                                 |
| `AC-PAGE-4` | Scroll position survives every action       | Scroll position survives every action. Using or ignoring a Topic halfway down the list must not throw the reader back to the top. |

### 2.9 States

| ID           | Title                                             | Criterion                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-STATE-1` | Scanning shows once, on first arrival only        | **Scanning** — a working state shows while the feed is being assembled, on first arrival. It doesn't show when arriving on a link to one Topic.                                                                                            |
| `AC-STATE-2` | Empty-after-filter offers a reset, not a dead end | **Empty after filtering** — when the filter excludes everything, say so and offer a way back: reset the filter. Different from a feed that just hasn't found anything yet — see `AC-STATE-4`.                                              |
| `AC-STATE-4` | Nothing-found-yet reads as listening, not broken  | **Nothing found yet** — a feed that's listening but has produced nothing shows the working state first, then says nothing's landed and that it's listening, with a way to widen the sources. It must never read as broken or switched off. |

---

## 3. The chat surfaces

### 3.1 "Fresh topics to review" — the new-chat list

| ID            | Title                                            | Criterion                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-FRESH-1`  | Fresh grid shows at most 6 Topics                | A new chat shows Topics from the chat's **Playbook**, at most **6**, as a grid of the SAME cards the feed uses — 3 columns matching `.starter-grid`, so 6 Topics cost two rows. **It sits BELOW the workflow starters:** as a list of 6 full-width rows above them it ran ~500px and pushed all three starters off the fold. |
| `AC-FRESH-1b` | Each card is directly actionable                 | Each card carries **Use in chat** on its face, which marks the Topic Used and opens a new chat with it attached — the same thing the feed's verb does. The card body still opens the article, so reading-before-deciding keeps its door.                                                                                     |
| `AC-FRESH-2`  | Only to-review Topics under a week old qualify   | Only Topics that are **To review** and under seven days old. The list is called "fresh," so it has to actually be fresh.                                                                                                                                                                                                     |
| `AC-FRESH-3`  | Order: trending, then updated, then newest       | Order: the newest **trending** Topic first, then the newest **updated** one, then the newest of the rest. The top row is the one most worth acting on.                                                                                                                                                                       |
| `AC-FRESH-4`  | Used, ignored, and older Topics are excluded     | Used, ignored, and older Topics are all excluded — either the reader already answered, or the Topic isn't fresh anymore.                                                                                                                                                                                                     |
| `AC-FRESH-5`  | Footer's total never shrinks as you triage       | The footer reads **"N out of M shown"**, where **M is every Topic under a week old in this Playbook**, regardless of what the reader did with it. M doesn't shrink as they triage — it describes the week, not a to-do list. M is never smaller than N.                                                                      |
| `AC-FRESH-6`  | Footer links through to the full feed            | The footer links to the full feed.                                                                                                                                                                                                                                                                                           |
| `AC-FRESH-7`  | Waiting state plays once per chat, not per visit | A waiting state shows before the list, **once per chat**, and doesn't replay when the reader comes back to that chat. It lasts as long as the work actually takes.                                                                                                                                                           |
| `AC-FRESH-8`  | A row opens the article, not a choice            | Clicking a row opens that Topic's **article** — it doesn't choose the Topic. That decision comes after reading.                                                                                                                                                                                                              |

### 3.2 Topic → chat

The one flow behind **Use in chat**, from all four places that offer it: a feed card's
action menu, the article beside the feed, the fresh-topics list, and the picker.

| ID          | Title                                           | Criterion                                                                                                                                                                                  |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AC-CHAT-1` | Use in chat always opens a brand new chat       | A **new** chat is created. The Topic is never added to the chat the reader is already in.                                                                                                  |
| `AC-CHAT-2` | Chat is scoped and named on first paint         | The chat belongs to the Topic's Playbook and is named after the Topic **as it first appears** — it isn't renamed a moment later.                                                           |
| `AC-CHAT-3` | The Topic behaves like any other source         | The Topic arrives as an already-processed **source**. Extract ideas, draft a post, ask about it, list it in Sources — everything a source can already do just works, with no special case. |
| `AC-CHAT-4` | Thread names the Topic, no extra message        | The thread shows a source entry naming the Topic. No echoed message, no follow-up question — the entry already names it and the composer is right there.                                   |
| `AC-CHAT-5` | The Sources count includes the Topic            | The chat's **Sources** count includes it.                                                                                                                                                  |
| `AC-CHAT-7` | A link to a deleted Topic goes nowhere          | A link to a Topic that no longer exists opens nothing and goes nowhere.                                                                                                                    |
| `AC-CHAT-8` | Extracted ideas must come from the Topic itself | Ideas extracted from a Topic come from that Topic's own analysis and its evidence posts. Two different Topics must not produce the same ideas with just the titles swapped.                |

### 3.3 The composer's Pick from the Topic Feed

| ID           | Title                                            | Criterion                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-PICK-1`  | Picker is scoped to the chat's own Playbook      | The composer's Add menu offers **Pick from the Topic Feed**, opening a picker for **this chat's Playbook** — a chat keeps the brand it was created in.                                                                                                                                                                                                     |
| `AC-PICK-2`  | Picker lists ready-to-draft Topics only          | The picker lists **ready-to-draft** Topics only, never an ignored one. Same rule as `AC-SEG-2`: the scan's classification decides it.                                                                                                                                                                                                                      |
| `AC-PICK-2b` | Ignored Topics never resurface, here or anywhere | **Decided: no.** An ignored Topic is never surfaced by a signal, on any surface. The "Trending, normally hidden" group that would have shown ignored-but-trending Topics is gone, as is the flag that had it switched off. Ticking **Ignored** in the feed's filter is the only way to see one; a picker has no filter, so it has no ignored Topics in it. |
| `AC-PICK-3`  | No Playbook-picking step before the Topic list   | No Playbook-picking step. The picker opens straight onto the Topic list.                                                                                                                                                                                                                                                                                   |
| `AC-PICK-4`  | Picker grouping and order match the feed         | Topics are grouped and ordered the same way as the feed: same age groups, newest first.                                                                                                                                                                                                                                                                    |
| `AC-PICK-5`  | Picker cards look identical to the feed's        | Cards look **identical to the feed's** — same badge, age, signals, title, summary. The reader shouldn't see a different-looking object from the one they were just reading.                                                                                                                                                                                |
| `AC-PICK-6`  | Article opens inside the same picker dialog      | Clicking a card's body opens the full article **inside the same dialog**, with a back action to the list.                                                                                                                                                                                                                                                  |
| `AC-PICK-7`  | Use in chat behaves the same from here           | From that article, **Use in chat** works exactly as in §3.2.                                                                                                                                                                                                                                                                                               |
| `AC-PICK-8`  | An empty state when nothing qualifies            | An empty state when nothing qualifies.                                                                                                                                                                                                                                                                                                                     |

### 3.4 The Topic article dialog

Shared by the fresh-topics list, the picker, and the feed's full-article view.

| ID         | Title                                            | Criterion                                                                                                                                                                     |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-DLG-1` | Dialog shows the exact same article as the feed  | The dialog shows the **same article** the feed shows beside the list. One article, not two that can drift apart.                                                              |
| `AC-DLG-2` | No duplicate header when the article has its own | If the article already carries the Topic's title, the dialog doesn't print a second header above it — that'd be the same sentence twice. It's still named for screen readers. |
| `AC-DLG-3` | Dialog actions: Use in chat and Close            | Its actions are **Use in chat** (primary) and **Close**.                                                                                                                      |
| `AC-DLG-4` | Close sits top-right, with or without a header   | The close control sits in the dialog's top-right corner, header or no header.                                                                                                 |
| `AC-DLG-5` | Inner dialog views carry a named back action     | A view opened inside it — the source posts — carries a back action that names where it returns to.                                                                            |

---

### 3.5 Evidence posts

⚠️ **Ported annotated, because this repo renders these posts differently.** The original
reaches them from a **See all N posts** dialog; here the article renders **all** of them
inline, uncapped (the widest Topic has six, the average is under two), so the dialog has
nothing to add and is deliberately absent. Everything below therefore applies to the cards
**inside the article**, and the status column says what this proto actually does — an
unmet criterion here is a gap in `social-post-card.js`, not a decision.

| ID          | Criterion (abbreviated — the original's wording stands)         | Here                                                                                                                                            |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-POST-1` | Author, network, date, text, engagement, sentiment, source link | ⚠️ **Partial** — author, network, date, text and engagement render. No sentiment, no link.                                                      |
| `AC-POST-2` | Date under the name; network beside the name                    | ⚠️ **Differs** — network and date share one line under the name (`LinkedIn · 2 days ago`).                                                      |
| `AC-POST-3` | Engagement as labelled figures, zero counts omitted             | ❌ **Unmet** — icons plus counts, not labels. Zeroes are printed.                                                                               |
| `AC-POST-4` | Sentiment and the View-on link share one row                    | ❌ **Unmet** — neither exists.                                                                                                                  |
| `AC-POST-5` | Sentiment is an icon plus a coloured label                      | ❌ **Unmet** — no sentiment on the card, and **0 of 99 seeded posts carry one**, so this needs data before it needs UI.                         |
| `AC-POST-6` | Clicking sentiment opens a three-value menu                     | ❌ **Unmet** — follows `AC-POST-5`.                                                                                                             |
| `AC-POST-7` | View-on only shows when the link is real                        | ❌ **Unmet** — no link rendered. The data supports it: **32 of 99 posts have a `url`**, which is exactly why the "only when real" rule matters. |

---

## 4. Cross-cutting

| ID       | Title                                                | Criterion                                                                                                                                                                              |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-X-1` | Sidebar counter is to-review Topics in this Playbook | The sidebar's **Topic Feed** counter is the number of **To review** Topics in the active Playbook's feed. Using or ignoring one drops it right away.                                   |
| `AC-X-2` | Every surface reflects the active Playbook only      | Every list and counter reflects the **active Playbook** only. There's no "all Playbooks" view.                                                                                         |
| `AC-X-3` | Triage syncs everywhere at once, no reload           | Triaging a Topic anywhere shows up everywhere else without a reload.                                                                                                                   |
| `AC-X-4` | Keyboard-operable; colour is never the only signal   | Every control works by keyboard, and anything shown by colour alone — segments, sentiment, signals — is also readable as text for a screen reader.                                     |
| `AC-X-5` | The feed alone decides signals, segments, age groups | Signals, segments, and age groups are all decided by whatever produces the Topics. The reader's own view must not invent state the feed doesn't know about.                            |
| `AC-X-6` | A Topic only appears under its own Playbook          | A Topic only shows up under the Playbook that owns it. Test with two Playbooks that both have Topics: nothing from one shows up under the other, in the list or the counts.            |
| `AC-X-7` | A card's Playbook label must match its true owner    | When a card names a Playbook, it's naming the Topic's actual owner, and it matches the Playbook the reader is scoped to. If those two can disagree, the label is the one that's wrong. |
| `AC-X-8` | No Playbook selected shows nothing, not everything   | With no Playbook selected, every Topic surface shows nothing. It must not fall back to showing every Playbook's Topics.                                                                |

---

## 5. Prototype shortcuts that must NOT ship

Called out so nobody mistakes a demo trick for the real behaviour.

| In the prototype                                               | What it needs to be                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A Topic's age is a relative phrase, not a real date            | A real publication date; the phrase and the age group both come from it |
| How often a feed runs is a label — nothing actually runs       | An actual recurring run, on whatever cadence a feed is given            |
| The scanning state lasts a fixed moment                        | As long as the work actually takes                                      |
| What the reader did with a Topic is forgotten on reload        | Kept for that reader — see `AC-ACT-5`                                   |
| Seven of the eight sources cannot produce a Topic              | All eight live, or the ones that never will leave the page              |
| Ideas extracted from a Topic run the generic mock              | Ideas drawn from that Topic's own analysis and its evidence             |
| One feed per Playbook, and nothing says what a second would do | Defined behaviour, if a Playbook can ever have more than one            |

## 6. Tracking

⚠️ **This prototype fires nothing.** The section is ported because the names are the thing
being agreed and because `AC-TRK-6` is this feature's core invariant expressed on the wire
— status, trending and updated reported **independently**. Treat it as the spec the product
implements, not as a claim about this repo.

**This section names events, properties, and attributes on purpose.** Everywhere else in
this doc a name would be an implementation detail. Here the names are the thing being
agreed, so they're spelled out and have to match exactly.

**One criterion per tracking update, with one exception:** the ten frontend controls
share a single criterion. Attaching an attribute is the same mechanical check ten times
over — the real decisions are all in §6.1 to §6.3, and ten criteria would give the
mechanical part more weight than it deserves.

**What the frontend criterion proves, and what it doesn't.** It checks that each element
carries the right `data-track` value and fires it on click. It says nothing about the
event reaching the warehouse, and nothing about the payload — that's verified once,
downstream, not per control. A missing attribute is still a failure even if the click
itself works fine.

### 6.1 Updated — the workflow-start event

Three additions to `started_an_archie_workflow`. Nothing existing changes.

| ID         | Title                                | Criterion                                                                                                                                   |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-TRK-1` | source_type gains a topic value      | `source_type` accepts **`topic`**, and reports it whenever the workflow started from a Topic — from any of the four _Use in chat_ surfaces. |
| `AC-TRK-2` | entry_point gains starter-topic_list | `entry_point` accepts **`starter-topic_list`**, reported when the workflow started from the Fresh topics list on a new chat.                |
| `AC-TRK-3` | entry_point gains topic-feed-panel   | `entry_point` accepts **`topic-feed-panel`**, reported when the workflow started from the article beside the feed.                          |

The values `source_type` and `entry_point` already carry keep firing unchanged. A test
that only checks the new values would pass even if the old ones quietly broke.

⚠️ Two entry points are named here, but four surfaces offer _Use in chat_ — the card's own
menu and the picker have no value yet. Either they reuse one of these two, or they need
their own. See §7.

### 6.2 New event — a Topic was ignored

| ID          | Title                                              | Criterion                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-TRK-4`  | Ignore event fires once, never on cancel           | Ignoring a Topic fires the event **once**, from either surface that offers it. Opening the reason dialog and cancelling fires nothing — the Topic wasn't ignored.                                                                                                                                       |
| `AC-TRK-5`  | Ignore event carries all eight properties          | The event carries all eight properties: `Topic_status`, `Topic_trending`, `Topic_updated`, `Topic_title`, `Topic_summary`, `Topic_playbook`, `Topic_source`, `Topic_ignored_reason`. All eight, every time.                                                                                             |
| `AC-TRK-5b` | Only the reason property may be empty              | `Topic_ignored_reason` is the only one allowed to be **empty** — the reason box is optional and the dialog submits with nothing typed. Present and empty, never absent: a missing property and an unanswered question are two different things, and we want to know how often people bother explaining. |
| `AC-TRK-6`  | Status, trending, and updated report independently | `Topic_status`, `Topic_trending`, and `Topic_updated` are reported **independently**. Ignoring a trending Topic sends the ignored status _and_ trending true — that's `AC-CORE-1` on the wire, and a payload that collapses them fails this test.                                                       |

Allowed values:

| Property               | Values                                                                   |
| ---------------------- | ------------------------------------------------------------------------ |
| `Topic_status`         | `new` · `used` · `ignored` — `new` is labelled **To review** in the UI   |
| `Topic_trending`       | `true` · `false`                                                         |
| `Topic_updated`        | `true` · `false`                                                         |
| `Topic_title`          | the article's title — the same sentence the reader saw, see `AC-TITLE-1` |
| `Topic_summary`        | the Topic's summary                                                      |
| `Topic_playbook`       | the Playbook the Topic belongs to                                        |
| `Topic_source`         | the listening source it came from — competitor, influencer, website, …   |
| `Topic_ignored_reason` | the text the reader typed, verbatim — empty if they typed nothing        |

⚠️ **`Topic_status` needs a decision before this can be tested.** On an ignore event the
status is always `ignored` once it lands, which makes the property constant and useless.
It only means something as the status the Topic held **before** the ignore — that's how
these criteria read it. See §7.

**Two things about the reason text.** It's whatever the reader typed — any language, any
length, possibly personal — so it needs the same care as any other free-text field we
collect. And the same dialog also has a **Don't show this again** checkbox, which answers
a related question but isn't in the property list above. See §7.

### 6.3 New — Topic traces on AI calls

| ID         | Title                                | Criterion                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-TRK-7` | AI traces on a Topic carry five tags | An AI call that takes a Topic as input records a trace of its input and output, tagged with `Topic_trending`, `Topic_title`, `Topic_summary`, `Topic_playbook`, and `Topic_source`. All five or none — a partially tagged trace can't be grouped by Topic. |

Nothing here for a frontend test to check — no control involved, no attribute added.
Verified on the trace itself.

### 6.4 Frontend — ten controls, one criterion

| ID         | Title                                      | Criterion                                                                                                                                                                                |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC-TRK-8` | Ten controls each carry a data-track value | Every control in the table below carries the `data-track` value listed against it, and fires it on click. A wrong or missing value on any one of the ten fails this — no partial credit. |

The values below are proposals: `snake_case`, prefixed `topic_`, and each names the
**surface** as well as the action, since the same action means something different
depending on where it happens.

| The control                      | Where                              | `data-track`                   |
| -------------------------------- | ---------------------------------- | ------------------------------ |
| **See more topics in your feed** | footer of the Fresh topics list    | `topic_feed_see_more`          |
| **Pick from the Topic Feed**     | the composer's Add menu            | `topic_picker_open`            |
| a Topic card's body              | the Pick a topic dialog            | `topic_card_open_picker`       |
| a Topic card's body              | the Fresh topics list              | `topic_card_open_fresh_list`   |
| **Use in chat**                  | a feed card's action menu          | `topic_use_in_chat_card_menu`  |
| **Use in chat**                  | the article beside the feed        | `topic_use_in_chat_panel`      |
| **Use in chat**                  | the Pick a topic dialog            | `topic_use_in_chat_picker`     |
| **Use in chat**                  | reached from the Fresh topics list | `topic_use_in_chat_fresh_list` |
| **Ignore**                       | a feed card's action menu          | `topic_ignore_card_menu`       |
| **Ignore**                       | the article beside the feed        | `topic_ignore_panel`           |

Two things that will bite whoever builds this:

- **The picker's _Use in chat_ and the Fresh-list one are the same button.** One article
  dialog serves both (`AC-DLG-1`), so a fixed attribute can't tell them apart. The value
  has to be set based on where the dialog was opened from, or the two events become
  indistinguishable — which defeats the point of splitting them.
- **Cards open, they don't choose.** The two card-body values just record a card being
  read, not a Topic being picked (`AC-FRESH-8`). They're the top of a funnel whose bottom
  is the _Use in chat_ values — reading them as intent will overcount.
