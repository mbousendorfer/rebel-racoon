# Sidebar & right panel — règles (v1)

Set de règles simples qui décrivent **comment se comportent et se dimensionnent**
la **sidebar** et le **right panel** dans la zone session.

> Périmètre **v1** : la `conversation-status-card` n'est **pas** shippée en
> première version (flag `conversationStatusCard`, OFF par défaut). Les règles
> ci-dessous l'ignorent donc. Pour le détail technique complet (status-card
> incluse, formules de grille, gardes internes), voir
> [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md) ; pour la recette sans code, voir
> [`SIDEBAR-PANEL-RECIPE.md`](SIDEBAR-PANEL-RECIPE.md).

Les deux surfaces sont des **colonnes d'une même grille** (`#appShell`), pas des
overlays : `sidebar | contenu | right panel`.

---

## Sidebar

1. **Deux états** : étendue (~260px, complète) ou rétractée (~56px, rail
   d'icônes). Jamais cachée.
2. **Toggle manuel** : bouton chevron en tête, ou **⌘B / Ctrl+B** (le raccourci
   est ignoré quand on tape dans un champ texte).
3. **État mémorisé** : le choix étendu/rétracté est retenu entre les sessions et
   appliqué dès l'ouverture (pas de flash).

---

## Right panel

4. **Une seule chose à la fois** : le panel a un seul contenu actif parmi
   **Drafts**, **Ideas** (avec sa vue Clips) et **Sources** — plus
   **Overview** sous le flag `contentPanel` (sauf si `conversationStatusCard`
   est ON : la carte et l'Overview sont l'un ou l'autre). Ouvrir un mode
   remplace le précédent.
5. **Lié à la session** : le panel n'existe que sur une page de session. Quitter
   la session (Playbooks, Connectors, Dashboard, changement de chat…) le ferme.
6. **Deep-link & retour navigateur** : le mode ouvert est encodé dans l'URL
   (`?panel=overview|drafts|ideas|sources`), donc partageable et restauré au
   précédent/suivant.
7. **Fermeture** : bouton de fermeture du panel, ou **Échap** (Échap ferme
   d'abord une modale ouverte par-dessus ou un menu contextuel, puis le panel).
8. **Flag `contentPanel`** (ON par défaut) : les onglets du panel sont **dans la topbar**, juste au-dessus de lui (Overview │ Sources › Ideas, Clips (s'il y en a) › Drafts, avec leurs compteurs, puis le close quand il est ouvert ; désactivés sur un chat vide) — le panel n'a pas de rangée d'en-tête. Un onglet l'ouvre sur lui, l'onglet ouvert le ferme. Le panel ne s'ouvre jamais tout seul : les cartes du fil l'ouvrent sur leurs objets.

---

## Couplage sidebar ↔ panel

9. **Ouvrir le panel rétracte la sidebar — seulement si nécessaire.** À
   l'ouverture (une seule fois, pas à chaque changement de mode), la sidebar
   se rétracte **uniquement** si la garder étendue rendrait la colonne de chat
   trop étroite (en dessous d'un **plancher de 560px**). Sur un grand écran il
   y a de la place : la sidebar **reste étendue**.
10. **Pas de ré-extension auto à la fermeture** : quand on ferme le panel,
    l'utilisateur ré-étend la sidebar lui-même.
11. **La sidebar suit la largeur de la fenêtre** (panel ouvert) : au
    redimensionnement, elle se rétracte quand le chat passe sous le plancher et
    **se ré-étend** quand la fenêtre laisse à nouveau de la place — mais
    uniquement si c'est elle (la règle de largeur) qui l'avait rétractée. Une
    sidebar **rétractée à la main** (chevron / ⌘B) reste rétractée.

---

## Tailles

12. **Largeur par défaut du panel** : **1/3 de l'espace disponible**
    (viewport − sidebar), avec un **plancher de 610px**, **380px sous 1280px** (à 1024, 610 laissait le chat sous son plancher de 560px de la règle 9). Le plancher vit dans `--app-right-panel-floor` (`layout.css`), recopié par `panelFormulaFloor` (`right-panel.js`).
13. **Redimensionnable à la souris** : une poignée sur le bord gauche du panel
    permet de l'élargir/rétrécir, entre **380px** minimum et **viewport − 400px**
    maximum (on garde toujours ≥400px pour la sidebar + le contenu).
14. **Largeur custom non persistée** : elle est conservée tant qu'on change de
    mode dans le même panel, mais **réinitialisée** à la prochaine ouverture
    fraîche et **non** mémorisée entre rechargements.
