"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";
import { seedDemoEntries, generateDynamicAiEntries } from "@/scripts/seedEntries";
import { getSessionKey } from "@/lib/session";
import { getSettings } from "@/lib/storage";

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

  async function onAiSeed() {
    setBusy(true);
    try {
      const settings = await getSettings();
      const apiKey = settings.rememberAiKey
        ? (settings.aiApiKey ?? "")
        : (sessionStorage.getItem("ai_api_key") ?? "");

      if (!apiKey && !settings.useDefaultAiKey) {
        return setMessage("Add an AI API key in Settings first.");
      }

      const total = await generateDynamicAiEntries(apiKey);
      setMessage(`AI generated and seeded ${total} custom entries.`);
    } catch (e: any) {
      console.error("AI Seed Error:", e);
      if (e.name === "ZodError") {
        console.error("Zod Issues:", e.issues);
        setMessage(`Validation Error: Check console for details.`);
      } else {
        const err = e instanceof Error ? e.message : String(e);
        setMessage(`Error: ${err}`);
      }
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
              <div className="flex flex-wrap gap-3">
                <Button onClick={onSeed} disabled={busy} variant="secondary">
                  {busy ? "Processing..." : "Seed static demo data"}
                </Button>
                <Button onClick={onAiSeed} disabled={busy}>
                  {busy ? "AI Thinking..." : "Generate unique history with AI"}
                </Button>
              </div>
              <div className="text-xs text-neutral-500 italic">
                The AI option will create a unique 2-week history based on a random persona.
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
