# Decisions — the arbitrations behind the code

> Moved here from `CLAUDE.md` on 2026-09-30, unchanged in substance, so the agent brief stays short.
> `CLAUDE.md` keeps one line per decision and links here. **These are not background**: each one records
> something that was argued, shipped and in several cases reverted — read the section before touching
> the surface it names, and update it in the same commit when the user overrules it.

## A settings surface must not aggregate

Three attempts at a general settings page were reverted here: the drawer (`2b0abcf`, the DS ships no side-drawer primitive), a Connectors section (`8cdd7e8`, it duplicated `/connectors`), then `/settings` itself (`6fca0b0`). Config belongs on the entity that owns it (a Playbook's fields live on `/playbook/:id`) or on a route scoped to one feature — never re-hosted in a global page.

## Playbook sharing: the store holds the facts, `playbook-access` holds the rights

Behind the `playbookSharing` flag a Playbook has an owner and one of **three** scopes — `personal`,
`members` (a **fixed** list of colleagues, in `sharedWith`) or `organization` (a **dynamic** list: the whole
org, joiners included). That fixed-vs-dynamic difference is what the two sharing cards say FIRST — the doc
asks twice for it to be underlined. ⚠️ This shipped with two scopes and a "there is no named sharing" note
for two weeks, on an arbitration nobody ever wrote down; the spec has had three states in every version, so
the doc won and the people-picker is real. An **empty `members` list is not shared** — it reaches nobody, and
a manager's whole reach hangs off that predicate.

**Editing and governing are separate rights.** `canEdit` is the owner, full stop: a shared fiche is
read-only for everyone it reaches, managers included. What a manager gets on a **shared** Playbook lives in
`canGovern` — share it, hand it over, delete it — and `canDelete` / `canManageSharing` / `canTransfer` all
derive from that, never from `canEdit`. A manager with a pencil on a colleague's Playbook was the bug this
replaced.

**A Playbook tied to a social profile (`selectedProfileId`) only reaches people who can reach that
profile.** `profileBlockFor()` runs before every other test in `canView`, and the picker keeps a blocked
teammate in the list — disabled, with the reason — because removing the row would leave the owner hunting
for their colleague. The permission is Agorapulse's, so it is read from `org.js` (`profiles` per member) and
never stored on the fiche; an unresolvable profile **fails open**.

`contexts-store` carries `ownerId` / `scope` / `sharedWith` / `history` but **never filters** —
`getContexts()` keeps returning everything to everyone. That is deliberate: a chat whose Playbook stopped
being shared still has to _name_ it ("this chat runs on Brightline · launch, and Jonas Beck stopped sharing
it"), which means reading a fiche you may no longer open. `src/playbook-access.js` is the only gate —
`canView` / `canUse` / `canEdit` / `canGovern` / `canManageSharing`, plus `visibleContexts()` /
`usableContexts()` / `editableContexts()` that surfaces substitute for `getContexts()`, and
`revokedContextFor()` as the one function allowed to look past it. `sharedWith` survives a trip through
private and back, because the doc promises both directions with no data loss — only `scope` decides who is
in. The flag short-circuits in a single place, so flag OFF is byte-for-byte the pre-sharing behaviour.

Ownership is **chrome, never a section**: a tag in the card's metadata corner and beside the fiche's name,
an Owner quick-fact in the rail, and everything else in the Share modal. A "Sharing" section on the fiche
would be the switch grid already removed for the listening config ([`CONCEPTS.md`](CONCEPTS.md) §1, third
storage exception). The degraded chat marks `body.playbook-revoked` — on `<body>`, because the drafts panel
is shell chrome outside `#app` — and one capture-phase listener swallows the generating hooks and says why,
so no card renderer needs to know sharing exists.

## The Image Studio is split by subject, and the engine holds no DOM

> Rewritten 2026-10-16. The earlier text described `src/image-studio.js`, `components/image-studio-v2/` and
> `inline-text.js` — all deleted in `5364592a3` with the old Image Studio. What follows is the module that
> replaced them, `src/modules/image-studio/`.

**State has one home per lifetime.** What outlives the dialog — styles, products, creations, assets — is in
`state/store.js` (read side + subscribe) and written by `state/creation-actions.js` / `state/style-actions.js`
through `storageService`. What lives only while the dialog is open — the brief being built, the focused
variation and slide, the run's status, the edit documents — is the `mountStudio()` closure in
`views/studio.js` (`state`, `entries`, `sources`): no module-level map, nothing to clean up but the closure.
The brand is the Playbook, read through `state/playbook-brand.js` only; the module imports **no Archie store**
— the draft comes in as data and goes back through callbacks (`onUse`, `onUseCarousel`, `renderFeedPreview`).

**One render path.** A mutation calls `paint()`, which rebuilds the dialog body from state. The exceptions are
quarantined in **one** place, the editor's **Silent** section (`views/edit/editor.js`): typing in a text
layer, dragging a colour or a slider, and the live gestures patch the DOM by hand, because a re-render would
lose the caret, replace the input mid-drag, or remount an open popover so it replays its entrance. The
Suggest buttons' in-place fill (`suggestInto`) is the only other DOM write, for the same caret reason.
Nothing else may skip `paint()`.

**The prompt is written at generate time** by `buildPrompt()` (`services/prompt.js`), pure and shared by every
implementation of `imageGenerationService` — so a real API gets exactly the prompt the mock shows. There is
**no prose brief to face first, and no Advanced tab**: the controls are the brief (Start from · style or image ·
text on the image · shape · variations · slides), and Generate is the footer's submit.

**A carousel is one creation, many slides** (2026-10-16, parity with prod's `generateCarousel`). The Slides
control (1–10) is RUN config on the brief, never on the Playbook. One run = one creation, one
`styleSnapshot` — the Style Bible every slide shares — and each variation carries `slides[]` (its own seeds
and a line of the post per slide). `slideOf(c, v, i)` turns a slide into an ordinary (creation, variation)
pair, so drawing, baking, the editor and the edit keys (`variationKey`) work on slides unchanged: edits and
undo stick to their slide, Redraw becomes "Apply to this slide", Regenerate replaces one slide. ⚠️ Don't
model a carousel as N creations: the Style Bible is what makes it a carousel.

⚠️ **Two earlier arrangements were DELETED, not flagged — don't propose either back.** A _classic_ one landed
on a prose brief in a bottom composer with the options pinned in a 284px inspector (`git log -S isv2-panel`),
and an _auto-brief_ one made the written brief the hero of the stage with the options as popover modifiers
under it (`git log -S isv2-bs-mod`). Both asked the user to face a brief before there was anything to brief
about. Their flags (`imageStudioAutoBrief`, `imageStudioSetupFirst`) are gone. **Nor the Generate | Edit
tabs** (removed 2026-10-02): Edit is the button on the image, "Back to the variations / slides" leaves it.

⚠️ A confirmation inside the studio must NOT be `confirm-modal.js`: it registers with `modal-coordinator`,
whose `requestOpen` closes the active overlay — the studio. Use the module's own `confirmDialog`
(`ui/dialog.js`).

Stylesheets: `src/modules/image-studio/styles/imst-*.css` are the module's (`.imst-*`); the editor reuses the
old studio's markup, so `styles/screens/image-studio-v2.css` (`.isv2-*`) and `image-studio-canvas.css`
(`.image-studio__*`, everything that sits ON the image and must follow a precise pixel) stay, and `.isv2-`
is a naming legacy, not a second studio.

⚠️ Class families assembled by string concatenation — a rename breaks them silently:
`.image-studio__crop-handle--{nw,ne,se,sw}`, `.image-studio__popover--{kind}`, `.image-studio__tt-{kind}`,
`.imst-dialog--{size}`, `.imst-menu--{align}`.

The option previews are inline SVG drawn per style (`render/style-art.js`), every colour a DS token; a Style
holds ONE subject still and varies the TREATMENT.

## Connectors as live, MCP-queryable sources

**Gated behind the `connectors` feature flag (default OFF)** — when off, every connectors surface (gallery route + sidebar nav, modal, composer Add → "Connected sources" submenu, Sources panel "Live connectors", Add-source modal Connectors tab) is hidden. Turn it on in the sidebar cog's Admin popover. Connector management lives only on the `/connectors` page/modal — nothing else duplicates it.

Connectors (Notion, Slite, Google Drive, GitHub, …) are seeded in `mocks.js` (`connectors` + `connectorDocs`) with `category` / `featured` / `accent` / `capabilities`. Once **connected**, a connector becomes a **live source**: the user "asks" it in chat and `assistant.js` `sendConnectorMessage()` simulates an MCP round-trip — a "Querying … via MCP" reasoning chip listing tool calls, then a cited mock answer. Entry points: the `/connectors` gallery page (clicking a connector opens its detail in `connectors-modal.js`), the composer **Add** menu, and the right-panel **Sources** "Connect" / "Live connectors" surface. `connectors-view.js` holds the shared render helpers used by both the page and the modal; `connector-ask.js` launches the in-chat ask flow. All connect/disconnect goes through `connectors-store` so the gallery, the modal and the composer stay in sync.

## The Topic Feed — the one place Archie proposes instead of waiting

**Gated behind the `topicFeed` feature flag (default OFF)** — when off, `/topics` and `/topics/settings` (a stale deep link bounces to `/`), the sidebar nav row and its unread count, the "Fresh topics to review" list on a new chat and the composer's "Pick from the Topic Feed" all disappear. The data (`mocks.topicFeeds`, `mocks.topics`) rides along regardless, exactly like `multilingualPlaybook`.

Agorapulse listening pulls social posts against **eight sources** declared in `topics-catalog.js`. That file is **CONFIG, not content**: it ships with the app and must exist in `new-alt` mode too, the same split as `ff-catalog.js` vs `mocks.js`. Only `competitor-posts` and `influencer-posts` are `live`, and that is load-bearing — the feed's default source filter derives from `LIVE_SOURCE_IDS`, so a Topic seeded on a non-live source would be filtered out of its own feed on first paint.

Archie assembles those posts into a **Topic**: a headline (the claim), a written analysis in two sections, and the posts behind it. `/topics` is the **queue you triage it in**.

**⚠️ This replaced a Topics MAGAZINE, which was deleted rather than flagged.** The proto had a cross-Playbook magazine — lead story + grid, `ctx.topics` on the Context, a front page on `/` behind `frontPage`, a three-headline rail in the new-chat hero, Start-a-chat / Dismiss. All of it is gone: 8 modules, 5 stylesheets, the `topics` and `frontPage` flags, the Home nav row. Keeping both meant two nav rows carrying the same antenna, two stores and two settings pages — which is what the fork this was ported from actually shipped. Deleting freed the canonical names (`/topics`, `topics-store.js`, `topic-card.js`, `topic-flow.js`), which the port took instead of installing a third vocabulary (`research` / `lane` / `brief`) beside the Playbook ⇄ Context legacy. **Do not propose bringing the magazine or the front page back behind a flag** — that arbitration is closed. A front page may return, but on the Topic Feed's own data. ⚠️ The account home (`/home`, § The Playbook scope) is **not** that page coming back: the front page was a page of what Archie PROPOSES, fed by listening and mounted on `/`; the home is a page of what you HAVE — your Playbooks and your chats. It reads no `topics-store`, renders no Topic, and `/` is still a pure redirect.

## THE INVARIANT: four separate fields, ONE visual vocabulary

`status` (`new` / `used` / `ignored`), `kind` (`ready` / `later`), `isTrending` and `isUpdated` are four fields in `topics-store`. No signal is a fourth status and nothing a reader does writes `kind`.

The reader sees **six states as CHIPS** — To review (chip-less) · Trending · Updated · Already used · For later · Ignored — each a `.ap-tag` pill with its own tone, glyph and word, on the card and the article header. `topicStates(topic)` derives that flat list from the four fields; `TOPIC_STATES` in `topics-catalog.js` is the single declaration. **That is presentation, not a merge** — and the separation is exactly what makes it work: a Topic can be **Already used and Trending** at once and both chips show. Collapsing the fields would let one fact hide another, let a re-scan overwrite the reader's own answer, and break the wire contract (`AC-TRK-6`) that reports the three independently.

**The Filters panel is NOT that six-row list** (it was, and the flat version was reverted — `git log -S renderStateSelect`). It is **three grouped controls**, each one field: **Topics**, a multi-select on `kind` that is **EMPTY at rest — both lanes (To review + For later) show in one list**, and ticking a lane narrows to it (a For-later Topic is told apart in the mixed list by its own blue "For later" chip, not a card change); **Marked as**, a multi-select on the ANSWERED statuses (Already used ticked at rest, Ignored not), added on top of the To-review baseline the list shows; **Sources**, where empty means every source — the same rule as Topics, so no group can blank the list (it meant "none" until 2026-10-16). This replaced a one-lane-at-a-time RADIO (`git log -S renderKindRadio`), which replaced tabs above the list — the arbitration is now "read both by default, narrow if you want". **Trending and Updated are not filter rows at all** — a signal is a claim about NOW, not a lane, so it stays a card chip. Dropping them from the filter is what lets the ignored rule fall out for free: the predicate never reads a signal, so one can never resurface an ignored Topic. An ignored Topic shows only when **Ignored** is ticked in Marked as. `defaultFilters` / `matchesFilters` / `narrowedGroupCount` in `topics-store` are the three functions this lives in.

**Triage lives in its own `Map`**, never written onto the Topic: a Topic is what the scan returned (server-owned), a triage row is what _this user_ did with it (user-owned). Keeping them apart is what lets a re-scan replace a Topic without clobbering the answer.

**The Topic's trail is two-sided, for the same reason.** `history` on the Topic is what the scan recorded ("Surfaced from the 16 Jun – 16 Jul Instagram scan"); the triage row's `entries` are what this reader did ("Ignored — not our angle"). `withTriage()` concatenates them on read, seeded first, so the trail reads oldest to newest and neither half can overwrite the other. Writing the reader's entries onto the Topic would put them in the path of the next scan — which is precisely what the separate Map exists to prevent. `unignoreTopic` wipes `entries` alongside `reason`, because that is the path the toast's Undo takes and an undo that leaves a footprint has not undone anything.

An **ignored Topic is never surfaced by a signal, anywhere.** Ticking Ignored in the filter is the only way back. The opposite rule — "a spike is never hidden by triage" — was tried and dropped: it made Ignore a suggestion rather than an answer.

`withTriage()` **clears both signals past the first age group**, because Trending and Updated are claims about _now_ and a card carrying either under a three-weeks-ago separator contradicts itself. Enforced on read, not in the seed, so every surface agrees for free.

## Connecting an account: asked in the flow, never as a prerequisite

Behind `skipConnectProfiles`, nothing is connected to begin with and Playbook creation stops
_requiring_ an account: the step stays, but it is a choice — it offers to connect one (the same
rows and the same modal as in chat) when none is, or the usual profile pick when some are, and
either way it carries a **Skip**. The step count doesn't change; only its obligation does.
Skipping is not a dead end — the ask comes back where it pays for itself, in the chat flows that
draft FOR an account. `requireConnectedProfiles()` in
[`connect-profiles-flow.js`](../../src/connect-profiles-flow.js) is the whole feature: it returns straight
through when anything is connected, so callers wrap unconditionally and the flag-off path is
byte-identical. Otherwise it puts a Quickpicker in the step's own slot, hands the confirm to
[`connect-account-modal.js`](../../src/components/connect-account-modal.js), then calls `onReady` — so the
flow **resumes where it left off** instead of restarting. The rule is coverage, not convenience:
EVERY path that produces a draft asks — `addPostDraft`'s five call sites are the checklist —
draft-from-idea and repurpose (`session/draft-questions.js`), clip drafts (`clip-draft-flow.js`), top
posts inline and in the studio (`top-posts-flow.js`), and the Clip Studio. A batch of posts needs no
gate of its own: it replays its sources through the classic source → idea workflow, which is already
gated.

The Clip Studio is the one that can't use the shared step — it is a full-panel takeover, so a
Quickpicker posted into the thread would be hidden behind it. `renderClipStudioConnect` (session/clip-studio-view.js) renders
the SAME network cards in the studio's own chrome instead, and connecting notifies so the normal
profiles stage takes over. Left alone it was a silent dead end: `finalizeClipStudio` returns early
on an empty account list, so "Create N drafts" sat disabled with nothing explaining why.

Two rules this rests on:

- **The grid asks, the dialog consents** — the product's own two beats. The step is a card grid of
  NETWORKS (glyph, name, "Pages" / "Professional accounts"), laid out like Agorapulse's _Add new
  social profiles_ screen, because that is the real unit: you don't pick from accounts you already
  have, you pick a network and its dialog hands one back. Connecting is an Agorapulse action, not an
  Archie one ([`CONCEPTS.md`](CONCEPTS.md) §6 — the account catalogue belongs to the
  platform). Don't collapse the two into a bare "Connect" button.
- ⚠️ **The cards variant resolves by DESTROYING the picker** (`pick()` deletes the state before
  calling `onPick`). So the dialog must hand control back on cancel — `onDismiss` re-arms the grid.
  Without it, backing out of the dialog leaves the flow with nothing on screen.
- **The Skip is not silent.** Onboarding's Skip (the nothing-connected branch only) opens
  [`skip-connect-modal.js`](../../src/components/skip-connect-modal.js): the three guarantees first, as a
  **trio of three filled tiles** — bold claim + a one-line detail — saying nothing publishes without
  approval, Archie reads only what is already public, and the accounts live in Agorapulse and not in
  Archie ([`CONCEPTS.md`](CONCEPTS.md) §6). A row, not a stack: stacked, it had the
  same silhouette as the checkbox list below it, so nothing said "read this, then answer that" — and
  three equal-weight paragraphs gave the claims no rank. ⚠️ **Three separate tiles, not one filled
  container**: a single grey rectangle holding three columns reads as one BANNER, and the three
  blocks only appear on a second look — the fill and the padding belong to each item, so white
  gutters do the separating. The dialog's 680px and the three-or-one column rule both fall out of one
  measurement (the widest string is 162px); `auto-fit` is banned here because two tiles plus an
  orphan third was invisible as a band and is glaring as separate shapes. Then a
  multi-select "Why not now?". ⚠️ **No margin-top anywhere in this dialog** — `.ap-dialog-content`
  gaps its children by `--ref-spacing-md` and every margin added a second one. Answering is **optional**
  (2026-10-19 — it was REQUIRED: a gate on the skip was one more friction on the app's very first
  screen, and a forced tick is a noisy answer). Leaving is free too — Back, Esc, backdrop and X all
  put the network grid back rather than skipping; only an actual answer is recorded. Reasons land in `feedback-store` via `recordReasons` (key `skip:connect-profiles`), the one
  store function that records an answer with no verdict. Skipping the _pick_ of an already-connected
  profile is a different gesture and is NOT intercepted.
- **A step that a dialog hands control back to is put BACK, not asked again.** `askAltProfile` takes
  `{ announce }`, false from both `onDismiss` paths — without it the thread printed its own question
  twice for one step (a pre-existing blemish on the connect dialog's cancel, doubled the day the skip
  dialog became a second caller).
- **`social-profiles.js` now holds state.** A module-level `Set` of connected ids, empty at first
  and kept in sessionStorage (`archie-connected-profiles`, 2026-10-19) so a reload — the one that ends
  onboarding included — doesn't disconnect them, with `connectAccounts()` writing to it and a notifier so
  every surface agrees. `profileForNetwork()` goes through the SAME gate — otherwise the schedule
  modal and the top-post cards would show a profile nobody connected. `getConnectableAccounts()`
  filters on `handle`, not `status`: the mock's disconnected entries include bare network stubs
  (`{ id: "tt", platformLabel: "TikTok" }`) that have nothing to connect to and would render as
  "undefined" rows.

**Figé ON le 2026-10-29** : `connectFirst` n'est plus un flag ; le chat d'onboarding, son étape comptes et `skip-connect-modal` sont supprimés — ce qui suit est l'histoire.

**Connect first (flag `connectFirst`, 2026-10-19).** A new user can be asked to connect BEFORE
anything else — `/welcome-alt/connect`, modelled on prod's Archie signup step — without breaking
this rule: the ask moves to the front, it doesn't become a gate. The screen keeps the same two beats
(a network row asks, `connect-account-modal` consents) and the same Skip (`skip-connect-modal`,
same feedback key). Under the flag the whole first-time run is **screens, not the chat**: the plan
(`/welcome-alt/intro`), then one screen per step in one shell — the step on the left, the Playbook
card filling with the real answers on the right (`welcome-alt-shell.js`) — then a reveal
(`/welcome-alt/ready`) that ends on Start writing, with the editable page one click away — in the same
split and on the stage: EVERY block of the Playbook, never a sorted subset (2026-10-19, asked
explicitly), dealt as a stack of cards on the stage — one block per card, already in edit, browsed with
arrows (← →, the keyboard's too) and edited on the fly — no per-card Looks good: 20-odd confirmations
was a chore (2026-10-19). A wall of blocks and a separate Confirm head were both tried
the same day and dropped: the head and the view's sticky Cancel / Save read as two stray bars. Each part has its own tint (its cards' header band
and its tile in the list) — a deliberate exception to "group by structure, not colour", asked for
explicitly (2026-10-19) so the colour says which part you're in; soft DS tints only, never electric
blue, which stays the interactive colour. The nav's three pills are a second, smaller exception (`.welcome-review__navbtn`
instead of `.ap-button`): one shape and one height for all three, asked for the same day. The steps'
effects on the draft are context-builder's (`createAltDraft`, `readAltWebsite`, `readAltFiles`,
`writeAltManually`, `analyzeAltInterview`) — the chat calls the same functions, so there is one
implementation and two hosts. Every list of steps (the plan, the progress) comes from `altSteps()`,
so no screen announces a step the run won't ask.

**No account in the run (flag `connectFirst`, 2026-10-28, asked: « on va enlever la question de connexion des réseaux »).**
The connect screen is gone from the first-time run. **Where you post** is asked in the Voice review (`/welcome-alt/voice`, part Your networks; a first-screen
`/welcome-alt/networks` lived one day and was removed on 2026-10-29, asked: « le "where do you post" est
toujours au même endroit »), written to `connectedSocials` as network slugs. A new user arrives with their
Agorapulse accounts already connected (2026-10-29: « les comptes sont connectés déjà »), so the
networks are ticked from them and posts are read without a connect dialog. This rule is what makes that safe: `requireConnectedProfiles`
already wraps every path that produces a draft, so the first draft asks for an account and its grid
leads with the Playbook's networks. The time saved goes to the voice, now a step of
its own: since 2026-10-29 the run's last review (`/welcome-alt/voice`, see « Une voix par réseau »). The skip dialog and its feedback key stay,
for the chat onboarding (flag OFF).

⚠️ A surface that merely _lists_ profiles is out of scope on purpose — it renders its empty list.
But a surface that makes the user _pick_ one must never render an empty picker: that is a silent
dead end, which is the exact failure this feature removes. Top Posts was gated for that reason after
it was seen doing it.

The same shape serves the first image's look (2026-10-16, `requireImageLook` in
`draft-image-flow.js`): a Playbook with no image look is asked once, in the chat, the first time a
draft's Generate an image runs — then the image is made and every later click is direct. Not now
still makes the image, in a ready-made look. It is not a gate, and not the per-click questions
removed on 2026-10-08.

