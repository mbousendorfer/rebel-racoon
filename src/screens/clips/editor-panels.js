// The clip editor's two side panels (editor.js):
//   · the library, left — what you add or work from: the Transcript (words +
//     cleanup), Text (presets to click or drag onto the timeline), Brand;
//   · the inspector, right — the properties of what's selected: a text, a
//     framing part, the captions, a brand item; nothing
//     selected, the clip itself (its range, format, teaser).
// Both are HTML builders; editor.js owns the events (data-nle-* delegation).

import { ed, fmtTC, clipLen, selTexts, selSeg, capSourceHTML, ratio } from "./editor.js?v=2859";
import { autoKind, cameraShort } from "./editor-timeline.js?v=2859";
import { LAYOUTS, twoBlockedReason, cameraName } from "../../clip-framing.js?v=2859";
import { dsSelect, presetLabel } from "./shared.js?v=2859";
import * as ce from "../../caption-editor.js?v=2859";
import { escapeHtml } from "../../utils.js?v=2859";

// The few glyphs the DS doesn't ship (scissors, blade, magnet, speaker, frame
// steps, loop, in / out): drawn here on the DS's 16 px grid, in currentColor.
const svg = (d) => `<svg class="nle-glyph" viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
export const GLYPH = {
  cut: svg(`<circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><path d="M5.5 10.5 12 2M10.5 10.5 4 2"/>`),
  join: svg(`<path d="M2 8h4M10 8h4"/><path d="M4 5l3 3-3 3M12 5 9 8l3 3"/>`),
  blade: svg(`<path d="M10 2.5 13.5 6 6 13.5H2.5V10z"/><path d="M8 4.5 11.5 8"/>`),
  magnet: svg(`<path d="M4 2.5V8a4 4 0 0 0 8 0V2.5"/><path d="M4 5.5h2.5M9.5 5.5H12"/>`),
  volume: svg(`<path d="M2.5 6H5l3.5-3v10L5 10H2.5z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8"/>`),
  muted: svg(`<path d="M2.5 6H5l3.5-3v10L5 10H2.5z"/><path d="M11 6l3.5 4M14.5 6 11 10"/>`),
  stepBack: svg(`<path d="M4 3.5v9"/><path d="M12.5 3.5 6.5 8l6 4.5z"/>`),
  stepFwd: svg(`<path d="M12 3.5v9"/><path d="M3.5 3.5 9.5 8l-6 4.5z"/>`),
  toStart: svg(`<path d="M3 3.5v9"/><path d="M13 4 9 8l4 4M9 4 5 8l4 4"/>`),
  toEnd: svg(`<path d="M13 3.5v9"/><path d="M3 4l4 4-4 4M7 4l4 4-4 4"/>`),
  loop: svg(
    `<path d="M2.5 7.5v-1a2 2 0 0 1 2-2h8"/><path d="M10.5 2.5l2 2-2 2"/><path d="M13.5 8.5v1a2 2 0 0 1-2 2h-8"/><path d="M5.5 13.5l-2-2 2-2"/>`,
  ),
  text: svg(`<path d="M3 4.5V3h10v1.5M8 3v10M6 13h4"/>`),
  markIn: svg(`<path d="M7 3H4v10h3"/><path d="M10 5v6"/>`),
  markOut: svg(`<path d="M9 3h3v10H9"/><path d="M6 5v6"/>`),
};

// The text presets of the Text panel: click to add at the playhead, or drag
// onto the timeline. `at: "end"` lands on the clip's last seconds.
export const TEXT_PRESETS = [
  {
    id: "title",
    name: "Title",
    hint: "The clip's title, as a hook",
    text: (e) => e.w.title,
    style: "box",
    size: 64,
    y: 0.28,
    animIn: "pop",
  },
  {
    id: "heading",
    name: "Heading",
    hint: "Big and plain",
    text: () => "Your heading",
    style: "plain",
    size: 84,
    y: 0.2,
    animIn: "slide",
  },
  { id: "body", name: "Text", hint: "Boxed, mid-size", text: () => "Your text", style: "box", size: 52, y: 0.5 },
  {
    id: "lower",
    name: "Lower third",
    hint: "A name and a role",
    text: (e) => e.pb?.brandName || "Name · Role",
    style: "box",
    size: 40,
    y: 0.7,
    animIn: "slide",
  },
  {
    id: "cta",
    name: "Call to action",
    hint: "On the last 3 seconds",
    text: (e) => e.pb?.cta || "Follow for more",
    style: "box",
    size: 56,
    y: 0.82,
    at: "end",
    animIn: "pop",
  },
];

const sec = (title, body, extra = "") =>
  `<section class="nle-sec" ${extra}>${title ? `<h3 class="nle-sec__title">${title}</h3>` : ""}${body}</section>`;
const toggle = (attr, on, label) =>
  `<label class="ap-toggle-container nle-toggle"><input type="checkbox" ${attr} ${on ? "checked" : ""} /><i></i><span>${label}</span></label>`;
const tcField = (key, value, label) =>
  `<label class="nle-field"><span class="nle-field__label">${label}</span>
    <span class="ap-input-group nle-tcfield"><input type="text" data-nle-time="${key}" value="${value}" spellcheck="false" autocomplete="off" aria-label="${label}" /></span></label>`;
const btn = (act, label, { icon = "", cls = "stroked grey", kbd = "" } = {}) =>
  `<button type="button" class="ap-button ${cls}" data-nle="${act}"${kbd ? ` data-tooltip="${kbd}"` : ""}>${icon}<span>${label}</span></button>`;

// ── Library ─────────────────────────────────────────────────────────

export function libraryHTML() {
  const tab = (id, label) =>
    `<button type="button" class="ap-tabs-tab${ed.lib === id ? " active" : ""}" role="tab" aria-selected="${ed.lib === id}" data-nle-lib-tab="${id}">${label}</button>`;
  const body = { transcript: transcriptLib, text: textLib, brand: brandLib }[ed.lib]();
  return `<div class="ap-tabs nle-lib__tabs"><div class="ap-tabs-nav" role="tablist" aria-label="Library">
      ${tab("transcript", "Transcript")}${tab("text", "Text")}${tab("brand", "Brand")}
    </div></div>
    <div class="nle-lib__body" role="tabpanel">${body}</div>`;
}

function transcriptLib() {
  return `
    <p class="nle-lead">Click a word to jump to it. Double-click it to fix it.</p>
    <span class="nle-fact" data-ce-reconcile></span>
    <div class="nle-clean" data-ce-cleanup-list></div>
    <details class="nle-legend">
      <summary class="nle-legend__toggle"><i class="ap-icon-chevron-right" aria-hidden="true"></i><span>What the marks mean</span></summary>
      <ul class="nle-legend__list" aria-label="What the marks in the transcript mean" data-ce-legend>
        <li><span class="cap-ed-tword is-active">word</span>Playing now</li>
        <li><span class="cap-ed-tword is-marked is-mark-font">word</span>Colored</li>
        <li><span class="cap-ed-tword is-marked is-mark-h1">word</span>Highlight</li>
        <li><span class="cap-ed-tword is-filler">um</span>Filler</li>
        <li><span class="cap-ed-pause is-proposed">0.5s</span>Pause</li>
        <li><span class="cap-ed-tword is-removed">word</span>Hidden</li>
      </ul>
    </details>
    <div class="cap-ed__transcript nle-words" data-ce-transcript></div>`;
}

function textLib() {
  const cards = TEXT_PRESETS.map((p) => {
    const sample = p.text(ed);
    return `<button type="button" class="nle-preset" draggable="true" data-nle-text-preset="${p.id}"
      aria-label="Add ${escapeHtml(p.name)} at the playhead" data-tooltip="Click to add at the playhead, or drag to the timeline">
      <span class="nle-preset__well" aria-hidden="true">
        <span class="nle-text nle-text--${p.style} nle-preset__sample" style="top:${p.y * 100}%;font-size:${Math.round(p.size / 5)}px">${escapeHtml(sample.length > 28 ? `${sample.slice(0, 26)}…` : sample)}</span>
      </span>
      <span class="nle-preset__name">${escapeHtml(p.name)}</span>
      <span class="nle-preset__hint">${escapeHtml(p.hint)}</span>
    </button>`;
  }).join("");
  const list = [...ed.w.texts].sort((a, b) => a.startMs - b.startMs);
  const sel = new Set(selTexts().map((t) => t.id));
  return `
    <p class="nle-lead">Click a style to add it at the playhead, or drag it to the timeline.</p>
    <div class="nle-presets">${cards}</div>
    ${sec(
      `In this clip <span class="nle-count">${list.length}</span>`,
      list.length
        ? `<ul class="nle-list">${list
            .map(
              (
                t,
              ) => `<li><button type="button" class="nle-list__item${sel.has(t.id) ? " is-selected" : ""}" data-nle-pick-text="${t.id}">
                <span class="nle-list__name">${escapeHtml(t.text)}</span><span class="nle-list__meta">${fmtTC(t.startMs)}</span></button></li>`,
            )
            .join("")}</ul>`
        : `<p class="nle-hint">No text in this clip yet.</p>`,
    )}`;
}

function brandLib() {
  const b = ed.w.brand;
  const pb = ed.pb;
  if (!pb) return `<p class="nle-lead">This video has no Playbook, so there's no logo or brand card to add.</p>`;
  const row = (key, label, desc, enabled = true) => `
    <div class="nle-brandrow">
      ${toggle(`data-nle-brand="${key}" ${enabled ? "" : "disabled"}`, b[key] && enabled, label)}
      <p class="nle-hint">${desc}</p>
      ${b[key] && enabled ? `<button type="button" class="ap-button ghost grey" data-nle-select="brand:${key}"><span>Edit ${label.toLowerCase().replace(" on the video", "")}</span></button>` : ""}
    </div>`;
  const fromPb = JSON.stringify(b) === JSON.stringify(ed.look.brand);
  return `
    <p class="nle-lead">From the ${escapeHtml(pb.name)} Playbook. What you change here applies to this clip only.</p>
    ${row("logo", "Logo on the video", pb.brandLogo ? "In a corner, out of the network's buttons." : "This Playbook has no logo yet.", !!pb.brandLogo)}
    ${row("intro", "Intro card", "2 seconds before the clip, with the clip's title.")}
    ${row("outro", "Outro card", "2 seconds after the clip, with your call to action.")}
    <div class="nle-row">
      ${fromPb ? "" : btn("brand-reset", "Reset to the Playbook's look", { icon: `<i class="ap-icon-reset" aria-hidden="true"></i>`, cls: "ghost grey" })}
      <a class="ap-link" href="#/playbook/${encodeURIComponent(pb.id)}?tab=brand">Open the Playbook</a>
    </div>`;
}

