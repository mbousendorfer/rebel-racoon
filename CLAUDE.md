# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Interactive prototype for exploring and validating Agorapulse UI redesigns — specifically **Archie**, an AI content assistant (sources → ideas → drafts → schedule). No build step, no bundler — static ES modules served locally. The codebase mixes English (code, UI copy) and French (some comments). Archie speaks in the first person ("I", "Let's") — never third-person "Archie" — in user-facing copy.

## Before you build a feature — read the docs

`docs/` is not background reference: it records decisions that were argued, shipped, and in several cases **reverted**. Designing here without reading it means re-proposing something that was already tried and removed — which is the single most common failure mode on this repo.

**Whenever a request adds, moves, or changes a feature** — a screen, a section, a field, a control, a flow — read these BEFORE proposing anything:

1. **[`docs/reference/CONCEPTS.md`](docs/reference/CONCEPTS.md)** — what each object IS and where its boundary sits. It settles _"which entity does this thing belong to?"_, the question most rejected designs here got wrong.
2. **[`docs/reference/FEATURES.md`](docs/reference/FEATURES.md)** — the § covering the surface you're touching, so you extend what exists instead of building a parallel version beside it.
3. Then the doc for the dimension in play:

| You're touching…                      | Read                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| a Playbook field or section           | [`CONCEPTS.md`](docs/reference/CONCEPTS.md) §1 + [`FEATURES.md`](docs/reference/FEATURES.md) §9           |
| any HTML/CSS                          | [`DESIGN-SYSTEM.md`](docs/reference/DESIGN-SYSTEM.md) + [`UI-PATTERNS.md`](docs/reference/UI-PATTERNS.md) |
| a new route or screen                 | [`ROUTES.md`](docs/reference/ROUTES.md) + [`ARCHITECTURE.md`](docs/reference/ARCHITECTURE.md)             |
| state that has to live somewhere      | [`STORES.md`](docs/reference/STORES.md)                                                                   |
| user-facing copy                      | [`copy-principles.md`](docs/copy/copy-principles.md) + [`GLOSSARY.md`](docs/reference/GLOSSARY.md)        |
| sidebar / right-panel sizing behavior | [`PANEL-SIDEBAR-RULES.md`](docs/reference/PANEL-SIDEBAR-RULES.md)                                         |

Then say, in the proposal itself: **which object the feature attaches to, and why it belongs there** rather than on a neighbour. If a doc contradicts what you were about to build, the doc wins until the user overrules it — and when the user does overrule it, update the doc in the same commit.

**The three arbitrations that keep coming back** (each already cost a revert):

- **A settings surface must not aggregate** — config lives on the entity that owns it, or on a route scoped to one feature. Never a global settings page (§ below).
- **A Playbook is an identity sheet, not a container** — no produced content, no metrics, no operational config ([`CONCEPTS.md`](docs/reference/CONCEPTS.md) §1).
- **Never invent a component, token, or icon the DS already ships** (§ Design System).

## Running the prototype

```bash
npm install   # installs the DS packages and syncs ds/ via the postinstall sync-ds script
npm start     # runs `npx serve -p 8000` — open http://localhost:8000
```

With Claude Code the dev server auto-launches via `.claude/launch.json` (server name `archie`, runs `python3 -m http.server`). There is **no test suite**; verify changes by running the app (see the verify/run skills) and the `ds-css` MCP `validate_css`.

## Architecture

**Vanilla JS only** — no build step, no bundler, no framework, no external runtime deps. A hash-based router (`src/router.js`) renders the matched route into `#app` on every `hashchange`. The persistent app shell (sidebar + topbar + right panel) lives outside `#app` and is updated by subscriptions. Each screen, modal, and component owns its own DOM and uses **pure event delegation** with `data-*` attributes.

### App shell

`index.html` is the only HTML entry point (~50 lines). It mounts the shell — `#sidebar`, `#topbar`, `#app`, `#toastRegion` — and loads every stylesheet + `src/app.js`. `app.js` registers the routes, calls each component's `init()` (which injects that component's DOM into `<body>` once), and calls `start()`. The right panel and all modals inject themselves on `init()`.

### Routes (declared in `src/app.js`)

