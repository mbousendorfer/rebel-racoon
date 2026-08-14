# Modèle conceptuel

> **La nature des objets du produit** — ce qu'ils sont, et surtout ce qu'ils ne sont pas.
>
> Trois docs se répondent : [`GLOSSARY.md`](GLOSSARY.md) fixe **les mots**, [`FEATURES.md`](FEATURES.md) décrit **les comportements**, celui-ci pose **les frontières**. Quand une question commence par « est-ce que ça va dans… », c'est ici qu'on répond.

---

## 1. Le Playbook

### Définition

Un **Playbook** est la **fiche d'identité d'un émetteur** — une marque, un produit, ou une personne — **et de son cadrage éditorial**.

C'est le `CLAUDE.md` d'une marque : le document qu'on donnerait à un rédacteur freelance avant sa première mission, pour qu'il écrive juste sans avoir à demander. Qui parle, à qui, pour obtenir quoi, avec quelle voix, sous quelle identité visuelle.

**Le critère qui résume tout** : le contenu d'un Playbook est **vrai avant le premier post et encore vrai après le centième**. Rien de ce qui s'y trouve ne dépend de ce qui a été produit.

### Ce qu'il contient

Cinq familles, détaillées champ par champ dans [`FEATURES.md` §9](FEATURES.md#9-playbooks) :

| Famille              | Répond à                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| **Identité**         | Qui est cette marque ? (nom, site, business summary, langue(s))              |
| **Audience & goals** | À qui je parle, quels problèmes ils ont, quel objectif je poursuis, quel CTA |
| **Voice & style**    | Comment ça sonne (hooks signature, closings, formatting, style visuel)       |
| **Brand identity**   | À quoi ça ressemble (logos, couleurs, typo, personnalité, images de réf.)    |
| **Competitors**      | Contre qui je me positionne (flag `playbookCompetitors`)                     |

### Le test d'inclusion

Avant d'ajouter un champ ou une section, trois questions. **Une seule réponse « non » suffit à exclure.**

1. **Est-ce vrai indépendamment de tout contenu produit ?**
   Si la valeur change parce qu'un post a été écrit, lu ou publié → ce n'est pas de l'identité, c'est du **contenu** ou de la **métrique**.
2. **Est-ce que ça reste vrai sans que personne n'y touche ?**
   Si ça se périme tout seul avec le temps → c'est de la **donnée dynamique**. La fiche ne bouge que quand quelqu'un l'édite.
3. **Est-ce que ça répond « qui êtes-vous ? » — et pas « quel job Archie doit tourner ? »**
   Le second est de la **config opérationnelle**. Déclaratif sur l'entité, opérationnel sur la route qui possède la feature.

### Ce qui n'y entre jamais

| Exclu                          | Exemples                                                             | Vit à la place dans                                                                                  |
| ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Le contenu produit**         | Sources, Ideas, Drafts, posts programmés, Topics                     | `sources-stream.js` (global), `library.js`, `posts-store.js`, `schedule-store.js`, `topics-store.js` |
| **Les métriques & historique** | performance des posts, top posts, ce qui a marché                    | `top-posts-store.js`, et la prod côté Agorapulse                                                     |
| **La config opérationnelle**   | quelles sources d'écoute tournent, à quelle cadence, quoi surveiller | `/topics/settings` ([`FEATURES.md`](FEATURES.md) §17)                                                |

Les **comptes sociaux connectés** (`connectedSocials`, `selectedProfileId`) restent, eux, admissibles : ils disent sous quelle identité cette marque publie, ce qui est encore une réponse à « qui êtes-vous ? ».

### Deux exceptions de stockage, assumées

La règle porte sur **ce que la fiche dit**, pas sur la forme de l'objet JS. Deux champs exclus de la fiche sont malgré tout stockés sur le Context :

- **`ctx.topics = { enabledSourceIds, cadence }`** — de la config opérationnelle pure. Elle est **par Playbook** (chaque marque écoute ses propres sources), donc la donnée est portée par l'entité ; mais elle est **éditée et lue ailleurs**, sur `/topics/settings`, et n'apparaît nulle part comme section de la fiche. Une section Topics a été essayée puis retirée : une grille d'interrupteurs se lit comme un panneau de réglages coincé dans un profil.
- **`usedIn`** — un compteur de traçabilité (« appliqué dans N chats »), affiché sur la carte de la bibliothèque, jamais dans la fiche.

**L'invariant** : ni l'un ni l'autre ne doit jamais devenir une section du Playbook. Si un champ opérationnel finit rendu dans la fiche, c'est un défaut de conception, pas une évolution.

### Granularité — un émetteur × un cadrage

Un Playbook = **un émetteur** (marque, produit ou personne) **× un cadrage éditorial**. Les combinaisons sont des **fiches indépendantes**, sans hiérarchie ni héritage : pas de Playbook parent, pas de variante rattachée. Dupliquer (`duplicateContext`) puis diverger est le geste prévu.

Les seeds montrent les trois cas ([`mocks.js`](../../src/mocks.js)) :

| Playbook               | Émetteur         | Cadrage                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `Acme · Q2 marketing`  | la marque Acme   | la campagne du trimestre                  |
| `Customer stories`     | la marque Acme   | un angle éditorial différent, même marque |
| `Founder voice only`   | une **personne** | sa voix propre, hors marque               |
| `Pawtrack · always-on` | une autre marque | le régime permanent                       |

Deux Playbooks pour Acme n'est donc **pas** une incohérence : même identité, cadrage éditorial distinct, deux fiches. Ce qu'un Playbook n'est jamais, c'est un dossier de campagne — la campagne est un cadrage, pas un contenant.

### Évolution — écrit par analyse, édité à la main

Un Playbook naît d'une **analyse** (le site, des posts, des documents) puis ne change **que par un geste explicite** :

- édition d'une section (une à la fois, Save/Cancel sur snapshot) ;
- **Re-analyze website**, derrière une confirmation ;
- ajout d'une proposition d'Archie que l'utilisateur accepte.

**Aucune écriture silencieuse.** Archie ne réécrit pas la fiche parce qu'il a « appris » quelque chose au fil des chats. Le seul motif de proposition existant l'illustre : un competitor découvert arrive avec `suggested: true`, hors du Playbook, dans un bac séparé — il n'en fait partie qu'après un clic. C'est le patron à reprendre pour toute future suggestion : **proposer à côté, jamais écrire dedans**.

Conséquence pour qui code : une feature qui aurait besoin de patcher un Playbook en arrière-plan doit passer par une proposition visible, ou ne pas toucher au Playbook.

### Le nom dans le code

Le code, les stores et les IDs disent **`Context`** ; l'UI dit **`Playbook`**. C'est un héritage assumé, pas une nuance de sens — voir [`GLOSSARY.md` § Playbook = Context](GLOSSARY.md#playbook--context-vocabulary-leak).

---

## 2. Les autres objets, et pourquoi ils ne sont pas dans le Playbook

Le pipeline canonique et les champs sont dans [`GLOSSARY.md`](GLOSSARY.md). Ici, seulement la frontière.

| Objet         | Ce que c'est                                                  | Pourquoi hors Playbook                                                                                               |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Session**   | Un fil de conversation avec Archie                            | C'est le lieu où un Playbook est **appliqué**. Une session cite un `contextId` ; elle ne le modifie pas.             |
| **Source**    | Un input brut ingéré (PDF, URL, vidéo, réponse de connecteur) | Du contenu, daté, global cross-session. La fiche dit comment écrire, pas à partir de quoi.                           |
| **Idea**      | Un insight extrait d'une source                               | Du contenu produit, par session.                                                                                     |
| **Draft**     | Un post candidat pour un réseau                               | Du contenu produit. Il **lit** le Playbook (voix, CTA, marque) et ne lui rend rien.                                  |
| **Schedule**  | Un draft posé dans le calendrier                              | Du contenu daté.                                                                                                     |
| **Topic**     | Un dossier assemblé depuis le listening                       | Arrive tout seul sur une cadence : dynamique par nature. Rattaché à un Playbook (`contextId`), jamais stocké dedans. |
| **Connector** | Une source live interrogeable en MCP (Notion, Slite, …)       | De l'infrastructure de compte, partagée par tous les Playbooks. Se connecte une fois, sert partout.                  |

**La règle de dépendance, dans un seul sens** : le contenu lit le Playbook, le Playbook n'apprend pas du contenu.

```
Playbook ──lu par──▶ Session ──▶ Source ──▶ Idea ──▶ Draft ──▶ Schedule
   ▲                                                              │
   └──────── seulement par édition explicite ─────────────────────┘
```

---

## 3. Checklist avant d'ajouter quelque chose au Playbook

1. Le **test d'inclusion** (§1) passe-t-il sur les trois questions ?
2. Est-ce une réponse à « qui êtes-vous ? » qu'un rédacteur externe aurait besoin de lire avant d'écrire ?
3. Est-ce que ça se met à jour **uniquement** par un geste de l'utilisateur ?
4. Si c'est de la config : la route qui possède la feature n'est-elle pas le bon endroit ? Trois pages de settings agrégées ont été tentées et reverties ici — voir [`CLAUDE.md`](../../CLAUDE.md) § _A settings surface must not aggregate_.

---

## Voir aussi

- [`GLOSSARY.md`](GLOSSARY.md) — le vocabulaire, l'ambiguïté Playbook ↔ Context
- [`FEATURES.md` §9](FEATURES.md#9-playbooks) — les sections, les champs, les flows d'édition
- [`STORES.md`](STORES.md) — comment ces concepts se matérialisent en stores
- [`../copy/copy-principles.md`](../copy/copy-principles.md) — comment en parler dans l'UI
