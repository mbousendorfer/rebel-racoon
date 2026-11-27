// "Write posts" — from the Clips space into a NEW chat (2026-11-20, the
// user's flow: "on se branche sur le conversationnel pour créer des posts
// comme pour les autres"). The kept clips ride a handoff; the chat opens on the
// video as a source it already has, holding just those clips, echoes them and
// asks the accounts — the format and the subtitles were chosen in the space.
// Kept out of screens/clips/ so the session screen can import it statically
// (the attach must land before the chat's intake starts watching).

import { navigate } from "./router.js?v=2937";
import { setHandoff, consumeHandoff } from "./handoff.js?v=2937";
import { newChatPath } from "./utils.js?v=2937";
import { getVideo, chatClipOf } from "./videos-store.js?v=2937";
import { addReadySource } from "./sources-stream.js?v=2937";

const CLIPS_CHAT_HANDOFF = "clipsToChat";

export function writePostsInChat(video, clipIds) {
  if (!video || !clipIds.length) return;
  setHandoff(CLIPS_CHAT_HANDOFF, { videoId: video.id, clipIds });
  const params = new URLSearchParams();
  if (video.contextId) params.set("contextId", video.contextId);
  params.set("title", `Posts from ${video.name.replace(/\.[a-z0-9]+$/i, "")}`);
  navigate(`${newChatPath()}?${params.toString()}`);
}

// At the chat's mount, before its intake starts: no loading card, no "what
// should I do with it?" — the reader already said. Returns what the draft flow
// needs, or null.
export function attachClipsToChat(sessionId) {
  const pending = consumeHandoff(CLIPS_CHAT_HANDOFF);
  const video = pending && getVideo(pending.videoId);
  if (!video) return null;
  const clips = video.clips.filter((c) => pending.clipIds.includes(c.id));
  if (!clips.length) return null;
  const sourceId = `src-${video.id}`;
  const chatClip = (c) => chatClipOf(video, c);
  addReadySource(sessionId, {
    id: sourceId,
    filename: video.name,
    kind: "Video",
    preview: video.summary || "",
    extra: {
      durationSec: Math.round(video.durationMs / 1000),
      clipExtractionStatus: "ready",
      fromVideo: video.id, // « Open in Clips » on it lands back on this video
      clips: clips.map(chatClip),
    },
  });
  return {
    entries: clips.map((c) => ({ clip: chatClip(c), sourceName: video.name, sourceId })),
    // The look of the first clip: its own, else the video's (the space's two levels).
    format: clips[0].ratio || video.settings.ratio || "9:16",
    style: clips[0].captionState?.presetId || video.settings.subtitlePreset || "none",
  };
}
