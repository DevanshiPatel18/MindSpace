import { EncryptedRecord } from "./types";

function toDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStreak(records: EncryptedRecord[]) {
  // streak based on unique entry dates, newest first
  const days = Array.from(new Set(records.map((r) => toDateKey(r.createdAt)))).sort((a, b) =>
    a > b ? -1 : 1
  );

  if (days.length === 0) return 0;

  let streak = 1;
  for (let i = 0; i < days.length - 1; i++) {
    const current = new Date(days[i]);
    const next = new Date(days[i + 1]);
    const diffDays = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) streak++;
    else break;
  }

  return streak;
}

export function lastEntryDate(records: EncryptedRecord[]) {
  if (!records.length) return null;
  // records are usually already sorted desc by createdAt; handle anyway
  const latest = [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  return latest.createdAt;
}