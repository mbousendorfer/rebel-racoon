# Redesign — Premier lancement (les deux revues : `/welcome-alt/recap`, `/welcome-alt/voice`)

Diagnostic : [`diagnose.md`](diagnose.md) §4. Note de départ **7,0**. Périmètre : les deux écrans de revue (étapes 3 et 4), partagés par `welcome-alt-review.js`. L'intro, le site, la source de la voix et le reveal ont un caractère fort et ont été arbitrés un par un (FEATURES §10) : ils restent.

**Objet porteur.** Le Playbook en création (CONCEPTS §1), dont le brouillon est la source vivante (`context-builder`). La revue est l'endroit où l'utilisateur corrige ce que j'ai lu avant le premier draft.

## Les trois directions (`.ui-redesign/explore/onboarding/`)

|               | A — un document                                                                                                                           | B — une partie à la fois                                    | C — carte + éditeur                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Structure     | La liste de gauche devient le sommaire (état de chaque partie), à droite une feuille blanche qui défile avec toute la partie, un seul CTA | Une sous-partie entière au centre de la scène, Next dessous | La carte « Your Playbook » reste sur la scène, la ligne choisie s'édite à gauche |
| Emprunte à    | Notion (page + outline), doc de projet Linear                                                                                             | Typeform, onboarding Arc                                    | Figma (canevas + propriétés)                                                     |
| Clarté 3 s    | 8,5                                                                                                                                       | 8                                                           | 8                                                                                |
| Hiérarchie    | 8,5                                                                                                                                       | 8                                                           | 7,5                                                                              |
| Composition   | 8                                                                                                                                         | 8                                                           | 8                                                                                |
| Densité       | 8                                                                                                                                         | 7                                                           | 7,5                                                                              |
| Typo          | 8                                                                                                                                         | 8                                                           | 7,5                                                                              |
| Cohérence     | 8                                                                                                                                         | 7,5                                                         | 8,5                                                                              |
| Utilisabilité | 8,5                                                                                                                                       | 7                                                           | 7                                                                                |
| Caractère     | 7,5                                                                                                                                       | 8                                                           | 8                                                                                |
| **Moyenne**   | **8,1**                                                                                                                                   | **7,7**                                                     | **7,8**                                                                          |

**Critique (sur captures).**

- **B** est la plus calme, mais c'est **la pile retirée le 2026-10-20** (« one card at a time », `welcome-alt-review.js`, en tête de fichier) : la reproposer serait refaire un revert. Son « Skip for now » est aussi une étape que personne n'a demandée.
- **C** garde la continuité avec les écrans 1 et 2, mais édite une partie dans une colonne de 400 px : les blocs de la fiche (`playbook-view`, qui fait l'édition aujourd'hui) n'y tiennent pas, et les deux colonnes se disputent l'attention.
- **A** garde ce qui marche (la vraie fiche en édition, sur la scène, la liste des parties à gauche) et retire les deux systèmes de navigation : plus de focus qui assombrit les cartes au scroll, plus de capsule ↑ · points · ↓, plus de CTA flottant en bas de la scène. Une feuille blanche, lisible d'un bout à l'autre, et un seul bouton pour avancer.

## Décision : A

Ce qui change structurellement :

1. **Un seul CTA, toujours au même endroit** : le bouton principal de la colonne de gauche. Il confirme la partie en cours et dit où il mène (« Looks good, on to Branding », puis « Looks good, check my voice » sur la dernière partie, comme aujourd'hui). Le bouton flottant au pied de la scène disparaît : deux boutons primaires pour la même action, c'était le défaut n° 1 de l'écran.
2. **La partie se lit comme une feuille** : une surface blanche continue posée sur la scène, qui défile, sans assombrir les blocs hors de la ligne de lecture et sans capsule de navigation. Le clavier ↑ / ↓ hors champ, qui faisait glisser la carte suivante au centre, part avec la capsule → To decide.
3. **La liste de gauche dit l'état de chaque partie** (le `badge` existe déjà : ce qui reste à faire), elle sert de sommaire cliquable.

Inchangé : la scène de pixels, les parties et leur teinte, l'édition par la vraie fiche (`playbook-view`) qui enregistre en tapant, le dialog des voix vides à la fin, les onglets Part by part / In my own words de la voix, Back.

**Composants DS.** `.ap-button` primary blue (le CTA), la fiche existante.

**Périmètre du build.** `screens/welcome-alt-review.js` (CTA unique, retrait du focus et de la capsule), son CSS (`styles/screens/welcome.css`). Pas de store.