// ── Inspector ───────────────────────────────────────────────────────

const HEAD = {
  clip: ["ap-icon-video", "Clip"],
  text: ["", "Text"],
  seg: ["ap-icon-cropper", "Framing"],
  captions: ["ap-icon-closed-captions", "Subtitles"],
  brand: ["ap-icon-target", "Brand"],
};

export function inspectorHTML() {
  const kind = ed.sel?.kind || "clip";
  const body = {
    clip: clipInsp,
    text: textInsp,
    seg: segInsp,
    captions: captionsInsp,
    brand: brandInsp,
  }[kind]();
  const [icon, label] = HEAD[kind];
  const glyph = icon ? `<i class="${icon}" aria-hidden="true"></i>` : GLYPH.text;
  const title = kind === "text" && ed.sel.ids.length > 1 ? `${ed.sel.ids.length} texts` : label;
  return `<header class="nle-insp__head">
      <span class="nle-insp__icon">${glyph}</span>
      <h2 class="nle-insp__title">${title}</h2>
      ${kind !== "clip" ? `<button type="button" class="ap-icon-button transparent nle-ib" data-nle="deselect" aria-label="Back to the clip" data-tooltip="Back to the clip · Esc"><i class="ap-icon-close" aria-hidden="true"></i></button>` : ""}
    </header>
    <div class="nle-insp__body">${body}</div>`;
}

