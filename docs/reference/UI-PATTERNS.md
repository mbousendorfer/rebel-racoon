# UI patterns — usage concret du Design System

> Ce que le proto **rend réellement** : classes `.ap-*` utilisées, tokens app, primitives patchées, patterns récurrents, loaders, convention couleur en pratique.
>
> Complète [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) (le _workflow obligatoire_ : skill `/design-guidelines`, ordre des vérifications, anti-patterns). Ici on documente le _résultat_ : comment le DS est câblé dans l'app.

Tokens DS = `--ref-*` / `--sys-*` / `--comp-*`. Tokens app = `--app-*`. Les templates passent par le tag `html` et `raw()` ([`utils.js`](../../src/utils.js)) — escape par défaut, `raw()` pour l'opt-out, arrays joints, `null` / `false` → vide.

---

## 1. `styles/ds-patches.css` — l'inventaire des « trous du DS »

Seul endroit légitime pour toucher `.ap-*`. Charte du fichier : _« the only legitimate place to extend `.ap-*` classes… should shrink as the DS evolves »_.

| Sélecteur                                   | Raison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.app-modal-backdrop`                       | Le DS ne fournit pas de backdrop plein-viewport. `inset:0`, `--app-modal-backdrop`, `--app-z-modal-backdrop`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `.ap-table.clickable-rows`                  | Le DS prescrit des lignes de tableau qui **naviguent** (« per-row overflow menu and row actions », patterns.md) mais ne livre aucune affordance pour ça : ni curseur, ni hover, ni anneau de focus sur une ligne cliquable. Les écrans le stylaient eux-mêmes sur `tbody tr`, ce que la fiche du composant interdit (« use root modifiers rather than styling individual tr / th / td ») — d'où un **modificateur racine** ici. Hover en grey-05, le même lavis que `.striped` et `.header-background`.                                                                                                                        |
| `.ap-status.mermaid` (+ `::before`)         | `.ap-status` DS n'a pas de variante mermaid. Pills de travail in-conversation (Drafting / Extracting / Extracted-N / Analyzing). Teinte `--app-butter`, dot olive `--app-butter-accent`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.ap-icon-archie-official`                  | Le glyphe logotype « A » d'Archie, mask-based (`-webkit-mask-image` data-URI). Hors liste d'icônes DS générée. Peint en `currentColor`. C'est **l'avatar AI**, distinct de `.ap-icon-sparkles`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `.ap-status-card` (+ variantes)             | Le DS a les tokens `--comp-status-card-*` mais pas de classe CSS-UI. Recrée la primitive (miroir `libs/ui-components/status-card`). Container-query masque l'icône < 130px. Modifiers en `.tagOrange` (pas `.tag-orange`).                                                                                                                                                                                                                                                                                                                                                                                                     |
| `button.ap-link`                            | `.ap-link` DS suppose un `<a>` ; reset le chrome UA d'un `<button>` stylé en lien.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `.ap-filter-chip` (+ états, `-count`)       | Primitive en route vers le DS (V2-Atoms › FilterChip). Pill 24px, `aria-pressed` → ramp electric-blue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `.ap-dropzone` (famille)                    | Le DS n'a pas de dropzone. Box partagée « drop / browse » ([`dropzone.js`](../../src/components/dropzone.js)), variantes `--compact` / `--lg`, survol de fichier `.is-dragover` (posé par `bindDropzone`) ; les studios surlignent toute la surface via `.session__assistant.is-drop-target`. État désactivé `aria-disabled="true"` (gris, inerte, avale le dépôt) — une zone pleine reste visible ; modificateur `--filled` (fond gris en permanence).                                                                                                                                                                        |
| `.ap-button.mermaid` (`--ap-mermaid-inner`) | Le DS peint l'intérieur du bouton en dur `--ref-color-white`, donc il ne rend correctement que sur du blanc. Hook exposé pour qu'un hôte teinté lui passe son fond (défaut = valeur DS). ⚠️ C'est une bordure dégradée : **poids de contour, jamais un primaire**.                                                                                                                                                                                                                                                                                                                                                             |
| `.ap-radio-card-title` (ink)                | **Bug de cascade du DS**, pas un choix de design : `.ap-radio-card-title { color: grey-100 }` (0-1-0) perd contre `.ap-radio-card > div > span { color: grey-80 }` (0-1-2) déclaré plus haut dans le même fichier — or un titre EST un de ces spans. Résultat : le NOM d'une radio-card sort dans l'encre secondaire, même taille et même gris que le hint sous lui, donc la carte n'a aucune hiérarchie. Réénoncé ici à l'intention d'origine avec assez de spécificité pour atterrir. Touche toutes les radio-cards de l'app (Save drafts, la modale de programmation legacy, les widgets Top posts / Topic Feed, l'Admin…). |
| `.ap-tabs.flush`                            | Modificateur de racine manquant : le libellé du 1er onglet est à 16px (padding du tab, sa zone de hover) du bord où s'alignent titres, phrases et cartes. `.flush` décale la rangée de ce padding, garde le filet au bord du contenu (tracé par la racine) et réduit l'indicateur actif au libellé. 1er usage : les onglets de la fiche Playbook 2.0.                                                                                                                                                                                                                                                                          |
| `.ap-slider`                                | Le DS n'a pas de range input stylé : piste + pouce aux tokens, anneau de focus electric-blue-10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `.ap-textarea-field.narrow`                 | Le textarea DS impose `min-width: 256px` ; `.narrow` le lève pour les colonnes étroites.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.ap-segmented-control`                     | **Port** du composant Angular-only (aucune classe CSS-UI en 22.0.17), pour les Variations de l'Image Generator (1 · 2 · 3 · 4). Substitutions de tokens commentées dans le fichier. Pas pour changer de page ou de voie : c'est des tabs.                                                                                                                                                                                                                                                                                                                                                                                      |
| `.ap-stepper`                               | **Restylé** sur le « Stepper » de Figma (V2 Atoms 7873:1568) : CSS-UI a encore l'ancien look (pastilles 24px, electric-blue-100 sur halo blue-10). Pastille 20px, en cours = electric-blue-150 plein + chiffre blanc, à venir = contour grey-20 + grey-80, libellés Body Bold 14/18 dans l'encre de la pastille, 8px dans un pas et entre pas et chevron. Pas d'état « fait » dans Figma : il garde le look à venir, le chiffre remplacé par une coche. Onboarding + barre du projet Clips.                                                                                                                                    |
| `.ap-close-button`                          | **Port** du composant Angular-only `<ap-close-button>` (Figma : « Helper - Clear Button », V2 Atoms 7425:7023 — 20 × 20 tout compris) (CSS-UI ne l'a que dans `.ap-infobox-close` / `.ap-tag > button`), pour les vignettes d'images de référence du créateur de style et le × de la status card d'un draft réécrit. Mêmes tokens `--comp-close-button-*`.                                                                                                                                                                                                                                                                     |
| `.ap-filter-dropdown` / `.ap-filter-leaf`   | **Port** du filter dropdown Angular-only, pour le panneau Filters du Topic Feed. Ombre = `--sys-elevation-floating` (DS 22) ; les autres substitutions attendent la famille `--sys-color-*-interactive-*`, non publiée.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `.app-ring` / `.app-bar`                    | Anneau et barre de progression (tiers on-track / at-risk / off-track d'Insights) : le DS n'a aucun composant de progression.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `.ap-status.is-working`                     | Le point de la pill respire tant qu'Archie travaille (`@keyframes ap-status-working`), rien sous `prefers-reduced-motion` ; dans le fil `.e-turn` (flag `newConversationStyles`) le point disparaît (l'avatar est le loader) et une pill finie passe en grey-10.                                                                                                                                                                                                                                                                                                                                                               |
| `.ap-checkbox-container` sans libellé       | Le DS 22 donne à une checkbox sans libellé `padding: 10px` + un disque de survol : une marge négative garde la zone de clic du DS mais rend à la case son encombrement de 16px.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `.ap-icon-sparkles-mermaid` (hors bouton)   | Le DS livre le glyphe en masque peint en `currentColor` : « mermaid » sort gris. Hors d'un `.ap-button`, peint avec `--ref-color-mermaid-gradient-background` ; dans un bouton, l'encre du bouton gagne. 1er usage : le titre du bloc Generate an image.                                                                                                                                                                                                                                                                                                                                                                       |
| `.ap-avatar.app-avatar--brand`              | `.ap-avatar` peint ses initiales sur `--comp-avatar-background-color` (gris) sans couleur par instance. Le logo d'une entreprise dans le picker des mentions et son écho = l'initiale (blanche, Averta, déjà celle du DS) sur la couleur de la marque, donnée en JS (`style="--app-avatar-brand: #…"`), comme les accents tiers.                                                                                                                                                                                                                                                                                               |
| Keycap (`kbd`)                              | Le DS n'a pas de keycap : un seul style pour tous les `<kbd>` de l'app (⌘K, la légende des raccourcis, l'indice du composer, la sidebar).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

Retirés le 2026-09-30 : `.ap-button.danger` (une confirmation destructive est l'orange primaire portant le verbe, pattern Decided du skill), `.ap-divider`, les patches `X[hidden] { display: none }` (remplacés par une seule règle `[hidden]` dans `base.css`), `.ap-infobox.feature-lock` (le DS 22 le livre).

Règle : **jamais** redéclarer une `.ap-*` hors ce fichier (ça flippe la cascade silencieusement).

---

## 2. Tokens app-only (`styles/tokens.css`)

Tous namespacés `--app-*`. Charte : _« prefer DS tokens first; fall back to these only for handoff-specific values »_. Groupes :

- **Surfaces** : `--app-bg`, `--app-surface`, `--app-surface-subtle`, `--app-border` (grey-20, TOUT filet ; l'ancien `--app-border-soft` grey-10 y a été fondu), `--app-color-sidebar-bg`, `--app-modal-backdrop`, `--app-thumb-scrim` (dégradé sous un texte posé sur une vignette).
- **Accent « butter »** (Archie) : `--app-butter` (#f7ffc5, fond pill status), `--app-butter-accent` (#8a9b2e olive, dot).
- **Logo mark** : `--app-archie-mark` (#ff3c00).
- **Conversation navy** (brand tertiaire #0A1B33, remplace l'electric-blue dans le thread) : `--app-convo-navy(-deep/-05/-10/-20)`.
- **Pas de palette sombre** : ⚠️ la rampe `--app-vc-*` et le périmètre sombre du Clips space ont été retirés le 2026-10-26 — ne pas les ramener. Le Clips space et la modale Video Clips sont le DS clair et ses composants ; **seule la vidéo se lit sur un puits noir** (`#000` littéral), et ses calques (cadre de recadrage, zones sûres, boîte de sous-titres) gardent leurs couleurs littérales. Restent faits main, faute de composant DS : la timeline, la rail d'outils de l'éditeur, les glyphes In / Out / Split / Snap / Join et le sélecteur de couleur (swatch natif + hex).
- **Radius** : `--app-radius-sm/-md/-lg` (alias des `--sys-border-radius-*`), `-button-sm` (6), `-starter` (10), `-card` / `-xl` (12), `-modal` (16), `-pill` (999), `-circle` (50%).
- **Elevation** : `--app-shadow-subtle/-low/-popover-md/-lg/-drawer-left/-card/-modal/-orange-hover`.
- **Easing** : `--app-ease-out/-bounce/-standard`.
- **Espacement** : `--app-spacing-micro` (2), le seul pas sous l'échelle DS.
- **Graphes** (Insights) : `--app-chart-on-track/-at-risk/-off-track/-neutral` (+ `-soft`), `-target`, `-grid`, `-axis`, `-axis-line`, `--app-chart-data-1…10` (voir §3bis).
- **Mesure** : `--app-content` (1080) — la largeur de contenu de TOUTE page pleine largeur. C'est la mesure de la fiche Playbook (`.recap > *`, welcome.css), adoptée le 2026-09-11 comme référence de l'app à la place de trois caps qui ne s'accordaient pas (1280 catalogue + connectors, 1200 Insights, 1080 fiche). Tout est `border-box`, donc une page qui se padde elle-même plafonne à `calc(var(--app-content) + 2 * <son gutter>)` : ce qu'un lecteur compare d'une page à l'autre, c'est où le CONTENU commence, pas où la gouttière invisible commence. Seule exception, documentée dans son fichier : `/topics`, dont le cap est une SOMME (plafond de la liste + mesure de prose + gaps) et pas un goût. `--app-chat-card` (520) est la largeur d'une carte d'Archie dans le fil.
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

  ⚠️ **La condition est la partie qu'on oublie.** Sur une rangée sans ancrage (ni titre à gauche, ni search / sort à droite), « poussé à droite » produit un bouton seul dans du vide. Dans ce cas le cog rejoint ce qu'il configure, ou monte dans la topbar : celui de `/topics` (les réglages du feed) est au bout à droite de la topbar ([`topbar.js`](../../src/components/topbar.js)), la place canonique d'une action de niveau page.

- ⚠️ **LA RANGÉE 1 EST DÉJÀ PRISE : c'est la topbar du shell.** Le produit ouvre bien sur une rangée de titre (5/5) — mais dans cette app `topbar.js` imprime le nom de la route pour **toute** route de premier niveau. Une page qui redessine son titre ne suit pas le motif, elle le double : `/topics` a imprimé « Topic Feed » 40px sous une topbar imprimant « Topic Feed », sur une rangée qui ne portait rien d'autre que le cog. Un titre seul ne fait pas une rangée.

  La règle qui tient : **la topbar nomme la route, et un écran ne dessine son propre titre que si la topbar le lui a CÉDÉ** — `/playbook/:id` et `/topics/settings`, où elle prend un contrôle de retour à la place — **ou si la rangée porte plus qu'un titre**. `/contexts` suit la règle aussi depuis le 2026-11-02 : plus de rangée de titre, son « Create a Playbook » est monté dans la topbar.

  Quand la rangée 1 revient au shell, l'action de page (CTA, cog) monte dans la topbar (`setTopbarActions`) — l'invariant est « dernier à droite ».

- **Filters est un bouton LIBELLÉ**, funnel + le mot + son compteur **inline** quand il filtre (3/3). ⛔️ Jamais un icon-button avec un badge flottant : c'est le contrôle qui dit combien de la liste est caché, il ne peut pas être le plus dur à trouver.
- **Ce qui rétrécit la liste va à GAUCHE de la rangée 2** ; **search et sort vont à droite** (3/3). Si l'écran n'a pas encore de search, la droite reste vide — on ne la remplit pas pour équilibrer.
- **Un select de toolbar porte son label DEDANS**, via `.ap-select-inline-label` (4/5) : `Creator │ Select`, `Status │ Active`, `Playbook │ Acme · Q2 marketing`. ⛔️ Jamais un `<label>` empilé au-dessus — c'est du chrome de formulaire, pas de toolbar — et jamais un select nu, qui ne dit pas ce qu'il scope.
- **Deux vues nommées d'une même liste, avec compteurs → TABS** (3/3), pas un segmented control. On ne voit qu'une vue à la fois, ce qui est la définition des tabs. Markup : `.ap-tabs > .ap-tabs-nav > .ap-tabs-tab.active` + `.ap-counter normal blue|grey`.

Exemples en place : [`screens/topics.js`](../../src/screens/topics.js) (la toolbar : select Playbook + Filters ; le cog dans la topbar), [`screens/home.js`](../../src/screens/home.js) (onglets à compteur puis toolbar à search ; le CTA dans la topbar), [`content-workspace.js`](../../src/components/content-workspace.js) (les tabs et leur compteur).

### Cartes + hover

**Un `:hover` ne porte JAMAIS de fond bleu — seulement la bordure** : un sol teinté au survol se lit comme un **état sélectionné**. Sur `.topic-card--feed` (repris d'`ap-mini-post`, la carte du feed Listening en prod), les états se distinguent par la **force de la bordure**, pas par un fond — un dispositif par question :

- `:hover` → `border-color: --ref-color-electric-blue-40` (« tu pointes ceci »)
- `.is-reading` → `border-color: --ref-color-electric-blue-100`, fond **blanc** (« celui-ci est ouvert »)
- `.is-triaged` → fond `--ref-color-grey-05` (le `--seen` du produit) : le SOL porte l'axe traité / pas traité, la bordure l'axe pointé / ouvert. `.is-reading` passe après, donc une carte triée et ouverte revient au blanc.
- `.drafts-card:hover` → `border-color: --ref-color-electric-blue-100`, sans fond ; actif (`.is-active`) = electric-blue-40 + lavis electric-blue-05.
- `.top-post-card:hover`, `.clip-card.is-selected` → `border-color: --ref-color-electric-blue-100`.
- **Une carte qui prend la bordure bleue au survol doit répondre au clic.** Le survol promet une action : si seuls ses boutons agissent, on clique le texte et rien ne se passe (dead clicks mesurés sur la carte Idée, 2026-10-19). Soit la carte entière déclenche son action principale (en déléguant au bouton, pour garder un seul câblage et le chemin clavier), soit elle ne prend pas la bordure bleue.
- **Exception arbitrée (ui-polish OB-16, 2026-10-30) : la rangée vedette du reveal de l'onboarding** (`.welcome-flow__option.is-featured`, « Start writing », `welcome.css`) survole en **orange-150**, pas en bleu : elle est déjà tout entière dans l'orange de l'IA (bord, fond orange-10, tuile), et une bordure bleue au survol y lisait comme un second sens. C'est la seule ; toute autre carte survole en bleu.
- Radius carte = `--app-radius-card` (12). Tuiles icône AI/brand = fond `--ref-color-orange-10` + glyphe orange.
- ⛔️ **Jamais de liseré d'accent coloré sur un bord de carte** (`border-left: 3px solid …`). Règle catégorique de Matt. **L'état d'une carte va dans son contenu, pas sur son cadre** — un marqueur explicite (point + mot, ex. « • New ») dit la même chose sans repeindre la bordure. Les `border-left` / `border-right` restants sont des séparateurs de panneau 1px (ex. `video-clips-modal.css`), pas des accents.
- Cartes in-bubble : `.chat-bubble-card` (grey-05, border grey-10) via `bulletsBlock()` (`_analyse-common.js`).
- **Une carte qui vit sur plusieurs surfaces prend son propre fichier** — [`components/topic-card.css`](../../styles/components/topic-card.css) : la carte Topic rend dans le feed (`--feed`), dans le picker (`--picker`) et dans le widget in-chat « Pick from the Topic Feed » (`--widget`, sans cadre, dans une radio-card). Mêmes hooks `data-*`, donc un écran les câble une fois.
- **Dans une grille de cartes, `grid-auto-rows: 1fr`** (+ `flex: 1 1 auto` sur le corps) : les cartes d'une même rangée finissent à la même hauteur et leurs pieds s'alignent. Une grille de hauteurs inégales est la moitié de la scannabilité en moins. Une **une** peut casser la règle — mais alors elle est seule à le faire, et exprès.
- **Un composant qui vit dans deux hôtes sort deux variantes, et sa règle de base ne porte AUCUN cadre.** `topic-card` rend une carte dans le feed (`--feed`, qui peut être celle qui est ouverte à côté de la liste) et une carte dans la dialog du picker (`--picker`, où un clic choisit, donc rien ne reste sélectionné). Toute déclaration de cadre — `background`, `border`, `border-radius`, et les états qui les teintent — vit sur la variante, jamais sur la base : une `border` partagée est ce qui a fait fuir le cadre d'une variante dans l'autre. Le test qui le prouve est d'ouvrir le picker après avoir touché au feed.
- **⛔️ Le cadre appartient aux OBJETS, jamais à la colonne qui les liste.** Essayé et retiré sur `/topics` : pour casser un effet « mur de cartes », le cadre est passé des cartes à la rangée qui les contenait, avec un filet entre la liste et le volet. Le mur venait des **gaps et du poids**, pas des bords — et une surface unique de 1440px se lit comme une dalle qui n'appartient à aucune autre vue de l'app. Si une liste pèse trop : resserrer les gaps, alléger la graisse, clamper le texte. Pas déshabiller les items.
- **Sur une vraie ligne, l'état est un REMPLISSAGE ; sur une carte, une bordure.** Une ligne n'a pas de cadre à teinter, donc l'état va au fond (ex. les `__item` de l'Overview du panneau, lavis grey-05). Une carte suit la convention de l'app — bordure bleue au survol, raffermie quand elle est ouverte. Dans les deux cas, ⛔️ jamais de bordure gauche colorée, qui est la tentation de tout master–detail.
- **Le lu / non-lu se lit à la graisse.** Dans une file à trier, l'élément qui attend encore une réponse garde la graisse pleine et ceux qui ont été traités reculent d'un cran. La graisse **seulement** : l'encre ne change pas.
- **Une carte qui doit changer de mise en page selon la place qu'elle a reçue** se déclare `container-type: inline-size` et utilise une **`@container` query**, pas une media query : sidebar repliable + panneau de droite qui overlay, la largeur du viewport ne dit jamais la largeur du contenu. Cas en place : le split liste / article de `/topics` (`@container topics-feed`, empilé sous 760px) et la grille de `/topics/settings` (une colonne sous 920px).

### Boutons / CTAs

DS `.ap-button` avec `primary|stroked|ghost` × `orange|blue`. Icon = `.ap-icon-button`, transparent par défaut dans le DS 22 (le modificateur `transparent` n'agit qu'avec `.stroked` ; il n'y a pas de taille `sm` / `lg`). Lien-bouton = `button.ap-link` (patché). Pas de `.ap-button.danger` : une confirmation destructive est l'orange primaire portant le verbe ; une action destructive secondaire du Quickpicker est `stroked red`. **Jamais full-width** (voir mémoire _buttons-never-full-width_).

### Selects (`.ap-select`)

`<details class="ap-select">` + `summary.ap-select-trigger` + `.ap-select-dropdown > .ap-select-options > .ap-select-option`. **Dans une toolbar, le label va DEDANS** : `<span class="ap-select-inline-label">Playbook</span>` en tête du trigger, avant le `.ap-select-value` — le DS dessine le séparateur vertical. Voir § En-tête d'écran. Options peuvent porter `.ap-select-option-caption` (2ᵉ ligne) et `.ap-select-option-check`. **Jamais un `<select>` natif** (mémoire _use-ds-dropdowns_). Le picker de Playbook de `/topics/settings` utilise aussi la dalle de recherche du DS : `.ap-select-search` > `.ap-select-search-icon` + `.ap-select-search-input`, avec `.ap-select-not-found`. ⚠️ `.ap-select-not-found` porte `display: flex` → il bat `[hidden]` ; masquer en `style.display` inline.

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

Première utilisation de la moitié layout de cette famille : [`topics-settings.css`](../../styles/screens/topics-settings.css) (`/topics/settings`, les réglages du Topic Feed).
Trois écarts assumés à la recette, appris en construisant cette page :

- **Titre de page en `.ap-h1` (24px), pas `.ap-h2` (18px).** À 18 le titre de page n'est qu'à 2px des `.ap-card-title` (16) et la hiérarchie se lit plate. 24 → 16 → label de groupe en `.ap-caption-bold` (12) donne trois marches lisibles, et 24 est déjà la taille des titres des autres pages de l'app.
- **Ne pas donner une carte à un contrôle isolé.** Un `.ap-card-title` au-dessus d'un unique `.ap-select` est surtout du padding. Les contrôles de **niveau page** (le Playbook, le rythme) vont dans une **toolbar** (`.topics-settings__bar`), le label DANS le select (`.ap-select-inline-label`) comme sur la toolbar du feed ; les cartes sont réservées à ce qui a du contenu.
- **Le cap est `--app-content`, pas `-max-width-lg` ni `-md`** : la page s'aligne sur toutes les pages pleine largeur (`calc(var(--app-content) + 2 * --sys-settings-content-internal-margin)`). À 700, deux colonnes de cartes de config sont serrées ; la prose est plafonnée à part, et la grille tombe à une colonne par une **`@container` query**.

### Filtres — chips, selects ou dropdown ?

**Règle du DS** (`choosing-components.md` › Filtering) : bascules **toujours visibles** → _filter chips list_ ; **options groupées / presets / une étape d'apply derrière un déclencheur** → _filter dropdown_.

⚠️ Les deux composants DS (`<ap-filter-chips-list>`, `<ap-filter-dropdown>`) sont **Angular-only** — aucune couche CSS-UI. Équivalents en prototype :

| Intention DS      | En CSS-UI ici                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter chips list | `.ap-filter-chip` (patché dans `ds-patches.css`, « en route vers le DS »)                                                                                 |
| Filter dropdown   | `.ap-filter-dropdown` / `.ap-filter-leaf` (port dans `ds-patches.css`) ; `.ap-selection-dropdown` (CSS-UI) pour une liste avec recherche (Save to folder) |

**Troisième cas :** quand chaque facette prend **une seule** valeur et s'applique **immédiatement**, ni l'un ni l'autre — **un `.ap-select` par facette**, avec `.ap-select-inline-label` pour nommer la facette dans le déclencheur et `.ap-select-option-badge` pour le compteur. Un select **montre sa sélection fermé**. Précédent en place : la toolbar de `/topics/settings` (Playbook, rythme).

**Le Topic Feed** (`/topics`) : le select Playbook (absent en mode workspace, où le rail porte le scope) puis un bouton **Filters** libellé qui ouvre un `.ap-filter-dropdown` à trois `.ap-filter-leaf` — _Topics_, _Marked as_, _Sources_ — chacune un `.ap-select` multi dont la sélection s'affiche en chips dans le déclencheur. Les signaux (trending, updated) ne sont jamais des filtres. ⚠️ Une rangée de puces de source puis des onglets ont précédé ce panneau — retirés, ne pas les ramener.

### Filter chips

`.ap-filter-chip` piloté par `aria-pressed`, `-count` optionnel. Les slots `-icon` / `-avatar` ont été écrits puis jamais utilisés — ils sont partis avec la passe de CSS mort ; les remettre est un `git revert`, pas une réinvention. Partout : connectors-view, playbook-view, playbook-brand-kit, right-panel/ideas-view, feedback-control, objective-modal, bug-report-modal, schedule-modal (+ legacy), image-studio.

### Status pills

DS `.ap-status` + `blue|green|grey|orange|mermaid` (mermaid patché ; le DS a aussi `red` et `tagOrange`). Les états de travail in-conversation utilisent `mermaid` (butter + dot olive).

### Quickpicker (inline-question)

Le « pick one of N » réutilisable. État dans [`inline-question.js`](../../src/inline-question.js), rendu par `renderPicker()` dans [`_analyse-common.js`](../../src/screens/_analyse-common.js) sous le chrome `session__assistant--wizard`. Modes : rows numérotées, `variant:"cards"`, `multi`, `single`, `stepper`, free-text, file. **Le CTA submit est bleu** (pas l'orange AI) — mémoire _quickpicker-primary-is-blue_ + _quickpicker-secondary-button-tiers_. Contrôles = vrai radio DS, fade-to-bg gris — mémoire _ds-controls-and-fade-bg_.

**Une ligne qui mène ailleurs** (`items[].link = { href, label }`, 2026-11-03, mentions) : la ligne devient `.analyse__option-row`, qui porte le filet et le filtre de recherche, dont le `<button>` couvre toute la ligne (une seule surface pour le survol et la sélection) et garde à droite la place d'un `<a class="ap-icon-button">` + `ap-icon-external-link` posé par-dessus, nommé par son tooltip (`data-tooltip`) et son `aria-label` — jamais un lien dans le bouton ; la coche de la ligne vient juste avant. Avec : `items[].avatar.square` (`.ap-avatar.square`, le logo d'une entreprise), `items[].avatar.tint` (`.ap-avatar.app-avatar--brand`, ds-patches : l'initiale sur la couleur de la marque), `emptyText` (ce que dit une recherche vide), `submitCountLabel(n)` en multi (le bouton compte les coches, `data-count-label`), `searchQuery` (la recherche de départ).

### Références inline dans les messages d'Archie

La seule façon de nommer un objet dans un message d'Archie : un jeton `[[post|idea|source:id]]` dans le texte, transformé par `renderRefs()` (`src/chat-refs.js`) en `<button class="chat-ref" data-chat-ref="kind:id">`. Pas de pill, pas de guillemets, pas de `**gras**`, pas de « #N ». `.chat-ref` (`styles/chat.css`) : inline (pas `.ap-link`, qui est `inline-flex` et casse le retour à la ligne), bleu lien, souligné **pointillé** au repos, plein au survol. La preview (`.chat-ref-preview`, [`ref-preview.js`](../../src/components/ref-preview.js), montée sur `<body>` comme `tooltip.js`) réutilise le renderer du panneau — pour un draft, la ligne compacte du top post (`renderPostEchoRow` : miniature, profil + badge réseau, 2 lignes de texte, sans métriques ni statut), `renderCompactIdeaCard`, `renderSourceCard` — en `inert`. **Plusieurs objets = une liste, jamais une phrase** : une ligne `- [[post:id]], ready` par objet (séparées par `\n`) devient un `<ul class="chat-bubble-list">` à puces ; le reste du texte devient des `<p>` (la bulle est donc un `<div>`). Un nouveau type d'objet = une entrée dans `resolveRef` / `refLabel` + un attribut dans `FOCUS_ATTR` (`right-panel.js`).

### Choisir des posts dans le chat — Quickpicker `variant: "posts"`

Quand Archie fait choisir des drafts, la question reprend **la liste des posts du thread** (celle du plan de schedule) plutôt que des lignes Quickpicker numérotées : un cadre `.post-pick` (filet grey-20, `--app-radius-lg`), une ligne par draft (`.post-pick__row`, filet entre lignes, survol grey-05) = contrôle DS + glyphe réseau + libellé-référence (`.chat-ref`, preview au survol). Le contrôle est le vrai DS — `.ap-checkbox-container` en multi, `.ap-radio-container` en simple — mais c'est **la ligne** qui le pilote (son input est `pointer-events: none`, tenu à jour par le délégué). Rien de pré-coché, primaire bleu (orange pour _Schedule_, l'acte final) désactivé tant que rien n'est choisi, _Not now_ en ghost grey. Items : `{ value, label, icon, sessionId }`.

### Panneau de droite

`.app-right-panel` (blanc, `border-left`), `__resize` (strip 6px, electric-blue au hover ; la largeur glissée vit dans `--app-right-panel-width-runtime` sur le shell, jamais persistée), `__close`, `__body` (`container-type: inline-size`), `__empty*`.

Flag `contentPanel` : les onglets dans la topbar — `.app-topbar__content` > `.rpanel-tabs` (`.ap-tabs` qui remplit la hauteur de la topbar pour que le soulignement actif tombe sur son bord bas, Overview │ Sources › Ideas, Clips › Drafts — Clips seulement s'il y en a, chevrons `__step`, filet `__divider`, point `__new`, puis le close) ; le panneau `.app-right-panel.is-content` n'a pas d'en-tête ; `__body.is-entering` = fondu + 8px de glissé au **changement** d'onglet seulement (pas à chaque re-render), coupé par `prefers-reduced-motion`. L'Overview : `.rpanel-ov__next` = l'infobox DS telle quelle (`.ap-infobox info|warning|success`, l'action `stroked grey` dans `.ap-infobox-content`, comme la Retry du failed turn — pas de bloc maison) puis des `.rpanel-ov__section` séparées par un filet grey-20, jamais encartées — `__section-head` (titre 16, `__metric` en mots, `__link` à droite) ; lignes `__item` (le bouton est la ligne, lavis grey-05 au survol) avec `__tile` 36px bordé ; `__strip` = pellicule horizontale des clips (`thumbBackground` de `clip-card.js`, durée sur scrim) ; les drafts, seuls à être des cartes (`__draft`, hover bordure bleue). Les onglets Sources / Ideas / Drafts : canevas grey-05 via `[data-rpanel-last-mode]`, tout scopé sous `.app-right-panel.is-content`. Les icônes réseau `-official` sont des images : jamais de `background` dessus (ça les écrase en carré).

### Ce qui a changé dans un draft — un seul vocabulaire (flag `draftChanges`)

Ajouté = **butter** (`--app-butter`) souligné olive (`--app-butter-accent`) : ce que j'ai écrit, à la couleur d'Archie. Retiré = barré rouge DS (`--sys-color-error-text`) sur `--sys-color-error-light-bg`, encre grey-80 gardée. Balises `<ins class="draft-diff__add">` / `<del class="draft-diff__del">` + « Added: » / « Removed: » masqués pour les lecteurs d'écran : [`styles/components/draft-changes.css`](../../styles/components/draft-changes.css).

**Sur le draft, et seulement là** : au-dessus, la status card verte (`.ap-status-card.green` de ds-patches + `.posts__card-changes`, [`post-card.js`](../../src/components/post-card.js)) — « Your post has been updated. » + Undo ↔ Redo (`.ap-link` avec flèche) · View changes ↔ Hide changes (`.ap-link`, `aria-pressed`) · × (`.ap-close-button`, `ap-icon-close`). Au repos, le texte tel qu'il sera publié, ajouts marqués ; View changes passe le corps en lecture `unified` (`diffParagraphs`), les ajouts en vert (`.is-viewing-changes`, success du DS) face aux retraits en rouge, et ajoute les hashtags retirés et l'ancien CTA, barrés. Le surligneur se trace à l'arrivée (`draft-diff-sweep`, deux fonds dont on anime `background-size`), rien sous `prefers-reduced-motion`.

**Dans le chat, rien que ma phrase**, son sujet en lien (`.chat-ref` : le draft via `[[post:id]]`, ou « your N drafts » via `data-content-card`, qui ouvre le panneau et fait défiler jusqu'au draft) : pas de carte, ni diff ni récap (les deux ont été essayés et retirés le 2026-11-03). Un seul Undo, celui du draft.

### Toasts

[`toast.js`](../../src/components/toast.js) wrap `.ap-snackbar-thread` / `.ap-snackbar` (+ `.success`/`.error`, `.animate-in/-out`). Queue app (`MAX_VISIBLE=3`), dwell 3200 ms (pause au hover), Undo optionnel (`.ap-link`). Région `#toastRegion`.

### Empty states

`renderEmptyState()` ([`empty-state.js`](../../src/components/empty-state.js)) : `.session__empty` (ou `wrapperClass`) > `.session__empty-icon` > `h3.text-subtitle` > `p.muted.session__empty-body` > `.session__empty-action`. L'icône (`.session__empty-icon`, glyphe `ap-icon-xl`). Variante panneau : `.app-right-panel__empty` — l'icône y est **nue**, sans médaillon derrière, glyphe grey-80 (⚠️ le disque grey-10 a été retiré, ne pas le remettre).

### Fente média vide (draft sans image) — une vraie dropzone

`.posts__card-media-empty` ([`post-card.js`](../../src/components/post-card.js) `renderEmptyMedia`, la raison en tête de fichier ;
CSS dans [`posts.css`](../../styles/screens/posts.css)) : `-slot[data-post-drop]` (pointillé grey-20, fond
`--app-surface-subtle`, `min-height` 200) > `.posts__card-media-shortcut` (le bouton + `.posts__card-media-preset`,
ce qu'il va faire) + `.posts__card-media-alt` ; puis `-hint` **hors** du cadre (il parle du Playbook, pas de cette image).
Pendant la génération, la fente laisse la place à la boîte de l'image (`.posts__card-media-generating`, 4:3)
remplie par `<archie-pixels>` — voir § Le loader de génération d'image.

- **Deux étages.** 1 : `.ap-button.mermaid` « Generate an image », le traitement IA du DS — une **bordure
  dégradée** (le DS n'a pas de bouton IA plein), seul accent du bloc ; il prend la largeur de l'étage du dessous
  (la seule exception à « jamais pleine largeur », demandée). 2 : « Image Studio » + « Add image », deux `stroked grey`
  côte à côte, un gap de groupe plus bas. ⚠️ **Jamais un second bouton À CÔTÉ du mermaid** : deux rectangles en
  contour se lisent comme des égaux. Ne pas « restaurer » `.primary.orange` ni `.primary.blue` sur Generate.
- **Le pointillé est un vrai dépôt** : toute la fente reçoit le fichier (drag events seulement, câblés dans
  [`right-panel.js`](../../src/components/right-panel.js) sur `[data-post-drop]`), `.is-dragover` = bordure
  electric-blue-100 + lavis electric-blue-05. « Add image » passe par l’input du rail (`data-post-image-upload`) ; pas de clic-pour-choisir sur la fente. Une fois l’image posée : « Edit image » · « Replace image » · « Remove image ».
- ⚠️ **`bindDropzone` est inutilisable ici** : son handler de clic déclenche l'input fichier pour **tout** clic
  dans la zone — appuyer sur Generate ouvrirait un file picker.
- ⚠️ **`ap-icon-missing-image` est inutilisable** : le SVG porte un `clipPath` avec un `<rect />` sans
  dimensions, qui découpe tout le glyphe. D'où `ap-icon-image`.
- ⚠️ **`.ap-button.mermaid` sur un fond teinté** : le DS peint son intérieur en blanc en dur ; un hôte teinté
  lui passe son fond via `--ap-mermaid-inner` (hook `ds-patches.css`). Sur la fente, le blanc est gardé exprès :
  c'est la seule surface pleine, donc le raccourci mène.

### Réordonner une liste — `drag-reorder.js`

**Une seule façon de réordonner dans l'app** : `bindReorder(root, done)` ([`src/drag-reorder.js`](../../src/drag-reorder.js)) + [`drag-reorder.css`](../../styles/components/drag-reorder.css). Markup : la liste `.app-reorder`, ses éléments `.app-reorder__item`, une poignée `.app-reorder__grip` (`ap-icon-move`, grey-40 → bleu au survol ; un `<button>` si la liste se réordonne aussi au clavier). Au pointeur, pas de DnD natif : l'élément saisi se soulève (ombre + bordure bleue) et suit le pointeur, les autres glissent pour ouvrir la place, il s'y pose, puis `done(from, to)` — l'hôte réordonne son état et re-rend. Seul consommateur aujourd'hui : la modale de programmation legacy. ⚠️ Ne pas refaire un glisser-déposer à côté.

### Modals / backdrop

DS `.ap-dialog` centré par `modals.css` sur `.open`, posé / retiré par `showOverlay` / `hideOverlay` ([`modal-coordinator.js`](../../src/modal-coordinator.js), avec le backdrop). `.app-modal-backdrop` patché (fade via `@keyframes app-modal-backdrop-fade`). Radius : celui du DS (8px). `--app-radius-modal` (16) ne sert pas les dialogues — seulement les panneaux de l'Image Studio et une carte de l'onboarding. Modals empilés → couches `--app-z-modal-stacked*`.

**Un nouveau modal doit être ajouté aux DEUX listes de sélecteurs de [`modals.css`](../../styles/screens/modals.css)** (la coquille centrée, et la variante `.open` qui passe `display: none` → `flex`). Sinon il reste invisible avec un backdrop actif. Corollaire : ne pas redéclarer `display` sur la classe du modal dans une feuille chargée **après** `modals.css`.

Échelle de largeurs (`modals.css` : `width: min(calc(100% - 32px), Npx)`) :

| Largeur | Modals                                                                                                                                        | Pourquoi                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 440     | rename, clip range                                                                                                                            | un seul champ                                                |
| 520     | topic ignore, topic history, network voice                                                                                                    | une question ou un groupe de radios                          |
| 560     | feedback, bug report, chat picker, search, connect account, analyze profiles, fill from a document, save to folder, shortcuts, voice proposal | une liste courte ou un formulaire                            |
| 640     | add source                                                                                                                                    | formulaire + onglets                                         |
| **720** | **topic picker** (la liste) ; schedule (`schedule-modal.css`, et la legacy)                                                                   | **lecture** — au-delà, la mesure de prose décroche           |
| 920     | connectors                                                                                                                                    | une gallery à parcourir                                      |
| 960     | topic picker en vue article (`.topic-picker--wide`, corps à deux colonnes) ; schedule legacy en variante large                                | deux colonnes                                                |
| 1040    | voice intro                                                                                                                                   | deux colonnes : les mots, et la scène sur le champ de pixels |

Les modals hauts plafonnent leur hauteur (`max-height: min(calc(100vh - 48px), …)`) et font défiler leur `.ap-dialog-content`, avec un footer d'actions collant : la décision doit rester atteignable quelle que soit la longueur du contenu.

---

## 3bis. Insights — ce qui vient de la plateforme, et ce qui n'existe pas là-bas

La page Insights est la seule surface du proto qui a un **équivalent en production** : la
tribu `analytics` du monorepo (`~/code/platform`) ship une bibliothèque partagée
(`analytics/commons/frontend/libs/analytics/ui`) dont Reports et ROI sont faits. Audit du
2026-09-11, et ce que le proto en a repris :

| Le proto                                             | La source en prod                                                                                                                         | Repris ?                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--ins-content` (mesure de page)                     | `.report-content-view` — `max-width: 1200px` centré (`analytics.scss`)                                                                    | ❌ **annulé le 2026-09-11** : `var(--app-content)` = **1080**, la mesure de l'app (§2). Dans CETTE app, une page 120px plus large que toutes les autres se lit comme une autre app, et on arrive sur Insights depuis la fiche, pas depuis Reports |
| `--ins-display-xl` (gros numéral)                    | `.main-data` — **38px** bold grey-100. Les deux autres numéraux de prod : 24px sur une overview-card, 64px sur une tuile de widget pleine | ✅ 38px                                                                                                                                                                                                                                           |
| `.ins-section` (châssis de section)                  | `[analytics-section]` — grey-10, radius 8, `.section-content{padding:md;gap:md}`, `.title-wrapper`, `.button-wrapper`                     | ✅ composé **avec** `.ap-card`, dont le cadre est déjà identique (même bordure, `--ref-border-radius-md` = 8px) : seule la respiration passe de `sm` à `md`                                                                                       |
| thème Highcharts (`insights/charts.js` `applyTheme`) | `ChartOptions.DEFAULT_OPTIONS` de **`@agorapulse/ui-charts` v22**                                                                         | ✅ tooltip **blanc** 4px sans bordure + son ombre (c'était une bulle d'encre sombre), grille et lignes d'axe grey-10, labels grey-85 12px, `allowDecimals:false`, `inactive.opacity 0.2`, `hover.brightness 0`                                    |
| `lineWidth` du spline                                | `ChartSplineOptions` — **4**                                                                                                              | ✅ sur le plein format ; **2** en `compact` (4 sur une courbe de carte à 104px est un ruban, et la prod n'a pas de graphe si petit à copier)                                                                                                      |
| `--app-chart-data-*`                                 | `ChartColors.DATA_COLORS` — 10 teintes, ordre fixe, lues par position (`getDataColor(n)`)                                                 | ✅ remplacent une rampe maison (electric blue / purple / menthol…), que le paquet déclare **dépréciée**                                                                                                                                           |
| `--app-chart-on-track` / `-off-track`                | `SENTIMENT_COLORS.positive` `#45B854` / `negative` = `LIMIT_COLOR` `#E81313`                                                              | ✅ coïncidaient **déjà**                                                                                                                                                                                                                          |
| `trendGlyph`                                         | la variation d'`analytics-overview-card` : glyphes `data-increase`/`-decrease`/`-stagnate`, `+X%`, vert **seulement si positif**          | ✅ coïncidait **déjà**                                                                                                                                                                                                                            |

Ce qui n'a **pas** été repris, et pourquoi :

- **`--app-chart-target` reste grey-80**, pas `LIMIT_COLOR`. Une _limite_ est une ligne
  qu'on ne doit pas franchir — la prod la peint en rouge parce que la franchir EST
  l'alarme. Une _cible_ est une ligne qu'on essaie d'atteindre, et une cible rouge
  au-dessus d'une courbe verte se lit comme un échec avant l'échec.
- **L'anatomie d'`ap-analytics-overview-card`** (footer métrique secondaire + lien « See
  section », tooltip info sur le titre) — pas demandée dans cette passe. Ce que la carte
  d'objectif en partage déjà : la bordure grey-10, et **bordure bleue + titre bleu au
  survol**, qui sont exactement le hover de la prod.
- **Le CTA orange** de `analytics-section-no-data` : « New objective » est un CTA de page
  de liste, donc **bleu** ici par la convention du repo (§5), et l'orange est réservé à
  l'IA. Le mettre en orange donnerait deux couleurs à la même action sur un écran.
- **Le paquet `@agorapulse/ui-charts` n'est pas ajouté** aux dépendances : ce sont des
  composants Angular (`ap-chart-spline`…), inutilisables depuis du CSS-UI. Ses valeurs
  sont **mirroitées** avec la référence en commentaire, pas importées.

### La fiche objectif = un en-tête de page + UN report card PAR MESURE

Deuxième source, celle du **design** : le fichier Figma `Analytics - Shared components`
(`1ZSobtunR472OmSX7usn8M`), page `🚧 UI`, qui tient la plupart des composants d'Analytics.
Le composant qui répond à « comment Analytics montre une métrique et ce qu'il y a derrière »
est `Card / Report card (to detach)` — et c'est ainsi qu'une page Reports est faite : un
en-tête qui nomme son sujet, puis **une pile de report cards, une par métrique**.

La fiche suit ça depuis le 2026-09-11 : `Brand awareness` est le **titre de la page**
(en-tête dans `.insights__band` : h1 + verdict, provenance · fenêtre · N measures, les deux
verbes), et `Reach` et `Brand mentions` sont **deux blocs autonomes** en dessous.

| Nœud Figma                               | Ce que la fiche en fait                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card / Report card` `1070:7477`         | `readMeasures()` → une `.ap-card` **par mesure** : bandeau gris puis corps blanc                                                                                                                                                                   |
| `Card / Title+synthesis` `1069:7931`     | le bandeau de chaque bloc : le nom de la métrique au rung **h3** (l'objectif possède h1, un rung au-dessus), sa portée dans le créneau « description », sa pastille d'état à côté du nom                                                           |
| son cadre `Synthesis`                    | `.ins-read__synth` : encart **blanc** dans le gris, padding 16, cellules label-au-dessus-valeur, filet 1px × 40 avec 24 de part et d'autre. Ici : `Progress` (38px), `Current`, `Target`, `Variation`                                              |
| `Card / Key metrics` `432:6310`          | emprunt assumé pour la cellule de tête : sa `Value` est un gros chiffre, la synthèse du report card est à 14px bold                                                                                                                                |
| `KPI / Percentage-variation` `220:25560` | la cellule `Variation` (`trendGlyph`) — coïncidait déjà                                                                                                                                                                                            |
| `Table / Simple` `1070:6792`             | **plus utilisée sur la fiche** : la table des measures a disparu avec le sélecteur (voir ci-dessous). Reste la référence pour toute table d'Analytics : `.left cols` + n × `.right cols` de largeur égale, que des chiffres, aucune forme dessinée |

Ce que ce découpage **supprime**, et c'est son intérêt : la table à cinq colonnes, son
compteur, et le **sélecteur de mesure**. Trois versions ont été dessinées pour décider où le
poser (une bande d'onglets DS au-dessus du graphe, puis des lignes au-dessus, puis des
lignes en dessous — recalées) ; la réponse était qu'une page à deux mesures n'en a pas
besoin, puisque chaque courbe peut être à l'écran en même temps. Cockpit garde la table et
les onglets : c'est la référence non modifiée.

Divergences volontaires avec le composant prod, écrites pour ne pas être « corrigées » :

- **Pas de sous-titre au-dessus du graphe.** Prod écrit `Engagement overview` sous
  `Engagement` : c'est prod qui nomme deux fois la même métrique. Le bandeau du bloc dit
  déjà `Reach` quarante pixels au-dessus du tracé.
- **La pastille d'état est à côté du nom**, pas à l'extrémité droite du bandeau où prod
  tient `Download chart` : ce créneau est dimensionné pour un bouton de 36px, et une
  pastille de 20px seule au bout d'une ligne de 1150px n'appartient visuellement à rien.
- **Pas de ligne de total** (prod ferme sa table sur un `Total engagement` en gras) : deux
  mesures d'unités différentes ne s'additionnent pas, et l'avancement d'un objectif n'est
  pas la somme de celui de ses mesures.
- **Filets en grey-20** (`--app-border`), pas `--sys-border-color-default` qui résout en
  grey-10 : règle maison pour tout filet écrit par nous, même si les composants existants
  sont en grey-10.

⚠️ **Deux choses n'ont aucun ancêtre en prod** : l'anneau de progression (`ringSvg`) et le
vocabulaire on-track / at-risk / off-track. La plateforme ne ship **aucun** widget
d'objectif — ROI fait des tables « key performance », pas des cibles — et sa seule barre de
progression est un `mat-progress-bar` (Angular) au langage de **quota** (piste
`electric-blue-10`), pas de cible. Ne pas chercher à les aligner sur quelque chose : il n'y
a rien.

## 4. Icônes

Glyphes webfont DS `<i class="ap-icon-*">` (quasi toujours `aria-hidden="true"`). Icon-buttons = `.ap-icon-button` (mettre `aria-label` sur le bouton). Les plus utilisés : `ap-icon-archie-official` (avatar), `-close`, `-plus`, `-pen`, `-check`, `-chevron-down`, `-trash`, `-file`, `-sparkles`, `-search`, `-link`, `-upload`, + glyphes réseaux (`-linkedin-official`, `-twitter-official`/`-x-official`, `-instagram-official`, `-tiktok-official`, `-facebook-official`, `-youtube-official`).

- **Sparkles = affordance AI** : `ap-icon-sparkles` marque les actions Archie (Regenerate, Suggest from this post, Compare), recoloré orange.
- **Avatar AI** = `.ap-icon-archie-official` (le mask « A », **pas** le sparkle DS).

**Exceptions inline-SVG** (animation ou path bespoke) :

- `LOADER_SVG` ([`archie-loader.js`](../../src/archie-loader.js)) — mark animé SMIL « pixel-pop » (SMIL gèle si utilisé en background/mask → injection JS).
- `ARCHIE_MARK_SVG` (`playbook-view.js`) — mark statique du recap.
- `.clip-studio__frame-art` (`session/clip-studio-view.js`) et le triangle play (`post-card.js`) — chrome vidéo déco.

---

## 5. Convention couleur en pratique

La règle : [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md#convention-couleur--usage-app-wide). Ici, son application.

- **Exemple le plus net** — [`connectors-view.js`](../../src/connectors-view.js) : action AI « Try » = `ap-button primary orange`, action routine « Connect » = `ap-button primary blue`, côte à côte.
- **Orange (AI / generate / commit)** : Send composer, Batch/Clip studio Generate, Regenerate, Save recap, Generate-image, add-source Import/Add-URL/Add-text, welcome « Build my Playbook » · « Read my website » · « Save Playbook », Image Studio « Use this image », tuiles icône AI (`--ref-color-orange-10` + glyphe orange).
- **Les éléments du fil : un seul système**. Deux côtés, chacun sa matière :
  - _Le tien_ : **tes mots** (le message que tu tapes) en `--app-convo-navy`, encre blanche ; **tes objets** (source intake, écho de sélection, profils choisis) en carte blanche, bordure grey-20, glyphe grey-100 dans un disque grey-05, titre 14 gras grey-100, type en 12 grey-80 (⚠️ le navy sur les objets pesait trop : retiré). Les deux gardent les coins 12 / 0 / 12 / 12. Le nom d'un fichier se lit en 14 gras comme ton message ; « N ideas › » / « M clips › » sont des liens DS bleus (`.ap-link standalone small`), comme le « Open clips › » des cartes de résultat — le bleu = ce qui se clique.
  - _Celui d'Archie_ : **butter** pour tout ce qu'il produit, qu'il travaille, propose ou livre (pills de statut, cartes de résultat « en cours » comme « prêt »), sans tuile derrière son glyphe ; **gris** seulement pour ce qui n'est plus disponible ; coins 8, inset 12 / 16, largeur `--app-chat-card` (520, posée sur la carte : le fil étire chaque tour à 740). Le glyphe de tête occupe une colonne de 16px, à 12px du texte, calé sur la ligne du titre : toutes les cartes d'Archie commencent leur texte au même x.
  - _Typo_ : titre 14 / 18 gras, ligne secondaire 12 / 16 grey-80 (ou navy-20 sur navy), partout ; les compteurs en chiffres tabulaires ; l'encre claire sur navy lissée en niveaux de gris. _États_ : un pill de statut d'Archie dit le présent avec un point olive qui pulse tant qu'il travaille (« Thinking », « Extracting » — `.ap-status.is-working`), puis le passé sans point une fois fini (« Thought for 6s », « Extracted 2 ideas ») ; le loader Archie est orange partout ailleurs ; « fait » = `ap-icon-rounded-check_fill` vert DS ; hover d'une carte cliquable = bordure bleue.
- **Butter (Archie : statut)** : les pills de travail in-conversation, les cartes de résultat en cours (`.drafts-card--pending` — « Cutting your clips… », « Reading the video for ideas… » : fond butter, loader orange, sans tuile ; le loader Archie est orange partout). Jamais de bouton bleu posé sur le butter. ⚠️ Pas le mermaid : essayé puis retourné (« Archie travaille avec du butter »).
- **Bleu (routine / navigation / picker submit)** : Connect, « Create a Playbook », Ideas new, playbook Start, bulk-extract, top-post CTAs, **tous les submits Quickpicker** — sauf quand le submit EST l'acte final et unique du flow : _Schedule_ (picker « Which drafts should I schedule? » et confirmation « Schedule N posts ») passe en orange (`submitTone: "orange"` / action `tone: "orange"`).
- **Conversation navy** (`--app-convo-navy*`) : override l'electric-blue pour les accents du **thread** (bulle user et son libellé de rôle, chips de choix et leurs états).

---

## 6. Layout / shell CSS

`styles/layout.css` — `.app-shell` est une grille : sidebar (`--app-sidebar-width` 260, `.is-sidebar-collapsed` → 56) + contenu, topbar (`--app-topbar-height` 56) au-dessus du contenu ; `.is-right-panel-open` et `.is-status-card-visible` ajoutent leur colonne. Modes : `body.onboarding` (une colonne, ni sidebar ni topbar), `body.account-scope` (flag `playbookWorkspace` : sans rail, topbar gardée), `.app-shell:has(.empty-chat)` (le chat neuf perd sa topbar). Les formules de largeur, les cas de coexistence et les règles de repli : [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md) — la référence, pas répétée ici.

Scaffolding (`layout.css`) : `.screen` ; helpers `.stack` / `.row` / `.row-between` / `.grow` / `.muted` / `.text-subtitle`.

---

## 7. Animations & loaders

**`base.css` (partagé)** : `@keyframes app-spin`, `app-rise` (opacité + montée ; la distance par `--app-rise-from`, 8px par défaut), `app-grow-y` (un trait qui se dessine depuis son `transform-origin`), `app-shimmer` (le reflet d'un squelette), `app-focus-pulse` (pulse electric-blue-20) — une entrée, un squelette ou un spinner de plus les réutilise au lieu d'écrire ses keyframes, + umbrella **reduced-motion** (`@media (prefers-reduced-motion: reduce)` cape toutes les durées à ~0).

**Keyframes locales** : le reste est propre à sa feuille (`grep -rn @keyframes styles`) — p. ex. `app-modal-backdrop-fade` / `app-modal-fade-in` / `app-success-pop` (`modals.css`), `ap-status-working` (`ds-patches.css`), `e-sheen` (`chat.css`), `draft-diff-sweep` (`draft-changes.css`), `rpanel-enter` (`right-panel.css`). Avant d'en écrire une, vérifier qu'une des cinq partagées ne suffit pas.

**Squelette (ghost loading) plutôt que spinner, dès que la forme de ce qui arrive est connue.** Un spinner dit « ça charge » ; un squelette dit « voilà ce qui arrive, et où ». Le gradient est toujours le même — `grey-05 → grey-10 → grey-05`, `background-size: 200% 100%`, shimmer de 1,4s linéaire infini, avec un **stagger** par élément sinon la pile pulse comme un seul bloc. Le reflet est `app-shimmer` (base.css). Consommateurs : `.thread-skeleton` (bascule de conversation), `.topic-ghost` (`/topics` pendant le scan), `.clip-studio__skeleton`.

⚠️ **Deux règles, apprises sur `/topics`.** (1) Le squelette doit être dans **les vrais cadres, aux vraies largeurs** — sinon la mise en page saute au moment du rendu, ce qui est exactement ce qu'il devait empêcher. Là-bas ça voulait dire garder le split à deux colonnes pendant l'attente au lieu de basculer sur un bloc pleine largeur. (2) Il ne **devine pas** un compte : cinq cartes fixes, parce que le nombre est inconnu pendant le scan et qu'un squelette qui annonce huit puis en rend trois a menti. Un état d'impasse (rien trouvé, filtre qui exclut tout) n'a rien à pré-dessiner et reste un état plein, pas un squelette.

**Le loader (source unique)** : [`archie-loader.js`](../../src/archie-loader.js) + `styles/components/archie-loader.css`. Toutes les classes spinner (`.archie-loader`, `.ap-loader` + tailles, les `*-spinner` listés dans `archie-loader.js`) rendent **le même mark** : `initArchieLoader()` sweep le DOM + `MutationObserver` injecte `LOADER_SVG` (7 carrés arrondis en scale, stagger 0→0.686s) avec un `__MASKID__` unique. CSS possède la box (`--archie-loader-size`, `aspect-ratio 227.15/170.03`, `color: --archie-loader-color` défaut `--ref-color-orange-100`, `currentColor` blanc sur CTAs pleins). Inline SVG obligatoire (SMIL gèle en background/mask).

**Le loader de génération d'image** : [`archie-pixels.js`](../../src/archie-pixels.js) + `styles/components/archie-pixels.css` — un custom element `<archie-pixels>` qui remplit son hôte positionné ; du DOM + un canvas 2D (le champ en CSS, la trame de points sur le canvas, l'aberration chromatique en filtre SVG). Deux modes, le même élément :

- **Attente** (sans attribut) : un champ flouté de trois nuages **aux couleurs d'Archie, saturées** — `orange-100`, `yellow-100` (le `--app-butter` est trop pâle), `orange-150` — sur un fond `yellow-40`, tenus par le CSS (`--archie-pixels-cloud-1…3`, `--archie-pixels-base`) ; pas de vignettage. Dessus, une **trame de pixels carrés blancs, tous de la même taille** : seule leur **opacité** varie, chacun à son rythme lent (hachage entier murmur3 — un « multiplier puis modulo » mettait les voisins en phase), avec de temps en temps une montée douce ; les nuages dérivent. Rien ne se déplace, rien ne crépite, aucune réaction au pointeur.
  - **Narration** : la pastille de statut de la conversation (`ap-status is-working`, sans le point) **sur grey-150 en mots butter**, traversée d'un reflet orange (`e-sheen`, comme `.e-turn .ap-status.is-working` dans `chat.css`) : « Reading the post… », « Picking your colors… », « Composing the image… ». `data-since` (epoch ms) garde la bonne étape quand l'hôte re-rend. Pas de narration sous 220px de large.
  - `data-quiet` : le champ seul, jamais de narration — un décor (la scène de `/welcome-alt/intro`). `--archie-pixels-ink` (blanc par défaut) teinte la trame sur un fond pâle — le halo du chat neuf (flag `newChatHero` : nuages `orange-10` / `yellow-10` / `orange-20` sur `--app-bg`, trame `orange-40`).
  - `data-ripple` (opt-in, ce halo seul) : un clic n'importe où au-dessus de l'élément envoie **une vague** lente et diffuse (300px/s), au contour organique, dont la crête glisse vers `--archie-pixels-glow` ; quatre au plus, lue sur `window` ; `data-rippling` pendant qu'elle court.
  - L'opacité inline de l'élément n'est écrite que pendant l'arrivée : pendant l'attente, celle du CSS de l'hôte tient. Sert la fente média d'un draft (première image ET Try another), la scène et les tuiles de l'Image Studio.
- **Arrivée** (`data-reveal-at`, epoch ms) : posé **sur** l'`<img>` déjà rendue, il joue l'arrivée sur sa propre copie, comme une optique qui fait le point (flou, rouge et bleu qui convergent, vignettage qui se lève) pendant que **les pixels prennent les couleurs de l'image** puis se dissolvent du centre vers les bords ; « Refining the details… ». Puis fondu sur l'image réelle. **`REVEAL_MS` = 1,6 s** (1,4 s passait inaperçu, 2 s et 2,6 s traînaient), puis l'élément se cache ; l'hôte ne le rend que tant que `Date.now() - at < REVEAL_MS`.

⚠️ Tout est fonction de l'horloge, jamais de la durée de vie de l'élément : les hôtes re-rendent en `innerHTML`, une copie neuve reprend là où l'ancienne était. ⚠️ **Retenu (« 1e », 2026-10-08) au bout d'une longue exploration — ne pas reproposer ce qui a été écarté** : les transitions « créatives » (dither, cristallisation, vagues, Polaroid, croquis → peinture, tuiles, diaphragme, carte qui se retourne…), la palette du Playbook (`data-colors`, gris terne), le navy (virait au kaki), une onde lumineuse dans la trame, toute réaction au curseur (trame qui gonfle, vagues sous le curseur, lumière qui suit), un shader WebGL (le DOM + canvas suffit).

⚠️ **Toujours dimensionner par `--archie-loader-size`, jamais par `width` + `height`.** La variable est la **largeur** de la boîte ; la hauteur vient de l'`aspect-ratio` du viewBox. Fixer les deux neutralise l'`aspect-ratio` et écrase le glyphe en carré (c'était le cas du loader de prompt de l'Image Studio, à `28px × 28px`).

⚠️ **Une barre d'outils flottante n'est pas une pill.** Les mini-toolbars de l'Image Studio (texte sélectionné, boîte de crop) étaient en `--app-radius-pill` : à 999px l'arc du coin passe **en travers** des contrôles des deux bouts — la pastille de couleur à gauche, l'`.ap-icon-button` à droite — et les rogne. Elles sont en `--app-radius-lg` (8px), qui vaut aussi `--comp-icon-button-border-radius` : le coin du conteneur est alors **concentrique** avec les boutons qu'il tient (4px de padding autour d'un coin de 4px = 8px). La pill reste juste pour ce qui n'a **pas** de contrôle sur ses bords : segmented view toggle, badge, pastille de position.

⚠️ **Un loader qui remplace un champ prend la largeur du champ** (`flex: 1`) — centrer dans une boîte shrink-to-fit revient exactement à aligner à gauche.

---

## Voir aussi

- [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — workflow DS obligatoire (skill `/design-guidelines`) + `check:ds` + anti-patterns
- [`FEATURES.md`](FEATURES.md) — où ces patterns sont utilisés (par feature)
- [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md) — formules de tailles sidebar / panel / status-card
- [`../../CLAUDE.md`](../../CLAUDE.md) — résumé pour agents
