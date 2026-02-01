"use client";

/**
 * Seed demo journal entries for testing Insights + AI flows
 *
 * Creates realistic journal entries with:
 * - Meaningful patterns (work stress during weekdays, calm on weekends)
 * - Multi-step ritual responses
 * - AI reflections included for demonstration
 * - Variety of emotions and contexts with intentional trends
 *
 * HOW TO RUN:
 * 1. Unlock the app in browser once (so a session key exists)
 * 2. Visit /scripts/seed and click "Seed demo entries"
 */

import { getOrCreateAppSaltB64, saveEntryRecord, saveMemoryRecord, newEncryptedRecordIndex } from "@/lib/storage";
import { encryptJson, getKdfVersion } from "@/lib/crypto";
import { getSessionKey } from "@/lib/session";
import { uuid } from "@/lib/util";
import type { EntryPayload, MemoryItem } from "@/lib/types";

/* ------------------ DEMO NARRATIVE ------------------ */

// Curated entries that tell a story and create meaningful patterns
const CURATED_ENTRIES: Array<{
  daysAgo: number;
  intent: EntryPayload["intent"];
  emotion: string;
  context: string;
  steps: EntryPayload["steps"];
}> = [
  // Week 1 - Work stress pattern (stressed + work dominates)
  {
    daysAgo: 14,
    intent: "unload",
    emotion: "stressed",
    context: "work",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "The deadline for the quarterly report keeps getting moved up. I feel like I am always behind no matter how fast I work. My manager mentioned it casually but it felt like pressure.",
        aiReflection: "It sounds like the shifting deadlines are creating a sense of instability. Feeling behind despite effort can be exhausting.",
        aiQuestion: "What would enough look like for you in this situation?",
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "The email chains can wait. I do not need to respond tonight. Sleep matters more right now.",
      },
    ],
  },
  {
    daysAgo: 13,
    intent: "make_sense",
    emotion: "anxious",
    context: "work",
    steps: [
      {
        prompt: "What happened? (just the facts)",
        response: "Had a meeting where they announced restructuring. My team might be affected. No details yet, just uncertainty.",
        aiReflection: "Uncertainty about your role can feel unsettling. Not knowing is often harder than knowing.",
        aiQuestion: "What parts of this are within your control right now?",
      },
      {
        prompt: "What did you feel?",
        response: "Anxious. A tightness in my chest. I kept thinking about worst-case scenarios even though nothing has happened yet.",
      },
      {
        prompt: "What story did you tell yourself about it?",
        response: "That I might lose my job. That I am not essential. That I should have seen this coming.",
      },
      {
        prompt: "What do you need right now?",
        response: "Clarity. But since I cannot get that, I need to focus on what I can control: my work quality, my health.",
      },
    ],
  },
  {
    daysAgo: 12,
    intent: "unload",
    emotion: "tired",
    context: "work",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "Back-to-back meetings all day. I did not get any real work done, just talked about work. Feels like running on a treadmill.",
        aiReflection: "Meeting fatigue is real. It might feel like you are busy but not productive.",
        aiQuestion: null,
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "Everything. I am logging off now. Tomorrow will come regardless.",
      },
    ],
  },

  // Weekend relief - calm, self, family
  {
    daysAgo: 11,
    intent: "help_write",
    emotion: "calm",
    context: "self",
    steps: [
      {
        prompt: "Start with one sentence about your day",
        response: "Today I woke up without an alarm. Made coffee slowly. Sat by the window. It felt like reclaiming something.",
        aiReflection: "Reclaiming unstructured time can feel restorative. It sounds like you found a moment of peace.",
        aiQuestion: "How might you protect moments like this during busier days?",
      },
      {
        prompt: "What do you wish you could say?",
        response: "I deserve mornings like this more often. Not just on weekends.",
      },
    ],
  },
  {
    daysAgo: 10,
    intent: "make_sense",
    emotion: "grateful",
    context: "family",
    steps: [
      {
        prompt: "What happened? (just the facts)",
        response: "Sunday dinner with my parents. Nothing special planned, just showed up. We talked about old memories.",
        aiReflection: "Simple presence with family can be grounding. It sounds like the connection mattered more than the activity.",
        aiQuestion: null,
      },
      {
        prompt: "What did you feel?",
        response: "Grateful. Warm. A little sad that these moments are rare now.",
      },
      {
        prompt: "What story did you tell yourself about it?",
        response: "That I should prioritize this more. That work will always be there but people will not.",
      },
      {
        prompt: "What do you need right now?",
        response: "To remember this feeling next time work tries to take over my weekends.",
      },
    ],
  },

  // Week 2 - More work stress, then breakthrough
  {
    daysAgo: 9,
    intent: "unload",
    emotion: "frustrated",
    context: "work",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "A colleague took credit for my idea in the team meeting. I did not say anything. Just sat there frozen. Now I am replaying what I should have said.",
        aiReflection: "Feeling overlooked can be painful, especially when you did not expect it. Replaying moments is common when we feel caught off guard.",
        aiQuestion: "What would speaking up have meant to you?",
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "The confrontation. I need to think about whether it is worth addressing or letting go.",
      },
    ],
  },
  {
    daysAgo: 8,
    intent: "make_sense",
    emotion: "stressed",
    context: "work",
    steps: [
      {
        prompt: "What happened? (just the facts)",
        response: "Worked until 9pm again. Third time this week. Deadline is Friday.",
        aiReflection: "Sustained long hours can wear down both body and mind. It sounds like you are in a sprint phase.",
        aiQuestion: "What will you do to recover after Friday?",
      },
      {
        prompt: "What did you feel?",
        response: "Stressed. Resentful. Like my life is just work right now.",
      },
      {
        prompt: "What story did you tell yourself about it?",
        response: "That this is temporary. But I have told myself that before.",
      },
      {
        prompt: "What do you need right now?",
        response: "For Friday to arrive. And permission to rest after.",
      },
    ],
  },
  {
    daysAgo: 7,
    intent: "unload",
    emotion: "hopeful",
    context: "work",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "Finished the project. Finally. Got positive feedback from the director. It actually felt worth it for a moment.",
        aiReflection: "Completion and recognition can be powerful. It sounds like the effort was seen.",
        aiQuestion: null,
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "Everything. Tonight I am celebrating with takeout and a movie.",
      },
    ],
  },

  // Week 3 - Shift toward balance, health focus
  {
    daysAgo: 6,
    intent: "help_write",
    emotion: "calm",
    context: "health",
    steps: [
      {
        prompt: "Start with one sentence about your day",
        response: "Today I went for a morning run for the first time in months. My legs hurt but my mind felt clear.",
        aiReflection: "Movement can shift mental state in ways thinking alone cannot. It sounds like you rediscovered something.",
        aiQuestion: "What made today different from other days you meant to run?",
      },
      {
        prompt: "What do you wish you could say?",
        response: "I want to keep this up. Not for anyone else, just for how it feels.",
      },
    ],
  },
  {
    daysAgo: 5,
    intent: "make_sense",
    emotion: "hopeful",
    context: "self",
    steps: [
      {
        prompt: "What happened? (just the facts)",
        response: "Set a boundary at work today. Said I could not take on the extra project. My manager accepted it without pushback.",
        aiReflection: "Setting boundaries and having them respected can feel validating. It sounds like you practiced self-advocacy.",
        aiQuestion: "How did it feel in your body when you said no?",
      },
      {
        prompt: "What did you feel?",
        response: "Nervous at first, then relieved. A little proud.",
      },
      {
        prompt: "What story did you tell yourself about it?",
        response: "That I can do this. That saying no does not make me less valuable.",
      },
      {
        prompt: "What do you need right now?",
        response: "To remember this worked. To try it again next time.",
      },
    ],
  },
  {
    daysAgo: 4,
    intent: "unload",
    emotion: "grateful",
    context: "relationships",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "Had a long call with my best friend. We have not talked properly in weeks. She just listened while I vented. Did not try to fix anything.",
        aiReflection: "Being heard without judgment can be healing. It sounds like the connection was what you needed.",
        aiQuestion: null,
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "All the things I was worrying about before the call. They feel smaller now.",
      },
    ],
  },

  // Recent days - building positive momentum
  {
    daysAgo: 3,
    intent: "help_write",
    emotion: "calm",
    context: "self",
    steps: [
      {
        prompt: "Start with one sentence about your day",
        response: "Today I realized I have not felt overwhelmed since Monday. That is a shift.",
        aiReflection: "Noticing positive change is important. It sounds like something has shifted in how you are carrying things.",
        aiQuestion: "What do you think contributed to this feeling?",
      },
      {
        prompt: "What do you wish you could say?",
        response: "I am starting to trust myself again. Slowly.",
      },
    ],
  },
  {
    daysAgo: 2,
    intent: "make_sense",
    emotion: "hopeful",
    context: "health",
    steps: [
      {
        prompt: "What happened? (just the facts)",
        response: "Went to bed at 10pm last night. Woke up before my alarm. Made breakfast instead of grabbing coffee on the go.",
        aiReflection: "Small routines can compound. It sounds like you are investing in yourself differently.",
        aiQuestion: null,
      },
      {
        prompt: "What did you feel?",
        response: "Hopeful. Like I am building something that might last.",
      },
      {
        prompt: "What story did you tell yourself about it?",
        response: "That small changes matter. That I do not need a big transformation, just consistency.",
      },
      {
        prompt: "What do you need right now?",
        response: "To keep going. One day at a time.",
      },
    ],
  },
  {
    daysAgo: 1,
    intent: "unload",
    emotion: "calm",
    context: "work",
    steps: [
      {
        prompt: "What is still sitting with you from today?",
        response: "Work was busy but manageable. I left on time. Did not bring my laptop home. That felt like a win.",
        aiReflection: "Protecting your boundaries takes practice. Leaving work at work is an achievement worth noting.",
        aiQuestion: null,
      },
      {
        prompt: "What can wait until tomorrow?",
        response: "The inbox. The notifications. Tomorrow-me will handle it.",
      },
    ],
  },
  {
    daysAgo: 0,
    intent: "help_write",
    emotion: "grateful",
    context: "self",
    steps: [
      {
        prompt: "Start with one sentence about your day",
        response: "Today I journaled without prompting myself. I just wanted to write. That is new.",
        aiReflection: "When reflection becomes something you want rather than have to do, it is a sign of integration.",
        aiQuestion: "What has journaling given you that you did not expect?",
      },
      {
        prompt: "What do you wish you could say?",
        response: "I am proud of myself for showing up, even on hard days.",
      },
    ],
  },
];

