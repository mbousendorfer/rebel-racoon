// Videos — the Clips space's library (flag clipsSpace).
//
// A Video belongs to a Playbook, not to a chat: it is worked BEFORE any post
// exists, the way a Topic exists before the chat that takes it in (CONCEPTS §3,
// the fourth exception). It owns its clips; the drafts made from them live in
// posts-store under `draftKey(videoId)`, so the post card, the schedule modal
// and the draft edits all work unchanged.
//
// The flow is prod's (content/studio … handlers/video-clips.ts): adding a video
// starts the analysis AT ONCE — no settings first; one clip per 2 minutes,
// between 3 and 10 (prod's ClipCount); 30 s minimum, 2 h maximum. Format / subtitles / CTA are asked
// after the clips are picked, as settings of the whole video.
//
//   video = { id, contextId, name, url, origin, width, height, durationMs,
//             posterMs, addedAt, status: analyzing|ready|failed, progress, stage,
//             failure: { kind: empty|crash, stage, reason } (status failed;
//             « empty » is prod's NO_SPEECH: no clips, not a breakdown),
//             settings: { ratio, subtitlePreset, cta }, analysis, fallback,
//             clips[], requests[] (asked of Archie: { id, text, at, status:
//             running|done|none }), summary (the recap's line, seed only),
//             fromSource? }
//   clip  = { id, startMs, endMs, title, summary, why, tags, network,
//             requestId (the request it answers; none = Archie's first pick),
//             trimmed (its range was changed with Trim),
//             reviewed, selected (the review: kept = reviewed + selected,
//             skipped = reviewed + not selected, to review = not reviewed),
//             ratio (null = the video's), captionState (null = the video's
//             preset), transcript, segments (null = auto framing), texts[],
//             brand (null = the Playbook's clip look) }

import { newId } from "./utils.js?v=2925";
import { seedVideos } from "./mocks.js?v=2925";
import { isNewUser } from "./user-mode.js?v=2925";
import { createNotifier } from "./store-utils.js?v=2925";
import { getDefaultContext, getContextById } from "./contexts-store.js?v=2925";

const MIN_VIDEO_MS = 30 * 1000;
const MAX_VIDEO_MS = 2 * 60 * 60 * 1000;
// Prod's steps (clip-processing-card: STEP_LABEL_KEYS); only the upload has a
// percentage.
export const ANALYSIS_STAGES = ["Uploading", "Extracting audio", "Transcribing audio", "Finding the best moments"];
const ANALYZE_MS = 9000;

const notifier = createNotifier("videos-store");
export const subscribe = notifier.subscribe;

let videos = null;

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
    // Every clip Archie cuts starts « to review »: neither kept nor skipped.
    reviewed: false,
    selected: false,
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
  focus = "",
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
    // Asked for at launch (prod's focus): the analysis answers it alone.
    requests: focus ? [{ id: newId("ask"), text: focus, at: new Date().toISOString(), status: "running" }] : [],
  };
  seeded().push(video);
  runAnalysis(video);
  notify();
  return video;
}

// Two ways an analysis ends without clips, as in prod (clip-job.service):
// « empty » (NO_SPEECH — the video, not the job: trying again changes nothing)
// and « crash » (the job failed: Try again). The prototype never ends either
// way on its own: Admin › Clips arms one.
const ANALYSIS_ENDS = {
  empty: {
    kind: "empty",
    stage: "Finding the best moments",
    reason:
      "I couldn't find enough speech in this video to pick highlights from. Clips are chosen from what is said, so try a video with narration or dialogue.",
  },
  crash: {
    kind: "crash",
    stage: "Transcribing audio",
    reason: "I couldn't finish working on this video. You can try again, or upload a different video.",
  },
};
let failNext = null;
export function failNextAnalysis(kind = "empty") {
  failNext = kind;
}

