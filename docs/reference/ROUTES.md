# Routes & navigation

Source de vérité : [`src/app.js`](../../src/app.js) (route table) + [`src/router.js`](../../src/router.js) (matcher).

## Route table

| Route                                                                                  | Handler                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                    | `dashboard.js`                                                                  | **Redirect**, et rien d'autre (`location.replace`) : `new-alt` sans Playbook → `/welcome-alt` ; sinon le chat le plus récent **du scope** (`scopeSessions`), ou `/session/new`. ⚠️ Une front page magazine (flag `frontPage`) y a vécu et a été supprimée avec le magazine Topics : ne pas la ramener. `/home` n'est pas son retour : `/` est la maison de la **marque** active, `/home` celle du **compte**. |
| `/session/:id`                                                                         | `session.js`                                                                    | La surface chat : thread, composer, flows per-session (intake, draft, clips), les studios (`batch-*`, `clip-studio-*`, lancés par handoff). `new` / `new-<id>` = un chat pas encore créé.                                                                                                                                                                                                                     |
| `/home`                                                                                | `home.js`                                                                       | La **home du compte** (flag `playbookWorkspace`) : un héro (prompt + picker de Playbook + Send, absent s'il n'y a rien à choisir) au-dessus de deux onglets — **Chats** (le défaut) et **Playbooks** (`?tab=playbooks`). Account scope, pas de rail. Flag OFF → `replace` vers `/`.                                                                                                                           |
| `/contexts`                                                                            | `home.js` (`renderContextsRoute`)                                               | Le catalogue des **Playbooks** (grille de cartes ; une carte ouvre la fiche). En workspace mode elle `replace` vers `catalogueRoute()` = `/home?tab=playbooks`, donc un deep link périmé atterrit sur le bon onglet.                                                                                                                                                                                          |
| `/playbook/:id`                                                                        | `playbook.js`                                                                   | La fiche d'un Playbook. `?tab=` goals (défaut, absent de l'URL) · voice · brand · images · competitors · influencers (`images` seulement sur un Playbook enregistré ; l'ancien `?section=` est encore lu) ; `?voice=<réseau>` choisit la voix affichée dans l'onglet Voice. Tab et voix s'écrivent par `history.replaceState`, sans re-render. Retour : voir § chrome.                                        |
| `/playbook/:id/styles/new`, `/playbook/:id/styles/:styleId`                            | `modules/image-studio/index.js` (`ROUTES`)                                      | Le **créateur de style** de la marque, ouvert depuis l'onglet **Image generation** de la fiche (« Create a style ») ; enregistre sur le Playbook (`imageStyles`). `new` est enregistré **avant** `:styleId`. Topbar : « Back to <Playbook> » vers la fiche. Pas de query. Voir [`FEATURES.md`](FEATURES.md) §18.                                                                                              |
| `/insights`                                                                            | `screens/insights/shell.js`                                                     | **Insights** (flag `insightsHub`, défaut OFF ; flag OFF → `/`) : les objectifs du Playbook **actif**, lus selon plusieurs mises en page (un contrôle dans l'écran, pas une URL). `?objective=<key>` sélectionne un objectif. Voir [`FEATURES.md`](FEATURES.md) § Insights.                                                                                                                                    |
| `/insights/:tab`                                                                       | (redirect, `app.js`)                                                            | Compat : les liens de l'ancien hub à onglets atterrissent sur `/insights`, query conservée.                                                                                                                                                                                                                                                                                                                   |
| `/connectors`                                                                          | `connectors.js`                                                                 | Gallery des connectors (flag `connectors`, défaut OFF ; flag OFF → `/`). Détail dans un modal.                                                                                                                                                                                                                                                                                                                |
| `/topics`                                                                              | `topics.js`                                                                     | Le **Topic Feed** : une liste des deux voies (To review + For later), un panneau Filters en trois contrôles groupés (Topics · Marked as · Sources), des groupes par âge, pagination par 10, l'article en **master–detail**. Scopé à **un** Playbook : `?pb=` flag `playbookWorkspace` OFF, le Playbook actif flag ON. Toujours là (pas de flag).                                                              |
| `/topics/settings`                                                                     | `topics-settings.js`                                                            | **Feed settings** — les huit sources d'écoute + la cadence + les sites de la source Brand website, pour un Playbook éditable (`?pb=` flag OFF ; le Playbook actif flag ON). Une page, pas un onglet. Commit direct, aucune barre Save. Topbar « Back to Topic Feed » → `/topics`, `?pb=` remporté.                                                                                                            |
| `/clips`                                                                               | `clips/library.js`                                                              | La **bibliothèque vidéo** du Playbook (flag `clipsSpace`) : ajouter une vidéo (fichier, lien), la grille des vidéos et leur état. Flag OFF → `/`.                                                                                                                                                                                                                                                             |
| `/clips/:id`                                                                           | `clips/project.js`                                                              | Le **projet d'une vidéo** : l'analyse, puis les onglets Clips (sélection, Format / Subtitles de la vidéo, aperçus recadrés) et Drafts (`?tab=drafts` : comptes, CTA, drafts, Schedule). Vidéo inconnue → `/clips`.                                                                                                                                                                                            |
| `/clips/:id/edit/:clipId`                                                              | `clips/editor.js`                                                               | **L'éditeur unique** d'un clip (`?tool=` reframe (défaut), transcript, subtitles, text ou brand ; les anciens `trim` et `cleanup` ouvrent Reframe et Transcript). Pas de trim : la plage d'un clip est fixe, ses bords se lisent seulement ; le cleanup est la tête du Transcript, le format et la safe area le moniteur Output. Plein écran (`body.clips-editing` retire la rail).                           |
| `/welcome-alt`                                                                         | `welcome-alt.js`                                                                | Redirige (`replace`) vers `/welcome-alt/intro`. L'onboarding en chat est supprimé : ne pas le ramener.                                                                                                                                                                                                                                                                                                        |
| `/welcome-alt/intro`                                                                   | `welcome-alt-intro.js`                                                          | Tout premier écran first-time — ce que l'onboarding va demander, dans l'ordre (dérivé de `altSteps()`), puis _Build my Playbook_ → `/welcome-alt/brand`.                                                                                                                                                                                                                                                      |
| `/welcome-alt/brand`, `/interview`, `/language`, `/documents`, `/voice-from`, `/ready` | `welcome-alt-steps.js`, `welcome-alt-ready.js` (shell : `welcome-alt-shell.js`) | Le run first-time en écrans, un par étape, dans le split de l'intro — marque (ou interview), langue (flag `multilingualPlaybook`), documents (flag `connectors`), source de la voix, puis analyse + révélation. `?new=<retour>` (posé par `openNewPlaybookFlow`) démarre un run neuf pour un utilisateur existant. Body en `.onboarding` (sauf run intégré).                                                  |
| `/welcome-alt/recap`                                                                   | `welcome-alt-recap.js`                                                          | La review du **Brief** sur une page (`renderPageReview`, « Check what I learned »). `?tab=<part>` garde la carte affichée au rechargement.                                                                                                                                                                                                                                                                    |
| `/welcome-alt/voice`                                                                   | `welcome-alt-recap.js` (`renderWelcomeAltVoice`, sur `welcome-alt-review.js`)   | La review de la **Voice**, après le Brief — Default voice puis une carte par réseau ; finit le run (« Draft my first post » → nouveau chat `?contextId=…&welcome=1`).                                                                                                                                                                                                                                         |

## Deux niveaux de chrome (flag `playbookWorkspace`)

Le shell a deux états, et c'est le **scope de l'objet** qui décide — pas la route :

| État                               | Routes                                                                                                    | Chrome                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace** (défaut)             | tout ce qui est d'**une** marque : `/session/*`, `/topics*`, `/insights*`, `/clips*`, `/playbook/<actif>` | rail complète (switcher + nav + chats scopés). La fiche active garde la rail ; son retour est « Back to all Playbooks » → `catalogueRoute()`                                                          |
| **Account** (`body.account-scope`) | ce qui parle des **autres** marques : `/home`, `/contexts`, `/playbook/<autre>` (et ses pages de styles)  | **pas de rail**, une colonne, topbar réduite au retour : « Back to <marque active> » (ou « Back to chats ») → `/` depuis la home ; « Back to all Playbooks » → `/home?tab=playbooks` depuis une fiche |

Le prédicat est `isAccountScope(path)` dans [`active-playbook.js`](../../src/active-playbook.js), posé sur `<body>` par `setAfterRender` ([`app.js`](../../src/app.js)) ; les libellés de retour sont `backTargetFor()` dans [`topbar.js`](../../src/components/topbar.js). Sans le flag il renvoie toujours `false` : un seul état de chrome, et la fiche revient par « Back to Playbooks » → `/contexts`.

⚠️ En account scope **le switcher n'est pas à l'écran** — c'est pourquoi, sur la home, **une carte de Playbook EST la porte de son workspace** : cliquer la carte bascule sur cette marque et ouvre un chat neuf dedans (`enterWorkspace`, `home.js` ; le lien « Switch » séparé a été retiré, voir [`DECISIONS.md`](DECISIONS.md#the-playbook-scope--pb-by-default-a-workspace-behind-playbookworkspace)).

## Matching & lifecycle

Le router (`src/router.js`) :

1. Écoute `hashchange` sur `window`.
2. Sépare le path de la query : `#/session/abc?panel=drafts` → path = `/session/abc`, query = `panel=drafts`.
3. Cherche la 1ère route qui match le path (regex ancrée, avec `:param` extraction).
4. Si match : appelle `cleanup()` du précédent handler (s'il en a retourné une), puis le nouveau handler avec `({ ...params }, target)`. **Le router ne vide pas `#app`** — c'est le handler qui écrit dans `target`. Puis `afterRender(path, params)` et `target.scrollTop = 0`.
5. Si pas de match : `navigate("/")`. `/` étant toujours enregistrée, le `Not found.` du router est une garde défensive qu'on n'atteint pas.

`getPath()` lit aussi un `?route=/foo` en query : le script de capture Figma impose un hash en `#figmacapture=`, incompatible avec le router — ce param est la porte de sortie (cf. [`src/figma-capture.js`](../../src/figma-capture.js)).

**Important** : le router re-run le handler sur **chaque hashchange**, y compris pour des changements de query (à path identique). C'est intentionnel — l'écran réagit à ses query params. Un état qui ne doit **pas** re-render (l'onglet de la fiche, le mode du panneau droit) s'écrit par `history.replaceState` / `pushState`, pas par `navigate`.

## URL state (hash query params)

Toutes les query params sont encodées dans le hash. Helpers dans [`src/url-state.js`](../../src/url-state.js) :

```js
import { parseHashParams, setHashQuery } from "./url-state.js";

const pb = parseHashParams().get("pb");
setHashQuery("/topics", { pb: "ctx-acme" });
```

`setHashQuery` appelle `navigate()` du router. Idiomatique pour pousser un changement d'état d'écran sans reload.

Les clés en service, hors celles du tableau ci-dessus :

- `/session/:id?contextId=…&title=…` — le Playbook et le nom d'un chat pas encore créé (`new`, `new-<id>`) ; c'est par là que la home, une carte, le batch, un Topic ouvrent un chat sur une marque.
- `/session/:id?panel=overview|drafts|ideas|sources` — le mode du panneau droit, écrit par `right-panel.js` en `pushState` (pas de re-render), relu au chargement et sur back/forward.
- `/session/:id?welcome=1` — le premier chat après le run : le bloc « Playbook ready » en tête (`session/empty-hero.js`).
- `/topics?pb=ctx-…` (flag OFF) — le feed **scopé** à un Playbook. Un `?pb=` pointant vers un Playbook disparu retombe sur le défaut plutôt que de vider l'écran.
- `/topics?topic=topic-…` — ouvre le feed avec **l'article de ce Topic déjà affiché**, et élargit le filtre de statut à **tous** les états pour cette visite : un Topic ignoré n'est pas dans la vue par défaut, donc l'article s'ouvrirait sinon sur une carte que la liste ne montre pas.
- `/topics/settings?pb=ctx-…` (flag OFF) — le même `?pb=` que le feed, donc le scope survit à l'aller comme au retour. Obligatoire sur les réglages : sans lui, configurer B puis Retour montrerait A.
- `/home?tab=chats|playbooks` — les deux listes de la home, dans l'URL pour que le Back du navigateur passe de l'une à l'autre ; **Chats est le défaut**, une valeur inconnue y retombe. ⚠️ Toute porte qui dit « le catalogue » doit porter `?tab=playbooks` : c'est ce que rend `catalogueRoute()` ([`active-playbook.js`](../../src/active-playbook.js)) ; le wordmark est le seul à viser `/home` nu — lui dit « la home », pas « les playbooks ».

`session.js` `readQuery()` lit encore `tab`, `view`, `focusIdea`, `focusPost`, `focusSource`, `postsFilter`, `postsNetwork`, `populated` : restes du workspace Content à onglets. Plus aucun écran ne rend ces onglets ni ne pose `focus*` ; `?tab=posts` (encore écrit par le picker de l'Ask d'une source) se lit comme `content`. Ne pas s'appuyer dessus pour un nouveau lien : le panneau, c'est `?panel=`.

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

### Handoffs actifs

| Clé                                                | Posé par                                                                                                                                                                           | Consommé par →                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pendingAskSource`                                 | « Ask » sur une source card, via le chat picker (`session.js` `startAskFlowFromSession`)                                                                                           | `session.js` → `askWhatToKnow`                                                                                                                                               |
| `pendingAskConnector`                              | « Ask in a chat » / « Ask {name} in chat » : `screens/connectors.js`, `components/connectors-modal.js`                                                                             | `session.js` → `askConnector` (`connector-ask`)                                                                                                                              |
| `pendingTopicChat` (`TOPIC_CHAT_HANDOFF`)          | `topic-flow.js` `useTopicInChat` — depuis le feed, le picker dialog et les « Topics to review » du chat neuf (le picker du composer est inline et attache directement)             | `session.js` → `attachTopicToChat` (`topic-flow`)                                                                                                                            |
| `editNetworkVoice`                                 | « Edit it myself » et « Edit in the Playbook » sur une voix proposée (`network-voice-flow.js` `editNetworkVoiceInPlaybook` — chat, Clips, intro, fiche) ; `voice` : la proposition | `playbook-view.js` `mount` (fiche enregistrée seulement) : l'onglet du réseau en édition — sur la proposition, non enregistrée, sinon sa voix, sinon depuis la default voice |
| `pendingHomePrompt`                                | le héro de la home du compte (Send / Enter, et le menu Add quand le champ a du texte) — `home.js`                                                                                  | `session.js` → `routeTypedAsk`, sinon `sendMessage`                                                                                                                          |
| `pendingHomeAdd`                                   | le menu **Add** du héro et le starter Top posts de la home — `home.js`                                                                                                             | `session.js` → le dispatch du menu Add du composer                                                                                                                           |
| `pendingObjectiveChat` (`OBJECTIVE_CHAT_HANDOFF`)  | `objective-flow.js` — `openObjectiveInChat` (« Fix this in a chat ») / `repurposePostInChat`                                                                                       | `session.js` → `startObjectiveChat`                                                                                                                                          |
| `pendingImageLookChat` (`IMAGE_LOOK_CHAT_HANDOFF`) | Playbook › Image generation, sans look — « Help me pick in a chat » (`draft-image-flow.js` `openImageLookChat`)                                                                    | `session.js` → `startImageLookChat` (`draft-image-flow`)                                                                                                                     |
| `pendingStartClipStudio`                           | starter « Extract video clips » de la home (flag `clipsSpace` OFF ; ON il mène à `/clips`) — `home.js` ; le lien clips de l'intro first-time — `welcome-alt-intro.js`              | `session.js` → `clipStudio.start` (chat `clip-studio-*`)                                                                                                                     |
| `pendingStartBatch`                                | starter « Batch of posts » de la home — `home.js`                                                                                                                                  | `session.js` → `batchStudio.start` (chat `batch-*`)                                                                                                                          |

Une clé **consommée mais jamais posée** se lit comme un point d'entrée vivant alors qu'elle est morte : n'ajouter une ligne qu'avec les deux bouts (`pendingStartFlow`, `pendingDraftIdeaId` et `focusObjective` ont été retirés pour cette raison).

### Hors `handoff.js` : le pont de l'onboarding

Quatre clés vont directement dans `sessionStorage`, sans `consumeHandoff`, parce qu'elles sont **lues plusieurs fois** pendant le run (ce n'est pas un pont à usage unique) : `welcomeAltSessionId`, `welcomeAltIntegrated` et `welcomeAltReturnTo` (posées par `welcome-alt-shell.js` au démarrage d'un run ; `welcomeAltIntegrated` est aussi lue par `app.js` pour `body.onboarding`), `welcomeAltDraft` (`persistDraft` / `readPersistedDraft`). Leurs helpers vivent dans `welcome-alt-recap.js`. Toutes les clés de persistance : [`STORES.md` § Persistence](STORES.md#persistence).

## Navigation interne — patterns

### Côté code

```js
import { navigate } from "./router.js";

// changer de route
navigate("/contexts");

// avec query
setHashQuery("/topics", { pb: "ctx-acme" });
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
