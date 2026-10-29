// All prototype data — hardcoded, no network, no persistence, no randomness.
//
// One file per domain under `mocks/`; this barrel is the single import path,
// so every consumer keeps `from "./mocks.js?v=2360"`. The domains are self-contained:
// nothing under mocks/ reads anything from a sibling, which is what makes the
// split safe to keep.

export * from "./mocks/sessions.js?v=2360";
export * from "./mocks/top-posts.js?v=2360";
export * from "./mocks/sources.js?v=2360";
export * from "./mocks/ideas.js?v=2360";
export * from "./mocks/playbooks.js?v=2360";
export * from "./mocks/topics.js?v=2360";
export * from "./mocks/posts.js?v=2360";
export * from "./mocks/threads.js?v=2360";
export * from "./mocks/schedule.js?v=2360";
export * from "./mocks/connectors.js?v=2360";
export * from "./mocks/social.js?v=2360";
export * from "./mocks/objectives.js?v=2360";
export * from "./mocks/demo-brand.js?v=2360";
export * from "./mocks/voice-networks.js?v=2360";
export * from "./mocks/videos.js?v=2360";
