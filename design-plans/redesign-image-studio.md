# Redesign — Image Studio, créateur de style (`#/playbook/:id/styles/new`)

Diagnostic : [`diagnose.md`](diagnose.md) §7. Note de départ **5,0**.

**Objet porteur.** Le style d'image de la marque (`imageStyles` du Playbook, CONCEPTS §1, famille Brand identity) : un look appris de quelques images. Cadre fixe (FEATURES §18) : une seule colonne ; jusqu'à 6 images avec un poids chacune ; une fidélité ; un prompt de style. Retirés à la demande et à ne pas remettre : le Test run, les Do / Don't, les Presets to mix.

## Les trois directions (`.ui-redesign/explore/image-studio/`)

|               | A — images d'abord                                                     | B — ce que je lis                                                            | C — depuis la bibliothèque                                                                     |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Structure     | Page vide = une seule grande zone de dépôt, le reste se déplie ensuite | Après le dépôt : ma lecture des images (une phrase, la palette) avant le nom | Les images de référence du Playbook proposées en premier, à cocher ; l'upload en seconde porte |
| Emprunte à    | Arc, `--sref` de Midjourney                                            | Granola (« voilà ce que j'ai compris »), tableaux Pinterest                  | Brand kit Canva                                                                                |
| Clarté 3 s    | 8,5                                                                    | 8                                                                            | 8                                                                                              |
| Hiérarchie    | 8,5                                                                    | 8,5                                                                          | 7,5                                                                                            |
| Composition   | 7,5                                                                    | 8,5                                                                          | 7,5                                                                                            |
| Densité       | 7                                                                      | 8                                                                            | 8                                                                                              |
| Typo          | 8                                                                      | 8                                                                            | 7,5                                                                                            |
| Cohérence     | 7,5                                                                    | 8                                                                            | 8                                                                                              |
| Utilisabilité | 7,5                                                                    | 8,5                                                                          | 8                                                                                              |
| Caractère     | 7,5                                                                    | 9                                                                            | 7                                                                                              |
| **Moyenne**   | **7,8**                                                                | **8,3**                                                                      | **7,7**                                                                                        |

**Critique (sur captures).**

- **A** rend le premier geste évident, mais seule elle n'apporte pas de retour : elle déplace le formulaire vide sans le remplir.
- **C** est juste (la marque a déjà des images, Product UI, Team candid) mais ajoute une fonctionnalité, choisir dans ses références : le créateur ne sait aujourd'hui que recevoir des fichiers. → To decide, avec maquette.
- **B** remplit le trou du diagnostic, « aucun retour visuel avant l'enregistrement », **sans test run** : rien n'est généré. La lecture existe déjà dans le code (`generatePrompt` : `promptFromImages` à partir des couleurs échantillonnées). Elle est seulement cachée derrière un bouton grisé, dans un champ « optional ».

## Décision : B, avec l'ouverture de A

Ce qui change structurellement :

1. **Vide, la page n'est que le dépôt** (A) : la zone de dépôt est le seul bloc, grande, avec ce qu'on attend (« Drop a few images that share a look »). Le prompt et le nom n'apparaissent pas encore.
2. **Dès qu'il y a des images, je dis ce que j'en lis** : le prompt de style est rédigé tout seul (le `generatePrompt` existant, lancé au dépôt au lieu d'attendre le bouton). Il s'affiche sous le titre « What I read from them », avec la palette échantillonnée (les `colors` des images) en pastilles. Il reste éditable : c'est le même champ, `stylePrompt`. « Generate from the images » devient « Read them again ».
3. **Le nom vient en dernier**, après la lecture.

Inchangé : les poids par image, la fidélité, Save style / Cancel dans la topbar, jusqu’à 6 images, la colonne unique.

**Composants DS.** Dropzone partagé (`dropzoneHTML`), `.ap-textarea-field`, la marque d'Archie (butter) pour sa lecture.

**Périmètre du build.** `src/modules/image-studio/views/style-creator.js` (ordre, ouverture, génération au dépôt), `src/modules/image-studio/styles/imst-*.css`. Rappel DECISIONS : `paint()` repeint tout, et cinq familles de classes sont construites par concaténation, à ne pas renommer.
