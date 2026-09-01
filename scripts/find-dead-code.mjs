#!/usr/bin/env node
/**
 * Audit for code nothing reaches. Reports, never deletes — every hit needs a
 * human read before it goes, and the dynamic-class heuristic below is a
 * heuristic, not a proof.
 *
 * Two passes:
 *
 *   exports  an exported symbol no OTHER module names. Either it is dead, or
 *            it should lose its `export` and stay internal. Namespace imports
 *            (`import * as store`) are covered: the call site still spells the
 *            symbol out, so it counts as a reference.
 *
 *   css      a class in styles/ whose name appears nowhere in src/ or
 *            index.html. Classes are routinely ASSEMBLED (`isv2-art--${key}`,
 *            `"is-mark-" + w.mark`), so a candidate whose prefix is followed by
 *            an interpolation or a concatenation is flagged [built?] and is
 *            almost certainly alive — check the catalogue it is keyed off
 *            before touching it.
 *
 * Usage: node scripts/find-dead-code.mjs [exports|css]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, ext, out);
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const jsFiles = walk(path.join(ROOT, "src"), ".js");
const js = new Map(jsFiles.map((f) => [f, fs.readFileSync(f, "utf8")]));
const rel = (f) => path.relative(ROOT, f);
const word = (name) => new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);

function auditExports() {
  const findings = [];
  for (const [file, code] of js) {
    const names = new Set();
    for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm)) {
      names.add(m[1]);
    }
    for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(",")) {
        const t = part.trim();
        if (t) names.add((t.split(/\s+as\s+/)[1] || t).trim());
      }
    }
    for (const name of names) {
      const re = word(name);
      const used = [...js].some(([other, otherCode]) => other !== file && re.test(otherCode));
      if (used) continue;
      const self = (code.match(new RegExp(re.source, "g")) || []).length;
      findings.push({ file: rel(file), name, verdict: self <= 1 ? "dead" : "internal-only" });
    }
  }
  console.log(`### exports no other module names (${findings.length}) ###`);
  for (const f of findings.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))) {
    console.log(`  ${f.verdict === "dead" ? "DEAD        " : "internal    "} ${f.file}  ${f.name}`);
  }
  return findings.length;
}

function auditCss() {
  const corpus = [...js.values()].join("\n") + "\n" + fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // A class is BUILT when some `prefix-` of it is immediately followed by an
  // interpolation or a string concatenation in the corpus.
  const built = (cls) => {
    for (let i = 0; i < cls.length; i++) {
      if (cls[i] !== "-") continue;
      const prefix = cls.slice(0, i + 1);
      if (corpus.includes(prefix + "${") || corpus.includes(prefix + '" +') || corpus.includes(prefix + '"+'))
        return true;
    }
    return false;
  };
  let total = 0;
  for (const file of walk(path.join(ROOT, "styles"), ".css")) {
    const clean = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // url(…/AvertaStd.woff2) would otherwise read as a `.woff2` class.
      .replace(/url\([^)]*\)/g, "url()");
    const dead = [];
    for (const m of clean.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) {
      const cls = m[1];
      if (corpus.includes(cls) || dead.some((d) => d.cls === cls)) continue;
      dead.push({ cls, built: built(cls) });
    }
    if (!dead.length) continue;
    total += dead.length;
    console.log(`\n--- ${rel(file)} ---`);
    for (const d of dead.sort((a, b) => a.cls.localeCompare(b.cls))) {
      console.log(`  ${d.built ? "[built?] " : "DEAD     "} .${d.cls}`);
    }
  }
  console.log(`\n### css classes not named in src/ or index.html: ${total} ###`);
  return total;
}

const which = process.argv[2];
if (!which || which === "exports") auditExports();
if (!which || which === "css") auditCss();
