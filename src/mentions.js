// Mentions in a draft (flag draftMentions). A mention is plain text in the
// draft — `@Notion` on LinkedIn / Facebook (the name, linked once published),
// `@NotionHQ` on X, Instagram, TikTok (the handle) — plus an entry in
// `post.mentions` keyed by that text, saying which account it points at. The
// card styles the keys it finds in the text; one rubbed out by hand simply
// stops showing. Undo and the word diff work on the text, as for any rewrite.
//
// What each network allows is prod's (Publishing's mention search): LinkedIn,
// Facebook and X are searched; Instagram and TikTok take a typed handle;
// YouTube has no mentions.

import { MENTION_DIRECTORY } from "./mocks.js?v=2758";
import { fold } from "./utils.js?v=2758";
import { normalizeNetwork } from "./social-profiles.js?v=2758";

const SEARCH = new Set(["linkedin", "facebook", "x"]);
const TYPED = new Set(["instagram", "tiktok"]);

/** "search", "typed" (the handle, no search), or null (no mentions). */
export function mentionMode(network) {
  const n = normalizeNetwork(network);
  return SEARCH.has(n) ? "search" : TYPED.has(n) ? "typed" : null;
}

// Prod's Instagram username check (wysiwyg-mention); TikTok gets the same.
export const HANDLE_RE = /^(?!.*\.\.)(?!.*\.$)(?!.*\.\d)[a-zA-Z0-9_.]{1,30}$/;

// Every account the search can return on a network:
// { id, entity, network, name, handle?, kind?, caption? }.
export function mentionAccounts(network) {
  const n = normalizeNetwork(network);
  return MENTION_DIRECTORY.filter((e) => e.accounts[n]).map((e) => ({
    id: `${e.id}:${n}`,
    entity: e.name,
    network: n,
    // A person or a company everywhere, as LinkedIn says (X and Facebook don't).
    kind: e.accounts.linkedin?.kind,
    photo: e.photo || null,
    tint: e.tint || null,
    ...e.accounts[n],
  }));
}

// Prod searches from 2 characters, on the name and the handle.
export function searchMentions(network, query) {
  const q = fold(
    String(query || "")
      .trim()
      .replace(/^@/, ""),
  );
  if (q.length < 2) return [];
  return mentionAccounts(network).filter((a) => fold(`${a.name} ${a.handle || ""}`).includes(q));
}

/** The name behind a handle the search knows (« NotionHQ » → « Notion »), or null. */
export function nameForHandle(handle) {
  const h = fold(handle);
  return MENTION_DIRECTORY.find((e) => Object.values(e.accounts).some((a) => fold(a.handle) === h))?.name || null;
}

/** A handle typed for Instagram / TikTok, as an account. */
export function typedAccount(network, handle, entity) {
  const h = handle.replace(/^@/, "");
  return {
    id: `${normalizeNetwork(network)}:${h}`,
    entity: entity || h,
    network: normalizeNetwork(network),
    name: h,
    handle: h,
  };
}

/** The text the mention takes in the draft. */
export function mentionText(account) {
  return account.network === "linkedin" || account.network === "facebook" ? `@${account.name}` : `@${account.handle}`;
}

// What the picker and the echo show for an account: a person's face; a
// company's square logo, its initial on its own colour (the DS avatar draws
// the initial, in Averta); a typed username, grey initials.
export function mentionAvatar(account) {
  if (account.photo) return { imageUrl: account.photo, square: false, tint: null };
  return { imageUrl: null, square: !!account.tint, tint: account.tint || null };
}

const slug = (name) =>
  fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Where the account lives on its network, to check it before mentioning it. */
export function mentionUrl(account) {
  switch (account.network) {
    case "linkedin":
      return `https://www.linkedin.com/${account.kind === "person" ? "in" : "company"}/${slug(account.name)}`;
    case "facebook":
      return `https://www.facebook.com/${slug(account.name)}`;
    case "x":
      return `https://x.com/${account.handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${account.handle}`;
    default:
      return `https://www.instagram.com/${account.handle}/`;
  }
}

/** The line under an account in a picker. */
export function mentionCaption(account) {
  if (account.network === "linkedin")
    return account.kind === "person" ? `${account.caption} · Follows your Page` : `Company · ${account.caption}`;
  if (account.network === "facebook") return "Page";
  return `@${account.handle}`;
}

// The asks. « tag » alone is a mention; « remove the mention » takes one out.
export const MENTION_ASK = /\b(mention|tag)\b/i;
// « remove @Notion from the draft » too: an @ names a mention, not a draft.
export const UNMENTION_ASK = /\b(remove|delete|drop|take out)\b.*(\b(mention|tag)\b|(^|\s)@\w)|\buntag\b/i;
const NOT_A_NAME = /^(it|them|this|that|these|someone|somebody|people|accounts?)$/i;