| Route                | Screen                 | Notes                                                                                                                                    |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | `dashboard.js`         | Redirect by default (first-time → `/welcome-alt`, returning → most-recent session); with `frontPage` + `topics`, Archie's **front page** |
| `/session/:id`       | `session.js`           | The main chat surface (largest file); hosts the assistant thread, composer, and per-session flows                                        |
| `/contexts`          | `contexts.js`          | Standalone **Playbooks** library (cards + edit)                                                                                          |
| `/playbook/:id`      | `playbook.js`          | Playbook detail page (topbar back → `/contexts`)                                                                                         |
| `/connectors`        | `connectors.js`        | Connectors gallery (marketplace); detail opens in a modal (gated by the `connectors` flag)                                               |
| `/topics`            | `topics.js`            | **Topics** — the listening section: lead story + grid, across every Playbook (gated by `topics`)                                         |
| `/topics/settings`   | `topics-settings.js`   | **Topics settings** — the six listening sources + cadence for one Playbook (`?pb=`); topbar back                                         |
| `/welcome-alt`       | `welcome-alt.js`       | First-time onboarding kickoff (thin redirect into a transient session)                                                                   |
| `/welcome-alt/recap` | `welcome-alt-recap.js` | Onboarding recap reveal of the built Playbook                                                                                            |

There is **no `/settings` route** — it was removed. The prototype Admin controls (user mode + feature flags + docs link) now live in the sidebar footer cog popover (`admin-menu.js`, rendered by `sidebar.js`); the old Social-accounts page was dropped (`social-profiles.js` remains as a shared helper).

`setAfterRender` (in `app.js`) re-renders the sidebar + conversation-status-card after every route change and toggles the `body.onboarding` full-bleed class for the welcome-alt flow.

> **Vocabulary:** a saved AI context is a **Playbook** (UI label) but the code/store calls it a **Context** (`contexts-store`, `contextId`). Source → Idea → Draft (post) → Schedule is the content pipeline; a **Topic** (`topics-store`, flag `topics`) is an optional step upstream of it. `topic` stays banned as a synonym for **Idea** — a Topic is its own object.

### Source layout