function clipInsp() {
  const tz = ed.w.teaser;
  const off = tz.on ? "" : "disabled";
  // Range first (what the clip is), then its subtitles, then the teaser. The
  // format is the viewer's Format select: one place for it.
  return `
    ${sec(
      "Range",
      `<dl class="nle-facts">
        <div><dt>Starts at</dt><dd>${fmtTC(ed.w.startMs)}</dd></div>
        <div><dt>Ends at</dt><dd>${fmtTC(ed.w.endMs)}</dd></div>
        <div><dt>Length</dt><dd>${fmtTC(clipLen())}</dd></div>
      </dl>
      <p class="nle-hint">In the source video. Drag the clip's edges on the timeline to trim it.</p>
      <div class="nle-row">${btn("set-in", "Set start", { kbd: "At the playhead · I", icon: GLYPH.markIn })}${btn("set-out", "Set end", { kbd: "At the playhead · O", icon: GLYPH.markOut })}</div>`,
    )}
    ${sec(
      "Subtitles",
      `<dl class="nle-facts nle-facts--one"><div><dt>Style</dt><dd>${escapeHtml(presetLabel(ce.getState()?.presetId))}${ed.capOwn ? " · this clip's own" : " · the video's"}</dd></div></dl>
      <div class="nle-row"><button type="button" class="ap-button stroked grey" data-nle-select="captions"><span>Edit subtitles</span></button></div>`,
    )}
    ${sec(
      "Teaser",
      `${toggle("data-nle-teaser", tz.on, "Open with a teaser")}
      <p class="nle-hint">A short moment plays first, then the whole clip.</p>
      ${
        tz.on
          ? `<dl class="nle-facts">
              <div><dt>From</dt><dd>${fmtTC(tz.startMs)}</dd></div>
              <div><dt>To</dt><dd>${fmtTC(tz.endMs)}</dd></div>
              <div><dt>Video length</dt><dd>${fmtTC(clipLen() + tz.endMs - tz.startMs)}</dd></div>
            </dl>
            <div class="nle-row">
              <button type="button" class="ap-button stroked grey" data-nle="teaser-start" data-tooltip="At the playhead" ${off}><span>Set start</span></button>
              <button type="button" class="ap-button stroked grey" data-nle="teaser-end" data-tooltip="At the playhead" ${off}><span>Set end</span></button>
              <button type="button" class="ap-button ghost grey" data-nle="teaser-play" ${off}><i class="ap-icon-play" aria-hidden="true"></i><span>Play teaser</span></button>
            </div>`
          : ""
      }`,
    )}`;
}

