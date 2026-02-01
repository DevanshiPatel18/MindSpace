import { decryptJson, encryptJson } from "./crypto";
import { getSessionKey } from "./session";
import { deleteMemoryRecord, listMemoryRecords, saveMemoryRecord } from "./storage";
import { MemoryItem } from "./types";
import { getOrCreateAppSaltB64 } from "./storage";
import { getKdfVersion } from "./crypto";

export async function listMemoryItems(): Promise<Array<{ recordId: string; item: MemoryItem }>> {
  const key = getSessionKey();
  if (!key) throw new Error("locked");

  const records = await listMemoryRecords();
  const out: Array<{ recordId: string; item: MemoryItem }> = [];

  for (const r of records) {
    try {
      const item = await decryptJson<MemoryItem>(key, r.ciphertextB64, r.ivB64);
      out.push({ recordId: r.id, item });
    } catch {
      // ignore undecryptable record
    }
  }
  return out;
}

export async function updateMemoryItem(recordId: string, nextText: string) {
  const key = getSessionKey();
  if (!key) throw new Error("locked");

  // We keep the same recordId (stable) but re-encrypt payload with updated text
  const now = new Date().toISOString();
  const updated: MemoryItem = {
    id: recordId, // keep stable for convenience (or could keep separate)
    createdAt: now,
    text: nextText.trim(),
  };

  const { ciphertextB64, ivB64 } = await encryptJson(key, updated);
  const saltB64 = await getOrCreateAppSaltB64();

  await saveMemoryRecord({
    id: recordId,
    createdAt: updated.createdAt,
    ritualName: "Memory",
    intent: "make_sense",
    ciphertextB64,
    ivB64,
    saltB64,
    kdfVersion: getKdfVersion(),
  });
}

export async function removeMemoryItem(recordId: string) {
  await deleteMemoryRecord(recordId);
}