```
src/
  app.js                — entry: imports + route table + init() calls + start()
  router.js             — hash router (route() / navigate() / getPath() / start())
  url-state.js          — parseHashParams() / setHashQuery() (hash query params)
  handoff.js            — single-use sessionStorage bridge across navigations
  utils.js              — html`` / raw() tagged-template helpers + escapeHtml (html`` escapes by default)
  store-utils.js        — createNotifier() subscribe/notify primitive used by stores
  user-mode.js          — "returning" vs "new-alt" mode (localStorage: archie-user-mode)
  feature-flags.js      — flag get/set (localStorage); ff-catalog.js is the flag list
  org.js                — CONFIG: who I am, my org, its members, my role (localStorage: archie-org-role)
  playbook-access.js    — who may view/use/edit/share a Playbook; the store never filters
  file-kinds.js         — source kind → DS icon class
  mocks.js              — ALL seed data (sessions, contexts, sources, ideas, posts,
                          connectors + connectorDocs, social accounts, threads, prefs)
  image-studio.js       — Image Studio state engine (UI-agnostic) + all its mocks
  image-studio-canvas.js — pure canvas helpers: bake / crop / text metrics

  # Stores (per-session Map + subscribers, seed from mocks unless new-alt mode)
  sessions-store.js     — chat sessions list (pin / rename / delete)
  contexts-store.js     — Playbooks (Contexts)
  connectors-store.js   — connectors list + connection state (the only "catalog" store)
  library.js            — per-session ideas; getSources() delegates to sources-stream
  posts-store.js        — per-session drafts
  assistant.js          — per-session conversational thread (turns, reasoning chips, MCP query)
  sources-stream.js     — sources PER SESSION + global uploads + processing state machine
  schedule-store.js     — scheduled-post queue (calendar)
  topics-store.js       — GLOBAL listening dossiers + the mock scan (flag `topics`)
  topics-feed.js        — shared magazine render engine (lead + grid + section chips)
  topics-catalog.js     — the six listening sources + cadences (CONFIG, like ff-catalog)
  composer-mentions.js  — per-session @mention pills in the composer
  composer-connector.js — composer's "Connected sources" submenu (feature-flagged)

  # Conversational flow orchestrators (drive the assistant thread + pickers)
  start-flow.js         — action-picker intro for an existing-Playbook chat
  draft-flow.js         — "Draft post from idea" turn sequence (channel pick → execute → result)
  draft-rewrite.js      — regenerate-a-draft (thinking → streaming → commit)
  context-builder.js    — Playbook creation/edit conversation (drives welcome-alt + edits)
  playbook-view.js      — shared Playbook render engine (recap + detail)
  context-mock-analysis.js — deterministic mock "website analysis" for onboarding
  sidebar-wizard.js     — multi-stage numbered-option wizard inside the assistant panel
  inline-question.js    — one-shot numbered-option picker inside the assistant panel
  library-actions.js    — shared bulk-bar (Extract/Delete) + click dispatch for content lists
  social-profiles.js    — connected social accounts (source of truth for profile pickers)
  clip-formats.js        — video aspect-ratio catalog
  connectors-view.js    — shared pure render helpers for the connectors gallery + detail
  connector-ask.js      — launches the in-chat "Ask a connector" flow (gallery + right panel)
  topic-flow.js         — a topic opens a chat with itself attached as a Source

  # Studios (full-panel takeovers) + newer surfaces (not exhaustive — see docs/reference/FEATURES.md)
  batch-studio.js       — batch-of-posts studio (upload/analyse → review)
  clip-studio.js        — full-screen video clip extraction + editing studio
  top-posts-flow.js / top-posts-store.js — published-posts "winners" board + repurpose entry
  folders-store.js      — save-to-folder store; feedback-store.js — feedback submissions
  languages.js          — language catalog for multilingual Playbooks
  url-services.js       — recognises a service (Notion/Google Docs/…) from a pasted URL
  admin-menu.js         — sidebar cog Admin popover (user mode + feature flags + docs)

  screens/
    dashboard.js, session.js, ideas.js, contexts.js, playbook.js,
    connectors.js, topics.js, topics-settings.js,
    welcome-alt.js, welcome-alt-recap.js
    _analyse-common.js  — shared "chat bubble + numbered picker bar" wizard primitives
    session/
      intake-lifecycle.js — flips source-intake turns loading→ready as sources process
      thinking-chip.js    — animated "thinking…" composer chip + elapsed/credit counter
      thread-turns.js     — renders each assistant-thread turn type
      wizard-keyboard.js  — keyboard nav (↑↓ / 1–9 / Enter / Esc) for the picker

  components/             — each exports init() (injects DOM once) + render/open()
    topbar.js             persistent header: route title (rename on session) +
                          Sources / Ideas / Drafts pills + status-card toggle; back on /playbook
    sidebar.js            left rail: brand, New chat, Search, Playbooks / Connectors / Topics nav,
                          recent chats (pin/rename/delete + Sort & group), footer popmenu (feedback/bug/shortcuts + Admin menu)
    right-panel.js        sliding panel — modes: drafts / ideas / sources / clips / context-brief
    conversation-status-card.js  floating in-progress card (sources/ideas/drafts counts)
    content-workspace.js  shared Sources+Ideas library layout (search / sort / By Source / All Ideas)
    source-card.js, idea-card.js, idea-card-compact.js, post-card.js, clip-card.js, empty-state.js
    topic-card.js         one listening dossier, in three sizes (grid / lead / hero rail)
    social-post-card.js   someone ELSE's published post, as evidence (not top-post-card)
    toast.js              showToast() snackbar (DS .ap-snackbar)
    shortcut-legend.js    ? key dialog
    # Modals (init → open → close, coordinated by modal-coordinator.js):
    add-source-modal.js   Upload / URL / Connectors tabs
    connectors-modal.js   connectors gallery + detail overlay (from composer Add / Sources panel / page)
    topic-modal.js        one dossier read end to end — 720px, prose measure
    video-clips-modal.js, schedule-modal.js,
    bug-report-modal.js, feedback-modal.js, chat-picker-modal.js,
    confirm-modal.js, rename-modal.js, search-modal.js,
    share-playbook-modal.js  personal ⇄ org scope + owner + change log (flag)
    image-studio-v2/      the Image Studio, split by subject (see FEATURES §7):
                          index (lifecycle) · events · commit · inline-text · prompt-guard ·
                          stage-view · composer-view · settings-view ·
                          references-view · branding-view · tools-view ·
                          edit-view · interactions · context

  modal-coordinator.js    one-overlay-at-a-time: requestOpen / notifyClose / bindOverlayDismissal
```

### State management

**No external store library.** Stores follow one pattern: a module-level `Map(sessionId → state)` (or a single array for catalogs) plus a `Set<fn>` of subscribers notified shallowly on each mutation, built with `createNotifier()` from `store-utils.js`. State seeds lazily from `mocks.js` on first read — **or stays empty in `new-alt` mode** (`isNewUser()`).

