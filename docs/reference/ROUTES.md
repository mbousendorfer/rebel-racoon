# Routes & navigation

Source de vérité : [`src/app.js`](../../src/app.js) (route table) + [`src/router.js`](../../src/router.js) (matcher).

## Route table

| Route                | Handler                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | `dashboard.js`         | **Redirect**, et rien d'autre : first-time (`new-alt`) → `/welcome-alt` ; returning → most-recent session ou nouvelle session. Cette route a rendu une front page magazine derrière le flag `frontPage` ; c'est parti avec le magazine Topics (voir [`FEATURES.md`](FEATURES.md) §17). ⚠️ `/home` n'est pas son retour : `/` est la maison de la **marque** active, `/home` celle du **compte**, et elle ne rend toujours rien. |
| `/session/:id`       | `session.js`           | La surface chat principale (le plus gros fichier du projet). Héberge le thread assistant, le composer, les flows per-session (intake, draft, clips).                                                                                                                                                                                                                                                                            |
| `/home`              | `home.js`              | La **home du compte** (flag `playbookWorkspace`) : un héro (prompt + picker de Playbook + Send) au-dessus de deux onglets — **Chats** (tous les chats, toutes marques ; le défaut) et **Playbooks** (le catalogue, chaque carte étant une porte vers son workspace). Account scope, pas de rail. Flag OFF, la route rebondit sur `/`.                                                                                           |
| `/contexts`          | `home.js`              | Library **Playbooks** : cards (DO/DON'T, brief, color tag) + edit en side panel. En workspace mode elle `replace` vers `/home` — le catalogue y est l'onglet Playbooks — donc tout deep link périmé atterrit encore ; flag OFF elle rend la library comme avant.                                                                                                                                                                |
| `/playbook/:id`      | `playbook.js`          | Page détail d'un Playbook. Topbar back → `/contexts`. Sous `playbookWorkspace` la fiche de la marque **active** est une route in-workspace (rail conservée, pas de back, titre « Playbook ») ; celle d'une autre marque est en account scope, back → `/home`.                                                                                                                                                                   |
| `/connectors`        | `connectors.js`        | Gallery des connectors (feature flag `connectors`, default OFF). Détail dans un modal.                                                                                                                                                                                                                                                                                                                                          |
| `/topics`            | `topics.js`            | Le **Topic Feed** : une seule liste, un dropdown Filters portant les six états, trois groupes d'âge, pagination par 10, et l'article en **master–detail** à côté de la liste. Scopé à **un** Playbook par `?pb=` — jamais un scope global. Flag `topicFeed`, default OFF ; deep-link périmé → `/`.                                                                                                                              |
| `/topics/settings`   | `topics-settings.js`   | **Feed settings** — les huit sources d'écoute + la cadence + les sites de la source Brand website, scopés à un Playbook (`?pb=`). Une page, pas un onglet : on la règle une fois. Commit direct, aucune barre Save. Topbar back → `/topics`.                                                                                                                                                                                    |
| `/welcome-alt`       | `welcome-alt.js`       | Onboarding first-time. Redirige vers une session transitoire. Body en `.onboarding` (full-bleed).                                                                                                                                                                                                                                                                                                                               |
| `/welcome-alt/recap` | `welcome-alt-recap.js` | Recap final du Playbook construit pendant l'onboarding.                                                                                                                                                                                                                                                                                                                                                                         |

## Deux niveaux de chrome (flag `playbookWorkspace`)

Le shell a deux états, et c'est le **scope de l'objet** qui décide — pas la route :

| État                               | Routes                                                                                         | Chrome                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace** (défaut)             | tout ce qui est d'**une** marque : `/session/*`, `/topics*`, `/insights*`, `/playbook/<actif>` | rail complète (switcher + nav + chats scopés)                                                                                                     |
| **Account** (`body.account-scope`) | ce qui parle des **autres** marques : `/home`, `/contexts`, `/playbook/<autre>`                | **pas de rail**, une colonne, topbar réduite au retour (« ‹ Back to <marque> » depuis le catalogue, « ‹ Back to all playbooks » depuis une fiche) |

Le prédicat est `isAccountScope(path)` dans [`active-playbook.js`](../../src/active-playbook.js), posé sur `<body>` par `setAfterRender` ([`app.js`](../../src/app.js)) et lu par la topbar pour son retour. Sans le flag il renvoie toujours `false` : un seul état de chrome, comme avant.

⚠️ En account scope **le switcher n'est pas à l'écran** — c'est pourquoi les cartes du catalogue portent un lien **Switch** : sinon la seule sortie serait le retour vers la marque d'où l'on vient.

## Matching & lifecycle

Le router (`src/router.js`) :

1. Écoute `hashchange` sur `window`.
2. Sépare le path de la query : `#/session/abc?tab=posts` → path = `/session/abc`, query = `tab=posts`.
3. Cherche la 1ère route qui match le path (avec `:param` extraction).
4. Si match : appelle `cleanup()` du précédent handler (s'il en a retourné une), puis le nouveau handler avec `({ ...params }, target)`. **Le router ne vide pas `#app`** — c'est le handler qui écrit dans `target`. Puis `afterRender(path, params)` et `target.scrollTop = 0`.
5. Si pas de match : `navigate("/")`. `/` étant toujours enregistrée, le `Not found.` du router est une garde défensive qu'on n'atteint pas.

`getPath()` lit aussi un `?route=/foo` en query : le script de capture Figma impose un hash en `#figmacapture=`, incompatible avec le router — ce param est la porte de sortie (cf. [`src/figma-capture.js`](../../src/figma-capture.js)).

**Important** : le router re-run le handler sur **chaque hashchange**, y compris pour des changements de query (à path identique). C'est intentionnel — l'écran réagit aux query params (tab, focusIdea, etc.).

## URL state (hash query params)

Toutes les query params sont encodées dans le hash. Helpers dans [`src/url-state.js`](../../src/url-state.js) :

```js
import { parseHashParams, setHashQuery } from "./url-state.js";

const { tab, focusIdea } = parseHashParams();
setHashQuery("/session/abc", { tab: "posts", focusIdea: "i-42" });
```

`setHashQuery` appelle `navigate()` du router. Idiomatic pour pousser un changement d'état d'écran sans reload.

Exemples en service : `#/session/:id?tab=…&focusIdea=…`, `#/topics?pb=…` (flag OFF), et `#/home?tab=chats|playbooks` — les deux listes de la home, dans l'URL pour que le Back du navigateur passe de l'une à l'autre ; **Chats est le défaut**, et une valeur inconnue y retombe.

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
import { setHandoff, consumeHandoff } from "./handoff.js";

// avant de navigate
setHandoff("pendingAskSource", { sourceId: "src-1", filename: "notes.pdf" });
navigate("/session/abc");

// dans le handler de la destination
const payload = consumeHandoff("pendingAskSource"); // atomic read+remove
if (payload) {
  /* … */
}
```

### Handoffs actifs (consumés au mount de `session.js`)

| Clé                          | Posé par                                                                                                       | Consommé par →                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `pendingAskSource`           | source card "Ask"                                                                                              | `askWhatToKnow`                    |
| `pendingAskConnector`        | connectors gallery / modal "Try in chat"                                                                       | `askConnector` (`connector-ask`)   |
| `pendingTopicChat`           | Use in chat, depuis les trois surfaces qui naviguent (le picker du composer est inline et attache directement) | `attachTopicToChat` (`topic-flow`) |
| `pendingStartContextBuilder` | `/contexts` "New Playbook" + welcome-alt                                                                       | `context-builder` (création)       |
| `pendingHomePrompt`          | le héro de la home du compte (Send / Enter)                                                                    | `sendMessage` (session.js)         |
| `OBJECTIVE_CHAT_HANDOFF`     | `objective-flow.js` — « Fix this in a chat » / repurpose d'un post                                             | `startObjectiveChat`               |
| `pendingStartClipStudio`     | composer session → "Extract video clips"                                                                       | `clipStudio.start` (nouveau chat)  |
| `pendingStartBatch`          | composer session → "Batch of posts"                                                                            | `batchStudio.start` (nouveau chat) |

Une clé **consommée mais jamais posée** se lit comme un point d'entrée vivant alors qu'elle est morte : `pendingStartFlow` et `pendingDraftIdeaId` sont restés dans cette table longtemps après que leurs producteurs aient été remplacés. N'ajouter une ligne qu'avec les deux bouts.

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
