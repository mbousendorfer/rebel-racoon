// ---- Objective tier presentation -------------------------------------------
//
// The verdict itself is COUNTED, and it has one home: objectiveVerdict() in
// objective-measures.js (all measures on track → On track, none and at least one
// off → Off track, else At risk). This file used to hold a SECOND, weighted scorer — effectiveScore /
// playbookScore / objectiveTier, with a trend penalty and an equal-weight
// Playbook average — that drove the deleted Performance page's brand grades and,
// latterly, only the chat's off-track alert. The alert reads the counted verdict
// now (session.js), so the weighted engine is gone; two engines that agreed "by
// construction" is one too many.
//
// What stays is the tier's presentation, shared so no surface invents its own
// word or colour for the same verdict.

export const TIER_LABELS = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};

// `.ap-status` modifiers. tagOrange, not orange: plain orange is the brand's
// AI/spotlight colour, never a state.
export const TIER_STATUS_CLASS = {
  "on-track": "green",
  "at-risk": "tagOrange",
  "off-track": "red",
};

// Ranking for "needs attention first".
export const TIER_ORDER = { "off-track": 0, "at-risk": 1, "on-track": 2 };