const ANIMS = [
  ["none", "None"],
  ["fade", "Fade"],
  ["pop", "Pop"],
  ["slide", "Slide up"],
];

function textInsp() {
  const ts = selTexts();
  const one = ts.length === 1 ? ts[0] : null;
  const first = ts[0];
  const same = (k) => ts.every((t) => t[k] === first[k]);
  const anim = (key, label) =>
    dsSelect({
      label,
      valueHtml: same(key) ? ANIMS.find(([id]) => id === (first[key] || "none"))?.[1] || "None" : "Mixed",
      current: same(key) ? `${key}:${first[key] || "none"}` : "",
      attr: "data-nle-anim",
      ariaLabel: `${label} animation`,
      extraClass: "nle-select nle-select--block",
      options: ANIMS.map(([id, name]) => ({ id: `${key}:${id}`, label: name })),
    });
  const style = same("style") ? first.style : null;
  const radio = (st, label) => `<label class="nle-radio">
      <span class="ap-radio-container"><input type="radio" name="nle-tx-style" data-nle-text-style="${st}" ${style === st ? "checked" : ""} /></span>
      <span>${label}</span></label>`;
  return `
    ${one ? sec("Text", `<div class="ap-textarea-field"><textarea rows="3" data-nle-field="text" aria-label="Text">${escapeHtml(one.text)}</textarea></div>`) : ""}
    ${sec(
      "Look",
      `<div class="nle-radios" role="radiogroup" aria-label="Style">${radio("box", "Boxed")}${radio("plain", "Plain")}</div>
      <label class="nle-field nle-field--slider"><span class="nle-field__label">Size <span class="nle-val" data-nle-val="size">${first.size}</span></span>
        <input type="range" class="ap-slider" min="24" max="160" step="2" value="${first.size}" data-nle-field="size"
          style="--fill:${((first.size - 24) / 136) * 100}%" aria-label="Size" /></label>`,
    )}
    ${
      one
        ? sec(
            "Position",
            `<div class="nle-grid2">
              <label class="nle-field"><span class="nle-field__label">X %</span><span class="ap-input-group nle-num"><input type="number" min="0" max="100" step="1" value="${Math.round(one.x * 100)}" data-nle-field="x" aria-label="Horizontal position, in percent" /></span></label>
              <label class="nle-field"><span class="nle-field__label">Y %</span><span class="ap-input-group nle-num"><input type="number" min="0" max="100" step="1" value="${Math.round(one.y * 100)}" data-nle-field="y" aria-label="Vertical position, in percent" /></span></label>
            </div>
            <div class="nle-row">${btn("center-x", "Center horizontally", { cls: "ghost grey" })}${btn("center-y", "Center vertically", { cls: "ghost grey" })}</div>
            <p class="nle-hint">Drag the text on the video to move it, or a corner to resize it. ⌥ + arrows nudge it.</p>`,
          )
        : ""
    }
    ${
      one
        ? sec(
            "Timing",
            `<div class="nle-grid3">${tcField("in", fmtTC(one.startMs), "In")}${tcField("out", fmtTC(one.endMs), "Out")}${tcField("dur", fmtTC(one.endMs - one.startMs), "Duration")}</div>
            <p class="nle-hint">Times in the clip. You can also drag the text and its edges on the Text track.</p>`,
          )
        : ""
    }
    ${sec("Animation", `<div class="nle-grid2">${anim("animIn", "In")}${anim("animOut", "Out")}</div>`)}
    <div class="nle-insp__foot">
      ${btn("duplicate", ts.length > 1 ? "Duplicate texts" : "Duplicate text", { kbd: "⌘D", icon: `<i class="ap-icon-copy" aria-hidden="true"></i>`, cls: "ghost grey" })}
      ${btn("delete", ts.length > 1 ? "Delete texts" : "Delete text", { kbd: "⌫", icon: `<i class="ap-icon-trash" aria-hidden="true"></i>`, cls: "ghost grey" })}
    </div>`;
}

