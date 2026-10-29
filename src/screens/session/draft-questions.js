// The draft-FOR-whom questions a chat asks before it writes: language, profile
// (and the connect step when none is), repurpose targets, angle, how many
// drafts, and what to do with a source that just landed. Each is an inline Quickpicker in the thread.
// Moved out of session.js, unchanged; askAngleQuestion is also the right
// panel's entry point (it imports this module, not the whole screen).

import { getSessionById } from "../../sessions-store.js?v=2401";
import { getContextById } from "../../contexts-store.js?v=2401";
import { playbookForNewWork } from "../../active-playbook.js?v=2401";
import { isFlagOn } from "../../feature-flags.js?v=2401";
import {
  postAssistantMessage,
  postSelectionEcho,
  postUserProfilesTurn,
  postUserTurn,
  startPending,
  finishPending,
  postActivity,
  postExtractionResult,
  postClipExtractionTurn,
} from "../../assistant.js?v=2401";
import * as inlineQuestion from "../../inline-question.js?v=2401";
import { getIdeas, extractVideoIdeas, appendExtractedIdeas } from "../../library.js?v=2401";
import {
  getSources as getStreamSources,
  setSourceIdeaCount,
  setSourceUse,
  extractClipsForSource,
} from "../../sources-stream.js?v=2401";
import {
  getConnectedProfiles,
  buildConnectedProfileItems,
  PROFILE_SEARCH_THRESHOLD,
  getConnectedProfileById,
  normalizeNetwork,
} from "../../social-profiles.js?v=2401";
import { requireConnectedProfiles } from "../../connect-profiles-flow.js?v=2401";
import { executeDraftBatch, startDraftFlow, getAnglesForIdea } from "../../draft-flow.js?v=2401";
import * as topPostsFlow from "../../top-posts-flow.js?v=2401";

// Build + show the "Which profile?" question, reached from every Draft Post
// entry point. The chosen profile's platform becomes the draft's network so
// the user gets posts on the surface they actually want to publish to. `count` is threaded through from the count
// picker; `onBack` lets the second-step picker return to the first.
// External entry to the draft-from-idea flow — echoes the chosen idea as a
// selection card (so the pick stays visible) then opens the profile step.
// Internal steps (count / angle / Back) call askProfileQuestion directly, so
// the idea echo is posted exactly once, at selection time.
// The Playbook languages backing this chat (primary first). Falls back to the
// default Playbook + "English" so the flow always has a language to write in.
function playbookLanguages(sessionId) {
  const session = getSessionById(sessionId);
  const ctx = session?.contextId ? getContextById(session.contextId) : playbookForNewWork();
  const langs = ctx && Array.isArray(ctx.languages) && ctx.languages.length ? ctx.languages.slice() : null;
  const primary = ctx?.primaryLanguage || (langs && langs[0]) || ctx?.language || "English";
  return { languages: langs || [primary], primary };
}

// Language gate for the draft flow. When the Playbook publishes in more than
// one language, ask which to write in (default = primary) and echo the pick;
// otherwise skip silently. Posts are then generated in that language using its
// native Voice examples — never a translation. `proceed(language)` continues.
function askLanguageQuestion(sessionId, ideaId, proceed) {
  const { languages, primary } = playbookLanguages(sessionId);
  // Multilingual gated behind a flag (default OFF) — and skip when there's only
  // one language to choose from anyway.
  if (!isFlagOn("multilingualPlaybook") || languages.length <= 1) {
    proceed(primary);
    return;
  }
  postAssistantMessage(sessionId, "Which language should I write in?");
  inlineQuestion.ask(sessionId, {
    title: "Choose a language",
    stepLabel: "Language",
    items: languages.map((l) => ({
      value: l,
      label: l,
      caption: l === primary ? "Primary · your Playbook's default" : undefined,
      icon: "ap-icon-web",
    })),
    onPick: (lang) => {
      const chosen = languages.includes(lang) ? lang : primary;
      postSelectionEcho(sessionId, { icon: "ap-icon-web", title: chosen, meta: "Language" });
      proceed(chosen);
    },
    // A default always exists, so Skip writes in the primary language.
    onSkip: () => proceed(primary),
  });
}

