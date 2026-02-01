import { z } from "zod";
import type { EncryptedRecord, Settings } from "./types";
import {
  saveEntryRecord,
  saveMemoryRecord,
  saveSettings,
  deleteAllEntries,
  deleteAllMemoryRecords,
  listEntryRecords,
  listMemoryRecords,
  getSettings,
} from "./storage";

const EncryptedRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  ritualName: z.string().min(1),
  intent: z.string().min(1), // keep permissive; your EncryptedRecord typing narrows this
  ciphertextB64: z.string().min(1),
  ivB64: z.string().min(1),
  saltB64: z.string().min(1),
  kdfVersion: z.number().int().nonnegative(),
});

const BackupSchema = z.object({
  version: z.string().min(1).optional().default("v1"),
  exportedAt: z.string().min(1).optional(),
  entries: z.array(EncryptedRecordSchema).default([]),
  memory: z.array(EncryptedRecordSchema).default([]),
  settings: z
    .object({
      aiEnabled: z.boolean().optional(),
      autoLockMinutes: z.number().int().min(1).max(120).optional(),
      insightsEnabled: z.boolean().optional(),
      rememberAiKey: z.boolean().optional(),
      // 👇 DO NOT import secrets; even if present
      aiApiKey: z.any().optional(),
    })
    .optional(),
});

export type BackupPayload = z.infer<typeof BackupSchema>;

export type ImportPreview = {
  version: string;
  exportedAt?: string;
  entriesCount: number;
  memoryCount: number;
  settingsIncluded: boolean;
};

export type ImportMode = "merge" | "replace";

export type ImportResult = {
  mode: ImportMode;
  entriesImported: number;
  entriesSkipped: number;
  memoryImported: number;
  memorySkipped: number;
  settingsApplied: boolean;
};

export function parseBackupJson(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON. Make sure you pasted a valid backup file.");
  }
  const result = BackupSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Backup format is invalid (schema check failed).");
  }
  return result.data;
}

export function makePreview(data: BackupPayload): ImportPreview {
  return {
    version: data.version ?? "v1",
    exportedAt: data.exportedAt,
    entriesCount: data.entries?.length ?? 0,
    memoryCount: data.memory?.length ?? 0,
    settingsIncluded: Boolean(data.settings),
  };
}

/**
 * Apply import:
 * - MERGE: skip duplicates by id
 * - REPLACE: wipe current entries+memory, then import all
 * - Settings: only safe keys are applied; never import aiApiKey
 */
export async function applyImport(data: BackupPayload, mode: ImportMode): Promise<ImportResult> {
  // Build existing id sets for merge mode
  const existingEntryIds = new Set<string>();
  const existingMemoryIds = new Set<string>();

  if (mode === "merge") {
    const [entries, memory] = await Promise.all([listEntryRecords(), listMemoryRecords()]);
    for (const e of entries) existingEntryIds.add(e.id);
    for (const m of memory) existingMemoryIds.add(m.id);
  } else {
    // replace mode
    await Promise.all([deleteAllEntries(), deleteAllMemoryRecords()]);
  }

  let entriesImported = 0;
  let entriesSkipped = 0;
  let memoryImported = 0;
  let memorySkipped = 0;

  // Import entries
  for (const rec of data.entries ?? []) {
    const record = rec as unknown as EncryptedRecord;
    if (mode === "merge" && existingEntryIds.has(record.id)) {
      entriesSkipped++;
      continue;
    }
    await saveEntryRecord(record);
    entriesImported++;
  }

  // Import memory
  for (const rec of data.memory ?? []) {
    const record = rec as unknown as EncryptedRecord;
    if (mode === "merge" && existingMemoryIds.has(record.id)) {
      memorySkipped++;
      continue;
    }
    await saveMemoryRecord(record);
    memoryImported++;
  }

  // Apply safe settings
  let settingsApplied = false;
  if (data.settings) {
    const current = await getSettings();

    const next: Settings = {
      ...current,
      aiEnabled: data.settings.aiEnabled ?? current.aiEnabled,
      autoLockMinutes: data.settings.autoLockMinutes ?? current.autoLockMinutes,
      insightsEnabled: data.settings.insightsEnabled ?? current.insightsEnabled,
      rememberAiKey: data.settings.rememberAiKey ?? current.rememberAiKey,
      // DO NOT import aiApiKey
      aiApiKey: current.aiApiKey,
    };

    await saveSettings(next);
    settingsApplied = true;
  }

  return {
    mode,
    entriesImported,
    entriesSkipped,
    memoryImported,
    memorySkipped,
    settingsApplied,
  };
}
