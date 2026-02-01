"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Field, Input, Textarea } from "@/components/Field";
import { Toast, useToast } from "@/components/Toast";

import { getRitualById } from "@/lib/rituals";
import { getSessionKey } from "@/lib/session";
import { encryptJson, getKdfVersion } from "@/lib/crypto";
import {
  getOrCreateAppSaltB64,
  getSettings,
  saveEntryRecord,
  saveMemoryRecord,
} from "@/lib/storage";
import { EntryPayload, MemoryItem } from "@/lib/types";
import { uuid } from "@/lib/util";
import { generateTrustFirstReply } from "@/lib/ai";

const EMOTIONS = ["calm", "stressed", "sad", "angry", "anxious", "grateful", "tired", "hopeful", "frustrated"];
const CONTEXTS = ["work", "relationships", "family", "health", "self", "money", "future", "school"];

export default function RitualPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ritual = getRitualById(params.id);
  const { message, setMessage } = useToast();

  const [stepIndex, setStepIndex] = React.useState(0);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [stepsData, setStepsData] = React.useState<EntryPayload["steps"]>([]);

  const [emotion, setEmotion] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<string | null>(null);

  const [memoryConsent, setMemoryConsent] = React.useState<"unset" | "yes" | "notnow" | "no">("unset");
  const [memoryText, setMemoryText] = React.useState("");

  if (!ritual) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-neutral-700">Ritual not found.</div>
          <div className="mt-4"><Button onClick={() => router.push("/")}>Go home</Button></div>
        </CardBody>
      </Card>
    );
  }

  const finished = stepIndex >= ritual.steps.length;
  const step = ritual.steps[stepIndex];
  const isLast = stepIndex === ritual.steps.length - 1;

  async function onNext() {
    if (!text.trim()) {
      setMessage("Write a few words (or one honest sentence).");
      return;
    }

    setBusy(true);
    try {
      const settings = await getSettings();
      const key = getSessionKey();
      if (!key) {
        router.replace("/unlock");
        return;
      }

      let aiReflection: string | undefined;
      let aiQuestion: string | null | undefined;

      if (settings.aiEnabled) {
        const apiKey = settings.rememberAiKey
          ? (settings.aiApiKey ?? "")
          : (sessionStorage.getItem("ai_api_key") ?? "");

        if (apiKey) {
          const prev = stepsData.length ? stepsData[stepsData.length - 1].response : undefined;
          try {
            const reply = await generateTrustFirstReply({
              apiKey,
              intent: ritual.intent,
              ritualName: ritual.name,
              stepPrompt: step.prompt,
              userText: text.trim(),
              previousText: prev,
            });
            aiReflection = reply.reflection;
            aiQuestion = reply.question;
          } catch {
            // silent failure
          }
        }
      }

      const next = [
        ...stepsData,
        {
          prompt: step.prompt,
          response: text.trim(),
          aiReflection,
          aiQuestion: aiQuestion ?? null,
        },
      ];

      setStepsData(next);
      setText("");

      if (!isLast) setStepIndex((i) => i + 1);
      else setStepIndex(ritual.steps.length);
    } finally {
      setBusy(false);
    }
  }

  function onBack() {
    if (stepIndex === 0) return router.push("/");
    if (stepIndex > 0 && stepIndex < ritual.steps.length) setStepIndex((i) => i - 1);
    if (stepIndex >= ritual.steps.length) setStepIndex(ritual.steps.length - 1);
  }

  async function onSave() {
    const key = getSessionKey();
    if (!key) {
      router.replace("/unlock");
      return;
    }

    setBusy(true);
    try {
      const entryId = uuid();
      const createdAt = new Date().toISOString();

      const payload: EntryPayload = {
        id: entryId,
        createdAt,
        intent: ritual.intent,
        ritualId: ritual.id,
        ritualName: ritual.name,
        steps: stepsData,
        tags: { emotion: emotion ?? null, context: context ?? null },
      };

      const { ciphertextB64, ivB64 } = await encryptJson(key, payload);
      const saltB64 = await getOrCreateAppSaltB64();

      await saveEntryRecord({
        id: entryId,
        createdAt,
        ritualName: ritual.name,
        intent: ritual.intent,
        ciphertextB64,
        ivB64,
        saltB64,
        kdfVersion: getKdfVersion(),
      });

      if (ritual.intent === "make_sense" && memoryConsent === "yes" && memoryText.trim()) {
        const mem: MemoryItem = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          text: memoryText.trim(),
        };
        const enc = await encryptJson(key, mem);
        await saveMemoryRecord({
          id: mem.id,
          createdAt: mem.createdAt,
          ritualName: "Memory",
          intent: "make_sense",
          ciphertextB64: enc.ciphertextB64,
          ivB64: enc.ivB64,
          saltB64,
          kdfVersion: getKdfVersion(),
        });
      }

      setMessage("Saved.");
      router.push("/archive");
    } catch {
      setMessage("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toast message={message} />

      <PageHeader
        title={ritual.name}
        subtitle={`${ritual.durationLabel} • ${ritual.intent.replace("_", " ")}`}
        right={<Button variant="ghost" onClick={() => router.push("/")}>Exit</Button>}
      />

      {!finished ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-xs text-neutral-500">
              Step {stepIndex + 1} of {ritual.steps.length}
            </div>

            <div className="mt-2 text-lg font-semibold text-neutral-900">{step.prompt}</div>

            <div className="mt-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={step.placeholder ?? "Write here…"}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={onBack}>Back</Button>
              <Button onClick={onNext} disabled={busy}>
                {busy ? "Thinking…" : isLast ? "Finish prompts" : "Next"}
              </Button>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              Tip: honest and small beats perfect.
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card className="shadow-[var(--shadow)]">
            <CardBody>
              <div className="text-lg font-semibold text-neutral-900">Close the ritual</div>
              <p className="mt-2 text-sm text-neutral-600">{ritual.closingLine}</p>

              <div className="mt-5 grid gap-4">
                <Card className="bg-neutral-50">
                  <CardBody>
                    <div className="text-sm font-semibold text-neutral-900">Optional tags (for your insights)</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Descriptive labels you choose. No scoring.
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Emotion (optional)">
                        <select
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={emotion ?? ""}
                          onChange={(e) => setEmotion(e.target.value || null)}
                        >
                          <option value="">—</option>
                          {EMOTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </Field>

                      <Field label="Context (optional)">
                        <select
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={context ?? ""}
                          onChange={(e) => setContext(e.target.value || null)}
                        >
                          <option value="">—</option>
                          {CONTEXTS.map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </Field>
                    </div>
                  </CardBody>
                </Card>

                {ritual.intent === "make_sense" ? (
                  <Card className="bg-neutral-50">
                    <CardBody>
                      <div className="text-sm font-semibold text-neutral-900">Save one sentence to remember (optional)</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Trust-first memory: you choose what matters.
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant={memoryConsent === "yes" ? "primary" : "secondary"} onClick={() => setMemoryConsent("yes")}>
                          Save
                        </Button>
                        <Button variant={memoryConsent === "notnow" ? "primary" : "secondary"} onClick={() => setMemoryConsent("notnow")}>
                          Not now
                        </Button>
                        <Button variant={memoryConsent === "no" ? "primary" : "secondary"} onClick={() => setMemoryConsent("no")}>
                          No
                        </Button>
                      </div>

                      {memoryConsent === "yes" ? (
                        <div className="mt-4">
                          <Field label="Your sentence">
                            <Input
                              value={memoryText}
                              onChange={(e) => setMemoryText(e.target.value)}
                              placeholder='e.g., “I feel behind even when I’m working hard.”'
                            />
                          </Field>
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button variant="secondary" onClick={onBack}>Back</Button>
                <Button onClick={onSave} disabled={busy}>
                  {busy ? "Saving…" : "Save & finish"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
