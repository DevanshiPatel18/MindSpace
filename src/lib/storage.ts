import { openDB, DBSchema } from "idb";
import { EncryptedRecord, Settings } from "./types";
import { makeRandomSalt } from "./crypto";
import { b64FromBytes } from "./util";

interface JournalDB extends DBSchema {
  entries: { key: string; value: EncryptedRecord; indexes: { "by-createdAt": string } };
  memory: { key: string; value: EncryptedRecord; indexes: { "by-createdAt": string } };
  settings: { key: string; value: Settings };
  meta: { key: string; value: { appSaltB64: string } };
}

const DB_NAME = "mindspace_v1";
const DEFAULT_SETTINGS: Settings = { aiEnabled: true, insightsEnabled: true, autoLockMinutes: 10, rememberAiKey: false };

async function db() {
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
  const d = await db();
  const existing = await d.get("meta", "appSalt");
  if (existing?.appSaltB64) return existing.appSaltB64;

  const salt = makeRandomSalt();
  const appSaltB64 = b64FromBytes(salt);
  await d.put("meta", { appSaltB64 }, "appSalt");
  return appSaltB64;
}

export async function getSettings(): Promise<Settings> {
  const d = await db();
  return (await d.get("settings", "settings")) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings) {
  const d = await db();
  await d.put("settings", next, "settings");
}

export async function saveEntryRecord(record: EncryptedRecord) {
  const d = await db();
  await d.put("entries", record);
}

export async function listEntryRecords(): Promise<EncryptedRecord[]> {
  const d = await db();
  const all = await d.getAllFromIndex("entries", "by-createdAt");
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getEntryRecord(id: string): Promise<EncryptedRecord | undefined> {
  const d = await db();
  return d.get("entries", id);
}

export async function deleteEntryRecord(id: string) {
  const d = await db();
  await d.delete("entries", id);
}

export async function deleteAllEntries() {
  const d = await db();
  const keys = await d.getAllKeys("entries");
  await Promise.all(keys.map((k) => d.delete("entries", k as string)));
}

export async function saveMemoryRecord(record: EncryptedRecord) {
  const d = await db();
  await d.put("memory", record);
}

export async function listMemoryRecords(): Promise<EncryptedRecord[]> {
  const d = await db();
  const all = await d.getAllFromIndex("memory", "by-createdAt");
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}