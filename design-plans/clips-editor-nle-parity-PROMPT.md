# Prompt — Éditeur de clips : audit + mise au standard NLE desktop, dans le navigateur

> À coller tel quel dans une session neuve sur `rebel-racoon` (flag `clipsSpace` ON).
> Rédigé le 2026-11-23 sur `70208ae73`.

---

## Rôle et objectif

Tu es un·e product designer-engineer senior qui a monté pendant des années sur DaVinci Resolve, Premiere Pro et Final Cut, et qui a livré des éditeurs web (CapCut web, Descript, Canva Video, VEED, Clipchamp). Ta mission : **auditer puis refondre l'éditeur de clips** (`/clips/:id/edit/:clipId`) pour qu'un monteur desktop s'y sente chez lui dès la première seconde : mêmes zones, mêmes outils, mêmes raccourcis, même précision. Tout tourne dans le navigateur et reste fidèle au Design System Agorapulse.

Barre de qualité : chaque écran doit pouvoir passer pour la capture d'un produit livré. Pas de « prototype ». Précision à l'image près, retours visuels immédiats, zéro ambiguïté sur ce qui est cliquable.

## Périmètre (tracé, ne pas déborder)

- `src/screens/clips/editor.js` (l'éditeur, ~2000 l.), `src/screens/clips/shared.js`
- `src/clip-framing.js` (moteur de cadrage, sans DOM — `npm run check:framing`)
- `src/caption-editor.js` (sous-titres + transcript, branché sur l'horloge de l'éditeur)
- `src/videos-store.js` (le clip et ses données)
- `styles/screens/clips.css` (section éditeur), `styles/ds-patches.css` si et seulement si un primitive DS manque
- Hors périmètre : la bibliothèque (`library.js`), la page projet (`project.js`) sauf le dialog Trim (le trim passe dans l'éditeur), la modale Video Clips legacy (flag OFF).

## Étape 0 — Lire AVANT de proposer quoi que ce soit (obligatoire)

1. `CLAUDE.md` en entier, puis `docs/reference/CONCEPTS.md`, `FEATURES.md` **§20** (l'éditeur, le tableau des outils), `DECISIONS.md` **« The Clips space »**, `DESIGN-SYSTEM.md`, `UI-PATTERNS.md`, `copy/copy-principles.md`, `GLOSSARY.md`.
2. Les plans déjà appliqués dans `design-plans/clips-*.md` (playhead bleue, labels en ellipse, boutons hug-width, dark mode retiré) : ne pas les défaire.
3. La prod, pour ancrer les comportements : `~/code/platform/content/studio` (clip-editor-modal, crop-editor playground, video-editor playground). On n'invente ni limite, ni état, ni erreur que la prod ne connaît pas. Quand on s'en écarte pour suivre un NLE, on le dit.
4. Lancer le skill **`/design-guidelines`** (mode `html-prototype`) avant la première ligne de CSS. **`/ui-ux-pro-max`** ne sert que de checklist de relecture : les tokens, composants et conventions restent ceux d'ADS.

## Étape 1 — Les décisions passées sont levées (accord de l'utilisateur, 2026-11-23)

L'utilisateur a écrit : « tu peux faire fi de mes précédentes décisions si il faut ». **La parité NLE prime sur les arbitrages documentés de l'éditeur.** Chaque fois que tu en renverses un, cite-le, dis pourquoi le standard NLE l'emporte, et réécris `DECISIONS.md` (section Clips space) et `FEATURES.md` §20 **dans le commit du lot**. Les ⚠️ « don't bring it back » ne t'arrêtent pas ici, mais ne renverse rien sans raison NLE.

Renversées par défaut (sauf si l'audit montre mieux) :

1. **Trim dans l'éditeur** (« The editor never retrims », 2026-10-29) → poignées de bord sur la piste vidéo, I / O, ripple, roll, dans la fenêtre ±2 min de la prod (`modal.videoTrim`). Le dialog Trim de la page projet peut rester comme raccourci.
2. **La timeline multi-pistes toujours visible** (retirée hors de Reframe, « la prod n'en a pas ») → vidéo (vignettes + parties de cadrage), texte, sous-titres, audio (forme d'onde + marques du cleanup), marque (intro / outro / logo).
3. **Rail d'outils + panneau à gauche** → panneau média / outils à gauche, **inspecteur des propriétés de la sélection** à droite, comme Resolve, Premiere, CapCut et Canva. Le popover Text disparaît dans l'inspecteur.
4. **Les retraits « alignés sur la prod »** (−5 s / +5 s, slider de zoom du cadrage, Follow the speaker, Use this framing on all shots, autosave…) : réévalue chacun à l'aune d'un NLE, rétablis ce qu'un monteur attend.

À trancher par l'audit, avec un avant / après côte à côte dans l'Artifact :

- **Clair ou sombre.** Le dark mode a été retiré le 2026-10-26 ; les NLE sont sombres. Montre les deux sur le même écran, recommande, et ne bascule qu'avec l'accord explicite de l'utilisateur sur cette capture. En sombre, toujours les tokens DS (pas de couleur inventée).

Restent fixes (règles maison et repo, pas des décisions d'écran) : composants et tokens ADS, encre / filets / bleu interactif / pas de majuscules / pas de barre d'accent / boutons hug, Archie discret et fermé par défaut, pas de conversation dans l'éditeur, une sauvegarde explicite reste possible (⌘S).

## Étape 2 — Audit (rendu, pas seulement le code)

Ouvre l'éditeur dans la preview (`preview_start` `archie`, flag `clipsSpace` ON, un clip seedé) à **1440×900 et 1920×1080**. Pour chacun des outils (Format, Subtitles, Transcript, Reframe, Teaser, Brand, les calques Text), capture puis évalue l'écran.

Produis **une matrice de parité** : une ligne par capacité, colonnes _Resolve/Premiere_ · _CapCut web/Descript/Canva_ · _Notre éditeur_ · _Écart_ · _Priorité (P0/P1/P2)_ · _Ancré prod ? (oui / écart assumé)_. Couvre au minimum :

| Domaine            | Capacités attendues                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**         | Viewer central, timeline pleine largeur en bas, panneaux redimensionnables (séparateurs glissables, tailles mémorisées par viewer), plein écran du viewer                                                                                                                                                                                                                                             |
| **Timeline**       | Règle avec timecode, zoom (slider + ⌘+ / ⌘− / ⇧Z ajuster), scroll horizontal, en-têtes de piste (nom, masquer, verrouiller, muet), vignettes sur la piste vidéo, forme d'onde audio, sélection simple et multiple, magnétisme (N pour activer / couper, déjà en partie là), marqueurs (M), split à la tête (S / ⌘K / B), suppression, menu contextuel au clic droit, copier / coller / dupliquer (⌘D) |
| **Transport**      | Espace, J/K/L (shuttle, ×2 ×4), ←/→ image, ⇧←/→ 1 s, Home/End, boucle sur la sélection, timecode éditable `MM:SS:FF`, volume / muet, vitesse de lecture                                                                                                                                                                                                                                               |
| **Viewer**         | Zoom (Ajuster / 100 %), zones sûres (déjà là : TikTok / Reels / Shorts), title-safe, boîte englobante + poignées de transformation sur le texte et les sous-titres, magnétisme aux axes et aux bords                                                                                                                                                                                                  |
| **Inspecteur**     | Les propriétés de **l'objet sélectionné** (calque texte, partie de cadrage, style de sous-titres, carte de marque) : position, taille, style, animation d'entrée / sortie, durée. Pas de popover flottant pour éditer un objet                                                                                                                                                                        |
| **Édition**        | Historique undo / redo profond (y compris le style de sous-titres, exclu aujourd'hui « ponytail » dans `editor.js`), nudge au clavier, états vides utiles                                                                                                                                                                                                                                             |
| **Feedback**       | Hover / sélection / focus distincts et cohérents sur chaque élément de timeline, curseurs adaptés (`ew-resize`, `grab`, `col-resize`), étiquette de temps pendant un glissé (déjà là, à généraliser), toasts sobres                                                                                                                                                                                   |
| **Découvrabilité** | Panneau des raccourcis (`?`), tooltips avec le raccourci (« Split · S »), aucune action cachée derrière une icône sans libellé                                                                                                                                                                                                                                                                        |

Note aussi chaque violation des règles maison (voir § Garde-fous) et chaque incohérence entre outils voisins (rayon, filet, inset, retrait).

Livrable : la matrice + les captures, publiées en **Artifact** (avant). Puis arrête-toi et fais valider la liste P0/P1 avant d'implémenter.

## Étape 3 — Implémenter par lots

Un lot = une demande = **un commit poussé sur `main`** (fetch avant, merge et jamais rebase si en retard ; conflits `?v=` : re-merger `?v` neutralisé puis `cache-version.mjs set <max+1>`). Ordre proposé :

1. **Le squelette NLE** : grille viewer / inspecteur / timeline, séparateurs redimensionnables, timeline toujours visible.
2. **La timeline** : pistes, en-têtes, zoom et scroll, vignettes, forme d'onde, sélection, menu contextuel, marqueurs.
3. **Le transport et le clavier** : J/K/L, timecode éditable, boucle, panneau des raccourcis. Un seul gestionnaire `keydown`, celui qui existe déjà (`handleKey`), avec une table de raccourcis unique qui alimente aussi les tooltips et le panneau `?`.
4. **L'inspecteur contextuel** : remplace le popover Text et les panneaux d'outil par les propriétés de la sélection.
5. **Trim sur la timeline**.
6. **Polish** : états hover / sélection / focus, curseurs, micro-transitions (≤ 150 ms, `prefers-reduced-motion` respecté), passage `/ui-ux-pro-max` en checklist, puis `/impeccable` via design-guidelines.

Réutilise ce qui existe avant d'écrire : `clip-framing.js` (parties, coupes caméra), le magnétisme des calques texte (`d7a946ca6`), `edit()` / `pushUndo()` pour l'historique, `paintTimeline()` comme point d'entrée de la timeline. Respecte l'architecture : vanilla JS, délégation d'événements `data-*`, `html` tagged template, pas de dépendance.

## Garde-fous (chaque lot, sans exception)

- **DS ADS uniquement** : `.ap-button`, `.ap-icon-button`, `.ap-select`, `.ap-action-dropdown`, `.ap-tabs`, slider, toggle, tooltip, infobox, modale (vérifier chaque classe dans `css-ui/index.css`). Jamais de `<select>` natif, jamais de dropdown imbriqué (sections + divider). Tokens `--sys-*` avant `--ref-*` ; paliers de gris 05 · 10 · 20 · 40 · 60 · 80 · 100 · 150 uniquement. Vérifier que chaque icône existe (`ap-icon-eye` n'existe pas, `ap-icon-eye-on` oui).
- **Encre** grey-80 à grey-100. **Filets** grey-20. **Bleu = interactif seulement** (tête de lecture, sélection, liens, contrôles), jamais pour teinter une donnée. Pas d'élévation imbriquée, **pas de labels en majuscules** (y compris les noms de pistes « V1 / A1 » : écrire « Video », « Text »…), **jamais de barre d'accent latérale**, boutons en largeur auto, hover de carte = bordure bleue.
- Une piste ou un objet n'a pas de couleur par caméra ni par type « pour faire joli » : on distingue par la structure, le libellé et l'icône.
- Copy : anglais, Archie dit « I », passer par `/stop-slop`, pas de tiret cadratin. Les resets disent « Reset … ».
- Chaque changement JS/CSS → `npm run bump` (jamais un `?v=` à la main), puis `npm run check:ds`, `check:versions`, `check:framing`, `check:dead`.
- Vérifier dans le navigateur un **effet visible du JS** (un nœud qui change), pas seulement du CSS ; mesurer les composants frères après chaque restyle.
- Mettre à jour `FEATURES.md` §20 (et `DECISIONS.md` si un arbitrage change) dans le commit du lot. Ne pas toucher `CLAUDE.md`.

## Livrables finaux

1. L'Artifact **avant / après** (captures 1440 et 1920 par outil + la matrice de parité mise à jour, colonne « après »).
2. Les commits par lot sur `main`.
3. Un récapitulatif : ce qui atteint la parité NLE, ce qui reste volontairement différent (et pourquoi : prod, décision, light mode), ce qui reste à faire.
