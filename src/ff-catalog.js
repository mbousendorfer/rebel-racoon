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
]);
