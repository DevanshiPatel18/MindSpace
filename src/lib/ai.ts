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
    model: opts.model ?? "gpt-4.1-mini",
    temperature: 0.5,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  model?: string;
}) {
  const userPrompt = `
Ritual: ${opts.ritualName}
Step: ${opts.stepPrompt}
${opts.previousText ? `Previous step text (same session only): ${opts.previousText}` : ""}

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
