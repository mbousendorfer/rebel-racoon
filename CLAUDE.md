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
| anything in the Topic Feed            | [`FEATURES.md`](docs/reference/FEATURES.md) §17 + [`specs/AC-TOPIC-FEED.md`](docs/specs/AC-TOPIC-FEED.md) |
| any HTML/CSS                          | [`DESIGN-SYSTEM.md`](docs/reference/DESIGN-SYSTEM.md) + [`UI-PATTERNS.md`](docs/reference/UI-PATTERNS.md) |
| a new route or screen                 | [`ROUTES.md`](docs/reference/ROUTES.md) + [`ARCHITECTURE.md`](docs/reference/ARCHITECTURE.md)             |
| state that has to live somewhere      | [`STORES.md`](docs/reference/STORES.md)                                                                   |
| user-facing copy                      | [`copy-principles.md`](docs/copy/copy-principles.md) + [`GLOSSARY.md`](docs/reference/GLOSSARY.md)        |
| sidebar / right-panel sizing behavior | [`PANEL-SIDEBAR-RULES.md`](docs/reference/PANEL-SIDEBAR-RULES.md)                                         |
| Insights / objectives                 | [`FEATURES.md`](docs/reference/FEATURES.md) §19                                                           |
| a surface named in § Decisions        | its section in [`DECISIONS.md`](docs/reference/DECISIONS.md)                                              |

Then say, in the proposal itself: **which object the feature attaches to, and why it belongs there** rather than on a neighbour. If a doc contradicts what you were about to build, the doc wins until the user overrules it — and when the user does overrule it, update the doc in the same commit.

**The three arbitrations that keep coming back** (each already cost a revert):

