# Redesign — Topic Feed (`#/topics`, `#/topics/settings`)

Diagnostic : [`diagnose.md`](diagnose.md) §6. Note de départ **6,5**.

**Objet porteur.** Le Topic (DECISIONS « The Topic Feed ») : la file où Archie propose au lieu d'attendre. Le job est de trier : lire la revendication, décider Use in chat ou Ignore. Cadre fixe : le master-detail où la liste rétrécit, deux verbes, six puces dérivées de quatre champs, les filtres en trois contrôles groupés, un seul rendu d'article pour trois hôtes, deux formes de carte. Le magazine supprimé ne revient pas.

## Les trois directions (`.ui-redesign/explore/topics/`)

|               | A — boîte de réception                                                                                                  | B — article mené                                                                | C — liste dense                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Structure     | Une feuille blanche de lignes sans bordure, la revendication en gras tant qu'elle n'a pas de réponse, séparateurs d'âge | Cartes gardées, l'article s'ouvre sur une phrase de tête puis sections en prose | Deux lignes par Topic, résumé seulement dans l'article |
| Emprunte à    | Superhuman, Mail, inbox Linear                                                                                          | Readwise Reader, Feedly AI                                                      | Techmeme, Hacker News                                  |
| Clarté 3 s    | 8,5                                                                                                                     | 7,5                                                                             | 8                                                      |
| Hiérarchie    | 8,5                                                                                                                     | 7,5                                                                             | 8                                                      |
| Composition   | 8                                                                                                                       | 7,5                                                                             | 7,5                                                    |
| Densité       | 8                                                                                                                       | 7                                                                               | 8,5                                                    |
| Typo          | 8                                                                                                                       | 8                                                                               | 7,5                                                    |
| Cohérence     | 8,5                                                                                                                     | 7,5                                                                             | 7,5                                                    |
| Utilisabilité | 8,5                                                                                                                     | 7,5                                                                             | 7,5                                                    |
| Caractère     | 7,5                                                                                                                     | 8                                                                               | 7                                                      |
| **Moyenne**   | **8,2**                                                                                                                 | **7,6**                                                                         | **7,7**                                                |

**Critique (sur captures).**

- **B** touche surtout l'article. Or ses deux faits sur fond pêche sont une décision argumentée et retournée deux fois (commentaire de `topics.css`, `git log -S app-border-soft`) : la reprendre ici serait relancer le même débat sans élément nouveau. → To decide. Sa phrase de tête demanderait du contenu que le store n'a pas.
- **C** double la densité, mais retire le résumé de la liste : on trie alors sur le seul titre, et le résumé est justement ce qui dit si le Topic vaut l'ouverture.
- **A** dit que c'est une file à traiter, comme une boîte mail : la carte disait déjà lu / non lu « au sens messagerie » (`is-triaged`, `topic-card.js`), la liste ne le montrait pas. Une feuille de lignes au lieu d'une pile de cartes bordées, le titre en gras tant qu'il attend une réponse, en regular une fois traité.

## Décision : A

Ce qui change structurellement :

1. **La liste est une feuille, plus une pile de cartes** : les cartes du feed (`.topic-card--feed`) perdent leur bordure, leur rayon et l'espace entre elles ; un filet grey-20 les sépare, sur un seul fond blanc bordé. Les séparateurs d'âge restent les titres de la feuille. Le survol garde la bordure bleue (convention), la lecture garde son fond bleu-05.
2. **Non lu = gras, lu = regular** : la revendication d'un Topic sans réponse (`status: new`) est en gras ; un Topic traité (`is-triaged`) passe en regular, au lieu d'un fond grey-05 qui se confondait avec le canevas.

Inchangé : l'article et ses deux faits, les deux verbes, les puces, les filtres, l'invitation influenceurs, la carte du picker et du nouveau chat (autre forme, autre hôte), les réglages (déjà retravaillés le 2026-10-30, TP-16/17).

**Composants DS.** Aucun nouveau : `.ap-tag` des puces, filets grey-20.

**Périmètre du build.** `styles/components/topic-card.css` (forme feed seulement), `styles/screens/topics.css` (le conteneur de liste). Pas de JS.
