import { FLAGS } from "./ff-catalog.js?v=2970";

const KEY = "archie-feature-flags";

function readStoredFlags() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch (error) {
    console.warn("Invalid Archie feature flags storage; resetting.", error);
    resetFlags();
    return {};
  }
}

// A shared link carries its flags: `?ff=insightsHub,-contentPanel` (a leading
// « - » = OFF; `?ff=` alone = all defaults). The link sets the WHOLE state —
// any flag it doesn't name falls back to its default — then the param leaves
// the URL so a later toggle in Admin isn't undone by a reload. Runs once, on
// this module's first import, before anything reads a flag.
(function applyFlagsFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("ff")) return;
    const stored = {};
    for (const token of params.get("ff").split(",")) {
      const id = token.trim().replace(/^-/, "");
      if (getFlagDefinition(id)) stored[id] = !token.trim().startsWith("-");
    }
    window.localStorage.setItem(KEY, JSON.stringify(stored));
    params.delete("ff");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
  } catch {
    // storage unavailable: the link opens with the defaults
  }
})();

// The current page's URL carrying every flag that differs from its default.
export function getFlagsShareUrl() {
  const flags = getFlags();
  const diff = FLAGS.filter((f) => flags[f.id] !== (f.default === true)).map((f) => (flags[f.id] ? f.id : `-${f.id}`));
  const url = new URL(window.location.href);
  url.searchParams.set("ff", diff.join(","));
  return url.toString().replace(/%2C/g, ",");
}

function getFlagDefinition(id) {
  return FLAGS.find((flag) => flag.id === id) || null;
}

export function isFlagOn(id) {
  const flag = getFlagDefinition(id);
  if (!flag) return false;
  const stored = readStoredFlags();
  return Object.prototype.hasOwnProperty.call(stored, id) ? stored[id] === true : flag.default === true;
}

// The New Start page (flag newStart4; #1 · #2 · #3 were deleted, the number
// stays the one the user knows).
export function isNewStartOn() {
  return isFlagOn("newStart4");
}

export function getFlags() {
  const stored = readStoredFlags();
  return FLAGS.reduce((acc, flag) => {
    acc[flag.id] = Object.prototype.hasOwnProperty.call(stored, flag.id)
      ? stored[flag.id] === true
      : flag.default === true;
    return acc;
  }, {});
}

export function setFlag(id, value) {
  try {
    const stored = readStoredFlags();
    stored[id] = value === true;
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}

function resetFlags() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
