"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";

import { listEntryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload } from "@/lib/types";
import { generateTrustFirstReply } from "@/lib/ai";

type KV = { key: string; count: number };

function toTopList(map: Map<string, number>, max = 6): KV[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

export default function InsightsPage() {
  const { message, setMessage } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [insightsEnabled, setInsightsEnabled] = React.useState(true);

  const [totalEntries, setTotalEntries] = React.useState(0);
  const [taggedEntries, setTaggedEntries] = React.useState(0);

  const [topEmotions, setTopEmotions] = React.useState<KV[]>([]);
  const [topContexts, setTopContexts] = React.useState<KV[]>([]);
  const [topPairs, setTopPairs] = React.useState<KV[]>([]);

  const [reflection, setReflection] = React.useState<string>("");
  const [reflectionBusy, setReflectionBusy] = React.useState(false);

  const locked = !getSessionKey();

  React.useEffect(() => {
    (async () => {
      try {
        const key = getSessionKey();
        if (!key) {
          setLoading(false);
          return;
        }

        const settings = await getSettings();
        setInsightsEnabled(settings.insightsEnabled);

        if (!settings.insightsEnabled) {
          setMessage("Insights are off. Enable them in Settings.");
          setLoading(false);
          return;
        }

        const records = await listEntryRecords();
        setTotalEntries(records.length);

        const emo = new Map<string, number>();
        const ctx = new Map<string, number>();
        const pairs = new Map<string, number>();

        let tagged = 0;

        for (const r of records) {
          try {
            const entry = await decryptJson<EntryPayload>(key, r.ciphertextB64, r.ivB64);

            const e = entry.tags?.emotion ?? null;
            const c = entry.tags?.context ?? null;

            if (e || c) tagged++;

            if (e) emo.set(e, (emo.get(e) ?? 0) + 1);
            if (c) ctx.set(c, (ctx.get(c) ?? 0) + 1);

            // Module 9: co-occurrence foundation (context + emotion)
            if (e && c) {
              const pairKey = `${c} + ${e}`;
              pairs.set(pairKey, (pairs.get(pairKey) ?? 0) + 1);
            }
          } catch {
            // ignore decryption failures for individual entries
          }
        }

        setTaggedEntries(tagged);
        setTopEmotions(toTopList(emo, 6));
        setTopContexts(toTopList(ctx, 6));
        setTopPairs(toTopList(pairs, 8));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onGenerateReflection() {
    try {
      setReflectionBusy(true);

      const settings = await getSettings();
      if (!settings.aiEnabled) {
        setMessage("AI is off. Enable it in Settings.");
        return;
      }

      const apiKey = settings.rememberAiKey
        ? (settings.aiApiKey ?? "")
        : (sessionStorage.getItem("ai_api_key") ?? "");

      if (!apiKey) {
        setMessage("Add an AI API key in Settings.");
        return;
      }

      // Trust-first: aggregates only (no raw entry text)
      const summaryInput = `
AGGREGATED LABELS CHOSEN BY USER (DESCRIPTIVE ONLY):
Total entries: ${totalEntries}
Tagged entries: ${taggedEntries}

Top emotions: ${topEmotions.map((x) => `${x.key} (${x.count})`).join(", ") || "none"}
Top contexts: ${topContexts.map((x) => `${x.key} (${x.count})`).join(", ") || "none"}
Top pairings (context + emotion): ${topPairs.map((x) => `${x.key} (${x.count})`).join(", ") || "none"}

Write a gentle reflection summary:
- No diagnosis, no labels, no “you are…”
- No claims about hidden causes or long-term conclusions
- Use tentative language (“it looks like”, “maybe”, “often”)
- 2–5 sentences max
- End with at most ONE optional question (or null).
`.trim();

      const reply = await generateTrustFirstReply({
        apiKey,
        ritualName: "Insights Reflection",
        stepPrompt: "Generate a gentle reflection summary from aggregates.",
        userText: summaryInput,
      });

      setReflection(`${reply.reflection}${reply.question ? `\n\nQuestion: ${reply.question}` : ""}`);
    } catch {
      setMessage("Could not generate reflection.");
    } finally {
      setReflectionBusy(false);
    }
  }

  if (locked) {
    return (
      <div className="space-y-6">
        <Toast message={message} />
        <PageHeader
          title="Insights"
          subtitle="Unlock to compute on-device insights from your encrypted entries."
          right={
            <Link href="/unlock">
              <Button>Unlock</Button>
            </Link>
          }
        />
        <Card>
          <CardBody>
            <div className="text-sm text-neutral-700">
              Insights are computed locally by decrypting entries on this device. Nothing is uploaded.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!insightsEnabled) {
    return (
      <div className="space-y-6">
        <Toast message={message} />
        <PageHeader
          title="Insights"
          subtitle="Insights are currently disabled."
          right={
            <Link href="/settings">
              <Button>Open settings</Button>
            </Link>
          }
        />
        <Card>
          <CardBody>
            <div className="text-sm text-neutral-700">
              Enable Insights in Settings to view trends from tags you choose (emotion/context).
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Insights"
        subtitle="On-device trends from tags you chose. Descriptive counts—no scoring."
        right={
          <Button onClick={onGenerateReflection} disabled={reflectionBusy || loading}>
            {reflectionBusy ? "Generating…" : "Generate reflection"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Total entries</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">{loading ? "…" : totalEntries}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Tagged entries</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">{loading ? "…" : taggedEntries}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Privacy</div>
            <div className="mt-2 text-sm text-neutral-800">Decrypts locally • No upload</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top emotions</div>
            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="text-sm text-neutral-600">Loading…</div>
              ) : topEmotions.length === 0 ? (
                <div className="text-sm text-neutral-600">Add emotion tags to entries to see this.</div>
              ) : (
                topEmotions.map((x) => (
                  <div key={x.key} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
                    <div className="text-sm text-neutral-900">{x.key}</div>
                    <div className="text-xs text-neutral-500">{x.count}</div>
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
              {loading ? (
                <div className="text-sm text-neutral-600">Loading…</div>
              ) : topContexts.length === 0 ? (
                <div className="text-sm text-neutral-600">Add context tags to entries to see this.</div>
              ) : (
                topContexts.map((x) => (
                  <div key={x.key} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
                    <div className="text-sm text-neutral-900">{x.key}</div>
                    <div className="text-xs text-neutral-500">{x.count}</div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Module 9: Pairings */}
      <Card>
        <CardBody>
          <div className="text-sm font-semibold text-neutral-900">Common pairings</div>
          <div className="mt-1 text-xs text-neutral-500">
            Context + emotion combinations you tagged (e.g., “work + stressed”). Descriptive only.
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="text-sm text-neutral-600">Loading…</div>
            ) : topPairs.length === 0 ? (
              <div className="text-sm text-neutral-600">
                Add both an emotion and a context to an entry to see pairings.
              </div>
            ) : (
              topPairs.map((x) => (
                <div key={x.key} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
                  <div className="text-sm text-neutral-900">{x.key}</div>
                  <div className="text-xs text-neutral-500">{x.count}</div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      {reflection ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Reflection</div>
            <div className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{reflection}</div>
            <div className="mt-3 text-xs text-neutral-500">
              Generated only from aggregates and pairings, not raw entries.
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <div className="text-sm font-semibold text-neutral-900">Trust-first patterns</div>
          <p className="mt-2 text-sm text-neutral-700">
            These patterns are simple counts from labels you chose. They don’t claim causes, diagnoses, or “what it means.”
            The reflection is generated from aggregates, not your full journal text.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
