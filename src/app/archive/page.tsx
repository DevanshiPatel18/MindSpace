"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { listEntryRecords } from "@/lib/storage";
import { formatDate } from "@/lib/util";
import { Button } from "@/components/Button";
import { AlertCircle, Search, Sparkles } from "lucide-react";

import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";

export default function ArchivePage() {
  const [records, setRecords] = React.useState<Awaited<ReturnType<typeof listEntryRecords>>>([]);
  const [lockedCount, setLockedCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const start = startDate ? new Date(startDate).toISOString() : undefined;
      let end = undefined;
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        end = d.toISOString();
      }

      const all = await listEntryRecords(start, end);
      const key = getSessionKey();
      if (!key) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const valid: typeof all = [];
      let locked = 0;
      for (const r of all) {
        try {
          await decryptJson(key, r.ciphertextB64, r.ivB64);
          valid.push(r);
        } catch {
          locked++;
        }
      }
      setRecords(valid);
      setLockedCount(locked);
      setLoading(false);
      setPage(1);
    })();
  }, [startDate, endDate]);

  const totalPages = Math.ceil(records.length / pageSize);
  const displayed = records.slice((page - 1) * pageSize, page * pageSize);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        subtitle="Your entries, stored locally and encrypted."
        right={
          <Link href="/recall">
            <Button variant="secondary" className="gap-2">
              <Sparkles className="w-4 h-4" /> Recall AI
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <Card>
        <CardBody className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 uppercase">From</label>
              <input
                type="date"
                className="block w-full rounded-xl border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:ring-neutral-900/5 outline-none"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600 uppercase">To</label>
              <input
                type="date"
                className="block w-full rounded-xl border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:ring-neutral-900/5 outline-none"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="mb-2 text-xs font-medium text-red-600 hover:text-red-700 underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <CardBody>Loading...</CardBody>
        </Card>
      ) : records.length === 0 && lockedCount === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-neutral-700">No entries found for this period.</div>
            {(!startDate && !endDate) && (
              <div className="mt-4">
                <Link href="/"><Button>Start journaling</Button></Link>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <>
          {lockedCount > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <div>
                <strong>{lockedCount} entries are locked.</strong> These were likely imported from a backup using a different passphrase.
              </div>
            </div>
          )}

          {records.length > 0 ? (
            <div className="grid gap-3">
              {displayed.map((r) => (
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
          ) : lockedCount > 0 ? (
            <Card>
              <CardBody>
                <div className="text-sm text-neutral-700 italic">No readable entries found. All entries in this period are locked.</div>
              </CardBody>
            </Card>
          ) : null}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button variant="secondary" disabled={!canPrev} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-xs font-medium text-neutral-500">
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" disabled={!canNext} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}