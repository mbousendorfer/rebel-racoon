// "Generate an image" on a draft, asked in the conversation (flag sexySquirrel).
//
// The empty image slot's button used to drop a picture in one click with no way
// to steer it. Under the flag, the chat asks the MINIMUM instead — three
// Quickpickers, the last two only when they have something to decide:
//
//   1. Style   the Playbook's own styles first, then one preset per family, as
//              pictures in the brand's colours; "More options" opens the studio
//   2. Shape   only when the draft's network publishes more than one
//   3. Text    a line lifted from the post, no text, or the user's own
//
// With a default look on the Playbook (Brand › Generate image — a style or a
// reference image, plus a shape per network), 1 and 2 are not asked at all.
//
// What the image SHOWS is not asked: it is read from the post, like the studio's
// "Suggest from the post". Then ONE image, straight into the draft, and a
// last Quickpicker for what next (keep it · try another · refine in the studio).
//
// The two reads from the post take as long as the real calls (4–8 s), so both
// start the moment the flow does and are usually back before they are needed.

import * as inlineQuestion from "./inline-question.js?v=1553";
import { finishPending, postAssistantMessage, postUserTurn, startPending } from "./assistant.js?v=1553";
import { attachImageToDraft, getPosts, updatePostContent } from "./posts-store.js?v=1553";
import { getSessionById } from "./sessions-store.js?v=1553";
import { escapeHtml } from "./utils.js?v=1553";
import {
  defaultQuickLook,
  generateQuickImage,
  quickImageChoices,
  suggestImageLine,
  suggestImageSubject,
} from "./modules/image-studio/index.js?v=1553";

const STUDIO = "__studio";
const NO_TEXT = "__none";
const SUGGESTED = "__line"; // the line itself stays out of the attribute the picker writes it to
const FALLBACK_SUBJECT = "One simple object that stands for the idea, on a plain background. No text in the image.";

const postText = (post) => (Array.isArray(post.text) ? post.text.join("\n") : post.text || "");

/**
 * @param {string} sessionId
 * @param {string} postId
 * @param {{ openStudio: () => void, repaint: () => void }} host — the drafts panel:
 *   how to open the draft's studio, and how to redraw the panel while it waits
 */
