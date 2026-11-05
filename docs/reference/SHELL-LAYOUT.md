# Shell layout — Right panel · Status card · Sidebar

Le détail **tel qu'implémenté** des 3 surfaces de chrome de la zone session : le
**right panel**, la **conversation-status-card** et la **sidebar** (collapsed /
expanded), plus les **tailles** du right panel. Les règles produit seules :
[`PANEL-SIDEBAR-RULES.md`](PANEL-SIDEBAR-RULES.md) ; la recette sans code pour
une autre stack : [`SIDEBAR-PANEL-RECIPE.md`](SIDEBAR-PANEL-RECIPE.md).

Les 3 surfaces sont des **cellules d'une même grille CSS** sur `#appShell`
(`.app-shell`), pas des overlays. Tout se joue donc sur `grid-template-columns`
et quelques classes d'état :

| Classe sur `#appShell`    | Effet                                   |
| ------------------------- | --------------------------------------- |
| `.is-sidebar-collapsed`   | sidebar en rail icônes (col 1 rétrécie) |
| `.is-right-panel-open`    | ajoute la colonne du right panel        |
| `.is-status-card-visible` | ajoute la colonne de la status-card     |

Fichiers : `src/components/{right-panel,conversation-status-card,sidebar}.js` +
`styles/layout.css`, `styles/components/conversation-status-card.css`,
`styles/tokens.css`.

---

## 1. Right panel — ouverture / fermeture

Cellule de grille **ligne 2, colonne 3**, ajoutée par `init()` dans `#appShell`.
Modes mutuellement exclusifs (`state.mode`, module-local dans `right-panel.js`),
tous ouverts par `openMode()` :

| Mode       | Ouvert par                                                                                               | Persisté URL ?          |
| ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| `overview` | `openOverview()` — seulement si `hasOverview()` (flag `contentPanel` ON et `conversationStatusCard` OFF) | oui — `?panel=overview` |
| `drafts`   | `openDrafts()`                                                                                           | oui — `?panel=drafts`   |
| `ideas`    | `openIdeas()` / `openClips()` (la vue Clips, `outputsView`)                                              | oui — `?panel=ideas`    |
| `sources`  | `openSources()`                                                                                          | oui — `?panel=sources`  |
| `null`     | `closePanel()`                                                                                           | —                       |

Sous `contentPanel` (ON par défaut), les onglets du panel vivent dans la topbar
(`openTab(mode)`, Clips n'y apparaît que s'il y a des clips) ; le panel n'a pas
de rangée d'en-tête.

**Règles :**

- `renderPanel()` pose `el.hidden = !state.mode` et bascule `.is-right-panel-open`
  sur `#appShell`.
- **Scoped session** : `syncFromUrl()` ferme le panel dès qu'on quitte une route
  `/session/:id` (Playbooks, Connectors, Dashboard…), avec `skipUrl` pour ne pas
  réécrire le hash de la nouvelle route.
