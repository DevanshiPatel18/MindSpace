"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { listMemoryRecords, listEntryRecords } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { MemoryItem } from "@/lib/types";
import { formatDate } from "@/lib/util";
import { computeStreak, lastEntryDate } from "@/lib/stats";

function IntentCard({ title, desc, href }: { title: string; desc: string; href: string }) {
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
  const [latestMemory, setLatestMemory] = React.useState<MemoryItem | null>(null);

  const [streak, setStreak] = React.useState(0);
  const [lastEntry, setLastEntry] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return;

      // Momentum: compute from entry record metadata (no decrypt needed)
      const entryRecords = await listEntryRecords();
      setStreak(computeStreak(entryRecords));
      setLastEntry(lastEntryDate(entryRecords));

      // Continuity memory (decrypt memory only)
      const memRecords = await listMemoryRecords();
      if (memRecords.length === 0) return;
      const r = memRecords[0];
      try {
        const payload = await decryptJson<MemoryItem>(key, r.ciphertextB64, r.ivB64);
        setLatestMemory(payload);
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="What would help right now?" subtitle="Private by default. You decide how deep to go." />

      {/* Momentum card */}
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Momentum</div>
              <div className="mt-2 text-sm text-neutral-700">
                {streak === 0 ? (
                  <>No streak to maintain. Just a place to land.</>
                ) : streak === 1 ? (
                  <>You showed up <b>1 day</b> in a row.</>
                ) : (
                  <>You showed up <b>{streak} days</b> in a row.</>
                )}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {lastEntry ? <>Last entry: {formatDate(lastEntry)}</> : <>No entries yet.</>}
              </div>
              <div className="mt-3 text-xs text-neutral-500">
                No guilt. If you miss a day, the app doesn’t punish you—just offers a small restart.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/backup">
                <Button variant="secondary">Backup</Button>
              </Link>
              <Link href="/archive">
                <Button variant="ghost">Archive</Button>
              </Link>
            </div>
          </div>
        </CardBody>
      </Card>

      {latestMemory ? (
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Continuity (optional)</div>
            <div className="mt-2 text-sm text-neutral-800">
              You previously saved:{" "}
              <span className="font-semibold text-neutral-900">“{latestMemory.text}”</span>
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
        <Link href="/archive">
          <Button variant="ghost">Go to Archive</Button>
        </Link>
        <Link href="/insights">
          <Button variant="ghost">Explore Insights</Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost">Settings</Button>
        </Link>
      </div>
    </div>
  );
}