| Store                  | Domain                                                                                 | Key public API                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions-store.js`    | chat sessions                                                                          | `getSessions`, `getSessionById`, `updateSession`, `deleteSession`, `togglePin`, `subscribe`                                                                                                                    |
| `contexts-store.js`    | Playbooks (+ `ownerId`/`scope`/`history` behind `playbookSharing`) — **never filters** | `getContexts`, `getContextById`, `getDefaultContext`, `addContext`, `updateContext`, `duplicateContext`, `deleteContext`, `appendHistory`, `subscribe`                                                         |
| `connectors-store.js`  | connectors catalog + state                                                             | `getConnectors`, `findConnector`, `getConnectedConnectors`, `setConnectorStatus`, `subscribe`                                                                                                                  |
| `library.js`           | per-session ideas (sources delegate to sources-stream)                                 | `getSources(sid)`, `getIdeas(sid)`, `appendExtractedIdeas`, `injectIdeasForSource`, `extractVideoIdeas`, `removeIdeas`, `subscribe(sid, fn)`                                                                   |
| `posts-store.js`       | per-session drafts                                                                     | `getPosts(sid)`, `addPostDraft`, `updatePostContent`, `attachImageToDraft`, `attachCarouselToDraft`, `removePost`, `subscribe(sid, fn)`                                                                        |
| `assistant.js`         | per-session thread                                                                     | `getThread`, `sendMessage`, `sendConnectorMessage`, `postAssistantMessage`, `postSourceIntake`, `postExtractionResult`, `postAssistantChoice`/`submitAssistantChoice`, `postDraftResult`, `subscribe(sid, fn)` |
| `sources-stream.js`    | sources **per session** + global uploads state machine (uploading → processing → done) | `getSources`, `getUploads`, `subscribeSources`, `subscribeUploads`, `startFileUpload`, `startUrlImport`, `startConnectorImport`, `extractClipsForSource`, `removeSources`, `renameSource`                      |
| `schedule-store.js`    | scheduled-post queue                                                                   | `getQueue`, `getQueueOn`, `addToQueue`, `busyCountsByDay`, `subscribe`                                                                                                                                         |
| `composer-mentions.js` | per-session composer mentions                                                          | `addMention`, `removeMention`, `renderInto`, `subscribe(sid, fn)`                                                                                                                                              |
| `topics-store.js`      | **global** listening dossiers + the mock scan (flag `topics`)                          | `getTopics`, `getTopicById`, `getUnseenCount`, `markSeen`, `dismissTopic`, `restoreTopic`, `refreshTopics`, `maybeAutoScan`, `hasMoreToScan`, `topicWhen`, `subscribe`                                         |

**Per-session** stores: `sources-stream` (sources — `Map(sessionId → Source[])`, per-session subscribers, `clearSession()`), `library`, `posts-store`, `assistant`, `composer-mentions`. That's the model: what a user brings into a chat belongs to that chat ([`docs/reference/CONCEPTS.md`](docs/reference/CONCEPTS.md) §3). **Global** are the catalogs, legitimately — they pre-exist any chat: `contexts`, `connectors`, `folders`, `sessions`, `schedule`, `top-posts`, `topics` — plus `sources-stream`'s **uploads**, a transient pre-source pool the Add-source modal reads as a whole. `library.js` subscribes to sources-stream and re-emits per-session so any session's content surfaces repaint when a source lands. **No localStorage persistence of app state** — only `archie-user-mode`, the feature-flag keys, sidebar collapse state, and the single-use `sessionStorage` handoff keys.

### A settings surface must not aggregate

Three attempts at a general settings page were reverted here: the drawer (`2b0abcf`, the DS ships no side-drawer primitive), a Connectors section (`8cdd7e8`, it duplicated `/connectors`), then `/settings` itself (`6fca0b0`). Config belongs on the entity that owns it (a Playbook's fields live on `/playbook/:id`) or on a route scoped to one feature — never re-hosted in a global page.

### Playbook sharing: the store holds the facts, `playbook-access` holds the rights

Behind the `playbookSharing` flag a Playbook has an owner and one of **two** scopes — `personal` or
`organization`. **There is no named sharing**: you don't hand a fiche to three colleagues, you keep it or
you put it in front of the whole org. So there is no recipient list, no people-picker, and no word for
"someone a Playbook was shared with" beyond "everyone".

`contexts-store` carries `ownerId` / `scope` / `history` but **never filters** — `getContexts()` keeps
returning everything to everyone. That is deliberate: a chat whose Playbook stopped being shared still has
to _name_ it ("this chat runs on Brightline · launch, and Jonas Beck stopped sharing it"), which means
reading a fiche you may no longer open. `src/playbook-access.js` is the only gate — `canView` / `canUse` /
`canEdit` / `canManageSharing`, plus `visibleContexts()` / `usableContexts()` / `editableContexts()` that
surfaces substitute for `getContexts()`, and `revokedContextFor()` as the one function allowed to look past
it. The flag short-circuits in a single place, so flag OFF is byte-for-byte the pre-sharing behaviour.

Ownership is **chrome, never a section**: a tag in the card's metadata corner and beside the fiche's name,
an Owner quick-fact in the rail, and everything else in the Share modal. A "Sharing" section on the fiche
would be the switch grid already removed for Topics ([`CONCEPTS.md`](docs/reference/CONCEPTS.md) §1, third
storage exception). The degraded chat marks `body.playbook-revoked` — on `<body>`, because the drafts panel
is shell chrome outside `#app` — and one capture-phase listener swallows the generating hooks and says why,
so no card renderer needs to know sharing exists.

### The Image Studio is split by subject, and the engine holds no DOM

