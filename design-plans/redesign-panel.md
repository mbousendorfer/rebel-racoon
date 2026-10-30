# Redesign — Panel Sources / Ideas / Overview

Diagnostic : [`diagnose.md`](diagnose.md) §3. Note de départ **6,0**.

**Objet porteur.** L'Idea (CONCEPTS §4, pipeline Source → Idea → Draft) et la Source, qui appartiennent au chat (§3). L'onglet Ideas est le stock d'angles que le chat a tirés de ses sources ; le job est d'en choisir un et de le drafter.

## Les trois directions (`.ui-redesign/explore/panel/`)

|               | A — liste de lecture                                     | B — par source                                                             | C — par avancement                                                                          |
| ------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Structure     | Une liste encadrée, une ligne par idea, verbes au survol | Sources et Ideas fusionnés : chaque source, ses ideas et ses clips dessous | « To draft » en cartes avec leur verbe, « Drafted » replié à une ligne qui ouvre ses drafts |
| Emprunte à    | Linear issues, Readwise                                  | Notion groupé par relation, Granola                                        | Things (Today / Logbook), triage Linear                                                     |
| Clarté 3 s    | 7,5                                                      | 7,5                                                                        | 8,5                                                                                         |
| Hiérarchie    | 7,5                                                      | 8                                                                          | 8,5                                                                                         |
| Composition   | 8                                                        | 8                                                                          | 8                                                                                           |
| Densité       | 8,5                                                      | 8                                                                          | 7,5                                                                                         |
| Typo          | 7,5                                                      | 7,5                                                                        | 7,5                                                                                         |
| Cohérence     | 7                                                        | 7                                                                          | 8,5                                                                                         |
| Utilisabilité | 6,5                                                      | 7,5                                                                        | 8                                                                                           |
| Caractère     | 7                                                        | 7,5                                                                        | 7,5                                                                                         |
| **Moyenne**   | **7,4**                                                  | **7,6**                                                                    | **8,0**                                                                                     |

**Critique (sur captures).**

- **A** est la plus dense, mais cacher les verbes au survol rend le panel muet au repos : rien ne dit qu'on peut drafter, et le feedback (pouces), Why this idea et Reference n'ont plus de place.
- **B** répond à « d'où vient cette idea », mais l'onglet Sources fait déjà exactement ça (FEATURES §13) : B supprime un onglet pour en doubler un autre, et la question du jour (« laquelle drafter ? ») n'y est pas mieux servie.
- **C** pose la même question que le panel Drafts : ce qui reste à faire d'abord, ce qui est fait ensuite. Les ideas déjà draftées, qui prennent aujourd'hui une carte entière avec deux boutons, tiennent en une ligne. Le « Draft all 3 » de la maquette est retiré : c'est un flow qui n'existe pas (pas d'étape non demandée).

## Décision : C

Ce qui change structurellement :

1. **L'onglet Ideas a deux sections** : **To draft · N** (les cartes d'idea actuelles, avec leurs verbes : pouces, Why this idea, Reference, Draft post) puis **Drafted · N**, une ligne par idea déjà draftée : son type, son titre, et un lien « N drafts » qui ouvre l'onglet Drafts sur ces drafts (`focusManyInPanel`). Même grammaire de sections que le panel Drafts (« Needs a fix » / « Ready to schedule »).
2. **Le tag de type n'est plus un bouton gris bordé** : il devient un mot en gras devant la source sur la ligne de méta (« Insight · q2-strategy-offsite-notes.pdf »), comme dans les maquettes. Un tag bordé se lisait comme un contrôle.
3. **Sources : la phrase de définition permanente en tête de liste disparaît** ; « Attach a source » reste seul dans la barre, à droite. Une définition sert une fois, pas à chaque ouverture.

Inchangé : le filtre de type, l'onglet Clips, Overview (son infobox est le prochain pas du chat, elle tient son rôle ; à revoir en cohérence s'il le faut), les cartes de source.

**Composants DS.** `.ap-card`, `.ap-button` (stroked blue Draft post, ghost blue « N drafts »), sections en `h3` + compteur comme le panel Drafts, `.ap-status`.

**Périmètre du build.** `components/right-panel.js` (rendu Ideas et Sources), `components/idea-card-compact.js` (méta : type en mot), `styles/components/right-panel.css`. Pas de store.
