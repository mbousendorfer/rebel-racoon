// Image Studio — a near-fullscreen modal that generates an image for a draft and
// hands it back. Two peer modes, Generate and Edit.
//
// This file is the lifecycle and nothing else: inject the shell once, open on a
// draft, subscribe, render, close. Everything the user does is elsewhere.
//
//   Module map
//     context.js        MODAL_ID / KEY / ctx / state() / FRAME_SEL / autosize
//     stage-view.js     the shell: header, stage states, variations rail, footer
//     composer-view.js  the bottom composer — the brief in Generate, the note in Edit
//     settings-view.js  the settings panel: the seven rows beside the image
//     references-view.js  ─┐ two of those rows, each with real internal structure
//     branding-view.js    ─┘
//     tools-view.js     Edit mode's floating tool palette + its one flyout
//     edit-view.js      the edit canvas: overlays, crop box, text mini-toolbar
//     events.js         every delegated listener
//     commit.js         the paths that write to the draft
//     inline-text.js    the code that patches the DOM instead of re-rendering
//     interactions.js   file pickers + on-canvas pointer gestures
//   Plus two modules outside this directory:
//     src/image-studio.js         the state engine — UI-agnostic, all the mocks
//     src/image-studio-canvas.js  pure canvas helpers (bake / crop / text metrics)
//
// State lives entirely in the engine, keyed by KEY, and every mutation notifies
// back into renderBody() — so the render path is one-way and the whole body is
// rebuilt on any change. The exceptions, and why they have to exist, are in
// inline-text.js.

import { requestOpen, notifyClose, bindOverlayDismissal } from "../../modal-coordinator.js?v=22";
import { getPosts } from "../../posts-store.js?v=46";
import { getSessionById } from "../../sessions-store.js?v=16";
import { getContextById } from "../../contexts-store.js?v=48";
import { MODAL_ID, KEY, ctx, state, autosize } from "./context.js?v=42";
import { loadImg } from "../../image-studio-canvas.js?v=6";
import { renderStudio } from "./stage-view.js?v=97";
import { offerUndoIfNeeded, resetUndoOffers } from "./prompt-guard.js?v=6";
import { bindStudioEvents } from "./events.js?v=19";
import * as imageStudio from "../../image-studio.js?v=86";

let backdrop;
let initialized = false;
// Where the card grid was scrolled to, kept across the renders where it isn't
// mounted (see renderBody). Reset on open, so a new draft starts at the top.
let lastGridScroll = 0;
let unsub = null;

const HTML = `
<div class="app-modal-backdrop isv2-backdrop" id="isv2Backdrop" hidden></div>
<aside
  class="ap-dialog isv2-modal"
  id="isv2Modal"
  role="dialog"
  aria-modal="true"
  aria-label="Generate an image"
  aria-hidden="true"
>
  <button class="ap-dialog-close isv2-close" type="button" data-img-close aria-label="Close">
    <i class="ap-icon-close"></i>
  </button>
  <div class="isv2-body" id="isv2Body"></div>
</aside>`;

