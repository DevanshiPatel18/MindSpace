"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Toast, useToast } from "@/components/Toast";
import { listEntryRecords, listMemoryRecords, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload, MemoryItem } from "@/lib/types";
import { formatDate } from "@/lib/util";
import { computeStreak, lastEntryDate } from "@/lib/stats";
import { generateTrustFirstNudge, type AiNudge } from "@/lib/ai";
import { Sparkles } from "lucide-react";

function IntentCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Card className="hover:shadow-md transition">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-neutral-900">{title}</div>
            <div className="mt-1 text-sm text-neutral-600">{desc}</div>
          </div>
          <Link href={href}>
            <Button variant="secondary">Start</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

export default function HomePage() {
  const { message, setMessage } = useToast();

  const [latestMemory, setLatestMemory] = React.useState<MemoryItem | null>(null);
  const [streak, setStreak] = React.useState(0);
  const [lastAt, setLastAt] = React.useState<string | null>(null);
  const [lastTags, setLastTags] = React.useState<{ emotion?: string | null; context?: string | null } | null>(null);

  const [nudge, setNudge] = React.useState<AiNudge | null>(null);
  const [nudgeBusy, setNudgeBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return;

      const allRecords = await listEntryRecords();

      // Filter valid entries
      const validRecords: typeof allRecords = [];
      for (const r of allRecords) {
        try {
          await decryptJson(key, r.ciphertextB64, r.ivB64);
          validRecords.push(r);
        } catch { }
      }

      setStreak(computeStreak(validRecords));
      setLastAt(lastEntryDate(validRecords));

      // Get latest tags from the first valid entry
      if (validRecords[0]) {
        try {
          const latest = await decryptJson<EntryPayload>(key, validRecords[0].ciphertextB64, validRecords[0].ivB64);
          setLastTags({ emotion: latest.tags?.emotion ?? null, context: latest.tags?.context ?? null });
        } catch (e) {
          console.warn("Could not decrypt latest entry:", e);
        }
      }

      // Latest memory sentence (user-approved)
      const memRecords = await listMemoryRecords();
      if (memRecords[0]) {
        try {
          const m = await decryptJson<MemoryItem>(key, memRecords[0].ciphertextB64, memRecords[0].ivB64);
          setLatestMemory(m);
        } catch (e) {
          console.warn("Could not decrypt memory:", e);
        }
      }
    })();
  }, []);

  async function onGenerateNudge() {
    setNudge(null);
    setNudgeBusy(true);
    try {
      const settings = await getSettings();
      if (!settings.aiEnabled) {
        setMessage("AI is off. Enable it in Settings.");
        return;
      }

      const apiKey = settings.rememberAiKey
        ? settings.aiApiKey ?? ""
        : sessionStorage.getItem("ai_api_key") ?? "";

      if (!apiKey && !settings.useDefaultAiKey) {
        setMessage("Add an AI API key in Settings (or enable default key).");
        return;
      }

      const out = await generateTrustFirstNudge({
        apiKey,
        signals: {
          streak,
          lastEntryAt: lastAt,
          lastTags: lastTags ?? undefined,
          memories: latestMemory ? [latestMemory.text] : [],
        },
      });

      setNudge(out);
    } catch {
      setMessage("Could not generate a prompt.");
    } finally {
      setNudgeBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="What would help right now?"
        subtitle="Private by default. You decide how deep to go."
      />

      <Card className="shadow-[var(--shadow)]">
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Momentum</div>
              <div className="mt-1 text-sm text-neutral-600">
                {streak > 0 ? (
                  <>
                    You’re on a <span className="font-semibold text-neutral-900">{streak}-day streak</span>.
                  </>
                ) : (
                  <>No streak pressure. One entry counts.</>
                )}
              </div>
              {lastAt ? (
                <div className="mt-1 text-xs text-neutral-500">Last entry: {formatDate(lastAt)}</div>
              ) : null}
            </div>
            <Link href="/archive">
              <Button variant="secondary">Archive</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      {latestMemory ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-xs text-neutral-500">Continuity (optional)</div>
            <div className="mt-2 text-sm text-neutral-800">
              You previously saved: <span className="font-semibold text-neutral-900">“{latestMemory.text}”</span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">Saved {formatDate(latestMemory.createdAt)}</div>
            <div className="mt-4 flex gap-2">
              <Link href="/ritual/make-sense">
                <Button>Start here</Button>
              </Link>
              <Link href="/ritual/end-the-day">
                <Button variant="secondary">Start fresh</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Module 14 */}
      <Card className="shadow-[var(--shadow)]">
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Gentle nudge (optional)</div>
              <div className="mt-1 text-sm text-neutral-600">
                Generates one starter question using only lightweight signals (streak, last tags, and your approved memory sentence).
              </div>
            </div>
            <Button onClick={onGenerateNudge} disabled={nudgeBusy} variant="secondary">
              {nudgeBusy ? "Generating…" : "Generate"}
            </Button>
          </div>

          {nudge ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm text-neutral-800">{nudge.reflection}</div>
              <div className="mt-3 text-sm text-neutral-900">
                <span className="font-semibold">Try:</span> {nudge.question}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/ritual/${nudge.ritualId}?seed=${encodeURIComponent(nudge.question)}`}>
                  <Button>Open suggested ritual</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="ghost">Privacy settings</Button>
                </Link>
              </div>
              <div className="mt-3 text-xs text-neutral-500">
                Tip: the starter question becomes an *optional* first step. You can skip it.
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4">
        <IntentCard
          title="Unload"
          desc="De-stress and set the day down. Short, contained, no deep digging."
          href="/ritual/end-the-day"
        />
        <IntentCard
          title="Make sense"
          desc="Turn a moment into clarity. Gentle structure for meaning-making."
          href="/ritual/make-sense"
        />
        <IntentCard
          title="Help me write"
          desc="Start small. A guided sentence so the blank page isn’t scary."
          href="/ritual/one-sentence-start"
        />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/insights">
          <Button variant="ghost">Explore Insights</Button>
        </Link>
        <Link href="/recall">
          <Button variant="secondary" className="gap-2">
            <Sparkles className="w-4 h-4" /> Recall AI
          </Button>
        </Link>
        <Link href="/memory">
          <Button variant="ghost">Memories</Button>
        </Link>
        {/* <Link href="/scripts/seed">
          <Button variant="ghost">Seed demo entries</Button>
        </Link> */}
      </div>
    </div>
  );
}
