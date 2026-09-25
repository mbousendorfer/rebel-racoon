// Image Generator — mocked productService: a product page URL → name,
// description, image. Nothing is fetched: the slug names the product, the
// domain picks the shape, and the image is drawn in the brand's palette.
//
// Contract:
//   fromUrl(url, { brand }) → Promise<{ name, description, url, shape, svg }>
//   Rejects { code: "invalid_url" } for something that isn't a URL.

import { MOCK } from "../../config/mock.js?v=1308";
import { wait } from "../../lib/delegate.js?v=1308";
import { hashString, pick, prng } from "../../lib/prng.js?v=1308";
import { productShotSvg, PRODUCT_SHAPES } from "../../render/product-shot.js?v=1308";
import { resolvePalette, lighten } from "../../render/palette.js?v=1308";

const HINTS = [
  { re: /(bag|coffee|bean|blend|roast|tea)/, shape: "bag", noun: "blend" },
  { re: /(kettle|pot|brewer)/, shape: "kettle", noun: "kettle" },
  { re: /(cup|mug)/, shape: "cup", noun: "cup" },
  { re: /(card|pay|wallet)/, shape: "card", noun: "card" },
  { re: /(app|dashboard|software|screen|platform)/, shape: "screen", noun: "app" },
  { re: /(collar|tracker|bottle|device|gps)/, shape: "bottle", noun: "device" },
];

export async function fromUrl(url, { brand } = {}) {
  const [min, max] = MOCK.copy.delayMs;
  await wait(min + Math.random() * (max - min) + 600);
  const raw = String(url || "").trim();
  if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(raw)) {
    const error = new Error("That doesn't look like a product page address.");
    error.code = "invalid_url";
    throw error;
  }
  const path = raw.replace(/^https?:\/\//, "").split(/[?#]/)[0];
  const slug = path.split("/").filter(Boolean).pop() || path.split(".")[0];
  const words = slug
    .replace(/\.[a-z]+$/, "")
    .split(/[-_+]/)
    .filter(Boolean);
  const name = words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "New product";
  const hint = HINTS.find((h) => h.re.test(path.toLowerCase()));
  const rand = prng(hashString(raw));
  const shape = hint?.shape || pick(rand, PRODUCT_SHAPES);
  const p = resolvePalette(brand);
  const svg = productShotSvg({
    shape,
    label: name,
    colors: {
      primary: p.primary,
      text: p.text,
      accent: p.accent,
      background: p.background,
      surface: lighten(p.secondary, 0.8),
    },
  });
  return {
    name,
    description: `${name}: the ${hint?.noun || "product"} as described on its page. Edit this to say what makes it worth a look.`,
    url: /^https?:\/\//.test(raw) ? raw : `https://${raw}`,
    shape,
    svg,
  };
}
