"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { Textarea, Field, Input } from "@/components/Field";
import { Toast, useToast } from "@/components/Toast";

import { getRitualById } from "@/lib/rituals";
import {
  getSettings,
  saveEntryRecord,
  saveMemoryRecord,
  newEncryptedRecordIndex,
} from "@/lib/storage";
import { getSessionKey } from "@/lib/session";
import { encryptJson, getKdfVersion } from "@/lib/crypto";
import type { EntryPayload, MemoryItem } from "@/lib/types";
import { generateTrustFirstReply } from "@/lib/ai";
import { uuid } from "@/lib/util";
import { getOrCreateAppSaltB64 } from "@/lib/storage";

const EMOTIONS = ["calm", "stressed", "sad", "angry", "anxious", "grateful", "tired", "hopeful", "frustrated"];
const CONTEXTS = ["work", "relationships", "family", "health", "self", "money", "future", "school"];

type PendingAi = {
  reflection?: string;
  question?: string | null;
  nextIndex: number; // where to go after closing this panel
};

export default function RitualPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ritual = getRitualById(params.id);
  const { message, setMessage } = useToast();

  const seedQuestion = searchParams.get("seed"); // module 14: optional first-step question from Home AI nudge

  const [stepIndex, setStepIndex] = React.useState(0);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [settings, setSettings] = React.useState<Awaited<ReturnType<typeof getSettings>> | null>(null);

  const [stepsData, setStepsData] = React.useState<EntryPayload["steps"]>([]);
  const [emotion, setEmotion] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<string | null>(null);

  // Seed step (optional)
  const [seedHandled, setSeedHandled] = React.useState(false);
  const [seedText, setSeedText] = React.useState("");

  // After-step AI follow-up (optional)
  const [pendingAi, setPendingAi] = React.useState<PendingAi | null>(null);
  const [followupAnswer, setFollowupAnswer] = React.useState("");

  // Trust-first memory prompt (Make sense only, consent-based)
  const [memoryConsent, setMemoryConsent] = React.useState<"unset" | "yes" | "no" | "notnow">("unset");
  const [memoryText, setMemoryText] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
    })();
  }, []);

  if (!ritual) {
    return (
      <Card>
        <CardBody>
          <div className="text-neutral-900 font-semibold">Ritual not found.</div>
          <div className="mt-3">
            <Button onClick={() => router.push("/")}>Go home</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const inMainSteps = stepIndex < ritual?.steps.length;
  const finished = stepIndex >= ritual?.steps.length;
  const step = inMainSteps ? ritual?.steps[stepIndex] : null;
  const isLastMainStep = stepIndex === ritual?.steps.length - 1;

  function getApiKey(s: Awaited<ReturnType<typeof getSettings>>) {
    return s.rememberAiKey ? (s.aiApiKey ?? "") : (sessionStorage.getItem("ai_api_key") ?? "");
  }

  async function addStepAndMaybeAi(opts: { prompt: string; response: string; nextIndex: number }) {
    const s = settings ?? (await getSettings());
    const key = getSessionKey();
    if (!key) throw new Error("locked");

    let aiReflection: string | undefined;
    let aiQuestion: string | null | undefined;

    if (s.aiEnabled) {
      const apiKey = getApiKey(s) ?? "";

      if (!apiKey && !s.useDefaultAiKey) {
        setMessage("AI is on, but no key set. Add one or use default in Settings.");
      } else {
        // Try with user key OR fallback to server proxy (if usage allowed)
        const prev = stepsData.length ? stepsData[stepsData.length - 1].response : undefined;
        const reply = await generateTrustFirstReply({
          apiKey,
          ritualName: ritual?.name ?? "",
          stepPrompt: opts.prompt,
          userText: opts.response,
          previousText: prev,
        });
        aiReflection = reply.reflection;
        aiQuestion = reply.question;
      }
    }

    const nextSteps = [
      ...stepsData,
      {
        prompt: opts.prompt,
        response: opts.response,
        aiReflection,
        aiQuestion: aiQuestion ?? null,
      },
    ];

    setStepsData(nextSteps);

    // If we got AI content, show an optional follow-up panel before moving on.
    if ((aiReflection && aiReflection.trim()) || (aiQuestion && aiQuestion.trim())) {
      setPendingAi({
        reflection: aiReflection,
        question: aiQuestion ?? null,
        nextIndex: opts.nextIndex,
      });
      setFollowupAnswer("");
      return;
    }

    setStepIndex(opts.nextIndex);
  }

  async function onNext() {
    if (!step) return;
    if (!text.trim()) {
      setMessage("Write a few words (or a sentence).");
      return;
    }

    setBusy(true);
    try {
      const nextIndex = isLastMainStep ? (ritual?.steps.length ?? 0) : stepIndex + 1;
      await addStepAndMaybeAi({ prompt: step.prompt, response: text.trim(), nextIndex });
      setText("");
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onBack() {
    if (pendingAi) return; // keep user on the AI panel until they choose
    if (!inMainSteps) return setStepIndex((ritual?.steps?.length ?? 0) - 1);
    if (stepIndex === 0) return router.push("/");
    setStepIndex(stepIndex - 1);
  }

  async function onSeedSave() {
    if (!seedQuestion) return setSeedHandled(true);
    if (!seedText.trim()) {
      setSeedHandled(true);
      return;
    }
    setBusy(true);
    try {
      await addStepAndMaybeAi({
        prompt: seedQuestion,
        response: seedText.trim(),
        nextIndex: 0,
      });
      setSeedHandled(true);
      setSeedText("");
    } catch {
      setMessage("Could not save that step.");
    } finally {
      setBusy(false);
    }
  }

  function onSeedSkip() {
    setSeedHandled(true);
  }

  async function onFollowupContinue(skipAnswer: boolean) {
    if (!pendingAi) return;

    const q = pendingAi.question?.trim();
    const answer = followupAnswer.trim();

    // Optionally store user's answer to AI question as an extra step
    if (!skipAnswer && q && answer) {
      setStepsData((prev) => [
        ...prev,
        { prompt: q, response: answer, aiReflection: undefined, aiQuestion: null },
      ]);
    }

    setPendingAi(null);
    setFollowupAnswer("");
    setStepIndex(pendingAi.nextIndex);
  }

  async function onSaveAndFinish() {
    const key = getSessionKey();
    if (!key) {
      setMessage("Locked. Unlock to save.");
      router.replace("/unlock");
      return;
    }

    setBusy(true);
    try {
      const entryId = uuid();

      const payload: EntryPayload = {
        id: entryId,
        ritualId: params.id,
        ritualName: ritual?.name ?? "",
        intent: ritual?.intent || "unload", // Fallback if undefined
        createdAt: new Date().toISOString(),
        steps: stepsData,
        tags: {
          emotion: emotion ?? null,
          context: context ?? null,
        },
      };

      const { ciphertextB64, ivB64 } = await encryptJson(key, payload);
      const saltB64 = await getOrCreateAppSaltB64();

      const record = {
        ...newEncryptedRecordIndex(ritual?.intent || "unload", ritual?.name ?? ""),
        id: entryId,
        createdAt: payload.createdAt,
        ciphertextB64,
        ivB64,
        saltB64,
        kdfVersion: getKdfVersion(),
      };

      await saveEntryRecord(record);

      // Trust-first memory: user-approved sentence only (Make sense)
      if (ritual?.intent === "make_sense" && memoryConsent === "yes" && memoryText.trim()) {
        const mem: MemoryItem = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          text: memoryText.trim(),
        };
        const enc = await encryptJson(key, mem);

        await saveMemoryRecord({
          ...newEncryptedRecordIndex("make_sense", "Memory"),
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
        title={ritual?.name}
        subtitle={`${ritual?.durationLabel} • ${ritual?.intent?.replace("_", " ")}`}
        right={
          <Button variant="ghost" onClick={() => router.push("/")}>
            Exit
          </Button>
        }
      />

      {/* Module 14: Optional seed step */}
      {!seedHandled && seedQuestion ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-xs text-neutral-500">Optional starter question</div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">{seedQuestion}</div>
            <div className="mt-4">
              <Textarea
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder="If you want, answer in a few lines… (or skip)"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={onSeedSkip}>
                Skip
              </Button>
              <Button onClick={onSeedSave} disabled={busy}>
                {busy ? "Saving…" : "Add & continue"}
              </Button>
            </div>
            <div className="mt-3 text-xs text-neutral-500">
              This stays inside your encrypted entry. You control what gets written.
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* AI follow-up panel */}
      {pendingAi ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-xs text-neutral-500">Optional AI reflection</div>
            {pendingAi.reflection ? (
              <div className="mt-2 text-sm text-neutral-800">{pendingAi.reflection}</div>
            ) : null}

            {pendingAi.question ? (
              <>
                <div className="mt-4 text-sm font-semibold text-neutral-900">A gentle question</div>
                <div className="mt-1 text-sm text-neutral-800">{pendingAi.question}</div>

                <div className="mt-3">
                  <Textarea
                    value={followupAnswer}
                    onChange={(e) => setFollowupAnswer(e.target.value)}
                    placeholder="Answer if it helps… (optional)"
                    className="min-h-[120px]"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <Button variant="secondary" onClick={() => onFollowupContinue(true)}>
                    Skip
                  </Button>
                  <Button onClick={() => onFollowupContinue(false)}>
                    {followupAnswer.trim() ? "Add answer & continue" : "Continue"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-center justify-end">
                <Button onClick={() => onFollowupContinue(true)}>Continue</Button>
              </div>
            )}

            <div className="mt-3 text-xs text-neutral-500">
              AI is optional. It does not diagnose or score you. You can turn it off in Settings.
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Main steps */}
      {inMainSteps && !pendingAi ? (
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="text-xs text-neutral-500">
              Step {stepIndex + 1} of {ritual?.steps.length}
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-neutral-900 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / (ritual?.steps?.length || 1)) * 100}%` }}
              />
            </div>
            <div className="mt-2 text-lg font-semibold text-neutral-900">{step?.prompt}</div>

            <div className="mt-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={step?.placeholder ?? "Write here…"}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button onClick={onNext} disabled={busy}>
                {busy ? "Thinking…" : isLastMainStep ? "Finish prompts" : "Next"}
              </Button>
            </div>

            <div className="mt-4 text-xs text-neutral-500">Tip: a few honest lines beats a perfect paragraph.</div>
          </CardBody>
        </Card>
      ) : null}

      {/* Finish */}
      {finished && !pendingAi ? (
        <>
          <Card className="shadow-[var(--shadow)]">
            <CardBody>
              <div className="text-lg font-semibold text-neutral-900">Close the ritual</div>
              <p className="mt-2 text-sm text-neutral-600">{ritual?.closingLine}</p>

              <div className="mt-5 grid gap-4">
                <Card className="bg-neutral-50">
                  <CardBody>
                    <div className="text-sm font-semibold text-neutral-900">Optional tags (for on-device insights)</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      These are labels you choose. No scores. No judgment.
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Emotion (optional)">
                        <select
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={emotion ?? ""}
                          onChange={(e) => setEmotion(e.target.value || null)}
                        >
                          <option value="">—</option>
                          {EMOTIONS.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Context (optional)">
                        <select
                          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={context ?? ""}
                          onChange={(e) => setContext(e.target.value || null)}
                        >
                          <option value="">—</option>
                          {CONTEXTS.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </CardBody>
                </Card>

                {ritual?.intent === "make_sense" ? (
                  <Card className="bg-neutral-50">
                    <CardBody>
                      <div className="text-sm font-semibold text-neutral-900">Save one sentence to remember (optional)</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Memories are user-approved sentences that help the app offer continuity later (without re-reading your whole archive).
                      </div>

                      <div className="mt-4 flex gap-2">
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
                          <Field label="Your sentence" hint="Keep it factual and you-centered. You can edit or delete later in Memories.">
                            <Input
                              value={memoryText}
                              onChange={(e) => setMemoryText(e.target.value)}
                              placeholder='E.g., “I feel behind at work even when I’m doing a lot.”'
                            />
                          </Field>
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Back home
                </Button>
                <Button onClick={onSaveAndFinish} disabled={busy}>
                  {busy ? "Saving…" : "Save & finish"}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="shadow-[var(--shadow)]">
            <CardBody>
              <div className="text-sm font-semibold text-neutral-900">What you wrote</div>
              <div className="mt-4 space-y-4">
                {stepsData.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-xs text-neutral-500">{s.prompt}</div>
                    <div className="mt-2 text-sm text-neutral-900 whitespace-pre-wrap">{s.response}</div>
                    {(s.aiReflection || s.aiQuestion) ? (
                      <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                        {s.aiReflection ? <div className="text-sm text-neutral-800">{s.aiReflection}</div> : null}
                        {s.aiQuestion ? (
                          <div className="mt-2 text-sm text-neutral-700">
                            <span className="font-semibold">Question:</span> {s.aiQuestion}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
