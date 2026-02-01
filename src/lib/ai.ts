import { z } from "zod";

const AiReplySchema = z.object({
  reflection: z.string().min(1),
  question: z.string().nullable().optional(),
});

const AiNudgeSchema = z.object({
  reflection: z.string().min(1),
  ritualId: z.enum(["end-the-day", "make-sense", "one-sentence-start"]),
  question: z.string().min(1),
});

export type AiReply = z.infer<typeof AiReplySchema>;
export type AiNudge = z.infer<typeof AiNudgeSchema>;

const RecallReplySchema = z.object({
  answer: z.string().min(1),
  relevantEntryIds: z.array(z.string()).optional(),
});
export type RecallReply = z.infer<typeof RecallReplySchema>;

const HistoryEntrySchema = z.object({
  daysAgo: z.number(),
  intent: z.enum(["unload", "make_sense", "help_write"]),
  emotion: z.string(),
  context: z.string(),
  steps: z.array(z.object({
    prompt: z.string(),
    response: z.string(),
    aiReflection: z.string().nullable().optional(),
    aiQuestion: z.string().nullable().optional(),
  })),
});

const HistoryGenSchema = z.object({
  entries: z.array(HistoryEntrySchema),
});
export type HistoryGen = z.infer<typeof HistoryGenSchema>;

type BaseOpts = {
  apiKey: string;
  model?: string;
};

function baseSystemPrompt() {
  return `
You are a private, empathetic journaling companion.

Hard rules:
- Do NOT diagnose, label disorders, or claim medical expertise.
- Do NOT claim to know the user across time or infer hidden motives.
- Do NOT moralize, shame, or judge.
- Do NOT mention "policy" or "rules".
- Use tentative language: "it sounds like", "maybe", "might".
- Be calm, grounded, and non-performative.
`.trim();
}

function stepReflectionSystemPrompt() {
  return `
${baseSystemPrompt()}

Task:
- Reflect what the user said (emotion + meaning) in 2–5 sentences.
- Ask at most ONE gentle question, or null if not needed.

Return ONLY valid JSON:
{
  "reflection": string,
  "question": string | null
}
`.trim();
}

function nudgeSystemPrompt() {
  return `
${baseSystemPrompt()}

Task:
- Suggest what would help *right now* without being pushy.
- Pick ONE ritualId from: "end-the-day" | "make-sense" | "one-sentence-start"
  - end-the-day: quick unload / de-stress
  - make-sense: structured meaning-making
  - one-sentence-start: blank-page anxiety / beginner start
- Provide a short reflection (1–3 sentences) and ONE starter question the user can answer.

Do NOT claim long-term patterns. Do NOT mention sentiment scores.

Return ONLY valid JSON:
{
  "reflection": string,
  "ritualId": "end-the-day" | "make-sense" | "one-sentence-start",
  "question": string
}
`.trim();
}

function insightsSystemPrompt() {
  return `
${baseSystemPrompt()}

Task:
- Write a gentle weekly-style reflection based ONLY on the provided on-device aggregates and user-approved "memories".
- Keep it descriptive and tentative ("It looks like", "You seemed to").
- 4–8 sentences max.
- End with ONE optional question.

Do NOT infer diagnoses or hidden causes. Do NOT claim certainty.

Return ONLY valid JSON:
{
  "reflection": string,
  "question": string | null
}
`.trim();
}

