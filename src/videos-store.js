// Videos — the Clips space's library (flag clipsSpace).
//
// A Video belongs to a Playbook, not to a chat: it is worked BEFORE any post
// exists, the way a Topic exists before the chat that takes it in (CONCEPTS §3,
// the fourth exception). It owns its clips; the drafts made from them live in
// posts-store under `draftKey(videoId)`, so the post card, the schedule modal
// and the draft edits all work unchanged.
//
// The flow is prod's (content/studio … handlers/video-clips.ts): adding a video
// starts the analysis AT ONCE — no settings first; 3 clips up to 10 minutes,
// 10 beyond; 30 s minimum, 2 h maximum. Format / subtitles / CTA are asked
// after the clips are picked, as settings of the whole video.
//
//   video = { id, contextId, name, url, origin, width, height, durationMs,
//             posterMs, addedAt, status: analyzing|ready, progress, stage,
//             settings: { ratio, subtitlePreset, cta }, analysis, fallback,
//             clips[], fromSource? }
//   clip  = { id, startMs, endMs, title, summary, why, tags, network, selected,
//             ratio (null = the video's), captionState (null = the video's
//             preset), transcript, segments (null = auto framing), texts[],
//             brand (null = the Playbook's clip look) }

import { seedVideos } from "./mocks.js?v=2473";
import { isNewUser } from "./user-mode.js?v=2473";
import { createNotifier } from "./store-utils.js?v=2473";
import { getDefaultContext, getContextById } from "./contexts-store.js?v=2473";

const MIN_VIDEO_MS = 30 * 1000;
const MAX_VIDEO_MS = 2 * 60 * 60 * 1000;
export const ANALYSIS_STAGES = ["Uploading", "Transcribing", "Finding highlights", "Framing speakers"];
const ANALYZE_MS = 9000;

const notifier = createNotifier("videos-store");
export const subscribe = notifier.subscribe;

let videos = null;
let counter = 0;
const newId = (p) => `${p}-${Date.now().toString(36)}-${++counter}`;

function seeded() {
  if (videos) return videos;
  const ctx = getDefaultContext();
  videos = isNewUser() ? [] : seedVideos.map((v) => hydrate(v, ctx?.id || null));
  return videos;
}

function hydrate(v, contextId) {
  return {
    ...v,
    contextId,
    origin: "seed",
    status: "ready",
    progress: 1,
    stage: null,
    settings: { cta: "none", ...v.settings },
    clips: v.clips.map((c, i) => freshClip({ ...c, id: `${v.id}-c${i + 1}` })),
  };
}

// The first visit's showcase: the seeded podcast, outside the store, so a new
// user sees what the space makes before owning a video.
export const exampleVideo = () => hydrate({ ...seedVideos[0], id: "example" }, null);

function freshClip(c) {
  return {
    selected: true,
    ratio: null,
    captionState: null,
    transcript: null,
    segments: null,
    texts: [],
    brand: null,
    tags: [],
    ...c,
  };
}

function notify() {
  notifier.notify(videos);
}

export const draftKey = (videoId) => `video-${videoId}`;

// A Playbook's clip look (Playbook › Brand): the subtitle style its clips start
// from, and the brand marks the editor adds. Identity, like the default image
// look — read when a video is added or a clip is opened, never written from here.
export function clipLookOf(pb) {
  const look = pb?.clipLook || {};
  return {
    subtitlePreset: look.subtitlePreset || "karaoke",
    brand: {
      logo: look.logo ?? !!pb?.brandLogo,
      corner: look.corner || "tr",
      logoSize: look.logoSize || 0.22,
      intro: !!look.intro,
      outro: look.outro ?? !!pb,
    },
  };
}

export function getVideos(contextId) {
  return seeded()
    .filter((v) => !contextId || v.contextId === contextId)
    .sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
}

export function getVideo(id) {
  return seeded().find((v) => v.id === id) || null;
}

export function getClip(videoId, clipId) {
  return getVideo(videoId)?.clips.find((c) => c.id === clipId) || null;
}

// Prod's guard, in words — or "" when the length is fine.
export function lengthProblem(durationMs) {
  if (durationMs < MIN_VIDEO_MS) return "This video is shorter than 30 seconds — too short to cut clips from.";
  if (durationMs > MAX_VIDEO_MS) return "This video is longer than 2 hours. Trim it first, then add it again.";
  return "";
}

// Add a video and start its analysis right away (prod: extract_video_clips
// fires as soon as the upload mints its key). `analysis` / `fallback` come with
// a known video; an upload has neither, so its framing is a centred crop.
export function addVideo({
  name,
  url,
  contextId,
  durationMs,
  width,
  height,
  origin = "upload",
  analysis = null,
  fallback = null,
  posterMs = null,
}) {
  const video = {
    id: newId("vid"),
    contextId: contextId || null,
    name: name || "Untitled video",
    url,
    origin,
    width: width || 1920,
    height: height || 1080,
    durationMs,
    posterMs: posterMs ?? Math.min(5000, Math.round(durationMs / 3)),
    addedAt: new Date().toISOString(),
    status: "analyzing",
    progress: 0,
    stage: ANALYSIS_STAGES[0],
    settings: { ratio: "9:16", subtitlePreset: clipLookOf(getContextById(contextId)).subtitlePreset, cta: "none" },
    analysis,
    fallback,
    fromSource: null,
    clips: [],
  };
  seeded().push(video);
  runAnalysis(video);
  notify();
  return video;
}

