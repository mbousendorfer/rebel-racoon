// Image Generator — caption rules per network (P2 · full post).
// `maxChars` is the network's hard limit; `visibleChars` is where the feed
// truncates behind "…more", which is what a hook must fit in.

export const COPY_LIMITS = Object.freeze({
  instagram: { maxChars: 2200, visibleChars: 125, hashtags: { min: 3, max: 8 }, linksClickable: false },
  facebook: { maxChars: 63206, visibleChars: 240, hashtags: { min: 0, max: 3 }, linksClickable: true },
  x: { maxChars: 280, visibleChars: 280, hashtags: { min: 0, max: 2 }, linksClickable: true, linkCost: 23 },
  linkedin: { maxChars: 3000, visibleChars: 210, hashtags: { min: 2, max: 5 }, linksClickable: true },
});
