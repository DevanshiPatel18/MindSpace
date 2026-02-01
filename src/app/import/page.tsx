"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import { buildPreview, parseBackupJson, BackupImportPreview } from "@/lib/backup-io";
import { formatDate } from "@/lib/util";

export default function BackupImportPage() {
  const { message, setMessage } = useToast();
  const [preview, setPreview] = React.useState<BackupImportPreview | null>(null);
  const [rawText, setRawText] = React.useState<string>("");

  async function onPickFile(file: File) {
    try {
      const text = await file.text();
      setRawText(text);

      const parsed = parseBackupJson(text);
      const p = buildPreview(parsed);
      setPreview(p);

      setMessage("Backup validated. Preview ready.");
    } catch (e: any) {
      setPreview(null);
      setMessage("Invalid backup file.");
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Import backup"
        subtitle="Validate an exported backup file. (Import write step is an enhancement.)"
        right={
          <Link href="/backup">
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="text-sm text-neutral-700">
            Choose a backup JSON file exported from this app.
          </div>

          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
            }}
          />

          <div className="text-xs text-neutral-500">
            This step only validates and previews. It does not write to your database yet.
          </div>
        </CardBody>
      </Card>

      {preview ? (
        <Card>
          <CardBody className="space-y-2">
            <div className="text-sm font-semibold text-neutral-900">Preview</div>
            <div className="text-sm text-neutral-800">
              Entries: <b>{preview.entryCount}</b>
            </div>
            <div className="text-sm text-neutral-800">
              Memory items: <b>{preview.memoryCount}</b>
            </div>

            <div className="text-xs text-neutral-500 mt-2">
              Exported at: {formatDate(preview.exportedAt)}
            </div>

            {preview.oldestEntryAt ? (
              <div className="text-xs text-neutral-500">
                Entry range: {formatDate(preview.oldestEntryAt)} → {formatDate(preview.newestEntryAt!)}
              </div>
            ) : (
              <div className="text-xs text-neutral-500">No entries in this backup.</div>
            )}

            <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
              Enhancement: Add “Import & merge” with confirmation, conflict handling, and local-only writes.
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
