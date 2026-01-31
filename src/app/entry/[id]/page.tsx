"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { getEntryRecord, deleteEntryRecord } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import { EntryPayload } from "@/lib/types";
import { formatDate } from "@/lib/util";

export default function EntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = React.useState<EntryPayload | null>(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return router.replace("/unlock");
      const record = await getEntryRecord(params.id);
      if (!record) return setErr("Entry not found.");
      try {
        setPayload(await decryptJson<EntryPayload>(key, record.ciphertextB64, record.ivB64));
      } catch {
        setErr("Could not decrypt entry.");
      }
    })();
  }, [params.id, router]);

  async function onDelete() {
    if (!confirm("Delete this entry?")) return;
    await deleteEntryRecord(params.id);
    router.push("/archive");
  }

  if (err) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-red-600">{err}</div>
        </CardBody>
      </Card>
    );
  }

  if (!payload) {
    return (
      <Card>
        <CardBody>Loading…</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={payload.ritualName}
        subtitle={`${formatDate(payload.createdAt)} • ${payload.intent.replace("_", " ")}`}
        right={<Button variant="danger" onClick={onDelete}>Delete</Button>}
      />

      <div className="space-y-4">
        {payload.steps.map((s, i) => (
          <Card key={i}>
            <CardBody>
              <div className="text-xs text-neutral-500">{s.prompt}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-900">{s.response}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/archive")}>Back</Button>
        <Button onClick={() => router.push("/")}>New entry</Button>
      </div>
    </div>
  );
}