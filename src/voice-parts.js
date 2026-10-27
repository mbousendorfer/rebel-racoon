// voice-parts — a Playbook's voice, in five parts.
//
// A voice is FIVE parts (VOICE_PARTS, one registry, in reading order):
//   voiceSummary    How the Brand sounds — one paragraph
//   voiceAlways     Always — rules every post follows
//   voiceNever      Never — rules no post breaks (+ the brand-wide voiceAvoid
//                   words, shown in the same block)
//   voiceByPost     Depending on the post — one case per kind of post
//   voiceSometimes  Now and then — habits that come back, not every time
// A rule is { text, examples?: string[] }; a case adds `when` (the kind of
// post). `examples` are lines from the brand's own posts.

import { escapeHtml } from "./utils.js?v=2252";
import { isFlagOn } from "./feature-flags.js?v=2252";
import { NETWORK_VOICE_ADAPTATIONS } from "./mocks.js?v=2252";
import { networkMeta, normalizeNetwork, getConnectedProfileById, profileForNetwork } from "./social-profiles.js?v=2252";

const VOICE_PARTS = [
  { field: "voiceSummary", title: "How the Brand sounds", kind: "text" },
  { field: "voiceAlways", title: "Always", kind: "rules" },
  { field: "voiceNever", title: "Never", kind: "rules" },
  { field: "voiceByPost", title: "Depending on the post", kind: "cases" },
  { field: "voiceSometimes", title: "Now and then", kind: "rules" },
];

export function voiceParts() {
  return VOICE_PARTS;
}

const partOf = (field) => VOICE_PARTS.find((p) => p.field === field);
export const isListPart = (field) => !!partOf(field) && partOf(field).kind !== "text";

// A list of rules / cases, deep-copied; a bare string (an older payload) is a
// rule. Blank items are dropped.
export function cloneItems(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => (typeof i === "string" ? { text: i } : i && typeof i === "object" ? structuredClone(i) : null))
    .filter((i) => i && String(i.text || i.when || "").trim());
}

// A part's items, read: the rule in ink, a case's kind of post above it in
// bold, the examples under it as quotes (playbook-v2.css .voice-rule).
// `tag`: trusted html shown on a rule the network made its own (`adapted`).
export function voiceItemsHtml(items, { tag = "" } = {}) {
  const esc = escapeHtml;
  return `<ul class="voice-rules">${cloneItems(items)
    .map(
      (i) => `<li class="voice-rule">
        <div class="voice-rule__body">
          ${i.adapted && tag ? tag : ""}
          ${i.when ? `<p class="voice-rule__when">${esc(i.when)}</p>` : ""}
          <p class="voice-rule__text">${esc(i.text)}</p>
          ${
            i.examples?.length
              ? `<ul class="voice-rule__examples" aria-label="Examples">${i.examples
                  .map((x) => `<li><i class="ap-icon-quote" aria-hidden="true"></i><span>${esc(x)}</span></li>`)
                  .join("")}</ul>`
              : ""
          }
        </div>
      </li>`,
    )
    .join("")}</ul>`;
}

// A part of the voice. The summary falls back on what the analysis heard
// (voiceProfile.writingStyle) for a Playbook saved before it had its own.
export function baseValue(ctx, field) {
  if (field === "voiceSummary") return ctx?.voiceSummary || ctx?.voiceProfile?.writingStyle || "";
  return Array.isArray(ctx?.[field]) ? ctx[field] : [];
}

// ── A voice per network (flag voicePerNetwork) ──────────────────────────────
// The flat parts above are the default voice. `ctx.voiceByNetwork[network]` is a
// whole voice for one network the Playbook publishes on — the same five parts,
// plus:
//   optimizedBy  "learned" (learnNetworkVoice — Archie learned it from the
//                account's posts or from a document: learnedFrom, + postCount
//                for posts) | "you" (edited by hand, at least one change) |
//                "brand" (the default voice as it is: a voice is DEFINED, not
//                optimized — allowed, warned)
// Optimizing is never a click: a network's voice is optimized only once it was
// learned (posts, documents) or edited. The default voice changing never touches
// a network's own voice.
// A rule Archie (or the user) made for this network carries `adapted: true` and
// reads « For LinkedIn »; a rule without it comes from the default voice.

