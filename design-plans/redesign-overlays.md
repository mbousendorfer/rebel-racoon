# Redesign — Overlays (`?openModal=`)

Diagnostic : [`diagnose.md`](diagnose.md) §8. Note de départ **6,5**.

**Constat.** Les dix overlays de `OVERLAYS` sont des dialogues DS cohérents entre eux (titre, contenu, pied d'actions à droite). Search (Cmd-K) et Pick a chat sont déjà construits comme les meilleurs : clavier, lignes groupées, une seule action par ligne. Un seul présente un doute structurel : l'ajout d'une source (« Attach a file », une zone de dépôt seule). C'est sur lui qu'ont porté les trois directions.

## Les trois directions (`.ui-redesign/explore/overlays/`, ajout d'une source)

|             | A — une modale par méthode                                        | B — une seule modale                                                            | C — sans modale                                                                                      |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Structure   | Le menu Add choisit la méthode, la modale l'exécute (aujourd'hui) | « Add a source » : fichier, lien et texte sur une surface, une seule entrée Add | Add a file ouvre l'explorateur, le lien se colle dans le composer, seul Paste text garde un dialogue |
| Emprunte à  | Gmail, Slack                                                      | Claude, ChatGPT                                                                 | Linear, Slack                                                                                        |
| **Moyenne** | **8,0**                                                           | **7,6**                                                                         | **7,9**                                                                                              |

**Critique (sur captures et sur le code).**

- **C** semblait la plus directe, mais **le prototype la fait déjà** : « Add PDF » et « Add video » ajoutent la source sans dialogue (`startPillFromKind`, `session.js`), et le composer prend déjà un lien collé ou un fichier déposé. Il n'y a rien à retirer.
- **B** regroupe trois méthodes que le menu sépare, et rouvre le menu Add du composer, une surface déjà redessinée (chat) : une modale de plus pour un geste qui en a déjà zéro.
- **A, l'existant, est la bonne structure.** « Attach a file » n'est que le **repli** : un fichier déposé que je ne sais pas classer, ou une vidéo pour les clips (`openAddSourceModal({ tab: "upload" })`). Une zone de dépôt seule est juste pour ce rôle. La seule faiblesse est qu'il ne dit pas ce qui va se passer.

## Décision : A, la structure actuelle, démontrée

Ce qui change : **chaque dialogue d'ajout dit ce que j'en fais**, sous son titre (« I read it and tell you what's in it. »), comme le reste de l'app où j'annonce mes actions à la première personne. Pas de changement de structure : la démonstration ci-dessus est la raison, et elle est la condition posée par la mission pour une surface déjà juste.

Inchangé : les dix overlays, leurs pieds, leurs largeurs (échelle UI-PATTERNS).

**Périmètre du build.** `src/components/add-source-modal.js` (sous-titre par méthode). La cohérence des dialogues entre eux passe en phase `coherence`.
