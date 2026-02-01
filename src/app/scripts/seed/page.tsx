"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import { seedDemoEntries } from "@/scripts/seedEntries";
import { getSessionKey } from "@/lib/session";

export default function SeedPage() {
  const { message, setMessage } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [hasKey, setHasKey] = React.useState(false);

  React.useEffect(() => {
    setHasKey(Boolean(getSessionKey()));
  }, []);

  async function onSeed() {
    setBusy(true);
    try {
      const total = await seedDemoEntries();
      setMessage(`Seeded ${total} demo entries.`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Seeding failed.";
      setMessage(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title="Seed Demo Entries"
        subtitle="Creates demo entries in your local IndexedDB for testing."
      />

      <Card>
        <CardBody className="space-y-4">
          {!hasKey ? (
            <>
              <div className="text-sm text-neutral-700">
                You&apos;re locked. Unlock in this tab, then come back to seed.
              </div>
              <Link href="/unlock?next=/scripts/seed">
                <Button variant="secondary">Go to Unlock</Button>
              </Link>
            </>
          ) : (
            <>
              <div className="text-sm text-neutral-700">
                You&apos;re unlocked in this tab. Ready to seed.
              </div>
              <Button onClick={onSeed} disabled={busy}>
                {busy ? "Seeding..." : "Seed demo entries"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
