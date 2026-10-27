// What Archie learns for one network (flag voicePerNetwork) — voice-parts.js
// `learnNetworkVoice` lays these over the Brand voice. In the product they come
// from the account's own posts or the document it read; here, one set per
// network, for any brand.
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

// One idea, written once in the Brand voice and then the way each network reads
// it — the voice intro's « same post, its own voice » (components/voice-intro-modal.js).
// Each version follows the network's rules above. `{brand}` is the Brand's name.
export const NETWORK_VOICE_SAMPLE = {
  brand: "Scheduled reports are live: pick your metrics once and {brand} sends them to your team every Monday.",
  linkedin:
    "Nobody opens a dashboard on Monday morning.\n\nSo we stopped asking them to.\n\nPick your metrics once — {brand} sends them to your team every week.\n\nWhich number should your team see first?",
  instagram:
    "Monday's numbers, already in your inbox.\nScheduled reports are here — link in bio.\n#reporting #marketingops #mondays",
  facebook:
    "Good news for your Mondays: {brand} can now send your team's numbers for you. Which report would you set up first?",
  x: "Scheduled reports are live. Pick your metrics once, get them every Monday.",
  tiktok: "POV: your Monday report sends itself. #reporting #worksmarter",
  youtube: "How to send your team their numbers every Monday, without opening a dashboard. Full walkthrough below.",
};

// What makes each network's voice its own, in a few words — the chips under
// the voice intro's post, and its Playbook card once a voice is learned.
export const NETWORK_VOICE_TRAITS = {
  linkedin: ["Longer", "One idea per line", "Ends on a question"],
  instagram: ["Short caption", "Link in bio", "Hashtags at the end"],
  facebook: ["Warmer", "Under 80 words", "Asks for a comment"],
  x: ["One point", "Under 280 characters", "No hashtags"],
  tiktok: ["One spoken line", "Two or three hashtags"],
  youtube: ["What you'll get first", "Then the link"],
};
