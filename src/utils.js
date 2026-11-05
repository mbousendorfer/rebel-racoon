// Minimal DOM / template helpers. Intentionally tiny — all state is mock,
// all screens are render-on-navigate, so we don't need anything clever.

export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape for HTML *text content* — the minimal & < > set. Use when the value
// lands between tags (not inside an attribute). null/undefined → "".
export function escapeText(value) {
  if (value == null) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Escape for an HTML *attribute value* — the full set, including quotes. This
// is the same coverage as escapeHtml, exported under an intent-revealing name.
export const escapeAttr = escapeHtml;

export function html(strings, ...values) {
  // Tiny tagged-template helper: interpolates values, escaping by default.
  // To skip escaping (for nested HTML fragments), wrap the value in raw(...).
  let out = "";
  for (let i = 0; i < strings.length; i += 1) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (v == null || v === false) continue;
      if (Array.isArray(v)) {
        out += v.join("");
      } else if (typeof v === "object" && v && v.__raw) {
        out += v.value;
      } else {
        out += escapeHtml(v);
      }
    }
  }
  return out;
}

export function raw(value) {
  return { __raw: true, value: value == null ? "" : String(value) };
}

// Lowercased, accents dropped: a search that ignores them ("lea" finds Léa).
export function fold(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// A time of day in the house style: "9am", "1:30pm" (copy-principles §5.6).
export function formatTimeOfDay(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

// A duration or a playhead as m:ss. Two readings of the same number, kept
// apart on purpose: a DURATION rounds (a 29.6s clip is "0:30"), a PLAYHEAD
// floors (it reads 0:29 until the 30th second has actually passed).
export function formatClock(seconds, { round = false } = {}) {
  const n = Number.isFinite(seconds) ? seconds : 0;
  const s = Math.max(0, round ? Math.round(n) : Math.floor(n));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "Tue, Nov 5" — a day in the house style, wherever a date is shown short.
export function formatDayLabel(ts) {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// 41800 → "42K", 2030 → "2K", 1400 → "1.4K", 940 → "940": reach and
// engagement read at a glance, never digit by digit. null → "—".
export function compactNumber(n) {
  if (n == null) return "—";
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  const k = v / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
}

// "1 clip" / "3 clips" / "0 clips". Pass `many` when the plural isn't one + s.
export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// A fresh id: prefix + base36 time + a per-load counter + a random tail, so ids
// stay unique across reloads for the stores kept in localStorage.
let idSeq = 0;
export function newId(prefix) {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// The route of a chat not created yet (the session screen creates it on render).
export function newChatPath() {
  return `/session/new-${Date.now().toString(36)}`;
}

// "https://www.acme.com/" → "www.acme.com": a URL as people read it.
export function prettyUrl(url) {
  return String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

// "https://www.acme.com/blog" → "acme.com"; the input back when it isn't a URL.
export function hostname(url) {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return String(url || "");
  }
}