// Demo memories to seed
const DEMO_MEMORIES: string[] = [
  "I feel behind at work even when I am doing a lot.",
  "Sunday dinners with family help me reset.",
  "Saying no does not make me less valuable.",
  "Small changes matter more than big transformations.",
];

/* ------------------ HELPERS ------------------ */

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  // Randomize time within the day for realism
  d.setHours(Math.floor(Math.random() * 12) + 8); // 8am - 8pm
  d.setMinutes(Math.floor(Math.random() * 60));
  return d.toISOString();
}

/* ------------------ MAIN ------------------ */

export async function seedDemoEntries(): Promise<number> {
  const key = getSessionKey();
  if (!key) {
    throw new Error("Unlock the app first so a session key exists.");
  }

  const saltB64 = await getOrCreateAppSaltB64();
  let total = 0;

  // Seed curated entries
  for (const entry of CURATED_ENTRIES) {
    const entryId = uuid();
    const createdAt = daysAgo(entry.daysAgo);

    const ritualMeta = {
      unload: { ritualId: "end-the-day", ritualName: "End the Day" },
      make_sense: { ritualId: "make-sense", ritualName: "Make Sense of This" },
      help_write: { ritualId: "one-sentence-start", ritualName: "One Sentence Start" },
    }[entry.intent];

    const payload: EntryPayload = {
      id: entryId,
      ritualId: ritualMeta.ritualId,
      ritualName: ritualMeta.ritualName,
      intent: entry.intent,
      createdAt,
      steps: entry.steps,
      tags: {
        emotion: entry.emotion,
        context: entry.context,
      },
    };

    const { ciphertextB64, ivB64 } = await encryptJson(key, payload);

    await saveEntryRecord({
      ...newEncryptedRecordIndex(entry.intent, payload.ritualName),
      id: entryId,
      createdAt,
      ciphertextB64,
      ivB64,
      saltB64,
      kdfVersion: getKdfVersion(),
    });

    total++;
  }

  // Seed demo memories
  for (const memText of DEMO_MEMORIES) {
    const memId = uuid();
    const mem: MemoryItem = {
      id: memId,
      createdAt: daysAgo(Math.floor(Math.random() * 10)),
      text: memText,
    };

    const { ciphertextB64, ivB64 } = await encryptJson(key, mem);

    await saveMemoryRecord({
      ...newEncryptedRecordIndex("make_sense", "Memory"),
      id: memId,
      createdAt: mem.createdAt,
      ritualName: "Memory",
      intent: "make_sense",
      ciphertextB64,
      ivB64,
      saltB64,
      kdfVersion: getKdfVersion(),
    });
  }

  console.log(`Seeded ${total} demo journal entries + ${DEMO_MEMORIES.length} memories.`);
  return total;
}
