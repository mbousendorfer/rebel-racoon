// /welcome-alt — a redirect: the first-time run starts on its intro
// (welcome-alt-intro.js), then the shell's steps (welcome-alt-shell.js,
// -steps, -ready). The chat onboarding it used to start was deleted with the
// flag connectFirst (2026-10-29).

export function renderWelcomeAlt(_params, _target) {
  // replace, so Back from the intro doesn't bounce here and forward again.
  window.location.replace("#/welcome-alt/intro");
  return () => {};
}
