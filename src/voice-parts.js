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

import { escapeHtml } from "./utils.js?v=2447";
import { isFlagOn } from "./feature-flags.js?v=2447";
import { NETWORK_VOICE_ADAPTATIONS } from "./mocks.js?v=2447";
import {
  networkMeta,
  networkLabel,
  networkIcon,
  normalizeNetwork,
  getConnectedProfileById,
  profileForNetwork,
} from "./social-profiles.js?v=2447";

// `hint`: what the part holds, said under its title — on the Playbook's tab
// and in a voice proposal (one source for both).
const VOICE_PARTS = [
  { field: "voiceSummary", title: "How the Brand sounds", kind: "text", hint: "The overall tone, in a few sentences." },
  { field: "voiceAlways", title: "Always", kind: "rules", hint: "Rules every post follows." },
  { field: "voiceNever", title: "Never", kind: "rules", hint: "What no post ever does, and the words I never use." },
  {
    field: "voiceByPost",
    title: "Depending on the post",
    kind: "cases",
    hint: "How each kind of post is written: a launch, a hiring post, a recap.",
  },
  { field: "voiceSometimes", title: "Now and then", kind: "rules", hint: "Habits I use sometimes, not in every post." },
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

// What marks a rule (or the summary) as a network's own — « For LinkedIn ».
// Shared by the Playbook's network tabs and the voice proposal.
export function voiceNetTagHtml(net) {
  return `<span class="ap-tag grey mini pb2-voice-tag"><i class="${networkIcon(net)}" aria-hidden="true"></i><span>For ${escapeHtml(networkLabel(net))}</span></span>`;
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

// A network's own voice with something in it — empty, it still has to be filled.
export function voiceHasRules(voice) {
  return (
    Boolean(String(voice?.voiceSummary || "").trim()) ||
    ["voiceAlways", "voiceNever", "voiceByPost", "voiceSometimes"].some((f) => (voice?.[f] || []).length)
  );
}

// The networks of a Playbook whose voice is unfinished: never answered (no
// voice of its own, the default voice not kept by choice) or its own and still
// empty. The new chat's « Finish your voices » starter lists them.
export function voicesToFinish(ctx) {
  if (!networkVoiceOn() || !ctx) return [];
  return playbookNetworks(ctx).filter((n) => {
    const { state, chosen, voice } = networkVoice(ctx, n);
    return state === "default" ? !chosen : state === "own" && !voiceHasRules(voice);
  });
}

// The default voice is the Playbook's own five parts: generic, tied to no
// network. Each network the Playbook publishes on is a variation of it — the
// same voice, plus rules of its own (« For LinkedIn »).
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

// The default voice adapted to a network, with nothing to read: what works on
// the network (its length, layout, hashtags) laid over the default voice.
// ponytail: the same mock adaptations as learning; in the product a model
// writes them from the default voice and the network's conventions.
export const ADAPTED_FROM = "your default voice";
export const adaptNetworkVoice = (ctx, network) => learnNetworkVoice(ctx, network, { from: ADAPTED_FROM });

// The network's voice, learned from the user's own answers (the Voice step's
// interview, network-voice-flow.js INTERVIEW): ONE question per part of the
// Voice profile, so each answer lands in its part — the summary sentence goes
// after the default voice's, every other answer is the part's new rule for
// the network. `answers`: { [field]: text } — any may be missing. ponytail:
// their words go in as written; in the product a model turns them into rules.
export function interviewNetworkVoice(ctx, network, answers) {
  // A rule reads as a sentence: capital first, full stop last.
  const sentence = (s) => {
    if (!s) return s;
    const t = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?…]$/.test(t) ? t : `${t}.`;
  };
  const voice = brandVoiceAsIs(ctx);
  VOICE_PARTS.forEach(({ field, kind }) => {
    const said = sentence((answers?.[field] || "").trim());
    if (!said) return;
    if (kind === "text") voice[field] = [voice[field], said].filter(Boolean).join(" ");
    else voice[field] = [...voice[field], { text: said, adapted: true }];
  });
  return { ...voice, optimizedBy: "learned", learnedFrom: "your answers" };
}

// What Archie gives a network on its own (creation): its voice learned from the
// account's posts when it has enough. Else nothing: the network writes in the
// default voice, never chosen, so its first draft asks (network-voice-flow.js).
function bestNetworkVoice(ctx, network) {
  const account = profileForNetwork(network);
  return canLearnFrom(account)
    ? learnNetworkVoice(ctx, network, { from: account.handle, postCount: account.postCount })
    : null;
}

// Every network of the Playbook that can have a voice — learned where it has
// none yet, its own kept. Creation and its review read it this way.
export function withNetworkVoices(ctx) {
  return {
    ...Object.fromEntries(
      playbookNetworks(ctx)
        .map((n) => [n, bestNetworkVoice(ctx, n)])
        .filter(([, v]) => v),
    ),
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
//   "default"  the network writes in the default voice — never given one (`chosen` false: the next draft for it asks first,
//              network-voice-flow.js), or « Use the default voice » picked
//              (`chosen` true). One state for the user, warned the same way.
//   "own"      its own voice: learned, adapted, or edited
// `network` as a draft names it ("twitter") or as a voice is keyed ("x").
export function networkVoice(ctx, network) {
  if (!networkVoiceOn() || !network) return { state: "brand", voice: ctx };
  const own = ctx?.voiceByNetwork?.[normalizeNetwork(network)];
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
  "too-generic": { field: "voiceAlways", text: "Name one concrete detail: a number, a customer, or a place." },
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
