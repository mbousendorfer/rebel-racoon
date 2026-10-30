# Redesign — Chat (`#/session/:id`, nouveau chat, premier chat)

Diagnostic complet : [`diagnose.md`](diagnose.md) §1. Note de départ **6,0**.

**Objet porteur.** La session (CONCEPTS §2-3) : ce que le chat a reçu et produit lui appartient, il doit donc le montrer lui-même dans le fil. Le panel Content reste la vue détaillée (FEATURES §13), il ne remplace pas le fil.

## Les trois directions (`.ui-redesign/explore/chat/`)

|               | A — deux volets                                                  | B — un seul fil, résultats inline                        | C — bandeau de pipeline                                                             |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Structure     | Conversation 440 px + document permanent « What this chat made » | Colonne 760 px, les drafts en cartes 2×2 dans la réponse | 4 cartes d'étape + « Next » au-dessus d'un fil focalisé, reçus en lignes d'activité |
| Emprunte à    | Granola, Claude Artifacts, Cursor                                | Claude / ChatGPT (artefacts inline), Notion AI           | Linear (projet + activity feed)                                                     |
| Clarté 3 s    | 8                                                                | 8,5                                                      | 8                                                                                   |
| Hiérarchie    | 8                                                                | 8,5                                                      | 7,5                                                                                 |
| Composition   | 7,5                                                              | 8                                                        | 7                                                                                   |
| Densité       | 7,5                                                              | 8                                                        | 7,5                                                                                 |
| Typo          | 7,5                                                              | 7,5                                                      | 7,5                                                                                 |
| Cohérence     | 6,5                                                              | 8                                                        | 6,5                                                                                 |
| Utilisabilité | 7,5                                                              | 8,5                                                      | 7,5                                                                                 |
| Caractère     | 7                                                                | 7,5                                                      | 6,5                                                                                 |
| **Moyenne**   | **7,4**                                                          | **8,1**                                                  | **7,3**                                                                             |

**Critique (sur captures).**

- **A** rend l'état du chat évident, mais le panel ne s'ouvre jamais tout seul (FEATURES §13, décision existante) : un document permanent l'annule et serre le fil à 440 px, ce qui rend illisible la réponse d'Archie au moindre tour long. Le document refait aussi les onglets de la topbar.
- **C** fait des reçus une ligne d'activité, et c'est la meilleure idée des trois pour les sources. Mais le bandeau répète les onglets Sources › Ideas › Clips › Drafts déjà dans la topbar : deux navigations superposées, 110 px de hauteur perdus en permanence. La liste de drafts sans verbe oblige à ouvrir le panel pour agir.
- **B** met le résultat là où l'utilisateur regarde, sous sa demande, avec un statut lisible et un verbe par draft. Il suit la règle existante (« chaque résultat est une carte qui ouvre le panneau sur ses objets »). Point faible : les reçus de sources restent des puces à droite.

## Décision : B, avec les lignes d'activité de C pour les sources

Ce qui change structurellement :

1. **Le lot de drafts devient un bloc de cartes dans le fil** (2 colonnes, une carte par draft) : icône réseau + nom, statut DS (`.ap-status` green « Ready » / orange « Needs a fix »), trois lignes du texte, le problème qui bloque écrit en clair (« Instagram won't publish without an image. »), un verbe : **Schedule** (ouvre la modale Schedule sur ce draft) ou le verbe qui débloque. Cliquer la carte ouvre le panel sur ce draft (`focusManyInPanel`). Sous le bloc, « Review all 4 » ouvre le panel sur le lot. Il remplace la carte pâle « 4 drafts to review », coupée par le fondu.
2. **Un résultat, une seule annonce.** La carte d'intake d'une source porte déjà ses compteurs : ils deviennent des liens texte (« 2 ideas · 5 clips ») au lieu de boutons bleus pleins. La carte butter « 2 ideas ready » qui suivait chaque source disparaît du fil, et les mêmes liens ouvrent le panel au même endroit. → listé dans To decide.
3. **La bulle utilisateur passe en blanc bordé grey-20** (fin de la bulle navy pleine, qui était le bloc le plus contrasté de l'écran). Le contenu d'Archie redevient la masse dominante.
4. **Le fil se centre sur une colonne de 760 px** quand le panel est fermé, pour que la lecture ait la même mesure que le composer.

Inchangé, et pourquoi : onglets du panel dans la topbar (décision `contentPanel`), panel jamais ouvert tout seul, composer et ligne d'aide (porte le lien admin du proto), texte mock des réponses.

**Composants DS.** `.ap-status` (green / orange), `.ap-button` (stroked blue pour le verbe d'une carte, ghost grey pour « Review all »), icônes `ap-icon-linkedin` / `-instagram` / X (nom à vérifier : `ap-icon-twitter` ne peint rien), `ap-icon-warning`. Carte : blanc, bordure grey-20, survol bordure bleue, pas d'ombre.

**Périmètre du build.** `screens/session/thread-turns.js` (rendu du draft-result et de l'intake), `styles/chat.css` (et `chat-legacy.css` intouché : flag OFF). Pas de changement de store. Nouveau chat et premier chat : traités au tour de raffinement s'il reste de la marge (bandeau de succès à barre latérale du premier chat).
