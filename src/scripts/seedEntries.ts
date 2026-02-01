"use client";

/**
 * Seed demo journal entries for testing Insights + AI flows
 *
 * HOW TO RUN:
 * 1. Unlock the app in browser once (so a session key exists)
 * 2. Visit /scripts/seed and click "Seed demo entries"
 */

import { getOrCreateAppSaltB64, saveEntryRecord, newEncryptedRecordIndex } from "@/lib/storage";
import { encryptJson, getKdfVersion } from "@/lib/crypto";
import { getSessionKey } from "@/lib/session";
import { uuid } from "@/lib/util";
import type { EntryPayload } from "@/lib/types";

/* ------------------ CONFIG ------------------ */

const DAYS = 21; // spread across last N days
const ENTRIES_PER_DAY = [1, 2]; // random range

const EMOTIONS = ["stressed", "calm", "grateful", "overwhelmed", "hopeful"];
const CONTEXTS = ["work", "health", "family", "self", "relationships"];

const INTENTS: EntryPayload["intent"][] = [
  "unload",
  "make_sense",
  "help_write",
];

const RITUAL_META: Record<EntryPayload["intent"], { ritualId: string; ritualName: string }> = {
  unload: { ritualId: "end-the-day", ritualName: "End the Day" },
  make_sense: { ritualId: "make-sense", ritualName: "Make Sense of This" },
  help_write: { ritualId: "one-sentence-start", ritualName: "One Sentence Start" },
};

/* ------------------ HELPERS ------------------ */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeText(intent: EntryPayload["intent"], emotion: string, context: string) {
  switch (intent) {
    case "unload":
      return `Today felt ${emotion}. Most of it was about ${context}. I needed to get this out of my head so I could breathe again.`;
    case "make_sense":
      return `I noticed feeling ${emotion} when dealing with ${context}. I'm trying to understand why this keeps coming up and what it might be asking of me.`;
    case "help_write":
      return `I want to write something meaningful, but I'm not sure where to start. Lately, ${context} has been making me feel ${emotion}.`;
  }
}

/* ------------------ MAIN ------------------ */

export async function seedDemoEntries(): Promise<number> {
  const key = getSessionKey();
  if (!key) {
    throw new Error("Unlock the app first so a session key exists.");
  }

  let total = 0;

  for (let day = 0; day < DAYS; day++) {
    const count =
      ENTRIES_PER_DAY[0] +
      Math.floor(Math.random() * (ENTRIES_PER_DAY[1] - ENTRIES_PER_DAY[0] + 1));

    for (let i = 0; i < count; i++) {
      const intent = pick(INTENTS);
      const emotion = pick(EMOTIONS);
      const context = pick(CONTEXTS);

      const entryId = uuid();
      const ritualMeta = RITUAL_META[intent];
      const createdAt = daysAgo(day);

      const payload: EntryPayload = {
        id: entryId,
        ritualId: ritualMeta.ritualId,
        ritualName: ritualMeta.ritualName,
        intent,
        createdAt,
        steps: [
          {
            prompt: "Write freely.",
            response: makeText(intent, emotion, context),
          },
        ],
        tags: {
          emotion,
          context,
        },
      };

      const { ciphertextB64, ivB64 } = await encryptJson(key, payload);
      const saltB64 = await getOrCreateAppSaltB64();

      await saveEntryRecord({
        ...newEncryptedRecordIndex(intent, payload.ritualName),
        id: entryId,
        createdAt,
        ciphertextB64,
        ivB64,
        saltB64,
        kdfVersion: getKdfVersion(),
      });

      total++;
    }
  }

  console.log(`✅ Seeded ${total} demo journal entries.`);
  return total;
}
