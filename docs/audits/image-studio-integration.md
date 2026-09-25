# Brand Studio (module « Image Studio ») — Phase 0 : audit d'intégration

## Contexte

Le brief demande d'ajouter à Archie un module autonome de génération de visuels, conforme à la marque et avec une IA mockée. Toute la construction se fait derrière le feature flag « Sexy Squirrel ».

- `~/sources/archie` n'existe pas. Archie, c'est ce repo, rebel-racoon.
- Rapport de phase 0, rédigé le 2026-09-25, sans une ligne de code. La construction attend le GO sur ce rapport.

Décisions déjà prises :

- **Nom dans l'UI : « Brand Studio ».** Le dossier de code reste `src/modules/image-studio/`, avec le préfixe `imst-`. Le studio existant (modale ouverte depuis un brouillon) garde le nom « Image Studio » et ses préfixes `.isv2-*` / `.image-studio__*`.
- **Fichiers touchés hors du dossier, acceptés :**
  - la route dans `app.js` ;
  - la ligne de nav dans `sidebar.js` ;
  - le titre dans `topbar.js`, qui fait partie de la route (sinon le titre retombe sur « Archie ») ;
  - le flag dans `ff-catalog.js` ;
  - les `<link>` CSS dans `index.html` ;
  - le bump global `?v=` ;
  - un § dans `FEATURES.md` et une ligne dans `ROUTES.md`.
- **Primitives DS manquantes** : on réutilise les portages de `styles/ds-patches.css` (`.ap-slider`, `.ap-dropzone`, `.app-bar` / `.app-ring`, `.ap-filter-chip`, `.app-modal-backdrop`).

---

## 1. Hébergement

- **Flag.** Entrée `{ id: "sexySquirrel", label: "Sexy Squirrel — Brand Studio (/brand-studio)", default: false, hides: … }` dans `src/ff-catalog.js`. Le menu Admin la liste tout seul (`admin-menu.js:93`), et `isFlagOn` renvoie false pour un id absent du catalogue.
- **Routes.** Le module exporte `ROUTES = [{ pattern, handler }]` et `app.js` fait une boucle `route()` dessus. Ça fait deux lignes dans `app.js`, et le module garde ses sous-routes pour lui. Les patterns sont ancrés (`router.js:8-17`), et `:param` ne capture qu'un seul segment. Sous-routes :
  - `/brand-studio` : le hub, ou l'onboarding s'il n'y a aucune marque
  - `/brand-studio/brands`
  - `/brand-studio/brands/:id` (`?tab=`)
  - `/brand-studio/styles/new` et `/brand-studio/styles/:id`
  - `/brand-studio/editor/:creationId`
  - `/brand-studio/campaigns`
- **Garde.** Chaque handler commence par `if (!isFlagOn("sexySquirrel")) { navigate("/"); return; }`, comme `topics.js:134-140`. Ensuite `renderTopbar()`, puis le rendu dans `target`. Le handler renvoie un cleanup qui retire les listeners et vide le store de vue.
- **Nav.** Une entrée dans `NAV` (`sidebar.js:801-856`) : `{ path: "/brand-studio", icon: "ap-icon-image", label: "Brand Studio", flag: "sexySquirrel", match: p => p.startsWith("/brand-studio") }`. Le clic est déjà délégué par `[data-sidebar-nav]`.
- **Titre.** Une ligne dans `currentTitle()` (`topbar.js:626-653`).
- **Layout.** C'est une route de workspace ordinaire : rail, topbar et `#app`, sans `onboarding` ni `account-scope`. La page utilise la largeur `--app-content` comme les autres pages pleines (voir Q3 plus bas).
- **Dossier :**
  ```
  src/modules/image-studio/
    index.js                  ← ROUTES : seul point d'import du shell
    config/                   formats · networks · style-presets · calendar-events · copy-limits · demo-brands
    model/                    factories + validation + resolveBrand (héritage)
    services/                 index.js (registre des implémentations) · image-generation · brand-analysis · copy · storage
    services/mock/            implémentations mockées, remplaçables une par une
    render/                   générateurs SVG par famille · compositeur multi-format · export PNG
    state/                    store du module (Map + notifier, réécrit localement)
    lib/                      html`` · delegate · id · prng seedé
    ui/                       compositions DS réutilisées dans le module : dialog, confirm, toast, empty, swatch, stepper-list
    views/                    onboarding · brands · brand-detail/* · style-creator · hub · results · editor/* · campaigns
    styles/                   imst-*.css (liés depuis index.html, donc couverts par cache-version)
  ```

## 2. Contraintes techniques

