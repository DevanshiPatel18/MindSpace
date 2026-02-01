import { listEntryRecords, listMemoryRecords, getSettings } from "./storage";

export type BackupFileV1 = {
  version: 1;
  exportedAt: string;
  entries: Awaited<ReturnType<typeof listEntryRecords>>;
  memory: Awaited<ReturnType<typeof listMemoryRecords>>;
  settings: {
    aiEnabled: boolean;
    autoLockMinutes: number;
    insightsEnabled: boolean;
    rememberAiKey: boolean;
  };
};

export async function createBackup(): Promise<BackupFileV1> {
  const [entries, memory, settings] = await Promise.all([
    listEntryRecords(),
    listMemoryRecords(),
    getSettings(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    memory,
    settings: {
      aiEnabled: settings.aiEnabled,
      autoLockMinutes: settings.autoLockMinutes,
      insightsEnabled: settings.insightsEnabled,
      rememberAiKey: false, // intentionally safer
    },
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
