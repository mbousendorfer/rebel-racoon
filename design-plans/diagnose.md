# UI redesign — diagnostic (tick 2, 2026-10-30)

Fondé sur les captures `.ui-redesign/before/` (1440, 1024), config par défaut (`returning`) et premier lancement (`new-alt`).
Grille /10 : clarté 3 s · hiérarchie · composition · densité · typo · cohérence · utilisabilité · caractère. Note = moyenne arrondie au demi-point.

## Ordre final

| #   | Surface                                                | Shots                                                    | Avant |
| --- | ------------------------------------------------------ | -------------------------------------------------------- | ----- |
| 1   | `chat` — nouveau chat, premier chat, chat avec contenu | chat, new-chat, first-time-chat, chat-loading            | 6,0   |
| 2   | `drafts` — panel Drafts, édition, feedback, schedule   | panel-drafts, draft-edit, draft-feedback, schedule-modal | 5,5   |
| 3   | `panel` — Overview, Sources, Ideas, Clips              | panel-overview, panel-sources, panel-ideas, panel-clips  | 6,0   |
| 4   | `onboarding` — `/welcome-alt` → `/recap` → `/voice`    | welcome-\*                                               | 7,0   |
| 5   | `playbook` — catalogue + fiche (chaque onglet)         | playbooks, empty-playbooks, playbook-\*                  | 6,0   |
| 6   | `topics` — feed + réglages                             | topics, empty-topics, topics-settings                    | 6,5   |
| 7   | `image-studio` — création de style                     | image-studio                                             | 5,0   |
| 8   | `overlays` — modales `?openModal=`                     | modal-\*                                                 | 6,5   |

**Réordonné par rapport à la mission :** le panel (Sources / Ideas / Overview) remonte en 3 juste après Drafts. Les deux vivent dans le même conteneur : redesigner le châssis du panel une fois pour Drafts puis l'étendre aux autres onglets évite deux langages de panel côte à côte. Le reste garde l'ordre d'impact de la mission. Le shell (sidebar) n'est pas une surface : sa structure est fixe, toute proposition passe par « To decide ».

---

## 1. Chat — 6,0

**Job.** Donner une matière (fichier, lien, Topic) et une consigne, récupérer des drafts prêts à programmer, itérer dessus en conversation.
**À rendre évident en 3 s.** Où en est ce chat (ce que j'ai donné, ce qu'Archie en a tiré, ce qui reste à faire) et où je tape la suite.

**Problèmes structurels**

1. **Le fil est un journal de reçus, pas une conversation.** Chaque source donne deux objets : la puce utilisateur (avec ses boutons bleus pleins « 2 ideas › », « 5 clips › ») puis une carte butter « 2 ideas ready · View ideas ». Le même résultat est annoncé deux fois, et les boutons bleus pleins sont les éléments les plus saillants de l'écran alors qu'ils ne sont que des compteurs.
2. **Le résultat qui compte est le plus faible visuellement.** « 4 drafts to review », l'aboutissement du chat, est une carte pâle coupée par le fondu du composer ; la réponse d'Archie est une liste de liens soulignés tronqués à « … » (« X · Your Q2 plan isn't a plan, it's… »). On lit une table des matières, pas des posts.
3. **Hiérarchie inversée.** La bulle utilisateur navy pleine est le bloc le plus contrasté de la page ; le texte d'Archie (le contenu) est en encre normale sans structure.
4. **Le pipeline est en topbar à droite, loin du fil**, avec des chevrons qui évoquent un wizard (Overview │ Sources › Ideas › Clips › Drafts). Le titre du chat et l'état du travail ne se parlent pas.
5. **Composer chargé.** Add · Reference · « Playbook Acme · Q2 marketing » statique · (?) · envoi, puis une ligne d'aide clavier permanente sous le composer. Le nouveau chat garde la même toolbar ; les starters (lignes) et les Topics (cartes) se concurrencent sous le composer. Le premier chat ajoute un bandeau succès vert à barre latérale.

**Ce que font les meilleurs.** Claude / ChatGPT : réponses en prose, artefacts en cartes riches inline (aperçu, pas lien). Granola : un document vivant à côté de la conversation. Linear : statut compact, verbes en clair. Notion AI : un résultat = un bloc qu'on ouvre.

## 2. Drafts — 5,5

**Job.** Relire les drafts d'un chat, corriger ce qui bloque, programmer.
**À rendre évident en 3 s.** Combien de drafts, lesquels sont prêts, lesquels bloquent et pourquoi, et le verbe Schedule.