function runAnalysis(video) {
  const started = Date.now();
  const end = failNext && ANALYSIS_ENDS[failNext];
  failNext = null;
  const timer = setInterval(() => {
    const p = Math.min(1, (Date.now() - started) / ANALYZE_MS);
    video.progress = p;
    video.stage = ANALYSIS_STAGES[Math.min(ANALYSIS_STAGES.length - 1, Math.floor(p * ANALYSIS_STAGES.length))];
    if (end && video.stage === end.stage) {
      clearInterval(timer);
      video.status = "failed";
      video.failure = { ...end };
      notify();
      return;
    }
    if (p >= 1) {
      clearInterval(timer);
      if (!video.clips.length) video.clips = launchRequest(video) ? focusedMoments(video) : momentsFor(video);
      video.status = "ready";
      video.stage = null;
    }
    notify();
  }, 300);
}

// How many clips prod cuts: one per 2 minutes, between 3 and 10.
export const clipCountFor = (durationMs) => Math.max(3, Math.min(10, Math.round(durationMs / 120000)));

// The moments of a video nobody analysed: evenly spread windows, as many as
// prod cuts, 30 to 60 s each when the video leaves room.
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
  const n = clipCountFor(video.durationMs);
  const slot = video.durationMs / n;
  const len = Math.min(slot * 0.9, Math.max(30000, Math.min(60000, slot * 0.7)));
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
  for (const c of v.clips) {
    c.selected = keep.has(c.id);
    if (c.selected) c.reviewed = true;
  }
  notify();
}

// The review's two verbs: Keep (the clip gets posted) or Skip.
export function reviewClip(videoId, clipId, keep) {
  const c = getClip(videoId, clipId);
  if (!c) return;
  c.reviewed = true;
  c.selected = keep;
  notify();
}

export function addClip(videoId, { startMs, endMs, title = "New clip" }) {
  const v = getVideo(videoId);
  if (!v) return null;
  // A clip you add yourself is kept: you chose it.
  const clip = freshClip({
    id: newId("clip"),
    startMs,
    endMs,
    title,
    summary: "",
    why: "Added by you.",
    reviewed: true,
    selected: true,
  });
  v.clips.push(clip);
  v.clips.sort((a, b) => a.startMs - b.startMs);
  notify();
  return clip;
}

// « Find clips »: other moments, on what the user asked — prod's focus
// (ClipFocus: words, a speaker, a part of the video, a length; flag
// content-studio-clip-focus). The clips already there stay. Nothing matched is
// prod's NO_MATCH: the request says so and adds nothing.
const ASK_MS = 2500;
const ASK_TITLES = {
  pric: ["Pricing a social retainer", "When to raise your prices"],
};
// A request names a person without saying who (« the guest », « he »…) in a
// video with more than one voice: prod's SPEAKER_UNKNOWN asks which one.
const VAGUE_PERSON = /\b(he|she|him|her|guest|host|speaker|interviewer|interviewee)\b/i;
// The parts of a video and the lengths prod's focus understands, whatever the video says.
const FOCUS_KINDS = /\b(first|last|start|beginning|end|minutes?|seconds?|story|stories|question|answer)\b/i;
const STOP = new Set([
  "about",
  "where",
  "when",
  "with",
  "that",
  "this",
  "from",
  "they",
  "them",
  "what",
  "which",
  "talks",
  "talk",
  "says",
  "clips",
  "clip",
  "moment",
  "moments",
  "video",
  "part",
]);

// ponytail: the proto has no transcript to search. A request matches when one
// of its words (4 letters and more) is in the video's summary, its clips'
// titles and reasons, or names a part / a length — else it is prod's NO_MATCH.
function requestMatches(v, text) {
  if (FOCUS_KINDS.test(text) || Object.keys(ASK_TITLES).some((k) => text.toLowerCase().includes(k))) return true;
  const hay = [v.summary, ...(v.speakers || []), ...v.clips.flatMap((c) => [c.title, c.why])].join(" ").toLowerCase();
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .some((w) => hay.includes(w.replace(/s$/, "")));
}

