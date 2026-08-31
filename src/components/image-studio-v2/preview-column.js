// Image Studio — the preview half: one column, four states, two hosts.
//
// The result JOINS the options rather than replacing them. Generating used to swap the
// entire screen for the classic canvas — a different layout, different controls, and
// the settings you had just been using gone. Keeping the left half and adding the
// picture beside it means ONE interface for the whole loop: set the options, look at
// what they produced, change one, regenerate.
//
// Which is why this column is rendered from the FIRST frame, empty state and all: a
// half that appears out of nowhere when the first image lands reflows everything the
// user was reading. Same reason the thumbnail strip is rendered while empty — letting
// it appear with the second variation resized the shot box the moment the image
// arrived, a layout change by the back door.
//
// Two hosts, and they must show the same picture the same way:
//   brief-stage.js  (imageStudioAutoBrief) — beside the brief
//   setup-stage.js  (imageStudioSetupFirst) — beside the options
// The classic variant does NOT use this: it centres the image in the whole stage with
// a pinned variations rail (stage-view.js#resultsStage).

import { escapeHtml } from "../../utils.js?v=22";
import { NETWORK_LABEL, NETWORK_ICON_BY_PLATFORM } from "../../social-profiles.js?v=46";
import { getPosts } from "../../posts-store.js?v=52";
import { renderPostCard } from "../post-card.js?v=99";
import { KEY, ctx } from "./context.js?v=50";
import * as imageStudio from "../../image-studio.js?v=104";

// Image ↔ in-feed. It lives in the preview's own header because it changes what the
// PREVIEW shows and nothing else — centred over the whole stage it read as modal chrome
// and sat a half-modal away from its effect. Switching it no longer leaves the split
// either: the preview simply holds the post card instead of the bare image.
function previewToggle(st, disabled) {
  const feed = st.canvasView === "feed";
  const off = disabled ? "disabled" : "";
  const netIcon = st.network ? NETWORK_ICON_BY_PLATFORM[st.network] || "ap-icon-image" : "ap-icon-image";
  const netLabel = st.network ? NETWORK_LABEL[st.network] || st.network : "your feed";
  return `<div class="isv2-viewseg isv2-bs-viewseg" role="group" aria-label="Preview view">
    <button type="button" class="ap-filter-chip" data-img-view="image" aria-pressed="${!feed}" ${off}><i class="ap-icon-image" aria-hidden="true"></i>Image</button>
    <button type="button" class="ap-filter-chip" data-img-view="feed" aria-pressed="${feed}" title="Preview on ${escapeHtml(netLabel)}" ${off}><i class="${netIcon}" aria-hidden="true"></i>In feed</button>
  </div>`;
}

// The in-feed take: the same post the studio was opened on, carrying this image.
function feedCard(st) {
  const post = ctx.sessionId && ctx.postId ? getPosts(ctx.sessionId).find((p) => p.id === ctx.postId) : null;
  const base = post || {
    id: ctx.postId || "preview",
    author: { name: "You", title: "", initials: "YO", connection: "1st", visibility: "public" },
    network: st.network || "linkedin",
    status: "ready",
    timeLabel: "now",
    text: ["Your post text will appear here."],
    hashtags: [],
    cta: "",
    stats: { likes: 0, comments: 0, reposts: 0 },
  };
  const urls = st.variations.map((v) => v.url);
  const media =
    st.outputMode === "carousel"
      ? { imageUrl: urls[0] || null, carousel: urls }
      : { imageUrl: urls[st.selectedIndex ?? 0] || null, carousel: null };
  return `<div class="isv2-bs-feed">${renderPostCard({ ...base, clipRef: null, isRegenerating: false, ...media })}</div>`;
}

// No per-host parameters: both variants keep their options on the left, so the empty
// state's "on the left" points at the right place in both. The day a host needs to word
// something differently, that is the moment to add the option — not before.
export function previewColumn(st) {
  const ratio = imageStudio.activeRatio(KEY);
  if (st.genPhase !== "generating" && !st.variations.length) {
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st, true)}
      </div>
      <div class="isv2-bs-shot is-empty" style="aspect-ratio:${ratio}">
        <i class="ap-icon-image" aria-hidden="true"></i>
        <p class="isv2-bs-empty-title">Your image appears here</p>
        <p class="isv2-bs-empty-sub">Set the options on the left, then generate.</p>
      </div>
      <div class="isv2-bs-thumbs" aria-hidden="true"></div>
    </div>`;
  }
  if (st.genPhase === "generating") {
    const n = st.outputMode === "carousel" ? st.slideCount : st.variationCount;
    const what = st.outputMode === "carousel" ? "slide" : "variation";
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st, true)}
      </div>
      <div class="isv2-bs-shot is-busy" style="aspect-ratio:${ratio}" role="status">
        <span class="gen-image-spinner"></span>
        <span class="isv2-bs-shot-label">Generating ${n} ${what}${n > 1 ? "s" : ""}…</span>
      </div>
      <div class="isv2-bs-thumbs" aria-hidden="true"></div>
    </div>`;
  }
  const i = st.selectedIndex ?? 0;
  const shot = st.variations[i];
  if (!shot) return "";
  if (st.canvasView === "feed") {
    return `<div class="isv2-bs-preview">
      <div class="isv2-bs-preview-head">
        <p class="isv2-bs-eyebrow">Preview</p>
        ${previewToggle(st)}
      </div>
      ${feedCard(st)}
    </div>`;
  }
  const thumbs =
    st.variations.length > 1
      ? `<div class="isv2-bs-thumbs" role="group" aria-label="Variations">
          ${st.variations
            .map(
              (v, n) =>
                `<button type="button" class="isv2-bs-thumb${n === i ? " is-on" : ""}" data-img-variation="${n}" aria-pressed="${n === i}" aria-label="Variation ${n + 1}">
                  <img src="${escapeHtml(v.url)}" alt="" loading="lazy" />
                </button>`,
            )
            .join("")}
        </div>`
      : `<div class="isv2-bs-thumbs" aria-hidden="true"></div>`;
  // Changed the brief or an option since this was made? Say so ON the image, with the
  // fix attached: the picture is the thing that has gone out of date, so the prompt to
  // redo it belongs there rather than in a footer the eye has already left.
  const stale = imageStudio.previewStale(st);
  const restale = stale
    ? `<div class="isv2-bs-stale">
        <p class="isv2-bs-stale-note">The brief changed since this image.</p>
        <button type="button" class="ap-button primary blue" data-img-generate>
          <i class="ap-icon-refresh"></i><span>Regenerate</span>
        </button>
      </div>`
    : "";
  return `<div class="isv2-bs-preview">
    <div class="isv2-bs-preview-head">
      <p class="isv2-bs-eyebrow">Preview</p>
      ${previewToggle(st)}
    </div>
    <div class="isv2-bs-shot${stale ? " is-stale" : ""}" style="aspect-ratio:${ratio}">
      <img src="${escapeHtml(shot.url)}" alt="Generated image" />
      ${restale}
    </div>
    ${thumbs}
  </div>`;
}
