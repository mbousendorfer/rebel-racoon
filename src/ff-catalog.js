export const FLAGS = Object.freeze([
  {
    id: "insightsHub",
    label: "Insights hub (/insights)",
    // OFF: the feature lands dark. The flag gates the ROUTE as well as the nav
    // row — a typed /insights bounces home while the switch is off.
    default: false,
    hides:
      "When OFF, the Insights section disappears entirely. ON adds the active " +
      "brand's objectives read two ways (Cockpit / Report, a select in the " +
      "page bar): the counted verdict, a real trajectory toward target per " +
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
      "the studios' drafts. The four pickers become static indicators — they " +
      "still SAY which brand, they no longer ask.\n\nThe cost is stated in " +
      "active-playbook.js: a scope HIDES. There is deliberately no " +
      '"All playbooks" view, which is why the switcher is permanent and always ' +
      "prints the brand name — the scope is only safe while it is legible. " +
      "/contexts stays unfiltered: it is the catalogue the switcher picks from.",
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
      "queue you triage it in: two segments (Ready to draft / Topics for later), " +
      "a Filters dropdown, three age groups, and the article opening beside the " +
      "list. A Topic offers exactly two verbs, Use in chat (which marks it Used " +
      "and opens a new chat with it attached as a Source) and Ignore (which asks " +
      "why, and is reversible).\n\nTHE INVARIANT IT RESTS ON: a Topic's review " +
      "status and its two attention signals are three separate things. Trending " +
      "and Updated are never a status and never override the status filter \u2014 " +
      "an ignored Topic that starts trending stays hidden.",
  },
  {
    id: "playbookSharing",
    label: "Playbook sharing (org-wide)",
    default: false,
    hides:
      "Whether a Playbook belongs to somebody. When OFF (default), there is " +
      "one implicit user: every Playbook is visible, editable and deletable, " +
      "exactly as before. The ownership data (owner, scope, change log) still " +
      "rides along in the seeds, like multilingualPlaybook. When ON, a Playbook " +
      "is either personal or shared with the whole organisation — there is no " +
      "named sharing. Its owner is the only one who can edit, delete, share or " +
      "hand it over; everyone else may open it READ-ONLY, use it in a chat, and " +
      "duplicate it into a Playbook of their own. A manager (Admin \u2192 Your " +
      "role) gets the owner's rights on shared Playbooks only, and every action " +
      "they take on someone else's notifies the owner and lands in the change " +
      "log. Losing access degrades the chats that used it: the drafts already " +
      "written can still be saved or scheduled, nothing new can be generated. " +
      "Also gates the Share modal, the ownership marks on /contexts cards, the " +
      "owner row on a Playbook, and the Your-role control in Admin.",
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
      "where they left off once the connect modal confirms. Every other profile " +
      "surface (Clip Studio, Top Posts, Objectives, the analyze-profiles modal) " +
      "simply renders its empty list until an account is connected.",
  },
]);
