"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import { Field, Input } from "@/components/Field";
import { listMemoryItems, removeMemoryItem, updateMemoryItem } from "@/lib/memory";
import { formatDate } from "@/lib/util";

type Row = {
  recordId: string;
  createdAt: string;
  text: string;
};

export default function MemoryPage() {
  const { message, setMessage } = useToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const items = await listMemoryItems();
      setRows(
        items.map(({ recordId, item }) => ({
          recordId,
          createdAt: item.createdAt,
          text: item.text,
        }))
      );
    } catch {
      setMessage("Locked. Unlock to view memory.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(r: Row) {
    setEditingId(r.recordId);
    setEditText(r.text);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editText.trim()) return setMessage("Memory sentence can’t be empty.");

    setBusy(true);
    try {
      await updateMemoryItem(editingId, editText);
      setMessage("Memory updated.");
      setEditingId(null);
      setEditText("");
      await refresh();
    } catch {
      setMessage("Could not update memory.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this memory sentence?")) return;
    setBusy(true);
    try {
      await removeMemoryItem(id);
      setMessage("Deleted memory.");
      await refresh();
    } catch {
      setMessage("Could not delete memory.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Memory"
        subtitle="Trust-first memory: you choose what gets remembered. Edit or delete anytime."
        right={
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
        }
      />

      {loading ? (
        <Card>
          <CardBody>Loading…</CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="text-sm text-neutral-700">No memory sentences saved yet.</div>
            <div className="text-xs text-neutral-500">
              You’ll be prompted to save a sentence after “Make sense” rituals (optional).
            </div>
            <Link href="/ritual/make-sense">
              <Button>Start “Make sense”</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.recordId} className="hover:shadow-md transition">
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-neutral-500">{formatDate(r.createdAt)}</div>
                    <div className="mt-2 text-sm text-neutral-900 break-words">
                      “{r.text}”
                    </div>

                    <div className="mt-3 text-xs text-neutral-500">
                      Tip: This sentence can show up on your Home screen as continuity (you’re always in control).
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <Button variant="secondary" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => deleteOne(r.recordId)} disabled={busy}>
                      Delete
                    </Button>
                  </div>
                </div>

                {editingId === r.recordId ? (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <Field label="Edit memory sentence">
                      <Input value={editText} onChange={(e) => setEditText(e.target.value)} />
                    </Field>

                    <div className="mt-3 flex gap-2">
                      <Button onClick={saveEdit} disabled={busy}>
                        {busy ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
