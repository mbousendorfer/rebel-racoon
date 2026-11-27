# CLAUDE.md

Guidance for Claude Code in this repository. This file holds the rules and the map; the detail lives in [`docs/`](docs/README.md). It is not a changelog: a routine change is recorded in `docs/`, never here.

## What this is

Interactive prototype for exploring and validating Agorapulse UI redesigns — specifically **Archie**, an AI content assistant (sources → ideas → drafts → schedule). Static ES modules, no build step. Code and UI copy are in English, some comments and most docs in French. Archie speaks in the first person ("I", "Let's") — never third-person "Archie" — in user-facing copy.

## Before you build a feature — read the docs

`docs/` records decisions that were argued, shipped, and in several cases **reverted**. Designing without reading it means re-proposing something already tried and removed — the most common failure mode on this repo.

**Whenever a request adds, moves, or changes a feature** (a screen, a section, a field, a control, a flow), read BEFORE proposing anything:

1. **[`CONCEPTS.md`](docs/reference/CONCEPTS.md)** — what each object IS and where its boundary sits (_"which entity does this belong to?"_, the question most rejected designs got wrong).
2. **[`FEATURES.md`](docs/reference/FEATURES.md)** — the § for the surface you touch, so you extend what exists instead of building a parallel version.
3. The doc for the dimension in play:

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
| a feature flag or the Admin panel     | [`FEATURES.md`](docs/reference/FEATURES.md) §14                                                           |
| a surface named in § Decisions        | its section in [`DECISIONS.md`](docs/reference/DECISIONS.md)                                              |

Then say, in the proposal itself, **which object the feature attaches to, and why** rather than a neighbour. If a doc contradicts what you were about to build, the doc wins until the user overrules it — and then update the doc (in `docs/`) in the same commit.

**The three arbitrations that keep coming back** (each already cost a revert):