`src/image-studio.js` is the state engine: a `Map(key → state)`, every mock, and **no DOM at all**.
The views under `components/image-studio-v2/` hold no state of their own — a mutation notifies and the
whole modal body is re-rendered. That one-way path is what makes the studio safe to change, so the
exceptions are quarantined in **one** file, `inline-text.js`: typing in a text overlay, dragging a
colour or a slider, and toggling outline/shadow all patch the DOM by hand, because a re-render would
lose the caret, replace the input mid-drag, or remount an open popover so it replays its entrance
animation. Nothing else in the studio may skip the render path.

The modules split by **subject**, not by size: `index.js` is the lifecycle, `events.js` every
delegated listener, `commit.js` the paths that write to the draft, `prompt-guard.js` the
confirmation that protects a hand-edited brief, then one view module per surface
(`stage-view`, `composer-view`, `settings-view`, `references-view`, `branding-view`, `tools-view`,
`edit-view`).

⚠️ A confirmation inside the studio must NOT be `confirm-modal.js`: it registers with
`modal-coordinator`, whose `requestOpen` closes the active overlay — the studio — running `exit(KEY)`
and deleting the session. Render it in the studio body from state instead, listen for its keys on
`document` in capture, and pass `bindOverlayDismissal` an `isOpen` that stands down while it's up. Two stylesheets, for the same reason: `image-studio-v2.css` is the shell (`.isv2-*`),
`image-studio-canvas.css` is everything that sits ON the image and must follow a precise pixel
(`.image-studio__*`).

Two naming legacies are deliberate, not oversights: the `image-studio-v2/` directory, the `.isv2-`
prefix and `KEY = "studio-v2"` date from when a second studio was mounted beside this one behind the
`imageStudioV2` flag (both removed). Renaming them would touch two stylesheets and sixteen modules
for something no user can see. Likewise `isv2-sheet-label` / `-hint` / `-switch` were written for
flyout sheets the settings panel replaced — `settings-view.js` carries the disclosure.

⚠️ Three class families are assembled by string concatenation and a rename breaks them silently:
`.image-studio__crop-handle--{nw,ne,se,sw}`, `.image-studio__popover--{kind}`,
`.image-studio__tt-{kind}`.

### Connectors as live, MCP-queryable sources

**Gated behind the `connectors` feature flag (default OFF)** — when off, every connectors surface (gallery route + sidebar nav, modal, composer Add → "Connected sources" submenu, Sources panel "Live connectors", Add-source modal Connectors tab) is hidden. Turn it on in Settings → Admin. Connector management lives only on the `/connectors` page/modal — Settings does not duplicate it.

Connectors (Notion, Slite, Google Drive, GitHub, …) are seeded in `mocks.js` (`connectors` + `connectorDocs`) with `category` / `featured` / `accent` / `capabilities`. Once **connected**, a connector becomes a **live source**: the user "asks" it in chat and `assistant.js` `sendConnectorMessage()` simulates an MCP round-trip — a "Querying … via MCP" reasoning chip listing tool calls, then a cited mock answer. Entry points: the `/connectors` gallery page (clicking a connector opens its detail in `connectors-modal.js`), the composer **Add** menu, and the right-panel **Sources** "Connect" / "Live connectors" surface. `connectors-view.js` holds the shared render helpers used by both the page and the modal; `connector-ask.js` launches the in-chat ask flow. All connect/disconnect goes through `connectors-store` so Settings, the gallery, and the modal stay in sync.

### Topics — the one place Archie proposes instead of waiting

**Gated behind the `topics` feature flag (default OFF)** — when off, the `/topics` route (a stale deep link bounces to `/`), its sidebar nav row + unseen counter, and the dossier dialog all disappear. The data (`mocks.topics`, `mocks.topicScanPool`, `ctx.topics`) rides along regardless, exactly like `playbookCompetitors`.

Agorapulse listening pulls social posts against **six sources** declared in `topics-catalog.js` — competitor posts, influencer posts, brand feedback, competitor monitoring, industry trends, global trends. That file is **CONFIG, not content**: it ships with the app and must exist in `new-alt` mode too, the same split as `ff-catalog.js` vs `mocks.js`. Which sources are on, plus **one cadence for the whole Playbook**, live on the Context as `ctx.topics = { enabledSourceIds, cadence }` (normalised by `normalizeTopics()` in `contexts-store.js` — in `addContext` **and** on the seed, which bypasses it). They are **edited on `/topics/settings`** — a settings PAGE, not a tab on the feed, because you set your sources once and then read topics for months; a tab gave it equal billing with the feed. It commits straight through `updateContext` with no Save button, shows **one Playbook at a time** scoped by `?pb=` (the same param the feed filters on, so the scope survives both directions), and uses the DS settings recipe (`--sys-settings-*`). Stacking a block per Playbook was tried and doesn't scale — twenty Playbooks meant 120 switches and every description repeated twenty times. Layout: the two page-level controls sit in a **labelled toolbar** (`.ap-form-field` × 2, the feed's two-select shape) and each of the six sources is **its own card** in a two-column grid — a card can carry that source's own options later, a row can't, and a card title over a single select was mostly padding.

