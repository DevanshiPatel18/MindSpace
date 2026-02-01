import { openDB, DBSchema } from "idb";
import type { EncryptedRecord, Settings } from "./types";
import { makeRandomSalt, encryptJson, decryptJson } from "./crypto";
import { b64FromBytes, uuid } from "./util";
import { getSessionKey } from "./session";

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
  useDefaultAiKey: false,
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
  const s = (await db.get("settings", "settings")) ?? DEFAULT_SETTINGS;

  // Attempt to decrypt AI API key if locked session matches
  const key = getSessionKey();
  if (key && s.encryptedAiApiKey && !s.aiApiKey) {
    try {
      const decrypted = await decryptJson<string>(key, s.encryptedAiApiKey.ciphertextB64, s.encryptedAiApiKey.ivB64);
      // We return it as if it were plain, for the app to use
      return { ...s, aiApiKey: decrypted };
    } catch (e) {
      console.warn("Could not decrypt settings key:", e);
    }
  }

  return s;
}

export async function saveSettings(next: Settings) {
  const db = await getDB();
  const toSave = { ...next };

  // If we are remembering the key, encrypt it before storing
  // (We never store the plain aiApiKey in DB if we can help it)
  const key = getSessionKey();
  if (key && next.rememberAiKey && next.aiApiKey) {
    const encrypted = await encryptJson(key, next.aiApiKey);
    toSave.encryptedAiApiKey = encrypted;
    delete toSave.aiApiKey; // Remove plain text
  } else if (!next.rememberAiKey) {
    // If not remembering, ensure we wipe both
    delete toSave.aiApiKey;
    delete toSave.encryptedAiApiKey;
  }

  await db.put("settings", toSave, "settings");
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
