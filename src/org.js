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

export const ORG = { id: "org-agorapulse", name: "Agorapulse", memberCount: 12 };

// The colleagues a shared Playbook can belong to, or be handed over to. Small
// on purpose: this list exists to make ownership legible, not to model an org
// chart.
export const MEMBERS = [
  CURRENT_USER,
  { id: "u-sam", name: "Sam Rivera", initials: "SR" },
  { id: "u-lea", name: "Léa Mercier", initials: "LM" },
  { id: "u-jonas", name: "Jonas Beck", initials: "JB" },
];

export function getMember(id) {
  return MEMBERS.find((m) => m.id === id) || null;
}

// A name to put in a sentence when the member record is gone (someone who left
// the org, a seed pointing at nobody).
export function memberName(id) {
  return getMember(id)?.name || "a teammate";
}

export function isMe(id) {
  return id === CURRENT_USER.id;
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
