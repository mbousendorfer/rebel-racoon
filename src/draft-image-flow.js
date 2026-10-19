// "Generate an image" on a draft: one image, straight into the slot — nothing
// asked (2026-10-08, on request: "enlève les questions… remplace ça par
// l'animation de loading"). It used to ask up to three Quickpickers in the chat
// on EVERY click (style, shape, text) and a "What next?" — don't bring that back.
//
// The one exception is the FIRST image of a Playbook with no look yet
// (requireImageLook, 2026-10-16): I ask once, in the chat, how the Brand's
// images should look — the user's own images (I learn a brand style from them)
// or one of the six ready-made styles — and the answer becomes the Playbook's
// default look. Then the image is made, and every click after goes straight to
// the loader. Asked in the flow, never a prerequisite: Not now makes the image
// anyway, in the first preset (requireConnectedProfiles' pattern).
//
// What it uses, without asking — the same choices the slot's caption shows:
//   style    the Playbook's default look (Playbook › Image generation: a style
//            or a reference image), else its first style, else a preset
//   shape    the network's preferred one (already first)
//   text     none — it stays an editable layer, added in the studio
//   subject  read from the post, like the studio's "Suggest from the post"
//
// The read from the post is as slow as the real call (4–8 s): the loader
// starts once the look is known and its first stage is exactly that. No chat
// message: the image appearing in the slot is the feedback; a failure says so
// in a toast.

import { showToast } from "./components/toast.js?v=1930";
import { setHandoff } from "./handoff.js?v=1930";
import { navigate } from "./router.js?v=1930";
import * as inlineQuestion from "./inline-question.js?v=1930";
import {
  finishPending,
  postAssistantMessage,
  postImageLookSet,
  postSelectionEcho,
  startPending,
} from "./assistant.js?v=1930";
import { attachImageToDraft, getPosts, updatePostContent } from "./posts-store.js?v=1930";
import { getSessionById } from "./sessions-store.js?v=1930";
import { escapeHtml } from "./utils.js?v=1930";
import {
  defaultQuickLook,
  generateQuickImage,
  needsImageLook,
  quickImageChoices,
  setImageLook,
  styleFromImages,
  suggestImageSubject,
} from "./modules/image-studio/index.js?v=1930";

const FALLBACK_SUBJECT = "One simple object that stands for the idea, on a plain background. No text in the image.";

const postText = (post) => (Array.isArray(post.text) ? post.text.join("\n") : post.text || "");

/**
 * @param {string} sessionId
 * @param {string} postId
 * @param {{ repaint: () => void }} host — the drafts panel: how to redraw it while it waits
 */
export function startDraftImageFlow(sessionId, postId, { repaint }) {
  const post = getPosts(sessionId).find((p) => p.id === postId);
  if (!post) return;
  const brandId = getSessionById(sessionId)?.contextId || null;
  const choices = quickImageChoices({ brandId, network: post.network });
  if (!choices || !choices.styles.length) {
    showToast(
      "This chat has no Playbook, so I can't match an image to your Brand. Start a chat with a Playbook to add images.",
      { variant: "error" },
    );
    return;
  }
  // A second click while the look is being asked: the question is already there.
  if (inlineQuestion.isActive(sessionId) && needsImageLook(brandId)) return;
  requireImageLook(sessionId, {
    brandId,
    onReady: () => generate(sessionId, postId, { repaint, brandId, choices }),
  });
}

async function generate(sessionId, postId, { repaint, brandId, choices }) {
  // The draft may have been deleted while the look was asked.
  const post = getPosts(sessionId).find((p) => p.id === postId);
  if (!post) return;
  updatePostContent(sessionId, postId, { isGeneratingImage: true, imageGeneratingSince: Date.now() });
  repaint();
  const done = (patch) => {
    updatePostContent(sessionId, postId, { isGeneratingImage: false, ...patch });
    repaint();
  };
  try {
    const [look, prompt] = await Promise.all([
      defaultQuickLook(brandId),
      suggestImageSubject({ brandId, text: postText(post) }).catch(() => FALLBACK_SUBJECT),
    ]);
    const url = await generateQuickImage({
      brandId,
      prompt,
      styleId: (look || choices.styles[0]).id,
      formatId: choices.shapes[0].formatId,
    });
    // The draft may have been deleted while this ran.
    if (!getPosts(sessionId).some((p) => p.id === postId)) return;
    attachImageToDraft(sessionId, postId, url);
    done({ imageRevealAt: Date.now() });
  } catch {
    done({});
    showToast("Couldn't generate the image.", {
      variant: "error",
      action: { label: "Retry", onClick: () => startDraftImageFlow(sessionId, postId, { repaint }) },
    });
  }
}

// ── The first image: no look yet ─────────────────────────────────────────────

// Playbooks whose look was put off with Not now — not asked again until reload.
// ponytail: page-life only; persist per Playbook if the re-ask after a reload nags.
const putOff = new Set();

/**
 * Asks how the Brand's images should look when its Playbook has none yet, makes
 * the answer its default look, then resumes. `onReady()` runs at once when there
 * is nothing to ask: a look is set, the Playbook isn't yours to change (a shared
 * one — the image is made in the fallback look, as before), or it was put off.
 * @param {string} sessionId
 * @param {{ brandId: string, onReady: () => void, intro?: (brand: string) => string }} opts —
 *   `intro`: the first question's sentence when this isn't a draft's first image
 */
