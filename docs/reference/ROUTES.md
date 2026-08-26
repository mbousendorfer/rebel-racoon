# Routes & navigation

Source de vérité : [`src/app.js`](../../src/app.js) (route table) + [`src/router.js`](../../src/router.js) (matcher).

## Route table

| Route                | Handler                | Notes                                                                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | `dashboard.js`         | **Redirect**, et rien d'autre : first-time (`new-alt`) → `/welcome-alt` ; returning → most-recent session ou nouvelle session. Cette route a rendu une front page magazine derrière le flag `frontPage` ; c'est parti avec le magazine Topics (voir [`FEATURES.md`](FEATURES.md) §17).                         |
| `/session/:id`       | `session.js`           | La surface chat principale (le plus gros fichier du projet). Héberge le thread assistant, le composer, les flows per-session (intake, draft, clips).                                                                                                                                                           |
| `/contexts`          | `contexts.js`          | Library **Playbooks** : cards (DO/DON'T, brief, color tag) + edit en side panel.                                                                                                                                                                                                                               |
| `/playbook/:id`      | `playbook.js`          | Page détail d'un Playbook. Topbar back → `/contexts`.                                                                                                                                                                                                                                                          |
| `/connectors`        | `connectors.js`        | Gallery des connectors (feature flag `connectors`, default OFF). Détail dans un modal.                                                                                                                                                                                                                         |
| `/topics`            | `topics.js`            | Le **Topic Feed** : deux segments (Ready to draft / Topics for later), un dropdown Filters, trois groupes d'âge, pagination par 10, et l'article en **master–detail** à côté de la liste. Scopé à **un** Playbook par `?pb=` — jamais un scope global. Flag `topicFeed`, default OFF ; deep-link périmé → `/`. |
| `/topics/settings`   | `topics-settings.js`   | **Feed settings** — les huit sources d'écoute + la cadence + les sites de la source Brand website, scopés à un Playbook (`?pb=`). Une page, pas un onglet : on la règle une fois. Commit direct, aucune barre Save. Topbar back → `/topics`.                                                                   |
| `/welcome-alt`       | `welcome-alt.js`       | Onboarding first-time. Redirige vers une session transitoire. Body en `.onboarding` (full-bleed).                                                                                                                                                                                                              |
| `/welcome-alt/recap` | `welcome-alt-recap.js` | Recap final du Playbook construit pendant l'onboarding.                                                                                                                                                                                                                                                        |

## Matching & lifecycle

Le router (`src/router.js`) :

1. Écoute `hashchange` sur `window`.
2. Sépare le path de la query : `#/session/abc?tab=posts` → path = `/session/abc`, query = `tab=posts`.
3. Cherche la 1ère route qui match le path (avec `:param` extraction).
4. Si match : appelle `cleanup()` du précédent handler (s'il en a retourné une), vide `#app`, appelle le nouveau handler avec `({ ...params }, target)`.
5. Si pas de match : fallback (à confirmer dans le code — généralement redirection home ou 404 silencieux).

**Important** : le router re-run le handler sur **chaque hashchange**, y compris pour des changements de query (à path identique). C'est intentionnel — l'écran réagit aux query params (tab, focusIdea, etc.).

## URL state (hash query params)

Toutes les query params sont encodées dans le hash. Helpers dans [`src/url-state.js`](../../src/url-state.js) :

```js
import { parseHashParams, setHashQuery } from "./url-state.js";

const { tab, focusIdea } = parseHashParams();
setHashQuery("/session/abc", { tab: "posts", focusIdea: "i-42" });
```

`setHashQuery` appelle `navigate()` du router. Idiomatic pour pousser un changement d'état d'écran sans reload.

Exemples observés :

- `/session/:id?tab=posts` — Posts tab actif (right panel mode `drafts`)
- `/session/:id?focusIdea=…` — scroll-and-highlight d'une idée précise
- `/topics?pb=ctx-…` — le feed **scopé** à un Playbook. Un `?pb=` pointant vers un Playbook disparu retombe sur le défaut plutôt que de vider l'écran sans explication
- `/topics?topic=topic-…` — ouvre le feed avec **l'article de ce Topic déjà affiché**, et élargit le filtre de statut à **tous** les états pour cette visite : un Topic ignoré n'est pas dans la vue par défaut, donc l'article s'ouvrirait sinon sur une carte que la liste ne montre pas
- `/topics/settings?pb=ctx-…` — la page de réglages **scopée** au même Playbook. `?pb=` est une seule idée partagée par les deux surfaces, donc le scope survit à l'aller comme au retour (la topbar renvoie « Back to the feed » avec le param). Obligatoire sur les réglages : sans lui, configurer B puis Retour montrerait A. Le back du topbar le remporte vers le feed.
- (autres possibles : `?tab=ideas`, `?tab=sources`, `?tab=clips`, etc.)

## Handoffs entre routes

`src/handoff.js` est un bridge à usage unique sur `sessionStorage`.

```js
import { setHandoff, consumeHandoff, hasHandoff } from "./handoff.js";

// avant de navigate
setHandoff("pendingDraftIdeaId", { ideaId: "i-42" });
navigate("/session/abc");

// dans le handler de la destination
const payload = consumeHandoff("pendingDraftIdeaId"); // atomic read+remove
if (payload) {
  /* … */
}
```

### Handoffs actifs (consumés au mount de `session.js`)

| Clé                          | Posé par                                              | Consommé par →                      |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `pendingStartFlow`           | dashboard / new chat with a Playbook                  | `startActionPickerFlow`             |
| `pendingDraftIdeaId`         | idea card "Draft post"                                | `askProfileQuestion` (`draft-flow`) |
| `pendingAskSource`           | source card "Ask"                                     | `askWhatToKnow`                     |
| `pendingAskConnector`        | connectors gallery / modal "Try in chat"              | `askConnector` (`connector-ask`)    |
| `pendingTopicChat`           | Use in chat, depuis les quatre surfaces qui l'offrent | `attachTopicToChat` (`topic-flow`)  |
| `pendingStartContextBuilder` | `/contexts` "New Playbook" + welcome-alt              | `context-builder` (création)        |
| `pendingStartPlaybookEditor` | `/contexts` card edit                                 | `playbook-editor`                   |

## Navigation interne — patterns

### Côté code

```js
import { navigate } from "./router.js";

// changer de route
navigate("/contexts");

// avec query
setHashQuery("/session/abc", { tab: "ideas" });
```

### Côté HTML

Les liens utilisent `href="#/route"` :

```html
<a href="#/contexts" class="ap-button stroked">All playbooks</a>
```

Et le router gère le hashchange naturellement (pas besoin de preventDefault sauf cas particulier).

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — lifecycle global de l'app
- [`STORES.md`](STORES.md) — comment les screens consomment les stores
- [`../../CLAUDE.md`](../../CLAUDE.md) — résumé pour agents
