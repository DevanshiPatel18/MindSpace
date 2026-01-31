import { Intent } from "./types";

export type RitualStep = { id: string; prompt: string; placeholder?: string };
export type Ritual = {
  id: string;
  name: string;
  intent: Intent;
  durationLabel: string;
  steps: RitualStep[];
  closingLine: string;
};

export const RITUALS: Ritual[] = [
  {
    id: "end-the-day",
    name: "End the Day",
    intent: "unload",
    durationLabel: "2 min",
    steps: [
      { id: "s1", prompt: "What’s still sitting with you from today?", placeholder: "A few lines is enough…" },
      { id: "s2", prompt: "What can wait until tomorrow?", placeholder: "Name one thing you’re letting pause…" },
    ],
    closingLine: "This is enough for now.",
  },
  {
    id: "make-sense",
    name: "Make Sense of This",
    intent: "make_sense",
    durationLabel: "5–8 min",
    steps: [
      { id: "s1", prompt: "What happened? (just the facts)", placeholder: "What happened, plainly…" },
      { id: "s2", prompt: "What did you feel?", placeholder: "Try naming emotions without judging them…" },
      { id: "s3", prompt: "What story did you tell yourself about it?", placeholder: "What did it seem to mean?" },
      { id: "s4", prompt: "What do you need right now?", placeholder: "Support, rest, clarity, boundaries…" },
    ],
    closingLine: "You did enough reflection for today.",
  },
  {
    id: "one-sentence-start",
    name: "One Sentence Start",
    intent: "help_write",
    durationLabel: "2 min",
    steps: [
      { id: "s1", prompt: "Start with one sentence: “Today I…”", placeholder: "Today I…" },
      { id: "s2", prompt: "If you want, add: “What I wish I could say is…”", placeholder: "What I wish I could say is…" },
    ],
    closingLine: "That’s a solid start.",
  },
];

export function getRitualById(id: string) {
  return RITUALS.find((r) => r.id === id) ?? null;
}
