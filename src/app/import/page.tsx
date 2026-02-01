"use client";

import React from "react";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/Field";
import { Toast, useToast } from "@/components/Toast";
import { applyImport, makePreview, parseBackupJson, type ImportMode, type ImportPreview } from "@/lib/backup-io";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export default function ImportPage() {
  const { message, setMessage } = useToast();

  const [raw, setRaw] = React.useState("");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      setRaw(text);
      const parsed = parseBackupJson(text);
      setPreview(await makePreview(parsed));
      setMessage("Backup loaded. Review preview before importing.");
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Could not read backup file.";
      setPreview(null);
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    try {
      const parsed = parseBackupJson(raw);
      setPreview(await makePreview(parsed));
      setMessage("Preview updated.");
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Invalid backup content.";
      setPreview(null);
      setMessage(err);
    }
  }

  async function onApply(mode: ImportMode) {
    if (!raw.trim()) return setMessage("Paste backup JSON or upload a file first.");

    if (mode === "replace") {
      const ok = confirm(
        "Replace mode will DELETE all current entries and memories on this device, then restore from the backup.\n\nContinue?"
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      const parsed = parseBackupJson(raw);
      const result = await applyImport(parsed, mode);

      setMessage(
        `Import complete (${result.mode}). Entries: +${result.entriesImported} (skipped ${result.entriesSkipped}). ` +
        `Memories: +${result.memoryImported} (skipped ${result.memorySkipped}). ` +
        `${result.settingsApplied ? "Settings applied." : ""}`
      );
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Import failed.";
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Import"
        subtitle="Restore an encrypted backup to this device. This never needs your passphrase because entries remain encrypted."
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <span className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 hover:bg-neutral-50 cursor-pointer">
                Choose file
              </span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <Button variant="secondary" onClick={onPreview} disabled={busy}>
              {busy ? "Working…" : "Preview"}
            </Button>

            <div className="text-xs text-neutral-500">
              Tip: You can also paste JSON below.
            </div>
          </div>

          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste backup JSON here…"
            className="min-h-[240px]"
          />

          {preview ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">Preview</div>
              <div className="mt-2 text-sm text-neutral-700 space-y-1">
                <div>Version: <b>{preview.version}</b></div>
                {preview.exportedAt ? <div>Exported: <b>{preview.exportedAt}</b></div> : null}
                <div>Entries: <b>{preview.entriesCount}</b></div>
                <div>Memories: <b>{preview.memoryCount}</b></div>
                <div>Settings included: <b>{preview.settingsIncluded ? "Yes" : "No"}</b></div>

                <div className="mt-4 pt-4 border-t border-neutral-200">
                  {preview.isDecryptable === true ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-medium">
                      <ShieldCheck className="w-5 h-5" />
                      <span>Matches current passphrase. Data will be readable after import.</span>
                    </div>
                  ) : preview.isDecryptable === false ? (
                    <div className="flex items-start gap-2 text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                      <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <div>Passphrase Mismatch Error</div>
                        <p className="mt-1 text-xs font-normal text-rose-500 leading-relaxed">
                          This backup was encrypted with a different passphrase.
                          You can still import it, but you won't be able to read
                          the entries unless you unlock the session with the original
                          passphrase later.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                Note: AI keys are never imported.
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-500">
              Load a backup to see a preview.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onApply("merge")} disabled={busy}>
              {busy ? "Importing…" : "Import (Merge)"}
            </Button>
            <Button variant="danger" onClick={() => onApply("replace")} disabled={busy}>
              {busy ? "Importing…" : "Import (Replace)"}
            </Button>
          </div>

          <div className="text-xs text-neutral-500">
            <b>Merge</b> keeps your existing data and skips duplicate IDs. <b>Replace</b> wipes current data first.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
