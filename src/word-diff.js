// word-diff — what a rewrite changed in a draft, word by word (flag
// draftChanges). One diff, three readings: the chat's revision card shows it
// unified (added marked, removed struck) or side by side, the panel's card
// shows the "after" reading — the post as it will publish, its new words marked.
//
// A text is a list of paragraphs. Tokens are its words plus a break between
// paragraphs; spacing is not diffed (a post's paragraphs are plain sentences).

import { escapeText } from "./utils.js?v=2531";

const BREAK = "\n";

function tokens(paragraphs) {
  const out = [];
  (paragraphs || []).filter(Boolean).forEach((p, i) => {
    if (i) out.push(BREAK);
    out.push(...String(p).split(/\s+/).filter(Boolean));
  });
  return out;
}

// [{ type: "eq" | "add" | "del", tokens: string[] }], runs in reading order.
// ponytail: plain O(n·m) LCS — a post is under ~300 words; a long-form text
// would want Myers' diff.
export function diffWords(before, after) {
  const a = tokens(before);
  const b = tokens(after);
  const n = a.length;
  const m = b.length;
  const w = m + 1;
  const lcs = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i * w + j] =
        a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);

  const flat = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) flat.push(["eq", a[i++], j++]);
    else if (j < m && (i === n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) flat.push(["add", b[j++]]);
    else flat.push(["del", a[i++]]);
  }
  return cleanup(runsOf(flat));
}

function runsOf(flat) {
  const runs = [];
  for (const [type, tok] of flat) {
    const last = runs[runs.length - 1];
    if (last && last.type === type) last.tokens.push(tok);
    else runs.push({ type, tokens: [tok] });
  }
  return runs;
}

// Confetti guard: two words kept between two changes read as noise ("the",
// "a"), so they join the change on both sides. Then each stretch of changes
// reads as one removal followed by one addition.
function cleanup(runs) {
  const isChange = (r) => r && r.type !== "eq";
  const absorbed = runs.flatMap((r, k) =>
    r.type === "eq" &&
    r.tokens.length <= 2 &&
    !r.tokens.includes(BREAK) &&
    isChange(runs[k - 1]) &&
    isChange(runs[k + 1])
      ? [
          { type: "del", tokens: r.tokens },
          { type: "add", tokens: r.tokens },
        ]
      : [r],
  );
  const out = [];
  let del = [];
  let add = [];
  const flush = () => {
    if (del.length) out.push({ type: "del", tokens: del });
    if (add.length) out.push({ type: "add", tokens: add });
    del = [];
    add = [];
  };
  for (const r of absorbed) {
    if (r.type === "del") del.push(...r.tokens);
    else if (r.type === "add") add.push(...r.tokens);
    else {
      flush();
      out.push(r);
    }
  }
  flush();
  return out;
}

const words = (runs, type) =>
  runs.filter((r) => r.type === type).reduce((s, r) => s + r.tokens.filter((t) => t !== BREAK).length, 0);

// Share of the words touched, 0…1. Above half, a word diff is confetti: the
// card opens on Side by side instead.
export function changeRatio(runs) {
  const eq = words(runs, "eq");
  const changed = words(runs, "add") + words(runs, "del");
  return changed ? changed / (changed + 2 * eq) : 0;
}

// How many words a rewrite added and removed — the card's legend.
export function wordCounts(runs) {
  return { added: words(runs, "add"), removed: words(runs, "del") };
}

export function hasChanges(runs) {
  return runs.some((r) => r.type !== "eq");
}

// The runs as paragraphs of HTML (inner markup, the caller wraps each one).
//   unified — both: added in <ins>, removed in <del>
//   before  — the old text, its removed words marked
//   after   — the new text, its added words marked
// A visually hidden "Added:" / "Removed:" says it to a screen reader, which
// reads <ins> / <del> as plain text.
export function diffParagraphs(runs, view = "unified") {
  const skip = view === "before" ? "add" : view === "after" ? "del" : null;
  const paragraphs = [[]];
  for (const r of runs) {
    if (r.type === skip) continue;
    let chunk = [];
    const emit = () => {
      if (!chunk.length) return;
      const text = escapeText(chunk.join(" "));
      paragraphs[paragraphs.length - 1].push(
        r.type === "add"
          ? `<ins class="draft-diff__add"><span class="draft-diff__sr">Added: </span>${text}</ins>`
          : r.type === "del"
            ? `<del class="draft-diff__del"><span class="draft-diff__sr">Removed: </span>${text}</del>`
            : text,
      );
      chunk = [];
    };
    for (const t of r.tokens) {
      if (t === BREAK) {
        emit();
        paragraphs.push([]);
      } else chunk.push(t);
    }
    emit();
  }
  return paragraphs.filter((p) => p.length).map((p) => p.join(" "));
}
