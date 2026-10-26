// "Open in Clips" — the door from a chat into the Clips space (flag
// clipsSpace). A chat keeps its clips; the video comes into the library of
// the chat's Playbook once, with the clips the chat cut, and every later
// "Open in Clips" lands on that same video. With a clip id, straight into
// that clip's editor — the one editor, so the modal isn't a second one.

import { navigate } from "../../router.js?v=2129";
import { getSessionById } from "../../sessions-store.js?v=2129";
import { playbookForNewWork } from "../../active-playbook.js?v=2129";
import { importFromSource } from "../../videos-store.js?v=2129";

export function openInClips(sessionId, source, clipId = null) {
  const contextId = getSessionById(sessionId)?.contextId || playbookForNewWork()?.id || null;
  const video = importFromSource({ sessionId, source, contextId });
  const clip = clipId ? video.clips.find((c) => c.fromClipId === clipId) : null;
  navigate(clip ? `/clips/${video.id}/edit/${clip.id}` : `/clips/${video.id}`);
}
