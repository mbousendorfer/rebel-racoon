export const FLAGS = Object.freeze([
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
    id: "playbookDefault",
    label: "Default Playbook toggle",
    default: false,
    hides:
      "When OFF (default), hides the star button next to the Playbook name on " +
      "the /playbook detail page that sets/unsets it as the default Playbook. " +
      "The default-selection logic still works internally.",
  },
  {
    id: "connectors",
    label: "Connectors (live MCP sources)",
    default: false,
    hides:
      "When OFF (default), hides everything connectors-related: the " +
      "Connectors gallery (route /connectors + sidebar nav) and modal, the " +
      "composer Add → 'Connected sources' submenu, the Sources panel 'Live " +
      "connectors' group, the Settings → Connectors section, and the " +
      "Add-source modal's Connectors tab.",
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
    id: "statusActionSnackbars",
    label: "Action success snackbars",
    default: false,
    hides:
      "When OFF, suppress the success snackbars that now duplicate the " +
      "persistent composer status bar: 'N drafts ready to review', " +
      "'Drafted N posts from <source>', 'N ideas ready', and the non-video " +
      "source-ready toast ('<source> ready · N ideas'). The composer status " +
      "bar (and the in-progress / video-ready toasts) stay regardless.",
  },
  {
    id: "playbookColors",
    label: "Playbook colors",
    default: false,
    hides:
      "When OFF (default), hides the playbook color visuals everywhere: the " +
      "top stripe + palette dots on /contexts cards, the color dot on " +
      "sidebar conversation rows, and the color swatch picker in the " +
      "brief panel. When ON, the color coding is shown. Body gets " +
      "`hide-playbook-colors` while the flag is OFF.",
  },
  {
    id: "manyProfiles",
    label: "Many connected profiles (demo)",
    default: false,
    hides:
      "When ON, seeds a large, varied set of connected social profiles (~40 " +
      "across Facebook / Instagram / LinkedIn / X / TikTok / YouTube) so the " +
      "profile quickpicker's search field can be evaluated with a realistic " +
      "long list. When OFF (default), only the base connected accounts show " +
      "and the picker stays a short, unsearched list.",
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
      "playbookCompetitors \u2014 only the surfaces are gated.\n\nWhen ON, " +
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
    id: "playbookCompetitors",
    label: "Playbook competitors",
    default: false,
    hides:
      "When OFF (default), hides the Competitors section of a Playbook: its " +
      "panel + rail entry on /playbook and the onboarding recap, and the " +
      "competitor counter on /contexts cards. The discovered competitors " +
      "still ride along in the data (the website analysis pre-fills them) — " +
      "only the surfaces are gated, like multilingualPlaybook. When ON, the " +
      "section lists competitors (name, description, website, social " +
      "profiles, auto-extracted favicon), Archie can discover more from the " +
      "brand's market, and each one is editable in its own modal.",
  },
  {
    id: "playbookSharing",
    label: "Playbook sharing (org-wide)",
    default: false,
    hides:
      "Whether a Playbook belongs to somebody. When OFF (default), there is " +
      "one implicit user: every Playbook is visible, editable and deletable, " +
      "exactly as before. The ownership data (owner, scope, change log) still " +
      "rides along in the seeds, like playbookCompetitors. When ON, a Playbook " +
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
    id: "imageStudioAutoBrief",
    label: "Image Studio: auto-written brief + centred setup",
    default: false,
    hides:
      "Reshapes how the Image Studio's prompt relates to the settings, and where the " +
      "settings live. When OFF (default), the brief is a hand-editable field: Type and " +
      "References rewrite it (behind the 'Rewrite your prompt?' guard), changing Type " +
      "also backfills 'Text in image', and Style/Format/Output leave it alone; the " +
      "settings stay pinned to the stage's left edge throughout. When ON: (1) the brief " +
      "is a read-only OUTPUT of the settings, always in sync — EVERY setting rewrites it " +
      "(Type, Style, Format, References, Branding, Output, and 'Text in image' on " +
      "commit), Type never touches 'Text in image' after the one-time seed at open, and " +
      "the hand-edit guard is retired in favour of an explicit 'Edit the brief' takeover " +
      "(settings then offer a rebuild instead of overwriting); (2) until an image exists " +
      "the settings hold the CENTRE of the stage as one sheet at a readable measure, " +
      "instead of a 284px pinned column that ran out of height and clipped its own " +
      "controls beside an empty 'your image appears here' placeholder. Once there is an " +
      "image to preview, the inspector returns to the left edge.",
  },
]);
