"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Toast, useToast } from "@/components/Toast";

import { getEntryRecord, deleteEntryRecord, getSettings } from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { decryptJson } from "@/lib/crypto";
import { EntryPayload } from "@/lib/types";
import { formatDate } from "@/lib/util";
import { generateTrustFirstReply } from "@/lib/ai";

export default function EntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message, setMessage } = useToast();

  const [payload, setPayload] = React.useState<EntryPayload | null>(null);
  const [err, setErr] = React.useState("");

  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiReflection, setAiReflection] = React.useState("");

  async function onDelete() {
    if (!confirm("Delete this entry?")) return;
    await deleteEntryRecord(params.id);
    router.push("/archive");
  }

  React.useEffect(() => {
    (async () => {
      const key = getSessionKey();
      if (!key) return router.replace("/unlock");

      const record = await getEntryRecord(params.id);
      if (!record) return setErr("Entry not found.");

      try {
        setPayload(await decryptJson<EntryPayload>(key, record.ciphertextB64, record.ivB64));
      } catch (e) {
        console.error("Decryption failed:", e);
        setErr("DECRYPT_FAILED");
      }
    })();
  }, [params.id, router]);

  async function onReflect() {
    if (!payload) return;

    setAiBusy(true);
    try {
      const settings = await getSettings();
      if (!settings.aiEnabled) return setMessage("AI is off. Enable it in Settings.");

      const apiKey = settings.rememberAiKey
        ? (settings.aiApiKey ?? "")
        : (sessionStorage.getItem("ai_api_key") ?? "");

      if (!apiKey && !settings.useDefaultAiKey) return setMessage("Add an AI API key in Settings (or enable default key).");

      const input = `
SINGLE ENTRY ONLY (no history):
Ritual: ${payload.ritualName}
Intent: ${payload.intent}

Content:
${payload.steps
          .map((s, i) => `Step ${i + 1} prompt: ${s.prompt}\nUser: ${s.response}`)
          .join("\n\n")}

Write a gentle reflection:
- No diagnosis, no labels
- No claims about long-term patterns
- Use tentative language
- 2–5 sentences max
- End with one optional question
`.trim();

      const reply = await generateTrustFirstReply({
        apiKey,
        ritualName: "Entry Reflection",
        stepPrompt: "Reflect gently on this single entry only.",
        userText: input,
      });

      setAiReflection(`${reply.reflection}${reply.question ? `\n\nQuestion: ${reply.question}` : ""}`);
      setMessage("Reflection generated.");
    } catch {
      setMessage("Could not generate reflection.");
    } finally {
      setAiBusy(false);
    }
  }

  if (err === "DECRYPT_FAILED") {
    return (
      <div className="space-y-6">
        <Toast message={message} />
        <PageHeader title="Encrypted Entry" subtitle="This entry is locked." />
        <Card className="border-red-100 bg-red-50">
          <CardBody>
            <div className="text-red-700 font-semibold mb-2">Could not decrypt this entry.</div>
            <div className="text-sm text-red-600 mb-4">
              It may have been saved with a different passphrase, or the data is corrupted.
            </div>
            <Button variant="danger" onClick={onDelete}>
              Delete this entry
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-6">
        <Toast message={message} />
        <Card>
          <CardBody>
            <div className="text-sm text-red-600">{err}</div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="space-y-6">
        <Toast message={message} />
        <Card>
          <CardBody>Loading…</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title={payload.ritualName}
        subtitle={`${formatDate(payload.createdAt)} • ${payload.intent.replace("_", " ")}`}
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onReflect} disabled={aiBusy}>
              {aiBusy ? "Reflecting…" : "Reflect"}
            </Button>
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          </div>
        }
      />

      {aiReflection ? (
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-neutral-900">Reflection</div>
            <div className="mt-1 text-xs text-neutral-500">
              Generated from this entry only (not your archive).
            </div>
            <div className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{aiReflection}</div>
          </CardBody>
        </Card>
      ) : null}

      <div className="space-y-4">
        {payload.steps.map((s, i) => (
          <Card key={i}>
            <CardBody>
              <div className="text-xs text-neutral-500">{s.prompt}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-900">{s.response}</div>
              {/* Display stored AI reflection from the ritual */}
              {(s.aiReflection || s.aiQuestion) && (
                <div className="mt-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 p-3 border border-indigo-100">
                  <div className="text-xs text-indigo-600 font-medium mb-1">AI Reflection</div>
                  {s.aiReflection && (
                    <div className="text-sm text-neutral-700">{s.aiReflection}</div>
                  )}
                  {s.aiQuestion && (
                    <div className="mt-2 text-sm text-neutral-600 italic">
                      <span className="font-medium not-italic">Question:</span> {s.aiQuestion}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => router.push("/archive")}>
          Back
        </Button>
        <Button onClick={() => router.push("/")}>New entry</Button>
      </div>
    </div>
  );
}
