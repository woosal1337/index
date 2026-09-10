export type LearningPoint = {
  index?: string;
  title: string;
  explanation: string;
};

export type LearningDetailGroup = {
  title: string;
  description: string;
  points: LearningPoint[];
};

export type LearningDetails = {
  label: string;
  countLabel: string;
  description: string;
  groups: LearningDetailGroup[];
};

export type LearningItem = {
  slug: string;
  step: string;
  author: string;
  publication: string;
  publishedAt: string;
  useWhen: string;
  takeaways: string[];
  sourceLinkLabel: string;
  details: LearningDetails;
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
        details: {
          label: "Explore the full intent framework",
          countLabel: "8 intents and 6 controls",
          description:
            "An Index summary of eight user intents and six behavior controls. Use it to choose the right surface before you write a prompt.",
          groups: [
            {
              title: "Eight user intents",
              description: "Each intent needs a different workflow, interface, and success measure.",
              points: [
                {
                  index: "01",
                  title: "Know and learn",
                  explanation:
                    "Reduce uncertainty with structured answers, visible sources, editable scope, and clear paths into deeper evidence.",
                },
                {
                  index: "02",
                  title: "Create",
                  explanation:
                    "Make the artifact the main surface. Support local edits, alternate drafts, version history, and undo.",
                },
                {
                  index: "03",
                  title: "Delegate",
                  explanation:
                    "Show a plan before action, progress during action, and a clear receipt with review and recovery controls.",
                },
                {
                  index: "04",
                  title: "Oversee",
                  explanation:
                    "Route risk and uncertainty into a review queue with evidence, context, and direct approve, reject, and edit actions.",
                },
                {
                  index: "05",
                  title: "Monitor",
                  explanation:
                    "Turn continuous signals into low-noise digests with visible coverage, editable rules, and user-controlled timing.",
                },
                {
                  index: "06",
                  title: "Find and explore",
                  explanation:
                    "Convert messy input into filters, ranked options, comparison tools, and a shortlist that stays available.",
                },
                {
                  index: "07",
                  title: "Play",
                  explanation:
                    "Use presets, clear choices, session structure, and time boundaries to support safe and low-effort entertainment.",
                },
                {
                  index: "08",
                  title: "Connect",
                  explanation:
                    "Set the relationship role and boundaries. Support continuity, safe exits, and escalation to real people when necessary.",
                },
              ],
            },
            {
              title: "Behavior controls",
              description: "Tune these controls for the intent, the stakes, and the user.",
              points: [
                {
                  title: "Personalization",
                  explanation:
                    "Set how much the system adapts to a person's data, preferences, context, and past work.",
                },
                {
                  title: "Initiative",
                  explanation: "Choose when the system waits, suggests a next step, or starts a useful action.",
                },
                {
                  title: "Autonomy",
                  explanation:
                    "Set the distance between advice and action, with approval gates that match the possible harm.",
                },
                {
                  title: "Tone",
                  explanation: "Choose an emotional posture that fits the task, from neutral and factual to supportive.",
                },
                {
                  title: "Transparency",
                  explanation:
                    "Decide when to show sources, assumptions, steps, confidence limits, tool use, and costs.",
                },
                {
                  title: "Risk appetite",
                  explanation:
                    "Balance exploratory options against conservative answers that favor precision and predictable results.",
                },
              ],
            },
          ],
        },
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
        details: {
          label: "Explore all 39 principles",
          countLabel: "39 principles",
          description:
            "An Index summary of the source framework. Each card turns one principle into a product decision.",
          groups: [
            {
              title: "Probabilistic foundation",
              description: "Design for inference, generation, and variable output.",
              points: [
                {
                  index: "01",
                  title: "Use AI for suitable work",
                  explanation:
                    "Use AI for messy, ambiguous, generative, or synthesis work. Keep exact state changes in deterministic controls.",
                },
                {
                  index: "02",
                  title: "Treat variation as working material",
                  explanation:
                    "Let users compare drafts, save alternatives, regenerate, and edit instead of treating the first result as final.",
                },
                {
                  index: "03",
                  title: "Match the interface to the task",
                  explanation:
                    "Use inline help for small tasks, conversation for exploration, and plans with checkpoints for consequential work.",
                },
              ],
            },
            {
              title: "Expectation setting",
              description: "Set a clear mental model before the first output.",
              points: [
                {
                  index: "04",
                  title: "State the scope and limits",
                  explanation:
                    "Explain the available capabilities, context, accuracy, and coverage limits before the user relies on a result.",
                },
                {
                  index: "05",
                  title: "Help the user start",
                  explanation:
                    "Use examples, templates, suggested actions, and structured inputs to remove the empty-prompt problem.",
                },
                {
                  index: "06",
                  title: "Present output as a draft",
                  explanation:
                    "Use labels such as draft, suggestion, or review so users know that they must inspect the result.",
                },
                {
                  index: "07",
                  title: "Mark AI involvement",
                  explanation:
                    "Distinguish generated, transformed, ranked, human-authored, and source material so attribution stays clear.",
                },
                {
                  index: "08",
                  title: "Match controls to expertise",
                  explanation:
                    "Give novices wayfinders, experts configuration and override controls, and auditors logs with repeatable evidence.",
                },
                {
                  index: "09",
                  title: "Describe the system honestly",
                  explanation:
                    "Give the AI a clear role without implying feelings, human judgment, or abilities it does not have.",
                },
              ],
            },
            {
              title: "Calibrated trust",
              description: "Help reliance match the system's real reliability.",
              points: [
                {
                  index: "10",
                  title: "Show where claims come from",
                  explanation: "Connect important claims to their sources, tools, records, and input data.",
                },
                {
                  index: "11",
                  title: "Prefer evidence to confidence scores",
                  explanation:
                    "Show the source passage, changed lines, or tool result instead of a number that can create false trust.",
                },
                {
                  index: "12",
                  title: "Make checks fast",
                  explanation:
                    "Use direct links, highlights, previews, and diffs so a user can check important output at a glance.",
                },
                {
                  index: "13",
                  title: "Reject hidden objectives",
                  explanation:
                    "Serve the stated task. Do not let engagement, retention, or sales goals quietly change the AI's behavior.",
                },
                {
                  index: "14",
                  title: "Support honest disagreement",
                  explanation:
                    "Correct false assumptions, flag weak evidence, and show counterarguments instead of agreeing to please the user.",
                },
                {
                  index: "15",
                  title: "Credit creators and sources",
                  explanation:
                    "Keep attribution and source relationships visible. State content limits when retrieved or licensed work shapes the output.",
                },
              ],
            },
            {
              title: "Transparency",
              description: "Make the system understandable without making the main workflow noisy.",
              points: [
                {
                  index: "16",
                  title: "Answer five inspection questions",
                  explanation:
                    "Show what happened, which inputs mattered, why this result appeared, why alternatives lost, and what can change it.",
                },
                {
                  index: "17",
                  title: "Layer the explanation",
                  explanation:
                    "Show the shortest useful reason first. Keep assumptions, methods, sources, traces, and logs available on demand.",
                },
                {
                  index: "18",
                  title: "Show plans and traces",
                  explanation:
                    "Show the plan before multi-step work, useful progress during it, and a receipt with review and undo after it.",
                },
              ],
            },
            {
              title: "Control and agency",
              description: "Return control as soon as the user needs it.",
              points: [
                {
                  index: "19",
                  title: "Make suggestions easy to dismiss",
                  explanation:
                    "Let users accept, ignore, edit, undo, regenerate, or revert a suggestion without breaking their current flow.",
                },
                {
                  index: "20",
                  title: "Ask only when uncertainty matters",
                  explanation:
                    "Ask a specific question when ambiguity changes the result or raises risk. Otherwise, state the assumption and continue.",
                },
                {
                  index: "21",
                  title: "Offer local and global controls",
                  explanation:
                    "Let users shape one result and set standing rules for memory, data access, automation, and defaults.",
                },
                {
                  index: "22",
                  title: "Respect the user's attention",
                  explanation:
                    "Interrupt only when the value of timely help exceeds the cost of breaking focus.",
                },
                {
                  index: "23",
                  title: "Keep assistance accessible",
                  explanation:
                    "Make edits, citations, warnings, voice flows, and traces work with keyboards, assistive technology, and different cognitive needs.",
                },
                {
                  index: "24",
                  title: "Name the rule behind behavior",
                  explanation:
                    "Show whether a user choice, administrator policy, safety rule, privacy limit, technical constraint, or placement shaped the result.",
                },
              ],
            },
            {
              title: "Graceful failure",
              description: "Design recovery for expected errors and uncertainty.",
              points: [
                {
                  index: "25",
                  title: "Limit the effect of errors",
                  explanation:
                    "Use previews, checkpoints, history, rollback, and logs that match the possible consequences of a mistake.",
                },
                {
                  index: "26",
                  title: "Match precision to evidence",
                  explanation:
                    "Use ranges, options, or partial answers when evidence is weak. Mark the parts that need human review.",
                },
                {
                  index: "27",
                  title: "Carry context into a handoff",
                  explanation:
                    "Send the summary, unresolved questions, completed actions, and relevant data when a person must take over.",
                },
                {
                  index: "28",
                  title: "Make refusal a useful route",
                  explanation:
                    "State the limit and the reason, then offer the nearest safe action that still supports the goal.",
                },
              ],
            },
            {
              title: "Co-creation",
              description: "Keep generated work open to direct change.",
              points: [
                {
                  index: "29",
                  title: "Keep output editable",
                  explanation:
                    "Support in-place edits, selected regeneration, version comparison, and continued work from the current state.",
                },
                {
                  index: "30",
                  title: "Add friction before commitment",
                  explanation:
                    "Keep exploration fluid. Add review before a user publishes, sends, approves, or commits a consequential result.",
                },
                {
                  index: "31",
                  title: "Expose intent controls",
                  explanation:
                    "Use examples and structured controls so users can express intent without learning hidden prompt techniques.",
                },
              ],
            },
            {
              title: "Responsible autonomy",
              description: "Constrain action through stakes, permission, and reversibility.",
              points: [
                {
                  index: "32",
                  title: "Scale autonomy with risk",
                  explanation:
                    "Automate low-risk reversible work, notify for moderate work, and require approval for irreversible or high-risk action.",
                },
                {
                  index: "33",
                  title: "Make data access revocable",
                  explanation:
                    "Show what data the system can use and why. Ask before wider access and make removal easy.",
                },
                {
                  index: "34",
                  title: "Protect other people's privacy",
                  explanation:
                    "Do not expose, combine, or infer sensitive details about people who did not choose the interaction.",
                },
                {
                  index: "35",
                  title: "Separate data from instructions",
                  explanation:
                    "Keep instructions, reference data, tools, and allowed actions distinct so untrusted content cannot control the system.",
                },
              ],
            },
            {
              title: "Sustained reliance",
              description: "Maintain useful behavior as cost, quality, models, and data change.",
              points: [
                {
                  index: "36",
                  title: "Explain the wait",
                  explanation:
                    "Show meaningful stages, tool activity, and progress. Offer cancel or background options for long work.",
                },
                {
                  index: "37",
                  title: "Show cost when it changes a choice",
                  explanation:
                    "Expose time, money, energy, rate limits, or credits when that information helps users choose an approach.",
                },
                {
                  index: "38",
                  title: "Measure healthy reliance",
                  explanation:
                    "Measure quality, correction, and appropriate use. Do not treat acceptance, regeneration, or session length as success alone.",
                },
                {
                  index: "39",
                  title: "Prepare for model and data changes",
                  explanation:
                    "Version important behavior, use evaluations, and test reliance again when a model or data source changes.",
                },
              ],
            },
          ],
        },
      },
    ],
  },
];
