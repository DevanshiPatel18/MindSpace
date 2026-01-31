"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { getRitualById } from "@/lib/rituals";
import { getSessionKey } from "@/lib/session";
import { encryptJson, getKdfVersion } from "@/lib/crypto";
import { getOrCreateAppSaltB64, saveEntryRecord, saveMemoryRecord } from "@/lib/storage";
import { EntryPayload, MemoryItem } from "@/lib/types";
import { uuid } from "@/lib/util";

export default function RitualPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ritual = getRitualById(params.id);

  const [stepIndex, setStepIndex] = React.useState(0);
  const [text, setText] = React.useState("");
  const [steps, setSteps] = React.useState<EntryPayload["steps"]>([]);
  const [busy, setBusy] = React.useState(false);
  const [saveMemory, setSaveMemory] = React.useState<"unset" | "yes" | "no">("unset");
  const [memoryText, setMemoryText] = React.useState("");

  if (!ritual) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-neutral-700">Ritual not found.</div>
          <div className="mt-4">
            <Button onClick={() => router.push("/")}>Go home</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const isDone = stepIndex >= ritual.steps.length;
  const step = ritual.steps[stepIndex];

  async function onNext() {
    if (!text.trim()) return;
    setSteps((prev) => [...prev, { prompt: step.prompt, response: text.trim(), aiQuestion: null }]);
    setText("");
    setStepIndex((i) => i + 1);
  }

  async function onSave() {
    const key = getSessionKey();
    if (!key) return router.replace("/unlock");

    setBusy(true);
    try {
      const entryId = uuid();
      const payload: EntryPayload = {
        id: entryId,
        createdAt: new Date().toISOString(),
        intent: ritual?.intent ?? 'help_write',
        ritualId: ritual?.id ?? 'unknown_ritual',
        ritualName: ritual?.name ?? 'Unknown Ritual',
        steps,
        tags: { emotion: null, context: null },
      };

      if (ritual?.intent === "make_sense" && saveMemory === "yes" && memoryText.trim()) {
        const mem: MemoryItem = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          text: memoryText.trim(),
        };

        const encMem = await encryptJson(key, mem);
        const saltB64 = await getOrCreateAppSaltB64();

        await saveMemoryRecord({
          id: mem.id,
          createdAt: mem.createdAt,
          ritualName: "Memory",
          intent: "make_sense",
          ciphertextB64: encMem.ciphertextB64,
          ivB64: encMem.ivB64,
          saltB64,
          kdfVersion: getKdfVersion(),
        });
      }

      const enc = await encryptJson(key, payload);
      const saltB64 = await getOrCreateAppSaltB64();

      await saveEntryRecord({
        id: entryId,
        createdAt: payload.createdAt,
        ritualName: payload.ritualName,
        intent: payload.intent,
        ciphertextB64: enc.ciphertextB64,
        ivB64: enc.ivB64,
        saltB64,
        kdfVersion: getKdfVersion(),
      });

      router.push("/archive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={ritual.name} subtitle={`${ritual.durationLabel} • ${ritual.intent.replace("_", " ")}`} />

      {!isDone ? (
        <Card>
          <CardBody>
            <div className="text-xs text-neutral-500">
              Step {stepIndex + 1} of {ritual.steps.length}
            </div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">{step.prompt}</div>

            <textarea
              className="mt-4 w-full min-h-[180px] rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={step.placeholder ?? "Write here…"}
            />

            <div className="mt-4 flex justify-end">
              <Button onClick={onNext}>Next</Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="text-lg font-semibold text-neutral-900">Close the ritual</div>
            <p className="mt-2 text-sm text-neutral-600">{ritual.closingLine}</p>
            {ritual.intent === "make_sense" && (
              <Card className="bg-neutral-50">
                <CardBody>
                  <div className="text-sm font-semibold text-neutral-900">
                    Save one sentence to remember? (optional)
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    This is for continuity only. You choose what matters.
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant={saveMemory === "yes" ? "primary" : "secondary"}
                      onClick={() => setSaveMemory("yes")}
                    >
                      Save
                    </Button>
                    <Button
                      variant={saveMemory === "no" ? "primary" : "secondary"}
                      onClick={() => setSaveMemory("no")}
                    >
                      No
                    </Button>
                  </div>

                  {saveMemory === "yes" && (
                    <div className="mt-4">
                      <input
                        className="w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
                        placeholder="E.g. “I’m doing more than I think.”"
                        value={memoryText}
                        onChange={(e) => setMemoryText(e.target.value)}
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/")}>
                Back home
              </Button>
              <Button onClick={onSave} disabled={busy}>
                {busy ? "Saving…" : "Save entry"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}