export function requireImageLook(sessionId, { brandId, onReady, intro = null }) {
  if (!needsImageLook(brandId) || putOff.has(brandId)) {
    onReady();
    return;
  }
  const choices = quickImageChoices({ brandId, network: null });
  const brand = escapeHtml(choices.brandName);
  const own = choices.styles.filter((s) => s.mine);

  const done = (look) => {
    setImageLook(brandId, look.id);
    postImageLookSet(sessionId, { contextId: brandId, styleId: look.id, label: look.label });
    onReady();
  };
  const notNow = () => {
    putOff.add(brandId);
    // From a draft, the image is still made — say in what. Elsewhere, onReady says it.
    if (!intro)
      postAssistantMessage(sessionId, `No problem — I'll use ${escapeHtml(choices.styles[0].label)} for this one.`);
    onReady();
  };

  // 1 — the user's own images or a ready-made style. Skipped when the
  // Playbook already has styles of its own: then the question is which one.
  function askSource({ announce = true } = {}) {
    if (announce)
      postAssistantMessage(
        sessionId,
        intro?.(brand) ||
          `First image for ${brand} — how should its images look? I'll start every draft's image from your answer.`,
      );
    inlineQuestion.ask(sessionId, {
      stepLabel: "1 of 2",
      skipLabel: "Not now",
      items: [
        {
          value: "mine",
          label: "From images I already have",
          caption: "I'll learn the look from 2 to 6 of them",
          icon: "ap-icon-upload",
        },
        { value: "ready", label: "A ready-made style", caption: "Six looks to start from", icon: "ap-icon-image" },
      ],
      onPick: (value) => (value === "mine" ? askImages() : askStyle()),
      onSkip: notNow,
    });
  }

  // 2a — the styles, as pictures (the Playbook's own first).
  function askStyle({ announce = true } = {}) {
    if (announce)
      postAssistantMessage(
        sessionId,
        own.length
          ? `Which of ${brand}'s styles should every image start from?`
          : `Pick the one that fits ${brand} best. You can change it any time in the Playbook.`,
      );
    inlineQuestion.ask(sessionId, {
      stepLabel: own.length ? "" : "2 of 2",
      variant: "cards",
      items: choices.styles.map((s) => ({
        value: s.id,
        label: escapeHtml(s.label),
        caption: s.mine ? "Your Playbook's style" : "",
        preview: `<img class="draft-image-flow__style" src="${s.thumbUrl}" alt="" />`,
      })),
      onPick: (id) => {
        const look = choices.styles.find((s) => s.id === id);
        postSelectionEcho(sessionId, { icon: "ap-icon-image", title: look.label, meta: "Image look" });
        done(look);
      },
      ...(own.length ? { skipLabel: "Not now", onSkip: notNow } : { onBack: () => askSource({ announce: false }) }),
    });
  }

  // 2b — the user's images: I learn a brand style from them (the style
  // creator's save), named after the brand.
  function askImages({ announce = true } = {}) {
    if (announce)
      postAssistantMessage(
        sessionId,
        `Add 2 to 6 images that already look like ${brand} — past posts, photos, visuals. I'll learn the look they share.`,
      );
    inlineQuestion.ask(sessionId, {
      stepLabel: "2 of 2",
      customFile: true,
      customFileMultiple: true,
      customFileAccept: "image/*",
      customFileLabel: "Choose your images",
      customFileHint: "PNG · JPG · up to 6",
      onFile: async (files) => {
        const n = files.length;
        postSelectionEcho(sessionId, {
          icon: "ap-icon-image",
          title: n > 1 ? `${n} images` : "1 image",
          meta: "To learn the look from",
        });
        const pending = startPending(sessionId, "Learning the look of your images");
        try {
          const look = await styleFromImages(brandId, files);
          finishPending(sessionId, pending);
          done(look);
        } catch {
          finishPending(sessionId, pending);
          postAssistantMessage(sessionId, "I couldn't read those. Try a few PNG or JPG images.");
          askImages({ announce: false });
        }
      },
      onBack: () => askSource({ announce: false }),
    });
  }

  if (own.length) askStyle();
  else askSource();
}

// ── "Help me pick in a chat" (Playbook › Image generation) ───────────────────
// The same questions, from the Playbook's Generate an image block when it has
// no look: a new chat on that Playbook opens on them. Both ends live here.
export const IMAGE_LOOK_CHAT_HANDOFF = "pendingImageLookChat";

export function openImageLookChat(contextId) {
  setHandoff(IMAGE_LOOK_CHAT_HANDOFF, { contextId });
  const params = new URLSearchParams({ contextId, title: "Image look" });
  navigate(`/session/new-${Date.now().toString(36)}?${params.toString()}`);
  return true;
}

/** session.js, on consuming the handoff. */
export function startImageLookChat(sessionId, { contextId }) {
  requireImageLook(sessionId, {
    brandId: contextId,
    intro: (brand) => `Let's settle how ${brand}'s images look — every draft's Generate an image will start from it.`,
    onReady: () =>
      postAssistantMessage(
        sessionId,
        needsImageLook(contextId)
          ? "Whenever you're ready — the first Generate an image on a draft will ask again."
          : "Want to draft a post to try it on?",
      ),
  });
}
