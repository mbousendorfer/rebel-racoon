// Image Studio — the paths that leave the studio, and the ones that ask for a
// new image.
//
// Overlays (added text, the stamped logo) stay LIVE and editable as DOM right up
// to the moment of commit — there is no per-edit "Apply". So committing is where
// they get flattened into the pixels, by the same `compositeOverlays` the in-feed
// preview and "Text in image" use. Two destinations:
//
//   Use this image      → attachImageToDraft, then close
//   Apply to slide N    → bake back into that carousel slide and stay open,
//                         because the set isn't finished yet
//
// Every function here calls syncEditingText() first: a click can steal focus from
// a contenteditable before its last `input` event fires, so the in-flight text
// edit has to be folded into state before anything reads it.

import { showToast } from "../toast.js?v=20";
import { attachImageToDraft, attachCarouselToDraft } from "../../posts-store.js?v=45";
import { KEY, ctx, state } from "./context.js?v=41";
import { compositeOverlays } from "../../image-studio-canvas.js?v=5";
import { syncEditingText } from "./inline-text.js?v=7";
import * as imageStudio from "../../image-studio.js?v=78";

// Commit the working image to the origin draft, then close.
export function useImage(close) {
  syncEditingText();
  const st = state();
  // Carousel: attach every (possibly per-slide-edited) slide as a multi-slide
  // post. Single image: the working image with any overlays flattened.
  if (st?.outputMode === "carousel") {
    const urls = imageStudio.commitCarousel(KEY);
    if (urls.length && ctx.sessionId && ctx.postId) {
      attachCarouselToDraft(ctx.sessionId, ctx.postId, urls);
      showToast(`Carousel added to your draft · ${urls.length} slides`);
    }
    close();
    return;
  }
  const finalize = (url) => {
    if (url && ctx.sessionId && ctx.postId) {
      attachImageToDraft(ctx.sessionId, ctx.postId, url);
      showToast("Image added to your draft");
    }
    close();
  };
  if (st?.currentImage && st.overlays.length) {
    compositeOverlays(st.currentImage.url, st.overlays, st.currentImage.w, st.currentImage.h)
      .then(finalize)
      .catch(() => finalize(imageStudio.commit(KEY)));
    return;
  }
  finalize(imageStudio.commit(KEY));
}

// Bake the current carousel-slide edit (overlays flattened in) back into that
// slide, then return to the carousel results — updateSlide flips the mode.
// "Use carousel" then ships the edited set.
export function commitSlideEdit() {
  syncEditingText();
  const st = state();
  if (!st || st.selectedIndex == null || !st.currentImage) return;
  const idx = st.selectedIndex;
  const { w, h } = st.currentImage;
  const applySlide = (url) => imageStudio.updateSlide(KEY, idx, { url, w, h });
  if (st.overlays.length) {
    compositeOverlays(st.currentImage.url, st.overlays, w, h)
      .then(applySlide)
      .catch(() => applySlide(st.currentImage.url));
    return;
  }
  applySlide(st.currentImage.url);
}

// Apply an AI edit — a mocked reseed inside applyEdit. The note is read from the
// field on demand, because typing in it is silent.
export function applyEditTool(tool) {
  const ta = ctx.modal.querySelector("[data-img-edit-prompt]");
  if (ta) imageStudio.setEditPromptSilent(KEY, ta.value);
  imageStudio.applyEdit(KEY, tool);
}

// Run (or re-run) generation from whatever is in the prompt field right now —
// both fields are read on demand for the same reason.
export function runGenerate() {
  const ta = ctx.modal.querySelector("[data-img-prompt]");
  if (ta) imageStudio.setPromptSilent(KEY, ta.value);
  const el = ctx.modal.querySelector("[data-img-render-text]");
  if (el) imageStudio.setRenderTextSilent(KEY, el.value);
  if ((state()?.promptText || "").trim()) imageStudio.runGeneration(KEY);
}
