"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Toast, useToast } from "@/components/Toast";

import { deleteAllEntries, getSettings, saveSettings } from "@/lib/storage";
import { clearSessionKey } from "@/lib/session";

export default function SettingsPage() {
  const router = useRouter();
  const { message, setMessage } = useToast();

  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [insightsEnabled, setInsightsEnabled] = React.useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = React.useState(10);

  const [rememberAiKey, setRememberAiKey] = React.useState(false);
  const [aiKey, setAiKey] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const s = await getSettings();
      setAiEnabled(s.aiEnabled);
      setInsightsEnabled(s.insightsEnabled);
      setAutoLockMinutes(s.autoLockMinutes);
      setRememberAiKey(s.rememberAiKey);
      setAiKey(s.aiApiKey ?? "");
    })();
  }, []);

  async function onSave() {
    const next = {
      aiEnabled,
      insightsEnabled,
      autoLockMinutes,
      rememberAiKey,
      aiApiKey: rememberAiKey ? aiKey.trim() : undefined,
    };

    await saveSettings(next);

    if (!rememberAiKey && aiKey.trim()) {
      sessionStorage.setItem("ai_api_key", aiKey.trim());
    }

    setMessage("Saved settings.");
  }

  function onLockNow() {
    clearSessionKey();
    router.replace("/unlock");
  }

  async function onDeleteAll() {
    if (!confirm("Delete all entries on this device? This cannot be undone.")) return;
    await deleteAllEntries();
    setMessage("Deleted all entries.");
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />
      <PageHeader title="Settings" subtitle="You control privacy, AI, and auto-lock." />

      <Card className="shadow-[var(--shadow)]">
        <CardBody className="space-y-6">
          <div>
            <div className="text-sm font-semibold text-neutral-900">AI Companion</div>
            <div className="mt-1 text-xs text-neutral-500">
              Trust-first: reflects your words and asks one gentle question. No diagnosis. No cross-entry claims.
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Enable AI</div>
                <div className="text-xs text-neutral-500 mt-0.5">Optional. Keep the journal fully offline if you want.</div>
              </div>
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
            </div>

            <div className="mt-4 space-y-3">
              <Field
                label="AI API Key"
                hint="Stored in-session by default. If you enable 'remember', it will be saved in local settings."
              >
                <Input
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder="Paste key"
                  type="password"
                />
            <div className="text-xs text-neutral-500">
              If AI is enabled, only the text you write in the current step is sent to the AI API to generate a short reflection.
              Your archive is not uploaded.
            </div>
              </Field>

              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Remember key on this device</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Off by default (safer).</div>
                </div>
                <input type="checkbox" checked={rememberAiKey} onChange={(e) => setRememberAiKey(e.target.checked)} />
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-neutral-900">Insights</div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Enable Insights</div>
                <div className="text-xs text-neutral-500 mt-0.5">On-device aggregation from optional tags.</div>
              </div>
              <input type="checkbox" checked={insightsEnabled} onChange={(e) => setInsightsEnabled(e.target.checked)} />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-neutral-900">Privacy</div>
            <div className="mt-3 grid gap-3">
              <Field label="Auto-lock (minutes)" hint="Locks after inactivity.">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onSave}>Save</Button>
                <Button variant="secondary" onClick={onLockNow}>Lock now</Button>
                <Button variant="danger" onClick={onDeleteAll}>Delete all entries</Button>
              </div>

              <div className="text-xs text-neutral-500">
                Delete is permanent on this device (encrypted data removed from IndexedDB).
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}