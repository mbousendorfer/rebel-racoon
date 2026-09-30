#!/usr/bin/env node
/**
 * Every DS name the app spells must exist in the DS the app actually loads.
 *
 * The DS is served by jsDelivr at @latest (index.html), so this reads the same
 * three files from the same CDN and checks, against them:
 *
 *   tokens  every --ref-* / --sys-* / --comp-* in styles/ and src/ is defined
 *           in desktop_variables.css (or by the app itself, in styles/)
 *   icons   every ap-icon-* class exists in ap-icons.css (or in ds-patches.css)
 *   classes every .ap-* class in src/ + index.html exists in css-ui/index.css
 *           (or in styles/, the ports ds-patches.css carries)
 *
 * Why it matters: a token or icon name that does not exist fails SILENTLY — the
 * declaration is dropped, the mask is empty, nothing reaches the console
 * (design-guidelines, references/silent-failures.md).
 *
 * Names that end in `-` or are followed by `${` are assembled at runtime and
 * skipped; a false positive is a name to add to ALLOW below, with its reason.
 *
 * Usage: node scripts/check-ds.mjs   (needs network)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CDN = "https://cdn.jsdelivr.net/npm/@agorapulse";
const SOURCES = {
  vars: `${CDN}/ui-theme@latest/assets/desktop_variables.css`,
  cssui: `${CDN}/ui-theme@latest/assets/style/css-ui/index.css`,
  icons: `${CDN}/ui-symbol@latest/icons/ap-icons.css`,
};

// Names that look like a DS name but are not one.
const ALLOW = new Set([
  // A JS hook on the dropzone's hidden <input>, never styled.
  "ap-dropzone__input",
]);

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

const read = (p) => fs.readFileSync(p, "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const [vars, cssui, icons] = await Promise.all(
  Object.values(SOURCES).map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.text();
  }),
);

const styles = walk(path.join(ROOT, "styles"), [".css"]).concat(walk(path.join(ROOT, "src"), [".css"]));
const scripts = walk(path.join(ROOT, "src"), [".js"]);
const appCss = styles.map(read).join("\n");
const defined = new Set([...(vars + appCss).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const cssClasses = new Set([...(cssui + appCss).matchAll(/\.(ap-[a-z0-9_-]+)/g)].map((m) => m[1]));
const iconClasses = new Set([...(icons + appCss).matchAll(/\.(ap-icon-[a-z0-9_-]+)/g)].map((m) => m[1]));

const misses = { tokens: new Map(), icons: new Map(), classes: new Map() };
const note = (bucket, name, file) => {
  if (ALLOW.has(name)) return;
  if (!bucket.has(name)) bucket.set(name, new Set());
  bucket.get(name).add(path.relative(ROOT, file));
};

// Seed data carries ids like "ap-acme-aware-1" — strings, not classes.
const isMock = (file) => file.includes(`${path.sep}mocks${path.sep}`);

for (const file of [...styles, ...scripts, path.join(ROOT, "index.html")]) {
  const src = stripComments(read(file));
  for (const m of src.matchAll(/(--(?:ref|sys|comp)-[a-z0-9-]*[a-z0-9])(?![a-z0-9-]|\$\{)/g)) {
    if (!defined.has(m[1])) note(misses.tokens, m[1], file);
  }
  if (file.endsWith(".css") || isMock(file)) continue;
  // `ap-` after a space, a quote or a dot — not after `--` (a custom property),
  // `/` (a file name) or a word character.
  for (const m of src.matchAll(/(?<=[\s"'`.])(ap-[a-z0-9_-]*[a-z0-9])(?![a-z0-9_.-]|\$\{|"\s*\+)/g)) {
    const name = m[1];
    if (name.startsWith("ap-icon-")) {
      if (!iconClasses.has(name)) note(misses.icons, name, file);
    } else if (!cssClasses.has(name)) note(misses.classes, name, file);
  }
}

let total = 0;
for (const [kind, bucket] of Object.entries(misses)) {
  if (!bucket.size) continue;
  console.log(`\n### ${kind} not in the DS (${bucket.size}) ###`);
  for (const [name, files] of [...bucket].sort()) {
    console.log(`  ${name}  ←  ${[...files].slice(0, 3).join(", ")}${files.size > 3 ? ", …" : ""}`);
  }
  total += bucket.size;
}
if (total) {
  console.log(`\ncheck-ds: ${total} name(s) do not resolve against @latest.`);
  process.exitCode = 1;
} else console.log("check-ds: OK — every token, icon and .ap-* class resolves against @latest.");
