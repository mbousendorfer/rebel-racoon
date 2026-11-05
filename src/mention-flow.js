// mention-flow — mentions in drafts, asked in the chat (flag draftMentions).
//
//   « mention Notion in the LinkedIn post », « tag Notion, Figma and Jordan Lee
//   in all the drafts », « remove the mention of Notion », and my offer after
//   writing drafts that name a brand (postDraftResult).
//
// Each draft has one network, so I ask which accounts network by network (the
// mention's text and rules: mentions.js): a search where you tick one account
// or several, each name said with a single match already ticked — you pick, I
// don't guess (2026-11-03). Instagram / TikTok have no search (prod), so I ask
// for the usernames. The questions come one network at a time, then every
// draft changes at once. Your pick echoes as a chip; I answer in one sentence,
// no « what changed » card.

import { postAssistantMessage, postUserTurn, postActivity, postUserProfilesTurn } from "./assistant.js?v=2749";
import * as inlineQuestion from "./inline-question.js?v=2749";
import { getPosts, updatePostContent } from "./posts-store.js?v=2749";
import { isFlagOn } from "./feature-flags.js?v=2749";
import { networkLabel, networkIcon, normalizeNetwork } from "./social-profiles.js?v=2749";
import { focusInPanel } from "./components/right-panel.js?v=2749";
import { escapeHtml } from "./utils.js?v=2749";
import {
  HANDLE_RE,
  joinList,
  mentionMode,
  searchMentions,
  mentionAccounts,
  typedAccount,
  mentionCaption,
  mentionAvatar,
  mentionUrl,
  applyMentions,
  removeMentions,
  mentionsNamedIn,
  nameForHandle,
} from "./mentions.js?v=2749";

export { MENTION_ASK, UNMENTION_ASK, mentionNamesIn } from "./mentions.js?v=2749";

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
const uniq = (list) => [...new Set(list)];
const names = (said) => joinList(said.map((s) => escapeHtml(s.name)));

// Add `said` ([{ name, handle? }], empty when the sentence names nobody) to
// `drafts`, the accounts asked network by network.
export function mentionInDrafts(sessionId, drafts, said = []) {
  // « @NotionHQ » names Notion: searched by its name on the other networks.
  said = said.map((s) => (s.handle && nameForHandle(s.handle) ? { ...s, name: nameForHandle(s.handle) } : s));
  const networks = [...new Set(drafts.map((d) => normalizeNetwork(d.network)))];
  const resolved = new Map(); // network → accounts ([] when skipped)
  const questions = [];
  for (const n of networks.filter(mentionMode)) {
    // Usernames you typed yourself are your pick; anything else, I ask.
    if (mentionMode(n) === "typed" && said.length && said.every((s) => s.handle && HANDLE_RE.test(s.handle)))
      resolved.set(
        n,
        said.map((s) => typedAccount(n, s.handle, s.name)),
      );
    else questions.push(n);
  }
  const total = questions.length;
  const next = () => {
    const n = questions.shift();
    if (!n) return apply(sessionId, drafts, resolved, said);
    const step = total > 1 ? `${networkLabel(n)} · ${total - questions.length} of ${total}` : networkLabel(n);
    askAccounts(sessionId, n, said, step, (accounts) => {
      resolved.set(n, accounts);
      // Named by your first pick: the next network's search ticks them too.
      if (!said.length) said = uniq(accounts.map((a) => a.entity)).map((name) => ({ name }));
      next();
    });
  };
  next();
}

// What each searchable network finds (prod's mention search), said in the
// picker so you know what you can look for.
const FINDS = {
  linkedin: "LinkedIn finds companies, and people who follow your Page.",
  facebook: "Facebook finds Pages only, not people.",
  x: "X finds any account, by name or @handle.",
};