async function callChatCompletions(opts: BaseOpts & { system: string; user: string }) {
  const body = {
    model: opts.model ?? "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  };

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI failed: ${res.status} ${txt}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no content");
  
  console.log("Raw AI Response:", content);
  return JSON.parse(content);
}

/**
 * Used inside ritual steps: reflect + (optional) single follow-up question.
 */
export async function generateTrustFirstReply(opts: {
  apiKey: string;
  ritualName: string;
  stepPrompt: string;
  userText: string;
  previousText?: string;
  memories?: string[];
  model?: string;
}) {
  const userPrompt = `
Ritual: ${opts.ritualName}
Step: ${opts.stepPrompt}
${opts.previousText ? `Previous step text (same session only): ${opts.previousText}` : ""}
${opts.memories?.length ? `User-approved memories (context): \n${opts.memories.map(m => `- ${m}`).join("\n")}` : ""}

User text:
${opts.userText}
`.trim();

  const parsed = AiReplySchema.parse(
    await callChatCompletions({
      apiKey: opts.apiKey,
      model: opts.model,
      system: stepReflectionSystemPrompt(),
      user: userPrompt,
    })
  );

  return {
    reflection: parsed.reflection,
    question: parsed.question ?? null,
  };
}

/**
 * Used on Home: proposes one ritual + one starter question, based on lightweight signals.
 * (Trust-first: no raw archive is required.)
 */
export async function generateTrustFirstNudge(opts: {
  apiKey: string;
  signals: {
    streak?: number;
    lastEntryAt?: string | null;
    lastTags?: { emotion?: string | null; context?: string | null };
    memories?: string[];
  };
  model?: string;
}): Promise<AiNudge> {
  const userPrompt = `
Signals (on-device, lightweight):
- streak: ${opts.signals.streak ?? 0}
- lastEntryAt: ${opts.signals.lastEntryAt ?? "none"}
- lastTags: emotion=${opts.signals.lastTags?.emotion ?? "none"}, context=${opts.signals.lastTags?.context ?? "none"}
- memories (user-approved sentences): ${(opts.signals.memories ?? [])
    .slice(0, 5)
    .map((m) => `• ${m}`)
    .join("\n") || "none"}

Return a calm nudge + starter question + ritualId.
`.trim();

  return AiNudgeSchema.parse(
    await callChatCompletions({
      apiKey: opts.apiKey,
      model: opts.model,
      system: nudgeSystemPrompt(),
      user: userPrompt,
    })
  );
}

/**
 * Used in Insights: weekly/monthly reflection from aggregates + memories.
 */
export async function generateTrustFirstInsightsReflection(opts: {
  apiKey: string;
  aggregatesText: string;
  model?: string;
}): Promise<AiReply> {
  const parsed = AiReplySchema.parse(
    await callChatCompletions({
      apiKey: opts.apiKey,
      model: opts.model,
      system: insightsSystemPrompt(),
      user: opts.aggregatesText,
    })
  );

  return {
    reflection: parsed.reflection,
    question: parsed.question ?? null,
  };
}

function recallSystemPrompt() {
  return `
${baseSystemPrompt()}

Task:
- You are a research assistant helping the user recall their past.
- Answer the user's question based ONLY on the provided journal entries.
- Use a gentle, descriptive tone.
- QUOTE verbatim when possible: (Date) "[quote]".
- If you don't find a specific answer, say so gently and suggest what *is* there.

Return ONLY valid JSON:
{
  "answer": string,
  "relevantEntryIds": string[]
}
`.trim();
}

function historyGenSystemPrompt() {
  return `
${baseSystemPrompt()}

Task:
- Generate 10 diverse, meaningful journal entries for a demo user.
- Vary the themes: work, health, money, family, self-discovery, joy, grief.
- Return ONLY valid JSON with an "entries" array.

Schema Template:
{
  "entries": [
    {
      "daysAgo": number (0-14),
      "intent": "unload" | "make_sense" | "help_write",
      "emotion": string (Preferred: Calm, Stressed, Anxious, Grateful, Hopeful, Tired, Frustrated, Sad, Angry, Happy, Overwhelmed),
      "context": string (Preferred: Work, Health, Family, Self, Relationships, Money, Future, School),
      "steps": [
        { "prompt": string, "response": string, "aiReflection": string | null (optional), "aiQuestion": string | null (optional) }
      ]
    }
  ]
}

Hard Rules:
- unload: exactly 2 steps.
- make_sense: exactly 4 steps.
- help_write: exactly 2 steps.
`.trim();
}

/**
 * Used for Q&A over past entries.
 */
export async function generateRecallReply(opts: {
  apiKey: string;
  question: string;
  contextText: string;
  model?: string;
}) {
  const userPrompt = `
Journal Context:
${opts.contextText}

Question: ${opts.question}
`.trim();

  return RecallReplySchema.parse(
    await callChatCompletions({
      apiKey: opts.apiKey,
      model: opts.model,
      system: recallSystemPrompt(),
      user: userPrompt,
    })
  );
}

/**
 * Used for dynamic seeding.
 */
export async function generateAiHistory(opts: {
  apiKey: string;
  userContext?: string;
  model?: string;
}) {
  const userPrompt = `
Generate a 10-entry history. 
Context (optional): ${opts.userContext ?? "A person trying to find balance between a busy tech job and personal health."}

Rules:
- daysAgo should be between 0 and 14.
- Use EXACT intent IDs: "unload", "make_sense", "help_write".
- Emotion & Context MUST be short labels (1-2 words max). NO sentences.
- steps: match the ritual structure exactly (unload=2 steps, make_sense=4 steps, help_write=2 steps).
`.trim();

  return HistoryGenSchema.parse(
    await callChatCompletions({
      apiKey: opts.apiKey,
      model: opts.model,
      system: historyGenSystemPrompt(),
      user: userPrompt,
    })
  );
}
