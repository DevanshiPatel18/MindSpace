export type Intent = "unload" | "make_sense" | "help_write";

export type EntryPayload = {
  id: string;
  createdAt: string;
  intent: Intent;
  ritualId: string;
  ritualName: string;
  steps: Array<{
    prompt: string;
    response: string;
    aiReflection?: string | null;
    aiQuestion?: string | null;
  }>;
  tags?: { emotion?: string | null; context?: string | null };
};

export type MemoryItem = { id: string; createdAt: string; text: string };

export type EncryptedRecord = {
  id: string;
  createdAt: string;
  ritualName: string;
  intent: Intent;
  ciphertextB64: string;
  ivB64: string;
  saltB64: string; // app salt index
  kdfVersion: number;
};

export type Settings = {
  aiEnabled: boolean;
  insightsEnabled: boolean;
  autoLockMinutes: number;
  rememberAiKey: boolean;
  aiApiKey?: string;
  useDefaultAiKey: boolean;
  encryptedAiApiKey?: { ciphertextB64: string; ivB64: string };
};