- **Stack.** Vanilla ES modules sans build. Imports toujours entre guillemets doubles, avec le `?v=N` global. `scripts/cache-version.mjs` parcourt `src/**` récursivement et les `href` `./src/…css` de `index.html`, donc le CSS du module (sous `src/modules/image-studio/styles/`) est versionné. Après chaque étape, lancer `npm run bump` puis `check:versions`. Aucune dépendance ajoutée.
- **Isolation stricte à l'import.** Le module n'importe que `router.js` (`navigate`), `feature-flags.js` (`isFlagOn`) et `components/topbar.js` (`renderTopbar`). Pas de `utils.js`, `store-utils.js`, `toast.js`, `confirm-modal.js` ni `modal-coordinator.js` : ses équivalents sont réécrits sous `lib/` et `ui/`. En sens inverse, seul `app.js` importe le module.
- **Collisions et parades :**

  | Risque                                                                                           | Parade                                                                                                                                                                                               |
  | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | CSS : `.isv2-*`, `.image-studio__*`, `.ta-*`, `.gen-style-*`, les custom props `--pick`/`--add`… | classes `.imst-*`, custom props `--imst-*`                                                                                                                                                           |
  | Keyframes `isv2-*` et `image-studio-pop*`                                                        | keyframes `imst-*`                                                                                                                                                                                   |
  | Ids SVG `isa-*` / `ita-*`                                                                        | ids `imst-<uid>-*`, uniques par rendu, parce que 4 variations coexistent dans le DOM                                                                                                                 |
  | `data-img-*`                                                                                     | `data-imst-*`                                                                                                                                                                                        |
  | Ids DOM `isv2*`, `MODAL_ID "imageStudioV2"`                                                      | ids `imst*`                                                                                                                                                                                          |
  | Stockage                                                                                         | localStorage `imageStudio:v1:*` + base IndexedDB `imageStudio` (première base IDB de l'app, rien à heurter)                                                                                          |
  | Globaux                                                                                          | aucun (l'app n'en a pas non plus)                                                                                                                                                                    |
  | Listeners `keydown` du studio existant et du coordinator                                         | ils ne réagissent que si leur overlay est ouvert. Nos dialogs écoutent Escape en local et ne passent pas par `modal-coordinator`, donc ⌘K ou une modale Archie peuvent s'empiler au-dessus. Accepté. |

- **Canvas éditable et export PNG : faisable, et la technique a déjà fait ses preuves dans l'app.**
  - Le **fond** est un SVG généré de façon déterministe à partir de seed + style + palette + format. Les **calques** sont des éléments DOM positionnés en coordonnées normalisées 0–1, qu'on peut déplacer au pointer events.
  - L'export procède ainsi :
    1. `XMLSerializer` sur le SVG, puis `Blob` et `<img>` ;
    2. `drawImage` dans un canvas à la taille réelle du format ;
    3. dessin natif des calques (texte avec `ctx.fillText` après `document.fonts.load`, logos, formes) ;
    4. `canvas.toBlob` puis `a[download]`.

    `image-studio-canvas.js:50` fait déjà l'équivalent avec `toDataURL`. `toBlob` et le téléchargement sont nouveaux dans l'app, mais standard.

  - ⚠️ Un SVG rastérisé via `<img>` ne charge pas les webfonts. C'est pour ça que le texte est dessiné sur le canvas, et jamais à l'intérieur du SVG.
  - Les polices des marques de démo sont des familles système (Georgia, Helvetica, Futura, Courier…). Aucune police externe.

- **Écarts assumés avec le CLAUDE.md du repo** (le brief l'emporte, et c'est écrit dans FEATURES) :
  - « no localStorage persistence of app state » : ce module persiste tout, sous `imageStudio:`.
  - « Brand » double le Playbook (CONCEPTS §1) et introduit un héritage parent/enfant que §1 interdit pour les Playbooks. Ce sont deux objets séparés et volontairement sans lien.

## 3. Design System — couverture (mode `html-prototype`, CSS-UI local `ds/` + `ds-patches.css`)

| Besoin                                                                    | Composant                                                                                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Switcher de marque (toujours visible)                                     | `.ap-action-dropdown` + `-item` (substitut CSS-UI de nav-selector)                                                                |
| Chips de la barre de prompt (Marque, Style, Produit, Formats, Mode texte) | `.ap-select` avec `.ap-select-inline-label` (convention du repo). Multi-sélection pour les formats : `.ap-select-option-checkbox` |
| Familles de styles, filtres                                               | `.ap-filter-chip` (aria-pressed)                                                                                                  |
| Mots-clés d'ambiance, mots à éviter, valeurs                              | `.ap-tag` / `.ap-tag-list`                                                                                                        |
| Cartes marque, idées, variations, produits                                | `.ap-card`, hover en bordure bleue                                                                                                |
| Choix d'un preset ou d'un format (grille)                                 | `.ap-radio-card` (choix unique), `.ap-checkbox-container` dans une carte (multi-réseaux)                                          |
| Onglets du détail marque (7)                                              | `.ap-tabs` + `.ap-counter`                                                                                                        |
| Modales (créer, import, aperçu en contexte)                               | `.ap-dialog` + `.app-modal-backdrop`                                                                                              |
| Confirmation de suppression                                               | `.ap-dialog` en rôle alertdialog, footer à droite, `.ap-button.danger`                                                            |
| Sliders de poids et de taille                                             | `.ap-slider` (patch)                                                                                                              |
| Upload de logos, références, photos                                       | `.ap-dropzone` (patch)                                                                                                            |
| Toasts, erreurs transitoires                                              | `.ap-snackbar` dans une région `imst` dédiée                                                                                      |
| « Génération échouée, réessayer », texte IA non supporté                  | `.ap-infobox.error` / `.warning`                                                                                                  |
| Loaders                                                                   | `.ap-loader` (reskinné automatiquement en marque Archie : natif) + squelettes sur le pattern repo                                 |
| Liste des calques                                                         | `.ap-list-panel` + `-item.selected` + `.ap-icon-button` (œil, verrou)                                                             |
| Règles, do/don't                                                          | `.ap-accordion`                                                                                                                   |
| Campagnes, historique                                                     | `.ap-table` (+ `.clickable-rows`)                                                                                                 |
| Légende + limite de caractères                                            | `.ap-textarea-field` + `.ap-textarea-counter`                                                                                     |
| Toggles (safe zones, heatmap, déverrouiller police)                       | `.ap-toggle-container`                                                                                                            |
| Score de conformité / performance                                         | `.app-ring` (patch) **+ libellé texte** (règle « métrique nommée ») · `.ap-status` par problème                                   |
| Actions sur une variation                                                 | `.ap-icon-button` + `.ap-tooltip` · Télécharger / Ouvrir : `.ap-button`                                                           |
| CTA IA (Générer, Décliner partout, Appliquer la marque)                   | `.ap-button.primary.orange` · routinier (Créer une marque) : `.primary.blue`                                                      |

**Non couverts, résolus par composition :** aucun nouveau composant DS. Chaque cas ci-dessous est signalé ; ton GO global vaut GO pour chacun.

1. **Pastille couleur / color picker.** Un `button` carré avec une bordure grey-20, dont le fond est la couleur de la marque (c'est du contenu, pas du chrome), accompagné d'un `.ap-tooltip` qui affiche l'hex. L'édition passe par un `.ap-input-group` pour l'hex, plus un `input[type=color]` caché que la pastille déclenche.
2. **Loader d'analyse progressif.** Une liste verticale d'étapes. Chaque étape passe par trois états : `.ap-loader.size-16` quand elle est active, `ap-icon-check` quand elle est faite, puis elle révèle ce qui a été détecté (pastilles, logo, police). L'étape active se lit en graisse, jamais en gris plus clair. `.ap-stepper`, horizontal et prévu pour un wizard, ne convient pas.
3. **État vide.** Il n'existe pas de classe DS. On compose une icône `lg`, un titre au text-style subtitle, du body et un CTA `.primary.blue` de largeur auto, calqués sur `renderEmptyState` mais réécrits dans le module.
4. **Surfaces de contenu propres au module** (ce ne sont pas des composants de chrome) : le stage de l'éditeur avec ses poignées, le cadre de ratio, les overlays de safe zones et de heatmap, les maquettes de feed et de story par réseau. Leur chrome n'utilise que des tokens DS ; les couleurs de marque ne servent qu'au contenu.

## 4. Modèle de données

Les ids sont préfixés par entité (`br_`, `st_`…). Les dates sont en ISO. Les coordonnées sont normalisées de 0 à 1.

- **Brand** : `{ id, parentId?, name, isDefault, overriddenFields: string[], logos: [{variant: color|white|black|icon, assetId}], palette: [{hex, name, role: primary|secondary|accent|background|text}], fonts: [{family, role: heading|body}], imageStyle: {moods[], referenceAssetIds[], preferredStyleIds[]}, voice: {tone, examples[3..5], avoid[]}, positioning: {sector, audience, values[], valueProp}, rules: {dos[], donts[], logoMinPx, clearSpace, noLogoDistortion, forbiddenPairs: [[hex,hex]]}, createdAt, updatedAt }`
  - `resolveBrand(id)` fusionne le parent et les champs surchargés de l'enfant. Une sous-marque ne stocke que ses surcharges.
- **Style** : `{ id, brandId|null, kind: preset|custom, family, label, description, promptTemplate, supportsEmbeddedText, render: {generator, params} }`
  - Pour un style custom, s'ajoute `custom: {sources: [{type: image|preset, ref, weight}] (≤10 images, ≤5 presets), fidelity: essential|composition, stylePrompt}`. Son `render` est dérivé du mélange pondéré des sources.
- **Product** : `{ id, brandId, name, description, url?, imageAssetId, shotAssetIds[] }`
- **Campaign** : `{ id, brandId, title, objective, angle, eventId?, start, end, creationIds[] }`
- **Creation** : `{ id, brandId, campaignId?, brief: {prompt, styleId, productId?, formatIds[], textMode: layer|embedded, ideaId?}, variations: [{id, seed}], selectedVariationId, master: {formatId, layers[]}, adaptations: [{formatId, layers[]}], copy: {hooks[], ctas[], captions: {[network]: {text, hashtags[]}}}, favorite, history: [{at, action, detail}], checks?: {brand, performance} }`
  - **Layer** : `{ id, type: image|text|logo|shape|asset, x, y, w, h, rotation, z, hidden, locked, props }`
  - Les props `text` sont `{content, fontRole|family, colorRole|hex, size, align, band}`.
- **Asset** : `{ id, brandId, kind: logo|image|icon|reference|product|creation, name, mime, width, height, blobKey, source: upload|generated, favorite }`
- **Stockage** :
  - Une clé localStorage par collection : `imageStudio:v1:brands|styles|products|campaigns|creations|assets`, plus `imageStudio:v1:meta` (`{schemaVersion, seededAt, activeBrandId}`).
  - Les blobs (uploads, PNG exportés ou favoris) vont dans IndexedDB `imageStudio`, store `blobs`.
  - **Les variations générées ne sont pas stockées en image** : seed + style + palette + format suffisent à les re-rendre à l'identique. C'est léger et déterministe.
- **Services** (asynchrones, interfaces documentées en JSDoc) :
  - `imageGenerationService.generate({brief, brand, style, product, format, textMode}) → Variation[4]`, avec un délai de 2 à 4 s et un taux d'échec simulé ;
  - `brandAnalysisService.fromUrl(url, onStep)` et `.fromFiles(files, onStep) → BrandDraft` ;
  - `copyService.hooks | ctas | caption(network) | hashtags` ;
  - `storageService` (CRUD générique + blobs).

  Les implémentations vivent dans `services/mock/`. `services/index.js` est le seul endroit où on les remplacera par les vraies.

- **Démo** : deux marques complètes, par exemple une torréfaction artisanale et une fintech B2B. Chacune a ses styles, ses produits et 2 à 3 créations. Elles sont semées une fois (grâce à `meta.seededAt`) et n'ont aucun lien avec `src/mocks/`.
- **Portabilité** : export et import JSON d'une marque, avec ses styles, ses produits et ses assets encodés en base64.

## 5. Wireframes

```
HUB  /brand-studio                                    [Marque: Brûlerie Nord ▾]
┌───────────────────────────────────────────────────────────────────────────┐
│ Campaign ideas                                         [↻ More ideas]     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│ │ preview │ │ preview │ │ preview │ │ preview │  title · angle · ▢▯▭     │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                          │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ Describe the visual…                                                  │ │
│ │ [Style: Clay 3D ▾] [Product ▾] [Formats: 3 ▾] [Text: Layer ▾]  [Generate]│
│ └───────────────────────────────────────────────────────────────────────┘ │
│ RESULTS  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                               │
│          │ var1 │ │ var2 │ │ var3 │ │ var4 │  ↻ ≈ ✎ ⇲ ♡ ⤓                │
│          └──────┘ └──────┘ └──────┘ └──────┘                               │
└───────────────────────────────────────────────────────────────────────────┘

ONBOARDING (aucune marque)
┌──────────────── Let's set up your first brand ────────────────┐
│ ( From your website )  ( From files )  ( Start from scratch ) │ ← radio-cards
│ [ https://…                  ] [Analyze]                      │
│ ✓ Logo found  ▣ ▣                                             │
│ ✓ Colors      ● ● ● ●                                         │
│ ◌ Fonts…                                                      │
│ ○ Tone of voice                                               │
└───────────────────────────────────────────────────────────────┘
→ REVIEW : chaque bloc [✓ Keep] [Edit] → [Save brand]

MES MARQUES  /brand-studio/brands                         [Import] [New brand]
┌────────────┐ ┌────────────┐ ┌────────────┐
│ LOGO       │ │ LOGO       │ │  + sub-brand│
│ ●●●●●      │ │ ●●●●       │ │   of …      │
│ Name · Def.│ │ Name    ⋯  │ │             │   ⋯ = edit/duplicate/default/export/delete
└────────────┘ └────────────┘ └────────────┘

DÉTAIL MARQUE  /brand-studio/brands/:id
[Identity|Image style|Voice|Rules|Assets|Styles|Catalog]   (hérité ⇄ surchargé par champ)

CRÉATEUR DE STYLE
┌ Sources ────────────────┐┌ Preview (3 neutral subjects) ┐
│ refs ▣▣▣  weight ──●──  ││  ┌───┐ ┌───┐ ┌───┐          │
│ presets ▢▢  weight ─●── ││  └───┘ └───┘ └───┘          │
│ Fidelity (•)Essential   ││           [Test style]       │
│          ( )Composition ││                              │
│ Style prompt [        ] ││                 [Save style] │
└─────────────────────────┘└──────────────────────────────┘

ÉDITEUR  /brand-studio/editor/:id                [Apply brand] [Adapt everywhere]
┌ Layers ──┐┌──────── Stage ────────┐┌ Properties ──────┐
│ ▤ Logo 👁 ││                       ││ Font [Heading ▾] │
│ T Hook 👁 ││   (safe zone overlay) ││ Color ● ● ● 🔓   │
│ ▭ Band   ││                       ││ Size ──●──        │
│ ▣ Image  ││                       ││ Align ≡ ≡ ≡ Band ☐│
│ [+ Add ▾]│└───────────────────────┘│ Hooks ✨ 3 ideas  │
└──────────┘ [Edit in words: "logo white bottom right" ][↵]  Regenerate: [Bg][Subject]
Formats : [1:1 ✓][4:5][9:16][1.91:1][16:9]  ← déclinaisons côte à côte · [Preview in feed] [⤓ PNG]
P2 : panneau Brand check (score + problèmes [Fix]) · Performance (score + heatmap)

CAMPAGNES  /brand-studio/campaigns   table : Campagne · Période · Créations · Màj  + Historique
```

## 6. Questions ouvertes

1. **Tokens `--app-*`.** Le brief n'autorise que `--ref`/`--sys`/`--comp`. Or le DS n'a aucune ombre en ref ni en sys, et toutes les cartes de l'app utilisent `--app-radius-card` (12px). Deux options : rester DS pur (`--ref-border-radius-md` à 8px, aucune ombre hors `--comp-*-shadow`, avec un rendu légèrement moins « natif »), ou autoriser `--app-*` pour les rayons, les ombres de popover et `--app-content`. Recommandation : autoriser `--app-*`, que je signalerai dans l'audit final.
2. **Scope Playbook.** Avec `playbookWorkspace` ON, le rail affiche le Playbook actif au-dessus d'un module qui l'ignore. Faut-il passer `/brand-studio` en `account-scope` ? Ce serait une modification hors dossier (`isAccountScope`), et le rail disparaîtrait avec l'entrée de nav. Recommandation : laisser le module dans le workspace et documenter l'écart.
3. **Langue.** L'UI d'Archie est en anglais, donc tout le copy du module sera en anglais, à la première personne quand c'est Archie qui parle.
4. **CONCEPTS.md.** Faut-il y ajouter une note : « Brand (Brand Studio) ≠ Playbook, pas de lien, par décision » ? Sinon, un futur lecteur verra un doublon du Playbook.
5. **Commits.** Un commit + push sur `main` à la fin de chaque étape (règle mémoire). Le flag est OFF par défaut, donc le déploiement Pages ne change rien pour les visiteurs.

## 7. Suite après GO (rappel du brief)

Les étapes 1 à 7 suivent l'ordre du brief. À la fin de chaque étape : `npm run bump`, `check:versions`, vérification dans le navigateur (flag ON et OFF), commit + push, résumé et liste des écarts DS, puis stop.

À la fin de l'étape 7 :

- un audit DS complet du module (grep des valeurs en dur, des tokens et icônes inexistants — ils échouent en silence —, des classes `.ap-*` redéclarées) ;
- `git diff --stat <base>..HEAD -- . ':!src/modules/image-studio'` filtré des lignes `?v=` : il ne doit rester que `app.js`, `sidebar.js`, `topbar.js`, `ff-catalog.js`, `index.html`, `FEATURES.md`, `ROUTES.md` et l'audit.