function segInsp() {
  const seg = selSeg();
  if (!seg) return "";
  const segs = ed.w.segments;
  const i = segs.indexOf(seg);
  const r = ratio();
  const blocked = twoBlockedReason(ed.ctx, seg, r);
  const hints = {
    AUTO: `I chose ${autoKind(seg)}`,
    ONE: "One window",
    TWO: "Stacked",
    FIT: "Whole frame, blurred fill",
  };
  const glyph = {
    AUTO: `<i class="ap-icon-sparkles"></i>`,
    ONE: `<b class="nle-layout__person"></b>`,
    TWO: `<b class="nle-layout__person"></b><b class="nle-layout__person"></b>`,
    FIT: `<b class="nle-layout__inset"></b>`,
  };
  const cards = LAYOUTS.map((l) => {
    const off = l.id === "TWO" && blocked && seg.layout !== "TWO";
    return `<label class="ap-radio-card card nle-layout${off ? " is-off" : ""}">
      <input type="radio" name="nle-layout" value="${l.id}" data-nle-layout-pick ${seg.layout === l.id ? "checked" : ""} ${off ? "disabled" : ""} />
      <div>
        <span class="nle-layout__glyph nle-layout__glyph--${l.id.toLowerCase()}" aria-hidden="true">${glyph[l.id]}</span>
        <span class="nle-layout__name">${l.label}</span>
        <span class="nle-layout__hint">${escapeHtml(off ? blocked : hints[l.id])}</span>
      </div>
    </label>`;
  }).join("");
  const gesture =
    seg.layout === "TWO"
      ? "On the Source, drag a window to move it, or a corner to zoom it."
      : "On the Source, drag the window to move it, or a corner to zoom.";
  return `
    ${sec(
      `Part ${i + 1} of ${segs.length}`,
      `<div class="nle-tags"><span class="ap-tag grey">${escapeHtml(cameraName(seg.camera))}</span><span class="ap-tag grey">${seg.origin === "USER" ? "Yours" : "Auto"}</span></div>
      <dl class="nle-facts">
        <div><dt>From</dt><dd>${fmtTC(seg.startMs - ed.w.startMs)}</dd></div>
        <div><dt>To</dt><dd>${fmtTC(seg.endMs - ed.w.startMs)}</dd></div>
        <div><dt>Shot</dt><dd>${escapeHtml(cameraShort(seg.camera))}</dd></div>
      </dl>
      <p class="nle-hint">I cut the clip in parts, one per camera shot, and framed each one. ${gesture}</p>`,
    )}
    ${sec(
      "Layout",
      `<div class="nle-layouts" role="radiogroup" aria-label="Layout">${cards}</div>
      ${seg.layout === "TWO" ? `<button type="button" class="ap-button stroked grey" data-nle="swap" ${r < 1 ? "" : "disabled"}><i class="ap-icon-refresh" aria-hidden="true"></i><span>Swap top and bottom</span></button>` : ""}`,
    )}
    ${sec(
      "Parts",
      `<div class="nle-row">
        ${btn("join-prev", "Join previous part", { cls: "ghost grey" }).replace("<button", i > 0 ? "<button" : "<button disabled")}
        ${btn("join-next", "Join next part", { cls: "ghost grey" }).replace("<button", i < segs.length - 1 ? "<button" : "<button disabled")}
      </div>
      <p class="nle-hint">To split a part, press S at the playhead, or use the split tool (B) on the Video track.</p>`,
    )}
    <div class="nle-insp__foot">
      ${seg.origin === "USER" ? btn("reset-seg", "Reset part", { icon: `<i class="ap-icon-reset" aria-hidden="true"></i>`, cls: "ghost grey" }) : ""}
      ${btn("reset-all", "Reset all parts", { icon: `<i class="ap-icon-reset" aria-hidden="true"></i>`, cls: "ghost grey" })}
    </div>`;
}