**Not on the Playbook — that was tried and reverted.** A Playbook is a fact sheet: every section answers "who are you?". Which feeds are live and how often they run answers "what job should Archie run?" — operational, not declarative, and as a grid of switches it read as a settings panel wedged into a profile. The "config lives on its entity" rule has a second clause that covers this: _or on a route scoped to one feature_. The data stays per Playbook; only the surface moved.

Archie assembles those posts into a **Topic**: a headline (the claim), a written analysis, and the source posts behind it. `topics-store.js` is **global** — a topic belongs to a Playbook and arrives on a cadence, long before a chat exists to hold it, so the `/topics` feed spans every Playbook and the sidebar counter sums the whole account. `ageDays` is the single source of truth for age — the feed groups on it _and_ every "3 days ago" label derives from it via `topicWhen()`.

**Cadence is copy, never a timer** (a weekly tick would never fire in a demo). The recurring feel comes from one primitive, `drainPool(n)` — take `n` dossiers off the seeded pool, land them `unseen`/`ageDays: 0`, age everything else by a day — with two callers: `refreshTopics()` (2, the button) and **`maybeAutoScan()`** (1, called at boot from `app.js`). The auto-scan's once-guard is a **module boolean, deliberately not `sessionStorage`**: a reload has to replay an arrival, which is what makes the front page feel like a site you come back to, and it adds no persistence to a prototype that stores almost nothing.

### Topics render on three surfaces through one engine

`/topics` is the **section** (everything: lead + grid, section chips, Playbook filter, dated archive). `/` behind the `frontPage` flag is the **front page** (a selection of the fresh: lead + 6 + a "See all N" way through). The new-chat hero carries a **rail** of three headlines — and only when `frontPage` is OFF, because two surfaces showing the same three headlines is how a home page stops meaning anything.

`topics-feed.js` holds the shared render engine (`groupByAge` / `renderSourceChips` / `renderMagazine`), the same shape as `playbook-view.js` and `connectors-view.js`: pure functions, each host passes its own lookups. `topic-card.js` emits the same object in three sizes, **all three carrying the same `data-topic-open` / `-chat` / `-dismiss` hooks**, so a host wires them once. The card's CSS moved to `styles/components/topic-card.css` the day it stopped belonging to one screen.

