// Tiny session-storage hand-off layer used to pass user intent across
// navigations (dashboard → session, session → another session, etc.).
//
// Each entry is single-use: consumeHandoff() reads-and-removes atomically,
// so a handoff can never fire twice for one navigation.

export function setHandoff(key, payload) {
  sessionStorage.setItem(key, JSON.stringify(payload));
}

export function consumeHandoff(key) {
  const raw = sessionStorage.getItem(key);
  if (raw == null) return null;
  sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
