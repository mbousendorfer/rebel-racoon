// The workflow starters of the new chat's hero (session/empty-hero.js).
//
// Pure: strings in, string out. No DOM, no listeners, no session. The host
// dispatches `[data-starter-action]` (the chat runs the flow in place).
//
// The CSS lives in styles/screens/session.css (`.starter-grid`, `.starter-card`
// and its tones).

import { chatStarters } from "../mocks.js?v=2935";
import { escapeHtml } from "../utils.js?v=2935";

/**
 * The starter cards' markup, ready to drop inside a `.starter-grid`.
 *
 * `sourceLabel` / `videoLabel` resolve the `{{source}}` / `{{video-source}}`
 * placeholders a prompt-kind starter carries. A host with no sources to name —
 * the home, a first-run chat — leaves them at their defaults, which is the same
 * text the hero has always shown when a chat is empty.
 */
export function renderStarterCards({ sourceLabel = "your source", videoLabel = "your video", rows = false } = {}) {
  return chatStarters
    .map((s) => {
      const tone = s.tone || "orange";
      // `rows` (flag newChatHero): the same starter as a one-line row — tinted
      // icon tile + title + its description. Same data-* hooks, so the host's
      // delegation doesn't know which shape it got.
      if (rows) {
        if (s.comingSoon) return "";
        const rowPrompt = (s.prompt || "")
          .replace(/\{\{source\}\}/g, sourceLabel)
          .replace(/\{\{video-source\}\}/g, videoLabel);
        const rowAction = s.action ? ` data-starter-action="${s.action}"` : "";
        return `
          <button type="button" class="starter-row" data-starter="${s.id}"${rowAction} data-starter-prompt="${escapeHtml(rowPrompt)}">
            <span class="starter-row__icon starter-card--${tone}" aria-hidden="true"><i class="${s.icon}"></i></span>
            <span class="starter-row__text">
              <span class="starter-row__label">${s.title}</span>
              <span class="starter-row__desc">${s.subtitle}</span>
            </span>
            <i class="starter-row__arrow ap-icon-arrow-right" aria-hidden="true"></i>
          </button>
        `;
      }
      // `comingSoon` cards are teasers — a non-interactive panel carrying a
      // "Coming soon" badge instead of a clickable CTA arrow.
      if (s.comingSoon) {
        return `
          <div class="starter-card starter-card--${tone} starter-card--soon" data-starter="${s.id}" aria-disabled="true">
            <i class="starter-card__art ${s.icon}" aria-hidden="true"></i>
            <span class="starter-card__title">${s.title}</span>
            <span class="starter-card__subtitle">${s.subtitle}</span>
            <span class="starter-card__cta--soon ap-badge blue">${s.cta}</span>
          </div>
        `;
      }
      const resolvedPrompt = (s.prompt || "")
        .replace(/\{\{source\}\}/g, sourceLabel)
        .replace(/\{\{video-source\}\}/g, videoLabel);
      const actionAttr = s.action ? ` data-starter-action="${s.action}"` : "";
      return `
        <button type="button" class="starter-card starter-card--${tone}" data-starter="${s.id}"${actionAttr} data-starter-prompt="${escapeHtml(resolvedPrompt)}">
          <i class="starter-card__art ${s.icon}" aria-hidden="true"></i>
          <span class="starter-card__title">${s.title}</span>
          <span class="starter-card__subtitle">${s.subtitle}</span>
          <span class="starter-card__cta ap-link standalone small">${s.cta}<i class="ap-icon-arrow-right" aria-hidden="true"></i></span>
        </button>
      `;
    })
    .join("");
}