export function startIdeaDraft(sessionId, ideaId) {
  const idea = getIdeas(sessionId).find((i) => i.id === ideaId);
  if (idea) {
    const srcName = (idea.sourceIds || []).length
      ? getStreamSources(sessionId).find((s) => s.id === idea.sourceIds[0])?.filename
      : "";
    postSelectionEcho(sessionId, {
      icon: "ap-icon-archie-official",
      title: idea.title,
      meta: srcName ? `Idea · from ${srcName}` : "Idea",
    });
  }
  askLanguageQuestion(sessionId, ideaId, (language) => askProfileQuestion(sessionId, ideaId, { language }));
}

function askProfileQuestion(
  sessionId,
  ideaId,
  { count = 1, angle = null, anglePicks = null, onBack = null, language = null } = {},
) {
  // Nothing connected (skipConnectProfiles) → ask for the connection in this
  // very slot, then come back here. With an account connected this returns
  // straight through, so the flow below is unchanged.
  if (getConnectedProfiles().length === 0) {
    requireConnectedProfiles(sessionId, {
      stepLabel: "Profile",
      onBack: onBack || undefined,
      onReady: () => askProfileQuestion(sessionId, ideaId, { count, angle, anglePicks, onBack, language }),
    });
    return;
  }
  // Connected profiles + their picker presentation come from the shared
  // social-profiles helper, so this picker proposes the exact same
  // accounts (brand handle + avatar with network badge) as the Playbook
  // onboarding profile step.
  const connected = getConnectedProfiles();
  postAssistantMessage(sessionId, "Which account should I draft this for?");
  // The account is where the draft will go, not posts to analyse: every
  // connected account is a valid pick, history or not.
  const profileItems = buildConnectedProfileItems({ requirePosts: false });
  inlineQuestion.ask(sessionId, {
    title: "Pick a connected account",
    stepLabel: "Account",
    items: profileItems,
    // With a lot of connected accounts, a flat list is slow to scan — add a
    // live search box so the user can filter by name/handle/network.
    searchable: profileItems.length > PROFILE_SEARCH_THRESHOLD,
    searchPlaceholder: "Search accounts by name, handle, or network…",
    onPick: (accountId) => {
      const account = connected.find((a) => a.id === accountId);
      // Echo the pick as a visual profile chip (avatar + handle) so selecting a
      // profile gives the same object-preview feedback as picking a post — not
      // a plain text bubble. Mirrors the multi-account batch path below.
      if (account) postUserProfilesTurn(sessionId, [account]);
      postActivity(sessionId, ["set_publishing_accounts"]);
      const channels = account?.platform ? [account.platform] : null;
      // Multi-angle batch (from the angle stepper) → one draft run that
      // produces each angle's count. Otherwise the legacy single-angle path.
      if (anglePicks && anglePicks.length) {
        executeDraftBatch(sessionId, ideaId, channels, anglePicks, language);
      } else {
        startDraftFlow(sessionId, ideaId, count, channels, angle, language);
      }
    },
    onBack: onBack || undefined,
    onSkip: onBack ? undefined : () => {},
  });
}

// ── Published-posts repurposing (top-posts flow) ──────────────────────
// The winner board (top-posts-flow.js) hands off here once the user picks one or
// more winners — via a card's "Repurpose" or the bulk bar. We echo the picks,
// then go straight to the profiles step and generate the network-adapted drafts.
export function startRepurposeFlow(sessionId, postIds) {
  const ids = topPostsFlow.echoRepurposePicks(sessionId, postIds);
  if (!ids.length) return;
  askRepurposeProfiles(sessionId, ids);
}

