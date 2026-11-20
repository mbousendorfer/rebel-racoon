// "Open in Clips" — from a chat into the Clips space (flag clipsSpace). A chat keeps its clips; the
// video comes into the library of the chat's Playbook once, with the clips the
// chat cut, and every later "Open in Clips" lands on that same video. With a
// clip id, straight into that clip's editor — the one editor.
// "Write posts", the other door, is clips-chat.js.

import { navigate } from "../../router.js?v=2803";
import { playbookForNewWork, sessionPlaybookId } from "../../active-playbook.js?v=2803";
import { importFromSource } from "../../videos-store.js?v=2803";

export function openInClips(sessionId, source, clipId = null) {
  const contextId = sessionPlaybookId(sessionId) || playbookForNewWork()?.id || null;
  const video = importFromSource({ sessionId, source, contextId });
  const clip = clipId ? video.clips.find((c) => c.fromClipId === clipId || c.id === clipId) : null;
  navigate(clip ? `/clips/${video.id}/edit/${clip.id}` : `/clips/${video.id}`);
}