function renderBody() {
  const st = state();
  if (!st || !ctx.body) return;
  // The whole body is rebuilt on every state change, which resets scrollTop to 0.
  // The grid-brief variant is a tall scroll surface, so clicking a card near the
  // bottom (which reassembles the prompt → re-render) would snap the view to the
  // top. Carry the grid's scroll position across the swap.
  //
  // Remembered in a module variable rather than read-then-restored in the same pass,
  // because a reassemble puts the full-stage loader in between: the grid unmounts,
  // and the render that brings it back has no previous grid to read a position from.
  // Editing a card near the bottom would otherwise return you to the top.
  const scroller = ctx.body.querySelector(".isv2-stage-body.has-grid");
  if (scroller) lastGridScroll = scroller.scrollTop;
  ctx.body.innerHTML = renderStudio(st);
  const nextScroller = ctx.body.querySelector(".isv2-stage-body.has-grid");
  if (nextScroller) nextScroller.scrollTop = lastGridScroll;
  // Both composer fields auto-grow to whatever text carried over: the derived
  // brief on open, and anything typed before a re-render.
  autosize(ctx.body.querySelector("[data-img-prompt]"));
  autosize(ctx.body.querySelector("[data-img-edit-prompt]"));
  // A rewrite that replaced hand-written text offers one step back. It has to be
  // read off the render pass — see prompt-guard.js#offerUndoIfNeeded.
  offerUndoIfNeeded(st);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function init() {
  if (initialized) return;
  initialized = true;
  document.body.insertAdjacentHTML("beforeend", HTML);
  backdrop = document.getElementById("isv2Backdrop");
  ctx.modal = document.getElementById("isv2Modal");
  ctx.body = document.getElementById("isv2Body");
  bindStudioEvents({ modal: ctx.modal, close });
  // `isOpen` doubles as a veto: while the prompt guard is up, Escape and a
  // backdrop click must NOT close the studio — that would answer "you'll lose your
  // prompt" by throwing away the whole session. The guard has its own Escape (see
  // events.js#onGuardKeydown) and swallows clicks (events.js#onClick).
  bindOverlayDismissal({
    modal: ctx.modal,
    backdrop,
    close,
    isOpen: () => ctx.modal.classList.contains("open") && !state()?.pendingSettingChange,
  });
}

export function open(postId, opts = {}) {
  if (!initialized) init();
  requestOpen(MODAL_ID, close);
  lastGridScroll = 0;
  ctx.postId = postId || null;
  ctx.sessionId = opts.sessionId || null;

  // Resolve the draft's network so the format options + default match where the
  // image will publish (a LinkedIn draft defaults to LinkedIn's ratio).
  const post = ctx.sessionId ? getPosts(ctx.sessionId).find((p) => p.id === ctx.postId) : null;
  // carouselUrls reopens an existing carousel in the results view (add / remove /
  // regenerate slides) — that is what "Edit slides" on a multi-slide draft does.
  // editImageUrl opens straight into Edit mode on a single existing image; it is
  // supported here but currently has no UI entry point, because a single image's
  // hover bar offers Change / Remove rather than an Edit that opens the studio.
  // Otherwise: the generate flow.
  const editImageUrl = opts.editImageUrl || null;
  const carouselUrls = Array.isArray(opts.carouselUrls) && opts.carouselUrls.length > 1 ? opts.carouselUrls : null;
  // Pull the session's Playbook brand reference images so generation stays
  // on-brand — the user can add their own or toggle the Playbook set off.
  const session = ctx.sessionId ? getSessionById(ctx.sessionId) : null;
  const context = session?.contextId ? getContextById(session.contextId) : null;
  imageStudio.start(KEY, {
    postId: ctx.postId,
    // The draft's copy — what "Suggest from this post" writes the brief from, so
    // the prompt Archie proposes is genuinely about this post.
    postText: Array.isArray(post?.text) ? post.text.join("\n") : post?.text || "",
    network: post?.network || null,
    formatId: post?.format || null,
    editImage: editImageUrl ? { url: editImageUrl } : null,
    carousel: carouselUrls ? { urls: carouselUrls } : null,
    // The default mark (what the Branding switch stamps) and the full set (what
    // Edit mode's "Add an image" offers) — see contexts-store#normalizeBrandLogos.
    playbookLogo: context?.brandLogo || "",
    playbookLogos: Array.isArray(context?.brandLogos) ? context.brandLogos : [],
    playbookRefs: context?.referenceImages || [],
    playbookName: context?.brandName || context?.name || "",
    playbookColors: (Array.isArray(context?.brandColors) ? context.brandColors : []).filter((c) => c && c.hex),
  });
  resetUndoOffers();
  if (unsub) unsub();
  unsub = imageStudio.subscribe(KEY, renderBody);

  backdrop.hidden = false;
  backdrop.classList.add("open");
  ctx.modal.classList.add("open");
  ctx.modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-modal");

  renderBody();
  if (editImageUrl) {
    // Refine the working-image dims from the real image so the frame ratio and
    // the overlay bake match it (start() used a format-based guess).
    loadImg(editImageUrl)
      .then((img) => imageStudio.setEditImageDims(KEY, img.naturalWidth, img.naturalHeight))
      .catch(() => {});
  } else if (ctx.postId && !carouselUrls) {
    imageStudio.runDerive(KEY);
  }
}

function close() {
  if (!initialized) return;
  if (unsub) {
    unsub();
    unsub = null;
  }
  imageStudio.exit(KEY);
  ctx.modal.classList.remove("open");
  backdrop.classList.remove("open");
  backdrop.hidden = true;
  ctx.modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-modal");
  ctx.postId = null;
  ctx.sessionId = null;
  notifyClose(MODAL_ID);
}
