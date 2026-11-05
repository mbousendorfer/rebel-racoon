// Self-check of the shared formatting helpers (src/utils.js): compact numbers,
// plurals, URLs, ids.
// Run: npm run check:utils
import assert from "node:assert";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const U = await import(root + "/src/utils.js");

assert.deepEqual([940, 1400, 2030, 41800, null].map(U.compactNumber), ["940", "1.4K", "2K", "42K", "—"]);
assert.deepEqual(
  [0, 1, 2].map((n) => U.plural(n, "clip")),
  ["0 clips", "1 clip", "2 clips"],
);
assert.equal(U.plural(3, "story", "stories"), "3 stories");
assert.equal(U.prettyUrl("https://acme.com/"), "acme.com");
assert.equal(U.hostname("https://www.acme.com/blog"), "acme.com");
assert.equal(U.hostname("acme.com"), "acme.com");
assert.match(U.newId("draft"), /^draft-[a-z0-9]+-[a-z0-9]+$/);
assert.notEqual(U.newId("x"), U.newId("x"));
assert.match(U.newChatPath(), /^\/session\/new-[a-z0-9]+$/);
console.log("utils: ok");
