"use client";

import React from "react";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";

import { listEntryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import { EntryPayload } from "@/lib/types";
import { generateTrustFirstReply } from "@/lib/ai";

export default function InsightsPage() {
  const { message, setMessage } = useToast();

  const [topEmotions, setTopEmotions] = React.useState<Array<[string, number]>>([]);
  const [topContexts, setTopContexts] = React.useState<Array<[string, number]>>([]);
  const [reflection, setReflection] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return;

      const settings = await getSettings();
      if (!settings.insightsEnabled) {
        setMessage("Insights are off. Enable them in Settings.");
        return;
      }

      const records = await listEntryRecords();
      const entries: EntryPayload[] = [];

      for (const r of records) {
        try {
          entries.push(await decryptJson<EntryPayload>(key, r.ciphertextB64, r.ivB64));
        } catch {}
      }

      const emo = new Map<string, number>();
      const ctx = new Map<string, number>();

      for (const e of entries) {
        if (e.tags?.emotion) emo.set(e.tags.emotion, (emo.get(e.tags.emotion) ?? 0) + 1);
        if (e.tags?.context) ctx.set(e.tags.context, (ctx.get(e.tags.context) ?? 0) + 1);
      }

      setTopEmotions([...emo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6));
      setTopContexts([...ctx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6));
    })();
  }, [setMessage]);

  async function onGenerateReflection() {
    try {
      const settings = await getSettings();
      if (!settings.aiEnabled) return setMessage("AI is off. Enable it in Settings.");

      const apiKey = settings.rememberAiKey ? (settings.aiApiKey ?? "") : (sessionStorage.getItem("ai_api_key") ?? "");
      if (!apiKey) return setMessage("Add an AI API key in Settings.");

      const summaryInput = `
Aggregated labels chosen by user (not interpretations):
Top emotions: ${topEmotions.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Top contexts: ${topContexts.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

Write a gentle reflection. No diagnosis, no labels, no claims about long-term patterns.
End with one optional question.
`.trim();

      const reply = await generateTrustFirstReply({
        apiKey,
        intent: "make_sense",
        ritualName: "Insights Reflection",
        stepPrompt: "Generate a gentle reflection summary from aggregates.",
        userText: summaryInput,
      });

      setReflection(`${reply.reflection}${reply.question ? `\n\nQuestion: ${reply.question}` : ""}`);
    } catch {
      setMessage("Could not generate reflection.");
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Insights"
        subtitle="On-device trends from tags you chose. No scores, no judgment."
        right={<Button onClick={onGenerateReflection}>Generate reflection</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top emotions</div>
            <div className="mt-3 space-y-2">
              {topEmotions.length === 0 ? (
                <div className="text-sm text-neutral-600">Add emotion tags to entries to see this.</div>
              ) : (
                topEmotions.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
                    <div className="text-sm text-neutral-900">{k}</div>
                    <div className="text-xs text-neutral-500">{v}</div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top contexts</div>
            <div className="mt-3 space-y-2">
              {topContexts.length === 0 ? (
                <div className="text-sm text-neutral-600">Add context tags to entries to see this.</div>
              ) : (
                topContexts.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
                    <div className="text-sm text-neutral-900">{k}</div>
                    <div className="text-xs text-neutral-500">{v}</div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {reflection ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Reflection</div>
            <div className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{reflection}</div>
            <div className="mt-3 text-xs text-neutral-500">
              Generated only from aggregates, not raw entries.
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}