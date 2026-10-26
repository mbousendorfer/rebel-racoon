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

import { escapeHtml } from "./utils.js?v=2129";
import { isFlagOn } from "./feature-flags.js?v=2129";
import { NETWORK_VOICE_ADAPTATIONS } from "./mocks.js?v=2129";
import { networkMeta, normalizeNetwork, getConnectedProfileById } from "./social-profiles.js?v=2129";

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
// The flat parts above are the Brand voice. `ctx.voiceByNetwork[network]` is a
// whole voice for one network the Playbook publishes on — the same five parts,
// plus:
//   optimizedBy  "archie" (optimizeForNetwork) | "you" (copied to edit by hand)
//   baseStamp    voiceStamp() of the Brand voice it was made from — the Brand
//                voice changing never rewrites it; the network says so instead
// A rule Archie (or the user) made for this network carries `adapted: true` and
// reads « For LinkedIn »; a rule without it comes from the Brand voice.

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

// The Brand voice, as a short fingerprint — compared, never shown.
export function voiceStamp(ctx) {
  const s = JSON.stringify([baseValue(ctx, "voiceSummary"), ...LIST_PARTS.map((f) => cloneItems(ctx?.[f]))]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

// The Brand voice, optimized for one network: its parts, plus what the network
// asks for (mocks/voice-networks.js), each added rule marked `adapted`.
export function optimizeForNetwork(ctx, network) {
  const a = NETWORK_VOICE_ADAPTATIONS[network] || {};
  const voice = { voiceSummary: [baseValue(ctx, "voiceSummary"), a.summary].filter(Boolean).join(" ") };
  LIST_PARTS.forEach((f) => {
    voice[f] = [...cloneItems(ctx?.[f]), ...(a.add?.[f] || []).map((r) => ({ ...r, adapted: true }))];
  });
  return { ...voice, optimizedBy: "archie", baseStamp: voiceStamp(ctx) };
}

// The Brand voice copied as-is, for the user to make it the network's own.
export function copyBrandVoice(ctx) {
  const voice = { voiceSummary: baseValue(ctx, "voiceSummary") };
  LIST_PARTS.forEach((f) => (voice[f] = cloneItems(ctx?.[f])));
  return { ...voice, optimizedBy: "you", baseStamp: voiceStamp(ctx) };
}

export function cloneNetworkVoice(v) {
  const out = { voiceSummary: String(v?.voiceSummary || ""), optimizedBy: v?.optimizedBy === "you" ? "you" : "archie" };
  LIST_PARTS.forEach((f) => (out[f] = cloneItems(v?.[f])));
  out.baseStamp = String(v?.baseStamp || "");
  return out;
}

// Which voice a network writes in, and in what state:
//   "brand"     the flag is off, or no network named
//   "borrowed"  the network has no voice of its own yet — the Brand voice
//   "stale"     its own voice, made from a Brand voice that has changed since
//   "own"       its own voice
export function networkVoice(ctx, network) {
  const own = networkVoiceOn() && network ? ctx?.voiceByNetwork?.[network] : null;
  if (!networkVoiceOn() || !network) return { state: "brand", voice: ctx };
  if (!own) return { state: "borrowed", voice: ctx };
  return { state: own.baseStamp === voiceStamp(ctx) ? "own" : "stale", voice: own };
}

// After an edit of a network's voice: a rule that isn't, word for word, one of
// the Brand voice's (in the same part) is the network's own.
export function markAdapted(ctx, voice) {
  LIST_PARTS.forEach((f) => {
    const base = new Set(cloneItems(ctx?.[f]).map((r) => `${r.when || ""}\u0000${r.text}`));
    voice[f] = cloneItems(voice[f]).map((r) =>
      r.adapted || !base.has(`${r.when || ""}\u0000${r.text}`) ? { ...r, adapted: true } : r,
    );
  });
}
