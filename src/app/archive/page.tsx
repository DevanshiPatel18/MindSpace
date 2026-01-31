"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { listEntryRecords } from "@/lib/storage";
import { formatDate } from "@/lib/util";
import { Button } from "@/components/Button";

export default function ArchivePage() {
  const [records, setRecords] = React.useState<Awaited<ReturnType<typeof listEntryRecords>>>([]);

  React.useEffect(() => {
    (async () => setRecords(await listEntryRecords()))();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Archive" subtitle="Your entries, stored locally and encrypted." />

      {records.length === 0 ? (
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