// Profile-selection — a SINGLE unified per-profile version stepper (no separate
// "same vs other" scope step). Lists every connected profile: source-network
// profiles first, tagged "· Source". Every profile starts at 0 — the user opts
// in explicitly. "Generate N drafts" sums the counts and each draft is adapted
// to its profile's network. This is the first (and only) step after the picks
// are echoed — every repurpose entry point funnels here, so they all behave
// identically.
export function askRepurposeProfiles(sessionId, postIds) {
  // Every profile starts at 0 (fully opt-in); source profiles just lead the list.
  const items = topPostsFlow.repurposeProfileItems(postIds, { include: "all" }).map((it) => ({ ...it, count: 0 }));
  if (!items.length) {
    // Same slot, same shape: ask for the account here, then re-enter with the
    // list this step needs.
    requireConnectedProfiles(sessionId, {
      stepLabel: "Profile",
      onReady: () => askRepurposeProfiles(sessionId, postIds),
    });
    return;
  }
  postAssistantMessage(sessionId, "Where should I repurpose these?");
  inlineQuestion.ask(sessionId, {
    title: "Pick the profiles to repurpose to",
    subtitle: "Set how many drafts I'll write for each account. Leave one at 0 to skip it.",
    stepLabel: "Drafts per account",
    // Per-profile version counter, capped so a single run stays scannable.
    stepper: true,
    countMin: 0,
    countMax: 5,
    submitCountLabel: (total) => `Generate ${total} draft${total === 1 ? "" : "s"}`,
    items,
    // Long profile lists get a live search box to filter down before setting counts.
    searchable: items.length > PROFILE_SEARCH_THRESHOLD,
    searchPlaceholder: "Search accounts by name, handle, or network…",
    onPick: ({ picks, total }) => {
      // Each pick is { value: accountId, count } (count already > 0). Resolve
      // to the account + its network, echo the chosen profiles as chips, then
      // generate `count` versions per profile.
      const targets = picks
        .map((p) => ({ account: getConnectedProfileById(p.value) || null, count: p.count }))
        .filter((t) => t.account);
      postUserProfilesTurn(
        sessionId,
        targets.map((t) => t.account),
      );
      postUserTurn(
        sessionId,
        `${total} draft${total === 1 ? "" : "s"} · ${targets.length} profile${targets.length === 1 ? "" : "s"}`,
      );
      const networkTargets = targets.map((t) => ({
        network: normalizeNetwork(t.account.platform),
        count: t.count,
      }));
      topPostsFlow.executeRepurpose(sessionId, postIds, networkTargets);
    },
  });
}

// "Draft a post from this idea" — step 1: pick an angle. Triggered by the
// right-panel Ideas card "Draft" button. Archie suggests 4 AI-generated
// angles (title + short description) the idea could be reframed into; the
// chosen angle is threaded through the rest of the flow (count → profile →
// generate) so the produced drafts reflect it. Mirrors the screenshot
// pattern by reusing the inline-question numbered-card picker.
export function askAngleQuestion(sessionId, ideaId, { language = null } = {}) {
  // Language gate first (once) — then re-enter with the chosen language so it
  // threads through the angle → count → profile → generate chain.
  if (language === null) {
    askLanguageQuestion(sessionId, ideaId, (lang) => askAngleQuestion(sessionId, ideaId, { language: lang }));
    return;
  }
  const angles = getAnglesForIdea(sessionId, ideaId);
  // No resolvable idea / angles — fall back to the original count flow so
  // the Draft button never dead-ends.
  if (!angles.length) {
    askDraftCountQuestion(sessionId, ideaId, { language });
    return;
  }
  // The prod logs the set-up it ran before proposing angles.
  postActivity(sessionId, ["request_config", "analyze_tone", "propose_angles"]);
  postAssistantMessage(sessionId, "Let's draft from these angles.");
  // The quick picker shows a brand loader (~4s) while Archie "finds the
  // angles", then swaps in the real angle stepper. Cancelling during the
  // loader aborts the reveal.
  inlineQuestion.ask(sessionId, {
    loading: true,
    title: "Suggested angles",
    subtitle: "Finding the strongest angles for this idea…",
    skipLabel: "Cancel",
    onSkip: () => {},
  });
  window.setTimeout(() => {
    if (!inlineQuestion.isActive(sessionId)) return;
    inlineQuestion.ask(sessionId, {
      title: "Suggested angles",
      subtitle: "Set how many drafts I'll write for each angle. Leave one at 0 to skip it.",
      stepLabel: "Drafts per angle",
      skipLabel: "Cancel",
      // Stepper mode — each angle row carries its own drafts counter (0 to
      // skip an angle). "Generate N drafts" sums every angle and advances
      // straight to the profile step, where the whole batch is produced.
      stepper: true,
      defaultCount: 1,
      countMin: 0,
      countMax: 20,
      submitCountLabel: (total) => `Generate ${total} draft${total === 1 ? "" : "s"}`,
      items: angles.map((a) => ({
        value: a.id,
        label: a.title,
        caption: a.description,
      })),
      onPick: ({ picks }) => {
        // Map each picked angle id → its angle object + count.
        const anglePicks = picks
          .map((p) => ({ angle: angles.find((a) => a.id === p.value) || null, count: p.count }))
          .filter((p) => p.angle && p.count > 0);
        const total = anglePicks.reduce((sum, p) => sum + p.count, 0);
        // Echo the batch as a user turn so it stays visible once the picker
        // unmounts — e.g. "3 drafts · 2 angles".
        postUserTurn(
          sessionId,
          `${total} draft${total === 1 ? "" : "s"} · ${anglePicks.length} angle${anglePicks.length === 1 ? "" : "s"}`,
        );
        postActivity(sessionId, ["set_angle_mix"]);
        askProfileQuestion(sessionId, ideaId, {
          anglePicks,
          language,
          // ← Back returns to the angle picker so the user can re-choose.
          onBack: () => askAngleQuestion(sessionId, ideaId, { language }),
        });
      },
      // First step of the flow — no earlier question, so it's Cancel (not Back).
      onSkip: () => {},
    });
  }, 4000);
}

