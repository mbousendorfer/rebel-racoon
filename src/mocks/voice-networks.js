// What Archie changes when it optimizes the Brand voice for one network
// (flag voicePerNetwork) — voice-parts.js `optimizeForNetwork` lays these over
// the Brand voice. In the product they come from the account's own posts and
// the network's own recommendations; here, one set per network, for any brand.
//
//   summary  a sentence added to "How the Brand sounds"
//   add      rules added to a part, in the part's own shape ({ text } or, for
//            voiceByPost, { when, text })

export const NETWORK_VOICE_ADAPTATIONS = {
  linkedin: {
    summary: "On LinkedIn I write longer, one idea per line, and end on a question to the reader.",
    add: {
      voiceAlways: [{ text: "One idea per line, with a blank line between them." }],
      voiceNever: [{ text: "More than three hashtags, and never in the middle of a sentence." }],
      voiceByPost: [
        { when: "Lesson or opinion", text: "Open on the claim in one line, then the story that proves it." },
      ],
    },
  },
  instagram: {
    summary: "On Instagram the image does the talking: the caption is short and says what to look at.",
    add: {
      voiceAlways: [{ text: "The point fits in the first two lines, before “more”." }],
      voiceNever: [{ text: "A link in the caption — it points to the bio." }],
      voiceSometimes: [{ text: "Three to five hashtags, at the end." }],
    },
  },
  facebook: {
    summary: "On Facebook I sound like a neighbour: warmer, shorter, and I ask people to answer.",
    add: {
      voiceAlways: [{ text: "Under 80 words." }],
      voiceSometimes: [{ text: "A question at the end that invites a comment." }],
    },
  },
  x: {
    summary: "On X I make one point per post, plainly, with nothing to cut.",
    add: {
      voiceAlways: [{ text: "One idea, under 280 characters, no thread unless it needs one." }],
      voiceNever: [{ text: "Hashtags." }],
    },
  },
  tiktok: {
    summary: "On TikTok the caption backs the video up: one line, spoken, never a summary.",
    add: {
      voiceAlways: [{ text: "One line that reads like something said out loud." }],
      voiceSometimes: [{ text: "Two or three hashtags that name the topic." }],
    },
  },
  youtube: {
    summary: "On YouTube the description tells people what they'll get, then where to go next.",
    add: {
      voiceAlways: [{ text: "The first line says what the video gives the viewer." }],
      voiceByPost: [{ when: "Short", text: "One sentence, then the link to the full video." }],
    },
  },
};
