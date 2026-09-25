// Image Generator — the four networks. Every network is always offered.
// `icon` is the DS glyph; the name travels in title / aria-label.

export const NETWORKS = Object.freeze([
  { id: "instagram", label: "Instagram", icon: "ap-icon-instagram-official" },
  { id: "facebook", label: "Facebook", icon: "ap-icon-facebook-official" },
  { id: "x", label: "X", icon: "ap-icon-x-official" },
  { id: "linkedin", label: "LinkedIn", icon: "ap-icon-linkedin-official" },
]);

export function networkById(id) {
  return NETWORKS.find((n) => n.id === id) || null;
}