**Problèmes structurels**

1. **Un draft = un écran.** Chaque draft est un mock complet de post LinkedIn (avatar, image 4:3, Like / Comment / Repost / Send, 198 réactions) dans un panel de ~550 px : on voit un seul draft à la fois, les compteurs de réactions inventés concurrencent le texte.
2. **Les verbes sont une colonne de six icônes sans libellé** hors de la carte (mention, schedule, edit, copy, assign, delete). Schedule, le verbe principal, n'est qu'une icône parmi six.
3. **« Needs fixes » est un onglet, pas un état visible sur la carte** : rien sur le draft LinkedIn ne dit ce qui va ou ne va pas.
4. **Deux niveaux de cases à cocher** (groupe réseau + carte) toujours visibles : le mode sélection est permanent.
5. **Feedback et « Why this draft » flottent sous la carte**, détachés ; le formulaire de feedback (chips + textarea + bouton plein bleu) pousse le draft suivant hors champ. La modale Schedule est saine (7) ; l'édition inline est correcte mais vit dans le mock.

**Ce que font les meilleurs.** Linear (liste dense + statut + détail), Buffer / Typefully (le texte d'abord, l'aperçu réseau à la demande), Superhuman (un verbe principal évident par item).

## 3. Panel Sources / Ideas / Overview — 6,0

1. **Ideas : chaque carte porte trois rangées de méta et deux CTA** (Reference + Draft post en fond bleu clair) : cinq cartes = dix boutons, aucun ne ressort.
2. **Sources commence par une définition** (« A Source is a file, link… ») : du texte d'aide permanent en tête de liste.
3. **Overview répète les trois autres onglets en miniature** sans dire la suite ; l'infobox du haut est la seule orientation.
4. **Les tags de type (Story, Insight, Quote) en gris à bord sont visuellement des boutons.**
5. **Trois cartes différentes pour le même objet idea** (fil, Sources, Ideas, Overview).

## 4. Premier lancement — 7,0

Caractère fort (scène de pixels, aperçu « Your Playbook » qui se remplit). Problèmes : **deux systèmes de navigation sur `/recap` et `/voice`** (liste de parties à gauche + pile de cartes défilante à droite avec flèches et pagination à points) ; **deux CTA concurrents** (« Check my voice » à gauche, « Looks good, on to Branding » flottant à droite) ; **les cartes suivantes sont noyées dans le dégradé** (texte illisible) ; la barre « Rewrite it from · An account's posts · A document » flotte en haut de la scène, loin de la voix qu'elle modifie ; `/intro` liste quatre étapes et quatre pastilles de parties en doublon.

## 5. Playbooks — 6,0

Catalogue : **titre doublé** (topbar + H1 « Playbooks ») ; cartes à quatre rangées de méta à icônes (chats, audiences, concurrents, influenceurs) + pastilles de couleur muettes + « Updated » : on ne sait pas laquelle ouvrir ; les titres cassent mal (« Acme · Q2 / marketing »). Fiche : **chaque section répète une phrase d'aide** (« What I know about the business… », « The people every post is for. ») avant son contenu ; grille 2 colonnes à hauteurs inégales ; Voice = une liste de boîtes grises ; « Re-analyze website » au même rang que « Start a chat ».

## 6. Topics — 6,5

Master-detail juste. Problèmes : paragraphe d'explication permanent en tête ; Relevance / Why now en **boîtes saumon** (teinte décorative sur de la donnée statique) ; cartes de liste toutes bordées, statut et titre à poids égal ; réglages : six cartes « Not available yet » occupent les trois quarts de la page.

## 7. Image Studio — création de style — 5,0

**Un formulaire vide de 700 px** dans une page de 1180 px : dropzone, textarea, nom. Pas d'aperçu du look, pas d'exemple, « Generate from the images » désactivé sans explication. Le job (définir un look visuel) n'a aucun retour visuel avant l'enregistrement.

## 8. Overlays — 6,5

Cohérents entre eux (DS modal). « Attach a file » n'est qu'une dropzone sans alternative (lien, Topic) ; à revoir en cohérence une fois les surfaces faites.

## Transverse (pour la phase cohérence)

En-têtes de page (topbar + H1 doublés, phrases d'aide permanentes) · cartes (bordure + méta multiples partout) · tags de type qui ressemblent à des boutons · CTA secondaires en bleu clair plein · barres latérales d'accent (bandeau du premier chat, infobox Overview).
