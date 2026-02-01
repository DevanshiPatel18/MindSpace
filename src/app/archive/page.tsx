"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { listEntryRecords } from "@/lib/storage";
import { formatDate } from "@/lib/util";
import { Button } from "@/components/Button";

import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";

export default function ArchivePage() {
  const [records, setRecords] = React.useState<Awaited<ReturnType<typeof listEntryRecords>>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const all = await listEntryRecords();
      const key = getSessionKey();
      if (!key) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const valid: typeof all = [];
      for (const r of all) {
        try {
          // Verify we can decrypt it. We don't need the payload, just success.
          // Optimization: decryptJson is seemingly fast enough for local use.
          await decryptJson(key, r.ciphertextB64, r.ivB64);
          valid.push(r);
        } catch {
          // Skip invalid/different-passphrase entries
        }
      }
      setRecords(valid);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Archive" subtitle="Your entries, stored locally and encrypted." />

      {loading ? (
        <Card>
          <CardBody>Loading...</CardBody>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-neutral-700">No entries yet.</div>
            <div className="mt-4">
              <Link href="/"><Button>Start journaling</Button></Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map((r) => (
            <Link key={r.id} href={`/entry/${r.id}`}>
              <Card className="hover:shadow-md transition">
                <CardBody className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">{r.ritualName}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {formatDate(r.createdAt)} • {r.intent.replace("_", " ")}
                    </div>
                  </div>
                  <Button variant="secondary">Open</Button>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}