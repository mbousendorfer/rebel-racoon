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

Listening source → Topic ──→ (chat) ──┘   (flag `topicFeed`, voir §17)
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
  une **vraie dropzone média** — pointillé, fond `grey-05`, glyphe image, 108px, aligné à gauche —
  « Add an image » + « I'll write the brief from this draft — or drop an image here. » + un
  `.ap-button.mermaid` **Generate** (génère **en place**, sans studio) et « or upload a file » en
  `.ap-link`. Trois entrées donc : générer, glisser un fichier, ou en choisir un. Voir
  [`UI-PATTERNS.md`](UI-PATTERNS.md) § Fente média vide pour les deux pièges (le bouton mermaid ne
  rend correctement que sur du blanc — d'où `--ap-mermaid-inner` ; et `bindDropzone` détournerait
  les clics des boutons).
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

- **Le bouton du rail de la carte** (`data-post-studio`, entre _Regenerate_ et _Save_) → ouvre le
  studio dans le mode qu'appelle le média du draft : carousel → le set, une image → Edit, **pas de
  média → le flow Generate**. C'est l'entrée principale, et la seule qui marche dans les trois
  états : le rail est le seul endroit toujours visible et indépendant du média.
- _« Edit »_ / _« Edit slides »_ sur le média lui-même (`data-post-image-edit`) → même fonction
  (`onPostStudio`), en contextuel. Révélé au survol de l'image.
- ⚠️ _« Generate »_ dans la fente vide (`data-post-image`) **n'ouvre pas le studio** : il génère une
  image en place via `quickGenerateUrl` ([`image-studio.js`](../../src/image-studio.js)) — même mock
  Picsum seedé, ratio par défaut du réseau, aucun état de studio créé, un nonce de module pour
  qu'un second appui donne une autre image. Le studio est là pour _piloter_ une génération ; payer
  un modal plein écran pour appuyer sur un bouton était le chemin long.

⚠️ Historique à ne pas refaire : pendant un temps `data-post-image` était la seule entrée du flow
Generate, puis la génération en place l'a prise **sans rien mettre à la place** — un draft sans
image n'atteignait plus le studio du tout. D'où le bouton du rail. N'ajoute pas une troisième
affordance dans la fente : c'est ce qui avait aplati sa hiérarchie.

Tout passe par `onPostStudio` dans [`right-panel.js`](../../src/components/right-panel.js).
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

