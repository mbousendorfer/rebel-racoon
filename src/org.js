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
export const MEMBERS = [
  { ...CURRENT_USER, profiles: "all" },
  { id: "u-sam", name: "Sam Rivera", initials: "SR", profiles: ["fb-page", "ig", "li"] },
  { id: "u-lea", name: "Léa Mercier", initials: "LM", profiles: "all" },
  { id: "u-jonas", name: "Jonas Beck", initials: "JB", profiles: ["li", "x"] },
  { id: "u-nina", name: "Nina Kowalski", initials: "NK", profiles: ["li", "ig"] },
  { id: "u-tom", name: "Tom Ellery", initials: "TE", profiles: ["fb-page"] },
  { id: "u-priya", name: "Priya Raman", initials: "PR", profiles: "all" },
  { id: "u-marc", name: "Marc Aubert", initials: "MA", profiles: ["x"] },
  { id: "u-dara", name: "Dara Okonkwo", initials: "DO", profiles: ["li"] },
  // A new joiner, with nothing assigned yet — the row that proves the gate.
  { id: "u-hugo", name: "Hugo Vasseur", initials: "HV", profiles: [] },
  { id: "u-yuki", name: "Yuki Tanaka", initials: "YT", profiles: ["ig", "li"] },
  { id: "u-ines", name: "Inès Ferrand", initials: "IF", profiles: ["fb-page", "li"] },
];

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
