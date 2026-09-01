# Architecture

> Vue d'ensemble du proto, conventions structurelles, lifecycle. Compagnon de [`CLAUDE.md`](../../CLAUDE.md), zoomable sur les conventions d'architecture.

## Principes

- **Vanilla JS pur** — pas de framework, pas de bundler, pas de build, pas de dépendance runtime externe.
- **ES modules** servis directement depuis `src/`, avec un suffixe `?v=N` de cache-bust — **un seul numéro pour toute l'app**, réécrit en une passe par `npm run bump` (cf. § Cycle d'import).
- **Pure event delegation** — chaque écran/modal/composant attache un seul listener sur sa racine et dispatche via `data-*`. Aucun `onclick=` inline, aucun listener per-child sur les enfants interactifs.
- **Mocks** — toutes les seed data sont sous `src/mocks/`, un fichier par domaine derrière le barrel `src/mocks.js`. Aucune persistance d'état app (seul `archie-user-mode`, les feature flags, l'état collapse de la sidebar et les `sessionStorage` handoffs survivent au reload).

## Lifecycle de l'app

1. `index.html` (~50 lignes) charge tous les CSS et `src/app.js`.
2. `app.js` :
   - importe les screens (renderers) + composants + modaux
   - appelle `init()` sur chaque composant (qui injecte son DOM une fois dans `<body>`)
   - enregistre les routes via `route(path, handler)` (cf. `src/router.js`)
   - appelle `start()` qui lance le premier `hashchange`
3. À chaque `hashchange`, `router.js` :
   - match le path (query stripped)
   - vide `#app`
   - appelle `cleanup` retourné par le précédent handler (si défini)
   - appelle le handler du nouveau path : `renderXxx(params, target)`
4. `setAfterRender` (dans `app.js`) re-render la sidebar + la `conversation-status-card` après chaque route change, et toggle la classe `body.onboarding` pour le flow welcome-alt (layout full-bleed).

## Topologie de l'app shell

```
<body>
  #sidebar          ← persistent, géré par src/components/sidebar.js
  #topbar           ← persistent, géré par src/components/topbar.js
  #app              ← contenu de la route active, vidé/recréé sur hashchange
  #rightPanel       ← persistent overlay, géré par src/components/right-panel.js
  #toastRegion      ← portal pour les toasts (DS .ap-snackbar)
  #conversationStatusCard ← floating indicator
  [modals]          ← chacun s'injecte sur init(), un seul ouvert via modal-coordinator
</body>
```

## Source layout (résumé)

| Domaine                           | Fichiers                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bootstrap**                     | `app.js`, `router.js`, `url-state.js`, `handoff.js`, `utils.js`, `store-utils.js`, `user-mode.js`, `feature-flags.js`, `ff-catalog.js`, `file-kinds.js`, `mocks.js` + `mocks/`, `archie-loader.js`, `figma-capture.js`, `org.js`, `playbook-access.js`                                                                                                                                               |
| **Stores**                        | `sessions-store.js`, `contexts-store.js`, `connectors-store.js`, `library.js`, `posts-store.js`, `assistant.js`, `sources-stream.js`, `schedule-store.js`, `topic-feeds-store.js`, `topics-store.js`, `folders-store.js`, `top-posts-store.js`, `feedback-store.js`, `composer-mentions.js`, `image-studio.js` (moteur du studio) — voir [`STORES.md`](STORES.md)                                    |
| **Flow orchestrators**            | `draft-flow.js`, `draft-rewrite.js`, `context-builder.js`, `playbook-view.js`, `context-mock-analysis.js`, `sidebar-wizard.js`, `inline-question.js`, `library-actions.js`, `topic-article.js`, `topic-flow.js`, `top-posts-flow.js`, `social-profiles.js`, `clip-formats.js`, `connectors-view.js`, `connector-ask.js`, `composer-connector.js`, `languages.js`, `url-services.js`, `admin-menu.js` |
| **Studios**                       | `batch-studio.js`, `clip-studio.js`, `caption-editor.js`, `clip-captions.js`, `clip-subtitles.js`, `image-studio.js`, `image-studio-canvas.js`                                                                                                                                                                                                                                                       |
| **Screens**                       | `screens/{dashboard, session, contexts, playbook, connectors, topics, topics-settings, welcome-alt, welcome-alt-recap}.js` + `screens/_analyse-common.js` + `screens/session/{intake-lifecycle, thinking-chip, thread-turns, wizard-keyboard}.js`                                                                                                                                                    |
| **Components (persistent shell)** | `components/{topbar, sidebar, right-panel, conversation-status-card, content-workspace, toast, shortcut-legend}.js`                                                                                                                                                                                                                                                                                  |
| **Components (cards)**            | `components/{source-card, idea-card, idea-card-compact, post-card, clip-card, social-post-card, topic-card, top-post-card, empty-state}.js`                                                                                                                                                                                                                                                          |
| **Components (shared bits)**      | `components/{more-menu, dropzone, tooltip, feedback-control}.js`                                                                                                                                                                                                                                                                                                                                     |
| **Modals**                        | `components/{add-source, connectors, topic-picker, topic-ignore, topic-history, video-clips, schedule, bug-report, feedback, chat-picker, confirm, rename, search, save-folder, share-playbook, analyze-profiles, fill-document}-modal.js` + `components/image-studio-v2/` (the Image Studio, 17 modules — voir [`FEATURES.md`](FEATURES.md) §7)                                                     |
| **Modal coordinator**             | `modal-coordinator.js` — one-overlay-at-a-time orchestration                                                                                                                                                                                                                                                                                                                                         |

