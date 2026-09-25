// Image Generator — the typefaces a brand can pick from. System families only:
// generated visuals are rasterised in the browser, and a family the machine has
// is one the export can draw. `stack` is the CSS fallback chain used on content.

export const FONT_CHOICES = Object.freeze([
  { family: "Georgia", stack: "Georgia, 'Times New Roman', serif", kind: "serif" },
  { family: "Didot", stack: "Didot, 'Bodoni 72', Georgia, serif", kind: "serif" },
  { family: "Rockwell", stack: "Rockwell, 'Courier New', serif", kind: "slab" },
  { family: "Futura", stack: "Futura, 'Century Gothic', 'Trebuchet MS', sans-serif", kind: "sans" },
  { family: "Avenir Next", stack: "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif", kind: "sans" },
  { family: "Avenir", stack: "Avenir, 'Avenir Next', 'Helvetica Neue', Arial, sans-serif", kind: "sans" },
  { family: "Helvetica Neue", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif", kind: "sans" },
  { family: "Gill Sans", stack: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif", kind: "sans" },
  { family: "Trebuchet MS", stack: "'Trebuchet MS', 'Lucida Grande', sans-serif", kind: "sans" },
  { family: "Verdana", stack: "Verdana, Geneva, sans-serif", kind: "sans" },
  { family: "Courier New", stack: "'Courier New', Courier, monospace", kind: "mono" },
]);

export function fontStack(family) {
  return FONT_CHOICES.find((f) => f.family === family)?.stack || `'${family}', sans-serif`;
}