export const networkVoiceOn = () => isFlagOn("voicePerNetwork");

// The networks a Playbook publishes on, once each, in its own order.
// `connectedSocials` holds network slugs — or, in the demo, account ids.
export function playbookNetworks(ctx) {
  const nets = (ctx?.connectedSocials || []).map((s) =>
    networkMeta(s) ? normalizeNetwork(s) : normalizeNetwork(getConnectedProfileById(s)?.platform),
  );
  return [...new Set(nets.filter((n) => networkMeta(n)))];
}

const LIST_PARTS = VOICE_PARTS.filter((p) => p.kind !== "text").map((p) => p.field);

// Below this many posts an account has nothing to learn from.
const LEARN_MIN_POSTS = 10;

export const canLearnFrom = (account) => (account?.postCount || 0) >= LEARN_MIN_POSTS;

// The network's voice, learned — from an account's posts ({ from: handle,
// postCount }) or a document ({ from: its name }). ponytail: the mock lays the
// network's adaptations (mocks/voice-networks.js) over the default voice, each
// added rule marked `adapted`; in the product they're read from the source.
export function learnNetworkVoice(ctx, network, { from, postCount = 0 }) {
  const a = NETWORK_VOICE_ADAPTATIONS[network] || {};
  const voice = { voiceSummary: [baseValue(ctx, "voiceSummary"), a.summary].filter(Boolean).join(" ") };
  LIST_PARTS.forEach((f) => {
    voice[f] = [...cloneItems(ctx?.[f]), ...(a.add?.[f] || []).map((r) => ({ ...r, adapted: true }))];
  });
  return { ...voice, optimizedBy: "learned", learnedFrom: from, postCount };
}

// The network's voice, learned from the user's own answers in the chat (the
// Voice step's interview, network-voice-flow.js): the default voice, with what
// they said as the network's own rules. `answers`: { length, layout, tags,
// never, example } — any may be empty. ponytail: their words go in as written;
// in the product a model turns them into rules.
export function interviewNetworkVoice(ctx, network, answers) {
  const sentence = (s) => (s && !/[.!?…]$/.test(s) ? `${s}.` : s);
  const rule = (prefix, text, extra = {}) =>
    text ? [{ text: sentence(prefix ? `${prefix}: ${text}` : text), adapted: true, ...extra }] : [];
  const voice = brandVoiceAsIs(ctx);
  const example = answers.example ? { examples: [answers.example] } : {};
  voice.voiceAlways = [
    ...voice.voiceAlways,
    ...rule("Length", answers.length, example),
    ...rule("Layout", answers.layout, answers.length ? {} : example),
  ];
  voice.voiceSometimes = [...voice.voiceSometimes, ...rule("Hashtags and mentions", answers.tags)];
  voice.voiceNever = [...voice.voiceNever, ...rule("", answers.never)];
  return { ...voice, optimizedBy: "learned", learnedFrom: "your answers" };
}

// What Archie gives a network on its own (creation): its voice learned from the
// account's posts when it has enough, else the default voice as it is — warned.
function bestNetworkVoice(ctx, network) {
  const account = profileForNetwork(network);
  return canLearnFrom(account)
    ? learnNetworkVoice(ctx, network, { from: account.handle, postCount: account.postCount })
    : brandVoiceAsIs(ctx);
}

// Every network of the Playbook with a voice — the best one where it has none
// yet, its own kept. Creation and its review read it this way.
export function withNetworkVoices(ctx) {
  return {
    ...Object.fromEntries(playbookNetworks(ctx).map((n) => [n, bestNetworkVoice(ctx, n)])),
    ...(ctx?.voiceByNetwork || {}),
  };
}

// The default voice copied as it is: a defined voice, not optimized. Edit starts
// from it; saving with a change makes it the user's ("you").
export function brandVoiceAsIs(ctx) {
  const voice = { voiceSummary: baseValue(ctx, "voiceSummary") };
  LIST_PARTS.forEach((f) => (voice[f] = cloneItems(ctx?.[f])));
  return { ...voice, optimizedBy: "brand" };
}

const OPTIMIZED_BY = ["learned", "you", "brand"];

