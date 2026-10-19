// network-voice — a Playbook's voice, and its version per network.
//
// A voice is FIVE parts (VOICE_PARTS, one registry, in reading order):
//   voiceSummary    How the brand sounds — one paragraph
//   voiceAlways     Always — rules every post follows
//   voiceNever      Never — rules no post breaks (+ the brand-wide voiceAvoid
//                   words, shown in the same block, never per network)
//   voiceByPost     Depending on the post — one case per kind of post
//   voiceSometimes  Now and then — habits that come back, not every time
// A rule is { text, examples?: string[], learned?: true }; a case adds `when`
// (the kind of post). `examples` are lines from the brand's own posts;
// `learned` marks a rule Archie proposed and someone kept (Remember).
//
// The base fields live on the Playbook; the network versions, with the flag
// networkVoices, live in:
//   voiceBaseNetwork  "linkedin" — where the base voice was learned from (the
//                     network picked at creation; the others get an
//                     adaptation drafted then, see analyzeNetworkVoices).
//   voiceByNetwork    { [network]: { [part]?, drafted?: true } } — drafted:
//                     written by Archie (at creation, Learn from, Optimize)
//                     and untouched since
// A network entry holds ONLY what differs from the base: an absent part
// inherits the base's. Nothing here writes — the suggestions live in
// voice-coach-store.js, outside the Playbook, and only an explicit Remember
// moves one in (into Always or Never, learned: true).
//
// ponytail: the parts are language-agnostic — with multilingualPlaybook ON the
// examples are in one language. Per-language examples when a brand actually
// publishes in two languages on one network.

import { isFlagOn } from "./feature-flags.js?v=1995";
import { escapeHtml } from "./utils.js?v=1995";
import { NETWORKS, normalizeNetwork, getConnectedProfileById } from "./social-profiles.js?v=1995";

// `newWith` marks a part the product just added, behind that flag — the demo
// (voiceNewSection) of how a voice says a part is new: an orange arc, a "New"
// pill, on every network (and the base) that hasn't written it yet.
export const VOICE_PARTS = [
  { field: "voiceSummary", title: "How the brand sounds", kind: "text" },
  { field: "voiceAlways", title: "Always", kind: "rules" },
  { field: "voiceNever", title: "Never", kind: "rules" },
  { field: "voiceByPost", title: "Depending on the post", kind: "cases", newWith: "voiceNewSection" },
  { field: "voiceSometimes", title: "Now and then", kind: "rules" },
];

const ALL_NETWORK_FIELDS = VOICE_PARTS.map((p) => p.field);

export function voiceParts() {
  return VOICE_PARTS;
}

export function networkFields() {
  return ALL_NETWORK_FIELDS;
}

const partOf = (field) => VOICE_PARTS.find((p) => p.field === field);
export const isListPart = (field) => !!partOf(field) && partOf(field).kind !== "text";
export const isNewPart = (field) => !!partOf(field)?.newWith && isFlagOn(partOf(field).newWith);

// The parts a Remember can write into: a kept rule is something always done or
// never done; a kept habit (the coaching question's closing) comes now and then.
const RULE_FIELDS = ["voiceAlways", "voiceNever", "voiceSometimes"];
export const suggestionField = (s) => (RULE_FIELDS.includes(s?.field) ? s.field : "voiceAlways");

export function networkVoicesOn() {
  return isFlagOn("networkVoices");
}

const known = (n) => (NETWORKS[normalizeNetwork(n)] ? normalizeNetwork(n) : "");

export function networkLabel(n) {
  return NETWORKS[normalizeNetwork(n)]?.label || n;
}

export function networkIcon(n) {
  return NETWORKS[normalizeNetwork(n)]?.icon || "ap-icon-web";
}

// ── Items: a rule or a case ──────────────────────────────────────────────────

// A list of rules / cases, deep-copied; a bare string (an older payload) is a
// rule. Blank items are dropped.
export function cloneItems(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => (typeof i === "string" ? { text: i } : i && typeof i === "object" ? structuredClone(i) : null))
    .filter((i) => i && String(i.text || i.when || "").trim());
}

