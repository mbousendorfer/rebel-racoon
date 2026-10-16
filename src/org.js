// Who I am, and who else is in my organisation.
//
// This is CONFIG, not content — the same split as ff-catalog.js vs mocks.js. A
// brand-new user (`new-alt` mode) still has an identity and still belongs to an
// org, so this file must ship with the app and never be seeded away.
//
// There are no avatar images anywhere in the prototype, so a person is drawn
// from their initials (.ap-avatar-initials), the way social-post-card already
// draws the authors of someone else's posts.

const ROLE_KEY = "archie-org-role";

export const CURRENT_USER = { id: "u-me", name: "Matt Bousendorfer", initials: "MB" };

// The colleagues a shared Playbook can belong to, be handed over to, or be
// shared with by name. Twelve, and no longer four: once the Share dialog got a
// people picker, a list of three next to "All 12 of them" was a contradiction
// the reader could see. The count is derived from the list below for the same
// reason — the two can't drift.
// `profiles` is which social accounts this person can reach in Agorapulse —
// "all", or a list of profile ids from mocks/social.js. It is a PLATFORM
// permission, not an Archie one (CONCEPTS.md §6: the account catalogue belongs
// to Agorapulse), and the only reason it lives here is that a Playbook tied to
// a profile can't be shared with someone who can't see that profile (doc §7).
// `canApprove` — an Agorapulse role permission: whether a draft can be assigned
// to this person for review (assign-modal.js greys out the others, with why).
export const MEMBERS = [
  { ...CURRENT_USER, profiles: "all", canApprove: true },
  { id: "u-sam", name: "Sam Rivera", initials: "SR", profiles: ["fb-page", "ig", "li"], canApprove: true },
  { id: "u-lea", name: "Léa Mercier", initials: "LM", profiles: "all", canApprove: true },
  { id: "u-jonas", name: "Jonas Beck", initials: "JB", profiles: ["li", "x"], canApprove: true },
  { id: "u-nina", name: "Nina Kowalski", initials: "NK", profiles: ["li", "ig"], canApprove: true },
  { id: "u-tom", name: "Tom Ellery", initials: "TE", profiles: ["fb-page"], canApprove: false },
  { id: "u-priya", name: "Priya Raman", initials: "PR", profiles: "all", canApprove: true },
  { id: "u-marc", name: "Marc Aubert", initials: "MA", profiles: ["x"], canApprove: true },
  { id: "u-dara", name: "Dara Okonkwo", initials: "DO", profiles: ["li"], canApprove: false },
  // A new joiner, with nothing assigned yet — the row that proves the gate.
  { id: "u-hugo", name: "Hugo Vasseur", initials: "HV", profiles: [], canApprove: false },
  { id: "u-yuki", name: "Yuki Tanaka", initials: "YT", profiles: ["ig", "li"], canApprove: true },
  { id: "u-ines", name: "Inès Ferrand", initials: "IF", profiles: ["fb-page", "li"], canApprove: true },
];

// People outside the org who review through Agorapulse's external approval link
// (a client, an agency partner). No seat, so no profile gate: anyone here can be
// sent drafts. CONFIG like MEMBERS — ships in new-alt.
export const EXTERNAL_REVIEWERS = [
  { id: "x-julie", name: "Julie Moreau", initials: "JM", org: "Acme · client", external: true },
  { id: "x-ben", name: "Ben Ashford", initials: "BA", org: "Northwind Agency", external: true },
];

/** A member or an external reviewer, by id. */
export function getReviewer(id) {
  return getMember(id) || EXTERNAL_REVIEWERS.find((r) => r.id === id) || null;
}

// Can this person reach that social profile? No profile asked about ⇒ yes,
// which is what keeps the gate invisible for the Playbooks (most of them) that
// aren't tied to one.
export function hasProfileAccess(memberId, profileId) {
  if (!profileId) return true;
  const member = getMember(memberId);
  if (!member) return false;
  if (member.profiles === "all") return true;
  return Array.isArray(member.profiles) && member.profiles.includes(profileId);
}

export const ORG = { id: "org-agorapulse", name: "Agorapulse", memberCount: MEMBERS.length };

export function getMember(id) {
  return MEMBERS.find((m) => m.id === id) || null;
}

// A name to put in a sentence when the member record is gone (someone who left
// the org, a seed pointing at nobody).
export function memberName(id) {
  return getMember(id)?.name || "a teammate";
}

// "member" | "manager" — the prototype control that lets one browser session
// look at a shared Playbook through a manager's eyes. Same shape as
// user-mode.js: read synchronously at render time, toggling reloads.
export function getRole() {
  try {
    return window.localStorage.getItem(ROLE_KEY) === "manager" ? "manager" : "member";
  } catch {
    return "member";
  }
}

export function setRole(role) {
  try {
    if (role === "manager") window.localStorage.setItem(ROLE_KEY, "manager");
    else window.localStorage.removeItem(ROLE_KEY);
  } catch {
    // ignore
  }
}

export function isManager() {
  return getRole() === "manager";
}