**The layout is a paper, not a list.** A run of equal cards has no answer to "what should I read first?", which is the one question this feature exists to answer — so one lead story (bigger headline, longer deck, one source post quoted in place, `primary orange` CTA because it's the only one on the page) sits above a grid. The grid keeps the old scannability rule (`grid-auto-rows: 1fr`, equal heights); only the lead breaks it, on purpose. The lead's two-column split is a **`@container` query on the card**, not a media query — with a collapsible sidebar and an overlaying panel, viewport width never tells you content width.

**The Source facet is a `.ap-filter-chip` row, the Playbook facet stays an `.ap-select`.** Six sources, fixed and shipped by the catalogue, are the paper's sections — the DS's own rule for always-visible toggles over a small flat set. Playbooks grow with the account and a chip each cannot survive twenty. Two selects was right when the page was a filtered list; it is wrong for a publication. The Playbook select lives **in the head**, beside Settings and Refresh: seven chips already fill the measure, so it dropped to a line of its own on that row.

A topic offers exactly two actions: **Start a chat** and **Dismiss**. Start-a-chat (`topic-flow.js`) hands the topic to a fresh chat as a **Source** via the existing `addReadySource()` — no new action surface, no change to `sources-stream.js`, and every affordance the app already has (Extract ideas, Draft, Ask, the Sources panel) lights up on its own. The hero rail calls the same `openTopicInChat()` unchanged: the empty session it leaves has no thread and no sources, so it's disposable and there is nothing to preserve. Dismiss hides rather than deletes so the toast can genuinely offer Undo.

### Routing & screen lifecycle

`router.js` re-runs the matched handler on **every** `hashchange` (including query-only changes — it matches on the path with the query stripped). A screen's `render(params, target)` may return a cleanup function that the router invokes before the next render. URL state is encoded as hash query params (`#/session/:id?tab=posts&focusIdea=…`); read it with `parseHashParams()` and mutate with `setHashQuery(path, params)` (calls `navigate()`).

### Cross-screen handoffs

`handoff.js` exposes `setHandoff(key, payload)` / `consumeHandoff(key)` (atomic read+remove) / `hasHandoff(key)` over `sessionStorage`. Consumed at `session.js` mount:

| Key                          | Set by                                         | Consumed by →                     |
| ---------------------------- | ---------------------------------------------- | --------------------------------- |
| `pendingStartFlow`           | dashboard / new chat with a Playbook           | `startActionPickerFlow`           |
| `pendingDraftIdeaId`         | idea card "Draft post"                         | `askProfileQuestion` (draft-flow) |
| `pendingAskSource`           | source card "Ask"                              | `askWhatToKnow`                   |
| `pendingAskConnector`        | connectors gallery/modal "Try in chat"         | `askConnector`                    |
| `pendingStartContextBuilder` | `/contexts` "New Playbook" + welcome-alt       | `context-builder` (create)        |
| `pendingTopicChat`           | topic card / dialog / hero rail "Start a chat" | `startTopicChat` (topic-flow)     |

### Admin / user mode (prototype controls)

The **Admin** popover in the sidebar footer cog (`admin-menu.js`) is the prototype control panel: switch user mode and toggle feature flags (each change reloads so stores re-seed). `user-mode.js`: `getUserMode()` returns `"returning"` (populated mocks, default) or `"new-alt"` (empty stores + first-time onboarding); `isNewUser()` tests for `new-alt`. Feature flags live in `ff-catalog.js` (`FLAGS`, each with a `default`) and are read via `isFlagOn()`. The 14 flags: `draftInlineEdit` (OFF), `playbookDefault` (OFF), `connectors` (OFF — gates the whole connectors feature), `conversationStatusCard` (OFF), `statusActionSnackbars` (OFF), `playbookColors` (OFF — colors hidden by default), `manyProfiles` (OFF — demo seed of ~40 connected profiles), `multilingualPlaybook` (OFF), `playbookCompetitors` (OFF — gates the Playbook's Competitors section), `topics` (OFF — gates the whole Topics feature: `/topics`, `/topics/settings`, the nav row, the dossier dialog, the hero rail and the front page), `frontPage` (OFF — where Archie's proposals live: OFF = a rail in the new-chat hero and `/` keeps redirecting; ON = `/` becomes a browsable front page and a **Home** nav row appears, while the rail steps aside. Requires `topics`; the Home row is the one nav entry gated on **two** flags, hence `flag: [...]` in sidebar.js's `NAV`), `playbookSharing` (OFF — gates Playbook ownership: a Playbook is personal or shared with the whole org, never named-shared; read-only fiche + Duplicate for recipients, manager rights, the degraded chat after access is lost, and the Admin **Your role** control. Unlike `topics`, its two demo Playbooks and its demo chat are seeded **only** under the flag), `imageStudioAutoBrief` (OFF — the auto-written, block-editable brief variant of the Image Studio), and `imageStudioGridBrief` (OFF — the card-grid brief variant; wins over `imageStudioAutoBrief` when both are on). Full table + gates: [`docs/reference/FEATURES.md`](docs/reference/FEATURES.md#14-admin-feature-flags--user-modes).

### Module loading

ES modules with `?v=N` cache-busting suffixes (`from "./assistant.js?v=40"`). **Bumping a module's version means updating every importer to the same version** — a singleton/store imported at two versions becomes two separate instances (separate state). All deps are local; no CDN/`esm.sh` imports. `package.json` exists only for the two DS npm packages + tooling (prettier/husky/lint-staged). A pre-commit hook runs `prettier --write` on staged files.

## Design System — READ FIRST before UI/CSS work

This project is built on the official Agorapulse Design System (`@agorapulse/ui-theme` + `@agorapulse/ui-symbol`, synced into `ds/`). **Do not invent custom components, tokens, or icons when the DS already provides them.** Regressions from ad-hoc CSS overriding DS tokens are the #1 source of bugs in this repo.

### Required workflow before writing any HTML/CSS

1. **Check if a DS component exists** — `list_components` on the `ds-css` MCP; `get_component <name>` for variants/modifiers (`.stroked`, `.primary`, `.ghost`, `.transparent`, color classes).
2. **Check for an existing icon** — `search_icons <keyword>` before adding any SVG. Use `<i class="ap-icon-{name}"></i>`.
3. **Use DS tokens, not hardcoded values** — `search_tokens` + `recommend_token` on the MCP, or grep `ds/desktop_variables.css` for `--ref-*` / `--sys-*`. Never write `padding: 20px` when `var(--ref-spacing-sm)` exists, nor `#fff` when `var(--ref-color-white)` exists.
4. **Prefer `--sys-*` over `--ref-*`** when a semantic token exists.
5. **Custom CSS only if nothing in the DS fits** — pick the right file:
   - `styles/ds-patches.css` — the **only** place to extend a DS class with a missing variant or add a primitive the DS forgot (e.g. `.ap-filter-chip`, `.app-modal-backdrop`). It should shrink as the DS evolves.
   - `styles/screens/<screen>.css` — screen-specific styling.
   - `styles/components/<component>.css` — shared component styling.
   - **Never** redeclare a `.ap-*` class with overrides outside `ds-patches.css` — it flips the cascade silently.
6. **Validate before committing** — `validate_css` on the ds-css MCP.

### Brand color convention

Per project preference: **orange = AI / spotlight actions** (Ask, Try in chat, primary AI CTA); **blue = routine list-page CTAs** (Connect, Create, navigation). Reuse shared primitives — e.g. filter chips use `.ap-filter-chip` (driven by `aria-pressed`), the same chip the Ideas panel uses.

### DS files (in `ds/`, generated by `scripts/sync-ds.mjs` — do not edit by hand)

```
ds/
  desktop_variables.css  — design tokens (--ref-* / --sys-* / --comp-*)
  css-ui/font-face.css   — Averta font-face
  css-ui/index.css       — all .ap-* component classes
  ap-icons.css           — icon font (<i class="ap-icon-*">)
  fonts/averta/          — OTF font files
```

### App styles (in `styles/`)

```
styles/
  tokens.css        — app-only tokens (surface aliases, radius, mermaid accent)
  base.css          — resets, keyframes, app-wide token groupings
  layout.css        — app shell (sidebar / topbar / content / panel chrome)
  ds-patches.css    — the only legitimate place to touch .ap-* selectors
  chat.css          — composer + thread chrome
  screens/          — analyse, batch-studio, caption-editor, clip-studio, connectors,
                      contexts, dashboard, image-studio-canvas, image-studio-v2,
                      modals, posts, session, topics, topics-settings, welcome
  components/       — add-source-modal, archie-loader, clip-card, connectors-modal,
                      conversation-status-card, feedback-control, right-panel,
                      schedule-modal, sidebar, social-post-card, subtitle-style,
                      top-post-card, topic-badge, topic-card, topic-modal, video-clips-modal,
                      workflow-flow
```

### Token tiers

- `--ref-*` — reference tokens (colors, spacing, fonts, radii) from the DS.
- `--sys-*` — semantic tokens (text/border colors, component states) — prefer these.
- `--comp-*` — component-level tokens — do not use directly in app CSS.

Exception: the `sparklesMermaid` icon uses inline SVG for its gradient fill. Third-party brand colors (connector accents, social logos) live as data in JS, not as DS tokens.

## Key conventions

- `index.html` is HTML markup only — all UI is rendered by JS.
- All seed data lives in `src/mocks.js`.
- Event wiring is **pure event delegation** with `data-*` attributes on the screen/modal/panel root. No inline `onclick`, no per-child `addEventListener` for interactive elements.
- Keep `?v=N` import suffixes consistent across importers; bump in lockstep when a module changes its exports or is a shared singleton/store.
- The `html` tagged-template escapes interpolations by default — wrap trusted HTML fragments in `raw()`, and do **not** double-escape (don't call `escapeHtml()` on a value already interpolated into an `html` template).
- Commit one change at a time on the current branch; do not push or create branches.

## Docs

All docs (except this file and `README.md`) live under [`docs/`](docs/). Start from [`docs/README.md`](docs/README.md) for the full index. **What to read before designing anything: § Before you build a feature, at the top of this file.**

- [`docs/reference/CONCEPTS.md`](docs/reference/CONCEPTS.md) — **what each object IS**: the Playbook and its hard boundaries, what a session is and what belongs to it, the draft/post/top-post/source-post split, what a Studio is, and where Archie stops and Agorapulse starts. Read before adding a field, a section, or a surface.
- [`docs/reference/FEATURES.md`](docs/reference/FEATURES.md) — **functional catalog of every app feature** (flows, states, entry points). Start here to learn what the app does.
- [`docs/reference/UI-PATTERNS.md`](docs/reference/UI-PATTERNS.md) — concrete DS usage (ds-patches inventory, app tokens, UI patterns, the loader system, colour convention).
- [`docs/reference/`](docs/reference/) — current truth about the proto (architecture, routes, stores, design system, glossary).
- [`docs/audits/`](docs/audits/) — current audits (PROD-VS-PROTOTYPE, PROD-CHANGES).
- [`docs/copy/`](docs/copy/) — UX copy principles (voice, tone, glossary).

## MCP

- `ds-css` — design-system tools: `validate_css`, `recommend_token`, `search_tokens`, `get_component`, `list_components`, `search_icons`, `get_text_style`, `get_layout_pattern`. (`.mcp.json` ships this server.)
- `plugin:figma:figma` (when enabled) — design ↔ code: `use_figma`, `get_design_context`, `get_screenshot`, `generate_diagram`, etc.
- A live browser **preview** is available for verification (navigate routes, click, screenshot, read console).