// An item as one line of text — how the Optimize wizard lists it (a case
// reads "When: rule", the way the brand guidelines write it).
export function itemLine(field, item) {
  return partOf(field)?.kind === "cases" && item.when ? `${item.when}: ${item.text}` : item.text;
}

const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Lines back into items: one already in `previous` keeps its examples and its
// learned mark; a new one is parsed (a case splits on its first colon).
export function itemsFromLines(field, lines, previous = []) {
  const prev = new Map(previous.map((i) => [itemLine(field, i), i]));
  return lines
    .map((l) => String(l || "").trim())
    .filter(Boolean)
    .map((line) => {
      if (prev.has(line)) return structuredClone(prev.get(line));
      const at = line.indexOf(":");
      return partOf(field)?.kind === "cases" && at > 0
        ? { when: line.slice(0, at).trim(), text: capitalize(line.slice(at + 1).trim()) }
        : { text: line };
    });
}

// A part's items, read — the Voice tab and the Optimize review share it.
// The rule in ink, a case's kind of post above it in bold, the examples under
// it as quotes; a learned rule wears Archie's olive mark (voice-coach.css).
export function voiceItemsHtml(items) {
  const esc = escapeHtml;
  const list = cloneItems(items);
  return `<ul class="nv-rules">${list
    .map(
      (i) => `<li class="nv-rule">
        ${i.learned ? `<i class="ap-icon-sparkles memory-mark" aria-hidden="true" title="Learned from your drafts"></i>` : ""}
        <div class="nv-rule__body">
          ${i.when ? `<p class="nv-rule__when">${esc(i.when)}</p>` : ""}
          <p class="nv-rule__text">${esc(i.text)}</p>
          ${
            i.examples?.length
              ? `<ul class="nv-rule__examples" aria-label="Examples">${i.examples
                  .map((x) => `<li><i class="ap-icon-quote" aria-hidden="true"></i><span>${esc(x)}</span></li>`)
                  .join("")}</ul>`
              : ""
          }
        </div>
      </li>`,
    )
    .join("")}</ul>`;
}

// ── The base, and each network ───────────────────────────────────────────────

// The network the base voice was learned from. Stored at creation; a legacy
// Playbook falls back on its publishing profile, then on LinkedIn.
export function baseNetwork(ctx) {
  return (
    known(ctx?.voiceBaseNetwork) ||
    known(getConnectedProfileById(ctx?.selectedProfileId)?.platform) ||
    known(ctx?.connectedSocials?.[0]) ||
    "linkedin"
  );
}

// Every network has a voice from the start — the base's, until it's optimized.
// Order: the base, the ones it publishes on, the rest. Optimizing never moves
// a network: a tab must not jump under the cursor.
export function voiceNetworks(ctx) {
  const list = [baseNetwork(ctx), ...(ctx?.connectedSocials || []), ...Object.keys(NETWORKS)].map(known);
  return [...new Set(list.filter(Boolean))];
}

// Optimized = at least one part adapted to the network.
export function isOptimized(ctx, n) {
  const e = networkEntry(ctx, n);
  return !!e && networkFields().some((f) => e[f] !== undefined);
}

export function networkEntry(ctx, n) {
  return ctx?.voiceByNetwork?.[normalizeNetwork(n)] || null;
}

export function isOverridden(ctx, n, field) {
  const e = networkEntry(ctx, n);
  return !!e && e[field] !== undefined;
}

// A part of the base voice. The summary falls back on what the analysis heard
// (voiceProfile.writingStyle) for a Playbook saved before it had its own.
export function baseValue(ctx, field) {
  if (field === "voiceSummary") return ctx?.voiceSummary || ctx?.voiceProfile?.writingStyle || "";
  return Array.isArray(ctx?.[field]) ? ctx[field] : [];
}

// What a network reads as: its own version where it adapted the part, else
// the base's.
export function partValue(ctx, n, field) {
  const e = normalizeNetwork(n) === baseNetwork(ctx) ? null : networkEntry(ctx, n);
  return e?.[field] !== undefined ? e[field] : baseValue(ctx, field);
}

