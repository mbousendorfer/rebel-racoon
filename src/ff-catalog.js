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
    id: "playbookWorkspace",
    group: "Playbook",
    tip: "One active Playbook, picked in the rail, scopes everything below it. Off: each chat picks its own Playbook.",
    label: "Playbook as a workspace (rail switcher)",
    // OFF: byte-for-byte the per-chat model — the Playbook is a field on a
    // session, asked in the composer on a fresh chat and fixed after that.
    default: false,
    hides:
      "Whether the Playbook is a FIELD on the things you make, or the LEVEL " +
      "ABOVE them. When OFF (default), each surface asks its own question: the " +
      "composer's select on a new chat, `?pb=` on the Topic Feed and its " +
      "settings, an implicit default Playbook for the clip / batch / repurpose " +
      "flows, and the Insights title. Any two of them could disagree.\n\n" +
      "When ON, one Playbook is active at all times, chosen from the switcher " +
      "under the wordmark in the rail, and everything below it is that brand's " +
      "work: the chat list, a new chat, the Topic Feed and its count, Insights, " +
      "the studios' drafts. The six pickers that each asked the question " +
      "(composer, feed toolbar, feed settings, batch / clip / repurpose) are " +
      "gone: the rail names the brand, nothing else re-asks it.\n\nThe cost is stated in " +
      "active-playbook.js: a scope HIDES. There is deliberately no " +
      '"All playbooks" view, which is why the switcher is permanent and always ' +
      "prints the brand name — the scope is only safe while it is legible. " +
      "/contexts stays unfiltered: it is the catalogue the switcher picks from — " +
      "and in this mode it lives on the account HOME the wordmark opens (/home), " +
      "beside a hero that starts a chat on the brand you pick and a Chats tab " +
      "listing every chat, all brands.",
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
    id: "clipsSpace",
    group: "New surfaces",
    tip: "Adds Clips to the rail: a video library per Playbook, one editor for every clip tool (trim, reframe, subtitles…), drafts made right there.",
    label: "Clips space (/clips)",
    // OFF: the Clip Studio session, the Video Clips modal and the chat's clip
    // flow, byte for byte. The flag gates the routes as well as the rail row.
    default: false,
    hides:
      "When OFF (default), clips are made in a chat: the Clip Studio session, " +
      "the Clips tab of the side panel, the Video Clips modal and the draft " +
      "questions in the thread.\n\nWhen ON, a Clips row in the rail opens the " +
      "brand's VIDEO library (/clips). The flow is the video first, the posts " +
      "last, in the order prod runs it: adding a video starts the analysis at " +
      "once, you review and pick the moments, set the format and subtitles for " +
      "the whole video, refine any clip in ONE editor that holds every tool — " +
      "Trim, Reframe (the crop editor: per-segment One / Two / Fit framing), " +
      "Subtitles, Transcript, Clean up, Text, Brand, Format — then create one " +
      "draft per clip × account and schedule them, without a chat. The " +
      '"Extract video clips" starter leads here; a chat keeps its clips and ' +
      'gains "Open in Clips".',
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
    id: "voicePerNetwork",
    group: "Playbook",
    tip: "A default voice tied to no network; each network can have a voice of its own, learned or adapted by Archie and reviewed before it's saved.",
    label: "Voice per network",
    default: false,
    hides:
      "When OFF (default), a Playbook has one voice for every network. When " +
      "ON, the Voice profile tab has a row of tabs: the default voice (generic, " +
      "« All networks »), then one per network. A network gets its own voice from its posts, the default voice adapted, " +
      "a document, a few questions, or by hand; Archie shows what he'd add and the user " +
      "adds it to the Voice profile or edits it first. Until then it follows " +
      "the default voice, warned. A draft written before its voice changed " +
      "says so and can be rewritten.",
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
    id: "draftChanges",
    group: "Chat & drafts",
    tip: "When Archie rewrites a draft, you see what changed: a card in the chat (Changes or Side by side, Undo) and the new words marked on the draft.",
    label: "UI-Draft changes: what changed",
    // ON: a rewrite keeps the version it replaced. OFF: the rewrite as before,
    // no card, no marks, no undo.
    default: true,
    hides:
      "What a rewrite asked in the chat changed. When ON (default), each " +
      "rewritten draft gets a card in the thread: one sentence naming the " +
      "change with its counts, then the text with the added words marked and " +
      "the removed ones struck through (Changes), or Before and After side by " +
      "side, the view it opens on when most of the words changed. Undo puts " +
      "the version before back, Redo the rewrite. On the draft itself, a strip " +
      "says « Your post has been updated. » with Undo and Accept, in green, and " +
      "the new words stay marked until Accept, a hand edit or the next rewrite.",
  },
  {
    id: "newConversationStyles",
    group: "Chat & drafts",
    tip: "The thread mirrored: Archie on the left, you on the right, one avatar column per side and white object chips. Off: the thread as of Oct 5.",
    label: "New conversation styles",
    // OFF: the thread as of Monday 2026-10-05 — every conversation restyle
    // since then (Tuesday's card system included) is ON only; the Monday
    // values live in styles/chat-legacy.css (body:not(.conv-new)). Figma
    // "Conversation styles" § E1–E4 is the reference for ON. ON by default
    // since 2026-10-29.
    default: true,
    hides:
      "When ON, every turn of the chat takes one shape, mirrored: Archie on the " +
      "left, you on the right, each with a 24px avatar disc on the turn's " +
      "first line and the content beside it (no names; the time on hover, " +
      "in the gutter). Archie's status pill sits on his avatar's line; " +
      "consecutive turns of one side share one avatar; every object (source, " +
      "pick, result) is the same white chip. Butter stays Archie's alone. " +
      "OFF shows the thread as it was on Monday 5 October, for a before / after.",
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
    group: "Chat & drafts",
    tip: "On a new chat, the three workflows become rows (title + description) instead of three big cards.",
    label: "UP-New chat: workflow rows",
    // OFF: the three big starter cards and six Topics. Same three workflows,
    // same handlers either way. ON by default since R3 (2026-10-28): a first
    // screen with one main action and two quiet ways in beats ten entries.
    default: true,
    hides:
      "When ON, a new chat keeps its wordmark, sub-line and composer, and the " +
      "three workflows (batch from a source, clip a video, repurpose a top " +
      "post) become a short list of rows (title + its description) aligned " +
      "on the composer, instead of three big cards. A soft halo of Archie's " +
      "pixels frames the composer; a click sends a ripple through it. Below, one row of " +
      "three Topics to review instead of six.",
  },
  {
    id: "chatPreviewTool",
    group: "Chat & drafts",
    tip: "Shows « Admin: preview in chat » under the composer: every chat element and trigger, played in the current chat.",
    label: "Admin: preview in chat",
    // OFF: a prototype tool doesn't sit in the new chat's hero for everyone
    // (UI polish 2026-10-30, To decide CH-17). ON: the link, as before.
    default: false,
    hides:
      "When ON, the composer's hint row carries « Admin: preview in chat », the " +
      "prototype's catalogue of chat elements and triggers (chat-gallery.js). " +
      "OFF by default: it is a tool for whoever demos the prototype, not part of the product.",
  },
  {
    id: "demoMode",
    group: "Onboarding",
    tip: "From the first screen, try Archie on a made-up brand (Bramble & Bean) with pretend accounts — one wave of drafts, nothing can be scheduled.",
    label: "UP-Onboarding: demo brand",
    default: false,
    hides:
      "When ON, the first screen of the first-time run offers Try it with a " +
      "demo brand: a chat on Bramble & Bean, a coffee roaster I made up, with " +
      "a generic voice and three pretend accounts already connected. I write " +
      "one wave of real drafts, then the demo stops (the drafts stay to look " +
      "at and edit). Scheduling opens a This is a demo dialog instead; Exit " +
      "demo in the topbar wipes it all and goes back to the real setup.",
  },
]);
