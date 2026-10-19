// Can this draft publish on its network? DERIVED from the post and the network's
// rules (NETWORKS in social-profiles.js) on every read — never stored. A stored
// `status: "needs_fixes"` + `errors[]` drifted from the text the moment someone
// edited it (a 250-char LinkedIn post "exceeding 2,200"); a derived verdict
// can't. The draft is the owner (CONCEPTS §3): fix the text or add the media and
// the error is gone on the next render.
//
//   validatePost(post) → { errors: [{ field, message }], warnings: [{ field, message }] }
//
// errors   block Schedule and Assign (the Drafts panel's « Needs fixes »).
// warnings publish, but not the way the draft looks (X shows 4 images at most).

import { networkMeta } from "./social-profiles.js?v=1950";

// Characters a post consumes against its network limit — body paragraphs,
// hashtags and the CTA, joined the way they'd publish (blank line between
// blocks). Matches what the user sees in the rendered card.
export function usedCharacters(post) {
  const blocks = [];
  if (post.text?.length) blocks.push(post.text.join("\n\n"));
  if (post.hashtags?.length) blocks.push(post.hashtags.map((h) => `#${h}`).join(" "));
  if (post.cta) blocks.push(post.cta);
  return blocks.join("\n\n").length;
}

// A post's media, whatever its kind. `hasImage` is not trusted on its own:
// removing an image leaves it true with a null `imageUrl`.
function postMedia(post) {
  if (post.clipRef) return "video";
  if (post.carousel?.length || post.imageUrl) return "image";
  return null;
}

// YouTube publishes a title the card doesn't edit yet: the draft's own `title`,
// else its first sentence — what the preview shows, so what is validated.
export function youtubeTitle(post) {
  if (post.title) return post.title;
  const first = (post.text?.[0] || "").trim();
  return first.match(/^.+?[.!?](?=\s|$)/)?.[0] || first;
}

export function validatePost(post) {
  const errors = [];
  const warnings = [];
  const meta = networkMeta(post?.network);
  if (!meta) return { errors, warnings };

  const over = usedCharacters(post) - meta.limit;
  if (over > 0)
    errors.push({
      field: "caption",
      message: `${over} ${over === 1 ? "character" : "characters"} over ${meta.label}'s ${meta.limit.toLocaleString("en-US")} limit. Shorten it to publish.`,
    });

  const media = postMedia(post);
  if (meta.requiresMedia === "video" && media !== "video")
    errors.push({ field: "media", message: `${meta.label} publishes videos only. Add a video clip to publish.` });
  else if (meta.requiresMedia && !media)
    errors.push({ field: "media", message: `${meta.label} needs an image or a video. Add one to publish.` });

  if (meta.titleLimit) {
    const titleOver = youtubeTitle(post).length - meta.titleLimit;
    if (titleOver > 0)
      errors.push({
        field: "title",
        message: `The title is ${titleOver} ${titleOver === 1 ? "character" : "characters"} over ${meta.label}'s ${meta.titleLimit} limit. Shorten the first sentence to publish.`,
      });
  }

  if (meta.maxImages && (post.carousel?.length || 0) > meta.maxImages)
    warnings.push({
      field: "media",
      message: `${meta.label} shows ${meta.maxImages} images at most — the other ${post.carousel.length - meta.maxImages} won't publish.`,
    });

  return { errors, warnings };
}

export const isPostValid = (post) => validatePost(post).errors.length === 0;
