# Redesign — Playbooks (catalogue `#/contexts` et fiche `#/playbook/:id`)

Diagnostic : [`diagnose.md`](diagnose.md) §5. Note de départ **6,0**.

**Objet porteur.** Le Playbook (CONCEPTS §1) : « le `CLAUDE.md` d'une marque, le document qu'on donnerait à un rédacteur freelance avant sa première mission ». La fiche doit se lire comme ce document, pas comme un tableau de bord de cartes. Aucun champ ajouté ni retiré : seule la mise en page change.

## Les trois directions (`.ui-redesign/explore/playbook/`, onglet Brief)

|               | A — document                                                                                                                             | B — sommaire                                                                                               | C — fiche technique                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Structure     | Une colonne de 760 px, chaque section = titre + contenu, filet entre elles, pas de boîtes ; la phrase « à quoi ça sert » derrière un (i) | Tout le Playbook sur un seul défilement, les six familles en sommaire collant à gauche au lieu des onglets | Un tableau, une ligne par champ : libellé et rôle à gauche, valeur à droite, crayon au survol |
| Emprunte à    | Notion, instructions de projet Claude                                                                                                    | Paramètres Stripe, docs Linear                                                                             | Fiche client Stripe, propriétés Linear, Attio                                                 |
| Clarté 3 s    | 8,5                                                                                                                                      | 8                                                                                                          | 8                                                                                             |
| Hiérarchie    | 8,5                                                                                                                                      | 7,5                                                                                                        | 8                                                                                             |
| Composition   | 8,5                                                                                                                                      | 7,5                                                                                                        | 8                                                                                             |
| Densité       | 8                                                                                                                                        | 7                                                                                                          | 8,5                                                                                           |
| Typo          | 8,5                                                                                                                                      | 7,5                                                                                                        | 7,5                                                                                           |
| Cohérence     | 8,5                                                                                                                                      | 7                                                                                                          | 7,5                                                                                           |
| Utilisabilité | 8                                                                                                                                        | 8                                                                                                          | 8                                                                                             |
| Caractère     | 7,5                                                                                                                                      | 7                                                                                                          | 7                                                                                             |
| **Moyenne**   | **8,3**                                                                                                                                  | **7,4**                                                                                                    | **7,8**                                                                                       |

**Critique (sur captures).**

- **B** montre tout d'un coup, mais garde les boîtes (le problème) et remplace des onglets qui marchent par une deuxième navigation dans une page qui a déjà la rail ; les onglets portent aussi des compteurs et des états (Competitors 1) que l'URL `?tab=` adresse (ROUTES).
- **C** est très lisible pour le Brief, mais un tableau à deux colonnes ne sait pas porter la voix (cinq parties, règles avec exemples) ni le Branding (logos, palette) : il faudrait deux langages dans la même fiche.
- **A** enlève la boîte autour de chaque section et la phrase d'aide répétée devant chaque contenu : le contenu de la marque devient la masse de la page. C'est aussi le langage que l'onboarding vient de prendre (la revue = une feuille, des filets entre blocs) : la fiche et sa création se ressemblent enfin.

## Décision : A

Ce qui change structurellement :

1. **La fiche est une colonne de lecture** : `.pb2-grid` passe d'une grille de cartes à deux colonnes (hauteurs inégales) à une seule colonne de 760 px max ; chaque `.pb2-block` perd sa bordure, son fond et son rayon, et un filet grey-20 sépare les sections. Le contenu de la marque (le résumé, la voix en trois mots, les couleurs) devient la masse de la page.
2. **La phrase d'aide de chaque section passe derrière un (i)** à côté de son titre, en lecture (`data-tooltip`). En édition, elle reste écrite sous le titre : c'est là qu'elle sert.
3. **Catalogue : le titre n'est dit qu'une fois** (la topbar « Playbooks » et un H1 « Playbooks » juste dessous) ; les quatre lignes de méta à icônes d'une carte (chats, audiences, concurrents, influenceurs) tiennent en une ligne de texte. → à faire au tour d'affinage, la fiche d'abord.

Inchangé : les onglets et leurs compteurs, l'en-tête (logo, nom, méta), Edit par onglet, Start a chat, Re-analyze website, le contenu de chaque section.

**Composants DS.** Tooltip DS (`data-tooltip`, déjà utilisé dans l'app), `ap-icon-information-circle`, filets grey-20.

**Périmètre du build.** `src/playbook-view.js` (`pb2Block` : hint en tooltip hors édition), `styles/screens/playbook-v2.css` (grille et blocs). La revue de l'onboarding réutilise ces blocs dans sa feuille : vérifier qu'elle ne change pas (elle a ses propres règles sous `.welcome-flow__sheet`).