function captionsInsp() {
  return `
    <div class="nle-capsrc" data-nle-cap-source>${capSourceHTML()}</div>
    <p class="nle-hint">Drag the subtitles on the video to place them. Their words are in the Transcript tab.</p>
    ${ce.tabsHTML()}
    <div class="cap-ed__tabpanel nle-captabs" data-ce-tabpanel></div>`;
}

function brandInsp() {
  const b = ed.w.brand;
  const item = ed.sel.item;
  if (item === "logo") {
    const corners = [
      ["tl", "Top left"],
      ["tr", "Top right"],
      ["bl", "Bottom left"],
      ["br", "Bottom right"],
    ];
    return `${sec(
      "Logo",
      `${dsSelect({
        label: "Corner",
        valueHtml: escapeHtml(corners.find(([id]) => id === b.corner)?.[1] || "Top right"),
        current: b.corner,
        attr: "data-nle-corner",
        extraClass: "nle-select nle-select--block",
        options: corners.map(([id, label]) => ({ id, label })),
      })}
      <label class="nle-field nle-field--slider"><span class="nle-field__label">Size <span class="nle-val" data-nle-logo-size-val>${Math.round(b.logoSize * 100)}%</span></span>
        <input type="range" class="ap-slider" min="0.08" max="0.3" step="0.01" value="${b.logoSize}" data-nle-logo-size
          style="--fill:${((b.logoSize - 0.08) / 0.22) * 100}%" aria-label="Logo size" /></label>
      <p class="nle-hint">It stays out of the zones the network's buttons cover.</p>`,
    )}
    <div class="nle-insp__foot">${btn("delete", "Remove logo", { cls: "ghost grey", icon: `<i class="ap-icon-trash" aria-hidden="true"></i>` })}</div>`;
  }
  const intro = item === "intro";
  return `${sec(
    intro ? "Intro card" : "Outro card",
    `<p class="nle-hint">${intro ? "Plays for 2 seconds before the clip: your logo and the clip's title, on your brand color." : "Plays for 2 seconds after the clip: your logo and your call to action."}</p>
    `,
  )}
  <div class="nle-insp__foot">${btn("delete", intro ? "Remove intro card" : "Remove outro card", { cls: "ghost grey", icon: `<i class="ap-icon-trash" aria-hidden="true"></i>` })}</div>`;
}
