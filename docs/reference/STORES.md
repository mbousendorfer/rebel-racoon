# Stores & state management

Pas de librairie externe (Redux, Zustand, etc.). Le proto a son propre pattern minimaliste documenté ici.

## Pattern de base

Chaque store suit cette structure :

```js
import { createNotifier } from "./store-utils.js";

const state = new Map(); // sessionId → state (ou un array pour un catalogue)
const { subscribe, notify } = createNotifier("storeName");

function seed(sessionId) {
  // lazy seed depuis mocks/, sauf en mode new-alt
  if (isNewUser()) return emptyState();
  return mocks.byId(sessionId) ?? emptyState();
}

function get(sessionId) {
  if (!state.has(sessionId)) state.set(sessionId, seed(sessionId));
  return state.get(sessionId);
}

export function getX(sessionId) {
  return get(sessionId).x;
}
export function setX(sessionId, x) {
  state.get(sessionId).x = x;
  notify({ sessionId }); // shallow notify
}
export { subscribe };
```

Voir [`src/store-utils.js`](../../src/store-utils.js) pour `createNotifier()`.

## Catalogue des stores

| Store                                                    | Domaine                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | API publique principale                                                                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`sessions-store.js`](../../src/sessions-store.js)       | Sessions de chat                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `getSessions`, `getSessionById`, `updateSession`, `deleteSession`, `togglePin`, `subscribe`                                                                                                                      |
| [`contexts-store.js`](../../src/contexts-store.js)       | Playbooks (Contexts en code). Porte aussi l'appartenance (`ownerId` / `scope` / `history`, flag `playbookSharing`) — mais **ne filtre jamais** : les droits vivent dans [`playbook-access.js`](../../src/playbook-access.js), voir le § ci-dessous.                                                                                                                                                                                                                                                           | `getContexts`, `getContextById`, `getDefaultContext`, `addContext`, `updateContext`, `duplicateContext`, `deleteContext`, `appendHistory`, `subscribe`                                                           |
| [`connectors-store.js`](../../src/connectors-store.js)   | Catalogue + état de connection des connectors                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `getConnectors`, `findConnector`, `getConnectedConnectors`, `setConnectorStatus`, `subscribe`                                                                                                                    |
| [`library.js`](../../src/library.js)                     | Ideas **per-session**, une seule liste. Le pool global (`mocks.ideas`) que lisaient le panneau de droite, `draft-flow` et `assistant` a été supprimé — il faisait lister à un chat les ideas des autres. `assistant` lit les ideas via `setIdeasReader(getIdeas)`, injecté ici : `library` importe `assistant`, donc l'inverse fermerait un cycle.                                                                                                                                                            | `getSources(sid)`, `getIdeas(sid)`, `appendExtractedIdeas`, `injectIdeasForSource`, `extractVideoIdeas`, `removeIdeas`, `removeIdeasForSources`, `clearSession`, `subscribe(sid, fn)`                            |
| [`posts-store.js`](../../src/posts-store.js)             | Drafts per-session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `getPosts(sid)`, `addPostDraft`, `updatePostContent`, `attachImageToDraft`, `attachCarouselToDraft`, `setSubtitleStyle`, `updatePostClip`, `insertPost`, `removePost`, `clearSession`, `subscribe(sid, fn)`      |
| [`assistant.js`](../../src/assistant.js)                 | Thread conversationnel per-session                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `getThread`, `sendMessage`, `sendConnectorMessage`, `postAssistantMessage`, `postSourceIntake`, `postExtractionResult`, `postAssistantChoice` / `submitAssistantChoice`, `postDraftResult`, `subscribe(sid, fn)` |
| [`sources-stream.js`](../../src/sources-stream.js)       | Sources **per-session** (`Map(sessionId → Source[])`, subscribers par session, `clearSession()`) + uploads **globaux** (transitoire) · state machine (uploading → processing → done)                                                                                                                                                                                                                                                                                                                          | `getSources`, `getUploads`, `subscribeSources`, `subscribeUploads`, `startFileUpload`, `startUrlImport`, `startConnectorImport`, `extractClipsForSource`, `removeSources`, `renameSource`                        |
| [`schedule-store.js`](../../src/schedule-store.js)       | Queue des posts schedulés (calendrier)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `getQueue`, `getQueueOn`, `addToQueue`, `busyCountsByDay`, `subscribe`                                                                                                                                           |
| [`composer-mentions.js`](../../src/composer-mentions.js) | Mentions @ dans le composer per-session                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `addMention`, `removeMention`, `renderInto`, `subscribe(sid, fn)`                                                                                                                                                |
| [`topic-feeds-store.js`](../../src/topic-feeds-store.js) | **Global** : un **feed par Playbook** — quelles sources écoutent, à quelle cadence, quels sites la source Brand website lit (flag `topicFeed`). `provisionMissingFeeds()` en crée un **à la lecture** pour tout Playbook qui n'en a pas, donc une marque neuve n'a jamais à configurer quoi que ce soit d'abord — et rien ici ne peut en supprimer un, la lecture suivante le reconstruirait.                                                                                                                 |
| [`topics-store.js`](../../src/topics-store.js)           | **Global** : les Topics d'un feed **plus le triage**, dans deux structures séparées. `status` / `isTrending` / `isUpdated` sont trois champs distincts, et le triage vit dans sa propre `Map` — un Topic est ce que le scan a rendu, une ligne de triage est ce que cet utilisateur en a fait, donc un re-scan ne peut pas écraser la réponse. `withTriage()` **efface** les deux signaux au-delà du premier groupe d'âge : chaque lecture passe par là, donc toutes les surfaces sont d'accord gratuitement. |
| [`folders-store.js`](../../src/folders-store.js)         | **Global** : dossiers de contenu Agorapulse dans lesquels un draft sauvegardé est classé (catalogue, pas de scope session)                                                                                                                                                                                                                                                                                                                                                                                    | `getFolders`, `addFolder`, `addDraftsToFolder`                                                                                                                                                                   |
| [`top-posts-store.js`](../../src/top-posts-store.js)     | **Global** : posts publiés servant de matière au flow Repurpose                                                                                                                                                                                                                                                                                                                                                                                                                                               | `getTopPosts`, `getTopPost`                                                                                                                                                                                      |
| [`feedback-store.js`](../../src/feedback-store.js)       | **Global**, keyé par `targetId` (`draft:<id>` / `image:<id>:<seed>` / `clip:<id>`) : le verdict pouce haut/bas + détail (raisons, commentaire) sur tout élément généré par Archie                                                                                                                                                                                                                                                                                                                             | `getFeedback`, `setVerdict`, `recordDetail`                                                                                                                                                                      |

