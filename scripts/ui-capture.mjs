// Reproducible screenshots for the UI polish loop (.claude/ui-polish/MISSION.md, Phase 0).
//
//   node scripts/ui-capture.mjs --out .ui-review/before [--only chat,topics] [--base http://localhost:8123]
//
// Every shot starts from a clean origin (storage cleared, user mode + flags set),
// with the clock frozen, Math.random seeded, animations off and reduced motion on, so two runs give
// the same pixels. Without --base it starts scripts/dev-server.py on 8123 itself.
// Shots and viewports live in scripts/ui-capture.config.json; a shot is saved as
// <id>@<width>.png.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const out = arg("--out");
if (!out) {
  console.error("usage: node scripts/ui-capture.mjs --out <dir> [--only id,id] [--base url]");
  process.exit(1);
}
const only = arg("--only")?.split(",");
const config = JSON.parse(readFileSync(new URL("./ui-capture.config.json", import.meta.url)));
const shots = config.shots.filter((s) => !only || only.includes(s.id));

let server = null;
let base = arg("--base");
if (!base) {
  base = "http://localhost:8123";
  server = spawn("python3", ["scripts/dev-server.py", "8123"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve) => server.stdout.once("data", resolve));
}

const FREEZE_CSS = `*, *::before, *::after {
  animation: none !important; transition: none !important; caret-color: transparent !important;
}`;

// Mulberry32: the app's random picks (loader phrases, mock variety) repeat run to run.
const SEED_RANDOM = () => {
  let a = 0x2f6b9d1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let failed = 0;

for (const shot of shots) {
  for (const [width, height] of shot.viewports || config.viewports) {
    const name = `${shot.id}@${width}`;
    // reducedMotion: the pixel stage (src/archie-pixels.js) is a rAF canvas; reduced, it paints one frame at t=0.
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(config.fixedTime));
    await page.addInitScript(SEED_RANDOM);
    await page.addInitScript(
      ({ mode, flags }) => {
        // Only on the first document of the context: a reload inside a shot keeps its state.
        if (sessionStorage.getItem("__ui_capture")) return;
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem("__ui_capture", "1");
        if (mode && mode !== "returning") localStorage.setItem("archie-user-mode", mode);
        if (flags) localStorage.setItem("archie-feature-flags", JSON.stringify(flags));
      },
      { mode: shot.mode, flags: shot.flags },
    );
    try {
      await page.goto(`${base}/${shot.url}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: FREEZE_CSS });
      for (const action of shot.actions || []) {
        if (action.click) await page.click(action.click);
        if (action.hover) await page.hover(action.hover);
        if (action.focus) await page.focus(action.focus);
        if (action.press) await page.keyboard.press(action.press);
        await page.waitForLoadState("networkidle");
      }
      await page.waitForSelector(shot.wait || "body", { timeout: 10000 });
      // The capture hooks open overlays/panels after 600 / 1000 ms (src/figma-capture.js).
      await page.waitForTimeout(1300);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: FREEZE_CSS });
      await page.screenshot({ path: join(out, `${name}.png`) });
      console.log("ok  ", name);
    } catch (err) {
      failed++;
      console.log("FAIL", name, err.message.split("\n")[0]);
    }
    await context.close();
  }
}

await browser.close();
server?.kill();
process.exit(failed ? 1 : 0);
