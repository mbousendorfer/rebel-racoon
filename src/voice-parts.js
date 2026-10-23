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

import { escapeHtml } from "./utils.js?v=2114";

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
export function voiceItemsHtml(items) {
  const esc = escapeHtml;
  return `<ul class="voice-rules">${cloneItems(items)
    .map(
      (i) => `<li class="voice-rule">
        <div class="voice-rule__body">
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