## Les globaux du listening

La plupart des stores sont per-session (Map<sessionId, state>) — `sources-stream` compris : ses sources sont scopées au chat qui les a créées, seuls ses **uploads** (état transitoire d'avant-source, que la modale lit comme un pool) sont globaux. `library.js` re-émet par session pour que les écrans abonnés à `library.subscribe(sid)` repaint quand une source landed.

Les vrais globaux sont les **catalogues** — ils préexistent à tout chat : `contexts`, `connectors`, `folders`, `sessions`, `schedule`, `top-posts`, et les deux stores du listening ci-dessous. Voir [`CONCEPTS.md` §3](CONCEPTS.md#3-à-qui-appartient-quoi).

**Deux stores, et les deux sont globaux.** Un feed apparie un Playbook à des sources et tourne sur une cadence ; un Topic appartient à ce feed et arrive dessus — l'un comme l'autre bien avant qu'un chat existe pour l'accueillir. Rien de tout ça n'est per-session, et c'est ce qui les met du côté des catalogues.

**Le feed est scopé, donc ses compteurs le sont.** Le compteur de la ligne de nav est le nombre de Topics **à revoir** du feed du Playbook par défaut, pas une somme sur tout le compte : la surface qu'il envoie ouvrir n'en montre qu'un. Il n'y a **pas** de scope global à lire — le module `active-playbook.js` du fork, qui persistait un scope en `localStorage` et se faisait écrire par un select posé dans une barre de filtres, n'est délibérément pas porté. `?pb=` dit la même chose et s'arrête à son écran.

**Aucun scan au boot.** Le magazine appelait un `maybeAutoScan()` au démarrage pour qu'un dossier soit déjà arrivé avant le premier render. Le Topic Feed ne le fait pas : sa file est seedée pleine, avec un vrai étalement de statuts et de groupes d'âge, donc la fraîcheur se lit dans la donnée plutôt que dans une arrivée rejouée à chaque rechargement.

## Le store ne filtre pas : `playbook-access`

[`playbook-access.js`](../../src/playbook-access.js) n'est pas un store — c'est une couche de prédicats **au-dessus** de `contexts-store`. Le partage aurait pu être implémenté en filtrant `getContexts()` ; ça a été écarté pour une raison précise.

Un chat dont le Playbook a cessé d'être partagé doit encore pouvoir le **nommer** : _« ce chat tournait sur Brightline · launch, et Jonas Beck a arrêté de le partager »_. Écrire cette phrase demande de lire une fiche qu'on n'a plus le droit d'ouvrir. Un store filtré rendrait ce bandeau impossible — il faudrait dupliquer les noms ailleurs, ou renoncer à la phrase.

Donc : **le store tient les faits, ce module tient les droits.** Les surfaces substituent `visibleContexts()` / `usableContexts()` / `editableContexts()` à `getContexts()`, et `revokedContextFor()` est le seul autorisé à regarder par-dessus la barrière. Le flag est court-circuité en un seul endroit (`on()`), donc flag OFF = tout permis, à l'identique d'avant.

Corollaire pour les mocks : les stores de contenu (`posts-store`, `library`) construisent leur set « est-ce un chat de démo à seeder ? » depuis `mocks.allSeedSessions`, pas depuis `recentSessions` — sinon le chat seedé sous flag arrive avec des panneaux vides.

## Persistence

**Rien n'est persisté côté app state.** Seuls survivent au reload :

| Clé localStorage / sessionStorage | Domaine                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `archie-user-mode`                | `"returning"` vs `"new-alt"` (cf. `user-mode.js`)                   |
| `archie-feature-flags`            | Tous les feature flags, un seul objet JSON (cf. `feature-flags.js`) |
| `archie-org-role`                 | `"member"` vs `"manager"` (cf. `org.js`, flag `playbookSharing`)    |
| Sidebar collapse state            | UI prefs                                                            |
| `pending*` keys                   | Handoffs sessionStorage (consommés une fois)                        |

→ Refresh = retour aux mocks (sauf si en `new-alt` mode = state vide).

## User mode + feature flags

```js
import { getUserMode, isNewUser } from "./user-mode.js";
import { isFlagOn } from "./feature-flags.js";

if (isNewUser()) seedEmpty();
if (isFlagOn("connectors")) showConnectorsNav();
```

- [`src/user-mode.js`](../../src/user-mode.js) — `"returning"` (default, populated mocks) ou `"new-alt"` (empty + onboarding)
- [`src/feature-flags.js`](../../src/feature-flags.js) — get/set, store dans localStorage
- [`src/ff-catalog.js`](../../src/ff-catalog.js) — catalogue avec defaults

Switch UI : le cog de la sidebar → **Admin** (un reload est forcé pour que les stores re-seedent).

## Invariants

### 1. Subscribers ne fail jamais le notifier

`createNotifier()` wrappe chaque subscriber dans un `try/catch` et `console.warn` en cas d'erreur. Un subscriber broken ne tue pas les autres.

### 2. Pas de couplage entre stores

Aucun store n'importe un autre store directement. Les flow orchestrators (`draft-flow.js`, `context-builder.js`, etc.) sont les seuls à composer plusieurs stores.

Exception : `library.js` subscribe à `sources-stream` pour re-émettre per-session — c'est OK car c'est une mécanique de fan-out documentée.

### 3. Lazy seed

Un store ne crée jamais d'entrée pour une sessionId tant que `getX(sid)` n'a pas été appelée. Évite la fuite si on liste 100 sessions dans la sidebar mais qu'on n'en ouvre qu'une.

## Singleton warning {#singleton-warning}

Le système `?v=N` du cache-bust **rend deux imports avec versions différentes équivalents à deux modules séparés**. Conséquence :

```js
// fichier A.js
import { getSessions } from "./sessions-store.js?v=12"; // instance #1

// fichier B.js
import { getSessions } from "./sessions-store.js?v=13"; // instance #2 — !!
```

Les deux instances ont leurs propres `state` Map et `subscribers` Set — deux copies du store, avec des états qui divergent. C'est arrivé plusieurs fois sur `main`.

D'où la règle actuelle : **un seul numéro pour toute l'app**, réécrit en une passe.

```bash
npm run bump            # N → N+1 dans src/ ET dans index.html
npm run check:versions  # échoue si un ?v= diverge — lancé par le hook pre-commit
```

`scripts/cache-version.mjs` détient le numéro. Ne jamais éditer un `?v=` à la main : le sed manuel oubliait systématiquement les `import("…")` dynamiques (`right-panel` → `session.js`, les `toast.js` paresseux…), et c'est exactement là que la divergence se logeait.

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — patterns de composants + screens
- [`ROUTES.md`](ROUTES.md) — comment les screens montent/démontent leurs subscriptions
- [`GLOSSARY.md`](GLOSSARY.md) — vocabulaire (Session, Playbook, Source, Idea, Draft)
