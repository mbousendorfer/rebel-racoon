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
   - `styles/ds-patches.css` — la **seule** place pour étendre une classe DS avec une variante manquante (ex. `.ap-filter-chip`, `.app-modal-backdrop`) ou porter un composant que le DS ne ship qu'en Angular (ex. `.ap-filter-dropdown`). Doit rétrécir au fil que le DS évolue. Inventaire commenté : [`UI-PATTERNS.md` §1](UI-PATTERNS.md#1-stylesds-patchescss--linventaire-des--trous-du-ds-).
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

Exception documentée : `.ap-icon-sparkles-mermaid` est un masque peint en `currentColor` par le DS, donc gris ; hors d'un bouton, `ds-patches.css` le peint avec `--ref-color-mermaid-gradient-background`. Les couleurs brand tierces (connector accents, social logos) vivent en data dans JS, pas en tokens DS.

## Convention couleur — usage app-wide

| Couleur    | Usage                                                                                |
| ---------- | ------------------------------------------------------------------------------------ |
| **Orange** | AI / spotlight actions — "Ask", "Ask in a chat", primary AI CTA                      |
| **Bleu**   | Routine list-page CTAs — Connect, Create a Playbook, navigation, submits Quickpicker |

Réutiliser les primitives partagées : ex. tous les filter chips utilisent `.ap-filter-chip` (driven par `aria-pressed`). L'application au cas par cas (butter d'Archie, navy du fil, exceptions orange) : [`UI-PATTERNS.md` §5](UI-PATTERNS.md#5-convention-couleur-en-pratique).

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
  tokens.css        — tokens app-only (--app-* : surfaces, mesure, butter, navy, radius, ombres, z-index, graphes)
  base.css          — resets, keyframes partagées (app-spin / -rise / -grow-y / -shimmer / -focus-pulse), [hidden]
  fonts.css         — les fontes display de l'Image Studio (@font-face locales, OFL)
  layout.css        — app shell (sidebar / topbar / content / panel chrome)
  ds-patches.css    — la seule place légitime pour toucher .ap-*
  chat.css          — composer + thread chrome
  chat-legacy.css   — le fil d'avant newConversationStyles (body:not(.conv-new))
  screens/          — un fichier par écran (analyse, clips, home, insights-*, playbook-v2, topics, welcome…)
  components/       — un fichier par composant partagé (right-panel, sidebar, topic-card, draft-changes…)
src/modules/image-studio/styles/imst-*.css — les feuilles de l'Image Generator
```

## Composants `.ap-*` les plus utilisés

| Classe                                   | Variantes (DS 22)                                                                                                                                                                 | Usage proto                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `.ap-button`                             | `.primary` / `.secondary` (`.orange` `.blue`) ; `.stroked` (`.blue` `.grey` `.red`) ; `.ghost` (`.blue` `.grey` `.red` `.green`) ; `.transparent` ; `.mermaid` (bordure dégradée) | CTAs                                 |
| `.ap-icon-button`                        | transparent par défaut ; `.stroked`, `.blue` `.green` `.red`, `.loading`, `.locked` (pas de taille)                                                                               | Boutons icon-only                    |
| `.ap-input-group` / `.ap-textarea-field` | —                                                                                                                                                                                 | Inputs                               |
| `.ap-card`                               | —                                                                                                                                                                                 | Conteneurs principaux                |
| `.ap-tag`                                | —                                                                                                                                                                                 | Tags texte (hashtags, kind)          |
| `.ap-badge`                              | `.blue` `.orange`                                                                                                                                                                 | Compteurs                            |
| `.ap-status`                             | `.green` `.orange` `.red` `.blue` `.grey` `.tagOrange` ; `.mermaid` (patch)                                                                                                       | Pills de statut                      |
| `.ap-snackbar`                           | —                                                                                                                                                                                 | Toasts (`toast.js`)                  |
| `.ap-filter-chip`                        | `aria-pressed` driven                                                                                                                                                             | Filtres (extension `ds-patches.css`) |

La liste exhaustive : le lookup du skill `/design-guidelines`, ou `css-ui/index.css` sur le CDN.

## Icônes

Toujours via les icônes DS : `<i class="ap-icon-{name}" aria-hidden="true"></i>` — un masque (`mask-image`) peint en `currentColor`, pas une fonte. ~240 icônes dans `ap-icons.css`. Tailles : `.ap-icon-xxs` … `.ap-icon-xxxl` (dont `-xs` `-sm` `-md` `-lg` `-xl`), sur les tokens `--sys-icon-css-*`.

Pour les boutons icon-only, **mettre `aria-label` sur le bouton** et `aria-hidden="true"` sur l'icône enfant.

## Anti-patterns connus

- Redéclarer `.ap-icon-button`, `.ap-button` avec `border`/`background` custom → utiliser les modifiers DS (`.stroked`, `.transparent`, `.primary`, color variants).
- Redonner un `padding` à une classe partagée depuis la feuille d'un écran → elle est déjà stylée dans son fichier de composant ; ajouter une variante là-bas.
- Couleurs hex, radii px-based, spacings px qui ne matchent pas les tokens.
- Inventer une icône quand `ap-icons.css` en a déjà une.
- Mettre `!important` pour résoudre un conflit de cascade — c'est presque toujours le signe qu'une ap-\* est override hors `ds-patches.css`.

## Vérification

`npm run check:ds` (`scripts/check-ds.mjs`) télécharge les trois fichiers du DS depuis jsDelivr `@latest` et vérifie que chaque token, icône et classe `.ap-*` utilisée dans `styles/`, `src/` et `index.html` y existe (ou est définie par l'app dans `styles/`). Il remplace l'ancien `validate_css` du MCP `ds-css`.

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — patterns de composants
- [`../../CLAUDE.md`](../../CLAUDE.md) — résumé pour agents
