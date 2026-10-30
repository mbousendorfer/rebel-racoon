# Redesign — Drafts (panel Drafts, édition, feedback, Schedule)

Diagnostic : [`diagnose.md`](diagnose.md) §2. Note de départ **5,5**.

**Objet porteur.** Le Draft (CONCEPTS §4), qui appartient au chat (§3) ; Schedule et Assign sont des points de contact Agorapulse (§6). Le panel est la vue de travail des drafts du chat, et ce qu'on y fait, c'est faire partir des drafts.

## Les trois directions (`.ui-redesign/explore/drafts/`)

|               | A — aperçu, actions nommées                                                                       | B — liste + détail                                                                               | C — file par statut                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Structure     | Aperçu réseau gardé et compacté, barre d'actions nommées dans la carte, problème en tête de carte | Liste compacte (réseau, première ligne, statut) au-dessus du draft sélectionné en aperçu complet | Sections « Needs a fix » puis « Ready to schedule » avec leur verbe groupé, cartes texte d'abord, aperçu à la demande |
| Emprunte à    | Buffer, composer Hootsuite                                                                        | Linear, Superhuman, Mail                                                                         | Typefully, triage Linear                                                                                              |
| Clarté 3 s    | 7,5                                                                                               | 8                                                                                                | 8,5                                                                                                                   |
| Hiérarchie    | 7,5                                                                                               | 8                                                                                                | 8,5                                                                                                                   |
| Composition   | 7                                                                                                 | 7,5                                                                                              | 8                                                                                                                     |
| Densité       | 6,5                                                                                               | 8,5                                                                                              | 8                                                                                                                     |
| Typo          | 7,5                                                                                               | 7,5                                                                                              | 7,5                                                                                                                   |
| Cohérence     | 8                                                                                                 | 7                                                                                                | 7,5                                                                                                                   |
| Utilisabilité | 7,5                                                                                               | 7                                                                                                | 8                                                                                                                     |
| Caractère     | 7                                                                                                 | 7,5                                                                                              | 7,5                                                                                                                   |
| **Moyenne**   | **7,3**                                                                                           | **7,6**                                                                                          | **7,9**                                                                                                               |

**Critique (sur captures).**

- **A** nomme enfin les verbes, mais un draft prend encore tout le panel (un post LinkedIn et son image occupent 450 px) : on ne voit pas ce qui reste à faire.
- **B** est le plus dense, mais il cache le contenu : relire quatre drafts demande quatre clics, et la liste répète en tronqué ce que le détail montre. Les flèches haut / bas sont un modèle de messagerie, étranger au reste de l'app.
- **C** organise le panel par ce que l'utilisateur doit faire : ce qui bloque d'abord, puis ce qui peut partir, avec un seul verbe groupé (« Schedule 2 »). Mais il range l'aperçu fidèle au réseau derrière un bouton, alors que c'est une fonctionnalité centrale du panel (FEATURES §4 : une carte, six réseaux).

## Décision : C pour la structure, l'aperçu fidèle de A dans chaque carte

Ce qui change structurellement :

1. **Les drafts sont groupés par statut, plus par réseau.** Deux sections : « Needs a fix · N » d'abord, puis « Ready to schedule · N ». Le réseau reste sur chaque carte (aperçu + icône) et dans le filtre « All networks ». L'en-tête de section garde le comportement du band actuel (case « tout sélectionner », barre Save as drafts / Schedule / Delete pendant une sélection). Au repos, la section Ready porte **« Schedule N »** (`primary orange`, comme la confirmation de la modale) : tout programmer d'un geste, ce que l'app ne savait faire que réseau par réseau. Une sélection reste toujours valide, puisqu'une section ne mélange pas les statuts : c'est la garantie que le groupement par réseau donnait, en plus fort.
2. **Le verbe principal de chaque carte est nommé dans son pied** : « Schedule » sur un draft prêt, le verbe qui débloque sur un autre (« Add an image », « Shorten it »), à côté de « How's this draft? ». Schedule quitte le rail d'icônes, qui garde Reference · Edit · Save as draft · Assign · Delete dans l'ordre de prod. → listé dans To decide (écart au rail de prod).
3. Les onglets All drafts / Needs fixes restent (filtre), le compteur aussi.

Inchangé : l'aperçu fidèle au réseau, l'édition au clic sur le texte, la validation dérivée, la modale Schedule (itérée longuement, FEATURES §5), Assign.

**Composants DS.** `.ap-checkbox-container`, `.ap-button` (primary orange pour « Schedule N », stroked blue pour le verbe d'une carte, ghost blue Save as drafts), `.ap-icon-button` Delete, `.ap-tabs`, `.ap-counter`.

**Périmètre du build.** `components/right-panel/drafts-view.js` (sections par statut, sélection par section, « Schedule N »), `components/post-card.js` (verbe nommé dans le pied, Schedule hors du rail), `styles/components/right-panel.css`, handlers dans `right-panel.js`. Pas de changement de store.