export function cloneNetworkVoice(v) {
  const out = {
    voiceSummary: String(v?.voiceSummary || ""),
    optimizedBy: OPTIMIZED_BY.includes(v?.optimizedBy) ? v.optimizedBy : "brand",
  };
  LIST_PARTS.forEach((f) => (out[f] = cloneItems(v?.[f])));
  if (v?.learnedFrom) Object.assign(out, { learnedFrom: String(v.learnedFrom), postCount: Number(v.postCount) || 0 });
  if (v?.changedAt) out.changedAt = Number(v.changedAt) || 0;
  return out;
}

// Which voice a network writes in, and in what state:
//   "brand"    the flag is off, or no network named
//   "default"  the network writes in the Playbook's default voice — never
//              given one (`chosen` false: the next draft for it asks first,
//              network-voice-flow.js), or « Use the default voice » picked
//              (`chosen` true). One state for the user, warned the same way.
//   "own"      its own voice: learned, or edited
// `network` as a draft names it ("twitter") or as a voice is keyed ("x").
export function networkVoice(ctx, network) {
  const own = networkVoiceOn() && network ? ctx?.voiceByNetwork?.[normalizeNetwork(network)] : null;
  if (!networkVoiceOn() || !network) return { state: "brand", voice: ctx };
  if (!own || own.optimizedBy === "brand") return { state: "default", chosen: !!own, voice: ctx };
  return { state: "own", voice: own };
}

// When the voice a network writes in last changed (ms, 0 = never at runtime):
// its own voice's, else the default voice's. A draft written before it says
// so (post-card's voice status, « Rewrite it »).
export function voiceChangedAt(ctx, network) {
  const { state, voice } = networkVoice(ctx, network);
  return (state === "own" ? voice.changedAt : ctx?.voiceChangedAt) || 0;
}

// A draft's rule, from the user's feedback on a draft (feedback-control): the
// network's voice — its own, else the default voice — with one rule more, its
// own. ponytail: the comment (or the reason) goes in as written; in the product
// a model turns feedback into the change.
const FEEDBACK_RULES = {
  "wrong-tone": { field: "voiceAlways", text: "Keep the tone of the posts that work best here." },
  "too-generic": { field: "voiceAlways", text: "Name one concrete detail — a number, a customer, a place." },
  formatting: { field: "voiceAlways", text: "Keep the layout of the posts that work best here." },
};
// Returns { voice, added: [rule texts] }, or null when the feedback says
// nothing about the voice (Off-topic, Inaccurate…).
export function feedbackNetworkVoice(ctx, network, { reasons = [], comment = "" }) {
  const { state, voice } = networkVoice(ctx, network);
  if (state === "brand") return null;
  const base = state === "own" ? cloneNetworkVoice(voice) : brandVoiceAsIs(ctx);
  const rules = comment.trim()
    ? [{ field: "voiceAlways", text: comment.trim() }]
    : reasons.map((r) => FEEDBACK_RULES[r]).filter(Boolean);
  const added = rules.map(({ field, text }) => {
    const rule = /[.!?…]$/.test(text) ? text : `${text}.`;
    base[field] = [...base[field], { text: rule, adapted: true }];
    return rule;
  });
  if (state !== "own") Object.assign(base, { optimizedBy: "learned", learnedFrom: "your feedback" });
  return added.length ? { voice: base, added } : null;
}

// After an edit of a network's voice: a rule that isn't, word for word, one of
// the default voice's (in the same part) is the network's own. Returns whether the
// voice now differs from the default voice at all — an edit that changed nothing
// leaves it the default voice as it is.
export function markAdapted(ctx, voice) {
  const key = (r) => `${r.when || ""}\u0000${r.text}`;
  let changed = baseValue(voice, "voiceSummary") !== baseValue(ctx, "voiceSummary");
  LIST_PARTS.forEach((f) => {
    const brand = cloneItems(ctx?.[f]);
    const base = new Set(brand.map(key));
    voice[f] = cloneItems(voice[f]).map((r) => (r.adapted || !base.has(key(r)) ? { ...r, adapted: true } : r));
    if (voice[f].length !== brand.length || voice[f].some((r) => r.adapted)) changed = true;
  });
  return changed;
}
