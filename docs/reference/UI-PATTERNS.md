# UI patterns — usage concret du Design System

> Ce que le proto **rend réellement** : classes `.ap-*` utilisées, tokens app, primitives patchées, patterns récurrents, loaders, convention couleur en pratique.
>
> Complète [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) (le _workflow obligatoire_ : MCP, ordre des vérifications, anti-patterns). Ici on documente le _résultat_ : comment le DS est câblé dans l'app.

Tokens DS = `--ref-*` / `--sys-*` / `--comp-*`. Tokens app = `--app-*`. Les templates passent par `html`` / `raw()` ([`utils.js`](../../src/utils.js)) — escape par défaut, `raw()`opt-out, arrays`.join("")`, `null`/`false` → vide.

---

## 1. `styles/ds-patches.css` — l'inventaire des « trous du DS »

Seul endroit légitime pour toucher `.ap-*`. Charte du fichier : _« the only legitimate place to extend `.ap-*` classes… should shrink as the DS evolves »_.

| Sélecteur                                               | Raison                                                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.app-modal-backdrop`                                   | Le DS ne fournit pas de backdrop plein-viewport. `inset:0`, `--app-modal-backdrop`, `--app-z-modal-backdrop`.                                                                                                              |
| `.ap-status.mermaid` (+ `::before`)                     | `.ap-status` DS n'a pas de variante mermaid. Pills de travail in-conversation (Drafting / Extracting / Extracted-N / Analyzing). Teinte `--app-butter`, dot olive `--app-butter-accent`.                                   |
| `.ap-icon-archie-official`                              | Le glyphe logotype « A » d'Archie, mask-based (`-webkit-mask-image` data-URI). Hors liste d'icônes DS générée. Peint en `currentColor`. C'est **l'avatar AI**, distinct de `.ap-icon-sparkles`.                            |
| `.ap-status-card` (+ variantes)                         | Le DS a les tokens `--comp-status-card-*` mais pas de classe CSS-UI. Recrée la primitive (miroir `libs/ui-components/status-card`). Container-query masque l'icône < 130px. Modifiers en `.tagOrange` (pas `.tag-orange`). |
| `.ap-button.danger` (+ `.stroked.danger`)               | Le DS n'a pas de variante danger. Synthétisée depuis la palette rouge. Utilisée par `confirm-modal` en `danger=true`.                                                                                                      |
| `.ap-infobox.feature-lock`                              | Intent violet « limit reached / upgrade » (les infobox DS n'ont que info/warning/error/success).                                                                                                                           |
| `button.ap-link`                                        | `.ap-link` DS suppose un `<a>` ; reset le chrome UA d'un `<button>` stylé en lien.                                                                                                                                         |
| `.ap-filter-chip` (+ états, `-icon`/`-avatar`/`-count`) | Primitive en route vers le DS (V2-Atoms › FilterChip). Pill 24px, `aria-pressed` → ramp electric-blue.                                                                                                                     |
| `.ap-divider, .divider`                                 | La règle DS référence `--sys-color-border-color-default` mais les tokens du proto définissent `--sys-border-color-default` → fallback `--ref-color-grey-10`.                                                               |
| `.ap-form-message[hidden]`                              | `.ap-form-message{display:flex}` bat `[hidden]{display:none}` → restaure le guard hidden.                                                                                                                                  |
| `.ap-dropzone` (famille)                                | Le DS n'a pas de dropzone. Box partagée « drop / browse » ([`dropzone.js`](../../src/components/dropzone.js)), variantes `--compact` / `--lg`, highlight `is-drop-target`.                                                 |

Règle : **jamais** redéclarer une `.ap-*` hors ce fichier (ça flippe la cascade silencieusement).

---

## 2. Tokens app-only (`styles/tokens.css`)

Tous namespacés `--app-*`. Charte : _« prefer DS tokens first; fall back to these only for handoff-specific values »_. Groupes :

- **Surfaces** : `--app-bg`, `--app-surface`, `--app-surface-subtle`, `--app-border`, `--app-border-soft`.
- **Accent « butter »** (Archie) : `--app-butter` (#f7ffc5, fond pill status), `--app-butter-accent` (#8a9b2e olive, dot).
- **Logo mark** : `--app-archie-mark` (#ff3c00).
- **Conversation navy** (brand tertiaire #0A1B33, remplace l'electric-blue dans le thread) : `--app-convo-navy(-deep/-05/-10/-20)`.
- **Video-clips dark ramp** (seule palette sombre de l'app, alimente le modal clips + caption-editor) : `--app-vc-*` (surfaces, field, borders, text, accent, primary, danger, scrim, shadow). Commentaire : _« blue = selected/info, orange = primary/AI, red = destructive »_.
- **Radius** : `--app-radius-sm/-md/-lg`, `-button-sm` (6), `-starter` (10), `-card` (12), `-modal` (16), `-pill` (999), `-circle` (50%).
- **Elevation** : `--app-shadow-subtle/-low/-popover-md/-lg/-drawer-left/-card/-modal/-orange-hover`.
- **Easing** : `--app-ease-out/-bounce/-standard`.
- **Chrome** : `--app-topbar-height` (56), `--app-sidebar-width` (260) / `-collapsed` (56), `--app-right-panel-width` (460).
- **Z-index (centralisé)** : content 5, overlay 10, right-panel 15, modal-backdrop 50, modal 60, modal-stacked-backdrop 70, modal-stacked 71, admin 100.

⚠️ **Typo** : aucune taille/poids de police côté app — tout vient des text styles DS (`--sys-text-style-*`). Voir mémoire _ads-figma-text-styles_.

---

## 3. Patterns récurrents (classes/markup exacts)

### En-tête d'écran — LE MOTIF MAISON

Relevé sur le produit réel (Inbox, Drafts, Analytics, Employee Advocacy ×2). Il est le même partout, et c'est la référence pour tout nouvel écran.

```
┌ RANGÉE 1 · en-tête ──────────────────────────────────────────────────────┐
│ [avatar] Titre                          ⟶   [CTA] [secondaires] [⚙]     │
├ RANGÉE 2 · toolbar ──────────────────────────────────────────────────────┤
│ [Label│Valeur ▾] [Label│Valeur ▾] [⚲ Filters n]  ⟶  [🔍 Search] [Sort ▾] │
├ RANGÉE 3 · tabs ─────────────────────────────────────────────────────────┤
│  Vue A 11 │ Vue B                                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

Les invariants, avec leur nombre d'occurrences sur cinq surfaces produit :

- **Le cog va à droite, en dernier — À CONDITION que quelque chose ancre ce côté** (5/5 dans le produit). C'est un icon-button, pas un bouton libellé : une action rare ne prend pas le poids d'un contrôle qu'on utilise à chaque visite.

  ⚠️ **La condition est la partie qu'on oublie.** Dans le produit, la rangée qui porte le cog a toujours un ancrage — un titre de page à gauche, ou search et sort à droite d'une toolbar. Sur une rangée qui n'a ni l'un ni l'autre, « poussé à droite » ne produit pas un alignement, ça produit un bouton seul dans du vide : sur `/topics`, une fois la page alignée à gauche, le cog s'est retrouvé à ~700px du contrôle le plus proche, en face de rien.

  Dans ce cas, **le cog rejoint ce qu'il configure.** Celui de `/topics` règle l'écoute du Playbook sélectionné, donc il se colle au select qui le nomme (`gap` `xxxs` dedans contre `sm` entre groupes — l'espace dedans doit être plus petit que l'espace autour, sinon le groupe est une affirmation que rien ne soutient). Il repart à droite le jour où la rangée gagne un search ou un sort pour ancrer ce côté.

- ⚠️ **LA RANGÉE 1 EST DÉJÀ PRISE : c'est la topbar du shell.** Le produit ouvre bien sur une rangée de titre (5/5) — mais dans cette app `topbar.js` imprime le nom de la route pour **toute** route de premier niveau. Une page qui redessine son titre ne suit pas le motif, elle le double : `/topics` a imprimé « Topic Feed » 40px sous une topbar imprimant « Topic Feed », sur une rangée qui ne portait rien d'autre que le cog. Un titre seul ne fait pas une rangée.

  La règle qui tient : **la topbar nomme la route, et un écran ne dessine son propre titre que si la topbar le lui a CÉDÉ** — `/playbook/:id` et `/topics/settings`, où elle prend un contrôle de retour à la place — **ou si la rangée porte plus qu'un titre**. `/contexts` est la fausse exception : son en-tête porte un sous-titre chargé de données (« N Playbooks · applied across M chats »), une recherche et un CTA primaire, donc son titre est un élément sur quatre.

  Quand la rangée 1 revient au shell, **le cog descend en fin de rangée 2** — l'invariant est « dernier à droite », pas « sur la rangée du titre ».

- **Filters est un bouton LIBELLÉ**, funnel + le mot + son compteur **inline** quand il filtre (3/3). ⛔️ Jamais un icon-button avec un badge flottant : c'est le contrôle qui dit combien de la liste est caché, il ne peut pas être le plus dur à trouver.
- **Ce qui rétrécit la liste va à GAUCHE de la rangée 2** ; **search et sort vont à droite** (3/3). Si l'écran n'a pas encore de search, la droite reste vide — on ne la remplit pas pour équilibrer.
- **Un select de toolbar porte son label DEDANS**, via `.ap-select-inline-label` (4/5) : `Creator │ Select`, `Status │ Active`, `Playbook │ Acme · Q2 marketing`. ⛔️ Jamais un `<label>` empilé au-dessus — c'est du chrome de formulaire, pas de toolbar — et jamais un select nu, qui ne dit pas ce qu'il scope.
- **Deux vues nommées d'une même liste, avec compteurs → TABS** (3/3), pas un segmented control. On ne voit qu'une vue à la fois, ce qui est la définition des tabs. Markup : `.ap-tabs > .ap-tabs-nav > .ap-tabs-tab.active` + `.ap-counter normal blue|grey`.

Exemples en place : [`screens/topics.js`](../../src/screens/topics.js) (les trois rangées), [`screens/contexts.js`](../../src/screens/contexts.js) (rangée 1 avec search + CTA à droite), [`content-workspace.js`](../../src/components/content-workspace.js) (les tabs et leur compteur).

### Cartes + hover

Règle universelle (`chat.css`) : _« a light-blue wash on hover/focus (never navy/black) — soft blue fill + a light blue border, not a hard outline »_. Voir mémoire _card-hover-convention_.

- `.drafts-card:hover` → `border-color: --ref-color-electric-blue-20` + `background: --ref-color-electric-blue-05`. Actif = `.is-active` (electric-blue-40).
- `.top-post-card:hover`, `.clip-card` sélectionné → `border-color: --ref-color-electric-blue-100`.
- Radius carte = `--app-radius-card` (12). Tuiles icône AI/brand = fond `--ref-color-orange-10` + glyphe orange.
- ⛔️ **Jamais de liseré d'accent coloré sur un bord de carte** (`border-left: 3px solid …`). Règle catégorique de Matt. **L'état d'une carte va dans son contenu, pas sur son cadre** — un marqueur explicite (point + mot, ex. « • New ») dit la même chose sans repeindre la bordure. Un seul cas existait dans l'app (unseen sur `.topic-card`) et il a été retiré ; les `border-left`/`border-right` restants sont des séparateurs de panneau 1px dans la ramp sombre video-clips, pas des accents.
- Cartes in-bubble : `.chat-bubble-card` (grey-05, border grey-10) via `bulletsBlock()` (`_analyse-common.js`).
- **Une carte qui vit sur plusieurs surfaces prend son propre fichier** — [`components/topic-card.css`](../../styles/components/topic-card.css) : la carte Topic rend dans le feed, dans le picker et — en version ligne — dans la la front page et le rail du hero. Trois tailles, **les mêmes hooks `data-*`**, donc un écran les câble une fois.
- **Dans une grille de cartes, `grid-auto-rows: 1fr`** (+ `flex: 1 1 auto` sur le corps) : les cartes d'une même rangée finissent à la même hauteur et leurs pieds s'alignent. Une grille de hauteurs inégales est la moitié de la scannabilité en moins. Une **une** peut casser la règle — mais alors elle est seule à le faire, et exprès.
- **Un composant qui vit dans deux hôtes sort deux variantes, et sa règle de base ne porte AUCUN cadre.** `topic-card` rend une carte dans le feed (`--feed`, qui peut être celle qui est ouverte à côté de la liste) et une carte dans la dialog du picker (`--picker`, où un clic choisit, donc rien ne reste sélectionné). Toute déclaration de cadre — `background`, `border`, `border-radius`, et les états qui les teintent — vit sur la variante, jamais sur la base : une `border` partagée est ce qui a fait fuir le cadre d'une variante dans l'autre. Le test qui le prouve est d'ouvrir le picker après avoir touché au feed.
- **⛔️ Le cadre appartient aux OBJETS, jamais à la colonne qui les liste.** Essayé et retiré sur `/topics` : pour casser un effet « mur de cartes », le cadre est passé des cartes à la rangée qui les contenait, avec un filet entre la liste et le volet. Le mur venait des **gaps et du poids**, pas des bords — et une surface unique de 1440px se lit comme une dalle qui n'appartient à aucune autre vue de l'app. Si une liste pèse trop : resserrer les gaps, alléger la graisse, clamper le texte. Pas déshabiller les items.
- **Sur une vraie ligne, l'état est un REMPLISSAGE ; sur une carte, une bordure.** `.topic-row` (la liste in-chat) est le seul vrai cas de ligne du proto : pas de cadre à teinter, donc l'état va au fond. Une carte suit la convention de l'app — lavis + bordure bleu clair au survol, bordure raffermie quand elle est ouverte. Dans les deux cas, ⛔️ jamais de bordure gauche colorée, qui est la tentation de tout master–detail.
- **Le lu / non-lu se lit à la graisse.** Dans une file à trier, l'élément qui attend encore une réponse garde la graisse pleine et ceux qui ont été traités reculent d'un cran. La graisse **seulement** : l'encre ne change pas.
- **Une carte qui doit changer de mise en page selon la place qu'elle a reçue** se déclare `container-type: inline-size` et utilise une **`@container` query**, pas une media query : sidebar repliable + panneau de droite qui overlay, la largeur du viewport ne dit jamais la largeur du contenu. Cas en place : `.topic-card--lead` (une colonne → deux au-delà de 720px), et la grille de `/topics/settings`.

### Boutons / CTAs

DS `.ap-button` avec `primary|stroked|ghost` × `orange|blue`. Icon = `.ap-icon-button` (souvent `transparent`). Lien-bouton = `button.ap-link` (patché). Danger = `.ap-button.danger`. **Jamais full-width** (voir mémoire _buttons-never-full-width_).

### Selects (`.ap-select`)

`<details class="ap-select">` + `summary.ap-select-trigger` + `.ap-select-dropdown > .ap-select-options > .ap-select-option`. **Dans une toolbar, le label va DEDANS** : `<span class="ap-select-inline-label">Playbook</span>` en tête du trigger, avant le `.ap-select-value` — le DS dessine le séparateur vertical. Voir § En-tête d'écran. Options peuvent porter `.ap-select-option-caption` (2ᵉ ligne) et `.ap-select-option-check`. **Jamais un `<select>` natif** (mémoire _use-ds-dropdowns_). Depuis le picker de Playbook de `/topics`, la dalle de recherche du DS est aussi utilisée : `.ap-select-search` > `.ap-select-search-icon` + `.ap-select-search-input`, avec `.ap-select-not-found`. ⚠️ `.ap-select-not-found` porte `display: flex` → il bat `[hidden]` ; masquer en `style.display` inline.

### Surfaces « settings »

Le DS ship une **recette de page de réglages** et des tokens `--sys-settings-*` dédiés. Sur une telle surface les guidelines sont explicites : utiliser cette famille et **pas** les `--ref-spacing-*` / `--ref-color-grey-bg` génériques **pour la coquille et les cartes** (les gaps intra-composant restent sur `--ref-spacing-*`, comme dans l'exemple de la recette).

| Usage                         | Token                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Fond de page                  | `--sys-settings-content-background-color`                                                                  |
| Padding externe du contenu    | `--sys-settings-content-internal-margin` (24)                                                              |
| Gap entre cartes              | `--sys-settings-content-vertical-spacing` (16)                                                             |
| Largeur max — formulaire      | `--sys-settings-content-max-width-md` (**700**)                                                            |
| Largeur max — table/dashboard | `--sys-settings-content-max-width-lg` (1200)                                                               |
| Carte                         | `--sys-settings-card-background-color` / `-border-color` / `-border-radius` (8) / `-internal-padding` (16) |

Markup : une colonne de `.ap-card` (+ classe locale portant les tokens ci-dessus — **ne jamais surcharger `.ap-card`**), titres en `.ap-card-title`, en-tête `h1` + `p.ap-body`. Save bar optionnelle et **inutile quand tout commit immédiatement**.

Première utilisation de la moitié layout de cette famille : [`topics-settings.css`](../../styles/screens/topics-settings.css) (`/topics/settings`, les réglages du Topic Feed). Seul `--sys-settings-card-feature-lock-border-color` était déjà employé, dans `ds-patches` pour l'infobox feature-lock.

Trois écarts assumés à la recette, appris en construisant cette page :

- **Titre de page en `.ap-h1` (24px), pas `.ap-h2` (18px).** À 18 le titre de page n'est qu'à 2px des `.ap-card-title` (16) et la hiérarchie se lit plate. 24 → 16 → label de groupe en `.ap-caption-bold` (12) donne trois marches lisibles, et 24 est déjà la taille des titres des autres pages de l'app.
- **Ne pas donner une carte à un contrôle isolé.** Un `.ap-card-title` au-dessus d'un unique `.ap-select` est surtout du padding, et deux boîtes comme ça enchaînées font une page qui a l'air vide. Les contrôles de **niveau page** (le scope, un rythme) vont dans une **barre de `.ap-form-field`** (label au-dessus du contrôle, classe DS existante qui style son `> label` direct) ; les cartes sont réservées à ce qui a du contenu.
- **`-max-width-lg` (1200) n'est pas réservé aux tables.** Une galerie de cartes de config y a droit aussi : à 700, deux colonnes sont serrées et une colonne donne des bandes larges et courtes qui relisent comme des lignes. Corollaire : plafonner la prose (72ch) indépendamment de la grille, et faire tomber la grille à une colonne avec une **`@container` query** — dans une app à sidebar repliable, la largeur du viewport ne dit pas la largeur du contenu.

### Filtres — chips, selects ou dropdown ?

**Règle du DS** (`choosing-components.md` › Filtering) : bascules **toujours visibles** → _filter chips list_ ; **options groupées / presets / une étape d'apply derrière un déclencheur** → _filter dropdown_.

⚠️ Les deux composants DS (`<ap-filter-chips-list>`, `<ap-filter-dropdown>`) sont **Angular-only** — aucune couche CSS-UI. Équivalents en prototype :

| Intention DS      | En CSS-UI ici                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| Filter chips list | `.ap-filter-chip` (patché dans `ds-patches.css`, « en route vers le DS »)        |
| Filter dropdown   | `.ap-selection-dropdown` (search · `-group` · `-item` · `-selected` · `-footer`) |

**Troisième cas :** quand chaque facette prend **une seule** valeur et s'applique **immédiatement**, ni l'un ni l'autre — **un `.ap-select` par facette**, avec `.ap-select-inline-label` pour nommer la facette dans le déclencheur et `.ap-select-option-badge` pour le compteur. Un select **montre sa sélection fermé** ; un déclencheur « Filters (2) » oblige à l'ouvrir pour savoir. Le _Filters dropdown_ du DS (V2 Molecules, panneau 420px checkboxes + Clear/Apply) reste le bon choix dès qu'on **compose un jeu multi-valeurs et qu'on l'applique en un coup**. Précédent en place : la toolbar Period / Sort du board top-posts.

**Mais la taille du set tranche avant tout le reste**, et le Topic Feed est passé d'un côté à l'autre de cette règle :

| Facette      | Set                          | Composant                          | Pourquoi                                                                                                                                            |
| ------------ | ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**   | **6, figées** (le catalogue) | `.ap-filter-chip` (`aria-pressed`) | Petit set plat et connu = la règle DS du _filter chips list_. Ce sont les **rubriques** de la page : on clique entre elles, on n'ouvre pas un menu. |
| **Playbook** | **grandit avec le compte**   | `.ap-select`                       | Une puce par Playbook ne survit pas à vingt. Un select oui.                                                                                         |

C'était **deux selects** tant que la page était une liste filtrée ; passer la facette bornée en puces est ce qui l'a rendue _browsable_. Le compteur va dans `.ap-filter-chip-count`, et un compteur à zéro pose l'attribut `disabled` (que le patch style déjà) **sauf** si c'est la sélection courante — sinon on ne pourrait plus en sortir. Corollaire de layout : sept puces remplissent une mesure de 1160, donc le select voisin **ne tient pas** sur la même ligne — il est monté dans le head de la page, à côté des autres contrôles de niveau page.

### Filter chips

`.ap-filter-chip` piloté par `aria-pressed`, optionnels `-icon` / `-avatar` (img rond) / `-count`. Partout : connectors-view, playbook-view, ideas, image-studio (bascule Image/In feed), right-panel, feedback-control, schedule-modal.

### Status pills

DS `.ap-status` + `blue|green|grey|mermaid` (mermaid patché). Les états de travail in-conversation utilisent `mermaid` (butter + dot olive).

### Quickpicker (inline-question)

Le « pick one of N » réutilisable. État dans [`inline-question.js`](../../src/inline-question.js), rendu par `renderPicker()` dans [`_analyse-common.js`](../../src/screens/_analyse-common.js) sous le chrome `session__assistant--wizard`. Modes : rows numérotées, `variant:"cards"`, `multi`, `single`, `stepper`, free-text, file. **Le CTA submit est bleu** (pas l'orange AI) — mémoire _quickpicker-primary-is-blue_ + _quickpicker-secondary-button-tiers_. Contrôles = vrai radio DS, fade-to-bg gris — mémoire _ds-controls-and-fade-bg_.

### Panneau de droite

`.app-right-panel` (blanc, `border-left`), `__resize` (strip 6px, electric-blue au hover, largeur calculée par formule — non persistée, l'ancienne clé `archie-rpanel-width` est wipée au boot), `__close`, `__body` (`container-type: inline-size`), `__empty*`.

### Toasts

[`toast.js`](../../src/components/toast.js) wrap `.ap-snackbar-thread` / `.ap-snackbar` (+ `.success`/`.error`, `.animate-in/-out`). Queue app (`MAX_VISIBLE=3`), dwell 3200 ms (pause au hover), Undo optionnel (`.ap-link`). Région `#toastRegion`.

### Empty states

`renderEmptyState()` ([`empty-state.js`](../../src/components/empty-state.js)) : `.session__empty` > icône `.lg` > `h3.text-subtitle` > `p.muted` > `.session__empty-action`. Variante panneau : `.app-right-panel__empty`.

### Fente média vide (draft sans image)

`.posts__card-media-empty` ([`post-card.js`](../../src/components/post-card.js) `renderEmptyMedia`,
CSS dans [`posts.css`](../../styles/screens/posts.css)) : `-slot` > `-title` + `-sub` + `-actions`,
puis `-hint` **hors** du cadre. État `.is-generating` → `.archie-loader` + `-sub`.

La fente **porte le cadre que portera l'image** — mêmes 1px et même `--app-radius-md` que
`.posts__card-image` — pour lire comme le cadre vide de la photo, pas comme un widget garé
dans la carte.

- ⚠️ **Le fond doit rester `transparent`.** `.ap-button.mermaid` est une bordure dégradée en
  trompe-l'œil : fond dégradé + un `::after` en retrait peint en `--ref-color-white`. Sur toute
  surface teintée l'intérieur du bouton passe au blanc et il lit comme un rectangle mal collé.
  C'était le bug d'origine — teinter ce fond le recasse.
- **Pas de pointillés** : le pointillé est le signe universel de la drop-zone, et rien ici
  n'accepte un drop (seuls les boutons agissent). D'où aussi : aucun hover, aucun état de drag.
- **Aligné à gauche**, sur le bord de texte de la carte. Centrer un titre, une ligne de copy et
  des actions dans une boîte haute est ce qui faisait lire un trou dans le feed.
- **Titre = le nom, bouton = le verbe.** « Add an image » au-dessus d'un bouton « Generate an
  image » disait deux fois la même chose → le bouton dit `Generate`, avec un `aria-label` complet.
- **Un seul contenant, un lien.** Deux boutons outline à libellé complet lisent comme une paire
  d'égaux ; l'action IA garde le contenant, l'upload descend en `.ap-link`. C'est ce qui rend la
  hiérarchie lisible d'un coup d'œil.
- **Une seule hauteur (108px) pour les deux états**, posée sur le `-slot` : le cadre ne se
  redimensionne pas quand il bascule en génération. Pas d'`aspect-ratio` en revanche — réserver la
  hauteur réelle d'une image absente sur chaque carte du feed en fait une colonne de trous.
- **Un CTA de navigation vers le Playbook est un `.ap-link`** (bleu), jamais un bouton et jamais
  orange : l'orange est pour l'IA, et les 11 empty states du repo ont tous un CTA bleu.
- ⚠️ **`ap-icon-missing-image` est inutilisable** : c'est le seul icône du DS dont le SVG porte un
  `clipPath` avec un `<rect />` sans dimensions, qui découpe tout le glyphe. Il s'applique
  proprement et ne peint rien.

### Modals / backdrop

DS `.ap-dialog` centré par `modals.css` sur `.open`. `.app-modal-backdrop` patché (fade via `@keyframes app-modal-backdrop-fade`). Radius `--app-radius-modal` (16). Modals empilés → couches `--app-z-modal-stacked*`.

**Un nouveau modal doit être ajouté aux DEUX listes de sélecteurs de [`modals.css`](../../styles/screens/modals.css)** (la coquille centrée, et la variante `.open` qui passe `display: none` → `flex`). Sinon il reste invisible avec un backdrop actif. Corollaire : ne pas redéclarer `display` sur la classe du modal dans une feuille chargée **après** `modals.css`.

Échelle de largeurs, toutes en `width: min(calc(100% - 32px), Npx)` :

| Largeur | Modals                            | Pourquoi                                                                                                                                                                                                |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 440     | rename                            | un seul champ                                                                                                                                                                                           |
| 560     | bug report, chat picker, search   | une liste courte ou un formulaire                                                                                                                                                                       |
| 640     | feedback, add source              | formulaire + onglets                                                                                                                                                                                    |
| **720** | **topic** (l'article + le picker) | **lecture longue** — de la prose ; au-delà, la mesure décroche. Même largeur dans les deux vues : une dialog qui se redimensionne entre choisir et lire fait passer les deux pour des écrans différents |
| 920     | connectors                        | une gallery à parcourir                                                                                                                                                                                 |
| 960     | schedule                          | deux colonnes                                                                                                                                                                                           |

Les modals hauts plafonnent leur hauteur (`max-height: min(calc(100vh - 48px), 760px)`) et font défiler leur `.ap-dialog-content`, avec un footer d'actions collant : la décision doit rester atteignable quelle que soit la longueur du contenu.

---

## 4. Icônes

Glyphes webfont DS `<i class="ap-icon-*">` (quasi toujours `aria-hidden="true"`). Icon-buttons = `.ap-icon-button` (mettre `aria-label` sur le bouton). Les plus utilisés : `ap-icon-archie-official` (avatar), `-close`, `-plus`, `-pen`, `-check`, `-chevron-down`, `-trash`, `-file`, `-sparkles`, `-search`, `-link`, `-upload`, + glyphes réseaux (`-linkedin-official`, `-twitter-official`/`-x-official`, `-instagram-official`, `-tiktok-official`, `-facebook-official`, `-youtube-official`).

- **Sparkles = affordance AI** : `ap-icon-sparkles` marque les actions Archie (Regenerate, Suggest from this post, Compare, Optimal times), recoloré orange.
- **Avatar AI** = `.ap-icon-archie-official` (le mask « A », **pas** le sparkle DS).

**Exceptions inline-SVG** (animation ou path bespoke) :

- `LOADER_SVG` ([`archie-loader.js`](../../src/archie-loader.js)) — mark animé SMIL « pixel-pop » (SMIL gèle si utilisé en background/mask → injection JS).
- `ARCHIE_MARK_SVG` (`playbook-view.js`) — mark statique du recap.
- `.clip-studio__frame-art` (`session.js`) et le triangle play (`post-card.js`) — chrome vidéo déco.

---

## 5. Convention couleur en pratique

Codifiée dans `tokens.css` (_« orange = primary/AI, blue = selected/info, red = destructive »_). Voir [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md#convention-couleur--usage-app-wide).

- **Exemple le plus net** — [`connectors-view.js`](../../src/connectors-view.js) : action AI « Try » = `ap-button primary orange`, action routine « Connect » = `ap-button primary blue`, côte à côte.
- **Orange (AI / generate / commit)** : Send composer, Batch/Clip studio Generate, Regenerate, Save recap, Generate-image, add-source Import/Add-URL/Add-text, welcome « Save and continue », Image Studio « Use this image », tuiles icône AI (`--ref-color-orange-10` + glyphe orange).
- **Bleu (routine / navigation / picker submit)** : Connect, « Create a Playbook », Ideas new, playbook Start, bulk-extract, top-post CTAs, **tous les submits Quickpicker**.
- **Conversation navy** (`--app-convo-navy*`) : override l'electric-blue pour les accents du **thread** (bulle user, label « You », pill Ideas, chips source-intake, halos hover).

---

## 6. Layout / shell CSS

`styles/layout.css` — `.app-shell` est une grille CSS :

- **Colonnes** : `--app-sidebar-width` (260) + `minmax(0,1fr)` contenu ; `.is-sidebar-collapsed` → col 1 = 56.
- **Rangées** : `--app-topbar-height` (56) + `1fr`.
- **Sidebar** (`.app-sidebar`) : `grid-row 1/3` (col 1). **Topbar** : row 1, col `2/-1` (span le panneau pour garder les pills visibles). **Content** : row 2, col 2.
- **Right panel** : row 2, col 3 quand `.is-right-panel-open` ajoute une 3e colonne (`max(610px, calc((100vw − sidebar)/3))`, override runtime persisté).
- **Status card** (`conversation-status-card.css`) : colonne 296px (row 2, col 3) quand `.is-status-card-visible` ; si le panneau est aussi ouvert il passe **col 4** pour coexister. Masquée sur routes `.clip-studio`.
- **Modes spéciaux** : `body.onboarding` → colonne unique plein-viewport (pas de sidebar/topbar) ; `.app-shell:has(.empty-chat)` drop le topbar pour le hero.
- **Scaffolding** : `.screen`, `.screen--split` (`minmax(320px,380px) 1fr`), `.screen--centered` ; helpers `.stack`/`.row`/`.row-between`/`.grow`/`.muted`/`.text-title`/`.text-subtitle`/`.text-caption`.

Détail complet des formules de taille : [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md).

---

## 7. Animations & loaders

**`base.css` (partagé)** : `@keyframes app-spin`, `app-focus-pulse` (pulse electric-blue-20), + umbrella **reduced-motion** (`@media (prefers-reduced-motion: reduce)` cape toutes les durées à ~0).

**Keyframes par fichier** : `modals.css` (backdrop-fade, fade-in, success-pop, gen-shimmer), `session.css` (empty-rise, assistant-notice-pulse, composer-status-in/-out, thread-skeleton-shimmer), `dashboard.css` (source-card-processing-pulse), `posts.css` (word-fade-in), `clip-studio.css` (pulse/spin/shimmer/fill/stage), `welcome.css` (recap-loading), `schedule-modal.css` (spin), `topics.css` (topics-ghost-shimmer).

**Squelette (ghost loading) plutôt que spinner, dès que la forme de ce qui arrive est connue.** Un spinner dit « ça charge » ; un squelette dit « voilà ce qui arrive, et où ». Le gradient est toujours le même — `grey-05 → grey-10 → grey-05`, `background-size: 200% 100%`, shimmer de 1,4s linéaire infini, avec un **stagger** par élément sinon la pile pulse comme un seul bloc. Consommateurs : `.thread-skeleton` (bascule de conversation), `.topic-ghost` (`/topics` pendant le scan), `.gen-image-skeleton`.

⚠️ **Deux règles, apprises sur `/topics`.** (1) Le squelette doit être dans **les vrais cadres, aux vraies largeurs** — sinon la mise en page saute au moment du rendu, ce qui est exactement ce qu'il devait empêcher. Là-bas ça voulait dire garder le split à deux colonnes pendant l'attente au lieu de basculer sur un bloc pleine largeur. (2) Il ne **devine pas** un compte : cinq cartes fixes, parce que le nombre est inconnu pendant le scan et qu'un squelette qui annonce huit puis en rend trois a menti. Un état d'impasse (rien trouvé, filtre qui exclut tout) n'a rien à pré-dessiner et reste un état plein, pas un squelette.

**Le loader (source unique)** : [`archie-loader.js`](../../src/archie-loader.js) + `styles/components/archie-loader.css`. Toutes les classes spinner (`.archie-loader`, `.ap-loader` + tailles, ~10 `*-spinner`) rendent **le même mark** : `initArchieLoader()` sweep le DOM + `MutationObserver` injecte `LOADER_SVG` (7 carrés arrondis en scale, stagger 0→0.686s) avec un `__MASKID__` unique. CSS possède la box (`--archie-loader-size`, `aspect-ratio 227.15/170.03`, `color: --archie-loader-color` défaut `--ref-color-orange-100`, `currentColor` blanc sur CTAs pleins). Inline SVG obligatoire (SMIL gèle en background/mask).

⚠️ **Toujours dimensionner par `--archie-loader-size`, jamais par `width` + `height`.** La variable est la **largeur** de la boîte ; la hauteur vient de l'`aspect-ratio` du viewBox. Fixer les deux neutralise l'`aspect-ratio` et écrase le glyphe en carré (c'était le cas du loader de prompt de l'Image Studio, à `28px × 28px`).

⚠️ **Une barre d'outils flottante n'est pas une pill.** Les mini-toolbars de l'Image Studio (texte sélectionné, boîte de crop) étaient en `--app-radius-pill` : à 999px l'arc du coin passe **en travers** des contrôles des deux bouts — la pastille de couleur à gauche, l'`.ap-icon-button` à droite — et les rogne. Elles sont en `--app-radius-lg` (8px), qui vaut aussi `--comp-icon-button-border-radius` : le coin du conteneur est alors **concentrique** avec les boutons qu'il tient (4px de padding autour d'un coin de 4px = 8px). La pill reste juste pour ce qui n'a **pas** de contrôle sur ses bords : segmented view toggle, badge, pastille de position.

⚠️ **`.gen-loading-mark` est le mark 88px du _stage_** (l'état vide du canvas), pas un « loader d'image » générique. Le composer de l'Image Studio le portait, ce qui mettait un glyphe de 88px dans un champ de 36px : il débordait de la carte et poussait le texte sur le côté. Un loader **inline** ne porte que `.gen-image-spinner` (20px par défaut). Et un loader qui remplace un champ doit prendre la **largeur du champ** (`flex: 1`) — centrer dans une boîte shrink-to-fit revient exactement à aligner à gauche.

---

## Voir aussi

- [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — workflow DS obligatoire + MCP `ds-css` + anti-patterns
- [`FEATURES.md`](FEATURES.md) — où ces patterns sont utilisés (par feature)
- [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md) — formules de tailles sidebar / panel / status-card
- [`../../CLAUDE.md`](../../CLAUDE.md) — résumé pour agents