Un Playbook est une **fiche** : chaque section répond à « qui êtes-vous ? ». La config opérationnelle (quelles sources d'écoute tournent, à quelle fréquence) vit dans son propre store, clé par Playbook, et s'édite sur la route qui possède la feature — voir §17. Une section Topics a été essayée puis retirée : une grille d'interrupteurs se lisait comme un panneau de réglages coincé dans un profil. Le champ `ctx.topics` qui la portait est parti avec elle.

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

### `/` ([`screens/dashboard.js`](../../src/screens/dashboard.js)) — un redirect, et rien d'autre

**Un redirect pur** : first-time sans Playbook → `/welcome-alt` ; sinon → session la plus récente (ou `/session/new`). C'est le bon défaut pour un outil qu'on ouvre avec une tâche déjà en tête, et c'est le seul comportement de cette route.

Elle a rendu quelque chose, une fois : derrière le flag `frontPage`, `/` devenait une **front page** magazine remplie par le listening — une une, une grille de six, des puces de rubrique. C'est parti avec le magazine Topics sur lequel elle était construite (voir §17). Si une front page revient, elle revient **sur la donnée du Topic Feed**, pas comme second lecteur d'un second store.

### Sidebar ([`sidebar.js`](../../src/components/sidebar.js))

- **Head** : wordmark « Archie » + badge **BETA** (mint un chat), toggle collapse.
- **Nav** : **New chat** (⇧⌘O), **Search…** (⌘K), puis **Playbooks**, **Connectors** (flag `connectors`) et **Topic Feed** (flag `topicFeed`, `ap-icon-antenna`) avec count badges. Le count du Topic Feed est le nombre de Topics **à revoir** du feed du Playbook par défaut — c'est une notification, donc il compte ce qui attend une réponse (voir §17). Il n'y a **pas** de ligne Home : `/` est un redirect.
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
| `topicFeed`              | Topic Feed (listening)                           | **OFF** | Toute la feature **Topic Feed** (§17) : la route `/topics` + sa page `/topics/settings`, l'entrée de nav et sa marque d'unread, la liste « Fresh topics to review » du chat neuf, et l'entrée « Pick from the Topic Feed » du menu Add. Un deep-link périmé rebondit sur `/`. La donnée (feeds + Topics seedés) reste présente quand OFF, comme `playbookCompetitors`.                                                                                                                                                                                                                                                                 |
| `playbookSharing`        | Playbook sharing (org-wide)                      | **OFF** | **À qui appartient un Playbook** (§9bis). OFF (défaut) = un seul utilisateur implicite, tout est visible et éditable comme avant ; ON = chaque Playbook est **personnel** ou **partagé à toute l'org** (jamais nommément), lecture seule pour les autres, droits manager, chat dégradé après perte d'accès, section **Your role** dans l'Admin. Les deux Playbooks de démo (`ctx-acme-devrel`, `ctx-orphan-brightline`) et le chat `s-brightline` ne sont seedés **que** sous ce flag — contrairement à `topics`, ce ne sont pas des champs qui roulent avec la donnée mais des objets entiers qui n'ont aucun sens sans propriétaire. |
| `imageStudioAutoBrief`   | Image Studio: auto-written brief + centred setup | **OFF** | Variante Image Studio (§7) : le brief est un document éditable en blocs, écrit depuis les réglages, avec sa propre mise en page prompt+options / preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `imageStudioGridBrief`   | Image Studio: brief as an editable grid          | **OFF** | Troisième variante Image Studio (§7) : le brief devient une grille de cartes configurables (pas de prompt en prose). Gagne sur `imageStudioAutoBrief` si les deux sont ON.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Persistés en `localStorage` (`archie-feature-flags`), lus via `isFlagOn()`. Voir aussi [`STORES.md`](STORES.md).

⚠️ Le `NAV` de [`sidebar.js`](../../src/components/sidebar.js) accepte encore un `flag` en **liste** aussi bien qu'en string. Plus aucune ligne n'en a besoin — la seule qui en avait deux était Home (`frontPage` + `topics`), et les deux flags sont partis avec elle. La capacité reste : une ligne de nav qui survit à l'une de ses dépendances est pire qu'une ligne absente.

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

## 17. Topic Feed — la file du listening (flag `topicFeed`, défaut OFF)

Le seul endroit où **Archie propose** au lieu d'attendre. Le listening Agorapulse remonte des posts sociaux sur huit sources rattachées à un Playbook ; Archie en assemble un **Topic** : une accroche (le constat), une analyse écrite en deux sections, et les posts qui la fondent. `/topics` est la **file où on la trie**.

Porté depuis le fork `axel-van/rebel-racoon` (@ `dbfd9d3c`), après l'audit UX qui a motivé les corrections signalées ci-dessous. Fichiers : [`topics-catalog.js`](../../src/topics-catalog.js), [`topic-feeds-store.js`](../../src/topic-feeds-store.js), [`topics-store.js`](../../src/topics-store.js), [`topic-article.js`](../../src/topic-article.js), [`topic-flow.js`](../../src/topic-flow.js), [`screens/topics.js`](../../src/screens/topics.js), [`screens/topics-settings.js`](../../src/screens/topics-settings.js), [`components/topic-card.js`](../../src/components/topic-card.js), [`components/topic-picker-modal.js`](../../src/components/topic-picker-modal.js), [`components/topic-ignore-modal.js`](../../src/components/topic-ignore-modal.js), [`components/social-post-card.js`](../../src/components/social-post-card.js).

### ⚠️ Ce qui a été supprimé pour faire place

Le proto portait un **magazine** Topics : une une + une grille, transverse à tous les Playbooks, avec `ctx.topics` sur le Context, une front page sur `/` derrière `frontPage`, un rail de trois accroches dans le hero, et deux verbes (Start a chat / Dismiss). **Tout est parti** — 8 modules, 5 feuilles CSS, les flags `topics` et `frontPage`, la ligne de nav Home. Le fork avait laissé les deux features tourner côte à côte, deux entrées de nav avec la même antenne, deux stores, deux pages de réglages : intenable en démo.

C'est ce qui a libéré les noms canoniques (`/topics`, `topics-store.js`, `topic-card.js`, `topic-flow.js`), que le port a repris — au lieu d'installer le troisième vocabulaire `research` / `lane` / `brief` que le fork trimballait dans son code pendant que son UI disait Topic Feed / feed / Topic.

### L'invariant dont tout dépend

> Le **statut de revue** d'un Topic et ses **deux signaux d'attention** sont trois choses séparées.

`status` (`new` / `used` / `ignored`), `isTrending` et `isUpdated` sont trois champs. Ni signal n'est un quatrième statut, donc un Topic peut être **Used et trending** à la fois — et un signal ne **prime jamais** sur le filtre de statut : un Topic ignoré qui se met à monter reste caché. Comme section dépliable, « trending » devait outrepasser le filtre, ce qui faisait mentir le filtre.

Le **triage vit dans sa propre map**, pas écrit sur le Topic : un Topic est ce que le scan a rendu (côté serveur), une ligne de triage est ce que **cet** utilisateur en a fait. Les garder séparés est ce qui permet à un re-scan de remplacer un Topic sans écraser la réponse.

**Les deux signaux sont le composant STATUS du DS**, pas un sosie : `.ap-status` avec la tonalité et l'icône que [`topics-catalog.js`](../../src/topics-catalog.js) **déclarait déjà** par signal — `orange` pour Trending, `tagOrange` pour Updated. Le modificateur `no-dot` libère le slot de la pastille pour le glyphe du signal : une flèche vers le haut dit **qui monte** et un refresh dit **qui a été réécrit**, ce que la pastille neutre du composant ne peut pas dire. Fill, hauteur, rayon et typo viennent tous de `--comp-status-*` : zéro CSS propre pour la pilule.

⚠️ **C'étaient deux `<span>` faits main** (`trending-mark` / `updated-mark`, plus une feuille CSS entière) qui ignoraient le catalogue — `findAttentionSignal()` n'avait **aucun lecteur** jusqu'ici. La feuille est supprimée. Effet de bord : l'encre du label passe de la teinte du signal à `--comp-status-color`, donc du texte foncé sur un aplat teinté au lieu d'un texte orange — c'est le traitement du DS, et il contraste mieux. La couleur n'est toujours pas le seul signal : chacun porte son mot.

Un Topic **ignoré n'est jamais remonté par un signal, nulle part**. Cocher **Ignored** dans le filtre est le seul chemin de retour. La règle inverse — « une pointe n'est jamais masquée par le triage » — a été essayée et retirée : elle faisait d'Ignore une suggestion au lieu d'une réponse.

### Les deux stores

**`topic-feeds-store.js`** — un **feed par Playbook** : quelles sources écoutent, à quelle cadence, et quels sites la source Brand website lit. Global, comme `connectors-store` : un feed apparie un Playbook à des sources et tourne sur une cadence, bien avant qu'un chat existe pour tenir ce qu'il trouve.

**Pourquoi un store et pas un champ sur le Playbook** : le magazine gardait la même config en `ctx.topics`. Elle en sort pour la raison que donne [`CONCEPTS.md`](CONCEPTS.md) §1 — un Playbook est une **fiche**, chaque champ répond à « qui êtes-vous ? », alors que « quels feeds tournent et à quelle fréquence » répond à « quel job Archie doit-il lancer ». C'est opérationnel. Ça achète aussi `websites`, qui n'a nulle part où vivre sur un Context : le `websiteUrl` du Playbook est l'adresse canonique de la marque, ceci est la liste de scan d'**un** feed, qui peut ajouter un blog, un site de docs ou un domaine régional.

**Tout Playbook a un feed, et il écoute dès le premier jour.** `provisionMissingFeeds()` en crée un à la lecture, jamais au chargement du module (en mode `new-alt` les stores démarrent vides et les Playbooks arrivent plus tard). Une marque neuve ne tombe jamais sur un écran qui lui demande de configurer quelque chose avant que rien ne puisse arriver — et c'est aussi pourquoi rien ici ne peut **supprimer** un feed : la lecture suivante le reconstruirait.

**`topics-store.js`** — les Topics + le triage. `getTopicsForFeed` · `groupTopicsByAge` · `countToReview` · `countFresh` · `getFreshTopics` · `getTopicById` · `topicTitle` · `defaultFilters` / `narrowedGroupCount` · `markUsed` / `ignoreTopic` / `unignoreTopic`.

**Un signal ne vit que dans « Last 7 days ».** Trending et Updated sont des affirmations sur **maintenant**. Une carte portant l'une des deux sous un intertitre « il y a trois semaines » se contredit, et c'est l'intertitre qu'on croit. Les flags sont donc **effacés** au-delà du premier groupe d'âge dans `withTriage()`, pas laissés au seed : chaque lecture passe par cette fonction, donc le feed, la liste in-chat, le picker et tous les compteurs sont d'accord gratuitement, et aucun seed futur ne peut réintroduire la contradiction.

### Les huit sources ([`topics-catalog.js`](../../src/topics-catalog.js))

CONFIG, pas contenu : le fichier ship avec l'app et doit exister en mode `new-alt` aussi (une marque neuve voit les huit cartes sur la page de réglages). Même partage que `ff-catalog.js` vs `mocks.js`.

| id                      | Nom                   | `live` | `playbookAnchor` |
| ----------------------- | --------------------- | ------ | ---------------- |
| `competitor-posts`      | Competitors           | ✅     | `competitors`    |
| `influencer-posts`      | Influencers           | —      | `null`           |
| `brand-website`         | Brand website         | —      | `null`           |
| `brand-feedback`        | Brand feedbacks       | —      | `null`           |
| `competitor-monitoring` | Competitor monitoring | —      | `competitors`    |
| `industry-trends`       | Industry trends       | —      | `null`           |
| `global-trends`         | Global trends         | —      | `null`           |
| `internal-ideas`        | Internal team ideas   | —      | `null`           |

`accent` est une **clé sémantique, jamais un hex** → `.topic-badge--<accent>` ([`topic-badge.css`](../../styles/components/topic-badge.css), partagé par la carte, l'article et les cartes de réglages). `playbookAnchor` — jamais l'id — dit quelle section du Playbook alimente la source, donc la carte offre un deep-link sans hardcoder d'id ; `null` = le listening l'alimente directement.

⚠️ **`competitor-posts` est la seule `live`, et c'est porteur** : le filtre de source par défaut est dérivé de `LIVE_SOURCE_IDS`, donc un Topic seedé sur une source non-live serait filtré hors de son propre feed dès le premier paint. Les sept autres sont déclarées pour la page de réglages, où leur switch est **désactivé** avec un tag « Coming soon » — un switch qui bascule et ne change rien est pire qu'un qui dit qu'il n'est pas prêt.

**Le registre est neutre, pas la 1ʳᵉ personne d'Archie.** Archie dit « je » partout où il vous **parle** : le thread, les toasts, les empty states. Ceci est de la copy de réglages, et la copy de réglages explique ce que le système fait quand personne ne regarde. À la 1ʳᵉ personne les mêmes phrases se lisent comme des promesses de conversation, ce qui est le mauvais registre pour un interrupteur qu'on règle une fois.

**Cadences** : Weekly / Monthly / Quarterly. **De la copy, jamais un timer** — un tick hebdomadaire ne partirait jamais dans une démo.

### Les deux `kind`, qui sont un ÉTAT parmi six

Un Topic est soit draftable maintenant (`ready`), soit un thème à garder (`later`). ⚠️ **Cet axe était la rangée d'onglets au-dessus de la liste ; il est maintenant l'état « For later »** — une ligne de filtre et une pastille, au même niveau que les cinq autres. Un `ready` ne porte rien : comme `To review`, il est l'absence de marque. Un seul vocabulaire, pas deux : le fork portait un `researchType` valant `ready-to-post` / `content-strategy` et le mappait sur des ids de segment `ready` / `later` au rendu — une couche de traduction dont le seul métier était de traduire un ancien nom.

**Deux corrections d'audit ici** :

- Son prédicat de segment lisait aussi un **pilier de contenu** : un Topic `content-strategy` déjà rattaché à un pilier comptait comme ready-to-draft. Les piliers ne font pas partie du port, donc la clause est partie et la règle est celle qu'elle voulait être — la classification du scan décide, rien d'autre ne déplace un Topic.
- Le **non-classé tombe dans `later`**, pas dans `ready`. C'est ce que dit la spec du fork (« Ready to draft revendiquerait une maturité que rien n'a gagnée ») et son code faisait l'inverse.

### La file (`/topics`, [`screens/topics.js`](../../src/screens/topics.js))

**Un Playbook à la fois, porté par `?pb=`.** Le fork avait introduit un scope global persisté (`active-playbook.js`) qui avait supprimé quatre pickers d'un coup — puis son switcher de rail a été garé et le module est resté source de vérité. Résultat : le select « Playbook » de l'entête du feed **ressemblait à un filtre de page et re-scopait l'app entière** (le compteur de la sidebar, le Playbook d'un chat neuf, le picker du composer) et le persistait en `localStorage`. `?pb=` dit la même chose, survit à un lien, et **s'arrête à cet écran**. La page de réglages lit le même param, donc le scope survit à l'aller comme au retour.

#### La page est un LECTEUR

L'anatomie est celle d'un lecteur : une barre de scope en haut, une liste à gauche, un volet de lecture qui prend le reste, et **les deux colonnes défilent indépendamment**. Ce n'est pas cosmétique — c'est ce qui distingue un lecteur d'une page web à sidebar.

Le premier jet était une page : un seul scroller, aucune largeur maximum, et l'article en carte flottante collée en haut. Deux défauts :

- **Aucune largeur maximum.** Sur un écran large la liste s'étirait au-delà de 1500px pendant que le volet restait collé à son plancher de 440px. Exactement à l'envers.
- **Un seul scroller**, donc lire l'article faisait défiler la liste sous lui.

⚠️ **Le cadre appartient aux OBJETS, pas à la colonne qui les liste.** Un passage intermédiaire a fait le contraire : pour casser un effet « mur de cartes », le cadre est passé des cartes à la rangée qui les contient, avec un filet entre la liste et le volet. C'était le mauvais bout — **le mur venait des gaps et du poids, pas du fait que les cartes ont des bords** — et une surface unique de 1440px se lit comme une dalle qui n'appartient à aucune autre vue de l'app. Les cartes sont revenues, le volet est une carte à part, et la rangée ne fait plus que les espacer. Si une liste pèse trop : resserrer les gaps, alléger la graisse, clamper le texte — pas déshabiller les items.