// Step 2: how many drafts. Threads the chosen `angle` through to the
// profile picker. When reached from the angle step (`onBack` set) the
// picker shows a Back affordance; entered directly it shows Cancel.
function askDraftCountQuestion(sessionId, ideaId, { angle = null, onBack = null, language = null } = {}) {
  postAssistantMessage(sessionId, "How many drafts should I generate?");
  const advance = (count) => {
    // Clamp to a reasonable range — single-digit + custom typed numbers
    // can land outside it (0, negative, NaN). 1 floors any nonsense.
    const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)));
    // Echo the count as a user turn so the pick stays visible once the
    // picker unmounts (covers both the preset chips and the custom input).
    postUserTurn(sessionId, `${n} draft${n === 1 ? "" : "s"}`);
    askProfileQuestion(sessionId, ideaId, {
      count: n,
      angle,
      language,
      // ← Back returns to the count picker so the user can change their mind.
      onBack: () => askDraftCountQuestion(sessionId, ideaId, { angle, onBack, language }),
    });
  };
  inlineQuestion.ask(sessionId, {
    title: "How many drafts from this idea?",
    stepLabel: "Drafts",
    skipLabel: "Cancel",
    items: [
      { value: 1, label: "1 draft" },
      { value: 3, label: "3 drafts" },
      { value: 5, label: "5 drafts" },
    ],
    customPlaceholder: "Or type any number (1–20)",
    onPick: advance,
    onCustom: advance,
    // When chained from the angle step, offer Back to it instead of Cancel.
    onBack: onBack || undefined,
    onSkip: onBack ? undefined : () => {},
  });
}

// "What should I do with X?" — asked via the quick picker once freshly-added
// sources are in (intake-lifecycle → onSourcesReady), for EVERY kind: nothing is
// extracted on arrival, the source waits for this answer (its `use` reads
// "Waiting for your answer" meanwhile). Sources that landed together are one
// question; a video adds Cut into clips. Not now sets them aside — they stay in
// the chat's Sources, ready for later.
//
// `onAsk(src)` (optional, one source only) adds "Ask about it" — the session
// owns that question.
// `answer` skips the question when the user already gave it upstream (the
// Batch Studio's « Extract ideas »): the pick runs as if clicked.
export function askSourceUse(sessionId, sourceIds, { onAsk = null, answer = null } = {}) {
  const srcs = sourceIds.map((id) => getStreamSources(sessionId).find((s) => s.id === id)).filter(Boolean);
  if (!srcs.length) return;
  const single = srcs.length === 1 ? srcs[0] : null;
  const isVideo = single?.kind === "Video";
  const ids = srcs.map((s) => s.id);

  if (!answer)
    postAssistantMessage(
      sessionId,
      single
        ? `[[source:${single.id}]] is in. What should I do with it?`
        : `${srcs.map((s) => `[[source:${s.id}]]`).join(", ")} are in. What should I do with them?`,
    );

  const items = single
    ? [
        {
          value: "ideas",
          label: "Find post ideas in it",
          caption: "Pull hooks, stats, and quotes you can post into Ideas.",
          icon: "ap-icon-sparkles",
        },
        isVideo && {
          value: "clips",
          label: "Cut it into clips",
          caption: "Short clips with subtitles, ready to draft posts from.",
          icon: "ap-icon-video",
        },
        {
          value: "post",
          label: "Write a post about it",
          caption: "Go straight to drafting from what it says.",
          icon: "ap-icon-pen",
        },
        {
          value: "summary",
          label: "Sum it up",
          caption: "The gist in a few lines, here in the chat.",
          icon: "ap-icon-file--text",
        },
        onAsk && {
          value: "ask",
          label: "Ask about it",
          caption: "Question it before deciding.",
          icon: "ap-icon-single-chat-bubble",
        },
      ].filter(Boolean)
    : [
        {
          value: "ideas",
          label: "Find post ideas in each",
          caption: "Ideas from every source, side by side in Ideas.",
          icon: "ap-icon-sparkles",
        },
        {
          value: "post",
          label: "Write a post using them all",
          caption: "One post that draws on all of them.",
          icon: "ap-icon-pen",
        },
      ];

  const onPick = (value) => {
    const label = items.find((i) => i.value === value)?.label;
    if (value !== "ask" && label && !answer) postUserTurn(sessionId, label);
    if (value === "ideas") runFindIdeas(sessionId, srcs);
    else if (value === "clips") {
      setSourceUse(sessionId, ids, "clips");
      runVideoClipsChoice(sessionId, single.id, single.filename);
    } else if (value === "post") runWritePost(sessionId, srcs);
    else if (value === "summary") runSummary(sessionId, single);
    else if (value === "ask") onAsk(single);
  };
  if (answer) {
    onPick(answer);
    return;
  }

  inlineQuestion.ask(sessionId, {
    title: single ? "Use this source" : `Use these ${srcs.length} sources`,
    stepLabel: single ? single.kind || "Source" : "Sources",
    skipLabel: "Not now",
    items,
    onPick,
    onSkip: () => {
      setSourceUse(sessionId, ids, "set_aside");
      postAssistantMessage(
        sessionId,
        single
          ? "Okay, I'll leave it in Sources for when you need it."
          : "Okay, I'll leave them in Sources for when you need them.",
      );
    },
  });
}