// What Archie learned on a network and someone kept (Remember): the rules
// marked learned in its own parts — on the base, in the Playbook's. Each with
// the part it sits in, for "What I've learned".
export function learnedItems(ctx, n) {
  const own = normalizeNetwork(n) === baseNetwork(ctx) ? ctx : networkEntry(ctx, n) || {};
  return RULE_FIELDS.flatMap((field) =>
    cloneItems(own[field])
      .filter((i) => i.learned)
      .map((item) => ({ field, title: partOf(field).title, item })),
  );
}

// The Playbook patch a list edit produces on one network's part: the base
// writes its own field; another network writes its own version, seeded from
// the base's so a kept rule never drops what the network already inherited.
function patchPart(ctx, network, field, fn) {
  const net = normalizeNetwork(network);
  if (net === baseNetwork(ctx)) return { [field]: fn(cloneItems(ctx[field])) };
  const all = cloneVoiceByNetwork(ctx.voiceByNetwork);
  const e = all[net] || {};
  delete e.drafted; // a Remember is use
  e[field] = fn(e[field] !== undefined ? e[field] : cloneItems(baseValue(ctx, field)));
  all[net] = e;
  return { voiceByNetwork: all };
}

// The patch a suggestion produces once accepted: the rule joins the part it
// was proposed for (Always by default), marked learned.
export function withSuggestion(ctx, s) {
  return patchPart(ctx, s.network, suggestionField(s), (list) =>
    list.some((i) => i.text === s.text) ? list : [...list, { text: s.text, learned: true }],
  );
}

// The reverse of withSuggestion — what an Undo writes back.
export function withoutSuggestion(ctx, s) {
  return patchPart(ctx, s.network, suggestionField(s), (list) => list.filter((i) => i.text !== s.text));
}

// What Archie wants to remember, as one card (styles/components/voice-coach.css):
// the butter block holds the rule and why; the white row under it holds the
// question and, once answered, its answer — same place, same height.
// `attr` names the host's delegation attributes (data-<attr>-accept / -dismiss / -undo).
// The chat host adds what only it knows: `evidence` (trusted html — the drafts
// the rule came from, as chat refs) and `rewrite` (how many of this chat's drafts
// a kept rule can still rewrite).
export function memoryCardHtml(s, { attr, value, undo = true, evidence = "", rewrite = 0 }) {
  const esc = escapeHtml;
  const net = `<i class="${esc(networkIcon(s.network))}" aria-hidden="true"></i> ${esc(networkLabel(s.network))}`;
  const kept = s.status === "accepted";
  const answer = kept
    ? `<div class="memory-card__answer" role="status">
        <span class="memory-card__ask"><i class="${isFlagOn("newConversationStyles") ? "ap-icon-rounded-check_fill" : "ap-icon-check"} memory-card__done" aria-hidden="true"></i>Remembered for your ${net} voice</span>
        <div class="memory-card__actions">${undo ? `<a class="ap-link standalone small" href="#" role="button" data-${attr}-undo="${esc(value)}">Undo</a>` : ""}</div>
      </div>${
        rewrite
          ? `<div class="memory-card__answer">
        <span class="memory-card__ask">${rewrite} ${esc(networkLabel(s.network))} ${rewrite === 1 ? "draft here doesn't" : "drafts here don't"} follow it yet.</span>
        <div class="memory-card__actions">
          <button type="button" class="ap-button stroked blue" data-${attr}-rewrite="${esc(value)}">Rewrite ${rewrite === 1 ? "it" : "them"}</button>
        </div>
      </div>`
          : ""
      }`
    : `<div class="memory-card__answer">
        <span class="memory-card__ask">Remember this for your ${net} voice?</span>
        <div class="memory-card__actions">
          <button type="button" class="ap-button ghost grey" data-${attr}-dismiss="${esc(value)}">Not now</button>
          <button type="button" class="ap-button primary blue" data-${attr}-accept="${esc(value)}">Remember</button>
        </div>
      </div>`;
  return `<div class="memory-card" role="group" aria-label="Remember this for your ${esc(networkLabel(s.network))} voice?">
    <div class="memory-card__body">
      <i class="ap-icon-sparkles memory-mark" aria-hidden="true"></i>
      <p class="memory-card__rule">${esc(s.text)}</p>
      ${s.why ? `<p class="memory-card__why">${esc(s.why)}</p>` : ""}
      ${evidence ? `<p class="memory-card__why memory-card__evidence">${evidence}</p>` : ""}
    </div>
    ${answer}
  </div>`;
}