**Largeur maximum : 1132px, ALIGNÉ À GAUCHE — et calculée en CSS, pas écrite.** `--topic-measure` (600px, ~68 caractères) et `--topic-list-max` (460px) sont déclarées sur `:root` dans [`styles/screens/topics.css`](../../styles/screens/topics.css) et tout l'écran est de l'arithmétique dessus : le cap vaut `list-max + gap + measure + 2× padding du volet`, le volet vaut `measure + 2× padding`, la liste prend le reste, l'article vaut `measure`. Change la mesure et la page suit.

Le reste va dans la marge de **droite** uniquement : les rangées démarrent au padding gauche de l'écran, là où le titre de la topbar est déjà posé — mesuré, les deux tombent sur 284. ⚠️ C'était centré pendant plusieurs commits et ça se lisait comme un défaut : le shell imprime « Topic Feed » collé au bord gauche pendant que la toolbar, les onglets et le lecteur flottaient ~240px plus loin, donc rien ne partageait de bord avec le chrome au-dessus. **Les deux écrans du Topic Feed ne centrent pas** — `/topics` ici et `/topics/settings` (voir §17.6), pour la même raison à chaque fois : le chrome de la topbar est collé à gauche, donc du contenu centré ne partage de bord avec rien. Le reste de l'app centre encore : `/contexts` et `/connectors` capent à 1280, ce qui est presque toute la largeur de contenu, donc leur décalage est petit. 1132 ne l'est pas.

⚠️ **Le cap précédent était un 1440 écrit à la main pendant que la mesure rendait 542px** (`62ch`, alors que le commentaire à côté disait 68ch). Les 412px de différence restaient en **vide blanc dans la carte de lecture** — 43 % du volet — et un nombre écrit à la main dérive de nouveau à la prochaine retouche de la mesure. Un cap sur une surface de lecture se **dérive** de ce qu'elle contient.

**Le volet est la moitié FIXE, la liste celle qui s'étire** — `flex: 0 1 calc(measure + 2× padding)` contre `flex: 1 1 0`. C'est l'inverse de ce qui était écrit ici, et l'inversion suit du cap : une fois la page capée, « une fenêtre plus large achète de la place de lecture » ne décrit plus rien, et la seule question qui reste est ce qu'une fenêtre plus **étroite** doit rabioter. Elle doit le prendre sur la file, jamais sur la prose. Au cap le reste vaut 460 — l'ancien plafond, retrouvé par le calcul au lieu d'être posé — et le **plancher de 340** parce qu'en dessous trois lignes de titre cessent d'être une ligne et se mettent à faire un paragraphe. (La base doit être `0`, pas `auto` : sur `auto` la liste part de la largeur de ses cartes, grossit au-delà du reste et écrase le volet — mesuré à liste 729 / volet 379, layout inversé.)

**Le volet épouse la hauteur de son article**, `align-self: flex-start` + `max-height: 100%`, et `pane-body` scrolle au-delà. Étiré, une analyse courte laissait une carte vide courir jusqu'en bas de la fenêtre — 479px de blanc mesurés à 1450px de haut. Seul le volet **vide** garde `align-self: stretch` : son unique métier est de tenir la colonne ouverte pour que la liste ne saute pas quand un article s'ouvre.

**LES DONNÉES DE SEED SONT RÉELLES.** Quatre Playbooks viennent de vrais exports d'écoute, portés du fork (`axel-van/rebel-racoon`) : **Agorapulse** (12 topics, le plus riche — 6 ready / 6 later, 9 avec `relevance`, tous avec des posts), **Alliance Jiu Jitsu Carlsbad** (10), **The Dwelling Company** (5) et **Noba Fashion** (4). `Acme · Q2 marketing` (21) reste écrit pour ce proto.

⚠️ **Juger cette feature sur des topics inventés ne marche pas.** Mes 21 topics Acme n'avaient ni `relevance` ni `whyNow` — donc la section Relevance ne rendait rien sur le Playbook par défaut, et comme leurs articles sont courts, le coût vertical de l'en-tête restait invisible. Trois retours produit sur quatre venaient de là. **Évaluer sur `?pb=ctx-agorapulse`.**

⚠️ Le port initial avait relabellisé 12 topics Agorapulse sous un Playbook inventé (« Founder voice only ») : des données réelles sous une marque qui n'est pas la leur, et un doublon exact des originaux une fois ceux-ci importés. Les copies sont supprimées ; ce feed reste seedé mais vide, ce qui donne l'état « feed configuré, rien trouvé encore » à démontrer.

**Deux rangées de page, pas trois — la première appartient au shell.** Le motif d'en-tête maison en compte trois (titre, toolbar, tabs), mais `topbar.js` imprime déjà le nom de la route : l'écran dessine donc la **toolbar** et les **tabs**. La toolbar porte **deux groupes** : le cluster de portée — le select en label inline `Playbook │ …` collé à son cog de réglages, qui configure précisément l'écoute de ce Playbook — puis, après un écart plus large, Filters libellé avec son compteur inline.

⚠️ **Fusionner les deux rangées en une a été essayé et annulé.** L'argument était réel — chaque pixel au-dessus du lecteur est un pixel de prose à faire défiler, et la fusion valait 60px (en-tête 109 → 49) — mais ce n'était **pas** ce qui avait été demandé : le retour signalait le coût vertical, pas une refonte de la barre. Si le sujet revient, le gain est mesuré et la recette connue (la rangée porte le filet, et `.ap-tabs` doit être shrink-wrappé en `width: max-content` sinon les contrôles repassent à la ligne). Voir [`UI-PATTERNS.md`](UI-PATTERNS.md) § En-tête d'écran.

⚠️ **Une rangée de titre dessinée a été essayée et retirée.** Elle imprimait « Topic Feed » 40px sous une topbar imprimant « Topic Feed », sur une rangée qui ne portait rien d'autre que le cog, et le commentaire qui la défendait invoquait `/contexts` — « il dessine les deux, donc le doublon est la convention ». C'était une rationalisation : l'en-tête de `/contexts` porte un sous-titre chargé de données, une recherche et un CTA, donc son titre est un élément sur quatre. Un titre seul ne fait pas une rangée. Le document n'a désormais qu'un seul `<h1>`, celui de la topbar, ce qui est aussi le bon compte pour un lecteur d'écran.

**Le volet stacké se fait amener dans le champ de vision.** En dessous de 760px de contenu deux colonnes sont illisibles, donc le split s'empile et le scroll revient à la racine de l'écran. Ouvrir un article le fait alors défiler jusqu'à lui — arithmétique, pas `scrollIntoView()` : `nearest` refusait de bouger un volet presque aussi haut que le scrollport, et `smooth` perdait la course contre le repaint suivant.

⚠️ **Une seule `@container` query, et c'est une correction.** La réécriture en lecteur avait laissé l'ancien bloc du volet en place, donc **une seconde query à 852px** cohabitait avec la vivante à 760 — et étant plus bas dans le fichier, c'est elle qui gagnait. Entre 760 et 852px de contenu, le split passait en colonne mais la colonne de liste gardait son `flex-basis`, qui devient alors une **hauteur de 340px** : liste écrasée à 2,5 lignes avec son propre scroll, article coincé dessous. Un seul seuil désormais.

⚠️ **`overflow-y: auto` sur `.topics-view` est INCONDITIONNEL**, et pas posé dans la `@container` query. Une container query ne peut styler que les **descendants** de son conteneur, et le conteneur est `.topics-view__body` — un enfant de cet élément. Mise dans la query stacké, la règle avait l'air juste et ne faisait silencieusement rien : en dessous de 760px **rien ne défilait** et tout ce qui passait sous la ligne de flottaison était inatteignable.

**Une `@container` query, pas une media query** : la sidebar se replie et le panneau de droite recouvre, donc la largeur du viewport ne dit jamais la largeur du contenu.

#### Rien d'ouvert, et rien du tout

Le volet **rend un placeholder** au lieu de disparaître, pour que les deux colonnes gardent leurs largeurs et que la liste ne saute pas latéralement chaque fois qu'un article s'ouvre ou se ferme — la seule chose qu'un lecteur ne doit jamais faire.

En revanche, quand il n'y a **rien à lire du tout** — feed vide, filtre qui exclut tout — l'état prend **tout le lecteur** au lieu d'une colonne vide à côté d'un volet vide. Un lecteur sans rien dedans n'est pas un lecteur.

**L'attente, elle, GARDE le split et le dessine en fantômes.** Cinq cartes-fantômes dans la colonne, un article-fantôme à côté, tous dans les vrais cadres aux vraies largeurs (mesuré : 460 et 648, exactement ce que le contenu réel obtient) — donc rien ne saute quand le scan rend. La ligne de statut prend le créneau du séparateur d'âge (« Last 7 days »), le seul qui soit vraiment libre, et garde sa typo pour que le vrai séparateur ne redimensionne pas la rangée. Cinq cartes, pas « autant qu'il en arrive » : le compte est inconnu pendant le scan, et un squelette qui devine est un squelette qui ment.