const voicesOf = (v) => (v.speakers?.length ? v.speakers : ["Voice 1", "Voice 2"]);

export function askForClips(videoId, text, { speaker = null, requestId = null } = {}) {
  const v = getVideo(videoId);
  const words = String(text || "").trim();
  if (!v || !words) return;
  // Answering « which one? » runs the same request again, now with its person.
  let req = requestId && (v.requests || []).find((r) => r.id === requestId);
  if (req) Object.assign(req, { status: "running", speaker, voices: null });
  else {
    req = { id: newId("ask"), text: words, at: new Date().toISOString(), status: "running", speaker };
    v.requests = [req, ...(v.requests || [])];
  }
  notify();
  setTimeout(() => {
    if (!speaker && VAGUE_PERSON.test(words)) {
      req.status = "speaker";
      req.voices = voicesOf(v);
      return notify();
    }
    if (!speaker && !requestMatches(v, words)) {
      req.status = "none";
      return notify();
    }
    // ponytail: the proto doesn't read the transcript; it cuts two 40 s moments
    // in the longest stretches no clip covers. A real search is prod's job.
    const edges = [0, ...v.clips.flatMap((c) => [c.startMs, c.endMs]).sort((a, b) => a - b), v.durationMs];
    const gaps = [];
    for (let i = 0; i < edges.length - 1; i += 2) gaps.push([edges[i], edges[i + 1]]);
    const open = gaps.filter(([a, b]) => b - a >= 50000).sort((x, y) => y[1] - y[0] - (x[1] - x[0]));
    const titles = Object.entries(ASK_TITLES).find(([k]) => words.toLowerCase().includes(k))?.[1];
    open.slice(0, 2).forEach(([a, b], i) => {
      const startMs = Math.round((a + b) / 2 - 20000);
      v.clips.push(
        freshClip({
          id: newId("clip"),
          startMs,
          endMs: startMs + 40000,
          title: titles?.[i] || `${words[0].toUpperCase()}${words.slice(1)}, moment ${i + 1}`,
          summary: "",
          why: `You asked for « ${words} »${speaker ? `, ${speaker} speaking` : ""}.`,
          requestId: req.id,
        }),
      );
    });
    v.clips.sort((x, y) => x.startMs - y.startMs);
    req.status = open.length ? "done" : "none";
    return notify();
  }, ASK_MS);
}

// « Cancel the request » on a question: the request goes, nothing was cut.
export function dropRequest(videoId, requestId) {
  const v = getVideo(videoId);
  if (!v) return;
  v.requests = (v.requests || []).filter((r) => r.id !== requestId);
  notify();
}

// A request written before the analysis (the library's « Looking for something
// specific? »): prod runs the same job with a focus, and only its clips come back.
const launchRequest = (v) => (v.requests || []).find((r) => r.status === "running");

// ponytail: the proto can't search the transcript; it takes three of the
// evenly spaced moments and names them after the request.
function focusedMoments(v) {
  const req = launchRequest(v);
  const titles = Object.entries(ASK_TITLES).find(([k]) => req.text.toLowerCase().includes(k))?.[1];
  const clips = momentsFor(v)
    .slice(0, 3)
    .map((c, i) => ({
      ...c,
      title: titles?.[i] || `${req.text[0].toUpperCase()}${req.text.slice(1)}, moment ${i + 1}`,
      why: `You asked for « ${req.text} ».`,
      requestId: req.id,
    }));
  req.status = "done";
  return clips;
}

// Trim: a suggested clip's new start and end, like prod's (modal.videoTrim).
export function trimClip(videoId, clipId, { startMs, endMs }) {
  const c = getClip(videoId, clipId);
  if (!c) return;
  Object.assign(c, { startMs, endMs, trimmed: true, transcript: null, segments: null });
  getVideo(videoId).clips.sort((x, y) => x.startMs - y.startMs);
  notify();
}

