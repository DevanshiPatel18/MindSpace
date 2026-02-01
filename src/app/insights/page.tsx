"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { listEntryRecords } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import type { EntryPayload } from "@/lib/types";

type KV = { key: string; count: number };

function toTopList(map: Map<string, number>, max = 6): KV[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

export default function InsightsPage() {
  const [loading, setLoading] = React.useState(true);

  const [totalEntries, setTotalEntries] = React.useState(0);
  const [taggedEntries, setTaggedEntries] = React.useState(0);

  const [topEmotions, setTopEmotions] = React.useState<KV[]>([]);
  const [topContexts, setTopContexts] = React.useState<KV[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const key = getSessionKey();
        if (!key) return;

        const records = await listEntryRecords();
        setTotalEntries(records.length);

        const emotionCounts = new Map<string, number>();
        const contextCounts = new Map<string, number>();

        let tagged = 0;

        for (const r of records) {
          try {
            const entry = await decryptJson<EntryPayload>(key, r.ciphertextB64, r.ivB64);

            const e = entry.tags?.emotion ?? null;
            const c = entry.tags?.context ?? null;

            if (e || c) tagged++;

            if (e) emotionCounts.set(e, (emotionCounts.get(e) ?? 0) + 1);
            if (c) contextCounts.set(c, (contextCounts.get(c) ?? 0) + 1);
          } catch {
            // ignore decryption failures (wrong key / corrupted record)
          }
        }

        setTaggedEntries(tagged);
        setTopEmotions(toTopList(emotionCounts));
        setTopContexts(toTopList(contextCounts));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const locked = !getSessionKey();

  if (locked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Insights"
          subtitle="Unlock to view your on-device insights."
          right={
            <Link href="/unlock">
              <Button>Unlock</Button>
            </Link>
          }
        />
        <Card>
          <CardBody>
            <div className="text-sm text-neutral-700">
              Insights are computed locally by decrypting your entries on this device.
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        subtitle="On-device, descriptive, and based only on tags you chose. No scoring."
        right={
          <Link href="/">
            <Button variant="secondary">Back home</Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Total entries</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">
              {loading ? "…" : totalEntries}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Tagged entries</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900">
              {loading ? "…" : taggedEntries}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Privacy</div>
            <div className="mt-2 text-sm text-neutral-800">
              Decrypts locally • No upload
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Top emotions</div>
            <p className="mt-1 text-xs text-neutral-500">
              Counts of emotion tags you added at the end of an entry.
            </p>

            <div className="mt-4 space-y-2">
              {loading ? (
                <div className="text-sm text-neutral-600">Loading…</div>
              ) : topEmotions.length === 0 ? (
                <div className="text-sm text-neutral-600">
                  No emotion tags yet. Add one at the end of a ritual.
                </div>
              ) : (
                topEmotions.map((x) => (
                  <div
                    key={x.key}
                    className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2"
                  >
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
            <p className="mt-1 text-xs text-neutral-500">
              Counts of context tags you added at the end of an entry.
            </p>

            <div className="mt-4 space-y-2">
              {loading ? (
                <div className="text-sm text-neutral-600">Loading…</div>
              ) : topContexts.length === 0 ? (
                <div className="text-sm text-neutral-600">
                  No context tags yet. Add one at the end of a ritual.
                </div>
              ) : (
                topContexts.map((x) => (
                  <div
                    key={x.key}
                    className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2"
                  >
                    <div className="text-sm text-neutral-900">{x.key}</div>
                    <div className="text-xs text-neutral-500">{x.count}</div>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="text-sm font-semibold text-neutral-900">How this helps</div>
          <p className="mt-2 text-sm text-neutral-700">
            This is meant to help you notice patterns without re-reading everything.
            It’s descriptive only: it reflects the labels you chose, not an interpretation of your mind.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}