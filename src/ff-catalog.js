// The admin menu lists the flags under these headings, in this order. Every
// flag names one in `group`; `tip` is its one-line tooltip there (`hides` is
// the long form, for the docs).
export const FLAG_GROUPS = Object.freeze(["New surfaces", "Playbook", "Voice", "Chat & drafts", "Onboarding"]);

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
    id: "newConversationStyles",
    group: "Chat & drafts",
    tip: "The thread mirrored: Archie on the left, you on the right, avatars, head lines and white object chips. Off: the thread as of Oct 5.",
    label: "New conversation styles",
    // OFF: the thread as of Monday 2026-10-05 — every conversation restyle
    // since then (Tuesday's card system included) is ON only; the Monday
    // values live in styles/chat-legacy.css (body:not(.conv-new)). Figma
    // "Conversation styles" § E1–E4 is the reference for ON.
    default: false,
    hides:
      "When ON, every turn of the chat takes one shape, mirrored: Archie on the " +
      "left, you on the right, each with a 24px avatar disc and a head line " +
      "(name, time, what happened). Archie's status pill moves into his head " +
      "line; your picks get a neutral pill ('Added a source', 'Picked 1 " +
      "account'). Your words lose the navy bubble and read like Archie's; " +
      "consecutive Archie messages fold into one turn; every object (source, " +
      "pick, result) is the same white chip. Butter stays Archie's alone. " +
      "OFF shows the thread as it was on Monday 5 October, for a before / after.",
  },
  {
    id: "newChatHero",
    group: "Chat & drafts",
    tip: "On a new chat, the three workflows become rows (title + description) instead of three big cards.",
    label: "UP-New chat: workflow rows",
    // OFF: the three big starter cards and six Topics. Same three workflows,
    // same handlers either way.
    default: false,
    hides:
      "When ON, a new chat keeps its wordmark, sub-line and composer, and the " +
      "three workflows (batch from a source, clip a video, repurpose a top " +
      "post) become a short list of rows (title + its description) aligned " +
      "on the composer, instead of three big cards. Below them, one row of " +
      "three Topics to review instead of six.",
  },
  {
    id: "networkVoices",
    group: "Voice",
    tip: "A base voice plus one adaptation per network. Rules are proposed in the chat as drafts get reworked, never written silently.",
    label: "Voice per network, with coaching",
    // OFF: lands dark. The data (voiceBaseNetwork / voiceByNetwork) rides
    // along in the seeds either way, like multilingualPlaybook.
    default: false,
    hides:
      "When OFF, a Playbook has one voice. ON gives it a BASE voice — learned " +
      "from the network of the profile picked at creation — and an adaptation " +
      "per network it publishes on: each network overrides only the parts that " +
      "differ (How the Brand sounds, Always, Never, Depending on the post, Now " +
      "and then); a rule it was taught joins its Always or Never.\n\n" +
      "Archie coaches it over time, and never writes it silently: when you " +
      "rework a draft, when you thumbs-down one with a " +
      "reason, or by asking a question after drafting for a network whose " +
      "voice is thin, it PROPOSES a rule — a card in the chat, and the " +
      '"What I\'ve learned" block on the Voice tab. Nothing enters the ' +
      "Playbook without a click. Each network voice says how far along it is. " +
      "The per-network view lives on the Playbook 2.0 page (flag playbook2).",
  },
  {
    id: "voiceNewSection",
    group: "Voice",
    tip: 'Demo: marks "Depending on the post" as a part the product just added (orange arc, New pills). Pairs with Voice per network.',
    label: "Voice: simulate a new section (Depending on the post)",
    // A demo, not a feature: how the Voice tab tells a user the product added a
    // part to every voice. Needs networkVoices.
    default: false,
    hides:
      "Marks Depending on the post as a part the product just added. Every " +
      "network that hasn't written its own says what's new: an orange arc on " +
      'its ring, "1 new part" in its band, a dot on its tab, a New pill on the ' +
      "block, a New step in the Optimize wizard — and Optimize leaves it to do. " +
      "On a Playbook whose base voice has no cases yet, the base asks for them " +
      "too. Off, the part is an ordinary one. Needs networkVoices.",
  },
  {
    id: "connectFirst",
    group: "Onboarding",
    tip: "The first-time run as screens: profiles first, the Playbook card filling in on the right, then a reveal.",
    label: "UP-Onboarding: connect profiles first",
    // OFF: a new user lands straight in the onboarding chat, where connecting
    // an account is the step after the website URL.
    default: false,
    hides:
      "When ON, the first-time run is a series of screens instead of the chat. " +
      "First the plan — the steps ahead, in order — then one screen per step, " +
      "all in the same split: the step on the left, and on the right Archie's " +
      "stage where the Playbook card fills in with the real answers (the " +
      "connected profiles, the site's name, voice, audience, colours). " +
      "Profiles come first (Skip stays, its reasons optional); the website is " +
      "a field, prefilled, with files, a short interview or by hand as other " +
      "ways in. It ends on a reveal — Start writing, or review the details.",
  },
]);
