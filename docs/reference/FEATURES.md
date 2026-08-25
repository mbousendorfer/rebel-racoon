# Features — catalogue fonctionnel

> Inventaire exhaustif de **ce que fait l'app** du point de vue produit : chaque feature, son entrée, son flow, ses états. Compagnon fonctionnel de [`ARCHITECTURE.md`](ARCHITECTURE.md) (le _comment_ technique) et de [`ROUTES.md`](ROUTES.md) (la carte des écrans).
>
> Tout est **mocké** : pas de backend, pas de réseau, pas de persistance d'état app. Les « analyses », requêtes connecteurs, envois de bug/feedback et générations sont simulés par des timers. Les copies UI citées sont **verbatim** du code.

## Le pipeline

Archie transforme des **Sources** en **Ideas**, puis en **Drafts** (posts), puis en posts **planifiés** — le tout depuis un chat conversationnel.

```
Source → Idea → Draft (post) → Schedule
   │                          ▲
   └── vidéo → Clips ─────────┘  (les clips deviennent aussi des drafts)

Listening source → Topic ──→ (chat) ──┘   (flag `topics`, voir §17)
```

Le **Topic** est un embranchement amont **optionnel** : Archie n'attend plus qu'on lui donne une source, il en propose une. Une Idea peut toujours venir directement d'une Source.

Vocabulaire : un **Playbook** (label UI) = un **Context** (code/store). Voir [`GLOSSARY.md`](GLOSSARY.md).

---

## 1. Chat & assistant

Surface principale, sur `#/session/:id` ([`screens/session.js`](../../src/screens/session.js), le plus gros fichier). Un panneau assistant plein-largeur : thread scrollable en haut, composer docké en bas. L'état du thread est un store en mémoire par session ([`assistant.js`](../../src/assistant.js)), sans persistance.

### Thread & turns