// Find post ideas — a video keeps its canned idea set; any other source runs
// the shared extraction (one extraction turn for the whole arrival).
function runFindIdeas(sessionId, srcs) {
  const ids = srcs.map((s) => s.id);
  if (srcs.length === 1 && srcs[0].kind === "Video") {
    runVideoIdeasChoice(sessionId, srcs[0].id, srcs[0].filename);
    setSourceUse(sessionId, ids, "ideas");
    return;
  }
  appendExtractedIdeas(sessionId, srcs, (created) => {
    for (const s of srcs) setSourceIdeaCount(sessionId, s.id, created.filter((i) => i.sourceIds.includes(s.id)).length);
    setSourceUse(sessionId, ids, "ideas");
  });
}

// Write a post — drafting starts from an IDEA, so extract one first, then
// draft from it. Several sources → that one idea draws on all of them.
function runWritePost(sessionId, srcs) {
  const ids = srcs.map((s) => s.id);
  appendExtractedIdeas(sessionId, srcs.slice(0, 1), (created) => {
    const idea = created?.[0];
    if (!idea) return;
    idea.sourceIds = ids;
    setSourceUse(sessionId, ids, "post");
    askTreatment(sessionId, idea.id);
  });
}

// ── How should I use this source? ─────────────────────────────────────────
// The prod's source treatments (panels.treatment.*): what the post DOES with
// the source — summarise it, argue with it, promote it… Config, not a mock, so
// it lives with the flow. `body` is the mock draft line each one writes.
const SOURCE_TREATMENTS = [
  {
    value: "share",
    label: "Share its ideas",
    caption: "Pass on what it says, in your voice.",
    body: "Here's what stood out to me — and why it matters for you.",
  },
  {
    value: "summarize",
    label: "Summarize it",
    caption: "The gist, for people who won't read it.",
    body: "Short on time? Here's the whole thing in three lines.",
  },
  {
    value: "fact",
    label: "Pull a key fact",
    caption: "One number or finding, front and centre.",
    body: "One number from this changes how I think about the problem.",
  },
  {
    value: "example",
    label: "Use it as an example",
    caption: "A case that proves a point you make.",
    body: "If you want proof this works, look at what they did.",
  },
  {
    value: "build",
    label: "Build on it",
    caption: "Take its idea one step further.",
    body: "They stopped one step short. Here's the step after.",
  },
  {
    value: "contrast",
    label: "Contrast with it",
    caption: "Show how your take differs.",
    body: "Same problem, opposite answer — here's ours.",
  },
  {
    value: "promote",
    label: "Promote it",
    caption: "Send people to read or watch it.",
    body: "Worth your next ten minutes. Here's why.",
  },
  {
    value: "react",
    label: "React to it",
    caption: "Your honest first take.",
    body: "I read this twice. My first reaction hasn't changed.",
  },
  {
    value: "critique",
    label: "Critique it",
    caption: "Where it falls short, fairly.",
    body: "Not everything here holds up. Here's where it falls short.",
  },
  {
    value: "rebut",
    label: "Rebut it",
    caption: "Argue the opposite, with reasons.",
    body: "I disagree, and here's the case for the other side.",
  },
];

