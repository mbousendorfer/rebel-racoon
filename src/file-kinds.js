// Shared file-kind → DS icon mapping. Used by source-card, idea-card, and
// the add-source modal so a "pdf" source renders the same glyph everywhere.
// Falls back to the generic file icon for unknown kinds.

export const KIND_ICON = {
  pdf: "ap-icon-file--pdf",
  video: "ap-icon-file--video",
  url: "ap-icon-link",
  word: "ap-icon-file--text",
  text: "ap-icon-file--text",
  image: "ap-icon-file--image",
  audio: "ap-icon-file",
  file: "ap-icon-file",
  // A Topic pulled in from the Topic Feed — the listening antenna, the same glyph
  // the feed's provenance badge and the picker's empty state wear.
  topic: "ap-icon-antenna",
};

export function iconFor(kind) {
  return KIND_ICON[(kind || "").toLowerCase()] || "ap-icon-file";
}