## Conventions de fichiers

### Composants persistants

Chaque composant exporte `init()` (injection DOM idempotente) + une API de render/open/close. Les listeners DOM sont scopés à la racine du composant et installés une fois dans `init()`.

```js
// Pattern type
let inited = false;
let root;
export function init() {
  if (inited) return;
  inited = true;
  document.body.insertAdjacentHTML("beforeend", `<aside id="myComponent">…</aside>`);
  root = document.getElementById("myComponent");
  root.addEventListener("click", handleDelegatedClick);
  subscribe(render); // store subscription
}
```

### Screens

Chaque screen exporte `renderXxx(params, target)`. Peut retourner une cleanup function appelée par le router à la sortie.

```js
export function renderSession(params, target) {
  const sessionId = params.id;
  target.innerHTML = html`…`;
  const unsubscribe = subscribeThread(sessionId, () => paintThread(sessionId));
  return () => unsubscribe();
}
```

### Modaux

Pattern uniforme :

```js
// pseudo-code
let inited = false,
  dialog,
  lastFocus;
const MODAL_ID = "addSourceModal";

export function init() {
  if (inited) return;
  inited = true;
  document.body.insertAdjacentHTML("beforeend", `<dialog id="${MODAL_ID}">…</dialog>`);
  dialog = document.getElementById(MODAL_ID);
  bindOverlayDismissal(dialog, close);
}

export function open() {
  lastFocus = document.activeElement;
  requestOpen(MODAL_ID, close); // modal-coordinator
  dialog.hidden = false;
  dialog.querySelector("[autofocus]")?.focus();
}

function close() {
  dialog.hidden = true;
  notifyClose(MODAL_ID);
  lastFocus?.focus({ preventScroll: true });
}
```

Voir `src/modal-coordinator.js` pour le pattern global one-overlay-at-a-time.

## Rendering — html\`\` + raw()

`src/utils.js` expose deux tag templates :

```js
import { html, raw, escapeHtml } from "./utils.js";

const safe = html`<div class="card">${userInput}</div>`; // escape par défaut
const wrapped = html`<div>${raw(prerenderedHtml)}</div>`; // n'escape pas raw()
```

**Règle d'or** : ne jamais appeler `escapeHtml()` sur une valeur déjà interpolée dans `html\`\``. Double-escape = bug (cf. la section "HTML rendu en clair" historique).

## Cycle d'import + versioning

Les imports portent un suffixe `?v=N`, et **c'est le même numéro partout** — dans `src/`, dans les `<link>` de `index.html`, et sur le `<script>` d'entrée :

```js
import { sendMessage } from "./assistant.js?v=1004";
```

Le navigateur cache un module par son URL exacte : un store nommé à deux versions devient deux instances (state map + subscribers séparés). Un numéro unique rend la divergence impossible plutôt que simplement déconseillée.

```bash
npm run bump            # N → N+1 partout, en une passe
npm run check:versions  # échoue si un ?v= diverge — le hook pre-commit le lance
```

Ne jamais éditer un `?v=` à la main : `scripts/cache-version.mjs` détient le numéro et couvre aussi les `import("…")` dynamiques, qu'un sed manuel oubliait. Plus de détails dans [`STORES.md#singleton-warning`](STORES.md#singleton-warning).

## Voir aussi

- [`ROUTES.md`](ROUTES.md) — route table + handoffs + URL state
- [`STORES.md`](STORES.md) — patterns d'état + API par store
- [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — DS workflow + conventions CSS
- [`GLOSSARY.md`](GLOSSARY.md) — vocabulaire produit + pipeline
- [`../../CLAUDE.md`](../../CLAUDE.md) — guide canonique pour les agents