export function startDraftImageFlow(sessionId, postId, { openStudio, repaint }) {
  const post = getPosts(sessionId).find((p) => p.id === postId);
  if (!post) return;
  const brandId = getSessionById(sessionId)?.contextId || null;
  const choices = quickImageChoices({ brandId, network: post.network });
  if (!choices || !choices.styles.length) {
    postAssistantMessage(
      sessionId,
      "This chat has no Playbook, so I don't know whose image to make. Pick one for the chat, then ask me again.",
    );
    return;
  }
  const text = postText(post);
  const subject = suggestImageSubject({ brandId, text }).catch(() => FALLBACK_SUBJECT);
  const line = suggestImageLine(text).catch(() => "");
  const askShapes = choices.shapes.length > 1;
  let total = askShapes ? 3 : 2;
  let usedDefault = false; // the Playbook's default look answered style + shape
  const answers = { style: null, shape: choices.shapes[0], headline: "" };
  const cancel = () => postAssistantMessage(sessionId, "No problem — the draft stays as it is.");

  function toStudio() {
    inlineQuestion.exit(sessionId);
    openStudio();
  }

  // 1 — the style, as pictures.
  function askStyle({ announce = true } = {}) {
    if (announce) postAssistantMessage(sessionId, "Let's make an image for this post. Which style should it be in?");
    inlineQuestion.ask(sessionId, {
      title: "Pick a style",
      subtitle: `In ${escapeHtml(choices.brandName)}'s colours.`,
      stepLabel: `1 of ${total}`,
      variant: "cards",
      skipLabel: "Not now",
      items: choices.styles.map((s) => ({
        value: s.id,
        label: escapeHtml(s.label),
        caption: s.isDefault ? "Default style" : s.mine ? "Your style" : "",
        preview: `<img class="draft-image-flow__style" src="${s.thumbUrl}" alt="" />`,
      })),
      footerAction: { value: STUDIO, label: "More options in the studio", icon: "ap-icon-image" },
      onPick: (id) => {
        if (id === STUDIO) return toStudio();
        answers.style = choices.styles.find((s) => s.id === id);
        postUserTurn(sessionId, escapeHtml(answers.style.label));
        if (askShapes) askShape();
        else askText();
      },
      onSkip: cancel,
    });
  }

  // 2 — the shape, only when the network has a choice to make.
  function askShape({ announce = true } = {}) {
    if (announce) postAssistantMessage(sessionId, "Which shape?");
    inlineQuestion.ask(sessionId, {
      title: "Pick a shape",
      subtitle: "The ones this network publishes.",
      stepLabel: `2 of ${total}`,
      variant: "cards",
      items: choices.shapes.map((s) => ({
        value: s.id,
        label: escapeHtml(s.label),
        // The clip flow's proportion tile: the frame at its ratio, the ratio in it.
        preview: `<span class="ratio-tile"><span class="ratio-tile__frame" style="aspect-ratio:${s.w}/${s.h}"></span><span class="ratio-tile__tag">${s.ratio}</span></span>`,
      })),
      onPick: (id) => {
        answers.shape = choices.shapes.find((s) => s.id === id);
        postUserTurn(sessionId, `${escapeHtml(answers.shape.label)} · ${answers.shape.ratio}`);
        askText();
      },
      onBack: () => askStyle({ announce: false }),
    });
  }

  // 3 — the words on the image: the post's own line, none, or the user's.
  async function askText() {
    const pending = startPending(sessionId, "Reading the post for a line");
    const suggested = await line;
    finishPending(sessionId, pending);
    postAssistantMessage(sessionId, "Any text on the image?");
    const items = [
      ...(suggested ? [{ value: SUGGESTED, label: escapeHtml(suggested), caption: "A line from the post" }] : []),
      { value: NO_TEXT, label: "No text", caption: "Just the picture" },
    ];
    inlineQuestion.ask(sessionId, {
      title: "Text on the image",
      subtitle: "It stays an editable layer — you can change it in the studio.",
      stepLabel: `${total} of ${total}`,
      items,
      customPlaceholder: "Or write your own line…",
      onPick: (value) => {
        answers.headline = value === SUGGESTED ? suggested : "";
        postUserTurn(sessionId, answers.headline ? `“${escapeHtml(answers.headline)}”` : "No text");
        generate();
      },
      onCustom: (value) => {
        answers.headline = String(value || "").trim();
        postUserTurn(sessionId, answers.headline ? `“${escapeHtml(answers.headline)}”` : "No text");
        generate();
      },
      // From the default look there is nothing to go back to — "Refine it in the studio" follows.
      onBack: usedDefault
        ? undefined
        : () => (askShapes ? askShape({ announce: false }) : askStyle({ announce: false })),
    });
  }

  // One image, into the draft; the slot shows it being made meanwhile.
  async function generate() {
    const pending = startPending(sessionId, `Making it in ${answers.style.label}`);
    updatePostContent(sessionId, postId, { isGeneratingImage: true });
    repaint();
    try {
      const url = await generateQuickImage({
        brandId,
        prompt: await subject,
        styleId: answers.style.id,
        formatId: answers.shape.formatId,
        headline: answers.headline,
      });
      finishPending(sessionId, pending);
      // The draft may have been deleted, or given an image, while this ran.
      if (getPosts(sessionId).some((p) => p.id === postId)) attachImageToDraft(sessionId, postId, url);
      updatePostContent(sessionId, postId, { isGeneratingImage: false });
      repaint();
      postAssistantMessage(
        sessionId,
        `Done — it's in [[post:${postId}]], in ${escapeHtml(answers.style.label)}, ${escapeHtml(answers.shape.label.toLowerCase())}.`,
      );
      askNext();
    } catch {
      finishPending(sessionId, pending);
      updatePostContent(sessionId, postId, { isGeneratingImage: false });
      repaint();
      postAssistantMessage(sessionId, "That one didn't come out. Shall I try again?");
      inlineQuestion.ask(sessionId, {
        title: "Try again?",
        items: [
          { value: "again", label: "Try again", icon: "ap-icon-refresh" },
          { value: "studio", label: "Open the studio instead", icon: "ap-icon-image" },
        ],
        skipLabel: "Not now",
        onPick: (v) => (v === "again" ? generate() : toStudio()),
        onSkip: cancel,
      });
    }
  }

  function askNext() {
    inlineQuestion.ask(sessionId, {
      title: "What next?",
      items: [
        { value: "keep", label: "Keep it", icon: "ap-icon-check" },
        { value: "again", label: "Try another", caption: "Same choices, a new image", icon: "ap-icon-refresh" },
        {
          value: "studio",
          label: "Refine it in the studio",
          caption: "Layers, crop, other styles",
          icon: "ap-icon-image",
        },
      ],
      onPick: (v) => {
        if (v === "again") {
          postUserTurn(sessionId, "Try another");
          generate();
        } else if (v === "studio") toStudio();
        else inlineQuestion.exit(sessionId);
      },
    });
  }

  // The Playbook's default look (Brand › Generate image) answers the style AND
  // the shape: its preferred shape for this network is already first. Only the
  // text is asked — it is about this post, which no default can know.
  (async () => {
    const look = await defaultQuickLook(brandId);
    if (!look) return askStyle();
    answers.style = look;
    total = 1;
    postAssistantMessage(
      sessionId,
      `Let's make an image for this post — in ${escapeHtml(look.label)}, ${escapeHtml(answers.shape.label.toLowerCase())}, as the Playbook says.`,
    );
    usedDefault = true;
    askText();
  })();
}
