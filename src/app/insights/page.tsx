"use client";

import React from "react";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";

import { listEntryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload } from "@/lib/types";
import { listMemoryItems } from "@/lib/memory";
import { generateTrustFirstInsightsReflection } from "@/lib/ai";

type Bucket = Array<[string, number]>;

function topN(map: Map<string, number>, n: number): Bucket {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function inRange(iso: string, startMs: number, endMs: number) {
  const t = Date.parse(iso);
  return t >= startMs && t < endMs;
}

export default function InsightsPage() {
  const { message, setMessage } = useToast();

  const [topEmotions, setTopEmotions] = React.useState<Bucket>([]);
  const [topContexts, setTopContexts] = React.useState<Bucket>([]);
  const [pairings, setPairings] = React.useState<Bucket>([]);

  // Time windows: last 7 days vs previous 7 days
  const [weekEmotions, setWeekEmotions] = React.useState<{ thisWeek: Bucket; lastWeek: Bucket }>({
    thisWeek: [],
    lastWeek: [],
  });
  const [weekContexts, setWeekContexts] = React.useState<{ thisWeek: Bucket; lastWeek: Bucket }>({
    thisWeek: [],
    lastWeek: [],
  });

  const [memories, setMemories] = React.useState<string[]>([]);
  const [reflection, setReflection] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

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
        } catch { }
      }

      // User-approved memories
      try {
        const mem = await listMemoryItems();
        setMemories(mem.slice(0, 5).map((m) => m.item.text));
      } catch {
        setMemories([]);
      }

      // Global aggregates
      const emo = new Map<string, number>();
      const ctx = new Map<string, number>();
      const pair = new Map<string, number>();

      for (const e of entries) {
        const eEmo = e.tags?.emotion ?? null;
        const eCtx = e.tags?.context ?? null;

        if (eEmo) emo.set(eEmo, (emo.get(eEmo) ?? 0) + 1);
        if (eCtx) ctx.set(eCtx, (ctx.get(eCtx) ?? 0) + 1);
        if (eEmo && eCtx) {
          const k = `${eEmo} • ${eCtx}`;
          pair.set(k, (pair.get(k) ?? 0) + 1);
        }
      }

      setTopEmotions(topN(emo, 6));
      setTopContexts(topN(ctx, 6));
      setPairings(topN(pair, 6));

      // Weekly windows
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const thisStart = now - 7 * day;
      const lastStart = now - 14 * day;

      const emoThis = new Map<string, number>();
      const emoLast = new Map<string, number>();
      const ctxThis = new Map<string, number>();
      const ctxLast = new Map<string, number>();

      for (const e of entries) {
        const createdAt = e.createdAt ?? "";
        const eEmo = e.tags?.emotion ?? null;
        const eCtx = e.tags?.context ?? null;

        if (inRange(createdAt, thisStart, now)) {
          if (eEmo) emoThis.set(eEmo, (emoThis.get(eEmo) ?? 0) + 1);
          if (eCtx) ctxThis.set(eCtx, (ctxThis.get(eCtx) ?? 0) + 1);
        } else if (inRange(createdAt, lastStart, thisStart)) {
          if (eEmo) emoLast.set(eEmo, (emoLast.get(eEmo) ?? 0) + 1);
          if (eCtx) ctxLast.set(eCtx, (ctxLast.get(eCtx) ?? 0) + 1);
        }
      }

      setWeekEmotions({ thisWeek: topN(emoThis, 6), lastWeek: topN(emoLast, 6) });
      setWeekContexts({ thisWeek: topN(ctxThis, 6), lastWeek: topN(ctxLast, 6) });
    })();
  }, [setMessage]);

  async function onGenerateReflection() {
    setBusy(true);
    try {
      const settings = await getSettings();
      if (!settings.aiEnabled) return setMessage("AI is off. Enable it in Settings.");

      const apiKey = settings.rememberAiKey
        ? (settings.aiApiKey ?? "")
        : (sessionStorage.getItem("ai_api_key") ?? "");
      if (!apiKey) return setMessage("Add an AI API key in Settings.");

      const aggregatesText = `
On-device aggregates (user-chosen labels; not interpretations):

Top emotions (all time): ${topEmotions.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Top contexts (all time): ${topContexts.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Top emotion•context pairings: ${pairings.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

Last 7 days emotions: ${weekEmotions.thisWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Previous 7 days emotions: ${weekEmotions.lastWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

Last 7 days contexts: ${weekContexts.thisWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}
Previous 7 days contexts: ${weekContexts.lastWeek.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}

User-approved memories (optional):
${memories.map((m) => `• ${m}`).join("\n") || "none"}

Write a gentle reflection based ONLY on these aggregates and memories.
No diagnosis, no moralizing, no certainty claims.
End with one optional question.
`.trim();

      const reply = await generateTrustFirstInsightsReflection({
        apiKey,
        aggregatesText,
      });

      setReflection(`${reply.reflection}${reply.question ? `\n\nQuestion: ${reply.question}` : ""}`);
    } catch {
      setMessage("Could not generate reflection.");
    } finally {
      setBusy(false);
    }
  }

  // Color palette for visual bars (trust-first: warm, calming colors)
  const BAR_COLORS = [
    "bg-indigo-300",
    "bg-violet-300",
    "bg-sky-300",
    "bg-teal-300",
    "bg-amber-300",
    "bg-rose-300",
  ];

  function VisualBucket({ items, empty, showChart = false }: { items: Bucket; empty: string; showChart?: boolean }) {
    const maxCount = items.length > 0 ? Math.max(...items.map(([, v]) => v)) : 1;

    return (
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-neutral-600">{empty}</div>
        ) : (
          <>
            {/* Visual bar chart */}
            {showChart && (
              <div className="flex items-end gap-1 h-16 px-2">
                {items.map(([k, v], i) => (
                  <div key={k} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-lg transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ height: `${(v / maxCount) * 100}%`, minHeight: "4px" }}
                      title={`${k}: ${v}`}
                    />
                    <div className="text-[10px] text-neutral-500 truncate w-full text-center">{k}</div>
                  </div>
                ))}
              </div>
            )}
            {/* List view */}
            <div className="space-y-2">
              {items.map(([k, v], i) => (
                <div key={k} className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2">
                  <div className={`w-2 h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} />
                  <div className="flex-1 text-sm text-neutral-900">{k}</div>
                  <div className="text-xs text-neutral-500 font-medium">{v}</div>
                  {/* Mini bar in row */}
                  <div className="w-16 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ width: `${(v / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function BucketList({ items, empty }: { items: Bucket; empty: string }) {
    return <VisualBucket items={items} empty={empty} showChart={false} />;
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Insights"
        subtitle="On-device trends from tags you chose. No scores, no judgment."
        right={
          <Button onClick={onGenerateReflection} disabled={busy}>
            {busy ? "Generating…" : "Generate reflection"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top emotions</div>
            <VisualBucket items={topEmotions} empty="Add emotion tags to entries to see this." showChart />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top contexts</div>
            <VisualBucket items={topContexts} empty="Add context tags to entries to see this." showChart />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Common pairings</div>
            <BucketList items={pairings} empty="Tag an emotion and context together to see this." />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">This week vs last week (emotions)</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-neutral-500">Last 7 days</div>
                <BucketList items={weekEmotions.thisWeek} empty="No emotion tags yet this week." />
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-500">Previous 7 days</div>
                <BucketList items={weekEmotions.lastWeek} empty="No emotion tags in the previous week." />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">This week vs last week (contexts)</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-neutral-500">Last 7 days</div>
                <BucketList items={weekContexts.thisWeek} empty="No context tags yet this week." />
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-500">Previous 7 days</div>
                <BucketList items={weekContexts.lastWeek} empty="No context tags in the previous week." />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="text-sm font-semibold text-neutral-900">Memories used (optional)</div>
          <div className="mt-1 text-xs text-neutral-500">
            These are single sentences you explicitly chose to save. They help continuity without rereading your archive.
          </div>
          <div className="mt-3 space-y-2">
            {memories.length === 0 ? (
              <div className="text-sm text-neutral-600">No saved memories yet.</div>
            ) : (
              memories.map((m, i) => (
                <div key={i} className="rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
                  {m}
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
              Generated only from aggregates and your saved memories — not raw entry text.
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
