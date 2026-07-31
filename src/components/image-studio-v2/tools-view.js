// Image Studio — Edit mode's floating tool palette, and its one flyout.
//
// The manual tools live top-left OVER the canvas, at the contact point of the
// work. They take `.image-studio__palette` (styles/screens/image-studio-canvas.css)
// with the DS ghost-grey buttons: the arrangement was already right and the
// compact look was already right, so there was nothing here to redesign.
//
// Crop is a plain mode toggle — its ratio options live in the on-canvas toolbar
// under the crop box (edit-view.js#cropToolbar), not in a flyout a canvas-width
// away from the box it reshapes. So exactly ONE sheet exists: the Add-image
// stamp picker, tracked by `state.openPopover` along with the text toolbar's
// popovers, which genuinely are one-at-a-time.

import { escapeHtml } from "../../utils.js?v=21";
import { sheetDivider } from "./settings-view.js?v=5";
import * as imageStudio from "../../image-studio.js?v=73";

// The floating palette — the manual tools, top-left over the canvas, where the
// work is, in ghost-grey DS buttons. It sits at the stage's LEFT edge — the same
// edge the settings panel occupies in Generate mode — so its flyout opens right.
export function toolPalette(st) {
  return `<div class="image-studio__palette" role="toolbar" aria-label="Edit tools">${editTools(st)}</div>`;
}

// One palette tool: a ghost-grey DS button with its glyph and label.
// `.image-studio__palette-anchor` is the relative wrapper the flyout hangs off
// (styles/screens/image-studio-canvas.css).
function toolRow({ name, label, icon, sheet, open, active = false, disabled = false, action = "" }) {
  const hook = action || `data-img-popover-toggle="${name}"`;
  const busy = disabled ? " disabled" : "";
  const btn = `<button type="button" class="ap-button ghost grey" ${hook}${sheet ? ` aria-haspopup="true" aria-expanded="${open}"` : ""} aria-pressed="${active}"${busy}><i class="${icon}" aria-hidden="true"></i><span>${escapeHtml(label)}</span></button>`;
  if (!sheet) return btn;
  return `<div class="image-studio__palette-anchor">${btn}${open && !disabled ? sheet() : ""}</div>`;
}

// The drop-up surface. Not an .ap-action-dropdown — that component is a fixed
// 250px list of action rows, and half of these sheets are tile grids or slider
// panels. It borrows the action-dropdown's own --comp-* tokens for the surface
// (see the stylesheet) so it reads as the same object, sized to its content.
function sheet({ title, body }) {
  return `<div class="isv2-sheet" data-img-popover role="dialog" aria-label="${escapeHtml(title)}">
    <p class="isv2-sheet-title">${escapeHtml(title)}</p>
    <div class="isv2-sheet-body">${body}</div>
  </div>`;
}

function editTools(st) {
  const busy = !!st.editBusy;
  return [
    // Crop is a mode, not a menu — it just enters the draw mode. Its ratio
    // options belong on the canvas, in the toolbar under the box they reshape
    // (see edit-view#cropToolbar), not in a sheet a canvas-width away.
    toolRow({
      name: "crop",
      label: "Crop",
      icon: "ap-icon-cropper",
      action: `data-img-crop-start`,
      active: !!st.cropDrawing,
      disabled: busy,
    }),
    toolRow({
      name: "addText",
      label: "Add text",
      icon: "ap-icon-closed-captions",
      action: "data-img-add-text",
      disabled: busy,
    }),
    toolRow({
      name: "logo",
      label: "Add image",
      icon: "ap-icon-file--image",
      open: st.openPopover === "logo",
      disabled: busy,
      sheet: () => logoSheet(),
    }),
  ].join("");
}

function logoSheet() {
  const presets = imageStudio.IMAGE_PRESETS.map(
    (p) =>
      `<button type="button" class="image-studio__preset" data-img-logo-preset="${escapeHtml(p.url)}" title="${escapeHtml(p.label)}"><img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.label)}" loading="lazy" /></button>`,
  ).join("");
  return sheet({
    title: "Add an image",
    body: `<button type="button" class="ap-button stroked grey image-studio__logo-upload" data-img-logo-upload><i class="ap-icon-upload" aria-hidden="true"></i><span>Upload an image</span></button>
      ${sheetDivider}
      <div class="image-studio__presets">${presets}</div>`,
  });
}
