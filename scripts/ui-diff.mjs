// Compare two capture folders from ui-capture.mjs.
//
//   node scripts/ui-diff.mjs <dirA> <dirB> [--diff-out <dir>]
//
// Prints each shot whose pixels differ (with the % changed) and writes a diff
// image per changed shot (default <dirB>/_diff/). Exits 1 when anything differs.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: node scripts/ui-diff.mjs <dirA> <dirB> [--diff-out <dir>]");
  process.exit(1);
}
const i = process.argv.indexOf("--diff-out");
const diffOut = i === -1 ? join(b, "_diff") : process.argv[i + 1];

const names = new Set([...readdirSync(a), ...readdirSync(b)].filter((n) => n.endsWith(".png")));
let changed = 0;
for (const name of [...names].sort()) {
  if (!existsSync(join(a, name)) || !existsSync(join(b, name))) {
    console.log(`only in ${existsSync(join(a, name)) ? a : b}: ${name}`);
    changed++;
    continue;
  }
  const imgA = PNG.sync.read(readFileSync(join(a, name)));
  const imgB = PNG.sync.read(readFileSync(join(b, name)));
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    console.log(`size  ${name} ${imgA.width}x${imgA.height} -> ${imgB.width}x${imgB.height}`);
    changed++;
    continue;
  }
  const diff = new PNG({ width: imgA.width, height: imgA.height });
  const n = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
  if (!n) continue;
  changed++;
  console.log(`${((100 * n) / (imgA.width * imgA.height)).toFixed(2).padStart(6)}%  ${name}`);
  mkdirSync(diffOut, { recursive: true });
  writeFileSync(join(diffOut, name), PNG.sync.write(diff));
}
console.log(changed ? `${changed} shot(s) differ` : `identical (${names.size} shots)`);
process.exit(changed ? 1 : 0);
