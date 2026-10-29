// Intake-turn lifecycle: loading → ready.
//
// Every new source landing in the session's sources-stream gets a
// matching "source-intake" turn posted to the assistant thread. The
// turn starts in loading state (Processing badge); when the source
// flips to Processed in sources-stream, we mark the turn ready so the
// chip switches to "Processed · N ideas".
//
// Pulled out of session.js (Lot H+). The session view owns when to
// kick the lifecycle off and when to tear it down — this module is
// just the subscription + bookkeeping.
//
// Public API:
//   startIntakeLifecycle(sessionId, { onSourcesChange, onSourcesReady, onSourceReady }) → unsubscribe
//
// `onSourcesReady(ids[])` fires once per arrival with the sources that wait for
// the reader's answer (use === "waiting"); `onSourceReady(id, src)` for a source
// whose use was already decided.
//
// The `onSourcesChange` callback fires on every sources-stream notify
// so the caller can repaint the thread (intake turns derive
// ideaCount/status live from sources-stream).

import { subscribeSources, getSources as getStreamSources } from "../../sources-stream.js?v=2530";
import { getThread, postSourceIntake, markSourceIntakeReady } from "../../assistant.js?v=2530";

// The intake turn always shows "Uploading" for at least this long, even when
// the source is ready sooner — an upload that lands instantly reads as fake.
// A video, the heavy one, holds longer.
const MIN_LOADING_MS = 3000;
const MIN_LOADING_MS_VIDEO = 6000;

// Sources added within this window of each other are one arrival (a multi-file
// drop, a batch replay): they get ONE "What should I do with these?" question
// once the last of them is in — inlineQuestion holds one question per chat, so
// a second, separate ask would silently replace the first.
const SAME_ARRIVAL_MS = 2500;

export function startIntakeLifecycle(sessionId, { onSourcesChange, onSourcesReady, onSourceReady } = {}) {
  // seenSourceIds is a snapshot baseline of the session's sources at
  // mount time. Any sourceId that appears AFTER this baseline counts
  // as a "new upload" — we post a loading intake turn for it. When the
  // source flips to Processed, the turn flips to ready.
  //
  // sentReadyForSourceIds dedupes the markReady call: once a turn flips
  // to ready, we don't re-fire on every notify.
  const seenSourceIds = new Set(getStreamSources(sessionId).map((s) => s.id));
  const sentReadyForSourceIds = new Set();
  // Sources already covered by a "what should I do?" question — asked once.
  const askedSourceIds = new Set();
  // sourceId → when its loading turn was posted, for the minimum loading time.
  const postedAt = new Map();
  let disposed = false;
  let latest = [];

  // A source waiting for an answer is asked about together with every other
  // waiting source of the same arrival — and only once all of them are ready.
  const askWhenArrivalIsIn = (src) => {
    if (askedSourceIds.has(src.id)) return;
    const at = postedAt.get(src.id) ?? 0;
    const arrival = latest.filter(
      (s) => !askedSourceIds.has(s.id) && postedAt.has(s.id) && Math.abs(postedAt.get(s.id) - at) <= SAME_ARRIVAL_MS,
    );
    if (arrival.some((s) => !sentReadyForSourceIds.has(s.id))) return; // the last one asks
    const waiting = arrival.filter((s) => s.use === "waiting");
    for (const s of arrival) askedSourceIds.add(s.id);
    if (waiting.length) onSourcesReady?.(waiting.map((s) => s.id));
  };

  const flipReady = (sources) => {
    const thread = getThread(sessionId);
    for (const msg of thread) {
      if (msg.role !== "source-intake") continue;
      if (!msg.sourceId || msg.status === "ready") continue;
      if (sentReadyForSourceIds.has(msg.sourceId)) continue;
      const src = sources.find((s) => s.id === msg.sourceId);
      if (!src || src.status !== "Processed") continue;
      const min = src.kind === "Video" ? MIN_LOADING_MS_VIDEO : MIN_LOADING_MS;
      const wait = (postedAt.get(src.id) ?? 0) + min - Date.now();
      if (wait > 0) {
        setTimeout(() => !disposed && flipReady(latest), wait);
        continue;
      }
      sentReadyForSourceIds.add(msg.sourceId);
      markSourceIntakeReady(sessionId, msg.sourceId);

      // A source that waits for the reader's answer → the session asks what to
      // do with it (it owns the picker + branches). Anything else already has
      // its use decided — surface whatever it produced.
      if (src.use === "waiting") askWhenArrivalIsIn(src);
      else onSourceReady?.(src.id, src);
    }
  };

  const unsubscribe = subscribeSources(sessionId, (sources) => {
    latest = sources;
    // Post intake turns for any new source ids.
    for (const src of sources) {
      if (seenSourceIds.has(src.id)) continue;
      seenSourceIds.add(src.id);
      postedAt.set(src.id, Date.now());
      // Every new source in this session is a fresh upload (no library
      // re-attach in the per-session model) → post a loading intake.
      postSourceIntake(sessionId, {
        kind: src.kind,
        filename: src.filename,
        sourceId: src.id,
        status: "loading",
      });
    }

    // Repaint the thread on every source flip — intake turns derive
    // ideaCount + status live from sources-stream, so re-rendering is
    // how "Processed · N ideas" lands.
    onSourcesChange?.();

    // Flip pending intake turns to ready as their source completes.
    flipReady(sources);
  });
  return () => {
    disposed = true;
    unsubscribe();
  };
}