- **A settings surface must not aggregate** — config lives on the entity that owns it, or on a route scoped to one feature. Never a global settings page ([`DECISIONS.md`](docs/reference/DECISIONS.md#a-settings-surface-must-not-aggregate)).
- **A Playbook is an identity sheet, not a container** — no produced content, no metrics, no operational config ([`CONCEPTS.md`](docs/reference/CONCEPTS.md) §1).
- **Never invent a component, token, or icon the DS already ships** (§ Design System).

## Running and checking

```bash
npm install   # tooling only (prettier / husky / lint-staged) — the DS comes from the CDN
npm start     # npx serve -p 8000 — open http://localhost:8000
```

In Claude Code, `preview_start {name: "archie"}` runs `scripts/dev-server.py` on an auto-assigned port (`.claude/launch.json`). There is **no test suite**: verify by running the app, plus the checks — `npm run check:ds` (every token / icon / `.ap-*` class resolves against the DS the app loads), `check:dead`, `check:versions`, `check:templates`, `check:framing` (the Clips reframe engine), `check:diff` (the draft word diff), `check:mentions`, `check:utils`.

## Architecture

Full source tree and lifecycle: [`ARCHITECTURE.md`](docs/reference/ARCHITECTURE.md).

**Vanilla JS only** — no bundler, no framework, no runtime deps. `index.html` is the one HTML entry point, markup only: it mounts the shell (`#sidebar`, `#topbar`, `#app`, `#toastRegion`) and loads every stylesheet + `src/app.js`. `app.js` registers the routes, calls each component's `init()` (which injects its DOM into `<body>` once), and calls `start()`. A hash router (`src/router.js`) renders the matched route into `#app` on **every** `hashchange`, query-only changes included; a screen's `render(params, target)` may return a cleanup the router runs before the next render. `setAfterRender` (in `app.js`) re-renders the sidebar + status card after each route change and toggles `body.onboarding` for the welcome-alt flow. Each screen, modal and component owns its DOM and uses **pure event delegation** on `data-*` attributes.

### Routes (declared in `src/app.js`; chrome levels and URL state in [`ROUTES.md`](docs/reference/ROUTES.md))

| Route                                     | Screen                            | In one line                                                                                       |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/`                                       | `dashboard.js`                    | A redirect only: the active brand's most recent chat in scope, else a new one                     |
| `/session/:id`                            | `session.js` + `session/`         | The chat: thread, composer, per-session flows, the studios                                        |
| `/contexts`                               | `home.js`                         | The Playbooks catalogue                                                                           |
| `/playbook/:id`                           | `playbook.js`                     | A Playbook's fiche (`?tab=`)                                                                      |
| `/playbook/:id/styles/new`, `…/:styleId`  | `modules/image-studio/`           | The brand's image-style creator                                                                   |
| `/insights` (`/insights/:tab` → redirect) | `insights/shell.js`               | The active Playbook's objectives (flag `insightsHub`)                                             |
| `/connectors`                             | `connectors.js`                   | Connectors gallery, detail in a modal (flag `connectors`)                                         |
| `/topics`, `/topics/settings`             | `topics.js`, `topics-settings.js` | The Topic Feed and its listening config, one Playbook at a time                                   |
| `/clips`, `/clips/:id`, `…/edit/:clipId`  | `screens/clips/`                  | The Clips space: library, one video's project, the clip editor                                    |
| `/welcome-alt/*`                          | `welcome-alt*.js`                 | First-time onboarding as screens: `intro` → `brand` → … → `ready` → `recap` (the Brief) → `voice` |

There is **no `/settings` route**. The prototype controls live in the hidden **Admin** panel, ⇧D only (`admin-panel.js`): a Settings tab (`admin-menu.js` — user mode, feature flags) and a Preview in chat tab (`chat-gallery.js`). Nothing in the UI points at it.

> **Vocabulary:** a saved AI context is a **Playbook** in the UI but a **Context** in code (`contexts-store`, `contextId`). Source → Idea → Draft (post) → Schedule is the pipeline; a **Topic** (`topics-store`) is an optional step upstream. `topic` is never a synonym for **Idea**.

### State

No store library. A store is a module-level `Map(sessionId → state)` (or one array for a catalog) plus subscribers from `createNotifier()` (`store-utils.js`), seeded lazily from `mocks.js` — or left empty in `new-alt` mode (`isNewUser()`). **Per-session**: what a user brings into a chat belongs to that chat (`sources-stream`, `library`, `posts-store`, `post-plan-store`, `assistant`, `composer-mentions`; [`CONCEPTS.md`](docs/reference/CONCEPTS.md) §3). **Global**: the catalogs that pre-exist any chat (`contexts`, `topics`, `videos-store`…). Almost no persistence: a few `localStorage` preferences, `sessionStorage` handoffs, and the Image Generator (`localStorage` + IndexedDB). Every store, its API and every persisted key: [`STORES.md`](docs/reference/STORES.md) — read it before adding state, update it in the same commit.

URL state is hash query params (`#/session/:id?panel=drafts`): read with `parseHashParams()`, write with `setHashQuery(path, params)`. Cross-navigation one-shots go through `handoff.js` (`setHandoff` / `consumeHandoff`, over `sessionStorage`); live keys in [`ROUTES.md` § Handoffs](docs/reference/ROUTES.md#handoffs-entre-routes). A key is added with both ends or not at all — one consumed but never set is dead code that reads as an entry point.

### Module loading — one `?v=` for the whole app

Every module specifier in `src/` and every app stylesheet in `index.html` carries the same `?v=N`. The browser caches a module by exact URL, so a store imported at two versions becomes two instances with split state.

```bash
npm run bump            # N → N+1 everywhere — run it for ANY js/css change
npm run check:versions  # fails on drift; the pre-commit hook runs it
```

Never hand-edit a `?v=`. ⚠️ A cached entry point pins the whole old import graph: after a JS change, verify a _visible_ effect in the browser — a CSS-only confirmation proves nothing about the JS.

## Decisions — one line each, the reasoning in [`DECISIONS.md`](docs/reference/DECISIONS.md)

- **[Settings must not aggregate](docs/reference/DECISIONS.md#a-settings-surface-must-not-aggregate)** — three global settings pages reverted (drawer, Connectors section, `/settings`).
- **[Playbook sharing](docs/reference/DECISIONS.md#playbook-sharing-the-store-holds-the-facts-playbook-access-holds-the-rights)** (flag `playbookSharing`) — `contexts-store` never filters, `playbook-access.js` is the only gate; `canEdit` = owner only, a manager gets `canGovern`, never content.
- **[The Playbook scope](docs/reference/DECISIONS.md#the-playbook-scope--pb-and-a-per-chat-playbook)** — `?pb=` and a per-chat Playbook; the workspace variant (rail switcher, `/home`) was deleted on 2026-11-27. Never re-point a surface at `getDefaultContext()` nor add a `?pb=` producer outside `active-playbook.js`.
- **[The Image Studio](docs/reference/DECISIONS.md#the-image-studio-is-split-by-subject-and-the-engine-holds-no-dom)** — `src/modules/image-studio/`, state in `state/`, re-render via `paint()`, prompt built at generate time; a confirm inside it is its own `confirmDialog`. Five class families are built by concatenation — a rename breaks them silently.
- **[Connectors](docs/reference/DECISIONS.md#connectors-as-live-mcp-queryable-sources)** (flag `connectors`) — a live source asked in chat (simulated MCP), managed only on `/connectors`.
- **[The Topic Feed](docs/reference/DECISIONS.md#the-topic-feed--the-one-place-archie-proposes-instead-of-waiting)** — a triage queue; `status` / `kind` / `isTrending` / `isUpdated` stay [four fields](docs/reference/DECISIONS.md#the-invariant-four-separate-fields-one-visual-vocabulary); [two verbs only](docs/reference/DECISIONS.md#two-verbs-and-only-two) (Use in chat, Ignore); [one article renderer, three hosts](docs/reference/DECISIONS.md#one-article-three-hosts); in [the master–detail the list shrinks](docs/reference/DECISIONS.md#the-masterdetail-the-list-shrinks) (`@container`, never a media query); [one listening feed per Playbook](docs/reference/DECISIONS.md#the-listening-config-left-the-playbook), never deletable.
- **[Connecting an account](docs/reference/DECISIONS.md#connecting-an-account-asked-in-the-flow-never-as-a-prerequisite)** — asked in the flow, never as a prerequisite: `requireConnectedProfiles()` wraps every path that produces a draft. A picker never renders empty.
- **[The Clips space](docs/reference/DECISIONS.md#the-clips-space-the-video-first-one-editor)** — a Video belongs to the Playbook's library, not a chat; one clip editor (library · viewer · inspector that follows the selection · four-track timeline that trims); a chat's clips ARE its video's, kept in sync. Light DS only, footage on a black well.
- **[One voice per network](docs/reference/DECISIONS.md#une-voix-par-réseau--une-seule-règle-partout)** (baked ON) — the **default voice** is generic; each network has its own voice or uses the default. What Archie learns is a proposal, saved only on « Add to Voice profile ». A voice change never rewrites a draft. Copy: default voice · X voice · Add to Voice profile — never « rules for X » nor « voice learned ». Full model: [`FEATURES.md`](docs/reference/FEATURES.md) §9.
- **[The DS ports live in ds-patches.css](docs/reference/DECISIONS.md#the-ds-ports-live-in-ds-patchescss)** — transcriptions of Angular-only DS components, waiting for the DS to publish them.

### Tried and removed — don't propose them back

- Any global settings page; the Topics _magazine_ and its front page.
- Image Studio: the _classic_ / _auto-brief_ arrangements, the Generate | Edit tabs, an Advanced tab.
- Clips: the Clip Studio and the Video Clips modal (deleted 2026-11-27, the Clips space is the only place), the tool rail, the « preview first » editor, a dark mode (2026-10-26), an Audio track (prod has none).
- New chat: a « What are we posting today? » headline, the pixel stage boxing the composer, workflows as tile-cards, then as rows under the composer; the eight HOME-1…8 homes; New Start #1–3 (pixel halo, blank-page top, wall of posts).
- The Playbook as a workspace: one active Playbook in a rail switcher, everything scoped under it, the account home `/home` (`playbookWorkspace`, deleted 2026-11-27).
- Onboarding: the « Try it with a demo brand » demo on Bramble & Bean (`demoMode`, deleted 2026-11-27), the chat onboarding and its accounts step, the connect and networks screens, the Skip dialog, the review as a stack of cards.
- Voice: « A few questions » as a separate way, a « LinkedIn · Default » first-network model, a « chosen default » state, « Use my default voice for X » / « Remove the X voice ».
- Removed flags, never to come back as toggles: `clipsSpace`, `newConversationStyles`, `draftChanges`, `voicePerNetwork`, `connectFirst`, `reviewScroll`, `draftInlineEdit`, `topicFeed`, `playbook2`, `sexySquirrel`, `skipConnectProfiles`, `playbookNoWebsite`, `playbookCompetitors`, `playbookColors`, `manyProfiles`, `statusActionSnackbars` (all baked ON); `playbookWorkspace`, `emptyStateGround`, `demoMode`, `homeOneInput`…`homeDrawer`, `chatPreviewTool`, `newStart`…`newStart3`, `brandTintedPresets`, `playbookDefault`, `imageStudioAutoBrief`, `imageStudioSetupFirst`, `imageStudioV2`, `frontPage`, `topics` (deleted).

## Admin, user mode, feature flags

User mode (`user-mode.js`): `"returning"` (populated mocks, default) or `"new-alt"` (empty stores + first-time onboarding, `isNewUser()`). Flags: `ff-catalog.js`, read with `isFlagOn()`. Each change reloads so stores re-seed. **What each flag gates, in full: [`FEATURES.md`](docs/reference/FEATURES.md) §14.**

| Flag                     | Default | Gates                                                                                                                                            |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `insightsHub`            | OFF     | the whole `/insights` section                                                                                                                    |
| `connectors`             | OFF     | the connectors feature, onboarding's documents step included                                                                                     |
| `conversationStatusCard` | OFF     | the floating status card; with it, the panel has no Overview tab (`hasOverview()`)                                                               |
| `contentPanel`           | **ON**  | the pills become the side panel's tabs (Overview │ Sources › Ideas, Clips › Drafts); results in the thread open the panel, it never opens itself |
| `multilingualPlaybook`   | OFF     | languages per Playbook, voice per language                                                                                                       |
| `playbookSharing`        | OFF     | ownership, three scopes, governance, the profile gate; its demo data seeds only under the flag                                                   |
| `newScheduleModal`       | **ON**  | the redesigned schedule modal; OFF = `schedule-modal-legacy.js`, deleted once the comparison ends                                                |
| `draftMentions`          | OFF     | « mention Notion in the LinkedIn post » from the chat (`mention-flow.js`)                                                                        |
| `uiIdeaCard`             | OFF     | the clearer compact idea card (`renderClearIdeaCard`)                                                                                            |
| `newStart4`              | OFF     | a first-time user with no Playbook lands on a chat that introduces Archie (`session/new-start.js`)                                               |
| `newChatHero`            | OFF     | a first-time user's new chat (turning it on switches to new-alt): grey pixel field, example requests, « No Playbook yet » infobox                |

## Design System — read first before UI/CSS work

Built on the official Agorapulse DS (`@agorapulse/ui-theme` + `@agorapulse/ui-symbol`), **loaded from jsDelivr `@latest`** in `index.html`, nothing vendored. Ad-hoc CSS overriding DS tokens is the #1 source of bugs here.

**All DS work goes through the `/design-guidelines` skill** (`mode: html-prototype`): it reads the specs and the CDN packages and carries the house rules. Generic design skills are a review checklist only. Never the `ds-css` MCP.

1. **Find the component by intent** (the skill's lookup), then its classes in the CDN's `css-ui/index.css`.
2. **Check the icon exists** in `ui-symbol@latest/icons/ap-icons.css` — full class name (`ap-icon-eye-on`, not `ap-icon-eye`).
3. **DS tokens only**, `--sys-*` over `--ref-*`, never `--comp-*` in app CSS. Grey steps are `05 · 10 · 20 · 40 · 60 · 80 · 100 · 150` only.
4. **Custom CSS only if nothing in the DS fits**, in the right file:
   - `styles/ds-patches.css` — the **only** place to touch a `.ap-*` selector (a missing variant, a primitive the DS forgot like `.ap-filter-chip`). It should shrink as the DS evolves.
   - `styles/screens/<screen>.css`, `styles/components/<component>.css` — screen / shared styling. App tokens in `styles/tokens.css`.
   - Redeclaring a `.ap-*` class elsewhere flips the cascade silently. One standing exception, documented at its top: `styles/components/archie-loader.css` claims `.ap-loader` (every spinner is the Archie mark — a brand decision). A second exception needs the same kind of note.
5. **`npm run check:ds` before committing** — an unknown token or icon fails silently (dropped declaration, empty mask); this is the only thing that catches it.

**Colors:** orange = AI / spotlight actions (`.ap-button.primary.orange`); blue = routine CTAs and navigation. Third-party brand colors (connector accents, social logos) live as data in JS, not as tokens. `.ap-icon-sparkles-mermaid` gets its gradient from `ds-patches.css`.

## Key conventions

- All seed data lives under `src/mocks/`, one self-contained file per domain, re-exported by `src/mocks.js` — always import from the barrel.
- Event wiring is pure delegation with `data-*` on the screen / modal / panel root. No inline `onclick`, no per-child listeners.
- The `html` tagged template escapes interpolations: wrap trusted fragments in `raw()`, never `escapeHtml()` a value already interpolated.
- The pre-commit hook runs `check-template-comments.py`, `cache-version.mjs check`, and prettier on staged files.
- One ask = one commit, pushed to `main` (GitHub Pages deploys it); never create branches. Other sessions push to `main` too: fetch before pushing, and merge — never rebase — when behind.

## Docs

Index: [`docs/README.md`](docs/README.md). [`reference/`](docs/reference/) is the current truth (concepts, features, decisions, architecture, routes, stores, DS usage, glossary); [`audits/`](docs/audits/) are dated snapshots — read the date before trusting a detail; [`copy/`](docs/copy/) the UX copy principles; [`specs/`](docs/specs/) acceptance criteria written from the running app.