// Who the sentence names, as [{ name, handle? }]: its @handles, else the words
// after « mention / tag (of) » up to « in / on / to / from », split on commas
// and « and » (« Notion, Figma and Jordan Lee »). [] when it names nobody.
export function mentionNamesIn(text) {
  const handles = [...text.matchAll(/(?:^|\s)@([\w.]+)/g)].map((m) => ({ name: m[1], handle: m[1] }));
  if (handles.length) return handles;
  const list = text.match(/\b(?:mention|tag)s?\s+(?:of\s+)?(.+?)(?:\s+(?:in|on|to|from|into|for)\b|[.!?]|$)/i)?.[1];
  return (list || "")
    .split(/\s*,\s*(?:and\s+)?|\s+(?:and|&)\s+/)
    .map((n) => n.replace(/^(?:the|a|an)\s+/i, "").trim())
    .filter((n) => n && !NOT_A_NAME.test(n))
    .map((name) => ({ name }));
}

/** « A », « A and B », « A, B and C ». */
export function joinList(items) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The name as a word, not already behind an @.
const nameRe = (name) => new RegExp(`(^|[^@\\w])(${escapeRe(name)})(?!\\w)`, "i");

// The sentence I write to bring in the mentions a draft doesn't name, all in
// one. ponytail: a line per kind; the product would have the model place them.
function mentionSentence(accounts, keys) {
  const list = joinList(keys);
  if (accounts.every((a) => a.kind === "person")) return `Thanks to ${list} for sharing this.`;
  if (accounts.length === 1 && (accounts[0].kind === "company" || accounts[0].network === "facebook"))
    return `Shout-out to the team at ${list}.`;
  return `Shout-out to ${list}.`;
}

// The draft with the mentions in: where the text already names one, the name
// becomes the mention; the others come in together, in one sentence of mine at
// the end. null when they're all already there.
export function applyMentions(post, accounts) {
  const text = [...(post.text || [])];
  const mentions = { ...(post.mentions || {}) };
  const missing = [];
  let changed = false;
  for (const account of accounts) {
    const key = mentionText(account);
    if (text.some((p) => p.includes(key))) continue;
    const re = nameRe(account.entity);
    const i = text.findIndex((p) => re.test(p));
    if (i < 0) {
      missing.push([key, account]);
      continue;
    }
    text[i] = text[i].replace(re, (_, lead) => `${lead}${key}`);
    mentions[key] = { ...account, added: null };
    changed = true;
  }
  if (missing.length) {
    const added = mentionSentence(
      missing.map(([, a]) => a),
      missing.map(([k]) => k),
    );
    if (text.length) text[text.length - 1] = `${text[text.length - 1]} ${added}`;
    else text.push(added);
    // `added`: my sentence, shared by the mentions it brought in.
    for (const [key, account] of missing) mentions[key] = { ...account, added };
    changed = true;
  }
  return changed ? { text, mentions } : null;
}

export const applyMention = (post, account) => applyMentions(post, [account]);

// The draft without a mention: back to the plain name ("@NotionHQ" → "Notion")
// where the text named it; brought in by my sentence, out of it (the sentence
// rewritten for the others, or gone with the last one). `query` is what was
// said ("Notion", "@NotionHQ"); null when the draft has none.
export function removeMention(post, query) {
  const q = fold(String(query || "").replace(/^@/, ""));
  const key = Object.keys(post.mentions || {}).find((k) => {
    const a = post.mentions[k];
    return post.text.some((p) => p.includes(k)) && fold(`${a.entity} ${a.name} ${a.handle || ""}`).includes(q);
  });
  if (!key) return null;
  const { [key]: gone, ...mentions } = post.mentions;
  if (!gone.added) return { text: post.text.map((p) => p.split(key).join(gone.entity)), mentions, entity: gone.entity };
  const rest = Object.entries(mentions).filter(([, a]) => a.added === gone.added);
  const next = rest.length
    ? mentionSentence(
        rest.map(([, a]) => a),
        rest.map(([k]) => k),
      )
    : null;
  for (const [k, a] of rest) mentions[k] = { ...a, added: next };
  const text = post.text
    .map((p) => (next ? p.split(gone.added).join(next) : p.split(` ${gone.added}`).join("").split(gone.added).join("")))
    .filter((p, i) => p || post.text[i] !== gone.added);
  return { text, mentions, entity: gone.entity };
}

// Several at once: [{ name, handle? }] taken out one after the other. null
// when the draft has none of them; `entities` = the ones it had.
export function removeMentions(post, said) {
  let cur = post;
  const entities = [];
  for (const s of said) {
    const r = removeMention(cur, s.handle || s.name);
    if (!r) continue;
    cur = { ...cur, text: r.text, mentions: r.mentions };
    entities.push(r.entity);
  }
  return entities.length ? { text: cur.text, mentions: cur.mentions, entities } : null;
}

// Names from the directory a batch of drafts writes without mentioning them,
// with the drafts that do: [{ name, drafts }], first named first.
export function mentionsNamedIn(drafts) {
  const names = [...new Set(MENTION_DIRECTORY.map((e) => e.name))];
  return names
    .map((name) => ({
      name,
      drafts: drafts.filter(
        (d) =>
          mentionMode(d.network) &&
          (d.text || []).some((p) => nameRe(name).test(p)) &&
          !Object.values(d.mentions || {}).some((a) => a.entity === name),
      ),
    }))
    .filter((m) => m.drafts.length);
}