## The listening config left the Playbook

The magazine kept it as `ctx.topics`. It now lives in `topic-feeds-store.js`, keyed by Playbook: **one feed per Playbook**, provisioned lazily on read (`provisionMissingFeeds`), so a brand new to the app never meets a screen asking it to configure something first — and nothing can _delete_ a feed, since the next read would rebuild it.

Which feeds listen and how often answers "what job should Archie run?", not "who are you?" ([`CONCEPTS.md`](CONCEPTS.md) §1). Data stays per Playbook; only its owner changed. It also buys `websites` — one feed's scan list, which has no place on a fiche whose `websiteUrl` is the brand's canonical address.

## The Playbook scope — `?pb=` by default, a workspace behind `playbookWorkspace`

The fork introduced `active-playbook.js`: a global, `localStorage`-persisted Playbook scope written to by a select sitting in the feed's own filter bar — so a control that promised a page filter silently re-scoped the sidebar, the next new chat and the composer's picker. That version was **deliberately not ported**, on one condition stated at the time: _don't reintroduce a global scope without a permanently visible switcher — a scope that hides is only safe while it is legible._

**Behind `playbookWorkspace` (default OFF), that condition is now met and the scope IS the model.** A Playbook is the level above the work, not a field on it: one is active at all times, chosen from the switcher under the wordmark in the rail, and everything below it belongs to that brand — the chat list, a new chat, the Topic Feed and its count, Insights, the studios' drafts. The six pickers that each asked the question separately (the composer's select, the feed's toolbar select, `/topics/settings`' own, the batch / clip / repurpose selects) are **gone**, not disabled: a greyed-out field restating what the rail prints permanently is chrome the reader has to rule out, and next to a live control it reads as something broken. Every host absorbs the loss on its own (`flex-end` commit rows, `margin-left:auto` on Send), and the Insights title stops being a picker because the rail is the door now. Where a page would otherwise stop naming its brand, an existing **live** control picks the name up — `/topics/settings`' "Open the Playbook" link becomes "Open Acme · Q2 marketing".

