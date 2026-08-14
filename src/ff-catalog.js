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
    id: "topics",
    label: "Topics (listening dossiers)",
    default: false,
    hides:
      "When OFF (default), hides everything Topics-related: the /topics feed " +
      "route + its sidebar nav row and unseen counter, the topic dossier " +
      "dialog, and the Topics section (sources + refresh cadence) on a " +
      "Playbook. The seeded dossiers and the per-Playbook config still ride " +
      "along in the data, like playbookCompetitors. When ON, Agorapulse " +
      "listening produces dossiers — a headline, a written analysis, and the " +
      "social posts behind it — from six sources tied to the Playbook's " +
      "competitors; each one can open a chat with itself attached, or be " +
      "dismissed.",
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
    id: "frontPage",
    label: "Front page (vs. hero rail)",
    default: false,
    hides:
      "Where Archie's feed of proposals lives. Requires `topics` — with that " +
      "flag OFF neither variant renders. When OFF (default), the freshest " +
      "topics ride as a rail inside the new-chat hero, above the workflow " +
      "starters, and `/` keeps redirecting to the most recent chat. When ON, " +
      "`/` stops redirecting and becomes a browsable front page (a lead story " +
      "+ a short grid + source sections), a Home row appears in the sidebar " +
      "nav, and the hero rail steps aside so the two never duplicate each " +
      "other. `/topics` stays the full section either way — the front page is " +
      "a selection, /topics is everything.",
  },
  {
    id: "imageStudioAutoBrief",
    label: "Image Studio: auto-written brief (read-only)",
    default: false,
    hides:
      "Reshapes how the Image Studio's prompt relates to the settings. When OFF " +
      "(default), the brief is a hand-editable field: Type and References rewrite " +
      "it (behind the 'Rewrite your prompt?' guard), changing Type also backfills " +
      "'Text in image', and Style/Format/Output leave it alone. When ON, the brief " +
      "is a read-only OUTPUT of the settings, always in sync: EVERY setting rewrites " +
      "it (Type, Style, Format, References, Branding, Output, and 'Text in image' on " +
      "commit), Type never touches 'Text in image' after the one-time seed at open, " +
      "and the whole hand-edit guard is retired. An explicit 'Edit the brief' takes " +
      "it over (settings then offer a rebuild instead of overwriting).",
  },
  {
    id: "imageStudioGridBrief",
    label: "Image Studio: brief as an editable grid",
    default: false,
    hides:
      "A third take on the Image Studio prompt. When OFF (default), unchanged. " +
      "When ON, the whole generate screen becomes a full-bleed DASHBOARD GRID of " +
      "editable cards — a structured brief editor. The prompt is decomposed into " +
      "fixed named fields Archie fills from the post (What this is about / achieve " +
      "/ who it is for / tone / headline / the one thing + a 'Write text on the " +
      "image' toggle), and Type / Style / References / Branding / Format / Output " +
      "are cards too, with their controls inline. No prose prompt is shown — the " +
      "cards ARE the editor and Generate assembles them into the model prompt. " +
      "Generate swaps to the existing results stage; 'Edit the brief' returns to " +
      "the grid. Wins over imageStudioAutoBrief when both are on.",
  },
]);
