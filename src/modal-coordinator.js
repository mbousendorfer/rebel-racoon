// Tiny coordinator to enforce "one overlay at a time" across modals,
// drawers, and the shortcut legend. Resolves FIND-23 — every overlay
// previously bound its own document keydown listener and called open()
// blind, so two topbar buttons clicked in quick succession could stack
// two modals (with z-index races and Esc behaviour undefined).
//
// Usage:
//   import { requestOpen, notifyClose } from "./modal-coordinator.js?v=2579";
//
//   export function open() {
//     requestOpen("bugReport", close);   // closes the active overlay first
//     ... show modal ...
//   }
//   export function close() {
//     ... hide modal ...
//     notifyClose("bugReport");
//   }
//
// Re-entry safety: requestOpen detects when the active overlay is the
// same id (e.g. the user pressed the toggle twice) and is a no-op so we
// don't recursively call close on ourselves.
//
// Focus restore (FIND-C): the coordinator snapshots document.activeElement
// when an overlay opens and re-focuses it on close. This makes every
// overlay keyboard-friendly without each one having to track focus itself
// (only search-modal.js used to do this).

let activeId = null;
let activeClose = null;
let lastFocus = null;
let inertNodes = [];

// Focus in + containment, once for every overlay (WCAG 2.4.3): after the
// overlay's open() has shown it, the topmost open aria-modal dialog gets
// focus (its [autofocus], else its first control) unless the overlay already
// placed it inside, and every other top-level node of <body> goes inert so
// Tab can't walk the page under the scrim. Overlays without an aria-modal
// dialog (drawers) are left alone.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function releaseInert() {
  for (const node of inertNodes) node.inert = false;
  inertNodes = [];
}

function engage(id) {
  if (activeId !== id) return;
  // Visible is what counts, not `.open`: the schedule modal shows through `hidden`.
  const dialog = [...document.querySelectorAll('[aria-modal="true"]')]
    .filter((el) => !el.hidden && el.getClientRects().length)
    .pop();
  if (!dialog) return;
  let top = dialog;
  while (top.parentElement && top.parentElement !== document.body) top = top.parentElement;
  // The open overlay's backdrop stays live: most backdrops are body children
  // apart from their dialog, and an inert one swallowed the click-outside-to-close.
  const isOpenBackdrop = (node) => /backdrop|scrim/.test(node.className) && !node.hidden;
  inertNodes = [...document.body.children].filter(
    (node) =>
      node !== top && node.id !== "toastRegion" && node.tagName !== "SCRIPT" && !node.inert && !isOpenBackdrop(node),
  );
  for (const node of inertNodes) node.inert = true;
  if (dialog.contains(document.activeElement)) return;
  // The first control, but not the close X (first in the markup): a first Enter
  // would close the dialog. The X only when it's the one control.
  const controls = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
  const target =
    dialog.querySelector("[autofocus]") || controls.find((el) => !el.matches(".ap-dialog-close")) || controls[0];
  if (target) target.focus({ preventScroll: true });
  else {
    dialog.setAttribute("tabindex", "-1");
    dialog.focus({ preventScroll: true });
  }
}

export function requestOpen(id, closeFn) {
  if (activeId === id) return;
  releaseInert();
  // The overlay shows itself after this call returns; look for it then.
  setTimeout(() => engage(id), 0);
  if (activeId && typeof activeClose === "function") {
    const prevId = activeId;
    const prevClose = activeClose;
    // Clear first so prev's close() can call notifyClose(prevId) without
    // racing the upcoming registration.
    activeId = null;
    activeClose = null;
    try {
      prevClose();
    } catch (err) {
      console.warn(`[modal-coordinator] close handler for ${prevId} threw`, err);
    }
  } else {
    // Snapshot focus ONLY on a fresh open. Modal→modal swaps reuse the
    // first overlay's snapshot so the user lands back on the trigger
    // that started the chain.
    const active = document.activeElement;
    lastFocus = active instanceof HTMLElement ? active : null;
  }
  activeId = id;
  activeClose = closeFn;
}

export function notifyClose(id) {
  if (activeId === id) {
    activeId = null;
    activeClose = null;
    // Before the focus restore: an inert trigger can't take focus.
    releaseInert();
    const target = lastFocus;
    lastFocus = null;
    if (target && typeof target.focus === "function" && document.body.contains(target)) {
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore — element may have been removed from the DOM
      }
    }
  }
}

// An Escape pressed while an overlay is open belongs to that overlay.
// Snapshotted in the capture phase, before any bubble listener runs —
// the overlay's own Esc handler may close it (and clear activeId) before
// a later listener, like the right panel's, gets to ask.
const overlayEscapes = new WeakSet();
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && activeId) overlayEscapes.add(event);
  },
  true,
);
export function isOverlayEscape(event) {
  return overlayEscapes.has(event);
}

// bindOverlayDismissal wires the common dismissal patterns (Escape key,
// backdrop click) to a modal's close handler. Returns nothing — call
// once during init().
//
// Each modal still owns its own DOM structure, open() signature, and
// state reset; this helper just removes the boilerplate every overlay
// would otherwise repeat. Centralising it makes "press Esc when this
// modal is on top" behave identically everywhere.
//
// Usage:
//   bindOverlayDismissal({
//     modal,       // the .ap-dialog / .ap-drawer element with `.open` class
//     backdrop,    // the click-to-dismiss backdrop element (optional)
//     close,       // the modal-local close() function
//     isOpen,      // optional: defaults to modal.classList.contains("open")
//   });
export function bindOverlayDismissal({ modal, backdrop, close, isOpen }) {
  const opened = isOpen || (() => modal?.classList.contains("open"));
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      if (opened()) close();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && opened()) close();
  });
}
