# Mission : redesigner l'UI d'Archie (rebel-racoon)

Ceci est un redesign, pas une passe de polish. Chaque surface clé est repensée : layout, composition, hiérarchie, densité, choix de composants, interactions dans l'écran, copy. Les détails (un espacement, un libellé, un alignement) viennent en dernier, une fois les structures posées.

## Niveau d'ambition

- Pour chaque surface, pars de la question : « si on concevait cet écran aujourd'hui, en partant du job de l'utilisateur, à quoi ressemblerait-il ? ». Pars du job, pas du markup existant.
- Barre de qualité : les meilleurs produits SaaS et AI-native (Linear, Notion, Arc, Raycast, Granola, Claude, ChatGPT). Chaque redesign cite ce qu'il emprunte et pourquoi.
- Anti-timidité : chaque surface redesignée change au moins un élément structurel (layout, regroupement, hiérarchie, composant, modèle d'interaction). Si la structure actuelle est déjà la bonne, tu le démontres par la critique des trois directions explorées. Un redesign qui ne touche qu'espacements, couleurs et libellés est refusé.
- Interdit avant la phase `polish` : ajuster un espacement isolé, renommer un libellé isolé, refactorer du code sans effet visible.

## Ce qui est libre, ce qui est fixe

**Libre** : layout et composition, hiérarchie de l'information, choix des composants DS, ordre et regroupement des sections, placement des actions, divulgation progressive, états vide / chargement / erreur / premier usage, déroulé d'une tâche dans la surface, copy, visuels et motion dans les limites du DS.

**Fixe** :

- Le DS Agorapulse V2 : tokens, composants, house rules. C'est le matériau, il ne dicte pas la composition.
- Les fonctionnalités et les données : rien ne disparaît sans être listé dans « To decide ».
- Les concepts produit et le vocabulaire (`docs/reference/CONCEPTS.md`, `GLOSSARY.md`).
- Les variantes explicitement rejetées dans `docs/reference/DECISIONS.md`. Ce fichier tranche le produit ; il ne fige pas la mise en page.
- La navigation globale de l'app (structure de la sidebar) : proposition avec maquette seulement, dans « To decide ».

## Contexte du repo

- Vanilla JS, ES modules sans build, hash router (`src/router.js`, routes dans `src/app.js`). DS chargé depuis jsDelivr.
- Serveur : `python3 scripts/dev-server.py 8123`.
- Lis : `CLAUDE.md`, `docs/reference/CONCEPTS.md`, `DECISIONS.md`, `DESIGN-SYSTEM.md`, `UI-PATTERNS.md`, `PANEL-SIDEBAR-RULES.md`, `docs/copy/copy-principles.md`, `GLOSSARY.md`, `FEATURES.md`.
- N'ouvre pas `docs/audits/2026-10-28-ux-review.md` ni le dossier `.ui-review/` d'un run précédent. Ton diagnostic part de l'app telle qu'elle est.
- UI en anglais, Archie parle à la première personne, pas de tiret cadratin dans la copy UI. Contenu mock inchangé.

## Skills

- `design-guidelines` (mode `html-prototype`) : le matériau. Lis `references/house-rules.md`.
- `impeccable` : critique, arrange, typeset, bolder, distill, delight. C'est le moteur du redesign.
- `design:design-critique` : critique de chaque direction et de chaque rendu, sur screenshots.
- `frontend-design` : pour l'ambition de composition. Ses choix de polices et de palettes cèdent au DS.
- `ux-heuristics` : garde-fou d'utilisabilité, pas le moteur.
- `ux-copy` puis `stop-slop` : copy de chaque surface redesignée.
- `design:accessibility-review` : en phase `polish`.

## Périmètre et ordre

Config par défaut (user mode `returning`, flags par défaut) + premier lancement (`new-alt`). Surfaces derrière un flag OFF hors périmètre. Ordre de départ, par impact :

1. Chat : nouveau chat (hero, starters) et chat avec contenu (`#/session/s-acme-launch`)
2. Panel Drafts, édition de draft, feedback, changes, schedule modal
3. Premier lancement (`#/welcome-alt` jusqu'à `/recap` et `/voice`)
4. Playbooks (`#/contexts`) et fiche Playbook (`#/playbook/ctx-acme`, chaque onglet)
5. Topic Feed et réglages (`#/topics`, `#/topics/settings?pb=ctx-acme`)
6. Image Studio (`#/playbook/ctx-acme/styles/new`)
7. Panels Sources et Ideas
8. Overlays (`?openModal=` : clés `OVERLAYS` de `src/figma-capture.js`)

Tu peux réordonner après le diagnostic, en justifiant.

## Capture

Script Playwright `scripts/ui-capture.mjs` + `scripts/ui-capture.config.json` + `scripts/ui-diff.mjs` (pixelmatch). S'ils existent déjà, vérifie qu'ils marchent et complète la config. Avant chaque shot : storage vidé, `archie-user-mode` et `archie-feature-flags` posés, fonts chargées, animations coupées, DPR 1. Viewports 1440×900 et 1280×800, 1024×768 pour le shell. Vérifie le déterminisme par une double capture. Sorties dans `.ui-redesign/` (gitignoré).

## Process par surface

1. **Diagnostic.** Parcours la surface comme l'utilisateur, captures à l'appui. Écris : le job, ce que l'écran doit rendre évident en 3 secondes, les 5 problèmes structurels principaux (pas cosmétiques), ce que font les meilleurs produits sur ce même job.
2. **Exploration.** Trois directions réellement différentes dans leur structure (ex. deux volets / flux unique / colonne focalisée), pas trois variantes du même layout. Maquettes HTML statiques dans `.ui-redesign/explore/<surface>/`, avec le CSS du DS (même source jsDelivr) et le vrai contenu mock. Capture chacune.
3. **Choix.** Critique les trois sur la grille, choisis une direction ou un hybride. Écris `design-plans/redesign-<surface>.md` : diagnostic, directions avec captures, décision, ce qui change structurellement, composants DS utilisés, périmètre.
4. **Build.** Implémente dans l'app. Tu peux restructurer templates, CSS et code de rendu de la surface. Pas de changement de stores ni de mocks, sauf helpers d'affichage.
5. **Critique et affinage.** Recapture, critique sur les screenshots (pas sur le code), jusqu'à deux tours d'affinage.
6. **Commit** de la surface.

## Grille (/10 par surface)

Clarté du but en 3 secondes · Hiérarchie · Composition et layout · Densité et rythme · Typographie · Cohérence et finition · Utilisabilité · Caractère (AI-native, mémorable, pas générique).

Une surface passe à la suivante à 8,5 minimum. Cible globale : 9.

## Phases globales

1. `diagnose` : diagnostic de toutes les surfaces, notes de départ, ordre final.
2. `redesign` : surface par surface, process ci-dessus.
3. `coherence` : harmonise les patterns partagés entre surfaces (en-têtes de page, cards, panels, modals, empty states, actions IA). Une surface redesignée ne doit pas avoir l'air d'une autre app que sa voisine.
4. `polish` : seulement ici, les détails (espacements, alignements, états limites, accessibilité, copy fine).
5. `report` : doc avant/après.

## Git

Branche `redesign/ui` créée depuis `main`. Un commit par surface (et par passe de cohérence ou de polish). Pousse la branche, ne merge pas dans `main`. Pour le reste, conventions de `CLAUDE.md` : `npm run bump`, puis `check:ds`, `check:versions`, `check:templates`, `check:dead` avant chaque commit.

## Doc avant/après

`docs/audits/<date du jour>-ui-redesign/` :

- `before/`, `after/` : captures plein écran des surfaces, mêmes noms des deux côtés ; `explore/` : vignettes des directions explorées.
- `README.md` (anglais) : résumé et tableau des scores avant/après ; puis une section par surface avec la paire avant/après en tableau `Before | After`, les trois directions explorées en vignettes, le diagnostic, la direction retenue et pourquoi, ce qui a changé structurellement, les commits. Ensuite : patterns harmonisés en phase cohérence, changements de copy (`Before | After | Why`), « To decide » (navigation globale, fonctionnalités à retirer, arbitrages produit, chacun avec maquette et recommandation).
- `compare.html` : page autonome, curseur avant/après par surface, filtre par surface, chemins relatifs.

Passe le `README.md` par stop-slop avant le commit final.
