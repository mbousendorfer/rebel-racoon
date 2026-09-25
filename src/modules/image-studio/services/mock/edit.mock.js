// Image Generator — mocked editService: edit in plain words.
//
// Contract:
//   interpret({ instruction, layers, brand }) → Promise<{ layers, applied: string[], understood: boolean }>
// The mock understands a small grammar — logo version / position / size,
// text position / size / alignment / band / colour / content, background
// lighter / darker, hide / remove — and applies what it can. Anything else
// comes back `understood: false` so the UI can say so instead of pretending.

import { wait } from "../../lib/delegate.js?v=1307";
import { MOCK } from "../../config/mock.js?v=1307";

const POSITIONS = [
  { re: /bottom[\s-]*right/, x: (w) => 0.94 - w, y: (h) => 0.94 - h, label: "bottom right" },
  { re: /bottom[\s-]*left/, x: () => 0.06, y: (h) => 0.94 - h, label: "bottom left" },
  { re: /top[\s-]*right/, x: (w) => 0.94 - w, y: () => 0.06, label: "top right" },
  { re: /top[\s-]*left/, x: () => 0.06, y: () => 0.06, label: "top left" },
  { re: /\b(centre|center|middle)\b/, x: (w) => (1 - w) / 2, y: (h) => (1 - h) / 2, label: "in the centre" },
  { re: /\bbottom\b/, x: (w, l) => l.x, y: (h) => 0.94 - h, label: "at the bottom" },
  { re: /\btop\b/, x: (w, l) => l.x, y: () => 0.06, label: "at the top" },
];

const ROLES = ["primary", "secondary", "accent", "background", "text"];
const WORD_COLORS = { white: "#FFFFFF", black: "#111111" };

function place(layer, text) {
  const pos = POSITIONS.find((p) => p.re.test(text));
  if (!pos) return null;
  return { layer: { ...layer, x: pos.x(layer.w, layer), y: pos.y(layer.h, layer) }, label: pos.label };
}

function resize(layer, text, keepRatio) {
  const bigger = /\b(bigger|larger|increase|enlarge)\b/.test(text);
  const smaller = /\b(smaller|reduce|decrease|shrink)\b/.test(text);
  if (!bigger && !smaller) return null;
  const k = bigger ? 1.25 : 0.8;
  const next = { ...layer, w: Math.min(1, layer.w * k), h: keepRatio ? Math.min(1, layer.h * k) : layer.h };
  if (layer.type === "text") next.props = { ...layer.props, size: layer.props.size * k };
  return { layer: next, label: bigger ? "bigger" : "smaller" };
}

export async function interpret({ instruction, layers }, { signal } = {}) {
  const [min, max] = MOCK.copy.delayMs;
  await wait(min + Math.random() * (max - min), signal);
  const text = String(instruction || "").toLowerCase();
  const applied = [];
  let next = layers.map((l) => ({ ...l, props: { ...l.props } }));
  const update = (id, fn) => {
    next = next.map((l) => (l.id === id ? fn(l) : l));
  };

  // Split "logo white bottom right and background lighter" into clauses.
  for (const clause of text.split(/\s*(?:,|;|\band\b|\bthen\b)\s*/).filter(Boolean)) {
    const logo = next.find((l) => l.type === "logo");
    const txt = next.filter((l) => l.type === "text").sort((a, b) => b.z - a.z)[0];
    const image = next.find((l) => l.type === "image");

    if (/\blogo\b/.test(clause)) {
      if (!logo) continue;
      if (/\b(remove|delete|hide)\b/.test(clause)) {
        update(logo.id, (l) => ({ ...l, hidden: true }));
        applied.push("logo hidden");
        continue;
      }
      const variant = /\bwhite\b/.test(clause)
        ? "white"
        : /\bblack\b/.test(clause)
          ? "black"
          : /\bicon\b/.test(clause)
            ? "icon"
            : /\b(colou?r|full)\b/.test(clause)
              ? "color"
              : null;
      if (variant) {
        update(logo.id, (l) => ({ ...l, hidden: false, props: { ...l.props, variant } }));
        applied.push(`logo in ${variant === "color" ? "colour" : variant}`);
      }
      const r = resize(
        next.find((l) => l.id === logo.id),
        clause,
        true,
      );
      if (r) {
        update(logo.id, () => r.layer);
        applied.push(`logo ${r.label}`);
      }
      const p = place(
        next.find((l) => l.id === logo.id),
        clause,
      );
      if (p) {
        update(logo.id, () => p.layer);
        applied.push(`logo ${p.label}`);
      }
      continue;
    }

    if (/\b(background|backdrop|image|photo)\b/.test(clause) && image) {
      const lighter = /\b(lighter|brighter|light)\b/.test(clause);
      const darker = /\b(darker|dimmer|dark)\b/.test(clause);
      if (lighter || darker) {
        update(image.id, (l) => ({
          ...l,
          props: {
            ...l.props,
            brightness: Math.max(0.5, Math.min(1.6, (l.props.brightness || 1) + (lighter ? 0.15 : -0.15))),
          },
        }));
        applied.push(`background ${lighter ? "lighter" : "darker"}`);
      }
      continue;
    }

    if (/\b(text|headline|title|copy|caption|words?)\b/.test(clause) || /["“]/.test(clause)) {
      const quoted = instruction.match(/["“]([^"”]+)["”]/);
      if (!txt) continue;
      if (/\b(remove|delete|hide)\b/.test(clause)) {
        update(txt.id, (l) => ({ ...l, hidden: true }));
        applied.push("text hidden");
        continue;
      }
      if (quoted) {
        update(txt.id, (l) => ({ ...l, hidden: false, props: { ...l.props, content: quoted[1] } }));
        applied.push("new text");
      }
      const align =
        /\bcent(er|re)(ed)?\b/.test(clause) && /\balign/.test(clause)
          ? "center"
          : /\bright[\s-]*align|\balign(ed)?\s+right\b/.test(clause)
            ? "right"
            : /\bleft[\s-]*align|\balign(ed)?\s+left\b/.test(clause)
              ? "left"
              : null;
      if (align) {
        update(txt.id, (l) => ({ ...l, props: { ...l.props, align } }));
        applied.push(`text aligned ${align}`);
      }
      if (/\b(band|banner|background behind|box)\b/.test(clause)) {
        const off = /\b(no|remove|without)\b/.test(clause);
        update(txt.id, (l) => ({ ...l, props: { ...l.props, band: !off } }));
        applied.push(off ? "band removed" : "band behind the text");
      }
      const role = ROLES.find((r) => new RegExp(`\\b${r}\\b`).test(clause));
      const word = Object.keys(WORD_COLORS).find((w) => new RegExp(`\\b${w}\\b`).test(clause));
      if (role && !/\bband\b/.test(clause)) {
        update(txt.id, (l) => ({ ...l, props: { ...l.props, colorRole: role, hex: undefined } }));
        applied.push(`text in the ${role} colour`);
      } else if (word) {
        update(txt.id, (l) => ({ ...l, props: { ...l.props, hex: WORD_COLORS[word] } }));
        applied.push(`text in ${word}`);
      }
      const r = resize(
        next.find((l) => l.id === txt.id),
        clause,
        false,
      );
      if (r) {
        update(txt.id, () => r.layer);
        applied.push(`text ${r.label}`);
      }
      if (!align) {
        const p = place(
          next.find((l) => l.id === txt.id),
          clause,
        );
        if (p) {
          update(txt.id, () => p.layer);
          applied.push(`text ${p.label}`);
        }
      }
    }
  }
  return { layers: next, applied, understood: applied.length > 0 };
}
