import { z } from "zod";

const EncryptedRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  ritualName: z.string(),
  intent: z.enum(["unload", "make_sense", "help_write"]),
  ciphertextB64: z.string(),
  ivB64: z.string(),
  saltB64: z.string(),
  kdfVersion: z.number(),
});

const BackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  entries: z.array(EncryptedRecordSchema),
  memory: z.array(EncryptedRecordSchema),
  settings: z.object({
    aiEnabled: z.boolean(),
    autoLockMinutes: z.number(),
    insightsEnabled: z.boolean(),
    rememberAiKey: z.boolean().optional(),
  }),
});

export type BackupImportPreview = {
  version: 1;
  exportedAt: string;
  entryCount: number;
  memoryCount: number;
  newestEntryAt: string | null;
  oldestEntryAt: string | null;
};

export function parseBackupJson(text: string) {
  const raw = JSON.parse(text);
  return BackupSchema.parse(raw);
}

export function buildPreview(parsed: ReturnType<typeof parseBackupJson>): BackupImportPreview {
  const entryCount = parsed.entries.length;
  const memoryCount = parsed.memory.length;

  const allDates = parsed.entries.map((e) => e.createdAt).sort();
  const oldestEntryAt = allDates.length ? allDates[0] : null;
  const newestEntryAt = allDates.length ? allDates[allDates.length - 1] : null;

  return {
    version: 1,
    exportedAt: parsed.exportedAt,
    entryCount,
    memoryCount,
    newestEntryAt,
    oldestEntryAt,
  };
}