// One network's question: the search (LinkedIn, Facebook, X), or the usernames
// (Instagram, TikTok). Skipping leaves that network's drafts without them.
// `again`: usernames just refused — the refusal already asked once more.
function askAccounts(sessionId, network, said, step, done, again = false) {
  const label = networkLabel(network);
  const skip = { skipLabel: `Not on ${label}`, onSkip: () => done([]) };
  // Your pick, as profile cards: face or logo, name, then what tells it apart.
  const echo = (accounts) =>
    postUserProfilesTurn(
      sessionId,
      accounts.map((a) => {
        const avatar = mentionAvatar(a);
        const typed = mentionMode(network) === "typed";
        return {
          platform: network,
          name: typed ? `@${a.handle}` : a.name,
          handle: typed ? label : mentionCaption(a),
          photo: avatar.imageUrl,
          square: avatar.square,
          tint: avatar.tint,
          initials: initials(a.name),
        };
      }),
    );
  if (mentionMode(network) === "typed") {
    if (!again)
      postAssistantMessage(
        sessionId,
        said.length === 1 ? `I need ${names(said)}'s ${label} username.` : `I need the ${label} usernames.`,
      );
    inlineQuestion.ask(sessionId, {
      title: said.length === 1 ? `What's the exact ${label} username?` : `What are the exact ${label} usernames?`,
      subtitle: `${label} has no search for mentions: type ${said.length === 1 ? "it" : "them, separated by commas"}, and I'll link ${said.length === 1 ? "it" : "each one"} so you can check.`,
      stepLabel: step,
      items: [],
      customPlaceholder: said.length === 1 ? "@username" : "@username, @username",
      customFirst: true,
      customIcon: "ap-icon-at",
      ...skip,
      onCustom: (value) => {
        const handles = value
          .split(/[\s,]+/)
          .map((h) => h.replace(/^@/, ""))
          .filter(Boolean);
        const wrong = handles.filter((h) => !HANDLE_RE.test(h));
        if (!handles.length || wrong.length) {
          postUserTurn(sessionId, value.trim());
          postAssistantMessage(
            sessionId,
            `${wrong.length ? `${joinList(wrong.map((h) => `@${escapeHtml(h)}`))} ${wrong.length === 1 ? "isn't a valid" : "aren't valid"} ${label} username${wrong.length === 1 ? "" : "s"}` : "I need a username"}: letters, numbers, periods and underscores, up to 30.`,
          );
          return askAccounts(sessionId, network, said, step, done, true);
        }
        // Matched to the names said, in order, when there are as many.
        const accounts = handles.map((h, i) =>
          typedAccount(network, h, handles.length === said.length ? said[i].name : null),
        );
        echo(accounts);
        done(accounts);
      },
    });
    return;
  }
  const matches = said.map((s) => ({ name: s.name, found: searchMentions(network, s.name) }));
  const found = matches.flatMap((m) => m.found).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i);
  // Every account the search can reach on that network, the matches first.
  const accounts = [...found, ...mentionAccounts(network).filter((a) => !found.some((f) => f.id === a.id))];
  const sure = matches.filter((m) => m.found.length === 1);
  const unsure = matches.filter((m) => m.found.length > 1);
  const lost = matches.filter((m) => !m.found.length);
  // My line above the picker says where things stand; the picker asks.
  postAssistantMessage(
    sessionId,
    [
      sure.length ? `I ticked ${names(sure)} on ${label}.` : "",
      unsure.length
        ? `${names(unsure)} ${unsure.length === 1 ? "has" : "have"} more than one account: pick the right one.`
        : "",
      lost.length ? `I couldn't find ${names(lost)} on ${label}: search for ${lost.length === 1 ? "it" : "them"}.` : "",
    ]
      .filter(Boolean)
      .join(" ") || `Search ${label} for who to mention.`,
  );
  inlineQuestion.ask(sessionId, {
    title: `Who should I mention on ${label}?`,
    subtitle: `${FINDS[network]} Tick one or more, and check a profile before you do.`,
    stepLabel: step,
    multi: true,
    // One name: the search opens on it. Several: every account shows, each
    // name's only match ticked.
    searchable: true,
    searchPlaceholder: `Search ${label}…`,
    searchQuery: said.length === 1 && found.length ? said[0].name : "",
    emptyText: `No ${label} account matches. ${FINDS[network]}`,
    defaultSelected: sure.map((m) => m.found[0].id),
    submitCountLabel: (n) => `Mention ${n}`,
    items: accounts.map((a) => {
      const avatar = mentionAvatar(a);
      return {
        value: a.id,
        label: a.name,
        caption: mentionCaption(a),
        search: `${a.name} ${a.handle || ""}`,
        avatar: {
          imageUrl: avatar.imageUrl,
          square: avatar.square,
          tint: avatar.tint,
          initials: initials(a.name),
          networkIcon: networkIcon(network),
        },
        link: { href: mentionUrl(a), label: `View on ${label}`, ariaLabel: `View ${a.name} on ${label}` },
      };
    }),
    ...skip,
    onPick: (ids) => {
      const picked = accounts.filter((a) => ids.includes(a.id));
      if (picked.length) echo(picked);
      done(picked);
    },
  });
}

// Every draft changes at once, then one sentence of mine names them: a mention
// is no rewrite, so no « what changed » card (and `revision` is cleared, as a
// hand edit does, so an earlier rewrite's marks don't claim it).
function commit(sessionId, edits, lead, where = "in") {
  postActivity(sessionId, ["modify_post"]);
  for (const { post, next } of edits)
    updatePostContent(sessionId, post.id, { text: next.text, mentions: next.mentions, revision: null });
  postAssistantMessage(
    sessionId,
    edits.length === 1
      ? `${lead} ${where} [[post:${edits[0].post.id}]].`
      : `${lead} ${where} these drafts:${edits.map((e) => `\n- [[post:${e.post.id}]]`).join("")}`,
  );
  focusInPanel("post", edits[0].post.id);
}

