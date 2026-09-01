#!/usr/bin/env node
/**
 * One cache-bust number for the whole app.
 *
 * Every ES-module specifier in `src/` and every app stylesheet in
 * `index.html` carries the SAME `?v=N`. That is the point: the browser caches
 * a module by its exact URL, so two importers naming one module at two
 * versions get two module instances — two copies of a store, with split
 * state. Historically each module carried its own counter and the bump had to
 * cascade by hand through the importer closure; the cascade was missed often
 * enough to land split stores on `main` more than once.
 *
 * With a single number the divergence is structurally impossible: `bump`
 * rewrites every reference in one pass, and `check` fails loudly if anything
 * ever drifts.
 *
 * Usage:
 *   node scripts/cache-version.mjs check      # CI/pre-commit guard — exits 1 on drift
 *   node scripts/cache-version.mjs bump       # N → N+1 everywhere (run before committing a JS/CSS change)
 *   node scripts/cache-version.mjs set 1234   # pin an explicit number
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "index.html");

/** Every file that may hold a versioned reference. */
function sourceFiles() {
  const out = [INDEX];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".js")) out.push(p);
    }
  })(path.join(ROOT, "src"));
  return out;
}

/* A module specifier in src/: `from "./x.js"` / `import("../y.js?v=3")`. */
const JS_SPECIFIER = /((?:from |import\()\s*")(\.[^"]*?\.js)(?:\?v=\d+)?(")/g;
/* An app asset in index.html: our own styles + the entry point. Never ds/. */
const HTML_ASSET = /((?:href|src)=")(\.\/(?:styles|src)\/[^"]*?\.(?:css|js))(?:\?v=\d+)?(")/g;

function rewrite(file, version) {
  const before = fs.readFileSync(file, "utf8");
  const pattern = file === INDEX ? HTML_ASSET : JS_SPECIFIER;
  const after = before.replace(pattern, (_, head, spec, tail) => `${head}${spec}?v=${version}${tail}`);
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}

/** Every version number currently referenced, with the file that names it. */
function declaredVersions() {
  const found = new Map(); // version → [file, …]
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, "utf8");
    const pattern = file === INDEX ? HTML_ASSET : JS_SPECIFIER;
    for (const match of text.matchAll(pattern)) {
      const v = /\?v=(\d+)/.exec(match[0])?.[1] ?? "(none)";
      const rel = path.relative(ROOT, file);
      if (!found.has(v)) found.set(v, new Set());
      found.get(v).add(rel);
    }
  }
  return found;
}

function currentVersion() {
  const m = /src="\.\/src\/app\.js\?v=(\d+)"/.exec(fs.readFileSync(INDEX, "utf8"));
  if (!m) {
    console.error(
      'cache-version: index.html has no versioned <script src="./src/app.js?v=N"> — cannot read the app version.',
    );
    process.exit(1);
  }
  return Number(m[1]);
}

const [command, arg] = process.argv.slice(2);

if (command === "check") {
  const found = declaredVersions();
  const expected = String(currentVersion());
  const drift = [...found.entries()].filter(([v]) => v !== expected);
  if (drift.length === 0) {
    console.log(`cache-version: OK — every reference is ?v=${expected}.`);
    process.exit(0);
  }
  console.error(`cache-version: DRIFT — the app is ?v=${expected} but these references disagree:`);
  for (const [v, files] of drift) console.error(`  ?v=${v}  ← ${[...files].sort().join(", ")}`);
  console.error("Fix with: npm run bump");
  process.exit(1);
}

if (command === "bump" || command === "set") {
  const version = command === "bump" ? currentVersion() + 1 : Number(arg);
  if (!Number.isInteger(version) || version <= 0) {
    console.error("cache-version: `set` needs a positive integer.");
    process.exit(1);
  }
  const touched = sourceFiles().filter((f) => rewrite(f, version));
  console.log(`cache-version: ?v=${version} — rewrote ${touched.length} file(s).`);
  process.exit(0);
}

console.error("usage: cache-version.mjs check | bump | set <n>");
process.exit(1);