- **A settings surface must not aggregate** — config lives on the entity that owns it, or on a route scoped to one feature. Never a global settings page ([`DECISIONS.md`](docs/reference/DECISIONS.md#a-settings-surface-must-not-aggregate)).
- **A Playbook is an identity sheet, not a container** — no produced content, no metrics, no operational config ([`CONCEPTS.md`](docs/reference/CONCEPTS.md) §1).
- **Never invent a component, token, or icon the DS already ships** (§ Design System).

## Running the prototype

```bash
npm install   # tooling only (prettier / husky / lint-staged) — the DS comes from the CDN
npm start     # runs `npx serve -p 8000` — open http://localhost:8000
```

With Claude Code the dev server auto-launches via `.claude/launch.json` (server name `archie`, `python3 -m http.server` on an auto-assigned port). There is **no test suite**; verify changes by running the app (see the verify/run skills) and the checks: `npm run check:ds` (every token / icon / `.ap-*` class resolves against the DS the app loads), `check:dead`, `check:versions`, `check:templates`, `check:framing` (the Clips space's reframe engine), `check:diff` (the draft word diff).

## Architecture

**Vanilla JS only** — no build step, no bundler, no framework, no external runtime deps. A hash-based router (`src/router.js`) renders the matched route into `#app` on every `hashchange`. The persistent app shell (sidebar + topbar + right panel) lives outside `#app` and is updated by subscriptions. Each screen, modal, and component owns its own DOM and uses **pure event delegation** with `data-*` attributes.

### App shell

`index.html` is the only HTML entry point. It mounts the shell — `#sidebar`, `#topbar`, `#app`, `#toastRegion` — and loads every stylesheet + `src/app.js`. `app.js` registers the routes, calls each component's `init()` (which injects that component's DOM into `<body>` once), and calls `start()`. The right panel and all modals inject themselves on `init()`.

### Routes (declared in `src/app.js`) — details, chrome levels and URL state in [`ROUTES.md`](docs/reference/ROUTES.md)

| Route                                     | Screen                            | In one line                                                                                                                             |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                       | `dashboard.js`                    | A redirect and nothing else: the active **brand's** home (most recent chat in scope, else a new one)                                    |
| `/session/:id`                            | `session.js` + `session/`         | The chat surface: thread, composer, per-session flows, the studios                                                                      |
| `/home`                                   | `home.js` + `home/`               | The **account** home (flag `playbookWorkspace`): hero + Chats / Playbooks tabs; flag OFF → `/`                                          |
| `/contexts`                               | `home.js`                         | The Playbooks catalogue; in workspace mode it `replace`s to `/home?tab=playbooks`                                                       |
| `/playbook/:id`                           | `playbook.js`                     | A Playbook's fiche (`?tab=`)                                                                                                            |
| `/playbook/:id/styles/new`, `…/:styleId`  | `modules/image-studio/`           | The brand's image-style creator                                                                                                         |
| `/insights` (`/insights/:tab` → redirect) | `insights/shell.js`               | The active Playbook's objectives (flag `insightsHub`)                                                                                   |
| `/connectors`                             | `connectors.js`                   | Connectors gallery; detail in a modal (flag `connectors`)                                                                               |
| `/topics`, `/topics/settings`             | `topics.js`, `topics-settings.js` | The Topic Feed and its listening config, one Playbook at a time                                                                         |
| `/clips`, `/clips/:id`, `…/edit/:clipId`  | `screens/clips/`                  | The Clips space (flag `clipsSpace`): the Playbook's videos, one video's project (Clips · Drafts), the one clip editor                   |
| `/welcome-alt`, `/welcome-alt/recap`      | `welcome-alt*.js`                 | First-time onboarding and its recap (flag `connectFirst`: the run as screens, `/welcome-alt/intro` → `/networks` … `/voice` → `/ready`) |

There is **no `/settings` route** — it was removed. The prototype Admin controls (user mode + feature flags + docs link) now live in the sidebar footer cog popover (`admin-menu.js`, rendered by `sidebar.js`); the old Social-accounts page was dropped (`social-profiles.js` now holds the connected-account state and the NETWORKS table).

`setAfterRender` (in `app.js`) re-renders the sidebar + conversation-status-card after every route change and toggles the `body.onboarding` full-bleed class for the welcome-alt flow.

> **Vocabulary:** a saved AI context is a **Playbook** (UI label) but the code/store calls it a **Context** (`contexts-store`, `contextId`). Source → Idea → Draft (post) → Schedule is the content pipeline; a **Topic** (`topics-store`) is an optional step upstream of it. `topic` stays banned as a synonym for **Idea** — a Topic is its own object.

### Source layout — the map (full annotated tree: [`ARCHITECTURE.md`](docs/reference/ARCHITECTURE.md#source-layout))

```
src/
  app.js · router.js · url-state.js · handoff.js · utils.js · store-utils.js   — the boot + the primitives
  user-mode.js · feature-flags.js · ff-catalog.js · org.js · active-playbook.js · playbook-access.js
  mocks.js + mocks/        ALL seed data, one file per domain, self-contained
  *-store.js, library.js, assistant.js, sources-stream.js, social-profiles.js   — state (see STORES.md)
  *-flow.js, context-builder.js, inline-question.js, playbook-view.js, topic-article.js …  — orchestrators
  modules/image-studio/    — the Image Generator, self-contained
  screens/                 one module per route; big ones split by subject into a folder:
                           session/ · home/ · insights/
  components/              init() + render/open(); right-panel/ · sidebar/ · video-clips-modal/
  modal-coordinator.js     one overlay at a time
```

### State management

**No external store library.** Stores follow one pattern: a module-level `Map(sessionId → state)` (or a single array for catalogs) plus a `Set<fn>` of subscribers notified shallowly on each mutation, built with `createNotifier()` from `store-utils.js`. State seeds lazily from `mocks.js` on first read — **or stays empty in `new-alt` mode** (`isNewUser()`).

The catalogue — every store, its scope, its full public API — lives in [`STORES.md`](docs/reference/STORES.md#catalogue-des-stores); read it before adding state, and update it in the same commit.

**Per-session** stores: `sources-stream` (sources — `Map(sessionId → Source[])`, per-session subscribers, `clearSession()`), `library`, `posts-store`, `assistant`, `composer-mentions`. That's the model: what a user brings into a chat belongs to that chat ([`docs/reference/CONCEPTS.md`](docs/reference/CONCEPTS.md) §3). **Global** are the catalogs, legitimately — they pre-exist any chat: `contexts`, `connectors`, `folders`, `sessions`, `schedule`, `schedule-presets`, `top-posts`, `topic-feeds`, `topics` — plus `sources-stream`'s **uploads**, a transient pre-source pool the Add-source modal reads as a whole. `library.js` subscribes to sources-stream and re-emits per-session so any session's content surfaces repaint when a source lands. **Almost no persistence** — a few preferences in `localStorage` (user mode, flags, role, the active Playbook, sidebar collapse, Sort & group, the status card, the Insights layout), the `sessionStorage` handoffs, and one real exception: the Image Generator keeps its styles / creations in `localStorage` + IndexedDB. Every key, with its owner: [`STORES.md` § Persistence](docs/reference/STORES.md#persistence). A new key goes in that table.

### Decisions — one line each, the reasoning in [`DECISIONS.md`](docs/reference/DECISIONS.md)

Each of these was argued and several were reverted; read its section before touching the surface.

- **[A settings surface must not aggregate](docs/reference/DECISIONS.md#a-settings-surface-must-not-aggregate)** — three global settings pages were reverted (drawer, Connectors section, `/settings`). Config lives on the entity that owns it or on a route scoped to one feature.
- **[Playbook sharing](docs/reference/DECISIONS.md#playbook-sharing-the-store-holds-the-facts-playbook-access-holds-the-rights)** (flag `playbookSharing`) — three scopes (`personal` / `members` = fixed list / `organization` = dynamic). `contexts-store` never filters; `playbook-access.js` is the only gate. `canEdit` is the owner only; a manager gets `canGovern` (share, hand over, delete), never content. A profile-tied Playbook reaches only people who can reach that profile (fails open). Ownership is chrome, never a section.
- **[The Image Studio is split by subject](docs/reference/DECISIONS.md#the-image-studio-is-split-by-subject-and-the-engine-holds-no-dom)** — `src/modules/image-studio/`: persistent state in `state/store.js` + `creation-actions.js`, the dialog's state in the `mountStudio()` closure (`views/studio.js`); every change re-renders via `paint()`, the only DOM patching is the editor's Silent section; the prompt is `buildPrompt()` at generate time, no Advanced tab. A carousel (Slides 1–10, run config) is ONE creation sharing one `styleSnapshot`, `slides[]` per variation. ⚠️ The _classic_ / _auto-brief_ arrangements and the Generate | Edit tabs were deleted — don't propose them back. A confirm inside the studio is the module's `confirmDialog`, never `confirm-modal.js`. Five class families are built by concatenation — a rename breaks them silently.
- **[Connectors](docs/reference/DECISIONS.md#connectors-as-live-mcp-queryable-sources)** (flag `connectors`) — a connected connector is a live source asked in chat (`sendConnectorMessage`, simulated MCP). Managed only on `/connectors`.
- **[The Topic Feed](docs/reference/DECISIONS.md#the-topic-feed--the-one-place-archie-proposes-instead-of-waiting)** — the triage queue on `/topics`. ⚠️ It replaced a Topics _magazine_, deleted rather than flagged: don't bring the magazine or its front page back. `topics-catalog.js` is CONFIG (ships in `new-alt`); only `competitor-posts` and `influencer-posts` are live, and the default filter derives from them.
- **[Four separate fields, one visual vocabulary](docs/reference/DECISIONS.md#the-invariant-four-separate-fields-one-visual-vocabulary)** — `status` / `kind` / `isTrending` / `isUpdated` stay four fields, shown as six chips. Filters = three grouped controls (Topics lane multi-select empty at rest · Marked as · Sources); signals are never filter rows, so an ignored Topic never resurfaces. Triage lives in its own `Map`; the trail is two-sided.
- **[Connecting an account](docs/reference/DECISIONS.md#connecting-an-account-asked-in-the-flow-never-as-a-prerequisite)** — asked in the flow, never as a prerequisite: `requireConnectedProfiles()` wraps every path that produces a draft, and the flow resumes where it left off. The grid asks, the dialog consents; the Skip is not silent (required reasons, free exit). A picker must never render empty.
- **[The listening config left the Playbook](docs/reference/DECISIONS.md#the-listening-config-left-the-playbook)** — one feed per Playbook in `topic-feeds-store`, provisioned on read, never deletable.
- **[The Playbook scope](docs/reference/DECISIONS.md#the-playbook-scope--pb-by-default-a-workspace-behind-playbookworkspace)** (flag `playbookWorkspace`) — OFF: `?pb=` and a per-chat Playbook. ON: one active Playbook chosen in the rail, everything scoped under it, the six in-flow pickers gone, `/home` the account level (`isAccountScope`). The flag short-circuits in `active-playbook.js` only. A chat keeps its own Playbook. ⚠️ Never re-point a surface at `getDefaultContext()` or add a `?pb=` producer outside those three functions.
- **[One article, three hosts](docs/reference/DECISIONS.md#one-article-three-hosts)** — `topic-article.js` is the single renderer (feed pane, picker dialog, in-chat dialog); `topic-card.js` emits two shapes, no third.
- **[The master–detail: the list shrinks](docs/reference/DECISIONS.md#the-masterdetail-the-list-shrinks)** — the article pane is the fixed half, the list absorbs the rest, split measured by a `@container` query, never a media query.
- **[Two verbs, and only two](docs/reference/DECISIONS.md#two-verbs-and-only-two)** — Use in chat (marks Used, attaches as a Source) and Ignore (asks why, reversible, the reason is kept). The composer's picker is the one inline exception.
- **[The Clips space](docs/reference/DECISIONS.md#the-clips-space-the-video-first-one-editor)** (flag `clipsSpace`) — a Video belongs to the Playbook's library, not a chat; prod's order (analysis on upload, options after the pick); ONE clip editor for every tool (the rail and the tool's panel on the left: Reframe = the crop editor, `clip-framing.js` · Transcript · Subtitles · Text · Brand; the trim is the Clip track itself (its edges' times, ⇤ / ⇥ in its header; each track carries its actions in its header), the cleanup the Transcript's head, the format and the safe area sit on the Output monitor); drafts written in the space (`posts-store` key `video-<id>`). No conversation there; a chat keeps its clips and gains "Open in Clips". The space is the light DS with its components only; the footage alone sits on a black well — a dark mode was tried and removed (2026-10-26), don't bring it back.
- **[The DS ports live in ds-patches.css](docs/reference/DECISIONS.md#the-ds-ports-live-in-ds-patchescss)** — `.ap-filter-dropdown` (and `.ap-segmented-control` for the Image Generator's Variations, `.ap-close-button` for the style creator's image tiles) are transcriptions of Angular-only DS components; their token substitutions are commented and wait for the DS to publish the real names.

### Routing & screen lifecycle

`router.js` re-runs the matched handler on **every** `hashchange` (including query-only changes — it matches on the path with the query stripped). A screen's `render(params, target)` may return a cleanup function that the router invokes before the next render. URL state is encoded as hash query params (`#/session/:id?tab=posts&focusIdea=…`); read it with `parseHashParams()` and mutate with `setHashQuery(path, params)` (calls `navigate()`).

### Cross-screen handoffs

`handoff.js` exposes `setHandoff(key, payload)` / `consumeHandoff(key)` (atomic read+remove) over `sessionStorage` — the one-shot bridge across a navigation. The live keys, who sets and who consumes each: [`ROUTES.md` § Handoffs](docs/reference/ROUTES.md#handoffs-entre-routes). ⚠️ A key that is consumed but never set reads as a live entry point and is dead — add a key only with both ends (`focusObjective` was removed for this on 2026-09-30).

### Admin / user mode (prototype controls)

The **Admin** popover in the sidebar footer cog (`admin-menu.js`) is the prototype control panel: user mode (`user-mode.js` — `"returning"`, populated mocks, default · `"new-alt"`, empty stores + first-time onboarding; `isNewUser()`) and the feature flags (`ff-catalog.js`, read via `isFlagOn()`); each change reloads so stores re-seed. What each flag gates, in full: [`FEATURES.md` §14](docs/reference/FEATURES.md#14-admin-feature-flags--user-modes). One line each:

- `insightsHub` (OFF) — the whole `/insights` section. · `playbookWorkspace` (OFF) — the Playbook as the level above the work (rail switcher, scoped surfaces, `/home`). · `connectors` (OFF) — the whole connectors feature.
- `playbookSharing` (OFF) — ownership, three scopes, governance, the profile gate; its two demo Playbooks and demo chat are seeded **only** under the flag.
- `newScheduleModal` (**ON**) — the redesigned schedule modal; OFF reopens `schedule-modal-legacy.js`, a delete once the comparison ends. · `newConversationStyles` (OFF) — the thread in Figma's « two sides » style (§ E): a mirrored avatar column — Archie's disc left, yours right, on each turn's first line, one content edge per side, no names; time on hover in the gutter, white object chips; a wrap of the rendered turns in `renderTwoSides`. It holds EVERY conversation restyle since Monday 2026-10-05 (before / after): OFF = the Monday thread, its values in `styles/chat-legacy.css` (`body:not(.conv-new)`, class set in `app.js`) + a few `isFlagOn` branches for the Monday markup — delete them all when the flag is baked. · `newChatHero` (**ON** since 2026-10-28, R3) — a new chat keeps its wordmark + sub-line and composer, and shows the three workflow starters as rows — title + description (`renderStarterCards({ rows: true })`) — instead of the big cards, then one row of three Topics (a « What are we posting today? » headline was tried and dropped; the FUX pixel stage behind the composer and the workflows as white tile-cards were rejected 2026-10-20 — keep them rows); the home keeps the cards. · `connectFirst` (OFF) — the first-time run as screens instead of the chat: the plan (`/welcome-alt/intro`), then one screen per step in one split — the step left, the Playbook card filling with the real answers right (`welcome-alt-shell.js`; only the brand's look and competitors land before the last steps — the Voice on its own step, About and the Brief stage by stage on « Building your Playbook », a stage's `lands`) — the networks first (where you post + the main one; nothing to connect since 2026-10-28, the first draft asks), the voice upstream on its own step (`/welcome-alt/voice`: the default voice, then the same voice everywhere or rules for each network, the main one first), ending on a reveal (`/welcome-alt/ready`, Start writing). The steps' effects are context-builder's, shared with the chat. Its review (`/welcome-alt/recap`) is one scrolling column per part: the cover first, the card at the middle in focus, a compact nav right of it, _Looks good — on to …_ at the bottom. · vertical dots · ↓), one button at the bottom confirms the part (_Looks good — on to Voice profile_), and the part's cover is the column's first card. · `demoMode` (OFF) — _Try it with a demo brand_ from the first screen of the first-time run (and from the Skip dialog, under the « try first » reason): a card at the bottom of the sidebar on every screen, then the real new chat on « Demo: Bramble & Bean » (made up, a fully filled Playbook, three pretend accounts already connected, no Playbook can be created, nothing of the user's own comes in — every upload is disabled, turned into « demo content », or refused; the stores swap to its top posts, Topics, sample files, ideas and clips under `isDemo()`, so every way in works), one wave of drafts in any chat then a soft stop, every Schedule → a _This is a demo_ dialog, _Exit demo_ wipes it all (`demo-flow.js`, state in `demo-mode.js`). · `contentPanel` (**ON** since 2026-10-28, R4) — the three pills become the side panel's own tabs, in the topbar right above it (Overview │ Sources › Ideas, Clips › Drafts with counts, a dot on a tab with something new; the panel has no header row; Clips is a tab, so the Ideas view has no sub-tabs and no kind filter; a single « Content » button was tried first) and an **Overview** that is the status card's other form — one or the other: with `conversationStatusCard` ON the card stays (no « i » toggle — shown whenever the panel is closed) and the Overview tab is gone (`hasOverview()`) (`overview-view.js`: my next step as the DS infobox (info / warning / success), then the chat's real content — source tiles, ideas with their kind, a clips filmstrip, draft excerpts with their status); Sources / Ideas / Drafts share one look (grey-05 canvas, white cards); every result in the thread is a card that opens the panel on ITS objects (`focusManyInPanel`, `.is-active` while open from it), with no toast nor green composer bar, and the panel never opens by itself. · `voicePerNetwork` (OFF) — the **default voice** is GENERIC, tied to no network (the Playbook's five parts; its tab « Default voice · All networks », 2026-10-28 — the « LinkedIn · Default » first-network model of the same morning was reverted); every network is a variation of it: its own rules or that voice; one state `default` | `own`. A voice is given the same ways everywhere — learn from posts · adapt the default voice (« Adapt for X », nothing to read) · a document · a few questions · edit it (+ use the default voice when a draft waits) — and what Archie learns is a PROPOSAL, shown, saved only on « Add to Voice profile » or opened unsaved in the editor (`network-voice-flow.js`, `voice-proposal-modal.js`, `learnedVoiceHtml`). Before a draft for a network never set, a blocking Voice step (chat; dialog in Clips); a draft in the default voice says so (« Add rules for X »); copy: default voice · rules for X · Add to Voice profile, never « voice learned »; a voice change never rewrites a draft — the drafts written before say so (Rewrite it; `changedAt` / `voiceChangedAt` vs `writtenAt`); a draft's feedback can propose a voice update; returning users get a one-time intro dialog that walks them through personalizing each other network, one at a time (`voice-intro-modal.js`); a new user chooses in the creation review between the same voice everywhere and rules for each network, then gives each network its rules — a « Rules for X » card per network under the default voice — and a network left unanswered gets nothing, so its first draft asks; the fiche carries the same choice under the default voice (read from the Playbook, no new field), never warns a network kept on the default voice by choice, and offers « Use my default voice instead » on a network with rules. Full rules: FEATURES §9, DECISIONS « Une voix par réseau ». · `clipsSpace` (OFF) — the Clips space (§ Decisions): a Clips row in the rail → `/clips`, the video library of the Playbook; analysis on upload (prod's order), then the clips with live reframed previews and the video's Format / Subtitles, then one draft per clip × account (CTA none / in post / first comment) and Schedule, all without a chat; one editor (`/clips/:id/edit/:clipId`), tools on the left — Reframe (prod's crop editor), Transcript, Subtitles, Text, Brand — with the trim on the Clip track (times on its edges, each track's actions in its header), the cleanup at the head of the Transcript and the format on the Output monitor; "How your clips look" on the fiche's Branding tab; the Extract video clips starter leads there and a chat's video opens there ("Open in Clips"). OFF = the Clip Studio and the Video Clips modal, untouched. · `uiIdeaCard` (OFF, label « UI-Idea card: clearer ») — the compact idea card says what it is (« Story idea », thumbs beside it), where it comes from (« From notes.pdf », Why this idea at the end of that line) and what to do with it (a footer of actions alone, the Draft lit on card hover); `renderClearIdeaCard` in `idea-card-compact.js`, its CSS under `body.ui-idea-card` in `right-panel.css`. · `draftChanges` (**ON**) — what a rewrite asked in the chat changed: the commit keeps the replaced version on the draft (`revision`, `undoRevision`); the thread gets one card per rewritten draft (my sentence with named counts, then _Changes_ = added on butter, removed struck · _Side by side_ = Before / After, the opening view past half the words changed; Undo ↔ Redo, disabled once the draft moved; Open draft); the draft in the panel carries a butter strip (Show removed text · Undo · Hide changes) and its new words marked until Hide, a hand edit or the next rewrite. Word diff in `word-diff.js` (`npm run check:diff`), styles in `draft-changes.css`. OFF = the rewrite as before. · `conversationStatusCard`, `multilingualPlaybook` (OFF).

**Removed flags — do not reintroduce as toggles:** `reviewScroll` (baked ON 2026-10-20 — the run's review is a scrolling column; the stack it replaced was deleted), `topicFeed`, `playbook2`, `sexySquirrel` (the Image Generator + brand kit, old Image Studio deleted) and `skipConnectProfiles` (all baked ON 2026-10-07), `draftInlineEdit` (baked ON 2026-10-19), `brandTintedPresets` (deleted 2026-10-20 — ready-made style thumbnails stay in Acme's palette), `playbookNoWebsite` (baked ON 2026-10-16 — prod's `content-studio-playbook-no-website`: "I don't have a website" → an interview, `nextInterviewQuestion` / `analyzeInterview`), `playbookDefault` (deleted), `statusActionSnackbars`, `playbookColors`, `manyProfiles`, `playbookCompetitors` (baked ON), `imageStudioAutoBrief`, `imageStudioSetupFirst`, `imageStudioV2`, `frontPage`, `topics` (deleted with what they switched).

### Module loading

ES modules with a `?v=N` cache-busting suffix (`from "./assistant.js?v=1"`). **One number for the whole app** — every module specifier in `src/` and every app stylesheet in `index.html` carries the same `?v=`. The browser caches a module by its exact URL, so a store named at two versions becomes two module instances with split state; a single shared number makes that impossible instead of merely discouraged.

```bash
npm run bump            # N → N+1 across every file, in one pass — run it for ANY js/css change
npm run check:versions  # fails on drift; the pre-commit hook runs it
```

Never hand-edit a `?v=`. `scripts/cache-version.mjs` owns the number (it also covers dynamic `import("…")`, which a hand-bump used to miss), and the pre-commit hook blocks a commit whose versions disagree. The number is only a cache-buster — the server resolves the same file whatever the suffix — so a bump is always behaviour-neutral.

⚠️ **A cached entry point pins the whole old import graph.** After a JS change, verify a _visible_ effect (a removed node, a changed class) in the browser: a CSS-only confirmation proves nothing about the JS.

The **Design System is loaded from jsDelivr at `@latest`** (`index.html`: `@agorapulse/ui-theme` tokens + CSS-UI + Averta, `@agorapulse/ui-symbol` icons) and nothing of it is vendored — the published package is the only source, as the `design-guidelines` skill prescribes. Everything else is local: no other CDN / `esm.sh` import in app code (the bug-report modal's html2canvas capture, the one exception, was removed on 2026-10-28). `package.json` holds tooling only (prettier/husky/lint-staged). The pre-commit hook runs `check-template-comments.py`, `cache-version.mjs check`, and `prettier --write` on staged files.

## Design System — READ FIRST before UI/CSS work

This project is built on the official Agorapulse Design System (`@agorapulse/ui-theme` + `@agorapulse/ui-symbol`, **loaded from jsDelivr `@latest`** — see `index.html`). **Do not invent custom components, tokens, or icons when the DS already provides them.** Regressions from ad-hoc CSS overriding DS tokens are the #1 source of bugs in this repo.

### Required workflow before writing any HTML/CSS

**All DS work goes through the `/design-guidelines` skill** (`mode: html-prototype`) — it reads the specs from the `agorapulse/design` repo and the packages from the CDN, and carries the house rules the specs don't (ink grey-80…100, borders grey-20, blue = interactive, no nested elevation, no uppercase labels, no edge-accent bars, card hover = blue border, CTAs never full width, footers right-grouped). Generic design skills are a review checklist only. **Never the `ds-css` MCP** — it was removed from this repo.

1. **Find the component by intent** (the skill's lookup), then its CSS-UI classes in the CDN's `css-ui/index.css`.
2. **Check the icon exists** in `@agorapulse/ui-symbol@latest/icons/ap-icons.css` — match the full class (`ap-icon-eye` does not exist, `ap-icon-eye-on` does). Use `<i class="ap-icon-{name}"></i>`.
3. **Use DS tokens, not hardcoded values** — every `--ref-*` / `--sys-*` / `--comp-*` must exist in `desktop_variables.css`. Grey steps are `05 · 10 · 20 · 40 · 60 · 80 · 100 · 150` only.
4. **Prefer `--sys-*` over `--ref-*`** when a semantic token exists.
5. **Custom CSS only if nothing in the DS fits** — pick the right file:
   - `styles/ds-patches.css` — the **only** place to extend a DS class with a missing variant or add a primitive the DS forgot (e.g. `.ap-filter-chip`, `.app-modal-backdrop`). It should shrink as the DS evolves.
   - `styles/screens/<screen>.css` — screen-specific styling.
   - `styles/components/<component>.css` — shared component styling.
   - **Never** redeclare a `.ap-*` class with overrides outside `ds-patches.css` — it flips the cascade silently. The one standing exception is `styles/components/archie-loader.css`, which claims `.ap-loader` on purpose: every spinner in the app is replaced by the animated Archie mark, and that is a brand decision, not a missing DS primitive. It says so at the top of the file. Don't add a second exception without the same kind of note.
6. **Validate before committing** — `npm run check:ds`. A name that doesn't exist fails silently (the declaration is dropped, the mask is empty), so this is the only thing that catches it.

### Brand color convention

Per project preference: **orange = AI / spotlight actions** (Ask, Try in chat, primary AI CTA); **blue = routine list-page CTAs** (Connect, Create, navigation). Reuse shared primitives — e.g. filter chips use `.ap-filter-chip` (driven by `aria-pressed`), the same chip the Ideas panel uses.

### DS files (jsDelivr, `@latest` — nothing vendored)

```
@agorapulse/ui-theme@latest/assets/
  desktop_variables.css      — design tokens (--ref-* / --sys-* / --comp-*)
  style/css-ui/font-face.css — Averta font-face (resolves ../../fonts/averta/ on the CDN)
  style/css-ui/index.css     — all .ap-* component classes
@agorapulse/ui-symbol@latest/icons/
  ap-icons.css               — icons (mask-image on <i class="ap-icon-*">)
```

### App styles (in `styles/`)

```
styles/
  tokens.css        — app-only tokens (surface aliases, radius, shadows, chart palette → DS data tokens)
  base.css          — resets, keyframes, the global [hidden] rule, app-wide token groupings
  fonts.css         — the Image Studio's bundled display fonts (local @font-face, OFL)
  layout.css        — app shell (sidebar / topbar / content / panel chrome)
  ds-patches.css    — the only legitimate place to touch .ap-* selectors
  chat.css          — composer + thread chrome
  chat-legacy.css   — the thread as of Monday 2026-10-05, flag newConversationStyles OFF only
  screens/          — analyse, batch-studio, caption-editor, clip-studio, connectors,
                      contexts (the catalogue + the home's page box), home (its hero,
                      tab toolbar and chats table), dashboard, image-studio-canvas,
                      image-studio-v2, insights (+ insights-cockpit / -mob_index /
                      -mob_side / -read, one per layout), modals, playbook-v2, posts,
                      session, topics, topics-settings, welcome
  components/       — add-source-modal, archie-loader, archie-pixels, clip-card, connectors-modal,
                      conversation-status-card, draft-changes, feedback-control, objective-modal,
                      right-panel, schedule-modal (+ schedule-modal-legacy), sidebar,
                      social-post-card, subtitle-style, top-post-card, topic-badge,
                      topic-card, video-clips-modal, workflow-flow
src/modules/image-studio/styles/imst-*.css — the Image Generator's own sheets (linked from index.html)
```

### Token tiers

- `--ref-*` — reference tokens (colors, spacing, fonts, radii) from the DS.
- `--sys-*` — semantic tokens (text/border colors, component states) — prefer these.
- `--comp-*` — component-level tokens — do not use directly in app CSS.

Exception: the `sparklesMermaid` icon uses inline SVG for its gradient fill. Third-party brand colors (connector accents, social logos) live as data in JS, not as DS tokens.

## Key conventions

- `index.html` is HTML markup only — all UI is rendered by JS.
- All seed data lives under `src/mocks/`, one file per domain, re-exported by the `src/mocks.js` barrel — consumers always import from `mocks.js`, never from a domain file. A new domain is a new file plus one `export *` line; it must not read another domain.
- Event wiring is **pure event delegation** with `data-*` attributes on the screen/modal/panel root. No inline `onclick`, no per-child `addEventListener` for interactive elements.
- `?v=N` is ONE number for the whole app: `npm run bump` after any JS/CSS change, never a hand edit (§ Module loading).
- The `html` tagged-template escapes interpolations by default — wrap trusted HTML fragments in `raw()`, and do **not** double-escape (don't call `escapeHtml()` on a value already interpolated into an `html` template).
- One ask = one commit, pushed to `main` (GitHub Pages deploys it); never create branches. Other sessions push to `main` too: fetch before pushing, and merge — never rebase — when behind.

## Docs

All docs (except this file and `README.md`) live under [`docs/`](docs/). Start from [`docs/README.md`](docs/README.md) for the full index. **What to read before designing anything: § Before you build a feature, at the top of this file.**

- [`docs/reference/CONCEPTS.md`](docs/reference/CONCEPTS.md) — **what each object IS**: the Playbook and its hard boundaries, what a session is and what belongs to it, the draft/post/top-post/source-post split, what a Studio is, and where Archie stops and Agorapulse starts. Read before adding a field, a section, or a surface.
- [`docs/reference/FEATURES.md`](docs/reference/FEATURES.md) — **functional catalog of every app feature** (flows, states, entry points). Start here to learn what the app does.
- [`docs/reference/DECISIONS.md`](docs/reference/DECISIONS.md) — **the arbitrations behind the code**, in full (the one-liners in § Decisions above link into it).
- [`docs/reference/UI-PATTERNS.md`](docs/reference/UI-PATTERNS.md) — concrete DS usage (ds-patches inventory, app tokens, UI patterns, the loader system, colour convention).
- [`docs/reference/`](docs/reference/) — current truth about the proto (architecture + the full source tree, routes, stores, design system, glossary, shell sizing).
- [`docs/audits/`](docs/audits/) — dated snapshots (prod vs proto, alpha feedback, the Image Generator integration); read the date before trusting a detail.
- [`docs/copy/`](docs/copy/) — UX copy principles (voice, tone, glossary).
- [`docs/specs/`](docs/specs/) — acceptance criteria, written from the running app. [`AC-TOPIC-FEED.md`](docs/specs/AC-TOPIC-FEED.md) covers the Topic Feed; its §0 lists what this repo deliberately does differently from the spec it was ported from.

## MCP

- `plugin:figma:figma` (when enabled) — design ↔ code: `use_figma`, `get_design_context`, `get_screenshot`, `generate_diagram`, etc.
- A live browser **preview** is available for verification (navigate routes, click, screenshot, read console).
