# Design System — workflow & conventions

> Tout le travail UI/CSS doit passer d'abord par le DS Agorapulse V2. **Ne pas inventer un composant / un token / une icône** si le DS le fournit déjà.
>
> Les régressions causées par du CSS ad-hoc qui override les tokens DS sont **le bug #1** de ce repo. Cette doc cadre le workflow pour les éviter.

## Workflow obligatoire avant d'écrire du HTML / CSS

**Tout passe par le skill `/design-guidelines`** (`mode: html-prototype`) : il lit les specs du repo `agorapulse/design` et les packages sur le CDN, et porte les house rules que les specs ne disent pas. **Jamais le MCP `ds-css`**, retiré du repo.

1. **Trouver le composant par intention** (lookup du skill), puis ses classes CSS-UI dans `css-ui/index.css` du CDN — variantes / modifiers (`.stroked`, `.primary`, `.ghost`, `.transparent`, classes de couleur).
2. **Vérifier qu'une icône existe** dans `@agorapulse/ui-symbol@latest/icons/ap-icons.css`, classe complète (`ap-icon-eye` n'existe pas). Usage : `<i class="ap-icon-{name}"></i>`.
3. **Utiliser les tokens DS, pas des valeurs hardcodées** — chaque `--ref-*` / `--sys-*` doit exister dans `desktop_variables.css`. Les gris : `05 · 10 · 20 · 40 · 60 · 80 · 100 · 150`, rien d'autre. Jamais `padding: 20px` quand `var(--ref-spacing-sm)` existe. Jamais `#fff` quand `var(--ref-color-white)` existe.
4. **Préférer `--sys-*` à `--ref-*`** quand un token sémantique existe (text-color, border-color, état de composant).
5. **CSS custom uniquement si rien dans le DS ne convient** — choisir le bon fichier :
   - `styles/ds-patches.css` — la **seule** place pour étendre une classe DS avec une variante manquante (ex. `.ap-filter-chip`, `.app-modal-backdrop`) ou porter un composant que le DS ne ship qu'en Angular (ex. `.ap-filter-dropdown`). Doit rétrécir au fil que le DS évolue — et ça arrive : le port de `.ap-segmented-control` a été supprimé le jour où `/topics` est passé aux tabs, qui existent en CSS-UI.
   - `styles/screens/<screen>.css` — styling spécifique à un écran.
   - `styles/components/<component>.css` — styling partagé entre écrans.
   - **Jamais** redéclarer une classe `.ap-*` avec des overrides hors `ds-patches.css` — ça flippe la cascade silencieusement.
6. **Valider avant de commit** — `npm run check:ds` : tout token, icône et classe `.ap-*` doit se résoudre contre le DS `@latest`. Un nom inexistant échoue en silence.

## Tiers de tokens

| Tier       | Usage                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `--ref-*`  | Reference tokens (couleurs, spacings, fontes, radii) — la base brute du DS          |
| `--sys-*`  | Semantic tokens (text/border colors, états de composants) — **préférer ces tokens** |
| `--comp-*` | Component-level tokens — ne pas utiliser directement en CSS app                     |

Exception documentée : l'icône `sparklesMermaid` utilise un SVG inline pour son gradient (pas un token). Les couleurs brand tierces (connector accents, social logos) vivent en data dans JS, pas en tokens DS.

## Convention couleur — usage app-wide

| Couleur    | Usage                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| **Orange** | AI / spotlight actions — "Ask", "Try in chat", primary AI CTA, "+ New Playbook" |
| **Bleu**   | Routine list-page CTAs — Connect, Create, navigation                            |

Réutiliser les primitives partagées : ex. tous les filter chips utilisent `.ap-filter-chip` (driven par `aria-pressed`), le même chip qu'utilise le Ideas panel.

## Files DS (jsDelivr `@latest` — rien n'est vendorisé)