function apply(sessionId, drafts, resolved, said) {
  const edits = [];
  const notes = [];
  const left = [];
  const already = [];
  for (const d of drafts) {
    const post = getPosts(sessionId).find((p) => p.id === d.id);
    if (!post) continue;
    const n = normalizeNetwork(post.network);
    if (!mentionMode(n)) {
      notes.push(`${networkLabel(n)} doesn't support mentions, so [[post:${post.id}]] stays as it is.`);
      continue;
    }
    const accounts = resolved.get(n) || [];
    if (!accounts.length) {
      left.push(post);
      continue;
    }
    const next = applyMentions(post, accounts);
    if (next) edits.push({ post, next, accounts });
    else already.push(post);
  }
  const all = edits.flatMap((e) => e.accounts);
  if (already.length)
    notes.push(
      `${already.map((p) => `[[post:${p.id}]]`).join(", ")} already ${already.length === 1 ? "has" : "have"} ${said.length === 1 ? "that mention" : "those mentions"}.`,
    );
  if (left.length) notes.push(`I left ${left.map((p) => `[[post:${p.id}]]`).join(", ")} without mentions.`);
  // Prod's verify link: nothing checks a typed username, so I point at it.
  const typed = all.filter((a) => mentionMode(a.network) === "typed");
  const links = typed
    .filter((a, i) => typed.findIndex((b) => b.network === a.network && b.handle === a.handle) === i)
    .map((a) => `<a class="ap-link" href="${mentionUrl(a)}" target="_blank" rel="noopener">@${a.handle}</a>`);
  if (links.length)
    notes.push(
      `I can't look up ${joinList(uniq(typed.map((a) => networkLabel(a.network))))} usernames, so check ${joinList(links)} ${links.length === 1 ? "is the right account" : "are the right accounts"}.`,
    );
  if (edits.length) {
    // The names as they read: an account's own name, a typed username's person.
    const who = uniq(all.map((a) => (mentionMode(a.network) === "typed" ? a.entity : a.name)));
    commit(sessionId, edits, `I mentioned ${joinList(who.map(escapeHtml))}`);
  } else if (!notes.length) postAssistantMessage(sessionId, "Okay, no mention.");
  if (notes.length) postAssistantMessage(sessionId, notes.join("\n\n"));
}

// « Remove the mention of Notion (and Figma) »: back to the plain names, or
// out of my sentence.
export function unmentionInDrafts(sessionId, drafts, said = []) {
  const edits = drafts
    .map((d) => getPosts(sessionId).find((p) => p.id === d.id))
    .filter(Boolean)
    .map((post) => ({ post, next: said.length ? removeMentions(post, said) : null }))
    .filter((e) => e.next);
  if (!edits.length) {
    postAssistantMessage(
      sessionId,
      said.length
        ? `${drafts.length === 1 ? "That draft doesn't" : "None of these drafts"} mention ${names(said)}.`
        : "Which mention should I take out? Name the brand or the person.",
    );
    return;
  }
  const gone = uniq(edits.flatMap((e) => e.next.entities));
  commit(
    sessionId,
    edits,
    `I took out the mention${gone.length === 1 ? "" : "s"} of ${joinList(gone.map(escapeHtml))}`,
    "from",
  );
}

// After writing drafts: when they name someone the search knows and don't
// mention them, I offer to. ponytail: the first name found only, once per
// batch; list them all if one isn't enough.
export function offerMentions(sessionId, drafts) {
  if (!isFlagOn("draftMentions") || inlineQuestion.isActive(sessionId)) return;
  const [m] = mentionsNamedIn(drafts);
  if (!m) return;
  const n = m.drafts.length;
  postAssistantMessage(
    sessionId,
    n === 1
      ? `[[post:${m.drafts[0].id}]] names ${m.name}. Should I mention their account?`
      : `${n} of these drafts name ${m.name}. Should I mention their account?`,
  );
  const yes = `Mention ${m.name}`;
  inlineQuestion.ask(sessionId, {
    title: null,
    stepLabel: "Mention",
    items: [],
    actions: [
      { value: "no", label: "Not now", stroked: true },
      { value: "yes", label: yes, primary: true },
    ],
    onPick: (choice) => {
      postUserTurn(sessionId, choice === "yes" ? yes : "Not now");
      if (choice === "yes") mentionInDrafts(sessionId, m.drafts, [{ name: m.name }]);
      else postAssistantMessage(sessionId, "Okay, no mention.");
    },
  });
}