| Feature                      | Comportement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero « New chat »**        | Avant le 1er turn : wordmark Archie animé, sous-titre _« Drop a source — I'll turn it into a batch of ready-to-schedule posts, all from one chat. »_, composer **inline dans le hero**, puis — sous flags — le rail _« What I'm hearing »_ (§17), et enfin _« Or jump into a workflow »_ + grille de **starter cards** (`mocks.chatStarters`). Cartes prompt-injection (préremplissent le composer) ou action (`open-video-clips`, `open-batch`, `open-top-posts`). Placeholders `{{source}}` / `{{video-source}}` résolus au render. |
| **Greeting**                 | Thread frais : une bulle Archie. Avec Playbook : _« Hi. Want me to compare ideas, pick the strongest one, or draft a post?… »_ ; sans : _« Hi. I'll help you pick sources, sharpen ideas, and draft posts… »_. Sauté si un start-flow est en file, et pour les sessions `welcome-alt-*` / `clip-studio-*`.                                                                                                                                                                                                                            |
| **Échange user → AI**        | 3 turns : bulle « You », notice **« Thinking »** (mermaid, collapsible, _« Analyzing your request and sources… »_), puis bulle AI révélée après ~6 s. Réponse scriptée par intention (`mockAiReply`). Les prompts « batch » produisent en plus un batch de 5 drafts.                                                                                                                                                                                                                                                                  |
| **Notices collapsibles**     | `<details>` avec pill mermaid ou grise (`postSystemNotice` / `markSystemNoticeReady`, ex. « Extracting guidelines »). ⚠️ **Aucun appelant aujourd'hui** — le producteur et les deux branches de rendu existent, rien ne les déclenche.                                                                                                                                                                                                                                                                                                |
| **Source-intake turn**       | Chip compact « Source intake » (icône kind + nom + slot d'état). Loading → spinner « Uploading » ; ready → pills tappables _« N ideas › »_ / _« M clips › »_ (vidéo) ou check vert. Piloté par [`intake-lifecycle.js`](../../src/screens/session/intake-lifecycle.js).                                                                                                                                                                                                                                                                |
| **Idea-extraction turn**     | Pill _« Extracted N idea(s) »_ + cartes idée compactes (feedback pouce, « Why this idea », Mention, Draft).                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Draft-result turn**        | `postDraftResult` : anchor **non rendu inline**. Un nouveau draft ouvre le panneau Drafts sur le batch + status bar verte _« N drafts ready »_ + toast.                                                                                                                                                                                                                                                                                                                                                                               |
| **Clip-extraction turn**     | Pill spinner → carte résultat « Open clips » quand l'extraction background finit.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Selection echo**           | Le choix de l'utilisateur reste visible sous forme de carte/chip (source, idée, clip, langue, profils, top-post). Voir mémoire _selection-echo-pattern_.                                                                                                                                                                                                                                                                                                                                                                              |
| **Connect-a-service prompt** | Coller un lien vers un connecteur non connecté (Slite/Notion/Google Docs) affiche une carte « Not connected » + boutons **Connect / Cancel**. Connect → statut vert _« <Name> connected — importing… »_.                                                                                                                                                                                                                                                                                                                              |
| **Chat-switch skeleton**     | ~340 ms de bulles shimmer en changeant de chat démarré.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Watchdog loading**         | Un turn coincé en `loading` > 30 s déclenche un toast _« This is taking longer than expected… »_ ([`thinking-chip.js`](../../src/screens/session/thinking-chip.js)).                                                                                                                                                                                                                                                                                                                                                                  |
| **Requête connecteur (MCP)** | Avec un connecteur attaché : `sendConnectorMessage` simule un aller-retour MCP (notice _« Querying <Name> via MCP »_ + trace d'outils) puis une réponse citée.                                                                                                                                                                                                                                                                                                                                                                        |

Rendu des turns : [`screens/session/thread-turns.js`](../../src/screens/session/thread-turns.js).

### Composer

- **Champ** : textarea auto-size 2 lignes, placeholder _« Ask a follow-up, or refine a draft… »_. Toolbar : **Add** · **Reference (@)** · **Playbook** · **Send** (orange). Hint _« Enter to send · Shift+Enter for new line · Drop a file to attach a source »_.
- **Envoi** : Send, **Enter**, ou **Cmd/Ctrl+Enter** ; **Shift+Enter** = newline.
- **Menu Add** : _Add PDF · Add video · Add URL · Paste text_ — puis _Top performing posts_ — puis (flag `connectors`) flyout **Connected sources** + « Browse connectors ».
- **Contrôle Playbook** : sur chat neuf = dropdown sélectionnable (+ « Create a playbook ») ; sur chat actif = indicateur statique.
- **@ Reference (mentions)** : picker flottant listant sources prêtes + idées ; pick → pill (couleur par kind). Nav clavier ↑/↓/Enter/Esc. Chips gérés par [`composer-mentions.js`](../../src/composer-mentions.js).
- **« / » commande (connecteurs)** : liste les connecteurs connectés en action-dropdown ; pick → attache au composer.
- **Chip connecteur** : demander un connecteur attache un chip removable + swap placeholder _« Ask {name} anything… »_. ([`composer-connector.js`](../../src/composer-connector.js))
- **Status bar** : un slot réconcilié au-dessus du composer. Gris in-progress (loader + label) prioritaire sur vert « ready » (_« N drafts ready to review »_ + **Review**, _« N ideas ready »_ + **View ideas**). Animations enter/exit, reduced-motion aware.
- **Drag & drop** : déposer un fichier sur le panneau lance l'upload ; fichier non classable → modal Add-source.

### Flows conversationnels

Chaque flow échoe les choix, gère Back/Skip, et pousse des turns via l'assistant. Orchestrateurs dédiés :

| Flow                                   | Fichier                                                   | Résumé                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Action-picker intro**                | [`start-flow.js`](../../src/start-flow.js)                | Ouvrir un chat avec Playbook → _« Welcome back. {Playbook} is attached — what do you want to do? »_ + choix _Add a source / Browse sources / Compare ideas / Draft a post_.                                                                                                                              |
| **Draft-a-post-from-idea**             | [`draft-flow.js`](../../src/draft-flow.js) + `session.js` | Chaîne : (langue si multilingue) → **angles** (_« Suggested angles »_ : « The contrarian take », « A practical how-to », « The behind-the-scenes story », « The data-backed proof ») → **profil** → génération (~6 s) → draft-result. Variantes : _« How many drafts? »_ (1/3/5), _« Which channels? »_. |
| **Regenerate / rewrite**               | [`draft-rewrite.js`](../../src/draft-rewrite.js)          | 3 phases sur la carte post : **thinking** (skeleton) → **streaming** (fade mot-à-mot) → **commit**. Intentions : _shorter / longer / warmer / formal / fresh_. Posts planifiés verrouillés.                                                                                                              |
| **« What to know about this source »** | `session.js` `askWhatToKnow`                              | _What's the main takeaway? / Summarize in 3 bullets / Find a contrarian angle_ + texte libre.                                                                                                                                                                                                            |
| **Video-intake choice**                | `session.js` `askVideoIntake`                             | Vidéo processée → _Analyze for ideas_ ou _Extract & create clips_.                                                                                                                                                                                                                                       |
| **Draft-from-clips**                   | `session.js` `startClipDraftFlow`                         | **aspect ratio** (tiles 16:9/9:16/4:3/1:1/4:5) → **sous-titres** (grille 3×3 de presets « Make it Pop ») → **compte(s)** → un draft par (clip × compte).                                                                                                                                                 |
| **Repurpose posts publiés**            | `session.js` `startRepurposeFlow`                         | Stepper par profil : versions par profil (network source pré-tagué « · Source »).                                                                                                                                                                                                                        |
| **Section-edit Playbook**              | `session.js` `startSectionEdit`                           | Confirm → wizard mono-stage → bump timestamp → _« {Section} updated in every chat… »_.                                                                                                                                                                                                                   |

### Pickers & wizards

- **Inline single-question** ([`inline-question.js`](../../src/inline-question.js)) : « pick one of N » réutilisable. Modes : single, single-with-confirm, multi, **stepper** (± par ligne, « Generate N »), free-text, file-dropzone, `variant:"cards"` (grille preview). Intro/title/subtitle, Skip/Back, état loading. **C'est le Quickpicker** — voir mémoire _use-quickpicker-not-choice-chips_.
- **Choice-turn chips** (`assistant-choice`) : picker in-thread avec chips (single/multi, preview-rich, `instant`), bouton Submit.
- **Sidebar wizard** ([`sidebar-wizard.js`](../../src/sidebar-wizard.js)) : construit les sections **Voice / Brief / Brand** du Playbook (intake → recap → confirm), avec étape Save (nommer / titre du chat).
- **Clavier** ([`wizard-keyboard.js`](../../src/screens/session/wizard-keyboard.js)) : **↑/↓ navigate · 1–9 pick · Enter submit · Esc exit**, rebindé après chaque swap de panneau.

---

## 2. Sources

Store **global** [`sources-stream.js`](../../src/sources-stream.js) (uploads + machine à états). Per-session via [`library.js`](../../src/library.js) `getSources`.

### Ajouter une source — modal ([`add-source-modal.js`](../../src/components/add-source-modal.js))

Dialog mono-méthode (le titre reflète la méthode). Entrées : panneau Sources « Attach source », menus `+`.

- **Upload** : dropzone _« Drop files here, or »_ / _« PDF, Word, text, video, audio, images · Up to 100MB per file »_. Accepte `.pdf,.doc,.docx,.txt,.md,.mp4,.mov,.mp3,.wav,.m4a,.png,.jpg,.jpeg`. Multi-fichiers. Ligne par fichier : _« Uploading NN% »_ → pill bleu **Processing** → pill vert **Ready**.
- **URL** : label _« Paste a URL »_, placeholder `https://example.com/article`. Reconnaissance de service live (logo + _« I recognised a <service> link — I'll import it. »_). Validation blur _« URL must start with http:// or https:// »_. Toast _« Link added — I'll fetch it now. »_. Lien connecteur non connecté → connect-prompt in-chat.
- **Paste text** : textarea + _« Paste from clipboard »_, char count live. Toast _« Text added — I'll read it now. »_.
- **Connectors** (flag `connectors`) : connecteurs connectés + « Browse » ; sub-écran browse avec cases par doc, « Select all », dossiers _« Folder · imports N files »_ (cap `FOLDER_BATCH_CAP` = 8), « Import N sources ».

### Machine à états du traitement

Classification par extension ([`file-kinds.js`](../../src/file-kinds.js) + `classifyFile`) : PDF, Word, Text, Video, Audio, Image. Rejette inconnu (_« Unsupported file type »_) et > 100 MB (_« File too large »_).

```
upload (uploading, progress 0→100% ~2s)
  → Source status:"Processing" signal:"Pending"
  → [ticker granulaire ~200ms] Extracting content → Reading content → Identifying ideas → Mining hooks & quotes → Finalizing
  → après ~6s : status:"Processed" + signal aléatoire
```

- **URL / Paste / Connector** : sautent l'upload, directement en Processing.
- **Ticker** : pour Video/Audio, « Reading content » s'affiche _« Transcribing audio »_. Barre fine + _« <stage> · ~Ns left »_ + pill mermaid « AI is working ».
- **Signals** (`randomSignal`, skew Medium) : **High** (orange) / **Medium** (tagOrange) / **Low** (grey). Non-vidéo → 2–6 idées immédiates. **Vidéo → diffère** idées ET clips au choix post-upload (`ideaCount` = 0). Sources réutilisées → signal « Reused ».
- **Toasts** : vidéo toujours _« <name> ready »_ ; non-vidéo _« <name> ready · N ideas extracted »_ derrière flag `statusActionSnackbars`.
- **Cancel** : `cancelUpload` jusqu'à Done.

### Cartes & actions

- **Source card** ([`source-card.js`](../../src/components/source-card.js)) : box teintée par kind, nom, sous-ligne _« N ideas · <status> · Added <when> »_. Actions **Ask**, **Reference** (session), pill processing, menu **Extract more ideas** / **Delete source**.
- **Row panneau** : + kebab (vidéo : « View clips (N) », « Edit name », « Reanalyze », « Delete source »). Les rows processées listent leurs idées en liens cliquables (jump + pulse).
- **Bulk / per-row** ([`library-actions.js`](../../src/library-actions.js)) : bulk bar « N sources selected » → _Extract more ideas / Delete_. Extract → task background ~1.6 s, 1–2 idées par source (templates rotatifs). Delete → confirm _« Delete <filename>? … Ideas backed by other sources stay. »_ + cascade. Rename (modal partagé). Reanalyze (stub toast).

---

## 3. Ideas

Store **per-session** [`library.js`](../../src/library.js). Idée = title, hook/body, **kind** (hook/stat/quote/story/insight), rationale (« Why this idea »), relevance/confidence (→ potential label), channels, sourceIds, pinned. Seedées seulement pour sessions démo (returning mode) ; chats neufs vides.

### Cartes idée

- **Full** ([`idea-card.js`](../../src/components/idea-card.js)) : pill potential (High ≥80 vert / Medium ≥60 orange / Low grey), badge kind, hook, hashtags (max 4), toggle « Sources », menu **Pin/Unpin**, **Draft post**, **Reference**.
- **Compact** ([`idea-card-compact.js`](../../src/components/idea-card-compact.js)) : tag kind, chip « Source: », « Why this idea », feedback pouce, Reference, Draft.

### Content workspace ([`content-workspace.js`](../../src/components/content-workspace.js))

Layout Sources+Ideas partagé (dashboard + onglet Content en session). Search _« Search sources and ideas… »_, sort (Highest potential / Newest / Source / Workflow state), onglets **By source** / **All ideas** avec compteurs. Bulk bar idées : « N ideas selected » → Delete.

---

## 4. Drafts / Posts

Store **per-session** [`posts-store.js`](../../src/posts-store.js). Draft = author, network (X→"twitter"), status:"ready", language, text[], hashtags, CTA, stats, optionnel `clipRef` (PIP vidéo), `subtitleStyle`, `format`.

### Post card ([`post-card.js`](../../src/components/post-card.js)) — preview LinkedIn-style

- **Structure** : bloc auteur, provenance pill, corps + hashtags (liens `#tag`) + CTA, media, stats, footer déco « Like/Comment/Repost/Send » (non-interactif).
- **Char counter** par network (LinkedIn 3000, X 280, IG 2200, FB 63206, TikTok 2200, YT 5000) → rouge si dépassé.
- **Media** : clip (faux player, gradient, play, durée, scrubber 24%, badge sous-titres) / image
  (_Edit_ → studio · _Change_ → file picker · _Remove_) / **fente vide** (`.posts__card-media-empty`) :
  un cadre pointillé de 128px avec l'icône `ap-icon-image`, « Generate an image » (`.ap-button.mermaid`,
  génère **en place**, sans studio) et un « Upload » ghost grey. La fente ne réserve **pas** le ratio 4/3
  de l'image : tous les drafts seedés démarrent sans média, et un cadre pleine hauteur par carte
  transformerait le feed en colonne de trous. Rien n'y est cliquable hors les deux boutons — pas de
  hover, pas de drop-zone.
- **Hint de brand kit** : si le Playbook du chat n'a ni logo, ni couleurs, ni images de référence
  (`getBrandKitGaps` dans [`contexts-store.js`](../../src/contexts-store.js) — dérivé, jamais stocké),
  une ligne `.muted` sous la fente **nomme ce qui manque** et propose `Open the Playbook` (`.ap-link`,
  navigation → bleu, pas orange). Affichée **une seule fois par feed**, sur le premier draft sans
  média : ce qui manque est un fait du Playbook, pas de ce draft-là.
- **Actions** : Reference · Edit (flag `draftInlineEdit`) · **Regenerate** (menu _Shorter/Longer/Warmer/More formal/Regenerate_) · Save as draft · Schedule · Delete. Toutes désactivées pendant régénération.
- **Inline edit** : corps → contenteditable, Save/Cancel, auto-commit outside-click, Esc annule, Cmd/Ctrl+Enter save.
- **needs_fixes** : infobox rouge listant `post.errors`. Strip feedback « How's this draft? ».

### Panneau Drafts ([`right-panel.js`](../../src/components/right-panel.js) `renderDraftsView`)

- **Onglets statut** : All drafts / Needs fixes. **Dropdown network**.
- **Feed groupé par network** (LinkedIn, X, IG, FB, TikTok, YT). Chaque **band réseau** = header + toolbar bulk (click = select-all du réseau) → _Save as drafts / Schedule / Delete_. Bulk scheduling **scopé network** (batch toujours valide).
- **Empty** : « No drafts yet » / filtré « No drafts match this filter ».
- Handlers par carte : rewrite, save, schedule (→ modal, sort des Drafts au confirm), delete, image, « Edit clip » (rouvre le modal clips en mono-clip), mention.

---

## 5. Scheduling

Store [`schedule-store.js`](../../src/schedule-store.js) : file upcoming, `getQueue` (tri asc), `getQueueOn(day)`, `busyCountsByDay` (dots calendrier), `addToQueue`.

### Modal Schedule ([`schedule-modal.js`](../../src/components/schedule-modal.js)) — 960px, deux colonnes

- **Titre** _« Schedule N draft(s) »_. Sous-titre selon single/multi.
- **Mode** (radio cards) : **Optimal times** (sparkles) / **Custom**.
- **Stratégie (Optimal)** : chips cadence _Every weekday / 3× a week / Twice a week / Every other day / Once a week_ + free-text _« Or describe your own strategy »_ (parse morning/afternoon/evening + « avoid <weekday> »). « Starting from » (défaut demain). **« Compute best times »** (seule action qui expand la stratégie ; 1.6 s loading). Schedule désactivé tant que non computé.
- **Moteur Optimal** : parcourt les jours matchant la cadence, saute les weekdays évités ET jours déjà occupés ; une date par draft à la meilleure heure du network (`PER_NETWORK_OPTIMAL`). Overflow empilé sur le dernier jour.
- **Slot list** : carte par draft (tag network + 1re ligne + `datetime-local` + ✕). Multi : **drag-to-reorder** (les dates suivent l'ordre). Éditer une heure → bascule Custom.
- **Calendrier** (droite) : grille mois, dots « This batch » (accent) + « Already scheduled » (gris), click jour → liste combinée. Vide → _« No posts on this day — a good window to schedule. »_.
- **Footer** : Clear all dates · disclosure _« Posts will publish to your connected accounts. »_ · Cancel · **Schedule N posts**. Succès → toast _« N post(s) scheduled »_.

---

## 6. Video clips

### Extraction & formats

- Chaque vidéo processée reçoit un set de **5 clips** (`EXTRACTED_CLIPS_TEMPLATE`) : opening hook, live demo, headline stat, contrarian POV, closing line — chacun start/end, hue, summary, why, network, tags.
- **Machine à états** (`extractClipsForSource`, ~7.5 s, `clipExtractionStatus` undefined → "extracting" → "ready") : _Transcribing audio → Detecting highlights & hooks → Scoring moments → Cutting clips → Generating captions_.
- **Catalogue ratios** ([`clip-formats.js`](../../src/clip-formats.js)) : 9:16 Vertical, 4:5 Portrait, 1:1 Square, 4:3 Standard, 16:9 Landscape + sets recommandés par network.

### Surfaces

- **Clip card** ([`clip-card.js`](../../src/components/clip-card.js)) : thumbnail (gradient + `<video>` au start), tag « clip » + source, menu Edit/Remove, « Why this clip », feedback + Reference + Draft.
- **Panneau Clips** (`renderClipsList`) : agrège tous les clips de la session, auto-flip vers Clips au 1er clip, checkbox par clip, band bulk (« Draft post(s) » + delete), bulk delete avec **Undo**.
- **Modal Video Clips** ([`video-clips-modal.js`](../../src/components/video-clips-modal.js)) — éditeur VEED-like (timeline strip, 3 états **Browse / Edit / Add**). Edit : rail « Clip » / « Subtitles », preview au ratio, transport (±5s, play), In/Out steppers, « Trim » pro-trimmer (filmstrip + waveform, MIN 5s MAX 300s). Subtitles : Style (Presets/Font/Effects) + Transcript. Mono-clip mode (depuis Edit d'un clip ou « Edit clip » d'un draft). Rendu captions : [`caption-editor.js`](../../src/caption-editor.js) + [`clip-captions.js`](../../src/clip-captions.js).

---

## 7. Images

### Image Studio ([`components/image-studio-v2/`](../../src/components/image-studio-v2/))

Modale near-fullscreen, deux modes pairs (**Generate** / **Edit**, tabs DS). Un header d'une ligne
(titre · les deux modes), un **stage pleine largeur**, un **composer en bas**, un footer qui porte
l'unique action de sortie. Les réglages vivent dans un **panneau épinglé à gauche du stage** —
à côté de l'image qu'ils décrivent, sur le bord que la palette d'outils d'Edit réutilise, si bien que
changer de mode échange les contrôles sur place au lieu de les envoyer à l'autre bout de la modale.
Le **chutier des variations** garde le bord droit.

**Entrées** (les seules — pas de route, pas de raccourci) :

- _« Edit »_ sur un draft avec **une seule** image (`data-post-image-edit`) → ouvre directement en
  Edit sur cette image (option `editImageUrl`). C'est **l'entrée principale** depuis que
  « Generate an image » génère en place.
- _« Edit slides »_ sur un draft **carousel** (`data-post-image-edit`, même attribut) → rouvre le set
  dans les résultats (ajouter / retirer / régénérer une slide).
- ⚠️ _« Generate an image »_ (`data-post-image`) **n'ouvre plus le studio** : il génère une image en
  place via `quickGenerateUrl` ([`image-studio.js`](../../src/image-studio.js)) — même mock Picsum
  seedé, ratio par défaut du réseau, aucun état de studio créé. Le studio est là pour _piloter_ une
  image ; payer un modal plein écran pour appuyer sur un bouton était le chemin long. Un nonce de
  module fait qu'un second appui donne une autre image.

Tout passe par `openStudio` dans [`right-panel.js`](../../src/components/right-panel.js).
`data-post-image-upload` court-circuite le studio (simple file picker).

### Moteur d'état ([`image-studio.js`](../../src/image-studio.js))

UI-agnostique, `Map(key → state)` + subscribers, **tous les mocks dedans**. Les vues n'ont aucun état
propre : chaque mutation notifie et le corps de la modale est **entièrement re-rendu**. Latences
mockées : génération `~4,2 s`, édition IA `~2,6 s`, dérivation du brief `~2 s`.

Les helpers canvas purs (bake / crop / métriques de texte) vivent à part dans
[`image-studio-canvas.js`](../../src/image-studio-canvas.js) — c'est le seul import que le moteur
prend côté rendu, et il est délibéré : « Text in image » est mocké en cuisant les mots dans les pixels
avec **le même aplatisseur** (`compositeOverlays`) que les overlays du mode Edit.

### Generate — le brief

À l'ouverture, Archie **dérive le prompt du texte du draft** (`runDerive`, ~2 s) : le champ arrive
rempli d'un brief structuré (`Subject:` / `Look:` / `Palette:` / `Visual direction:`). Le composer est
une **carte centrée**, pas une barre pleine largeur : à 1440px un champ full-bleed fait ~180
caractères par ligne, et ça faisait lire les réglages comme du mobilier échoué en bas d'une grande
barre. Le champ plafonne à **4 lignes** puis scrolle (un brief dérivé en fait sept, et le laisser haut
de sept faisait du composer le plus gros objet de la modale alors que c'est l'image qu'on juge) ; le
plafond vaut exactement `4 × line-height`, parce que le scrollport d'un textarea couvre son contenu ET
son padding et qu'il n'y a pas de padding en haut. Le toggle d'expansion double le plafond.

**Generate est `secondary blue`** : c'est une étape, pas la destination. L'unique primary de la modale
est _« Use this image »_ dans le footer, présent **dès la première frame** (désactivé jusqu'à ce qu'il
y ait quelque chose à valider) — la destination est visible tout du long au lieu d'apparaître quand
les résultats tombent.

Stage : `empty → generating (~4,2 s) → résultats` (grande image + chutier), avec une bascule
**Image / In feed** (aperçu réel via `renderPostCard`).

### Le prompt édité à la main est protégé

**Type** et **References** ne retouchent pas une ligne du brief, ils le **re-dérivent
entièrement** (`~600 ms`, un loader court — un chip doit répondre tout de suite, pas au bout des
2 s de l'ouverture). C'est légitime tant que le brief appartient à Archie. Dès que l'utilisateur a
tapé dans le champ, le même clic jetterait ses mots — alors il demande d'abord.

- **Le sale se mesure par rapport au dernier texte que le studio a écrit** (`derivedPrompt`), pas à
  « une frappe a eu lieu » : taper un mot puis le supprimer laisse propre. Vider le champ compte
  comme une édition.
- **Prompt intact → aucun avertissement**, le brief est simplement réécrit. C'est ce qui répare la
  divergence : avant, l'en-tête affichait « Infographic » pendant que le brief décrivait encore un
  visual hook.
- **Prompt édité → une confirmation** (`prompt-guard.js`), qui **nomme le réglage touché**
  (_« Changing the image type rewrites it from your settings »_). Deux issues : **Rewrite prompt**
  applique le réglage et réécrit, **Cancel** n'applique **rien** — le chip revient où il était. Une
  case _« Don't ask again while this studio is open »_ coupe l'avertissement pour la durée de
  l'ouverture (`exit(KEY)` la remet à zéro : silencier une action destructive ne survit pas à la
  session).
- **Un filet, même quand l'avertissement est coupé** : toute réécriture qui a remplacé du texte
  écrit à la main propose un **Undo** dans un toast, qui restaure le brief précédent.
- **Un upload n'est jamais jeté par une confirmation.** Le drop entre dans le vivier
  inconditionnellement ; seule la **sélection** est gardée. Annuler laisse donc l'image disponible,
  non choisie.
- Les six chemins gardés : le Type, le switch _« Use a reference image »_, la tuile, l'ajout, le
  retrait de l'image **en jeu**, et le mode `REF_MODES`. Retirer une image non sélectionnée ne
  réécrit rien, donc ne demande rien.
- **Les couleurs de marque restent hors périmètre** : elles éditent leur seule ligne `Palette:` en
  place plutôt que de re-dériver, et **se retirent du jeu quand le prompt est édité**
  (`syncPaletteLine`) au lieu d'écraser une ligne que l'utilisateur a peut-être écrite. Le switch
  gouverne toujours la dérivation suivante.
- Style, Format et Text in image, eux, **ne réécrivent toujours pas** le brief après l'ouverture :
  leur ligne reste celle de la dérivation initiale. Divergence connue et assumée.

> ⚠️ La confirmation n'est **pas** `confirm-modal.js`. Celui-ci s'enregistre auprès de
> `modal-coordinator`, et `requestOpen` ferme l'overlay actif — ici le studio, dont le `close()`
> exécute `exit(KEY)` et supprime toute la session. Un « tu vas perdre ton prompt ? » qui perd le
> studio entier est pire que le problème qu'il signale. Elle est donc rendue **dans** le corps du
> studio, depuis l'état, hors coordinateur — et par conséquent : ses touches sont écoutées sur
> **`document` en capture** (Échap avec le focus hors de la modale ne passerait jamais par
> l'élément), et `bindOverlayDismissal` reçoit un `isOpen` qui **se désarme** tant qu'une question
> est en attente, pour qu'Échap ou un clic sur le scrim ne puissent pas fermer le studio par-dessous.

### Generate — les sept réglages

Chaque réglage est une section `.ap-accordion` — **la classe DS, pas le comportement**. Les sections
sont **indépendantes** : une section ouverte le reste, et en ouvrir une seconde ne referme pas la
première. Un-à-la-fois gardait le panneau court mais interdisait de voir deux réglages ensemble et
refermait dans le dos de l'utilisateur. L'état est `collapsedGroups`, un Set de ce qui est **fermé** —
ce qui rend à `openPopover` son seul sens : les flyouts du mode Edit, eux réellement exclusifs.

L'ordre dit un raisonnement : **ce qui va DANS l'image**, puis son **traitement**.

- **References** ([`references-view.js`](../../src/components/image-studio-v2/references-view.js)) —
  épinglée ouverte, en-tête sans chevron (une section qu'on rouvre à chaque visite ne devrait pas
  être une section à ouvrir ; son en-tête cesse alors d'être un contrôle). **Une seule image de
  référence**, prise indifféremment dans le brand book du Playbook ou dans les uploads : le marqueur
  de tuile est donc un **radio**, pas une coche — une coche promet qu'on peut cumuler. `aria-pressed`
  et non `role="radio"`, parce que le contrat est single-select-avec-toggle-off et qu'un groupe radio
  ne sait pas revenir à vide.
  Côté état, `playbookRefs` et `uploadedRefs` sont deux **viviers**, `selectedRefId` est le choix, et
  `referenceImages` reste un tableau de 0 ou 1 **dérivé** par `syncSelectedRef()` — parce que le
  prompt, la seed de génération et le verrou du Style preset lisent tous « les références en jeu »
  sans se soucier du nombre. `MAX_REFS` (6) borne le vivier d'**uploads**.
  Un switch _« Use a reference image »_ possède l'état « aucune » : générer sans référence est un vrai
  choix, et il n'était atteignable qu'en re-cliquant la tuile choisie. **Off masque la grille** (le
  switch EST la disclosure) et **mémorise le choix** (`lastRefId`).
  Chaque vivier est **libellé par sa provenance** (`Brand book — Acme` / `Custom`), même quand il n'y
  en a qu'un : c'est la seule chose qui dise que ces images viennent du brand book, et nommer le book
  nomme le standard auquel l'image générée est tenue. Tiret cadratin, pas point médian — un nom de
  Playbook en contient déjà.
  **« How to use it »**, en bas et seulement quand une image est choisie (une sous-option qui survit à
  son sujet est un contrôle qui ment). Trois modes (`REF_MODES`, `blend` par défaut) : **Layout**
  (reproduire composition et cadrage), **Blend** (le look, plus un écho léger d'un élément),
  **Style only** (palette, texture, traitement — aucune composition). « Match this image » faisait
  beaucoup de travail non dit : reproduire une composition et emprunter une palette sont deux métiers.
  La bande de vignettes est un **scroller horizontal**, pas une grille qui wrappe : un vivier qui
  wrappe grandit d'une rangée à la fois et pousse le composer hors de l'écran à dix images. Exactement
  `VISIBLE_REFS` (3) tuiles rentrent, donc aucune quatrième ne dépasse pour signaler qu'il y en a
  d'autres, et macOS cache sa scrollbar overlay ; au-delà de 3 le groupe reçoit `.is-scrollable`, qui
  allume un **fondu de bord piloté par la position de scroll**. Le fondu anime deux **propriétés
  personnalisées enregistrées** (`@property --isv2-fade-l/r`, typées `<length>`) et non `mask-image`
  directement : un gradient non enregistré s'interpole de façon discrète dans Chrome, donc le masque
  basculait de côté en une frame à mi-course.
  Valeur d'en-tête : la **provenance**, plus le mode s'il n'est pas le défaut (`Acme · Layout`) — un
  résumé doit rapporter un choix que l'utilisateur a fait.
- **Text in image** — les mots qu'Archie écrit **DANS** l'image (à ne pas confondre avec le bloc de
  texte déplaçable d'Edit ; un ⓘ dans l'en-tête porte cette distinction). Mocké en cuisant le texte
  dans les pixels de la variation, donc il survit aux vignettes, à l'aperçu in-feed, au recadrage, au
  « Redraw » et au draft final. **Pas de compteur permanent** : le champ ne dit rien tant que le texte
  tient, et lève un `.ap-form-message error` du DS quand il dépasse (_« 14 characters over — long text
  comes out small in the image. »_). C'est une limite de **lisibilité**, pas de données : ~90
  caractères est ce qui reste lisible dans une image générée, et au-delà la typo sort juste plus
  petite — le champ prend donc ce qu'on écrit, le dit, et ce qu'on a écrit est cuit. La copie vit dans
  `renderTextOverMessage` (moteur) et non dans une vue, parce que le premier rendu et chaque frappe la
  demandent depuis deux modules et ne doivent pas la formuler autrement.
- **Branding** ([`branding-view.js`](../../src/components/image-studio-v2/branding-view.js)) — **deux
  interrupteurs, pas un** : _« Show my logo on the image »_ et _« Use brand colors »_. Le logo et la
  palette sont deux impositions différentes : beaucoup de posts veulent les couleurs de la marque sans
  son wordmark dans un coin, et un visuel de lancement peut vouloir la marque sur l'artwork de
  quelqu'un d'autre — un seul interrupteur prenait la moitié bon marché en otage de la moitié chère.
  Les deux sont **ON par défaut** quand le Playbook a de quoi ; un interrupteur sans matière reste
  **visible mais désactivé** avec la raison dessous (_« This Playbook has no logo yet. »_), parce
  qu'un contrôle qui disparaît laisse se demander si l'option existe.
  **Pas de réglage de placement, juste un aperçu du logo** : la marque atterrit en bas à droite, point
  (`BRAND_MARK` : `xF 0.78 / yF 0.89 / wF 0.26`). C'était choisissable — neuf ancres d'une grille
  3×3 — et le choix ne servait pas : signer un visuel en bas à droite est le défaut pour la même
  raison que sur papier. La seule décision qui reste est **si** la marque apparaît, donc tout ce que la
  section doit est « voici le logo que j'utiliserais » — et le voir est ce qui permet d'attraper un
  logo faux ou périmé avant de générer. Le logo est cuit par le même `compositeOverlays` (overlay
  `kind: "logo"`, 26% de la largeur).
  Le logo vient de la **section Brand du Playbook** (`ctx.brandLogo`, §11) : ce switch ne l'invente pas
  et ne permet pas de le changer — un Playbook sans logo se répare dans le Playbook, pas ici. Le switch
  tamponne **le défaut**, et rien d'autre.
  Le **mode Edit** propose en revanche **tout le set** (`st.playbookLogos`) en tête du flyout « Add an
  image » (groupe _« From your Playbook »_, avant Upload et avant les presets), chaque marque posée
  comme calque déplaçable. Toutes les variantes et pas seulement le défaut, parce que la raison d'aller
  la chercher à la main est justement qu'une autre convient mieux : le lockup inversé sur une photo
  sombre, l'icône là où un wordmark ne se lit pas à cette taille. Le switch est la signature
  automatique, les tuiles sont la pose à la main. Les tuiles portent un **index**
  (`data-img-logo-playbook="<i>"`) plutôt que `data-img-logo-preset="<url>"`, sans quoi un logo
  uploadé — donc une data URL — collerait des centaines de Ko de base64 dans le DOM à chaque render.
  Les couleurs sont les **mêmes pastilles rondes que la ligne « Brand color » du Playbook**
  (`.recap__fact-dot`) et les mêmes mots — un récap doit ressembler à ce qu'il récapitule. Nom + hex en
  tooltip ; l'hex imprimé sous chaque pastille transformait une rangée de cinq en deux lignes de petit
  texte. `playbookColors` porte `{ name, hex }` et non des hex nus.
  Côté moteur, `useBrandColors` conditionne la ligne `Palette:` du brief. Comme le brief n'est écrit
  qu'à l'ouverture et que Generate envoie **le champ** et pas les réglages, l'interrupteur **édite
  cette ligne en place** (`syncPaletteLine`) : re-dériver jetterait ce que l'utilisateur a tapé, ne
  rien faire rendrait l'interrupteur inerte pour la génération qu'il s'apprête à lancer. Même
  mécanisme généralisé pour la ligne `Look:` (`lookLine` → `syncSelectedRef` → `syncLookLine` →
  `spliceBriefLine`) : couper le switch References **retire** la ligne, là où elle restait avant à
  décrire une référence hors jeu.
  Valeur d'en-tête : la moitié active (`Acme` / `Logo only` / `Colors only` / `Off` / `No brand kit`),
  parce qu'« On » cacherait la différence entre un logo tamponné et un brief de couleurs.
- **Type** — à quoi sert l'image (`IMAGE_TYPES` : Visual hook / Infographic / Illustration). Dimension
  distincte du style.
- **Style** — 6 presets en vignettes. **Désactivé dès qu'une référence est en jeu**, et il dit alors
  pourquoi (`From references`) : deux sources de look qui se contredisent, c'est une de trop.
- **Format** — les ratios recommandés du network du draft, avec un glyphe dessiné à ses propres
  proportions. La valeur dit la forme (`1:1 · Square`) ; le hint suit la convention app-wide
  « **Best for** » + icône réseau.
- **Output** — Single / Carousel, fusionné avec son compteur (variations, ou slides plafonnées par
  réseau : LinkedIn 20, Instagram 10). L'option Carousel n'apparaît que sur un réseau qui en accepte.

Hiérarchie dans le corps d'une section : **une seule binaire**. Sombre = ça nomme la chose en dessous
(`.isv2-sheet-label`, `.isv2-sheet-switch-label`), clair = c'est un aparté (`.isv2-sheet-hint`). Pas
de seconde taille ni de gras — trois libellés gras empilés dans une colonne de 260px crieraient
par-dessus le titre de la section. Trois pas d'espacement, un par tier de regroupement : 4px libellé →
ce qu'il titre (`.isv2-block`), 8px entre blocs d'un même temps (`.isv2-group`), 12px entre temps.

**Une seule largeur de panneau, 284px, à toutes les tailles** (`--isv2-panel-w`). C'était deux nombres
codés en dur par breakpoint qu'il fallait changer ensemble sous peine de voir l'image glisser sous le
panneau. 284 est le nombre dont `--isv2-tile: 80px` est dérivé (trois vignettes plus deux gaps de 8px
demandent 256 des 260 intérieurs), et la branche étroite à 236 le cassait en silence : la troisième
vignette était coupée en plein milieu, ce qui se lit comme un défaut de rendu et non comme « fais
défiler ». Sous 1100px, seul l'inset se resserre.

> ⚠️ Les tooltips d'en-tête sont le **vrai `.ap-tooltip`**, monté sur `<body>` par
> [`tooltip.js`](../../src/components/tooltip.js) : la classe DS est en `position: absolute`, donc
> rendue sur place elle serait coupée par le conteneur de scroll le plus proche — et le panneau est
> justement une boîte `overflow-y: auto`. `position: fixed` ne sauve pas non plus, le panneau étant
> `transform`é (ce qui en fait le bloc conteneur des descendants fixes).

### Edit

Le même composer devient la **barre IA** (_« Describe a change… »_ → **Redraw**, ~2,6 s) et le panneau
de réglages cède le bord gauche à la **palette d'outils** : Crop · Add text · Add image (upload ou 16
presets). Ne restent **sur le canvas** que ce qui doit suivre un pixel précis :

- Les **overlays** texte/logo — déplaçables, redimensionnables, rotatifs, avec une mini-toolbar
  (couleur, police, bold, italic, outline + slider, shadow + slider, delete) et un bouton de reset de
  rotation qui n'apparaît qu'une fois l'élément tourné.
- La **boîte de crop** freeform : 4 poignées d'angle, masque assombri clippé à l'image, et une toolbar
  ancrée **sous la boîte** portant « Best for », les ratios et la paire ✕ / ✓. Les ratios avaient été
  mis dans un flyout de la palette : ça plaçait le ratio qu'on choisit à une largeur de canvas de la
  boîte qu'il reshape, le seul endroit où il ne doit pas être.

Le CSS de cette couche vit à part, dans
[`image-studio-canvas.css`](../../styles/screens/image-studio-canvas.css) : elle répond à « où
exactement sur l'image est ce contrôle, et comment il y reste » pendant que l'image est redimensionnée,
recadrée et régénérée dessous, ce qui n'est pas la question à laquelle répond la coque.

> ⚠️ Trois familles de classes y sont **assemblées par concaténation** en JS et un renommage les
> casserait en silence : `.image-studio__crop-handle--{nw,ne,se,sw}`, `.image-studio__popover--{kind}`
> et `.image-studio__tt-{kind}`.

Un drop d'image est accepté **sur toute la modale** en mode Generate (la section References est à un
scroll dans un panneau) et ouvre la section pour montrer ce qui vient d'atterrir.

### Commit vers le draft

Les overlays restent **vivants et éditables** jusqu'au commit — il n'y a pas d'« Apply » par édition.
C'est donc le commit qui les aplatit dans les pixels (`compositeOverlays`), avec deux destinations :

- _« Use this image »_ → `attachImageToDraft` + toast, puis fermeture.
- _« Apply to slide N »_ (édition d'une slide de carousel) → recuit la slide et **reste ouvert**, le
  set n'étant pas fini ; _« Use carousel · N slides »_ expédie ensuite l'ensemble via
  `attachCarouselToDraft`.

Chaque chemin resynchronise d'abord le texte en cours d'édition : un clic peut voler le focus d'un
`contenteditable` avant son dernier événement `input`.

### Ce que le mock ne fait pas

Aucune API d'image. `generateImage` renvoie une URL Picsum **seedée sur les entrées** — donc
déterministe : mêmes réglages, même image. Le recadrage est fidèle (reframe à seed constante) et les
overlays cuits sont exacts ; **« Redraw » est un aveu honnête** (reseed), pas une édition dirigée par
le prompt. Les réglages s'appliquent à la **génération suivante**, jamais rétroactivement.

> ⚠️ `derivePrompt` continue d'émettre sa ligne `Visual direction:` — qui retombe silencieusement sur
> Visual hook quand Type vaut « Any » — donc en mode **Layout** deux instructions de composition
> cohabitent dans le brief. Les vrais prompts portent ce genre de tension et le modèle la réconcilie.

---

## 8. Studios (prises de contrôle plein-panneau)

Trois « studios » qui prennent tout le panneau assistant (states upload → analyzing → review distincts du thread). Lancés depuis les starter cards du hero ou le menu Add.

| Studio           | Fichier                                                                                                   | Résumé                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Batch studio** | [`batch-studio.js`](../../src/batch-studio.js)                                                            | Génère un batch de posts en une passe (upload/analyse → review).                                                                                                                                                                                              |
| **Clip studio**  | [`clip-studio.js`](../../src/clip-studio.js)                                                              | Extraction + montage de clips vidéo en plein écran (`clip-studio-*` sessions, sidebar/status-card masqués).                                                                                                                                                   |
| **Top posts**    | [`top-posts-flow.js`](../../src/top-posts-flow.js) + [`top-posts-store.js`](../../src/top-posts-store.js) | « Pick an account → See the winners → Reuse into drafts ». Board de posts gagnants triable/filtrable par période, ou widget multi-select inline dans le thread ([`top-post-card.js`](../../src/components/top-post-card.js)). Alimente le flow **repurpose**. |

---

## 9. Playbooks

Un Playbook capture business summary, audience, goals, voice/style, brand identity — la **fiche d'identité d'un émetteur (marque ou voix) et de son cadrage éditorial**. Ce qu'il est et ce qui n'a jamais le droit d'y entrer : [`CONCEPTS.md` §1](CONCEPTS.md#1-le-playbook). Ci-dessous, ce qu'il fait. Stores/vues : [`contexts-store.js`](../../src/contexts-store.js), [`context-builder.js`](../../src/context-builder.js), [`playbook-view.js`](../../src/playbook-view.js), [`context-mock-analysis.js`](../../src/context-mock-analysis.js), [`languages.js`](../../src/languages.js).

### Library (`/contexts`, [`screens/contexts.js`](../../src/screens/contexts.js))

Header **« Playbooks »** + _« N Playbooks · applied across N chats »_ + search + **« Create a Playbook »**. Grille de cartes + ghost card. Carte : swatch couleur, nom (+ ★ default), voice headline, brief summary, compteurs, palette dots, _« Updated {when} »_. Hover : **Edit / Duplicate / Delete**. Garde : impossible de supprimer le dernier (_« Can't delete the last Playbook… »_).

### Détail (`/playbook/:id`, [`screens/playbook.js`](../../src/screens/playbook.js))

Rendu via `playbook-view` en mode **library**. Header identité + rail sticky + les sections. Actions : **Start a chat**, **Re-analyze website** (confirm → loader staged → patch), Delete, rename. Voice-only re-analysis : **My posts** / **Documents…**. Toggle ★ default (flag `playbookDefault`).

### Moteur partagé ([`playbook-view.js`](../../src/playbook-view.js))

Sections éditables inline (une à la fois, Save/Cancel avec snapshot) :

1. **Audience & goals** — Language(s), Business, Primary audience, Content style, Primary goal, Content action, CTA links.
2. **Voice & style** — toggle **Guided ⇄ Write it yourself**. Guided = Signature hooks + Closing patterns + Formatting + Visual style. Switcher **par langue** (2+ langues, flag `multilingualPlaybook`) — voice **écrite nativement par langue, jamais traduite** (voir mémoire _multilingual-playbook-model_). Dropdown « Learn from… ».
3. **Brand** — **Logo** (galerie + un défaut), Brand colors (hex swatches), Typography, Personality, Reference images.
4. **Competitors** (flag `playbookCompetitors`) — voir ci-dessous.

**Les logos** sont la première ligne de Brand, parce que c'est la pièce la plus concrète de l'identité visuelle et la seule que le générateur d'images cuit dans les pixels.

**Un SET, pas un logo.** Un site en porte plusieurs — le lockup d'en-tête, la version inversée du footer, l'icône carrée, le favicon — et ils sont tous légitimement « le logo » : n'en stocker qu'un obligerait à en jeter trois. Donc `brandLogos: Array<{ id, label, url }>` (le set) + `brandLogo` (**l'URL du défaut**, pas un id ni un getter : tout l'aval — header, tampon du studio, aperçu de `branding-view` — lit déjà `brandLogo` sans changement, et `snapshotEditable` fait un aller-retour JSON qui écraserait un getter). `normalizeBrandLogos()` dans [`contexts-store.js`](../../src/contexts-store.js) tient l'invariant : `brandLogo` est **toujours** une des URLs du set, ou `""` quand il est vide — un contexte qui ne portait que `brandLogo` devient un set d'une entrée plutôt que de perdre sa marque. Le compteur `brandLogoSeq` vit en haut du fichier parce que le seed appelle le normalizer à l'init du module, où un `let` déclaré à côté de sa fonction serait encore dans sa TDZ.

**La galerie.** Vignettes carrées 72px + label dessous (à cette taille un wordmark et son jumeau inversé sont durs à distinguer, et « Reversed » vs « Icon » n'est pas quelque chose qu'une vignette dit toute seule). Le défaut porte un anneau bleu + un badge check. En **lecture** on montre tout le set, pas seulement le défaut : savoir que quatre marques ont été trouvées est l'information, et c'est ce qui signale qu'il y a un choix à faire sans entrer en édition — les vignettes sont alors des `<span>`, rien n'est cliquable. En **édition** chaque vignette devient le contrôle de sélection, avec une poignée de suppression à l'opposé du badge (même répartition que les tuiles de référence du studio).

Retirer le défaut passe la main à ce qui reste ; vider le set fait retomber le header sur les initiales. Le défaut est stocké **par URL et jamais par index** — un index pointerait silencieusement sur une autre marque dès qu'on supprime celle du dessus.

**D'où viennent les marques.** `imageVoice.websites[0].images.logos` : trois vraies marques Archie pour une analyse d'agorapulse.com, et pour n'importe quel autre domaine **le favicon résolu depuis ce domaine** (même service que les logos de compétiteurs) — inventer un wordmark pour « foo-bar.com » mettrait dans le Playbook un logo qui n'appartient à personne. `deriveBrandLogos()` lit ce champ, en miroir exact de `deriveBrandColors()`.

Upload = bouton + input caché (pas le `.ap-dropzone` partagé : la ligne « Reference images » juste dessous est déjà un bouton + input caché, et deux affordances d'upload à une ligne d'écart se liraient comme deux natures de contrôle), multi-fichiers, `FileReader.readAsDataURL` et non `URL.createObjectURL` — un object URL est éphémère et ne survivrait pas au store. Le label est le nom du fichier sans son extension : c'est le seul que l'utilisateur ait donné. Plafond `MAX_BRAND_LOGOS = 8`.

Le défaut **remplace le monogramme d'initiales** dans le header du Playbook (pattern image + jumeau monogramme, swap sur `error`, comme les logos de compétiteurs) : une marque qui a un logo se reconnaît à lui. Le set repart ensuite dans l'Image Studio — voir §7.

Un Playbook est une **fiche** : chaque section répond à « qui êtes-vous ? ». La config opérationnelle (quelles sources d'écoute tournent, à quelle fréquence) vit sur la route qui possède la feature, pas ici — voir §17. Une section Topics a été essayée puis retirée : une grille d'interrupteurs se lisait comme un panneau de réglages coincé dans un profil.

### Competitors (flag `playbookCompetitors`, défaut OFF)

Le marché contre lequel Archie positionne la marque. Champs sur le Playbook : `competitors: Array<{ id, name, description, websiteUrl, socials:[{network,url}], logo?, suggested? }>` et `dismissedCompetitors: string[]`.

**Deux états, jamais confondus.** `suggested: true` = **proposition en attente** d'Archie, qui ne fait PAS partie du Playbook. Tout ce qui compte les compétiteurs (grille active, compteur `/contexts`) ignore les pending ; seul le bac « Suggested by Archie » les lit.

|                         | Actif                               | Suggéré (pending)                                                             |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Groupe                  | **« Your competitors »** + compteur | bac **« Suggested by Archie »** + compteur, fond creusé sous la grille active |
| Carte                   | bordure pleine, surface blanche     | bordure **pointillée**, actions incluses dans la bordure                      |
| Actions                 | remove (en edit scope)              | **Add** / **Dismiss** par carte + **« Add all »** dans l'en-tête du groupe    |
| Compté dans le Playbook | oui                                 | non                                                                           |

- **Grille de cartes** — tuile logo, nom, domaine, blurb sur 2 lignes, badges réseaux. Clic sur une carte → modale détail (`.ap-dialog`) : Name, Website, Description, Social profiles (select réseau + URL). Éditable quand la section est en edit scope, sinon lecture seule + liens réseaux cliquables. Pour une proposition, le footer de la modale offre **Dismiss** / **Add to Playbook** au lieu de Done.
- **Accepter / écarter** — dispo en **lecture** (pas besoin d'ouvrir l'éditeur de section, c'est tout l'intérêt du bac). Add → `delete suggested`, la carte rejoint la grille active. Dismiss → la carte disparaît et sa clé part dans `dismissedCompetitors`, donc **Archie ne la repropose jamais**. Hors edit scope les deux commitent directement ; en edit scope c'est le Save de section qui commite.
- **Favicon auto-extraite** — jamais stockée : résolue à partir du domaine via un service de favicons au render. Un `<img>` qui échoue (domaine sans icône, hors-ligne) bascule sur une **tuile monogramme** teintée déterministiquement depuis le nom, via un listener `error` en phase **capture** (`error` ne bulle pas) posé dans `mount()`.
- **Découverte** — bouton **« Discover competitors » / « Discover more »** (`ap-icon-sparkles`) dans le head de section : skeleton scoped à la section (~1,6 s, pas le loader plein écran) → merge de `discoverCompetitors(url, { exclude })` où `exclude` = les compétiteurs présents (actifs **et** pending) + `dismissedCompetitors`. Dédupliqué par domaine (à défaut par nom, via `competitorKey`). Rescan idempotent : si rien de nouveau, ligne _« No new competitors found. »_. Max 12.
- **Pré-remplissage onboarding** — `sectionPatchFromAnalysis` promeut `suggestions.competitors` sur le draft avec `suggested: true`, donc le recap `/welcome-alt/recap` révèle le bac déjà rempli (grille active vide) : pas d'étape de chat supplémentaire, l'utilisateur choisit sur place.
- **Édition** — pencil de section → remove par carte active + **« Add competitor »** (ouvre la modale sur une fiche vierge, donc directement active). Save élague les fiches restées entièrement vides et les lignes sociales sans URL ; `suggested` est **conservé** — une proposition non acceptée reste en attente au lieu d'être adoptée silencieusement.
- **Gate** — quand le flag est OFF : section, entrée de rail et compteur `/contexts` disparaissent, mais **la donnée reste** (l'analyse la pré-remplit quand même) — même contrat que `multilingualPlaybook`.

### Partage (flag `playbookSharing`, défaut OFF) — « §9bis »

Le problème : dans une org multi-users, N personnes créent chacune leur Playbook pour la **même marque**, personne ne sait laquelle fait autorité, et le travail part avec celui qui quitte l'entreprise. Les seeds le mettent en scène : `Acme · Q2 marketing` (à moi) et `Acme · Developer relations` (à Sam Rivera) sont deux fiches pour Acme.

**Le partage est binaire, jamais nommé.** Un Playbook est `scope: "personal"` ou `scope: "organization"`. Pas de liste de destinataires, donc pas de people-picker : on ne confie pas une fiche à trois collègues, on la garde ou on la met devant toute l'org. La distinction que l'UI souligne n'est donc pas « qui la reçoit » mais **qui peut l'UTILISER vs qui peut la MODIFIER** — les deux radio-cards le disent en autant de mots.

**Champs sur le Context** (normalisés par `normalizeOwnership()` dans [`contexts-store.js`](../../src/contexts-store.js), dans `addContext` **et** sur le seed qui le bypasse) : `ownerId`, `scope`, `history: Array<{ id, actorId, action, when }>` (capé à 12). L'identité et l'org vivent dans [`org.js`](../../src/org.js) — **CONFIG, pas des mocks** : un utilisateur `new-alt` a lui aussi un nom et une organisation, même split que `ff-catalog.js` vs `mocks.js`.

**Les droits vivent dans [`playbook-access.js`](../../src/playbook-access.js), pas dans le store.** Le store continue de tout renvoyer à tout le monde, délibérément : un chat dont le Playbook a cessé d'être partagé doit encore pouvoir le **nommer** (« ce chat tournait sur Nutrix »), donc lire une fiche qu'il ne peut plus ouvrir. Le store tient les faits, ce module tient les droits, et `revokedContextFor()` est le seul autorisé à regarder par-dessus la barrière. `canView` / `canUse` / `canEdit` / `canDelete` / `canManageSharing` / `canTransfer`, plus `visibleContexts()` / `usableContexts()` / `editableContexts()` que les surfaces substituent à `getContexts()`. **Flag OFF ⇒ tout est permis** — un seul point de court-circuit, `on()`.

|                                            | Propriétaire | Membre, `organization` | Manager, `organization` | Membre, `personal` d'un autre |
| ------------------------------------------ | ------------ | ---------------------- | ----------------------- | ----------------------------- |
| Voir / utiliser / dupliquer                | ✅           | ✅                     | ✅                      | ❌                            |
| Éditer / partager / supprimer / transférer | ✅           | ❌                     | ✅                      | ❌                            |

Le manager ne voit **que** les Playbooks partagés : une fiche personnelle non partagée reste privée même pour lui. Le rôle se change dans **Admin → Your role** ([`org.js`](../../src/org.js), `localStorage` `archie-org-role`) — la première section conditionnelle du popover.

**Surfaces**

- **`/contexts`** — la grille liste `visibleContexts()`. La marque de propriété est un `.ap-tag.grey.mini` dans le **coin métadonnées de la carte**, à côté des pastilles de palette : _« Shared with org »_ (à moi) ou _« Shared by Sam Rivera »_ (à un autre). À moi + personnel n'affiche **rien** : c'est le défaut, personne n'a besoin qu'on le lui dise. Elle a d'abord été essayée à côté du titre et cassait les noms longs sur deux lignes. La barre d'actions au hover est filtrée par droits — un Playbook partagé par un autre n'offre que **Duplicate**.
- **`/playbook/:id`** — `canEdit` false ⇒ aucun crayon de section, pas de rename, pas d'étoile, pas de « Learn from… », pas d'actions sur les compétiteurs, reference images figées. Un `.ap-infobox.info` dit **pourquoi** (« Sam Rivera shares this Playbook with your organisation ») et **Duplicate** est la sortie : la copie est à moi, personnelle, historique vide, détachée (pas de lien « dupliqué depuis »). La propriété apparaît en marque à côté du nom et en quick-fact **Owner** dans le rail — **jamais une section**. Un deep link vers une fiche interdite rebondit sur `/contexts`, exactement comme un id inconnu.
- **Le modal** ([`share-playbook-modal.js`](../../src/components/share-playbook-modal.js), 560px) — deux `.ap-radio-card`, l'`.ap-infobox.warning` de conséquence qui n'apparaît qu'en **sortie** de partage (« N chats … gardent leurs drafts, ne généreront plus rien »), la ligne **Owner**, le **transfert** replié dans une disclosure (le modal porte une décision ; la gouvernance est à un clic), et **Recent changes**. Ouvert depuis la carte et depuis la fiche. CTA **bleu** : partager est une action de liste routinière, pas une action IA.
- **Suppression** — le confirm dit la conséquence quand d'autres en dépendent, au lieu de « will be removed ».
- **`/topics/settings`** — le select ne liste que `editableContexts()` : quelles sources tournent et à quelle cadence est le job du propriétaire.
- **La sidebar** — un chat dont le Playbook est hors de portée retombe sur la pastille grise et le bucket « No playbook » plutôt que d'afficher un nom qu'on ne peut pas ouvrir ; le compteur de nav compte le visible.

**Le chat dégradé** (§6.3 du brief). Perdre l'accès ne casse pas le chat, ça le **fige en lecture-écriture partielle** : les drafts déjà écrits restent enregistrables et programmables, rien de neuf ne se génère. Un seul prédicat, `revokedContextFor(session)`, et deux chemins y mènent — la session seedée `s-brightline`, et un manager qui repasse en personnel le Playbook d'un collègue pendant qu'on l'utilise.

- Un `.ap-status-card red` **prioritaire** sur drafts/ideas/grey dans la fente `.session__composer-status`, à la première personne : _« I can't write anything new here — this chat runs on X, and Y stopped sharing it. »_
- Composer : send `disabled`, textarea `readonly`, hint remplacé par la sortie (« pick a Playbook you have access to »), et `submitInput()` garde-fou en entrée.
- `attachedContext` passe par `canView` au dernier moment : le chat lit comme un chat **sans** Playbook attaché — ce qu'il est devenu — au lieu d'en nommer un qu'il ne peut pas ouvrir. `session.contextId` reste intact, sinon le bandeau n'aurait plus rien à nommer.
- Les actions de génération sont avalées par **un listener `click` en capture** sur `document` (liste `GENERATE_HOOKS`) qui toaste la raison en `variant: "error"`, et grisées par `body.playbook-revoked`. Sur `<body>` et pas sur la racine de la session : le panneau des drafts est du chrome de shell, **hors `#app`** — une classe sur la section laisserait chaque « Generate an image » du panneau parfaitement vivant. Un listener plutôt qu'un flag enfilé dans cinq renderers de cartes : les cartes restent ignorantes du partage, et la raison est **dite** au clic au lieu d'être avalée en silence.
- Choisir un Playbook accessible dans le picker est la sortie : `setHashQuery` refait tourner le handler (comme `startBatchChat`), sinon on laisserait un composer mort sous un picker vivant.

**Notification & historique.** Toute action d'un manager sur la fiche d'un autre toaste _« Sam Rivera will be notified »_ et ajoute une ligne au journal. Le journal est **sans versioning et sans diff** — qui, quoi (la phrase que l'appelant fournit), quand — et vit **dans le modal**, comme `usedIn` vit sur la carte.

**Ce qui n'est pas fait** (non-objectifs v1) : bibliothèque inter-orgs, versioning, fusion de doublons, rôle « co-éditeur », notifications email (dites en copy, il n'y a pas de centre de notifications dans le proto), instrumentation des métriques.

### Mock analysis ([`context-mock-analysis.js`](../../src/context-mock-analysis.js))

- `analyzeWebsite(url)` : URL contenant « agorapulse » → mock Agorapulse détaillé (5 audiences, voiceProfile, hooks, couleurs #212E44/#FF6726, 5 CTA links, 5 competitors réels) ; sinon → template SaaS générique éditable (3 competitors placeholders).
- `discoverCompetitors(url, { exclude })` : puise dans le même pool et ne renvoie que les inconnus.
- `analyzeSocialProfiles(ids)` / `analyzeDocument(file)` : voice/summary simulés.

---

## 10. Onboarding (First-Time User « ALT »)

Fichiers : [`screens/welcome-alt.js`](../../src/screens/welcome-alt.js), [`screens/welcome-alt-recap.js`](../../src/screens/welcome-alt-recap.js), + `context-builder.js`.

- **`/welcome-alt`** (redirect) : ajoute `body.onboarding` (full-bleed, pas de sidebar/topbar), mint une session `welcome-alt-{ts}`, arme le handoff `pendingStartContextBuilder` (`flow:"alt"`, `prefilledUrl`), navigue dans la session. Chat 3 questions (URL → profil → documents optionnels ; +langue si `multilingualPlaybook`).
- **`/welcome-alt/recap`** (reveal du Playbook) : loader staged (_Reading your website → Learning your voice → Mapping your audience → Building your Playbook_), recap éditable, rename. CTA finish : **Save and start** (first-time → clear user-mode + reload en returning) ou **Save and continue** (intégré → retour à `/contexts` sans reload). Résilient au reload (draft en sessionStorage).
- **Exit** : topbar « Exit » → confirm _« Exit onboarding? … »_.

Le flow « Create a Playbook » depuis `/contexts` réutilise ce flow en mode **intégré** (`welcomeAltIntegrated`, garde le shell).

---

## 11. Connectors / MCP

**Toute la feature est derrière le flag `connectors` (défaut OFF).** Fichiers : [`screens/connectors.js`](../../src/screens/connectors.js), [`connectors-store.js`](../../src/connectors-store.js), [`connectors-view.js`](../../src/connectors-view.js), [`connector-ask.js`](../../src/connector-ask.js), [`connectors-modal.js`](../../src/components/connectors-modal.js).

- **Concept** : un connecteur connecté devient une **source live** — Archie le requête live via un aller-retour MCP simulé, rien n'est importé. _« I query {name} live over MCP — these are the tools I'll call. »_
- **Gallery** (`/connectors`) : hero « Connectors » + _« N of N connected »_ + search + tabs catégorie (Docs & wikis, Storage, Meetings & calls, Dev & project, Messaging, CRM & support). Carte = logo + nom + desc + check/+.
- **Détail** (page ou modal) : hero teinté accent, actions **Connect** ou **Start a chat** + **Disconnect**, prompts exemples + capabilities.
- **Try in chat** ([`connector-ask.js`](../../src/connector-ask.js)) : attache le connecteur au composer (chip) ; depuis la gallery → nouveau chat via `pendingAskConnector`.
- **24 connecteurs seedés** (`mocks.connectors`) — seuls **Slite** & **Notion** démarrent connectés. Catégories : Docs & wikis (Slite, Notion, Confluence, Google Docs), Storage (Google Drive, Dropbox, OneDrive, Box, Airtable), Dev & project (GitHub, Linear, Jira, Trello, Asana, Figma), Messaging (Slack, Teams, Discord), CRM & support (HubSpot, Salesforce, Intercom, Zendesk), Meetings & calls (Zoom, Fathom). Chacun 3 capabilities.

---

## 12. Navigation shell

### `/` ([`screens/dashboard.js`](../../src/screens/dashboard.js)) — redirect, ou la front page

**Par défaut, un redirect pur** : first-time sans Playbook → `/welcome-alt` ; sinon → session la plus récente (ou `/session/new`). C'est le bon défaut pour un outil qu'on ouvre avec une tâche déjà en tête.

**Avec le flag `frontPage` (+ `topics`)**, la route rend une **front page** — la page qu'Archie remplit pendant votre absence. Head à la 1ʳᵉ personne _« Here's what I found »_ + _« 3 new since yesterday · 10 topics · from 2 Playbooks »_, **Refresh now** (`secondary blue`) et **New chat** (`secondary orange`), la rangée de **rubriques**, puis la une + une grille **plafonnée à 6** et un pied **« See all N topics »** vers `/topics`. Détail et arbitrages : §17.

La branche onboarding passe **avant** le flag — il n'y a rien à mettre en une avant qu'un Playbook existe.

### Sidebar ([`sidebar.js`](../../src/components/sidebar.js))

- **Head** : wordmark « Archie » + badge **BETA** (mint un chat), toggle collapse.
- **Nav** : **New chat** (⇧⌘O), **Search…** (⌘K), puis **Home** (flags `frontPage` + `topics` ; icône `ap-icon-sparkles` — le DS ne ship pas de glyphe maison, et cette route n'est pas un dashboard mais la page qu'Archie écrit), **Playbooks**, **Connectors** (flag `connectors`) avec count badges. Sans la ligne Home la front page ne serait atteignable qu'au premier chargement : le brand et New chat mintent tous deux un `/session/new-<ts>` et évitent `/` volontairement.
- **Recent** : groupés Pinned / Recent. Un bouton filtre au-dessus de la liste ouvre **Group by** Aucun/Playbook/Date + **Sort by** Récence/Alphabétique — Pinned reste toujours en tête ; la préférence persiste (`archie-chat-organize`). Row = dot couleur playbook (masqué quand `playbookColors` est OFF) + titre + menu ⋮ (**Rename / Pin / Delete**). Delete → confirm + sweep de tous les stores per-session.
- **Footer** : bloc user, **Send feedback**, ⚙️ popmenu → Send feedback / Report a bug / Keyboard shortcuts (`?`) / **Admin menu** (voir §14).
- **Raccourcis globaux** : ⌘/Ctrl+B toggle sidebar, ⇧⌘O new chat, Esc ferme le menu. Collapse persisté (`archie-sidebar-collapsed`).

### Topbar ([`topbar.js`](../../src/components/topbar.js))

- **Gauche** : titre de route (session = **click-to-rename**). `/playbook/:id` → « ‹ Back to Playbooks ». Board repurpose → « ‹ Change profile ».
- **Droite** (sessions) : cluster pills **Sources / Ideas / Drafts** (toggle panneau, count badge, désactivé si count 0). Active = `stroked blue`.
- **Toggle « i »** status-card (flag `conversationStatusCard`).
- Touche **« ? »** → shortcut legend.

---

## 13. Panneau de droite — modes

Panneau glissant ([`right-panel.js`](../../src/components/right-panel.js)) qui overlay le workspace ; **resizable** (drag handle, min 380px, largeur calculée `(viewport − sidebar) / 2` — non persistée entre rechargements, voir [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md)), URL-persisté via `?panel=<mode>` (drafts/ideas/sources), scopé session, Esc ferme.

| Mode                | Contenu                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **drafts**          | Feed PostCard groupé par network + filtres + bulk (§4).                                                |
| **ideas** (Outputs) | Sous-onglets **Ideas \| Clips**. Ideas = grille compacte + filtre kind ; Clips = clips agrégés + bulk. |
| **sources**         | Rows sources + « Attach source » + bloc **Live connectors** (flag).                                    |
| **clips**           | Même surface qu'ideas, landé sur Clips.                                                                |
| **context-brief**   | Éditeur/lecteur du brief Playbook (read/edit, footer Save sticky). Hors pipeline sources/ideas/drafts. |

Détail dimensions/coexistence avec la status-card : [`SHELL-LAYOUT.md`](SHELL-LAYOUT.md) et [`PANEL-SIDEBAR-RULES.md`](PANEL-SIDEBAR-RULES.md).

---

## 14. Admin, feature flags & user modes

> ⚠️ **Il n'y a plus de route `/settings`.** L'Admin a migré dans le **popover ⚙️ de la sidebar** ([`admin-menu.js`](../../src/admin-menu.js) rendu par `sidebar.js`). Chaque changement **reload** l'app pour re-seeder les stores.

### Admin menu

- **User mode** (radio) : **Returning user** (_« Populated mocks (default) »_) / **Welcome - First Time XP** (_« Visual picker + conversational chat »_).
- **Feature flags** : une toggle par flag.
- **Docs** : lien externe **« Conversation thread components »** → `/handoff/components.html`.

### Feature flags ([`ff-catalog.js`](../../src/ff-catalog.js)) — les 14

| id                       | label                                            | défaut  | Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draftInlineEdit`        | Inline edit on draft posts                       | **OFF** | Édition inline des post cards.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `playbookDefault`        | Default Playbook toggle                          | **OFF** | Étoile ★ set/unset default sur `/playbook/:id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `connectors`             | Connectors (live MCP sources)                    | **OFF** | Toute la feature connecteurs (gallery, modal, submenu, Live connectors, tab modal).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `conversationStatusCard` | Conversation status card                         | **OFF** | Carte flottante + toggle « i ».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `statusActionSnackbars`  | Action success snackbars                         | **OFF** | Snackbars succès dupliquant la status bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `playbookColors`         | Playbook colors                                  | **OFF** | Quand OFF (défaut), masque les visuels couleur Playbook partout (classe `body.hide-playbook-colors`) ; ON = couleurs affichées.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `multilingualPlaybook`   | Multilingual Playbooks                           | **OFF** | Playbooks multi-langues (voice par langue, étape langue du draft flow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `manyProfiles`           | Many connected profiles (demo)                   | **OFF** | Seed ~40 profils connectés variés → le quickpicker de profil affiche une recherche live (voir §draft flow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playbookCompetitors`    | Playbook competitors                             | **OFF** | Section **Competitors** du Playbook (panneau + entrée de rail + compteur `/contexts`). La donnée reste présente quand OFF (voir §9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `topics`                 | Topics (listening dossiers)                      | **OFF** | Toute la feature **Topics** (§17) : la route `/topics` + son entrée de nav et son compteur d'unseen, la dialog du dossier, la page **/topics/settings**, le rail du hero et la front page. La donnée (dossiers seedés + `ctx.topics`) reste présente quand OFF, comme `playbookCompetitors`.                                                                                                                                                                                                                                                                                                                                           |
| `playbookSharing`        | Playbook sharing (org-wide)                      | **OFF** | **À qui appartient un Playbook** (§9bis). OFF (défaut) = un seul utilisateur implicite, tout est visible et éditable comme avant ; ON = chaque Playbook est **personnel** ou **partagé à toute l'org** (jamais nommément), lecture seule pour les autres, droits manager, chat dégradé après perte d'accès, section **Your role** dans l'Admin. Les deux Playbooks de démo (`ctx-acme-devrel`, `ctx-orphan-brightline`) et le chat `s-brightline` ne sont seedés **que** sous ce flag — contrairement à `topics`, ce ne sont pas des champs qui roulent avec la donnée mais des objets entiers qui n'ont aucun sens sans propriétaire. |
| `frontPage`              | Front page (vs. hero rail)                       | **OFF** | **Où vivent les propositions d'Archie** (§17). Dépend de `topics` : les deux OFF, rien ne bouge. OFF (défaut) = **rail dans le hero du chat neuf** + `/` redirige comme toujours. ON = **`/` devient une front page** + entrée de nav **Home** ; le rail s'efface. Jamais les deux — voir §12.                                                                                                                                                                                                                                                                                                                                         |
| `imageStudioAutoBrief`   | Image Studio: auto-written brief + centred setup | **OFF** | Variante Image Studio (§7) : le brief est un document éditable en blocs, écrit depuis les réglages, avec sa propre mise en page prompt+options / preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `imageStudioGridBrief`   | Image Studio: brief as an editable grid          | **OFF** | Troisième variante Image Studio (§7) : le brief devient une grille de cartes configurables (pas de prompt en prose). Gagne sur `imageStudioAutoBrief` si les deux sont ON.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Persistés en `localStorage` (`archie-feature-flags`), lus via `isFlagOn()`. Voir aussi [`STORES.md`](STORES.md).

⚠️ Le seul flag **composé** : l'entrée de nav Home exige `frontPage` **et** `topics`, d'où `flag: [...]` dans le `NAV` de [`sidebar.js`](../../src/components/sidebar.js) (le filtre accepte une string ou une liste). Une ligne de nav qui survit à l'une de ses dépendances est pire qu'une ligne absente : elle pointerait vers un `/` redevenu redirect.

### User modes ([`user-mode.js`](../../src/user-mode.js))

`localStorage` `archie-user-mode` : **returning** (mocks peuplés, défaut) / **new-alt** (stores vides + onboarding first-time). `isNewUser()`.

---

## 15. Modals utilitaires

Tous via [`modal-coordinator.js`](../../src/modal-coordinator.js) (un overlay à la fois, focus restore, Esc/backdrop).

| Modal                                                                                                | Rôle                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Search** ([`search-modal.js`](../../src/components/search-modal.js))                               | ⌘K → recherche de chats, nav clavier ↑/↓/Enter/Esc.                                                                                                                                                                            |
| **Chat picker** ([`chat-picker-modal.js`](../../src/components/chat-picker-modal.js))                | _« Where should this draft go? »_ quand on drafte une idée sans session active.                                                                                                                                                |
| **Bug report** ([`bug-report-modal.js`](../../src/components/bug-report-modal.js))                   | _« Report a bug »_ : type chips, screenshot auto (html2canvas) ou upload, ~1.4 s → succès.                                                                                                                                     |
| **Feedback** ([`feedback-modal.js`](../../src/components/feedback-modal.js))                         | _« Send feedback »_ : feature-area select + textarea, ~1.2 s → succès. Store [`feedback-store.js`](../../src/feedback-store.js).                                                                                               |
| **Shortcut legend** ([`shortcut-legend.js`](../../src/components/shortcut-legend.js))                | Touche `?` : liste des raccourcis.                                                                                                                                                                                             |
| **Confirm** ([`confirm-modal.js`](../../src/components/confirm-modal.js))                            | `alertdialog` réutilisable ; `danger` → confirm rouge + focus Cancel.                                                                                                                                                          |
| **Rename** ([`rename-modal.js`](../../src/components/rename-modal.js))                               | Input pré-rempli, Save/Enter, Esc. Sidebar row / topbar / Playbook.                                                                                                                                                            |
| **Share Playbook** ([`share-playbook-modal.js`](../../src/components/share-playbook-modal.js))       | Flag `playbookSharing` : deux radio-cards (moi seul / toute l'org), l'avertissement de conséquence en sortie de partage, la ligne Owner + le transfert de propriété (disclosure), et le journal des modifications. Voir §9bis. |
| **Analyze profiles** ([`analyze-profiles-modal.js`](../../src/components/analyze-profiles-modal.js)) | Sélection de profils sociaux pour l'analyse voice.                                                                                                                                                                             |
| **Fill document** ([`fill-document-modal.js`](../../src/components/fill-document-modal.js))          | Dropzone + lien doc (Google Docs/Drive aware) pour nourrir la voice.                                                                                                                                                           |
| **Save folder** ([`save-folder-modal.js`](../../src/components/save-folder-modal.js))                | Ranger un contenu dans un dossier ([`folders-store.js`](../../src/folders-store.js)).                                                                                                                                          |

---

## 16. Comportements transverses

- **Social profiles** ([`social-profiles.js`](../../src/social-profiles.js)) : source de vérité des comptes connectés (`mocks.socialAccounts`, brand « Northwind Studio »). Profils à `postCount === 0` désactivés pour « analyze my posts » (endNote « No posts to analyze »).
- **Toasts** ([`toast.js`](../../src/components/toast.js)) : `showToast()`, queue max 3, dwell 3200 ms, Undo optionnel.
- **Empty states** ([`empty-state.js`](../../src/components/empty-state.js)) : primitive unifiée icône + titre + body + CTA.
- **Feedback control** ([`feedback-control.js`](../../src/components/feedback-control.js)) : strip pouce « How's this…? » réutilisable sous les cartes.
- **URL services** ([`url-services.js`](../../src/url-services.js)) : reconnaissance de service depuis une URL (logos Google Docs/Notion/Drive/YouTube/Figma).
- **Deep-links Figma-capture** : `?route=`, `?openModal=…`, `?openPanel=…`.
- **Suppression de session** : `clearSession` dans chaque store per-session vide sources/ideas/drafts/mentions.

---

## 17. Topics — les dossiers du listening (flag `topics`, défaut OFF)

Le seul endroit où **Archie propose** au lieu d'attendre. Le listening Agorapulse remonte des posts sociaux sur six sources rattachées à un Playbook ; Archie en assemble un **Topic** : une accroche (le constat), une analyse écrite, et les posts qui la fondent. Fichiers : [`topics-catalog.js`](../../src/topics-catalog.js), [`topics-store.js`](../../src/topics-store.js), [`topics-feed.js`](../../src/topics-feed.js), [`screens/topics.js`](../../src/screens/topics.js), [`screens/dashboard.js`](../../src/screens/dashboard.js), [`components/topic-card.js`](../../src/components/topic-card.js), [`components/topic-modal.js`](../../src/components/topic-modal.js), [`components/social-post-card.js`](../../src/components/social-post-card.js), [`topic-flow.js`](../../src/topic-flow.js).

### Trois surfaces, un moteur

Un dossier se lit **là où l'utilisateur arrive**, pas seulement sur une route qu'il faut aller chercher :

| Surface                         | Ce qu'elle montre                                              | Gate                           |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| **`/topics`** — la section      | Tout : une + grille, rubriques, filtre Playbook, archive datée | `topics`                       |
| **`/`** — la front page         | Une sélection du frais : une + 6, rubriques, « See all N »     | `topics` + `frontPage`         |
| **Le rail du hero** — chat neuf | Trois accroches au-dessus des starters                         | `topics` + **pas** `frontPage` |

[`topics-feed.js`](../../src/topics-feed.js) est le **moteur de rendu partagé** (`groupByAge` · `renderSourceChips` · `renderMagazine`), sur le modèle de `playbook-view.js` (recap + détail) et `connectors-view.js` (page + modal) : fonctions pures, chaque hôte lui passe ses deux lookups. `topic-card.js` sort la même carte en **trois tailles** (`renderTopicCard` · `renderTopicLeadCard` · `renderTopicRailCard`) qui émettent **les mêmes trois hooks** `data-topic-open` / `-chat` / `-dismiss`, donc un écran les câble une fois quelle que soit la taille rendue. Le CSS a suivi : la carte a quitté `topics.css` pour [`components/topic-card.css`](../../styles/components/topic-card.css) le jour où elle a cessé d'appartenir à un écran.

**Le rail et la front page s'excluent** (`frontPage`). Deux surfaces montrant les trois mêmes accroches, c'est le plus court chemin pour qu'aucune ne veuille plus rien dire. `/topics` reste la section dans les deux cas : la front page est une **sélection**, `/topics` est **tout** — donc pas de doublon de route.

### Les six sources ([`topics-catalog.js`](../../src/topics-catalog.js))

**Config, pas contenu** — le catalogue ship avec l'app et existe aussi en mode `new-alt` (un utilisateur neuf voit les six cartes même s'il n'a aucun dossier). Même partage que `ff-catalog.js` (config) vs `mocks.js` (data). Descriptions écrites **à la 1ʳᵉ personne d'Archie**.

| Source                    | Accent        | `playbookAnchor` | Défaut |
| ------------------------- | ------------- | ---------------- | ------ |
| **Competitor sources**    | purple        | `competitors`    | **ON** |
| **Influencer sources**    | red           | `competitors`    | **ON** |
| **Brand feedback**        | menthol       | —                | OFF    |
| **Competitor monitoring** | electric-blue | `competitors`    | OFF    |
| **Industry trends**       | green         | —                | OFF    |
| **Global trends**         | orange        | —                | OFF    |

`accent` est une **clé sémantique, jamais un hex** → `.topic-badge--<accent>` ([`topic-badge.css`](../../styles/components/topic-badge.css), partagé par les trois surfaces). `playbookAnchor` — jamais l'id — dit quelle section du Playbook alimente la source, donc la vue offre un deep-link sans hardcoder d'id.

### Config par Playbook

`ctx.topics = { enabledSourceIds, cadence }` — **une seule cadence pour tout le Playbook** (daily / weekly / monthly), pas une par source. Normalisé par `normalizeTopics()` dans [`contexts-store.js`](../../src/contexts-store.js), appliqué dans `addContext` **et sur le seed** (qui bypasse `addContext`). Édité sur **`/topics/settings`** — voir ci-dessous. Le Playbook **ne porte rien** de tout ça.

**La cadence est du copy, pas un timer** — un tick hebdo ne se déclencherait jamais dans une démo. Le côté récurrent vient de deux gestes qui partagent la même primitive : **Refresh now** (2 dossiers) et l'**auto-scan au chargement** (1 dossier) — voir « Scan » plus bas.

### La section (`/topics`, [`screens/topics.js`](../../src/screens/topics.js))

Header **« Topics »** + _« N new · N topics · from N Playbooks »_ (les Playbooks **représentés** dans le feed, pas ceux surveillés — « across 4 Playbooks » est un mensonge quand neuf dossiers viennent de deux), puis le picker **Playbook**, **⚙ Settings** et **Refresh now** (`secondary blue` : rafraîchir une liste est une action de page routinière ; l'orange est réservé au geste spotlight sur une carte).

#### Mise en page : une une, puis une grille

Le feed était une **colonne chronologique de cartes à hauteur identique**, et c'était juste tant que la page était une file d'attente de lecture. Elle ne l'est plus : Archie doit répondre à « qu'est-ce que je poste aujourd'hui ? », et une suite de cartes égales n'a aucune réponse à « par quoi je commence ? ».

- **La une** = `visible[0]` (`getTopics()` trie déjà du plus frais au plus vieux, et filtrer préserve l'ordre). Elle reste la une **sous filtre** aussi : « le plus frais de cette rubrique » est encore la bonne réponse, alors qu'épingler la une au feed non filtré montrerait un dossier que le filtre exclut.
- **La carte de une** (`renderTopicLeadCard`) : accroche en `--sys-text-style-h1` (24px, une marche au-dessus des 18 de la grille) clampée 3 lignes, chapô 3 lignes, et — la partie qui la fait lire comme du journalisme — **un des posts sources cité en place**, via `renderSocialPostCard(post, { compact: true })`. La preuve est ce à quoi sert un dossier, et en montrer un bout est la différence entre « Archie a trouvé un truc » et « voilà ce que les gens disent ». Elle passe en **deux colonnes** (argument à gauche, preuve à droite) au-delà de 720px — une **`@container` query** sur la carte elle-même, pas une media query : sidebar repliable + panneau de droite, la largeur du viewport ne dit pas la largeur du contenu. Empilée, la citation poussait le pied sous la ligne de flottaison sur un laptop. Son « Start a chat » passe **`primary orange`** : il n'y en a qu'un sur la page, exactement l'argument qui vaut déjà pour la dialog.
- **La grille** — `repeat(auto-fill, minmax(380px, 1fr))` + `grid-auto-rows: 1fr`. **380 et pas 320** : à 320 la mesure de 1160 tient trois colonnes de ~365px, et une carte aussi étroite ne garde pas son pied sur une ligne (la pile d'avatars et les deux actions passaient à la ligne sur chaque carte). À 380 c'est deux colonnes de ~570 — une largeur de prose confortable **et** de la place pour le pied. `1fr` garde **la règle des hauteurs identiques dans la grille** : seule la une la casse, et elle la casse exprès.
- **La page passe de 960 à 1160px.** Le 960 avait été choisi pour une colonne unique de prose. La prose reste plafonnée **séparément** en `ch` (accroche 62, chapô 72), donc élargir la grille n'élargit jamais une ligne de texte — la leçon déjà apprise sur `/topics/settings`.
- **Les groupes de date restent, sous la une** : **This week** (`ageDays ≤ 7`) / **Earlier this month** (`≤ 30`) / **Earlier**, groupes vides masqués. Ils jouent maintenant le rôle des filets de section d'un journal.

#### Filtres : la source est devenue une rubrique

**Deux facettes, deux composants différents, et c'est le sujet.**

- **Source → `.ap-filter-chip`** (piloté par `aria-pressed`, avec `.ap-filter-chip-count`). Six sources, figées, livrées par le catalogue : ce sont **les rubriques du journal**, et on clique entre les rubriques d'un canard, on n'ouvre pas un menu pour en choisir une. C'est aussi la règle du DS — bascules toujours visibles sur un petit set plat → _filter chips list_. C'était un `.ap-select` avant, et c'était juste pour une page qui était une liste filtrée ; c'est faux pour une page qui est une publication. (Le composant Angular `<ap-filter-chips-list>` n'a **pas** de couche CSS-UI — `.ap-filter-chip` de [`ds-patches.css`](../../styles/ds-patches.css) reste l'équivalent prototype sanctionné.)
- **Playbook → `.ap-select`**, inchangé. Ce set grandit avec le compte et une puce par Playbook est exactement le piège que la page de config a évité : ça ne survit pas à vingt. Un select oui, et il montre sa sélection fermé.
- **Le select est monté dans le head**, à côté de Settings et Refresh. Deux tentatives l'ont laissé sur la ligne des rubriques (poussé à droite en `space-between`, puis flottant après la dernière puce) et les deux ont fini pareil : sept puces remplissent déjà une mesure de 1160, donc le select tombait sur une ligne à lui et laissait une bande vide au-dessus de la une. Il y est aussi **au mérite** — « quel Playbook je regarde » est un contrôle de page du même ordre que ces deux-là, pas une rubrique.
- Inchangé : **compteurs croisés** (chaque facette comptée contre la sélection de l'AUTRE, donc un nombre ne promet jamais des lignes que les filtres excluraient) ; **un compteur à zéro _désactive_ la puce au lieu de la masquer** (la rangée ne se réorganise pas sous le curseur, et une combinaison morte reste inatteignable — sauf si c'est la sélection courante, sinon on ne pourrait plus en sortir) ; **seuls les Playbooks présents dans le feed ont une option** ; la dalle `.ap-select-search` au-delà de 8 ; **`Clear` seulement s'il y a quelque chose à effacer** ; **`?pb=` pour le Playbook, state module pour la source**.
- **Sous-titre filtré** — _« 2 of 9 topics · Pawtrack · always-on · Competitor sources »_ : « 9 topics » au-dessus d'une liste de 2 se lit comme un bug.

#### La carte de grille ([`topic-card.js`](../../src/components/topic-card.js))

Un **brief éditorial** : kicker, accroche, chapô, ligne de signature. Inchangée dans ses arbitrages, seulement extraite dans son propre fichier CSS et posée sur une grille.

- **Kicker à gauche, marques à droite**, `space-between` : `[badge] Source · quand` d'un côté, `[chip Playbook] • New` de l'autre. En une seule file, seul le badge restait à sa place — tout le reste glissait selon la longueur du nom qui le précédait. Deux ancres fixes donnent deux colonnes à scanner. `margin-left: auto` sur les marques, pour qu'un nom de Playbook long qui les fait passer à la ligne les garde à droite.
- **L'accroche mène** : `--sys-text-style-h2` (**18px/700**). Elle était en h4 — **14px, la taille du résumé** — donc la carte n'avait pas de tête et chaque brief se lisait comme un paragraphe gris. Plafond **62ch** (et non 52 : à 52 cette accroche cassait en « …peace / of mind ») + `text-wrap: balance` et clamp **2 lignes**.
- **Rythme en marges explicites**, pas un gap uniforme : kicker → 8 → accroche → 4 → chapô.
- **Filet au-dessus du pied**, sur la couleur de bordure de la carte. Pied : `.ap-avatar-group` des auteurs + « N posts », puis **Dismiss** (ghost grey) et **Start a chat** (`secondary orange` — neuf boutons pleins, aucun ne lit comme important).
- Corps = un seul `<button>` qui ouvre la dialog ; les actions vivent dans un footer **frère** (un bouton dans un bouton est du HTML invalide). Hover = bordure bleue, sans élévation. Unseen se lit au **point orange « New »** dans l'eyebrow, jamais à un liseré de bord : l'état d'une carte est dans son **contenu**, pas sur son cadre.

#### La front page (`/`, flag `frontPage`)

Le même moteur, une autre intention. Head **« Here's what I found »** à la 1ʳᵉ personne (cette page est Archie qui rend compte, pas un dashboard qui s'étiquette) + _« 3 new since yesterday · 10 topics · from 2 Playbooks »_ — honnête, puisqu'un dossier est vraiment arrivé au chargement.

- **Les rubriques, pas le select Playbook.** Une une n'est pas une vue filtrée ; restreindre par marque est le métier de la section, et remettre la même toolbar à deux facettes ferait ressembler les deux routes alors que leurs métiers diffèrent.
- **Une + 6, sans groupes de date.** Des intertitres de date sur six cartes seraient du mobilier ; l'archive est à un clic.
- **Pied « See all N topics »** (`stroked grey`, centré, au-dessus d'un filet). Une front page doit **finir** et le dire, sinon une grille plafonnée ressemble juste à un feed tronqué.
- **`New chat` est `secondary orange`, pas primary.** La page a déjà exactement un bouton plein — le « Start a chat » de la une. Deux primaires sur un écran est une violation DS, et ça se lit comme telle : le header concurrencerait l'histoire au-dessus de laquelle il est posé.
- Deux culs-de-sac seulement (contre trois sur la section) : pas de facette Playbook ici, donc une rubrique vide est toujours le fait des puces.

#### Le rail du hero (chat neuf, quand `frontPage` est OFF)

_« What I'm hearing · N new »_ + trois `renderTopicRailCard`, **entre le composer et « Or jump into a workflow »**, plus un lien **See all N** vers `/topics`. Les trois starter cards sont **intactes** : le rail répond à « qu'est-ce que je poste aujourd'hui ? » (la question de quelqu'un qui ouvre un chat vide), les starters à « je sais déjà ce que je veux faire ». Les rétrograder en pills écrasait trois features en texte de lien.

- **Sélection** : le Playbook attaché au chat d'abord — « pertinent » est toute la promesse — puis la rangée est **complétée** depuis le reste du compte. Un Playbook à deux dossiers laissait un trou dans une grille de trois, à côté de trois starters pleins ; « voilà ce que j'ai trouvé » qui se lit comme un vide est pire qu'une troisième carte d'une autre marque.
- **Le compteur « N new » est compté sur le rail**, pas sur le compte : le badge de la sidebar est la notification account-level, et un label promettant « 3 new » au-dessus de trois cartes sans marque New se lit comme un bug.
- **La carte de rail** : accroche seule (clamp 3 lignes, `--sys-text-style-body-bold` — à 18px trois accroches criaient par-dessus le composer, qui reste l'objet principal de cet écran) + un CTA `ap-link standalone small` avec flèche, **le même idiome que les starters en dessous**, pour que les deux rangées se lisent comme un seul hero. Le CTA dit **« See what I found »** et pas « Start a chat » : la carte ouvre la **dialog**, comme une carte de feed, et la dialog porte déjà ce bouton — promettre le chat serait un mensonge. **Pas de Dismiss** : ranger son feed est le métier de `/topics`.
- **L'animation ne bouge pas** : `empty-rise` échelonne déjà les enfants **1 à 7** du hero, qui passe de 5 à 7. Ça tombe pile.
- **Le rail est vivant** : `session.js` s'abonne à `topics-store` et re-render l'aside **seulement si le rail est monté**, pour qu'une conversation démarrée ne repeigne jamais tout parce qu'un dossier a bougé.
- **Rendu à zéro condition satisfaite = rien du tout**, donc un hero sans topics est octet pour octet le hero que l'app a toujours eu.

#### Scan — deux gestes, une primitive

`drainPool(n)` est la seule mécanique : prendre `n` dossiers du puits, les poser en `unseen` / `ageDays: 0`, et **vieillir tout le reste d'un jour** pour que les arrivants soient vraiment les plus récents et que les groupes de date glissent comme dans la vie.

- **`refreshTopics()` = `drainPool(2)`** — le bouton **Refresh now**, avec son état scanning (`.archie-loader` + skeletons ~2 s) et son toast.
- **`maybeAutoScan()` = `drainPool(1)`**, appelé au boot dans [`app.js`](../../src/app.js) sous `isFlagOn("topics")`. C'est l'autre moitié de « ça se met à jour tout seul » : quelque chose attend déjà quand on arrive, sans que personne ait cliqué. **Une fois par chargement de page, dans un booléen de module — pas de `sessionStorage`, et c'est délibéré** : un reload doit rejouer un arrivage (c'est ce qui donne la sensation d'un site où l'on revient, et ça garde la démo re-déclenchable), et ça n'ajoute aucune persistance à un proto qui n'en stocke presque pas. **Un** dossier et pas deux, pour que Refresh reste le geste le plus fort.
- Le puits (`mocks.topicScanPool`) est passé de **4 à 8** dossiers : à 4 il était sec après deux Refresh et la promesse ne tenait pas une démo. `global-trends` y vit exprès — c'est la seule source sans dossier seedé, donc l'allumer puis scanner est la façon la plus nette de voir une source prendre vie.

#### Empty states

Trois culs-de-sac distincts sur la section : rien d'activé nulle part (**« Tell me what to watch »** → `/topics/settings`, l'endroit qui règle le problème), filtres sans résultat (**« Nothing matches those filters »**, qui nomme **les deux** facettes — « nothing from that source » est faux quand c'est le Playbook qui exclut), feed vidé à la main (**« Nothing new right now »** + la cadence la plus rapide). Précédence voulue : des dossiers avec zéro source active affichent quand même le feed — ils sont toujours là à lire.

### La page de réglages (`/topics/settings`, [`screens/topics-settings.js`](../../src/screens/topics-settings.js))

**Une page, pas un onglet.** Un onglet donnait à la config le même poids que le feed, ce qui est faux pour ce qu'elle est : on règle ses sources une fois puis on lit des topics pendant des mois. Le feed est la destination ; ceci est un endroit où l'on passe de temps en temps. Ce **n'est pas** un retour de la page Settings agrégée revertée trois fois : la règle du projet autorise la config sur l'entité qui la possède **ou sur une route scopée à une seule feature**, et c'est la seconde. `route()` ancre sa regex (`^…$`), donc `/topics/settings` est un frère distinct de `/topics`.

- **Entrée** — un bouton **libellé** « ⚙ Settings » à côté de Refresh now (un cog nu obligerait à survoler un glyphe pour savoir ce qu'il ouvre), plus le CTA de l'empty state « Choose what I watch » (une **action**, pas le nom de la surface : « Tell me what to watch » → [Settings] serait un cul-de-sac plus faible). Le titre de la page est **« Topics settings »** et pas un « Settings » nu : sur une route où le projet interdit d'agréger la config, un titre qui dit seulement Settings se lit comme global — la même erreur que les trois pages revertées. **Sortie** — le back du topbar (`backTargetFor`, même mécanisme que `/playbook/:id`), qui **remporte `?pb=`** : un feed filtré survit à l'aller-retour. L'entrée de nav Topics reste allumée (`match` en préfixe).
- **Chrome DS « settings »** — `--sys-settings-*` pour la coquille et les cartes (`content-background-color`, `-internal-margin`, `-vertical-spacing`, `-max-width-lg` **1200px** — voir la grille ci-dessous ; `card-background-color` / `-border-color` / `-border-radius` / `-internal-padding`), `.ap-card` + `.ap-card-title`, `h1.ap-h1` (**24px**, pas le `.ap-h2` de la recette : à 18px le titre de page n'est qu'à 2px des titres de carte et la hiérarchie se lit plate — et 24 est aussi la taille du titre du feed) + `p.ap-body`. Les guidelines interdisent les `--ref-*` génériques **pour la coquille et les cartes** ; les gaps intra-composant restent sur `--ref-spacing-*`, exactement comme l'exemple de la recette. Seul `--sys-settings-card-feature-lock-border-color` était utilisé dans l'app avant : c'est donc la **première utilisation de la moitié layout** de cette famille. **Pas de save bar** — tout commit immédiatement.
- **Un seul Playbook à la fois**, scopé par `?pb=` (le même param que le filtre du feed). Le scope est **au-dessus** des cartes : c'est le sujet de la page, pas une de ses sections. « Playbook » le nomme en prose en plus d'offrir le contrôle — une page qui ressemble à des réglages se lit sinon comme globale, et `.ap-select` se réduit à une option quand il n'y a qu'un Playbook. Empiler un bloc par Playbook a été essayé : à vingt Playbooks c'est 120 switches et six descriptions répétées vingt fois — et ce sont les **descriptions** qui font exploser la page.
- **Une barre de scope, puis une carte par source.** Les deux contrôles de niveau page — quel Playbook, quel rythme — sont **deux `.ap-form-field` côte à côte** (label au-dessus du `.ap-select`), pas une carte chacun : la même forme à deux selects que la barre de filtres du feed, donc les deux écrans se ressemblent. Puis un label de groupe _« Sources · 2 of 6 on »_ et **les six sources en cartes**, deux colonnes.
  - **Pourquoi ce n'est plus une carte par contrôle + six lignes dans une septième** (la première version) : un titre de carte au-dessus d'un seul `.ap-select` est surtout du padding — la page se lisait comme deux boîtes presque vides — et **une ligne ne peut pas porter les options propres à une source**, ce qui est précisément la raison d'être des cartes. Le pied de carte est ce **slot** ; aujourd'hui il ne contient que la dépendance Playbook, pour les deux sources concernées.
  - **`-max-width-lg` (1200) et deux colonnes**, pas les 700 de la recette « formulaire » : à 700 deux colonnes sont serrées et une colonne donne 900px de scroll de bandes larges et courtes… qui relisent comme des lignes. À 1200 chaque colonne fait ~570px — une largeur de carte. La prose au-dessus est plafonnée à 72ch séparément.
  - **Le passage à une colonne est une `@container` query**, pas une media query : la sidebar se replie, donc la largeur du viewport ne dit pas la largeur du contenu.
  - **OFF = la carte perd son fond** et laisse voir la page à travers (plus badge en grayscale et texte atténué), donc la grille dit d'un coup d'œil ce qui est vivant. **La bordure est identique dans les deux états** — l'état d'une carte est dans son contenu, pas sur son cadre.
  - Les cartes d'une même rangée sont **à hauteur égale** et le pied est poussé en bas (`margin-top: auto`), pour que les notes s'alignent au lieu de flotter.
- **Commit direct** — un switch écrit via `updateContext`, `contexts-store` notifie, `subscribeContexts` repaint, et le focus est **remis sur le switch** (sinon chaque bascule au clavier renvoie en haut de page). `change` et pas `click` (un clic sur le `<label>` se propage à l'input, ce qui doublerait ; et `change` attrape l'Espace). Ids stockés **dans l'ordre du catalogue**. Recherche dans le picker au-delà de 8 Playbooks.
- **Dire que les autres diffèrent** — _« 3 other Playbooks watch different sources »_, parce qu'un-à-la-fois invite au « je croyais avoir réglé ça partout ».
- **Empty state** — aucun Playbook (mode `new-alt`) : **« No Playbooks yet »** + lien vers `/contexts`.

⚠️ **Deux pièges DS rencontrés ici**, valables ailleurs : `.ap-select-not-found` et `.ap-selection-dropdown-empty` portent un `display` qui bat `[hidden]` → masquer en `style.display` inline. Et **des backticks dans un commentaire HTML terminent le template `html``**.

### La dialog du dossier ([`topic-modal.js`](../../src/components/topic-modal.js))

`.ap-dialog` **720px** — c'est de la prose, le 920 des connecteurs dépasse une mesure confortable. Lifecycle standard via `modal-coordinator` (un overlay à la fois, focus restore, Esc / backdrop). L'ouvrir vaut lecture (`markSeen`).

Titre = **l'accroche** (le constat est ce qu'on vient lire ; un « Topic » générique au-dessus ne fait que le pousser vers le bas). La provenance est un **kicker AU-DESSUS** (badge + source · âge + chip Playbook), pas un sous-titre en dessous : même ordre que la carte du feed qu'on vient de cliquer, donc la dialog se lit comme cette carte ouverte. En `.ap-dialog-subtitle` elle était à **16px**, une seule marche sous un titre de 24 — l'en-tête se lisait comme deux titres ; elle est à 12px. Le Playbook reste un `.ap-tag` comme sur la carte : son nom contient lui-même un point médian (« Pawtrack · always-on ») et en texte dans une ligne à séparateurs, le kicker devenait quatre points d'affilée. Accroche plafonnée à **42ch** (34 forçait un retour que le conteneur ne demandait pas : 512px dans une colonne de 654) + `text-wrap: balance`. **Filet sous l'en-tête**, parce que le corps _scrolle_ : sans lui la prose glissait sous le titre sans rien pour dire que le titre est une couche fixe — le DS en met déjà un au-dessus du footer, la zone de lecture est donc bornée en haut et en bas.

Corps : eyebrow orange **« What I found »** (`ap-icon-sparkles` à 14px, pas 16 — à 16 l'icône était plus grosse que le mot de 12px à côté), titre d'analyse, les paragraphes ; puis un filet, **« Source posts »** + compteur, et les cartes de posts. Footer : **Start a chat** (`primary orange` — il n'y en a qu'un ici) + **Not for me**.

**C'est la seule surface de l'app dont le métier est de lire**, donc la prose a un réglage de lecture et pas le réglage d'UI : **16px** (`--ref-font-size-md`, la taille que le DS emploie lui-même pour un sous-titre de dialog) et **la couleur de texte par défaut, pas `-light`** — trois paragraphes d'argumentation en 14px gris, c'était le plus petit texte de l'app pour le plus gros travail, et le gris clair rendait l'argument plus pâle que le mobilier autour. `line-height` 1.65 et **24px entre paragraphes** : à 16/1.65 une ligne fait 26px, donc l'ancien gap de 16 était inférieur à une ligne et les paragraphes se lisaient comme un seul mur. Mesure plafonnée en `ch` (68), pour tenir ~72 caractères quelle que soit la taille.

🐛 **Corrigé au passage** : « Not for me » ne levait **jamais** son toast Undo. `onClick` appelait `close()` — qui remet `onDismiss` à `null` — _avant_ `onDismiss?.(id)`, donc l'appel était un no-op silencieux. Le callback est maintenant capturé avant la fermeture. Le Dismiss de la carte n'était pas touché, seulement celui de la dialog.

**Social post card** ([`social-post-card.js`](../../src/components/social-post-card.js)) — le post publié par **quelqu'un d'autre**, comme preuve. Délibérément pas `top-post-card` : celui-là résout l'identité via tes propres profils connectés et présente ses chiffres comme une décision de perf. Ici l'auteur n'est pas toi et l'engagement fonde une affirmation. Avatar DS teinté (`data-accent`), handle, réseau · âge, la marque officielle du réseau en haut à droite (les glyphes `-official` du DS **portent leurs propres couleurs** — des SVG data-URI, donc aucun hex tiers en dur), texte, et les compteurs compactés (`1.4K`). `compact: true` retire l'engagement et clampe à 2 lignes.

### Ce qu'on peut en faire

Deux actions, pas plus : **Start a chat** et **Dismiss**.

- **Start a chat** ([`topic-flow.js`](../../src/topic-flow.js)) — `openTopicInChat()` arme le handoff `pendingTopicChat` et navigue vers `/session/new-<ts>?contextId=…&title=<accroche>` (les query params pilotent déjà le nom et le Playbook d'une session `new-*`, donc le chat est correctement lié dès sa première frame). Au mount, `session.js` consomme le handoff → `startTopicChat()` : `markSeen`, puis **`addReadySource()`** (le hook existant, déjà utilisé par un top post repurposé), puis la lecture d'Archie, puis un Quickpicker de trois questions + custom + Skip.
  **Pourquoi une source** : plutôt qu'inventer une surface d'action, le topic entre par le pipeline. Tout ce que l'app sait déjà faire (Extract ideas, Draft, Ask, le panneau Sources) s'allume tout seul — **zéro ligne dans `sources-stream.js`**. C'est aussi ce qui met le topic dans le thread comme **carte** : `intake-lifecycle` poste un turn source-intake pour toute source qui arrive après le mount, donc le pick est visible comme l'est une source choisie. Un `postSelectionEcho` par-dessus empilait deux fois la même accroche.
  **Depuis le rail du hero aussi** : le handler appelle `openTopicInChat()` **tel quel**, qui mint une nouvelle session. La session vide qu'on quitte n'a ni thread ni source — elle est jetable — donc il n'y a rien à préserver et **zéro nouvelle plomberie** ; en prime le chat naît lié au Playbook du topic et déjà nommé.
- **Dismiss** — masque, ne supprime pas, donc le toast peut vraiment offrir **Undo** (`restoreTopic`). Le même toast depuis la carte, la dialog et le hero (la dialog reçoit un `onDismiss` au lieu d'en posséder un second). Écarter un dossier doit vouloir dire la même chose partout.

### Le compteur de la sidebar

Le badge de la ligne **Topics** compte les **unseen**, pas le total : la ligne est une notification. Il somme **tout le compte** — l'arrivée est un évènement account-level même si la config qui l'a produite est par Playbook. `subscribeTopics` re-render la sidebar, donc lire ou écarter un dossier bouge le badge sans changer de route.

### Une seule source de vérité pour l'âge

`ageDays` — pas d'horodatage réel : un proto n'a pas d'horloge fiable, et des dates mockées qui dérivent avec l'âge du fichier lisent moins bien qu'un « 3 days ago » stable. Le feed **groupe** dessus **et** chaque libellé en est **dérivé** via `topicWhen()`. Un `scannedOn` stocké a existé puis a sauté : chaque scan vieillit tout d'un jour, donc la chaîne écrite disait encore « yesterday » sur une carte que le feed avait déjà passée en semaine dernière. C'est aussi ce qui fait tenir l'auto-scan : le nouveau dossier arrive à `ageDays: 0` (« just now ») pendant que la une de la veille glisse à « yesterday », sans qu'aucune date n'ait été écrite nulle part.

---

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — le _comment_ technique
- [`ROUTES.md`](ROUTES.md) — route table + handoffs + URL state
- [`STORES.md`](STORES.md) — API par store
- [`UI-PATTERNS.md`](UI-PATTERNS.md) — usage concret du Design System
- [`GLOSSARY.md`](GLOSSARY.md) — vocabulaire produit
