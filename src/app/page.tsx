"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import React from "react";
import { MemoryItem } from "@/lib/types";
import { getSessionKey } from "@/lib/session";
import { listMemoryRecords } from "@/lib/storage";
import { decryptJson } from "@/lib/crypto";
import { formatDate } from "@/lib/util";

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

export default function Home() {
  const [latestMemory, setLatestMemory] = React.useState<MemoryItem | null>(null);

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return;

      const records = await listMemoryRecords();
      if (!records.length) return;

      try {
        const mem = await decryptJson<MemoryItem>(
          key,
          records[0].ciphertextB64,
          records[0].ivB64
        );
        setLatestMemory(mem);
      } catch { }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Trust-first journaling • local-first • encrypted
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">Mindspace</h1>
          <p className="mt-2 text-sm text-neutral-600 max-w-2xl">
            A private journaling companion that helps you reflect without judgment.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/unlock">
              <Button variant="secondary">Unlock</Button>
            </Link>
            <Link href="/archive">
              <Button variant="ghost">Archive</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      {latestMemory && (
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">Previously saved</div>
            <div className="mt-2 text-sm text-neutral-900 font-medium">
              “{latestMemory.text}”
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {formatDate(latestMemory.createdAt)}
            </div>
          </CardBody>
        </Card>
      )}

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
          desc="Start small so the blank page isn’t scary."
          href="/ritual/one-sentence-start"
        />
      </div>
    </div>
  );
}