function runAnalysis(video) {
  const started = Date.now();
  const timer = setInterval(() => {
    const p = Math.min(1, (Date.now() - started) / ANALYZE_MS);
    video.progress = p;
    video.stage = ANALYSIS_STAGES[Math.min(ANALYSIS_STAGES.length - 1, Math.floor(p * ANALYSIS_STAGES.length))];
    if (p >= 1) {
      clearInterval(timer);
      if (!video.clips.length) video.clips = momentsFor(video);
      video.status = "ready";
      video.stage = null;
    }
    notify();
  }, 300);
}

// The moments of a video nobody analysed: evenly spread windows, as many as
// prod cuts (3 up to 10 minutes, 10 beyond).
// ponytail: evenly spaced, not content-aware — the mock has no transcript to read.
const GENERIC_MOMENTS = [
  ["The hook that opens it all", "A one-line framing of the whole video.", "Lands the point before the scroll does."],
  ["The key insight", "The idea the rest of the video builds on.", "Quotable on its own, with no context needed."],
  ["A concrete example", "A real case that makes the idea tangible.", "Stories travel further than claims."],
  ["The surprising number", "A figure that reframes the problem.", "Numbers stop the scroll on LinkedIn."],
  ["The strong opinion", "A take people will agree or argue with.", "Disagreement drives comments."],
  ["The how-to", "Three steps anyone can apply today.", "Practical clips get saved and shared."],
  ["The mistake to avoid", "What most people get wrong, and why.", "A warning reads as useful, fast."],
  ["The behind-the-scenes", "How the decision was really made.", "Candid moments feel native to Reels."],
  ["The question from the audience", "A real question, answered straight.", "Q&A formats keep people watching."],
  ["The closing line", "The takeaway, in one sentence.", "Ends on a line people repeat."],
];

function momentsFor(video) {
  const n = video.durationMs > 10 * 60 * 1000 ? 10 : 3;
  const slot = video.durationMs / n;
  const len = Math.max(15000, Math.min(45000, slot * 0.7));
  return GENERIC_MOMENTS.slice(0, n).map(([title, summary, why], i) => {
    const startMs = Math.round(i * slot + (slot - len) / 2);
    return freshClip({
      id: newId("clip"),
      startMs: Math.max(0, startMs),
      endMs: Math.min(video.durationMs, startMs + len),
      title,
      summary,
      why,
      network: ["linkedin", "instagram", "tiktok"][i % 3],
    });
  });
}

// The whole video's options — the prod set_clip_options trio. A clip that set
// its own format or subtitles keeps them; the others follow.
export function updateSettings(id, partial) {
  const v = getVideo(id);
  if (!v) return;
  v.settings = { ...v.settings, ...partial };
  if ("subtitlePreset" in partial) for (const c of v.clips) if (!c.captionCustom) c.captionState = null;
  notify();
}

export function updateClip(videoId, clipId, partial) {
  const c = getClip(videoId, clipId);
  if (!c) return;
  Object.assign(c, partial);
  notify();
}

export function setSelection(videoId, ids) {
  const v = getVideo(videoId);
  if (!v) return;
  const keep = new Set(ids);
  for (const c of v.clips) c.selected = keep.has(c.id);
  notify();
}

export function addClip(videoId, { startMs, endMs, title = "New clip" }) {
  const v = getVideo(videoId);
  if (!v) return null;
  const clip = freshClip({ id: newId("clip"), startMs, endMs, title, summary: "", why: "Added by you." });
  v.clips.push(clip);
  v.clips.sort((a, b) => a.startMs - b.startMs);
  notify();
  return clip;
}

export function removeClip(videoId, clipId) {
  const v = getVideo(videoId);
  if (!v) return null;
  const i = v.clips.findIndex((c) => c.id === clipId);
  if (i < 0) return null;
  const [gone] = v.clips.splice(i, 1);
  notify();
  return { clip: gone, index: i };
}

// "Open in Clips" from a chat: the chat's video source comes into the library
// once, with the clips the chat already cut. Chat sources carry no real file in
// the prototype, so a beta video stands in for the footage.
export function importFromSource({ sessionId, source, contextId }) {
  const existing = seeded().find((v) => v.fromSource?.sourceId === source.id);
  if (existing) return existing;
  const standIn = seedVideos[0];
  const clips = (source.clips || []).map((c) =>
    freshClip({
      id: newId("clip"),
      startMs: Math.round(c.start * 1000),
      endMs: Math.round(c.end * 1000),
      title: c.title,
      summary: c.summary,
      why: c.why,
      tags: c.tags || [],
      network: c.network,
      fromClipId: c.id,
    }),
  );
  const video = {
    ...addVideoShell(standIn, contextId),
    name: source.name || source.filename || "Video from a chat",
    origin: "chat",
    fromSource: { sessionId, sourceId: source.id },
    clips,
    status: clips.length ? "ready" : "analyzing",
    progress: clips.length ? 1 : 0,
  };
  seeded().push(video);
  if (!clips.length) runAnalysis(video);
  notify();
  return video;
}

function addVideoShell(standIn, contextId) {
  return {
    id: newId("vid"),
    contextId: contextId || null,
    url: standIn.url,
    width: standIn.width,
    height: standIn.height,
    durationMs: standIn.durationMs,
    posterMs: standIn.posterMs,
    analysis: standIn.analysis,
    fallback: standIn.fallback,
    addedAt: new Date().toISOString(),
    stage: null,
    settings: { ratio: "9:16", subtitlePreset: "karaoke", cta: "none" },
  };
}

// A known stand-in for a pasted link — the prototype can't stream YouTube.
export function standInForUrl() {
  return seedVideos[0];
}
