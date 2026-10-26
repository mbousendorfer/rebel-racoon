// Self-check of the Clips space's reframe engine (src/clip-framing.js) on the
// two seeded beta videos: real segments inside the analysed window, fallback
// outside, aspect kept per format, split / merge / retrim / setLayout.
// Run: npm run check:framing
import assert from "node:assert";
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const F = await import(root + "/src/clip-framing.js");
const { seedVideos } = await import(root + "/src/mocks/videos.js");
const [pod, panel] = seedVideos;
const pctx = F.framingContext(panel);
assert.deepEqual(
  pctx.cameras.map((c) => c.id),
  ["A", "B"].slice(0, pctx.cameras.length),
);
// clip fully outside analysis → fallback
let s = F.initialSegments(pctx, 2000, 28000);
assert.equal(s.length, 1);
assert.equal(s[0].auto.layout, "ONE");
// clip inside analysis → real segments
s = F.initialSegments(pctx, 31370, 51000);
assert.ok(s.length >= 3, "real segments " + s.length);
assert.equal(s[0].startMs, 31370);
assert.equal(s.at(-1).endMs, 51000);
for (let i = 1; i < s.length; i++) assert.equal(s[i].startMs, s[i - 1].endMs);
// resolve shapes
const r = F.resolve(pctx, s[0], 32000, 9 / 16);
assert.equal(r.kind, "two");
assert.equal(F.resolve(pctx, s[0], 32000, 16 / 9).kind, "fit");
const one = F.resolve(pctx, s[1], s[1].startMs + 10, 9 / 16);
assert.equal(one.kind, "one");
const w = one.rects[0];
assert.ok(Math.abs((w.w * 1920) / (w.h * 1080) - 9 / 16) < 0.01, "aspect kept");
// split + merge
const n = s.length;
const mid = Math.round((s[0].startMs + s[0].endMs) / 2);
assert.ok(F.split(pctx, s, mid));
assert.equal(s.length, n + 1);
assert.ok(F.merge(pctx, s, s[0], 1));
assert.equal(s.length, n);
// retrim across the analysed edge
const t = F.retrim(pctx, s, 30000, 45000);
assert.equal(t[0].startMs, 30000);
assert.equal(t.at(-1).endMs, 45000);
// podcast: TWO fallback everywhere
const cctx = F.framingContext(pod);
const ps = F.initialSegments(cctx, 92000, 128000);
assert.equal(ps[0].auto.layout, "TWO");
F.setLayout(cctx, ps[0], "ONE", 100000, 9 / 16);
assert.equal(ps[0].layout, "ONE");
console.log("framing ok");