// Which parts a network has made its own, in voiceParts() order.
export function partsDone(ctx, n) {
  return networkFields().map((f) => isOverridden(ctx, n, f));
}

// Which parts need the user because the product just added them: a new part
// the network hasn't optimized — on the base, a new part it hasn't filled in.
export function partsNew(ctx, n) {
  const onBase = normalizeNetwork(n) === baseNetwork(ctx);
  const empty = (f) => (isListPart(f) ? !cloneItems(ctx?.[f]).length : !String(ctx?.[f] || "").trim());
  return networkFields().map((f) => isNewPart(f) && (onBase ? empty(f) : !isOverridden(ctx, n, f)));
}

// The progress ring: one arc per part of the voice around the network's logo —
// green once optimized, grey-20 while it follows the base, ORANGE for a part
// the product just added and nobody has done yet. The base's ring is grey-100
// (the reference, not a score). When every part is done the arcs close into ONE
// green circle and a check badge says "all done". `current` thickens an arc
// (the wizard's step); `fresh` arcs fill once, to show what an action changed.
// Decorative: the state is always said in text beside it (voice-coach.css).
export function progressRingHtml(
  n,
  { done = [], base = false, current = -1, fresh = [], attention = [], size = 56 } = {},
) {
  const count = networkFields().length;
  const complete = !base && count > 0 && done.length === count && done.every(Boolean);
  const span = 100 / count;
  const gap = 7;
  const arcs = complete
    ? `<circle class="nv-ring__arc is-done is-complete${fresh.length ? " is-fresh" : ""}" cx="18" cy="18" r="15" pathLength="100" />`
    : networkFields()
        .map((_, i) => {
          const cls = [
            "nv-ring__arc",
            base && !attention[i] ? "is-base" : done[i] ? "is-done" : attention[i] ? "is-attention" : "",
            i === current ? "is-current" : "",
            fresh.includes(i) ? "is-fresh" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `<circle class="${cls}" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="${span - gap} ${100 - span + gap}" stroke-dashoffset="${-(span * i + gap / 2)}" />`;
        })
        .join("");
  const badge = complete ? `<span class="nv-ring__check"><i class="ap-icon-rounded-check_fill"></i></span>` : "";
  return `<span class="nv-ring${complete ? " is-complete" : ""}" style="--nv-ring:${size}px" aria-hidden="true"><svg viewBox="0 0 36 36" focusable="false">${arcs}</svg><i class="${networkIcon(n)}"></i>${badge}</span>`;
}

export function cloneVoiceByNetwork(v) {
  if (!v || typeof v !== "object") return {};
  const out = {};
  for (const [net, e] of Object.entries(v)) {
    if (!known(net) || !e || typeof e !== "object") continue;
    const entry = {};
    if (e.drafted) entry.drafted = true;
    for (const f of ALL_NETWORK_FIELDS) {
      if (e[f] === undefined) continue;
      entry[f] = isListPart(f) ? cloneItems(e[f]) : String(e[f] ?? "");
    }
    out[known(net)] = entry;
  }
  return out;
}

// ── Writing in a network voice ───────────────────────────────────────────────
// What a draft for `network` follows: the rules Archie learned and someone kept
// (Always and Never) — the ones a mock can carry out (RULE_ACTIONS). The other
// rules are followed by the writer in the real thing.
function learnedRules(ctx, network) {
  const net = known(network) || baseNetwork(ctx);
  return ["voiceAlways", "voiceNever"]
    .flatMap((f) => cloneItems(partValue(ctx, net, f)))
    .filter((i) => i.learned)
    .map((i) => i.text);
}

const EMOJI_ALL = /\p{Extended_Pictographic}️?/gu;
const wordsOf = (s) =>
  String(s || "")
    .split(/\s+/)
    .filter(Boolean);
// Sentences, the last one kept even without its full stop.
const sentencesOf = (s) => (String(s || "").match(/[^.!?]+(?:[.!?]+|$)/g) || []).map((x) => x.trim()).filter(Boolean);

// The rules a mock can actually carry out on a draft — the ones Archie's own
// coaching writes (voice-coach.js). Any other rule is followed by the writer
// in the real thing; here it changes nothing.
// ponytail: regex-matched rule shapes; the real generator gets the rules as
// instructions and needs none of this.
const RULE_ACTIONS = [
  [
    /no emoji/i,
    (d) => ({
      ...d,
      text: d.text.map((l) =>
        l
          .replace(EMOJI_ALL, "")
          .replace(/\s{2,}/g, " ")
          .trim(),
      ),
    }),
  ],
  [/no hashtags/i, (d) => ({ ...d, hashtags: [], text: d.text.map((l) => l.replace(/\s*#\w+/g, "").trim()) })],
  [/(\d+) hashtags? at most/i, (d, m) => ({ ...d, hashtags: d.hashtags.slice(0, Number(m[1])) })],
  [
    /opening line under (\d+) words/i,
    (d, m) => {
      const [first = "", ...rest] = d.text;
      const max = Number(m[1]) - 1;
      if (wordsOf(first).length <= max) return d;
      // Cut where a person would: the strongest break that fits — a sentence
      // end, then a colon or dash, then a comma (a comma is often inside a
      // list) — else the word limit.
      const words = wordsOf(first);
      const lastBreak = (re) => {
        for (let i = max; i > 2; i -= 1) if (re.test(words[i - 1])) return i;
        return 0;
      };
      const cut = lastBreak(/[.!?]$/) || lastBreak(/^[—–-]$|[:;]$/) || lastBreak(/,$/) || max;
      const head = words
        .slice(0, cut)
        .join(" ")
        .replace(/[,:;—–-]+$/, "")
        .trim();
      const tail = words
        .slice(cut)
        .join(" ")
        .replace(/^[—–-]\s*/, "");
      const lead = `${head}${/[.!?]$/.test(head) ? "" : "."}`;
      return { ...d, text: [lead, `${tail.charAt(0).toUpperCase()}${tail.slice(1)}`, ...rest] };
    },
  ],
  [
    /about (\d+) words/i,
    (d, m) => {
      const max = Number(m[1]);
      const text = d.text.slice();
      const total = () => text.reduce((n, l) => n + wordsOf(l).length, 0);
      // Drop the last sentence of the longest middle paragraph until it fits.
      while (total() > max) {
        const mid = text.map((l, i) => [i, l]).filter(([i]) => i > 0 && i < text.length - 1);
        const [i, line] = mid.sort((a, b) => wordsOf(b[1]).length - wordsOf(a[1]).length)[0] || [];
        const sentences = sentencesOf(line);
        if (sentences.length < 2) break;
        text[i] = sentences.slice(0, -1).join(" ");
      }
      return { ...d, text };
    },
  ],
  [
    /short paragraphs/i,
    (d) => ({
      ...d,
      text: d.text.flatMap(sentencesOf),
    }),
  ],
];

// One draft, made to follow `rules`. Returns a new { text, hashtags }.
export function followRules(draft, rules = []) {
  let d = { text: (draft.text || []).slice(), hashtags: (draft.hashtags || []).slice() };
  for (const rule of rules) {
    for (const [re, act] of RULE_ACTIONS) {
      const m = String(rule).match(re);
      if (m) d = act(d, m);
    }
  }
  return d;
}

// A fresh draft, written in the network voice: it follows the network's learned
// rules, and says which (the draft's Generation context lists them).
export function writeInVoice(ctx, network, draft) {
  const net = known(network) || baseNetwork(ctx);
  const rules = learnedRules(ctx, net);
  return {
    ...followRules({ text: draft.text, hashtags: draft.hashtags }, rules),
    voice: { network: net, rules },
  };
}
