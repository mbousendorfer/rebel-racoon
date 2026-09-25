// Image Generator — tagged-template HTML with escaping by default.
// A module-local copy on purpose: the module imports nothing from Archie
// outside the shell (router, flags, topbar) — see docs/audits/image-studio-integration.md.

const RAW = Symbol("imst-raw");

export function raw(value) {
  return { [RAW]: true, value: String(value ?? "") };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serialize(value) {
  if (value == null || value === false) return "";
  if (Array.isArray(value)) return value.map(serialize).join("");
  if (typeof value === "object" && value[RAW]) return value.value;
  return escapeHtml(value);
}

/** html`<p>${text}</p>` → a raw() fragment, so templates nest without double-escaping. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += serialize(values[i]) + strings[i + 1];
  return raw(out);
}

/** The string of a fragment, for innerHTML. */
export function toString(fragment) {
  return serialize(fragment);
}