⚠️ **C'était un `.ap-loader` et une ligne centrés dans le bloc pleine largeur** — un spinner de 12px seul dans ~1100×700 de blanc, suivi d'un lecteur à deux colonnes qui apparaissait autour de lui. Un squelette existe précisément pour empêcher ce saut : s'il ne pré-dessine pas la mise en page, c'est un spinner avec des étapes en plus. La différence avec les impasses est là — elles n'ont rien à pré-dessiner.

#### Les six états, à un seul niveau

**Une seule espèce : la pastille `.ap-status <tone> no-dot` + glyphe + mot.**

| État         | Teinte      | Icône                   | Pastille |
| ------------ | ----------- | ----------------------- | -------- |
| To review    | —           | —                       | **non**  |
| Trending     | `orange`    | `ap-icon-arrow-up`      | oui      |
| Updated      | `tagOrange` | `ap-icon-refresh`       | oui      |
| Already used | `green`     | `ap-icon-rounded-check` | oui      |
| For later    | `blue`      | `ap-icon-bookmark`      | oui      |
| Ignored      | `grey`      | `ap-icon-eye-off`       | oui      |

⚠️ **C'était trois niveaux pour un vocabulaire.** Trending et Updated étaient déjà des pastilles DS ; Already used et Ignored étaient des **icônes nues** en encre neutre avec un `title` ; For later n'était pas sur la carte du tout — c'était un **onglet entier**. Une pastille, une icône et un onglet pour ce qu'un lecteur pense comme une seule liste.

**Le modèle de données n'a PAS été aplati, et ne doit pas l'être.** `status` (la réponse du lecteur, dans la Map de triage), `kind` et `isTrending` / `isUpdated` (le scan) restent quatre champs séparés ; `topicStates(topic)` les dérive en une liste plate. C'est exactement ce qui permet à un Topic d'être **Already used ET Trending** et d'afficher les deux. Les fusionner laisserait un fait masquer l'autre et un re-scan écraser le triage — plus le contrat de tracking `AC-TRK-6`, qui reporte les trois indépendamment, tomberait.

**Trois teintes corrigées au passage** :

- `ignored` était `red` dans la config. L'arbitrage fermé de la feature dit l'inverse — ignorer ne détruit rien, cocher Ignored le ramène. La contradiction a survécu parce que **rien ne lisait le champ** : la carte dessinait une icône neutre. La lire la rend visible.
- `used` était `blue`, justifié par un « tag Ready-to-draft » vert dont le fond aurait collisionné. ⚠️ **Ce tag n'existe pas** — le seul `.ap-tag` d'une surface Topic est le « Coming soon » gris du panneau de filtres. Le motif était périmé, et le bleu était de toute façon la mauvaise couleur : c'est la couleur de **l'interactif** ici, donc une pastille bleue sur une carte cliquable se lit comme un contrôle.
- `later` prend le bleu que `used` libère — info / neutre : garé, pas jugé.

