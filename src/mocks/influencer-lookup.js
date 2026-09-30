// What the networks' APIs answer when a pasted influencer profile is checked.
// Seed data only — no network, no persistence, no randomness.
// Re-exported by ../mocks.js, which stays the single import path.
//
// Keyed `network:handle`, lower-case. A handle missing from this table is
// answered as an active creator account, named after its handle: the check has
// to accept whatever a demo types, and only the refusals need seeding.
//
// `kind` mirrors the three answers the V1 check can give on a supported network:
// "creator" (Instagram business/creator account, Facebook Page, YouTube channel)
// is accepted; "personal" and "inactive" are refused with the reason printed.

export const influencerLookup = {
  "instagram:mattnavarra": { kind: "creator", name: "Matt Navarra" },
  "instagram:later": { kind: "creator", name: "Later" },
  "instagram:jane.doe": { kind: "personal", name: "Jane Doe" },
  "instagram:oldbrandclub": { kind: "inactive", name: "Old Brand Club" },
  "facebook:socialmediatoday": { kind: "creator", name: "Social Media Today" },
  "youtube:socialmediaexaminer": { kind: "creator", name: "Social Media Examiner" },
  "youtube:neilpatel": { kind: "creator", name: "Neil Patel" },
};
