// Image Generator — dialogs. DS .ap-dialog + the app's .app-modal-backdrop,
// positioned by the module's own CSS (.imst-dialog). Deliberately NOT routed
// through Archie's modal-coordinator: the module imports nothing of Archie's.
//
// openDialog() returns { el, close, setBody }. Escape and the backdrop close it;
// focus moves in on open and back to the opener on close.

import { html, toString } from "../lib/html.js?v=1227";

let open = [];

function onKey(event) {
  const top = open[open.length - 1];
  if (!top) return;
  if (event.key === "Escape") {
    event.stopPropagation();
    top.close();
  } else if (event.key === "Tab") {
    trapFocus(top.el, event);
  }
}

function focusables(root) {
  return [
    ...root.querySelectorAll("button, [href], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])"),
  ].filter((el) => !el.disabled && el.offsetParent !== null);
}

function trapFocus(root, event) {
  const items = focusables(root);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * @param {{title:string, subtitle?:string, body:object, footer?:object, size?:"sm"|"md"|"lg",
 *          role?:"dialog"|"alertdialog", onMount?:(el:HTMLElement, api:object)=>void|(()=>void),
 *          onClose?:()=>void}} opts
 */
export function openDialog({ title, subtitle, body, footer, size = "md", role = "dialog", onMount, onClose }) {
  const opener = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "app-modal-backdrop imst-backdrop open";
  const el = document.createElement("aside");
  el.className = `ap-dialog imst-dialog imst-dialog--${size}`;
  el.setAttribute("role", role);
  el.setAttribute("aria-modal", "true");
  const titleId = `imst-dlg-${Math.random().toString(36).slice(2, 8)}`;
  el.setAttribute("aria-labelledby", titleId);
  el.innerHTML = toString(html`
    <div class="ap-dialog-header">
      <h2 class="ap-dialog-title" id="${titleId}">${title}</h2>
      ${subtitle ? html`<span class="ap-dialog-subtitle">${subtitle}</span>` : ""}
    </div>
    <button type="button" class="ap-dialog-close" data-imst-dialog-close aria-label="Close">
      <i class="ap-icon-close" aria-hidden="true"></i>
    </button>
    <div class="ap-dialog-content imst-dialog__content" data-imst-dialog-body>${body}</div>
    ${footer ? html`<div class="ap-dialog-footer" data-imst-dialog-footer>${footer}</div>` : ""}
  `);
  document.body.append(backdrop, el);
  if (!open.length) document.addEventListener("keydown", onKey, true);

  let teardown = null;
  const api = {
    el,
    close() {
      if (!open.includes(api)) return;
      open = open.filter((d) => d !== api);
      if (!open.length) document.removeEventListener("keydown", onKey, true);
      teardown?.();
      backdrop.remove();
      el.remove();
      onClose?.();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    },
    setBody(fragment) {
      el.querySelector("[data-imst-dialog-body]").innerHTML = toString(fragment);
    },
    setFooter(fragment) {
      const node = el.querySelector("[data-imst-dialog-footer]");
      if (node) node.innerHTML = toString(fragment);
    },
  };
  open.push(api);
  backdrop.addEventListener("click", () => api.close());
  el.querySelector("[data-imst-dialog-close]").addEventListener("click", () => api.close());
  const result = onMount?.(el, api);
  if (typeof result === "function") teardown = result;
  requestAnimationFrame(() => {
    const target =
      el.querySelector("[autofocus]") || focusables(el).find((n) => !n.matches("[data-imst-dialog-close]"));
    (target || el).focus?.();
  });
  return api;
}

/** Closes every module dialog — the route cleanup calls it. */
export function closeAllDialogs() {
  [...open].reverse().forEach((d) => d.close());
}

/** Resolves true on confirm, false on cancel / Escape / backdrop. */
export function confirmDialog({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const dialog = openDialog({
      title,
      size: "sm",
      role: "alertdialog",
      body: html`<p class="ap-body imst-dialog__text">${body}</p>`,
      footer: html`
        <div class="ap-dialog-footer-right">
          <button type="button" class="ap-button stroked grey" data-imst-confirm="no">Cancel</button>
          <button type="button" class="ap-button ${danger ? "danger" : "primary blue"}" data-imst-confirm="yes">
            ${confirmLabel}
          </button>
        </div>
      `,
      onMount(el) {
        el.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-imst-confirm]");
          if (!btn) return;
          answered = true;
          resolve(btn.dataset.imstConfirm === "yes");
          dialog.close();
        });
      },
      onClose() {
        if (!answered) resolve(false);
      },
    });
  });
}
