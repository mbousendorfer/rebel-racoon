// Image Generator — a dropzone that really accepts a drop (DS port .ap-dropzone,
// from ds-patches). Markup + binding; the module's own copy of the pattern.

import { html } from "../lib/html.js?v=1237";

export function dropzone({ id, title, sub, accept = "image/*", multiple = true, compact = false }) {
  return html`
    <div
      class="ap-dropzone${compact ? " ap-dropzone--compact" : ""}"
      data-imst-dropzone="${id}"
      role="button"
      tabindex="0"
      aria-label="${title} — browse files"
    >
      <span class="ap-dropzone__icon"><i class="ap-icon-upload" aria-hidden="true"></i></span>
      <span class="ap-dropzone__text">
        <span class="ap-dropzone__title">${title} <span class="ap-dropzone__browse">browse</span></span>
        ${sub ? html`<span class="ap-dropzone__sub">${sub}</span>` : ""}
      </span>
      <input type="file" accept="${accept}" ${multiple ? "multiple" : ""} hidden data-imst-dropzone-input />
    </div>
  `;
}

/** Wires every [data-imst-dropzone] under root. onFiles(id, File[]). Returns off(). */
export function bindDropzones(root, onFiles) {
  const zoneOf = (t) => (t instanceof Element ? t.closest("[data-imst-dropzone]") : null);
  const click = (e) => {
    const zone = zoneOf(e.target);
    if (!zone || e.target.matches("input")) return;
    zone.querySelector("[data-imst-dropzone-input]")?.click();
  };
  const key = (e) => {
    const zone = zoneOf(e.target);
    if (zone && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      zone.querySelector("[data-imst-dropzone-input]")?.click();
    }
  };
  const change = (e) => {
    if (!e.target.matches("[data-imst-dropzone-input]")) return;
    const zone = zoneOf(e.target);
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length) onFiles(zone.dataset.imstDropzone, files);
  };
  const over = (e) => {
    const zone = zoneOf(e.target);
    if (!zone) return;
    e.preventDefault();
    zone.classList.add("is-dragover");
  };
  const leave = (e) => zoneOf(e.target)?.classList.remove("is-dragover");
  const drop = (e) => {
    const zone = zoneOf(e.target);
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("is-dragover");
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) onFiles(zone.dataset.imstDropzone, files);
  };
  const pairs = [
    ["click", click],
    ["keydown", key],
    ["change", change],
    ["dragover", over],
    ["dragleave", leave],
    ["drop", drop],
  ];
  pairs.forEach(([t, fn]) => root.addEventListener(t, fn));
  return () => pairs.forEach(([t, fn]) => root.removeEventListener(t, fn));
}
