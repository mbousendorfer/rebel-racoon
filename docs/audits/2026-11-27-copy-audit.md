# Copy & microcopy audit — the whole app (2026-11-27)

Demandé : « review la copy et la microcopy de toute l'app, audite tout ça, et corrige ». Un mois après la passe du [2026-10-28](2026-10-28-ux-review.md), trois relectures contre [`copy-principles.md`](../copy/copy-principles.md) et le [glossaire](../reference/GLOSSARY.md) : le chat · le shell, les panneaux, le Playbook, Insights, Connectors · l'onboarding, le Topic Feed, Clips, les studios. Environ 300 constats, environ 480 changements appliqués sur près de 100 fichiers.

## Arbitrages

- **La question en double** (bulle d'Archie + titre de la carte) : l'utilisateur garde la carte. Dans le chat, le picker vit sous le fil et disparaît une fois répondu, donc la bulle reste la seule trace de la question : elle reste. Voir §8.4 ; déplacer le picker dans le fil est ce qui la ferait partir.
- **Les échos « You »** : §8.3 appliqué. Plus d'écho pour un choix procédural (Not now, Adjust, période, tri) ; un écho reformulé pour un choix qui compte (« Yes, delete them. », « Make it 3. »).
- **Un libellé pour produire des drafts** : **Write N drafts** (chat et Clips).
- **Source** reste ce qu'on attache à un chat : le Topic Feed écoute des **Listening sources**, l'éditeur de clips montre l'**Original** face à l'Output.
- Défauts tirés des docs : **Reference** reste le verbe du `@` (Mention = un compte tagué dans un draft) ; **Agorapulse** reste nommé là où c'est la plateforme (CONCEPTS §6) ; **account** pour les comptes de l'utilisateur, **profile** pour ceux des concurrents et influenceurs ; objectifs : **period** (pas window), **Stand-in** (pas proxy), **Edit objective** ; **Delete video** (définitif), **Remove clip** (Undo) ; **Configure** gardé sur la ligne d'un réseau sans voix (demandé deux fois).

## Ce qui a changé, par famille

1. Termes : `rules for X` → la voix ; Reuse → Repurpose ; post → draft pour un post généré ; signal → relevance ; Shape / ratio → Format ; Generate again → Regenerate ; profile → account ; Topic capitalisé, « Use in chat », lane « Ready to draft ».
2. Erreurs : plus de « Something went wrong » ; chaque erreur dit quoi faire.
3. Confirmations : titre = verbe du bouton, corps = conséquence, « Keep » ; un seul corps « Delete Playbook » (`deletePlaybookBody`, `playbook-access.js`).
4. CTA : verbe + objet (Rename source, Schedule drafts, Edit Brief, Open Image Studio, Change account…).
5. Un nom par chose : Summarize it, Open drafts / ideas / clips, Back to chat, No Playbook yet, Edit in the Playbook, Reanalyze website, Attach a source, Ask X in a chat, Rename clip, Safe area, `· optional`, Close panel.
6. États vides et attentes : « No X yet » + une phrase ; des attentes qui disent ce qui se passe (« Searching Notion… », « 3 steps · 3s »).
7. Voix : moins de « Let's », plus de triplets ni de contrastes, plus de « just » / « actually ».
8. Ponctuation : tirets cadratins retirés de la copy UI, virgule d'Oxford, guillemets droits, durées `30s` / `2 min`, pluriels ternaires.
9. Bugs : « the most most relevant items », « 1 chat use it », « 1 days left », des aria-label qui lisaient « fontFamily », la pill « Dashboard » du bug report, un double échappement dans le corps de suppression de Playbook.

## Laissé tel quel

- Le contenu mock : corps de posts, titres d'idées et de clips, analyses générées, les « mauvais posts » d'exemple, les sous-titres générés (`clip-captions.js` joint titre et résumé par un tiret).
- `sidebar-wizard.js` (injoignable) et `renderContentWorkspace` (jamais importé) : du code mort, pour `check:dead`.
- « Seamless Bounce », un nom propre de preset de sous-titres.
- Le `confirmDialog` de l'Image Studio ignore `danger` (bouton orange même pour supprimer) : du style, pas de la copy.
