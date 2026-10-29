// Self-check of the draft word diff (src/word-diff.js): no change, a prepended
// hook, a shortening, a reordered paragraph, the confetti guard, escaping.
// Run: npm run check:diff
import assert from "node:assert";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const D = await import(root + "/src/word-diff.js");
const types = (runs) => runs.map((r) => r.type).join(",");

const post = ["We cut the fluff and shipped in two weeks.", "Here is what changed for the team."];

let r = D.diffWords(post, post);
assert.equal(D.hasChanges(r), false);
assert.equal(D.changeRatio(r), 0);

r = D.diffWords(post, ["Okay, real talk:", ...post]);
assert.equal(types(r), "add,eq");
assert.ok(D.changeRatio(r) < 0.5);
assert.match(D.diffParagraphs(r, "after")[0], /^<ins class="draft-diff__add">/);
assert.equal(D.diffParagraphs(r, "before").join(" ").includes("<ins"), false);

r = D.diffWords(post, ["We cut the fluff."]);
assert.ok(D.changeRatio(r) > 0.5, "a shortening opens on side by side");
assert.equal(D.diffParagraphs(r, "after").length, 1);
assert.equal(D.diffParagraphs(r, "before").length, 2);

r = D.diffWords(post, [post[1], post[0]]);
assert.ok(D.hasChanges(r));
assert.equal(D.diffParagraphs(r, "after").length, 2);

// One kept word between two edits joins them: one removal, one addition.
r = D.diffWords(["alpha the beta"], ["gamma the delta"]);
assert.equal(types(r), "del,add");

r = D.diffWords(["a <b> & c"], ["a <b> & d"]);
assert.ok(!D.diffParagraphs(r, "unified")[0].includes("<b>"), "escaped");
console.log("word-diff: ok");