// Step 1 — the treatment, with a free-text row for anything else. Then how many
// drafts, the language (when the Playbook has several) and the account — the
// same tail as an angle pick, the treatment riding in as the angle.
export function askTreatment(sessionId, ideaId, { onBack = null } = {}) {
  postAssistantMessage(sessionId, "How should I use this source?");
  const advance = (treatment) => {
    postUserTurn(sessionId, treatment.label);
    askTreatmentCount(sessionId, ideaId, treatment, () => askTreatment(sessionId, ideaId, { onBack }));
  };
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Treatment",
    skipLabel: "Not now",
    items: SOURCE_TREATMENTS.map(({ value, label, caption }) => ({ value, label, caption })),
    customPlaceholder: "Or say how, in your words",
    onPick: (value) => advance(SOURCE_TREATMENTS.find((t) => t.value === value)),
    onCustom: (text) => {
      const how = String(text || "").trim();
      if (how) advance({ value: "custom", label: how, body: how });
    },
    onBack: onBack || undefined,
    onSkip: onBack ? undefined : () => {},
  });
}

function askTreatmentCount(sessionId, ideaId, treatment, onBack) {
  postAssistantMessage(sessionId, "How many drafts should I write?");
  const advance = (count) => {
    const n = Math.max(1, Math.min(10, Math.floor(Number(count) || 1)));
    postUserTurn(sessionId, `${n} draft${n === 1 ? "" : "s"}`);
    const angle = {
      id: `treatment-${treatment.value}`,
      title: treatment.label,
      description: treatment.body,
      contextLabel: `Treatment · ${treatment.label}`,
    };
    askLanguageQuestion(sessionId, ideaId, (language) =>
      askProfileQuestion(sessionId, ideaId, {
        anglePicks: [{ angle, count: n }],
        language,
        onBack: () => askTreatmentCount(sessionId, ideaId, treatment, onBack),
      }),
    );
  };
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Drafts",
    items: [
      { value: 1, label: "1 draft" },
      { value: 3, label: "3 drafts" },
      { value: 5, label: "5 drafts" },
    ],
    customPlaceholder: "Or type any number (1–10)",
    onPick: advance,
    onCustom: advance,
    onBack,
  });
}

// Sum it up — the gist in the thread, nothing produced. A text source quotes
// its own opening; anything else gets a generic three-line gist (mock).
function runSummary(sessionId, src) {
  const pendingId = startPending(sessionId, "Reading the source…", ["answer_pdf_question"]);
  setTimeout(() => {
    finishPending(sessionId, pendingId);
    const lead = src.preview
      ? `It opens with "${src.preview}"`
      : `It's ${src.kind === "URL" ? "a page" : "a document"} about ${src.filename.replace(/\.[a-z0-9]+$/i, "")}`;
    postAssistantMessage(
      sessionId,
      `Here's the gist of [[source:${src.id}]]:\n- ${lead}.\n- Its main point is the one worth posting about: what changes for the reader, and why now.\n- It backs that up with a few concrete examples you could quote.\n\nWant me to find post ideas in it, or write a post about it?`,
    );
  }, 1600);
}

// ── Video-intake choice branches ──────────────────────────────────────────
// Run after the user answers "what to do with this video?" (intake-lifecycle).
// Extraction is deferred at upload, so each branch produces only its output.

// "Analyze for ideas" — brief thinking chip, inject the canned video ideas,
// surface the source-intake "N ideas" pill, then post the rich extraction turn.
function runVideoIdeasChoice(sessionId, sourceId, filename) {
  const pendingId = startPending(sessionId, "Extracting ideas from content…", ["extract_ideas"]);
  setTimeout(() => {
    finishPending(sessionId, pendingId);
    const ideas = extractVideoIdeas(sessionId, sourceId);
    setSourceIdeaCount(sessionId, sourceId, ideas.length);
    postExtractionResult(sessionId, { filename, ideas });
  }, 1600);
}

// "Extract & create clips" — post the clip-extraction turn (renders pending,
// cycling through explanatory stages while no clips exist yet), then kick off
// the staged ~7.5s extraction. The ticker owns the timing and flips the turn to
// "ready" (via clipExtractionStatus) once the clips are attached.
function runVideoClipsChoice(sessionId, sourceId, filename) {
  postClipExtractionTurn(sessionId, { sourceId, filename });
  extractClipsForSource(sessionId, sourceId);
}
