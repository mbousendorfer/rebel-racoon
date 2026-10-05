export const FLAGS = Object.freeze([
  {
    id: "insightsHub",
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
    id: "draftInlineEdit",
    label: "Inline edit on draft posts",
    default: false,
    hides:
      "Inline editing affordance + handler for draft post cards in the " +
      "right panel (introduit par le commit 1e3076e — feat(rpanel): " +
      "inline editing for draft posts).",
  },
  {
    id: "connectors",
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
    label: "Conversation status card",
    default: false,
    hides:
      "When OFF, hides the floating conversation status card (sources / " +
      "ideas / clips / drafts summary) entirely, including its 'i' toggle " +
      "button in the session topbar.",
  },
  {
    id: "multilingualPlaybook",
    label: "Multilingual Playbooks",
    default: false,
    hides:
      "When OFF (default), Playbooks are single-language: the Audience & goals " +
      "language row is a plain English-only picker, the Voice & style panel has " +
      "no per-language switcher, and the draft flow never asks which language to " +
      "write in. When ON, a Playbook holds several languages (languages[] / " +
      "primaryLanguage / voiceByLanguage), the Voice examples are authored per " +
      "language, and drafting asks the target language. Underlying multilingual " +
      "data is preserved either way — only the surfaces are gated.",
  },
  {
    id: "topicFeed",
    label: "Topic Feed (listening)",
    default: false,
    hides:
      "When OFF (default), hides everything the Topic Feed touches: the /topics " +
      "route and its settings page, the sidebar nav row and its unread mark, the " +
      '"Fresh topics to review" list on a new chat, and the composer Add menu\'s ' +
      '"Pick from the Topic Feed". A stale deep link bounces to /. The seeded ' +
      "feeds and Topics ride along in the data either way, like " +
      "multilingualPlaybook \u2014 only the surfaces are gated.\n\nWhen ON, " +
      "Agorapulse listening assembles a TOPIC per feed \u2014 a headline, an " +
      "article in two sections, and the posts behind it \u2014 and /topics is the " +
      "queue you triage it in: one list of both lanes (To review and For " +
      "later, told apart by a chip), a Filters panel to narrow by lane, answer " +
      "or source, three age groups, and the article opening beside the list. A Topic offers exactly two verbs, Use in chat (which marks it Used " +
      "and opens a new chat with it attached as a Source) and Ignore (which asks " +
      "why, and is reversible).\n\nTHE INVARIANT IT RESTS ON: a Topic's review " +
      "status and its two attention signals are three separate things. Trending " +
      "and Updated are never a status and never override the status filter \u2014 " +
      "an ignored Topic that starts trending stays hidden.",
  },
  {
    id: "playbookSharing",
    label: "Playbook sharing",
    default: false,
    hides:
      "Whether a Playbook belongs to somebody. When OFF (default), there is " +
      "one implicit user: every Playbook is visible, editable and deletable, " +
      "exactly as before. The ownership data (owner, scope, change log) still " +
      "rides along in the seeds, like multilingualPlaybook. When ON, a Playbook " +
      "is personal, shared with named colleagues (a fixed list), or shared " +
      "with the whole organisation (a dynamic one, joiners included). Its " +
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
    id: "playbook2",
    label: "Playbook 2.0 — the fiche in tabs",
    // OFF: lands dark. Only the saved Playbook's page (/playbook/:id) changes;
    // the onboarding recap keeps the long single-page reveal.
    default: false,
    hides:
      "When OFF, a Playbook's page is one long scroll with a section rail. ON " +
      "rebuilds it: an identity header with the page's actions, DS tabs — " +
      "Overview, Audience & goals, Voice & style, Brand, Competitors — and an " +
      "Overview that shows the brand at a glance (who it's for, how it sounds, " +
      "how it looks, who it competes with), each card opening its tab.",
  },
  {
    id: "sexySquirrel",
    label: "Sexy Squirrel — AI Image Generator (from a draft)",
    // OFF: lands dark. Gates the draft's studio (the old Image Studio opens
    // instead), the style creator route, and the Playbook's brand-kit rows —
    // Image styles included — plus two creation entries.
    default: false,
    hides:
      "When OFF, the Image Generator disappears entirely. ON replaces a draft's " +
      "image studio with an AI image generator for social posts (Instagram, " +
      "Facebook, X, LinkedIn): describe the image or suggest it from the post, " +
      "pick a style, get up to four variations and put one in the draft. The " +
      "brand is the Playbook: ON also adds its brand kit (logo versions, colour " +
      "roles, words to avoid, visual rules, and the brand's own image " +
      "styles) to the Playbook page, and two more ways to create a Playbook " +
      "(from files, or by hand).",
  },
  {
    id: "networkVoices",
    label: "Voice per network, with coaching",
    // OFF: lands dark. The data (voiceBaseNetwork / voiceByNetwork) rides
    // along in the seeds either way, like multilingualPlaybook.
    default: false,
    hides:
      "When OFF, a Playbook has one voice. ON gives it a BASE voice — learned " +
      "from the network of the profile picked at creation — and an adaptation " +
      "per network it publishes on: each network overrides only what differs " +
      "(hooks, closings, formatting, emoji) and keeps the rules it was taught.\n\n" +
      "Archie coaches it over time, and never writes it silently: when you " +
      "rework a draft (needs draftInlineEdit), when you thumbs-down one with a " +
      "reason, or by asking a question after drafting for a network whose " +
      "voice is thin, it PROPOSES a rule — a card in the chat, and the " +
      '"Archie wants to remember" tray on the Voice tab, drawn as memory notes in Archie\'s butter. Nothing enters the ' +
      "Playbook without a click. Each network voice says how far along it is. " +
      "The per-network view lives on the Playbook 2.0 page (flag playbook2).",
  },
  {
    id: "skipConnectProfiles",
    label: "Skip connecting profiles at setup",
    default: false,
    hides:
      "Whether connecting a social account is a REQUIREMENT or a choice. When OFF " +
      "(default), creating a Playbook makes you pick which profile will publish " +
      "before you can go on, and the ~40 demo accounts are connected from the " +
      "start.\n\nWhen ON, nothing is connected to begin with (in both user " +
      "modes) and the step becomes optional: it still asks — offering to connect " +
      "an account when none is, or the usual profile pick when some are — but it " +
      "carries a Skip, and the step count is unchanged. Skipping is not a dead " +
      "end.\n\nThe ask comes back at the moment it is needed: " +
      "the three chat flows that draft FOR an account — draft from an idea, " +
      'draft from clips, and repurpose — each replace their "pick an account" ' +
      'step with a "connect an account" step in the same place, and resume ' +
      "where they left off once the connect modal confirms. The Clip Studio " +
      "and Top Posts ask too (a picker must never render empty); surfaces that " +
      "only LIST profiles (Objectives, the analyze-profiles modal) render their " +
      "empty list until an account is connected.",
  },
]);
