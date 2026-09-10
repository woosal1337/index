export type LearningItem = {
  slug: string;
  step: string;
  author: string;
  publication: string;
  publishedAt: string;
  useWhen: string;
  takeaways: string[];
  sourceLinkLabel: string;
};

export type LearningTrack = {
  id: string;
  title: string;
  description: string;
  outcome: string;
  items: LearningItem[];
};

export const learningTracks: LearningTrack[] = [
  {
    id: "human-ai-interaction",
    title: "Human-AI interaction",
    description:
      "Start with the job the user wants done. Then set rules for evidence, control, correction, and autonomy.",
    outcome:
      "You can choose an interface for an AI feature and review whether it supports appropriate reliance.",
    items: [
      {
        slug: "beyond-chat-8-core-user-intents",
        step: "Start with intent",
        author: "Taras Bakusevych",
        publication: "Syntax Stream",
        publishedAt: "2026-01-12",
        useWhen: "Use this before you choose chat, a canvas, a queue, a digest, or a list.",
        takeaways: [
          "Match the interface to the primary user intent.",
          "Define a success measure for that intent.",
          "Tune initiative, autonomy, transparency, tone, and risk separately.",
        ],
        sourceLinkLabel: "Read the 8-intent framework",
      },
      {
        slug: "39-principles-human-ai-interaction",
        step: "Apply the principles",
        author: "Taras Bakusevych",
        publication: "Syntax Stream",
        publishedAt: "2026-06-30",
        useWhen: "Use this to review an AI feature before development or release.",
        takeaways: [
          "Show evidence and make important output fast to check.",
          "Keep correction, rejection, undo, and escalation close to the result.",
          "Limit autonomy according to stakes, permission, and reversibility.",
        ],
        sourceLinkLabel: "Read the 39 principles",
      },
    ],
  },
];