⚠️ **Les onglets `.ap-tabs` sont supprimés** — et avant eux un segmented control, qui était le mauvais composant (le produit emploie des tabs partout où cette forme apparaît, et on ne voyait **qu'une** liste à la fois). Le port du segmented control dans `ds-patches.css` était déjà parti ; `git log -S renderTabs` rend la version à onglets, `git log -S ap-segmented-control` celle d'avant. Les compteurs des onglets sont passés **sur les lignes du filtre**, donc rien n'est perdu.

#### Les filtres

Le **DS Filter dropdown**, porté de la même façon et pour la même raison : options **groupées derrière un déclencheur** → filter dropdown ; bascules toujours visibles sur un petit set plat → filter chips (ce que le magazine faisait, correctement, pour ses six sources).

- **Deux groupes** : **Topic status** est un **`.ap-select` multi-sélection** (les six états, chacun avec son compteur, derrière un trigger), **Sources** reste une liste de cases. Le select économise cinq rangées sur un panneau qui en portait quatorze.
- **Défauts cochés : To review, Trending, Updated, Already used.** For later et Ignored décochés, toutes les sources. Ce qui reproduit **exactement** l'atterrissage d'avant — l'onglet « Ready to draft » plus Ignored décoché — avec un seul contrôle au lieu de deux. Ignored veut dire « pas celui-là » ; For later veut dire que le scan n'a rien trouvé de draftable, et atterrir sur une liste qui mélange les deux enterre la raison d'être là. Already used reste DEDANS : le travail existe, il reste trouvable, et le masquer est la façon dont le même Topic se fait drafter deux fois.
- **Une seule sémantique, sur chaque ligne : décocher un état masque ce qui le porte.** Un Topic s'affiche si **tous** ses états sont cochés. ⚠️ **Pas** un OU sur les lignes cochées : sous un OU, un Topic _ignored + trending_ réapparaîtrait dès que Trending est coché — c'est le groupe « Trending, normally hidden » recalé par `AC-PICK-2b` et une violation directe de la règle « un Topic ignoré n'est jamais remonté par un signal ». Ce que ça coûte, dit franchement : on peut **masquer** un état, pas **l'isoler** — il n'y a pas de « montre-moi uniquement ce qui monte ».
- **Le trigger nomme les EXCLUSIONS, pas un compte.** « All except For later, Ignored » au repos, « All states » quand tout est coché, « No states » quand rien ne l'est. Un contrôle replié coûte normalement la seule chose qu'on veut savoir d'un filtre rétréci — _qu'est-ce que je ne vois pas ?_ — et un « 4 sur 6 » ne le dit pas. Au-delà de deux exclusions il liste les états cochés ; dans les deux cas il ne tronque jamais.
- **⚠️ L'ouverture du select est dans `view`, pas laissée à `<details>`.** Cocher une option déclenche `change`, qui repeint l'écran, qui reconstruit le panneau : un `<details>` nativement ouvert se refermerait à chaque clic, donc cocher quatre états voudrait dire l'ouvrir quatre fois. `view.statesOpen` survit au repaint comme `view.filtersOpen`, et le clic du `summary` est intercepté (`preventDefault`) pour que la bascule native ne se désynchronise pas du drapeau. Escape le ferme **seul** — il est la chose la plus intérieure ouverte — puis le panneau, puis le volet.
- **⚠️ `.ap-select-dropdown` est `position: absolute` et le contenu du panneau est `overflow-y: auto`** : le menu est donc **rogné** par ce scroller. Il tient aujourd'hui — mesuré : bas du menu à 334 contre un bas de contenu à 681, sur un panneau plafonné à `min(90vh, 750px)` — parce que c'est le **premier** leaf et qu'il n'y a que six options. Le déplacer sous les huit sources le couperait.
- **Les compteurs des onglets sont ici**, un `.ap-counter normal grey` par ligne, non filtrés : ils décrivent le feed, donc ils ne bougent pas pendant qu'on coche. Le panneau devient le seul endroit où la forme du feed est lisible.
- **Le badge compte les GROUPES rétrécis**, pas les options cochées — « 2 » veut dire deux groupes qui filtrent. Compté contre le **défaut**, pas contre l'exhaustivité, sinon le badge serait épinglé à 1 dès l'ouverture du panneau.
- **Des mots seulement**, pas de glyphe à côté d'une option : les glyphes de statut veulent dire quelque chose sur une carte, où ils tiennent lieu de phrase ; dans une liste de cases libellées ils sont une seconde lecture d'un mot déjà là.
- Les sept sources non-live sont **désactivées avec un `.ap-tag grey mini` « Coming soon »** — jamais en bleu électrique, qui dans cette app est la couleur de ce sur quoi on peut agir, et une ligne désactivée est la seule chose du panneau sur laquelle on ne peut pas.

#### Groupes d'âge, pagination

Trois groupes, toujours dans cet ordre : **Last 7 days** (`≤ 7j`) / **Earlier this month** (`≤ 30j`) / **Earlier**, groupes vides masqués. Définis dans le store, à côté du parseur — le feed demande dans quel bucket tombe un Topic, il ne décide pas de ce que veut dire « 7 jours ».

`ageLabel` (« 2d ago ») est **la seule entrée d'âge** : le « 2d ago » de la carte et le groupe où elle tombe en dérivent tous deux, donc les deux ne peuvent pas se contredire. `topics-store.ageMinutes` est la couture à remplacer par de vrais horodatages.

**Dix par page.** La sentinelle de la dernière page charge la suivante à l'entrée dans le viewport, et il y a aussi un **Load more** explicite : les deux font exactement la même chose — une liste infinie sans bouton est inutilisable au clavier. `loadingMore` empêche un second chargement pendant qu'un est en vol.

**La position de scroll survit à toute action** : trier un Topic à mi-liste ne doit pas renvoyer le lecteur en haut. `paint()` restaure l'offset du scroller autour du repaint.

#### Les deux cartes, et le lu / non-lu ([`topic-card.js`](../../src/components/topic-card.js))

**Deux variantes, toutes deux des cartes** — même surface, même bordure, même rayon — plus la **ligne compacte** de la liste in-chat. Ce qui diffère est ce qui se passe quand on les touche : `--feed` peut être **celle qui est ouverte** à côté de la liste et raffermit alors sa bordure ; `--picker` ne peut pas, puisqu'un clic y choisit le Topic et que rien ne reste sélectionné assez longtemps pour être marqué.

La règle de base du composant ne porte **aucun** cadre, et ça reste délibéré : chaque déclaration de cadre vit sur une variante, parce qu'une `border` partagée est exactement ce qui a fait fuir le cadre d'une variante dans l'autre pendant la construction.

Le feed et le picker sortent **la même carte, partie pour partie** — même badge, âge, glyphe de statut, signaux, accroche, résumé. Un lecteur qui sortait du feed ne doit pas se voir tendre un objet d'allure différente dans le picker.

- **La carte est une surface de lecture, pas un panneau de contrôle.** Le corps est **un seul bouton** couvrant toute la zone de texte, et il ouvre l'article. Les verbes vivent dans le footer de l'article, là où le lecteur vient de finir de lire ce qu'il décide — la forme précédente lui demandait de trancher sur deux lignes de résumé clampées.
- Le kebab est un **frère** du bouton, jamais dedans (un bouton dans un bouton est du HTML invalide, ce qui est aussi pourquoi tout ce qui est dans le corps est un `<span>`). Deux rangs seulement : **Use in chat**, puis **Ignore** ou **Un-ignore** — un seul créneau, deux directions, jamais les deux, parce que c'est une décision lue par les deux bouts.
- **Le glyphe de triage** est juste à droite de l'âge : la gauche de cette ligne, ce sont les faits du Topic, et son statut se lit comme l'un d'eux plutôt que comme une puce en concurrence avec les signaux. **`new` ne rend rien** — c'est l'absence de marque. Les deux autres enregistrent quelque chose que le lecteur **a fait** ; celui-là enregistre qu'il ne l'a pas fait, et une marque disant « rien n'est arrivé » est la seule chose qu'une marque ne peut pas dire. C'était aussi la valeur la plus fréquente : elle dépensait un glyphe sur presque chaque ligne pour ne rien transmettre.
- **Hover et sélection sont deux états distincts.** La convention carte de l'app, que `chat.css` énonce noir sur blanc : au survol un fond bleu clair + une bordure **bleu clair**, jamais du navy, jamais un contour dur, jamais d'élévation ajoutée. La carte dont l'article est ouvert garde ce lavis et **raffermit** sa bordure en `electric-blue-100`, exactement comme `.drafts-card.is-active`, donc les deux restent distinguables. ⛔️ **Jamais** de bordure gauche colorée sur la carte ouverte — règle catégorique, recalée plusieurs fois. Le fork ne donnait **aucun** hover à la carte de feed, donc un bouton pleine carte n'avait rien qui dise qu'il en était un.
- **Non-triée en gras, triée en poids normal.** `new` est le seul statut qui attend encore une réponse, donc tout le reste recule d'une graisse. C'est l'idiome lu/non-lu de n'importe quel client mail, et c'est l'autre moitié de la raison pour laquelle `new` ne rend **aucun** glyphe : la graisse de la ligne le dit déjà, et une marque disant « rien n'est arrivé » serait une seconde réponse à la même question. **La graisse seulement** — l'encre ne change pas, on ne hiérarchise jamais en descendant un texte dans un gris plus clair.
- **Le signal part au bout de la ligne meta** : c'est la seule chose de cette ligne qu'un lecteur ne peut pas savoir sans qu'on lui dise, et au bout c'est ce sur quoi l'œil finit. Les intertitres d'âge, eux, sont de **simples libellés** au-dessus de chaque groupe : ils ont été un bandeau collant le temps que la liste soit une surface continue, mais avec des cartes séparées un bandeau pleine largeur se lit comme un reste de la dalle.
- Aucun traitement de cadre pour une carte trending : le signal est porté **dans** la carte par la marque Trending, exactement comme Updated, donc les deux se lisent comme la même espèce de chose.

#### L'article — un seul moteur, trois hôtes ([`topic-article.js`](../../src/topic-article.js))

Le feed le montre à côté de la liste, le picker le montre dans sa dialog, la liste in-chat l'ouvre dans cette même dialog. Les trois appellent **les mêmes fonctions**, donc il y a exactement un article et aucun moyen que deux d'entre eux dérivent. Même forme que `playbook-view.js` et `connectors-view.js` : fonctions pures, aucun DOM, aucun listener.

Contenu : le titre (**le titre de l'article**, jamais l'accroche du scan — `topicTitle()` traite `headline` comme le repli d'un Topic dont l'article n'est pas écrit ; c'étaient deux phrases différentes sur le même sujet, donc une carte disait une chose et l'article qu'elle ouvrait en disait une autre), la provenance, au plus deux faits (**Relevance** / **Why now**), la prose dans ses deux sections, puis les **Contributing posts**.

- « Contributing posts », pas « Sources » : une Source dans cette app est quelque chose qu'on amène **dans** un chat, et ceux-là sont la preuve à partir de laquelle l'analyse a été écrite. Deux objets différents sous un mot sur le même écran.
- **⚠️ UN TOPIC `later` A SON ANALYSE. Ce qui lui manque, c'est d'être DRAFTABLE.** Le corps a longtemps **remplacé** la prose par « I haven't found enough to write a detailed version yet » — alors que la version détaillée était dans les données. **Les 18 Topics `later` portent une analyse finie** : 136 mots en moyenne, min 64, max 216, avec leurs propres sous-titres et leur titre. Le panneau affirmait quelque chose de faux et masquait du vrai contenu pour le faire.
  - La distinction réelle est la **draftabilité** — ce que dit la copie d'origine elle-même (« not enough content or assets around this topic to create a draft »). Donc l'analyse s'affiche, et une note sourdine **après** elle dit la chose vraie : « A theme worth keeping, not a draft yet — I don't have enough assets around it to write a post from. »
  - Contenu d'abord, ses limites ensuite : la note vient après la prose, pas à sa place.
- **LA SECTION EST REPLIÉE, toujours.** Un seul état de repos, quel que soit le `kind`. Le compteur annonce le total, donc replier **diffère** la preuve au lieu de la cacher.
  - ⚠️ **Les `later` s'ouvraient dépliés le temps d'un commit**, au motif qu'ils n'ont pas d'angle draftable donc que les posts **SONT** la matière. Mauvais arbitrage : un état de repos qui change selon un champ que le lecteur ne voit pas est une règle qu'il doit découvrir, et le panneau que ça protégeait n'est pas vide — un `later` montre toujours son titre, ses faits et son analyse complète (136 mots en moyenne) au-dessus de cette ligne. `8d8d0b4b` parlait de **remplacer** la prose par un placeholder faux, ce qui n'est pas la même chose que replier de la preuve derrière une disclosure libellée et comptée.
  - ⚠️ **Ça a remplacé un PLAFOND, volontairement.** La section montrait les deux premiers posts et mettait le reste derrière un second lien « N more posts ». Une section repliable **plus** ce lien font **deux disclosures imbriquées** pour une seule liste, et il fallait actionner les deux pour voir six posts. `POST_CAP`, `__more` et `__posts-rest` sont partis : on ouvre la section et tous les posts sont là.
  - **Pourquoi replier du tout** : l'article est une surface de lecture et ces cartes sont ce qu'il y a de plus lourd dessus — les seuls blocs portant un aplat, ~100px chacun — donc deux d'entre elles empilent 200px de gris sous l'analyse, qui est le livrable. Replié, le lecteur obtient la prose, puis l'appareil énoncé en une ligne, puis la preuve à la demande. Le même jugement qui a mis la trace derrière le kebab, un cran en dessous : la trace est méta, ceci est l'assise de l'argument, donc ça reste dans l'article.
  - **Ni `<details>`, ni l'accordéon du DS : une checkbox voisine.** Comme la trace avant elle, et pour la même raison — ce renderer est **pur** et a trois hôtes, dont aucun n'a d'endroit pour un booléen d'ouverture. Et `.ap-accordion` mettrait une **boîte encadrée** autour de blocs qui portent déjà un aplat : l'article garde exactement une espèce encadrée (les deux faits) et une espèce remplie (ces cartes), et un troisième dispositif disant « section » est ce pour quoi le filet au-dessus de ce titre a déjà été retiré. Il donnerait aussi 14/700 en encre foncée à l'en-tête, ce qui surclasserait le libellé d'appareil en 12/700 light du reste de l'article.
- **La preuve est sur son propre FOND — le gris est sur les CARTES, pas dans une boîte autour d'elles.** L'analyse est la prose d'Archie ; ces posts sont ceux de quelqu'un d'autre, cités : un autre genre de chose, et un filet entre les deux ne disait que « section suivante ». Les cartes portent donc `--app-surface-subtle` (`social-post-card.css`), le filet est parti, et la section n'est plus qu'une pile.

  ⚠️ **Un panneau gris ENTOURANT des cartes blanches a été essayé et retiré** : il coûtait un niveau d'emboîtement entier — 24px de padding de corps, puis 16 de panneau, puis 16 de carte, donc le texte d'un post démarrait **32px plus profond que la prose qu'il soutient**. La preuve était indentée deux fois par rapport à l'argument. Sur les cartes, le gris tient en un niveau, les posts s'alignent sur le bord gauche de la prose, et la séparation se lit même plus franchement puisque aucune boîte intermédiaire ne la dilue. Rien n'imbrique d'élévation : tout est plat.

- **L'article a CINQ pas d'espace, pas un seul.** 2px du label à sa phrase, 8px d'un en-tête de section à ses cartes, 12px entre deux paragraphes **et entre deux posts cités**, 20px au-dessus d'un sous-titre — une section de l'analyse **commence** —, et 32px d'une bande à l'autre.
  - ⚠️ Les posts cités étaient à 8px et lus « tout tassés » : deux cartes de ~100px portant chacune 16px de padding, 8px entre elles font une longue dalle avec une couture. **Un écart entre deux blocs remplis doit dépasser leur padding pour exister.** 32 n'est pas arbitraire : dans le volet, en-tête → corps mesure déjà 16 (padding) + 1 (filet) + 16 (padding), donc la dialog, qui n'a pas de filet, obtient la même séparation **par l'espace seul**. C'est le corollaire de la règle du fond unique : aucun filet neuf, aucun aplat neuf.
  - Les sous-titres restent en **h4 (14/700)**, pas h3. Le constat au-dessus est en 18/700, donc un sous-titre à 16 arrive à 2px de lui et se met à disputer l'élément le plus fort de la surface — ce que le défaut du navigateur faisait déjà. C'est la **graisse** qui le sépare de la prose, et les 20px au-dessus qui séparent une section de la suivante ; la taille n'est pas nécessaire et coûte son rang au titre.
  - « Contributing posts » est en `caption-bold` **ink light**, délibérément **SOUS** les sous-titres bien que les deux soient des `h3` dans le DOM. C'est de l'**appareil** : ça nomme ce qui suit, ça n'affirme rien. Et toujours pas de filet au-dessus — le changement de fond sur les cartes trace déjà la frontière.
  - ⚠️ **`15284825` a supprimé tout ce bloc de CSS par accident**, en même temps qu'il corrigeait les labels de faits : six classes que le renderer émet — `__body`, `__para`, `__subhead`, `__section`, `__section-head`, `__posts` — n'avaient plus **aucune règle nulle part**. `base.css` met la marge de tout `h*` et `p` à zéro, donc l'analyse tombait sur les défauts navigateur : quatre paragraphes collés, sous-titres au ~16px bold de l'UA, et « Contributing posts » du coup au même rang visuel qu'une section de l'argument d'Archie. Le livrable du panneau — une analyse de ~159 mots — était rendu en mur. Ne pas re-supprimer : rien là-dedans n'est décoratif.
- **UN SEUL TYPE D'OBJET PORTE UN FOND sur cette surface**, et ce sont les posts cités — la seule chose qui ne soit pas la voix d'Archie. ⚠️ **Cinq choses l'ont porté en même temps** : les deux faits, le placeholder, les cartes de preuve et la trace, tous sur `--app-surface-subtle`. Cinq gris de poids égal font une pile de dalles : au test du flou, l'article n'avait plus aucune hiérarchie. Un aplat est la chose la plus bruyante qu'un bloc puisse porter ; tout le reste gagne sa séparation par l'espace, la typo et **un** filet.
- **Relevance et Why now sont la PREMIÈRE BANDE de l'article**, dans le scroller, **un bloc encadré chacun**. Ce sont les critères de **triage** — à qui c'est destiné, et pourquoi maintenant — donc ils viennent avant l'analyse : l'ordre de lecture est faits → analyse → preuve.
  - **Contour, pas aplat.** La règle du fond unique tient : les posts cités restent la seule chose de cette surface à porter un fond, parce qu'ils sont la seule chose qui ne soit pas la voix d'Archie. Le brief prend donc **l'autre** dispositif — un filet — et les deux traitements veulent maintenant dire deux choses au lieu de cinq choses ne voulant rien dire. ⚠️ Les faits en **boîtes grises** ont été essayés et retirés deux fois : ne pas y revenir, le contour est la version qui survit à la règle.
  - Le cadre était **libre** : la trace l'a rendu en partant derrière le kebab. L'article garde donc exactement une espèce encadrée (le brief) et une espèce remplie (la preuve), et rien n'imbrique d'ombre — le volet est déjà une carte.
  - **Le label est AU-DESSUS de sa phrase**, jamais à côté. ⚠️ Une colonne de labels en `max-content` a été essayée et retirée : c'est un idiome de **champ de formulaire**, valable pour une valeur courte (une date, un statut) et intenable sur un paragraphe. Elle produisait une **colonne morte** — vide sur trois des quatre lignes de Relevance — et un **second bord de texte**, les phrases démarrant à 115px quand la prose démarrait à 0. Deux bords gauches dans un panneau, c'est la première chose que l'œil remarque. Empilé, la phrase récupère la mesure entière et le bord de la prose (mesuré : 598px et 793 pour les deux).
  - ⚠️ **Ils ont vécu dans l'en-tête FIXE, et la mesure a tranché.** L'argument était que des critères de triage appartiennent à l'identité et aux verbes qui agissent dessus, et qu'un en-tête fixe les garde en vue pendant que la prose défile. Le prix : 125px sans eux (16% du volet), **291 avec les deux (32%)** — et surtout une hauteur d'en-tête qui **variait selon les champs que ce Topic-là portait** (relevance 9 sur 52, why now 13), donc le scrollport se redimensionnait à chaque fois qu'on ouvrait le suivant. `15284825` a posé le chiffre et laissé la décision à qui décide ; elle est prise. Ce que le déplacement achète : un en-tête d'**une seule hauteur**, et la **parité des deux hôtes** — la dialog les faisait déjà défiler, puisqu'elle rend l'en-tête en ligne. Un placement, un comportement. Le correctif interdit ne change pas : **jamais** tronquer les phrases.
- **Le « pas encore assez » est UNE ligne sourdine**, à la place exacte de la prose. ⚠️ C'était un empty state complet — bloc encadré, centré, titre 24px, corps sur trois lignes — ce qui faisait de l'**absence** l'élément le plus fort de la carte. Une absence doit se lire comme une absence.
- **Les compteurs à zéro sont omis** sur les posts cités. Un zéro n'est pas une mesure, c'est l'absence de mesure — et trois zéros d'affilée sur un post calme se lisent comme un widget cassé. La carte de post garde son **fond seul**, sans bordure : sur une surface où le fond est devenu le seul marqueur du contenu cité, un contour par-dessus est un second dispositif qui dit la même chose.
- **Le pied du dialogue est `.ap-dialog-footer`**, frère du scroller — c'est la structure qui l'épingle au bord bas, sans `position: sticky` ni les quatre marges négatives qui reprenaient le padding du scroller. Ordre `[Close] [Ignore] [Use in chat]` : renvoi, secondaire, primaire, tout aligné à droite — la convention que `topic-ignore-modal.js` et neuf autres modales de ce repo suivent déjà. ⚠️ C'était un `.topic-picker__foot` fait main, avec les verbes à gauche et Close poussé à droite.
- **La TRACE N'EST PLUS DANS L'ARTICLE.** Elle est derrière le **kebab de l'en-tête** (`ap-icon-more`, le même contrôle que portent les cartes, donc rien de neuf à apprendre) — un item, `Topic history`, avec le nombre d'entrées en description.
  - Elle était la dernière bande, dans un accordéon DS replié. Deux problèmes : elle dépensait **l'unique boîte encadrée** d'une surface de lecture pour la seule chose qui ne fait pas partie de l'argument (l'ordre de lecture est faits → analyse → preuve → puis ce qui est arrivé au Topic : la trace est méta), et **38 des 50 Topics qui en ont une n'ont qu'UNE entrée** — donc la boîte, le titre et le compteur existaient pour différer une ligne de provenance. Derrière le kebab elle ne coûte rien avant d'être demandée, et le cadre qu'elle rend est celui que portent les deux faits.
  - **Un renderer, deux placements.** `renderTopicTrail()` est exporté ; le feed l'ouvre dans `topic-history-modal.js`, la dialog du picker **bascule dessus comme troisième vue** avec un « Back to the topic ». ⚠️ La dialog ne peut PAS ouvrir la modale : elle est l'overlay actif et `requestOpen` ferme l'overlay actif, donc une modale lancée de l'intérieur fermerait le picker en montant. Seul le placement diffère — le même partage que l'identité et les verbes.
  - ⚠️ **Escape doit être consommé en CAPTURE** par la modale. Le handler Escape du feed est aussi sur `document` et enregistré plus tard (au mount de l'écran, contre le boot pour la modale), donc il passe après en phase bubble : tout état qu'il pourrait tester (`body.has-modal`, l'`activeId` du coordinator, la classe `.open`) est déjà effacé quand il regarde, et une pression fermait la modale **et** l'article derrière. `stopPropagation()` en capture est la seule réponse indépendante de l'ordre. Le garde `has-modal` côté écran reste pour les modales qui ne consomment pas la touche (la dialog Ignore n'écoutait que son textarea).
  - **Le dépli est une checkbox voisine, pas un toggle JS.** `.ap-accordion.collapsed` est le mécanisme du DS et il attend une classe retournée en script — sauf que ce renderer est **pur** et a trois hôtes, dont aucun n'a d'endroit pour un booléen d'ouverture. La checkbox garde l'état dans le DOM, reste opérable au clavier, et ne coûte que deux règles host-scoped qui écrasent ce que `.collapsed` cache.
  - Les statuts d'une trace ne sont **pas** que des statuts de revue : elle porte aussi `updated` et `trending`, qui sont des signaux. D'où une table de libellés locale plutôt que `findReviewStatus`, qui ne connaît que les trois états de revue.
- **Aucune des deux lignes n'est teintée**, sous aucun signal. À qui s'adresse un Topic ne change pas parce que la pile a grossi ; et Why now a pris la teinte du signal — pêche pour un pic, menthol pour une réécriture — avant de partir avec tout le color-coding de l'article (`0196361b`). Peindre un pic en ton d'avertissement est la même erreur que peindre Ignore en rouge, et un bloc teinté à taille de corps se lit comme une alerte alors qu'aucun des deux n'en est une. La carte dit le signal, en mots. ⚠️ Ce paragraphe a décrit la teinte pendant plusieurs commits après sa suppression — aucune règle de ce genre n'existe.
- **Pas d'historique de version.** Un Topic mis à jour se lit comme sa version courante ; un lecteur qui décide quoi poster n'a pas besoin du brouillon qui précédait.
- **Deux verbes, les mêmes partout, dans l'ordre secondaire → primaire.** Donc **Ignore**, puis **Use in chat**. L'action affirmative est celle qu'on atteint en dernier, et dans le volet ce groupe est aligné à droite, donc « en dernier » veut aussi dire le plus près du bord où l'œil arrive. ⚠️ C'était l'inverse pendant un commit, ce qui mettait Ignore à la place que le primaire doit tenir.
  - **Use in chat** est `primary orange` dans l'article (volet et dialogue) et `secondary blue` sur la face d'une carte du hero. L'orange reste l'action IA / spotlight et il est gardé pour **le** primaire, celui de l'en-tête de l'article ; la carte du hero est une **seconde porte** vers le même chat, et le bleu est la couleur de l'interactif / de la navigation dans cette app. ⚠️ Ce bouton a été `secondary orange` le temps d'un commit — ça dépensait la couleur IA sur un point d'entrée de second rang.
  - **Ignore** est `stroked grey` et **pas** rouge : ignorer masque un Topic que cocher Ignored ramène, donc rien n'est détruit et le rouge signalerait un danger absent.
  - La sortie de l'hôte, quand il en a une, vient après et est poussée à droite. Le volet n'en a plus (voir ci-dessous) ; le pied du dialogue garde son `Close`.
- **Le volet ouvre sur l'EN-TÊTE DE L'OBJET, hors du scroller** — le titre, puis la source et l'âge, avec les deux verbes en face du méta. **Pas de Close** : un lecteur à deux volets ne ferme pas un message, il ouvre le suivant, et la liste est juste là — un bouton dépensait le meilleur emplacement de l'en-tête pour ce que la mise en page fait déjà. `Escape` ferme le volet (et d'abord le menu ou le panneau de filtres s'ils sont ouverts : Escape ferme ce qui s'est ouvert en dernier). C'est la forme d'un client mail, pour sa raison : les actions sont visibles pour un article court comme pour un long, elles ne chevauchent jamais la dernière ligne de prose, et le lecteur les retrouve **toujours au même endroit** au lieu d'à la fin de la quantité de texte que ce Topic avait. Être **hors du scroller** satisfait « rester atteignable pendant qu'on défile » absolument plutôt qu'approximativement — et le titre y gagne la même propriété, ce qui est le vrai bénéfice.

  ⚠️ **Une barre de verbes SEULE a été essayée et corrigée.** Les deux verbes plus un Close occupaient cette rangée pendant que le titre restait sous eux, dans le scroller : les actions n'avaient aucun sujet à l'écran, et défiler emportait la seule ligne qui nomme ce sur quoi elles agissent. L'identité et les verbes viennent tous deux de `topic-article.js` (`renderTopicHeader` / `renderTopicActions`) — le dialogue compose les mêmes pièces autrement, identité en ligne et verbes dans un pied collant contre son bord bas, ce qui est correct pour une modale qui a déjà sa croix. Seul le placement appartient à l'hôte.

  La sortie est en face du **titre**, pas à côté des verbes : elle ne fait rien **au** Topic, et la lire comme une troisième décision est exactement ce que la rangée unique invitait à faire. Le padding horizontal de l'en-tête est `md`, celui du corps aussi, donc le titre démarre au pixel où démarre la prose. ⚠️ Le fork dessinait un **liseré bleu électrique** sur ce bord ; c'est un simple filet, parce que le bleu électrique est la couleur de l'interactif et une bande décorative est la seule chose qu'il ne peut pas être.

#### Les deux verbes

- **Use in chat** ([`topic-flow.js`](../../src/topic-flow.js)) — `useTopicInChat()` marque le Topic **Used**, arme le handoff `pendingTopicChat` et navigue vers `/session/new-<ts>?contextId=…&title=<titre>` (les query params, parce que `session.js` les résout en mintant la session, donc le chat est lié et nommé **au premier paint** plutôt que renommé une frame plus tard). La marque tombe **avant** que le chat s'ouvre, et **en un seul endroit**, pour que les quatre surfaces veuillent dire exactement la même chose.
  **Pourquoi une source** : plutôt qu'inventer une surface d'aval, le Topic entre par le pipeline. Tout ce que l'app sait déjà faire — Extract ideas, Draft, Ask, le panneau Sources — s'allume tout seul, sans cas particulier nulle part. `attachTopicToChat()` est consommé au mount ; `intake-lifecycle` en fait la carte de source-intake du thread.
  **Ni message d'écho, ni picker de questions** : la carte nomme déjà le Topic et le composer est juste là.
- **Ignore** — ouvre [`topic-ignore-modal.js`](../../src/components/topic-ignore-modal.js) : « Why did this Topic miss the mark? », le titre cité, un champ **optionnel**, un infobox qui dit ce qu'ignorer implique. Le motif est la seule chose qu'un lecteur **dise** à Archie sur le listening, et c'est ce qui rend l'état Ignored lisible après coup — la carte le réimprime.
  ⚠️ Le fork portait une case **« Don't show this again »**, retirée : elle faisait d'Ignore un clic sans motif, ce qui contredit la promesse de la même feature (le motif est conservé et affiché) et fabriquait des Topics ignorés sans rien à imprimer. Le champ est optionnel à la place — la façon honnête de garder le frottement bas.
  Réversible : le toast offre **Undo** (`unignoreTopic`), qui repasse en `new` et **efface le motif** — la phrase tapée survivrait sinon sur un Topic qui n'est plus ignoré, invisible tant qu'elle dort et fausse dès que quelque chose la lit.

#### États

- **Scanning** — à la première arrivée seulement, jamais sur un lien vers un Topic (le lecteur venait pour une chose, un état de travail serait du théâtre entre lui et elle).
- **Rien trouvé encore** — le feed écoute et doit se lire comme tel, avec la cadence nommée et un chemin vers les réglages. Ne doit **jamais** se lire comme cassé ou éteint.
- **Filtres sans résultat** — c'est le fait du lecteur, donc la sortie est le chemin de retour (**Reset filters**), pas une réassurance. Deux phrases différentes, deux sorties différentes.
- **Aucun Playbook** — il n'y a rien à écouter pour.

### La page de réglages (`/topics/settings`, [`screens/topics-settings.js`](../../src/screens/topics-settings.js))

**Une page, pas un onglet.** Un onglet donne à la config le même poids que le feed, ce qui est faux pour ce qu'elle est : on règle ses sources une fois puis on lit des Topics pendant des mois.

Ce n'est **pas** le retour de la page Settings agrégée retirée quatre fois ici : la règle du projet autorise la config sur l'entité qui la possède **ou** sur une route scopée à une feature, et c'est le second cas. La donnée vit dans `topic-feeds-store`, clé par Playbook ; seule la surface est ici.

- **Chrome DS « settings »** — `--sys-settings-*` pour la coquille et les cartes, `-max-width-lg` (1200px) et deux colonnes. La prose reste plafonnée séparément, donc élargir la grille n'élargit jamais une ligne de texte. Passage à une colonne par **`@container` query**.
- **Une barre de scope labellisée** (deux `.ap-form-field`, le vrai **DS Select** en `<details>` — jamais un `<select>` natif nu), **puis une carte par source**. Empiler un bloc par Playbook ne passe pas l'échelle : à vingt Playbooks, 160 interrupteurs avec chacune des huit descriptions répétée vingt fois — et ce sont les descriptions, pas les interrupteurs, qui font exploser une telle page.
- **Une carte, pas une ligne**, parce qu'une carte peut porter les options de sa source. **Brand website** est la première à le prouver : elle porte sa **liste de sites éditable**. Une ligne neuve est DOM-only jusqu'à contenir une URL — `normalizeFeed` jette les entrées vides, donc un aller-retour par le store supprimerait la ligne que le lecteur vient de demander.
- **Une source pas encore live n'est plus une impasse.** Les sept cartes `Coming soon` portent un lien **« Need this source? »** qui ouvre le dialogue de feedback avec la source pour **sujet** : « Influencers isn't live yet. Tell me how you'd use it and it goes to the team building the next ones. » C'est la seule chose qu'un lecteur peut faire au sujet d'une source qu'il ne peut pas activer — sans ça, la carte est une impasse qui porte une étiquette.
  - ⚠️ **Pas un neuvième shell de modale.** `feedback-modal.js` accepte `open({ subject })`. Son select « Feature area » **est** un sélecteur de sujet : quand l'appelant connaît déjà le sujet, le dialogue y **répond** au lieu de le demander — champ masqué, valeur posée, titre et chapô qui nomment la source. `applySubject(null)` remet tout comme livré depuis un instantané pris à l'`init()` ; sans ce retour, le prochain « Send feedback » générique porterait le titre du dernier sujet.
- **Chaque source lie vers ce qu'elle lit** : les sources pilotées par les concurrents portent un `.ap-link` vers la section du Playbook. Seulement sur les cartes qui ont un endroit où envoyer — le fork mettait une rangée à flèche sur les huit, dont cinq qui ne lisent rien que le Playbook détient. **Influencers ne pointe nulle part exprès** : ce repo n'a pas de section Influencers, et envoyer vers Competitors ferait dire à la carte qu'elle lit vos concurrents, ce qu'elle ne fait pas.
- **OFF = la carte perd son fond** et laisse voir la page à travers (badge en grayscale, texte atténué), donc la grille dit d'un coup d'œil ce qui est vivant. **La bordure est identique dans les deux états** : l'état d'une carte va dans son contenu, jamais sur son cadre.
- **Commit direct**, aucune barre Save — un contrôle écrit via `updateFeed`, le store notifie, l'écran repaint, et le focus est **remis sur le switch** (sinon chaque bascule au clavier renvoie en haut de page). ⚠️ Le fork avait un footer **Cancel / Save changes** et des labels de section en **capitales** ; ni l'un ni l'autre ne revient.
- **Dire que les autres diffèrent** — _« 3 other Playbooks listen to different sources »_, parce qu'un-à-la-fois invite au « je croyais avoir réglé ça partout ».
- **Un seul Playbook à la fois**, scopé par `?pb=`, et seulement ceux qu'on peut **éditer** : quelles sources tournent est le job du propriétaire, pas la décision d'un lecteur d'un Playbook partagé.

⚠️ **Piège DS rencontré ici**, valable ailleurs : `.ap-select-not-found` porte un `display` qui bat `[hidden]` → masquer en `style.display` inline.

### Les deux surfaces in-chat

**« Fresh topics to review »** — dans le hero d'un chat neuf, **sous** les starters. Les Topics **à revoir** les plus frais du feed de **ce chat**, six au plus. Ordre : le trending le plus récent, puis l'updated, puis le plus récent du reste — la première carte est celle qui vaut le plus d'être traitée. Une **grille de cartes**, exactement la géométrie de `.starter-grid` juste au-dessus (3 colonnes, même `gap`, même cap à 1040, 2 colonnes sous 900px), donc les deux sections se lisent comme des sœurs.

⚠️ **C'était un panneau de lignes à filets AU-DESSUS des starters**, sur deux arguments qui n'ont pas tenu à l'usage : « proposals first, verbs second », et « six propositions en cartes pèseraient plus que les trois starters ». Six lignes pleine largeur mesuraient ~500px et poussaient **les trois cartes de workflow sous la ligne de flottaison** — la proposition enterrait donc les features qu'elle était censée introduire. En grille 3×2 elle coûte deux rangées au lieu de six, et le cadre du panneau est parti avec : une boîte bordée autour de cartes est le même emboîtement que le volet de lecture vient de perdre, et c'est ce qui faisait lire la section comme une liste.

- **Aucune puce Playbook par ligne.** Le fork en mettait une sur chacune des six lignes **et** sur chacune des trois cartes de workflow — sept copies identiques d'un nom que le composer, 40px au-dessus, énonce déjà. L'entête de section porte le scope une fois.
- **Aucun scroll imbriqué.** Le fork en faisait un scroller à hauteur fixe montrant 2,35 lignes dans une page qui scrolle déjà. Six lignes, toutes, et le pied mène au feed.
- **Le corps de la carte OUVRE l'article**, il ne choisit pas le Topic : lire vient avant décider. Mais la carte porte aussi **Use in chat en clair** sur sa face (`withUse`), parce qu'une carte posée à côté de trois cartes de workflow qu'on clique pour **démarrer** quelque chose doit être actionnable de la même façon. Deux portes, pas une : l'article pour qui doit lire, le verbe pour qui sait déjà. Le bouton est `secondary orange` (variante shippée par le DS : fond `orange-10`, encre `orange-100`), pas `stroked grey` — voir ci-dessous.

**LES DEUX SECTIONS DU HERO DOIVENT SE LIRE COMME DEUX TYPES.** Elles partagent la grille exprès, mais l'item diffère sur **cinq** leviers, aucun décoratif :

|              | Carte de workflow                      | Carte de Topic                |
| ------------ | -------------------------------------- | ----------------------------- |
| Fond         | teinté par tonalité (lavis `::before`) | blanc, plat                   |
| Titre        | `h2` (18px)                            | `h4` (14px)                   |
| Illustration | watermark 104px                        | aucune                        |
| Action       | lien **bleu** + flèche qui avance      | bouton **orange** teinté      |
| Nature       | une porte vers une feature             | du contenu qu'Archie a trouvé |

Les deux actions sont bleues — c'est la couleur de l'interactif ici — donc ce qui les distingue est la **forme** : un lien texte qui mène ailleurs contre un bouton teinté qui agit sur l'objet de la carte. ⚠️ Ce paragraphe a affirmé le contraire pendant un commit, quand le bouton était orange : la couleur ne fait plus partie des leviers.

⚠️ **Elles ne différaient que sur deux leviers, tous deux INVISIBLES AU REPOS.** `.starter-card::before` — le lavis teinté qui _est_ l'identité de ces cartes — était en `opacity: 0` et ne s'allumait qu'au hover, et le watermark était à `0.07`. Au repos : trois boîtes blanches au-dessus de six boîtes blanches, soit un mur de neuf. Le lavis est passé à `0.6` au repos (1 au hover) et le watermark à `0.10` (0.12 au hover) : c'est une **restauration** d'une intention déjà écrite, pas un ajout. Leçon réutilisable : une identité qui ne se voit qu'au survol n'est pas une identité.

⚠️ Reste un écart assumé : la carte de Topic mesure **187px contre 158** pour la carte de workflow — donc le type « dense » est encore le plus haut des deux. La densité par ligne est bien resserrée (`gap xxxs`, padding `xs sm xxs`), mais la carte porte une ligne de plus (méta + titre + résumé + action). Le fermer demanderait de clamper le résumé à une ligne, ce qui coûterait de l'information sur la seule surface où le Topic doit se vendre.

- Le total du pied est **tout Topic de moins d'une semaine quel que soit son statut**, donc la phrase décrit la semaine et pas une to-do : trier une ligne fait baisser N et laisse M où il est.
- Rendu à zéro condition satisfaite = **rien du tout**, donc un hero sans Topics est octet pour octet le hero que l'app a toujours eu. Vivant : `session.js` s'abonne au store et re-render l'aside **seulement si la liste est montée**. Changer le Playbook du composer **échange la liste** avec lui.

**« Pick from the Topic Feed »** — une rangée **plate** du menu Add du composer, pas un sous-menu (ADS ne ship pas de dropdown imbriqué, et c'est une destination, pas un set). Ouvre [`topic-picker-modal.js`](../../src/components/topic-picker-modal.js), scopé au Playbook **du chat** : un chat garde la marque dans laquelle il a été créé, donc le picker ne demande jamais laquelle d'abord.

**Une dialog, deux vues.** Le picker ouvre sur la **liste** (ready-to-draft seulement, jamais un ignoré — même règle que le premier segment, et un picker n'a pas de filtre donc aucun moyen d'en montrer un) et le corps d'une carte ouvre l'article **dedans**, avec un retour qui **nomme** où il ramène. Une ligne du hero ouvre directement l'article et n'a **pas** de retour, parce qu'il n'y a pas de liste derrière. Sur la vue article la dialog n'imprime **aucun** header : l'article porte déjà le titre en h2, et un header au-dessus serait la même phrase deux fois — elle est **nommée** pour les lecteurs d'écran à la place.

### Le compteur de la sidebar

La ligne **Topic Feed** (`ap-icon-antenna`) compte les Topics **à revoir** du feed du Playbook par défaut. C'est une notification, donc elle compte ce qui attend une réponse, pas tout ce que le feed tient. Scopée à un Playbook plutôt que sommée sur tous, parce que **le feed lui-même est scopé** : un compte couvrant quatre marques enverrait le lecteur sur un écran qui en montre une. Il n'y a pas de scope global à lire — délibérément.

### Le seed

**2 feeds, 33 Topics.** 19 des 52 du fork sont tombés : leur contenu appartient à des Playbooks que ce repo n'a pas (une académie de jiu-jitsu, un multimarque de mode belge, un constructeur de maisons modulaires), et porter quatre marques de démo est une décision à part. Les deux autres Playbooks reçoivent un feed **provisionné vide**, ce qui est ce qui rend l'état « rien trouvé encore » démontrable.

Deux corrections d'audit sur le seed :

- **Le feed d'atterrissage a ses deux segments.** Celui du fork était 21 ready / 0 later, donc le premier écran affichait un segment à zéro. Six des vingt-et-un sont des thèmes de catégorie plutôt que des observations draftables, répartis sur les trois groupes d'âge.
- **Il a un vrai étalement de statuts** — deux Used, deux Ignored avec la phrase qui explique pourquoi. Ignored est vide de sens sans son motif, et Used est ce qui prouve que le filtre par défaut garde votre propre travail trouvable.

---

## Voir aussi

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — le _comment_ technique
- [`ROUTES.md`](ROUTES.md) — route table + handoffs + URL state
- [`STORES.md`](STORES.md) — API par store
- [`UI-PATTERNS.md`](UI-PATTERNS.md) — usage concret du Design System
- [`GLOSSARY.md`](GLOSSARY.md) — vocabulaire produit
