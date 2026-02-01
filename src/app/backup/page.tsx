"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import { createBackup, downloadJson } from "@/lib/backup";

export default function BackupPage() {
  const { message, setMessage } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const backup = await createBackup();
      const name = `quiet-journal-backup-${backup.exportedAt.slice(0, 10)}.json`;
      downloadJson(name, backup);
      setMessage("Backup downloaded.");
    } catch {
      setMessage("Could not export backup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Backup"
        subtitle="Export an encrypted backup of your journal records from this device."
        right={
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="text-sm text-neutral-800">
            This export contains your <b>already-encrypted</b> entry records (ciphertext + IV).
            It does <b>not</b> include your passphrase.
          </div>

          <div className="text-xs text-neutral-500">
            Keep it somewhere safe. Anyone with the file still needs your passphrase to read entries.
          </div>

          <Button onClick={onExport} disabled={busy}>
            {busy ? "Exporting…" : "Download encrypted backup"}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
