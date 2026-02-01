import { z } from "zod";

const AiReplySchema = z.object({
  reflection: z.string().min(1),
  question: z.string().nullable().optional(),
});

export type AiReply = z.infer<typeof AiReplySchema>;

function trustFirstSystemPrompt() {
  return `
You are a private, empathetic journaling companion.

Hard rules:
- Do NOT diagnose, label disorders, or claim medical expertise.
- Do NOT claim to know the user across time or infer hidden motives.
- Do NOT moralize, shame, or judge.
- Use tentative language: "it sounds like", "maybe", "might".
- Keep it short: 2–5 sentences max.
- Ask at most ONE gentle question, or null if not needed.

Return ONLY valid JSON with keys:
reflection: string
question: string | null
`.trim();
}

export async function generateTrustFirstReply(opts: {
  apiKey: string;
  ritualName: string;
  stepPrompt: string;
  userText: string;
  previousText?: string;
}) {
  const userPrompt = `
Ritual: ${opts.ritualName}
Step: ${opts.stepPrompt}
${opts.previousText ? `Previous step text (same session only): ${opts.previousText}` : ""}

User text:
${opts.userText}
`.trim();

  const body = {
    model: "gpt-4.1-mini", // you can swap later if needed
    temperature: 0.5,
    messages: [
      { role: "system", content: trustFirstSystemPrompt() },
      { role: "user", content: userPrompt },
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

  const parsed = AiReplySchema.parse(JSON.parse(content));
  return {
    reflection: parsed.reflection,
    question: parsed.question ?? null,
  };
}