**Two levels, and the switcher is the seam.** Inside a workspace every surface is one brand's. The CATALOGUE of brands — and any other brand's fiche opened from it — belongs to the level above, so those routes step out of the shell: `isAccountScope(path)` (same module) drives `body.account-scope`, layout.css hides the rail, and the topbar keeps only the way back in ("‹ Back to Acme · Q2 marketing" from the catalogue, "‹ Back to all playbooks" from a fiche). It is the mechanism `body.onboarding` already used, not a new one. Consequences worth knowing before touching either surface:

- **Insights' page head is the flag's too.** Flag ON, `/insights` drops its brand
  band entirely — the rail names the Playbook one row above the topbar's own
  title, so a band re-printing it spent the top of the page on what the chrome
  already said — and **`Objectives` becomes the page title** (`pageTitle()` in
  the screen's `pieces.js`, at the rung the brand name held). Cockpit's rail
  head takes the same word, since a column of three counts and no noun says
  nothing. Flag OFF the band stays: there, the brand name in it is the app's
  only Playbook switcher.
- **The rail's row is singular.** `Playbooks 8` — a count of every brand, in a rail that promises one — became **`Playbook`** → `/playbook/<active>`: the fiche of the brand you are in, which is both in scope and the frequent destination. The list moved to the switcher's footer ("All playbooks" → `/home`), the only control that announces it changes scope. `workspaceNav()` in sidebar.js does that swap.
- **The wordmark is the account's door.** In workspace mode it opens `/home`; flag OFF there is no level above the work, so it keeps minting a chat — and `[data-sidebar-new]`, which shares its handler branch, keeps that job in both modes.
- **The active brand's own fiche stays IN the workspace** — chrome, the rail row lit. Only cross-brand routes leave. That is the whole rule: the chrome follows the object's scope. Its topbar leads with a back arrow to the catalogue (Playbook 2.0: the DS Top bar pattern's icon back, the title staying in the fiche's own header by exception; flag OFF: "‹ Back to all playbooks"), like every other fiche: a bare `Playbook` title repeated the rail row and the h1 and pointed nowhere (the user's call, 2026-09-30, over the earlier no-crumb rule). Staying in the workspace is the rail's job, not the topbar's.
- **On the home, a Playbook card IS the workspace.** Clicking it switches to that brand and opens a fresh chat in it (`?contextId=`, not `/` — the home is a launcher, so the gesture is "start", not "resume"); the fiche keeps the pen, with the other hover verbs, and the active card reads `Current`. ⚠️ This reversed the opposite arbitration one commit earlier — body opens the fiche, a small `Switch` link carries the scope move — argued from a mis-click's asymmetry. The user's call; what makes it safe is that nothing is lost (the new chat is empty, the crumb goes back, the brand you left is one card away), and the `Switch` link went with it as a second control for what the whole card now does. Flag OFF the card still opens the fiche.
- **`/` is the one definition of "this brand's home"** — a redirect to the most recent chat IN SCOPE, else a fresh one (dashboard.js reads `scopeSessions`). The rail's switcher, the catalogue's Switch and the topbar's way back all navigate there rather than each computing a destination. `/` is the **brand's** home and `/home` the **account's**: two levels, two homes, and neither renders the other's list — `/` still renders nothing at all.
- **A switch re-points the surface it was made from.** From a chat → `/` (above). From the active brand's own fiche → `/playbook/<new id>`: what the reader has open is "this brand's Playbook", not that one brand, so it follows the switch the way `/topics` and Insights follow it. `switchPlaybook()` answers that BEFORE calling `setActivePlaybook` — a moment later the path's id is no longer the active one. Leaving the fiche alone was worse than a stale page: `isAccountScope()` would call it another brand's fiche while `body.account-scope` (only written on a route change) still said workspace, so the rail named one brand above another's sheet. Everywhere else — no brand in the URL — the scope notify repaints in place.

Three rules hold it up:

- **The flag short-circuits in ONE place.** `isWorkspaceMode()` / `playbookForNewWork()` / `scopeSessions()` in [`active-playbook.js`](../../src/active-playbook.js) are what every surface reads — the same arrangement as `playbook-access.js` and `playbookSharing`. Flag OFF is byte-for-byte the per-chat model: `?pb=` on the feed and its settings, `getDefaultContext()` for new work, a selectable composer pill on a fresh chat.
- **A chat still keeps its own Playbook** ([`CONCEPTS.md`](CONCEPTS.md) §2). It inherits the active one at birth and never changes — so switching brand does not rewrite what a chat produced. It also means the chat you are reading can fall outside the new scope, which is why a switch made from `/session/*` lands on that brand's most recent chat (or a fresh one).
- **There is no "All playbooks" inside a workspace, and the account home is unfiltered.** A scope HIDES: anything outside it is invisible rather than empty, so cross-brand views are the price — an "All" row in the rail would turn the guarantee back into a filter. The exception is the one surface whose whole subject is the brands you are NOT in: `/home`, where both its lists are cross-brand — the catalogue the switcher picks from, and every chat with its brand named in a column. `search-modal.js` (⌘K) already read `getSessions()` unscoped, so this makes an existing cross-brand read legible rather than adding one. Opening a chat from there **re-scopes** to that chat's brand, for the same reason `/` exists.

⚠️ Don't re-point a surface at `getDefaultContext()` or add a `?pb=` producer without going through those three functions: two scopes that can disagree is the exact failure this replaced.

## One article, three hosts

`topic-article.js` is the render engine — `renderTopicHeader` + `renderTopicArticle` + `renderTopicActions`, pure functions, no DOM and no listeners, the same shape as `playbook-view.js` and `connectors-view.js`. The feed's pane, the picker's dialog and the in-chat dialog all call it, so there is exactly one article.

The identity is its own renderer because the two hosts **compose** it differently: the pane keeps `renderTopicHeader(topic, {withActions: true})` outside its scroller — title, source and the two verbs, all fixed, and **no Close**: a two-pane reader closes a message by opening the next one, and the list is right there, so a button spent the header's best slot on what the layout already does. Escape closes the pane, wired by the host and removed in teardown. While the dialog renders the same header inline and keeps its verbs in a sticky footer against its bottom edge. Placement is the host's; what the identity and the verbs SAY is not, which is the whole point of rendering both from one place. ⚠️ The pane used to keep only the VERBS up there, with the title below them inside the scroller: the actions had no subject on screen and scrolling took away the line naming what they act on. A second copy for the dialog is how a card and the thing it opens end up saying different sentences about one Topic. `topicTitle()` is the matching rule for titles: the article's own title wins, `headline` is only the fallback for a Topic with no article yet.

`topic-card.js` emits the same object in TWO shapes — the feed's card and the picker's card, identical part for part — both carrying `data-topic-read`, so a host wires them once. The new chat's Fresh-topics grid renders the picker's card too, with `withUse: true` adding the verb on the card face: the body still opens the article, and the button is the second door for a reader who already knows. ⚠️ There was a third shape, `renderTopicRow`, for the hero; six full-width rows ran ~500px and pushed the workflow starters off the fold, so the hero took the card and the shape count went DOWN.

## The master–detail: the list SHRINKS

Non-negotiable, because getting it wrong is what broke this feature on the fork. There the list was pinned at 666px and the pane took the leftover, so under ~1180px of **content** width a container query dropped the article below the list — at 1440px of viewport (a 14" laptop, sidebar included) clicking a card rendered the article 1900px below the fold and nothing appeared to happen. Here the pane is the fixed half — `flex: 0 1 calc(var(--topic-measure) + 2 * var(--ref-spacing-md))`, so exactly the prose measure and never a pixel of dead white space — and the list is `flex: 1 1 0` with a 340px floor, absorbing whatever is left. Side by side survives to 760px of content width. The page cap (1132px) is `calc()`'d from the same two `:root` variables, so it cannot drift from the measure the way the hand-written 1440 did. Below that it stacks and opening an article **scrolls it into view** — arithmetic, not `scrollIntoView()`, whose `nearest` declines to move a pane taller than the scrollport and whose `smooth` loses the race against the next repaint.

The split is measured with a **`@container` query on the row**, never a media query: the sidebar collapses and the right panel overlays, so viewport width never tells you content width.

## Two verbs, and only two

**Use in chat** (`topic-flow.js`) marks the Topic **Used**, then opens a **new** chat with it attached as a Source via `addReadySource` — so Extract ideas, Draft, Ask and the Sources panel all light up with no new plumbing and no special case. The mark lands _before_ the chat opens, in one place, so the three surfaces that navigate (feed card, feed article, hero card) mean the same thing. No echo message and no question picker on arrival: the source-intake card already names the Topic.

**The composer's "Pick from the Topic Feed" is the one INLINE exception** (`startTopicPickerInline`): it runs in the chat the reader is already in, the same shape as "Top performing posts" — one Archie line, then a single-select **widget turn** (`renderTopicsWidget`, radio cards of the feed's draft-ready Topics, newest first, max six), and **Use this topic** marks it Used, attaches it to _this_ chat via the same `attachTopicToChat`, then offers a next-steps Quickpicker (Extract ideas / Draft a post / Ask about it). Every neighbour in the Add menu acts in place; a Topic that opened a second chat was the one item that took the reader away from the chat they had just asked to add to. ⚠️ The dialog's LIST view that used to back this entry point was deleted with it (`git log -S renderListView`) — `topic-picker-modal.js` now opens on the article only.

**Ignore** opens `topic-ignore-modal.js` and asks why. The reason is the only thing a reader ever _tells_ Archie about the listening, and it is what makes the Ignored state readable afterwards — the card prints it back. It is `stroked grey`, not red: ignoring hides a Topic that ticking Ignored brings straight back. Reversible via the toast's Undo, which also **clears the reason**. ⚠️ The fork's "Don't show this again" checkbox is not ported — it turned Ignore into a one-click action with no reason, contradicting the same feature's promise that the reason is kept.

## The Clips space: the video first, one editor

Flag `clipsSpace`, 2026-10-26, asked as "rethink it whole, not the screens under one menu item". **The object is the Video**, in the Playbook's library and outside any chat (CONCEPTS §3, fourth exception): a video is worked before any post exists. **The order is prod's** — the analysis starts on upload, the options of the whole video (format, subtitles, CTA) come after the clips are picked; a setup screen before the analysis was proposed and turned down for that reason. **A clip's range is fixed once it exists** (2026-10-29, like prod): it is set by the analysis or by « Add a clip », whose dialog asks Start and End; the editor shows the edges' times but never retrims — no Start / End clip here, no I / O keys, no handles, no sliding the clip. Don't bring trimming back in the editor. **There is one clip editor**: the modal's format, prod's subtitle editor, the video-editor playground's text, cleanup and brand template, and the crop editor's reframing are tools of the same surface, on one timeline. **No conversation in the space**: Archie works (moments, framing, subtitles, captions), you correct. A chat keeps its clips and opens them in the space ("Open in Clips"); the Clip Studio and the modal stay untouched while the flag is OFF. The brand's clip look (subtitle preset, logo, intro/outro) is identity, so it sits on the Playbook (Branding), read by the editor, never written by it. **The space is light** (2026-10-26): a dark mode — the whole space, then the Video Clips modal — was built and then removed. The space is the Agorapulse DS as it exists, with its components; only the footage sits on a black well, the way every player shows it. One exception, asked for (2026-10-26): the project page's stage — the area around the open clip and its details card — is the DS's darkest surface (`grey-150`), like a viewer; the list, the bars and every other surface stay light. One `primary orange` per screen (the action that ends it), destructive actions behind the confirm modal, a rename through the rename modal. **The reframe is what prod can render** (platform#87544, merged 2026-10-26): no Follow the speaker (on beta it panned onto the largest face, not the framed person), no "apply to every shot of a camera", faces never shown nor clicked, no zoom slider — a window zooms from its corners, and in Two each window has its own zoom — no colour per camera on the track (blue is for interaction), Swap only in a portrait format, and a new format re-crops from the auto framing (a confirm first when the framing holds edits). Don't bring those back in the proto ahead of prod. **Writing the posts follows prod's process** (`set_clip_options` → the account picker → the render job → the posts): the format and the subtitles before the render — set before step 2 (the video's look under « All clips » in the project's top bar — the video is the page's object; a clip's own in its panel or the editor), where the previews show them, and only summed up by look at step 2 (selects there rewrote the video's look after the fact and were wrong for clips with their own) — no format per network; then the CTA, then the accounts, none ticked at first; the run shows prod's two stages (render, then write). The one place this repo differs: with no account connected, the step offers the connect cards (asked in the flow) where prod stops.

## The DS ports live in ds-patches.css

`.ap-filter-dropdown` is a **transcription of an Angular-only DS component** from its own SCSS — it does not exist in css-ui, so this is the missing-primitive case `ds-patches.css` is for, and the day it lands in the DS the block is a delete. It is the component the DS's own tie-breaker prescribes: grouped options behind a trigger → filter dropdown (not filter chips, which is right for a small flat always-visible set — what the magazine correctly used for its six sources).

⚠️ `.ap-segmented-control` was ported here for `/topics`' two-view switch and was **deleted** from there — it was the wrong component (the product uses TABS for that shape, and only one list was ever on screen). Then the `.ap-tabs` that replaced it went too. The `kind` axis (To review / For later) it carried now lives as the **Topics multi-select** inside the Filters panel — empty by default so both lanes show in one list, ticking a lane to narrow. `git log -S renderTabs` has the tabbed version, `git log -S ap-segmented-control` the one before it, `git log -S renderKindRadio` the one-lane radio between them. Don't re-port a page-level lane switch without a genuine 2–4 co-visible-views case — the select-in-panel is the answer here. The port itself is **back** in `ds-patches.css` (2026-09-29) for a different job, the Image Generator's Variations picker (1 · 2 · 3 · 4): a short set of values, all visible, one picked. That is its use; switching pages or lanes is still tabs.

Every token substitution is commented with the value it stands in for, because the `--sys-color-*-interactive-*` family, `--sys-height-control` and `--sys-radius-inner` are **not published yet** (absent from ui-theme 22.0.17). Re-point them the day they land. ⚠️ The `--selected` double dash is the component's own — the DS wrote it that way against its own flat-modifier convention, and a port that "fixed" it would stop matching what it ports.

## Une voix par réseau : une seule règle partout

Behind `voicePerNetwork`. Revu avec l'utilisateur le 2026-10-27 (« tout a l'air très compliqué ») après une journée de demandes empilées ; ce qui suit est ce qui a été tranché, et ce qui a été retiré en route — ne pas le reproposer.

**Tranché :**

- **La default voice, pas la « Brand voice ».** C'est la voix d'origine du Playbook, la première, celle de tous les réseaux ; « Brand voice » ne disait rien. Renommée partout dans l'UI.
- **La default voice est générique, liée à aucun réseau** (2026-10-28, après-midi) — chaque réseau en est une déclinaison, y compris celui d'où le Playbook a été créé ; on la décline par ses règles (posts, document, questions, à la main) ou sans source, **Adapt for X**. Revient sur le choix du matin même (« la default voice est celle du premier réseau », onglet « LinkedIn · Default »), à la demande : « j'ai besoin d'une voice générique, non liée à un réseau, et de pouvoir après la décliner pour des networks ». On ne la nomme pas « generic voice » à l'écran : « Too generic » est déjà un motif de feedback. ⚠️ Retiré (toujours) : la case « Learn N voices » qui apprenait tout d'un coup ; retiré cette fois : l'onglet « LinkedIn · Default » et `defaultNetwork`.
- **Un seul état « default »** pour un réseau sans voix à lui. `borrowed` (jamais réglé) et `plain` (« Use the Brand voice as it is » choisi) étaient deux états pour la même chose vue de l'utilisateur ; seul reste `chosen`, pour ne pas reposer la question.
- **Les mêmes choix partout** — posts · document · questions · edit (+ default voice quand un draft attend). Avant : quatre jeux différents selon le chat, Clips, la fiche et l'intro.
- **Apprendre propose, l'utilisateur dispose.** Ce qu'Archie apprend est montré puis **ajouté au Voice profile** (seul moment où c'est enregistré) ou **édité** dans le Playbook. Avant : la voix était écrite dès l'apprentissage, et « valider » ne voulait rien dire.
- **Après « Edit in the Playbook », le flux ne reprend pas tout seul** : on redemande à Archie.
- **Une voix qui change ne réécrit pas les drafts** — ils le disent (status card « The X voice changed… » + Rewrite it). Pas de réécriture automatique, même depuis « Give X its own voice ».
- **« Optimize it » renommé « Add rules for X »** (puis « Add a voice for X », 2026-10-29) : optimiser n'est jamais un bouton (une voix est apprise ou éditée), le mot contredisait la règle.
- **On n'« apprend » pas une voix, on ajoute des règles au Voice profile.** Archie propose des _rules for X_ par-dessus la default voice ; l'action est _Add to Voice profile_. « 1 voice learned », « Use this voice », « Give X its own voice » ont été retirés (2026-10-27).
- **L'étape Voice du chat est un bloc dans la conversation**, pas le Quickpicker : elle explique ce qui manque et guide avec des tuiles (la recommandée en tête). Exception assumée à la règle « question in-chat = Quickpicker » — c'est une décision à expliquer, pas une question à choix.
- **Le feedback d'un draft peut mettre à jour la voix** — seulement s'il parle d'écriture, et comme une proposition.
- **L'onboarding : le dialog seul** (+ l'infobox de la fiche), pour les utilisateurs existants ; le dialog en trois temps est gardé tel quel.
- **« Voice for X », pas « Rules for X », partout** (2026-10-29 : d'abord la review Voice, puis, à la demande, le chat, la fiche, les dialogs et le glossaire — un mot, voice, pour une chose ; les éléments d'une voix restent des « rules ») ; une seule question (voix par défaut ou voix à elle, sur les réseaux des comptes connectés), et une voix de réseau commence **vide** : rien n'est appris en silence depuis les posts, c'est l'utilisateur qui la remplit (posts, document, questions, adaptée, à la main).
- **Le réseau principal : essayé puis retiré** (2026-10-28 → 2026-10-29). Demandé d'abord au premier écran, puis dans la revue Voice (« Your main network », radios), il a été retiré à la demande (« enlève ça ») : il n'apportait qu'un ordre. Ne pas le reproposer ; `mainNetwork()` est supprimé. La voix a **sa propre phase** : d'abord un écran après la source (2026-10-28), puis, à la demande (« séparer + fortement la Voice et le Playbook », 2026-10-29), **sa propre review en cards**, après celle du Playbook qui ne la contient plus (`/welcome-alt/voice` : Default voice, puis Network rules). Séparée dans le run seulement : les données restent sur le Playbook, la fiche garde son onglet Voice. Le même jour : des règles **pour les réseaux qu'on choisit**, aucun par défaut (avant : la même voix partout ou des règles pour tous), et les façons de remplir une partie (posts d'un compte, document, questions, default voice adaptée) en tuiles dans ses cards, à droite — essayées d'abord à gauche, déplacées le même jour ; les règles d'un réseau s'éditent dans la review.
- **Un nouvel utilisateur donne ses règles dans la review de création** (2026-10-28) — d'abord le choix d'en avoir ou non (The same voice everywhere · Rules for each network), puis une carte par réseau sous la default voice, une décision par carte, pas une intro ni une case « tout apprendre ». Un réseau laissé sans réponse n'a **pas** la default voice posée d'office : son premier draft demande (l'étape Voice du chat). Avant, la création la posait en silence, elle comptait comme choisie, et un nouvel utilisateur ne voyait jamais le modèle. La fiche ne porte **plus** ce choix (2026-10-29, « c'est incompréhensible le bloc en bas là, et pas nécessaire ? », puis l'audit ux-heuristics) : un radio ne peut pas dire un état mixte et il était en bas de page ; à sa place, l'état de chaque réseau se lit dans la **liste des voix** à gauche de l'onglet (la colonne de nav secondaire DS, recette O4 : Default voice · un réseau par ligne, _Follows default_ sur ceux sans voix à eux). Une rangée d'onglets de voix sous les onglets de la page, puis une carte Your networks, ont été essayées le même jour et retirées (« on peut pas avoir des tabs et en dessous de nouveau des tabs ») : ne pas remettre d'onglets dans un onglet. La voix d'un réseau sans voix à lui n'a qu'une action, Add a voice for X (Learn from… et Edit s'y lisaient comme des modifications de la default voice ; l'avertissement offre Keep the default voice). Un réseau gardé sur la default voice par choix n'est plus averti, et un réseau avec ses règles peut revenir à la default voice (confirmé).

**Retiré (ne pas reproposer) :**

- Un bouton « Optimize for X » / « Optimize the Brand voice », « Re-optimize » et l'état **stale** d'une voix de réseau quand la default voice change.
- La ligne « Written in the LinkedIn voice » sous un draft (un draft dans la voix de son réseau ne dit rien).
- La **comparaison** « le même post dans chaque voix » dans le chat et dans la review de création, et le post avant / après sous une voix apprise.
- L'intro dans la review de création : un nouvel utilisateur n'a pas connu l'app avant.