```
@agorapulse/ui-theme@latest/assets/
  desktop_variables.css       — design tokens (--ref-*, --sys-*, --comp-*)
  style/css-ui/font-face.css  — Averta font-face
  style/css-ui/index.css      — toutes les classes .ap-*
@agorapulse/ui-symbol@latest/icons/
  ap-icons.css                — icônes (mask-image sur <i class="ap-icon-*">)
```

Chargés par `index.html`. Il n'y a plus de dossier `ds/` ni de `scripts/sync-ds.mjs` (supprimés le 2026-09-30, passage en DS 22) : le package publié est la seule source, comme le veut le skill.

## Files app (en `styles/`)

```
styles/
  tokens.css        — tokens app-only (surface aliases, radius, mermaid accent)
  base.css          — resets, keyframes, app-wide token groupings
  layout.css        — app shell (sidebar / topbar / content / panel chrome)
  ds-patches.css    — la seule place légitime pour toucher .ap-*
  chat.css          — composer + thread chrome
  screens/          — analyse, batch-studio, caption-editor, clip-studio, connectors,
                      contexts, dashboard, image-studio-canvas, image-studio-v2,
                      modals, posts, session, topics, topics-settings, welcome
  components/       — add-source-modal, archie-loader, clip-card, connectors-modal,
                      conversation-status-card, feedback-control, right-panel,
                      schedule-modal, sidebar, social-post-card, subtitle-style,
                      top-post-card, topic-badge, topic-card, video-clips-modal,
                      workflow-flow
```

## Composants `.ap-*` les plus utilisés

| Classe                       | Variantes                                                       | Usage proto                          |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------------ |
| `.ap-button`                 | `.primary` `.stroked` `.ghost` `.transparent` `.danger` (patch) | CTAs                                 |
| `.ap-icon-button`            | `.stroked` `.transparent` `.lg` `.sm`                           | Boutons icon-only                    |
| `.ap-input` / `.ap-textarea` | —                                                               | Inputs                               |
| `.ap-card`                   | —                                                               | Conteneurs principaux                |
| `.ap-tag`                    | —                                                               | Tags texte (hashtags, kind)          |
| `.ap-badge`                  | —                                                               | Compteurs                            |
| `.ap-status`                 | `.green` `.orange` `.red` `.blue` `.grey` `.tagOrange`          | Pills de statut                      |
| `.ap-snackbar`               | —                                                               | Toasts (`toast.js`)                  |
| `.ap-filter-chip`            | `aria-pressed` driven                                           | Filtres (extension `ds-patches.css`) |

La liste exhaustive : le lookup du skill `/design-guidelines`, ou `css-ui/index.css` sur le CDN.

## Icônes

Toujours via la font icon DS : `<i class="ap-icon-{name}" aria-hidden="true"></i>`. 290 icônes disponibles. Tailles via classes `.xs` `.sm` `.md` `.lg`.

Pour les boutons icon-only, **mettre `aria-label` sur le bouton** et `aria-hidden="true"` sur l'icône enfant.

## Anti-patterns connus

- Redéclarer `.ap-icon-button`, `.ap-button` avec `border`/`background` custom → utiliser les modifiers DS (`.stroked`, `.transparent`, `.primary`, color variants).
- Ajouter `padding: 20px` sur `.step-card`, `.source-header`, etc. dans un view file → ces classes sont déjà stylées centralement.
- Couleurs hex, radii px-based, spacings px qui ne matchent pas les tokens.
- Inventer une icône quand `ap-icons.css` en a déjà une.
- Mettre `!important` pour résoudre un conflit de cascade — c'est presque toujours le signe qu'une ap-\* est override hors `ds-patches.css`.

## Vérification

`npm run check:ds` (`scripts/check-ds.mjs`) télécharge les trois fichiers du DS depuis jsDelivr `@latest` et vérifie que chaque token, icône et classe `.ap-*` utilisée dans `styles/`, `src/` et `index.html` y existe (ou est définie par l'app dans `styles/`). Il remplace l'ancien `validate_css` du MCP `ds-css`.

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — patterns de composants
- [`../../CLAUDE.md`](../../CLAUDE.md) — résumé pour agents
