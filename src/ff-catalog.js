// The admin menu lists the flags under these headings, in this order. Every
// flag names one in `group`; `tip` is its one-line tooltip there (`hides` is
// the long form, for the docs).
export const FLAG_GROUPS = Object.freeze(["New surfaces", "Playbook", "Chat & drafts", "Onboarding"]);

export const FLAGS = Object.freeze([
  {
    id: "insightsHub",
    group: "New surfaces",
    tip: "Adds /insights: the brand's objectives, their trajectory toward target, and the posts that moved them.",
    label: "Insights hub (/insights)",
    // OFF: the feature lands dark. The flag gates the ROUTE as well as the nav
    // row — a typed /insights bounces home while the switch is off.
    default: false,
    hides:
      "When OFF, the Insights section disappears entirely. ON adds the active " +
      "brand's objectives, read in one of three layouts (Cockpit, a card " +
      "index, a side column — the View switch in the topbar): the counted verdict, a real trajectory toward target per " +
      "measure, and the posts drafted with Archie that moved it. It is the one " +
      "analytics surface you choose to open, which is why a wall of figures is " +
      "legitimate here and nowhere else.",
  },
  {
    id: "connectors",
    group: "New surfaces",
    tip: "Adds live MCP connectors: the /connectors gallery, and connected sources in the composer and the Sources panel.",
    label: "Connectors (live MCP sources)",
    default: false,
    hides:
      "When OFF (default), hides everything connectors-related: the " +
      "Connectors gallery (route /connectors + sidebar nav) and modal, the " +
      "composer Add → 'Connected sources' submenu, the Sources panel 'Live " +
      "connectors' group, and the Add-source modal's Connectors tab.",
  },
  {
    id: "conversationStatusCard",
    group: "New surfaces",
    tip: 'A floating card that sums up the chat (sources, ideas, clips, drafts), with its "i" toggle in the topbar.',
    label: "Conversation status card",
    default: false,
    hides:
      "When OFF, hides the floating conversation status card (sources / " +
      "ideas / clips / drafts summary) entirely, including its 'i' toggle " +
      "button in the session topbar.",
  },
  {
    id: "contentPanel",
    group: "New surfaces",
    tip: "The side panel's tabs (Overview · Sources › Ideas › Drafts) sit in the topbar; every result in the thread is a card that opens the panel on it.",
    label: "Content panel",
    default: true, // R4 (2026-10-28): the pipeline panel is how a chat reads
    hides:
      "When ON, the topbar's Sources / Ideas / Drafts pills become the side " +
      "panel's own tabs — Overview · Sources › Ideas, Clips › Drafts with " +
      "their counts and a dot on a tab with something new — right above " +
      "the panel, which has no header row. Its Overview tab is the " +
      "conversation status card's other form — with that flag ON the card " +
      "stays and the tab is gone. In the " +
      "thread, every source, ideas batch, clips batch and drafts batch is " +
      "a card that opens the panel on those objects; no toast nor green " +
      "composer bar announces them, and the panel never opens by itself." +
      "\n\nWhen OFF, the three pills, the untitled panel, the toast + bar.",
  },
  {
    id: "multilingualPlaybook",
    group: "Playbook",
    tip: "A Playbook holds several languages, and drafting asks which one to write in. Off: English only.",
    label: "Multilingual Playbooks",
    default: false,
    hides:
      "When OFF (default), Playbooks are single-language: the Brief " +
      "language row is a plain English-only picker, and the draft flow never asks which language to " +
      "write in. When ON, a Playbook holds several languages (languages[] / " +
      "primaryLanguage / voiceByLanguage), the CTA copy is authored per " +
      "language, and drafting asks the target language. Underlying multilingual " +
      "data is preserved either way — only the surfaces are gated.",
  },
  {
    id: "playbookSharing",
    group: "Playbook",
    tip: "Playbooks get an owner and a scope (personal, named members, whole organization). Others read only; a manager governs.",
    label: "Playbook sharing",
    default: false,
    hides:
      "Whether a Playbook belongs to somebody. When OFF (default), there is " +
      "one implicit user: every Playbook is visible, editable and deletable, " +
      "exactly as before. The ownership data (owner, scope, change log) still " +
      "rides along in the seeds, like multilingualPlaybook. When ON, a Playbook " +
      "is personal, shared with named colleagues (a fixed list), or shared " +
      "with the whole organization (a dynamic one, joiners included). Its " +
      "owner is the only one who can edit it; everyone it reaches may open it " +
      "READ-ONLY, use it in a chat, and duplicate it into a Playbook of their " +
      "own. A Playbook tied to a social profile only reaches people who can " +
      "reach that profile. A manager (Admin \u2192 Your role) GOVERNS shared " +
      "Playbooks — share, hand over, delete — but never edits their content, and every action " +
      "they take on someone else's notifies the owner and lands in the change " +
      "log. Losing access degrades the chats that used it: the drafts already " +
      "written can still be saved or scheduled, nothing new can be generated. " +
      "Also gates the Share modal, the ownership marks on /contexts cards, the " +
      "owner row on a Playbook, and the Your-role control in Admin.",
  },
  {
    id: "newScheduleModal",
    group: "Chat & drafts",
    tip: "The redesigned schedule modal: dates proposed on open, one list with what's already planned and clashes. Off: the previous modal.",
    label: "New SM (schedule modal)",
    // ON: the redesigned schedule modal. OFF: the previous one, kept whole in
    // schedule-modal-legacy.js for comparison.
    default: true,
    hides:
      "Which schedule modal opens from the Drafts panel. When ON (default), " +
      'the redesign: dates proposed on open after a short "finding the best ' +
      'time" beat, one sentence saying how they were picked with its ' +
      "settings behind Adjust (rhythm, start, time of day, skipped days, and " +
      "a rhythm saved per Playbook), and the batch as one list — each draft " +
      "with its media, then its date, what else is already planned that day, " +
      "and a clash warning on the same network.\n\nWhen OFF, the previous " +
      "modal: Optimal / Custom mode cards, cadence chips, a free-text " +
      "strategy, a Compute best times button that unlocks Schedule, and a " +
      "month calendar beside the list.",
  },
  {
    id: "draftMentions",
    group: "Chat & drafts",
    tip: "Ask Archie to mention people in a draft (« mention Notion and Jordan Lee in the LinkedIn post »): it opens a search on each draft's network, you tick the accounts, and it offers to when a draft names a brand.",
    label: "UI-Mentions in drafts",
    // OFF: « mention X » in the chat gets the scripted reply, as before.
    default: false,
    hides:
      "Mentions in drafts, from the chat. « Mention Notion, Figma and Jordan Lee " +
      "in the LinkedIn post » or « tag Linear in all the drafts »: for each " +
      "draft's network I open a search (LinkedIn companies and the people who " +
      "follow your Page, Facebook Pages, X users) where you tick one account or " +
      "several, each name's only match already ticked; the picker says what " +
      "to do, shows faces and logos, and links each profile to check it. Instagram and TikTok " +
      "have no search, as in prod: I ask for the exact usernames. YouTube has no " +
      "mentions. Your pick echoes as a chip and I answer in one sentence, no " +
      "« what changed » card. A name the draft already writes becomes the " +
      "mention; the others come in together in one short sentence. « Remove the " +
      "mention of Notion » takes it out. After writing drafts that name a brand, " +
      "I offer to mention it.",
  },
  {
    id: "uiIdeaCard",
    group: "Chat & drafts",
    tip: "The idea card says what it is (Story idea), where it comes from (From notes.pdf) and what you can do with it.",
    label: "UI-Idea card: clearer",
    // OFF: the card as it was: kind tag + "Source:" pill, the grey Why this
    // idea block, thumbs in the actions row.
    default: false,
    hides:
      "When ON, an idea card (Ideas panel, the chat's extracted ideas) reads " +
      "top to bottom as what it is, where it comes from, what to do with it. " +
      "Its tag says Story idea (a bare Story reads as an Instagram Story), " +
      "the kind's meaning in its tooltip, and the thumbs sit beside it. " +
      "Under the gist, one quiet line, From notes.pdf, with Why this idea at " +
      "its end, whose grey box appears only once open. The footer holds the " +
      "actions alone, under a hairline, on the right; hovering the card " +
      "lights up its Draft post, since a click on the card drafts.",
  },
  {
    id: "newChatHero",
    group: "Onboarding",
    tip: "A first-time user's new chat: the composer on the grey pixel field of the other empty states, example requests and New Start's two doors under it. Turning it on switches to First-time user.",
    label: "UP-New chat: pixel field + example requests",
    // OFF: the three big starter cards and six Topics. Deleted 2026-11-27
    // morning, restored the same day behind this flag, OFF by default; its
    // workflow rows and Topics removed that evening.
    default: false,
    hides:
      "A first-time user (mode new-alt): turning it on switches to that mode, " +
      "so everything is empty. The new chat keeps its wordmark, sub-line and " +
      "composer, without the three big workflow cards nor Topics, on the grey " +
      "page and the grey square-pixel field of the other empty states, still. " +
      "Under it, New Start's example requests, three " +
      "at a time, then its two doors: Sound like your Brand (only while there " +
      "is no Playbook) and Turn a video into clips. / no longer sends " +
      "a user with no Playbook into the setup run. New Start #4, if on, wins.",
  },
  {
    id: "interactivePlaybook",
    group: "Onboarding",
    tip: "A first-time user with no Playbook lands on the setup run (Let's build your Playbook together). Off: on a new chat. Turning it on switches to First-time user.",
    label: "UP-Interactive Playbook: the run first",
    // OFF: a first-time user lands on a new chat; the run is opened from its
    // Create my Playbook links, never forced.
    default: false,
    hides:
      "A first-time user (mode new-alt) with no Playbook: ON, / sends them " +
      "into the setup run, its intro first (Let's build your Playbook " +
      "together.). OFF, / lands on a new chat like any user; the run stays " +
      "the way a Playbook is made, opened from Create my Playbook. Turning " +
      "it on switches to First-time user. New Start #4 and the new chat's " +
      "hero, if on, win: their chat introduces the run instead.",
  },
  {
    id: "newStart4",
    group: "Onboarding",
    tip: "No hero: the page is already a thread. Archie says hello in a turn typed live, offers the two doors, then example requests, the composer under them, the whole centred.",
    label: "UP-New Start #4: Archie opens, composer under the turns",
    default: false,
    hides:
      "A first-time user (mode new-alt) with no Playbook lands on a new chat " +
      "instead of the setup run. Archie opens the thread: his hello is typed " +
      "live, his second turn offers two doors that play what they do (Sound " +
      "like your brand opens the Playbook setup, Turn a video into clips), his " +
      "third, « Or ask me something like: », three example requests that change " +
      "every few seconds (one is always a video). The composer sits at the " +
      "foot, as in a started chat. Sending right away is fine: without a " +
      "Playbook the drafts are generic. Turning it on switches to First-time " +
      "user. OFF: the run is the first screen, as before.",
  },
]);