export function retryAnalysis(id) {
  const v = getVideo(id);
  if (!v || v.status !== "failed") return;
  Object.assign(v, { status: "analyzing", progress: 0, stage: ANALYSIS_STAGES[0], failure: null });
  runAnalysis(v);
  notify();
}

export function removeVideo(id) {
  const list = seeded();
  const i = list.findIndex((v) => v.id === id);
  if (i < 0) return;
  list.splice(i, 1);
  notify();
}

export function removeClip(videoId, clipId) {
  const v = getVideo(videoId);
  if (!v) return null;
  const i = v.clips.findIndex((c) => c.id === clipId);
  if (i < 0) return null;
  const [gone] = v.clips.splice(i, 1);
  // Removed clips are kept with the video, to be put back (Undo, « Removed clips »).
  v.removed = [gone, ...(v.removed || [])];
  notify();
  return { clip: gone, index: i };
}

export function restoreClip(videoId, clipId) {
  const v = getVideo(videoId);
  const c = v?.removed?.find((x) => x.id === clipId);
  if (!c) return;
  v.removed = v.removed.filter((x) => x.id !== clipId);
  v.clips.push(c);
  v.clips.sort((a, b) => a.startMs - b.startMs);
  notify();
}

// An edited clip renders again when the editor closes (prod: the render job,
// polled; « Rendering your edited clip… » on its card meanwhile).
const RENDER_MS = 6000;
export function renderClip(videoId, clipId) {
  const c = getClip(videoId, clipId);
  if (!c) return;
  c.rendering = true;
  notify();
  clearTimeout(c.renderTimer);
  c.renderTimer = setTimeout(() => {
    c.rendering = false;
    notify();
  }, RENDER_MS);
}

// "Open in Clips" from a chat: the chat's video source comes into the library
// once, with the clips the chat already cut. Chat sources carry no real file in
// the prototype, so a beta video stands in for the footage.
export function importFromSource({ sessionId, source, contextId }) {
  // A source the space sent (Write posts) goes back to its own video.
  if (source.fromVideo && getVideo(source.fromVideo)) return getVideo(source.fromVideo);
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

// A chat shows its video's clips (flag clipsSpace): the video is the one truth,
// `source.clips` its mirror (sources-stream). The chat keeps the ids it knew
// (`fromClipId`), and plays this video's footage.
const chatKey = (c) => c.fromClipId || c.id;

export function chatClipOf(video, c) {
  return {
    id: chatKey(c),
    start: c.startMs / 1000,
    end: c.endMs / 1000,
    title: c.title,
    summary: c.summary || "",
    why: c.why || "",
    tags: c.tags || [],
    network: c.network,
    videoUrl: video.url,
  };
}

// The chat's edits (delete, Undo, the modal, the Clip Studio) come back here.
// A clip the chat drops goes to `removed` (as removeClip), so its Undo brings it
// back whole, review and editing included.
export function syncClipsFromChat(videoId, chatClips) {
  const v = getVideo(videoId);
  if (!v) return;
  const pool = new Map([...(v.removed || []), ...v.clips].map((c) => [chatKey(c), c]));
  const next = chatClips.map((cc) => {
    const c =
      pool.get(cc.id) ||
      freshClip({ id: newId("clip"), fromClipId: cc.id, why: "", summary: "", reviewed: true, selected: true });
    return Object.assign(c, {
      startMs: Math.round(cc.start * 1000),
      endMs: Math.round(cc.end * 1000),
      title: cc.title,
      summary: cc.summary ?? c.summary,
      why: cc.why ?? c.why,
      tags: cc.tags || c.tags,
      network: cc.network ?? c.network,
    });
  });
  const kept = new Set(next);
  v.removed = [...v.clips.filter((c) => !kept.has(c)), ...(v.removed || []).filter((c) => !kept.has(c))];
  v.clips = next.sort((a, b) => a.startMs - b.startMs);
  notify();
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