- **Persistance URL** : tous les modes (`VALID_URL_MODES` = overview / drafts /
  ideas / sources) sont encodés en `?panel=…` par `history.pushState` (pas de
  `hashchange`, donc le fil n'est pas re-rendu). Au boot et sur chaque
  `hashchange`, `syncFromUrl()` rouvre le bon mode (deep-link + back/forward) ;
  un garde no-op casse la boucle write → hashchange → write.
- **Focus** : à l'ouverture fraîche (`prev === null`), le focus courant est
  mémorisé (`snapshotFocusOnOpen`) et restauré à la fermeture
  (`restoreFocusOnClose`).
- **Fermeture** : `Escape` ferme le panel **mais** seulement si aucune modale
  n'est ouverte par-dessus (`isOverlayEscape`) et aucun menu kebab de source
  n'est ouvert (l'Escape les ferme d'abord). Bouton close inline. Quitter la
  session (new chat, autre route) ferme le panel via `syncFromUrl()`.

---

## 2. Conversation-status-card — visibilité

Derrière le flag **`conversationStatusCard`** (OFF par défaut). Cellule de grille
**colonne 3** elle aussi (classe `.is-status-card-visible`). Sa `render()` masque
la carte (`hideCard()`) si **n'importe laquelle** de ces gardes est vraie :

1. Flag `conversationStatusCard` OFF.
2. Pas sur une route `/session/:id`.
3. Session `clip-studio-*` (flow full-page).
4. Préférence user désactivée — `isEnabled()` lit
   `localStorage["archie-status-card-visible"]` (défaut **ON** ; `"0"` = masqué),
   togglée par le bouton info de la topbar. Sous `contentPanel` ni le toggle ni
   cette garde n'existent : la carte se montre dès que le panel est fermé.
5. **Un right-panel est ouvert** (n'importe quel mode) → la carte cède la
   colonne au panel. La préférence n'est pas touchée : à la fermeture du panel,
   `subscribeRightPanel` re-render et la carte réapparaît si activée.
6. **Chat vide** — aucune source, idée, clip, draft ni travail en cours
   (`isEmptyChat`). Le toggle topbar est masqué en lockstep.

Sinon : `rootEl.hidden = false` + `setShellLayout(true)`.

> **Carte et right-panel ne s'affichent jamais ensemble** (garde 5). Les règles
> à 4 colonnes de `conversation-status-card.css` (carte 296px + panel
> `max(380px, (100vw − sidebar) / 2)` en `grid-column: 4`) ne sont donc jamais
> atteintes depuis que le mode `context-brief` a disparu.

---

## 3. Sidebar — collapsed / expanded

Piloté par `.is-sidebar-collapsed` sur `#appShell`, persisté dans
`localStorage["archie-sidebar-collapsed"]` (`"1"` = collapsed).

- **Toggle** : bouton head (chevron ↔ view-list), ou **⌘B / Ctrl+B** — sauf quand
  le focus est dans un input/textarea/contenteditable (laisse le raccourci
  plateforme gagner).
- `setSidebarCollapsed(collapsed, { auto })` bascule la classe, écrit le
  localStorage et **re-render** la sidebar (markup différent : rail icônes-only
  vs complet). Le flag `auto` distingue un collapse **piloté par la largeur**
  (`auto: true`) d'un choix **manuel** (défaut) ; un appel manuel **efface** le
  flag (l'utilisateur reprend la main). `isAutoCollapsed()` = vrai uniquement
  quand c'est la règle de largeur qui a rétracté la sidebar.
- Au boot, l'état persisté est appliqué **avant** le premier render pour éviter
  le flash de layout.

**Auto-collapse / re-expand piloté par le right-panel** (le couplage des 3) :

- **Seuil de largeur** : `CHAT_MIN_WIDTH_PX = 560`. `predictedChatWidthWithSidebarExpanded()`
  reproduit la formule de grille (`viewport − sidebar(260) − panel`, panel =
  override de drag ou `max(panelFormulaFloor(vw), (viewport − 260)/3)`) pour **prédire** la
  largeur du chat si la sidebar restait étendue. La largeur est **calculée**,
  pas mesurée (`offsetWidth`) — donc immune à la transition CSS
  `grid-template-columns` en cours, plus besoin du `requestAnimationFrame` à
  l'ouverture.
- À chaque **ouverture fraîche** d'un panel (transition `null → mode`),
  `maybeCollapseSidebarOnOpen(prev)` → `maybeCollapseSidebar()` collapse la
  sidebar (`{ auto: true }`) — uniquement si `prev === null` (pas sur un swap de
  mode Ideas↔Drafts), si elle n'est pas déjà collapsed, **et** si le chat
  prédit passerait sous 560px. Sur grand écran : pas de collapse.
- **Pas d'auto-restore** à la fermeture — l'utilisateur ré-étend manuellement.
- Sur `window.resize` (rAF-debounced), `syncSidebarToWidth()` est
  **bidirectionnel** quand un panel est ouvert : si le chat prédit `< 560px` →
  collapse (`maybeCollapseSidebar`) ; sinon, si `isAutoCollapsed()` → ré-étend
  (`setSidebarCollapsed(false, { auto: true })`). Une sidebar **rétractée à la
  main** (`auto` effacé) n'est **jamais** ré-étendue automatiquement.

---

## 4. Définition des tailles du right panel

Les largeurs sont **entièrement pilotées par `grid-template-columns`** sur
`.app-shell`, pas par une largeur fixe sur le panel.

Tokens de base (`styles/tokens.css`) :

```css
--app-sidebar-width: 260px;
--app-sidebar-width-collapsed: 56px;
```

**Formule canonique** (même formule pour tous les modes), avec override runtime —
`styles/layout.css` :

```
var(--app-right-panel-width-runtime, max(var(--app-right-panel-floor), calc((100vw - sidebar) / 3)))
```

→ par défaut **1/3 de (viewport − sidebar)**, avec un plancher
`--app-right-panel-floor` : **610px**, **380px sous 1280px** (`@media
(max-width: 1279px)` ; à 1024, 610 laissait le chat sous ses 560px et la barre
du composer passait à la ligne). `panelFormulaFloor(vw)` dans `right-panel.js`
recopie ce plancher pour la prédiction du §3 — les deux doivent bouger ensemble.

| État                      | `grid-template-columns`                   |
| ------------------------- | ----------------------------------------- |
| panel ouvert              | `260px / 1fr / max(floor, (100vw−260)/3)` |
| panel + sidebar collapsed | `56px / 1fr / max(floor, (100vw−56)/3)`   |

**Override runtime (drag-resize)** — `--app-right-panel-width-runtime` :

- Posée inline sur `#appShell` **uniquement pendant le drag** de la poignée
  `[data-rpanel-resize]` (séparateur de 4px sur le bord gauche du panel).
- Calcul : `next = innerWidth − clientX`, clampé entre :
  - **min** `PANEL_MIN_WIDTH = 380px`
  - **max** `innerWidth − PANEL_MAX_RIGHT_GAP` (`PANEL_MAX_RIGHT_GAP = 400px`,
    pour garder ≥400px à sidebar + contenu).
- L'override est **réinitialisé à chaque ouverture fraîche** (`prev === null`,
  `resetPanelWidthOverride()`) → la formule redevient le défaut. Un swap de mode
  (Ideas→Drafts) **conserve** l'override pour que le resize survive.
- La largeur custom n'est écrite nulle part : elle n'est **pas** persistée
  entre reloads (`init()` appelle aussi `resetPanelWidthOverride()`). La formule
  est **/3** avec le plancher ci-dessus ; l'ancienne clé `archie-rpanel-width`
  n'est plus ni lue ni effacée.

---

## TL;DR

Les règles produit qui en découlent (couplage, seuils, tailles) sont dans
[`PANEL-SIDEBAR-RULES.md`](PANEL-SIDEBAR-RULES.md).
