import { openDB, DBSchema } from "idb";
import type { EncryptedRecord, Settings } from "./types";
import { makeRandomSalt } from "./crypto";
import { b64FromBytes, uuid } from "./util";

interface JournalDB extends DBSchema {
  entries: {
    key: string;
    value: EncryptedRecord;
    indexes: { "by-createdAt": string };
  };
  memory: {
    key: string;
    value: EncryptedRecord;
    indexes: { "by-createdAt": string };
  };
  settings: {
    key: string;
    value: Settings;
  };
  meta: {
    key: string;
    value: { appSaltB64: string };
  };
}

const DB_NAME = "trust_first_journal_v1";

const DEFAULT_SETTINGS: Settings = {
  aiEnabled: true,
  autoLockMinutes: 10,
  insightsEnabled: true,
  rememberAiKey: false,
  aiApiKey: undefined,
};

async function getDB() {
  return openDB<JournalDB>(DB_NAME, 1, {
    upgrade(d) {
      const entries = d.createObjectStore("entries", { keyPath: "id" });
      entries.createIndex("by-createdAt", "createdAt");

      const memory = d.createObjectStore("memory", { keyPath: "id" });
      memory.createIndex("by-createdAt", "createdAt");

      d.createObjectStore("settings");
      d.createObjectStore("meta");
    },
  });
}

export async function getOrCreateAppSaltB64(): Promise<string> {
  const db = await getDB();
  const existing = await db.get("meta", "appSalt");
  if (existing?.appSaltB64) return existing.appSaltB64;

  const salt = makeRandomSalt();
  const appSaltB64 = b64FromBytes(salt);
  await db.put("meta", { appSaltB64 }, "appSalt");
  return appSaltB64;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  return (await db.get("settings", "settings")) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings) {
  const db = await getDB();
  await db.put("settings", next, "settings");
}

export async function saveEntryRecord(record: EncryptedRecord) {
  const db = await getDB();
  await db.put("entries", record);
}

export async function listEntryRecords(): Promise<EncryptedRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("entries", "by-createdAt");
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getEntryRecord(id: string): Promise<EncryptedRecord | undefined> {
  const db = await getDB();
  return db.get("entries", id);
}

export async function deleteEntryRecord(id: string) {
  const db = await getDB();
  await db.delete("entries", id);
}

export async function deleteAllEntries() {
  const db = await getDB();
  const keys = await db.getAllKeys("entries");
  await Promise.all(keys.map((k) => db.delete("entries", k as string)));
}

export async function saveMemoryRecord(record: EncryptedRecord) {
  const db = await getDB();
  await db.put("memory", record);
}

export async function listMemoryRecords(): Promise<EncryptedRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("memory", "by-createdAt");
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function deleteMemoryRecord(id: string) {
  const db = await getDB();
  await db.delete("memory", id);
}

export function newEncryptedRecordIndex(
  intent: EncryptedRecord["intent"],
  ritualName: string
) {
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    intent,
    ritualName,
  };
}

export async function deleteAllMemoryRecords() {
  const db = await getDB();
  const keys = await db.getAllKeys("memory");
  await Promise.all(keys.map((k) => db.delete("memory", k as string)));
}
