// The shared "How it works" block of the Batch and Clip studios.

// Shared "How it works" flow block (styles/components/workflow-flow.css) — used
// by both the Batch and Clip studios so the two workflows read identically. Each
// step is a coloured icon chip + title + a sentence, laid on a gradient rail
// (input → AI → output). Marketing-grade, icons + text only, no illustrations.
// `tone` drives the chip colour: "in" (blue) · "ai" (mermaid gradient) · "out"
// (green).
export function buildWorkflowFlow(steps) {
  return `
    <ol class="workflow-flow">
      ${steps
        .map(
          (s) => `
        <li class="workflow-flow__step workflow-flow__step--${s.tone}">
          <span class="workflow-flow__head">
            <span class="workflow-flow__chip workflow-flow__chip--${s.tone}">
              <i class="${s.icon}" aria-hidden="true"></i>
            </span>
            <span class="workflow-flow__title">${s.title}</span>
          </span>
          <span class="workflow-flow__text">${s.text}</span>
        </li>`,
        )
        .join("")}
    </ol>`;
}
